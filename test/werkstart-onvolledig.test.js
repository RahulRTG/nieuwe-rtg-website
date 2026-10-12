/* HET STARTSCHERM VAN WERK MET EEN ONVOLLEDIG ANTWOORD (public/apps/werk/start.js).

   RTGWerk.api maakt van een antwoord dat geen JSON is een leeg lijf `{}`: een
   502 met HTML, een verbroken verbinding, of -- in WebKit, de motor van Safari
   -- een verzoek dat wordt afgebroken omdat de pagina al verder navigeert.
   start() las daarna zonder controle `d.wie.naam` en gooide een TypeError. De
   schermtoets test/mobile-content.e2e.js zag precies die fout in WebKit
   ("undefined is not an object (evaluating 'd.wie.naam')", run 38320436958);
   Chromium wijst zo'n afgebroken fetch af en kwam er nooit. Een onvolledig
   antwoord hoort een melding te geven, geen fout.

   Draai los: node --test test/werkstart-onvolledig.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const BRON = fs.readFileSync(path.join(__dirname, '../public/apps/werk/start.js'), 'utf8');

function scherm(antwoord) {
  const meldingen = [];
  const elementen = {};
  const document = { getElementById: id => (elementen[id] = elementen[id] || { textContent: '', innerHTML: '' }) };
  const window = {
    RTGWerk: {
      api: () => Promise.resolve(antwoord),
      meld: t => meldingen.push(t),
      esc: s => String(s), rij: (a, b) => a + b
    }
  };
  vm.runInNewContext(BRON, { window, document, console });
  return { start: window.RTGWerkStart, meldingen, elementen };
}

async function zonderOnafgevangen(werk) {
  const fouten = [];
  const vang = e => fouten.push(e);
  process.on('unhandledRejection', vang);
  try {
    await werk();
    await new Promise(r => setTimeout(r, 20));
  } finally { process.off('unhandledRejection', vang); }
  return fouten;
}

test('een leeg lijf (geen JSON, of een afgebroken verzoek) geeft een melding en geen TypeError', async () => {
  for (const antwoord of [{ status: 0, body: {} }, { status: 502, body: {} }, { status: 200, body: { werkruimte: { naam: 'x', code: 'y' } } }]) {
    const s = scherm(antwoord);
    const fouten = await zonderOnafgevangen(() => s.start.laad());
    assert.deepEqual(fouten.map(String), [], JSON.stringify(antwoord));
    assert.equal(s.meldingen.length >= 1, true, 'het scherm zegt dat het niet laadde: ' + JSON.stringify(antwoord));
  }
});

test('een volledig antwoord vult het scherm zoals altijd', async () => {
  const s = scherm({ status: 200, body: { wie: { naam: 'Mira', functie: 'Bar', rollen: ['team'] },
    werkruimte: { naam: 'De Zaak', code: 'WR1' }, blokken: {} } });
  const fouten = await zonderOnafgevangen(() => s.start.laad());
  assert.deepEqual(fouten.map(String), []);
  assert.equal(s.elementen.wWie.textContent, 'Mira · Bar · team');
  assert.equal(s.elementen.wRuimte.textContent, 'De Zaak (WR1)');
  assert.deepEqual(s.meldingen, []);
});
