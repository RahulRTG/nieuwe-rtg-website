/* DE GROEPSPOORT -- geen getal over zo weinig mensen dat het over een mens gaat.

   Een bedrijfsmaat die over mensen OPTELT (leden, personeel, gezinnen, zaken)
   draagt een minimale groepsgrootte. Daaronder levert deze poort GEEN waarde:
   geen nul, geen schatting, geen afgerond getal, en ook niet het aantal zelf --
   want "3 leden in Maastricht" is precies de informatie die de grens beschermt.
   Wat er wel uitkomt is een BETEKENIS: TE_KLEINE_GROEP, met de reden en de grens
   die werd toegepast.

   WAAROM HIER EN NIET IN HET SCHERM. Zou de grens pas bij het tonen vallen, dan
   krijgt alles daarvoor -- een lokaal model, een lens, een export -- het precieze
   getal nog wel, en leidt de machine af wat de Control Room verbergt. De poort
   staat daarom aan de bron van de maat: wie een waarde wil, gaat hierlangs.

   DE GRENS IS EEN ONDERGRENS PER KLASSE. Een maat mag strenger zijn dan zijn
   klasse, nooit soepeler. De tien voor leden is dezelfde als MINIMUM in
   kern/service/kwaliteit.js: daar staat al dat een verhouding over minder dan
   tien zaken niets zegt, en twee grenzen voor dezelfde vraag lopen uit elkaar.

   EEN ONBEKENDE GROEP IS GEEN KLEINE GROEP -- maar ook geen toonbare. Geeft de
   aanroeper geen groepsgrootte mee bij een optellende maat, dan is niet vast te
   stellen of het getal over een aanwijsbaar mens gaat, en dan komt er ook geen
   waarde uit (GROEP_ONBEKEND). ONBEKEND is geen WEIGEREN, maar het is ook geen ja. */
'use strict';

const TOONBAAR = 'TOONBAAR';
const TE_KLEINE_GROEP = 'TE_KLEINE_GROEP';
const GROEP_ONBEKEND = 'GROEP_ONBEKEND';

const KLASSEN = Object.freeze({
  huis: Object.freeze({ optellend: false, grens: null,
    wat: 'RTG of de RTFoundation als rechtspersoon; er staat geen mens in het getal' }),
  zaken: Object.freeze({ optellend: true, grens: 5,
    wat: 'opgeteld over partnerzaken; onder de vijf is het getal van een aanwijsbare zaak' }),
  leden: Object.freeze({ optellend: true, grens: 10,
    wat: 'opgeteld over leden, op codenaam; onder de tien gaat het over aanwijsbare mensen' }),
  personeel: Object.freeze({ optellend: true, grens: 10,
    wat: 'opgeteld over medewerkers; met drie mensen op kantoor is elk getal een mens' }),
  gezinnen: Object.freeze({ optellend: true, grens: 10,
    wat: 'opgeteld over gezinnen van de RTFoundation; nooit per gezin' })
});

/* De grens die voor DEZE maat geldt: de strengste van klasse en maat. */
function grensVan(maat) {
  const k = KLASSEN[maat && maat.privacy];
  if (!k) return { fout: 'onbekende privacyklasse: ' + (maat && maat.privacy) };
  if (!k.optellend) return { grens: null };
  const eigen = Number.isInteger(maat.minGroep) ? maat.minGroep : 0;
  return { grens: Math.max(k.grens, eigen) };
}

/* toon(maat, { waarde, n }) -> wat er van deze meting naar buiten mag.
   `n` is het aantal mensen (of zaken) waarover de waarde is opgeteld. */
function toon(maat, meting) {
  const g = grensVan(maat);
  if (g.fout) return { stand: GROEP_ONBEKEND, reden: g.fout };
  const m = meting || {};
  if (g.grens == null) return { stand: TOONBAAR, waarde: m.waarde };
  if (!Number.isInteger(m.n) || m.n < 0) {
    return { stand: GROEP_ONBEKEND, grens: g.grens,
      reden: 'Deze maat telt over mensen en er is geen groepsgrootte meegegeven; zonder die is niet vast te stellen of het getal over een aanwijsbaar mens gaat.' };
  }
  if (m.n < g.grens) {
    return { stand: TE_KLEINE_GROEP, grens: g.grens,
      reden: 'Minder dan ' + g.grens + ' in deze groep (' + KLASSEN[maat.privacy].wat + '). De waarde en het aantal blijven binnen.' };
  }
  return { stand: TOONBAAR, waarde: m.waarde, n: m.n };
}

module.exports = { KLASSEN, grensVan, toon, TOONBAAR, TE_KLEINE_GROEP, GROEP_ONBEKEND };
