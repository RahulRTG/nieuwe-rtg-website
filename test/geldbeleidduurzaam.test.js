/* HET GELDBELEID BEVESTIGT NIET WAT DE OPSLAG NOG NIET HEEFT.

   De schrijfproef (scripts/schrijfproef.js, verraad `schrijf-verloren`) mat
   /api/geld/beleid/weg als VALS_SUCCES: 200 terwijl er niets was bewaard. Elke
   schrijver van kern/geldbeleid deed write-behind `save()`. Het duurst is de
   geldgrens: die WEIGERT in de waardepoort, dus een grens die het lid "gezet"
   leest en die na een herstart weg is, laat precies de betaling door die hij
   wilde tegenhouden. Sinds 18 oktober 2026 lopen de schrijvers door de duurzame
   bundel (vast() in kern/geldbeleid/index.js); deze toets houdt dat vast.

   WAT HIER WORDT BEWEERD, in dezelfde vorm als test/notitiesduurzaam.test.js:
     - zonder verraad werkt het beleid gewoon, met een echt afgewacht antwoord;
     - onder een liegende opslag geeft geen enkele SCHRIJVER een 2xx;
     - een weigering van de schrijver zelf blijft zijn eigen weigering (een 404
       wordt geen 503, want er viel niets vast te leggen);
     - de LEZER blijft werken: een lijst opvragen hoeft niet op de schijf te wachten.

   Draai los: node --test test/geldbeleidduurzaam.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const mappen = [];
const verseMap = () => { const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gbd-')); mappen.push(m); return m; };

function api(base, pad, body, token) {
  return fetch(base + '/api/' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(base) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api(base, 'auth/register', { name: 'Geldbeleid ' + seq, email: 'gbd' + u + '@x.nl',
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

test('1. zonder verraad zetten en weghalen het lid zijn grens en regel gewoon', async () => {
  const tok = await lid(eerlijk.base);
  const g = await api(eerlijk.base, 'geld/grens/zet', { periode: 'maand', centen: 50000 }, tok);
  assert.equal(g.status, 200);
  /* De await-controle: een vergeten `await` in doeVast stuurt een Promise, en
     die serialiseert naar `{}` met een keurige 200. */
  assert.equal(g.body.ok, true, 'een 200 zonder ok is een niet-afgewachte belofte');
  assert.match(String(g.body.grens && g.body.grens.id), /^gr-/);
  const lijst = await api(eerlijk.base, 'geld/grens', {}, tok);
  assert.equal(lijst.body.grenzen.length, 1);
  assert.equal(lijst.body.grenzen[0].centen, 50000);

  const r = await api(eerlijk.base, 'geld/beleid/zet', { soort: 'minimumbuffer', drempelCenten: 10000 }, tok);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  const id = (r.body.regel && r.body.regel.id) || null;
  assert.ok(id, 'de regel hoort zijn id terug te geven');
  const weg = await api(eerlijk.base, 'geld/beleid/weg', { id }, tok);
  assert.equal(weg.status, 200);
  assert.equal(weg.body.ok, true);
  const nu = await api(eerlijk.base, 'geld/beleid', {}, tok);
  assert.equal(nu.body.regels.length, 0, 'na weghalen is de regel ook echt weg');
});

test('2. onder een liegende opslag geeft geen schrijver een 2xx', async () => {
  const tok = await lid(leugen.base);
  for (const [pad, lijf] of [
    ['geld/grens/zet', { periode: 'maand', centen: 50000 }],
    ['geld/beleid/zet', { soort: 'minimumbuffer', drempelCenten: 10000 }],
    ['geld/pot/zet', { naam: 'Vakantie', doelCenten: 100000 }]
  ]) {
    const r = await api(leugen.base, pad, lijf, tok);
    assert.ok(!(r.status >= 200 && r.status < 300),
      pad + ' gaf ' + r.status + ' terwijl de opslag niets bewaarde -- een vals succes');
    assert.equal(r.status, 503, pad + ': de opslag bevestigde niet, en dat hoort het lid te horen');
  }
});

test('3. een weigering van de schrijver blijft zijn eigen weigering', async () => {
  /* Er viel niets vast te leggen: een onbekende regel weghalen is een 404, ook
     als de opslag liegt. Zou hier 503 staan, dan stuurt het scherm het lid naar
     "probeer het zo nog eens" voor iets wat nooit gaat lukken. */
  const tok = await lid(leugen.base);
  const r = await api(leugen.base, 'geld/beleid/weg', { id: 'bestaat-niet' }, tok);
  assert.equal(r.status, 404);
});

test('4. de lezer blijft werken onder een liegende opslag', async () => {
  const tok = await lid(leugen.base);
  const r = await api(leugen.base, 'geld/grens', {}, tok);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.grenzen, []);
});
