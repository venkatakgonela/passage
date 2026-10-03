import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdtemp, mkdir, cp, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { section } from '../tests/shell-access.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'passage-media-'));
const images = resolve('docs/images'), media = resolve('docs/media');
await mkdir(images, { recursive: true }); await mkdir(media, { recursive: true });
await mkdir(join(temporary, 'home'));
await cp(resolve('examples'), join(temporary, 'examples'), { recursive: true });
const server = spawn(process.env.PYTHON || 'python3', ['-m', 'server', '--port', '0', '--root', join(temporary, 'examples')], { env: { ...process.env, HOME: join(temporary, 'home'), READER_SETTINGS: join(temporary, 'roots.json'), PYTHONPYCACHEPREFIX: join(temporary, 'cache') } });
let browser;
const frames = [], outbound = [], errors = [];
try {
  const url = await new Promise((accept, reject) => {
    server.stdout.on('data', data => { const match = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/); if (match) accept(match[0]); });
    server.once('exit', code => reject(new Error(`Server exited ${code}`)));
    setTimeout(() => reject(new Error('Server startup timed out')), 10000).unref();
  });
  browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => { if (!route.request().url().startsWith(url) && !/^(data:|about:)/.test(route.request().url())) { outbound.push(route.request().url()); return route.abort(); } return route.continue(); });
  await page.goto(url); await page.waitForFunction(() => document.querySelector('#doc').dataset.ready === 'true');
  const visit = async path => { await page.evaluate(async path => (await import('/continuity.js')).visit(path), path); await page.waitForFunction(path => location.hash === '#' + encodeURIComponent(path) && document.querySelector('#doc').dataset.ready === 'true', path); await page.locator('#scroller').evaluate(element => element.scrollTop = 0); };
  const capture = async (caption, name) => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const text = await page.locator('body').innerText();
    assert.ok(!/\/Users\/|\/private\/|@gmail|MR0\d/.test(text), 'Public media has no private text');
    if (name) await page.screenshot({ path: join(images, `${name}.png`) });
    if (!caption) return;
    await page.evaluate(caption => {
      const overlay = document.createElement('div'); overlay.id = 'demo-caption'; overlay.textContent = caption;
      Object.assign(overlay.style, { position: 'fixed', inset: 'auto 0 0', zIndex: '2147483647', padding: '18px 24px', background: '#172331', color: '#ffffff', font: '600 22px/1.4 system-ui', textAlign: 'center', pointerEvents: 'none' });
      document.body.append(overlay);
    }, caption);
    const filename = `frame-${String(frames.length).padStart(2, '0')}.png`;
    await page.screenshot({ path: join(temporary, filename) });
    await page.locator('#demo-caption').evaluate(element => element.remove()); frames.push({ filename, caption });
  };
  await page.evaluate(async () => (await import('/appearance.js')).setAppearance({ theme: 'light', fill: true, focus: false }));
  if (await page.getByRole('button', { name: 'Got it', exact: true }).isVisible()) await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await visit('reading-guide.md');
  await capture('Passage · read technical documents without changing them', 'hero');
  await section(page, 'files'); await page.locator('#tree-filter').fill('plan');
  await capture('Filter Files by name or title', 'filter');
  await page.locator('#tree-filter').fill(''); await page.locator('#scroller').focus(); await page.keyboard.press('Control+p'); await page.locator('#quick-query').fill('reading-guide');
  await page.locator('#quick-results button').first().waitFor();
  await capture('Ctrl/Cmd+P · jump straight to a document', 'jump');
  await page.locator('#quick-results button').first().click();
  await page.waitForFunction(() => location.hash === '#reading-guide.md' && document.querySelector('#doc').dataset.ready === 'true');
  await section(page, 'search'); await page.locator('#search-options summary').click(); await page.locator('#q').fill('synthetic');
  await page.waitForFunction(() => document.querySelector('#hint').textContent.includes('results for'));
  await capture('Search document contents · refine scope and matching', 'search');
  await section(page, 'files'); await visit('reading-guide.md');
  const link = page.locator('#doc a[data-md="plan.md"]'); await link.scrollIntoViewIfNeeded(); await link.click();
  await page.waitForFunction(() => location.hash === '#plan.md' && document.querySelector('#doc').dataset.ready === 'true');
  await capture('Follow a reference · your return Trail stays with you', 'trail');
  await page.locator('#scroller').focus(); await page.keyboard.press('Alt+ArrowLeft');
  await page.waitForFunction(() => location.hash === '#reading-guide.md' && document.querySelector('#doc').dataset.ready === 'true');
  await capture('Alt+Left · return to the passage you were reading');
  await page.locator('#doc .peek-button').first().click();
  await capture('Peek at a linked section without leaving the page', 'peek'); await page.keyboard.press('Escape');
  await page.locator('#doc .diagram-shell').first().scrollIntoViewIfNeeded();
  await page.locator('#doc .diagram-shell').first().getByRole('button', { name: 'Zoom in', exact: true }).click();
  await capture('Inspect diagrams · zoom, fit, source and fullscreen', 'diagrams');
  await section(page, 'compare'); await page.locator('#compare-left').selectOption('SAMPLE-plan.md'); await page.locator('#compare-right').selectOption('SAMPLE-report.md'); await page.locator('#compare-load').click();
  await page.waitForFunction(() => document.querySelector('#compare-status').textContent.startsWith('Aligned'));
  await capture('Compare plan and report · align matching sections', 'compare'); await page.locator('#compare-dialog [data-close-dialog]').click();
  await visit('SAMPLE-plan.md'); await section(page, 'notes'); await page.locator('#note-text').fill('Synthetic review: confirm the evidence before approval.'); await page.locator('#note-add').click();
  await page.waitForFunction(() => document.querySelector('#note-items').textContent.includes('confirm the evidence'));
  await capture('Keep a private review note · source files stay untouched', 'notes');
  await section(page, 'lists'); await page.locator('#list-name').fill('Synthetic review'); await page.locator('#list-create').click(); await page.waitForFunction(() => document.querySelector('#list-select').selectedOptions[0]?.textContent === 'Synthetic review'); await page.locator('#list-add').click();
  await page.waitForFunction(() => document.querySelector('#list-items .review-row'));
  await capture(null, 'lists');
  await page.locator('#panel-close').click(); await visit('reading-guide.md');
  await page.evaluate(async () => (await import('/appearance.js')).setAppearance({ focus: true }));
  await capture('Focus · use the reading space, keep your place', 'focus');
  await page.evaluate(async () => (await import('/appearance.js')).setAppearance({ theme: 'dark', focus: false }));
  await section(page, 'files'); await capture('Light, Dark or Auto · choose your reading environment', 'dark');
  await page.evaluate(async () => (await import('/appearance.js')).setAppearance({ theme: 'light' }));
  await page.setViewportSize({ width: 390, height: 800 }); await section(page, 'files'); await capture(null, 'narrow');
  assert.equal(frames.length, 12);
  assert.deepEqual(outbound, []); assert.deepEqual(errors, []);
  await writeFile(join(temporary, 'frames.txt'), frames.map(frame => `file '${frame.filename}'\nduration 5`).join('\n') + `\nfile '${frames.at(-1).filename}'\n`);
  const encode = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd: temporary, stdio: 'inherit' });
  encode(['-f', 'concat', '-safe', '0', '-i', 'frames.txt', '-t', '60', '-vf', 'fps=12,scale=1200:-2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '29', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', join(media, 'passage-demo.mp4')]);
  encode(['-i', join(media, 'passage-demo.mp4'), '-filter_complex', 'fps=12,scale=900:-1:flags=lanczos,split[frames][colors];[colors]palettegen=max_colors=64:stats_mode=diff[palette];[frames][palette]paletteuse=dither=none:diff_mode=rectangle', '-loop', '0', join(media, 'passage-demo.gif')]);
  assert.ok((await stat(join(media, 'passage-demo.mp4'))).size < 6000000, 'MP4 under 6 MB');
  assert.ok((await stat(join(media, 'passage-demo.gif'))).size < 5000000, 'GIF under 5 MB');
  encode(['-framerate', '1', '-i', 'frame-%02d.png', '-vf', 'scale=300:200,tile=3x4', '-frames:v', '1', join(images, 'demo-contact-sheet.png')]);
  const probes = {};
  for (const name of ['passage-demo.mp4', 'passage-demo.gif']) {
    probes[name] = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,width,height,r_frame_rate', '-of', 'json', join(media, name)], { encoding: 'utf8' }));
    execFileSync('ffmpeg', ['-v', 'error', '-i', join(media, name), '-f', 'null', '-'], { stdio: 'inherit' });
  }
  if (process.env.READER_EVIDENCE) await writeFile(join(process.env.READER_EVIDENCE, 'media-probes.json'), JSON.stringify({ browser: browser.version(), frames, probes, errors, outbound }, null, 2));
  console.log(JSON.stringify(probes, null, 2));
} finally {
  await browser?.close();
  if (server.exitCode === null) { server.kill('SIGINT'); await new Promise(resolve => server.once('exit', resolve)); }
  await rm(temporary, { recursive: true, force: true });
}
