import assert from 'node:assert/strict';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { checkFill } from './fill-browser.mjs';

export async function checkPolish(page, fixtureRoot, evidence) {
  const source = '# Shared reading edge\n\nSynthetic alignment fixture. A paragraph that begins at the shared left edge.\n\n- First list item\n\n```text\nshort snippet\n```\n\n```text\n' + 'wide_content_'.repeat(180) + '\n```\n\n| Small | Table |\n| --- | --- |\n| One | Two |\n\n| ' + Array.from({ length: 16 }, (unused, index) => `Column ${index}`).join(' | ') + ' |\n| ' + '--- | '.repeat(16) + '\n| ' + 'long_content_here | '.repeat(16) + '\n\n```mermaid\nflowchart LR\nA --> B\n```\n\n```mermaid\nflowchart LR\n' + Array.from({ length: 16 }, (unused, index) => `N${index}[Long synthetic stage ${index}]`).join(' --> ') + '\n```\n\n$$a+b$$\n\n$$' + 'x + '.repeat(100) + 'y$$\n';
  await writeFile(join(fixtureRoot, 'alignment.md'), source + '\n![Synthetic image](assets/synthetic.png)\n\n[Read a related synthetic note](notes/detail.md)\n');
  await page.evaluate(async () => { await (await import('/workspace.js')).loadRoots(); (await import('/appearance.js')).setAppearance({ measure: 80, fs: 18, fill: false, focus: false, wrap: false }); (await import('/continuity.js')).visit('alignment.md'); });
  await page.waitForFunction(() => location.hash === '#alignment.md' && document.querySelector('#doc').dataset.ready === 'true');
  const anchor = page.locator('#doc h1 .a');
  await anchor.focus();
  assert.equal(await anchor.evaluate(element => getComputedStyle(element).opacity), '1', 'Heading anchor visible on keyboard focus');
  await page.locator('#scroller').focus();
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
  const results = [];
  for (const width of [1920, 1440, 1024]) for (const focus of [false, true]) for (const panels of [false, true]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(async ({ focus, panels }) => {
      (await import('/appearance.js')).setAppearance({ focus });
      document.querySelector('#nav').classList.toggle('hide', !panels);
      document.querySelector('#right-panel').classList.toggle('collapsed', !panels);
      document.querySelector('#right-panel').classList.toggle('open', panels);
    }, { focus, panels });
    await settle();
    const dimensions = await page.evaluate(() => {
      const doc = document.querySelector('#doc'), box = doc.getBoundingClientRect();
      const elements = [...doc.children].filter(element => element.matches('h1,p,ul,.code-frame,.tw,.diagram-shell'));
      const heading = doc.querySelector('h1'), text = [...heading.childNodes].find(node => node.nodeType === Node.TEXT_NODE), range = document.createRange(); range.selectNodeContents(text);
      return { container: { left: box.left, right: box.right, width: box.width }, textLeft: range.getBoundingClientRect().left, edges: elements.map(element => ({ kind: element.className || element.tagName, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right })), short: ['.code-frame', '.tw', '.diagram-shell', '.math-block'].map(selector => { const element = doc.querySelector(selector), target = element.closest('.technical-block'); return { selector, width: target.getBoundingClientRect().width, wide: target.classList.contains('wide-block') }; }), wide: [...doc.querySelectorAll(':scope>.wide-block')].map(element => ({ right: element.getBoundingClientRect().right, kind: element.className })) };
    });
    assert.ok(dimensions.container.width <= 1801, 'Container capped at 1800px');
    assert.ok(Math.abs(dimensions.textLeft - dimensions.container.left) <= 1, `Heading text shares left edge ${width}/${focus}/${panels}`);
    for (const edge of dimensions.edges) assert.ok(Math.abs(edge.left - dimensions.container.left) <= 1, `Shared left edge ${edge.kind} ${width}/${focus}/${panels}`);
    for (const block of dimensions.short) { assert.equal(block.wide, false, `Short ${block.selector} stays measured`); assert.ok(block.width <= Math.min(720, dimensions.container.width) + 1, 'Short block follows prose width'); }
    assert.ok(dimensions.wide.length >= 4, 'Wide code, table, diagram and math detected');
    for (const block of dimensions.wide) assert.ok(Math.abs(block.right - dimensions.container.right) <= 1, `Wide ${block.kind} reaches container edge`);
    const image = await page.locator('#doc .image-frame').evaluate(element => ({ left: element.getBoundingClientRect().left, width: element.getBoundingClientRect().width, intrinsic: element.querySelector('img').width }));
    assert.ok(Math.abs(image.left - dimensions.container.left) <= 1, 'Image shares the reading edge');
    assert.ok(Math.abs(image.width - (image.intrinsic > 720 ? dimensions.container.width : Math.min(720, dimensions.container.width))) <= 1, 'Image follows intrinsic width rule');
    results.push({ width, focus, panels, ...dimensions });
    if (evidence && !panels) { await page.locator('#scroller').evaluate(element => element.scrollTop = 0); await page.screenshot({ path: join(evidence, `alignment-${width}-${focus ? 'focus' : 'normal'}.png`) }); }
  }
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(async () => { (await import('/appearance.js')).setAppearance({ focus: false }); document.querySelector('#nav').classList.add('hide'); document.querySelector('#right-panel').classList.remove('open'); });
    await settle();
    await page.locator('#scroller').evaluate(element => element.scrollTop = 0);
    const trigger = page.locator(width < 1024 ? '#appearance' : '#rail-appearance');
    await trigger.focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#appearance-dialog').evaluate(element => element.open && !element.matches(':modal')), true, 'Appearance has no modal scrim');
    assert.equal(await page.locator('[name="appearance-theme"]:checked').evaluate(element => element === document.activeElement), true, 'Opening focuses selected theme');
    await page.locator('[name="appearance-theme"][value="light"]').check();
    await page.locator('[name="appearance-theme"][value="light"]').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[name="appearance-theme"]:checked').inputValue(), 'dark', 'Radio arrows change theme');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#font').evaluate(element => element === document.activeElement), true, 'Tab reaches typeface');
    await page.locator('#text-size').focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#size-value').textContent(), '19px', 'Text size exposes keyboard changes');
    await page.locator('[name="appearance-theme"][value="light"]').check();
    await page.locator('#text-size').fill('18');
    await page.locator('#fill-window').uncheck();
    await page.locator('#measure').fill('140');
    assert.equal(await page.locator('#measure-value').textContent(), '140 characters');
    await page.locator('#fill-window').check();
    if (evidence) await page.screenshot({ path: join(evidence, `appearance-${width}.png`) });
    await page.keyboard.press('Escape');
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true, 'Escape restores initiating trigger');
    await page.reload(); await page.waitForFunction(() => document.querySelector('#doc').dataset.ready === 'true');
    await settle();
    assert.equal(await page.locator('body').evaluate(element => element.classList.contains('fill-reading')), true, 'Fill persists');
    assert.equal(await page.locator('#measure').inputValue(), '140', 'Expanded measure persists');
    const filled = await page.locator('#doc').evaluate(element => ({ prose: element.querySelector('p').getBoundingClientRect().width, width: element.clientWidth }));
    assert.ok(Math.abs(filled.prose - filled.width) <= 1, 'Fill uses full container');
    await trigger.click(); await page.locator('#reset').click();
    assert.equal(await page.locator('#measure').inputValue(), '80');
    assert.equal(await page.locator('#fill-window').isChecked(), true);
    await page.locator('#appearance-close').focus(); await page.keyboard.press('Enter');
    await trigger.click(); await page.mouse.click(width - 4, 400);
    assert.equal(await page.locator('#appearance-dialog').evaluate(element => element.open), false, 'Outside click closes');
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true, 'Outside close restores trigger');
    if (width < 1024) {
      assert.equal(await page.locator('#first-hint').isVisible(), false);
      await page.locator('#doc .code-frame').nth(1).scrollIntoViewIfNeeded();
      const geometry = await page.evaluate(() => ({ menu: document.querySelector('#navtog').getBoundingClientRect().top, content: document.querySelector('#scroller').getBoundingClientRect().bottom }));
      assert.ok(geometry.content <= geometry.menu, `Menu never covers code at ${width}`);
      if (evidence) await page.screenshot({ path: join(evidence, `code-menu-${width}.png`) });
    }
  }
  const peek = page.locator('#doc .peek-button').first();
  assert.ok(await peek.getAttribute('title'));
  assert.equal(await peek.textContent(), '', 'Peek uses an icon instead of visible text');
  assert.equal(await peek.locator('svg[aria-hidden="true"]').count(), 1);
  const titles = await page.locator('#list a.f').evaluateAll(elements => elements.map(element => ({ title: element.title, text: element.querySelector('span')?.childNodes[0]?.textContent })));
  assert.ok(titles.length > 0);
  for (const item of titles) assert.ok(item.title.includes(item.text), 'Tree tooltip includes full displayed title');
  if (evidence) await writeFile(join(evidence, 'polish-results.json'), JSON.stringify(results, null, 2));
  await rm(join(fixtureRoot, 'alignment.md'));
  console.log('PASS shared edges, intrinsic widths, Fill persistence/reset, popover keyboard and narrow menu clearance');
  await checkFill(page, evidence);
}
