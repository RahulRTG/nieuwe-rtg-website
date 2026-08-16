/* De HTTP-grens van de Magnaat Partnerstudio.

   De domeintoetsen bewijzen de bedrijfsregels en de browsertoets bewijst de
   gebruikersweg, maar zonder deze toets bleven veertien echte routes buiten
   het routejournaal van de volledige Node-suite. Hier loopt dezelfde keten
   daarom door de echte server, met echte partner-, boardroom- en techniek-
   authenticatie. Geen route krijgt een gratis dekkingspunt: de mutaties
   veranderen werkelijk een geisoleerde digitale tweeling en de beveiligde
   deuren worden ook zonder sessie beproefd. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-partnerstudio-routes-'));
const SUPPLIER_ROUTES = [
  '/api/supplier/magnaat/studio',
  '/api/supplier/magnaat/studio/profiel',
  '/api/supplier/magnaat/studio/bouwsteen',
  '/api/supplier/magnaat/studio/bouwsteen/weg',
  '/api/supplier/magnaat/studio/importeer',
  '/api/supplier/magnaat/studio/proef/start',
  '/api/supplier/magnaat/studio/proef/stap',
  '/api/supplier/magnaat/studio/relatie',
  '/api/supplier/magnaat/studio/relatie/beslis',
  '/api/supplier/magnaat/studio/indienen',
  '/api/supplier/magnaat/studio/indienen/intrekken'
];
const BOARDROOM_ROUTES = [
  '/api/office/magnaat/partners',
  '/api/office/magnaat/partner/beslis'
];

let srv, base, kikunoi, hoshi, eigenaar, techniek;

async function api(pad, body = {}, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function partner(code) {
  const rooster = await api('/api/supplier/roster', { code });
  const manager = (rooster.body.staff || []).find(x => x.role === 'manager');
  assert.ok(manager, code + ' heeft een manager in de testseed');
  const login = await api('/api/supplier/login', { code, staffId: manager.id, pin: '1234' });
  assert.equal(login.status, 200, code + ' manager logt in');
  assert.ok(login.body.token, code + ' krijgt een zaak-token');
  return login.body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  kikunoi = await partner('KIKUNOI');
  hoshi = await partner('HOSHI');
  eigenaar = (await api('/api/auth/login', {
    login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business'
  })).body.token;
  techniek = (await api('/api/techniek/inloggen', {
    login: 'roellie.i@gmail.com', wachtwoord: 'Imran'
  })).body.token;
  assert.ok(eigenaar, 'de eigenaar krijgt zijn herleidbare boardroom-sessie');
  assert.ok(techniek, 'de eigenaar krijgt zijn techniek-sessie');
});

test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('alle Partnerstudio-, boardroom- en integriteitsdeuren zijn dicht zonder sessie', async () => {
  for (const pad of [...SUPPLIER_ROUTES, ...BOARDROOM_ROUTES, '/api/techniek/controle/integriteit']) {
    const r = await api(pad);
    assert.ok([401, 403].includes(r.status), pad + ' moet zonder sessie dicht zijn, kreeg ' + r.status);
  }
});

test('een officiele partner doorloopt de echte HTTP-keten zonder geld of productiedata', async () => {
  let r = await api('/api/supplier/magnaat/studio', {}, kikunoi);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 180));
  assert.equal(r.body.tweeling.code, 'KIKUNOI');

  r = await api('/api/supplier/magnaat/studio/importeer', { versie: r.body.tweeling.versie }, kikunoi);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 180));
  assert.ok(r.body.overgenomen.aanbod > 0, 'publieke menunamen worden veilig trainingsaanbod');
  assert.equal(JSON.stringify(r.body.tweeling.aanbod).includes('price'), false, 'prijzen komen niet mee');

  r = await api('/api/supplier/magnaat/studio/profiel', {
    versie: r.body.tweeling.versie,
    sector: 'Gastvrijheid', bedrijfsmodel: 'dienstverlening',
    omschrijving: 'Wij leveren gastvrijheid met controleerbare processen, duidelijke rollen en veilige overdracht.',
    trainingsdoel: 'Medewerkers oefenen realistische dienstsituaties en aantoonbare overdracht.',
    merkInSpel: true, synthetischeDossiers: true, geheimenUitgesloten: true
  }, kikunoi);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 180));

  r = await api('/api/supplier/magnaat/studio/bouwsteen', {
    soort: 'locatie', versie: r.body.tweeling.versie,
    naam: 'Trainingsrestaurant', plaats: 'Ibiza', locatieSoort: 'restaurant'
  }, kikunoi);
  assert.equal(r.status, 200);
  r = await api('/api/supplier/magnaat/studio/bouwsteen', {
    soort: 'afdeling', versie: r.body.tweeling.versie,
    naam: 'Operations', doel: 'Bewaakt kwaliteit, continuiteit en veilige overdracht.'
  }, kikunoi);
  assert.equal(r.status, 200);
  const afdelingId = r.body.tweeling.afdelingen[0].id;

  r = await api('/api/supplier/magnaat/studio/bouwsteen', {
    soort: 'rol', versie: r.body.tweeling.versie, naam: 'Shift lead', afdelingId,
    rechten: ['bekijken', 'goedkeuren']
  }, kikunoi);
  assert.equal(r.status, 200);
  const rolId = r.body.tweeling.rollen[0].id;

  r = await api('/api/supplier/magnaat/studio/bouwsteen', {
    soort: 'aanbod', versie: r.body.tweeling.versie,
    naam: 'Tijdelijke trainingsdienst', categorie: 'Training', eenheid: 'sessie'
  }, kikunoi);
  assert.equal(r.status, 200);
  const tijdelijk = r.body.tweeling.aanbod.find(x => x.naam === 'Tijdelijke trainingsdienst');
  assert.ok(tijdelijk);
  r = await api('/api/supplier/magnaat/studio/bouwsteen/weg', {
    soort: 'aanbod', versie: r.body.tweeling.versie, id: tijdelijk.id
  }, kikunoi);
  assert.equal(r.status, 200, 'een bewuste revisie kan ook via de echte route worden verwijderd');

  r = await api('/api/supplier/magnaat/studio/bouwsteen', {
    soort: 'werkproces', versie: r.body.tweeling.versie,
    naam: 'Gastincident veilig afhandelen', afdelingId, rolId,
    doel: 'Stabiliseer de dienstverlening met bewijs en een eigenaar.',
    stappen: ['Controleer impact en bevoegdheid', 'Stabiliseer de dienstverlening',
      'Wijs een eigenaar toe', 'Leg bewijs en controlemoment vast']
  }, kikunoi);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 180));

  r = await api('/api/supplier/magnaat/studio/relatie', {
    versie: r.body.tweeling.versie, doelCode: 'HOSHI', soort: 'ketenpartner'
  }, kikunoi);
  assert.equal(r.status, 200);
  const relatie = r.body.relaties.find(x => x.tegenpartij === 'HOSHI');
  assert.ok(relatie && relatie.status === 'wacht-op-partner');
  const akkoord = await api('/api/supplier/magnaat/studio/relatie/beslis', {
    id: relatie.id, akkoord: true
  }, hoshi);
  assert.equal(akkoord.status, 200);
  assert.equal(akkoord.body.relaties.find(x => x.id === relatie.id).status, 'actief');

  r = await api('/api/supplier/magnaat/studio/proef/start', {}, kikunoi);
  assert.equal(r.status, 200);
  const trainingId = r.body.training.id;
  for (const keuze of [1, 0, 1, 2]) {
    r = await api('/api/supplier/magnaat/studio/proef/stap', { trainingId, keuze }, kikunoi);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 180));
  }
  assert.equal(r.body.training.status, 'voltooid');
  assert.equal(r.body.studio.gereedheid.score, 100);

  r = await api('/api/supplier/magnaat/studio/indienen', {
    versie: r.body.studio.tweeling.versie,
    notitie: 'Controleer rollen, gegevensgrenzen en de realistische trainingsstappen.'
  }, kikunoi);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 180));
  assert.equal(r.body.tweeling.fase, 'wacht-op-rtg');

  r = await api('/api/supplier/magnaat/studio/indienen/intrekken', {}, kikunoi);
  assert.equal(r.status, 200);
  assert.equal(r.body.tweeling.fase, 'concept');

  r = await api('/api/supplier/magnaat/studio/indienen', {
    versie: r.body.tweeling.versie, notitie: 'Tweede indiening voor de HTTP-boardroomproef.'
  }, kikunoi);
  assert.equal(r.status, 200);
});

test('de echte boardroomroute bewaakt vier ogen en toont de ingediende vingerafdruk', async () => {
  const lijst = await api('/api/office/magnaat/partners', {}, eigenaar);
  assert.equal(lijst.status, 200, JSON.stringify(lijst.body).slice(0, 180));
  assert.equal(lijst.body.releaseModel, 'vier-ogen-v2');
  const bedrijf = lijst.body.bedrijven.find(x => x.code === 'KIKUNOI');
  assert.ok(bedrijf && bedrijf.beoordeling && bedrijf.beoordeling.hash);

  const teVroeg = await api('/api/office/magnaat/partner/beslis', {
    code: 'KIKUNOI', actie: 'goedkeuren',
    notitie: 'De eigenaar probeert bewust zonder onafhankelijke voorcontrole te publiceren.',
    versie: bedrijf.versie, hash: bedrijf.beoordeling.hash
  }, eigenaar);
  assert.equal(teVroeg.status, 409);
  assert.match(teVroeg.body.error, /onafhankelijke controleur/i);
});

test('de eigenaar kan de echte integriteitscontrole starten en krijgt het oordeel terug', async () => {
  const r = await api('/api/techniek/controle/integriteit', {}, techniek);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 180));
  assert.ok(r.body.laatst && typeof r.body.laatst.ok === 'boolean');
});
