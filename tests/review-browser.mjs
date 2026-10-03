import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { section } from './shell-access.mjs';

export async function checkReviews(page, fixtureRoot, evidence) {
  const original = await readFile(join(fixtureRoot, 'SAMPLE-plan.md'), 'utf8');
  const open = async path => {
    await page.evaluate(async path => { const { visit } = await import('/continuity.js'); visit(path); }, path);
    await page.waitForFunction(path => document.querySelector('#doc').dataset.ready === 'true' && decodeURIComponent(location.hash.slice(1).split('#')[0]) === path, path);
  };
  const close = async selector => { await page.locator(`${selector} [data-close-dialog]`).click(); await page.locator(`${selector}[open]`).waitFor({ state: 'hidden' }); };
  const results = [];
  for (const width of [1440, 390]) {
    console.log(`Review interactions ${width}`);
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(async () => { const { setAppearance } = await import('/appearance.js'); setAppearance({ theme: 'light', focus: false }); });
    await open('SAMPLE-plan.md');
    await page.locator('#scroller').focus(); await page.keyboard.press('/');
    await page.locator('#search-options summary').click();
    await page.locator('#search-scope').selectOption('document');
    await page.locator('#search-phrase').check(); await page.locator('#search-case').check();
    await page.locator('#q').fill('alpha beta');
    await page.waitForFunction(() => document.querySelector('#hint').textContent.includes('0 results for “alpha beta”'));
    await page.locator('#q').fill('Alpha beta');
    await page.waitForFunction(() => document.querySelector('#hint').textContent.includes('1 result for “Alpha beta”'));
    await page.locator('#list a.f').click();
    await section(page, 'search');
    await page.locator('#back-results').click();
    assert.match(await page.locator('#search-results').textContent(), /SAMPLE-plan.md/);
    await page.locator('#search-results button').click();
    await section(page, 'search');
    await page.locator('#back-results').click();
    assert.equal(await page.locator('#search-results button').count(), 1);
    await close('#results-dialog');
    await page.locator('#chain button').filter({ hasText: 'SAMPLE-report.md' }).click();
    await page.waitForFunction(() => location.hash.startsWith('#SAMPLE-report.md') && document.querySelector('#doc').dataset.ready === 'true');
    await section(page, 'compare');
    await page.locator('#compare-left').selectOption('SAMPLE-plan.md');
    await page.locator('#compare-right').selectOption('SAMPLE-report.md');
    await page.locator('#compare-load').click();
    await page.waitForFunction(() => document.querySelector('#compare-status').textContent.startsWith('Aligned') && document.querySelector('.compare-article').textContent.includes('reading plan'));
    await page.locator('#compare-section').selectOption('evidence:0');
    assert.equal(await page.locator('.compare-article h2').filter({ hasText: 'Evidence' }).count(), 2);
    await page.locator('#compare-left').selectOption('stress.md');
    await page.locator('#compare-right').selectOption('stress.md');
    await page.locator('#compare-load').click();
    await page.waitForFunction(() => document.querySelector('#compare-status').textContent.startsWith('Aligned') && document.querySelectorAll('.compare-article .diagram-shell[data-diagram="ready"]').length >= 6);
    const comparison = await page.evaluate(async () => {
      const panes = [...document.querySelectorAll('.compare-pane')];
      panes[0].scrollTop = 700;
      await new Promise(accept => setTimeout(accept, 200));
      return { difference: Math.abs(panes[0].scrollTop - panes[1].scrollTop),
        overflow: panes.map(pane => pane.scrollWidth - pane.clientWidth),
        bounds: panes.map(pane => ({ left: pane.getBoundingClientRect().left, right: pane.getBoundingClientRect().right })),
        frames: [...document.querySelectorAll('.compare-pane iframe')].map(frame => frame.getAttribute('sandbox')) };
    });
    assert.ok(comparison.difference <= 6, JSON.stringify(comparison));
    assert.ok(comparison.overflow.every(value => value <= 1), JSON.stringify(comparison));
    assert.ok(comparison.bounds.every(bounds => bounds.left >= 0 && bounds.right <= width), JSON.stringify(comparison));
    assert.ok(comparison.frames.every(value => value === ''));
    if (evidence) await page.screenshot({ path: join(evidence, `compare-${width}.png`) });
    await close('#compare-dialog');
    await open('SAMPLE-plan.md');
    await section(page, 'lists');
    await page.locator('#list-name').fill(`Synthetic ${width}`); await page.locator('#list-create').click();
    await page.waitForFunction(name => document.querySelector('#list-select').selectedOptions[0]?.textContent === name, `Synthetic ${width}`);
    await page.locator('#list-add').click();
    await page.waitForFunction(() => document.querySelectorAll('#list-items .review-row').length === 1);
    await close('#lists-dialog');
    await open('SAMPLE-report.md'); await section(page, 'lists'); await page.locator('#list-add').click();
    await page.waitForFunction(() => document.querySelectorAll('#list-items .review-row').length === 2);
    await page.locator('#list-items .review-row').nth(1).getByRole('button', { name: 'Move up', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#list-items .review-row').textContent.includes('SAMPLE-report.md'));
    await close('#lists-dialog');
    await open('SAMPLE-plan.md');
    await page.locator('#evidence').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    const expectedAnchor = await page.evaluate(async () => (await import('/continuity.js')).capturePosition());
    await section(page, 'notes');
    await page.locator('#notes-dialog[open]').waitFor();
    assert.ok(expectedAnchor.heading, 'Scrolled passage has a heading');
    assert.ok((await page.locator('#note-anchor').textContent()).endsWith(expectedAnchor.heading), 'Opening notes preserves the passage anchor');
    await page.locator('#note-text').fill(`Synthetic review note ${width}`); await page.locator('#note-add').click();
    await page.waitForFunction(width => document.querySelector('#note-items').textContent.includes(`Synthetic review note ${width}`), width);
    await page.locator('#notes-export').click();
    assert.match(await page.locator('#export-text').inputValue(), /Synthetic review note/);
    if (evidence) await page.screenshot({ path: join(evidence, `notes-export-${width}.png`) });
    await close('#export-dialog'); await close('#notes-dialog');
    await writeFile(join(fixtureRoot, 'SAMPLE-plan.md'), '# Changed synthetic document\n\nAll former headings and passages removed.\n');
    await page.waitForFunction(() => document.querySelector('#doc').textContent.includes('All former headings'), null, { timeout: 15000 });
    await section(page, 'notes');
    await page.locator('#notes-dialog[open]').waitFor();
    assert.match(await page.locator('#note-items').textContent(), /orphaned/);
    await close('#notes-dialog');
    await writeFile(join(fixtureRoot, 'SAMPLE-plan.md'), original);
    await page.waitForFunction(() => document.querySelector('#doc').textContent.includes('exact phrase'), null, { timeout: 15000 });
    results.push({ width, search: 'phrase/case/document scope and retained results', compare: comparison, lists: 'keyboard reordered', notes: 'created/exported/orphaned' });
    await page.locator('#scroller').focus(); await page.keyboard.press('/');
    await page.locator('#q').fill('');
    await page.locator('#search-options summary').click();
    if (width <= 820) await page.keyboard.press('Escape');
  }
  if (evidence) await writeFile(join(evidence, 'review-results.json'), JSON.stringify(results, null, 2));
}
