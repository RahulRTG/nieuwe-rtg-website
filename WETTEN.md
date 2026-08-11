# De systeemwetten van RTG

**Dit bestand is GEGENEREERD** door `node scripts/wetten.js` uit `INVARIANTS.json`.
Wijzig het niet met de hand; de wet zelf verander je in het register. Er staat geen
datum in -- zie `ARCHITECTUUR.md` voor waarom.

Een toets bewijst een geval. Een **wet** is een uitspraak over alle gevallen: wat dit
systeem altijd belooft, ongeacht welk scherm of welke route je pakt. Zonder register
leeft zo'n wet alleen in het hoofd van wie hem bedacht. Hier draagt hij een adres, en
een bewering met een adres kan zakken.

## De stand

| stand | aantal | wat het betekent |
|---|---|---|
| **BEWEZEN** | 24 | handhaver bestaat, toets bestaat, en die toets is zien zakken op een mutatie |
| **ONBEPROEFD** | 8 | er kijkt iemand naar, maar die kijker is nooit op de proef gesteld |
| **OPEN** | 4 | opgeschreven zonder handhaver of zonder toets: een voornemen, geen bescherming |
| **GEBROKEN** | 0 | wijst naar iets dat er niet meer is -- de enige alarmerende stand |

`BEWEZEN` zegt: deze wet heeft grond onder zijn voeten, en wie de grond weghaalt merkt
het. Het zegt niet dat de toets de wet volledig dekt -- dat kan geen gereedschap zeggen.

## De wetten

### RTG-001 -- Geen beschermd endpoint antwoordt zonder geldig token

`BEWEZEN` · zien zakken in `hack.test.js` op `liegpoort /api/`

De grondwet van elke laag erboven. Rol-scheiding, rechten en privacy zijn allemaal zinloos zodra er een deur zonder slot is.

*Handhaver:* `server/opzet/diensten.js`, `server/accounts/tokens.js`

*Toets:* `test/hack.test.js`, `test/auth-rol.test.js`

*Breek hem zo:* laat de auth-poortwachter next() aanroepen als er geen token is; hack.test.js hoort dan op 401 te vallen

### RTG-002 -- Een token van de ene rol opent nooit de app van een andere rol

`BEWEZEN` · zien zakken in `hack.test.js` op `liegpoort /api/`

Lid, leverancier, kantoor en personeel draaien op dezelfde server. Zonder deze wet is een gratis lidaccount een sleutel tot de backoffice.

*Handhaver:* `server/opzet/diensten.js`, `server/kern/bevoegdheid/index.js`

*Toets:* `test/hack.test.js`, `test/auth-rol.test.js`

*Breek hem zo:* laat resolveSession de rol negeren; de rol-scheidingstoets in hack.test.js hoort om te vallen

### RTG-003 -- Wat er niet exact uitziet zoals wij het uitgeven, is geen token

`BEWEZEN` · zien zakken in `sessies.test.js` op `return-weg#2`

Buffer.from(x,'base64url') negeert tekens buiten het alfabet. Een spatie voor een ingetrokken token maakte het weer geldig: uitloggen was met een enkel teken te omzeilen. Fail closed, en iedereen kijkt naar dezelfde bytes.

*Handhaver:* `server/accounts/tokens.js`

*Toets:* `test/sessies.test.js`, `test/hack.test.js`

*Breek hem zo:* versoepel TOKENVORM tot /.+/ en stuur een ingetrokken token met een spatie ervoor

### RTG-004 -- Een wachtwoordwijziging beëindigt elke lopende sessie

`ONBEPROEFD` · geen van de toetsen is zien zakken op een mutatie

Iemand herstelt zijn wachtwoord meestal OMDAT er iets mis is. Precies dan hoort de meelezer eruit te vliegen en niet rustig te blijven zitten terwijl het slot wordt vervangen.

*Handhaver:* `server/accounts/tokens.js`

*Toets:* `test/sessiegrens.test.js`

*Breek hem zo:* laat verifyToken sessies_vanaf negeren; een token van voor de wijziging werkt dan weer

### RTG-005 -- Een grendel hangt aan het doel, niet aan de aanvrager

`BEWEZEN` · zien zakken in `algpin.test.js` op `liegpoort /api/`

Twee deuren naar dezelfde pin hielden elk hun eigen teller, en de tweede hing aan het account van de aanvrager. Twintig gratis accounts gaven twintig keer vijf pogingen per minuut op één pin van vier cijfers.

*Handhaver:* `server/pinslot.js`

*Toets:* `test/algpin.test.js`

*Breek hem zo:* geef de teller een sleutel met het account van de aanvrager erin; het slot valt dan uiteen in losse tellers

### RTG-006 -- Een leverancier raakt de gegevens van een andere leverancier niet aan

`BEWEZEN` · zien zakken in `hack.test.js` op `liegpoort /api/`

IDOR is de stilste fout die er is: alles werkt, niemand krijgt een foutmelding, en de gegevens van een ander zijn weg.

*Handhaver:* `server/opzet/diensten.js`

*Toets:* `test/hack.test.js`

*Breek hem zo:* laat staff/remove het staffId zonder eigenaarscontrole opzoeken

### RTG-007 -- Productie start nooit met onveilige secrets

`BEWEZEN` · zien zakken in `productie.test.js` op `===->!==#0`

Vielen de sleutels terug op de datamap, dan lag de sleutel naast de database die hij moest beschermen -- en dan is de hele pseudonimisering waardeloos. Een waarschuwing die je kunt negeren beschermt niemand, dus dit blokkeert de start.

*Handhaver:* `server/config/productie.js`

*Toets:* `test/productie.test.js`

*Breek hem zo:* zet de sleutelcontrole om van fouten.push naar waarschuwingen.push; de start lukt dan zonder sleutel

### RTG-008 -- Een productiestart op een opslag zonder grootboek wordt geweigerd

`BEWEZEN` · zien zakken in `productie.test.js` op `===->!==#0`

Geld op een opslag die geen grootboek kan bijhouden is geld dat je niet kunt verklaren. Liever niet starten dan stil verkeerd tellen.

*Handhaver:* `server/config/productie-opslag.js`

*Toets:* `test/productie.test.js`, `test/opslagpoort.test.js`

*Breek hem zo:* laat keurOpslag de grootboekeis overslaan bij een json-opslag

### RTG-009 -- Een instance die zijn staat nog laadt, beantwoordt geen API-verkeer

`BEWEZEN` · zien zakken in `opslagpoort.test.js` op `true->false#0`

Fase D van de beproeving op 65M-schaal: een instance serveerde zijn verouderde snapshot en een schrijfactie in dat venster overschreef daarna de echte staat. Saldi 'overleefden' een herstart niet.

*Handhaver:* `server/middleware/remmen.js`

*Toets:* `test/opslagpoort.test.js`

*Breek hem zo:* laat opslagPoort altijd next() aanroepen; een herstart geeft dan antwoorden uit de oude snapshot

### RTG-010 -- Een versleuteld veld hoort bij de rij waar het staat

`BEWEZEN` · zien zakken in `kluis-binding.test.js` op `return-weg#0`

Versleuteling zegt niets over waar iets thuishoort. Wie de database kan bewerken kon een versleutelde naam naar de rij van een ander verplaatsen; de AEAD merkte niets en het huis las een echte naam bij de verkeerde codenaam.

*Handhaver:* `server/accounts/gebonden.js`

*Toets:* `test/kluis-binding.test.js`

*Breek hem zo:* haal de rij-identiteit uit de additional authenticated data; de aanval met rauwe SQL slaagt dan

### RTG-011 -- Een opgeslagen bestand hoort bij de naam waaronder het is opgeslagen

`BEWEZEN` · zien zakken in `bestand-binding.test.js` op `+->-#1`

Dezelfde fout een laag lager: wie bij de opslag kon, wisselde twee KYC-blobs om en de backoffice keurde goed op het verkeerde identiteitsbewijs.

*Handhaver:* `server/kluis.js`

*Toets:* `test/bestand-binding.test.js`

*Breek hem zo:* laat de bestandsnaam uit de AAD; twee omgewisselde blobs gaan dan gewoon open

### RTG-012 -- De zoek-hash op e-mail en telefoon roteert niet mee met de kluissleutel

`BEWEZEN` · zien zakken in `kluis-rotatie.test.js` op `return-weg#0`

Zou hij meebewegen, dan kon niemand meer op zijn e-mailadres inloggen, en halverwege een rotatie stond de helft van de leden buiten.

*Handhaver:* `server/accounts/kluis.js`

*Toets:* `test/kluis-rotatie.test.js`

*Breek hem zo:* laat de zoek-hash de nieuwste sleutel gebruiken; de inlogtest in kluis-rotatie.test.js hoort te zakken

### RTG-013 -- Wie een identiteit opvraagt, laat een spoor na dat de naam zelf niet bevat

`BEWEZEN` · zien zakken in `inzagelog.test.js` op `===->!==`

Een kluis die je ongemerkt kunt openen is geen kluis. En zou de opgevraagde naam in het journaal staan, dan was dat een tweede, onversleutelde kopie van de kluis.

*Handhaver:* `server/inzagelog.js`

*Toets:* `test/inzagelog.test.js`

*Breek hem zo:* schrijf de opgevraagde naam mee in het journaal, of sla het journaal over bij een leesactie

### RTG-014 -- Geen logregel draagt een querystring

`BEWEZEN` · zien zakken in `sabotage` op `server/log.js`

SSE kan geen Authorization-header sturen, dus daar reist het sessietoken mee in de URL. Een logger die de volledige URL schrijft, schrijft dus tokens.

*Handhaver:* `server/log.js`

*Toets:* `test/loghygiene.test.js`

*Breek hem zo:* log req.originalUrl in plaats van req.path

### RTG-015 -- Elk uitgaand doel dat een client bepaalt, gaat eerst door de SSRF-keuring

`BEWEZEN` · zien zakken in `sabotage` op `server/kern/ssrf.js`

Het push-endpoint komt van de browser en de server POST daar later naartoe. Zonder keuring is dat een vrijbrief om de cloud-metadata op 169.254.169.254 te laten ophalen.

*Handhaver:* `server/kern/ssrf.js`

*Toets:* `test/ssrf.test.js`

*Breek hem zo:* laat veiligeExternalUrl altijd true teruggeven

### RTG-016 -- Elk bestand dat binnenkomt, gaat langs De Ontsmetter -- langs welke weg dan ook

`BEWEZEN` · zien zakken in `upload-poort.test.js` op `liegpoort /api/`

Het scan-net keek naar complete data-URL's in de body. Bestanden boven 8 MB komen in kale base64-stukken binnen, zonder kop: het geheel ontstond pas op de server, waar geen body meer omheen zat.

*Handhaver:* `server/kern/antivirus/index.js`, `server/opzet/poortwachters.js`

*Toets:* `test/upload-poort.test.js`, `test/antivirus.test.js`

*Breek hem zo:* laat de stukjes-route de scanner overslaan; de EICAR-string komt dan langs één van de twee wegen binnen

### RTG-017 -- Geen pagina draait op 'unsafe-inline' voor scripts

`ONBEPROEFD` · geen van de toetsen is zien zakken op een mutatie

De terugval-CSP was zwakker dan de nonce-versie, en juist '/' viel erop terug -- de meest bezochte pagina had de zwakste regel. Een terugval hoort strenger te zijn, zodat hij zichtbaar breekt in plaats van stil te verzwakken.

*Handhaver:* `server/middleware/voordeur.js`, `server/opzet/koppen.js`

*Toets:* `test/csp.e2e.js`

*Breek hem zo:* zet 'unsafe-inline' terug in de terugval-CSP; csp.e2e.js eist nul blokkades op de vlaggenschepen

### RTG-018 -- De ratelimit telt op een IP dat de bezoeker niet zelf kan verzinnen

`BEWEZEN` · zien zakken in `proxykop.test.js` op `===->!==#0`

trust proxy stond vast op 1. Zodra de app rechtstreeks bereikbaar is, is de bezoeker de eerste hop en verzint hij zijn eigen X-Forwarded-For -- elke limiet met één kop omzeild.

*Handhaver:* `server/opzet/verzoekketen.js`

*Toets:* `test/proxykop.test.js`

*Breek hem zo:* zet trust proxy weer hard op 1 en stuur een eigen X-Forwarded-For mee

### RTG-019 -- Aanhoudende brute force laat de zekeringen springen zonder dat er een mens bij hoeft

`BEWEZEN` · zien zakken in `beveiliging.test.js` op `===->!==`

Een aanval om drie uur 's nachts wacht niet op de eigenaar. Vanaf drie bronnen gaat de registratie eruit, vanaf zes de hele app in onderhoud -- en alleen een mens doet ze er weer in.

*Handhaver:* `server/beveiliging.js`

*Toets:* `test/beveiliging.test.js`

*Breek hem zo:* laat noodrem() de bronnen tellen in plaats van de verschillende bronnen, of zet de drempel op oneindig

### RTG-020 -- Verkeer van een IP in quarantaine komt er niet in, ongeacht banlijst of plafond

`BEWEZEN` · zien zakken in `hack.test.js` op `liegpoort /api/`

Een besluit van de raadkamer moet zwaarder wegen dan een teller. Anders is 'afgesneden' een advies.

*Handhaver:* `server/kern/schild.js`, `server/kern/wacht/afweer.js`

*Toets:* `test/hack.test.js`

*Breek hem zo:* laat de quarantainecontrole na de banlijstcontrole staan en bij een verlopen ban doorlopen

### RTG-021 -- De som van alle wallets blijft op de cent gelijk aan wat er is opgeladen

`BEWEZEN` · zien zakken in `geld-conservatie-last.test.js` op `liegpoort /api/`

Geldconservatie is de enige controle die een dubbeltelling én een race tegelijk vangt. Onverklaard geld is geen afrondingsfout maar een bug die je nog niet kunt zien.

*Handhaver:* `server/muntbetaal.js`

*Toets:* `test/geld-conservatie-last.test.js`, `test/balans.test.js`

*Breek hem zo:* haal de transactiegrens rond de overboeking weg; onder gelijktijdige tikken loopt de som dan uiteen

### RTG-022 -- Geen wallet zakt ooit onder nul

`BEWEZEN` · zien zakken in `geld-conservatie-last.test.js` op `liegpoort /api/`

Een negatief saldo is geld dat het huis heeft uitgegeven zonder dat iemand het had.

*Handhaver:* `server/muntbetaal.js`

*Toets:* `test/geld-conservatie-last.test.js`, `test/munten.test.js`

*Breek hem zo:* controleer het saldo vóór in plaats van binnen de schrijfactie; twee gelijktijdige tikken gaan er dan doorheen

### RTG-023 -- Alles wat een prestatie bewaart buiten het potje, bestaat alleen boven de 18

`BEWEZEN` · zien zakken in `sabotage` op `server/kern/spellen/grens.js`

Ranglijsten, niveaus en seizoenen zijn de haakjes waarmee een spel een kind vasthoudt. Onder die grens blijft elk spel volledig speelbaar; er wordt alleen niets van bewaard. De grens staat op een plek, zodat een nieuwe progressievorm er niet omheen kan groeien. LET OP, en dit vond de sabotagemotor: van de zes spel-toetsen injecteren er vijf hun EIGEN progressieMag (spelbeleid, spelprestaties, speluitslagen, speltelling, spelpoort) en raken de echte grens dus nooit. Zet je progressieMag in grens.js op altijd-waar, dan blijven die vijf groen. Alleen speldag.test.js valt om. Deze wet noemt daarom die ene toets, en de sabotagemotor bewaakt dat hij dat blijft doen.

*Handhaver:* `server/kern/spellen/grens.js`

*Toets:* `test/speldag.test.js`

*Breek hem zo:* laat progressieMag altijd true teruggeven; de leeftijdstoetsen in spelbeleid.test.js horen te vallen

### RTG-024 -- Twee werelden delen niets muteerbaars buiten de aangewezen gedeelde infrastructuur

`BEWEZEN` · zien zakken in `domeingrens.test.js` op `===->!==#0`

Gedeelde muteerbare staat is de bugklasse die zich niet laat toetsen: hij verschijnt pas als twee werelden toevallig tegelijk draaien. De grens hoort in de code te staan en niet in een afspraak.

*Handhaver:* `server/opzet/domeingrens.js`

*Toets:* `test/domeingrens.test.js`

*Breek hem zo:* geef een domein toegang tot een kernnaam die niet in GRENZEN.json staat

### RTG-025 -- Elk scherm is aan te tikken vanaf het beginscherm

`ONBEPROEFD` · geen van de toetsen is zien zakken op een mutatie

Een scherm zonder klikroute bestaat wel in de code en niet voor een mens. BEREIK.json mag daarom alleen krimpen.

*Handhaver:* `BEREIK.json`

*Toets:* `test/bereikbaar.test.js`

*Breek hem zo:* voeg een scherm toe waar niets naartoe linkt; de lijst in BEREIK.json hoort te groeien en de toets te zakken

### RTG-026 -- Een meter draagt pas een oordeel als hij is zien uitslaan

`ONBEPROEFD` · geen van de toetsen is zien zakken op een mutatie

Op één dag bleken zeven meters te liegen, geen van allen in de RTG-code maar allemaal in de instrumenten die moesten bewijzen dat de code deugde. Een kapotte toets zakt; een kapotte meter geeft een getal.

*Handhaver:* `scripts/check.js`, `scripts/norm.js`

*Toets:* `test/meterijk.test.js`, `test/normprestatie.test.js`

*Breek hem zo:* voeg een meter toe aan METERS zonder ijking; check.js regel 35 hoort te zakken

### RTG-027 -- Geen geslaagde toets met een serverfout eronder

`BEWEZEN` · zien zakken in `streng-poorten.test.js` op `liegpoort /api/`

Een 5xx die niemand ziet is een bug met een groen vinkje erboven. Elke onverwachte 5xx, uncaughtException of unhandledRejection laat de suite zakken.

*Handhaver:* `test/helper.js`

*Toets:* `test/strenge-poort.test.js`, `test/streng-poorten.test.js`

*Breek hem zo:* laat de strenge poort 5xx-antwoorden tellen zonder te zakken

### RTG-028 -- Elke belofte in tekst draagt dekking in code

`ONBEPROEFD` · geen van de toetsen is zien zakken op een mutatie

Een belofte die naar iets verwijst dat er niet meer is, mist niemand vanzelf. Daarom heet die stand GEBROKEN en zakt hij.

*Handhaver:* `scripts/belofte.js`

*Toets:* `test/belofte.test.js`

*Breek hem zo:* laat een belofte naar een verwijderd pad wijzen; de controle hoort GEBROKEN te melden

### RTG-029 -- Elke soort ding heeft een handhaver, of staat met naam op de lijst van wat niemand bewaakt

`OPEN` · geen toets benoemd

Niet 'zakt er iets' maar 'kijkt er iemand'. Wat niet in de census staat wordt niet gehandhaafd, en dat is geen tekortkoming van de lijst maar informatie.

*Handhaver:* `scripts/samenhang.js`

*Breek hem zo:* OPEN: de census draait, maar geen enkele toets valt hem aan met een verzonnen handhaver

### RTG-030 -- Bodoni staat op een gesloten lijst rollen

`ONBEPROEFD` · geen van de toetsen is zien zakken op een mutatie

Bodoni is ceremonieel. Zodra hij ook werk-elementen mag dragen, is het geen ceremonie meer maar een lettertype.

*Handhaver:* `public/shared/rtg-ontwerp.css`

*Toets:* `test/ontwerp.test.js`

*Breek hem zo:* zet Bodoni op een knop of een tabelkop; ontwerp.test.js hoort dat te weigeren

### RTG-031 -- Een scherm kiest een materiaal, geen kleur

`ONBEPROEFD` · geen van de toetsen is zien zakken op een mutatie

Een luxemerk denkt in materialen en licht. Losse kleuren stapelen zich op tot er geen vormtaal meer over is.

*Handhaver:* `public/shared/rtg-materiaal.css`

*Toets:* `test/materiaal.test.js`

*Breek hem zo:* introduceer een losse hexkleur buiten de vijf materialen

### RTG-032 -- Er zijn geen twee beginschermen

`ONBEPROEFD` · geen van de toetsen is zien zakken op een mutatie

Er lagen er twee naast elkaar: een springboard en een scrollende pagina met eigen kopbalk. Je wist nooit welke 'thuis' was. Alle paden komen nu op dezelfde plek uit.

*Handhaver:* `server/middleware/voordeur.js`

*Toets:* `test/beginscherm.test.js`

*Breek hem zo:* laat /apps/index.html weer een eigen pagina serveren in plaats van naar huis te herschrijven

### RTG-033 -- Geld verlaat het huis nooit vanzelf

`OPEN` · geen handhaver benoemd

De harde grens van GELD.md. Automatisering mag alles voorbereiden, maar de laatste stap naar buiten is een menselijk besluit.

*Breek hem zo:* OPEN: er is nog geen enkele handhaver die deze wet als wet afdwingt in plaats van per route

### RTG-034 -- Kritieke historie kan niet stil worden herschreven

`OPEN` · geen toets benoemd

Een auditketen die alleen binnen RTG leeft, beschermt niet tegen wie zowel de database als de applicatie beheert. De hashketen bestaat; een externe verankering nog niet.

*Handhaver:* `server/kern/command/alarm.js`

*Breek hem zo:* OPEN: er is geen toets die een herschreven schakel in de keten aanvalt en eist dat hij opvalt

### RTG-035 -- Een ingetrokken toestemming geeft onmiddellijk geen toegang meer

`OPEN` · geen toets benoemd

Rechten die pas bij de volgende sessie ingaan, zijn geen rechten maar een gewoonte. Dit is nu per route geregeld en nergens als wet afgedwongen.

*Handhaver:* `server/kern/bevoegdheid/index.js`

*Breek hem zo:* OPEN: er is geen toets die een recht midden in een lopende sessie intrekt en het eerstvolgende verzoek meet

### RTG-036 -- Geen scherm toont meer zekerheid dan de bron bezit

`BEWEZEN` · zien zakken in `sabotage` op `scripts/zekerheid.js`

Een systeem dat zijn onbekenden verbergt, liegt over precies het deel dat je moet weten. Het zekerheidspaneel kan daarom geen kaal oordeel geven: het draagt altijd het aantal onbekenden en de woorden NIET ABSOLUUT, ook in een wereld waarin alles gemeten en alles groen is. En een meting die haar bron niet vindt geeft null, nooit nul -- een nul leest als 'niets aan de hand'.

*Handhaver:* `scripts/zekerheid.js`

*Toets:* `test/zekerheid.test.js`

*Breek hem zo:* laat oordeel() alleen het niveau teruggeven, of laat een ontbrekende bron 0 melden in plaats van null

## Hoe je dit bestand bijwerkt

```
node scripts/wetten.js              # opnieuw genereren
node scripts/wetten.js --controle   # zakt op een GEBROKEN wet of een achterlopend bestand
node scripts/wetten.js --zelftest   # laat de motor zelf uitslaan (LAT.md regel 10)
```
