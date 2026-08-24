/* DE GEZONDHEIDSKAART: veertien beweringen, en ze gaan allemaal over de manier
   waarop zo'n scherm normaal gesproken onwaar wordt. Dertien staan hieronder
   genummerd; de veertiende is de tegenhanger van de eerste, want "alles staat
   op niet vast te stellen" zou aan bewering 1 ook voldoen.

    1. EEN LEEG PLATFORM STAAT NIET OP GROEN. Wat geen bron heeft, is "niet vast
       te stellen" -- anders is de kaart het groenst op de dag dat er nog niets
       draait.
    2. EEN GEVONDEN STORING WORDT NIET STIL. Een lage bewijsgraad mag een echte
       bevinding nooit wegpoetsen tot "niet vast te stellen".
    3. VERVALLEN BEWIJS IS GEEN BEWIJS. Een proef buiten zijn houdbaarheid levert
       geen oordeel meer, maar "moet opnieuw worden vastgesteld" -- niet rood.
    4. EEN RONDE DIE NIETS UITVOERT, BEWIJST NIETS. Voor betalen bestaat geen
       proef die het echt doet, dus komt het daar nooit op "bewezen".
    5. HET PLAFOND HOUDT. De back-up komt niet op "bewezen", ook niet na een
       geslaagde controleronde: er is geen terugzetproef.
    6. DE DOORWERKING KLEURT NIETS ROOD. Een vermogen dat zelf klopt maar leunt
       op een storing, blijft in orde staan met de zin erbij.
    7. EEN ALARM BUITEN DE KAART VERDWIJNT NIET. Anders gaat er een alarm af
       terwijl het scherm groen staat.
    8. VERKEER BUITEN DE FUNCTIECATALOGUS VERDWIJNT NIET.
    9. EEN BRON DIE OMVALT, LIEGT NIET. Niet groen en niet rood: niet vastgesteld,
       met de reden.
   10. UIT IS EEN KEUZE, GEEN STORING. Een dienst die bewust dicht staat, maakt
       het vermogen niet rood.
   11. ELKE CATEGORIE UIT DE FUNCTIECATALOGUS VALT IN PRECIES EEN VERMOGEN.
   12. DE VIER TALEN SPREKEN ELKAAR NIET TEGEN. Zegt laag 1 dat er iets mis is,
       dan staat op laag 3 een bevinding met oordeel "storing".
   13. GEEN ENKELE BRON GEEFT EEN OORDEEL DAT ZIJN GRAAD NIET DRAAGT. Dit is de
       plek waar bewering 1 werkelijk wordt gedragen: wie niets heeft gemeten,
       geeft geen oordeel. Zie de AFGESLAGEN mutatie hieronder.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `!w ||` uit de ergste-reduce in kern/command/gezondheid.js gehaald
     -> "een gezond vermogen staat op in orde" ZAKT (RAAK -- dit was een echte
        fout, gevonden door de eerste proefronde en niet door een lezer)
   - de graadPlafond-regel uit beoordeel() gehaald
     -> "de back-up komt niet op bewezen" ZAKT (RAAK)
   - de vervaltak in gezondheid-proef.js/vanProef overgeslagen
     -> "vervallen bewijs is geen bewijs" ZAKT (RAAK)
   - `(graad === 'onbekend' && ergste === 'in orde')` naar `(graad === 'onbekend')`
     -> NIETS ZAKT (AFGESLAGEN), en dat is een bevinding op zich: die tak is een
        vangnet dat vandaag onbereikbaar is, want geen enkele lezer draagt een
        oordeel met graad `onbekend`. De regel wordt dus een laag lager gedragen
        dan waar hij stond. Daar staat nu toets 13 op, en die bijt wel:
   - `stil()` in gezondheid-bronnen.js een oordeel laten dragen
     -> "geen enkele bron geeft een oordeel dat zijn graad niet draagt" ZAKT (RAAK)
   - de `if (!p.bewijzend)`-tak uit gezondheid-proef.js/vanProef gehaald
     -> "een ronde die niets uitvoert, bewijst niets" ZAKT (RAAK). Deze tak is er
        na een echte fout: op een verse server zette een controleronde op
        "betalen" -- die niets kon doen -- dat vermogen van "niet vast te
        stellen" op "in orde". Gevonden door de eerste ronde tegen een draaiende
        server, niet door een lezer en niet door de toetsen hierboven.
   - de filter op !vermogenVanAlarm(a.id) omgedraaid
     -> "een alarm buiten de kaart verdwijnt niet" ZAKT (RAAK)
   - `oordeel: per.storing.length ? 'storing' : null` naar altijd 'storing'
     -> "uit is een keuze, geen storing" ZAKT (RAAK)

   Draai los: node --test test/gezondheidskaart.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakGezondheid } = require('../server/kern/command/gezondheid');
const { VERMOGENS, ketenVan } = require('../server/kern/command/vermogens');
const { CATEGORIEEN } = require('../server/functies/register');

const UUR = 3600000;

/* Een kaart met bronnen die je zelf zet. Alles wat niet wordt meegegeven, zwijgt
   -- want juist dat geval (niets gemeten) is de helft van deze toetsen. */
function kaart(o) {
  const opt = o || {};
  const db = { data: { techniek: { functies: opt.schakelaars || {} }, commandProeven: opt.proeven || {} } };
  const journaalRegels = [];
  return {
    db, journaalRegels,
    g: maakGezondheid({
      db, save() {},
      meting: { reeksen: () => ({ gestart: Date.now() - UUR, verzoeken: opt.verkeer || [] }) },
      slo: { stand: () => opt.slo || ({ doelen: [], tel: {} }) },
      sonde: opt.sonde || { stand: () => ({ binnen: { pogingen: 0 }, buiten: { pogingen: 0 } }) },
      alarm: { stand: () => ({ alarmen: opt.alarmen || [] }) },
      kwaliteit: opt.kwaliteit || { meet: () => ({ tel: { defecten: 0, soorten: 0, vermoedens: 0 }, gemeten: { objecten: 100 } }) },
      journaal: { controleer: () => opt.keten || ({ heel: true, regels: 3 }),
        noteer: (r) => journaalRegels.push(r) },
      backup: opt.backup || { lees: () => ({ er: true, dag: '2026-08-24', ouderdom: 0, bewaard: 7, mankeert: [] }) },
      dataDir: '/tmp/rtg-gezondheid-toets'
    })
  };
}
const van = (s, id) => s.vermogens.find(v => v.id === id);

test('1. een leeg platform staat niet op groen', () => {
  const s = kaart({}).g.stand();
  /* Geen verkeer, geen sonde, geen doelen: de diensten kunnen niets bewijzen. */
  for (const id of ['betalen', 'leden', 'zaken', 'binnenkomen']) {
    assert.equal(van(s, id).oordeel, 'niet vast te stellen', id + ' staat op groen zonder bewijs');
    assert.equal(van(s, id).graad, 'onbekend');
  }
  assert.ok(van(s, 'betalen').taal.mens.startsWith('Van betalen is nu niet vast te stellen'));
});

test('een gezond vermogen staat op in orde', () => {
  /* De tegenhanger van toets 1: mét bewijs hoort er wél groen te staan. Zonder
     deze toets zou "alles op niet vast te stellen" ook slagen. */
  const s = kaart({ verkeer: [{ route: '/api/bank/sepa', status: '2xx', aantal: 500 }] }).g.stand();
  assert.equal(van(s, 'betalen').oordeel, 'in orde');
  assert.equal(van(s, 'betalen').graad, 'gemeten');
});

test('2. een gevonden storing wordt niet stil', () => {
  /* De back-uplezer meldt "er is er geen" -- dat is een uitslag en geen stilte,
     ook al is er verder niets over dit vermogen bekend. */
  const s = kaart({ backup: { lees: () => ({ er: false, reden: 'er staat geen enkele dagback-up in de map' }) } }).g.stand();
  assert.equal(van(s, 'bewaren').oordeel, 'storing');
  assert.equal(s.oordeel, 'storing');
});

test('3. vervallen bewijs is geen bewijs', () => {
  const oud = new Date(Date.now() - 40 * UUR).toISOString();
  const s = kaart({ proeven: { sporen: { id: 'sporen', at: oud, door: 'kantoor', bewijzend: true,
    gedaan: [{ bron: 'journaal' }], nietGedaan: [], bevindingen: [], uitslag: 'alles klopt' } } }).g.stand();
  const v = van(s, 'sporen');
  assert.equal(v.moetOpnieuw, true, 'een proef van 40 uur oud telt nog mee');
  assert.equal(v.vervallen.was, 'bewezen');
  assert.notEqual(v.graad, 'bewezen', 'vervallen bewijs geeft nog steeds de graad bewezen');
  assert.ok(v.taal.mens.includes('te oud'), 'het scherm zegt niet dat de controle te oud is');
  /* En het is geen storing: we weten het niet, er is niets kapot. */
  assert.notEqual(v.oordeel, 'storing');
});

test('4. een ronde die niets uitvoert, bewijst niets', async () => {
  const k = kaart({ verkeer: [{ route: '/api/bank/sepa', status: '2xx', aantal: 500 }] });
  const r = await k.g.controleer('betalen', 'toetser');
  assert.equal(r.bewijzend, false);
  assert.equal(r.gedaan.length, 0);
  assert.ok(r.nietGedaan.length >= 2, 'de bronnen die niets konden doen, staan er niet bij');
  assert.ok(r.uitslag.includes('niets gecontroleerd'));
  /* En -- de fout die de eerste live-ronde opleverde -- hij oordeelt ook niet.
     Een ronde die niets kon doen, mag een vermogen niet van "niet vast te
     stellen" op "in orde" zetten: dan is de knop de meting geworden. */
  const na = van(k.g.stand(), 'betalen');
  assert.equal(na.graad, 'gemeten', 'een lege ronde tilde dit naar bewezen');
  const pb = na.bevindingen.find(b => b.bron === 'proef');
  assert.equal(pb.oordeel, null, 'een ronde die niets uitvoerde geeft toch een oordeel');
  const leeg = kaart({ proeven: { betalen: { id: 'betalen', at: new Date().toISOString(), door: 'k',
    bewijzend: false, gedaan: [], nietGedaan: [{ bron: 'meting' }], bevindingen: [], uitslag: 'niets gecontroleerd' } } });
  assert.equal(van(leeg.g.stand(), 'betalen').oordeel, 'niet vast te stellen',
    'een lege controleronde maakte een ongemeten vermogen groen');
  /* En de ronde staat in het journaal, juist omdat hij niets deed. */
  assert.equal(k.journaalRegels.length, 1);
  assert.ok(k.journaalRegels[0].reden.includes('geen bewijzende proef'));
});

test('5. het plafond houdt: de back-up komt niet op bewezen', async () => {
  const k = kaart({});
  const r = await k.g.controleer('bewaren', 'toetser');
  assert.equal(r.bewijzend, true, 'de back-up is wel degelijk opengemaakt');
  assert.equal(r.bevindingen.length, 0, 'deze back-up is compleet');
  const v = van(k.g.stand(), 'bewaren');
  assert.equal(v.graad, 'gemeten', 'de back-up staat op ' + v.graad + ' terwijl er geen terugzetproef is');
  assert.equal(v.bewijs.plafond, 'gemeten');
});

test('6. de doorwerking kleurt niets rood', () => {
  /* Betalen ligt eruit; de zakenkant leunt erop en is zelf gezond. */
  const s = kaart({ verkeer: [
    { route: '/api/bank/sepa', status: '5xx', aantal: 300 },
    { route: '/api/bank/sepa', status: '2xx', aantal: 300 },
    { route: '/api/supplier/pos', status: '2xx', aantal: 400 }
  ] }).g.stand();
  assert.equal(van(s, 'betalen').oordeel, 'storing');
  const z = van(s, 'zaken');
  assert.equal(z.oordeel, 'in orde', 'de zakenkant is rood gekleurd door een storing elders');
  assert.deepEqual(z.geraakt, ['betalen']);
  assert.ok(z.taal.mens.includes('via betalen loopt, wacht'), z.taal.mens);
});

test('7. een alarm buiten de kaart verdwijnt niet', () => {
  const s = kaart({ alarmen: [
    { id: 'journaal-gebroken', naam: 'De hashketen klopt niet', ernst: 'hoog', actief: true, wat: 'breuk bij r-9' },
    { id: 'iets-nieuws', naam: 'Een alarm zonder vermogen', ernst: 'hoog', actief: true, wat: 'x' }
  ] }).g.stand();
  assert.equal(van(s, 'sporen').oordeel, 'storing', 'het gekoppelde alarm werkt niet door');
  assert.deepEqual(s.alarmenBuitenDeKaart.map(a => a.id), ['iets-nieuws']);
});

test('8. verkeer buiten de functiecatalogus verdwijnt niet', () => {
  const s = kaart({ verkeer: [{ route: '/api/metrics', status: '2xx', aantal: 700 }] }).g.stand();
  assert.ok(s.dekking.buitenDeFunctiecatalogus, 'het verkeer zonder functie is stil weggevallen');
  assert.equal(s.dekking.buitenDeFunctiecatalogus.verzoeken, 700);
});

test('9. een bron die omvalt, liegt niet', () => {
  const s = kaart({ kwaliteit: { meet: () => { throw new Error('de collectie is niet te lezen'); } } }).g.stand();
  const v = van(s, 'gegevens');
  assert.equal(v.oordeel, 'niet vast te stellen');
  assert.equal(v.graad, 'onbekend');
  const b = v.bevindingen.find(x => x.bron === 'kwaliteit');
  assert.ok(b.zin.includes('de collectie is niet te lezen'), 'de reden staat er niet bij');
});

test('10. uit is een keuze, geen storing', () => {
  const s = kaart({
    verkeer: [{ route: '/api/salon', status: '2xx', aantal: 300 }],
    schakelaars: { salon: { aan: false }, ontmoetingen: { aan: false } }
  }).g.stand();
  const v = van(s, 'sociaal');
  assert.equal(v.oordeel, 'in orde', 'twee bewust gesloten diensten maakten dit rood');
  const sch = v.bevindingen.find(b => b.bron === 'schakelaars');
  assert.equal(sch.getallen.uit, 2);
  assert.equal(sch.oordeel, null, 'de schakelkast oordeelt over gezondheid');
  /* Een gesprongen zekering is wél een storing -- anders meet dit niets. */
  const s2 = kaart({ schakelaars: { salon: { storing: true } } }).g.stand();
  assert.equal(van(s2, 'sociaal').oordeel, 'storing');
});

test('11. elke categorie uit de functiecatalogus valt in precies een vermogen', () => {
  const gezien = [];
  for (const v of VERMOGENS) gezien.push(...v.categorieen);
  for (const c of CATEGORIEEN) assert.equal(gezien.filter(x => x === c).length, 1, c + ' valt niet precies een keer');
  assert.equal(gezien.length, CATEGORIEEN.length, 'er staat een categorie in de kaart die de catalogus niet kent');
  /* En de keten heeft geen kringen; ketenVan zou dan niet terugkomen. */
  for (const v of VERMOGENS) assert.ok(!ketenVan(v.id).includes(v.id), v.id + ' leunt op zichzelf');
});

test('12. de vier talen spreken elkaar niet tegen', () => {
  const s = kaart({ verkeer: [
    { route: '/api/bank/sepa', status: '5xx', aantal: 300 },
    { route: '/api/bank/sepa', status: '2xx', aantal: 300 }
  ] }).g.stand();
  for (const v of s.vermogens) {
    const mis = v.taal.mens.startsWith('Er is iets mis met');
    assert.equal(mis, v.oordeel === 'storing', v.id + ': laag 1 en het oordeel lopen uiteen');
    if (mis) assert.ok(v.taal.technisch.some(t => t.oordeel === 'storing'),
      v.id + ': laag 1 zegt storing en laag 3 draagt er geen bevinding voor');
    /* Laag 4 is de enige die niet te verzinnen is: elke bron noemt zijn eigen
       grens. Een bron zonder die zin is een bron die meer belooft dan hij waarmaakt. */
    for (const b of v.bewijs.bronnen) assert.ok(b.zegtNiet && b.zegtNiet.length > 20,
      v.id + '/' + b.bron + ' draagt geen "zegtNiet"');
  }
});

test('13. geen enkele bron geeft een oordeel dat zijn graad niet draagt', () => {
  /* Dit is waar bewering 1 werkelijk op rust. Zolang een lezer die niets heeft
     gemeten ook geen oordeel geeft, kan "niets gemeten" nooit als groen
     eindigen -- ongeacht hoe het optellen erboven verandert. */
  const standen = [
    kaart({}),
    kaart({ verkeer: [{ route: '/api/bank/sepa', status: '2xx', aantal: 500 }] }),
    kaart({ backup: { lees: () => ({ er: false, reden: 'geen map' }) } }),
    kaart({ kwaliteit: { meet: () => { throw new Error('stuk'); } } }),
    kaart({ sonde: { stand: () => ({ binnen: { pogingen: 3, mislukt: 1, traag: 0, p90Ms: 9 }, buiten: { pogingen: 0 } }) } }),
    kaart({ proeven: { sporen: { id: 'sporen', at: new Date(Date.now() - 40 * UUR).toISOString(),
      door: 'k', bewijzend: true, gedaan: [], nietGedaan: [], bevindingen: [], uitslag: 'alles klopt' } } })
  ].map(k => k.g.stand());

  let gezien = 0;
  for (const s of standen) for (const v of s.vermogens) for (const b of v.bevindingen) {
    gezien++;
    assert.ok(!(b.oordeel && b.graad === 'onbekend'),
      v.id + '/' + b.bron + ' oordeelt "' + b.oordeel + '" met graad onbekend');
  }
  assert.ok(gezien > 50, 'er zijn te weinig bevindingen langsgekomen (' + gezien + ') om iets te bewijzen');
});
