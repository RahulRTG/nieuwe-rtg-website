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
   8. `onbetaald` kan geen brede sanctie meer activeren, ook niet uit oude data.

   Draai: node --test test/naargast.test.js */
'use strict';
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');
const historischAccount = require('./lib/historisch-account');

let srv, base, eig, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-naargast-'));
async function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function bestaandLid() {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  historischAccount(TMP, { name: 'Bestaand ' + u, email: u + '@x.nl', tier: 'rtg' });
  const reg = (await api('/api/auth/login', { login: u + '@x.nl',
    password: 'geheim123', pasApp: 'rtg' })).body;
  assert.ok(reg.token);
  assert.equal(reg.state.user.tier, 'rtg');
  return { token: reg.token, id: reg.state.user.id, u };
}
async function metContract() {
  const lid = await bestaandLid();
  const a = (await api('/api/aanmelding/aanvraag', { idem: randomUUID(), pas: 'rtg', naam: 'Gast ' + lid.u, contact: lid.u + '@x.nl' }, lid.token)).body;
  const b = await api('/api/aanmelding/beslis', { id: a.ontvangst.aanvraagId, besluit: 'geaccepteerd' }, office);
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
  const lid = await bestaandLid();
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
  assert.equal((await api('/api/mijn/pas/gast', { wanneer: 'einde' }, lid.token)).status, 409);
  const voorbeeld = (await api('/api/mijn/abonnement/opzegvoorbeeld', {}, lid.token)).body;
  const r = await api('/api/mijn/pas/gast', { ...voorbeeld, wanneer: 'einde' }, lid.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.gepland, true);
  assert.ok(r.body.gastOp);
  const abo = await api('/api/mijn/abonnement', {}, lid.token);
  assert.equal(abo.status, 200, 'hij is nog gewoon ingelogd');
  assert.equal(abo.body.abonnement.stand, 'OPZEGGEND');
});

test('3. het kantoor alleen met een reden', async () => {
  const lid = await bestaandLid();
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
  const onbetaald = await api('/api/office/pas/gast/regels/zet', { regel: 'onbetaald', aan: true, termijnen: 2 }, eig);
  assert.equal(onbetaald.status, 409);
  assert.match(onbetaald.body.error, /herstel/);
  const ronde = await api('/api/office/pas/gast/ronde', {}, eig);
  assert.equal(ronde.status, 200);
  assert.equal(typeof ronde.body.gepland, 'number', 'de ronde geeft tellingen en geen namen');
});

/* ---------------- DEEL B: de ronde met een klok ---------------- */
function wereld({ contractStatus, eindigtOp, termijnen, tier = 'rtg', metContract = true }) {
  const db = { data: {} };
  let klok = Date.parse('2026-10-01T00:00:00Z');
  const STATUS = { OPZEGGEND: 'OPZEGGEND', GEEINDIGD: 'GEEINDIGD' };
  const c = { id: 'c1', aanmeldingId: 'a1', startAt: '2026-01-01T00:00:00Z', status: contractStatus, eindigtOp };
  const contractlijst = [c];
  const contracten = { STATUS, LOPEND: new Set(['ACTIEF', 'VERLENGD', 'OPZEGGEND']), vind: id => contractlijst.find(x => x.id === id),
    beeindig: (x) => { x.status = STATUS.GEEINDIGD; return x; } };
  const user = { id: 7, tier };
  const accounts = { getUserById: (id) => (id === 7 ? user : null),
    setTier: (id, t) => { user.tier = t; return user; }, zetSessiegrens: () => { user.grens = true; } };
  const aanmeldingen = [{ id: 'a1', accountId: 7, status: 'geaccepteerd' }];
  const schemas = [{ aanmeldingId: 'a1', contractId: metContract ? 'c1' : null, termijnen: termijnen || [] }];
  const A = () => aanmeldingen, B = () => schemas;
  const berichten = [];
  const saves = { n: 0 };
  const ng = require('../server/kern/aanmeldingen/naargast')({ db, save: () => saves.n++, A, B, contracten, accounts,
    zegOpZelf: () => { c.status = 'OPZEGGEND'; return { ok: true, eindigtOp }; },
    meldLid: (k, n) => berichten.push(k), nu: () => new Date(klok).toISOString() }).naarGast;
  function voegContractToe(patch = {}) {
    const nieuw = { id: 'c2', aanmeldingId: 'a2', status: 'ACTIEF', startAt: '2026-09-01T00:00:00Z', eindigtOp: null, ...patch };
    contractlijst.push(nieuw);
    aanmeldingen.unshift({ id: nieuw.aanmeldingId, accountId: 7, status: 'geaccepteerd' });
    schemas.unshift({ aanmeldingId: nieuw.aanmeldingId, contractId: nieuw.id, termijnen: [] });
    return nieuw;
  }
  return { db, ng, c, user, berichten, schemas, saves, voegContractToe, zet: (iso) => { klok = Date.parse(iso); } };
}

test('5. een geplande overgang gebeurt op de einddatum en niet ervoor', () => {
  const w = wereld({ contractStatus: 'ACTIEF', eindigtOp: '2026-12-01T00:00:00Z' });
  assert.equal(w.ng.lidEinde(7).gepland, true);
  assert.equal(w.db.data.pasNaarGast.gepland['7'].contractId, 'c1');
  assert.equal(w.db.data.pasNaarGast.gepland['7'].aanmeldingId, 'a1');
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

test('8. onbetaald weigert brede sancties, ook met eerder opgeslagen aan=true', () => {
  const t = [{ status: 'gepland', vervalt: '2026-08-01' }, { status: 'voldaan', vervalt: '2026-08-15' }, { status: 'gepland', vervalt: '2026-09-01' }];
  const w = wereld({ contractStatus: 'ACTIEF', eindigtOp: null, termijnen: t });
  assert.equal(w.ng.regelZet('onbetaald', { aan: true, termijnen: 2 }, 'eigenaar').status, 409);
  w.db.data.pasNaarGast = { regels: { onbetaald: { aan: true, termijnen: 1 } } };
  assert.equal(w.ng.regels().onbetaald.gevraagdAan, true);
  assert.equal(w.ng.regels().onbetaald.aan, false);
  assert.match(w.ng.regels().onbetaald.reden, /herstel/);
  assert.equal(w.ng.ronde().onbetaald, 0);
  assert.equal(w.user.tier, 'rtg');
  assert.equal(w.user.grens, undefined, 'sessies blijven geldig');
  assert.equal(w.c.status, 'ACTIEF', 'contract blijft intact');
  assert.deepEqual(w.berichten, []);

  const z = wereld({ contractStatus: 'ACTIEF', eindigtOp: null, termijnen: t, metContract: false });
  z.db.data.pasNaarGast = { regels: { onbetaald: { aan: true, termijnen: 1 } } };
  z.ng.ronde();
  assert.equal(z.user.tier, 'rtg', 'een lid zonder vastgelegd contract gaat nooit automatisch');
});

test('9. een contractgebonden oude opdracht raakt geen nieuw lopend contract of sessie', () => {
  const w = wereld({ contractStatus: 'ACTIEF', eindigtOp: '2026-12-01T00:00:00Z' });
  w.ng.lidEinde(7);
  const nieuw = w.voegContractToe();
  w.zet('2026-12-01T00:00:00Z');
  assert.equal(w.ng.ronde().tegengehouden, 1);
  assert.equal(w.user.tier, 'rtg');
  assert.equal(w.user.grens, undefined);
  assert.equal(nieuw.status, 'ACTIEF');
  assert.ok(w.db.data.pasNaarGast.gepland['7'], 'oude opdracht blijft herkenbaar voor herstel');
});

test('10. afgelopen en wacht beschermen een nieuwe afspraak, ook na een eerdere aankondiging', () => {
  for (const regel of ['afgelopen', 'wacht']) {
    const w = wereld({ contractStatus: 'OPZEGGEND', eindigtOp: '2026-09-25T00:00:00Z' });
    w.ng.regelZet(regel, { aan: true, dagen: 30 }, 'eigenaar');
    if (regel === 'wacht') assert.equal(w.ng.ronde().aangekondigd, 1);
    const nieuw = w.voegContractToe(), berichten = w.berichten.length;
    assert.equal(w.ng.ronde().tegengehouden, 1);
    w.zet('2026-11-01T00:00:00Z');
    assert.equal(w.ng.ronde().tegengehouden, 1);
    assert.equal(w.user.tier, 'rtg');
    assert.equal(w.user.grens, undefined);
    assert.equal(nieuw.status, 'ACTIEF');
    assert.equal(w.berichten.length, berichten);
  }
});

test('11. legacyplanning wordt alleen bij een unieke consistente bron uitgevoerd', () => {
  const eind = '2026-09-01T00:00:00Z';
  for (const fout of ['datum', 'ontbrekend', 'andere-aanvraag', 'dubbel', 'verkeerd-doel']) {
    const w = wereld({ contractStatus: 'OPZEGGEND', eindigtOp: eind });
    const g = { op: eind, sinds: '2026-08-01T00:00:00Z' };
    w.db.data.pasNaarGast = { gepland: { '7': g } };
    if (fout === 'datum') g.op = 'geen datum';
    if (fout === 'ontbrekend') w.schemas[0].contractId = 'niet-bestaand';
    if (fout === 'andere-aanvraag') w.c.aanmeldingId = 'andermans-aanvraag';
    if (fout === 'dubbel') w.voegContractToe({ status: 'OPZEGGEND', eindigtOp: eind });
    if (fout === 'verkeerd-doel') Object.assign(g, { contractId: 'ander', aanmeldingId: 'a1' });
    assert.equal(w.ng.ronde().tegengehouden, 1, fout);
    assert.equal(w.user.tier, 'rtg', fout);
    assert.equal(w.user.grens, undefined, fout);
    assert.ok(w.db.data.pasNaarGast.gepland['7'], fout);
  }
  const w = wereld({ contractStatus: 'OPZEGGEND', eindigtOp: eind });
  w.db.data.pasNaarGast = { gepland: { '7': { op: eind } } };
  w.voegContractToe({ status: 'GEEINDIGD', eindigtOp: '2026-08-01T00:00:00Z' });
  w.schemas.push({ ...w.schemas[1] }); // dezelfde contractbron is geen tweede kandidaat
  assert.equal(w.ng.ronde().gepland, 1);
  assert.equal(w.user.tier, 'guest');
  assert.ok(w.saves.n > 0, 'ook de afhandeling wordt opgeslagen');
});

test('12. beschermde legacybinding blijft vast en start/eindgrenzen zijn expliciet', () => {
  const eind = '2026-09-01T00:00:00Z';
  for (const [startAt, eindigtOp, beschermd] of [
    ['2026-10-01T00:00:00Z', null, true],
    ['2026-10-02T00:00:00Z', null, false],
    ['2026-08-01T00:00:00Z', '2026-10-01T00:00:00Z', false],
    ['ongeldig', null, true]
  ]) {
    const w = wereld({ contractStatus: 'OPZEGGEND', eindigtOp: eind });
    w.db.data.pasNaarGast = { gepland: { '7': { op: eind } } };
    w.voegContractToe({ startAt, eindigtOp });
    const uit = w.ng.ronde();
    assert.equal(uit.tegengehouden, beschermd ? 1 : 0);
    assert.equal(w.user.tier, beschermd ? 'rtg' : 'guest');
    if (beschermd) {
      assert.equal(w.db.data.pasNaarGast.gepland['7'].contractId, 'c1');
      assert.ok(w.saves.n > 0, 'de afgeleide binding wordt bewaard voordat een latere ronde kan kiezen');
    }
  }
});
