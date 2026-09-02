/* ============================================================================
   MIJN RTG: ELF ROUTES VAN DE IDENTITEITSLAAG DIE GEEN TOETS OVER DE DRAAD HADDEN.

   Toestelbinding (server/routes/member/toestellen.js), de tweede factor en de
   commerciele post (server/routes/member/tweefactor.js) kwamen met de
   samenvoeging binnen. De kern eronder was getoetst, de DEUR ervoor niet -- en
   juist de deur is wat een rechtstreekse handleraanroep nooit ziet.

   Elke oproep hier toetst een grens die de route zegt te hebben, en geen enkele
   tikt hem alleen aan. De vier die het zwaarst wegen:

   1. BINDEN VRAAGT EEN UITDAGING DIE DE SERVER HEEFT UITGEGEVEN. Een verzonnen
      antwoord bindt niets, en een uitdaging is voor EEN keer -- ook als de
      poging mislukte. Zonder dat tekent een aanvaller iets dat hij al had
      liggen (zie de kop van server/kern/identiteit/toestellen.js, grens 1).
   2. DE TWEEDE FACTOR UITZETTEN VRAAGT HET WACHTWOORD EN EEN GELDIGE CODE, en
      een verkeerde code laat de factor STAAN in plaats van hem stil te wissen.
   3. HERSTELCODES VERNIEUWEN MAAKT DE OUDE ONGELDIG. Dat staat als belofte in
      het antwoord ("Uw oude herstelcodes werken vanaf nu niet meer"), dus het
      hoort nagerekend te worden en niet geloofd.
   4. DE CODENAAMREGEL UIT CLAUDE.md. Klantdata draait op codenamen; een echte
      naam of een e-mailadres in het antwoord van deze routes is een vondst.
      Toets 8 legt vast wat er vandaag is: het e-mailadres staat op precies EEN
      plek -- het label van de otpauth-URI -- en nergens anders in deze elf
      routes. Verhuist hij, dan zakt die toets.

   WAT HIER NIET IS BEPROEFD, en waarom. `/api/mijn/toestel/introk` leest de
   sessielijst-PROJECTIE (server/kern/identiteit/sessielijst.js) om de sessies op
   het ingetrokken toestel te sluiten. Dat de projectie zelf geen namen draagt is
   daar de invariant; via deze route is alleen te zien dat zijn ANTWOORD er geen
   draagt en dat de sessie werkelijk dicht gaat. De lijst zelf komt uit
   /api/mijn/sessies, en die route hoort niet bij deze groep.

   Draai los: node --test test/mijnrtg-routes.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto, createHash } = require('node:crypto');
const { startServer, stop } = require('./helper');
const { totpCode } = require('../server/kern/totp');

let srv, base;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* De elf routes van deze groep, op een rij, zodat de deurtoets er geen kan
   overslaan zonder dat je het ziet. */
const ROUTES = [
  '/api/mijn/toestel/uitdaging', '/api/mijn/toestel/bind', '/api/mijn/toestel/noem',
  '/api/mijn/toestel/introk', '/api/mijn/tweefactor', '/api/mijn/tweefactor/begin',
  '/api/mijn/tweefactor/bevestig', '/api/mijn/tweefactor/codes', '/api/mijn/tweefactor/uit',
  '/api/mijn/post/zet', '/api/mijn/post/alles-uit'
];

const WACHTWOORD = 'geheim123';
let teller = 0;

/* Elk lid vers, zodat geen enkele toets op de stand van een andere leunt. De
   ACHTERNAAM is met opzet een woord dat nergens anders in dit huis voorkomt:
   daarmee is "staat de echte naam in dit antwoord" een vraag die je kunt
   stellen zonder valse treffers. */
async function nieuwLid() {
  const u = (Date.now() + (++teller)).toString().slice(-9);
  const email = 'mijnrtg' + u + '@voorbeeld.test';
  const achternaam = 'Kwelderhout' + u;
  const reg = await api('/api/auth/register', { name: 'Proef ' + achternaam, email,
    phone: '06' + u.slice(0, 8), password: WACHTWOORD, geboortedatum: '1990-05-05', pasApp: 'rtg' });
  assert.equal(reg.status, 200, 'registreren mislukte: ' + JSON.stringify(reg.body).slice(0, 160));
  return { token: reg.body.token, email, achternaam };
}

/* Opnieuw inloggen op hetzelfde account levert een TWEEDE sessie op. Die is
   nodig om te zien dat het intrekken van een toestel de sessies erop sluit --
   met een sessie sluit hij per definitie de zijne niet. */
async function tweedeSessie(lid) {
  const r = await api('/api/auth/login', { login: lid.email, password: WACHTWOORD, pasApp: 'rtg' });
  assert.ok(r.body.token, 'tweede inlog mislukte: ' + JSON.stringify(r.body).slice(0, 160));
  return r.body.token;
}

/* Een toestel in de toets: een echt P-256-sleutelpaar, precies zoals de browser
   het maakt. De private helft blijft hier; over de lijn gaat alleen de publieke
   helft en een handtekening. */
async function toestel() {
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const j = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  const jwk = { kty: j.kty, crv: j.crv, x: j.x, y: j.y };
  return {
    jwk,
    /* De verwachte toestelId, hier ONAFHANKELIJK uitgerekend en niet uit de
       kern geleend: anders toetst dit dat een functie zichzelf gelijk is. */
    id: createHash('sha256').update(JSON.stringify({ kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y })).digest('hex').slice(0, 32),
    teken: async (tekst) => Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' },
      kp.privateKey, Buffer.from(String(tekst), 'utf8'))).toString('base64url')
  };
}

/* Een uitdaging halen en hem ondertekend terugsturen -- de weg die de browser
   ook loopt. */
async function bindNetjes(token, t, naam) {
  const u = await api('/api/mijn/toestel/uitdaging', {}, token);
  assert.equal(u.status, 200, JSON.stringify(u.body));
  return api('/api/mijn/toestel/bind', { jwk: t.jwk, handtekening: await t.teken(u.body.nonce), naam }, token);
}

/* DE CODENAAMREGEL, mechanisch. Het antwoord wordt OOK percentgedecodeerd
   bekeken: het e-mailadres in de otpauth-URI staat er als %40 in, en een platte
   substring-controle had dat gemist. Precies zo'n gemiste treffer laat een
   lekcontrole voorgoed groen staan. */
function zonderNaamOfAdres(body, lid, waar) {
  const ruw = JSON.stringify(body || {});
  let uit = ruw;
  try { uit = ruw + '\n' + decodeURIComponent(ruw); } catch (e) { /* stray % : de ruwe vorm volstaat */ }
  assert.ok(!uit.includes(lid.email), waar + ': het e-mailadres van het lid staat in het antwoord');
  assert.ok(!uit.includes(lid.achternaam), waar + ': de echte naam van het lid staat in het antwoord');
}

/* RTG_DEMO=1 zet de demo-inlog aan. Die is hier nodig voor de DERDE deur: een
   pas-sessie zonder eigen account. eisLid() kent twee weigeringen -- "alleen
   voor leden" en "dit hoort bij een eigen RTG-account" -- en zonder een sessie
   die de eerste passeert en op de tweede stukloopt, is die tweede helft van de
   deur niet te zien. */
test.before(async () => { srv = await startServer({ env: { RTG_DEMO: '1' } }); base = srv.base; });
test.after(() => stop(srv));

test('1. de deur: alle elf routes weigeren zonder sessie, een gast en een pas zonder account', async () => {
  /* Drie deuren op een rij, en ze zeggen alle drie iets anders -- dat is het
     hele punt van eisLid(). Zonder token is er geen sessie (401). Een GAST heeft
     wel een sessie maar hoort hier niet (403, "alleen voor leden"). Een
     PAS-SESSIE ZONDER EIGEN ACCOUNT komt langs die eerste horde en loopt op de
     tweede stuk: deze laag hangt aan een account, want een toestel, een tweede
     factor en een toestemming horen bij een mens en niet bij een pas.

     Een weigering zonder reden zou hier het ergst zijn: het lid ziet dan een
     dichte deur zonder te weten wat hij eraan kan doen. */
  const gast = await api('/api/login', { tier: 'guest' });
  assert.ok(gast.body.token, 'geen gastsessie; dan is de tweede deur blind');
  const pas = await api('/api/login', { tier: 'business', pasApp: 'business' });
  assert.ok(pas.body.token, 'geen pas-sessie; dan is de derde deur blind (staat RTG_DEMO aan?)');

  for (const pad of ROUTES) {
    const dicht = await api(pad, {});
    assert.equal(dicht.status, 401, pad + ' liet iemand zonder sessie binnen');

    const alsGast = await api(pad, {}, gast.body.token);
    assert.equal(alsGast.status, 403, pad + ' liet een gast binnen');
    assert.match(alsGast.body.error, /Alleen voor leden/, pad + ': de weigering noemt geen reden');

    const alsPas = await api(pad, {}, pas.body.token);
    assert.equal(alsPas.status, 403, pad + ' liet een pas-sessie zonder eigen account binnen');
    assert.match(alsPas.body.error, /eigen RTG-account/, pad + ': de weigering noemt geen reden');
  }
});

test('2. binden zonder uitdaging bindt niets -- ook niet met een handtekening die klopt', async () => {
  /* DE BELANGRIJKSTE TOETS VAN DEZE GROEP. Dit lid heeft nooit een uitdaging
     gehaald. Het toestel tekent hier iets dat het zelf heeft gekozen, en dat is
     precies het geval waar de tweetrapsopzet voor bestaat: kon de client
     bepalen WAT er getekend wordt, dan tekent een aanvaller iets dat hij al had
     liggen. De handtekening zelf is geldig; er is alleen niets om te ruilen. */
  const lid = await nieuwLid();
  const t = await toestel();
  const r = await api('/api/mijn/toestel/bind',
    { jwk: t.jwk, handtekening: await t.teken('een-nonce-die-ik-zelf-verzon'), naam: 'Laptop' }, lid.token);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /uitdaging is verlopen/i);
  assert.equal(r.body.ok, undefined, 'een verzonnen uitdaging bond alsnog een toestel');
  assert.equal(r.body.toestelId, undefined, 'er kwam een toestelId terug zonder uitdaging');

  /* En de sleutel wordt eerst als sleutel herkend: rommel is geen P-256. Dat is
     een andere weigering en hoort dus een andere zin te dragen. */
  const rommel = await api('/api/mijn/toestel/bind', { jwk: { kty: 'RSA', n: 'x' }, handtekening: 'AAAA' }, lid.token);
  assert.equal(rommel.status, 400);
  assert.match(rommel.body.error, /P-256/);
});

test('3. een uitdaging is voor EEN keer -- ook een mislukte poging verbruikt hem', async () => {
  /* Zou een uitdaging blijven staan na een misser, dan kan iemand er onbeperkt
     op blijven proberen met dezelfde nonce. De volgorde hier is dus met opzet:
     eerst een foute handtekening (die hoort te weigeren OP DE HANDTEKENING), en
     daarna de JUISTE handtekening op diezelfde nonce -- die hoort te weigeren
     omdat de uitdaging op is, en niet omdat hij niet klopt. */
  const lid = await nieuwLid();
  const t = await toestel();

  const u1 = await api('/api/mijn/toestel/uitdaging', {}, lid.token);
  assert.equal(u1.status, 200);
  assert.ok(typeof u1.body.nonce === 'string' && u1.body.nonce.length >= 24, 'geen bruikbare nonce');
  assert.ok(u1.body.geldigMs > 0, 'een uitdaging zonder geldigheidsduur');

  const u2 = await api('/api/mijn/toestel/uitdaging', {}, lid.token);
  assert.notEqual(u2.body.nonce, u1.body.nonce, 'twee uitdagingen achter elkaar waren dezelfde');

  const mis = await api('/api/mijn/toestel/bind',
    { jwk: t.jwk, handtekening: await t.teken('iets-heel-anders') }, lid.token);
  assert.equal(mis.status, 400);
  assert.match(mis.body.error, /handtekening klopt niet/);

  const opnieuw = await api('/api/mijn/toestel/bind',
    { jwk: t.jwk, handtekening: await t.teken(u2.body.nonce) }, lid.token);
  assert.equal(opnieuw.status, 400, 'de uitdaging was na een mislukte poging nog bruikbaar');
  assert.match(opnieuw.body.error, /uitdaging is verlopen/i);
  assert.equal(opnieuw.body.ok, undefined);
});

test('4. binden lukt met een echte handtekening, en het toestel kiest zijn id niet zelf', async () => {
  /* De toestelId is een AFGELEIDE van de publieke sleutel. Daarom sturen we hier
     bewust een eigen `toestelId` mee: die hoort genegeerd te worden, want anders
     kan een toestel zich voordoen als een ander. */
  const lid = await nieuwLid();
  const t = await toestel();
  const u = await api('/api/mijn/toestel/uitdaging', {}, lid.token);
  const r = await api('/api/mijn/toestel/bind', { jwk: t.jwk, handtekening: await t.teken(u.body.nonce),
    naam: 'Laptop van de proef', toestelId: 'f'.repeat(32) }, lid.token);

  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(r.body.toestelId, t.id, 'de toestelId is niet de afdruk van de publieke sleutel');
  assert.notEqual(r.body.toestelId, 'f'.repeat(32), 'het toestel koos zijn eigen id');
  assert.equal(r.body.nieuw, true);
  assert.ok(r.body.bindingId && r.body.bindingId !== r.body.toestelId,
    'de bindingId zegt niets eigens: hij hoort bij DIT bewijs, niet bij het toestel');
  /* Eerlijk over de reikwijdte hoort in het antwoord te staan en niet in een
     document: deze binding geldt voor DEZE sessie. */
  assert.match(r.body.nietGeraakt, /Andere sessies|geen identiteit/);
  zonderNaamOfAdres(r.body, lid, 'toestel/bind');

  /* Dezelfde nonce nog een keer: verbruikt. Een handtekening die iemand
     onderweg opving is daarmee waardeloos. */
  const herhaal = await api('/api/mijn/toestel/bind', { jwk: t.jwk, handtekening: await t.teken(u.body.nonce) }, lid.token);
  assert.equal(herhaal.status, 400);
  assert.match(herhaal.body.error, /uitdaging is verlopen/i);
});

test('5. noemen: een naam is verplicht, en het toestelregister is per lid', async () => {
  const lid = await nieuwLid();
  const vreemde = await nieuwLid();
  const t = await toestel();
  const bind = await bindNetjes(lid.token, t, 'Eerste naam');
  assert.equal(bind.status, 200, JSON.stringify(bind.body));

  const leeg = await api('/api/mijn/toestel/noem', { toestelId: t.id, naam: '   ' }, lid.token);
  assert.equal(leeg.status, 400);
  assert.match(leeg.body.error, /naam van maximaal 40 tekens/);

  const onbekend = await api('/api/mijn/toestel/noem', { toestelId: 'a'.repeat(32), naam: 'Spook' }, lid.token);
  assert.equal(onbekend.status, 400);
  assert.match(onbekend.body.error, /Onbekend toestel/);

  /* HET REGISTER IS PER LID. Een ander lid kent hetzelfde toestelId -- het is
     de afdruk van een publieke sleutel en dus geen geheim -- en mag er niets
     mee. Zou dit lukken, dan is een toestelId een sleutel in plaats van een
     naam. */
  const ander = await api('/api/mijn/toestel/noem', { toestelId: t.id, naam: 'Van mij nu' }, vreemde.token);
  assert.equal(ander.status, 400, 'een ander lid kon dit toestel hernoemen');
  assert.match(ander.body.error, /Onbekend toestel/);

  const goed = await api('/api/mijn/toestel/noem', { toestelId: t.id, naam: 'Werktelefoon' }, lid.token);
  assert.equal(goed.status, 200);
  assert.equal(goed.body.naam, 'Werktelefoon');

  /* De naam wordt begrensd en niet zomaar doorgegeven: 40 tekens, meer niet. */
  const lang = await api('/api/mijn/toestel/noem', { toestelId: t.id, naam: 'Q'.repeat(120) }, lid.token);
  assert.equal(lang.status, 200);
  assert.equal(lang.body.naam.length, 40, 'een naam van 120 tekens ging ongewijzigd het register in');
});

test('6. intrekken sluit de sessies op dat toestel, en het toestel komt niet stilletjes terug', async () => {
  /* De belofte staat in de kop van de route: "een toestel intrekken sluit OOK
     zijn sessies", want dat is precies het toestel dat iemand kwijt is. Met een
     sessie is dat niet te zien -- de eigen sessie blijft immers open -- dus dit
     lid heeft er twee, allebei aan hetzelfde toestel gebonden. */
  const lid = await nieuwLid();
  const t = await toestel();
  const eerste = lid.token;
  assert.equal((await bindNetjes(eerste, t, 'Toestel')).status, 200);

  const tweede = await tweedeSessie(lid);
  const bind2 = await bindNetjes(tweede, t, 'Toestel');
  assert.equal(bind2.status, 200, JSON.stringify(bind2.body));
  assert.equal(bind2.body.nieuw, false, 'hetzelfde toestel gold als een nieuw toestel');

  const onbekend = await api('/api/mijn/toestel/introk', { toestelId: 'b'.repeat(32) }, tweede);
  assert.equal(onbekend.status, 400);
  assert.match(onbekend.body.error, /Onbekend toestel/);

  const intr = await api('/api/mijn/toestel/introk', { toestelId: t.id }, tweede);
  assert.equal(intr.status, 200, JSON.stringify(intr.body));
  assert.equal(intr.body.sessiesGesloten, 1, 'de andere sessie op dit toestel bleef open');
  assert.match(intr.body.nietGeraakt, /Deze sessie blijft open/);
  zonderNaamOfAdres(intr.body, lid, 'toestel/introk');

  /* En dat is geen boekhouding maar een gesloten deur: het token van de eerste
     sessie werkt niet meer, terwijl de sessie die introk deed doorloopt. */
  assert.equal((await api('/api/mijn/tweefactor', {}, eerste)).status, 401,
    'de gesloten sessie kwam nog gewoon binnen');
  assert.equal((await api('/api/mijn/tweefactor', {}, tweede)).status, 200,
    'de intrekker sloot zichzelf buiten');

  assert.match((await api('/api/mijn/toestel/noem', { toestelId: t.id, naam: 'X' }, tweede)).body.error,
    /Onbekend toestel/, 'een ingetrokken toestel is nog te hernoemen');

  /* Opnieuw binden brengt het niet stil terug: het lid heeft dit toestel bewust
     weggezet, en dat ongedaan maken hoort een BEWUSTE handeling te zijn. */
  const terug = await bindNetjes(tweede, t, 'Toestel');
  assert.equal(terug.status, 400, 'een ingetrokken toestel bond zichzelf weer aan');
  assert.equal(terug.body.ingetrokken, true);
  assert.match(terug.body.error, /eerder ingetrokken/);
});

test('7. de tweede factor gaat in twee stappen aan, en een verkeerde code verandert niets', async () => {
  /* Zou het geheim meteen gelden, dan sluit een verkeerd gescande QR het lid
     buiten -- en dat merkt hij pas bij de volgende inlog. De stand hoort dat
     verschil dus te kennen: `inWachtkamer` naast `aan`. */
  const lid = await nieuwLid();
  const uit = await api('/api/mijn/tweefactor', {}, lid.token);
  assert.equal(uit.status, 200);
  assert.equal(uit.body.aan, false);
  assert.equal(uit.body.inWachtkamer, false);

  const vroeg = await api('/api/mijn/tweefactor/bevestig', { code: '000000' }, lid.token);
  assert.equal(vroeg.status, 400, 'bevestigen kon zonder dat er iets klaarstond');
  assert.match(vroeg.body.error, /geen instelling klaar/);

  const beg = await api('/api/mijn/tweefactor/begin', { huidig: WACHTWOORD }, lid.token);
  assert.equal(beg.status, 200, JSON.stringify(beg.body));
  assert.ok(/^[A-Z2-7]{32}$/.test(beg.body.geheim || ''), 'geen bruikbaar base32-geheim');

  const wacht = await api('/api/mijn/tweefactor', {}, lid.token);
  assert.equal(wacht.body.aan, false, 'de tweede factor stond aan voordat er een code was ingetypt');
  assert.equal(wacht.body.inWachtkamer, true);

  const fout = await api('/api/mijn/tweefactor/bevestig', { code: '000000' }, lid.token);
  assert.equal(fout.status, 403);
  assert.match(fout.body.error, /code klopt niet/);
  assert.equal(fout.body.herstelcodes, undefined, 'een foute code leverde toch herstelcodes op');
  assert.equal((await api('/api/mijn/tweefactor', {}, lid.token)).body.aan, false,
    'een foute code zette de tweede factor toch aan');

  const goed = await api('/api/mijn/tweefactor/bevestig', { code: totpCode(beg.body.geheim) }, lid.token);
  assert.equal(goed.status, 200, JSON.stringify(goed.body));
  assert.equal(goed.body.herstelcodes.length, 10, 'geen volle set herstelcodes bij het aanzetten');
  assert.match(goed.body.let, /nooit meer getoond/);

  const aan = await api('/api/mijn/tweefactor', {}, lid.token);
  assert.equal(aan.body.aan, true);
  assert.equal(aan.body.herstelcodesOver, 10);
  assert.ok(aan.body.sinds, 'de stand zegt niet sinds wanneer');
  /* Wat de stand met opzet NIET teruggeeft: het geheim en de codes. Konden wij
     ze tonen, dan konden wij ze ook lezen. */
  assert.equal(aan.body.geheim, undefined, 'de stand gaf het TOTP-geheim terug');
  assert.equal(aan.body.codes, undefined, 'de stand gaf de herstelcodes terug');
});

test('8. het geheim komt pas na het wachtwoord -- en het e-mailadres staat op precies EEN plek', async () => {
  /* HET WACHTWOORD VOORAF, want dit antwoord bevat het geheim zelf. Wie een open
     sessie kaapt zou anders een eigen tweede factor kunnen aanzetten en de
     rechtmatige houder buitensluiten. */
  const lid = await nieuwLid();
  const fout = await api('/api/mijn/tweefactor/begin', { huidig: 'niet-het-wachtwoord' }, lid.token);
  assert.equal(fout.status, 403);
  assert.match(fout.body.error, /wachtwoord klopt niet/);
  assert.equal(fout.body.geheim, undefined, 'het TOTP-geheim kwam mee bij een fout wachtwoord');
  assert.equal(fout.body.uri, undefined, 'de otpauth-URI kwam mee bij een fout wachtwoord');

  const beg = await api('/api/mijn/tweefactor/begin', { huidig: WACHTWOORD }, lid.token);
  assert.equal(beg.status, 200);

  /* DE VONDST, en zij wordt hier vastgelegd zoals zij IS en niet zoals zij zou
     moeten zijn. CLAUDE.md: klantdata draait op codenamen, echte namen staan in
     de gescheiden kluis. Deze route haalt `accounts.emailOf(u)` op en zet dat in
     het LABEL van de otpauth-URI -- het adres reist dus terug over de lijn, aan
     het eigen lid en functioneel nodig (de authenticator-app moet tonen bij welk
     account de code hoort), maar het is geen codenaam.

     Wat deze toets vasthoudt is de OMVANG van die uitzondering: het adres staat
     in de URI en NERGENS anders in dit antwoord. Verhuist het naar een tweede
     veld of naar een andere route, dan zakt deze toets -- en dat is precies wat
     hij moet doen. De echte NAAM van het lid komt hier nergens voor. */
  const uri = String(beg.body.uri || '');
  assert.ok(uri.startsWith('otpauth://totp/'), 'geen otpauth-URI');
  assert.ok(decodeURIComponent(uri).includes(lid.email),
    'het label van de otpauth-URI wijst niet meer naar het account -- klopt de aanname van deze toets nog?');
  const zonderUri = Object.assign({}, beg.body); delete zonderUri.uri;
  zonderNaamOfAdres(zonderUri, lid, 'tweefactor/begin buiten de otpauth-URI');
  assert.ok(!decodeURIComponent(uri).includes(lid.achternaam),
    'de echte naam van het lid staat in de otpauth-URI');

  /* En de andere tien routes van deze groep dragen het adres helemaal niet. */
  zonderNaamOfAdres((await api('/api/mijn/tweefactor', {}, lid.token)).body, lid, 'tweefactor stand');
  zonderNaamOfAdres((await api('/api/mijn/post/alles-uit', {}, lid.token)).body, lid, 'post/alles-uit');
});

test('9. nieuwe herstelcodes maken de oude ongeldig, en dat vraagt het wachtwoord', async () => {
  const lid = await nieuwLid();
  const beg = await api('/api/mijn/tweefactor/begin', { huidig: WACHTWOORD }, lid.token);
  const aan = await api('/api/mijn/tweefactor/bevestig', { code: totpCode(beg.body.geheim) }, lid.token);
  assert.equal(aan.status, 200, JSON.stringify(aan.body));
  const oude = aan.body.herstelcodes;

  const zonder = await api('/api/mijn/tweefactor/codes', { huidig: 'fout' }, lid.token);
  assert.equal(zonder.status, 403);
  assert.match(zonder.body.error, /wachtwoord klopt niet/);
  assert.equal(zonder.body.herstelcodes, undefined, 'een fout wachtwoord leverde toch een nieuwe set op');

  const nieuw = await api('/api/mijn/tweefactor/codes', { huidig: WACHTWOORD }, lid.token);
  assert.equal(nieuw.status, 200, JSON.stringify(nieuw.body));
  assert.equal(nieuw.body.herstelcodes.length, 10);
  assert.equal(nieuw.body.herstelcodes.filter(c => oude.includes(c)).length, 0,
    'de nieuwe set deelt codes met de oude');
  assert.match(nieuw.body.let, /oude herstelcodes werken vanaf nu niet meer/);

  /* De belofte in dat zinnetje wordt hier NAGEREKEND en niet geloofd: een oude
     code hoort nu niets meer te openen. Zou hij nog werken, dan is "vernieuwen"
     een aanvulling in plaats van een vervanging -- en dan blijft een code die
     iemand ooit zag voor altijd geldig. */
  const metOude = await api('/api/mijn/tweefactor/uit', { huidig: WACHTWOORD, code: oude[0] }, lid.token);
  assert.equal(metOude.status, 403, 'een oude herstelcode werkte na het vernieuwen nog');
  assert.equal((await api('/api/mijn/tweefactor', {}, lid.token)).body.aan, true);
});

test('10. uitzetten vraagt wachtwoord EN een geldige code; een verkeerde laat de factor staan', async () => {
  const lid = await nieuwLid();
  const beg = await api('/api/mijn/tweefactor/begin', { huidig: WACHTWOORD }, lid.token);
  const aan = await api('/api/mijn/tweefactor/bevestig', { code: totpCode(beg.body.geheim) }, lid.token);
  const codes = aan.body.herstelcodes;

  /* Wie een open sessie kaapt heeft het wachtwoord vaak al. Was dat genoeg, dan
     is de tweede factor een drempel van een tik hoog. */
  const zonderCode = await api('/api/mijn/tweefactor/uit', { huidig: WACHTWOORD, code: '000000' }, lid.token);
  assert.equal(zonderCode.status, 403);
  assert.match(zonderCode.body.error, /blijft de tweede factor staan/);
  assert.equal((await api('/api/mijn/tweefactor', {}, lid.token)).body.aan, true,
    'een verkeerde code zette de tweede factor toch uit');

  const zonderWachtwoord = await api('/api/mijn/tweefactor/uit', { huidig: 'fout', code: codes[0] }, lid.token);
  assert.equal(zonderWachtwoord.status, 403);
  assert.match(zonderWachtwoord.body.error, /wachtwoord klopt niet/);
  assert.equal((await api('/api/mijn/tweefactor', {}, lid.token)).body.aan, true,
    'zonder wachtwoord ging de tweede factor toch uit');

  const echt = await api('/api/mijn/tweefactor/uit', { huidig: WACHTWOORD, code: codes[0] }, lid.token);
  assert.equal(echt.status, 200, JSON.stringify(echt.body));
  assert.match(echt.body.gevolg, /herstelcodes zijn ongeldig geworden/);
  const na = await api('/api/mijn/tweefactor', {}, lid.token);
  assert.equal(na.body.aan, false);
  assert.equal(na.body.inWachtkamer, false, 'er bleef een half aangezette factor achter');

  /* En dan is er ook niets meer om te vernieuwen: `codes` hangt aan een factor
     die AAN staat, en zegt dat met zoveel woorden. */
  const codesNa = await api('/api/mijn/tweefactor/codes', { huidig: WACHTWOORD }, lid.token);
  assert.equal(codesNa.status, 400);
  assert.match(codesNa.body.error, /geen tweede factor aan/);
});

test('11. commerciele post staat standaard UIT; een onbekende soort of kanaal komt er niet in', async () => {
  /* Dit is het omgekeerde van de meldingsvoorkeuren: zonder toestemming geen
     aanbieding. Afwezigheid is dus geen toestemming, en dat hoort uit de stand
     zelf te blijken. */
  const lid = await nieuwLid();

  const onbekend = await api('/api/mijn/post/zet', { soort: 'duivenpost', kanalen: ['email'] }, lid.token);
  assert.equal(onbekend.status, 400);
  assert.match(onbekend.body.error, /soort post kent RTG niet/);

  /* Een onbekend kanaal wordt WEGGEFILTERD en niet overgenomen: wat er in de
     toestemming staat, bepaalt dit huis en niet de client. */
  const zet = await api('/api/mijn/post/zet',
    { soort: 'aanbiedingen', kanalen: ['email', 'duivenpost'], bron: 'toetsscherm' }, lid.token);
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  const aanbiedingen = zet.body.stand.soorten.find(s => s.id === 'aanbiedingen');
  assert.deepEqual(aanbiedingen.kanalen, ['email'], 'een verzonnen kanaal kwam in de toestemming terecht');
  assert.equal(aanbiedingen.aan, true);
  assert.ok(aanbiedingen.sinds, 'een toestemming zonder tijdstip is geen bewijs van toestemming');
  /* De HERKOMST wordt door de route zelf voorafgegaan door "scherm:" -- de bron
     komt van de client en zegt waar de knop stond, niet dat er geklikt is. */
  assert.equal(aanbiedingen.gegevenVia, 'scherm:toetsscherm');

  /* En de andere drie soorten staan nog steeds uit: een ja voor het een is geen
     ja voor de rest. */
  for (const s of zet.body.stand.soorten.filter(s => s.id !== 'aanbiedingen')) {
    assert.equal(s.aan, false, s.id + ' stond aan zonder dat iemand ja zei');
    assert.equal(s.sinds, null);
    assert.equal(s.gegevenVia, null);
  }

  /* Een lege kanalenlijst is intrekken, en dat is de eerlijkste vorm: "waar mag
     dit heen" met nul antwoorden betekent nergens. */
  const in2 = await api('/api/mijn/post/zet', { soort: 'aanbiedingen', kanalen: [] }, lid.token);
  assert.equal(in2.status, 200);
  assert.equal(in2.body.stand.soorten.find(s => s.id === 'aanbiedingen').aan, false,
    'een lege kanalenlijst trok de toestemming niet in');
});

test('12. alles-uit doet het in EEN handeling, en zegt wat er nooit uit kan', async () => {
  const lid = await nieuwLid();
  assert.equal((await api('/api/mijn/post/zet', { soort: 'aanbiedingen', kanalen: ['email'] }, lid.token)).status, 200);
  assert.equal((await api('/api/mijn/post/zet', { soort: 'partners', kanalen: ['sms', 'push'] }, lid.token)).status, 200);

  /* "Afmelden moet net zo makkelijk zijn als aanmelden" is geen vriendelijkheid
     maar een eis: wie vier vinkjes moet omzetten is niet afgemeld maar
     afgeschrikt. Een oproep, alles uit. */
  const uit = await api('/api/mijn/post/alles-uit', {}, lid.token);
  assert.equal(uit.status, 200, JSON.stringify(uit.body));
  assert.equal(uit.body.uitgezet, 2, 'niet alle aangezette soorten gingen uit');
  for (const s of uit.body.stand.soorten) assert.equal(s.aan, false, s.id + ' stond na alles-uit nog aan');

  /* Nog een keer afmelden is geen tweede afmelding: er stond niets meer aan. */
  const nog = await api('/api/mijn/post/alles-uit', {}, lid.token);
  assert.equal(nog.body.uitgezet, 0);

  /* EN DE STAND IS VAN EEN LID EN NIET VAN HET HUIS. Een lid dat hier nooit iets
     zette, heeft geen rij in de opslag -- en dan hoort er niets te staan, niet
     "de eerste rij die we tegenkwamen". Dat klinkt vergezocht tot je bedenkt wat
     de kosten zijn: het ene lid leest dan de toestemming van het andere, en dat
     is precies wat de codenaam-opzet moet voorkomen. */
  const ander = await nieuwLid();
  assert.equal((await api('/api/mijn/post/zet', { soort: 'onderzoek', kanalen: ['email'] }, lid.token)).status, 200);
  const vers = await api('/api/mijn/post/alles-uit', {}, ander.token);
  assert.equal(vers.status, 200);
  assert.equal(vers.body.uitgezet, 0, 'een lid zonder toestemmingen had er toch iets uit te zetten');
  for (const s of vers.body.stand.soorten) {
    assert.equal(s.aan, false, s.id + ': een vers lid las de toestemming van een ander');
  }

  /* WAT ER NOOIT ONDER VALT gaat mee naar het scherm, met de reden per regel.
     Een toestemmingsscherm dat alleen toont wat je KUNT uitzetten, laat denken
     dat de rest ook uit kan -- en dan zet een lid zichzelf blind voor het enige
     bericht dat hij op tijd kan tegenhouden. */
  assert.ok(uit.body.stand.altijd.length >= 4, 'de lijst met wat nooit uit kan ontbreekt of is uitgedund');
  for (const a of uit.body.stand.altijd) {
    assert.ok(a.naam && a.reden, 'een regel op de altijd-lijst zonder reden');
  }
  assert.ok(uit.body.stand.altijd.some(a => /eveiliging/.test(a.naam)),
    'beveiligingswaarschuwingen staan niet op de lijst van wat nooit uit kan');
});
