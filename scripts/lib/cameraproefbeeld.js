'use strict';
const assert = require('node:assert/strict');

// Deze functies lezen echte canvas-/videopixels, zonder de product-DOM of
// renderuitkomst te vervangen. De browser gebruikt synthetische camerahardware.
const monster = c => {
  const klein = document.createElement('canvas'); klein.width = 16; klein.height = 16;
  const g = klein.getContext('2d'); g.drawImage(c, 0, 0, 16, 16);
  return Array.from(g.getImageData(0, 0, 16, 16).data).filter((v, i) => i % 4 !== 3);
};
function vergelijk(origineel, pixels, uitleg) {
  assert.equal(pixels.length, origineel.length);
  const afwijking = pixels.reduce((som, v, i) => som + Math.abs(v - origineel[i]), 0) / pixels.length;
  assert.ok(afwijking < 15, uitleg + ': gemiddelde JPEG-afwijking ' + afwijking);
}
async function decodeer(p, bytes) {
  return p.evaluate(async base64 => {
    const data = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const foto = await createImageBitmap(new Blob([data], { type: 'image/jpeg' }));
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    const g = c.getContext('2d'); g.drawImage(foto, 0, 0, 16, 16);
    const pixels = Array.from(g.getImageData(0, 0, 16, 16).data).filter((v, i) => i % 4 !== 3);
    const uit = { maat: [foto.width, foto.height], pixels }; foto.close(); return uit;
  }, bytes.toString('base64'));
}
async function bewegendBeeld(p) {
  await p.waitForFunction(() => {
    const v = document.querySelector('#beeld');
    return v.videoWidth > 0 && v.readyState >= 2 && !document.querySelector('#sluiter').disabled;
  });
  const frames = await p.locator('#beeld').evaluate(v => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('geen twee opeenvolgende cameraframes')), 10000);
    v.requestVideoFrameCallback((t, a) => v.requestVideoFrameCallback((t2, b) => {
      clearTimeout(timer); resolve([a.presentedFrames, b.presentedFrames, a.mediaTime, b.mediaTime]);
    }));
  }));
  assert.ok(frames[1] > frames[0] && frames[3] > frames[2], 'bewegend camerabeeld');
  return p.locator('#beeld').evaluate(v => [v.videoWidth, v.videoHeight]);
}
function volgNetwerk(context, basis, verzonden) {
  context.on('request', r => {
    const u = new URL(r.url());
    if (!['http:', 'https:'].includes(u.protocol)) return;
    if (u.origin !== new URL(basis()).origin) { verzonden.push('externe bestemming ' + u.origin); return; }
    if (!['GET', 'HEAD'].includes(r.method())) {
      // Bestaande taalcataloguslezing, geen media-upload of inhoudsvrijstelling.
      const taal = r.method() === 'POST' && u.pathname === '/api/talen' && !u.search && r.postData() === '{}';
      if (!taal) verzonden.push(r.method() + ' ' + u.pathname);
    }
  });
  const volgPagina = p => p.on('websocket', ws => ws.on('framesent', () => verzonden.push('WebSocket-verzending')));
  context.pages().forEach(volgPagina);
  context.on('page', volgPagina);
}
module.exports = { monster, vergelijk, decodeer, bewegendBeeld, volgNetwerk };
