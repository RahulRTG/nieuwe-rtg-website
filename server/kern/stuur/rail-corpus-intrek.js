/* "TOCH NIET" -- de spiegel van "ja doe maar", en met opzet een ander antwoord.

   HET BESLUIT VAN DE EIGENAAR (13 september 2026): wie iets kan laten
   klaarzetten, moet het conversationeel ook weer kunnen terugtrekken. Bevestigen
   blijft buiten het gesprek, intrekken mag erin. Dat lijkt inconsequent en is
   het niet -- bevestigen GEEFT een handeling vrij, intrekken kan er alleen een
   WEGNEMEN. De ernstigste afloop van een verkeerd intrekken is dat een lid
   opnieuw moet vragen; de ernstigste afloop van een verkeerd bevestigen is dat
   er geld weg is.

   DE TWEE SOORTEN DUBBELZINNIGHEID, en dit is het inzicht dat dit bestand
   toevoegt aan ./rail-corpus-context.js. Bij "annuleer hem" staat de
   dubbelzinnigheid IN DE ZIN EN OP HET SCHERM: er zijn twee afspraken zichtbaar,
   dus de TAAL kan zien dat er niets eenduidigs is en vraagt. Bij "laat maar"
   staat zij in de TOESTAND VAN DE SERVER: hoeveel voorstellen er openstaan, is
   aan de zin niet te zien en mag er ook niet uit worden geraden. Daarom vraagt
   hier de POORT en niet de taal -- kern/stuur/goedkeuring.js trekt alleen in bij
   precies EEN, en heeft geen ingang om er een aan te wijzen.

   DE RAIL PROBEERT HET DUS IN BEIDE GEVALLEN, en dat hoort zo. Hij weet het
   verschil niet en mag het niet weten; het verschil komt terug als antwoord van
   de route (200 met wat er verviel, of 409 met hoeveel er openstaan). Zou deze
   rail bij twee voorstellen zelf al gaan vragen, dan zat de voorzichtigheid in
   het corpus in plaats van in de machine -- en dan bewijst een groene proef
   niets over RTG.

   HET PAD IS GEEN /doe. `/api/member/voorstel/intrek` hangt bewust buiten
   `/api/(member|supplier|staff)/doe`, want die tak is voor het stuur verboden
   tegen rondzingen (kern/stuur/classificatie.js). Die grens is niet verzacht om
   dit mogelijk te maken; er staat een aparte deur naast. */
'use strict';

/* `zeker` en `begrepen` zijn de vaste vorm van de twijfelpoort
   (kern/rahul/twijfel.js): zonder expliciete zekerheid gebeurt er niets. Er gaat
   GEEN id mee -- dat veld bestaat niet, en dat is de hele grendel. */
const intrek = (begrepen) => ({ tools: [{ name: 'doe', input: {
  pad: '/api/member/voorstel/intrek', zeker: true, begrepen, body: {} } }] });

module.exports = {

  /* A. EEN OPENSTAAND VOORSTEL. De keten roept de route aan, die vindt er
        precies een, laat hem vervallen en zegt welke. Geen vraag: er valt niets
        te verduidelijken, en het contract staat dan ook op `blockingVraagMax: 0`. */
  'toch niet actieve context scherm rtg agenda deel vrijdag selectie voorstel tandarts vrijdag 14 00':
    { stappen: [ intrek('het klaargezette voorstel van dit lid laten vervallen voordat het is uitgevoerd') ],
      projectie: 'Ik heb het klaargezette voorstel laten vervallen; er is niets uitgevoerd. ' +
        'Zeg het maar als je het alsnog wilt.' },

  /* B. TWEE OPENSTAANDE VOORSTELLEN. Exact dezelfde aanroep -- de rail ziet het
        verschil niet -- en de POORT weigert met hoeveel er openstaan. Daarna
        vraagt de keten welke, en dat is de ene blokkerende vraag die het
        contract hier toestaat.

        Let op wat hier NIET in de projectie staat: geen id. De route geeft ze
        ook niet af (kern/stuur/goedkeuring.js), want dat token is de sleutel
        waarmee elders een handeling wordt vrijgegeven. */
  'laat maar actieve context scherm rtg agenda deel deze week selectie voorstel tandarts vrijdag 14 00 voorstel kapper maandag 09 00':
    { stappen: [ intrek('het klaargezette voorstel van dit lid laten vervallen voordat het is uitgevoerd') ],
      projectie: 'Er staan er twee open en ik weet niet welke je bedoelt, dus ik heb er geen ' +
        'laten vervallen. Welke moet weg: de tandarts van vrijdag of de kapper van maandag?' }

};
