/* HERSTEL ALS TRANSACTIE: negen beweringen over de twee stappen die een
   herstelknop normaal gesproken NIET heeft.

   1. DE VOORCONTROLE HOUDT EEN ECHTE RONDE TEGEN. Een recept dat op vijftig
      gevallen is beproefd en er vierduizend raakt, is geen herstel maar een
      migratie.
   2. MAAR HIJ HOUDT EEN DROOGLOOP NIET TEGEN. Droog draaien is juist hoe je
      erachter komt dat de voorcontrole niet houdt.
   3. EEN MISLUKTE VERIFICATIE DRAAIT ZICHZELF TERUG. De schrijfactie plakte
      niet; dan hoort de ronde niet als geslaagd te eindigen.
   4. EEN GESLAAGDE RONDE WORDT NIET TERUGGEDRAAID. De tegenhanger van 3: zonder
      deze toets zou "altijd terugdraaien" ook slagen.
   5. NUL GERAAKTE OBJECTEN IS NIET GESLAAGD. Het is "niet van toepassing", en
      dat verschil is de reden dat deze laag bestaat: een herstelknop die stil
      niets doet en groen meldt, is erger dan een knop die niets doet.
   6. EEN RECEPT ZONDER CERTIFICAAT LEEST NIET ALS EEN GECERTIFICEERD RECEPT.
   7. EEN VOORWAARDE DIE NIET TE CONTROLEREN IS, SLAAGT NIET -- en blokkeert ook
      niet stilzwijgend. Zij staat in de keten met de reden erbij.
   8. EEN STORING IN HET FUNDAMENT HOUDT EEN ECHTE RONDE TEGEN. Gegevens
      rechtzetten terwijl de sporen of de gegevenslaag stuk zijn, maakt er een
      tweede storing bij.
   9. DE KETEN STAAT IN DE UITSLAG, in de volgorde waarin hij is gelopen.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de `if (!droog && !voor.mag)`-tak uit transactie.js gehaald
     -> "de voorcontrole houdt een echte ronde tegen" ZAKT (RAAK)
   - de automatische terugdraaiing bij een mislukte verificatie uitgezet
     -> "een mislukte verificatie draait zichzelf terug" ZAKT (RAAK)
   - `cert.terugweg === 'automatisch'` uit die tak gehaald (dus altijd terug)
     -> "een geslaagde ronde wordt niet teruggedraaid" ZAKT (RAAK)
   - de nul-objecten-tak in verifieer() overgeslagen
     -> "nul geraakte objecten is niet geslaagd" ZAKT (RAAK)
   - certificaatVan() een standaardcertificaat laten teruggeven
     -> "een recept zonder certificaat leest niet als gecertificeerd" ZAKT (RAAK)
   - de fundament-gezond-controle altijd op goed gezet
     -> "een storing in het fundament houdt een echte ronde tegen" ZAKT (RAAK)

   Draai los: node --test test/hersteltransactie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { maakRunbooks } = require('../server/kern/command/runbooks');
const { maakTransactie } = require('../server/kern/command/transactie');
const maakCmdOpslag = require('../server/kern/command/opslag');

const SOORT = { type: 'rit', sleutel: 'id', label: 'Rit', meervoud: 'ritten', domein: 'mobiliteit' };

/* Een rit die zijn nieuwe status WEIGERT: de setter doet niets. Zo ziet de
   transactie precies wat zij in het echt zou zien als een schrijfactie niet
   plakte -- een trigger die terugschrijft, een replica die achterloopt, een
   veld dat elders wordt overschreven. */
function stugge(id) {
  const r = { id };
  Object.defineProperty(r, 'status', { get: () => 'vast', set: () => {}, enumerable: true, configurable: true });
  return r;
}

function opstelling(o) {
  const opt = o || {};
  const ritten = opt.ritten || [{ id: 'r1', status: 'vast' }, { id: 'r2', status: 'vast' }];
  const db = { data: { ritten } };
  const register = {
    SOORTEN: [SOORT],
    OP_TYPE: new Map([['rit', SOORT]]),
    rijen: (d) => d.data.ritten,
    kort: (soort, r) => ({ titel: 'Rit ' + r.id })
  };
  const rb = Object.assign({
    id: 'rit-vast', naam: 'Vastgelopen rit hervatten', wat: '...', type: 'rit', veld: 'status',
    naar: 'gepland', past: (r) => r.status === 'vast', actie: 'route wijzigen',
    oorzaak: 'rit vastgelopen', terugDraaibaar: true, klantImpact: false
  }, 'certificaat' in opt ? { certificaat: opt.certificaat } : {
    certificaat: { versie: 1, maxObjecten: 50, terugweg: 'automatisch',
      verificaties: ['veld-staat-op-doel', 'oorzaak-weg'] } });

  const journaalRegels = [];
  const runbooks = maakRunbooks({
    db, opslag: maakCmdOpslag({ db }), save() {}, crypto,
    journaal: { noteer: (r) => journaalRegels.push(r) },
    risico: { beoordeel: () => ({ niveau: 'auto', score: 5, waarom: ['toets'], vierOgen: false }) },
    beleid: { getal: (k, d) => d, waarde: (k, d) => d },
    register, catalogus: { RUNBOOKS: [rb], OP_ID: new Map([[rb.id, rb]]) }, vak: () => db.data
  });
  const transactie = maakTransactie({ db, runbooks, register,
    journaal: { noteer: (r) => journaalRegels.push(r) }, gezondheid: opt.gezondheid });
  return { db, ritten, runbooks, transactie, journaalRegels };
}

const gezond = (oordelen) => ({ stand: () => ({ vermogens: [
  { id: 'bereikbaar', naam: 'Bereikbaar', oordeel: (oordelen || {}).bereikbaar || 'in orde' },
  { id: 'gegevens', naam: 'De gegevens', oordeel: (oordelen || {}).gegevens || 'in orde' },
  { id: 'sporen', naam: 'De sporen', oordeel: (oordelen || {}).sporen || 'in orde' }
] }) });

test('1. de voorcontrole houdt een echte ronde tegen', () => {
  const ritten = []; for (let i = 0; i < 12; i++) ritten.push({ id: 'r' + i, status: 'vast' });
  const t = opstelling({ ritten, certificaat: { versie: 1, maxObjecten: 5, terugweg: 'automatisch',
    verificaties: ['veld-staat-op-doel'] } });
  const r = t.transactie.draai('rit-vast', { droog: false, door: 'toetser', menselijkAkkoord: true });
  assert.equal(r.status, 409, 'twaalf gevallen op een certificaat voor vijf gingen gewoon door');
  assert.ok(/ten hoogste 5/.test(r.error), r.error);
  assert.equal(t.ritten[0].status, 'vast', 'er is toch geschreven');
  const stap = r.voorcontrole.stappen.find(s => s.naam === 'binnen-max-impact');
  assert.deepEqual(stap.gemeten, { kandidaten: 12, max: 5 });
});

test('2. maar hij houdt een droogloop niet tegen', () => {
  const ritten = []; for (let i = 0; i < 12; i++) ritten.push({ id: 'r' + i, status: 'vast' });
  const t = opstelling({ ritten, certificaat: { versie: 1, maxObjecten: 5, terugweg: 'automatisch',
    verificaties: ['veld-staat-op-doel'] } });
  const r = t.transactie.draai('rit-vast', { droog: true, door: 'toetser' });
  assert.ok(!r.error, 'een droogloop werd tegengehouden: ' + r.error);
  assert.equal(r.voorcontrole.mag, false, 'de droogloop meldt niet dat de voorcontrole zou weigeren');
  assert.equal(r.run.droog, true);
  assert.deepEqual(r.keten, ['voorcontrole', 'droogloop']);
});

test('3. een mislukte verificatie draait zichzelf terug', () => {
  const t = opstelling({ ritten: [stugge('r1'), stugge('r2')], gezondheid: gezond() });
  const r = t.transactie.draai('rit-vast', { droog: false, door: 'toetser', menselijkAkkoord: true });
  assert.equal(r.verificatie.goed, false, 'de verificatie meldde geslaagd terwijl er niets plakte');
  const veld = r.verificatie.stappen.find(s => s.naam === 'veld-staat-op-doel');
  assert.equal(veld.gemeten.mis, 2);
  const oorzaak = r.verificatie.stappen.find(s => s.naam === 'oorzaak-weg');
  assert.equal(oorzaak.goed, false, 'de aanleiding is nog steeds waar, en dat wordt niet gemeten');
  assert.ok(r.teruggedraaid, 'een mislukte verificatie liet de ronde gewoon staan');
  assert.equal(r.keten[4], 'terug');
});

test('4. een geslaagde ronde wordt niet teruggedraaid', () => {
  const t = opstelling({ gezondheid: gezond() });
  const r = t.transactie.draai('rit-vast', { droog: false, door: 'toetser', menselijkAkkoord: true });
  assert.equal(r.verificatie.goed, true, r.verificatie.waarom);
  assert.equal(r.teruggedraaid, null, 'een geslaagde ronde werd teruggedraaid');
  assert.equal(r.keten[4], 'vastleggen');
  assert.equal(t.ritten[0].status, 'gepland', 'de wijziging staat er niet meer');
});

test('5. nul geraakte objecten is niet geslaagd', () => {
  const t = opstelling({ ritten: [{ id: 'r1', status: 'gepland' }], gezondheid: gezond() });
  const r = t.transactie.draai('rit-vast', { droog: false, door: 'toetser', menselijkAkkoord: true });
  assert.equal(r.run.geraakt, 0);
  assert.equal(r.verificatie.goed, null, 'nul objecten telde als een geslaagde verificatie');
  assert.equal(r.verificatie.nietVanToepassing, true);
  assert.ok(/geen geslaagde ronde/.test(r.verificatie.waarom), r.verificatie.waarom);
});

test('6. een recept zonder certificaat leest niet als een gecertificeerd recept', () => {
  const t = opstelling({ certificaat: undefined, gezondheid: gezond() });
  const r = t.transactie.draai('rit-vast', { droog: true, door: 'toetser' });
  assert.equal(r.certificaat.ongecertificeerd, true);
  assert.equal(r.certificaat.maxObjecten, null, 'er is stilzwijgend een bovengrens verzonnen');
  assert.equal(r.certificaat.terugweg, 'handmatig', 'er is stilzwijgend een automatische weg terug beloofd');
  assert.ok(/geen certificaat/.test(r.certificaat.waarom), r.certificaat.waarom);
  const grens = r.voorcontrole.stappen.find(s => s.naam === 'binnen-max-impact');
  assert.equal(grens.goed, true, 'zonder bovengrens hoort de grens niet te knijpen');
  assert.ok(/geen afgesproken bovengrens/.test(grens.waarom), grens.waarom);
});

test('7. een voorwaarde die niet te controleren is, slaagt niet en blokkeert niet', () => {
  const t = opstelling({});               // geen gezondheidskaart meegegeven
  const r = t.transactie.draai('rit-vast', { droog: false, door: 'toetser', menselijkAkkoord: true });
  assert.ok(!r.error, 'een niet-controleerbare voorwaarde hield de ronde tegen');
  const f = r.voorcontrole.stappen.find(s => s.naam === 'fundament-gezond');
  assert.equal(f.gecontroleerd, false);
  assert.equal(f.goed, null, 'een niet-gecontroleerde voorwaarde staat op geslaagd');
  assert.deepEqual(r.voorcontrole.nietGecontroleerd, ['fundament-gezond']);

  /* En de kaart die stukloopt is hetzelfde geval: niet groen, niet rood. */
  const stuk = opstelling({ gezondheid: { stand: () => { throw new Error('de kaart is stuk'); } } });
  const r2 = stuk.transactie.draai('rit-vast', { droog: true, door: 'toetser' });
  const f2 = r2.voorcontrole.stappen.find(s => s.naam === 'fundament-gezond');
  assert.equal(f2.gecontroleerd, false);
  assert.ok(/de kaart is stuk/.test(f2.waarom), f2.waarom);
});

test('8. een storing in het fundament houdt een echte ronde tegen', () => {
  const t = opstelling({ gezondheid: gezond({ sporen: 'storing' }) });
  const r = t.transactie.draai('rit-vast', { droog: false, door: 'toetser', menselijkAkkoord: true });
  assert.equal(r.status, 409, 'er werd hersteld terwijl de sporen stuk waren');
  assert.ok(/De sporen/.test(r.error), r.error);
  assert.equal(t.ritten[0].status, 'vast', 'en er is toch geschreven');

  /* "let op" is geen storing en hoort niets tegen te houden -- anders staat de
     herstelknop op een gemiddelde dag permanent op slot. */
  const soepel = opstelling({ gezondheid: gezond({ sporen: 'let op' }) });
  const r2 = soepel.transactie.draai('rit-vast', { droog: false, door: 'toetser', menselijkAkkoord: true });
  assert.ok(!r2.error, 'een "let op" hield de ronde tegen: ' + r2.error);
});

test('9. de keten staat in de uitslag, in de volgorde waarin hij liep', () => {
  const t = opstelling({ gezondheid: gezond() });
  const r = t.transactie.draai('rit-vast', { droog: false, door: 'toetser', menselijkAkkoord: true });
  assert.deepEqual(r.keten, ['voorcontrole', 'momentopname', 'uitvoeren', 'verificatie', 'vastleggen']);
  /* En de verificatie staat in het journaal, want een stap die alleen op het
     scherm bestaat, is achteraf niet na te lopen. */
  const regel = t.journaalRegels.find(x => x.actie === 'herstel verifiëren');
  assert.ok(regel, 'de verificatie kwam niet in het journaal');
  assert.equal(regel.na.verificatie, true);
});
