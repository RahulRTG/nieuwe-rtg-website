/* ============================================================================
   DE BEWIJSBRON -- een bestaande proef laten tellen voor een app, en alleen als
   hij dat verdient.

   Het contract (./appcontract.js) zegt WELKE bron een bewijs mag leveren. Dit
   bestand zegt of die bron het NU levert. Drie vragen, in deze volgorde, en de
   eerste die faalt bepaalt de uitslag:

     1. KOPPELING  raakt de proef routes die de ingang van de app aanroept?
                   Zo nee, dan klopt het contract niet en telt er niets -- de
                   proef heeft dit scherm nooit aangeraakt.
     2. VERS       is het register gemeten op de code van nu? Dat is
                   versheid() uit ./stempel.js, en met opzet geen eigen regel:
                   een tweede vers-grendel naast de eerste loopt uiteen (LAT.md
                   regel 4). versheid() kijkt al naar CODEwijzigingen sinds de
                   meting en niet naar de commit alleen -- anders verklaart het
                   committen van het verse register zijn eigen meting van een
                   minuut oud verouderd, en is vers onbereikbaar.
     3. UITKOMST   zijn alle schakels dicht en is er geen storing gebroken?

   DE STANDEN ZIJN DIE VAN APPWERKT.json, en er komt er geen bij:

     BEWEZEN                  de bron is vers en de keten sluit
     GEBLOKKEERD_DOOR_DEFECT  de bron is vers en de keten sluit NIET -- er is
                              een schakel open of stuk, of een storing gebroken
     NIET_GETEST              de bron bestaat, maar er is geen geldig bewijs op
                              deze code: niet gedraaid, verouderd, uit een vuile
                              boom, of de koppeling haalt de meting niet
     GEEN_FIXTURE             er is geen bron (dat blijft de standaard in
                              scripts/appwerkt.js; dit bestand zet hem niet)

   Onbekend is geen fout en een fout is geen onbekend bewijs: een verouderd
   register is NIET_GETEST en nooit DEFECT, want er is niets gemeten dat stuk
   was. En het omgekeerde: een verse keten met een open schakel is DEFECT en
   nooit NIET_GETEST, want dan is er wel iets gemeten.

   Alles wat deze module van buiten nodig heeft (bestanden lezen, versheid) komt
   binnen als parameter, zodat test/appcontract.test.js elke tak kan beproeven
   zonder een register te overschrijven of een git-geschiedenis te vervalsen.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { BEWIJZEN, BRONSOORTEN, CONTRACT, ALGEMEEN } = require('./appcontract');

const WORTEL = path.join(__dirname, '..', '..');

function leesStandaard(rel) {
  try { return fs.readFileSync(path.join(WORTEL, rel), 'utf8'); } catch (e) { return null; }
}

/* ---- 1. DE KOPPELING -------------------------------------------------------

   Welke API-paden roept een proef aan? Gelezen uit de bron van het instrument,
   zoals scripts/lib/routes.js dat voor schermen doet: een letterlijk pad in
   aanhalingstekens. Een pad dat de proef OPBOUWT wordt hier gemist, en dat is
   de veilige kant -- een gemiste route kan een koppeling alleen afwijzen,
   nooit er een verzinnen. */
function proefRoutes(instrument, lees = leesStandaard) {
  const bron = lees(instrument);
  if (bron === null) return null;
  const uit = new Set();
  for (const m of bron.matchAll(/['"`](\/api\/[A-Za-z0-9_/\-.]+)/g)) uit.add(m[1].replace(/\/+$/, ''));
  return uit;
}

/* Welke API-paden roept de ingang van een app aan? De ingang zelf plus de
   scripts die hij laadt (alleen die uit dit huis), met de per-bestand-meting
   uit SCHERMROUTES.json.

   VOORVOEGSELS ALLEEN ALS ZE SMAL ZIJN. Een scherm dat `'/api/' + x` schrijft,
   draagt het voorvoegsel `/api/`, en daarmee raakt het ELKE proef -- zo
   leken Stad en Betalen op alle zeven ketens te landen. Een voorvoegsel telt
   pas vanaf twee segmenten na /api/ (`/api/supplier/horeca/`). */
function smalVoorvoegsel(v) {
  return v.replace(/^\/+|\/+$/g, '').split('/').length >= 3;
}

/* EEN GEGENEREERDE BUNDEL IS ZIJN DELEN. scripts/schermroutes.js slaat de
   bundels (bouwuitvoer, scripts/bundel.js) bewust over en schrijft de paden
   toe aan de delen ernaast. Een ingang die de bundel laadt, roept dus de
   routes van die delen aan; zonder deze stap zag de koppeling van
   /apps/residentie.html alleen /api/stroom/ticket. */
function bundelRegister() {
  try {
    const b = require('../bundel');
    /* ALLEEN APP-BUNDELS. De schilbundels onder public/shared/ (metgezel,
       basis, ...) laadt bijna elk scherm; hun routes zijn van de schil en niet
       van de belofte van het scherm. Telden ze mee, dan koppelde elk scenario
       dat /api/service raakt aan elk scherm -- en kreeg het routedossier er
       vijftien routes bij die het zelf nooit aanroept. */
    return new Map(Object.entries(b.bundels).filter(([uit]) => uit.startsWith('apps/'))
      .map(([uit, map]) => ['public/' + uit, 'public/' + map + '/']));
  } catch (e) { return new Map(); }
}

function ingangRoutes(ingang, { lees = leesStandaard, schermroutes, bundels } = {}) {
  if (!ingang || !ingang.startsWith('/')) return null;
  const sr = schermroutes || JSON.parse(lees('SCHERMROUTES.json') || '{"perScherm":[]}');
  const perBestand = new Map(sr.perScherm.map((x) => [x.bestand, x]));
  const html = 'public' + ingang.split('#')[0].split('?')[0];
  const bestanden = [html];
  const bron = lees(html);
  if (bron !== null) {
    const map = path.posix.dirname(ingang);
    const delen = bundels || bundelRegister();
    for (const m of bron.matchAll(/<script[^>]*\ssrc="([^"]+\.js)[^"]*"/g)) {
      const src = m[1];
      if (/^[a-z]+:\/\//i.test(src)) continue;
      const b = 'public' + (src.startsWith('/') ? src : path.posix.normalize(map + '/' + src));
      bestanden.push(b);
      const deelmap = delen.get(b);
      if (deelmap) for (const x of sr.perScherm) if (x.bestand.startsWith(deelmap)) bestanden.push(x.bestand);
    }
  }
  return routesVanBestanden(bestanden, perBestand);
}

function routesVanBestanden(bestanden, perBestand) {
  const exact = new Set(), voor = new Set();
  for (const b of bestanden) {
    const rij = perBestand.get(b);
    if (!rij) continue;
    for (const p of rij.exact || []) exact.add(p.replace(/\/+$/, ''));
    for (const v of rij.voorvoegsels || []) if (smalVoorvoegsel(v)) voor.add(v);
  }
  return { bestanden, exact, voor };
}

/* EEN TAB OF OS-APP HEEFT GEEN EIGEN ADRES, maar wel eigen code. Het contract
   noemt dan drie dingen: `ingang` (het echte scherm waar de navigatie begint),
   `via` (de echte stap daarheen, bijvoorbeeld `#tab=salon`, dat app-main-12a.js
   zelf als adres met een stand kent) en `bestanden` (de delen die de tab of
   OS-app zelf tekenen). Gekoppeld wordt op de routes van die DELEN en niet op
   die van de hele schil: anders raakt elk scenario dat iets in /apps/app.html
   aanroept, elke tab tegelijk. Ontbreekt een van de drie, dan is er geen
   ingang en blijft het bewijs NIET_GETEST -- geen verzonnen adres. */
function ingangVan(ingang, c, opties = {}) {
  if (ingang && String(ingang).startsWith('/')) {
    const heel = ingangRoutes(ingang, opties);
    /* EEN SCHERM IS NIET ZIJN SCHIL, EN EEN STAND NIET ZIJN SCHERM. Het geldscherm
       laadt de delen van alle standen (Balans telde zo 113 routes), en elk scherm
       laadt de gedeelde schil (Rahul, de stroom, de gids). Het contract mag
       daarom de delen noemen die DEZE ingang zelf tekenen -- maar alleen delen
       die het scherm echt laadt; anders is er geen ingang en blijft het bewijs
       NIET_GETEST. Bevoegd (scripts/bevoegdronde.js) blijft alle routes eisen. */
    if (!heel || !c || !Array.isArray(c.bestanden) || !c.bestanden.length) return heel;
    if (!c.bestanden.every((b) => heel.bestanden.includes(b))) return null;
    const lees = opties.lees || leesStandaard;
    const sr = opties.schermroutes || JSON.parse(lees('SCHERMROUTES.json') || '{"perScherm":[]}');
    return routesVanBestanden(c.bestanden.slice(), new Map(sr.perScherm.map((x) => [x.bestand, x])));
  }
  if (!c || !c.via || !c.ingang || !Array.isArray(c.bestanden) || !c.bestanden.length) return null;
  const lees = opties.lees || leesStandaard;
  const sr = opties.schermroutes || JSON.parse(lees('SCHERMROUTES.json') || '{"perScherm":[]}');
  return routesVanBestanden(c.bestanden.slice(), new Map(sr.perScherm.map((x) => [x.bestand, x])));
}

function gedeeld(proef, ingang) {
  const uit = [];
  for (const p of proef) {
    if (ingang.exact.has(p) || [...ingang.voor].some((v) => p.startsWith(v))) uit.push(p);
  }
  return uit.sort();
}

/* ---- 2 en 3. VERS, EN DE UITKOMST ---------------------------------------- */
/* `deel`: een register dat meer dan een keten draagt (VOLTOOIPROEF.json heeft
   per onderdeel per bewijs een eigen rij schakels) wijst hiermee aan WELKE.
   Het stempel blijft dat van het hele register; de rest komt uit het deel. Een
   deel dat er niet staat is NIET_GETEST -- dan is dit onderdeel niet gemeten. */
function ketenUitslag(register, { lees = leesStandaard, versheid, deel = null } = {}) {
  const tekst = lees(register);
  if (tekst === null) return { status: 'NIET_GETEST', reden: register + ' bestaat niet: deze proef is nooit vastgelegd', bewijs: null };
  let reg;
  try { reg = JSON.parse(tekst); } catch (e) {
    return { status: 'NIET_GETEST', reden: register + ' is geen geldige JSON', bewijs: null };
  }
  const st = reg.stempel;
  /* Een kale datum is geen stempel: zonder commit is niet te zeggen tegen welke
     code dit gemeten is. Vijf ketenproeven schreven tot 24 september 2026 zo'n
     datum; dat is dezelfde uitslag als geen stempel. */
  const v = (st && typeof st === 'object') ? versheid(st)
    : { vers: false, reden: 'het register draagt ' + (st ? 'alleen een datum (' + st + ')' : 'geen stempel') + ' en geen commit; niet na te gaan tegen welke code gemeten is' };
  const bewijs = { register, op: st && st.op ? st.op : (typeof st === 'string' ? st : null),
    commit: st && st.commit ? st.commit : null, instrument: st && st.instrument ? st.instrument : null };
  if (!v.vers) return { status: 'NIET_GETEST', reden: 'bewijs vervallen: ' + v.reden, bewijs };
  const metRaakvlak = (u) => (v.raakvlak ? Object.assign(u, { raakvlak: [v.raakvlak] }) : u);
  if (deel) {
    const gekozen = deel.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), reg);
    if (!gekozen || typeof gekozen !== 'object') {
      return metRaakvlak({ status: 'NIET_GETEST', reden: register + ' kent ' + deel.join('/') + ' niet: dit onderdeel is in die ronde niet gemeten', bewijs });
    }
    bewijs.deel = deel.join('/');
    reg = gekozen;
  }

  const t = reg.telling || {};
  const schakels = Array.isArray(reg.schakels) ? reg.schakels : [];
  const storingen = Array.isArray(reg.storingen) ? reg.storingen : [];
  /* De telling is een samenvatting; de schakels zelf zijn de waarheid. Een
     register waarvan de telling gesloten zegt terwijl een schakel iets anders
     draagt, is DEFECT en niet BEWEZEN -- een samenvatting die de rij tegenspreekt
     is precies de tweede waarheid die hier niet mag winnen. */
  const niet = schakels.filter((s) => s.stand !== 'gesloten');
  const gebroken = storingen.filter((s) => s.stand !== 'gehouden');
  /* Een deel dat zelf zegt dat het niet beproefd is (de voltooiproef schrijft
     dat bij menselijk zonder uitgelokte weigering) is niet gemeten en nooit
     een defect: er is niets gezien dat stuk was. */
  if (typeof reg.nietBeproefd === 'string' && reg.nietBeproefd) {
    return metRaakvlak({ status: 'NIET_GETEST', reden: 'vers gemeten, maar niet beproefd: ' + reg.nietBeproefd, bewijs });
  }
  if (!schakels.length) return metRaakvlak({ status: 'NIET_GETEST', reden: register + ' draagt geen schakels; er is niets om te laten tellen', bewijs });
  if (niet.length || gebroken.length || t.stuk || t.gebroken || reg.sluit === false) {
    const eerste = niet[0] ? 'schakel ' + niet[0].nr + ' staat ' + niet[0].stand + ' (' + (niet[0].wat || '') + ')'
      : gebroken[0] ? 'storing "' + (gebroken[0].wat || gebroken[0].naam || '?') + '" staat ' + gebroken[0].stand
        : 'de keten zegt zelf dat hij niet sluit';
    return metRaakvlak({ status: 'GEBLOKKEERD_DOOR_DEFECT', reden: 'vers gemeten en de stroom sluit niet: ' + eerste, bewijs });
  }
  /* Een deel dat zelf zegt dat de omgeving iets miste (de voltooiproef schrijft
     dat bij een 503 met configzin of "hoe", scripts/lib/configweigering.js):
     niet groen en geen defect. Een defect hierboven gaat altijd voor. */
  if (typeof reg.configBlokkade === 'string' && reg.configBlokkade) {
    return metRaakvlak({ status: 'GEBLOKKEERD_DOOR_CONFIG', reden: 'vers gemeten, en de omgeving miste iets: ' + reg.configBlokkade, bewijs });
  }
  return metRaakvlak({ status: 'BEWEZEN',
    reden: 'vers gemeten (' + v.reden + '): ' + schakels.length + ' schakels gesloten, ' + storingen.length + ' storingen gehouden',
    bewijs });
}

/* ---- DE SAMENSTELLING ------------------------------------------------------

   Voor een rij uit APPWERKT.json: vervang elk bewijs waarvoor het contract een
   bron noemt door de uitslag van die bron. Wat het contract niet noemt, blijft
   exact staan -- deze functie kan een GEEN_FIXTURE alleen vervangen door iets
   wat een bron VERDIEND heeft, nooit door een gok. */
/* ---- EEN RONDE: EEN UITSLAG PER RIJ ---------------------------------------
   Voor een bron uit ALGEMEEN (scripts/lib/appcontract.js). Dezelfde grendels als
   bij een keten: geen register, geen stempel of een vervallen stempel is
   NIET_GETEST, en een rij die er niet in staat ook. De uitslag van de rij wordt
   overgenomen, nooit opgewaardeerd. */
const STANDEN = new Set(['BEWEZEN', 'GEBLOKKEERD_DOOR_DEFECT', 'GEBLOKKEERD_DOOR_CONFIG', 'NIET_GETEST']);
function rondeUitslag(register, functie, { lees = leesStandaard, versheid } = {}) {
  const tekst = lees(register);
  if (tekst === null) return { status: 'NIET_GETEST', reden: register + ' bestaat niet: deze ronde is nooit vastgelegd', bewijs: null };
  let reg;
  try { reg = JSON.parse(tekst); } catch (e) { return { status: 'NIET_GETEST', reden: register + ' is geen geldige JSON', bewijs: null }; }
  const st = reg.stempel;
  const v = (st && typeof st === 'object') ? versheid(st) : { vers: false, reden: 'het register draagt geen stempel met commit' };
  const bewijs = { register, op: st && st.op ? st.op : null, commit: st && st.commit ? st.commit : null };
  if (!v.vers) return { status: 'NIET_GETEST', reden: 'bewijs vervallen: ' + v.reden, bewijs };
  const rij = (reg.regels || []).find((r) => r.functie === functie);
  if (!rij) return { status: 'NIET_GETEST', reden: register + ' kent ' + functie + ' niet', bewijs };
  if (!STANDEN.has(rij.status)) return { status: 'NIET_GETEST', reden: register + ' geeft ' + functie + ' de onbekende stand ' + rij.status, bewijs };
  const uit = { status: rij.status, reden: rij.reden, bewijs };
  if (v.raakvlak) uit.raakvlak = [v.raakvlak];
  return uit;
}

/* DE VERSHEID PER BEWIJS (scripts/lib/bewijsraakvlak.js). Niet meer het hele register
   oud bij elke codewijziging, maar alleen als er iets veranderde in de bestanden
   die DIT bewijs van DEZE app kunnen aantasten. Is dat raakvlak niet vast te
   stellen, dan beslist de grove regel van versheid() -- nooit "vers". Een
   toets die zijn eigen `versheid` meegeeft, krijgt precies die. */
let standaardWereld = null;
function opRaakvlak(invoer, opties) {
  const R = require('./bewijsraakvlak');
  const w = opties.wereld || (standaardWereld = standaardWereld || R.maakWereld());
  return R.versheidVoor(w, invoer, require('./stempel').versheid);
}

function bewijsVoor(functie, naam, ingang, opties = {}) {
  const c = (opties.contract || CONTRACT)[functie];
  const bron = c && c[naam];
  if (!bron) {
    const alg = (opties.algemeen || ALGEMEEN)[naam];
    if (!alg) return null;
    if (!(BRONSOORTEN[alg.soort] || []).includes(naam)) throw new Error('appcontract: een ' + alg.soort + ' mag geen ' + naam + ' leveren');
    const uit = rondeUitslag(alg.register, functie, { lees: opties.lees || leesStandaard,
      versheid: opties.versheid || opRaakvlak({ ingang, soort: 'browser' }, opties) });
    uit.bron = { soort: alg.soort, instrument: alg.instrument };
    return uit;
  }
  if (!BEWIJZEN.includes(naam)) throw new Error('appcontract: "' + naam + '" is geen van de acht bewijzen');
  if (!(BRONSOORTEN[bron.soort] || []).includes(naam)) {
    throw new Error('appcontract: een ' + bron.soort + ' mag geen ' + naam + ' leveren (' + functie + ')');
  }
  const lees = opties.lees || leesStandaard;
  const proef = proefRoutes(bron.instrument, lees);
  const ing = ingangVan(ingang, c, { lees, schermroutes: opties.schermroutes });
  const raak = proef && ing ? gedeeld(proef, ing) : [];
  if (!raak.length) {
    return { status: 'NIET_GETEST', bewijs: null,
      reden: 'het contract noemt ' + bron.instrument + ', maar die proef raakt geen enkele route die ' + (ing ? ingang : (c.ingang || ingang) + ' via ' + (c.via || '(geen navigatiestap in het contract)')) +
        ' aanroept; de koppeling haalt de meting niet en telt daarom niet' };
  }
  /* Een voltooiproef draagt per onderdeel per bewijs een eigen keten
     (scripts/voltooiproef.js); een ketenproef is als geheel een keten. */
  const deel = bron.soort === 'voltooiproef' ? ['apps', functie, naam] : null;
  /* Het raakvlak van een routeproef: de routes van het scherm EN die van de
     proef zelf, want het scenario raakt soms meer dan het scherm (het besluit
     van het kantoor bij de verificatie). Bij de voltooiproef telt alleen het
     eigen scenario van het instrument. */
  const invoer = { ingang, soort: 'api', routeInstrument: bron.instrument,
    scenario: bron.soort === 'voltooiproef' ? bron.instrument : undefined };
  const uit = ketenUitslag(bron.register, { lees, versheid: opties.versheid || opRaakvlak(invoer, opties), deel });
  uit.bron = { soort: bron.soort, instrument: bron.instrument, belofte: c.belofte, gedeeldeRoutes: raak.length };
  return uit;
}

function stelSamen(r, opties = {}) {
  const gedaan = [];
  for (const naam of BEWIJZEN) {
    const b = bewijsVoor(r.functie, naam, r.ingang, opties);
    if (!b) continue;
    /* MENSELIJK HEEFT TWEE HELFTEN en de schermkant wint als die stuk is: zag
       scripts/appwerkt.js bij de bediening een kale JS-fout of 500, dan is dat
       een defect dat geen routeproef wegneemt. Alleen een rij waar het scherm
       niets kaals zag, krijgt de uitslag van de storingen erbij. */
    const eerder = r.bewijzen[naam];
    if (naam === 'menselijk' && eerder && eerder.status === 'GEBLOKKEERD_DOOR_DEFECT') continue;
    if (naam === 'menselijk' && b.status === 'BEWEZEN') {
      b.reden = 'op het scherm geen kale fout gezien bij de bediening (scripts/appwerkt.js), en onder de storingen van de voltooiproef: ' + b.reden;
    }
    r.bewijzen[naam] = b;
    gedaan.push(naam);
  }
  return gedaan;
}

/* ---- MODUS SAMEN: de verklaring tegen de code ---------------------------

   SAMEN, EXTERN en KETENS_ZONDER_APP in ./appcontract.js zijn een verklaring.
   Hier wordt gemeten of de code hem waarmaakt. Elk bezwaar is een zin met wat
   er niet klopt; een lege lijst betekent dat elke verklaring gedekt is -- en
   NIET dat de keten werkt, dat zegt de proef (samenKetens hieronder).

   DE CODEMETING. Een soort VERTREKT uit een scherm als een bestand dat het
   scherm laadt een `sleep-start` stuurt en die soort noemt (`data-sleep="reis"`
   of `soort: 'reis'`). Een soort KOMT AAN als een geladen bestand op
   `sleep-kan` antwoordt en die soort als sleutel kent (`reis: {`). Dat is het
   protocol van public/shared/rtg-schil/06b-objecten.js; een app die het niet
   spreekt, is niet verbonden, wat er ook verklaard staat. */
const SOORT_OK = (soort) => {
  const ov = require('../../public/shared/objectverwijzing.js');
  const v = ov.verwijzing({ soort, id: 'x' });
  return typeof soort === 'string' && soort.length > 0 && v && v.soort === soort;
};
function noemtSoort(tekst, soort, protocol) {
  if (!tekst.includes(protocol)) return false;
  const s = soort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (protocol === "rtg: 'context'") return new RegExp('soort\\s*:\\s*["\']' + s + '["\']').test(tekst);
  if (protocol === 'sleep-start') return new RegExp('data-sleep=\\\\?["\']' + s + '["\'\\\\]|soort\\s*:\\s*["\']' + s + '["\']').test(tekst);
  return new RegExp('(^|[\\s{,])["\']?' + s + '["\']?\\s*:\\s*(\\{|function\\b)').test(tekst);
}
/* Het protocol per schakel: `sleep` (slepen, 06b-objecten) of `context` (de
   contextbus, 05-context). Een ontvanger op de contextbus luistert naar
   rtg === 'context' en kent de soort als sleutel. */
const PROTOCOL = { sleep: { uit: 'sleep-start', in: 'sleep-kan' }, context: { uit: "rtg: 'context'", in: "'context'" } };
function protocolVan(sch, uit) { const p = PROTOCOL[sch.protocol || 'sleep']; return p ? p[uit ? 'uit' : 'in'] : null; }
function schermSpreekt(ingang, soort, protocol, opties) {
  const bestanden = opties.bestandenVan ? opties.bestandenVan(ingang) : standaardBestanden(ingang);
  const lees = opties.lees || leesStandaard;
  return bestanden.some((b) => { const t = lees(b); return t !== null && noemtSoort(t, soort, protocol); });
}
let samenWereld = null;
function standaardBestanden(ingang) {
  const R = require('./bewijsraakvlak');
  samenWereld = samenWereld || R.maakWereld();
  return [...R.schermDeel(samenWereld, ingang).geladen].filter((b) => /\.(m?js|html?)$/.test(b));
}
function standaardFuncties() {
  const reg = require('./wereldregister');
  const uit = new Map();
  for (const map of reg.MAPPEN) for (const item of map.items) {
    const i = item.indexOf(':'), soort = item.slice(0, i), sleutel = item.slice(i + 1);
    const bron = soort === 'link' ? reg.LINKS[sleutel] : (soort === 'os' ? reg.OSAPPS[sleutel] : null);
    uit.set(item, bron && bron.url ? bron.url.split('#')[0].split('?')[0] : null);
  }
  return uit;
}

function controleerSamen(opties = {}) {
  const ac = require('./appcontract');
  const samen = opties.samen || ac.SAMEN, extern = opties.extern || ac.EXTERN;
  const zonder = opties.zonderApp || ac.KETENS_ZONDER_APP;
  const functies = opties.functies || standaardFuncties();   // functie -> ingang (of null)
  const lees = opties.lees || leesStandaard;
  const bezwaren = [];
  const uitgegeven = new Set(Object.keys(extern));
  for (const [f, c] of Object.entries(samen)) for (const x of c.uitgeeft || []) uitgegeven.add(x);
  for (const k of zonder) for (const sch of k.schakels || []) if (sch.uitgeeft) uitgegeven.add(sch.uitgeeft);

  const proefNodig = (k, wie) => {
    if (!k.proef || !k.proef.register || !k.proef.instrument) { bezwaren.push(wie + ': keten "' + k.naam + '" noemt geen proef; een keten zonder proef is een bewering'); return; }
    if (lees(k.proef.instrument) === null) bezwaren.push(wie + ': de proef van "' + k.naam + '" (' + k.proef.instrument + ') bestaat niet');
  };
  const families = opties.families || ac.FAMILIES;
  const laagOk = (k, wie) => {
    const laag = k.laag || 'scherm';
    if (laag !== 'scherm' && laag !== 'kern') { bezwaren.push(wie + ': laag "' + laag + '" is geen scherm of kern'); return null; }
    if (k.familie && !families[k.familie]) bezwaren.push(wie + ': familie "' + k.familie + '" bestaat niet in FAMILIES');
    return laag;
  };
  /* Een kernschakel: het bestand bestaat en noemt wat de volgende schakel is. */
  const kernSchakels = (wie, schakels) => {
    for (const sch of schakels || []) {
      const t = sch.bestand ? lees(sch.bestand) : null;
      if (t === null) { bezwaren.push(wie + ': kernschakel ' + (sch.bestand || '(geen bestand)') + ' bestaat niet'); continue; }
      if (sch.noemt && !t.includes(sch.noemt)) bezwaren.push(wie + ': ' + sch.bestand + ' noemt "' + sch.noemt + '" niet meer');
    }
  };
  for (const [f, c] of Object.entries(samen)) {
    if (!functies.has(f)) { bezwaren.push(f + ' staat in SAMEN maar is geen functie in MAPPEN'); continue; }
    const ingang = functies.get(f);
    for (const veld of ['uitgeeft', 'ontvangt']) for (const soort of c[veld] || []) {
      if (!SOORT_OK(soort)) { bezwaren.push(f + ': "' + soort + '" in ' + veld + ' is geen soort die de objectpoort doorlaat'); continue; }
      if (!ingang) { bezwaren.push(f + ': ' + veld + ' ' + soort + ', maar de functie heeft geen eigen scherm om dat in te meten'); continue; }
      const protocol = veld === 'uitgeeft' ? 'sleep-start' : 'sleep-kan';
      if (!schermSpreekt(ingang, soort, protocol, opties)) bezwaren.push(f + ': verklaart ' + veld + ' ' + soort + ', maar geen bestand dat ' + ingang + ' laadt doet dat (' + protocol + ')');
    }
    for (const soort of c.ontvangt || []) if (!uitgegeven.has(soort)) bezwaren.push(f + ': ontvangt ' + soort + ', maar geen app geeft die uit en hij staat niet in EXTERN');
    for (const k of c.ketens || []) {
      if (!k.naam) bezwaren.push(f + ': een keten zonder naam');
      if (laagOk(k, f + ': keten "' + k.naam + '"') === 'kern' && k.kern) kernSchakels(f + ': keten "' + k.naam + '"', k.kern);
      if (!Array.isArray(k.schakels) || k.schakels.length < 2) bezwaren.push(f + ': keten "' + k.naam + '" heeft minder dan twee schakels; dat is LOS, geen SAMEN');
      for (const sch of k.schakels || []) if (!functies.has(sch)) bezwaren.push(f + ': keten "' + k.naam + '" noemt schakel ' + sch + ', en die bestaat niet in MAPPEN');
      if (!(k.schakels || []).includes(f)) bezwaren.push(f + ': keten "' + k.naam + '" noemt deze functie zelf niet als schakel');
      proefNodig(k, f);
    }
  }
  for (const k of zonder) {
    const wie = 'keten zonder app "' + k.naam + '"';
    if (!k.reden || !k.nodig) bezwaren.push(wie + ': zonder reden of zonder wat er nodig is om wel te tellen');
    if (laagOk(k, wie) === 'kern') { kernSchakels(wie, k.schakels); proefNodig(k, wie); continue; }
    for (const sch of k.schakels || []) {
      const soort = sch.uitgeeft || sch.ontvangt;
      if (!SOORT_OK(soort)) { bezwaren.push(wie + ': "' + soort + '" is geen soort die de objectpoort doorlaat'); continue; }
      const protocol = protocolVan(sch, !!sch.uitgeeft);
      if (!protocol) { bezwaren.push(wie + ': onbekend protocol ' + sch.protocol); continue; }
      if (!schermSpreekt(sch.scherm, soort, protocol, opties)) bezwaren.push(wie + ': ' + sch.scherm + ' ' + (sch.uitgeeft ? 'geeft ' : 'ontvangt ') + soort + ' niet in zijn code (' + (sch.protocol || 'sleep') + ')');
      if (sch.ontvangt && !uitgegeven.has(sch.ontvangt)) bezwaren.push(wie + ': ontvangt ' + sch.ontvangt + ', maar niemand geeft die uit');
    }
    for (const [f, c] of [...functies].map(([x]) => [x, samen[x]]).filter(([, c]) => c)) if ((c.ketens || []).some((x) => x.naam === k.naam)) bezwaren.push(wie + ' staat ook onder ' + f + ' in SAMEN; een keten staat op een plek');
    proefNodig(k, wie);
  }

  /* ONTBREKEND: elk gat is gemeld met familie, laag, wat en kaart; een gat dat
     in de code te meten is (`zolang`) mag niet stilletjes opgelost zijn; en een
     keten die al als keten met proef staat, hoort er niet meer in. */
  const ontbrekend = opties.ontbrekend || ac.ONTBREKEND;
  const ketenNamen = new Set(zonder.map((k) => k.naam));
  for (const c of Object.values(samen)) for (const k of c.ketens || []) ketenNamen.add(k.naam);
  for (const o of ontbrekend) {
    const wie = 'ontbrekend "' + o.naam + '"';
    if (!o.familie || !families[o.familie]) bezwaren.push(wie + ': familie "' + o.familie + '" bestaat niet in FAMILIES');
    if (o.ontbreekt !== 'keten' && o.ontbreekt !== 'proef') bezwaren.push(wie + ': ontbreekt is "' + o.ontbreekt + '", geen keten of proef');
    if (!o.wat || !o.kaart) bezwaren.push(wie + ': zonder wat of zonder kaart');
    laagOk(o, wie);
    if (ketenNamen.has(o.naam)) bezwaren.push(wie + ' staat ook als keten; haal hem uit ONTBREKEND');
    if (o.ontbreekt === 'proef') {
      if (!Array.isArray(o.bron) || !o.bron.length) bezwaren.push(wie + ': een bestaande keten zonder proef noemt waar hij in de code staat (bron)');
      else kernSchakels(wie, o.bron);
    }
    if (o.zolang) {
      const map = o.zolang.geenBestandIn;
      const noemen = (opties.zoekIn || standaardZoekIn)(map, o.zolang.noemt);
      if (noemen.length) bezwaren.push(wie + ': ' + noemen[0] + ' noemt nu ' + o.zolang.noemt + ' -- het gat lijkt gedicht; meet de keten en haal hem uit ONTBREKEND');
    }
  }
  return bezwaren;
}
function standaardZoekIn(map, tekst) {
  const R = require('./bewijsraakvlak');
  samenWereld = samenWereld || R.maakWereld();
  const uit = [];
  for (const p of samenWereld.lijst() || []) {
    if (!p.startsWith(map) || !/\.(m?js|html?)$/.test(p)) continue;
    const t = samenWereld.inhoud(p);
    if (t && t.toString('utf8').includes(tekst)) uit.push(p);
  }
  return uit;
}

/* DE STAND VAN EEN FAMILIE. Compleet als al haar ketens BEWEZEN zijn en er voor
   haar niets in ONTBREKEND staat. Een getal per soort, geen graad. */
function familieStand(opties = {}) {
  const ac = require('./appcontract');
  const families = opties.families || ac.FAMILIES;
  const ketens = opties.ketens || samenKetens(opties);
  const ontbrekend = opties.ontbrekend || ac.ONTBREKEND;
  const uit = {};
  for (const [naam, f] of Object.entries(families)) {
    const eigen = ketens.filter((k) => k.familie === naam);
    const gaten = ontbrekend.filter((o) => o.familie === naam);
    uit[naam] = { wat: f.wat, kaart: f.kaart,
      ketens: eigen.map((k) => ({ naam: k.naam, laag: k.laag, status: k.status })),
      bewezen: eigen.filter((k) => k.status === 'BEWEZEN').length,
      ontbrekend: gaten.map((o) => ({ naam: o.naam, laag: o.laag || 'scherm', ontbreekt: o.ontbreekt, k: o.k || null, wat: o.wat })),
      compleet: eigen.length > 0 && gaten.length === 0 && eigen.every((k) => k.status === 'BEWEZEN') };
  }
  return uit;
}

/* De uitslag per keten, uit zijn proef. Het register draagt per keten een
   eigen rij schakels en storingen onder `ketens.<naam>`; dezelfde grendels als
   elke ketenproef (vers, sluit, storingen gehouden). */
function samenKetens(opties = {}) {
  const ac = require('./appcontract');
  const uit = [];
  const alle = [];
  for (const [f, c] of Object.entries(opties.samen || ac.SAMEN)) for (const k of c.ketens || []) alle.push({ functie: f, k });
  for (const k of opties.zonderApp || ac.KETENS_ZONDER_APP) alle.push({ functie: null, k });
  for (const { functie, k } of alle) {
    const u = k.proef ? ketenUitslag(k.proef.register, { lees: opties.lees || leesStandaard,
      versheid: opties.versheid || require('./stempel').versheid, deel: ['ketens', k.naam] })
      : { status: 'NIET_GETEST', reden: 'geen proef', bewijs: null };
    uit.push({ naam: k.naam, functie, zonderApp: !functie, laag: k.laag || 'scherm', familie: k.familie || null, schakels: k.schakels, status: u.status, reden: u.reden,
      bewijs: u.bewijs, raakvlak: u.raakvlak });
  }
  return uit;
}

module.exports = { controleerSamen, samenKetens, familieStand, noemtSoort, PROTOCOL, proefRoutes, ingangRoutes, ingangVan, routesVanBestanden, gedeeld, smalVoorvoegsel, ketenUitslag, rondeUitslag, bewijsVoor, stelSamen };
