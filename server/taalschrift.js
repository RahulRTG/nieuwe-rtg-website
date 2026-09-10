/* ============================================================================
   HET SCHRIFTREGISTER -- in welk schrift hoort een taal geschreven te zijn?

   WAAROM DIT BESTAAT. De vertaalweg controleerde alleen de VORM van het
   modelantwoord (een JSON-lijst van de juiste lengte) en niets over de inhoud.
   Een gemeten proef liet zien dat zes faalvormen er ongehinderd doorheen komen,
   waaronder de ergste: het model antwoordt in het Engels terwijl er om Japans
   was gevraagd. Sinds de vertaalkast landt zo'n antwoord bovendien op schijf en
   wordt het voor iedere volgende bezoeker herhaald.

   Dit register maakt van "is dit antwoord uberhaupt in de gevraagde taal" een
   controleerbare vraag. Het is geen taalherkenning -- dat kan een regel code
   niet -- maar een SCHRIFTcontrole, en die is beslissend voor de 51 talen die
   niet in het Latijnse schrift worden geschreven.

   WAT HIJ NIET KAN, en dat hoort er even groot bij. Voor een Latijns-schriftige
   doeltaal zegt hij vrijwel niets: Engels, Nederlands en Zweeds delen hun
   letters, dus "het staat in het Latijnse schrift" sluit geen enkele van de drie
   uit. Die asymmetrie wordt niet weggepoetst maar gemeld (`beslissend`), zodat
   een groen vinkje bij Frans niet hetzelfde gewicht krijgt als bij Japans.

   MEER DAN EEN SCHRIFT PER TAAL, want dat is de werkelijkheid en niet een
   toegeving. Servisch wordt in beide schriften geschreven en beide zijn
   officieel; Koerdisch is Latijns in Turkije en Arabisch in Irak; Japans mengt
   drie schriften in een zin. Een register dat er een verplicht stelt, zou juist
   correcte vertalingen afwijzen -- en dat is een ergere fout dan er een
   doorlaten, want de gebruiker ziet dan helemaal geen vertaling.

   DE BRON. De toewijzingen zijn de gangbare schrijfwijze per taal (ISO 15924).
   Ze staan hier als BEWERING, en `test/taalschrift.test.js` houdt ze tegen een
   ONAFHANKELIJKE getuige: het wereld-kernwoordenboek, dat 113 talen met de hand
   geschreven kernwoorden draagt. Waar de twee elkaar tegenspreken, is er een
   fout -- in het register of in de tabel -- en zakt de toets. Twee bronnen die
   elkaar niet kennen, precies zoals ROUTEBRON.json naast SYMBOLEN.json.
   ========================================================================== */
'use strict';

/* Per taal de schriften waarin een antwoord AANVAARD wordt. De eerste is de
   gangbare; de rest staat erbij omdat hij in de praktijk voorkomt. */
const SCHRIFTEN = {
  // -- Latijns schrift ------------------------------------------------------
  nl: ['Latin'], en: ['Latin'], de: ['Latin'], fr: ['Latin'], es: ['Latin'],
  pt: ['Latin'], it: ['Latin'], ca: ['Latin'], gl: ['Latin'], eu: ['Latin'],
  ro: ['Latin'], tr: ['Latin'], pl: ['Latin'], cs: ['Latin'], sk: ['Latin'],
  hu: ['Latin'], hr: ['Latin'], sl: ['Latin'], sq: ['Latin'], lt: ['Latin'],
  lv: ['Latin'], et: ['Latin'], fi: ['Latin'], sv: ['Latin'], no: ['Latin'],
  da: ['Latin'], is: ['Latin'], ga: ['Latin'], cy: ['Latin'], mt: ['Latin'],
  lb: ['Latin'], fy: ['Latin'], uz: ['Latin', 'Cyrillic'], tk: ['Latin', 'Cyrillic'],
  id: ['Latin'], jv: ['Latin'], su: ['Latin'], ms: ['Latin'], tl: ['Latin'],
  vi: ['Latin'], sw: ['Latin'], om: ['Latin'], so: ['Latin'],
  ha: ['Latin', 'Arabic'],   // Boko (Latijns) en Ajami (Arabisch)
  yo: ['Latin'], ig: ['Latin'], zu: ['Latin'], xh: ['Latin'], af: ['Latin'],
  st: ['Latin'], sn: ['Latin'], rw: ['Latin'], mg: ['Latin'], wo: ['Latin'],
  ln: ['Latin'], ny: ['Latin'], lg: ['Latin'], ht: ['Latin'], qu: ['Latin'],
  gn: ['Latin'], ay: ['Latin'], mi: ['Latin'], sm: ['Latin'], to: ['Latin'],
  fj: ['Latin'],
  az: ['Latin', 'Arabic', 'Cyrillic'],   // Latijns in Azerbeidzjan, Arabisch in Iran
  ku: ['Latin', 'Arabic'],               // Kurmanji Latijns, Sorani Arabisch
  bs: ['Latin', 'Cyrillic'],
  sr: ['Cyrillic', 'Latin'],             // beide officieel

  // -- Cyrillisch -----------------------------------------------------------
  ru: ['Cyrillic'], uk: ['Cyrillic'], be: ['Cyrillic'], bg: ['Cyrillic'],
  mk: ['Cyrillic'], kk: ['Cyrillic', 'Latin'], ky: ['Cyrillic'],
  tg: ['Cyrillic'], tt: ['Cyrillic', 'Latin'],
  mn: ['Cyrillic', 'Mongolian'],         // Cyrillisch in Mongolie, traditioneel in Binnen-Mongolie

  // -- Arabisch schrift -----------------------------------------------------
  ar: ['Arabic'], fa: ['Arabic'], ur: ['Arabic'], ps: ['Arabic'],
  ug: ['Arabic', 'Latin', 'Cyrillic'],
  sd: ['Arabic', 'Devanagari'],          // Arabisch in Pakistan, Devanagari in India

  // -- Overige schriften ----------------------------------------------------
  he: ['Hebrew'], yi: ['Hebrew'],
  el: ['Greek'], hy: ['Armenian'], ka: ['Georgian'],
  hi: ['Devanagari'], mr: ['Devanagari'], ne: ['Devanagari'],
  bn: ['Bengali'], as: ['Bengali'],
  pa: ['Gurmukhi', 'Arabic'],            // Gurmukhi in India, Shahmukhi in Pakistan
  gu: ['Gujarati'], or: ['Oriya'], ta: ['Tamil'], te: ['Telugu'],
  kn: ['Kannada'], ml: ['Malayalam'], si: ['Sinhala'], dv: ['Thaana'],
  bo: ['Tibetan'],
  zh: ['Han'],
  ja: ['Hiragana', 'Katakana', 'Han'],   // een Japanse zin mengt ze
  ko: ['Hangul', 'Han'],
  th: ['Thai'], lo: ['Lao'], my: ['Myanmar'], km: ['Khmer'],
  am: ['Ethiopic'], ti: ['Ethiopic']
};

/* Van rechts naar links geschreven schriften. De browserlaag zet `dir` al per
   taal; deze lijst staat hier zodat de keuring en de schil dezelfde bron lezen. */
const RTL_SCHRIFTEN = new Set(['Arabic', 'Hebrew', 'Thaana', 'Syriac']);

/* Een taal is BESLISSEND toetsbaar op schrift zodra zij het Latijnse schrift
   niet aanvaardt: dan sluit "er staat geen letter van dit schrift in" de
   vertaling werkelijk uit. Aanvaardt zij Latijn wel, dan zegt de controle
   alleen dat het geen Chinees is -- niet dat het de goede taal is. */
function beslissend(code) {
  const s = SCHRIFTEN[String(code || '').toLowerCase()];
  return !!s && !s.includes('Latin');
}

const TESTERS = new Map();
function tester(schrift) {
  let re = TESTERS.get(schrift);
  if (!re) { re = new RegExp('\\p{Script=' + schrift + '}', 'u'); TESTERS.set(schrift, re); }
  return re;
}

function schriftenVan(code) { return SCHRIFTEN[String(code || '').toLowerCase()] || null; }

/* Draagt deze tekst minstens EEN teken uit een van de aanvaarde schriften?
   Bewust "minstens een" en niet "uitsluitend": een Japanse zin mag een
   merknaam, een getal of een e-mailadres in Latijnse letters bevatten. */
function draagtSchrift(tekst, code) {
  const lijst = schriftenVan(code);
  if (!lijst) return null;                       // onbekende taal: geen oordeel
  const s = String(tekst == null ? '' : tekst);
  return lijst.some(sc => tester(sc).test(s));
}

/* Bevat de tekst uberhaupt letters? Een regel met alleen cijfers, leestekens of
   een merknaam is in elke taal hetzelfde en mag nooit op schrift zakken. */
const HEEFT_LETTER = /\p{L}/u;
function heeftLetters(tekst) { return HEEFT_LETTER.test(String(tekst == null ? '' : tekst)); }

function rtl(code) {
  const lijst = schriftenVan(code);
  return !!lijst && RTL_SCHRIFTEN.has(lijst[0]);
}

module.exports = { SCHRIFTEN, RTL_SCHRIFTEN, schriftenVan, draagtSchrift, heeftLetters, beslissend, rtl };
