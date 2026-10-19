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

## Familie 1 — betalen

Vier apps die samen één vraag beantwoorden: "kan ik betalen, en is het echt
gebeurd?". Pay is de rekening van het lid in het huis; Wallet bewaart passen
en munten; de tab Betalen is de snelle weg in de hoofdapp; RTG Code is de
code die de kassa scant.

### 1.1 Pay (`/apps/pay.html`, capability `betalen.rtgpay`)

**a. Doel.** Het lid wil zonder nadenken kunnen betalen, ontvangen en terughalen
binnen het huis, en altijd weten wat er werkelijk met zijn geld gebeurde.

**b. Wat er is.**
- Routes:
  - `server/routes/pay.js`: overzicht, oplaad, stuur, verzoek(*), saldo;
  - `pay-tegoed.js`: tegoed, tik, kascode;
  - `pay-terug.js`: terugstand, rekening, terug;
  - `pay-waarde.js`: portefeuille, graaf;
  - de zaakkant in `pay-zaak*.js`;
  - de kantoorkant: `/api/office/pay/bewijs` en `pay-correctie.js`.
- Kern: `server/kern/pay/*`, met opladen via de betaalwaarheid, `metIdem` op
  elke geldhandeling, de opdrachtenrij voor terugstorten, het walletplafond
  (`plafond.js`) en de eigen geldgrens (`koppelGrens`).
- Voltooiscenario: `scripts/lib/voltooi/pay.js` (`link:pay`).
- Toetsen:
  - `test/wallet-gratisaccount*.test.js`;
  - `test/sociaal-gratisaccount.test.js`;
  - `test/tegoedterug-gratisaccount.test.js`;
  - `test/simulatie-uitbetaling.test.js`.

**c. Objecten en eigenaar.**
- Saldi, boekingen en verzoeken (`paySaldi`, `payBoekingen`, `payVerzoeken`) en
  de idem-bak `payIdem` zijn van Pay.
- `apps/pay.html` is de eigenaar van `betalen.rtgpay` (`SCHERMEIGENAAR.json`).

**d. Handelingen, van begin tot herstel.**
- opladen
- zien
- sturen
- een Klompje vragen en betalen
- tikken
- tegoed klaarzetten en verzilveren
- de kascode
- terugstorten naar het eigen IBAN

Wat er misgaat:
- een weigering van de bank;
- de bank blijft hangen; de veegronde vangt dat op;
- een dubbele tik;
- een crash.

Herstel en terugdraaien:
- het controleren en afronden door een mens op naam;
- de terugboeking.

**e. Rechten.**
- Elk account, ook gratis, met de paspoortpoort op elk geldmoment.
- De zaak int via de kassa.
- Het kantoor ziet het bewijsbord en corrigeert facturen.
- De Lifestyle- en Business-pas zijn vrij van de paspoortpoort.
- Geldgrenzen:
  - 1 cent tot € 5.000 per boeking;
  - een walletplafond van € 10.000 (de boardroom zet het);
  - de eigen geldgrens, die weigert.

**Zes lagen, oordeel.**
- **L1 vol.**
- **L2** bestaat aan de zaakkant (`pay-zaak*.js`), niet voor professionals van
  het lid.
- **L3** alleen voor de zaak (budgetten, treasury); geen gezamenlijke rekening
  voor een huishouden.
- **L4** de waardegraaf ("waar ging deze euro heen") bestaat; een vooruitblik
  zit in Geld Command.
- **L5** het bijladen gaat via de betaalwaarheid; terugstorten via de
  opdrachtenrij; de veegronden voor betalingen en terugbetalingen bestaan.
- **L6** veel ontvangen ketens (zorg, assets, markt, wbw, festival, kassa).

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Opladen, sturen, Klompje, tikken | L1 | bestaat | Een gekeurd account laadt op, stuurt en betaalt een Klompje; een dubbele tik of crash boekt één keer. | — | — |
| Terugstorten naar het eigen IBAN | L5 | bestaat | Alleen naar de eigen gekeurde rekening en het beschikbare deel, één keer; weigert de rail, dan komt het geld terug. | — | — |
| De kascode tonen in Pay | L1 | half | Het lid toont in Pay een kassacode die vijf minuten geldt; vandaag roept `pay.html` `/api/pay/kascode` niet aan. | klein | nu |
| Eigen categorieën en zoeken in de geschiedenis | L1 | ontbreekt | Het lid zoekt een betaling op tekst, bedrag of datum en geeft een betaling een eigen categorie. Bij Emma is dit Pro, bij Monzo Extra (fragment). | middel | nu |
| Export van de geschiedenis (CSV/PDF) | L5 | half | Het lid downloadt zijn betalingen van een periode. De bank heeft al `afschrift.csv`; Pay nog niet. Bij Emma is dit Pro (fragment). | klein | nu |
| Potjes met een eigen doel | L1 | bestaat (in Geld Command) | Het lid zet geld opzij in een pot; de pot gaat nooit onder nul. Bij bunq kost een extra rekening een betaald pakket (fragment). | — | — |
| Gezamenlijke pot of rekening voor een huishouden | L3 | ontbreekt | Twee leden zien en vullen samen een pot; elk ziet wie wat deed; geld eruit vraagt de bevestiging van beide. Bij bunq is aanmaken betaald (fragment). | groot | later |
| Afrondsparen | L1 | ontbreekt | Bij elke betaling rondt het lid af naar de pot die hij kiest; uitzetten kan altijd. Bij Monzo is het veelvoud betaald (fragment). | middel | later |
| Wegwerp- of extra virtuele kaarten | L1 | niet | — | — | niet: RTG geeft zelf geen kaarten uit; die horen bij een bankvergunning (extern) |
| Aankoop- en annuleringsdekking, lounges | — | niet | — | — | niet: verzekering of verdienmodel (GELD.md par. 7) |

**f. De twee modi.**
- **LOS.** Pay rondt zijn kerntaak zelf af. Wat er gebeurt als er iets uitvalt:
  - de betaalprovider valt uit: opladen geeft 503 met "er is niets
    afgeschreven", en sturen uit het saldo werkt gewoon door;
  - de betaalstop staat aan: "Betalen staat bewust uitgeschakeld. Er is niets
    afgeschreven.";
  - de bank is niet live: het bijladen vanaf de bank zegt dat, maar de kaart
    werkt.
- **SAMEN.** Pay geeft een boekingsnummer, een tikcode, een kascode en een
  tegoedcode uit. Hij ontvangt betalingen van zorg, assets, markt, wbw, de
  kassa, festival en de app store.

**Keten.** Een lid betaalt een zorgbehandeling:
1. Zorg vraagt `pay.betaalZaak` aan, met de sleutel per boeking.
2. Pay boekt, en laadt bij als het saldo tekortschiet.
3. Zorg zet "betaald".

Storingen:
- Weigert de bank, dan blijft de boeking "wacht op betaling" en verdienen de
  punten niets.
- Valt zorg uit, dan blijft de betaling in Pay staan met het boekingsnummer.

**g. Betaalmuur** (fragment, 19 oktober 2026):
- Revolut Plus/Premium/Metal/Ultra: koopbescherming, voorrang bij support en
  ruimere wisselgrenzen; alleen in Ultra: lounges, partnerabonnementen en
  annuleringsdekking (revolut.com/revolut-plus/, revolut.com/ultra-plan/).
- bunq Core/Pro/Elite: aantal IBAN's (3/5/25), een gezamenlijke rekening
  aanmaken en budgetfuncties; alleen in Elite: reisverzekering en ZeroFX
  (us.fitgap.com/products/bunq, help.bunq.com/articles/whats-a-joint-account-and-how-do-i-create-one).
- Monzo Extra/Perks/Max: andere banken koppelen, afrondsparen, eigen
  categorieën, virtuele kaarten (monzo.com/current-account/extra).

Wij hebben:
- de basis (betalen, sturen, verzoeken, potten, terugstorten);
- half: de export;
- niet: categorieën en zoeken.

**j. Extern.** Een echte betaalprovider en zijn vrijgave. Elektronisch geld
(B3) zolang er een terugstorting naar een IBAN bestaat; de vrijgavepoort beslist.
Een kaart uitgeven vraagt een bankpartner.

### 1.2 Wallet (`/apps/geld.html#wallet`)

**a. Doel.** Alles wat je bij je wilt hebben (passen, kaarten, munten) op één
plek, en weten wanneer iets verloopt.

**b. Wat er is.**
- Routes (`server/routes/zorgwallet.js`): `/api/wallet`, `/voeg`, `/weg`,
  `/munt/koop` (met de paspoortpoort) en `/munt/wissel`; voor elk account
  (`eenAccount`).
- Kern: `server/kern/wallet.js`. Munten worden betaald via `pay.huisIn`; een
  herhaling geeft geen munten erbij.
- Voltooiscenario: `voltooi/wallet.js` (`link:wallet`).

**c. Objecten en eigenaar.**
- `db.data.wallet[key]` hoort bij `geld.overzicht`.
- De zorgpas komt binnen van `kern/zorgpolis.js` (walletVoeg/walletWegBron); de
  pas blijft van de verzekeraar.

**e. Rechten.** Elk account; alleen een munt kopen vraagt het paspoort.

**Zes lagen, oordeel.**
- **L1** passen en munten bestaan.
- **L2** de verzekeraar levert de zorgpas.
- **L3** niet van toepassing.
- **L4** verloopsignalen ontbreken (GELD.md fase 5).
- **L5** een pas toevoegen, laten verlopen en weghalen: het verlopen ontbreekt.
- **L6** de zorgpas komt binnen; andere passen (gemeente, sportclub,
  bibliotheek) nog niet.

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Passen en munten bewaren | L1 | bestaat | Een lid legt een kaart in de wallet en haalt hem weg; een ander lid ziet hem niet. | — | — |
| Feestmunten kopen en inwisselen | L1 | bestaat | Munten worden één keer betaald en gaan nooit onder nul. | — | — |
| Verloopsignaal per pas | L4 | ontbreekt | Dertig dagen voor een pas verloopt, ziet het lid een signaal met de pas en de datum; een pas zonder datum geeft geen signaal. | klein | nu |
| Passen uit andere apps ontvangen | L6 | half | Een pas die een andere app uitgeeft, verschijnt in de wallet als verwijzing; haalt die app hem in, dan verdwijnt hij. Vandaag doet alleen de zorgpas dat. | middel | later |
| Pass tonen aan de balie (QR) | L1 | bestaat (RTG Code) | Zie 1.4. | — | — |

**f. LOS en SAMEN.**
- **LOS.** Passen staan lokaal in de wallet. Valt Pay uit, dan kan het lid geen
  munten kopen ("er is niets afgeschreven"), maar de passen blijven zichtbaar.
- **SAMEN.** De wallet ontvangt passen als verwijzing. **Keten:** een
  verzekeraar schrijft een lid in, en de zorgpas verschijnt in de wallet.
  Stopt de polis, dan gaat de pas eruit. Valt de verzekeraar uit, dan blijft de
  laatst bekende pas staan, met de datum van de laatste stand.

**g. Betaalmuur.** De Apple- en Google-wallets zijn gratis. Hier zit geen
betaalmuur bij de marktleiders (fragment, payconiq.be/en/faq/…). De ondergrens
is dus: alles gratis, en dat zijn wij.

### 1.3 De tab Betalen (`/apps/app.html#tab=betalen`)

**a. Doel.** In twee tikken een zaak of een verzoek betalen vanuit de hoofdapp.

**b. Wat er is.**
- Routes (`server/routes/member/kopen.js`): `/api/betaal/direct`, `/verzoeken`,
  `/verzoek/pay`, `/mijn`, en `/api/munt/direct`.
- Kern: `server/kern/directpay/` (direct betalen via de betaalwaarheid, met
  verzoeken van zaken).
- Voltooiscenario: `voltooi/betalen.js` (`tab:betalen`).
- Bezitspoort: `/api/betaal/` staat in de bezitspaden.

**c. Objecten en eigenaar.** `directBetalingen`, `betaalVerzoeken` en
`directOntvangsten` horen bij `geld.overzicht` via `kern/directpay`.

**e. Rechten.**
- Een lid betaalt.
- Een zaak maakt verzoeken (`routes/supplier/gastcontact.js`).
- Een gast wordt geweerd (403).

**Gemeten gat.** Er is geen paspoortpoort in `kopen.js`, terwijl Pay die op elk
geldmoment heeft. De betaalwaarheid rondt de betaling wel eerlijk af, maar de
regel "het paspoort op elk geldmoment" (besluit van 19 oktober) geldt hier
niet.

**Zes lagen, oordeel.**
- **L1** bestaat.
- **L5** de betaalwaarheid: een weigering wordt gemeld en een betaling die
  blijft hangen, wordt niet "betaald".
- **L6** de zaakverzoeken komen binnen.
- L2, L3 en L4: niet van toepassing; het overzicht zit in Pay en Geld Command.

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Een zaakverzoek betalen | L1 | bestaat | Een verzoek van een zaak wordt één keer betaald; een bankweigering wordt gemeld. | — | — |
| De paspoortpoort op direct betalen | L1 | ontbreekt | Een ongekeurd account betaalt niet en krijgt de paspoortweg; een gekeurd account wel. | klein | nu |
| De reis betalen vanuit de tab | L6 | ontbreekt | Zie 0.3: een bevestigde reis staat in de lijst met verzoeken en wordt daar betaald. | klein | nu (na de vraag aan TravelOS) |

**f. LOS en SAMEN.**
- **LOS.** Valt de betaalwaarheid uit, dan staat er "De betaalwaarheid is niet
  aangesloten; er is niets afgeschreven." (503). Staat de betaalstop aan, dan
  staat er "Betalen is tijdelijk uitgeschakeld."
- **SAMEN.** De tab ontvangt verzoeken van zaken (verzoek-ref) en geeft
  betaling-id's uit. **Keten:** een restaurant stuurt de rekening, het lid
  betaalt in de tab, en de zaak ziet de ontvangst. Weigert de bank, dan blijft
  het verzoek open; valt de zaakapp uit, dan staat de betaling bij het lid.

### 1.4 RTG Code (`/apps/geld.html#rtgcode`)

**a. Doel.** Laten zien wie je bent of betalen aan de balie, zonder iets
persoonlijks prijs te geven.

**b. Wat er is.**
- Routes (`server/routes/code.js`): `/api/code/dyn` en `/api/code/scan`, met
  `appSessie`.
- Kern: `server/kern/betaalcode.js` (een ondoorzichtige verwijzing van 128 bit,
  eenmalig) en `kern/dyncode.js`.
- Voltooiscenario: `voltooi/rtgcode.js` (`link:rtgcode`).

**c. Objecten en eigenaar.** `betaalcodes` (duurzaam) hoort bij
`geld.overzicht`.

**e. Rechten.**
- Een lid toont de code.
- Alleen een kassa (zaak, personeel, kantoor) verbruikt hem en krijgt de
  codenaam.
- Een lid dat scant, krijgt niets persoonlijks.

**Zes lagen, oordeel.**
- **L1** bestaat.
- **L2** de zaak scant.
- **L5** een code verloopt en wordt één keer gebruikt.
- **L6** de code wordt verbruikt in de bestaande afrekenroutes.
- L3 en L4: niet van toepassing.

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Een levende code tonen en eenmalig laten scannen | L1 | bestaat | Een kassa scant de code één keer; een tweede scan zegt "al gebruikt". Een vervalste of verlopen code wordt geweigerd. | — | — |
| Code zonder netwerk tonen | L1 | ontbreekt | Zonder verbinding toont het toestel nog een code die een paar minuten geldt en offline te controleren is. | middel | later |

**f. LOS en SAMEN.**
- **LOS.** Zonder camera staat er "Camera niet beschikbaar." Een verlopen code
  zegt "Laat een verse code tonen."
- **SAMEN.** De code is een verwijzing die de kassa inwisselt voor de codenaam.
  **Keten:** een lid laat de code zien, de kassa rekent af via Pay en het lid
  ziet de betaling. Valt Pay uit, dan geeft de kassa geen "betaald".

**g. Betaalmuur.** Payconiq, iDEAL QR en Apple Pay zijn gratis voor
consumenten; geen enkel fragment noemt een betaalde functie (fragment,
payconiq.be/en/faq/is-the-payconiq-by-bancontact-app-free-of-charge). De
ondergrens is dus gratis, en dat zijn wij.

---

## Familie 2 — rekening en overzicht

Drie apps:
- de **Bank**: de echte rekening, zodra het kantoor hem live zet;
- **Geld Command**: het overzicht met beleid, potten en vooruitblik; hier komen
  de zes uitbreidingen van de eigenaar en de zes "Beyond"-systemen samen;
- **Balans**: werk, privé en rust.

### 2.1 Bank (`/apps/geld.html#bank`)

**a. Doel.** Een eigen rekening waarop je geld ontvangt, spaart en overboekt,
met een afschrift dat klopt tot op de cent.

**b. Wat er is.**
- Routes (`server/routes/bank.js`, `bankhart.js`): akkoord, rekening/open,
  storten, overboeken, naar-wallet en van-wallet, sepa, spaardoel, passen,
  krediet, terugkerend, bulk, salaris, advies en `afschrift.csv`, plus `hart`,
  `inzichten`, `vastelasten` en `veeg`.
- Alles achter `gate`: "De RTG Bank is nog niet live voor leden."
- Kern: `server/kern/bank/*`.
  - Storten loopt via de betaalwaarheid (`stortwaarheid.js`).
  - SEPA-uit loopt via de opdrachtenrij.
  - Er draaien ronden voor rente en incasso.
- Voltooiscenario: `voltooi/bank.js` (`link:bank`).

**c. Objecten en eigenaar.** `bankRekeningen`, `bankSaldi`, `bankBoekingen`,
`bankKredieten` en `bankAkkoord` horen bij `geld.overzicht`.

**e. Rechten.**
- Een lid met een pas, en alleen als het kantoor de leden-bank live zet.
- Een zaak heeft een zakelijke rekening (`supplierAuth`).
- Het kantoor zet de regels en de schakelaar.
- Er is geen paspoortpoort in de bankroutes (gemeten).

**Zes lagen, oordeel.**
- **L1** rekening, storten, overboeken en afschrift bestaan.
- **L2** de zakelijke rekening, zzp en salaris bestaan.
- **L3** bulkbetalingen en salaris bestaan; meerdere handtekeningen binnen een
  bedrijf niet.
- **L4** `inzichten` en `vastelasten` bestaan.
- **L5** van akkoord tot sluiten, met de opdrachtenrij en rondes.
- **L6** de wallet wordt gedekt vanuit de bank (`walletbrug.js`).

**Afwijking van een harde grens (vraagt besluit).** In de code staan twee dingen
die `GELD.md` par. 7 uitsluit:
- **krediet**: `server/kern/bank/krediet.js`, leningen van € 100 tot € 50
  miljoen tegen 7% rente; het kantoor beslist;
- **advies**: `server/kern/bank/advies.js`, een AI-bankier die "concreet,
  eerlijk advies" geeft over rood staan en sparen.

Beide staan achter de leden-bank, die uit staat. Ik bouw hier niets bij en
haal ook niets weg: of ze blijven is aan de eigenaar. Krediet vraagt hoe dan
ook een vergunning.

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Rekening openen, storten, overboeken, afschrift | L1 | bestaat | Na akkoord opent het lid een rekening, stort er geld op en boekt over; het afschrift sluit. Een dubbele tik boekt één keer. | — | — |
| Meerdere eigen rekeningen (potjes met IBAN) | L1 | half | Het lid opent een spaarrekening naast de betaalrekening. Bij bunq is 5 of 25 betaald (fragment). | klein | later (na live) |
| Vaste lasten zien | L4 | bestaat | `vastelasten` toont de terugkerende afschrijvingen. | — | — |
| Paspoortpoort op de bank | L1 | ontbreekt | Een ongekeurd account opent geen rekening en krijgt de paspoortweg. | klein | nu (vóór live) |
| Gezamenlijke rekening | L3 | ontbreekt | Twee leden openen samen een rekening; elk ziet alles, en overboeken boven een grens vraagt beide. | groot | later |
| Krediet en lening | — | bestaat | — | — | **niet**, tenzij de eigenaar anders besluit: GELD.md par. 7 sluit krediet uit, en het vraagt een vergunning |
| AI-bankier "advies" | L4 | bestaat | — | — | **vraagt besluit**: alleen uitleg en geen advies. De tekst herschrijven naar de fiscale klassen ("advies" betekent: een mens beoordeelt) |

**f. LOS en SAMEN.**
- **LOS.** Staat de bank niet live, dan toont het scherm "RTG Rekening opent hier
  zodra RTG hem live zet. Je RTG Pay-wallet werkt gewoon door." De wallet blijft
  werken.
- **SAMEN.** De bank geeft een IBAN en een boekingsnummer uit, dekt de wallet
  (`pay.koppelBank`) en ontvangt salaris.

**Keten.** Het salaris komt binnen via de payroll. De bank boekt het, en Geld
Command toont "inkomen verwacht en binnen".

Storingen:
- Valt de payroll uit, dan blijft de bankboeking staan.
- Valt de bank uit, dan heet het salaris "verwacht" en niet "ontvangen".

**g. Betaalmuur** (fragment):
- bunq: extra IBAN's en het aanmaken van een gezamenlijke rekening zijn
  betaald (us.fitgap.com/products/bunq;
  help.bunq.com/articles/whats-a-joint-account-and-how-do-i-create-one).
- Monzo Extra: andere banken koppelen en eigen categorieën
  (monzo.com/current-account/extra).

Wij hebben:
- de rekening;
- de vaste lasten (gratis);
- half: meerdere rekeningen;
- niet: de gezamenlijke rekening.

**j. Extern.**
- Een bankvergunning, of een gereguleerde bankpartner; zonder dat blijft de
  leden-bank uit.
- SEPA via een partner.
- Krediet: een vergunning plus een eigen besluit.

### 2.2 Geld Command (`/apps/geld.html`, eerste stand)

**a. Doel.** In één oogopslag weten hoe je ervoor staat, wat er aankomt en
wat je moet doen, en verder niets.

**b. Wat er is.**
- Routes (`server/routes/geld.js`): `/api/geld/cockpit`, beleid,
  pot/zet/reserveer/weg, actielog, grens/zet/weg, en `/api/geld/rahul`.
- Kern:
  - `server/kern/geldbeleid/` (regels met vier niveaus, potten, een harde
    geldgrens die weigert, het actielog: alleen toevoegen, maximaal 200);
  - `server/kern/geldgraaf/` (een alleen-lezen projectie over wallet, wbw,
    mecenaat, labfonds en payroll; `patronen.js` herkent terugkerende posten;
    `vooruitblik.js` geeft het verwachte saldo per horizon; `tijdlijn`).
- Voltooiscenario: `voltooi/geldcommand.js` (`link:geldcommand`).
- GELD.md fase 1 staat "in aanbouw"; fase 2 tot en met 5 nog niet.

**c. Objecten en eigenaar.** `geldbeleid.perLid[codenaam]` (regels, potten, log,
grenzen) hoort bij `geld.overzicht`. De geldgraaf heeft niets eigens; hij is een
projectie.

**e. Rechten.**
- Alleen een lid met een pas: `geenGast` weigert ook een gratis account ("RTG
  Geld is voor leden.").
- **Vraagt besluit**: valt Geld Command onder "minimaal een account", zoals
  Wallet en Pay?

**Zes lagen, oordeel.**
- **L1** beleid, potten en grens bestaan.
- **L4** de vooruitblik en de patronen bestaan; scenario's ontbreken.
- **L5** het actielog bestaat; een jaararchief ontbreekt.
- **L6** de projectie over vijf bronnen bestaat.
- L2 en L3: niet van toepassing, of bij Bank en Pay.

**De zes uitbreidingen van de eigenaar, naast wat er al is.**

| Functie | Laag | Stand | Wat er al voor is | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Vermogensoverzicht | L1 | half | `/api/pay/portefeuille` (vrij besteedbaar en gebonden, per positie), `bank/overzicht` | Het lid ziet al zijn eigen posities bij RTG naast elkaar, en zelf ingevoerde bezittingen en schulden apart gemarkeerd als "eigen opgave". Er is geen totaal zonder bron. Bij Emma Pro, bij Monarch Core (fragment). | middel | nu |
| Schuldenplanning (aflosplan) | L4 | ontbreekt | niets (alleen in het spel Magnaat) | Het lid voert zelf een schuld in met bedrag, rente en termijn, en ziet hoe lang aflossen duurt bij een gekozen bedrag per maand. Er staat bij dat dit een rekensom is, geen advies. Undebt.it heeft het gratis (fragment). | middel | nu |
| Contracten en abonnementen | L1/L4 | half | `geldgraaf/patronen.js` herkent terugkerende posten; `bank/vastelasten` | Het lid ziet zijn terugkerende afschrijvingen als lijst, kan er zelf een contract met einddatum en opzegtermijn aan koppelen, en krijgt een signaal vóór de opzegdatum. Opzeggen doet het lid zelf. Dyme heeft een gratis overzicht; bij Rocket Money is een opzegdienst betaald (fragment). | middel | nu |
| Prijsstijging en ongebruikt abonnement | L4 | ontbreekt | `patronen.js` (ritme, geen bedrag) | Stijgt een terugkerende post, dan ziet het lid het verschil en de datum. "Ongebruikt" verschijnt alleen als het lid zelf aangeeft dat hij het niet gebruikt. GELD.md fase 2. | klein | nu |
| Huishoudscenario's | L4 | half | `kern/fiscaal/scenario.js` (zaken: personeel, omzet; schrijft niets); `geldgraaf/vooruitblik.js` | Het lid kiest "wat als" (een reis, een aankoop, minder inkomen) en ziet het verwachte saldo per maand ernaast, met de aanname. Niets wordt opgeslagen als feit. GELD.md fase 2. Bij Monarch is forecasting alleen Plus (fragment). | middel | nu |
| Verplichtingenkalender en financiële gebeurtenissen | L4/L6 | half | `vooruitblik.js` neemt gedateerde verplichtingen mee; `kern/commercie/contract/verplichting.js` (RTG-contracten) | Het lid ziet per maand wat er vast moet gebeuren (verwachte afschrijving, bevestigde reis, servicefee, contractdatum), elk met een verwijzing naar de app die het bezit. Wat geen datum heeft, staat apart. Monarch heeft een kalender (fragment). | middel | nu |
| Gezamenlijke budgetten | L3 | ontbreekt | WBW (een gedeeld lijstje), potten (per lid) | Twee leden maken samen een budget; elk ziet de stand; wat privé blijft, blijft privé. Bij Emma alleen Ultimate (fragment). | groot | later |
| Kasstroomprognose | L4 | half | `vooruitblik.js` (7/30/90 dagen) | Het lid ziet de verwachte in- en uitstroom per week of maand; verwacht heet "verwacht", nooit "geboekt"; een post zonder datum telt niet mee. | klein | nu |
| Besluitvergelijking | L4 | ontbreekt | `fiscaal/scenario.js`-vorm | Het lid zet twee keuzes naast elkaar (huren of kopen, nu of later betalen) met zijn eigen getallen, en ziet het verschil per jaar. Geen advies over beleggen, krediet of verzekeren; de uitkomst draagt de fiscale klasse "advies". | middel | later |
| Langetermijnplanning | L4 | ontbreekt | potten met doel | Het lid zet een doel met bedrag en datum en ziet hoeveel per maand nodig is. Er is geen rendement of beleggingsaanname. Boldin noemt Monte Carlo betaald (fragment); dat doen wij niet. | middel | later |

**De zes "Beyond"-systemen van de eigenaar, naast wat er al is.** Er komt geen
nieuwe laag (bijstelling van 19 oktober):

| Systeem | Bestaat al als | Wat het nog vraagt |
|---|---|---|
| Financiële werkelijkheid | geldgraaf (projectie over vijf bronnen), portefeuille, de betaalwaarheid (alleen bevestigd heet betaald) | meer bronnen als verwijzing: bank, reis, assets, zorg |
| Toekomstsimulator | `geldgraaf/vooruitblik.js`, `fiscaal/scenario.js` | huishoudscenario's (hierboven) |
| Beslismotor | `geldbeleid/regels.js` en `evalueer.js` (vier niveaus, gift-bevestiging) | besluitvergelijking (hierboven) |
| Contractbewaking | `patronen.js`, `bank/vastelasten` | een contract koppelen met opzegtermijn (hierboven) |
| Automatisering met goedkeuring | geldbeleid: automatisch alleen de maandelijkse reservering binnen het eigen tegoed; de rest klaarzetten. Stuurlaag: `kern/stuur/beleid.js`, `mandaat.js` | niets nieuws; de grens blijft (geld verlaat het huis nooit vanzelf) |
| Financieel geheugen | `geldbeleid/actielog.js` (alleen toevoegen), `geldgraaf.tijdlijn` | een jaaroverzicht en export (Familie 1, Pay) |

**f. LOS en SAMEN.**
- **LOS.** Valt een bron uit, dan zegt het overzicht "Niet opgehaald: … Dit
  beeld is niet compleet." (`overzicht.js:122`) en rekent niet verder op een
  gat. Geld Command werkt met wat er is.
- **SAMEN.** Geld Command ontvangt projecties van Pay, WBW, Mecenaat, Labfonds
  en payroll, en (voorstel) van een reis, assets en wonen (zie L6 hieronder).
  Het geeft alleen links uit naar `/apps/geld.html#<stand>`.

**Keten.** Een lid zet een pot voor de huur. De geldgrens weigert een betaling
die de buffer zou breken. Het actielog bewaart beide.

Storingen:
- Valt de geldgraaf uit, dan blijven pot en grens werken; de grens zit in de
  betaalpoort.

**Ontvangen ketens (L6), uit LivingOS-A en -B (voorlopig).**
- **Assets:** koop en herroeping via de betaalwaarheid. De servicefee: het
  voorstel is dat Assets eigenaar blijft en Geld alleen de projectie in de
  verplichtingenkalender toont.
- **Wonen:** woonlasten. Een eigen verplichtingenobject bestaat niet. Het
  voorstel aan de eigenaar is "verplichting van Geld"; tot dan geldt "Wonen
  verwijst".
- **Vakwerk:** een betaling per opdracht met bronRef.
- **Sport:** een stadionticket.
- **Mall en foodcourt:** bestellingen.
- **Table:** een aanbetaling, waar die bestaat.

Bij alle ketens geldt: het lid bevestigt elke betaling, en geen gegevens
worden gedeeld.

**g. Betaalmuur** (fragment, 19 oktober 2026):
- YNAB: alles betaald, er is geen gratis laag (ynab.com/pricing).
- Monarch Core: budgetten, nettovermogen en een gedeelde partner; Plus-only:
  forecasting en het modelleren van levensgebeurtenissen
  (help.monarch.com/hc/en-us/articles/48349699981972-Monarch-Plus-Tier).
- Emma Pro: nettovermogen, eigen categorieën en export; Ultimate-only: "Spaces"
  (een gedeeld budget)
  (help.emma-app.com/en/article/what-are-the-features-of-emma-plus-pro-and-ultimate-678fjp/).
- Dyme (NL): een gratis abonnementsoverzicht; budgetten en export betaald
  (financer.nl/persoonlijke-financien/dyme-app-review).

Wij hebben:
- budgetregels, potten, de vooruitblik en de terugkerende posten (gratis);
- half: het vermogensoverzicht;
- niet: scenario's, de gezamenlijke budgetten en de kalender als scherm.

**j. Extern.** Een bankkoppeling met andere banken (PSD2) vraagt een
AISP-vergunning of -partner; tot dan alleen RTG-bronnen en de eigen opgave.

### 2.3 Balans (`/apps/geld.html#balans`)

**a. Doel.** Rust: zien of je week ademt, zonder dat iemand je bijhoudt.

**b. Wat er is.**
- Routes: `/api/balans` (`server/routes/balans.js`) en `/api/staff/balans`.
- Kern: `server/kern/balans.js`, een weekbeeld uit de eigen agenda en de
  grootboekrijen, met adviezen. Er wordt niets nieuws vastgelegd.
- Voltooiscenario: `voltooi/balans.js` (`link:balans`).

**c. Objecten en eigenaar.** Balans heeft niets eigens; het leest de agenda en
de boekingen.

**Zes lagen, oordeel.**
- **L1** het weekbeeld bestaat.
- **L4** de adviezen zijn regels, geen voorspelling.
- **L6** leest de agenda en Pay.
- L2, L3 en L5: niet van toepassing. Het weekbeeld voor personeel (`staff`)
  bestaat al.

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Weekbeeld en rustadvies | L1 | bestaat | Een lege week "ademt"; een volle week geeft een rustadvies; een ander lid ziet niets. | — | — |
| Trend over meerdere weken | L4 | ontbreekt | Het lid ziet vier weken naast elkaar; er wordt niets opgeslagen, alles wordt berekend uit de agenda. Reclaim heeft analyse in een betaald pakket (fragment). | klein | later |
| Financieel welzijn (GELD.md fase 3) | L4 | ontbreekt | Balans toont naast de tijd ook de vrije ruimte deze maand, uit Geld Command, als verwijzing. | middel | later |

**f. LOS en SAMEN.**
- **LOS.** Zonder agenda toont Balans een lege week en zegt dat de agenda de
  bron is.
- **SAMEN.** Balans leest de agenda en Pay; het geeft niets uit.

**Keten.** Een lid plant vier avonden; Balans raadt een rustdag aan.
- Valt de agenda uit, dan geeft Balans geen verzonnen beeld.

**g. Betaalmuur** (fragment): Reclaim Starter (People Analytics) en Clockwise
Teams (team analytics) zijn betaald (reclaim.ai/pricing,
support.getclockwise.com/article/75-clockwise-plan-offerings). Wij hebben het
weekbeeld gratis; een trend niet.

---

## Familie 3 — samen geld

### 3.1 WBW, Wie betaalt wat (`/apps/geld.html#wbw`)

**a. Doel.** Met vrienden samen uitgeven zonder ruzie: weten wie wat betaalde en
het in één tik rechtzetten.

**b. Wat er is.**
- Routes (`server/routes/wbw.js`): mijn, maak, groep, uitgave, verreken en
  verzoek.
  - `verreken` heeft de paspoortpoort en de bezitspoort.
  - `geenGast` weigert elk gratis account ("Wie betaalt wat is voor leden.").
- Kern: `server/kern/wbw.js`.
  - Alleen Salon-vrienden.
  - Een exacte verdeling tot op de cent.
  - Verrekenen loopt via `pay.stuur`, met een sleutel per boeking.
- Voltooiscenario: `voltooi/wbw.js` (`link:wbw`).

**c. Objecten en eigenaar.** `wbwGroepen` (kern/wbw) hoort bij
`geld.overzicht`. De vriendschap blijft van de Salon.

**e. Rechten.**
- Alleen een lid met een pas.
- Alleen Salon-vrienden kunnen in een groep.
- Grenzen: 50 groepen, 12 leden en 500 regels; € 25.000 per uitgave.
- **Vraagt besluit**: een gratis account mag sinds 19 oktober sturen en
  betaalverzoeken doen, maar WBW weigert het nog.

**Zes lagen, oordeel.**
- **L1** groep, uitgave en verrekenen bestaan.
- **L4** alleen de verdeling; geen statistiek.
- **L5** verrekenen gaat één keer, ook bij een crash. Een verzoek heeft geen
  sleutel.
- **L6** de Salon (vrienden) en Pay (stuur, Klompje).
- L2 en L3: niet van toepassing.

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Groep, uitgave en exacte verdeling | L1 | bestaat | Drie vrienden delen een rekening; de stand klopt tot op de cent; een buitenstaander ziet niets. | — | — |
| In één tik verrekenen | L1 | bestaat | Wie rood staat, verrekent via RTG Pay; een dubbele tik betaalt één keer. | — | — |
| Onbeperkt uitgaven | L1 | bestaat | Er is geen daglimiet. Splitwise Free heeft er een (fragment). | — | — |
| Bon per regel splitsen | L1 | ontbreekt | Het lid splitst een uitgave per regel van de bon over verschillende mensen. Splitwise Pro (fragment). | middel | later |
| Valuta omrekenen in de groep | L1 | ontbreekt | Een uitgave in een andere munt telt in euro mee, met de koers en datum erbij. Splitwise Pro (fragment). | middel | later |
| Export en afrekenoverzicht | L5 | ontbreekt | Het lid downloadt de groep met alle regels en de eindstand. Tricount haalde dit weg (fragment). | klein | nu |
| Een sleutel op het verzoek | L5 | ontbreekt | Twee tikken op "vraag" maken één betaalverzoek. | klein | nu |
| Automatisch de groep herkennen (GELD.md fase 4) | L4 | ontbreekt | — | — | later: het vraagt context van reis en salon, en eerst toestemming |

**f. LOS en SAMEN.**
- **LOS.** Valt Pay uit, dan houdt het lijstje de stand. Verrekenen zegt dat
  betalen nu niet kan, en de stand blijft onveranderd.
- **SAMEN.** Leest de vriendschap uit de Salon; verrekent via Pay; geeft een
  verwijzing per groep uit.

**Keten.** Een weekend weg (reis):
1. Iedereen zet uitgaven in de groep.
2. Wie rood staat, verrekent.
3. Pay boekt het.
4. Geld Command toont het als uitgave aan een vriend.

Storingen:
- Valt de Salon uit, dan blijft een bestaande groep werken, maar kan er geen
  nieuw lid bij.
- Weigert Pay, dan blijft de schuld staan en heet het niet "verrekend".

**g. Betaalmuur** (fragment):
- Splitwise Pro: onbeperkt uitgaven, bonscan, per regel splitsen, omrekenen,
  grafieken en zoeken
  (androidcentral.com/apps-software/the-app-splitwise-is-the-best-hack-to-split-group-trip-expenses-in-2026).
- Tricount: gratis, maar export en statistiek zijn weggehaald
  (help.tricount.com/articles/what-happened-with-tricount-premium).
- Tikkie: gratis (abnamro.nl/…/tikkie/).

Wij hebben:
- onbeperkt, en direct verrekenen;
- niet: per regel splitsen, omrekenen en export.

### 3.2 Labfonds (`/apps/geld.html#labfonds`)

**a. Doel.** Samen geld toezeggen aan een plek of onderzoek dat je raakt, en er
samen over beslissen.

**b. Wat er is.**
- Routes (`server/routes/labfonds.js`): overzicht, locatie/maak, doneer,
  voorstel/maak, stem, scheidsrechter, beslis en financiering, plus de
  gezinsdeur `/api/rtf/labfonds/*` en `/api/labfonds/boardroom` voor het
  kantoor.
- Kern: `server/kern/labfonds.js`, `labfonds/voorstellen.js` en
  `labfonds/onderzoek.js`.
- "Een toezeggingen-grootboek en geen kas; er verhuist hier geen euro."
- Voltooiscenario: `voltooi/labfonds.js` (`link:labfonds`).

**c. Objecten en eigenaar.** `labFonds` (locaties, bijdragen en voorstellen)
hoort bij `geld.overzicht`. De onderzoeken blijven van het RTF-onderzoekslab.

**e. Rechten.**
- Elk account, ook gratis; een anonieme gast niet.
- Alleen wie het voorstel indiende, sluit de stemming.
- In het gezin zegt een volwassene toe.

**Zes lagen, oordeel.**
- **L1** toezeggen, voorstellen en stemmen bestaan.
- **L3** de scheidsrechter en het gezin bestaan.
- **L5** een toezegging telt één keer.
- **L6** het onderzoekslab en de Foundation.
- L2 en L4: niet van toepassing.

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Toezeggen, voorstellen en stemmen | L1/L3 | bestaat | Een toezegging telt één keer; alleen de indiener sluit; een ander lid stemt. | — | — |
| Openbare verantwoording van een pot | L5 | half | Iedereen in de pot ziet wat er is toegezegd, waaraan het besteed is en wie besloot. `financiering` bestaat; een overzicht per pot nog niet. Open Collective zet dit in een betaald pakket (fragment). | klein | nu |
| Toezegging omzetten in een echte betaling | L6 | ontbreekt | — | — | **vraagt besluit**: vandaag beweegt er bewust geen euro; een betaling vraagt een kas en de fiscale klassen |

**f. LOS en SAMEN.**
- **LOS.** Zonder onderzoeksplatform staat er "Het onderzoeksplatform is hier
  niet beschikbaar; koppelen kan nu niet." Toezeggen werkt gewoon.
- **SAMEN.** Labfonds verwijst naar een studie-id en levert de financiering aan
  `/api/lab2/publiek/onderzoek`.

**Keten.** Een lid zegt toe aan een speelplek. Een ouder stelt een besteding
voor, het gezin stemt en de indiener sluit. Geld Command toont de toezegging als
"toegezegd, niet betaald".

**g. Betaalmuur** (fragment): Open Collective Pro heeft bank-sync en beheerde
fondsen (opencollective.com/ofico/updates/…); Snapshot-stemmen is gratis
(help.snapshot.box/…). Wij hebben toezeggen en stemmen gratis; de verantwoording
half.

---

## Familie 4 — Lifestyle (Mecenaat, Nalatenschap)

Beide zijn vandaag alleen voor de Lifestyle- en Business Pass ("Deze app is
onderdeel van de Lifestyle Pass.", `server/routes/member/rechterhand.js:20`).
Beide bewegen geen geld en geven geen advies.

### 4.1 Mecenaat (`/apps/geld.html#mecenaat`)

**a. Doel.** Weten wat je geeft, aan wat en waarom, en dat het klopt bij de
belastingaangifte zonder dat iemand je adviseert.

**b. Wat er is.**
- Routes: `/api/member/rechterhand/mecenaat`, `/gift`, `/gift/weg` en
  `/betaald`.
- Kern: `server/kern/rechterhand/mecenaat.js` (thema's, en een periode:
  eenmalig, maand, kwartaal of jaar).
- "Er beweegt geen geld; betaald is een aantekening van het lid."
- Voltooiscenario: `voltooi/mecenaat.js`.

**c. Objecten en eigenaar.** Het levensdossier-veld `mecenaat` is van de
rechterhand.

**e. Rechten.** Lifestyle en Business.

**Zes lagen, oordeel.**
- **L1** het bijhouden bestaat.
- **L4** de regel gift-bevestiging bestaat in geldbeleid.
- **L5** een jaaroverzicht ontbreekt.
- **L6** de Foundation-vlag bestaat; er gaat geen aanroep naar de Foundation.
- L2 en L3: niet van toepassing.

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Giften bijhouden en als betaald markeren | L1 | bestaat | Toegezegd, betaald en via de Foundation tellen apart; een gift zonder doel wordt geweigerd. | — | — |
| Jaaroverzicht van giften | L5 | ontbreekt | Het lid downloadt per jaar zijn giften per doel. Het overzicht draagt de klasse "uitlegbaar" en zegt dat aftrekbaarheid afhangt van de ANBI-status, die het lid zelf controleert. Every.org stuurt kwitanties gratis (fragment). | klein | nu |
| Een gift echt betalen | L6 | ontbreekt | — | — | **vraagt besluit**: dat raakt de doneerknop (`GIFT.md`) |
| Fiscale aftrek berekenen | — | ontbreekt | — | — | niet zelfstandig: het is fiscaal "advies", een mens beoordeelt |

**f. LOS en SAMEN.**
- **LOS.** Mecenaat werkt volledig los; het is een lijst van het lid.
- **SAMEN.** Geld Command telt de toezeggingen mee, en de regel
  "gift-bevestiging" vraagt het lid te bevestigen.

**g. Betaalmuur** (fragment): Every.org en de GoFundMe Giving Fund geven een
jaaroverzicht gratis (every.org/pricing, gofundme.com/c/pricing); Geef.nl: niet
gevonden. Wij hebben het bijhouden; het jaaroverzicht niet.

**j. Extern.** ANBI-gegevens zijn openbaar; RTG controleert ze niet
inhoudelijk en zegt dat.

### 4.2 Nalatenschap (`/apps/geld.html#nalatenschap`)

**a. Doel.** Rust voor later: weten dat je naasten vinden wat ze nodig hebben,
zonder dat iemand het nu kan lezen.

**b. Wat er is.**
- Routes: `/api/member/rechterhand/nalatenschap`, `/doc`, `/contact` en
  `/wens`, met hun `weg`-varianten.
- Kern: `server/kern/rechterhand/nalatenschap.js`, met AES-256-GCM op de
  gevoelige velden.
- Voltooiscenario: `voltooi/nalatenschap.js`. Dat bewijst dat de gevoelige
  velden versleuteld in de opslag staan en een crash overleven.

**c. Objecten en eigenaar.** Het levensdossier-veld `nalatenschap` (documenten,
contacten en wensen) is van de rechterhand.

**e. Rechten.**
- Lifestyle en Business; alleen het lid zelf.
- "Notaris" is een contactlabel; er is geen rol voor de notaris.

**Zes lagen, oordeel.**
- **L1** bewaren bestaat.
- **L2** de notaris als professional vraagt een genre en een besluit.
- **L5** de vrijgave aan nabestaanden ontbreekt (GELD.md fase 5).
- **L6** bewust geïsoleerd: de concierge ziet het niet.
- L3 en L4: niet van toepassing.

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Documenten, contacten en wensen versleuteld bewaren | L1 | bestaat | Wat gevoelig is, staat versleuteld in de opslag; alleen het lid ziet het na inloggen. | — | — |
| Vertrouwenspersoon met vrijgavevoorwaarde | L5 | ontbreekt | Het lid wijst iemand aan die pas na een vrijgavevoorwaarde iets ziet. Die voorwaarde is altijd een menselijke bevestiging, nooit alleen een timer. Elke inzage komt in een audit die het lid kan lezen. Google en Apple hebben dit gratis (fragment). | groot | later (GELD.md fase 5) |
| Versiegeschiedenis en inzage-audit | L5 | ontbreekt | Het lid ziet elke wijziging en elke inzage met datum. | middel | later |
| Notaris als professional | L2 | ontbreekt | — | — | **vraagt besluit**: een genre in de leveranciersapp (CIVILIS) |
| Een testament opstellen | — | ontbreekt | — | — | niet: juridisch "voorbehouden" |

**f. LOS en SAMEN.**
- **LOS.** Nalatenschap werkt volledig los. Met opzet geen SAMEN: "Besloten
  zaken (gezondheid, nalatenschap) komen hier niet binnen"
  (`server/routes/office/concierge.js:33`). Een keten komt er pas met een
  vrijgavevoorwaarde, en dan alleen naar de aangewezen mens.

**g. Betaalmuur** (fragment):
- Trust & Will: een membership voor de kluis (trustandwill.com/learn/trust-and-will-membership).
- Google Inactive Account Manager en Apple Legacy Contact: gratis
  (support.google.com/accounts/answer/3036546, support.apple.com/en-us/102631).
- Mijndigisafe (NL): een notariële kluis tegen betaling (id.nl/…).

Wij hebben de versleutelde kluis; de vrijgave aan nabestaanden niet.

---

## Voorstel aan de eigenaar, in drie bakken

Per functie één zin, de kosten en wat er al voor bestaat. Een functie wordt pas
werk na toezegging per familie.

### Aanbevolen nu

1. **Reis betalen vanaf het scherm, via de betaalwaarheid, met bijladen**
   (middel). Er is al `reisbureau-betaling.js`, en ook `stortwaarheid` en
   `dealbetaal` als voorbeeld. Daarbij horen de bezits- en paspoortpoort op
   `/api/reisbureau/betaal` (klein).
2. **De reis als verplichting en kasstroom in Geld** (middel). Bouwt op
   `geldgraaf/vooruitblik.js`.
3. **Paspoortpoort op direct betalen (tab Betalen) en op de bank, vóór live**
   (klein). Voorbeeld: `payGate`.
4. **De kascode tonen in Pay** (klein). `/api/pay/kascode` bestaat al.
5. **Zoeken, eigen categorieën en export van de geschiedenis** (middel). De
   bank heeft al `afschrift.csv`.
6. **Vermogensoverzicht** (middel): de posities bij RTG en de eigen opgave
   apart. Er is al `/api/pay/portefeuille`.
7. **Contracten en abonnementen**: koppelen en een signaal vóór de
   opzegdatum, plus prijsstijging (middel). Er zijn al `patronen.js` en
   `vastelasten`.
8. **Huishoudscenario's en kasstroomprognose** (middel). Er zijn al
   `vooruitblik.js` en `fiscaal/scenario.js`.
9. **Verplichtingenkalender**, met verwijzingen naar de app-eigenaar (middel).
   Ontvangt van reis, assets en wonen.
10. **Aflosplan als rekensom** (middel). Bestaat nog nergens.
11. **Verloopsignaal in Wallet** (klein).
12. **WBW-export en een sleutel op het verzoek** (klein).
13. **Labfonds-verantwoording per pot** (klein).
14. **Jaaroverzicht van giften in Mecenaat**, als "uitlegbaar" (klein).

### Later

- Een gezamenlijke pot, rekening of budget voor een huishouden (groot).
- Afrondsparen (middel).
- Bonregels splitsen en valuta in WBW (middel).
- Besluitvergelijking en langetermijnplanning zonder rendement (middel).
- Meerdere rekeningen bij de bank (klein, na live).
- Passen uit andere apps in Wallet (middel).
- Een offline RTG Code (middel).
- Een trend in Balans en financieel welzijn (klein en middel).
- In Nalatenschap: een vertrouwenspersoon met vrijgavevoorwaarde, versies en
  audit (groot).
- Automatisch de groep herkennen in WBW (later, eerst toestemming).

### Niet doen, en waarom

- **Krediet en lening in de bank.** GELD.md par. 7, en een vergunning is
  nodig. Het bestaat al in `kern/bank/krediet.js`: **besluit gevraagd** of dat
  blijft.
- **AI-"advies" in de bank als advies.** Herschrijven naar uitleg met de
  fiscale klasse.
- **Verzekering en dekking** (aankoop, annulering, reis).
- **Lounges en partnerabonnementen.** Verdienmodellen, geen functies.
- **Rendement, Monte Carlo of beleggingsanalyse in de planning.** Dat is
  beleggingsadvies.
- **Een testament opstellen of fiscale aftrek vaststellen.** Juridisch of
  fiscaal "voorbehouden" of "advies".
- **Eigen kaarten uitgeven.** Dat vraagt een bankpartner.
- **Een bankkoppeling met andere banken.** Pas met een AISP-partner (extern);
  tot dan alleen RTG-bronnen en de eigen opgave.

### Besluiten gevraagd

1. Een reis: een pasfunctie of "minimaal een account"? (0.5)
2. Geld Command en WBW weigeren elk gratis account (`geenGast`). Vallen ze
   onder "minimaal een account"?
3. Krediet en AI-advies in `kern/bank`: blijven ze, en zo ja onder welke
   vergunning?
4. Woonlasten: komt er een verplichtingenobject van Geld waar Wonen naar
   verwijst?
5. Mecenaat: een gift echt betalen (`GIFT.md`)? Labfonds: een toezegging echt
   innen?
6. Nalatenschap: een genre "notaris" onder CIVILIS?
