/* PR-plus (server): de volle PR-kamer van elke zaak. Getoetst: de
   campagneplanner (inplannen, valideren, weghalen, en het rijpe plan dat
   bij het overzicht vanzelf op De Salon verschijnt), de nieuwsbrief met de
   7-dagenrem, en de rolgrens (alleen management).
   Draai los: node --experimental-sqlite --test test/prplus.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pr-')); }
async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json() };
}
const slaap = ms => new Promise(r => setTimeout(r, ms));

test('1. campagneplanner: inplannen, valideren, weghalen en vanzelf publiceren', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const roster = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const mgr = roster.staff.find(x => x.role === 'manager');
    const sup = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
    assert.ok(sup, 'manager ingelogd');

    // valideren: lege tekst, moment in het verleden, deal zonder titel
    let r = await api(base, '/api/supplier/pr/plan', { tekst: '', publiceerOp: new Date(Date.now() + 3600000).toISOString() }, sup);
    assert.equal(r.status, 400, 'lege tekst geweigerd');
    r = await api(base, '/api/supplier/pr/plan', { tekst: 'x', publiceerOp: new Date(Date.now() - 3600000).toISOString() }, sup);
    assert.equal(r.status, 400, 'verleden geweigerd');
    r = await api(base, '/api/supplier/pr/plan', { soort: 'deal', tekst: 'x', publiceerOp: new Date(Date.now() + 3600000).toISOString() }, sup);
    assert.equal(r.status, 400, 'deal zonder titel geweigerd');

    // een plan ver vooruit: blijft gepland en is weg te halen
    r = await api(base, '/api/supplier/pr/plan', { tekst: 'Volgende maand een nieuwe kaart.', publiceerOp: new Date(Date.now() + 30 * 86400000).toISOString() }, sup);
    assert.equal(r.status, 200);
    const verWeg = r.body.campagne.id;
    r = await api(base, '/api/supplier/pr/plan/weg', { id: verWeg }, sup);
    assert.equal(r.status, 200, 'gepland plan weggehaald');

    // een plan dat zo meteen rijp is: het overzicht publiceert het vanzelf
    r = await api(base, '/api/supplier/pr/plan', { tekst: 'Vanavond een proeverij aan zee.', publiceerOp: new Date(Date.now() + 800).toISOString() }, sup);
    assert.equal(r.status, 200);
    await slaap(1200);
    r = await api(base, '/api/supplier/pr/overzicht', {}, sup);
    assert.equal(r.status, 200);
    const c = r.body.campagnes.find(x => x.tekst.includes('proeverij'));
    assert.equal(c.status, 'geplaatst', 'rijp plan is gepubliceerd');
    assert.ok(c.postId, 'met een echte Salon-post');
    assert.ok(r.body.bereik.some(p => p.tekst.includes('proeverij')), 'en telt mee in het bereik');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('2. nieuwsbrief met 7-dagenrem, en de rolgrens voor de hele kamer', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const roster = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const mgr = roster.staff.find(x => x.role === 'manager');
    const med = roster.staff.find(x => x.role !== 'manager');
    const supM = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
    const supW = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: med.id, pin: '5678' })).body.token;

    // zonder onderwerp geen brief; met onderwerp een nette verzending (0 volgers mag)
    let r = await api(base, '/api/supplier/pr/nieuwsbrief', { onderwerp: '', tekst: 'x' }, supM);
    assert.equal(r.status, 400);
    r = await api(base, '/api/supplier/pr/nieuwsbrief', { onderwerp: 'Nieuws van het huis', tekst: 'De herfstkaart staat online.' }, supM);
    assert.equal(r.status, 200);
    assert.ok(r.body.verstuurd >= 0, 'verzonden teller aanwezig');
    // de rem: een tweede brief binnen 7 dagen wordt geweigerd
    r = await api(base, '/api/supplier/pr/nieuwsbrief', { onderwerp: 'Nog een keer', tekst: 'Te snel.' }, supM);
    assert.equal(r.status, 429, 'de 7-dagenrem staat erop');
    // het overzicht weet het ook
    r = await api(base, '/api/supplier/pr/overzicht', {}, supM);
    assert.equal(r.body.nieuwsbrief.magWeer, false);
    assert.equal(r.body.nieuwsbrief.laatste.onderwerp, 'Nieuws van het huis');

    // de rolgrens: een medewerker komt de PR-kamer niet in
    for (const pad of ['/api/supplier/pr/overzicht', '/api/supplier/pr/plan', '/api/supplier/pr/nieuwsbrief']) {
      r = await api(base, pad, { onderwerp: 'x', tekst: 'x', publiceerOp: new Date(Date.now() + 3600000).toISOString() }, supW);
      assert.ok(r.status >= 400, pad + ' alleen voor management');
    }
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
