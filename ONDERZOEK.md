# Het onderzoekssysteem -- vier systemen, en waar ze elkaar raken

RTG doet onderzoek op vier plekken, en dat zijn er met opzet vier en niet een.
Ze onder een generiek "Labs" schuiven zou de vraag wegpoetsen die ze uit elkaar
houdt: **wie mag hier iets beslissen, en waarover?**

| systeem | de vraag die het beantwoordt | waar het staat |
|---|---|---|
| **RTG Labs** (App Store) | Mag deze software hier bestaan, en kunnen we bewijzen waarom? | `kern/appstore/` |
| **RTF Living Lab** | Wat gebeurt er werkelijk in het leven van mensen? | `kern/livinglab/` |
| **RTG Onderzoekslab** | Van idee naar uitrol: werkt dit, en is het veilig? | `kern/onderzoekslab.js` |
| **Labfonds** | Welk onderzoek financieren de leden, en per locatie? | `kern/labfonds.js` |

Het eerste onderzoekt SOFTWARE, het tweede MENSEN in hun leefomgeving, het derde
de ONTWIKKELING van idee tot uitrol, het vierde het GELD. Ze delen geen
vocabulaire, en dat is te zien: het Onderzoekslab kent velden (hardware, water,
zorg), het Living Lab kent soorten (leefomgeving, cohesie, welzijn). Wie die twee
lijsten samenvoegt, voegt twee besturen samen.

## De keten is gemeten, niet aangenomen

Op tafel lag een `research_id` die van een buurtvraag tot een publicatie meereist,
over tien stations. Dat is precies de vorm waarin `Asset` hier een keer sneuvelde
(`DEVELOPERCLOUD.md` par. 2): een begrip dat over de domeinen heen wordt
VERKLAARD in plaats van erin gevonden. Dus eerst tellen -- `scripts/onderzoeksketen.js`,
uitslag in `ONDERZOEKSKETEN.json`.

**Van de 90 mogelijke schakels tussen tien stations bestaan er 6.** Maar dat
getal is misleidend, en de tweede meting zegt waarom:

> **Acht van de tien stations hangen al aan DEZELFDE studie.** Het is geen
> ketting maar een ster, en de spil bestond al: `studieId`.

Aan de spil: buurtvraag, studie, ethiek, waarneming, bewijs, apparatuur, doorbraak, kosten. Niet: onderzoekslab, labfonds -- en dat zijn precies de twee ANDERE systemen.

De keten zoals het voorstel hem tekent, stap voor stap:

| stap | stand |
|---|---|
| buurtvraag -> studie | **staat** (studieId) |
| studie -> ethiek | ontbreekt |
| ethiek -> waarneming | ontbreekt |
| waarneming -> bewijs | ontbreekt |
| bewijs -> doorbraak | **staat** (conclusieId) |
| doorbraak -> onderzoekslab | **staat** |
| onderzoekslab -> labfonds | ontbreekt |
| labfonds -> kosten | ontbreekt |

## Wat daaruit volgde, en wat niet

**Er is geen identiteit dwars door tien domeinen gelegd.** Dat was niet nodig: de
spil bestond. Wat ontbrak was een NAAM voor die spil die ook buiten de software
bestaat -- een interne sleutel van acht tekens hex is prima om mee te zoeken en
onbruikbaar in een subsidieaanvraag of op een poster in de buurt.

Daarom draagt elke studie sinds 31 augustus 2026 een **onderzoeksnummer**
(`kern/livinglab/onderzoeksnummer.js`):

```
RTF-IJM-2026-0042
 |   |    |    volgnummer binnen dat lab en dat jaar
 |   |    het jaar waarin het onderzoek begon
 |   drie letters van de stad van het lab
 de stichting
```

Drie regels: hij **verandert nooit** (ook niet bij verhuizing of een nieuwe
titel), hij is **geen sleutel** (zoeken gaat op de interne id; een botsing mag
lelijk zijn maar niet stuk), en hij **zegt niets over de inhoud** -- een
onderzoek dat van richting verandert, hoort dat te kunnen zonder een naam te
dragen die niet meer klopt.

**En de ene schakel die er wel was, was maar half waar.** `doorbraak.js` beloofde
in zijn eigen kop dat "de verwijzing twee kanten op gaat": de studie bewaarde de
project-id, en het project bewaarde een ZIN in zijn logboek. Een logregel is te
lezen en niet te volgen -- wie in het Onderzoekslab een project in handen had,
kon niet terug naar het onderzoek waar het uit kwam. Nu draagt het project een
`herkomst` als veld, met het onderzoeksnummer erbij.

## Meetinstrumenten: wat een deelnemer invult

Sinds 31 augustus 2026 kan een onderzoeksleider een **meetprotocol** samenstellen
(`kern/livinglab/instrument.js`) dat een deelnemer met zijn labpas invult. Dat is
iets anders dan de vrije observatie die er al was: de observatie levert
materiaal, het instrument levert vergelijkbare metingen. Ze horen niet in elkaar
te schuiven -- een vrije observatie met een schaal ernaast is geen meting.

**Dit is met opzet géén app uit de App Store.** Een app van derden draait in een
cel zonder netwerk (APPSTORE.md grens 1) en kan een meting dus niet terugsturen
-- en zou dat ook niet mogen: een meting draagt een toestemmingsgrond en hoort
bij een studie van de stichting. Het instrument woont daarom achter de labpas, in
de software van RTG zelf.

Elke meting draagt haar context, en elk stuk daarvan heeft een reden:

| wat | waarom |
|---|---|
| protocolversie | zonder dit is een reeks over een half jaar niet te vergelijken: de vraag kan onderweg zijn veranderd |
| toestemmingsgrond | bevriest bij het insturen; wat later verandert, verandert niet met terugwerkende kracht wat er toen gold |
| apparaat + ijkstand | de gerekende kalibratiestand op het MOMENT van meten -- blijkt een apparaat later ontregeld, dan is te zien welke metingen eronder vallen |
| meetmoment | het hoeveelste meetmoment uit het onderzoeksplan |
| ruwe waarde | wat de deelnemer invulde, ongewijzigd |

Drie grenzen: **geen toestemmingsgrond, geen meting** (fail-closed, en op de
module getoetst omdat die weg over HTTP niet te bereiken is); **een waarde buiten
bereik wordt geweigerd en niet stil bijgesteld** -- wie meetwaarden bijschaaft,
meet zijn eigen verwachting; en **de deelnemer is een alias**, die uit de pas
komt en nooit uit het lijf van het verzoek.

Vier soorten instrument bestaan met opzet níét, met het antwoord erbij dat een
onderzoeksleider krijgt als hij het toch probeert: **foto** (er staat altijd meer
op dan de meting), **locatie** (de gevoeligste waarde in dit huis), **audio** (dat
vangt de stem van mensen die niets hebben verleend) en **doorlopend meten** (dat
is een sensor in iemands huis, en die loopt langs de apparatuurlaag met haar
bevoegdheden).

## Terugtrekken: eerst kijken, dan pas wissen

Een knop "verwijder mijn gegevens" is een halve belofte. Sinds 31 augustus 2026
rekent `kern/livinglab/terugtrekken.js` eerst voor wat terugtrekken betekent, en
verandert daarbij niets:

| wat | hoe het wordt vastgesteld |
|---|---|
| wat verdwijnt | de observaties en de metingen van deze alias, geteld per protocolversie |
| welke conclusies zakken | het bewijs dat naar zijn observaties wijst valt weg, en dan zegt `graden.js` wat het plafond nog is |
| wat blijft | een dataset is een momentopname: wat daarin is opgegaan, is er niet meer los uit te halen -- en dat staat er |
| welk spoor blijft | dát er is teruggetrokken, met aantallen en zonder inhoud |

**Dat "welke conclusies zakken" is de bewijsladder van dit lab en geen verzonnen
statistiek.** Een conclusie draagt bewijs; valt een drager weg, dan zakt haar
plafond -- exact narekenbaar, vooraf, zonder iets te wissen. Wat RTG met opzet
NIET doet is een steekproefomvang, een effectgrootte of een p-waarde herrekenen:
die analyse gebeurt buiten dit systeem, en een getal verzinnen dat wetenschappelijk
klinkt is erger dan geen getal. Dat staat als `nietTeZeggen` in het antwoord zelf,
en een toets zakt zodra er wel zo'n getal in verschijnt.

Uitvoeren doet daarna precies wat de vooruitblik aankondigde: de gegevens weg, de
conclusies herijkt (ze worden niet gewist -- dat zou het onderzoek herschrijven --
maar ze blijven ook niet staan op een graad die niet meer klopt), en een
terugtrekking geteld in het dossier.

Onderweg bleek het oude `deelnemerWeg` alleen observaties te wissen. Sinds er ook
metingen bestaan, liet dat gegevens achter van iemand die zich had teruggetrokken;
beide wegen lopen nu langs dezelfde functie.

## De openbare onderzoekskaart

Sinds 31 augustus 2026 kan een lab een onderzoek openbaar maken
(`kern/livinglab/publicatie.js`). Drie dingen maken dat iets anders dan een
persbericht:

1. **Publiceren is een besluit van een mens**, geen gevolg van "af zijn". Er hoort
   een naam onder, en het kan pas als er een besluit over het onderzoek ligt --
   ook als dat besluit "gestopt" is.
2. **"Wat werkte niet" is een verplicht blok.** Niet een appendix, niet optioneel.
   Een lab dat alleen zijn successen publiceert, publiceert geen onderzoek. Leeg
   laten wordt geweigerd, met de uitnodiging op te schrijven waarom er volgens de
   onderzoeker niets misging.
3. **De feiten worden afgeleid en niet overgetypt.** Bewijsgraad, deelnames,
   herziene conclusies, teruggetrokken deelnemers en het aantal protocolversies
   komen live uit het dossier. Wat een mens schrijft is de duiding. Zou de kaart
   bevroren worden, dan blijft er een graad staan die inmiddels is gezakt -- en
   terugtrekken kan dat vandaag laten gebeuren.

Wat er nooit op komt: aliassen, de tekst van een waarneming, de tekst van een
klacht. Bij een studie met een verhoogde risicoklasse (gescheiden bewaard) gaan
ook de vraagstelling en de conclusieteksten er niet op -- alleen wat het lab zelf
schreef, de graden, en de reden dat de rest ontbreekt.

**Intrekken wist niets.** Een publicatie die iemand niet meer uitkomt, moet niet
stilletjes weg kunnen: de kaart blijft staan en toont dat zij is ingetrokken, met
de reden erbij.

## Ook "nee" is een antwoord

Bewoners kunnen een vraag aandragen; wat er daarna gebeurde was zichtbaar in
precies één geval -- als er een onderzoek van kwam. `kern/livinglab/vraagbesluit.js`
geeft elke vraag een levensloop: ingediend, verkend, beoordeeld, gestart of
**niet-gestart met een reden**.

De reden komt uit een **gesloten lijst** van zes, want vrije tekst levert "hier
doen we op dit moment niets mee" op: niet te vergelijken, niet te doorzoeken, en
niet te herkennen als dezelfde vraag over een jaar terugkomt. De toelichting
erbij is verplicht en juist wél vrij -- de reden maakt het vergelijkbaar, de
toelichting maakt het begrijpelijk voor deze ene bewoner.

Een van de zes is de belangrijkste en staat er met opzet in: **de benodigde
gegevens zijn niet in verhouding tot de vraag.** Een instituut dat kan zeggen
"dit onderzoeken wij niet, want de prijs is te hoog voor de mensen die het zou
raken", gebruikt zijn ethieklaag in plaats van hem af te vinken.

Drie dingen gebeuren hier niet: een vraag wordt **nooit verwijderd** (een
afgewezen vraag die verdwijnt, is niet te onderscheiden van een vraag die nooit
is gesteld), er komt **geen ranglijst** van vragen (stemmen tellen mee in de
afweging, ze beslissen niet -- anders verdwijnt precies de vraag van de kleine
groep), en de AI beslist er niets.

## Apparatuur buiten het lab

Een school of buurtinitiatief kan apparatuur lenen (`kern/livinglab/uitleen.js`
en `uitleenketen.js`). De catalogus is openbaar en zegt óók wat níét beschikbaar
is, met de reden -- weglaten zou lijken alsof het apparaat niet bestaat.

**De keten is het product.** Aanvraag, besluit, meegegeven, terug, herijkt: elke
stap wordt achteraan toegevoegd en niets wordt ooit aangepast. Twee poorten gaan
fail-closed dicht: een **open storing** (een apparaat waarvan bekend is dat het
iets mankeert, geeft metingen mee waarvan niemand weet wat ze waard zijn) en een
**verlopen ijking** -- die ziet er precies zo uit als een geldige. Bij het
meegeven wordt de ijkstand bevroren in de keten, dezelfde stand die
`instrument.js` in elke meting vastlegt.

Terugkomen sluit de uitleen niet: eerst **herijken**, want het apparaat is
vervoerd en door anderen bediend. En "in orde" is ook een waarneming: de staat
waarin het terugkwam moet worden opgeschreven.

## De reproductiecapsule en de geschiedenis van een conclusie

"We hebben ergens een Excelbestand" is hoe onderzoek onherhaalbaar wordt. De
capsule (`kern/livinglab/capsule.js`) bevat de **opzet**: hypothese mét tegendeel,
plan, meetprotocol met zijn versie en het aantal metingen per versie, de
apparaten met hun bevroren ijkstanden, de bewijsregels voluit (wie dit over vijf
jaar leest, heeft de code niet bij de hand), en de softwareversie.

Hij wordt **afgeleid en niet bewaard**: een capsule die bij het afsluiten wordt
dichtgeklapt, vertelt over een half jaar iets anders dan het dossier. En hij
bevat géén ruwe waarnemingen, géén ingevulde meetwaarden en géén aliassen -- een
capsule die codenamen draagt, maakt de scheiding ongedaan zodra iemand hem
doorstuurt.

**Een conclusie is geen zin in een PDF.** `conclusielijn.js` geeft elke conclusie
een geschiedenis waarin elke regel een OORZAAK draagt: een drager kwam erbij, een
graad werd gezet, het plafond zakte doordat een deelnemer zich terugtrok. Elke
graadverandering is een **versie**; wat ertoe leidde staat erbij. Dat legde meteen
een gat bloot: terugtrekken herijkte zelf en liet een conclusie stil zakken --
de graad veranderde en niets zei waardoor.

## Wat er nog niet is, met de reden

- **Labfonds ↔ studie.** Het fonds financiert onderzoek en weet niet welk. Dit is
  nu de duurste ontbrekende schakel: zonder haar kan een lid niet zien wat er met
  zijn bijdrage is onderzocht.

Die vier staan hier zonder datum en zonder belofte. Wat er wel is, is gemeten:
draai `npm run onderzoeksketen` en de tabel hierboven rekent zichzelf na.
