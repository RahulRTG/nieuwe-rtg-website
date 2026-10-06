/* DE POLITICAL CONNECTOR V1 -- partijenregister en voorstellen (POLITIEK.md par.
   7.1, 7.2 en 9; release-trein stap 5).

   Wat hier bewezen wordt:
     1  het register oordeelt niet: alleen aanduiding, niveau, categorie en de
        bron van een officiele registratie; de sleutel is een keer te zien en
        staat alleen als hash in de opslag;
     2  een partij koppelt alleen aan een kwestie die de inbrenger zelf openbaar
        maakte, en de kwestie krijgt alleen een regel op haar tijdlijn;
     3  de aannamelijst staat op onbekend tot een veld MET een bron is ingevuld,
        en niets wordt overschreven;
     4  PARTY_CAPABILITY_PARITY en PARTY_DATA_PARITY: Noord, Midden en Zuid
        krijgen dezelfde velden, dezelfde limiet en dezelfde weigeringen, ook
        als ze een andere categorie hebben;
     5  volgorde: elke dag een plaats verder en voor iedereen gelijk, met een
        neutrale afwezigheid;
     6  wat een partij van een kwestie ziet: onderwerp en gebied, geen datum,
        geen aantal, geen nummer;
     7  uitschrijven wist niets, en de oude sleutel werkt niet meer;
     8  over HTTP tegen een echte server: elke route, de partijdeur zonder
        sleutel dicht, de eigenaar zonder voordeel, de gedeelde code geweigerd;
     9  twee keer hetzelfde verzoek.

   Draai los: node --test test/democratie-partij.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakDemocratie } = require('../server/kern/democratie');
const { maakVoorstellen, AFWEZIG, LIMIETEN } = require('../server/kern/democratie/voorstellen');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

function wereld() {
  const db = { data: {} };
  const d = maakDemocratie({ db, save: () => {}, bijeen: async (fn) => fn(), inBundel: () => true, crypto,
    codenaamVan: (k) => 'Codenaam-' + k, meldLid: (k, n) => n });
  return { db, d };
}
const inschrijving = (aanduiding, categorie) => ({ aanduiding, niveau: 'gemeente', categorie: categorie || 'geregistreerd',
  bron: 'Register gemeentelijke aanduidingen, besluit 2026-12', gecontroleerd: '2026-09-29' });
const voorstel = (kwestie) => ({ kwestie, titel: 'Een veilige oversteek', tekst: 'Een zebrapad met verlichting en een klaarover in de ochtend.',
  bron: 'Verkiezingsprogramma 2026, hoofdstuk 4' });

async function openbareKwestie(d) {
  const k = (await d.inbreng('user-1', { onderwerp: 'De oversteek bij de school is onveilig', gebied: 'Kerkbuurt' })).kwestie;
  await d.doe.start('user-1', { kwestie: k.id, wat: 'Samen een klaarovergang regelen', zichtbaar: true });
  return k;
}
async function drie(d) {
  const uit = {};
  for (const [naam, cat] of [['Partij Noord', 'geregistreerd'], ['Partij Midden', 'deelnemer'], ['Partij Zuid', 'geregistreerd']]) {
    const r = await d.register.registreer('user-kantoor', inschrijving(naam, cat));
    assert.equal(r.ok, true, naam + ': ' + JSON.stringify(r));
    uit[naam] = d.partijVanSleutel(r.sleutel);
  }
  return uit;
}

test('1. het register oordeelt niet, en de sleutel staat alleen als hash in de opslag', async () => {
  const { db, d } = wereld();
  assert.equal((await d.register.registreer('user-kantoor', { aanduiding: 'Partij Noord', niveau: 'gemeente', categorie: 'geregistreerd', gecontroleerd: '2026-09-29' })).status, 400,
    'zonder bron geen inschrijving');
  assert.equal((await d.register.registreer('user-kantoor', inschrijving('Partij Noord', 'favoriet'))).status, 400, 'alleen de twee categorieen');
  assert.equal(Object.keys(db.data.democratiePartijen || {}).length, 0, 'een weigering laat niets achter');
  const r = await d.register.registreer('user-kantoor', inschrijving('Partij Noord'));
  assert.equal(r.ok, true);
  assert.match(r.partij.id, /^PP-[0-9A-F]{6}$/);
  assert.deepEqual(Object.keys(r.partij).sort(), ['aanduiding', 'bron', 'categorie', 'id', 'niveau', 'stand'],
    'geen veld voor ideologie, grootte of betrouwbaarheid');
  assert.ok(!JSON.stringify(db.data).includes(r.sleutel), 'de sleutel zelf staat nergens in de opslag');
  assert.equal(d.partijVanSleutel(r.sleutel).id, r.partij.id);
  assert.equal(d.partijVanSleutel(r.sleutel.slice(0, -2) + 'xx'), null, 'een verkeerde sleutel opent niets');
  assert.equal(d.partijVanSleutel(''), null);
  assert.equal((await d.register.registreer('user-kantoor', inschrijving('partij noord'))).status, 409, 'dezelfde aanduiding op hetzelfde niveau');
  assert.equal(db.data.democratiePartijen[r.partij.id].ingeschreven.door, 'Codenaam-user-kantoor', 'op naam (DO-09)');
});

test('2. een partij koppelt alleen aan een openbare kwestie, en de kwestie krijgt alleen een regel', async () => {
  const { db, d } = wereld();
  const { 'Partij Noord': noord } = await drie(d);
  const prive = (await d.inbreng('user-2', { onderwerp: 'Een kwestie die niemand openbaar maakte' })).kwestie;
  assert.equal((await d.partij.plaats(noord, voorstel(prive.id))).status, 404, 'een niet-openbare kwestie is voor een partij onzichtbaar');
  assert.ok(!d.partij.kwesties().kwesties.some(k => k.id === prive.id));
  const k = await openbareKwestie(d);
  const r = await d.partij.plaats(noord, voorstel(k.id));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.voorstel.kwestie, k.id);
  const tijdlijn = d.mijn('user-1').kwesties[0].tijdlijn;
  assert.ok(tijdlijn.some(t => t.wat === 'voorstel'), 'de kwestie weet dat er een voorstel werd gekoppeld');
  assert.ok(!('partij' in db.data.democratieKwesties[k.id]) && !('voorstellen' in db.data.democratieKwesties[k.id]),
    'de kwestie bezit het voorstel niet (ISSUE_PARTY_NEUTRALITY)');
  assert.equal((await d.partij.plaats(noord, { titel: 'Zonder bron', tekst: 'Een voorstel zonder letterlijke bron erbij.' })).status, 400,
    'een voorstel zonder bron komt er niet in');
  const los = await d.partij.plaats(noord, { titel: 'Over wonen', tekst: 'Een voorstel over wonen zonder kwestie erbij.', bron: 'Programma, hoofdstuk 2' });
  assert.equal(los.ok, true, 'een voorstel mag ook zonder kwestie');
  const inbrenger = d.mijn('user-1').kwesties[0].voorstellen;
  assert.equal(inbrenger.plekken.find(p => p.partij.id === noord.id).voorstellen[0].id, r.voorstel.id, 'de inbrenger ziet het voorstel bij zijn kwestie');
});

test('3. de aannamelijst staat op onbekend tot er een bron is, en niets wordt overschreven', async () => {
  const { db, d } = wereld();
  const { 'Partij Noord': noord, 'Partij Zuid': zuid } = await drie(d);
  const v = (await d.partij.plaats(noord, voorstel(null))).voorstel;
  assert.deepEqual(v.aannames.map(a => a.stand), Array(7).fill('onbekend'));
  assert.equal((await d.partij.aanname(noord, { id: v.id, veld: 'kosten', waarde: '2 miljoen' })).status, 400, 'zonder bron blijft het onbekend');
  assert.equal((await d.partij.aanname(noord, { id: v.id, veld: 'score', waarde: 'x', bron: 'bron bron' })).status, 400, 'alleen velden uit de lijst');
  assert.equal((await d.partij.aanname(zuid, { id: v.id, veld: 'kosten', waarde: 'niets', bron: 'eigen raming' })).status, 404,
    'een andere partij raakt dit voorstel niet');
  const a1 = await d.partij.aanname(noord, { id: v.id, veld: 'kosten', waarde: '2 miljoen', bron: 'Begroting 2027, p. 14' });
  assert.equal(a1.voorstel.aannames.find(a => a.veld === 'kosten').stand, 'ingevuld');
  assert.equal((await d.partij.aanname(noord, { id: v.id, veld: 'kosten', waarde: '2 miljoen', bron: 'Begroting 2027, p. 14' })).herhaling, true);
  await d.partij.aanname(noord, { id: v.id, veld: 'kosten', waarde: '3 miljoen', bron: 'Herziene begroting' });
  await d.partij.toelicht(noord, { id: v.id, tekst: 'De kosten stegen door de hogere prijs van verlichting.', bron: 'Offerte' });
  const keten = db.data.democratieVoorstellen[v.id].keten.map(r => r.wat + (r.waarde ? ':' + r.waarde : '')).reverse();
  assert.deepEqual(keten, ['geplaatst', 'aanname:2 miljoen', 'aanname:3 miljoen', 'toelichting'], 'de oude waarde blijft in de keten (DO-10)');
});

test('4. Noord, Midden en Zuid: dezelfde velden, dezelfde limiet, dezelfde weigeringen (PARTY_*_PARITY)', async () => {
  const { d } = wereld();
  const partijen = await drie(d);
  const k = await openbareKwestie(d);
  const vorm = (x) => JSON.stringify(x, (key, w) => (['id', 'aanduiding', 'categorie', 'at', 'kwestie'].includes(key) ? '·' : w));
  const uit = {};
  for (const [naam, p] of Object.entries(partijen)) {
    const log = [];
    log.push(vorm(d.partij.wie(p)));
    log.push(vorm(d.partij.kwesties()));
    const v = await d.partij.plaats(p, voorstel(k.id));
    log.push(vorm(v));
    log.push(vorm(await d.partij.toelicht(p, { id: v.voorstel.id, tekst: 'Dezelfde toelichting voor elke partij.' })));
    log.push(vorm(await d.partij.aanname(p, { id: v.voorstel.id, veld: 'uitvoerder', waarde: 'De gemeente', bron: 'Gemeentewet' })));
    log.push(vorm(await d.partij.plaats(p, { titel: 'x' })));
    let n = 1;
    while ((await d.partij.plaats(p, voorstel(null))).ok) n++;
    log.push('limiet:' + n);
    uit[naam] = log;
  }
  const [noord, ...rest] = Object.values(uit);
  for (const r of rest) assert.deepEqual(r, noord, 'een andere partij krijgt iets anders');
  assert.equal(noord[noord.length - 1], 'limiet:' + LIMIETEN.voorstellenPerDag);
});

test('5. volgorde: elke dag een plaats verder, voor iedereen gelijk, met een neutrale afwezigheid', () => {
  const rij = ['PP-000001', 'PP-000002', 'PP-000003'].map((id, i) => ({ id, aanduiding: 'P' + i, niveau: 'gemeente', categorie: 'geregistreerd', bron: {}, stand: 'actief' }));
  const partijen = { lijst: () => ({ partijen: rij }), vind: (id) => rij.find(p => p.id === id), beeld: (p) => p };
  let ms = Date.UTC(2026, 8, 29, 12);
  const vs = maakVoorstellen({ kaart: () => ({}), kijk: () => ({}), vastleggen: async () => null, crypto, nu: () => new Date(ms).toISOString(),
    nuMs: () => ms, partijen, zoekKwestie: () => null, openbaar: () => [], schrijver: {} });
  const orde = () => vs.bijKwestie('KW-1').plekken.map(p => p.partij.id);
  const vandaag = orde();
  assert.deepEqual(orde(), vandaag, 'twee lezers op dezelfde dag zien dezelfde volgorde');
  ms += 86400000;
  const morgen = orde();
  assert.deepEqual(morgen, vandaag.slice(1).concat(vandaag.slice(0, 1)), 'morgen schuift de lijst een plaats op');
  ms += 3 * 86400000;
  assert.deepEqual(orde(), morgen, 'na drie dagen is de rij van drie weer rond');
  for (const p of vs.bijKwestie('KW-1').plekken) assert.equal(p.afwezig, AFWEZIG, 'dezelfde afwezigheid voor elke partij');
  assert.match(vs.bijKwestie('KW-1').volgorde.regel, /voor iedereen gelijk/);
});

test('6. wat een partij van een kwestie ziet: onderwerp en gebied, geen datum, geen aantal, geen nummer', async () => {
  const { d } = wereld();
  await drie(d);
  const k = await openbareKwestie(d);
  await d.doe.aansluit('user-2', d.doe.lijst('user-2').acties[0].id);
  const lijst = d.partij.kwesties();
  assert.deepEqual(lijst.kwesties, [{ id: k.id, onderwerp: 'De oversteek bij de school is onveilig', gebied: 'Kerkbuurt' }]);
  assert.ok(!/ib-|user-|Codenaam|\d{4}-\d{2}-\d{2}/.test(JSON.stringify(lijst)), 'geen nummer, sleutel, naam of datum');
});

test('7. uitschrijven wist niets, en de oude sleutel werkt niet meer', async () => {
  const { d } = wereld();
  const r = await d.register.registreer('user-kantoor', inschrijving('Partij Noord'));
  const noord = d.partijVanSleutel(r.sleutel);
  const k = await openbareKwestie(d);
  const v = (await d.partij.plaats(noord, voorstel(k.id))).voorstel;
  const nieuw = await d.register.sleutel('user-kantoor', { id: noord.id });
  assert.equal(d.partijVanSleutel(r.sleutel), null, 'de vervangen sleutel werkt niet meer');
  assert.equal(d.partijVanSleutel(nieuw.sleutel).id, noord.id);
  assert.equal((await d.register.uitschrijf('user-kantoor', { id: noord.id, reden: 'kort' })).status, 400, 'uitschrijven vraagt een reden');
  const uit = await d.register.uitschrijf('user-kantoor', { id: noord.id, reden: 'De registratie is vervallen, zie het register.' });
  assert.equal(uit.partij.stand, 'uitgeschreven');
  assert.equal(d.partijVanSleutel(nieuw.sleutel), null, 'een uitgeschreven partij komt niet meer binnen');
  const plek = d.mijn('user-1').kwesties[0].voorstellen.plekken.find(p => p.partij.id === noord.id);
  assert.equal(plek.voorstellen[0].id, v.id, 'het voorstel blijft staan');
  assert.equal(plek.partij.stand, 'uitgeschreven', 'met de stand van de partij erbij');
});

const OFFICE_CODE = 'PARTIJDEUR-1';
let srv, api;
test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE } });
  api = (pad, body, token, kop) => fetch(srv.base + pad, { method: 'POST', signal: AbortSignal.timeout(20000),
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, kop || {}),
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, versie: r.headers.get('rtg-democratie-versie'), body: await r.json().catch(() => ({})) }));
});
test.after(() => { stop(srv && srv.child); });

let n = 0;
async function lid() {
  const u = String(Date.now() + (++n)).slice(-8);
  const r = await api('/api/auth/register', { name: 'Partijtoets ' + u, email: 'pt' + u + '@x.nl', phone: '06' + u,
    password: 'geheim12345', geboortedatum: '1990-03-03', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.body.token, 'registreren: ' + JSON.stringify(r.body).slice(0, 160));
  return r.body.token;
}
const sleutel = (s) => ({ 'x-partij-sleutel': s });

test('8. over HTTP: elke route, de partijdeur zonder sleutel dicht, de eigenaar zonder voordeel', async () => {
  const kantoor = await kantoorAlsPersoon(srv.base, OFFICE_CODE);
  assert.ok(kantoor, 'een kantoormens op naam');
  const gedeeld = (await api('/api/office/login', { code: OFFICE_CODE })).body.token;
  assert.ok(gedeeld, 'de gedeelde kantoorcode geeft een token');
  assert.equal((await api('/api/office/democratie/partij/registreer', inschrijving('Partij Gedeeld'), gedeeld)).status, 403,
    'met de gedeelde code schrijft niemand een partij in');

  const reg = await api('/api/office/democratie/partij/registreer', inschrijving('Partij Noord'), kantoor);
  assert.equal(reg.status, 200, 'registreer: ' + JSON.stringify(reg.body));
  const s = reg.body.sleutel;
  const pid = reg.body.partij.id;
  assert.equal((await api('/api/office/democratie/partij/lijst', {}, kantoor)).body.partijen.find(p => p.id === pid).stand, 'actief');

  assert.equal((await api('/api/democratie/partij/wie', {})).status, 401, 'zonder sleutel is de deur dicht');
  const inbrenger = await lid();
  assert.equal((await api('/api/democratie/partij/wie', {}, inbrenger)).status, 401, 'een ledensessie is geen partij');
  const eigenaar = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(eigenaar, 'de eigenaar logt in');
  assert.equal((await api('/api/democratie/partij/voorstel/plaats', voorstel(null), eigenaar)).status, 401,
    'de eigenaar van RTG plaatst geen voorstel zonder partijsleutel (OWNER_NO_ADVANTAGE)');

  const wie = await api('/api/democratie/partij/wie', {}, null, sleutel(s));
  assert.equal(wie.status, 200);
  assert.equal(wie.body.partij.id, pid);
  assert.equal(wie.versie, 'v1', 'de API-versie staat in de kop');

  const k = (await api('/api/member/democratie/kwestie/inbreng', { onderwerp: 'Geen bankjes bij de bushalte', gebied: 'Centrum' }, inbrenger)).body.kwestie;
  assert.equal((await api('/api/democratie/partij/kwesties', {}, null, sleutel(s))).body.kwesties.some(x => x.id === k.id), false,
    'zonder actie is de kwestie niet openbaar');
  await api('/api/member/democratie/actie/start', { kwestie: k.id, wat: 'Samen een bankje voorstellen', zichtbaar: true }, inbrenger);
  assert.equal((await api('/api/democratie/partij/kwesties', {}, null, sleutel(s))).body.kwesties.some(x => x.id === k.id), true);

  const pl = await api('/api/democratie/partij/voorstel/plaats', voorstel(k.id), null, sleutel(s));
  assert.equal(pl.status, 200, 'plaats: ' + JSON.stringify(pl.body));
  const vid = pl.body.voorstel.id;
  assert.equal((await api('/api/democratie/partij/voorstel/toelicht', { id: vid, tekst: 'Twee bankjes, betaald uit het wijkbudget.' }, null, sleutel(s))).status, 200);
  assert.ok((await api('/api/democratie/partij/voorstel/mijn', {}, null, sleutel(s))).body.voorstellen
    .find(v => v.id === vid).toelichtingen.some(t => t.tekst === 'Twee bankjes, betaald uit het wijkbudget.'));
  assert.equal((await api('/api/democratie/partij/voorstel/aanname', { id: vid, veld: 'betaler', waarde: 'Wijkbudget', bron: 'Begroting 2027' }, null, sleutel(s))).status, 200);
  assert.equal((await api('/api/democratie/partij/voorstel/mijn', {}, null, sleutel(s))).body.voorstellen[0].id, vid);

  const buur = await lid();
  const gezien = await api('/api/member/democratie/kwestie/voorstellen', { id: k.id }, buur);
  assert.equal(gezien.status, 200, 'een lid leest de voorstellen bij een openbare kwestie');
  assert.equal(gezien.body.plekken.find(p => p.partij.id === pid).voorstellen[0].id, vid);
  const zelf = await api('/api/member/democratie/kwestie/voorstellen', { id: k.id }, inbrenger);
  assert.deepEqual(zelf.body.plekken, gezien.body.plekken, 'de inbrenger en een buur zien hetzelfde');
  const kant = (await api('/api/office/democratie/kwestie/lijst', {}, kantoor)).body.kwesties.find(x => x.id === k.id);
  assert.deepEqual(kant.voorstellen.plekken, gezien.body.plekken, 'het kantoor ziet hetzelfde als een lid');

  const nieuw = await api('/api/office/democratie/partij/sleutel', { id: pid }, kantoor);
  assert.equal(nieuw.status, 200);
  assert.equal((await api('/api/democratie/partij/wie', {}, null, sleutel(s))).status, 401, 'de oude sleutel is dicht');
  assert.equal((await api('/api/office/democratie/partij/uitschrijf', { id: pid, reden: 'Registratie vervallen volgens het register.' }, kantoor)).status, 200);
  assert.equal((await api('/api/democratie/partij/wie', {}, null, sleutel(nieuw.body.sleutel))).status, 401, 'uitgeschreven is dicht');
});

test('9. twee keer hetzelfde verzoek: wat idempotent is en wat een toestandscontrole is', async () => {
  const kantoor = await kantoorAlsPersoon(srv.base, OFFICE_CODE);
  const reg = await api('/api/office/democratie/partij/registreer', inschrijving('Partij Herhaal'), kantoor);
  assert.equal((await api('/api/office/democratie/partij/registreer', inschrijving('Partij Herhaal'), kantoor)).status, 409,
    'een tweede inschrijving met dezelfde aanduiding wordt geweigerd, niet dubbel');
  const s = reg.body.sleutel;
  for (const pad of ['/api/democratie/partij/wie', '/api/democratie/partij/kwesties', '/api/democratie/partij/voorstel/mijn']) {
    const [a, b] = [await api(pad, {}, null, sleutel(s)), await api(pad, {}, null, sleutel(s))];
    assert.deepEqual(a.body, b.body, pad + ' leest twee keer hetzelfde');
  }
  const vid = (await api('/api/democratie/partij/voorstel/plaats', voorstel(null), null, sleutel(s))).body.voorstel.id;
  const aan = { id: vid, veld: 'regel', waarde: 'Geen', bron: 'Gemeentewet art. 1' };
  await api('/api/democratie/partij/voorstel/aanname', aan, null, sleutel(s));
  assert.equal((await api('/api/democratie/partij/voorstel/aanname', aan, null, sleutel(s))).body.herhaling, true, 'dezelfde aanname nog eens verandert niets');
  /* Twee partijen achter hetzelfde adres, vlak na elkaar met hetzelfde lijf:
     de partijdeur heeft geen sessie, dus een duplicaatlaag zou ze alleen op
     het lijf en het ip-adres kunnen onderscheiden. Elke partij hoort haar
     eigen antwoord te krijgen. */
  const ander = (await api('/api/office/democratie/partij/registreer', inschrijving('Partij Buurman'), kantoor)).body.sleutel;
  for (const pad of ['/api/democratie/partij/wie', '/api/democratie/partij/voorstel/mijn']) {
    const [a, b] = [await api(pad, {}, null, sleutel(s)), await api(pad, {}, null, sleutel(ander))];
    assert.notDeepEqual(a.body, b.body, pad + ': de tweede partij kreeg het antwoord van de eerste');
  }
  const aanAnder = await api('/api/democratie/partij/voorstel/aanname', aan, null, sleutel(ander));
  assert.equal(aanAnder.status, 404, 'hetzelfde lijf van een andere partij raakt het voorstel niet en krijgt geen afgespeeld succes');
  const pid = reg.body.partij.id;
  await api('/api/office/democratie/partij/uitschrijf', { id: pid, reden: 'Op verzoek van de partij zelf, per brief.' }, kantoor);
  const nogEens = await api('/api/office/democratie/partij/uitschrijf', { id: pid, reden: 'Op verzoek van de partij zelf, per brief.' }, kantoor);
  assert.equal(nogEens.status, 200, 'nog eens uitschrijven is geen fout');
  assert.equal(nogEens.body.partij.stand, 'uitgeschreven');
  assert.equal((await api('/api/office/democratie/partij/sleutel', { id: pid }, kantoor)).status, 409, 'geen sleutel voor een uitgeschreven partij');
});

test('10. een partijsleutel verloopt na een jaar en is een credential uit kern/bearercode', async () => {
  const { maakPartijen } = require('../server/kern/democratie/partijen');
  const register = {};
  let ms = Date.UTC(2026, 8, 29, 12);
  const partijen = maakPartijen({ kaart: () => register, kijk: () => register, vastleggen: async (fn) => { fn(); return null; },
    crypto, nu: () => new Date(ms).toISOString() });
  const r = await partijen.registreer('Codenaam-kantoor', inschrijving('Partij Tijd'));
  assert.match(r.sleutel, /^PP\.[0-9A-F]{32}$/, '128 bits in het vaste formaat van kern/bearercode');
  const opslag = register[r.partij.id].sleutel;
  assert.equal(opslag.doel, 'partijdeur');
  assert.deepEqual(opslag.scope, ['democratie.partij.voorstel']);
  assert.ok(!JSON.stringify(opslag).includes(r.sleutel.slice(3)), 'alleen de hash staat op schijf');
  assert.equal(partijen.vanSleutel(r.sleutel.toLowerCase()).id, r.partij.id, 'de code is hoofdletterongevoelig, zoals elke bearercode');
  ms += 364 * 86400000;
  assert.ok(partijen.vanSleutel(r.sleutel), 'binnen het jaar werkt hij');
  ms += 2 * 86400000;
  assert.equal(partijen.vanSleutel(r.sleutel), null, 'na een jaar niet meer: het kantoor geeft een nieuwe uit');
  const nieuw = await partijen.vervangSleutel('Codenaam-kantoor', r.partij.id);
  assert.equal(partijen.vanSleutel(nieuw.sleutel).id, r.partij.id, 'vervangen geeft weer een jaar');
});
