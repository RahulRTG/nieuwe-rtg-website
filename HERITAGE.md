# RTG Heritage Intelligence System

> **Editorial luxury on the surface. Operational intelligence underneath.**
>
> **Eén bedieningsgrammatica, meerdere wereldidentiteiten.**

Dit document is het normatieve ontwerpcontract voor ieder RTG-scherm. Het is
geen moodboard en geen optioneel thema. Nieuwe en gewijzigde schermen voldoen
aan deze grammatica zonder hun domeingedrag, live brondata, rechten of
foutsemantiek te vervangen.

## 1. Karakter

RTG combineert hospitality-rust, redactionele hiërarchie, de precisie van een
operating system en menselijke dienstverlening. Ieder scherm moet drie dingen
voelbaar maken:

- **rust** — niets vraagt zonder reden om aandacht;
- **richting** — de eerstvolgende betekenisvolle stap is duidelijk;
- **beheersing** — een handeling is bewust, veilig en waar mogelijk herstelbaar.

Luxe ontstaat uit precisie en consequent gedrag. Fotografie en goud zijn
ondersteunend; zij zijn nooit een vervanging voor hiërarchie, waarheid of
bruikbaarheid.

## 2. Vaste regels

1. De vier werelden delen navigatie, componentbetekenis en interactie.
2. Beweging legt oorzaak, gevolg of ruimtelijke relatie uit.
3. Fotografie draagt sfeer; autoritatieve data draagt waarheid.
4. Contextuele bediening blijft voorspelbaar en verplaatst niet tijdens gebruik.
5. Ook tabellen, formulieren, lege staten, fouten en offlinegebruik zijn premium.
6. Er bestaat per scherm maximaal één primaire actie.
7. Edge is de enige vaste systeemschil. Een route tekent geen tweede chrome.
8. Bestaande live DOM, acties en rechten blijven de bron; geen decoratieve
   kopieën of tweede dashboards boven het product.

## 3. Eén huis, vier wereldidentiteiten

| Wereld | Karakter | Vaste kleur- en materiaalrichting | Beweging |
|---|---|---|---|
| LivingOS | persoonlijk, warm, tactiel | parel, ivoor, bordeaux, donker goud, linnen en kalksteen | zacht en ademend |
| TravelOS | directioneel, verleidelijk | diepe wijn, bijna zwart, champagne, nachtblauw, donker glas en leer | gericht en horizontaal |
| WorkOS | precies, kalm, beheerst | grafiet, zwartgroen, teal, messing, rookglas en steen | kort en exact |
| FoundationOS | waardig, toegankelijk | nachtblauw, civiel goud, steenblauw, zacht wit, hout en daglicht | rustig samenvoegend |

De wereldidentiteit is informatiearchitectuur en geen door de gebruiker vrij
te kiezen thema. De publieke vier-wereldenlanding is de neutrale RTG-hal;
ieder blijvend appscherm, ook toegang, veiligheid en instellingen, is door het
centrale routemanifest aan precies één van de vier werelden gekoppeld. Er
bestaat geen vijfde zichtbare productwereld.

## 4. Visuele grammatica

### Typografie

- Bodoni is ceremonieel: dominante titels, wereldnamen, bestemmingen en één
  betekenisvol getal.
- Inter draagt bediening, formulieren, tabellen, metadata, status en uitleg.
- Een scherm heeft één dominante titel, één contextlabel, één ondersteunende
  tekstlaag en één operationele datalaag.
- Lopende mobiele tekst is minimaal 16 px; lange regels blijven rond 60–72
  tekens; operationele cijfers zijn tabulair.

### Geometrie en ruimte

- Inhoudsvlakken zijn recht of bijna recht: 0–4 px.
- Systeemlagen zijn herkenbaar afgerond: 16–28 px.
- De vaste ruimtereeks is 4, 8, 12, 16, 24, 32, 48, 64, 96 en 128 px.
- Het raster is 12 kolommen op desktop, 8 op tablet en 4 op mobiel.
- Dunne lijnen, open ruimte, registers en typografische groepen gaan vóór een
  raster vol identieke SaaS-kaarten.

### Diepte

1. **Wereld** — atmosfeer, fotografie en grondkleur.
2. **Inhoud** — lijsten, formulieren en rustige informatievlakken.
3. **Focus** — selectie, besluit en eerstvolgende stap.
4. **Systeem** — Edge, Continue Key, modale lagen en tijdelijke bediening.

Diepte ontstaat samen uit contrast, scherpte, transparantie en beweging. Een
actief vlak tilt hoogstens enkele pixels op; schaduwen zijn breed en zacht.

## 5. Vaste componentrollen

- **World Portal** — wereldfoto, icoon, naam, korte belofte en één ingang.
- **Editorial Hero** — contextlabel, dominante titel, korte toelichting en
  maximaal twee handelingen.
- **Context Strip** — compacte context voor agenda, dossier, formulier en lijst.
- **Moment List** — stabiele tijd-/statuskolom, hoofdregel, uitleg en scheiding.
- **Narrative Panel** — wat telt nu, wat volgt of welke beslissing wacht.
- **Operational Panel** — compacte, scanbare bronwaarheid zonder decoratief
  spektakel.
- **Side Sheet** — detail of bewerking terwijl het overzicht zichtbaar blijft.
- **State** — expliciete laad-, lege, fout-, offline- en bevestigde toestand.

Een route kiest deze rollen; zij ontwerpt ze niet opnieuw.

## 6. Edge en de Continue Key

Edge kent Overzicht, Compact, Automatisch en Focus. Automatisch is de regelaar
die tussen Overzicht en Compact kiest, en hij kiest alleen op een scroll van de
mens -- een scroll die de software zelf maakt laat de stand staan, zodat er niets
verschuift onder een vinger die net wil tikken. Focus blijft een expliciete
taakstand met een zichtbare uitgang. De globale ankerpunten blijven op elk scherm gelijk.

De RTG Continue Key vertegenwoordigt de eerstvolgende betekenisvolle stap. De
vorm en positie blijven herkenbaar; icoon en label mogen door context veranderen.
Op mobiel kan de gebruiker hem uitsluitend tussen veilige ankerpunten
verplaatsen. Hij bedekt nooit invoer, navigatie, status of systeembediening.

Een primaire actie behoudt zijn plaats tijdens `rust → bezig → gelukt/fout`.
Die overgang verandert dezelfde bediening en veroorzaakt geen layoutverschuiving.

## 7. Bewegingscontract

| Klasse | Tijd | Gebruik |
|---|---:|---|
| Direct | 70–120 ms | druk, focus, icoon, schakelaar |
| Functioneel | 160–240 ms | menu, selectie, compacte laag, morph |
| Structureel | 260–420 ms | paneel, route, Edge-modus, detail |
| Atmosferisch | 450–700 ms | wereldwissel en filmische binnenkomst |

Alle beweging gebruikt centrale tokens. Breedte, hoogte en positie worden niet
geanimeerd wanneer `translate`, `scale` of `opacity` hetzelfde kunnen uitleggen.
Reduced Motion verwijdert schaal en glijbeweging zonder informatie te verliezen.

## 8. Waarheid en intelligente bediening

- RTG onthoudt routecontext, scroll, selectie, filters, tab en Edge-stand.
- Context verandert een actie alleen als dit logisch uit een expliciete keuze
  voortkomt; de actie blijft op dezelfde plaats.
- Alleen veilige, herstelbare acties krijgen optimistische feedback.
- Financiële, juridische, medische, identiteits- en bevoegdheidsacties zijn pas
  definitief na bevestiging door de autoritatieve bron.
- Het scherm onderscheidt lokaal verwerkt, verzonden, bevestigd, wachtend,
  mislukt en teruggedraaid.
- Onzekere informatie wordt als onzeker geschreven; nooit als feit.

## 9. Schermregels

- Een wereldhome opent filmisch maar toont slechts wat nu telt, wat volgt en
  één duidelijke vervolgstap.
- Een dashboard kent één dominante focuszone; ondersteunende delen concurreren
  niet op gelijk gewicht.
- Agenda, dossier, formulieren en tabellen gebruiken compacte context en
  stabiele operationele geometrie.
- Kaart, camera, video, projectie en editor behouden hun canvas; Heritage zit in
  chrome, status, typografie en overgang.
- Mobiel is opnieuw geordend op prioriteit, nooit een verkleinde desktop.

## 10. Toegankelijkheid en technische kwaliteit

Minimumeisen zijn volledige toetsenbord- en touchbediening, zichtbare focus,
semantische koppen, concrete toegankelijke namen, contrast, tekstvergroting,
Reduced Motion, status met woord én teken, 44×44 px aanraakdoelen en een
alternatief voor iedere sleepactie.

De shell reageert zichtbaar binnen circa 100 ms, beweging blijft stabiel,
data veroorzaakt geen layoutverschuiving en invoer gaat niet verloren door een
tijdelijke netwerkfout. Een skelet gebruikt dezelfde geometrie als de inhoud.

## 11. Implementatiegrens

De centrale uitvoering woont in:

- `public/shared/rtg-world-identity.js` — vaste route-identiteit;
- `public/shared/rtg-heritage.css` — tokens en vier werelden;
- `public/shared/rtg-heritage-materials.css` — typografie, materiaal en diepte;
- `public/shared/rtg-heritage-components.css` — componentrollen en staten;
- `public/shared/rtg-heritage-adapters.css` — beheerste aansluiting op bestaand
  product-DOM;
- `public/shared/rtg-heritage-motion.css` en `.js` — beweging en toegankelijke
  actiestatus;
- Edge — de enige vaste navigatie- en systeemlaag.

Globale Heritage-CSS mag zonder expliciet componentcontract geen `display`,
`position`, `inset`, `grid`, `height` of `overflow` van bestaand product-DOM
overnemen. Uitzonderingscanvassen houden hun eigen geometrie.

## 12. Definitie van gereed

Een scherm is pas gereed wanneer zijn wereld/context vastligt, Edge uniek is,
alle bestaande functies en live bronnen intact zijn, de primaire actie stabiel
is, interactiestaten en eerlijke fout-/lege-/offlinetoestanden bestaan, mobiel
zelfstandig werkt, contrast/focus/beweging aantoonbaar kloppen en fotografie
geen informatie of bediening blokkeert.

Bewijs wordt minimaal geleverd op 320, 390, 768, 1024, 1440 en 1920 px, plus
toetsenbord, touch, tekstvergroting, Reduced Motion, trage verbinding en offline
herstel. Referentiescreenshots bewaken identiteit en hiërarchie; gedragsproeven
blijven de autoriteit voor data en acties.
