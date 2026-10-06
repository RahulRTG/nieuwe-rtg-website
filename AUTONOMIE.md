# RTG Autonomy Kernel

*Richtingsdocument. Per onderdeel staat er of het **staat**, **een stap weg** is,
**een besluit vraagt** of **jaren weg** is, dezelfde vorm als `PLATFORM.md`,
`ECONOMIE.md`, `INTELLIGENTIE.md` en `EXECUTIE.md`, zodat niemand die vier voor
elkaar aanziet.*

Geschreven op 25 september 2026, na de meting en niet ervoor. Elk getal hieronder
tussen merktekens komt uit `BEDRIJFSMAAT.json` en wordt door `npm run getallen`
bijgehouden; een getal zonder merkteken draagt zijn bron in de zin.

---

## 0. De lat

Niet *"AI runt RTG"*, maar:

> **RTG bestuurt zichzelf binnen een door mensen vastgestelde constitutie.**

De machine krijgt **initiatief, maar niet vanzelf gezag**. Hij hoeft niet op een
opdracht te wachten: hij neemt waar, ontdekt, onderzoekt, rekent, simuleert en
zet klaar. De mens bestuurt met grenzen en beslismomenten. De keten is die van
`INTELLIGENTIE.md` par. 0, hier toegepast op RTG als ONDERNEMING in plaats van op
een lid of een zaak:

```
gebeurtenissen -> waarnemen -> afwijking of kans -> onderzoeken -> hypothesen
  -> rekenen -> scenario's -> plan -> beleidscontrole -> mandaat
  -> tonen / klaarzetten / uitvoeren -> nameting -> menselijk goedgekeurd leren
```

Drie zinnen die het ontwerp dragen:

- **Een waarnemend brein is niet een portemonnee** (besluit C1).
- **Lenzen, geen breinen.** Finance, Growth, Product en de rest zijn verklaarde
  vragen over DEZELFDE werkelijkheid, zonder eigen opslag. Dertien breinen met
  elk een eigen module worden binnen een jaar dertien versies van RTG; dat is de
  `VERMOGENS`-botsing die `CAPABILITEIT.json` al 21 keer telt.
- **Autonome actie alleen als geen enkele dimensie van de streefstand buiten
  haar tolerantie verslechtert.** Een handeling die dimensies tegen elkaar
  uitruilt, gaat altijd naar een mens, met de uitruil zichtbaar. Er komt geen
  gewogen som (INT-04).

---

## 1. Wat gemeten is

De vraag *welke cijfers over RTG als onderneming bestaan* is eerst gemeten en
niet aangenomen: `npm run bedrijfsmaat` (`BEDRIJFSMAAT.json`, de catalogus in
`server/kern/bedrijfsmaat/`). Een maat BESTAAT pas als vier elementen
aantoonbaar zijn, elk als citaat dat letterlijk in de code moet staan (bij
gedrag zonder commentaar mee te lezen):

| element | vraag | gat als het ontbreekt |
|---|---|---|
| bron | wordt de werkelijkheid ergens geregistreerd? | `BRON_ONTBREEKT` |
| definitie | heeft RTG vastgelegd wat de maat betekent? | `DEFINITIE_ONTBREEKT` |
| projectie | is er code die hem uitrekent? | `PROJECTIE_ONTBREEKT` |
| bewijs | kan de uitkomst herkomst, graad of peilmoment tonen? | `BEWIJS_ONTBREEKT` |

De stand: <!--getal:bedrijfsmaat.maten-->67<!--/getal--> maten over de 28 domeinen van de eigenaar.
<!--getal:bedrijfsmaat.bestaat-->59<!--/getal--> bestaan, <!--getal:bedrijfsmaat.half-->5<!--/getal--> half en <!--getal:bedrijfsmaat.ontbreekt-->3<!--/getal--> ontbreken.
Van de bestaande zien er <!--getal:bedrijfsmaat.gedeeltelijk-->19<!--/getal--> een deel van de werkelijkheid niet
(`gedeeltelijk`, met de reden). <!--getal:bedrijfsmaat.ketensGegrond-->6<!--/getal--> van de zes ketens is gegrond, en er staan
<!--getal:bedrijfsmaat.privacyGaten-->0<!--/getal--> projecties over mensen zonder afgedwongen groepsgrens.

De eerste meting (commit `2820af35`) stond op 61 maten, 22 bestaand en 9
privacygaten. Het verschil is werk van dezelfde dag en staat hieronder.

**Een citaat dat niet klopt laat de controle zakken.** Dat verdiende zich direct
terug: de eerste catalogus citeerde een commentaarkop als projectie, een
`"stempel"` in een register dat geen stempel heeft, en zeven keer
`module.exports` -- wat alleen bewijst dat een bestand bestaat. Die laatste is
nu een vormregel.

---

## 2. De besluiten van 25 september 2026

### 2.1 De constitutie

- **C1, een waarnemende laag.** RTG en de RTFoundation mogen door dezelfde laag
  worden waargenomen; elke waarneming en elk voorstel houdt zijn economische
  wereld; `kern/economie/firewall.js` wordt niet omzeild of versoepeld;
  RTF-informatie leidt buiten haar wereld hoogstens tot een constatering of een
  voorstel. Afgedwongen: elke maat draagt precies een wereld uit
  `kern/economie/werelden.js`.
- **C2, het kantoor alleen op tonen.** `office` is een AI-rol op de bestaande
  trede `lezen`, met paden die gemeten niets schrijven en totalen tonen
  (`command/puls`, `economie/werelden`, `kosten/periode`, en sinds 27 september
  `office/bedrijfsmaat`, nadat de idempotentieproef hem als beschermd en zonder
  effect in de opslag mat). De ingang `/api/office/doe` eist een mens op naam,
  en er is met opzet geen `/doe/bevestig`.

Beide staan als gegevens in `server/kern/bedrijfsmaat/besluiten.js` en reizen mee
in het register. De formulering is door Claude opgeschreven en nog niet door een
mens nagelezen.

### 2.2 De definities

Uit uitgeschreven opties gekozen, en vastgelegd met een versie in
`server/kern/bedrijfsmaat/definities.js`:

| begrip | definitie |
|---|---|
| nieuw lid | de eerste pas boven gast |
| cohort | de ISO-week van nieuw lid |
| activatie | een geslaagde uitkomst binnen 30 dagen, in welke wereld ook |
| omzet | gefactureerd EN ontvangen, naast elkaar, zonder btw |
| churn | pas naar gast of contract GEEINDIGD, in de maand van ingang |
| afwaardering | een stap naar een lagere betaalde pas; geen churn |
| retentie | als waarde (een uitkomst) EN als aanwezigheid (een bezoekdag) |
| brutomarge | ontvangen omzet min de GEMETEN kostensoorten |

Twee drempels zijn een voorstel van Claude en nog niet bevestigd: het venster
van retentie als waarde (dag 30 tot 60) en de drempel van 30 dagen bij
aanwezigheid.

### 2.3 Privacy in de meter zelf

De groepspoort (`server/kern/bedrijfsmaat/poort.js`) staat aan de BRON van een
maat en niet in een scherm, want anders krijgt alles ervoor -- een model, een
lens, een export -- het precieze getal nog wel:

- onder de grens (leden, personeel en gezinnen 10, zaken 5) komt er
  `TE_KLEINE_GROEP` met de grens en de reden, en **geen waarde, geen nul en ook
  niet het aantal**;
- zonder groepsgrootte komt er niets (`GROEP_ONBEKEND`);
- bij een telling per categorie: vaste namen (pas, geslacht) houden hun naam met
  secundaire onderdrukking, want een enkele verborgen groep is terug te rekenen
  uit het totaal; namen die iets verraden (land, stad, werkgever) gaan samen op
  in "Overige".

Op besluit van de eigenaar geldt dat **ook op het kantoorscherm** (het
ledenregister, gebruikers per economische wereld, het transactievolume over
zaken). Werklijsten per persoon of per zaak -- kosten per drager, omzet per zaak
-- blijven voor een mens op naam, want dat zijn lijsten voor een handeling en geen
tellingen; ze komen niet op het kantoorstuur, en `test/stuur-kantoor.test.js`
houdt dat vast.

### 2.4 Twee nieuwe bronnen

- **De pasgeschiedenis** (`kern/pasgeschiedenis.js`): de accountlaag meldt elke
  overgang (`createUser`, `setTier`) aan een luisteraar; codenaam, van, naar en
  moment, zeven jaar bewaard.
- **De laatste bezoekdag** (`kern/aanwezigheid.js`): een dag per lid, aangeraakt
  naast de ledengids, dertien maanden bewaard.

### 2.5 De besluiten van 27 september 2026

Genomen door de eigenaar uit meerkeuzevragen; de opties en wat ze kosten stonden
erbij. Nog niet gebouwd, behalve waar het staat.

- **C3, klantwaarde per wereld: een uitkomst per wereld, vier maten naast
  elkaar en geen totaal.** LivingOS: een rit of bestelling afgerond. TravelOS:
  een reis die THUIS is -- een nieuwe stand in de reisketen, gezet door het
  kantoor of het lid, want vandaag stopt een reisaanvraag bij bevestigd.
  WorkOS: een loonrun die definitief is. FoundationOS: een casus afgerond --
  die krijgt daarvoor een tijdstip (`afgerondOp`), want vandaag staat dat alleen
  in het auditspoor.
- **C4, het banksaldo van RTG uit meer dan een bron.** Eerst handmatig, met het
  afschrift als herkomst en de graad `vermoed` (het patroon van de huisrekening
  in `kern/kosten`). Een bankkoppeling later, als eigen besluit met een contract.
  En **RTG gaat eigen cadeaubonnen verkopen**: geld van een verkochte bon staat
  op de bank maar is nog niet verdiend, dus telt het als cash EN als verplichting,
  zodat runway het niet als vrij geld leest. Let op wat dat raakt: een bon die
  tegen de nominale waarde inwisselbaar is, valt onder de e-geldvraag van
  `TOKEN.md` en de regels van `WAARDE.md` -- de bon zelf is dus een eigen
  bouwstuk met die vraag erbij, en tot hij bestaat staat zijn plek in het
  banksaldo op nul met die reden. De bonnen die ZAKEN vandaag verkopen blijven
  van die zaak; de firewall laat ze niet als RTG-geld tellen.
- **C5, van een betaalde pas naar gast langs drie wegen.** Het lid zelf, en hij
  kiest nu of aan het eind van zijn periode; het kantoor met de hand; en
  automatisch met drie regels (afgelopen, afgelopen plus wachttijd, onbetaalde
  termijnen), elk een schakelaar die standaard uit staat. Wat Claude daaronder
  legt en nog door de eigenaar moet worden bevestigd: een lid zonder vastgelegd
  contract (`GEEN_CONTRACT`) gaat nooit automatisch, bij `afgelopen` en `wacht`
  samen wint de zachtste, en facturen en bewijsstukken blijven na de overgang
  (`AFSPRAAK.md`: rechten hangen per capability, niet per account).
- **C6, het herkomstkanaal: een vraag bij aanmelding EN een campagnecode in de
  link.** De vraag komt na de registratie, op het welkomstscherm. Allebei optioneel, alleen geteld langs de groepspoort, nooit per lid
  zichtbaar, dertien maanden bewaard en weg bij vergetelheid.
- **C7, de streefstand: de machine stelt voor, de eigenaar tekent.** Een
  voorstel per dimensie met een tolerantie, uit de afgesloten maanden; het geldt
  pas na een handtekening, en zonder getekende streefstand gebeurt er niets
  autonoom (leeg is dicht).
- **C8, de vaste kosten van RTG worden ingevoerd door het Financiën-kantoor, in
  zijn eigen kamer.** Per maand de vaste lasten, de marketinguitgaven per kanaal
  en de korte verplichtingen, elk met een bron en op naam. Personeel is een
  totaal en nooit per medewerker; stroom en serverhuur blijven in de huisrekening
  van de kostenlaag en worden daar gelezen.
- **C9, de runway netto en bruto naast elkaar.** Het vrije banksaldo gedeeld door
  het verbruik over drie afgesloten maanden, een keer met en een keer zonder de
  ontvangen omzet. Geen netto verbruik geeft geen getal, en geen oneindig getal.
- **C10, liquiditeit telt alleen eigen schulden.** Het tegoed dat leden bij RTG
  hebben staat er los naast en wordt niet afgetrokken.
- **C11, CAC per kanaal**, met dezelfde kanalen als de herkomstvraag en langs de
  groepspoort; 'via iemand die ik ken' heeft geen uitgave.

### 2.6 De besluiten van 28 september 2026

Drie keuzes van de eigenaar, weer als meerkeuze gesteld, en alle drie gebouwd.

- **C12, een campagne is een code onder een kanaal.** Een benoemde linkcode (`?c=`)
  met een begin en een einde, onder precies een aanmeldkanaal
  (`kern/rtgcampagne.js`). Een geregistreerde code telt voortaan onder HAAR kanaal,
  een onbekende blijft onder `campagne` vallen. Financien boekt per campagne wat
  die kostte, als deel van de kanaalpost in het boek van RTG: kosten de campagnes
  samen meer dan het kanaal, dan is dat een tegenspraak en rekent de maat voor dat
  kanaal geen getal per campagne. Het effect is het aantal nieuwe leden met de code,
  langs de groepspoort; geen klikken en geen attributiemodel, dus een ondergrens.
- **C13, het beslisgeheugen: besluit plus uitkomst** (`kern/beslisgeheugen.js`).
  Per besluit wie, wanneer, de bedrijfsmaten waarop het iets verwacht met hun stand,
  waarde en graad VAN DAT MOMENT, en de verwachte richting; na een termijn van 30
  tot 366 dagen per maat wat hij werkelijk deed. Nooit een cijfer voor het hele
  besluit, geen oordeel waar toen of nu geen getal stond, intrekken met een reden
  (het besluit blijft staan), zeven jaar bewaard. De machine stelt er niets uit
  voor. Het is met opzet NIET het besluitgeheugen van het Werk OS
  (`server/bedrijf/geheugen.js`): dat hoort bij de werkruimte van een zaak, en de
  bedrijfsmaten van RTG staan achter de boardroom. De drie regels van dat geheugen
  zijn wel overgenomen.
- **C14, de cadeaubon van RTG, ook te besteden bij zaken.** Dat is elektronisch
  geld, en het staat daarom als POSITIE en niet als instelling: een schakelaar in de
  boardroom (`kern/cadeaubon.js`, met een verse passkey zoals de terugstortstand),
  standaard dicht, en het vermogen `RTG_CADEAUBON` in
  `kern/bevoegdheid/lijst-afhankelijk.js` met twee gezichten. Dicht: de handeling
  bestaat niet. Open: een rail over de EIGEN rails met de eis
  `elektronischgeldinstelling` en met opzet geen partnerrail. RTG heeft die
  vergunning niet, dus ook open weigert de uitgifte nog -- met de reden. De
  verplichting van verkochte bonnen komt uit het register van de bon en wordt door
  de bankpositie gelezen. Verkopen, inwisselen en afrekenen met een zaak zijn NIET
  gebouwd: een uitgifte die in geen enkele stand mag draaien, is een half aangezette
  geldlaag.

Het beslisgeheugen en de cadeaubon hebben sinds 29 september een scherm: de tab
**Besluiten** in de boardroom (`public/apps/boardroom-besluiten.js`). Een besluit
vastleggen en intrekken gaat op naam, de cadeaubon omzetten vraagt de passkey, en
het scherm zegt bij open meteen dat de uitgifte nog steeds niet mag.

### 2.7 Het besluit van 29 september 2026

- **C15, de marge per lid: per pas, over alle leden.** Per pas de afgesproken
  maandbijdrage (lijstprijs maal aantal, of de som van de lopende contracten) min
  wat de leden van die pas het huis die maand kostten, gedeeld door ALLE leden van
  die pas -- ook wie niets gebruikte, want die draagt bij en kost niets
  (`kern/bedrijfsmaat/stand-marge.js`). Per pas en niet per cohort, omdat de pas met
  elke meting meereist en de kostenlaag dan geen identiteit hoeft op te zoeken.
  Onder tien leden geen getal, met secundaire onderdrukking. Geen getal ook voor een
  eerdere maand (de bijdrage per pas is een stand van vandaag), bij verbruik zonder
  tarief, en voor een contractuele pas waar een lid geen lopend contract heeft. De
  graad is `vermoed`: stroom en serverhuur zijn met een sleutel verdeeld. Daarmee is
  de kostenketen gegrond, en zijn het alle zes.

Dezelfde dag, zonder nieuw besluit, vijf maten van half naar bestaand. Vier misten
alleen hun bewijs: het ledenregister (`groei.leden-per-pas`,
`acquisitie.via-werkgever`) draagt nu een graad, een peilmoment en of het afkapte
-- het leest hooguit 20000 rijen, en een telling die afkapte zonder het te zeggen
lijkt compleet (de marge per lid krijgt dan geen noemer); de RTF-campagnes
(`campagnes.rtf-werving`) zijn `vermoed`, want een ronde is een bedrag dat het
bestuur boekte en geen regel van de bank; de stedenboom (`geo.rtf-steden`) is
`gemeten`. De vijfde, `risico.betalingen-onbekend`, miste zijn projectie terwijl
de telling al bestond: `openstaand()` in `kern/betaalwaarheid/hervat.js`, die de
veegronde ook leest. Hij is aangesloten en niet opnieuw bedacht
(`kern/bedrijfsmaat/stand-risico.js`).

Daarna nog vier besluiten van dezelfde dag, als meerkeuze gesteld en alle vier
gebouwd (`kern/bedrijfsmaat/stand-groei.js`, `definities-later.js`):

- **C16, land en stad.** Het land komt uit het account, de stad uit de woonplaats
  in de intake; allebei opgegeven en niet gecontroleerd (graad `vermoed`), en
  kleine plaatsen gaan samen onder Overige.
- **C17, zaken per genre.** Een zaak telt als zij toegelaten is (niet geschorst of
  beeindigd) en in de maand minstens een verzoek door haar eigen deur deed -- de
  kostenmeter telt dat al per drager. Aanmelden is geen gebruik.
- **C18, contract verlengd.** Verlengd is een contract dat na zijn einddatum
  doorloopt; de maat is het aandeel verlengd van de contracten die in de maand op
  hun beslismoment kwamen (verlengd plus geeindigd), uit het verloop dat de
  contractmotor al bijhoudt.
- **C19, transactievolume.** Wat zaken via RTG Pay ontvingen, zonder btw: de
  subtotalen van de facturen met betaalwijze `rtg`. Elke betaling via RTG Pay
  schrijft zo'n factuur met het bedrag zonder btw en de btw apart, dus er hoeft
  niets te worden geschat. Geld van de zaken, nooit omzet van RTG; een
  terugbetaling staat niet als creditnota in het register en gaat er dus niet af.

### 2.8 De besluiten van 30 september 2026

Vier besluiten over de maten die nog een keuze vroegen; de eerste drie staan in
`server/kern/bedrijfsmaat/stand-toelating.js`, met hun definities in
`definities-later.js`.

- **C20, toelating van zaken.** Per stand (in behandeling, geaccepteerd,
  klaargezet, afgewezen) het aantal aanmeldingen met een bedrijf, plus de mediane
  doorlooptijd van aanvraag tot besluit over de besluiten van de maand. Onder vijf
  zaken geen getal, ook niet voor de doorlooptijd. Een klaargezette zaak is een
  eigen stand: geaccepteerd is nog geen zaak.
- **C21, churn via contracten.** Het aandeel van de contracten die aan het begin
  van de maand liepen en in de maand GEEINDIGD bereikten. Geteld per contract en
  niet per lid: een contract hangt aan een aanmelding, en de koppeling naar een
  codenaam is met opzet niet gelegd. Een contract dat in de maand begon en eindigde
  telt niet, want het stond niet in de noemer.
- **C22, de btw van RTG zelf.** Een voorbereiding per kwartaal: de
  lidmaatschapstermijnen die in het kwartaal vervielen (factuurstelsel), zonder
  btw, maal het standaardtarief. Klasse `advies` (`btw.rtg` in
  `kern/fiscaal/zekerheid.js`), graad `vermoed`, en indienen blijft `voorbehouden`.
  Twee dingen zitten er niet in en staan erbij: de verbruiksfacturen per lid (die
  staan versleuteld in de kluis) en het oordeel of het deel voor de RTFoundation
  onder de vergoeding valt.
- **C23, het eigen kantoor blijft ongeteld.** Medewerkers op naam, werkdruk en open
  zaken per team krijgen geen projectie: met een klein kantoor is elk getal een
  getal over een mens. Ze gaan pas open met een groter team en een dienstverband
  bij RTG zelf; `test/bedrijfsmaattoelating.test.js` houdt vast dat ze open staan
  en de reden dragen.

### 2.9 De mensgronden (6 oktober 2026)

De vraag gaat omgekeerd: niet *mag de machine dit?* maar **waarom staat hier een
mens?** Kan de machine iets veilig, bevoegd, controleerbaar en herstelbaar zelf,
dan hoort het in beginsel geen mensenwerk te zijn. Het antwoord mag niet elke keer
opnieuw ter discussie staan, en daarom is het een GESLOTEN lijst
(`scripts/lib/mensgrond.js`): fysieke aanwezigheid, oordeel, toestemming, relatie,
wettelijke bevoegdheid, tweede persoon, geld, onomkeerbaar en terugweg onbewezen.

Twee invarianten, en ze spiegelen elkaar:

- **menselijk werk zonder geldige grond = automatiseringsschuld;**
- **automatisering over een geldige grond heen = overtreding.**

Vier dingen die het ontwerp dragen en niet mogen sneuvelen:

- **Een grond is geen trede.** De treden blijven `geen / tonen / klaarzetten /
  uitvoeren`; een grond zegt WAAROM er een mens staat en niet hoe hoog. `BLOCKED`
  (wachten op een ander) is geen grond maar een toestand, en die heet in de
  controlplane `ONBEKEND` of `UITSTELLEN`.
- **Blijvend en tot-bewijs worden nooit opgeteld.** Geld blijft geld; een
  ontbrekende terugweg verdwijnt zodra hij bewezen is. Alleen die tweede soort is de
  weg naar minder handwerk -- de eerste is vaak het product zelf.
- **CAN_VERIFY en CAN_RECOVER zijn poorten en geen stemmen.** Het gevolg moet
  gemeten zijn en de terugweg bewezen; drie van vier groen laat de machine niet gaan.
- **Er is geen Human Dependency Ratio.** Wie een percentage mensenwerk omlaag duwt,
  duwt ook toestemming, een relatie en een oordeel weg. Er wordt geteld per grond en
  per uitkomst.

De meter (`npm run mensgrond`, `MENSGROND.json`) verzint geen tweede classificatie:
hij vertaalt de effecten (`kern/isolatie/effecten.js`), de bodem
(`kern/frictie/bodem.js`), `NOOIT_AUTONOOM` en de deur van de eigenaar naar een woord
uit de lijst, en legt de herstelregisters ernaast. De eerste meting over
<!--getal:mensgrond.muterend-->4028<!--/getal--> muterende handelingen:

- **<!--getal:mensgrond.overtreding-->6<!--/getal--> overtredingen**, en het zijn precies de
  kleine handelingen van het beleid (`mediaos/stuur` en `/volg`, `leerstof/oefen` en
  `/antwoord`, `bijles/vraag`, `member/voorstel/intrek`). `KLEIN` heet "een kleine
  omkeerbare handeling", en van geen enkele is de terugweg beproefd. Ze zijn LATENT:
  er draait geen mandaat in productie, dus het is een overtreding in de grammatica en
  nog niet in een handeling die zelfstandig liep.
- **<!--getal:mensgrond.schuld-->0<!--/getal--> automatiseringsschuld.** Dat is geen
  compliment maar een gevolg van het bewijs: van de muterende handelingen hebben er
  <!--getal:mensgrond.terugweg-->79<!--/getal--> een bewezen terugweg (of een meting
  zonder effect). De mens staat er vrijwel overal OOK omdat de terugweg onbewezen is,
  en <!--getal:mensgrond.totBewijs-->39<!--/getal--> handelingen hebben geen andere
  grond dan dat -- dat is de werkelijke voorraad automatiseringskandidaten, en hij
  groeit met de herstelproef en niet met een besluit.
- **<!--getal:mensgrond.onbekend-->30<!--/getal--> onbekend**, nooit gelezen als geldig of
  als schuld.

Drie fouten die de meter in zijn eerste rondes maakte, en die als toets vastliggen
(`test/mensgrond.test.js`): een niet-bewezen LEZING een overtreding noemen (een oordeel
harder dan het bewijs), `/api/logout` en de instellingen van een zaak schuld noemen
(daar beslist een lid of een zaak over zijn eigen zaken -- de grond toestemming in zijn
zuiverste vorm -- en schuld bestaat alleen in RTG's eigen werk), en de terugstortstand,
de juridische positie van RTG, "mens tot er bewijs is" noemen omdat zijn effect alleen
`CONFIGUREREN` heet. Wat achter de deur van de eigenaar staat, is een oordeel.

Twee gronden hebben geen bron per route en staan in `ongemeten`, nooit als nul:
fysieke aanwezigheid en wettelijke bevoegdheid (de persoonseis en de klasse
`voorbehouden` zijn op handeling en genre ingedeeld, niet op route).

---

## 3. De architectuur, onderdeel voor onderdeel

| laag | stand | waar het staat, of wat ontbreekt |
|---|---|---|
| Reality Register | **staat** | `server/kern/bedrijfsmaat/` + `BEDRIJFSMAAT.json`; de sensor rekent in `stand.js`, achter de boardroom |
| Schema/Event Register | **stap weg** | de bus staat (`kern/envelop.js`, acht velden); het schemaregister niet (`INTELLIGENTIE.md` par. 3.6) |
| Intelligence Router | **staat, in de schaduw** | `kern/ai/router.js`: regels, algoritme, optimalisatie, voorspelling, ai; de optimizer staat in `ONTBREEKT` |
| Model Registry | **stap weg** | `server/local-ai.js` kent een lokaal model; een register per rol (klein, redeneren, embedding, tijdreeks) bestaat niet. `RTG_EXTERNE_AI_UIT=1` sluit extern hard af |
| Lenzen | **besluit** | een lens is een verklaarde set vragen en maten over het register, zonder eigen opslag |
| Opportunity + Diagnosis | **stap weg** | `kern/command/oorzaak.js` (welk veld verklaart deze gevallen samen) voor techniek; voor bedrijfsmaten niet |
| Forecast | **staat voor kosten** | `kern/kosten/vooruitblik.js`: een band pas als de trefzekerheid over drie afgesloten maanden gemeten is |
| Causale inferentie, optimizer | **jaren weg** | geen constraint solver in dit huis |
| Digital Twin | **staat voor ops** | `kern/command/simulatie.js`; een tweeling van de bedrijfseconomie bestaat niet |
| Planner | **staat als kern** | `kern/stuur/plan.js`: voert niets uit, bezit niets |
| Independent Critic | **besluit** | de tegenproef krijgt ANDERE invoer (plan, beleid, ruwe cijfers), nooit de redenering; een critic op dezelfde invoer is een stempel (`KANTOORMACHT.md`) |
| Deterministic Verification | **staat** | `kern/command/transactie-poorten.js`: een controle die niet kon draaien is niet geslaagd |
| Policy + Streefstand + Mandate | **stap weg + besluit** | `kern/beleidsmotor/` in de schaduw, `kern/stuur/mandaat.js` zonder aanroepers; de streefstand staat sinds 27 september als `kern/streefbeeld.js` (C7), maar als VANGRAIL rond de afgesloten maanden en nog niet als gewenste toekomstige stand (par. 8) |
| Mensgrond | **staat als meter** (6 oktober) | `scripts/lib/mensgrond.js` (de gesloten lijst) en `npm run mensgrond`: waarom staat er bij elke handeling een mens (par. 2.9) |
| tonen | **staat voor het kantoor** | C2: drie paden |
| klaarzetten, uitvoeren | **jaren weg** | 7 van de 118 AI-schrijfparen dragen een gemeten gevolg, een beproefde terugweg en een beschermde herhaling (`INTELLIGENTIE.md` par. 6) |
| Boardroom | **staat** | vraagt een identiteit; de enige plek waar een besluit vandaag een naam heeft |
| Decision Memory | **staat** (28 september, C13) | `kern/beslisgeheugen.js`: gronden van toen, verwachting per maat, intrekken met reden; de machine stelt er niets uit voor |
| Nameting | **staat, per maat** | de uitkomst wordt bij het lezen uitgerekend uit de maand van de toets; een menselijk oordeel over het besluit (klopte, klopte niet) is er nog niet |
| Leren | **besluit genomen** | een leerregel promoveert pas na aftekening door een mens (`CODE.md` besluit 4) |

**De terugweg blijft het plafond.** Zolang het getal van 7 op 118 laag is, wordt
de machine briljant in waarnemen, analyseren, voorspellen en klaarzetten, en niet
kunstmatig sneller in uitvoeren. Pas als de terugwegen bewezen zijn, schuift het
gezag vanzelf op.

---

## 4. De ketens

Een conclusie over een keten is pas gegrond als elke schakel bestaat. Waar hij
breekt, is waar het verhaal ophoudt:

| keten | stand | eerste breuk, en wat er ontbreekt |
|---|---|---|
| service | **gegrond** | fout -> klokken -> opgelost zonder herhaling |
| afdracht | **gegrond** (27 september) | de maandbijdrage zegt nu zelf dat hij afgesproken is, gemeten, wanneer gepeild en wat hij niet dekt |
| funnel | **gegrond** (27 september) | nieuw lid, cohort, activatie, klantwaarde in LivingOS en aanwezigheid; de andere drie werelden hebben hun eigen klantwaardemaat ernaast |
| kosten | **gegrond** (29 september) | van kosten per drager via de maandafsluiting en de vooruitblik naar de marge per lid, per pas (C15); `vermoed`, want stroom en serverhuur zijn verdeeld |
| geld | **gegrond** (27 september) | van ontvangen omzet via bruto- en operationele marge en het banksaldo naar de runway; alles na de brutomarge draagt de graad `vermoed`, want het rust op overgetikte bedragen |
| werving | **gegrond** (28 september) | campagne (C12) -> kanaal -> kosten per nieuw lid, per kanaal en per campagne; een ondergrens, want wie de link zag en later zelf zocht telt niet mee |

---

## 5. Wat de meting blootlegde

Dingen die geen bestaande toets zag, en die het ontwerp raken:

1. **Wat het kantoor "omzet" noemt, is transactievolume van zaken.** Dezelfde
   functie zegt dat RTG niets aan boekingen verdient.
2. **Er bestaat geen weg van een betaalde pas naar gast.** Een account krijgt
   zijn pas bij het aanmaken, `setTier` tilt alleen op, en een opgezegd contract
   laat de pas staan. Churn volgens de definitie kan vandaag niet voorkomen; de
   maat bestaat en zegt dat hardop.
3. **De ledenfacturen van RTG Pass-leden staan per lid versleuteld in de kluis.**
   De omzetmaten zien alleen de betaalschema's uit aanmeldingen; alles optellen
   is een leesweg naar de kluis, en dat is een besluit.
4. **`HERSTELPROEF.json` draagt geen stempel.** De terugwegen -- het plafond op
   autonomie -- hebben daardoor geen aantoonbaar peilmoment.
5. **Het kantoorscherm toonde tellingen van een.** Een stad met een lid, een pas
   met drie; en de omzet per pas verraadde het aantal via prijs maal aantal.
6. **RTG kent zijn eigen banksaldo niet.** Cash, liquiditeit en runway missen
   daardoor hun bron; het instrument bestaat wel, voor een ondernemer.

---

## 6. Wat niet mag sneuvelen

- **Geen zesde gezagsladder.** Observer, Adviseur en de rest zijn geen treden:
  de treden zijn `geen / tonen / klaarzetten / uitvoeren`, en *autonoom binnen
  mandaat* is een eigenschap van het mandaat (INT-01).
- **Geen samengesteld cijfer** over bedrijfsgezondheid, klantwaarde of kansen, en
  een schatting draagt de graad `vermoed` met haar opbouw (INT-04).
- **De runtime komt nooit aan de bron.** De catalogus staat in `server/`, de
  controle van de citaten in `scripts/` (CODE-AI-001).
- **Geld verlaat het huis nooit vanzelf**, en de firewall tussen de werelden gaat
  voor alles (C1, `GELD.md`, `ECONOMIE.md`).
- **Experimenten op leden zijn ongelijke behandeling.** Geen prijsexperiment op
  een lopend contract, niets op de RTFoundation of op minderjarigen, en nooit
  optimaliseren op aandacht -- alleen op een geslaagde uitkomst.

---

## 7. De volgorde

Van goedkoop naar duur. Bijgewerkt op 27 september 2026: wat staat, is
doorgestreept met de datum; de besluiten staan in par. 2.5.

1. ~~**`uitkomst.rit-afgerond` als projectie**~~ -- staat (27 september), langs de
   groepspoort, die leden telt en geen ritten.
2. ~~**Klantwaarde per wereld**~~ -- staat (27 september, C3): de reisstand `thuis`
   (`kern/reisbureau-thuis.js`, door het lid of het kantoor), `afgerondOp` op een
   casus, en vier maten naast elkaar in `kern/bedrijfsmaat/klantwaarde.js` -- elk
   met een eigen wereld en groepspoort, en geen totaal.
3. ~~**De brutomarge uitrekenen**~~ -- staat (27 september): ontvangen omzet min
   de gerekende gemeten kostensoorten; verbruik zonder tarief maakt haar
   `NIET_UIT_TE_REKENEN` in plaats van nul.
4. ~~**Een graad en peilmoment op de maandbijdrage**~~ -- staat (27 september); de
   afdrachtketen is gegrond.
5. ~~**De idempotentieproef over `/api/office/bedrijfsmaat`**~~ -- gemeten en op het
   kantoorstuur (27 september), zonder dat de onbekende effectpaden stegen. De
   verse ronde legde twee dingen bloot: veertien routes die het oude register
   niet kende (alle veertien kregen een besluit), en een proef die na de
   passkeyverharding van de incassoronde niet meer binnenkwam -- die krijgt nu een
   eigen medewerker met passkey (`scripts/lib/idempasskey.js`).
6. **Het banksaldo van RTG** -- besloten (C4). ~~De handmatige bron~~ staat (27
   september): `kern/bankpositie.js`, per maand met afschrift en afschriftdag,
   graad `vermoed`, en de plek voor eigen bonnen op nul met reden. ~~Liquiditeit en
   runway~~ staan ook (27 september, C8-C10): `kern/rtgboek.js` is het boek van RTG
   zelf, gevuld door Financiën in zijn eigen kamer, en
   `kern/bedrijfsmaat/stand-rtgboek.js` rekent er de operationele marge, de
   liquiditeit (met het ledentegoed uit `kern/pay` ernaast) en de runway bruto en
   netto uit. Een half ingevuld boek levert geen enkel getal. ~~De bon~~ is besloten
   (28 september, C14): ook te besteden bij zaken, dus e-geld, en daarom een
   schakelaar die de positie is (standaard dicht) plus de vergunningseis; de
   verplichting leest de bankpositie uit het register van de bon. Verkopen en
   inwisselen wachten op een e-geldvergunning of vrijstelling.
7. ~~**Een weg van een betaalde pas naar gast**~~ -- staat (27 september, C5):
   `kern/aanmeldingen/naargast.js`. Het lid kiest nu of aan het eind van zijn
   periode (zijn eigen opdracht, geen schakelaar), het kantoor op naam met een
   reden, en drie automatische regels (afgelopen, afgelopen plus wachttijd,
   onbetaalde termijnen) die standaard uit staan. Elke weg laat de sessies
   vervallen; facturen en betaalschema blijven. Churn kan nu voorkomen.
8. ~~**Een herkomstkanaal bij aanmelding**~~ -- staat grotendeels (27 september, C6):
   `kern/aanmeldkanaal.js` telt per maand, nooit per lid, en de campagnecode uit de
   link (`?c=`) reist mee. De vraag zelf staat sinds dezelfde dag NA de registratie
   (keuze van de eigenaar), op het welkomstscherm zodra de onboarding klaar is:
   alleen als de link niets telde, een keer (`POST /api/auth/aanmeldkanaal`;
   antwoorden en overslaan sluiten hem allebei), en de antwoorden komen van de
   server zodat er geen tweede lijst ontstaat. Het account draagt alleen DAT de
   vraag nog open is, nooit wat er gekozen werd. ~~CAC~~ staat ook (C11): de
   marketinguitgave per kanaal uit het boek van RTG, gedeeld door de nieuwe leden
   die dat kanaal opgaven, en onder de groepsgrens geen getal. ~~Campagnes~~ staan
   ook (28 september, C12): een code onder een kanaal, met de uitgave per campagne
   in het boek en de kosten per nieuw lid per campagne.
9. ~~**De streefstand**~~ -- staat (27 september, C7), in de code het **streefbeeld**
   (`kern/streefbeeld.js`; `streefstand` was al een veld van elk gevolgcontract).
   Het voorstel komt uit de laatste drie afgesloten maanden, de eigenaar tekent een
   vingerafdruk van precies dat voorstel, en autonoom mag alleen als geen enkele
   dimensie buiten de tolerantie of onbekend is. Er handelt nog niets autonoom.
10. ~~**Het beslisgeheugen**~~ -- staat (28 september, C13): besluit, gronden van
    toen, verwachting per maat en de uitkomst na de termijn, zonder totaal en zonder
    voorstel. Sinds 29 september met een scherm (de tab Besluiten in de
    boardroom), en alle zes ketens zijn gegrond: de kostenketen sloot met de marge
    per lid (C15). Die maat rekent alleen over de lopende maand, dus een besluit
    dat hem als verwachting draagt, krijgt bij het toetsen geen oordeel maar de
    reden -- zo hoort het, want de bijdrage per pas van toen is niet bewaard.

---

## 8. Van pre-startup naar wereldschaal: de kaart

Geschreven op 6 oktober 2026 als antwoord op de opdracht om de interne machine van
RTG/RTF te bouwen: *waar staan we, wat is de volgende bewezen streefstand, wat
ontbreekt, wat doet de machine zelf, waar is een mens nodig en waarom, en wat leren
we ervan.* Eerst gelezen, toen gebouwd; het meeste staat al.

### 8.1 Wat er al staat

| begrip uit de opdracht | staat als |
|---|---|
| huidige bewezen toestand | `kern/bedrijfsmaat/` (de sensor, vier elementen per maat, de groepspoort aan de bron) |
| streefstand met tolerantie | `kern/streefbeeld.js` (C7) -- een vangrail, zie 8.2 |
| fase uit bewijsbare voorwaarden | `kern/onderneming/fase.js` -- voor de onderneming van een LID, afgeleid uit feiten |
| klimmen op bewijs, met een mensrem | `kern/command/uitrolregie.js` -- de functietrap, niet de onderneming |
| plan | `kern/stuur/plan.js` (een capabilityplan; voert niets uit) |
| mandaat | `kern/stuur/mandaat.js` (versmalt, leeg is dicht, nul aanroepers) |
| bewijs, verificatie | `command/transactie-poorten.js`, `kern/envelop.js`, de bewijsgraden van `BESTUUR.md` |
| beslisgeheugen, leren | `kern/beslisgeheugen.js` (C13), `CODE.md` besluit 4 |
| forecast met trefzekerheid | `kern/kosten/vooruitblik.js` (alleen kosten) |
| simulatie | `command/simulatie.js` (alleen ops) |
| schaduw | `kern/pay/schaduw.js`, `kern/commercie/schaduw.js`, `kern/beleidsmotor/` |
| ochtendkaart | `kern/ochtendkaart.js` (`PERSONEEL.md`; stelt niets voor, B4) |
| uitleg, consequentie, actiestaat | `shared/edge/actiestaat.js`, `shared/adaptief/grammatica.js` (vijf gewichten) |
| leren als dossier | `kern/carriereledger/`, `kern/connect/leerdossier.js` |
| mensgronden | `scripts/lib/mensgrond.js` + `npm run mensgrond` (par. 2.9) |

### 8.2 Wat werkelijk ontbreekt

1. **Een gewenste toekomstige stand.** Het streefbeeld is het gemiddelde van drie
   afgesloten maanden met hun spreiding als tolerantie. Dat is een VANGRAIL (*wat mag
   niet slechter worden*) en geen streefstand (*waar gaan we heen*). Vóór de start
   bestaan er geen drie maanden, dus levert het niets -- terwijl de opdracht juist bij
   nul begint.
2. **Een fase van RTG zelf.** Er zijn drie ladders die erop lijken (de
   ondernemingsfase van een lid, de uitroltrap, R0-R5 en A0-A4 in `MAATSTAF.md`) en
   geen enkele zegt waar RTG als onderneming staat.
3. **Een kloof per dimensie** tussen bewezen stand en streefstand, met de
   afhankelijkheden ertussen.
4. **Een serveroordeel per persoon en object** (`EDGE.md`: ronde 3). Zonder dat kan
   een Human Work-scherm alleen projecteren wat de client zelf denkt, en dat mag niet.
5. **De terugweg.** Niet als laag maar als bewijs: zie de handelingen die alleen op
   `terugweg-onbewezen` een mens dragen (par. 2.9).

### 8.3 Wat botst met besluiten die al genomen zijn

- **`streefstand` is bezet** (het veld van elk gevolgcontract; de keuring van
  `gevolgcontract/keuring.js` zet `doel` er zelfs actief naar om). De code heet daarom
  `streefbeeld`, en een vooruitkijkende uitbreiding hoort dáár bij en krijgt geen
  derde naam.
- **`fase`, `FASEN` en `trede` zijn bezet**, `FASEN` zelfs achtvoudig (`SEMANTIEK.json`).
  Een ladder van zestien fasen van idee tot voortdurende evolutie zou de zesde
  gezagsladder op een nieuwe as zijn. De vorm die past is die van
  `kern/onderneming/fase.js`: een fase WORDT AFGELEID uit feiten en kan niet worden
  gezet -- en dat is precies de eis dat niemand RTG tot scale-up kan verklaren.
- **"Noordster" is een codenaam van een lid** in de toetsen. Een codenaam als
  begripsnaam is een privacyfout in wording; de richting heet hier gewoon *de
  richting*.
- **`waarde` is de geldlaag** (`WAARDE.md`, `kern/waarde/`). Waardedimensies krijgen dus
  een andere naam.
- **Een kansenmotor** zit tegen INT-04 (geen samengesteld cijfer) en tegen
  `CONNECT.md` (de mixer verdeelt plekken, geen punten). Een kans is een hypothese met
  een reden in woorden, nooit een score.
- **Personeelsbehoefte voorspellen** botst vandaag met **C23**: het eigen kantoor blijft
  ongeteld, want met een klein kantoor is elk getal een getal over een mens. Daarbij
  geldt de trefzekerheidsregel: zonder drie gemeten perioden geen band.
- **"3.794 zelfstandig afgehandeld"** is vandaag onwaar (`PERSONEEL.md` par. 5): er
  handelt niets zelfstandig. Een ochtendkaart zegt "door het team opgelost" of
  "klaargezet en bevestigd", nooit "zelfstandig".

### 8.4 De besluiten die de eigenaar moet nemen

- **M1. Mag een streefbeeld een gewenste stand dragen die de eigenaar zelf zet?** C7
  zegt: de machine stelt voor, de eigenaar tekent. Een vooruitkijkende stand betekent
  dat de eigenaar een getal INVOERT, en dat verandert wie de streefstand schrijft.
- **M2. Krijgt RTG een eigen ondernemingsfase, afgeleid uit feiten?** Met
  `kern/onderneming/fase.js` als vorm, en misschien als motor: RTG als eerste klant van
  zijn eigen WorkOS (besluit B1 van `PERSONEEL.md`).
- **M3. Is "gegevens verlaten het huis" een eigen mensgrond?** De lijst kent hem niet;
  het effect `BULK_UITVOER` staat open en de meter meldt hem.
- **M4. Is andermans gegevens wijzigen een tweede-persoon-grond?** De meter zegt nu ja
  (de strenge kant); dat maakt veel kantoorroutes tot mensenwerk.
- **M5. Wat gebeurt er met de zes kleine handelingen?** Een terugweg bewijzen, of ze van
  `klein` naar `voorstel` zetten. Het tweede is een productkeuze: Rahul kan dan niet
  meer vanzelf een stuk aanzetten of iemand volgen.

### 8.5 De kleinste volledige snede

*Pre-startup: de eerste RTF-gezinnen en de eerste betalende leden.* Niet omdat die
belangrijk klinkt, maar omdat elke schakel al bestaat behalve twee, en die twee zijn
precies M1 en M2:

```
streefbeeld (gewenst: n leden, n gezinnen; ONBEKEND waar geen bron)   M1
  -> bewezen stand uit de bedrijfsmaten (groepspoort: onder de grens geen getal)
  -> kloof per dimensie, met graad en reden
  -> plan.js: welke handelingen de kloof raken
  -> per stap de mensgrond (scripts/lib/mensgrond.js)
       machine: alleen tonen en klaarzetten (C2)
       mens:    een uitnodiging versturen (tweede persoon), een pas toekennen (oordeel)
  -> de mens bevestigt via de bestaande route
  -> beslisgeheugen legt de verwachting vast (C13)
  -> nameting per maat na de termijn
  -> nieuwe stand -> nieuwe kloof
```

Wat deze snede bewijst is niet dat RTG zichzelf bestuurt maar dat de lus SLUIT: een
kloof leidt tot een mensmoment met een grond, het mensmoment tot een vastgelegde
verwachting, en de nameting tot een nieuwe kloof. De toets is een ketenproef in de vorm
van `scripts/tafelproef.js` (per schakel: handelt A, en ziet B dat?).

### 8.6 De modulegrens

- `scripts/lib/mensgrond.js` -- de gesloten lijst en de indeling; geen opslag, geen route.
  Hij woont in `scripts/` en niet in `server/kern/`, en dat is een uitslag van de
  keuring en geen voorkeur: een servermodule die nergens in de runtime wordt
  aangeroepen is een capability zonder caller (`CONTROLPLANE.md`). Hij verhuist naar
  `server/kern/` op de dag dat de eerste lezer in de runtime er is -- het Human
  Work-scherm -- en dan als EEN bron, nooit als kopie.
- `server/kern/streefbeeld.js` -- blijft de enige eigenaar van de streefstand; een
  gewenste stand (M1) wordt een uitbreiding, geen tweede module.
- Een kloofberekening hoort een LENS te zijn (par. 0): een verklaarde vraag over de
  bedrijfsmaten zonder eigen opslag.
- Een Human Work-projectie leest de grond, het gewicht (`grammatica.js`) en het
  serveroordeel, en verzint er geen eigen tekst of bevoegdheid bij. Hij wacht op ronde 3
  van `EDGE.md`.
- `scripts/mensgrond.js` meet; niets in `server/` leest hem of de lijst (CODE-AI-001).
