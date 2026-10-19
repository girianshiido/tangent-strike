import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {makeLevel, projection, value} from '../.build/engine.js';
import {freshSave} from '../.build/storage.js';

const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
const report = [];
try {
  for (const [width, height, reducedMotion] of [[320, 568, false], [390, 844, false], [768, 1024, false], [1024, 768, false], [1440, 900, false], [900, 700, true]]) {
    const context = await browser.newContext({viewport: {width, height}, hasTouch: true, serviceWorkers: 'block'});
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const save = freshSave();save.sound = false;save.reducedMotion = reducedMotion;
    await page.addInitScript(save => {
      localStorage.setItem('tangent-strike-v1', JSON.stringify(save));
      window.resizeFrames = [];
      const Original = ResizeObserver;
      // Inspect the bitmap after the app's observer, before the browser presents it.
      // A screenshot taken after the next animation frame misses this regression.
      window.ResizeObserver = class extends Original {
        constructor(callback) {
          super((entries, observer) => {
            callback(entries, observer);
            for (const {target} of entries) {
              if (target.id !== 'board') continue;
              const pixel = [...target.getContext('2d').getImageData(0, 0, 1, 1).data];
              window.resizeFrames.push({width: target.width, height: target.height, pixel});
            }
          });
        }
      };
    }, save);
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:5191/');
    await page.waitForTimeout(100);
    const level = makeLevel(0), box = await page.locator('#board').boundingBox(), camera = projection(level, box.width, box.height);
    const beforeShot = await page.evaluate(() => window.resizeFrames.length);
    await page.touchscreen.tap(box.x + camera.center.x + camera.scale, box.y + camera.center.y - value(level.curve, 1) * camera.scale);
    await page.waitForTimeout(reducedMotion ? 500 : 1600);
    assert.equal(await page.locator('#shots').getAttribute('aria-label'), '2 tirs restants');
    assert.equal(await page.locator('#result').isVisible(), false);
    assert.deepEqual(await page.locator('#board').boundingBox(), box, 'The feedback moved or resized the plot');
    assert.equal(await page.evaluate(() => window.resizeFrames.length), beforeShot, 'Unexpected canvas resize after a shot');
    // Exercise actual resizes too, while the same attempt remains active.
    for (const viewport of [{width: height, height: width}, {width, height}]) {
      await page.setViewportSize(viewport);await page.waitForTimeout(100);
    }
    const frames = await page.evaluate(() => window.resizeFrames);
    assert.ok(frames.length >= 3, 'Resize coverage missing');
    for (const frame of frames) assert.ok(frame.pixel.slice(0, 3).some(channel => channel > 0), `Blank frame at ${width}×${height}: ${JSON.stringify(frame)}`);
    assert.deepEqual(errors, []);
    report.push({width, height, reducedMotion, resizeFrames: frames.length, blankFrames: 0, stablePlot: true});
    await context.close();
  }
  await mkdir('test-results', {recursive: true});
  await writeFile('test-results/render-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
