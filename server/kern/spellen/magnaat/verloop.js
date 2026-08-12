/* Magnaat: HET VERLOOP VAN EEN CAMPAGNE -- wie is er aan zet, en wanneer is het af.

   Afgesplitst van ./economie.js, en de naad is dezelfde als daar: dat bestand
   gaat over de KLOK (hoeveel maanden zijn er verstreken, wat gebeurt er in een
   maand) en dit over de PARTIJ (wiens beurt, wie wint). Twee onderwerpen die
   alleen een bestand deelden, en het tweede kreeg er in fase C een vraag bij
   die het eerste niets aangaat: wat als iemand halverwege stopt.

   HET DEED EEN GAT DICHT DAT ER ALTIJD AL ZAT. De descriptor zegt met zoveel
   woorden dat openen, uitbreiden en sluiten GROTE zetten zijn en bij je beurt
   horen (./index.js, `buitenBeurt`), en server/kern/spellen/partij.js handhaaft
   dat trouw: wie niet aan zet is, krijgt "De ander is aan zet". Alleen zette
   NIEMAND de beurt door in de economische vorm -- het bordspel deed het
   (./bordspel.js `magVolgende`), de economie niet. Gevolg: in een campagne van
   zes kon alleen speler EEN ooit een vestiging openen. Vijf mensen konden een
   half jaar lang prijzen en personeel verzetten en nooit iets bouwen.

   Dat is geen randgeval maar de kern van de vorm, en het bleef staan omdat elke
   toets de motor rechtstreeks aanspreekt (`eco.zet`) en de beurtbewaking een
   laag hoger zit. Zie test/speluitstap.test.js: daar loopt hij nu wel langs de
   echte deur.

   WIE UITSTAPTE WORDT OVERGESLAGEN, en dat is dezelfde regel als het bordspel
   voor een failliet heeft. Zonder die uitzondering staat de tafel stil op een
   beurt van iemand die er niet meer is -- precies de klem waar ./uitstap.js
   voor bestaat, en het zou zonde zijn hem hier weer op te zetten. */
'use strict';

module.exports = ({ eindstand, speeltNog }) => {
  /* DE VOLGENDE AAN ZET. Zoekt vooruit tot hij iemand vindt die nog meedoet, en
     laat de beurt staan als er niemand meer is -- een lus die niets vindt hoort
     niets te veranderen. */
  function volgende(potje) {
    const n = potje.spelers.length;
    for (let stap = 1; stap <= n; stap++) {
      const kand = potje.spelers[(potje.beurt + stap) % n];
      if (speeltNog(potje.staat, kand)) { potje.beurt = (potje.beurt + stap) % n; return; }
    }
  }

  /* WIE ER NU AAN ZET IS. Stapte hij zojuist zelf uit, dan schuift de beurt
     door -- anders wacht de tafel op iemand die er niet meer is. Dit is de
     enige plek waar uitstappen de beurtvolgorde raakt. */
  function herstel(potje) {
    if (potje.status !== 'bezig') return;
    if (!speeltNog(potje.staat, potje.spelers[potje.beurt])) volgende(potje);
  }

  /* HET EINDE. `beeindig` is idempotent via `st.klaar`; de aanroeper let daarop. */
  function beeindig(potje) {
    const st = potje.staat;
    st.klaar = true;
    potje.status = 'klaar';
    /* WAAROP er wordt afgerekend en waarom, staat bij de eindstand zelf
       (./eindstand.js). Dat er GEFILTERD wordt hoort hier: die lijst telt
       iedereen op omdat hij ook het wereldvermogen is, maar de winst gaat naar
       wie er nog was. Stapte iedereen uit, dan is er geen winnaar -- en dat is
       geen gelijkspel maar een partij die niemand heeft uitgespeeld. */
    const stand = eindstand(potje).filter(x => !x.uit);
    if (!stand.length) return;
    if (stand.length > 1 && stand[0].vermogen === stand[1].vermogen) potje.gelijk = true;
    else potje.winnaar = stand[0].codenaam;
  }

  return { volgende, herstel, beeindig };
};
