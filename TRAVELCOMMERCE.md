# TRAVELCOMMERCE.md -- RTG Travel Commerce & Agency OS

`REIZEN.md` is het diepte-document van de wereld die de REIZIGER ziet: het
Travel OS, met de Reis, de Invoerbalie, de Reiswacht en het gezelschap. Dit
document staat ernaast en niet eroverheen: het gaat over de HANDEL en de
UITVOERING eromheen -- wie een reis bedenkt, verkoopt, inkoopt, uitvoert,
ondersteunt en betaalt.

Het is een **richtingsdocument** in de vorm van `PLATFORM.md`, `ECONOMIE.md` en
`HDI.md`: per onderdeel staat er of het **staat**, **een stap weg** is, **een
besluit vraagt** of **jaren weg** is -- zodat niemand die vier voor elkaar
aanziet. Wat er niet is, staat er met de reden en niet als lege functie.

Aanleiding, 10 september 2026: de vraag was *"wat kan ons eigen reisbureau, en
hebben we alles om onze klanten te helpen"*. Het antwoord uit de meting was:
de BESLISLUS is af en netjes bewaakt, de UITVOERLUS bestaat niet. Par. 9 is die
meting; de rest van dit document is wat eruit volgt.

---

## 0. De kern, in twee zinnen

> Een reisbureausysteem administreert boekingen. **RTG organiseert de
> werkelijkheid rond een reis** -- commercieel, operationeel en menselijk.

En de regel die het ontwerp stuurt, als aanvulling op REIZEN.md par. 0:

> **Zes partijen kijken naar dezelfde reis, en geen van hen ziet hetzelfde.**
> Er is één werkelijkheid en er zijn zes projecties. Wie een tweede werkelijkheid
> aanlegt, heeft binnen een maand twee antwoorden op "waar staat mijn boeking".

---

## 1. Dit is geen groen veld, en dat is hier opnieuw het belangrijkste feit

Bijna alles wat deze laag vraagt, staat in dit huis al werkend en getoetst --
onder een andere naam, of kijkend naar een ander domein.

| Wat de handelskant vraagt | Wat er staat | Waar |
|---|---|---|
| een reis als graaf over domeinen heen | **de Life Graph-vorm**: een PROJECTIE met vijf etiketten per stuk informatie (bron, eigenaar, `deel` als poort, gevoelig, vervalt) | `kern/levensgraaf/graaf.js` |
| wat een wijziging elders raakt | **de gevolgvoorspelling** uit een echte meting, met drie graden waarvan `onbekend` de grootste is | `kern/stuur/gevolg.js` |
| "los het op" met alternatieven en gevolgen | de reisoplosser: leest altijd, voert alleen een eigen agendataak uit, weigert een alternatief uit te voeren (409 + verwijzing naar het domein) | `kern/reisoplosser.js` |
| één conversatiegeschiedenis per onderwerp | **de Zaak met een tijdlijn**: stand, eigenaar, prioriteit en vier klokken zijn alle AFGELEID, en één module schrijft | `kern/service/loop.js` |
| contract, tarief, fee, allocatie, claims | de Commercial Core, met catalogusprijs != contractprijs != factuurbedrag | `kern/commercie/` |
| geld met een grond per bedrag | zes waardeklassen, drie beleidslagen, één poort waar elke betaling langs gaat | `kern/waarde/`, `kern/pay/poort.js` |
| een terugbetaling die bij zijn gebeurtenis hoort | het teruggaveRECHT: `uitgevoerd: false`, een mens voert uit | `kern/horeca/correctie.js`, `kern/commerce/retour.js` |
| documenten met rechten per vraag | drie niveaus, toestemming per aanvraag, elke inzage tijdgebonden en gelogd | `kern/paspoort.js` |
| personeel, rol, en toegang die meebeweegt | Person -> Employment op codenaam, plus de bevoegdheidsgraaf | `kern/concern/employment.js` |
| één assistent met rolperspectief | beleid, resolver (dekking 100%), plan, mandaat | `kern/stuur/` |
| een reisbureau onder eigen naam | white-label, SSO, quota, contract: `org` IS de klant | `TENANT.md` |

Het werk is dus **aansluiten en niet uitvinden**. Dat is dezelfde uitkomst als
bij `INTELLIGENTIE.md` par. 1.3, en het is de reden dat deze laag goedkoper is
dan hij leest.

---

## 2. Het centrale object is een PROJECTIE, geen tweede database

De verleiding is een `journeys`-tabel die mensen, geld, documenten,
reserveringen, verplichtingen en bewijs BEZIT. Dat is precies de vorm die hier
al een keer sneuvelde als `Asset`, en de meting is er nog:

- `OBJECTMODEL.json`: 2.010 velden over 267 domeinen, waarvan **1.418 (71%) in
  precies één domein wonen**; 20 gelijkende vormparen in het hele huis.
- `KETENVORM.json`: over drie complete ketens (tafel, rit, toelating)
  <!--getal:ketenvorm.actorenGedeeld-->0<!--/getal--> van
  <!--getal:ketenvorm.actorenTotaal-->13<!--/getal--> gedeelde actoren, en
  <!--getal:ketenvorm.themasGedeeld-->2<!--/getal--> van
  <!--getal:ketenvorm.themasTotaal-->10<!--/getal--> gedeelde beloftethema's --
  en die twee gaan allebei over de MACHINE (mag dit twee keer, zegt een weigering
  waarom) en niet over het domein.

Een gedeeld reisobject over domeinen heen is daarmee **niet gerechtvaardigd**.
Wat wel werkt is de vorm die `kern/levensgraaf/graaf.js` gevonden heeft: de
graaf LEEST de domeinen en bouwt zijn knopen elke keer opnieuw, en voegt alleen
toe wat nergens stond -- de etiketten.

**De Reis draagt er zes**, vijf uit de Life Graph plus de zesde die REIZEN.md
par. 2.2 al eist:

| etiket | wat het zegt |
|---|---|
| `bron` | uit welk domein het komt, en dus wie het verandert |
| `eigenaar` | van wie het is: de reiziger, een reisgenoot, het bureau |
| `deel` | wie het mag zien -- een POORT die filtert, geen etiket |
| `gevoelig` | 0 open, 1 persoonlijk, 2 vertrouwelijk, 3 besloten |
| `vervalt` | de datum waarop dit aandacht nodig heeft |
| `herkomst` | `rtg`, `partner`, `extern`, `document`, `beeld`, `handmatig`, `gedeeld` |

Praktisch, en dit is REIZEN.md par. 2.1 onverkort: **de Reis bezit geen boeking.
Hij bezit een verwijzing, een voornemen en een bewijs.** Geen gekopieerde prijs,
geen tweede voorraad, geen tweede status. Een reis die bij het bureau EUR 2.200
kost en in de reismap EUR 22, is precies het soort verschil dat niemand ziet
aankomen.

---

## 3. Zes gezichten op dezelfde reis

| Partij | Wat hij ziet | Waar die projectie vandaan komt | Wat hij nooit ziet |
|---|---|---|---|
| **reiziger** | tijdlijn, wat komt, wat hij zelf moet doen | `kern/reizen.js`, `kern/huis.js` | inkoop, marge, interne notities |
| **reisadviseur** | wat vandaag aandacht vraagt, per klant een werkblad | de kamer Reisbureau (`kern/afdelingen/register2/reisbalie.js`) | de echte naam, tenzij via de kluis met reden en journaalregel |
| **RTG** | volume, marge, incidenten, leverancierkwaliteit | `kern/economie/`, `kern/kosten/` | het dossier van een gezin (ECONOMIE.md: een rekening landt bij de ENTITEIT) |
| **leverancier** | één opdracht met wat hij moet leveren | de leverancier-app over 74 genres | de reiziger achter de codenaam, de prijs die de klant betaalde |
| **medewerker onderweg** | de taak van nu, op de plek van nu | PDA-modules | het commerciële dossier |
| **externe bron** | niets -- hij LEVERT, hij kijkt niet | `reiswereld-bronnen.js` | alles |

Dat de reisgezelschap-laag dit al met een **witte lijst** doet (`zicht()` in
`kern/reisgezelschap.js`) is geen toeval maar de enige richting die veilig is:
een zwarte lijst vergeet je één keer, en dan staat er een boekingsnummer op het
scherm van iemands schoonmoeder.

---

## 4. Vier namen die al bezet zijn

`SEMANTIEK.json` telt <!--getal:semantiek.namen-->120<!--/getal--> namen in meer
dan één domein, waarvan er <!--getal:semantiek.betekenissen-->102<!--/getal-->
meer dan één betekenis dragen. Deze vier raakt deze laag rechtstreeks:

- **`SOORTEN`** -- 47 betekenissen over 49 domeinen, het ergste woord van het
  huis. "Reiscomponent" is een nieuwe SOORTEN. Erf de bestaande lijst uit
  REIZEN.md par. 2.2 of geef hem een eigen naam; maak er geen 48e bij.
- **`STANDEN`** -- 19 betekenissen. Scenario's bij een verstoring zijn geen
  standen maar VOORSTELLEN, en die vorm bestaat al in `kern/commercie/voorstel/`.
- **`KANAAL`** -- staat in de top als botsing (COMMERCE.md par. 3). Een
  distributiekanaal heet hier iets anders of hernoemt eerst.
- **`capability`** -- in `OS.md` is dat PLATFORMvermogen (mag deze aanroep, en
  doet hij het). Wat een reisbureau KAN als zaak is domeinvermogen en heet
  `genre-cap`. Die twee door elkaar halen is dezelfde fout als `Asset`, nu op een
  woord.

---

## 5. De grenzen, bovenop die van REIZEN.md par. 4

**TC-1. Er komt geen tweede boekingswaarheid.** Zie par. 2. Een bevestiging
verschijnt bij alle partijen omdat zij allemaal naar het DOMEIN kijken dat hem
bezit, niet omdat er ergens een kopie is bijgewerkt.

**TC-2. Geld wordt klaargezet; een mens voert uit.** Een terugbetaling hoort bij
de gebeurtenis die hem veroorzaakte -- en die gebeurtenis maakt een RECHT, geen
overboeking (`uitgevoerd: false`). GELD.md en WAARDE.md staan hier onverkort
boven: de AI beweegt geen geld, uitbetaalbaar hangt altijd aan een bevoegdheid
en nooit aan een boolean, en de terugstortstand bepaalt wat `WALLET_SALDO` is.

**TC-3. Een assistent die iets voorstelt is iets anders dan een assistent die
iets doet.** `VERTROUWEN.json` staat op <!--getal:vertrouwen.bewezen-->0<!--/getal-->
bewezen, <!--getal:vertrouwen.geschorst-->0<!--/getal--> geschorst en
<!--getal:vertrouwen.routes-->4716<!--/getal--> verzwakt: de bewijspoort houdt
vandaag niets tegen. Een nieuwe handhavingsregel loopt daarom eerst mee zonder te
blokkeren (`commercie/schaduw.js`) -- je kunt niet afdwingen wat nooit in de
schaduw heeft gelopen.

**TC-4. Een gevolg dat niemand gemeten heeft, heet `onbekend`.** De kop van
`kern/stuur/gevolg.js` telt over 176 bereikbare paden 36 `gemeten`, 44
`geen-effect-gemeten` en 96 `onbekend`. Een scherm dat drie scenario's met
bedragen toont terwijl de helft van de gevolgen niet gemeten is, is een
geruststelling zonder grond. Toon de onbekende helft even groot.

**TC-5. Een leverancierscijfer is een meting of het bestaat niet.**
"Bevestigt binnen vier minuten" en "96% minder problemen" mogen alleen op het
scherm als ze uit echte gebeurtenissen zijn geteld, met de periode erbij. Een
kwaliteitscijfer uit een gevoel is een ranglijst op een ondernemer.

**TC-6. Een reisbureau is een KLANT, geen afdeling van RTG.** `KANTOORMACHT.md`
rekent de kamer `reisbureau` tot de zeven productkamers -- werelden van het
platform, geen afdelingen. RTG's eigen balie is kantoormacht; een extern
reisbureau is een zaak met een genre en een org (`TENANT.md`: `org` IS de klant).
Die twee delen de kern en nooit de deur.

**TC-7. De reiziger blijft de eigenaar van zijn reis.** REIZEN.md par. 4.9:
invoeren is geen val, en dat geldt ook wanneer een BUREAU de reis heeft
klaargezet. Wisselt hij van bureau, dan gaan zijn originelen mee.

---

## 6. De stand per onderdeel

Vier standen, en ze worden niet door elkaar gehaald: **staat** (werkt en is
getoetst), **een stap weg** (de kern staat, er ontbreekt een naad), **vraagt een
besluit** (bouwen kan pas als de eigenaar iets kiest), **jaren weg** (vraagt iets
dat dit huis niet heeft).

### De reiziger
| Onderdeel | Stand | Toelichting |
|---|---|---|
| Reis over domeinen heen | **staat** | `kern/reizen.js`, vijf bronnen |
| Reiswacht met bronnenregel | **staat** | 4 bronnen gemeten, 2 `ontbreekt` en dat staat er |
| Bericht bij een besluit over uw reis | **staat** (10 sep 2026) | `opzet/meldaan.js` `meldLid`, scope `orders` |
| Invoer van elders gekochte reizen | **staat, half** | tekst en boardingpass; pdf en foto niet (`kern/invoer.js`) |
| "Los het op" | **staat** | alternatieven lezen mag altijd, uitvoeren is één agendataak |
| Gezelschap met witte lijst | **staat** | twee rollen, drie dingen die er bewust niet zijn |
| Nu -> Straks -> Vandaag onderweg | **een stap weg** | de gegevens bestaan; het is een presentatie, geen motor |
| Achtergrondwacht met meldingen | **vraagt een besluit** | verandert het karakter: RTG belooft dan te waken terwijl u weg bent |
| Externe vlucht- en spoorbron | **jaren weg** | er is niets aan te sluiten dat dit huis heeft; de wacht zegt dat zelf |

### Het reisbureau als klant
| Onderdeel | Stand | Toelichting |
|---|---|---|
| Genre `reisbureau` | **staat** (10 sep 2026) | eigen sector `travel`, caps `services/location/pricing`; de papieren hangen aan de handeling |
| Werkblad per klant | **een stap weg** | de kamer Reisbalie is de vorm; hij telt en toont al |
| CRM | **staat elders** | `kern/klantenboek.js`, op codenaam -- geen tweede CRM in TravelOS |
| Offerte -> contract -> factuur | **staat elders** | `kern/commercie/`, `supplier/facturen` |
| Marge, inkoopprijs, betalingsplan | **vraagt een besluit** | bestaat vandaag als veld niet; zie par. 7 |
| Personeel, rol, toegang | **staat elders** | `kern/concern/employment.js` |
| Wijzigen en annuleren van een verkochte reis | **staat** (10 sep 2026) | `kern/reisbureau-nazorg.js` + `-wijziging.js`; het lid vraagt, het kantoor beslist |

### De handel eronder
| Onderdeel | Stand | Toelichting |
|---|---|---|
| Aanbod, bereik, vraagbeeld | **staat** | `kern/mall/` |
| Tijdsloten, capaciteit, sluitdag | **staat** | `routes/supplier/tickets.js`, `kern/activiteitendicht.js` |
| Betaling langs één poort | **staat** | `kern/pay/poort.js` |
| Betalen van een RTG-reis | **een stap weg** | de poort staat, de reis hangt er niet aan (par. 9) |
| Leverancierbeeld met SLA en kwaliteit | **een stap weg** | de gebeurtenissen bestaan, de meting niet |
| Moderatie vóór publicatie | **vraagt een besluit** | over het hele aanbodmodel, niet alleen over reizen |
| GDS/NDC, echte luchtvaartinventaris | **jaren weg** | en REIZEN.md par. 5 zegt waarom dat geen gat is |

### De laag eronder
| Onderdeel | Stand | Toelichting |
|---|---|---|
| Identiteit, kluis, codenamen | **staat** | |
| Documenten met rechten per vraag | **staat** | `kern/paspoort.js` |
| Audit en inzagejournaal | **staat** | twee lezers, twee doelen, twee sporen |
| Eventenvelop met oorzaak en correlatie | **staat** | `kern/envelop.js` |
| Assistent die voorstelt | **staat** | `kern/stuur/plan.js` -- PLAN voert niets uit |
| Assistent die handelt | **vraagt een besluit** | TC-3: de bewijspoort houdt vandaag niets tegen |

---

## 7. De besluiten die openstaan

1. **Verdient RTG aan een reis?** Vandaag betaalt een lid de nettoprijs zonder
   opslag en bestaat er geen inkoopprijs- of margeveld. Een bureaumodel met
   verkoop, inkoop en marge is een ander product dan "het platform voor één
   mens" uit `WERELDEN.md`. Dit besluit gaat vóór de bouw, niet erna.
2. **Wat is een aanbetaling?** Een reis van EUR 4.400 met een vertrek over vijf
   maanden vraagt een betalingsplan, een vervaldatum en een annuleringsregel. Alle
   drie bestaan niet, en alle drie zijn juridische toezeggingen.
3. **Wie mag een bevestigde reis wijzigen, en wat kost dat?** Zonder dit besluit
   blijft "bevestigd" een eindstation (par. 9).
4. **Gaat de wacht op de achtergrond door?** Dat is de stap van *momentopname*
   naar *belofte*, en hij hoort een eigen besluit te zijn (REIZEN.md fase 3).
5. **Komt er een keuring vóór publicatie van partnerproducten?** Een vraag over
   het hele aanbodmodel; reizen is er alleen de scherpste vorm van.

---

## 8. De volgorde

Elke stap levert iets dat op zichzelf werkt. Geen stap laat een half object
achter dat de volgende moet afmaken.

1. ~~**De uitvoerlus dicht** -- wijzigen, annuleren, bericht bij een besluit.~~
   **Gedaan op 10 september 2026** (zie par. 9a). Wat er nog aan ontbreekt is
   geen stap 1 meer maar hangt aan stap 3: annuleringskosten en een terugbetaling
   kunnen pas bestaan als er een geldweg is.
2. ~~**Genre `reisbureau`** plus de scheiding kamer/zaak uit TC-6.~~ **Gedaan op
   10 september 2026** (par. 9b). Een extern reisbureau kan zich nu aanmelden.
3. **De geldweg** -- aanbetaling en restbetaling langs `kern/pay/poort.js`, met
   de besluiten uit par. 7 genomen.
4. **De Reis als samenstelling** -- een verkochte reis krijgt echte onderdelen
   met soort én herkomst, in plaats van één regel met tekst.
5. **Het leverancierbeeld** -- bevestigingssnelheid en incidenten uit echte
   gebeurtenissen, met TC-5 eroverheen.
6. **De assistent in de schaduw** -- meelopen en meten vóór hij iets mag.

---

## 9. Wat er gemeten is, en wat niet

Op 10 september 2026 is de hele keten van het eigen reisbureau gelopen op een
verse server met een eigen datamap, in plaats van uit de code afgeleid. Wat er
werkte: een reis in de etalage zetten (kantoor), bladeren tegen de nettoprijs,
advies op vrije tekst (regelwerk, `ai: false`, met de treffers erbij), aanvragen
mét de Reiswijzer erbij, een besluit door een mens op codenaam (afwijzen zonder
reden wordt geweigerd, wie besliste komt uit de sessie), en de reis daarna in De
Reis en De Reiswacht.

Vier dingen die niet werkten, en die geen enkele bestaande toets liet zakken
(twee ervan zijn op dezelfde dag gerepareerd -- zie par. 9a):

1. **Er is geen geldweg.** De bevestigde reis staat in de bestellingen met
   `betaald: false` en een bedrag, en er is geen route om hem te betalen of te
   factureren. De enige bron van ledenfacturen is de verbruiksdoorbelasting
   (`kern/kosten/factuurregel.js`).
2. ~~**Bevestigd is een eindstation.**~~ **Gerepareerd** (par. 9a). Het lid
   kreeg *"Deze aanvraag is al bevestigd"*, en het kantoor kreeg exact dezelfde
   weigering. Wijzigen en afzeggen bestaan nu; annuleringskosten nog niet, en die
   kunnen ook niet vóór de geldweg (par. 7, besluit 2 en 3).
3. ~~**Het lid hoort niets.**~~ **Gerepareerd** (par. 9a). Bij registratie ging
   er mail uit, bij een bevestiging niet -- geen mail, geen melding.
4. **Wat verkocht wordt is één regel.** `inbegrepen` is tekst; er ontstaat geen
   verblijf, geen transfer en geen activiteit als onderdeel. De Reis en de
   Reiswacht hebben dus het minst te doen bij precies de reizen die RTG zelf
   verkoopt.

En één kleinere vondst uit dezelfde ronde: de gegevensvraag vóór een
reisaanvraag zegt *"als er iets verandert aan je tafel of je bestelling"* --
restauranttekst op een reisaanvraag, omdat de aanroep in
`routes/member/winkel.js` de soort `reservering` meegeeft.

---

## 9a. Wat er op 10 september 2026 is gebouwd

De uitvoerlus uit par. 8, stap 1. Vier routes, twee schermen, acht toetsen.

**Wijzigen is een VERZOEK en geen knop.** Het lid vraagt een andere datum, een
ander aantal personen of stelt een vraag; de reis gaat naar
`wijziging-gevraagd` met de wens ERNAAST, en een mens van het kantoor past hem
toe of wijst hem af met een reden. Een lid dat zijn eigen bevestiging kan
omschrijven, staat straks voor niets op een vliegveld -- dus staat de wens naast
de reis en niet erin. Toets 1 zakt zodra dat verandert.

**Afzeggen is iets anders dan intrekken, en draagt daarom een eigen stand.**
`geannuleerd` is een lid dat een OPEN aanvraag terugtrekt: er was niets
toegezegd. `afgezegd` is een reis die rond was en alsnog niet doorgaat. Wie die
twee op een hoop gooit, kan achteraf niet meer zien of er ooit iets is beloofd --
precies wat je bij een geschil wilt weten. Beide kanten kunnen afzeggen, allebei
alleen met een reden.

**Het geld blijft handwerk, en dat staat er.** Een afzegging schrijft een
`geld`-blok met de stand `nietGeregeld` en de reden erbij (TC-2). Er is geen
betaalweg, dus er valt niets terug te boeken; een leeg veld zou als
"afgehandeld" gelezen worden. Zodra er wel een geldweg is, is dit het veld dat
hem aanroept.

**Het besluit bereikt het lid nu ook echt.** Dat vroeg een reparatie een laag
dieper, en die was groter dan de reis: `notify()` schrijft meldingen op TIER
(alle Business-leden), terwijl een persoonlijk bericht op de SLEUTEL van het lid
hoort. `/api/notifications` las alleen de eerste bak. Een persoonlijk bericht
kwam dus wel in de opslag, was over de live-verbinding even zichtbaar, en
verdween bij de eerste herlaadbeurt. Dat raakte niet alleen reizen: ook een
aangenomen sollicitant kreeg zo een melding die nergens aankwam.
`opzet/meldaan.js` heeft er nu twee wegen uit EEN schrijver (veiligheid en
gewoon), en het eindpunt leest beide bakken.

**Twee dingen die het bouwen blootlegde en die hier niet weggepoetst worden:**

1. **Een bestaande toets had gelijk en ik niet.** Een afgewezen reisaanvraag
   werd door de eerste versie van de tijdlijn gefilterd ("die gaat toch niet
   door"). `test/reiswereld.test.js` zakte daarop, en terecht: de reiswereld zet
   op zo'n aanvraag het signaal `aandacht`, en `kern/reisoplosser.js` hangt
   daaraan om alternatieven te zoeken. Wegfilteren had die hele functie stil
   verwijderd. Alleen `geannuleerd` en `afgezegd` vallen nu weg.
2. **De reisbalie in `backoffice.html` is een dood spoor.** De code die daar de
   reisaanvragen en het reisaanbod tekent, zoekt `#rbList` en `#raList` -- en die
   containers bestaan in geen enkele HTML van dit huis. `renderReisaanvragen()`
   keert dus meteen terug. De werkende balie is de kamer Reisbureau in
   `kantoren.html`, en daar is de nazorg aan gebouwd. Het dode spoor is blijven
   staan: het weghalen of aansluiten is een besluit over dat scherm en niet over
   deze functie.

**Wat er nog steeds niet is** (par. 9, punten 1 en 4): de geldweg, en een
verkochte reis die uit echte onderdelen bestaat in plaats van uit een regel.

---

## 9b. Het genre `reisbureau` (10 september 2026)

Stap 2 uit par. 8. Van de vierenzeventig genres was er geen enkele waarin een
reisbedrijf paste: wel `hotel`, `vervoer`, `ov` en `activiteiten`, maar niets
voor wie die drie SAMENSTELT. Een extern reisbureau kon zich dus niet aanmelden.
Nu wel, en drie dingen liggen daarbij vast.

**Een eigen sector, en niet een hoekje van `professional`.** Een reisbureau
verkoopt geen uren zoals een adviesbureau en geen kamers zoals een hotel; het
stelt samen wat anderen leveren. In `professional` zou het onvindbaar zijn voor
wie een reisbedrijf zoekt, en dat is precies wat een sector hoort op te lossen.
De sector `travel` draagt vandaag één genre; een touroperator en een reisgids
zijn een besluit en geen bouwwerk.

**De papieren hangen aan de HANDELING en niet aan het genre.** Dit is de
scherpste keuze van deze stap. De acht genres op de bewijslijst
(`kern/bedrijfscontrole.js`) zijn beroepen waar iemand zonder papier direct
schade aanricht. Bij reizen werkt dat anders: wie **pakketreizen verkoopt**
heeft insolventiebescherming nodig, en wie alleen adviseert niet -- terwijl een
HOTEL dat een arrangement verkoopt hem juist wél nodig heeft. Die vlag bestond
al (`pakketreis`, met de garantieregeling als bron) en geldt voor elke
aanvrager. Het genre aan de bewijslijst toevoegen zou dezelfde eis twee keer
stellen en hem tegelijk missen bij wie hem wel nodig heeft.
`test/reisbureau-genre.test.js` toets 3 houdt dat besluit vast, zodat wie het
omdraait er langs moet.

**En het blijft de gewone leverancier-app.** Geen van de drie caps hangt aan een
PDA-module, en dat klopt: een reisbureau werkt met agenda, klantenboek,
facturen en berichten. Wie er `bookings` of `tickets` bij zet, geeft een
reisbureau kamers of een deurverkoop die het niet heeft.

**TC-6 blijft staan:** de kamer Reisbureau van het RTG-kantoor is kantoormacht,
dit is een zaak met een eigen code. Ze delen de kern en nooit de deur.

---

**Wat deze meting NIET zegt:** er is geen browser aan te pas gekomen, de
kantoorkant is met een persoonlijke kantoorsessie gelopen en niet met de
gedeelde code (die twee verschillen sinds `kern/kantoor/kluispoort.js`), en over
de leveranciers- en partnerkant is niets gemeten. `APPWERKT.json` kent vier
reisrijen, waarvan er drie `bereikbaar: BEWEZEN` dragen en de overige bewijzen
`NIET_GETEST` of `GEEN_FIXTURE` zijn -- niet gemeten mag nooit als "in orde"
langskomen.
