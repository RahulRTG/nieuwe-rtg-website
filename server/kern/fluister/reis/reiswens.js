/* DE REISWENS -- "ik wil met zes vrienden vier dagen naar Rome, maximaal € 800
   per persoon" als een voorbereiding met wat bekend is, wat aangenomen is en
   wat nog ontbreekt (EDGE.md par. 14.4).

   DIT IS EEN DIRECTE ROUTE EN GEEN PROMPT. Een zin met een bestemming en minstens
   een van reizigers, duur of budget is duidelijk genoeg om zonder model te lezen;
   dan krijgt het lid een concept dat hij kan nakijken, in plaats van een vrij
   antwoord dat er net zo goed naast kan zitten. Zegt de zin minder, dan doet
   deze laag niets en loopt het gesprek gewoon verder.

   ER WORDT NIETS GESCHREVEN. Geen aanvraag, geen boeking, geen bericht aan
   medereizigers, geen geld: alleen een concept in het antwoord. Wat ermee
   gebeurt, beslist het lid, en wat er nog niet kan staat er eerlijk bij.

   AANNEMEN STAAT ERBIJ. "Met zes vrienden" is zeven reizigers als het lid zelf
   meegaat, en dat weten we niet zeker -- dus het getal staat er met de aanname
   ernaast en de uitnodiging om hem aan te passen. Een waarde die niet in de zin
   staat, wordt niet ingevuld maar komt bij "nog nodig". */
'use strict';

const GETAL = { een: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10,
  elf: 11, twaalf: 12, dertien: 13, veertien: 14, vijftien: 15, twintig: 20 };
const N = '(\\d{1,2}|' + Object.keys(GETAL).join('|') + ')';
const getal = (x) => (/^\d+$/.test(x) ? Number(x) : GETAL[String(x).toLowerCase()]);

/* Een zin die naar iets wijst ("deze reis") of iets wil wijzigen, is GEEN nieuwe
   reiswens: dan beslist de relatie met het aangewezen object, en bij twijfel
   vraagt Rahul (kern/stuur/menscontext-relatie.js -- dezelfde woorden, geen
   tweede lijst). */
const { WIJS, WIJZIG } = require('../../stuur/menscontext-relatie');

function leesReiswens(q) {
  const tekst = String(q || '');
  if (WIJS.test(tekst) || WIJZIG.test(tekst)) return null;
  /* Een bestemming is een eigennaam na "naar"; een kleine letter is geen plaats
     ("naar huis", "naar buiten"). */
  const b = /\bnaar\s+([A-Z][\w\u00C0-\u017F'-]+(?:\s+[A-Z][\w\u00C0-\u017F'-]+)?)/.exec(tekst);
  if (!b) return null;
  const vrienden = new RegExp('\\bmet\\s+' + N + '\\s+(vrienden|vriendinnen|collega\'?s|familieleden)\\b', 'i').exec(tekst);
  const personen = new RegExp('\\b(?:met\\s+)?' + N + '\\s+(personen|reizigers|man|mensen)\\b', 'i').exec(tekst);
  const dagen = new RegExp('\\b' + N + '\\s+(dagen|dag|nachten|nacht)\\b', 'i').exec(tekst);
  const budget = /\b(?:maximaal|max\.?|hooguit|tot)\s*(?:€|eur(?:o)?)?\s*(\d[\d.]*)\s*(?:euro|eur)?\s*(?:per persoon|p\.?p\.?|pp)\b/i.exec(tekst)
    || /€\s*(\d[\d.]*)\s*(?:per persoon|p\.?p\.?|pp)\b/i.exec(tekst);
  /* EEN REISWENS IS EEN REIS. "Regel een taxi naar Sal de Mar met 2 personen"
     heeft een bestemming en personen en is een rit -- die is van de handelingen
     van kern/fluister (intent.js), en een concept zou hem wegvangen. Dus: een
     duur, een budget per persoon of een reiswoord, en nooit een vervoerswoord. */
  if (/\b(taxi|rit|ritje|transfer|chauffeur|vervoer|tafel|reserveer|reservering|bestel)\b/i.test(tekst)) return null;
  if (!dagen && !budget && !/\b(reis|reizen|vakantie|trip|stedentrip|weekend|weekendje)\b/i.test(tekst)) return null;

  /* De waarden staan GESTRUCTUREERD; de regels die het lid leest worden eruit
     afgeleid (conceptVan). Zo is een wijziging op het scherm een wijziging van
     een waarde, en geen tweede model naast het eerste (./reisconcept.js). */
  return {
    bestemming: b[1],
    reizigers: vrienden ? getal(vrienden[1]) + 1 : personen ? getal(personen[1]) : null,
    aanname: vrienden ? 'u en ' + vrienden[1] + ' ' + vrienden[2] : null,
    dagen: dagen ? getal(dagen[1]) : null,
    nachten: !!(dagen && /nacht/i.test(dagen[2])),
    budgetPP: budget ? Number(String(budget[1]).replace(/\./g, '')) : null,
    datumGenoemd: /\b(\d{1,2}[-/ ]\d{1,2}|januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|morgen|volgende week|weekend)\b/i.test(tekst),
    vertrekGenoemd: /\bvanuit\s+[A-Z]|\bvertrek(ken)?\s+(vanuit|uit|vanaf)\s+[A-Z]/.test(tekst)
  };
}

const geld = (n) => '€ ' + String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/* Het concept zoals het lid het krijgt, uit de waarden en de catalogus: staat de
   bestemming erin, dan noemen we die reis; zo niet, dan zeggen we dat, want een
   aanvraag in de app hoort bij een reis uit de catalogus (kern/reisbureau.js). */
function conceptVan(w, catalogus) {
  const velden = [{ naam: 'Bestemming', waarde: w.bestemming }];
  if (w.reizigers) velden.push(Object.assign({ naam: 'Reizigers', waarde: String(w.reizigers) }, w.aanname ? { aanname: w.aanname } : {}));
  if (w.dagen) velden.push({ naam: 'Duur', waarde: w.dagen + ' ' + (w.nachten ? 'nachten' : 'dagen') });
  if (w.budgetPP) velden.push({ naam: 'Budget', waarde: 'maximaal ' + geld(w.budgetPP) + ' per persoon' });
  // afgeleid, en zo gemarkeerd: het lid past de twee waarden aan, niet dit getal
  if (w.budgetPP && w.reizigers) velden.push({ naam: 'Groepsbudget', waarde: 'maximaal ' + geld(w.budgetPP * w.reizigers), afgeleid: true });
  const ontbreekt = [];
  if (!w.datumGenoemd) ontbreekt.push('de reisdata');
  if (!w.vertrekGenoemd) ontbreekt.push('uw vertrekplaats');
  if (!w.reizigers) ontbreekt.push('het aantal reizigers');
  const naam = String(w.bestemming).toLowerCase();
  const reis = (catalogus || []).find((t) => String(t.bestemming || '').toLowerCase() === naam ||
    String(t.titel || '').toLowerCase().split(/[\s,]+/).includes(naam));
  const volgende = reis
    ? 'In onze catalogus staat ‘' + reis.titel + '’. Die kunt u in het reisbureau aanvragen; dan bevestigt een reisadviseur de datum.'
    : w.bestemming + ' staat niet in onze reiscatalogus, dus ik kan deze reis nog niet als aanvraag indienen.';
  return { soort: 'reiswens', titel: 'Nieuwe reis naar ' + w.bestemming, velden, ontbreekt, volgende,
    catalogusreis: reis ? reis.id : null };
}

function reiswens(q, catalogus) {
  const w = leesReiswens(q);
  return w ? conceptVan(w, catalogus) : null;
}

function zinVan(c) {
  const v = c.velden.filter((x) => x.naam !== 'Bestemming' && !x.afgeleid).map((x) => x.naam.toLowerCase() + ' ' + x.waarde +
    (x.aanname ? ' (' + x.aanname + ')' : ''));
  return c.titel + (v.length ? ': ' + v.join(', ') + '.' : '.') +
    (c.ontbreekt.length ? ' Wat ik nog nodig heb: ' + c.ontbreekt.join(' en ') + '.' : '') + ' ' + c.volgende +
    ' Er is niets ingediend of geboekt.';
}

module.exports = { leesReiswens, reiswens, conceptVan, zinVan, geld };
