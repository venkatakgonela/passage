import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function checkFill(page, evidence) {
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const load = async settings => {
    await page.evaluate(async settings => {
      const { store } = await import('/state.js');
      if (settings === null) store.remove('appearance');
      else store.set('appearance', JSON.stringify(settings));
    }, settings);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#doc').dataset.ready === 'true');
    await page.evaluate(async () => (await import('/continuity.js')).visit('reading-guide.md'));
    await page.waitForFunction(() => location.hash === '#reading-guide.md' && document.querySelector('#doc').dataset.ready === 'true');
    await settle();
  };
  const dimensions = () => page.locator('#doc').evaluate(doc => {
    const box = doc.getBoundingClientRect();
    const paragraph = doc.querySelector('p:not(.meta)').getBoundingClientRect();
    const scroller = document.querySelector('#scroller').getBoundingClientRect();
    return { left: box.left, right: box.right, width: box.width, proseLeft: paragraph.left, proseRight: paragraph.right, proseWidth: paragraph.width, areaLeft: scroller.left, areaRight: scroller.right };
  });
  await load(null);
  assert.equal(await page.locator('#fill-window').isChecked(), true, 'Fresh settings default Fill on');
  const results = [];
  for (const width of [1200, 1440, 1715, 1920]) for (const focus of [false, true]) for (const panels of [false, true]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(async ({ focus, panels }) => {
      (await import('/appearance.js')).setAppearance({ focus });
      document.querySelector('#nav').classList.toggle('hide', !panels);
      document.querySelector('#right-panel').classList.toggle('collapsed', !panels);
      document.querySelector('#right-panel').classList.toggle('open', panels);
    }, { focus, panels });
    await settle();
    const box = await dimensions();
    assert.ok(Math.abs(box.proseRight - box.right) <= 1, `Default prose fills container ${width}/${focus}/${panels}`);
    assert.ok(Math.abs(box.proseLeft - box.left) <= 1, 'Default prose shares left edge');
    assert.ok(box.width <= 1801 && box.left >= box.areaLeft && box.right <= box.areaRight + 1, 'Container respects available area and cap');
    const padding = width < 1280 ? 56 : 64;
    assert.ok(Math.abs(box.width - Math.min(1800, box.areaRight - box.areaLeft - padding)) <= 1, 'Container follows available width below cap');
    results.push({ width, focus, panels, ...box });
    if (evidence && !panels) await page.screenshot({ path: join(evidence, `fill-${width}-${focus ? 'focus' : 'normal'}.png`) });
  }
  await page.setViewportSize({ width: 2560, height: 1000 });
  await settle();
  const wide = await dimensions();
  assert.ok(Math.abs(wide.width - 1800) <= 1, 'Ultrawide container capped at 1800px');
  assert.ok(Math.abs((wide.left + wide.right) / 2 - 1280) <= 1, 'Ultrawide focus container centred');
  await load({ measure: 96 });
  assert.equal(await page.locator('#fill-window').isChecked(), true, 'Legacy unset Fill takes new default');
  assert.equal(await page.locator('#measure').inputValue(), '96', 'Existing line limit preserved');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#rail-appearance').click();
  const fill = page.getByRole('switch', { name: 'Fill window', exact: true });
  assert.equal(await fill.isChecked(), true);
  assert.equal(await page.getByRole('slider', { name: /Maximum line length/ }).count(), 0, 'Limit absent from accessibility tree while filling');
  await fill.focus(); await page.keyboard.press('Space');
  const limit = page.getByRole('slider', { name: /Maximum line length/ });
  await limit.waitFor({ state: 'visible' });
  await settle();
  const panel = await page.locator('#appearance-dialog').boundingBox();
  assert.ok(panel.y >= 0 && panel.y + panel.height <= 1000, 'Revealed limit keeps anchored panel inside viewport');
  assert.equal(await limit.isVisible(), true, 'Fill off reveals Maximum line length');
  await limit.fill('80');
  await page.keyboard.press('Escape');
  await settle();
  assert.ok(Math.abs((await dimensions()).proseWidth - 720) <= 1, 'Fill off restores measured prose');
  await page.reload(); await page.waitForFunction(() => document.querySelector('#doc').dataset.ready === 'true');
  await settle();
  assert.equal(await page.locator('#fill-window').isChecked(), false, 'Stored explicit Fill off survives reload');
  assert.ok(Math.abs((await dimensions()).proseWidth - 720) <= 1, 'Stored off retains measured width');
  await page.locator('#appearance').click(); await page.locator('#reset').click();
  assert.equal(await fill.isChecked(), true, 'Reset returns Fill on');
  assert.equal(await page.locator('#measure').inputValue(), '80');
  assert.equal(await limit.count(), 0, 'Reset hides line limit');
  await page.keyboard.press('Escape'); await settle();
  const reset = await dimensions();
  assert.ok(Math.abs(reset.proseRight - reset.right) <= 1, 'Reset prose fills container');
  if (evidence) await writeFile(join(evidence, 'fill-results.json'), JSON.stringify({ results, wide, reset }, null, 2));
  console.log('PASS default Fill geometry, ultrawide cap, unset migration, explicit-off persistence and reset');
}
