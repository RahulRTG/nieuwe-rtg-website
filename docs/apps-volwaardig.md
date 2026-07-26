# Welke OS-apps moeten voller worden

Dit is een inventarisatie, geen wensenlijst: per app staat wat er NU echt in zit
en wat er nog bij moet om het een volwaardige app te noemen. De cijfers zijn
gemeten, niet geschat, en met de opdracht eronder na te rekenen.

## Hoe dit gemeten is

```
node -e "
const fs=require('fs'),path=require('path');
const rows=[].concat(require('./server/kern/appcatalogus-rijen/deel1'),
                     require('./server/kern/appcatalogus-rijen/deel2'));
for(const [id,naam,cat,url] of rows){
  const s=fs.readFileSync(path.join('public',url),'utf8');
  const eps=new Set((s.match(/\/api\/[a-zA-Z0-9_\/-]+/g)||[])).size;
  console.log(naam, (s.length/1024).toFixed(0)+'KB', eps+' endpoints');
}"
```

Drie maten samen zeggen genoeg: hoe groot de pagina is, hoeveel verschillende
server-endpoints hij aanspreekt, en hoeveel knoppen erin staan. Een app van 8 KB
die één endpoint aanroept is een schil; 69 KB met zes endpoints en 35 knoppen is
een echte app.

**Stand van zaken: 66 apps in de bibliotheek. Eén is volwaardig (Spelen),
30 zijn halfvol, 35 zijn een schil.** De schillen zien er goed uit en passen in
de huisstijl, maar er zit één lijst en één knop in.

## Eerst een spanning benoemen, dan doorbouwen

De opdracht is "even veel functies als Instagram" en "alle functies van Facebook
of Snapchat". Dat kan, maar twee huisregels raken dit rechtstreeks en die zijn
niet vrijblijvend:

1. **Geen verslavende engagement-patronen** (CLAUDE.md). Instagram en TikTok
   halen hun tijd-op-app juist daaruit: oneindige scroll, streaks, "X heeft je
   verhaal gezien", pushmeldingen op het juiste moment, een feed die op
   verslavendheid is geoptimaliseerd. Dat mag hier niet.
2. **Privacy by design op codenamen.** LinkedIn werkt op echte namen en echte
   werkgevers; dat is het product. Hier staan echte namen in de gescheiden kluis.

Mijn lezing van de opdracht: **alle CAPACITEITEN van die apps, geen van hun
verslavingslussen.** Dus wel: verhalen, reels, karrousels, filters, groepen,
evenementen, marktplaats, professionele profielen, vacatures, aanbevelingen. Niet:
oneindige scroll, streak-druk, "wie keek er", en een aanbevelingsmotor die op
kijktijd stuurt in plaats van op relevantie. Waar het origineel een functie ALLEEN
heeft om je vast te houden, komt er een RTG-variant met dezelfde waarde en een
eindig einde — precies zoals Clips nu al doet met een eindige dagselectie.

Voor de codenamen-kant staat hieronder bij "Métier" een concreet voorstel. Als je
een van deze twee regels voor een specifieke app wilt oprekken, zeg dat dan
expliciet per app; ik ga dat niet zelf besluiten.

---

# Deel 1 — De vier die je noemde

## 1. De Salon → Instagram-niveau

**Waar hij nu woont.** De Salon is geen eigen app: hij zit als tab in het leden-OS
(`public/apps/app-main/`, o.a. `-02`, `-07`, `-11`, `-20`, `-21`, `-24`, `-26`) en
op de server in `server/routes/member/salon.js`, `server/kern/salonpromo.js` en
`server/kern/salonviraal.js`. Posts staan in de collectie `posts`, **afgekapt op
60 stuks** (`server/routes/supplier/salon/publiceren.js`).

**Wat er nu is.** Een feed met posts van partners en leden, `like`, `comment`,
`dm`, volgen (`/api/salon/volg`), een partnerprofiel (`/api/salon/profiel`),
polls (`/api/salon/poll/stem`), claimbare deals (`/api/salon/deal/claim`), de
promo-uitsnede voor site en campagne (`/api/salon/promo`, alleen featured, met
naamsvermelding), en de AI-beoordeling of een post maatschappelijk belangrijk is.

**Wat ontbreekt voor Instagram-pariteit.**

| Functie | Status | Wat het raakt |
|---|---|---|
| Eigen ledenprofiel met grid, bio, links, hoogtepunten | ontbreekt (alleen partners hebben een profiel) | nieuw `salonProfiel` per codenaam |
| Meerdere foto's per post (karrousel) + alt-tekst | ontbreekt | postmodel + uploadlaag |
| Video in de feed, eigen afspeler | ontbreekt | media-laag bestaat (Theater/Clips), niet gekoppeld |
| Verhalen (24 uur) in de Salon | bestaat alleen in RTF `vrienden.html` | `kern/sociaal/snaps.js` hergebruiken |
| Antwoorden op reacties, vermeldingen (@codenaam), hashtags | ontbreekt | comment-model + index |
| Opslaan/collecties, delen naar DM | ontbreekt | nieuw |
| Zoeken en ontdekken (op onderwerp, plaats, hashtag) | ontbreekt | zoekindex nodig |
| Feed voorbij 60 posts, paginering | **hard afgekapt op 60** | zelfde patroon als het tx-grootboek: venster + geïndexeerde rijen |
| Meldingen per gebeurtenis (like, reactie, vermelding) | deels (er is een notificatielaag) | koppelen |
| Blokkeren, rapporteren, verbergen, wie mag reageren | ontbreekt in de Salon zelf | `kern/veilig.js` bestaat, niet gekoppeld |
| Berichtenverzoeken, groeps-DM, reageren op een post in DM | DM is 1-op-1 | `routes/social/leden.js` |
| Inzicht voor de maker (bereik, bewaard, doorgestuurd) | alleen partner-statistieken | uitbreiden naar leden |
| Ondertiteling/alt-tekst en toetsenbordnavigatie | gedeeltelijk | a11y-keuring dwingt de basis al af |

**Bewust NIET overnemen:** oneindige scroll (wel "meer laden" met een eindige
dagselectie), "wie heeft je verhaal gezien" als drukmiddel, en een feed die op
kijktijd optimaliseert. De Salon cureert (RTG kiest featured); dat blijft.

**Eerste ronde die ik zou doen:** ledenprofiel + karrousel + paginering voorbij de
60. Dat drie zijn de fundering; de rest hangt eraan.

## 2. De LinkedIn-variant → er is nog geen app

Dit is de grootste bevinding: **er staat geen enkele werk- of carrière-app in de
bibliotheek van 66.** Wat er is, zit verstopt als tab in het leden-OS en in
`server/routes/member/werk.js` (7 endpoints) plus `server/kern/werk.js`:

- vacatures ophalen (`/api/member/vacatures`), solliciteren (`/api/member/apply`)
- sollicitatiegesprek-chat met de werkgever, automatisch vertaald
- een CV opslaan en ophalen (`/api/cv/get`, `/api/cv/save`)
- aan de werkgeverskant: de backoffice-lijst met sollicitanten

Dat is een vacaturebank met chat. Een professioneel netwerk is iets anders.

**Voorstel: "Métier", een eigen app.** Wat er dan bij moet:

| Functie | Opmerking |
|---|---|
| Professioneel profiel: rollen, jaren, vaardigheden, talen, portfolio | het CV bestaat al als data; dit is de publieke kant ervan |
| **Geverifieerd maar pseudonym** | Kern van het ontwerp: het profiel draait op je codenaam. RTG bevestigt wat het kan bevestigen ("werkte hier echt", "diploma gezien") zonder je naam te tonen. Je echte naam gaat pas mee als JIJ hem vrijgeeft aan één werkgever, uit de kluis, per keer. Dat is sterker dan LinkedIn, niet zwakker: daar liegt iedereen ongecontroleerd onder zijn eigen naam. |
| Netwerk: connecties, aanbevelingen, onderschrijvingen van vaardigheden | de connectielaag bestaat (`/api/member/connect*`) |
| Vacatures: zoeken op vak/plaats/niveau, bewaren, "open voor werk" | nu alleen een platte lijst |
| Werkgeverspagina per partner, met vacatures en team | partnerprofielen bestaan al in de Salon |
| Sollicitatie-doorloop met status en afwijsredenen | status bestaat in RTF, niet in RTG |
| Vakinhoud: artikelen, vragen, een besloten beroepsgroep | `kern/beroepenbieb` bestaat als kennisbank |
| Rahul als loopbaancoach: CV nakijken, brief schrijven, gesprek oefenen | de AI-laag en de doe-laag (`kern/stuur.js`) staan er al |
| Opdrachten voor ZZP'ers (het Business Pass-publiek) | `kern/vakwerk` en de ZZP-laag bestaan |

**Bewust NIET overnemen:** de bezig-doen-lus van LinkedIn (wie bekeek je profiel
als lokkertje, feed met motivatiepraat, "je bent 1 van de 30 sollicitanten"-druk).

## 3. De Facebook-variant → Cercle, Entourage en Pulse zijn nu schillen

Drie sociale apps die alle drie 8–12 KB zijn en samen op één endpoint-familie
draaien (`/api/member/rechterhand/...`):

- **Cercle** (8 KB, 3 knoppen): je besloten kring
- **Entourage** (8 KB, 3 knoppen): je vaste mensen en hun rol
- **Pulse** (12 KB, 13 knoppen): de hoogtepunten van vandaag
- **Rendez-vous** (12 KB, 6 knoppen): afspraken met je kring
- **Attenties** (10 KB, 6 knoppen): cadeaus regelen

Dat is samen ongeveer één Facebook-tab. Wat er voor een volwaardige variant bij
moet, en waar het hoort:

| Functie | Naar welke app |
|---|---|
| Groepen: openbaar/besloten/geheim, beheerders, regels, gedeelde bestanden | Cercle wordt de groepen-app |
| Evenementen: uitnodigen, ja/nee/misschien, herinnering, plek op de kaart | Rendez-vous |
| Prikbord per groep met posts, foto's, reacties, polls | Cercle |
| Verjaardagen, mijlpalen, "vandaag een jaar geleden" | Pulse + Attenties |
| Marktplaats (kopen/verkopen tussen leden) | bestaat als RTF `markt.html` (32 KB); een RTG-variant ontbreekt |
| Familie- en relatiebanden, wie is wie | Entourage |
| Fotoalbums met meerdere mensen erop, delen met precies wie je kiest | Cercle |
| Terugblik/archief van je eigen jaren | Pulse |
| Precieze zichtbaarheid per bericht (wie wel, wie niet) | de hele groep apps |

**Bewust NIET overnemen:** de nieuwsfeed als tijdvreter, meldingen om je terug te
lokken, en "vrienden die je misschien kent" als groeitruc. Pulse is nu al
uitdrukkelijk *"rustig gebundeld, geen eindeloze feed"* — dat blijft het model.

## 4. Snapchat en TikTok → half af, en het beste stuk staat in de verkeerde wereld

- **RTF Vrienden** (`foundation/vrienden.html`, 43 KB, 25 knoppen) is de rijkste
  sociale app die er is: snaps, 24-uursverhalen, de snap-studio met tekenen,
  stickers en dagkleur-filters, vuurtjes en een dagopdracht. Server:
  `kern/sociaal/snaps.js` + `routes/social/leden.js` (snap/story/view/opdracht).
- **Clips** (21 KB) is de TikTok-variant: video's blijven lokaal bij de maker
  (OPFS), P2P kijken, een eindige dagselectie.

Wat ontbreekt:

| Functie | Waar |
|---|---|
| Snaps en verhalen ook in de RTG-wereld (nu alleen RTF) | leden-OS / De Salon |
| Groeps-snaps, antwoorden op een verhaal, kaart met wie waar is (met toestemming) | `kern/sociaal` |
| Clips: geluid/muziek eronder, knippen, ondertitels, duetten, opslaan | Clips + RTG Sound |
| Clips: reacties en delen naar DM | Clips |
| Verdwijnende berichten met een instelbare termijn | Berichten (7 KB, 0 knoppen — de UI is nu heel dun) |

**Bewust NIET overnemen:** streaks als druk (de vuurtjes bestaan al — die zou ik
juist heroverwegen, want dat is precies het patroon dat de huisregels verbieden),
"wie heeft gescreenshot", en een oneindige Voor-jou-feed.

---

# Deel 2 — De 35 schillen, met wat elk nodig heeft

Per app één regel: dit heeft hij nu, dit moet erbij. Ze zijn allemaal
"echt-maar-dun": ze halen data op en tonen een lijst.

## Sociaal
| App | Nu | Erbij |
|---|---|---|
| Cercle, Entourage, Rendez-vous, Attenties | zie deel 1.3 | groepen, evenementen, prikbord, albums |
| Vonk (11 KB) | wensen-matching, wederzijdse like, auto-reservering | gesprek vóór de match, meer wensvelden, veiligheidscheck vóór de eerste ontmoeting, dubbeldates |

## Reizen
| App | Nu | Erbij |
|---|---|---|
| Het Huis (12 KB, 0 endpoints) | een landingsscherm | dit is de hoofdingang van het reisbureau: verdient de rijkste app van allemaal |
| Vluchten (11 KB) | zoeken en tonen | prijsalarm, stoelkeuze, check-in, vertragingen, reisdocumenten |
| Hangar (11 KB) | jets tonen | aanvraag met route en passagiers, leeg-been-aanbod, catering, crew |
| RTG OV (11 KB) | live GPS, check-in | reisplanner deur-tot-deur, abonnementen, verstoringen, terugbetaling |
| Mijn Stad (8 KB) | kaart met omgeving | buurtagenda, openingstijden, wat is er nu open, lopende route |
| Maison (9 KB) | verblijven op een rij | onderhoud, schoonmaakrooster, sleutelbeheer, kosten per huis |
| Reisboek (12 KB) | dagboek | automatisch verslag uit boekingen + Salon-momenten, exporteren als boek |
| Flits (12 KB) | rijscherm met meldingen | routekeuze, snelheidslimiet per land, onderweg-pauzeadvies |

## Eten & uitgaan
| App | Nu | Erbij |
|---|---|---|
| Table (10 KB) | eigen reserveringen | gastenlijst, voorkeuren per gast, tafelverzoek, wachtlijst |
| Cellier (9 KB) | wijnkelder | voorraad per fles, drinkvenster, proefnotities met foto, aanvullen via de Mall |

## Media
| App | Nu | Erbij |
|---|---|---|
| Nieuws (7 KB) / RTG Krant (13 KB) | rubrieken, bewaren | twee apps met één taak — samenvoegen of scherp scheiden (Krant = redactie, Nieuws = stroom) |
| Garde-robe (9 KB) | kledingkast | looks samenstellen, wat past bij welk weer/gelegenheid, koppelen aan de Mall |
| RTG Browser (14 KB) | ledensites bladeren | zoeken, favorieten, geschiedenis, tabbladen |

## Geld
| App | Nu | Erbij |
|---|---|---|
| Balans (9 KB) | saldo + tikken | maandoverzicht, categorieën, budget, exporteren |
| Logboek (10 KB) | acties | filteren, zoeken, bewijs downloaden per actie |
| Mecenaat (10 KB) | doelen steunen | terugkerende steun, voortgang per project, jaaroverzicht voor de belasting |
| Nalatenschap (10 KB) | regelen | wie krijgt inzage wanneer, verzegelde brief, controle-op-leven |
| RTG-code (6 KB, 0 endpoints) | **uitlegpagina, geen app** | dit is nu een tekst over hoe de code werkt; de echte code zit in de OS-balk. Of app maken, of uit de bibliotheek halen |
| Lab-fonds (13 KB) | bijdragen | bestemming per onderzoek, mijlpalen, verslag terug naar de gever |

## Veiligheid
De vier op de gedeelde kern (Thuiswacht, Codewoord, Vitaal, Thuisrust) zijn met
5–6 endpoints per app inhoudelijk de best afgemaakte kleine apps die er zijn: dun
in KB, maar functioneel compleet. Die hoeven niet voller.
| App | Nu | Erbij |
|---|---|---|
| Passkeys (10 KB) | registreren en inloggen | meerdere sleutels beheren, herstelcode, apparaatoverzicht |
| Juridisch (4 KB, 0 endpoints, 0 knoppen) | **de dunste van allemaal** | je eigen akkoorden, contracten en ondertekeningen tonen (de contractlaag bestaat al) |
| Wie ben ik (13 KB) | wat Rahul mag weten | per app instelbaar, geschiedenis van wat je gaf, alles wissen |

## RTFoundation
| App | Nu | Erbij |
|---|---|---|
| Leren (6 KB), Toetsen (7 KB), Schrijven (7 KB), Projecten (13 KB) | oefenen en plannen | de leerlaag op de server (`kern/leren`) is rijker dan wat de pagina's laten zien — dit is vooral UI-werk |
| Kompas (6 KB), Pesten (6 KB), Rust (7 KB) | **0 endpoints: tekst en knoppen zonder server** | echte gesprekken met Rahul, een dagboek dat blijft, hulp doorzetten naar een mens |
| Gezondheid (11 KB) | gezinsboekje | vaccinaties, medicijnen met herinnering, huisartsbezoek, groeicurve |
| Zakgeld (9 KB) | potje | klusjes met beloning, sparen voor een doel, uitleg over geld per leeftijd |
| RTF-Bibliotheek (9 KB), Geloof & Wijsheid (11 KB) | catalogus + teksten | zoeken in de tekst zelf, bladwijzers, naast elkaar lezen, uitleg op niveau |

---

# Deel 3 — De halfvolle die het snelst volwaardig zijn

Deze hebben al een echte motor; er mist vooral oppervlak.

1. **Berichten** (7 KB, 3 endpoints, **0 knoppen**) — de server kan chatten,
   bellen, videobellen en automatisch vertalen; de pagina is bijna leeg. Grootste
   verschil tussen wat het systeem kan en wat de gebruiker ziet.
2. **Camera** (33 KB, 1 endpoint) — veel UI, één server-aanroep. RTG Eye zit
   erin; wat mist is opslaan, terugkijken, en doorzetten naar Salon/Clips.
3. **RTG Office** (21 KB, 0 endpoints in de pagina) — tekst en rekenblad met
   autosave; delen op codenaam en export bestaan op de server. Presentaties en
   samen tegelijk werken ontbreken.
4. **Markt** (RTF, 32 KB, 0 endpoints) — 28 knoppen zonder server eronder.
   Ruilen en delen in de buurt heeft geen enkel endpoint; dit is nu een prototype.
5. **Theater** (25 KB, 4 endpoints) en **Podium** (27 KB, 3) — dichtst bij vol.
   Missen: kijklijsten, verder-kijken, ondertitels; en voor Podium: opnames
   terugkijken, uitzending plannen, meerdere camera's.
6. **Verblijven** (16 KB, 5) en **Reisbureau** (15 KB, 6) — commercieel het
   belangrijkst en al bijna vol. Missen: kaartweergave, filters, vergelijken,
   annuleringsvoorwaarden in gewone woorden.

---

# Voorgestelde volgorde

Niet alles tegelijk; per ronde één app echt afmaken en dan pas door — zoals we de
opslagronde ook deden.

| Ronde | Wat | Waarom eerst |
|---|---|---|
| 1 | ~~**Berichten** volwaardig~~ **GEDAAN** | zie hieronder |
| 2 | **De Salon**: ledenprofiel, karrousel, paginering voorbij de 60 | de 60-grens is een echte muur, en de Salon levert het beeld voor de hele site |
| 3 | **Métier** (de professionele app) van nul, met het pseudonieme profiel | ontbreekt volledig, en het pseudonieme ontwerp is een echt merkvoordeel |
| 4 | **Cercle + Rendez-vous**: groepen en evenementen | maakt de Facebook-kant in één keer echt |
| 5 | **Snaps en verhalen naar de RTG-wereld** | bestaat al in RTF; overzetten in plaats van bouwen |
| 6 | **Het Huis** | de hoofdingang van het reisbureau mag geen landingsscherm zijn |
| 7 | De schillen per categorie afwerken | in de volgorde hierboven |

## Ronde 1 is af: Berichten

Wat de app nu kan, en waar het zit:

| Functie | Waar |
|---|---|
| Alle kanalen op een plek (Rahul, prive, werk, Berichtenbox, Pulse, RTMAIL) | `routes/member/berichten.js` |
| **Zoeken over ALLE kanalen tegelijk**, met het stukje tekst dat laat zien waarom iets een treffer is | `kern/berichten.js` -> `/api/member/berichten/zoek` |
| Vastzetten (bovenaan), stilzetten (niet in de teller), archiveren (uit de lijst, niets weg) | `/api/member/berichten/vlag` |
| Een prive-gesprek **lezen en beantwoorden IN de app**, live bijgewerkt | `berichten.html` + de bestaande DM-laag |
| Rahul **vat een lang gesprek samen** | `/api/member/berichten/samenvatting` |
| Rahul **stelt een antwoord op** en zet het in je invoerveld | `/api/member/berichten/concept` |
| Rahul **haalt de afspraken eruit**, met een knop om ze in je agenda te zetten | `/api/member/berichten/afspraken` |
| De AI-balk onderaan: typ wat er moet gebeuren | `/api/chat/send` |

Drie ontwerpregels die hier zijn vastgelegd en die voor elke volgende app gelden:

1. **De AI stelt op, de mens verstuurt.** Een concept komt terug als tekst in je
   invoerveld. `test/berichten.test.js` bewijst dat er na een concept geen enkel
   bericht extra in het gesprek staat.
2. **Geen AI? Dan een eerlijke melding, geen verzonnen antwoord.** Zonder sleutel
   geeft elke AI-taak 503 met een leesbare reden.
3. **Een goede route IS de AI-koppeling.** Het stuur (`kern/stuur.js`) roept elk
   toegestaan API-pad aan met de inlog van de gebruiker zelf. Elke handeling die
   ik als route bouw, kan Rahul daarmee meteen zelf doen -- er is geen aparte
   AI-laag per app nodig, en de AI kan nooit meer dan de persoon die het vraagt.

Bewezen in een echte browser: `test/berichten.e2e.js`.

Twee dingen die ik niet zelf besluit en waar ik je woord voor nodig heb:

1. **De vuurtjes (streaks) in RTF Vrienden.** Dat is precies het patroon dat de
   huisregels verbieden. Laten staan, of eruit?
2. **Nieuws en Krant** doen nu hetzelfde. Samenvoegen, of scherp scheiden?

## Ronde 2 is af: De Salon

De Salon was een etalage: alleen partners konden er iets in zetten, en elke
publicatie deed `posts.slice(0, 60)` -- post 61 duwde post 1 er stilletjes uit,
voorgoed. Nu is het een sociaal netwerk waar de leden zelf wonen.

| Functie | Waar |
|---|---|
| **Een lid plaatst zelf**, met tot zes foto's in een karrousel, elk met een eigen alt-tekst | `kern/salon/index.js` -> `/api/salon/plaats` |
| Onderwerpen (`#hashtags`) uit je eigen tekst; wat je typt is wat je krijgt | `kern/salon/index.js` -> `onderwerpenUit` |
| **De muur van 60 is weg**: een ruim venster (`SALON_MAX`, standaard 2000) met echte paginering op `na` | `/api/salon/feed` |
| Ledenprofiel op codenaam: bio, plaats, raster, volgers, volgend | `kern/salon/profiel.js` -> `/api/salon/lid` |
| Leden volgen elkaar (de poort kende alleen partners) | `/api/salon/volg-lid` |
| Bewaren op je eigen, **prive** plank; de maker merkt er niets van | `/api/salon/bewaar` |
| Reacties met antwoorden en `@codenaam`-vermeldingen | `kern/salon/reacties.js` -> `/api/salon/reageer` |
| **De maker bepaalt wie mag reageren**: iedereen, vrienden of niemand | `/api/salon/reacties-van` |
| Verbergen (prive, alleen voor jou) naast melden (drie melders -> uit de feed) | `/api/salon/verberg`, `/api/salon/meld` |
| Rahul **schrijft een bijschrift** bij je steekwoorden; jij drukt op plaatsen | `/api/salon/ai/bijschrift` |
| Rahul **vat de reacties onder je eigen post samen** | `/api/salon/ai/reacties` |
| Waar het vandaag over gaat: de telling is echt, de AI zet er een zin omheen | `/api/salon/ai/waarover` |
| De AI-balk onderaan: typ wat er moet gebeuren | `/api/chat/send` |

De drie ontwerpregels van ronde 1 gelden onverkort. Wat deze ronde eraan toevoegt:

4. **Geen motor die rangschikt op wat jou vasthoudt.** De ontdek-kant kijkt naar
   wat er gedeeld wordt, niet naar wat jou het langst bezighoudt, en onderaan de
   feed staat een knop met "Je bent bij." in plaats van een scroll die zichzelf
   aanvult.
5. **Een grens hoort op EEN plek.** De kap van 60 stond op vijf plaatsen los in
   de partner-routes; er is nu een `salon.kap()`, dus er is nog maar een getal om
   te verzetten.

Bewezen: `test/salon-app.test.js` (12 toetsen) en in een echte browser
`test/salon-app.e2e.js`.

Drie dingen die onderweg stuk bleken en gerepareerd zijn:

- `keyVanCodenaam` is **async** en geeft een object terug, geen sleutel. Volgen
  en vermelden gebruikten hem synchroon: de knop zei "je volgt hem nu", maar er
  werd niets opgeslagen dat de poort herkende.
- In de bureaubladweergave stond de kopbalk (`z-index: 5`) ONDER de vensterlaag
  (`z-index: 6`): zodra je scrolde schoof het venster eroverheen en waren de tabs
  niet meer aan te klikken. Opgelost in `shared/desktopframe.css`.
- De knop "markeer als gelezen" in de PDA-trainingskaart was sinds de
  emoji-ronde helemaal leeg (`g ? '' : ''`): een knop zonder inhoud, dus niets om
  aan te tikken. Nu een vinkje en een open rondje.

## Ronde 3 is af: Métier

De grootste bevinding van de inventarisatie was dat er GEEN werk- of
carriere-app bestond: alleen een vacaturebank met chat, weggestopt als tab. Nu
staat er een eigen app, en het ontwerp ervan is het merkvoordeel zelf.

**Het idee in een zin:** je profiel draait op je codenaam, RTG bevestigt wat het
echt kan bevestigen, en je naam geef je per werkgever vrij uit de kluis.

| Functie | Waar |
|---|---|
| Beroepsprofiel op codenaam: kop, over, plaats, open voor werk | `kern/metier/index.js` -> `/api/metier/kaart` |
| **Bewezen rollen** uit de sleutelbos: wie een personeelsrol koppelde, gaf daarvoor de zaak-code en zijn eigen PIN | `kern/metier/index.js` -> `bewezenRollen` |
| Zelf opgegeven werk mag erbij, en staat er zichtbaar bij als onbevestigd | `/api/metier/rol` |
| Vaardigheden en talen zonder niveaus van 1 tot 5 | `/api/metier/lijst` |
| **De naam vrijgeven aan een zaak**, met een reden voor jezelf | `kern/metier/bewijs.js` -> `/api/metier/naam-vrij` |
| **Intrekken, en dan is er niets meer te lezen** -- er lag nergens een kopie | `/api/metier/naam-intrekken` |
| **Je eigen inzagelog**: wie keek, wanneer, en of hij toen mocht | `/api/metier/naam-log` |
| De werkgeverskant: naam achter een codenaam, alleen met toestemming | `/api/supplier/metier/naam` |
| Aanbevelingen die je zelf schrijft (geen duimpje, geen ruilknop) | `kern/metier/netwerk.js` -> `/api/metier/beveel-aan` |
| Onderschrijven, alleen op een vaardigheid die er al staat en alleen door een connectie | `/api/metier/onderschrijf` |
| Beroepsregister: zoeken op vak, plaats, vaardigheid, "open voor werk" | `kern/metier/zoek.js` -> `/api/metier/zoek` |
| Rahul kijkt naar je profiel als een werkgever, schrijft een brief, oefent het gesprek | `kern/metier/ai.js` -> `/api/metier/ai/{profiel,brief,oefen}` |

De vier regels van ronde 1 en 2 gelden, en hier komt de vijfde bij:

6. **Een bevestiging mag niet uit het verzoek komen.** `bevestigd: true`
   meesturen doet niets: die vlag komt uit `db.data.accountRollen`, waar alleen
   in staat wat iemand met een PIN of bedrijfsinlog heeft aangetoond. Métier
   leest daar mee en schrijft er nooit. Een profiel kan dus niet mooier zijn dan
   de werkelijkheid, en `test/metier.test.js` bewijst dat.

Bewust NIET overgenomen van LinkedIn: "wie bekeek je profiel" als lokkertje, een
feed met motivatiepraat, en "je bent 1 van de 30 sollicitanten". Wie je NAAM
bekeek is een ander verhaal -- dat is een echte gebeurtenis met gevolgen, en die
staat wel in je eigen log.

Bewezen: `test/metier.test.js` (10 toetsen) en in een echte browser
`test/metier.e2e.js`.

Twee dingen die onderweg misgingen en waar ik van geleerd heb:

- Ik gaf de app een sla-over-link met een klasse (`rtg-skip`) die in dit project
  niet bestaat. Gevolg: een losse blauwe browserlink bovenaan de app, en precies
  het contrast-advies dat de a11y-keuring gaf. Het huispatroon is `class="skip"`,
  uit beeld tot hij focus krijgt, en check-regel 5 bewaakt dat ook.
- Mijn eigen e2e wachtte op een waarde die ik zelf net had getypt, dus die
  voorwaarde was meteen waar en het herladen wiste daarna de velden. Wachten op
  de MELDING in plaats van op de invoer.

## Ronde 4: Genootschap -- en waarom het plan hierboven niet klopte

Het plan voor deze ronde stond hierboven als "Cercle wordt de groepen-app" en
"evenementen naar Rendez-vous". Dat plan was op de NAMEN geschreven, niet op de
code. Wat er in werkelijkheid staat:

- **Cercle** is het register van je besloten societeiten: per club je lidnummer,
  sinds wanneer je lid bent, de dresscode, met welke clubs er reciprociteit is en
  hoeveel gastpassen je nog hebt. Een eigen, doordacht jetset-idee.
- **Rendez-vous** is de besloten datingdienst van de Lifestyle Pass: wensen,
  locaties, wederzijdse likes en een date-voorstel van Rahul.

Beide verbouwen zou twee werkende concepten slopen om een derde te maken. De
groepen-laag ontbrak echt (er was geen `db.data.groepen`; het bestaande
`/api/event/rsvp` is de gastenlijst van een PARTNER, niet van een lid), dus die
staat nu in een eigen huis: **Genootschap**.

| Functie | Waar |
|---|---|
| Groepen met drie soorten zichtbaarheid: openbaar, besloten, **geheim** | `kern/genootschap/index.js` |
| Geheim betekent echt geheim: staat in geen enkele lijst, alleen op uitnodiging | `/api/genootschap/zoek` |
| Een uitnodiging is geen lidmaatschap: de ander zegt zelf ja | `/api/genootschap/binnen` |
| Beheerders, en de laatste beheerder kan niet weglopen | `kern/genootschap/beheer.js` |
| Prikbord met berichten, reacties en **peilingen** (een stem per lid, verzetbaar) | `kern/genootschap/prikbord.js` |
| Bijeenkomsten met ja/misschien/nee, plaatsen, en afgelasten | `kern/genootschap/bijeenkomst.js` |
| Mijn agenda: alles wat eraan komt, over al je genootschappen heen | `/api/genootschap/mijn-agenda` |
| Rahul schrijft de aankondiging, vat het prikbord samen, en **telt zelf** welke dag de meesten past | `kern/genootschap/ai.js` |

Bewust niet: herinneringen die blijven trekken, "X en 12 anderen komen" als
sociale druk, een wachtlijst die iedereen hoop geeft, en elke vorm van
"leden die je misschien kent". De AI rekent hier zelf (een model dat moet tellen
maakt fouten) en zet er alleen een zin omheen; zonder AI blijft het cijfer staan.

Bewezen: `test/genootschap.test.js` (11 toetsen) en `test/genootschap.e2e.js`.

De les van deze ronde staat in de kop van `kern/genootschap/index.js`: een plan
dat op namen is geschreven, moet je tegen de code houden voordat je het uitvoert.
