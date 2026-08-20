/* RTG Link: DE INTENTIES -- wat DEZE scanner hier mag VRAGEN.

   ===========================================================================
   DE GEVAARLIJKSTE REGEL VAN DEZE LAAG STAAT IN DE HANDTEKENING.

   LINK.md par. 3.1: de lijst toont wat deze scanner in deze context mag vragen,
   nooit wat de ander HEEFT. Een grijs "zorgdossier delen" vertelt de scanner dat
   er een zorgdossier is; een ontbrekende regel "kind koppelen" vertelt dat er
   geen kind is. Dan is het menu zelf een profieluitdraai, en dat is precies wat
   kern/sociaal/pin-deur.js op zijn eigen schaal tegenhoudt (vier uitkomsten, met
   opzet hetzelfde antwoord).

   Daarom KRIJGT DEZE FUNCTIE HET ONDERWERP NIET. Niet als parameter, niet via
   een context, niet als handle om even iets mee op te zoeken. Wat erin gaat is:
   het TYPE van de code, WIE er scant, en WAT DIE SCANNER AL HEEFT met de ander
   (de band -- en die kent hij per definitie zelf al, want hij is er partij in).
   Zo is de regel geen controle die je kunt vergeten maar een eigenschap van de
   opzet: er is hier niets om per ongeluk uit te lekken.

   Wie hier ooit een `onderwerp` of een `handle` aan de handtekening toevoegt,
   haalt die eigenschap weg. Dat is het moment om nee te zeggen.
   ===========================================================================

   ELKE INTENTIE WIJST NAAR EEN BESTAANDE WEG. Een menu-regel zonder route is een
   belofte in tekst zonder belofte in code (LAT.md regel 6). test/link.test.js
   legt elke `weg` hieronder naast de echte routetabel; wie er een verzint die
   niet bestaat, ziet die toets zakken.

   WAT ER NOG NIET IN STAAT is net zo belangrijk als wat er wel in staat. Betalen
   aan een mens, een reis delen, een zaak overdragen, een apparaat koppelen: die
   staan in LINK.md als bouwvolgorde en dus NIET hier. Deze catalogus beschrijft
   wat het huis vandaag kan.

   OOK DE GEZINSKANT STAAT ER NOG NIET IN, en dat is met opzet geen halve regel.
   De RTFoundation heeft dezelfde pinloketten (/api/rtf/social/pin/*), maar zijn
   sessie is een gezinscode met een profieltoken en niet de Bearer-sessie waar de
   linkdeur op staat. Een menu-regel voor een scanner die deze deur niet kan
   bereiken, is een belofte zonder weg -- die komt erbij wanneer de gezinsdeur
   erbij komt, en geen dag eerder. */
'use strict';

/* De sleutel van `wegen` is `<scanner>:<vorm>` -- wie er scant en of het de vaste
   of de levende code was. Beide zijn eigenschappen van de SCANNER en van de CODE
   die hij vasthoudt, en van niemand anders. */
const CATALOGUS = [
  {
    id: 'contact.verbinden',
    type: 'persoon',
    band: ['geen'],                       // al verbonden? dan is dit geen vraag meer
    tekst: 'Verbinden',
    uitleg: 'Stuur een verzoek; de ander moet het accepteren.',
    methode: 'POST',
    wegen: {
      'lid:vast': '/api/member/pin/connect',
      'lid:levend': '/api/member/pin/live/verbind'
    }
  },
  {
    id: 'contact.gesprek',
    type: 'persoon',
    band: ['verbonden'],
    tekst: 'Gesprek openen',
    uitleg: 'Jullie zijn al verbonden.',
    methode: 'POST',
    wegen: { 'lid:vast': '/api/member/dm', 'lid:levend': '/api/member/dm' }
  },
  {
    id: 'plaats.bestellen',
    type: 'plaats',
    tekst: 'Menu openen',
    uitleg: 'Bestellen aan deze tafel.',
    methode: 'POST',
    wegen: { 'lid:vast': '/api/supplier/menu/get', 'lid:levend': '/api/supplier/menu/get' }
  },
  {
    /* De capability draagt zijn handeling al in zich; wat hij precies inhoudt
       staat op de kaart die het bedoelingsscherm toont, niet in deze regel. Zo
       blijft deze lijst zeggen wat je KUNT VRAGEN en de kaart wat er dan gebeurt.

       Alleen voor een lid, omdat er vandaag alleen capabilities tussen leden
       bestaan (kern/pay/vraagcode.js). Komt er een die een zaak mag aanvaarden,
       dan hoort die rol hier EN in de deur te staan -- een regel tonen die de
       deur weigert, is een belofte zonder weg. */
    id: 'capability.aanvaarden',
    type: 'capability',
    tekst: 'Bekijken en bevestigen',
    uitleg: 'Je ziet eerst wat er gebeurt.',
    methode: 'POST',
    wegen: { 'lid:levend': '/api/link/cap/aanvaard' }
  },
  {
    /* De kassakant: een lid toont zijn betaalcode, de ZAAK int hem. Andersom kan
       niet, en dat is geen omissie maar LINK.md par. 3.3 -- een code die iemand
       ophoudt of ophangt, mag geen geld naar zich toe halen. */
    id: 'kas.innen',
    type: 'betaalcode',
    tekst: 'Innen aan de kassa',
    uitleg: 'De code van dit lid verzilveren.',
    methode: 'POST',
    wegen: { 'supplier:vast': '/api/supplier/pay/in', 'supplier:levend': '/api/supplier/pay/in',
             'staff:vast': '/api/supplier/pay/in', 'staff:levend': '/api/supplier/pay/in' }
  }
];

/* De lijst voor een gescande code. Geen db, geen sessie, geen onderwerp: dezelfde
   invoer geeft altijd dezelfde uitvoer, en dat is wat hem toetsbaar maakt.

   band mag null zijn (bij een type waar geen band bestaat, zoals een tafel). Een
   regel die een band EIST, valt dan weg -- niet omdat de ander iets niet heeft,
   maar omdat de vraag niet bestaat. */
function voor({ type, scanner, vorm, band }) {
  const sleutel = String(scanner || '') + ':' + String(vorm || 'vast');
  const uit = [];
  for (const c of CATALOGUS) {
    if (c.type !== type) continue;
    if (c.band && !c.band.includes(band == null ? 'geen' : band)) continue;
    const weg = c.wegen[sleutel];
    if (!weg) continue;                   // deze scanner heeft hier geen weg voor
    uit.push({ id: c.id, tekst: c.tekst, uitleg: c.uitleg, methode: c.methode, weg });
  }
  return uit;
}

module.exports = { voor, CATALOGUS };
