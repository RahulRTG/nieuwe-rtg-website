'use strict';
/* ============================================================================
   WAT KOST EEN CORRECTE VERANDERING -- EN WAT MAG ER NOOIT IN DAT CIJFER?

   BEWIJSKOSTEN.json heeft twee helften. `gemeten` volgt uit git en uit twee
   bestaande registers; `verklaard` is een oordeel van een mens. De dragende
   eigenschap van dit bestand is dat die twee elkaar NOOIT raken: een cijfer dat
   half gemeten en half geschat is, leest als gemeten.

   De marker `loopt achter` zet dit bestand in npm run registerklopt.
   ============================================================================ */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { meet, indeler, KLASSEN, NULMETING } = require('../scripts/bewijskosten.js');
const REGISTER = JSON.parse(fs.readFileSync(path.join(WORTEL, 'BEWIJSKOSTEN.json'), 'utf8'));
const BRON = fs.readFileSync(path.join(WORTEL, 'scripts', 'bewijskosten.js'), 'utf8');

test('1. de gemeten helft wordt nergens uit de verklaarde helft berekend', () => {
  /* Dit is de reden dat dit bestand bestaat. De proef is structureel en niet
     op een getal: in de BRON van de meter mag `meet()` de verklaarde helft niet
     kennen. Het woord `verklaard` komt in de code alleen voor op de plek waar
     het blok wordt WEGGESCHREVEN, en nergens in een som. */
  const { zonderCommentaar } = require('../scripts/lib/bron.js');
  const code = zonderCommentaar(BRON, { regelsHeel: true });
  const meetLijf = code.slice(code.indexOf('function meet('), code.indexOf('function main('));
  assert.ok(meetLijf.length > 200, 'de meetfunctie is gevonden');
  assert.ok(!/verklaard|ontdekking/i.test(meetLijf),
    'meet() noemt de verklaarde helft; dan kan een oordeel in een gemeten getal belanden');
});

test('2. de verklaarde helft zegt zelf dat hij verklaard is', () => {
  const v = REGISTER.verklaard;
  assert.ok(v && typeof v.waarom === 'string' && v.waarom.length > 40,
    'de verklaarde helft draagt geen uitgeschreven reden');
  assert.ok(Array.isArray(v.ontdekkingen), 'ontdekkingen is een lijst');
  assert.ok(/hand/.test(v.hoeGroeitDit || ''), 'er staat niet bij dat deze lijst met de hand groeit');
});

test('3. een versterkingsfactor zonder noemer is ONBEPAALD en geen nul', () => {
  /* LAT.md regel 3. Een tak die alleen registers herschrijft heeft nul
     bronregels, en dan is "0 afgeleide regels per bronregel" een bewering die
     niemand heeft gemeten. */
  const leeg = meet('HEAD..HEAD');
  assert.equal(leeg.bronRegels, 0);
  assert.equal(leeg.machineVersterking, null);
  assert.ok(typeof leeg.versterkingOnbepaald === 'string' && leeg.versterkingOnbepaald.length > 30,
    'een onbepaalde factor draagt geen reden');
});

test('4. machineversterking en mensversterking staan apart', () => {
  /* Ze worden nooit opgeteld: de eerste mag groeien (een generator schrijft die
     regels in seconden), de tweede hoort naar nul. Een samengesteld cijfer zou
     een gezond huis vol meters straffen. */
  const g = REGISTER.gemeten;
  assert.equal(typeof g.mensVersterking, 'number');
  assert.ok(g.machineVersterking === null || typeof g.machineVersterking === 'number');
  const tekst = JSON.stringify(g);
  assert.ok(!/totaleVersterking|versterkingTotaal|versterkingScore/.test(tekst),
    'er staat een samengestelde versterkingsfactor in: ' + tekst.slice(0, 200));
});

test('5. de indeling noemt een artefact pas afgeleid als AFGELEID.json dat zegt', () => {
  /* Geen tweede indeling naast dat register: die twee lopen binnen een maand
     uiteen. De proef checkt beide kanten. */
  const deel = indeler();
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'AFGELEID.json'), 'utf8'));
  const eenAfgeleide = reg.artefacten.find(r => r.soort === 'AFGELEID' && r.eigenaar);
  assert.equal(deel(eenAfgeleide.naam), 'afgeleid');
  const eenOnbesliste = reg.artefacten.find(r => r.soort === 'ONBESLIST' && /\.md$/.test(r.naam));
  if (eenOnbesliste) assert.equal(deel(eenOnbesliste.naam), 'document');
  assert.equal(deel('server/kern/ai.js'), 'intentie');
  assert.equal(deel('test/iets.test.js'), 'bewijs');
  assert.equal(deel('scripts/iets.js'), 'bewijs');
  for (const k of KLASSEN) assert.ok(typeof k === 'string');
});

test('6. onbewezen is geen handwerk, en handmatig is geen versterking', () => {
  /* Drie afhandelingen, en het verschil is de hele betekenis van dit register:
     `herbouwplicht` had niemand met de hand hoeven doen, `onbewezen` weten we
     niet (niet bewezen herbouwbaar is iets anders dan bewezen niet), en
     `handmatig` is een bronconflict -- echt werk aan echte inhoud, en dus geen
     versterking. Alleen `onbewezen` telt mee in mensVersterking. */
  const alle = (REGISTER.gemeten.drift || []).flatMap(m => m.paden || []);
  for (const p of alle) {
    assert.ok(['herbouwplicht', 'onbewezen', 'handmatig'].includes(p.afhandeling),
      p.pad + ' draagt afhandeling ' + p.afhandeling);
  }
  assert.equal(REGISTER.gemeten.mensVersterking,
    alle.filter(p => p.afhandeling === 'onbewezen').length);
  assert.equal(REGISTER.gemeten.driftHandmatig,
    alle.filter(p => p.afhandeling === 'handmatig').length);
});

test('7. een samenvoeging die niet te herspelen is telt niet als nul conflicten', () => {
  /* De duurste fout van de eerste ronde: `git merge-tree` geeft exitcode 1 als
     er conflicten ZIJN, execFileSync gooit daarop, en de vanger noteerde
     `conflicten: null` -- waarna de uitslag las als "drift: 0 conflicten"
     terwijl de samenvoeging er negentien had. De bron moet die exitcode dus
     uitdrukkelijk als uitslag lezen, en alleen bij een hogere code opgeven. */
  assert.ok(/e\.status === 1/.test(BRON),
    'de bron leest exitcode 1 van merge-tree niet als "er waren conflicten"');
  for (const m of REGISTER.gemeten.drift || []) {
    if (m.conflicten === null) {
      assert.ok(m.reden && m.reden.length > 20, m.merge + ' is niet herspeeld zonder uitgeschreven reden');
    }
  }
});

test('8. de nulmeting staat erbij, met waarom zij het ijkpunt is', () => {
  assert.equal(REGISTER.nulmeting.commit, NULMETING);
  assert.ok(REGISTER.nulmeting.waarom.length > 40, 'de nulmeting draagt geen uitgeschreven reden');
});
