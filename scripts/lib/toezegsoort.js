/* ============================================================================
   DE TWEEDE EN DERDE AS VAN DE TOEZEGKLASSEN -- soort, afwijzing en voorziening
   (AFBOUWPROGRAMMA.md par. 6a, ronde 2, 11 oktober 2026).

   De klasse zegt OF iets gebouwd wordt (toegezegd, afgewezen, geblokkeerd). Dat
   is niet genoeg om er werk van te maken: 879 toezeggingen lezen als 879
   projecten, terwijl een deel ervan een GRENS is (geen bouwbaar ding), een deel
   een rij die zichzelf afwijst, en het meeste aan een handvol voorzieningen
   hangt die de bron zelf noemt. Drie lezingen, alle drie deterministisch, en
   waar een regel niets zegt staat er `onbepaald` met de reden -- nooit een gok.

   1. AFWIJZING IN DE RIJ. Een tabelrij met de stand "jaren weg" kan in dezelfde
      cel zeggen dat het onderdeel er NIET komt ("Als engine of autoriteit komt
      hij er niet", EDGE.md par. 9 punt 50; "botst met de bewaartermijnen",
      VERANDERING.md par. 3 punt 17). Dat is geen toezegging. De formule is met
      opzet SMAL: alleen een voornaamwoord dat naar het onderdeel zelf wijst
      ("komt hij er niet") of een botsing met een GRENS ("botst met de ...").
      Een bredere vorm ("er komt geen ...") ving bij meting zes rijen die een
      VOORWAARDE stellen ("er komt geen zevende naam") en niets afwijzen; die
      zijn met de hand nagelezen en blijven toegezegd.

   2. SOORT. Vier soorten en een rest, gesloten:
        product     een plek die een mens opent (app, scherm, deck, cockpit, of
                    een eigen "RTG <Naam>")
        integratie  een verbinding tussen twee bestaande dingen (brug, koppeling,
                    doorgave, aansluiten, A -> B, tussen apparaten of werelden)
        eis         een gedrag, grens of garantie en geen bouwbaar ding: een
                    normatieve zin (elke/geen/nooit/mag/moet/blijft) of een rij
                    onder een kop over grenzen, wetten of regels
        functie     een korte naamwoordgroep (hooguit acht woorden) zonder enig
                    signaal van de drie hierboven en zonder werkwoord
        onbepaald   geen regel past, of twee regels spreken elkaar tegen; de
                    reden staat erbij, en onbepaald wordt NOOIT bij een soort
                    opgeteld
      De signalen staan hieronder als lijsten; elk item draagt `soortGrond`, de
      regel die vuurde, zodat een verkeerde indeling naar zijn regel te volgen is.

   3. VOORZIENING. Een rij noemt vaak zelf de module of keten waar hij aan hangt
      (`kern/stuur/mandaat.js`, `lib/keten.js`, de ritproef). Die verwijzingen
      worden gelezen, genormaliseerd tot een voorziening (`kern/stuur`,
      `lib/keten`, `keten:ritproef`) en tegen de boom gehouden: bestaat hij in
      server/ of scripts/? Zo leest de inventaris als een handvol voorzieningen
      met hun toezeggingen erachter, en blijft zichtbaar welke rijen niets
      noemen. Een rij zonder backtick-verwijzing krijgt geen geraden voorziening.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const SOORTEN = {
  product: 'een plek die een mens opent: app, scherm, deck, cockpit, of een eigen "RTG <Naam>"',
  functie: 'een korte naamwoordgroep zonder product-, integratie- of eissignaal en zonder werkwoord',
  integratie: 'een verbinding tussen twee bestaande dingen: brug, koppeling, doorgave, aansluiten, A -> B',
  eis: 'een gedrag, grens of garantie, geen bouwbaar ding: een normatieve zin of een rij onder een kop over grenzen of regels'
};

/* De smalle afwijzingsformule (zie de kop, punt 1). */
const AFWIJZING = /\b(?:komt|komen) (?:hij|zij|het|ze) er niet\b|\bbotst met (?:de|het|een|grens)\b/i;

const SIGNAAL = {
  eisBegin: /^(?:elke|elk|ieder|iedere|alle|geen|nooit|altijd|niets|niemand|no|never|every|each)\b/i,
  /* Een bevinding in de verleden tijd ("employment.js verwees naar ...") is een
     reparatie of een vondst, geen soort bouwwerk. */
  verleden: /\b(?:kon|konden|was|waren|verwees|leverde|leverden|toetsten|toetste|schreven|schreef|liet|lieten|gaf|gaven|stond|stonden|vond|las)\b/i,
  eisModaal: /\b(?:mag|mogen|moet|moeten|nooit|blijft|blijven)\b/i,
  eisKop: /grens|grenzen|\bwet(?:ten)?\b|\bregels?\b|garantie|invariant|sneuvelen|grondwet|doctrine/i,
  integratie: /(?:→|->|↔|⇄|\bbrug\b|bruggen|koppel|aansluit|integratie|doorgave|federatie|over (?:de )?werelden|tussen (?:werelden|apps|domeinen|apparaten)|cross-app|ander apparaat|handoff|consentbrug)/i,
  product: /\b(?:app|apps|scherm|schermen|portaal|winkel|store|pagina|dashboard|cockpit|inbox|deck)\b|^RTG [A-Z][a-z]+/,
  werkwoord: /\b(?:is|zijn|wordt|worden|heeft|hebben|draagt|dragen|gaat|komt|ziet|toont|zegt|eist|weigert|stelt|beslist|verandert|telt|loopt|kan|kunnen|krijgt|leest|schrijft|vraagt|levert|bestaat|bestaan|ontbreekt|doet|maakt)\b/i
};

function soortVan(onderdeel, sectie) {
  const o = String(onderdeel || '').replace(/^[#A-Z]{0,4}-?\d+[a-z]?\.?\s+/, '').trim();
  if (SIGNAAL.verleden.test(o)) return { soort: 'onbepaald', soortGrond: 'een bevinding in de verleden tijd ("' + SIGNAAL.verleden.exec(o)[0] + '"): een vondst of reparatie, geen soort' };
  const signalen = [];
  if (SIGNAAL.eisBegin.test(o)) signalen.push(['eis', 'begint met een normatief woord']);
  else if (SIGNAAL.eisModaal.test(o)) signalen.push(['eis', 'bevat een modaal of normatief werkwoord']);
  else if (sectie && SIGNAAL.eisKop.test(sectie)) signalen.push(['eis', 'staat onder een kop over grenzen of regels: "' + sectie.slice(0, 60) + '"']);
  if (SIGNAAL.integratie.test(o)) signalen.push(['integratie', 'noemt een verbinding: "' + SIGNAAL.integratie.exec(o)[0] + '"']);
  if (SIGNAAL.product.test(o)) signalen.push(['product', 'noemt een plek om te openen: "' + SIGNAAL.product.exec(o)[0] + '"']);
  const soorten = [...new Set(signalen.map((s) => s[0]))];
  if (soorten.length > 1) return { soort: 'onbepaald', soortGrond: 'twee regels spreken elkaar tegen: ' + soorten.join(' + ') };
  if (soorten.length === 1) return { soort: soorten[0], soortGrond: signalen[0][1] };
  if (!o) return { soort: 'onbepaald', soortGrond: 'geen onderdeelnaam' };
  if (SIGNAAL.werkwoord.test(o)) return { soort: 'onbepaald', soortGrond: 'een zin zonder normatief woord: gedrag of functie is er niet uit af te lezen' };
  if (o.split(/\s+/).length > 8) return { soort: 'onbepaald', soortGrond: 'langer dan acht woorden: geen naam maar een omschrijving' };
  return { soort: 'functie', soortGrond: 'korte naamwoordgroep zonder product-, integratie- of eissignaal (regel F)' };
}

/* Een verwijzing tussen backticks naar een voorziening, genormaliseerd. */
const PAD = /^(?:server\/)?((?:kern|lib|routes|opzet|db|webauthn|betaal|web|middleware)\/[\w\-./]+?)(?:\.js)?(?:[:(].*)?$/;
const KETEN = /\b(tafelproef|ritproef|toelatingsproef|adamproef|lusproef|momentproef|herstelproef|romeproef|tegenvoorbeeld)\b/g;

function normaliseer(p) {
  const delen = p.split('/');
  if (delen.length >= 3) return delen.slice(0, 2).join('/');
  return delen.join('/').replace(/\.js$/, '');
}

function voorzieningenVan(citaat) {
  const uit = new Set();
  for (const m of String(citaat).matchAll(/`([^`]+)`/g)) {
    const p = PAD.exec(m[1].trim());
    if (p) uit.add(normaliseer(p[1].replace(/\/$/, '')));
  }
  for (const m of String(citaat).matchAll(KETEN)) uit.add('keten:' + m[1]);
  return [...uit].sort();
}

function voorzieningBestaat(wortel, v) {
  if (v.startsWith('keten:')) {
    const n = v.slice(6);
    return fs.existsSync(path.join(wortel, 'scripts', n + '.js'));
  }
  const basis = path.join(wortel, 'server', v);
  return fs.existsSync(basis) || fs.existsSync(basis + '.js');
}

module.exports = { SOORTEN, AFWIJZING, SIGNAAL, soortVan, voorzieningenVan, voorzieningBestaat };
