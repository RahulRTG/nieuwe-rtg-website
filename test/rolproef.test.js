/* DE ROL-SCHEIDING (scripts/lib/rolproef.js) -- de proef die vraagt of een
   INGELOGDE met de verkeerde rol binnenkomt, en of de weigering iets lekt.

   WAAROM DEZE TOETS ER IS. De proef zelf heeft een draaiende server nodig en
   leeft daarom binnen de Beproeving en scripts/rolproef-route.js. Daar komt
   nooit een mutatie bij, en dus was er geen enkele manier om te weten of het
   OORDEEL in deze module klopt. Een proef die bij elke uitkomst "geen
   bevindingen" meldt, is niet van een schone server te onderscheiden.

   Hier krijgt draaiRolproef() een NEPSERVER als parameter. Daarmee is precies
   te sturen wat een route antwoordt, en dus te bewijzen dat de proef een
   doorbraak ziet, een lek ziet, en zwijgt als er niets aan de hand is.

   DE VIERDE TOETS IS DE BELANGRIJKSTE: een route die niet is geprobeerd, komt
   nergens als "in orde" terecht. Dat is het verschil tussen 1000 beproefde
   routes en 3985 routes die er goed uitzien.

   Draai los: node --test test/rolproef.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { weegAntwoord, draaiRolproef, plausibelLijf, LEKMERKERS } = require('../scripts/lib/rolproef');

/* ---------- het oordeel over een enkel antwoord ---------- */

test('een 2xx op een verkeerde rol is binnenkomen, en dat mag nooit', () => {
  assert.deepEqual(weegAntwoord(200, '{"ok":true}'), { tweexx: true, lek: null });
  assert.deepEqual(weegAntwoord(204, ''), { tweexx: true, lek: null });
});

test('een nette weigering zonder gegevens is in orde', () => {
  assert.deepEqual(weegAntwoord(403, '{"error":"Verboden"}'), { tweexx: false, lek: null });
  assert.deepEqual(weegAntwoord(401, 'Niet ingelogd'), { tweexx: false, lek: null });
});

test('een weigering die een echte naam meegeeft, is een lek', () => {
  const uit = weegAntwoord(403, '{"error":"Dit dossier is van Rahul Imran Ismail"}');
  assert.equal(uit.tweexx, false);
  assert.equal(uit.lek, 'echte naam uit de kluis');
});

test('elk lekmerker in de lijst wordt ook echt gevonden', () => {
  /* Anders staat er een merker die nooit aanslaat: een regel die er is en
     niets doet. */
  const proef = {
    'e-mailadres': '{"error":"bekend bij jan@voorbeeld.nl"}',
    'IBAN': '{"error":"rekening NL91ABNA0417164300 is niet van u"}',
    'echte naam uit de kluis': '{"error":"van Rahul"}',
    'geheim veld': '{"wachtwoord":"hunter2geheim"}',
    'telefoonnummer': '{"error":"gekoppeld aan 0612345678"}'
  };
  for (const m of LEKMERKERS) {
    assert.equal(weegAntwoord(403, proef[m.naam]).lek, m.naam,
      m.naam + ' staat in de lijst maar wordt niet gevonden');
  }
});

test('een 2xx wordt als binnenkomen gemeld en niet als lek', () => {
  /* Wie binnenkomt, krijgt gegevens -- dat is per definitie zo. Zou dat ook als
     lek tellen, dan telt elke doorbraak dubbel en lijkt de privacy-kolom
     slechter dan de werkelijkheid. Het is EEN fout, met EEN oorzaak. */
  const uit = weegAntwoord(200, '{"naam":"Rahul","iban":"NL91ABNA0417164300"}');
  assert.equal(uit.tweexx, true);
  assert.equal(uit.lek, null);
});

/* ---------- de hele proef, met een nepserver ---------- */

/* De nepserver. `antwoord` bepaalt wat een route teruggeeft; de ijk-oplading
   moet lukken, anders houdt de proef zichzelf tegen (en dat is toets 4). */
function nepServer(antwoord) {
  let saldo = 0;
  const gezien = [];
  return {
    gezien,
    post: async (pad, lijf, tok) => {
      if (pad === '/api/pay/oplaad') { saldo += 137; return { status: 200, data: { ok: true } }; }
      if (pad === '/api/pay/overzicht') return { status: 200, data: { saldo, geschiedenis: [], aanMij: [], vanMij: [] } };
      if (pad === '/api/verkoop/mijn') return { status: 200, data: { deals: [] } };
      if (pad === '/api/supplier/backoffice') return { status: 200, data: { toppers: [], alerts: [] } };
      gezien.push({ pad, tok });
      return antwoord(pad, tok);
    }
  };
}
const TOKENS = () => ({ member: 'tok-member', supplier: 'tok-supplier', office: 'tok-office' });
const ROUTES = [{ methode: 'POST', pad: '/api/zaak/prijs', rol: 'supplier' }];

test('een route die iedereen binnenlaat, wordt per route aangewezen', async () => {
  const nep = nepServer(() => ({ status: 200, data: { ok: true } }));
  const uit = await draaiRolproef({ post: nep.post, routes: ROUTES, tokensVoor: TOKENS });
  assert.equal(uit.bevindingen.tweexx.length, 2, 'twee verkeerde rollen kwamen binnen');
  assert.equal(uit.perRoute['POST /api/zaak/prijs'].acl, 'OPEN');
  assert.deepEqual(uit.perRoute['POST /api/zaak/prijs'].geprobeerd, ['member', 'office']);
});

test('een route die netjes weigert maar de naam noemt, komt als LEK per route terug', async () => {
  const nep = nepServer(() => ({ status: 403, data: { error: 'Dit is de zaak van Rahul' } }));
  const uit = await draaiRolproef({ post: nep.post, routes: ROUTES, tokensVoor: TOKENS });
  const r = uit.perRoute['POST /api/zaak/prijs'];
  assert.equal(r.acl, 'dicht', 'niemand kwam binnen');
  assert.equal(r.privacy, 'LEK');
});

test('een route die netjes en zwijgzaam weigert, is op beide punten in orde', async () => {
  const nep = nepServer(() => ({ status: 403, data: { error: 'Verboden' } }));
  const uit = await draaiRolproef({ post: nep.post, routes: ROUTES, tokensVoor: TOKENS });
  const r = uit.perRoute['POST /api/zaak/prijs'];
  assert.equal(r.acl, 'dicht');
  assert.equal(r.privacy, 'schoon');
  assert.deepEqual(uit.bevindingen.tweexx, []);
  assert.deepEqual(uit.bevindingen.lekken, []);
});

test('een route die NIET is geprobeerd, staat nergens als in orde', async () => {
  /* De kern van deze hele uitbreiding. Zou een niet-beproefde route als "geen
     bevinding" tellen, dan dekt een ronde van duizend routes er negenendertig-
     honderd af -- en dat is precies de valse zekerheid waar de bewijsmatrix
     tegen is. */
  const nep = nepServer(() => ({ status: 403, data: { error: 'Verboden' } }));
  const uit = await draaiRolproef({
    post: nep.post,
    routes: [...ROUTES, { methode: 'POST', pad: '/api/nooit/geprobeerd', rol: 'open' }],
    tokensVoor: TOKENS
  });
  assert.ok(uit.perRoute['POST /api/zaak/prijs'], 'de beproefde route staat er wel in');
  assert.equal(uit.perRoute['POST /api/nooit/geprobeerd'], undefined,
    'een publieke route is niet met een verkeerde rol te beproeven en hoort er dus niet in');
});

test('een leesroute wordt niet geprobeerd -- dit gaat over muteren', async () => {
  const nep = nepServer(() => ({ status: 200, data: { ok: true } }));
  const uit = await draaiRolproef({
    post: nep.post, routes: [{ methode: 'GET', pad: '/api/iets/lezen', rol: 'member' }], tokensVoor: TOKENS });
  assert.deepEqual(uit.perRoute, {});
  assert.equal(uit.pogingen, 0);
});

test('de JUISTE rol wordt niet geprobeerd -- daarmee bewijs je niets over scheiding', async () => {
  const nep = nepServer(() => ({ status: 403, data: { error: 'Verboden' } }));
  const uit = await draaiRolproef({ post: nep.post, routes: ROUTES, tokensVoor: TOKENS });
  assert.ok(!uit.perRoute['POST /api/zaak/prijs'].geprobeerd.includes('supplier'));
});

test('de proef houdt zichzelf tegen als de vingerafdruk blind is', async () => {
  /* Een vingerafdruk die een LEGITIEME wijziging niet ziet, ziet ook een
     ongeoorloofde niet. Dan hoort de proef te zwijgen in plaats van te
     oordelen -- anders staat er "geen bevindingen" onder een blinde meter. */
  const blind = { post: async (pad) => (pad === '/api/pay/overzicht'
    ? { status: 200, data: { saldo: 0 } } : { status: 500, data: {} }) };
  const uit = await draaiRolproef({ post: blind.post, routes: ROUTES, tokensVoor: TOKENS });
  assert.match(uit.bevindingen.meterStuk, /LEGITIEME wijziging/);
  assert.equal(uit.pogingen, 0);
  assert.deepEqual(uit.perRoute, {}, 'een blinde proef levert geen bewijs over welke route dan ook');
});

/* ---------- de plausibele invoer ---------- */

test('het proeflijf is plausibel genoeg om de POORT te bereiken', () => {
  /* Rommel wordt door de validatie geweigerd VOORDAT de rechten aan de beurt
     zijn; een 400 op rommel bewijst dus niets over autorisatie. Daarom een
     bedrag dat een bedrag is en een datum die een datum is. */
  const lijf = plausibelLijf('/api/zaak/prijs');
  assert.equal(typeof lijf.bedrag, 'number');
  assert.match(lijf.datum, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(lijf.bevestig, true, 'geldroutes vragen een expliciete bevestiging');
});
