'use strict';
/* EEN FESTIVALDIENST KAN AAN EEN TEAMLID HANGEN, EN DAN LEEST HET ROOSTER VERZUIM
   (kern/festival/dienst.js, PLANNING.md par. 6).

   Tegen een echte server, met de zaak ESVEDRA uit de zaaiset. Een manager kiest
   uit zijn eigen team; staat dat teamlid als afwezig, dan komt de dienst er wel
   in (een mens beslist) maar met een waarschuwing, en het rooster zegt DAT hij
   afwezig is, nooit waarom. Een naam van buiten het team blijft een naam. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

test('een dienst aan een afwezig teamlid: wel ingepland, met waarschuwing, en zichtbaar afwezig', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-festverzuim-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const api = (pad, body, token) => fetch(srv.base + '/api/' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const login = async (code, manager) => {
    const staff = (await api('supplier/roster', { code })).body.staff;
    const wie = staff.find(x => (x.role === 'manager') === manager);
    return { wie, tok: (await api('supplier/login', { code, staffId: wie.id, pin: manager ? '1234' : '5678' })).body.token };
  };
  try {
    const baas = await login('ESVEDRA', true), mw = await login('ESVEDRA', false), ander = await login('MACE', false);
    const vandaag = new Date().toISOString().slice(0, 10);
    const fid = (await api('festival/nieuw', { naam: 'Verzuimfest' }, baas.tok)).body.festival.id;
    const eid = (await api('festival/editie', { festival: fid, jaar: 2027 }, baas.tok)).body.editie.id;
    const dag = (await api('festival/dag', { festival: fid, editie: eid, datum: vandaag, open: '00:00', sluit: '23:59' }, baas.tok)).body.dag.id;
    const terrein = (await api('festival/plek', { festival: fid, editie: eid, naam: 'Terrein', soort: 'terrein', capaciteit: 500 }, baas.tok)).body.plek.id;
    const plek = (await api('festival/plek', { festival: fid, editie: eid, naam: 'Bar Noord', soort: 'bar', ouder: terrein }, baas.tok)).body.plek.id;
    const zet = (body) => api('festival/dienst', { festival: fid, editie: eid, dag, plek, van: '10:00', tot: '14:00', ...body }, baas.tok);

    const gezond = await zet({ staffId: mw.wie.id, wie: 'Een andere naam' });
    assert.equal(gezond.status, 200, JSON.stringify(gezond.body));
    assert.equal(gezond.body.dienst.wie, mw.wie.name, 'de naam komt uit het team, niet uit het veld');
    assert.equal(gezond.body.afwezigWaarschuwing, undefined);

    assert.equal((await zet({ staffId: 999999 })).status, 404, 'een onbekend teamlid wordt geweigerd');
    assert.equal((await zet({ staffId: ander.wie.id, van: '15:00', tot: '16:00' })).status, 404,
      'een medewerker van een ANDERE zaak is geen teamlid');

    assert.equal((await api('staff/leave/request', { soort: 'ziek' }, mw.tok)).status, 200);
    const ziek = await zet({ staffId: mw.wie.id, van: '15:00', tot: '18:00' });
    assert.equal(ziek.status, 200, 'een mens mag toch inplannen: ' + JSON.stringify(ziek.body));
    assert.match(ziek.body.afwezigWaarschuwing || '', /als afwezig gemeld/);
    assert.doesNotMatch(ziek.body.afwezigWaarschuwing, /ziek/i, 'DAT, nooit waarom');

    const buiten = await zet({ wie: 'Vrijwilliger Jan', van: '18:00', tot: '20:00' });
    assert.equal(buiten.status, 200);
    assert.equal(buiten.body.dienst.staffId, null, 'een naam van buiten het team wordt niet op naam aan iemand gekoppeld');

    const lijst = await api('festival/diensten', { festival: fid, editie: eid, dag }, baas.tok);
    assert.ok(Array.isArray(lijst.body.team) && lijst.body.team.some(m => m.id === mw.wie.id), 'de manager krijgt het team om uit te kiezen');
    const vanMw = lijst.body.diensten.filter(d => d.staffId === mw.wie.id);
    assert.equal(vanMw.length, 2);
    assert.ok(vanMw.every(d => d.afwezig === true), 'het rooster zegt DAT hij afwezig is');
    assert.equal(lijst.body.diensten.find(d => d.wie === 'Vrijwilliger Jan').afwezig, undefined);
    assert.doesNotMatch(JSON.stringify(lijst.body), /ziek/i);

    const alsMw = await api('festival/diensten', { festival: fid, editie: eid, dag }, mw.tok);
    assert.equal(alsMw.body.team, undefined, 'een medewerker krijgt de teamlijst niet mee');
  } finally {
    stop(srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen mag falen */ }
  }
});
