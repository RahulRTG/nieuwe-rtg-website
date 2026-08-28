/* DE INTERNE WERELD ONDER DE EIGEN NAAM -- en waar dat ophoudt.

   Een organisatie met een interne bibliotheek wil daar niet "RTG Theater" boven
   zien staan maar haar eigen naam. Dat is de white-label-vraag, en dit is het
   deel ervan dat dit huis eerlijk kan waarmaken: naam, payoff, accentkleur,
   thema en een klein logo, binnen de eigen wereld.

   WAT HIER OOK BEWEZEN MOET WORDEN IS DE GRENS. Een eigen DOMEIN bestaat hier
   niet -- er is geen externe hosting, geen certificaat-machinerie en geen
   routering op hostnaam, en kern/webmaker.js zegt zelf dat het eigen web met
   opzet binnen het ecosysteem blijft. De huisstijl mag dus ook niet doen alsof:
   het antwoord van de server zegt zelf waar hij ophoudt.

   En de merkregels van RTG blijven staan: de kleur van een zaak geldt binnen
   haar eigen blok. Een tenant die de hele app kan omverven, kan een lid laten
   denken dat hij ergens anders is dan hij is.

   Draai los: node --test test/huisstijl.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-huisstijl-'));
let srv, base, office;
let baas, collega, vreemde, zaakA, zaakB, biebId;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(naam) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const email = 'hs' + u + '@x.nl', wachtwoord = 'geheim12345';
  const reg = await api('/api/auth/register', { name: naam, email, phone: '06' + u,
    password: wachtwoord, geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, naam + ' is aangemeld');
  return { token: reg.body.token, email, wachtwoord, naam };
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
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. zonder bibliotheek valt er niets te merken', async () => {
  const zonder = await api('/api/theater/huisstijl', { zaakCode: zaakA.code, naam: 'Bakkerij' }, baas.token);
  assert.equal(zonder.status, 404, 'eerst een interne bibliotheek, dan pas een huisstijl');
  assert.match(zonder.body.error, /nog geen interne bibliotheek/);

  biebId = (await api('/api/theater/zaak/aanmeld', { naam: 'Intern', zaakCode: zaakA.code }, baas.token)).body.kanaal.id;
  await api('/api/office/theater/beslis', { id: biebId, besluit: 'goedgekeurd' }, office);

  /* De standaard is de naam van de zaak en de bordeaux van RTG. Een halve
     huisstijl zou het scherm laten kiezen wat het invult, en dan staat de
     standaard op twee plekken. */
  const zaal = await api('/api/theater/zaak', {}, collega.token);
  const k = (zaal.body.kanalen || [])[0];
  assert.ok(k.huisstijl, 'er is altijd een huisstijl');
  assert.equal(k.huisstijl.naam, zaakA.naam, 'standaard: de naam van de zaak');
  assert.equal(k.huisstijl.accent, '#7F1634', 'en de bordeaux van RTG');
  assert.equal(k.huisstijl.eigen, false, 'nog niets eigen gekozen');
});

test('2. alleen de leiding zet de huisstijl, en alleen van de eigen zaak', async () => {
  const medewerker = await api('/api/theater/huisstijl', { zaakCode: zaakA.code, naam: 'Van mij nu' }, collega.token);
  assert.equal(medewerker.status, 403);
  assert.match(medewerker.body.error, /leiding/);

  const andermans = await api('/api/theater/huisstijl', { zaakCode: zaakA.code, naam: 'Gekaapt' }, vreemde.token);
  assert.equal(andermans.status, 403, 'en niet de huisstijl van een ander bedrijf');

  const goed = await api('/api/theater/huisstijl', { zaakCode: zaakA.code,
    naam: 'Sal de Mar intern', payoff: 'Alles wat de vloer moet weten', accent: '#1b7f5a', thema: 'donker' }, baas.token);
  assert.equal(goed.status, 200, JSON.stringify(goed.body).slice(0, 160));
  assert.equal(goed.body.huisstijl.naam, 'Sal de Mar intern');
  assert.equal(goed.body.huisstijl.accent, '#1B7F5A', 'de hexcode komt terug in een vaste vorm');
  assert.equal(goed.body.huisstijl.thema, 'donker');
  assert.equal(goed.body.huisstijl.eigen, true);
});

test('3. onzin komt er niet in', async () => {
  const kleur = await api('/api/theater/huisstijl', { zaakCode: zaakA.code, accent: 'rood' }, baas.token);
  assert.equal(kleur.status, 400);
  assert.match(kleur.body.error, /hexcode/);
  const thema = await api('/api/theater/huisstijl', { zaakCode: zaakA.code, thema: 'neon' }, baas.token);
  assert.equal(thema.status, 400);
  const logo = await api('/api/theater/huisstijl', { zaakCode: zaakA.code, logo: 'https://ergens/logo.png' }, baas.token);
  assert.equal(logo.status, 400, 'een logo is een klein eigen beeld, geen verwijzing naar buiten');
  assert.match(logo.body.error, /png|jpeg|webp/);

  // en de eerder gezette stijl is er niet door beschadigd
  const na = await api('/api/theater/zaak', {}, collega.token);
  assert.equal((na.body.kanalen || [])[0].huisstijl.accent, '#1B7F5A');
});

test('4. de medewerker ziet de eigen naam, de buitenstaander ziet niets', async () => {
  const mee = await api('/api/theater/zaak', {}, collega.token);
  assert.equal((mee.body.kanalen || [])[0].huisstijl.naam, 'Sal de Mar intern');

  const ander = await api('/api/theater/zaak', {}, vreemde.token);
  assert.equal((ander.body.kanalen || []).length, 0, 'een ander bedrijf ziet deze wereld niet, en dus ook het merk niet');
  assert.equal(JSON.stringify(ander.body).includes('Sal de Mar intern'), false);
});

test('5. de zakenstand van de Media OS draagt het merk -- en zegt waar het ophoudt', async () => {
  const w = await api('/api/mediaos/wereld', { modus: 'zaak' }, collega.token);
  assert.equal(w.status, 200);
  const zaak = (w.body.zaken || []).find(z => z.code === zaakA.code);
  assert.ok(zaak, 'de zaak staat erbij');
  assert.equal(zaak.huisstijl.naam, 'Sal de Mar intern', 'met de eigen naam');
  assert.equal(zaak.huisstijl.accent, '#1B7F5A');

  /* DE GRENS, en hij hoort in het antwoord te staan en niet alleen in een
     README: een eigen domein bestaat hier niet, en de app mag dat ook niet
     suggereren. */
  assert.match(zaak.huisstijl.let, /eigen domein bestaat hier niet/,
    'het antwoord zegt zelf waar de huisstijl ophoudt');
});
