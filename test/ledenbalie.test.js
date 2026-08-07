/* DE LEDENBALIE: de derde poort van het RTG-kantoor.

   Het kantoor is een ongedeelde ruimte die men binnenkomt met een GEDEELDE
   code, en die code wijst niemand aan. Iemand helpen met zijn abonnement of
   zijn wachtwoord raakt zijn account, en dat hoort niet achter een anonieme
   code te gebeuren. Vandaar de zetel: uitgedeeld vanuit de boardroom,
   gekoppeld aan een echte inlog, precies zoals die kamer het zelf al doet.

   Wat deze toetsen bewaken is vooral wat NIET mag:
   - geen zetel is geen dossier, ook niet met een geldige kantoorcode;
   - een dossier draagt de codenaam, nooit de naam, het adres of het nummer;
   - een reden van niks is geen reden;
   - de balie zet geen wachtwoord en krijgt het adres van het lid niet te zien;
   - een abo-voorstel naar Lifestyle of Business KENT NIETS TOE; dat besluit
     loopt via /api/aanmelding/beslis, en daar zit een mens;
   - en elke raadpleging staat in het bestaande inzagejournaal.

   Draai los: node --experimental-sqlite --test test/ledenbalie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const R = {
  zetels: '/api/office/balie/zetels',
  zetel: '/api/office/balie/zetel',
  zoek: '/api/office/balie/zoek',
  dossier: '/api/office/balie/dossier',
  herstel: '/api/office/balie/herstel',
  klacht: '/api/office/balie/klacht',
  klachtStatus: '/api/office/balie/klacht/status',
  abo: '/api/office/balie/abo'
};

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-balie-'));
const u = Date.now().toString().slice(-8);
const LID = { naam: 'Balie Proefpersoon', email: 'balielid' + u + '@example.nl', tel: '0611' + u };
const REDEN = 'lid belt over een dubbele afschrijving, dossiercontrole';

let srv, base, office, baas, tech, balieOffice, balieKey, lidToken, lidCodenaam, lidId;

function api(pad, body, token, methode) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const init = { method: methode || 'POST', headers: h };
  if (init.method !== 'GET') init.body = JSON.stringify(body || {});
  return fetch(base + pad, init)
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

/* Het inzagejournaal lezen we niet via een eigen luikje maar via het bestaande
   statusbord (server/inzagelog.js -> /api/techniek/status). Zou de balie een
   tweede journaal aanleggen, dan valt hij hier gewoon buiten en zakt toets 7. */
const journaal = () => api('/api/techniek/status', null, tech, 'GET').then(r => r.body.inzage || {});

const outbox = () => { try { return fs.readdirSync(path.join(TMP, 'outbox')); } catch (e) { return []; } };
async function nieuwePost(voor) {
  for (let i = 0; i < 40; i++) {
    const verse = outbox().filter(f => !voor.includes(f));
    if (verse.length) return verse.map(f => fs.readFileSync(path.join(TMP, 'outbox', f), 'utf8'));
    await new Promise(r => setTimeout(r, 100));
  }
  return [];
}

test.before(async () => {
  /* RTG_ENC_KEY leeg: de outbox blijft leesbaar, zodat toets 5 kan zien WAAR de
     herstelmail heen ging. Dat is nu juist wat de balie zelf niet mag zien. */
  srv = await startServer({ env: { SMTP_URL: '', RTG_ENC_KEY: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'RTG-OFFICE' } });
  base = srv.base;

  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  baas = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  assert.ok(office && baas && tech, 'kantoorcode, eigenaar en technische pagina staan open');

  lidToken = (await api('/api/auth/register', { name: LID.naam, email: LID.email, phone: LID.tel,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const mij = (await api('/api/auth/me', {}, lidToken)).body.user;
  lidCodenaam = mij.codename; lidId = mij.id;
  assert.ok(lidCodenaam && lidId, 'het lid heeft een codenaam en een dossier');

  /* De baliemedewerker: een eigen account, dat de kantoorrol koppelt en er een
     kantoorsessie mee start. Zo hangt de sessie aan een mens -- het verschil
     waar deze hele poort om draait. */
  const bal = (await api('/api/auth/register', { name: 'Balie Medewerker', email: 'baliemw' + u + '@example.nl',
    phone: '0622' + u, password: 'geheim123', geboortedatum: '1988-03-03', tier: 'rtg', pasApp: 'rtg' })).body.token;
  balieKey = 'user-' + (await api('/api/auth/me', {}, bal)).body.user.id;
  assert.equal((await api('/api/account/koppel', { soort: 'kantoor', code: 'RTG-OFFICE' }, bal)).status, 200);
  balieOffice = (await api('/api/account/start', { rol: 'kantoor' }, bal)).body.token;
  assert.ok(balieOffice, 'de baliemedewerker heeft een kantoorsessie op naam');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. zonder zetel geen dossier, ook niet met een geldige kantoorcode', async () => {
  const vraag = { id: lidId, reden: REDEN };
  assert.equal((await api(R.dossier, vraag, balieOffice)).status, 403, 'een kantoorsessie op naam is nog geen zetel');
  assert.equal((await api(R.dossier, vraag, office)).status, 403, 'de gedeelde code wijst niemand aan en komt er dus nooit in');
  assert.equal((await api(R.zoek, { codenaam: lidCodenaam }, office)).status, 403, 'zoeken evenmin');
  assert.equal((await api(R.herstel, vraag, office)).status, 403, 'en herstel al helemaal niet');
  assert.equal((await api(R.dossier, vraag, lidToken)).status, 401, 'een gewoon lidtoken is geen kantoor');
  assert.equal((await api(R.zetels, {}, office)).status, 403, 'de zetels zelf zijn bestuurswerk');
});

test('2. de boardroom deelt een zetel uit; daarna mag die persoon wel', async () => {
  assert.equal((await api(R.zetel, { key: balieKey }, office)).status, 403, 'een anonieme code deelt geen zetels uit');
  assert.equal((await api(R.zetel, { key: 'office-gedeeld' }, baas)).status, 400,
    'een zetel hangt aan een persoonlijke inlog, niet aan een gedeelde code');

  const geef = await api(R.zetel, { key: balieKey }, baas);
  assert.equal(geef.status, 200, 'de eigenaar wel: ' + JSON.stringify(geef.body).slice(0, 160));
  assert.ok((geef.body.zetels || []).some(z => z.key === balieKey && z.sinds), 'de zetel staat op de lijst, met sinds-wanneer');

  const zoek = await api(R.zoek, { codenaam: lidCodenaam }, balieOffice);
  assert.equal(zoek.status, 200, 'nu opent de balie');
  assert.ok((zoek.body.treffers || []).some(t => t.codename === lidCodenaam), 'en vindt het lid op codenaam');
  assert.equal((await api(R.dossier, { id: lidId, reden: REDEN }, balieOffice)).status, 200);

  // en de zetel gaat er ook weer af: een sleutel die je niet kunt intrekken ben je kwijt
  assert.equal((await api(R.zetel, { key: balieKey, weg: true }, baas)).status, 200);
  assert.equal((await api(R.dossier, { id: lidId, reden: REDEN }, balieOffice)).status, 403,
    'zonder zetel is de deur meteen weer dicht');
  assert.equal((await api(R.zetel, { key: balieKey }, baas)).status, 200, 'terugzetten voor de rest van de toetsen');
});

test('3. het dossier draagt de codenaam, nooit de naam, het adres of het nummer', async () => {
  const r = await api(R.dossier, { id: lidId, reden: REDEN }, balieOffice);
  assert.equal(r.status, 200);
  const lid = r.body.lid;
  /* Met opzet een dichte lijst en geen "bevat minstens": groeit het dossier er
     ooit een veld bij, dan hoort daar een mens naar te kijken. De kolom die er
     morgen bij komt is een keer het telefoonnummer. */
  assert.deepEqual(Object.keys(lid).sort(), ['abo', 'codename', 'klachten', 'land', 'pas', 'sinds', 'stad', 'steuncode'],
    'precies deze velden en geen enkel veld erbij: ' + Object.keys(lid).join(', '));
  assert.equal(lid.codename, lidCodenaam, 'het lid komt langs als codenaam');

  // het echte bewijs: het antwoord afspeuren op wat in de kluis hoort te blijven
  const alles = JSON.stringify(r.body);
  assert.ok(!alles.includes(LID.email), 'het e-mailadres van de proefpersoon staat er niet in');
  assert.ok(!alles.includes('Proefpersoon'), 'de echte naam evenmin');
  assert.ok(!alles.includes(LID.tel), 'en geen telefoonnummer');
  assert.ok(!/@|paspoort|document|id_doc/i.test(alles), 'geen adres en geen document: ' + alles.slice(0, 200));
});

test('4. zonder reden, of met een reden van niks, geen dossier', async () => {
  const voor = (await journaal()).totaal;
  for (const reden of [undefined, '', '   ', 'test', 'x', '......']) {
    const r = await api(R.dossier, { id: lidId, reden }, balieOffice);
    assert.equal(r.status, 400, 'reden ' + JSON.stringify(reden) + ' hoort te worden geweigerd');
    assert.equal(r.body.lid, undefined, 'en er komt geen dossier mee');
  }
  assert.equal((await journaal()).totaal, voor, 'een geweigerde vraag is geen inzage en komt dus niet in het journaal');
});

test('5. herstel gaat naar het lid; de balie krijgt geen adres en zet geen wachtwoord', async () => {
  assert.equal((await api(R.herstel, { id: lidId, reden: 'x' }, balieOffice)).status, 400, 'ook herstel vraagt een echte reden');

  const voor = outbox();
  const r = await api(R.herstel, { id: lidId, reden: 'lid kan niet meer inloggen, herstel aangevraagd aan de balie' }, balieOffice);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.verstuurd, true, 'de bestaande herstelstroom is in gang gezet');
  const alles = JSON.stringify(r.body);
  assert.ok(!alles.includes('@') && !alles.includes(LID.email), 'geen adres terug naar de balie: ' + alles.slice(0, 160));
  assert.ok(!/reset=|wachtwoord/i.test(alles), 'en geen herstel-link en geen wachtwoord');

  const post = await nieuwePost(voor);
  assert.ok(post.length, 'er ligt post in de outbox');
  assert.ok(post.some(m => m.includes('To: ' + LID.email)), 'die post gaat naar het lid zelf, niet naar de balie');
});

test('6. een abo-voorstel naar Business kent niets toe', async () => {
  const r = await api(R.abo, { id: lidId, naarPas: 'business', reden: 'lid vraagt om zakelijke voorwaarden' }, balieOffice);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.ok(r.body.voorstel, 'er ligt een voorstel');
  assert.notEqual(r.body.voorstel.status, 'toegekend', 'maar toekennen doet de balie niet: ' + JSON.stringify(r.body.voorstel));
  assert.match(String(r.body.let || ''), /menselijk besluit/i, 'en dat wordt ook gezegd');

  const na = await api(R.dossier, { id: lidId, reden: REDEN }, balieOffice);
  assert.equal(na.body.lid.pas, 'rtg', 'de pas van het lid staat er daarna nog precies zo bij');
  assert.equal(na.body.lid.abo.pas, 'rtg', 'ook de abo-stand is niet meegeschoven');
  assert.equal((await api('/api/auth/me', {}, lidToken)).body.user.tier, 'rtg',
    'en het lid zelf merkt er niets van: het besluit loopt via /api/aanmelding/beslis');
});

test('7. elke raadpleging landt in het inzagejournaal, met wie en waarom', async () => {
  const voor = await journaal();
  const eigen = 'controle na klantcontact van vandaag, ' + u;
  assert.equal((await api(R.dossier, { id: lidId, reden: eigen }, balieOffice)).status, 200);
  const na = await journaal();
  assert.ok(na.totaal > voor.totaal, 'het journaal is een regel gegroeid');

  const regel = (na.recent || []).find(x => String(x.waarom || '').includes(u));
  assert.ok(regel, 'de eigen reden staat erin: ' + JSON.stringify((na.recent || []).slice(0, 3)));
  assert.equal(String(regel.overId), String(lidId), 'over wie het ging');
  assert.equal(regel.door, balieKey, 'en wie er keek: de zetel, niet "backoffice"');
  assert.match(String(regel.bron || ''), /balie/i, 'met de balie als bron');
  assert.ok(!JSON.stringify(regel).includes('Proefpersoon'), 'zonder de naam erbij: dat zou een tweede kluis zijn');
  assert.equal(na.zonderReden, voor.zonderReden, 'en geen enkele balie-regel is redenloos');

  // ook zoeken is inzage: wie een codenaam natrekt, laat een spoor na
  const voorZoek = (await journaal()).totaal;
  assert.equal((await api(R.zoek, { codenaam: lidCodenaam }, balieOffice)).status, 200);
  assert.ok((await journaal()).totaal > voorZoek, 'ook een zoekopdracht komt in het journaal');
});

test('8. een klacht kan open en weer dicht', async () => {
  const open = () => api(R.dossier, { id: lidId, reden: REDEN }, balieOffice).then(r => r.body.lid.klachten.length);
  const voor = await open();

  const nieuw = await api(R.klacht, { id: lidId, soort: 'betaling',
    tekst: 'Twee keer de maandbijdrage afgeschreven in juli.' }, balieOffice);
  assert.equal(nieuw.status, 200, JSON.stringify(nieuw.body).slice(0, 200));
  const klacht = nieuw.body.klacht;
  assert.ok(klacht && klacht.id, 'de klacht heeft een nummer');
  assert.equal(klacht.status, 'open');
  assert.equal(await open(), voor + 1, 'het dossier telt hem als openstaand');

  assert.equal((await api(R.klacht, { id: lidId, soort: 'betaling', tekst: 'x' }, balieOffice)).status, 400,
    'een regel van niks is geen klacht');

  const dicht = await api(R.klachtStatus, { klachtId: klacht.id, status: 'gesloten' }, balieOffice);
  assert.equal(dicht.status, 200);
  assert.equal(dicht.body.klacht.status, 'gesloten');
  assert.equal(await open(), voor, 'en dan staat hij niet meer open');
});
