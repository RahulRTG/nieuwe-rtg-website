# RTG Execution Plane

> **Regels, algoritmen, optimizers, voorspellers, mensen en AI mogen allemaal
> intentie of voorstellen leveren; uitsluitend de execution plane mag effecten
> veroorzaken. Iedere uitvoering wordt vooraf beperkt door bewijs, bevoegdheid,
> risico, mandaat en context, en achteraf bevestigd door een gemeten uitkomst.**

Dit document staat naast `FABRIC.md` en één laag algemener. `FABRIC.md` gaat
over de AI-helft: hoe een doel dat iemand uitspreekt een handeling wordt.
Dit gaat over de laag waar die handeling in landt — en die laag hoort niet van
de AI te zijn. Een menselijk scherm, een automatisering, de commandbalk, een
externe API-aanroep en een geplande taak stellen dezelfde vraag ("mag dit nu,
en met hoeveel frictie?") en horen daar één antwoord op te krijgen.

Het is een richtingsdocument, geen toezegging. Alles hieronder staat in vier
bakken — **staat**, **een stap weg**, **een besluit nodig**, **jaren weg** —
zoals in `OS.md` en `DEVELOPERCLOUD.md`, zodat niemand ze voor elkaar aanziet.
Wat in de laatste twee bakken staat, hoort nergens als knop op een scherm.

---

## 0. Waarom dit document er is, en waarom het geen bouwvoorstel opent

De aanleiding was een voorstel om een veilige AI-executielaag te ontwerpen. Dat
voorstel bleek de verkeerde vraag te stellen. Het probleem van dit huis is niet
dat zo'n laag ontbreekt.

> Dit huis heeft **meerdere volwassen executiemechanismen die nog niet als één
> platformwaarheid functioneren.**

Dat is beter nieuws en architectonisch gevaarlijker tegelijk. Beter, omdat de
moeilijke onderdelen — voorcontrole, verificatie, terugdraaien, simulatie,
zandbak, risicoweging, actiebewijs — er al zijn en draaien. Gevaarlijker, omdat
twee correcte systemen samen alsnog een verkeerd platform vormen zodra ze
dezelfde werkelijkheid verschillend modelleren. Dat is precies de klasse die
`SEMANTIEK.json` hier meet: 111 namen staan in meer dan één domein en 94 daarvan
dragen meer dan één betekenis, samen 344 betekenissen (stand van het register bij
het schrijven van dit document; `CLAUDE.md` noemt de oudere ronde van 96/78).

De eerste opdracht van deze laag is daarom **semantische consolidatie en geen
featurewerk.** Wat er bij moet komen is één begrip PLAN; wat er weg moet is een
tweede antwoord op een vraag die al beantwoord wordt.

---

## 1. De dubbele waarheid die dit document opent

Vandaag beantwoorden twee bestanden dezelfde vraag — hoeveel autonomie of
frictie verdient deze handeling — en ze doen het verschillend.

**`server/kern/command/risico.js`** rekent het per geval uit, op drie niveaus:

| niveau | betekenis |
|---|---|
| `hand` | een mens doet het zelf |
| `assist` | de machine bereidt voor, een mens drukt af |
| `auto` | de machine doet het volledig, binnen beleid |

Met de ontwerpregel er letterlijk bij: *welk niveau geldt is geen eigenschap van
de knop maar van de handeling plus zijn omstandigheden* — dezelfde handeling mag
autonoom bij € 12 en nooit autonoom bij € 120.000. En elke score draagt zijn
opbouw, want *een cijfer zonder opbouw is een orakel, en een orakel kun je niet
tegenspreken.*

**`server/kern/stuur/beleid.js`** beantwoordt naast hem dezelfde vraag binair:
21 patronen `direct` (lezen, klein, omkeerbaar) tegenover 27 patronen `voorstel`
(wijzigt, deelt, boekt, beweegt geld), vast per route, ongeacht bedrag,
omkeerbaarheid of wie het raakt.

**En het zijn er niet twee maar vijf.** Dat bleek bij het bouwen van blok 2, en
het corrigeert de eerste versie van dit document. `scripts/gezag.js` houdt al een
register bij van **vijf gezagsvocabulaires** die elk de vraag "mag de machine dit
zelf?" met eigen woorden beantwoorden — de twee hierboven plus
`geldbeleid/regels.js` (kijken/voorstellen/klaarzetten/automatisch),
`stadsweefsel/ainiveau.js` (waarnemen/adviseren/voorbereiden/begrensd/verboden)
en `bureau/delegatie.js` (informeren/aanbevelen/voorbereiden/uitvoeren/autonoom),
plus 22 losse niveaunamen die als kale tekenreeks in andere modules staan. Het
register zegt er zelf bij wat het niet kan: *geen mens en geen machine kan ze
naast elkaar leggen*, en een afbeelding maken is een **besluit** en geen
afleiding.

**En ze botsen vandaag nergens.** Ook dat is gemeten: van de 120 (member), 40
(supplier) en 16 (staff) AI-bedienbare paden is er **geen enkele** een
Command-route, en er is geen geldbeleid-route bij. De vijf schalen delen op dit
moment dus geen enkele concrete handeling. Dat is geen geruststelling maar een
tijdvenster: het moment dat één Command-route AI-bedienbaar wordt — en PLAN
(blok 3) heeft dat nodig — verschijnen er twee antwoorden op dezelfde vraag en is
er geen manier om ze naast elkaar te leggen.

Daarom is de richting niet "verhuis het ene naar het andere" maar:

> **Er bestaat in RTG precies één antwoord op de vraag welke frictie déze
> concrete handeling nú vereist.** Cockpit, AI, commandbalk, klassieke UI en
> automatisering maken daar verschillende presentaties van, maar rekenen niet
> zelf opnieuw.

De uitslag van die ene motor draagt zijn opbouw mee:

```
niveau: assist
reden:
  externe verplichting
  184 euro
  omkeerbaar
  bekende leverancier
  mens geraakt: nee
```

De UI maakt daarvan "Bevestigen", de cockpit `ASSIST`, het stuur "menselijke
bevestiging vereist". De beslissing komt één keer tot stand.

---

## 2. Wat er al staat, en dat is meer dan de helft

Dit hoofdstuk staat vooraan omdat de verleiding is om naast bestaand werk te
bouwen (`LAT.md` regel 4). Vijf van de zeven "grote sprongen" uit het voorstel
zijn hier gebouwd — alleen voor de ops-cockpit, niet gedeeld met het stuur.

| Bouwsteen | Waar | Wat het al doet | Voor wie gebouwd |
|---|---|---|---|
| Eén uitvoeringspad | `kern/stuur.js` | Elke AI-actie is een interne aanroep over de gewone API met de inlog van de gebruiker. De AI kan nooit meer dan de persoon die hem iets vraagt. | AI |
| Expliciete blootstelling | `kern/stuur/beleid.js` | Een nieuwe route is nooit automatisch AI-bedienbaar. | AI |
| Menselijke goedkeuring | `kern/stuur/goedkeuring.js` | Eenmalig, sessiegebonden servervoorstel met exact pad en body; het interne akkoord is een `Symbol` en niet uit JSON te maken. | AI |
| Bewijspoort | `beleid.js` + `lib/vervalstaat.js` | Een `geschorste` capability valt uit `toegestanePaden`. | AI |
| Vangnet eronder | `middleware/schorspoort.js` | Schrijvende aanroep op een geschorste route: 503 met reden. Lezen blijft open. | iedereen |
| Actiebewijs | `kern/stuur/bon.js` | Wat, waarom het mocht, de gemeten bewijsstand, de uitkomst — en wat er **niet** gemeten is. | AI |
| **Risicomotor** | `kern/command/risico.js` | `hand`/`assist`/`auto`, per geval berekend, met de opbouw van de score. | cockpit |
| **Voor- en nacontrole** | `kern/command/transactie-poorten.js` | *Een controle die niet kon draaien is niet geslaagd*, en de verificatie kijkt **positief** na: *"geen fout gezien" is geen uitslag.* | herstel |
| **Transactie met terugweg** | `kern/command/transactie.js` | VOORCONTROLE → MOMENTOPNAME → UITVOEREN → VERIFICATIE → VASTLEGGEN, bij mislukte verificatie automatisch TERUG. | herstel |
| **Zandbak** | `kern/command/zandbak.js` | Doorwerken zonder één productierij: gegevens uit de zaaiset, en er schrijft niets terug door de bouw en niet door een filter. | procesproef |
| **Simulatie** | `kern/command/simulatie.js` | Wat-als met de aannames in de uitslag: *een voorspelling zonder aannames is een mening met cijfers eromheen.* | cockpit |
| Sterke bevestiging | `kern/webauthn-stapop.js` | Passkey-ceremonie met een **doel**-veld, gebonden aan déze handeling en dit account. | betalen |
| Ketenspoor | `kern/envelop.js` | Acht velden met `correlatie` (de hele keten) en `oorzaak` (wat dit veroorzaakte). Actor is een codenaam. | de bus |
| Idempotentie | `middleware/idempotentie.js` | Eén sleutel, één uitvoering, hetzelfde antwoord. | iedereen |
| Modeluitwijk | `server/ai.js` | Lokaal → Claude → OpenAI → Gemini met automatische overstap; `RTG_EXTERNE_AI_UIT=1` sluit extern hard af. | AI |
| Kostenremmen | `ai-meter.js`, `ai-rem.js`, `ai-budget.js` | Huisbudget per dag, aanroepen per minuut per IP, budget per persoon op `sess.key`. | AI |

Wat er dus **niet** nog een keer gebouwd wordt: een tweede frictiemotor, een
vijfde capabilitygraaf, een AI-eigen rechtenmodel, een tweede routelijst.

---

## 3. De vier echte gaten

1. **PLAN als object.** Vandaag draait de AI een tool-lus (`kern/stuur/lus.js`)
   met twee gereedschappen en een stappenbudget van 4 (licht) of 24 (zwaar),
   bepaald door `classificeer()` in `kern/stuur.js`. Er is geen keten van
   handelingen die als één bestuurbaar object te tonen, te wegen, te simuleren
   of in één keer te weigeren is.
2. **De capability-compiler.** De bronnen bestaan allemaal; niemand voegt ze
   samen tot één projectie.
3. **Mandaat.** Nul. Er is geen enkele plek waar staat wat een agent zelfstandig
   mag, en dus ook niets dat het afdwingt.
4. **De optimizer zelf.** `kern/agent.js` maakt roostervoorstellen op
   weekdagfactoren — een heuristiek, geen constraint solver. Een intelligence
   router zou vandaag naar een optimizer routeren die niet bestaat. Dat is nieuw
   werk en geen routeringswerk.

---

## 4. De grenzen (hier vervalt de functie, niet de grens)

De tien grenzen van `FABRIC.md` par. 5 gelden onverkort. Deze laag voegt er zes
toe, en alle zes komen uit een besluit dat dit huis al genomen heeft.

1. **Een modeluitkomst veroorzaakt nooit rechtstreeks een effect.** Alles loopt
   via een benoemde, door beleid begrensde capability buiten het modelproces.
   Dit is vandaag waar en er staat een aanvalstoets op (`test/stuur-aanval.test.js`:
   promptinjectie kan zichzelf niet goedkeuren), maar een toets toont aan dat
   het huidige pad veilig is en een regel eist dat elk toekomstig pad dat is.
   Zie par. 8.
2. **Een mandaat verleent nooit vermogen; het kan alleen bestaand, bewezen
   vermogen verder beperken.** De speelruimte is een doorsnede en geen optelsom:
   `bewezen capability ∩ beleid ∩ huidige risico-uitkomst ∩ context ∩ mandaat`.
   Een mandaat dat iets toevoegt is een tweede rechtenmodel.
3. **Een mandaat overschrijft geen consent, geen gegevenspoort en geen
   geldregel.** "Nooit medische gegevens" is al de waarheid van
   `kern/consent-register.js`; een mandaat dat dat herhaalt, is de tweede plek
   waar het staat en dus de plek waar het een keer anders komt te staan.
4. **Voorbereiden, verplichten en betalen zijn drie gebeurtenissen.** Ze zien er
   als knop uit als één handeling ("bestel dit"), maar `GELD.md` staat erboven:
   geld verlaat het huis nooit vanzelf, en geen autonomiegrens heft dat op. Een
   mandaat kan dus wél autonoom een bestelling laten voorbereiden en zelfs een
   verplichting laten aangaan binnen een grens, en nooit de betaling doen.
5. **Onbekende uitvoeringssemantiek krijgt nooit maximale autonomie.** Een
   capability waarvan `HERHALING` of `HERSTEL` `onbekend` is, kan niet
   transactioneel autonoom zijn — runtime, niet als administratieve schuld. Let
   op wat dat vandaag betekent (par. 5): deze regel zet nu alles op het minimum
   en hoort daarom eerst in de schaduw te lopen (`CONTROLPLANE.md`,
   `schaduw.js`).
6. **De executiekaart is een projectie en nooit een bron.** Wie hem met de hand
   kan bijwerken, heeft de 22e capabilitylijst gemaakt.

---

## 5. Wat de metingen zeggen, en waarom dat de volgorde bepaalt

Twee registers dragen de hele redenering van dit document. Ze zijn opgezocht en
niet aangenomen.

**De bewijsstand** (`VERTROUWEN.json`, 4185 routes):

| staat | aantal |
|---|---|
| bewezen | **<!--getal:vertrouwen.bewezen-->0<!--/getal-->** |
| verschaald | 0 |
| verzwakt | <!--getal:vertrouwen.routes-->4180<!--/getal--> |
| geschorst | **<!--getal:vertrouwen.geschorst-->0<!--/getal-->** |
| ongemeten | 5 |

Daar volgen twee dingen uit die niet in een roadmap horen te ontbreken.

**De bewijspoort houdt vandaag niets tegen.** Alleen `geschorst` sluit, en dat
staat op nul. Dat is geen fout — `FABRIC.md` par. 3.3 legt uit waarom `verzwakt`
niet sluit: dat draagt vrijwel elke route, en daarop sluiten zet de hele laag
dicht, en dat is de vorm van veiligheid die mensen uitzetten. Maar het betekent
dat proof-aware routing vandaag een mechanisme is en nog geen selectie. De
selectiviteit moet uit de meting komen, niet uit de poort.

**En grens 5 zet vandaag alles op het minimum.** Nul routes zijn bewezen. Wie
"onbekend verlaagt autonomie" runtime invoert vóórdat de bewijsschuld krimpt,
krijgt geen voorzichtig systeem maar een systeem waarin autonomie nergens
bestaat. Daarom: eerst schaduw, dan tanden.

**De herhalingsstand** (`IDEMPROEF.json`):

| | aantal |
|---|---|
| routes met een rol | <!--getal:idem.routesMetRol-->3815<!--/getal--> |
| beoordeeld | <!--getal:idem.beoordeeld-->1617<!--/getal--> |
| beschermd | <!--getal:idem.beschermd-->1615<!--/getal--> |
| onbeschermd | **<!--getal:idem.onbeschermd-->2<!--/getal-->** |
| ongemeten | <!--getal:idem.ongemeten-->3038<!--/getal--> |

Dit staat er beter voor dan `CLAUDE.md` beweert (dat noemt nog 115 gemeten; dat
cijfer is verouderd). Van alles wat beoordeeld is, is niets onbeschermd. De
vier-waardige eigenschap `HERHALING` heeft dus al inhoud in echte data; wat
ontbreekt is dekking, niet de classificatie.

**De schuld zelf** (`BEWIJSSCHULD.json`): 14 posten, 57 stuks meetwerk, 932
instrument, 608 grens. Met de waarschuwing die er zelf op staat: *een
schuldenlijst is geen dekkingsbewijs* — wat niemand heeft bedacht, staat er per
definitie niet in.

---

## 6. De negen blokken, met hun stand

### Blok 0 — Capability resolver · **GEBOUWD**

`server/kern/stuur/resolver.js` (de weging) met `stuur/resolver-woorden.js`
(de taalkant), aangehaakt op de tool `kaart` in `stuur/lus.js`. Een deterministische voorselectie vóór het model: per opdracht
de paden die de vraag raken, in plaats van alles wat de rol mag.

**Het succescriterium is dekking, niet compactheid.** Dat is de belangrijkste
regel van dit blok en hij staat expres vóór de cijfers:

> **Liever veertien relevante paden dan drie waarvan de juiste ontbreekt.**

Compactheid is een kostenpost; dekking is de veiligheid. Een gemist vermogen
laat de AI "dat kan ik niet" zeggen over iets dat de gebruiker gewoon mag — een
leugen met een technische oorzaak, en van buiten niet te zien. Daarom zijn er
**twee meters** (`npm run resolver`) en met opzet geen samengesteld cijfer:

| meter | vraag | stand |
|---|---|---|
| versmalling | hoeveel kleiner werd de toolruimte? | **89% kleiner**, gemiddeld werkveld 8,8 paden |
| **dekking** | bleef het gevraagde vermogen erin? | **100%** (23 van 23 zinnen met een eis) |

Eén cijfer zou de tweede door de eerste laten opeten: strenger filteren maakt de
versmalling altijd mooier en de dekking altijd slechter. Het script eindigt met
een foutcode zodra de dekking onder de 100% komt — een meter die alleen praat,
verandert niets.

**Negen taalvormen, per vorm gemeten** (`scripts/resolver-corpus.js`, 27 zinnen
over drie rollen): gewoon, synoniem, scheidbaar werkwoord, domeinjargon,
spelfout, samengestelde opdracht, impliciete intentie, negatie, en
promptinjectie waarin een routepad wordt genoemd. Per vorm apart, want
"gemiddeld 96%" verbergt precies de categorie waar het misgaat.

**En omdat "wie de vragen kiest, kiest het resultaat" een echte zwakte is, is er
een tweede meter die het omdraait** (`npm run resolverbereik`,
`RESOLVERBEREIK.json`). Die schrijft geen zinnen maar GENEREERT er een voor élk
pad dat een rol mag bedienen — 176 vandaag — in zeven vervormingen, en eist dat
het pad in het werkveld overleeft. **1232 gegenereerde proeven, dekking 100% op
alle zeven.** Het corpus groeit mee met het platform: een nieuwe route brengt
zijn eigen proef mee, en niemand kan er een toevoegen die onvindbaar is zonder
dat de toets zakt.

| vervorming | wat hij raakt | versmald | werkveld |
|---|---|---|---|
| eigen woorden | de weging (zwakste: de zin komt uit het pad zelf) | 100% | 10,7 |
| mensenwoorden | de omgekeerde bruggen (`ride` → "taxi") | 100% | 10,8 |
| **alleen domein** | **de afkapgrens** | 28% | 65,6 |
| alleen werkwoord | de dunne-bewijsregel | 94% | 7,4 |
| **typefout** | **de dunne-bewijsregel** | 14% | 80,2 |
| omgekeerd | woordvolgorde | 100% | 10,8 |
| veel ruis | het verzoek verstopt in beleefdheid | 94% | 12,8 |

**Wat hij meteen vond:** op "alleen domein" zakte de dekking naar **90%** — 17
verborgen vermogens. Niet door de weging maar door de **afkapgrens van vijftien,
die midden in een gelijke score sneed**. Dertig bankpaden scoren even hard op het
woord "bank"; de helft viel op alfabet af, dus `/api/bank/pas/betaal` verdween
terwijl `/api/bank/advies` bleef. Sindsdien gaat alles wat gelijk staat aan de
laatste mee: **een gelijke score afkappen is willekeur, en willekeur is hier de
ergste faalvorm — hij verbergt een vermogen zonder dat iemand het merkt.** Kosten:
88% versmalling in plaats van 89%.

Wat ook déze meter niet meet: of het model met dat werkveld de júiste keuze
maakt, en of echte gebruikers zo typen. De zwakste vervorming zegt dat zelf: een
zin gebouwd uit de woorden van het pad en dan gewogen tegen diezelfde woorden is
deels een identiteitstest. Daarom staat er per vorm bij hoe sterk het bewijs is,
en zijn "mensenwoorden" en "typefout" de vormen die tellen.

**Dit verandert geen autoriteit.** De resolver krijgt de lijst die `beleid.js`
al heeft goedgekeurd en filtert die array; hij kan structureel niets toevoegen.
Dat is de eerste toets in `test/stuur-resolver.test.js` en niet een belofte in
tekst: wat eruit komt is altijd een deelverzameling van wat erin ging, ook bij
een vraag die zelf een pad noemt.

**De woordenschat komt uit de paden zelf.** Een tabel "bestellen →
`/api/supplier/agent/voorstel`" zou een tweede routelijst zijn en binnen een
maand achterlopen (`LAT.md` regel 4; `check.js` regel 56 telt eigen routelijsten
om precies die reden). De segmenten van een pad zijn de woorden. Een nieuwe
route doet het dus meteen mee — toets 10 bewijst dat met een pad dat niemand
ooit heeft voorzien.

**Drie dingen gingen echt mis tijdens het bouwen, en ze staan nu vast:**

- *"Maak 200 euro over"* koos `/api/meet/maak` en miste `/api/bank/overboek` —
  een scheidbaar werkwoord, waarvan de delen los in de zin staan en waarvan
  `over` bovendien een stopwoord is.
- *"Boek een tafel"* leverde alleen `/api/reservering/annuleer` op. Dat is de
  gevaarlijkste faalvorm van deze hele laag: **een versmalling die precies het
  gevraagde vermogen verbergt.** Daarom mag een menselijk woord meer dan één
  brug hebben, en daarom kan het model de versmalling altijd overslaan
  (`kaart` met `alles: true`). Een fout in deze weging mag nooit een vermogen
  verbergen dat de gebruiker gewoon heeft.
- *"Hoe gaat het met mijn zaak"* versmalde naar vijftien paden op alfabet. De
  brug `zaak → supplier` raakte élk pad van die rol even hard, en dan is de
  uitslag geen selectie maar een greep. De oorzaak zat in een opsomming
  (`api`, `member`, `staff` gelden niet mee) waar `supplier` toevallig niet in
  stond. Dat is nu **geteld in plaats van opgesomd**: een segment dat in álle
  paden van de lijst staat, draagt geen informatie en telt niet mee. Een lijst
  die morgen een vierde rolvoorvoegsel krijgt, doet het meteen goed.

**En de dekkingsmeter vond er meteen nog drie**, alle drie van dezelfde soort —
een versmalling die het gevraagde vermogen wegfiltert:

- *"Stuur de btw-herinnering"* koos `/rtmail/stuur` en liet `/rtmail/btw-herinner`
  weg: `btw-herinner` is voor een mens twee woorden en voor een pad één.
  Segmenten worden nu ook op het koppelteken gesplitst.
- *"Ik moet inchecken voor mijn dienst"* koos `/ov/dienst` en miste `/ov/checkin`
  — jargon dat als één woord wordt geschreven.
- *"Zet een afsrpaak in mijn agneda"* (twee typefouten) versmalde naar één pad:
  `/api/bank/terugkerend/zet`, dat met de vraag niets te maken heeft. Van de
  drie inhoudswoorden raakte alleen het werkwoord iets. Daaruit volgt de regel
  **dun bewijs is geen bewijs**: raakt maar één woord iets terwijl de vraag er
  drie of meer draagt, dan gaat de volledige lijst terug. Dat kostte twee
  procentpunt versmalling (91% → 89%) en bracht de dekking van 87% naar 100%.

Die regels dekken elkaar bovendien af, en dat is meetbaar: haal de
koppelteken-splitsing weg en de dekking blijft 100% doordat de dunne-bewijsregel
de zin opvangt — alleen het werkveld wordt groter (8,8 → 9,1). Alleen de
versmallingsmeter ziet dat, en dat is precies de taakverdeling tussen de twee.

**De bruggen hebben tanden.** Toets 9 controleert dat elk doelwoord ook echt als
segment in de routes voorkomt. Hij sloeg meteen aan: `taxi → rit` wees nergens
heen, want die routes heten `ride`. Dat is dezelfde fout als de cap `rooms` die
een document noemde en die niet bestond.

**Wat hij niet kan, en dat staat er eerlijk bij:** samenstellingen. "Zoek een
hotelkamer" wordt niet versmald, omdat `hotelkamer` als één woord geen segment
raakt. De uitkomst is dan de volledige lijst met de reden erbij — nooit een leeg
werkveld, want dat zou het model laten zeggen "dat kan ik niet", en dat is een
leugen over wat de gebruiker mag.

### Blok 1 — Capability-compiler · **GEBOUWD**

Eén generator die uit bestaande bronnen `EXECUTION_MAP.json` samenstelt: code,
`stuur/beleid.js`, `VERTROUWEN.json`, `IDEMPROEF.json`, de risicoregels, de
kostenlaag, de bekende tegenhangers. Niemand schrijft hem met de hand.

Het besluit dat eronder ligt is niet óf hij er komt, maar hoe hard hij wordt
gehandhaafd. De eis is drieledig, en alle drie horen ze in `scripts/check.js`:

- het bestand met de hand wijzigen → **rood**;
- generatoruitvoer veranderd zonder bronwijziging → **rood**;
- twee bronnen die tegengestelde eigenschappen leveren → **`ONBEPAALD`**, nooit
  stil een winnaar.

En elk afgeleid veld draagt zijn herkomst in de bouwdataset (`waarde`, `bron`,
`afgeleid`), zodat bij een conflict letterlijk te zien is waarom de compiler dit
denkt. Een veld dat uit géén bron komt is óók `ONBEPAALD` met de reden, nooit
een default — dezelfde regel die `KOSTEN.md` hard maakt ("geen tarief is een
REDEN, geen nul") en die `bon.js` al toepast met zijn `nietGemeten`-blok.

De eigenschappen die de kaart per capability zou moeten dragen: identiteit,
bereikbaarheid, bewijs, risico, omkeerbaarheid, impact, waarde, frictie,
herhaling, kosten, mandateerbaarheid, simuleerbaarheid, herstel, verval. Zoveel
mogelijk afgeleid, en wat niet afgeleid kan worden staat als `ONBEPAALD`.

**Wat er staat** (`scripts/executionmap.js`, `EXECUTION_MAP.json`, 933 KB):
**3282 routes**, waarvan **176 (rol, route)-paren** die de AI mag bedienen. Vier
veldsoorten worden afgeleid — bereikbaarheid uit `beleid.js`, de gezagstrede uit
de noemer, het bewijs uit `VERTROUWEN.json`, de herhaalbaarheid uit
`IDEMPROEF.json`. Drie staan er als **`ONBEPAALD` met de reden**: risico (dat
rekent `command/risico.js` per gevál uit bedrag en aantal — statisch bestaat het
niet), herstel (geen register kent de tegenhanger van een route) en kosten
(`KOSTEN.md` meet verbruik per aanroep, niet per route). Een kaart die die drie
invult omdat de kolom bestaat, verzint ze.

**De herkomst staat per veldsoort en niet per rij**, en dat is geen bezuiniging
op de waarheid: dát elke `bewijs`-waarde uit `VERTROUWEN.json` komt is een
eigenschap van het veld, niet van de route. Per rij herhalen kostte 6,7 MB en
voegde geen enkel feit toe. Wat wél per rij hoort — een afwijkende reden, elke
`ONBEPAALD` — staat per rij.

**De drie handhavingen die de eigenaar eiste, staan en zakken alle drie:**

| eis | hoe |
|---|---|
| met de hand gewijzigd → rood | de kaart moet byte voor byte gelijk zijn aan de hercompilatie |
| generator gewijzigd zonder bronwijziging → rood | dezelfde toets vangt dat: een projectie die verandert zonder dat de bron veranderde, is er geen |
| twee bronnen oneens → `ONBEPAALD` | nooit stil een winnaar, en de toets rekent het na uit de bron zelf |

Elke bron draagt bovendien zijn **vingerafdruk** in de kaart, en de toets
controleert dat die klopt met het bestand — anders is "ongewijzigd" een bewering
in plaats van een meting.

**En de derde eis bleek meteen nodig.** `IDEMPROEF.json` bevat 86 keer dezelfde
route+rol twee keer, en in **28 gevallen met een tegengesteld oordeel**:
`beschermd` naast `ongemeten` voor precies hetzelfde pad. Een compiler die de
laatste regel laat winnen, zet daar een hard antwoord neer dat niemand heeft
vastgesteld — en dat antwoord zou vervolgens door PLAN gebruikt worden om te
beslissen of een stap veilig te herhalen is. Ze staan nu als `ONBEPAALD` met
beide waarden erbij. **Dat is geen gebrek van de kaart maar een vondst in de
bron**, en hij hoort in blok 5 te worden opgelost, niet hier weggepoetst.

### Blok 2 — Eén risicosemantiek · **de noemer STAAT, het besluit erover niet**

De eerste opzet van dit blok was "`kern/command/risico.js` naar de kern, cockpit
en stuur lezen eruit". Die opzet is bij het bouwen gesneuveld, en om een goede
reden: er zijn vijf schalen en geen twee, ze raken vandaag geen gemeenschappelijke
handeling, en een 3-tredige schaal op een andere 3-tredige schaal afbeelden is
precies het "afbeelden zonder besluit" waar `scripts/gezag.js` voor waarschuwt.
Een migratie van een draaiende ops-laag zou dus risico hebben genomen om een
probleem op te lossen dat vandaag niet bestaat, op een manier die de echte vraag
overslaat.

**Wat er wél gebouwd is: de gedeelde noemer** (`scripts/gezagsnoemer.js`,
`GEZAGSNOEMER.json`, `npm run gezagsnoemer`). Vier treden waarin alle vijf schalen
worden verklaard:

| trede | wat |
|---|---|
| `geen` | de handeling bestaat niet voor de machine |
| `tonen` | de machine leest, rekent of adviseert en verandert niets |
| `klaarzetten` | de machine stelt samen; een mens bevestigt |
| `uitvoeren` | de machine voert uit, binnen beleid |

Twintig treden verklaard: **16 evident** (met een citaat uit de bron, en de toets
controleert dat die zin er letterlijk staat), **3 aangenomen** en **1 onbepaald**.
Die vier zijn de opbrengst, niet de bijvangst — het zijn de besluiten die de
eigenaar moet nemen vóór PLAN twee schalen in één keten mengt:

1. `geldbeleid/regels.js :: voorstellen` — is een voorstel aan een lid al
   klaarzetten, of pas tonen? Die schaal kent beide woorden náást elkaar, dus daar
   is het verschil bedoeld; de noemer heeft er een trede minder.
2. `stadsweefsel/ainiveau.js :: begrensd` — begrensd en onbegrensd uitvoeren
   vallen in de noemer samen. Is de grens zelf een trede, of een eigenschap van de
   uitvoering?
3. `bureau/delegatie.js :: autonoom` — die schaal onderscheidt *uitvoeren* van
   *autonoom* (zonder opdracht per geval). Dat onderscheid valt weg.
4. `stuur/beleid.js :: direct` — **onbepaald**, en dit is de scherpste. De bron
   zegt "uitsluitend lezen **óf** een kleine, omkeerbare handeling zonder externe
   gevolgen". Dat zijn twee noemertreden in één trede: `direct` dekt zowel `tonen`
   als `uitvoeren`. Eén woord in de AI-allowlist betekent dus vandaag twee
   verschillende dingen over wat de machine zelfstandig doet.

**Het is een meetlaag en geen beslisser**, en dat is afgedwongen: hij woont in
`scripts/`, en toets 7 zakt zodra iets uit `server/` hem importeert — want dan is
hij de zesde gezagsschaal in plaats van de laag eroverheen, en dat is precies wat
de ratel in `scripts/gezag.js` tegenhoudt. Hij gebruikt ook het woord `niveau`
niet, zodat de teller van dat huis niet vervuilt door dit huis.

De toets is fail-closed tegenover het bestaande register: elke schaal en elke
trede uit `scripts/gezag.js` móét een verklaring hebben (een zesde schaal kan er
niet stil bij komen), de projectie mag nooit verruimen (wat "een mens doet het
zelf" zegt kan niet op `uitvoeren` uitkomen), en een `evident` citaat dat niet
letterlijk in de bron staat laat de bouw zakken — wat meteen gebeurde bij het
eerste citaat dat over een regeleinde liep.

**De vier besluiten zijn genomen** (31 augustus 2026), en drie ervan bleken
dezelfde vorm te hebben: *wat de machine mag* is één vraag, *hoe ver hij mag
gaan* is een tweede.

| open punt | besluit |
|---|---|
| `direct` (onbepaald) | **splitsen** in `lezen` en `klein` — uitgevoerd in code |
| `autonoom` | geen vijfde trede: "zonder opdracht per geval" is een eigenschap van het **mandaat** |
| `begrensd` | geen eigen trede: de grens is een eigenschap van de **uitvoering** en hoort in het beleid |
| `voorstellen` | valt op `tonen` — `klaarzetten` houdt zijn harde betekenis: er staat iets dat met één bevestiging wordt uitgevoerd |

De noemer staat daarmee op **21 treden: 18 evident, 3 besloten, 0 open**. Een
`besloten` verklaring draagt de reden die de eigenaar gaf, en de toets zakt als
die reden ontbreekt — anders is het een aanname met een ander etiket.

**De splitsing zelf legde vijf routes bloot die niet lazen.** `/api/mediaos/stuur`
en `/volg` (zetten smaak en volgen), `/api/leerstof/oefen` en `/antwoord`
(schrijven de oefenstand) en `/api/bijles/vraag` (roept een model aan en kost
geld) stonden in de lijst die "uitsluitend lezen of een kleine handeling" heette.
Ze staan nu onder `klein`. De splitsing **verplaatst geen bevoegdheid** — `lezen`
en `klein` samen zijn exact de oude `direct`-lijst, en dat is toets 1 van
`test/stuur-niveaus.test.js`, met de oude lijst er letterlijk in overgeschreven
zodat de code niet met zichzelf wordt vergeleken. Vier mutaties bijten, waaronder
de gevaarlijkste: een `voorstel`-route naar `klein` verplaatsen, waardoor een
menselijke bevestiging stilletjes verdwijnt.

**Wat er hierna nog moet:** één motor. De verhuizing van `risico.js` blijft de
juiste eindtoestand; hij was alleen niet de eerste stap.

### Blok 3 — PLAN als protocol · **GEBOUWD**

De architectuursprong. En het ontwerp ervan is streng:

> **PLAN bezit niets.** Geen risico, geen rechten, geen bewijs, geen kosten.

Een planstap draagt alleen:

```
stap
  capability
  invoer
  afhankelijk_van
  gewenste_uitkomst
```

De rest wordt aangevuld door de motoren die er al zijn: de resolver zegt of het
bestaat, de bewijslaag of het bewezen is, de risicomotor welke frictie,
`beleid.js` of het mag, `transactie.js` hoe uit te voeren en te herstellen, de
simulatie wat we verwachten, het mandaat of een agent het autonoom mag. Zo wordt
PLAN een **compositor van bestaande zekerheden** en niet het volgende megadomein
dat elke waarheid kopieert.

De keten wordt daarmee: intentie → kandidaatplan (model) → resolutie →
weging → bewijscontrole → simulatie → goedkeuringsgrenzen → uitvoering →
verificatie. Het model mag een pad verzinnen dat niet bestaat; de compiler wijst
het plan dan af. Dat de resolver het pad ook niet had aangeboden is de eerste
verdediging; de compiler is de tweede.

**Wat er staat** (`server/kern/stuur/plan.js`, aangehaakt als derde gereedschap
`plan` in `stuur/gereedschap.js`): het model levert doel + stappen, de compiler
weegt ze en geeft een uitvoerbaar plan of een afwijzing mét de bezwaren.
Uitvoeren blijft `doe` — dus het gewone voorstel dat een mens buiten het gesprek
bevestigt.

**De vier regels die hem klein houden, en alle vier zakken ze op een mutatie:**

| regel | wat het tegenhoudt |
|---|---|
| **PLAN voert niets uit** | geen `fetch`, geen `stuurRoep`, geen weg naar een effect — getoetst op de **bron**, want een weg die er niet is kan ook niet per ongeluk gebruikt worden |
| **PLAN bezit niets** | het oordeel per stap is exact `beleidVoor()`; er wordt niets bijberekend |
| **de autoriteit komt live** | nooit uit `EXECUTION_MAP.json`: dat is een bouwartefact en kan een commit achterlopen. De toets verandert de kaart met opzet en eist dat het oordeel niet meebeweegt |
| **een verboden stap laat het plan zakken** | nooit stil overslaan: een keten waarvan stap 5 wegvalt is een andere keten dan de gebruiker las |

**Wat het oplevert dat er gisteren niet was:** het plan zegt **vooraf** hoeveel
bevestigingen het gaat vragen, en wélke. Plus de golven — wat niet van elkaar
afhangt staat in dezelfde golf — als volgorde-informatie, uitdrukkelijk niet als
uitvoering. Een kringloop, een stap die naar een onbekende stap wijst, een plan
van meer dan 24 stappen en twee stappen met hetzelfde kenmerk worden alle vier
afgewezen met de reden erbij.

**Twee dingen die deze bouw blootlegde.** `lus.js` liep tegen de 10 KB van
keuringsregel 13, dus de gereedschapsbeschrijvingen zijn eruit gehaald naar
`stuur/gereedschap.js` — een naad die er toch al hoorde: dat bestand beschrijft
wat het model mág vragen, de lus handelt het af. En mijn eerste versie van toets
1 sloeg aan op de **kop van `plan.js` zelf**, die uitlegt dat er geen `fetch` en
geen `stuurRoep` in zit. Commentaar gaat er nu eerst af — dezelfde les als bij de
noemer, waar een verwijzing in commentaar werd aangezien voor een import.

**Wat PLAN nog niet doet:** simuleren (blok 4), en de uitkomst van een stap
doorgeven aan de volgende. Dat tweede is met opzet: zodra een stap de invoer van
de volgende bepaalt, gaat de compiler over gegevens in plaats van over
bevoegdheid, en dan is hij niet meer klein.

### Blok 4 — Simulatie en droogloop · **de gevolgvoorspelling STAAT, en de droogloop nu ook**

`zandbak.js` en `simulatie.js` bestaan. Wat ontbreekt is de koppeling aan PLAN
en één eerlijke eigenschap per capability: is simulatie hier `exact`,
`benaderend` of `niet beschikbaar`? Een factuur aanmaken is bijna exact, 600
gasten voorspellen is probabilistisch, "de klant reageert positief" is niet
voorspelbaar. Zonder dat onderscheid presenteert één mooie simulator alles als
zekerheid — precies wat de bewijsgraden van `BESTUUR.md` verbieden.

**Wat er staat: de gevolgvoorspelling** (`server/kern/stuur/gevolg.js`, naast het
`plan`-gereedschap). Zij beantwoordt de vraag die een gebruiker vóór het
bevestigen stelt — *wat verandert er dan* — voor het deel dat we werkelijk weten,
en zegt van de rest dat zij het niet weet.

**En het komt uit een meting, niet uit een model.** De idempotentieproef draaide
elke bereikbare route tegen een wegwerpserver en noteerde per oproep wélke
collecties veranderden: dat is het veld `opslag` in `IDEMPROEF.json`. Voor
`/api/bank/overboek` staan daar `bankSaldi`, `bankBoekingen`, `bankIdem` en
`bankIdemAfdruk`. Die vier zijn geen aanname — ze zijn één keer echt gebeurd.
Over alle routes: **331 met een gemeten effect over 196 collecties**.

**Drie graden, en de derde is de grootste.** Over de 176 paden die de AI mag
bedienen:

| graad | aantal | wat het zegt |
|---|---|---|
| `gemeten` | 36 | de proef raakte deze collecties aan |
| `geen-effect-gemeten` | 44 | de proef draaide en raakte niets aan |
| **`onbekend`** | **96** | de proef kwam er niet bij (404, 403, geen geldige invoer) |

**Die laatste twee mogen nooit door elkaar lopen**, en dat is de scherpste toets
van dit blok. "De proef kwam er niet bij" is iets anders dan "er gebeurt niets",
en het verschil is precies de gevaarlijke kant: een plan dat zegt "raakt niets
aan" terwijl niemand heeft gekeken, is een geruststelling zonder grond. De
mutatie die die twee laat samenvallen, laat de suite zakken.

**Vier grenzen staan in de uitslag zelf** en niet alleen in een commentaarregel:
zij zegt wélke collecties en nooit wat erin verandert; zij is gemeten met de
invoer van de proef, dus een ander lichaam kan andere collecties raken; alles
buiten de opslag valt erbuiten (mail, een betaalprovider, een derde partij); en
zij is een momentopname van de laatste proefronde, niet van deze commit.

**En dit was géén droogloop.** Er werd een eerdere meting op het plan
geprojecteerd; het plan liep niet. Dat deel staat er nu wel.

#### De echte droogloop (`scripts/droogloop.js`, `npm run droogloop`)

Het plan draait werkelijk — tegen een **wegwerpserver met een eigen datamap**
(`scripts/lib/wegwerpserver.js`, geen tiende kopie van die opstelling), met de
echte routes en de echte poorten ervoor. Per stap wordt de opslag vóór en ná
vergeleken, en dat is geen projectie meer maar een waarneming aan **deze**
invoer.

**Niet in de zandbak, en dat is geen uitwijkmanoeuvre.**
`server/kern/command/zandbak.js` leek de plek, maar hij is een *datavenster*
voor de Command-laag (journaal, beleid, risico, runbooks) en geen routehost: er
luistert geen HTTP op. Een plan bestaat uit API-paden, dus daar kan het niet
draaien. Het besluit over "een zandbak per gebruiker kost geheugen" hoefde
daarmee niet genomen te worden — de vraag was verkeerd gesteld.

**Twee dingen die de eerste versie stil verkeerd deed**, en allebei zijn ze de
reden dat een droogloop bestaat:

1. Hij las `db.json`. Dat bestand bestaat **niet** in een verse datamap — de
   opslag is sqlite (`store.db`) — en dus meldde hij "0 collecties bewogen"
   terwijl er aantoonbaar een agenda-item bij kwam. Een meting die stil nul
   zegt, is erger dan een die afbreekt.
2. Hij telde rijen in de `kv`-tabel. Die telling beweegt nooit: elke collectie
   ís één rij. Nu staat er per sleutel het versienummer, zodat een schrijfronde
   die de lengte niet verandert ook meetelt. `test/droogloop.test.js` bouwt daar
   een echte kv-tabel voor; zonder die toets bleef de mutatie groen.

**Huishouding staat apart van gevolg.** Elke oproep schrijft in `apiSpoor`,
`handelingLog` en `rtgai` — ook een die alleen leest. Op een hoop gegooid heten
alle vijf stappen "raakt van alles aan"; apart gehouden blijft zichtbaar wat de
handeling zélf deed.

**De opbrengst: de projectie klopte niet.** Van vijf stappen waren er drie te
beoordelen, twee klopten, en één week af:

| stap | voorspeld | waargenomen |
|---|---|---|
| `/api/pay/overzicht` | `geen-effect-gemeten` | `bankregie ledenBoard paySaldi payVerzoeken waardeReserves` |

Een **lezende** route die vijf domeincollecties schrijft. De proefronde had daar
"geen effect" gemeten, met háár invoer; met deze invoer gebeurt er iets. Dat is
precies waarom een projectie geen droogloop is.

**En wat de droogloop niet doet, staat in zijn eigen uitslag:** een stap op
`voorstel` wordt niet bevestigd (bevestigen is mensenwerk), de gegevens komen
uit de zaaiset, alles buiten de opslag blijft onzichtbaar, er wordt gemeten
wélke collectie bewoog en niet hoeveel, en een voorspelling op `onbekend` wordt
**niet beoordeeld** — onbekend kan niet fout zijn, en dat als goed tellen zou de
uitslag opkloppen.

#### De bewijsschuld van deze laag staat nu op de lijst

Een nieuwe laag zonder schuldpost ziet er per ongeluk schuldenvrij uit. Vier
posten erbij in `BEWIJSSCHULD.json`, alle vier afgeleid uit een register en geen
ervan met de hand ingetypt:

| post | soort | aantal | wat |
|---|---|---|---|
| `idem-ongeclassificeerd` | meetwerk | 849 | muterende routes zonder uitspraak over wat een tweede keer betekent |
| `gevolg-onbekend` | meetwerk | 94 | bereikbare capabilities waarvan nooit gemeten is wat ze veranderen |
| `herstel-onbevestigd` | instrument | 74 | tegenhangers uit NAMEN afgeleid en nooit uitgevoerd |
| `droogloop-onbeoordeeld` | meetwerk | 2 | stappen waarvan de voorspelling niet te beoordelen was |

De achterstand springt daarmee van **989 naar 2008**, en die groei staat mét
reden in het register — het script weigert te groeien zonder. Er is niets
bíj gekomen: deze schuld bestond al en stond nergens.

Twee dingen die daarbij zijn rechtgezet. `idem-ongeclassificeerd` telde eerst
3242, want hij nam de routes mee waar de proef niet binnenkwam — die hebben geen
tweede keer om over te beslissen en staan al onder `object-vooraf`. En
`gevolg-onbekend` stelt zijn vraag aan `gevolg.js` zélf in plaats van
`IDEMPROEF.json` een tweede keer te lezen: een schuldpost met een eigen kopie
van de meetlogica gaat op een dag iets anders zeggen dan de laag die hij beweert
te tellen.

`herstel-onbevestigd` is bewust `instrument` en geen `meetwerk`: de droogloop
meet één stap, niet een paar met een tussenstand. Dat gereedschap bestaat niet,
en tot het er is blijft compenserend handelen onbewezen.

### Blok 5 — Transactie- en compensatiesemantiek · **de herhaling staat, en het herstel is nu UITGEVOERD in plaats van afgeleid**

`transactie.js` en `transactie-poorten.js` doen voorcontrole, verificatie en
terugdraaien al; ze generiek maken is goedkoper dan de simulatie. Wat erbij
moet zijn twee eigenschappen per capability, allebei vierwaardig:

```
HERHALING   veilig / beschermd / bewust niet-idempotent / onbekend
HERSTEL     exact / compensatie / onmogelijk / onbekend
```

`undo: true/false` is te grof. Een e-mail is niet terug te halen maar een
hotelboeking is te annuleren, en dat verschil hoort het risico te veranderen.

Dit blok hangt aan `IDEMPROEF.json`: 2247 ongemeten routes. Een agent die een
herstelstrategie automatisch opnieuw probeert, plaatst anders twee bestellingen
of stuurt twee externe berichten. Het doel is niet alles idempotent — het is
alles geclassificeerd (`CREATE.md` par. 10).

**De HERHALING-kant bleek al te bestaan, en beter dan dit document beweerde.**
`IDEMBESLUIT.json` verklaart per route waarom een herhaalde oproep daar wel of
niet iets nieuws mag doen: **zeven klassen** (`creatie`, `berekening`,
`instelling`, `beschermd`, `code-maker`, `teller` en het eerlijke `tebeslissen`)
over **126 routes**. Een vierwaardige `HERHALING` erbij bouwen zou een tweede
register zijn geweest. Wat er wél moest gebeuren is het **koppelen**: de
executiekaart draagt nu meting en besluit náást elkaar (`herhaling` uit
`IDEMPROEF.json`, `herhalingBesluit` uit `IDEMBESLUIT.json`), en de toets bewaakt
dat het besluit de meting niet wegdrukt.

**Een tegenspraakregel die ik bijna verkeerd bouwde.** Vier routes staan als
`code-maker` in het besluitregister ("elke oproep hoort iets nieuws te geven")
terwijl de meting `beschermd` zegt. Dat lijkt een bug en is het niet: de proef
kent `beschermd` pas toe als de **verse** sleutel wél iets anders gaf — de
ijking. Een code-maker die bij dezelfde idempotentiesleutel hetzelfde antwoord
geeft, doet precies wat zo'n sleutel hoort te doen. De naïeve regel had vier
valse alarmen gemeld. Er blijft één regel over die écht tegenstrijdig is (besluit
zegt beschermd, meting zegt onbeschermd en nergens beschermd), en die staat
vandaag op **0**.

**De HERSTEL-kant is gemeten, en de uitkomst is een negatief** (`npm run herstel`,
`HERSTEL.json`). De voor de hand liggende weg — de tegenhanger afleiden uit de
naam, `/toevoegen` bij `/verwijder` — levert:

| | |
|---|---|
| routes | 3282 |
| vermoede tegenhanger | 74 |
| dubbelzinnig | 4 |
| **dekking** | **2,4%** |
| wat een NAAM kan bevestigen | **0** |

En de kwaliteit van die 2,4% is zelf twijfelachtig: `/api/agenda/bewaar` wordt aan
`/api/agenda/verwijder` gekoppeld terwijl bewaren een wijziging is en geen
aanmaak, en `/api/asset/herroep` past even goed op `/koop` als op `/gebruik`.
Daarom komt niets boven de graad **`vermoed`** uit, en is `onbepaald` een echte
uitkomst met béíde kandidaten erbij.

**En de toets verwierp meteen een heel woordpaar.** `bevries/ontdooi` stond in de
lijst, maar `ontdooi` bestaat nergens als route-einde: `/api/bank/bevries` zet de
stand vermoedelijk in één route met een vlag in het lichaam. Dat is een derde
vorm van terugweg — **een schakelaar** — die een vergelijking van namen per
definitie niet ziet. Diezelfde toets is de `rooms`-les: een woord dat nergens
heen wijst, laat de bouw zakken.

**De conclusie hoorde bij de meting:** een naamafleiding is een aanwijzing en
geen bewijs. Wat ontbrak was niet een verklaringsregister maar een **proef** —
en die staat er nu.

#### De herstelproef (`scripts/herstelproef.js`, `npm run herstelproef`)

Zij voert het paar **uit**: heen, kijken, terug, kijken — tegen dezelfde
wegwerpserver als de droogloop, en met dezelfde lezer van de opslag. Er komt
geen tweede lezer bij.

**Twee beelden, en dat is het hele mechanisme.** De droogloop telt het
versienummer van een collectie, want die beantwoordt *is er iets gebeurd*. Voor
*staat het er weer zoals het stond* is dat de verkeerde vraag: `ver` loopt alleen
maar op. De herstelproef leest daarom de **inhoud** (een hash per collectie) en
gebruikt het versiebeeld alleen om te zien of een stap werk deed.

**Vier uitslagen, en drie ervan zijn geen bewijs:**

| uitslag | wat het zegt |
|---|---|
| `exact` | de inhoud van elke geraakte collectie is letterlijk terug |
| `compensatie` | de terugweg deed werk, de oude inhoud kwam niet terug |
| `geen-herstel` | de terugweg draaide en veranderde niets; de naam belooft iets dat de handeling niet doet |
| `nietBeproefd` | de heenweg kwam niet binnen — er valt niets te keren |

Die laatste is met opzet een eigen uitslag. Een `geen-herstel` zou 67 paren
veroordelen voor een tekort van de **proef**, en niet-gemeten mag nooit als
oordeel langskomen. `exact` en `compensatie` worden nooit samengeteld — een
creditnota wist geen factuur — en `test/herstelproef.test.js` zakt zodra er één
getal voor beide verschijnt.

**De uitslag, na drie rondes gereedschap erbij:**

| | |
|---|---|
| `exact` | **13** |
| `compensatie` | **30** |
| `geen-herstel` | **1** |
| niet beproefd | **0** |
| andere wereld nodig | 46 |

Over **90 paren** — main bracht een grotere boom mee (4643 routes in plaats van
3282) en dus zestien nieuwe paren, die in dezelfde ronde zijn meegenomen.
`HERSTEL.json` staat op **43 bevestigd** en `vermoed` op 47. En die nul
is het punt: **elk paar draagt een uitslag** — uitgevoerd, of met een
uitgeschreven reden waarom zijn wereld hier niet bestaat.

**Van 63 onbeproefde paren naar nul, in vier ingrepen** (`scripts/lib/
herstelwereld.js`, hetzelfde patroon als `idemwereld.js`):

1. **De tegenhanger is de voorbereiding.** De helft van de onbeproefde paren was
   de omgekeerde richting van een paar dat wél werkte — `/api/clips/weg →
   /api/clips/maak`. De heenweg is daar een verwijdering, en in een verse
   database is er niets te verwijderen. Wat zo'n paar nodig heeft is een
   onderwerp, en dat maakt de tegenhanger. Eerst de tegenhanger, dan de
   voorziening: andersom maakte de voorziening een afspraak aan en haalde de
   tegenhanger hem meteen weer weg.
2. **Het lijf, per route.** Een clip duurt 1 tot 60 seconden, een relatie heeft
   een soort, een dienst heeft een chauffeurskaart, en een reis wil coördinaten
   en geen plaatsnaam. Alleen vorm — wie hier een uitkomst stuurt, schrijft de
   proef in plaats van de wereld.
3. **De voorziening.** Publiceren vraagt een website, binnenkomen vraagt een
   kamer, een pas sluiten vraagt een pas. Dat ding ontstaat langs de gewone
   route, met zijn eigen poort ervoor, en mag een keten zijn: live-zetten vraagt
   een gepubliceerde site vraagt een bewaarde.
4. **De wereld, eenmalig.** De leden-bank staat in een verse database uit. En
   `/api/bank/akkoord` geeft de rekening alleen bij de eerste oproep mee: elk
   bankpaar zijn eigen akkoord laten doen gaf bij het tweede paar 404 *"De
   rekening bestaat niet"* — terwijl die rekening er stond. Een gegeven dat maar
   één keer wordt uitgedeeld, hoort bij de wereld en niet bij een paar.

**En wat er níét mee wordt nagebouwd, staat er als besluit.** 32 paren vragen een
wereld die deze proef niet opzet: een zaak met de werkvorm journalistiek, een
ingericht landpakket, een salon, een geplande reisoptie. Die dragen
`wereldOntbreekt` mét wat er zou moeten bestaan — een eigen uitslag, want *"wij
hebben geen krant"* is iets anders dan *"de proef kwam er niet bij"*. Een proef
die zijn eigen meetobject verzint, meet zichzelf.

**De eerste `geen-herstel` staat er ook**, en het is een bevinding en geen
proeffout: `/api/office/atelierweb/verwijder → /bewaar` haalt de site weg, en
`bewaar` antwoordt daarna 200 zonder iets terug te zetten. Een 200 die niets doet
en niets zegt, is precies wat GRAMMATICA.md verbiedt van een verhindering — die
draagt een reden. Dit is code van main en valt buiten deze tak; het staat in het
register zodat het niet verdwijnt.

#### Vier dingen die stil verkeerd gingen

**Een verdict is een beschuldiging.** `geen-herstel` zegt: deze route belooft een
omkering die hij niet uitvoert. Het agendapaar kreeg dat oordeel — en het klopte
niet: het id kwam uit het láátste element van een lijst, wat bij één agenda-item
goed gaat en bij vijf een ander item aanwijst. De proef weet nu of een sleutel
**geraden** is, en velt op een gok geen oordeel.

**Wachten op stilte is niet wachten op de schrijver.** Een vaste pauze van 200 ms
liet hetzelfde paar `exact` heten als het alleen draaide en *"raakte niets aan"*
in de volle ronde. Twee gelijke metingen vlak na de oproep zijn allebei van vóór
de schrijfronde — dus wordt er nu gewacht tot het beeld **verandert**, en pas
daarna tot het stil ligt.

**Een vaste idempotentiesleutel meet de herhaling en niet de handeling.** Main
eist sinds kort een `idem` op elke opdracht die geld verplaatst. Met één vaste
sleutel gaf de meetronde keurig 200 en veranderde niets — de route deed precies
waar hij voor gebouwd is, want de opwarmronde had die sleutel al gebruikt. De
sleutel is nu vers per poging.

**De proef beïnvloedt zichzelf.** `/api/staff/mob/cdt/aanmelden` kwam als
`compensatie` door wanneer hij alleen draaide, en als 503 *"deze functie is voor
dit genre uitgeschakeld"* in de volle ronde: een eerder paar had de wereld
veranderd. Wat in de volle ronde niet lukt, draait daarom nog een keer **alleen,
op zijn eigen verse server** — en lukt het dan wel, dan telt die uitslag met
`ordeAfhankelijk` erbij. Drie paren staan zo. Een uitslag die van de volgorde van
routenamen afhangt, is geen uitslag.

**Een opwarmronde bleek niet-onderhandelbaar,** en dat is het leerzame deel. In
een verse database bestáát de collectie `agendas` niet. Voegt de heenweg het
eerste item toe en haalt de terugweg het weer weg, dan is die collectie daarna
leeg maar *aanwezig* — een andere inhoud dan "er was niets". Zonder opwarmronde
heette **elk** paar `compensatie` en was `exact` structureel onbereikbaar. Een
hoogste graad die niemand ooit kan halen, is geen graad. Dat is dezelfde
faalvorm als de rijtelling op `kv` in de droogloop: een meting die stil het
verkeerde antwoord geeft.

**En één bevinding is er inhoudelijk uitgekomen:**
`/api/office/atelierweb/bewaar → /verwijder` is `compensatie` en geen `exact`,
met `kosten` als de collectie die niet terugkomt. Een website weggooien maakt
niet ongedaan dat hij geld heeft gekost. Precies het soort verschil dat een
naamvergelijking nooit had gezien, en precies wat een bon moet zeggen voordat
iemand op "ongedaan maken" drukt.

**Die vondst legt meteen de prijs van de opwarmronde bloot.** `/api/meet/maak`
stond in de eerste ronde óók op `compensatie` met `kosten` als reden, en staat er
nu op `exact` — de kostenregel valt bij de eerste aanmaak, en die aanmaak is nu
de opwarmronde. `exact` betekent hier dus: **exact bij een tweede en volgende
uitvoering.** Dat is een gekozen ruil (zonder opwarmronde was `exact`
onbereikbaar) en het staat als vijfde grens in de uitslag zelf, niet in een
voetnoot.

**Wat de proef níét zegt, staat in haar eigen uitslag:** zij weet niet wélk ding
de terugweg moet aanwijzen (zij geeft de identificerende velden uit het antwoord
van de heenweg door, en faalt dat, dan is de uitslag `nietBeproefd`); zij toetst
een paar in het gunstigste geval — meteen erna, door dezelfde gebruiker, op een
vers gemaakt ding; en zij logt in als **lid**, terwijl de meeste resterende paren
een leveranciers- of kantoorsessie vragen. Dat laatste is wat de post
`herstel-onbevestigd` in `BEWIJSSCHULD.json` van `instrument` naar **`meetwerk`**
verplaatst: het gereedschap bestaat, er is nog niet overal mee gemeten.

### Blok 6 — Mandaatmotor · **de GRAMMATICA staat, de autonomie wacht op bewijs**

Machine-afdwingbare mandaten met scope, context, bedrag, tijdvenster, looptijd
en gedrag boven de grens. Plus budgetten die niet allemaal over geld gaan:
actiebudget, communicatiebudget, risicoplafond. Maar **niet** databudget — dat
is consent (grens 3).

Dit blok is niet moeilijk om te bouwen. Het is moeilijk om te verdienen: met nul
bewezen routes zou een mandaat vandaag toestemming geven op ongemeten grond.

**Wat er daarom wél is gebouwd** (`server/kern/stuur/mandaat.js`): de helft die
vandaag al waar kan zijn, namelijk de **versmalling**. De speelruimte is een
doorsnede van wat het beleid toestaat, wat het mandaat overlaat en wat de
plafonds toelaten — en zij kan structureel niets toevoegen. Dat is geen
vuistregel maar de eerste toets: wat eruit komt, zat er al in.

Op de 120 toegestane ledenpaden houdt een ruim mandaat er **8** over. De rest
valt af **met een reden**, en de twee belangrijkste redenen zijn grenzen die
elders zijn genomen:

- **een mandaat hoogt geen niveau op** — wat `voorstel` is, blijft een menselijke
  bevestiging vragen. Geen bedrag, geen looptijd en geen agent verandert dat;
- **geld blijft mensenwerk** (`GELD.md`) en het pasbesluit ook (`CLAUDE.md`),
  hoeveel er ook in het mandaat staat.

**En de stilste fout is expliciet dichtgezet: leeg is dicht.** Geen mandaat, een
leeg mandaat of een verlopen mandaat geeft **niets** zelfstandig — niet alles.
Dat is de klassieke omkering in dit soort lagen, en zij is van buiten niet te
zien omdat er gewoon iets gebeurt.

**Eén ding dat de mutatieronde blootlegde en dat blijft staan als les:** de
geldregel werd *overschaduwd* door de niveau-regel. De drie geldpaden waarop ik
hem toetste zijn allemaal `voorstel`, dus ze werden sowieso tegengehouden — de
regel weghalen liet de toets groen. Hij wordt nu getoetst op `/api/pay/saldo`,
dat `lezen` is en dus alléén door de geldregel wordt tegengehouden. Een regel die
meelift op een andere, is niet bewezen.

### Blok 7 — Mijn AI · **de waarheid eronder staat, het scherm bewust niet**

Het scherm, en pas hier. Eenvoudig aan de bovenkant (lezen / voorbereiden /
uitvoeren per domein), rijk eronder (agent, mandaat, scope, context, budget,
verval, risicoplafond, delegatie, bewijs). Plus het activiteitenlog, dat
uitdrukkelijk **geen chatgeschiedenis** is: chat is communicatie,
agent-activiteit is uitvoeringshistorie.

Een scherm dat "mijn AI mag bestellingen zelfstandig plaatsen ✓" toont terwijl
een fractie van de bestelroutes onder bewijs ligt, is een schermleugen
(`SCHERMLEUGEN.json` bestaat niet voor niets).

**Daarom is de speelruimte gebouwd en het scherm niet.** `speelruimte()` uit blok
6 ís de waarheid die zo'n scherm zou moeten tonen: per rol en per mandaat, welke
paden er zelfstandig overblijven en waarom de rest afvalt. Dat is uitrekenbaar,
narekenbaar en vandaag al eerlijk.

Wat er niet is, is de bovenkant: vinkjes waarmee een lid autonomie *aanzet*. Die
zou een macht tonen die het systeem niet betrouwbaar kan definiëren zolang
`VERTROUWEN.json` op **0 bewezen** staat. Het is geen ontbrekend scherm maar een
uitgesteld besluit, en de volgorde is: eerst de bewijsschuld voor de betrokken
capabilities sluiten, dan het scherm. Wie het omdraait, bouwt precies de
schermleugen waar dit huis een register voor heeft.

### Blok 8 — Intelligence router · **GEBOUWD, in de schaduw**

De selectievolgorde als huisregel: kan het met een regel → regel; met een exact
algoritme → algoritme; met optimalisatie → optimizer; met statistiek →
voorspeller; heeft het taal, ambiguïteit of redenering nodig → generatieve AI.
**AI is de laatste passende techniek, niet de eerste.**

De bouwstenen bestaan gedeeltelijk: `kern/voorspel/` (ritme uit het eigen
grootboek, expliciet geen zwarte doos), `kern/reisoplosser.js`,
`kern/navigatie/wegennet.js`, `kern/mobiliteit/reisfactoren.js`,
`kern/antivirus/analyse.js`, `kern/commercie/tegenfeit.js`. Wat ontbreekt is de
constraint solver (par. 3, punt 4). En intern hoort het onderscheid ook in de
taal te zitten: **AUTOMATISERING, OPTIMALISATIE, VOORSPELLING, REGELS, AI** zijn
vijf dingen en niet één woord.

**De vondst die dit blok opende: de volgorde staat vandaag omgekeerd.** De
regellaag bestaat al — `kern/ai/demoantwoorden.js` levert vaste antwoorden zonder
model — maar in `kern/ai.js` staat hij **ná** het model: is er een sleutel, dan
antwoordt het model altijd, en het regelantwoord vangt alleen een storing op. De
huisregel zegt het omgekeerde.

**Wat er staat** (`server/kern/ai/router.js`, aangehaakt in `kern/ai.js`): vijf
technieken in volgorde van goedkoop en zeker naar duur en vaag, een register van
motoren die **aantoonbaar bestaan**, en een uitslag die altijd een techniek én
een reden draagt.

**Hij beslist niets, en dat is een besluit.** De router draait in de **schaduw**:
hij zegt welke techniek erbij zou horen en telt dat, terwijl de modelaanroep
gewoon doorgaat. De volgorde omdraaien betekent namelijk dat een matig
regelantwoord een goed modelantwoord kan verdringen — en dat merkt niemand, want
er komt gewoon een antwoord. Eerst het getal, dan de omkering; dezelfde afspraak
als `CONTROLPLANE.md`: je kunt niet afdwingen wat nooit in de schaduw heeft
gelopen. Een mutatie die er een modelaanroep in zet, laat de suite zakken.

**Hij wijst alleen naar motoren die bestaan**, en de toets laadt ze allemaal:
`demoantwoorden.js` (regels), `fiscaal/btwtelling.js` en `navigatie/wegennet.js`
(algoritme), `voorspel/index.js` en `kosten/vooruitblik.js` (voorspelling),
`ai/prompt.js` (ai).

**En de ontbrekende techniek wordt hardop genoemd.** Er is géén optimizer:
`kern/agent.js` maakt roostervoorstellen op weekdagfactoren, en dat is een
heuristiek. "Maak volgende week een beter rooster" valt daarom terug op het
model — mét de reden erbij dat de techniek die erbij hoort hier niet bestaat.
Twee mutaties bewaken die eerlijkheid: de gatenlijst leegmaken zakt, en een
verzonnen `roosteroptimizer.js` in het register zakt ook. Dat is de `rooms`-fout
in beide richtingen.

**Elk antwoord draagt nu zijn techniek en de reden** (`techniek`, `waarom`,
`schaduw` op het antwoord van Rahul), zodat achteraf narekenbaar is waarom er een
model aan te pas kwam.

**De tellers kunnen nu duurzaam.** Een schaduwmeting bestaat om een besluit te
dragen; tellers die bij elke herstart op nul springen dragen dat niet, en dan is
"zoveel procent had goedkoper gekund" een indruk van één middag. `onthoud()`
neemt een bewaarplek aan en de stand zegt zelf wat hij is — **`duurzaam: true`
of `false`, met de grens erbij**. Zonder plek telt hij in het geheugen én zegt
dat er hardop bij; de mutatie die altijd `duurzaam: true` meldt, zakt.

En meten mag nooit stukmaken: zowel lezen als schrijven van die plek zit achter
een vangnet. Dat gat vond de toets zelf — de eerste versie liet een kapotte
bewaarplek de registratie laten klappen.

**Wat open blijft: de omkering zelf.** Die hoort te wachten tot het getal er is,
en dat is nu voor het eerst een getal dat kan blijven bestaan.

### Blok 9 — Commandbalk · **bewust niet gebouwd, en dit is waarom**

Natuurlijke taal vrijwel overal, en pas hier — omdat alles eronder dan
afdwingbaar is. Niet eerder.

**Wat er nu wél onder ligt** (blok 0 t/m 8): de resolver versmalt naar wat
relevant is, de compiler weegt een keten vóór uitvoering, de gevolgvoorspelling
zegt wat er zou veranderen, het mandaat versmalt de zelfstandigheid, en de router
zegt welke techniek erbij hoort. Dat is precies het fundament dat een commandbalk
nodig heeft.

**Wat er nog níét onder ligt, en waarom het wachten geen luiheid is:**
`VERTROUWEN.json` staat op **0 bewezen**, en de gevolgvoorspelling staat op
**96 van 176 onbekend**. Een balk waarin een lid in gewone taal het hele huis
bedient, belooft dekking die die twee getallen niet dragen. De volgorde is dus
niet "commandbalk erbij" maar: **eerst die twee getallen bewegen, dan de balk.**
Dat is één besluit, geen bouwopdracht.

---

## 7. De stuurmaat: één bewezen keten, niet honderd aangevinkte functies

De verleidelijke vraag is "wanneer hebben we Mijn AI?". De juiste vraag is:

> **Wanneer kan RTG één volledige autonome keten bewijzen?**

Voorstel voor die keten: *bereid een standaard inkoopbestelling voor.* Hij is om
drie redenen goed gekozen, en de derde is gemeten.

**Ten eerste** doet `kern/agent.js` de driedeling van grens 4 al: de AI stelt een
inkooplijst voor op eigen verkoop en verwachte drukte, *"niets gaat vanzelf de
deur uit"*, en pas bij akkoord van de gemachtigde wordt de bestelling echt
geplaatst. VOORBEREIDEN en VERPLICHTING AANGAAN zijn daar al twee gebeurtenissen —
alleen nergens benoemd, en dus niet afdwingbaar. Een begrip invoeren op gedrag
dat er al is, is de goedkoopste manier om een begrip te krijgen dat blijft
kloppen.

**Ten tweede** is de keten klein: vier routes.

**Ten derde** staat er precies genoeg fout mee, en op de nuttige manier:

| route | herhaling | vervalstaat |
|---|---|---|
| `POST /api/supplier/agent` | beschermd — *de server merkte de herhaling zelf* | verzwakt (3 schakels nooit gemeten: AUDIT, FAILURE, ROLLBACK) |
| `POST /api/supplier/agent/koppel` | beschermd | verzwakt (6 schakels) |
| `POST /api/supplier/agent/voorstel` | **ongemeten** — *de eerste oproep deed geen werk (409)* | verzwakt (5 schakels) |
| `POST /api/supplier/agent/beslis` | **ongemeten** — *de eerste oproep deed geen werk (404)* | verzwakt (5 schakels) |

De twee ongemeten routes zijn niet ongemeten omdat ze riskant zijn, maar omdat
de proefopstelling geen gekoppelde groothandel en geen openstaand voorstel had.
Een zaaisituatie erbij en de keten is meetbaar — de goedkoopste denkbare eerste
taak. Tegelijk laat de rechterkolom zien dat de bewijsketen sluiten voor deze
ene keten echt werk is, en dat is precies wat je wilt weten vóór je uitschaalt.

**En er is een vierde ding, gevonden bij het bouwen van blok 0: geen van deze
vier routes staat op de AI-allowlist.** `beleidVoor()` geeft voor alle vier
`verboden` met dezelfde reden — *"deze actie staat niet op de expliciete
AI-allowlist voor supplier"*. Dat is geen gat maar de opzet: een nieuwe route
is nooit automatisch AI-bedienbaar, en iemand moet er per pad naar hebben
gekeken. Het betekent wel dat de eerste stap van deze keten een **menselijk
besluit** is en geen commit — precies zoals het hoort, en precies het soort stap
dat je niet ontdekt zolang je alleen over de architectuur praat.

De keten is af als elk van deze tien punten voor dit ene scenario groen is:
intentie → resolver → formeel plan → capabilities bewezen → risico uit één
motor → herhaling geclassificeerd → simulatie geldig → mandaat geldig →
uitvoering transactioneel → postconditie gemeten → bon volledig → audit
gecorreleerd.

Eén zo'n keten levert het patroon. Daarna is uitschalen werk in plaats van
ontwerp.

---

## 8. De regel die hierbij in LAT.md hoort

Elke regel in `LAT.md` komt uit een fout die hier écht is gemaakt, en dat is
waarom ze overleven. Deze ook:

> **Een modeluitkomst kan nooit rechtstreeks een extern of persistent effect
> veroorzaken. Alle effecten lopen via een benoemde, door beleid begrensde
> capability buiten het modelproces.**

*De fout eronder:* het pasbesluit. `/api/aanmelding/*` zit achter `officeAuth`,
maar `officeAuth` laat de eigenaar met zijn eigen accountlogin door, en
`/api/member/doe` draait op precies dat token. "Rahul, keur de wachtrij even
goed" kende dus passen toe zonder dat een mens per geval had gekeken — en *dat
een mens de zin uitsprak is niet hetzelfde als dat een mens de aanvraag
beoordeelde.* Dat verschil ís de regel. Het pad staat sindsdien op de
verbodenlijst in `kern/stuur.js`, met die redenering erbij.

Dat is niet hetzelfde geval als een model dat rechtstreeks schrijft, maar het is
dezelfde klasse: een effect dat ontstond doordat het uitvoeringspad en het
beoordelingspad niet gescheiden waren. Deze regel is precies het soort regel dat
over twee jaar sneuvelt met "voor deze ene feature is rechtstreeks schrijven
makkelijker", en hij hoort daarom een handhaver te krijgen en niet alleen een
alinea.

*Wat hem vandaag handhaaft:* `test/stuur-aanval.test.js` (promptinjectie kan
zichzelf niet goedkeuren) en de bouw van `kern/stuur/goedkeuring.js` (het interne
akkoord is een `Symbol`). *Wat er nog niet is:* een statische controle die een
schrijvende aanroep in een modelantwoordpad überhaupt vindt.

---

## 9. Wat er bewust NIET komt

- **Geen tweede frictiemotor.** Er is er één te veel, niet één te weinig.
- **Geen vijfde capabilitygraaf.** Er zijn er al vier die zo heten en iets
  anders doen: `command/graaf.js` (gegevens, gemeten), `command/vermogens.js`
  (per categorie, bewust niet per functie-id), `magnaat-capabilities.js`
  (codescan met risicoklasse) en het routedossier in Kantoor.
- **Geen handgeschreven capability-register.** `CAPABILITEIT.json`: 21
  woordenlijsten, 249 leden, 92% in precies één lijst. De 22e komt er niet bij.
- **Geen AI-eigen rechtenmodel.** De AI kan nooit meer dan de persoon die hem
  iets vraagt, en dat blijft één codepad.
- **Geen Mijn AI vóór bewijs.**
- **Geen mandaat dat consent-, gegevens- of geldregels overschrijft.**
- **Geen losse tool-exposure van honderden endpoints aan een model.** Een model
  met honderden gereedschappen is iets anders dan een model dat een plan
  oplevert dat daarna deterministisch gewogen wordt (`FABRIC.md` par. 2).
- **Geen Engelse naam voor de speelruimte.** `envelop` is bezet
  (`kern/envelop.js`, gesloten op acht velden) en dit huis heeft één keer
  eerder een naambotsing betaald (`capability` tegenover `VERMOGENS`, opgelost
  door laag 4 om te dopen tot *genre-cap*). De doorsnede uit grens 2 heet hier
  **de speelruimte**.
