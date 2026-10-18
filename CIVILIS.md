# RTG CIVILIS — besluit van de eigenaar (18 oktober 2026)

RTG wordt vanaf nu ontwikkeld als een universele digitale infrastructuur voor ondernemingen, burgers, huishoudens, instellingen, maatschappelijke organisaties en publieke dienstverlening. De 79 genres in het register zijn niet langer de grens van het systeem. **De maatstaf is niet hoeveel genres er zijn, maar hoeveel van de werkelijkheid aantoonbaar van intentie tot uitkomst wordt gedragen.** CIVILIS wordt gebouwd, gemeten en bewezen — niet alleen beschreven.

Dit document is de bouwopdracht en de vastlegging van de scopewijziging die daarvoor nodig is. Het is geen tweede architectuur: het werkt via de registers, grenzen en bewijsinstrumenten die er al zijn, en het zegt per bouwstroom welke dat zijn.

## 1. De scopewijziging, en wat er NIET verandert

`CONSOLIDATIE.md` zegt: *"Tot de inventaris van de domeinen (fase 4) klaar is, worden er geen nieuwe domeinen geïmplementeerd."* **Die regel krijgt één uitzondering: het CIVILIS-programma.** CIVILIS loopt als eigen uitvoeringsprogramma naast de consolidatie en mag nieuwe sectoren, organisatievormen en ketens bouwen, onder de voorwaarden van par. 3.

Wat blijft staan, zonder uitzondering:

- **De lanceerbare kern** (RTG Pass, TravelOS, WorkOS, betalen, Rahul met de Edge). Wat CIVILIS bouwt, is standaard niet publiek tot het zijn eigen productiepoort haalt — precies zoals LivingOS en FoundationOS. Een vlag vervangt nooit een beveiligingsgrens.
- **Eén integrator**, en elke PR vanaf een verse main.
- **De vier harde voorwaarden** uit `CONSOLIDATIE.md`, ook voor CIVILIS-werk.
- **`AFBOUWPROGRAMMA.md`**: afgewezen blijft afgewezen, integratie via projecties en nooit één datamodel, en geld verlaat het huis nooit vanzelf.
- **Bestaande productieroutes, registers, bewijsstructuren en operationele gegevens.** Er wordt niets verwijderd om ruimte te maken voor CIVILIS, en er komt geen destructieve migratie zonder afzonderlijke toestemming van de eigenaar.

## 2. Wat er al ligt (inventaris, 18 oktober 2026)

Gemeten uit de repository, niet uit een document.

| Laag | Waar | Stand |
|---|---|---|
| Sectoren, genres, standaardcaps | `server/seed/genres.js` + `genres-lijst*.js` | 28 sectoren, 79 genres: 57 open, 10 bewijs, 8 intern, 2 uitnodiging, 2 huis |
| Wat een zaak werkelijk kan | `kern/werkvormen.js` (`capsVan`) | per zaak, uit haar eigen inhoud |
| Capabilities voor ondernemers | `server/functies/register/` | 207 capabilities |
| Bewijs per capability | `ONDERNEMERBEWIJS.json` (twaalf lagen) | 0 verkoopbaar, 207 onbewezen — meestal ONBEKEND, niet ROOD |
| Bewijs per functie | `APPWERKT.json` (acht bewijzen, `BETROUWBAARHEID.md`) | geen rij BEWEZEN |
| Bedrijfsketens | `ONDERNEMERBEWIJS.json` blok `ketens` | 20 ketens; vóór dit besluit 4 sluit, 1 deels, 15 geen proef |
| Toelating en vergunning | `kern/aanmeldingen/bewijs.js`, `kern/persoonseis.js` | handhaaft; een mens tekent af |
| Concern, entiteit, vestiging | `CONCERN.md`, `kern/concern/` | gebouwd; `tweede-vestiging` nooit als keten gelopen |
| Zaakdoos | `server/kern/zaakdoos/`, `server/vloot.js`, interne CA (`PRODUCTION.md`) | doorgeefluik online, journaal offline, naspelen bij herstel, beheer op afstand |
| Betalen | `kern/pay` | in de proeven op de demo-rail; echt geld is nergens gemeten |

**Twee dingen die de inventaris direct opleverde.** Vijf genres op stand `bewijs` — ziekenhuis, huisarts, medisch specialist, apotheek en beauty medical — hebben als enige standaardcap `location`: ze zijn aan te vragen en krijgen daarna geen gereedschap. En de toelatingsweg maakt geen onderneming aan: een ondernemer moet die zelf aanmaken en zijn zaak aanwijzen (`/api/onderneming/nieuw` + `/koppel`) voordat zijn ondernemingsbeeld zijn zaak ziet. Allebei zijn het CIVILIS-werk, en geen van beide is in deze eerste ronde opgelost.

## 3. Harde randvoorwaarden, en het mechanisme dat ze al draagt

| Randvoorwaarde | Hoe het hier wordt gehouden |
|---|---|
| Geen tweede waarheidssysteem | Sectorclaims gaan in het genre-register en `server/functies/register/`; bewijsstatus komt uit `ONDERNEMERBEWIJS.json` en `APPWERKT.json`. Er komt geen CIVILIS-catalogus naast. `test/genreregister.test.js` zakt op een genre buiten het register. |
| Geen nieuwe statusladder | De vier standen uit par. 4 zijn een LEESTABEL op bestaande standen, geen vijfde schaal (`BEWIJSLUS.md`). |
| Geen universele database | Integratie via projecties en expliciete gebeurtenissen (`AFBOUWPROGRAMMA.md`). Een gedeeld veld wordt eerst gemeten, nooit verklaard (`PLANNING.md`: 0 van 269 velden in alle plandomeinen). |
| Geen fictieve betalingsbewijzen | Een proef op de demo-rail zegt dat in zijn `grens`, en bewijst daarmee nooit dat geld werkelijk bij een partij landt. Dat deel blijft niet gemeten tot er een echte rail is. |
| Geen onbevoegde toegang | Elke nieuwe keten draagt een tenant-storing (zaak B ziet en raakt de gegevens van zaak A niet). Codenamen en de identiteitskluis blijven het ontwerp. |
| Geen automatische productietoelating voor gereguleerde sectoren | Stand `bewijs` met menselijke aftekening; `voorbehouden` in de fiscale klassen; geen AI die toegang belooft. |
| Geen ongeteste productieclaims | Voltooid heet het alleen via `APPWERKT.json` en de ketenproeven (`AFBOUWPROGRAMMA.md`). |
| Geen destructieve migraties zonder toestemming | Elke migratie die gegevens weghaalt of herschrijft, vraagt een afzonderlijk besluit van de eigenaar. |

## 4. Vier woorden voor de stand, gelezen uit wat er al is

De opdracht vraagt onderscheid tussen *niet gebouwd*, *niet gemeten*, *bewezen werkend* en *aantoonbaar falend*. Dat zijn geen nieuwe standen maar een manier om de bestaande te lezen:

| Woord | Wat het in de bestaande registers is |
|---|---|
| niet gebouwd | genre op `binnenkort`; een capability of keten zonder code (`waar` leeg) |
| niet gemeten | `ONBEKEND` (ONDERNEMERBEWIJS), `GEEN_FIXTURE` / `NIET_GETEST` (APPWERKT), keten met `dekt: geen` |
| bewezen werkend | `BEWEZEN` (APPWERKT), `GROEN` op alle twaalf lagen (verkoopbaar), keten met `dekt: sluit` |
| aantoonbaar falend | `GEBLOKKEERD_DOOR_DEFECT`, `ROOD`, een ketenproef met een open schakel of een gebroken storing |

Een niet gemeten onderdeel wordt nooit als falend gerapporteerd, en ook nooit als werkend.

## 5. De bouwstromen, en waar ze beginnen

**A. Universele sectorondersteuning.** Een nieuwe sector, specialisatie of organisatievorm komt in het genre-register, met zijn caps en zijn toegangsstand. Een genre zonder werkend gereedschap blijft op `binnenkort` en gaat niet open — een open genre met alleen `location` is een belofte zonder inhoud.

**B. Universele organisatie-infrastructuur.** Zelfstandigen, verenigingen, stichtingen, onderwijs, zorg en publieke instellingen bouwen op de concernlaag (`CONCERN.md`) en de rechtsvormen (`kern/onderneming/rechtsvorm*.js`). Gedeeld waar dat verantwoord is; een stichting is geen B.V. met een ander label. Eerste gat: de naad tussen toelating en onderneming (par. 2).

**C. Sectorgerichte werkruimtes.** De UI volgt de taak, de beroepspraktijk en het risico (`WERKRUIMTE.md`, `GRAMMATICA.md`). Een ziekenhuis is geen restaurant met andere woorden; de vijf gereguleerde zorggenres zonder gereedschap zijn daar het voorbeeld van.

**D. Sectoroverstijgende ketens.** Samenwerking tussen organisaties via expliciete gebeurtenissen en gecontroleerde projecties, nooit via een gedeelde tabel waarin iedereen schrijft. Volgorde: leveranciers, klanten, transport, personeel, betalingen, administratieve afwikkeling. De eerste staat (par. 6).

**E. CIVILIS Edge en Zaakdoos.** De Zaakdoos bestaat (`server/kern/zaakdoos/`): online doorgeefluik, offline journaal, naspelen bij herstel, updates en netwerkrol op afstand, en een eigen certificaat van de interne CA. Uitbreiden naar een netwerk van knooppunten gebeurt pas waar de voorwaarden aantoonbaar vervuld zijn: attestatie van de node, ondertekende updates, versleuteling per tenant, sleutelrotatie en intrekking, conflictregels en een geslaagde herstelproef. Een knooppunt slaat nooit gegevens op van een organisatie die er niet bij hoort.

**F. Bewijs en productiegeschiktheid.** Uitsluitend de bestaande instrumenten: ketenproeven met schakels en storingen, `APPWERKT.json`, `ONDERNEMERBEWIJS.json`. Elke nieuwe keten krijgt een proef in de vorm van `scripts/ritproef.js` en wordt in de ketenlijst van `scripts/ondernemerbewijs.js` aan die proef gehangen.

## 6. Eerste uitvoering: de keten `voorraad-ontvangst`

De kleinste werkende verticale uitbreiding die D raakt: **een restaurant dat inkoopt bij een groothandel.** Twee organisaties, een expliciete bestelling als gebeurtenis, en een gevolg in de voorraad van de ander. De code stond er; de keten was nooit gelopen.

`scripts/voorraadproef.js` (`npm run voorraadproef`, register `VOORRAADPROEF.json`) zet een groothandel uit de seed en twee restaurants langs de echte toelatingsweg neer, en loopt acht schakels: artikel onder minimum → inkoopadvies → ondernemingsbeeld → bestelling bij de groothandel → bevestigd → onderweg → geleverd in de keukenvoorraad → niet meer laag → afgeboekt bij de groothandel. Daarnaast tien storingen: te veel bestellen, annuleren voor en na bevestiging, weigeren, een dubbele levering, twee tenant-naden, een product dat de keuken niet kent, een ledensessie aan de zaakpoort, en een groothandel die niet meer aan zaken levert.

**De eerste ronde vond een stil defect.** Het inkoopadvies koppelt bewust op een deel van de naam ("Tomaten" in de keuken wordt "Trostomaten" bij de groothandel), maar de ontvangst boekte alleen op de hele naam. De bestelling heette *geleverd* en de keuken kreeg niets — en een `catch` die alles inslikte zorgde dat niemand dat kon zien. De bestaande toets had met opzet een artikel gekozen dat exact zo heet als het product, en zag het daarom ook niet. Uitslag vóór de reparatie: 6 van 8 schakels gesloten (2 open), 9 van 10 storingen gehouden.

De reparatie: een regel uit het advies onthoudt voor welk keukenartikel hij besteld is (`keukenArtikel`), de ontvangst boekt daarop en valt pas daarna terug op de naam, en elke geleverde bestelling draagt een `ontvangst` met wat er wel en niet is ingeboekt. Uitslag daarna: **8 van 8 schakels gesloten, 10 van 10 storingen gehouden.** `test/keuken.test.js` heeft een toets die zonder de reparatie zakt.

**Wat deze keten niet bewijst**, en dat staat in zijn `grens`: er gaat geen geld over (een groothandelsbestelling kent vandaag geen betaling of factuur — dat is de keten `factuur-grootboek`), er komt geen browser aan te pas, en alleen de keukenvoorraad van de koper is gelopen.

## 7. De volgende stappen

In volgorde, elk als kleinste verticale uitbreiding met een eigen proef:

1. **`factuur-grootboek` op de groothandelsbestelling** — de geldkant van dezelfde keten, zonder geld het huis uit te laten.
2. **De naad toelating → onderneming** (par. 2): een toegelaten zaak hoort zonder handwerk in het ondernemingsbeeld van de ondernemer te staan.
3. **`medewerker-dienst` en `ziek-vervanging`** — de werkgeverketen, de scherpste onbeproefde keten van het huis.
4. **Een tweede sector met een andere grammatica**: hotel (`kamer-uitchecken`), omdat die al in de lanceerbare kern valt.
5. **De vijf zorggenres zonder gereedschap** terug naar `binnenkort`, of een eigen werkruimte per genre — een besluit van de eigenaar.
6. **Zaakdoos als knooppuntennetwerk**, pas na de voorwaarden van bouwstroom E.
