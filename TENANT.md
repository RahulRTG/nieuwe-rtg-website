# RTG Tenant Control Plane — de klant als ding

*Het diepte-document van de bedrijvenkant naar buiten toe: hoe een organisatie
het Werk OS onder haar eigen naam gebruikt zonder dat er een tweede platform
ontstaat. `CONCERN.md` gaat over wat er BINNEN een bedrijf gebeurt; dit gaat
over wie dat bedrijf voor ons IS.*

Opgesteld 23 augustus 2026, bij het bouwen van de spine.

---

## 1. De vraag, en waarom hij niet met een laag erbij te beantwoorden is

"Kunnen onze partners het Werk OS onder hun eigen merk gebruiken?" leest als een
ontwerpvraag en is er geen. Dit huis had **drie codes die alle drie 'de klant'
leken te betekenen**, zonder één draad ertussen:

- `org` — de sleutel van `sso_koppelingen` en van de SCIM-sleutels
- `W…` — de werkruimtecode van het Werk OS (`db.data.werkruimtes`)
- de leverancierscode — de zaak in het leveranciersregister

Er was geen plek waar stond dat die drie bij elkaar hoorden. Daardoor kon
niemand zeggen welke werkruimtes onder welk contract vielen, droeg het Werk OS
nergens de naam van zijn eigen klant, en moest een medewerker die via de
provider van zijn werkgever inlogde daarna alsnog met de hand in de werkruimte
worden gezet — inclusief het met de hand weer weghalen, wat bij
uitdiensttreding de stap is die overslaat.

Een white-labellaag **naast** het Werk OS bouwen zou dat niet oplossen maar
verdubbelen. Wat er moest komen is een spine: één plek waar staat wie de klant
is, waar de bestaande onderdelen aan hangen.

## 2. De vier betekenissen, en er komt er geen vijfde bij

| Bestaand object | Wat het vanaf nu betekent |
|---|---|
| `org` | de juridische, beveiligings- en contractgrens — **de tenant** |
| werkruimtecode `W…` | een Werk OS-productinstantie binnen die organisatie |
| leverancierscode | een zakelijke relatie of kanaal — **nooit** een identiteit |
| RTG-account | een mens |
| werkruimtelid | de binding tussen mens, tenant, werkruimte en tijdgebonden rol |

```
org
 ├── contract, SSO, SCIM, sleutels en datagrens
 ├── een of meer werkruimtes W…
 ├── een of meer zaken (kanalen)
 ├── een merk
 └── groepsafbeeldingen → rollen → de 18 werkwoordrechten
```

**Waarom `org` en geen nieuw id.** `org` was al de grens waarlangs identiteit en
domeinbezit geregeld zijn: wie een domein op de lijst van een SSO-koppeling zet,
neemt de zeggenschap over elk account op dat domein over. Een vierde
identiteitsmodel erbij zou de contractgrens en de inloggrens uit elkaar trekken,
en dan is "mag deze persoon hier bij" op twee plaatsen te beantwoorden — de fout
van `LAT.md` regel 4, en bij een toegangsvraag de duurste.

Een tenant **kan zonder SSO bestaan**: niet elke klant heeft een provider. De
koppeling is dan simpelweg afwezig; de org blijft de grens.

Een dochteronderneming valt binnen dezelfde tenant, tenzij zij bewust een eigen
`org` krijgt omdat er een aparte contract-, sleutel- of datagrens nodig is.
**Merkgrens en beveiligingsgrens worden nooit stil hetzelfde object**: twee
werkruimtes onder één tenant kunnen elk hun eigen naam voeren, maar delen de
contractgrens; wie ze ook juridisch wil scheiden, neemt een tweede org.

Vastgelegd in `server/kern/tenant/register.js`, gemeten in
`test/tenantspine.test.js`.

## 3. De drie modi zijn een contract, geen thema-instelling

Ze zeggen hoeveel van RTG de medewerker van de klant nog ziet.

| Modus | Wat de klant krijgt | Stand |
|---|---|---|
| **powered** | klantmerk met zichtbare RTG-schil | gebouwd |
| **private** | klantmerk; RTG alleen in de herkomst- en juridische regels | gebouwd |
| **sovereign** | eigen domein, eigen sleutels, eigen runtime | **geweigerd, met de reden** |

`sovereign` is niet weggelaten maar **weigert actief**, en dat is een besluit en
geen omissie. Dit huis heeft geen externe hosting, geen certificaat-machinerie
voor domeinen van derden en geen routering op hostnaam; `kern/webmaker.js` legt
vast dat het eigen web met opzet op `naam.rtg` binnen het ecosysteem blijft.
Een modus die je kunt kiezen terwijl geen enkele regel code hem bedient, is de
belofte-zonder-code van `LAT.md` regel 6 — en bij een verkoopbaar contract is
dat de duurste soort. De volgorde om hem te verdienen staat in `TAKEN.md` 4.21:
eerst het besluit **of** dit huis extern gaat hosten, dan certificaten, dan
routering op hostnaam, en pas dan een scherm dat het aanbiedt.

Weglaten leest als vergeten; weigeren met een reden leest als een besluit.
Daarom staat de reden ook in het antwoord van `GET /api/techniek/tenant`.

## 4. De merkkern: één bron, geen derde huisstijlsysteem

Het merk-idee bestond al twee keer — `kern/theater/huisstijl.js` (de interne
mediawereld van een zaak) en `kern/webmerk.js` (een keten met vestigingen) —
allebei met dezelfde velden en hun eigen validatie. Een derde kopie voor het
Werk OS zou betekenen dat "wat is een geldige accentkleur" op drie plaatsen
staat, en binnen een maand op drie plaatsen anders.

`server/kern/tenant/merkkern.js` is daarom de **definitie** en niet de opslag:
welke velden bestaan, wat een geldige waarde is, wat de standaard is, en waar
het merk ophoudt. De opslag blijft waar hij hoort — het Theater per kanaal,
Webmerk per keten, de tenant per org — want die drie hebben een verschillende
scope, en dat is geen duplicatie maar het verschil tussen een zaak, een keten en
een contract.

**Wat het manifest vandaag bestuurt:** de schermen van het Werk OS. Meer niet.
E-mail, documenten, facturen, meldingen, het PWA-manifest en de AI-toon dragen
dit merk **niet**; dat staat in `TAKEN.md` 4.55 en het staat hier omdat een
opsomming zonder die zin als dekking leest.

**Het manifest is ondertekend, en dat doet iets.** Niet als
vertrouwensdecoratie: het merk bepaalt wat een medewerker op zijn scherm leest
over wie hij is en waar hij is, en de opslag wordt door meerdere processen
aangeraakt (een backup terugzetten, een migratie, een fout elders). De
handtekening wordt bij het uitleveren opnieuw gerekend en aan de modus van de
tenant gebonden; klopt hij niet, dan komt de **standaardstijl** naar buiten met
de reden erbij — niet het manifest dat er stond.

### De herkomstregel gaat nooit uit

Ook in `private`. Een medewerker van een klant hoort te kunnen achterhalen wiens
software zijn personeelsdossier bewaart. Dat is geen merkvraag maar een
AVG-vraag, en het antwoord mag niet afhangen van een verkoopcontract. Het
manifest draagt hem altijd en er is geen veld om hem leeg te maken;
`test/werkmerk.e2e.js` leest hem in een echte browser van het scherm.

### De kleur blijft binnen het eigen blok

De accentkleur van de klant komt als `--wk-merk-accent` op de schil van de
werkruimte te staan en wordt door **één** regel gebruikt: de merkbalk. De
kopbalk, de navigatie en de rest van de app blijven van RTG. Dezelfde grens die
`test/mediazaak.e2e.js` voor de leden-app afrekent — een tenant die de hele app
kan omverven, kan iemand laten denken dat hij ergens anders is dan hij is.

De e2e-toets loopt daarvoor **elk element buiten de merkbalk** na op die kleur,
en niet twee eigenschappen van twee elementen: een grens die je op twee plekken
prikt, mis je op de derde.

## 5. De identiteitsbrug

```
IdP-groep → tenant (org) → werkruimte (W…) → tijdgebonden rol → 18 werkwoordrechten
```

OIDC, SCIM en WebAuthn lagen er al; wat ontbrak was de laatste schakel. De brug
(`server/kern/tenant/brug.js`) legt hem, en houdt zich aan vier regels:

1. **Zonder groepsafbeelding gebeurt er niets.** De huisregel van de werkruimte
   is dat aanmelden niet binnen zijn is. Er komt dus niemand binnen door in te
   loggen; er komt iemand binnen omdat een mens met het beheer-token heeft
   opgeschreven dat groep X rol Y krijgt — hoe perfect de inlog ook is.
2. **Een IdP-rol is beheerd, een handmatige rol niet.** Rollen uit een groep
   dragen `bron:'idp'` en worden bij elke inlog opnieuw gezet: valt de groep weg,
   dan valt de rol weg. Rollen die een mens gaf blijven staan. Zonder dat
   onderscheid wist de eerste synchronisatie het handwerk van de beheerder, of
   bleef een ingetrokken groep eeuwig hangen.
3. **Een IdP herstelt geen ontslag.** Is een lid door een mens uit dienst gezet,
   dan brengt een groepslidmaatschap hem niet terug. Anders is "uit dienst" een
   stand die de volgende synchronisatie ongedaan maakt.
4. **Intrekken is synchroon.** Een SCIM-deactivatie sluit de werkplek in élke
   werkruimte van diezelfde tenant, binnen hetzelfde verzoek. Krijgt de IdP zijn
   204, dan is de toegang weg. Een wachtrij zou van uitdiensttreding een
   tijdvenster maken, en bij een ontslag op staande voet is dat venster precies
   het probleem. En hij raakt **alleen** die tenant: een IdP-beheerder van klant
   A zet niemand uit de systemen van klant B.

### Wie mag wat, en waarom daar

| Handeling | Wie | Waarom daar |
|---|---|---|
| tenant aanmaken, werkruimte of zaak eraan hangen | de eigenaar | wie zijn werkruimte zelf kan koppelen, kan hem aan andermans tenant koppelen |
| de IdP aan de org hangen | de eigenaar | domeinbezit is een menselijke controle, geen code |
| het merk van de tenant zetten | de eigenaar | het merk hangt aan het contract |
| een groep aan een rol koppelen | de beheerder van díe werkruimte | een personeelsbesluit hoort bij de klant |

## 6. De bootstrap, en wat er met name NIET in staat

`POST /api/tenant/bootstrap` (lid-token) en `/api/tenant/bootstrap/mijn`
(RTG-sessie) geven één antwoord waarmee een scherm weet wie het bedient:
tenant, werkruimte, merk, identiteit, rollen, rechten en de rechtenkaart.

Wat er **niet** in staat, staat er als `nietGebouwd` **met de reden**:
`entitlements`, `quotas`, `policies`, `trust` en `lifecycle`. Een bootstrap met
`quotas: {}` erin is de duurste vorm van de belofte-zonder-code: elk scherm dat
hem leest gaat zich ernaar gedragen, en een leeg quotum leest als "geen
verbruik". Een ontbrekend veld leest als "nog niet opgehaald"; een genoemd veld
met een reden leest als een besluit. Het Werk OS zet die lijst ook op het
scherm, want anders is de enige plek waar het staat de JSON die niemand opent.

**Het antwoord is niet ondertekend, en het merk erin wel.** Een handtekening
bestaat om een ontvanger iets te laten controleren dat hij niet zelf kan
afleiden. De bootstrap wordt per verzoek uit de sessie opgebouwd en door
niemand anders gelezen dan het eigen scherm; wij zouden onze eigen handtekening
controleren. Zodra een tweede proces hem doorkrijgt in plaats van hem zelf op te
bouwen, hoort hij ondertekend te worden — `TAKEN.md` 4.56.

## 6b. De uitgang: weggaan zonder je geschiedenis te verliezen

Exit-recht is de eis waar een inkoper een verkoop op stukmaakt, en hij is niet
af met een knop die JSON teruggeeft. De bewering is dat een organisatie bij ons
weg kan en haar werk meeneemt, en die maak je alleen waar door de uitvoer
**weer in te lezen** en aan te tonen dat er hetzelfde uit komt.
`test/tenantuitgang.test.js` toets 3 doet precies dat.

**De uitvoer neemt de hele subboom mee, met een lijst van wat eruit MOET** --
niet een lijst van wat erin mag. Dat is de omgekeerde richting van hoe je een
API-antwoord bouwt, en met opzet: een soort die iemand vergeet toe te voegen
ontbreekt anders stilzwijgend in de export van een vertrekkende klant, en dat
merkt niemand tot het te laat is. Wat er niet in mag staat met naam in `GEHEIM`
(`beheerToken`, `token`, `lidToken`, `rtgKey`), en de toets doorzoekt de hele
uitvoer op de sleutels die werkelijk zijn uitgedeeld in plaats van drie velden
te prikken.

`rtgKey` staat er niet vanwege geheimhouding maar vanwege het codenaam-ontwerp:
hij legt buiten de kluis om een verband tussen een werkruimtelid en een
RTG-account. De personeelsnamen gaan wél mee -- dat is de eigen administratie
van de werkgever.

**Het recept reist mee, en dat is het eigenlijke bewijs.** Een checksum die
alleen de producent kan narekenen bewijst de ontvanger niets; wij zouden even
goed kunnen liegen over de uitkomst. In de uitvoer staat daarom hoe je hem
narekent: sha256 over de canonieke JSON (sleutels alfabetisch) per soort, en
daarna over de catalogus. Drie regels aan de ontvangende kant, zonder ons. Er
stond een endpoint om het na te laten rekenen; dat is er weer uit, om precies
deze reden -- en omdat open rekenwerk over willekeurige JSON een deur is die
niemand nodig heeft.

De checksum is **ongezouten**, en dat is het verschil met `lib/vingerafdruk.js`:
die zout per proces omdat hij alleen mag tonen DÁT er iets veranderde. Een
exportcatalogus moet juist op een andere machine, in een ander jaar, door een
andere partij na te rekenen zijn. Twee instrumenten met tegengestelde eisen; ze
delen daarom geen code.

**Inlezen maakt altijd een nieuwe werkruimte**, nooit over een bestaande heen --
een herstel dat kan overschrijven is een wapen zodra iemand het verkeerde
bestand kiest. En de leden komen terug **zonder sleutel**: toegang teruggeven is
een besluit van een mens, geen bijwerking van een herstel.

**Een correctie op wat hier eerst stond.** Bij het opschrijven van deze laag
noteerde ik dat de bijlagen en media van een werkruimte buiten
`db.data.werkruimtes` wonen en dus niet meegaan. Dat is nagemeten en het klopt
niet: de Werk OS-laag kent **geen bijlagen**. Een contract is er metadata met
een uitgerekende opzegdag, geen PDF; er is nergens een upload. Alles wat een
werkruimte bezit, staat in haar eigen subboom en gaat dus mee.

Wat er wél buiten valt, en dat is een keuze en geen gat: de documenten, de
agenda en de post van de **medewerkers**. Die horen bij hun eigen RTG-account —
de werkruimte zag daar altijd al alleen tellingen van (`bedrijf/aansluiting.js`)
— en wie ze wil, vraagt zijn eigen inzage aan. Het leesbare overzicht zegt dat
met zoveel woorden onder "Wat er NIET in zit".

### De levensloop

Vier standen, en geen zeven. `voorbereiding`, `proef` en `beperkt` stonden in de
plannen en dwingen niets af; een toestand die niets doet leest op een scherm als
een werkend mechanisme.

| Stand | Wat er geldt |
|---|---|
| `actief` | alles werkt |
| `opzegging` | het einde is aangekondigd; alles werkt nog gewoon door |
| `bewaring` | de toegang is dicht, de klok naar vernietiging loopt |
| `vernietigd` | de gegevens zijn weg; alleen het bewijs blijft |

- **Uitvoer kan in elke stand behalve `vernietigd`**, ook in de bewaring en ook
  bij een betalingsachterstand. Er is nergens een voorwaarde die de export van
  een stand of een betaalstatus af laat hangen: een klant die zijn rekening niet
  betaalt verliest zijn geld en niet zijn geschiedenis. Zou dat wel mogen, dan
  is exit-recht een gunst -- precies op het moment dat hij telt.
- **De bewaring sluit de toegang door de sleutels in te trekken**, niet met een
  vlag die elke route apart moet lezen. Een lid-token wordt tegen `l.token`
  gehouden; is die weg, dan is de deur overal tegelijk dicht. Het beheer-token
  blijft werken, want de klant moet zijn uitvoer nog kunnen ophalen.
- **Vernietigen kan niet voor de termijn en niet onder een bewaringsplicht**, en
  levert een bewijs met aantallen en checksums en **zonder persoonsgegevens** --
  een vernietigingsbewijs met namen erin is een kopie van precies dat wat
  vernietigd moest worden.
- Uit `bewaring` en `vernietigd` komt niemand terug. Dat zijn eindstanden.

### De veger komt hier niet langs

`werkruimtes` en `tenants` stonden nergens in het bewaarbeleid en dus in de
gatenlijst van `zonderBeleid()`. Ze er met een gewone termijn bij zetten zou
erger zijn geweest dan het gat: hun datumveld is een **aanmaakmoment**, dus een
termijn van 90 dagen laat de generieke veger elke klant wissen die langer dan
negentig dagen bestaat. De klok hoort pas bij de opzegging te beginnen, kan
onder een bewaringsplicht stilstaan en eindigt met een bewijs -- dat is een
levensloop en geen termijn.

Vandaar een derde vorm in `bewaarbeleid.js`: **`eigenRegie`**. De tak telt mee in
het rapport, verdwijnt uit de gatenlijst, en `veeg()` komt er niet langs. Het
veld `regie` wijst aan waar de klok dan wel woont. Er is een vierde grond
`contract` bijgekomen, want wij bewaren dit niet omdat de wet het eist en niet
omdat wij het nodig hebben, maar omdat de klantovereenkomst een uitlooptijd
geeft.

## 6c. Het contract en het quotum

**Een verlopen contract is geen noodknop.** Het weigert NIEUWE inrichting -- een
werkruimte erbij -- en verder niets: de mensen die er werken blijven werken en de
uitvoer blijft open. Toegang sluiten is een handeling in de levensloop, met een
reden, een actor en een spoor. Zou een factuur dat kunnen, dan hebben wij een
knop waarmee we het bedrijf van een klant stilleggen, en die knop hoort niet te
bestaan.

**In het contract staan alleen grenzen die worden afgedwongen.** Drie pakketten
(proef, zakelijk, concern) met twee grenzen die echt bijten: het aantal
werkruimtes onder de tenant en het aantal verzoeken per uur. Wat een
verkooppraatje verder belooft -- opslag, aantal leden, supportvenster,
hersteltijd -- staat in `nietAfgedwongen` met de reden, want een grens in een
object waar geen enkele regel code naar kijkt leest voor elk scherm als een
werkende limiet.

Een uitzondering op een grens kan, maar **alleen omhoog en met een reden**: een
grens die stil naar beneden gaat valt pas op als een klant vastloopt. En een
pakketwissel zet de uitzonderingen terug, anders blijft een ruimte die ooit bij
een pilot hoorde stilletjes staan na een downgrade.

**Het quotum telt per tenant en overleeft een herstart.** De rem op de deur
(`middleware/remmen.js`) telt per IP en beschermt de server; die zegt niets over
wie er te veel gebruikt, want honderd medewerkers komen van honderd adressen en
een kantoorproxy komt met honderd man van één. Pas per tenant is "u zit aan uw
grens" een zin die klopt en die iemand kan oplossen -- en dat is ook het
eerlijke deel van fairness: wie eroverheen gaat merkt het zelf en niet zijn
buurman. De teller staat in de opslag, per uur; `save()` is write-behind dus het
kost geen schrijfactie per verzoek.

**Geteld wordt op de twee deuren van de werkruimte** (`beheerVan` en `lidVan` in
`bedrijf/index.js`) en niet op 104 routes: daar is het volledig, en daar kan het
niet vergeten worden bij route 105. De **uitvoer telt nooit mee en wordt nooit
geweigerd** -- exit-recht dat op een teller kan stuklopen is geen recht.

**Hoe vaak hij naar de schijf gaat, en wat dat kost.** De eerste versie riep
`save()` bij elk verzoek aan, en `save()` loopt bij SQLite langs een
`JSON.stringify` van élke collectie -- daarmee werd elke leesactie in een
werkruimte een schrijfactie op het hele bestand. Nu: het eerste verzoek van een
uur, elke 25e, en elke weigering. De prijs staat erbij en is bewust gekozen: bij
een herstart gaan hooguit 24 tellingen verloren. Dit is een eerlijkheidsgrens en
geen betaalmeter -- wie er structureel doorheen loopt haalt de grens ook met
vierentwintig verzoeken minder. Wat het niet mag zijn is een teller die bij nul
begint, en dat blijft hij ook met deze vloedlijn niet.

## 6d. De bewijspoort: geen bewering zonder bron

Dit is de laag die de dode enterprise-schil onmogelijk maakt.

`public/shared/enterprise-shell.js` zette "Enterprise beveiligd · versleutelde
werkruimte · audit gereed · Commercial" op het scherm, en geen van die vier had
een bron. Het probleem was niet die ene schil maar dat een bewering een stuk
**tekst** was, en tekst kun je altijd typen. `server/kern/tenant/bewijs.js`
maakt er een object van met een bron: `stand(org)` geeft per bewering terug of
hij vandaag waar is en waarom (of waarom niet), en een scherm mag alleen tonen
wat op `mag: true` staat.

| Bewering | Waar hij vandaan komt |
|---|---|
| Versleutelde opslag | staat `RTG_ENC_KEY` gezet |
| Auditspoor | het aantal journaalregels over de werkruimtes van deze tenant |
| Eigen identiteitsprovider | een actieve SSO-koppeling op deze org |
| Commercieel contract | een lopend contract |
| Dagelijkse back-up | de nieuwste map in `<datamap>/backups`, hooguit twee dagen oud |
| Eigen domein | **altijd nee**, met de reden en `TAKEN.md` 4.21 |
| SLA met een boete | **altijd nee** zolang een van vier voorwaarden ontbreekt |

De laatste twee staan er juist omdat ze nee zijn: weglaten leest als vergeten,
en dan typt iemand ze een keer met de hand. En de SLA is een **berekening en
geen mening** — vier voorwaarden (een lopend contract, een meting, een
incidentproces met een gemeten reactietijd, een herstelproef), waarvan er
vandaag twee ontbreken. `SLO.md` zegt hetzelfde in woorden; dit is dezelfde zin
in code.

**De cijfers zijn platformbreed en dat staat erbij.** De SLO's meten de hele
server en niet deze klant, en er is geen meting per capability. Daarom staat er
in de tenantstand **geen enkel beschikbaarheidsgetal** — een cijfer dat de
meting niet kan dragen is preciezer dan de werkelijkheid en dus onwaar, en het
zou het eerste zijn wat een scherm oppikt. `test/tenantbewijs.test.js` toets 6
rekent af dat er geen "99,9"-achtig getal in voorkomt.

**Wie ziet wat.** De volledige stand, inclusief de redenen waarom iets níét mag,
zit achter het beheer-token (`/api/tenant/status`). De bootstrap geeft elk lid
alleen de beweringen die wél waar zijn, met hun bron: dat een organisatie geen
SSO en geen versleutelde opslag heeft is een lijstje zwakke plekken en geen
mededeling voor iedereen die er werkt.

In het Werk OS stond in de kopbalk nog "Organisatie beschermd", vast in de HTML.
Die tekst komt nu uit `bootstrap.beweringen` — en is er dus niet meer als er
niets waar is.

## 7. De lat

Wat een tenantvariant moet halen. **Per regel staat erbij of hij vandaag
gemeten wordt**, want een lat waarvan de helft een voornemen is, is geen lat.

| Eigenschap | Norm | Vandaag |
|---|---|---|
| Merkscheiding | 0 elementen buiten het merkblok dragen de kleur van de klant | gemeten (`test/werkmerk.e2e.js`) |
| Herkomst | de herkomstregel is in geen enkele modus uit te zetten | gemeten |
| Tenantisolatie | een werkruimte of zaak hoort bij hooguit één tenant | gemeten (`test/tenantspine.test.js`) |
| Identiteit | IdP-groep → org → werkruimte → rol volledig te volgen | gemeten |
| Deprovisioning | intrekking werkt in élke werkruimte van die tenant, binnen het verzoek | gemeten |
| Kruistenant | een deprovisioning bij A raakt niets bij B | gemeten |
| Claims | 0 enterprisebeweringen zonder bron | gemeten (`test/tenantbewijs.test.js`): elke bewering heeft een bron of een reden, en de kopbalk van het Werk OS leest ze uit die lijst |
| Merkdekking | 100% van schermen, mails, documenten en meldingen uit de merkkern | **niet gehaald**: alleen schermen (4.55) |
| Exit | een volledige export is aantoonbaar opnieuw in te lezen | gemeten (`test/tenantuitgang.test.js` toets 3) |
| Contract | de grenzen die gelden komen uit een pakket, en wat niet wordt afgedwongen staat er met reden bij | gemeten (`test/tenantcontract.test.js`) |
| Quota | per tenant, en een herstart wist ze niet | gemeten (`test/tenantcontract.test.js` 5-7) |
| Levenscyclus | elke tenantstand met reden, actor en bewijs | gemeten (`test/tenantuitgang.test.js`, `test/tenantspine.test.js` 12-14) |
| Vormtaal | het Werk OS draait op de tokenlaag van ONTWERP.md en niet op een eigen palet | gedeeltelijk: werk.html draagt hem, 183 andere pagina's nog niet (meter `schermenZonderVormtaal`) |
| Codeforks | 0 klantspecifieke forks | gehaald, en dat is de reden dat het merk uit getypeerde velden komt en niet uit vrije CSS of JS |

## 8. De bouwvolgorde

1. **Waarheidsopruiming** — gedaan. `public/shared/enterprise-shell.{js,css}`
   is weg: dode code die nergens werd ingeladen en "Enterprise beveiligd · audit
   gereed · Commercial" beweerde zonder een bron die dat kon dragen.
2. **Tenant Spine** — gedaan. `org` canoniek, de codes expliciet gekoppeld.
3. **Merkkern** — gedaan, en sinds kort ook echt de ENIGE bron. Het huis had
   het merk-idee vier keer: deze kern, `kern/theater/huisstijl.js`,
   `kern/webmerk.js` en `kern/journalistiek.js`. Ze waren al uit elkaar gelopen,
   en niet op een detail: het Theater weigerde een foute accentkleur met een
   melding, Webmerk en Journalistiek negeerden hem **stil** en gaven `ok: true`
   terug met de oude kleur erin. Voor wie de knop indrukt is dat het verschil
   tussen weten dat het niet mocht en denken dat het gelukt is, en de stille
   variant was in de meerderheid. Alle drie lezen nu `leesMerkvelden()`;
   `test/merkkern.test.js` bewaakt zowel de waarderegels als de STRUCTUUR (de
   drie dragen geen eigen hexcontrole of themalijst meer), want zonder dat
   tweede komt de vijfde kopie er gewoon weer bij.

   Wat de merkkern nog steeds NIET bestuurt, en dat blijft hier staan omdat een
   opsomming zonder die zin als dekking leest: e-mail, documenten, facturen,
   meldingen, het PWA-manifest en de AI-toon dragen het merk van de klant niet.
4. **Tenant Bootstrap** — gedaan, ondertekening open (4.56).
5. **Identiteitsbrug** — gedaan voor OIDC-groepen, SCIM-deactivatie én SCIM
   `/Groups`. Een groepswijziging bij de klant werkt nu meteen door in plaats
   van pas bij de volgende inlog; bij het inloggen wordt de unie van de
   tokenclaim en de SCIM-tabel genomen.

   **SAML is er sindsdien ook** (`server/sso/saml/`, `routes/sso-saml.js`). Hij
   stond hier als een besluit om hem NIET te bouwen, met een reden die klopte:
   een SAML-SP vraagt XML-canonicalisatie en XML-DSig-verificatie, dit huis
   heeft nul runtime-afhankelijkheden, en de faalvorm van zelfbouw is een
   **stille authenticatie-bypass**. Dat besluit is teruggedraaid, en het enige
   wat die reden onschadelijk maakt is dat er nu op geschoten wordt.

   **Hij komt uit op hetzelfde claimcontract als OIDC.** Wat een assertie moet
   doen om `{ sub, email, email_verified, name, groups }` op te leveren, is de
   zorg van `sso/saml/`; daarna loopt hij door `sso/binnenkomst.js` — dezelfde
   vijf stappen, dezelfde identiteitsbrug, hetzelfde overdrachtsbewijs. In
   `binnenkomst.js` staat geen enkele `if (saml)`, en dat is de eis: twee deuren
   die hetzelfde doen lopen uiteen, en dan hangt iemands rol af van welke knop
   hij gebruikte.

   **Het profiel is zo smal dat de aanval er niet in past.** Precies één
   `Assertion` in het hele document en precies één `Signature`; het ondertekende
   element moet de OUDER van die handtekening zijn; een ID moet naar precies één
   element wijzen; en — de regel waar het om draait — de assertie die we LEZEN
   moet een nazaat zijn van het stuk dat is GECONTROLEERD. Geen SHA-1, geen
   HMAC, geen XPath- of XSLT-transform, en de sleutel komt nooit uit `KeyInfo`
   maar altijd uit de koppeling. Verder: `InResponseTo` moet bij een verzoek
   horen dat wij hebben gestuurd (dat sluit de ongevraagde, IdP-initiated inlog
   af), en zowel het verzoek als de assertie werkt één keer.

   **En er is op geschoten.** `test/samlxsw.test.js` bouwt echte, geldig
   ondertekende antwoorden met een wegwerpsleutel en verminkt ze daarna: XSW met
   een tweede assertie, een handtekening die een ANDER element dekt (en
   wiskundig klopt), een handtekening die is losgemaakt van zijn element, een
   ongetekende assertie, inhoud die na het ondertekenen is veranderd, een
   verlopen assertie en een verkeerd publiek. `test/samlc14n.test.js` legt onze
   canonicalisatie naast die van libxml2 — onszelf toetsen met onszelf zegt over
   c14n niets. Dertien mutaties met de hand geprobeerd, dertien raak.

   **Wat er NIET is, met de reden.** Wij ondertekenen het AuthnRequest niet: dat
   bewijst aan de provider dat het verzoek van ons komt en zegt niets over de
   veiligheid van het ANTWOORD, en dat is de kant waar de aanval zit. Providers
   die het eisen kunnen hier niet terecht. Ook geen versleutelde asserties
   (`EncryptedAssertion`) en geen Single Logout.
6. **Levenscyclus en uitgang** — gedaan. Export met catalogus en recept, een
   leesbaar overzicht ernaast, inlezen in een nieuwe werkruimte, vier standen,
   bewaringsplicht, vernietiging met bewijs.

   **En de uitgang is nu ook BEPROEFD, op knopdruk** (`kern/tenant/herstelproef.js`,
   `POST /api/tenant/herstelproef`). Een uitvoer die niemand ooit heeft
   teruggelezen is een belofte; dit maakt er een datum van. De proef exporteert,
   leest terug in een tijdelijke werkruimte — dezelfde functie die een
   vertrekkende klant gebruikt, geen aparte lus — legt de catalogus per soort
   naast de eerste, en ruimt die tijdelijke werkruimte daarna op. Altijd, ook
   als er onderweg iets stukloopt.

   **Wat het bewijst en wat niet, en dat onderscheid is de kern.** Wel: dat deze
   organisatie haar data terugkrijgt. Niet: dat de dagback-up van het *platform*
   terug te zetten is — een andere claim, met een ander faalpad, en het is de
   claim waar een SLA aan hangt. Die SLA-voorwaarde blijft daarom op nee staan,
   óók na een geslaagde proef, met een reden die allebei noemt. Ze door elkaar
   laten lopen zou de makkelijkste manier zijn om die voorwaarde op ja te
   krijgen zonder dat er iets is veranderd.

   Eén ding is hier fout gegaan en het staat in de code: de tijdelijke
   werkruimte kreeg eerst een merk `proef: true` **op** de werkruimte. Dat veld
   is gewone inhoud, dus het kwam in de uitvoer — en de vergelijking meldde
   trouw dat er een soort `proef` was bijgekomen. Een marker die in het gemeten
   object zit, meet zichzelf. Het register staat nu ernaast.
7. **Contract & quota** — gedaan. Drie pakketten, twee afgedwongen grenzen,
   een teller per tenant per uur die een herstart overleeft, en een verlopen
   contract dat niemand buitensluit. Niet afgedwongen en met naam genoemd:
   opslag, aantal leden, supportvenster en hersteltijd.
8. **Tenantstatus & bewijs** — gedaan, inclusief het scherm. De bewijspoort
   maakte van elke bewering een object met een bron of een reden; dat antwoord
   bestond en had geen scherm, en dan is het een JSON die niemand opent. Het
   staat nu onder **Instellingen** in het Werk OS (`apps/werk/status.js`), en
   het is met opzet het tegenovergestelde van een badgemuur: de beweringen die
   vandaag NIET waar zijn staan er ook, met hun reden, en de SLA staat er
   uitgerekend — vier voorwaarden, met de twee die ontbreken bij naam. Er staat
   geen beschikbaarheidscijfer op, maar de zin waarom niet.

   De deur is daarbij verruimd, met een reden: hij stond alleen achter het
   beheer-token, en dat token typt niemand in het Werk OS in. Een pagina die
   niemand kan openen is hetzelfde als een pagina die er niet is. De tweede
   sleutel is een lid met het recht `werkruimte` — in het rollenregister draagt
   alleen `directie` dat, en dat is per definitie wie de werkruimte beheert.

   **En de meting per capability is er sindsdien ook** (`server/meting-capaciteit.js`).
   Dat was het laatste open punt van deze laag, en het is opgelost door twee
   dingen aan elkaar te knopen die er allebei al waren: de meting telt per
   ROUTEPATROON, en de boardroom weet al welke functie bij welk pad hoort
   (`functies.functieVoorPad`, dezelfde kaart waarmee een eigenaar een functie
   uitzet). Er komt dus geen tweede telling en geen tweede catalogus bij.

   Wat dit WEL oplost: de reden dat er geen tenantcijfer stond, was dat een
   storing in een onderdeel dat een klant niet gebruikt als ZIJN storing zou
   verschijnen. Dat is nu te zien — per capability, met de drukste eerst.

   Wat het NIET oplost, en dat staat er ook zo: er is nog steeds geen meting per
   ORGANISATIE, en er komt dus nog steeds geen beschikbaarheidscijfer voor een
   klant op het scherm. De telling gaat per routepatroon en draagt geen tenant;
   dat veranderen betekent elke aanroep aan een organisatie knopen, en dat is
   precies het soort veld dat in een metrics-endpoint niet thuishoort.

   Twee dingen die hier hard zijn: **een percentage over te weinig verzoeken
   wordt niet gegeven** (onder de vloer staat er `null` met de reden — nul
   fouten op drie verzoeken leest groener dan elk echt cijfer), en **wat geen
   functie heeft verdwijnt niet** maar krijgt een eigen regel, want een totaal
   dat klopt terwijl er iets ontbreekt is de gevaarlijkste vorm. Het venster
   staat er ook bij: de meting zit in het geheugen van dit proces, dus dit is
   geen maandcijfer en mag zo niet gelezen worden.
9. **Command bar** — gedaan voor de VRAAGKANT. De balk in het Werk OS zocht
   niet: hij matchte een woord, opende een tab en zei erbij "Rechten en
   handelingen volgen uw rol" -- tekst zonder dekking, want er werd nergens een
   recht gelezen. Hij loopt nu over `/api/bedrijf/zoek`, dat het register per
   verzoek uit de rechten van het lid opbouwt: een soort waarvoor je het recht
   mist zit er niet in, wordt niet gefilterd maar bestaat niet. Hij meldt ook
   in hoeveel soorten er is gezocht in plaats van te doen alsof hij alles zag.

   De **handelkant** staat er ook, en precies zoals hij hoorde te staan: met de
   twee dingen die eerst ontbraken. De keten is

       bedoeling -> plan -> geraakte objecten -> rechtencontrole ->
       BEVESTIGING door een mens -> uitvoering -> actiebon

   en er wordt geen schakel overgeslagen. Vijf regels dragen hem:

   - **Plannen verandert niets.** De toets legt de hele werkruimte voor en na
     naast elkaar; er mag geen byte verschillen.
   - **Bevestigen doet de mens.** Een plan draagt een geheim dat één keer wordt
     getoond; zonder dat geheim voert niets uit. Dezelfde regel als in LIFE.md:
     samenstellen en klaarzetten mag een machine, bevestigen niet.
   - **Het recht wordt bij de UITVOERING opnieuw gerekend.** Anders overleeft
     een plan van tien uur een rol die om half elf werd ingetrokken -- en dan is
     tijdelijke toegang permanent.
   - **Een plan is van één persoon en voor één keer.**
   - **De zeef is een regel en geen model.** `CLAUDE.md` legt dat vast:
     controleerbare extractie gebruikt geen model. Wat de zeef niet begrijpt
     wordt geen plan; er komt een eerlijk "dit begrijp ik niet" in plaats van
     een gok die iemand bevestigt omdat er nu eenmaal een knop staat.

   De lijst werkwoorden is **gesloten** (`bedrijf/handeling-lijst.js`): er is
   geen algemene "voer maar uit". Elke regel is een werkwoord dat iemand met dat
   recht ook met de hand had mogen doen, en wie er een bijzet schrijft ook de
   uitvoering -- er is met opzet geen generieke weg die elke nieuwe regel meteen
   uitvoerbaar maakt.
10. **De gevolgsimulatie** — `bedrijf/gevolg.js`, `POST /api/bedrijf/gevolg`.
    Dit stond hier eerst als *niet gebouwd, en niet als ontbrekende laag maar
    als besluit*, met het argument dat `POST /api/bedrijf/dossier` de vraag al
    beantwoordt. **Dat argument klopte niet, en het verschil is precies wat
    deze laag bestaansrecht geeft.**

    Het dossier kijkt naar **binnen**: wat hoort bij dit object, wie verwijst
    ernaar, wat is de tijdlijn. Dit kijkt **vooruit**: wat breekt er als het
    weg is. Wie overweegt een medewerker uit dienst te zetten wil niet weten
    wie er naar hem verwijst — hij wil weten wat er níét af komt. De toets
    maakt dat hard met een taak van Hakim die wacht op een taak van Pia: die
    taak staat in geen enkel dossier van Pia, en valt wel stil.

    Drie wijzigingen, en de lijst is **gesloten**: `lid.uit-dienst`,
    `project.stop`, `werkruimte.sluiten`. Gesloten omdat er per wijziging
    iemand moet weten wat "af" betekent voor elke soort, en dat is niet uit de
    graaf af te leiden. Wat er niet in staat krijgt geen gok maar een 400 met
    de drie die er wel zijn.

    Het antwoord heeft twee lijsten en die zijn niet even veel waard. `raakt`
    is te maken uit de graaf; **`blijftOpen` is waar deze laag voor bestaat** —
    taken zonder eigenaar, taken van anderen die op dat werk wachten, tickets
    zonder behandelaar, kennisartikelen zonder eigenaar, besluiten die op een
    stem wachten die niet meer komt.

    Drie regels die niet mogen sneuvelen:

    - **Simuleren verandert niets.** Er staat geen `save()` in het bestand. De
      toets legt de hele werkruimte voor en na naast elkaar; er mag geen byte
      verschillen. Een simulatie met een bijwerking is de duurste soort bug,
      want juist deze knop drukt iemand in om te *kijken*.
    - **Hij volgt de rechten.** Wie `service` mist ziet de servicekant niet,
      wie `besluit` mist de besluitkant niet, wie `mens` mist ziet niet welke
      rollen vervallen. Niet weggefilterd achteraf — de tak draait niet.
    - **Wat niet gerekend wordt, staat er met naam en reden.** Vier dingen, en
      het zijn precies de vier die hierboven als reden stonden om deze laag
      niet te bouwen: kosten (er is geen kostprijs per werkruimte-object),
      contracten (de bibliotheek weet niet welk contract aan welk project
      hangt), controls (`CONTROLS.json` meet het platform en niet de objecten
      van een klant) en terugdraaien (er is geen rollback). Ze staan in
      `nietGerekend` in élk antwoord. Een simulatie die daarover zwijgt leest
      als een volledige impactanalyse, en dat is hij niet.

    Eén eerlijkheid in het antwoord zelf: een kennisartikel draagt alleen een
    eigenaars**naam** en geen id (`kennis.js` gebruikt `zetWie()` niet). Die rij
    draagt daarom `opNaam: true` — twee mensen die Pia heten leveren daar
    elkaars artikelen op, en dat staat er in plaats van dat het verzwegen
    wordt. Overal waar er wél een id is, wint de sleutel van de naam.

    Nagetrokken met vijf mutaties, alle vijf raak: de wachtende taken van
    anderen weglaten, het rechtenhek op de servicekant weghalen, een bijwerking
    in de simulatie zetten, de taken buiten een gestopt project niet meer
    tellen, en `nietGerekend` leegmaken.

## 9. De grenzen

Waar een functie hiermee botst, vervalt de functie.

- **Er komt geen vierde identiteitsmodel.** Wie een nieuwe vraag over "wie is
  dit" moet beantwoorden, gebruikt `org`, de werkruimtecode, het RTG-account of
  het werkruimtelid — en anders is de vraag verkeerd gesteld.
- **Geen vrije CSS of JavaScript per klant.** Alleen getypeerde velden en
  toegestane varianten. Vrije opmaak per tenant is een codefork die zich
  voordoet als een instelling, en hij groeit tot niemand meer kan zeggen wat een
  klant ziet.
- **Een klant kan zichzelf niet aan een tenant hangen.** Dezelfde reden waarom
  een zaak zich in `kern/webmerk.js` niet tot moederbedrijf van een andere zaak
  kan uitroepen.
- **Het woord "domein" hoort nergens als belofte te staan** zolang stap één van
  `TAKEN.md` 4.21 niet genomen is.
- **Een enterprisebewering op een scherm heeft een bron.** "Versleutelde
  werkruimte" mag pas staan als het sleutelmodel bewezen is, "audit gereed" pas
  bij verse bewijsdekking, "SLA beschermd" pas als die SLA geldt. Tot die
  koppeling bestaat, staat de bewering er niet — dat is waarom de oude
  enterprise-schil is weggehaald en niet aangesloten.
