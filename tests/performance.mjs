import { chromium } from 'playwright-core';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const temporary = await mkdtemp(join(tmpdir(), 'reader-performance-'));
const root = join(temporary, 'synthetic'); await mkdir(root);
await Promise.all(Array.from({ length: 2000 }, (unused, index) => writeFile(join(root, `file-${String(index).padStart(4, '0')}.md`), `# Synthetic ${index}\n\n${index === 1990 ? 'rare-marker' : 'Small synthetic document'}.\n`)));
for (let index = 0; index < 3; index++) await writeFile(join(root, `large-${index}.md`), '# Synthetic large file\n' + 'bounded paragraph\n'.repeat(60000));
const started = performance.now();
const server = spawn('python3', ['-m', 'server', '--port', '0', '--root', root], { env: { ...process.env, READER_SETTINGS: join(temporary, 'roots.json') } });
let browser;
try {
  const url = await new Promise((accept, reject) => { server.stdout.on('data', chunk => { const match = chunk.toString().match(/http:\/\/127.0.0.1:\d+/); if (match) accept(match[0]); }); server.once('exit', code => reject(new Error(String(code)))); });
  const startupMs = performance.now() - started;
  browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const treeStart = performance.now(); await page.goto(url); await page.waitForFunction(() => document.querySelector('#doc').dataset.ready === 'true');
  const treeMs = performance.now() - treeStart;
  const search = await page.evaluate(async () => { const roots = await (await fetch('/api/roots')).json(); const start = performance.now(); const result = await (await fetch(`/api/search?root=${roots[0].id}&q=rare-marker&format=details`)).json(); return { elapsedMs: performance.now() - start, ...result }; });
  const quickStart = performance.now(); await page.locator('#scroller').focus(); await page.keyboard.press('Control+p'); await page.locator('#quick-query').fill('1990'); await page.locator('#quick-results button').first().waitFor();
  const result = { files: 2003, startupMs, treeMs, search, quickOpenMs: performance.now() - quickStart, browser: browser.version() };
  console.log(JSON.stringify(result, null, 2));
  if (process.env.READER_EVIDENCE) await writeFile(join(process.env.READER_EVIDENCE, 'performance.json'), JSON.stringify(result, null, 2));
} finally { await browser?.close(); server.kill('SIGINT'); await new Promise(accept => server.once('exit', accept)); await rm(temporary, { recursive: true, force: true }); }
