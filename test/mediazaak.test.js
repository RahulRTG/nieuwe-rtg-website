/* MEDIA FOR BUSINESS -- de interne mediawereld van een organisatie.

   Het Podium had de LIVE-kant al (zone 'zaak': een town hall die alleen het
   eigen personeel ziet). Wat ontbrak was het OPGENOMEN werk: een training, een
   werkinstructie, de opname van diezelfde town hall. Dat kon niet bestaan, want
   elk Theaterkanaal is openbaar zodra het kantoor het goedkeurt.

   WAAROM DIT GEEN FILTER IS. Een laag boven de vier domeinen kan alleen kiezen
   uit wat er al is, en alles wat er al is, is openbaar. Een "interne" wereld die
   bestaat uit een selectie van openbaar werk gebruikt het woord intern voor iets
   wat het niet is. Intern ligt daarom bij het PUBLICEREN vast
   (kern/theater/zaak.js), en deze toets rekent precies dat af:

     - de bytes zelf zitten achter de deur, niet alleen de lijst -- wie het
       video-id heeft en er niet werkt, krijgt geen beeld;
     - de interne video staat in GEEN openbare lijst: niet in de zaal van het
       Theater, niet in de gedeelde mediawereld, niet op een profielkaart;
     - een collega ziet hem wel, een medewerker van een ANDER bedrijf niet, en
       wie nergens werkt komt de wereld niet eens in -- drie antwoorden;
     - alleen de leiding begint een interne bibliotheek, en alleen voor een zaak
       waar die leiding ook werkelijk zit.

   Draai los: node --test test/mediazaak.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mediazaak-'));
let srv, base, office;
let baas, collega, vreemde, buiten;
let zaakA, zaakB;
let biebId, videoId, liveId;
const WEBM = Buffer.concat([Buffer.from([0x1A, 0x45, 0xDF, 0xA3]), Buffer.alloc(600, 7)]);

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(naam) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const email = 'mz' + u + '@x.nl', wachtwoord = 'geheim12345';
  const reg = await api('/api/auth/register', { name: naam, email, phone: '06' + u,
    password: wachtwoord, geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, naam + ' is aangemeld');
  const st = await api('/api/state', {}, reg.body.token);
  return { token: reg.body.token, email, wachtwoord, naam, codenaam: st.body.state.user.codename };
}
async function zaakVan(code) {
  const roster = (await api('/api/supplier/roster', { code })).body;
  const man = roster.staff.find(x => x.role === 'manager');
  const login = await api('/api/supplier/login', { code, staffId: man.id, pin: '1234' });
  return { code: roster.supplier.code, naam: roster.supplier.name, token: login.body.token };
}
async function werkBij(zaak, persoon, rol) {
  const inv = await api('/api/supplier/staff/invite', { name: persoon.naam, role: rol, func: 'demo' }, zaak.token);
  const join = await api('/api/supplier/staff/join', { bedrijf: zaak.naam, kassacode: inv.body.invite.kassacode,
    login: persoon.email, password: persoon.wachtwoord });
  assert.equal(join.status, 200, persoon.naam + ' werkt bij ' + zaak.naam);
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  zaakA = await zaakVan('KIKUNOI'); zaakB = await zaakVan('HOSHI');
  baas = await lid('Baas van A'); collega = await lid('Collega van A');
  vreemde = await lid('Baas van B'); buiten = await lid('Werkt nergens');
  await werkBij(zaakA, baas, 'manager');
  await werkBij(zaakA, collega, 'staff');
  await werkBij(zaakB, vreemde, 'manager');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. alleen de leiding begint een interne bibliotheek, en alleen voor de eigen zaak', async () => {
  const nergens = await api('/api/theater/zaak/aanmeld', { naam: 'Intern' }, buiten.token);
  assert.equal(nergens.status, 403);
  assert.match(nergens.body.error, /leiding van een zaak/);

  const geenLeiding = await api('/api/theater/zaak/aanmeld', { naam: 'Intern' }, collega.token);
  assert.equal(geenLeiding.status, 403, 'een medewerker begint er geen');

  const andermans = await api('/api/theater/zaak/aanmeld', { naam: 'Op naam van B', zaakCode: zaakB.code }, baas.token);
  assert.equal(andermans.status, 403, 'en niet op naam van een zaak waar u niets bent');

  const aan = await api('/api/theater/zaak/aanmeld', { naam: 'Interne bibliotheek', zaakCode: zaakA.code }, baas.token);
  assert.equal(aan.status, 200, JSON.stringify(aan.body).slice(0, 160));
  biebId = aan.body.kanaal.id;
  assert.equal(aan.body.kanaal.zaakCode, zaakA.code, 'de bibliotheek draagt de zaak waar hij van is');

  const nogeens = await api('/api/theater/zaak/aanmeld', { naam: 'Nog een', zaakCode: zaakA.code }, baas.token);
  assert.equal(nogeens.status, 409, 'een zaak heeft er een, niet twee');

  // ook een interne bibliotheek gaat pas open na een mens van RTG-kantoor
  assert.equal((await api('/api/office/theater/beslis', { id: biebId, besluit: 'goedgekeurd' }, office)).status, 200);
});

test('2. de leiding publiceert er intern werk in, naast een eigen kanaal', async () => {
  /* Het persoonlijke kanaal en de interne bibliotheek zijn twee verschillende
     dingen. "U heeft al een kanaal" gaat alleen over het persoonlijke -- anders
     zou wie de bibliotheek van zijn werk beheert zijn eigen kanaal kwijt zijn. */
  const eigen = await api('/api/theater/kanaal/aanmeld', { naam: 'Eigen kanaal', genre: 'ambacht' }, baas.token);
  assert.equal(eigen.status, 200, 'hij houdt gewoon een eigen kanaal: ' + JSON.stringify(eigen.body).slice(0, 140));

  const maak = await api('/api/theater/video/maak', { kanaalId: biebId, titel: 'Werkinstructie kassa',
    omschrijving: 'Intern.', duurS: 120 }, baas.token);
  assert.equal(maak.status, 200, JSON.stringify(maak.body).slice(0, 160));
  videoId = maak.body.id;
  const up = await fetch(base + '/api/theater/upload/' + videoId, {
    method: 'POST', headers: { 'Content-Type': 'video/webm', Authorization: 'Bearer ' + baas.token }, body: WEBM });
  assert.equal(up.status, 200, 'de bytes staan erop');

  // en een collega kan er niet in publiceren
  const niet = await api('/api/theater/video/maak', { kanaalId: biebId, titel: 'Van mij', duurS: 10 }, collega.token);
  assert.equal(niet.status, 404, 'zonder leiding bestaat die bibliotheek niet om in te publiceren');
});

test('3. de collega ziet het, de buitenstaander niet -- en dat zijn drie deuren', async () => {
  const mee = await api('/api/theater/zaak', {}, collega.token);
  assert.equal(mee.status, 200);
  assert.equal(mee.body.mag, true);
  assert.ok((mee.body.videos || []).some(v => v.id === videoId), 'wie er werkt ziet de interne video');

  const ander = await api('/api/theater/zaak', {}, vreemde.token);
  assert.equal(ander.status, 200, 'wie ergens anders werkt komt de wereld wel in');
  assert.equal(ander.body.mag, true);
  assert.ok(!(ander.body.videos || []).some(v => v.id === videoId), 'maar ziet het werk van een ander bedrijf niet');

  const geen = await api('/api/theater/zaak', {}, buiten.token);
  assert.equal(geen.body.mag, false, 'wie nergens werkt komt er niet in');
  assert.match(geen.body.reden, /organisaties/);
});

test('4. DE BYTES zitten achter de deur, niet alleen de lijst', async () => {
  /* Dit is de toets die telt. Een interne bibliotheek die alleen uit de lijsten
     is weggelaten, is geen interne bibliotheek: wie het video-id heeft haalt de
     beelden dan gewoon op met een link. */
  const mag = await fetch(base + '/api/theater/kijk/' + videoId + '?token=' + collega.token);
  assert.equal(mag.status, 200, 'de collega krijgt beeld');

  const nietMag = await fetch(base + '/api/theater/kijk/' + videoId + '?token=' + vreemde.token);
  assert.equal(nietMag.status, 404, 'de buitenstaander niet -- ook niet met het id');
  const nooit = await fetch(base + '/api/theater/kijk/' + videoId + '?token=' + buiten.token);
  assert.equal(nooit.status, 404);

  // en reageren of melden op iets wat voor jou niet bestaat, kan ook niet
  const reactie = await api('/api/theater/reactie', { id: videoId, tekst: 'hoi' }, vreemde.token);
  assert.equal(reactie.status, 404);
  const meld = await api('/api/theater/meld', { id: videoId, reden: 'test' }, vreemde.token);
  assert.equal(meld.status, 404);
});

test('5. intern werk staat in geen enkele openbare lijst', async () => {
  const zaal = await api('/api/theater/zaal', {}, collega.token);
  const alles = [...(zaal.body.nieuw || []), ...(zaal.body.abonnementen || [])];
  assert.ok(!alles.some(v => v.id === videoId), 'niet in de openbare zaal, ook niet bij een collega');

  const wereld = await api('/api/mediaos/wereld', { modus: 'kijk' }, collega.token);
  assert.ok(!(wereld.body.stukken || []).some(s => s.id === 'video:' + videoId),
    'niet in de gedeelde mediawereld');

  const profiel = await api('/api/mediaos/maker', { codenaam: baas.codenaam }, collega.token);
  assert.equal(profiel.body.aantallen.video, 0, 'en niet op de profielkaart van de baas');
});

test('6. de stand "Zaak" van de Media OS: intern werk en interne uitzending bij elkaar', async () => {
  /* De live-kant bestond al (Podium, zone 'zaak'). Media for Business zet die
     twee naast elkaar in EEN stand -- en voegt niets samen wat niet al intern
     was: allebei de lezers geven alleen wat bij een zaak van dit lid hoort. */
  const kan = await api('/api/podium/kanaal/aanmeld', { naam: 'Town hall', zone: 'zaak', zaakCode: zaakA.code }, baas.token);
  assert.equal(kan.status, 200, JSON.stringify(kan.body).slice(0, 160));
  liveId = kan.body.kanaal.id;
  await api('/api/office/podium/beslis', { id: liveId, besluit: 'goedgekeurd' }, office);

  const w = await api('/api/mediaos/wereld', { modus: 'zaak' }, collega.token);
  assert.equal(w.status, 200);
  assert.equal(w.body.mag, true);
  const ids = (w.body.stukken || []).map(s => s.id);
  assert.ok(ids.includes('video:' + videoId), 'de interne video staat erin');
  assert.ok(ids.includes('live:' + liveId), 'en de interne uitzending ook');
  assert.ok((w.body.zaken || []).some(z => z.code === zaakA.code), 'met de naam van de zaak erbij');

  const ander = await api('/api/mediaos/wereld', { modus: 'zaak' }, vreemde.token);
  assert.equal(ander.body.mag, true, 'de collega van een ander bedrijf heeft zijn eigen zakenwereld');
  assert.deepEqual((ander.body.stukken || []).map(s => s.id), [], 'en die is leeg -- niets van ons bedrijf erin');

  /* De stand verschijnt alleen bij wie ergens werkt. Een tab die altijd nee
     zegt is geen stand maar een deur naar niets. */
  const modiVanBuiten = (await api('/api/mediaos/wereld', { modus: 'alles' }, buiten.token)).body.modi.map(m => m.id);
  assert.ok(!modiVanBuiten.includes('zaak'), 'wie nergens werkt ziet de stand niet staan');
  const modiVanCollega = (await api('/api/mediaos/wereld', { modus: 'alles' }, collega.token)).body.modi.map(m => m.id);
  assert.ok(modiVanCollega.includes('zaak'), 'en wie ergens werkt wel');
});
