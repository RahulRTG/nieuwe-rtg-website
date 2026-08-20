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

### 3.2 Punten zonder geldwaarde

Verdiend in plaats van gekocht, niet inwisselbaar voor geld, geen euro-koers.
Valt buiten elk financieel toezicht en is daarmee de goedkoopste nieuwe vorm.
Twee huisregels raken hem wel: geen verslavende engagement-patronen
(`CLAUDE.md`), en de progressielaag stopt bij 18+ (`kern/spellen/grens.js`) —
een puntensaldo dat een prestatie buiten het potje bewaart, hoort achter
`progressieMag`.

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

**De zaakkant heeft géén scherm, en dat is ouder dan deze ronde.** Heel
`/api/supplier/pay/*` — innen, saldo, uitbetalen — heeft nooit een eigen scherm
gehad; de kassa gebruikt alleen de betaalcode van het lid. Een tegoedpaneel voor
een zaak zou dus het eerste stuk van een scherm zijn dat er niet is, en dat is
eigen werk en geen bijvangst hier.

Getoetst in `test/paytegoed.test.js`, `test/paytegoed.e2e.js` en
`test/zorgwallet.test.js`, elke bewering met een mutatie die is zien zakken. Eén grendel staat er bewust
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
| 2b | De zaakkant op een scherm. Dat vraagt eerst een RTG Pay-scherm voor een zaak, want dat bestaat helemaal niet — zie par. 4 | — |
| 3 | Punten zonder geldwaarde, achter `progressieMag`, met de anti-engagement-regel als ontwerpkader | — |
| 4 | Het besluit over de bank-uitgang (par. 7) en, als dat valt, de vergunningsroute | — |
| 5 | E-money, eigen of via distributie. Begint niet met code maar met een vergunning | — |

Geen fase begint voordat de vorige zijn toetsen heeft (LAT.md).

## 7. De besluiten die openstaan

Vier dingen kan software niet voor Rahul beslissen. Ze staan hier zodat ze niet
als weglating in de code zitten.

1. **De bank-uitgang raakt de grond onder `WALLET_SALDO`.** Het besluit zegt dat
   walletsaldo *niet wordt uitbetaald aan het lid*. Dat klopt vandaag. Maar
   zodra RTG Bank voor leden live gaat, bestaat de keten wallet → walletbrug →
   eigen rekening → SEPA naar buiten. Dan is walletsaldo wél uitbetaalbaar en
   vervalt een van de drie voorwaarden. Dit is precies het geval dat het besluit
   zelf benoemt ("dan hoort dit vermogen van soort te wisselen"). Te beslissen
   vóór de bank opengaat, niet erna.
2. **Mag een partner e-money voor ons uitgeven?** `GELD_UITGEVEN` staat op
   `partnerRail: null`. Als distributie namens een vergunninghoudende EMI een
   route is die we openhouden, hoort dat in `kern/bevoegdheid/lijst.js` te
   staan — dat bestand is een besluit, geen implementatiedetail, dus het is niet
   stilzwijgend aangepast.
3. **De gouden tekst op `apps/pay.html` leest niet in elk thema.** Dat scherm
   zet zijn eigen `--gold:#A98F1C` en gebruikt die ook als tekstkleur. Op het
   champagne-thema haalt die toon **2,76:1** op een lichte kaart — onder de 4,5
   die kleine tekst vraagt en onder de 3,0 voor grote. `rtg-themas.css` houdt
   daar `--rtg-leesgoud` voor bij; het nieuwe tegoed-deel gebruikt die, de
   oudere gouden teksten op dat scherm (de kascode, de statuslabels, het
   woordmerk) nog niet. Dat is een ronde over dat hele scherm, en die hoort
   bewust genomen te worden in plaats van als bijvangst.
4. **Het bedrag van het plafond.** € 10.000 per wallet is een verdedigbare
   keuze, geen wettelijk getal. Wie hem verhoogt, verzwakt de grond onder het
   besluit; wie hem verlaagt onder € 5.000 breekt het autolaadpad (zie de
   toelichting in `kern/pay/stand.js`).
