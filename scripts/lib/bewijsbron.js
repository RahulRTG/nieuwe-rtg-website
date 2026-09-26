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

function ingangRoutes(ingang, { lees = leesStandaard, schermroutes } = {}) {
  if (!ingang || !ingang.startsWith('/')) return null;
  const sr = schermroutes || JSON.parse(lees('SCHERMROUTES.json') || '{"perScherm":[]}');
  const perBestand = new Map(sr.perScherm.map((x) => [x.bestand, x]));
  const html = 'public' + ingang.split('#')[0].split('?')[0];
  const bestanden = [html];
  const bron = lees(html);
  if (bron !== null) {
    const map = path.posix.dirname(ingang);
    for (const m of bron.matchAll(/<script[^>]*\ssrc="([^"]+\.js)[^"]*"/g)) {
      const src = m[1];
      if (/^[a-z]+:\/\//i.test(src)) continue;
      bestanden.push('public' + (src.startsWith('/') ? src : path.posix.normalize(map + '/' + src)));
    }
  }
  const exact = new Set(), voor = new Set();
  for (const b of bestanden) {
    const rij = perBestand.get(b);
    if (!rij) continue;
    for (const p of rij.exact || []) exact.add(p.replace(/\/+$/, ''));
    for (const v of rij.voorvoegsels || []) if (smalVoorvoegsel(v)) voor.add(v);
  }
  return { bestanden, exact, voor };
}

function gedeeld(proef, ingang) {
  const uit = [];
  for (const p of proef) {
    if (ingang.exact.has(p) || [...ingang.voor].some((v) => p.startsWith(v))) uit.push(p);
  }
  return uit.sort();
}

/* ---- 2 en 3. VERS, EN DE UITKOMST ---------------------------------------- */
function ketenUitslag(register, { lees = leesStandaard, versheid } = {}) {
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

  const t = reg.telling || {};
  const schakels = Array.isArray(reg.schakels) ? reg.schakels : [];
  const storingen = Array.isArray(reg.storingen) ? reg.storingen : [];
  /* De telling is een samenvatting; de schakels zelf zijn de waarheid. Een
     register waarvan de telling gesloten zegt terwijl een schakel iets anders
     draagt, is DEFECT en niet BEWEZEN -- een samenvatting die de rij tegenspreekt
     is precies de tweede waarheid die hier niet mag winnen. */
  const niet = schakels.filter((s) => s.stand !== 'gesloten');
  const gebroken = storingen.filter((s) => s.stand !== 'gehouden');
  if (!schakels.length) return { status: 'NIET_GETEST', reden: register + ' draagt geen schakels; er is niets om te laten tellen', bewijs };
  if (niet.length || gebroken.length || t.stuk || t.gebroken || reg.sluit === false) {
    const eerste = niet[0] ? 'schakel ' + niet[0].nr + ' staat ' + niet[0].stand + ' (' + (niet[0].wat || '') + ')'
      : gebroken[0] ? 'storing "' + (gebroken[0].wat || gebroken[0].naam || '?') + '" staat ' + gebroken[0].stand
        : 'de keten zegt zelf dat hij niet sluit';
    return { status: 'GEBLOKKEERD_DOOR_DEFECT', reden: 'vers gemeten en de stroom sluit niet: ' + eerste, bewijs };
  }
  return { status: 'BEWEZEN',
    reden: 'vers gemeten (' + v.reden + '): ' + schakels.length + ' schakels gesloten, ' + storingen.length + ' storingen gehouden',
    bewijs };
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
  return { status: rij.status, reden: rij.reden, bewijs };
}

function bewijsVoor(functie, naam, ingang, opties = {}) {
  const c = (opties.contract || CONTRACT)[functie];
  const bron = c && c[naam];
  if (!bron) {
    const alg = (opties.algemeen || ALGEMEEN)[naam];
    if (!alg) return null;
    if (!(BRONSOORTEN[alg.soort] || []).includes(naam)) throw new Error('appcontract: een ' + alg.soort + ' mag geen ' + naam + ' leveren');
    const uit = rondeUitslag(alg.register, functie, { lees: opties.lees || leesStandaard, versheid: opties.versheid || require('./stempel').versheid });
    uit.bron = { soort: alg.soort, instrument: alg.instrument };
    return uit;
  }
  if (!BEWIJZEN.includes(naam)) throw new Error('appcontract: "' + naam + '" is geen van de acht bewijzen');
  if (!(BRONSOORTEN[bron.soort] || []).includes(naam)) {
    throw new Error('appcontract: een ' + bron.soort + ' mag geen ' + naam + ' leveren (' + functie + ')');
  }
  const lees = opties.lees || leesStandaard;
  const proef = proefRoutes(bron.instrument, lees);
  const ing = ingangRoutes(ingang, { lees, schermroutes: opties.schermroutes });
  const raak = proef && ing ? gedeeld(proef, ing) : [];
  if (!raak.length) {
    return { status: 'NIET_GETEST', bewijs: null,
      reden: 'het contract noemt ' + bron.instrument + ', maar die proef raakt geen enkele route die ' + ingang +
        ' aanroept; de koppeling haalt de meting niet en telt daarom niet' };
  }
  const uit = ketenUitslag(bron.register, { lees, versheid: opties.versheid || require('./stempel').versheid });
  uit.bron = { soort: bron.soort, instrument: bron.instrument, belofte: c.belofte, gedeeldeRoutes: raak.length };
  return uit;
}

function stelSamen(r, opties = {}) {
  const gedaan = [];
  for (const naam of BEWIJZEN) {
    const b = bewijsVoor(r.functie, naam, r.ingang, opties);
    if (b) { r.bewijzen[naam] = b; gedaan.push(naam); }
  }
  return gedaan;
}

module.exports = { proefRoutes, ingangRoutes, gedeeld, smalVoorvoegsel, ketenUitslag, rondeUitslag, bewijsVoor, stelSamen };
