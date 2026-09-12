/* DE HERKOMSTPOORT VAN DE STUURLUS, met zijn schaduwtelling.

   Afgesplitst uit ./lusstap.js toen dat door de omvangband van keuringsregel
   `omvang` ging. De naad is echt: een BEVEILIGINGSPOORT met een eigen meting is
   een ander soort ding dan het uitvoeren van een gereedschap. Die twee schuiven
   om verschillende redenen -- de poort als het beleid over onvertrouwde invoer
   verandert, de stap als er een gereedschap bij komt.

   CONTROLPLANE.md: een nieuwe handhavingsregel loopt eerst mee zonder te
   blokkeren -- je kunt niet afdwingen wat nooit in de schaduw heeft gelopen. De
   prijs is gemeten en niet geschat: na de eerste geslaagde `doe` gaat een lid van
   120 naar 36 AI-paden en een zaak van 53 naar 9. Dat getal hoort een mens te
   zien voordat de vlag omgaat.

   HIER STONDEN EERST 43 EN 9, EN DIE WAREN VEROUDERD. Ze zijn gemeten VOORDAT de
   leesset-vrijstelling werd aangescherpt (../isolatie/herkomstpoort.js:
   SCHRIJFNIVEAUS -- een bewezen lezer die het beleid een SCHRIJVER noemt, is
   onder onvertrouwde invoer geen lezer meer). Een gemeten getal in commentaar dat
   niet meer klopt, is precies het soort stille onwaarheid waar deze laag voor is
   gebouwd; wie hem verandert, meet opnieuw.

   In de schaduw TELT hij en houdt hij niets tegen; de telling reist mee in het
   antwoord van de kaart, zodat de eigenaar de prijs op zijn scherm heeft in
   plaats van in een logregel. */
const AFDWINGEN = require('./herkomstschakelaar');
const telling = require('./schaduwtelling');

module.exports = function maakHerkomstpoort({ filter, vuil }) {
  /* De schaduwtelling van deze lus. Geen module-toestand: twee gesprekken
     tegelijk zouden elkaars getal opschrijven. */
  const schaduw = { gewogen: 0, zouSluiten: 0, paden: [] };

  function herkomstpoort(pad, wereld) {
    if (!filter || !filter.magMetHerkomst) return { mag: true, schaduw: false };
    const oordeel = filter.magMetHerkomst(pad, wereld, vuil.bronnen());
    schaduw.gewogen++;
    if (!oordeel.mag) {
      schaduw.zouSluiten++;
      if (schaduw.paden.length < 20) schaduw.paden.push(pad);
    }
    /* En dezelfde weging OPGETELD over alle gesprekken. De telling hierboven
       leeft een gesprek en verdwijnt; zonder de optelling is "hoe vaak zou hij
       bijten" niet te beantwoorden, en dan is de vlag omzetten een gok. Het is
       een teller en geen journaal -- zie ./schaduwtelling.js. */
    telling.noteer(wereld, pad, !oordeel.mag);
    const dwingt = AFDWINGEN(wereld);
    return { mag: dwingt ? oordeel.mag : true, oordeel, schaduw: !oordeel.mag && !dwingt };
  }

  return { herkomstpoort, schaduw, AFDWINGEN };
};
