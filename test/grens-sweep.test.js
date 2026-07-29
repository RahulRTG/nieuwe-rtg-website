/* ============================================================================
   DE GRENS-SWEEP -- elk endpoint een keer echt aangeroepen, met twee harde eisen.

   WAT DIT WEL IS

   Er zijn ruim duizend endpoints die in geen enkele test voorkwamen. Ze stuk
   voor stuk een eigen gedragstest geven is maanden werk; die tests komen ook,
   domein voor domein. Maar tot die tijd hoort er een VLOER te liggen, en die
   vloer toetst de twee dingen die overal fout kunnen gaan:

     1. GEEN 500. Een onverwachte serverfout betekent dat er invoer doorheen
        kwam waar de code niet op gebouwd is. Dat is op zichzelf een bug, en het
        antwoord van een 500 bevat vaak meer dan de bedoeling was.

     2. GEEN KLUISGEGEVENS VAN EEN ANDER. We roepen elk endpoint aan als lid B,
        met de identifiers van lid A in de body. Komt de ECHTE NAAM of het
        e-mailadres van A terug, dan is de scheiding lek. Dat zijn precies de
        velden die in de kluis horen te blijven (accounts/kluis.js); de codenaam
        toetsen we met opzet niet, want die is juist bedoeld om gedeeld te worden.

   WAT DIT NIET IS

   Geen vervanging voor echte tests. Een endpoint dat hier netjes 400 teruggeeft,
   kan nog steeds het verkeerde doen als je het goed aanroept. De sweep bewijst
   dat de deur niet openstaat en dat er niets omvalt -- niet dat de kamer klopt.

   Waarom aanroepen als LID en niet anoniem: anoniem doet scripts/poortwacht.js
   al, en die meldt zelf dat het maar een klasse fouten dekt ("een route die 401
   geeft kan tussen twee ingelogde leden nog steeds lekken"). Dit is die tweede
   klasse.

   Draai los: node --experimental-sqlite --test test/grens-sweep.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { startServer, stop } = require('./helper');

const WORTEL = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sweep-'));
let srv, base, A, B;

/* De identiteit van A is met opzet opvallend: als hij ergens uit een antwoord
   valt, zie je het meteen en kan het geen toeval zijn. */
const A_NAAM = 'Alfa Kluisnaam Zeldzaam';
const A_MAIL_LOKAAL = 'alfa-kluis-zeldzaam';

const routekaart = () => JSON.parse(execFileSync(process.execPath,
  ['--experimental-sqlite', path.join(WORTEL, 'scripts/routekaart.js'), '--json'],
  { cwd: WORTEL, encoding: 'utf8', timeout: 180000, maxBuffer: 64 * 1024 * 1024 })).routes || [];

async function nieuwLid(naam, mailLokaal, n) {
  const u = (Date.now() + n * 7919).toString().slice(-9);
  const email = (mailLokaal || 'sweep' + u) + '@x.nl';
  const r = await fetch(base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: naam, email, phone: '06' + u.slice(0, 8),
      password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
  }).then(x => x.json());
  assert.ok(r.token, 'lid ' + naam + ' geregistreerd');
  const st = (r.state && r.state.user) || {};
  return { token: r.token, email, naam, codenaam: st.codename, id: st.id };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-SWEEP' } });
  base = srv.base;
  A = await nieuwLid(A_NAAM, A_MAIL_LOKAAL, 1);
  B = await nieuwLid('Beta Bezoeker', null, 2);
  assert.notEqual(A.token, B.token, 'twee verschillende leden');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* Een body met alles wat een endpoint aan A zou kunnen koppelen. Ruim genomen:
   we weten per endpoint niet welk veld hij leest, dus vullen we ze allemaal.

   MAAR: de echte naam en het e-mailadres van A zitten er MET OPZET NIET in.

   Eerst stonden ze er wel, en toen sloeg test 2 aan op vijf endpoints -- die
   bleken alle vijf gewoon terug te geven wat er was meegestuurd (richt een
   genootschap op met naam X, en X komt terug). Dat is geen lek maar een echo,
   en een test die daarop afgaat roept "brand" bij een spiegel.

   Door A's kluisvelden buiten het verzoek te houden, kan hun aanwezigheid in
   een antwoord nog maar EEN oorsprong hebben: de kluis. Dan is de bewering
   scherp. Verwijzen naar A gebeurt zoals het hoort -- op id en codenaam. */
function bodyMetA() {
  return {
    id: A.id, ref: A.id, userId: A.id, memberId: A.id, lid: A.id,
    code: A.codenaam, codenaam: A.codenaam, key: A.codenaam,
    naam: 'Sweep Invoer', name: 'Sweep Invoer',
    iban: 'NL01RTGB0000000001', bedrag: 1, centen: 1, euro: 1,
    tekst: 'sweep', text: 'sweep', bericht: 'sweep', datum: '2026-08-01', dag: '2026-08-01'
  };
}

const vulPad = (pad) => pad.replace(/:([A-Za-z0-9_]+)/g, encodeURIComponent(String(A.codenaam || 'x')));

async function klop(pad, methode, token) {
  const opt = {
    method: methode === 'ALL' || !methode ? 'POST' : methode,
    headers: { Authorization: 'Bearer ' + token }, redirect: 'manual'
  };
  if (opt.method !== 'GET' && opt.method !== 'HEAD') {
    opt.headers['Content-Type'] = 'application/json';
    opt.body = JSON.stringify(bodyMetA());
  }
  try {
    const r = await fetch(base + vulPad(pad), opt);
    return { status: r.status, tekst: (await r.text()).slice(0, 4000) };
  } catch (e) { return { status: 0, tekst: 'NETWERKFOUT: ' + e.message }; }
}

/* De routes die nog in geen enkele test voorkomen -- precies de lijst waar deze
   sweep voor bestaat. De rest heeft al een eigen test en hoeft hier niet nog
   eens langs. */
function ongedekteRoutes() {
  const testTekst = fs.readdirSync(path.join(WORTEL, 'test'))
    .filter(f => f.endsWith('.js') && f !== 'grens-sweep.test.js')
    .map(f => fs.readFileSync(path.join(WORTEL, 'test', f), 'utf8')).join('\n');
  const gedekt = (r) => {
    if (testTekst.includes(r)) return true;
    const s = r.slice(5);
    return testTekst.includes("'" + s + "'") || testTekst.includes('"' + s + '"') || testTekst.includes('`' + s + '`');
  };
  const gezien = new Set();
  const uit = [];
  for (const r of routekaart()) {
    const pad = r.pad || r.path;
    if (!pad || !pad.startsWith('/api/') || gezien.has(pad)) continue;
    gezien.add(pad);
    if (gedekt(pad)) continue;
    /* Deze twee zetten de server bewust stil of gooien alles weg -- daar heeft
       een sweep niets te zoeken, en de eigen tests dekken ze. */
    if (/\/(afsluiten|noodstop|shutdown|wis-alles)$/.test(pad)) continue;
    uit.push({ pad, methode: r.methode || r.method });
  }
  return uit;
}

/* De sweep draait in blokken: duizend gelijktijdige verzoeken zetten je eigen
   server vast, en dan meet je de wachtrij in plaats van de code. */
async function sweep(routes, token) {
  const BLOK = 16;
  const uit = [];
  for (let i = 0; i < routes.length; i += BLOK) {
    const deel = routes.slice(i, i + BLOK);
    const r = await Promise.all(deel.map(x => klop(x.pad, x.methode, token)));
    for (let j = 0; j < deel.length; j++) uit.push({ ...deel[j], ...r[j] });
  }
  return uit;
}

let uitslag = null;
async function eenmaligSweepen() {
  if (!uitslag) uitslag = await sweep(ongedekteRoutes(), B.token);
  return uitslag;
}

test('1. geen enkel endpoint valt om (geen 500) op een ingelogd verzoek', async () => {
  /* Een 500 betekent: er kwam invoer doorheen waar de code niet op gebouwd is.
     400 en 403 zijn prima -- dat is de code die NEE zegt. 429 ook: dat is de
     rem, en die hoort te werken. */
  const r = await eenmaligSweepen();
  assert.ok(r.length > 200, 'de sweep heeft daadwerkelijk een grote lijst gelopen (' + r.length + ')');
  const omgevallen = r.filter(x => x.status >= 500 || x.status === 0)
    .map(x => x.pad + ' -> ' + x.status + ' ' + x.tekst.slice(0, 120));
  assert.deepEqual(omgevallen, [],
    'deze endpoints vallen om op een gewoon ingelogd verzoek met onzin erin:\n  ' + omgevallen.join('\n  '));
});

test('2. DE KLUIS BLIJFT DICHT: de echte naam van A komt nergens bij B terug', async () => {
  /* Dit is de kern. Het hele codenaam-ontwerp staat of valt hiermee: de echte
     naam en het e-mailadres liggen versleuteld in de kluis en horen NOOIT in
     een antwoord aan iemand anders te belanden -- ook niet als die iemand het
     id van A netjes in zijn verzoek zet. */
  const r = await eenmaligSweepen();
  const lek = r.filter(x => x.tekst.includes(A_NAAM) || x.tekst.includes(A.email))
    .map(x => x.pad + ' -> ' + x.status);
  assert.deepEqual(lek, [],
    'deze endpoints geven de echte naam of het e-mailadres van een ANDER lid terug:\n  ' + lek.join('\n  '));
});

test('3. geen enkel endpoint lekt een wachtwoordhash of een kluisveld', async () => {
  const r = await eenmaligSweepen();
  const lek = r.filter(x => /"password_hash"|"enc_name"|"enc_email"|"reset_hash"|scrypt/.test(x.tekst))
    .map(x => x.pad + ' -> ' + x.status);
  assert.deepEqual(lek, [], 'ruwe kolommen uit de accountstabel horen nooit naar buiten:\n  ' + lek.join('\n  '));
});

test('4. een foutmelding vertelt niet waar de code staat', async () => {
  /* Een stacktrace of een pad uit onze broncode in het antwoord is verkenning
     die je een aanvaller cadeau geeft. server/log.js vangt dit af met een nette
     500 + id; deze test bewaakt dat het zo blijft. */
  const r = await eenmaligSweepen();
  const lek = r.filter(x => /\/home\/|\/server\/[a-z]+\.js|at Object\.|node_modules/.test(x.tekst))
    .map(x => x.pad + ' -> ' + x.tekst.slice(0, 160));
  assert.deepEqual(lek, [], 'deze antwoorden bevatten een pad of stacktrace uit onze code:\n  ' + lek.join('\n  '));
});

test('5. de sweep raakt echt de domeinen waar de gaten zaten', async () => {
  /* Zonder deze controle zou de sweep stilletjes leeg kunnen lopen (bijvoorbeeld
     omdat de routekaart niet meer gelezen wordt) en zouden de tests hierboven
     groen staan zonder iets te hebben gedaan. */
  const r = await eenmaligSweepen();
  const per = {};
  for (const x of r) { const d = x.pad.split('/')[2]; per[d] = (per[d] || 0) + 1; }
  for (const domein of ['member', 'foundation', 'supplier', 'rtf', 'office'])
    assert.ok((per[domein] || 0) >= 20,
      'te weinig endpoints van "' + domein + '" in de sweep (' + (per[domein] || 0) + ')');
});
