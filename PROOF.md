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

## 2a. Verval per cel: de afhankelijkheden (28 september 2026)

`scripts/vertrouwen.js` rekende de ouderdom per REGISTER en zei zelf waarom:
per-route-versheid wachtte op de slagveld-koppeling van par. 7. Die ligt er nu,
in twee stappen en in deze volgorde.

**Eerst de noemer** (`npm run routenoemer`). Er liepen zeven getallen rond die
allemaal "het aantal routes" heetten, en vertrouwen per route rekenen boven
zeven noemers is bouwen op zeven werkelijkheden. `scripts/routenoemer.js` zet
per register de boom in een wegwerp-worktree op zijn eigen meetcommit, laat daar
de router zijn routes opsommen, past de definitie van het register toe en
vergelijkt. Elk verschil met HEAD is dan **leeftijd** (de route kwam er na de
meting bij), **definitie** (het register telt met opzet iets anders) of
**onverklaard**. Stand op 28 september: alle zeven reproduceren op hun eigen
commit, onverklaard 0, en nul routes verdwenen sinds enige meting.

| register | telling | definitie | meetcommit | nieuw sinds |
|---|---|---|---|---|
| router op HEAD / MUTATIEINVENTARIS | 5168 | alles wat de router kent | HEAD | 0 |
| ROUTEBRON.json | 5102 | router | 6083f652 | +66 |
| BEWIJSMATRIX.json | 4971 | router, alleen /api/ | b53eaa5e | +183 |
| VERTROUWEN.json (oud) | 4738 | router, alleen /api/ | df1a581a | +416 |
| IDEMPROEF / EXECUTION_MAP | 4972 | aangeroepen: POST /api/ zonder parameter of schakelkast | adc9db1b | +61 |
| OUTPUTPROEF.json | 4747 | waargenomen in het routejournaal | df1a581a | +420 |

Canoniek is een NOEMER PER BEGRIP en niet een getal: **bestaat** is de router op
HEAD (5168), **onder bewijs** is de router op HEAD onder /api/ (5154), en
**aanroepbaar** voor de idemproef is 5033. Het getal **5207** uit het voorstel
staat in geen enkel register. OUTPUTPROEF telt twee routes die de router in
gewone stand niet kent (`/api/test/bug` en `/api/test/crash`, alleen onder
NODE_ENV=test); dat is definitie, net als in `kern/routedekking.js`.

**Dan het verval** (`scripts/routeversheid.js`, aangesloten op `staatVan()`).
Per route, per bewezen CEL: het register dat die cel bewees (de `bron` op de
cel), de commit in diens stempel, en of er sindsdien iets is gewijzigd waar de
route van afhangt. Er komt GEEN nieuwe stand bij: een aantoonbaar verouderde
cel maakt de route `verschaald`. En drie dingen blijven strikt uit elkaar, ook
als de stand er maar een kan tonen: **defect** (een cel gezakt: `geschorst`),
**ontbrekend** (een cel nooit gemeten: `verzwakt`) en **verouderd** (een
bewezen cel over een oudere commit: `verschaald`). Elke rij in VERTROUWEN.json
draagt ze alle drie apart, en `soorten` telt ze apart -- nooit opgeteld. Een
wijziging bewijst niet dat een route fout is; alleen dat het oude bewijs niet
meer actueel genoeg is.

De koppeling draagt een **graad**, en alleen `gemeten` laat vervallen:

- **gemeten**: het bestand waarin de router de route afhandelt (ROUTEBRON.json),
  en kern-namen die de route tijdens een verzoek aanraakte (CONTEXTPROEF.json).
- **vermoed**: de statische sluiting daarachter -- requires, kern-kanten, namen
  uit de kern-tas, de montagewortel naar zijn require. Een bestand LADEN is geen
  bewijs dat de route die code RAAKT: `server/lib/keten.js` hangt statisch onder
  ruim 4100 routes. Een wijziging daar staat bij de route (`vermoedVerouderd`),
  met de keten, en laat niets vervallen. Niet gokken; de graad tonen.
- **onbekend**: geen gemeten bestand, of een meetcommit die niet vast te
  stellen is (ondiepe kloon). Dan geldt alleen de grove halfwaardetijd.

Voor elke verouderde cel is de keten uit te leggen: welk bestand veranderde ->
via welke gemeten koppeling -> welke route -> welk bewijs (cel, register,
commit) -> wat opnieuw moet draaien (uit `scripts/versheid.js`, de ene lijst
register -> opdracht).

**De proef** (`npm run vervalproef`, in een wegwerp-worktree, ~5 minuten, 10 van
10 stappen gehouden): route R (`POST /api/office/voogdij/besluit`) heeft een
bewezen, actuele AUTH-cel. Een wijziging aan het handlerbestand van een ANDERE
route laat R onaangetast, en laat die andere route wel verouderen -- anders
bewijst het negatieve geval niets. Een wijziging aan R's handler laat zijn cel
verouderen met de volledige keten. Dan draait de herdraai-opdracht UIT DIE KETEN
(`npm run meetronde -- --alleen=poortwacht`, de echte poortwacht tegen een echte
wegwerpserver), en daarna is de cel weer bewezen op de nieuwe commit. De
routestand zelf beweegt daar niet van BEWEZEN, want geen enkele route heeft
alle elf cellen bewezen; de cyclus op routeniveau staat als toets 3d met de
echte `staatVan()`.

**Wat nog niet staat** (de blinde vlekken, zie ook par. 2b):

1. De gemeten koppeling reikt meestal niet verder dan het HANDLERBESTAND. Wat
   een route daarachter aan code raakt, is voor de meeste routes alleen
   `vermoed`. Een wijziging in `kern/pay/poort.js` laat de bewijzen van de
   betaalroutes dus NIET vervallen; ze staat erbij. De stap die dat oplost is een
   runtime-meting per verzoek op BESTANDSniveau (V8-dekking per toets of per
   verzoek), in de vorm van CONTEXTPROEF maar dan met bestanden in plaats van
   namen.
2. CONTEXTPROEF.json draagt geen commit in zijn stempel, alleen een datum. Zijn
   koppelingen tellen, maar welke code hij zag is niet na te lopen.
3. Het verval kijkt naar bestanden en niet naar betekenis: een regel commentaar
   laat bewijs vervallen. Grof, en de veilige kant; per symbool
   (SYMBOLEN.json) is de fijnere stap.
4. Cellen met `verklaard` (uit de bewakers van de router) en `leesroute`
   vervallen nooit, want ze worden op HEAD afgeleid.

## 2b. De hermeting van 28 september 2026

De hele stapel bronregisters is opnieuw gemeten (`npm run meetronde`, 76
minuten; een volle suite met routejournaal voor de outputproef, 63 minuten; de
faalproef). Wat dat opleverde, in volgorde van gewicht:

**Vijf routes zouden onterecht zijn dichtgezet.** De eerste verse
staatproef zette `/api/onboarding/bedrijf`, `/api/onboarding/paspoort`,
`/api/office/dienst/uit`, `/api/office/balie/zetel` en
`/api/office/gateway/zendingen` op GEZAKT in IDEMPOTENCY, met als enige
"dubbele" wijziging `beleidsmotor` en `kantoorMensdeur`. Dat zijn tellers die
een kantoorverzoek in RAM tikken en vijf seconden later wegschrijven; de
spoeling landde in de HERHALING van de volgende route. Vastleggen had ze met een
503 dichtgezet. De staatproef kreeg een vierde ijking (naloop: een leesverzoek,
dan langer wachten dan een spoeling), en de lange stilte begint nu na een
verzoek (`rtgai` traint alleen na activiteit en zette zo `/api/pay/kascode`
vals op GEZAKT). Daarna: 0 gezakt. Gemeten en niet bij naam -- een derde
spoelende teller vindt de ijking ook.

**De auditproef laadde al drie weken niet.** `scripts/auditproef-route.js`
declareerde `stempel` twee keer (sinds 8c24cbf3), en de meetronde telde uitgang
1 als "klaar" -- 1 betekent daar een bevinding, maar een crash van Node geeft
ook 1. Elke ronde meldde "klaar (register onveranderd)". `scripts/lib/valom.js`
herkent nu een ongevangen fout, en `test/meetronde.test.js` houdt vast dat elk
instrument in de ronde laadt.

**De enige volledige keten rust op een meting van voor de passkey-eis.** De
verse idemproef kreeg op `/api/office/bank/incasso` een 403: de incassoronde
vraagt inmiddels een passkey en de proefsleutels hebben er geen. Met die meting
verloor de as `gevolg` van de gouden weg (MACHINE.md par. 5a) haar waarneming.
IDEMPROEF.json staat daarom nog op zijn meting van adc9db1b -- deels
samenvoegen zou een meting verzinnen -- en het verval per cel wijst het nu zelf
aan: `POST /api/office/bank/incasso` -> IDEMPOTENCY uit IDEMPROEF.json (adc9db1b)
-> `server/routes/kantoren/bank-incasso.js` veranderde sindsdien (gemeten) ->
`npm run meetronde -- --alleen=idemproef`. **Daardoor weigert
`vertrouwen.js --vastleggen` terecht**: een van de elf bronnen hoort niet bij
deze code. VERTROUWEN.json staat nog op zijn meting van 3 september.

**Ook de faalproef bleef op zijn oude meting.** De verse ronde zag
`/api/office/magnaat/scan` niet meer zakken, maar niet omdat de route beter
werd: onder `schrijf-verloren` staat "het verraad greep hier niet aan". De
sabotage bereikte de schrijfweg niet, en waarom is niet vastgesteld. Een verse
meting die een bekend, verklaard gebrek niet kan reproduceren, overschrijft de
meting die het wel zag niet -- dezelfde regel als bij IDEMPROEF -- dus
FAALPROEF.json staat op 14 september en HERREKENBAAR.json houdt zijn onderwerp.
(`test/herrekenbaar.test.js` zag het meteen: een besluitregister zonder gezakte
route is geheugen geworden.)

**De verdeling**, oud (VERTROUWEN.json, df1a581a, 4738 routes) tegenover vers
berekend (5154 routes):

| stand | oud | vers |
|---|---|---|
| bewezen | 0 | 0 |
| verschaald | 0 | 0 |
| verzwakt | 4716 | 5142 |
| geschorst | 0 | 0 |
| ongemeten | 22 | 12 |

Per soort, en nooit opgeteld: **defect 0** (geen enkele gezakte cel),
**ontbrekend 5154** (elke route mist minstens een schakel -- daarom kan er geen
enkele op bewezen staan, en daarom beweegt de stand niet naar verschaald: in de
rangorde gaat ontbrekend voor verouderd), **verouderd 117** (allemaal
IDEMPOTENCY uit IDEMPROEF.json), **alleen vermoed verouderd 1213**, **verval
onbekend 61** (routes die jonger zijn dan ROUTEBRON.json en dus geen gemeten
bestand hebben). Er staat met opzet geen samengesteld cijfer en geen
"systeem bewezen" onder.

**Wat hermeten verder liet zien.** De bewijsschuld groeit van 2418 naar 2712,
volledig in `output-niet-toerekenbaar` (285 -> 579): de suite zag 404 routes
meer, en de 4151 bewezen OUTPUT-cellen bleven exact gelijk. Vastgelegd met die
reden en een notitie in NORM.json (vervalt 2026-12-28). En
`test/grens-sweep.test.js` zakt op `/api/appstore/persoon/cijfers` en
`/journaal` (de server valt om) -- ook op de merge-base met main, dus niet van
deze tak.

## 2c. De vastlegging van 29 september 2026

VERTROUWEN.json is nu wel vastgelegd, op een verse meetronde, een volle suite
met routejournaal, een verse faalproef en een staatproef op een schone boom.
Oud (df1a581a, 4738 routes) tegenover vastgelegd (5273 routes): bewezen 0 -> 0,
verschaald 0 -> 0, verzwakt 4716 -> 5258, geschorst 0 -> 0, ongemeten 22 -> 15.
Elke verzwakte route mist minstens een schakel; FAILURE (5178), STATE en
SIDE_EFFECT (elk 4767) en AUDIT (4146) ontbreken het vaakst.

**Vijf routes waren geschorst, en geen ervan terecht op dezelfde manier.**
`bedrijf/werkruimte/maak` was een echte regressie: een retry met dezelfde
sleutel maakte een tweede werkruimte, en krijgt nu 409 zonder token.
`rtmail/imap/sleutel` (lid en zaak) geeft met opzet elke keer een verse
sleutel en staat als `code-maker` in IDEMBESLUIT.json. `office/doos/sleutel`
laat na een weigering met opzet een melding op het beveiligingsbord staan
(`veilige-kant` in ROLLBACKBESLUIT.json). En `rtfos/vrijwilliger/account-los`
werd geschorst op een eenmalige inrichting naast een deurteller -- de
staatproef past de eerste-aanrakingsregel nu per collectie toe.

**Drie meetfouten, gevonden doordat een getal niet klopte.** De staatproef
berekende de voorwaardelijke klokruis en paste hem niet toe (de aanroep viel
weg bij #95). De meetronde gaf de rol- en invoerproef een begrenzing van 8000
POGINGEN terwijl de router er 8832 vraagt, zodat de laatste 108 routes in het
alfabet stil buiten de ronde vielen. En de outputproef schreef zijn register
op een journaal van een handvol losse toetsen terug van 5151 naar 420 routes;
een journaal dat minder dan de helft van de vorige ronde dekt, wordt nu
geweigerd.

**Wat de besluiten de machine kosten.** `mutatiesZonderEnigeAs` gaat van 2757
naar 2758. De as `herhaling` komt uit EXECUTION_MAP.json en telt alleen
`beschermd`; de vier `code-maker`-besluiten van deze ronde (`rtmail/imap/sleutel`
twee keer, `bedrijf/lid/aanmeld`, `bedrijf/mijn`) halen die as daar met opzet
weg, want een route die elke keer iets nieuws hoort te geven is niet beschermd
tegen een herhaling. Andere routes kregen hem er in dezelfde ronde bij; per
saldo is het een. De weg omlaag is niet de besluiten terugdraaien maar die
routes een andere as geven (een spoor of een gevolgmeting). De uitleg staat hier
en niet in NORM.json omdat MACHINEDEKKING.json bij elke vastlegging in zijn
geheel wordt herschreven, zoals in POLITIEK.md voor de kwestieroutes.

**Na de merge met main** (#415) zijn de proefregisters formeel weer verouderd:
ze zijn op de code van voor die merge gemeten. VERTROUWEN.json blijft op de
vastlegging hierboven staan tot een volgende meetronde.

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
