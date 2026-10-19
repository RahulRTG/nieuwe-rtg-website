/* HET LAB-FONDS BEVESTIGT NIET WAT DE OPSLAG NOG NIET HEEFT.

   Het fonds is een toezeggingen-grootboek: een toezegging, een voorstel, een
   stem en een besluit zijn wat het IS. De schrijfproef mat
   /api/labfonds/locatie/maak onder `schrijf-verloren` als VALS_SUCCES -- 200,
   en er stond niets. Sinds 18 oktober 2026 lopen de vijf schrijvers door de
   duurzame bundel (vast() in kern/labfonds.js, gekozen in routes/labfonds.js).

   Wat hier staat, in de vorm van test/notitiesduurzaam.test.js: zonder verraad
   werkt het fonds met een afgewacht antwoord, onder een liegende opslag geeft
   geen schrijver een 2xx, en het overzicht (een lezer) blijft werken.

   Draai los: node --test test/labfondsduurzaam.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const mappen = [];
const verseMap = () => { const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lfd-')); mappen.push(m); return m; };

function api(base, pad, body, token) {
  return fetch(base + '/api/' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(base) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api(base, 'auth/register', { name: 'Labfonds ' + seq, email: 'lfd' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, 'registreren hoort een token te geven: ' + JSON.stringify(reg.body).slice(0, 160));
  return reg.body.token;
}

let eerlijk, leugen;
test.before(async () => {
  eerlijk = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: verseMap() } });
  leugen = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: verseMap(), RTG_VERRAAD: 'schrijf-verloren' } });
});
test.after(() => {
  stop(eerlijk && eerlijk.child);
  stop(leugen && leugen.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

test('1. zonder verraad maakt het lid een locatie en zegt het toe', async () => {
  const tok = await lid(eerlijk.base);
  const l = await api(eerlijk.base, 'labfonds/locatie/maak', { naam: 'Duurzaamdorp', land: 'NL' }, tok);
  assert.equal(l.status, 200);
  /* De await-controle: een niet-afgewachte belofte serialiseert naar `{}`. */
  assert.equal(l.body.ok, true, 'een 200 zonder ok is een niet-afgewachte belofte');
  assert.equal(l.body.locatie.id, 'duurzaamdorp');
  const d = await api(eerlijk.base, 'labfonds/doneer', { locId: 'duurzaamdorp', bedrag: 25 }, tok);
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.equal(d.body.ok, true);
  const o = await api(eerlijk.base, 'labfonds/overzicht', {}, tok);
  const loc = o.body.locaties.find(x => x.id === 'duurzaamdorp');
  assert.ok(loc, 'de nieuwe locatie staat in het overzicht');
});

test('2. onder een liegende opslag geeft geen schrijver een 2xx', async () => {
  const tok = await lid(leugen.base);
  for (const [pad, lijf] of [
    ['labfonds/locatie/maak', { naam: 'Verloren dorp', land: 'NL' }],
    ['labfonds/doneer', { locId: 'ibiza', bedrag: 25 }]
  ]) {
    const r = await api(leugen.base, pad, lijf, tok);
    assert.ok(!(r.status >= 200 && r.status < 300),
      pad + ' gaf ' + r.status + ' terwijl de opslag niets bewaarde -- een vals succes');
    assert.equal(r.status, 503, pad + ': de opslag bevestigde niet, en dat hoort het lid te horen');
  }
});

test('3. het overzicht blijft werken onder een liegende opslag', async () => {
  const tok = await lid(leugen.base);
  const r = await api(leugen.base, 'labfonds/overzicht', {}, tok);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.locaties));
});
