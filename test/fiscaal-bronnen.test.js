/* HET BRONNENREGISTER: waar komen de regels vandaan, en wat mag een bron zelf.

   Zes beweringen, en de tweede is waar het om draait.

   1. ELKE BRON DRAAGT ZIJN GEZAG, en een url staat nooit in de code.
   2. EEN TARIEVENBRON WIJST GEEN CATEGORIEEN TOE. Hij levert tarieven per
      SOORT (standard/reduced); welke categorie welk tarief krijgt, verschilt
      per land en staat in geen enkele bron. Het standaardtarief gaat dus
      automatisch mee; een verschoven verlaagd tarief wordt GESIGNALEERD.
   3. EEN ONBEREIKBARE BRON ZET NIETS STIL -- de regels blijven staan.
   4. WAT EEN BRON LEVERT, IS NOOIT GOEDGEKEURD: het komt binnen als
      ongecontroleerd, tot een mens het aanmerkt.
   5. DE KEURING HOUDT ONZIN TEGEN, ook van een bron die verder deugt.
   6. SIGNALEN WORDEN BEWAARD, want werk dat alleen in een logregel staat,
      gebeurt niet.

   Draai los: node --experimental-sqlite --test test/fiscaal-bronnen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakBronnen, BRONNEN } = require('../server/kern/fiscaal/bronnen');
const { vertaal } = require('../server/kern/fiscaal/bronnen/tedb');
const { diep } = require('../server/kern/fiscaal/jaargangen-tijdlijn');
const { LANDEN, FISCAAL_PEILJAAR } = require('../server/kern/fiscaal');

const SCHOON = diep(LANDEN);
function herstel() { for (const cc of Object.keys(SCHOON)) LANDEN[cc] = diep(SCHOON[cc]); }
test.afterEach(() => { herstel(); delete process.env.FISCAAL_BRON_TEDB; });

function opzet(antwoord) {
  const db = { data: {} };
  const fetchImpl = async () => antwoord instanceof Error
    ? Promise.reject(antwoord)
    : { ok: true, status: 200, json: async () => antwoord };
  const { bronnen } = maakBronnen({ db, save: () => {}, LANDEN, fetchImpl,
    nu: () => '2026-08-20T10:00:00.000Z' });
  const { regelwacht } = require('../server/kern/fiscaal/regelwacht')({ db, save: () => {},
    LANDEN, peiljaar: FISCAAL_PEILJAAR, bronnen });
  return { db, bronnen, regelwacht };
}

test('elke bron draagt zijn gezag, en de url staat niet in de code', () => {
  const k = opzet({});
  const st = k.bronnen.status();
  assert.ok(st.length >= 2);
  const tedb = st.find(b => b.sleutel === 'tedb');
  assert.equal(tedb.gezag, 'officieel');
  assert.equal(st.find(b => b.sleutel === 'spiegel').gezag, 'afgeleid');
  for (const b of st) {
    assert.equal(b.geconfigureerd, false, b.sleutel + ' is niet geconfigureerd zolang de omgeving niets zegt');
    assert.ok(b.env && /^FISCAAL_BRON_/.test(b.env), 'het adres komt uit de omgeving: ' + b.env);
  }
  const bron = JSON.stringify(BRONNEN);
  assert.ok(!/https?:\/\//.test(bron), 'er staat geen url in het register');
});

test('een tarievenbron wijst geen categorieen toe', () => {
  /* NL: standaard 21 -> 22 (eenduidig), verlaagd 9 -> 10 (een toewijzing).
     DE blijft gelijk en hoort dus niets op te leveren. */
  const uit = vertaal({ landen: { NL: { standard: 22, reduced: [10] }, DE: { standard: 19, reduced: [7] } } }, LANDEN);

  assert.deepEqual(uit.landen, { NL: { tarieven: { standaard: 22 } } },
    'alleen het standaardtarief, en alleen waar het verandert');
  assert.ok(!uit.landen.DE, 'een land dat niet verandert levert niets op');

  const cats = uit.signalen.filter(s => s.land === 'NL').map(s => s.categorie).sort();
  assert.deepEqual(cats, ['eten', 'logies', 'vervoer'], 'de categorieen die op het oude verlaagde tarief stonden');
  assert.equal(uit.signalen[0].onsTarief, 9);
  assert.deepEqual(uit.signalen[0].bronTarieven, [10]);
  assert.match(uit.signalen[0].let, /toewijzing die een mens maakt/i);
  /* En er is NIETS toegewezen: eten staat nog gewoon op 9 tot een mens beslist. */
  assert.equal(LANDEN.NL.tarieven.eten, 9);
});

test('een onbereikbare bron zet niets stil', async () => {
  process.env.FISCAAL_BRON_TEDB = 'https://bron.test/tarieven.json';
  const k = opzet(new Error('kapot'));
  const voor = LANDEN.NL.tarieven.standaard;
  const r = await k.regelwacht.check();
  assert.equal(r.ok, true, 'de controle valt niet om');
  assert.equal(LANDEN.NL.tarieven.standaard, voor, 'de regels staan er nog');
  assert.match(k.bronnen.status().find(b => b.sleutel === 'tedb').laatsteUitslag, /niet bereikbaar/i);
});

test('wat een bron levert, is nooit goedgekeurd', async () => {
  process.env.FISCAAL_BRON_TEDB = 'https://bron.test/tarieven.json';
  const k = opzet({ versie: 'tedb-2026-08', landen: { NL: { standard: 22, reduced: [10] } } });
  const r = await k.regelwacht.check();
  assert.ok(r.bronnen.some(b => b.bron === 'tedb' && b.ok));
  assert.equal(LANDEN.NL.tarieven.standaard, 22, 'het standaardtarief is doorgevoerd');

  const g = k.regelwacht.jaargangen.geschiedenis('NL');
  assert.equal(g.length, 1);
  assert.equal(g[0].stand, 'ongecontroleerd', 'automatisch binnenhalen is niet ongezien in gebruik nemen');
  assert.equal(g[0].bron.gezag, 'officieel', 'en het gezag reist mee naar de jaargang');
  assert.equal(g[0].vorige.tarieven.standaard, 21);
});

test('de keuring houdt onzin tegen, ook van een bron die verder deugt', async () => {
  process.env.FISCAAL_BRON_TEDB = 'https://bron.test/tarieven.json';
  const k = opzet({ landen: { NL: { standard: 300 }, XX: { standard: 21 } } });
  const voor = LANDEN.NL.tarieven.standaard;
  await k.regelwacht.check();
  assert.equal(LANDEN.NL.tarieven.standaard, voor, 'een tarief van 300% komt er niet in');
  assert.equal(k.regelwacht.jaargangen.geschiedenis('NL').length, 0, 'en levert dus ook geen jaargang op');
});

test('signalen worden bewaard', async () => {
  process.env.FISCAAL_BRON_TEDB = 'https://bron.test/tarieven.json';
  const k = opzet({ landen: { NL: { standard: 21, reduced: [10] } } });
  await k.regelwacht.check();

  const sig = k.bronnen.signalen();
  assert.ok(sig.length >= 3, 'de signalen staan er: ' + sig.length);
  assert.equal(sig[0].bron, 'tedb', 'met de bron erbij');
  // en de status van de Regelwacht meldt ze door, zodat een scherm ze kan tonen
  assert.ok(k.regelwacht.status().signalen.length >= 3);
  k.bronnen.ruimSignalenOp('tedb');
  assert.equal(k.bronnen.signalen().length, 0, 'en ze zijn af te vinken als ze zijn afgehandeld');
});
