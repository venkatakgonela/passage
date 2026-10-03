import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { section, workspaceAction } from './shell-access.mjs';
import { APP_VERSION } from '../web/config.js';

export async function checkChrome(page, evidence) {
  const results = [];
  const bounds = async label => {
    const failures = await page.evaluate(() => {
      const visible = element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).display !== 'none';
      return [...document.querySelectorAll('#rail button,#nav button,#nav input,#nav select,#page-header button,#right-panel button,dialog:modal button,dialog:modal input,dialog:modal select,#appearance-dialog[open] button,#appearance-dialog[open] input,#appearance-dialog[open] select')].filter(visible).flatMap(element => {
        const rect = element.getBoundingClientRect();
        const ancestor = element.closest('dialog,#nav,#right-panel');
        const box = ancestor?.getBoundingClientRect();
        const verticallyScrolled = box && (rect.bottom < box.top || rect.top > box.bottom);
        if (verticallyScrolled) return [];
        return rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > innerHeight + 1 ? [{ id: element.id, text: element.textContent, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }] : [];
      });
    });
    assert.deepEqual(failures, [], label);
  };
  for (const theme of ['light', 'dark']) for (const width of [1920, 1440, 1280, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(async theme => { (await import('/appearance.js')).setAppearance({ theme, focus: false, fs: 18, measure: 68 }); (await import('/continuity.js')).visit('reading-guide.md'); }, theme);
    await page.waitForFunction(() => location.hash === '#reading-guide.md' && document.querySelector('#doc').dataset.ready === 'true');
    if (await page.getByRole('button', { name: 'Got it', exact: true }).isVisible()) await page.getByRole('button', { name: 'Got it', exact: true }).click();
    await page.locator('#scroller').evaluate(element => element.scrollTop = 0);
    await section(page, 'files');
    await bounds(`Files chrome ${width}/${theme}`);
    const rows = await page.locator('#list a.f').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
    assert.ok(rows.every(height => width < 1024 ? height >= 44 : height >= 26 && height <= 30), 'Compact rows / touch target heights');
    assert.equal(await page.locator('#files-view input:visible').count(), 1, 'One Files filter');
    assert.equal(await page.locator('#list a.f:not(.on) small:visible').count(), 0, 'No duplicate filename rows');
    await page.locator('#list summary').first().focus(); await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#list').evaluate(element => element.contains(document.activeElement)), true);
    assert.equal(await page.locator('#list [tabindex="0"]').count(), 1, 'Roving tree focus');
    await page.locator('#tree-preferences').click();
    await bounds(`Tree menu ${width}/${theme}`);
    await page.keyboard.press('End');
    assert.equal(await page.locator('#reader-menu-items button').last().evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#reader-menu-items button').nth(1).evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#tree-preferences').evaluate(element => element === document.activeElement), true);
    if (width < 1024) {
      await page.locator('#panel-close').focus(); await page.keyboard.press('Shift+Tab');
      assert.equal(await page.locator('#nav').evaluate(element => element.contains(document.activeElement)), true);
      await page.keyboard.press('Escape');
    }
    await page.locator('#appearance').click(); await bounds(`Appearance ${width}/${theme}`); await page.keyboard.press('Escape');
    await page.locator('#overflow').click(); await bounds(`Overflow ${width}/${theme}`);
    assert.ok((await page.locator('#reader-menu').textContent()).includes(`Passage ${APP_VERSION}`), 'Overflow exposes release version');
    await page.keyboard.press('Escape');
    await section(page, 'search'); await bounds(`Search ${width}/${theme}`);
    await section(page, 'lists'); await page.locator('#lists-dialog[open]').waitFor(); await bounds(`Lists ${width}/${theme}`);
    await section(page, 'notes'); await page.locator('#notes-dialog[open]').waitFor(); await bounds(`Notes ${width}/${theme}`);
    await page.keyboard.press('Control+k'); await page.locator('#palette[open]').waitFor(); await page.keyboard.press('Escape');
    await page.keyboard.press('Control+p'); await page.locator('#quick-dialog[open]').waitFor(); await page.keyboard.press('Escape');
    await page.locator('#panel-close').click();
    await page.locator('#toctog').click(); await bounds(`Outline ${width}/${theme}`);
    assert.equal(await page.locator('#toc').textContent().then(text => text.includes('↗')), false, 'Plain outline entries');
    await page.locator('[data-right="notes"]').click();
    await page.locator('#right-panel #notes-dialog[open]').waitFor();
    await bounds(`Right notes ${width}/${theme}`);
    await page.locator('[data-right="lists"]').click();
    await page.locator('#right-panel #lists-dialog[open]').waitFor();
    assert.equal(await page.locator('#right-panel dialog[open]').count(), 1, 'Right tabs show a single review view');
    await page.locator('[data-right="outline"]').click();
    assert.equal(await page.locator('#toc').isVisible(), true);
    await page.locator('#outline-close').click();
    await page.locator('#appearance').click(); await page.locator('#focus').click();
    assert.equal(await page.locator('#rail').isVisible(), false);
    assert.equal(await page.locator('#nav').isVisible(), false);
    assert.equal(await page.locator('#right-panel').isVisible(), false);
    const position = await page.locator('#doc h1').evaluate(element => element.getBoundingClientRect().top);
    await page.mouse.move(width / 2, 1);
    await page.waitForFunction(() => document.querySelector('#page-header').classList.contains('revealed'));
    assert.ok(Math.abs(await page.locator('#doc h1').evaluate(element => element.getBoundingClientRect().top) - position) < 1, 'Focus overlay causes no layout shift');
    assert.equal(await page.locator('#page-header').evaluate(element => getComputedStyle(element).position), 'fixed', 'Focus header is an overlay');
    await page.locator('#search-jump').focus();
    assert.ok(await page.locator('#search-jump').evaluate(element => element.getBoundingClientRect().top >= 0), 'Keyboard focus not concealed');
    await page.locator('#scroller').focus(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('body').evaluate(element => element.classList.contains('focus-mode')), false);
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.width + 1, 'No page horizontal overflow');
    results.push({ width, theme, compactTree: true, menus: true, panelKeyboard: true, overlayShift: 0 });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#rail-labels').click();
  assert.equal(await page.locator('#rail').evaluate(element => element.classList.contains('expanded')), true);
  await page.reload(); await page.waitForFunction(() => document.querySelector('#doc').dataset.ready === 'true');
  assert.equal(await page.locator('#rail').evaluate(element => element.classList.contains('expanded')), true, 'Label preference persists');
  assert.equal(await page.locator('#first-hint').isVisible(), false, 'Dismissed first-run hint stays dismissed');
  await page.locator('#rail-labels').click();
  await workspaceAction(page, 'Add folder');
  await page.waitForFunction(() => document.querySelector('#bpath').textContent.length > 0);
  await bounds('Folder picker'); await page.keyboard.press('Escape');
  if (evidence) await writeFile(join(evidence, 'chrome-results.json'), JSON.stringify(results, null, 2));
  console.log('PASS chrome, menus, panels and focus at six widths in both themes');
}

export async function publicScreenshots(browser, url) {
  await mkdir(resolve('docs/images'), { recursive: true });
  for (const width of [1440, 1024, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    try {
      await page.goto(url); await page.waitForFunction(() => document.querySelector('#doc').dataset.ready === 'true');
      await page.evaluate(async () => { (await import('/appearance.js')).setAppearance({ theme: 'light', focus: false }); (await import('/continuity.js')).visit('reading-guide.md'); });
      await page.waitForFunction(() => location.hash === '#reading-guide.md' && document.querySelector('#doc').dataset.ready === 'true');
      if (await page.getByRole('button', { name: 'Got it', exact: true }).isVisible()) await page.getByRole('button', { name: 'Got it', exact: true }).click();
      await page.locator('#scroller').evaluate(element => element.scrollTop = 0);
      if (width < 1024) await page.locator('#navtog').click();
      assert.equal(await page.locator('.drawer-close:visible,#back-results:visible').count(), 0);
      assert.equal(await page.locator('#doc').textContent().then(text => /onerror|<script|\/Users\//.test(text)), false);
      await page.screenshot({ path: resolve(`docs/images/reading-${width}.png`) });
    } finally { await page.close(); }
  }
}
