/* WELKE TREDE PAST BIJ DEZE ZAAK? -- een voorstel, en nooit een verhuizing.

   HET GAT DAT DIT DICHT. kern/commercie/zaakabonnement.js laat elke zaak van
   voor de ladder terugvallen op `business`, de ruimste zakelijke trede, met
   `herkomst: 'voor-de-ladder'` erbij. Dat was de juiste keuze -- een migratie die
   rechten intrekt is een storing met een nette naam -- maar het is een
   TERUGVAL en geen besluit. Er staan honderden zaken op, en zonder iets dat ze
   voorstelt, staan ze er over een jaar nog.

   DRIE REGELS, EN DE EERSTE IS DE ENIGE DIE ERTOE DOET.

   1. ER WORDT NIETS AUTOMATISCH VERPLAATST. Deze module heeft geen enkel pad
      waarlangs een trede verandert zonder dat een mens `bevestig()` aanroept met
      zijn naam erbij. Een zaak die op maandagochtend haar kassa kwijt is omdat
      een algoritme vond dat ze hem niet gebruikte, is precies de storing die de
      terugval moest voorkomen.
   2. GEEN BEWIJS IS GEEN VOORSTEL. Een zaak waarvan we niets weten, krijgt geen
      voorstel maar de mededeling dat er te weinig te zien is. De verleiding is
      om "niets gebruikt" te lezen als "de goedkoopste trede volstaat"; dat is
      dezelfde denkfout als een omzetstaat die een lid zonder contract stil op
      nul zet.
   3. EEN VOORSTEL ZEGT WAT HET AFPAKT. Een lagere trede is niet alleen
      goedkoper: hij haalt onderdelen weg. Welke, staat met naam in het voorstel,
      want een mens die tekent hoort te weten wat hij intrekt.

   EN NIET-GEMETEN IS AL HELEMAAL NIET NIET-NODIG. Dit is de valkuil waar deze
   module bijna in liep. De laag daarboven kan lang niet elke capability zien:
   kassa-artikelen en personeelsrijen staan ergens te tellen, maar of een zaak
   ooit governance heeft gebruikt weet niemand. Een nul uit "niet gemeten" ziet
   er precies zo uit als een nul uit "niet gebruikt" -- en op die eerste een
   onderdeel intrekken is geen voorstel maar een gok.

   Vandaar dat `gemeten` een APARTE lijst is en geen afgeleide van `gebruik`. Wat
   er niet in staat, telt als NODIG: een trede die zoiets zou wegnemen, wordt niet
   voorgesteld. Conservatief, en het kost hier hoogstens een voorstel dat niet
   komt -- de andere kant kost een zaak haar governance.

   NIET-GEBRUIKT IS NIET HETZELFDE ALS NIET-NODIG, en dat staat hier omdat het
   de zwakke plek van dit hele idee is. Een restaurant dat een jaar lang geen
   loonrun draaide, kan volgende maand personeel aannemen. Vandaar dat het
   voorstel `zeker` draagt: hoe meer een zaak aantoonbaar DOET, hoe steviger het
   voorstel, en bij weinig gegevens zegt het dat met zoveel woorden in plaats van
   een getal te suggereren.

   WAT DIT NIET IS: een plek die de leverancierstabel kent. `gebruik` komt van de
   aanroeper -- een telling per capability -- omdat alleen de laag daarboven weet
   waar kassa-artikelen en personeelsrijen wonen. */
'use strict';

/* De weging staat apart: dit bestand gaat over de OMGANG met een voorstel, dat
   over de vraag welke trede past. Zie ./voorstel/weging.js -- met name de twee
   soorten nul. */
const { maakWeging, DREMPEL } = require('./voorstel/weging');

function maakVoorstellen({ zaakAbonnement }) {

  const { stel } = maakWeging({ zaakAbonnement });

  /* BEVESTIGEN. De enige weg waarlangs een trede verandert, en hij vraagt een
     naam. `pas` moet gelijk zijn aan wat er is voorgesteld: tekenen voor iets
     anders dan wat er op tafel lag, is geen bevestiging. */
  function bevestig(code, pas, door, gebruik, gemeten) {
    const wie = String(door || '').slice(0, 60);
    if (!wie) return { status: 400, error: 'Wie bevestigt dit voorstel?' };
    const v = stel(code, gebruik, gemeten);
    if (!v.voorstel) return { status: 409, error: 'Er ligt geen voorstel voor deze zaak: ' + v.waarom };
    if (String(pas || '') !== v.voorstel)
      return { status: 409, error: 'Het voorstel is ' + v.voorstel + ' en niet ' + pas +
        '. Tekenen voor iets anders dan wat er op tafel lag, is geen bevestiging.' };
    if (!zaakAbonnement) return { status: 503, error: 'De abonnementslaag is niet gemount.' };
    const r = zaakAbonnement.zet(code, v.voorstel, wie);
    return r.ok ? { status: 200, ok: true, ...r, voorstel: v } : r;
  }

  /* De hele lijst, van de zaken die de aanroeper aanlevert. Met de tellingen
     erbij: hoeveel voorstellen er liggen, en hoeveel zaken er GEEN krijgen omdat
     er te weinig te zien is. Dat tweede getal hoort net zo zichtbaar te zijn --
     het is de werkvoorraad die niemand vanzelf oppakt. */
  function lijst(zaken) {
    const uit = (zaken || []).slice(0, 2000).map(z => stel(z.code, z.gebruik, z.gemeten));
    return {
      aantal: uit.length,
      metVoorstel: uit.filter(v => v.voorstel).length,
      zonderGegevens: uit.filter(v => !v.voorstel && v.zeker === 'geen').length,
      alVastgelegd: uit.filter(v => !v.voorstel && !v.zeker).length,
      voorstellen: uit.filter(v => v.voorstel).slice(0, 200),
      zonder: uit.filter(v => !v.voorstel).slice(0, 50)
    };
  }

  return { stel, bevestig, lijst, DREMPEL };
}

module.exports = { maakVoorstellen, DREMPEL };
