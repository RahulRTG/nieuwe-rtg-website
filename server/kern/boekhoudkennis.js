/* Boekhoudkennis per genre (kern/boekhoudkennis.js).

   Maakt de AI-boekhouder van een leverancier echt bruikbaar: per branche weet hij
   hoe de kostenstructuur eruitziet, welke kengetallen ertoe doen, waar de btw
   scheef kan lopen, hoe het seizoen speelt en welke valkuilen er zijn. Op basis
   daarvan geeft hij niet alleen antwoord, maar stuurt hij ook proactief bij met
   concrete adviezen op de eigen cijfers.

   Zuiver en zonder afhankelijkheden: profielen + een selector op het bedrijfstype
   + een advies-generator op de maandcijfers (fin uit financeVoor). */

function eur(n) { return '€ ' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pct(n) { return Math.round((Number(n) || 0) * 100) + '%'; }
/* De genreprofielen staan als pure data in een deelmodule; PROFIELEN wordt
   hieronder ongewijzigd mee geexporteerd. */
const { PROFIELEN } = require('./boekhoudkennis/profielen');

function genreProfiel(type) {
  const t = String(type || '').toLowerCase();
  if (/hotel|apartment|appartement|verblijf|resort|bnb/.test(t)) return PROFIELEN.hotel;
  if (/restaurant|cafe|caf.|bar|club|horeca|eten|food|bistro|brasserie/.test(t)) return PROFIELEN.horeca;
  if (/retail|mode|winkel|shop|boutique|kleding/.test(t)) return PROFIELEN.retail;
  if (/vervoer|taxi|transfer|chauffeur|transport|jet|charter|heli|vlucht/.test(t)) return PROFIELEN.vervoer;
  if (/verhuur|rental|autoverhuur|car/.test(t)) return PROFIELEN.verhuur;
  if (/vastgoed|makelaar|real.?estate|property/.test(t)) return PROFIELEN.vastgoed;
  if (/activ|ticket|experience|tour|entree|attractie/.test(t)) return PROFIELEN.activiteiten;
  if (/groothandel|wholesale/.test(t)) return PROFIELEN.groothandel;
  if (/beveilig|security/.test(t)) return PROFIELEN.beveiliging;
  if (/zzp|zelfstandig|freelance/.test(t)) return PROFIELEN.zzp;
  return PROFIELEN.default;
}

// Omzet deze maand uit de btw-regels (grondslag + btw = omzet incl. btw).
function omzetVan(fin) {
  return (fin.btw || []).reduce((s, r) => s + (r.omzet || 0), 0);
}

/* Proactieve adviezen op de eigen maandcijfers: concrete, genre-bewuste tips die
   de ondernemer aansturen. Geeft een lijst { titel, tekst } terug. */
function adviezen(supplier, fin) {
  const p = genreProfiel(supplier.type);
  const omzet = omzetVan(fin);
  const loon = (fin.personeel && fin.personeel.totaal) || 0;
  const btw = fin.btwTotaal || 0;
  const netto = Math.round((omzet - btw - loon) * 100) / 100;
  const lijst = [];

  // 1. Reserveer de btw, altijd.
  if (btw > 0) lijst.push({ titel: 'Zet uw btw apart', tekst: 'Reserveer nu ' + eur(btw) + ' voor de btw-aangifte. Dat geld is niet van u; zet het op een aparte rekening zodra het binnenkomt, dan komt de aangifte nooit ongelegen. ' + (fin.land && fin.regels && fin.regels[0] ? '' : '') });

  // 2. Personeelskosten toetsen aan een gezonde norm.
  if (omzet > 0 && loon > 0) {
    const q = loon / omzet;
    if (q > 0.4) lijst.push({ titel: 'Personeelskosten aan de hoge kant', tekst: 'Uw loonkosten zijn ' + pct(q) + ' van de omzet (' + eur(loon) + ' op ' + eur(omzet) + '). Voor ' + p.label.toLowerCase() + ' is onder 30-35% gezonder. Kijk of de planning meebeweegt met de drukte, of dat de omzet per uur omhoog kan.' });
    else if (q < 0.28) lijst.push({ titel: 'Ruimte in de bezetting', tekst: 'Uw loonkosten zijn ' + pct(q) + ' van de omzet, dat is efficient. Let op dat de kwaliteit en de rust in het team niet onder druk staan bij drukte.' });
  }

  // 3. Wat blijft er over.
  if (omzet > 0) {
    if (netto < 0) lijst.push({ titel: 'Deze maand loopt het krap', tekst: 'Na btw en loon blijft er ' + eur(netto) + ' over, en dan komen inkoop, huur en energie nog. Kijk kritisch naar de inkoop en de prijzen; ' + p.valkuilen });
    else lijst.push({ titel: 'Wat u overhoudt', tekst: 'Na btw en loon resteert ' + eur(netto) + ' voor inkoop, huur en de rest. RTG rekent 0% commissie, dus de omzet is volledig van u. Houd hiervan een deel apart als buffer voor de rustige maanden.' });
  }

  // 4. Cadeaukaarten als verplichting.
  if (fin.giftcards && fin.giftcards.open > 0) lijst.push({ titel: 'Cadeaukaarten zijn een verplichting', tekst: 'Er staat ' + eur(fin.giftcards.open) + ' aan cadeaukaarten open. Dat is nog geen omzet maar een schuld aan uw klanten; pas bij inwisseling boekt u omzet met btw. Houd er liquiditeit voor achter de hand.' });

  // 5. Een genre-specifiek kengetal om op te sturen.
  lijst.push({ titel: 'Waar u op kunt sturen', tekst: 'Voor ' + p.label.toLowerCase() + ' zijn dit de cijfers die ertoe doen: ' + p.kpis + ' Let daarbij op: ' + p.btwlet });

  return { genre: p.label, omzet, loon, btw, netto, adviezen: lijst.slice(0, 6) };
}

/* Rijke context voor de AI: het genre-profiel plus de eigen cijfers, zodat de
   AI-boekhouder branchegericht en concreet kan antwoorden. */
function systeemContext(supplier, fin, landNaam) {
  const p = genreProfiel(supplier.type);
  const omzet = omzetVan(fin);
  const loon = (fin.personeel && fin.personeel.totaal) || 0;
  return [
    'Branche: ' + p.label + ' (' + supplier.type + ').',
    'Kostenstructuur: ' + p.kosten,
    'Kengetallen die ertoe doen: ' + p.kpis,
    'Btw-aandachtspunten: ' + p.btwlet,
    'Seizoen: ' + p.seizoen,
    'Veelvoorkomende valkuilen: ' + p.valkuilen,
    'Cijfers deze maand (' + fin.maand + ', ' + (landNaam || fin.landNaam || '') + '): omzet ' + eur(omzet) + ', af te dragen btw ' + eur(fin.btwTotaal || 0) + ', loonkosten ' + eur(loon) + ' (' + fin.personeel.uren + ' uur), cadeaukaarten open ' + eur((fin.giftcards && fin.giftcards.open) || 0) + '.'
  ].join(' ');
}

module.exports = { genreProfiel, adviezen, systeemContext, omzetVan, PROFIELEN };
