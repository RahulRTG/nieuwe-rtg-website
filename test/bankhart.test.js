/* Het financiele hart: de Regelwacht (belastingen en regels automatisch bij,
   streng gevalideerd, in place op de gedeelde landtabel), het verenigde
   hart-afschrift (RTG Bank + RTG Pay + de derde-partij-kaartnaad met een
   bronlabel), de premium-functies gratis (inzichten, vaste-lasten-radar,
   wisselgeld sparen met auto-spaarrekening) en de zakelijke rekening die er
   voor de Business Pass en voor elke zaak automatisch bij komt.
   Draai los: node --test test/bankhart.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

/* ---------- deel 1: de Regelwacht als pure fabriek (stub-db) ---------- */
test('regelwacht: een geldige update muteert de landtabel in place; rommel wordt geweigerd', () => {
  const LANDEN = { NL: { naam: 'Nederland', uurloonMin: 14.06, lasten: 0.28, vakantiegeld: 0.08, alcoholLeeftijd: 18, tarieven: { eten: 9, standaard: 21 }, aangifte: 'oud' } };
  const db = { data: {} };
  const { regelwacht } = require('../server/kern/fiscaal/regelwacht')({ db, save: () => {}, LANDEN, peiljaar: 2025 });

  const uit = regelwacht.pasToe({ landen: { NL: { uurloonMin: 15.1, tarieven: { eten: 10 }, aangifte: 'nieuw regime' } } }, 'test', 'v2');
  assert.equal(uit.landen, 1);
  assert.equal(LANDEN.NL.uurloonMin, 15.1, 'de gedeelde tabel is in place bijgewerkt');
  assert.equal(LANDEN.NL.tarieven.eten, 10, 'een bestaand btw-tarief is bijgewerkt');
  assert.equal(LANDEN.NL.aangifte, 'nieuw regime');

  const slecht = regelwacht.pasToe({ landen: {
    NL: { uurloonMin: 500, lasten: -1, tarieven: { eten: 99, spook: 5 }, hack: 'x' },
    XX: { uurloonMin: 10 } } }, 'test');
  assert.equal(slecht.landen, 0, 'buiten-bereik-waardes, onbekende velden en onbekende landen doen niets');
  assert.equal(LANDEN.NL.uurloonMin, 15.1);
  assert.equal(LANDEN.NL.tarieven.eten, 10);
  assert.equal(LANDEN.NL.tarieven.spook, undefined, 'er komt nooit een nieuw tarief bij via een update');
  assert.equal(LANDEN.NL.hack, undefined);

  // de overlay overleeft een herstart: verse tabel + herstelOverlay = laatste stand
  const VERS = { NL: { naam: 'Nederland', uurloonMin: 14.06, lasten: 0.28, vakantiegeld: 0.08, alcoholLeeftijd: 18, tarieven: { eten: 9, standaard: 21 }, aangifte: 'oud' } };
  const tweede = require('../server/kern/fiscaal/regelwacht')({ db, save: () => {}, LANDEN: VERS, peiljaar: 2025 });
  tweede.regelwacht.herstelOverlay();
  assert.equal(VERS.NL.uurloonMin, 15.1, 'na een herstart staat de overlay er weer op');
  const st = tweede.regelwacht.status();
  assert.equal(st.versie, 'v2');
  assert.ok(st.landen.find(l => l.code === 'NL').bijgewerkt);
});

/* ---------- deel 2: het hart end-to-end door de API ---------- */
let srv, base, lid, office, managerToken, stafToken;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-hart-'));

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const oapi = (pad, body) => api('office/' + pad, { ...(body || {}), naam: 'boardroom' }, office.token);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-HART-1' } });
  base = srv.base;
  const l = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'business' }) })).json();
  lid = { token: l.token };
  const o = await (await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'KANTOOR-HART-1' }) })).json();
  office = { token: o.token };
  assert.ok(lid.token && office.token, 'lid en kantoor zijn ingelogd');
  const roster = await (await fetch(base + '/api/supplier/roster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'KIKUNOI' }) })).json();
  const man = roster.staff.find(x => x.role === 'manager');
  const staf = roster.staff.find(x => x.role !== 'manager');
  managerToken = (await api('supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
  stafToken = (await api('supplier/login', { code: 'KIKUNOI', staffId: staf.id, pin: '5678' })).body.token;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('Business Pass: akkoord opent de betaalrekening EN automatisch (gratis) de zakelijke rekening', async () => {
  assert.equal((await oapi('bank/leden', { aan: true })).body.ledenAan, true, 'de boardroom zet de leden-bank live');
  const akk = await api('bank/akkoord', {}, lid.token);
  assert.equal(akk.status, 200);
  assert.ok(akk.body.rekening && akk.body.rekening.soort === 'betaal');
  assert.ok(akk.body.zakelijk && akk.body.zakelijk.soort === 'zakelijk', 'de zakelijke rekening komt er automatisch bij');
  lid.iban = akk.body.rekening.iban;
  lid.zakelijk = akk.body.zakelijk.iban;
  const nogEen = await api('bank/akkoord', {}, lid.token);
  assert.equal(nogEen.body.zakelijk, null, 'een tweede akkoord opent geen tweede zakelijke rekening');
});

test('het hart-afschrift: alles op een afschrift, extern geld herkenbaar aan het bronlabel', async () => {
  const stort = await api('bank/storten', { iban: lid.iban, centen: 5000, idem: 'h1' }, lid.token);
  assert.equal(stort.status, 200);
  const over = await api('bank/overboek', { vanIban: lid.iban, naarIban: lid.zakelijk, centen: 1250, oms: 'Werkkapitaal' }, lid.token);
  assert.equal(over.status, 200);
  const hart = await api('bank/hart', {}, lid.token);
  assert.equal(hart.status, 200);
  assert.equal(hart.body.provider, 'Kaartnaad (demo)', 'zonder echte provider heet de naad eerlijk demo');
  const bronnen = new Set(hart.body.regels.map(r => r.bron));
  assert.ok(bronnen.has('Kaartnaad (demo)'), 'de storting via de derde partij draagt het providerlabel');
  assert.ok(bronnen.has('RTG Rekening'), 'de eigen overboeking staat er gewoon tussen (het label heet sinds de Wft 3:7-hernoeming RTG Rekening)');
  for (const r of hart.body.regels) assert.ok(r.at && Number.isFinite(r.centen) && r.bron, 'elke regel heeft tijd, bedrag en bron');
});

test('premium gratis: inzichten en de vaste-lasten-radar geven hun overzicht', async () => {
  const inz = await api('bank/inzichten', {}, lid.token);
  assert.equal(inz.status, 200);
  assert.match(inz.body.maand, /^\d{4}-\d{2}$/);
  assert.ok(Array.isArray(inz.body.perSoort) && Array.isArray(inz.body.grootste));
  const vast = await api('bank/vastelasten', {}, lid.token);
  assert.equal(vast.status, 200);
  assert.ok(Array.isArray(vast.body.vasteLasten));
});

test('wisselgeld sparen: een veeg rondt de uitgaven van de maand af naar de spaarpot (idempotent)', async () => {
  const veeg = await api('bank/veeg', {}, lid.token);
  assert.equal(veeg.status, 200);
  assert.equal(veeg.body.geveegdCenten, 50, 'de overboeking van 12,50 laat 50 cent wisselgeld na');
  assert.ok(veeg.body.spaarIban, 'de spaarrekening is er automatisch bij gekomen');
  assert.equal(veeg.body.spaarSaldo, 50);
  const tweede = await api('bank/veeg', {}, lid.token);
  assert.equal(tweede.body.geveegdCenten, 0, 'dezelfde maand nog eens vegen boekt niets dubbel');
});

test('de zaak bankiert mee: de manager opent de zakelijke rekening van de zaak, de staf niet', async () => {
  const zaak = await api('supplier/bank/zakelijk', {}, managerToken);
  assert.equal(zaak.status, 200);
  assert.equal(zaak.body.rekening.soort, 'zakelijk');
  assert.ok(/^NL\d{2}RTGB\d{10}$/.test(zaak.body.rekening.iban));
  assert.ok(Array.isArray(zaak.body.afschrift));
  const weer = await api('supplier/bank/zakelijk', {}, managerToken);
  assert.equal(weer.body.rekening.iban, zaak.body.rekening.iban, 'een tweede bezoek vindt dezelfde rekening');
  assert.equal((await api('supplier/bank/zakelijk', {}, stafToken)).status, 403, 'alleen de manager');
});

test('de Regelwacht door de API: het kantoor voert een regel door en het hele systeem rekent per direct mee', async () => {
  const voor = await oapi('bank/regels');
  assert.equal(voor.status, 200);
  assert.ok(voor.body.peiljaar >= 2025);
  const nl = voor.body.landen.find(l => l.code === 'NL');
  assert.ok(nl && !nl.bijgewerkt, 'NL start op het ingebouwde peiljaar');

  const upd = await oapi('bank/regels/update', { landen: { NL: { uurloonMin: 15.5 } }, versie: 'kantoor-1' });
  assert.equal(upd.body.landen, 1);
  const na = await oapi('bank/regels');
  const nlNa = na.body.landen.find(l => l.code === 'NL');
  assert.equal(nlNa.uurloonMin, 15.5);
  assert.ok(nlNa.bijgewerkt);

  const fout = await oapi('bank/regels/update', { landen: { NL: { uurloonMin: 5000 } } });
  assert.equal(fout.body.landen, 0, 'een gekke waarde wordt geweigerd');

  const check = await oapi('bank/regels/check');
  assert.equal(check.body.ok, true);
  assert.equal(check.body.bron, null, 'zonder FISCAAL_BRON_URL meldt de check eerlijk: geen externe bron');
});

test('de poorten: gasten hebben geen hart, en zonder live bank blijft alles dicht gemeld', async () => {
  const g = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'guest' }) })).json();
  assert.equal((await api('bank/hart', {}, g.token)).status, 403, 'RTG Bank is voor leden');
  assert.equal((await api('bank/veeg', {}, g.token)).status, 403);
});
