# PROOF.md -- de vertrouwenslaag (werknaam: RTG ProofOS)

Dit is het diepte-document van de vertrouwenslaag: hoe RTG van "wij testen
software" naar "wij bewijzen een organisatie" gaat. Lees dit voor je aan
bevoegdheden, bewijzen, poorten of de kantoorschermen daarover werkt. LAT.md
blijft de technische lat; dit document zegt waar die lat naartoe beweegt.

De kern in een zin: **vertrouwen is geen instelling maar een levende uitkomst.**
Niet "deze rol mag dit" maar: deze handeling wordt vertrouwd zolang identiteit,
bevoegdheid, bewijs, context, versheid en omkeerbaarheid dat SAMEN dragen, en
het systeem kan op elk moment tekenen waarom -- en wat dat vertrouwen zou
beeindigen.

Wat de groten doen is zichtbaar: AWS bewijst eigenschappen formeel, Google
bewijst herkomst van software, Microsoft verbindt controls en compliance, Apple
bouwt cryptografische ketens rond apparaten. De laag daarboven is open: bewijs
dat rechtstreeks de OPERATIONELE BEVOEGDHEID van elke bedrijfsfunctie bepaalt.
Daar bouwt dit huis aan.

## 0. De hoofdregel: altijd 100%, nooit minder

De richting is honderd procent bewezen, over alle assen, altijd. Dat is geen
ambitie op een poster maar een mechanische afspraak:

- **Bewijs mag alleen groeien.** De normtand `bewijsCellenBewezen` (scripts/
  norm.js) ratelt op het aantal bewezen cellen in BEWIJSMATRIX.json. Een cel
  die terugvalt haalt de poort neer tot een mens hem met een reden in NORM.json
  heeft beoordeeld.
- **Schuld mag alleen krimpen.** De normtand `bewijsAchterstand` ratelt op
  BEWIJSSCHULD.json (meetwerk + instrument). Groei kan alleen via
  `--groei="reden"` EN een handmatige normverhoging -- twee sloten, allebei
  met een naam eraan.
- **En krimpen is niet hetzelfde als aflossen.** Een lijst die nooit stijgt en
  nooit daalt haalt nul nooit -- de ratel ziet dat per definitie niet, want
  stilstand is geen groei. BEWIJSSCHULD.json draagt daarom een veld
  `aflossing`: **doel 0**, met wat nul betekent (meetwerk en instrument allebei
  leeg, en niet: de posten herbenoemd) en met een melder die een post die drie
  **meetdagen** op hetzelfde getal staat opschrijft als *de aflossing stokt
  hier*, met zijn sluitweg erbij. Per dag en niet per aanroep: de eerste versie
  telde runs, en toen viel de halve lijst stil van het meten zelf. Geen harde
  poort op nul (die zakt vanaf dag een en wordt uitgezet, en dan bewaakt hij
  niets) en geen zelfverzonnen einddatum per post (een afspraak die niemand
  heeft gemaakt, wordt de eerste keer stil verlengd).
- **Elke afwijking van 100% heeft een naam, een reden en een sluitweg.** Dat is
  BEWIJSSCHULD.json: elke post zegt wat hem zou sluiten. Een post zonder
  sluitweg is een klaagzang en komt er niet in.
- **De soort `grens` is de eerlijke rand.** Posten waar meten de verkeerde
  vraag is sluiten nooit, en dat is geen falen. Wie ze als achterstand telt,
  jaagt op een getal dat niet bestaat. De 100% gaat over alles wat een
  antwoord KAN hebben.

De burndown is geen project dat af raakt; het is de vaste bedrijfstoestand.
Als een band klaar is (zoals de OUTPUT-band met 3994 van 4195 routes bewezen),
begint de volgende post op de schuldlijst. Automatisch, zonder dat iemand er
opnieuw om hoeft te vragen.

## 1. De vertrouwensketen

De klassieke keten is `identiteit -> toegang`. De keten van dit huis is:

    intentie -> identiteit -> bevoegdheid -> capability -> bewijs -> context
             -> handeling -> gevolg -> bewijs

Een bevoegdheid is dus geen statische ACL maar een product:

    bevoegdheid = identiteit x bewijs x context x risico x versheid x omkeerbaarheid

Concreet: een terugboeking van 37 euro loopt vanzelf; een van 18.000 euro
vraagt een tweede paar ogen; is het bewijs rond de terugboekmotor verschaald,
dan is de capability tijdelijk alleen-lezen; is een verse auth-release nog
onvoldoende bewezen, dan staan financiele mutaties dicht tot het bewijs er is.
Niet als dashboardwaarschuwing maar als de poort zelf.

## 2. De vervalstaten: bewijs veroudert

Bewijs is nooit alleen groen of rood. Elke capability draagt een levende staat:

    BEWEZEN     alle vereiste bewijzen staan en zijn vers genoeg
      |  een afhankelijkheid of de code zelf veranderde
    VERSCHAALD  het bewijs was echt maar spreekt over een vorige wereld
      |  relevante waarnemingen ontbreken, of er is een anomalie
    VERZWAKT    het bewijs staat er maar draagt minder dan het lijkt
      |  tegenspraak of een ernstig signaal
    GESCHORST   dit vertrouwen is opgeschort; de veiligste toestand geldt
      |  hermeting die slaagt
    BEWEZEN

Twee regels zijn hard. De halfwaardetijd hangt af van het risico: een statische
pagina mag maanden op een bewijs teren, een betaalmotor eist na elke
codewijziging vers bewijs, een modelwissel maakt alle gedragsbewijzen van een
agent in een keer verschaald. En **niemand zet een staat met de hand op
BEWEZEN** -- alleen een hermeting kan dat. Een staat is een uitkomst, geen knop.

## 3. Tegenspraak is een eigen uitslag

Naast groen en rood bestaat er een derde uitslag: TEGENSPRAAK. Een toets zegt
"zonder rol kan dit niet" en de runtime-telemetrie toont drie uitvoeringen door
die rol: dan is niet een van beide "de echte", dan is de tegenspraak zelf de
bevinding, de capability gaat naar GESCHORST, en de meting wordt onderzocht
voor de functie weer opengaat. De post `rollback-gezakt` in BEWIJSSCHULD.json
is hier de oervorm van: een bevinding die verspringt is een bevinding over de
meting.

## 4. Bewijsdiversiteit: soorten boven aantallen

Achtenveertig bijna identieke toetsen die PASS zeggen wegen minder dan zes
onafhankelijke bewijssoorten die dezelfde eigenschap bevestigen. De soorten
die dit huis kent of gaat kennen:

    eenheid - integratie - browser - adversarieel (sabotage/mutatie) -
    runtime-waarneming - formeel - menselijke controle - extern oordeel

Elke capability krijgt naast zijn aantal bewijzen een diversiteitsbeeld. De
mutatiemotor en de liegpoort zijn de adversariele soort; de beproeving en het
journaal zijn de runtime-soort. Een eigenschap met een bewijs uit een soort is
gedekt; met bewijzen uit vier soorten is hij gedragen.

## 5. De vertrouwenspas per capability

Elke functie krijgt een levend paspoort, zoals leerdoelen een stabiele
identiteit hebben. Niet een pagina die iemand bijhoudt maar een lezing van de
registers:

    geld.terugboeking.order.v1
      staat            BEWEZEN
      laatste bewijs   <stempel uit de registers>
      bewijzen         23/23, 4 soorten
      afhankelijkheden 17, allemaal gezond
      tegenspraken     0
      AI-uitvoering    0 tot 500 euro
      mens             0 tot 50.000 euro
      vier ogen        daarboven

Klik erop en je ziet WAAROM je die functie mag vertrouwen -- en elke regel op
die pas komt uit een register dat een proef zelf schreef. Het routedossier
(server/routes/office/dossier.js, elf schakels per route) is de onderlaag; de
pas is dezelfde waarheid op capability-hoogte.

## 6. De universele vraag

Een vraag, overal beschikbaar, op elke betaling, aangifteberekening,
schoolbeslissing, AI-actie, toegang, factuur en deployment:

**"Waarom vertrouwt RTG dit?"**

En het antwoord is geen verhaal maar een levende tekening uit de registers:
handeling -> bevoegdheid -> software -> afhankelijkheden -> toetsen -> bewijs
-> beleid -> wettelijke basis -> gegevensbron -> goedkeuring -> runtime-staat.

En daarnaast de tweede vraag, die nog meer zegt:

**"Wat zou maken dat RTG dit niet meer vertrouwt?"**

Dat zijn de vervalvoorwaarden van paragraaf 2, per capability uitgeschreven.
Wie alleen bewijs toont, toont een foto; wie ook de vervalvoorwaarden toont,
toont het contract.

## 7. Verder op de keten: van herkomst naar gevolg

Herkomst stopt niet bij de build. De keten loopt door tot in de boekhouding:

    eis -> code -> commit -> build -> toets -> bewijs -> deployment ->
    runtime-waarneming -> gebruikershandeling -> financieel gevolg ->
    administratieve verwerking -> fiscale verwerking

Zodat op de vraag "waar komt deze 17,42 euro vandaan" het antwoord helemaal
terugloopt: aangifte <- factuur <- order <- prijsregel <- regelversie <-
softwareversie <- bewezen capability. Software-herkomst wordt
bedrijfsherkomst.

Daar bovenop, in volgorde van bouwen:

- **Slagveld vooraf (blast radius).** Voor een wijziging landt: welke modules,
  capabilities, journeys en bewijzen raakt hij, hoeveel bewijzen verschalen,
  wat moet opnieuw. De koppeling route -> toets van de OUTPUT-band en de
  mutatiemotor zijn hier de eerste helft van.
- **Wat-als op de bewijsgraaf (counterfactual).** "Wat gebeurt er met onze
  assurance als MFA verdwijnt" zonder iets te wijzigen: welke bewijzen
  vervallen, welke handelingen verliezen hun draagvlak, welke klant zakt onder
  zijn afgesproken niveau. Een digitale tweeling van vertrouwen.
- **Beleid als bron (organisatiecompiler).** Een beleidsregel ("terugboekingen
  boven 5.000 euro vragen twee onafhankelijke bevoegden") compileert naar
  poort, scherm, workflow, AI-permissie, toetsen, audit-control en
  monitoringregel. Verandert de directie het bedrag, dan toont het systeem
  eerst wat er geraakt wordt. Company-as-code.
- **Wet -> control -> software.** Een nieuwe verplichting wordt vastgelegd als
  toepasselijkheid -> verplichtingen -> controls -> capabilities ->
  bewijsvereisten -> toetsen -> monitoring. CONTROLS.json is het beginpunt.
- **Klantcontracten.** Dezelfde code, per klant een eigen trustcontract (geen
  AI op persoonsgegevens; alles binnen eigen regio), en per klant het levende
  antwoord "uw omgeving voldoet aan n van n vereiste controls".

## 8. AI handelt alleen binnen bewezen gebied

Geen "de agent heeft toegang tot het CRM" maar: de agent mag een handeling
alleen uitvoeren als de onderliggende capability voldoende bewezen is, het
identiteitsbewijs vers is en de handeling binnen zijn contract valt. Een
capability in VERSCHAALD of lager is voor een agent dicht, ook als hij voor
een mens nog open is. En elke agent-handeling draagt een "waarom mocht dit"
dat naar de pas van paragraaf 5 wijst. De bestaande huisregels blijven eronder
staan: de AI belooft nooit toegang, en alles wat een tweede persoon bereikt
wordt door een mens bevestigd.

## 9. De grenzen

Zoals elke wereld zijn grenzen heeft, heeft de vertrouwenslaag ze. Waar een
functie botst met een grens, vervalt de functie.

1. **Bewijs is nooit een verhaal.** Elke regel op een pas, elk antwoord op de
   universele vraag komt uit een register dat een proef zelf schreef. Wat niet
   gemeten is heet ongemeten; er bestaat geen groene verf (LAT.md regel 3 en
   12).
2. **De schuldlijst is geen dekkingsbewijs.** Wat niemand heeft bedacht staat
   er per definitie niet in; dat blijft de gevaarlijkste categorie, en dat
   staat op de lijst zelf.
3. **Degraderen is nooit stil.** Een capability die zichzelf terugtrekt
   schrijft dat in het actielog en toont het op de pas: wat, waarom, sinds
   wanneer, en wat hem heropent. Stille uitval is erger dan eerlijke uitval.
4. **Degraderen gaat naar de veiligste toestand die nog bewezen is**, nooit
   naar alles-uit als een deel gedragen blijft: gewone terugboekingen blijven
   lopen terwijl de grote dichtgaan, het vier-ogen-pad blijft open.
5. **Geld verlaat het huis nooit vanzelf** (GELD.md). Geen enkele
   vertrouwensstaat, hoe groen ook, heft die grens op.
6. **Een mens bevestigt wat een tweede persoon raakt** (LIFE.md). De
   vertrouwenslaag versnelt het klaarzetten, nooit het bevestigen.
7. **Geen schijnzekerheid door aantallen.** Diversiteit weegt; duizend keer
   dezelfde toets is een bewijs, geen duizend.
8. **Privacy by design blijft staan.** Bewijs en telemetrie draaien op
   codenamen; de vertrouwenslaag krijgt geen eigen ingang tot de kluis.
9. **Niemand zet een staat op BEWEZEN.** Alleen een hermeting. Ook Rahul niet,
   ook de keuring niet, ook een migratie niet.

## 10. Waar we staan en wat er eerst komt

Fase 0 bestaat: 4195 routes over elf schakels (46.035 cellen, waarvan 20.563
bewezen), een liegpoort die per route bewijst, registers met ratels erop
(BEWIJSMATRIX, BEWIJSSCHULD, NORM, BEREIK), een routedossier in Kantoor, en
sinds vandaag de twee normtanden van paragraaf 0. De duizenden metingen van de
OUTPUT-band zijn niet het eindproduct; ze zijn de eerste dataset waarmee deze
laag leert welke delen van een organisatie daadwerkelijk vertrouwd mogen
worden.

De volgorde daarna, klein en omkeerbaar per stap:

1. **Vervalstaten per route** -- GEBOUWD (scripts/vertrouwen.js ->
   VERTROUWEN.json): de staatmachine van paragraaf 2, berekend uit de stempels
   en uitkomsten van de bestaande registers, met toetsen die elke overgang
   maken en mutaties die aantoonbaar zakten.
2. **De vertrouwenspas** op capability-hoogte in Kantoor, als lezing bovenop
   het routedossier, met de universele vraag en de vervalvoorwaarden.
3. **De eerste zelfterugtrekkende poort** -- GEBOUWD als de schorspoort
   (server/middleware/schorspoort.js): schrijvende aanroepen op een route
   waarvan de vervalstaat GESCHORST is krijgen een 503 met de reden en de kop
   X-Vervalstaat; lezen blijft open, de poort kan alleen dichthouden en nooit
   openen, en alleen een geslaagde hermeting die het register verandert
   heropent. Sinds deze poort is een schorsing in het register GEDRAG, geen
   dashboardkleur.
4. **Slagveld vooraf** aan de hand van de bestaande koppeling route -> toets.
5. Dan pas de compiler, de wet-keten, klantcontracten en het wat-als.

Elke stap volgt LAT.md: de meter eerst zien uitslaan, een waarheid op een
plek, en de oorzaak repareren en niet het symptoom.
