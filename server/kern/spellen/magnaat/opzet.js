/* Magnaat: DE OPZET VAN EEN PARTIJ -- de lege wereld waarin gespeeld wordt.

   Afgesplitst van ./economie.js. Dat bestand gaat over de KLOK: wanneer er een
   maand gerekend wordt, en hoe een campagne eindigt. Dit gaat over het moment
   ervoor -- wat er op tafel staat als er nog niets gebeurd is. Twee onderwerpen
   die alleen een bestand deelden, en het tweede groeit met elke laag mee: elke
   nieuwe laag zet er een lege lijst bij.

   DE LEGE LIJSTEN STAAN ER EXPLICIET, en dat is geen netheid. Een laag die zijn
   voorraad pas bij het eerste gebruik aanmaakt (`st.x = st.x || []`) werkt ook,
   maar dan verschilt de vorm van een partij van voor die laag met een van erna
   -- en dat is precies het soort verschil dat pas opvalt als er iemand op een
   oude partij een nieuwe knop indrukt. */
const { kaart, STEDENLIJST, stadSleutel } = require('./kaart');
const { SECTORLIJST } = require('./sectoren');
const F = require('./foundation');

module.exports = ({ DUUR, MAAND_MS, START_GELD }) => {
  return function init(potje) {
    const v = potje.variant || {};
    const stadsleutel = stadSleutel(v.stad) || STEDENLIJST[0];
    const duur = DUUR[v.duur] || DUUR.quick;
    const st = {
      stad: stadsleutel, duur, maandMs: MAAND_MS[v.duur] || MAAND_MS.quick,
      maand: 0, begonnen: Date.now(), gerekendTot: Date.now(),
      geld: {}, vestigingen: {}, kavelBezet: {}, foundation: F.nieuw(),
      contracten: [], contractTeller: 0, veilingen: [], veilingTeller: 0, kavelRecht: {},
      deelnemingen: [], deelnemingTeller: 0, leningen: [], leningTeller: 0,
      resultaatlog: {}, betaalgemist: {}, polissen: [], polisTeller: 0,
      onderzoek: [], onderzoekTeller: 0, beurs: [], beursTeller: 0, overnames: [], overnameTeller: 0,
      laatste: {}, klaar: false
    };
    for (const h of potje.spelers) { st.geld[h] = START_GELD; st.vestigingen[h] = []; st.laatste[h] = null; }
    /* AI-CONCURRENTEN. Wie er meespelen staat in de variant: de LAATSTE n
       spelers aan tafel worden door de computer gespeeld. Ze krijgen ieder een
       eigen sector en eigen zones, deterministisch verdeeld -- twee AI's die
       hetzelfde doen zijn een AI die twee keer speelt.

       Ze staan op de STAAT en niet in een aparte lijst, want ze zijn spelers:
       ze hebben een kas, vestigingen, contracten en een eindstand zoals
       iedereen. Zie ./concurrent.js. */
    const hoeveelAI = Math.max(0, Math.min(potje.spelers.length - 1, Math.floor(Number(v.ai) || 0)));
    if (hoeveelAI > 0) {
      const zones = [...new Set(kaart(stadsleutel).kavels.map(x => x.zone))];
      st.ai = {};
      potje.spelers.slice(-hoeveelAI).forEach((h, i) => {
        st.ai[h] = { sector: SECTORLIJST[i % SECTORLIJST.length],
          zones: [zones[(i * 2) % zones.length], zones[(i * 2 + 1) % zones.length]] };
      });
    }
    potje.staat = st;
  };
};
