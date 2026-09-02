/* DE PASSKEY ONDER DE ONTSLUITCEREMONIE -- end-to-end, tegen een draaiende
   server, met echte P-256-crypto (test/webauthn-authenticator.js).

   WAT DEZE TOETS BEWIJST, en de derde is de belangrijkste: de stap `passkey`
   wordt niet meer AFGETEKEND maar UITGEVOERD, en de assertie is gebonden aan DIT
   ontsluitverzoek en aan DEZE stap.

   WAAROM DAT ERTOE DOET. Tot 2 september 2026 gaven de routes `bewijs`
   rechtstreeks uit het verzoekslijf door aan `ontsluiting.stap()`, die het
   opsloeg als een string van maximaal 120 tekens. Wie een sessie had
   overgenomen, tekende de zwaarste eis van deze hele laag dus af met het woord
   "proef" -- en precies dat deden de toetsen ook, wat het gat onzichtbaar hield.
   De machinerie lag er al (kern/webauthn-stapop.js bindt een assertie aan een
   account EN aan een doel); alleen riep niemand hem aan.

   HET DOEL IS DE ENIGE SCHEIDING. kern/webauthn-stapop.js bewaart elke stap-op-
   ceremonie onder hetzelfde voorvoegsel `stapop:`, dus zonder een naamsvoorvoegsel
   scheidt alleen toeval de isolatieceremonie van een rtgid-koppel. Vandaar dat
   `doelVoor()` in kern/isolatie/ceremonie-eisen.js zowel het VERZOEK als de STAP
   in het doel zet, en vandaar toets 3 en 4.

   TOETS 7 IS DE ANDERE HELFT, en hij bewaakt iets tegenovergestelds: een eis die
   niemand kan halen maakt het platform onherstelbaar. Een account zonder passkey
   krijgt daarom een ceremonie ZONDER die eis, gemerkt als noodontsluiting met de
   grond `geenPasskey`. Wie toets 7 weghaalt om toets 1 strenger te maken, bouwt
   een deur die op slot gaat met de sleutel erin.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in stapbewijs.js het `doel`-argument vervangen door ''  -> 3 EN 4 ZAKKEN
     (RAAK; dit is de kernmutatie -- zonder doel-binding is de hele reparatie
     een dure niets).
   - `doelVoor` de `soort` laten weglaten -> 4b ZAKT, en 4 NIET. Die eerste ronde
     is een vondst en hoort hier te blijven staan: toets 4 loopt over de ROUTE, en
     daar bereikt de assertie de controle helemaal niet -- `apparaat` vraagt geen
     bewijs, dus de route tekent hem af met de reden en roept `controleer` nooit
     aan. De stapbinding is langs geen enkele route te meten zolang er precies
     EEN stap bewijs vraagt. Toets 4b meet hem daarom een laag lager, op de plek
     waar hij wel bestaat, en zegt dat er met zoveel woorden bij.
   - de route bij een mislukte controleer alsnog laten aftekenen met b.bewijs
                                                     -> 2, 3 EN 6 ZAKKEN (RAAK).
   - de eigendomscontrole mijnVerzoek uit /stap/opties halen  -> 5 ZAKT (RAAK).
   - `passkeyMogelijk` hardcoderen op true                    -> 7 ZAKT (RAAK; en
     dit is de mutatie die het verschil bewaakt tussen streng en onherstelbaar).
   - in stapbewijs.js het doel vervangen door '' -> 1, 3, 4b EN 6 ZAKKEN. Dat 1
     en 6 meezakken komt door de hardening in kern/webauthn-stapop.js: een LEEG
     doel is daar sinds deze ronde geen doel meer. Twee sloten op dezelfde deur,
     en dat is hier geen verspilling -- het bovenste (de weigering) vangt de
     vergeetachtige aanroeper, het onderste (de vergelijking) de kwaadwillende.

   WAT DEZE TOETS BEWUST NIET MEET: dat `apparaat` bewijst dat het toestel
   vertrouwd is. Die bewering bestaat niet -- er is geen register van vertrouwde
   toestellen -- en een groene toets ernaast zou hem laten lijken te bestaan.
   Toets 6 legt juist vast dat die stap zichzelf ONBEWEZEN noemt.

   Draai los: node --test test/isolatie-passkey.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const { maakAuthenticator } = require('./webauthn-authenticator');

let srv, rpID, origin;
function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  return fetch(srv.base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

async function nieuwLid() {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const r = await api('/api/auth/register', {
    name: 'Passkey Lid', email: u + '@x.nl',
    phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business'
  });
  assert.ok(r.body.token, 'lid geregistreerd: ' + JSON.stringify(r.body).slice(0, 200));
  return r.body.token;
}

/* Een passkey aan een account hangen, met de echte ceremonie. De teller loopt
   per sleutel op: de server weigert een assertie waarvan de teller niet is
   gestegen (dat is de kloondetectie), dus een vaste teller zou de tweede
   bevestiging laten zakken om een reden die niets met deze toets te maken heeft.
   Vorm letterlijk overgenomen uit test/rtgid.test.js. */
async function passkeyVoor(token) {
  const a = maakAuthenticator(rpID);
  const o = await api('/api/webauthn/registreer/opties', {}, token);
  assert.equal(o.status, 200);
  const r = await api('/api/webauthn/registreer',
    { antwoord: a.registratieAntwoord(o.body.opties.challenge, origin), naam: 'Toetssleutel' }, token);
  assert.equal(r.status, 200, 'de passkey staat er: ' + JSON.stringify(r.body).slice(0, 160));
  let teller = 0;
  return { teken: (challenge) => a.loginAntwoord(challenge, origin, ++teller) };
}

/* Een lid dat op `beschermd` staat en er weer uit wil. Dat is de overgang die de
   ceremonie vraagt; verstrengen kent er geen. */
async function verzoekVoor(token) {
  const zet = await api('/api/isolatie/mijn/zet',
    { drager: 'identiteit', naar: 'beschermd', reden: 'Ik kreeg een vreemde inlogmelding' }, token);
  assert.equal(zet.status, 200, JSON.stringify(zet.body).slice(0, 160));
  const v = await api('/api/isolatie/mijn/ontsluiting',
    { drager: 'identiteit', naar: 'normaal', reden: 'Toestel opnieuw geverifieerd' }, token);
  assert.equal(v.status, 200, JSON.stringify(v.body).slice(0, 160));
  return v.body.verzoek;
}

test.before(async () => {
  srv = await startServer();
  rpID = new URL(srv.base).hostname;
  origin = new URL(srv.base).origin;
});
test.after(() => stop(srv));

test('1. met een passkey loopt de ceremonie rond en staat de aftekening er', async () => {
  const lid = await nieuwLid();
  const pk = await passkeyVoor(lid);
  const v = await verzoekVoor(lid);
  assert.ok(v.vereisten.includes('passkey'),
    'een account MET passkey krijgt de eis wel: ' + JSON.stringify(v.vereisten));
  assert.equal(v.noodontsluiting, false);

  const o = await api('/api/isolatie/mijn/ontsluiting/stap/opties', { id: v.id, soort: 'passkey' }, lid);
  assert.equal(o.status, 200, 'een ceremonie voor deze stap: ' + JSON.stringify(o.body).slice(0, 200));
  const s = await api('/api/isolatie/mijn/ontsluiting/stap',
    { id: v.id, soort: 'passkey', ceremonie: o.body.ceremonie, antwoord: pk.teken(o.body.opties.challenge) }, lid);
  assert.equal(s.status, 200, JSON.stringify(s.body).slice(0, 200));
  assert.ok(s.body.verzoek.voltooid.passkey, 'de stap is afgetekend');
  /* En het spoor zegt WELKE sleutel tekende. Met twee passkeys op een account is
     dat achteraf altijd de vraag, en "er is bevestigd" beantwoordt hem niet. */
  assert.match(String(s.body.verzoek.voltooid.passkey.bewijs), /^passkey /);
});

test('2. een verzonnen bewijsstring tekent niets meer af', async () => {
  const lid = await nieuwLid();
  await passkeyVoor(lid);
  const v = await verzoekVoor(lid);

  /* Precies wat de oude toetsen deden, en precies wat een aanvaller met alleen
     een gestolen sessie kon. */
  const s = await api('/api/isolatie/mijn/ontsluiting/stap',
    { id: v.id, soort: 'passkey', bewijs: 'proef' }, lid);
  assert.equal(s.status, 401, 'zonder assertie hoort dit te weigeren: ' + JSON.stringify(s.body).slice(0, 160));

  const na = await api('/api/isolatie/mijn', {}, lid);
  const open = (na.body.open || []).find(x => x.id === v.id);
  assert.ok(open, 'het verzoek staat nog open');
  assert.ok(!open.voltooid.passkey, 'en er is NIETS afgetekend');
});

test('3. een ceremonie van verzoek A werkt niet op verzoek B', async () => {
  const lid = await nieuwLid();
  const pk = await passkeyVoor(lid);
  const a = await verzoekVoor(lid);
  const b = await verzoekVoor(lid);
  assert.notEqual(a.id, b.id);

  const o = await api('/api/isolatie/mijn/ontsluiting/stap/opties', { id: a.id, soort: 'passkey' }, lid);
  assert.equal(o.status, 200);
  const s = await api('/api/isolatie/mijn/ontsluiting/stap',
    { id: b.id, soort: 'passkey', ceremonie: o.body.ceremonie, antwoord: pk.teken(o.body.opties.challenge) }, lid);
  assert.equal(s.status, 401, 'de assertie hoort bij een ander verzoek: ' + JSON.stringify(s.body).slice(0, 160));
});

test('4. de stap apparaat verbruikt de assertie van passkey niet', async () => {
  const lid = await nieuwLid();
  const pk = await passkeyVoor(lid);
  /* `apparaat` staat alleen in de eisen bij een ZWARE verlaging: vanuit
     `beschermd` of vanuit een niet te ordenen overgang. Vandaar dat dit verzoek
     uit `beschermd` komt -- daar zit de stap in. */
  const v = await verzoekVoor(lid);
  assert.ok(v.vereisten.includes('apparaat'), 'de zware verlaging vraagt ook apparaat: ' +
    JSON.stringify(v.vereisten));

  const o = await api('/api/isolatie/mijn/ontsluiting/stap/opties', { id: v.id, soort: 'passkey' }, lid);
  assert.equal(o.status, 200);
  const s = await api('/api/isolatie/mijn/ontsluiting/stap',
    { id: v.id, soort: 'apparaat', ceremonie: o.body.ceremonie, antwoord: pk.teken(o.body.opties.challenge) }, lid);
  /* De stap `apparaat` vraagt geen bewijs, dus hij wordt afgetekend -- maar met
     de REDEN uit het register en nooit met de assertie die voor `passkey` was
     bedoeld. Zou hij die assertie accepteren, dan is de stapbinding weg. */
  assert.equal(s.status, 200);
  assert.match(String(s.body.verzoek.voltooid.apparaat.bewijs), /^niet bewezen:/,
    'apparaat tekent zichzelf af met de reden, niet met andermans assertie');
  assert.ok(!s.body.verzoek.voltooid.passkey, 'en de passkey-stap staat nog open');
});

/* 4b. DE STAPBINDING ZELF, een laag lager gemeten -- en met de reden waarom.

   Toets 4 hierboven loopt over de route en raakt deze binding niet: `apparaat`
   vraagt geen bewijs, dus `controleer` wordt er nooit voor aangeroepen. Vandaag
   vraagt precies EEN stap bewijs, en dus is er geen tweede bewijzende stap om de
   assertie naartoe te schuiven. De `soort` in het doel is daarmee een
   voorzorg voor een stap die nog niet bestaat.

   Een voorzorg die niemand meet, is over een half jaar weg. Deze toets meet hem
   daarom op de plek waar hij WEL bestaat: kern/isolatie/stapbewijs.js, met een
   webauthn-laag die alleen opschrijft welk doel er langskwam. Wat hij bewijst is
   het contract -- twee soorten leveren twee doelen op -- en niet de crypto; die
   staat end-to-end in toets 3. */
test('4b. twee soorten leveren twee verschillende doelen op', async () => {
  const maakStapbewijs = require('../server/kern/isolatie/stapbewijs');
  const gezien = [];
  const deel = maakStapbewijs({
    stapOpOpties: async (user, hostnaam, doel) => { gezien.push(['opties', doel]); return { status: 200, opties: {}, ceremonie: 'x' }; },
    stapOpMaak: async (user, ceremonie, antwoord, origin, hostnaam, doel) => { gezien.push(['maak', doel]); return { status: 200, ok: true, credentialId: 'c1' }; }
  });
  const verzoek = { id: 'abc123', vereisten: ['reden', 'passkey', 'apparaat'] };
  const user = { id: 7 };

  await deel.opties({ user, verzoek, soort: 'passkey', hostnaam: 'x' });
  await deel.controleer({ user, verzoek, soort: 'apparaat', ceremonie: 'x', antwoord: {}, origin: '', hostnaam: 'x' });

  const [voorOpties, voorMaak] = gezien.map(g => g[1]);
  assert.notEqual(voorOpties, voorMaak,
    'een ceremonie voor de ene stap mag nooit op de andere passen; beide doelen waren: ' +
    JSON.stringify(gezien));
  assert.match(voorOpties, /:passkey$/);
  assert.match(voorMaak, /:apparaat$/);

  /* En het verzoeknummer zit er ook in -- dat is de binding die toets 3 end-to-end
     meet, hier nog eens op contractniveau zodat een wijziging aan doelVoor() niet
     stilletjes een van de twee helften verliest. */
  assert.ok(voorOpties.includes('abc123'));
});

test('5. de ceremonie van een ander lid levert geen challenge op', async () => {
  const a = await nieuwLid();
  await passkeyVoor(a);
  const va = await verzoekVoor(a);
  const b = await nieuwLid();
  await passkeyVoor(b);

  const o = await api('/api/isolatie/mijn/ontsluiting/stap/opties', { id: va.id, soort: 'passkey' }, b);
  assert.equal(o.status, 404, 'hetzelfde antwoord als op een verzonnen nummer: ' +
    JSON.stringify(o.body).slice(0, 160));
});

test('6. dezelfde ceremonie plus assertie werkt precies een keer', async () => {
  const lid = await nieuwLid();
  const pk = await passkeyVoor(lid);
  const v = await verzoekVoor(lid);

  const o = await api('/api/isolatie/mijn/ontsluiting/stap/opties', { id: v.id, soort: 'passkey' }, lid);
  const antwoord = pk.teken(o.body.opties.challenge);
  const een = await api('/api/isolatie/mijn/ontsluiting/stap',
    { id: v.id, soort: 'passkey', ceremonie: o.body.ceremonie, antwoord }, lid);
  assert.equal(een.status, 200);
  const twee = await api('/api/isolatie/mijn/ontsluiting/stap',
    { id: v.id, soort: 'passkey', ceremonie: o.body.ceremonie, antwoord }, lid);
  assert.equal(twee.status, 401, 'de uitdaging is eenmalig: ' + JSON.stringify(twee.body).slice(0, 160));
});

test('7. een account ZONDER passkey krijgt een noodontsluiting en geen onmogelijke eis', async () => {
  const lid = await nieuwLid();          // met opzet geen passkeyVoor()
  const v = await verzoekVoor(lid);

  assert.ok(!v.vereisten.includes('passkey'),
    'een eis die niemand kan halen sluit een mens buiten zijn eigen bescherming: ' +
    JSON.stringify(v.vereisten));
  assert.equal(v.noodontsluiting, true, 'en dat wordt GEMERKT en niet stil weggelaten');
  const grond = (v.noodGronden || []).map(g => g.grond);
  assert.ok(grond.includes('geenPasskey'),
    'de grond staat er los bij, want "noodontsluiting" alleen zegt niet waarom: ' + JSON.stringify(grond));

  /* EN DE UITGANG IS BEREIKBAAR, wat iets anders is dan meteen open. De reden is
     al afgetekend bij de start; blijft over wat de MENS nog moet leveren, en dat
     is alleen `apparaat`. Wat daarna nog openstaat is de wachttijd -- een klok
     die vanzelf loopt en die niemand kan missen. Dat onderscheid is het hele
     punt van deze toets: een eis die op een mens wacht die niet bestaat, sluit
     hem permanent buiten; een eis die op de klok wacht, niet. */
  const s = await api('/api/isolatie/mijn/ontsluiting/stap', { id: v.id, soort: 'apparaat' }, lid);
  assert.equal(s.status, 200);
  assert.deepEqual(s.body.verzoek.ontbreekt, ['wachttijd'],
    'alles wat een MENS moet leveren is geleverd; wat rest is een klok: ' +
    JSON.stringify(s.body.verzoek.ontbreekt));

  /* En de commit weigert daar netjes op, met de reden -- niet op een eis die
     niemand had kunnen halen. */
  const c = await api('/api/isolatie/mijn/ontsluiting/commit', { id: v.id }, lid);
  assert.equal(c.status, 409);
  assert.match(String(c.body.error), /wachttijd/);
});
