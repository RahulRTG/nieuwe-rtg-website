# De bundeldelen

**Dit bestand wordt voortgebracht door `node scripts/deelindex.js`.** Wijzig het
niet met de hand; wijzig de onderwerpregel bovenin het deel zelf.

Vijftig bundels in `public/` worden aan de browser geserveerd als één bestand en
bewerkt als losse delen. `test/bundeldelen.test.js` bewaakt dat die twee niet
uiteenlopen; deze index zegt waar je moet zijn. Een deel zonder onderwerp staat
er als een liggend streepje; de meter `delenZonderOnderwerp` in `NORM.json` telt ze en mag alleen
omlaag.

**51 bundels, 403 delen, 0 zonder onderwerp.**

## `apps/app-main.js`

`public/apps/app-main/` -- 84 delen, 8886 regels in de delen

| deel | onderwerp |
|---|---|
| `app-main-01.js` | de bouwstempel: HTML en script moeten van dezelfde bouw zijn |
| `app-main-02.js` | de API-laag van de app: elke aanroep met token, taal en foutafhandeling |
| `app-main-02a.js` | de demomelding: een demo is een toestand, geen terugval na een storing |
| `app-main-02b.js` | pas-thema (kleuren van de website) |
| `app-main-03.js` | de stem van de pas: welke koppen en teksten bij RTG, Lifestyle of Business horen |
| `app-main-04.js` | inloggen en de staat binnenhalen: token, pas en het eerste scherm |
| `app-main-04a.js` | Vervolg van app-main-04: de compositieregels van de poort (een kolom: klok, lippen, aanspreking, veld) |
| `app-main-04aa.js` | De koekjesmelding hoort niet midden in de kennismaking |
| `app-main-04ab.js` | Slotstuk van de poortstijl: de brede-schermregels, en daarna pas het insluiten van het blad |
| `app-main-04b.js` | Vervolg van app-main-04: de poort-inhoud (mond, zin, invoerveld, passkey) en het gesprek erachter |
| `app-main-05.js` | een zin, geen logboek: Rahuls woorden vervangen elkaar rustig |
| `app-main-06.js` | het gesprek met Rahul: versturen, wachten en het antwoord tonen |
| `app-main-07.js` | het contactenblok op het beginscherm, met de lege staat |
| `app-main-08.js` | de onboarding: het paspoort scannen of een bestand kiezen |
| `app-main-09.js` | de storyrij bovenaan De Salon |
| `app-main-09a.js` | de contactpin: je eigen code, als tekst en als QR |
| `app-main-09a2.js` | de levende code en de aan/uit-schakelaar |
| `app-main-09b.js` | de directe berichten openen |
| `app-main-10.js` | de directe berichten: versturen en aan het gesprek toevoegen |
| `app-main-11.js` | het videogesprek: aanbod, antwoord en de verbinding |
| `app-main-12.js` | de meldingenlijst en het ongelezen-merk |
| `app-main-12a.js` | De opbouw van het beginscherm: het vangnet, de melding als er iets leeg blijft, en de volgorde eerst-beeld-dan-gegevens |
| `app-main-12b.js` | De tickets van het lid: het aanbod en wat hij al heeft |
| `app-main-13.js` | het ticketkanaal: partners, activiteiten en hun tijden |
| `app-main-14.js` | het zorgaanbod: klinieken, behandelingen en het medische onderscheid |
| `app-main-14a.js` | verzorging: de kapper, de barbier en de nagelstudio |
| `app-main-14b.js` | de zorgpakketten: wat er loopt en wat er te kiezen valt |
| `app-main-15.js` | de knoppen onder een zorgpakket: betalen en openen |
| `app-main-16.js` | het voertuigkanaal: partners en hun auto's |
| `app-main-17.js` | het chauffeurskanaal: vaste prijzen per partner |
| `app-main-18.js` | een bezichtiging aanvragen bij een vastgoedpartner |
| `app-main-19.js` | een auto kopen of inruilen, met een bod |
| `app-main-20.js` | de bazaar van een partner: producten en bestellen |
| `app-main-21.js` | mijn bestellingen: betalen en volgen |
| `app-main-22.js` | het boekingsblad: de diensten van een partner kiezen |
| `app-main-23.js` | de lopende rekening bij een partner opvragen |
| `app-main-24.js` | Veiligheid en verbinding |
| `app-main-24a2.js` | Afgesplitst van app-main-24.js, dat over de 10 KB ging |
| `app-main-24b.js` | Afgesplitst van app-main-24.js, dat over de 10 KB ging toen "Mijn loon" erbij kwam |
| `app-main-25.js` | de algemene pin: zetten of vragen |
| `app-main-25b.js` | Mappen, gebruik en het bouwen van de tegels |
| `app-main-26.js` | de taakbalk: welke knop welk tabblad opent |
| `app-main-26b.js` | Rahuls signatuurmond in de balk onderaan het beginscherm |
| `app-main-27.js` | een map hernoemen op het springboard |
| `app-main-27b.js` | Afgesplitst van app-main-27.js, dat over de 10 KB ging |
| `app-main-28.js` | het springboard verslepen, met vinger en met muis |
| `app-main-29.js` | de realtime-verbinding starten en herstellen |
| `app-main-29b.js` | het gesprek met Rahul op het beginscherm |
| `app-main-29c.js` | de werelden aanreiken aan de bank van RTG Command |
| `app-main-30.js` | de app-regie van de boardroom: uitgezette apps verdwijnen van het springboard |
| `app-main-31.js` | Achtergrond (wallpaper) in het bedieningspaneel |
| `app-main-31c.js` | Onderweg: de live reis |
| `app-main-32.js` | het live-paneel: van modus wisselen |
| `app-main-33.js` | een asset herroepen binnen de bedenktijd |
| `app-main-34.js` | mijn zorgprofiel |
| `app-main-35.js` | betalen met Face ID vanuit een rekeningregel |
| `app-main-36.js` | een verblijf tonen: foto's en kamers |
| `app-main-37.js` | de deur van kamer of entree openen, en een kamer boeken |
| `app-main-38.js` | de artikelen van een partner, met drops die nog niet los zijn |
| `app-main-39.js` | de cv-kaart: klaar of nog niet |
| `app-main-40.js` | een chatbericht opmaken, met vertaling voor de ander |
| `app-main-41.js` | sparren met Rahul, en de geparkeerde gedachten |
| `app-main-42.js` | de verzoeken van partners om een niveau: u beslist |
| `app-main-43.js` | de betaalgeschiedenis van de gratis gebruiker |
| `app-main-44.js` | het gezinsblok: chatten en bellen met het gezin |
| `app-main-45.js` | pushmeldingen aanzetten en de sleutel omzetten |
| `app-main-46.js` | de details van een verzending |
| `app-main-47.js` | de zakelijke specificatie op een factuur |
| `app-main-48.js` | alles in een keer betalen |
| `app-main-49.js` | het boekland van een zakelijk lid |
| `app-main-50.js` | de antwoorden van Rahul op een bevestiging of een paklijst |
| `app-main-51.js` | een betaalpartner kiezen |
| `app-main-52.js` | het zakelijke blad: feed en lijsten |
| `app-main-52b.js` | de reactieteller onder een bericht |
| `app-main-53.js` | de ballon op de boardroom-knop |
| `app-main-53b.js` | De Vooruit-kaart: uw termijnen, voor elke pas |
| `app-main-53c.js` | De post-voorstellen: datums die zichzelf aandienen |
| `app-main-54.js` | de Toestelkluis: eigen kopieen op het eigen toestel |
| `app-main-55.js` | het thema van de vaste pas |
| `app-main-56.js` | het zegel: aftellen en sluiten |
| `app-main-57.js` | de zakelijke lade voor Business en Lifestyle |
| `app-main-58.js` | de knoppen onder een Salon-bericht |
| `app-main-59.js` | de afspraken en hun status |
| `app-main-60.js` | van taal wisselen: alles opnieuw ophalen |

## `apps/backoffice.js`

`public/apps/backoffice/` -- 6 delen, 670 regels in de delen

| deel | onderwerp |
|---|---|
| `backoffice-01.js` | de backoffice: de basis (helpers, taal, elementen) |
| `backoffice-01b.js` | backoffice, vervolg van deel 01 |
| `backoffice-01c.js` | backoffice, vervolg van deel 01b: DE VAKBEWIJZEN |
| `backoffice-02.js` | paspoort-incidenten: RTG beoordeelt of een opgeeiste identiteit vrijkomt |
| `backoffice-03.js` | Live meekijken bij een SOS: het lid stuurt een WebRTC-aanbod via de office- stream ('ontmoeting-signaal'); wij openen... |
| `backoffice-04.js` | De tijdlijn is schaalvast: de server bladert en zoekt door de volledige historie; het scherm toont altijd 25 regels p... |

## `apps/boardroom.js`

`public/apps/boardroom/` -- 2 delen, 290 regels in de delen

| deel | onderwerp |
|---|---|
| `boardroom-01.js` | De boardroom van het lid: haalt het schakelbord op (/api/member/boardroom) en laat elke functie aan/uitzetten |
| `boardroom-02.js` | Onderaan: wanneer dit bord voor het laatst veranderde |

## `apps/command.js`

`public/apps/command/` -- 16 delen, 2109 regels in de delen

| deel | onderwerp |
|---|---|
| `command-01.js` | RTG Command, deel 1: de schil |
| `command-02.js` | RTG Command, deel 2: het Command Center en de werkplek |
| `command-03.js` | RTG Command, deel 3: de zoekbalk over alles, en het objectdossier |
| `command-04.js` | RTG Command, deel 4: de operator en de uitzonderingenrij |
| `command-05.js` | RTG Command, deel 5: het herstel -- de runbooks, de rondes en de terugzetknop |
| `command-06.js` | RTG Command, deel 6: het beleid en de simulatie |
| `command-07.js` | RTG Command, deel 7: het toezicht -- agents en tijdelijke rechten |
| `command-08.js` | RTG Command, deel 8: de werkbesparing en het journaal -- de twee spiegels |
| `command-09.js` | RTG Command, deel 9: de gegevenskwaliteit en de kennisgraaf |
| `command-10.js` | RTG Command, deel 10: de servicedoelen met hun foutbudget, en de sonde |
| `command-11.js` | RTG Command, deel 11: de herkomst -- waar komt een gegeven vandaan en wie hangt ervan af |
| `command-12.js` | RTG Command, deel 12: de uitrol (canary) en de zandbak |
| `command-13.js` | RTG Command, deel 13: master data |
| `command-14.js` | RTG Command, deel 14: de overname |
| `command-15.js` | RTG Command, deel 15: koppelingen en landen |
| `command-16.js` | RTG Command, deel 16: de steden en het alarm |

## `apps/defensie.js`

`public/apps/defensie/` -- 2 delen, 176 regels in de delen

| deel | onderwerp |
|---|---|
| `defensie-01.js` | RTG Defensie: het commando- en logistiekscherm |
| `defensie-02.js` | het overzicht laden en de stand bijhouden |

## `apps/foundation/gezin-rt.js`

`public/apps/foundation/gezin-rt/` -- 2 delen, 169 regels in de delen

| deel | onderwerp |
|---|---|
| `gezin-rt-01.js` | GezinRT: chatten en (beeld)bellen tussen gezinsleden, in de app |
| `gezin-rt-02.js` | WebRTC bellen |

## `apps/foundation/samen.js`

`public/apps/foundation/samen/` -- 2 delen, 180 regels in de delen

| deel | onderwerp |
|---|---|
| `samen-01.js` | Samen voor de gezinsapps: een rustige meekijk-laag voor gezin en bevestigde vrienden |
| `samen-02.js` | Rahul voor het gezin: de kindveilige vraagbaak op elke RTF-pagina |

## `apps/foundation/sessie.js`

`public/apps/foundation/sessie/` -- 3 delen, 242 regels in de delen

| deel | onderwerp |
|---|---|
| `sessie-00.js` | Sessie: het gezin-account en het gekozen profiel, net als bij een streamingdienst |
| `sessie-01.js` | de sessie van de hulppas: lezen, actief en bewaren |
| `sessie-02.js` | de ongelezen-teller |

## `apps/leverancier.js`

`public/apps/leverancier/` -- 110 delen, 9082 regels in de delen

| deel | onderwerp |
|---|---|
| `leverancier-01.js` | de leverancier-app: de basis (helpers, taal, elementen) |
| `leverancier-01b.js` | de partnercatalogus: welke zaken er in de demo bestaan |
| `leverancier-02.js` | de sector van een zaak bepalen |
| `leverancier-03.js` | de sectorwissel en de tabbladen per sector |
| `leverancier-03b.js` | de sectoriconen |
| `leverancier-04.js` | het chatvenster met een partner |
| `leverancier-05.js` | aanmelden als medewerker bij een zaak |
| `leverancier-06.js` | de personeelskiezer: wie ben jij |
| `leverancier-07.js` | een account voor alles: partner kiezen en de staat toepassen |
| `leverancier-08.js` | de bonnenstatistiek van de kassa |
| `leverancier-09.js` | de looplijst per station, op tijd gesorteerd |
| `leverancier-10.js` | de bedieningspas: wat kan er nu gelopen worden, en waarheen |
| `leverancier-10b.js` | de rittenkaart van een chauffeur |
| `leverancier-10c.js` | de straks-taken en de mise-en-place van vandaag |
| `leverancier-11.js` | de keukenhulp: live advies van het model of de regelcoach |
| `leverancier-12.js` | de tafelstatus en het inchecken van gasten |
| `leverancier-12a.js` | de btw-aangifte van de zaak (server: kern/fiscaal/btwaangifte.js) |
| `leverancier-12a1.js` | de btw-aangifte, deel 2: HET DETAIL van een aangifte |
| `leverancier-12b.js` | het vakwerk-dashboard (dienstverlenende genres): vandaag-bord, aanvragen, KPI's en AI |
| `leverancier-13.js` | de secties van een taxi- of jetzaak |
| `leverancier-14.js` | de eigen backoffice van de zaak |
| `leverancier-14b.js` | de aandelen in een deal, en wie akkoord is |
| `leverancier-15.js` | de boekhouding van de zaak: btw, personeelskosten en cadeaukaarten |
| `leverancier-15c.js` | het thuiskantoor: de zaak als host op RTG Thuis |
| `leverancier-15d.js` | Een gezette handtekening terugtekenen: de paden staan in verhoudingen (0 tot 1), dus hij past op elk formaat |
| `leverancier-16.js` | het AI-weekrooster: een voorstel op de verwachte drukte |
| `leverancier-16z.js` | hr-plus: inwerken, groeigesprekken, certificaten en dienstjaren |
| `leverancier-17.js` | de menukaart per station (keuken of bar) |
| `leverancier-18.js` | de events van de zaak |
| `leverancier-19.js` | de minibar-catalogus |
| `leverancier-20.js` | het tarief van de zaak |
| `leverancier-20b.js` | Vakwerk Pro op het vandaag-bord: de functies waar vakbedrijven elders per maand voor betalen -- offertes, werkbonnen,... |
| `leverancier-20c.js` | Vakwerk Pro, tweede laag: vaste afspraken, wachtlijst, beoordelingen en de team-capaciteit -- ook dit elders betaalde... |
| `leverancier-21.js` | een prijs doorgeven aan RTG |
| `leverancier-22.js` | de instellingen van de zaak opslaan |
| `leverancier-22a.js` | schakelaars van de zaak: elke functie aan of uit, direct doorgevoerd |
| `leverancier-22b.js` | binds van het THUIS-KANTOOR (sectie 'thuis' in het Kantoor) |
| `leverancier-22c.js` | binds van de WERKVLOER (sectie 'werkvloer' in het Kantoor) |
| `leverancier-23.js` | een medewerker uitnodigen |
| `leverancier-24.js` | een reactie toevoegen aan een kaartrij |
| `leverancier-24b.js` | Vakwerk Pro: offertes beantwoorden, werkbonnen schrijven, klantnotities bewaren en onderhoudsherinneringen sturen (al... |
| `leverancier-25.js` | vakwerk: werkdagen aan/uit tikken (lokaal, tot Opslaan) |
| `leverancier-26.js` | de weekbeschikbaarheid per dag |
| `leverancier-27.js` | de weekbeschikbaarheid opslaan |
| `leverancier-28.js` | de panden van een vastgoedzaak |
| `leverancier-29.js` | het aanmeldformulier aanpassen in gewone taal |
| `leverancier-30.js` | de boerderijkaart: dier of gewas, met zijn cijfers |
| `leverancier-31.js` | Verkoop: producten (oogst vult de voorraad) en verkopen via de Salon |
| `leverancier-32.js` | de boerderij-AI: een vraag over het bedrijf |
| `leverancier-33.js` | portfolio en trajecten van een creator |
| `leverancier-34.js` | creator: leveranciers vinden en open oproepen |
| `leverancier-35.js` | de AI-factuurtool |
| `leverancier-36.js` | iets op de marktplaats plaatsen |
| `leverancier-37.js` | de collecties van een retailzaak |
| `leverancier-38.js` | clienteling: het klantdossier van een retailzaak |
| `leverancier-39.js` | een artikel bewaren in de retailcatalogus |
| `leverancier-40.js` | incident melden |
| `leverancier-41.js` | de functies van een groothandel aan- en uitzetten |
| `leverancier-42.js` | de inkoop-AI: wat is er nodig bij deze groothandel |
| `leverancier-43.js` | een verkoopaanvraag aanvaarden of een tegenbod doen |
| `leverancier-44.js` | de statusknoppen van een vrachtzending |
| `leverancier-45.js` | een melding in het vrachtlogboek |
| `leverancier-46.js` | het gebouwbeheer: de knoppen en hun acties |
| `leverancier-47.js` | de golfbaan: status en de winkel |
| `leverancier-48.js` | de kengetallen van een beautysalon |
| `leverancier-49.js` | petcare: de acties op een verblijf |
| `leverancier-50.js` | de kengetallen van een jachthaven |
| `leverancier-51.js` | de kengetallen van een weddingplanner |
| `leverancier-52.js` | de polis van een verzekeringszaak |
| `leverancier-53.js` | de skischool: groepslessen en de rest |
| `leverancier-54.js` | de pas-controle: alleen actief, pakket en codenaam |
| `leverancier-55.js` | de HR-cijfers op het zaakbord |
| `leverancier-55b.js` | Werkbeleid: wat staat er dicht op de passen van uw mensen? |
| `leverancier-55c.js` | "Vooruit": wat er op de zaak afkomt |
| `leverancier-55d.js` | De post-voorstellen van de zaak: datums die zichzelf aandienen |
| `leverancier-56.js` | een cel op het zaakbord, en de samenvatting van schakelaars |
| `leverancier-57.js` | de incidenten op het beveiligingsbord |
| `leverancier-58.js` | alles opnieuw tekenen, en het actieve tabblad zichtbaar maken |
| `leverancier-59.js` | een bestelkaart opbouwen |
| `leverancier-60.js` | een tafel afrekenen |
| `leverancier-61.js` | Een gerecht met ingrediënten, dieetlabels en keuzes aan de menukaart toevoegen |
| `leverancier-61a.js` | Menukaart, dynamische prijzen, locatie en de sectorgebonden kassa |
| `leverancier-62.js` | de shift-samenvatting: het avondbriefingmoment |
| `leverancier-63.js` | afrekenen, of op de kamer laten schrijven |
| `leverancier-64.js` | de bon van de kassa naar een bestelling |
| `leverancier-65.js` | een activiteit toevoegen of verwijderen |
| `leverancier-66.js` | de vloot van een voertuigzaak |
| `leverancier-67.js` | lopende en geboekte charters |
| `leverancier-68.js` | een boot toevoegen of verwijderen |
| `leverancier-69.js` | de receptie van vandaag |
| `leverancier-70.js` | de kamerkalender |
| `leverancier-71.js` | een bericht van de zaak verder plaatsen |
| `leverancier-72.js` | de minibar tellen, per kamer |
| `leverancier-73.js` | een uitgiftebundel openen |
| `leverancier-74.js` | een gastlocatie stoppen |
| `leverancier-74b.js` | Afgesplitst van leverancier-74.js, dat over de 10 KB ging toen de drie berichtenlijsten er een werden |
| `leverancier-75.js` | De Salon is verplicht: de profielkaart met compleetheidsmeter |
| `leverancier-76.js` | een foto uploaden bij de zaak |
| `leverancier-77.js` | de paskamerverzoeken van een retailzaak |
| `leverancier-78.js` | de stijl van het zegelvenster |
| `leverancier-79.js` | de aanwezigheidsteller op nul zetten |
| `leverancier-80.js` | de AI-draad van de zaak |
| `leverancier-80a.js` | Talent Exchange: alleen anonieme, expliciete interesse |
| `leverancier-81.js` | het cv van een sollicitant die via RTG kwam |
| `leverancier-82.js` | het alarmvenster |
| `leverancier-83.js` | de recepten en hun marges |
| `leverancier-84.js` | de meldingenlijst van de zaak |
| `leverancier-84a.js` | RTG Eten: gedeelde toestand en de rolgerichte orderkaart |
| `leverancier-84b.js` | Opbouw en bediening van het werkblad; de kaart zelf staat in 84a |
| `leverancier-84c.js` | Live synchronisatie, meldingen en het opstarten van het partnerwerkblad |

## `apps/meldkamer.js`

`public/apps/meldkamer/` -- 4 delen, 480 regels in de delen

| deel | onderwerp |
|---|---|
| `meldkamer-01.js` | RTG Meldkamer: het werkscherm van de zes hulpdienst-korpsen |
| `meldkamer-02.js` | doorverwijzen naar een andere dienst |
| `meldkamer-03.js` | het ketengesprek |
| `meldkamer-04.js` | het gezamenlijke rampbeeld |

## `apps/notities/app.js`

`public/apps/notities/app/` -- 2 delen, 208 regels in de delen

| deel | onderwerp |
|---|---|
| `app-01.js` | RTG Notities & Taken, het scherm: het bord (vastgepind eerst), de editor voor notities en lijsten, vinkjes die meteen... |
| `app-02.js` | de editor |

## `apps/office/app.js`

`public/apps/office/app/` -- 8 delen, 899 regels in de delen

| deel | onderwerp |
|---|---|
| `app-01.js` | RTG Office, de app zelf: de drive en de schil om de drie editors heen |
| `app-01b.js` | de drive |
| `app-02.js` | openen |
| `app-02a.js` | tekstdocument |
| `app-02a2.js` | menselijke documentwerkstroom |
| `app-02b.js` | delen |
| `app-02c.js` | live samenwerking en documentbeleid |
| `app-03.js` | Rahul leest mee |

## `apps/office/blad.js`

`public/apps/office/blad/` -- 2 delen, 262 regels in de delen

| deel | onderwerp |
|---|---|
| `blad-01.js` | RTG Office, het rekenblad: het raster en wat je ziet |
| `blad-02.js` | de actieve cel: invoer, selectie en het blad |

## `apps/personeel.js`

`public/apps/personeel/` -- 31 delen, 3056 regels in de delen

| deel | onderwerp |
|---|---|
| `personeel-01.js` | de personeelsapp: de basis (helpers, taal, elementen) |
| `personeel-02.js` | de gebeurtenissen van vandaag: valet, jetset en bevestigingen |
| `personeel-03.js` | de pas-controle |
| `personeel-03a.js` | De vaste-PDA-ingang kent niet alleen de geseede demonstratiezaken |
| `personeel-03b.js` | Personeel, deel 3b: het oude inlogFORMULIER, nog als vangnet |
| `personeel-04.js` | Land (of wissel) naar een van de eigen werkplekken: sessie zetten en de app openen |
| `personeel-05.js` | aanmelden met de kassacode |
| `personeel-05a.js` | de dienstkeuze en de sectorstap |
| `personeel-06.js` | de borden van dit personeelslid |
| `personeel-06a.js` | de voorspeller op de PDA: het team ziet de piek van morgen aankomen |
| `personeel-07.js` | in- en uitklokken |
| `personeel-08.js` | gevonden voorwerpen melden |
| `personeel-09.js` | de gereedschappen op een bord tekenen |
| `personeel-10.js` | de dorpschat, en de leeftijdscheck die ja of nee zegt en nooit gegevens |
| `personeel-11.js` | de minibar boeken vanaf de kamer |
| `personeel-12.js` | een teamtip plaatsen |
| `personeel-13.js` | Fluister: de persoonlijke assistent, nooit gedeeld met de werkgever |
| `personeel-14.js` | de flitszoeker |
| `personeel-15.js` | de afstand tot een opdracht, uit GPS |
| `personeel-15b.js` | -- de handlers van de bezorg-tab: inpakken, pakken, vertrekken, nemen -- |
| `personeel-15c.js` | DE WERKVLOER op de PDA: de telefoonkant van de koppellaag |
| `personeel-16.js` | de bezorg-AI: advies bij een rit |
| `personeel-17.js` | de pas: wat er klaarstaat en wat er nog loopt |
| `personeel-18.js` | van kant wisselen op het keukenbord |
| `personeel-19.js` | apart gelegd: de klant erbij pakken |
| `personeel-20.js` | de percelen en het oogsten |
| `personeel-21.js` | een verkoopslot kiezen |
| `personeel-22.js` | de deals: koop of huur |
| `personeel-23.js` | het team van vandaag |
| `personeel-24.js` | het alarm: trillen en tonen |
| `personeel-25.js` | de ketenchat tussen zaken |

## `apps/residentie.js`

`public/apps/residentie/` -- 16 delen, 2027 regels in de delen

| deel | onderwerp |
|---|---|
| `residentie-01.js` | De Residence, deel 1: de staat, de isometrie en de zaal zelf (vloer, muren, sfeer) |
| `residentie-02.js` | deel 2: de meubels van RTG Maison en de gasten |
| `residentie-02b.js` | deel 2b: RTG Maison deluxe en de activiteiten |
| `residentie-02c.js` | deel 2c: het bal, de biljartkamer en de sterrenwacht |
| `residentie-03.js` | deel 3: de tekenlus, het netwerk en het gesprek |
| `residentie-03b.js` | deel 3b: samen spelen |
| `residentie-03c.js` | deel 3c: de vragen van het huis en de huistelefoon |
| `residentie-03d.js` | deel 3d: samen wandelen (het paar) |
| `residentie-03e.js` | deel 3e: de wereld speelt mee |
| `residentie-03f.js` | deel 3f: de speelschermen |
| `residentie-03g.js` | deel 3g: de baanscenes |
| `residentie-03h.js` | deel 3h: de zaalscenes |
| `residentie-03i.js` | deel 3i: de vloerscenes |
| `residentie-03j.js` | deel 3j: de renbaan-scene |
| `residentie-03k.js` | deel 3k: de spellenkast |
| `residentie-04.js` | deel 4: de gids, het suite-atelier en de start |

## `apps/rtg-protect.js`

`public/apps/rtg-protect/` -- 2 delen, 260 regels in de delen

| deel | onderwerp |
|---|---|
| `rtg-protect-01.js` | RTG contentbescherming: de DRM-route (Encrypted Media Extensions) plus de visuele guard uit rtg-protect.css |
| `rtg-protect-02.js` | het beveiligd-merk op het scherm |

## `apps/rtgschool/leer.js`

`public/apps/rtgschool/leer/` -- 2 delen, 227 regels in de delen

| deel | onderwerp |
|---|---|
| `leer-01.js` | RTG School (leden), deel 1: het leerpaspoort op de officiële ladder, de leerlijn per groep of fase, de les in gewone... |
| `leer-02.js` | de leerlijn: vakken en doelen, met wat je al behaald hebt |

## `apps/schoolpartner/app.js`

`public/apps/schoolpartner/app/` -- 2 delen, 220 regels in de delen

| deel | onderwerp |
|---|---|
| `app-01.js` | RTG School Partner, het scherm: een werkbank voor directie en lerarenteam op de bestaande school-API's |
| `app-02.js` | leraar |

## `apps/techniek.js`

`public/apps/techniek/` -- 9 delen, 882 regels in de delen

| deel | onderwerp |
|---|---|
| `techniek-01.js` | de techniekpagina: de basis |
| `techniek-01a.js` | eigenaarschap overdragen, en de modernisering door de AI |
| `techniek-02.js` | de virusscanner beproeven met een EICAR-bestand |
| `techniek-02a-betalingen.js` | BETAALREGIE. IT begeleidt en beproeft; alleen de eigenaar kiest en zet |
| `techniek-02b.js` | DE CONTROLEKAMER -- afgesplitst uit techniek-02.js |
| `techniek-03.js` | een functie globaal aan- of uitzetten |
| `techniek-03a.js` | het doelgroepfilter met chips, en het zoeken erin |
| `techniek-03c.js` | de automatische noodrem aan- of uitzetten |
| `techniek-04.js` | De laatste stand van het statusbord, zodat "meenemen" uit het EIGEN model leest en niet uit de kaartjes op het scherm |

## `apps/werkplek-bureaus.js`

`public/apps/werkplek-bureaus/` -- 2 delen, 223 regels in de delen

| deel | onderwerp |
|---|---|
| `werkplek-bureaus-01.js` | De ontwerptak van een huis: het atelier, de ontwerpstudio, het hardwarelab, het architectenbureau, de redactie en de... |
| `werkplek-bureaus-02.js` | De plank van dit huis: wat er nu echt in de verkoop staat |

## `shared/appmenu.js`

`public/shared/appmenu/` -- 6 delen, 635 regels in de delen

| deel | onderwerp |
|---|---|
| `appmenu-01.js` | HET APP-MENU: één hamburger, in de apps |
| `appmenu-02.js` | de stijl van het bedieningspaneel |
| `appmenu-03.js` | de eigen functies |
| `appmenu-04.js` | de vaste functies |
| `appmenu-05.js` | het blad dat van onderen opkomt |
| `appmenu-06.js` | de knop: de hamburger staat links, en verder niets |

## `shared/basis.js`

`public/shared/basis/` -- 4 delen, 545 regels in de delen

| deel | onderwerp |
|---|---|
| `basis-01.js` | De gedeelde basis-laag: het vangnet dat elke app-pagina op 9+-niveau houdt |
| `basis-01b.js` | Vervolg van basis-01 (op de 10 kB-grens geknipt na de thema-toevoeging van de consolidatieronde; de bundelvolgorde is... |
| `basis-01c.js` | de toegankelijkheidshelpers van de gedeelde laag |
| `basis-02.js` | 5. het lopende werk: de gangreserve-laag van het huis |

## `shared/bediening.js`

`public/shared/bediening/` -- 2 delen, 202 regels in de delen

| deel | onderwerp |
|---|---|
| `bediening-01.js` | HET BEDIENINGSPANEEL -- één plek voor de instellingen van dit scherm |
| `bediening-02.js` | Deel 2 van het bedieningspaneel: de rijen, het blad en de ingang |

## `shared/borden.js`

`public/shared/borden/` -- 2 delen, 169 regels in de delen

| deel | onderwerp |
|---|---|
| `borden-01.js` | Het werkbord (Trello-stijl), als gedeelde module voor alle RTG-apps: de leverancier-app, de PDA en de Business Pass g... |
| `borden-02.js` | de knoppen op een bord binden |

## `shared/bureaupda.js`

`public/shared/bureaupda/` -- 2 delen, 268 regels in de delen

| deel | onderwerp |
|---|---|
| `bureaupda-01.js` | DE BUREAU-PDA -- één scherm voor de drie ontwerpbureaus van de kantoren |
| `bureaupda-02.js` | De bureau-PDA, deel 2: de werking |

## `shared/clipdeler.js`

`public/shared/clipdeler/` -- 2 delen, 218 regels in de delen

| deel | onderwerp |
|---|---|
| `clipdeler-01.js` | DE CLIPDELER -- korte video's die het toestel van de maker nooit verlaten |
| `clipdeler-02.js` | de ontvangende kant van een gedeelde clip |

## `shared/deelmenu.js`

`public/shared/deelmenu/` -- 3 delen, 358 regels in de delen

| deel | onderwerp |
|---|---|
| `deelmenu-01.js` | Het deelmenu: een app-pagina met veel delen wordt een menu met EEN deel tegelijk, zoals een echt werksysteem -- in pl... |
| `deelmenu-02.js` | Het menu van DEZE ronde: de balk op het scherm plus de API die window.RTGDeel uitdeelt |
| `deelmenu-03.js` | DEEL 3: het menu in leven houden |

## `shared/drie.js`

`public/shared/drie/` -- 2 delen, 256 regels in de delen

| deel | onderwerp |
|---|---|
| `drie-01.js` | Drie: de kleine, huiseigen 3D-laag van RTG |
| `drie-02.js` | de buffers van een mesh naar de GPU |

## `shared/geluid.js`

`public/shared/geluid/` -- 2 delen, 212 regels in de delen

| deel | onderwerp |
|---|---|
| `geluid-01.js` | RTG Geluid: de altijd-aanwezige geluidsmotor van het huis |
| `geluid-02.js` | audio-focus: wijken voor een ander geluid |

## `shared/glyf.js`

`public/shared/glyf/` -- 3 delen, 206 regels in de delen

| deel | onderwerp |
|---|---|
| `glyf-01.js` | RTG Glyfen: één gedeelde, ingetogen lijn-iconenset in huisstijl - de plek van de vroegere emoji op de app-tegels |
| `glyf-02.js` | elk glyf op een 24x24-raster; alleen paden/vormen, de <svg>-jas komt hieronder |
| `glyf-03.js` | De <svg>-jas als string (voor code die HTML samenstelt i.p.v |

## `shared/handenvrij-balk.js`

`public/shared/handenvrij-balk/` -- 3 delen, 315 regels in de delen

| deel | onderwerp |
|---|---|
| `handenvrij-balk-01.js` | Muisvrij bedienen, deel 2: de balk |
| `handenvrij-balk-01b.js` | Muisvrij bedienen, deel 2a: WAAR DE BALK VAN GEMAAKT IS |
| `handenvrij-balk-02.js` | Alles wat geen navigatie is, gaat hiernaartoe: onveranderd naar Rahul, met de eigen inlog |

## `shared/handenvrij-bureau.js`

`public/shared/handenvrij-bureau/` -- 2 delen, 256 regels in de delen

| deel | onderwerp |
|---|---|
| `handenvrij-bureau-01.js` | Muisvrij bedienen, deel 7: het bureaublad |
| `handenvrij-bureau-02.js` | de maat-greep rechtsonder in het gesprek |

## `shared/handenvrij-scherm.js`

`public/shared/handenvrij-scherm/` -- 2 delen, 201 regels in de delen

| deel | onderwerp |
|---|---|
| `handenvrij-scherm-01.js` | Muisvrij bedienen, deel 5: het scherm van Rahul zelf |
| `handenvrij-scherm-02.js` | iets anders staat op vol scherm |

## `shared/i18n.js`

`public/shared/i18n/` -- 4 delen, 703 regels in de delen

| deel | onderwerp |
|---|---|
| `i18n-00.js` | Automatische UI-vertaling voor de volledige RTG-schermfamilie |
| `i18n-01.js` | RTG i18n, taalkeuze + automatische detectie voor de website en alle apps |
| `i18n-02.js` | spreken: de eigen stem invullen en meteen laten herkennen |
| `i18n-03.js` | De keuze mag nooit de pagina gijzelen: klik ernaast = huidige taal houden |

## `shared/ios.js`

`public/shared/ios/` -- 4 delen, 629 regels in de delen

| deel | onderwerp |
|---|---|
| `ios-01.js` | De iOS-laag, het gedrag |
| `ios-02.js` | Zoekvelden en filterrijen horen niet op de balk zelf maar eronder -- dat is waar Mail en Berichten ze zetten |
| `ios-02b.js` | Afgesplitst van ios-02.js, dat over de 10 KB ging toen de bijregels van de kop meeverhuisden |
| `ios-03.js` | de randveeg: vanaf de schermrand naar binnen vegen |

## `shared/klok.js`

`public/shared/klok/` -- 5 delen, 577 regels in de delen

| deel | onderwerp |
|---|---|
| `klok-01.js` | De RTG-klok: EEN klok voor het hele besturingssysteem |
| `klok-01b.js` | Vervolg van klok-01: het glas en de rest van de ringstijl |
| `klok-02.js` | de wijzerplaat tekenen |
| `klok-02b.js` | de wijzers: slank, gepolijst goud met een lume-kanaal |
| `klok-03.js` | de wijzers laten draaien |

## `shared/klok3d.js`

`public/shared/klok3d/` -- 2 delen, 263 regels in de delen

| deel | onderwerp |
|---|---|
| `klok3d-01.js` | De RTG-klok als 3D-skelethorloge: een progressieve verrijking boven de bestaande wijzerplaat (shared/klok.js) |
| `klok3d-02.js` | kleur die meeademt met de dagkleur, maar goud blijft |

## `shared/levendekleur.js`

`public/shared/levendekleur/` -- 2 delen, 281 regels in de delen

| deel | onderwerp |
|---|---|
| `levendekleur-01.js` | De levende grond van de hele ROS |
| `levendekleur-02.js` | toepassen |

## `shared/media.js`

`public/shared/media/` -- 2 delen, 191 regels in de delen

| deel | onderwerp |
|---|---|
| `media-01.js` | DE MEDIAPOORT -- de enige deur naar camera en microfoon |
| `media-02.js` | DE MELDING, op het moment van gebruik -- geen banner die je een half uur eerder wegklikte |

## `shared/metgezel.js`

`public/shared/metgezel/` -- 7 delen, 768 regels in de delen

| deel | onderwerp |
|---|---|
| `metgezel-01.js` | De metgezel: Rahul + Samen, op elke app-pagina |
| `metgezel-01b.js` | de stijl en de bouwstenen van de metgezel |
| `metgezel-01b2.js` | Afgesplitst van metgezel-01b.js, dat over de 10 KB ging |
| `metgezel-01c.js` | HET BLOK VAN RAHUL: het antwoord boven, de balk eronder, en de ruimte die de pagina ervoor vrijhoudt |
| `metgezel-01d.js` | RAHUL STAAT NERGENS OVERHEEN -- OOK NIET OVER EEN VASTE LAAG |
| `metgezel-02.js` | Rahul heeft een melding: de lippen verkleuren en bewegen |
| `metgezel-03.js` | Lege-toestand-nudge: elke plek met data-rahul-leeg="opdracht" opent Rahul met die opdracht al ingevuld |

## `shared/mond.js`

`public/shared/mond/` -- 3 delen, 396 regels in de delen

| deel | onderwerp |
|---|---|
| `mond-01.js` | De RTG-signatuurmond: EEN mond voor het hele systeem, nu in 3D |
| `mond-01b.js` | vanaf hier: alleen in de browser |
| `mond-02.js` | 2D-terugval: hetzelfde gezicht, dezelfde spraak, zonder WebGL |

## `shared/qr.js`

`public/shared/qr/` -- 2 delen, 353 regels in de delen

| deel | onderwerp |
|---|---|
| `qr-01.js` | RTG QR: een eigen QR-code-codec (encode + decode), i.p.v |
| `qr-02.js` | de zigzag: de bits in de QR-matrix leggen |

## `shared/rahulpoort.js`

`public/shared/rahulpoort/` -- 2 delen, 257 regels in de delen

| deel | onderwerp |
|---|---|
| `rahulpoort-01.js` | DE RAHUL-POORT -- inloggen als een gesprek, ook op de werkschermen |
| `rahulpoort-02.js` | het gesprek in stappen |

## `shared/rtg-schil.js`

`public/shared/rtg-schil/` -- 8 delen, 729 regels in de delen

| deel | onderwerp |
|---|---|
| `01-kern.js` | RTG Spatial Shell: de laag die van de desktop een werkruimte maakt |
| `02-indeling.js` | de indeling -- De console is het ANKER en schuift naar waar hij het minst stoort (WERKRUIMTE.md par |
| `03-surfaces.js` | surfaces: een venster openen, sluiten en naar voren halen |
| `04-slepen.js` | verplaatsen: een surface aan zijn gouden greep verslepen |
| `05-context.js` | context linking -- De shell stuurt alleen een VERWIJZING rond: soort, id, label |
| `06-werkruimtes.js` | werkruimtes -- Stap 5 uit WERKRUIMTE.md |
| `06b-objecten.js` | objecten tussen apps -- Stap 7 uit WERKRUIMTE.md |
| `07-start.js` | opstarten -- Dit deel sluit de omhulsel-functie af en hangt RTGSchil op |

## `shared/rtghorloge.js`

`public/shared/rtghorloge/` -- 4 delen, 474 regels in de delen

| deel | onderwerp |
|---|---|
| `rtghorloge-01.js` | Het RTG-signatuurhorloge: een compleet, opengewerkt (skeleton) horloge dat naast de Rahul-lippen het tweede gezicht v... |
| `rtghorloge-02.js` | toegepaste baton-indexen (AP), dubbel op 12 |
| `rtghorloge-03.js` | een heel lichte saffier-sheen bovenop alles |
| `rtghorloge-04.js` | het gaande werk: de middelpunten liggen op EXACT meshende afstand -- voor elk grijpend paar geldt afstand = steekstra... |

## `shared/sterren.js`

`public/shared/sterren/` -- 3 delen, 335 regels in de delen

| deel | onderwerp |
|---|---|
| `sterren-01.js` | RTG Sterrenhemel: een diepe, levende sterrenkoepel in huisstijl - de rust van een Rolls-Royce Starlight-hemel, maar d... |
| `sterren-02.js` | de waarnemer: eerst een schatting uit de tijdzone, daarna (na toestemming) de echte locatie |
| `sterren-03.js` | Afgesplitst van sterren-02.js, dat over de 10 KB ging toen het stofveld van een gebakken plaatje een bewegend veld werd |

## `shared/teamcall.js`

`public/shared/teamcall/` -- 2 delen, 267 regels in de delen

| deel | onderwerp |
|---|---|
| `teamcall-01.js` | De teamcall: echt (video)bellen op de werkvloer via WebRTC |
| `teamcall-02.js` | de publieke knoppen |

## `shared/uitvoer.js`

`public/shared/uitvoer/` -- 2 delen, 270 regels in de delen

| deel | onderwerp |
|---|---|
| `uitvoer-01.js` | Uitvoer: uw gegevens meenemen uit elke app |
| `uitvoer-02.js` | De bediening. Die was er niet: neemMee() had als enige aanroeper de |

## `shared/verbinding.js`

`public/shared/verbinding/` -- 2 delen, 344 regels in de delen

| deel | onderwerp |
|---|---|
| `verbinding-01.js` | Gedeelde verbindingslaag voor alle apps |
| `verbinding-02.js` | het satelliet-noodbericht |

## `shared/werkos.js`

`public/shared/werkos/` -- 3 delen, 475 regels in de delen

| deel | onderwerp |
|---|---|
| `werkos-01.js` | RTG Werk-OS |
| `werkos-02.js` | het dock onderin het werk-OS |
| `werkos-03.js` | bouwen en spiegelen |

## `shared/zaakcommand.js`

`public/shared/zaakcommand/` -- 4 delen, 502 regels in de delen

| deel | onderwerp |
|---|---|
| `zaakcommand-01.js` | DE REGIE VAN DE ZAAK -- één weergave, twee huizen |
| `zaakcommand-02.js` | De Regie van de zaak, deel 2: de werkplekken zelf |
| `zaakcommand-03.js` | De Regie van de zaak, deel 3: zoeken en het objectdossier |
| `zaakcommand-04.js` | De Regie van de zaak, deel 4: rechtzetten en de regels |

