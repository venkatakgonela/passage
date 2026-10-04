import { chromium } from 'playwright-core';
import { mkdtemp, cp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { checkFullscreen } from './fullscreen-browser.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'reader-fullscreen-'));
const fixtureRoot = join(temporary, 'examples');
await cp(resolve('examples'), fixtureRoot, { recursive: true });
await mkdir(join(temporary, 'home'));
const server = spawn('python3', ['-m', 'server', '--port', '0', '--root', fixtureRoot], { env: { ...process.env, HOME: join(temporary, 'home'), READER_SETTINGS: join(temporary, 'settings.json'), PYTHONPYCACHEPREFIX: join(temporary, 'cache') } });
let browser;
try {
  const url = await new Promise((accept, reject) => {
    server.stdout.on('data', data => { const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) accept(match[0]); });
    server.once('exit', code => reject(new Error(`Server exited ${code}`)));
    setTimeout(() => reject(new Error('Server startup timeout')), 10000).unref();
  });
  browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('#doc')?.dataset.ready === 'true');
  await checkFullscreen(page, fixtureRoot, process.env.READER_EVIDENCE);
} finally {
  await browser?.close();
  server.kill('SIGINT');
  await new Promise(accept => server.once('exit', accept));
  await rm(temporary, { recursive: true, force: true });
}
