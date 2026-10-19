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

*De overige families volgen.*
