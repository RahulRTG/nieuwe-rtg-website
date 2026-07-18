/* Functieschakelaars (deelmodule): de toegangsmotor: pad-matching (langste
   prefix wint), de aan/uit-assen (globaal, doelgroep, land, persoon) en de
   nette blokkadereden voor de gebruiker. */
const { CATEGORIEEN, DOELGROEPEN, DOELGROEP_IDS, DOELGROEP_OP_ID, LEDEN, LEDEN_RTF, FUNCTIES, OP_ID } = require('./register');
function prefixLengte(pad, prefix) {
  if (!pad.startsWith(prefix)) return 0;
  const rest = pad.slice(prefix.length);
  return (rest === '' || rest[0] === '/') ? prefix.length : 0;
}

// De meest specifieke functie die dit pad bewaakt (langste prefix wint), of null.
function functieVoorPad(pad) {
  let beste = null, besteLen = 0;
  for (const f of FUNCTIES) {
    for (const p of f.paden) {
      const len = prefixLengte(pad, p);
      if (len > besteLen) { besteLen = len; beste = f; }
    }
  }
  return beste;
}

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
  if (!s) return null;
  const c = ctx || {};
  if (c.doelgroep && s.perDoelgroep && s.perDoelgroep[c.doelgroep] === false) return 'pas';
  if (c.land && s.perLand && s.perLand[c.land] === false) return 'land';
  if (c.persoon && s.perPersoon && s.perPersoon[c.persoon] === false) return 'persoon';
  // de leveranciers-regie: een functie kan per GENRE zaken dicht (bijv. RTG
  // Eye niet voor horeca); het genre komt uit de zaak achter het verzoek
  if (c.genre && s.perGenre && s.perGenre[c.genre] === false) return 'genre';
  return null;
}
// Staan er ergens land-regels? Zo niet, dan hoeft de middleware het land van het
// lid niet op te zoeken (scheelt een opzoeking per verzoek).
function heeftLandRegels(staat) {
  if (!staat) return false;
  for (const id of Object.keys(staat)) { const pl = staat[id] && staat[id].perLand; if (pl && Object.keys(pl).length) return true; }
  return false;
}
// Staan er ergens genre-regels? Zo niet, dan hoeft de middleware de zaak
// achter een leveranciers-/personeelsverzoek niet op te zoeken.
function heeftGenreRegels(staat) {
  if (!staat) return false;
  for (const id of Object.keys(staat)) { const pg = staat[id] && staat[id].perGenre; if (pg && Object.keys(pg).length) return true; }
  return false;
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

/* De doelgroep van een verzoek. Expliciete app-paden bepalen de doelgroep,
   ongeacht wie er inlogt (leveranciers, personeel, backoffice, foundation). Op
   de gedeelde leden- en Salon-paden volgt de doelgroep de pas van het account. */
function tierNaarDoelgroep(tier) {
  if (tier === 'lifestyle') return 'lifestyle';
  if (tier === 'business') return 'business';
  if (tier === 'rtg') return 'rtg';
  if (tier === 'guest') return 'gast'; // de gratis app is een eigen doelgroep
  return null; // onbekend: alleen de globale schakelaar telt
}
function doelgroepVanVerzoek(pad, user) {
  if (pad.startsWith('/api/supplier') || pad.startsWith('/api/partner')) return 'leverancier';
  if (pad.startsWith('/api/staff')) return 'personeel';
  if (pad.startsWith('/api/office')) return 'intern';
  if (pad.startsWith('/api/foundation')) return 'foundation';
  return user ? tierNaarDoelgroep(user.tier) : null;
}

// De volledige catalogus met de huidige stand, geordend per categorie (voor het
// bord). Elke functie toont de globale stand plus haar doelgroepen met eigen stand.

module.exports = { functieVoorPad, functieAan, functieAanVoor, functieStoring, functieStatus,
  heeftLandRegels, heeftGenreRegels, blokkadeReden, padGeblokkeerd, doelgroepVanVerzoek, tierNaarDoelgroep };
