/* HET OBSERVATORIUM -- één bord over de labs heen, en het kan ZAKKEN.

   De regel die dit bord bepaalt komt uit BESTUUR.md: *een cockpit die niet kan
   zakken, is een dashboard.* Wat deze toets vastlegt:

     1. Een leeg, gezond lab staat op "in orde", en het bord noemt zijn seinen.
     2. Een stilgelegd onderzoek zet het bord op STORING -- de zwaarste stand
        wint, en niet het gemiddelde.
     3. Een open klacht doet hetzelfde, en de TEKST van de klacht staat er niet
        op: die gaat alleen naar de RTF-staf.
     4. Een bron die er niet is (het fonds, het grootboek) geeft "niet vast te
        stellen" en GEEN nul -- en die stand is zwaarder dan "in orde".
     5. Er staat geen samengesteld cijfer op, en geen mens: geen alias, geen
        deelnemer, geen score per lab.
     6. Wat het bord niet zegt, staat erbij.

   Draai los: node --test test/livinglab-observatorium.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function huis(extra) {
  const db = { data: {} };
  const livinglab = require('../server/kern/livinglab')(Object.assign({ db, save: () => {}, crypto,
    anthropic: null, lab: null, kosten: () => null, economie: () => null, labfonds: () => null }, extra || {})).livinglab;
  const lab = livinglab.bestuur.labMaak({ naam: 'Lab IJmuiden', stad: 'IJmuiden' }, { staf: true }).lab;
  const studie = (titel) => livinglab.studie.studieMaak({ labId: lab.id, titel, soort: 'leefomgeving',
    doel: 'inzicht', vraagstuk: 'Welke woningen in de wijk lopen risico bij aanhoudende hitte?' }, 'staf').studie;
  return { livinglab, lab, studie };
}
/* Een kostenmeter en een fonds die WEL antwoorden, zodat een groen bord ook
   echt groen kan zijn. Ze geven nul terug omdat er niets verbruikt is -- dat is
   iets anders dan de afwezige meter uit toets 4. */
const METER = { voorDrager: (p, drager) => ({ periode: p, drager, regels: [], toegerekend: [],
  totaal: { centen: 0, millicenten: 0, graad: 'gemeten' }, zonderTarief: [], nietGemeten: [] }),
  alleDragers: () => [] };
const FONDS = { financiering: () => ({ toegezegd: { bedrag: 0 } }) };

const seinVan = (b, code) => b.seinen.find(s => s.code === code);

test('1. een gezond lab staat in orde, met zijn seinen erbij', () => {
  const h = huis({ labfonds: () => FONDS, kosten: () => METER });
  h.studie('Hittestress in woningen');
  const b = h.livinglab.observatorium.bord(h.lab.id);
  assert.equal(b.ok, true);
  assert.equal(b.stand, 'in orde', JSON.stringify(b.seinen.map(s => [s.code, s.stand])));
  assert.equal(b.onderzoeken.lopend, 1);
  assert.deepEqual(b.seinen.map(s => s.code).sort(),
    ['geld', 'gezakt', 'ijking', 'klachten', 'stilgelegd', 'wachtend']);
  for (const s of b.seinen) assert.ok(s.op && s.graad, s.code + ' draagt geen graad of datum');
});

test('2. een stilgelegd onderzoek zet het bord op storing', () => {
  const h = huis({ labfonds: () => FONDS, kosten: () => METER });
  const s = h.studie('Hittestress in woningen');
  h.livinglab.bestuur.tekenaarZet(h.lab.id, { naam: 'Toezicht', rol: 'toezichthouder' }, 'staf');
  const r = h.livinglab.waarborg.stilleggen(s.id,
    { door: 'Toezicht', reden: 'De toestemmingstekst dekt de nieuwe meting niet.' }, 'staf');
  assert.equal(r.ok, true, JSON.stringify(r));
  const b = h.livinglab.observatorium.bord(h.lab.id);
  assert.equal(b.stand, 'storing', 'één stilgelegd onderzoek verkleurt het bord niet lichtjes');
  const sein = seinVan(b, 'stilgelegd');
  assert.equal(sein.stand, 'storing');
  assert.equal(sein.aantal, 1);
  assert.equal(sein.studies[0].nummer, s.nummer);
});

test('3. een open klacht is een storing, en de tekst staat er niet op', () => {
  const h = huis({ labfonds: () => FONDS, kosten: () => METER });
  const s = h.studie('Hittestress in woningen');
  h.livinglab.waarborg.klacht(s.id, { tekst: 'De projectleider luisterde niet naar mijn bezwaar.', alias: 'Merel' });
  const b = h.livinglab.observatorium.bord(h.lab.id);
  assert.equal(b.stand, 'storing');
  assert.equal(seinVan(b, 'klachten').aantal, 1);
  const heel = JSON.stringify(b);
  assert.ok(!/luisterde niet/.test(heel), 'de klachttekst hoort niet op een bord');
  assert.ok(!/Merel/.test(heel), 'ook de alias van de klager niet');
});

test('4. een bron die er niet is, geeft "niet vast te stellen" en geen nul', () => {
  const h = huis();   // geen fonds, geen kostenmeter
  h.studie('Hittestress in woningen');
  const b = h.livinglab.observatorium.bord(h.lab.id);
  const g = seinVan(b, 'geld');
  assert.equal(g.stand, 'niet vast te stellen');
  assert.equal(g.graad, 'onbekend');
  assert.ok(!('toegezegdEuro' in g), 'er staat geen bedrag waar niets is gepeild');
  assert.ok(g.nietTeZeggen.length > 10);
  /* En die stand is ZWAARDER dan in orde: een meter die niet meet, is geen
     groen licht. */
  assert.equal(b.stand, 'niet vast te stellen');
  assert.equal(h.livinglab.observatorium.zwaarste('in orde', 'niet vast te stellen'), 'niet vast te stellen');
  assert.equal(h.livinglab.observatorium.zwaarste('storing', 'niet vast te stellen'), 'storing');
});

test('5. er staat geen samengesteld cijfer op, en geen mens', () => {
  const h = huis({ labfonds: () => FONDS, kosten: () => METER });
  const s = h.studie('Hittestress in woningen');
  /* Rechtstreeks in het dossier: de ethische poort van ./mensen.js houdt een
     deelnemer tegen tot de studie zover is, en wat hier getoetst wordt is het
     BORD en niet die poort. */
  h.livinglab.vindStudie(s.id).dossier.deelnemers.push({ alias: 'Merel-7', rol: 'buurtonderzoeker', punten: 0, badges: [] });
  const b = h.livinglab.observatorium.bord(h.lab.id);
  for (const woord of ['score', 'cijfer', 'gezondheid', 'ranglijst'])
    assert.ok(!(woord in b), 'een samengesteld ' + woord + ' verbergt welk sein bewoog');
  const alias = h.livinglab.vindStudie(s.id).dossier.deelnemers[0].alias;
  assert.ok(alias, 'de deelnemer heeft een alias -- anders toetst dit niets');
  assert.ok(!JSON.stringify(b).includes(alias), 'op dit bord is geen mens aan te wijzen');
});

test('6. het bord zegt wat het niet zegt, en een onbekend lab krijgt geen leeg bord', () => {
  const h = huis();
  const b = h.livinglab.observatorium.bord(h.lab.id);
  assert.ok(b.zegtNiet.length >= 3);
  assert.ok(b.zegtNiet.some(z => /niet vast te stellen/.test(z) && /nul/.test(z)));
  assert.equal(h.livinglab.observatorium.bord('bestaat-niet').status, 404);
});
