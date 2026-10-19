import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {freshSave} from '../.build/storage.js';
import {SOUND_ASSETS} from '../.build/sound-assets.js';
import {makeLevel, projection, value} from '../.build/engine.js';

const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
const report = [];
try {
  for (const mp3Fallback of [false, true]) {
    const context = await browser.newContext({viewport: {width: 320, height: 568}, hasTouch: true});
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const save = freshSave();save.reducedMotion = true;
    await page.addInitScript(save => {
      localStorage.setItem('tangent-strike-v1', JSON.stringify(save));
      window.playedSounds = [];
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        window.playedSounds.push({duration: this.buffer.duration, at: performance.now()});
        return start.apply(this, args);
      };
    }, save);
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:5191/');
    await page.waitForFunction(() => document.querySelector('#connection').textContent.includes('PRÊT HORS LIGNE'));
    // Independently decode every shipping file, including both codec alternatives.
    const decoded = await page.evaluate(async assets => {
      const context = new AudioContext(), report = [];
      for (const [name, files] of Object.entries(assets)) {
        for (const [codec, url] of Object.entries(files)) {
          const response = await fetch(url), buffer = await context.decodeAudioData(await response.arrayBuffer());
          report.push({name, codec, seconds: buffer.duration, channels: buffer.numberOfChannels});
        }
      }
      await context.close();return report;
    }, SOUND_ASSETS);
    assert.equal(decoded.length, 16);
    for (const sound of decoded) {assert.ok(sound.seconds > .1 && sound.seconds < 2);assert.equal(sound.channels, 2);}
    if (mp3Fallback) {
      // A broken OGG must fall back to MP3 rather than silence or an unhandled rejection.
      // Override the page fetch, since a service worker can bypass request routing.
      await page.addInitScript(() => {
        const original = window.fetch.bind(window);window.mp3Requests = 0;
        window.fetch = (input, init) => {
          const url = String(input);
          if (url.endsWith('.ogg')) return Promise.resolve(new Response('invalid audio', {headers: {'Content-Type': 'audio/ogg'}}));
          if (url.endsWith('.mp3')) window.mp3Requests++;
          return original(input, init);
        };
      });
      await page.reload();
    }
    const level = makeLevel(0), box = await page.locator('#board').boundingBox(), camera = projection(level, box.width, box.height);
    const tap = async a => page.touchscreen.tap(box.x + camera.center.x + a * camera.scale, box.y + camera.center.y - value(level.curve, a) * camera.scale);
    await tap(1);
    await page.waitForFunction(() => window.playedSounds.length >= 2);
    if (mp3Fallback) assert.ok(await page.evaluate(() => window.mp3Requests >= 8), 'MP3 fallback was not exercised');
    await page.locator('#sound').click();
    const mutedCount = await page.evaluate(() => window.playedSounds.length);
    await tap(1);await page.waitForTimeout(550);
    assert.equal(await page.evaluate(() => window.playedSounds.length), mutedCount, 'Mute played a delayed cue');
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false');
    await page.locator('#sound').click();
    await page.waitForFunction(before => window.playedSounds.length > before, mutedCount);
    // Reload the installed shell without a network and play a fresh decoded sound.
    await context.setOffline(true);await page.reload();
    await page.locator('#sound').click();await page.locator('#sound').click();
    await page.waitForFunction(() => window.playedSounds.length > 0);
    assert.deepEqual(errors, []);
    report.push({mp3Fallback, decodedFiles: decoded.length, gesturePlayback: true, mute: true, offlinePlayback: true, errors});
    await context.close();
  }
  await mkdir('test-results', {recursive: true});
  await writeFile('test-results/audio-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
