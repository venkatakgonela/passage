import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const temporary = await mkdtemp(join(tmpdir(), 'reader-browser-'));
const executablePath = process.env.BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const evidence = process.env.READER_EVIDENCE;
const home = join(temporary, 'home');
await mkdir(home);
const server = spawn(process.env.PYTHON || 'python3', ['-m', 'server', '--port', '0', '--root', resolve('examples')], { env: { ...process.env, HOME: home, READER_SETTINGS: join(temporary, 'roots.json'), PYTHONPYCACHEPREFIX: join(temporary, 'cache') } });
let browser;
try {
  const url = await new Promise((accept, reject) => {
    let output = '';
    server.stdout.on('data', chunk => { output += chunk; const match = output.match(/http:\/\/127\.0\.0\.1:\d+/); if (match) accept(match[0]); });
    server.on('exit', code => reject(new Error(`Reader exited ${code}`)));
    server.stderr.on('data', chunk => process.stderr.write(chunk));
    setTimeout(() => reject(new Error('Reader startup timeout')), 10000).unref();
  });
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const outbound = [];
  const requested = [];
  page.on('request', request => requested.push(request.url()));
  await page.route('**/*', route => {
    if (!route.request().url().startsWith(url) && !route.request().url().startsWith('data:') && !route.request().url().startsWith('about:')) {
      outbound.push(route.request().url()); return route.abort();
    }
    return route.continue();
  });
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('#doc').dataset.ready === 'true');
  assert.ok(!requested.some(request => request.includes('mermaid.min.js')), 'Mermaid remains unloaded for prose');
  const roots = await page.evaluate(async () => (await fetch('/api/roots')).json());
  const files = await page.evaluate(async root => (await fetch(`/api/files?root=${root}`)).json(), roots[0].id);
  const results = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate(async theme => { const { setAppearance } = await import('/appearance.js'); setAppearance({ theme, fs: 18, focus: false }); }, theme);
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const file of files) {
        await page.evaluate(file => { location.hash = encodeURIComponent(file); }, file);
        await page.waitForFunction(file => document.querySelector('#doc').dataset.ready === 'true' && decodeURIComponent(location.hash.slice(1).split('#')[0]) === file && document.querySelector('#crumb').textContent.includes(file.split('/').at(-1)), file);
        const problems = await page.evaluate(() => {
          const visible = element => !!element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
          const outside = [];
          for (const element of document.querySelectorAll('body *')) {
            if (!visible(element) || element.closest('dialog:not([open])') || ['SCRIPT', 'STYLE'].includes(element.tagName)) continue;
            const rectangle = element.getBoundingClientRect();
            if (rectangle.right <= innerWidth + 1 && rectangle.left >= -1) continue;
            const region = element.parentElement?.closest('[data-scroll-region]');
            if (!region || !['auto', 'scroll'].includes(getComputedStyle(region).overflowX)) outside.push(`${element.tagName}.${element.className}`);
          }
          const regions = [...document.querySelectorAll('[data-scroll-region]')].filter(visible).filter(element => {
            const rectangle = element.getBoundingClientRect();
            return rectangle.right > innerWidth + 1 || rectangle.left < -1 || element.tabIndex < 0 || !['auto', 'scroll'].includes(getComputedStyle(element).overflowX) || !(element.parentElement.querySelector('.scroll-hint') || element.nextElementSibling?.classList.contains('scroll-hint'));
          }).map(element => element.dataset.scrollRegion);
          return { page: document.documentElement.scrollWidth > innerWidth + 1, outside, regions, raw: document.querySelectorAll('pre > code.language-mermaid').length, diagramErrors: [...document.querySelectorAll('[data-diagram=error]')].map(element => element.innerText) };
        });
        if (file === 'diagram-errors.md') {
          assert.equal(problems.diagramErrors.length, 2, 'Deliberately invalid diagrams show errors');
          assert.ok(problems.diagramErrors.every(message => message.includes('Original source')));
          problems.diagramErrors = [];
        }
        assert.deepEqual(problems, { page: false, outside: [], regions: [], raw: 0, diagramErrors: [] }, `${theme} ${width} ${file}`);
        const headings = await page.locator('#doc h1,#doc h2,#doc h3,#doc h4').evaluateAll(elements => elements.map(element => element.id));
        for (const heading of headings) {
          await page.evaluate(heading => document.getElementById(heading).scrollIntoView({ block: 'start', behavior: 'instant' }), heading);
          const clearance = await page.evaluate(heading => ({ top: document.getElementById(heading).getBoundingClientRect().top, boundary: document.querySelector('header').getBoundingClientRect().bottom, margin: parseFloat(getComputedStyle(document.getElementById(heading)).scrollMarginTop) }), heading);
          assert.ok(clearance.top >= clearance.boundary - 1 && clearance.margin >= 16, `Anchor clearance ${file} ${heading}: ${JSON.stringify(clearance)}`);
        }
        results.push({ theme, width, file, headings: headings.length, passed: true });
        if (evidence && ['architecture.md', 'stress.md', 'media.md'].includes(file)) {
          await page.evaluate(() => document.querySelector('#scroller').scrollTo(0, 0));
          await page.screenshot({ path: join(evidence, `reading-${theme}-${width}-${file.replace('.md', '')}.png`) });
        }
      }
    }
  }
  assert.deepEqual(errors, [], 'Browser JavaScript errors');
  assert.deepEqual(outbound, [], 'Unexpected external requests');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const open = async file => {
    await page.evaluate(file => { location.hash = encodeURIComponent(file); }, file);
    await page.waitForFunction(file => document.querySelector('#doc').dataset.ready === 'true' && document.querySelector('#crumb').textContent.includes(file), file);
  };
  await open('architecture.md');
  const diagram = page.locator('.diagram-shell').first();
  assert.equal(await diagram.locator('iframe').getAttribute('sandbox'), '');
  const beforeWidth = await diagram.locator('iframe').evaluate(element => element.getBoundingClientRect().width);
  await diagram.getByRole('button', { name: 'Zoom in', exact: true }).click();
  assert.ok(await diagram.locator('iframe').evaluate(element => element.getBoundingClientRect().width) > beforeWidth);
  await diagram.getByRole('button', { name: 'Fit', exact: true }).click();
  await diagram.getByRole('button', { name: 'Source', exact: true }).click();
  assert.ok(await diagram.locator('.diagram-source').isVisible());
  await diagram.getByRole('button', { name: 'Source', exact: true }).click();
  await diagram.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  assert.ok(await page.locator('dialog[open]').isVisible());
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 0);
  await page.locator('#doc h2 .a').first().click();
  await page.waitForFunction(() => location.hash.endsWith('#flow'));
  await page.locator('#doc h2 .a').nth(1).click();
  await page.waitForFunction(() => location.hash.endsWith('#components'));
  await page.goBack();
  assert.ok(page.url().endsWith('#flow'));
  await page.goForward();
  assert.ok(page.url().endsWith('#components'));
  await open('media.md');
  await page.waitForFunction(() => [...document.querySelectorAll('#doc img')].every(image => image.complete && image.naturalWidth > 0));
  assert.equal(await page.locator('#doc img').count(), 2);
  await page.locator('#doc img').first().press('Enter');
  assert.ok(await page.locator('dialog[open] img').isVisible());
  await page.keyboard.press('Escape');
  await page.locator('#appearance').click();
  await page.locator('#font').selectOption('sans');
  await page.locator('#measure').fill('90');
  await page.locator('#appearance-close').click();
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#doc').dataset.ready === 'true');
  assert.equal(await page.locator('html').getAttribute('data-font'), 'sans');
  await page.locator('#appearance').click();
  await page.locator('#reset').click();
  await page.locator('#appearance-close').click();
  assert.equal(await page.locator('html').getAttribute('data-font'), 'serif');
  await page.locator('#focus').click();
  assert.ok(await page.locator('body').evaluate(element => element.classList.contains('focus-mode')));
  await page.locator('#focus').click();
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.locator('#nav.hide').waitFor({ state: 'attached' });
  await page.locator('#navtog').click();
  assert.equal(await page.locator('#nav').getAttribute('aria-modal'), 'true');
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#navtog').evaluate(element => document.activeElement === element));
  await page.setViewportSize({ width: 1024, height: 1000 });
  await open('architecture.md');
  await page.locator('#doc h2').nth(1).scrollIntoViewIfNeeded();
  const anchorBeforeTheme = await page.locator('#components').evaluate(element => element.getBoundingClientRect().top);
  await page.evaluate(async () => { const { setAppearance } = await import('/appearance.js'); setAppearance({ theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' }); });
  await page.waitForFunction(() => document.querySelector('#doc').dataset.ready === 'true');
  const anchorAfterTheme = await page.locator('#components').evaluate(element => element.getBoundingClientRect().top);
  assert.ok(Math.abs(anchorAfterTheme - anchorBeforeTheme) <= 2, 'Theme rerender preserves reading anchor');
  let releaseMetadata;
  const metadataReady = new Promise(accept => { releaseMetadata = accept; });
  await page.route('**/api/image-info?*', async route => { await metadataReady; await route.continue(); });
  await page.evaluate(() => { location.hash = 'media.md'; });
  await page.locator('#return').waitFor();
  await page.locator('#return').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
  const beforeImages = await page.locator('#return').evaluate(element => element.getBoundingClientRect().top);
  releaseMetadata();
  await page.waitForFunction(() => document.querySelector('#doc').dataset.ready === 'true');
  const afterImages = await page.locator('#return').evaluate(element => element.getBoundingClientRect().top);
  assert.ok(Math.abs(afterImages - beforeImages) <= 2, `Image metadata preserves reading anchor: ${beforeImages} -> ${afterImages}`);
  await page.unroute('**/api/image-info?*');
  const contrast = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate(async theme => { const { setAppearance } = await import('/appearance.js'); setAppearance({ theme }); }, theme);
    contrast.push(await page.evaluate(theme => {
      const style = getComputedStyle(document.documentElement);
      const lum = name => {
        let value = style.getPropertyValue(name).trim().slice(1);
        if (value.length === 3) value = [...value].map(character => character.repeat(2)).join('');
        const channels = value.match(/../g).map(channel => parseInt(channel, 16) / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
        return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
      };
      const ratio = (left, right) => { const values = [lum(left), lum(right)].sort((left, right) => right - left); return +((values[0] + .05) / (values[1] + .05)).toFixed(2); };
      return { theme, body: ratio('--fg', '--bg'), muted: ratio('--mut', '--bg'), selected: ratio('--acc', '--accbg'), normalControl: ratio('--fg', '--surface'), hoverControl: ratio('--fg', '--hover'), activeControl: ratio('--fg', '--accbg'), focusSurface: ratio('--focus', '--surface'), focusBackground: ratio('--focus', '--bg'), controlBoundary: ratio('--control', '--surface') };
    }, theme));
  }
  for (const palette of contrast) for (const [state, value] of Object.entries(palette)) if (state !== 'theme') assert.ok(value >= (state.startsWith('focus') || state === 'controlBoundary' ? 3 : 4.5), `${palette.theme} ${state}: ${value}`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (evidence) {
    await page.setViewportSize({ width: 1024, height: 1000 });
    await page.evaluate(async () => { const { setAppearance } = await import('/appearance.js'); setAppearance({ theme: 'light' }); });
    await open('stress.md');
    for (const format of ['A4', 'Letter']) await page.pdf({ path: join(evidence, `reading-print-${format}.pdf`), format, printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
    await writeFile(join(evidence, 'browser-results.json'), JSON.stringify({ browser: browser.version(), results, errors, outbound, contrast, interactions: 'zoom, fit, source, fullscreen, fragment history, image enlargement, persistence/reset, focus, drawer keyboard, reduced motion' }, null, 2));
  }
  console.log(`PASS ${results.length} document/theme/viewport cases; browser ${browser.version()}`);
} finally {
  await browser?.close();
  server.kill('SIGINT');
  await new Promise(accept => server.once('exit', accept));
  await rm(temporary, { recursive: true, force: true });
}
