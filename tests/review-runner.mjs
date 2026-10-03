import { chromium } from 'playwright-core';
import { mkdtemp, mkdir, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { checkReviews } from './review-browser.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'reader-review-'));
await mkdir(join(temporary, 'home'));
await cp(resolve('examples'), join(temporary, 'examples'), { recursive: true });
const server = spawn('python3', ['-m', 'server', '--port', '0', '--root', join(temporary, 'examples')], { env: { ...process.env, HOME: join(temporary, 'home'), READER_SETTINGS: join(temporary, 'roots.json') } });
let browser;
try {
  const url = await new Promise((accept, reject) => {
    server.stdout.on('data', data => { const match = data.toString().match(/http:\/\/127.0.0.1:\d+/); if (match) accept(match[0]); });
    server.once('exit', code => reject(new Error(`Server exit ${code}`)));
  });
  browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage();
  page.on('pageerror', error => console.error(error));
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('#doc').dataset.ready === 'true');
  try { await checkReviews(page, join(temporary, 'examples'), process.env.READER_EVIDENCE); }
  catch (error) {
    console.error(await page.evaluate(() => ({ status: document.querySelector('#compare-status').textContent, diagrams: [...document.querySelectorAll('.compare-article .diagram-shell')].map(element => ({ state: element.dataset.diagram, text: element.textContent.slice(0, 200) })), dialogs: [...document.querySelectorAll('dialog[open]')].map(element => element.id) })));
    if (process.env.READER_EVIDENCE) await page.screenshot({ path: join(process.env.READER_EVIDENCE, 'review-failure.png') });
    throw error;
  }
  console.log('PASS review interaction checks');
} finally {
  await browser?.close(); server.kill('SIGINT'); await new Promise(accept => server.once('exit', accept));
  await rm(temporary, { recursive: true, force: true });
}
