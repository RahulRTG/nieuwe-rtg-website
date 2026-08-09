/* RTG Wereld -- WIE BEKEEK MIJN PROFIEL. Het derde vermogen dat in rechten.js
   een naam had en nog niets deed (`inzicht.profielbezoek`).

   BIJ ANDERE PLATFORMEN IS DIT EEN BETAALDE FUNCTIE MET EEN ADDERTJE: je mag
   zien wie jou bekeek, maar alleen als jij zelf zichtbaar kijkt, en de volledige
   lijst kost geld. Hier is het onderdeel van de Lifestyle- en Business Pass en
   staat de hele lijst er.

   DRIE REGELS DIE HET EERLIJK HOUDEN, en ze worden hieronder afgedwongen:

   1. WIE KIJKT, WORDT GETELD -- ALTIJD, EN HIJ WEET HET. Er is geen sluipstand.
      Dat is geen technische keuze maar een merkregel: een dienst waarin de een
      onzichtbaar de ander kan bekijken, verkoopt de asymmetrie zelf. De route
      geeft daarom bij ELK profielbezoek terug dat het bezoek is genoteerd, ook
      aan de kijker (zie routes/wereld.js), zodat het scherm het kan zeggen.
   2. ALLES OP CODENAAM. Wie jou bekeek, zie je op codenaam -- nooit een echte
      naam, nooit een sleutel. De kluis blijft gescheiden (CLAUDE.md).
   3. HET IS EEN LOGBOEK EN GEEN TELLER DIE GROEI AANJAAGT. Per kijker EEN regel
      met de laatste keer en hoe vaak; geen grafiek, geen "je bent deze week 40%
      vaker bekeken". Dat laatste is precies het verslavende patroon dat
      CLAUDE.md verbiedt.

   BEWAARTERMIJN. Een bezoek verdwijnt na 90 dagen, en er staan er hoogstens
   200 per lid. Dat is geen zuinigheid maar hetzelfde principe als bij de snaps:
   gegevens die niemand meer gebruikt, horen weg te gaan in plaats van te blijven
   liggen tot iemand ze een keer nodig heeft. */
'use strict';

const TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_PER_LID = 200;

module.exports = ({ db, codenaamVan }) => {
  function B() {
    if (!db.data.wereld || typeof db.data.wereld !== 'object') db.data.wereld = {};
    if (!db.data.wereld.bezoek || typeof db.data.wereld.bezoek !== 'object') db.data.wereld.bezoek = {};
    return db.data.wereld.bezoek;
  }

  /* Noteer dat `kijker` het profiel van `doel` opende.

     Je eigen profiel openen telt niet -- anders staat iedereen bovenaan zijn
     eigen lijst en zegt het niets meer. Geeft terug of er echt iets is
     genoteerd, zodat de route de kijker eerlijk kan vertellen wat er gebeurde
     in plaats van dat stil te doen (LAT-regel 5). */
  function noteer(kijker, doel) {
    if (!kijker || !doel || kijker === doel) return { genoteerd: false };
    const b = B();
    if (!Array.isArray(b[doel])) b[doel] = [];
    const nu = new Date().toISOString();
    const bestaand = b[doel].find(x => x.key === kijker);
    if (bestaand) { bestaand.at = nu; bestaand.keer = (bestaand.keer || 1) + 1; }
    else b[doel].unshift({ key: kijker, at: nu, keer: 1 });
    // nieuwste eerst, en de staart eraf
    b[doel].sort((x, y) => new Date(y.at) - new Date(x.at));
    if (b[doel].length > MAX_PER_LID) b[doel].length = MAX_PER_LID;
    return { genoteerd: true };
  }

  /* De lijst voor het lid zelf. Verlopen bezoeken vallen hier af EN worden
     opgeruimd: een leeslijst die de vervallen regels alleen maar verbergt, laat
     ze in de database staan -- en dan is de bewaartermijn een belofte in tekst
     (LAT-regel 6) in plaats van iets wat echt gebeurt. */
  function bezoekers(key) {
    const b = B();
    const lijst = Array.isArray(b[key]) ? b[key] : [];
    const grens = Date.now() - TTL_MS;
    const levend = lijst.filter(x => new Date(x.at).getTime() >= grens);
    const opgeruimd = levend.length !== lijst.length;
    if (opgeruimd) b[key] = levend;
    return {
      opgeruimd,
      totaal: levend.length,
      bezoekers: levend.map(x => ({
        codenaam: codenaamVan(x.key) || 'Een lid', at: x.at, keer: x.keer || 1
      })).filter(x => x.codenaam)
    };
  }

  return { noteer, bezoekers, TTL_MS, MAX_PER_LID };
};
