/* HET OORDEEL VAN DE IDEMPOTENTIEPROEF, los van een server.

   De ronde zelf (scripts/idemproef-route.js) heeft een echte server nodig en
   muteert onderweg; het oordeel is puur en hoort hier. Zelfde opzet als
   test/rolproef.test.js en test/invoerproef.test.js.

   WAT HIER HET ZWAARST WEEGT: de derde oproep. Zonder die ijking zou "de
   herhaling gaf hetzelfde antwoord" groen zijn voor elke route die sowieso
   altijd hetzelfde antwoordt -- duizenden routes die niets bewijzen. De toets
   die dat vasthoudt is de derde hieronder, en die is met een mutatie
   nagetrokken: haal de ijkvergelijking eruit en hij zakt.

   Draai los: node --test test/idemproef.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { weegHerhaling, gelijk, normaliseer, draaiIdemproef } = require('../scripts/lib/idemproef');

const ok = (data) => ({ status: 200, data });

/* ---------- het oordeel ---------- */

test('geen werk in de eerste oproep: dan valt er geen herhaling te beoordelen', () => {
  const o = weegHerhaling({ status: 400, data: { error: 'nee' } }, ok({}), ok({}));
  assert.equal(o.stand, 'ongemeten');
  assert.match(o.reden, /geen werk/);
});

test('herhaald:true is het sterkste bewijs -- de server zegt het zelf', () => {
  const o = weegHerhaling(ok({ ok: true, id: 'a' }), ok({ ok: true, id: 'a', herhaald: true }), ok({ ok: true, id: 'b' }));
  assert.equal(o.stand, 'beschermd');
  assert.match(o.reden, /herhaald/);
});

test('DE IJKING: een antwoord dat niet op een nieuwe oproep reageert, bewijst niets', () => {
  /* A en C zijn gelijk, dus deze route antwoordt hetzelfde wat je ook doet.
     Dat B er ook gelijk aan is, zegt dan niets -- en zonder deze regel zou dat
     als bewijs tellen. Dit is de kern van de hele proef. */
  const zelfde = { ok: true, stand: 'ongewijzigd' };
  const o = weegHerhaling(ok(zelfde), ok(zelfde), ok(zelfde));
  assert.equal(o.stand, 'ongemeten');
  assert.match(o.reden, /verandert niet per oproep/);
});

test('gelijk aan A terwijl C verschilt: dat is wel bewijs', () => {
  const o = weegHerhaling(ok({ id: 'x1' }), ok({ id: 'x1' }), ok({ id: 'x2' }));
  assert.equal(o.stand, 'beschermd');
});

test('de herhaling gaf een ander antwoord: hij deed het opnieuw', () => {
  const o = weegHerhaling(ok({ id: 'x1' }), ok({ id: 'x2' }), ok({ id: 'x3' }));
  assert.equal(o.stand, 'onbeschermd');
});

test('een geweigerde herhaling is ook geen tweede effect, maar wel een ander mechanisme', () => {
  const o = weegHerhaling(ok({ id: 'x1' }), { status: 409, data: { error: 'al gebruikt' } }, ok({ id: 'x2' }));
  assert.equal(o.stand, 'beschermd');
  assert.match(o.reden, /geweigerd/);
});

test('zonder geslaagde ijkoproep wordt er niet geoordeeld', () => {
  const o = weegHerhaling(ok({ id: 'x1' }), ok({ id: 'x1' }), { status: 429, data: {} });
  assert.equal(o.stand, 'ongemeten');
  assert.match(o.reden, /ijkoproep/);
});

test('een tijdstempel in het antwoord maakt de proef scherper, niet valser', () => {
  /* De idempotentielaag geeft het BEWAARDE antwoord terug, dus met dezelfde
     klokwaarde. Een route die opnieuw rekent, verraadt zich juist. */
  assert.equal(weegHerhaling(ok({ t: '10:00', id: 1 }), ok({ t: '10:00', id: 1 }), ok({ t: '10:01', id: 2 })).stand, 'beschermd');
  assert.equal(weegHerhaling(ok({ t: '10:00', id: 1 }), ok({ t: '10:01', id: 2 }), ok({ t: '10:02', id: 3 })).stand, 'onbeschermd');
});

test('de vergelijking kijkt naar de hele inhoud, niet naar de sleutelvolgorde', () => {
  assert.equal(gelijk({ a: 1, b: [2, { c: 3 }] }, { b: [2, { c: 3 }], a: 1 }), true);
  assert.equal(gelijk({ a: 1 }, { a: 2 }), false);
  /* Diep verstopt telt ook mee: elk veld dat je zou uitzonderen is een plek waar
     een tweede effect zich kan verbergen. */
  assert.equal(gelijk({ x: { y: { z: [1] } } }, { x: { y: { z: [1, 1] } } }), false);
  assert.match(normaliseer({ b: 1, a: 2 }), /^\{"a"/);
});

/* ---------- de ronde ---------- */

test('drie oproepen per route, en de sleutel van de derde is een andere', async () => {
  const gezien = [];
  const post = async (pad, lijf) => { gezien.push(lijf.idem); return ok({ id: gezien.length }); };
  const uit = await draaiIdemproef({ post, routes: [{ method: 'POST', pad: '/api/x', rol: 'member' }],
    tokenVoor: () => 't', lijfVoor: () => ({ naam: 'proef' }) });
  assert.equal(gezien.length, 3);
  assert.equal(gezien[0], gezien[1], 'de eerste twee delen een sleutel');
  assert.notEqual(gezien[1], gezien[2], 'de derde is de ijking en heeft een verse sleutel');
  assert.equal(uit.perRoute['POST /api/x'].idempotentie, 'onbeschermd');
});

test('de ronde oordeelt NIET als geen enkele route een gevoelig antwoord gaf', async () => {
  const uit = await draaiIdemproef({ post: async () => ok({ stil: true }),
    routes: [{ method: 'POST', pad: '/api/a', rol: 'member' }, { method: 'POST', pad: '/api/b', rol: 'member' }],
    tokenVoor: () => 't', lijfVoor: () => ({}) });
  assert.ok(uit.meterStuk, 'nul beoordeelde routes hoort een blinde ronde te zijn');
  assert.equal(uit.telling.ongemeten, 2);
});

test('een dood token wordt hernieuwd in plaats van als ongemeten geteld', async () => {
  let beurt = 0;
  const post = async () => (++beurt === 1 ? { status: 401, data: {} } : ok({ id: beurt }));
  const uit = await draaiIdemproef({ post, routes: [{ method: 'POST', pad: '/api/a', rol: 'member' }],
    tokenVoor: () => 't', lijfVoor: () => ({}), hernieuw: async () => true });
  assert.equal(uit.hernieuwd, 1);
  assert.notEqual(uit.perRoute['POST /api/a'].idempotentie, 'ongemeten');
});

/* ---------------------------------------------------------------------------
   HET TWEEDE MEETPUNT: DE OPSLAG (TAKEN.md 4.30)

   De toetsen hierboven meten het ANTWOORD. Daar liep de proef vast: een route
   die bij elke oproep hetzelfde teruggeeft, verraadt van buitenaf niet of hij
   twee keer heeft gewerkt -- en dat gold voor 768 routes.

   De opslag verraadt het wel. `weegHerhaling` krijgt daarom een vierde
   argument: het VERSCHIL dat elk van de drie oproepen in de collecties
   achterliet, met de ruis er al uit geijkt.

   De belangrijkste toets van dit stel is de laatste: als de eerste oproep de
   opslag NIET veranderde, doet dit meetpunt géén uitspraak. Zou het dan
   "beschermd" zeggen, dan werd elke leesroute groen zonder dat er ooit iets te
   beschermen viel -- dezelfde fout als de ijking hierboven voorkomt, een laag
   dieper.
   --------------------------------------------------------------------------- */
test('opslag: het antwoord zegt niets, maar de eerste oproep voegde toe en de herhaling niet', () => {
  const zelfde = { ok: true };
  const o = weegHerhaling(ok(zelfde), ok(zelfde), ok(zelfde),
    { a: { orders: 1 }, b: {}, c: { orders: 1 } });
  assert.equal(o.stand, 'beschermd', 'de opslag laat zien dat de herhaling niets deed');
  assert.match(o.reden, /OPSLAG/);
  assert.match(o.reden, /\+1 in orders/, 'en zegt erbij wat er precies bij kwam');
});

test('opslag: allebei voegden toe -- dan deed de herhaling het gewoon opnieuw', () => {
  const zelfde = { ok: true };
  const o = weegHerhaling(ok(zelfde), ok(zelfde), ok(zelfde),
    { a: { meldingen: 1 }, b: { meldingen: 1 }, c: { meldingen: 1 } });
  assert.equal(o.stand, 'onbeschermd');
  assert.match(o.reden, /opnieuw/);
});

test('opslag: als de EERSTE oproep niets veranderde, doet dit meetpunt geen uitspraak', () => {
  /* Een leesroute, of een die zijn verandering meteen weer terugdraait. In
     stand 2 ziet dit meetpunt ook een wijziging op zijn plaats, dus de groep die
     hier overblijft is kleiner geworden -- maar niet leeg, en een meter die het
     verschil niet ziet hoort er ook geen oordeel over te vellen. */
  const zelfde = { ok: true };
  const o = weegHerhaling(ok(zelfde), ok(zelfde), ok(zelfde), { a: {}, b: {}, c: {} });
  assert.equal(o.stand, 'ongemeten', 'geen tweede effect om te zien');
  assert.match(o.reden, /op zijn plaats bijwerkt/, 'en de reden zegt waarom dit niet te meten was');
});

test('opslag: het ANTWOORD blijft voorgaan waar het wel iets kan zeggen', () => {
  /* Het tweede meetpunt is een aanvulling en geen vervanging. Zegt de server
     zelf "herhaald: true", dan is dat het sterkste bewijs dat er is -- ook als
     de opslag toevallig niets liet zien. */
  const o = weegHerhaling(ok({ ok: true }), ok({ ok: true, herhaald: true }), ok({ ok: true }),
    { a: { x: 1 }, b: { x: 1 }, c: { x: 1 } });
  assert.equal(o.stand, 'beschermd');
  assert.match(o.reden, /herhaald: true/, 'het antwoord wint, niet de opslag');
});

test('opslag: een WIJZIGING op zijn plaats leest anders dan een toevoeging', () => {
  /* Stand 2 van server/staatlog.js levert 'gewijzigd' in plaats van een getal:
     de lengte bleef gelijk, de inhoud niet. Dat is een ander feit dan "er is er
     een bij gekomen" en hoort ook anders te klinken -- anders leest een
     bevinding als "+undefined in bankPassen". */
  const zelfde = { ok: true };
  const o = weegHerhaling(ok(zelfde), ok(zelfde), ok(zelfde),
    { a: { bankPassen: 'gewijzigd' }, b: {}, c: { bankPassen: 'gewijzigd' } });
  assert.equal(o.stand, 'beschermd');
  assert.match(o.reden, /een wijziging in bankPassen/);
  assert.doesNotMatch(o.reden, /undefined|NaN/, 'en niet met een kapot getal erin');

  const twee = weegHerhaling(ok(zelfde), ok(zelfde), ok(zelfde),
    { a: { bankPassen: 'gewijzigd' }, b: { bankPassen: 'gewijzigd' }, c: {} });
  assert.equal(twee.stand, 'onbeschermd', 'twee keer bijwerken is twee keer werk');
});

test('opslag: zonder meetpunt werkt de proef als vanouds', () => {
  const zelfde = { ok: true };
  const o = weegHerhaling(ok(zelfde), ok(zelfde), ok(zelfde));   // geen vierde argument
  assert.equal(o.stand, 'ongemeten');
  assert.match(o.reden, /een tweede effect zou hier niet te zien zijn/);
});

/* ---------------------------------------------------------------------------
   DE VASTLEGGING IS GEEN WERK (TAKEN.md 4.30)

   Het opslag-meetpunt telt lengtes, en sommige collecties krijgen bij ELKE
   handeling een regel: `kantoorAudit`, `commandJournaal`, `securityLog`. Die
   groeien bij de eerste oproep EN bij de herhaling -- en dan meldt het meetpunt
   "onbeschermd" terwijl het alleen de aantekening heeft gezien en niet het werk.
   Twee keer een schakelaar op AAN zetten hoort ook twee auditregels te geven.

   GEMETEN, en daarom staat het er: in de eerste volledige ronde groeiden ZEVEN
   van de tien nieuw gevonden onbeschermde routes uitsluitend in een auditlog.

   HIER STOND EERST EEN HEURISTIEK ("een collectie die meebeweegt bij vier van de
   vijf oproepen die iets deden"), met toetsen die groen stonden. Over de echte
   ronde vond die er NUL: kantoorAudit groeide bij 18% van de werkende oproepen,
   want een kantoorjournaal groeit alleen bij kantoorroutes. Een drempel die daar
   wel op past, pakt payBoekingen mee -- en dan verdwijnt bewijs over GELD achter
   een slimmigheid. Het is nu een BESLUIT in IDEMBESLUIT.json, en de toetsen
   hieronder gaan daarom over de lijst en over de CONTROLE op die lijst.
   --------------------------------------------------------------------------- */
const stilAntwoord = [ok({ stil: true }), ok({ stil: true }), ok({ stil: true })];
const AUDIT = { kantoorAudit: 'het kantoorjournaal' };
/* Per route: het opslagverschil van oproep A, B en C -- en van de VIERDE, die
   de proef alleen doet als hij een tegenspraak vermoedt (zie de uitleg daar).
   `d` staat standaard gelijk aan `b`: een route die bij een herhaling echt
   schrijft, schrijft bij de volgende herhaling ook. Wie het vermoeden wil zien
   VERVALLEN, zet `d: {}` -- dan bewoog er bij B iets wat niet van deze route
   kwam. Dezelfde vorm voor de antwoorden: het vierde is standaard het tweede. */
function ronde(specs, vastlegging) {
  const routes = specs.map((s, i) => ({ method: 'POST', pad: s.pad || ('/api/proef/r' + i), rol: 'member' }));
  const deltas = {}, antw = {};
  specs.forEach((s, i) => {
    const pad = routes[i].pad;
    deltas[pad] = [s.a || {}, s.b || {}, s.c || {}, s.d !== undefined ? s.d : (s.b || {})];
    const drie = s.antwoorden || stilAntwoord;
    antw[pad] = drie.concat([drie[1]]);
  });
  const beurt = {};
  let laatstePad = null;
  return draaiIdemproef({
    post: async (pad) => { laatstePad = pad; const n = beurt[pad] = (beurt[pad] || 0); beurt[pad] = n + 1; return antw[pad][Math.min(n, 3)]; },
    routes, tokenVoor: () => 't', lijfVoor: () => ({}),
    staatVan: () => { const n = (beurt[laatstePad] || 1) - 1; return deltas[laatstePad][Math.min(n, 3)]; },
    vastlegging });
}
// drie verschillende routefamilies, zoals een echte doorlopende vastlegging
const auditRoutes = ['/api/office/bank/a', '/api/office/weefsel/b', '/api/office/zelfzorg/c']
  .map(pad => ({ pad, a: { kantoorAudit: 1 }, b: { kantoorAudit: 1 }, c: { kantoorAudit: 1 } }));

test('vastlegging: een auditregel bij elke oproep is geen tweede effect', async () => {
  const uit = await ronde([
    ...auditRoutes,
    // routes die ECHT werk doen -- en die schrijven ook een auditregel
    { pad: '/api/office/x/beschermd', a: { orders: 1, kantoorAudit: 1 }, b: { kantoorAudit: 1 }, c: { orders: 1, kantoorAudit: 1 } },
    { pad: '/api/office/y/onbeschermd', a: { orders: 1, kantoorAudit: 1 }, b: { orders: 1, kantoorAudit: 1 }, c: { orders: 1, kantoorAudit: 1 } }
  ], AUDIT);
  assert.equal(uit.telling.ongemeten, 3, 'de drie die alleen een auditregel schreven, zeggen niets meer');
  assert.equal(uit.telling.beschermd, 1);
  assert.equal(uit.telling.onbeschermd, 1, 'en alleen de route die ECHT twee orders maakte blijft staan');
  assert.equal(uit.uitOpslag, 2, 'de teller van "gezien aan de opslag" telt mee terug');
  assert.match(uit.perRoute['POST /api/office/bank/a'].reden, /alleen een vastlegging/);
  assert.deepEqual(uit.perRoute['POST /api/office/bank/a'].opslag.a, {}, 'en de kolom staat ook niet meer in het register');
});

test('vastlegging: zonder lijst wordt er niets weggestreept', async () => {
  /* De veilige kant van verouderen: een journaal dat nog niet in IDEMBESLUIT.json
     staat, levert een MELDING op en geen stilte. */
  const uit = await ronde(auditRoutes);           // geen lijst meegegeven
  assert.equal(uit.telling.onbeschermd, 3, 'alle drie blijven een bevinding');
  assert.deepEqual(uit.vastleggingGemeten, []);
});

test('DE CONTROLE OP DE LIJST: een collectie onder EEN routefamilie is domeinwerk', async () => {
  /* Dit is de gevaarlijke kant. Een handgeschreven lijst kan worden opgerekt om
     een bevinding te laten verdwijnen -- zet `payBoekingen` erin en het bewijs
     over geld is weg. Een doorlopende vastlegging groeit onder routes die verder
     niets met elkaar te maken hebben; domeinwerk groeit onder zijn eigen handvol.
     Die verhouding meet de proef, en hij zegt het hardop. */
  const uit = await ronde([
    { pad: '/api/pay/stuur/x', a: { payBoekingen: 1 }, b: { payBoekingen: 1 }, c: { payBoekingen: 1 } },
    { pad: '/api/office/bank/a', a: { kantoorAudit: 1 }, b: { kantoorAudit: 1 }, c: { kantoorAudit: 1 } },
    { pad: '/api/office/weefsel/b', a: { kantoorAudit: 1 }, b: { kantoorAudit: 1 }, c: { kantoorAudit: 1 } }
  ], { kantoorAudit: 'het kantoorjournaal', payBoekingen: 'ONTERECHT in deze lijst gezet' });
  assert.deepEqual(uit.vastleggingVerdacht, ['payBoekingen'],
    'payBoekingen groeide maar onder pay/stuur: dat is de eigen collectie van een route');
  assert.deepEqual(uit.vastleggingGemeten.find(v => v.collectie === 'kantoorAudit'), { collectie: 'kantoorAudit', families: 2 },
    'en van kantoorAudit staat het gemeten getal erbij, niet een oordeel');
});

test('DE CONTROLE: een lijstnaam die deze ronde niet groeide is niet verdacht', async () => {
  /* Nul families is "deze ronde niet gezien" -- een korte ronde met --max, of een
     kant van het huis die niet is aangeraakt. Dat is geen bewijs van iets. */
  const uit = await ronde(auditRoutes, { ...AUDIT, securityLog: 'het rtfos-journaal' });
  assert.deepEqual(uit.vastleggingVerdacht, [], 'ongezien is niet hetzelfde als verdacht');
  assert.equal(uit.vastleggingGemeten.find(v => v.collectie === 'securityLog').families, 0);
});

test('vastlegging: een tegenspraak die alleen uit een auditregel bestond, vervalt', async () => {
  /* "herhaald: true" plus een groeiende opslag is het sterkste signaal dat deze
     proef kent -- maar niet als het enige dat groeide de aantekening was. */
  const uit = await ronde([...auditRoutes,
    { pad: '/api/office/z/netjes', a: { kantoorAudit: 1 }, b: { kantoorAudit: 1 }, c: { kantoorAudit: 1 },
      antwoorden: [ok({ id: 1 }), ok({ id: 1, herhaald: true }), ok({ id: 2 })] }
  ], AUDIT);
  assert.deepEqual(uit.tegenspraken, [], 'de auditregel spreekt het antwoord niet tegen');
  assert.equal(uit.perRoute['POST /api/office/z/netjes'].tegenspraak, undefined);
  assert.equal(uit.perRoute['POST /api/office/z/netjes'].idempotentie, 'beschermd', 'het antwoordoordeel blijft staan');
});

test('vastlegging: een ECHTE tegenspraak overleeft de zeef wel', async () => {
  const uit = await ronde([...auditRoutes,
    { pad: '/api/office/z/liegt', a: { orders: 1, kantoorAudit: 1 }, b: { orders: 1, kantoorAudit: 1 }, c: { orders: 1, kantoorAudit: 1 },
      antwoorden: [ok({ id: 1 }), ok({ id: 1, herhaald: true }), ok({ id: 2 })] }
  ], AUDIT);
  assert.deepEqual(uit.tegenspraken, ['POST /api/office/z/liegt']);
  assert.match(uit.perRoute['POST /api/office/z/liegt'].tegenspraak, /\+1 in orders/);
  assert.doesNotMatch(uit.perRoute['POST /api/office/z/liegt'].tegenspraak, /kantoorAudit/, 'zonder de aantekening erbij');
});

test('HET REGISTER ZELF: elke vastlegging draagt een reden, en de proef leest hem', () => {
  /* Een naam zonder reden is geen besluit maar een uitzondering die iemand er
     even in heeft gezet -- en dat is precies wat dit register moet uitsluiten.
     De tweede helft van deze toets is de bedrading: de proef moet dat blok ook
     ECHT meegeven, anders staat het er voor niets. */
  const besluit = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'IDEMBESLUIT.json'), 'utf8'));
  const namen = Object.keys(besluit.vastlegging || {});
  assert.ok(namen.length, 'er staat een vastleggingsblok in IDEMBESLUIT.json');
  for (const k of namen) {
    assert.equal(typeof besluit.vastlegging[k], 'string');
    assert.ok(besluit.vastlegging[k].length > 60, k + ' hoort een geschreven reden te hebben, geen etiket');
  }
  const bron = require('fs').readFileSync(require('path').join(__dirname, '..', 'scripts', 'idemproef-route.js'), 'utf8');
  assert.match(bron, /vastlegging:\s*register\.vastlegging/, 'de ronde geeft het register mee aan de proef');
});

/* ---------------------------------------------------------------------------
   DE TEGENSPRAAK NOEMT DE JUISTE GROND

   De melding stond hier als EEN vaste zin: "het antwoord meldt een herkende
   herhaling, maar de opslag groeide". Over de eerste echte ronde met
   inhoudsafdrukken kwamen er drie tegenspraken uit, en bij alle drie was de
   grond niet dat de server de herhaling MERKTE maar dat hij hem WEIGERDE (twee
   keer 409, een keer 404). De melding beweerde dus iets wat de proef niet had
   gemeten -- precies het soort bewering waar deze proef bij anderen op jaagt.
   --------------------------------------------------------------------------- */
test('tegenspraak: geweigerd is niet hetzelfde als gemerkt', async () => {
  const geweigerd = await ronde([{ pad: '/api/x/weiger', a: { spul: 1 }, b: { spul: 'gewijzigd' }, c: {},
    antwoorden: [ok({ id: 1 }), { status: 409, data: { error: 'al gebruikt' } }, ok({ id: 2 })] }]);
  const r = geweigerd.perRoute['POST /api/x/weiger'];
  assert.equal(r.idempotentie, 'beschermd');
  assert.equal(r.grond, 'geweigerd');
  assert.match(r.tegenspraak, /^de herhaling werd geweigerd/);
  assert.doesNotMatch(r.tegenspraak, /herkende herhaling/, 'en beweert niet dat de server hem merkte');

  const gemerkt = await ronde([{ pad: '/api/x/merk', a: { spul: 1 }, b: { spul: 'gewijzigd' }, c: {},
    antwoorden: [ok({ id: 1 }), ok({ id: 1, herhaald: true }), ok({ id: 2 })] }]);
  const m = gemerkt.perRoute['POST /api/x/merk'];
  assert.equal(m.grond, 'gemerkt');
  assert.match(m.tegenspraak, /^het antwoord meldt een herkende herhaling/);

  const gelijkAntwoord = await ronde([{ pad: '/api/x/gelijk', a: { spul: 1 }, b: { spul: 'gewijzigd' }, c: {},
    antwoorden: [ok({ id: 1 }), ok({ id: 1 }), ok({ id: 2 })] }]);
  const g = gelijkAntwoord.perRoute['POST /api/x/gelijk'];
  assert.equal(g.grond, 'gelijk');
  assert.match(g.tegenspraak, /^de herhaling gaf hetzelfde antwoord/);
});

/* ---------------------------------------------------------------------------
   EEN VERMOEDEN WORDT NAGETROKKEN, NIET GEMELD

   De toewijzing per oproep is een aanname: wat aan B wordt toegeschreven is
   alles wat er tussen het antwoord van A en dat van B veranderde. Dit huis heeft
   achtergrondwerk, dus die aanname kan slippen -- gemeten op 24 augustus, toen
   een route waarvan de herhaling met 404 werd geweigerd (en die op dat pad
   aantoonbaar niets schrijft) toch een verschil kreeg toegewezen: er landde een
   seed-ronde die negenendertig collecties tegelijk vulde.

   Vandaar een vierde oproep met dezelfde sleutel. Beweegt de opslag dan wéér op
   DEZELFDE collectie, dan is het van deze route. Zo niet, dan vervalt het
   vermoeden -- en dat vervallen staat in het register, want een vermoeden dat
   spoorloos verdwijnt is iets anders dan een vermoeden dat er nooit was.
   --------------------------------------------------------------------------- */
test('een vermoeden dat niet herhaalbaar is, wordt geen tegenspraak', async () => {
  const uit = await ronde([{ pad: '/api/x/toevallig',
    a: { spul: 1 }, b: { andereboel: 39 }, c: {}, d: {},   // de vierde doet het NIET opnieuw
    antwoorden: [ok({ id: 1 }), ok({ id: 1, herhaald: true }), ok({ id: 2 })] }]);
  const r = uit.perRoute['POST /api/x/toevallig'];
  assert.deepEqual(uit.tegenspraken, [], 'niets te melden');
  assert.equal(r.tegenspraak, undefined);
  assert.match(r.vermoedenVerworpen, /niet van deze route/, 'maar het verval staat er wel');
  assert.equal(uit.vermoedensVerworpen, 1);
  assert.equal(r.idempotentie, 'beschermd', 'het oordeel zelf blijft staan');
});

test('een vermoeden dat WEL herhaalbaar is, blijft een tegenspraak', async () => {
  const uit = await ronde([{ pad: '/api/x/echt',
    a: { orders: 1 }, b: { orders: 1 }, c: {}, d: { orders: 1 },
    antwoorden: [ok({ id: 1 }), ok({ id: 1, herhaald: true }), ok({ id: 2 })] }]);
  assert.deepEqual(uit.tegenspraken, ['POST /api/x/echt']);
  assert.equal(uit.perRoute['POST /api/x/echt'].nagetrokken, true);
  assert.equal(uit.vermoedensVerworpen, 0);
});

test('alleen de collectie die het OPNIEUW deed telt mee', async () => {
  /* Bewoog er bij B van alles maar bij de vierde oproep nog maar een ding, dan
     hoort de melding dat ene ding te noemen en niet de hele stapel -- anders
     draagt hij bewijs mee dat hij net heeft weerlegd. */
  const uit = await ronde([{ pad: '/api/x/mengsel',
    a: { orders: 1 }, b: { orders: 1, ruisje: 5, seed: 39 }, c: {}, d: { orders: 1 },
    antwoorden: [ok({ id: 1 }), ok({ id: 1, herhaald: true }), ok({ id: 2 })] }]);
  const t = uit.perRoute['POST /api/x/mengsel'].tegenspraak;
  assert.match(t, /\+1 in orders/);
  assert.doesNotMatch(t, /ruisje|seed/, 'de rest was niet herhaalbaar en hoort er niet in');
});
