/* Golf 6 van de onderwijs-toren: Rahul kan de hele leerlaag bedienen via het
   stuur (een codepad: dezelfde routes, dezelfde inlog, dezelfde regels).
   "Schrijf me in op groep 3", "overhoor me", "vraag bijles" -- alles loopt
   als interne aanroep met de eigen inlog van het lid, dus de AI kan nooit
   meer dan de persoon zelf. Draai los:
   node --experimental-sqlite --test test/onderwijsstuur.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ondstuur-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const doe = (pad, body) => api('/api/member/doe', { pad, body }, lid);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lid = (await api('/api/auth/register', { name: 'Leerling van Rahul', email: 'ond' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1996-04-04', geslacht: 'm', tier: 'rtg', pasApp: 'rtg' })).body.token;
  assert.ok(lid, 'het lid is ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. Rahul schrijft je in op de ladder en leest je paspoort, met jouw inlog', async () => {
  const inschrijf = await doe('/api/onderwijs/inschrijf', { fase: 'po-g3' });
  assert.equal(inschrijf.status, 200);
  assert.equal(inschrijf.body.ok, true, 'de inschrijving loopt gewoon over de echte route');
  const mijn = await doe('/api/onderwijs/mijn', {});
  assert.equal(mijn.body.antwoord.fase.id, 'po-g3', 'het paspoort is via het stuur terug te lezen');
  assert.match(mijn.body.antwoord.eerlijk, /geen school of examenbureau/i, 'de eerlijkheidstekst reist ook via de AI mee');
});

test('2. een hele oefensessie via het stuur: de antwoorden blijven op de server', async () => {
  const start = await doe('/api/leerstof/oefen', { doel: 'rekenen.g3.optellen-tot-20' });
  assert.equal(start.body.ok, true);
  assert.equal(start.body.antwoord.totaal, 5);
  assert.ok(start.body.antwoord.vraag, 'de vraag komt mee, het antwoord niet');
  assert.equal(start.body.antwoord.a, undefined, 'het juiste antwoord lekt nooit naar de client of de AI');
  // vijf keer bewust fout: de sessie rondt eerlijk af met een advies, geen straf
  let uit = null;
  for (let i = 0; i < 5; i++) uit = (await doe('/api/leerstof/antwoord', { antwoord: 'bewust-fout' })).body.antwoord;
  assert.equal(uit.klaar, true);
  assert.equal(uit.behaald, false);
  assert.match(uit.advies, /oefening/i, 'een fout is gewoon de volgende stap in de les');
});

test('3. bijles en niveau-advies via het stuur, binnen dezelfde remmen', async () => {
  const b = await doe('/api/bijles/vraag', { tekst: 'Leg optellen tot 20 uit.' });
  assert.equal(b.body.ok, true);
  assert.ok(String(b.body.antwoord.text || '').length > 20, 'Rahul Bijles antwoordt (demo of echt)');
  const adv = await doe('/api/onderwijs/advies', {});
  assert.equal(adv.body.ok, true);
  assert.match(String(adv.body.antwoord.advies || ''), /advies|paspoort|praktijk/i, 'het advies blijft een advies');
  // de vaste remmen gelden ook hier: infrastructuur blijft verboden terrein
  const verboden = await doe('/api/auth/login', { login: 'x', password: 'y' });
  assert.ok(verboden.status >= 400 || verboden.body.error, 'accounts en wachtwoorden zijn geen AI-terrein');
});
