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

## Ronde 5: wat elders geld kost, zit hier in de pas

De opdracht voor deze ronde was: *in elke app alle pro-functies van het
origineel, bij ons gratis*. Dat is geen prijslijst maar een ontwerpregel, en hij
snijdt twee kanten op. Wat er achter een betaalmuur zit is namelijk niet altijd
de moeite waard; soms is de betaalmuur juist het product ("betaal om te zien wie
naar je keek"). Dus de regel zoals wij hem toepassen:

> Wat elders betaald is en de gebruiker echt iets geeft, geven wij weg. Wat
> elders betaald is omdat het aan je trekt, bouwen we niet -- ook niet gratis.

### De Salon: inzicht en archief (Instagram/LinkedIn creator-functies)

| Functie | Waar |
|---|---|
| Je eigen cijfers per post: mooi, reacties, hoe vaak bewaard | `kern/salon/inzicht.js` |
| Welk **onderwerp** aansloeg, over je eigen posts geteld | `/api/salon/inzicht` |
| Archiveren: uit de etalage, niet uit je leven -- en terugzetten kan | `/api/salon/archiveer` |
| Het archief als eigen weergave van de feed | `/api/salon/feed` met `{archief:true}` |

Drie regels staan in de kop van de module en worden door de toetsen bewaakt:
het is **jouw spiegel, geen scorebord** (geen ranglijst, geen vergelijking met
andere leden), er staan **geen namen bij de cijfers** (je ziet DAT tien mensen
iets bewaarden, nooit wie), en er is **geen aansporing om vaker te plaatsen**.

Onderweg gerepareerd: `plaats()` deelde nog altijd id's uit met
`Date.now() + random(1000)` terwijl de oplopende `nieuwId()` er al stond maar
nergens werd aangeroepen -- precies de dubbele-id-bug die commit `d065665`
had moeten verhelpen.

### Métier: de loonspiegel (LinkedIn Salary)

| Functie | Waar |
|---|---|
| Wat een vak echt betaalt: mediaan en middenband per vak en per land | `kern/metier/loon.js` |
| Het **wettelijk minimumuurloon** ernaast, uit `kern/fiscaal/landen.js` | `/api/metier/loon` |
| Een concreet bod tegen de wet en tegen de markt houden | `/api/metier/loon-toets` |

De cijfers komen uit de loonrun van de zaken zelf (`settings.uurloon`, zie
`kern/bank/zakelijk.js`), niet uit een enquête. Drie harde regels:

1. **Onder de vijf zaken tonen we niets.** Een gemiddelde over drie werkgevers
   is een omweg naar het loon van een herkenbare zaak.
2. **Mediaan en p25-p75, nooit de uiteinden.** De hoogste en de laagste wijzen
   altijd naar één aanwijsbare werkgever.
3. **De wet staat er altijd naast**, ook als er nog geen markt te tonen is --
   het wettelijk minimum hangt van geen enkele zaak af. Daarom werkt de toets
   ("mag dit bod eigenlijk wel?") ook in een lege regio.

Bewust niet: "wie bekeek je profiel" (dat weigert Métier al sinds ronde 3, zie
de kop van `kern/metier/index.js`) en "jij verdient minder dan 68% van je
vakgenoten". Een spiegel mag informeren, niet porren.

Bewezen: `test/salon-app.test.js` (14 toetsen) en `test/metier.test.js` (13),
plus beide schermtoetsen.

### Genootschap: de Facebook-kant

Facebook is zelf gratis, dus "pro-functies" zijn hier iets anders: het gaat om
wat er achter een abonnement zit (Meta Verified), wat je kunt kópen (bereik),
wat alleen beheerders krijgen (Group Insights) en wat formeel gratis is maar met
opzet moeilijk gemaakt (je gegevens downloaden). Wij geven de bruikbare helft weg
en laten de trekkerige helft staan.

| Functie | Waar |
|---|---|
| Groepsinzicht voor de beheerder: actieve leden, prikbord-ritme, bijeenkomsten | `kern/genootschap/inzicht.js` |
| Hoeveel berichten **zonder reactie** bleven -- de enige score die over de groep gaat | `/api/genootschap/gezondheid` |
| Bijgepraat: wat je miste, met een bodem ("Je bent bij") | `/api/genootschap/bijgepraat` |
| Neem je genootschap mee: de hele groep, voor de beheerder | `kern/genootschap/uitvoer.js` |
| Neem je eigen inbreng mee: voor elk lid, ook zonder beheerder te zijn | `/api/genootschap/mijn-uitvoer` |

**Wat we bewust NIET overnemen, ook niet gratis:**

- **De top-bijdragerslijst** die elders in datzelfde inzicht-scherm staat. Een
  ranglijst maakt van meedoen een wedstrijd en van stilvallen een zichtbare
  afgang. Je ziet dus HOEVEEL leden actief waren, nooit WIE het meest deed --
  en de toets bewijst dat: het inzicht bevat geen enkele lijst.
- **Bereik dat je kunt kopen.** Wie iets plaatst wordt door de leden gezien
  omdat ze in het genootschap zitten, niet omdat er is bijbetaald.
- **Een vinkje dat je kunt kopen.** Bevestiging komt bij ons uit een
  gebeurtenis (`kern/eenaccount.js`: een personeels-PIN of een bedrijfsinlog),
  niet uit een abonnement.
- **Een feed die nooit ophoudt.** "Wat heb je gemist" is hier een korte lijst
  met een einde. Een tijdlijn die zegt dat je bij bent, is een tijdlijn die je
  laat gaan -- en dat is precies de bedoeling.

Over de uitvoer: er gaan nooit echte namen en nooit sleutels in mee, ook niet in
de beheerdersversie. Alles loopt op codenaam, en wat erin staat zag elk lid al.
Zo is vertrekken goedkoop; een groep die alleen blijft omdat weggaan te duur is,
is geen groep maar een slot.

Bewezen: `test/genootschap.test.js` (14 toetsen) en `test/genootschap.e2e.js`.

### Cercle, Entourage en Pulse

De drie kleinere sociale apps uit deel 2. Elk heeft een duidelijk origineel met
een duidelijke betaalmuur, en in alle drie de gevallen ging het niet om iets
groots erbij bouwen maar om een veld dat geen gegeven was.

**Cercle** (`kern/rechterhand/cercle.js`) -- waar u elders een conciergedienst
voor belt:

| Functie | Waar |
|---|---|
| Reciprociteit als **lijst** in plaats van een regel vrije tekst | `cercle/club` |
| "Waar kan ik in deze stad terecht, en op welk lidmaatschap?" | `cercle/waarheen` |
| Gastpassen met een boekhouding: wie, waar, wanneer -- en het saldo loopt terug | `cercle/gast` |
| Een vergissing terugdraaien | `cercle/gast/terug` |

Oude records blijven werken: een tekstregel als "Soho House, Annabel's" wordt bij
het lezen op komma's gesplitst. Een veld, een betekenis. Wat er NIET komt: een
clubgids die wij zouden "kennen" -- het antwoord komt uit uw eigen gegevens, en
dat zegt het scherm er ook bij.

**Entourage** (`kern/rechterhand/entourage.js`) -- bij de bekende reisapps is de
documentwaarschuwing precies waarvoor het jaarabonnement bestaat:

| Functie | Waar |
|---|---|
| Elk document een eigen vervaldatum: paspoort, visum, rijbewijs, verzekering, vaccinatie | `entourage/doc` |
| Eén waarschuwlijst over alles heen, verlopen bovenaan | `entourage` |
| Het gezelschap samenstellen met een gereedheidscheck + de dieetlijst voor de tafel | `entourage/gezelschap` |

Het oude losse veld `paspoortTot` wordt gelezen als een document van de soort
paspoort -- een gegeven, een plek. Wat er NIET komt: inreisvereisten per land.
Die wisselen per week en per nationaliteit; iets beweren wat wij niet kunnen
naslaan is erger dan niets zeggen, en dat staat ook op het scherm.

**Pulse** (`kern/pulse/vrij.js`) -- de twee functies achter het abonnement van
een microblog:

| Functie | Waar |
|---|---|
| Je bericht **bewerken**, met elke vorige versie bewaard | `pulse/bewerk` |
| De geschiedenis staat open voor **iedereen** die het bericht mag zien | `pulse/versies` |
| Bewaren **met mappen** (elders zijn losse bladwijzers gratis en is ordenen betaald) | `pulse/bewaar` |

Waarom die open geschiedenis geen bijzaak is: onder een bericht staan reacties en
likes van anderen. Wie de tekst ongemerkt kan vervangen, kan mensen achteraf iets
laten onderschrijven wat ze nooit gelezen hebben. Een correctie mag; stiekem
herschrijven niet. En wat je bewaart blijft prive -- de schrijver merkt er niets
van, want "X bewaarde jouw bericht" is een seintje dat niets toevoegt.

`kern/pulse.js` ging door deze uitbreiding over de tien kilobyte (check-regel 13)
en is daarom een map geworden, net als salon, metier en genootschap:
`kern/pulse/index.js` + `kern/pulse/vrij.js`. De bedrading veranderde niet mee --
`require('./kern/pulse')` vindt vanzelf de index.

Bewezen: `test/pulse.test.js` (7 toetsen) en `test/rechterhand.test.js` (18).

## RTMAIL: een adres per lidmaatschap

RTMAIL had één vlak domein voor iedereen: `<code>@rtmail`. Dat werkte, maar het
zei niets. Nu draagt het adres zelf welk huis je hoort:

| Domein | Voor wie |
|---|---|
| `rahultravelgroup.rtg` | RTG-personeel en het kantoor |
| `rahultravelfoundation.rtg` | RTFoundation, leden en personeel |
| `rtgpass.rtg` | leden met de RTG Pass |
| `business.rtg` | leden met de Business Pass |
| `lifestyle.rtg` | leden met de Lifestyle Pass |
| `partner.rtg` | partners en leveranciers |
| `gouvernement.rtg` | overheid |

De laag staat in `kern/rtmail-adres.js` -- één lijst, en wie er een domein bij
wil doet het daar en nergens anders.

**Drie regels die hier niet onderhandelbaar zijn.**

1. **Het linkerdeel van een ledenadres is de codenaam, nooit de echte naam.**
   Een adres reist: het belandt in andermans postvak en blijft daar staan. Stond
   er een echte naam in, dan was het codenaam-ontwerp (de gescheiden kluis in
   `server/accounts.js`) omzeild voor iedereen die ooit post kreeg. Voor
   PERSONEEL, ZAKEN en OVERHEID ligt dat anders: dat zijn functionele
   identiteiten die naar buiten al openbaar zijn -- een zaak handelt onder haar
   naam, een ambtenaar in een functie. Daar is het linkerdeel de werknaam of de
   zaakcode, precies zoals op een visitekaartje.
2. **Je oude adres blijft werken.** Wie van de RTG Pass naar de Lifestyle Pass
   gaat, krijgt een nieuw adres, maar post aan het oude komt gewoon aan. Dat
   geldt ook voor het `@rtmail` van vóór deze ronde: daar ligt post op.
   Technisch: het postvak hangt aan het linkerdeel, het domein zegt welk huis.
3. **Het domein wordt afgeleid, nooit gekozen.** Je kunt jezelf geen
   `@rahultravelgroup.rtg` geven door het in te typen; het volgt uit je pas en je
   bewezen rollen (`kern/eenaccount.js`). Een bewezen rol weegt daarbij zwaarder
   dan een pas: wie bij RTG werkt én een RTG Pass heeft, krijgt het werkadres --
   dat is het adres waarop hij aanspreekbaar is.

**Wat een toets ving.** De normalisatie van vóór deze ronde WISTE spaties
("Saffieren Ooievaar" werd `saffierenooievaar`), de nieuwe maakt er streepjes van
(`saffieren-ooievaar`) omdat dat leesbaar is. Zonder correctie zou post die onder
het oude schema bezorgd is in een ánder postvak liggen dan het nieuwe adres --
precies belofte 2, gebroken. De vergelijking kijkt nu door streepjes en punten
heen (`sleutel()` in `kern/rtmail-adres.js`).

Verder gereserveerd: `rtg`, `rtmail`, `postmaster`, `systeem`, `admin` en
`noreply` worden nooit aan iemand uitgedeeld -- anders viel zijn postvak samen
met dat van de systeem-afzender.

Bewezen: `test/rtmail.test.js` (11) en `test/rtmail-lid.test.js` (5).

### RTMAIL: teams, een adres dat je samen leest

Een receptie, een keuken, een boekhouding zijn geen personen maar **functies**.
Post daaraan hoort niet in het postvak van wie er toevallig als eerste was. Een
team is dus een eigen adres (`receptie@partner.rtg`) dat meerdere mensen samen
lezen. Elders is dit de betaalde helft: een gedeelde inbox met toewijzing zit
achter een zakelijk abonnement of een licentie per stoel. Hier hoort het erbij.

**De regel die dit huis eraan toevoegt: het adres is gedeeld, de hand niet.**
Wie vanuit het teamadres schrijft, staat er altijd bij -- niet als sierlijkheid,
maar omdat een gedeeld adres anders een masker wordt. "De receptie zegt dat het
geregeld is" is geen antwoord; "Gouden Panter, namens De Receptie" wel. Er is
geen schakelaar om dat uit te zetten, en de toets bewijst dat: ook met
`anoniem: true` in de body komt de codenaam eronder.

Wat een gedeeld postvak pas bruikbaar maakt, en er dus in zit:

- **Toewijzen.** Een bericht is van niemand tot iemand het oppakt. Je ziet wie
  het doet (op codenaam), een ander kan het niet stilletjes overnemen, en
  loslaten kan altijd.
- **Afhandelen.** Het team ziet wat nog open staat, niet een eindeloze lijst.
  Wat af is verdwijnt uit de open lijst, maar niet uit de historie.
- **Zelf weglopen.** De eigenaar zet je erin, maar niemand anders dan jij bepaalt
  of je erin blijft -- een gedeeld postvak lezen is werk, geen cadeau. De
  eigenaar zelf kan niet weglopen: een team zonder eigenaar is een postvak dat
  niemand meer kan opruimen.

Wat er **niet** in komt: een teller wie het meest afhandelt. Dat is dezelfde
ranglijst die Genootschap en De Salon al weigerden; het maakt van samenwerken
een wedstrijd. De toets controleert dat structureel, niet op woorden.

**Een team mag nooit een bestaand postvak kapen.** Omdat het postvak aan het
linkerdeel hangt (belofte 2 hierboven), zou een team dat "gouden-panter" of
"sakura" heet de post van een lid of een zaak meelezen. Dat is de enige echt
gevaarlijke fout die een gedeeld adres kan maken, dus staat de toets apart in
`kern/rtmail-vrij.js`, met drie sloten: de **vorm** van een codenaam (altijd een
woord uit een vaste lijst plus vier hex-tekens, dus exact te toetsen -- een
teamnaam als `kantoor-2026` blijft gewoon toegestaan), de **zaakcodes** uit het
register, en tot slot: waar al post ligt, woont al iemand.

Het domein van een team volgt de oprichter, net als bij een persoon: een zaak
maakt een team op `partner.rtg`, personeel op `rahultravelgroup.rtg`. Een domein
meesturen in de body doet niets.

Bewezen: `test/rtmail-team.test.js` (9) en `test/rtmail-team.e2e.js` (scherm:
oprichten, iemand erbij op codenaam, oppakken, afhandelen).

### Het Huis: het reisdossier achter de hoofdingang

Het Huis was een magazine: elf mooie bladen en nul gegevens. Dat is vreemd voor
de voordeur van een reisbureau, want wat een reisbureau *doet* is precies dit --
alles van je reis bij elkaar houden en eerlijk zeggen wat nog niet rond is.
Blad 02 is nu het **reisdossier**, en het is het enige blad met echte gegevens
erin: de rest van het magazine gaat over het huis, dit gaat over jou.

Elders is dit de betaalde laag: al je boekingen in één tijdlijn, een seintje als
een document verloopt, en een dossier dat je kunt meenemen. Dat is waar het
jaarabonnement van de bekende reisapps voor bestaat. Hier zit het in de pas.

**De regel die dit huis eraan toevoegt: wat niet bevestigd is, staat er ook zo
bij.** Een dossier dat alles even zeker laat lijken is erger dan geen dossier --
dan sta je aan de balie met een papier dat niets waard blijkt. Elk onderdeel
draagt zijn eigen stand (Bevestigd / Wacht op betaling / In aanvraag bij de
partner), en die stand staat als **woord** op het scherm, niet alleen als kleur.

Daaruit volgt de tweede scheiding, en die is streng: **wat aan jou ligt** staat
apart van **wat je alleen kunt afwachten**. Een openstaande betaling is een taak
en wijst naar waar je hem oplost; iets dat bij een partner ligt is dat niet en
krijgt dus ook geen knop. Iets afwachten is geen taak, en een lijst die dat door
elkaar gooit maakt onrust waar niets te doen valt.

Verder:

- **De papieren van het gezelschap** komen uit Entourage, dat die grens al
  berekent. Die rekenen we hier niet nog eens: een limiet hoort op één plek.
- **De datum wordt gelezen, niet verzonnen.** Lukt het niet om uit de reisregel
  een vertrekdatum te halen, dan zegt het scherm dat de datum als tekst bekend
  is. Een verzonnen datum in een reisdossier is gevaarlijker dan een ontbrekende.
- **Het aftellen jaagt niet op.** Het zegt hoeveel dagen er nog zijn, en verder
  niets: geen "nog maar", geen rode cijfers.
- **De reismap** is het dossier als platte tekst, om te bewaren, te printen of
  aan iemand mee te geven -- het mapje dat een reisbureau je meegeeft. Platte
  tekst met opzet: dat opent overal, ook zonder ons.
- **Rahul verwoordt, de module telt.** Zonder AI-sleutel is het antwoord exact de
  telling van de module. De AI mag nooit een onderdeel of een bevestiging
  verzinnen -- juist hier niet.

Wat er bewust **niet** in staat: inreisvereisten per land. Die wisselen per week
en per nationaliteit; iets beweren wat we niet kunnen naslaan is erger dan
zwijgen. Entourage weigert dat al om dezelfde reden.

Bewezen: `test/huis.test.js` (7) en `test/huis.e2e.js` (scherm: de reis, elke
stand als woord, de twee gescheiden lijsten, de map en Rahul).

### Clips: knippen, geluid en ondertitels

Clips had opnemen en delen, maar niets ertussenin -- en dat is nu juist het stuk
waar de bekende knip-apps geld voor vragen: ondertitels bewerken, een clip
inkorten, het geluid regelen. Achter Pro, of met een watermerk.

**Het ontwerp volgt de architectuur, niet andersom.** Het beeld van een clip
staat alleen op het toestel van de maker; RTG heeft het nooit. Daarom kan hier
niets "gerenderd" worden, en dat hoeft ook niet:

- **Knippen is een begin en een eind, geen nieuwe video.** De speler van de
  kijker springt naar `van` en stopt bij `tot`. Het origineel blijft heel, dus je
  kunt een knip altijd terugdraaien -- er is niets weggegooid. Dat is beter dan
  wat een knip-app doet, niet minder.
- **Ondertitels zijn tekst, en tekst is klein.** Die staan dus wél bij RTG, want
  de kijker moet ze kunnen lezen ook al komt het beeld rechtstreeks van het
  toestel van de maker.
- **Geluid is een mededeling van de maker** over wat de kijker gaat horen:
  `eigen`, `stil` (gemaakt om zonder geluid te bekijken) of `stem`.

**De regel die dit huis eraan toevoegt: een clip zonder ondertitel is een clip
die een deel van de mensen niet kan volgen.** Daarom draagt elke clip in de feed
of hij ondertiteld is, en kan een kijker de dagselectie beperken tot wat hij kán
volgen. Dat is geen smaakfilter maar een toegangsfilter -- en de kijker zet hem
zelf aan; hij staat uit tenzij iemand dat doet. Je eigen werk verdwijnt er nooit
door uit je eigen lijst: het filter gaat over wat je kijkt, niet over wat je
maakte.

Wat er **niet** komt: een muziekbibliotheek. We hebben geen rechten op muziek en
doen dus niet alsof; `stil` en `stem` zijn eerlijk, een lijstje nepdeuntjes niet.

Bewezen: `test/clips.test.js` (9, waarvan 4 nieuw) en
`test/clips-studio.e2e.js` (scherm: knippen, geluid, ondertitels, het filter
gezien door een kijker).

### RTG Klankwerk: zelf muziek maken

Vorige ronde weigerde Clips een muziekbibliotheek: we hebben geen rechten op
muziek en gaan niet doen alsof. Dat liet een gat achter, en Klankwerk vult het
van de andere kant: **muziek die een lid zelf maakt, is van dat lid** -- en mag
dus wél onder zijn clip.

**De vertaling van FL Studio.** Wat die programma's groot maakt zijn
samplepakketten en plug-ins, en die kunnen we geen van beide meeleveren: geen
rechten, en de CSP laat niets van een vreemde server binnen. Dus wordt élke
klank door de app zelf opgewekt, uit oscillatoren en ruis, in dezelfde klanktaal
als RTG Sound. Dat is geen uitgeklede versie -- het is precies wat maakt dat er
geen licentie van iemand anders in je werk zit.

| FL Studio | Klankwerk |
|---|---|
| Channel Rack | het raster: kanalen x 16 stappen per maat |
| Piano roll | de notenrol, twee octaven rond het instrument |
| Mixer | volume, links-rechts en stil per kanaal |
| Samplepakketten en plug-ins | tien vaste instrumenten, alle opgewekt |
| Export | eigen WAV-schrijver, offline uitgerekend |
| -- | Rahul, die een voorstel neerzet dat je zelf plaatst |

**Drie regels die hier niet onderhandelbaar zijn.**

1. **Alles wordt opgewekt, niets wordt geleend.** Zie hierboven. Het maakt de
   koppeling met Clips mogelijk: `geluid: 'muziek'` geldt alleen met een stuk dat
   van jou is én dat je zelf klaar noemde. De eigendomstoets staat in de
   muziekmodule, niet in Clips -- wie eigenaar is, weet de eigenaar-module.
2. **De AI zet neer, jij bent de maker.** Rahul levert noten en stappen in
   hetzelfde formaat als je eigen werk: je ziet ze, je haalt de helft weg, je
   schuift de rest op. Nooit een kant-en-klaar bestand. Daarom zit de
   muziekkennis (toonladders, akkoordreeksen, drumfiguren) in de módule en niet
   in de prompt: de studio doet het net zo goed zonder AI-sleutel, en met Claude
   erbij mag hij alleen kiezen en variëren binnen wat er staat. Zijn antwoord
   gaat langs dezelfde keuring als handwerk.
3. **Het stuk is een handvol getallen.** Welke stap, welke toon, hoe lang. Klein,
   leesbaar, mee te nemen. Wat er klinkt rekent je eigen toestel uit.

**Eén planner, twee gebruiken.** Afspelen en exporteren lopen door dezelfde
functie; de context is live of offline. Daardoor *kan* het bestand niet anders
klinken dan wat je hoorde. Twee aparte paden zouden vroeg of laat uit elkaar
lopen, en dan levert "opnemen" iets anders op dan "afspelen".

**Wat er niet in zit.** Geen teller wie de meeste stukken maakt, geen uitgelichte
lijst, geen aanmoediging om vandaag nog iets te maken: een instrument hoort te
wachten tot je het pakt. En een onbekend instrument levert géén kanaal op -- er
stilletjes een kick van maken zou betekenen dat je iets anders hoort dan je
vroeg, en dan is een fout van Rahul onhoorbaar én verkeerd.

Bewezen: `test/muziek.test.js` (9) en `test/klankwerk.e2e.js` (scherm: raster,
notenrol, Rahul, en een offline gerenderde WAV waarin nagemeten wordt dat er
werkelijk signaal zit -- een studio die er goed uitziet maar stil blijft is geen
studio).

---

## Van een lus naar een lied: zang, samen produceren en de zaal

De studio kon een figuur maken. Wat er nu bij komt is alles wat daarna nodig is
om er iets van te maken dat je aan iemand laat horen: een STEM, een VORM, een
tweede MAKER, en een PLEK waar het klinkt.

### De stem

Drie instrumenten met `soort: 'stem'` (zang, koor, fluister). Een noot van zo'n
kanaal draagt naast toonhoogte en lengte ook een **lettergreep**, en die wordt op
het toestel van de luisteraar opgewekt met formantsynthese: een klinker is niets
anders dan een paar resonanties, en die zijn met bandfilters na te bouwen
(`public/apps/klankwerk/zang.js`, tabel van 15 klinkers, vibrato, ademruis, drie
formanten). Het koor is dezelfde stem, drie keer, ±7 cent uit elkaar.

Wat dit **niet** is: een neuraal model dat een zanger nadoet. Dat kan hier niet
draaien, en doen alsof zou oneerlijk zijn. Daarom staat het ook op het scherm,
boven de tekstregel: *"Deze stem wordt opgewekt, het is geen opname van een
zanger."* Liever een eerlijke grens dan een belofte die de eerste luisteraar al
doorprikt.

### De vorm, en waarom Rahul hem meelevert

`MAX_MATEN` ging van 8 naar 32, en een stuk kreeg `secties`: namen op stukken van
het raster. Ze veranderen niets aan de klank -- dat lijkt een reden om ze weg te
laten, maar het is juist het punt. Vorm is wat een lus tot een lied maakt, en wie
een refrein benoemt gaat er anders naar luisteren.

Rahul heeft er een tweede knop bij: *"maak er een heel lied van"*. Wat er dan
uitkomt is een vorm van acht delen, een zanglijn erover, een koor op het refrein,
en een intro waarin het slagwerk stilstaat. De muzikale kennis daarvoor staat in
`kern/muziek-lied.js` als gewone tabellen -- net als de begeleiding in
`kern/muziek-stijlen.js`. Vier regels die een beginner nooit zelf bedenkt:

1. een zin begint op de tel;
2. hij loopt in stapjes door de ladder (een stem die octaven springt is een synth);
3. hij eindigt op de grondtoon, anders blijft hij openstaan;
4. hij ademt: aan het eind van elke twee maten valt er een lettergreep weg.

Plus het enige echte "hit-trucje" hier, en het is eeuwenoud: het refrein ligt een
terts hoger dan het couplet en herhaalt zijn eerste maat.

**Bij een lied doet Claude niet mee.** Vorm, zang en begeleiding moeten over 26
maten bij elkaar horen; een voorstel dat daar de helft van overdoet levert een
slechter lied op dan de tabellen. Bij een figuur ligt dat andersom -- daar is
variatie juist de winst.

**En Rahul schrijft uw woorden niet.** Typt u een zin, dan legt hij die
lettergreep voor lettergreep op de melodie (een vuistregel op klinkergroepen,
geen woordenboek -- daarom staat elke lettergreep in een eigen veldje dat u
overtypt). Typt u niets, dan zingt de stem open klinkers: hoorbaar een lege plek.
Een AI die uw refrein schrijft zou van u een luisteraar maken van uw eigen lied.

### Samen produceren

`kern/muziek-samen.js`. De regel die dit huis eraan toevoegt: **het stuk is
gedeeld, de credits niet.** Een medemaker bewerkt volledig mee (anders is het
geen samenwerking maar een postbus), de eigenaar nodigt uit op **codenaam**, en
wie meewerkte staat bij de uitgave -- ook als hij er daarna uitgezet wordt. Een
medemaker die stil uit de aftiteling valt is precies hoe het in de echte
muziekwereld misgaat.

Wat er bewust **niet** is: gelijktijdig in hetzelfde raster tekenen. Dat vraagt
een conflictmodel dat we nu niet eerlijk kunnen bouwen; wie tegelijk bewaart,
overschrijft. Daarom zegt het scherm wie er als laatste bewaarde en wanneer --
zodat je het ziet in plaats van raadt. Een eerlijke waarschuwing boven een valse
belofte van magie.

### Uitgeven: onder wiens naam

`kern/muziek-uitgave.js`. Twee wegen, en het verschil is wezenlijk:

| | Onder je codenaam | Onder de RTG-naam |
|---|---|---|
| wie beslist | u, meteen | een **mens** bij het kantoor |
| wat het is | een knop | een **aanvraag** |
| bij nee | -- | de uitgave blijft staan onder uw codenaam |

RTG die zijn naam ergens onder zet, staat ergens voor in. Dat kan Rahul niet, de
app niet en de maker niet -- dezelfde regel als bij de Lifestyle- en Business
Pass, waar de AI ook nooit zelf toegang belooft. De enige plek waar het wél kan
is `/apps/klankwerk-kantoor.html`, achter de kantoorinlog.

Een uitgave **bevriest** het stuk (diepe kopie van kanalen en secties). Wie
daarna in de studio verder sleutelt, verandert niet met terugwerkende kracht wat
er is uitgegeven; dat is het hele idee van uitgeven.

### De zaal

`/apps/zaal.html`. Luisteren, "mooi" zeggen, er iets bij schrijven. Wat er niet
komt is de vierde keer dezelfde weigering in dit project: **geen hitlijst, geen
"meest beluisterd van de week", geen aanbevolen volgorde.** De zaal is
chronologisch, eindig, en heeft een bodem -- en zegt er zelf bij: *"wie bovenaan
staat, staat daar omdat hij de laatste was."*

Wat er wél hardop staat: onder wiens naam iets uitkwam, en wie eraan meewerkten
met hun rol. Codenamen, nooit echte namen: een uitgave reist, en wat reist draagt
geen echte naam.

Er komt bij het luisteren geen audiobestand over de lijn. Een stuk is een handvol
getallen; het toestel van de luisteraar rekent het uit met dezelfde motor waarmee
de maker het hoorde.

Bewezen: `test/muziek-lied.test.js` (6), `test/muziek-uitgave.test.js` (9, met
als kop *"de RTG-naam komt er nooit vanzelf onder"*) en `test/zaal.e2e.js`, die
op het scherm de hele keten afloopt: een lied met een eigen zin laten neerzetten,
een tweede maker erbij op codenaam, uitgeven met de RTG-naam als aanvraag,
nagaan dat er in de zaal dan de codenaam staat -- en pas na het besluit van het
kantoor de naam Rahul Travel Group.

---

## RTG Office: het rekenblad krijgt een echte motor

Het rekenblad kende vijf functies (SOM, GEM, MIN, MAX, AANTAL, plus AFRONDEN en
ALS), kolommen A tot en met Z, en bereiken die alleen werkten als je ze
letterlijk als `A1:B9` typte. Dat is een demonstratie van een rekenblad, geen
rekenblad. Deze ronde gaat over het fundament.

### Wat erbij komt

| | Was | Is |
|---|---|---|
| functies | 7 | **129 namen**, Nederlands en Engels naast elkaar |
| kolommen | A tot Z | doorlopend na Z (AA, AB, ...), tot 60 |
| rijen | 200 | 500 |
| bereiken | alleen letterlijk `A1:B9` | overal waar een functie een bereik aankan |
| andere bladen | nee | `Blad2!A1` |
| ontleding | een regexp die "toch alleen cijfers" doorliet | een echte ontleder |

De functies staan er per soort: rekenen en tellen, voorwaarden (`SOM.ALS`,
`AANTAL.ALS`, `SOMPRODUCT`), logica, tekst, zoeken (`VERT.ZOEKEN`, `INDEX`,
`VERGELIJKEN`), datums, en geld (`BET`, `TW`, `HW`, en `BTW` — die laatste is
geen standaardfunctie maar wel wat hier het vaakst met de hand wordt uitgerekend,
en dan met het verkeerde percentage).

### Drie regels die vastliggen

1. **Een formule draait nooit als code.** Geen `eval`, geen `Function`, geen
   omweg. Een document wordt gedeeld, dus een formule van een ander is altijd
   invoer van een vreemde; daarom staat er een echte ontleder en bestaat wat
   niet in de grammatica staat gewoon niet. `=alert(1)` levert `#NAAM?` op:
   een naam die er niet is, en die dus ook niet wordt uitgevoerd.
2. **Een fout blijft zichtbaar.** `#DEEL/0!` wordt geen nul, `#NAAM?` geen lege
   cel, en een kringverwijzing geen stille 0. Ook een fout **midden in een
   bereik** reist omhoog — die vond de test, en het is de gevaarlijkste van de
   twee: `=SOM(A1:A9)` over een kolom met één kapotte cel zou anders een keurig
   getal geven dat niet klopt. Een uitkomst die je gelooft.
3. **ALS raakt alleen de tak aan die hij nodig heeft.** `=ALS(A1=0; 0; 1/A1)` is
   precies de formule die mensen schrijven om delen door nul te voorkómen; die
   moet dus niet alsnog door nul delen. Daarom krijgen functies luie argumenten.
   En een lege cel telt als nul zodra de andere kant een getal is — anders klopt
   diezelfde formule nog steeds niet.

### De vier dingen waarvoor men elders betaalt

- **Functies zoeken.** Ruim honderd functies zijn niets waard als niemand ze kan
  vinden. Een zoekvak zet de naam in uw cel; wie SOM typt vindt ook SUM.
- **Sorteren** op de kolom waar u staat, over de rijen die u opgeeft. De rijen
  verhuizen écht, met alle kolommen mee — dat staat er met zoveel woorden bij,
  want het is ingrijpend.
- **Filteren.** Rijen die niet aan uw eis voldoen (`>100`, `<=0`, een woord)
  verdwijnen uit **beeld**, niet uit het document. Een filter wordt niet bewaard:
  hij zegt hoe u nu kijkt, niet wat er staat.
- **Grafiek**, met SVG uit uw eigen cellen. Staven of een lijn. Geen taartdiagram:
  daar leest niemand een verhouding beter uit af dan uit staven naast elkaar, en
  het staat elders vooral omdat het er altijd al stond.

**Datums zijn hier gewone tekst** (`2026-07-26`). De grote rekenbladen bewaren een
datum als volgnummer sinds 1900, met een schrikkeljaar erin verwerkt dat nooit
bestaan heeft. Die halve eeuw sleepgewicht hoeven wij niet over te nemen: wie
"2026-07-26" in een cel ziet weet wat het is, en `DAGEN()` rekent het verschil net
zo goed uit. De prijs is dat een datum niet zomaar optelbaar is met +1; daarvoor
is er `DATUM.PLUS()`. Een eerlijke ruil, en hij staat opgeschreven.

Opgeknipt op de naad: lezen (`shared/rekenlezer.js`) apart van rekenen
(`shared/rekenmotor.js`), functies per soort, en de bediening apart van het
beeld (`bladpro.js` / `bladgrafiek.js`).

Bewezen: `test/rekenmotor.test.js` (12), `test/office-blad.test.js` (6) en
`test/office-blad.e2e.js`, die in een echte browser een formule intypt, de
functielijst doorzoekt, sorteert, filtert en een grafiek laat tekenen. Die
laatste is geen luxe: de motor draait in de browser, waar de beveiligingsregels
van de app tekst-als-code blokkeren — precies de fout die deze app eerder had,
toen in Node alles groen stond en op het scherm elke formule een melding gaf.

### En de andere twee: de tekstverwerker en de presentatie

**De tekstverwerker.** Naast de bestaande balk (koppen, lijsten, uitlijning,
citaat, verwijzing, tabel) komen doorhalen en een markeerstift (goud uit het
eigen palet, doorzichtig), en twee dingen waarvoor men elders betaalt:

- **Zoeken en vervangen** — loopt uitsluitend door de *tekstknopen* van het
  document. Dat is de veiligheidsregel van de functie: wie door de HTML zelf
  zou zoeken, kan met een vervanging een tag doormidden knippen en daarmee de
  opmaak van een gedeeld document slopen. Na "haven" naar "kade" is de kop nog
  steeds een kop; de e2e-test bewijst het.
- **Inhoudsopgave** uit de koppen, bovenaan het document. Een momentopname:
  opnieuw klikken ververst hem. Een inhoudsopgave die zichzelf live bijhoudt
  klinkt beter, maar betekent dat het document iets doet wat u niet ziet.

**De presentatie.** Dia dupliceren, en **thema's voor het hele deck** — vier,
alle uit het eigen palet: nacht, papier, bordeaux en goud. Meer smaken zou een
kleurenkiezer worden, en dan maakt iedereen paars. Bij het presenteren loopt de
**spreektimer** mee naast de teller: gewoon optellen, geen aftellen en geen
rood knipperen — u bent aan het woord, geen examen aan het doen.

**Afdrukken, voor alle drie.** Geen eigen PDF-schrijver — de browser heeft een
uitstekende (de afdrukdialoog met "opslaan als PDF"). Wat wij toevoegen is dat
er iets fatsoenlijks uitkomt: zwart op wit, serif voor tekst, geen appbalken.
Een tekstdocument drukt af als het stuk dat het is; een rekenblad als de tabel
met de uitkomsten van het scherm; een presentatie als **hand-out** — elke dia
een blok, en de sprekersnotities gaan NIET mee. Een hand-out is voor de zaal,
en een notitie die per ongeluk meeprint is het soort ongeluk dat je maar één
keer overkomt. Ook dat staat in de e2e-test.

De ronde ving onderweg twee echte fouten: de server-schoonmaak gooide het
thema bij het bewaren weg (een bordeaux deck zou morgen weer nacht zijn) en
klemde het blad op 200 rijen en 26 kolommen terwijl het scherm er 500 en 60
aankan — bewaren zou stilletjes rijen afknippen. En een race die er al langer
zat: teruggaan naar de lijst terwijl de autosave onderweg was, liet het late
antwoord op een gesloten document schrijven.

Bewezen: `test/office.test.js` (9, met de thema/grenzen-rondreis) en
`test/office-suite.e2e.js` (zoeken/vervangen met opmaak die blijft staan,
inhoudsopgave die ververst, dupliceren, thema, timer, en de hand-out zonder
notities — via de echte afdrukknop).

## RTG Office: Formulieren en Schetsen (vijf soorten in een pakket)

Een kantoorpakket is meer dan tekst, blad en presentatie. De twee soorten die
er echt nog misten:

**Formulier** (de Forms-kant) -- het ene officedocument dat door ANDEREN
wordt gebruikt. De eigenaar bouwt vragen (open, meerkeuze of schaal 1-5),
kiest de wijze, en deelt op codenaam; wie mag lezen krijgt geen document
maar een invulscherm. Een inzending per persoon; opnieuw insturen vervangt.
De antwoorden staan bewust NIET in het document zelf (`officeAntwoorden`
per formulier, in `server/kern/office/formulier.js`): anders zou elke
autosave van de eigenaar over andermans antwoorden heen schrijven. De
uitslag (telling per optie, gemiddelde per schaal, teksten per open vraag)
is voor wie mag schrijven; export als CSV.

De anoniem-stand is eerlijk, aan beide kanten van het scherm: bij 'anoniem'
ziet de eigenaar nooit wie wat antwoordde, maar RTG weet het wel -- zonder
te weten wie inzond kan "een inzending per persoon" niet bestaan. Die zin
staat bij de bouwer EN bij de invuller in beeld, niet in kleine lettertjes.
En een overgeslagen vraag is geen antwoord: `Number(null)` is 0, en zonder
die ene regel telde "niets gekozen" stilletjes als de eerste optie -- exact
de soort geloofwaardige fout die dit pakket weigert (test 10 legt het vast).

**Schets** (de Visio-kant) -- diagrammen op een wit vel: kader, ovaal, ruit,
pijl en losse tekst. Slepen tekent, klikken kiest, slepen verplaatst,
dubbelklik zet de tekst, Delete haalt weg. Het vel is SVG (1200x800): het
schaalt scherp, drukt strak af en exporteert als echt `.svg`-bestand. Wit
met zwarte lijnen, bewust -- een schema is om te lezen, niet om te stylen.
De server klemt elke vorm op het vel en laat onbekende vormen weggevallen
in plaats van ze als raadsel te bewaren.

Beide soorten draaien op exact dezelfde kern als de andere drie: dezelfde
vijf ingangen (lid, zaak, RTG-kantoor, RTF-gezin, werkplek), hetzelfde
delen, dezelfde versies, hetzelfde afdrukken. In het RTF-gezin mag ook een
oppas of familielid (gast) een formulier invullen -- antwoorden is lezen,
geen bewerken; de uitslag blijft bij wie schrijft. Sjablonen erbij
(rondvraag, stemming, organigram, stroomschema) in `sjablonen2.js`, want
deel 1 zat tegen de 10 KB.

## RTG Office professioneel: het verschil tussen "het kan" en "het werkt als vanzelf"

De ronde waarin de vijf officeproducten zich als volwassen software gaan
gedragen. Rode draad: de handgrepen die mensen uit de grote pakketten
kennen, precies zoals ze die verwachten -- en elk met de eerlijkheid die
dit pakket overal hanteert.

**Rekenblad.** Ctrl+C/X/V op cellen, met verwijzingen die MEESCHUIVEN:
=B2*C2 een rij lager geplakt is =B3*C3, en een dollarteken zet een deel
vast ($B$2 blijft $B$2). Dat schuiven doet `shared/rekenschuif.js`, een
eigen kleine laag naast de lezer: tekst tussen aanhalingstekens en
functienamen als LOG10 blijven met rust, en een verwijzing die van het
blad af zou schuiven maakt de cel zichtbaar kapot (#VERW!) in plaats van
stilletjes op een andere cel te klemmen -- een geloofwaardig fout getal is
erger dan een fout die je ziet. Doorvoeren (bladreeks.js) rolt een cel
over een reeks uit, omlaag of naar rechts. En Ctrl+Z: veertig stappen
ongedaan maken, waarbij een sortering of een doorvoer-reeks als EEN stap
terugkomt. Het verleden hoort bij het document: een ander document openen
begint met een schone lei.

**Schets.** Formaatgrepen op de gekozen vorm (vier hoeken; een pijl heeft
grepen op zijn uiteinden), dupliceren, voorgrond/achtergrond, en alles
ligt op een raster van 10 -- vormen die vanzelf uitlijnen zijn het
verschil tussen een schema en een gekras. Ctrl+Z met snapshots die alleen
bij een ECHTE wijziging worden gezet (een klik zonder sleep is geen stap).
Technisch is de schets nu drie lagen: schetsvorm.js (hoe een vorm
eruitziet), schetsbalk.js (de knoppen, via een smalle brug) en schets.js
(de hand). En het vel wordt niet meer bij elke muisbeweging herbouwd --
alleen de vormen hertekenen scheelt geknipper en behoudt de pointer-greep.

**Formulier.** Verplichte vragen (de fout zegt WELKE vraag er nog
openstaat, aan beide kanten: vriendelijk op het scherm, afgedwongen op de
server) en het sluiten van de inzendingen: dicht is dicht, ook voor wie
zijn eerdere antwoord wilde vervangen, en de eigenaar kan weer openen. De
uitslag toont de telling nu ook als balkje naast het getal -- geen van
beide vervangt de ander.

**Tekstverwerker.** De tabelknop is volwassen geworden (teksttabel.js):
buiten een tabel voegt hij er een in met kop-rij en gekozen maat; staat de
cursor IN een tabel, dan beheert hij rijen en kolommen op die plek. De
tabel is gewone HTML in het document en gaat mee in bewaren, exporteren
en afdrukken.

Alles zit in de tests: rekenschuif.test.js (schuiven, vastzetten, #VERW!),
office.test.js test 12 (verplicht + sluiten, server-kant), en de twee
e2e's doen het door de echte schermen -- kopiëren/plakken/Ctrl+Z en
doorvoeren in het blad; de verplichte vraag, de balkjes, de grepen,
dupliceren en Ctrl+Z in formulier en schets.

## RTG Agenda: van lijstje naar een kalender van wereldklasse

De boardroom had al een lijst-agenda met AI-invoer; dit is de ronde waarin
hij een eigen app werd (/apps/agenda.html) die zich met de grote agenda's
kan meten -- op de RTG-manier.

**De kalender.** Maand (echt raster, maandag eerst, vandaag in goud), week
en lijst. Afspraken hebben eindtijd, plek, notitie en HERHALING
(dag/week/maand/jaar, tot een einddatum). De uitrol rekent elke keer vanaf
de basisdatum: een maandafspraak op de 31e klemt in september op de 30e --
zoals elke grote agenda -- maar staat in oktober gewoon weer op de 31e.
Wie doorstapt vanaf de geklemde datum blijft voorgoed op de 30e hangen;
die fout is hier gemaakt, door de test gevangen (agenda-pro test 1) en
zit nu vastgeschroefd.

**Uitnodigen op codenaam.** De genodigde krijgt een gekoppelde kopie in de
eigen agenda en zegt ja of nee; de organisator ziet de stand per
deelnemer. Wijzigt de organisator de tijd, dan schuiven de kopieën mee;
verwijdert hij de afspraak, dan vervalt hij ook bij de genodigden (met
een seintje). Een genodigde BEWERKT de afspraak niet -- die zegt ja of
nee, meer zeggenschap hoort een uitnodiging niet te geven. Echte namen
komen in het hele verkeer niet voor.

**Herinneringen.** Zoveel minuten vooraf een seintje (SSE), via een
veegtimer die elke halve minuut kijkt; bij herhalende afspraken per
voorkomen ('herinnerdOp' onthoudt per datum). De timer is unref'd: hij
houdt geen test wakker.

**ICS-export.** De agenda ligt niet op een eiland: één knop en er ligt een
.ics die in elke agenda ter wereld opent, met RRULE voor herhalingen en
VALARM voor herinneringen. Tijden reizen bewust als lokale tijd.

**De ecosysteem-laag.** Eigen RTG-boekingen (boekingenVanKlant) verschijnen
goudgemarkeerd en alleen-lezen, met bronlabel "uit RTG": de agenda leest
het ecosysteem, hij herschrijft het niet. En Rahul plant in gewone taal
("proeverij morgen om 15:00") via de bestaande AI-route.

Server: kern/agenda-pro.js + agenda-ics.js als laag óver kern/agenda.js
(Object.assign in server.js; de bestaande /verwijder-route krijgt daarmee
vanzelf de kopie-opruiming). Client: apps/agenda/ (kalender, paneel,
app). Tests: agenda-pro.test.js (5) en agenda.e2e.js door het echte scherm.

## RTG Notities & Taken: het bord dat elke dag opengaat

De kleinste app van de reeks, en juist daarom de strengste oefening in
weglaten: een bord met notities en lijstjes, en verder niets dat afleidt.

**Het bord.** Notities en lijsten door elkaar, vastgepind bovenaan, zoeken
over alles heen. Vinkjes werken op de kaart zelf -- afvinken hoort geen
editor nodig te hebben. Een lijst bouw je met Enter, punt voor punt.

**Het archief is de la, niet de prullenbak.** Archiveren haalt niets weg;
de inhoud blijft compleet en komt met één knop terug op het bord. Niets
verdwijnt stiekem -- dat is huisbeleid, en de test controleert het.

**Delen op codenaam is samen werken.** Wie een lijst gedeeld krijgt, vinkt
af en vult aan; beide kanten zien hetzelfde exemplaar. Maar het bord
blijft van de eigenaar: vastpinnen, archiveren en verder delen kan alleen
die. Een gedeelde die eruit stapt haalt alleen zichzelf eraf; de lijst
blijft gewoon bestaan. Echte namen komen nergens in het verkeer voor.

**Eén wekkerlaag, niet drie.** Een notitie met datum en tijd wordt een
GEKOPPELDE afspraak in RTG Agenda (herinner: 0 -- het seintje komt van de
agenda-laag, niet van een tweede timer hier). Verzetten is verzetten, geen
verdubbelen: dezelfde afspraak schuift mee. De notitie weggooien neemt de
afspraak mee; er blijft geen wees-afspraak achter.

Server: kern/notities.js (maakNotities, met de agenda als tweede argument
voor de koppeling) + routes/notities.js. Client: apps/notities.html +
apps/notities/app.js. Tests: notities.test.js (3) en notities.e2e.js met
twee leden door het echte scherm.

## RTG Bestanden: de versleutelde kluis

De vierde app van de reeks, en de eerste die echt bytes bewaart. De regel
uit server/media.js is hier wet geworden: bytes staan ALTIJD versleuteld
op schijf (kluis.versleutelBuf), in de database staat alleen een korte
verwijzing. Zonder de sleutel is de opslagmap onleesbaar.

**De kluis.** Mappen die nesten (en bij weghalen hun inhoud netjes een
niveau omhoog laten vallen -- er verdwijnt niets stiekem), een eerlijk
quotum van 200 MB per lid met een dunne meter die de prullenbak
meetelt, zoeken over alles heen, sorteren, sterren bovenaan. Slepen naar
het scherm is uploaden.

**Grote bestanden gaan in stukken.** De globale JSON-grens is 8 MB; alles
daarboven gaat als reeks base64-stukken (upstart/updeel/upklaar) en loopt
aan het eind door DEZELFDE upload-poort: zelfde grenzen, zelfde quotum.
Een upload die tien minuten stilvalt wordt opgeruimd.

**Versies.** Elke nieuwe upload op hetzelfde bestand schuift de oude opzij
(max 10, de oudste valt er met bytes en al af). Terugzetten gooit niets
weg: de huidige versie wordt zelf een versie. Wie de versie plaatste
staat erbij -- op codenaam.

**Delen op codenaam.** De ander kijkt, downloadt en plaatst nieuwe
versies; mappen, prullenbak, ster en verder delen blijven van de
eigenaar. Het quotum blijft ook bij een gedeelde versie dat van de
eigenaar. Echte namen komen nergens in het verkeer voor (getest).

**De prullenbak is een la met een klok.** Weg is eerst prullenbak
(herstellen kan 30 dagen, lui geveegd bij elke lijst-aanroep); pas de
tweede keer weg -- of leegmaken -- ruimt de bytes van alle versies echt op.

**De Office-spiegel.** Documenten uit RTG Office staan als alleen-lezen
rij in de kluis, met een link naar de Office-app: kijken kan hier,
werken doet u daar. Niets wordt dubbel opgeslagen.

Server: kern/bestanden.js (basis: opslag, mappen, upload, quotum) +
kern/bestanden-delen.js (delen, versies, prullenbak) +
kern/bestanden-stukken.js (grote bestanden) + routes/bestanden.js.
Client: apps/bestanden.html + apps/bestanden/ (app, paneel). Tests:
bestanden.test.js (5) en bestanden.e2e.js met twee leden door het scherm.

## RTG Meet: vergaderen op codenaam

De vijfde app van de reeks, en de eerste die twee leden LIVE met elkaar
verbindt. De regel van de teamcall geldt hier voor leden: beeld en geluid
lopen peer-to-peer (WebRTC-mesh, tot 12 deelnemers), de server geeft
alleen seinen door via de bestaande SSE-lijn -- hij ziet het gesprek
zelf nooit.

**Kamers.** Een kamer heeft een zes-tekens code zonder verwarbare
tekens; wie de code heeft mag erin (open kamer), of de kamer is
besloten met een lijst codenamen. Kamers die een week stil zijn worden
lui opgeruimd. Alles op codenaam, nergens een echte naam (getest).

**De uitnodiging is de sleutel.** Een kamer vanuit RTG Agenda is
idempotent (dezelfde afspraak geeft altijd dezelfde kamer) en besloten:
de organisator en iedereen die op de afspraak staat komt binnen, de
rest niet -- OOK NIET met de code in de hand. De Vergaderruimte-knop
staat op het afspraak-paneel, voor beide kanten van de uitnodiging.

**In de kamer.** Microfoon en camera aan/uit, SCHERM DELEN via
getDisplayMedia met replaceTrack (de verbindingen blijven gewoon
staan; stopt het delen, dan komt de camera vanzelf terug), de hand
opsteken, en de gastheer kan de kamer sluiten.

**De les van de bouw** (met een echte browser-test gevonden): laat de
NIEUWKOMER bellen zodra zijn media klaar is, niet de zittende
deelnemers zodra ze het kom-sein zien. Anders ontstaat een race waarin
het eerste offer een camera treft die nog opkomt, en er een verbinding
zonder sporen staat. De e2e-test verbindt twee echte Chromium-contexten
met nepcamera's en bewijst de hele keten.

Server: kern/meet.js + routes/meet.js. Client: apps/meet.html +
apps/meet/ (app = lobby en SSE, kamer = mesh en scherm delen), plus de
knop in apps/agenda/paneel.js. Tests: meet.test.js (3) en meet.e2e.js.
