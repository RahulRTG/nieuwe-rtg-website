# Premiumdomeinkaart Geld

Status: **werkdocument, voorstel aan de eigenaar**. Niets hierin is toegezegd
werk: een functie wordt pas werk als de eigenaar haar per familie toezegt
(besluit van 19 oktober 2026). Opgesteld door de Geld-sessie op de tak
`appwerkt/geld`.

**Wat deze kaart beslaat.** Dit zijn de Geld-apps volgens de verdeling van de
integrator: Wallet, Pay, Bank, Balans, RTG Code, Geld Command, WBW, Labfonds,
Mecenaat, Nalatenschap en de tab Betalen. Logboek staat in de kaart van
LivingOS-A, en `tab:assets` blijft daar ook. Volgens `SCHERMEIGENAAR.json`
zijn ze allemaal een stand of alias van `/apps/geld.html`, met eigenaar
`geld.overzicht`. Pay (`/apps/pay.html`, `betalen.rtgpay`) heeft een eigen
scherm.

**Hoe te lezen.** Per functie staat er:
- de laag (L1 persoonlijk, L2 professioneel, L3 organisatorisch, L4
  domeinintelligentie, L5 levenscyclus, L6 RTG-samenhang);
- of hij **bestaat**, **half** is of **ontbreekt**;
- een acceptatiecriterium in gewone taal (dat wordt later een stap in het
  voltooiscenario);
- de kosten (klein, middel of groot);
- de bak: **nu**, **later** of **niet**.

"Bestaat" betekent: in de code én met een toets of voltooiscenario. Wat
alleen in een document staat, heet "ontbreekt".

**Grenzen die overal gelden.**
- Geld verlaat het huis nooit vanzelf (`AFBOUWPROGRAMMA.md` par. 1.3).
- Samenwerking loopt via verwijzingen en projecties, nooit via een gedeeld
  datamodel (`AFBOUWPROGRAMMA.md` par. 1.2, `WERKRUIMTE.md` par. 5).
- Geen nieuwe motor of laag (bijstelling van de eigenaar, 19 oktober):
  geldgraaf, geldbeleid, actielog, de scenario-engine en de stuurlaag
  bestaan al, en daarop bouwen we voort.
- Geen beleggings-, krediet- of verzekeringsadvies (`GELD.md` par. 7).
- Een voorspelling is nooit een feit.
- Geen echte merken als partner, en geen verzonnen gegevens.

**Over de betaalmuurlijsten.** Elke regel met een marktleider draagt een
bron-URL en de datum 19 oktober 2026. In deze sessie was het web niet
rechtstreeks te openen: WebFetch gaf `ENOTFOUND` en de proxy gaf 403. Alle
marktgegevens komen daarom uit **zoekresultaat-fragmenten**, en zijn zo
gemarkeerd ("fragment"). Ze zijn een ondergrens om na te lezen, geen geciteerde
pagina.

---

## 0. Eerst: de reisfamilie, het Geld-deel

Prioriteit van de eigenaar: boeken, betalen, agenda en reisdossier worden als
eerste familie compleet, los en samen getest. Dit hoofdstuk is het Geld-deel:
het betaalbewijs van een reis, en wat Geld ervan maakt (verplichting, kasstroom
en herkomst). Het is afgestemd met TravelOS (`session_01RSoau3Wc3Ze7MXzDAfGtpK`);
de open vragen aan hen staan in 0.5.

### 0.1 Wat er al is (gemeten in de code)

- `POST /api/reisbureau/betaal` (`server/routes/member/winkel.js:62`) roept
  `betaal()` aan in `server/kern/reisbureau-betaling.js`. Daar staan drie regels:
  - alleen een **bevestigde** reis wordt betaald; anders volgt 409;
  - een reis zonder samenstelling wordt **geweigerd** met de reden, en niet
    geboekt met een onbekende herkomst;
  - het lid betaalt **één** bedrag, dus is er één boeking (`pay.boekAsync`, van
    `lid:<codenaam>` naar `rtg:reisbureau`), met de economische sleutel
    `pay-handeling:[reis, ref]`. Een herhaling na een crash geeft dezelfde
    boeking terug.
- Pas ná die boeking:
  - de herkomstrijen (`reisGeldrijen`: wie wat ontvangt en waarom);
  - de uitkeringen aan derden, **klaargezet** met `uitgevoerd: false`, want een
    mens voert ze uit;
  - "betaald" op de aanvraag (`reisbureau.markeerBetaald`, eigenaar TravelOS).
- Faalt de boeking (402 te weinig saldo, 503 "De betaallaag is niet
  beschikbaar."), dan wordt de reis niet betaald gemarkeerd.
- Teruggave na afzeggen (`server/kern/reisbureau-teruggave.js`):
  - een teruggaverecht, uitgevoerd door een mens op naam met passkey;
  - vanaf € 1.000 met een tweede mens.
- Bewijs: `test/reisherkomst.test.js` (toets 12 en 13, op een echte server) en
  `test/reisteruggave.test.js`.

### 0.2 Gaten (gemeten)

1. **Geen scherm roept `/api/reisbureau/betaal` aan.** In `public/` staat geen
   aanroep, dus het lid kan een bevestigde reis niet zelf betalen. Wie dat
   scherm bezit, is een vraag aan TravelOS (0.5).
2. **Alleen walletsaldo.** Er is geen betaalwaarheid en geen bijladen per kaart.
   Een lid zonder saldo krijgt 402. Elke andere zaakbetaling van het huis heeft
   die dekking wel (`pay.betaalZaak`, `kern/pay/dekking.js`), net als de
   bankstorting en de markt-deal (`kern/bank/stortwaarheid.js`,
   `kern/markt/handel/dealbetaal.js`).
3. **Geen bezitspoort.** `/api/reisbureau/` staat niet in
   `server/kern/identiteit/bezitspaden.js`, terwijl de route geld verplaatst.
4. **Geen paspoortpoort.** `payGate` wordt niet aangeroepen. De route weigert
   tier `guest` met "Alleen voor leden". Of een reis een pasfunctie is of
   "minimaal een account" volgt, is een besluit (0.5).
5. **Geen verplichting in Geld.** Een bevestigde, onbetaalde reis is in de
   Geld-app nergens zichtbaar. Er bestaat geen eigen verplichtingenobject; de
   geldgraaf kent terugkerende posten alleen als patroon.

### 0.3 Functiecatalogus van het Geld-deel

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Een bevestigde reis precies één keer betalen | L1 | bestaat | Het lid betaalt een bevestigde reis; een tweede tik of een herhaling na een crash boekt niets extra. | — | — |
| Een reis zonder samenstelling weigeren | L1 | bestaat | Een reis die niet is uitgesplitst wordt geweigerd met de reden; er komt geen geldrij met een onbekende herkomst. | — | — |
| De herkomst per cent | L6 | bestaat | Na het betalen staat per rij wie het geld ontvangt en waarom, en de rijen tellen op tot de reissom. | — | — |
| Betalen vanaf het scherm | L1 | ontbreekt | Op een bevestigde reis ziet het lid "Betalen", met het bedrag; na de bevestiging ziet hij het betaalbewijs. | klein | nu |
| Betalen met bijladen via de betaalwaarheid | L1 | ontbreekt | Een lid met te weinig saldo betaalt toch, met de kaart. Weigert de bank, dan heet de reis niet betaald. Blijft de bank hangen, dan staat er "wacht op bevestiging" en niet "betaald"; komt de bevestiging later, dan wordt de reis één keer betaald. | middel | nu |
| Bezitspoort op reisbetalingen | L1 | ontbreekt | Met een gestolen sessie zonder het toestel kan niemand een reis betalen. | klein | nu |
| Paspoort- en accountregel voor een reis | L1 | half | Een ongekeurd account kan niet betalen en krijgt de paspoortweg. Of een gratis account een reis kan boeken, volgt het besluit van de eigenaar. | klein | nu (na besluit) |
| Het betaalbewijs | L5 | half | Na het betalen kan het lid het bewijs openen, met bedrag, datum, boekingsnummer en reis. Het bewijs blijft bestaan als de agenda of het reisdossier uit staat. | klein | nu |
| De reis als verplichting in Geld | L6 | ontbreekt | Een bevestigde, onbetaalde reis staat in de Geld-app als open bedrag met de verwijzing naar de reis. Na het betalen verdwijnt ze daar, en na een afzegging ook. | middel | nu |
| De kasstroom van een reis | L4 | half | De geldgraaf toont de betaling als uitgaand op de betaaldag, en een teruggave als inkomend, nooit dubbel. Een verwachte betaling heet "verwacht" en niet "geboekt". | klein | nu |
| De herkomst laten zien in Geld | L6 | ontbreekt | Bij de betaling ziet het lid waar het geld heen ging (hotel, vervoer, RTG), uit de rijen van TravelOS, zonder eigen kopie. | klein | later |
| Teruggave na afzeggen | L5 | bestaat | Een afzegging na betalen zet een recht klaar. Een mens op naam voert het uit, met een tweede mens vanaf € 1.000, en het geld komt één keer terug. | — | — |
| Reisbudget of pot vooraf | L1 | half | Het lid zet geld opzij voor een reis (`geldbeleid/potten.js`), en bij het betalen ziet hij of de pot het dekt. Dat gebeurt nooit automatisch. | klein | later |

### 0.4 De gebruikersketen, met storingen

Keten: **een reis boeken → betaalbewijs → agendapunt → reisdossier → Geld
toont het**.

1. Het lid vraagt aan en de reisadviseur bevestigt (TravelOS). Geld toont
   "open: € x voor reis RTG-R-…".
2. Het lid betaalt, met bijladen als het saldo tekortschiet. Geld boekt één
   keer, TravelOS markeert "betaald", en Geld zet de verplichting dicht en de
   uitgaande stroom erin.
3. De agenda krijgt het reispunt en het reisdossier het betaalbewijs (TravelOS
   en de agenda geven het uit; Geld levert alleen het boekingsnummer).

Storingen:
- **Agenda valt uit.** De bevestigde reis en de betaling blijven staan. Geld
  raakt de agenda niet.
- **Geld of RTG Pay valt uit.** Betalen geeft "De betaallaag is niet
  beschikbaar." (503). De reis blijft bevestigd en onbetaald, en het scherm
  zegt dat.
- **De bank weigert.** De reis heet nergens betaald; het lid kan opnieuw
  proberen.
- **De bank blijft hangen.** "Wacht op bevestiging", nooit "betaald". De
  veegronde rondt de betaling later één keer af.
- **Crash na de boeking, vóór "betaald".** Een herhaling geeft dezelfde boeking
  terug en markeert dan; er wordt niet dubbel geboekt.
- **Reisdossier valt uit.** Het betaalbewijs staat in Geld (boekingsnummer en
  bedrag), zodat het lid het bewijs houdt.

### 0.5 Open vragen

Aan TravelOS:
1. Wie bezit het betaalscherm van een bevestigde reis: het reisscherm of
   `tab:betalen`?
2. Kent een bevestigde reis een betaaltermijn of vervaldag? Zo niet, dan toont
   Geld "open, geen vervaldag" en verzint geen datum.
3. Gaat TravelOS akkoord dat "betaald" alleen nog door de afhandelaar van de
   betaalwaarheid wordt gezet, zoals bij de bankstorting en de markt-deal?

Aan de eigenaar:
4. Is een reis een pasfunctie, of "minimaal een account"?

---

*De hoofdstukken per app volgen per familie.*
