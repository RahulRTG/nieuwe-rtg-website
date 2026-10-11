/* ============================================================================
   EEN CLIENT DIE OPHANGT IS GEEN SERVERFOUT (server/opzet/afsluiters.js)

   WebKit verbreekt de verbinding als het weg-navigeert terwijl een POST nog
   loopt. Node geeft dan Error('aborted') aan de bodylezer, en de laatste
   foutafhandelaar maakte daar een 500 met de vlag serverfout van. De strenge
   poort in test/helper.js liet runs daarop zakken (twee keer op PR #520, met
   een ander eindpunt elke keer): een race, geen fout van de server.

   Deze toets doet precies dat: een POST met een aangekondigde body van 4 kB,
   halverwege dicht. Er mag geen serverfout gelogd worden, wel een regel met
   clientAfgebroken. Mutatie: haal in afsluiters.js de tak `clientWeg` weg, en
   toets 1 zakt (en de strenge poort erbij).
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const h = require('./helper');

let srv;
const regels = [];
test.before(async () => {
  srv = await h.startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  srv.child.stderr.on('data', (b) => regels.push(...b.toString().split('\n')));
  srv.child.stdout && srv.child.stdout.on('data', (b) => regels.push(...b.toString().split('\n')));
});
test.after(async () => { if (srv) await h.stop(srv.child); });

function afgebrokenPost(pad) {
  const u = new URL(srv.base);
  return new Promise((klaar) => {
    const s = net.connect(Number(u.port), u.hostname, () => {
      s.write('POST ' + pad + ' HTTP/1.1\r\nHost: ' + u.host + '\r\nContent-Type: application/json\r\n' +
        'Content-Length: 4096\r\nConnection: close\r\n\r\n{"half":"');
      setTimeout(() => { s.destroy(); klaar(); }, 150);
    });
    s.on('error', () => klaar());
  });
}
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

test('1. een POST die halverwege wordt afgebroken, logt geen serverfout maar clientAfgebroken', async () => {
  const voor = regels.length;
  await afgebrokenPost('/api/onboarding/status');
  await afgebrokenPost('/api/member/connections');
  let nieuw = [];
  for (let i = 0; i < 40; i++) {
    nieuw = regels.slice(voor).filter((r) => /"fout":"aborted"/.test(r));
    if (nieuw.length >= 2) break;
    await wacht(50);
  }
  assert.ok(nieuw.length >= 1, 'de afbreking werd niet eens gelogd; de toets meet niets');
  for (const r of nieuw) {
    assert.doesNotMatch(r, /"serverfout":true/, 'een opgehangen client is geen serverfout: ' + r.slice(0, 200));
    assert.match(r, /"clientAfgebroken":true/);
    assert.match(r, /"status":499/);
  }
});

test('2. een gewone fout met status blijft wat hij was: de server antwoordt nog', async () => {
  const r = await fetch(srv.base + '/api/onboarding/status', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: '{kapot' });
  assert.equal(r.status, 400, 'kapotte JSON is een invoerfout');
  const gezond = await fetch(srv.base + '/api/health');
  assert.ok(gezond.status < 500, 'na de afbrekingen draait de server gewoon door');
});
