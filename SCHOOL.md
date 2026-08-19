# SCHOOL.md -- RTG Education OS

Het diepte-document van de wereld die vandaag "RTG School" heet: het schoolkanaal
van de RTFoundation plus de leerkant in de ledenapp. `PLATFORM.md` beschrijft het
wereldpatroon dat elke wereld krijgt, `GELD.md`, `LEVEN.md`, `LIFE.md` en
`CONCERN.md` zijn de zusterdocumenten, `LAT.md` zegt hoe er geschreven wordt.
Dit zegt wat deze wereld is, wat er al staat, en -- zwaarder wegend -- wat hij
nooit mag worden.

---

## 0. De kern, in een zin

> Magister en Somtoday zijn systemen waarin mensen **registreren wat er is
> gebeurd**. RTG School is een systeem dat **lesgeven, leren, organiseren en
> menselijke zorg voortdurend op elkaar afstemt**.

En daaruit volgt de regel die het hele ontwerp stuurt:

> **Registratie is een bijproduct, geen doel.** Wat een docent invoert, hoort te
> ontstaan uit wat hij toch al doet. Wat een leerling oefent, hoort te volgen uit
> wat hij vandaag nodig heeft. Wat een school vastlegt, hoort een besluit te zijn
> dat later nog uit te leggen is.

Wij winnen dus niet met "dat hebben wij ook, plus AI". Wij winnen -- als wij
winnen -- omdat de cirkel rond is: lesgeven → oefenen → begrijpen → meten →
fouten verklaren → herstellen → onthouden → docent informeren → volgende les
beter. In één systeem, in 114 talen, met de mens aan het stuur.

**Wat wij niet beweren.** Niet dat niemand ter wereld een van deze onderdelen
heeft. Dat is niet na te trekken en dus geen belofte maar een verkooppraatje.
Wat wel te bewijzen valt: deze combinatie, in Nederlandse schoolsoftware, in één
systeem, met per belofte een meting erbij (§7).

---

## 1. Dit is geen groen veld, en dat is het belangrijkste feit hier

Gemeten op 19 augustus 2026, na de schermenronde van deze dag.

| Wat er staat | Hoeveel | Waar |
|---|---|---|
| schooladministratie (server) | 42 modules, **168 endpoints** | `server/school/` |
| schermen | leraar, directie, gezin, campus, bibliotheek | `public/apps/schoolpartner*`, `public/apps/foundation/school*` |
| dekking | **168 van 168** endpoints vanuit een scherm bereikbaar | `test/schoolschermen.test.js` |
| rollen en rechten | 15 rollen, recht per handeling, inzagejournaal met verplichte reden | `school/rollen.js` |
| leerstofmotor | **166 leerdoelen**, 56 opgavengeneratoren, referentieniveaus 1F-4F | `kern/leerstof*.js` |
| de Fabric | voorkennisgraaf, meerdere uitlegvormen en een eigen meting per doel, gekeurd bij het opstarten | `kern/leerstof-fabric.js` |
| rekenen po | **45 doelen** groep 1-8, met voorkennis en 99 uitlegvarianten, doorlopend tot in het mbo | `kern/leerstof-data/rekenen-g*.js` |
| taal po | **30 doelen** groep 1-8, spelling uit woordbanken met een regel in plaats van vaste woordparen | `kern/leerstof-data/taal-g*.js` |
| het hele po | **111 doelen** over zeven vakken, elk met voorkennis en meer dan een uitleg | `kern/leerstof-data/` |
| vo t/m wo | **55 doelen** over twintig vakken; vmbo 15, havo 34, vwo 38, mbo 10, hbo 4, wo 5 | `kern/leerstof-data/vo-*.js`, `vervolg*.js` |
| de hele bibliotheek | **geen enkel leerdoel** put nog uit een handgeschreven vragenlijst; 333 uitlegvarianten | `test/leerfabric.test.js` |
| onderwijsladder | 25 fasen po t/m wo, doorstroomkaart, leerpaspoort | `kern/onderwijs-ladder.js` |
| toetsmotor | verse opgaven per leerling, uitslag per leerdoel, cijfer = advies | `school/toets.js` |
| toetsen (bewijs) | 100 tests groen over 19 bestanden | `test/school*.test.js` |

En hier is het eerlijke deel: **de vorm is overal om, de diepte verschilt per
laag.** Geen enkel leerdoel put nog uit een handgeschreven vragenlijst: de
motor maakt zijn opgaven uit REGELS en TABELLEN -- 'cht' wordt fout 'gt',
twaalf provincies leveren vierentwintig vragen, twintig gedateerde
gebeurtenissen leveren honderden "wat-was-eerder"-vragen, en een formule met
twee gegevens levert er zoveel als er getallen zijn. Een leerlijn uitbreiden is
daarmee een regel erbij en geen vragen tellen.

Wat de diepte betreft: het basisonderwijs is af (111 doelen, zeven vakken,
groep 1 t/m 8). Het vo staat op 55 doelen over twintig vakken -- genoeg om de
kern van elk vak te oefenen, te weinig voor een volledig examenprogramma. Het
mbo, hbo en wo zijn het dunst (10, 4 en 5 doelen) en gaan over
beroepsvaardigheden in plaats van vakken.

Wie dit verkoopt, zegt dus: het basisonderwijs is compleet, het voortgezet
onderwijs dekt de kern, en het vervolgonderwijs is een begin.

> **De volgorde van dit document is daarom niet "wat bouwen we erbij" maar "wat
> moet er onder".** Elk hoofdstuk hierna hangt aan hoofdstuk 2. Zonder die laag
> zijn Student Twin, Memory Engine en Misconception Graph mooie woorden om een
> lege bibliotheek.

---

## 2. De Universal Learning Fabric -- één structuur voor elk vak

Niet per vak een systeem. Eén structuur, waar elk vak op draait:

```
Concept -> Skill -> Prerequisite -> Explanation -> Example -> Practice -> Assessment -> Evidence
```

Vandaag kent een leerdoel vier velden (`id`, `naam`, `les`, `gen`) en optioneel
`ref`. Dat is de kiem, en hij moet groeien naar:

| Veld | Wat het doet | Waarom het niet mag ontbreken |
|---|---|---|
| `id` | `breuken.optellen`, `oorzaak_gevolg.industrialisatie` | een leerdoel dat van naam verandert, verliest de geschiedenis van elk kind dat het haalde |
| `vereist` | welke concepten hieraan voorafgaan | zonder voorkennisgraaf is "hij snapt het niet" een dood spoor |
| `uitleg[]` | meer dan één representatie van hetzelfde doel | §5 |
| `oefening` | generator of itembank | een vaste vragenlijst is na drie keer een geheugenspel |
| `meting` | hoe je vaststelt dat het beheerst is | §6 |
| `bewijs[]` | waarop de beheersing berust | §6 |

**De harde eis: één id-ruimte voor alle vakken.** Wiskunde, geschiedenis, taal en
biologie hangen aan dezelfde structuur, anders krijgt elk vak zijn eigen motor en
is de belofte "elke leerling kan elke dag elk vak oefenen" een roosterprobleem in
plaats van een eigenschap.

---

## 3. De Student Twin -- niet wat een kind kan, maar wat het nú nodig heeft

Een percentage is geen beeld. De twin draagt acht dimensies:

| Dimensie | De vraag | Wat het verandert |
|---|---|---|
| Kennis | wat beheerst hij, welke voorkennis ontbreekt | de volgende stap |
| Retentie | wat dreigt weg te zakken | §4 |
| Strategie | welk foutpatroon komt terug | §5 |
| Tempo | hoeveel oefening is nodig | het dagbudget |
| Taal | begrijpt hij het concept of struikelt hij over de formulering | §8 |
| Zelfstandigheid | lukt het zonder hints | wanneer een mens erbij moet |
| Context | wat behandelt de klas nu | aansluiting op de les |
| Belasting | wat staat er vandaag al gepland | §10 |

Waar dit toe leidt is het punt. Niet: *Mila scoort 63% op breuken, hier zijn
twintig sommen.* Maar: *Mila beheerst het rekenconcept waarschijnlijk wel en
maakt fouten zodra de opgave talig wordt* -- en dan komt dezelfde rekentaak
terug **met taalondersteuning**, niet met meer sommen.

**Wat de twin niet is.** Geen risicoscore, geen uitvalvoorspelling, geen label
dat aan een kind blijft plakken. Wat eruit komt zijn factoren met hun rekensom
erbij, precies zoals `school/analyse-signalen.js` dat vandaag al doet. Zie §11.

---

## 4. De Memory Engine -- van leren-toets-vergeten naar leren-beheersen-onthouden

Schoolsoftware kijkt naar gisteren. Deze laag kijkt naar wat een leerling
**dreigt te vergeten**. Elke beheerste node krijgt een retentiestand en een
herhaalmoment; wat terugkomt zijn drie korte controlevragen, niet de hele les
opnieuw.

De regel eromheen: **herhalen is geen straf en geen achterstand.** Een
herhaalvraag ziet er in het scherm hetzelfde uit als een nieuwe vraag, en er
komt geen enkele markering bij die zegt "dit had je moeten weten".

---

## 5. De Misconception Graph -- een fout is geen fout maar een denkfout

`antwoord = fout` is de armste vorm van informatie die een schoolsysteem kan
bewaren. Rijker: **welk denkpatroon** leidde ertoe.

```
misconception.fractions.add_denominator   -- teller én noemer opgeteld
misconception.units.no_conversion         -- eenheden niet omgerekend
misconception.dt.past_tense_stem          -- stam en tijd door elkaar
```

Wat dat oplevert is niet een cijfer maar een les: *elf van de zesentwintig
leerlingen lijken dezelfde denkfout te maken.* Daar hoort een klassikale
mini-uitleg bij met drie controlevragen -- en die maakt de docent beter, in
plaats van hem te vervangen.

Daaraan vast zit **Explain Differently**: hetzelfde leerdoel, andere
representatie. Eenvoudiger, visueel, stap voor stap, als praktijkvoorbeeld, als
verhaal, met analogie, in de thuistaal, tweetalig, of juist een niveau hoger.
Het leerdoel verandert niet; de weg ernaartoe wel. Dat is een sterker gebruik
van generatieve AI dan een chatbot naast het scherm.

---

## 6. Proof of Learning -- waarom denkt RTG dat ik dit kan?

`mastered = true` is een bewering. Een bewering hoort bewijs te dragen:

```
leerdoel breuken.optellen -> beheersing STERK
  4 oefensessies (laatste 3 dagen geleden)
  2 docentobservaties
  1 toets (SO, 8 van 10)
  1 praktijkopdracht
```

Elke leerling kan dat opvragen -- letterlijk de vraag "waarom denkt RTG dat ik
dit kan?" -- en elke docent ook. Dat sluit aan op de bewijsarchitectuur die dit
huis al draagt (`BEWIJS.md`, `BEWIJSMATRIX.json`): een claim zonder bewijs is
hier geen claim.

Twee dingen die daaruit volgen:

- **Learning Recovery.** Een onvoldoende is geen eindpunt maar een lijst
  ontbrekende bouwstenen: *je mist er drie, twaalf minuten vandaag, acht
  donderdag, controle vrijdag.* Niet het hele hoofdstuk opnieuw.
- **Algorithmic Appeal.** Een leerling mag een aanbeveling betwisten. "Ik kan
  dit al" leidt tot een korte beheersingscheck van vijf vragen, en bij goed
  resultaat schuift de twin op. Een algoritme dat iemand eeuwig laag houdt, is
  geen onderwijs maar een gevangenis.

---

## 7. Wat wij beloven, en waarmee wij het meten

Geen belofte zonder meting. Dit is de lijst waarop RTG School afgerekend mag
worden -- door de school, door ons, door een toezichthouder.

| Belofte | Meting | Vandaag |
|---|---|---|
| Elke leerling kan elke schooldag elk actief vak oefenen | dekkingsmeter: vakken met minstens één oefenbaar leerdoel per fase | **ja** voor po en vo; mbo t/m wo dun |
| Een oefening is nooit na drie keer een geheugenspel | geen enkel leerdoel put uit een vaste vragenlijst | **ja**, hele bibliotheek (`test/leerfabric.test.js`) |
| Een leerdoel staat op precies één plek | de bibliotheek gooit bij een dubbele id | **ja** (`kern/leerstof-bibliotheek.js`) |
| Een leerdoel-id verandert nooit | registertoets op de bestaande ids | **ja** (`test/leerfabric.test.js`) |
| Een opgave verklapt nooit haar eigen antwoord | generatortoets over alle leerdoelen | **ja** -- ving bij het schrijven twee echte gevallen |
| Presentie van een les staat binnen 30 seconden | benchmark op het presentiescherm | scherm bestaat sinds vandaag, meting nog niet |
| Geen zorgtoegang zonder doel en reden | invariant + toets | **ja** (`test/schoolenterprise.test.js`) |
| Een rapport bereikt het gezin alleen na menselijke vaststelling | invariant + toets | **ja** (`test/schoolbeeld.test.js`) |
| AI stelt nooit zelfstandig een schooladvies vast | policytoets + mutatie | **ja** in de kern, nog niet in elke laag |
| Geen hulpvraag raakt zoek | SLA + opvolgbewijs | hulplijn bestaat, opvolgbewaking niet (§12) |
| 114 talen | vertaaldekking + steekproef op kwaliteit | vertaallaag bestaat, dekking niet gemeten |
| Elk endpoint heeft een scherm | registertoets | **ja**, 168 van 168 |

Wie een belofte toevoegt zonder meting, voegt geen belofte toe maar een risico.

---

## 8. De taallaag -- leren ondanks een taalbarrière, zonder het Nederlands weg te nemen

Niet overal een vertaalknop. Elke inhoudseenheid draagt een canonieke vorm plus
representaties per taal, en de school stelt de regel in:

- bij **Nederlands** geen volledige vertaling -- dan meet je niet meer wat je
  wilt meten;
- bij **wiskunde en natuurkunde** thuistaalondersteuning toegestaan -- daar meet
  je het concept.

Dat onderscheid is het hele punt: **taal leren** is iets anders dan **leren
ondanks een taalbarrière**.

Daaraan vast twee dingen:

- **Language Independence Test.** Scoort een leerling slecht op natuurkunde in
  het Nederlands, dan komt dezelfde conceptuele vraag terug met beperkte
  thuistaalondersteuning. Wordt het antwoord dan goed, dan luidt de conclusie:
  *taalondersteuning lijkt hier relevanter dan extra natuurkunde-instructie.*
  Een aanwijzing voor een gesprek, geen diagnose, en nooit een label.
- **Meaning preservation in oudercommunicatie.** Bij gevoelige berichten ziet de
  docent vóór verzenden de terugvertaling, met de betekenisverschillen
  gemarkeerd: *"moet aanwezig zijn" kwam terug als "zou aanwezig moeten zijn".*
  De docent corrigeert vóór verzending. Een vertaal-API zonder terugblik is bij
  leerplicht en zorg te gevaarlijk.
- **Family Bridge.** Een ouder die geen Nederlands spreekt moet vanaf dag één
  zelfstandig kunnen ziekmelden, toestemming geven, een gesprek plannen, een
  rapport lezen, een factuur begrijpen en een bericht beantwoorden -- en alles
  komt in het Nederlands terug bij het personeel.

---

## 9. Teacher Flow -- bijna geen administratie tijdens een les

Doelstelling, hard: **een docent voert tijdens een normale les vrijwel niets in.**
De les opent zichzelf, de klas staat aanwezig, hij tikt alleen de afwijkingen.
Leerdoelen en oefeningen staan klaar, werk stroomt binnen, foutpatronen worden
gegroepeerd. Aan het eind één vraag -- *les afronden?* -- met een concept van
aanwezigheid, behandelde leerdoelen, materiaal, voortgang en vervolgactie, en één
handeling: bevestigen.

Daaromheen:

- **Teaching Memory.** Volgend jaar dezelfde les: *vorig jaar liep 3B vast bij
  onderdeel C; uitleg B werkte beter dan A; vraag 17 bleek moeilijker dan
  bedoeld.* Niet alleen het kind leert; de les leert.
- **Institutional Memory.** Personeel vertrekt en neemt normaal een berg
  operationele kennis mee. Bewaard worden curriculumkeuzes, lesverbeteringen,
  toetskwaliteit, interventies en procesafspraken -- met besluit, eigenaar,
  datum en bewijs. Geen vrije AI-samenvattingen over mensen, en geen roddel.
- **Substitute Teacher Mode.** Docent ziek om 07:42: de vervanger opent het
  scherm en krijgt de les, het materiaal en het strikt noodzakelijke -- geen
  zorgdossier, tenzij expliciet noodzakelijk én toegestaan.
- **New Teacher Autopilot.** Een nieuwe docent krijgt vijf dingen, niet
  vijfhonderd. De rest komt als hij eraan toe is.
- **Attention OS.** Eén lijst per dag: nu / voor het eind van de dag / kan
  wachten. Geen 57 meldingen uit vijf hoeken van hetzelfde systeem.

---

## 10. Toetsen als vak -- Assessment Compiler, Fairness Engine, Fingerprint

De docent zegt niet "maak dertig vragen" maar *ik wil betrouwbaar meten of 2 havo
doelen A t/m F beheerst.* Daarop controleert de compiler dekking,
moeilijkheidsverdeling, vraagvormen, verwachte tijd, taalbelasting, itemoverlap
en toegankelijkheid -- en zegt bijvoorbeeld: *deze toets meet doel E
onvoldoende.* AI is hier geen vraaggenerator maar een toetsconstructeur.

**Fairness Engine.** Een natuurkundevraag die vooral taalvaardigheid meet, is een
kapotte vraag. Het systeem markeert onnodige taalcomplexiteit en niet-noodzakelijke
culturele context; de docent beslist.

**Assessment Fingerprint.** Na afname krijgt niet alleen de leerling een uitslag
maar ook de toets zelf: p-waarde per vraag, onderscheidend vermogen, onverwachte
foutpatronen, mogelijke dubbelzinnigheid. Zo wordt de toetsbank elk jaar
aantoonbaar beter in plaats van elk jaar ouder.

**Belasting.** Zes docenten geven onafhankelijk huiswerk; het systeem ziet de
donderdag van de leerling. En de docent ziet zijn eigen week: eenennegentig open
antwoorden naast een rapportdeadline is een planningsfout, geen karakterfout.
Werkdrukhulp -- **nooit** een prestatiemeter over personeel (§11).

---

## 11. De grenzen

Waar een functie botst met een grens, vervalt de functie. Dit is het zwaarste
hoofdstuk van dit document.

1. **Een kind krijgt geen score buiten het potje.** Geen risicoscore, geen
   uitvalkans, geen ranglijst, geen niveau-label dat blijft plakken. Signalen
   zijn factoren met hun rekensom; de lijst staat op naam en nooit op zwaarte.
   Bestaande regel, blijft staan: alles wat een prestatie buiten de sessie
   bewaart, valt onder `progressieMag` (18+), en School houdt vast aan **"leren
   is geen wedstrijd"**.
2. **De AI stelt geen schooladvies vast, kent geen niveau toe en verleent geen
   toegang.** Zij stelt voor; een mens besluit, met naam en moment. Dit is de
   schoolvariant van de bestaande huisregel dat AI nooit zelf toegang belooft.
3. **Human Override is een grondrecht, geen instelling.** Elke geautomatiseerde
   aanbeveling heeft een zichtbare uitweg: *niet passend, want ...*. De correctie
   wordt vastgelegd; het systeem leert niet stilzwijgend van vrije tekst.
4. **Child Context Firewall.** Niet elke AI krijgt hetzelfde kindbeeld. De
   huiswerk-AI ziet leerdoelen en werk, niet het zorgdossier, niet incidenten,
   niet de gezinssituatie. De vertaal-AI ziet de tekst die vertaald moet worden
   en verder niets. Minimale context per taak, per doel vastgelegd.
5. **AI Receipt.** Elke betekenisvolle AI-uitvoer draagt een bonnetje: welke
   gegevens wél gebruikt, welke expliciet niet, welk model, welk beleid, welk
   moment, en wie het heeft goedgekeurd. Zonder bonnetje geen uitvoer richting
   een gezin.
6. **Geen surveillance.** Geen camera-AI op gezichten, geen aandachtsscore, geen
   biometrie, geen toetsaanslagbewaking. Klassikaal inzicht komt uit interactie
   met het leerproces zelf: *achttien bezig, vier klaar, twee vragen hulp*.
7. **Geen looproute.** Van een pas bestaat alleen de huidige stand. Bestaande
   regel in `school/veiligheid.js`, en hij geldt ook voor elke toekomstige laag.
8. **Werkdruk is hulp, geen beoordeling.** Tijdmetingen over personeel dienen om
   werk te verdelen. Er komt geen productiviteitscijfer per docent, geen
   ranglijst, en geen veld waarin iemand aan een score hangt -- dezelfde regel
   die de anonieme peiling al draagt.
9. **Welzijn wordt niet gescoord.** Een belonging-check mag gesteld worden, maar
   levert geen psychologisch profiel en geen individuele score. Geaggregeerde
   trends, en individuele opvolging alleen waar beleid en toestemming dat
   toelaten.
10. **Registratie verdwijnt niet.** Uitschrijven wist geen dossier; een overstap
    laat een spoor na. Wat wanneer echt weg mag, staat in de bewaartermijnen en
    niet in een knop.
11. **Codenamen blijven codenamen.** De onderwijsdata draait op codenamen; echte
    namen staan in de identiteitskluis. Geen enkele nieuwe laag hierboven mag die
    scheiding omzeilen -- ook niet "voor het gemak van de docent".
12. **Geen enkele externe standaard dicteert ons domeinmodel.** Edu-V, Entree,
    Edu-API, OSO: adapters eromheen, canoniek model binnen. Andersom is
    permanente schade.

---

## 12. No-Lost-Child -- het enige proces dat harder is dan de rest

De hulplijn bestaat (`school/hulplijn.js`): één knop voor het kind, acuut apart,
vertrouwelijk apart. Wat ontbreekt is de **bewaking van opvolging**.

```
HELP_GEVRAAGD -> toegewezen mentor -> gezien binnen X -> afspraak? -> afgerond
```

Reageert niemand, dan verdwijnt de vraag niet stil maar escaleert hij. En de
grens erbij, die even hard is als het proces zelf:

> **Het systeem bewaakt dát er opvolging plaatsvindt. Het systeem beslist nooit
> wat er met het kind aan de hand is.**

De drempel blijft daarbij extreem laag: *"❤️ ik wil iemand spreken"*, zonder
formulier, met daarna hooguit twee keuzes (wanneer, en van wie).

---

## 13. Identiteit, koppelingen en continuïteit

- **Universal School Identity.** Eén leerlingidentiteit via RTG iD, en
  interoperabel met de **Entree Federatie** -- geen gesloten eiland ernaast.
- **Integration Fabric.** Intern het canonieke onderwijsmodel; extern adapters
  voor Edu-V, Entree, Edu-API, OSO en overheidsdiensten. Vandaag staan die als
  *labels* in `school/koppelingen.js` en niet als implementatie; dat is eerlijk
  in de code en oneerlijk in een verkooppraatje.
- **Transition Continuity.** Bij een overstap gaat niet "dossier.zip" mee, maar
  per doel: nodig voor inschrijving / nodig voor onderwijscontinuïteit / alleen
  met specifieke toestemming / niet overdraagbaar.
- **Future Passport.** Na twaalf jaar geen cijferexport maar een portfolio met
  kennis, vaardigheden, projecten, talen en verifieerbare credentials -- waarvan
  de leerling binnen de wettelijke grenzen zelf bepaalt wat hij deelt.
- **Offline School.** Een internetstoring stopt geen schooldag. Presentie,
  materiaal en oefenen werken door; mutaties dragen apparaat, lokale tijd,
  synctijd en conflictstatus. Bij een conflict kiest een mens -- er wordt nooit
  stil overschreven.

---

## 14. Wat wij bewust NIET bouwen

- Geen proctoring met camera- of gedragsbewaking. Safe Exam Mode schakelt hulp
  uit; het bespioneert geen kind.
- Geen automatische maatregel op een signaal. Een signaal leidt tot een gesprek.
- Geen AI die zelfstandig met een leerling communiceert buiten het leerdomein.
- Geen tweede rechtenmodel naast rollen en rechten van `school/rollen.js`.
- Geen "engagement"-mechaniek: geen streaks, geen badges die iets buiten de
  sessie bewaren, geen oneindige lijst. Bestaande huisregel, hier bevestigd.
- Geen tweede leerlingenlijst. School Core is de wortel: een leerling bestaat
  één keer (LAT-regel 4).

---

## 15. De bouwvolgorde

Er is één juiste eerste stap, en het is niet de spannendste.

1. **De Fabric en de brandstof.** Structuur: gedaan (`vereist`, `uitleg[]`,
   `meting`, plus de keuring die bij het opstarten gooit). Brandstof: het
   basisonderwijs af, het vo op de kern van twintig vakken, het vervolgonderwijs
   een begin. Verdiepen per fase blijft werk -- maar het is nu vullen van een
   bestaande vorm en niet meer omzetten.
2. **Proof of Learning.** Bewijs onder elke beheersing, en het scherm dat de
   vraag "waarom denkt RTG dat ik dit kan?" beantwoordt.
3. **Memory Engine.** Retentiestand per node en de drie herhaalvragen.
4. **Misconception Graph + Explain Differently.** Foutpatronen classificeren en
   dezelfde stof anders aanbieden.
5. **Daily Learning Guarantee.** Het dagbudget dat uit 1 t/m 4 volgt -- en pas
   dán, want een dagplan zonder inhoud is een lege agenda.
6. **Teacher Flow en Attention OS.** Administratie als bijproduct.
7. **Taallaag en Family Bridge.** Meaning preservation vóór massale uitrol.
8. **No-Lost-Child opvolgbewaking.**
9. **Assessment Compiler, Fairness Engine, Fingerprint.**
10. **Integration Fabric** (Edu-V, Entree, Edu-API, OSO) -- als adapters.

Elke stap krijgt zijn meting uit §7 mee, en elke grens uit §11 wordt door een
toets bewaakt die iemand heeft zien zakken (LAT-regel 2).

---

## 16. De vijf dingen die mensen over vijf jaar mogen onthouden

1. **RTG Today** -- iedere leerling krijgt iedere dag zijn eigen leerroute.
2. **RTG Language Bridge** -- hetzelfde onderwijs in 114 talen, zonder het leren
   van Nederlands weg te nemen.
3. **RTG Learning Proof** -- geen zwarte doos, maar aantoonbaar waarom iemand
   iets beheerst.
4. **RTG Human Signal** -- hulpvragen worden nooit een diagnose, en raken nooit
   zoek.
5. **RTG Teacher Flow** -- lesgeven, presentie, differentiatie, toetsen,
   nakijken en vervolg uit één werkstroom.

En daarboven de ambitie waaruit ze allemaal volgen:

> RTG School probeert de docent niet slimmer te vervangen. Het probeert de school
> zó te organiseren dat docent en leerling tijd overhouden voor wat alleen mensen
> goed kunnen.
