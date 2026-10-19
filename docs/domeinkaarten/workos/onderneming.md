# Onderneming (link:onderneming)

**Volledige werkzaamheid:** een lid brengt zijn onderneming in één dossier van
werktitel via verkenning, rechtsvorm, oprichtingslijst en inschrijving tot een
draaiende zaak met eventueel een tweede vestiging, en ziet op zijn dagbeeld
voor elke entiteit en vestiging welke termijnen lopen, wat er staat en wat
ontbreekt, met bij elk getal zijn bron en zekerheidsklasse; alleen hijzelf (en
wie hij via Concern of een werkruimte toelaat) komt erbij, en RTG dient niets
in. Getoetst: `scripts/lib/voltooi/onderneming.js` loopt van `nieuw` tot
`dagbeeld` (bestaat) en, uitgebreid, tot een tweede Concern-vestiging die de
fase op "vestigingen" zet en niet op "groep".

Eigenaar volgens SCHERMEIGENAAR.json: `werk.onderneming` -> `apps/onderneming.html`,
doelgroep lid. Het doel volgens SCHERMEIGENAAR: "Als (aankomend) ondernemer zijn hele
onderneming besturen: idee en cijfers doorrekenen, gezondheid en kasvooruitblik zien,
rechtsvorm en oprichtingsstappen afhandelen, een zaak aanvragen, en lopende klanten,
facturen, contracten, voorraad en personeel overzien." Ingang: `/apps/onderneming.html`.
Doelgroep: het lid als (aankomend) ondernemer. De zaak en het concern hangen er
achter.

**Ambitie van de eigenaar.** Een ondernemingsdossier van idee tot
exploitatie, bijvoorbeeld het openen van een tweede restaurant. Oprichting en
dagelijkse exploitatie zijn daarin één wereld.

Onderneming koppelt aan:
- Concern, voor entiteiten en vestigingen;
- Horeca, voor de operatie;
- Werk OS, voor contracten, besluiten en uitgaven;
- Geld.

KvK, notaris, vergunningen, Belastingdienst en UWV blijven extern. RTG dient
niets in.

---

## a. Inventaris van het bewezen bestaande

**Wat er staat**

- Scherm: `public/apps/onderneming.html`. Het roept 14 routes aan:
  `nieuw`, `mijn`, `rechtsvorm(en)`, `oprichting/zet`, `intake`, `verkenning`,
  `plan/vastleggen`, `ingeschreven`, `aanvraag(/stand)`, `kas/saldo`,
  `dagbeeld` en `werkruimte`.
- Concern hangt achter dit scherm, met een link naar `/apps/concern.html` en
  geen eigen tegel.
- Routes: `server/routes/member/onderneming.js`, `-geld.js`, `-bestuur.js` en
  `-verkenning.js`. Samen 39 paden onder `/api/onderneming/`.
- Het scherm roept onder meer niet aan:
  - `beeld`, `capaciteit`, `crediteuren`, `debiteuren`, `eersteklant`, `kas`;
  - `klussen`, `koppel`, `mallprofiel`, `ontwerp`, `pijplijn`, `relaties`;
  - `toegang`, `voorraad`, `werving`, `belasting`, `bestuur*` en `aandeel*`.

  Een deel daarvan komt via `dagbeeld` op het scherm.
- Kern: `server/kern/onderneming/` (52 bestanden, ca. 6.300 regels).
- De drie assen:
  - `rechtsvorm.js` met de varianten NL, Europa, landen en Angelsaksisch, plus
    `rechtsvormwacht.js`;
  - `fase.js`;
  - `kern/werkvormen.js`.
- Levensloop (`levensloop.js`): `nieuw`, `rechtsvorm`, `koppel` en
  `ingeschreven`.
- Verkenning:
  - `intake.js`, `kans.js`;
  - `simulatie.js`: 12 maanden, 3 scenario's, aannames met herkomst;
  - `stress.js` + `stress-toetsen.js`;
  - `plan.js`.
- Oprichting: `oprichting.js`, met stappen uit rechtsvorm, branche en situatie.
  De lijst zegt zelf dat hij juridisch niet volledig is.
- De overgang naar een zaak: `aanvraag.js`. Het wordt een gewone aanmelding,
  zonder automatische toekenning.
- Exploitatie, in `draaiend.js` als kaart naar de modules:
  - `relaties`, `debiteuren`, `crediteuren`, `contracten` (leest Werk OS),
    `belasting`, `kas`;
  - `capaciteit`, `werving`, `pijplijn`, `voorraad`, `klussen`;
  - `bestuur` (`bestuur*.js`, aandelen en UBO), `regie` (provisioning) en
    `toegang`.
- Brug naar de werkvloer: `zaakkant.js`, die één kant op loopt en alleen
  leest.
- Dagbeeld: `dagbeeld.js` + `dagbeeld-acties.js`, fasebewust. De meter
  (`meter.js`) geeft geen cijfer onder twee bronnen.
- Opslag: collectie `ondernemingen` via `kern/eigencollectie`. Eén onderneming
  draagt één `supplierCode`; een tweede koppeling geeft 409 (`levensloop.js`).

**Wat bewezen is**

| Bron | Stand |
|---|---|
| APPWERKT.json | bereikbaar B, bedienbaar B, menselijk NT, voltooibaar GF, waarheidsgetrouw B, persistent GF, bevoegd NT, herstelbaar GF |
| BEVOEGD.json | 1 route gemeten, 1 open |
| Verse voltooiproef (19-10, dc501544, `scripts/lib/voltooi/onderneming.js`) | voltooibaar 6/6, persistent 3/3, herstelbaar 4/4, menselijk 3/3. Lokaal gesloten 4/4, centraal nog te stempelen. De proef loopt `nieuw`, `mijn`, `rechtsvorm`, `oprichting/zet`, `intake`, `verkenning`, `plan/vastleggen`, `ingeschreven`, `kas/saldo` en `dagbeeld`, met een ander lid dat er niet bij komt |
| Tests | ca. 28, waaronder `test/onderneming-routes.test.js` |
| ADAMPROEF.json | 18/18: aanname -> dienstverband via de vestiging van de zaak (`kern/concern/aanname.js`). Raakt onderneming via de koppeling zaak -> entiteit |

**Staat, onbewezen:** debiteuren, crediteuren, belasting, capaciteit, werving,
voorraad, bestuur, aandeel, toegang en de aanvraag naar een echte zaak.
`werkruimte` en `contracten` hebben sinds d9fd905 een eigen toets
(`test/onderneming-contracten.test.js`), maar zitten niet in de voltooiproef.

**Wat de code of het document als niet gebouwd opgeeft**

- CONCERN.md par. 1:
  - ingang 2 ("nieuw bedrijf") bestaat;
  - ingang 1 ("ik heb al een bedrijf") half, via `ondernemingKoppel`;
  - ingang 3 (holding) en ingang 4 (uitgenodigd) bestaan niet.
- CONCERN.md par. 4: "Multi-location cloning" en "Holding policy inheritance"
  staan beschreven. In `server/kern/concern/` is geen code gevonden (grep op
  `kloon` en `cloning`).
- `fase.js`: een exploitatiefase als aparte stand bestaat niet. Na
  `eersteklant` volgen `tractie`, `werkgever`, `vestigingen` en `groep`.
- `capaciteit.js`: geen gemiste omzet ("een verzinsel met een euroteken").
- `toegang.js`: "er komt geen derde rechtenmodel bij". Het gat tussen zaak
  (manager/staff) en werkruimte (18 rechten) wordt benoemd en niet gedicht.

**Gelezen in de code (niet beproefd)**

- **Vestigingen.** `beeld.js` telt `vestigingen` uit `supplier.vestigingen`.
  Dat is de Mall-lijst van plekken (`kern/mall/vestigingen.js`: "wij zijn ook
  in Haarlem"), en niet de Concern-vestiging (`kern/concern/vestiging.js`).
- **Entiteiten.** `entiteiten` telt de ondernemingen van dezelfde eigenaar,
  niet de Concern-entiteiten.
- Gevolg: een tweede restaurant als tweede operating unit onder dezelfde BV
  verschuift de fase niet naar "vestigingen". Een tweede onderneming-object
  voor datzelfde restaurant zet de fase op "groep", ook als er juridisch maar
  één BV is.
- `/api/onderneming/werkruimte` koppelde elke bestaande werkruimtecode, zonder
  toets op lidmaatschap. **Gerepareerd in commit d9fd905**: alleen een actief
  lid met zijn eigen `rtgKey` koppelt (`isLid` in `contracten.js`); een vreemde
  werkruimte krijgt hetzelfde 404 als een onbekende; wie vertrekt, ziet stand
  `geen-toegang`. Toets: `test/onderneming-contracten.test.js`.
- `belasting.js` draagt een eigen vlag `zeker: true`. Er wordt geen klasse
  gelezen uit `kern/fiscaal/zekerheid.js` (`reservering.btw` = bepaald,
  `reservering.winst` = advies).

---

## b. Marktvergelijking

Geraadpleegd op 2026-10-19, via de zoektool. Echte merken staan hier alleen ter
vergelijking. Elke regel in deze tabel komt uit een zoeksamenvatting en draagt
daarom **(te controleren)**.

| Leider | Achter de betaalmuur | Wij | Bron |
|---|---|---|---|
| Moneybird | geen gratis plan meer; Compact zonder btw-aangifte en zonder bankkoppeling; betaalrekening als add-on | btw-reservering uit eigen facturen: ja (`belasting.js`). Aangifte indienen: nee, en dat is bewust (voorbehouden). Bankkoppeling: nee; het saldo geeft de ondernemer zelf op (`kas/saldo`) | https://helpcenter.moneybird.nl/nl/articles/207464-pakketten-in-moneybird (via zoektool, live te controleren) **(te controleren)** |
| Exact Online Premium (€299) | meerdere bedrijven, periode- en jaarafsluiting, concernrekeningschema, rekening-courant, Power BI | meerdere ondernemingen per eigenaar: ja. Concernrekeningschema en jaarafsluiting: nee | https://www.exact.com/nl/bedrijven/boekhouden/features-en-prijzen (via zoektool, live te controleren) **(te controleren)** |
| Dynamics 365 Finance Premium ($300) / Business Central | ERP voor concerns | grootboek: nee; dat is geen doel van Onderneming | https://www.microsoft.com/en-us/dynamics-365/products/finance/pricing (via zoektool, live te controleren) **(te controleren)** |
| Toast / Oracle Simphony (horeca, multi-locatie) | multi-locatie apart verkocht; centraal menu- en prijsbeheer; inkoop via xtraCHEF | multi-locatie: half. Concern kent vestigingen; de Mall-plekken delen één aanbod zonder prijs per plek (kop van `kern/mall/vestigingen.js`). Centraal menu over zaken: nee | https://pos.toasttab.com/products/multi-location-management, https://www.oracle.com/food-beverage/restaurant-pos-systems/simphony-pos/ (via zoektool, live te controleren) **(te controleren)** |

Wat de markt niet heeft, en wij wel:
- een fase die wordt afgeleid en nooit met de hand gezet;
- een simulatie waarin elke aanname een herkomst heeft;
- een oprichtingslijst die zegt dat hij niet volledig is;
- een aanvraag die langs een mens loopt.

Geen van de vergeleken pakketten begint vóór de oprichting (via de zoektool
niet gevonden).

---

## c. Analyse van het volledige domein

**Particulier.** Iemand met een idee: is er markt, wat kost het, welke
rechtsvorm, wat moet ik regelen. Er is nog geen klant, geen omzet en geen
personeel.

**Professioneel.** Een eenmanszaak of vof met klanten, facturen, btw,
voorraad en de eerste medewerker.

**Organisatie.** Een BV met meerdere vestigingen, of een holding met
dochters. Daar komen bij:
- bestuur;
- UBO;
- jaarrekening;
- intercompany;
- per vestiging een eigen vergunning en een eigen HACCP-dossier.

**Het tweede restaurant**, het voorbeeld van de eigenaar. Juridisch is het
meestal een tweede **vestiging** van dezelfde entiteit, of een nieuwe BV onder
een holding. Operationeel is het een tweede **operating unit** met een eigen
kassa, menu, team en HACCP. Op papier vraagt het een eigen
exploitatievergunning, een eigen alcoholvergunning met de leidinggevenden
erop, een eigen RI&E-onderdeel en een eigen rooster onder de cao.
Dezelfde onderneming, maar een tweede werkelijkheid. CONCERN.md legt dat al
vast: zes begrippen (concern, entiteit, registratie, vestiging, merk,
operating unit).

**Wettelijke en normatieve eisen** (domein-max.txt, 2026-10-19). De schrijver
heeft geen van deze primaire teksten zelf nagelezen; elke regel draagt
**(te controleren)** (workos.md par. 11). In functies en eindcontract staat zo'n
regel hooguit als signaal met dat label, nooit als weigering. De contantregel
van € 3.000 is uit deze kaart gehaald en komt pas terug na nalezing van de
bron (workos.md par. 11).

| Eis | Bron | Wat het voor Onderneming betekent |
|---|---|---|
| **(te controleren)** KVK-inschrijving: van 1 week vóór tot 1 week na de start | https://www.kvk.nl/starten/op-welke-datum-moet-ik-mijn-bedrijf-inschrijven-bij-kvk/ | termijnklok rond de startdatum; `ingeschreven` registreert, RTG schrijft niet in |
| **(te controleren)** UBO-wijziging binnen 1 week | https://www.kvk.nl/ubo/over-het-ubo-register/ | `bestuur-ubo.js`: bij een aandeelwijziging een klok van 7 dagen tonen, niet indienen |
| **(te controleren)** Btw-aangifte uiterlijk de laatste dag van de maand na het tijdvak; correcties tot €1.000 in de volgende aangifte | https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/btw_aangifte_doen_en_betalen/btw-aangifte-waar-moet-u-aan-denken/btw-aangifte-waar-moet-u-aan-denken | reservering bestaat; een termijnklok per tijdvak ontbreekt; indienen = `btw.indienen` voorbehouden |
| **(te controleren)** Jaarrekening: opmaken binnen 5 maanden (+5), deponeren binnen 8 dagen na vaststelling, uiterlijk 12 maanden. Grenzen van de klassen te controleren | https://www.kvk.nl/deponeren/uiterste-termijn-deponeren-jaarrekening/ | termijnklok per boekjaar voor een BV; klasse als `uitlegbaar` |
| **(te controleren)** Fiscale bewaarplicht 7 jaar, onroerend 10 jaar (art. 52 AWR) | https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/ondernemen/administratie/hoelang-moet-u-gegevens-bewaren | dossier, facturen en contracten niet hard verwijderen |
| **(te controleren)** Alcoholwet: vergunning van de gemeente; leidinggevenden 21+ met Verklaring Sociale Hygiëne, allen op de vergunning | https://ondernemersplein.kvk.nl/alcohol-verkopen/ | per vestiging: welke leidinggevende staat erop; koppelen aan `kern/persoonseis.js` (vakbewijs), niet zelf valideren |
| **(te controleren)** Exploitatievergunning horeca | https://ondernemersplein.kvk.nl/exploitatievergunning-horecabedrijf-aanvragen | per vestiging als oprichtingsstap; al in `PER_BRANCHE.restaurant` |
| **(te controleren)** HACCP/hygiënecode: koel ≤7 °C, warm ≥60 °C; KHN-formulieren 6 maanden bewaren | https://www.nvwa.nl/onderwerpen/voedselveiligheid/voedselveilig-werken-in-horeca-ambacht-en-retail/hoe-werk-ik-veilig/schoon-en-veilig, https://khn.nl/veelgestelde-vragen/hoe-lang-moet-ik-de-formulieren-van-de-hygienecode-voor-de-horeca-bewaren | eigenaar Horeca (`horeca-haccp.html`); Onderneming toont alleen "dossier per vestiging staat / staat niet" |
| **(te controleren)** Allergenen (EU 1169/2011): 14, beschikbaar vóór aankoop | https://www.nvwa.nl/onderwerpen/voedselveiligheid/voedselveilig-werken-in-horeca-ambacht-en-retail/hoe-werk-ik-veilig/allergenen | eigenaar Horeca (`kern/horeca/safety.js`); eersteklant-stap "menu met allergenen" |
| **(te controleren)** Cao Horeca: rooster minstens 3 weken vooraf; cao tot 31-12-2026; toeslagen te controleren | https://khn.nl/kennis/roosterprogramma-en-handleiding-2026 | eigenaar Team Room/Vrijheid; Onderneming toont de stand per vestiging |
| **(te controleren)** Minimumloon 21+ €14,99 (per 1-7-2026) | https://www.rijksoverheid.nl/onderwerpen/minimumloon/bedragen-minimumloon/bedragen-minimumloon-2026 | simulatie-aanname voor personeelskosten met herkomst en datum |
| **(te controleren)** RI&E verplicht (vrijstelling bij ≤25 medewerkers met een erkend branche-instrument) | https://www.nlarbeidsinspectie.nl/onderwerpen/aanleveren-rie/veelgestelde-vragen-rie | stap bij fase "werkgever" |
| **(te controleren)** Betaaltermijn B2B max. 60 dagen, 30 zonder afspraak | https://ondernemersplein.kvk.nl/betalingstermijn-incassokosten-en-wettelijke-rente/ | `debiteuren.js`: vervallen facturen tegen die termijn tonen |
| **(te controleren)** European Accessibility Act: webwinkels sinds 28-6-2025; micro-onderneming uitgezonderd | https://www.acm.nl/en/accessibility/accessibility-e-commerce-services-and-electronic-communications-services | bij een webwinkel via Sitemaker: de uitzondering tonen op basis van grootte (klasse `uitlegbaar`) |

**Wat dat betekent voor software.** Onderneming is een **termijn- en
stand-app**. Ze rekent welke klokken lopen per entiteit en per vestiging, laat
zien wat er al staat, en wijst door naar de eigenaar. Ze bezit de operatie
niet: dat doen Horeca, Werk OS en Team Room. Ze dient niets in.

---

## d. Functiecatalogus L1–L6

### L1 Persoonlijk (idee en verkenning)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Werktitel en intake | bestaat (`nieuw`, `intake`) | intake persoon/idee | idem op object, 409 bij afwijking | — | eigenaar | eigen account | ander lid 404 | Een idee staat één keer op mijn naam, ook na een dubbele tik. | — | bestaat |
| Verkenning (kans, simulatie, stress, plan) | bestaat (`verkenning`) | aannames met herkomst | 12 maanden, 3 scenario's; elke stap mag falen zonder de rest | simulatie = `scenario.doorrekening` (advies), maar draagt die klasse niet zichtbaar | eigenaar | eigen | buitenlandse rechtsvorm: geen NL-sommen | Elk getal in de verkenning noemt of ik het invulde of dat het een aanname is, met de klasse advies. | klein (klasse tonen) | nu: herstel (een doorrekening zonder zichtbare klasse breekt de huisregel "een voorspelling is nooit een feit") |
| Rechtsvormkeuze | bestaat (`rechtsvorm`, 4 registers) | `rechtsvorm*.js` | gevolgen, geen advies | AI geeft afwegingen, geen besluit (`ontwerper.js`) | eigenaar | eigen | — | Bij elke vorm staan de gevolgen en "vraag de KvK of een adviseur". | — | bestaat |

### L2 Professioneel (oprichting en eerste klant)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Oprichtingsproject | bestaat (`oprichting.js`) | rechtsvorm + branche + situatie | zonder rechtsvorm geen lijst | "niet juridisch volledig" in het antwoord | eigenaar | eigen | — | De lijst zegt zelf dat hij niet volledig is. | — | bestaat |
| Termijnklokken (KVK ±1 week, UBO 1 week, btw per tijdvak, jaarrekening) | ontbreekt | startdatum, aandeelwijziging, tijdvak, boekjaar | datum + termijn; geen indiening | jaarrekeningklasse `uitlegbaar` | eigenaar, 14 en 3 dagen vooraf | eigen; bestuurder ziet bij BV | buitenland: geen NL-klok, met reden | Op het dagbeeld staat elke termijn als signaal met resterende dagen, de bron-URL en het label "te controleren" zolang niemand de primaire tekst heeft nagelezen; er is geen knop "indienen" en een termijn blokkeert niets. | middel | nu: verdieping |
| Aanvraag naar zaak | bestaat (`aanvraag.js`) | plan + intake | gewone aanmelding, mens beslist | — | kantoor | eigen | plan niet vastgelegd: 409 | De aanvraag ligt bij een mens; er ontstaat geen zaak vanzelf. | — | bestaat, onbewezen |
| Eerste klant klaar | bestaat (`eersteklant.js`) | capslijst | telling, geen weging | — | eigenaar | eigen | horeca zonder menu: niet klaar | Een horecazaak zonder menu staat op "niet klaar" met de ontbrekende stap. | — | bestaat |
| Fiscale klasse in plaats van `zeker: true` | half | `belasting.js` | `reservering.btw` = bepaald, `reservering.winst` = advies uit `zekerheid.js` | — | eigenaar | eigen | buitenlandse rechtsvorm, BV: geen bedrag | De btw-regel draagt "bepaald" en de winstreservering "advies", met de zin van die klasse. | klein | nu: herstel (eigen `zeker: true` naast de klassen) |

### L3 Organisatorisch (vestigingen en groep)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Fase leest Concern | ontbreekt (leest Mall-plekken en eigen ondernemingen) | `kern/concern/vestiging.js` (open vestigingen van de entiteit), `entiteit.js` | vestigingen = open Concern-vestigingen; groep = ≥ 2 Concern-entiteiten onder de eigenaar | onderneming zonder entiteit: oude telling met de reden "niet aan concern gekoppeld" | eigenaar | eigen; Concern-poort | Mall-plekken blijven vindbaarheid, geen vestiging | Een tweede restaurant als vestiging van dezelfde BV zet de fase op "meerdere vestigingen" en niet op "groep". | klein | nu: herstel (verkeerde bron, fase klopt niet) |
| Tweede vestiging openen (dossier) | half: Concern heeft vestiging + operating unit; Onderneming kent één `supplierCode` | concern vestiging, nieuwe zaak via aanmelding | per vestiging een oprichtingslijst uit `PER_BRANCHE` (vergunningen) + readiness (`concern/readiness.js`) | vergunningstand is wat de ondernemer opgeeft, RTG valideert niets | eigenaar, bestuurder | eigenaar entiteit | nieuwe BV i.p.v. vestiging: route via holding (ingang 3, bestaat niet) | Ik open "tweede vestiging" en zie per vestiging welke vergunning, welk HACCP-dossier en welk team er staan of ontbreken. | middel | nu: verdieping (lezen van bestaande Concern + Horeca) |
| Vergelijkbeeld per vestiging | ontbreekt (feiten-dwars 5) | omzet, bezetting, HACCP-gaten per zaak | alleen gemeten getallen; geen ranglijst op medewerkers | per vestiging `gemeten` of "niet gemeten" | eigenaar | eigenaar entiteit | — | Twee vestigingen staan naast elkaar met dezelfde maten, en wat niet gemeten is, staat er als niet gemeten. | middel | later |
| Structuur kopiëren naar nieuwe vestiging | ontbreekt (CONCERN par. 4) | rollen, caps, sjablonen van vestiging A | voorstel, vinkjes uit, mens bevestigt (vorm `dienstverbandInhaal`) | lokale afwijkingen | eigenaar | eigenaar entiteit | menu en prijzen: eigenaar Horeca | Een kopie is een voorstel; zonder keuze wordt niets aangemaakt. | groot | later |
| Bestuur, aandelen, UBO | bestaat, onbewezen (`bestuur*.js`) | bestuurders op codenaam | — | — | eigenaar | eigen | — | Een bestuurder staat op codenaam; een aandeelwijziging start de UBO-klok. | klein (klok) | later |
| Toegang over zaak en werkruimte | bestaat (`toegang.js`) | supplier_staff + bedrijf/rollen | leest, zet niets | — | eigenaar | eigen | — | Ik zie wie bij mijn bedrijf kan, en waar het gat zit. | — | bestaat |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Simulatie tweede vestiging | half: `simulatie.js` is per onderneming | cijfers vestiging 1 (gemeten) + aannames vestiging 2 | 12 maanden, 3 scenario's | klasse advies; aannames met herkomst | eigenaar | eigen | < 3 maanden data vestiging 1: alleen aannames, gezegd | De doorrekening van vestiging 2 zegt per getal of het gemeten is bij vestiging 1 of aangenomen. | middel | later |
| Kasvooruitblik | bestaat (`kas.js`, 30 dagen) | debiteuren, crediteuren, btw, saldo | eigen opgegeven saldo | geen bank: "beweging, geen stand" | eigenaar | eigen | — | Zonder saldo toont de vooruitblik alleen beweging, met die zin. | — | bestaat |
| Stresstest | bestaat (`stress.js`) | simulatie | blokkerende bevinding bovenaan dagbeeld | advies | eigenaar | eigen | — | Een blokkerende bevinding staat vóór elk ander actiepunt. | — | bestaat |
| Gemiste omzet | — | — | — | — | — | — | — | — | — | niet doen: verzinsel (`capaciteit.js`) |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Fase-as idee -> groep | bestaat (`fase.js`) | feiten | hoogste bereikte fase, nooit handmatig | null zonder feiten | — | — | — | De fase verandert alleen door feiten. | — | bestaat |
| Exploitatie als doorlopende stand | ontbreekt als begrip; staat in `draaiend.js` als kaart | dagbeeld | geen nieuwe fase; per vestiging "draait sinds" uit eerste omzet | — | eigenaar | eigen | — | Na de opening blijft één dossier bestaan; de oprichtingslijst wordt historie, niet weggegooid. | klein | later |
| Sluiten, overdragen, fusie | half: Concern `verandering.js` + `-eigendom.js` | entiteit | impact preview, rollback | — | eigenaar | eigenaar entiteit | KvK-uitschrijving extern | Een vestiging sluiten laat entiteit en dienstverbanden staan (CONCERN par. 4). | — | bestaat in Concern |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Contracten uit Werk OS | bestaat, lezend (`contracten.js`) | werkruimtecode | gedeelde klok | geen werkruimte = "weten wij niet"; geen lid meer = `geen-toegang` | dagbeeld | alleen een actief lid met eigen `rtgKey` | — | Alleen een werkruimte waarvan ik actief lid ben, laat haar contracten op mijn dagbeeld zien. | — | herstel: gerepareerd (commit d9fd905) |
| Concern wijst onderneming aan | bestaat (`/api/concern/entiteit/onderneming`) | entiteit | één kant op | — | — | eigenaar entiteit | — | De entiteit verwijst naar de onderneming; er wordt niets gekopieerd. | — | bestaat |
| Werkvloer ziet onderneming | bestaat (`zaakkant.js`) | positieve veldlijst | leest | — | zaak | supplierAuth | — | De zaak ziet alleen de velden in de positieve lijst. | — | bestaat |
| Horeca-stand per vestiging | ontbreekt | HACCP-gaten, allergenen, rekeningen per zaakcode | Horeca bezit; Onderneming toont teller + link | "niet gemeten" als Horeca uit staat | eigenaar | managerOnly bij Horeca | — | Per vestiging staat of de HACCP-reeks een gat heeft, met een link naar Horeca. | klein | later |
| Aanname -> dienstverband | bestaat (`concern/aanname.js`) | vestiging van de zaak | brug één kant op | zaak zonder entiteit: reden | — | — | — | Een aanname bij vestiging 2 maakt een dienstverband bij dezelfde entiteit. | — | bestaat |

### Modus LOS

De kerntaak met Concern, Horeca, Werk OS, Mall en Geld uit: idee, verkenning,
plan, rechtsvorm, oprichtingslijst, inschrijving registreren en de kas op het
eigen saldo. Dat staat volledig in `server/kern/onderneming/`. Elke groep
hieronder noemt de letterlijke schermtekst als dat deel ontbreekt. "(bestaat)"
staat zo in de code; "(voorstel)" is de zin die er moet komen. Doelgroep:
het lid als ondernemer, in de u-vorm die de code al gebruikt.

**1. Eigen: wat Onderneming zelf bezit en altijd kan.** Het
ondernemingsobject (collectie `ondernemingen`), intake, verkenning
(kans, simulatie, stress, plan), rechtsvorm, oprichtingslijst, fase, kas op
opgegeven saldo en het dagbeeld.
- Geen saldo opgegeven (`kas.js`): "Wij zien uw bankrekening niet, dus dit is
  een beweging en geen kaspositie." (bestaat)
- Saldo oud (`kas.js`): "Dit saldo is <n> dagen oud. Er is sindsdien van alles
  gebeurd dat wij niet zien; werk het bij voordat u erop stuurt." (bestaat)
- Plan nog niet vastgelegd (`dagbeeld.js`): "Er ligt nog geen doorgerekend
  plan." (bestaat)
- Doorrekening zonder zichtbare klasse: "Dit is een doorrekening op aannames
  (advies), geen voorspelling die uitkomt." (voorstel; zie herstel L1)

**2. Noodzakelijke platformdiensten.**
- Account en sessie: lidsessie; een ander lid krijgt "Deze onderneming staat
  niet op uw naam." (bestaat, `routes/member/onderneming.js`).
- Opslag: `kern/eigencollectie`.
- Fiscale klassen: `kern/fiscaal/zekerheid.js`.
- Identiteit en vakbewijs: `kern/persoonseis.js` voor de leidinggevende op een
  vergunning.

Schermtekst als een van deze ontbreekt:
- sessie verlopen: "U bent niet meer ingelogd. Log opnieuw in; uw onderneming
  is niet gewijzigd." (voorstel)
- persoonseis niet te lezen: "Wij kunnen nu niet nagaan welke vakbewijzen er
  zijn afgetekend. De stap blijft open; er is niets gewijzigd." (voorstel)

**3. Optionele koppelingen: andere apps.**
- Werk OS, geen werkruimte gekoppeld (`contracten.js`): "Zonder koppeling
  weten wij niet of u contracten heeft; dit is geen bevestiging dat er niets
  loopt." (bestaat)
- Werk OS, geen actief lid meer (`contracten.js`, sinds d9fd905): "U bent geen
  actief lid meer van de gekoppelde werkruimte (<code>), dus wij tonen haar
  contracten niet." (bestaat)
- Werk OS, werkruimte opgeheven: "De gekoppelde werkruimte (<code>) bestaat
  niet meer." (bestaat)
- Concern niet gekoppeld: nu stil 0 vestigingen (fout, zie a.). Gewenst:
  "Vestigingen: niet aan Concern gekoppeld. Wij tellen geen vestigingen die
  wij niet zien." (voorstel)
- Zaak (Horeca of leverancier) nog niet aanwezig: geen gezondheidscijfer
  (`dagbeeld.js`, gelezen; de reden staat als commentaar in de code). Gewenst:
  "U heeft nog geen zaak, dus er is nog geen gezondheidscijfer." (voorstel)
- Aanvraag naar een zaak (`aanvraag.js`): "Uw aanvraag staat op de stapel. Een
  medewerker van RTG beoordeelt hem; wij kennen zelf geen toegang toe."
  (bestaat)

### Modus SAMEN: het contractblok (voorstel)

Een VOORSTEL in de vorm van CONTRACT uit `scripts/lib/appcontract.js`; dat
bestand verandert niet. `belofte`, `ingang` en `bestanden` zijn CONTRACT-velden;
`eigenaar` is de SCHERMEIGENAAR-capability van de kant waar de gegevens wonen.

```js
samen: {
  functie: 'link:onderneming', familie: 'WorkOS',
  belofte: 'een ondernemer met een draaiende BV opent een tweede vestiging: de doorrekening zegt per getal of het gemeten is bij vestiging 1 of aangenomen, Concern legt de vestiging vast en de fase gaat naar vestigingen en niet naar groep, de vergunningstappen per vestiging staan open tot hij ze afvinkt, en de opzegdag van het nieuwe huurcontract staat op zijn dagbeeld',
  ingang: '/apps/onderneming.html',
  bestanden: ['public/apps/onderneming.html'],
  scenario: 'scripts/lib/voltooi/onderneming.js',
  ketens: [
    { naam: 'opzegdag uit Werk OS', uitgeeft: 'niets', ontvangt: 'contracten met klok van de gekoppelde werkruimte',
      vorm: 'projectie', eigenaar: 'werk.organisatie', toestemming: 'alleen een actief lid met eigen rtgKey (sinds d9fd905)',
      storingen: ['geen werkruimte: aantal null', 'geen lid meer: stand geen-toegang', 'werkruimte opgeheven: stand werkruimte-weg'],
      proef: 'test/onderneming-contracten.test.js' },
    { naam: 'vestigingen en entiteiten uit Concern', uitgeeft: 'niets', ontvangt: 'open vestigingen en entiteiten van de eigenaar',
      vorm: 'projectie', eigenaar: 'werk.concern', toestemming: 'eigenaar entiteit = eigenaar onderneming',
      storingen: ['geen entiteit: "niet aan Concern gekoppeld", nooit 0', 'tweede onderneming-object: geen groep zonder tweede entiteit'],
      proef: 'nieuwe stap in scripts/lib/voltooi/onderneming.js (faalt naar verwachting tot de herstel van beeld.js)' },
    { naam: 'aanvraag wordt zaak', uitgeeft: 'aanmelding met plan en branche', ontvangt: 'supplierCode na menselijk besluit',
      vorm: 'gebeurtenis', eigenaar: 'zaak.beheer', toestemming: 'een medewerker van RTG beslist; nooit automatisch toegang',
      storingen: ['plan niet vastgelegd: 409 met uitleg', 'al een aanvraag: 409', 'nog niet beoordeeld: "Uw aanvraag staat op de stapel"'],
      proef: 'niet gevonden in de voltooiproef; voorstel: stap aanvraag -> stand' },
    { naam: 'leidinggevende op de vergunning', uitgeeft: 'niets', ontvangt: 'afgetekend vakbewijs van de persoon',
      vorm: 'verwijzing', eigenaar: 'identiteit.bewijzen', toestemming: 'het nummer blijft in de kluis; Onderneming ziet alleen afgetekend of open',
      storingen: ['stuk ingediend maar niet afgetekend: stap blijft open', 'stuk verlopen: stap gaat terug naar open'],
      proef: 'test/persoonseis.test.js dekt de eis; de koppeling aan een vestiging: niet gevonden' },
    { naam: 'HACCP-stand per vestiging', uitgeeft: 'niets', ontvangt: 'teller van gaten in de meetreeks per zaakcode',
      vorm: 'projectie', eigenaar: 'horeca.haccp', toestemming: 'eigenaar van de zaak',
      storingen: ['Horeca uit: "niet gemeten"'],
      proef: 'niet gevonden; voorstel' }
  ]
}
```

Over `identiteit.bewijzen` als eigenaar van het vakbewijs: de code woont in
`server/kern/persoonseis.js` en `server/kern/vakbewijs.js`; of
`identiteit.bewijzen` de juiste SCHERMEIGENAAR-capability is, staat onder
"Vraagt besluit".

### Modus SAMEN: Daan opent zijn tweede restaurant

Daan heeft Restaurant Brisa (BV, één zaak, gekoppeld aan zijn onderneming en
aan een Concern-entiteit).

| Stap | Wat gebeurt er | Eigenaar en bron |
|---|---|---|
| 1 | Daan rekent vestiging 2 door: huur, personeel tegen minimumloon (aanname met datum), omzet uit vestiging 1 als referentie. | Onderneming, `simulatie.js` (klasse advies) |
| 2 | Hij legt het besluit vast in Werk OS: onderbouwing, adviesronde met zijn compagnon, bezwaar ("te dichtbij") blijft staan, evaluatiedatum. | Werk OS, `bedrijf/besluit.js` |
| 3 | In Concern maakt hij vestiging 2 onder dezelfde BV. | Concern, `kern/concern/vestiging.js` |
| 4 | De nieuwe zaak (operating unit) komt er via een aanmelding met een mens. | `aanmeldingen`, `aanvraag.js`-vorm |
| 5 | Het oprichtingsdossier van vestiging 2 toont exploitatievergunning, alcoholvergunning (welke leidinggevende staat erop), HACCP-plan en NVWA-melding als open stappen. Daan zet ze zelf op gedaan. | Onderneming (`PER_BRANCHE`), `persoonseis.js` voor de leidinggevende |
| 6 | Het huurcontract komt in Werk OS met de klok. De opzegdag verschijnt op het dagbeeld. | Werk OS `contract.js`, Onderneming `contracten.js` |
| 7 | Hij werft een chef. De aanname maakt een dienstverband bij de BV. | werving, `concern/aanname.js` |
| 8 | Het rooster van de chef staat 3 weken vooraf. | Team Room / Vrijheid |
| 9 | Opening: Horeca draait. Het dagbeeld toont twee vestigingen met elk hun eigen gemeten getallen. | Horeca, Onderneming |

Storingen in deze keten:

| Storing | Wat de gebruiker ziet | Wat bewaard blijft |
|---|---|---|
| Fase blijft "werkgever" na stap 3 | **nu**: geen melding (fout, a.); **gewenst**: "vestigingen: 2 (Concern)" | vestiging in Concern |
| Daan maakt uit gewoonte een tweede onderneming-object | **nu**: fase "groep"; **gewenst**: "deze eigenaar heeft één entiteit; een tweede onderneming is geen tweede BV" | beide objecten |
| Aanmelding nog niet beoordeeld | "Uw aanvraag staat op de stapel. Een medewerker van RTG beoordeelt hem; wij kennen zelf geen toegang toe." (`aanvraag.js`) | aanmelding |
| Leidinggevende zonder VSH | de stap blijft open met wat ontbreekt (`persoonseis`); RTG valideert het document niet | ingediend stuk, niet afgetekend |
| Werkruimte niet gekoppeld | contracten: "weten wij niet", aantal `null` | — |
| Daan is geen actief lid meer van de werkruimte | stand `geen-toegang` met de reden (sinds d9fd905) | de koppeling op het object; de contracten in Werk OS |
| Concern uit of onbereikbaar | vestigingen "niet gemeten" | Onderneming-object |
| Dubbele tik op "nieuw" | één object (idem, 409 bij afwijking) | eerste object |
| Horeca offline bij opening | de kassa werkt offline (Horeca sync); het dagbeeld toont omzet pas na sync | de offline handelingen |

---

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Eén dossier van idee tot tweede vestiging, waarin het besluit, het contract, de vergunningstappen, het dienstverband en de kassa elkaar kennen | Onderneming (`werk.onderneming`), met Werk OS, Concern, Horeca | `draaiend.js`, `contracten.js`, `concern/aanname.js`, `zaakkant.js` | Bij de markt zijn starterstool, boekhouding, contractregister, HR en kassa vijf leveranciers. |
| De leidinggevende op de alcoholvergunning als vakbewijs op de persoon, gekoppeld aan de vestiging | Onderneming toont, `kern/persoonseis.js` bezit | `persoonseis.js`, `vakbewijs.js` | Een kassapakket kent de juridische eis aan een persoon niet; een HR-pakket kent de vestiging niet. |
| Een aanname bij vestiging 2 die meteen een dienstverband bij de juiste BV maakt | Concern | `concern/aanname.js` | Werving en juridische entiteit zijn bij de markt gescheiden (ARBEID par. 3). |
| De simulatie van vestiging 2 op gemeten cijfers van vestiging 1, met herkomst per getal | Onderneming | `simulatie.js` + Horeca-data | Planners rekenen op invoer; hier op een eigen kassa met codenamen. |

---

## f. Bouwstenen en ontbrekende koppelingen

**Bestaande bouwstenen:**
- `server/kern/onderneming/fase.js`, `beeld.js`, `oprichting.js`,
  `simulatie.js`, `contracten.js`, `dagbeeld.js`;
- `server/kern/concern/vestiging.js`, `entiteit.js`, `readiness.js`,
  `aanname.js`;
- `server/kern/persoonseis.js`;
- `server/kern/fiscaal/zekerheid.js`;
- `server/bedrijf/contractklok.js`.

**Ontbrekende koppelingen**

| Van -> naar | Vorm | Toestemming |
|---|---|---|
| Concern vestiging/entiteit -> `ondernemingFeiten` | projectie (lezen) | eigenaar entiteit = eigenaar onderneming |
| onderneming -> werkruimte | verwijzing **met** bewijs van lidmaatschap (`rtgKey` op werkruimtelid) | lid of beheerder van die werkruimte |
| Horeca HACCP-gaten -> dagbeeld per vestiging | projectie (teller) | eigenaar zaak |
| oprichtingslijst per vestiging | verwijzing vestiging-id op stap | eigenaar |
| `belasting.js` -> `zekerheid.js` | verwijzing naar klasse | — |

---

## g. Prioritering

De oude bak "aanbevolen nu" is gesplitst in **herstel** (fouten, verkeerde
bron, ontbrekende klasse, rolgrenzen, wat het scherm belooft maar niet doet)
en **verdieping** (nieuwe premiumdiepte binnen de huidige scope).

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Werkruimte koppelen alleen met lidmaatschap | — | — | — | herstel: gerepareerd (commit d9fd905, `test/onderneming-contracten.test.js`) |
| Fase leest Concern-vestigingen en -entiteiten (geen Mall-plekken, geen tweede onderneming-object als groep) | klein | laag | `concern/vestiging.js`, besluit 1 | nu: herstel |
| Fiscale klasse uit `zekerheid.js` in `belasting.js` en `simulatie.js` (eigen `zeker: true` eruit) | klein | laag | geen | nu: herstel |
| Zonder Concern "niet gekoppeld" in plaats van stil 0 | klein | laag | `beeld.js` | nu: herstel |
| BEVOEGD over alle 39 `/api/onderneming/*` (nu 1 gemeten, 1 open) | middel | middel | bestaande BEVOEGD-meting | nu: herstel |
| Termijnklokken KVK/UBO/btw/jaarrekening op dagbeeld, als signaal met label "te controleren" | middel | middel | rechtsvorm, bestuur | nu: verdieping |
| Tweede-vestigingsdossier (lezen Concern + oprichtingslijst per vestiging + persoonseis leidinggevende) | middel | middel | Concern, `persoonseis.js`, besluit 1 | nu: verdieping |
| Vergelijkbeeld per vestiging | middel | middel | Horeca | later |
| Simulatie tweede vestiging op gemeten cijfers | middel | middel | Horeca-data | later |
| Horeca-stand per vestiging op dagbeeld | klein | laag | Horeca | later |
| Structuur kopiëren | groot | hoog | CONCERN par. 4 | later |
| Exploitatie als doorlopende stand | klein | laag | besluit 4 | later |
| Ingang 3 (holding) en 4 (uitgenodigd) | groot | hoog | CONCERN | vraagt besluit |
| Aangifte of inschrijving namens de ondernemer | — | — | — | niet doen: voorbehouden |
| Gemiste omzet | — | — | — | niet doen: verzinsel |

---

## h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | Idee, oprichting, eerste klant, werkgever en vestigingen zijn elk met echte feiten bereikbaar | `scripts/lib/voltooi/onderneming.js` uitbreiden per fase | idee tot ingeschreven ja; verder niet |
| Professionele diepte | Elke termijn uit c. staat als klok met bron-URL en het label "te controleren", als signaal dat niets blokkeert | toets per klok (en een toets dat geen klok een handeling weigert) | 0 klokken |
| Levenscyclus | Een tweede vestiging verschuift de fase naar "meerdere vestigingen" en niet naar "groep" | nieuwe proefstap via Concern | faalt naar verwachting (gelezen) |
| Samenwerking en rollen | Een ander lid kan geen onderneming lezen, en geen werkruimte koppelen waar hij geen lid van is | proef + BEVOEGD | eerste deel ja (voltooiproef); tweede deel ja sinds d9fd905 (`test/onderneming-contracten.test.js`); BEVOEGD 1 van 39 routes gemeten |
| Domeinintelligentie | Elke doorrekening draagt klasse advies, elke btw-regel klasse bepaald | toets op klasse in het antwoord | eigen `zeker`-vlag, geen klasse |
| Los functioneren | Met Concern, Horeca en Werk OS uit zegt elk blok "niet gekoppeld" en nooit 0 | proef met uitgeschakelde bronnen | contracten ja; vestigingen nee |
| RTG-ketens | De vijf ketens uit het `samen`-blok lopen elk met hun storingen, en de keten "tweede restaurant" (d.) in één proef | nieuw scenario | 1 van 5 beproefd (opzegdag uit Werk OS) |
| Bewezen betrouwbaarheid | APPWERKT acht bewijzen B | APPWERKT.json | 3 van 8 B; lokaal 4/4 gesloten, centraal te stempelen |

Dit contract vervangt de acht bewijzen van APPWERKT niet.

---

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

**HERSTEL**

| Functie | Kosten | Bouwt op | Stand |
|---|---|---|---|
| Werkruimtekoppeling alleen voor een actief lid | — | `kern/onderneming/contracten.js`, `bedrijf/aansluiting.js` (`rtgKey`) | gerepareerd (commit d9fd905) |
| Fase leest Concern | klein | `fase.js`, `beeld.js`, `kern/concern/vestiging.js` | open |
| Fiscale klassen in plaats van `zeker: true` | klein | `kern/fiscaal/zekerheid.js` | open |
| Zichtbare klasse `advies` op de verkenning | klein | `simulatie.js`, `zekerheid.js` | open |
| "Niet aan Concern gekoppeld" in plaats van 0 | klein | `beeld.js` | open |
| BEVOEGD over alle onderneming-routes | middel | bestaande BEVOEGD-meting | open |

**VERDIEPING**

| Functie | Kosten | Bouwt op | Bak |
|---|---|---|---|
| Termijnklokken als signaal, label "te controleren" | middel | `rechtsvorm.js`, `bestuur-ubo.js`, `contractklok.js`-vorm | nu |
| Tweede-vestigingsdossier | middel | `oprichting.js` `PER_BRANCHE`, `concern/readiness.js`, `persoonseis.js` | nu |
| Vergelijkbeeld per vestiging, simulatie op gemeten cijfers, Horeca-stand | middel | Horeca-routes, `simulatie.js` | later |
| Exploitatie als doorlopende stand | klein | `draaiend.js`, `dagbeeld.js` | later |

### (B) Het domeinmaximum, ook buiten de huidige scope

Dit is richting en geen toezegging. Wat buiten scope valt, staat als besluit.

**Proces 1: Horecaonderneming van idee tot keten.**

Stappen:
1. Idee en locatieverkenning.
2. Plan en financiering.
3. Rechtsvorm.
4. Notaris (extern).
5. KvK (extern).
6. Huur.
7. Vergunningen bij gemeente en NVWA (extern).
8. Verbouwing.
9. Inkoop.
10. Werving.
11. HACCP.
12. Soft opening.
13. Exploitatie.
14. Tweede vestiging.
15. Holding.
16. Overdracht of franchise.

Rollen en organisaties:
- intern: ondernemer, compagnon, bestuurder, chef, leidinggevenden (VSH);
- buiten: accountant, notaris, gemeente, NVWA, bank, verhuurder, aannemer.

Apps en eigenaren:
- Onderneming (dossier, eigenaar);
- Concern (entiteit, vestiging);
- Werk OS (besluit, contract, uitgave, project verbouwing);
- Horeca (operatie, HACCP);
- Team Room (rooster);
- Loonstrook;
- Sitemaker (website);
- Mall (vindbaarheid);
- Geld;
- RTDocs (stukken).

Nodig buiten scope:
- financiering of een bankkoppeling (extern, besluit; RTG verplaatst geen
  geld);
- de verbouwing als aannemerstraject: het aannemersgenre en Project Room-
  samenwerking voor klanten (besluit, want Project Room is nu intern);
- franchise als eigen relatievorm (nieuw domein);
- centraal menu- en prijsbeheer over zaken (verbouwing van de Supplier OS,
  volgens de kop van `kern/mall/vestigingen.js`).

**Proces 2: Zzp'er naar eerste werkgever.**

Stappen:
1. Eenmanszaak.
2. Klanten.
3. Btw-ritme.
4. Capaciteit vol.
5. Eerste aanname.
6. Loonheffing (extern indienen).
7. RI&E.
8. Verzuimbegeleiding.
9. Eventueel omzetting naar een BV.

Apps en eigenaren:
- Onderneming;
- werving en Concern;
- Loonstrook / payroll;
- Team Room.

Nodig buiten scope:
- de omzetting van rechtsvorm als traject (besluit; notaris extern);
- een arbodienstkoppeling (extern).

**Proces 3: Groepsstructuur en governance.**

Stappen:
1. Holding.
2. Dochters.
3. Bestuurders en volmachten.
4. Besluiten buiten vergadering (art. 2:238 BW).
5. Jaarrekening per entiteit.
6. Consolidatie.
7. Intercompany.
8. Overname of fusie.

Apps en eigenaren:
- Concern (graaf, verandering);
- Werk OS (besluit, tekengrens);
- Onderneming (fase groep).

Nodig buiten scope:
- ingang 3 (holding) uit CONCERN par. 1;
- een grootboek of consolidatie (nieuw domein of externe boekhouding,
  besluit);
- een AVA-besluitvorm met "alle gerechtigden" (besluit).

---

## Productfouten gezien

**Gerepareerd**
- **Werkruimte koppelen zonder lidmaatschap** (`server/kern/onderneming/contracten.js`,
  `ondernemingWerkruimte`, via `POST /api/onderneming/werkruimte` in
  `server/routes/member/onderneming-geld.js`). Elk lid met een onderneming kon
  elke bestaande werkruimtecode koppelen en daarna de contracten lezen, en
  codes waren op te sommen (200 tegen 404). Gerepareerd in commit d9fd905:
  alleen een actief lid met zijn eigen `rtgKey` koppelt, een vreemde
  werkruimte krijgt hetzelfde 404 als een onbekende, en wie vertrekt ziet
  stand `geen-toegang`. Toets: `test/onderneming-contracten.test.js`.

**Nog open (gelezen, niet beproefd; niet gerepareerd)**

1. **Vestigingen en entiteiten uit de verkeerde bron.**
   - Plaats: `server/kern/onderneming/beeld.js`, `ondernemingFeiten`.
   - `vestigingen` komt uit de Mall-plekken (`supplier.vestigingen`, regel 52)
     en `entiteiten` uit het aantal ondernemingen van de eigenaar (regel 61).
     Concern wordt niet gelezen.
   - De fase "groep" kan ontstaan zonder tweede rechtspersoon, en "meerdere
     vestigingen" blijft uit bij echte Concern-vestigingen.
2. **Eigen zekerheidsvlag.**
   - Plaats: `server/kern/onderneming/belasting.js` regel 160.
   - Daar staat een eigen `zeker: true` naast de klassen van
     `kern/fiscaal/zekerheid.js`. AGENTS.md noemt de vier klassen als de
     indeling voor fiscale uitkomsten.
3. **Nieuw: "vandaag" in UTC.**
   - Plaats: `server/kern/onderneming/contracten.js`, `contracten()`: zonder
     meegegeven datum is `vandaag` `new Date().toISOString().slice(0, 10)`.
   - Tussen middernacht en 01:00 of 02:00 Nederlandse tijd rekent de klok dan
     met gisteren: een opzegdag die vandaag verstrijkt, kan een dag te lang als
     "nog te doen" staan. Dezelfde soort fout als bij partnernetwerk
     (workos.md par. 9). De route `/api/onderneming/contracten`
     (`server/routes/member/onderneming-geld.js` regel 51) geeft geen datum
     mee; het dagbeeld wel (`server/kern/onderneming/index.js` regel 167).
     Hoe het dagbeeld zijn `vandaag` rekent, is niet nagegaan.

---

## Vraagt besluit

1. **Wat is een tweede restaurant in het model?**
   - (a) **Aanbevolen**: een Concern-vestiging met een eigen operating unit
     (zaak). De onderneming blijft één object. Fase en dagbeeld lezen Concern.
     Kosten: klein tot middel.
   - (b) Een tweede onderneming-object per zaak. Kosten: geen bouw. De fase
     "groep" is dan fout, en het dossier valt in tweeën.
   - (c) De onderneming krijgt een lijst `supplierCodes`. Kosten: middel. Een
     tweede waarheid naast Concern-vestigingen (lat-regel 4).
2. **Ingang 3 (holding) en 4 (uitgenodigd) uit CONCERN par. 1.**
   - (a) **Aanbevolen**: na V1, als besluit. Ingang 4 is in feite de werkkiezer
     (`os:werk`) plus de uitnodiging, en vraagt geen nieuw domein. Kosten:
     klein voor 4, groot voor 3.
   - (b) Beide nu. Kosten: groot, en het is een nieuw domein vóór V1.
   - (c) Nooit. Kosten: geen. Groepen blijven buiten Onderneming.
3. **Wie herstelt de werkruimtekoppeling?** Beslist en uitgevoerd: optie (a),
   Onderneming toetst lidmaatschap via de bestaande `rtgKey` (commit d9fd905).
   Deze vraag staat er alleen nog als verslag.
4. **Komt er een exploitatiefase?**
   - (a) **Aanbevolen**: nee. Exploitatie is geen fase maar de doorlopende
     stand van elke fase na `eersteklant`. Het dossier toont per vestiging
     "draait sinds". Kosten: klein.
   - (b) Ja, een fase tussen `oprichting` en `eersteklant`. Kosten: klein, maar
     het verandert de afgeleide ladder voor alle bestaande ondernemingen.
5. **Wie is in SCHERMEIGENAAR de eigenaar van het vakbewijs dat Onderneming
   per vestiging toont?**
   - (a) **Aanbevolen**: `identiteit.bewijzen` (`apps/bewijsmap.html`), omdat
     het lid daar zijn stukken ziet; de regels blijven in
     `server/kern/persoonseis.js` en `server/kern/vakbewijs.js`. Kosten: geen
     bouw, één regel in SCHERMEIGENAAR.
   - (b) Een eigen capability voor vakbewijs. Kosten: klein, maar een extra
     eigenaar naast de bewijsmap.
   - (c) Geen eigenaar noemen; Onderneming verwijst naar de kern. Kosten: geen.
     De keten in het `samen`-blok heeft dan geen eigenaar.
