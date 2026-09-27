# RTG Vrijheid — tijd, rust, vrijheid en eerlijkheid voor wie bij RTG werkt

*Experience the elite class — from the inside.* De medewerker werkt voor RTG,
maar leeft niet voor RTG.

Een richtingsdocument zoals `PLANNING.md` en `ARBEID.md`: per onderdeel staat
erbij of het **staat**, **deels** staat, **een besluit vraagt** of **ontbreekt**.
De code staat in `server/kern/vrijheid/`, de bewijzen in
`test/vrijheid.test.js` en `test/vrijheid-lus.test.js`.

De stand vandaag, machineleesbaar in `server/kern/vrijheid/lus.js`:

**PEOPLE_TIME_STATUS = BLOCKED.** De motor is gebouwd en bewezen op een
teambeeld. De bronnen die dat teambeeld in productie vullen, de route, het
scherm en de loonstrook zijn nog niet aangesloten, en de beleidswaarden zijn
nog niet vastgesteld. Dat is par. 7.

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
| Verjaardag | ONTBREEKT | staff draagt geen geboortedatum; `md.geboren` staat bij het lid | NIEUW: alleen `MM-DD`, zelf opgegeven |
| Verlof en ziekte | DEELS, en dubbel | `server/kern/payroll/verzuim.js` én `db.data.verlof` via `server/routes/staff/dienst.js` | BOTST: twee opslagen, zie par. 4 |
| Vakantiesaldo | ONTBREEKT | geen teller in dit huis | NIEUW als teller in `categorieen.js`; het RECHT komt van contract en payroll |
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

Negentien modules in `server/kern/vrijheid/`, allemaal onder de 10 kB en zonder
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
4. De teambeeld-adapter: `employment` + staff + een zelf opgegeven verjaardag
   + een rooster + `vakbewijs`.
5. De eigen collectie op `db.data` (`server/kern/eigencollectie.js`) en
   duurzaam vastleggen voor een besluit (`server/lib/duurzaam.js`).
6. Routes (`/api/staff/tijd`, verzoek, aanbod aanvaarden; leidinggevende:
   beoordelen, verdelen), met een toets op een echte server, en het scherm
   *Mijn tijd*.
7. `samenstellen.js` leest de nieuwe categorieën.

**P1**

- De rooster-adapter schrijft terug (`pas`/`heeft`).
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
