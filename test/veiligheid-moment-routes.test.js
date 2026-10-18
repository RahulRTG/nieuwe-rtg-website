/* ============================================================================
   RTG VEILIG OVER DE ROUTES: het Moment (een tijdelijke Live Circle) en het
   verlengen van een wacht.

   test/veiligheid-moment.test.js toetst de kern van het Moment in het proces;
   niemand riep de zes deuren aan waar de app werkelijk tegen praat:
   /api/veiligheid/moment, /moment/maak, /moment/status, /moment/pauze,
   /moment/stop en /wacht/verleng. Wat hier over de route heen moet kloppen:

     - alleen een VERBONDEN connectie kan ontvanger zijn; een vreemde codenaam
       wordt stil overgeslagen en zonder geldige ontvanger is er geen Moment;
     - de ontvanger ziet het Moment in zijn eigen beeld (voorMij), de buitenstaander
       niet;
     - pauzeren en stoppen trekken het beeld bij de ontvanger METEEN in;
     - een zaak als ontvanger krijgt nooit een exacte plek, ook niet als het lid
       'locatie' kiest (dat wordt 'voortgang');
     - een wacht verlengen schuift de deadline op, alleen voor de eigen wacht.

   MUTATIES GEZIEN ZAKKEN: (1) in server/kern/veiligheid/moment.js de voorwaarde
   `!m.gepauzeerd` uit voorContact() gehaald; de toets zakte op "pauze trekt het
   beeld in". (2) in server/kern/veiligheid/wacht.js de deadlineregel in
   wachtVerlengen() weggehaald; de toets zakte op "de deadline schuift op".

   Draai los: node --test test/veiligheid-moment-routes.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-veiligmoment-'));
let srv, B, ik, vriend, vreemde, zaak;

async function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(B + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
let n = 0;
async function registreer() {
  const u = Date.now().toString(36) + (n++) + Math.random().toString(36).slice(2, 6);
  const r = await api('/api/auth/register', { name: 'Moment Lid', email: u + '@x.nl',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.equal(r.status, 200, 'registreren: ' + JSON.stringify(r.body));
  const con = await api('/api/member/connections', {}, r.body.token);
  return { token: r.body.token, key: con.body.me, codenaam: con.body.codename };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  B = srv.base;
  ik = await registreer(); vriend = await registreer(); vreemde = await registreer();
  assert.equal((await api('/api/member/connect', { key: vriend.key }, ik.token)).status, 200);
  assert.equal((await api('/api/member/connect/respond', { key: ik.key, action: 'accept' }, vriend.token)).status, 200);
  const rooster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  const mg = rooster.body.staff.find(x => x.role === 'manager');
  zaak = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mg.id, pin: '1234' })).body.token;
  assert.ok(zaak, 'de zaak logt in');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een Moment gaat alleen naar verbonden mensen, en de ontvanger ziet het in zijn eigen beeld', async () => {
  const alleenVreemd = await api('/api/veiligheid/moment/maak',
    { titel: 'Naar huis', ontvangers: [{ soort: 'contact', id: vreemde.key, niveau: 'locatie' }] }, ik.token);
  assert.equal(alleenVreemd.status, 400, 'een niet-verbonden codenaam is geen ontvanger');
  assert.equal((await api('/api/veiligheid/moment/maak', { ontvangers: [] }, null)).status, 401);

  const m = await api('/api/veiligheid/moment/maak', { titel: 'Diner', doel: 'Sal de Mar', minuten: 90,
    ontvangers: [{ soort: 'contact', id: vriend.key, niveau: 'voortgang' },
      { soort: 'contact', id: vreemde.key, niveau: 'locatie' },
      { soort: 'bedrijf', id: 'KIKUNOI', naam: 'Sal de Mar', niveau: 'locatie' }] }, ik.token);
  assert.equal(m.status, 200, JSON.stringify(m.body).slice(0, 160));
  const moment = m.body.moment;
  assert.equal(moment.ontvangers.length, 2, 'de vreemde is stil overgeslagen');
  assert.ok(!moment.ontvangers.some(r => r.id === vreemde.key));
  assert.equal(moment.ontvangers.find(r => r.soort === 'bedrijf').niveau, 'voortgang', 'een zaak krijgt nooit locatie');

  const mijn = await api('/api/veiligheid/moment', {}, ik.token);
  assert.ok(mijn.body.momenten.some(x => x.id === moment.id), 'de maker ziet zijn Moment');
  const bijVriend = await api('/api/veiligheid/moment', {}, vriend.token);
  assert.ok(bijVriend.body.voorMij.some(x => x.id === moment.id), 'de vriend ziet het Moment');
  const bijVreemde = await api('/api/veiligheid/moment', {}, vreemde.token);
  assert.ok(!bijVreemde.body.voorMij.some(x => x.id === moment.id), 'de vreemde ziet niets');
  const aankomst = await api('/api/supplier/veiligheid/aankomsten', {}, zaak);
  const bijZaak = aankomst.body.aankomsten.find(x => x.id === moment.id);
  assert.ok(bijZaak, 'de zaak ziet de aankomst');
  assert.equal(bijZaak.plek, undefined, 'maar nooit een plek');
});

test('voortgang zetten, pauzeren en stoppen: de ontvanger volgt meteen', async () => {
  const m = (await api('/api/veiligheid/moment/maak', { titel: 'Terugrit',
    ontvangers: [{ soort: 'contact', id: vriend.key, niveau: 'voortgang' }] }, ik.token)).body.moment;
  const voorVriend = async () => (await api('/api/veiligheid/moment', {}, vriend.token)).body.voorMij.find(x => x.id === m.id);

  assert.equal((await api('/api/veiligheid/moment/status', { id: m.id, status: 'teleporteert' }, ik.token)).status, 400);
  assert.equal((await api('/api/veiligheid/moment/status', { id: m.id, status: 'onderweg' }, vriend.token)).status, 404,
    'alleen de maker zet de voortgang');
  const st = await api('/api/veiligheid/moment/status', { id: m.id, status: 'vertraagd', eta: '22:40' }, ik.token);
  assert.equal(st.status, 200);
  const gezien = await voorVriend();
  assert.equal(gezien.status, 'vertraagd');
  assert.equal(gezien.eta, '22:40');

  assert.equal((await api('/api/veiligheid/moment/pauze', { id: m.id, aan: true }, vriend.token)).status, 404);
  assert.equal((await api('/api/veiligheid/moment/pauze', { id: m.id, aan: true }, ik.token)).status, 200);
  assert.equal(await voorVriend(), undefined, 'pauze trekt het beeld in');
  assert.equal((await api('/api/veiligheid/moment/pauze', { id: m.id, aan: false }, ik.token)).status, 200);
  assert.ok(await voorVriend(), 'hervatten laat het weer zien');

  assert.equal((await api('/api/veiligheid/moment/stop', { id: m.id }, vriend.token)).status, 404, 'de ontvanger stopt het niet');
  assert.equal((await api('/api/veiligheid/moment/stop', { id: m.id }, ik.token)).status, 200);
  assert.equal(await voorVriend(), undefined, 'stoppen trekt het beeld in');
  assert.ok(!(await api('/api/veiligheid/moment', {}, ik.token)).body.momenten.some(x => x.id === m.id), 'en het is weg bij de maker');
  assert.equal((await api('/api/veiligheid/moment/status', { id: m.id, status: 'onderweg' }, ik.token)).status, 409,
    'een gestopt Moment krijgt geen voortgang meer');
});

test('een wacht verlengen schuift de deadline op, en alleen de eigen wacht', async () => {
  // een wacht zonder kring waakt over niemand, dus eerst de vriend in de kring
  const k = await api('/api/veiligheid/kring/toevoegen', { handle: vriend.key }, ik.token);
  assert.equal(k.status, 200, JSON.stringify(k.body).slice(0, 160));
  const s =await api('/api/veiligheid/wacht/start', { soort: 'thuis', minuten: 30, marge: 0, label: 'Wandeling' }, ik.token);
  assert.equal(s.status, 200, JSON.stringify(s.body).slice(0, 160));
  const id = s.body.wacht.id;
  const voor = new Date(s.body.wacht.deadline).getTime();
  assert.ok(Number.isFinite(voor), 'de wacht heeft een deadline');

  assert.equal((await api('/api/veiligheid/wacht/verleng', { id, minuten: 20 }, vriend.token)).status, 404, 'andermans wacht niet');
  assert.equal((await api('/api/veiligheid/wacht/verleng', { id, minuten: 20 }, null)).status, 401);
  const v = await api('/api/veiligheid/wacht/verleng', { id, minuten: 20 }, ik.token);
  assert.equal(v.status, 200, JSON.stringify(v.body).slice(0, 160));
  const na = new Date(v.body.wacht.deadline).getTime();
  assert.ok(na - voor >= 19 * 60000 && na - voor <= 21 * 60000, 'de deadline schuift twintig minuten op, kreeg ' + (na - voor));
  assert.equal(v.body.wacht.status, 'loopt');

  assert.equal((await api('/api/veiligheid/wacht/stop', { id }, ik.token)).status, 200);
  assert.equal((await api('/api/veiligheid/wacht/verleng', { id, minuten: 20 }, ik.token)).status, 404,
    'een gestopte wacht verleng je niet');
});
