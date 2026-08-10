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
| **Async** | niemand tegelijk | server, per zet, met een klok per beurt | nee (§7) |
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
| Lobby, uitnodigen, wachtrij, teamstand | `spellen/lobby.js` | af, mist tempo |
| Partij, zet, opgeven, meekijken | `spellen/partij.js` | af, zicht te grof (§6) |
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

**Wat er dus echt nieuw is:** de klok per beurt, het zichtmodel met drie lagen,
de projectiekamer, de challenge-motor, de policylaag en de nabespreking. De
rest is aansluiten op wat er staat.

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

  // ---- nieuw: welke vormen dit spel draagt ----
  vormen: ['live', 'async'],          // standaard ['live']

  // ---- nieuw: tempo (alleen zinvol bij 'async') ----
  tempo: {
    live:     ['30s', '5m', '15m'],
    relaxed:  ['6u', '12u'],
    longplay: ['24u', '72u']
  },

  // ---- nieuw: het zichtmodel, drie lagen (§6) ----
  zicht: {
    speler:  (p, st, mij) => ({ ... }),   // verplicht (was: view)
    kijker:  (p, st) => ({ ... }),        // weglaten = niet te bekijken
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

## 6. Het zichtmodel: het einde van `kijken: true`

Dit is de belangrijkste architectuurwijziging, en hij lost een bestaand
probleem op in plaats van er een nieuw omheen te bouwen.

Vandaag zijn er twee weergaven: de speler krijgt `view(p, st, mij)`, de kijker
krijgt dezelfde functie met `mij = null`. Dat is elegant — er is geen tweede
weergave die kan gaan afwijken — en het botst hard zodra er een televisie in de
kamer staat. Bij 30 Seconden verbergt de weergave de kaart voor de **rader**
door naar zijn spelersindex te kijken; een kijker heeft geen index en ziet de
kaart dus wél. Daarom staat meekijken daar uit, en daarom kan het spel dat het
meest om een gedeeld scherm vraagt juist niet op een gedeeld scherm.

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
waarin de huidige fout is ontstaan: één functie die uit een index afleidt wie
je bent. Drie functies kunnen niet stilletjes in elkaars gat vallen.

**Hoe dit wordt bewaakt.** `test/spelkijken.test.js` doet dit al voor twee
lagen: hij speelt een kaart en vergelijkt wat de rader ziet met wat een kijker
ziet. Dat wordt uitgebreid naar drie, en per spel dat `publiek` levert komt er
een toets die aantoont dat verborgen informatie er niet in zit. De mutatie die
raak moet zijn: haal de filtering uit `publiek` en de toets zakt.

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
  op `zetAt`. Een Long Play-partij van 72 uur per beurt met zes spelers kan
  legitiem langer stilliggen. **De vervaltermijn moet uit het tempo volgen**
  (bijvoorbeeld: tien gemiste beurten), niet uit een vast getal.
- `zetten.js` kapt af op 500 zetten per partij. Magnaat over drie weken haalt
  dat makkelijk. Zie §12.
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

Bij Woordduel mag Rahul wél tijdens het spel taalhulp geven in een expliciete
**oefenmodus** (`variant: 'oefenen'`), en zo'n potje is per definitie niet
ranked en telt niet mee in de uitslagen.

---

## 12. Magnaat als vlaggenschip

Het spel met verreweg de meeste productruimte: van "een bordspel met geld" naar
een langlopende sociale businessstrategie. Steden en economische zones met
sectoren (vastgoed, horeca, retail, media, mobiliteit, logistiek, energie,
toerisme), specialisatie, markten die bewegen (`TOERISME +18%`,
`ENERGIECRISIS`, `RENTEVERHOGING`), onderhandelingen, veilingen, leningen.

Wat dit technisch bijzonder maakt is niet de economie maar de **duur**. Een
campagne van drie weken raakt drie bestaande grenzen, en die moeten vóór de
eerste regel spelcode opgelost zijn:

| Grens | Nu | Nodig |
|---|---|---|
| Verlaten partij | 30 dagen op `zetAt` | uit het tempo afgeleid (§7) |
| Replay | 500 zetten, dan oudste weg | eigen budget; een campagne is méér dan 500 handelingen, en juist het begin is hier interessant |
| Buiten je beurt | `buitenBeurt: ['bouw','verkoop']` | uitbreiden met bod, aanbod, onderhandeling, herstructurering |

Dat derde is wat Long Play werkbaar maakt: als je alleen op je beurt iets kunt,
staat een partij van zes spelers met 24 uur per beurt zes dagen stil tussen twee
van jouw handelingen. Doordat bieden en onderhandelen buiten de beurt mogen, is
er altijd iets te doen — zonder dat iemand tegelijk online hoeft te zijn. De
descriptor draagt dat al; de motor moet het waarmaken.

**Wat er niet in komt:** echte betalingen die spelmacht geven. Geen enkele.
Startkapitaal, versnellingen en cosmetica staan los van de kassa. Dit is niet
een beleidsregel die later versoepeld kan worden — een tycoon-game waarin geld
werkt is precies het genre waar dat misgaat, en `CLAUDE.md` verbiedt het al.

---

## 13. Arcade — en de blokkade die eerst weg moet

De visie wil per arcadespel meerdere modi (Sneek: speed, obstacles, labyrinth,
endless; Tetris: marathon, sprint, 40 lines, zen; Sudoku: killer, speed,
no-note), een dagelijkse challenge met dezelfde seed voor iedereen, en een ghost
van je vorige poging.

**Modi kunnen meteen.** Ze zijn een uitbreiding van de client plus een `modi`-lijst
in de descriptor, met een bord per modus.

**De dagchallenge en ghost kunnen nog niet, en dat is geen detail.** `TAKEN.md`
5.22 zegt het al met zoveel woorden: een arcadescore is niet
server-authoritatief, de regels draaien in de client, en dat is te dragen voor
een vriendenbord maar niet zodra er een competitie of een prijs aan hangt.

> Een dagchallenge is één bord waarop vreemden elkaar verslaan. Dat is een
> competitie. Voor Sneek en Tetris is een topscore vandaag één regel JavaScript.

**Wat het wél mogelijk maakt, en dat is het goede nieuws:** een dagchallenge is
een *vaste seed*. Zelfde blokvolgorde, zelfde kaart, zelfde puzzel. Met een
vaste seed kan de server een ingestuurd invoerlogboek naspelen en de score
narekenen. **De dagchallenge en het server-authoritatief maken van de arcade
zijn dus dezelfde klus**, en ghost mode valt er gratis uit — een ghost ís dat
invoerlogboek.

De volgorde is daarmee gegeven:

1. **Sudoku krijgt zijn dagchallenge eerst.** Die is al `serverScore: true`: de
   server geeft de puzzel uit, houdt de oplossing, klokt zelf. Er is niets te
   repareren, alleen een gedeelde dagpuzzel toe te voegen.
2. **Sneek en Tetris krijgen een seed + invoerlogboek**, en de server rekent na.
   Pas daarna `dagelijks: true`. Het register dwingt dat af (§4).

**Wat een dagchallenge níet krijgt:**

- **geen reeks.** Geen "5 dagen op rij". `prestaties.js` verbiedt reeksen al en
  een dagstreak is de zuiverste vorm van de ratel die hier niet thuishoort.
- **geen melding dat hij verloopt.**
- **onder de progressiegrens: gewoon spelen, niets bewaard** — dezelfde regel
  als overal, geen 403 en geen leeg bord maar `bewaard: false` met de reden.
  Een ghost hoort bij een bewaarde score en volgt hem dus.

De challenge sluit na 24 uur en er komt geen seizoen omheen. Dat is de
begrensde vorm: één dag, één puzzel, klaar.

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
| Mens erger je niet | live | live, relaxed | volledig | nee | 2-tegen-2 |
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
| Sudoku | arcade | — | — | ja | **eerste dagchallenge** |

De regel achter de kolom `publiek`: hij bevat wat iedereen in de kamer tóch al
weet. Bij 30 Seconden is dat het hele punt van het spel — en de reden dat het
zichtmodel van §6 vóór party mode af moet zijn.

---

## 21. Fasering

Niet negentien spellen tegelijk visueel herbouwen. Eerst de motoren, dan vijf
spellen die elk een andere categorie bewijzen, dan de rest.

**Fase 0 — de fundamenten (niets zichtbaar, alles hangt eraan)**

1. `zicht.js` — drie lagen, en `kijken: true` uitfaseren (§6)
2. `klok.js` — tempo, en de vervaltermijn uit het tempo afleiden (§7)
3. `beleid.js` — één afleiding over de bestaande poorten (§18)
4. Room-uitbreiding: `vorm`, `tempo`, `context`, `bron`, `host` (§8)

**Fase 1 — de vijf bewijsspellen**

| Spel | Bewijst |
|---|---|
| **Schaken** | premium 1v1 + async + replay + nabespreking |
| **30 Seconden** | party + big screen + verborgen informatie |
| **Sudoku** | arcade + dagchallenge (de enige die nu al kan) |
| **Quizduel** | teams + Foundation + eigen content |
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
| a | Arcadescore niet server-authoritatief (staat al als 5.22) | dagchallenge, ghost, arcade-toernooien |
| b | `zicht.publiek` bestaat niet; meekijken is één laag | party mode, 30 Seconden op een scherm |
| c | Potje-verval is een vast getal, niet uit het tempo | Long Play, Magnaat |
| d | Replay kapt af op 500 zetten | Magnaat-campagnes |
| e | Geen klok per beurt, geen herinnering buiten SSE | async in alle vormen |
| f | Rating heeft geen tak met datum per item | ranked (moet afgeleid worden) |
| g | `TEAMS` is vast `[0,1,0,1,0,1]` | vrije teamindeling in party |
| h | Een potjegesprek is niet terug te vinden vanuit het potje na afloop (5.32) | game activity in de chat |
