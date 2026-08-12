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
    /* DE STAD DIE AL WAT HEEFT MEEGEMAAKT (fase C, ../stadsgeheugen.js). Wat er
       in eerdere campagnes in deze stad is gebouwd, staat er nog: dezelfde
       vorm die ./foundation.js zelf gebruikt, dus de motor hoeft er niets
       nieuws voor te kennen.

       HIJ WORDT MEEGEGEVEN EN NIET OPGEHAALD, en dat is geen omweg maar de
       enige eerlijke weg: een spelmodule krijgt bewust geen `db` (zie `spelCtx`
       in ../../spellen.js). De wereld stempelt hem op het potje voordat de init
       draait; staat er niets, dan begint de campagne zoals hij altijd al begon.

       EN HIJ TELT NIET MEE VOOR DE VOLGENDE: `volgend` blijft op nul staan, dus
       een geerfde stad maakt het bouwen van het EIGEN eerste project niet
       goedkoper. Zou dat wel zo zijn, dan erft een oude stad een voorsprong, en
       dat is precies wat een stad-van-niemand niet mag doen. */
    const erf = (potje.stadsgeheugen || {}).gedaan || [];
    for (const g of erf) st.foundation.gedaan.push({ id: g.id, zone: g.zone, geerfd: true });
    st.stadsgeschiedenis = { potjes: (potje.stadsgeheugen || {}).potjes || 0, geerfd: erf.length };
    /* WAAR JE MEE BEGINT, en dat is sinds VERHAAL.md par. 0d een KEUZE.

       `ondernemer` (de oude, en nog steeds de snelle) zet iedereen neer met
       startkapitaal en een lege kaart. Prima om een middag te spelen, maar het
       laat iedereen spawnen als volwassen ondernemer -- en dat is niet veiliger,
       het is alleen minder waar.

       `mens` is de echte start. Je hebt bijna niets, je hebt geen bedrijf, en de
       wereld bestaat al voordat jij binnenkomt: de AI-bedrijven staan er, ze
       draaien, en ze zoeken personeel (./concurrent-werven.js). Je opent het
       werkscherm, je solliciteert, en vanaf dat moment begint je geschiedenis.
       De eerste overwinning is niet een miljoen -- het is dat iemand je aanneemt.

       DE AI'S KRIJGEN WEL KAPITAAL. Zij zijn de bestaande economie; zonder geld
       bouwen ze niets en is er niets om op te solliciteren. Dat is geen
       voorsprong maar de wereld die er al was. */
    const startvorm = v.start === 'mens' ? 'mens' : 'ondernemer';
    st.startvorm = startvorm;
    const zakgeld = Math.round(START_GELD * 0.006);   // een maand of twee leven, geen bedrijf
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
    /* EN PAS HIER GAAT HET KAPITAAL VAN DE MENSEN WEG, want de AI's zijn nu
       bekend en die houden het hunne. Zou dit boven de AI-verdeling staan, dan
       had ook de bestaande economie geen geld en bouwde niemand ooit iets. */
    if (startvorm === 'mens')
      for (const h of potje.spelers) if (!(st.ai || {})[h]) st.geld[h] = zakgeld;
    potje.staat = st;
  };
};
