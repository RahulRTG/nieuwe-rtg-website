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
  /* En het bereik is opgelost naar twee sha's: een momentopname die niemand kan
     herhalen is geen meting. */
  assert.match(REGISTER.gemeten.bereikOpgelost, /^[0-9a-f]{40}\.\.[0-9a-f]{40}$/);
  assert.ok(REGISTER.nulmeting.waarom.length > 40, 'de nulmeting draagt geen uitgeschreven reden');
});

test('9. een register dat bij de basis NIET BESTOND geeft geen delta', () => {
  /* Drie standen en niet twee, en dit is de plek waar dat geld kost:
     AFGELEID.json en HERBOUWPROEF.json bestonden niet bij het aftakpunt. Wie
     "bestond niet" als nul leest, noteert `0 -> 174` en schrijft een
     spectaculaire vooruitgang op een schaal die daarvoor niet bestond. */
  /* VERS GEMETEN EN NIET UIT HET REGISTER, en dat is een gemaakte fout. De
     eerste versie las alleen REGISTER.gemeten.zekerheid, en toen bleef hij
     GROEN op een mutatie die "bestond niet" als nul ging lezen -- het
     ingecheckte register was immers nog met de goede code geschreven. Een toets
     die alleen de vastgelegde uitslag leest, beproeft de vastlegging en niet de
     meter (LAT.md regel 10). Het register wordt hieronder nog steeds
     gecontroleerd; de EIGENSCHAP wordt vers gemeten. */
  /* Het OPGELOSTE bereik en niet `..HEAD`: dat laatste verschuift met elke
     commit, en dan meet de toets iets anders dan het register beschrijft. */
  const vers = meet(REGISTER.gemeten.bereikOpgelost).zekerheid;
  const bestondNiet = Object.values(vers).filter(r => r.voor === null);
  assert.ok(bestondNiet.length >= 1,
    'geen enkel register ontbrak bij de basis; dan beproeft deze toets niets -- kies een bereik ' +
    'waarin er een is ontstaan, of haal hem weg');
  for (const [naam, r] of Object.entries(vers)) {
    if (r.voor === null) assert.equal(r.delta, null, naam + ' (vers): geen "voor" en toch een delta');
  }

  const z = REGISTER.gemeten.zekerheid;
  assert.ok(z && Object.keys(z).length >= 4, 'de zekerheidshelft is gevuld');
  for (const [naam, r] of Object.entries(z)) {
    if (r.voor === null) {
      assert.equal(r.delta, null, naam + ' heeft geen "voor" en toch een delta');
      assert.ok(r.reden && r.reden.length > 30, naam + ' is onbepaald zonder uitgeschreven reden');
    } else {
      assert.equal(r.delta, r.na - r.voor, naam + ': delta klopt niet met voor en na');
    }
    assert.ok(r.eenheid && r.eenheid.length > 2, naam + ' draagt geen eenheid');
  }
});

test('10. er staat geen enkel opbrengstcijfer, en dat staat er met de reden bij', () => {
  /* De verleiding is "zoveel zekerheid per regel werk". Dat vraagt een weging
     over drie eenheden die niemand weegt -- INT-04, LAT.md regel 11 en
     scripts/check.js regel 48 verbieden precies dat. */
  const o = REGISTER.gemeten.opbrengst;
  assert.ok(o.geenEnkelCijfer.length > 60, 'de weigering draagt geen uitgeschreven reden');
  assert.equal(typeof o.menselijkGetypteRegels, 'number');
  const tekst = JSON.stringify(o);
  assert.ok(!/opbrengstCijfer|yield|zekerheidsScore|totaleOpbrengst/i.test(tekst),
    'er staat een samengesteld opbrengstcijfer in: ' + tekst.slice(0, 200));
  /* En de opbrengst PER SOORT mag alleen een verhouding dragen waar er iets is
     gewonnen: delen door nul of door een negatieve winst is geen kengetal. */
  for (const [naam, p] of Object.entries(o.perSoort)) {
    if (p.delta === null) { assert.equal(p.menselijkeRegelsPerEenheid, undefined); continue; }
    if (p.delta > 0) assert.equal(typeof p.menselijkeRegelsPerEenheid, 'number', naam);
    else assert.equal(p.menselijkeRegelsPerEenheid, null, naam + ' deelt door een niet-positieve winst');
  }
});

test('11. de uitvoer van een generator telt nooit als menselijk getypt werk', () => {
  /* De meter schrijft zelf een MOMENTOPNAME weg. Telt die stand niet mee als
     afgeleid, dan valt BEWIJSKOSTEN.json in `overig` en schrijft de meter zijn
     eigen uitvoer op als arbeid van een mens -- precies het getal dat hij moet
     meten. */
  const deel = indeler();
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'AFGELEID.json'), 'utf8'));
  const moment = reg.artefacten.filter(r => r.soort === 'MOMENTOPNAME' && r.eigenaar);
  assert.ok(moment.length >= 1, 'er is minstens een MOMENTOPNAME om dit op te toetsen');
  for (const r of moment) assert.equal(deel(r.naam), 'afgeleid', r.naam);
});
