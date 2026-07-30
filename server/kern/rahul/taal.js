/* Geen AI-taal.

   Er is een manier van praten die je meteen verraadt als machine: "Als
   AI-assistent kan ik...", "Natuurlijk! Ik ga dat direct voor je regelen!",
   "Ik hoop dat dit helpt!", "Laat het me vooral weten!". Het is beleefd, het
   is leeg, en het klinkt naar niemand. Rahul is een persoon; die praat zo
   niet.

   Twee lagen, met opzet:

   1. REGELS in de prompt (TAALREGELS). Dat lost het meeste op zolang er een
      echte AI-sleutel is.
   2. Een SCHROBBER (schrob) over de uitvoer. Want de prompt is een verzoek,
      geen garantie: modellen vallen onder druk terug in hun standaardtoon, en
      de vaste demo-antwoorden zonder API-sleutel gaan sowieso niet door een
      model heen. Wat er echt uitgaat, gaat hierlangs.

   De schrobber is bewust dom en voorzichtig: hij knipt bekende openings- en
   sluitfrases weg en laat de rest met rust. Liever een cliche gemist dan een
   zin verminkt die iets betekende. */

const TAALREGELS = [
  'Je praat als een mens, niet als een assistent. Verboden, altijd: jezelf aankondigen als AI of ' +
  'taalmodel ("als AI kan ik", "ik ben maar een AI"), uitgelaten dienstbaarheid ("Natuurlijk!", ' +
  '"Absoluut!", "Graag gedaan!", "Ik ga dat direct voor je regelen!"), en de holle afsluiters ' +
  '("Ik hoop dat dit helpt", "Laat het me weten als je nog vragen hebt", "Voel je vrij om...", ' +
  '"Heb je verder nog vragen?"). Ook geen zelfbeschrijving vooraf ("Laat me je helpen", ' +
  '"Ik zal proberen", "Het is belangrijk om op te merken dat", "Duik erin", "Ontgrendel"). ' +
  'Geen uitroeptekens uit enthousiasme dat je niet voelt.',

  'Begin met het antwoord. Niet met een samenvatting van de vraag, niet met een compliment over ' +
  'de vraag ("Goede vraag!"), niet met een aanloopje. Eindig als je klaar bent; een gesprek heeft ' +
  'geen afsluitformule nodig. Weet je iets niet, dan zeg je dat in vier woorden en niet in drie zinnen.',

  'Je hebt een mening en die mag je hebben. Op een directe vraag geef je een antwoord, geen ' +
  'overzicht van alle mogelijke kanten. Vind je iets een slecht idee, dan zeg je dat, met de reden. ' +
  'Rammelt iemands plan, dan zeg je waar. Niet onaardig; wel eerlijk. Een braaf antwoord dat niemand ' +
  'verder helpt is erger dan een ongemakkelijk antwoord dat klopt.'
];

/* Wat er weggeknipt wordt. Alleen aan het BEGIN of het EIND van een antwoord;
   midden in een zin kan zo'n zinnetje echt iets betekenen. */
const OPENERS = [
  /^\s*(natuurlijk|absoluut|zeker(weten)?|uiteraard|jazeker|prima|geweldig|perfect|goede vraag|leuke vraag|interessante vraag|dat is een goede vraag)\s*[!,.:]+\s*/i,
  /^\s*als (een )?(ai|kunstmatige intelligentie|taalmodel|assistent)[^.!?]*[.!?]\s*/i,
  /^\s*(ik ga (dat|dit) (direct|meteen) voor je regelen|laat me je helpen|laat me even kijken|ik zal (proberen|mijn best doen))\s*[!,.:]*\s*/i,
  /^\s*(het is belangrijk om (op te merken|te vermelden|te weten) dat)\s*/i,
  /^\s*(certainly|of course|absolutely|sure thing|great question)\s*[!,.:]+\s*/i
];
/* De staart mag hoogstens 25 tekens doorlopen na de cliche-woorden. Zonder die
   rem at "ik hoop dat dit helpt bij je keuze, maar de tweede optie is beter"
   zichzelf op tot het eind van de zin, en verdween er echte inhoud. Een cliche
   is kort; wat erna nog komt is meestal iets wat er wel toe doet. */
const SLUITERS = [
  /\s*ik hoop dat (dit|dat) helpt[^.!?]{0,25}[.!?]?\s*$/i,
  /\s*laat (het )?me (vooral )?weten(?: als je (nog )?(meer )?(vragen|hulp)[^.!?]{0,25})?[.!?]?\s*$/i,
  /\s*heb je (verder )?nog (vragen|iets)[^.!?]{0,25}[?!.]?\s*$/i,
  /\s*voel je vrij om[^.!?]{0,25}[.!?]\s*$/i,
  /\s*aarzel niet om[^.!?]{0,25}[.!?]\s*$/i,
  /\s*ik sta (voor je )?klaar[^.!?]{0,25}[.!?]\s*$/i,
  /\s*i hope (this|that) helps[^.!?]{0,25}[.!?]?\s*$/i,
  /\s*let me know if[^.!?]{0,25}[.!?]?\s*$/i,
  /\s*feel free to[^.!?]{0,25}[.!?]\s*$/i
];

/* Schrobben. Blijft er niets over (het antwoord bestond alleen uit beleefdheid),
   dan geven we de oorspronkelijke tekst terug: liever een cliche dan een leeg
   antwoord. */
function schrob(tekst) {
  let t = String(tekst == null ? '' : tekst);
  const oorspronkelijk = t;
  let vorige;
  do {
    vorige = t;
    for (const r of OPENERS) t = t.replace(r, '');
  } while (t !== vorige);
  do {
    vorige = t;
    for (const r of SLUITERS) t = t.replace(r, '');
  } while (t !== vorige);
  t = t.replace(/\n{3,}/g, '\n\n').trim();
  if (!t) return oorspronkelijk.trim();
  // eerste letter weer een hoofdletter als we een opener wegknipten
  if (t !== oorspronkelijk.trim() && /^[a-z]/.test(t)) t = t[0].toUpperCase() + t.slice(1);
  return t;
}

/* Voor de tests en de keuring: zit er nog AI-taal in? Geeft de gevonden
   frases terug (leeg = schoon). Kijkt door de hele tekst, niet alleen aan de
   randen, want als toets willen we juist streng zijn. */
const VERDACHT = [
  /\bals (een )?(ai|taalmodel|kunstmatige intelligentie)\b/i,
  /\bik hoop dat (dit|dat) helpt\b/i,
  /\blaat het me weten als je\b/i,
  /\bvoel je vrij om\b/i,
  /\bheb je verder nog vragen\b/i,
  /\bi hope this helps\b/i,
  /\blet me know if you\b/i,
  /\bfeel free to\b/i,
  /\bals ai-assistent\b/i,
  /\bhet is belangrijk om op te merken\b/i
];
function ruikt(tekst) {
  const t = String(tekst || '');
  return VERDACHT.filter(r => r.test(t)).map(r => String(r));
}

module.exports = { TAALREGELS, schrob, ruikt, OPENERS, SLUITERS };
