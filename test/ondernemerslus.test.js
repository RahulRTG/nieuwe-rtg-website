/* DE ONDERNEMERSLUS -- de ratel onder ONDERNEMERSLUS.json.

   Het register beantwoordt de dragende vraag van ONDERNEMEN.md: draagt de
   ondernemerslus EEN onderwerp, of is hij een reis langs losse deuren. Zonder
   toets is dat een momentopname die stil de verkeerde kant op kan lopen, en dan
   staat er over een half jaar een getal in een document dat niemand meer
   naloopt.

   DRIE SOORTEN TOETS, EN DE DERDE IS DE BELANGRIJKSTE.

   1-3  de RATELS. `zaakZietOnderneming` mag alleen omhoog, `stationsZonderRoute`
        en `ketensZonderProef` alleen omlaag. Drie tanden die verschillende
        kanten op staan: de eerste is een brug die gebouwd moet worden, de andere
        twee zijn schulden die betaald moeten worden.

   4    het register is VERS. Een register dat niet is hergedraaid, is een
        bewering over het verleden -- die les kostte dit huis zeven "gezakte"
        routes die allang gerepareerd waren (KANTOORMACHT.md).

   5-8  de BESTURINGSPROEF. Een instrument dat niet kan uitslaan is geen
        instrument. Toets 5 laat de meter zijn onderwerp kwijtraken en eist dat
        hij GOOIT; toets 6 en 7 laten een zaak-bestand de onderneming noemen en
        eisen dat het kopgetal beweegt. Zonder die drie kan deze hele meter
        stilvallen terwijl alle andere toetsen groen blijven -- en dat is precies
        hoe de eerste versie van dit script zijn eigen blindheid als bevinding
        rapporteerde.

        ZES EN ZEVEN ZIJN NIET DEZELFDE PROEF. De onderwerp-as heeft twee
        helften: de COLLECTIENAAM (toets 6) en de TOEGANGEN die het object
        teruggeven (toets 7). Die tweede helft is er later bij gekomen, juist
        omdat de eerste versie de architectuurvorm niet zag -- een route hoort
        `ondernemingVanZaak` aan te roepen en de collectie NIET aan te raken.
        Een besturingsproef op alleen de collectienaam zou groen blijven terwijl
        precies die helft stilvalt, en dan is de meter weer blind op de enige
        plek waar het kopgetal vandaan moet komen.

        EN ACHT IS DE TEGENPROEF VAN ZES EN ZEVEN. Die twee eisen dat het
        kopgetal BEWEEGT; acht eist dat het STIL blijft wanneer de naam alleen in
        een commentaarregel staat. Zonder die derde kan de meter het getal laten
        stijgen op een zin die niemand uitvoert -- en juist bij een ratel is dat
        erger dan een te laag getal: dan meldt hij vooruitgang waar niets is
        gebouwd.

   Draai los: node --test test/ondernemerslus.test.js
   De meting:  npm run ondernemerslus */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'ONDERNEMERSLUS.json');
const INDEX = path.join(WORTEL, 'server', 'kern', 'onderneming', 'index.js');
const PROEFBESTAND = path.join(WORTEL, 'server', 'routes', 'supplier', '__lusproef.js');
const PROEFBESTAND_TOEGANG = path.join(WORTEL, 'server', 'routes', 'supplier', '__lusproef-toegang.js');

/* De meter wordt per toets VERS geladen. Hij leest bestanden van schijf bij het
   aanroepen van meet(), maar require-cache zou een eerdere uitslag vasthouden en
   dan toetst 5 en 6 niets. */
function versMeten() {
  delete require.cache[require.resolve('../scripts/ondernemerslus.js')];
  return require('../scripts/ondernemerslus.js');
}

const vast = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));

test('1. zaakZietOnderneming mag alleen omhoog -- de brug wordt niet afgebroken', () => {
  const nu = versMeten().meet();
  assert.ok(nu.telling.zaakZietOnderneming >= vast.telling.zaakZietOnderneming,
    'zaakZietOnderneming zakte van ' + vast.telling.zaakZietOnderneming + ' naar ' +
    nu.telling.zaakZietOnderneming + '. Dat betekent dat de werkvloer het ondernemingsobject MINDER ' +
    'kent dan hiervoor; de lus loopt dan verder uiteen in plaats van dichter naar elkaar. Repareer de ' +
    'verwijzing, of leg in ONDERNEMEN.md uit waarom hij weg mocht.');
});

test('2. stationsZonderRoute mag alleen omlaag', () => {
  const nu = versMeten().meet();
  assert.ok(nu.telling.stations - nu.telling.stationsMetRoute <= vast.telling.stations - vast.telling.stationsMetRoute,
    'er zijn stations van de lus BIJGEKOMEN waarvoor geen enkele route bestaat. Een station zonder ' +
    'route is een fase waarin een ondernemer niets kan doen.');
});

test('3. ketensZonderProef mag alleen omlaag', () => {
  const nu = versMeten().meet();
  assert.ok(nu.telling.ketensZonderProef <= vast.telling.ketensZonderProef,
    'ketensZonderProef steeg van ' + vast.telling.ketensZonderProef + ' naar ' +
    nu.telling.ketensZonderProef + '. Een keten die zijn proef verliest, is een belofte zonder bewijs. ' +
    'LET OP: dit getal komt uit ONDERNEMERBEWIJS.json -- staat dat register stil, dan meet deze toets ' +
    'het verleden en niet de code.');
});

test('4. het vastgelegde register komt overeen met een VERSE meting', () => {
  const nu = versMeten().meet();
  for (const sleutel of ['stations', 'stationsMetRoute', 'zaakZietOnderneming', 'ketensZonderProef', 'deurwissels'])
    assert.equal(nu.telling[sleutel], vast.telling[sleutel],
      'ONDERNEMERSLUS.json loopt achter op de code (' + sleutel + '): vastgelegd ' + vast.telling[sleutel] +
      ', vers gemeten ' + nu.telling[sleutel] + '. Draai `npm run ondernemerslus:vast`. Een register dat ' +
      'niet is hergedraaid, is een bewering over het verleden.');
});

test('5. BESTURINGSPROEF: raakt de meter zijn onderwerp kwijt, dan GOOIT hij', () => {
  const origineel = fs.readFileSync(INDEX, 'utf8');
  assert.ok(origineel.includes("bezit: { ondernemingen: 'lijst' }"),
    'de vorm waarop deze proef steunt staat niet meer in kern/onderneming/index.js; pas de proef aan ' +
    'in plaats van hem te laten slagen op niets');
  try {
    fs.writeFileSync(INDEX, origineel.replace("bezit: { ondernemingen: 'lijst' }", "bezit: { ondernemingenXX: 'lijst' }"));
    assert.throws(() => versMeten().meet(), /hernoemd|komt niet voor/,
      'de meter las een hernoemde collectie zonder te klagen. Dan meldt hij 0 kenners, en dat leest als ' +
      'de duurste bevinding die hij kan doen terwijl er niets aan de hand is.');
  } finally {
    fs.writeFileSync(INDEX, origineel);
  }
});

test('6. BESTURINGSPROEF: een zaak-bestand dat de onderneming noemt, beweegt het kopgetal', () => {
  const voor = versMeten().meet().telling.zaakZietOnderneming;
  try {
    fs.writeFileSync(PROEFBESTAND, '/* tijdelijke besturingsproef */\nconst x = db.data.ondernemingen;\n');
    const na = versMeten().meet().telling.zaakZietOnderneming;
    assert.equal(na, voor + 1,
      'het kopgetal bewoog niet toen een bestand onder routes/supplier de collectie noemde. Dan meet ' +
      'deze meter niets en staat hij op nul omdat hij blind is, niet omdat de brug ontbreekt.');
  } finally {
    if (fs.existsSync(PROEFBESTAND)) fs.unlinkSync(PROEFBESTAND);
  }
});

test('7. BESTURINGSPROEF: een zaak-bestand dat een TOEGANG aanroept, beweegt het kopgetal ook', () => {
  /* De naam wordt uit de module GELEZEN en niet overgetypt: staat hij hier vast
     en wordt hij ginds hernoemd, dan schrijft deze proef een dood woord en
     slaagt hij op niets. */
  const index = fs.readFileSync(INDEX, 'utf8');
  const toegang = (index.match(/\bondernemingVanZaak\b/) || [])[0];
  assert.ok(toegang,
    'kern/onderneming/index.js exporteert geen ondernemingVanZaak meer; pas deze proef aan in plaats ' +
    'van hem te laten slagen op een naam die nergens meer bestaat');

  const voor = versMeten().meet().telling.zaakZietOnderneming;
  try {
    fs.writeFileSync(PROEFBESTAND_TOEGANG,
      '/* tijdelijke besturingsproef */\nconst o = kern.' + toegang + '(code);\n');
    const na = versMeten().meet().telling.zaakZietOnderneming;
    assert.equal(na, voor + 1,
      'het kopgetal bewoog niet toen een bestand onder routes/supplier een toegang van kern/onderneming ' +
      'aanriep. Dan telt de onderwerp-as alleen nog de collectienaam, en meet hij juist de vorm NIET die ' +
      'de brug hoort te hebben -- de meter meldt dan een gat dat er niet is.');
  } finally {
    if (fs.existsSync(PROEFBESTAND_TOEGANG)) fs.unlinkSync(PROEFBESTAND_TOEGANG);
  }
});

test('8. BESTURINGSPROEF: een naam die alleen in COMMENTAAR staat, beweegt het kopgetal NIET', () => {
  const voor = versMeten().meet().telling.zaakZietOnderneming;
  try {
    /* Twee vormen, want een wringer die er maar een kent is een halve wringer:
       een blokcommentaar, een regelcommentaar en een tekenreeks. Precies de
       vorm waarin server/lib/mutatiecontracten-zaakkant.js de handler citeert --
       daar kwam deze proef vandaan. */
    fs.writeFileSync(PROEFBESTAND,
      '/* tijdelijke besturingsproef: db.data.ondernemingen wordt hier alleen GENOEMD */\n' +
      '// ook ondernemingVanZaak staat hier alleen in een uitleg\n' +
      "const uitleg = 'roept ondernemingAchterZaak aan';\n");
    const na = versMeten().meet().telling.zaakZietOnderneming;
    assert.equal(na, voor,
      'het kopgetal steeg door een bestand dat de onderneming alleen NOEMT. Dan kan deze ratel worden ' +
      'gehaald met een commentaarregel, en meldt hij vooruitgang waar niets is gebouwd -- dezelfde fout ' +
      'die scripts/grenzen.js noteert als al drie keer gemaakt in een meter van dit huis.');
  } finally {
    if (fs.existsSync(PROEFBESTAND)) fs.unlinkSync(PROEFBESTAND);
  }
});
