import assert from 'node:assert/strict';
import { section, workspaceAction } from './shell-access.mjs';

export async function checkDialogs(page) {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.evaluate(async () => (await import('/appearance.js')).setAppearance({ focus: false }));
  await page.locator('#scroller').focus();
  await page.keyboard.press('/');
  await workspaceAction(page, 'Remove folder');
  await page.locator('#confirmation-dialog').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.locator('#confirmation-dialog').waitFor({ state: 'detached' });
  assert.equal(await page.locator('#workspace-actions').isVisible(), true, 'Escape closes only the confirmation, not its invoking drawer');
  assert.equal(await page.locator('#workspace-actions').evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForFunction(() => innerWidth === 1440);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(async () => (await import('/appearance.js')).setAppearance({ focus: false }));
  await section(page, 'files');
  for (const dismissal of ['Escape', 'Cancel']) {
    await workspaceAction(page, 'Remove folder');
    const dialog = page.locator('#confirmation-dialog');
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.getByText('Cancel', { exact: true }).evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.getByText('Remove folder', { exact: true }).evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await dialog.getByText('Cancel', { exact: true }).evaluate(element => element === document.activeElement), true);
    if (dismissal === 'Escape') await page.keyboard.press('Escape');
    else await dialog.getByText('Cancel', { exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await page.locator('#workspace-actions').evaluate(element => element === document.activeElement), true);
  }
  let deletes = 0;
  await page.route('**/api/roots?*', route => {
    deletes++;
    return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Synthetic remove failure"}' });
  });
  await workspaceAction(page, 'Remove folder');
  await page.locator('#confirmation-dialog').getByText('Remove folder', { exact: true }).click();
  await page.locator('#shell-status').filter({ hasText: 'Synthetic remove failure' }).waitFor();
  assert.equal(deletes, 1);
  await page.unroute('**/api/roots?*');
  await page.route('**/api/browse?*', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Synthetic browse failure"}' }));
  await workspaceAction(page, 'Add folder');
  await page.locator('#dlg .action-status').filter({ hasText: 'Synthetic browse failure' }).waitFor();
  await page.unroute('**/api/browse?*');
  assert.equal(await page.locator('#bok').isDisabled(), true);
  await page.keyboard.press('Escape');
  await page.route('**/api/browse?*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"path":"synthetic","parent":null,"dirs":[],"can_register":true,"registration_error":""}' }));
  await workspaceAction(page, 'Add folder');
  await page.waitForFunction(() => !document.querySelector('#bok').disabled);
  await page.route('**/api/roots', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Synthetic add failure"}' }));
  await page.locator('#bok').click();
  await page.locator('#dlg .action-status').filter({ hasText: 'Synthetic add failure' }).waitFor();
  await page.keyboard.press('Escape');
  await page.unroute('**/api/roots');
  await page.unroute('**/api/browse?*');
  assert.equal(await page.locator('#workspace-actions').evaluate(element => element === document.activeElement), true);
  await page.route('**/api/reviews?*', route => route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"Synthetic corrupt settings"}' }));
  for (const success of [false, true]) {
    await page.route('**/api/reviews/reset?*', route => route.fulfill({ status: success ? 200 : 403, contentType: 'application/json', body: success ? '{"notice":"Synthetic backup retained"}' : '{"error":"Synthetic reset refused"}' }));
    await page.locator('#rail-lists').click();
    await page.locator('#confirmation-dialog').getByText('Move corrupt settings aside', { exact: true }).click();
    await page.locator('#shell-status').filter({ hasText: success ? 'Synthetic backup retained' : 'Synthetic reset refused' }).waitFor();
    assert.equal(await page.locator('#rail-lists').evaluate(element => element === document.activeElement), true);
    await page.locator('#panel-close').click();
    await page.unroute('**/api/reviews/reset?*');
  }
  await page.unroute('**/api/reviews?*');
  await page.evaluate(() => document.querySelectorAll('.action-status').forEach(element => element.textContent = ''));
  console.log('PASS in-page confirmation keyboard/focus and inline action errors');
}
