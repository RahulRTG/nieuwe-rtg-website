/* DE TERUGGAVE NA EEN CORRECTIE UITVOEREN (kern/horeca/teruggave.js).

   Fase 0, defect D8: een correctie na de betaling zette een teruggaverecht klaar
   met "een medewerker betaalt het terug langs RTG Pay", en er was geen weg om
   dat te doen. Besluit van 4 oktober 2026: de ZAAK voert uit, per wijze -- de
   manager beslist, het geld gaat terug langs de weg waarlangs het binnenkwam.

   Pin en bon draaien tegen een echte server; de online weg met een nagemaakte
   betaalwaarheid, want een echte providerterugbetaling bestaat hier niet.

   Draai los: node --test test/horeca-teruggave.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

let srv, base, MGR, MDW;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-horecateruggave-'));

async function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function zaak(rol) {
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const s = (roster.staff || []).find(x => rol === 'manager' ? x.role === 'manager' : x.role !== 'manager');
  return (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: s.id, pin: rol === 'manager' ? '1234' : '5678' })).body.token;
}

/* Een tafel met twee regels, helemaal betaald (met `betaal`), en daarna een
   correctie op de eerste: er staat 1600 klaar om terug te gaan. */
async function betaaldEnGecorrigeerd(naam, betaal) {
  const qr = await api('/api/supplier/horeca/gast/qr', { tafel: naam }, MGR);
  const aan = (await api('/api/gast/aanschuiven', { token: qr.body.token, naam: 'Gast ' + naam })).body;
  const rekeningId = aan.rekening.rekeningId;
  const a = await api('/api/supplier/horeca/rekening/regel', { rekeningId, naam: 'Hoofdgerecht', centen: 1600, aantal: 1 }, MGR);
  await api('/api/supplier/horeca/rekening/regel', { rekeningId, naam: 'Nagerecht', centen: 900, aantal: 1 }, MGR);
  const regelId = a.body.rekening.regels.find(r => r.naam === 'Hoofdgerecht').id;
  const b = await betaal(rekeningId);
  assert.equal(b.status, 200, JSON.stringify(b.body).slice(0, 200));
  const c = await api('/api/supplier/horeca/rekening/regel/corrigeer',
    { rekeningId, regelId, grond: 'niet-gebracht', reden: 'gast heeft het nooit gekregen' }, MGR);
  assert.equal(c.status, 200, JSON.stringify(c.body).slice(0, 200));
  assert.equal(c.body.correctie.teruggave.centen, 1600);
  assert.equal(c.body.rekening.openstaand, -1600, 'het te veel betaalde spiegelt het recht');
  return { rekeningId, correctieId: c.body.correctie.id, betalingId: b.body.betaling.id };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base;
  MGR = await zaak('manager'); MDW = await zaak('medewerker');
  assert.ok(MGR && MDW);
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. pin: de manager legt vast wie het terugdeed en waarom, en de rekening klopt weer', async () => {
  const t = await betaaldEnGecorrigeerd('TG-1', id => api('/api/supplier/horeca/betaal', { rekeningId: id, wijze: 'pin' }, MGR));
  const lijf = { rekeningId: t.rekeningId, correctieId: t.correctieId, betalingId: t.betalingId,
    reden: 'teruggeboekt op de pinautomaat', idem: 'tg1' };

  const mdw = await api('/api/supplier/horeca/teruggave', Object.assign({}, lijf, { idem: 'tg1-mdw' }), MDW);
  assert.equal(mdw.status, 403, 'een medewerker zonder managerrol voert geen teruggave uit');

  const zonderReden = await api('/api/supplier/horeca/teruggave', Object.assign({}, lijf, { reden: '', idem: 'tg1-leeg' }), MGR);
  assert.equal(zonderReden.status, 400);

  const r = await api('/api/supplier/horeca/teruggave', lijf, MGR);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.terugbetaling.stand, 'uitgevoerd');
  assert.equal(r.body.terugbetaling.wijze, 'pin');
  assert.ok(r.body.terugbetaling.door, 'de naam van de manager staat erbij');
  assert.equal(r.body.teruggave.uitgevoerd, true);
  assert.equal(r.body.rekening.openstaand, 0, 'na de teruggave staat er niets meer te veel');

  // dezelfde klik nog eens: dezelfde terugbetaling, geen tweede
  const nog = await api('/api/supplier/horeca/teruggave', lijf, MGR);
  assert.equal(nog.body.herhaald, true);
  assert.equal(nog.body.rekening.terugbetalingen.length, 1);
  // een nieuwe sleutel: het recht is op
  const ander = await api('/api/supplier/horeca/teruggave', Object.assign({}, lijf, { idem: 'tg1-b' }), MGR);
  assert.equal(ander.status, 409, JSON.stringify(ander.body).slice(0, 160));
});

test('2. bon: het geld gaat terug op dezelfde bon, en niet meer dan het recht', async () => {
  const maak = await api('/api/supplier/horeca/bon/maak', { soort: 'cadeaubon', bedrag: 40, idem: 'tg-bon-1' }, MGR);
  assert.equal(maak.status, 200, JSON.stringify(maak.body).slice(0, 200));
  const bonId = maak.body.bon.id, bonCode = maak.body.bon.code;
  const t = await betaaldEnGecorrigeerd('TG-2', id => api('/api/supplier/horeca/betaal',
    { rekeningId: id, wijze: 'bon', bonId, idem: 'tg-bon-betaal' }, MGR));
  const saldo = async () => (await api('/api/supplier/horeca/bon', { bonCode }, MGR)).body.bon.saldo;
  assert.equal(await saldo(), 4000 - 2500);

  const teVeel = await api('/api/supplier/horeca/teruggave', { rekeningId: t.rekeningId, correctieId: t.correctieId,
    betalingId: t.betalingId, centen: 1601, reden: 'terug op de bon', idem: 'tg2-a' }, MGR);
  assert.equal(teVeel.status, 409, 'meer dan het recht ging terug');

  const r = await api('/api/supplier/horeca/teruggave', { rekeningId: t.rekeningId, correctieId: t.correctieId,
    betalingId: t.betalingId, reden: 'terug op de bon', idem: 'tg2-b' }, MGR);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.terugbetaling.stand, 'uitgevoerd');
  assert.equal(await saldo(), 4000 - 2500 + 1600, 'het saldo van de bon steeg niet met het recht');
  assert.equal(r.body.rekening.openstaand, 0);
});

/* ------------------------------------------------- de kern, per wijze */

const horeca = require('../server/kern/horeca')({ db: { data: {} }, save: () => {}, crypto: require('crypto'),
  schoon: (v, n) => String(v == null ? '' : v).slice(0, n || 200) });
const C = require('../server/kern/horeca/correctie')({ horeca, schoon: (v, n) => String(v || '').trim().slice(0, n) });
let teller = 0;
const maakKern = (deps) => require('../server/kern/horeca/teruggave')(Object.assign({ horeca, nu: () => 'nu', id: () => String(++teller) }, deps));

function rek(betaling) {
  const r = { id: 'r', status: 'betaald', kortingen: [], fooiCenten: 0, betalingen: [betaling],
    regels: [{ id: 'a', naam: 'A', aantal: 1, centen: 1600 }, { id: 'b', naam: 'B', aantal: 1, centen: 900 }] };
  const c = C.corrigeer(r, { regelId: 'a', grond: 'breuk', reden: 'gevallen' }).correctie;
  return { r, c };
}

/* Een betaalwaarheid die de terugbetaling vastlegt en pas bevestigt als de
   toets dat zegt -- zoals een provider die later een webhook stuurt. */
function nepWaarheid() {
  const doos = { W1: { terugbetaalOpdrachten: [] } };
  return { doos,
    van: id => doos[id],
    terugbetalen: async (id, inv) => { await new Promise(k => setTimeout(k, 5));
      doos[id].terugbetaalOpdrachten.push({ reden: inv.reden, centen: inv.centen, status: 'BIJ_PROVIDER' }); } };
}

test('3. online: uitgevoerd pas als de provider het bevestigt', async () => {
  const w = nepWaarheid();
  const K = maakKern({ betaalWaarheid: w });
  const { r, c } = rek({ id: 'p1', wijze: 'Mollie', waarheidId: 'W1', centen: 2500 });
  const u = await K.uitvoeren(r, { correctieId: c.id, betalingId: 'p1', reden: 'via de provider', door: 'M', idem: 'o1' });
  assert.equal(u.terugbetaling.stand, 'bij-provider');
  assert.equal(c.teruggave.uitgevoerd, false);
  assert.equal(horeca.openstaand(r), -1600, 'geld dat nog bij de provider ligt, telt nog niet als terug');

  w.doos.W1.terugbetaalOpdrachten[0].status = 'BEVESTIGD';
  const na = await K.uitvoeren(r, { correctieId: c.id, betalingId: 'p1', reden: 'via de provider', door: 'M', idem: 'o1' });
  assert.equal(na.herhaald, true);
  assert.equal(na.terugbetaling.stand, 'uitgevoerd');
  assert.equal(c.teruggave.uitgevoerd, true);
  assert.equal(horeca.openstaand(r), 0);
});

test('4. twee managers tegelijk betalen samen nooit meer terug dan het recht', async () => {
  const w = nepWaarheid();
  const K = maakKern({ betaalWaarheid: w });
  const { r, c } = rek({ id: 'p1', wijze: 'Mollie', waarheidId: 'W1', centen: 2500 });
  const uit = await Promise.all([
    K.uitvoeren(r, { correctieId: c.id, betalingId: 'p1', reden: 'manager een', door: 'A', idem: 'x1' }),
    K.uitvoeren(r, { correctieId: c.id, betalingId: 'p1', reden: 'manager twee', door: 'B', idem: 'x2' })]);
  assert.deepEqual(uit.map(u => !!u.ok).sort(), [false, true]);
  assert.equal(w.doos.W1.terugbetaalOpdrachten.length, 1, 'de provider kreeg twee opdrachten');
});

test('5. kamer, rekening en munt gaan niet hier terug, met de weg erbij', async () => {
  for (const wijze of ['kamer', 'rekening', 'munt']) {
    const K = maakKern({});
    const { r, c } = rek({ id: 'p1', wijze, centen: 2500 });
    const u = await K.uitvoeren(r, { correctieId: c.id, betalingId: 'p1', reden: 'probeer het', door: 'M', idem: 'k' });
    assert.equal(u.status, 409, wijze);
    assert.ok(u.hoe, wijze + ' zegt niet waar het wel kan');
    assert.equal((r.terugbetalingen || []).length, 0, wijze + ' liet een spoor achter');
  }
});

test('6. een mislukte bon-terugboeking telt niet als terug', async () => {
  const K = maakKern({ bonlaag: { terug: async () => ({ status: 409, error: 'bon ingetrokken' }) } });
  const { r, c } = rek({ id: 'p1', wijze: 'bon', bonId: 'B1', bonRef: 'ref', centen: 2500 });
  const u = await K.uitvoeren(r, { correctieId: c.id, betalingId: 'p1', reden: 'terug op bon', door: 'M', idem: 'b' });
  assert.equal(u.status, 409);
  assert.equal(r.terugbetalingen[0].stand, 'mislukt');
  assert.equal(horeca.openstaand(r), -1600);
  assert.equal(c.teruggave.uitgevoerd, false);
});
