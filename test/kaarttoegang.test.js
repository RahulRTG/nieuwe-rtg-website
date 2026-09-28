/* De code van een OV-vervoerbewijs (travelos.mobility_transport_ticket),
   control voor control: 128 bits en kaal eenmaal, hash-only, issuer/doel/scope,
   verval met het kaartje, max_gebruik = ritten (en een rotatie speelt geen rit
   vrij), constant-time zoeken, de claim in de collectietransactie, en oude
   codes die niets meer openen. De laatste toets draait tegen een ECHTE server
   (de rest van de keten staat in test/ovkaart.test.js). De race over twee
   instances staat in test/ticketcodes.pg.test.js.
   Draai los: node --test test/kaarttoegang.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const T0 = Date.parse('2026-09-27T12:00:00.000Z');
const PRODUCTEN = { enkel: { ritten: 1 }, retour: { ritten: 2 } };

function wereld() {
  let klok = T0;
  const db = { data: { mobKaartjes: [], mobReizen: [] }, writable: true };
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'json', db, save() {} });
  const opslag = { bak: n => db.data[n] };
  const ctx = { crypto, nu: () => new Date(klok).toISOString(), save() {}, opslag, bewerkCollectie,
    KAART_PRODUCTEN: PRODUCTEN, kaartMet: id => db.data.mobKaartjes.find(k => k.id === id) || null,
    kaartStand: () => ({ stand: 'geldig' }) };
  const kern = require('../server/kern/mobiliteit/kaarttoegang')(ctx);
  const kaart = (id, extra) => {
    const k = Object.assign({ id, key: 'lid:' + id, vervoerder: 'BUS', product: 'enkel', lijnId: 'L1',
      geldigVan: new Date(T0).toISOString(), geldigTot: new Date(T0 + 2 * 3600000).toISOString(), validaties: [] }, extra);
    db.data.mobKaartjes.push(k); return k;
  };
  const toon = k => kern.kaartToon({ kaartje: k, key: k.key, stand: { stand: 'geldig' } });
  const claim = (code, vervoerder = 'BUS', controleer = () => null) => kern.kaartClaim({ code, vervoerder, controleer });
  return { db, kern, kaart, toon, claim, schuif: ms => { klok += ms; } };
}

test('1. 128 bits, kaal eenmaal, hash-only, issuer/doel/scope en verval met het kaartje', () => {
  const w = wereld();
  const k = w.kaart('K1');
  const r = w.toon(k);
  assert.match(r.code, /^OV\.[0-9A-F]{32}$/);
  assert.equal(JSON.stringify(w.db.data.mobKaartToegang).includes(r.code.slice(3)), false);
  assert.equal(JSON.stringify(k).includes(r.code.slice(3)), false);
  assert.equal(r.toegang.issuer, 'rtg.lid.vervoerbewijs');
  assert.equal(r.toegang.doel, 'ov-vervoerbewijs');
  assert.deepEqual(r.toegang.scope, ['vervoerder.kaart.controle']);
  assert.equal(r.toegang.expires_at, k.geldigTot);
  assert.equal(r.toegang.max_gebruik, 1);
  assert.equal(w.claim(r.code, 'ANDER').status, 404, 'de scope is de vervoerder');
  w.schuif(3 * 3600000);
  assert.match(w.claim(r.code).error, /verlopen/);
});

test('2. max_gebruik = ritten, en een rotatie neemt de teller mee', () => {
  const w = wereld();
  const k = w.kaart('K2', { product: 'retour' });
  const a = w.toon(k);
  assert.equal(a.toegang.max_gebruik, 2);
  assert.equal(w.claim(a.code).status, 200);
  const b = w.toon(k);
  assert.equal(b.toegang.gebruik, 1, 'de gebruikte heenweg reist mee naar de nieuwe code');
  assert.equal(w.claim(a.code).status, 409, 'de vorige code is ingetrokken');
  assert.equal(w.claim(b.code).status, 200);
  assert.match(w.claim(b.code).error, /volledig gebruikt/);
  // een abonnement: geteld, niet begrensd (het plafond van de bearerlaag)
  const ab = w.kaart('A1', { product: 'abonnement' });
  assert.equal(w.toon(ab).toegang.max_gebruik, 10000);
});

test('3. een weigering van het kaartje (stand, lijn) telt geen rit', () => {
  const w = wereld();
  const { code } = w.toon(w.kaart('K3'));
  const nee = w.claim(code, 'BUS', () => ({ status: 409, error: 'andere lijn' }));
  assert.equal(nee.status, 409);
  assert.equal(w.db.data.mobKaartToegang.K3.gebruik, 0);
  assert.equal(w.claim(code).status, 200);
});

test('4. alleen de houder, alleen een geldig kaartje', () => {
  const w = wereld();
  const k = w.kaart('K4');
  assert.equal(w.kern.kaartToon({ kaartje: k, key: 'lid:iemand', stand: { stand: 'geldig' } }).status, 404);
  assert.equal(w.kern.kaartToon({ kaartje: k, key: k.key, stand: { stand: 'terugbetaald', reden: 'uitgevallen' } }).status, 409);
});

test('5. constant-time: elke hash wordt vergeleken, ook na een treffer', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'mobiliteit', 'kaarttoegang.js'), 'utf8');
  const lus = bron.slice(bron.indexOf('for (const x of Object.values(bron))'), bron.indexOf('if (!r && oud'));
  assert.ok(lus.length > 40);
  assert.match(lus, /bearer\.zelfdeHash\(/);
  assert.doesNotMatch(lus, /\b(return|break)\b/);
  assert.doesNotMatch(lus, /===\s*gezocht|gezocht\s*===/);
});

test('6. oude codes gaan van kaartje en reis af en openen niets', () => {
  const w = wereld();
  const k = w.kaart('L1', { code: 'OUDECODEABCDEF' });
  w.db.data.mobReizen.push({ id: 'r1', etappes: [{ wijze: 'ov', kaartje: 'OUDECODEABCDEF' }] });
  assert.ok(w.kern.kaartLegacyRuim() >= 2);
  assert.equal('code' in k, false);
  assert.equal(w.db.data.mobReizen[0].etappes[0].kaartje, 'L1', 'de reis wijst nu naar het id');
  assert.equal(w.claim('OUDECODEABCDEF').status, 404);
  assert.equal(w.toon(k).status, 200, 'het kaartje houdt zijn waarde');
});

test('7. echte server: Mijn kaartjes toont geen code, tonen roteert, de controle telt', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ovk-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-OVK-1' } });
  const api = async (pad, body, token) => {
    const r = await fetch(base + pad, { method: 'POST', body: JSON.stringify(body || {}),
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}) });
    const tekst = await r.text();
    let json = {}; try { json = JSON.parse(tekst); } catch (e) { json = {}; }
    return { status: r.status, body: json, tekst, koppen: r.headers };
  };
  try {
    const reg = n => api('/api/auth/register', { name: 'Ovk ' + n, email: 'ovk' + n + '@x.nl', phone: '061237' + n,
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    const lid = (await reg('7701')).body.token, ander = (await reg('7702')).body.token;
    const kantoor = (await api('/api/office/login', { code: 'KANTOOR-OVK-1' })).body.token;
    for (const m of ['partner_contracts', 'public_transport_ticketing'])
      await api('/api/office/mob/module/zet', { id: m, aan: true }, kantoor);
    await api('/api/office/mob/overeenkomst', { vervoerder: 'TRANSIT', van: '2020-01-01', tot: '2099-12-31',
      producten: ['enkel'], lijnen: ['L1'], getekendDoor: 'J. Directeur' }, kantoor);
    const roster = (await api('/api/supplier/roster', { code: 'TRANSIT' })).body.staff;
    const pda = (await api('/api/supplier/login', { code: 'TRANSIT', staffId: roster.find(x => x.role !== 'manager').id, pin: '5678' })).body.token;
    const koop = await api('/api/mob/kaart/koop', { vervoerder: 'TRANSIT', lijnId: 'L1', van: 'h-stad',
      naar: 'h-tal', product: 'enkel', idem: 'ovk1' }, lid);
    assert.equal(koop.status, 200, koop.tekst);
    assert.doesNotMatch(koop.tekst, /OV\.[0-9A-F]{32}/);
    const id = koop.body.kaartje.id;
    assert.equal((await api('/api/mob/kaart/toon', { id }, ander)).status, 404);
    const een = await api('/api/mob/kaart/toon', { id }, lid);
    assert.equal(een.koppen.get('cache-control'), 'no-store');
    const twee = await api('/api/mob/kaart/toon', { id }, lid);
    assert.equal((await api('/api/mob/kaart/mijn', {}, lid)).tekst.includes(twee.body.code.slice(3)), false);
    assert.equal((await api('/api/staff/mob/kaart/controle', { code: een.body.code, lijnId: 'L1' }, pda)).status, 409);
    const goed = await api('/api/staff/mob/kaart/controle', { code: twee.body.code, lijnId: 'L1' }, pda);
    assert.equal(goed.status, 200, goed.tekst);
    assert.equal((await api('/api/staff/mob/kaart/controle', { code: twee.body.code, lijnId: 'L1' }, pda)).status, 409);
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
