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
  const r = bouw({ kaart: null, contract: null, herstelproef: null, herstelbesluit: null });
  assert.equal(r.gemeten.geldroutes, 0);
  /* VIER bronnen, vier klachten. Dit getal staat er hard en niet als `>= 1`:
     komt er een bron bij zonder dat hij zichzelf meldt, dan hoort deze toets te
     zakken -- precies wat er gebeurde toen HERSTELBESLUIT.json erbij kwam. */
  assert.equal(r.klachten.length, 4, 'elke ontbrekende bron hoort zichzelf te melden');
  /* De CLI zakt hierop (zie het einde van scripts/gelddekking.js). Zonder die
     klacht zou een register met nul routes eruitzien als een schoon huis. */
});

/* ============ HET CORRECTIEMODEL (HERSTELBESLUIT.json) ============
   De vraag is niet "heeft iedere actie een undo?" maar "draagt iedere
   waardeactie een expliciet fout-/correctiemodel?". Sommige handelingen horen
   bewust FINAL te zijn; wat niet mag is dat niemand het heeft opgeschreven. */

test('elke route draagt een correctiemodel uit de gesloten lijst', () => {
  const r = lees('GELDDEKKING.json');
  const besluit = lees('HERSTELBESLUIT.json');
  const toegestaan = new Set(Object.keys(besluit.klassen));
  assert.ok(toegestaan.has('UNKNOWN'), 'UNKNOWN hoort de eerlijke restklasse te zijn');
  for (const rij of r.rijen)
    assert.ok(toegestaan.has(rij.herstelKlasse),
      rij.pad + ' draagt klasse "' + rij.herstelKlasse + '", die niet in HERSTELBESLUIT.json staat');
});

test('de verklaring wordt NOOIT uit de meting afgeleid', () => {
  /* Dit is de grens van het hele register (MUTATIECONTRACT.md: een stand wordt
     nooit afgeleid uit bewijs). Zou gelddekking.js een gemeten `exact` stil als
     REVERSIBLE verklaren, dan zou deze toets zakken -- en dan bewijst het
     register alleen nog dat de meting bestaat. */
  const r = lees('GELDDEKKING.json');
  const besluit = lees('HERSTELBESLUIT.json');
  for (const rij of r.rijen) {
    if (besluit.routes[rij.pad]) continue;       // wel verklaard: mag alles zijn
    assert.equal(rij.herstelKlasse, 'UNKNOWN',
      rij.pad + ' staat niet in HERSTELBESLUIT.json maar draagt toch klasse "' +
      rij.herstelKlasse + '". Een verklaring die uit de meting is afgeleid, is geen verklaring.');
  }
});

test('een verklaring die de meting tegenspreekt, wordt gemeld', () => {
  /* Beide richtingen nagetrokken met een mutatie op het register:
       FINAL naast een gemeten `exact`        -> de route is wel degelijk terug te draaien
       NOT_APPLICABLE op een kernbak-route    -> hij raakt wel degelijk een saldo
     Zie de commit; hier staat de uitkomst vast zodat de detectie niet stil kan
     verdwijnen. */
  const { bouw } = require('../scripts/gelddekking.js');
  const w = {
    kaart: { as1Kaart: { geldroutes: [
      { methode: 'POST', pad: '/api/x', rol: 'member', collecties: ['bankPassen'], idempotentie: 'beschermd' },
      { methode: 'POST', pad: '/api/y', rol: 'member', collecties: ['paySaldi'], idempotentie: 'beschermd' }
    ] } },
    contract: { rijen: [
      { route: 'POST /api/x', semantiek: { klasse: 'idempotent' }, toegang: { waargenomen: 'AUTHENTICATED' } },
      { route: 'POST /api/y', semantiek: { klasse: 'idempotent' }, toegang: { waargenomen: 'AUTHENTICATED' } }
    ] },
    herstelproef: { per: [{ heen: '/api/x', uitslag: 'exact' }] },
    herstelbesluit: { routes: {
      '/api/x': { klasse: 'FINAL' },
      '/api/y': { klasse: 'NOT_APPLICABLE' }
    } }
  };
  const r = bouw(w);
  assert.equal(r.ratel.geldRoutesHerstelTegenspraak, 2, 'beide tegenspraken horen gezien te worden');
  assert.ok(r.tegenspraken.some(t => t.pad === '/api/x' && /FINAL/.test(t.wat)));
  assert.ok(r.tegenspraken.some(t => t.pad === '/api/y' && /NOT_APPLICABLE/.test(t.wat)));
  /* En zonder die verklaringen is er GEEN tegenspraak -- anders zou de melding
     ontstaan door de meting alleen, en dat zou hem waardeloos maken. */
  const schoon = bouw({ ...w, herstelbesluit: { routes: {} } });
  assert.equal(schoon.ratel.geldRoutesHerstelTegenspraak, 0);
  assert.equal(schoon.ratel.geldRoutesHerstelOnbesloten, 2);
});

/* ============ DE VIJFDELING PER AS ============
   Een kale teller ("32/42 bewezen") vertelt niet WAAROM de rest ontbreekt, en
   dat verschil is hier groot: van de tien onbewezen idempotentiepaden faalde er
   geen enkele -- ze zijn allemaal geblokkeerd op een ontbrekende testwereld.
   "10 ontbreken" en "10 geblokkeerd, 0 gefaald" zijn twee andere verhalen. */

test('elke as telt op tot het aantal routes, en meldt alleen standen die zij KAN geven', () => {
  const r = lees('GELDDEKKING.json');
  const N = r.gemeten.geldroutes;
  for (const [naam, a] of Object.entries(r.assen)) {
    assert.ok(Array.isArray(a.kan) && a.kan.length, naam + ' verklaart geen standen');
    const som = Object.values(a.telling).reduce((s, v) => s + v, 0);
    assert.equal(som, N, naam + ' telt op tot ' + som + ' en niet tot ' + N +
      ' -- een route die in geen enkele stand valt, verdwijnt uit de meting');
    for (const stand of Object.keys(a.telling))
      assert.ok(a.kan.includes(stand), naam + ' meldt stand ' + stand + ' die niet in `kan` staat');
  }
});

test('een as die een stand nooit kan bereiken, meldt hem ook niet als nul', () => {
  /* Dit is de reden dat `kan` bestaat. Een as die FAILED altijd op nul houdt
     omdat er geen weg is om te falen, geeft een nul die niets betekent -- en dat
     is precies de geruststelling zonder grond die deze meter moet uitsluiten.
     SEMANTIEK en CORRECTIEMODEL kunnen niet falen: een verklaring ontbreekt of
     is er, maar mislukt niet. */
  const r = lees('GELDDEKKING.json');
  assert.ok(!r.assen.semantiek.kan.includes('FAILED'),
    'semantiek kan niet falen; een FAILED-nul daar is betekenisloos');
  assert.ok(!r.assen.correctiemodel.kan.includes('FAILED'),
    'een correctiemodel kan ontbreken of FINAL zijn, maar niet falen');
  assert.ok(r.assen.bevoegdheid.kan.includes('FAILED'),
    'bevoegdheid KAN falen -- een publieke geldroute is een echte FAILED');
  assert.ok(r.assen.idempotentie.kan.includes('BLOCKED'),
    'idempotentie moet BLOCKED van UNKNOWN kunnen onderscheiden');
});

test('idempotentie onderscheidt geblokkeerd van onbewezen', () => {
  const r = lees('GELDDEKKING.json');
  const a = r.assen.idempotentie;
  /* De harde uitspraak van vandaag: geen enkele geldroute FAALT op idempotentie.
     Zakt dit, dan is er een route die bij een tweede aanroep met dezelfde sleutel
     een tweede economisch effect veroorzaakt -- en dat is de ernstigste bevinding
     die deze meter kan doen. */
  assert.equal(a.telling.FAILED, 0,
    'een geldroute veroorzaakt een DUBBEL economisch effect bij herhaling. Dit is ' +
    'geen ontbrekend bewijs maar een gemeten fout.');
  assert.equal(a.telling.UNKNOWN, 0,
    'een geldroute is onbewezen zonder dat iemand weet waarom. Elke onbewezen route ' +
    'hoort een REDEN te dragen (BLOCKED of NOT_APPLICABLE), anders is de meting stil.');
});

test('bouw(): de vijfdeling verschuift mee met de invoer', () => {
  /* Zonder deze proef zou de vijfdeling een vaste tabel kunnen zijn die toevallig
     bij de huidige data past. */
  const { bouw } = require('../scripts/gelddekking.js');
  const w = {
    kaart: { as1Kaart: { geldroutes: [
      { methode: 'POST', pad: '/api/a', collecties: ['paySaldi'], idempotentie: 'beschermd' },
      { methode: 'POST', pad: '/api/b', collecties: ['paySaldi'], idempotentie: 'ongemeten' },
      { methode: 'POST', pad: '/api/c', collecties: ['paySaldi'], idempotentie: 'onbeschermd' }
    ] } },
    contract: { rijen: [
      { route: 'POST /api/a', semantiek: { klasse: 'idempotent' }, toegang: { waargenomen: 'AUTHENTICATED' }, stand: 'PROTECTED' },
      { route: 'POST /api/b', semantiek: { klasse: 'onbekend' }, toegang: { waargenomen: 'PUBLIC' }, stand: 'BLOCKED_BY_TEST_FIXTURE' },
      { route: 'POST /api/c', semantiek: { klasse: 'idempotent' }, toegang: { waargenomen: 'AUTHENTICATED' }, stand: 'PROTECTED' }
    ] },
    herstelproef: { per: [] }, herstelbesluit: { routes: {} }
  };
  const r = bouw(w);
  assert.equal(r.assen.idempotentie.telling.PROVEN, 1);
  assert.equal(r.assen.idempotentie.telling.BLOCKED, 1, '/api/b is geblokkeerd, niet onbekend');
  assert.equal(r.assen.idempotentie.telling.FAILED, 1, '/api/c is gemeten onbeschermd: een echte FAILED');
  assert.equal(r.assen.bevoegdheid.telling.FAILED, 1, '/api/b is publiek');
  assert.equal(r.assen.semantiek.telling.UNKNOWN, 1);
});
