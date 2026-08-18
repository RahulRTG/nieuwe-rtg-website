/* HR-plus (server): de volle HR-kamer van elke zaak. Getoetst: het
   manager-overzicht (dienstjaren, verloopbewaking), de inwerk-keten
   (starten, vinken, eigen stap, dubbel starten geweigerd), groeigesprekken
   en certificaten, en de privacygrens: een medewerker ziet alleen het
   eigen dossier en komt niet in het manager-overzicht.
   Draai los: node --test test/hrplus.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-hr-')); }
async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json() };
}

test('1. manager: overzicht, inwerk-keten, gesprek en certificaat met verloopbewaking', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const roster = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const mgr = roster.staff.find(x => x.role === 'manager');
    const med = roster.staff.find(x => x.role !== 'manager');
    const sup = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
    assert.ok(sup, 'manager ingelogd');

    // het overzicht: dienstjaren voor het hele team, nog niets in de bakken
    let r = await api(base, '/api/supplier/hr/overzicht', {}, sup);
    assert.equal(r.status, 200);
    assert.ok(r.body.dienst.length >= 2, 'dienstjaren voor het team');
    assert.ok(r.body.dienst.every(d => d.sinds && d.volgendJubileum), 'sinds + volgend jubileum');
    assert.deepEqual([r.body.inwerk, r.body.gesprekken, r.body.certificaten].map(x => x.length), [0, 0, 0]);

    // inwerk: starten, vinken, een eigen stap, en dubbel starten wordt geweigerd
    r = await api(base, '/api/supplier/hr/inwerk/start', { staffId: med.id }, sup);
    assert.equal(r.status, 200);
    const traject = r.body.traject;
    assert.equal(traject.stappen.length, 7, 'de vaste route: 7 stappen');
    assert.ok(traject.stappen.some(s => s.fase === 'dag1') && traject.stappen.some(s => s.fase === 'maand1'));
    r = await api(base, '/api/supplier/hr/inwerk/start', { staffId: med.id }, sup);
    assert.equal(r.status, 409, 'geen tweede lopend traject');
    r = await api(base, '/api/supplier/hr/inwerk/vink', { trajectId: traject.id, stapId: traject.stappen[0].id }, sup);
    assert.equal(r.body.traject.stappen[0].klaar, true, 'stap afgevinkt');
    r = await api(base, '/api/supplier/hr/inwerk/stap', { trajectId: traject.id, tekst: 'Wijnkennis met de sommelier', fase: 'maand1' }, sup);
    assert.equal(r.body.traject.stappen.length, 8, 'eigen stap erbij');

    // groeigesprek: vastleggen en teruglezen
    r = await api(base, '/api/supplier/hr/gesprek', { staffId: med.id, onderwerp: 'Eerste kwartaal', verslag: 'Sterke start.', afspraken: 'Volgend gesprek over drie maanden.' }, sup);
    assert.equal(r.status, 200);
    r = await api(base, '/api/supplier/hr/gesprekken', { staffId: med.id }, sup);
    assert.equal(r.body.gesprekken.length, 1);

    // certificaat dat bijna verloopt: komt in de verloopbewaking, en is weg te halen
    const bijna = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
    r = await api(base, '/api/supplier/hr/certificaat', { staffId: med.id, soort: 'EHBO', verlooptOp: bijna }, sup);
    assert.equal(r.status, 200);
    const certId = r.body.certificaat.id;
    r = await api(base, '/api/supplier/hr/overzicht', {}, sup);
    assert.equal(r.body.verlopend.length, 1, 'verloopbewaking ziet het');
    assert.equal(r.body.verlopend[0].verlopen, false, 'nog niet verlopen, wel bijna');
    r = await api(base, '/api/supplier/hr/certificaat/weg', { id: certId }, sup);
    assert.equal(r.status, 200);
    r = await api(base, '/api/supplier/hr/overzicht', {}, sup);
    assert.equal(r.body.certificaten.length, 0, 'certificaat weg');

    // zonder naam geen certificaat
    r = await api(base, '/api/supplier/hr/certificaat', { staffId: med.id, soort: '' }, sup);
    assert.equal(r.status, 400);
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('2. privacygrens: de medewerker ziet alleen het eigen dossier', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const roster = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const mgr = roster.staff.find(x => x.role === 'manager');
    const med = roster.staff.find(x => x.role !== 'manager');
    const supM = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
    const supW = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: med.id, pin: '5678' })).body.token;
    assert.ok(supM && supW, 'beide ingelogd');

    // de manager legt een gesprek vast met de medewerker en een met zichzelf
    await api(base, '/api/supplier/hr/gesprek', { staffId: med.id, verslag: 'Gesprek met de medewerker.' }, supM);
    await api(base, '/api/supplier/hr/gesprek', { staffId: mgr.id, verslag: 'Gesprek van de chef zelf.' }, supM);
    const t = (await api(base, '/api/supplier/hr/inwerk/start', { staffId: med.id }, supM)).body.traject;

    // het manager-overzicht is dicht voor de medewerker
    let r = await api(base, '/api/supplier/hr/overzicht', {}, supW);
    assert.ok(r.status >= 400, 'overzicht alleen voor management');
    // gesprekken: de medewerker krijgt ALLEEN het eigen gesprek, ook met andermans staffId in de vraag
    r = await api(base, '/api/supplier/hr/gesprekken', { staffId: mgr.id }, supW);
    assert.equal(r.body.gesprekken.length, 1);
    assert.equal(r.body.gesprekken[0].staffId, med.id, 'alleen het eigen dossier');
    // een certificaat opvoeren mag de medewerker niet
    r = await api(base, '/api/supplier/hr/certificaat', { staffId: med.id, soort: 'BHV' }, supW);
    assert.ok(r.status >= 400, 'certificaten zet alleen management');
    // maar de eigen inwerkstap afvinken mag wel, en hr/mijn toont het eigen beeld
    r = await api(base, '/api/supplier/hr/inwerk/vink', { trajectId: t.id, stapId: t.stappen[1].id }, supW);
    assert.equal(r.status, 200, 'eigen stap vinken mag');
    r = await api(base, '/api/supplier/hr/mijn', {}, supW);
    assert.equal(r.body.inwerk.length, 1);
    assert.equal(r.body.gesprekken.length, 1);
    assert.ok(r.body.inwerk[0].stappen.some(s => s.klaar), 'de gevinkte stap staat er');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
