# Toezicht — van bewijs naar verantwoording

Dit document beschrijft **drie lagen die op elkaar staan** en de volgorde waarin
ze gebouwd worden. Het beschrijft ook wat de onderste laag nú al moet uitzenden,
zodat de bovenste twee later kunnen ontstaan in plaats van gebouwd te worden.

`LAT.md` gaat over de code, `NORM.md` over de meters, `GELDLAT.md` over het
contract van de zwaarste keten, en dit document over de vraag die een
buitenstaander stelt: *waarmee toon je aan dat het beheerst is?*

## De drie lagen

```
PROOF SYSTEM            bewijzen dat RTG beheerst werkt
      ↓
REGULATORY EVIDENCE     welke eis wordt door welk bewijs afgedekt
      ↓
AUDIT ROOM              gecontroleerd kunnen overleggen aan een derde
```

**De volgorde is niet vrij.** Een evidence-laag boven controls die nog niet
bewezen zijn, bestaat uit lege vakjes en met de hand bijgehouden documentatie —
precies het soort compliance dat niets aantoont en dat na twee kwartalen
achterloopt op de werkelijkheid. Zijn de bewijzen er eerst, dan ontstaat de
tweede laag grotendeels vanzelf: hij mapt, hij meet niet.

## De vijf niveaus van bewijs

Een toets kan vijf verschillende dingen vergelijken, en ze worden makkelijk door
elkaar gehaald omdat ze allemaal "een test" heten.

| | Vergelijkt | Vraagt | RTG staat op |
|---|---|---|---|
| **1** unit | code ↔ verwachting | geeft functie X het juiste resultaat? | 5.736 beweringen |
| **2** integratie | route ↔ verwachting | werkt de hele betaalroute? | 465 servertoetsen |
| **3** sabotage | code ↔ vijandige wereld | werkt hij nog als de opslag faalt? | 3 van 8 verraden ingebouwd |
| **4** contract | verwachting ↔ werkelijkheid | betekent 200 OK wat de gebruiker denkt? | 6 scenario's, 8 velden |
| **5** invariant | werkelijkheid ↔ systeemwet | kan dit onder ÉÉNIGE toegestane volgorde breken? | nog niet gebouwd |

De sprong van 1 naar 4 is er een van strengheid: je blijft de code toetsen, maar
tegen een steeds hardere maatstaf. Niveau 4 was de winst van de ketenronde — de
vaststelling dat "geslaagd" zelf te zwak gedefinieerd was.

**De sprong van 4 naar 5 is van een andere soort**, en dat is de reden dat de
invariantenmotor geen zwaardere ketenronde is. Niveau 1 tot en met 4
kwantificeren over **invoer**: welke waarden kunnen erin. Niveau 5 kwantificeert
over **volgordes**: welke interleavings van gebeurtenissen zijn toegestaan. Die
zijn niet met de hand op te sommen — vandaar gegenereerde toestandsovergangen,
en vandaar shrinking, want een wet die pas na 4,7 miljoen stappen breekt is
alleen bruikbaar als je hem terugbrengt tot de zes stappen die hem breken.

### Wanneer is iets een wet en nog geen toets

Een wet moet een herschrijving overleven. Of `oplaadAfronden`, `save()`, SQLite
of straks Postgres het werk doet, hoort niet uit te maken:

> Een bevestigde financiële mutatie mag nooit stil verdwijnen.

Daaruit volgt een acceptatiecriterium dat scherp genoeg is om te handhaven:

**noemt een wet een implementatienaam, dan is het nog geen wet.**

Geen functienaam, geen tabel, geen endpoint, geen opslagsoort. Wat overblijft is
een uitspraak over waarneembaar gedrag — en precies daarom blijft hij staan als
de code eronder wordt vervangen. Een wet die `pay/oplaad` noemt, is een
integratietoets met een deftige naam.

## Laag 1 — Proof System (in aanbouw)

Wat er staat: `BEWIJSMATRIX.json` (elf schakels per route), `MUTATIES.json`,
`NORM.json`, `BEREIK.json`, `SCHERMLEUGEN.json`, `KLOK.json`, `BELOFTE.json`,
`GRENZEN.json`, `SLO.json`, `BEPROEVING.json`.

Wat er nog moet: ACL- en privacybewijs per route, de Verraadsmotor, de
invariantenmotor, de Dodenlijst, herstel uit as, Build DNA en reproduceerbare
builds, de Buitenwacht, hartslagen, protocol-fuzz, noise budget, en de
langetermijn-anomaliedetectie.

## Het uitzendcontract — wat elke control NU al moet meegeven

Dit is het enige deel van dit document dat vandaag al bindend is.

Een control die alleen "groen" meldt, is later niet te gebruiken als bewijs:
een auditor vraagt niet of het groen is maar **wanneer**, **waartegen**,
**wie ervoor tekent** en **waar het bewijsstuk ligt**. Die vier velden
achteraf door twintig bewijzen heen vlechten is een verbouwing; ze meteen
meegeven kost niets.

Elke nieuwe control levert daarom een regel met:

| Veld | Betekenis | Voorbeeld |
|---|---|---|
| `control` | stabiele id, verandert nooit | `AUDIT-KETEN` |
| `wat` | in één zin, zonder jargon | het auditspoor is niet stil te herschrijven |
| `eigenaar` | rol, geen persoon | Security |
| `bewijs` | welke toetsen het aantonen | `test/keten.test.js` |
| `laatstGroen` | wanneer het bewijs voor het laatst is gedraaid | ISO-tijdstempel |
| `bewijsstuk` | het naslagbare artefact | ketenhash, buildhash, registerregel |
| `grens` | wat deze control **niet** aantoont | stopt stille wijziging, geen vastberaden beheerder |
| `dekking` | waar de **noemer** staat: hoeveel van hoeveel | `1000 / 2937 schrijfroutes` |

**Er staat nooit GROEN zonder noemer.** ROL-SCHEIDING meldde "0 doorbraken" —
waar, en bij een snelle blik groter dan het bewijs: er waren 1000 van de 2937
schrijfroutes geprobeerd. Elke control hier meet een deelverzameling, dus elke
control toont `x / y` met de eenheid erbij. De teller komt **uit het register
van de control zelf**, niet uit zijn eigen verklaring: een control die zijn
dekking mag opschrijven, schrijft hem te hoog op. De declaratie wijst alleen aan
wáár het getal staat.

Een teller die niet in het register staat, toont `ONGEMETEN` en niet `0` — nul
is de geruststellendste manier om "ik weet het niet" te zeggen.

**En de bewijssoort hoort erbij, ook waar hij niet van toepassing is.** Niet één
woord PROVEN, maar waar het bewijs vandaan komt:

```
GELD-DURABILITY
  scenario test        PROVEN
  fault injection      PROVEN
  subprocess detector  SELF-TESTED
  source mutation      NOT APPLICABLE
```

Die laatste regel staat er omdat een subprocestoets buiten het bereik van de
mutatiemotor valt (`test/persistentiestand.test.js` is er zo een). Dat is geen
vergeten toets, en het hoort niet weg te vallen in een totaal van zeshonderd
groene: het bewijs kwam anders tot stand, en dat moet leesbaar blijven.

Het veld `grens` is verplicht en niet optioneel. Een control zonder
opgeschreven grens wordt bij het mappen naar een eis onvermijdelijk te ruim
gelezen, en dan dekt één toets op papier drie eisen die hij in werkelijkheid
niet raakt. Dat is de duurste fout die deze hele stapel kan maken.

**Twee standen die uit elkaar moeten blijven**, en dit is het verschil waar de
Audit Room straks op draait:

- *control aanwezig* — de voorziening bestaat in de code;
- *control recent bewezen* — een toets heeft hem onlangs zien werken.

Een control die aanwezig is maar al maanden niet bewezen, is geen control maar
een aanname met een bestandsnaam. `laatstGroen` maakt dat verschil zichtbaar in
plaats van bespreekbaar.

## Laag 2 — Regulatory Evidence (later)

Per eis vastleggen welke policy geldt, wie eigenaar is, welke technische control
hem afdwingt, welk bewijs hem aantoont, wanneer dat voor het laatst groen was en
welke auditdata erbij hoort.

```
EIS → POLICY → EIGENAAR → CONTROL → BEWIJS → LAATSTE UITSLAG → AUDITDATA
```

Boven diezelfde controls komen meerdere mappings te staan — DORA, AVG, PSD,
AML/KYC, ISO 27001, SOC-achtige assurance. Dat is de hele winst van deze
volgorde: **één goed bewezen control levert bewijs voor meerdere eisen**, en
hoeft dus niet zes keer gebouwd te worden. Wie andersom begint, bouwt per
raamwerk opnieuw.

Deze laag **meet niets zelf**. Zodra hij een eigen meting krijgt, is er een
tweede waarheid naast laag 1, en die twee lopen uit elkaar — de fout waar
`LAT.md` regel 4 over gaat.

## Laag 3 — Audit Room (later)

Alleen-lezen toegang voor een auditor of toezichthouder, zonder toegang tot de
interne systemen. Wat er in hoort:

- tijdsgebonden momentopnames per release;
- de geschiedenis van het bewijs, niet alleen de laatste stand;
- open uitzonderingen, met eigenaar en datum;
- cryptografische hashes van de bewijsstukken, zodat een pakket dat de deur uit
  gaat naderhand aantoonbaar ongewijzigd is;
- en de scheiding tussen *aanwezig* en *recent bewezen*, expliciet in beeld.

## Waarom in deze volgorde, in één zin

Bouwen → bewijzen → mappen naar regelgeving → gecontroleerd kunnen overleggen.
Elke stap overslaan levert een laag op die iets belooft wat de laag eronder niet
waarmaakt, en dat is precies wat een toezichthouder eruit haalt.
