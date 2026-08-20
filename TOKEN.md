# TOKEN.md — een eigen betaaltoken bij RTG

Vraag van Rahul (20 augustus 2026): *wat kan RTG met een eigen betaaltoken, en
welke functies en opties hebben we aan de crypto- en de bankkant?*

Dit document is het antwoord, en het staat naast `GELD.md` zoals `GELDLAT.md`
dat doet: GELD.md gaat over het financiële besturingssysteem, GELDLAT.md over
het contract van een financiële mutatie, en dit over de **geldvorm zelf** — wat
een token hier mag zijn, wat hij nooit mag worden, en wat elke stap kost.

## 0. De kern, in één zin

> RTG heeft al een eigen betaaltoken, hij heet RTG Pay, en de vraag is niet of
> we er een bouwen maar of we hem uit het gesloten circuit halen — want dat is
> de grens tussen een besluit en een vergunning.

## 1. Wat er al staat

| Laag | Waar | Wat het is |
|---|---|---|
| **RTG Pay** | `server/kern/pay/` | Wallet per lid op een dubbel grootboek; de som van alle saldi is exact nul. Opladen, p2p, Klompjes, tik, kascode, kassa, partnersaldo, tegoed. Idempotentie die een herstart overleeft. |
| **RTG Bank** | `server/kern/bank/` + `bankregie/` | Tweede eigen grootboek: rekeningen met IBAN, sparen, passen, krediet, SEPA, incasso, salarisrun. Drie standen (partner/hybride/eigen), vier ogen bij opschalen, nood-fallback. |
| **Walletbrug** | `kern/bank/walletbrug.js` | Het enige pad dat twee grootboeken tegelijk raakt, met handmatige terugdraai. |
| **Munt-ontvangst** | `server/muntbetaal.js` + `kern/munten.js` | Crypto **erin**: BTC/ETH/USDC/USDT, gelockte koers met vervaldatum, HMAC-webhook, `volledig`-vlag. Staat standaard uit (`MUNT_AAN=1`). |
| **Feestmunten** | `kern/wallet.js` | Een tweede, kleinere token: saldo per zaak, `€3,50` per munt, nooit onder nul. |
| **RTG-punten** | `kern/ervaring/leden/punten.js` | Verdiend (1 punt per € 10), en verzilverbaar naar **tegoed met een vaste koers**: 100 punten = € 10, automatisch verrekend bij de volgende betaling. |
| **Cadeaukaarten** | `routes/member/boeken.js`, `routes/supplier/kassa/` | Een kaart met saldo bij één zaak, in de app of aan de kassa gekocht, inwisselbaar aan diezelfde kassa. |
| **Bevoegdheid** | `kern/bevoegdheid/lijst.js` | Wat RTG zelf mag, per handeling, met de rang die het vraagt. |

## 2. De bevoegdhedenlijst is de scheidslijn

Drie rangen: **betaalinstelling < elektronischgeldinstelling < bank**. Twee
regels bepalen alles wat hierna volgt:

```
GELD_UITGEVEN: 'Eigen geld in omloop brengen'
               eigenNodig: 'elektronischgeldinstelling', partnerRail: null

WALLET_SALDO:  soort 'besluit' — gesloten circuit met harde plafonds,
               niet uitbetaald aan het lid, alleen binnen RTG besteedbaar
```

Alles wat binnen `WALLET_SALDO` past, kan vandaag gebouwd worden. Alles wat
eruit stapt, is `GELD_UITGEVEN` en vraagt een vergunning — en er is geen
partnerrail die dat voor ons doet.

## 3. De vier soorten token

### 3.1 Gesloten tegoed — dit hebben we, hier kan veel meer in

De euro-cent in een RTG-wallet is een token: hij ontstaat alleen tegen een
echte betaling, hij beweegt alleen binnen het stelsel, en hij verdwijnt alleen
tegen een echte uitbetaling. Wat er zonder één nieuwe vergunning nog bij kan:

- **Tegoed voor een ander** (gebouwd, zie par. 4) — kopen, code doorgeven,
  verzilveren.
- **Zakelijk tegoed** (gebouwd, zie par. 4) — een zaak zet tegoed klaar voor
  personeel of klanten; zelfde bon, andere betaler.
- **Tegoed met een reden** — een bon die weet waarvoor hij bedoeld was, als
  label en niet als grendel (zie de grens hieronder).
- **Terugkerend tegoed** — maandelijks een bedrag klaarzetten; alleen op het
  niveau *klaarzetten* uit GELD.md par. 3, nooit automatisch.

**De grens die hier écht ligt: een bestemming kan niet.** "Alleen te besteden
aan Reizen" vraagt een tweede saldo-dimensie in het grootboek. Zodra tegoed is
verzilverd is het gewoon walletsaldo, en walletsaldo is inwisselbaar voor
alles. Een bestemming zou dus op elk betaalpad in het hele huis gecontroleerd
moeten worden — en half doen zet een belofte op het scherm die de boeking niet
waarmaakt.

### 3.2 Punten — en de correctie op wat hier eerst stond

Hier stond dat punten "verdiend in plaats van gekocht, niet inwisselbaar voor
geld, geen euro-koers" zijn en daarmee buiten elk financieel toezicht vallen, en
dat dit de goedkoopste nieuwe vorm zou zijn. **Dat klopte niet, op twee
manieren.** Er bestaan hier al RTG-punten, en die zijn wél inwisselbaar tegen
een vaste koers: 100 punten worden € 10 tegoed, dat bij de volgende betaling
automatisch wordt verrekend (`kern/ervaring/leden/punten.js`). Het is dus geen
nieuwe vorm en het staat niet buiten toezicht — het is dezelfde soort aanspraak
als het walletsaldo, alleen was hij nergens vastgelegd.

Wat wel waar blijft: **punten zelf zijn geen geld.** Zolang je ze verdient en ze
nergens in omgezet kunnen worden, is er geen koers en geen aanspraak. De grens
ligt bij het VERZILVEREN, en daar begint alles wat par. 3.1 over gesloten tegoed
zegt.

Twee huisregels raken een puntenlaag hoe dan ook: geen verslavende
engagement-patronen (`CLAUDE.md`), en de progressielaag stopt bij 18+
(`kern/spellen/grens.js`) — een puntensaldo dat een prestatie buiten het potje
bewaart, hoort achter `progressieMag`. Het huidige puntensaldo doet dat niet:
het bewaart een BESTEDING en geen prestatie, en valt daarmee buiten die grens.

### 3.3 Echte e-money (1 RTG = € 1, inwisselbaar)

Dit is wat "eigen betaaltoken" strikt betekent: uitgifte tegen ontvangen geld,
1:1 gedekt op safeguarded accounts, op elk moment à pari terug te vragen. Dat
is `GELD_UITGEVEN` en vraagt een EMI-vergunning bij DNB — of een
distributie-constructie waarbij een vergunninghoudende EMI uitgeeft en RTG de
ervaring levert.

Let op wat er nu is vastgelegd: `partnerRail: null`. De lijst zegt daarmee dat
geen enkele partner dit voor ons kan doen, terwijl distributie namens een EMI
juridisch wel bestaat — precies het patroon dat bij pasuitgifte al wél is
opgeschreven (`partnerRail: 'passen'`). Dat is een **besluit dat openstaat**,
zie par. 7.

### 3.4 Een token op een publieke chain

Dit is de enige vorm die tegen de huisregels ingaat, en `docs/de-lijn.md` zegt
waarom in twee zinnen: zelf wallets of sleutels beheren breekt regel 1 (nooit
eigen cryptografie) en maakt RTG een vergunningplichtige crypto-dienstverlener
(CASP) onder MiCA, met whitepaper-plicht en custody-risico erbovenop.

Hetzelfde geldt voor crypto **eruit**: nu komen munten alleen binnen en gaan ze
meteen naar euro via de aanbieder. Zodra RTG in munten zou uitbetalen of
wisselen, is het een wisselkantoor en geen handelaar meer.

## 4. Wat er in deze ronde is gebouwd

**Het plafond per wallet** (`kern/pay/stand.js`, `index.js`, `opladen.js`).
Het besluit onder `WALLET_SALDO` beroept zich op "een maximum per wallet en per
boeking". Alleen de tweede helft bestond: `MAX_CENTEN` (€ 5.000) begrensde de
boeking, het maximum per wallet stond nergens. Er staat nu `WALLET_MAX`
(€ 10.000), en hij valt op drie plekken: in `boek()`, in `boekAsync()` vóór de
motor wordt gebeld, en in `laadOp()` vóór de kaart wordt belast. Die laatste is
de belangrijkste — een plafond dat pas in de boeking valt, laat de kaart eerst
betalen. Het autolaadpad laadt exact het tekort als de afronding op tientjes er
niet meer bij past, zodat een bijna volle wallet gewoon blijft betalen.

**De feestmunt wordt betaald** (`kern/wallet.js`). `muntKoop()` verhoogde het
saldo en gaf een prijs terug — en inde niets. Honderd munten tegelijk uit het
niets, één laag boven een grootboek dat precies dat verbiedt. Kopen loopt nu
via `pay.huisIn` naar de huisrekening, met autolaad eromheen, en de route staat
achter dezelfde eenmalige paspoortpoort als de rest van RTG Pay — zonder die
poort was dit de enige plek waar een lid zijn wallet kon uitgeven zonder hem
ooit te hebben laten zien.

**Tegoed voor een ander** (`kern/pay/tegoed.js`, `/api/pay/tegoed/*`). Kopen
zet het geld vast op een escrow-rekening (`extern:tegoed`), verzilveren haalt
het eruit naar de wallet van de ontvanger. Een bon kan op naam staan of vrij
zijn, verloopt na een jaar, en verlopen tegoed gaat **terug naar de koper** en
niet naar RTG: niet-opgehaald geld dat in huis blijft is inkomen dat ontstaat
doordat iemand iets vergat. Het gebeurt bovendien niet vanzelf — de koper
drukt zelf, want een leesactie die geld verplaatst bestaat hier niet.

**Tegoed vanuit een zaak** (`kern/pay/tegoed-zaak.js`,
`/api/supplier/pay/tegoed/*`). Dezelfde bon met een andere betaler, en precies
twee verschillen. Een zaak heeft **geen autolaad**: zijn saldo is echte omzet,
er staat geen kaart achter die bijspringt, dus te weinig is gewoon te weinig.
En klaarzetten is van de **manager**, om dezelfde reden als uitbetalen — het
haalt geld uit de kas op een moment dat de eigenaar niet koos. Kijken blijft van
iedereen; dat is het werk.

**Tegoed op het scherm** (`public/apps/pay.html`). Een eigen deel "Tegoed voor
een ander" met drie kaarten: klaarzetten (met de code die je doorgeeft),
verzilveren, en wat jij hebt klaargezet en nog niet is opgehaald. Wat er voor
JOU klaarstaat is één knop — een tegoed op naam hoef je niet over te tikken.
Uitzonderingsgestuurd: de twee lijstvakken bestaan alleen zolang ze iets te
zeggen hebben.

**De zaakkant heeft nu een scherm** (`public/apps/zaakpay.html`), en dat was
ouder werk dan het tegoed: heel `/api/supplier/pay/*` — innen, saldo,
uitbetalen — had er nooit een gehad; de kassa gebruikte alleen de betaalcode van
het lid. Er staat nu één werkplek-scherm met vier dingen: het saldo van de kas
als enige ceremoniële KPI, innen met de code van het lid, uitbetalen naar de
bank, en tegoed klaarzetten en terugnemen. Bereikbaar vanaf `kantoor.html`.

Twee keuzes daar zijn het opschrijven waard. De knoppen die alleen een manager
mag gebruiken worden **getoond en niet verborgen**: wie ze niet mag gebruiken
leest de weigering van de server, in plaats van te raden waar ze zijn — dezelfde
lijn die de premium-standen in RTG Geld al volgen. En de **richting** van een
boeking (plus of min) wordt uit de rekeningnaam afgeleid: `/api/supplier/pay/overzicht`
geeft alleen rijen die deze partnerrekening raken, dus precies één van de twee
kanten is een `partner:` — zo hoeft het scherm zijn eigen code niet te kennen.

**De punten waren al geld, en dat stond nergens**
(`kern/ervaring/leden/punten.js`, afgesplitst van `spaarpot.js`). Verzilverde
punten zijn een bedrag in euro's dat het lid van RTG tegoed heeft, tegen een
vaste koers. Het stond in **euro's als drijvende komma**, kende **geen plafond**
en de schakelaar van `/api/punten` hing aan **geen enkel vermogen** uit de
bevoegdhedenlijst. Er stond ook geen enkele toets op. Alle drie zijn gerepareerd:
centen, een plafond (€ 500), en `vermogen: 'WALLET_SALDO'` op de
functie-schakelaar, zodat de handeling aan hetzelfde vastgelegde besluit hangt
als de wallet. Een bestaande installatie wordt bij de eerste lezing één keer
omgerekend.

**Een cadeaukaart in de app kostte niets.** `/api/giftcard/buy` maakte een kaart
met saldo aan, meldde de zaak "Cadeaukaart verkocht", en inde niets — terwijl
die kaart aan de kassa van diezelfde zaak inwisselbaar is
(`/api/supplier/giftcard/redeem`) en in `kern/fiscaal` als verplichting op zijn
balans komt. Een lid kon dus gratis een kaart van € 5.000 maken en die uitgeven;
de zaak bleef met de schuld zitten. Kopen loopt nu via een nieuw pad
`pay.partnerIn` (`kern/pay/partner.js`): lid → zaak, met autolaad en met de
betaaldienstkosten net als aan de kassa. De kassa-variant
(`/api/supplier/giftcard/sell`) blijft ongemoeid — daar staat de klant aan de
balie en rekent de kassa af.

Dat laatste bracht nog een fout aan het licht die de toets vond en ik niet:
de betaling was idempotent, de KAART niet. Een dubbeltik schreef één keer af en
muntte twee kaarten. De sleutel staat nu op de kaart.

Getoetst in `test/paytegoed.test.js`, `test/paytegoed.e2e.js`,
`test/zaakpay.e2e.js`, `test/punten.test.js` en `test/zorgwallet.test.js`, elke
bewering met een mutatie die is zien zakken. Eén grendel staat er bewust
zonder toets bij: `vanSoort` op de bon, dat een zaakcode scheidt van een
codenaam. Het geval waarvoor hij bestaat (een zaakcode die toevallig gelijk is
aan een codenaam) is met de proefinlog niet na te bootsen, en dat staat in de
kop van het bestand zodat niemand hem "overbodig" noemt.

## 5. Wat er bewust NIET komt

- **Een token op een publieke chain**, en geen eigen wallets of sleutels. Zie
  par. 3.4 en `docs/de-lijn.md` regel 1.
- **Crypto eruit.** Munten komen binnen en worden meteen euro; wisselen en
  uitbetalen in munten maakt ons een CASP.
- **Een bestemming op tegoed** die als grendel werkt. Zie par. 3.1.
- **Een koers.** Eén RTG-cent is één eurocent, altijd. Een token met een eigen
  koers is een belegging, en beleggingsadvies staat in `GELD.md` par. 7 op de
  lijst van dingen die hier niet sluipenderwijs bij komen.
- **Tegoed dat verjaart ten gunste van RTG.** Zie par. 4.

## 6. Faseplan

| Fase | Wat | Status |
|---|---|---|
| 1 | Walletplafond, feestmunt via Pay, tegoed voor een ander en vanuit een zaak (kopen, verzilveren, vervallen, terugnemen) | gebouwd |
| 2 | Tegoed op het scherm van het lid (`apps/pay.html`) | gebouwd |
| 2b | De zaakkant op een scherm (`apps/zaakpay.html`): saldo, innen, uitbetalen én tegoed | gebouwd |
| 3 | De bestaande punten kloppend: centen, een plafond, een vermogen, en toetsen. Plus de cadeaukaart die niet betaald werd | gebouwd |
| 3b | Het punten-tegoed door het pay-grootboek laten lopen. **Geblokkeerd**: dat kan pas als bestellingen, rekeningen en ritten zélf via RTG Pay betaald worden, en dat doen ze niet (par. 7) | — |
| 4 | Het besluit over de bank-uitgang (par. 7) | genomen: brug is eenrichtingsverkeer |
| 5 | E-money, eigen of via distributie. Begint niet met code maar met een vergunning | — |
| 6 | De handelslaag betaalt via RTG Pay (bestelling, rekening, rit), annuleren boekt terug, en verzilveren landt in de wallet | gebouwd |

Geen fase begint voordat de vorige zijn toetsen heeft (LAT.md).

## 7. De besluiten die openstaan

Alle vijf zijn genomen. Ze blijven staan met hun uitkomst, want een besluit
waarvan de reden verdwijnt, wordt over een jaar opnieuw gevoerd.

1. ~~De bank-uitgang~~ — **besloten op 20 augustus 2026: de walletbrug wordt
   eenrichtingsverkeer.** Geld mag van een eigen bankrekening naar de wallet,
   niet andersom (`kern/bank/walletbrug.js`). Daarmee is de tweede voorwaarde
   onder het besluit geen belofte meer maar een grendel, en kan de leden-bank
   live zonder dat `WALLET_SALDO` van soort wisselt. Wat het kost, en dat hoort
   erbij: een lid kan zijn walletsaldo niet naar zijn eigen rekening halen. Dat
   is geen functie die verdwijnt maar een belofte die waar wordt gemaakt — het
   besluit zei dit al, alleen deed de code het niet. Wie de brug weer opent,
   opent daarmee de vergunningsvraag.
2. ~~Mag een partner e-money voor ons uitgeven?~~ — **besloten op 20 augustus
   2026: `partnerRail: null` blijft staan.** Geen distributie-route in de lijst
   zolang er geen gesprek met een EMI loopt. De lijst hoort te zeggen wat waar
   is, niet wat zou kunnen; komt die route er ooit, dan is één regel in
   `kern/bevoegdheid/lijst.js` genoeg.
3. ~~De gouden tekst op `apps/pay.html`~~ — **gedaan.** Alle gouden TEKST op
   `pay.html` staat nu op `--rtg-leesgoud`, plus de focusring op beide
   pay-schermen. Gemeten op de champagne-kaart (`#F9F6F2`, wit 42% over
   parelmoer): de vaste toon haalt **2,94:1** en zakt daarmee zelfs voor grote
   tekst; de leesbare toon haalt **4,51:1** en haalt de 4,5 voor kleine tekst. Wat op de vaste `--gold` blijft is geen tekst: kaartranden, de
   achtergrond van de springlink en het vinkje. Zonder gekozen thema verandert
   er niets, want `--rtg-leesgoud` bestaat alleen mét een thema.
4. ~~Het punten-tegoed is een tweede saldo naast RTG Pay~~ — **gedaan, en de
   weg ernaartoe was inderdaad de verbouwing.** Hier stond dat de voorwaarde
   ontbrak: **de drie betaalpaden die het tegoed verrekenen, verplaatsten zelf
   geen geld.** `betaalOrderVoor`, `betaalRekeningVoor` en `betaalRitVoor`
   zetten `paid = true`, schreven een factuur en stuurden een bericht — er kwam
   geen `pay`, geen betaal-naad en geen boeking aan te pas. Er stond "betaald"
   op het scherm en er was nooit iets geboekt. Dat is nu omgedraaid, in deze
   volgorde:

   **Eerst betalen, dan pas de vlag.** De drie paden lopen via
   `kern/pay/zaakbetaling.js`. Dat is een DRIEHOEK en geen overboeking: het lid
   betaalt zijn deel aan de zaak, en wat RTG weggeeft (ledenvoordeel, oud
   punten-tegoed) legt RTG er vanuit de huisrekening bovenop — want de belofte
   van dit huis is dat de zaak áltijd het volle bedrag ontvangt. De twee
   boekingen zijn alles-of-niets; lukt de tweede niet, dan gaat de eerste met de
   hand terug, net als in `kern/bank/walletbrug.js`. Mislukt de betaling, dan
   blijft de bestelling onbetaald en komt het verrekende tegoed terug — ook bij
   een HERHALING met dezelfde idem-sleutel, want dat antwoord is `ok` en wie
   alleen op `.error` kijkt, laat het lid daar stil tegoed verliezen.

   **En annuleren boekt echt terug.** Dat pad meldde "€ x retour" zonder ooit
   iets over te maken. Dat kon zolang er ook niets was betaald; nu zou dezelfde
   regel betekenen dat de zaak het geld houdt. Het gaat terug waar het vandaan
   kwam — het deel van het lid naar de wallet, het deel van RTG naar de
   huisrekening — en alleen voor wat een `payBetaaldCenten`-marker draagt, zodat
   oudere transacties en nog niet omgezette paden zich precies gedragen zoals ze
   deden.

   **Daarna pas kon het tweede saldo weg.** Verzilveren landt nu in de WALLET
   (`extern:treasury` → `lid:…`) in plaats van in `tegoedCenten`. Dat kon niet
   eerder: zolang de drie paden geen geld verplaatsten, was verzilverd tegoed in
   de wallet juist ONbesteedbaar. `pasTegoedToe` blijft staan om saldi van vóór
   deze ronde leeg te laten lopen — bestaande leden hun tegoed afpakken is geen
   opruiming — en niets vult dat veld nog. Loopt de laatste rekening leeg, dan
   kan die functie weg en is de laatste plek verdwenen waar twee saldi naast
   elkaar bestonden.

   **Wat het kost, en dat hoort erbij:** een betaling boven de boekingsgrens van
   RTG Pay (€ 5.000) weigert nu, met die reden. Dat is een bekende grens en geen
   bug; een rekening daarboven bestaat en heeft nog geen weg.

5. ~~De bedragen van de twee plafonds~~ — **gedaan: ze zijn van de boardroom.**
   Ze stonden als constante in de code (`kern/pay/stand.js` en
   `kern/ervaring/leden/punten.js`) en waren daarmee alleen te verzetten door
   een programmeur, terwijl het juist het soort getal is dat een bestuurder
   hoort te kiezen. Ze wonen nu in `kern/bankregie` — dezelfde kamer waar de
   vergunning wordt vastgelegd, want wie het plafond verzet, verzet de grond
   onder hetzelfde besluit — en staan in de bankkamer met de zin erbij wat het
   kost. Drie dingen zijn eraan vastgelegd: een wijziging telt **meteen**
   (per boeking gelezen, niet bij het opstarten), de ondergrens van het
   walletplafond is **gelijk aan de grootste toegestane boeking** (lager en een
   lid kan een betaling niet meer bijladen — een toets legt die twee getallen
   naast elkaar), en een kapotte koppeling **sluit** het plafond in plaats van
   het te openen. Wat de bedragen zijn blijft een keuze:

   € 10.000 per wallet en € 500 aan punten-tegoed blijven de standaard, en het
   blijven verdedigbare keuzes en geen wettelijke getallen. **Let op wat punt 4
   met de tweede deed:** nu verzilveren in de wallet landt, vult niets het
   punten-tegoed nog, dus dat plafond bewaakt alleen de saldi van vóór die
   verandering. Het walletplafond doet sindsdien het werk dat beide deden. Wie het
   walletplafond verhoogt, verzwakt de grond onder het besluit. Het
   puntenplafond hoort bij een besteding van € 50.000 en is dus ruim; lager
   zetten raakt echte leden eerder dan je denkt. Het verschil met hiervoor is
   dat dat nu een besluit van de boardroom is en niet van een commit.
