/* ============================================================================
   HET GEVOLGCONTRACT -- de poort en de twee assen.

   WAT HIER WORDT AFGEDWONGEN, en het is een ding: een contract mag MEER zeggen dan
   de meting, maar nooit iets ANDERS. Zonder die regel is dit register binnen een
   maand een lijst beweringen met een stempel dat niemand heeft gezet -- precies het
   valse groen waar de laag tegen is gebouwd.

   En daarnaast: er komt geen zesde zekerheidsladder bij. De graden zijn de vier van
   dit huis, en "bounded" is geen trede maar een VELD (`uitkomsten`).
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

const ec = require('../server/kern/stuur/gevolgcontract');
const { CONTRACTEN } = require('../server/kern/stuur/gevolgcontract/register');
const envelop = require('../server/kern/envelop');
const gevolg = require('../server/kern/stuur/gevolg');

/* Een pad waarvan de meting RIJK is, zodat een gemeten claim gedekt kan zijn. */
const GEMETEN_PAD = '/api/bank/sepa';
const gemetenCollecties = gevolg.gevolgVan(GEMETEN_PAD).collecties;

const basis = (extra) => Object.assign({
  capability: GEMETEN_PAD,
  gevolgen: [
    { soort: 'direct', graad: 'gemeten', collectie: gemetenCollecties[0],
      wat: 'iets verandert', reden: 'gemeten in de proefronde' },
    { soort: 'afgeleid', graad: 'vermoed', wat: 'iets volgt eruit', reden: 'volgt uit het bovenstaande' },
    { soort: 'buiten', graad: 'vermoed', wat: 'de provider doet iets', reden: 'buiten de opslag' },
    { soort: 'mislukking', graad: 'vermoed', wat: 'er blijft iets achter', reden: 'bij een storing' }
  ]
}, extra || {});

test('de vier graden zijn de graden van dit huis, en er komt geen vijfde bij', () => {
  /* Deze lijst staat woordelijk in kern/objectlaag/pagina.js en
     kern/identiteit/sessievelden.js. Een eigen ladder hier zou de zesde van het
     huis zijn, en AFSPRAAK.md verbiedt dat met zoveel woorden. */
  assert.deepStrictEqual(ec.GRADEN, ['onbekend', 'vermoed', 'gemeten', 'bewezen']);
  assert.deepStrictEqual(ec.SOORTEN, ['direct', 'afgeleid', 'buiten', 'mislukking']);
  assert.deepStrictEqual(Object.keys(ec.STANDEN), ['VOLLEDIG', 'GEDEELTELIJK', 'ONBEKEND']);
});

test('de classificaties worden GELEEND van de envelop en niet overgeschreven', () => {
  /* Een kopie zou uiteenlopen zodra iemand daar een klasse bijzet -- en de eerste
     versie van deze laag had de vorm van dat register verkeerd geraden (een object
     met een reden per klasse, geen lijst). Juist daarom wordt hij geleend. */
  assert.deepStrictEqual(ec.klassen(), Object.keys(envelop.CLASSIFICATIES));
  const fout = ec.keur(basis({ classificatie: 'zeergeheim' }));
  assert.ok(fout.some(f => /staat niet in de woordenlijst van kern\/envelop/.test(f)), fout.join(' | '));
});

test('DE POORT: een `gemeten` claim die de meting niet dekt, wordt geweigerd', () => {
  /* Dit is de bewering die het hele register draagt. Hij mag meer zeggen dan de
     meting; hij mag nooit iets anders zeggen. */
  const fout = ec.keur(basis({ gevolgen: [
    { soort: 'direct', graad: 'gemeten', collectie: 'verzonnenCollectie',
      wat: 'saldo daalt', reden: 'x' }
  ] }));
  assert.ok(fout.some(f => /maar de proef zag die daar nooit veranderen/.test(f)), fout.join(' | '));

  /* En dezelfde claim op een collectie die de proef WEL zag, komt er door. */
  const goed = ec.keur(basis());
  assert.deepStrictEqual(goed, [], goed.join(' | '));
});

test('een gemeten direct gevolg zonder collectie is geen gemeten gevolg', () => {
  const fout = ec.keur(basis({ gevolgen: [
    { soort: 'direct', graad: 'gemeten', wat: 'iets', reden: 'x' }
  ] }));
  assert.ok(fout.some(f => /noemt zijn collectie/.test(f)), fout.join(' | '));
});

test('een gevolg BUITEN de opslag kan nooit gemeten of bewezen zijn', () => {
  /* De meting kijkt alleen naar collecties -- dat staat in GRENZEN van gevolg.js
     als punt 3, en hier wordt het afgedwongen in plaats van gehoopt. */
  for (const graad of ['gemeten', 'bewezen']) {
    const fout = ec.keur(basis({ gevolgen: [
      { soort: 'buiten', graad, wat: 'de bank boekt bij', reden: 'x' }
    ] }));
    assert.ok(fout.some(f => /buiten de opslag kan niet/.test(f)), graad + ': ' + fout.join(' | '));
  }
});

test('herstel wordt niet verklaard maar gemeten -- vier woorden worden geweigerd', () => {
  /* scripts/herstelproef.js heeft VIJF uitslagen; een boolean eroverheen slaat
     het verschil tussen een creditnota en een gewiste factuur plat. */
  for (const woord of ['reversible', 'omkeerbaar', 'herstelbaar', 'compensation']) {
    const fout = ec.keur(basis({ [woord]: true }));
    assert.ok(fout.some(f => f.includes('"' + woord + '"') && /GEMETEN/.test(f)),
      woord + ': ' + fout.join(' | '));
  }
});

test('de drie bezette namen worden geweigerd in plaats van stil omgezet', () => {
  for (const [naam, ipv] of [['doel', 'streefstand'], ['doelen', 'streefstand'],
    ['privacyImpact', 'classificatie'], ['goals', 'streefstand']]) {
    const fout = ec.keur(basis({ [naam]: 'x' }));
    assert.ok(fout.some(f => f.includes('"' + naam + '"') && f.includes(ipv)),
      naam + ': ' + fout.join(' | '));
  }
});

test('BOUNDED is geen trede maar een veld, en dat veld is een GESLOTEN set', () => {
  /* De bedoeling van "bounded" blijft overeind zonder een nieuw woord: staat er
     een uitkomstruimte, dan is hij benoemd en gesloten. Een lijst van een is geen
     ruimte maar een bewering. */
  const half = ec.keur(basis({ gevolgen: [
    { soort: 'buiten', graad: 'vermoed', wat: 'de provider antwoordt',
      uitkomsten: ['bevestigd'], reden: 'x' }
  ] }));
  assert.ok(half.some(f => /GESLOTEN set van minstens twee/.test(f)), half.join(' | '));

  const heel = ec.keur(basis({ gevolgen: [
    { soort: 'buiten', graad: 'vermoed', wat: 'de provider antwoordt',
      uitkomsten: ['bevestigd', 'geweigerd', 'teruggeboekt'], reden: 'x' }
  ] }));
  assert.deepStrictEqual(heel, [], heel.join(' | '));
});

test('DE TWEE ASSEN WORDEN NOOIT OPGETELD: een onbekende meting blokkeert geen verklaring', () => {
  /* Een pad waar de proef niet bij kwam, kan wel een VOLLEDIGE verklaring hebben --
     die twee assen meten verschillende dingen. Wat zo'n contract NIET mag, is
     ergens `gemeten` claimen; dat vangt de poort hierboven. Zonder dit onderscheid
     zou het werk aan de verklaring wachten op een proef die er niet komt. */
  const blind = '/api/agenda/bewaar';
  assert.strictEqual(gevolg.gevolgVan(blind).graad, 'onbekend', 'dit pad hoort ongemeten te zijn');
  const c = {
    capability: blind,
    gevolgen: [
      { soort: 'direct', graad: 'vermoed', wat: 'de agenda krijgt een item', reden: 'gelezen in de route' },
      { soort: 'afgeleid', graad: 'vermoed', wat: 'de dag raakt voller', reden: 'volgt eruit' },
      { soort: 'buiten', graad: 'vermoed', wat: 'geen enkel gevolg buiten de opslag', reden: 'geen bericht' },
      { soort: 'mislukking', graad: 'vermoed', wat: 'er blijft niets half staan', reden: 'een schrijfactie' }
    ]
  };
  assert.deepStrictEqual(ec.keur(c), [], 'een verklaring zonder meting hoort te mogen bestaan');
  assert.strictEqual(ec.stand(c, blind).stand, 'VOLLEDIG');
});

test('VOLLEDIG eist alle vier de soorten EN dekking van elke gemeten collectie', () => {
  /* Twee manieren om onvolledig te zijn, en ze staan apart in de uitslag: een
     soort die ontbreekt (`open`) en een gemeten collectie die niemand verklaarde
     (`nietVerklaard`). Een van de twee verzwijgen zou een half contract volledig
     laten lijken. */
  const zonderSoort = ec.stand({ capability: GEMETEN_PAD, gevolgen: [
    { soort: 'direct', graad: 'gemeten', collectie: gemetenCollecties[0], wat: 'x', reden: 'y' }
  ] }, GEMETEN_PAD);
  assert.strictEqual(zonderSoort.stand, 'GEDEELTELIJK');
  assert.ok(zonderSoort.open.includes('afgeleid') && zonderSoort.open.includes('buiten'));
  assert.ok(zonderSoort.nietVerklaard.length >= 1,
    'de gemeten collecties die niemand verklaarde horen met naam in de uitslag');
});

test('elk contract in het register haalt de keuring, en is VOLLEDIG of zegt wat er open staat', () => {
  const namen = Object.keys(CONTRACTEN);
  assert.ok(namen.length >= 1, 'het register hoort minstens een contract te dragen');
  for (const pad of namen) {
    const c = CONTRACTEN[pad];
    assert.strictEqual(c.capability, pad, pad + ': de sleutel en het veld `capability` horen gelijk te zijn');
    const fout = ec.keur(c);
    assert.deepStrictEqual(fout, [], pad + ': ' + fout.join('\n    '));
    const s = ec.stand(c, pad);
    if (s.stand !== 'VOLLEDIG')
      assert.ok(s.open.length || s.nietVerklaard.length,
        pad + ': niet volledig, maar zegt niet wat er open staat');
    assert.ok(c.nagekeken, pad + ': elk contract draagt wie het heeft nagekeken');
  }
});

test('DE NAAM VAN DEZE LAAG BOTST MET NIETS, en `effect` was bezet', () => {
  /* WAAROM DEZE TOETS BESTAAT. Deze laag heette bij het schrijven `effectcontract`
     met een meter `effectdekking`, en toen bleek `test/effectdekking.test.js` al te
     bestaan -- over de DERDE BRON VAN HET EFFECTMODEL (kern/isolatie/effecten.js),
     iets heel anders. Een meter en een gelijknamige toets die over verschillende
     dingen gaan, is exact de fout die SEMANTIEK.json meet en die BEWIJSMACHINE.md
     de duurste van het huis noemt -- hier bijna gemaakt door de laag die valse
     zekerheid moest voorkomen.

     Hij is hernoemd naar `gevolg`, hetzelfde woord als ../gevolg.js waar hij de
     verklaring naast legt. Deze toets houdt dat vast van twee kanten: geen bestand
     van deze laag draagt `effect` in zijn naam, en niemand anders in huis mag
     `gevolgcontract` of `gevolgdekking` gaan heten zonder hier langs te komen. */
  const fs = require('node:fs');
  const path = require('node:path');

  const EIGEN = [
    'server/kern/stuur/gevolgcontract.js',
    'server/kern/stuur/gevolgcontract/woorden.js',
    'server/kern/stuur/gevolgcontract/stand.js',
    'server/kern/stuur/gevolgcontract/register.js',
    'scripts/gevolgdekking.js',
    'test/gevolgcontract.test.js'
  ];
  const WORTEL = path.join(__dirname, '..');
  for (const p of EIGEN)
    assert.ok(fs.existsSync(path.join(WORTEL, p)), p + ': hoort bij deze laag en bestaat niet meer');

  /* Elk bestand in huis met onze naam erin, is van ons. Komt er elders een
     `gevolgcontract` of `gevolgdekking` bij, dan zakt deze toets en hoort iemand
     te kiezen: hetzelfde onderwerp (voeg samen) of een ander (hernoem). */
  const gevonden = [];
  const sla = new Set(['node_modules', '.git', 'dekking', 'data']);
  (function loop(map) {
    for (const naam of fs.readdirSync(map, { withFileTypes: true })) {
      if (sla.has(naam.name)) continue;
      const vol = path.join(map, naam.name);
      if (naam.isDirectory()) { loop(vol); continue; }
      if (!/^(gevolgcontract|gevolgdekking)/i.test(naam.name)) continue;
      gevonden.push(path.relative(WORTEL, vol).split(path.sep).join('/'));
    }
  })(WORTEL);
  /* GEVOLGDEKKING.json hoort er ook bij: het register van de meter. */
  const mag = new Set(EIGEN.concat(['GEVOLGDEKKING.json']));
  const vreemd = gevonden.filter(p => !mag.has(p));
  assert.deepStrictEqual(vreemd, [], 'een tweede `gevolg*`-naam in huis: ' + vreemd.join(', '));

  /* EN DE ANDERE KANT: geen bestand van deze laag draagt `effect` in zijn naam. */
  for (const p of EIGEN)
    assert.ok(!/effect/i.test(path.basename(p)), p + ': `effect` is vijf keer bezet (zie gevolgcontract/woorden.js)');

  /* De twee gradenladders zijn NIET dezelfde lijst, en dat hoort zichtbaar te
     blijven: het effectmodel zegt WAARUIT iets volgt, deze laag HOE HARD het
     vaststaat. Wie ze ooit samenvoegt, komt hier langs. */
  const model = require('../server/kern/isolatie/effecten');
  assert.ok(Array.isArray(model.VERKLAARD), 'het effectmodel hoort zijn verklaringen te dragen');
  assert.notDeepStrictEqual(ec.GRADEN, ['verklaard', 'afgeleid', 'vermoed', 'onbekend']);
});

test('HET REGISTER IS SAMENGESTELD, en een dubbele definitie valt om bij het LADEN', () => {
  /* De les uit server/lib/mutatiecontracten.js: een samengesteld register waarin het
     ene deel het andere stilzwijgend overschrijft, laat twee mensen een contract
     schrijven waarvan er een nooit wordt gelezen. Omvallen bij het laden is het
     goedkoopste moment.

     De echte delen zijn bevroren, dus de samenstelling wordt hier NAGEDAAN met
     dezelfde regel -- en dat is geen tweede kopie van de waarheid: de bewering is
     "twee delen die hetzelfde pad claimen horen te gooien", en die is alleen te
     toetsen op invoer die het register niet heeft. */
  const samen = (delen) => {
    const uit = {};
    for (const [naam, deel] of delen)
      for (const pad of Object.keys(deel)) {
        if (uit[pad]) throw new Error('twee delen claimen ' + pad + ' (de tweede is ' + naam + ')');
        uit[pad] = deel[pad];
      }
    return uit;
  };
  assert.throws(() => samen([['a.js', { '/api/x': {} }], ['b.js', { '/api/x': {} }]]), /twee delen claimen/);
  /* En de echte samenstelling gooit niet: de delen overlappen niet. */
  /* ALLE DELEN, en niet twee met de hand. Hier stonden `bank` en `lid` uitgeschreven, en
     toen er twee pay-delen bijkwamen zei deze toets dat het register niet de som van zijn
     delen was -- terwijl het dat wel was; de toets kende de som niet. Een lijst delen die
     met de hand meegroeit, is precies de tweede waarheid die dit register vermijdt. */
  const DELEN = ['register-bank', 'register-lid', 'register-pay-oplaad', 'register-pay-stuur',
    'register-pay-factuur', 'register-pay-klompje', 'register-pay-klompje-betaal']
    .map(n => [n + '.js', Object.values(require('../server/kern/stuur/gevolgcontract/' + n))[0]]);
  assert.ok(DELEN.length >= 4, 'de delenlijst is leeg of onvolledig');
  for (const [naam, deel] of DELEN)
    assert.ok(deel && Object.keys(deel).length, naam + ' levert geen enkel contract');
  /* Geen twee delen claimen hetzelfde pad -- over ALLE paren en niet alleen bank/lid. */
  const gezien = {};
  for (const [naam, deel] of DELEN)
    for (const pad of Object.keys(deel)) {
      assert.ok(!gezien[pad], pad + ' staat in ' + gezien[pad] + ' EN in ' + naam);
      gezien[pad] = naam;
    }
  assert.deepStrictEqual(Object.keys(CONTRACTEN).sort(), Object.keys(gezien).sort(),
    'het samengestelde register is niet de som van zijn delen');
});

test('de route waar het geld BEWEEGT is verklaard, en zijn gevolg is GEDELEGEERD', () => {
  /* Dit is het geval waarvoor de tweede as bestaat: de meting kan hier structureel
     niet komen (twee kantoormensen op naam, en een script kan de tweede niet zijn),
     dus staat er zuiver verklaring -- en dan hoort elke regel een adres in de code
     te dragen. */
  const pad = '/api/office/bank/handtekening/bevestig';
  const c = CONTRACTEN[pad];
  assert.ok(c, 'de route waar het geld beweegt hoort een contract te hebben');
  assert.strictEqual(gevolg.gevolgVan(pad).graad, 'onbekend',
    'zodra deze route WEL gemeten wordt, hoort dit contract zijn graden bij te werken');
  assert.deepStrictEqual(ec.keur(c), []);
  assert.strictEqual(ec.stand(c, pad).stand, 'VOLLEDIG');

  /* Geen enkel gevolg claimt `gemeten`: dat zou de poort ook weigeren, maar hier
     staat het als bewering -- een contract op een ongemeten pad hoort nergens het
     stempel van de proef te dragen. */
  for (const g of c.gevolgen)
    assert.notStrictEqual(g.graad, 'gemeten', g.wat + ': claimt gemeten op een ongemeten pad');

  /* HET GEDELEGEERDE GEVOLG draagt een GESLOTEN uitkomstruimte, en die hoort te
     kloppen met de handelingen die werkelijk geregistreerd zijn. Komt er een derde
     bij zonder dat dit contract meebeweegt, dan zakt deze toets. */
  const gedelegeerd = c.gevolgen.find(g => Array.isArray(g.uitkomsten));
  assert.ok(gedelegeerd, 'het gedelegeerde gevolg hoort zijn uitkomstruimte te noemen');
  const route = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'server/routes/kantoren/bank-tweedehand.js'), 'utf8');
  const geregistreerd = [...route.matchAll(/tweedeHand\.registreer\('([^']+)'/g)].map(m => m[1]).sort();
  assert.deepStrictEqual(gedelegeerd.uitkomsten.slice().sort(), geregistreerd,
    'de uitkomstruimte van het gedelegeerde gevolg loopt achter op de geregistreerde handelingen');

  /* En de duurste regel van dit contract: de handtekening is opgebruikt ook als de
     uitvoering faalt. Dat is beleid uit de kop van de module, geen toeval. */
  const mislukking = c.gevolgen.find(g => g.soort === 'mislukking');
  assert.match(mislukking.wat, /OPGEBRUIKT/);
});

/* ---------------------------------------------------------------------------
   DE VERGELIJKER (server/kern/stuur/gevolgcontract/vergelijk.js).

   Drie soorten conflict, en de scherpste eis is dat hij ze niet op naamgelijkheid
   vindt: een vooruitblik zegt "2 posten, 4000 cent" en een contract zegt "de
   collectie bankSaldi verandert". Die twee hebben geen woord gemeen, dus wordt er
   vergeleken op de gesloten woordenlijst van kern/isolatie/effectwoorden.js.
   ------------------------------------------------------------------------- */
const vg = require('../server/kern/stuur/gevolgcontract/vergelijk');

test('GELD_BEWEGEN EN `lezen` KUNNEN NIET SAMEN: het contract toetst de allowlist', () => {
  /* DIT IS DE ALGEMENE REGEL ACHTER EEN CONCREET GAT. /api/pay/saldo stond in de LEZEN-lijst
     van kern/stuur/beleid-lijsten.js -- die belooft "haalt op en verandert niets" -- en
     betaalt de maandfactuur uit het eigen saldo. Hij is op 13 september 2026 naar `voorstel`
     gegaan (toets 4b van test/stuur-niveaus.test.js).

     Die verplaatsing is een losse reparatie; DIT is de regel die hem had gevonden. Zodra een
     handeling een gevolgcontract heeft dat GELD_BEWEGEN verklaart, mag zij niet op een
     niveau staan waarop het stuur haar zonder bevestiging uitvoert -- `lezen` en `klein`
     zijn precies die twee (DIRECT is hun vereniging). De twee registers toetsen elkaar dus,
     in plaats van allebei apart te worden nagekeken.

     MUTATIEPROEF: zet `saldo` terug in de LEZEN-regex en deze toets zakt naast 4b. */
  const { beleidVoor } = require('../server/kern/stuur/beleid');
  const ZONDER_BEVESTIGING = ['lezen', 'klein'];
  let getoetst = 0;
  const stuk = [];
  for (const [pad, c] of Object.entries(CONTRACTEN)) {
    if (!(c.veroorzaakt || []).includes('GELD_BEWEGEN')) continue;
    for (const rol of ['member', 'supplier', 'staff']) {
      const n = beleidVoor(pad, rol).niveau;
      if (n === 'verboden') continue;       // buiten het bereik van de AI: geen uitspraak
      getoetst++;
      if (ZONDER_BEVESTIGING.includes(n)) stuk.push(pad + ' (' + rol + ') staat op `' + n + '`');
    }
  }
  assert.deepStrictEqual(stuk, [],
    'een handeling die volgens haar eigen gevolgcontract GELD_BEWEGEN veroorzaakt, staat op een ' +
    'niveau waarop het stuur haar zonder bevestiging uitvoert: ' + stuk.join('; '));
  /* EN DE TOETS MAG NIET LEEGLOPEN. Zonder deze regel zou hij groen blijven op het moment dat
     er geen enkel geldcontract meer AI-bereikbaar is -- en dan bewaakt hij niets. */
  assert.ok(getoetst >= 4, 'deze toets heeft maar ' + getoetst + ' geldpad(en) kunnen wegen; ' +
    'dat is te weinig om iets te bewaken -- staan de contracten nog in het register?');
});

test('DE WALLET-CONTRACTEN: `nooit` wordt AFGEDWONGEN tegen de bron, niet beweerd', () => {
  /* Dit is het verschil tussen een contract en een voornemen. Beide walletcontracten zetten
     `EXTERN_BEREIKEN` in `nooit` met de reden dat er geen mail, sms of push uit de pay-kern
     gaat -- het enige seintje is een SSE-tik met alleen `{scope:'pay'}` erin. Zolang dat
     alleen in de tekst staat, is het waar tot iemand er een mail bij zet.

     MUTATIEPROEF: zet een sendMail- of notify-aanroep in server/kern/pay/ en deze toets
     zakt, met de naam van het bestand erbij. */
  const fs = require('fs');
  const pad = require('path');
  const map = pad.join(__dirname, '..', 'server', 'kern', 'pay');
  const UITGANGEN = /\b(sendMail|sendSms|notify)\s*\(|require\((['"])[^'"]*\/mail/;
  const stuk = [];
  for (const naam of fs.readdirSync(map).filter(n => n.endsWith('.js'))) {
    const bron = fs.readFileSync(pad.join(map, naam), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    if (UITGANGEN.test(bron)) stuk.push(naam);
  }
  assert.deepStrictEqual(stuk, [],
    'de pay-kern heeft een bericht-uitgang gekregen (' + stuk.join(', ') + '), en twee ' +
    'gevolgcontracten beweren `nooit: EXTERN_BEREIKEN`. Pas het contract aan of haal de uitgang weg');

  /* EN DE NAAD TUSSEN DE TWEE DELEN IS EEN BEWERING, dus hij wordt getoetst: sturen raakt
     andermans gegevens en opladen niet. Valt dat verschil weg, dan is er geen reden meer
     voor twee bestanden -- en erger: dan klopt een van de twee niet. */
  const opl = CONTRACTEN['/api/pay/oplaad'];
  const stu = CONTRACTEN['/api/pay/stuur'];
  assert.ok(stu.veroorzaakt.includes('SCHRIJVEN_ANDERMANS'),
    '/api/pay/stuur boekt naar rekLid(aan): dat verandert het saldo van een ANDER lid');
  assert.ok(opl.nooit.includes('SCHRIJVEN_ANDERMANS'),
    '/api/pay/oplaad raakt alleen de eigen wallet');
  for (const c of [opl, stu]) {
    assert.ok(c.veroorzaakt.includes('GELD_BEWEGEN'), c.capability + ' verplaatst geld');
    assert.ok(c.nooit.includes('EXTERN_BEREIKEN'), c.capability + ' claimt geen bericht naar buiten');
  }
});

test('HET KLOMPJE: vragen is VOORSTEL_MAKEN en voldoen is GELD_BEWEGEN, nooit omgekeerd', () => {
  /* De scherpste naad die deze laag kent, en de eerste plek waar `VOORSTEL_MAKEN` door een
     contract wordt gebruikt (een van de vier werkwoorden die er op 13 september bijkwamen
     omdat de dertien van het isolatiemodel deze klasse niet konden uitdrukken).

     Zonder deze toets kan iemand de twee contracten later "opschonen" tot een, en dan zou
     een handeling die alleen iets KLAARZET meeliften op het werkwoord van een handeling die
     geld verplaatst -- precies de vermenging die de nieuwe invariant hierboven verbiedt.

     TWEE MUTATIEPROEVEN, en de eerste die ik opschreef was FOUT -- vandaar dat hij hier
     staat. `GELD_BEWEGEN` in `veroorzaakt` van /api/pay/verzoek zetten laat deze toets NIET
     zakken: `nooit` houdt het woord dan ook nog, dus de bewering hieronder blijft waar. Wat
     er dan zakt is de registertoets, omdat keuring.js een werkwoord in BEIDE lijsten
     weigert. Fail-closed dus wel, maar door een andere wacht dan ik beweerde -- en een
     mutatieproef die de verkeerde toets noemt, is geen proef.

     Wat deze toets WEL laat zakken, allebei nagetrokken:
       - VOORSTEL_MAKEN uit `veroorzaakt` halen -> 'vragen zet iets klaar';
       - de naam SCHRIJVEN_ANDERMANS uit de `onzeker`-reden halen -> 'de onbeslistheid moet
         UITGESCHREVEN staan'. */
  const vraag = CONTRACTEN['/api/pay/verzoek'];
  const betaal = CONTRACTEN['/api/pay/verzoek/betaal'];
  assert.ok(vraag.veroorzaakt.includes('VOORSTEL_MAKEN'), 'vragen zet iets klaar');
  assert.ok(vraag.nooit.includes('GELD_BEWEGEN'), 'vragen verplaatst geen geld: verzoekMaak schrijft ' +
    'alleen klompje-rijen');
  assert.ok(betaal.veroorzaakt.includes('GELD_BEWEGEN'), 'voldoen verplaatst geld');
  assert.ok(betaal.nooit.includes('VOORSTEL_MAKEN'), 'voldoen zet niets klaar maar voert uit');
  /* EN DE TWIJFEL BLIJFT TWIJFEL. Bij vragen staat SCHRIJVEN_ANDERMANS in GEEN van beide
     lijsten (een nieuwe rij in andermans beeld is geen wijziging van wat hij had, maar wel
     iets); bij voldoen staat hij hard in `veroorzaakt`, want daar verandert het saldo van de
     vrager en de status van zijn rij. Wie de twijfel bij vragen wegpoetst naar `nooit`, geeft
     een garantie die niemand heeft nagerekend. */
  const W = 'SCHRIJVEN_ANDERMANS';
  assert.ok(!vraag.veroorzaakt.includes(W) && !vraag.nooit.includes(W),
    'bij vragen is ' + W + ' met opzet onbeslist, en dat hoort in `onzeker` te staan');
  assert.ok((vraag.onzeker || []).some(o => /SCHRIJVEN_ANDERMANS/.test(o.reden || '')),
    'de onbeslistheid moet UITGESCHREVEN staan, niet alleen afwezig zijn');
  assert.ok(betaal.veroorzaakt.includes(W), 'bij voldoen is er geen twijfel: het saldo van de vrager beweegt');
});

test('de werkwoorden worden GELEEND van het effectmodel en niet bedacht', () => {
  /* Een eigen lijst hier zou de 22e vermogenslijst van dit huis zijn
     (CAPABILITEIT.json). Dat de twee lagen dezelfde woorden ANDERS gebruiken is geen
     botsing maar de bedoeling: het effectmodel wijst een pad zijn werkwoorden toe om
     isolatie te beslissen, hier verklaart een mens wat een handeling veroorzaakt. */
  const model = require('../server/kern/isolatie/effectwoorden');
  assert.deepStrictEqual(ec.werkwoorden(), model.NAMEN);
  /* En de keuring weigert een woord dat er niet in staat: een tikfout is geen nieuw
     effect. */
  const fout = ec.keur({ capability: '/api/x', veroorzaakt: ['GELD_BEWEGE'],
    gevolgen: [{ soort: 'direct', graad: 'vermoed', wat: 'x', reden: 'y' }] });
  assert.ok(fout.some(f => /woordenlijst van kern\/isolatie/.test(f)), fout.join(' | '));
});

test('een werkwoord in `veroorzaakt` EN in `nooit` wordt geweigerd', () => {
  /* Dan zegt het contract niets, en een vergelijker die daar een winnaar kiest
     verzint beleid. */
  const fout = ec.keur({ capability: '/api/x', veroorzaakt: ['GELD_BEWEGEN'], nooit: ['GELD_BEWEGEN'],
    gevolgen: [{ soort: 'direct', graad: 'vermoed', wat: 'x', reden: 'y' }] });
  assert.ok(fout.some(f => /zegt het contract niets/.test(f)), fout.join(' | '));
});

test('DE DRIE SOORTEN, en alleen twee ervan blokkeren', () => {
  const bevestig = '/api/office/bank/handtekening/bevestig';
  /* TEGENSPRAAK: het contract van de AANVRAAG sluit GELD_BEWEGEN uit. */
  const t = vg.vergelijk({ over: '/api/office/bank/incasso', effecten: ['GELD_BEWEGEN'] });
  assert.strictEqual(t.uitslag, 'CONFLICT');
  assert.strictEqual(t.blokkeert, true);
  assert.deepStrictEqual(t.conflicten.map(c => c.soort), ['TEGENSPRAAK']);

  /* GAT: het contract zegt niets over BULK_UITVOER. Dat blokkeert NIET -- wie daarop
     blokkeert, zet het huis stil op zijn eigen achterstand. */
  const g = vg.vergelijk({ over: bevestig, effecten: ['GELD_BEWEGEN', 'BULK_UITVOER'] });
  assert.strictEqual(g.uitslag, 'GATEN');
  assert.strictEqual(g.blokkeert, false);
  assert.deepStrictEqual(g.conflicten.map(c => c.werkwoord), ['BULK_UITVOER']);

  /* OVERCLAIM: aangeroepen en niet nagebouwd -- een contract dat `gemeten` claimt op
     een collectie die de proef daar nooit zag, zakt op de keuring en dat telt hier als
     conflict. Het register is bevroren, dus de lezer wordt geinjecteerd. */
  const o = vg.vergelijk({ over: '/api/bank/sepa', effecten: ['GELD_BEWEGEN'] }, { contracten: {
    '/api/bank/sepa': { capability: '/api/bank/sepa', veroorzaakt: ['GELD_BEWEGEN'],
      gevolgen: [{ soort: 'direct', graad: 'gemeten', collectie: 'verzonnenCollectie',
        wat: 'x', reden: 'y' }] } } });
  assert.strictEqual(o.uitslag, 'CONFLICT');
  assert.strictEqual(o.blokkeert, true);
  assert.ok(o.conflicten.some(c => c.soort === 'OVERCLAIM'), JSON.stringify(o.conflicten));

  /* En BLOKKEERT woont op EEN plek, zodat er niet twee zijn die dat beslissen. */
  assert.deepStrictEqual(vg.BLOKKEERT.slice().sort(), ['OVERCLAIM', 'TEGENSPRAAK']);
});

test('er wordt NIET op naamgelijkheid vergeleken: een vooruitblik in getallen levert niets', () => {
  /* De faalvorm die deze module moet uitsluiten: nul conflicten uit een vergelijker
     die niets kan zien. Een vooruitblik met alleen getallen erin draagt geen
     werkwoorden, en dan is de uitslag NIET "in orde" maar "er is niets om tegen te
     houden". Die twee op elkaar laten lijken is het gevaarlijkste groen dat er is. */
  const r = vg.vergelijk({ over: '/api/bank/sepa', uitslag: { aantal: 2, bedragCenten: 4000 } });
  assert.strictEqual(r.uitslag, 'ZONDER_WERKWOORDEN');
  assert.strictEqual(r.blokkeert, false);
  assert.match(r.reden, /ontbrekende lijst is geen lege lijst/);
  /* Een EXPLICIET lege lijst is wel een bewering en komt door. */
  assert.strictEqual(vg.vergelijk({ over: '/api/bank/sepa', effecten: [] }).uitslag, 'IN_ORDE');

  /* EN EEN WOORD DAT NIET IN DE LIJST STAAT MAAKT DE VERGELIJKING ONBRUIKBAAR, en
     wordt niet stil als gat doorgelaten. Dit gat zat er: een mutatie die de controle
     uitzette liet `GELD_VERZONNEN` doorvallen naar de vergelijking, waar hij netjes
     als GAT verscheen -- een tikfout werd dan een bevinding over het contract in
     plaats van een bevinding over de voorspelling. */
  const raar = vg.vergelijk({ over: '/api/bank/sepa', effecten: ['GELD_VERZONNEN'] });
  assert.strictEqual(raar.uitslag, 'ONBRUIKBAAR');
  assert.strictEqual(raar.blokkeert, false);
  assert.deepStrictEqual(raar.conflicten, [], 'een onbruikbare vergelijking levert geen bevindingen');
  assert.match(raar.reden, /niets om tegen te vergelijken/);
});

test('"geen contract" en "geen conflict" lijken niet op elkaar', () => {
  const r = vg.vergelijk({ over: '/api/agenda/bewaar', effecten: ['GELD_BEWEGEN'] });
  assert.strictEqual(r.uitslag, 'ZONDER_CONTRACT');
  /* Expliciet false en niet undefined: een aanroeper die `if (blokkeert)` schrijft,
     hoort geen verschil te merken tussen "niets aan de hand" en "het veld bestaat niet". */
  assert.strictEqual(r.blokkeert, false);
  /* En het SUBJECT wordt niet geraden: zonder `over` is er niets te vergelijken. */
  const zonder = vg.vergelijk({ effecten: ['GELD_BEWEGEN'] });
  assert.strictEqual(zonder.uitslag, 'ZONDER_CONTRACT');
  assert.match(zonder.reden, /zonder subject is elke vergelijking een gok/);
});
