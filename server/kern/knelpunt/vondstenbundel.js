/* ============================================================================
   WAT ER ACHTER DE KNELPUNTEN STAAT -- het bundelen van de vondsten.

   ./aanvoer-bronnen.js beantwoordt EEN randvoorwaarde: welke vondsten hebben de
   bronnen hierbij. Dit bestand stelt die antwoorden samen tot het beeld dat bij
   EEN uitslag hoort, en houdt daarbij vier dingen uit elkaar die makkelijk op
   een hoop belanden: wat er gevonden is, welke bron stukging, welke bron niets
   had, en wat elke bron leverde naast wat hij vond.

   WAAROM LOS VAN DE ROUTE. Dit is de enige plek waar die vier lijsten ontstaan,
   en het is redeneerwerk en geen bedrading -- het hoort dus toetsbaar te zijn
   zonder server. routes/knelpunt.js ging bovendien over de bandbreedte van
   keuringsregel 13, en dit is de naad die er toch al lag.

   DE KNELPUNTEN GAAN ER EEN VOOR EEN IN, en dat is geen stijl maar een grens:
   de aanvoerlaag kent de mens niet en mag hem ook niet uit een SAMENVOEGING
   kunnen afleiden. Per randvoorwaarde vragen houdt dat zo.

   EN EEN KNELPUNT IS HIER DE RANDVOORWAARDE ZELF. ./index.js geeft ze als platte
   rij { id, wat, blokkeertWegen } en niet genest onder een weg. Dat is bij het
   bouwen een keer misgegaan -- de lus liep over een veld `voorwaarden` dat niet
   bestaat, dus er kwam nul uit terwijl alles werkte, en een lege lijst zag er
   precies zo uit als "geen vacatures".
   ========================================================================== */
'use strict';

/* `aanvoer` is het ding uit ./aanvoer-bronnen.js, `knelpunten` de platte rij uit
   ./index.js, en `openingen` de rijen uit ./openingen.js -- die laatste alleen
   om te weten welke terreinen deze vraag RAAKT. */
function bundel(aanvoer, knelpunten, openingen) {
  const vondsten = [], geweigerd = [], bronLeeg = [], geleverd = [];

  for (const k of (Array.isArray(knelpunten) ? knelpunten : [])) {
    const a = aanvoer.vondsten(k);
    for (const v of a.vondsten) vondsten.push(v);
    for (const g of a.geweigerd) geweigerd.push(g);
    /* Een bron die NIETS heeft is iets anders dan een bron die stukging, en die
       twee worden nooit samengevoegd -- dezelfde regel als in kern/ontvanger.js. */
    for (const g of a.geenBron) bronLeeg.push(Object.assign({ voorwaarde: k.id }, g));
    /* Wat elke bron LEVERDE naast wat hij VOND. Zonder dat verschil leest een
       scherm met een vacature en vierentwintig leerpaden als een oordeel over
       welke weg de beste is, terwijl het alleen zegt hoeveel elke bron toevallig
       heeft. Er wordt niets herverdeeld: dat zou een rangorde zijn (./index.js
       regel 4). */
    for (const g of a.geleverd) geleverd.push(Object.assign({ voorwaarde: k.id }, g));
  }

  /* Alleen over de terreinen die deze vraag werkelijk RAAKT wordt gemeld dat er
     geen bron is. Alle vijf melden zou "voor wonen is geen bron aangesloten"
     zetten onder een vraag die niets met wonen te maken heeft -- een mededeling
     die nergens over gaat, leest als een tekortkoming. */
  const geraakt = [...new Set((openingen || []).map((x) => x && x.terrein).filter(Boolean))];
  const metBron = new Set(vondsten.map((v) => v.terrein));
  const zonderBron = geraakt.filter((t) => !metBron.has(t))
    .map((t) => ({ terrein: t, reden: 'voor dit terrein is nog geen bron aangesloten; de ingang ' +
      'bij de opening hierboven is wat dit huis heeft' }));

  return { vondsten, geweigerd, bronLeeg, geleverd, zonderBron };
}

module.exports = { bundel };
