/* DE TWEE ASSEN DIE NOOIT EEN INSTRUMENT HADDEN.

   Draai los: node --experimental-sqlite --test test/outputaudit.test.js

   OUTPUT en AUDIT stonden voor ALLE 4185 routes op ongemeten -- samen 8370
   cellen, ruim een kwart van de hele matrix. Niet omdat iemand vergat te meten,
   maar omdat er niets bestond dat het mat. Beide antwoorden bleken dichterbij
   dan de reden in de matrix suggereerde:

     OUTPUT  het bewijs lag al in MUTATIES.json, maar per TOETSBESTAND. Wat
             ontbrak was de koppeling route -> toets, en die schrijft
             server/routelog.js nu als TOETS-regel.
     AUDIT   de reden zei "een hashketen bestaat nog niet". Achterhaald: die
             bestaat (server/lib/keten.js, in bedrijf). Wat ontbrak was de vraag
             ervoor -- welke route schrijft er eigenlijk in.

   WAT HIER WORDT VASTGEHOUDEN, en het is bijna allemaal een grens:

   1. EEN JOURNAALREGEL DIE GEEN ROUTE IS, MAG DE DEKKINGSPOORT NIET RAKEN. Dit
      ging bij beide assen echt mis: `TOETS GET /api/x foo.js` kwam binnen als
      sleutel die op geen enkele route past, dus als VREEMD PATROON. Zes valse
      vreemden op twaalf regels, en met AUDIT erbij twaalf op achttien -- genoeg
      om de 100%-poort te laten zakken op zijn eigen meetgegevens.

   2. ALLEEN TOEREKENBARE GEVOELIGHEID IS BEWIJS. Een inhoudgevoelige toets die
      tien routes raakt, kan op de inhoud van een van die tien zijn gezakt.

   3. WISSELEND IS GEEN BEWIJS. Een route die soms wel en soms geen spoor
      nalaat, heeft "laat een spoor na" niet als eigenschap.

   DE MUTATIES (LAT.md regel 2). Drie gedaan; EEN beet, twee niet -- en dat was
   de nuttigste uitkomst van dit hele stuk.

     TOETS uit de filter in kern/routedekking.js halen -> toets 1 zakt

     de toerekening laten vallen                       -> BEET EERST NIET
     'wisselend' als bewezen laten tellen              -> BEET EERST NIET

   Beide oordelen zaten binnen een meet() die een journaalbestand en MUTATIES.json
   van schijf leest. Een toets kon ze dus alleen NABOUWEN, en een toets die zijn
   eigen kopie van de regel controleert kan per definitie niet zakken als het
   instrument verandert (LAT.md regel 9). De suite bleef vrolijk groen terwijl ik
   de toerekening weghaalde -- precies de fout die dit bestand moet bewaken.

   De reparatie zat in de VORM van de instrumenten en niet in de toetsen: het
   oordeel is nu een pure functie (outputproef.oordeel, auditproef.oordeelUit)
   die zijn ingangen als argument neemt. Een module die alleen te toetsen is door
   hem na te bouwen, is verkeerd geknipt. Daarna beten beide mutaties zoals het
   hoort. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const rd = require('../server/kern/routedekking');
const sporen = require('../server/kern/auditsporen');
const fs = require('fs');
const path = require('path');

test('1. TOETS- en AUDIT-regels tellen niet mee als aangeraakte routes', () => {
  const journaal = [
    'POST /api/echt',
    'TOETS POST /api/echt iets.test.js',
    'AUDIT POST /api/echt securityLog',
    'SCHERM /apps/x.html iets.test.js navigatie'
  ].join('\n');
  const geraakt = rd.geraaktUit(journaal);
  assert.deepEqual([...geraakt], ['POST /api/echt'],
    'alleen de echte routeregel telt; de andere drie dragen een andere meting en zouden ' +
    'als VREEMD PATROON de dekkingspoort laten zakken op zijn eigen meetgegevens');

  /* En de omkering: ze mogen ook niet stilletjes als route MEETELLEN. */
  const m = rd.meet([{ pad: '/api/echt', methoden: ['POST'] }], journaal);
  assert.equal(m.totaal, 1);
  assert.equal(m.geraakt, 1);
  assert.deepEqual(m.vreemd, [], 'geen enkele meetregel mag als drift gelden');
});

test('2. OUTPUT: gevoeligheid telt alleen als ze toe te rekenen is', () => {
  /* Dit riep eerst het instrument NIET aan maar bouwde de regel na, en toen
     bleef de suite groen terwijl ik de toerekening weghaalde. Nu gaat hij door
     oordeel() heen: dezelfde functie die de echte ronde gebruikt. */
  const { oordeel } = require('../scripts/outputproef');
  /* DE FIXTURE MOET GROOT GENOEG ZIJN OM DE INFRASTRUCTUURREGEL TE OVERLEVEN.
     Die regel noemt een route infrastructuur als MEER DAN DE HELFT van alle
     toetsbestanden hem raakt. Met drie bestanden in de fixture haalde een route
     die er twee raakt die drempel al, viel hij als infrastructuur weg, en zakte
     deze toets op iets wat in de echte suite (540 bestanden) niet gebeurt. Acht
     vulbestanden zetten de drempel op een realistische hoogte. */
  const perToets = new Map([
    ['smal.test.js', new Set(['POST /api/een'])],
    ['breed.test.js', new Set(['POST /api/een', 'POST /api/twee', 'POST /api/drie'])],
    ['blind.test.js', new Set(['POST /api/drie'])]
  ]);
  for (let i = 0; i < 8; i++) perToets.set('vul' + i + '.test.js', new Set(['GET /api/health']));
  const perRoute = new Map([
    ['POST /api/een', new Set(['smal.test.js', 'breed.test.js'])],
    ['POST /api/twee', new Set(['breed.test.js'])],
    ['POST /api/drie', new Set(['blind.test.js'])]
  ]);
  const uit = oordeel(perRoute, perToets,
    new Set(['smal.test.js', 'breed.test.js']), new Set(['blind.test.js']));

  assert.equal(uit.perRoute['POST /api/een'].staat, 'bewezen',
    'smal.test.js is inhoudgevoelig en raakt alleen deze route');
  assert.equal(uit.perRoute['POST /api/twee'].staat, 'onbeslist',
    'breed.test.js is gevoelig maar raakt er drie; op welke inhoud hij zakt is niet te zeggen');
  assert.match(uit.perRoute['POST /api/twee'].reden, /niet aan deze route toe te schrijven/);
  assert.equal(uit.perRoute['POST /api/drie'].staat, 'blind',
    'alleen een toets die niets van de inhoud merkt');

  /* En een GERICHTE meting slaat de toerekening over: daar is over die ene route
     gelogen en gekeken wie het merkte. Dat is waarneming en geen afleiding. */
  const gericht = oordeel(perRoute, perToets, new Set(['breed.test.js']), new Set(),
    { 'POST /api/twee': { toets: 'breed.test.js', merkt: true } });
  assert.equal(gericht.perRoute['POST /api/twee'].staat, 'bewezen');
  assert.match(gericht.perRoute['POST /api/twee'].reden, /over DEZE route gelogen/);

    assert.deepEqual(uit.telling, { bewezen: 1, onbeslist: 1, blind: 1, ongemeten: 0 });
});

test('3. AUDIT: de sporenlijst is benoemd, en groei is de enige maat', () => {
  assert.ok(sporen.NAMEN.length >= 5, 'er is een benoemde lijst journalen');
  for (const [naam, wat] of sporen.SPOREN) {
    assert.ok(naam && wat && wat.length > 15,
      naam + ' staat op de sporenlijst zonder te zeggen wat het journaal vastlegt');
  }
  /* Alleen GROEI telt. Een journaal dat KRIMPT is geen spoor dat wordt
     achtergelaten maar een spoor dat verdwijnt -- een heel andere bevinding, en
     die hoort bij de keten (server/lib/keten.js) en niet hier. */
  const voor = sporen.standVan({ securityLog: [1, 2, 3] });
  assert.deepEqual(sporen.gegroeid(voor, sporen.standVan({ securityLog: [1, 2, 3, 4] })), ['securityLog']);
  assert.deepEqual(sporen.gegroeid(voor, sporen.standVan({ securityLog: [1] })), [],
    'krimp is geen spoor');
  assert.deepEqual(sporen.gegroeid(voor, sporen.standVan({ securityLog: [1, 2, 3] })), []);

  /* En het OORDEEL zelf, door het instrument en niet nagebouwd. Ook dit toetste
     eerst zijn eigen kopie: 'wisselend' als bewezen laten tellen liet de suite
     groen. */
  const { oordeelUit } = require('../scripts/auditproef');
  const uit = oordeelUit(new Map([
    ['POST /api/altijd', new Set(['securityLog'])],
    ['POST /api/soms', new Set(['securityLog', 'geen'])],
    ['GET /api/nooit', new Set(['geen'])]
  ]));
  assert.equal(uit.perRoute['POST /api/altijd'].staat, 'bewezen');
  assert.equal(uit.perRoute['POST /api/soms'].staat, 'wisselend',
    'soms wel en soms geen spoor is geen eigenschap van de route, dus geen bewijs');
  assert.match(uit.perRoute['POST /api/soms'].reden, /hangt dus ergens van af/);

  /* DE UITKOMSTKLASSE VERFIJNT HET OORDEEL. 92 routes stonden op wisselend
     omdat de oude regel niet kon zeggen waar het 'geen' bij hoorde. Sinds de
     meting de klasse meeschrijft ('2xx|spoor', '4xx|geen') geldt: journaalt
     elke GESLAAGDE aanroep, dan is dat een eigenschap -- een weigering die
     niet journaalt is een keuze. Wisselt het ook BINNEN de geslaagde
     aanroepen, dan blijft het een bevinding. En zodra een route
     klasse-waarnemingen heeft, tellen alleen die: de oude vorm kan deze
     vraag niet beantwoorden. */
  const verfijnd = oordeelUit(new Map([
    ['POST /api/keurig', new Set(['2xx|securityLog', '4xx|geen'])],
    ['POST /api/echt-wispelturig', new Set(['2xx|securityLog', '2xx|geen', '4xx|geen'])],
    ['POST /api/alleen-weigering', new Set(['4xx|securityLog', '4xx|geen'])],
    ['POST /api/oud-en-nieuw', new Set(['geen', '2xx|securityLog'])]
  ]));
  assert.equal(verfijnd.perRoute['POST /api/keurig'].staat, 'bewezen',
    'elke geslaagde aanroep journaalt; de weigering zonder spoor is een keuze');
  assert.match(verfijnd.perRoute['POST /api/keurig'].reden, /GESLAAGDE/);
  assert.equal(verfijnd.perRoute['POST /api/echt-wispelturig'].staat, 'wisselend');
  assert.match(verfijnd.perRoute['POST /api/echt-wispelturig'].reden, /binnen de geslaagde/);
  assert.equal(verfijnd.perRoute['POST /api/alleen-weigering'].staat, 'wisselend',
    'alleen weigeringen gezien: over geslaagd werk valt niets te zeggen');
  assert.equal(verfijnd.perRoute['POST /api/oud-en-nieuw'].staat, 'bewezen',
    'de klasse-vorm wint van een oude waarneming zonder klasse');
  assert.equal(uit.perRoute['GET /api/nooit'].staat, 'geen spoor');
  assert.deepEqual(uit.telling, { bewezen: 1, verklaard: 0, wisselend: 1, 'geen spoor': 1 });
});

test('2b. een antwoord dat GELIJK is aan de leugen is geen dekkingsgat', () => {
  /* De laatste vijf blinde routes, nagelopen. Vier ervan antwoorden zelf al met
     200 {ok:true} -- precies waar de liegpoort een antwoord in verandert. Dan
     zegt "geen toets zakte" niets over de toetsen: er viel niets te merken. Dat
     is de rand van dit instrument en geen ontbrekende dekking, en het hoort ook
     zo in het register te staan (post output-onwaarneembaar in
     BEWIJSSCHULD.json).

     HET ONDERSCHEID DAT DEZE TOETS BEWAAKT is met schade geleerd. De vijfde was
     de boekhoud-export, en die stond op dezelfde hoop -- niet omdat er niets te
     zien viel, maar omdat de sonde van de inhoudskaart `r.json()` op een
     CSV-lichaam doet en dan niets ziet. Dat antwoord zit juist bomvol inhoud.
     Zou de outputproef alles wat de kaart onwaarneembaar noemt vrijstellen, dan
     had een leeggelopen boekhoud-export voor altijd buiten beeld gestaan. */
  const { grondVan, profielVan } = require('../scripts/inhoudskaart');
  assert.equal(grondVan(200, profielVan({ ok: true })), 'gelijk-aan-leugen');
  assert.equal(grondVan(200, profielVan({})), 'geen-json', 'een leeg profiel is geen kaal ok');
  assert.equal(grondVan(200, profielVan(null)), 'geen-json', 'een CSV komt hier als null binnen');
  assert.equal(grondVan(200, profielVan({ lijst: [1] })), null, 'gewoon waarneembaar');
  assert.equal(grondVan(403, profielVan({ error: 'nee' })), null, 'een weigering draagt inhoud');

  /* En de doorwerking in het oordeel, door het instrument zelf. De kaart op
     schijf is de bron; een route die er niet in staat blijft gewoon blind. */
  const { oordeel, onwaarneembareRoutes } = require('../scripts/outputproef');
  const stil = onwaarneembareRoutes();
  assert.ok(stil.size >= 1, 'de inhoudskaart draagt minstens een gemeten gelijk-aan-leugen-route');
  const echt = [...stil.keys()][0];

  const perToets = new Map([['t.test.js', new Set([echt, 'POST /api/verzonnen'])]]);
  for (let i = 0; i < 8; i++) perToets.set('vul' + i + '.test.js', new Set(['GET /api/health']));
  const perRoute = new Map([[echt, new Set(['t.test.js'])], ['POST /api/verzonnen', new Set(['t.test.js'])]]);
  const gemeten = {
    [echt]: { toets: 't.test.js', merkt: false },
    'POST /api/verzonnen': { toets: 't.test.js', merkt: false }
  };
  const uit = oordeel(perRoute, perToets, new Set(['t.test.js']), new Set(), gemeten);

  assert.equal(uit.perRoute[echt].staat, 'ongemeten', echt + ' is niet blind maar onmeetbaar');
  assert.equal(uit.perRoute[echt].bron, 'inhoudskaart', 'en de reden komt uit een METING, niet uit een lijst');
  assert.equal(uit.onwaarneembaar, 1, 'apart geteld, als onderverdeling van ongemeten');
  assert.equal(uit.perRoute['POST /api/verzonnen'].staat, 'blind',
    'een route die de kaart niet kent blijft blind: bij twijfel geen vrijstelling');

  /* GRENS: onwaarneembaar levert NOOIT bewijs op. Zou dit bewezen worden, dan
     kreeg de OUTPUT-as cellen waar niemand naar heeft gekeken. */
  assert.notEqual(uit.perRoute[echt].staat, 'bewezen');
  assert.equal(uit.telling.bewezen, 0);
});

test('4b. de VERKLAARD-kaart verplaatst wel, maar bewijst nooit', () => {
  /* De sluitweg van de schuldpost audit-wisselend was "uitzoeken WAARVAN het
     afhangt". Wat daaruit kwam staat als kaart in de bron van de auditproef.
     Zo'n kaart is gevaarlijk gereedschap -- hij kan een tapijt worden om een
     echt defect onder te vegen -- dus liggen de grenzen ervan hier vast en
     niet alleen in een commentaarblok. */
  const { oordeelUit, VERKLAARD } = require('../scripts/auditproef');
  const echt = Object.keys(VERKLAARD)[0];

  const uit = oordeelUit(new Map([
    [echt, new Set(['2xx|kantoorAudit', '2xx|geen'])],
    ['POST /api/onverklaard', new Set(['2xx|kantoorAudit', '2xx|geen'])]
  ]));
  assert.equal(uit.perRoute[echt].staat, 'verklaard');
  assert.ok(uit.perRoute[echt].verklaring, 'de verklaring staat NAAST de gemeten reden, niet in plaats van');
  assert.match(uit.perRoute[echt].reden, /hangt dus ergens van af/, 'de meting blijft leesbaar');
  assert.equal(uit.perRoute['POST /api/onverklaard'].staat, 'wisselend',
    'zonder verklaring blijft het gewoon een bevinding');

  /* GRENS 1: verklaard is geen bewijs. Zou dit ooit 'bewezen' worden, dan zou de
     bewijsmatrix er cellen op zetten die niemand heeft gemeten. */
  assert.notEqual(uit.perRoute[echt].staat, 'bewezen');
  assert.equal(uit.telling.bewezen, 0, 'een verklaring telt nooit mee als bewijs');
  assert.equal(uit.telling.verklaard, 1);

  /* GRENS 2: de kaart raakt 'geen spoor' niet aan. Zakt een verklaarde route af
     naar helemaal geen spoor, dan valt hij door en is dat zichtbaar. */
  const afgezakt = oordeelUit(new Map([[echt, new Set(['2xx|geen', '4xx|geen'])]]));
  assert.equal(afgezakt.perRoute[echt].staat, 'geen spoor',
    'een verklaring voor wisselend dekt geen route die helemaal stil is geworden');

  /* GRENS 3: een verklaring die nergens meer op slaat, wordt gemeld. */
  assert.ok(afgezakt.ongebruikteVerklaringen.includes(echt),
    'de afgezakte route hoort in de lijst met ongebruikte verklaringen te staan');
  assert.equal(uit.ongebruikteVerklaringen.includes(echt), false);

  /* En de kaart zelf: elke verklaring zegt iets, en zegt het over een route. */
  for (const [route, reden] of Object.entries(VERKLAARD)) {
    assert.match(route, /^(GET|POST|PUT|PATCH|DELETE) \/api\//, route + ' is geen route');
    assert.ok(String(reden).length > 80, route + ': "waarvan hangt het af" vraagt om meer dan een zin');
  }
});

test('5. een verse gerichte ronde telt METEEN mee, niet pas de volgende batch', () => {
  /* DE EEN-RONDE-ACHTERSTAND, en hij is echt gebeurd: een batch van 20 gerichte
     metingen (18 MERKT) schreef een register waarin `gericht` merkt zei en
     `perRoute` onbeslist -- meet() las de gerichte uitslagen van SCHIJF terwijl
     de verse pas NA meet() in het bestand belandden. Elke batch telde dus een
     ronde lang niet mee, en de bewijsmatrix erop ook niet. meet(versGericht)
     laat de aanroeper de verse uitslag meegeven; deze toets houdt vast dat die
     parameter echt wint van wat er op schijf ligt, via dezelfde pure oordeel()
     die meet() gebruikt. */
  const { oordeel } = require('../scripts/outputproef');
  const perRoute = new Map([['POST /api/vers', new Set(['breed.test.js'])]]);
  const perToets = new Map([['breed.test.js', new Set(['POST /api/vers', 'POST /api/ander'])]]);
  const gevoelig = new Set(['breed.test.js']);

  /* Zonder de verse meting: onbeslist (de toets raakt twee routes). */
  const zonder = oordeel(perRoute, perToets, gevoelig, new Set(), {});
  assert.equal(zonder.perRoute['POST /api/vers'].staat, 'onbeslist');

  /* Met de verse gerichte meting: direct bewijs, geen toerekening. */
  const met = oordeel(perRoute, perToets, gevoelig, new Set(),
    { 'POST /api/vers': { toets: 'breed.test.js', merkt: true, op: 'nu' } });
  assert.equal(met.perRoute['POST /api/vers'].staat, 'bewezen');
  assert.match(met.perRoute['POST /api/vers'].reden, /over DEZE route gelogen/);

  /* En een gerichte meting die niets merkte is BLIND, geen bewijs. */
  const blind = oordeel(perRoute, perToets, gevoelig, new Set(),
    { 'POST /api/vers': { toets: 'breed.test.js', merkt: false, op: 'nu' } });
  assert.equal(blind.perRoute['POST /api/vers'].staat, 'blind');

  /* BUITEN BEREIK VAN DE LIEGPOORT IS GEEN UITSLAG. De poort raakt alleen
     /api/-paden; over een pagina of bundel is de leugen wel aangezet maar
     nooit afgegaan, en toch stonden zulke routes op blind -- een meting die
     niet heeft gedraaid is geen slechte uitslag, maar een goede al helemaal
     niet (LAT.md regel 3 en 12). */
  for (const merkt of [true, false]) {
    const route = 'GET /apps/index.html';
    const pr = new Map([[route, new Set(['breed.test.js'])]]);
    const pt = new Map([['breed.test.js', new Set([route, 'POST /api/ander'])]]);
    const uit = oordeel(pr, pt, gevoelig, new Set(),
      { [route]: { toets: 'breed.test.js', merkt, op: 'nu' } });
    assert.equal(uit.perRoute[route].staat, 'ongemeten',
      route + ' met merkt=' + merkt + ' hoort ongemeten te zijn, niet ' + uit.perRoute[route].staat);
    assert.match(uit.perRoute[route].reden, /liegpoort/);
  }

  /* En de DEUREN: elke lie-run spaart ze (RTG_LIEG_NIET), dus ook daar is
     nooit echt gelogen en telt een oude uitspraak niet -- dezelfde valse
     meting als de padparameters, alleen via de spaarlijst. */
  for (const merkt of [true, false]) {
    const deur = 'POST /api/auth/forgot';
    const prD = new Map([[deur, new Set(['breed.test.js'])]]);
    const ptD = new Map([['breed.test.js', new Set([deur, 'POST /api/ander'])]]);
    const uitD = oordeel(prD, ptD, gevoelig, new Set(),
      { [deur]: { toets: 'breed.test.js', merkt, op: 'nu' } });
    assert.equal(uitD.perRoute[deur].staat, 'ongemeten',
      deur + ' met merkt=' + merkt + ' hoort ongemeten te zijn, niet ' + uitD.perRoute[deur].staat);
    assert.match(uitD.perRoute[deur].reden, /deur/);
  }

  /* En een PADPARAMETER-route doet sinds de vorm-matching gewoon mee: de
     liegpoort vertaalt /:code naar een segment-joker, dus daarover LIEGEN kan
     echt en het oordeel telt. De poort zelf wordt hieronder apart geijkt. */
  const par = 'GET /api/gezin/:code/mij';
  const prP = new Map([[par, new Set(['breed.test.js'])]]);
  const ptP = new Map([['breed.test.js', new Set([par, 'POST /api/ander'])]]);
  assert.equal(oordeel(prP, ptP, gevoelig, new Set(),
    { [par]: { toets: 'breed.test.js', merkt: true, op: 'nu' } }).perRoute[par].staat, 'bewezen');
});

test('7b. de liegpoort matcht een padparameter op vorm, per segment', () => {
  const { magLiegen } = require('../server/opzet/liegpoort');
  assert.equal(magLiegen('/api/gezin/ABC123/mij', '/api/gezin/:code/mij', ''), true,
    'een :segment staat voor precies een echt segment');
  assert.equal(magLiegen('/api/gezin/ABC123/extra/mij', '/api/gezin/:code/mij', ''), false,
    'twee segmenten passen niet in een joker');
  assert.equal(magLiegen('/api/gezin/ABC123', '/api/gezin/:code/mij', ''), false,
    'een korter pad matcht niet');
  assert.equal(magLiegen('/api/scim/v2/Users/u-1', '/api/scim/v2/Users/:id', ''), true);
  /* Het oude letterlijke gedrag blijft: een patroon zonder parameter is een
     voorvoegsel, en niet-/api/-paden liegen nooit. */
  assert.equal(magLiegen('/api/notities/mijn', '/api/notities', ''), true);
  assert.equal(magLiegen('/apps/index.html', '/apps/:pagina', ''), false);
});

test('6. de basislijn vervangt de controlerun zonder het oordeel te verzwakken', () => {
  /* DE SNELHEIDSWINST MAG HET BEWIJS NIET UITHOLLEN. De controlerun draaide per
     MERKT een tweede keer om te zien of de toets ook zonder leugen zakte -- voor
     de 194 routes van auth-rol.test.js was dat 194 keer dezelfde vraag. De
     basislijn stelt hem een keer. Deze toets houdt vast dat het ONDERSCHEID
     overeind blijft:

       toets groen in de basislijn + zakt onder leugen  -> merkt (toe te rekenen)
       toets NIET in de basislijn (was al rood)         -> stoornis, geen lie-run
       toets groen + groen onder leugen                 -> blind

     meetEen draait hier echt, tegen twee kleine wegwerptoetsen in de test/-map:
     een die altijd groen is en een die altijd rood is. Dat is de enige manier om
     te bewijzen dat de basislijn-tak doet wat de controlerun deed (LAT.md regel
     2 en 10). */
  const o = require('../scripts/outputproef');
  const groenBestand = path.join(__dirname, 'zz-basis-groen.test.js');
  const roodBestand = path.join(__dirname, 'zz-basis-rood.test.js');
  fs.writeFileSync(groenBestand,
    "const{test}=require('node:test');test('ok',()=>{});\n");
  fs.writeFileSync(roodBestand,
    "const{test}=require('node:test');const a=require('node:assert');test('rood',()=>{a.fail('altijd');});\n");
  try {
    /* Een toets die al rood is in de basislijn: stoornis, en zonder ook maar
       een lie-run (die zou zinloos zijn). */
    const rood = o.meetEen('POST /api/iets', 'zz-basis-rood.test.js', { basisGroen: new Set() });
    assert.equal(rood.staat, 'stoornis');

    /* Een groene toets die niets over de route beweert: liegen over een pad dat
       hij niet raakt laat hem groen -> blind. */
    const blind = o.meetEen('POST /api/bestaat-niet-in-deze-toets', 'zz-basis-groen.test.js',
      { basisGroen: new Set(['zz-basis-groen.test.js']) });
    assert.equal(blind.staat, 'blind');
  } finally {
    fs.unlinkSync(groenBestand);
    fs.unlinkSync(roodBestand);
  }
});

test('7. een herschrijving van het register gooit het geheugen niet weg', () => {
  /* DE RAMP DIE DIT AFDEKT: een kale `node scripts/outputproef.js`-run (zonder
     --meet) rekende de telling uit `gericht` op schijf, maar schreef het
     register terug ZONDER `gericht` en `basislijn`. De telling bleef kloppen
     (2198 bewezen), het geheugen was leeg -- en de eerstvolgende band begon
     doodleuk opnieuw op 4155 routes. Twee grendels:

     a. metGeheugen() hangt het geheugen van schijf aan elke uitslag, en een
        vers gemeten `gericht` wint van de schijf.
     b. ELK schrijfpad naar OUTPUTPROEF.json gaat door metGeheugen(). Dat is een
        bron-toets omdat het hoofdblok niet los aan te roepen is; wie een
        schrijfpad toevoegt zonder metGeheugen zakt hier. */
  const o = require('../scripts/outputproef');
  const echt = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'OUTPUTPROEF.json'), 'utf8'));

  const uit = o.metGeheugen({ iets: 1 });
  assert.deepEqual(Object.keys(uit.gericht), Object.keys(echt.gericht || {}),
    'metGeheugen hoort gericht van schijf terug te hangen');
  assert.deepEqual(uit.basislijn, echt.basislijn || {},
    'metGeheugen hoort de basislijn van schijf terug te hangen');

  const vers = { 'GET /api/zo': { toets: 'x.test.js', merkt: true, op: 'nu' } };
  assert.deepEqual(o.metGeheugen({}, vers).gericht, vers,
    'een vers gemeten gericht wint van de schijf');

  const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'outputproef.js'), 'utf8');
  const schrijvers = bron.match(/fs\.writeFileSync\(UITSLAG[^\n]*/g) || [];
  assert.ok(schrijvers.length >= 2, 'beide schrijfpaden horen te bestaan');
  for (const regel of schrijvers) {
    assert.match(regel, /metGeheugen\(/,
      'elk schrijfpad naar OUTPUTPROEF.json hoort door metGeheugen te gaan: ' + regel);
  }
});

test('4. een ontbrekend journaal geeft een REDEN en geen nullen', () => {
  /* De fout die dit huis al twee keer heeft gemaakt: een meter zonder invoer die
     stil een cijfer toont. Beide proeven horen te zeggen dat ze niets weten. */
  for (const naam of ['outputproef', 'auditproef']) {
    const mod = require('../scripts/' + naam);
    const uit = mod.meet ? mod.meet() : null;
    if (uit && uit.fout) {
      assert.match(uit.fout, /journaal/,
        naam + ' hoort te zeggen DAT en WAAROM hij niets kan meten');
    } else if (uit) {
      assert.ok(uit.gemeten && typeof uit.routes === 'number',
        naam + ' geeft een uitslag met een telling erbij');
    }
  }
});
