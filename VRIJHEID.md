# RTG Vrijheid — tijd, rust, vrijheid en eerlijkheid voor wie bij RTG werkt

*Experience the elite class — from the inside.* De medewerker werkt voor RTG,
maar leeft niet voor RTG.

Een richtingsdocument zoals `PLANNING.md` en `ARBEID.md`: per onderdeel staat
erbij of het **staat**, **deels** staat, **een besluit vraagt** of **ontbreekt**.
De code staat in `server/kern/vrijheid/`, de bewijzen in
`test/vrijheid.test.js` en `test/vrijheid-lus.test.js`.

De stand vandaag, machineleesbaar in `server/kern/vrijheid/lus.js`:

**PEOPLE_TIME_STATUS = BLOCKED.** De motor is gebouwd en bewezen op een
teambeeld, de routes staan en zijn tegen een echte server beproefd, en er
zijn twee schermen: **Mijn tijd** in de personeelsapp en **Tijd van het team**
in het Kantoor van de zaak. Het teambeeld leest het dienstverband langs de
gewone routes (par. 7, punt 8), en het vakantierecht wordt gelezen uit
dienstverband, contract en verzuimregister -- maar er staat geen getal, want de
wettelijke rekenregel is niet juridisch getoetst en dus open. Wat nog niet
aangesloten is: verantwoordelijkheden per dienst, een lopend dienstverband in
de zaaiset, en de meeste beleidswaarden. Een toegekende hele vrije dag bereikt
de loonstrook wel (par. 7, punt 7). Dat is par. 7.

---

## 0. Wat dit is, en wat het niet is

Dit is geen verlofsysteem. Een verlofsysteem vraagt: "waarom zouden we dit
toestaan?" Deze laag vraagt: **"is er een concrete reden waarom dit niet
kan?"** Is er geen reden, dan kan het. Is er wel een reden, dan krijgt de mens
die reden in een zin, en eerst een alternatief.

De lus die rond moet:

```
PERSON -> POLICY -> ROSTER -> WORK -> COVERAGE -> FAIRNESS -> DECISION ->
HANDOVER -> TIME -> IMPACT -> CAPACITY -> IMPROVEMENT
```

De laatste schakel is de reden dat dit meer is dan een formulier. Een
geweigerde vrijdagmiddag omdat maar één mens PAYMENT_L3 mag doen, is geen
gedragsprobleem van de aanvrager. Het is een capaciteitsprobleem van de
organisatie, en de oplossing is een tweede bevoegde. Zo maakt meer capaciteit
meer vrijheid.

---

## 1. De grondwet, met per regel wie hem handhaaft

| # | Regel | Handhaver |
|---|---|---|
| 2.1 | Freedom by default | `besluit.js`: de laatste stap zegt *"er is geen concrete reden waarom dit niet kan"*; een nee kan alleen uit een eerdere stap komen |
| 2.2 | Team fairness | `eerlijkheid.js` `oneerlijkeOverdracht`; toets *gouden bewijs E* |
| 2.3 | Rights first | `beleid.js`: bij een `recht` wint het hoogste getal, en een poging tot verminderen wordt een conflict met naam; toets *een hoger recht wordt nooit verminderd* |
| 2.4 | Extra means extra | `categorieen.js`: aanvullende categorieën hebben geen of een eigen teller; `invarianten()`; toets *categorieen schrijven nooit van elkaars saldo af* |
| 2.5 | No hidden people score | toets *geen verborgen score en geen AI in de beslisweg* (leest de bron); het grootboek telt per soort moment en wordt nergens samengevat |
| 2.6 | Facts, not character | er is geen invoer over een mens buiten dienstverband, rooster, bevoegdheid en verantwoordelijkheden |
| 2.7 | Explain every no | elke stap draagt een `uitleg`; een menselijke weigering zonder reden is 422 |
| 2.8 | Alternative before decline | `alternatief.js`: later weg, een andere dag, een vrijwillige gekwalificeerde vervanger |
| 2.9 | Rest is real | `rust.js`; **geen handhaver** voor de meldingen tijdens vrije tijd (par. 7, P1) |
| 2.10 | No punishment for freedom | het grootboek wordt alleen door de verdeling gelezen; **geen handhaver** die garandeert dat een andere laag het nooit leest (par. 7, P1) |
| 2.11 | Privacy by design | de reden bestaat alleen bij bijzonder verlof, in een aparte la, en alleen voor wie beoordeelt; toets *privacy* |
| 2.12 | Human exception | `mens.js`: een mens beslist, maar keurt nooit zijn eigen verzoek goed en tekent nooit een ontbrekende bevoegdheid weg |
| 2.13 | Transparent fairness | `verzoekUitleg()` en de rotatie-uitleg noemen de regel en de eigen geschiedenis, nooit die van een collega |
| 2.14 | No unfair transfer | zie 2.2 |
| 2.15 | Excellent work is not maximum hours | `werkstand.js` meet nooit hoe snel iemand klaar was |
| 2.16 | Experience the elite class | de teksten in `aanbod.js`, `verjaardag.js` en `beeld.js` |

---

## 2. Gap matrix

Uit de ontdekkingsronde van 27 september 2026. **Hergebruiken** betekent
aansluiten zonder te wijzigen, **uitbreiden** betekent een bestaande module een
stap verder brengen, en **nieuw** betekent dat er niets was.

| Onderdeel | Stand | Waar | Wat ermee gebeurt |
|---|---|---|---|
| Persoon op codenaam | BESTAAT | `server/accounts/staff.js`, `server/kern/concern/employment.js` | HERGEBRUIKEN als bron van het teambeeld; de adapter ontbreekt |
| Dienstverband als waarheid | BESTAAT | `server/kern/concern/employment.js` (besluit ARBEID.md par. 7a) | HERGEBRUIKEN: "in dienst op datum" |
| Verjaardag | ONTBREEKT | staff draagt geen geboortedatum; `md.geboren` staat bij het lid en hoort niet naar de werkgever (MN-02) | NIEUW (`instellingen.js`): alleen `MM-DD`, door de mens zelf opgegeven |
| Verlof en ziekte | DEELS, en dubbel | `server/kern/payroll/verzuim.js` én `db.data.verlof` via `server/routes/staff/dienst.js` | BOTST: twee opslagen, zie par. 4 |
| Vakantiesaldo | DEELS | de teller in `categorieen.js`; het recht uit `saldobron.js` (dienstverband, contractversie, verzuimregister) | AANGESLOTEN zonder tweede register; de rekenregel is OPEN (par. 7, punt 8) |
| RTG Day, verjaardagvrijheid, eerder naar huis, hersteltijd | ONTBREEKT | | NIEUW |
| Roosters | BESTAAT, zeven stuks | `server/kern/personeel.js`, `server/kern/agent.js`, `server/kern/beveiliging/rooster/` en vier andere (PLANNING.md par. 1) | HERGEBRUIKEN via een rooster-adapter; de adapter ontbreekt |
| Dekking op bezetting | DEELS | `server/kern/beveiliging/rooster/` kent `minMan` | UITBREIDEN: nieuw in `dekking.js` met bevoegdheden erbij |
| Bevoegdheid met houdbaarheid | BESTAAT | `server/kern/vakbewijs.js`, `server/kern/persoonseis.js` | HERGEBRUIKEN: dezelfde regel (afgetekend door een ander, geldig op de dag zelf) |
| Rusttijd | DEELS | `server/kern/beveiliging/rooster/rust.js` (11 uur, alleen beveiliging), `server/kern/mobiliteit/cdt-tijden.js` (taxi) | UITBREIDEN: de rustwaarde komt nu uit beleid |
| Eerlijk verdelen | DEELS | `server/kern/beveiliging/rooster/aanvragen.js` (minste uren eerst) | HERGEBRUIKEN als vorm: sorteren op wat iemand toekomt |
| Dienst ruilen | ONTBREEKT | | Standmachine staat, de ruil zelf is P1 |
| Overdracht | DEELS | `server/kern/horeca/wijk-overdracht.js` (alleen een horecawijk) | UITBREIDEN, P1 |
| Academy | ONTBREEKT | geen module; wel Métier (`server/kern/metier/index.js`) en de carrièreledger | NIEUW als opleidingsbehoefte in `capaciteit.js`; sluit via een afgetekende bevoegdheid |
| Gebeurtenissen | BESTAAT | `server/bus.js`, `server/kern/envelop.js` | HERGEBRUIKEN via de `meld`-haak; de montage ontbreekt |
| Jobs | BESTAAT | `server/kern/command/tikker.js` | HERGEBRUIKEN: elke job is een herhaalbare functie, er komt geen scheduler bij |
| Mandaat en policy | BESTAAT | `server/kern/stuur/mandaat.js` | NIET gebruikt: dat is AI-gezag over capabilities; dit is arbeidsbeleid met rechten. Twee dingen |
| Loonstrook | BESTAAT | `server/kern/payroll/samenstellen.js` | UITBREIDEN, P0: de nieuwe categorieën bereiken de loonrun nog niet |
| Werkdrukgrens op de klok | ONTBREEKT | PLANNING.md par. 6, "een stap weg" | P2, schakel IMPACT |

---

## 3. De tijdcategorieën

Hard gescheiden in `server/kern/vrijheid/categorieen.js`. Elke categorie heeft
precies één teller of geen, en er bestaat geen functie die de ene categorie
van de teller van een andere afschrijft.

| Categorie | Teller | Aanvullend | Wie zet hem |
|---|---|---|---|
| STATUTORY_LEAVE | wettelijk (uren) | nee | de medewerker vraagt |
| CONTRACTUAL_LEAVE | contractueel (uren) | nee | de medewerker vraagt |
| RTG_DAY | rtgDag (dagen) | ja | de medewerker vraagt, zonder reden |
| BIRTHDAY_LEAVE | geen | ja | RTG plant hem vooraf |
| FREEDOM_RELEASE | geen | ja | RTG biedt aan, de mens kiest |
| RECOVERY_RELEASE | geen | ja | een leidinggevende, op een roostersignaal |
| SCHEDULE_FLEXIBILITY | geen | nee, betaling volgt beleid | de medewerker vraagt |
| SPECIAL_LEAVE | geen | nee | altijd een mens |
| UNPAID_LEAVE | geen | nee | altijd een mens |

Een RTG Day telt in **dagen** en vakantie in **uren**. Een parttimer met een
korte dienst levert dus geen halve RTG Day in.

---

## 4. Botsingen en bezette namen

- **`vrijgave` is bezet** (`server/config/foundation-vrijgave.js` en de
  productiepoorten). Daarom heet de laag `vrijheid` en houdt de categorie haar
  naam uit de opdracht: FREEDOM_RELEASE.
- **Twee verlofopslagen.** `/api/staff/leave/request` schreef in
  `db.data.verlof` én meldde meteen `vakantie` in de verzuimlaag, **vóór de
  goedkeuring**, en `/api/supplier/leave/decide` werkte de verzuimlaag daarna
  niet bij. Een afgewezen verzoek stond dus als vakantie in de payrollinvoer.
  Gerepareerd, zie par. 7. De twee opslagen bestaan nog: dat is een
  samenvoegvraag voor als deze laag gemount wordt.
- **Die route bewaarde een reden bij gewoon verlof**, en het HR-scherm toonde
  hem. Dat botste met 2.11. Gerepareerd, zie par. 7.
- **Een mens is geen resource** (PLANNING.md grens 1). Er wordt gesorteerd op
  wat iemand toekomt en nooit op geschiktheid. De rotatie kent geen kenmerk van
  de mens behalve hoe vaak en wanneer hij dit soort moment kreeg.
- **`SOORTEN` en `beschikbaarheid` zijn bezet** (PLANNING.md par. 3) en worden
  hier niet gebruikt.
- **`mandaat`** is bewust niet gebruikt, zie de gap matrix.

---

## 5. V1: wat er staat

Vierentwintig modules in `server/kern/vrijheid/`, allemaal onder de 10 kB en zonder
modelaanroep:

| Module | Wat hij doet |
|---|---|
| `categorieen.js` | categorieën, boekingen, saldi, invarianten |
| `beleid.js` | vijf lagen, richting per variabele, conflicten, open waarden |
| `tijd.js` | minuten vanaf een nulpunt; een nachtdienst is één interval |
| `dekking.js` | bezetting én bevoegdheden per tijdvak, met het gat in een zin |
| `werkstand.js` | de vijf werkstanden; zelf afvinken is geen bewijs |
| `rust.js` | rust tussen diensten en een herstelsignaal uit het rooster |
| `eerlijkheid.js` | rotatie, volgorde voor eerder naar huis, NO_UNFAIR_TRANSFER |
| `besluit.js` + `alternatief.js` | de besliswijze in negen stappen, en de alternatieven |
| `verjaardag.js` | de verjaardag per beleid |
| `capaciteit.js` | van blokkade naar opleidingsbehoefte, en terug |
| `standen.js` | vijf standmachines met expliciete overgangen |
| `index.js` + `mens.js` + `aanbod.js` + `herstel.js` + `jaarplan.js` + `beeld.js` | vastleggen, menselijke beoordeling, aanbod, jobs en de drie beelden |
| `saldobron.js` | het vakantierecht uit dienstverband, contract en verzuimregister; de rekenregel blijft open |
| `teambeeld.js` + `instellingen.js` + `huis.js` + `rtghuis.js` | het teambeeld uit de bestaande bronnen, wat de zaak en de mens zelf opgeven, RTG zelf als werkgever met de kamers als teams, en de montage als `kern.vrijheid` |
| `lus.js` | PEOPLE_TIME_LOOP_COMPLETENESS_CHECK |

**De gouden bewijzen A tot en met G** staan in `test/vrijheid.test.js` onder hun
eigen naam, met de negatieve bewijzen ernaast. Die negatieve bewijzen zijn:

- een verjaardag kost geen vakantiedag;
- zelf afvinken is geen WORK_COMPLETE;
- een verlopen of zelf afgetekende bevoegdheid telt niet;
- uit dienst telt niet mee;
- de reden lekt niet naar het team of de leidinggevende buiten de beoordeling;
- isolatie tussen organisaties;
- niemand keurt zijn eigen verzoek goed;
- twee leidinggevenden kunnen samen de dekking niet breken;
- de laatste plek gaat één keer weg;
- idempotentie;
- herkeuring trekt vrije tijd nooit stil in;
- onbekende rooster-uitkomst: eerst afstemmen, dan pas opnieuw proberen.

**Elke bewaker is met een mutatie nagetrokken** (LAT.md). Twee bleven eerst
groen, en daar kwam een toets bij:

- De rotatieregel "minst vaak eerst" viel samen met "langst geleden" in de
  eerste toets.
- De overdrachtscontrole bij het aanvaarden werd door geen toets geraakt.

---

## 6. Wat besloten is, en wat niet

**Besloten door de eigenaar op 27 september 2026**, vastgelegd in
`server/kern/vrijheid/rtgbeleid.js` met die datum als bron:

- **tien RTG Days** per kalenderjaar, bovenop het wettelijke en contractuele
  verlof;
- valt een verjaardag op een dag waarop iemand al vrij is, dan is de **vorige
  werkdag** vrij. Dat geldt voor het weekend, een officiële feestdag en een
  vaste vrije dag van een parttimer: één regel voor alle drie. De "werkdag" is
  die van de mens zelf, dus een parttimer krijgt zijn eigen vorige dienst.

Dit beleid geldt voor RTG als werkgever. Een andere organisatie erft het niet.

**Nog niet besloten.** Deze waarden staan in `beleid.js` zonder waarde. De motor zegt UNKNOWN of
BLOCKED_BY_LAW_OR_POLICY met de reden, en verzint niets:

- **verjaardag** op 29 februari in een gewoon jaar, en welke dienst vrij is als
  een nachtdienst over middernacht loopt;
- de **grens voor eerder weg zonder menselijke beoordeling**;
- het **venster en de grens voor extra dekking**, het maximum openstaande
  aanvragen voor schaarse momenten;
- de **herstelgrenzen** (uren in veertien dagen, dagen achter elkaar);
- de **drempel voor een capaciteitsgat**;
- de **juridische toets van de rekenregel voor het vakantierecht**. De regel
  zelf is sinds 11 oktober 2026 besloten en gebouwd (par. 6a), maar de toets
  is niet afgerond, dus de productiepoort staat dicht en het recht blijft "niet
  bekend" met die reden;
- **minimale rust**: de 11 uur uit de Arbeidstijdenwet staat al in de
  beveiligingsroosters, maar moet per cao en contractvorm worden gevalideerd.

De test gebruikt een **proefbeleid** dat met die naam in de bron staat. Het is
geen voorstel.

Daarnaast moet een jurist of loonadministrateur vóór productie laten
valideren:

- of RTG Days, verjaardagvrijheid en eerder naar huis fiscaal en
  loonadministratief betaalde arbeidsvoorwaarden zijn, of iets anders;
- hoe ze op de loonstrook staan;
- of opbouw doorloopt tijdens deze categorieën.

---

## 6a. De rekenregel voor vakantiedagen, en de poort ervoor (besluit B1)

**Besloten door de eigenaar op 11 oktober 2026 (B1):** een juridisch
gevalideerde Nederlandse rekenregel, met onderscheid wettelijk en
bovenwettelijk, contracturen, wisselende arbeidsduur en ziekte. WorkOS voert
de berekening uit en controleert de brongegevens. **Tot de juridische toets is
afgerond blijft de productiepoort gesloten.**

**Dit is geen juridisch oordeel.** Wat hieronder staat is wat de CODE doet en
welke artikelen hij daarbij volgt. Of dat de juiste lezing is, beslist een
jurist; RTG doet niet alsof.

**Wat de regel volgt** (`server/kern/vrijheid/vakantieregel.js`):

| Onderdeel | Artikel | Wat de code doet |
|---|---|---|
| wettelijk minimum | art. 7:634 lid 1 BW | viermaal de overeengekomen arbeidsduur per week; de factor 4 staat als laag LEGAL_BASELINE onder het beleid van een zaak met een Nederlandse vestiging (`WETTELIJKE_LAAG`), zodat een latere laag hem nooit stil verlaagt |
| deel van het jaar | art. 7:634 lid 2 BW | naar rato per kalenderdag over het deel van het jaar waarin het dienstverband loopt (365 of 366 dagen) |
| wisselende arbeidsduur | art. 7:634 BW | per dag de contractversie die OP DIE DAG geldt (dezelfde vraag als `contracten.opDatum` in de loonrun), dus naar rato per periode |
| ziekte | art. 7:635 BW | de opbouw loopt door; het verzuimregister (`kern/payroll/verzuim.js`) is de bron van de tijdvakken |
| onbetaald verlof | art. 7:634 lid 1 en 7:635 BW | geen opbouw over het tijdvak zonder recht op loon |
| zwangerschaps- en bevallingsverlof | art. 7:635 BW | de opbouw loopt door |
| ouderschaps- en zorgverlof | art. 7:635 BW | OPEN: gedeeltelijk loon, en hoe het artikel deze soorten raakt is niet vastgesteld -- de regel rekent dan niet en zegt waarom |
| bovenwettelijk | contract | OPEN: `kern/payroll/contracten.js` heeft geen veld voor bovenwettelijk verlof, dus `contractueel` is altijd onbekend met die reden |

De volledige opbouwtabel per verzuimsoort is `OPBOUW` in dat bestand; een soort
die er niet in staat laat `test/vrijheid-vakantieregel.test.js` zakken.

**Broncontrole.** Ontbreekt het dienstverband, staat er een dag van het
dienstverband zonder contractversie, heeft een vaste soort geen
`urenPerWeek`, of is het contract er een zonder vaste omvang (oproep,
nuluren, uitzend, freelance), dan is de uitkomst `null` met de reden en nooit
nul. Ook open blijven: meer dan een contract bij dezelfde zaak, vakantie die
langs de oude verlofroute in DAGEN staat, en elke zaak met een vestiging
buiten Nederland.

**De poort** (`server/kern/vrijheid/vakantiepoort.js`). Zolang hij dicht is,
rekent de regel wel: de uitkomst staat in Mijn tijd als `berekening` met de
graad **vermoed** en de reden "de juridische toets van de rekenregel is niet
afgerond". Maar `wettelijk` blijft `null`, en een vakantieverzoek blijft
**UNKNOWN** met die reden -- geen verlofbesluit kent vakantie toe op een
berekening achter een dichte poort. Een mens kan in HUMAN_REVIEW nog steeds
zelf besluiten; dat leunt dan op zijn eigen oordeel en niet op het getal.

De poort heeft de vorm van de bestaande boardroomschakelaars (de
terugstortstand, de cadeaubon, het afdwingen van de beleidsmotor): lezen
achter de boardroom (`POST /api/office/vrijheid/vakantieregel`), zetten alleen
door de **eigenaar**, op naam, met een verse passkey (actie
`eigenaar-vakantieregel`) via `POST /api/office/vrijheid/vakantieregel/stand`.
Openen vraagt een vastgelegde toets: wie toetste, de datum (niet in de
toekomst) en het kenmerk van het toetsdossier. RTG beoordeelt dat dossier niet
inhoudelijk; het legt vast waarop de eigenaar opende. De toets geldt voor EEN
regelversie (`REGELVERSIE`, een hash over de artikelen, de factor en de
opbouwtabel): verandert de regel, dan gaat de poort vanzelf dicht. Een open
stand zonder toets of met een andere versie leest als dicht.

**Wat de jurist moet toetsen, voordat de eigenaar de poort opent:**

1. of de factor vier en de naar-rato-berekening per kalenderdag de juiste
   lezing van art. 7:634 BW zijn (of per gewerkte week, of per maand);
2. of de arbeidsduur per contractversie de "overeengekomen arbeidsduur" is,
   ook bij `minmax` (de regel neemt dan het veld `urenPerWeek` van de versie) en bij
   `stage`;
3. de opbouwtabel per verzuimsoort, in het bijzonder art. 7:635 BW voor
   ziekte, zwangerschap, onbetaald verlof en de twee open soorten
   (ouderschaps- en zorgverlof);
4. hoe een contract zonder vaste omvang (oproep, nuluren) moet worden gerekend
   -- vandaag is dat open;
5. of de cao of het contract bovenwettelijk verlof geeft, en waar dat in de
   bron moet komen (er is vandaag geen veld);
6. de verjaring en het vervallen van niet-opgenomen dagen (art. 7:640a en
   7:642 BW): de regel rekent het RECHT van een jaar en raakt die vraag niet.

**Het toetsingsdossier is `VAKANTIETOETS.md`** (besluit 4A, 11 oktober 2026):
per artikel RTG's lezing met de codeplek, de aannames, de grensgevallen, de
voorbeeldberekeningen uit de echte functies, de stappen van de eigenaar na de
toets, en een checklist met handtekeningblok voor de beoordelaar. Het is een
eigen document en geen paragraaf hier, omdat het naar een beoordelaar buiten het
huis gaat en per regelversie opnieuw wordt ingevuld. `test/vakantietoets.test.js`
houdt het tegen de code: de REGELVERSIE, de bronhashes van de drie bestanden,
elke codeverwijzing en elke voorbeelduitkomst. Let op wat het dossier daar
blootlegt (par. 6.2): de REGELVERSIE is een hash over de TABELLEN en niet over de
rekencode, dus een wijziging in `reken()` laat een open poort open -- de
bronhashes vangen dat in de keuring op, niet in de poort.

Let op een vondst onderweg: het verzuimregister draagt per soort een vlag
`opbouwend` die nergens wordt gelezen, en die voor `vakantie` op `false` staat.
De regel leest hem met opzet niet (tijdens vakantie bestaat recht op loon, dus
loopt de opbouw door) en gebruikt de eigen tabel met grond; de vlag hoort bij
de toets te worden rechtgezet of weggehaald.

**De Rome-keten, schakel 10** (`scripts/romeproef.js`, op een andere tak):
het verlofsaldo van de vriend staat daar als "niet aangesloten". Met deze
regel is het aangesloten en gerekend, maar blijft het recht `null` met de
reden van de dichte poort; de schakel blijft daarnaast open op de
roosterhorizon van zeven dagen. Dat is hier een verwijzing, geen meting.

---

## 7. Volgorde

**P0: eerst, want het is vandaag al fout of het blokkeert alles**

1. ~~De verlofroute boekt geen `vakantie` in de verzuimlaag vóór de
   goedkeuring, en `leave/decide` werkt de verzuimlaag bij.~~ **Gedaan.**
   Verlof gaat pas naar de verzuimlaag bij de goedkeuring; ziekte nog steeds
   meteen. Meldingen die vóór deze reparatie al als vakantie zijn geboekt en
   daarna zijn afgewezen, staan er nog: die zijn niet automatisch opgeruimd.
2. ~~Geen reden meer bij gewoon verlof in `/api/staff/leave/request`.~~
   **Gedaan.** Een reden wordt geweigerd (422) en niet bewaard. Het veld is uit
   de app en de manager ziet geen reden meer. Oude aanvragen dragen hun reden
   nog in de opslag.
3. De rest van het arbeidsvoorwaardenbesluit (par. 6), plus de juridische
   validatie van wat al besloten is.
4. ~~De teambeeld-adapter.~~ **Gedaan** (`teambeeld.js`). Hij leest het
   personeelsregister, het DIENSTVERBAND bij de entiteit van de zaak (dezelfde
   weg als `dienstverbandToets`), het weekrooster en het vakbewijs, en zegt
   per veld wat er ontbreekt. De verjaardag geeft de medewerker zelf op
   (`instellingen.js`, alleen dag en maand, en hij kan hem weer weghalen);
   bezetting en feestdagen legt een leidinggevende vast, want die stonden
   nergens. Vier eerlijkheden die hij hardop zegt:
   - wie geen eigen account of geen dienstverband bij die entiteit heeft, telt
     NIET als in dienst en krijgt BLOCKED met de reden;
   - het rooster kijkt zeven dagen vooruit;
   - een dag zonder vastgesteld rooster is het standaardpatroon;
   - verantwoordelijkheden per dienst legt geen enkel domein vast, dus de
     werkstand blijft UNKNOWN.
5. **Half gedaan.** De motor hangt als `kern.vrijheid` in de server
   (`server/opzet/kernlaag5g.js`) en schrijft in zijn eigen collecties
   `vrijheid` en `vrijheidInstellingen` (`server/kern/eigencollectie.js`).
   Bij het opstarten loopt de laag na of elke bron van het teambeeld in de kern
   staat; ontbreekt er een, dan start de server niet. Wat nog niet staat is
   duurzaam vastleggen (`server/lib/duurzaam.js`): dat hoort bij de route die
   het antwoord geeft, dus bij punt 6.
6. **Routes en schermen gedaan.** `server/routes/vrijheid/tijd.js`:
   - voor de medewerker: Mijn tijd, de eigen verjaardag, verzoeken, intrekken
     en uitleg;
   - voor de leidinggevende, op eigen naam: overzicht, beoordelen, bezetting
     en feestdagen.

   Elke mutatie gaat door `server/lib/duurzaam.js`. De persoon komt uit de
   sessie en nooit uit het lichaam. `test/vrijheid-routes.test.js` beproeft
   de routes tegen een echte server, met een dubbeltik-ronde waar de
   contracten in `server/lib/mutatiecontracten-vrijheid.js` op rusten. Drie
   routes staan daar eerlijk op BLOCKED_BY_TEST_FIXTURE, met wat er moet komen.
   De routes om een aanbod "eerder naar huis" te aanvaarden staan er met
   opzet NIET: zonder verantwoordelijkheden per dienst komt er nooit een
   aanbod.

   De schermen (27 september 2026):
   - **Mijn tijd**, een tab in de personeelsapp
     (`public/apps/personeel/personeel-03c.js`, en een knop in het profiel van
     de Team Room). Een saldo dat het systeem niet kent staat er als "niet
     bekend" MET de reden, nooit als nul; een verzoek toont wat er mee gebeurde
     en de alternatieven; en "Wat het systeem niet weet" staat er als eigen
     kaart.
   - **Tijd van het team**, een kaart in HR & team van het Kantoor
     (`public/apps/leverancier/leverancier-55e.js`): wat op een mens wacht met
     de stappen en de alternatieven, goedkeuren of afwijzen (afwijzen vraagt
     een reden, want de medewerker leest hem), de bezetting per weekdag (met
     kamer bij RTG zelf) en de feestdagen. Met het bedrijfsaccount krijgt de
     kaart de zin van de server en geen lege lijst.

   `test/vrijheid-scherm.e2e.js` beproeft beide in een echte browser. Twee
   vondsten daar: een bundeldeel dat midden in een functie van een ander deel
   sorteert, maakt zijn functies onzichtbaar voor de rest van de app terwijl de
   bundel gewoon bouwt (beide delen staan nu op een grens tussen twee hele
   functies), en een herlaadbeurt van de tab wiste een datum die de
   medewerker al had ingevuld.
6a. **RTG zelf als werkgever** (besluit van de eigenaar, 27 september 2026).
   - Een zaak met genre `rtg` (status `huis`, er bestaat er precies een): de
     eigenaar maakt hem eenmalig aan vanuit de boardroom
     (`server/kern/vrijheid/rtghuis.js`, `server/routes/vrijheid/rtghuis.js`),
     met een bestaand persoonlijk account als eerste leidinggevende.
   - Hij gaat nooit online en staat in de economische wereld `rtg-intern`.
   - De kamers van het kantoor zijn zijn AFDELINGEN. Een leidinggevende van
     RTG zet mensen in kamers, en een bezettingseis kan bij een kamer horen:
     dan telt alleen dat team mee.
   - Het RTG-beleid (tien RTG Days) geldt ALLEEN in deze zaak; elke andere
     zaak krijgt leeg beleid.
   - **Stap twee staat** (28 september 2026, keuze van de eigenaar: "een zetel
     in de RTG-zaak is de toegang"). Wie op zijn eigen account personeel is van
     de RTG-zaak EN minstens een kamer heeft, heeft de kantoorsleutel aan zijn
     sleutelbos en komt het kantoor binnen op naam
     (`server/kern/vrijheid/rtgzetel.js`). De sleutel is AFGELEID en niet
     opgeslagen, net als die van de eigenaar: uit de laatste kamer of uit dienst
     is hij bij de volgende vraag weg, en een dienstverband zonder kamer is geen
     sleutel. De uitnodiging van de eigenaar blijft voor wie buiten de zaak valt;
     de gedeelde code blijft werken en wordt geteld. De beleidsmotor telt per
     kamer DOOR WIE er zit (`eigen`, `vreemd`, `zonderToewijzing`, `onbekend`) en
     niet WIE -- in de schaduw, zonder iemand tegen te houden
     (`test/rtgzetel.test.js`, vijf mutaties die alle vijf zakken).
7. **Half gedaan: de loonstrook** (27 september 2026). De motor had al een
   `rooster`-haak die niemand vulde; die is nu de brug naar het
   verzuimregister (`server/kern/vrijheid/verzuimbrug.js`), en dat register
   leest de loonrun al (`kern/payroll/samenstellen.js`), net als het
   afwezigheidsoverzicht van de leidinggevende. Een toegekende hele vrije dag
   staat er onder zijn EIGEN soort: vakantie, bijzonder of onbetaald verlof,
   en twee nieuwe die 100% doorbetalen -- `rtgdag` en `verjaardag` -- zodat op
   de strook staat waarom iemand betaald vrij was.
   - Een deel van een dag komt er niet in (de payroll rekent in werkdagen) en
     zegt dat met stand NIET_DOORGEZET en de reden.
   - Het bouwen vond een gebrek: een ingetrokken of door uitdiensttreding
     vervallen dag hield zijn boeking, dus een ingetrokken RTG Day telde nog
     mee tegen de tien en bleef collega's blokkeren. Vrijgeven staat nu op een
     plek (`vrijgaveTerug` in `roosterhaak.js`), en een afwezigheid met een `bron` raakt
     nooit een melding uit een andere weg.
   - Het weekrooster, het AI-roostervoorstel en de autoplanner van de
     beveiliging lezen het verzuimregister (`kern/payroll/inplanbaar.js`), dus
     een toegekende vrije dag staat daar vrij. Sinds 29 september lezen ook de
     OV-dienst, het festivalrooster en de taxidispatch het (PLANNING.md par. 6);
     een school houdt een eigen verlofregister en hangt er met opzet niet aan.
8. **Het vakantierecht en het dienstverband, aangesloten** (11 oktober 2026).
   `server/kern/vrijheid/saldobron.js` rekent het recht bij elke vraag opnieuw
   uit drie bestaande waarheden, en er komt geen tweede saldoregister:
   - het DIENSTVERBAND uit het teambeeld (employment aan de entiteit van de
     zaak, ARBEID.md par. 7a);
   - de ARBEIDSDUUR uit de contractversie in de payroll
     (`kern/payroll/contracten.js`, dezelfde die de loonrun leest);
   - wat er al OPGENOMEN is: de eigen boekingen van de motor, en vakantie die
     langs de oude verlofroute in het verzuimregister staat (zonder `bron`;
     `verzuim.zonderBron()` leest dat, alleen lezen).

   De rekenregel staat als `verlof.wettelijkWekenPerJaar` in LEGAL_BASELINE en
   wordt door niemand gezet, dus het recht is `null` met de reden -- tot in de
   zin van het besluit (een vakantieverzoek wordt UNKNOWN en zegt waarom). Ook
   mét een regel rekent de module alleen het eenvoudigste geval (heel jaar in
   dienst, een contract met vaste omvang dat het hele jaar gelijk blijft, geen
   vakantie uit de verlofroute) en zegt bij alle andere waarom niet.
   Bovenwettelijk verlof staat in geen enkel contract, dus `contractueel` is
   altijd onbekend met die reden. Mijn tijd toont waar het recht uit gerekend
   wordt (soort, uren per week, in dienst sinds), en nooit het uurloon.

   `test/vrijheid-saldo.test.js` bewijst het tegen een echte server langs de
   gewone routes: een ondernemer koppelt zijn zaak aan zijn entiteit, haalt het
   dienstverband van een medewerker in en legt diens contract vast; daarna ziet
   de medewerker dat hij in dienst is, en komt zijn vakantieverzoek langs
   ELIGIBILITY tot de open regel. Drie mutaties (open regel genegeerd, de
   verlofroute genegeerd, de route weer zonder rechten) laten hem alle drie
   zakken. Wat hij niet bewijst: een rond verzoek in de browser, want de
   zaaiset heeft nog steeds geen zaak met een dienstverband.

   `test/vrijheid-verzuim.test.js` draait de echte motor, het echte register
   en de echte samenstelling van een loonrun.
9. **De rekenregel en de productiepoort** (11 oktober 2026, besluit B1; par.
   6a). `vakantieregel.js` rekent art. 7:634 en 7:635 BW over de bronnen van
   stap 8, `vakantiepoort.js` houdt de uitkomst tegen tot de eigenaar hem na
   de juridische toets opent. `test/vrijheid-vakantieregel.test.js` bewijst
   de regel, de poort (dicht zonder handeling, open alleen met toets en op de
   eigen regelversie) en, tegen een echte server, dat een medewerker het
   berekende getal pas als recht ziet wanneer de eigenaar de poort opent. Vier
   mutaties (poort genegeerd, open zonder toets, ziekte zonder opbouw, een
   dag zonder contract stil overgeslagen) laten hem alle vier zakken.

**P1**

- Alle planners van een zaak lezen het verzuimregister (weekrooster, de twee
  autoplanners, OV, festival, taxi); de school heeft een eigen register.
- Een vervanger krijgt zijn dienst in het rooster.
- Dienst ruilen.
- Overdracht breder dan de horecawijk.
- Meldingen uitstellen tijdens beschermde vrije tijd (2.9).
- Een toets die bewaakt dat geen andere laag het grootboek leest (2.10).
- De jobs op de tikker.

**P2**

- Werkelijke impact uit de klok (schakel IMPACT).
- De gezondheidsmaten die nu `nietGemeten` zijn.
- Kleine menselijke momenten (jubileum, geboorte, terugkeer) als uitbreiding
  van de verjaardag, pas na expliciet beleid.
- De opleidingsbehoefte laten oppakken zodra er een Academy is.

---

## 8. Wat dit document niet zegt

- **Dat de lus werkt voor een echt team.** Hij werkt op een teambeeld dat de
  toets opbouwt. Of een echt rooster er zo uitziet, meet pas de adapter.
- **Dat de gelijktijdigheidstoets de productiesituatie dekt.** De motor is
  synchroon, en in één Node-proces kan geen tweede verzoek tussen lezen en
  schrijven komen. Zodra er duurzame opslag of meerdere processen bij komen,
  moet die toets opnieuw worden gevoerd.
- **Iets over een echte mens.** Het proefbeleid is geen beleid, en er is nog
  niemand door deze lus gelopen.
