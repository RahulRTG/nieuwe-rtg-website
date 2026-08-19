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
| Proof of Learning | elke beheersing draagt haar bewijs; zes soorten, zelfgemeld telt minder, school bevestigt | `kern/onderwijs-bewijs.js`, `school/bewijs.js` |
| Memory Engine | herhaalmoment per behaald doel; drie vragen, reeks 2/7/21/60/180 dagen | `kern/onderwijs-geheugen.js`, `kern/leerstof-herhalen.js` |
| Misconception Graph | 18 denkpatronen uit het feit van de opgave; klasbeeld zonder wie | `kern/leerstof-denkfout.js`, `school/denkfout.js` |
| Daily Learning Guarantee | dagplan uit huiswerk, herhalingen en leerlijn; vijf stukken, niets bewaard | `kern/leerstof-dag.js`, `school/dag.js` |
| Attention OS en Teacher Flow | een lijst in drie bakken, les afronden in een handeling, lesgeheugen | `school/aandacht.js`, `school/les.js` |
| Vervanger en nieuwe docent | briefing zonder zorgdossier, waarneming met einddatum, vijf stappen | `school/instap.js`, `school/waarneming.js` |
| Taallaag en Family Bridge | vakbeleid met een harde regel, terugvertaling met betekeniscontrole, bon | `kern/taalbeleid.js`, `kern/betekenis.js`, `school/taalpoort.js` |
| No-Lost-Child | de keten na de hulplijn, escalatie zonder naam of tekst, twee keuzes na de knop | `kern/opvolging.js`, `school/opvolging.js` |
| Toets als meetinstrument | keuring vooraf op echte opgaven, spiegel achteraf met een ondergrens van vijf | `kern/toetsbouw.js`, `kern/toetsspiegel.js`, `school/toetskeuring.js` |
| Belasting | de dag van de leerling over klassen heen, de week van de docent, niets bewaard | `kern/belasting.js`, `school/belasting.js` |
| Overdracht en adapters | pakket per doel met een restlijst; vertaling naar vier standaarden, met wat ze niet kunnen | `kern/overdracht.js`, `kern/koppelvlak.js`, `school/overdracht.js` |
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

> **Gebouwd op 19 augustus 2026.** Elk behaald leerdoel draagt een
> herhaalmoment, wat terugkomt zijn drie korte vragen, en die lopen door
> dezelfde weg als een gewone oefensessie.

Schoolsoftware kijkt naar gisteren. Deze laag kijkt naar wat een leerling
**dreigt te vergeten**. Elke beheerste node krijgt een retentiestand en een
herhaalmoment; wat terugkomt zijn drie korte controlevragen, niet de hele les
opnieuw.

De regel eromheen: **herhalen is geen straf en geen achterstand.** Een
herhaalvraag ziet er in het scherm hetzelfde uit als een nieuwe vraag, en er
komt geen enkele markering bij die zegt "dit had je moeten weten".

**Die belofte staat in de weg zelf en niet in het scherm.** Een herhaalsessie
zet zichzelf in dezelfde sessieplek als een oefensessie en wordt beantwoord
door dezelfde functie; alleen het starten gaat langs een eigen route, en alleen
het einde loopt anders af. Er is met opzet geen `herhaal-antwoord`: een tweede
antwoordweg is precies de plek waar het verschil alsnog binnensluipt.

**En de server meldt niet hoe laat het is.** Wat openstaat komt terug als een
naam en een vak, zonder datum en zonder aantal dagen. Dat is geen keuze van het
scherm: er kan geen "je bent twaalf dagen te laat" op een scherm belanden omdat
het nergens vandaan te halen is. Wat nog moet komen draagt wel een datum -- een
vooruitzicht is geen verwijt.

**De reeks in dagen is 2, 7, 21, 60, 180.** Een geslaagde ophaling zet een
trede hoger; een mindere zet **een** trede terug en nooit naar nul, en laat het
doel binnenkort terugkomen. Wie het na twee maanden even kwijt is, begint niet
opnieuw bij af. Een leerdoel raak je door een mindere ronde niet kwijt, en er
wordt geen bewijs vastgelegd van wat er niet lukte: dit huis houdt geen dossier
bij van de missers van een kind.

**Wat je op school laat zien, hoef je thuis niet nog eens.** Bewijs van school
(een becijferde toets, een observatie) schuift het moment vooruit -- alleen
vooruit, want dit mag een herhaling nooit naar voren halen.

Twee dingen die eruit volgen. Een geslaagde herhaling na weken is **beter
bewijs** dan de eerste sessie, dus ze telt mee in Proof of Learning als een
eigen soort. En een leerdoel van vóór deze laag krijgt zijn eerste moment bij
de eerste keer kijken en niet met terugwerkende kracht: dat laatste zou een
leerling met honderd doelen op dag een honderd herhalingen geven, en dat is
precies de berg waar deze laag tegen bedoeld is.

---

## 5. De Misconception Graph -- een fout is geen fout maar een denkfout

> **Gebouwd op 19 augustus 2026.** Achttien denkpatronen, geduid uit het feit
> van de opgave; de leerling krijgt de duiding en meteen een andere uitleg, de
> klas krijgt de telling zonder wie.

`antwoord = fout` is de armste vorm van informatie die een schoolsysteem kan
bewaren. Rijker: **welk denkpatroon** leidde ertoe.

```
maal.plus-in-plaats-van-maal   -- 3 x 7 = 10: opgeteld in plaats van vermenigvuldigd
breuken.noemer-opgeteld        -- 1/3 + 1/3 = 2/6: de noemer meegeteld
eenheden.niet-omgerekend       -- 1 meter = 1 centimeter: het getal laten staan
dt.t-vergeten                  -- hij ___ met de kale stam
```

**Hoe dit werkt zonder te raden.** Een opgave draagt sinds deze laag een
*feit*: de bouwstenen waaruit hij is gemaakt (de twee getallen, de bewerking,
de noemer, de eenheid). Dat feit blijft op de server -- de client krijgt alleen
de vraag -- en daarmee is een fout antwoord narekenbaar te duiden. Geen model,
geen gok: 3 x 7 met antwoord 10 **is** 3 + 7, en anders zeggen we niets.

**Liever niets dan een gok.** Past een fout op geen enkele regel, dan is het
gewoon een fout en staat er niets extra's. Een verzonnen denkfout is erger dan
geen: hij stuurt een kind een verkeerde uitleg in. Een specifieke duiding gaat
bovendien altijd vóór een algemene -- 3 x 7 = 5 is geen telfout maar een plus.

**Twee keer hetzelfde weegt zwaarder dan ontbrekende voorkennis.** Wie binnen
één sessie twee keer hetzelfde denkt, mist geen bouwsteen maar heeft een stap
anders geleerd; dan wijst het advies daarheen in plaats van naar de leerlijn
eronder.

Wat dat oplevert is niet een cijfer maar een les: *dit denkpatroon is deze week
elf keer langsgekomen bij dit leerdoel.* Daar hoort een klassikale mini-uitleg
bij -- en die maakt de docent beter, in plaats van hem te vervangen. Een patroon
dat de leraar heeft besproken verdwijnt uit het overzicht; dat is geen
opruimknop maar de werkwijze, want een berg oude signalen betekent niets meer.

**Geteld en niet bijgehouden wie.** In de klas staat per leerdoel per denkfout
een aantal en een laatste datum, en verder niets: geen leerlingsleutel, geen
lijst, geen weg terug naar een kind. Daarom staat er "elf keer" en niet "elf
van de zesentwintig leerlingen" -- dat laatste vraagt om identiteit, en die
wordt hier niet vastgelegd. De prijs is dat een leraar niet ziet wie het was;
de winst is dat niemand het ooit kan opvragen. De toets meet dat op de
**opslag** en niet op het antwoord, want een sleutel die stil in de database
belandt is precies wat een dossier van de missers van een kind zou worden.

Daaraan vast zit **Explain Differently**: hetzelfde leerdoel, andere
representatie. Eenvoudiger, visueel, stap voor stap, als praktijkvoorbeeld, als
verhaal, met analogie, in de thuistaal, tweetalig, of juist een niveau hoger.
Het leerdoel verandert niet; de weg ernaartoe wel. Dat is een sterker gebruik
van generatieve AI dan een chatbot naast het scherm.

---

## 5b. De Daily Learning Guarantee -- elke dag weet je waar je staat

> **Gebouwd op 19 augustus 2026.** Een dagplan uit wat er al is, begrensd op
> vijf stukken, met per stuk de reden erbij -- en er wordt niets van bewaard.

Deze laag verzint niets nieuws; ze brengt bij elkaar wat §2 tot en met §5
hebben opgeleverd. Wat er in een dag komt:

1. **wat de school vroeg** -- huiswerk met een leerdoel, van een mens die deze
   klas kent, en dat weegt zwaarder dan wat de motor zelf voorstelt;
2. **wat terugkomt** -- de openstaande herhalingen uit §4;
3. **waar je gebleven bent** -- het eerste doel in je leerlijn dat nog open
   staat en waarvan de voorkennis wél af is.

**De garantie is niet "er is altijd werk" maar "je weet altijd waar je
staat".** Een leerling zonder fase krijgt de ladder te zien in plaats van een
lege lijst; een leerling die zijn fase rond heeft, krijgt dat te horen met de
volgende trede erbij. En een kind dat de school in een klas heeft geplaatst
zonder ooit zelf een fase te kiezen, draait op de fase van de klas -- juist die
leerling zou anders alleen huiswerk zien, en juist voor hem is dit bedoeld.

**Er wordt niets bewaard, en dat kan ook niet.** `kern/leerstof-dag.js` krijgt
geen `db` en geen `save` mee. Dat is geen vergetelheid maar het ontwerp: een
plan dat je niet kunt opslaan, kun je later ook niet stiekem laten tellen. Geen
reeks, geen "vijf dagen achter elkaar", geen percentage af, geen lijst van wat
een kind niet heeft gedaan. Zo'n teller is het verslavende patroon dat dit huis
niet bouwt, en hij zou bovendien over de 18+-grens van de progressielaag heen
stappen.

**Het is een voorstel en het is begrensd.** Wie veertig herhalingen open heeft
staan, ziet er geen veertig: een berg is geen plan, en de rest komt vanzelf een
andere dag. Elk stuk draagt zijn reden in gewone taal, zodat het een uitnodiging
is en geen bevel van een machine. De vijf is een belofte en geen instelling --
hem verhogen laat een toets zakken, zodat iemand er nog een keer over nadenkt.

Wat er bewust **niet** in staat: een doel waarvan de voorkennis nog open is
(dat is precies de opgave waar een kind op vastloopt zonder te weten waarom),
en tijdsdruk die wij verzinnen. Een deadline van de leraar staat er zoals hij
is, zonder aftelklok.

---

## 6. Proof of Learning -- waarom denkt RTG dat ik dit kan?

> **Gebouwd op 19 augustus 2026.** Elk behaald leerdoel draagt zijn bewijs, de
> leerling kan het opvragen, en een becijferde schooltoets landt vanzelf in het
> paspoort. Wat hieronder staat is dus geen plan meer maar de beschrijving van
> wat er draait.

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

**Vijf soorten bewijs, en niet alles weegt even zwaar.** Een oefensessie, een
oefen-huiswerk en een praktijkopdracht meld je zelf; een toets en een
observatie komen van school, met de naam van wie het zag. Alleen met
bevestiging van buiten je eigen sessies kan een beheersing **sterk** worden --
anders is "bevestigd door school" een vinkje dat iedereen zelf zet. De server
weigert een leerling die zichzelf een toets toekent.

**Wat sterk maakt is onafhankelijkheid, geen hoeveelheid.** Twee bevestigingen
van school (een toets en een observatie) wegen zwaarder dan drie eigen
oefensessies achter elkaar: die kunnen alle drie op dezelfde goede dag vallen.

**En er komt geen getal uit.** De beheersing is een woord -- enkel, stevig,
sterk -- met de telling erbij. Geen percentage, geen vergelijking, geen
ranglijst; het woord wordt bovendien niet opgeslagen maar telkens uit het
bewijs afgeleid, want een opgeslagen oordeel raakt los van waar het op stoelde.

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
| Beheersing draagt altijd haar bewijs | elk behaald doel heeft bewijsregels; een leerling kan ze opvragen | **ja** (`test/bewijs.test.js`) |
| Een leerling bevestigt zichzelf niet | toets en observatie alleen via school | **ja**, met mutatie beproefd |
| Een herhaalvraag ziet eruit als een nieuwe vraag | zelfde kaart, zelfde antwoordroute; geen tweede weg | **ja** (`test/schoolschermen.test.js`) |
| Herhalen meldt nooit hoe laat je bent | de open lijst draagt geen datum en geen achterstand | **ja**, met mutatie beproefd |
| Een mindere herhaling wist niets | leerdoel blijft staan, reeks valt EEN trede terug | **ja** (`test/geheugen.test.js`) |
| Een denkfout wordt nooit gegokt | past niets, dan zegt de server niets | **ja** (`test/denkfout.test.js`) |
| De klas telt patronen zonder wie | opslagvorm is aantal + datum, meer niet | **ja**, op de opslag met mutatie beproefd |
| Het feit van een opgave verlaat de server niet | met de bouwstenen is het antwoord uit te rekenen | **ja** (`test/denkfout.test.js`) |
| Een ingeschreven leerling weet elke dag wat er klaarstaat | dagplan levert minstens een stuk zolang er iets open is | **ja** (`test/dagplan.test.js`) |
| Een dagplan telt nooit over dagen heen | de module krijgt geen db en geen save | **ja**, met mutatie beproefd |
| Een dagplan is hoogstens vijf stukken | harde bovengrens in de toets, niet de constante zelf | **ja**, met mutatie beproefd |
| De werklijst van een leraar noemt geen kind | geen naam, geen sleutel, geen tekst van een melding | **ja**, met mutatie beproefd |
| Niemands tempo wordt gemeten | de aandachtslijst schrijft niets weg | **ja** (`test/teacherflow.test.js`) |
| Een les rondt zichzelf niet af | bevestiging en naam verplicht, anders 400 | **ja**, met mutatie beproefd |
| Een lesverslag draagt alleen de telling | vaste lijst velden, op de opslag getoetst | **ja**, met mutatie beproefd |
| Een vervanger ziet geen zorgdossier | de vorm van de briefing ligt vast | **ja**, met mutatie beproefd |
| Een waarneming verloopt | de klas-poort weigert een verlopen waarnemer | **ja** (`test/instap.test.js`) |
| Een nieuwe docent krijgt er nooit meer dan vijf | alle standen nagerekend, geen afkapgrens | **ja**, met mutatie beproefd |
| Een taalvak kan nooit volledig vertaald | het maximum staat in de kern, niet in een instelling | **ja**, met mutatie beproefd |
| Een teruggezette keuze wordt gemeld | het antwoord noemt het vak en de reden | **ja**, met mutatie beproefd |
| Verschoven betekenis houdt een bericht tegen | ontkenning, verplichting, getal en datum geteld | **ja**, met mutatie beproefd |
| Geen bonnetje, geen bericht | elk verstuurd bericht draagt model, gebruik en naam | **ja** (`test/taallaag.test.js`) |
| De bewaking weegt de inhoud nooit | zelfde melding met en zonder tekst geeft hetzelfde oordeel | **ja**, met mutatie beproefd |
| Een onbeantwoorde hulpvraag escaleert | acuut na twee uur, anders na een schooldag | **ja** (`test/opvolging.test.js`) |
| Een escalatie wijst niet terug naar een kind | vaste lijst velden, los getoetst | **ja**, met mutatie beproefd |
| Afronden kan niet zonder dat iemand keek | 409 zolang er geen gezien-moment is | **ja**, met mutatie beproefd |
| De keuring verandert niets aan een toets | ze geeft opmerkingen terug, geen toets | **ja** (`test/toetskeuring.test.js`) |
| Talige zwaarte telt bij een zaakvak, niet bij taal | de knip komt uit het taalbeleid | **ja**, met mutatie beproefd |
| Onder vijf gemaakte toetsen geen spiegel | hard getal in de toets, niet de constante | **ja**, met mutatie beproefd |
| De spiegel noemt geen leerling | vaste sleutelverzameling per leerdoel | **ja**, met mutatie beproefd |
| De dag van een kind telt over klassen heen | werk uit andere klassen telt mee in het klasbeeld | **ja**, met mutatie beproefd |
| Van elders komt alleen een aantal | de weekweergave draagt geen vaknaam en geen titel | **ja**, met mutatie beproefd |
| Het advies gaat over verplaatsen | geen woord over sneller of achterstand | **ja**, met mutatie beproefd |
| Zorg gaat ook met toestemming niet mee | 'nooit' kent geen vinkje | **ja**, met mutatie beproefd |
| Een pakket zegt wat er niet in zit | weggelaten-lijst met een reden per gegeven | **ja**, met mutatie beproefd |
| Ons model groeit niet mee met een koppelvlak | onbekend veld van buiten wordt geweigerd en gemeld | **ja**, met mutatie beproefd |
| Elke standaard zegt wat hij niet kan | kanNiet-lijst per standaard, ook op het scherm | **ja**, met mutatie beproefd |
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

> **Gebouwd op 19 augustus 2026.** Het vakbeleid met de harde regel, en de
> poort naar het gezin met de terugvertaling en het bonnetje. De Language
> Independence Test staat er nog niet -- zie het eind van deze paragraaf.

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

### Wat er van deze paragraaf staat, en onder welke grenzen

**Drie standen van steun, en het Nederlands verdwijnt nooit.** *Volledig* (les
en uitleg mogen in de thuistaal ernaast), *instructie* (alleen de vraagstelling
mag mee; de te meten inhoud blijft Nederlands) en *geen*. Steun staat er altijd
NAAST en vervangt niets: naast elkaar lezen is precies hoe je een taal erbij
leert.

**De harde regel is geen instelling.** Een school mag dit beleid aanpassen --
scholen verschillen, en wie hier lesgeeft weet beter wat zijn kinderen nodig
hebben. Maar bij een taalvak kan het nooit op *volledig*. Dat is de meting zelf:
een school die dat aanzet, meet vanaf dat moment niets meer en merkt het pas bij
het examen. Vandaar dat de regel in de kern staat en niet in een schermpje met
een schuifje, en dat het opslaan de keuze al terugzet. Een onbekend vak valt
terug op *instructie*: een vak dat we niet kennen kan een taalvak zijn.

**Terugzetten gebeurt hardop.** Wordt een keuze bijgesteld, dan zegt het
antwoord welk vak en waarom. Stil bijstellen is erger dan weigeren: dan denkt
een school dat het aanstaat.

**Meaning preservation is een telling en geen oordeel.** Vier dingen mogen er
nooit uit vallen, en dat zijn precies de vier waar het misgaat: een ontkenning
(*niet, geen, nooit*), een verplichting (*moet* dat terugkomt als *zou moeten*),
een getal (12,50 dat 1250 wordt) en een datum. De controle vergelijkt het
origineel met de terugvertaling en telt; ze kan niet hallucineren en ze werkt
ook zonder model.

Dat laatste is opzet. **Een model laten beoordelen of een vertaling klopt, is
het probleem met zichzelf laten nakijken**: dezelfde soort fout die de vertaling
maakte, maakt de beoordeling. Wat de telling niet kan is nuance beoordelen --
daarvoor is de mens er, en die is hier het sluitstuk en geen formaliteit.

**Geen bonnetje, geen bericht** (grens 5). Elk vertaald bericht dat een gezin
bereikt draagt een bon: welk model, welke gegevens wél en welke expliciet níét,
wanneer, en op wiens naam. De vertaal-AI ziet alleen de tekst -- geen kindnaam,
geen dossier, geen klas (grens 4) -- en dat staat op diezelfde bon. Verschuift
er iets in een ontkenning, verplichting, getal of datum, dan is bevestigen niet
genoeg: dan zegt de docent apart dat hij het gezien heeft. En is er geen
vertaling te maken, dan gebeurt er niets stils: het bericht gaat niet "maar toch
even" in het Nederlands de deur uit.

**De Language Independence Test staat er nog niet, en dat is een keuze.** Hij
vraagt om dezelfde conceptuele vraag in een tweede taal, en de opgaven komen
hier uit generatoren die Nederlandse zinnen bouwen. Een vraag half vertalen
levert een andere vraag op, en dan meet de test iets anders dan hij belooft. Wat
er eerst moet komen is een taalvorm voor de opgavesjablonen zelf; tot die er is,
zou de uitkomst een aanwijzing zijn die op niets stoelt -- en juist bij deze
functie is dat gevaarlijk, want ze gaat over hoe je naar een kind kijkt.
  De docent corrigeert vóór verzending. Een vertaal-API zonder terugblik is bij
  leerplicht en zorg te gevaarlijk.
- **Family Bridge.** Een ouder die geen Nederlands spreekt moet vanaf dag één
  zelfstandig kunnen ziekmelden, toestemming geven, een gesprek plannen, een
  rapport lezen, een factuur begrijpen en een bericht beantwoorden -- en alles
  komt in het Nederlands terug bij het personeel.

---

## 9. Teacher Flow -- bijna geen administratie tijdens een les

> **Gebouwd op 19 augustus 2026.** Het Attention OS (een lijst in drie bakken),
> de les afronden in een handeling, het lesgeheugen dat terugkomt bij dezelfde
> leerstof, en de twee mensen die hier voor het eerst staan: de vervanger en de
> nieuwe docent.

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

### Wat er van deze paragraaf staat, en onder welke grenzen

**De indeling komt uit een regel en niet uit een gevoel.** Wat in *nu* staat,
staat daar omdat een kind de hulplijn heeft gebruikt en zei dat het niet kan
wachten, of omdat de klas vandaag nog niet is afgetekend. Niet omdat iets rood
mag kleuren.

**Eén regel per soort, met het aantal erbij.** Twaalf niet-becijferde toetsen
zijn één taak en geen twaalf taken. Dat is het verschil tussen een lijst en een
inbox.

**Er staat niets over een kind in.** Een regel zegt wát er wacht en hoevéél, en
wijst naar het scherm waar het hoort -- geen namen, geen tekst van een melding.
Een aandachtslijst die de noodkreet van een kind citeert, wordt gelezen door
iedereen die over een schouder meekijkt. De hulpvraag zelf staat achter de knop,
op het scherm dat ervoor is.

**Er wordt niets bewaard.** `school/aandacht.js` schrijft niet; de lijst wordt
telkens uitgerekend. Er is dus geen geschiedenis van hoe snel een leraar zijn
lijst leegwerkt, en die kan er later ook niet stilletjes bij komen -- grens 8:
werkdruk is hulp, geen beoordeling.

**Het afronden is één handeling, door een mens.** Het concept komt uit wat er
vandaag toch al gebeurde: de presentie, de leerdoelen die aan de orde waren, de
denkpatronen van vandaag. Zonder bevestiging én een naam gebeurt er niets --
dezelfde regel als bij het rapport.

**Een lesverslag gaat over de les en niet over kinderen.** Van de presentie gaat
alleen de *telling* mee; er komt geen leerlingsleutel en geen naam in. Wie er
was, staat in de presentielijst en hoort niet in een verslag dat jaren blijft
liggen. De vorm van dat verslag staat als lijst velden in de code en wordt op de
**opslag** getoetst, niet op wat een scherm ervan terugkrijgt.

**De vervanger krijgt de klas en verder niets.** De briefing draagt de klas, de
namen (zonder naam kun je niemand aanspreken en geen presentie aftekenen), wat
er vandaag speelt, het materiaal met een tweede uitleg erbij, en wat eerdere
lessen erover schreven -- juist hij heeft daaraan wat, want hij kent de klas
niet. Geen zorgdossier, geen incidenten, geen gezinssituatie: grens 4, de Child
Context Firewall. En de briefing **zegt zelf wat er niet in staat**, want een
vervanger die denkt dat hij alles ziet, gaat ervan uit dat er niets speelt --
en dat is precies het moment waarop een kind tussen wal en schip valt. De vorm
van die briefing ligt vast als een lijst velden en wordt daarop getoetst; er een
zorgveld bij zetten laat een toets zakken.

**Een waarneming verloopt vanzelf.** Een overname zonder einddatum is een tweede
vaste leraar via de achterdeur: ze begint als "even invallen bij ziekte" en
staat er een half jaar later nog. Veertien dagen als de aanvrager niets zegt,
negentig als maximum, en de klas-poort laat een verlopen waarnemer er niet meer
in. Die regel staat op één plek (`school/waarneming.js`), want hij wordt op twee
plaatsen gebruikt en een begrip met twee kopieën loopt uit elkaar.

**Vijf dingen is geen afkapgrens maar een eigenschap.** De nieuwe docent krijgt
hoogstens vijf stappen omdat er maar vijf dingen tegelijk waar kunnen zijn --
niet omdat er bij vijf wordt afgekapt. Dat verschil is het hele punt: een
afkapgrens verbergt dat er een zesde bijkwam, en de toets loopt daarom álle
standen langs en rekent het maximum na. Wat af is valt weg, en er wordt niets
opgeslagen: geen voortgangsbalk en geen "3 van de 5 voltooid", want dat zou een
prestatiemeter op een mens zijn (grens 8).

**Teaching Memory staat vóór het afronden, niet erna.** Wie deze stof gaat
geven, ziet wat eerdere lessen erover hebben opgeschreven -- wat werkte, waar
het vastliep, door wie en wanneer. Daar heb je iets aan vóór de les, niet na
afloop. En het staat op de school en niet in een kladblok dat vertrekt als de
docent vertrekt: dat is het punt van Institutional Memory.

---

## 10. Toetsen als vak -- Assessment Compiler, Fairness Engine, Fingerprint

> **Gebouwd op 19 augustus 2026.** De keuring vooraf (dekking, vorm, overlap,
> tijd, taalbelasting), de spiegel achteraf met een ondergrens van vijf, en de
> belasting: de donderdag van de leerling en de week van de docent.

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

### Wat er van deze paragraaf staat, en onder welke grenzen

**De compiler bouwt niet, hij keurt.** Er wordt niets automatisch bijgemaakt,
verwijderd of herschreven. Elke opmerking zegt wat er aan de hand is én wat het
kost om het te verhelpen; de docent beslist. Dat is niet uit voorzichtigheid: een
toets is een besluit over kinderen, en een besluit hoort een eigenaar te hebben.

**Ze oordeelt over de echte vraag.** De keuring trekt een paar opgaven uit
dezelfde generator die de toets straks gebruikt. Oordelen over een aanname in
plaats van over de vraag die er komt, is oordelen over niets.

**De Fairness Engine hangt aan het taalbeleid en niet aan een eigen lijst.** Een
talig zware vraag is bij een zaakvak een probleem en bij een taalvak de opgave --
dat onderscheid komt uit `kern/taalbeleid.js` (§8), zodat de twee niet uit elkaar
lopen. Culturele context wordt genoemd maar nooit verwijderd: soms is het precies
de bedoeling, en een compleet cultuurregister bestaat niet. Doen alsof het wel
bestaat is erger dan een korte, herkenbare lijst.

**De spiegel zegt niets onder vijf gemaakte toetsen.** Niet alleen omdat het
statistisch zwak is, maar omdat "de p-waarde van deze toets" bij een klas van één
de uitslag van dát kind ís, met een ander etiket erop. Een getal over de toets
dat feitelijk over een kind gaat, is een omweg om de regel te breken dat een kind
geen score buiten het potje krijgt. De vijf staat als hard getal in de toets en
niet als geïmporteerde constante: een toets die zijn eigen ondergrens leent,
zakt mee als iemand die verlaagt.

**Er is geen p-waarde per vraag, en dat is geen omissie.** Elke leerling krijgt
hier verse opgaven uit een generator, dus "vraag 3" is bij ieder kind een andere
vraag. Een p-waarde per vraag zou een getal zijn dat nergens over gaat. Per
leerdoel kan het wel, want dat is bij iedereen hetzelfde leerdoel.

**En de spiegel gaat over de toets.** Er komt geen leerlingsleutel en geen naam
uit; alles is over de groep geteld. Dat de berekening onderweg per leerling kijkt
-- dat moet, voor het onderscheidend vermogen -- is iets anders dan het naar
buiten laten komen.

**Belasting.** Zes docenten geven onafhankelijk huiswerk; het systeem ziet de
donderdag van de leerling. En de docent ziet zijn eigen week: eenennegentig open
antwoorden naast een rapportdeadline is een planningsfout, geen karakterfout.
Werkdrukhulp -- **nooit** een prestatiemeter over personeel (§11).

**Over klassen heen, want de donderdag van een kind trekt zich niets aan van
vakgrenzen.** Zit een leerling ook in een andere klas, dan telt dat werk mee in
het beeld van deze klas. Wat er van elders **meekomt is een telling en verder
niets**: geen titel, geen vak, geen leraar. Een docent hoort te zien dát er twee
dingen elders op die dag vallen; wat een collega precies opgeeft, gaat hem niet
aan. Een toets telt daarbij alleen mee als er een dag bij staat -- een deadline
zonder dag is er geen.

**Het advies gaat over verplaatsen en niet over harder werken.** Dat is het
verschil tussen hulp en een meetlat, en het is de zin die het onderscheid draagt:
*"Op donderdag komt er veel samen. Verplaatsen scheelt meer dan doorwerken."*

**Er wordt niets bewaard.** `school/belasting.js` schrijft niet; beide beelden
worden telkens uitgerekend. Er is dus geen geschiedenis van hoe snel iemand zijn
stapel wegwerkt, en die kan er later ook niet stilletjes bij komen.

**En er gaat niets naar het kind.** Een drukke dag is een signaal aan wie het
werk zet. Een melding aan een leerling dat het te druk is, verplaatst de last
naar degene die er niets over te zeggen heeft.

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

> **Gebouwd op 19 augustus 2026.** De keten, de escalatie naar de directie
> zonder naam of tekst, en de twee keuzes van het kind na de knop.

De hulplijn bestaat (`school/hulplijn.js`): één knop voor het kind, acuut apart,
vertrouwelijk apart. Wat ontbrak is de **bewaking van opvolging**.

```
HELP_GEVRAAGD -> toegewezen mentor -> gezien binnen X -> afspraak? -> afgerond
```

Reageert niemand, dan verdwijnt de vraag niet stil maar escaleert hij. En de
grens erbij, die even hard is als het proces zelf:

> **Het systeem bewaakt dát er opvolging plaatsvindt. Het systeem beslist nooit
> wat er met het kind aan de hand is.**

De drempel blijft daarbij extreem laag: *"❤️ ik wil iemand spreken"*, zonder
formulier, met daarna hooguit twee keuzes (wanneer, en van wie).

### Wat er van deze paragraaf staat, en onder welke grenzen

**De bewaking ziet de tekst van de melding niet.** `kern/opvolging.js` krijgt
vier dingen: of het kind zelf zei dat het niet kan wachten, wanneer het is
gemeld, en welke stappen er zijn gezet. Meer heeft ze niet nodig om te weten dat
er niemand heeft gekeken -- en met meer zou ze gaan wegen wat er aan de hand is.
Dat is geen bescheidenheid maar het verschil tussen bewaken en beoordelen, en
het is de grens uit deze paragraaf, in code.

**Twee uur en een schooldag.** Acuut betekent dat het kind zelf zei dat het niet
kan wachten; dan is twee uur de grens. Anders een schooldag. Dat zijn geen
doelen om te halen maar het punt waarop iemand anders het moet weten. Zodra
iemand laat weten dát hij gekeken heeft, stopt die klok -- kijken is niet
hetzelfde als klaar, maar het is wel het enige dat de bewaking bewaakt.

**De escalatie vertelt dát er iets ligt, niet wat of van wie.** Het schoolbeeld
voor de directie draagt geen naam, geen tekst en geen sleutel: alleen de klas,
hoe lang het openstaat, en wat er ontbreekt. Dat moet wel -- een vertrouwelijke
melding is juist bedoeld voor als het thuis niet veilig is, en die route mag
niet alsnog opengaan omdat er niemand reageerde. *Bel de klas; open de melding
niet.* De vorm van zo'n escalatie ligt vast als een lijst velden en wordt daarop
getoetst, want een verse melding escaleert nog niet en dan bewijst een lege
lijst niets.

**De twee keuzes komen ná de knop.** Vooraf zou het een formulier zijn, en de
drempel hoort zo laag te blijven dat je hem per ongeluk haalt. Beide keuzes
hebben "maakt niet uit" en beide zijn een wens en geen opdracht aan de school.
Een onbekende keuze levert geen foutmelding op maar valt terug op "maakt niet
uit": een kind dat om hulp vraagt hoort geen formulierfout te krijgen.

**Afronden doet een mens, met zijn naam, en wist niets.** Een melding die
niemand heeft gezien kan niet afgerond zijn, en afgerond betekent dat de melding
blijft staan met wie hem afsloot erbij.

---

## 13. Identiteit, koppelingen en continuïteit

- **Universal School Identity.** Eén leerlingidentiteit via RTG iD, en
  interoperabel met de **Entree Federatie** -- geen gesloten eiland ernaast.
- **Integration Fabric.** Intern het canonieke onderwijsmodel; extern adapters
  voor Edu-V, Entree, Edu-API, OSO en overheidsdiensten. **Gebouwd op 19
  augustus 2026** als *vertaling* (`kern/koppelvlak.js`): heen en terug, met per
  standaard een lijst van wat hij **niet** kan dragen. Er wordt nog niets
  verstuurd en niets opgehaald -- er staat geen verbinding met Edu-V of Entree,
  en zolang die er niet is hoort er niet te worden gedaan alsof.
- **Transition Continuity.** Bij een overstap gaat niet "dossier.zip" mee, maar
  per doel: nodig voor inschrijving / nodig voor onderwijscontinuïteit / alleen
  met specifieke toestemming / niet overdraagbaar. **Gebouwd op 19 augustus
  2026** (`kern/overdracht.js`).

### Wat er van deze twee staat, en onder welke grenzen

**Het pakket zegt altijd wat er niet in zit.** Een overdracht die alleen toont
wat meegaat, laat de ontvangende school denken dat ze alles heeft. Elk pakket
draagt daarom een weggelaten-lijst met de reden per gegeven. Dat is de hele
winst: niet minder delen om het delen, maar **weten wat je niet hebt**.

**"Nooit" is geen instelling.** Zorg, incidenten, het inzagejournaal en signalen
staan op nooit, en daar is geen toestemmingsvinkje voor. Niet omdat toestemming
niets waard is, maar omdat een ouder die onder tijdsdruk een overstap regelt geen
vrije keuze maakt over het zorgdossier van zijn kind -- en omdat zulke stukken
horen bij de school die ze heeft opgebouwd, met hun eigen route en hun eigen
journaal.

**Toestemming is een handeling, geen stand.** Zonder een genoteerde toestemming
(wie, wanneer, welke velden) gaat een toestemmingsveld niet mee. De afwezigheid
van een nee is geen ja.

**Wat niet op de kaart staat, gaat niet mee.** Een onbekend gegeven glijdt niet
stilletjes in een pakket; het valt eruit en wordt gemeld.

**En de volgorde is de grens.** Eerst *wat* er meegaat (`kern/overdracht.js`),
pas daarna *in welke vorm* (`kern/koppelvlak.js`). Zou de standaard eerst komen,
dan bepaalt een koppelvlak wat er over een kind gedeeld wordt -- precies wat
grens 12 verbiedt. In dezelfde geest weigert `naarBinnen` elk veld dat niet op
onze kaart staat: ons model groeit niet mee met wat een leverancier stuurt, en
een veld dat er wél bij hoort komt op de kaart en niet in een uitzondering.
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
- Geen AI die zijn eigen vertaling nakijkt. De betekeniscontrole is een telling
  van ontkenningen, verplichtingen, getallen en data; een model dat zijn eigen
  werk beoordeelt, maakt bij het nakijken dezelfde fout als bij het vertalen.

---

## 15. De bouwvolgorde

Er is één juiste eerste stap, en het is niet de spannendste.

1. **De Fabric en de brandstof.** Structuur: gedaan (`vereist`, `uitleg[]`,
   `meting`, plus de keuring die bij het opstarten gooit). Brandstof: het
   basisonderwijs af, het vo op de kern van twintig vakken, het vervolgonderwijs
   een begin. Verdiepen per fase blijft werk -- maar het is nu vullen van een
   bestaande vorm en niet meer omzetten.
2. **Proof of Learning.** Gedaan: bewijs onder elke beheersing, de knop
   "Waarom?" bij de leerling, de observatie bij de leraar, en de brug van een
   becijferde schooltoets naar het leerpaspoort -- de eerste keer dat een
   schoolmodule het paspoort bijschrijft.
3. **Memory Engine.** Gedaan: retentiestand per behaald doel, de drie
   herhaalvragen door dezelfde weg als een oefensessie, en de kaart "wat komt
   er terug" op beide leerlingschermen.
4. **Misconception Graph + Explain Differently.** Gedaan: achttien
   denkpatronen, geduid uit het feit van de opgave; de duiding en een andere
   uitleg meteen bij de leerling, de telling zonder wie bij de leraar.
5. **Daily Learning Guarantee.** Gedaan: het dagplan dat uit 1 t/m 4 volgt --
   huiswerk vooraan, dan wat terugkomt, dan waar je gebleven bent; begrensd op
   vijf en met niets dat over dagen heen telt (zie §5b).
6. **Teacher Flow en Attention OS.** Gedaan: de lijst in drie bakken, de les
   afronden in een handeling, het lesgeheugen, en de instap van de vervanger en
   de nieuwe docent (zie §9).
7. **Taallaag en Family Bridge.** Gedaan: het vakbeleid met de harde regel en
   de poort naar het gezin met terugvertaling, betekeniscontrole en bon (zie
   §8). De Language Independence Test staat bewust nog open: die vraagt eerst
   om een taalvorm voor de opgavesjablonen.
8. **No-Lost-Child opvolgbewaking.** Gedaan: de keten van gevraagd tot
   afgerond, de escalatie naar de directie zonder naam of tekst, en de twee
   keuzes van het kind na de knop (zie §12).
9. **Assessment Compiler, Fairness Engine, Fingerprint.** Gedaan: de keuring
   vooraf, de spiegel achteraf en de belasting -- de donderdag van de leerling
   over klassen heen, en de week van de docent (zie §10).
10. **Integration Fabric** (Edu-V, Entree, Edu-API, OSO) -- als adapters.
    Gedaan: de vertaling heen en terug met per standaard wat hij niet kan
    dragen, en de overdracht per doel met een restlijst (zie §13). Wat er nog
    niet is: een echte verbinding met een van die diensten. Dat is geen
    vertaalvraag maar een kwestie van sleutels, contracten en een partij aan de
    andere kant.

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
