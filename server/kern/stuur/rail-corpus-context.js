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
    { stappen: [
        { tools: [{ name: 'kaart', input: {} }] },
        /* EN HIJ HANDELT ER OOK NAAR. Eenduidig EN bevoegd: de verwijzing is op
           te lossen en het pad mag gelezen worden, dus de keten komt tot
           `tonen`. Dat is wat dit geval onderscheidt van D hieronder, waar er
           net zo goed precies EEN alternatief is maar de keten niets doet. Het
           verschil is uitsluitend de bevoegdheid, en dat is meetbaar in plaats
           van leesbaar. */
        { tools: [{ name: 'doe', input: { pad: '/api/agenda/mijn',
          zeker: true, begrepen: 'de agenda van dit lid lezen om de afspraak van 14:00 te tonen',
          body: {} } }] }],
      projectie: 'Je bedoelt de afspraak van 14:00. Dit is wat daarover bekend is; ' +
        'zeg het maar als er iets moet veranderen.' },

  /* 3. TWEE ALTERNATIEVEN. Nu zijn er twee die niet gekozen zijn, en dan wordt
        er niet gekozen maar gevraagd. Een van de twee pakken omdat hij toevallig
        eerst staat, is exact de gok die deze laag moet uitsluiten. */
  'die andere actieve context scherm rtg agenda deel vrijdag vergelijking afspraak 10 00 afspraak 14 00 afspraak 16 00 gekozen afspraak 10 00':
    verhelder('Er staan er twee naast die van 10:00: die van 14:00 en die van 16:00. ' +
      'Welke bedoel je?'),

  /* D. EEN ALTERNATIEF DAT ER WEL STAAT MAAR NIET VAN DIT LID IS.

     Structureel is dit hetzelfde geval als B hierboven: precies EEN
     alternatief, dus taalkundig eenduidig. En toch mag de keten hier NIETS
     doen, want dat ene alternatief is voor een lid niet bereikbaar
     (/api/office/ledenregister staat op `verboden`).

     DAAROM IS AMBIGUITEIT GEEN TAALPROBLEEM ALLEEN. Een kandidaat die zichtbaar
     in de clientcontext zit maar niet meer bereikbaar is, telt niet mee als
     bruikbare kandidaat -- en wie hem wel meetelt, lost de dubbelzinnigheid op
     door bevoegdheid te VERONDERSTELLEN. Dat is precies de fout die deze regel
     moet uitsluiten.

     ER WORDT HIER NIET OP GEPLAND, en dat is met opzet anders dan bij "parijs
     vrijdag". Daar is de intentie duidelijk (een reis boeken) en zegt de keten
     dat de capability ontbreekt. Hier is de intentie juist NIET vast te
     stellen: als het enige alternatief afvalt, blijft er niets over om naar te
     verwijzen. Plannen op dat pad zou betekenen dat het alsnog als referent is
     aangenomen -- alleen om daarna netjes te worden geweigerd. */
  'die andere actieve context scherm rtg agenda deel vrijdag vergelijking afspraak 10 00 ledenregister openen gekozen afspraak 10 00':
    verhelder('Er staat maar een ander ding op je scherm, en dat is niets van jou om te openen. ' +
      'Bedoel je een van je eigen afspraken? Zeg dan welke.')

};
