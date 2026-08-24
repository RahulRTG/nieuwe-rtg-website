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
4. **De persoonlijke geldgrens.** `kern/geldbeleid/` kent al regels; de poort
   kent al `eigenBeleid`. Ze moeten aan elkaar. Een eigen grens is dan een
   weigering en geen waarschuwing — anders is het geen grens.
5. **De waardegraaf.** Volgen waar een euro heen ging, voor het lid en voor de
   ondernemer. `kern/geldgraaf/` is de plek; de vorm staat daar al vast.
6. **Treasury voor ondernemers.** Btw-reservering, payroll-reservering,
   settlementbeleid. Leunt volledig op stap 1: dit ís reserveren, maar dan van
   een zaak.
7. **Bewijs per geldfunctie.** Zie hieronder.

## 8. Bewijs boven status

Een statusbord dat "werkend" zegt, zegt niets — het zegt alleen dat niemand
heeft gekeken. Dit huis heeft daar al een antwoord op (`TOEZICHT.md`,
`BEWIJS.md`, `WETTEN.json`, de ketenronde), en geld is de zwaarste keten die dat
bewijs moet leveren (`GELDLAT.md`).

Elke kritieke geldfunctie hoort daarom niet groen te zijn maar **bewezen**, met
de leeftijd van dat bewijs erbij: sluitend grootboek, plafonds zonder
overtreding, afstemming met de betaalpartner, herstelproef. Een bewijs dat is
verlopen hoort "niet bewezen" te zeggen en niet groen te blijven staan. Een CFO
ziet dan niet alleen zijn geld, maar hoe zeker RTG weet dat het klopt.

## 9. De grenzen

Deze staan hier zodat ze het niet stilzwijgend afleggen tegen een functie.
Botst een functie met een grens, dan **vervalt de functie**.

1. **Geld verlaat het huis nooit autonoom.** `GELD.md` par. 3 blijft onverkort
   staan. Betalen, opzeggen en alles wat een derde raakt is maximaal
   "klaarzetten"; bevestigen doet een mens.
2. **Er komt geen tweede boekhouding.** De waardelaag boekt niet en houdt geen
   saldo bij. Een reservering is geen boeking. Een geldscherm dat een ander
   getal toont dan de wallet is erger dan geen geldscherm.
3. **Uitbetaalbaar is de uitzondering, niet de instelling.** Er is één klasse
   die het huis mag verlaten, en die hangt aan een vergunning. Wordt
   walletsaldo ooit uitbetaalbaar aan het lid, dan vervalt de grond onder
   `WALLET_SALDO` en is dit vergunningswerk. Dat is geen schakelaar.

   **En hier ligt een open vraag die niet stilzwijgend opgelost mag worden.**
   Het besluit zegt dat walletsaldo "niet wordt uitbetaald aan het lid". Er
   bestaat echter een keten die daar wel op uitkomt: `/api/bank/van-wallet`
   brengt walletsaldo naar een eigen RTG-bankrekening
   (`kern/bank/walletbrug.js`), en `/api/bank/sepa` stuurt vanaf die rekening
   geld naar buiten. Elke stap is op zichzelf verdedigbaar — de eerste blijft
   binnen het huis, de tweede hangt aan de bevoegdheid `SEPA_UIT` die de
   boardroom kan dichtzetten — maar samen zijn ze een uitweg. De poort merkt
   die keten met zoveel woorden als `huisintern` aan
   (`kern/waarde/index.js`) zodat de uitzondering een naam en een reden heeft.
   Er zijn drie uitwegen en het is een keuze welke het wordt: de brug sluiten
   voor `PERSONAL_FUNDED`, de SEPA-rail structureel dicht houden zolang er geen
   vergunning ligt, of het besluit herschrijven zodat het beschrijft wat er
   werkelijk kan. Wat níet mag, is dat het besluit iets anders zegt dan de code
   doet — dat was precies de fout die dit document heeft blootgelegd.
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
7. **Een storing legt de economie niet stil.** De noodstop is er al
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

## 11. De lat

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
