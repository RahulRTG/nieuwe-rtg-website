# WAARDE.md — RTG Value: waarde die weet wat hij is

Opdracht van Rahul (24 augustus 2026), naar aanleiding van de vraag of RTG Pay
met eigen saldo en vouchers kan werken. Het antwoord op die vraag was ja, en
bijna alles stond er al — maar de vraag zelf was te klein. Dit document legt
vast wat er in plaats daarvan komt.

`GELD.md` gaat over RTG Geld als financieel besturingssysteem voor één lid:
weten, begrijpen, voorspellen, uitvoeren, uitleggen. Dit document gaat over de
laag daaronder, en die is niet persoonlijk maar infrastructureel: **wat waarde
zelf is binnen RTG**, ongeacht wie hem houdt.

## 0. De kern, in één zin

> Elke euro, elk tegoed en elk budget weet wie het bezit, waarvoor het gebruikt
> mag worden, wie het mag verplaatsen, wat het fiscale gevolg is en welk bewijs
> daarvoor bestaat.

De maatstaf is dus niet "kan RTG betalingen verwerken?". Die lat lag al lang
achter ons. De maatstaf is of RTG waarde realtime kan **beheersen én bewijzen**.

## 1. Waarom een voucherlaag het verkeerde antwoord was

De oorspronkelijke gedachte was: leden zetten saldo op hun account, en betalen
binnen RTG kost dan niets omdat het via vouchers loopt. Twee dingen daaraan
kloppen niet, en het is beter ze hier op te schrijven dan ze later te ontdekken.

**Transactiekosten verdwijnen niet, ze verhuizen.** Het lid betaalt vandaag al
niets: `kern/geldregie.js` legt de kosten van de betaaldienst bij de ondernemer
(vaste voet plus percentage, direct verrekend in `kern/pay/kassa.js`). De echte
externe kosten zitten bij het **opladen** — dat loopt over de kaart-naad
(`server/betaal.js`) en daar rekent een acquirer af. Een voucherlaag verplaatst
die kosten naar het oplaadmoment; hij laat ze niet verdampen. Wat er wél
gebeurt: één oplading van honderd euro draagt de kosten van dertig betalingen
in plaats van dertig keer. Dát is het echte voordeel, en het is groot genoeg om
eerlijk over te zijn.

**"Voucher" is te klein voor wat het is.** Een voucher is één soort waarde.
Zodra een werkgeversbudget, een gemeentetegoed, een cadeaukaart, loyaliteit en
een partnersaldo hetzelfde grootboek gebruiken, is het verschil tussen die
soorten de hele inhoud. Een systeem dat ze allemaal "saldo" noemt, heeft het
enige weggegooid wat ertoe deed.

Vandaar geen voucherproduct maar één laag: **RTG Value**.

## 2. Wat er al stond

Dit is geen groen veld. Wat hieronder staat, werkte al vóór dit document:

| Stuk | Waar | Wat het al doet |
|---|---|---|
| Dubbel grootboek | `kern/pay/index.js` | elke beweging van→naar, som van alle saldi exact nul, sluitcontrole op `/api/pay/gezond` |
| Saldo dat het lid zelf oplaadt | `kern/pay/opladen.js` | via de kaart-naad, met webhook-afronding en herstart-reconcile |
| Automatisch bijladen | `zorgSaldo()` | eerst de eigen bank, anders de kaart, in stappen van tien euro |
| Idempotentie + duurzaamheid | `lib/idem.js`, `GELDLAT.md` | dezelfde knop twee keer is één boeking; 2xx pas na fsync |
| Betalen bij een zaak | `kern/pay/kassa.js` | kassacode met eigen plafond en vervaltijd |
| Geld tussen leden | `kern/pay/verzoeken.js`, `tik.js` | Klompjes, splitsen, betalen met een aanraking |
| Uitbetalen aan een zaak | `partnerUitbetaal()` | via de opdrachtenrij (`kern/betaalopdracht/`), nooit compenserend |
| De eigen bank ernaast | `kern/bank/` | rekeningen, SEPA, sparen, en de brug naar de wallet |
| Wat RTG mág | `kern/bevoegdheid/` | vier soorten: software, rail, vergunning, **besluit** |
| Vouchers fiscaal correct | `kern/fiscaal/index.js` | cadeaukaarten: geen omzet bij verkoop, btw bij inwisseling, saldo als verplichting op de balans |
| Beleid van het lid | `kern/geldbeleid/` | regels, potten, actielog |
| Vooruitkijken | `kern/geldgraaf/` | de financiële graaf, uitdrukkelijk géén tweede boekhouding |
| De noodstop | `opzet/betaalstop.js` | `RTG_BETALEN_UIT=1` sluit ook interne wallets, munten en cadeaukaarten |

De echte economie stond er dus al. Wat ontbrak was dat de waarde zelf niets van
zichzelf wist.

## 3. Het gat dat dit document dicht

In `kern/bevoegdheid/lijst.js` staat een besluit met de naam `WALLET_SALDO`. Het
is de grond waarop RTG walletsaldo mag aanhouden zonder vergunning, en het luidt:

> Een gesloten circuit met harde plafonds: saldo is alleen binnen RTG te
> besteden, wordt niet uitbetaald aan het lid en kent **een maximum per wallet en
> per boeking**.

Het maximum per boeking bestond (`MAX_CENTEN` in `kern/pay/stand.js`). **Het
maximum per wallet bestond niet.** Nergens. Een lid kon onbeperkt opladen.

Dat is het gevaarlijkste soort fout in dit huis, en niet omdat het bedrag groot
is. Een besluit heeft geen toezichthouder die het naleest — dat is precies het
verschil tussen een besluit en een vergunning. Het besluit droeg zijn eigen
vervalclausule ("verandert een van die drie, dan vervalt de grond"), en één van
de drie was er nooit geweest. Het besluit beschreef een werkelijkheid die de
code niet had.

Sinds `kern/waarde/` bestaat dat plafond wel, en `test/waarde.test.js` gaat er
door de voordeur op af: over HTTP, langs de echte oplaadroute. Beide mutaties
zijn gedaan — plafond weghalen, en de laag loskoppelen van pay — en beide laten
de toets zakken (`LAT.md` regel 9).

## 4. De begrippen

Vijf, en er komt er geen zesde bij zonder dat dit document verandert.

**Waarde** is wat er op een positie staat. Rauw in centen; het scherm maakt er
één keer euro's van.

**Positie** is één rekening in het grootboek. `lid:<codenaam>`,
`partner:<code>` en `waarde:<id>` (een uitgegeven budget) zijn posities; de
`extern:`-rekeningen zijn dat níet — dat is de sluitpost van het dubbel
boekhouden en die mag juist negatief staan. Een lid heeft altijd zijn wallet en
kan daarnaast budgetten hebben; ze staan náást elkaar en worden nooit tot één
getal opgeteld. `vrijBesteedbaar` en `gebonden` zijn twee totalen, en er is met
opzet geen derde dat ze optelt — dat leest als "dit kan ik uitgeven", en dat is
gebonden waarde niet.

**Klasse** is wat voor soort waarde het is (`kern/waarde/klassen.js`). Zes
stuks, elk met zes velden en een **grond**: uitgever, bestedingsgebied,
uitbetaalbaar, overdraagbaar, plafond, verval. De grond zegt waarom die klasse
mag bestaan, en is daarmee aanvechtbaar — dat is het hele punt van hem
opschrijven, net als in de bevoegdhedenlijst.

| Klasse | Uitbetaalbaar | Overdraagbaar | Plafond |
|---|---|---|---|
| `PERSONAL_FUNDED` — eigen saldo | nee | aan leden | € 5.000 |
| `EMPLOYER_BUDGET` — werkgeversbudget | nee | nee | € 2.000 |
| `MUNICIPAL` — overheidstegoed | nee | nee | € 5.000 |
| `LOYALTY` — door RTG toegekend | nee | nee | € 1.000 |
| `GIFT` — cadeaukaart van een zaak | nee | vrij | € 1.000 |
| `PARTNER_SETTLEMENT` — saldo van een zaak | **ja** | nee | geen |

Eén klasse mag het huis verlaten, en niet toevallig is dat de enige die aan een
vergunning hangt (`PARTNER_UITBETALING`). Vrij overdraagbaar én uitbetaalbaar
tegelijk is geld uitgeven; die combinatie bestaat hier niet, en een toets zakt
als iemand hem toch maakt.

**Beleid** is wat de uitgever of de houder er bovenop zet: genres, tijdvenster,
dagmaximum. Het toetst **fail-closed**: een genrebeperking geldt ook als het
genre onbekend is, want dan weten we juist niet dat deze zaak eronder valt. De
eerste versie had daar `h.genre &&` staan en glipte dus langs elke beperking
zodra de aanroeper vergat te zeggen wáár — een beleidslaag die bij twijfel
goedkeurt is geen beleidslaag. Het genre komt daarom ook uit het
partnerregister en nooit uit het verzoek: een zaak die haar eigen genre opgeeft,
vult de bestedingsbeperking van een werkgever zelf in. Drie lagen, van hard naar zacht (`kern/waarde/policy.js`): de klasse
staat niet ter beschikking van een instelling, het beleid van de uitgever wel,
en het beleid van de houder is de enige weigering die de houder zelf kan
opheffen — het antwoord zegt dat dan ook (`opheffbaar: true`).

**Reservering** is het verschil tussen saldo en beschikbaar
(`kern/waarde/reserve.js`). Er beweegt geen geld: een reservering is geen
boeking, en het grootboek sluit op nul zonder dat die module bestaat. Elke
reservering heeft een vervaltijd, want een reservering die blijft hangen zet het
geld van een lid vast zonder dat iemand kan uitleggen waarom.

## 5. De poort

Er is één plek waar dit alles op uitkomt, en dat is met opzet:
`kern/pay/poort.js`, aangeroepen door zowel `boek()` als de motor-tak van
`boekAsync()`. Drie vragen, in deze volgorde:

1. is er genoeg **beschikbaar** (saldo min wat vastgezet staat)?
2. **mag** deze waarde hiervoor worden gebruikt (klasse, dan uitgever, dan houder)?
3. past het bedrag binnen het **plafond** van de ontvangende positie?

De oude regel — "heeft deze rekening genoeg?" — staat er letterlijk nog en gaat
als eerste. Hij is de bodem die er ook is als de waardelaag niet gemount is. Een
optionele laag die stilzwijgend een controle meeneemt, neemt hem weg zodra
iemand hem niet mount.

**De aard van de handeling is waar dit fout kan gaan, en één keer ook is
gegaan.** De poort leidt uit `van` en `naar` af wát er gebeurt — besteden,
overdragen, uitbetalen, huisintern of teruggave — en pas die aard bepaalt welke
regels gelden. Die afleiding las een boeking van `partner:` naar `lid:` als
*overdragen*, en een partnersaldo is niet overdraagbaar. Gevolg: elke teruggave,
terugbetaling en creditering in het hele huis werd geweigerd. Geld teruggeven is
geen overdracht, en de regel staat er nu structureel: gaat waarde van een **zaak**
naar een **lid**, dan is dat geld dat terugkomt bij de klant. Een lijst met
soortnamen zou hebben gewerkt tot de volgende die iemand verzint.

De toets in JS en niet in de Rust-motor, ook in `RTG_MOTOR_GELD=motor`: de motor
kent de klassen, het beleid en de reserveringen niet, want die metadata woont
aan deze kant. Dezelfde reden waarom de bank-guard in `kern/bank/grootboek.js`
in JS bleef staan.

## 6. De levenscyclus

Waarde is geen getal dat op en neer gaat maar een object met een toestand:

```
uitgegeven → gereserveerd → geautoriseerd → besteed → verrekend → afgestemd → bewezen
```

Bij elke overgang hoort te worden vastgelegd wie opdracht gaf, op grond van
welke bevoegdheid, welk beleid gold en in welke versie, welke grootboekregels
ontstonden, welke rail is gebruikt, en of de afstemming klopt.

Gebouwd zijn de eerste vier: uitgegeven, gereserveerd en geautoriseerd
(`kern/pay/vooraf.js` doorloopt ze alle drie in de kassa), en besteed. Verrekend en afgestemd bestaan al voor de externe kant in
`kern/settlement.js` en `kern/betaalopdracht/`, maar nog niet als toestand van
de waarde zelf. **Bewezen** is er nog niet; zie paragraaf 8.

## 7. Wat hierop volgt, in volgorde

De volgorde is niet vrij: elke stap leunt op de vorige.

1. ~~**Reserveren in de betaalwegen.**~~ **Gedaan.** Een zaak zet een maximum
   vast op de kassacode van een lid, legt later het werkelijke bedrag vast, of
   geeft vrij (`kern/pay/vooraf.js`, `/api/supplier/pay/vooraf|vastleg|vrijgeef`).
   De garantie is echt: bij het vastzetten laadt de wallet zo nodig bij, want wie
   een maximum vastzet op een wallet die het niet heeft, heeft niets vastgezet.
   Het lid ziet in zijn overzicht saldo, gereserveerd én beschikbaar, met wie het
   vastzette en tot wanneer.

   Het lid krijgt hier bewust **geen eigen knop** voor. Hij toont dezelfde
   kassacode als altijd; vastzetten is iets wat een zaak vraagt. Een tweede soort
   code zou het lid laten kiezen tussen twee dingen die voor hem hetzelfde zijn.
2. ~~**Meerdere posities per lid.**~~ **Gedaan.** Een budget is een eigen
   rekening `waarde:<id>` in hetzelfde grootboek — geen tweede boekhouding, wel
   een tweede rekening. Een uitgever (werkgever, gemeente, RTG) geeft het uit
   met `/api/supplier/pay/budget`, en het kost hem precies dat bedrag: geld
   ontstaat niet uit het niets, dus `kern/waarde/uitgifte.js` maakt alleen de
   positie en `kern/pay/budget.js` boekt de euro's van de uitgever ernaartoe.
   Het lid ziet zijn posities naast elkaar op `/api/pay/portefeuille`.
3. ~~**Slim betalen uit meerdere potjes.**~~ **Gedaan.** € 72 wordt € 25
   maaltijdbudget en € 47 eigen saldo, in één tik
   (`kern/waarde/samenstellen.js`, uitgevoerd door `kern/pay/samen.js`).

   De volgorde is de hele inhoud, en hij is omgekeerd aan wat een systeem uit
   zichzelf doet: **het meest beperkte potje eerst.** Wat het snelst vervalt vóór
   wat later vervalt, gebonden vóór vrij, de eigen wallet altijd als laatste —
   die is de opvangbak en als enige bij te laden. Pakt het systeem het vrije geld
   eerst, dan ziet het lid aan het eind van de maand zijn budget verlopen terwijl
   hij zijn eigen geld heeft uitgegeven aan precies datgene waar dat budget voor
   was. Dat is met geen enkele foutmelding zichtbaar; alleen een toets op de
   volgorde vangt het.
4. ~~**De persoonlijke geldgrens.**~~ **Gedaan.** `kern/geldbeleid/grens.js`:
   het lid stelt een dag- of maandgrens over zijn eigen uitgaven, eventueel per
   genre of binnen een tijdvenster, en die **weigert** in de waardepoort. De vier
   bestaande regelsoorten in `kern/geldbeleid/regels.js` waarschuwen, en dat is
   voor die vier goed; deze is de enige die de deur dichtdoet. Een waarschuwing
   die je kunt wegklikken op het moment dat je hem het hardst nodig hebt, is geen
   grens maar een geheugensteun.

   De grens hangt aan de **persoon**, niet aan een potje: hij telt over alle
   posities samen. Anders is hij te omzeilen door uit een budget te betalen.

   **De spanning, en die is niet weg te ontwerpen.** Een grens die je meteen kunt
   uitzetten is een drempel — hij onderbreekt een impuls, meer niet. Een grens
   die je níet meteen kunt uitzetten is een echte belofte aan jezelf, en zet
   iemand die in het buitenland strandt met een daglimiet van honderd euro voor
   een hotel van vierhonderd voor een gesloten deur. De keuze: **strenger werkt
   meteen, soepeler kan wachten, en de bedenktijd is opt-in.** Standaard geen
   bedenktijd — dat is met opzet de zwakkere stand, want RTG is geen
   kansspelaanbieder en een betaalgrens die iemand laat stranden is erger dan een
   impulsaankoop. Wie de sterkere versie wil, kiest hem, en dan houdt hij ook
   echt: weggooien loopt langs dezelfde bedenktijd als verhogen, anders is hij te
   omzeilen door de grens niet te verhogen maar weg te gooien. Er is géén
   noodknop die de bedenktijd overslaat; die zou hem terugbrengen tot precies wat
   hij niet mocht zijn.
5. ~~**De waardegraaf.**~~ **Gedaan.** `kern/pay/graaf.js`: waar kwam het
   vandaan en waar ging het heen, voor het lid (`/api/pay/graaf`) en voor de
   ondernemer (`/api/supplier/pay/graaf`). Alles afgeleid uit het grootboek,
   niets apart geteld — de toets rekent na dat binnengekomen min uitgegeven
   precies het saldo is. Verplaatsingen tussen de eigen posities tellen aan geen
   van beide kanten mee: geld van je wallet naar je eigen budget schuiven is geen
   uitgave, en zou anders allebei de kanten opblazen.

   Per regel staat of hij **afgeleid** is. De kosten van de betaaldienst zijn
   echte grootboekregels; het btw- en loondeel is een percentage uit het eigen
   beleid. Een schatting die zich voordoet als een afdracht is gevaarlijker dan
   geen bedrag.
6. ~~**Treasury voor ondernemers.**~~ **Gedaan.** `kern/pay/treasury.js`: de
   zaak stelt een btw-percentage, een loonpercentage en een bufferbodem in, en
   bij **elke ontvangst** gaat dat deel meteen apart — niet één keer per dag,
   want een dagelijkse taak is een taak die kan uitvallen.

   Het heeft tanden omdat `partnerUitbetaal` sinds deze stap **beschikbaar**
   uitbetaalt en niet het saldo. Zonder die tweede helft is een btw-reservering
   een getal op een scherm dat de volgende uitbetaling gewoon meeneemt. De
   klassieke manier waarop een horecazaak omvalt is niet dat er te weinig
   binnenkwam, maar dat er te veel uitging omdat het saldo eruitzag als winst.

   Dit vroeg een begrip dat er nog niet was: het **oormerk**
   (`kern/waarde/oormerk.js`), naast de reservering en met opzet niet hetzelfde.
   Een reservering is iemand anders die uw geld vasthoudt voor een lopende
   handeling — die **vervalt**, en dat moet ook. Een oormerk is u die uw eigen
   geld apart zet — dat **vervalt niet**, en dat moet ook niet: een
   btw-reservering die na een dag vanzelf vrijvalt is geen reservering maar een
   dagdroom.
7. ~~**Bewijs per geldfunctie.**~~ **Gedaan.** Zie hieronder.

## 8. Bewijs boven status

Een statusbord dat "werkend" zegt, zegt niets — het zegt alleen dat niemand
heeft gekeken. Dit huis heeft daar al een antwoord op (`TOEZICHT.md`,
`BEWIJS.md`, `WETTEN.json`, de ketenronde), en geld is de zwaarste keten die dat
bewijs moet leveren (`GELDLAT.md`).

Elke kritieke geldfunctie is daarom niet groen maar **bewezen**, met de leeftijd
van dat bewijs erbij. `kern/pay/bewijs.js` en `/api/office/pay/bewijs`:

| Controle | Hoe |
|---|---|
| Het grootboek sluit | live nagerekend: som nul, niemand rood |
| Plafonds worden nageleefd | live geteld: nul overtredingen |
| Vastgezet geld bestaat ook | reserveringen plus oormerken ≤ saldo |
| Elke boeking heeft twee kanten | elke regel op vorm gecontroleerd |
| Afgestemd met de betaaldienst | **niet-bewezen**, met de reden |

**Drie standen en met opzet geen groen.** `bewezen` (zojuist gemeten, mét het
getal waaruit het blijkt), `niet-bewezen` (er is niets dat het aantoont — geen
storing, en ook geen "waarschijnlijk goed"), `gezakt` (gemeten en het klopte
niet; de enige stand die om iemand vraagt). Het eindoordeel is niet "alles
groen" maar *niets gezakt én alles gemeten*: zolang er iets niet-bewezen is,
staat er `deels bewezen`.

De vijfde regel is de belangrijkste van het bord, juist omdat hij niet slaagt.
Afstemming met het echte afschrift van de betaaldienst is wat een CFO als eerste
wil zien en wat dit huis nog niet doet. Een vinkje daar zou de gevaarlijkste
leugen van het hele bord zijn — het zou precies dekken wat niemand anders dekt.
Dus staat er wat waar is: nooit gedaan, en waarom niet. Een bewijs dat ouder is
dan achtenveertig uur zakt; een bewijs dat verlopen is, bewijst niets meer.

## 9. De grenzen

Deze staan hier zodat ze het niet stilzwijgend afleggen tegen een functie.
Botst een functie met een grens, dan **vervalt de functie**.

1. **Geld verlaat het huis nooit autonoom.** `GELD.md` par. 3 blijft onverkort
   staan. Betalen, opzeggen en alles wat een derde raakt is maximaal
   "klaarzetten"; bevestigen doet een mens.
2. **Er komt geen tweede boekhouding.** De waardelaag boekt niet en houdt geen
   saldo bij. Een reservering is geen boeking. Een geldscherm dat een ander
   getal toont dan de wallet is erger dan geen geldscherm.
3. **Uitbetaalbaar hangt altijd aan een bevoegdheid, nooit aan een boolean.**
   Twee klassen mogen het huis verlaten — `PARTNER_SETTLEMENT` naar de
   ondernemer en, sinds 24 augustus 2026, `PERSONAL_FUNDED` terug naar het lid.
   Beide **noemen** het vermogen waarop dat rust (`uitbetaalVermogen` in
   `kern/waarde/klassen.js`), en dat vermogen moet echt in de
   bevoegdhedenlijst staan en van een soort zijn die iets kán weigeren. Een
   `besluit` kan dat niet — dat staat per definitie altijd open — dus een
   uitbetaalbaarheid die op een besluit leunt is geen grens maar een aanname.
   `test/waarde.test.js` zakt als een klasse `uitbetaalbaar: true` zet zonder
   te zeggen waarop.

   **De open vraag uit de vorige versie van dit document is beslist, en het
   heeft wat gekost.** Er stond hier dat de keten wallet → RTG Bank → SEPA een
   uitweg was naast wat het besluit `WALLET_SALDO` beloofde, met drie mogelijke
   antwoorden. Rahul heeft het derde gekozen én verder getrokken: leden moeten
   hun saldo gewoon kunnen terugstorten, snel en veilig.

   Daarmee is de tweede voorwaarde onder dat besluit veranderd, en de
   vervalclausule die het zelf droeg is ingegaan. Niet als formaliteit: **saldo
   dat op verzoek tegen de nominale waarde wordt terugbetaald aan de houder, ís
   elektronisch geld.** Een besluit kan dat niet wegschrijven — het gaat over
   wat de handeling is, niet over hoe we hem noemen.

   `WALLET_SALDO` is daarom van soort gewisseld, precies zoals afgesproken: van
   `besluit` naar `rail`, met `elektronischgeldinstelling` als eis over de eigen
   rails. Draait de partnerrail — de partij die het geld aanhoudt en bevoegd is
   — dan levert RTG het scherm en de administratie. De terugstorting zelf is een
   apart vermogen (`LID_UITBETALING`), want bij een storing op de uitbetaalrail
   hoort de wallet niet mee te vallen.

   Dat is niet minder streng dan het besluit, het is anders streng: waar RTG
   eerst zelf vaststelde dat het mocht, hangt het nu aan iets dat kan weigeren.
   Dit is exact waarvoor `kern/bevoegdheid` is gebouwd — de hele ervaring kon af
   zonder te doen alsof er bevoegdheden waren die er niet zijn, en bij een echte
   vergunning verandert alleen wat er in de boardroom is vastgelegd.

   Wat er van de oorspronkelijke drie voorwaarden over is, is het **plafond** —
   en dat blijft juist nu staan.

   **En de positie is omkeerbaar, zonder dat de knop ooit losraakt van zijn
   betekenis.** RTG kan beide posities innemen; dat is een legitieme
   bedrijfskeuze en er is een schakelaar voor
   (`/api/office/bank/terugstorting`, boardroomwerk). Het gevaar zit niet in de
   keuze maar in de ontkoppeling: een knop die de belofte aan leden omzet
   terwijl de vergunningsvraag blijft staan, is een manier om om de
   vergunningplicht heen te komen.

   Daarom is `WALLET_SALDO` geen vaste soort meer maar **afhankelijk**: de
   bevoegdhedenlijst draagt twee volledig uitgeschreven gezichten en de stand
   bepaalt welke geldt.

   | Stand | `WALLET_SALDO` | `LID_UITBETALING` | Wat RTG dan is |
   |---|---|---|---|
   | `gesloten` | besluit, met grond | bestaat niet | beperkt netwerk, geen vergunning |
   | `open` | rail, e-geldinstelling | rail, sepa | uitgever van elektronisch geld |

   Er bestaat dus geen stand waarin de code iets anders doet dan het document
   zegt — dat was precies de fout die dit traject heeft blootgelegd, en dit is
   de vorm die hem structureel uitsluit. Ontbreekt de stand, dan geldt per
   vermogen het **strengste** gezicht, en dat is niet voor allebei hetzelfde:
   bij `WALLET_SALDO` de rail (die kan weigeren, een besluit nooit), bij
   `LID_UITBETALING` juist `gesloten`.

   Eén route hangt er bewust **niet** aan: `/api/pay/terugstand`, dat uitlegt
   wáárom het niet kan. Een deur mag op slot; het bordje ernaast hoort leesbaar
   te blijven.
4. **Het plafond is de grond, niet een instelling.** Zodra het plafond
   losgelaten wordt, is de klasse iets anders geworden en hoort hij van soort
   te wisselen. Verhogen is een besluit met een handtekening.
5. **De AI beweegt geen geld.** Rahul mag voorstellen, samenstellen en
   klaarzetten. De poort beoordeelt, een mens of een vooraf gestelde regel
   autoriseert, het grootboek voert uit, en er blijft bewijs achter. AI zonder
   verantwoording is hier geen AI maar een orakel.
6. **Loon loopt via de loonaangifte.** Een werkgeversbudget dat overdraagbaar of
   uitbetaalbaar wordt, is loon. Dan hoort het via `kern/payroll` te lopen met
   loonheffing eromheen, niet hierlangs.
7. **Een weigering is een gegeven over het lid, niet over de betaling.** De
   reden waarom de poort nee zei — een zelf gestelde daglimiet, een wallet tegen
   het plafond, een borg van een andere zaak, een budget dat hier niet geldt — is
   privé. Een zaak krijgt een generiek antwoord; alleen "onvoldoende saldo"
   blijft staan, want dat is wat een betaalterminal ook meldt en het verandert
   wat de kassa nu doet. Zelfs daar gaan de bedragen eraf. Het lid krijgt de
   volledige reden, in zijn eigen app. Een pinautomaat vertelt de winkelier ook
   niet waarom de bank nee zei.
8. **Een storing legt de economie niet stil.** De noodstop is er al
   (`RTG_BETALEN_UIT=1`), maar hij is alles-of-niets. Er horen tussenstanden te
   komen: externe uitbetalingen gepauzeerd terwijl interne betalingen
   doorlopen, of geen nieuwe opladingen terwijl bestaand saldo bruikbaar blijft.
   Een storing bij een acquirer hoort geen restaurant te laten stilvallen.

## 10. Wat er bewust NIET komt

- **Een eigen munt, punt of token.** Waarde in dit huis is in euro's
  gedenomineerd en gedekt door echte inleg. Een eigen rekeneenheid maakt de
  denominatie een keuze van RTG, en dat is precies wat een beperkt netwerk niet
  is. `MUNT_AAN` gaat over crypto-acceptatie via een vergunninghoudende
  aanbieder en is iets anders.
- **Rente, krediet of rendement op walletsaldo.** Dat zijn de twee handelingen
  waar de bevoegdhedenlijst de hoogste rang voor vraagt, en niet voor niets.
- **Waarde die zichzelf vermeerdert bij gebruik.** Geen multipliers, geen
  streaks, geen tegoed dat vervalt tenzij je vandaag nog uitgeeft. Dat is de
  verslavingsparagraaf uit `CLAUDE.md`, toegepast op geld — en op geld telt hij
  zwaarder, niet lichter.
- **Handel in tegoeden tussen leden.** `GIFT` is vrij overdraagbaar omdat hij
  bij één zaak te besteden is en niet uitbetaalbaar. Een markt waarop tegoeden
  verhandeld worden, maakt er een betaalmiddel van.
- **Een tweede rechtenmodel.** Wie wat mag blijft bij de rollen waar ze wonen
  (`CONCERN.md`). Deze laag zegt wat de wáárde mag, niet wat de persoon mag.

## 11. Wat er nu staat, en wat er open blijft

Alle zeven stappen uit paragraaf 7 zijn gebouwd, plus de terugstorting (par.
9 punt 3). Elke belofte draagt een toets die door de voordeur gaat, en elke
toets is met een mutatie zien zakken — het plafond weghalen, de laag
loskoppelen, reserveringen weer uitgeefbaar maken, eigen geld eerst opmaken, de
genretoets weer fail-open zetten, de grens aan de wallet hangen, de uitbetaling
het hele saldo laten nemen, interne verplaatsingen als uitgave tellen, de
afstemming laten doen alsof, de mod-97-toets vervangen door een vormcontrole, de
wachttijd op een gewijzigde rekening weghalen. Wat niet zakt, is niet vastgelegd.

## 10a. De terugstorting

Het lid vraagt zijn geld terug; het staat meteen van zijn saldo af en gaat de
opdrachtenrij in. Drie routes: `/api/pay/terugstand` (wat kan er, en wat mist
er nog — met een reden per blokkade, zodat een scherm nooit een knop zonder
uitleg hoeft te tonen), `/api/pay/rekening` en `/api/pay/terug`.

**Snel** is de afboeking, niet de SEPA. Die kan het niet zijn, dus zegt het
antwoord "staat klaar om verstuurd te worden" en nooit "gelukt" — bij een
timeout van de rail weten we juist niet of hij is aangekomen. De opdrachtenrij
(`kern/betaalopdracht/`) blijft hem met dezelfde idempotentiesleutel aanbieden.

**Veilig** is vier dingen, en alleen het eerste gaat over tikfouten:

| Grendel | Tegen wat |
|---|---|
| mod-97 op het IBAN | een tikfout die een vormcontrole doorlaat |
| het IBAN in de identiteitskluis | een rekeningnummer naast een codenaam voert die terug naar een echte naam |
| wachttijd op een **wijziging** | accountovername — de aanvaller zet zijn eigen rekening erin |
| alleen het **beschikbare** deel | uitbetalen wat al gereserveerd of geoormerkt was |

Die derde is de belangrijkste, en de plaatsing telt: de klok staat op het
**wijzigen** en niet op het instellen. Een wachttijd op de eerste registratie
zou alleen eerlijke mensen hinderen — dat account heeft net de paspoortpoort
gehaald. De aanval is het veranderen van de bestemming op een account dat al
saldo heeft, en daar kost hij een dag waarin de eigenaar kan ingrijpen.
Terugzetten naar een eerder IBAN start de klok opnieuw, anders is hij te
omzeilen door er een dag iets anders in te zetten.

**Efficiënt**: geen kosten erbij, en met opzet geen batch. Een lid dat te horen
krijgt dat zijn geld morgenochtend in een verzamelrun meegaat, heeft geen snelle
terugstorting.

**Wat open blijft, en bewust niet stilletjes is opgelost:**

- ~~**De snelle weg om de wachttijd over te slaan.**~~ **Gevoed.** Bevestigt de
  aanbieder bij een oplading vanaf welk IBAN er is betaald, dan is dat IBAN
  bewezen van dit lid en vervalt de wachttijd: hij haalt zijn geld terug naar de
  rekening waarvandaan het kwam. `server/betaal/betaler.js` leest het uit,
  `kern/settlement.js` bevestigt het bij de juiste persoon.

  Alleen **Mollie** levert een volledig IBAN (`details.consumerAccount`). Stripe
  geeft bij iDEAL enkel `iban_last4` — vier cijfers zijn geen IBAN en mogen er
  niet voor doorgaan; Adyen levert het in de notificatie en niet op het object
  dat wij ophalen. Dat verschil staat in de code met zoveel woorden, want "geen
  betalerIban" leest anders als een storing terwijl het bij twee van de drie de
  normale uitkomst is.

  **De veiligheid zit in wat het níet doet:** een bevestiging ZET nooit een
  bestemming, hij bevestigt er alleen een die het lid zelf heeft ingevoerd.
  Anders is een nagebootste providermelding genoeg om geld om te leiden, en dan
  is de wachttijd een slot naast een openstaande achterdeur.
- **De afstemming met de betaaldienst.** Het bewijsbord zegt eerlijk dat hij
  nooit is gedaan. Dat oplossen vraagt het echte afschrift ophalen en regel voor
  regel vergelijken — een eigen stuk werk, geen vinkje.
- **De noodstanden** (par. 9 punt 8). De betaalstop is nog alles-of-niets.
- **De schermen.** Alles hierboven is server en API; er is nog geen enkel scherm
  dat een portefeuille, een treasury-bord of een bewijsbord toont. Dat is met
  opzet zo gelaten: `ONTWERP.md` beslist hoe die eruitzien, en een scherm bouwen
  op een laag die nog kon schuiven zou tweemaal werk zijn geweest.

## 12. De lat

Zeven regels. Ze zijn de maatstaf waaraan elke nieuwe geldfunctie hier wordt
gehouden, en ze zijn opzettelijk zo geschreven dat je kunt zien wanneer je zakt.

> Geen waarde zonder eigenaar.
> Geen saldo zonder verplichting.
> Geen beweging zonder bevoegdheid.
> Geen bevoegdheid zonder beleid.
> Geen externe settlement zonder reconciliatie.
> Geen kritieke status zonder vers bewijs.
> Geen automatisering zonder begrensde verantwoordelijkheid.

En daaronder de gebruikerskant, die net zo hard telt: achter de schermen mag dit
zo ingewikkeld zijn als het onderwerp vraagt, maar een lid ziet zijn saldo en
drie regels van vandaag, en een ondernemer ziet één bedrag en of alles normaal
werkt. Ingewikkelde regels, eenvoudige bediening — de complexiteit wordt door
RTG geabsorbeerd en niet doorgegeven.
