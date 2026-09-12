/* WAT DE DETERMINISTISCHE RAIL DOET ZODRA ER CONTEXT MEEKOMT.

   Apart van ./rail-corpus-zinnen.js omdat het een ander soort regel is: daar
   staat wat een ZIN oplevert, hier wat dezelfde zin oplevert MET een scherm
   eronder. Dat is precies de vraag waar fase 4 over gaat, en het is de reden
   dat die zinnen daar niet konden staan -- "die andere" met twee verschillende
   contexten deelde één sleutel.

   HOE DE SLEUTEL ONTSTAAT. ./lus.js plakt onder de vraag een regel "Actieve
   context: ..." die uit ./menscontext.js komt (`handtekening`), en de rail
   normaliseert het geheel. De sleutel is dus vraag + scherm, en daarmee kunnen
   de drie varianten van "die andere" ieder hun eigen antwoord hebben.

   DE SLEUTELS STAAN HIER LETTERLIJK EN WORDEN NIET BEREKEND, en dat is met
   opzet. Zou dit bestand `handtekening()` aanroepen, dan klopt de sleutel per
   definitie altijd -- ook als de handtekening morgen iets anders zegt, en dan
   is er niets meer dat kan zakken. Nu breekt een wijziging aan de handtekening
   deze sleutels hoorbaar: de zin valt terug op NIET_HERKEND en
   test/menscontext.test.js zakt. Luid falen boven stil kloppen.

   DE RAIL BLIJFT DOM. Er wordt niets geteld, niets afgeleid en niets geraden:
   alleen letterlijk opgezocht. Dat de ene variant één alternatief heeft en de
   andere er twee, is HIER uitgeschreven en wordt nergens uitgerekend -- want
   zodra deze rail gaat rekenen, toets je straks de rail in plaats van RTG. */
'use strict';

/* Geen enkele tool, dus geen enkel effect: de rail stelt EEN vraag. */
const verhelder = (projectie) => ({ stappen: [], projectie });

module.exports = {
  /* ---- "die andere", drie keer dezelfde zin en drie keer een ander scherm ----

     Het scherm in alle drie:
       { app: 'RTG Agenda', deel: 'Vrijdag' }
     en bij twee ervan een vergelijking:
       interactie: { soort: 'vergelijking',
                     opties: ['Afspraak 10:00', 'Afspraak 14:00'( , 'Afspraak 16:00')],
                     gekozen: 'Afspraak 10:00' }                                   */

  /* 1. WEL EEN SCHERM, GEEN VERGELIJKING. Er is niets om "die andere" op te
        betrekken, dus er wordt niet gegokt en er gebeurt niets. */
  'die andere actieve context scherm rtg agenda deel vrijdag':
    verhelder('Ik zie waar je bent, maar er staat niets naast elkaar waar "die andere" ' +
      'op kan slaan. Welke bedoel je?'),

  /* 2. EEN ALTERNATIEF. De verwijzing is eenduidig: er is er precies een die
        niet gekozen is. De kaart wordt WEL opgehaald -- daaraan is te zien dat
        de contextwoorden de echte resolver hebben bereikt -- en er wordt niets
        uitgevoerd: het plafond blijft `tonen`. */
  'die andere actieve context scherm rtg agenda deel vrijdag vergelijking afspraak 10 00 afspraak 14 00 gekozen afspraak 10 00':
    { stappen: [{ tools: [{ name: 'kaart', input: {} }] }],
      projectie: 'Je bedoelt de afspraak van 14:00. Dit is wat daarover bekend is; ' +
        'zeg het maar als er iets moet veranderen.' },

  /* 3. TWEE ALTERNATIEVEN. Nu zijn er twee die niet gekozen zijn, en dan wordt
        er niet gekozen maar gevraagd. Een van de twee pakken omdat hij toevallig
        eerst staat, is exact de gok die deze laag moet uitsluiten. */
  'die andere actieve context scherm rtg agenda deel vrijdag vergelijking afspraak 10 00 afspraak 14 00 afspraak 16 00 gekozen afspraak 10 00':
    verhelder('Er staan er twee naast die van 10:00: die van 14:00 en die van 16:00. ' +
      'Welke bedoel je?'),

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
