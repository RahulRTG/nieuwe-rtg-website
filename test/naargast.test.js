/* VAN EEN BETAALDE PAS NAAR GAST -- server/kern/aanmeldingen/naargast.js (besluit C5).

   DEEL A, TEGEN EEN ECHTE SERVER (vijf nieuwe routes):
   1. een lid zonder afspraak kan niet "aan het eind" -- er is geen eind -- maar wel nu,
      en daarna is zijn oude sessie weg;
   2. een lid met een contract kiest "aan het eind": hij zegt op en blijft lid;
   3. het kantoor zet een pas naar gast alleen met een reden;
   4. de schakelaars staan standaard uit, en alleen de eigenaar zet ze.

   DEEL B, DE RONDE, met een klok in de hand (de einddatum ligt anders maanden weg):
   5. een geplande overgang gebeurt op de einddatum, niet ervoor;
   6. met alle schakelaars uit gebeurt er automatisch niets;
   7. `afgelopen` beeindigt het contract en zet de pas; `wacht` kondigt eerst aan;
   8. `onbetaald` telt vervallen open termijnen; een lid zonder contract nooit.

   Draai: node --test test/naargast.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

let srv, base, eig, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-naargast-'));
async function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function registreer() {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const reg = (await api('/api/auth/register', { name: 'Gast ' + u, email: u + '@x.nl',
    phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body;
  assert.ok(reg.token);
  return { token: reg.token, id: reg.state.user.id, u };
}
async function metContract() {
  const lid = await registreer();
  const a = (await api('/api/aanmelding/aanvraag', { pas: 'rtg', naam: 'Gast ' + lid.u, contact: lid.u + '@x.nl' }, lid.token)).body;
  const b = await api('/api/aanmelding/beslis', { id: a.aanmelding.id, besluit: 'geaccepteerd' }, office);
  assert.equal(b.status, 200);
  return lid;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = await kantoorAlsPersoon(base, 'RTG-OFFICE');
  eig = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(office && eig);
});
test.after(() => { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } });

test('1. zonder afspraak geen eind, wel nu -- en de oude sessie is daarna weg', async () => {
  const lid = await registreer();
  const einde = await api('/api/mijn/pas/gast', { wanneer: 'einde' }, lid.token);
  assert.equal(einde.status, 409);
  assert.match(einde.body.error, /geen afspraak met een einddatum/);
  const nu = await api('/api/mijn/pas/gast', { wanneer: 'nu' }, lid.token);
  assert.equal(nu.status, 200, JSON.stringify(nu.body));
  assert.equal(nu.body.naar, 'guest');
  const na = await api('/api/mijn/pas/gast', { wanneer: 'nu' }, lid.token);
  assert.equal(na.status, 401, 'de sessie met de oude pas telt niet meer');
});

test('2. met een contract kiest het lid het eind van zijn periode: opgezegd, en nog lid', async () => {
  const lid = await metContract();
  const r = await api('/api/mijn/pas/gast', { wanneer: 'einde' }, lid.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.gepland, true);
  assert.ok(r.body.gastOp);
  const abo = await api('/api/mijn/abonnement', {}, lid.token);
  assert.equal(abo.status, 200, 'hij is nog gewoon ingelogd');
  assert.equal(abo.body.abonnement.stand, 'OPZEGGEND');
});

test('3. het kantoor alleen met een reden', async () => {
  const lid = await registreer();
  const zonder = await api('/api/office/pas/gast', { accountId: lid.id }, eig);
  assert.equal(zonder.status, 400);
  const met = await api('/api/office/pas/gast', { accountId: lid.id, reden: 'op verzoek van het lid per telefoon' }, eig);
  assert.equal(met.status, 200, JSON.stringify(met.body));
  assert.equal(met.body.naar, 'guest');
  assert.equal((await api('/api/office/pas/gast', {}, lid.token)).status === 200, false, 'een lid komt niet aan de kantoorroute');
});

test('4. de schakelaars staan standaard uit, en alleen de eigenaar zet ze', async () => {
  const r = (await api('/api/office/pas/gast/regels', {}, eig)).body.regels;
  assert.deepEqual([r.afgelopen.aan, r.wacht.aan, r.onbetaald.aan], [false, false, false]);
  assert.equal((await api('/api/office/pas/gast/regels/zet', { regel: 'wacht', aan: true, dagen: 0 }, eig)).status, 400);
  const z = await api('/api/office/pas/gast/regels/zet', { regel: 'wacht', aan: true, dagen: 14 }, eig);
  assert.equal(z.status, 200, JSON.stringify(z.body));
  assert.equal(z.body.regels.wacht.dagen, 14);
  const ronde = await api('/api/office/pas/gast/ronde', {}, eig);
  assert.equal(ronde.status, 200);
  assert.equal(typeof ronde.body.gepland, 'number', 'de ronde geeft tellingen en geen namen');
});

/* ---------------- DEEL B: de ronde met een klok ---------------- */
function wereld({ contractStatus, eindigtOp, termijnen, tier = 'rtg', metContract = true }) {
  const db = { data: {} };
  let klok = Date.parse('2026-10-01T00:00:00Z');
  const STATUS = { OPZEGGEND: 'OPZEGGEND', GEEINDIGD: 'GEEINDIGD' };
  const c = { id: 'c1', status: contractStatus, eindigtOp };
  const contracten = { STATUS, LOPEND: new Set(['ACTIEF', 'VERLENGD']), vind: () => c,
    beeindig: (x) => { x.status = STATUS.GEEINDIGD; return x; } };
  const user = { id: 7, tier };
  const accounts = { getUserById: (id) => (id === 7 ? user : null),
    setTier: (id, t) => { user.tier = t; return user; }, zetSessiegrens: () => { user.grens = true; } };
  const A = () => [{ id: 'a1', accountId: 7, status: 'geaccepteerd' }];
  const B = () => [{ aanmeldingId: 'a1', contractId: metContract ? 'c1' : null, termijnen: termijnen || [] }];
  const berichten = [];
  const ng = require('../server/kern/aanmeldingen/naargast')({ db, save: () => {}, A, B, contracten, accounts,
    zegOpZelf: () => ({ ok: true, eindigtOp }), meldLid: (k, n) => berichten.push(k), nu: () => new Date(klok).toISOString() }).naarGast;
  return { ng, c, user, berichten, zet: (iso) => { klok = Date.parse(iso); } };
}

test('5. een geplande overgang gebeurt op de einddatum en niet ervoor', () => {
  const w = wereld({ contractStatus: 'ACTIEF', eindigtOp: '2026-12-01T00:00:00Z' });
  assert.equal(w.ng.lidEinde(7).gepland, true);
  w.ng.ronde();
  assert.equal(w.user.tier, 'rtg', 'voor de einddatum blijft hij lid');
  w.zet('2026-12-01T00:00:01Z');
  assert.equal(w.ng.ronde().gepland, 1);
  assert.equal(w.user.tier, 'guest');
  assert.equal(w.user.grens, true, 'en zijn sessies zijn verlopen');
});

test('6. met alle schakelaars uit gebeurt er automatisch niets', () => {
  const w = wereld({ contractStatus: 'OPZEGGEND', eindigtOp: '2026-09-01T00:00:00Z',
    termijnen: [{ status: 'gepland', vervalt: '2026-08-01' }, { status: 'gepland', vervalt: '2026-09-01' }] });
  w.ng.ronde();
  assert.equal(w.user.tier, 'rtg');
  assert.equal(w.c.status, 'OPZEGGEND');
});

test('7. afgelopen beeindigt en zet de pas; wacht kondigt eerst aan en wint van afgelopen', () => {
  const a = wereld({ contractStatus: 'OPZEGGEND', eindigtOp: '2026-09-01T00:00:00Z' });
  a.ng.regelZet('afgelopen', { aan: true }, 'eigenaar');
  assert.equal(a.ng.ronde().afgelopen, 1);
  assert.equal(a.c.status, 'GEEINDIGD');
  assert.equal(a.user.tier, 'guest');

  const w = wereld({ contractStatus: 'OPZEGGEND', eindigtOp: '2026-09-25T00:00:00Z' });
  w.ng.regelZet('afgelopen', { aan: true }, 'eigenaar');
  w.ng.regelZet('wacht', { aan: true, dagen: 30 }, 'eigenaar');
  const eerst = w.ng.ronde();
  assert.equal(eerst.aangekondigd, 1);
  assert.equal(w.user.tier, 'rtg', 'binnen de wachttijd blijft hij lid');
  assert.equal(w.ng.ronde().aangekondigd, 0, 'een bericht, niet elk uur');
  w.zet('2026-10-26T00:00:00Z');
  assert.equal(w.ng.ronde().wacht, 1);
  assert.equal(w.user.tier, 'guest');
});

test('8. onbetaald telt vervallen open termijnen, en zonder contract nooit', () => {
  const t = [{ status: 'gepland', vervalt: '2026-08-01' }, { status: 'voldaan', vervalt: '2026-08-15' }, { status: 'gepland', vervalt: '2026-09-01' }];
  const w = wereld({ contractStatus: 'ACTIEF', eindigtOp: null, termijnen: t });
  w.ng.regelZet('onbetaald', { aan: true, termijnen: 3 }, 'eigenaar');
  w.ng.ronde();
  assert.equal(w.user.tier, 'rtg', 'twee open is geen drie');
  w.ng.regelZet('onbetaald', { aan: true, termijnen: 2 }, 'eigenaar');
  assert.equal(w.ng.ronde().onbetaald, 1);
  assert.equal(w.user.tier, 'guest');

  const z = wereld({ contractStatus: 'ACTIEF', eindigtOp: null, termijnen: t, metContract: false });
  z.ng.regelZet('onbetaald', { aan: true, termijnen: 1 }, 'eigenaar');
  z.ng.ronde();
  assert.equal(z.user.tier, 'rtg', 'een lid zonder vastgelegd contract gaat nooit automatisch');
});
