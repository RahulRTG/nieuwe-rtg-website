# Hoeveel tikken staat een functie van het beginscherm af

Gemeten, niet geschat. `scripts/tikken.js` loopt het huis af vanaf het
beginscherm (`/apps/app.html`, WERELD.md) in een echte browser, op
telefoonformaat, met een gewone ledensessie, en vraagt per scherm hoeveel
tikken het kost. `TIKKEN.json` is de uitslag; dit document zegt wat hij
betekent.

## De belofte

> **Elk scherm ligt binnen vijf tikken van het beginscherm van de mens die er
> hoort te komen, en elk scherm dat er niet ligt, draagt een uitgeschreven
> reden.**

Die eerste helft is op 30 augustus 2026 aangescherpt. De meter kende eerst
alleen het LID, en zette daarmee tweeëndertig schermen weg als "met reden
onbereikbaar: dat is een rolscherm". Dat klopte als verdediging, niet als
belofte: een medewerker met een PDA, een leverancier en het kantoor van RTG
verdienen dezelfde vijf tikken vanaf *hun* beginscherm. De meter meet daarom per
rol, elk met een echte sessie langs de server:

| rol | beginscherm | dat is |
|---|---|---|
| `lid` | `/apps/app.html` | een gewoon lid met een RTG Pass, op de werktafel |
| `zaak` | `/apps/leverancier.html` | de manager van een zaak |
| `kantoor` | `/apps/backoffice.html` | een medewerker van RTG met een kantoortoken |

Een rol die niet ingelogd kon worden wordt **overgeslagen met de reden erbij** en
laat `--controle` zakken: niet gemeten mag nooit als "in orde" langskomen.

Die tweede helft is even hard als de eerste. De lijst met redenen staat in
`scripts/tikken.js` (`MET_REDEN`), per scherm, in drie soorten: **ROL** (een
scherm van een rol die deze meter nog niet nabootst), **LANDING** (je landt er
via een code of een link, zie `scripts/lib/bereik.js`) en **STAND** (een adres
dat een stand van een andere app is geworden).

`node scripts/tikken.js --controle` zakt zodra er een scherm onbereikbaar is
dat géén reden draagt. Een reden die verlopen is -- het scherm blijkt alsnog
bereikbaar -- wordt gemeld maar laat de controle niet zakken: dat is goed
nieuws, alleen mag de regel dan weg.

## Wat een tik is

- een zichtbare link of knop met een bestemming aantikken: **1 tik**;
- een bestemming die er staat maar niet zichtbaar is (achter een tabblad, een
  lade, een dichtgeklapt paneel): **2** -- eerst openmaken, dan aantikken;
- **typen is geen tik.** Wie in een lijst drie letters typt, heeft een veld en
  een resultaat aangetikt.

## Wat de meter niet ziet

Een knop die met JavaScript ergens heen springt zonder `href` of `data-url`
bestaat niet voor deze meter. De uitkomst is daarmee een **bovengrens**: het kan
in werkelijkheid korter zijn. Dat is met opzet zo gelaten, want het maakt de
meter oneerlijk in de veilige richting -- hij is niet op te poetsen met een
belofte. Wie een korte weg bouwt, hangt het adres op de knop; dan telt hij mee.

En hij meet de weg **naar** een scherm, niet de weg naar een handeling binnen dat
scherm. Dat laatste staat in `test/*.e2e.js`.

## De eerste meting, 30 augustus 2026

| tikken | schermen |
|---|---|
| 0 (het beginscherm zelf) | 1 |
| 2 | 4 |
| 3 | 119 |
| 4 | 76 |
| 5 | 24 |
| buiten bereik | 52 |

Tweeënvijftig schermen waren vanaf het beginscherm **helemaal niet** te
bereiken -- niet diep, maar los. Daaronder gewone ledenschermen: RTG Mall, RTG
Pay, Thuis, Uitgaan, de Food Court, Game Night, het tweede scherm, Mijn
bestellingen, het app-dossier (dat volgens APPSTORE.md juist bij het lid hoort),
Aankomst, het routedossier, OV-routes, en het bord en het schrift van de
RTFoundation. Twee schermen stonden zelfs wél in `MAPPEN` en waren tóch
onbereikbaar (Passkeys, de wereldlaag): de huizen van de werelden dragen een
handgeschreven rooster dat uit elkaar was gelopen met de lijst waar het uit
hoort te komen.

## Wat eraan gedaan is

1. **De sprong** (`public/shared/sprong.js`): één greep die op elk scherm op
   dezelfde plek staat, met daarachter alles wat u kunt openen. Eén tik naar de
   lijst, één tik naar de functie -- twee tikken, waar u ook staat. De lijst komt
   uit `public/shared/sprongindex.json`, en die wordt **afgeleid** uit `MAPPEN`
   door `scripts/sprongindex.js`; er komt dus geen tweede lijst bij (LAT.md
   regel 4). Op `/apps/app.html` opent dezelfde greep de bestaande zoeklade van
   de leden-app, want die weet meer (uw pas, en Rahul) -- twee spotlights naast
   elkaar zou precies de fout van het tweede bank-kopje herhalen.
2. **De veertien dakloze ledenschermen** hangen nu in de wereld waar de mens
   denkt te zijn als hij ze gebruikt (`WERELDEN.md`), en staan daarmee ook in de
   sprongindex.
3. **De rijen dragen hun adres** -- in de sprong én in de zoeklade van de
   leden-app -- zodat de korte weg meetbaar is en niet stilletjes kan verdwijnen.

## Wat er daarna nog bij kwam

**De huizen komen uit dezelfde bron.** Elk wereldhuis droeg een handgeschreven
rooster diensten dat uit de pas liep met `MAPPEN` -- precies waardoor Passkeys en
de wereldlaag onbereikbaar waren terwijl ze wél in een wereld hingen.
`shared/wereldrooster.js` vult per huis een blok *Alles in deze wereld* uit
dezelfde index. Het redactionele rooster blijft ernaast staan: dat verleidt, dit
is compleet.

**De sprong springt ook naar een handeling.** Bovenaan staat *Hier*: wat je op
dít scherm kunt doen, gelezen uit `RTGAppMenu.functies()` -- dezelfde lijst die
het app-menu toont. En wie typt, vindt ook handelingen die in een ándere app
wonen ("fooi" → *Fooi erop, in Horeca*), uit `shared/handelingindex.json`, dat
uit de knoppen van de schermen zelf wordt gelezen. Een tik brengt je erheen en
voert niets uit: klaarzetten mag, doen doet de mens (`GRAMMATICA.md`).

**Vindbaarheid wordt gemeten.** `scripts/vindbaar.js` vraagt of je een functie
terugvindt met het woord dat er zelf op staat. Eerste uitslag: **21%** -- en de
gemiste woorden waren bijna allemaal handelingen. Na de handelingindex: **68%**,
met een vloer van 60% die omhoog gaat en nooit omlaag. Wat blijft missen is
proza ("rustig", "alsof"), en dat hoort ook nergens heen te leiden.

**Elke rol krijgt zijn eigen belofte.** De meter loopt het huis nu drie keer af:
als lid, als zaak en als kantoor, elk met een echte sessie. Daarmee vervielen elf
"met reden onbereikbaar"-regels: die schermen liggen gewoon binnen vijf tikken --
alleen niet vanaf het beginscherm van een lid.

## De stand nu

| tikken | schermen |
|---|---|
| 0 (de drie beginschermen zelf) | 3 |
| 1 | 23 |
| 2 | 120 |
| 3 | 82 |
| 4 | 25 |
| 5 | 0 |
| met reden buiten bereik | 23 |

Bereikt per rol: lid 243, zaak 208, kantoor 251 van de 276 schermen.

Waar het begon met 119 schermen op drie tikken, 24 op vijf en 52 buiten bereik,
ligt nu **niets meer op vijf tikken** en zijn de 52 losse schermen er 23 --
allemaal met een uitgeschreven reden, en per stuk na te lopen in `TIKKEN.json`
mét de route en de rol die hem loopt.

## Wat hier niet staat, en eerlijk gezegd moet worden

Dit is gemeten met een browser en niet met een mens. Vijf tikken die je moet
zóéken zijn erger dan zeven die vanzelf gaan; deze meter kent dat verschil niet.
Hij is een ondergrens voor de vraag "is het te bereiken", geen oordeel over de
vraag "is het te vinden". Diezelfde grens staat als laatste zin in
`TOEGANKELIJK.md`, en om dezelfde reden.
