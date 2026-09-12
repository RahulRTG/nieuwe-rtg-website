/* DE TOETS OP DE ECONOMISCHE DEKKING.

   GELDDEKKING.json hangt aan vier tanden in NORM.json, en die bewaken de
   VOORRADEN: ze mogen niet stil groeien. Wat een ratel niet kan bewaken is of de
   meter zelf nog meet wat hij belooft -- een register dat om de verkeerde reden
   op nul staat, haalt elke ratel moeiteloos. Daar is dit bestand voor.

   Draai los: node --test test/gelddekking.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const lees = (naam) => JSON.parse(fs.readFileSync(path.join(WORTEL, naam), 'utf8'));

test('geen weg die waarde beweegt is publiek aanroepbaar', () => {
  const r = lees('GELDDEKKING.json');
  /* DE NOEMER EERST. Een register met nul geldroutes meldt nul publieke
     geldroutes, en dat leest als een geruststelling terwijl het een lege meting
     is. Dezelfde reden als in test/geldkaart.test.js. */
  assert.ok(r.gemeten.geldroutes > 0,
    'er zijn geen geldroutes gemeten; dan zegt deze toets niets -- draai npm run geldkaart');
  const publiek = r.rijen.filter(x => x.toegang === 'PUBLIC');
  assert.deepEqual(publiek.map(x => x.methode + ' ' + x.pad), [],
    'een route die waarde beweegt en die een onbekende mag aanroepen. Dat is de ' +
    'enige as van deze meter die hard is: de andere drie zijn voorraden die mogen ' +
    'dalen, deze hoort nul te zijn en te blijven.');
});

test('elke geldroute is in het mutatiecontract teruggevonden', () => {
  const r = lees('GELDDEKKING.json');
  const zonder = r.rijen.filter(x => x.semantiek === null);
  assert.deepEqual(zonder.map(x => x.methode + ' ' + x.pad), [],
    'deze routes bewegen waarde maar staan niet in MUTATIECONTRACT.json. Dan zijn ' +
    'hun semantiek- en toegangsassen geen uitslag maar een gat, en telt de meter ' +
    'ze ten onrechte mee in zijn noemer.');
});

test('de vier ratelgetallen kloppen met de rijen eronder', () => {
  /* Een ratel leest ALLEEN het blokje `ratel`. Loopt dat uiteen met de rijen,
     dan bewaakt NORM.json een getal dat nergens meer op slaat -- en niets zou
     daarover klagen. Vandaar deze hertelling. */
  const r = lees('GELDDEKKING.json');
  const rij = r.rijen;
  assert.equal(r.ratel.geldRoutesPubliek,
    rij.filter(x => x.toegang === 'PUBLIC').length, 'geldRoutesPubliek');
  assert.equal(r.ratel.geldRoutesZonderSemantiek,
    rij.filter(x => x.semantiek === 'onbekend' || x.semantiek === null).length, 'geldRoutesZonderSemantiek');
  assert.equal(r.ratel.geldRoutesZonderIdemBewijs,
    rij.filter(x => x.idempotentie !== 'beschermd').length, 'geldRoutesZonderIdemBewijs');
  assert.equal(r.ratel.geldRoutesZonderTerugweg,
    rij.filter(x => x.terugweg !== 'exact' && x.terugweg !== 'compensatie').length, 'geldRoutesZonderTerugweg');
});

test('er staat NERGENS een samengesteld dekkingspercentage', () => {
  /* Dit is de grens van dit hele bestand, en hij is machinaal te handhaven.
     Keuringsregel 48 en LAT.md regel 11 zeggen hetzelfde: losse eerlijke
     getallen die worden opgeteld tot een cijfer, geven samen een gevaarlijk
     gevoel. 42 van 42 bevoegdheden bewezen en 3 van 42 terugwegen beproefd zijn
     geen 53%.

     De proef kijkt naar de BRON en niet naar het register, want het gevaar is
     dat iemand het percentage er later bij rekent -- en dan staat het er nog
     niet in het ingecheckte register. */
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts/gelddekking.js'), 'utf8');
  const verdacht = bron.match(/\b(dekkingsPercentage|coveragePct|totaalScore|dekkingScore)\b/);
  assert.equal(verdacht, null, 'er is een samengesteld dekkingscijfer bijgekomen: ' + verdacht);
  const reg = lees('GELDDEKKING.json');
  for (const sleutel of Object.keys(reg.gemeten))
    assert.ok(!/pct|percentage|score/i.test(sleutel),
      'de as "' + sleutel + '" ziet eruit als een samengesteld cijfer');
});

test('wat niet gemeten is, staat er als reden en niet als nul', () => {
  const r = lees('GELDDEKKING.json');
  /* Crash-herstel en externe settlement BESTAAN niet als meting in dit huis. Een
     0 op die plek zou lezen als een gemeten nul -- het tegenovergestelde van wat
     hij is. Ze horen dus in nietGemeten te staan, met tekst. */
  for (const as of ['crashHerstel', 'externeSettlement']) {
    assert.ok(typeof r.nietGemeten[as] === 'string' && r.nietGemeten[as].length > 40,
      as + ' hoort in nietGemeten te staan met een reden die uitlegt waarom er geen ' +
      'getal is. Verdwijnt hij daar, controleer dan of er een METING voor in de plaats ' +
      'kwam -- en niet een nul.');
    assert.equal(r.gemeten[as], undefined, as + ' hoort geen getal in `gemeten` te hebben');
    assert.equal(r.ratel[as], undefined, as + ' hoort geen rateltand te hebben zonder meting');
  }
});

test('de vier tanden staan ook echt in de norm en in het meetregister', () => {
  /* Zonder deze toets kan iemand de tanden uit scripts/norm.js halen terwijl dit
     register blijft bestaan: de meter draait dan nog, bewaakt niets meer, en
     ziet er ongewijzigd uit. */
  const norm = fs.readFileSync(path.join(WORTEL, 'scripts/norm.js'), 'utf8');
  const r = lees('GELDDEKKING.json');
  for (const sleutel of Object.keys(r.ratel))
    assert.ok(norm.includes("sleutel: '" + sleutel + "'"),
      sleutel + ' staat in GELDDEKKING.json maar is geen rateltand in scripts/norm.js');
  const { REGISTER } = require('../scripts/lib/metingen.js');
  const regel = REGISTER['GELDDEKKING.json'];
  assert.ok(regel && Array.isArray(regel.meter), 'GELDDEKKING.json hoort in scripts/lib/metingen.js te staan');
  for (const sleutel of Object.keys(r.ratel))
    assert.ok(regel.meter.includes(sleutel), sleutel + ' ontbreekt in de meterlijst van metingen.js');
});

/* ============ DE REKENSOM ZELF, met verzonnen invoer ============
   De toetsen hierboven lezen het INGECHECKTE register. Dat vindt een verslapping
   in de uitkomst, maar nooit een fout in de rekensom die hem maakte -- en de
   mutatiemotor zag dat onmiddellijk: hij vond geen enkele bruikbare mutatie,
   want er was geen module die deze toets werkelijk uitvoert.

   Daarom draait het onderstaande `bouw()` met een kleine, volledig verzonnen
   wereld waarin elke as precies EEN afwijker heeft. Verandert iemand een
   vergelijking in scripts/gelddekking.js, dan verschuift precies een van deze
   vier getallen. */
const { bouw } = require('../scripts/gelddekking.js');

const WERELD = {
  kaart: { as1Kaart: { geldroutes: [
    { methode: 'POST', pad: '/api/a', rol: 'member', collecties: ['paySaldi'], idempotentie: 'beschermd' },
    { methode: 'POST', pad: '/api/b', rol: 'member', collecties: ['paySaldi'], idempotentie: 'beschermd' },
    { methode: 'POST', pad: '/api/c', rol: 'member', collecties: ['paySaldi'], idempotentie: 'ongemeten' },
    { methode: 'POST', pad: '/api/d', rol: 'member', collecties: ['paySaldi'], idempotentie: 'beschermd' }
  ] } },
  contract: { rijen: [
    { route: 'POST /api/a', semantiek: { klasse: 'idempotent' }, toegang: { waargenomen: 'AUTHENTICATED' }, stand: 'PROTECTED' },
    { route: 'POST /api/b', semantiek: { klasse: 'onbekend' }, toegang: { waargenomen: 'AUTHENTICATED' }, stand: 'PROTECTED' },
    { route: 'POST /api/c', semantiek: { klasse: 'idempotent' }, toegang: { waargenomen: 'PUBLIC' }, stand: 'PROTECTED' }
    /* /api/d staat er met opzet NIET in: dat is de vierde vorm -- een geldroute
       die het mutatiecontract niet kent. */
  ] },
  herstelproef: { per: [
    { heen: '/api/a', uitslag: 'exact' },
    { heen: '/api/b', uitslag: 'compensatie' },
    { heen: '/api/c', uitslag: 'geen-herstel' }
  ] }
};

test('bouw(): elke as telt wat hij belooft, op verzonnen invoer', () => {
  const r = bouw(WERELD);
  assert.equal(r.gemeten.geldroutes, 4);
  assert.equal(r.gemeten.inMutatiecontract, 3, '/api/d staat niet in het contract');
  assert.equal(r.ratel.geldRoutesPubliek, 1, 'alleen /api/c is PUBLIC');
  assert.equal(r.ratel.geldRoutesZonderSemantiek, 2, '/api/b is onbekend en /api/d ontbreekt');
  assert.equal(r.ratel.geldRoutesZonderIdemBewijs, 1, 'alleen /api/c is ongemeten');
  assert.equal(r.ratel.geldRoutesZonderTerugweg, 2, '/api/c is geen-herstel, /api/d is niet beproefd');
});

test('bouw(): een ontbrekende rij is `null` en nooit stilzwijgend "in orde"', () => {
  const r = bouw(WERELD);
  const d = r.rijen.find(x => x.pad === '/api/d');
  assert.equal(d.semantiek, null, 'geen rij in het contract betekent null, niet "idempotent"');
  assert.equal(d.toegang, null);
  /* En null telt mee als ONTBREKEND en niet als goed: anders zou een route die
     uit het mutatiecontract valt de dekking omhoog duwen. */
  assert.ok(r.ratel.geldRoutesZonderSemantiek >= 1);
});

test('bouw(): zonder bronnen komt er een KLACHT en geen lege nul', () => {
  const r = bouw({ kaart: null, contract: null, herstelproef: null });
  assert.equal(r.gemeten.geldroutes, 0);
  assert.equal(r.klachten.length, 3, 'elke ontbrekende bron hoort zichzelf te melden');
  /* De CLI zakt hierop (zie het einde van scripts/gelddekking.js). Zonder die
     klacht zou een register met nul routes eruitzien als een schoon huis. */
});
