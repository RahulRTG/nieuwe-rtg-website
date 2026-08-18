/* Praten IN het potje.

   Twee dingen worden hier bewaakt, en het tweede is het belangrijkste.

   1. HET IS DE BESTAANDE LAAG. Er komt geen zevende berichtenvoorraad bij: een
      potjegesprek is een gewoon gesprek in kern/comm, met soort 'group' en
      `meta.sleutel = 'potje:<id>'`. Daarmee erft het de bewaartermijn, het
      wisrecht en de leesstand die daar al staan. Deze toets kijkt daar met de
      kern in de hand naar, want van buitenaf zie je alleen berichten en niet
      WAAR ze staan -- en dat laatste is juist de belofte.

   2. EEN POTJE GEEFT GEEN NIEUW RECHT OM IEMAND TE BEREIKEN. De wachtrij
      koppelt willekeurige spelers. Zonder deze regel is "even een potje dammen"
      de kortste weg naar een open lijn met een vreemde -- en in de RTF-app zou
      dat precies de poort omzeilen die tieners onvindbaar maakt in de zoeker.
      Chatten kan daarom alleen als ELK PAAR aan tafel elkaar buiten dit potje
      ook al mag bereiken.

   Draai los: node --test test/spelpraat.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakPraat = require('../server/kern/spellen/praat');

/* Een opstelling met een nagemaakte communicatiekern die precies bijhoudt wat
   er van hem gevraagd is. Dat is hier geen luiheid maar het onderwerp: de
   belofte is "het gaat de comm-kern in", en dan moet de toets zien DAT het die
   kern in gaat en met welke sleutel. */
function maak(opties) {
  const o = opties || {};
  const potjes = {};
  const gesprekken = [];
  const berichten = {};
  const comm = {
    gesprekMetSleutel: (s) => gesprekken.find(g => g.meta && g.meta.sleutel === s) || null,
    gesprekMaak(op) {
      const bestaat = comm.gesprekMetSleutel(op.meta && op.meta.sleutel);
      if (bestaat) return bestaat;
      const g = Object.assign({ id: 'gsp_' + (gesprekken.length + 1) }, op);
      gesprekken.push(g); berichten[g.id] = [];
      return g;
    },
    bericht(op) {
      const g = gesprekken.find(x => x.id === op.gesprekId);
      if (!g) throw new Error('geen gesprek');
      if (!g.deelnemers.includes(op.van)) throw new Error('niet van jou');
      const m = { id: 'brc_' + (berichten[g.id].length + 1), van: op.van, tekst: op.tekst };
      berichten[g.id].push(m);
      return m;
    },
    gesprek(mij, gid) {
      const g = gesprekken.find(x => x.id === gid);
      if (!g || !g.deelnemers.includes(mij)) throw new Error('niet van jou');
      return { berichten: berichten[gid].slice(), typt: [] };
    }
  };
  const praat = maakPraat({
    comm: () => (o.zonderComm ? null : comm),
    S: () => ({ potjes }),
    SOORTEN: { dam: 'Dammen', schaak: 'Schaken' },
    codenaamVan: (k) => 'CN-' + k,
    zijnVrienden: o.zijnVrienden || ((a, b) => (o.vrienden || []).some(paar => paar.includes(a) && paar.includes(b))),
    isGeblokkeerd: o.isGeblokkeerd || (() => false),
    klasgenotenVan: o.klasgenotenVan || (() => []),
    sociaalRate: o.sociaalRate || (() => true)
  });
  const potje = (id, spelers, soort) => { potjes[id] = { id, soort: soort || 'dam', spelers: spelers.slice(), status: 'bezig' }; return potjes[id]; };
  return { praat, potje, gesprekken, berichten, potjes };
}
const VRIENDEN = [['anna', 'boris']];

test('twee vrienden praten in hun potje, en dat gesprek staat in de comm-kern', () => {
  const h = maak({ vrienden: VRIENDEN });
  h.potje('p1', ['anna', 'boris']);

  // lezen voordat er iets gezegd is: een leeg venster, geen fout
  const leeg = h.praat.spelPraat('anna', 'p1');
  assert.equal(leeg.status, 200);
  assert.equal(leeg.mag, true);
  assert.equal(leeg.gesprek, null);
  assert.deepEqual(leeg.berichten, []);
  assert.deepEqual(h.gesprekken, [], 'lezen maakt geen gesprek aan');

  const r = h.praat.spelPraatStuur('anna', 'p1', 'Goed potje!');
  assert.equal(r.ok, true);
  assert.equal(h.gesprekken.length, 1);
  const g = h.gesprekken[0];
  assert.equal(g.soort, 'group', 'een potjegesprek is een groepsgesprek');
  assert.equal(g.meta.sleutel, 'potje:p1', 'en hangt aan het potje');
  assert.deepEqual(g.deelnemers.sort(), ['anna', 'boris'], 'met beide spelers erin');
  assert.equal(g.titel, 'Potje Dammen', 'de titel draagt de spelnaam');
  assert.equal(/anna|boris|CN-/.test(g.titel), false, 'en geen namen of codenamen: ' + g.titel);

  // en de tegenstander leest hetzelfde
  const bij = h.praat.spelPraat('boris', 'p1');
  assert.equal(bij.gesprek, g.id);
  assert.equal(bij.berichten.length, 1);
  assert.equal(bij.berichten[0].tekst, 'Goed potje!');
});

test('een tweede bericht komt in HETZELFDE gesprek, niet in een nieuw', () => {
  const h = maak({ vrienden: VRIENDEN });
  h.potje('p1', ['anna', 'boris']);
  h.praat.spelPraatStuur('anna', 'p1', 'een');
  h.praat.spelPraatStuur('boris', 'p1', 'twee');
  assert.equal(h.gesprekken.length, 1, 'een potje, een gesprek');
  assert.equal(h.berichten[h.gesprekken[0].id].length, 2);
});

test('een vreemde aan tafel sluit de chat -- voor iedereen, niet alleen voor hem', () => {
  /* De kern van de regel. Anna kent Boris en Anna kent Carla, maar Boris en
     Carla kennen elkaar niet. In een groepsruimte praat Boris ook tegen Carla,
     dus zou een controle die alleen naar MIJN kant kijkt twee vreemden bij
     elkaar in een kamer zetten door ze allebei uit te nodigen. */
  const h = maak({ vrienden: [['anna', 'boris'], ['anna', 'carla']] });
  h.potje('p1', ['anna', 'boris', 'carla']);
  for (const wie of ['anna', 'boris', 'carla']) {
    const r = h.praat.spelPraat(wie, 'p1');
    assert.equal(r.status, 403, wie + ' hoort hier niet te kunnen praten');
    assert.match(r.error, /niet kunt bereiken/);
  }
  assert.equal(h.praat.spelPraatStuur('anna', 'p1', 'hoi').status, 403, 'ook sturen niet');
  assert.deepEqual(h.gesprekken, [], 'en er is niets aangelegd');
});

test('een potje uit de wachtrij met een wildvreemde heeft geen chat', () => {
  const h = maak({ vrienden: [] });
  h.potje('p1', ['anna', 'vreemde']);
  assert.equal(h.praat.spelPraat('anna', 'p1').status, 403);
});

test('klasgenoten mogen wel praten, ook zonder vriendschap', () => {
  /* Beschermde tieners zijn onvindbaar in de zoeker en kunnen dus vaak geen
     vriend worden; hun klas is de kring die ze wel hebben. Zou die hier niet
     meetellen, dan is de chat precies dicht voor de groep die hem in De Arena
     het meest gebruikt. */
  const h = maak({ vrienden: [], klasgenotenVan: (k) => k === 'kind-a' ? [{ key: 'kind-b' }] : (k === 'kind-b' ? [{ key: 'kind-a' }] : []) });
  h.potje('p1', ['kind-a', 'kind-b']);
  const r = h.praat.spelPraatStuur('kind-a', 'p1', 'zet jij?');
  assert.equal(r.ok, true);
  assert.equal(h.gesprekken.length, 1);
});

test('een blokkade weegt zwaarder dan een vriendschap', () => {
  const h = maak({ vrienden: VRIENDEN, isGeblokkeerd: (a, b) => a === 'boris' && b === 'anna' });
  h.potje('p1', ['anna', 'boris']);
  // ook de kant die NIET blokkeerde komt er niet in: een blokkade is geen
  // eenrichtingsverkeer zodra er een gedeelde ruimte van komt
  assert.equal(h.praat.spelPraat('anna', 'p1').status, 403);
  assert.equal(h.praat.spelPraat('boris', 'p1').status, 403);
});

test('wie niet meespeelt komt er niet in, ook niet met het juiste potje-id', () => {
  const h = maak({ vrienden: [['anna', 'boris'], ['anna', 'derk']] });
  h.potje('p1', ['anna', 'boris']);
  const r = h.praat.spelPraat('derk', 'p1');
  assert.equal(r.status, 404, 'een vriend van een speler is nog geen deelnemer');
  assert.equal(h.praat.spelPraatStuur('derk', 'p1', 'hoi').status, 404);
});

test('een leeg bericht doet niets, en een te lang bericht wordt afgekapt', () => {
  const h = maak({ vrienden: VRIENDEN });
  h.potje('p1', ['anna', 'boris']);
  assert.equal(h.praat.spelPraatStuur('anna', 'p1', '   ').status, 400);
  assert.equal(h.praat.spelPraatStuur('anna', 'p1', null).status, 400);
  assert.deepEqual(h.gesprekken, [], 'een leeg bericht legt ook geen lijn aan');

  h.praat.spelPraatStuur('anna', 'p1', 'x'.repeat(5000));
  assert.equal(h.berichten[h.gesprekken[0].id][0].tekst.length, 500);
});

test('een stortvloed berichten wordt afgeremd', () => {
  let n = 0;
  const h = maak({ vrienden: VRIENDEN, sociaalRate: () => ++n <= 3 });
  h.potje('p1', ['anna', 'boris']);
  for (let i = 0; i < 3; i++) assert.equal(h.praat.spelPraatStuur('anna', 'p1', 'x').ok, true);
  const r = h.praat.spelPraatStuur('anna', 'p1', 'x');
  assert.equal(r.status, 429);
});

test('zonder communicatiekern bestaat praten hier niet -- en het spel draait gewoon door', () => {
  const h = maak({ vrienden: VRIENDEN, zonderComm: true });
  h.potje('p1', ['anna', 'boris']);
  const r = h.praat.spelPraat('anna', 'p1');
  assert.equal(r.status, 404);
  assert.match(r.error, /bestaat hier niet/);
});

/* ================= over de route, met de echte kernen =================
   De toetsen hierboven draaien op een nagemaakte comm-kern. Wat ze daarmee
   niet kunnen laten zien is dat de ECHTE kern er ook staat: die wordt in een
   latere laag opgebouwd dan de spellen, dus hij komt als functie binnen. Zou
   die constructie stukgaan, dan is hier alles nog groen en praat er in de app
   niemand meer. Bovendien is dit de enige plek waar blijkt dat een potjechat
   in de Berichten-app terechtkomt -- de hele reden om de bestaande laag te
   gebruiken in plaats van een zevende voorraad. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child, teller = 0;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-praat-'));
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

// twee verse leden die vrienden zijn (dezelfde opzet als test/spellen.test.js)
async function tweeVrienden() {
  const t = Date.now() + '' + (teller++);
  const a = await json(await raw('/auth/register', { name: 'Praat A' + t, email: 'pa' + t + '@v.test', phone: '0644' + String(t).slice(-6), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' }));
  const b = await json(await raw('/auth/register', { name: 'Praat B' + t, email: 'pb' + t + '@v.test', phone: '0655' + String(t).slice(-6), password: 'geheim123', geboortedatum: '1992-02-02', tier: 'rtg' }));
  await raw('/member/connections', {}, a.token); await raw('/member/connections', {}, b.token);
  const zoek = await json(await raw('/member/find', { q: b.state.user.codename }, a.token));
  const bKey = (zoek.results.find(r => r.codename === b.state.user.codename) || {}).key;
  assert.ok(bKey, 'A vindt B op codenaam');
  await raw('/member/connect', { key: bKey }, a.token);
  const verzoeken = await json(await raw('/member/connections', {}, b.token));
  await raw('/member/connect/respond', { key: (verzoeken.requests || [])[0].key, action: 'accept' }, b.token);
  return { a: { tok: a.token, cn: a.state.user.codename }, b: { tok: b.token, key: bKey, cn: b.state.user.codename } };
}

test('een potjechat komt in de Berichten-app terecht, als gewoon gesprek', async () => {
  const { a, b } = await tweeVrienden();
  const nieuw = await json(await raw('/member/spel/nieuw', { soort: 'schaak', vrienden: [b.key] }, a.tok));
  await raw('/member/spel/antwoord', { id: nieuw.id, akkoord: true }, b.tok);

  const stuur = await json(await raw('/member/spel/praat-stuur', { id: nieuw.id, tekst: 'Mooie opening.' }, a.tok));
  assert.equal(stuur.ok, true, JSON.stringify(stuur).slice(0, 200));

  const lees = await json(await raw('/member/spel/praat', { id: nieuw.id }, b.tok));
  assert.equal(lees.berichten.length, 1);
  assert.equal(lees.berichten[0].tekst, 'Mooie opening.');

  /* En nu de belofte zelf: dit staat niet in een spellenhoekje maar in de
     inbox, onder dezelfde lade als elk ander groepsgesprek. */
  const inbox = await json(await raw('/comm/inbox', {}, b.tok));
  const alle = (inbox.laden || []).flatMap(l => l.gesprekken || []).concat(inbox.gesprekken || []);
  const dit = alle.find(g => g.id === stuur.gesprek);
  assert.ok(dit, 'het potjegesprek staat in de inbox: ' + JSON.stringify(alle).slice(0, 300));
  assert.match(dit.titel, /Schaken/, 'met de spelnaam als titel: ' + dit.titel);

  // en terugpraten kan gewoon langs de normale weg van de Berichten-app
  const terug = await raw('/comm/stuur', { id: stuur.gesprek, tekst: 'Dank!' }, b.tok);
  assert.equal(terug.status, 200);
  const weer = await json(await raw('/member/spel/praat', { id: nieuw.id }, a.tok));
  assert.equal(weer.berichten.length, 2, 'een gesprek is een gesprek, waar je het ook opent');
});

/* HETZELFDE GEZIN. Twee profielen onder dezelfde gezinscode zijn geen
   "vrienden" (dat is een andere laag) en geen klasgenoten, en vielen daardoor
   buiten de kring: een ouder en een kind die samen dammen kregen geen chat.
   Dat is gevonden door het na te meten en niet door erover na te denken, en
   het staat hier zodat het niet stilletjes terugkomt.

   De tweede helft van deze toets gaat over de NAAM van de afzender. Het
   actormodel van kern/comm kent 'zaak:', 'mens:' en 'gezin:', maar niet de
   'rtf:'-sleutel die de spellen dragen -- die kwam eruit als "Onbekend". Twee
   gezinsleden zagen elkaars berichten dus zonder naam. */
test('twee profielen uit hetzelfde gezin praten, en hun naam staat erbij', async () => {
  const t = Date.now() + '' + (teller++);
  const fnd = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
  const g = await json(await fnd('/gezin/maak', { gezinsnaam: 'Praatgezin ' + t, naam: 'Ouder', pin: '1234' }));
  const p2 = await json(await fnd('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Oom', rol: 'gezinslid', groep: 'volw' }));
  const kies = await json(await fnd('/gezin/profiel/kies', { code: g.code, profielId: p2.profiel.id }));
  const A = { code: g.code, token: g.token }, B = { code: g.code, token: kies.token };
  const spel = (actie, body, s) => fetch(BASE + '/api/rtf/spel/' + actie, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ code: s.code, token: s.token }, body || {}))
  });

  const nieuw = await json(await spel('nieuw', { soort: 'dam', codenamen: [kies.profiel.codenaam] }, A));
  assert.ok(nieuw.id, 'het potje start: ' + JSON.stringify(nieuw).slice(0, 200));
  await spel('antwoord', { id: nieuw.id, akkoord: true }, B);

  const stuur = await json(await spel('praat-stuur', { id: nieuw.id, tekst: 'jij mag' }, A));
  assert.equal(stuur.ok, true, 'een huishouden is een kring: ' + JSON.stringify(stuur).slice(0, 200));

  const lees = await json(await spel('praat', { id: nieuw.id }, B));
  assert.equal(lees.berichten.length, 1);
  assert.notEqual(lees.berichten[0].van, 'Onbekend', 'de afzender heeft een naam');
  assert.ok(lees.berichten[0].van && lees.berichten[0].van.length > 3,
    'en dat is zijn codenaam: ' + lees.berichten[0].van);
});

test('een derde die het potje-id kent leest niet mee', async () => {
  const { a, b } = await tweeVrienden();
  const { a: c } = await tweeVrienden();
  const nieuw = await json(await raw('/member/spel/nieuw', { soort: 'schaak', vrienden: [b.key] }, a.tok));
  await raw('/member/spel/antwoord', { id: nieuw.id, akkoord: true }, b.tok);
  await raw('/member/spel/praat-stuur', { id: nieuw.id, tekst: 'onder ons' }, a.tok);

  const r = await raw('/member/spel/praat', { id: nieuw.id }, c.tok);
  assert.equal(r.status, 404, 'een raadbaar id is nooit genoeg');
});
