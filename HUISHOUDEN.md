# HUISHOUDEN.md — de ontbrekende actor

> Loon is tegelijk bedrijfskosten, huishoudinkomen, belastingbasis, spaargeld,
> consumptievraag en uiteindelijk weer omzet elders.

`ECONOMIE.md` beschrijft de natuurkunde: niets spawnt zomaar, alles heeft een
tegenpartij. `ORGANISATIE.md` beschrijft waarom bedrijven het houden of breken.
Dit document gaat over de actor die tot nu toe ontbrak.

Tot nu toe heeft Magnaat vooral **bedrijven die aan elkaar verkopen**. Daarna
krijgt hij voor het eerst: *mensen werken → verdienen → wonen → consumeren →
sparen → investeren → bedrijven verdienen → bedrijven betalen mensen.* Zodra die
cirkel sluit kan de wereld voor het eerst zelfstandig **groeien, vertragen,
oververhitten en herstellen** — zonder dat iemand ooit `recessie = true` hoeft te
schrijven.

---

## 0. Waar we staan, eerlijk

`magnaat/huishoudens.js` (laag 3, gebouwd) laat loon terugkomen als
bestedingskracht. Dat was de juiste eerste stap en het is een echte kringloop:
minder werk in de stad is minder vraag in de winkel, en de klap verschilt per
sector omdat de segmentsom verschilt.

**Dat wás nog een formule**: één getal per stad, geen huishouden dat iets
ontvangt, geen huur die ergens aankomt, geen buffer die leegloopt. Inmiddels
staan de eerste vier onderdelen hieronder — er is een wig tussen loonkost en
koopkracht, er zijn zes cohorten met een eigen balans, vaste lasten zijn stijver
dan boodschappen, en de dunne buffers raken werkelijk de bodem.

Wat er nog niet is, is even belangrijk: er komt nog steeds geen huur bij een
verhuurder aan, consumptie is nog een bedrag in plaats van een mand, en een
huishouden kiest nog geen winkel. Dit document beschrijft de volgorde waarin dat
kan zonder halve lagen achter te laten.

---

## 1. De keten die er moet komen

    loonkosten werkgever
      → werkgeverspremies        → overheid
      → brutoloon
          → loonheffing/premies  → overheid
          → pensioeninhouding    → pensioenfonds
          → nettoloon
              → vaste verplichtingen
                    huur         → verhuurder
                    energie      → energiebedrijf
                    verzekering  → verzekeraar
                    vervoer      → vervoerder
                    aflossing    → bank
              → vrij besteedbaar
                    → consumptie → bedrijven in de stad
                    → sparen     → bank → krediet → onderneming

Een werkgever betaalt €3.000 loonkosten, en dat betekent **niet** dat een
huishouden €3.000 kan consumeren. Dat verschil is geen detail; het is het halve
verhaal van elke loondiscussie die er ooit gevoerd is.

En elke pijl hierboven heeft een **ontvanger**. Een woning is niet
`housingCost` — iemand ontvangt die betaling. Dat is het verschil tussen een
kostenpost en een economie.

---

## 2. De grenzen

Deze staan boven elk onderdeel hieronder. Waar een functie ermee botst, vervalt
de functie.

**IEDERE EURO DIE EEN ACTOR VERLAAT KOMT BIJ EEN ANDERE ACTOR AAN, of passeert
expliciet de simulatiegrens.** Geen `kosten -= 500` zonder ontvanger. Intern
betekent een tegenpartij; extern betekent een genoemde buitenwereld. Naast de
goederenwet uit `ECONOMIE.md` (iedere verbruikte eenheid komt uit voorraad,
productie of import) zijn dat de twee behoudswetten van deze wereld: **geld
blijft verklaarbaar, goederen blijven verklaarbaar.**

**GEEN VASTE PERCENTAGES VOOR CONSUMPTIE.** Niet `horeca = 8% van loon`.
Bestedingen hangen af van inkomen, huishoudtype, prijzen, locatie,
bereikbaarheid, seizoen, spaardoel, schuld en onzekerheid. Vaste *verplichtingen*
mogen wel vastliggen — dat is wat een contract is.

**GEEN CONFIDENCE-INDEX.** Voorzichtige consumenten ontstaan uit een onzeker
contract, een reorganisatie, een kleine buffer — niet uit
`consumentenvertrouwen -10`. Zoals overal: geen event dat een gevolg nabootst.

**GEEN SKILL- OF LEVENSFASE-BONUS.** Een gezin consumeert anders dan een
alleenstaande omdat het andere verplichtingen heeft, niet omdat er
`levensfase: gezin, bonus +0,3` staat.

**GEEN ECHTE INWONER GEMODELLEERD.** `vraag.js` zegt het al: aggregaten zijn hier
ook gewoon beter, en een LLM per burger is onbetaalbaar en voegt niets toe. Een
huishouden is een **cohort**, geen persoon met een naam.

**HUISHOUDENS ZIJN GEEN SPELERS EN GEEN PROFIELEN.** Ze hebben geen voortgang,
geen ranglijst en geen prestaties. Wat er over ze bewaard wordt is wat de
economie nodig heeft: inkomen, verplichtingen, buffer, schuld.

---

## 3. De onderdelen

Van klein naar groot, en elk onderdeel gebruikt de vorige.

| # | onderdeel | wat het toevoegt | staat er |
|---|---|---|---|
| 1 | bruto → netto → besteedbaar | de wig tussen loonkost en koopkracht | ✅ `huishoudboekje.js` |
| 1b | stijve vaste lasten | de huur zakt niet mee, dus vrije besteding wel | ✅ `huishoudtypen.js` |
| 2 | buffer en traagheid | schade is niet meteen maximaal | ✅ `huishoudtypen.js` |
| 3 | marginale consumptie | extra inkomen gaat niet volledig de markt op | ✅ `huishoudboekje.js` |
| 4 | huishoudtypen | zelfde salaris, andere bestedingsruimte | ✅ `huishoudtypen.js` |
| 5 | verplichtingen als geldstroom | huur → verhuurder, energie → energiebedrijf | ✗ |
| 6 | behoeftecategorieën | essentieel / semi-vrij / discretionair | ✗ |
| 7 | onzekerheid | reorganisatie verlaagt uitgaven vóór het ontslag | ✗ |
| 8 | werkloosheid met tijd | maand 1 buffer, maand 6 grote aankopen uitgesteld | ✗ |
| 9 | huishoudens kiezen echte bedrijven | €80 naar supermarkt A, €55 naar B | ✗ |
| 10 | sparen wordt kapitaal | loon → sparen → bank → krediet → onderneming | ✗ |
| 11 | schuld en aflossing | loonstijging hoeft de horeca niet te helpen | ✗ |
| 12 | vermogensverschillen | veerkracht uit balansposities | ◐ buffers verschillen; vastgoed en schuld niet |
| 13 | grote aankopen | recessie raakt de auto vóór het brood | ✗ |
| 14 | woon-werk en lekkage | wonen in Haarlem, werken in IJmuiden | ✗ |
| 15 | boodschappenmand → inflatie | +3% loon en tóch minder koopkracht | ✗ |
| 16 | belastingkringloop | overheid betaalt ambtenaren, die besteden weer | ✗ |
| 17 | vangnet | automatische stabilisatoren | ✗ |
| 18 | loononderhandeling met macrogevolgen | één loonbesluit raakt marge, markt én prijzen | ✗ |
| 19 | liquiditeit naast winst | winstgevend en tóch de lonen niet kunnen betalen | ✗ |
| 20 | betalingsachterstanden als keten | te laat betalen raakt de liquiditeit van een ander | ✗ |
| 21 | leverage | zelfde omzetdaling, andere uitkomst bij andere schuld | ✗ |
| 22 | markttoetreding en -uittreding | hoge marges trekken aanbod, maar niet meteen | ✗ |
| 23 | investeringen kosten tijd | vraag stijgt nu, aanbod reageert over twee jaar | ✗ |
| 24 | agglomeratie en congestie | clusters ontstaan én prijzen zichzelf weg | ✗ |
| 25 | regionale prijsverschillen | €3.000 betekent niets zonder locatie | ✗ |
| 26 | ervaren inflatie per huishoudtype | CPI 4% terwijl een kwetsbaar huishouden 7% voelt | ✗ |

### Wat de belangrijkste zijn, en waarom

**Verplichtingen als geldstroom (5)** is de grootste sprong. Nu verlaat het
grootste deel van elk nettoloon de wereld als "vaste lasten". Zodra huur bij een
verhuurder aankomt en energie bij een energiebedrijf, verdubbelt het aantal
kringlopen in één keer — en dan pas kan een woningmarkt iets betekenen.

**Behoeftecategorieën (6)** is wat recessies verschillend laat voelen. Bij
inkomensverlies gaat niet alles evenredig omlaag: huur en eten worden betaald,
het restaurant en de vakantie worden geschrapt. Zonder die volgorde raakt een
neergang elke sector even hard, en dat is precies wat `ECONOMIE.md` verbiedt.

**Huishoudens kiezen echte bedrijven (9)** is wat van vraag een markt maakt. Niet
`€200 boodschappen → retailsector`, maar €80 naar supermarkt A, €55 naar B, €25
naar de markt en €40 naar e-commerce buiten de stad — op prijs, afstand,
beschikbaarheid en openingstijd. Dan krijgt een individuele winkel zijn omzet
werkelijk van huishoudens.

**Woon-werk (14)** wordt beslissend zodra er meer dan één stad is. Een stad met
veel banen en weinig inwoners genereert inkomen dat elders wordt besteed. Loon
lekt geografisch — en dat maakt van banenconcentratie vanzelf reisvraag,
tijdkosten en woonkeuzes.

---

## 4. De drie grootboeken

Om te kunnen reconciliëren zijn er drie gezichtspunten op dezelfde stromen:

- **Bedrijfsgrootboek** — wie betaalde wat?
- **Huishoudgrootboek** — waar kwam inkomen vandaan en waar ging het heen?
- **Wereldstroom** — hoe lopen geldstromen tussen sectoren, steden en spelers?

Ze zijn geen drie waarheden maar drie **lezingen** van dezelfde boekingen; wijken
ze af, dan is er een boeking zonder tegenpartij. Dat is de reden dat de
behoudswet uit §2 machinaal gehandhaafd hoort te worden en niet met de hand.

---

## 5. De end-to-end-toets

Vier echte partijen, één keten:

> boer → leverancier → restaurant → werknemer/huishouden

1. Een huishouden koopt een diner van €40.
2. Het restaurant ontvangt €40.
3. Het restaurant betaalt een deel aan zijn leverancier.
4. Het restaurant betaalt loon.
5. De leverancier betaalt zijn eigen personeel.
6. Die werknemers kopen later weer goederen en diensten.

Wat er gemeten wordt is niet één euro met een nummer, maar hoe vaak dezelfde
economische waarde via **echte transacties** door de wereld circuleert.

---

## 6. En de mooiste schoktest

Een fabriek sluit. Honderd mensen raken hun inkomen kwijt. De wereld schrijft
**niet** `lokale vraag −10%`. Hij laat gebeuren:

> minder loon → buffergebruik → discretionaire consumptie daalt → horeca-omzet
> daalt → sommige diensten verdwijnen → loonmassa daalt verder → de huurmarkt
> reageert later → winkels reageren verschillend

En vinden die mensen snel ander werk, dan herstelt de economie vanzelf. Geen
recession flag, geen recovery flag. Alleen mensen en bedrijven.
