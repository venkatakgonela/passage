import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { section, menuAction } from './shell-access.mjs';

export async function checkOrientation(page, fixtureRoot, evidence) {
  const results = [];
  const originalNote = await readFile(join(fixtureRoot, 'notes/detail.md'), 'utf8');
  const open = async path => {
    await page.evaluate(async path => { const { visit } = await import('/continuity.js'); visit(path); }, path);
    await page.waitForFunction(path => document.querySelector('#doc').dataset.ready === 'true' && decodeURIComponent(location.hash.slice(1).split('#')[0]) === path, path).catch(async error => { throw new Error(`Open ${path}: ${JSON.stringify(await page.evaluate(() => ({ hash: location.hash, ready: document.querySelector('#doc').dataset.ready, text: document.querySelector('#doc').textContent, toast: document.querySelector('#toast').textContent })))}; ${error.message}`); });
  };
  for (const theme of ['light', 'dark']) for (const width of [1440, 1024, 390]) {
    console.log(`Orientation ${theme}/${width}`);
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(async theme => { const { setAppearance } = await import('/appearance.js'); setAppearance({ theme, focus: false }); }, theme);
    await open('notes/detail.md');
    await section(page, 'files');
    await page.locator('#tree-filter').fill('detail');
    assert.equal(await page.locator('#list a.f').count(), 1);
    assert.ok(await page.locator('#list summary').filter({ hasText: 'notes' }).isVisible());
    await page.locator('#collapse-all').press('Enter');
    await page.locator('#reveal-current').press('Enter');
    await page.waitForFunction(() => document.querySelector('#list a.on') === document.activeElement, null, { timeout: 3000 }).catch(async error => { throw new Error(`Reveal focus ${theme}/${width}: ${await page.evaluate(() => document.activeElement.outerHTML)}; ${error.message}`); });
    if (width <= 820) await page.keyboard.press('Escape');
    else {
      const resizer = page.locator('#nav-resizer'); const before = Number(await resizer.getAttribute('aria-valuenow'));
      await resizer.focus(); await page.keyboard.press('ArrowRight');
      assert.equal(Number(await resizer.getAttribute('aria-valuenow')), Math.min(280, before + 10));
    }
    await section(page, 'files');
    await page.locator('#tree-preferences').press('Enter');
    await page.getByRole('button', { name: 'Sort by last modified', exact: true }).press('Enter');
    if (width === 1440) {
      const resizer = page.locator('#toc-resizer');
      const before = Number(await resizer.getAttribute('aria-valuenow'));
      await resizer.focus(); await page.keyboard.press('ArrowLeft');
      assert.equal(Number(await resizer.getAttribute('aria-valuenow')), Math.min(320, before + 10));
    }
    await section(page, 'files');
    await page.locator('#workspace-actions').press('Enter');
    assert.ok(await page.getByRole('button', { name: 'Add folder', exact: true }).isVisible());
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog:modal') && document.activeElement === document.querySelector('#workspace-actions'));
    if (width < 1024) await page.keyboard.press('Escape');
    await page.locator('#crumb button').filter({ hasText: 'notes' }).press('Enter');
    await page.locator('#reader-menu-items button').filter({ hasText: 'detail.md' }).press('Enter');
    await page.locator('#scroller').focus();
    await page.keyboard.press('Control+p');
    await page.locator('#quick-query').fill('plan');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => location.hash === '#plan.md' && document.querySelector('#doc').dataset.ready === 'true');
    await menuAction(page, 'History and navigation');
    const pin = page.getByRole('button', { name: 'Pin current file', exact: true });
    if (await pin.count()) await pin.press('Enter'); else await page.keyboard.press('Escape');
    assert.ok(await page.evaluate(async () => (await import('/session.js')).session.pins.includes('plan.md')), `Pin action ${theme}/${width}`);
    await open('architecture.md');
    const link = page.locator('#doc a[data-md="plan.md"]');
    await link.scrollIntoViewIfNeeded(); await link.focus();
    const before = await link.evaluate(element => element.getBoundingClientRect().top);
    await link.press('Enter');
    await page.waitForFunction(() => location.hash === '#plan.md' && document.querySelector('#doc').dataset.ready === 'true');
    assert.ok(await page.locator('#trail-return').isVisible());
    await page.goBack();
    await page.waitForFunction(() => location.hash === '#architecture.md' && document.querySelector('#doc').dataset.ready === 'true');
    const backTop = await page.locator('#doc a[data-md="plan.md"]').evaluate(element => element.getBoundingClientRect().top);
    assert.ok(Math.abs(before - backTop) <= 6, `Native Back restores passage ${theme}/${width}: ${before} -> ${backTop}`);
    await page.goForward();
    await page.waitForFunction(() => location.hash === '#plan.md' && document.querySelector('#doc').dataset.ready === 'true');
    await page.locator('#scroller').focus(); await page.keyboard.press('Alt+ArrowLeft');
    await page.waitForFunction(() => location.hash === '#architecture.md' && document.querySelector('#doc').dataset.ready === 'true');
    const after = await page.locator('#doc a[data-md="plan.md"]').evaluate(element => element.getBoundingClientRect().top);
    assert.ok(Math.abs(before - after) <= 6, `Trail position ${width}: ${before} -> ${after}`);
    await page.getByRole('button', { name: 'Peek plan', exact: true }).press('Enter');
    await page.locator('#peek-dialog[open]').waitFor();
    assert.ok(await page.locator('#peek-dialog').isVisible());
    assert.ok(await page.locator('#peek-content').textContent());
    await page.keyboard.press('Escape');
    assert.ok(await page.getByRole('button', { name: 'Peek plan', exact: true }).evaluate(element => element === document.activeElement));
    await page.locator('#scroller').focus(); await page.keyboard.press('Control+f');
    await page.locator('#find-query').fill('component');
    assert.ok(await page.locator('#doc mark.find-match').count() > 0);
    await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#doc mark.find-match').count(), 0);
    await open('notes/detail.md');
    const sectionLink = page.locator('#doc a[data-md="report.md"]');
    await sectionLink.locator('xpath=following-sibling::button[1]').press('Enter');
    await page.locator('#peek-dialog[open]').waitFor();
    assert.ok((await page.locator('#peek-content').textContent()).includes('Results'));
    assert.equal(await page.locator('#peek-content h1').count(), 0, 'Peek extracts the linked section rather than the whole file');
    await page.keyboard.press('Escape');
    await page.reload();
    await page.waitForFunction(() => location.hash === '#notes%2Fdetail.md' && document.querySelector('#doc').dataset.ready === 'true');
    assert.ok(await page.locator('#crumb').textContent().then(text => text.includes('detail.md')));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.ok(await page.evaluate(async () => (await import('/session.js')).session.pins.includes('plan.md')), 'Pins survive reload');
    const marker = `Refresh proof ${theme} ${width}`;
    await writeFile(join(fixtureRoot, 'notes/detail.md'), originalNote + `\n\n${marker}\n`);
    await page.waitForFunction(marker => document.querySelector('#doc').textContent.includes(marker), marker, { timeout: 15000 });
    await writeFile(join(fixtureRoot, 'temporary.md'), '# Temporary synthetic document\n');
    await page.locator('#list a[data-p="temporary.md"]').waitFor({ state: 'attached', timeout: 15000 });
    await open('temporary.md');
    await rm(join(fixtureRoot, 'temporary.md'));
    await page.reload();
    await page.waitForFunction(() => location.hash === '#README.md' && document.querySelector('#doc').dataset.ready === 'true');
    await open('notes/detail.md');
    if (evidence) await page.screenshot({ path: join(evidence, `orientation-${theme}-${width}.png`) });
    results.push({ theme, width, passed: true });
  }
  await open('architecture.md');
  const position = await page.evaluate(async () => {
    document.querySelector('#components').scrollIntoView({ block: 'start', behavior: 'instant' });
    return (await import('/continuity.js')).capturePosition();
  });
  const originalArchitecture = await readFile(join(fixtureRoot, 'architecture.md'), 'utf8');
  await writeFile(join(fixtureRoot, 'architecture.md'), originalArchitecture.replace('## Components', '## Renamed components'));
  await page.locator('#renamed-components').waitFor({ timeout: 15000 });
  assert.ok(await page.evaluate(async position => {
    const { restorePosition } = await import('/continuity.js'); restorePosition(position);
    return document.querySelector('#scroller').scrollTop > 0;
  }, position), 'Edited heading falls back to passage/offset');
  if (evidence) await writeFile(join(evidence, 'orientation-results.json'), JSON.stringify({ interactions: results, liveRefresh: true, missingSessionFallback: true }, null, 2));
}
