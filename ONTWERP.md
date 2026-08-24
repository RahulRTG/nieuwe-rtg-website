# RTG Design System 2.0

> **Van veraf classy, van dichtbij extreem krachtig.**
>
> Wie vijf seconden kijkt, ziet een exclusief Europees merk. Wie er acht uur per
> dag mee werkt, merkt dat er een volledig operationeel systeem onder zit.

Dit bestand legt de vormtaal vast. `CLAUDE.md` zegt wat het merk is, `LAT.md` hoe
er geschreven wordt, `PLATFORM.md` hoe apps zich tot elkaar verhouden. Dit zegt
hoe het eruitziet en waarom — en per regel wat hem handhaaft, want een
ontwerpregel zonder handhaving is over drie maanden twintig stijlen.

**Deze specificatie ligt vast vóór er schermen worden aangepast.** Dat is de
volgorde met opzet: wie eerst Reizen, dan Office en dan Command "mooier maakt",
interpreteert de regels drie keer en houdt drie ontwerpen over.

---

## 0a. Waar dit systeem vandaag wordt gedragen

*Toegevoegd 23 augustus 2026, want dit ontbrak en de afwezigheid was niet te
zien.*

Deze specificatie was volledig: de tokenlaag staat in
`public/shared/rtg-ontwerp.css`, de materialenleer in
`public/shared/rtg-materiaal.css`, en `test/ontwerp.test.js` (19 toetsen) en
`test/materiaal.test.js` (10) houden ze streng. Maar die toetsen meten de
**tokenlaag tegen zichzelf**. Van de 185 app-pagina's sloot er precies **één**
`rtg-ontwerp.css` in, en `rtg-materiaal.css` **nul**.

Een ontwerpsysteem dat nergens wordt ingesloten is geen systeem maar een
document. Sinds vandaag telt `schermenZonderVormtaal` in `NORM.json` hoeveel
pagina's hem niet dragen, en die meter mag alleen omlaag — geteld op de
insluiting en niet op het gebruik, want dat is de goedkope en eerlijke
ondergrens van adoptie.

`/apps/werk.html` is de eerste die hem echt draagt: `data-rtg-modus="pro"`, en
de zeven kleurtokens van dat scherm verwijzen naar de materialenleer in plaats
van hun eigen hexcodes te dragen. Die waarden klopten toevallig — `#7f1634` is
de logo-bordeaux en `#c0a544` is `--gold-tekst` — maar het was een kopie, en
een kopie loopt uit de pas zodra de bron verandert. Uitgerekend in het scherm
dat aan partners wordt verkocht.

## 0. Wat we niet doen

We maken van RTG geen grijze corporate SaaS-doos. De bordeaux-gouden identiteit,
de klok, de Bodoni en de Europese luxe-sfeer zijn het waardevolle deel en blijven
staan.

Wat vervangen wordt is de **UI-logica**, niet de huisstijl:

```
oud:  icoon → knop → app → kaartje
nieuw: wereld → toestand → workflow → object → context → actie
```

---

## 1. Merk-elementen en werk-elementen

De fout die het geheel vlak maakte: bijna elk onderdeel kreeg dezelfde
behandeling. Een status, een kaarttitel en een hoofdstuktitel zagen er even
belangrijk uit, dus niets was belangrijk.

**Bodoni (serif) is ceremonieel.** Hij mag op:

- hoofdtitels en hoofdstukken;
- een bestemming of stad;
- een belangrijk bedrag;
- één dominante KPI;
- een dagnummer dat als anker in een register dient;
- bewust merkgebruik.

**Bodoni mag niet op**: statussen, kaarttitels, invoervelden, tabelkoppen,
knoppen, meta-regels, of wat dan ook dat vaker dan een paar keer per scherm
voorkomt. Een serif die overal staat, is geen signatuur meer.

**Inter draagt het werk**, met tabulaire cijfers en echte gewichtsverschillen.

```
REIZEN                                    ← Bodoni, groot, ceremonieel
RTG-R-ECF153 · 2 reizigers · €2.200 · 18 AUG   ← Inter, compact, tabulair
```

*Handhaving:* `test/ontwerp.test.js` telt per pagina de serif-rollen en zakt
zodra een pagina Bodoni op een niet-toegestane rol zet. De klassen die serif
dragen zijn een **gesloten lijst** (`.rtg-ceremonie`, `.rtg-kpi`, `.rtg-datum`,
`.rtg-plaats`, `h1`); een vrije `font-family` in een pagina-`<style>` is een fout.

---

## 2. Drie modi: World, Pro, Command

Eén systeem, drie dichtheden. De modus staat op `<body>` als
`data-rtg-modus="world|pro|command"` en zet niets anders dan **schaal, ruimte en
dichtheid** — nooit een andere kleur, een ander lettertype of een andere vorm.
Dat is precies waarom het één systeem blijft.

| | **World** | **Pro** | **Command** |
|---|---|---|---|
| Voor | leden | wie ermee werkt | directie, operations, security |
| Objecten per scherm | 3–8 | 10–20 | 20–60 |
| Regelhoogte | 56px | 40px | 32px |
| Basisruimte | 20px | 12px | 8px |
| Bodoni | ruim toegestaan | spaarzaam | alleen de dominante toestand |
| Witruimte | draagt het ontwerp | functioneel | minimaal |

**World moet óók slimmer.** Niet alleen een naam, maar een naam met een
toestand erachter:

```
REIZEN
Ibiza · 18 aug
2 reizen gepland
```

*Handhaving:* de drie modi staan als tokenblokken in
`public/shared/rtg-ontwerp.css`. `test/ontwerp.test.js` zakt zodra een modus een
token mist dat een andere wél zet (een half gevulde modus is een scherm dat in
die modus stuk gaat), en zodra een modus een kleur- of fonttoken overschrijft.

---

## 3. Uitzonderingsgestuurd

Software moet niet roepen *"kijk hoeveel data ik heb"*, maar *"dit gaat goed,
hier moet jij naar kijken"*.

```
Reizen                    ← niet interessant
1.284 boekingen

Reizen                    ← wél interessant
1.284 boekingen
3 vereisen actie
1 leverancier > SLA
€4.850 betaling wacht
```

Dat is ook waarom een dashboard geen zes even grote dozen is: er is **één
dominante toestand** ("SYSTEMEN IN ORDE") en daarnaast kleine indicatoren voor de
afwijkingen.

---

## 4. Kleur is betekenis, niet decoratie

Goud mag niet de kleur van "een mooie knop" worden.

| Token | Betekenis |
|---|---|
| `--rtg-goud` | autoriteit, primair, geselecteerd |
| `--rtg-acc` (bordeaux) | omgeving, merk |
| `--rtg-bg` | workspace |
| `--rtg-txt` (ivoor) | informatie |
| `--rtg-sig-gezond` | normaal — bijna onzichtbaar |
| `--rtg-sig-aandacht` | aandacht |
| `--rtg-sig-incident` | menselijk ingrijpen nodig |
| `--rtg-sig-actief` | draaiend of geautomatiseerd proces |

**Groen is bijna onzichtbaar en dat is de bedoeling.** Normaal hoort geen
aandacht te trekken.

---

## 5. Status nooit op kleur alleen

Operationele informatie moet leesbaar blijven voor wie kleur niet ziet, en op een
zwart-witte print.

```
BEVESTIGD ✓        WACHT OP LEVERANCIER ◷
ACTIE VEREIST !    GEANNULEERD ×
```

Elke status draagt dus **een woord en een teken**, en kleur is de derde laag.

*Handhaving:* `test/ontwerp.test.js` zakt op een statuscomponent zonder
`data-teken`. Dit is bovendien de enige ontwerpregel die ook in `scripts/a11y.js`
terugkomt, want het is er net zo goed een toegankelijkheidsregel als een
merkregel.

---

## 6. Eigen componenten

Niet een andere kleur over bestaande UI-patronen, maar onderdelen die van RTG
zijn.

### RTG Signal Rail
Een dunne verticale lijn links van een object. Geen kleur = normaal, groen =
afgerond, goud = aandacht, rood = ingrijpen. Zo kun je honderd regels tonen
zonder honderd gekleurde pillen.

### RTG Reference
Elke enterprise-entiteit draagt zijn kenmerk op **dezelfde positie**, in
tabulaire cijfers: `RTG-R-ECF153`. Klikken kopieert. De referentie is geen
detail dat je bij "meer" wegstopt — het is waar een professional naar zoekt.

### RTG Action Line
Elke operationele regel mag een volgende stap dragen: `ACTIE · PASPOORT
CONTROLEREN` of `WACHT OP · HOTEL`. Daarmee is het scherm procesgedreven in
plaats van beschrijvend.

### RTG Context Pane
Op desktop permanent rechts. Selecteer een boeking → het paneel toont die
boeking. Selecteer een betaling → hetzelfde paneel verandert. Je klikt niet meer
door pagina's heen.

### RTG Command Palette (⌘K)
`Boeking ECF153` · `Open Ibiza` · `Maak factuur` · `Sluit kassadag` · `Toon
voertuigen Haarlem`. Hier verdwijnt de AI natuurlijk in, in plaats van als los
chatvenster ernaast te staan.

---

## 7. Weg met het kaarten-dashboard

Niet elk stuk informatie hoort in een afgerond rechthoekje. Dat is precies wat
een scherm het gevoel van een template geeft.

Gebruik in plaats daarvan: **vlakken, verticale rails, dunne borders,
typografische groepen, registers, kolommen, open ruimte en contextpanelen.**

**Een kaart is alleen een kaart als het ding een zelfstandig object is.** Dan
wordt hij weer bijzonder.

*Handhaving:* `test/ontwerp.test.js` telt kaarten per scherm en zakt boven een
grens per modus (World 8, Pro 4, Command 2). Een register is geen stapel kaarten.

---

## 8. Cijfers zien eruit als cijfers

Alles wat een getal is, staat in tabulaire cijfers en lijnt uit:

```
€ 2.500.000
      000184
     99,982%
RTG-R-ECF153
```

Klein detail, groot effect: dit is wat een interface institutioneel laat ogen.

*Handhaving:* `--rtg-cijfers` zet `font-variant-numeric: tabular-nums`; de
componentklassen voor bedragen, referenties en tellers dragen hem verplicht, en
de toets zakt als er één zonder staat.

---

## 9. Rahul is geen chatbotje

`Vraag Rahul…` is goed voor World. In Pro en Command is Rahul **aanwezig in de
context**, niet in een venster ernaast:

```
Rahul · 3 boekingen vragen vandaag aandacht          [ Los op ]
Rahul · omzet ligt 8% onder verwachting              [ Los op ]
Rahul · terrasbezetting loopt sneller op dan de keuken aankan
```

De bestaande drempel blijft staan: **de AI stelt op, de mens verstuurt en
beslist** (`CLAUDE.md`, en de comm-kern doet het al zo). "Los op" opent de
handeling; hij voert hem niet zelf uit.

---

## 10. Drie echte layouts

Een telefoonontwerp uitrekken is geen desktopontwerp.

| | Layout |
|---|---|
| Mobile | één hoofdvlak + bladen van onderen |
| Tablet | hoofdvlak + optioneel contextvlak |
| Desktop | `240px navigatie │ flex werkvlak │ 360px context` |

*Handhaving:* de drie layouts staan als grid-klassen in `rtg-ontwerp.css`. De
schermtoetsen meten op 430px én op 1440px, zodat "het staat scheef op desktop"
een zakkende toets is en geen smaakkwestie.

---

## 11. Dichtheid met contrast

Enterprise betekent niet *alles klein maken*. Het betekent: **compact waar
gewerkt wordt, groot waar gekeken wordt.**

| Element | Intensiteit |
|---|---|
| Dashboardtitel | groot |
| Dominante KPI | groot |
| Boekingsregister | compact |
| Beschrijving | klein |
| Status | zeer compact |
| Primaire actie | duidelijk |

De fout van nu is dat te veel elementen dezelfde visuele intensiteit hebben.

---

## 12. Motion, extreem subtiel

Geen spelcomputer. Beweging bestaat om te laten voelen dat er een systeem
onder draait:

| Gebeurtenis | Beweging |
|---|---|
| Regel komt binnen | 120 ms inschuiven |
| Status verandert | Signal Rail verkleurt rustig |
| Rahul verwerkt iets | kleine pulse |
| Paneel opent | 180 ms, strak |
| Teller verandert | zonder pagina-herlading |

*Handhaving:* alle duren staan als tokens (`--rtg-tijd-kort`, `--rtg-tijd-paneel`)
en elke animatie respecteert `prefers-reduced-motion`.

---

## 13. Eén iconensysteem

24×24 basisgrid, één vaste lijndikte, drie formaten, geen willekeurige
detailgraad. Letters alleen als **bewust monogram** — een monogram mag een
RTG-signatuur zijn, maar nooit een terugval omdat er geen icoon was.

---

## 14. Hiërarchie boven launchers

Het beginscherm en de werelden zijn nu vooral startknoppen. Ze horen een
toestand te tonen:

```
REIZEN                 GELD                  SALON                 HUIS
2 komende reizen       € •••••               4 nieuwe berichten    Werk · Zorg · School
Ibiza · 18 AUG         3 transacties vandaag 2 uitnodigingen       1 aandacht
```

Pas ná een tik komen de losse apps. Niet twintig icoontjes vóórdat je ergens
bent.

Datzelfde geldt binnen een wereld: Het Huis is nu een raster en hoort een wereld
te zijn — **WERK** (5 taken, 2 afspraken), **ZORG** (geen actie nodig),
**SCHOOL** (3 berichten), en daaronder pas *Diensten* en *Persoonlijk*. Alle
software blijft; ze krijgt alleen hiërarchie.

De klok blijft, maar krijgt een functie: hij toont de tijd wáár je volgende reis
of activiteit is.

---

## 15. De twee schillen

- **RTG Office** wordt één shell met een vaste navigatie (Werk, Mail, Agenda,
  Mensen, Finance, CRM, Projecten, Bestanden, AI, Directie), een commandobalk
  boven, de actieve applicatie in het midden en context rechts. De losse apps
  blijven zelfstandig diep — dat is precies de super-app-regel uit `PLATFORM.md`.
- **RTG Command** staat daarboven en bestuurt niet één organisatie maar het
  ecosysteem: van Europa → Nederland → Haarlem → Mobiliteit → voertuig
  RTG-M-0184 → rit → betaling → audit. Doorlopen van infrastructuur, niet een
  wand met KPI's.

---

## 16. Wat dit moet oproepen

| Bij | Gevoel |
|---|---|
| de consument | "dit voelt bijzonder" |
| een medewerker | "hier kan ik snel mee werken" |
| een directeur | "ik heb controle" |
| een enterprise-klant | "dit is geen hobbyproject" |

Dat laatste krijg je niet door alles vol te zetten, maar door precisie,
consistente componenten, sterke informatiearchitectuur en diepe functionaliteit.

---

## 17. De volgorde van invoeren

Klein en omkeerbaar, en niets hieronder vraagt om het weggooien van wat er staat.

1. ✅ **Deze specificatie**, vastgelegd vóór er een scherm verandert.
2. ✅ **De tokenlaag** (`public/shared/rtg-ontwerp.css`): de drie modi, de
   signaalkleuren, de dichtheidsmaten, de tijden en de tabulaire cijfers. Naast
   `rtg-ui.css` en niet eroverheen — die blijft de basisvormtaal, dit voegt de
   dichtheid en de betekenis toe.
3. ✅ **De componenten**: Signal Rail, Reference, Action Line, Status, Register.
4. **Eén scherm als proef** — RTG Reizen in Pro-dichtheid, met register in plaats
   van kaartenstapel. Pas als dat staat, de rest.
5. **De Context Pane en het desktopraster** (240 │ flex │ 360).
6. **De Command Palette (⌘K)**, met Rahul erin in plaats van ernaast.
7. **Het beginscherm en de werelden**: van launchers naar toestanden.
8. **RTG Office als shell**, daarna **RTG Command**.

Stap 4 is bewust één scherm en niet vier: het patroon moet één keer bewezen zijn
voordat het twintig keer vastligt.
