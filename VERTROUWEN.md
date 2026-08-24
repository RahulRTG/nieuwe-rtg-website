# RTG Verified Trust Fabric — beveiliging als productervaring

*Het diepte-document van de veiligheidskant. `SECURITY.md` beschrijft hoe je een
kwetsbaarheid bij ons meldt; dit beschrijft waarom een geslaagde aanval hier
binnen aantoonbaar veilige grenzen blijft, en hoe een klant dat zelf kan zien.*

Opgesteld 24 augustus 2026, na de inventaris van wat er al stond.

---

## 1. De belofte, en waarom hij anders is dan "wij zijn veilig"

Elke leverancier zegt dat hij veilig is. Dat is geen bewering maar een
categorie: hij is niet te weerleggen, dus hij is ook niets waard. Wie hem toetst
komt uit bij een PDF met certificaten, en een certificaat zegt dat er ooit
iemand heeft gekeken.

De belofte hier is smaller en daardoor wel te toetsen:

> **RTG vertrouwt niet op het voorkomen van iedere aanval. RTG ontwerpt iedere
> handeling zodat zelfs een geslaagde aanval binnen aantoonbaar veilige grenzen
> blijft — en kan die grens laten zien.**

Het verschil zit in het woord *aantoonbaar*. "Een aanvaller kan hier weinig"
is een mening. "Dit account kan maximaal 183 records lezen, geen begunstigde
aanmaken, geen tweede goedkeuring produceren, en bij poging vier valt de
containment in — en hier is de graaf waaruit dat volgt" is een meting.

Dat maakt beveiliging voor het eerst iets wat een klant kan *zien*. Niet als
alarmpaneel, maar als eigenschap van het product. Vandaar de tweede zin, die
over de ervaring gaat:

> **Invisible when safe, unmistakable when important.**

Bij een normale handeling merkt niemand iets. Bij een handeling die veel raakt,
wordt RTG extreem precies. Een manager die twaalf personeelsrecords exporteert,
exporteert twaalf personeelsrecords. Diezelfde manager die er 18.400 exporteert
vanaf een nieuw apparaat, buiten werktijd, kort na een rechtenwijziging, krijgt
geen "toegang geweigerd" maar een zin die uitlegt welke drie dingen tegelijk
opvallen en wat er nu van hem wordt gevraagd.

## 2. De zes fabrics — zes vragen, en wat er vandaag van staat

De laag is geen product naast de bestaande beveiliging. De WAF, de virusscanner,
de CSP, de SSRF-afweer, de remmen en de rechten worden er de sensoren en
actuatoren van. Wat erbij komt is de vraagstelling: zes vragen die elk een
eigen antwoord moeten hebben, en die samen de belofte dragen.

### 2.1 Wie — Identity Fabric

*Wie ben je werkelijk?*

Staat: de identiteitskluis met codenamen (`server/accounts.js`, `server/kluis.js`),
WebAuthn (`server/webauthn/`), OIDC en SAML met een echte XSW-aanvalstoets
(`server/sso/saml/`), SCIM met synchrone deprovisioning (`server/scim/`).

Sinds laag 2 (`server/kern/vertrouwen/verificatie.js`) draagt een sessie ook
HOE en WANNEER: de manier (passkey, wachtwoord, sleutelwoorden, pincode, de
provider van de klant, of een sleutel zonder mens), het tijdstip, en of dit
apparaat al eerder bij dit account is gezien. Daarvan wordt alleen een hash
bewaard; de lijst is kort en verdwijnt met het account.

Ontbreekt nog: alleen de wachtwoordinlog schrijft het weg. De passkey-kant, de
provider-kant (SAML/OIDC) en de pincode doen dat nog niet, en daar levert
`lees()` dus null -- wat laag 3 als "niet vastgelegd" behandelt en niet als
"in orde".

### 2.2 Mag — Authority Fabric

*Wat mag je werkelijk?*

Staat: achttien rechten als werkwoorden en veertien rollen met een van/tot-venster
(`server/bedrijf/rollen-register.js`), de groep-naar-rolbrug vanuit de
identiteitsprovider (`server/kern/tenant/brug.js`), de reden-verplichte inzage
(`REDEN_NODIG`), het inzagejournaal (`server/inzagelog.js`).

Ontbreekt: **bevoegdheid wordt nergens formeel begrensd bij doorgifte.** Dat een
gedelegeerde nooit meer mag dan zijn delegator, dat een AI-agent nooit meer mag
dan wie hem stuurt, en dat een dienst die een andere dienst aanroept onderweg
geen recht kan winnen, is waar in de code maar nergens *afgedwongen als
eigenschap*. Zolang niets dat controleert, is een amplificatiepad een bug die
niemand ziet aankomen.

### 2.3 Raakt — Exposure Fabric

*Hoeveel raakt deze handeling werkelijk?*

Staat: de gevolgsimulatie (`server/bedrijf/gevolg.js`) beantwoordt precies deze
vraag voor drie veranderingen, schrijft niets, en noemt in `nietGerekend` bij
naam wat hij niet meerekent.

Ontbreekt: **de meter zit niet in het pad van de handeling zelf.** Hij is een
knop die je kunt indrukken, geen getal dat de handeling meedraagt. Zonder dat
getal is er geen step-up, geen Action Preview en geen bon.

### 2.4 Hoever — Containment Fabric

*Hoeveel schade kan één compromittering maximaal doen?*

Staat: de WAF en de DDoS-rem (`server/kern/schild.js`), de drie remmen
(`server/middleware/remmen.js`), de inbraakdetectie met automatische noodrem bij
aanhoudende brute force (`server/beveiliging.js`), de tenantgrens
(`server/kern/tenant/register.js`).

Ontbreekt: **de blast radius bestaat nergens als berekend ding.** Een beheerder
ziet rechten, geen bereik. "Wat kan een aanvaller met dit account maximaal
raken" is vandaag een vraag die een mens met de hand uitrekent, en dus niet
uitrekent.

### 2.5 Terug — Recovery Fabric

*Hoe keren we veilig terug?*

Staat: de uitgang met een beproefde herstelproef (`server/kern/tenant/uitgang.js`,
`herstelproef.js`), de back-upstand met een echte inspectie in plaats van een
mapnaam (`server/backupstand.js`), het failover-trio met een chaosproef
(`server/trio.js`, `scripts/chaos.js`), de levensloop met bewaartermijn en
vernietigingsbewijs (`levensloop.js`).

Ontbreekt: **er is geen weg terug per actor.** Herstel is vandaag iets voor een
werkruimte of het platform, niet voor "alles wat dit ene gecompromitteerde
account de afgelopen twee uur heeft aangeraakt".

### 2.6 Bewijs — Evidence Fabric

*Hoe bewijzen we dat het bovenstaande nú klopt?*

Staat: de bewijspoort, waar elke enterprisebewering een bron heeft of met de
reden ontbreekt (`server/kern/tenant/bewijs.js`, `bewijs-sla.js`), het
zekerheidsrapport dat expliciet opschrijft wat we níét weten
(`scripts/zekerheid.js`), het wettenregister met de sabotagemotor die elke
handhaver echt uitzet (`scripts/wetten.js`, `sabotage.js`), de mutatiemotor.

Dit is het sterkste dat dit huis heeft, en het is de reden dat de rest hierboven
te bouwen valt. Elke bewering van de Trust Fabric hangt hieraan.

Ontbreekt: **de bewijzen zijn niet per handeling.** De poort bewijst
eigenschappen van een tenant, niet van een besluit dat vanmiddag om 14:07 is
genomen.

## 3. De grenzen — dit is de belangrijkste paragraaf

Elke regel hieronder komt voort uit een fout die in dit huis werkelijk is
gemaakt, of uit een grens die elders in de doctrine al staat. Waar een functie
botst met een grens, vervalt de functie.

### 3.1 Geen bewering zonder bron. Ook niet de mooie.

De Trust HUD is de gevaarlijkste tegel van deze hele laag, want hij ziet er
overtuigend uit zonder iets te meten. Dit huis heeft dat al een keer gedaan:
`public/shared/enterprise-shell.js` beweerde "Enterprise beveiligd / audit
gereed / Commercial" zonder een bron die dat kon dragen, en is er in augustus
2026 uit gehaald.

Daarom: **elke regel op de HUD komt uit de bewijspoort, of hij staat er als
`nietGemeten` mét de reden.** Een lege waarde is verboden, want die leest als
"in orde". Dat geldt ook voor de simulator: een teller die zegt "42.815
aanvalspaden onderzocht" is een leugen zodra er niet 42.815 paden zijn
doorgerekend.

De HUD wordt daarom als **laatste** gebouwd. Wie hem eerst bouwt, bouwt de schil
van het ding dat we net hebben gesloopt.

### 3.2 Geen enkel cijfer. Geen securityscore.

"Security score: 98/100" is schijnzekerheid: het middelt een catastrofaal pad
weg tegen negentig kleine dingen die op orde zijn. In plaats daarvan een klein
aantal **absolute eigenschappen**, en die staan op nul of ze staan er niet:

```
onbekenden                          0
onbegrensde actoren                 0
omzeilbare kritieke poorten         0
verlopen kritieke bewijzen          0
catastrofale enkelvoudige paden     0
```

Een getal boven nul is geen slechtere score maar een openstaand punt met een
naam. Daaronder de details.

### 3.3 De autopilot mag insnoeren en nooit teruggeven.

Automatisch containment is veilig: sessies intrekken, een capability bevriezen,
een credential roteren, een actor isoleren. Dat maakt de wereld kleiner, en de
ergste fout is dan dat iemand onterecht buiten staat.

Automatisch **herstel** is dat niet. Een mutatie terugdraaien is een besluit met
gevolgen voor mensen en geld, en `GELD.md` par. 3 zet die grens al: geld verlaat
het huis nooit vanzelf. De autopilot bereidt herstel dus voor en zet het klaar;
een mens bevestigt. Dat is dezelfde regel als in `LIFE.md`: **samenstellen en
klaarzetten, bevestigen doet de mens.**

En de beveiligings-AI zit zelf in de veiligheidskern. Hij mag nooit:

- zichzelf meer rechten geven;
- bewijs verwijderen of wijzigen;
- beleid herschrijven;
- kritiek herstel definitief uitvoeren zonder de vereiste bevoegdheid.

*Zelfs RTG Security AI vertrouwt zichzelf niet.*

### 3.4 Simuleren verandert niets.

De compromitteringssimulator draait tegen het model en nooit tegen productie, en
schrijft niets — dezelfde regel als `gevolg.js` regel 1. Een simulatie met een
bijwerking is de duurste soort bug, want juist die knop drukt iemand in om te
kíjken.

### 3.5 Een lokmiddel is nooit een mens.

Canary-credentials, honeypot-endpoints en fictieve secrets zijn goed: ze bestaan
alleen om aangeraakt te worden, en een normale gebruiker komt er nooit langs.

**Fictieve persoonsrecords zijn dat niet.** Een verzonnen medewerker in een huis
dat echte personeelsdossiers bewaart, komt vroeg of laat mee in een export, in
een telling, in een tenantuitvoer of in de context van de AI — en dan liegt een
gegeven over mensen. Lokmiddelen mogen daarom alleen bestaan in vormen die geen
persoonsgegeven kunnen worden.

### 3.6 De blast radius is wat het model weet, niet wat de aanvaller kan.

Dit is de eerlijkheidsgrens van de hele laag, en hij hoort in het antwoord zelf
te staan. Een berekend bereik zegt: *langs de paden die wij hebben gemodelleerd,
komt deze actor tot hier.* Het zegt niet dat er geen ander pad is. Een
onbekende kwetsbaarheid staat in geen enkele graaf.

Daarom draagt elk simulatie-antwoord een `nietGemodelleerd`-lijst, net zoals
`gevolg.js` een `nietGerekend` draagt. Een simulator die zwijgt over zijn
blinde vlek leest als een garantie.

### 3.7 Step-up is een uitzondering, of hij is niets.

Vraagt het systeem overal een tweede bevestiging, dan leest niemand hem meer en
is de klik een reflex geworden — dan hebben we de veiligheid verlaagd en de
bediening verzwaard. De drempel meet daarom tegen het **eigen normale bereik**
van deze actor, niet tegen een absoluut getal, en elke step-up moet in één zin
uit te leggen zijn. Kan hij dat niet, dan is het geen step-up maar ruis.

### 3.8 Bevoegdheid groeit nooit.

```
gedelegeerde     ⊆  delegator
AI-agent         ⊆  wie hem stuurt
benedenstrooms   ⊆  waar het verzoek begon
```

En in een samengestelde werkstroom mag bevoegdheid nooit groeien doordat twee
diensten elkaar vertrouwen. Ontdekt de graaf een amplificatiepad, dan is dat
geen waarschuwing maar een blokkade.

### 3.9 Beveiliging mag het systeem niet traag maken.

Enterprise-premium betekent ook dat de controle niet te voelen is. Elke control
krijgt een latencybudget, en 99% van de verzoeken loopt over het snelle pad.
Alleen een gevaarlijk verzoek betaalt de dure inspectie. Een control zonder
budget is een control die ooit een storing wordt.

## 4. De vijf ervaringen

Deze vijf zijn wat een klant merkt. Ze hangen alle vijf aan paragraaf 2 en 3, en
geen van vijve mag iets tonen dat daar niet uit komt.

1. **Trust HUD.** Een rustige truststatus per kritieke omgeving. Geen
   alarmpaneel: een handvol eigenschappen, elk met een klik naar het waarom.
2. **Action Preview.** Voor een zware handeling geen "weet je het zeker?" maar
   de werkelijke impact: hoeveel het raakt, wat er van afhangt, en of het terug
   te draaien is.
3. **Waarom?** Elke blokkade, goedkeuring en AI-beslissing is met één klik uit
   te leggen in concrete termen. Nooit "policy violation".
4. **Time Machine.** Per actor, tenant of capability: hoe zag de toestand er
   vóór deze handeling uit, en wat is er sindsdien gebeurd.
5. **Trust Receipt.** Een compacte bon per kritieke handeling: waarom dit mocht,
   welke keten van bevoegdheid eronder ligt, en waar het bewijs staat.

## 5. Wat er NIET komt

- **Geen securityscore.** Zie 3.2.
- **Geen automatisch herstel.** Zie 3.3.
- **Geen fictieve mensen.** Zie 3.5.
- **Geen aanvalssimulatie tegen productie.** Zie 3.4.
- **Geen kernel-antivirus op het apparaat van een bezoeker.** Dat staat al zo in
  `server/kern/antivirus/index.js`: dit is de afweer voor het platform, niet
  voor de computer van een lid, en dat verschil blijft opgeschreven.
- **Geen jaarlijkse pentest als bewijs.** Een rapport van elf maanden oud
  beschrijft software die niet meer draait.
- **Geen post-quantum-marketing.** Wel crypto-agility: een algoritme-aanduiding
  bij elk cryptografisch artefact, sleutelversies, een rotatiepad en een
  inventaris van waar cryptografie wordt gebruikt. Dan is overstappen later een
  migratie in plaats van een herschrijving.

## 6. De bouwvolgorde, en waarom deze

De volgorde is geen prioriteitenlijst maar een afhankelijkheidsketen. Elke laag
levert het gegeven waar de volgende op staat.

| # | Laag | Levert | Nodig voor |
|---|---|---|---|
| 1 | **Blootstelling** — elke handeling draagt een gemeten bereik | een getal per handeling | 2, 3, 4 |
| 2 | **Verificatiesterkte** — de sessie weet hoe hard en hoe vers | sterkte + ouderdom | 3 |
| 3 | **Step-up met een reden** — invisible when safe | het onderbouwde tweede moment | 5 |
| 4 | **Bevoegdheid groeit nooit** — de insluiting afgedwongen | geen amplificatie | 6 |
| 5 | **Trust Receipt** — de bon met de bevoegdheidsketen | bewijs per handeling | 7 |
| 6 | **Blast radius** — bereik per actor, berekend | de graaf | 7 |
| 7 | **Simuleer compromittering** — het wauw-moment | het antwoord op "en als" | 8 |
| 8 | **Trust HUD / Trust State** — uitsluitend uit de bewijspoort | wat de klant ziet | — |

**Stand op 24 augustus 2026.** Laag 1, 2 en 3 staan en zijn aangesloten: de
tenantuitvoer draagt haar eigen omvang en het step-up-oordeel, en de
wachtwoordinlog legt de verificatiesterkte vast. Wat daar nog niet gebeurt is
het *afdwingen*: laag 3 velt het oordeel en niemand houdt op grond daarvan iets
tegen, omdat er nog geen tweede moment bestaat om naar door te verwijzen. Dat
is een keuze en geen vergetelheid -- een drempel zonder tweede moment is alleen
een dichte deur met een getal erbij -- maar zolang het zo is, moet niemand
beweren dat dit huis step-up HEEFT. Het meet hem.

Daarnaast, los van de keten en klein genoeg om tussendoor te doen:

- de virusscanner die zijn eigen versheid bewijst (clamd wordt vandaag nooit
  naar zijn definitiedatum gevraagd — een scanner met oude definities meldt
  "schoon" precies zoals een verse);
- `cargo audit` op de crates van de Rust-motor (het enige stuk van de
  toeleveringsketen dat nu ongecontroleerd is; de Node-kant heeft nul
  runtime-dependencies en de Actions staan op een volledige SHA);
HIER STOND "een rem per account naast die per IP", en die klopte niet. Dit huis
heeft er al drie: IP+account (10 pogingen), de bron alleen (50) en het doel
alleen (25). En de derde is scherper doordacht dan wat hier stond: het doel
krijgt geen slot maar een VERTRAGING van twee seconden per mislukte poging,
want een slot op een account geeft een vreemde de macht om de eigenaar buiten
te houden -- vijfentwintig gokken verbranden en de rechtmatige eigenaar krijgt
een 429 op het juiste wachtwoord. Dat is gemeten toen die emmer nog een slot
was (`server/routes/auth/inlog.js`). Wie hier iets aan verandert, leest die
uitleg eerst.

## 7. Het moment waar dit allemaal voor is

Een CIO zit tegenover je en zegt: *"Oké. Stel mijn CFO wordt vannacht gehackt."*

Je klikt op **Simuleer compromittering**. En het antwoord is geen geruststelling
maar een uitslag, met de blinde vlek er eerlijk bij:

```
De aanvaller krijgt toegang tot één huidige sessie.
Kan 183 financiële records lezen.
Kan maximaal EUR 500 aan bestaande transacties terugboeken.
Kan geen nieuwe begunstigde aanmaken.
Kan geen tweede goedkeuring produceren.
Kan geen export boven 500 records uitvoeren.
Kan geen rechten wijzigen.
Bij poging vier treedt automatische containment in.
Alle geïnitieerde mutaties zijn herstelbaar.
Catastrofaal pad: geen gevonden langs de gemodelleerde routes.

Niet gemodelleerd: onbekende kwetsbaarheden, fysieke toegang,
de leverancier van de leverancier.
```

En daaronder: **toon het bewijs.** De graaf, de toetsen, het beleid, de laatste
simulatie en de actuele bewijsstand.

Dat is het punt waarop beveiliging ophoudt een checklist te zijn en een
producteigenschap wordt.
