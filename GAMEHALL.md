# RTG Game Hall — product- en architectuurspecificatie

Dit bestand beschrijft wat RTG Game Hall wordt: geen upgrade van negentien
spellen, maar één gaming-platform waarin die negentien de eerste content zijn.
`README.md` beschrijft wat er **nu** staat; dit bestand beschrijft wat er
**bij komt** en — belangrijker — welke bestaande regels dat begrenzen.

Het is geschreven op de code die er is. Elke laag hieronder zegt of hij al
bestaat, en zo ja waar. Wat er niet in staat is een wensenlijst: er staat bij
elke keuze waarom hij zo is, en bij elke botsing met een bestaande regel welke
van de twee wint. Die botsingen zijn het punt van dit document — een spec die
ze verzwijgt levert code op die pas in de zesde week vastloopt op een regel die
er de hele tijd al stond.

**Leesvolgorde bij twijfel:** `LAT.md` (hoe we bouwen) → dit bestand (wat we
bouwen) → `CLAUDE.md` (hoe het eruitziet en klinkt).

---

## 1. Wat Game Hall is

Eén wereld waarin leden spelen, kijken, uitdagen, samenkomen, toernooien
houden en partijen voortzetten die dagen of weken duren. De belofte is niet
"er zitten ook spelletjes in RTG" maar "RTG heeft een eigen gaming-platform".

Dat moet op drie niveaus kloppen, en ze zijn niet uitwisselbaar:

1. **De spellen zelf** — elk met een eigen wereld, niet negentien keer dezelfde
   kaart met een andere titel.
2. **De sociale laag eromheen** — spelen ontstaat waar mensen al samen zijn
   (een chat, een klas, een groep, een huiskamer), niet in een app waar je
   eerst naartoe moet.
3. **De motor eronder** — één sessiemotor, één zichtmodel, één replay, één
   leeftijdsbeleid. Geen enkel spel hoort zijn eigen lobby, zijn eigen
   toernooi of zijn eigen kijkregels te schrijven.

### Wat het uitdrukkelijk niet is

- **Geen engagement-machine.** `CLAUDE.md` verbiedt kunstmatige urgentie en
  oneindige scroll-trucs. Game Hall heeft dus geen eindeloze feed, geen
  reeksen ("7 dagen op rij!"), geen aftelklok die je terugroept, en geen stand
  die zakt omdat je een week niet speelde. Wat er wél mag staat in §15.
- **Geen tweede sociale structuur.** Vrienden, klasgenoten, gezin en teams
  bestaan al. Game Hall bouwt daar geen kopie naast; de kring komt uit
  `kern/spellen/kring.js`, één keer.
- **Geen pay-to-win en geen lootbox.** Zie §19.
- **Geen marketingsite.** Game Hall zit achter de inlog, net als de rest.

---

## 2. De vijf speelvormen

De gebruiker ziet één Hall; de motor kent vijf vormen omdat ze technisch
verschillen in wie er tegelijk moet zijn en wat er bewaard wordt.

| Vorm | Aanwezigheid | Wie bewaakt de staat | Bestaat nu |
|---|---|---|---|
| **Live** | iedereen tegelijk | server, per zet | ja (alle 16 potjes) |
| **Async** | niemand tegelijk | server, per zet, met een klok per beurt | **ja** — zes spellen (§7) |
| **Party** | fysiek bij elkaar, één gedeeld scherm | server, met een aparte projectieweergave | nee (§9) |
| **Arcade** | alleen jij | client — en dat is het probleem van §13 | ja (3 spellen) |
| **Foundation** | klas of gezin | server, zonder blijvend spoor | ja, impliciet (§16) |

Een spel kan meerdere vormen dragen. Schaken is Live én Async. Quizduel is
Live, Party én Foundation. Dat staat straks in de descriptor (§4) en niet in
een lijst per laag — dat was precies de fout die `spellen/register.js` heeft
opgeruimd.

---

## 3. Wat er al staat

Dit is de eerlijke inventaris, want de helft van de visie leunt op dingen die
er al zijn. Ze opnieuw bouwen zou de duurste vorm van vooruitgang zijn.

**De spellenkern** (`server/kern/spellen/`)

| Wat | Waar | Staat |
|---|---|---|
| Zelfbeschrijvend register, luid bij een fout | `spellen/register.js` | af |
| Lobby, uitnodigen, wachtrij, teamstand | `spellen/lobby.js` | af, met tempo |
| Partij, zet, opgeven, meekijken, toewijzen | `spellen/partij.js` | af, drie zichtlagen (§6) |
| Zicht: speler / kijker / publiek | `spellen/zicht.js` | **nieuw, af** |
| Klok per beurt, tempo, vervaltermijn | `spellen/klok.js` | **nieuw, af** |
| Toernooien: knockout + roundrobin | `spellen/toernooi.js`, `toernooi-schema.js` | af, mist Swiss/poules |
| Replay per partij | `spellen/zetten.js` | af, 500 zetten / 30 dagen |
| Uitslagen, stand, prestaties | `spellen/uitslagen.js`, `prestaties.js` | af |
| Progressiegrens (18+) | `spellen/grens.js` | af, één plek |
| Kring (vrienden/klas/gezin) | `spellen/kring.js` | af, één plek |
| Praten in het potje via `kern/comm` | `spellen/praat.js` | af |
| Aanwezigheid als afgeleide van SSE | `spellen/presence.js` | af |
| Teams, telemetrie, opruiming | `teams.js`, `telling.js`, `opruimen.js` | af |
| Rahul als spelmaatje (blind) | `spellen/rahul.js` | af, zie §11 |

**Gedeelde clientlagen die Game Hall nodig heeft en die al bestaan**

| Wat | Waar | Waarvoor in Game Hall |
|---|---|---|
| Zwevende vensters, dock, tweede monitor | `public/shared/vensters.js` | Desktop Game Space (§9) |
| QR/streepjescode lezen, lokaal, geen extern pakket | `public/shared/scanner.js` | telefoon koppelen aan groot scherm (§9) |
| Levende gesloten RTG-code | `public/shared/dyncode.js`, `app-rtgcode.js` | de kamercode op het scherm (§9) |
| Now-playing over BroadcastChannel + localStorage | `public/shared/speler.js` | **het patroon** voor tweede-schermsynchronisatie |
| Scherm rand tot rand | `public/shared/volscherm.js` | Big Screen Mode |
| Twee apps naast elkaar | `public/shared/split.js` | chat naast spel op tablet |
| WebRTC-mesh (video, tot 100) | `public/shared/teamcall.js` | spelen tijdens een call (§10) |
| Toegankelijkheid, server als eigenaar | `public/shared/toegankelijk.js` + `basis.js` | §17 |
| Gesprekken met bijlagen, `meta.sleutel` idempotent | `server/kern/comm/` | games in de chat (§10) |

| Beleid: alle toetredingsvragen op een plek | `spellen/beleid.js` | **nieuw, af** |

**Wat er dus echt nieuw is:** ~~de klok per beurt~~, ~~het zichtmodel met drie
lagen~~, ~~de policylaag~~ — die drie staan er nu (fase 0). Wat rest: de
projectiekamer, de challenge-motor en de nabespreking. De rest is aansluiten op
wat er staat.

---

## 4. De descriptor v2

Een spel beschrijft zichzelf. Dat blijft, en het wordt uitgebreid — met dezelfde
discipline die er nu op zit: **wat je vergeet laat de server niet opstarten, en
elke standaardwaarde is de veilige.**

```js
const spel = {
  sleutel: 'schaak', naam: 'Schaken',

  // ---- bestaat al ----
  max: 2, min: 2, wereld: 'rtg',
  volwassen: false, buitenBeurt: [], teams: null, perTaal: false,
  init, zet, statisch,

  // ---- nieuw: welke vormen dit spel draagt (GEBOUWD) ----
  vormen: ['live', 'async'],          // standaard ['live']

  /* De tempolijst zelf staat NIET hier maar in ./klok.js, en dat is een
     correctie op de eerste opzet van dit document. Een spel zegt of het async
     KAN; wélke tempi er bestaan (30s / 5m / 15m / 6u / 12u / 24u / 72u) is een
     eigenschap van het platform, want ze zijn voor elk async spel hetzelfde.
     Zestien eigen lijstjes zijn zestien plekken waar '12u' kan gaan afwijken
     zonder dat iemand dat besloot. Een spel dat later een eigen set nodig heeft
     voegt er een toe; dán is dát de uitzondering die om uitleg vraagt. */

  // ---- nieuw: het zichtmodel, drie lagen (§6) — GEBOUWD ----
  zicht: {
    speler:  (p, st, mij) => ({ ... }),   // verplicht (was: view)
    kijker:  ZONDER_SPELER,               // of een eigen functie, of weglaten
    publiek: (p, st) => ({ ... })         // weglaten = niet te projecteren
  },

  // ---- nieuw: presentatie per scherm ----
  presentatie: ['telefoon', 'tablet', 'desktop', 'grootscherm'],

  // ---- nieuw: party-rollen (§9) ----
  rollen: null,                        // of: ['omschrijver', 'rader']

  // ---- nieuw: wat het platform met dit spel mag ----
  toernooi: true,                      // standaard: af te leiden uit min<=2
  ranked: true,                        // standaard false — zie §15
  varianten: { ... },                  // Game Creator, §22

  // ---- arcade ----
  vorm: 'arcade', werelden: ['rtg','rtf'], maxPunten: 999999,
  serverScore: false,
  modi: ['klassiek', 'sprint'],        // standaard ['klassiek']
  dagelijks: false,                    // vereist serverScore (§13) — hard
  ghost: false                         // vereist een naspeelbaar verloop (§13)
};
```

**Vier regels die het register erbij krijgt, elk met een reden:**

1. **`view` heet `zicht.speler`, en `kijken: true` verdwijnt.** Vandaag betekent
   `kijken: true` "roep dezelfde weergave aan met `mij = null`". Dat werkt bij
   vijftien spellen en gaat bij 30 Seconden mis, want `indexOf(null)` is `-1`
   en de rader wordt herkend op zijn index. Dat is nu opgelost door meekijken
   uit te zetten. In v2 is het opgelost door de vraag te stellen: er is een
   aparte kijkweergave of er is er geen. Zie §6.
2. **`dagelijks: true` zonder `serverScore: true` laat de server niet
   opstarten.** Een dagchallenge is een competitie tussen vreemden op één bord;
   een score die de client zelf rekent hoort daar niet in. Dit is de enige
   nieuwe harde koppeling in het register, en hij staat er omdat `TAKEN.md` 5.22
   deze precies als voorwaarde noemt.
3. **`ranked` staat standaard uit.** Een spel komt niet in de competitieve laag
   omdat iemand vergat het uit te zetten.
4. **`publiek` weglaten = niet te projecteren.** Zelfde vorm als `kijken`
   vandaag: de gevaarlijke stand is de standaard-uit-stand.

De scan blijft luid: een module in `spellen/` zonder geldige descriptor laat de
server niet starten, met de bestandsnaam én het ontbrekende veld in de melding.

---

## 5. De lagen

```
RTG GAME HALL
│
├── Catalogus            register.js                       bestaat
├── Sessiemotor          lobby.js + partij.js → room.js    uitbreiden (§8)
├── Matchmaking          lobby.js (wachtrij per spel/maat) uitbreiden (tempo)
├── Async-klok           NIEUW  spellen/klok.js            §7
├── Toernooien           toernooi.js + toernooi-schema.js  uitbreiden (§14)
├── Party / Projectie    NIEUW  spellen/projectie.js       §9
├── Replay               zetten.js                         uitbreiden (§11)
├── Zicht                NIEUW  spellen/zicht.js           §6
├── Challenges           NIEUW  spellen/challenge.js       §13
├── Progressie           grens.js + uitslagen.js           uitbreiden (§15)
├── Beleid & leeftijd    NIEUW  spellen/beleid.js          §18
├── Meldingen            presence.js + nudge → §7          uitbreiden
├── Rahul-intelligentie  rahul.js + NIEUW nabespreking.js  §11
└── Presentatie          client                            §9, §19
        ↓
   19 spelmodules — ongewijzigd tenzij ze een nieuwe vorm dragen
```

De volgorde is de inhoud, net als in `kern/spellen.js`: een laag die een andere
leest komt erna. Twee late bindingen blijven nodig en krijgen hun reden in de
kop, precies zoals `comm` en de opruimhaken dat nu doen.

**Eén regel over deze lagen die niet onderhandelbaar is:** in geen enkele
platformlaag staat een spelnaam. Dat geldt vandaag voor `lobby.js`,
`partij.js` en `spellen.js`, en het is de reden dat een spel toevoegen één
bestand is. Elke nieuwe laag erft die eis. Wie in `projectie.js` een
`if (soort === 'seconden')` schrijft, heeft de descriptor omzeild.

---

## 6. Het zichtmodel: het einde van `kijken: true` — **gebouwd**

Dit is de belangrijkste architectuurwijziging, en hij lost een bestaand
probleem op in plaats van er een nieuw omheen te bouwen.

Er waren twee weergaven: de speler kreeg `view(p, st, mij)`, de kijker dezelfde
functie met `mij = null`, en `kijken: true` in de descriptor zei dat dat tweede
veilig was. Dat is elegant — er is geen tweede weergave die kan gaan afwijken.

**Maar die vlag was een bewering, en niemand had hem nagemeten. Hij klopte bij
drie van de zestien spellen niet:**

| Spel | Wat er misging | Gevolg |
|---|---|---|
| 30 Seconden | de kaart wordt verborgen voor de **rader** op zijn spelersindex; `indexOf(null)` is `-1` en dus nooit de rader | de kijker zag de kaart juist **wél** — bekend, en daarom stond meekijken uit |
| Reactieduel | `st.tijden[mij].length` met `mij = null` | **uitzondering → 500** |
| Schatduel | `st.antwoorden[mij].length` met `mij = null` | **uitzondering → 500** |

De laatste twee stonden gewoon op `kijken: true`. Ze konden er stil in zitten
omdat geen enkele toets `spelKijk` op die twee aanriep, en de catalogustoets
alleen naar de vlág keek — niet naar wat de weergave deed. Meekijken bij een
Reactieduel of Schatduel gaf dus een serverfout, voor iedereen, altijd.

**Met één nuance die erbij hoort:** `/api/member/spel/kijk` en de RTF-tegenhanger
bestaan en zijn routeerbaar, maar **geen enkele client roept ze aan** — meekijken
is vandaag alleen een API en heeft nog geen scherm. De fouten waren dus echt en
bereikbaar voor wie de API aanspreekt, en niet zichtbaar voor wie de app
gebruikt. Dat maakt ze niet minder waar; het verklaart waarom ze er zo lang in
konden zitten, en het is precies de reden dat de spectator-laag (§8) een eigen
scherm nodig heeft voordat er iets op geleund wordt.

Gevolg voor het ontwerp: 30 Seconden — het spel dat het meest om een gedeeld
scherm vraagt — kon als enige juist niet op een gedeeld scherm.

**Drie lagen, expliciet per spel:**

| Laag | Wie krijgt hem | Bevat |
|---|---|---|
| `zicht.speler(p, st, mij)` | een deelnemer | alles wat híj mag zien, inclusief zijn hand |
| `zicht.kijker(p, st)` | een vriend die meekijkt | wat openbaar is aan tafel |
| `zicht.publiek(p, st)` | het gedeelde scherm | alleen wat iedereen in de kamer al weet |

Bij 30 Seconden is `publiek` dan: de score, de klok, wiens beurt het is — en
níet de kaart. Bij Magnaat is `publiek`: het bord, bezittingen, openbare
transacties — en niet de geheime biedingen. Bij Schaken zijn `kijker` en
`publiek` gelijk, want er is geen verborgen informatie; dat mag, maar het moet
opgeschreven staan.

**Waarom niet één functie met een rolparameter?** Omdat dat precies de vorm is
waarin de fout is ontstaan: één functie die uit een index afleidt wie je bent.
Drie functies kunnen niet stilletjes in elkaars gat vallen.

**Vijftien spellen kunnen hun kijkweergave wél uit de spelerweergave halen**, en
daar vijftien bijna-kopieën naast zetten zou ze laten uiteenlopen. Die zeggen
`kijker: ZONDER_SPELER` — een claim, geen vlag. Het verschil is dat de claim
wordt **nagerekend**: `zicht.lekken()` vergelijkt wat een niet-speler ziet met
wat elke echte speler ziet, en meldt elk veld dat voor iemand verborgen is en
aan een kijker wel getoond wordt. Dat is exact de vorm van alle drie de fouten
hierboven.

**Hoe dit bewaakt wordt** (`test/spelkijken.test.js`, `test/spelregister.test.js`):

- de lekcontrole draait over élk spel dat `ZONDER_SPELER` claimt;
- er staat een **positieve controle** naast — de bewaker moet 30 Seconden nog
  steeds kunnen vinden — want een bewaker die niets kan vinden is geen bewaker;
- elke kijkweergave wordt echt aangeroepen via `spelKijk`, bij elk spel dat er
  een heeft (dat was de toets die ontbrak);
- geen projectie mag iets tonen wat de spelerweergave voor iemand verbergt;
- het register weigert `view` en `kijken` **luid** in plaats van ze stil te
  vertalen: automatisch omzetten zou de drie fouten meenemen naar de nieuwe
  vorm en er de schijn van een besluit aan geven.

Acht mutaties gemeten, zeven raak. De achtste staat in de open punten: de
tempo-term in de vervaltermijn is vandaag onobserveerbaar (§7).

Eén valkuil die bij het meten bovenkwam en die in de toets staat: de eerste
versie van de lekcontrole bouwde elk potje met alleen `init` en vond daarom
niets bij 30 Seconden — er ligt dan nog geen kaart. Een spel waarvan het geheim
pas ná een zet ontstaat heeft een openingszet nodig, en de toets controleert
dat zo'n openingszet de staat écht verandert.

---

## 7. Tempo: Live, Relaxed, Long Play

Async is een kernfunctie, geen instelling. Drie tempi, per potje gekozen bij het
starten:

| Tempo | Per beurt | Bedoeld voor |
|---|---|---|
| Live | 30s / 5m / 15m | samen aan tafel of tegelijk online |
| Relaxed | 6u / 12u | een partij die over de dag loopt |
| Long Play | 24u / 72u | Magnaat, en tien schaakpartijen tegelijk |

De klok telt niet zichtbaar af bij Relaxed en Long Play. Je ziet
`JOUW BEURT — nog 18 uur`, en verder niets. Een aftellende klok op een
partij van drie dagen is precies de kunstmatige urgentie die `CLAUDE.md`
verbiedt.

**Wat er bij een verlopen klok gebeurt, is een productbesluit en geen detail.**
Drie opties, en de keuze is de derde:

1. Verlies door tijd. Eerlijk in een competitie, hard in een vriendenpotje.
2. Niets — de partij blijft eeuwig staan. Dat is de huidige situatie en het is
   de reden dat `opschonen` na dertig dagen moet ingrijpen.
3. **De klok verloopt naar een aanbod, niet naar een uitslag.** Bij het
   verstrijken krijgt de tegenstander de knop "partij toewijzen". Doet hij
   niets, dan gebeurt er niets. In een **ranked** partij (§15) en in een
   toernooiwedstrijd verloopt de klok wél automatisch, want daar hangt een
   uitslag aan een afspraak.

**Drie bestaande regels die hierop aangepast moeten worden — en dit is het soort
gevolg dat je later niet meer terugvindt:**

- `opruimen.js` gooit een potje met status `bezig` weg na dertig dagen, gemeten
  op `zetAt`. De vervaltermijn komt nu uit `klok.vervalMs` en volgt het tempo.
  **Let op: dat is vandaag geen gedragsverandering, en de eerste versie van deze
  paragraaf had het mis.** De redenering was "zes spelers met 72 uur per beurt
  lopen tegen die maand aan"; nagerekend klopt dat niet. `zetAt` reset bij elke
  handeling aan tafel, dus de langste stilte die legitiem kan ontstaan is één
  speler die zijn volle beurt opmaakt — bij 72 uur precies drie dagen. En
  `10 × 72u` is toevallig exact dertig dagen, dus de formule geeft bij elk
  bestaand tempo hetzelfde antwoord als het vaste getal. Het is een **naad**:
  de regel staat nu uitgesproken op één plek in plaats van als getal in een
  `if`, en hij schuift mee zodra er een tempo boven 72 uur komt.
- `zetten.js` kapt af op 500 zetten per partij. Voor Magnaat *zoals het nu is*
  haalt een campagne van drie weken dat niet; met de economie van §12 (bieden,
  onderhandelen, veilingen, herstructureren — allemaal buiten de beurt) wél.
  Dat is een projectie en geen meting, en het hoort gemeten te worden vóór de
  economie er staat.
- `nudge()` duwt via SSE naar wie online is. Bij Async is de speler per
  definitie offline. Er komt dus één herinnering per beurt — **één**, aan de
  speler die aan zet is, uitzetbaar, en zonder "je tegenstander wacht al twee
  dagen"-formulering. Dat is geen smaak: schuldgevoel als motor is dezelfde
  mechaniek als een reeks.

---

## 8. De Game Room

Onder alle multiplayer ligt één sessieobject. Vandaag heet dat `potje` en het
draagt `{ id, soort, grootte, modus, taal, teams, spelers, uitgenodigd, status,
beurt, winnaar, at, zetAt, door }`. Dat wordt uitgebreid, niet vervangen:

```js
{
  id, soort, variant,          // variant: Game Creator (§22), standaard null
  vorm,                        // 'live' | 'async' | 'party'
  tempo,                       // null bij live-aan-tafel
  spelers, uitgenodigd, teams, host,
  publiek: { code, tot },      // projectiekamer, §9 — null als er geen scherm is
  context,                     // 'hall' | 'chat' | 'salon' | 'school' | 'werk' | 'reis'
  bron,                        // bv. 'gesprek:ab12' — waar hij vandaan komt, §10
  beleid,                      // afgeleid, nooit uit het verzoek — §18
  status, beurt, beurtTot, winnaar, at, zetAt
}
```

**`context` selecteert beleid, geen regels.** Quizduel vanuit een schoolklas is
hetzelfde spel met dezelfde motor; wat verschilt is wie mag meekijken, of er iets
bewaard wordt en welke vragenbron open staat. Vier quiz-apps bouwen zou vier keer
dezelfde bugs opleveren.

**`beleid` wordt afgeleid en komt nooit uit het verzoek.** Dat is dezelfde regel
als bij `online` in `routes/spellen.js`: de kring komt van de server, want een
client die zijn eigen lijst mag meesturen kan aftasten. Een client die zijn
eigen beleid mag meesturen kan een 18+-spel als schoolsessie openen.

---

## 9. Party Mode en Big Screen

De grootste wauw-functie, en de enige met een echte beveiligingsvraag.

**Het beeld:** zes mensen in een vakantiehuis. Eén opent Game Hall op de tv.
Er verschijnt `RTG GAME NIGHT` met een code. Iedereen scant hem; vanaf dat
moment is elke telefoon een persoonlijke controller en toont de tv de gedeelde
wereld.

**De vraag die eerst beantwoord moet worden: wat is dat scherm?** Een lid met
een sessie? Dan staat er een ingelogd account op een tv in een hotellobby. Het
antwoord is nee:

> **Een groot scherm is een projectie, geen deelnemer.** Het heeft geen sessie,
> geen sleutel en geen identiteit. Het ontvangt uitsluitend
> `zicht.publiek(p, st)` en het kan niets terugsturen — geen zet, geen chat,
> geen antwoord. Een projectiekamer heeft een korte code met een vervaltijd, door
> de host gemunt, en die vervalt als de host weggaat.

**Gebouwd** (`spellen/projectie.js` + `public/apps/spelscherm.html`, fase 1). De code
is bewust weinig waard: hij geeft één potje, hij verloopt na twee uur of zodra
het potje weg is, en er kan niets terug — wie hem heeft ziet wat iedereen in de
kamer toch al ziet. Het is de **enige spelingang zonder inlog**, en dat is de
hele opzet: een televisie in een vakantiehuis hoort geen ingelogd RTG-account te
dragen. `GET /api/projectie/:code`, met een rem tegen brute kracht.

Twee dingen die daaruit volgen en die het model bevestigen: **30 Seconden kan nu
wel op een scherm** (score, klok en wie raadt — de kaart zit niet in die laag,
dus het scherm *kan* hem niet krijgen), en **Proost kan het niet**, want die
poort is 18+ en een projectie heeft geen leeftijd. Dat tweede volgt uit een
ontbrekende `zicht.publiek` en niet uit een aparte regel.

Wat er níet in zit: telefoons koppelen aan het scherm. Die spelen gewoon in hun
eigen app mee; een scanflow die een toestel aan een scherm bindt hoort bij Game
Night, en dan koppel je mensen aan een sessie — een ander onderwerp met andere
vragen.

Dat sluit de 30 Seconden-lekkage structureel: het scherm kán de kaart niet
krijgen, want die zit niet in de laag die het ontvangt.

**Twee koppelwegen, allebei op bestaande code:**

| Weg | Waarmee | Wanneer |
|---|---|---|
| Scannen | `shared/scanner.js` + `shared/dyncode.js` | tv en telefoons in dezelfde kamer |
| Tweede tab / monitor | `shared/speler.js`-patroon (BroadcastChannel) | zelfde toestel, tweede scherm |

Het tweede is de goedkoopste eerste stap en werkt vandaag al voor muziek: één
kant zendt de stand, de andere toont hem, met localStorage als geheugen zodat
een net geopend scherm meteen bij is. Datzelfde patroon draagt een spelbord.

**De vier presentatievormen** komen uit één staat en zijn geen vier apps:

| Vorm | Toont |
|---|---|
| Telefoon | persoonlijke bediening — je hand, je knoppen |
| Tablet | bord + bediening |
| Desktop | volledige omgeving, panelen via `shared/vensters.js` |
| Groot scherm | uitsluitend `zicht.publiek` |

**Game Night** (§16 van de visie) is een geplande reeks in één room: één keer
joinen, het centrale scherm wisselt van spel. Rahul stelt het programma samen
uit aantal, leeftijden en beschikbare tijd. Twee harde randen: een spel dat de
groep niet aankan komt er niet in (Magnaat is zes, dus bij zeven mensen valt
hij af of er wordt geroteerd — de motor moet dat zeggen, niet de gastheer laten
ontdekken), en een 18+-spel komt niet in een programma waar iemand onder de
grens meedoet.

---

## 10. Games in de chat

Game Hall mag geen eiland zijn. Een spel hoort te ontstaan waar mensen al samen
zijn. **De chat ís de lobby** — je selecteert nooit opnieuw spelers.

**De architectuurregel, en die is niet nieuw:**

> Chat organiseert het sociale moment; Game Hall bezit het spel.

`kern/comm` krijgt dus geen spellogica. Een bericht draagt een bijlage — dat
kan het al (`bericht.js` kent `bijlage`, `dm.js` gebruikt het voor posts en
mediastukken) — en die bijlage bevat een verwijzing: `{ soort: 'spel',
sessie, spel, tempo, status }`. De partij blijft volledig eigendom van de
spellenkern.

**De poort, en dit is de plek waar de visie botst met een bestaande regel.**
`kring.js` zegt: *een potje geeft geen nieuw recht om iemand te bereiken* —
praten in een potje kan alleen als élk paar aan tafel elkaar buiten dat potje
ook al mag bereiken. Vanuit een chat een spel starten is de omgekeerde richting
en dus veilig: wie al praat, mag al praten.

Maar `comm` kent twaalf gesprekssoorten, waaronder `business`, `order`,
`support`, `government` en `marketplace`. In zo'n gesprek zitten mensen die
elkaar niet kennen; een Game-knop daar zou via de achterdeur doen wat
`kring.js` aan de voordeur tegenhoudt.

> **De Game-knop verschijnt alleen in een gesprek waarvoor
> `elkPaarKent(deelnemers)` waar is** — dezelfde functie uit `kern/spellen/kring.js`,
> aangeroepen en niet gekopieerd. In de praktijk: `personal`, `group`, en
> `school` binnen de eigen klas. Niet in een zakelijk of ondersteuningsgesprek.

En: de kaart in de chat is geen tweede uitnodigingspad. Hij roept `spelNieuw`
aan, met alles wat daar al aan hangt — `wereldFout`, `leeftijdFout`, het
uitnodigingsbudget. Een tweede weg naar een potje is een tweede weg langs de
poorten.

**Wat de chat terugkrijgt.** Alleen wat een gebeurtenis is, nooit elke zet:
gestart, iemand doet mee, afgelopen met uitslag, en bij Magnaat een bod of een
aanbod. Er komt een aparte `Game activity`-sectie zodat een groepschat niet
volloopt.

**Spelobjecten in een bericht.** Bij Magnaat kan een deal de chat in
(`Voorstel — Hotel Barcelona — €1.250.000 — geldig tot morgen 18:00`), en bij
Schaken een zet met een opmerking die de replay op zet 24 opent. Dat is een
bijlage met een verwijzing, en het accepteren gebeurt in het spel — niet in de
chat. Anders zou de chat een tweede plek zijn waar de spelstaat verandert, en
dan bestaat er geen enkele plek meer die hem bewaakt.

**Meekijken vanuit de chat** volgt gewoon `zicht.kijker`: bestaat die niet
(30 Seconden), dan verschijnt de knop niet.

**Bellen en spelen tegelijk** kan op `shared/teamcall.js` (WebRTC-mesh, het
beeld gaat nooit over de server). Op desktop: spel centraal, videovensters
eromheen via `shared/vensters.js`.

Dezelfde ingang geldt breder: Salon-groepen, Foundation-klassen, Work-teams,
Hospitality en reisgezelschappen starten allemaal via dezelfde Game Session
Engine met een andere `context`.

---

## 11. Replay, hoogtepunten en Rahul als coach

**Replay bestaat al** (`spellen/zetten.js`) en heeft de goede eigenschappen: het
platform schrijft (niet elk spel apart), alleen geaccepteerde zetten, een
bovengrens per partij die de oudste zetten weggooit en dat er ook bij zegt, en
alleen de spelers zelf mogen hem zien — óók onder de 18+-grens, want je eigen
partij terugkijken telt niets op.

**Wat eraan moet:** de zetten worden opgeslagen "zoals ze binnenkwamen, zonder te
weten wat ze betekenen". Voor een naspeelbare replay is dat genoeg; voor
hoogtepunten en coaching niet — je kunt uit `{ actie: 'koop', veld: 12 }` geen
keerpunt afleiden zonder de spelregels. De oplossing is **niet** het platform
laten begrijpen wat een zet betekent, maar het spel een optionele
`gebeurtenis(zet, st)` laten teruggeven die een genormaliseerde regel oplevert
(`ASSET_PURCHASED`, `ROUND_ENDED`, `BID_PLACED`). Geen `gebeurtenis` = geen
hoogtepunten, en de replay werkt gewoon. Zo blijft het platform spelnaamloos.

**Hoogtepunten** (`KEERPUNT`, `GROOTSTE COMEBACK`, `BLUNDER — zet 31`) worden
afgeleid uit dat verloop, en dus:

- ze leven zolang de replay leeft (dertig dagen, `bewaarbeleid.js`);
- ze zijn zichtbaar voor wie meespeelde, niet voor derden;
- ze worden **niet** opgeteld tot een profiel. Een hoogtepunt in je eigen
  partij is iets anders dan "je gemiddelde blunderfrequentie", en dat tweede
  komt er niet — niet voor kinderen en ook niet voor volwassenen. Dat is
  dezelfde lijn als `prestaties.js`: alleen wat behaald is, geen voortgang naar
  wat je "nog moet".

**Rahul als coach — twee deuren, en ze mogen elkaar niet raken.**

`spellen/rahul.js` krijgt vandaag bewust alleen het spel, wie aan zet is en jouw
vraag. Niet het bord, niet iemands hand. Hij *kan* dus niet verklappen, en dat
is een eigenschap van de code en niet van de prompt. Die deur blijft exact zoals
hij is.

De coach is een tweede deur: `spelNabespreking(mij, id)`, die de replay leest en
daarom álles ziet.

> **De nabespreking weigert een lopend potje.** Niet "we vragen hem geen hints",
> maar: `status !== 'klaar'` geeft een fout. Dat is toetsbaar met een mutatie —
> haal de controle weg en de toets zakt — en een prompt-instructie is dat niet.

**Gebouwd** (`spellen/nabespreking.js`, fase 1). Twee dingen die bij het bouwen
scherper werden dan het plan:

- De regel hangt aan *"staat het potje nog in `S().potjes` én loopt het"*, niet
  aan *"het potje moet bestaan"*. Een klaar potje verdwijnt na een dag, het
  verloop leeft dertig dagen — bond je de nabespreking aan het bestaan van het
  potje, dan verdwijnt hij precies wanneer je hem het vaakst wilt.
- Rahul krijgt de **zettenlijst zoals hij is opgeslagen**, plus de uitslag. Het
  platform legt niet uit wat een zet betekent, want dat weet het niet. Voor
  schaken is van-veld/naar-veld genoeg om over te praten; voor een spel waar
  dat niet genoeg is, komt de `gebeurtenis()` uit het begin van deze paragraaf.
  Wat er níet gebeurt is dat deze laag schaakkennis krijgt.

Zonder API-sleutel geeft dezelfde ingang een smalle, narekenbare samenvatting
(hoeveel zetten, hoeveel van jou, de uitslag). Analyse verzinnen die er niet is
zou erger zijn dan niets zeggen.

Bij Woordduel mag Rahul wél tijdens het spel taalhulp geven in een expliciete
**oefenmodus** (`variant: 'oefenen'`), en zo'n potje is per definitie niet
ranked en telt niet mee in de uitslagen.

---

## 12. Magnaat — The Living Economy

Het spel met verreweg de meeste productruimte, en het enige waar "meer" ook
werkelijk iets anders wordt: van een bordspel met geld naar een **server-
authoritatieve, AI-verrijkte, persistente economische simulatie op echte lokale
geografie**, waarin spelers altijd kunnen handelen, bedrijven van elkaar
afhankelijk zijn, en maatschappelijke ontwikkeling een zichtbare economische
actor is in plaats van een sausje.

Eén motor, drie ervaringen:

| Vorm | Duur | Tijdschaal | Wat het is |
|---|---|---|---|
| **Quick** | 60–90 min | 1 minuut ≈ 1 spelmaand | een avond met vrienden |
| **Campaign** | uren tot 30 dagen | dag ≈ week, of week ≈ jaar | een seizoen |
| **Living World** | geen einde | dag ≈ dag | een permanente economie |

Het verschil tussen de drie is **de klok en wat er blijft staan**, niet de
regels. Dat is de hele architectuurgedachte: drie spellen bouwen zou drie keer
dezelfde fouten opleveren.

---

### 12.1 Drie besluiten die het fundament zijn

**Het bordspel blijft.** Magnaat met 40 velden, dobbelstenen en huizen wordt
`variant: { vorm: 'bord' }`; de economie wordt `vorm: 'economie'`. Dat is bijna
gratis sinds §22 er staat, en niemand raakt een werkend spel kwijt — het bord is
bovendien de enige Magnaat die met zes mensen binnen een uur aan tafel te spelen
is.

**De kaart is echt, en één filter draagt het.** Gekozen: echte straten en
adressen uit open data. Wat dat veilig maakt is niet een belofte maar een
zeef die in de importeur zit: **alles met een woonfunctie valt eruit.** De BAG
kent per verblijfsobject een `gebruiksdoel` (woonfunctie, winkelfunctie,
kantoorfunctie, industriefunctie, logiesfunctie, bijeenkomstfunctie, …). Alleen
de niet-woonfuncties worden speelbaar kavel. Een echt adres in het spel is dus
per definitie een adres waar geen huishouden op staat ingeschreven, en dat is
een controleerbare regel in plaats van een goede bedoeling.

> **Wat er vandaag in de repo staat, en waarom dat minder is.** De importeur
> (`scripts/kaart-import.js`) is er en doet precies het bovenstaande. De data
> niet: de bouwomgeving waarin dit geschreven is laat geen verkeer naar PDOK of
> Overpass toe. Wat er nu ligt is één stad met **echte straatnamen en zones,
> zonder huisnummers**, en elk stadsbestand draagt een veld `bron` dat zegt waar
> het vandaan komt (`open-data` of `handmatig`). Zolang dat veld op `handmatig`
> staat is een kavel "Halkade, kavel 7" en geen "Halkade 12". Er staat dus
> nergens een adres dat doet alsof het uit een register komt.

**De AI verzint nooit een getal.** Vier lagen, en de volgorde is de regel:

```
Game server (waarheid)   geld, eigendom, contracten, timing, uitkomsten
   ↑
Simulation engine        vraag, aanbod, personeel, markten, groei
   ↑
Agent layer              AI-bedrijven, managers, gemeente, Foundation
   ↑
Generative AI            nieuws, dialoog, onderhandeling, uitleg
```

Nooit: *"de AI besluit dat je €5M verdiend hebt."* Wel: *"de engine rekent €5M
en de AI legt uit waardoor."* Dat is dezelfde regel als bij Rahul in het potje
(§11) en bij de dagopgave (§13), en hij is hier het strengst omdat er geld in
zit.

---

### 12.2 De wereld

**Een stad is zones, een zone is kavels.** Een zone draagt het karakter
(haven, boulevard, centrum, station, bedrijventerrein, strand, woonwijk-rand);
een kavel draagt de economische eigenschappen die de vision noemt:
bereikbaarheid (OV/auto/fiets/lopen), passanten per dagdeel, toerisme, zakelijke
vraag, huur- en grondwaarde, geluid, parkeren, afstand tot centrum en
luchthaven, concurrentiedruk, en geschiktheid per sector.

Die eigenschappen zijn niet per kavel met de hand geschreven — dat zou bij
duizend kavels een dataset van beweringen zijn. Ze worden **afgeleid** uit de
zone plus wat de open data over het pand zelf zegt (functie, oppervlak,
afstand tot station/centrum). Eén formule, controleerbaar, en hij verschuift mee
als de stad verandert.

**Synthetische bevolking, geen echte inwoners.** Segmenten (studenten, gezinnen,
toeristen, zakelijke reizigers, ouderen, nachtpubliek, budget, hoog inkomen) met
gedrag dat afhangt van dag, dagdeel, weer, seizoen, evenement, inkomen, prijs,
reputatie en bereikbaarheid. Er wordt geen enkele echte persoon gemodelleerd, en
dat is geen concessie: aggregaten zijn hier ook gewoon beter — je hoeft geen
LLM per burger te draaien, en dat is precies wat dit schaalbaar houdt.

---

### 12.3 Je bent nooit alleen aan de beurt

Dit is de mechaniek waar Long Play op staat of valt, en de descriptor draagt hem
al (`buitenBeurt`). Twee soorten handeling:

**Grote acties** — beurt- of cooldown-gebonden: een bedrijf kopen, groot bouwen,
een megacontract tekenen, fuseren, overnemen, een grote lening, een beursgang,
een nieuw gebied betreden.

**Vrije acties** — vrijwel altijd: prijzen, personeel, roosters, marketing,
onderhoud, onderhandelen, inkopen, training, bouw voorbereiden, rapporten,
biedingen, managers instellen, beleid wijzigen.

Zonder dat onderscheid staat een partij van zes met 24 uur per beurt zes dagen
stil tussen twee van jouw handelingen. Mét dat onderscheid heb je altijd iets te
doen zonder dat iemand tegelijk online hoeft te zijn.

---

### 12.4 De klok: bijrekenen, niet doortikken

De vision zegt "de server simuleert continu". De **uitvoering** wordt bewust
anders, en dat is een technische keuze met gevolgen die zichtbaar horen te
blijven: de wereld **rekent bij** wanneer iemand kijkt, op basis van de
verstreken tijd, in vaste stappen.

Waarom niet een achtergrondtik elke seconde:

- een wereld die doortikt terwijl niemand speelt schrijft de hele nacht naar de
  database, en dit huis heeft één proces en één bestand;
- een herstart mag geen uren economie kosten — bijrekenen overleeft dat, een tik
  niet;
- bijrekenen is **deterministisch en narekenbaar**: dezelfde begintoestand plus
  hetzelfde aantal stappen geeft dezelfde uitkomst, en dat is precies wat een
  toets nodig heeft.

Voor de speler is het verschil onzichtbaar, want dat is de bedoeling: je komt
terug en krijgt **Sinds je weg was** — omzet, kosten, personeel, leveringen,
bezetting, wat de concurrent deed. Dat overzicht is geen samenvatting van een
logboek maar het verschil tussen twee gerekende standen.

Wat er wél een echte achtergrondtik nodig heeft (een aflopend contract dat
niemand komt bekijken) krijgt die pas als er een geval is dat het aantoonbaar
vraagt. Nu bestaat dat geval niet.

---

### 12.5 RTFoundation is een economische actor

Van fictieve abonnementsinkomsten in de spelwereld gaat 30% naar de Foundation:
20% lokaal, 10% centraal. Dat geld wordt **zichtbaar besteed** — speeltuin,
sporthal, school, cultuur, bibliotheek, mobiliteit — en die projecten veranderen
de simulatie meetbaar: een sporthal verhoogt lokale aantrekkelijkheid, een
school verbetert op termijn het arbeidspotentieel, een park raakt leefbaarheid
en vastgoedwaarde.

Dat is het verschil tussen "RTG-branding in een tycoon-spel" en een spel dat
laat zien hoe commerciële activiteit en publieke voorziening elkaar voeden. Het
is ook de plek waar Magnaat een andere filosofie krijgt dan *rijkste speler
wint*.

---

### 12.6 Wat er nooit in komt

**Geen enkele echte betaling die spelmacht geeft.** Geen spelgeld kopen, geen
lootboxes, geen betaald voordeel, geen onderzoek versnellen met echt geld. Dit
is geen beleidsregel die later versoepeld kan worden: een tycoon-game waarin
geld werkt is precies het genre waar dat misgaat, en `CLAUDE.md` verbiedt het
al. RTG-lidmaatschappen mogen in de spelwereld bestaan als *structuur* (welke
diensten een fictief bedrijf afneemt), nooit als *voordeel*.

**Geen straf voor wegblijven.** Een permanente wereld is de makkelijkste plek om
per ongeluk een ratel te bouwen: kom je een week niet, dan ben je failliet. Dat
mag niet, en de vorm ervan is de **Safe Management Policy** uit de vision — wie
offline is, is beschermd: geen grote investeringen, cashbuffer bewaken,
essentiële kosten door, urgente problemen mitigeren, grote beslissingen wachten.
Alleen wie er expliciet voor kiest speelt agressiever door.

---

### 12.7 De progressiegrens, en waar hij hier bijt

`progressieMag` (§grens) zegt: alles wat een prestatie bewaart buiten het potje
bestaat alleen voor geverifieerd volwassen leden. Voor Magnaat betekent dat iets
scherps, en het volgt uit de bestaande regel in plaats van dat het er los op
gezet wordt:

- **Quick en Campaign zijn een potje.** Ze beginnen, ze eindigen, er blijft niets
  van over. Iedereen mag meedoen, precies zoals nu.
- **De Living World is per definitie progressie buiten een potje** — je bedrijf
  ís de opslag. Daar geldt de 18+-poort dus wel, en "je speelt gewoon, er wordt
  alleen niets bewaard" is er geen zinnige vorm van: een permanente wereld
  waarin niets bewaard wordt, is geen permanente wereld.

Dat is een echte beperking en hij hoort hier te staan in plaats van pas op te
vallen als een zestienjarige zijn concern kwijt is.

---

### 12.8 Wat de duur raakt aan bestaande grenzen

| Grens | Nu | Nodig |
|---|---|---|
| Verlaten partij | `klok.vervalMs` | **al opgelost, en het was geen probleem** — zie de correctie in §7 |
| Replay | 500 zetten, dan oudste weg | eigen budget; met bieden en onderhandelen buiten de beurt loopt een campagne daaroverheen. **Meet het vóór de economie er staat** |
| Buiten je beurt | `buitenBeurt: ['bouw','verkoop']` | uitbreiden met de hele vrije-actielijst uit §12.3 |
| `zicht` | klopt vandaag omdat alles aan tafel openbaar is | zodra er geheime biedingen zijn is dat niet meer waar; `kijker` en `publiek` krijgen dan een eigen functie. De waarschuwing staat in de descriptor zelf |

---

### 12.9 Fasering

**Fase A — de economie die je kunt spelen (Quick)** — **af.** De wereld (stad,
zones, 144 kavels met afgeleide eigenschappen), zeven sectoren op één
economische kern, de vraag (zes bevolkingssegmenten, seizoen, concurrentiedruk,
prijs, reputatie, marketing), de klok die bijrekent, de vrije acties naast de
grote, de Foundation als actor, en een eindstand op meer dan geld alleen:
vermogen, ondernemingswaarde, banen, reputatie en omzet.

**Een economie toets je door hem te spelen, en dat heeft twee gereedschappen
opgeleverd.** `scripts/magnaat-balans.js` meet per sector wat een goed
geplaatste zaak doet; `scripts/magnaat-strateeg.js` speelt 220 campagnes uit
met elf strategieprofielen tegen elkaar en vraagt of er één domineert. Het
tweede vindt wat het eerste per definitie niet kan zien.

**Vier ijkingen, elk na een meting die de vorige tegensprak:**

| # | Wat er mis was | Hoe het bleek |
|---|---|---|
| 1 | `omvang` was tegelijk de maandcapaciteit — veertig couverts per *maand* voor veertig stoelen. Alles draaide verlies en **minder personeel + geen onderhoud won** | een campagne uitspelen |
| 2 | de balansmeter mat bij een *vaste* maat; de winst zit in **op maat** bouwen, en daar liepen sectoren ver uiteen (logistiek 5,7 maanden, horeca 9,6) | de strateeg: één profiel won 100% |
| 3 | geijkt op het *beste* kavel, terwijl een campagne er tien opent — de **mediaan** telt | de strateeg opnieuw |
| 4 | een kavel nam in de ene sector **veertig keer** zoveel kapitaal op als in de andere; bij gelijk startkapitaal is dat een ander spel | de strateeg opnieuw |

Nu neemt elk kavel ongeveer tweehonderdduizend op en verdient zich in twaalf
maanden terug — een hotelplek draagt zes kamers, een winkelplek zesenzestig
kassaplekken. Het karakter van een sector zit in *hoe* hij werkt, niet in
hoeveel nullen erachter staan.

**Wat de strateeg hard afkeurt en wat hij alleen meldt**, want dat is niet
hetzelfde. Hard (en als toets vastgelegd): niets doen mag niet winnen,
afwachten mag niet meekomen met de actieve stijlen, er moeten minstens vier
levensvatbare stijlen zijn, en knijpen op personeel mag niet lonen. Zacht: of
een profiel te ver voorligt.

> **Wat er vandaag nog scheef staat, eerlijk opgeschreven.** Mobility-focus wint
> bijna al zijn duels en horeca-focus het merendeel. De vier ijkingen hebben het
> veld dicht bij elkaar gebracht — zes stijlen tussen 60% en 100% — maar wie
> zich op één sector stort doet het beter dan wie spreidt. De oorzaak is dat een
> duel van twee op 144 kavels **geen schaarste** kent: ze lopen elkaar nooit
> tegen het lijf. Dat verandert pas met fase B: contracten en veilingen laten
> spelers elkaar raken ook als ze in andere buurten zitten. Het staat hier als
> open punt en niet als opgelost.

**Fase B — spelers tegen elkaar** — **half af.** Contracten en veilingen staan;
aandelen en concerns, banken, verzekeringen en R&D nog niet.

**Contracten** (`magnaat/handel.js`, `handel-acties.js`). Vijf velden waarover
onderhandeld wordt: volume, bedrag, looptijd, kwaliteitseis en boete, plus
exclusiviteit en een vooruitbetaling. Vier besluiten die zichtbaar horen te
blijven:

1. **Een levering gaat vóór de vrije verkoop.** Je hebt getekend: die capaciteit
   is vergeven voordat de eerste klant binnenkomt. Zonder die volgorde is een
   contract gratis geld en tekent iedereen alles.
2. **Het bedrag staat vast, de behoefte niet.** De inkooppost van de afnemer
   beweegt met zijn omzet mee; het contract niet. Daarom is `looptijd` een
   keuze en geen formaliteit.
3. **Wie tekort komt levert pro rata én betaalt de boete.** Niet-betalen zou de
   afnemer belonen voor het uitknijpen van zijn leverancier.
4. **`koopt` verdeelt de bestáánde inkoopsom** en telt per sector op tot 1.
   Zonder contract rekent de economie dus precies als in fase A — een economie
   die anders rekent zodra er een laag bijkomt, is twee economieën.

**Veilingen** (`magnaat/veiling.js`, `veiling-acties.js`). Gesloten biedingen op
een vrij kavel of op een lopende zaak. Eerste prijs, geen tweede: theoretisch
netter, maar "ik bood 300.000 en betaal 210.000" is een regel die je aan tafel
drie keer moet uitleggen. De hamer valt op de **spelmaand**, niet op de klok —
anders verliest wie slaapt, en dat is de ratel uit §12.6. Er wordt bij het
bieden niets gereserveerd; wie bij de hamer niet kan betalen ziet hem aan zijn
neus voorbijgaan én staat met naam in de uitslag. **Een gekochte zaak komt met
zijn contracten mee**, want anders is verkopen een achterdeur uit elke
verplichting.

> **Wat de meting zei, en waarom dat de verklaring uit fase A corrigeert.**
> Fase A schreef de sectordominantie toe aan ontbrekende schaarste: twee spelers
> op 144 kavels lopen elkaar nooit tegen het lijf, dus contracten en veilingen
> zouden het oplossen. **Contracten lossen het niet op**, en waarom is nu
> gemeten in plaats van geraden: een restaurant koopt ~5% van zijn omzet aan
> vervoer in, dus een contract met 12% korting is 0,6% van zijn omzet. Dat
> kantelt geen duel.
>
> De echte oorzaak bleek elders, en er volgden drie ijkingen uit. **(5)** Een
> kavel droeg in de ene sector 132.000 omzet per maand en in de andere 28.000 —
> wie per plek vier keer zoveel kwijt kan, heeft vier keer minder plekken nodig,
> en elke extra plek verdunt via `drukFactor` alle andere. Spreiden was
> zelfbeschadiging. **(6 en 7)** De prijsstand was géén keuze: de omzetindex
> liep netjes op van 0,83 via 1,00 naar 1,20, en bij een hoge prijs haalde je
> dezelfde omzet uit een *kleiner* pand — dus waren lonen, vaste lasten, huur
> én bouwsom ook nog eens 45% lager. Duur zijn was gratis. Nu kost duur zijn
> wat het in het echt kost: meer handen per gast, een duurder pand per stoel.
>
> **En de vraag zelf stond scheef.** Het toernooi speelt duels. Naast de
> duels staat nu `veld()`: zes stijlen in één campagne. Daar wint horeca-focus
> — 100% van zijn duels — nog maar twee van de acht tafels, en zwaar onderhoud
> vijf. Het lag niet aan de ontbrekende laag maar aan de **tafelgrootte**
> waarop gemeten werd.
>
> Wat open blijft: ook met zes raakt de kaart niet vol (~50% bebouwd), dus
> veilingen om *grond* blijven een randverschijnsel — waar ze bijten is de
> overname van een lopende zaak. En zwaar onderhoud wint vijf van de acht
> tafels: een stijl in plaats van een sector, dus een beter soort dominantie,
> maar dominantie.

**Deelnemingen** (`magnaat/aandeel.js`, `aandeel-acties.js`). Een belang in de
zaak van een ander: een contract koppelt twee bedrijven aan een *levering*, een
deelneming aan een *resultaat*. Vier besluiten, alle vier aan dezelfde vraag —
wie is de baas?

1. **Een belang geeft geen zeggenschap.** De eigenaar blijft de enige aan de
   knoppen. Anders is een vestiging met drie aandeelhouders een object waarvan
   onduidelijk is wie er een zet op mag doen, en dan is elke actie een vraag.
   Dit spel heeft geen stemlaag en krijgt er ook geen.
2. **Hoogstens 49% gaat weg.** Wie het hele bedrijf wil, koopt het in de
   veiling.
3. **Verlies deel je mee** — anders is een belang verkopen in een slechte zaak
   gratis geld.
4. **Het belang hangt aan de vestiging, niet aan de eigenaar.** Wordt de zaak
   verkocht, dan blijft het belang staan; anders schud je je aandeelhouders af
   door te verkopen. De wederpartij wordt daarom *afgeleid* en niet opgeslagen.

De eindstand telt per speler zijn eigen deel van zijn panden plus de waarde van
zijn belangen elders — dezelfde euro mag niet bij twee mensen staan.

### De derde meter: kan een speler waarde maken uit niets?

`scripts/magnaat-pomp.js` staat naast de balansmeter en de strateeg, en hij
stelt de vraag die die twee per definitie niet stellen: **kan een speler een
mechaniek uitbuiten door geld rond te pompen zonder economische waarde te
scheppen?** Hij zet twee identieke werelden naast elkaar — dezelfde stad,
dezelfde bedrijven, dezelfde maanden — laat in de ene pompen en in de andere
niet, en vergelijkt het totale vermogen aan tafel plus de Foundation-pot.

**Hij vond bij zijn eerste ronde 193 miljoen op een tafel van 62 miljoen.** De
kas klopte tot op de euro; de fout zat in de **waardering**. Een bedrijf is een
veelvoud van zijn winst waard, dus wie zich laat overbetalen ziet zijn zaak
exploderen terwijl de betaler alleen kas verliest. Een vervoerder met een
bouwsom van 368.000 stond op 191 miljoen — 518× zijn stenen.

Twee reparaties, op twee niveaus:

- **De prijsband** (`handel.js`): het bedrag per eenheid moet tussen 0,4× en 2×
  de marktprijs liggen. Daarbinnen valt alles te onderhandelen wat een
  onderhandeling nodig heeft; daarbuiten is het geen prijs maar een cadeau.
- **Het waardeplafond** (`waardering.js`): een bedrijf is nooit meer waard dan
  vijftien keer zijn bouwsom. Ruim — goed spelen komt rond de zes uit — maar het
  bindt de orde van grootte waarin een pomp werkt. Dat is een vangnet voor élke
  volgende laag die geld verplaatst.

Twee soorten scenario, want "het totaal verandert" is niet altijd fout:
**neutraal** (een pure overdracht — elke afwijking is fout, omhoog én omlaag) en
**kostend** (iets dat met opzet waarde vernietigt, zoals een pand slopen — zakken
mag, stijgen nooit).

> **De meter lekte eerst zelf**, en dat hoort erbij: hij telde de
> Foundation-pot wel en wat er al uit gebouwd was niet, zodat elk scenario dat
> de pot voedde waarde leek te vernietigen. Een lekkende meter is erger dan geen
> meter, dus dat staat nu onder toets.

**Er komt een scenario bij zodra er een laag bij komt.** Leningen (rente die
ergens verdwijnt of uit het niets komt), verzekeringsuitkeringen zonder premie,
interne concerns die zichzelf betalen, R&D-subsidies — het is dezelfde klasse,
elke keer.

---

**Wat er van fase B nog niet in zit.** Banken en financiering met rente,
zekerheden, looptijd en convenanten; verzekeringen met risicoprofielen; en R&D.
De rekening-courant onder een negatieve kas (`ROOD_RENTE`) is er wel — dat is de
prijs van doorbouwen, niet een financieringslaag.

**Fase C — de permanente wereld.** Living World, AI-managers met beleidsregels,
Safe Management Policy, vakantiemodus, overdracht, legacy, Magnaat Daily,
lokale governance, de levende kaart.

**Fase D — de rollen.** Meerdere mensen in één concern (CEO/CFO/COO), lokale
ondernemerskringen, chat-integratie.

Elke fase is speelbaar zonder de volgende. Dat is de eis: een half aangezette
economie is gevaarlijker dan een afwezige, want dan gaat iemand er echt in
bouwen.

---

## 13. Arcade — en de blokkade die eerst weg moet

De visie wil per arcadespel meerdere modi (Sneek: speed, obstacles, labyrinth,
endless; Tetris: marathon, sprint, 40 lines, zen; Sudoku: killer, speed,
no-note), een dagelijkse challenge met dezelfde seed voor iedereen, en een ghost
van je vorige poging.

**Modi kunnen meteen.** Ze zijn een uitbreiding van de client plus een `modi`-lijst
in de descriptor, met een bord per modus.

**De dagchallenge en ghost kunnen niet voor Sneek en Tetris, en dat is geen
detail.** `TAKEN.md` 5.22 zegt het al met zoveel woorden: een arcadescore is
niet server-authoritatief, de regels draaien in de client, en dat is te dragen
voor een vriendenbord maar niet zodra er een competitie of een prijs aan hangt.

> Een dagchallenge is één bord waarop vreemden elkaar verslaan. Dat is een
> competitie. Voor Sneek en Tetris is een topscore vandaag één regel JavaScript.

**Wat het wél mogelijk maakt, en dat is het goede nieuws:** een dagchallenge is
een *vaste seed*. Zelfde blokvolgorde, zelfde kaart, zelfde puzzel. Met een
vaste seed kan de server een ingestuurd invoerlogboek naspelen en de score
narekenen. **De dagchallenge en het server-authoritatief maken van de arcade
zijn dus dezelfde klus**, en ghost mode valt er gratis uit — een ghost ís dat
invoerlogboek.

De volgorde is daarmee gegeven:

1. **Sudoku krijgt zijn dagchallenge eerst** — **af.** Die was al
   `serverScore: true`: de server geeft de puzzel uit, houdt de oplossing,
   klokt zelf. Er viel niets te repareren, alleen een gedeelde dagpuzzel toe te
   voegen.
2. **Sneek en Tetris krijgen een seed + invoerlogboek**, en de server rekent na.
   Pas daarna `dagelijks: true`. Het register dwingt dat af (§4).

**Wat een dagchallenge níet krijgt, en hoe dat is afgedwongen:**

- **geen reeks.** Geen "5 dagen op rij". `prestaties.js` verbiedt reeksen al en
  een dagstreak is de zuiverste vorm van de ratel die hier niet thuishoort. Het
  dagrecord heeft precies vijf velden en `test/speldag.test.js` loopt ze na, in
  de opslag én in elk antwoord.
- **geen melding dat hij verloopt** — structureel: `kern/spellen/dag.js` krijgt
  `nudge` niet binnen en noemt hem nergens. Er valt dus niets aan te zetten, en
  een toets houdt dat zo.
- **onder de progressiegrens: gewoon spelen, niets bewaard** — dezelfde regel
  als overal, geen 403 en geen leeg bord maar `bewaard: false` met de reden.
  Wie onder de grens valt telt ook niet mee in het veld: er wordt geen getal
  weggeschreven, dus staat er ook niemand ongevraagd in een telling.
  Een ghost hoort bij een bewaarde score en volgt hem dus.

De challenge sluit na 24 uur en er komt geen seizoen omheen. Dat is de
begrensde vorm: één dag, één puzzel, klaar. Elke dag die niet vandaag is wordt
gewist, opgave en al — anders ligt er alsnog een alletijden-dagbord waar een
reeks uit af te leiden valt.

**Wat er is gebouwd** (`server/kern/spellen/dag.js`, 22 toetsen, 14 mutaties
raak): drie ingangen (`dag` kijkt en start geen klok, `dag-start` start hem,
`dag-klaar` levert in), een opgave per dag die de server uitgeeft en bewaart, en
een bord dat 's nachts leeg is. De laag noemt geen enkel spel bij naam: wat een
opgave ís komt uit twee haken in de descriptor (`dagOpgave`, `dagKeur`), en dat
zijn precies de twee die Sneek en Tetris straks invullen met hun seed en hun
invoerlogboek. De datum komt niet uit het verzoek — een client die zijn eigen
dag mag noemen speelt die van gisteren nog eens.

**Eén besluit dat zichtbaar hoort te blijven: wie er op het bord staat.** De
visie zegt "één bord waarop vreemden elkaar verslaan". Je *plaats* gaat hier
inderdaad over het hele veld, en je ziet hoeveel mensen hem vandaag oplosten —
daar zit de wedstrijd. De *namenlijst* blijft je eigen kring. Een lijst met
codenamen van vreemden is een sociale laag die dit huis nergens anders heeft,
en die valt met een puzzel niet te rechtvaardigen. Dat is een keuze en geen
tekortkoming; hij is omkeerbaar in één functie (`bord` in `dag.js`).

---

## 14. Toernooien en clubs

**Toernooien bestaan al** en zijn goed neergezet: elke wedstrijd is een gewóón
potje via `potjeDirect`, dus alle spelregels en poorten gelden; een toernooi valt
buiten de progressiegrens omdat het een begrensd evenement is en geen blijvende
stand; het opschuiven hangt aan dezelfde plek als de uitslag, zodat een ronde
niet kan blijven hangen. Twee vormen (knockout 4/8, roundrobin 3–8).

**Wat erbij komt:** Swiss (koppeling op gelijke stand per ronde), poules met een
finalefase, best-of-series, teams, tijdslots en kwalificaties. Allemaal in
`toernooi-schema.js`, dat daar al de plek voor is — de levensloop in
`toernooi.js` hoeft er niet van te weten.

**Arcade in een toernooi** kan pas na §13, en dan meteen voor alle drie.

**Clubs zijn nieuw** en zijn niet hetzelfde als Salon-groepen of `spelTeams`:
een club heeft leden, favoriete spellen, een clubavond, interne toernooien en
een eventhistorie. Twee dingen erven ze ongewijzigd van `teams.js`, omdat de
redenering daar al klopt: uitnodigen alleen binnen je eigen kring, en **geen
ranglijst** — een clubstand staat buiten het potje en valt dus onder de
progressiegrens, en dan krijgt een schoolclub een bord waarop de helft van de
leden niet mag staan. Een half bord is erger dan geen bord. Interne toernooien
mogen wel: die zijn begrensd.

---

## 15. Progressie: casual, ranked, en de grens

**De grens verandert niet.** `spellen/grens.js` blijft de enige plek waar staat
wie een spoor achterlaat. Elke nieuwe progressievorm hangt daaraan en krijgt
geen tweede leeftijdscontrole. Dat is letterlijk waarom dat bestand van twee
regels een eigen bestand is.

**Casual en Ranked worden gescheiden:**

| | Casual | Ranked |
|---|---|---|
| Rating | geen | verborgen matchmakingcijfer |
| Uitslag | telt in je stand | telt, en is officieel |
| Huisregels/varianten | mogen | niet |
| Klok | verloopt naar een aanbod | verloopt automatisch |
| Onder de grens | speelbaar, niets bewaard | **bestaat niet** |

**Een rating mag geen eigen teller worden, en dat is een harde technische
grens die de visie niet kon zien.** `TAKEN.md` 5.25 legt hem uit: het
bewaarbeleid kent alleen takken met een **datum per item**. Een MMR per speler
heeft die niet en zou dus permanent op de lijst `zonderBeleid()` staan — een gat
dat we zelf slaan in een bestand dat zegt dat die lijst hoort te krimpen. Een
rating wordt daarom **afgeleid uit de uitslagenlog**, net als `spelStand`, over
hetzelfde venster van een jaar, en verloopt vanzelf mee.

Gevolg, en dat hoort op het scherm te staan zoals het er nu al staat: een rating
gaat over een venster en niet over altijd.

**Seizoenen: alleen optellend.** Een seizoen mag een begin en een eind hebben en
een uitslag opleveren. Het mag **niet** zakken omdat je niet speelde. "Je moet
spelen om niet te dalen" is de definitie van het patroon dat `CLAUDE.md`
verbiedt, en een seizoensvorm die dat nodig heeft komt er niet.

**Game Passport** (§20 van de visie) is een persoonlijk overzicht — partijen,
gewonnen, favoriet tempo, langste campagne, arcade-PR's. Het is afgeleid, het
gaat over het venster, en het bestaat alleen boven de grens. Geen "gaming social
media": niet openbaar, geen profiel dat anderen kunnen bekijken.

---

## 16. Foundation

Hier is de bestaande grens een productsterkte, geen beperking. RTFoundation
hoeft niet dezelfde mechaniek te hebben als een volwassen gamingplatform.

Een kind ziet `Vandaag 4 puzzels opgelost` of `Quiztoernooi voltooid`. Het ziet
nooit `Je staat #14.982 van Nederland`.

**Education Mode** koppelt bestaande spellen aan lesstof: Woordduel aan spelling,
Quizduel aan schoolstof, Rangschikduel aan volgorde (Romeinse Rijk →
Middeleeuwen → Industriële Revolutie), Schatduel aan rekenen en logica,
Geheugenduel aan woordenschat. De docent kiest groep, onderwerp en duur;
RTFoundation genereert een veilige sessie. Dat is `context: 'school'` op een
gewone room — geen aparte schoolgame-engine.

**Adaptieve moeilijkheid, met een rand eromheen.** De software mag een passende
uitdaging kiezen; ze mag geen leerling voorspellen. `README.md` (regel 6 van de
schoollat) zegt: *geen voorspelling, geen ranglijst*, en de School-lat zegt
*leren is geen wedstrijd*. Daarom:

- adaptiviteit kijkt naar **deze sessie** en niet naar een opgebouwd profiel;
- er wordt **geen niveau per leerling bewaard** — dat zou een profiel zijn, en
  precies wat de grens tegenhoudt;
- de reden is altijd op te vragen, in één zin, voor kind én docent.

---

## 17. Toegankelijkheid

Onderdeel van het platform, niet per spel opnieuw. `shared/toegankelijk.js`
bestaat al met het goede model: de server is eigenaar, localStorage is de snelle
kopie, en de snelle helft staat bovenin `shared/basis.js` omdat wie grote tekst
nodig heeft hem bij het eerste beeld nodig heeft.

Game Hall breidt dat uit met wat spellen extra vragen: hoog contrast, grotere
tegels, kleurenblindvriendelijke symbolen (dus niet alleen kleur als
onderscheid — dat raakt Dammen, Pesten, Rummi en Magnaat direct), verminderde
animatie, screenreader-labels op bord en zetten, trillingsfeedback, langere
timers, eenhandige bediening, en een geluidsalternatief voor elk signaal dat nu
alleen klinkt.

**Langere timers is de lastigste**, want hij raakt de eerlijkheid van een
reactiespel. De regel: in een casual potje volgt de timer de instelling van de
speler die hem nodig heeft; in ranked geldt één timer voor iedereen en staat
dat erbij vóór je begint.

---

## 18. De beleidslaag

Volwassenen en Foundation-gebruikers spelen door dezelfde motor. Dat vraagt één
plek waar staat wat in welke context mag — en die plek bestaat half: `grens.js`
(progressie) en `gedeeld.js` (`wereldFout`, `leeftijdFout`) doen elk een stuk.

`spellen/beleid.js` voegt die samen tot één afleiding, aangeroepen bij elk
toetredingsmoment (starten, uitnodigen, accepteren, projecteren):

| Vraag | Komt uit |
|---|---|
| Mag dit spel hier gestart worden? | `wereld` / `werelden` in de descriptor |
| Mag deze speler mee? | `volwassen` in de descriptor + `volwassen()` |
| Blijft er iets van over? | `progressieMag` |
| Wie mag uitnodigen? | `kring.js` |
| Mag er gepraat worden? | `kring.elkPaarKent` |
| Mag er meegekeken worden? | `zicht.kijker` bestaat + kring |
| Mag er geprojecteerd worden? | `zicht.publiek` bestaat + host |
| Mag dit ranked? | `ranked` in de descriptor + `progressieMag` |

**Samenvoegen mag geen herschrijven worden.** De bestaande poorten blijven waar
ze zijn en blijven doen wat ze doen; `beleid.js` roept ze aan. Een policylaag die
de regels overneemt is een tweede kopie, en dan zijn er weer twee antwoorden op
dezelfde vraag — precies wat `kring.js` heeft opgeheven.

---

## 19. Identiteit per spel, binnen de merkregels

De motor is gedeeld; de interfaces absoluut niet. Negentien keer dezelfde kaart
met een andere titel voelt goedkoop, en dat is het echte verschil tussen "er
zitten spelletjes in" en "dit is een gaming-platform".

**Maar `CLAUDE.md` zegt: stark zwart/wit ritme, geen beige/marmer-gradients, geen
ronde hoeken, geen gouden randjes.** Die twee botsen alleen als je de grens niet
trekt, dus hier staat hij:

> **RTG's chrome is RTG. Het bord is de wereld van het spel.**
> Alles wat de Hall zelf is — navigatie, koppen, knoppen, lobby, kaarten,
> uitslagen — volgt de merkregels onverkort: het palet, Bodoni Moda voor
> display, Inter voor functionele tekst, geen ronde hoeken, veel lucht.
> Binnen het speelvlak mag een spel zijn eigen materiaal hebben.

Zo kan Schaken aanvoelen als een Europese schaakclub (donker hout, ivoor, zwart,
messing) zonder dat RTG marmer wordt. Dammen krijgt een eigen arena — frisser en
sneller, niet Schaken met ronde stenen; bij een verplichte slag toont de
interface wélke stukken geldig zijn zonder de oplossing voor te kauwen, en een
meerslag loopt vloeiend. Woordduel mag het kleurrijkst: fysieke lettertegels die
je sleept, woorden die op het bord klikken.

**Wat er niet mag verschuiven:**

- **Geen nieuwe fonts. Ooit.** Zelf gehost in `public/fonts/`, en de CSP
  (`font-src 'self'`) laat een externe font-link sowieso niet laden.
- **Geen stockbeeld, geen modellen, geen extern beeld.** Texturen en visuals
  worden met CSS/SVG gebouwd of in eigen huis gegenereerd, zoals
  `public/campagne/` dat al doet.
- **Bordeaux blijft een accent en nooit een tekstkleur op zwart.**
- Bij schaakmat geen vuurwerk: `SCHAAKMAT`, en een korte lichtanimatie over het
  bord. Ingetogen winnen hoort bij het merk.

**Cosmetica zonder manipulatie.** Schaakborden (marmer, walnoot, onyx, royal
blue, ivory), kaartdekken (klassiek, modern, RTG Bordeaux), Hall-achtergronden,
tafels, victory frames. Te verdienen via events en prestaties of gewoon
beschikbaar. **Geen lootbox, geen willekeur, geen pay-to-win** — en cosmetica
raakt nooit de spelmacht.

---

## 20. Wat elk van de negentien krijgt

| Spel | Vormen | Tempo | `publiek` | Ranked | Bijzonder |
|---|---|---|---|---|---|
| Schaken | live, async | alle drie | = kijker | ja | klok, zettenlijst, remise, analyse |
| Dammen | live, async | alle drie | = kijker | ja | eigen arena, meerslag-animatie |
| Woordduel | live, async | relaxed, long | = kijker | ja | per taal; oefenmodus met Rahul |
| Magnaat | async, live | long play | bord + openbaar bezit | later | vlaggenschip (§12) |
| Rummi | live, async | relaxed | tafel, niet de rekken | ja | |
| Pesten | live | live | open kaart + aantallen | nee | |
| Mens erger je niet | live, **async** | live, relaxed | volledig | nee | 2-tegen-2 |
| Proost | party | — | spelstatus, niet de opdracht | nee | 18+, opdracht privé op de telefoon |
| 30 Seconden | party | — | **score + klok, nooit de kaart** | nee | rollen: omschrijver/rader |
| Doen of Waarheid | party | — | punten + wat, niet de kaart | nee | eigen privékaarten |
| Quizduel | live, party, foundation | live | vraag + scores | ja | tv = vraag, telefoon = antwoord |
| Flitsduel | live, party | live | scores | nee | inline in de chat speelbaar |
| Geheugenduel | live, party, foundation | live | scores | nee | woordenschat |
| Rangschikduel | live, party, foundation | live | scores | nee | volgorde/geschiedenis |
| Reactieduel | live, party | live | scores | nee | elke telefoon een toets |
| Schatduel | live, party, foundation | live | scores | nee | rekenen en logica |
| Sneek | arcade | — | — | na §13 | modi, seed, ghost |
| Tetris | arcade | — | — | na §13 | modi, seed, ghost |
| Sudoku | arcade | — | — | ja | **dagchallenge — af** |

De regel achter de kolom `publiek`: hij bevat wat iedereen in de kamer tóch al
weet. Bij 30 Seconden is dat het hele punt van het spel — en de reden dat het
zichtmodel van §6 vóór party mode af moet zijn.

**Wat er na fase 0 werkelijk staat**, want de tabel hierboven is de bedoeling en
niet de stand: zes spellen dragen `async` (schaken, dammen, Woordduel, Rummi,
mens-erger-je-niet, Magnaat), vijftien hebben een `kijker` en tien een
`publiek` (30 Seconden, schaken, Woordduel, Doen of Waarheid en de zes duels
met een tussenstand: Quizduel, Flitsduel, Geheugenduel, Rangschikduel,
Reactieduel en Schatduel). De rest van de kolommen — ranked, party-rollen,
presentatie per scherm — bestaat nog niet en staat in fase 1 en verder.

---

## 21. Fasering

Niet negentien spellen tegelijk visueel herbouwen. Eerst de motoren, dan vijf
spellen die elk een andere categorie bewijzen, dan de rest.

**Fase 0 — de fundamenten (niets zichtbaar, alles hangt eraan)**

| | Wat | Staat |
|---|---|---|
| 1 | `zicht.js` — drie lagen, `kijken: true` uitgefaseerd (§6) | **af** |
| 2 | `klok.js` — tempo, toewijzen, vervaltermijn (§7) | **af** |
| 3 | `beleid.js` — één afleiding over de bestaande poorten (§18) | **af** |
| 4 | Room-uitbreiding: `context`, `bron`, `host`, `tempo` (§8) | **af** |

Wat fase 0 onderweg heeft opgeleverd, en dat is het argument voor de volgorde:
**drie bestaande fouten die niemand zag.** `kijken: true` was een bewering
zonder meting, en hij klopte bij drie van de zestien spellen niet — 30 Seconden
lekte de kaart aan een kijker, en Reactieduel en Schatduel gooiden een
uitzondering die de route in een 500 veranderde. Zie §6.

**Fase 1 — de vijf bewijsspellen**

| Spel | Bewijst |
|---|---|
| **Schaken** | premium 1v1 + async + replay + nabespreking — **af** |
| **30 Seconden** | party + big screen + verborgen informatie — **af** |
| **Sudoku** | arcade + dagchallenge — **af** |
| **Quizduel** | teams + Foundation + varianten — **af**; eigen content (vrije tekst) staat nog open |
| **Magnaat** | long-play multiplayer met een echte economie |

Deze vijf zijn geen willekeurige keuze: elk raakt precies één fundament uit
fase 0, dus als een fundament niet klopt komt dat hier boven water en niet bij
spel veertien.

**Fase 2 — de blokkade van de arcade**

Seed + invoerlogboek + narekenen voor Sneek en Tetris. Daarna pas
`dagelijks: true`, ghost en arcade in toernooien. Dit is de enige fase die
volgorde afdwingt via het register (§4).

**Fase 3 — de sociale laag**

Games in de chat (§10), clubs, Game Night, contextual launch.

**Fase 4 — de overige veertien** naar hetzelfde niveau, plus de
toernooivormen en de Desktop Game Space.

**Wat wanneer zichtbaar wordt:** fase 0 levert de gebruiker niets en is
onmisbaar; wie hem overslaat bouwt party mode op een zichtmodel dat de kaart
lekt. Fase 1 is waar Game Hall voor het eerst voelt als een platform.

---

## 22. Game Creator

Niet programmeren maar configureren, en daardoor duizenden varianten zonder
duizenden modules. Bij Quizduel: categorieën, vragenbron, rondes, teams, timer.
Bij 30 Seconden: eigen woordenlijsten. Bij Doen of Waarheid: eigen privékaarten.
Bij Schaken: tijd, Chess960, kleurkeuze. Bij Magnaat: kaart, economische
snelheid, startkapitaal, spelduur.

Een variant is een `variant`-veld op de room en een `varianten`-blok in de
descriptor dat zegt wat er te kiezen valt. **Drie randen:** een variant kan de
spelregels wel parametriseren en niet vervangen; vrije tekst (namen,
woordenlijsten, kaarten) gaat door dezelfde opschoning als elke andere vrije
tekst in dit huis; en **een variant is nooit ranked** — een officiële uitslag
hoort bij vaste regels.

**De kern hiervan staat er** (`server/kern/spellen/variant.js`, fase 1), en
Quizduel is de eerste gebruiker. Wat er nu is:

- **elke keuze is een gesloten lijst.** Geen vrij tekstveld, om dezelfde reden
  als `CONTEXTEN` in `beleid.js` en de twaalf gesprekssoorten in `kern/comm`:
  een vrij veld is binnen een maand een verzameling spelfouten. Het levert er
  bovendien iets voor terug — de lobby kan de keuzes uittekenen, want ze staan
  in `SPEL` en reizen mee via `/spel/varianten`.
- **een variant mág uit het verzoek komen, en `context` niet.** Dat lijkt een
  uitzondering op §8 maar is het verschil tussen de twee dingen: `context`
  zegt wie er wat mag (beleid), een variant zegt welk spel je speelt. Veilig
  is hij omdat de lijst uit de descriptor komt.
- **een verkeerde waarde is een 400, geen stille terugval.** Wie als docent
  "taal groep 3" kiest en algemene kennis krijgt, merkt dat pas als de klas de
  eerste vraag ziet. Terugvallen op de standaard is daar de duurste vorm van
  behulpzaamheid.
- **de vraag óver de velden heen is van het spel** (`variantFout` op de
  descriptor). Het platform weet niet dat leerstof bij de schoolbron hoort.
- **de wachtrij splitst mee.** Wie schoolvragen zoekt en algemene kennis
  krijgt, heeft geen tegenstander maar een ander spel.

**Wat er nog niet is:** vrije tekst (eigen woordenlijsten, eigen quizvragen,
eigen privékaarten) — dat vraagt opslag, eigenaarschap en dezelfde opschoning
als alle vrije tekst hier, en dat is een eigen klus. En de derde rand,
"een variant is nooit ranked", is vandaag niet af te dwingen omdat de ranked-laag
niet bestaat; hij staat als open punt en niet als stilzwijgende belofte.

---

## 23. Wat er bewust niet in komt

- **Reeksen, streaks en dagelijkse aanmeldbonussen.** In welke vorm dan ook.
- **Een stand die zakt door niet te spelen.**
- **Openbare ranglijsten voor minderjarigen** — in geen enkele vorm, ook niet
  "alleen binnen de klas".
- **Lootboxen, willekeurige beloningen, betaalde spelmacht.**
- **Een tweede berichtenvoorraad.** Praten blijft `kern/comm`.
- **Een tweede kring.** Blijft `kring.js`.
- **Een profiel per leerling** in Education Mode.
- **Een globale ranglijst.** Standen blijven binnen je kring.
- **Spectator-analyse tijdens een lopende ranked partij** (een engine-evaluatie
  naast het bord is een open lijn naar wie meekijkt).
- **Rahul die tijdens een competitief potje het bord ziet.**

---

## 24. Wanneer het af is

Niet als de knoppen mooi zijn. De meetlat, in de vorm van `LAT.md` — elk punt
moet met een mutatie te toetsen zijn:

1. De server vertrouwt zijn eigen staat; geen client bepaalt een uitslag.
2. Spelregels zijn centraal toetsbaar; geen platformlaag noemt een spelnaam.
3. Replays zijn reproduceerbaar en een afgekapte replay zegt dat erbij.
4. Een projectiescherm kan verborgen informatie niet ontvangen — niet omdat we
   hem niet sturen, maar omdat hij niet in die laag zit.
5. Idempotentie: dezelfde actie tweemaal verandert de staat één keer.
6. Het leeftijdsbeleid geeft overal hetzelfde antwoord, uit één afleiding.
7. Toernooien hebben geen eigen infrastructuur; elke wedstrijd is een gewoon
   potje.
8. Elke bewaarde tak heeft een datum per item en staat in `bewaarbeleid.js`;
   niets nieuws op `zonderBeleid()`.
9. Telefoon, desktop en groot scherm tonen dezelfde staat in hun eigen vorm.
10. Duizenden gelijktijdige rooms zonder dat één spel een eigen platform is.

En daarbovenop een interface die vrolijk, sociaal en speels voelt. De zware
techniek is er niet om zichtbaar te zijn.

---

## Open punten voor `TAKEN.md`

| # | Punt | Blokkeert |
|---|---|---|
| a | Arcadescore van Sneek en Tetris niet server-authoritatief (staat al als 5.22); Sudoku is het wél en heeft daarom zijn dagchallenge | dagchallenge voor Sneek/Tetris, ghost, arcade-toernooien |
| ~~b~~ | ~~`zicht.publiek` bestaat niet; meekijken is één laag~~ — **opgelost**, en het legde drie fouten bloot | — |
| ~~c~~ | ~~Potje-verval is een vast getal~~ — **naad gelegd, maar het was geen probleem**; de aanleiding klopte niet, zie §7 | — |
| d | Replay kapt af op 500 zetten; niet gemeten voor een echte campagne | Magnaat met economie |
| ~~e~~ | ~~Geen klok per beurt~~ — **opgelost**, inclusief de keuze in de lobby, de klok in het potje en de toewijs-knop | — |
| e2 | Eén herinnering per beurt voor wie offline is (§7) | Relaxed en Long Play in de praktijk |
| f | Rating heeft geen tak met datum per item | ranked (moet afgeleid worden) |
| g | `TEAMS` is vast `[0,1,0,1,0,1]` | vrije teamindeling in party |
| h | Een potjegesprek is niet terug te vinden vanuit het potje na afloop (5.32) | game activity in de chat |
| i | `GEMISTE_BEURTEN` en de tempo-term in `vervalMs` zijn vandaag onobserveerbaar (de bodem wint altijd); een mutatie erop wordt niet gepakt | niets — staat er als bekende, uitgelegde blinde vlek |
| j | Tien spellen hebben een `zicht.publiek`; de zes andere projecteren nog niet | party mode per spel (fase 1/3) |
| k | Meekijken heeft nog geen scherm: `/spel/kijk` bestaat alleen als API | spectator-laag (§8) |
| n | Het gedeelde scherm toont de stand, maar telefoons koppelen (scannen) bestaat nog niet | Game Night (§9) |
| ~~l~~ | ~~Een replay is ruwe data zonder scherm~~ — **opgelost** voor schaken en dammen; de server rekent de tussenstanden met de echte motor |
| m | Naspelen kan alleen bij spellen zonder toeval in het begin (schaken, dammen); bij Pesten, Rummi, Woordduel en mens-erger-je-niet ligt de schudbeurt of de worp nergens vast | een replay voor de overige veertien |
