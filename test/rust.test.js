/* Versleuteling in rust, gemeten in plaats van beloofd.

   De belofte is: met RTG_ENC_KEY staat er niets leesbaars van een lid op schijf.
   Deze test gelooft die belofte niet. Hij start een echte server met een sleutel,
   zet er herkenbare "naalden" in via de gewone endpoints (registreren, praten met
   Rahul, een identiteitsbewijs uploaden), stopt de server en doorzoekt daarna de
   HELE datamap byte voor byte op die naalden.

   Zo vond deze test twee dingen die er echt in zaten: het ledendossier
   (users.member_state: gesprekken, boekingen, geboortedatum) stond als platte
   JSON naast de versleutelde naam, en de outbox schreef e-mailadres plus een
   werkende bevestigingslink onversleuteld weg. Een test die alleen naar de
   kluis-functies kijkt had allebei gemist, want de crypto zelf was in orde --
   hij werd op die plekken alleen niet gebruikt.

   Draai los: node --experimental-sqlite --test test/rust.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const SLEUTEL = 'a'.repeat(64);
const u = Date.now().toString().slice(-8);

/* De naalden. Elk stuk tekst is uniek genoeg om per ongeluk nergens anders voor
   te komen, en elk hoort bij een andere laag van de opslag. */
const NAALD = {
  naam: 'Zoekmijniet Vandenberg',
  email: 'naald' + u + '@geheim.invalid',
  telefoon: '06123' + u.slice(0, 5),
  gesprek: 'NAALD-GESPREK-XKCD-9911',
  document: 'NAALD-PASPOORT-BYTES-7788'
};

function api(base, pad, body, opt) {
  opt = opt || {};
  const h = { 'Content-Type': 'application/json' };
  if (opt.token) h.Authorization = 'Bearer ' + opt.token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

function alleBestanden(dir, uit) {
  uit = uit || [];
  let namen = [];
  try { namen = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return uit; }
  for (const d of namen) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) alleBestanden(p, uit); else uit.push(p);
  }
  return uit;
}

let TMP, bestanden = [], token, base;

test.before(async () => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rust-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: SLEUTEL } });
  base = srv.base;

  const reg = await api(base, '/api/auth/register', {
    name: NAALD.naam, email: NAALD.email, phone: NAALD.telefoon, password: 'NaaldWachtwoord!42',
    geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
  });
  assert.equal(reg.status, 200, 'het lid moet er echt in kunnen');
  token = reg.body.token;

  // een gesprek: dit belandt in het ledendossier (users.member_state)
  const chat = await api(base, '/api/chat/send', { text: NAALD.gesprek, message: NAALD.gesprek }, { token });
  assert.equal(chat.status, 200);

  // een identiteitsbewijs: dit belandt als bestand op schijf
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(NAALD.document), Buffer.alloc(64)
  ]);
  const up = await api(base, '/api/verify/upload',
    { image: 'data:image/png;base64,' + png.toString('base64') }, { token });
  assert.equal(up.status, 200, 'het identiteitsbewijs moet opgeslagen zijn');

  await new Promise(r => setTimeout(r, 2500)); // de opslaglus zijn werk laten doen
  stop(srv.child);
  await new Promise(r => setTimeout(r, 800)); // en netjes laten afsluiten
  bestanden = alleBestanden(TMP);
});

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. er staat ook echt iets op schijf (anders bewijst de rest niets)', () => {
  assert.ok(bestanden.length > 5, 'verwacht een gevulde datamap, kreeg ' + bestanden.length + ' bestand(en)');
  const totaal = bestanden.reduce((n, f) => n + fs.statSync(f).size, 0);
  assert.ok(totaal > 50000, 'verwacht echte data, kreeg ' + totaal + ' bytes');
});

for (const [wat, naald] of Object.entries(NAALD)) {
  test('2. ' + wat + ' is nergens leesbaar in de datamap', () => {
    const buf = Buffer.from(naald);
    const lekt = bestanden.filter(f => fs.readFileSync(f).includes(buf)).map(f => path.relative(TMP, f));
    assert.deepEqual(lekt, [], wat + ' staat als platte tekst in: ' + lekt.join(', '));
  });
}

test('3. het ledendossier gaat versleuteld de accountdatabase in', async () => {
  // Niet alleen "de naald is weg", maar ook: de kolom draagt de kluis-markering.
  // Zonder die controle zou een lege of stukke member_state ook slagen.
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(TMP, 'rtg.db'));
  const rijen = db.prepare('SELECT member_state FROM users WHERE member_state IS NOT NULL').all();
  db.close();
  assert.ok(rijen.length, 'er hoort minstens een ledendossier te zijn');
  for (const r of rijen) {
    assert.ok(String(r.member_state).startsWith('RTGV1:'),
      'ledendossier zonder kluis-markering: ' + String(r.member_state).slice(0, 40));
  }
});

test('4. de outbox houdt het e-mailadres en de link binnen de kluis', () => {
  const uit = alleBestanden(path.join(TMP, 'outbox'));
  assert.ok(uit.length, 'zonder SMTP hoort de bevestigingsmail in de outbox te liggen');
  for (const f of uit) {
    assert.ok(f.endsWith('.eml.enc'), 'met een sleutel hoort de outbox versleuteld te zijn: ' + path.basename(f));
    assert.ok(fs.readFileSync(f, 'utf8').startsWith('RTGENC1:'), 'geen kluis-markering in ' + path.basename(f));
  }
});

test('5. en de server leest zijn eigen versleutelde dossier gewoon terug', async () => {
  // De keerzijde van versleutelen: het moet ook nog werken. Een verse server op
  // dezelfde datamap en dezelfde sleutel hoort het gesprek terug te geven.
  const srv2 = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: SLEUTEL } });
  try {
    const li = await api(srv2.base, '/api/auth/login', { login: NAALD.email, wachtwoord: 'NaaldWachtwoord!42', password: 'NaaldWachtwoord!42' });
    assert.equal(li.status, 200, 'het lid moet weer in kunnen loggen');
    const h = await api(srv2.base, '/api/chat/history', {}, { token: li.body.token });
    assert.equal(h.status, 200);
    const tekst = JSON.stringify(h.body);
    assert.ok(tekst.includes(NAALD.gesprek), 'het gesprek hoort gewoon terug te komen');
  } finally { stop(srv2.child); }
});

test('6. een bestaand, nog PLAT dossier blijft leesbaar en migreert bij het opslaan', async () => {
  /* Dit is de reden dat de kluis-markering bestaat. Wie vandaag draait heeft
     duizenden platte dossiers in de kolom staan. Zou de nieuwe code die als
     versleuteld behandelen, dan verloor elk bestaand lid in een keer zijn hele
     dossier. Dus: plat gaat er ongewijzigd uit, en de eerstvolgende schrijfactie
     zet het om. */
  const { DatabaseSync } = require('node:sqlite');
  const OUD = 'OUD-PLAT-DOSSIER-4242';
  const db = new DatabaseSync(path.join(TMP, 'rtg.db'));
  /* De hoogste id is ons net geregistreerde lid; de lagere zijn geseede
     demo-persona's, die ook een dossier hebben. Op de eerste rij pakken zou
     dus de verkeerde treffen (en dat deed het ook, de eerste keer). */
  const rij = db.prepare('SELECT id, member_state FROM users WHERE member_state IS NOT NULL ORDER BY id DESC').get();
  const dossier = { conversation: [{ from: 'member', text: OUD, at: new Date().toISOString() }] };
  db.prepare('UPDATE users SET member_state = ? WHERE id = ?').run(JSON.stringify(dossier), rij.id);
  db.close();

  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: SLEUTEL } });
  try {
    const li = await api(srv.base, '/api/auth/login', { login: NAALD.email, wachtwoord: 'NaaldWachtwoord!42', password: 'NaaldWachtwoord!42' });
    assert.equal(li.status, 200);
    const h = await api(srv.base, '/api/chat/history', {}, { token: li.body.token });
    assert.ok(JSON.stringify(h.body).includes(OUD), 'het oude platte dossier hoort gewoon gelezen te worden');
    // nu iets nieuws sturen: dat schrijft het dossier, en dus versleutelt het
    const nieuw = await api(srv.base, '/api/chat/send', { text: 'nog een bericht', message: 'nog een bericht' }, { token: li.body.token });
    assert.equal(nieuw.status, 200);
  } finally { stop(srv.child); await new Promise(r => setTimeout(r, 500)); }

  const db2 = new DatabaseSync(path.join(TMP, 'rtg.db'));
  const na = db2.prepare('SELECT member_state FROM users WHERE id = ?').get(rij.id);
  db2.close();
  assert.ok(String(na.member_state).startsWith('RTGV1:'), 'na het opslaan hoort het dossier versleuteld te zijn');
  assert.ok(!String(na.member_state).includes(OUD), 'en de oude tekst hoort er niet meer leesbaar in te staan');
});
