/* HET INZAGEJOURNAAL, DE BEWARING -- hoe lang blijft een spoor staan, en wat
   gebeurt er als het toch afvalt.

   Los van ./inzagelog.js langs een naad in het ONDERWERP en niet alleen in de
   bytes, dezelfde naad als bij ./inzagelog-lezen.js: daar wordt geschreven,
   daar gelezen, hier bewaard. De drie hebben verschillende lezers en delen
   niets behalve de rij zelf.

   DE BEWARING VOLGT DE BELOFTE, EN NIET ANDERSOM (besluit 6, 13 september 2026).
   In inzagelog.js stond `const MAX = 5000` en verder niets: liep de rij vol, dan
   viel de oudste eraf. Dat is een andere belofte dan de onze. Tegen een lid
   zeggen we *"u kunt zien wie uw dossier bekeek"*; wat de code waarmaakte was
   *"wij bewaren de laatste vijfduizend inzages"*. Bij vijftig inzages per dag is
   dat honderd dagen, en na honderd dagen is het antwoord op de vraag van een lid
   stilletjes onvolledig -- zonder dat iemand het merkt, want een afgevallen
   regel laat niets achter.

   Dus bewaart het journaal op TIJD en niet op aantal:

     BEWAARDAGEN  de termijn die de belofte waarmaakt. Twee jaar, en dat is een
                  keuze met een grond: het inzagejournaal is het bewijs OVER
                  toegang, dus het hoort de gegevens waarover het gaat te
                  overleven. Het identiteitsbewijs zelf valt na een jaar
                  (server/bewaarveger.js); het spoor dat iemand ernaar keek,
                  blijft daar een jaar overheen staan.

     MAX          een NOODREM en geen bewaartermijn. Ongebreidelde groei in
                  db.data is een echt risico, dus er blijft een bovengrens --
                  maar hij ligt ruim boven wat de termijn oplevert, en als hij
                  toch bijt is dat ZICHTBAAR (`inzageLogAfgekapt`).

   EN DAT LAATSTE IS HET PUNT. Een grens die stil afkapt, is een belofte die stil
   breekt -- precies de faalvorm waar LAT.md regel 13 over gaat. Bijt de noodrem,
   dan telt het journaal dat en zegt samenvatting() het hardop. Dan is het een
   zichtbaar tekort in plaats van een gat dat niemand kan vinden.

   INTEGRITEIT EN RETENTIE ZIJN TWEE EIGENSCHAPPEN. De hashketen onder het
   journaal bewijst dat wat er STAAT niet is bijgesteld; hij zegt niets over wat
   eraf viel. Wie die twee door elkaar haalt, leest een kloppende keten als een
   volledig journaal.

   AVG: de termijn verlengen opent hier geen nieuwe vraag. Het journaal draagt
   geen naam en geen e-mailadres -- alleen een account-id, wie er keek en waarom
   -- en het blijft bij een accountverwijdering met opzet staan (kern/vergeten.js,
   AVG art. 17 lid 3). Wat er langer blijft staan is de-geidentificeerd. */
'use strict';

const { nu } = require('./lib/klok');

const BEWAARDAGEN = 730;
const BEWAARMS = BEWAARDAGEN * 24 * 3600 * 1000;
const MAX = 200000;

/* SNOEIEN OP TIJD, MET DE NOODREM ERACHTER.

   De rij staat nieuwste-eerst, dus verjaarde regels vallen aan het EIND weg --
   dezelfde kant als de oude `l.length = MAX`, zodat de hashketen er niet anders
   van breekt dan hij al deed.

   TWEE SOORTEN VERLIES, EN ZE WORDEN NOOIT OP EEN HOOP GEGOOID. Een regel die
   VERJAART is de bewaartermijn die werkt; een regel die door de NOODREM valt is
   de belofte die breekt. Alleen die tweede wordt geteld, want alleen die tweede
   is een tekort. Wie ze samentelt, verbergt het tekort in het normale verloop.

   `dbVan` IS EEN FUNCTIE EN GEEN WAARDE: de db-laag komt pas bij het opstarten
   binnen via zet(), en een eenmalig meegegeven verwijzing zou de stand van het
   requiremoment zijn -- dus altijd undefined, en dan telt de noodrem nooit. */
function maakSnoei(dbVan) {
  return function snoei(l) {
    const grens = nu() - BEWAARMS;
    while (l.length && Date.parse(l[l.length - 1].at) < grens) l.pop();
    if (l.length > MAX) {
      const weg = l.length - MAX;
      l.length = MAX;
      try {
        const d = dbVan() && dbVan().data;
        if (d) d.inzageLogAfgekapt = (Number(d.inzageLogAfgekapt) || 0) + weg;
      } catch (e) { /* de telling mag het schrijven nooit tegenhouden */ }
    }
  };
}

module.exports = { BEWAARDAGEN, BEWAARMS, MAX, maakSnoei };
