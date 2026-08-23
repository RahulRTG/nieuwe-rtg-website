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
| Claims | 0 enterprisebeweringen zonder bron | gemeten voor de bootstrap; **niet** voor losse schermteksten |
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
3. **Merkkern** — gedaan voor de definitie en het Werk OS; Theater en Webmerk
   lezen nog uit hun eigen kopie (4.55).
4. **Tenant Bootstrap** — gedaan, ondertekening open (4.56).
5. **Identiteitsbrug** — gedaan voor OIDC-groepen en SCIM-deactivatie. SAML en
   SCIM `/Groups` staan open (4.54).
6. **Levenscyclus en uitgang** — gedaan. Export met catalogus en recept,
   inlezen in een nieuwe werkruimte, vier standen, bewaringsplicht, vernietiging
   met bewijs. Wat hier NIET onder valt en apart moet: de bijlagen en media van
   een werkruimte (die wonen buiten `db.data.werkruimtes`), en een uitvoer in een
   leesbaar formaat naast de machineleesbare -- beide open in `TAKEN.md` 5.56.
7. **Contract & quota** — gedaan. Drie pakketten, twee afgedwongen grenzen,
   een teller per tenant per uur die een herstart overleeft, en een verlopen
   contract dat niemand buitensluit. Niet afgedwongen en met naam genoemd:
   opslag, aantal leden, supportvenster en hersteltijd.
8. **Tenantstatus & bewijs** — open. En de harde volgorde: een SLA mag pas
   zichtbaar worden als contract, meting, incidentproces én herstelbewijs
   bestaan. `SLO.md` zegt vandaag met zoveel woorden dat er geen SLA is.
9. **Command bar en AI** — open. Het werkcommand-register (15 soorten) draagt
   het al; de AI hoort door dezelfde 18 rechten te lopen als de mens, niet langs
   een tweede rechtenmodel.
10. **Digital twin en extension fabric** — open.

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
