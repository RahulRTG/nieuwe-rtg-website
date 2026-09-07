# RTG Product Reliability — wanneer bestaat een functie?

Dit is een richtingsdocument zoals `PLATFORM.md` en `ECONOMIE.md`: per onderdeel
staat er of het **staat**, **een stap weg** is, **een besluit vraagt** of **jaren
weg** is — zodat niemand die vier voor elkaar aanziet.

## 0. De definitie

> **Een functie bestaat pas als een echte gebruiker haar volledige bedoeling
> succesvol kan voltooien, de uitkomst correct wordt opgeslagen, fouten
> begrijpelijk worden afgehandeld, rechten kloppen en dezelfde stroom na storing,
> refresh en herhaling betrouwbaar blijft werken.**

Alles hieronder volgt daaruit. De zin is streng met opzet: hij sluit precies de
uitspraken uit die dit huis over zichzelf kon doen zonder te liegen, en die toch
niets waard bleken — *"de pagina laadt"*, *"de toetsen staan groen"*, *"de
bestanden bestaan"*.

## 1. De meeteenheid is een belofte, niet een scherm

`Navigatie` is niet `/apps/navigatie.html`. De belofte is *breng mij vanaf waar
ik nu ben naar mijn bestemming*, en daaronder vallen de locatiepoort, het zoeken,
de kaartdata, de routering, de overlays, het gedrag bij time-out en de status die
het scherm toont. Pas als die keten sluit, mag Navigeren groen.

Daarom telt dit register per **onderdeel uit `MAPPEN`** — de enige lijst werelden
(`WERELD.md`) — en niet per HTML-bestand. Een onderdeel is een ingang die aan
iemand wordt getoond, en dat is precies het niveau waarop een gebruiker teleur­
gesteld wordt.

**Dat de eenheid een belofte is, was al besloten en half gebouwd.** `BELOFTE.json`
houdt 79 beloften bij met hun dekking, en `BELOFTE.md` zegt zelf waar het ophoudt:

> *"Dit register beoordeelt geen kwaliteit. Dat een bestand bestaat, zegt niet dat
> de belofte goed is ingelost."*

Dat gat is wat hier dichtgaat. `BELOFTE.json` blijft de dekkingsvraag (bestaat
het), `APPWERKT.json` wordt de werkvraag (doet het het). Ze worden niet
samengevoegd: een belofte kan gedekt zijn en stuk, en dat verschil moet zichtbaar
blijven.

## 2. De acht bewijzen

| # | bewijs | de vraag | stand |
|---|---|---|---|
| 1 | **bereikbaar** | vindt de gebruiker de functie vanaf de plek waar RTG haar presenteert? | **staat** (`APPWERKT.json`) |
| 2 | **bedienbaar** | doen de knoppen, tabs, velden, uploads en gebaren iets, zonder te breken? | **half** — knoppen wel, formulieren/uploads/toetsenbord niet |
| 3 | **voltooibaar** | kan de hele stroom worden afgemaakt, tot en met de bevestiging? | **een stap weg** (vraagt de testwereld uit par. 4) |
| 4 | **waarheidsgetrouw** | toont de UI nooit een sterkere toestand dan de backend heeft bewezen? | **een stap weg** (`SCHERMLEUGEN.json` doet dit voor 6 schermen) |
| 5 | **persistent** | komt de juiste toestand terug na refresh, nieuwe sessie, andere browser? | **een stap weg** |
| 6 | **bevoegd** | kan een andere rol, een ander gezin of een ander bedrijf hier niets? | **half** — de routekant staat (`IDOR.json`, `ROLPROEF.json`), de schermkant niet |
| 7 | **herstelbaar** | overleeft de functie uitval, time-out, dubbelklik en een afgebroken verzoek? | **een stap weg** (`HERSTELPROEF.json`, `chaos.js`, `aanval.js` bestaan al) |
| 8 | **menselijk** | krijgt de gebruiker nooit een kale 500, TypeError, lege pagina of dode knop? | **half** — kale fouten worden gezien, de bruikbaarheid van een melding niet |

Bewijs 1, 2 en 8 worden vandaag gemeten door `npm run appwerkt`. De andere vijf
staan in `APPWERKT.json` per rij met de stand `GEEN_FIXTURE` **en de reden**. Ze
weglaten zou erger zijn dan ze op rood zetten: een ontbrekend bewijs leest als een
gehaald bewijs.

## 3. De standen zijn gesloten

    BEWEZEN                   gemeten en in orde
    GEBLOKKEERD_DOOR_DEFECT   gemeten en stuk; hier moet code voor worden gerepareerd
    GEBLOKKEERD_DOOR_CONFIG   de code klopt, de omgeving mist iets — en de server
                              zegt dat zelf (een `hoe` in het antwoord, of een 503
                              die naar een niet-ingelezen bron wijst)
    GEEN_FIXTURE              niet te meten zonder testwereld, met de reden
    NIET_GETEST               deze ronde niet aangeraakt, met de reden

**"Waarschijnlijk goed" bestaat niet.** Dat is dezelfde regel als in
`BESTUUR.md` (`niet vast te stellen` is een eersteklas uitslag) en in
`MUTATIECONTRACT.md` (100% geclassificeerd, 0% schijnzekerheid). De stand van een
rij is de **strengste** van haar bewijzen; een rij waarvan alleen ongemeten
bewijzen over zijn, is nooit groen.

### Een deur is geen defect, en een defect is geen deur

Bewijs 1 kent drie toegangspoorten als **mechanisme** en niet als woordenlijst:
`#poort.zien` (de losse schermen), `.rtf-toegang-dicht` (de gezinspoort) en
`.rtf-school-dicht` (de schoolpoort). Staat er een deur, dan zijn er precies twee
uitkomsten:

- **een andere bekende persona komt er wél door** → `GEBLOKKEERD_DOOR_DEFECT`.
  De ingang is aan de verkeerde persoon geadresseerd. Dat is de "Vrienden"-fout.
- **niemand van de vier komt er door** → `NIET_GETEST`, met de tekst van de deur
  erbij, en apart geteld als `deurenZonderPersona`.

Die tweede is met opzet geen beschuldiging. Misschien is de functie onbereikbaar,
misschien kent de proef de rol niet die er wel doorheen komt — een docentencode,
een keurder, een gemeente. Een defect melden dat je niet kunt onderbouwen kost dit
register bij de eerste ronde zijn geloofwaardigheid; apart tellen houdt het
werkvoorraad in plaats van ruis. De eerste volle ronde leverde die correctie
meteen op: `Het bord` en `Het schrift` kwamen als defect binnen en zijn een
docentendeur.

Het onderscheid **DEFECT tegenover CONFIG** is niet cosmetisch. Het eerste is werk
voor wie bouwt, het tweede voor wie uitrolt, en ze door elkaar halen kost beide
kanten een dag. Het wordt daarom niet geraden maar **gelezen uit wat de server
zelf zegt** — vandaar dat `kern/navigatie/dekking.js` bij zijn weigering een `hoe`
meestuurt in plaats van alleen nee te zeggen.

## 4. De gecontroleerde testwereld — het grootste ontbrekende stuk

De huidige proef raakt met opzet niets aan dat onomkeerbaar is: betalen,
verwijderen, versturen, uitloggen. Elke rij noemt wat hij daarom oversloeg. Dat is
eerlijk en het laat precies het duurste risico ongemeten.

**Vraagt een besluit.** De uitweg is geen vlag in de productiecode — die regel
staat al vast in `MAGNAATLAB.md`: *een simulatie-adapter vervangt de rail, nooit
de poort*. `kern/pay/poort.js` kent geen enkele demo-stand en dat moet zo blijven.
De testwereld bestaat daarom uit adapters náást de echte, elk met een grendel die
fail-closed is:

| wat | hoe | stand |
|---|---|---|
| betalen | vierde provider naast de demo-provider | **staat**: `server/betaal/synthetisch.js`, achter `RTG_SIMULATIEBANK=1`, nooit naast een echte provider, nooit in productie |
| mail | sink-mailbox | **een stap weg**: `SMTP_URL=''` en `server/data/outbox/` bestaan al |
| sms | test-adapter | **een stap weg**: `sendSms` in `server/mail.js` en `server/mail-lokaal.js` — twee choke points, niet één (`KOSTEN.md` telt ze zo) |
| verwijderen | wegwerpdata | **staat**: elke proef draait al op een eigen `RTG_DATA_DIR` |
| boekingen | synthetische leveranciers | **staat**: de seed levert ze (`KIKUNOI`) |
| ritten | gesimuleerde voertuigen | **half**: `kern/mobiliteit/` heeft de standen, geen simulator |
| bellen/video | test-identiteiten | **vraagt een besluit**: WebRTC in een headless browser |
| AI | testmodel | **staat**: `LOCAL_AI_URL`, en zonder model is de handmatige werkmodus zelf de uitkomst die getoetst hoort te worden |
| locatie | gesimuleerde GPS-trajecten | **staat**: Playwright `geolocation` + `permissions` |

De regel die daarbovenop hoort: **een simulatie-adapter mag nooit een handeling
laten slagen die in het echt niet zou slagen.** Vandaar dat de synthetische bank
vier afloopen kent (`betaald`, `geweigerd`, `traag`, `terugboeking`) en niet één.

## 5. Wat er vandaag gemeten wordt, en wat dat niet bewijst

`npm run appwerkt` schrijft `APPWERKT.json`: per onderdeel uit `MAPPEN`, met de
persona die de wereld impliceert (een lid voor LivingOS/WorkOS/TravelOS, een gezin
voor FoundationOS), in een echte browser met een echte sessie langs de echte
inlogroute.

Een **BEWEZEN** rij betekent daar precies dit: *de ingang opent voor de persona aan
wie hij wordt getoond, en de zichtbare bediening breekt niet.* Het betekent
uitdrukkelijk niet dat de functie werkt. Vier dingen die deze proef niet ziet:

- formulieren worden niet ingevuld en niet verstuurd;
- onomkeerbare knoppen worden overgeslagen (met naam, per rij);
- hooguit veertien knoppen per scherm;
- het meet op bureaubreedte — de telefoonkant staat in `TIKKEN.json`.

`npm run appwerkt:controle` is de ratel: het aantal defecten mag alleen omlaag.
Groeit het, dan is er een functie stukgegaan die het deed, en dat hoort de bouw te
laten zakken in plaats van in een register te verdwijnen.

## 6. Waarom dit niet theoretisch is

Deze laag komt uit één middag handmatig kijken, en die leverde vier defecten op
die geen enkele bestaande toets zag. Alle vier waren ze **stil** — geen
foutmelding, geen rode toets, geen klacht:

1. **RTG Navigatie toonde Ibiza aan een lid in Amsterdam.** Zonder de NWB-import
   viel `kaart()`, `bestemmingen()` en `poi()` zwijgend terug op een
   demonstratieraster; alleen `route()` weigerde eerlijk. De badge zei intussen
   "Motor actief". *Vier antwoorden op een ontbrekende bron zijn vier waarheden.*
2. **RTG Vrienden verloor zijn halve app aan een knop die niet bestond.**
   `$('#pinNoodKnop')` gooide, en daarmee viel alles daarna in dat scriptblok weg:
   `laad()`, de stream, de verversing, chat, foto's, snaps, verhalen en bellen.
   Het scherm zag er normaal uit — met lege koppen.
3. **Drie schermen groeven zelf in de locatieschakelaar.** `rtg_os_gps` heeft een
   eigenaar (`shared/plek.js`); wie hem zelf leest, mist het moment waarop de
   eigenaar hem zet. Regel 68 van `npm run check` houdt dat nu tegen — en vond bij
   het aanzetten meteen een vierde lezer die niemand had gezien.
4. **LivingOS presenteerde een ingang naar een scherm met een andere deur.**
   "Vrienden" wees naar de gezinscontacten van de RTFoundation. De autorisatie
   klopte tot op de regel; de belofte niet. *Een zichtbare ingang naar een
   onbereikbare functie is een productdefect, ook als elke regel code klopt.*

5. **En de meter vond er zelf een, op zijn eerste volle ronde.** `LivingOS /
   Fonds`: tik in RTG Geld naar de stand Lab-fonds en meteen door naar een
   andere, dan schrijft `laad()` na zijn `await` in opmaak die er niet meer is
   -- `Cannot set properties of null (setting 'innerHTML')`. Met de hand
   reproduceert dat vrijwel nooit; een proef die sneller tikt dan een mens vindt
   het meteen. **Het is een klasse en geen incident:** een heuristische telling
   over `public/apps/geld/` vindt **37 async-functies in 13 modules** die na een
   `await` in een element schrijven zonder te kijken of hun stand er nog is
   (graad `vermoed` -- geteld op vorm, niet uitgevoerd). Gerepareerd is
   voorlopig de ene die gemeten is (`labfondsb.js`, met een `nogInBeeld()`-poort);
   de andere twaalf modules zijn werkvoorraad, en de vorm die ze allemaal nodig
   hebben is dezelfde poort direct na elke `await`. Ze hier opschrijven in plaats
   van in twaalf bestanden te grijpen is een keuze: een ongemeten reparatie in
   twaalf modules is precies hoe je een stille fout toevoegt in plaats van
   weghaalt.

Nummer 4 is de reden dat bewijs 1 over een **persona** gaat en niet over een URL.
Een dichte deur is geen defect; een dichte deur achter een ingang die je aan de
verkeerde persoon toont, wel.

## 7. De volgorde

1. **Bewijs 2 afmaken** (formulieren, uploads, toetsenbord, mobiel). Geen nieuwe
   infrastructuur nodig — dit is de goedkoopste uitbreiding met de grootste
   dekking. *Een stap weg.*
2. **Bewijs 4 verbreden.** De liegpoort bestaat (`RTG_LIEG`) en draait over zes
   schermen. Hem over alle onderdelen halen kost rekentijd, geen ontwerp.
   *Een stap weg.*
3. **De testwereld bouwen** (par. 4), en daarmee bewijs 3, 5 en 7 openen. Dit is
   het grote stuk en het enige dat een besluit vraagt. *Vraagt een besluit.*
4. **Bewijs 6 naar de schermkant.** De routekant is gemeten; wat een scherm doet
   met een sessie van iemand anders niet. *Een stap weg, na 3.*
5. **De acht bewijzen aan `BELOFTE.json` koppelen**, zodat de uitspraak niet per
   ingang maar per belofte gedaan kan worden. *Vraagt een besluit* — welke ingangen
   samen één belofte vormen, staat nergens in de code, en dat verzinnen levert een
   lijst op die stelliger is dan wat het huis weet (zelfde reden als de
   ontbrekende domeinlaag in `WERELDLIJST.md`).

## 8. De uitspraak waar dit naartoe werkt

Niet *"292 schermen laden"*, maar iets in deze vorm — met per getal een register
dat hem draagt:

    N/N onderdelen bereikbaar voor hun eigen persona
    N/N gebruikershandelingen bedienbaar zonder fout
    N/N primaire stromen end-to-end voltooid
    0 schermen die meer beweren dan de backend heeft bewezen
    0 onbewezen kritieke mutaties
    0 autorisatielekken
    0 kale fouten die de gebruiker bereiken

Vandaag is alleen de eerste regel te vullen, en de tweede half. Dat is geen
tegenvaller: het is de eerste keer dat de vraag überhaupt een noemer heeft.
