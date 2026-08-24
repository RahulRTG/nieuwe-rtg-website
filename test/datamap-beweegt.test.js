/* VOLGT DE OPSLAG DE DATAMAP, BINNEN EEN EN HETZELFDE PROCES?

   Dit is de toets bij de reparatie waar fase C op uitliep. De datamap stond in
   server/db/opslag.js als `const DATA_DIR = process.env.RTG_DATA_DIR || ...`, en
   die ene regel is duurder dan hij eruitziet: 647 toetsbestanden starten een
   eigen server EN zetten een eigen RTG_DATA_DIR. Dat zijn precies de 647
   serverstarts waar dit programma om begon. Een toets start geen eigen server
   omdat hij bang is voor een singleton -- hij start er een omdat hij een eigen
   SCHIJF wil, en de schijf lag vast zodra de modules laadden.

   Nu wordt de map gelezen wanneer hij nodig is. Deze toets laat zien dat dat
   ECHT zo is: een proces, twee mappen, en de bestanden komen op de goede plek
   terecht. Zonder deze proef zou "hij is nu instelbaar" een bewering zijn.

   Wat hier bewust ook in staat is wat er NOG NIET meebeweegt (STORE en een
   reeds geopende SQLite-greep). Een toets die alleen de goede helft laat zien
   maakt van een halve reparatie een hele.

   Draai los: node --experimental-sqlite --test test/datamap-beweegt.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const versMap = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-datamap-'));

function metTweeMappen(doe) {
  const A = versMap(), B = versMap();
  const oud = { d: process.env.RTG_DATA_DIR, s: process.env.RTG_STORE };
  process.env.RTG_STORE = 'geheugen';
  for (const k of Object.keys(require.cache)) if (k.startsWith(path.join(WORTEL, 'server'))) delete require.cache[k];
  try { return doe(A, B); } finally {
    for (const [k, v] of [['RTG_DATA_DIR', oud.d], ['RTG_STORE', oud.s]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    fs.rmSync(A, { recursive: true, force: true });
    fs.rmSync(B, { recursive: true, force: true });
  }
}

test('opslag.DATA_DIR en DB_FILE lezen de map van dit moment, niet die van het laadmoment', () => {
  metTweeMappen((A, B) => {
    process.env.RTG_DATA_DIR = A;
    const opslag = require(path.join(WORTEL, 'server/db/opslag'));
    assert.equal(opslag.DATA_DIR, A, 'de map bij het laden');
    assert.equal(opslag.DB_FILE, path.join(A, 'db.json'));

    process.env.RTG_DATA_DIR = B;
    assert.equal(opslag.DATA_DIR, B, 'na het omzetten hoort dezelfde module de nieuwe map te noemen');
    assert.equal(opslag.DB_FILE, path.join(B, 'db.json'));
    assert.equal(opslag.dataMap(), B, 'en de functie zegt hetzelfde als de eigenschap');
  });
});

/* DE ECHTE PROEF: er komen ook echt bestanden op de goede plek terecht. Een
   pad dat meebeweegt maar waar niemand naar schrijft bewijst niets. */
test('een snapshot landt in de map die op dat moment is ingesteld', () => {
  metTweeMappen((A, B) => {
    process.env.RTG_DATA_DIR = A;
    const opslag = require(path.join(WORTEL, 'server/db/opslag'));
    /* schrijfLokaleSnapshot() neemt geen argument: hij schrijft de datastore weg.
       Dat is geen detail voor deze toets -- als de map niet meebewoog zouden
       allebei de schrijfacties op DEZELFDE plek landen en zou de tweede de
       eerste overschrijven. Precies dat mag niet meer kunnen. */
    const state = require(path.join(WORTEL, 'server/db/state'));
    state.db.data = { waar: 'in A' };
    opslag.schrijfLokaleSnapshot();
    assert.ok(fs.existsSync(path.join(A, 'db.json')), 'de eerste snapshot hoort in A te staan');
    assert.equal(fs.existsSync(path.join(B, 'db.json')), false, 'en niet in B');

    process.env.RTG_DATA_DIR = B;
    state.db.data = { waar: 'in B' };
    opslag.schrijfLokaleSnapshot();
    assert.ok(fs.existsSync(path.join(B, 'db.json')), 'de tweede snapshot hoort in B te staan');

    /* En A is niet overschreven: de twee mappen staan echt los van elkaar. Dat
       is de eigenschap waar een gedeelde server op zou moeten kunnen leunen. */
    process.env.RTG_DATA_DIR = A;
    assert.deepEqual(opslag.leesLokaleSnapshot(), { waar: 'in A' }, 'A hoort onaangeroerd te zijn');
    process.env.RTG_DATA_DIR = B;
    assert.deepEqual(opslag.leesLokaleSnapshot(), { waar: 'in B' });
  });
});

test('de brokkenopslag en de sleutel volgen de map ook', () => {
  metTweeMappen((A, B) => {
    process.env.RTG_DATA_DIR = A;
    const geheugen = require(path.join(WORTEL, 'server/db/geheugen'));
    const state = require(path.join(WORTEL, 'server/db/state'));
    assert.equal(geheugen.GDIR, path.join(A, 'geheugen'));

    state.db.data = { proef: { a: 1 } };
    state.db.writable = true;
    geheugen.schrijfGeheugenNu();
    assert.ok(fs.existsSync(path.join(A, 'geheugen', 'manifest.rtgm')), 'het manifest hoort in A te staan');
    assert.equal(fs.existsSync(path.join(B, 'geheugen')), false, 'en er hoort nog niets in B te zijn');

    process.env.RTG_DATA_DIR = B;
    assert.equal(geheugen.GDIR, path.join(B, 'geheugen'), 'GDIR hoort mee te bewegen');
    state.db.data = { proef: { a: 2 } };
    geheugen.schrijfGeheugenNu();
    assert.ok(fs.existsSync(path.join(B, 'geheugen', 'manifest.rtgm')), 'de tweede schrijfactie hoort in B te landen');

    /* EN DE INHOUD KOMT ER OOK ECHT UIT, per map. Op het manifest alleen toetsen
       is te zwak: dat wordt onvoorwaardelijk geschreven, dus een opslag die de
       BROKKEN niet meer wegschrijft zou hier groen blijven. Twee mappen die elk
       hun eigen antwoord teruggeven is de eigenschap waar een gedeelde server op
       zou moeten kunnen leunen, en het is meteen de scherpste bewering die deze
       toets kan doen. */
    process.env.RTG_DATA_DIR = A;
    assert.deepEqual(geheugen.laadGeheugen(), { proef: { a: 1 } }, 'A hoort zijn eigen gegevens terug te geven');
    process.env.RTG_DATA_DIR = B;
    assert.deepEqual(geheugen.laadGeheugen(), { proef: { a: 2 } }, 'B de zijne');
  });
});

/* DE SLEUTELS WEGEN HET ZWAARST. Een gedeelde server die de vault van de vorige
   toets vasthoudt terwijl de rtg.db van de volgende openstaat, ontsleutelt niets
   meer -- of erger, ontsleutelt de verkeerde identiteiten. Sleutel en database
   horen uit DEZELFDE map te komen, en dat is precies wat een lezing per aanroep
   garandeert en een constante niet. */
test('de identiteitskluis wijst naar de map van dit moment', () => {
  metTweeMappen((A, B) => {
    process.env.RTG_DATA_DIR = A;
    const accounts = require(path.join(WORTEL, 'server/accounts'));
    assert.equal(accounts.RING_FILE, path.join(A, 'vault.ring'));
    assert.equal(accounts.ringBestand(), path.join(A, 'vault.ring'), 'de functie zegt hetzelfde als de eigenschap');

    process.env.RTG_DATA_DIR = B;
    assert.equal(accounts.RING_FILE, path.join(B, 'vault.ring'),
      'de sleutelring hoort mee te bewegen; blijft hij staan, dan leest een gedeelde server ' +
      'de kluissleutels van de VORIGE toets bij de database van de volgende');
  });
});

test('de postbus en de papieren volgen de map ook', () => {
  metTweeMappen((A, B) => {
    process.env.RTG_DATA_DIR = A;
    const papieren = require(path.join(WORTEL, 'server/papieren/opslag'));
    assert.equal(papieren.BESTAND, path.join(A, 'papieren.json'));
    process.env.RTG_DATA_DIR = B;
    assert.equal(papieren.BESTAND, path.join(B, 'papieren.json'));

    /* GEEN `if` OM DEZE BEWERING HEEN. Hier stond `if (maakOutbox) { ... }`, en
       een bewering achter een voorwaarde die stil onwaar kan zijn is geen
       bewering (LAT-regel 9). server/mail-outbox.js exporteert een fabriek; dat
       is een eigenschap om VAST te leggen, niet om omheen te werken. */
    const maakOutbox = require(path.join(WORTEL, 'server/mail-outbox'));
    assert.equal(typeof maakOutbox, 'function', 'mail-outbox hoort een fabriek te exporteren');
    const o = maakOutbox({ FROM: 'proef@rtg.test' });
    assert.equal(o.OUTBOX, path.join(B, 'outbox'));
    process.env.RTG_DATA_DIR = A;
    assert.equal(o.OUTBOX, path.join(A, 'outbox'), 'de postbus hoort mee te bewegen');
  });
});

/* WAT ER NOG NIET MEEBEWEEGT, en dat hoort hier te staan zolang het waar is.
   Anders leest een volgende lezer "de datamap is instelbaar" en bouwt daarop. */
test('STORE beweegt NIET mee, en dat is een bewuste keuze', () => {
  metTweeMappen((A, B) => {
    process.env.RTG_DATA_DIR = A;
    const opslag = require(path.join(WORTEL, 'server/db/opslag'));
    const eerst = opslag.STORE;
    process.env.RTG_DATA_DIR = B;
    assert.equal(opslag.STORE, eerst,
      'de opslagkeuze wordt met opzet EEN keer beslist: hem per lezing opnieuw stellen zou de ' +
      'opslagvorm midden in een rit kunnen laten omslaan. Hij hoort bij een verificatiecontext, ' +
      'niet bij een proces -- en telt tot die er is terecht mee in datamapVastgeklonken');
  });
});
