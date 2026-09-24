/* Magnaat Van Nul (V1 From Zero): van een mens met € 63 en een baan, via de
   eerste klant, een factuur die te laat wordt betaald en geldnood, naar een
   eerste bedrijf. Elke euro loopt door het grootboek en de klok rekent bij. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakLeven } = require('../server/kern/magnaat-leven');
const R = require('../server/kern/magnaat-leven/regels');
const { startServer } = require('./helper');

function leven() {
  let t = 1e12;
  const db = { data: {} };
  const L = maakLeven({ db, nu: () => t });
  return {
    db, L,
    dagen: (n = 1) => { t += R.DAG_MS * n; return L.staat('lid'); },
    doe: (b) => L.actie('lid', b)
  };
}
const deal = (s, fase) => s.netwerk.contacten.find(c => c.fase === fase);

/* De hele keten, met een speler die doet wat een mens zou doen. */
function speel(v, { herinner = true } = {}) {
  let s = v.L.staat('lid');
  v.doe({ actie: 'project', aanbod: 'websites' });
  s = v.doe({ actie: 'netwerk' });
  const id = deal(s, 'lead').id;
  v.doe({ actie: 'offerte', deal: id, bedrag: 1100 });
  s = v.dagen();
  s = v.doe({ actie: 'onderhandel', deal: id, keuze: 'accepteer' });
  while (deal(s, 'opdracht')) { v.doe({ actie: 'werk', deal: id, uren: 99 }); s = v.dagen(); }
  s = v.doe({ actie: 'onderneming', naam: 'Webwerk Oudwijk' });
  s = v.doe({ actie: 'factuur', deal: id });
  for (let i = 0; i < 40 && !deal(s, 'betaald'); i++) {
    s = v.dagen();
    if (s.geld.kas < 0 && !s.geld.lening) v.doe({ actie: 'lenen', bedrag: 300 });
    if (herinner && s.vandaag.volgende.some(x => x.actie === 'herinnering')) s = v.doe({ actie: 'herinnering', deal: id });
  }
  return { s, id };
}

test('begin: € 63, een baan, alleen RTG Geld, en geen bedrijf', () => {
  const { L } = leven();
  const s = L.staat('lid');
  assert.equal(s.geld.kas, R.START_KAS);
  assert.equal(s.geld.grootboek, R.START_KAS);
  assert.equal(s.werk.baan.werkgever, R.BAAN.werkgever);
  assert.equal(s.bedrijf, null, 'Mijn bedrijf bestaat pas met een onderneming');
  assert.deepEqual(s.rtg.map(r => r.id), ['geld']);
  assert.ok(s.vandaag.volgende.some(x => x.actie === 'project'));
});

test('de hele keten: klant, offerte, onderhandeling, werk, KvK, factuur, te laat, geldnood, betaald', () => {
  const v = leven();
  const { s } = speel(v);
  const d = s.netwerk.contacten[0];
  assert.equal(d.fase, 'betaald');
  assert.equal(d.bedrag, 80000, 'het tegenbod is geaccepteerd');
  assert.ok(d.factuur.betaaldOp > d.factuur.vervaldag, 'de eerste klant betaalt te laat');
  assert.ok(d.factuur.herinnerd);
  assert.ok(s.bedrijf && s.bedrijf.naam === 'Webwerk Oudwijk');
  assert.equal(s.bedrijf.omzet, 80000);
  for (const id of ['geld', 'berichten', 'offertes', 'facturen', 'zakelijk', 'budget']) {
    assert.ok(s.rtg.some(r => r.id === id), id + ' verschijnt als hij relevant wordt');
  }
  assert.ok(s.netwerk.contacten.some(c => c.via === 'Bakkerij Van Dam'), 'een betaalde klant beveelt je aan');
});

test('geld is het grootboek: kas en rekening zijn na elke stap gelijk, en het journaal klopt', () => {
  const v = leven();
  const { s } = speel(v);
  assert.equal(s.geld.kas, s.geld.grootboek);
  assert.equal(s.geld.klopt, true);
  const ctl = v.L.verifieer('lid');
  assert.equal(ctl.ok, true);
  assert.deepEqual(ctl.bevindingen, []);
  const st = v.db.data.magnaatLeven.lid;
  assert.ok(!/lid/.test(st.wereld), 'de wereld in het grootboek draagt geen sessiesleutel');
});

test('wie de wanbetaler niet herinnert, komt in geldnood en leent -- en ook dat loopt door het grootboek', () => {
  const v = leven();
  const { s } = speel(v, { herinner: false });
  const st = v.db.data.magnaatLeven.lid;
  assert.ok(st.meldingen.some(m => /leent je/.test(m.tekst)), 'geldnood tijdens het wachten op de betaling');
  assert.ok(s.geld.lening && s.geld.lening.restant === 30000);
  assert.equal(s.netwerk.contacten[0].fase, 'betaald');
  assert.equal(s.geld.kas, s.geld.grootboek);
  assert.equal(v.L.verifieer('lid').ok, true);
  const met = speel(leven()).s;
  assert.ok(met.netwerk.contacten[0].factuur.betaaldOp < s.netwerk.contacten[0].factuur.betaaldOp, 'een herinnering helpt');
});

test('dezelfde keten geeft dezelfde uitkomst, en tien dagen ineens is tien keer een dag', () => {
  const a = speel(leven()).s, b = speel(leven()).s;
  assert.deepEqual(a, b);
  const los = leven(), ineens = leven();
  los.L.staat('lid'); ineens.L.staat('lid');
  let x; for (let i = 0; i < 10; i++) x = los.dagen();
  const y = ineens.dagen(10);
  assert.equal(x.dag, y.dag);
  assert.equal(x.geld.kas, y.geld.kas);
});

test('zonder onderneming geen factuur, en elke weigering zegt waarom', () => {
  const v = leven();
  v.doe({ actie: 'project', aanbod: 'fotografie' });
  let s = v.doe({ actie: 'netwerk' });
  const id = deal(s, 'lead').id;
  v.doe({ actie: 'offerte', deal: id, bedrag: 800 });
  s = v.dagen();
  assert.equal(s.netwerk.contacten[0].fase, 'opdracht', 'binnen budget: meteen akkoord');
  while (deal(s, 'opdracht')) { v.doe({ actie: 'werk', deal: id, uren: 99 }); s = v.dagen(); }
  const r = v.doe({ actie: 'factuur', deal: id });
  assert.equal(r.status, 400);
  assert.match(r.error, /Kamer van Koophandel/);
  assert.ok(s.vandaag.volgende.some(x => x.actie === 'onderneming'));
  assert.match(v.doe({ actie: 'bestaatniet' }).error, /bestaat niet/);
  assert.match(v.doe({ actie: 'lenen', bedrag: 5000 }).error, /hooguit/);
});

test('een extra dienst kan een keer per dag, en een tweede poging beweegt geen geld', () => {
  const v = leven();
  const s0 = v.L.staat('lid');
  assert.ok(s0.weekend, 'je begint op een zaterdag');
  const s1 = v.doe({ actie: 'overwerk' });
  assert.equal(s1.geld.kas, R.START_KAS + R.BAAN.overwerk.loon);
  const r = v.doe({ actie: 'overwerk' });
  assert.match(r.error, /al een extra dienst/);
  const s2 = v.L.staat('lid');
  assert.equal(s2.geld.kas, s1.geld.kas);
  assert.equal(s2.geld.kas, s2.geld.grootboek);
  assert.ok(!s2.vandaag.volgende.some(x => x.actie === 'overwerk'), 'de Edge biedt hem niet nog eens aan');
});

test('rood staan is geldnood, en kost rente op de eerste van de maand', () => {
  const v = leven();
  v.L.staat('lid');
  v.db.data.magnaatLeven.lid.baan.actief = false;   // geen loon: de maand wordt niet gered
  let s;
  for (let i = 0; i < 11; i++) s = v.dagen();       // dag 31: de eerste van de maand
  assert.equal(s.dagVanMaand, 1);
  assert.ok(s.vandaag.rood);
  assert.ok(s.rtg.some(r => r.id === 'budget'), 'budget verschijnt bij geldnood');
  const st = v.db.data.magnaatLeven.lid;
  assert.ok(st.meldingen.some(m => /rente/.test(m.tekst)), 'de rente is geboekt');
  assert.ok(st.boek.recent.some(g => /Rente/.test(g.omschrijving)), 'en staat in het grootboek');
  assert.ok(s.vandaag.volgende.some(x => x.actie === 'lenen'), 'lenen wordt een keuze');
  assert.equal(s.geld.kas, s.geld.grootboek);
});

test('de routes: kijken en handelen met een ledensessie, en een gast komt er niet in', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vannul-'));
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const post = (pad, body, tok) => fetch(base + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
      body: JSON.stringify(body || {}) });
    assert.equal((await post('/api/member/magnaat/leven/staat')).status, 401);
    const reg = await post('/api/auth/register', { name: 'Nul Speler', email: 'nul@x.nl', phone: '0612345678',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' });
    assert.equal(reg.status, 200);
    const tok = (await reg.json()).token;
    const s = await (await post('/api/member/magnaat/leven/staat', {}, tok)).json();
    assert.equal(s.geld.kas, R.START_KAS);
    const r = await post('/api/member/magnaat/leven/actie', { actie: 'project', aanbod: 'websites' }, tok);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).geld.kas, R.START_KAS - R.AANBOD.websites.softwareKosten);
    const f = await post('/api/member/magnaat/leven/actie', { actie: 'factuur', deal: 'd9' }, tok);
    assert.equal(f.status, 400);
    assert.ok((await f.json()).error);
  } finally {
    try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
