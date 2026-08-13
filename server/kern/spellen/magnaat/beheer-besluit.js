/* Magnaat: DE BESLUITEN VAN DE MANAGER -- wat hij ziet, en wat hij dan doet.

   Afgesplitst van ./beheer.js. Dat bestand gaat over de WET waaronder een
   manager mag handelen: wat hij niet mag, wat hij kost, wat hij opschrijft. Dit
   bestand gaat over de besluiten zelf, en die lijst groeit met elke laag mee --
   fase C zet er gebeurtenissen bij. Twee dingen met zo'n verschillend tempo
   horen niet in een bestand, en de 10 kB-grens dwong de vraag.

   ELK BESLUIT STAAT OP ZICHZELF, kijkt naar EEN signaal en heeft EEN reden. Dat
   is geen netheid maar de eis onder wet 4 van ./beheer.js: een manager die drie
   dingen tegelijk afweegt kan niet uitleggen wat hij deed, en dan is zijn log
   een lijst gebeurtenissen in plaats van een verantwoording. */
const { personeelNodig } = require('./maat');
const { PRIJSSTANDEN } = require('./prijsstand');

const rond = (n) => Math.round(n);

/* `doe` is een actie namens de speler, door dezelfde tabel als het scherm (wet
   1). `zet` van ../economie.js wordt met opzet NIET gebruikt: die doet save() en
   stuurt duwtjes rond, en dat hoort bij een mens die op een knop drukt. */
const M = require('./mandaat');

module.exports = ({ doe }) => {
  /* ONDERHOUD. Het budget omhoog zolang de staat onder het doel zakt, omlaag
     zodra hij er ruim boven zit. Wie dit laat lopen bespaart nu en betaalt
     later -- in kwaliteit, in reputatie, en sinds de risicolaag ook in brand. */
  function onderhoud(potje, h, v, r, regels, uit) {
    const st = potje.staat;
    const doel = regels.onderhoudsdoel;
    if (v.onderhoud >= doel + 8 && v.onderhoudBudget > 0) {
      const nieuw = rond(v.onderhoudBudget * 0.8);
      if (nieuw !== v.onderhoudBudget && doe(potje, h, { actie: 'beleid', id: v.id, onderhoud: nieuw }).ok)
        uit.push({ wat: 'onderhoud omlaag', waarom: 'de staat is ' + Math.round(v.onderhoud) +
          ' en het doel ' + doel, bedrag: nieuw, vestiging: v.id });
      return;
    }
    if (v.onderhoud >= doel) return;
    const ruimte = st.geld[h] - regels.kasbuffer;
    if (ruimte <= 0) return;
    const nieuw = rond(Math.min(v.onderhoudBudget * 1.35 + 250, v.onderhoudBudget + ruimte));
    if (nieuw <= v.onderhoudBudget) return;
    /* HET MANDAAT IS EEN PLAFOND (../magnaat/mandaat.js). Staat er geen grens,
       dan is er niets veranderd -- dat is met opzet: een partij die begon
       voordat mandaten bestonden hoort niet ineens een manager te hebben die
       stilvalt. Wie wel een grens zet, krijgt een manager die het ZEGT als hij
       eraan komt, en dat is precies waar delegeren over gaat. */
    const toe = M.magVoor(regels.mandaat, 'onderhoud', nieuw);
    if (!toe.mag && regels.mandaat.onderhoud !== undefined) {
      uit.push({ wat: 'onderhoud niet verhoogd', waarom: toe.reden,
        bedrag: nieuw, vestiging: v.id });
      return;
    }
    if (doe(potje, h, { actie: 'beleid', id: v.id, onderhoud: nieuw }).ok)
      uit.push({ wat: 'onderhoud omhoog', waarom: 'de staat zakte naar ' + Math.round(v.onderhoud) +
        ', doel is ' + doel, bedrag: nieuw, vestiging: v.id });
  }

  /* BEZETTING. Twee signalen uit de vorige maand en geen enkel raadwerk: GEMIST
     betekent dat er vraag wegliep, en een bezetting boven het doel betekent dat
     de kwaliteit begint te zakken. Allebei wijzen naar te weinig handen. Staat
     er juist te veel personeel, dan gaat er iemand af -- dat is de kant die een
     speler zelf vaak vergeet, en sinds de onderzoekslaag ook de kant waar
     automatisering zijn geld verdient. */
  function bezetting(potje, h, v, r, regels, uit) {
    const st = potje.staat;
    if (!r) return;
    const nodig = personeelNodig(v, 0);
    const krap = (r.gemist || 0) > 0 || (r.bezetting || 0) / 100 > regels.bezettingsdoel;
    if (krap && v.personeel < nodig) {
      const kosten = (nodig - v.personeel) * 3000;
      if (st.geld[h] - kosten < regels.kasbuffer) return;
      /* EN BINNEN ZIJN MANDAAT, in MENSEN en niet in euro's (../magnaat/mandaat.js).
         Zonder grens gezet blijft het zoals het was; met een grens krijg je het
         geval waar deze laag om draait -- een bedrijfsleider die ziet dat er
         handen tekort zijn en er niet genoeg mag aannemen. Dat is geen
         onvermogen maar een inrichtingskeuze van de eigenaar, en hij hoort hem
         terug te zien in het log. */
      const erbij = nodig - v.personeel;
      const toe = M.magVoor(regels.mandaat, 'personeel', erbij);
      if (!toe.mag && regels.mandaat.personeel !== undefined) {
        uit.push({ wat: 'mensen niet aangenomen', waarom: toe.reden,
          bedrag: erbij, vestiging: v.id });
        return;
      }
      if (doe(potje, h, { actie: 'beleid', id: v.id, personeel: nodig }).ok)
        uit.push({ wat: 'mensen erbij', waarom: (r.gemist ? 'er liep ' + rond(r.gemist) + ' vraag weg'
          : 'de bezetting stond op ' + r.bezetting + '%'), bedrag: nodig, vestiging: v.id });
      return;
    }
    if (v.personeel > nodig && !krap)
      if (doe(potje, h, { actie: 'beleid', id: v.id, personeel: nodig }).ok)
        uit.push({ wat: 'mensen eraf', waarom: 'er zijn er ' + nodig + ' nodig en er stonden er ' +
          v.personeel, bedrag: nodig, vestiging: v.id });
  }

  /* PRIJS. Alleen met toestemming, want dit verandert wie je klanten zijn en
     dat is een merkbeslissing en geen huishouding. Vol en toch vraag laten
     liggen betekent dat je te goedkoop bent; halfleeg betekent het omgekeerde. */
  function prijs(potje, h, v, r, regels, uit) {
    if (!regels.mag.prijs || !r) return;
    const i = PRIJSSTANDEN.indexOf(v.prijs);
    const bezet = (r.bezetting || 0) / 100;
    const omhoog = bezet >= 0.97 && (r.gemist || 0) > 0 && i < PRIJSSTANDEN.length - 1;
    const omlaag = bezet <= 0.6 && i > 0;
    if (!omhoog && !omlaag) return;
    const naar = PRIJSSTANDEN[i + (omhoog ? 1 : -1)];
    if (doe(potje, h, { actie: 'beleid', id: v.id, prijs: naar }).ok)
      uit.push({ wat: 'prijsstand ' + naar, waarom: omhoog
        ? 'vol en er liep nog vraag weg' : 'de zaak stond op ' + r.bezetting + '%', vestiging: v.id });
  }

  /* ROOD STAAN OPLOSSEN. Alleen met toestemming om te lenen, en alleen precies
     zoveel als nodig is om uit de min te komen: rood staan is de duurste vorm
     van krediet die er is (../magnaat/bank.js), dus een werkkapitaallening is
     goedkoper. Maar hij LEENT NIET OM TE GROEIEN -- zie wet 2. */
  function rood(potje, h, regels, uit) {
    const st = potje.staat;
    if (!regels.mag.lenen || st.geld[h] >= 0) return;
    const tekort = rond(-st.geld[h] + regels.kasbuffer);
    /* EN OOK HIER EEN PLAFOND. "Mag lenen" was een categorie; "mag lenen tot
       500.000" is een bevoegdheid. Komt hij eraan, dan leent hij NIET half --
       een halve werkkapitaallening lost het tekort niet op en kost wel rente. */
    const toe = M.magVoor(regels.mandaat, 'lenen', tekort);
    if (!toe.mag) {
      uit.push({ wat: 'niet geleend', waarom: toe.reden, bedrag: tekort });
      return;
    }
    const r = doe(potje, h, { actie: 'krediet-opnemen', soort: 'werkkapitaal',
      bedrag: tekort, looptijd: 12 });
    if (r.ok) uit.push({ wat: 'werkkapitaal opgenomen', waarom: 'de kas stond ' +
      rond(-st.geld[h] + tekort) + ' in de min en rood staan is het duurst', bedrag: tekort });
  }

  return { onderhoud, bezetting, prijs, rood };
};
