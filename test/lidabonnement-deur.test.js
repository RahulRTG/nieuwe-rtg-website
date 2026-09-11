/* ============================================================================
   DE DEUR VAN /api/mijn/abonnement -- over de ECHTE server.

   WAAROM DIT NAAST test/lidabonnement.test.js STAAT. Die toets bewijst dat de
   kern de juiste sommen maakt; hij kan NIET bewijzen dat de route de sleutel uit
   de sessie haalt, want hij geeft het accountId zelf mee. En precies daar zat in
   dit huis een fout van dezelfde vorm: kern/aanmeldingen/besluit.js EISTE een
   naam, en de route gaf altijd 'RTG-personeel' mee omdat hij req.session uitlas
   terwijl officeAuth die nooit zet. De grendel stond er en werd verslagen door
   een terugval die altijd slaagde. Een kern-toets kon dat niet zien.

   DRIE BEWERINGEN, en ze gaan alle drie over de deur en niet over de som:

     toets 2  lid A kan het lidmaatschap van lid B niet opzeggen -- ook niet door
              zijn aanmeldingId in de body te zetten
     toets 3  de kantoorroute blijft dicht voor een lid
     toets 4  en de ledenroute blijft dicht voor het kantoor

   Draai los: node --test test/lidabonnement-deur.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lidabo-'));

async function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

/* Een lid met een ECHT lidmaatschap: registreren, een RTG-aanvraag doen en die
   door het kantoor laten goedkeuren. Dat laatste is de enige weg waarlangs een
   contract ontstaat -- en dat is de merkregel en geen omweg. */
async function lidMetAbonnement(office) {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const reg = (await api('/api/auth/register', { name: 'Abo ' + u, email: u + '@x.nl',
    phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body;
  const aanvraag = (await api('/api/aanmelding/aanvraag',
    { pas: 'rtg', naam: 'Abo ' + u, contact: u + '@x.nl' }, reg.token)).body;
  const id = aanvraag.aanmelding && aanvraag.aanmelding.id;
  assert.ok(id, 'de aanvraag is binnengekomen: ' + JSON.stringify(aanvraag).slice(0, 160));
  const besluit = await api('/api/aanmelding/beslis', { id, besluit: 'geaccepteerd' }, office);
  assert.equal(besluit.status, 200, 'het kantoor keurt goed: ' + JSON.stringify(besluit.body).slice(0, 160));
  return { token: reg.token, aanmeldingId: id };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
});
test.after(() => stop(srv));

test('1. een lid leest zijn eigen abonnement achter de ledendeur', async () => {
  const office = await kantoorAlsPersoon(base, 'RTG-OFFICE');
  assert.ok(office, 'kantoor-inlog; staat RTG_DEMO aan?');
  const lid = await lidMetAbonnement(office);

  const r = await api('/api/mijn/abonnement', {}, lid.token);
  assert.equal(r.status, 200);
  assert.ok(r.body.abonnement, 'er staat een abonnement: ' + JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.abonnement.pas, 'rtg');
  assert.equal(r.body.abonnement.stand, 'ACTIEF');
  assert.equal(r.body.abonnement.kan.opzeggen, true);

  /* Het voorbeeld verandert niets -- dat is de hele reden dat hij bestaat. */
  const v = await api('/api/mijn/abonnement/opzegvoorbeeld', {}, lid.token);
  assert.equal(v.status, 200);
  assert.ok(v.body.eindigtOpTekst, 'met een leesbare einddatum');
  const na = await api('/api/mijn/abonnement', {}, lid.token);
  assert.equal(na.body.abonnement.stand, 'ACTIEF', 'het voorbeeld heeft niets opgezegd');
});

test('2. lid A zegt het lidmaatschap van lid B niet op, ook niet met zijn id in de body', async () => {
  const office = await kantoorAlsPersoon(base, 'RTG-OFFICE');
  const a = await lidMetAbonnement(office);
  const b = await lidMetAbonnement(office);

  /* DIT IS DE TOETS. De kantoorroute neemt een `id` uit de body; zou de
     ledenroute dat ook doen, dan kon A hier B opzeggen. */
  const poging = await api('/api/mijn/abonnement/opzeggen', { id: b.aanmeldingId }, a.token);
  assert.equal(poging.status, 200, 'A zegt iets op -- namelijk zijn EIGEN lidmaatschap');

  const vanB = await api('/api/mijn/abonnement', {}, b.token);
  assert.equal(vanB.body.abonnement.stand, 'ACTIEF',
    'het lidmaatschap van B is niet geraakt; het id in de body is genegeerd');
  const vanA = await api('/api/mijn/abonnement', {}, a.token);
  assert.equal(vanA.body.abonnement.stand, 'OPZEGGEND', 'en dat van A staat wel op opzeggend');
});

test('3. de kantoorroute blijft dicht voor een lid', async () => {
  const office = await kantoorAlsPersoon(base, 'RTG-OFFICE');
  const lid = await lidMetAbonnement(office);
  const r = await api('/api/aanmelding/opzeggen', { id: lid.aanmeldingId }, lid.token);
  assert.ok(r.status === 401 || r.status === 403,
    'een ledentoken komt niet door officeAuth (kreeg ' + r.status + ')');
});

test('4. de ledenroute blijft dicht voor het kantoor', async () => {
  const office = await kantoorAlsPersoon(base, 'RTG-OFFICE');
  const r = await api('/api/mijn/abonnement', {}, office);
  assert.ok(r.status === 401 || r.status === 403,
    'een kantoortoken heeft geen lidmaatschap en komt niet door auth (kreeg ' + r.status + ')');
});

test('5. twee tikken over de route zijn geen twee opzeggingen', async () => {
  const office = await kantoorAlsPersoon(base, 'RTG-OFFICE');
  const lid = await lidMetAbonnement(office);

  const een = await api('/api/mijn/abonnement/opzeggen', {}, lid.token);
  assert.equal(een.status, 200);
  assert.equal(een.body.alOpgezegd, false);
  const twee = await api('/api/mijn/abonnement/opzeggen', {}, lid.token);
  assert.equal(twee.status, 200, 'de tweede is geen fout');
  assert.equal(twee.body.alOpgezegd, true);
  assert.equal(twee.body.eindigtOp, een.body.eindigtOp, 'en dezelfde einddatum');
});
