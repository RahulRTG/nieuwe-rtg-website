/* Genootschap (kern/genootschap/*, routes/member/genootschap.js): besloten
   groepen van leden, met prikbord en bijeenkomsten.

   De toetsen leggen vooral de grenzen vast die dit anders maken dan een groep
   op een gewoon netwerk: geheim is echt geheim, een uitnodiging is geen
   lidmaatschap, de laatste beheerder kan niet zomaar weglopen, en een volle
   bijeenkomst is vol.
   Draai los: node --experimental-sqlite --test test/genootschap.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-genoot-'));
const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
async function lid() {
  const t = Date.now() + '' + (teller++);
  const r = await json(await raw('/auth/register', { name: 'Lid ' + t, email: 'g' + t + '@v.test',
    phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-06-06', tier: 'rtg' }));
  const p = await json(await raw('/metier/ik', {}, r.token));
  return { token: r.token, codenaam: p.profiel.codenaam };
}
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

test('een genootschap oprichten maakt je meteen beheerder', async () => {
  const a = await lid();
  const g = await json(await raw('/genootschap/richt-op', { naam: 'Het Zeilgezelschap', soort: 'besloten',
    over: 'Wij varen, en daarna eten wij.', regels: 'Wie te laat is, kookt.' }, a.token));
  assert.ok(g.ok, g.error);
  assert.equal(g.groep.mijnRol, 'beheerder');
  assert.equal(g.groep.leden, 1);
  const mijn = await json(await raw('/genootschap/mijn', {}, a.token));
  assert.equal(mijn.groepen.length, 1);
  assert.equal(mijn.groepen[0].naam, 'Het Zeilgezelschap');

  const leeg = await json(await raw('/genootschap/richt-op', { naam: '  ' }, a.token));
  assert.ok(leeg.error, 'een genootschap zonder naam kan niet');
});

test('geheim is echt geheim: het staat in geen enkele lijst', async () => {
  const a = await lid(), b = await lid();
  const open = await json(await raw('/genootschap/richt-op', { naam: 'Open Tafel', soort: 'openbaar' }, a.token));
  const besloten = await json(await raw('/genootschap/richt-op', { naam: 'Besloten Tafel', soort: 'besloten' }, a.token));
  const geheim = await json(await raw('/genootschap/richt-op', { naam: 'De Stille Kamer', soort: 'geheim' }, a.token));

  const z = await json(await raw('/genootschap/zoek', { zoek: 'tafel' }, b.token));
  assert.ok(z.groepen.some(g => g.id === open.groep.id), 'openbaar is te vinden');
  assert.ok(z.groepen.some(g => g.id === besloten.groep.id), 'besloten is te vinden (dat het bestaat)');

  const alles = await json(await raw('/genootschap/zoek', {}, b.token));
  assert.equal(alles.groepen.some(g => g.id === geheim.groep.id), false, 'geheim komt in geen enkele lijst');

  // en zonder uitnodiging kom je er ook niet in
  const poging = await json(await raw('/genootschap/binnen', { groep: geheim.groep.id }, b.token));
  assert.ok(poging.error, 'een geheim genootschap is op uitnodiging');
});

test('openbaar kun je binnenlopen, besloten is op uitnodiging', async () => {
  const a = await lid(), b = await lid();
  const open = await json(await raw('/genootschap/richt-op', { naam: 'De Wandelclub', soort: 'openbaar' }, a.token));
  const dicht = await json(await raw('/genootschap/richt-op', { naam: 'De Leeskring', soort: 'besloten' }, a.token));

  const in1 = await json(await raw('/genootschap/binnen', { groep: open.groep.id }, b.token));
  assert.ok(in1.ok, in1.error);
  assert.equal(in1.groep.mijnRol, 'lid');

  const in2 = await json(await raw('/genootschap/binnen', { groep: dicht.groep.id }, b.token));
  assert.ok(in2.error, 'besloten laat je niet zomaar binnen');

  // een uitnodiging is nog geen lidmaatschap: B zegt zelf ja
  const uit = await json(await raw('/genootschap/nodig-uit', { groep: dicht.groep.id, wie: b.codenaam }, a.token));
  assert.ok(uit.ok, uit.error);
  const lijstB = await json(await raw('/genootschap/mijn', {}, b.token));
  assert.ok(lijstB.uitnodigingen.some(g => g.id === dicht.groep.id), 'de uitnodiging ligt klaar');
  assert.equal(lijstB.groepen.some(g => g.id === dicht.groep.id), false, 'maar hij is nog geen lid');
  const in3 = await json(await raw('/genootschap/binnen', { groep: dicht.groep.id }, b.token));
  assert.ok(in3.ok, in3.error);
});

test('de laatste beheerder kan niet weglopen en de groep verweesd achterlaten', async () => {
  const a = await lid(), b = await lid();
  const g = await json(await raw('/genootschap/richt-op', { naam: 'Het Dinergezelschap', soort: 'openbaar' }, a.token));
  await raw('/genootschap/binnen', { groep: g.groep.id }, b.token);

  const weg = await json(await raw('/genootschap/vertrek', { groep: g.groep.id }, a.token));
  assert.ok(weg.error, 'de enige beheerder kan er niet uit lopen');

  const rol = await json(await raw('/genootschap/rol', { groep: g.groep.id, wie: b.codenaam, rol: 'beheerder' }, a.token));
  assert.ok(rol.ok, rol.error);
  const weg2 = await json(await raw('/genootschap/vertrek', { groep: g.groep.id }, a.token));
  assert.ok(weg2.ok, weg2.error);

  // en de laatste die vertrekt, ruimt het genootschap op
  const weg3 = await json(await raw('/genootschap/vertrek', { groep: g.groep.id }, b.token));
  assert.ok(weg3.ok, weg3.error);
  const na = await json(await raw('/genootschap/zoek', { zoek: 'Dinergezelschap' }, b.token));
  assert.equal(na.groepen.length, 0, 'een leeg genootschap blijft niet achter');
});

test('het prikbord: plaatsen, reageren, en alleen leden komen erbij', async () => {
  const a = await lid(), b = await lid(), c = await lid();
  const g = await json(await raw('/genootschap/richt-op', { naam: 'De Kookclub', soort: 'openbaar' }, a.token));
  await raw('/genootschap/binnen', { groep: g.groep.id }, b.token);

  const vreemd = await json(await raw('/genootschap/prikbord', { groep: g.groep.id }, c.token));
  assert.ok(vreemd.error, 'wie geen lid is, leest het prikbord niet');

  const p = await json(await raw('/genootschap/prik', { groep: g.groep.id, tekst: 'Zondag koken we Italiaans.' }, a.token));
  assert.ok(p.ok, p.error);
  const r = await json(await raw('/genootschap/reageer', { groep: g.groep.id, id: p.bericht.id, tekst: 'Ik neem de wijn mee.' }, b.token));
  assert.ok(r.ok, r.error);

  const bord = await json(await raw('/genootschap/prikbord', { groep: g.groep.id }, b.token));
  assert.equal(bord.berichten.length, 1);
  assert.equal(bord.berichten[0].reacties.length, 1);
  assert.equal(bord.berichten[0].van, a.codenaam, 'de schrijver staat er met zijn codenaam');

  // de beheerder mag opruimen, een gewoon lid alleen zijn eigen bericht
  const magNiet = await json(await raw('/genootschap/prik-weg', { groep: g.groep.id, id: p.bericht.id }, b.token));
  assert.ok(magNiet.error, 'B is geen beheerder en het is niet zijn bericht');
  const mag = await json(await raw('/genootschap/prik-weg', { groep: g.groep.id, id: p.bericht.id }, a.token));
  assert.ok(mag.ok, mag.error);
});

test('een peiling: een stem per lid, en je mag hem verzetten', async () => {
  const a = await lid(), b = await lid();
  const g = await json(await raw('/genootschap/richt-op', { naam: 'De Filmclub', soort: 'openbaar' }, a.token));
  await raw('/genootschap/binnen', { groep: g.groep.id }, b.token);

  const een = await json(await raw('/genootschap/prik', { groep: g.groep.id, tekst: 'Welke avond?', keuzes: ['Vrijdag'] }, a.token));
  assert.ok(een.error, 'een peiling met een keuze is geen peiling');

  const p = await json(await raw('/genootschap/prik', { groep: g.groep.id, tekst: 'Welke avond?', keuzes: ['Vrijdag', 'Zaterdag'] }, a.token));
  assert.ok(p.ok, p.error);
  assert.equal(p.bericht.peiling.totaal, 0);

  const s1 = await json(await raw('/genootschap/stem', { groep: g.groep.id, id: p.bericht.id, keuze: 0 }, b.token));
  assert.equal(s1.uitslag.totaal, 1);
  assert.equal(s1.uitslag.keuzes[0].aantal, 1);
  const s2 = await json(await raw('/genootschap/stem', { groep: g.groep.id, id: p.bericht.id, keuze: 1 }, b.token));
  assert.equal(s2.uitslag.totaal, 1, 'een stem per lid, ook na verzetten');
  assert.equal(s2.uitslag.keuzes[0].aantal, 0);
  assert.equal(s2.uitslag.keuzes[1].aantal, 1);

  const raar = await json(await raw('/genootschap/stem', { groep: g.groep.id, id: p.bericht.id, keuze: 9 }, b.token));
  assert.ok(raar.error, 'een keuze die niet bestaat, bestaat niet');
});

test('een bijeenkomst: ja, misschien en nee, en vol is vol', async () => {
  const a = await lid(), b = await lid(), c = await lid();
  const g = await json(await raw('/genootschap/richt-op', { naam: 'Het Proefgezelschap', soort: 'openbaar' }, a.token));
  for (const w of [b, c]) await raw('/genootschap/binnen', { groep: g.groep.id }, w.token);

  const fout = await json(await raw('/genootschap/roep-bijeen', { groep: g.groep.id, wat: 'Proeverij', datum: '14 augustus' }, a.token));
  assert.ok(fout.error, 'een datum moet een datum zijn');

  const bij = await json(await raw('/genootschap/roep-bijeen', { groep: g.groep.id, wat: 'Proeverij',
    waar: 'Bij mij thuis', datum: morgen(), tijd: '20:00', plaatsen: 2 }, a.token));
  assert.ok(bij.ok, bij.error);
  assert.equal(bij.bijeenkomst.plaatsen, 2);

  const j1 = await json(await raw('/genootschap/antwoord', { groep: g.groep.id, id: bij.bijeenkomst.id, antwoord: 'ja' }, a.token));
  assert.equal(j1.bijeenkomst.ja, 1);
  const j2 = await json(await raw('/genootschap/antwoord', { groep: g.groep.id, id: bij.bijeenkomst.id, antwoord: 'ja' }, b.token));
  assert.equal(j2.bijeenkomst.ja, 2);
  assert.equal(j2.bijeenkomst.vol, true);

  const vol = await json(await raw('/genootschap/antwoord', { groep: g.groep.id, id: bij.bijeenkomst.id, antwoord: 'ja' }, c.token));
  assert.ok(vol.error, 'vol is vol, en er komt geen wachtlijst met valse hoop');

  // misschien blijft misschien
  const m = await json(await raw('/genootschap/antwoord', { groep: g.groep.id, id: bij.bijeenkomst.id, antwoord: 'misschien' }, c.token));
  assert.equal(m.bijeenkomst.misschien, 1);
  assert.equal(m.bijeenkomst.mijnAntwoord, 'misschien');

  // wie afzegt maakt een plaats vrij
  await raw('/genootschap/antwoord', { groep: g.groep.id, id: bij.bijeenkomst.id, antwoord: 'nee' }, b.token);
  const nu = await json(await raw('/genootschap/antwoord', { groep: g.groep.id, id: bij.bijeenkomst.id, antwoord: 'ja' }, c.token));
  assert.ok(nu.ok, nu.error);
});

test('afgelasten kan alleen door de gastheer of een beheerder', async () => {
  const a = await lid(), b = await lid();
  const g = await json(await raw('/genootschap/richt-op', { naam: 'De Zondagclub', soort: 'openbaar' }, a.token));
  await raw('/genootschap/binnen', { groep: g.groep.id }, b.token);
  const bij = await json(await raw('/genootschap/roep-bijeen', { groep: g.groep.id, wat: 'Wandeling', datum: morgen() }, b.token));

  const derde = await lid();
  const geen = await json(await raw('/genootschap/afgelast', { groep: g.groep.id, id: bij.bijeenkomst.id }, derde.token));
  assert.ok(geen.error, 'wie geen lid is, last niets af');

  const wel = await json(await raw('/genootschap/afgelast', { groep: g.groep.id, id: bij.bijeenkomst.id, reden: 'Storm' }, a.token));
  assert.ok(wel.ok, 'de beheerder mag afgelasten');
  assert.ok(wel.bijeenkomst.afgelast);

  const na = await json(await raw('/genootschap/antwoord', { groep: g.groep.id, id: bij.bijeenkomst.id, antwoord: 'ja' }, b.token));
  assert.ok(na.error, 'op een afgelaste bijeenkomst antwoord je niet meer');
});

test('mijn agenda bundelt de bijeenkomsten uit al mijn genootschappen', async () => {
  const a = await lid();
  const g1 = await json(await raw('/genootschap/richt-op', { naam: 'Club Een', soort: 'besloten' }, a.token));
  const g2 = await json(await raw('/genootschap/richt-op', { naam: 'Club Twee', soort: 'besloten' }, a.token));
  await raw('/genootschap/roep-bijeen', { groep: g1.groep.id, wat: 'Borrel', datum: morgen() }, a.token);
  await raw('/genootschap/roep-bijeen', { groep: g2.groep.id, wat: 'Vergadering', datum: morgen() }, a.token);
  // en iets van gisteren hoort er niet in
  await raw('/genootschap/roep-bijeen', { groep: g1.groep.id, wat: 'Voorbij', datum: '2020-01-01' }, a.token);

  const d = await json(await raw('/genootschap/mijn-agenda', {}, a.token));
  assert.ok(d.ok, d.error);
  assert.equal(d.komt.filter(b => b.wat === 'Voorbij').length, 0, 'wat geweest is staat niet in wat komt');
  assert.ok(d.komt.some(b => b.groep === 'Club Een'), 'de groepsnaam staat erbij');
  assert.ok(d.komt.some(b => b.groep === 'Club Twee'));
});

test('Rahul schrijft en telt, maar plaatst niets', async () => {
  const a = await lid(), b = await lid();
  const g = await json(await raw('/genootschap/richt-op', { naam: 'De Rekenclub', soort: 'openbaar' }, a.token));
  await raw('/genootschap/binnen', { groep: g.groep.id }, b.token);
  const bij = await json(await raw('/genootschap/roep-bijeen', { groep: g.groep.id, wat: 'Diner', datum: morgen() }, a.token));
  await raw('/genootschap/antwoord', { groep: g.groep.id, id: bij.bijeenkomst.id, antwoord: 'ja' }, a.token);
  await raw('/genootschap/antwoord', { groep: g.groep.id, id: bij.bijeenkomst.id, antwoord: 'ja' }, b.token);

  // de datum-meting rekent zelf: dat moet ook zonder AI kloppen
  const d = await json(await raw('/genootschap/ai/datum', { groep: g.groep.id }, a.token));
  assert.equal(d.ok, true, d.reden);
  assert.equal(d.meting[0].ja, 2, 'de telling komt uit de echte antwoorden');
  assert.equal(d.meting[0].stil, 0, 'iedereen heeft geantwoord');

  const voor = await json(await raw('/genootschap/prikbord', { groep: g.groep.id }, a.token));
  const r = await raw('/genootschap/ai/aankondiging', { groep: g.groep.id, steekwoorden: 'diner, zondag, vroeg' }, a.token);
  const body = await r.json();
  if (process.env.ANTHROPIC_API_KEY) { assert.equal(r.status, 200); assert.ok(body.aankondiging); }
  else { assert.equal(r.status, 503); assert.ok(body.reden); }
  const na = await json(await raw('/genootschap/prikbord', { groep: g.groep.id }, a.token));
  assert.equal(na.totaal, voor.totaal, 'een aankondiging vragen zet niets op het prikbord');

  // en een vreemde krijgt niets, ook niet van de AI
  const vreemd = await lid();
  const weg = await json(await raw('/genootschap/ai/prikbord', { groep: g.groep.id }, vreemd.token));
  assert.equal(weg.ok, false);
});

test('zonder aanmelding geen genootschappen', async () => {
  for (const pad of ['/genootschap/mijn', '/genootschap/zoek', '/genootschap/richt-op']) {
    const r = await raw(pad, {});
    assert.equal(r.status, 401, pad + ' hoort dicht te zitten');
  }
});

/* ---- ronde 5: inzicht zonder ranglijst, bijgepraat met een bodem, meenemen ---- */

test('groepsinzicht is voor de beheerder, en telt de groep, niet de leden', async () => {
  const a = await lid(), b = await lid();
  const g = await json(await raw('/genootschap/richt-op', { naam: 'De Leeskring', soort: 'besloten' }, a.token));
  const groep = g.groep.id;
  await raw('/genootschap/nodig-uit', { groep, wie: b.codenaam }, a.token);
  await raw('/genootschap/binnen', { groep }, b.token);

  const p1 = await json(await raw('/genootschap/prik', { groep, tekst: 'Wie leest er mee?' }, a.token));
  await raw('/genootschap/reageer', { groep, id: p1.bericht.id, tekst: 'Ik.' }, b.token);
  await raw('/genootschap/prik', { groep, tekst: 'En deze blijft stil.' }, a.token);
  await raw('/genootschap/prik', { groep, tekst: 'Welke avond?', keuzes: ['Vrijdag', 'Zaterdag'] }, a.token);
  await raw('/genootschap/roep-bijeen', { groep, wat: 'Eerste avond', datum: morgen() }, a.token);
  await raw('/genootschap/antwoord', { groep, id: (await json(await raw('/genootschap/agenda', { groep }, a.token))).komt[0].id, antwoord: 'ja' }, b.token);

  const h = await json(await raw('/genootschap/gezondheid', { groep }, a.token));
  assert.ok(h.ok, h.error);
  assert.equal(h.groep.leden, 2);
  assert.equal(h.prikbord.totaal, 3);
  assert.equal(h.prikbord.reacties, 1);
  assert.equal(h.prikbord.zonderReactie, 1, 'een bericht bleef stil, en dat is te zien');
  assert.equal(h.actief.leden, 2, 'beide leden deden deze maand iets');
  assert.equal(h.bijeenkomsten.komend, 1);

  // geen ranglijst, geen namen, geen sleutels
  const tekst = JSON.stringify(h);
  assert.equal(tekst.includes(a.codenaam), false, 'geen codenaam bij de cijfers');
  assert.equal(tekst.includes(b.codenaam), false);
  // geen ranglijst: "actief" is een AANTAL, geen lijst van leden met scores
  assert.equal(typeof h.actief.leden, 'number');
  const lijsten = Object.values(h).filter(Array.isArray);
  assert.deepEqual(lijsten, [], 'het inzicht bevat geen enkele lijst, dus ook geen top bijdragers');

  // en een gewoon lid komt er niet in
  const vreemd = await json(await raw('/genootschap/gezondheid', { groep }, b.token));
  assert.ok(vreemd.error, 'alleen een beheerder ziet het inzicht');
});

test('bijgepraat heeft een bodem: als er niets is, zegt de app dat', async () => {
  const a = await lid(), b = await lid();
  const g = await json(await raw('/genootschap/richt-op', { naam: 'De Wandelclub', soort: 'besloten' }, a.token));
  const groep = g.groep.id;
  await raw('/genootschap/nodig-uit', { groep, wie: b.codenaam }, a.token);
  await raw('/genootschap/binnen', { groep }, b.token);

  await raw('/genootschap/prik', { groep, tekst: 'Zondag om tien uur.' }, a.token);
  await raw('/genootschap/prik', { groep, tekst: 'Welke route?', keuzes: ['Duinen', 'Bos'] }, a.token);
  await raw('/genootschap/roep-bijeen', { groep, wat: 'De zondagwandeling', datum: morgen() }, a.token);

  const bij1 = await json(await raw('/genootschap/bijgepraat', { groep }, b.token));
  assert.ok(bij1.ok, bij1.error);
  assert.equal(bij1.nieuw, 2, 'twee berichten die B nog niet zag');
  assert.equal(bij1.peilingen.length, 1, 'een peiling wacht nog op zijn stem');
  assert.equal(bij1.bijeenkomsten.length, 1, 'en een bijeenkomst op zijn antwoord');
  assert.equal(bij1.bij, false);

  // alles afhandelen en het bezoek afsluiten
  await raw('/genootschap/stem', { groep, id: bij1.peilingen[0].id, keuze: 0 }, b.token);
  await raw('/genootschap/antwoord', { groep, id: bij1.bijeenkomsten[0].id, antwoord: 'ja' }, b.token);
  const m = await json(await raw('/genootschap/gezien', { groep }, b.token));
  assert.ok(m.ok && m.gezien);

  const bij2 = await json(await raw('/genootschap/bijgepraat', { groep }, b.token));
  assert.equal(bij2.bij, true, 'daarna is hij bij, en de app verzint er niets bij');
  assert.equal(bij2.nieuw, 0);
  assert.ok(/Je bent bij/.test(bij2.tekst));

  // je eigen bericht telt niet als "gemist"
  await raw('/genootschap/prik', { groep, tekst: 'Ik neem koffie mee.' }, b.token);
  const bij3 = await json(await raw('/genootschap/bijgepraat', { groep }, b.token));
  assert.equal(bij3.nieuw, 0, 'wat je zelf schreef heb je niet gemist');
});

test('je neemt je genootschap mee: alles voor de beheerder, je eigen inbreng voor elk lid', async () => {
  const a = await lid(), b = await lid();
  const g = await json(await raw('/genootschap/richt-op', { naam: 'De Kookclub', soort: 'geheim',
    over: 'Wij koken.', regels: 'Niemand praat erover.' }, a.token));
  const groep = g.groep.id;
  await raw('/genootschap/nodig-uit', { groep, wie: b.codenaam }, a.token);
  await raw('/genootschap/binnen', { groep }, b.token);
  const p = await json(await raw('/genootschap/prik', { groep, tekst: 'Wat maken we?', keuzes: ['Vis', 'Vlees'] }, a.token));
  await raw('/genootschap/reageer', { groep, id: p.bericht.id, tekst: 'Vis, graag.' }, b.token);
  await raw('/genootschap/stem', { groep, id: p.bericht.id, keuze: 0 }, b.token);
  await raw('/genootschap/roep-bijeen', { groep, wat: 'De proefavond', datum: morgen(), waar: 'Bij mij' }, a.token);

  const alles = await json(await raw('/genootschap/uitvoer', { groep }, a.token));
  assert.ok(alles.ok, alles.error);
  assert.equal(alles.genootschap.naam, 'De Kookclub');
  assert.equal(alles.leden.length, 2);
  assert.equal(alles.prikbord.length, 1);
  assert.equal(alles.prikbord[0].reacties.length, 1);
  assert.equal(alles.prikbord[0].peiling.totaal, 1);
  assert.equal(alles.agenda.length, 1);
  assert.equal(/"key"|"vanKey"|"authorKey"/.test(JSON.stringify(alles)), false, 'geen sleutels in een uitvoer');
  assert.equal(/@|Lid \d/.test(JSON.stringify(alles)), false, 'en geen echte namen of e-mailadressen');

  // een gewoon lid krijgt het hele genootschap niet mee, zijn eigen inbreng wel
  const geweigerd = await json(await raw('/genootschap/uitvoer', { groep }, b.token));
  assert.ok(geweigerd.error, 'alleen een beheerder neemt het geheel mee');

  const mijn = await json(await raw('/genootschap/mijn-uitvoer', { groep }, b.token));
  assert.ok(mijn.ok, mijn.error);
  assert.equal(mijn.berichten.length, 0, 'B schreef zelf geen bericht');
  assert.equal(mijn.reacties.length, 1);
  assert.equal(mijn.stemmen.length, 1);
  assert.equal(mijn.stemmen[0].mijnKeuze, 'Vis');
  assert.equal(mijn.ik.codenaam, b.codenaam);
  assert.equal(JSON.stringify(mijn).includes('Wat maken we?') && JSON.stringify(mijn).includes(a.codenaam), false,
    'van andere leden staat er niets in');

  // en wie er niet in zit, komt er sowieso niet bij
  const c = await lid();
  const buiten = await json(await raw('/genootschap/mijn-uitvoer', { groep }, c.token));
  assert.ok(buiten.error);
});
