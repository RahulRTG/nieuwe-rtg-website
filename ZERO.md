# Zero

_Wanneer RTG "nul" mag zeggen, en wat er nodig is om dat te blijven kunnen._

Dit programma is geen schoonmaakronde. Een codebase die op één dag schoon is,
is drie maanden later weer vuil, en dan heeft niemand iets fout gedaan. Het
doel is anders. Na afloop moet RTG zijn technische schuld kennen, haar bestaan
kunnen bewijzen, haar afwezigheid kunnen bewijzen, en kunnen voorkomen dat
dezelfde schuld stil terugkomt.

**Bestaande schuld is trainingsmateriaal.** Elke schuld die weggaat, laat een
betere meter of een strengere poort achter. Doet ze dat niet, dan is ze alleen
verplaatst.

De nulmeting (6 oktober 2026, commit `6c4d38ac`) staat buiten de repository in
het sessieverslag. Dit document legt vast wat uit die meting volgde en wat
daarmee regel is.

---

## 1. Vier eigenschappen, en ze worden niet opgeteld

| Eigenschap | Wat ze zegt | Wie haar vandaag draagt | Wat er ontbreekt |
|---|---|---|---|
| **ZERO-DEBT** | Binnen de bewezen scope is er geen bekende schuld waarvoor een geldige meter bestaat. | `NORM.json` met `scripts/norm.js` (de ratel), `scripts/deltapoort.js` (nieuw werk op de norm), `scripts/normverval.js` (geen verlaging zonder reden en einde) | Ongeveer 43 ratels staan buiten NORM.json, verspreid over toetsen en scripts. Er is geen centrale inventaris. |
| **ZERO-DRIFT** | Gegenereerde waarheid kan niet ongemerkt achterlopen op de code waarover ze iets zegt. | `scripts/versheid.js`, `scripts/getallen.js` (merktekens in documenten), stempels op registers | `versheid` draait niet in ci.yml en stond bij de nulmeting rood. Geen register stond op HEAD. Getallen in documenten zonder merkteken worden door niets bewaakt. |
| **ZERO-SILENT-FAILURE** | Een relevante fout kan niet verdwijnen in een lege catch, een impliciete terugval of een misleidend succespad. | `scripts/stilspoor.js` (ratels `stilSpoor`, `stilleOpslag`), `inzagelog.noteerVast`, de verraadstanden van `server/lib/verraad.js` | `stilspoor` heeft geen controlemodus in CI. Bekende succespaden zonder grond staan nog open (sessieverslag, cluster C03). |
| **ZERO-UNOWNED-UNKNOWN** | UNKNOWN mag bestaan. Een UNKNOWN waarvan niemand weet dat hij bestaat, mag dat niet. | `niet vast te stellen` als eersteklas uitslag (BESTUUR.md), `ONBEPAALD` in `EXECUTION_MAP.json`, `nietGebouwd` en `nietGerekend` in antwoorden | Grote ongemeten noemers (FAALPROEF, AUDITPROEF, IDEMPROEF) staan in hun register maar in geen enkele claim als uitgesloten scope. |

De vierde eigenschap is met opzet niet "nul unknowns". Soms is UNKNOWN de enige
eerlijke uitslag, en die wegwerken betekent dat iemand een getal verzint.
Verboden is alleen de UNKNOWN zonder eigenaar: een meter die zwijgt over een
deel van de code, zonder dat ergens staat dat hij daar zwijgt.

Een samengesteld cijfer over deze vier komt er niet. Dat is dezelfde regel als
INT-04 en BEWIJSMACHINE.md: een totaal verbergt welke van de vier bewoog.

---

## 2. Een ratel per klasse, nooit per totaal

Een totale schuldvoorraad mag dalen terwijl er nieuwe schuld bij komt. Vijf
securityproblemen weg en drie nieuwe lege catches erbij is een daling, en het
nieuwe probleem verstopt zich in die daling.

Dit huis heeft die regel al twee keer en houdt hem vast:

- **Per meter.** Elke meter in `NORM.json` ratelt apart. Er is geen totaal, en
  dat blijft zo.
- **Per bestand.** De deltapoort weigert het salderen. Vijf inline stijlen erbij
  in het ene bestand en zes eruit in het andere houdt het nieuwe bestand op vijf.

Wat er ontbreekt is dat elke ratel ook in die ene lijst staat. Een ratel in een
toetsbestand (`SCHULD_MAX`, `KAPOT_MAX`, `GEMIST_MAX`, ...) wordt alleen gezien
door wie dat bestand opent. Zie golf A in par. 7.

---

## 3. Geïntroduceerd is iets anders dan ontdekt

Twee gebeurtenissen laten allebei een meter stijgen, en ze vragen het
tegenovergestelde.

| | Nieuw geïntroduceerde schuld | Nieuw ontdekte bestaande schuld |
|---|---|---|
| Wat er gebeurde | de code werd slechter | de meter werd beter |
| Oordeel | regressie | de waarheid is verbeterd |
| De PR | rood | groen, mits geregistreerd |
| Wat er moet gebeuren | repareren of `schuld` met vervaldatum | baseline expliciet herijken, schuld registreren, afbouwplan verplicht |

Zonder dit onderscheid ontstaat er een prikkel die dit huis niet kan
gebruiken: niet beter willen meten, omdat de cijfers dan slechter worden.

**De regel.** Een stijging die komt doordat een meter meer ziet, wordt nooit
tegengehouden. Ze wordt ook nooit stil opgenomen. Ze krijgt een notitie die
zegt wat de meter beter maakte en hoe de nieuw zichtbare schuld wordt
afgebouwd.

**Stand vandaag.** `scripts/normverval.js` kent twee soorten notities:
`schuld` (met een vervaldatum) en `structureel` (de vorm veranderde, met
`waarheen`). Een betere meter wordt nu als `structureel` geboekt, zoals bij
`activeringOndergrens` op 6 oktober ("een beperking van de meter"). Dan is er
geen afbouwplan verplicht. Er komt een derde soort, `ontdekt`, met drie
verplichte velden:

- `meterwijziging`: wat de meter beter maakte;
- `afbouw`: het plan om de nieuw zichtbare schuld weg te werken;
- `vervalt`: de datum waarop het plan moet zijn uitgevoerd.

Handhaver: nog niemand. Dit is golf A.

**Het eerste voorbeeld staat al in het register (par. 6).** Bij het wegwerken
van inline stijlen bleek dat een eerdere ronde 188 keer een tweede
`class`-attribuut had toegevoegd. Een browser negeert het tweede attribuut. De
opmaak die het `style=` droeg, viel dus stil weg terwijl `inlineStijlAttributen`
daalde: een meter die de goede kant op ging terwijl het product slechter werd.

---

## 4. Elke uitzondering wordt ontleed, en het antwoord verbetert de poort

Een uitzondering die weggaat omdat haar datum verliep, leert het huis niets.
Elke uitzondering gaat daarom door deze vragen:

1. Welke regel werd omzeild?
2. Waarom?
3. Welke onderliggende schuld zat erachter?
4. Waarom ving de normale architectuur dit niet op?

Daarna volgen vier stappen:

- de schuld repareren;
- een regressietoets toevoegen;
- de uitzondering verwijderen;
- de vraag stellen of dezelfde klasse opnieuw kan ontstaan. Is het antwoord
  ja, dan wordt de meter of de poort verbeterd.

### Golf 0: de 43 uitzonderingen van NORM.json (6 oktober 2026)

Er stonden 43 uitzonderingen in NORM.json. Op één na verliepen ze allemaal op
15 oktober. Daarna zou `normverval` elke CI-run rood maken, of iemand zou de
datum opschuiven, en dat is precies de boekhoudkundige nul die dit programma
verbiedt.

**De vondst die alles bepaalde.** Een uitzondering werkt alleen in de
deltapoort, en die kijkt naar het verschil met main.

- Een **nieuw** bestand moet op de norm staan.
- Een **aangeraakt** bestand mag alleen niet groeien.

Zodra de PR die een uitzondering nodig had gemerged is, is het bestand niet
meer nieuw. De uitzondering verliest dan haar werking, met één uitzondering:
een uitzondering zonder `wat` dekt ook GROEI van dat bestand af. Wat bleef
staan was dus geen bescherming maar een gat tot de vervaldatum.

| Soort | Aantal | Ontleding | Wat er gebeurde |
|---|---|---|---|
| `zelfpoortende-toets` | 31 | 29 bestanden staan op `scripts/lib/pg-toetslijst.js`. `scripts/pgtoetsen.js` laat de PostgreSQL-job zakken op elke skip, en check.js regel 25 eist dat elk databasegebonden bestand op die lijst staat. De regel zei zelf "zet de dienst in de draaier" en herkende niet dat dat gedaan was. **De meter was fout, niet de code.** De andere 2 wezen naar bestanden die niet bestaan. | De regel herkent de lijst (`scripts/deltapoort.js`), met een toets en een mutatie die zakt. Een `.pg.test.js` buiten de lijst slaat nog steeds uit. |
| `omvang` | 7 | 6 stonden al in check.js regel 13, 5 in `NOG` en 1 in `MAG`. Dat is één schuld op twee plekken. De zevende (`leverancierpoort.js`) zat al onder de grens. | Weg uit NORM.json. De schuld blijft geteld in `keuringTeGroot` en in `NOG`, dat moet krimpen. |
| `inline-stijl` | 4 | 26 echte attributen in 4 bestanden. | Gerepareerd: klassen met `!important` (de conventie van `rtg-hulpklassen.css`, zodat de klasse wint zoals het attribuut won), en een dynamische breedte via CSSOM in plaats van een attribuut. `inlineStijlAttributen` gaat van 4541 naar 4515. |
| `nieuw-endpoint-zonder-toets` | 1 | `/api/appstore/persoon/journaal` en `/cijfers` werden in geen enkele toets genoemd. | Toets 7b op een echte server. Twee mutaties zakken: een journaal dat alles teruggeeft, en cijfers met een andere app erin. |

**Wat de poorten nu wel zien.** `scripts/normverval.js` laat een uitzondering op
een niet-bestaand pad zakken, met een toets en een mutatie. Twee van die
spookuitzondering stonden er, met een datum in de toekomst, en geen enkele poort
had ze gezien.

---

## 5. Het nulclaimcontract

RTG zegt alleen "nul" als alle negen velden bekend zijn. Een claim met minder
velden is geen nulclaim maar een indruk.

| Veld | Vraag |
|---|---|
| **WAT** | Welke schuldklasse? |
| **SCOPE** | Welke code is werkelijk onderzocht? |
| **METER** | Welke meter stelde dit vast, en in welke versie? |
| **DEKKING** | Welk deel van de scope kon die meter zien? |
| **VERSHEID** | Geldt de meting voor deze code? |
| **HANDHAVING** | Welke poort voorkomt terugkeer, en is ze blokkerend? |
| **IJKING** | Is aangetoond dat de meter een opzettelijke fout vindt? |
| **COMMIT** | Voor welke onveranderlijke boom geldt de claim? |
| **ONBEKEND** | Wat valt expliciet buiten de claim? |

Zo mag het:

> Uitzonderingen in NORM.json: NUL, bewezen op commit X. Meter: normverval
> (pad, datum en bestaan), geijkt door `test/normverval.test.js`. Afgedwongen in
> ci.yml. Buiten de claim: uitzonderingslijsten in check.js en in losse
> toetsbestanden.

Zo niet: "RTG heeft nul bugs." Dat is principieel niet te bewijzen, en daarom
geen claim.

**Waar het contract woont.** Niet in een nieuw register. Het wordt de vorm van
het Zero-Debt Evidence Record (golf G), dat leest uit de meters, registers en
poorten die er al zijn. Een tweede waarheid naast NORM.json zou de fout zijn
die dit hele programma bestrijdt.

Handhaver vandaag: nog niemand.

---

## 6. Wat de nulmeting vond en nog niet is gerepareerd

Het volledige register (191 items in vijftien oorzaakclusters) staat in het
sessieverslag en hoort niet in dit document. Hier staat alleen wat niet uit
een meter af te leiden is.

| Vondst | Klasse | Waarom het hier staat |
|---|---|---|
| 188 dubbele `class`-attributen in 38 bronbestanden | ontdekt, DEFECT | Er is geen meter en geen poort. De reparatie herstelt zichtbare opmaak en vraagt daarom een eigen PR met schermcontrole. |
| `versheid`, `gevolgdekking:controle`, `schermfunctie:controle` en `tikken:controle` rood op HEAD | DRIFT | Geen van de vier draait in ci.yml, dus een groene CI zei er niets over. |
| CI-stap "nieuwe routes komen met een toets" uitgecommentarieerd sinds 27 augustus | DEBT | De eigen hersteldatum is verlopen, en de oorzaak (de server van main hangt in een worktree) is niet onderzocht. |
| De screenshots `gebruiker.png` en `organisatie.png` zijn niet deterministisch | DRIFT | Bij een ongewijzigde bron veranderen de bytes, dus elke `websitebeelden` levert een schijnwijziging op. |

---

## 7. De volgorde

- **Golf 0, de deadline: gedaan** (par. 4).
- **Golf A, de waarheid.** Voordat RTG zich schoon mag noemen, moet vaststaan
  dat de meetinstrumenten die verklaring kunnen dragen. Elke schakel in deze
  keten moet werken:

  `code → meter → register → versheid → norm → poort → merge`

  Concreet:
  - de vier rode poorten groen, en in ci.yml;
  - een centrale ratelinventaris;
  - de soort `ontdekt` in normverval;
  - documentgetallen onder merktekens;
  - de routepoort terug;
  - een volle suite op HEAD.

  Want 732 → 0 lege catches terwijl de meter maar 60% van de code ziet, is geen
  nul. Het is een kapotte thermometer.
- **Golf B tot en met F** zoals in het verslag: eerst wat gevaarlijk is, dan de
  structuur, de toetsen, de hygiëne en het afbouwen van de ratels.
- **Golf G, preventie.**
  - De Zero-Debt Gate.
  - Het Evidence Record in de vorm van par. 5.
  - Een dossier voor elke nieuwe tijdelijke maatregel, met eigenaar,
    verwijdercriterium en datum.

---

## 8. Waar de Architect hierin staat

De Architect uit CODE.md (besloten, read-only, nog niet gebouwd) bezit geen
enkel feit uit dit programma. Hij reconstrueert een antwoord uit wat er al is:

`code + meters + registers + wetten + poorten + bewijs = antwoord`

Vragen als "welke unknowns zijn er", "leg deze schuldklasse uit" of "wat raakt
deze PR" zijn daarom pas te beantwoorden als golf A staat. Een Architect boven
verouderde registers geeft overtuigende antwoorden over het verleden, en grens
3 van CODE.md (een modelbevinding wordt nooit een register) houdt hem daarbij
niet tegen.

---

## 9. De eindclaim

Niet "RTG technical debt = 0", maar:

> Voor de vastgelegde code- en risicoscope op onveranderlijke commit X heeft
> RTG geen bekende technische schuld waarvoor een geldige meter bestaat. Elke
> nulclaim is geijkt, vers en afdwingbaar. De bekende UNKNOWN-dekking is
> expliciet. Elke verwijderde schuldklasse heeft een regressiehandhaving. En
> nieuwe schuld kan niet ongemerkt worden geïntroduceerd.

Daarna is de vraag bij nieuw werk niet meer "hoe houden we dit schoon", maar
"komt deze verandering door de bestaande grondwet heen zonder aantoonbaar
nieuwe schuld".
