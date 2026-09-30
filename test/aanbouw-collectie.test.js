/* opzet/aanbouw.js en aanbouw2.js haalden bewerkCollectie uit `kern`, en die
   draagt hem niet. Vijf modules (samen, samenrtf, rtgai, rtgid, vracht) kregen
   daardoor undefined en namen stil hun niet-atomaire terugval -- ook in
   productie. Deze toets monteert beide aanbouwen met de vijf fabrieken
   vervangen door een vanger, en eist dat elk van hen een echte
   collectietransactie meekrijgt: precies die van de opslag. De tweede toets
   houdt de overige beslissingen in dezelfde bedrading vast (achtergrond-
   mutaties op PostgreSQL, het kantoorsein, de betaalpoort).

   Draai los: node --test test/aanbouw-collectie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const KERN = path.join(__dirname, '..', 'server', 'kern');
// het onderwerp: de twee aanbouwen (de opslag zelf is hier het ijkpunt, niet het onderwerp)
const AANBOUW = [require('../server/opzet/aanbouw'), require('../server/opzet/aanbouw2')];
const OPSLAG = path.join(__dirname, '..', 'server', 'db');
// een los onderdeel dat alles slikt: de aanbouw monteert veel meer dan deze toets nodig heeft
const stub = () => new Proxy(function () {}, {
  get: (t, k) => k === Symbol.toPrimitive ? () => '' : stub(),
  apply: () => stub()
});

/* Monteer beide aanbouwen met de genoemde kernfabrieken vervangen door een
   vanger; geeft per fabriek het argument terug waarmee hij werd aangeroepen. */
function monteer(kernVelden) {
  const gezien = {};
  const vang = (mod, vorm) => {
    const p = require.resolve(path.join(KERN, mod));
    const oud = require.cache[p];
    require.cache[p] = { id: p, filename: p, loaded: true,
      exports: vorm(arg => { gezien[mod] = arg; return {}; }) };
    return () => { if (oud) require.cache[p] = oud; else delete require.cache[p]; };
  };
  const herstel = [vang('rtgid', f => ({ maakRtgid: f })), vang('vracht', f => f),
    vang('samen', f => f), vang('samenrtf', f => f), vang('rtgai', f => f),
    vang('zelfzorg', f => a => { f(a); return { zelfzorg: { autoStart() {} } }; }),
    vang('command', f => ({ maakCommand: a => { f(a); return {}; } })),
    vang('link', f => a => { f(a); return { linkHandeling() {} }; }),
    vang('pay/vraagcode', f => f)];
  let kern;
  try {
    kern = Object.assign({ DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-aanbouw-')) }, kernVelden);
    const k = new Proxy(kern, { get: (t, p) => p in t ? t[p] : stub(), set: (t, p, v) => { t[p] = v; return true; } });
    for (const bouw of AANBOUW) {
      try { bouw(k, () => stub()); } catch (e) { if (process.env.DBG) console.log("MONTAGE", e.stack.split("\n").slice(0,4).join(" / ")); }
    }
  } finally {
    herstel.forEach(h => h());
    if (kern) fs.rmSync(kern.DATA_DIR, { recursive: true, force: true });
  }
  return gezien;
}

test('elke collectiemodule uit de aanbouw krijgt de collectietransactie van de opslag', () => {
  const echt = require(OPSLAG).bewerkCollectie;
  assert.equal(typeof echt, 'function');
  const gezien = monteer({});
  for (const mod of ['samen', 'samenrtf', 'rtgai', 'rtgid', 'vracht'])
    assert.equal(gezien[mod] && gezien[mod].bewerkCollectie, echt, mod + ' kreeg niet de collectietransactie van de opslag');
});

test('de rest van de bedrading: achtergrondmutaties, kantoorsein en betaalpoort', () => {
  // op PostgreSQL muteert zelfzorg niet op de achtergrond, op de lokale opslag wel
  assert.equal(monteer({ STORE: 'postgres' }).zelfzorg.achtergrondMutaties, false);
  assert.equal(monteer({ STORE: 'sqlite' }).zelfzorg.achtergrondMutaties, true);
  // het kantoorsein gaat alleen naar een kantoorkanaal dat er is
  const seinen = [];
  const metSein = monteer({ sseToOffice: (ev, d) => seinen.push([ev, d]) });
  metSein.command.sseToOffice('puls', 1);
  assert.deepEqual(seinen, [['puls', 1]]);
  assert.equal(monteer({ sseToOffice: undefined }).command.sseToOffice('puls', 1), undefined);
  // de betaalcode krijgt de poort van de onboarding, niet de onboarding zelf
  const payGate = () => true;
  assert.equal(monteer({ onboarding: { payGate } })['pay/vraagcode'].payGate, payGate);
  assert.equal(monteer({ onboarding: undefined })['pay/vraagcode'].payGate, undefined);
});
