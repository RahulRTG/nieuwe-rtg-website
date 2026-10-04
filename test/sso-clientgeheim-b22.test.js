/* B22 (besluit van de eigenaar, 4 oktober 2026; deur identity.sso_client_secret):
   strengere termijnen voor het SSO-clientgeheim, en zetten of roteren vraagt een
   VERSE passkey van wie het doet.

   1. de termijnen: standaard 30 dagen (rotatieadvies), hoogstens 90, overlap
      standaard 3;
   2. een lopend geheim van voor B22 met een langere vervaldatum wordt bij het
      lezen afgekapt op 90 dagen na uitgifte -- nooit verlengd, en de opgeslagen
      datum blijft wat hij was (hij zit in de AAD);
   3. echte server: zonder passkey 403 met de weg en er wordt niets geschreven;
      met passkey maar zonder ceremonie 401 bevestigingNodig; een ceremonie van
      een andere handeling opent niets; met een verse ceremonie 200.

   Draai los: node --test test/sso-clientgeheim-b22.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ssob22-'));
process.env.RTG_DATA_DIR = TMP;
require('../server/accounts').init();
const cg = require('../server/sso/clientgeheim');
const rotatie = require('../server/sso/clientgeheim-rotatie');
test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const DAG = 86400000;
const NU = Date.parse('2026-10-04T12:00:00Z');
const iso = t => new Date(t).toISOString();

test('1. de termijnen van B22: 30 standaard, 90 hoogstens, overlap 3', () => {
  assert.deepEqual([cg.GRENS.standaardDagen, cg.GRENS.maxDagen, cg.GRENS.standaardOverlap], [30, 90, 3]);
  const org = 'b22';
  const eerste = rotatie.roteer(org, 'een', null, {}, NU).waarde;
  assert.equal(cg.stand(org, eerste, NU).vervalt, iso(NU + 30 * DAG), 'zonder keuze: het rotatieadvies');
  const tweede = rotatie.roteer(org, 'twee', eerste, {}, NU + DAG).waarde;
  assert.equal(cg.stand(org, tweede, NU + DAG).overlap.tot, iso(NU + 4 * DAG), 'overlap standaard 3 dagen');
  assert.equal(cg.stand(org, rotatie.roteer(org, 'm', null, { dagen: 90 }, NU).waarde, NU).dagenOver, 90);
  for (const o of [{ dagen: 91 }, { vervalt: iso(NU + 91 * DAG) }])
    assert.throws(() => rotatie.roteer(org, 'x', null, o, NU), e => e.code === 'VERVAL_ONGELDIG', JSON.stringify(o));
});

test('2. een lopend geheim van voor B22 wordt afgekapt op 90 dagen na uitgifte, niet verlengd', () => {
  const org = 'lopend';
  const lang = cg.schrijf([cg.zegelSlot(org, 'lang', { gezet: iso(NU), vervalt: iso(NU + 365 * DAG) })]);
  assert.deepEqual(cg.geldige(org, lang, NU + 89 * DAG).geheimen, ['lang']);
  assert.equal(cg.geldige(org, lang, NU + 91 * DAG).code, 'VERLOPEN', 'na 90 dagen dicht, niet na 365');
  const s = cg.stand(org, lang, NU);
  assert.equal(s.vervalt, iso(NU + 90 * DAG));
  assert.equal(s.afgekapt, true, 'het scherm ziet dat hij is afgekapt');
  assert.equal(s.dagenOver, 90);
  assert.equal(JSON.parse(lang.slice(cg.MERK.length)).sloten[0].vervalt, iso(NU + 365 * DAG),
    'de opgeslagen datum is niet herschreven (AAD)');
  // al ouder dan 90 dagen bij de uitrol: meteen dicht, met de reden
  const oud = cg.schrijf([cg.zegelSlot(org, 'oud', { gezet: iso(NU - 120 * DAG), vervalt: iso(NU + 200 * DAG) })]);
  assert.equal(cg.geldige(org, oud, NU).code, 'VERLOPEN');
  // een korter verval blijft gewoon staan
  const kort = cg.schrijf([cg.zegelSlot(org, 'kort', { gezet: iso(NU), vervalt: iso(NU + 10 * DAG) })]);
  assert.equal(cg.stand(org, kort, NU).afgekapt, false);
  // de overlap van een afgekapt slot loopt nooit voorbij de afkapping
  const rot = rotatie.roteer(org, 'nieuw', cg.schrijf([cg.zegelSlot(org, 'lang', { gezet: iso(NU - 89 * DAG),
    vervalt: iso(NU + 300 * DAG) })]), { overlapDagen: 3 }, NU).waarde;
  assert.equal(cg.stand(org, rot, NU).overlap.tot, iso(NU + DAG));
});

test('4. B27: de overlap is hoogstens 7 dagen, en meer wordt geweigerd in plaats van afgekapt', () => {
  assert.equal(cg.GRENS.maxOverlap, 7);
  const org = 'b27';
  const eerste = rotatie.roteer(org, 'een', null, {}, NU).waarde;
  const zeven = rotatie.roteer(org, 'twee', eerste, { overlapDagen: 7 }, NU).waarde;
  assert.equal(cg.stand(org, zeven, NU).overlap.tot, iso(NU + 7 * DAG), '7 mag, en loopt dan ook 7 dagen');
  for (const d of [8, 30, '8'])
    assert.throws(() => rotatie.roteer(org, 'drie', eerste, { overlapDagen: d }, NU),
      e => e.code === 'OVERLAP_ONGELDIG' && e.status === 400 && /0 tot 7 dagen/.test(e.message), String(d));
});

test('3. echte server: zetten en roteren vragen een verse passkey, zonder terugval', { timeout: 180000 }, async () => {
  const { startServer, stop } = require('./helper');
  const { zwaarApi } = require('./zwaarpasskey');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ssob22-srv-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: map, RTG_OWNER_EMAIL: '' } });
  const api = (pad, body, token, methode) => fetch(srv.base + pad, { method: methode || 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: methode === 'GET' ? undefined : JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  try {
    const eig = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
    assert.ok(eig);
    const k = { org: 'b22klant', naam: 'B22', issuer: 'https://idp.b22klant.test', clientId: 'c', domeinen: ['b22klant.test'] };
    const stand = async () => (await api('/api/techniek/sso', null, eig, 'GET')).body.koppelingen.find(x => x.org === 'b22klant');

    const kaal = await api('/api/techniek/sso', { ...k, clientSecret: 'eerste' }, eig);
    assert.equal(kaal.status, 403, 'zonder passkey geen geheim: ' + JSON.stringify(kaal.body));
    assert.equal(kaal.body.watNu, 'passkey-zetten', 'met de weg');
    assert.equal(await stand(), undefined, 'en er is niets geschreven, ook de koppeling niet');
    assert.equal((await api('/api/techniek/sso', k, eig)).status, 200, 'een koppeling zonder geheim vraagt geen passkey');
    assert.equal((await api('/api/techniek/sso/geheim', { org: 'b22klant', clientSecret: 'eerste' }, eig)).status, 403);
    assert.equal((await stand()).geheimGezet, false);

    const zw = await zwaarApi(api, srv.base, eig);
    const zonder = await api('/api/techniek/sso/geheim', { org: 'b22klant', clientSecret: 'eerste' }, eig);
    assert.equal(zonder.status, 401);
    assert.equal(zonder.body.bevestigingNodig, true);
    assert.equal(zonder.body.actie, 'eigenaar-ssogeheim');
    // een ceremonie voor een andere zware handeling opent deze niet
    const ander = await api('/api/techniek/bevestig/opties', { actie: 'eigenaar-techniektoegang' }, eig);
    const vreemd = await api('/api/techniek/sso/geheim', { org: 'b22klant', clientSecret: 'eerste', ceremonie: ander.body.ceremonie,
      antwoord: zw.sleutel.loginAntwoord(ander.body.opties.challenge, new URL(srv.base).origin, 50) }, eig);
    assert.ok([400, 401, 403].includes(vreemd.status), 'een ceremonie van een andere handeling: ' + vreemd.status);
    assert.equal((await stand()).geheimGezet, false, 'nog steeds niets geschreven');

    const gezet = await zw('/api/techniek/sso/geheim', { org: 'b22klant', clientSecret: 'eerste' }, eig);
    assert.equal(gezet.status, 200, JSON.stringify(gezet.body));
    assert.ok([29, 30].includes(gezet.body.geheim.dagenOver), 'standaard 30 dagen');
    const rot = await zw('/api/techniek/sso', { ...k, clientSecret: 'tweede' }, eig);
    assert.equal(rot.status, 200, JSON.stringify(rot.body));
    assert.equal(Date.parse(rot.body.geheim.overlap.tot) - Date.now() < 3 * DAG + 60000, true, 'overlap standaard 3 dagen');
    const teLang = await zw('/api/techniek/sso/geheim', { org: 'b22klant', clientSecret: 'derde', dagen: 91 }, eig);
    assert.equal(teLang.status, 400);
    assert.equal(teLang.body.code, 'VERVAL_ONGELDIG');
    // B27: een overlap boven 7 dagen wordt geweigerd met de reden, en er verandert niets
    const voor = await stand();
    const teVeel = await zw('/api/techniek/sso/geheim', { org: 'b22klant', clientSecret: 'vierde', overlapDagen: 8 }, eig);
    assert.equal(teVeel.status, 400, JSON.stringify(teVeel.body));
    assert.equal(teVeel.body.code, 'OVERLAP_ONGELDIG');
    assert.match(String(teVeel.body.error), /0 tot 7 dagen/, 'met de reden');
    assert.deepEqual(await stand(), voor, 'een geweigerde overlap schrijft niets');
  } finally {
    stop(srv.child);
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  }
});
