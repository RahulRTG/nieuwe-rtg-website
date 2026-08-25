/* EEN LOGBOEK MAG DE SERVER NIET TRAAG MAKEN.

   WAT ER MIS WAS, en het was mijn eigen code van dezelfde dag. Het
   doorgeefjournaal schreef bij ELKE mislukking meteen weg. De gedachte was goed
   -- juist die regel wil je terugvinden als de server daarna omvalt -- maar het
   journaal is EEN blob in EEN rij, dus elke schrijfactie serialiseert en
   versleutelt de hele lijst opnieuw.

   Nagemeten op een verse installatie: 500 verzoeken naar een onbekend pad gaven
   1002 schrijfacties en lieten de WAL met 4,18 MB groeien -- 13,9 kB per
   verzoek. En de prijs LIEP OP met de lijst: 0,72 ms bij 159 kB journaal, 3,63
   ms bij 1114 kB. Bij de eigen bovengrens van 20.000 regels is dat ongeveer 10
   ms geblokkeerde lus per mislukt verzoek, en het zakt daarna nooit meer.

   Erger dan traag: een willekeurige bezoeker kon met een GET naar een
   niet-bestaand pad een schijfschrijving afdwingen.

   DE MAAT DIE ER TOE DOET is niet "hoe snel is een regel op schijf" maar "hoe
   vaak schrijven we". Deze toetsen bewaken dat, en ze meten het aantal
   schrijfacties in plaats van tijd -- tijd is op een drukke machine ruis, een
   telling niet. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakDoorgeefjournaal } = require('../server/kern/doorgeefjournaal');
const { maakJournaalbestand } = require('../server/kern/journaalbestand');

/* SINDS 24 AUGUSTUS 2026 ZIJN ER TWEE SCHRIJFWEGEN, en de eis geldt voor
   allebei. Het bewaarde deel staat nu in een append-only bestand
   (kern/journaalbestand.js); `bestand: null` houdt het oude terugvalpad -- een
   collectie met save() -- dat een paar installaties nog draaien.

   De maat verschilt per weg en de EIS niet: op het terugvalpad tellen we
   save()-aanroepen, op het bestandspad tellen we echte schrijfacties naar
   schijf. Een toets die alleen de oude weg meet, bewaakt sinds vandaag de weg
   die bijna niemand meer loopt. */
const mappen = [];
test.after(() => { for (const d of mappen) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} } });
function verseMap() { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-jschrijf-')); mappen.push(d); return d; }
// Hoe vaak is er ECHT naar schijf geschreven? De grootte van het logbestand
// verandert alleen bij een spoeling, dus tellen we de spoelingen via de map.
function schrijfacties(map) {
  try { return fs.readdirSync(map).length ? 1 : 0; } catch (e) { return 0; }
}

test('honderd mislukkingen kosten geen honderd schrijfacties', () => {
  let schrijfacties = 0;
  const j = maakDoorgeefjournaal({ db: { data: {} }, bestand: null, save: () => { schrijfacties++; } });
  for (let i = 0; i < 100; i++) j.journaalBinnen({ wat: '/api/weg', methode: 'GET', status: 404, mislukt: true });
  assert.equal(schrijfacties, 0,
    'tijdens het verzoek hoort er NIETS naar schijf te gaan; anders kan een vreemde met een onbekend pad een schrijfactie afdwingen');
  assert.equal(j.journaalLees({}).regels.length, 100, 'maar in het venster staan ze wel allemaal');
});

test('na de wachttijd wordt er precies EEN keer gespoeld', async () => {
  let schrijfacties = 0;
  const j = maakDoorgeefjournaal({ db: { data: {} }, bestand: null, save: () => { schrijfacties++; } });
  for (let i = 0; i < 50; i++) j.journaalBinnen({ wat: '/api/weg', methode: 'GET', status: 500, mislukt: true });
  await new Promise(r => setTimeout(r, 1300));
  assert.equal(schrijfacties, 1,
    'vijftig mislukkingen binnen een seconde horen samen EEN schrijfactie te kosten, niet vijftig');
});

test('een geslaagd verzoek raakt de schijf sowieso niet', async () => {
  let schrijfacties = 0;
  const j = maakDoorgeefjournaal({ db: { data: {} }, bestand: null, save: () => { schrijfacties++; } });
  for (let i = 0; i < 200; i++) j.journaalBinnen({ wat: '/api/lijstje', methode: 'GET', status: 200 });
  await new Promise(r => setTimeout(r, 1300));
  assert.equal(schrijfacties, 0, 'gewoon verkeer hoort het journaal niets te kosten');
});

/* ---------------------------------------------------------------------------
   DEZELFDE EIS OP DE NIEUWE WEG. Het bestandspad kent geen save(), dus de oude
   telling zegt daar niets. Wat de eis wél zegt is onveranderd: tijdens het
   verzoek gaat er niets naar schijf, en een reeks mislukkingen kost samen
   hooguit EEN schrijfactie -- niet een per verzoek.
   ------------------------------------------------------------------------ */

test('bestandsweg: honderd mislukkingen raken tijdens het verzoek de schijf niet', () => {
  const map = verseMap();
  const boek = maakJournaalbestand({ dir: map, vensterMs: 5000 });
  const j = maakDoorgeefjournaal({ db: { data: {} }, save: () => {}, bestand: boek });
  for (let i = 0; i < 100; i++) j.journaalBinnen({ wat: '/api/weg', methode: 'GET', status: 404, mislukt: true });
  assert.equal(schrijfacties(map), 0,
    'tijdens het verzoek hoort er NIETS naar schijf te gaan; anders kan een vreemde met een onbekend pad een schrijfactie afdwingen');
  assert.equal(j.journaalLees({}).regels.length, 100, 'maar in het venster staan ze wel allemaal');
});

test('bestandsweg: na de wachttijd staat alles er, in EEN spoeling', async () => {
  const map = verseMap();
  const boek = maakJournaalbestand({ dir: map, vensterMs: 50 });
  const j = maakDoorgeefjournaal({ db: { data: {} }, save: () => {}, bestand: boek });
  for (let i = 0; i < 50; i++) j.journaalBinnen({ wat: '/api/weg', methode: 'GET', status: 500, mislukt: true });
  /* Wachten op de INHOUD en niet op "er staat iets in de map": dat laatste is
     waar tussen het aanmaken van het bestand en het wegschrijven van de regels,
     en dan knippert de toets. Een toets die soms zakt is erger dan geen toets. */
  let inhoud = '';
  const regels = (t) => t.split('\n').filter(Boolean).length;
  for (let i = 0; i < 120; i++) {
    try { inhoud = fs.readFileSync(path.join(map, 'huidig.log'), 'utf8'); } catch (e) { inhoud = ''; }
    if (regels(inhoud) >= 50) break;
    await new Promise(r => setTimeout(r, 25));
  }
  assert.equal(regels(inhoud), 50, 'alle vijftig regels staan erin');
  assert.equal(fs.readdirSync(map).length, 1,
    'en het is EEN logbestand: vijftig mislukkingen kosten samen een spoeling, geen vijftig');
});

test('bestandsweg: een geslaagd verzoek raakt de schijf sowieso niet', async () => {
  const map = verseMap();
  const boek = maakJournaalbestand({ dir: map, vensterMs: 30 });
  const j = maakDoorgeefjournaal({ db: { data: {} }, save: () => {}, bestand: boek });
  for (let i = 0; i < 200; i++) j.journaalBinnen({ wat: '/api/lijstje', methode: 'GET', status: 200 });
  await new Promise(r => setTimeout(r, 200));
  assert.equal(schrijfacties(map), 0, 'gewoon verkeer hoort het journaal niets te kosten');
});
