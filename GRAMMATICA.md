# De RTG Mobile Interaction Grammar

Vastgelegd 19 augustus 2026. `ADAPTIEF.md` zegt WAAR een handeling terechtkomt op
welk apparaat; dit document zegt HOE je hem aanraakt en WAT hij weegt. Samen zijn
ze de taal. `ONTWERP.md` en `MATERIAAL.md` gaan over de vormtaal, `WERELD.md` over
het beginscherm waar dit in landt, `TOEGANKELIJK.md` over de harde poorten.

## De zeven zinnen

Dit is de hele grammatica, en alles hieronder is er de uitwerking van.

> **Ik wil iets doen** → mijn duim vindt het onderaan.
> **Ik wil meer** → ik trek de interface naar me toe.
> **Ik selecteer iets** → RTG begrijpt mijn context.
> **Ik wil weten wat er gebeurt** → RTG toont de toestand zonder mij te storen.
> **Ik doe iets gevoeligs** → RTG vertraagt precies genoeg om fouten te voorkomen.
> **Ik maak een fout** → ik kan bijna altijd onmiddellijk terug.
> **Ik wissel van RTG-product** → de bediening voelt nog steeds bekend.

Waarom dit een taal moet zijn en geen verzameling gewoontes: er staan 184 schermen
in dit huis. Als lang drukken in Docs "meer gereedschap" betekent en in Geld
"verwijderen", dan heeft een lid geen taal geleerd maar 184 dialecten — en durft
hij nergens meer iets vast te houden.

## De vijf gebaren

Een gebaar heeft **één** betekenis, overal.

| gebaar | betekent | verandert iets |
|---|---|---|
| **tik** | doe of open | ja |
| **lang drukken** | leg uit of toon | nee |
| **omhoog trekken** | meer gereedschap | nee |
| **selecteren** | verander de acties | nee |
| **de orb** | stel voor | nee |

Alleen `tik` verandert iets, en dus kan alleen `tik` een gewicht dragen. Een
gebaar dat enkel laat zien hoeft nooit bevestigd te worden.

**Dit is tijdens het bouwen één keer gesneuveld en teruggedraaid.** Lang drukken
op een handeling opende eerst de uitgebreide lade — een tweede betekenis voor
hetzelfde gebaar, naast "meer gereedschap" bij omhoog trekken. Zo verliest een
taal zijn woorden. Lang drukken legt nu uit; meer gereedschap zit waar het hoort.

## Eén handeling is de belangrijkste, en die wijst het scherm zelf aan

De eerste zin van deze taal is *"ik wil iets doen → mijn duim vindt het
onderaan."* Dat is een belofte over **één** handeling: de belangrijkste die dit
scherm te bieden heeft. Een scherm met achttien even zware knoppen doet die
belofte niet na, hoe netjes ze ook onderaan staan.

**Het scherm wijst hem aan met `data-hoofdactie`.** Eén attribuut op één element,
en verder niets:

```html
<button class="knop hoofd" data-hoofdactie>Voorbereiding vrijgeven →</button>
```

Waarom dat expliciet moet en niet af te leiden is: op 19 augustus 2026 is dat
geprobeerd, over 257 schermen, en het antwoord is nee. `.hoofd` betekent in dit
huis niet één ding — op `/apps/geld-command.html` draagt een **kaart** van
350×236 met "96% match" die klasse. Een meting die zoiets als hoofdhandeling
pakt, meet niets, en een slimmere selector maakt dat niet beter: hij maakt het
alleen moeilijker te zien dat hij raadt.

**Wat er dan aan die handeling wordt geëist**, en het zijn drie regels waar elk
een reden onder ligt:

| | eis | waarom |
|---|---|---|
| maat | minstens **44×44** | 24×24 is WCAG 2.5.8 — de ondergrens voor *raakbaar met een hand die trilt*. Een duim die beweegt heeft meer nodig. |
| hoogte | middelpunt in de **onderste 60%**, of in een vaste balk | daarboven moet een mens zijn telefoon in de hand verschuiven, en dat is het moment waarop hij hem laat vallen |
| zijkant | een **smalle** knop (< 60% van de breedte) niet in het kwart aan de **ankerzijde** | daar komt de duim niet — en welke kant dat is hangt af van de hand (`ADAPTIEF.md`) |

**Een scherm zonder aangewezen hoofdhandeling is geen fout.** Een lijst, een
overzicht, een dagbriefing: daar is niet één ding het belangrijkst. Die schermen
staan in een eigen categorie en niet op de foutenlijst — anders wordt *"wijs maar
iets aan"* de reparatie, en daar wordt geen enkel scherm beter van. Wat de meting
oplevert is dus niet "hoeveel is er stuk" maar **hoeveel schermen hebben één
handeling die er echt uitspringt, en klopt die dan ook**.

*Wat het bewaakt:* `scripts/mobielkeuring.js`, als vierde ronde in
`npm run a11y` — twee keer, één keer per hand.

## Het Command Dock

De onderste balk heeft een vaste grammatica, in Docs net zo goed als in Bestanden,
Geld, HR of CRM:

```
[ navigatie ] [ waar je bent · contextacties ····· ] [ ⋯ ] [ RTG-orb ]
```

**Links, ⋯ en de orb bewegen nooit.** Daartussen verandert de inhoud. Dat is de
hele voorwaarde waaronder een balk mag meebewegen: een gebruiker leert niet waar
iedere knop staat, hij leert dat zijn werk onder zijn duim zit.

Wat het midden toont:

| stand | inhoud |
|---|---|
| geen werkblad open | de werelden zelf — één tik |
| een werkblad open | de handelingen die dat blad aanmeldt, met zijn naam als anker |
| een selectie | de handelingen van die selectie; het anker wijkt |

**Twee dingen die bewust zijn ingeleverd.** Bij een selectie wijkt het anker en
daarmee de weg terug naar je werkbladen; op 390px houdt de balk 232 pixels over
tussen de bank en Rahul, en met een documentnaam erin bleef daar één handeling
van over. Het anker komt terug zodra je de selectie loslaat. En een pagina die je
rechtstreeks opent in plaats van als werkblad heeft geen dock; daar doet de eigen
werkbalk het werk.

## Omhoog trekken, in twee trappen

```
Command Dock
  ↑  een kleine veeg      het uitgebreide gereedschap (lade)
  ↑  verder omhoog        de volledige werkmodus (taakmodus)
```

De tweede trap toont **niet iets anders** — dezelfde handelingen, met hun groepen
eromheen en ruimte om te lezen. Zou hij iets anders tonen, dan is het geen diepte
maar een tweede menu, en dan zijn we terug bij het driepuntjesmenu, de zijbalk,
het tandwiel en het modale venster.

Drempels: 44px en 150px, met weerstand na de eerste — zo voelt de tweede trap
verder weg dan de eerste, wat hij ook is.

## Het gewicht: lage gevolgen = snelheid, hoge gevolgen = zekerheid

Vijf trappen. Het verschil is wat ze de gebruiker KOSTEN.

| trap | wanneer | wat de gebruiker doet |
|---|---|---|
| `licht` | vet maken, een kop zetten | niets extra |
| `terug` | archiveren, weggooien naar de prullenbak | niets extra, en er staat "Ongedaan maken" |
| `bewust` | extern delen, een document ter beoordeling geven | ziet eerst wie het krijgt en welke classificatie eraan hangt |
| `zwaar` | tienduizend salarissen exporteren | vasthouden om te bevestigen, met een reden |
| `plechtig` | een kwart miljoen overmaken | klaarzetten, nakijken, en een mens bevestigt |

**Ongedaan vóór bevestigen.** Vragen of iemand het zeker weet is de duurste
oplossing en meestal de slechtste: hij kost een handeling bij élke keer, ook de
negenennegentig keer dat het klopte, en hij leert mensen op ja drukken — waarna
die vraag ook wordt weggeklikt de ene keer dat het ertoe deed. Een weg terug kost
alleen iets in het geval dat het misging.

**Een vraag met inhoud, nooit "weet u het zeker?".** `bewust` toont wat er gaat
gebeuren, aan wie, met welke classificatie. Daar kun je een fout in zien. In
"weet u het zeker?" kun je geen fout zien.

**`terug` zonder weg terug bestaat niet.** Wie `terug` declareert en geen
`ongedaan` meelevert, belooft iets wat er niet is. Dat wordt geen stille tik maar
een trap hoger: dan maar vooraf vragen. Zo kan de belofte niet leeglopen zonder
dat iemand het merkt.

**Hetzelfde knopje kan twee gewichten hebben.** In RTG Bestanden betekent "weg"
voor een bestand in de kluis: naar de prullenbak, dertig dagen herstelbaar — dat
is `terug`. Voor een bestand dat er al in ligt betekent dezelfde knop: voorgoed
weg, met alle versies — dat is `bewust`. Het gewicht hangt aan de **toestand**,
niet aan de knop.

### Vasthouden om te bevestigen

Een zware handeling krijgt niet een extra vraag ervoor, maar een andere
**beweging**: je duim blijft staan, de vulling loopt, en in die seconde kun je je
nog bedenken. Wrijving die iets bewijst in plaats van wrijving die iets vraagt.

Drie manieren, want niet iedereen kan vasthouden:

1. de aanwijzer ingedrukt houden;
2. Enter of spatie ingedrukt houden (een toetsenbord herhaalt, dus meetbaar
   dezelfde beweging);
3. twee keer bewust bevestigen — wie kort indrukt krijgt geen mislukking maar
   "Nogmaals om te bevestigen", vier seconden geldig. Voor een schakelbediening
   of een tremor is dat de gelijkwaardige weg: twee bewuste handelingen in plaats
   van één lange. Hij is met opzet niet korter dan de andere.

### Wat het gewicht NIET doet

Bij `zwaar` en `plechtig` wordt de reden **gevraagd en doorgegeven** aan de
handeling. Of hij in een journaal belandt, weet alleen het scherm dat de handeling
uitvoert. Hier doen alsof dat geregeld is, zou de zwaarste belofte van dit
document tot decor maken.

## De Trust Rail

De strook boven het dock beantwoordt de vier vragen die een mens in
bedrijfssoftware stilletjes stelt: *is dit opgeslagen, is dit veilig, wie ziet dit,
is de synchronisatie gelukt.* Wie daar geen antwoord op krijgt gaat het zelf
controleren — opnieuw opslaan, verversen, een collega bellen.

```
✓ Opgeslagen · Intern · Alleen u
☁ Synchroniseren…
Offline · lokaal opgeslagen
⚠ Nieuwere versie gevonden
```

Drie regels die niet mogen sneuvelen:

1. **Alleen gemeten toestand.** Wat er staat komt van een bron die het echt weet.
   Een geruststellend "alles in orde" dat niemand heeft gemeten is erger dan
   niets (`CANVAS.md`). RTG Office leest daarvoor `#staat`, `#beheerClassificatie`
   en `#samenLabel`; ontbreekt er een, dan staat dat onderdeel er niet.
2. **Status nooit op kleur alleen.** Elk onderdeel draagt een woord; goud is een
   tweede signaal, nooit het enige (`ONTWERP.md` par. 5).
3. **Hij stoort niet.** Rustig is de normale stand. Wie leest of typt ziet hem
   inzakken — maar het dock blijft staan: de eerste zin van deze grammatica is
   dat je duim zijn werk onderaan vindt, en dat mag scrollen niet afnemen.

**En hij is een ingang.** Tik op "Opgeslagen" en je ziet wanneer en of herstel
beschikbaar is. Tik op "Intern" en je ziet wat die classificatie betekent. De
strook is de verklaring achter de toestand, niet een mededeling erover.

**"Ongedaan maken" woont hier ook.** Dat is geen plaatsgebrek: "Gearchiveerd" is
een toestand van je werk, net als "Opgeslagen", en hoort op de plek waar je die
toestand toch al leest — in plaats van in een blokje dat over je scherm schuift.

## "Waarom kan ik dit niet?"

Bedrijfssoftware zit vol uitgeschakelde knoppen en bijna geen enkele zegt waarom.
Wat een gebruiker dan doet is voorspelbaar: nog eens proberen, denken dat het stuk
is, en dan iemand bellen. Elke grijze knop zonder uitleg is een supportvraag die
staat te wachten.

**Een verhindering draagt daarom altijd een reden en een bron.**

> Delen is uitgeschakeld omdat dit document als Strikt · niet delen is
> geclassificeerd.
> **Waardoor** — Classificatie van dit stuk.
> Hier kunt u zelf niets aan veranderen.

Vijf bronnen: `beleid`, `classificatie`, `bevoegdheid`, `bewijs`, `toestand`. De
eerste twee kan een gebruiker zelf niet oplossen; de laatste drie wel, en dan
staat de volgende stap erbij. Een reden zonder bron is een mening; met bron is het
een verwijzing die iemand kan natrekken — en desnoods veranderen.

**En verhinderd is niet uitgeschakeld.** De knop blijft een gewone, bedienbare
knop; hij doet alleen iets anders — hij legt zichzelf uit. Hier stond eerst
`aria-disabled`, en dat is precies verkeerd: dan slaat een schermlezer hem over,
en is de uitleg onbereikbaar voor wie hem het hardst nodig heeft. De stand staat
nu in de toegankelijke naam: *"Extern delen, niet beschikbaar. Tik voor de reden."*
Visueel: een streep door de knop, want een lichtere kleur is een kleursignaal en
dat leest niet iedereen.

## De orb

Rechts in het dock staat Rahul. Een tik opent zijn vraagveld (`WERELD.md`: de balk
die je hebt verandert van taak, er komt geen paneel overheen). Lang drukken doet
wat lang drukken overal doet — uitleggen; hier betekent dat: *wat kan ik hier?*

Er staat dan niet een lijst met alles wat RTG kan. Er staat wat **hier** kan,
afgeleid uit de capabilities die dit scherm zelf heeft aangemeld, in twee groepen:
*dit kan hier* en *dit kan hier niet* — die tweede met zijn reden.

**De grendel is het hele punt.** De orb mag voorstellen. Wat er gebeurt loopt langs
precies dezelfde weg als een tik in het dock:

```
context → aangemelde capability → verhindering → gewicht → handeling
```

Er is dus geen route waarlangs "vraag het aan Rahul" iets doet wat je met je duim
niet had gemogen. Dat is geen extra veiligheidslaag maar het **ontbreken van een
tweede weg** — en dat is sterker, want een tweede weg is precies wat er over een
jaar wordt vergeten bij te werken. Een `plechtig` handeling die je hier aantikt
komt op dezelfde twee lades uit (`GELD.md`: geld verlaat het huis nooit vanzelf;
`CLAUDE.md`: de AI belooft en verleent nooit zelf toegang).

## Wie er aangesloten is

**RTG Office** — de tekstverwerker, het rekenblad en de presentatie. Leest de
bestaande werkbalk uit, plus de toestand van het document (opslag, classificatie,
meelezers) en twee handelingen die zwaarder wegen: delen en ter beoordeling.

**RTG Bestanden** — het bestandspaneel: ster, download, delen, verwijderen. Hier
staat het geval van hetzelfde knopje met twee gewichten.

Twee producten die niets van elkaar weten en toch dezelfde bediening hebben: dat
is de zevende zin, gemeten in plaats van beloofd.

**Nog niet aangesloten:** alle andere schermen. Ze zijn niet stuk — ze dragen hun
eigen bediening — maar ze doen niet mee aan het dock. Wie een scherm aansluit
declareert zijn capabilities en meldt zijn context; hij raakt de dock-laag niet
aan.

## Wat er bewust NIET is

**Geen dock dat wegzakt tijdens het scrollen.** De verleiding is groot en het
staat mooi. Maar een dock dat weg is op het moment dat je leest, breekt de eerste
zin. Wat wijkt is de chrome: de rail zakt in en de bladnaam valt weg.

**Geen balk die van plek verandert.** Ankeracties staan vast. Alleen de inhoud van
het midden beweegt.

**Geen lerende volgorde.** Voorgesteld was dat het dock leert welke handelingen
iemand vaak gebruikt en die hoger zet. Dat is bewust nog niet gebouwd: het vraagt
om gebruikstellingen per lid, en dat is een gegevensvraag (`CLAUDE.md`, privacy by
design) en geen ontwerpvraag. Wat er nu staat is een `VOORAAN`-tabel per afnemer —
zichtbaar, op één plek, en door een mens gekozen. Wie het alsnog wil bouwen, hoort
eerst op te schrijven waar die tellingen wonen, hoe lang, en hoe een lid ze wist.

**Geen bevestiging bij lichte handelingen.** Een systeem met twintig "weet u het
zeker?"-meldingen voelt niet veilig; het leert mensen automatisch op ja drukken.

## Handhaving

`test/grammatica.test.js` meet de leer: dat een gebaar één betekenis heeft en dat
`lang` nooit iets verandert, dat de vijf gewichten kloppen, dat een verhindering
zonder reden wordt afgekeurd, en dat elk gewicht boven `bewust` een reden of een
weg terug heeft. Bij elke toets staat de mutatie die hem hoort te laten zakken.

`test/grammatica.e2e.js` meet in een echte browser: dat de rail boven het dock
staat en alleen gemeten toestand toont, dat een zware handeling niet met één tik
afgaat, dat vasthouden hem wél afmaakt en de reden meegeeft, dat een verhinderde
handeling zijn reden geeft en niet draait, dat de orb de verhinderde erbij toont,
en dat omhoog trekken de twee trappen geeft.

Wat **niet** machinaal gehandhaafd wordt, en dus op mensen berust:

- **Of een handeling het juiste gewicht heeft.** Dat "extern delen" `bewust` is en
  "vet" `licht`, is een oordeel. De machine controleert dat het gewicht bestaat en
  dat de belofte eromheen klopt, niet dat het het juiste is.
- **Of de vier handelingen die vooraan staan de juiste vier zijn.** Die keuze staat
  per afnemer in zijn eigen `VOORAAN`-tabel.
- **Of de rail eerlijk is.** Dat `#staat` echt de opslagstand is, weet alleen wie
  die code leest. De regel is opgeschreven; een machine kan niet zien of een bron
  liegt.

En de barrière die blijft staan: **vasthouden vraagt een tijdsduur.** De derde weg
(twee keer bewust bevestigen) is er voor wie niet kan vasthouden, maar hij is
bedacht en niet getest met een mens die een schakelbediening gebruikt. Dat is
dezelfde eerlijkheid als de laatste zin van `TOEGANKELIJK.md`: er is hier nog nooit
iemand met een handicap doorheen gelopen.
