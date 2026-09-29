/* opzet/aanbouw.js en aanbouw2.js haalden bewerkCollectie uit `kern`, en die
   draagt hem niet. Vijf modules (samen, samenrtf, rtgai, rtgid, vracht) kregen
   daardoor undefined en namen stil hun niet-atomaire terugval -- ook in
   productie. Deze toets monteert beide aanbouwen met de vijf fabrieken
   vervangen door een vanger, en eist dat elk van hen een echte
   collectietransactie meekrijgt: precies die van de opslag.

   Draai los: node --test test/aanbouw-collectie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const KERN = path.join(__dirname, '..', 'server', 'kern');
// het onderwerp: de twee aanbouwen (de opslag zelf is hier het ijkpunt, niet het onderwerp)
const AANBOUW = [require('../server/opzet/aanbouw'), require('../server/opzet/aanbouw2')];
const OPSLAG = path.join(__dirname, '..', 'server', 'db');
// een los onderdeel dat alles slikt: de aanbouw monteert veel meer dan deze toets nodig heeft
const stub = () => new Proxy(function () {}, {
  get: (t, k) => k === 'data' ? {} : k === Symbol.toPrimitive ? () => '' : stub(),
  apply: () => stub()
});

test('elke collectiemodule uit de aanbouw krijgt de collectietransactie van de opslag', () => {
  const echt = require(OPSLAG).bewerkCollectie;
  assert.equal(typeof echt, 'function');
  const gezien = {};
  const vang = (mod, vorm) => {
    const p = require.resolve(path.join(KERN, mod));
    const oud = require.cache[p];
    require.cache[p] = { id: p, filename: p, loaded: true,
      exports: vorm(arg => { gezien[mod] = arg.bewerkCollectie; return {}; }) };
    return () => { if (oud) require.cache[p] = oud; else delete require.cache[p]; };
  };
  const herstel = [vang('rtgid', f => ({ maakRtgid: f })), vang('vracht', f => f),
    vang('samen', f => f), vang('samenrtf', f => f), vang('rtgai', f => f)];
  try {
    const kern = {};
    const k = new Proxy(kern, { get: (t, p) => p in t ? t[p] : stub(), set: (t, p, v) => { t[p] = v; return true; } });
    for (const bouw of AANBOUW) {
      try { bouw(k, () => stub()); } catch { /* de montage verderop is niet het onderwerp */ }
    }
  } finally { herstel.forEach(h => h()); }
  for (const mod of ['samen', 'samenrtf', 'rtgai', 'rtgid', 'vracht'])
    assert.equal(gezien[mod], echt, mod + ' kreeg niet de collectietransactie van de opslag');
});
