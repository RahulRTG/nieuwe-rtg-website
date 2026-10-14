/* DE STILLE SENSOR (server/kern/command/sensorstilte.js, WEERBAARHEID.md
   par. 9a stap 2): een wachter die stopt, mag niet klinken als een wachter die
   niets ziet.

   Wat hier niet mag sneuvelen:
   1. een sensor die binnen zijn venster stempelt, is levend;
   2. een sensor die te lang niet stempelt, is stil -- en een sensor die nooit
      gestart is ook, want een weggehaalde wachter mag niet uit de lijst vallen;
   3. "uit" (bewust niet gestart) is geen stilte en ook geen levend;
   4. een tikker die elke ronde omvalt, telt zijn fouten en blijft stil;
   5. verkeer dat de meting telt en het schild niet ziet, is een stil schild;
      een lezing van het bord schuift dat vergelijkpunt niet op;
   6. een melding zonder journaal is verloren, en dat is stil;
   7. in de schaduw meldt het alarm niets, ook niet als er iets stil is; met
      RTG_SENSORSTILTE_ACTIEF=1 wel;
   8. de meetroute toont de bewaking, achter dezelfde poort.

   Draai los: node --test test/sensorstilte.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const stilte = require('../server/kern/command/sensorstilte');

function metKlok(t0) {
  const echt = Date.now;
  let nu = t0;
  Date.now = () => nu;
  return { zet: (ms) => { nu = t0 + ms; }, terug: () => { Date.now = echt; } };
}
const standVan = (naam, rijen) => (rijen || stilte.oordeel()).find(r => r.naam === naam);

function allesLevend() {
  for (const [naam, v] of Object.entries(stilte.VERWACHT)) { stilte.gestart(naam, v.periodeMs); stilte.ronde(naam); }
}

test('1. een sensor die binnen zijn venster stempelt, is levend', () => {
  stilte._wis();
  allesLevend();
  for (const naam of Object.keys(stilte.VERWACHT)) assert.equal(standVan(naam).stand, 'levend', naam);
  assert.equal(stilte.bevinding(), null);
});

test('2. te lang geen ronde is stil, en een nooit gestarte sensor ook', () => {
  stilte._wis();
  const klok = metKlok(1e12);
  try {
    allesLevend();
    klok.zet(stilte.VERWACHT.alarm.periodeMs * stilte.VENSTERS + 1000);
    for (const naam of Object.keys(stilte.VERWACHT)) if (naam !== 'alarm') stilte.ronde(naam);
    assert.equal(standVan('alarm').stand, 'stil');
    assert.match(stilte.bevinding(), /alarm: laatste geslaagde ronde/);
  } finally { klok.terug(); }

  stilte._wis();
  const rijen = stilte.oordeel();
  for (const naam of Object.keys(stilte.VERWACHT)) {
    assert.equal(standVan(naam, rijen).stand, 'stil', naam + ': een weggehaalde wachter valt niet uit de lijst');
  }
});

test('3. "uit" is geen stilte en geen levend', () => {
  stilte._wis();
  allesLevend();
  stilte.aangemeld('canary', { uit: true });
  assert.equal(standVan('canary').stand, 'uit');
  assert.equal(stilte.bevinding(), null, 'een bewust uitgezette tikker is geen alarm');
});

test('4. een tikker die elke ronde omvalt, telt zijn fouten en is stil', async () => {
  stilte._wis();
  const vorig = process.env.RTG_TIKKERS_UIT;
  delete process.env.RTG_TIKKERS_UIT;
  const { maakTikker } = require('../server/kern/command/tikker');
  let t;
  try {
    t = maakTikker(() => { throw new Error('de laag eronder viel om'); }, 5, 'alarm')();
    await new Promise(r => setTimeout(r, 40));
    const s = standVan('alarm');
    assert.ok(s.fouten > 0, 'de fouten worden geteld in plaats van geslikt');
    assert.match(s.laatsteFout.reden, /viel om/);
    const k2 = metKlok(Date.now() + 1000);
    try { assert.equal(standVan('alarm').stand, 'stil', 'fouten zonder geslaagde ronde, buiten het venster'); }
    finally { k2.terug(); }
  } finally {
    if (t) clearInterval(t);
    if (vorig === undefined) delete process.env.RTG_TIKKERS_UIT; else process.env.RTG_TIKKERS_UIT = vorig;
  }
});

test('4b. met de tikkers uit meldt een benoemde tikker zich als "uit"', () => {
  stilte._wis();
  const vorig = process.env.RTG_TIKKERS_UIT;
  process.env.RTG_TIKKERS_UIT = '1';
  try {
    const { maakTikker } = require('../server/kern/command/tikker');
    assert.equal(maakTikker(() => {}, 1000, 'alarm')(), null);
    assert.equal(standVan('alarm').stand, 'uit');
  } finally { if (vorig === undefined) delete process.env.RTG_TIKKERS_UIT; else process.env.RTG_TIKKERS_UIT = vorig; }
});

test('5. verkeer zonder schild is een stil schild; het bord schuift niets op', () => {
  stilte._wis();
  allesLevend();
  let schild = 0, meting = 0;
  stilte.koppelSchild({ schildVerzoeken: () => schild, metingVerzoeken: () => meting });
  stilte.bevinding();                         // eerste weging: het nulpunt
  meting += stilte.SCHILD_DREMPEL + 5; schild += stilte.SCHILD_DREMPEL + 5;
  assert.equal(stilte.bevinding(), null, 'schild en meting lopen samen op');

  meting += stilte.SCHILD_DREMPEL + 5;        // het schild hangt niet meer in de keten
  for (let i = 0; i < 5; i++) stilte.stand(); // het bord leest vaak, en eet het verschil niet op
  assert.match(stilte.bevinding(), /schild: \d+ verzoeken in de meting/);
  assert.deepEqual(stilte.stand().stil, ['schild'], 'het bord toont het laatste oordeel');

  meting += 3;                                // weinig verkeer is geen bewijs
  assert.equal(stilte.bevinding(), null);
});

test('6. een melding zonder journaal is verloren, en dat is stil', () => {
  stilte._wis();
  allesLevend();
  stilte.verloren('schild');
  assert.match(stilte.bevinding(), /melding:schild: 1 meldingen gingen verloren/);
});

test('7. in de schaduw meldt het alarm niets; actief wel', () => {
  stilte._wis();                              // niets gestart: alles stil
  const { voegAanvullendeAlarmcontrolesToe } = require('../server/kern/command/alarm-aanvullend');
  const leeg = { stand: () => ({ capabilities: [] }) };
  const draai = () => {
    const uit = [];
    voegAanvullendeAlarmcontrolesToe((id, naam, ernst, doe) => { const r = doe(); if (r) uit.push({ id, ernst, r }); },
      { slo: leeg, kwaliteit: null, d: { defectenDrempel: 25 } });
    return uit.filter(x => x.id === 'sensor-stil');
  };
  const vorig = process.env.RTG_SENSORSTILTE_ACTIEF;
  try {
    delete process.env.RTG_SENSORSTILTE_ACTIEF;
    assert.deepEqual(draai(), [], 'schaduw: berekend, niet gemeld');
    assert.ok(stilte.stand().stil.length > 0, 'maar wel zichtbaar');
    process.env.RTG_SENSORSTILTE_ACTIEF = '1';
    const a = draai();
    assert.equal(a.length, 1);
    assert.equal(a[0].ernst, 'hoog');
  } finally { if (vorig === undefined) delete process.env.RTG_SENSORSTILTE_ACTIEF; else process.env.RTG_SENSORSTILTE_ACTIEF = vorig; }
});

test('8. de meetroute toont de bewaking, achter dezelfde poort', async () => {
  const { startServer, stop } = require('./helper');
  const TOKEN = 'meet-token-dat-lang-genoeg-is';
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-stilte-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_METRICS_TOKEN: TOKEN } });
  try {
    assert.equal((await fetch(srv.base + '/api/metrics/kort')).status, 404, 'zonder token dicht');
    const r = await fetch(srv.base + '/api/metrics/kort', { headers: { Authorization: 'Bearer ' + TOKEN } });
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.ok(d.bewaking && Array.isArray(d.bewaking.stil) && Array.isArray(d.bewaking.sensoren));
    assert.equal(d.bewaking.actief, false, 'standaard in de schaduw');
    for (const naam of Object.keys(stilte.VERWACHT)) {
      assert.ok(d.bewaking.sensoren.some(s => s.naam === naam), naam + ' staat in de bewaking');
    }
  } finally {
    await stop(srv);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
