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
const { weegAntwoord, draaiRolproef, plausibelLijf, LEKMERKERS, beoordeelRolrij } = require('../scripts/lib/rolproef');
const { LEGE_SLEUTELS } = require('../scripts/lib/proefsleutels');

/* ---------- het oordeel over een enkel antwoord ---------- */

test('een 2xx op een verkeerde rol is binnenkomen, en dat mag nooit', () => {
  assert.deepEqual(weegAntwoord(200, '{"ok":true}'), { tweexx: true, lek: null, acl: 'OPEN' });
  assert.deepEqual(weegAntwoord(204, ''), { tweexx: true, lek: null, acl: 'OPEN' });
});

test('een nette weigering zonder gegevens is in orde', () => {
  assert.deepEqual(weegAntwoord(403, '{"error":"Verboden"}'), { tweexx: false, lek: null, acl: 'dicht' });
  assert.deepEqual(weegAntwoord(401, 'Niet ingelogd'), { tweexx: false, lek: null, acl: 'dicht' });
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
      if (pad === '/api/auth/me' || pad === '/api/office/state') return { status: 200, data: {} };
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
     tegen is.

     DEZE TOETS STOND HIER MET `rol: 'open'`, EN DAT WOORD BESTAAT NIET. De
     bewakerslaag noemt zo'n route `openbaar`. De toets voedde de proef dus met
     verzonnen invoer, sloeg groen aan, en hield vier jaar lang een dode wacht
     overeind -- terwijl in de echte ronde alle 112 openbare routes wel degelijk
     werden bekropen. Zie de kop van scripts/lib/rolproef.js.

     Een cap die een document noemt, wordt tegen de code gehouden; een ROL die
     een toets noemt, dus ook. */
  const nep = nepServer(() => ({ status: 403, data: { error: 'Verboden' } }));
  const uit = await draaiRolproef({
    post: nep.post,
    routes: [...ROUTES, { methode: 'POST', pad: '/api/nooit/geprobeerd', rol: 'openbaar' }],
    tokensVoor: TOKENS
  });
  assert.ok(uit.perRoute['POST /api/zaak/prijs'], 'de beproefde route staat er wel in');
  assert.equal(uit.perRoute['POST /api/nooit/geprobeerd'], undefined,
    'een publieke route is niet met een verkeerde rol te beproeven en hoort er dus niet in');
});

test('een rol zonder sleutel wordt niet gekruist, en zegt waarom', async () => {
  /* NIET STIL OVERSLAAN. Een `continue` zonder spoor laat deze routes in de
     bewijsmatrix als `ongemeten` staan, en dat is onwaar: er valt niets te
     kruisen (de route vraagt geen kop), en dat is iets anders dan dat niemand
     heeft gekeken. De reden reist mee zodat de matrix er `nvt` van maakt. */
  const nep = nepServer(() => ({ status: 200, data: { ok: true } }));
  const uit = await draaiRolproef({
    post: nep.post,
    routes: LEGE_SLEUTELS.map((rol, i) => ({ methode: 'POST', pad: '/api/zonder/sleutel' + i, rol })),
    tokensVoor: TOKENS
  });
  assert.equal(uit.pogingen, 0, 'er is op geen van deze routes geklopt');
  assert.deepEqual(uit.perRoute, {}, 'en geen ervan telt als beproefd');
  assert.equal(uit.nietTeKruisen.length, LEGE_SLEUTELS.length);
  for (const r of uit.nietTeKruisen) {
    assert.match(r.reden, /geen sleutel/, 'elke overgeslagen route draagt de reden');
    assert.ok(LEGE_SLEUTELS.includes(r.rol));
  }
});

test('alleen de rollen UIT de sleutelbos worden overgeslagen -- geen verzonnen woord', async () => {
  /* DE RATEL OP DE VORIGE FOUT. Zou hier ooit weer een woord staan dat de
     bewakerslaag niet kent (`open`, `publiek`, `geen`), dan wordt die route
     stilletjes niet meer gekruist en verdwijnt zijn ACL-bewijs zonder dat
     iemand het merkt. Deze toets zakt op zo'n woord: het hoort GEWOON gekruist
     te worden, want de proef kent het niet als sleutelloos. */
  const nep = nepServer(() => ({ status: 403, data: { error: 'Verboden' } }));
  const uit = await draaiRolproef({
    post: nep.post,
    routes: [{ methode: 'POST', pad: '/api/verzonnen/rol', rol: 'open' }],
    tokensVoor: TOKENS
  });
  assert.deepEqual(uit.nietTeKruisen, [],
    '`open` is geen rol van de bewakerslaag en mag dus niet als sleutelloos gelden');
  assert.ok(uit.perRoute['POST /api/verzonnen/rol'],
    'een onbekende rol wordt gewoon gekruist -- anders verdwijnt bewijs in stilte');
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

test('uitval, redirect en gewone foutcodes zijn geen bewezen weigering', async () => {
  for (const status of [undefined, null, '403', 0, 302, 400, 404, 409, 429, 500, 503]) {
    assert.equal(weegAntwoord(status, '{"functie":"uit"}').acl, 'onbeslist', String(status));
    const nep = nepServer(() => ({ status, data: { functie: 'uit' } }));
    const uit = await draaiRolproef({ post: nep.post, routes: ROUTES, tokensVoor: TOKENS });
    const r = uit.perRoute['POST /api/zaak/prijs'];
    assert.equal(r.acl, 'onbeslist', String(status));
    assert.equal(r.privacy, 'onbeslist', String(status));
    assert.equal(uit.bevindingen.onbeslist.length, 1);
  }
});

test('alle verwachte rollen krijgen een ruwe poging en levende eigen controles', async () => {
  const nep = nepServer(() => ({ status: 403, data: {} }));
  const uit = await draaiRolproef({ post: nep.post, routes: ROUTES, tokensVoor: TOKENS });
  const r = uit.perRoute['POST /api/zaak/prijs'];
  assert.equal(r.bewijsVersie, 2);
  assert.deepEqual(r.verwacht, ['member', 'office']);
  assert.deepEqual(r.antwoorden, ['member', 'office'].map(rol => ({
    rol, methode: 'POST', status: 403, eigenVoor: 200, eigenNa: 200, lek: null
  })));
  assert.equal(beoordeelRolrij(r).acl, 'dicht');
  const oud = { methode: 'POST', pad: r.pad, rol: r.rol, geprobeerd: ['member', 'office'], acl: 'dicht', privacy: 'schoon' };
  assert.equal(beoordeelRolrij(oud).acl, 'onbeslist', 'oude labels zijn geen ruwe meting');
  assert.equal(beoordeelRolrij({ ...oud, acl: 'OPEN' }).acl, 'OPEN', 'een bestaande bevinding verdwijnt niet');
});

test('een ontbrekende rol, afgebroken budget of dubbele poging kan niet groen worden', async () => {
  for (const opties of [{ maxPogingen: 1 }, { tokensVoor: () => ({ member: 'm', supplier: 's' }) }]) {
    const nep = nepServer(() => ({ status: 403, data: {} }));
    const uit = await draaiRolproef({ post: nep.post, routes: ROUTES, tokensVoor: TOKENS, ...opties });
    const r = uit.perRoute['POST /api/zaak/prijs'];
    assert.equal(r.acl, 'onbeslist');
    assert.equal(r.privacy, 'onbeslist');
  }
  const antwoord = { rol: 'member', methode: 'POST', status: 403, eigenVoor: 200, eigenNa: 200, lek: null };
  const dubbel = { bewijsVersie: 2, methode: 'POST', rol: 'supplier',
    verwacht: ['member', 'office'], antwoorden: [antwoord, antwoord], geprobeerd: ['member', 'member'] };
  assert.equal(beoordeelRolrij(dubbel).acl, 'onbeslist');
});

test('beide eigen sessiecontroles moeten slagen; dezelfde token wordt gebruikt', async () => {
  for (const status of [0, 302, 401, 403, 404, 500, 503]) {
    for (const kant of ['voor', 'na']) {
      const nep = nepServer(() => ({ status: 403, data: {} }));
      let controles = 0;
      const tokens = [];
      const post = async (pad, lijf, tok) => {
        if (pad === '/api/auth/me') {
          tokens.push(tok);
          return { status: ++controles === (kant === 'voor' ? 1 : 2) ? status : 200, data: {} };
        }
        if (pad === '/api/zaak/prijs' && tok === 'tok-member') tokens.push(tok);
        return nep.post(pad, lijf, tok);
      };
      const uit = await draaiRolproef({ post, routes: ROUTES, tokensVoor: TOKENS });
      assert.equal(uit.perRoute['POST /api/zaak/prijs'].acl, 'onbeslist', kant + ':' + status);
      assert.deepEqual(tokens, ['tok-member', 'tok-member', 'tok-member']);
    }
  }
});

test('een doorbraak of lek blijft een bevinding naast onbeslist bewijs', async () => {
  for (const afwijking of [{ status: 200, data: {} }, { status: 500, data: { email: 'jan@voorbeeld.nl' } }]) {
    const nep = nepServer((pad, tok) => tok === 'tok-member' ? afwijking : { status: 503, data: {} });
    const uit = await draaiRolproef({ post: nep.post, routes: ROUTES, tokensVoor: TOKENS });
    const r = uit.perRoute['POST /api/zaak/prijs'];
    if (afwijking.status === 200) assert.equal(r.acl, 'OPEN');
    else assert.equal(r.privacy, 'LEK');
  }
});

test('een niet-POST wordt met zijn echte methode uitgevoerd of blijft onbeslist', async () => {
  for (const methode of ['PUT', 'PATCH', 'DELETE']) {
    const route = { ...ROUTES[0], methode };
    const nep = nepServer(() => ({ status: 403, data: {} }));
    const zonder = await draaiRolproef({ post: nep.post, routes: [route], tokensVoor: TOKENS });
    assert.equal(zonder.perRoute[methode + ' /api/zaak/prijs'].acl, 'onbeslist');
    assert.equal(nep.gezien.length, 0, 'geen POST uitvoeren en daarna een andere methode claimen');
    const gezien = [];
    const met = await draaiRolproef({ post: nep.post, routes: [route], tokensVoor: TOKENS,
      vraag: async (m, pad, lijf, tok) => {
        if (pad !== route.pad) return nep.post(pad, lijf, tok);
        gezien.push({ m, pad, tok }); return { status: 403, data: {} };
      } });
    assert.equal(met.perRoute[methode + ' /api/zaak/prijs'].acl, 'dicht');
    assert.deepEqual(gezien.map(x => x.m), [methode, methode]);
  }
});

test('een mislukte ijking die wel toestand verandert mag de meter niet openen', async () => {
  const nep = nepServer(() => ({ status: 403, data: {} }));
  const post = async (...args) => {
    const r = await nep.post(...args);
    return args[0] === '/api/pay/oplaad' ? { ...r, status: 500 } : r;
  };
  const uit = await draaiRolproef({ post, routes: ROUTES, tokensVoor: TOKENS });
  assert.ok(uit.bevindingen.meterStuk);
  assert.equal(uit.pogingen, 0);
  assert.deepEqual(uit.perRoute, {});
});

test('de HTTP-adapter behoudt methode en redirectstatus zonder een andere deur te volgen', async () => {
  const { maakVraag } = require('../scripts/rolproef-route');
  const gezien = [];
  const vraag = maakVraag({ basis: 'http://proef.invalid', fetcher: async (url, opties) => {
    gezien.push({ url, opties });
    return { status: 302, text: async () => '{"functie":"andere-deur"}' };
  } });
  for (const methode of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
    const r = await vraag(methode, '/api/proef', { id: 'een' }, 'dezelfde-token');
    assert.equal(r.status, 302);
    const laatste = gezien.at(-1);
    assert.equal(laatste.opties.method, methode);
    assert.equal(laatste.opties.redirect, 'manual');
    assert.equal(laatste.opties.headers.Authorization, 'Bearer dezelfde-token');
    assert.equal(laatste.opties.body, methode === 'HEAD' ? undefined : '{"id":"een"}');
  }
  assert.equal(gezien.length, 5, 'geen redirect nagespeeld');
});

test('de HTTP-adapter bewaart transportuitval als status nul', async () => {
  const { maakVraag } = require('../scripts/rolproef-route');
  const vraag = maakVraag({ basis: 'http://proef.invalid', fetcher: async () => { throw new Error('offline'); } });
  assert.equal((await vraag('PATCH', '/api/proef', {}, 'tok')).status, 0);
});

test('ontbrekende lekscan of beschadigde ruwe controle levert geen privacybewijs', async () => {
  const nep = nepServer(() => ({ status: 403, data: {} }));
  const uit = await draaiRolproef({ post: nep.post, routes: ROUTES, tokensVoor: TOKENS });
  const r = uit.perRoute['POST /api/zaak/prijs'];
  const zonderScan = structuredClone(r);
  delete zonderScan.antwoorden[0].lek;
  assert.equal(beoordeelRolrij(zonderScan).privacy, 'onbeslist');
  assert.equal(beoordeelRolrij({ ...r, antwoorden: [null] }).acl, 'onbeslist');
  assert.equal(beoordeelRolrij(null).acl, 'onbeslist');
});

test('een mislukte nameting is een meetfout, geen bewezen toestandswijziging', async () => {
  const nep = nepServer(() => ({ status: 403, data: {} }));
  let overzicht = 0;
  const post = async (...args) => {
    if (args[0] === '/api/pay/overzicht' && ++overzicht === 4) return { status: 500, data: {} };
    return nep.post(...args);
  };
  const uit = await draaiRolproef({ post, routes: ROUTES, tokensVoor: TOKENS });
  assert.match(uit.bevindingen.meterStuk, /toestandscontrole/);
  assert.deepEqual(uit.bevindingen.gewijzigd, []);
});
