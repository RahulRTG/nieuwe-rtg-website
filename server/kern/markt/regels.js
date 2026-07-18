/* Markt (deelmodule): de spelregels als pure data: de categorieen, de
   respect- en verbodslijsten, de oplichtingssignalen, de richtprijzen en
   de samen-betalen-drempels. Geen logica. */
const CATEGORIEEN = ['kleding', 'kids', 'wonen', 'elektronica', 'vrije-tijd', 'tuin', 'vervoer', 'boeken', 'sport', 'overig'];
const STATEN = ['nieuw', 'zgan', 'gebruikt'];
const LEVERING = ['ophalen', 'verzenden'];

// Respect: kwetsende / discriminerende taal (kort, uitbreidbaar).
const RESPECTLOOS = /\b(kanker|tering|hoer|kut(?:wijf|hoer)?|neger|mongool|flikker|nazi|homofiel scheldwoord)\b/i;
// Verboden waar: hier hoort niets van thuis, in geen enkele app.
const VERBODEN = [
  { rx: /\b(wapen|vuurwapen|pistool|geweer|patronen|munitie|mes\s*met|boksbeugel|taser|stroomstootwapen)\b/i, waarom: 'wapens' },
  { rx: /\b(cocaine|coke|xtc|mdma|wiet|hasj|speed|heroine|lsd|ghb|lachgas)\b/i, waarom: 'drugs' },
  { rx: /\b(medicijn(?:en)?|antibiotica|oxycodon|ritalin|viagra|afslankpil)\b/i, waarom: 'medicijnen' },
  { rx: /\b(namaak|replica|fake\s*merk|imitatie\s*merk|counterfeit)\b/i, waarom: 'namaak' },
  { rx: /\b(puppy|kitten|hond|kat|reptiel|papegaai)\s*(te koop|kopen)\b/i, waarom: 'levende dieren' }
];
// Veiligheid: signalen die op oplichting kunnen wijzen.
const SCAM_WOORDEN = /\b(vooruitbetal|aanbetaling vooraf|western union|moneygram|cadeaukaart(?:code)?|giftcard|tikkie\s*vooraf|betaal eerst|verzendkosten vooraf|buiten de app|whatsapp mij|bel mij op 06|paypal vrienden)\b/i;
const CONTACT_BUITEN = /(\+?\d[\d\s-]{7,}\d)|([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})|(https?:\/\/|www\.)/i;

// Ruwe richtprijs per categorie (voor de AI-prijssuggestie zonder externe data).
const RICHTPRIJS = {
  kleding: 15, kids: 12, wonen: 40, elektronica: 80, 'vrije-tijd': 25,
  tuin: 30, vervoer: 120, boeken: 6, sport: 35, overig: 20
};
const STAAT_FACTOR = { nieuw: 1.6, zgan: 1.1, gebruikt: 0.7 };

// Veilig samen betalen: de betaling komt pas vrij als beide GPS-posities bij
// elkaar zijn (fysiek samen bij de overhandiging), binnen deze straal en zo vers.
const SAMEN_METER = 150;
const SAMEN_VERS_MS = 10 * 60 * 1000;

module.exports = { CATEGORIEEN, STATEN, LEVERING, RESPECTLOOS, VERBODEN, SCAM_WOORDEN, CONTACT_BUITEN, RICHTPRIJS, STAAT_FACTOR, SAMEN_METER, SAMEN_VERS_MS };
