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
| **BEWEZEN** | 37 | handhaver bestaat, toets bestaat, en die toets is zien zakken op een mutatie |
| **ONBEPROEFD** | 1 | er kijkt iemand naar, maar die kijker is nooit op de proef gesteld |
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

`BEWEZEN` · zien zakken in `sabotage` op `server/accounts/tokens.js`

Buffer.from(x,'base64url') negeert tekens buiten het alfabet. Een spatie voor een ingetrokken token maakte het weer geldig: uitloggen was met een enkel teken te omzeilen. Fail closed, en iedereen kijkt naar dezelfde bytes. De sabotagemotor liet zien dat hier GEEN toets op zat: TOKENVORM helemaal uitzetten maakte niets rood, omdat accounts.test.js alleen `token+'x'` en `'onzin'` probeert en die twee op de HANDTEKENING afvallen, niet op de vorm. test/tokenvorm.test.js voert nu de echte aanval: uitloggen, en daarna hetzelfde token met een spatie ervoor.

*Handhaver:* `server/accounts/tokens.js`

*Toets:* `test/tokenvorm.test.js`, `test/accounts.test.js`

*Breek hem zo:* versoepel TOKENVORM tot /.+/ en stuur een ingetrokken token met een spatie ervoor

### RTG-004 -- Een wachtwoordwijziging beëindigt elke lopende sessie

`BEWEZEN` · zien zakken in `sabotage` op `server/accounts/tokens.js`

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

`BEWEZEN` · zien zakken in `sabotage` op `server/middleware/remmen.js`

Fase D van de beproeving op 65M-schaal: een instance serveerde zijn verouderde snapshot en een schrijfactie in dat venster overschreef daarna de echte staat. Saldi 'overleefden' een herstart niet. LET OP een naamsverwarring die de sabotagemotor blootlegde: test/opslagpoort.test.js gaat NIET over deze middleware maar over de productiekeuring ('geen grootboek, geen productie'). De middleware zelf staat in test/middleware.test.js. Deze wet wees eerst naar de verkeerde, en dat viel pas op toen de handhaver echt uit ging.

*Handhaver:* `server/middleware/remmen.js`

*Toets:* `test/middleware.test.js`, `test/opslagpoort.test.js`

*Breek hem zo:* laat opslagPoort altijd next() aanroepen; een herstart geeft dan antwoorden uit de oude snapshot

### RTG-010 -- Een versleuteld veld hoort bij de rij waar het staat

`BEWEZEN` · zien zakken in `sabotage` op `server/accounts/gebonden.js`

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

`BEWEZEN` · zien zakken in `sabotage` op `server/inzagelog.js`

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

### RTG-021 -- Een bevestigde financiele handeling creeert, vernietigt of verliest geen onverklaarde waarde

`BEWEZEN` · zien zakken in `sabotage` op `server/kern/pay/index.js`

Dit is de conservatiewet, en hij staat met opzet ZONDER implementatienaam. Hij stond eerst als 'de som van alle wallets blijft op de cent gelijk aan wat er is opgeladen', en dat is dezelfde eis maar vastgeklonken aan een wallet en aan opladen. Zo'n formulering overleeft geen verhuizing naar Postgres, naar de Rust-motor, of naar een ander grootboek -- terwijl de EIS dat wel moet. Nu meet hij wat er werkelijk toe doet: na een bevestigde handeling is de som van alle rekeningen nog steeds exact nul (dubbel boekhouden, sluitcontrole in kern/pay/index.js) en is elk verschil te verklaren uit een boeking. ONDERSCHEID MET RTG-033, want die twee worden makkelijk verward: 033 is de AUTONOMIEgrens (geld verlaat het huis nooit vanzelf, er hoort een mens aan te pas), 021 is de CONSERVATIEwet (wat er ook gebeurt, er ontstaat of verdwijnt geen waarde). Een systeem kan de ene houden en de andere breken.

*Handhaver:* `server/kern/pay/index.js`, `server/muntbetaal.js`

*Toets:* `test/waardebehoud.test.js`, `test/geld-conservatie-last.test.js`, `test/balans.test.js`

*Breek hem zo:* haal de saldocontrole uit boek(); dan kan een rekening onder nul en klopt de sluitcontrole niet meer

### RTG-022 -- Geen rekening van een lid of partner zakt ooit onder nul

`OPEN` · geen toets benoemd

Een negatief saldo is geld dat het huis heeft uitgegeven zonder dat iemand het had. De guard staat in kern/pay/index.js (boek() weigert met 402 als saldoVan(van) < c). OPEN, EN DAT IS EEN GEMETEN BEVINDING: die guard is via de HTTP-API niet te bereiken. Elk pad dat rood zou kunnen gaan, doet iets anders eerst. Een lid dat meer stuurt dan het heeft, krijgt 'EEN knop': de wallet laadt zichzelf bij via de betaal-naad, en in demostand slaagt die betaling altijd -- 4000 euro sturen met saldo 0 gaf gewoon 200 met bijgeladen:400000. En een partner die te veel uitbetaalt, wordt eerder geweigerd door de route ('er staat niets om uit te betalen'), een andere controle. Ik heb de guard uitgezet en GEEN enkele toets werd rood, ook de nieuwe niet. Wat hier nog moet: een toets die boek() rechtstreeks aanroept, buiten de route-laag om. Zolang die er niet is, blijft deze wet OPEN in plaats van dat er een sabotage staat die groen wordt om de verkeerde reden.

*Handhaver:* `server/kern/pay/index.js`

*Breek hem zo:* OPEN: de saldogrens in boek() is via de API onbereikbaar; er is een unit-toets op boek() nodig

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

`BEWEZEN` · zien zakken in `sabotage` op `BEREIK.json`

Een scherm zonder klikroute bestaat wel in de code en niet voor een mens. BEREIK.json mag daarom alleen krimpen.

*Handhaver:* `BEREIK.json`

*Toets:* `test/bereikbaar.test.js`

*Breek hem zo:* voeg een scherm toe waar niets naartoe linkt; de lijst in BEREIK.json hoort te groeien en de toets te zakken

### RTG-026 -- Een meter draagt pas een oordeel als hij is zien uitslaan

`BEWEZEN` · zien zakken in `sabotage` op `scripts/norm.js`

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

`BEWEZEN` · zien zakken in `sabotage` op `scripts/belofte.js`

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

`BEWEZEN` · zien zakken in `sabotage` op `public/shared/rtg-ontwerp.css`

Bodoni is ceremonieel. Zodra hij ook werk-elementen mag dragen, is het geen ceremonie meer maar een lettertype.

*Handhaver:* `public/shared/rtg-ontwerp.css`

*Toets:* `test/ontwerp.test.js`

*Breek hem zo:* zet Bodoni op een knop of een tabelkop; ontwerp.test.js hoort dat te weigeren

### RTG-031 -- De vijf materialen houden hun eigen aard: warm blijft warm, mat blijft mat, fluweel blijft donker

`BEWEZEN` · zien zakken in `sabotage` op `public/shared/rtg-materiaal.css`

Een luxemerk denkt in materialen en licht, niet in losse kleuren. Wat test/materiaal.test.js MACHINAAL vasthoudt is de aard van de vijf: Pearl mag nooit meer blauw dan rood zijn, Gold blijft mat champagne en geen internet-goud, Bordeaux absorbeert licht, Onyx is nooit egaal, Royal is als enige koel. EERLIJK OVER WAT HIER NIET IN ZIT, en de sabotagemotor wees me daarop: de wet stond eerst als 'een scherm kiest een materiaal, geen kleur', en die ruimere belofte wordt NIET gehandhaafd. Ik zette een losse hexkleur in rtg-materiaal.css en er werd niets rood. Een wet die meer belooft dan zijn handhaver waarmaakt, is precies het soort schijnzekerheid waar dit register tegen bedoeld is; daarom staat er nu wat er echt wordt afgedwongen. Het bredere 'geen losse kleuren' hoort in NORM.json als teller thuis, niet hier als wet.

*Handhaver:* `public/shared/rtg-materiaal.css`

*Toets:* `test/materiaal.test.js`

*Breek hem zo:* maak Pearl blauwer dan rood, of Bordeaux lichter; materiaal.test.js hoort dat te weigeren

### RTG-032 -- Er zijn geen twee beginschermen

`BEWEZEN` · zien zakken in `sabotage` op `server/middleware/voordeur.js`

Er lagen er twee naast elkaar: een springboard en een scrollende pagina met eigen kopbalk. Je wist nooit welke 'thuis' was. Alle paden komen nu op dezelfde plek uit. De sabotagemotor liet zien dat hier GEEN toets op zat: de herschrijving van /apps/index.html weghalen maakte niets rood. test/beginscherm.test.js gaat over de acht werelden op de bezel en de tegels, niet over welke URL's thuis uitkomen. test/eenbeginscherm.test.js haalt nu alle vier de paden op en eist dezelfde pagina, plus dat het een interne herschrijving is en geen omleiding.

*Handhaver:* `server/middleware/voordeur.js`

*Toets:* `test/eenbeginscherm.test.js`, `test/beginscherm.test.js`

*Breek hem zo:* laat /apps/index.html weer een eigen pagina serveren in plaats van naar huis te herschrijven

### RTG-033 -- Geld verlaat het huis nooit vanzelf

`BEWEZEN` · zien zakken in `sabotage` op `server/kern/geldbeleid/regels.js`

De harde grens van GELD.md par. 3: 'automatisch' bestaat uitsluitend voor het oormerken binnen het eigen tegoed. Elke andere soort regel raakt (mogelijk) een betaling of een derde, en die blijft maximaal 'klaarzetten' -- wat het lid ook vraagt. LET OP hoe deze wet hier terechtkwam: ik schreef hem op als OPEN met 'er is nog geen enkele handhaver die deze wet als wet afdwingt', en dat was gewoon niet waar. De handhaver stond er al (regels.js weigert het niveau met een 400) en de toets ook, compleet met een opgeschreven mutatie die de schrijver had zien zakken. Ik had niet goed genoeg gezocht. Een register dat iets ten onrechte OPEN noemt, is niet onschuldig: het stuurt werk naar een gat dat er niet is, en het laat bescherming er zwakker uitzien dan ze is.

*Handhaver:* `server/kern/geldbeleid/regels.js`

*Toets:* `test/geldbeleid.test.js`

*Breek hem zo:* zet de niveaucontrole in regels.js op false; 'automatisch' mag dan op elke soort regel

### RTG-034 -- Kritieke historie kan niet stil worden herschreven

`OPEN` · geen toets benoemd

Een auditketen die alleen binnen RTG leeft, beschermt niet tegen wie zowel de database als de applicatie beheert. De hashketen bestaat; een externe verankering nog niet.

*Handhaver:* `server/kern/command/alarm.js`

*Breek hem zo:* OPEN: er is geen toets die een herschreven schakel in de keten aanvalt en eist dat hij opvalt

### RTG-035 -- Een ingetrokken toestemming geeft onmiddellijk geen toegang meer

`BEWEZEN` · zien zakken in `sabotage` op `server/kern/rtgid.js`

Rechten die pas bij de volgende sessie ingaan, zijn geen rechten maar een gewoonte: tussen het intrekken en het uitloggen zit dan een venster waarin iemand nog mag wat hij niet meer mag. Bij een machtiging is dat het gevaarlijkst -- je trekt hem juist in OMDAT er iets veranderd is. bevestig() in rtgid.js weigert een ingetrokken machtiging met een 403, en test/intrekking.test.js meet het EERSTVOLGENDE verzoek: geen nieuwe login, geen herstart, geen wachten. De toets bewijst eerst dat B de machtiging KAN gebruiken; zonder die stap ziet een toets waarin B het nooit mocht er hetzelfde uit als een toets waarin intrekken werkt.

*Handhaver:* `server/kern/rtgid.js`

*Toets:* `test/intrekking.test.js`

*Breek hem zo:* haal de m.ingetrokken-controle uit bevestig(); B mag dan na het intrekken nog steeds

### RTG-036 -- Geen scherm toont meer zekerheid dan de bron bezit

`BEWEZEN` · zien zakken in `sabotage` op `scripts/zekerheid.js`

Een systeem dat zijn onbekenden verbergt, liegt over precies het deel dat je moet weten. Het zekerheidspaneel kan daarom geen kaal oordeel geven: het draagt altijd het aantal onbekenden en de woorden NIET ABSOLUUT, ook in een wereld waarin alles gemeten en alles groen is. En een meting die haar bron niet vindt geeft null, nooit nul -- een nul leest als 'niets aan de hand'.

*Handhaver:* `scripts/zekerheid.js`

*Toets:* `test/zekerheid.test.js`

*Breek hem zo:* laat oordeel() alleen het niveau teruggeven, of laat een ontbrekende bron 0 melden in plaats van null

### RTG-037 -- Een uitzondering verloopt, of het is geen uitzondering

`BEWEZEN` · zien zakken in `sabotage` op `scripts/uitzonderingen.js`

Elk volwassen systeem wijkt ergens van zijn eigen regels af. Het verschil zit niet in het aantal afwijkingen maar in wat ermee gebeurt. De gebruikelijke vorm -- // TODO -- noemt geen risico, heeft geen eigenaar en verloopt nooit, en overleeft dus iedereen die weet waarom hij er staat. Hier draagt elke afwijking een wet, een risico, een compenserende maatregel, een eigenaar en een vervaldatum; na die datum zakt de keuring en moet er een besluit komen. Stilzwijgend eeuwig bestaan is de enige uitkomst die onmogelijk is.

*Handhaver:* `scripts/uitzonderingen.js`, `EXCEPTIONS.json`

*Toets:* `test/uitzonderingen.test.js`

*Breek hem zo:* zet BIJNA_DAGEN op 0, maak de VERPLICHT-lijst leeg, of laat een verlopen datum als GELDIG tellen

### RTG-038 -- Een security-identiteit heeft voor vergelijking een canonieke vorm, of niet-canonieke vormen worden hard geweigerd

`BEWEZEN` · zien zakken in `sabotage` op `server/sleutelvorm.js`

De foutklasse achter RTG-003 is breder dan tokens: een security-beslissing vergelijkt BYTES, dus zodra dezelfde betekenis in twee schrijfwijzen bestaat, bestaan er twee uitkomsten -- en de tweede is de gaatjesroute. Twee keer echt gebeurd. Bij het sessietoken decodeerde ' <token>' naar dezelfde bytes terwijl de intreklijst de rauwe string bewaarde; daar is gekozen voor hard weigeren. Bij het cloud-metadata-adres normaliseerden metadataDoel() en onveiligIpLiteral() allebei zelf en liepen uiteen, waardoor de lichte webhook-poort http://[::ffff:169.254.169.254]/ doorliet terwijl http://169.254.169.254/ geweigerd werd; daar is gekozen voor EEN gedeelde canonieke vorm. En er bleek een derde schrijfwijze te bestaan die de eerste reparatie niet dekte: new URL() comprimeert dat adres zelf tot [::ffff:a9fe:a9fe]. Een canonieke vorm die de vorm van de eigen parser niet kent, is geen canonieke vorm. Derde geval, gevonden door de categorieen af te lopen: het WAF-patroon voor pad-klimmen eiste `..` met een LETTERLIJKE slash erachter, dus /..%2fetc/passwd en /..%5cx en /%252e%252e/x gingen er doorheen terwijl /../etc/passwd geblokkeerd werd. Het schild is een detectielaag en niet de laatste verdediging, maar wie in de vorm schrijft die het schild niet kent, wordt ook niet GETELD -- en die telling drijft de banlijst en de automatische noodrem. Nu gaat elk pad eerst door canoniekPad(). Nagelopen en in orde bevonden: e-mail (emailHash trimt en lowercased, zelfde vorm bij schrijven en opzoeken), headers (de clustersleutel gaat via veiligGelijk; een dubbele header wordt door Node tot 'a, b' samengevoegd en faalt dus, fail-closed), en bestandspaden (naamVan doet path.basename, dus mapdelen verdwijnen). Vierde en laatste categorie, en daar was de schade het grootst: de idempotentiesleutel komt van de client en ging byte-exact naar zowel onze eigen opslag als de idempotencyKey van de betaalprovider, dus idem="abc" en idem=" abc" waren twee AFSCHRIJVINGEN. Daar is gekozen voor normaliseren (NFC + trim) en niet voor weigeren: bij een retry is samenvoegen juist de bedoeling, terwijl er bij een token geen legitieme reden bestaat om er een spatie voor te zetten. Hoofdletters worden bewust NIET gevouwen -- in base64 of hex zijn aB en Ab echt twee sleutels, en gelijkstellen zou een tweede betaling stilzwijgend als herhaling zien en dus laten vervallen. Alle vier de categorieen zijn nu nagelopen.

*Handhaver:* `server/kern/ssrf.js`, `server/kern/schild.js`, `server/accounts/tokens.js`, `server/sleutelvorm.js`

*Toets:* `test/canoniek.test.js`, `test/padvorm.test.js`, `test/sleutelvorm.test.js`, `test/retrygedrag.test.js`, `test/tokenvorm.test.js`

*Breek hem zo:* laat metadataDoel weer zijn eigen normalisatie doen in plaats van canoniekHost, of haal de ::ffff-hexomzetting eruit

### RTG-039 -- Canonisatie voegt samen wat hetzelfde betekent, en nooit wat verschillend is

`BEWEZEN` · zien zakken in `sabotage` op `server/sleutelvorm.js`

De spiegelkant van RTG-038, en de duurdere van de twee. Een canonisatie die te ver gaat, stelt twee ECHT verschillende identiteiten gelijk -- en op de geldketen betekent dat een tweede, legitieme opdracht stilzwijgend als herhaling wordt gezien en dus NIET gebeurt. Case-vouwen is daar het scherpste voorbeeld: in base64 of hex zijn aB en Ab twee sleutels. Een dubbele afschrijving valt op en is terug te draaien; een betaling die stil verdwijnt niet. Daarom is dit een eigen wet en geen voetnoot bij RTG-038: 'canonisatie werkt' en 'canonisatie gaat niet te ver' zijn twee beweringen, en een toets die alleen de eerste doet, dekt de duurdere fout niet. test/retrygedrag.test.js telt daarvoor de ECHTE schrijfacties in plaats van de teruggegeven id te vergelijken -- een implementatie die netjes hetzelfde id teruggeeft en ondertussen tweemaal wegschrijft, komt anders gewoon door.

*Handhaver:* `server/sleutelvorm.js`, `server/opzet/lijfpoort.js`

*Toets:* `test/retrygedrag.test.js`, `test/grootboek-idem.test.js`

*Breek hem zo:* zet een toLowerCase() achter de canonisatie: twee legitieme opdrachten vallen dan samen tot een

### RTG-040 -- Een retry raakt het grootboek precies een keer, niet alleen de betaallaag

`BEWEZEN` · zien zakken in `sabotage` op `server/opzet/lijfpoort.js`

Idempotentie op de betaallaag is niet hetzelfde als idempotentie op het geld, en dat verschil was een echte bug. server/sleutelvorm.js canoniseerde de sleutel van de BETALING al, maar server/lib/idem.js -- de laag die het grootboek grendelt -- kreeg zijn sleutel rauw. Bij een retry met witruimte zag de betaling dus een herhaling en het grootboek een nieuw verzoek. Gemeten met een echte server: /api/pay/oplaad met idem 'probe-1' en daarna ' probe-1 ' gaf saldo 10000 in plaats van 5000. Vijftig euro werd honderd, en geen enkele toets op de betaallaag had dat gezien. De reparatie zit in de body-poort en niet bij de vergelijking: de client-sleutel staat MIDDEN in de samengestelde sleutel ('oplaad:' + codenaam + ':' + idem), dus canoniseren bij de vergelijking trimt de buitenkant en laat de spatie binnenin staan -- die versie is gebouwd, gemeten en zien falen. Canoniseren hoort dus voor het samenstellen, en dan is er precies een plek: waar de body binnenkomt.

*Handhaver:* `server/opzet/lijfpoort.js`, `server/lib/idem.js`

*Toets:* `test/grootboek-idem.test.js`

*Breek hem zo:* haal de idem-canonisatie uit de body-poort: een oplaad-retry met witruimte boekt dan twee keer

### RTG-999 -- Een tijdelijke ijkwet, met opzet zonder handhaver

`OPEN` · geen handhaver benoemd

Staat hier alleen tijdens test/meterijk.test.js.

### RTG-041 -- Een proces dat halverwege een boeking sterft, laat geen halve waarheid op schijf achter

`BEWEZEN` · zien zakken in `sabotage` op `server/kern/pay/index.js`

De kop van server/lib/idem.js beschrijft het venster precies: zonder save-bundel staat er tussen de geld-flush (in het werk) en de idem-flush (in de idem-laag) een toestand op schijf waarin de BOEKING bestaat en de SLEUTEL niet. Een kill precies daar, plus de retry waar idem-sleutels nu juist voor bestaan, boekt dubbel. Dat is geen theorie: het is zo gevonden, met een echte dubbele boeking van 137 centen, en gerepareerd met bijeen() in server/db/index.js -- een AsyncLocalStorage die de saves van het werk en van de idem-registratie tot EEN commit bundelt. test/bijeen.test.js houdt nu het MECHANISME en de BEDRADING vast, allebei deterministisch: binnen de bundel worden N saves een flush, buiten de bundel flusht elke save meteen, een save die NA de bundel binnenkomt (een timer die de context erfde) flusht echt in plaats van stil te verdwijnen, en beide geldlagen die metIdem gebruiken geven bijeen ook werkelijk mee. Die laatste is het regressierisico dat bij naam te noemen is: een nieuwe geldlaag die bijeen vergeet, valt stilzwijgend terug op twee losse flushes. WAT NOG OPEN STAAT, en de toets doet niet alsof hij dat vervangt: de echte crashproef -- een server hard afbreken tijdens een boeking, herstarten, dezelfde sleutel opnieuw -- vraagt een variabel kill-moment en meerdere rondes voordat je mag zeggen dat het venster echt geraakt is.

*Handhaver:* `server/db/index.js`, `server/lib/idem.js`

*Toets:* `test/bijeen.test.js`

*Breek hem zo:* haal het uitstellen uit save(), sluit de doos niet voor de flush, of laat bijeen weg bij een geldlaag

## Hoe je dit bestand bijwerkt

```
node scripts/wetten.js              # opnieuw genereren
node scripts/wetten.js --controle   # zakt op een GEBROKEN wet of een achterlopend bestand
node scripts/wetten.js --zelftest   # laat de motor zelf uitslaan (LAT.md regel 10)
```
