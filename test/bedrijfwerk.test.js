/* RTG Werk OS, deel 2: projecten en de kennisbank.

   De beweringen die ertoe doen, en het zijn er zes:

   - VOORTGANG WORDT GETELD, NOOIT INGEVULD. Er is geen veld waarin iemand zijn
     eigen percentage zet, en zonder taken is er geen nul maar geen getal.
   - EEN CIRKEL IN DE AFHANKELIJKHEDEN WORDT GEWEIGERD, ook via een omweg.
   - EEN TAAK GAAT NIET AF zolang hij wacht op iets dat niet af is, en niet
     zolang er subtaken openstaan.
   - EEN BUDGETOVERSCHRIJDING MELDT ZICH, maar blokkeert het werk niet.
   - EEN ARTIKEL VEROUDERT ZICHTBAAR: de stand komt uit de datum en niet uit
     een vinkje, en een nieuwe versie laat de oude leesbaar staan als vervallen.
   - AFSCHERMING GELDT OOK IN DE ZOEKUITSLAG, niet pas bij het openen.
   Draai los: node --experimental-sqlite --test test/bedrijfwerk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bedrijfwerk-'));
const api = (pad, body) => fetch(BASE + '/api/bedrijf' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const dag = (v) => new Date(Date.now() + v * 86400000).toISOString().slice(0, 10);

let W, B, PL, DEV, HR;
async function lid(naam, rollen) {
  const a = (await api('/lid/aanmeld', { werkruimte: W, naam })).body;
  await api('/lid/besluit', { werkruimte: W, beheerToken: B, lidId: a.lidId, akkoord: true });
  await api('/lid/rollen', { werkruimte: W, beheerToken: B, lidId: a.lidId, rollen });
  return { werkruimte: W, lidToken: a.lidToken, id: a.lidId, naam };
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const w = (await api('/werkruimte/maak', { naam: 'RTG Werk', land: 'NL' })).body;
  W = w.werkruimte; B = w.beheerToken;
  PL = await lid('Pia', ['projectleider']);
  DEV = await lid('Daan', ['engineering']);
  HR = await lid('Hanna', ['hr']);
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('voortgang wordt geteld uit taken, niet ingevuld door een mens', async () => {
  const p = (await api('/project/maak', Object.assign({ naam: 'Uitrol Rotterdam', werkvorm: 'stadsuitrol',
    budget: 1000, uurtarief: 90 }, PL))).body.project;

  const leeg = (await api('/project', Object.assign({ projectId: p.id }, PL))).body;
  assert.equal(leeg.voortgang.deel, null, 'zonder taken is er geen percentage');
  assert.match(leeg.voortgang.let, /geen nul procent/i);

  const a = (await api('/taak/maak', Object.assign({ titel: 'Locaties bezoeken', projectId: p.id, wie: 'Pia' }, PL))).body.taak;
  await api('/taak/maak', Object.assign({ titel: 'Contracten tekenen', projectId: p.id, wie: 'Pia' }, PL));
  await api('/taak/kolom', Object.assign({ taakId: a.id, kolom: 'klaar' }, PL));

  const na = (await api('/project', Object.assign({ projectId: p.id }, PL))).body;
  assert.equal(na.voortgang.deel, 50, 'een van de twee taken af is 50%');
  assert.equal(na.voortgang.perKolom.klaar, 1);
  assert.match(na.voortgang.let, /GETELD/);

  const plat = JSON.stringify(na.project);
  assert.ok(!/percentage|voortgangPct|gereedPct/i.test(plat), 'er is geen veld om zelf een percentage in te zetten');

  const raar = await api('/project/maak', Object.assign({ naam: 'Iets', werkvorm: 'ruimtevaart' }, PL));
  assert.equal(raar.status, 400, 'een werkvorm die niet bestaat wordt niet stilletjes algemeen');
});

test('een cirkel in de afhankelijkheden wordt geweigerd, ook via een omweg', async () => {
  const t = [];
  for (const titel of ['Ontwerp', 'Bouw', 'Test']) {
    t.push((await api('/taak/maak', Object.assign({ titel }, DEV))).body.taak);
  }
  assert.equal((await api('/taak/wacht-op', Object.assign({ taakId: t[1].id, wachtOpId: t[0].id }, DEV))).status, 200);
  assert.equal((await api('/taak/wacht-op', Object.assign({ taakId: t[2].id, wachtOpId: t[1].id }, DEV))).status, 200);

  const zelf = await api('/taak/wacht-op', Object.assign({ taakId: t[0].id, wachtOpId: t[0].id }, DEV));
  assert.equal(zelf.status, 400);

  const cirkel = await api('/taak/wacht-op', Object.assign({ taakId: t[0].id, wachtOpId: t[2].id }, DEV));
  assert.equal(cirkel.status, 409, 'Ontwerp laten wachten op Test maakt een cirkel via Bouw');
  assert.match(cirkel.body.error, /cirkel/i);
});

test('een taak gaat niet af zolang hij wacht, en niet met open subtaken', async () => {
  const hoofd = (await api('/taak/maak', Object.assign({ titel: 'Release 1.0' }, DEV))).body.taak;
  const sub = (await api('/taak/maak', Object.assign({ titel: 'Changelog schrijven', ouderId: hoofd.id }, DEV))).body.taak;
  const eerst = (await api('/taak/maak', Object.assign({ titel: 'Beveiligingsscan' }, DEV))).body.taak;
  await api('/taak/wacht-op', Object.assign({ taakId: hoofd.id, wachtOpId: eerst.id }, DEV));

  const tevroeg = await api('/taak/kolom', Object.assign({ taakId: hoofd.id, kolom: 'klaar' }, DEV));
  assert.equal(tevroeg.status, 409);
  assert.match(tevroeg.body.error, /Beveiligingsscan/, 'de weigering noemt waarop hij wacht');

  await api('/taak/kolom', Object.assign({ taakId: eerst.id, kolom: 'klaar' }, DEV));
  const nogSteeds = await api('/taak/kolom', Object.assign({ taakId: hoofd.id, kolom: 'klaar' }, DEV));
  assert.equal(nogSteeds.status, 409, 'de subtaak staat nog open');
  assert.match(nogSteeds.body.error, /subtaak/i);

  await api('/taak/kolom', Object.assign({ taakId: sub.id, kolom: 'klaar' }, DEV));
  const nu = await api('/taak/kolom', Object.assign({ taakId: hoofd.id, kolom: 'klaar' }, DEV));
  assert.equal(nu.status, 200);
  assert.ok(nu.body.taak.klaarAt, 'met een tijdstempel erbij');

  const lijst = (await api('/taken', Object.assign({}, DEV))).body;
  assert.ok(lijst.taken.every(t => !t.geblokkeerd || t.kolom !== 'klaar'));
});

test('een budgetoverschrijding meldt zich, maar zet het werk niet stil', async () => {
  const p = (await api('/project/maak', Object.assign({ naam: 'Klein project', werkvorm: 'algemeen',
    budget: 100, uurtarief: 50 }, PL))).body.project;
  const t = (await api('/taak/maak', Object.assign({ titel: 'Werk', projectId: p.id }, PL))).body.taak;

  const binnen = (await api('/taak/uren', Object.assign({ taakId: t.id, uren: 2 }, PL))).body;
  assert.equal(binnen.project.kostenCenten, 10000, '2 uur x 50,00');
  assert.equal(binnen.project.overBudget, 0);
  assert.equal(binnen.let, null);

  const over = (await api('/taak/uren', Object.assign({ taakId: t.id, uren: 3 }, PL))).body;
  assert.equal(over.taak.uren, 5, 'de uren tellen op en worden niet geweigerd');
  assert.equal(over.project.overBudget, 15000, '5 x 50 = 250 tegen een budget van 100');
  assert.match(over.let, /boven budget/i);
  assert.match(over.let, /niets geblokkeerd/i);
});

test('een artikel veroudert zichtbaar, en een nieuwe versie laat de oude leesbaar staan', async () => {
  const oud = (await api('/kennis/schrijf', Object.assign({ titel: 'Onboarding nieuwe collega',
    tekst: 'Dag 1: laptop, rondleiding, koffie.', soort: 'onboarding', geldigTot: dag(-10) }, HR))).body;
  assert.equal(oud.artikel.stand, 'controle nodig');
  assert.match(oud.artikel.reden, /10 dag\(en\) over de houdbaarheidsdatum/);

  const zonder = (await api('/kennis/schrijf', Object.assign({ titel: 'Beleid thuiswerken',
    tekst: 'Twee dagen per week.', soort: 'beleid' }, HR))).body;
  assert.equal(zonder.artikel.stand, 'geldig');
  assert.match(zonder.let, /eeuwig/i, 'zonder datum zegt het systeem dat er iets ontbreekt');

  const lijst = (await api('/kennis/controlelijst', HR)).body;
  assert.ok(lijst.artikelen.some(a => a.titel === 'Onboarding nieuwe collega'));
  assert.ok(lijst.zonderHoudbaarheid.some(a => a.titel === 'Beleid thuiswerken'));
  assert.match(lijst.let, /niet automatisch weggegooid/i);

  // nagekeken verschuift de houdbaarheid, met een naam eronder
  const na = (await api('/kennis/nagekeken', Object.assign({ artikelId: oud.artikel.id, geldigTot: dag(200) }, HR))).body;
  assert.equal(na.artikel.stand, 'geldig');
  assert.equal(na.artikel.laatstGecontroleerd, dag(0));

  // een nieuwe versie: de oude blijft leesbaar maar is vervallen
  const nieuw = (await api('/kennis/schrijf', Object.assign({ titel: 'Onboarding nieuwe collega',
    tekst: 'Dag 1: laptop, rondleiding, koffie, en de rondgang langs de teams.',
    soort: 'onboarding', vervangtId: oud.artikel.id, geldigTot: dag(365) }, HR))).body;
  assert.equal(nieuw.artikel.versie, 2);

  const oudNu = (await api('/kennis/lees', Object.assign({ artikelId: oud.artikel.id }, HR))).body;
  assert.equal(oudNu.artikel.stand, 'vervallen');
  assert.match(oudNu.let, /oude versie/i);

  const zoek = (await api('/kennis/zoek', Object.assign({ q: 'onboarding' }, HR))).body;
  assert.equal(zoek.artikelen.filter(a => a.titel === 'Onboarding nieuwe collega').length, 1,
    'een zoekvraag geeft de geldige versie, niet allebei');
  assert.equal(zoek.artikelen.find(a => a.titel === 'Onboarding nieuwe collega').versie, 2);

  const metOud = (await api('/kennis/zoek', Object.assign({ q: 'onboarding', ookVervallen: true }, HR))).body;
  assert.equal(metOud.artikelen.length, 2, 'wie een oud besluit reconstrueert, kan er expliciet om vragen');

  const opnieuw = await api('/kennis/schrijf', Object.assign({ titel: 'x', tekst: 'y',
    soort: 'onboarding', vervangtId: oud.artikel.id }, HR));
  assert.equal(opnieuw.status, 409, 'een vervallen versie kun je niet nog eens opvolgen');
});

test('afscherming geldt ook in de zoekuitslag, niet pas bij het openen', async () => {
  const geheim = (await api('/kennis/schrijf', Object.assign({ titel: 'Salarishuis 2026',
    tekst: 'Schalen en bandbreedtes.', soort: 'beleid', recht: 'mens.gevoelig' }, HR))).body;
  assert.equal(geheim.artikel.recht, 'mens.gevoelig');

  const vanHr = (await api('/kennis/zoek', Object.assign({ q: 'salarishuis' }, HR))).body;
  assert.equal(vanHr.aantal, 1, 'HR ziet hem wel');

  const vanDev = (await api('/kennis/zoek', Object.assign({ q: 'salarishuis' }, DEV))).body;
  assert.equal(vanDev.aantal, 0, 'een programmeur ziet de titel niet eens');
  assert.ok(vanDev.verborgen >= 1, 'maar hij hoort wel dat er iets is dat hij niet mag zien');

  const open = await api('/kennis/lees', Object.assign({ artikelId: geheim.artikel.id }, DEV));
  assert.equal(open.status, 403, 'en openen kan ook niet');

  const raar = await api('/kennis/schrijf', Object.assign({ titel: 'a', tekst: 'b', recht: 'toverstaf' }, HR));
  assert.equal(raar.status, 400, 'afschermen met een recht dat niet bestaat, schermt niets af');
});
