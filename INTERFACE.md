# RTG Interface Operating Standard

> **RTG is geen verzameling apps. RTG is één adaptieve digitale
> besturingsomgeving.**

Dit document is de product- en runtime-norm voor iedere RTG-interface.
`ONTWERP.md` beschrijft de visuele taal, `ADAPTIEF.md` de vorm van handelingen op
ieder apparaat, `GRAMMATICA.md` de interactie, `WERKRUIMTE.md` de ruimtelijke
desktopvorm en `TOEGANKELIJK.md` de harde toegangspoorten. Geen van die lagen is
een losse schil: samen voeren ze deze standaard uit.

De gebruiker mag nooit hoeven vragen: *waar moet ik heen om dit te doen?* De
interface brengt de relevante informatie en handeling naar de gebruiker. RTG
mag voorstellen en herschikken; een mens houdt de beslissing.

---

## 1. De niet-onderhandelbare regels

1. **Eén interface-eigenaar.** Op ieder moment tekent precies één host de
   globale navigatie, Rahul, notificaties en systeemhandelingen. Een ingesloten
   product tekent geen tweede hostlaag.
2. **Producten leveren capabilities, geen chrome.** Een product meldt wat een
   gebruiker kan doen, welke context actief is en welke toestand gemeten is. De
   runtime kiest de passende vorm.
3. **Continuïteit boven appgrenzen.** Identiteit, gesprek, actieve taak,
   notificaties en persoonlijke modules horen bij de sessie, niet bij de pagina.
4. **Voorstellen zijn geen besluiten.** AI en contextregels mogen voorbereiden,
   rangschikken en toelichten. Betalen, delen, boeken, verwijderen en andere
   handelingen met gezag vereisen de bestaande bevestigings- en rechtenlaag.
5. **Geen dode of dubbele bediening.** Geen geïsoleerde menu's, dubbele
   navigatie, verborgen capabilities, lege gereserveerde balkruimte of pagina
   zonder een veilige terugweg.
6. **Werkelijke toestand.** Een Living Module toont echte brondata of een
   eerlijke lege/foutstand. Voorbeeldnamen, verzonnen ritten en geruststellende
   nepstatus horen niet in productie.
7. **Standalone blijft werken.** Een product dat niet in de RTG-host draait,
   houdt een eigen toegankelijke bediening. In de host draagt het die bediening
   over aan de runtime.

---

## 2. De vijf kernsystemen

### 2.1 RTG Dynamic Core

De Dynamic Core is de enige globale interactielaag. Hij combineert de actieve
wereld, taak, rol, rechten en gemeten toestand tot een voorspelbare bediening.
De plaatsen blijven herkenbaar; de relevante acties veranderen.

De eerste implementatie gebruikt RTG Command als host en de capability- en
contextcontracten uit `public/shared/adaptief/`. RTG Edge blijft een catalogus
en zelfstandige renderer; RTG Schil blijft de ruimtelijke desktopmotor. Ze
worden niet tegelijk als concurrerende hosts in hetzelfde werkblad geladen.

### 2.2 RTG Second Screen

Het Second Screen is een blijvende interactieve werklaag boven de actieve
wereld. Het is geen appmenu. Het bewaart context terwijl een gebruiker een
gesprek volgt, een module opent of een handeling voorbereidt.

De vier standen zijn één toestandsmachine:

| Stand | Betekenis | Gedrag |
|---|---|---|
| **Peek** | een rustige ingang | toont alleen dat de laag beschikbaar is |
| **Panel** | snel volgen en handelen | modules naast of boven de actieve wereld |
| **Workspace** | meerdere modules samen | meer ruimte zonder de hoofdcontext te verliezen |
| **Focus** | één taak vraagt volledige aandacht | één module vult de werkruimte; Escape/Sluiten herstelt de vorige stand |

Open module, scrollpositie, volgorde en persoonlijke zichtbaarheid mogen tussen
werelden meegaan. Formulierinhoud, sessiesleutels en gevoelige brondata worden
niet in de interfacevoorkeuren gekopieerd.

### 2.3 RTG Living Modules

Een Living Module is een handelend runtime-object, geen passieve widget. Iedere
module declareert ten minste:

```text
id · titel · bron · toegestane vormen · capabilities · toestand · rechten
```

Optioneel declareert hij live gebeurtenissen, uitleg, een veilige weg terug en
een morph-pad. Dezelfde module kan bijvoorbeeld veranderen van
`Berichtpreview → Gesprek → Gesprek in focus`, zonder een tweede implementatie
van berichten te maken.

Een module mag alleen acties aanbieden die hij werkelijk kan uitvoeren. De
runtime routeert een actie terug naar de module die hem declareerde; de host
gaat niet in app-DOM zoeken en een app kopieert de hostactie niet.

### 2.4 RTG Context Engine

De Context Engine weegt uitsluitend toegestane en verklaarbare signalen:
actieve app, taak, tijd, expliciete locatiecontext, lopende processen, rol,
rechten, recente interacties, notificaties en voorkeuren.

Een voorstel draagt altijd:

- de aanleiding: waarom verschijnt dit nu;
- de voorgestelde verandering;
- de gegevens of modules die geraakt worden;
- een duidelijke keuze om te accepteren of te negeren.

Stil herschikken is alleen toegestaan voor eerder door de gebruiker gekozen
persoonlijke voorkeuren en mag nooit een bevoegdheids- of bevestigingsstap
omzeilen.

### 2.5 RTG Continuity Layer

Continuity bewaart een minimale, canonieke sessiestaat: identiteit, actieve
wereld, maximaal toegestane werkbladen, actieve module, modulevolgorde,
notificatieleesstand en expliciet gekozen persoonlijke voorkeuren. Iedere
brondienst blijft eigenaar van zijn inhoud.

Een productwissel verandert de ruimte, niet de persoon. De host mag een module
opnieuw verbinden, maar mag geen chat, betaling, locatie of dossier kopiëren om
continuïteit na te bootsen.

---

## 3. Eén runtime, drie configuratielagen

De uiteindelijke interface is de gecontroleerde samenvoeging van:

1. **RTG Standard** — identiteit, interactiegrammatica, veiligheid,
   toegankelijkheid en onveranderlijke systeemfuncties;
2. **Organization Layer** — modules, beleid, rollen en verplichte werkstromen
   die een organisatie binnen haar eigen werkruimte configureert;
3. **Personal Layer** — volgorde, dichtheid en sneltoegang die de gebruiker zelf
   kiest binnen zijn rechten.

De onderste laag kan een hogere veiligheidsregel nooit overschrijven. Een
persoonlijke voorkeur kan rangschikken, niet autoriseren.

---

## 4. Runtime-contract

De RTG Interface Runtime bestaat logisch uit:

- Design Tokens en Component Engine;
- Motion Engine en Accessibility Layer;
- Dynamic Core en Second Screen;
- Living Module Runtime en Module SDK;
- Context Engine en AI Action Layer;
- Messaging, Notification en Identity Layer;
- Permission Engine;
- Realtime Event Bus;
- Personalization, Offline State en Sync Engine;
- Analytics & Observability.

Dit zijn verantwoordelijkheden, geen uitnodiging voor achttien concurrerende
frontends. Nieuwe code wordt pas een afzonderlijke module als zij een eigen
eigenaar, levenscyclus en testbaar contract heeft.

### 4.1 Host–modulegrens

- Alleen dezelfde herkomst én een geregistreerd actief direct werkblad mag
  context aan de host leveren.
- Over de framegrens reizen alleen serialiseerbare declaraties, ids en gemeten
  toestand; geen DOM, tokens of functies.
- Een handeling wordt uitgevoerd door de declarerende module.
- Een genest werkblad praat met zijn directe eigenaar; kleinkinderen nemen de
  globale host niet rechtstreeks over.
- `pagehide`, sluiten, wisselen en herladen trekken oude context in.
- Herhaald laden en BFCache mogen geen dubbele listeners of dubbele modules
  maken.

### 4.2 Navigatie-eigenaarschap

```text
standalone product  → product is eigenaar
product in Command  → Command is eigenaar; product levert capabilities
module in product   → product is eigenaar; module levert capabilities
Focus Mode          → dezelfde eigenaar; alleen de presentatie groeit
```

De eigenaar is dus expliciet en hiërarchisch. CSS die toevallig een van drie
balken verbergt is geen eigendomsmodel.

---

## 5. Morphing zonder betekenisverlies

Een element mag van vorm veranderen als id, betekenis, toestand, rechten en
actiepad gelijk blijven. Voorbeelden:

```text
Berichtpreview → Gesprek → Bellen → Gedeelde reis
Ritkaart        → Route    → Live ETA → Betaling
Taak            → Goedkeuring → Document → Audit trail
```

Een morph is geen paginawissel met een animatie erover. Focus, terugweg,
toegankelijke naam en onafgeronde invoer gaan mee. Bij `prefers-reduced-motion`
blijft dezelfde toestandswisseling bestaan zonder ruimtelijke animatie.

---

## 6. AI in de interface

AI is geen bestemming in de navigatie. Een module of context kan een voorstel
laten opstellen, samenvatten of voorbereiden. De interface toont het voorstel
op de plek waar het werk gebeurt en gebruikt de bestaande actiegrammatica voor
bevestiging, verhindering en ongedaan maken.

Een AI-uitkomst vermeldt bron/context en onzekerheid wanneer die ertoe doen.
Zonder beschikbare AI blijven navigatie en alle handmatige functies bruikbaar.

---

## 7. Eerste verticale slice: TravelOS

De eerste productieslice bewijst de standaard in één echte keten:

1. RTG Command is de enige globale host.
2. TravelOS en Reizen & Veilig declareren hun bestaande handelingen als
   capabilities; er ontstaat geen tweede implementatie.
3. Het Second Screen leeft boven het actieve reisblad en gebruikt echte
   profiel-, bericht- en reisbronnen of toont een eerlijke lege stand.
4. Gaan, Reizen, Taxi, Navigatie en Veiligheid houden één actiepad en één
   navigatie-eigenaar, ook bij een ingesloten module.
5. Modulekeuze en volgorde gaan mee wanneer TravelOS naar een andere wereld
   wisselt; sessie- en brondetails blijven bij hun eigenaar.
6. Mobiel toont exact één persistente onderbalk. Bureau kan twee directe
   werkbladen tonen, maar geen gestapelde productschillen.

De slice is pas af met toetsen voor standalone en embedded gebruik, mobiele en
desktopvorm, safe areas, toetsenbord/focus, framewissel, reload, offline cache
en exact één zichtbare navigatie-eigenaar.

---

## 8. Definitie van RTG-kwaliteit

Every RTG surface must look and behave like it belongs to one premium operating
system. No isolated menus, no duplicate navigation, no inconsistent components,
no dead-end pages.

Dat betekent één motion-, icon-, spacing-, elevation-, interaction-,
accessibility-, responsive-, permissions-, personalization- en
notificationmodel. Afwijkingen zijn alleen toegestaan als de taak aantoonbaar
anders is; nooit omdat een product zijn eigen schil heeft meegenomen.
