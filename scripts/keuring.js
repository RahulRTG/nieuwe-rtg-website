/* ============================================================================
   DE KEURING -- het logica-oordeel over het systeem als geheel.

   Een testsuite bewijst dat elk onderdeel doet wat het belooft. Dat is niet
   hetzelfde als: klopt het geheel. Twee endpoints die hetzelfde doen met een
   ander antwoord, een genre dat een functie mist die alle vergelijkbare
   genres wel hebben, een tekst die meer belooft dan de code waarmaakt, een
   module die nergens meer wordt aangeroepen -- daar struikelt geen enkele
   test over, en toch is het fout.

   De Keuring leest de codebase en de echte routetabel, en velt drie soorten
   oordeel:
     STUK    -- dit is een fout; de Slotsuite zakt erop.
     SCHEEF  -- dit is inconsistent; het hoort op de backlog.
     BETER   -- dit kan beter; het hoort op de backlog, lagere prioriteit.

   Geen enkele check raadt. Wat de Keuring niet zeker weet, meldt zij als
   vermoeden met de reden erbij, zodat een mens het kan wegen.

   Draai los: node --experimental-sqlite scripts/keuring.js
              node --experimental-sqlite scripts/keuring.js --json  */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const bevindingen = [];
const meld = (soort, groep, tekst, waar, hoe) =>
  bevindingen.push({ soort, groep, tekst, waar: waar || null, hoe: hoe || null });

/* ---------- de bestanden waar we naar kijken ---------- */
function loop(dir, uit) {
  uit = uit || [];
  let items = [];
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return uit; }
  for (const it of items) {
    if (it.name === 'node_modules' || it.name === '.git' || it.name === 'data') continue;
    const p = path.join(dir, it.name);
    if (it.isDirectory()) loop(p, uit);
    else uit.push(p);
  }
  return uit;
}
const alle = loop(WORTEL);
const serverJs = alle.filter(p => p.includes('/server/') && p.endsWith('.js'));
const testJs = alle.filter(p => p.includes('/test/') && p.endsWith('.js'));
const publicHtml = alle.filter(p => p.includes('/public/') && p.endsWith('.html'));
const publicJs = alle.filter(p => p.includes('/public/') && p.endsWith('.js') && !p.endsWith('.min.js'));
const lees = p => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };
const kort = p => path.relative(WORTEL, p);

/* Bouwsel is geen bron. public/dist/** is geminificeerd, en public/apps/x.js
   is de samengeplakte versie van public/apps/x/NN-*.js. Een melding op een
   bouwsel is dezelfde melding drie keer; we kijken alleen naar de bron. */
const isBouwsel = p => p.includes('/public/dist/') ||
  (/\/public\/apps\/[^/]+\.js$/.test(p) && fs.existsSync(p.replace(/\.js$/, '')));

/* Alleen wat de gebruiker echt te zien krijgt telt mee: tekst tussen
   aanhalingstekens, op regels die geen commentaar zijn. Een regel die het
   verbod juist uitlegt, is geen overtreding van het verbod. */
function zinnen(tekst) {
  const uit = [];
  let inBlok = false;
  for (const regel of String(tekst).split('\n')) {
    const t = regel.trim();
    if (inBlok) { if (t.includes('*/')) inBlok = false; continue; }
    if (t.startsWith('/*')) { if (!t.includes('*/')) inBlok = true; continue; }
    if (t.startsWith('//') || t.startsWith('*')) continue;
    const re = /'([^'\\\n]{4,})'|"([^"\\\n]{4,})"|`([^`\\\n]{4,})`/g;
    let m;
    while ((m = re.exec(regel))) uit.push(m[1] || m[2] || m[3]);
  }
  return uit;
}

/* ============================ 1. DEKKING ============================
   Elke route die de server echt registreert, hoort ergens in de tests
   voor te komen. Wat nergens wordt aangeraakt, is niet bewezen. */
function dekking() {
  let routes = [];
  try {
    const uit = execFileSync(process.execPath, ['--experimental-sqlite', path.join(__dirname, 'routekaart.js'), '--json'],
      { cwd: WORTEL, encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024 });
    const d = JSON.parse(uit);
    routes = (d.routes || d || []).map(r => (typeof r === 'string' ? r : r.pad || r.path)).filter(Boolean);
  } catch (e) {
    meld('beter', 'dekking', 'De routekaart kon niet worden gelezen, dus de dekking is niet gemeten.', 'scripts/routekaart.js', String(e.message || e).slice(0, 120));
    return { routes: 0, gedekt: 0 };
  }
  const testTekst = testJs.map(lees).join('\n');
  const apiRoutes = routes.filter(r => r.startsWith('/api/'));

  /* EEN ROUTE HEET IN EEN TEST NIET ALTIJD ZOALS HIJ IN DE ROUTEKAART HEET.

     Bijna elke testfile heeft bovenaan een helper van deze vorm:

         const api = (pad, body, token) => fetch(base + '/api/' + pad, ...)
         await api('bank/overzicht', {}, lid.token)

     De letterlijke string '/api/bank/overzicht' staat dan NERGENS in het
     bestand, terwijl die route wel degelijk wordt aangeroepen. Zoeken op alleen
     de volledige route telde 187 routes als ongedekt die het niet zijn -- ruim
     zeven procentpunt, en het stuurde elke ronde werk naar endpoints die allang
     getest waren.

     Daarom kijken we ook naar de afgeknipte vorm, tussen aanhalingstekens. Die
     eis is streng met opzet: `'bank/overzicht'` als losse string is een
     aanroep, terwijl bank/overzicht ergens in lopende tekst dat niet is.

     WAT DIT NOG STEEDS MIST: routes met een :param die een test opbouwt met
     string-plakwerk (`'leden/' + id`). Die blijven als ongedekt tellen. Dat is
     een onderschatting en geen overschatting -- de goede kant om te missen.

     EN DIT BLIJFT EEN BENADERING. Een tekstzoektocht zit er twee kanten op
     naast: hij mist elke suite die zijn routes via een hulpje in twee stappen
     opbouwt (`rh('cellier')` boven `'/api/member/rechterhand/' + pad` -- de hele
     Rechterhand-suite telde zo als ongetest), en hij telt een pad in een
     COMMENTAARREGEL gewoon mee, waardoor het cijfer met een zoek-en-vervang op
     te poetsen is zonder een enkele test te schrijven.

     Het echte cijfer komt daarom uit `scripts/dekking.js`: dat leest het
     journaal dat de server tijdens de testrun zelf schrijft (server/routelog.js).
     Wat daar in staat is aangeroepen. Deze teller blijft staan omdat hij snel is
     en geen suite hoeft te draaien -- maar hij is de indicatie, niet het bewijs. */
  function gedekt(route) {
    if (testTekst.includes(route)) return true;
    /* Ook de vorm MET leidende slash maar ZONDER /api-prefix. Dat is hoe een
       test hem schrijft als haar helper de prefix zelf plakt:
       `l.call('/member/boardroom/zetveel')`. Die endpoints werden geteld als
       ongedekt terwijl de test ze wel degelijk aanroept -- de teller keek naar
       de verkeerde vorm. Een indicatie die de goede gevallen mist, stuurt je
       naar werk dat al gedaan is. */
    const staart = route.slice(5);          // zonder '/api/'
    for (const vorm of [staart, '/' + staart]) {
      if (testTekst.includes("'" + vorm + "'") ||
          testTekst.includes('"' + vorm + '"') ||
          testTekst.includes('`' + vorm + '`')) return true;
    }
    return false;
  }
  const ongedekt = apiRoutes.filter(r => !gedekt(r));
  const pct = apiRoutes.length ? Math.round((apiRoutes.length - ongedekt.length) / apiRoutes.length * 100) : 100;
  if (pct < 60) meld('scheef', 'dekking', 'Minder dan zestig procent van de endpoints komt in een test voor (' + pct + '%).',
    null, 'Elke ronde een paar endpoints erbij is genoeg; begin bij de lijst hieronder.');
  // de twintig meest sprekende gaten, gegroepeerd per domein
  const perDomein = {};
  for (const r of ongedekt) { const d = r.split('/')[2] || 'overig'; (perDomein[d] = perDomein[d] || []).push(r); }
  for (const [d, lijst] of Object.entries(perDomein).sort((a, b) => b[1].length - a[1].length).slice(0, 8))
    meld('beter', 'dekking', 'Het domein "' + d + '" heeft ' + lijst.length + ' endpoint(s) zonder test.',
      lijst.slice(0, 5).join(', '), 'Neem er de volgende ronde twee of drie mee in een bestaande testfile.');
  return { routes: apiRoutes.length, gedekt: apiRoutes.length - ongedekt.length, pct, ongedekt };
}

/* ============================ 2. BELOFTES ============================
   Wat we NOOIT mogen beweren. Een tekst die zegt dat er betaald is, of dat
   een boeking verwerkt is, terwijl de code alleen iets klaarzet, is geen
   stijlfout maar een leugen tegen de gebruiker. */
const VERBODEN = [
  /* "is al betaald" valt hier bewust buiten: dat is een weigering bij dubbel
     betalen -- een stand melden mag altijd, iets belóven niet. */
  { re: /\b(is|zijn) betaald\b/i, waarom: 'zegt dat er betaald is' },
  { re: /betaling (is )?verwerkt/i, waarom: 'zegt dat een betaling verwerkt is' },
  { re: /\bgegarandeerd\b/i, waarom: 'belooft een garantie' },
  { re: /\bboeking (is )?bevestigd\b/i, waarom: 'claimt een bevestigde boeking' },
  { re: /\bverzekerd van\b/i, waarom: 'belooft zekerheid' },
  { re: /\b(Marriott|Hilton|Ritz|Four Seasons|Aman|KLM|Emirates|Lufthansa|Qatar Airways)\b/, waarom: 'noemt een echt merk als partner' }
];

/* GEWOGEN -- zinnen die op het eerste gezicht onder een verbod vallen, maar
   na lezen kloppen. Ze staan hier per bestand, met de reden erbij, zodat de
   uitzondering verantwoord is en niet stiekem. Dezelfde zin ergens anders
   komt gewoon weer boven water; dat is de bedoeling. */
const GEWOGEN = new Map([
  ['public/apps/app-main/app-main-48.js | Uw deel is betaald.',
    'bevestiging na een geslaagde betaling via /splits/betaal'],
  ['server/kern/fluister/acties.js | is betaald;',
    'staat pas in de zin nadat betaalRit() zonder fout is teruggekomen']
]);

function beloftes() {
  const teksten = serverJs.concat(publicHtml, publicJs).filter(p => !isBouwsel(p));
  let raak = 0, gewogen = 0;
  for (const p of teksten) {
    for (const zin of zinnen(lees(p))) {
      for (const v of VERBODEN) {
        const m = zin.match(v.re);
        if (!m) continue;
        if (/nooit|niet |geen |verboden|mag niet/i.test(zin)) continue;
        if (GEWOGEN.has(kort(p) + ' | ' + zin.trim())) { gewogen++; continue; }
        raak++;
        meld('scheef', 'beloftes', 'Een tekst ' + v.waarom + ': "' + zin.slice(0, 70) + '".', kort(p),
          'Schrijf op wat er echt gebeurt (klaargezet, gepland, aangevraagd), of weeg de zin en zet hem in GEWOGEN met de reden.');
      }
    }
  }
  return { gescand: teksten.length, raak, gewogen };
}

/* ============================ 3. PRIVACY ============================
   Twee harde regels van dit huis: klantdata draait op codenamen, en de
   interne zaakvlag 'zaak:CODE' is een vlag, geen naam. Beide mogen nooit
   in een antwoord staan. */
function privacy() {
  const routes = serverJs.filter(p => p.includes('/routes/'));
  let raak = 0;
  for (const p of routes) {
    const t = lees(p);
    // een antwoord dat rechtstreeks een echte naam uit de kluis meestuurt
    if (/res\.json\([^)]*\b(realName|echteNaam|volledigeNaam)\b/.test(t)) {
      raak++;
      meld('stuk', 'privacy', 'Een route stuurt een echte naam mee in het antwoord.', kort(p),
        'Stuur de codenaam; de echte naam hoort in de kluis en alleen via een geautoriseerde inzage.');
    }
    /* De zaakvlag als sleutel binnen de route is prima -- dat is precies waar
       hij voor is. Fout wordt het pas als hij ongefilterd het antwoord in
       gaat, dus we kijken alleen binnen een res.json(...). */
    for (const m of t.matchAll(/res\.json\(([\s\S]{0,400}?)\)\s*;/g)) {
      if (!/'zaak:'\s*\+/.test(m[1]) || /hostNaam|zaakNaam/.test(m[1])) continue;
      raak++;
      meld('stuk', 'privacy', 'Een route zet de interne zaakvlag ongefilterd in het antwoord.', kort(p),
        'Laat de vlag door hostNaam() of een gelijkwaardige vertaler lopen voordat hij het antwoord in gaat.');
    }
  }
  return { gescand: routes.length, raak };
}

/* ====================== 4. GENRE-PARITEIT ======================
   Als negen van de tien vergelijkbare genres een functie hebben en de
   tiende niet, is dat meestal vergeten, niet bedoeld. */
function pariteit() {
  const seed = alle.filter(p => p.includes('/kern/initdata/') || p.endsWith('seed.js'));
  const tekst = seed.map(lees).join('\n');
  const types = {};
  /* Genres worden op twee manieren neergezet: los toegewezen
     (db.data.supplierTypes.zzp = { ..., caps: [...] }) en als blok in een
     objectliteral (koffie: { ..., caps: [...] }). Beide vormen tellen mee. */
  for (const regel of tekst.split('\n')) {
    const c = regel.match(/caps:\s*\[([^\]]*)\]/);
    if (!c) continue;
    const naam = (regel.match(/supplierTypes\s*(?:\.|\[['"])([A-Za-z0-9_]+)/) ||
      regel.match(/^\s*([A-Za-z0-9_]+)\s*:\s*\{/) || [])[1];
    if (!naam) continue;
    const caps = c[1].split(',').map(s => s.replace(/['"\s]/g, '')).filter(Boolean);
    types[naam] = [...new Set((types[naam] || []).concat(caps))];
  }
  const namen = Object.keys(types);
  if (namen.length < 4) return { genres: namen.length };
  const telling = {};
  for (const g of namen) for (const c of types[g]) telling[c] = (telling[c] || 0) + 1;
  for (const [cap, n] of Object.entries(telling)) {
    if (n / namen.length < 0.7) continue; // alleen wat bijna overal zit
    const missen = namen.filter(g => !types[g].includes(cap));
    if (missen.length && missen.length <= 3)
      meld('scheef', 'pariteit', 'De functie "' + cap + '" zit bij ' + n + ' van de ' + namen.length + ' genres, maar niet bij: ' + missen.join(', ') + '.',
        null, 'Of het hoort er ook bij, of er is een reden -- zet die reden dan in de code, zodat het geen vergeten hoek blijft.');
  }
  return { genres: namen.length };
}

/* ====================== 5. DUBBELINGEN ======================
   Dezelfde functienaam in meerdere kernmodules is meestal een teken dat
   iets twee keer is gebouwd. */
function dubbelingen() {
  const perNaam = {};
  for (const p of serverJs.filter(x => x.includes('/kern/'))) {
    const t = lees(p);
    const re = /^\s*function\s+([a-zA-Z][a-zA-Z0-9_]{5,})\s*\(/gm;
    let m;
    while ((m = re.exec(t))) (perNaam[m[1]] = perNaam[m[1]] || new Set()).add(kort(p));
  }
  let n = 0;
  for (const [naam, waar] of Object.entries(perNaam)) {
    if (waar.size < 3) continue; // twee keer kan toeval zijn; drie keer is een patroon
    n++;
    meld('beter', 'dubbeling', 'De functie "' + naam + '" staat in ' + waar.size + ' kernmodules.',
      [...waar].slice(0, 4).join(', '), 'Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.');
  }
  return { patronen: n };
}

/* ====================== 6. ONGEBRUIKTE MODULES ====================== */
function ongebruikt() {
  const bronBestanden = alle.filter(p => (p.includes('/server/') || p.includes('/scripts/')) && p.endsWith('.js'));
  const bron = bronBestanden.map(lees).join('\n');

  /* Sommige mappen worden in hun geheel dynamisch geladen:
     require('./wereld/' + naam). Een naam zoeken heeft daar geen zin; de
     hele map is aangeroepen. We zoeken die mappen op en slaan ze over. */
  const dynamisch = new Set();
  for (const p of bronBestanden) {
    const re = /require\(\s*['"]([^'"]*\/)['"]\s*\+/g;
    let m;
    while ((m = re.exec(lees(p)))) dynamisch.add(path.resolve(path.dirname(p), m[1]));
  }

  const kandidaten = serverJs.filter(p => p.includes('/kern/') && !p.endsWith('index.js') &&
    !dynamisch.has(path.dirname(p)));
  let n = 0;
  for (const p of kandidaten) {
    const naam = path.basename(p, '.js');
    const map = path.basename(path.dirname(p));
    const re = new RegExp("require\\([^)]*['\"][^'\"]*(" + map + "/)?" + naam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"/]");
    if (!re.test(bron)) {
      n++;
      meld('scheef', 'dode code', 'De module wordt nergens aangeroepen.', kort(p),
        'Of hij hoort ergens ingehangen te worden, of hij mag weg. Beide is beter dan blijven staan.');
    }
  }
  return { onaangeroepen: n };
}

/* ====================== 7. I18N-GATEN ======================
   Elke NL-sleutel hoort een EN-tegenhanger te hebben; een half vertaalde
   app is voor een Engelstalig lid een half werkende app. */
function i18n() {
  let gaten = 0;
  for (const p of publicHtml) {
    const t = lees(p);
    const enBlok = t.indexOf("en:") >= 0 ? t.slice(t.indexOf("en:")) : '';
    if (!enBlok) continue;
    const sleutels = new Set();
    const re = /T\(\s*'([a-z0-9.]+)'/g;
    let m;
    while ((m = re.exec(t))) sleutels.add(m[1]);
    const mist = [...sleutels].filter(s => !enBlok.includes("'" + s + "'"));
    if (mist.length > 5) {
      gaten++;
      meld('beter', 'i18n', path.basename(p) + ' heeft ' + mist.length + ' sleutels zonder Engelse vertaling.',
        kort(p) + ' (' + mist.slice(0, 4).join(', ') + ')', 'Vul de EN-tabel aan; de NL-tekst blijft dan de terugval.');
    }
  }
  return { paginas: gaten };
}

/* ====================== 8. UITSCHIETERS ======================
   Bestanden die tegen de grens van 10 KB aan zitten gaan er de volgende
   ronde overheen. Beter nu opknippen dan straks onder tijdsdruk. */
function uitschieters() {
  let n = 0;
  for (const p of serverJs) {
    const b = fs.statSync(p).size;
    if (b > 9400 && b <= 10240) {
      n++;
      meld('beter', 'omvang', 'Dit bestand zit met ' + b + ' bytes vlak onder de grens van 10.240.', kort(p),
        'Knip er een deelbestand af zolang het rustig kan.');
    }
  }
  return { bijnaTeGroot: n };
}

/* ---------- alles keuren ---------- */
function keur() {
  const cijfers = {
    dekking: dekking(), beloftes: beloftes(), privacy: privacy(), pariteit: pariteit(),
    dubbelingen: dubbelingen(), ongebruikt: ongebruikt(), i18n: i18n(), uitschieters: uitschieters()
  };
  const stuk = bevindingen.filter(b => b.soort === 'stuk');
  const scheef = bevindingen.filter(b => b.soort === 'scheef');
  const beter = bevindingen.filter(b => b.soort === 'beter');
  return { cijfers, bevindingen, stuk: stuk.length, scheef: scheef.length, beter: beter.length };
}

if (require.main === module) {
  const r = keur();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(r.stuk ? 1 : 0); }
  console.log('\nDE KEURING -- het logica-oordeel\n');
  console.log('  endpoints in een test : ' + (r.cijfers.dekking.gedekt || 0) + ' van ' + (r.cijfers.dekking.routes || 0) +
    (r.cijfers.dekking.pct != null ? ' (' + r.cijfers.dekking.pct + '%)' : ''));
  console.log('  genres bekeken        : ' + (r.cijfers.pariteit.genres || 0));
  console.log('  oordeel               : ' + r.stuk + ' stuk, ' + r.scheef + ' scheef, ' + r.beter + ' kan beter\n');
  for (const b of bevindingen.filter(x => x.soort === 'stuk')) console.log('  STUK   ' + b.tekst + (b.waar ? '  [' + b.waar + ']' : ''));
  for (const b of bevindingen.filter(x => x.soort === 'scheef')) console.log('  SCHEEF ' + b.tekst + (b.waar ? '  [' + b.waar + ']' : ''));
  for (const b of bevindingen.filter(x => x.soort === 'beter')) console.log('  BETER  ' + b.tekst + (b.waar ? '  [' + b.waar + ']' : ''));
  console.log('');
  process.exit(r.stuk ? 1 : 0);
}

module.exports = { keur };
