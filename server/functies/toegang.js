/* Functieschakelaars (deelmodule): de toegangsmotor: pad-matching (langste
   prefix wint), de aan/uit-assen (globaal, doelgroep, land, persoon) en de
   nette blokkadereden voor de gebruiker. */
const { inCanary } = require('./canaryas');
const { CATEGORIEEN, DOELGROEPEN, DOELGROEP_IDS, DOELGROEP_OP_ID, LEDEN, LEDEN_RTF, FUNCTIES, OP_ID, KOPPELS } = require('./register');
const { prefixLengte, functieVoorPad } = require('./toegangpad');

// Staat deze functie GLOBAAL aan volgens de bewaarde stand (of de standaard)?
function functieAan(id, staat) {
  const f = OP_ID[id];
  if (!f) return true; // onbekende id blokkeert nooit
  const s = staat && staat[id];
  return s ? s.aan !== false : f.standaard;
}

// Een gemelde storing op deze functie (of null). Puur een statusvlag: het
// blokkeert het verkeer niet (dat doet de aan/uit-schakelaar), maar kleurt de
// functie oranje op het bord.
function functieStoring(id, staat) {
  const s = staat && staat[id];
  return (s && s.storing) ? s.storing : null;
}
// De stoplicht-status van een functie: 'uit' (rood), 'storing' (oranje) of
// 'aan' (groen). Uit wint van storing: een bewust uitgezette functie is rood.
function functieStatus(id, staat) {
  if (!functieAan(id, staat)) return 'uit';
  if (functieStoring(id, staat)) return 'storing';
  return 'aan';
}

// Staat deze functie aan voor een specifieke doelgroep? Globaal uit = overal uit.
// Anders wint een eigen per-doelgroep-stand; zonder eigen stand geldt de globale.
function functieAanVoor(id, doelgroep, staat) {
  if (!functieAan(id, staat)) return false;
  if (!doelgroep) return true;
  const s = staat && staat[id];
  const pd = s && s.perDoelgroep;
  if (pd && Object.prototype.hasOwnProperty.call(pd, doelgroep)) return pd[doelgroep] !== false;
  return true;
}

// Is deze functie beschikbaar voor een concreet verzoek? ctx = { doelgroep,
// land, persoon, genre }. Elke expliciete false (op welke as dan ook) blokkeert.
// Geeft de reden terug: 'globaal' | 'pas' | 'land' | 'persoon' | 'genre' | null.
function blokkadeReden(id, staat, ctx) {
  if (!functieAan(id, staat)) return 'globaal';
  const s = staat && staat[id];
  const c = ctx || {};
  if (s) {
    if (c.doelgroep && s.perDoelgroep && s.perDoelgroep[c.doelgroep] === false) return 'pas';
    if (c.land && s.perLand && s.perLand[c.land] === false) return 'land';
    // per PLAATS (stad of dorp): fijner dan het land, grover dan de persoon.
    // De sleutel is de genormaliseerde woonplaats van het lid (plaatsNorm).
    if (c.plaats && s.perPlaats && s.perPlaats[c.plaats] === false) return 'plaats';
    if (c.persoon && s.perPersoon && s.perPersoon[c.persoon] === false) return 'persoon';
    // de leveranciers-regie: een functie kan per GENRE zaken dicht (bijv. RTG
    // Eye niet voor horeca); het genre komt uit de zaak achter het verzoek
    if (c.genre && s.perGenre && s.perGenre[c.genre] === false) return 'genre';
  }
  // de STANDAARD-matrix: een functie met alleenGenres is voor andere genres
  // standaard dicht; een expliciete uitzondering (perGenre true) opent hem
  if (c.genre) {
    const f = OP_ID[id];
    const uitzondering = s && s.perGenre && s.perGenre[c.genre] === true;
    if (f && Array.isArray(f.alleenGenres) && !f.alleenGenres.includes(c.genre) && !uitzondering) return 'genre';
  }
  /* DE CANARY-AS staat als laatste, want hij is de fijnste: hij zegt niet OF
     een functie open is maar VOOR HOEVEEL van de mensen. Zonder canary-stand
     verandert er niets; dit is puur additief. */
  if (s && s.canary && !inCanary(id, s.canary, c)) return 'canary';
  return null;
}

// Staat er ergens een standaard-genre-matrix in de catalogus? Dan moet de
// middleware het genre ook opzoeken als er (nog) geen bewaarde regels zijn.
const HEEFT_GENRE_STANDAARD = FUNCTIES.some(f => Array.isArray(f.alleenGenres));
/* Staat er ergens een functie die STANDAARD UIT is? De middleware heeft een
   snelle uitgang voor "er is nog nooit iets geschakeld, dus alles staat aan".
   Die uitgang klopt alleen zolang elke functie standaard AAN is. Zodra er een
   functie bijkomt die standaard uit hoort te staan, zou die op een verse
   installatie gewoon openstaan -- precies het omgekeerde van wat "standaard
   uit" betekent. */
const HEEFT_UIT_STANDAARD = FUNCTIES.some(f => f.standaard === false);
// Staan er ergens land-regels? Zo niet, dan hoeft de middleware het land van het
// lid niet op te zoeken (scheelt een opzoeking per verzoek).
function heeftLandRegels(staat) {
  if (!staat) return false;
  for (const id of Object.keys(staat)) { const pl = staat[id] && staat[id].perLand; if (pl && Object.keys(pl).length) return true; }
  return false;
}
/* Een plaatsnaam als schakelsleutel. Een plaats heeft, anders dan een land,
   geen codetabel: mensen schrijven "Den Haag", "den haag" en "'s-Gravenhage".
   Wij normaliseren spelling (kleine letters, een spatie, accenten weg) maar
   verzinnen GEEN gelijkstellingen -- dat zou stil twee plaatsen samenvoegen.
   Dezelfde functie draait aan de schakelkant en aan de meetkant, dus wat de
   eigenaar intikt matcht wat het lid invulde, hoe ze ook typten. */
function plaatsNorm(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z' -]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40) || null;
}
// Staan er ergens plaats-regels? Zo niet, dan hoeft de middleware de
// woonplaats van het lid niet op te zoeken.
function heeftPlaatsRegels(staat) {
  if (!staat) return false;
  for (const id of Object.keys(staat)) { const pp = staat[id] && staat[id].perPlaats; if (pp && Object.keys(pp).length) return true; }
  return false;
}
// Staan er ergens genre-regels? Zo niet, dan hoeft de middleware de zaak
// achter een leveranciers-/personeelsverzoek niet op te zoeken.
function heeftGenreRegels(staat) {
  if (!staat) return false;
  for (const id of Object.keys(staat)) { const pg = staat[id] && staat[id].perGenre; if (pg && Object.keys(pg).length) return true; }
  return false;
}

/* Tegenhangers volgen. Na een schakeling van functie `id` krijgen de
   gekoppelde functies (KOPPELS in de catalogus) dezelfde effectieve stand,
   zodat er nooit een halve dienst overblijft. "Effectief aan" is de "nog
   publiek?"-vraag: globaal aan EN minstens een doelgroep open. Muteert de
   staat (de aanroeper bewaart) en geeft terug wat er meeging; alleen directe
   partners, geen kettingreacties. Per-doelgroep fijnregeling op de
   tegenhanger zelf blijft staan en kan hem alsnog dicht houden. */
function volgKoppels(id, staat) {
  const gevolgd = [];
  const bron = OP_ID[id];
  if (!bron || !staat) return gevolgd;
  const effectief = f => functieAan(f.id, staat) && (f.doelgroepen || []).some(dg => functieAanVoor(f.id, dg, staat));
  for (const k of KOPPELS) {
    const anderId = k.a === id ? k.b : (k.b === id ? k.a : null);
    if (!anderId) continue;
    const ander = OP_ID[anderId];
    const stand = effectief(bron);
    if (effectief(ander) === stand) continue; // al gelijk: niets te doen
    if (!staat[anderId]) staat[anderId] = {};
    staat[anderId].aan = stand;
    gevolgd.push({ functie: anderId, naam: ander.naam, aan: stand, want: k.uitleg });
  }
  return gevolgd;
}

/* Kernvraag voor de middleware: is dit pad geblokkeerd (voor dit verzoek)?
   ctx = { doelgroep, land, persoon }. Geeft { functie, reden } terug of null.
   Een simpele string als ctx wordt als doelgroep gelezen (achterwaarts compat). */
function padGeblokkeerd(pad, staat, ctx) {
  const f = functieVoorPad(pad);
  if (!f) return null;                       // niet door een functie bewaakt -> altijd vrij
  if (typeof ctx === 'string') ctx = { doelgroep: ctx };
  const reden = blokkadeReden(f.id, staat, ctx);
  if (!reden) return null;
  return { id: f.id, naam: f.naam, categorie: f.categorie, paden: f.paden, doelgroepen: f.doelgroepen, reden };
}

// De volledige catalogus met de huidige stand, geordend per categorie (voor het
// bord). Elke functie toont de globale stand plus haar doelgroepen met eigen stand.

/* WIE BELT ER STAAT IN ./doelgroep, en dat is geen willekeurige snede. Dit
   bestand beantwoordt "mag dit pad" -- prefixen, schakelaars, redenen. Dat
   andere beantwoordt "wie is de beller", en dat werd een eigen onderwerp toen
   WorkOS zijn relatie tot een organisatie liet meetellen (WERELDEN.md). Ze
   worden hier samen doorgegeven, zodat geen enkele beller iets hoeft te weten
   van de opdeling. */
const { doelgroepVanVerzoek, tierNaarDoelgroep, WERKPADEN } = require('./doelgroep');

module.exports = { prefixLengte, functieVoorPad, functieAan, functieAanVoor, functieStoring, functieStatus,
  heeftLandRegels, heeftPlaatsRegels, plaatsNorm, heeftGenreRegels, HEEFT_GENRE_STANDAARD, HEEFT_UIT_STANDAARD, blokkadeReden, padGeblokkeerd,
  doelgroepVanVerzoek, tierNaarDoelgroep, WERKPADEN, volgKoppels, inCanary };
