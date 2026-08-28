/* Teams: een vaste club om mee te spelen. Iedereen mag er een maken.

   Dat laatste is de keuze die getoetst moet worden, want "iedereen mag er een
   maken" is precies de vorm waarin een vrij tekstveld en een uitnodigingsknop
   het huis binnenkomen. Drie dingen houden dat begrensd, en ze staan hier alle
   drie als toets omdat ze los van elkaar terug te draaien zijn:

     1. Een team is NIET openbaar -- geen zoeker, geen lijst. Je ziet het alleen
        als je erin zit of ervoor bent uitgenodigd. Een vrije naam is daarmee
        geen etalage.
     2. Uitnodigen kan alleen binnen je eigen kring (vrienden, klasgenoten).
        Een team is geen nieuwe weg om iemand te bereiken.
     3. Je zit er pas in als je ja zegt.

   En een vierde die geen begrenzing is maar een besluit: een team heeft GEEN
   ranglijst. Zou die er zijn, dan viel hij onder de progressiegrens en stond de
   helft van een schoolteam er niet op.

   Draai los: node --test test/spelteams.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakTeams = require('../server/kern/spellen/teams');
const { schoon } = require('../server/kern/util');
const { BELEID } = require('../server/bewaarbeleid');

/* anna en boris zijn vrienden; kind-a en kind-b zijn klasgenoten; carla kent
   alleen anna; derk kent niemand. */
const VRIENDEN = [['anna', 'boris'], ['anna', 'carla']];
const KLAS = { 'kind-a': ['kind-b'], 'kind-b': ['kind-a'] };
function maak(opties) {
  const o = opties || {};
  const db = { data: {} };
  let n = 0;
  const teams = maakTeams({
    db, save() {}, rid: () => 't' + (++n), nu: () => o.nu || '2026-08-09T12:00:00.000Z',
    codenaamVan: (k) => 'CN-' + k,
    isGeblokkeerd: o.isGeblokkeerd || (() => false),
    zijnVrienden: (a, b) => VRIENDEN.some(p => p.includes(a) && p.includes(b)),
    klasgenotenVan: (k) => (KLAS[k] || []).map(x => ({ key: x })),
    schoon, sociaalRate: o.sociaalRate || (() => true)
  });
  return { db, ...teams };
}

test('een team maken kan gewoon, met een naam en een uitnodiging', () => {
  const h = maak();
  const r = h.teamNieuw('anna', 'De Donderdagclub', ['boris']);
  assert.equal(r.ok, true);
  assert.equal(r.team.naam, 'De Donderdagclub');
  assert.equal(r.team.baas, true);
  assert.deepEqual(r.team.leden.map(l => l.codenaam), ['CN-anna'], 'alleen jijzelf zit er meteen in');
  assert.deepEqual(r.team.uitgenodigd.map(u => u.codenaam), ['CN-boris'], 'de rest is gevraagd');
});

test('een uitnodiging is geen lidmaatschap: je zit er pas in als je ja zegt', () => {
  const h = maak();
  const r = h.teamNieuw('anna', 'Clubje', ['boris']);
  assert.deepEqual(h.mijnTeams('boris').teams, [], 'boris heeft nog geen team');
  assert.equal(h.mijnTeams('boris').uitnodigingen.length, 1, 'maar wel een uitnodiging');

  assert.equal(h.teamAntwoord('boris', r.team.id, true).lid, true);
  assert.equal(h.mijnTeams('boris').teams.length, 1);
  assert.equal(h.mijnTeams('boris').uitnodigingen.length, 0);
});

test('nee zeggen laat niets achter', () => {
  const h = maak();
  const r = h.teamNieuw('anna', 'Clubje', ['boris']);
  assert.equal(h.teamAntwoord('boris', r.team.id, false).lid, false);
  assert.deepEqual(h.mijnTeams('boris'), { status: 200, teams: [], uitnodigingen: [] });
  assert.deepEqual(h.mijnTeams('anna').teams[0].uitgenodigd, [], 'en de vraag staat niet meer open');
});

test('uitnodigen kan alleen binnen je eigen kring', () => {
  const h = maak();
  // derk kent niemand: hij valt er stil buiten (het team komt er wel)
  const r = h.teamNieuw('anna', 'Clubje', ['boris', 'derk']);
  assert.deepEqual(r.team.uitgenodigd.map(u => u.codenaam), ['CN-boris']);
  assert.deepEqual(h.mijnTeams('derk').uitnodigingen, [], 'derk krijgt niets te zien');
});

test('klasgenoten tellen als kring, want een beschermde tiener heeft geen andere', () => {
  const h = maak();
  const r = h.teamNieuw('kind-a', 'Klas 3B', ['kind-b']);
  assert.deepEqual(r.team.uitgenodigd.map(u => u.codenaam), ['CN-kind-b']);
});

test('een blokkade weegt zwaarder dan een vriendschap', () => {
  const h = maak({ isGeblokkeerd: (a, b) => a === 'boris' && b === 'anna' });
  const r = h.teamNieuw('anna', 'Clubje', ['boris']);
  assert.deepEqual(r.team.uitgenodigd, []);
});

test('de baas kan er meer bij vragen -- uit ZIJN kring, niet uit die van een ander', () => {
  /* Anders is "nodig jij hem uit" de manier om de kringregel te omzeilen: boris
     kent carla niet, maar zou haar via het team van anna toch kunnen halen. */
  const h = maak();
  const r = h.teamNieuw('anna', 'Clubje', ['boris']);
  h.teamAntwoord('boris', r.team.id, true);

  const doorBoris = h.teamNodig('boris', r.team.id, ['carla']);
  assert.equal(doorBoris.status, 403, 'boris is de baas niet');

  const doorAnna = h.teamNodig('anna', r.team.id, ['carla']);
  assert.equal(doorAnna.ok, true);
  assert.deepEqual(doorAnna.team.uitgenodigd.map(u => u.codenaam), ['CN-carla']);

  /* En ook de baas blijft aan de kringregel gebonden: een team is geen plek
     waar je iemand naar binnen trekt die je zelf niet kunt bereiken. Zonder
     deze regel is de controle bij het OPRICHTEN een formaliteit -- je maakt een
     leeg team en nodigt daarna uit wie je wilt. */
  const buiten = h.teamNodig('anna', r.team.id, ['derk']);
  assert.equal(buiten.status, 400, 'derk zit niet in de kring van anna');
  assert.equal(JSON.stringify(h.db.data.spelTeams).includes('derk'), false);
});

test('een team is niet openbaar: wie er niet bij hoort ziet het niet', () => {
  const h = maak();
  const r = h.teamNieuw('anna', 'De Geheime Club', ['boris']);
  assert.deepEqual(h.mijnTeams('derk'), { status: 200, teams: [], uitnodigingen: [] });
  // en meedoen op een geraden id kan niet
  assert.equal(h.teamAntwoord('derk', r.team.id, true).status, 404);
  assert.equal(h.teamNodig('derk', r.team.id, ['carla']).status, 404);
  assert.equal(h.teamVerlaat('derk', r.team.id).status, 404);
});

test('een naam is geen vrij veld: leeg gaat niet, en tekens gaan eruit', () => {
  const h = maak();
  assert.equal(h.teamNieuw('anna', '   ', []).status, 400);
  assert.equal(h.teamNieuw('anna', 'a', []).status, 400, 'een letter is geen naam');
  const r = h.teamNieuw('anna', '  <b>De   Club</b>  ', []);
  assert.equal(r.team.naam, 'bDe Club/b', 'punthaken eruit, spaties samengetrokken');
  const lang = h.teamNieuw('anna', 'x'.repeat(200), []);
  assert.equal(lang.team.naam.length, 40, 'en een grens op de lengte');
});

test('weggaan kan; de laatste die weggaat heft het team op', () => {
  const h = maak();
  const r = h.teamNieuw('anna', 'Clubje', ['boris']);
  h.teamAntwoord('boris', r.team.id, true);

  const weg = h.teamVerlaat('anna', r.team.id);
  assert.equal(weg.opgeheven, false);
  assert.equal(h.mijnTeams('boris').teams[0].baas, true, 'de baas schuift door naar wie er nog zit');

  const laatste = h.teamVerlaat('boris', r.team.id);
  assert.equal(laatste.opgeheven, true);
  assert.deepEqual(h.db.data.spelTeams, [], 'een team zonder leden blijft niet als naam staan');
});

test('een team is begrensd: in aantal leden en in aantal teams per persoon', () => {
  const h = maak();
  // twaalf leden is de grens; de dertiende uitnodiging valt af
  const veel = Array.from({ length: 20 }, (_, i) => 'boris');   // dedup: blijft er een
  const r = h.teamNieuw('anna', 'Clubje', veel);
  assert.equal(r.team.uitgenodigd.length, 1, 'dubbele uitnodigingen tellen als een');

  for (let i = 0; i < 7; i++) assert.equal(h.teamNieuw('anna', 'Team ' + i, []).ok, true);
  const teveel = h.teamNieuw('anna', 'Nog een', []);
  assert.equal(teveel.status, 409, 'acht teams is genoeg: ' + JSON.stringify(teveel));
});

test('een stortvloed teams wordt afgeremd', () => {
  let n = 0;
  const h = maak({ sociaalRate: () => ++n <= 2 });
  assert.equal(h.teamNieuw('anna', 'Een', []).ok, true);
  assert.equal(h.teamNieuw('anna', 'Twee', []).ok, true);
  assert.equal(h.teamNieuw('anna', 'Drie', []).status, 429);
});

test('een team heeft geen ranglijst, geen punten en geen stand', () => {
  /* Geen toets op een lijstje veldnamen maar op de hele vorm: alles wat naar
     een blijvende prestatie ruikt hoort hier niet te staan, want dan valt het
     onder de progressiegrens en staat de helft van een schoolteam er niet op. */
  const h = maak();
  const r = h.teamNieuw('anna', 'Clubje', ['boris']);
  h.teamAntwoord('boris', r.team.id, true);
  const plat = JSON.stringify(h.mijnTeams('anna')) + JSON.stringify(h.db.data.spelTeams);
  assert.equal(/punten|score|stand|ranglijst|gewonnen|winst|niveau/i.test(plat), false,
    'er zit een prestatie in een team: ' + plat.slice(0, 300));
});

test('een verwijderd lid laat geen team achter waar hij nog in staat', () => {
  const h = maak();
  const r = h.teamNieuw('anna', 'Clubje', ['boris', 'carla']);
  h.teamAntwoord('boris', r.team.id, true);

  h.teamVergeet('anna');
  const over = h.db.data.spelTeams[0];
  assert.deepEqual(over.leden, ['boris'], 'anna is eruit');
  assert.equal(over.baas, 'boris', 'en het bazenstokje schuift door');
  /* De openstaande uitnodiging aan carla BLIJFT staan, en dat is geen
     vergetelheid: die vraag draagt carla's sleutel en niet die van anna, en hij
     was een uitnodiging voor het TEAM en niet voor anna persoonlijk. Precies
     hetzelfde gebeurt als anna gewoon weggaat. Er is dus niets van de
     verwijderde persoon dat blijft staan. */
  assert.deepEqual(over.uitgenodigd, ['carla']);
  assert.equal(JSON.stringify(over).includes('anna'), false, 'van anna staat er niets meer in');

  h.teamVergeet('boris');
  assert.deepEqual(h.db.data.spelTeams, [], 'de laatste eruit is het team weg');
});

/* ================= over de route, met een echte server =================
   De toetsen hierboven draaien op de kale module. Wat ze niet laten zien is
   dat de route de kring OOK afdwingt: een client mag zelf een lijst sleutels
   meesturen, en die mag nooit verder reiken dan waar de server hem toelaat.
   Dat is dezelfde reden waarom een potje en een toernooi hun kring hier
   bepalen en niet uit het verzoek lezen. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child, teller = 0;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-teams-'));
const json = r => r.json();
function raw(pad, body, token) {
  return fetch(BASE + '/api' + pad, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  });
}
test.before(async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } })); });
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});
async function lid() {
  const t = Date.now() + '' + (teller++);
  const r = await json(await raw('/auth/register', { name: 'Team ' + t, email: 'tm' + t + '@v.test',
    phone: '0688' + String(t).slice(-6), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' }));
  assert.ok(r.token, JSON.stringify(r).slice(0, 160));
  return { tok: r.token, cn: r.state.user.codename };
}
async function bevriend(a, b) {
  await raw('/member/connections', {}, a.tok); await raw('/member/connections', {}, b.tok);
  const zoek = await json(await raw('/member/find', { q: b.cn }, a.tok));
  const bKey = (zoek.results.find(r => r.codename === b.cn) || {}).key;
  assert.ok(bKey, 'gevonden op codenaam');
  await raw('/member/connect', { key: bKey }, a.tok);
  const vz = await json(await raw('/member/connections', {}, b.tok));
  await raw('/member/connect/respond', { key: (vz.requests || [])[0].key, action: 'accept' }, b.tok);
  return bKey;
}

test('over de route: een team maken, meedoen en samen spelen', async () => {
  const a = await lid(), b = await lid();
  const bKey = await bevriend(a, b);

  const gemaakt = await json(await raw('/member/spel/team-nieuw', { naam: 'De Donderdagclub', leden: [bKey] }, a.tok));
  assert.equal(gemaakt.ok, true, JSON.stringify(gemaakt).slice(0, 200));

  const bijB = await json(await raw('/member/spel/team-mijn', {}, b.tok));
  assert.equal(bijB.uitnodigingen.length, 1);
  assert.equal(bijB.uitnodigingen[0].naam, 'De Donderdagclub');
  await raw('/member/spel/team-antwoord', { id: gemaakt.team.id, akkoord: true }, b.tok);

  const nu = await json(await raw('/member/spel/team-mijn', {}, b.tok));
  assert.equal(nu.teams.length, 1);
  const leden = nu.teams[0].leden.map(l => l.codenaam).sort();
  assert.deepEqual(leden, [a.cn, b.cn].sort(), 'beiden zitten erin, op codenaam');

  // en daarmee is een potje starten precies wat het altijd al was
  const sleutels = nu.teams[0].leden.map(l => l.key).filter(k => k !== undefined);
  assert.equal(sleutels.length, 2, 'de sleutels reizen mee zodat je in een tik kunt uitnodigen');
});

test('over de route: erbij vragen en weggaan, de twee die alleen op kernniveau stonden', async () => {
  /* `/api/member/spel/team-nodig` en `team-verlaat` waren wel op kernniveau
     getoetst maar liepen nooit over de ROUTE. Dat is precies het stuk dat de
     kerntoets niet ziet: de poort (auth, geen gast), het zeven van de
     argumenten, en de vorm van het antwoord. Bij `team-verlaat` weegt dat
     dubbel, want de app roept hem echt aan (spelen.html). */
  const a = await lid(), b = await lid(), c = await lid();
  const bKey = await bevriend(a, b);
  const cKey = await bevriend(a, c);

  const gemaakt = await json(await raw('/member/spel/team-nieuw', { naam: 'Groeiclub', leden: [bKey] }, a.tok));
  await raw('/member/spel/team-antwoord', { id: gemaakt.team.id, akkoord: true }, b.tok);

  // erbij vragen: alleen de baas, en het antwoord draagt de nieuwe stand
  const doorB = await raw('/member/spel/team-nodig', { id: gemaakt.team.id, leden: [cKey] }, b.tok);
  assert.equal(doorB.status, 403, 'wie het team niet maakte vraagt er niemand bij');
  const doorA = await json(await raw('/member/spel/team-nodig', { id: gemaakt.team.id, leden: [cKey] }, a.tok));
  assert.equal(doorA.ok, true, JSON.stringify(doorA).slice(0, 200));
  assert.equal(doorA.team.uitgenodigd.length, 1);
  assert.equal((await json(await raw('/member/spel/team-mijn', {}, c.tok))).uitnodigingen.length, 1,
    'en c heeft de uitnodiging ook echt');

  // weggaan: het team blijft bestaan zolang er iemand in zit
  const weg = await json(await raw('/member/spel/team-verlaat', { id: gemaakt.team.id }, a.tok));
  assert.equal(weg.opgeheven, false);
  assert.deepEqual((await json(await raw('/member/spel/team-mijn', {}, a.tok))).teams, [], 'a zit er niet meer in');
  const laatste = await json(await raw('/member/spel/team-verlaat', { id: gemaakt.team.id }, b.tok));
  assert.equal(laatste.opgeheven, true, 'de laatste die weggaat heft het team op');

  // zonder token komt er niemand langs de poort
  assert.equal((await raw('/member/spel/team-nodig', { id: gemaakt.team.id, leden: [cKey] })).status, 401);
  assert.equal((await raw('/member/spel/team-verlaat', { id: gemaakt.team.id })).status, 401);
});

test('over de route: een gezinslid mag wel in je team, ook zonder vriendschap', async () => {
  /* Hier zat een tweede definitie van de kring: de route filterde op vrienden
     en klasgenoten, de kern kent ook het huishouden. Een ouder kon zijn eigen
     kind dus niet in zijn team vragen -- de smalste van de twee won, zonder dat
     iemand dat besloten had. */
  const t = Date.now() + '' + (teller++);
  const fnd = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
  const g = await json(await fnd('/gezin/maak', { gezinsnaam: 'Teamgezin ' + t, naam: 'Ouder', pin: '1234' }));
  const p2 = await json(await fnd('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Oom', rol: 'gezinslid', groep: 'volw' }));
  const kies = await json(await fnd('/gezin/profiel/kies', { code: g.code, profielId: p2.profiel.id }));

  const r = await json(await fetch(BASE + '/api/rtf/spel/team-nieuw', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: g.code, token: g.token, naam: 'Gezinsclub', leden: [kies.profiel.handle || ('rtf:' + g.code + ':' + p2.profiel.id)] })
  }));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 200));
  assert.equal(r.team.uitgenodigd.length, 1, 'het gezinslid is gevraagd: ' + JSON.stringify(r.team));
});

test('over de route: een sleutel van buiten je kring meesturen levert niets op', async () => {
  const a = await lid(), b = await lid(), vreemde = await lid();
  const bKey = await bevriend(a, b);
  // de sleutel van de vreemde bestaat echt; hij is alleen geen vriend van a
  const c = await lid();
  const vreemdeKey = await bevriend(vreemde, c);

  const r = await json(await raw('/member/spel/team-nieuw', { naam: 'Clubje', leden: [bKey, vreemdeKey] }, a.tok));
  assert.equal(r.ok, true);
  assert.equal(r.team.uitgenodigd.length, 1, 'alleen de vriend is gevraagd: ' + JSON.stringify(r.team.uitgenodigd));
  const bijVreemde = await json(await raw('/member/spel/team-mijn', {}, vreemde.tok));
  assert.deepEqual(bijVreemde.uitnodigingen, [], 'de vreemde ziet niets');
});

test('teams verlopen op hun laatste gebruik en niet op hun oprichting', () => {
  /* Op `at` zou een club waarmee elke week gespeeld wordt na een jaar
     verdwijnen. Deze toets bewaakt het beleid EN het veld waar het beleid naar
     kijkt -- die twee los van elkaar laten lopen is precies hoe een tak stil
     buiten het bewaarbeleid valt. */
  const regel = BELEID.find(r => r.tak === 'spelTeams');
  assert.ok(regel, 'spelTeams hoort in server/bewaarbeleid.js te staan');
  assert.equal(regel.datum, 'laatst');

  const h = maak();
  const r = h.teamNieuw('anna', 'Clubje', ['boris']);
  const t = h.db.data.spelTeams[0];
  assert.ok(t.laatst, 'het veld staat er ook echt in');
  t.laatst = '2020-01-01T00:00:00.000Z';
  h.teamAntwoord('boris', r.team.id, true);
  assert.notEqual(h.db.data.spelTeams[0].laatst, '2020-01-01T00:00:00.000Z', 'gebruik houdt het team levend');
});
