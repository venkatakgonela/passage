import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkDialogs } from './dialog-browser.mjs';
import { menuAction } from './shell-access.mjs';

export async function checkRelease(page, evidence) {
  await checkDialogs(page);
  const open = async file => {
    await page.evaluate(async file => { const { visit } = await import('/continuity.js'); visit(file); }, file);
    await page.waitForFunction(file => document.querySelector('#doc').dataset.ready === 'true' && decodeURIComponent(location.hash.slice(1).split('#')[0]) === file, file);
  };
  const results = [];
  const boundary = await page.evaluate(async () => {
    const { prepareMarkdown, decorateExtensions } = await import('/extensions.js');
    const { buildExport } = await import('/export.js');
    const container = document.createElement('article');
    document.body.append(container);
    const prepared = prepareMarkdown('$x$'); container.innerHTML = '<span data-math-slot="0"></span>';
    await decorateExtensions(container, prepared);
    const original = katex.renderToString;
    katex.renderToString = () => '<math><mi>x</mi></math><img src=x onerror="alert(1)"><script>alert(1)</script>';
    container.innerHTML = '<span data-math-slot="0"></span>';
    await decorateExtensions(container, prepared);
    const sanitized = !container.querySelector('script,[onerror]');
    katex.renderToString = original;
    const long = prepareMarkdown('$' + 'x'.repeat(4001) + '$'); container.innerHTML = '<span data-math-slot="0"></span>';
    await decorateExtensions(container, long);
    const longRefused = !!container.querySelector('.math-error');
    container.textContent = 'x'.repeat(8 * 1024 * 1024 + 1);
    let exportRefused = false;
    try { await buildExport(container, 'rendering.md'); } catch { exportRefused = true; }
    container.remove();
    return { sanitized, longRefused, exportRefused, expressions: prepareMarkdown('$x$ '.repeat(210)).math.length };
  });
  assert.deepEqual(boundary, { sanitized: true, longRefused: true, exportRefused: true, expressions: 200 });
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await open('rendering.md');
    assert.equal(await page.locator('#doc math').count(), 6, 'Valid equations produce MathML');
    assert.equal(await page.locator('#doc .math-inline + .math-hint').count(), 0, 'Inline equations never have helper text');
    await page.waitForFunction(() => [...document.querySelectorAll('#doc .math-block')].every(element => element.nextElementSibling.hidden === (element.scrollWidth <= element.clientWidth + 1)));
    assert.equal(await page.locator('#doc .math-block').evaluateAll(elements => elements.every(element => element.nextElementSibling.hidden === (element.scrollWidth <= element.clientWidth + 1))), true, 'Only overflowing display equations show a hint');
    assert.match(await page.locator('#doc').textContent(), /Costs \$5 and \$10 per month\. \$1,200 or \$1,500\. cash \$ and \$ cash\. US\$20 and \$30\./);
    assert.equal(await page.locator('#doc .math-error').count(), 2);
    assert.equal(await page.locator('#doc script,#doc [onerror],#doc a[href^="javascript:"]').count(), 0);
    await page.locator('#doc .front-matter summary').click();
    assert.match(await page.locator('#doc .front-matter').textContent(), /<img src=x onerror=alert\(1\)>/);
    await page.locator('#doc a[href="#note-sample"]').first().click();
    assert.ok((await page.evaluate(() => location.hash)).includes('note-sample'));
    await page.locator('#note-sample a').first().click();
    assert.ok((await page.evaluate(() => location.hash)).includes('ref-sample-1'));
    await page.locator('#scroller').focus(); await page.keyboard.press('Control+k');
    await page.locator('#palette-query').fill('export');
    assert.ok(await page.locator('#palette-actions button').count());
    await page.keyboard.press('Escape');
    const html = await page.evaluate(async () => (await import('/export.js')).buildExport(document.querySelector('#doc'), 'rendering.md'));
    const analysis = await page.evaluate(html => {
      const output = new DOMParser().parseFromString(html, 'text/html');
      return { math: output.querySelectorAll('math').length, forbidden: output.querySelectorAll('script,iframe,object,embed,form,link,base,[onerror],[onclick]').length, images: [...output.images].map(image => image.src), csp: output.querySelector('meta[http-equiv="Content-Security-Policy"]').content };
    }, html);
    assert.equal(analysis.forbidden, 0); assert.equal(analysis.math, 6);
    assert.ok(analysis.csp.includes("default-src 'none'"));
    const hostile = await page.evaluate(async () => (await import('/export.js')).exportMarkup('<script>alert(1)</script><iframe src="https://example.invalid"></iframe><svg onload="alert(1)"></svg><p style="background:url(https://example.invalid)" onclick="alert(1)">safe</p>'));
    assert.equal(hostile, '<p>safe</p>');
    assert.equal(await page.evaluate(async () => (await import('/export.js')).exportMarkup('<video src="https://example.invalid"><source src="https://example.invalid"></video>')), '');
    if (evidence) {
      await writeFile(join(evidence, `export-${width}.html`), html);
      await page.locator('#scroller').evaluate(element => { element.scrollTop = 0; });
      await page.screenshot({ path: join(evidence, `release-${width}.png`) });
    }
    const downloadPromise = page.waitForEvent('download');
    await menuAction(page, 'Export HTML');
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'rendering.html');
    results.push({ width, math: analysis.math, exportedActiveElements: analysis.forbidden, palette: 'keyboard opened/filtered/closed', footnotes: 'forward/return' });
  }
  await open('architecture.md');
  const exported = await page.evaluate(async () => (await import('/export.js')).buildExport(document.querySelector('#doc'), 'architecture.md'));
  assert.match(exported, /Diagram \(static export placeholder\)/);
  assert.ok(!exported.includes('<iframe'));
  await open('media.md');
  const images = await page.evaluate(async () => {
    const html = await (await import('/export.js')).buildExport(document.querySelector('#doc'), 'media.md');
    return [...new DOMParser().parseFromString(html, 'text/html').images].map(image => image.getAttribute('src'));
  });
  assert.ok(images.length > 0 && images.every(source => /^data:image\/(png|jpeg);base64,/.test(source)), 'Export embeds bounded raster images only');
  await open('rendering.md');
  await page.context().setOffline(true);
  const offlineMath = await page.evaluate(async () => {
    const { decorateExtensions, prepareMarkdown } = await import('/extensions.js');
    const container = document.createElement('article'); container.innerHTML = '<span data-math-slot="0"></span>';
    await decorateExtensions(container, prepareMarkdown('$x^2$')); return !!container.querySelector('math');
  });
  assert.equal(offlineMath, true);
  await page.context().setOffline(false);
  for (const [status, message] of [[404, 'missing or unavailable'], [413, '2 MiB']]) {
    await page.route('**/api/file?*', route => route.fulfill({ status, body: '{}' }));
    await page.evaluate(async () => (await import('/rendering.js')).openDocument(true));
    assert.ok((await page.locator('#doc').textContent()).includes(message));
    await page.unroute('**/api/file?*');
  }
  await page.evaluate(() => document.dispatchEvent(new Event('storage-unavailable')));
  assert.match(await page.locator('#toast').textContent(), /storage unavailable/);
  await page.route('**/api/file?*', route => route.abort());
  await page.evaluate(async () => (await import('/rendering.js')).openDocument(true));
  assert.match(await page.locator('#doc').textContent(), /Server unreachable/);
  await page.unroute('**/api/file?*');
  await page.locator('#doc').getByRole('button', { name: 'Retry', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#doc').dataset.ready === 'true' && !document.querySelector('#doc .recovery'));
  if (evidence) await writeFile(join(evidence, 'release-results.json'), JSON.stringify(results, null, 2));
  console.log('PASS rendering/export/recovery/palette checks at three widths');
}
