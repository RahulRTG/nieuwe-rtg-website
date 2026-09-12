/* GESPREKSSAMENHANG -- dezelfde korte vervolgzin, drie schermen.

   Apart van ./rail-corpus-context.js omdat het een andere vraag beproeft. Daar
   staat of een VERWIJZING veilig op te lossen is ("die andere"); hier of een
   vervolgzin zijn betekenis krijgt van wat er openstaat ("liever later"). Die
   twee schuiven om verschillende redenen, en het bestand ging door de
   omvangband van keuringsregel `omvang`.

   De uitslag wordt gecontroleerd door scripts/menstaalproef.js
   (`gesprekssamenhang`) en staat als ratel in NORM.json (`samenhangGebreken`). */
'use strict';

module.exports = {
  /* ---- "liever later", drie keer dezelfde zin en drie keer iets anders ----

     DIT IS DE PROEF OP GESPREKSSAMENHANG. Een korte vervolgzin betekent op
     zichzelf niets: "liever later" dan WAT. Wat hij betekent hangt volledig aan
     wat er op het scherm openstaat, en de drie uitkomsten hieronder mogen
     elkaar niet raken.

     WAT HIER WEL EN NIET MEE BEWEZEN IS, en dat is de eerlijke grens. Gemeten
     (scripts/menstaalproef.js): de context bereikt de interpretatielaag, en
     alles ERONDER loopt aantoonbaar uiteen -- een ander doel, een ander oordeel
     van de echte compileer(), een andere trede. Wat hier NIET mee bewezen is,
     is dat een MODEL de zin zo zou uitleggen: met deze rail is de uitleg
     gescript. Dat is precies de scheidslijn die rail.js trekt, en het bewijs
     ervoor hoort bij fase 12 (een echte rail tegen hetzelfde contract).

     EN DE RESOLVER VERSMALT HIER NIET, ook niet met context. Gemeten: op deze
     zin raakt hooguit EEN woord een pad terwijl er vijf inhoudswoorden staan,
     dus de dun-bewijsregel van resolver.js geeft de volledige toegestane lijst
     terug. Dat is de veilige kant en geen defect -- maar het is de reden dat
     hier GEEN fase `CONTEXT_USED` bij is gekomen: die zou beweren dat de
     resolver door de context veranderde, en dat is op deze zin niet waar.
     `contextGebruikt` op INTENT_RESOLVED zegt eerlijk `false`. */

  /* A. ACTIEVE REISCONTEXT. De zin gaat over een later VERTREK. Hij plant
        daarom op een reispad -- dat voor een lid niet bestaat, en dat is de
        hele waarde van dit geval: de keten zegt dat in woorden in plaats van
        stil iets anders te doen. Zie `bewustVerboden` in ./rail-corpus-goudenplak.js
        voor waarom dat mag en waarom het geen ontsnapping is. */
  'liever later actieve context scherm rtg reizen deel parijs vrijdag keuze vertrek 09 12 vertrek 17 40 gekozen vertrek 09 12': {
    bewustVerboden: 'een lid heeft geen reis-capability; deze regel laat de keten dat ZEGGEN ' +
      'in plaats van de zin stil op iets anders te betrekken',
    stappen: [
      { tools: [{ name: 'kaart', input: {} }] },
      { tools: [{ name: 'plan', input: { doel: 'het vertrek naar Parijs naar later verzetten',
        stappen: [{ id: 's1', capability: '/api/reisbureau/boek', invoer: {}, afhankelijkVan: [] }] } }] }
    ],
    projectie: 'Je bedoelt het latere vertrek: 17:40 in plaats van 09:12. Verzetten kan ik niet ' +
      'voor je doen -- reizen boeken staat niet op wat ik namens jou mag doen.' },

  /* B. ACTIEVE AFSPRAAKCONTEXT. Dezelfde twee woorden, en nu gaat het over een
        latere TIJD. Hier bestaat de capability wel, dus de compiler zegt ja en
        de keten komt tot een voorstel. */
  'liever later actieve context scherm rtg agenda deel vrijdag keuze 14 00 tandarts 16 30 tandarts gekozen 14 00 tandarts': {
    stappen: [
      { tools: [{ name: 'kaart', input: {} }] },
      { tools: [{ name: 'plan', input: { doel: 'de afspraak van 14:00 naar 16:30 verzetten',
        stappen: [{ id: 's1', capability: '/api/agenda/wijzig', invoer: {}, afhankelijkVan: [] }] } }] },
      /* EN HIJ ZET HET OOK ECHT KLAAR. Zonder deze stap zegt de projectie "ik
         kan dat klaarzetten" terwijl er niets klaarstaat -- een belofte die de
         keten niet waarmaakt, en precies wat de twijfelregels verbieden. Met
         deze stap is het verschil tussen A en B ook MEETBAAR in plaats van
         alleen leesbaar: A komt tot `geen` (de capability bestaat niet), B tot
         `klaarzetten` (428, een voorstel dat een mens bevestigt). */
      { tools: [{ name: 'doe', input: { pad: '/api/agenda/wijzig',
        zeker: true, begrepen: 'de afspraak van dit lid van 14:00 naar 16:30 verzetten',
        body: { id: 'afspraak-1', tijd: '16:30' } } }] }
    ],
    projectie: 'Je bedoelt de latere tijd: 16:30 in plaats van 14:00. Ik kan dat klaarzetten; ' +
      'bevestigen doe je zelf.' }
};
