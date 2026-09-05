/* WAT UW WERK U VRAAGT TE BEKIJKEN -- en wat daarbij NIET wordt gemeten.

   Een organisatie met een interne bibliotheek wil kunnen aanwijzen dat iedereen
   de nieuwe werkinstructie moet zien, en zien wie dat gedaan heeft. Dat is
   banaal en belangrijk. De vraag is HOE je het meet.

   Niet met kijkgedrag. RTG meet nergens weergaven, kijktijd of bereik -- dat
   staat met zoveel woorden op het makersbord -- en een uitzondering "omdat het
   nu de baas is die het vraagt" is geen uitzondering maar het einde van die
   regel. De medewerker tekent zelf af; dat is een verklaring van een mens en
   geen meting van een machine.

   WAT HIER BEWEZEN MOET WORDEN:
     - alleen de LEIDING wijst aan, en alleen video uit de eigen interne
       bibliotheek (anders hangt de plicht aan iets van een vreemde);
     - de medewerker tekent zelf af, en kan dat ook terugdraaien;
     - de leiding ziet WIE en WANNEER -- en niets anders: er staat nergens
       kijktijd, aantal keer of apparaat in het antwoord;
     - de medewerker ziet dezelfde lijst als zijn werkgever;
     - wie bij een ANDERE zaak werkt, ziet niets van deze lijst.

   Draai los: node --test test/kijkplicht.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kijkplicht-'));
let srv, base, office;
let baas, collega, vreemde;
let zaakA, zaakB, biebId, videoId, openbaarId, regelId;
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
  const email = 'kp' + u + '@x.nl', wachtwoord = 'geheim12345';
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
  baas = await lid('Baas van A'); collega = await lid('Collega van A'); vreemde = await lid('Baas van B');
  await werkBij(zaakA, baas, 'manager');
  await werkBij(zaakA, collega, 'staff');
  await werkBij(zaakB, vreemde, 'manager');

  // de interne bibliotheek met een video erin
  biebId = (await api('/api/theater/zaak/aanmeld', { naam: 'Intern', zaakCode: zaakA.code }, baas.token)).body.kanaal.id;
  await api('/api/office/theater/beslis', { id: biebId, besluit: 'goedgekeurd' }, office);
  videoId = (await api('/api/theater/video/maak', { kanaalId: biebId, titel: 'Werkinstructie kassa', duurS: 120 }, baas.token)).body.id;
  await fetch(base + '/api/theater/upload/' + videoId, { method: 'POST',
    headers: { 'Content-Type': 'video/webm', Authorization: 'Bearer ' + baas.token }, body: WEBM });

  // en een OPENBARE video van dezelfde baas, om te bewijzen dat die er niet op mag
  const eigen = await api('/api/theater/kanaal/aanmeld', { naam: 'Eigen kanaal', genre: 'ambacht' }, baas.token);
  await api('/api/office/theater/beslis', { id: eigen.body.kanaal.id, besluit: 'goedgekeurd' }, office);
  openbaarId = (await api('/api/theater/video/maak', { titel: 'Gewoon werk', duurS: 30 }, baas.token)).body.id;
  await fetch(base + '/api/theater/upload/' + openbaarId, { method: 'POST',
    headers: { 'Content-Type': 'video/webm', Authorization: 'Bearer ' + baas.token }, body: WEBM });
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. alleen de leiding wijst aan, en alleen uit de eigen interne bibliotheek', async () => {
  const medewerker = await api('/api/theater/kijkplicht/zet', { zaakCode: zaakA.code, videoId }, collega.token);
  assert.equal(medewerker.status, 403, 'een medewerker wijst niets aan');
  assert.match(medewerker.body.error, /leiding/);

  const andermans = await api('/api/theater/kijkplicht/zet', { zaakCode: zaakB.code, videoId }, baas.token);
  assert.equal(andermans.status, 403, 'en niet bij een zaak waar hij niets is');

  /* Een OPENBARE video verplicht stellen kan niet. Dan zou de plicht hangen aan
     iets buiten de eigen wereld -- dat de maker morgen kan weghalen. */
  const openbaar = await api('/api/theater/kijkplicht/zet', { zaakCode: zaakA.code, videoId: openbaarId }, baas.token);
  assert.equal(openbaar.status, 404, 'een openbare video hoort niet op de werklijst');
  assert.match(openbaar.body.error, /interne bibliotheek/);

  const goed = await api('/api/theater/kijkplicht/zet', { zaakCode: zaakA.code, videoId, uiterlijk: '2026-12-31' }, baas.token);
  assert.equal(goed.status, 200, JSON.stringify(goed.body).slice(0, 160));
  assert.equal(goed.body.lijst.length, 1);
  regelId = goed.body.lijst[0].id;

  const nogeens = await api('/api/theater/kijkplicht/zet', { zaakCode: zaakA.code, videoId }, baas.token);
  assert.equal(nogeens.status, 409, 'twee keer dezelfde video is geen lijst');
});

test('2. de medewerker tekent ZELF af -- en kan het terugdraaien', async () => {
  const mijn = await api('/api/theater/kijkplicht/mijn', {}, collega.token);
  assert.equal(mijn.status, 200);
  assert.equal(mijn.body.rijen.length, 1, 'het staat op zijn lijst');
  assert.equal(mijn.body.rijen[0].gedaan, false);
  assert.equal(mijn.body.rijen[0].titel, 'Werkinstructie kassa');
  assert.match(mijn.body.uitleg, /meet geen kijkgedrag/, 'en er staat bij wat er niet gemeten wordt');

  const af = await api('/api/theater/kijkplicht/gedaan', { id: regelId }, collega.token);
  assert.equal(af.status, 200);
  assert.equal(af.body.gedaan, true);
  assert.match(af.body.let, /eigen verklaring/, 'het is een verklaring, geen meting');

  const na = await api('/api/theater/kijkplicht/mijn', {}, collega.token);
  assert.equal(na.body.rijen[0].gedaan, true);
  assert.ok(na.body.rijen[0].gedaanOp, 'met een moment erbij');

  const terug = await api('/api/theater/kijkplicht/gedaan', { id: regelId, aan: false }, collega.token);
  assert.equal(terug.body.gedaan, false, 'wie zich vergist, kan het terugnemen');
  await api('/api/theater/kijkplicht/gedaan', { id: regelId }, collega.token);
});

test('3. de leiding ziet WIE en WANNEER -- en niets meer dan dat', async () => {
  const st = await api('/api/theater/kijkplicht/stand', { zaakCode: zaakA.code }, baas.token);
  assert.equal(st.status, 200, JSON.stringify(st.body).slice(0, 160));
  const regel = st.body.lijst[0];
  assert.equal(regel.titel, 'Werkinstructie kassa');
  const collegaRij = regel.mensen.find(m => m.naam === 'Collega van A');
  assert.ok(collegaRij, 'de medewerker staat erbij, op de naam die de werkgever zelf invoerde');
  assert.equal(collegaRij.gedaan, true);
  assert.ok(collegaRij.gedaanOp);

  /* DE KERN. Er hoort niets in dit antwoord te staan wat op kijkgedrag lijkt.
     Zolang die velden er niet zijn, kan een scherm ze ook niet per ongeluk
     gaan tonen -- en kan niemand ze later "even" gaan gebruiken. */
  /* Alleen de GEGEVENS worden hier afgezocht, niet de uitleg: die zin zegt
     juist dat er geen kijktijd bestaat, en zou zichzelf betrappen. */
  const tekst = JSON.stringify(st.body.lijst).toLowerCase();
  for (const woord of ['kijktijd', 'seconden', 'kijkduur', 'weergaven', 'apparaat', 'voortgang', 'percentage']) {
    assert.equal(tekst.includes(woord), false, 'geen "' + woord + '" in de stand van de werkgever');
  }
  assert.match(st.body.uitleg, /geen kijktijd/, 'en de stand zegt zelf wat hij niet weet');

  // en de codenaam van het RTG-account komt hier niet voorbij
  assert.equal(tekst.includes(String(collega.codenaam).toLowerCase()), false, 'geen codenaam in de personeelslijst van de werkgever');
});

test('4. de medewerker ziet dezelfde lijst, en een vreemde ziet niets', async () => {
  const mijn = await api('/api/theater/kijkplicht/mijn', {}, collega.token);
  assert.equal(mijn.body.rijen.length, 1, 'de eigen kant is aantoonbaar gevuld');
  assert.equal(mijn.body.rijen[0].id, regelId, 'geen dossier waar hij zelf niet in kan');

  const ander = await api('/api/theater/kijkplicht/mijn', {}, vreemde.token);
  assert.deepEqual(ander.body.rijen, [], 'wie bij een andere zaak werkt heeft hier niets staan');
  const stand = await api('/api/theater/kijkplicht/stand', { zaakCode: zaakA.code }, vreemde.token);
  assert.equal(stand.status, 403, 'en ziet de stand van een ander bedrijf niet');
  const zet = await api('/api/theater/kijkplicht/gedaan', { id: regelId }, vreemde.token);
  assert.equal(zet.status, 404, 'en kan er ook niet voor aftekenen');
});

test('5. een regel weghalen kan, en de video blijft gewoon staan', async () => {
  const medewerkerVoor = await api('/api/theater/kijkplicht/mijn', {}, collega.token);
  assert.ok(medewerkerVoor.body.rijen.some(r => r.id === regelId),
    'de medewerker heeft de concrete regel vóór het weghalen');
  const leidingVoor = await api('/api/theater/kijkplicht/stand', { zaakCode: zaakA.code }, baas.token);
  assert.ok(leidingVoor.body.lijst.some(r => r.id === regelId),
    'de leiding heeft dezelfde concrete regel vóór het weghalen');

  const weg = await api('/api/theater/kijkplicht/zet', { zaakCode: zaakA.code, id: regelId, weg: true }, baas.token);
  assert.equal(weg.status, 200);
  assert.equal(weg.body.lijst.some(r => r.id === regelId), false, 'de concrete regel is uit de leidinglijst');
  assert.equal(weg.body.lijst.length, leidingVoor.body.lijst.length - 1,
    'precies één regel is weggehaald');
  const mijn = await api('/api/theater/kijkplicht/mijn', {}, collega.token);
  assert.equal(mijn.body.rijen.some(r => r.id === regelId), false, 'de concrete regel is ook uit de medewerkerslijst');
  assert.equal(mijn.body.rijen.length, medewerkerVoor.body.rijen.length - 1,
    'ook daar verdween precies één regel');
  const zaal = await api('/api/theater/zaak', {}, collega.token);
  assert.ok((zaal.body.videos || []).some(v => v.id === videoId), 'de video staat er nog: een lijst is geen bezit');
});
