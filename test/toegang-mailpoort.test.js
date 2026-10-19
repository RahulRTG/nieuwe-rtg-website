/* DE BUITENPOORTEN VOOR POST VRAGEN EEN GEDEELD GEHEIM
   (eigenaarsbesluit 19 oktober 2026, AGENTS.md: uitzondering 6, machine-tot-
   machineverkeer met een eigen handtekening).

   /api/werkmail/bezorg en /api/mail/binnen namen post aan van iedereen op het
   open internet, met alleen een rem per minuut. Het is machinepost en geen
   lid, dus de deur vraagt geen account maar hetzelfde soort bewijs als de
   webhooks: het geheim uit RTG_MAILPOORT_GEHEIM (minstens 32 tekens) in de kop
   x-rtg-mailpoort. Zonder ingericht geheim blijft de deur dicht, en dat
   antwoord verraadt niet HOE hij is ingericht (dezelfde les als de SES-poort). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const { GEHEIM, KOP } = require('./mailpoort');

const BERICHT = 'From: a@buiten.nl\r\nTo: niemand@rtg.test\r\nSubject: proef\r\n\r\nhallo';
const poorten = [['/api/mail/binnen', { bericht: BERICHT }],
  ['/api/werkmail/bezorg', { naar: 'niemand@rtg.test', van: 'a@buiten.nl', onderwerp: 'proef', tekst: 'hallo' }]];

async function klop(base, pad, lijf, kop) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, kop ? { [KOP]: kop } : {}), body: JSON.stringify(lijf) });
  return r.status;
}

test('met een ingericht geheim: zonder of met een fout geheim 401, met het juiste geheim door de poort', async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_MAILPOORT_GEHEIM: GEHEIM } });
  try {
    for (const [pad, lijf] of poorten) {
      assert.equal(await klop(srv.base, pad, lijf), 401, pad + ' zonder geheim');
      assert.equal(await klop(srv.base, pad, lijf, 'x'.repeat(GEHEIM.length)), 401, pad + ' met een fout geheim');
      assert.notEqual(await klop(srv.base, pad, lijf, GEHEIM), 401, pad + ' met het juiste geheim komt langs de poort');
    }
  } finally { await stop(srv); }
});

test('zonder ingericht geheim blijft de poort dicht, ook voor wie iets meestuurt', async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_MAILPOORT_GEHEIM: '' } });
  try {
    for (const [pad, lijf] of poorten) {
      assert.equal(await klop(srv.base, pad, lijf, GEHEIM), 401, pad + ' zonder ingericht geheim');
    }
  } finally { await stop(srv); }
});
