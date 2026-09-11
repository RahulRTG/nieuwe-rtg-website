/* De drie pure stukken van het stuur die geen state kennen: de verbodslijst
   (waar het stuur nooit aan zit, wie er ook vraagt), de licht/zwaar-classificatie
   van een vraag en de parser voor deeltaken. Ze stonden in kern/stuur.js en zijn
   hier afgeknipt op hun natuurlijke naad (keuring: omvang) -- stuur.js voert
   ze uit en exporteert ze nog steeds, zodat geen aanroeper hoeft te verhuizen. */
'use strict';

// infrastructuur waar het stuur nooit aan zit, wie er ook vraagt
const VERBODEN = [
  /^\/api\/auth\//,        // accounts en wachtwoorden: geen AI-terrein
  /^\/api\/login$/,        // (gast)sessies aanmaken evenmin
  /^\/api\/account\//,     // de sleutelbos (rollen koppelen/starten): mensenwerk
  /^\/api\/techniek\//,    // het beveiligde techniekbord is van de eigenaar
  /^\/api\/boardroom\//,   // idem: de eigenaarskast
  /^\/api\/doos\//,        // de zaakdoos (lokale sleutels)
  /^\/api\/office\/login$/,
  /* HET PAS-BESLUIT IS MENSENWERK, EN DAT IS EEN MERKREGEL.

     Lifestyle en Business komen uitsluitend na een menselijke beoordeling; de
     AI mag toegang nooit zelf beloven of verlenen. /api/aanmelding/beslis zit
     achter officeAuth, en het stuur hangt aan auth en supplierAuth -- een lid
     of een medewerker kwam er dus al niet bij. Maar officeAuth laat ook de
     EIGENAAR met zijn eigen accountlogin door, en /api/member/doe draait op
     precies dat token. "Rahul, keur de wachtrij even goed" kende dus passen
     toe zonder dat een mens per geval had gekeken -- en dat een mens de zin
     uitsprak is niet hetzelfde als dat een mens de aanvraag beoordeelde. Dat
     verschil IS de regel. */
  /^\/api\/aanmelding\//,
  /^\/api\/(member|supplier|staff)\/doe(?:\/|$)/ // stuur + menselijke bevestiging: geen rondzingen
];

/* ---- lichte vs. zware taak: bepaalt het stappen-budget ----
   Een pure functie (los getoetst): "zet een timer" of "zoek een lid" is licht
   (4 stappen); "plan een complete reis voor 4 personen" is zwaar (24). We tellen
   een paar signalen: lengte, koppelwoorden (en/daarna/ook), plan-/reiswoorden en
   een groepsgrootte. Vanaf een drempel is het zwaar. */
function classificeer(vraag) {
  const t = String(vraag || '').toLowerCase();
  let score = 0;
  if (t.length > 90) score++;
  if (t.length > 180) score++;
  const koppels = (t.match(/\b(en|daarna|vervolgens|ook|plus|met)\b/g) || []).length;
  if (koppels >= 3) score++;
  if (koppels >= 6) score++;
  if (/\b(plan|regel alles|hele dag|dagplanning|weekend|reis|trip|meerdere|allemaal|compleet|complete|organiseer|verzorg)\b/.test(t)) score += 2;
  if (/\bvoor \d+ (personen|persoon|mensen|man|gasten|pax)\b/.test(t)) score++;
  // meerdere concrete boekacties in één zin = meer werk (een ketting van dingen)
  const boekwoorden = (t.match(/\b(boek|reserveer|bestel|regel|taxi'?s?|hotels?|tafels?|tickets?|vluchten?|vlucht|bloem(?:en)?|cadeaus?|restaurants?|diners?|verhuur)\b/g) || []).length;
  if (boekwoorden >= 3) score++;
  if (boekwoorden >= 5) score++;
  const zwaar = score >= 3;
  return { zwaar, maxStappen: zwaar ? 24 : 4, score };
}

/* ---- de deeltaken van een zware taak uit de model-uitvoer halen ----
   We vragen de hoofd-agent om maximaal 3 korte deeltaken als JSON-array; deze
   pure parser is soepel (JSON of een genummerde/gestreepte lijst) en los getoetst. */
function parseSubs(tekst) {
  let arr = null;
  const m = String(tekst || '').match(/\[[\s\S]*\]/);
  if (m) { try { arr = JSON.parse(m[0]); } catch (e) {} }
  if (!Array.isArray(arr)) {
    arr = String(tekst || '').split('\n').map(s => s.replace(/^[\s\-*\d.)]+/, '').trim()).filter(Boolean);
  }
  return arr.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim().slice(0, 140)).slice(0, 3);
}

module.exports = { VERBODEN, classificeer, parseSubs };
