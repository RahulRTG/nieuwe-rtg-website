/* DE TERUGSTORTSTAND -- de knop die niet regelt wat RTG doet maar wat RTG IS.

   WAAROM DEZE TOETS ER IS

   RTG wil twee juridische posities kunnen innemen, en dat is een legitieme
   bedrijfskeuze:

     gesloten  saldo blijft binnen RTG. Een gesloten circuit met plafonds; RTG
               rekent dat tot een beperkt netwerk en houdt geen vergunning aan.
     open      leden krijgen hun saldo terug. Dan is dat saldo tegen de nominale
               waarde inwisselbaar voor de houder, en dat IS elektronisch geld.

   Het gevaar zit niet in de keuze maar in de ONTKOPPELING: een knop die de
   belofte aan leden omzet zonder dat de bevoegdheidsvraag meebeweegt, is een
   manier om om de vergunningplicht heen te komen. Dan bestaat er een stand
   waarin de code iets anders doet dan het document zegt -- precies de fout die
   dit hele traject heeft blootgelegd.

   WAT HIER WORDT NAGETROKKEN

   1. DE STAND VERANDERT DE SOORT VAN HET VERMOGEN. In `gesloten` is
      WALLET_SALDO een besluit met een grond; in `open` een rail die over de
      eigen rails een e-geldvergunning vraagt.
   2. IN `gesloten` KAN EEN LID NIET TERUGSTORTEN, en het antwoord zegt dat het
      een keuze is en geen storing.
   3. IN `open` KAN HET WEER, zonder dat er iets anders is aangeraakt.
   4. HET OMZETTEN IS BOARDROOMWERK. Een medewerker kan een partnerrail
      uitzetten -- bedrijfsvoering; de juridische positie van het huis verleggen
      hoort daar niet bij.
   5. DE WALLET BLIJFT IN BEIDE STANDEN GEWOON WERKEN.

   Draai los: node --experimental-sqlite --test test/terugstortstand.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-stand-'));
const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const zet = (stand) => api('office/bank/terugstorting', { stand }, office);
const matrix = () => api('office/bank/bevoegdheid', {}, office).then(r => r.body);
const regel = (m, id) => m.regels.find(x => x.id === id);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const d = (await api('auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body;
  lid = { token: d.token, codenaam: (await api('pay/overzicht', {}, d.token)).body.codenaam };
  office = d.token;      // de eigenaar opent ook de boardroom
  assert.ok(lid.codenaam, 'een echt, geverifieerd account met een wallet');
  await api('pay/oplaad', { centen: 20000, idem: 'st-1' }, lid.token);
  const r = await api('pay/rekening', { iban: 'NL91ABNA0417164300', naam: 'A. Vos' }, lid.token);
  assert.equal(r.status, 200, 'met een uitbetaalrekening die meteen bruikbaar is');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('standaard staat hij open, en dan kan een lid terugstorten', async () => {
  const m = await matrix();
  assert.equal(m.terugstorting, 'open', 'dat is wat er is besloten');
  assert.equal(regel(m, 'WALLET_SALDO').soort, 'rail');
  assert.equal(regel(m, 'LID_UITBETALING').mag, true);

  const s = await api('pay/terugstand', {}, lid.token);
  assert.equal(s.body.kan, true);
  const r = await api('pay/terug', { centen: 1000, idem: 'st-open' }, lid.token);
  assert.equal(r.status, 200, 'en het lukt ook echt');
});

test('op gesloten wisselt het vermogen van soort -- van rail naar besluit', async () => {
  const g = await zet('gesloten');
  assert.equal(g.status, 200);
  assert.match(g.body.uitleg, /beperkt netwerk/, 'het antwoord zegt wat de stand juridisch betekent');

  const m = await matrix();
  assert.equal(m.terugstorting, 'gesloten');
  const w = regel(m, 'WALLET_SALDO');
  assert.equal(w.soort, 'besluit', 'geen vergunning nodig: een gesloten circuit is een beperkt netwerk');
  assert.equal(w.mag, true);
  assert.match(w.besluit, /beperkt netwerk/, 'met de grond erbij, zodat iemand hem kan tegenspreken');
  assert.equal(w.hangtAf, 'terugstorting', 'en met waar die soort vanaf hangt');
});

test('in gesloten kan een lid niet terugstorten, en het is een keuze en geen storing', async () => {
  const s = await api('pay/terugstand', {}, lid.token);
  assert.equal(s.body.kan, false);
  const b = s.body.blokkades.find(x => x.wat === 'stand');
  assert.ok(b, 'de blokkade heet "stand" en niet "bevoegdheid"');
  assert.match(b.uitleg, /niet terug aan leden/, 'en zegt in gewone taal wat er aan de hand is');

  /* De functieschakelaar vangt hem als eerste, met dezelfde 503 als elke andere
     bevoegdheidsweigering in dit huis (test/bank.test.js legt die vorm vast voor
     de partneruitbetaling). Wat hier telt is dat de REDEN doorkomt: `stand` en
     niet "geen vergunning", want daar zou een lid op gaan wachten. */
  const r = await api('pay/terug', { centen: 1000, idem: 'st-dicht' }, lid.token);
  assert.equal(r.status, 503);
  assert.equal(r.body.bevoegdheidReden, 'stand');
  assert.equal(r.body.vermogen, 'LID_UITBETALING');
  assert.match(r.body.error, /niet terug aan leden/, 'en het lid leest de echte reden, niet een code');
});

test('de wallet blijft in beide standen gewoon werken', async () => {
  /* Een dichte uitbetaalrail is geen dichte wallet. Betalen binnen RTG heeft er
     niets mee te maken, en zou het wel meevallen, dan is de schakelaar een
     noodstop geworden in plaats van een positiekeuze. */
  assert.equal((await api('pay/overzicht', {}, lid.token)).status, 200);
  assert.equal((await api('pay/oplaad', { centen: 500, idem: 'st-2' }, lid.token)).status, 200);
  const g = await fetch(base + '/api/pay/gezond');
  assert.equal((await g.json()).klopt, true, 'en het grootboek sluit');
});

test('terug op open en het kan weer, zonder dat er iets anders is aangeraakt', async () => {
  assert.equal((await zet('open')).status, 200);
  const m = await matrix();
  assert.equal(regel(m, 'WALLET_SALDO').soort, 'rail', 'weer elektronisch geld');
  assert.equal(regel(m, 'WALLET_SALDO').nodig, 'elektronischgeldinstelling',
    'met de zwaardere eis over de eigen rails');
  const r = await api('pay/terug', { centen: 1000, idem: 'st-open2' }, lid.token);
  assert.equal(r.status, 200);
});

test('een onzinnige stand wordt geweigerd', async () => {
  assert.equal((await zet('misschien')).status, 400);
  assert.equal((await zet('')).status, 400);
  assert.equal((await matrix()).terugstorting, 'open', 'en de stand is niet veranderd');
});
