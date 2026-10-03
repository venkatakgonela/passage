import assert from 'node:assert/strict';

export async function checkDialogs(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  if (await page.locator('nav').evaluate(element => element.classList.contains('hide'))) await page.locator('#navtog').click();
  for (const dismissal of ['Escape', 'Cancel']) {
    await page.locator('#rm').click();
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
    assert.equal(await page.locator('#rm').evaluate(element => element === document.activeElement), true);
  }
  let deletes = 0;
  await page.route('**/api/roots?*', route => {
    deletes++;
    return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Synthetic remove failure"}' });
  });
  await page.locator('#rm').click();
  await page.locator('#confirmation-dialog').getByText('Remove folder', { exact: true }).click();
  await page.getByText('Synthetic remove failure', { exact: true }).waitFor();
  assert.equal(deletes, 1);
  await page.unroute('**/api/roots?*');
  await page.route('**/api/browse?*', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Synthetic browse failure"}' }));
  await page.locator('#add').click();
  await page.locator('#dlg .action-status').filter({ hasText: 'Synthetic browse failure' }).waitFor();
  await page.unroute('**/api/browse?*');
  await page.route('**/api/roots', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Synthetic add failure"}' }));
  await page.locator('#bok').click();
  await page.locator('#dlg .action-status').filter({ hasText: 'Synthetic add failure' }).waitFor();
  await page.keyboard.press('Escape');
  await page.unroute('**/api/roots');
  assert.equal(await page.locator('#add').evaluate(element => element === document.activeElement), true);
  await page.route('**/api/reviews?*', route => route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"Synthetic corrupt settings"}' }));
  for (const success of [false, true]) {
    await page.route('**/api/reviews/reset?*', route => route.fulfill({ status: success ? 200 : 403, contentType: 'application/json', body: success ? '{"notice":"Synthetic backup retained"}' : '{"error":"Synthetic reset refused"}' }));
    await page.locator('#lists-open').click();
    await page.locator('#confirmation-dialog').getByText('Move corrupt settings aside', { exact: true }).click();
    await page.locator('#review-tools .action-status').filter({ hasText: success ? 'Synthetic backup retained' : 'Synthetic reset refused' }).waitFor();
    assert.equal(await page.locator('#lists-open').evaluate(element => element === document.activeElement), true);
    await page.unroute('**/api/reviews/reset?*');
  }
  await page.unroute('**/api/reviews?*');
  await page.evaluate(() => document.querySelectorAll('.action-status').forEach(element => element.textContent = ''));
  console.log('PASS in-page confirmation keyboard/focus and inline action errors');
}
