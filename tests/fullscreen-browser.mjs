import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function checkFullscreen(page, fixtureRoot, evidence) {
  const architecture = await readFile(new URL('../docs/ARCHITECTURE.md', import.meta.url), 'utf8');
  const sequence = architecture.match(/```mermaid\n(sequenceDiagram[\s\S]*?)```/)[1];
  const fixtures = ['flowchart LR\nA --> B', 'flowchart TD\nA --> B', sequence, 'erDiagram\nCUSTOMER ||--o{ ORDER : places'];
  await writeFile(join(fixtureRoot, 'fullscreen.md'), '# Synthetic fullscreen checks\n\n' + fixtures.map(source => '```mermaid\n' + source + '\n```').join('\n\n'));
  await writeFile(join(fixtureRoot, 'fullscreen-architecture.md'), architecture);
  if (evidence) await mkdir(evidence, { recursive: true });
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
  const open = async (file, theme) => {
    await page.evaluate(async ({ file, theme }) => {
      (await import('/appearance.js')).setAppearance({ theme, focus: false });
      await (await import('/workspace.js')).loadRoots();
      (await import('/continuity.js')).visit(file);
    }, { file, theme });
    await page.waitForFunction(file => location.hash === '#' + file && document.querySelector('#doc').dataset.ready === 'true', file);
    await settle();
  };
  const geometry = () => page.locator('dialog[open] .diagram-viewport').evaluate(viewport => {
    const frame = viewport.querySelector('iframe');
    return { viewport: viewport.getBoundingClientRect().toJSON(), frame: frame.getBoundingClientRect().toJSON(), clientWidth: viewport.clientWidth, clientHeight: viewport.clientHeight, scrollWidth: viewport.scrollWidth, scrollHeight: viewport.scrollHeight };
  });
  const contained = measured => {
    assert.ok(measured.frame.left >= measured.viewport.left - 1 && measured.frame.top >= measured.viewport.top - 1, 'Fit frame starts inside viewport');
    assert.ok(measured.frame.right <= measured.viewport.right + 1 && measured.frame.bottom <= measured.viewport.bottom + 1, 'Fit frame fully contained');
    assert.ok(measured.scrollWidth <= measured.clientWidth + 1 && measured.scrollHeight <= measured.clientHeight + 1, 'Fit needs no scrollbars');
  };
  const results = [];
  for (const theme of ['light', 'dark']) for (const size of [{ width: 1440, height: 900 }, { width: 1715, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await open('fullscreen.md', theme);
    for (let index = 0; index < fixtures.length; index++) {
      const shell = page.locator('#doc .diagram-shell').nth(index);
      await shell.getByRole('button', { name: 'Fit', exact: true }).click();
      await shell.getByRole('button', { name: 'Fullscreen', exact: true }).focus();
      const inline = await shell.evaluate(element => ({ height: element.getBoundingClientRect().height, frame: element.querySelector('iframe').getBoundingClientRect().toJSON(), viewport: element.querySelector('.diagram-viewport').style.height, scroll: document.querySelector('#scroller').scrollTop }));
      await shell.getByRole('button', { name: 'Fullscreen', exact: true }).press('Enter');
      await settle();
      const dialog = page.locator('dialog[open]');
      await dialog.getByRole('button', { name: 'Fullscreen', exact: true }).click();
      assert.equal(await page.locator('dialog[open]').count(), 1, 'Fullscreen does not nest dialogs');
      const measured = await geometry();
      if (size.width > 390) assert.ok(measured.viewport.height >= size.height * .8, 'Fullscreen viewport fills at least 80% of desktop height');
      contained(measured);
      const intrinsicWidth = Number(await dialog.locator('.diagram-shell').getAttribute('data-intrinsic-width'));
      const expectedWidth = Math.min(intrinsicWidth * 4, measured.clientWidth - 24, (measured.clientHeight - 24) * measured.frame.width / measured.frame.height);
      assert.ok(Math.abs(measured.frame.width - expectedWidth) < 1, 'Fit uses the full available viewport up to the zoom cap');
      if (index < 2 && size.width > 390) assert.ok(measured.frame.width > inline.frame.width * 1.1, 'Small diagram grows beyond inline');
      assert.equal(await dialog.locator('iframe').getAttribute('sandbox'), '');
      const background = await page.locator('#scroller').evaluate(element => element.scrollTop);
      await dialog.locator('.diagram-viewport').hover();
      await page.mouse.wheel(0, 900);
      await settle();
      assert.equal(await page.locator('#scroller').evaluate(element => element.scrollTop), background, 'Background does not scroll');
      await dialog.getByRole('button', { name: 'Source', exact: true }).press('Enter');
      assert.ok(await dialog.locator('.diagram-viewport .diagram-source').isVisible());
      assert.ok(await dialog.evaluate(element => element.scrollHeight <= element.clientHeight + 1), 'Source stays inside dialog');
      await dialog.getByRole('button', { name: 'Source', exact: true }).press('Enter');
      await dialog.getByRole('button', { name: 'Reset', exact: true }).press('Enter');
      contained(await geometry());
      if (index === 2 && size.width > 390) {
        await page.setViewportSize({ width: 700, height: 600 });
        await settle();
        contained(await geometry());
        await page.setViewportSize(size);
        await settle();
        contained(await geometry());
        await dialog.getByRole('button', { name: 'Zoom in', exact: true }).click();
        assert.ok((await geometry()).frame.width > measured.frame.width, 'Zoom enlarges');
        await dialog.locator('.diagram-viewport').focus();
        await page.keyboard.press('ArrowRight');
        assert.ok(await dialog.locator('.diagram-viewport').evaluate(element => element.scrollLeft > 0), 'Arrow pans zoomed diagram');
        const pan = await dialog.locator('.diagram-viewport').boundingBox();
        await dialog.locator('.diagram-viewport').evaluate(element => { element.scrollLeft = 0; });
        await page.mouse.move(pan.x + pan.width / 2, pan.y + pan.height / 2);
        await page.mouse.down();
        await page.mouse.move(pan.x + pan.width / 2 - 70, pan.y + pan.height / 2);
        await page.mouse.up();
        assert.ok(await dialog.locator('.diagram-viewport').evaluate(element => element.scrollLeft > 0), 'Pointer drag pans zoomed diagram');
        await dialog.getByRole('button', { name: 'Zoom out', exact: true }).click();
        await dialog.getByRole('button', { name: 'Fit', exact: true }).click();
        contained(await geometry());
      }
      results.push({ theme, size, family: fixtures[index].split('\n')[0], ...measured });
      await page.keyboard.press('Escape');
      await settle();
      assert.equal(await page.locator('dialog[open]').count(), 0);
      assert.equal(await shell.locator('.diagram-viewport').evaluate(element => element.style.height), inline.viewport);
      assert.ok(Math.abs(await shell.evaluate(element => element.getBoundingClientRect().height) - inline.height) < 1, 'Inline height restored');
      assert.ok(Math.abs(await page.locator('#scroller').evaluate(element => element.scrollTop) - inline.scroll) < 2, 'Reading position restored');
      assert.equal(await shell.getByRole('button', { name: 'Fullscreen', exact: true }).evaluate(element => document.activeElement === element), true, 'Focus restored');
    }
  }
  await page.setViewportSize({ width: 1715, height: 1000 });
  await open('fullscreen-architecture.md', 'light');
  const sequenceShell = page.locator('#doc .diagram-shell').filter({ has: page.locator('.diagram-source', { hasText: 'sequenceDiagram' }) }).first();
  await sequenceShell.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await settle();
  contained(await geometry());
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('dialog[open]').getByRole('button', { name: 'Copy source', exact: true }).press('Enter');
  await page.waitForFunction(() => document.querySelector('dialog .scroll-hint').textContent.startsWith('Source copied'));
  assert.equal((await page.evaluate(() => navigator.clipboard.readText())).trim(), sequence.trim());
  await page.context().clearPermissions();
  if (evidence) {
    await page.screenshot({ path: join(evidence, 'after-architecture-sequence-1715.png') });
    await writeFile(join(evidence, 'fullscreen-results.json'), JSON.stringify(results, null, 2));
  }
  await page.keyboard.press('Escape');
  console.log('PASS fullscreen fit, fill, resize, inline restoration, focus and scroll isolation: 24 family/theme/viewport cases');
}
