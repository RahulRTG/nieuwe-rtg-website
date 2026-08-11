/* DE DAGOPGAVE: een opgave per dag, dezelfde voor iedereen, met een bord dat
   's nachts leeg is.

   Deze toets staat op twee hoogten, en dat is met opzet:

   1. DE LAAG ZELF (kern/spellen/dag.js), met een verzonnen spelletje van vier
      regels. Zo staat er geen sudoku in de weg bij vragen die niets met sudoku
      te maken hebben -- wanneer de klok begint, wie er op het bord komt, wat er
      onder de progressiegrens gebeurt, en wat er van gisteren overblijft. Met
      een injecteerbare `vandaag()` valt de dag hier vooruit te zetten zonder de
      klok van de machine te verzetten.
   2. DE ECHTE WEG, met een draaiende server en de echte sudoku. Daar wordt
      bewezen dat de OPLOSSING de server niet verlaat en dat de ingangen achter
      de ledenpoort staan.

   WAT ER HIER NIET IS, en dat wordt ook getoetst: een reeks. Geen "vijf dagen
   op rij", geen veld waar er een in past, geen woord ervoor in een antwoord.
   Dat is geen smaak maar `CLAUDE.md`: een dagstreak straft je voor de dag dat
   je niet meedoet, en dat is precies de ratel die hier niet hoort.

   Draai los: node --experimental-sqlite --test test/speldag.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

/* ================= de laag zelf, met een verzonnen spelletje =================
   Het "spel" is: onthoud een woord en typ het terug. Meer heeft deze laag niet
   nodig, en minder houdt de toetsen over de BOEKHOUDING vrij van spelregels. */
let uitgegeven = 0;
const OPGAVE = () => {
  uitgegeven++;
  return { geheim: 'sesam-' + uitgegeven, opgave: { hint: 'opgave nummer ' + uitgegeven } };
};
const KEUR = ({ geheim, inzending, seconden }) => {
  if (typeof inzending !== 'string' || !inzending) return { status: 400, error: 'Stuur een antwoord mee.' };
  if (inzending !== geheim) return { goed: false };
  return { goed: true, punten: Math.max(10, 300 - Math.round(seconden)) };
};

function maakLaag(opties = {}) {
  const bak = { spellen: {} };
  let datum = opties.datum || '2026-08-11';
  const laag = require('../server/kern/spellen/dag')({
    S: () => bak.spellen,
    save() {},
    nu: () => new Date().toISOString(),
    codenaamVan: (h) => 'CN-' + h,
    ARCADE: {
      proef: { naam: 'Proef', werelden: ['rtg'], maxPunten: 300, serverScore: true, dagelijks: true },
      // een spel waarvan de haak zich vergist: hij deelt tien keer zijn eigen
      // grens uit. Dat hoort de laag op te vangen en niet door te laten
      gulzig: { naam: 'Gulzig', werelden: ['rtg'], maxPunten: 50, serverScore: true, dagelijks: true },
      kaal: { naam: 'Kaal', werelden: ['rtg'], maxPunten: 999 }
    },
    DAG: {
      proef: { opgave: OPGAVE, keur: KEUR },
      gulzig: { opgave: OPGAVE, keur: ({ geheim, inzending }) => (inzending === geheim ? { goed: true, punten: 500 } : { goed: false }) }
    },
    // 'kind' haalt de progressiegrens niet; de rest wel
    progressieMag: (h) => !/^kind/.test(h),
    GEEN_PROGRESSIE: 'Scores en ranglijsten bestaan alleen voor leden met een geverifieerde volwassen leeftijd.',
    vandaag: () => datum
  });
  return { laag, bak, zetDatum: (d) => { datum = d; } };
}
// het geheim van vandaag opzoeken; alleen de toets mag dat, de speler nooit
const geheimVan = (bak, datum, spel = 'proef') => bak.spellen.dagopgave[spel][datum].geheim;

test('een spel zonder dagopgave heeft er ook geen, langs alle drie de ingangen', () => {
  const { laag } = maakLaag();
  for (const r of [laag.dagStand('anna', 'kaal', []), laag.dagStart('anna', 'kaal'),
    laag.dagKlaar('anna', 'kaal', 'wat dan ook')]) {
    assert.equal(r.status, 400);
    assert.match(r.error, /geen dagopgave/i);
  }
  assert.equal(laag.dagStart('anna', 'bestaatniet').status, 400);
});

test('kijken start geen klok en maakt de opgave niet eens aan', () => {
  /* Zonder dit verschil kost een blik op het bord je tijd, en dat is precies
     het soort straf waar een dagopgave niet over hoort te gaan. */
  const { laag, bak } = maakLaag();
  const stand = laag.dagStand('anna', 'proef', []);
  assert.equal(stand.begonnen, false);
  assert.equal(stand.opgave, undefined, 'de opgave reist niet mee voor wie nog niet begon');
  assert.deepEqual(bak.spellen.dagopgave.proef, {}, 'er is nog geen opgave gemaakt');

  laag.dagStart('anna', 'proef');
  assert.ok(bak.spellen.dagopgave.proef['2026-08-11'], 'starten maakt hem wel aan');
});

test('iedereen krijgt vandaag dezelfde opgave', () => {
  const { laag } = maakLaag();
  const a = laag.dagStart('anna', 'proef');
  const b = laag.dagStart('boris', 'proef');
  assert.deepEqual(a.opgave, b.opgave, 'twee spelers, twee opgaven -- dan valt er niets te vergelijken');
  assert.equal(a.datum, b.datum);
});

test('twee keer starten zet de klok niet terug', () => {
  /* Zou hij dat wel doen, dan is "nog een keer starten" een knop die je tijd
     terugzet en meet het bord niets meer.

     De klok gaat hier eerst een minuut ACHTERUIT, en dat is geen versiering:
     zonder die sprong vallen twee starts achter elkaar in dezelfde
     milliseconde, en dan slaagt de vergelijking ook als de klok wel degelijk
     opnieuw gezet wordt. Zo'n toets zag ik hier ook echt slagen. */
  const { laag, bak } = maakLaag();
  const een = laag.dagStart('anna', 'proef');
  bak.spellen.dagopgave.proef['2026-08-11'].spelers.anna.start -= 60000;

  const twee = laag.dagStart('anna', 'proef');
  assert.equal(twee.gestart, een.gestart - 60000, 'de start is verzet');
  assert.deepEqual(twee.opgave, een.opgave);
  const klaar = laag.dagKlaar('anna', 'proef', geheimVan(bak, '2026-08-11'));
  assert.ok(klaar.seconden >= 60, 'en de gemeten tijd loopt vanaf de eerste start: ' + klaar.seconden);
});

test('inleveren zonder te beginnen levert niets op', () => {
  const { laag, bak } = maakLaag();
  laag.dagStart('boris', 'proef');                      // de opgave van vandaag bestaat
  const r = laag.dagKlaar('anna', 'proef', geheimVan(bak, '2026-08-11'));
  assert.equal(r.status, 409);
  assert.match(r.error, /nog niet begonnen/i);
});

test('fout ingevuld is geen straf: de opgave blijft staan en de klok loopt door', () => {
  const { laag, bak } = maakLaag();
  laag.dagStart('anna', 'proef');
  const mis = laag.dagKlaar('anna', 'proef', 'sesam-open-u');
  assert.equal(mis.goed, false);
  assert.equal(mis.punten, undefined);
  const goed = laag.dagKlaar('anna', 'proef', geheimVan(bak, '2026-08-11'));
  assert.equal(goed.goed, true, 'daarna gewoon verder kunnen');
});

test('een inzending die het spel afkeurt komt terug als fout van de client', () => {
  const { laag } = maakLaag();
  laag.dagStart('anna', 'proef');
  const r = laag.dagKlaar('anna', 'proef', null);
  assert.equal(r.status, 400);
  assert.match(r.error, /antwoord/i);
});

test('een opgave doe je een keer per dag', () => {
  const { laag, bak } = maakLaag();
  laag.dagStart('anna', 'proef');
  assert.equal(laag.dagKlaar('anna', 'proef', geheimVan(bak, '2026-08-11')).goed, true);
  const weer = laag.dagKlaar('anna', 'proef', geheimVan(bak, '2026-08-11'));
  assert.equal(weer.status, 409);
  assert.equal(laag.dagStart('anna', 'proef').status, 409, 'en opnieuw beginnen kan ook niet');
});

test('een haak die zich vergist kan het bord niet omgooien', () => {
  /* De puntengrens uit de descriptor is ook hier de bovenkant. Het spel rekent
     de punten, maar het spel is niet de laatste die er iets over te zeggen
     heeft: een rekenfout in een haak hoort een dagbord niet onbruikbaar te
     kunnen maken. */
  const { laag, bak } = maakLaag();
  laag.dagStart('anna', 'gulzig');
  const r = laag.dagKlaar('anna', 'gulzig', geheimVan(bak, '2026-08-11', 'gulzig'));
  assert.equal(r.goed, true);
  assert.equal(r.punten, 50, 'tien keer de grens hoort op de grens uit te komen');
  assert.equal(bak.spellen.dagopgave.gulzig['2026-08-11'].spelers.anna.punten, 50, 'en zo staat hij ook in het bord');
});

test('het bord noemt je kring bij naam, en je plaats gaat over het hele veld', () => {
  /* Dit is het besluit dat deze laag maakt en dat zichtbaar hoort te blijven:
     de WEDSTRIJD is tegen iedereen (mee, plaats), de NAMENLIJST is je eigen
     kring. Een lijst met codenamen van vreemden is een sociale laag die dit
     huis nergens anders heeft. */
  const { laag, bak } = maakLaag();
  const geheim = () => geheimVan(bak, '2026-08-11');
  // vier spelers; anna is de traagste van de vier, boris haar vriend
  for (const h of ['snel', 'boris', 'vreemde', 'anna']) laag.dagStart(h, 'proef');
  const dag = bak.spellen.dagopgave.proef['2026-08-11'];
  const tijden = { snel: 5, boris: 20, vreemde: 30, anna: 60 };
  for (const [h, s] of Object.entries(tijden)) {
    dag.spelers[h].start = Date.now() - s * 1000;
    laag.dagKlaar(h, 'proef', geheim());
  }

  const stand = laag.dagStand('anna', 'proef', ['boris']);
  assert.equal(stand.mee, 4, 'iedereen die hem oploste telt mee in het veld');
  assert.equal(stand.plaats, 4, 'anna was de traagste van de vier');
  assert.deepEqual(stand.bord.map(r => r.codenaam), ['CN-boris', 'CN-anna'],
    'alleen de eigen kring staat er bij naam, in de volgorde van het veld');
  assert.deepEqual(stand.bord.map(r => r.plaats), [2, 4], 'met hun echte plaats, niet 1 en 2');
  assert.equal(stand.bord.find(r => r.ik).codenaam, 'CN-anna');
  assert.ok(stand.bord[0].punten > stand.bord[1].punten, 'sneller is meer punten');
});

test('onder de progressiegrens: gewoon spelen, niets bewaard, en niet in het veld', () => {
  const { laag, bak } = maakLaag();
  const geheim = () => geheimVan(bak, '2026-08-11');
  laag.dagStart('anna', 'proef');
  laag.dagKlaar('anna', 'proef', geheim());

  const start = laag.dagStart('kind-mila', 'proef');
  assert.ok(start.opgave, 'meedoen mag gewoon');
  const r = laag.dagKlaar('kind-mila', 'proef', geheim());
  assert.equal(r.goed, true, 'goed is goed, ook onder de grens');
  assert.ok(r.punten > 0, 'en je hoort wat het waard was');
  assert.equal(r.bewaard, false);
  assert.equal(r.ranglijst, false);
  assert.equal(r.plaats, undefined, 'geen plaats, want geen bord');
  assert.match(r.reden, /volwassen leeftijd/i);

  const dag = bak.spellen.dagopgave.proef['2026-08-11'];
  assert.equal(dag.spelers['kind-mila'].punten, undefined, 'er is geen getal weggeschreven');
  assert.equal(dag.spelers['kind-mila'].klaar, true, 'wel dat de opgave van vandaag gedaan is');

  const stand = laag.dagStand('kind-mila', 'proef', []);
  assert.equal(stand.ranglijst, false, 'het bord bestaat niet, en is niet "leeg"');
  assert.deepEqual(stand.bord, []);
  assert.equal(stand.mee, 1, 'hoeveel mensen hem oplosten gaat over de dag en niet over een persoon');
  assert.equal(laag.dagStand('anna', 'proef', []).mee, 1, 'en de minderjarige telt niet mee in het veld');
});

test('morgen is een nieuwe opgave, en gisteren is helemaal weg', () => {
  /* Geen seizoen, geen historie: zonder dit wissen ligt er een alletijden-
     dagbord waar een reeks alsnog uit af te leiden valt. */
  const { laag, bak, zetDatum } = maakLaag();
  laag.dagStart('anna', 'proef');
  const gisteren = bak.spellen.dagopgave.proef['2026-08-11'].opgave;
  laag.dagKlaar('anna', 'proef', geheimVan(bak, '2026-08-11'));

  zetDatum('2026-08-12');
  const morgen = laag.dagStart('anna', 'proef');
  assert.equal(morgen.datum, '2026-08-12');
  assert.notDeepEqual(morgen.opgave, gisteren, 'een nieuwe dag, een nieuwe opgave');
  assert.deepEqual(Object.keys(bak.spellen.dagopgave.proef), ['2026-08-12'], 'gisteren is gewist, opgave en al');
  assert.equal(laag.dagStand('anna', 'proef', []).mee, 0, 'het bord begint leeg');
});

test('de opruiming haalt gisteren ook weg als er niemand meer komt', () => {
  const { laag, bak, zetDatum } = maakLaag();
  laag.dagStart('anna', 'proef');
  zetDatum('2026-09-01');
  laag.dagOpschonen(Date.now());
  assert.deepEqual(bak.spellen.dagopgave.proef, {}, 'een dag die niemand meer opent blijft niet liggen');
});

test('een verwijderd lid laat niets achter in een dagopgave', () => {
  const { laag, bak } = maakLaag();
  laag.dagStart('anna', 'proef');
  laag.dagStart('boris', 'proef');
  laag.dagKlaar('anna', 'proef', geheimVan(bak, '2026-08-11'));
  laag.dagVergeet('anna');
  const dag = bak.spellen.dagopgave.proef['2026-08-11'];
  assert.equal(dag.spelers.anna, undefined);
  assert.ok(dag.spelers.boris, 'vergeten is niet leegvegen');
  assert.equal(laag.dagStand('boris', 'proef', []).mee, 0, 'en zijn score telt nergens meer mee');
});

test('er bestaat nergens een reeks, en er is ook geen veld waar er een in past', () => {
  /* De duidelijkste vorm van de ratel die CLAUDE.md uit dit huis houdt: "vijf
     dagen op rij" straft je voor de dag dat je niet meedoet. Deze toets kijkt
     naar de OPSLAG en naar de ANTWOORDEN, want een teller die alleen intern
     bijgehouden wordt is precies zo'n veld dat later "toch even" getoond wordt. */
  const { laag, bak, zetDatum } = maakLaag();
  const antwoorden = [];
  for (const datum of ['2026-08-11', '2026-08-12', '2026-08-13']) {
    zetDatum(datum);
    antwoorden.push(laag.dagStart('anna', 'proef'));
    antwoorden.push(laag.dagKlaar('anna', 'proef', geheimVan(bak, datum)));
    antwoorden.push(laag.dagStand('anna', 'proef', []));
  }
  const RATEL = /reeks|streak|op\s*rij|achtereen|dagen\s*achter|serie/i;
  assert.equal(RATEL.test(JSON.stringify(antwoorden)), false, 'er reist een reeks mee in een antwoord');
  assert.equal(RATEL.test(JSON.stringify(bak.spellen.dagopgave)), false, 'er wordt een reeks bewaard');
  const mijn = bak.spellen.dagopgave.proef['2026-08-13'].spelers.anna;
  assert.deepEqual(Object.keys(mijn).sort(), ['at', 'klaar', 'punten', 'seconden', 'start'],
    'er staat een veld in het dagrecord dat er niet hoorde: ' + JSON.stringify(mijn));
});

test('deze laag kan niemand een duwtje geven, want hij heeft er de bedrading niet voor', () => {
  /* "Geen melding dat de opgave verloopt" is hier geen vergeten optie maar een
     ontbrekende draad: dag.js krijgt `nudge` niet binnen en noemt hem nergens.
     Zolang dat zo is valt er niets aan te zetten. */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'spellen', 'dag.js'), 'utf8');
  const code = bron.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const woord of ['nudge', 'sseToCustomer', 'notify', 'herinner'])
    assert.equal(new RegExp('\\b' + woord + '\\b').test(code), false,
      'dag.js kan nu een melding sturen over de dagopgave (' + woord + ')');
  // en de bedrading geeft hem ook niet mee
  const rondom = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'spellen', 'rondom.js'), 'utf8');
  const aanroep = rondom.slice(rondom.indexOf("require('./dag')"));
  assert.equal(/nudge/.test(aanroep.slice(0, 200)), false, 'rondom.js geeft dag.js een nudge mee');
});

/* ================= over de echte weg, met de echte sudoku ================= */

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dag-'));
let child, teller = 0;

const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const json = (r) => r.json();
const api = (actie, body, token) => raw('/member/spel/' + actie, body, token);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

async function lid(geboren = '1990-01-01') {
  const t = Date.now() + '' + (teller++);
  const r = await json(await raw('/auth/register', { name: 'Dag ' + t, email: 'dg' + t + '@v.test',
    phone: '0644' + String(t).slice(-6), password: 'geheim123', geboortedatum: geboren, tier: 'rtg' }));
  assert.ok(r.token, 'aanmelden lukte niet: ' + JSON.stringify(r).slice(0, 200));
  return r.token;
}
// een eigen oplosser, zodat de toets de code onder toets niet gebruikt om
// zichzelf gelijk te geven
function los(puzzel) {
  const g = puzzel.slice();
  const mag = (i, v) => {
    const r = Math.floor(i / 9), k = i % 9;
    for (let j = 0; j < 9; j++) if (g[r * 9 + j] === v || g[j * 9 + k] === v) return false;
    const br = r - r % 3, bk = k - k % 3;
    for (let rr = 0; rr < 3; rr++) for (let kk = 0; kk < 3; kk++) if (g[(br + rr) * 9 + bk + kk] === v) return false;
    return true;
  };
  const zoek = () => {
    const i = g.indexOf(0);
    if (i === -1) return true;
    for (let v = 1; v <= 9; v++) if (mag(i, v)) { g[i] = v; if (zoek()) return true; g[i] = 0; }
    return false;
  };
  return zoek() ? g : null;
}

test('de drie dag-ingangen zitten achter de ledenpoort', async () => {
  /* Voluit, want de dekkingsmeter (scripts/keuring.js) zoekt letterlijke paden
     in de toetstekst en het hulpje hierboven plakt ze samen. */
  for (const pad of ['/api/member/spel/dag', '/api/member/spel/dag-start', '/api/member/spel/dag-klaar']) {
    const r = await fetch(BASE + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spel: 'sudoku' }) });
    assert.equal(r.status, 401, pad + ' hoort een token te vragen');
  }
});

test('de dagpuzzel is voor iedereen dezelfde, en de oplossing verlaat de server niet', async () => {
  const a = await lid(), b = await lid();
  const eerste = await json(await api('dag-start', { spel: 'sudoku' }, a));
  const tweede = await json(await api('dag-start', { spel: 'sudoku' }, b));
  assert.deepEqual(eerste.opgave.puzzel, tweede.opgave.puzzel, 'twee leden, twee puzzels');
  assert.equal(eerste.opgave.puzzel.length, 81);

  /* De hele opbrengst hangt hieraan: staat de oplossing ergens in een antwoord
     -- ook onder een andere naam -- dan is alle narekening theater. Daarom niet
     op veldnaam kijken maar op INHOUD. */
  const opgelost = los(eerste.opgave.puzzel);
  const stand = await json(await api('dag', { spel: 'sudoku' }, a));
  for (const [naam, d] of [['dag-start', eerste], ['dag', stand]]) {
    const plat = JSON.stringify(d);
    assert.equal(plat.includes(JSON.stringify(opgelost)), false, naam + ': de oplossing zit in het antwoord');
  }
});

test('een opgeloste dagpuzzel levert punten van de server, en een plaats in het veld', async () => {
  const tok = await lid();
  const start = await json(await api('dag-start', { spel: 'sudoku' }, tok));
  const opgelost = los(start.opgave.puzzel);
  // even wachten: zonder pauze zijn "de klok van de server" en "de nul uit de
  // client" niet uit elkaar te houden
  await new Promise(r => setTimeout(r, 1200));

  const r = await json(await api('dag-klaar', { spel: 'sudoku', inzending: opgelost, seconden: 0, punten: 999999 }, tok));
  assert.equal(r.goed, true);
  assert.equal(r.bewaard, true);
  assert.ok(r.seconden >= 1, 'de tijd is die van de server: ' + r.seconden);
  assert.ok(r.punten > 0 && r.punten <= 500, 'de punten liggen binnen de puntengrens: ' + r.punten);
  assert.ok(r.plaats >= 1 && r.plaats <= r.mee);

  const stand = await json(await api('dag', { spel: 'sudoku' }, tok));
  assert.equal(stand.klaar, true);
  assert.equal(stand.punten, r.punten);
  assert.equal(stand.opgave, undefined, 'wie klaar is krijgt de puzzel niet nog eens');
  assert.equal((stand.bord.find(x => x.ik) || {}).punten, r.punten, 'en je staat op je eigen bord');
});

test('de dagpuzzel loopt niet langs arcade-score, en een tweede keer inleveren kan niet', async () => {
  const tok = await lid();
  const start = await json(await api('dag-start', { spel: 'sudoku' }, tok));
  assert.equal((await json(await api('dag-klaar', { spel: 'sudoku', inzending: los(start.opgave.puzzel) }, tok))).goed, true);
  assert.equal((await api('dag-klaar', { spel: 'sudoku', inzending: los(start.opgave.puzzel) }, tok)).status, 409);
  // en het gewone arcade-pad blijft dicht voor sudoku
  assert.equal((await api('arcade-score', { spel: 'sudoku', punten: 999999 }, tok)).status, 400);
});

test('een spel zonder dagopgave heeft er ook over de route geen', async () => {
  const tok = await lid();
  for (const spel of ['sneek', 'tetris', 'schaak', '']) {
    const r = await api('dag-start', { spel }, tok);
    assert.equal(r.status, 400, spel + ' hoort geen dagopgave te hebben');
  }
});

test('onder de 18+-grens loopt de dagpuzzel gewoon, alleen zonder bord', async () => {
  const tok = await lid('2010-01-01');
  const start = await json(await api('dag-start', { spel: 'sudoku' }, tok));
  assert.equal(start.opgave.puzzel.length, 81, 'meedoen mag gewoon');
  const r = await json(await api('dag-klaar', { spel: 'sudoku', inzending: los(start.opgave.puzzel) }, tok));
  assert.equal(r.goed, true);
  assert.equal(r.bewaard, false);
  assert.match(r.reden, /volwassen leeftijd/i);
  const stand = await json(await api('dag', { spel: 'sudoku' }, tok));
  assert.equal(stand.ranglijst, false);
  assert.deepEqual(stand.bord, []);
});
