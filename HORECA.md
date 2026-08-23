# RTG Service Choreography OS

*Het diepte-document van de horecakant. Lees dit vóór je aan een horecascherm,
een keukenlaag of de PDA werkt. `CLAUDE.md` gaat over het merk, `LAT.md` over de
code, `ONTWERP.md` over de vorm — dit gaat over wat de horeca eigenlijk is.*

## De kern in één zin

**Een kassa registreert wat besteld is; RTG regisseert wat er nú moet gebeuren
om de hele tafel op het juiste moment een goede ervaring te geven.**

Dat is geen slogan maar een architectuurbesluit met gevolgen. Een systeem dat
registreert, heeft een order nodig. Een systeem dat regisseert, heeft een
*beloofd moment* nodig en rekent daar vanaf terug. Alles hieronder volgt uit dat
verschil.

## Wat dit NIET is

Geen mooiere KDS. Toast, Square en Lightspeed routeren tickets, tonen timers en
sturen wijzigingen realtime naar een keukenscherm; Oracle verbindt kassa,
voorraad, personeel en loyalty; SevenRooms bouwt gastprofielen. Op die lijst
winnen we niet, en we hoeven er ook niet op te staan. `MARKT.md` zegt het al
eerlijk: RTG wint niet op features maar op prijs, op één systeem in plaats van
vier, en op het eigen bestelkanaal tegen vaste prijs. **Dit document voegt daar
de enige categorie aan toe waarop we wél kunnen winnen: de choreografie van
gast, mens, keuken, bar, geld, veiligheid en tijd als één stroom.**

En het is uitdrukkelijk geen zesde losse app. Zie `PLATFORM.md`: samenvoegen is
stap één, niet de bedoeling. Dit is één capability met zes projecties.

## De zes werkstanden

Eén servicestroom, zes vensters erop. Iedereen ziet dezelfde order; alleen de
informatie en de acties die bij zijn rol horen.

| Werkstand | Gebruiker | De centrale vraag |
|---|---|---|
| **TAFEL** | gast | Wat kan ik kiezen, en wat gebeurt er nu? |
| **PDA SERVICE** | bediening, runner, host | Wat is mijn eerstvolgende handeling? |
| **VLOER** | maître, wijkhoofd | Wie heeft ons nú nodig, en hoe verdelen we dat? |
| **VUUR** | keuken | Wat moet op welk moment klaar zijn? |
| **BAR** | barteam | Welke drankgolf moet nu gemaakt worden? |
| **REGIE** | manager, expo | Waar breekt de belofte, en wat is de veiligste ingreep? |

**De PDA is de belangrijkste van de zes, en niet de kleinste.** De vaste
schermen informeren en regisseren; op de PDA wordt de service werkelijk
uitgevoerd — ontvangen, opnemen, gangen sturen, ophalen, oplossen, afrekenen.
Zonder PDA is dit een slim dashboardsysteem. Mét PDA is het een gesloten keten.
Een PDA is dus geen kleine kassa met diepere menu's, maar een persoonlijke
servicecockpit die drie dingen weet: waar deze medewerker verantwoordelijk voor
is, wat nú de belangrijkste actie is, en welke informatie nodig is om die actie
veilig af te ronden.

## Eén gedeelde werkelijkheid

Alle kanalen — kassa, tafel, QR, bar, terras, club, afhaal, bezorging, hotel,
roomservice, event, polsband, online — komen in één operationeel model:

```
bezoek → gezelschap → gast/stoel → bestelling → gang → gerecht/drank
       → bereidingsstappen → station → pass → runner → uitserveren
       → betaling → bewijs
```

Een bestelling is daarmee niet langer alleen een ticket. Het systeem kent ook:
voor wie, op welke stoel, bij welke gang, wanneer de gast het verwacht, wat er
tegelijk moet landen, welke stations eraan werken, welke allergenen gelden,
welke voorraadbatch gebruikt is, wie verantwoordelijk is, en hoe er betaald
wordt.

### Welke schakels er vandaag al zijn — en welke niet

Dit is geen wenslijst; het meeste staat er. Gemeten op 23 augustus 2026 tegen
`server/routes/supplier/horeca/` (92 endpoints) en `server/kern/horeca/`.

| Schakel | Stand | Waar |
|---|---|---|
| bezoek | **staat**, als `rekening` met `kanaal` en `geopendAt` | `kern/horeca.js` |
| gezelschap | **half**: `gasten` is een aantal, geen gezelschap | `rekening/open` |
| gast/stoel | **ONTBREEKT** | — |
| bestelling → gang | **staat**, met `gang/vrij` als expliciete vrijgave | `horeca/rekening.js` |
| bereidingsstappen | **half**: één norm per gerecht, geen stappen | `keukenlaag.js` |
| station | **staat** | `keuken/bord` |
| pass | **staat**, en geeft niets automatisch uit | `horeca/expeditie.js` |
| runner | **ONTBREEKT** als rol met een claim | — |
| uitserveren | **staat** als stand `uitgegeven` | `keuken/stand` |
| betaling | **staat**, dertien wijzen, splitsen tot op de cent | `horeca/betalen.js` |
| bewijs | **half**: bon en logboek wel, action receipt niet | `horeca/bonnen.js` |

**De stoel is het ontbrekende scharnier.** Er is nergens in de horecakern een
`stoel` of een `gezelschap`; er is een rekening met een aantal gasten en een
platte lijst regels. Vrijwel alles wat dit document belooft, hangt daaraan: per
stoel bestellen, per stoel splitsen, "stoel 1 entrecote" op de pas, de runner
die weet waar het bord heen moet, de allergie die aan een persoon hangt in
plaats van aan een regel. **Bouw dat één keer goed, en de helft van de rest
volgt vanzelf. Bouw het niet, en elke werkstand hierboven krijgt zijn eigen
halve oplossing.**

## Wat er al staat en niet opnieuw gebouwd moet worden

Deze lijst bestaat omdat de grootste kostenpost bij een herontwerp is dat iemand
iets bouwt dat er al is:

- **De rekening is al één waarheid over alle kanalen.** `routes/gast.js` zegt
  het met zoveel woorden: de rekening waarop een gast via QR bestelt, is
  dezelfde rij die de bediening op haar scherm ziet. Er is geen tweede
  orderstaat, en die mag er ook niet komen.
- **Gangregie bestaat al.** Een regel draagt zijn gang; de zaal geeft een gang
  vrij; de keuken ziet niets van een gang die nog niet vrij is. Dat is de kiem
  van choreografie en hij is getoetst (`test/horeca-keuken.test.js`).
- **De drukterem toont zijn rekensom en sluit niets.** `openWerk()` in
  `kern/horeca/keukenlaag.js`: openstaande bereidingsminuten gedeeld door het
  aantal koks, navertelbaar, besluit bij de chef.
- **Splitsen en samenvoegen zijn verplaatsingen**, exact tot op de cent, ook bij
  10,00 door drie (`test/horeca-rekening.test.js`).
- **De offline-wachtrij is er aan de serverkant** en is idempotent op
  `clientId` — `POST /api/supplier/horeca/offline/sync`. Er is alleen nog geen
  enkele client die hem gebruikt.
- **De duwstroom is er al**: elke standwijziging stuurt
  `sseToSupplier(code, 'sync', { scope: 'keuken' })`, en `/api/supplier/stream`
  draait. Alleen luistert geen horecascherm ernaar.
- **Servicegolf, guest recovery, dish twin, spatial venue, folio, event,
  polsband, HACCP, bezorgzone** — allemaal aanwezig met endpoint en scherm.
- **114 talen** staan in `public/shared/i18n.js`.
- **Een gastprofiel bewaart voorkeuren en géén waarde-per-gast**, en dat is een
  toets en geen belofte (`test/horeca-vloer.test.js`).

## Wat er nieuw moet, in volgorde

**0. Eerst leesbaar en levend, dan pas slim.** Op 23 augustus 2026 gemeten op
`/apps/horeca.html`: 73% van de zichtbare tekstelementen stond onder 12px, 39%
onder 8px, de kleinste tekst was 5px, en 66–70% van de raakvlakken was lager dan
44px. Het keukenbord ververste zichzelf niet — na twintig seconden met een nieuw
vrijgegeven gerecht stond het er nog niet op. Er valt niets te choreograferen op
een scherm dat een kok niet kan lezen en dat stilstaat. *Stand: gedaan voor
VUUR; de vijf andere werkstanden staan nog op de oude maten.*

  **Wat hier eerst ten onrechte stond, en waarom het hier blijft staan.** Deze
  regel meldde ook dat één tik op een bon de scrollpositie 5.182 pixels weggooit
  doordat het hele bord opnieuw wordt getekend. Dat is bij nameting onjuist
  gebleken: die verschuiving was de `scrollIntoView` van het meetscript zelf, en
  onder een zuivere meting schuift zowel de oude als de nieuwe versie 0 pixels —
  Chrome verankert de scroll zelf bij een DOM-wissel. Het bon-voor-bon bijwerken
  is er toch gekomen, maar op een ander argument: sinds het bord zichzelf
  ververst, zou een volledige `innerHTML`-wissel tachtig DOM-knopen slopen en
  herbouwen bij elke tik van elke collega. De les hoort erbij: een getal uit een
  meetscript is pas een feit als het script zelf ook is nagerekend.

**1. Cadans: terugrekenen vanaf het serveermoment.** Vandaag rekent de keuken
vooruit ("deze bon loopt 14 van 12 minuten"). Choreografie rekent terug: doel
19:42 → entrecote starten 19:26, zeebaars 19:31, risotto 19:32, passcontrole
19:40. Dit is de kleinste verandering die het verschil tussen registreren en
regisseren echt maakt, en hij kan bovenop `bereidingsMinuten()` zonder één
bestaand veld te breken.

**2. Stoel en gezelschap.** Het ontbrekende scharnier hierboven.

**3. Claim op uitgifte.** Een gereed product gaat naar de relevante medewerker,
niet naar iedereen; wie claimt, laat de taak bij de rest verdwijnen. Het patroon
bestaat al voor gastverzoeken (`open → opgepakt → klaar`, met "ik ga" en
"gedaan" als twee verschillende knoppen, precies omdat er anders twee mensen of
niemand loopt). Datzelfde patroon over de pas en de bar.

**4. PDA SERVICE** als eigen werkstand, met rolmodi (bediening, runner, host,
wijkhoofd, manager) op één app.

**5. Venue Edge**: de clientkant van offline. De serverkant ligt er.

**6. Action receipts en de rechtenlaag van Rahul.** Vandaag kent de horeca twee
rechten: `supplierAuth` en `managerOnly`. Dat is te grof voor wat hieronder
staat.

## De grenzen

*Zoals in elk diepte-document van dit huis: waar een functie botst met een
grens, vervalt de functie.*

1. **Generatieve AI bepaalt nooit of iets veilig is om te eten.** Allergenen,
   kruisbesmetting en dieet komen uit beheerde recept- en allergenendata, of ze
   komen er niet. Een model mag een concept opstellen; een mens bevestigt, en
   bij de pas een tweede keer. Spraak maakt een concept, nooit een verzonden
   handeling.
2. **Een gast is een codenaam.** Personalisatie loopt op de codenaam; de echte
   naam staat in de identiteitskluis (`server/accounts.js`). Geen labels als
   "grote spender", geen waarde-per-gast, geen scherm dat een mens rangschikt op
   wat hij uitgeeft. Dat is vandaag een toets en die blijft staan.
3. **Er komt geen ranglijst op medewerkers.** Een schenkafwijking is een signaal
   voor voorraad, training of materiaal — nooit een automatische beschuldiging
   en nooit een publieke score. Zelfde regel als de progressiegrens elders in
   dit huis: meten mag, afrekenen op mensen niet.
4. **Het systeem vinkt niets zelf af.** "Uitgegeven" is een handeling van een
   mens aan de pas. Een systeem dat zelf afvinkt, maakt van dat woord een lege
   huls. Staat al zo in `horeca/expeditie.js` en blijft zo.
5. **Geen betaling zonder bestaande menselijke controle.** De betaalgrens van
   `GELD.md` geldt hier onverkort: geld verlaat het huis nooit vanzelf.
6. **Een rem toont zijn rekensom en sluit niets.** De drukterem, het tijdslot,
   de bezorgzone: elk nee draagt zijn getal en zijn reden. Een rem die alleen
   "nee" zegt, stuurt de klant naar een ander.
7. **Wat niet gemeten is, wordt niet als getal getoond.** Concreet openstaand
   punt: de journey-toren toont vandaag een voortgangsring van 12/30/48/64/78%
   die uit een toestandslabel komt en niets meet. Dat percentage hoort weg of
   het hoort een echte meting te worden. Hetzelfde geldt voor elke toekomstige
   "score".
8. **Rush Mode mag nooit een veiligheidsgrendel verbergen.** Minder tonen
   betekent minder statistiek, minder instellingen, minder tekst — nooit minder
   allergie, minder bevestiging of minder noodbediening.
9. **Rahul verschijnt niet als chatvenster op elk scherm.** Drie vormen:
   voorspellen, adviseren, uitvoeren. Uitvoeren alleen binnen de rechtenlaag:
   laag risico automatisch en terugdraaibaar, middel bevestigt een medewerker,
   hoog vraagt een manager of vier ogen. Allergenen, voedselveiligheid,
   betalingen en arbeidsbesluiten zijn deterministisch en menselijk — nooit
   modelbesluiten.
10. **Elke uitgevoerde AI-actie draagt een bewijs**: wat is er veranderd,
    waarom, op basis van welke gegevens, wie mocht dit, welk effect werd
    verwacht, wat gebeurde er werkelijk, en kan het terug. Het patroon bestaat
    al in `server/kern/geldbeleid/actielog.js` en hoeft niet opnieuw bedacht.

## Vorm per werkplek

Eén stijl over alle zes werkstanden zou juist onprofessioneel zijn. Dezelfde
kern, ergonomie naar de werkplek — binnen de merkregels van `CLAUDE.md` en
`MATERIAAL.md`.

- **Gast (TAFEL)**: Pearl en Bordeaux, ruimte, rust, beeld uit De Salon.
- **Bediening en manager (PDA, VLOER, REGIE)**: Onyx, warme accenten, sterke
  hiërarchie, één-handbediening, informatie die geleidelijk verschijnt.
- **Keuken en bar (VUUR, BAR)**: maximaal functioneel contrast, grote letters en
  raakvlakken, kleur nooit als enige betekenis, handschoen- en vochtbestendig,
  automatische dag-, nacht- en rushweergave.

De harde ondergrenzen voor VUUR en BAR: **operationele tekst niet onder 13px,
bontekst niet onder 16px, elk raakvlak minstens 44px hoog.** WCAG 2.5.8 vraagt
24px; dat is de wet, niet de maat voor een natte vinger tijdens de spits.

## De meetlat

Niet vergelijken op het aantal functies, maar op de uitkomst van een echte
service. Draai dezelfde piekavond twee keer — gelijk menu, gelijke
bestellingen, gelijke bezetting, dezelfde storingen, dezelfde personeelssterkte
— één keer met het huidige scherm en één keer met de choreografielaag.

| Meetpunt | De lat |
|---|---|
| verloren orders bij netwerkverlies | 0 |
| dubbele financiële boekingen na herstel | 0 |
| onbevestigde allergiewijzigingen | 0 |
| kritieke AI-acties zonder geldig bewijs | 0 |
| bedieningshandelingen per bestelling | aantoonbaar lager dan nu |
| tijd tot eerste drank | per servicetype bewaakt |
| spreiding tussen gerechten van dezelfde gang | structureel kleiner |
| beloofde versus werkelijke gereedtijd | meetbare nauwkeurigheid |
| remakes en misroutes | meetbaar lager |
| dubbel geclaimde uitgiftes | 0 |
| herstelproeven offline→online | 100% gereconcilieerd |
| statische "enterprise"-beloften | 0 |

De laatste regel is de belangrijkste. Dit document is pas waar wanneer er een
meting naast staat, en tot die tijd is het een plan.

## De echte wauw

Voor de gast: *"Ze wisten wat wij nodig hadden, zonder dat het onpersoonlijk of
opdringerig werd."*
Voor de medewerker: *"Het scherm vertelde niet alles wat er gebeurde — alleen
wat ik nú moest doen."*
Voor de chef: *"De keuken werkte als één team, ook toen alle kanalen tegelijk
binnenkwamen."*
Voor de eigenaar: *"Ik zag een probleem ontstaan, kon de oplossing simuleren, en
kon achteraf precies bewijzen wat er is besloten."*
