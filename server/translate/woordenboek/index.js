/* Vertaallaag (deelmodule): de woordenboeken. NL2EN dekt de vaste seed-inhoud
   (./nl2en), WORDS_NL_EN/WORDS_EN_NL de woord-voor-woord terugval, EN2NL is de
   afgeleide omkering. Pure data, geen logica. */
const NL2EN = require('./nl2en');

/* Veelgebruikte woorden voor de woord-voor-woord terugval (demo zonder API).
   Niet perfect, maar geeft de ontvanger een leesbaar idee in zijn eigen taal. */
const WORDS_NL_EN = {
  'hallo':'hello','hoi':'hi','dank':'thanks','dankjewel':'thank you','bedankt':'thanks','alsjeblieft':'please',
  'ja':'yes','nee':'no','graag':'gladly','mooi':'beautiful','prachtig':'gorgeous','geweldig':'great',
  'reis':'trip','reizen':'travel','hotel':'hotel','kamer':'room','diner':'dinner','lunch':'lunch','ontbijt':'breakfast',
  'wanneer':'when','waar':'where','hoe':'how','welk':'which','welke':'which','wat':'what','wie':'who',
  'boeken':'to book','geboekt':'booked','prijs':'price','korting':'discount','betalen':'to pay','betaald':'paid',
  'ik':'I','je':'you','jij':'you','u':'you','wij':'we','met':'with','voor':'for','naar':'to','van':'from','in':'in','op':'on',
  'en':'and','of':'or','niet':'not','ook':'also','heel':'very','erg':'very','goed':'good','leuk':'nice','stad':'city',
  'strand':'beach','zon':'sun','weer':'weather','vraag':'question','antwoord':'answer','bericht':'message','groeten':'regards',
  'zie':'see','ik zie':'I see','morgen':'tomorrow','vandaag':'today','avond':'evening','ochtend':'morning',
  'restaurant':'restaurant','tafel':'table','fles':'bottle','wijn':'wine','koffie':'coffee','thee':'tea',
  'is':'is','ben':'am','was':'was','zijn':'are','heb':'have','heeft':'has','kan':'can','kunnen':'can','wil':'want','willen':'want'
};
const WORDS_EN_NL = Object.fromEntries(Object.entries(WORDS_NL_EN).map(([k, v]) => [v, k]));

const EN2NL = {};
for (const [nl, en] of Object.entries(NL2EN)) if (!(en in EN2NL)) EN2NL[en] = nl;

module.exports = { NL2EN, WORDS_NL_EN, WORDS_EN_NL, EN2NL };
