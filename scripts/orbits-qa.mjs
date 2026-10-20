import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {curvePoint, makeLevel, projection} from '../.build/engine.js';
import {freshSave} from '../.build/storage.js';

const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
try {
  const context = await browser.newContext({viewport: {width: 320, height: 568}, hasTouch: true, deviceScaleFactor: 2});
  const page = await context.newPage(), errors = [], layouts = [];
  page.on('pageerror', error => errors.push(error.message));
  const old = freshSave();old.stars = Array(84).fill(2);old.runs = old.runs.slice(0, 7).map(r => ({...r, next: 12, cleared: true, lives: 2}));old.unlockedWorld = 6;old.lastLevel = 83;old.sound = false;old.reducedMotion = true;
  await page.addInitScript(old => {if (!sessionStorage.getItem('orbit-qa')) {localStorage.setItem('tangent-strike-v1', JSON.stringify(old));sessionStorage.setItem('orbit-qa', '1');}}, old);
  await page.goto(process.env.QA_URL || 'http://127.0.0.1:5191/');
  await page.waitForFunction(() => document.querySelector('#connection').textContent.includes('PRÊT HORS LIGNE'));
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('tangent-strike-v1')));
  assert.equal(await page.locator('[data-world]').count(), 8);
  assert.deepEqual((await read()).stars.slice(0, 84), old.stars);
  await page.locator('[data-world="7"]').click();
  await page.waitForFunction(() => document.querySelector('#board').dataset.level === '84');
  // The keyboard can shoot a truly vertical tangent without a slope or x-coordinate hack.
  await page.locator('#board').focus();await page.keyboard.press('Enter');
  await page.locator('#result:not([hidden])').waitFor();assert.equal(await page.locator('.stars').getAttribute('aria-label'), '3 étoiles');
  const tap = async id => {
    const level = makeLevel(id), box = await page.locator('#board').boundingBox(), camera = projection(level, box.width, box.height), point = curvePoint(level.curve, level.solution);
    await page.touchscreen.tap(box.x + camera.center.x + point.x * camera.scale, box.y + camera.center.y - point.y * camera.scale);
    await page.locator('#result:not([hidden])').waitFor();assert.equal(await page.locator('.stars').getAttribute('aria-label'), '3 étoiles');
  };
  await page.locator('#result-next').click();await page.waitForFunction(() => document.querySelector('#board').dataset.level === '85');
  assert.match(await page.locator('#direction-badge').innerText(), /parcours/);await tap(85);
  await page.locator('#result-next').click();await page.waitForFunction(() => document.querySelector('#board').dataset.level === '86');
  assert.match(await page.locator('#direction-badge').innerText(), /inverse/);await tap(86);
  assert.equal((await read()).runs[7].lives, 3);
  // All later orbits are accessible in the laboratory, without changing campaign records.
  await page.locator('#help').click();await page.locator('#menu-practice').click();await page.locator('[data-practice="7"]').click();
  const select = async id => {
    if (await page.locator('#levels').isVisible()) await page.locator(`button[data-level="${id}"]`).click();
    else {await page.locator('#help').click();await page.locator('#menu-levels').click();await page.locator(`[data-jump="${id}"]`).click();}
    await page.waitForFunction(id => document.querySelector('#board').dataset.level === String(id), id);
  };
  await mkdir('test-results', {recursive: true});
  for (const viewport of [{width: 320, height: 480}, {width: 320, height: 568}, {width: 390, height: 844}, {width: 568, height: 320}, {width: 768, height: 1024}, {width: 1440, height: 900}]) {
    await page.setViewportSize(viewport);
    for (const id of [84, 87, 89, 92, 94, 95]) {
      await select(id);
      const board = await page.locator('#board').boundingBox(), formula = await page.locator('#function').boundingBox(), badge = await page.locator('#direction-badge').boundingBox(), camera = projection(makeLevel(id), board.width, board.height);
      assert.ok(formula.x + formula.width <= badge.x - 2, `Formula overlaps direction: ${id}/${viewport.width}`);
      assert.ok(formula.y + formula.height <= board.y + camera.top + 1, `Formula overlaps plot: ${id}/${viewport.width}×${viewport.height}`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight));
      layouts.push({id, ...viewport});
    }
    await page.screenshot({path: `test-results/orbits-${viewport.width}x${viewport.height}.png`});
  }
  await page.setViewportSize({width: 390, height: 844});await select(87);
  assert.equal(await page.locator('[data-direction="right"]').getAttribute('aria-label'), 'Tirer dans le sens du parcours');
  assert.equal(await page.locator('[data-direction="left"]').getAttribute('aria-label'), 'Tirer dans le sens inverse du parcours');
  await page.locator('#hint').click();assert.match(await page.locator('#feedback').innerText(), /t =/);
  await page.screenshot({path: 'test-results/orbits-ellipse.png'});
  await page.locator('#help').click();await page.locator('#menu-lesson').click();assert.match(await page.locator('#modal-content').innerText(), /λ ≥ 0/);await page.locator('#close-modal').click();
  await page.locator('#help').click();await page.locator('#menu-practice').click();
  await context.setOffline(true);await page.reload();await page.waitForFunction(() => document.querySelector('#board').dataset.level === '86');await tap(86);
  assert.deepEqual((await read()).stars.slice(0, 84), old.stars);
  assert.deepEqual(errors, []);
  const report = {layouts: layouts.length, migration: true, verticalKeyboardShot: true, forwardPointsLeft: true, inverseShot: true, directionLabels: true, offlineWin: true, errors};
  await writeFile('test-results/orbits-report.json', JSON.stringify(report, null, 2));console.log(JSON.stringify(report));
  await context.close();
} finally {await browser.close();}
