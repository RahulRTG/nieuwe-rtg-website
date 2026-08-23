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
| Exit | een volledige export is aantoonbaar opnieuw in te lezen | **niet gebouwd** (5.56) |
| Contract | elke runtime-bevoegdheid is te herleiden tot een actief contract | **niet gebouwd** (5.56) |
| Quota | per tenant, en een herstart wist ze niet | **niet gebouwd**; de rem telt per IP |
| Levenscyclus | elke tenantstand met reden, actor en bewijs | **niet gebouwd** (5.56) |
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
6. **Levenscyclus** — open. Provisioning, export, legal hold, bewaring,
   vernietiging en een herstelproef.
7. **Contract & quota** — open. Abonnement, bevoegdheden, verbruik, support.
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
