export async function section(page, name) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (await page.locator('body').evaluate(element => element.classList.contains('focus-mode'))) await page.locator('#exit-focus').click();
  const narrow = page.viewportSize().width < 1024;
  if (narrow && await page.locator('#nav').evaluate(element => element.classList.contains('hide'))) await page.locator('#navtog').click();
  const button = page.locator(`#${narrow ? 'tab' : 'rail'}-${name}`);
  if (name === 'compare' || !await page.locator('#nav').isVisible() || await page.locator('#nav').getAttribute('data-section') !== name) await button.click();
}

export async function menuAction(page, name) {
  await page.locator('#overflow').click();
  await page.locator('#reader-menu-items').getByRole('button', { name, exact: true }).click();
}

export async function workspaceAction(page, name) {
  await section(page, 'files');
  await page.locator('#workspace-actions').click();
  await page.locator('#reader-menu-items').getByRole('button', { name, exact: true }).click();
}

export async function paletteAction(page, name) {
  await page.locator('#scroller').focus(); await page.keyboard.press('Control+k');
  await page.locator('#palette-query').fill(name);
  await page.locator('#palette-actions button').filter({ hasText: name }).first().click();
}
