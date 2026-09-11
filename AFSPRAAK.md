# RTG Agreement Fabric

**Eén laag die bestaande contract-, abonnement-, consent-, identiteits-,
rechten-, facturatie- en bewijsfuncties aan elkaar knoopt — zonder de domeinen
plat te slaan tot één generieke overeenkomst.**

De kernregel, en alles hieronder volgt eruit:

> Domeinen houden hun eigen betekenis. RTG deelt alleen bewijs, identiteit,
> levenscyclus, rechten en opvolging.

Dit is een **richtingsdocument**, zoals `ECONOMIE.md`, `TRAVELCOMMERCE.md` en
`HDI.md`. Per onderdeel staat erbij of het **staat**, **een stap weg** is, **een
besluit vraagt**, of **jaren weg** is. Die vier zijn niet uitwisselbaar, en ze
staan er juist omdat een visiedocument zonder die kolom binnen een maand als
functielijst wordt gelezen.

`COMMERCIE.md` is de laag eronder die vandaag draait (catalogus, pricing,
contract, verbruik); `CONTROLPLANE.md` zegt wie iets mag; `PROOF.md` wat bewijs
is. Dit document zegt hoe die drie één keten worden.

---

## 1. De correctie die aan alles vooraf ging

De eerste formulering was *"bouw ondertekenen en abonnementen"*. Dat is gemeten
en het was de verkeerde opdracht. De motoren bestaan grotendeels al; het
probleem is dat ze **elkaar nog onvoldoende kennen**.

Drie metingen op 11 september 2026, elk met zijn graad:

| meting | uitkomst | graad |
|---|---|---|
| lezers van de contractstand buiten `kern/commercie/contract.js` | **0** | gemeten (grep over `server/`) |
| aanroepers van `accounts.setTier()` | **1** (het menselijke besluit) | gemeten |
| wekkers die de verlengronde draaien | **0** van 62 | gemeten (`WEKKERS.json`) |
| tekenwegen met een cryptografisch bewijs | **1** van 31 | vermoed, ONDERgrens |
| opslagbakken met iets contractachtigs | **5**, waarvan 1 met twee onverenigbare rijvormen | gemeten |

Dat eerste getal is het hele document. `kern/commercie/contract.js` ís een
volwaardige overeenkomstmotor — acht standen, een expliciete overgangstabel, een
bevroren prijs, `prijsVastTot`, drie verlengingsvormen, dertien toetsen — en
**niets in dit huis vraagt hem iets**. De toegang van een lid hangt aan
`sess.tier`, die één keer omhoog wordt gezet door een mens en daarna nooit meer
beweegt. Een opgezegd contract laat de pas dus staan.

Dat is de fout die `COMMERCIE.md` par. 4 *"een functie zonder beller"* noemt, en
hij is stiller dan een ontbrekende functie: de code ziet er compleet uit en de
toetsen staan groen.

**De eerste opdracht van deze laag is dus bedraden en niet bouwen.**

---

## 2. Geen supertabel — en geen tweede envelop

### 2.1 Waarom er geen `agreements`-tabel komt

Drie onafhankelijke metingen in dit huis zeggen hetzelfde over een type dat je
over domeinen heen legt:

- `OBJECTMODEL.json`: 71% van de velden hoort bij precies één domein, en `Asset`
  bestaat niet — tafel, kamer, podium en leaseauto delen niets buiten hun
  verpakking.
- `COMMERCE.json`: 437 koopbare vormen, **0** domeinen die alle acht werkwoorden
  uitvoeren. Eén protocol met 42 invullingen is geen protocol.
- `KETENVORM.json`: over drie echte ketens **0 van 13** actoren gedeeld en 2 van
  10 beloftethema's in alle drie — en die twee gaan over de MACHINE (mag dit twee
  keer, zegt een weigering waarom) en niet over het domein.

Een arbeidsovereenkomst, een vervoerdersovereenkomst, een RTG-abonnement en een
tafelakkoord delen geen vorm. Een `journeys`-tabel werd in `TRAVELCOMMERCE.md` om
precies deze reden tegengehouden; hier geldt het woord voor woord.

### 2.2 Het woord `envelop` is bezet — en dat is geen detail

Het voorstel noemt het gedeelde object een `AgreementEnvelope`. **Dat is de
naamcollisie waar `SEMANTIEK.json` over gaat**, en hij zit op de centrale naam
van het hele plan.

`server/kern/envelop.js` is de **gebeurtenis**envelop: acht velden, met opzet
gesloten, en zijn dragende regel is dat hij *nooit zegt WAT*. Een tweede envelop
die juist wél over inhoud gaat — prijs, voorwaarden, looptijd, partijen — is
binnen een jaar de 79ste botsing uit `SEMANTIEK.json`. Twee bestanden droegen
allebei een `VERMOGENS` met nul gedeelde leden; dit zou hetzelfde zijn, maar dan
op het woord waar de hele laag naar heet.

**Besluit dat openstaat.** De voorkeur hier is `Afsprakenblad` of `Afspraakkaart`
— een blad dat je naast een domeinobject legt, zonder het te bezitten. Wat het
níét mag heten: `envelop` (bezet, `kern/envelop.js`), `contract` (bezet en
vierdubbel: `mutatiecontract`, `api-contract`, `tenantcontract`,
`bedrijf/contract`), `mandaat` (bezet, `kern/stuur/mandaat.js`), `machtiging`
(bezet, `kern/service/machtiging.js`).

Voor de leesbaarheid hieronder heet het **het blad**.

### 2.3 Wat het blad is — **jaren weg**, en met opzet klein

Het blad bezit niets. Hij is een **projectie** in de vorm van
`kern/levensgraaf/graaf.js`: hij verwijst naar het domeinobject en voegt vijf
dingen toe die in élk domein dezelfde betekenis hebben.

```
blad
  onderwerp        soort + verwijzing   (MEMBER_SUBSCRIPTION, EMPLOYMENT, ...)
  partijen[]       principalRef         (kern/economie/principal.js)
  bewijs           bewijsRef of null MET reden
  geldigheid       vanaf / tot / stand  (uit de domeinmotor, nooit hier bewaard)
  zekerheid        gevraagd / behaald   (kern/identiteit/vertrouwen.js)
  gevolg           rechten[] / geld[]   (verklaard, niet uitgevoerd)
  oorzaak          correlatie + oorzaak (kern/envelop.js, ongewijzigd)
```

Drie dingen die hij NIET doet, en alle drie zijn het een grens:

1. **Het blad kent geen standen van zichzelf.** De stand komt uit de domeinmotor
   — voor een lidmaatschap uit `contract/vorm.js` (acht standen). Een eigen
   `lifecycleState` ernaast is een negende stand en een tweede waarheid.
2. **Het blad bezit geen prijs.** Hij verwijst naar de momentopname die bij het
   contract hoort. Anders zijn er twee bedragen voor één verplichting — precies
   de fout die op 11 september uit `kern/lid/facturen.js` is gehaald.
3. **Het blad is een projectie en nooit een bron.** Wie hem met de hand kan
   bijwerken, heeft de 22ste capabilitylijst gemaakt (`EXECUTIE.md` over de
   executiekaart).

---

## 3. Tekenen wordt een bewijsprotocol — **een stap weg**

### 3.1 De meting

**31 tekenwegen**, geteld op routes die een akkoord vastleggen. Graad `vermoed`,
en het is een **ondergrens**: de meter kijkt rond de routedefinitie, dus werk dat
in een kern-module gebeurt valt erbuiten.

Eén ervan legt cryptografisch bewijs vast: `kern/onboarding/lid.js` hasht
`versie|tekst|naam|wie` met sha-256. De andere dertig mogen hun eigen definitie
van "getekend" hebben — en dat, niet het aantal, is het risico.

### 3.2 De primitive

Eén gedeelde functie waar elke bindende route langs moet, en die als enige een
bewijsregel kan maken. Platformbreed geldt daarna:

> `status = GETEKEND` mag alleen ontstaan als er een geldige bewijsverwijzing is.

Dus niet meer `naam + tijd + status`, maar `status + bewijsRef`.

**Dit is legitiem gedeeld, en het is de uitzondering op par. 2.1.** `OS.md` trekt
de grens tussen **platformvermogen** (mag deze aanroep, en doet hij het) en
**domeinvermogen** (wat voor zaak is dit). *Bewijzen dat een mens akkoord ging*
is platformvermogen, net als betalen en binnenkomen. Het contract van punt 7
bestaat al en staat in het kleinste hoekje van het huis:
`kern/appstore/machtigingen.js`, het enige bestand met een doel én een grens.

### 3.3 Wat er in de ondertekende payload mag — en wat niet

Het voorstel bindt `contentHash`, `termsHash`, `priceSnapshotHash`,
`partySetHash`, intentie, locale, datums en de renderer-versie. Dat is de goede
richting en één correctie hoort erbij:

**De meeste van die 31 wegen hebben geen prijs.** Een leeg veld dat als hash
meegaat, is een getal waar er geen is. Elk veld in de payload is dus
**aanwezig-met-waarde of afwezig-met-reden**, en de reden gaat mee in de hash.
Dat is dezelfde regel als `onbekend` ≠ `openbaar` in `kern/envelop.js` en
`nietGerekend` in de gevolgsimulatie van `TENANT.md`.

### 3.4 De migratie in vijf fasen

Niet één grote herschrijving. De vorm van `commercie/schaduw.js`, dat al bestaat:

| fase | wat | wat er nog niet gebeurt |
|---|---|---|
| 1 observeren | elke tekenweg maakt NAAST zijn eigen opslag een bewijsregel | niets afgedwongen; verschillen gemeten |
| 2 dubbel schrijven | de bewijsregel is verplicht | oude velden blijven |
| 3 lezen uit bewijs | schermen en controles lezen de bewijslaag | oude velden nog gevuld |
| 4 afdwingen | geen geldig bewijs = geen `GETEKEND` | — |
| 5 opruimen | oude velden eruit | pas bij bewezen volledige dekking |

`CONTROLPLANE.md`: *je kunt niet afdwingen wat nooit in de schaduw heeft
gelopen.*

---

## 4. De twaalf objecten, met hun stand

| object | stand | waar, of wat eraan ontbreekt |
|---|---|---|
| Party | **staat** | `kern/economie/principal.js` (`principalRef`), `economie/werelden.js` |
| Offer | **een stap weg** | `commercie/voorstel.js` stelt voor en verplaatst nooit; `pasladder.js` is de ladder. Wat ontbreekt is een aanbod aan een LID |
| Agreement | **staat** | `commercie/contract.js` + `contract/vorm.js`, 8 standen, overgangstabel, 13 toetsen |
| TermsVersion | **een stap weg** | `kern/onboarding.js` + `onboarding/contract.js`: versie loopt op, opnieuw tekenen vereist. Wat ontbreekt is clausuleopbouw en een diff |
| Consent | **staat**, met één gat | `consent-register.js`: 11 lagen gedekt, 9 met reden niet — en het **voorwaarden-akkoord staat in geen van beide** (par. 7) |
| Signature | **1 van 31** | `onboarding/lid.js`. De rest: par. 3 |
| Subscription | **staat (zaak)** / **ontbreekt (lid)** | `commercie/zaakabonnement.js` |
| BillingMandate | **vraagt een besluit** | `bank/incasso.js` is een interne vaste overboeking, geen mandaat AAN RTG. Par. 6 |
| Entitlement | **staat (zaak)** / **ontbreekt (lid)** | `capaciteiten.js` → `routepoort.js` → `opzet/leverancierpoort.js`. Par. 5 |
| Invoice | **staat**, los | `facturatie/motor.js`, `md.invoices`. Sinds 11 sep leest hij niet meer de prijs van vandaag |
| Lifecycle | **staat**, ongepland | `commercie/ronde.js` — bestaat, idempotent op stand, draait op een kantoorknop. Par. 8 |
| EvidenceBundle | **een stap weg** | `lib/keten.js` + `lib/keten-anker.js` staan en zijn beproefd. Par. 9 |

---

## 5. Rechten worden afgeleid — **een stap weg**

De zakelijke kant heeft dit al en het werkt: `zaakabonnement.js` (welke trede) →
`routepoort.js` (welke route vraagt welke capability, langste-pad-eerst) →
`opzet/leverancierpoort.js` (het keelgat waar élke leveranciersroute door moet).

De ledenkant heeft hetzelfde keelgat: `auth()` in `server/opzet/diensten2.js`,
dat daar al twee padtabellen draagt — `lidPadFunctie` voor de eigen boardroom van
het lid, en `bezitsbewijs.zwaarPad` voor zware paden, met `schaduw` als standaard.
**Daar hoort de contractstand in, in diezelfde vorm.** Niet in 213
routebestanden; `kern/commercie/routepoort.js` legt in zijn kop uit waarom.

### 5.1 Geen zesde uitkomstwoordenlijst

Het voorstel laat de beslissing `ALLOW / DENY / SHADOW_ALLOW / DEGRADED /
REAUTH_REQUIRED` teruggeven. Dat is een nieuwe woordenlijst, en er zijn er al:

- `CONTROLPLANE.md`: een besluit kent **acht** uitkomsten, en `ONBEKEND` is met
  opzet géén synoniem van `WEIGEREN` — een storing hoort niet te klinken als een
  overtreding.
- `GEZAGSNOEMER.json`: **5** gezagsvocabulaires, **21** treden, alle herleid tot
  **4** noemertreden (`geen` / `tonen` / `klaarzetten` / `uitvoeren`).

`INTELLIGENTIE.md` INT-01 verbiedt een zesde expliciet. De rechtenbeslissing
gebruikt dus de acht bestaande uitkomsten. `SHADOW_ALLOW` is geen uitkomst maar
een **stand van de handhaving** en woont in `commercie/schaduw.js`, dat er al is.
`DEGRADED` is geen uitkomst maar een **gevolg van de betaalstand** (par. 7).

### 5.2 Rechten zijn per capability en nooit per account

Dit is de reden dat `setTier` niet door een nieuwe booleaan vervangen wordt maar
door een afleiding. Na opzegging moeten sommige dingen juist blijven: facturen,
bewijsstukken, het eigen dossier. *Account-breed afsluiten* is precies de fout
die een opzegging tot een straf maakt.

### 5.3 Snelheid: een gecompileerde projectie

Een rechtenvraag mag niet elke route een zware commerce-query kosten. De bron van
waarheid blijft contract + betaling + identiteit + beleid; daaruit wordt een
projectie berekend die `auth()` leest, met zijn herkomstverwijzingen erbij. Bij
een relevante gebeurtenis wordt hij opnieuw gerekend — nooit met de hand gezet.
Zelfde vorm als `kern/identiteit/vertrouwen.js`, dat met opzet niets bewaart.

---

## 6. Het betaalmandaat is een eigen object — **vraagt een besluit**

Een contract zegt *€20 per maand*. Een mandaat zegt *RTG mag via deze rail en
onder deze voorwaarden innen*. Dat zijn twee dingen, en ze samenvoegen kost later
een herbouw bij SEPA, kaart-recurring, wallet en terugboeking.

Het besluit dat hieraan vooraf gaat staat niet in dit document maar in
`CLAUDE.md`: **de terugstortstand**. Zolang `/api/office/bank/terugstorting` op
`open` staat is RTG uitgever van elektronisch geld en dragen `WALLET_SALDO` en
`LID_UITBETALING` hun rail-gezicht. Een mandaat dat RTG laat innen hangt aan
diezelfde vraag. Bouw hier dus geen pad omheen dat de belofte aan leden verandert
zonder dat de bevoegdheidsvraag meebeweegt.

---

## 7. Wanbetaling is een standenmachine — **jaren weg**

Niet `paid = false`, maar een keten met standen waarvan de overgang uit het
CONTRACTBELEID komt en niet uit code die voor iedereen gelijk is. Een
consumentenabonnement en een zakelijk contract hebben andere termijnen.

De grens die erbij hoort: **een beperking zegt altijd waarom en tot wanneer.**
`GRAMMATICA.md`: een verhindering draagt altijd een reden, en er komt geen grijze
knop zonder uitleg bij.

### 7.1 Het consentgat dat hier dichtgaat

`consent-register.js` dekt 11 lagen en verklaart 9 niet-gedekte met een reden.
Het **akkoord met de voorwaarden staat in geen van beide lijsten**.
`test/consent-dekking.test.js` kan het ook niet vinden: hij zoekt de vorm
`{ key, status: 'actief' }`, en de onderteken-rij is
`{ versie, naam, at, hash }`. De toets zegt in zijn eigen kop dat hij maar één
vorm kent.

Dat is een blinde vlek in een register waarvan de kop luidt *het gevaarlijkste
aan dit scherm is onvolledigheid*. Het voorstel om de scanner een **releasepoort**
te maken — elke bindende capability verklaart `consent: vereist | niet-vereist`,
en bij het tweede is een reden verplicht — is daarmee niet nieuw werk maar de
reparatie van een bestaande meter.

---

## 8. De levenscyclus loopt zelf — **een stap weg**

`commercie/ronde.js` is de motor en hij is goed: idempotent op STAND en niet op
tijd, elk onderdeel in zijn eigen `try`, en hij neemt geen besluiten — hij zet een
contract op `VERLENGBAAR` (er MOET iets gebeuren) en verlengt hem niet.

Wat ontbreekt is de wekker. **62 wekkers in `WEKKERS.json`, en geen enkele draait
deze ronde.** De ronde hangt vandaag aan `POST /api/office/commercie/ronde`, een
knop op kantoor. Maand 13 ontstaat dus alleen als iemand klikt.

Het contract publiceert zijn eigen volgende moment (`volgendeActieOp` +
`volgendeActieSoort`) en een wachtrij maakt alleen die records wakker. Niet
dagelijks alles scannen: dat is sneller en het is ook eerlijker, want een scan die
te lang duurt wordt op een dag uitgezet.

---

## 9. Bewijs: de keten bestaat, het anker niet — **vraagt een besluit**

Dit is de grootste correctie op het voorstel, en het scheelt werk.

Er hoeft geen transparency log gebouwd te worden. `server/lib/keten.js` is de
append-only hashketen (elke regel draagt de hash van de vorige) en
`server/lib/keten-anker.js` is het mechanisme dat **kopafknipping** ziet — het
enige dat een losse hashketen niet kan. Beide zijn beproefd
(`test/keten.test.js`: een ingekorte kop en een herschreven regel worden gevonden).

De kop van `keten-anker.js` zegt zelf waar het ophoudt, en het is geen code maar
een besluit:

> Een anker in dezelfde database is geen anker maar een tweede regel om te
> wijzigen.

**Wat er dus moet gebeuren is het anker naar buiten brengen** — een gescheiden
systeem, een tweede partij, desnoods een uitdraai in een kluis. Dat is een
besluit van de eigenaar met een prijs, geen sprint. Tot dat besluit is genomen
bewijst de keten dat er niet PER ONGELUK iets is verschoven; niet dat een
vastberaden beheerder is tegengehouden. Die twee mogen op geen enkel scherm
hetzelfde heten.

Geen blockchain. De kop van `keten.js` legt uit waarom dat het probleem niet
oplost dat hier speelt.

---

## 10. Zekerheid hangt aan de handeling — **een stap weg**

`kern/identiteit/vertrouwen.js` ís de assurance-ladder: **vijf standen** met een
rang (`onbekend` 0, `kennis` 1, `tweefactor` 2, `bezit` 3, `gebonden` 4), drie
dingen die met reden niet meewegen, nergens bewaard maar bij elke vraag
herrekend, en met de dragende regel:

> Een conclusie is nooit harder dan haar zachtste premisse.

**Er komt dus geen L1–L4 naast.** Dat zou een zesde ladder zijn (par. 5.1). Wat
er wél bij komt is de koppeling: per handeling een GEVRAAGDE stand, naast de
BEHAALDE stand van deze sessie. Wie ooit sterk geverifieerd was maar nu een zwakke
sessie heeft, valt terug op de zwakke — dat volgt al uit de regel hierboven.

`server/webauthn/` staat en hangt nergens aan. Dat is de sterke stap en niet sms:
sneller, phishingbestendiger, en het levert `bezit` in plaats van `kennis`. Een
sms-code is `kennis` en verdient die stand ook niet.

---

## 11. Wat het lid ziet — **een stap weg**, met een naamconflict

Een lid kan vandaag zijn eigen abonnement niet zien, niet verlengen en niet
opzeggen: `/api/aanmelding/verleng`, `/opzeggen` en `/contracten` staan alle drie
achter `officeAuth`. Er is geen ledenroute.

Het voorstel noemt de plek *Jij → Afspraken*. **Die naam is bezet**: de leden-app
heeft al `renderAfspraken()` met het label "Mijn afspraken", en dat zijn
BOEKINGEN (`/bookings/mine`). Twee dingen die "afspraken" heten in één app is
dezelfde fout in het klein. Kies een andere naam, of verhuis de boekingen eerst.

Opzeggen wordt een volwaardige stand en geen vlag: aangevraagd op, door wie, per
wanneer, welke rechten blijven, welke kosten nog komen, en het bewijs eronder. Het
lid leest onmiddellijk wat er gebeurt en wanneer. **Geen dark patterns**, en dat
is hier geen stijlkeuze: `CLAUDE.md` verbiedt kunstmatige urgentie, en
`GRAMMATICA.md` zegt dat twintig "weet u het zeker?"-vragen mensen leren op ja te
drukken — ongedaan vóór bevestigen.

Bedenktijd is beleid en geen frontend: een policy bepaalt of en tot wanneer, de
UI toont alleen de uitkomst met de uitleg. Zo verschilt hij per land zonder dat er
een tweede waarheid ontstaat.

---

## 12. Kantoor gebruikt dezelfde motor — **staat als regel, niet als handhaving**

Geen kantoorsluipweg die een andere werkelijkheid maakt. Een medewerker die een
abonnement aanmaakt voor een klant, maakt hetzelfde aanbod, dezelfde
overeenkomst, hetzelfde akkoord, hetzelfde bewijs, dezelfde facturatie en
dezelfde rechten. Alleen de actor en het gezag verschillen.

Dat is de harde RTG-regel die het voorstel voorstelt, en hij is het waard. Maar
hij staat vandaag nergens afgedwongen, en `KANTOORMACHT.json` zegt waarom dat
gevaarlijk is: **590** kantoorroutes, waarvan **422** achter de gedeelde
`OFFICE_CODE` hangen en **365** anoniem uitvoerbaar zijn; **2** kennen een tweede
handtekening. `KANTOOR.md`: *een spoor dat eindigt bij een gedeelde code is geen
spoor, het is een alibi*. Een akkoord dat namens een lid wordt gegeven via die
code is dus geen akkoord.

(Let bij het lezen op de graad: de deur-assen komen uit de ROUTER en zijn hard,
`anoniem` is lexicaal en dus zelf een ondergrens. En citeer hier het REGISTER en
niet de oudere lexicale ronde die `CLAUDE.md` nog noemt — die stond op 548 routes
en 0 tweede handtekeningen.)

`kern/aanmeldingen/besluit.js` heeft deze grendel al voor de passen die een mens
vereisen; hij weigert een Lifestyle- of Business Pass als er geen herleidbaar
persoon achter zit. Dat is het patroon.

---

## 13. De grenzen

Acht, en geen ervan is onderhandelbaar zonder dat er elders iets breekt.

1. **Het blad bezit niets.** Geen standen, geen prijs, geen tekst — alleen
   verwijzingen. Wie hem met de hand kan bijwerken, heeft een tweede waarheid
   gemaakt.
2. **Eén bewijsprimitive, en alleen die maakt een bewijsregel.** Een tweede weg
   naar `GETEKEND` is het einde van de laag.
3. **Een veld zonder waarde gaat als afwezig-met-reden de hash in**, nooit als
   nul of leeg. Er staat nooit een getal waar er geen is.
4. **Geen nieuwe gezags-, uitkomst- of zekerheidsladder.** Er zijn er vijf, acht
   en vijf, en ze zijn alle drie te hergebruiken.
5. **De prijs van het product en de prijs van de verplichting zijn twee dingen.**
   Alleen het eerste beweegt.
6. **Rechten per capability en nooit per account.** Na opzegging blijven facturen
   en bewijsstukken.
7. **Geld wordt klaargezet en een mens voert uit.** `GELD.md` staat hier
   onverkort boven: deze laag mag een betaling voorbereiden en nooit verplaatsen.
   Ook niet bij een verlenging die "gewoon doorloopt".
8. **Bewijs draagt geen persoonsgegevens die het niet nodig heeft.** Een
   verwijzing plus een hash van de toen geldende claim, en niet twintig kopieën
   van naam en adres. Wat juridisch wél in de bundel moet, staat er met die reden
   bij — en dat is één van de twee plekken waar deze laag de codenaamregel van
   `CLAUDE.md` raakt. Dat is een besluit en geen ontwerp: `onboarding/lid.js`
   bewaart vandaag een getypte naam, en een handtekening zonder naam is juridisch
   geen handtekening.

---

## 14. De bouwvolgorde

Niet één herschrijving. Elke stap is los waardevol en los terug te draaien.

| # | stap | stand |
|---|---|---|
| 1 | een factuur leest nooit de prijs van vandaag | **gedaan**, 11 sep 2026 |
| 2 | een lid ziet zijn abonnement en zegt zelf op | **gedaan**, 11 sep 2026 |
| 3 | de contractstand in `auth()`, in de schaduw | **gedaan**, 11 sep 2026 |
| 4 | de bewijsprimitive, met onboarding als eerste gebruiker | open |
| 5 | alle 31 tekenwegen een zekerheids- en bewijsverklaring | open |
| 6 | de consentscanner wordt een releasepoort | open |
| 7 | `setTier` vervangen door een afgeleid recht | open |
| 8 | een wekker voor de verlengronde, op een wachtrij | open |
| 9 | het betaalmandaat als eigen object | vraagt eerst par. 6 |
| 10 | wanbetaling als standenmachine | open |
| 11 | proratie als zuivere rekendienst, vóór het akkoord getoond en erin bewaard | open |
| 12 | WebAuthn aan de zware handelingen | open |
| 13 | de plek waar het lid zijn afspraken ziet | vraagt eerst een naam (par. 11) |
| 14 | clausules en een semantische diff | open |
| 15 | de gebeurtenissen naar finance, CRM, kantoor en AI | open |
| 16 | het anker naar buiten | vraagt een besluit (par. 9) |

### 14.1 Wat stap 2 opleverde, en wat hij NIET deed

`/api/mijn/abonnement`, `/opzegvoorbeeld` en `/opzeggen`, achter de ledendeur, met
het accountId uit de sessie en nooit uit het lijf. De motor is ongewijzigd: het
werk gebeurt in dezelfde `zegOpLidmaatschap` die het kantoor aanroept, er is geen
tweede opzeglus.

Drie dingen die er met opzet NIET bij zitten, en alle drie zijn ze een grens:

- **Geen ledenroute om te verlengen.** `contracten.verleng(c, nieuwCenten)` is het
  enige moment waarop de afgesproken prijs mag veranderen; een lid dat zijn eigen
  verlenging aanroept, zet zijn eigen prijs. Hij hoeft het ook niet — een
  consumentenabonnement verlengt stilzwijgend via de ronde. Niet verlengen is
  hetzelfde als niets doen, en dat mag hij al.
- **Geen terugdraaiing van een opzegging.** De standentabel laat vanuit
  `OPZEGGEND` alleen `GEEINDIGD` toe, en het opzeggen VERWIJDERT de termijnen na de
  einddatum in plaats van ze op 'vervallen' te zetten. Terugdraaien is dus twee
  besluiten (een overgang toevoegen, en de termijnen opnieuw opwekken) en geen
  schakelaar. Dat hoort een eigen stap te zijn.
- **Geen scherm.** De routes staan; de plek waar het lid ze ziet wacht op de
  naamkwestie van par. 11.

**En het indelen van die routes vond een defect dat geen toets zag.** Het
opzegVOORBEELD rekende zijn einddatum eerst uit met een `zegOp` op een
wegwerpkopie van het contract. Geen rij veranderde — maar `zet()` in
`commercie/contract.js` roept `save()` aan, dus een route die alleen VERTELT wat
opzeggen gaat doen, schreef de hele database naar schijf, met elke andere mutatie
die op dat moment nog in het geheugen stond.

Dat is precies het gat waarvoor `MUTATIECONTRACT.md` bij `NOT_APPLICABLE` een
TWEEDE, onafhankelijke afdekking eist naast de opslagmeter. Het is niet gevonden
door te lezen en niet door een toets, maar door die eis serieus te nemen. De
reparatie zit aan de oorzaak: `contracten.opzegEinde()` is nu een eigen functie
die de datum uitrekent zonder hem te zetten, en `zegOp` gebruikt dezelfde — want
de som overtypen bij de vrager zou betekenen dat het lid vooraf een andere datum
leest dan hij krijgt zodra iemand een van de twee aanpast.

Er staat nu een meter op: `test/lidabonnement.test.js` toets 10 telt de
`save()`-aanroepen en eist nul voor het voorbeeld **en minstens een voor het echte
opzeggen** — anders bewijst die toets niets.

Een uitkomst uit de gemeten ronde die hier hoort te staan omdat hij verbaast: na
opzeggen op dag 1 vallen er **nul** termijnen weg en blijven er elf staan. Dat is
geen fout maar de minimumtermijn. Het lid leest dat ook zo (`nogTeBetalen: 11`),
en dat moet: een opzegknop die de resterende verplichting verzwijgt is zelf een
dark pattern.

### 14.2 Opzeggen is niet schakelbaar, en dat is een besluit

De drie ledenroutes uit stap 2 hangen aan **geen** functieschakelaar, en dat is
geen vergeten stap maar de uitkomst van een afweging. `scripts/schakelbaar.js`
ratelt erop (`routesNietSchakelbaar`, richting omlaag), dus een route zonder
schakelaar moet met reden op een lijst staan — en er zijn er twee.

**De grond: wie zich mag verbinden, mag zich losmaken.** Een schakelaar op "kan
een lid zijn eigen abonnement zien en opzeggen" is een knop waarmee het huis
iemand in een contract vasthoudt. Dat is niet een dienst die je aan- of uitzet
maar de ANDERE KANT van een afspraak. `CLAUDE.md` verbiedt dark patterns, en een
opzegknop die RTG centraal kan wegnemen is dat patroon niet per ongeluk maar als
voorziening.

Daarmee horen ze in dezelfde ruimte als `/api/mijn/tweefactor`,
`/api/mijn/herstelkanaal` en `/api/mijn/post`, waar de reden al woord voor woord
dezelfde is: *dit is geen dienst die je aanbiedt maar het beheer van je eigen
account, en een schakelaar erop zet iets uit wat een lid altijd hoort te kunnen.*

**Bewust niet onder `tg-aanmeld`.** Die functie
(`server/functies/register/cat-domeinen3.js`) schakelt `/api/aanmelding` — de
INSTROOM. Zou lidmaatschapsbeheer daaronder vallen, dan zou het sluiten van de
inschrijving de bestaande leden opsluiten: geen nieuwe leden erbij, en de huidige
kunnen er niet meer uit. Dat zijn twee verschillende besluiten en ze horen niet
aan één knop.

**Lezen en opzeggen staan onder één prefix.** Ze splitsen zou een stand opleveren
waarin een lid zijn verplichting kan lezen en niet beëindigen, en dat is de
slechtste van de vier mogelijke standen.

**Twee registers, en ze moeten hetzelfde zeggen.** "Niet schakelbaar" staat op
twee plekken met twee lezers:

| register | lezer | vraag die zijn lezer stelt |
|---|---|---|
| `kern/platformregister/bediening.js` | `scripts/activering.js` | kan dit uit zonder dat de server stuk gaat |
| `kern/bestuursroutes.js` | `scripts/schakelbaar.js` | mag RTG dit een mens afnemen |

Dat ze hetzelfde moeten zeggen stond al in een commentaar in het eerste
(*"dezelfde verklaring staat al in kern/bestuursroutes.js regel 26; deze twee
horen hetzelfde te zeggen"*), en het wordt met de hand bijgehouden. Een prefix
hoort dus in **beide**, elk met de verwijzing naar de ander. Dat er geen meter op
die gelijkheid staat, is een echt gat — het kostte hier een ronde CI om te
ontdekken dat de ene lijst vullen de andere niet vult.

`kern/platformregister/bediening.js` is bij deze gelegenheid op zijn naad
geknipt. Hij droeg twee soorten onschakelbaarheid met twee verschillende gronden
— de besturing van het platform tegenover de rechten van een mens — en één regel
erbij duwde hem over de 10 kB. `bediening-recht.js` draagt nu de tweede helft, en
de twee worden weer samengevoegd zodat er één lijst naar buiten gaat.

### 14.3 Wat stap 3 opleverde, en wat hij NIET deed

`kern/commercie/lidpoort.js` plus tien regels in `auth()`
(`server/opzet/diensten2.js`). Hij telt, en hij houdt **niemand** tegen.

**Het getal dat dit opent.** 46 bestanden met een ledenroute toetsen de pas van
een lid. 45 daarvan vragen `tier === 'guest'` — *is dit überhaupt een lid* — en
precies één (`borden.js`) vraagt naar een specifieke betalende pas. Het aantal dat
vraagt of de **overeenkomst** nog loopt is **nul**, en buiten `kern/commercie/`
bestaat er geen lezer van de contractstand. Beide nageteld in plaats van geschat.

**Vier standen, en de scheiding tussen twee ervan is het hele ontwerp.**
`NIET_BETALEND` / `LOOPT` / `GEEINDIGD` / `GEEN_CONTRACT` — en die laatste twee
worden nooit opgeteld. De meeste betalende leden van vandaag hebben hun pas langs
een andere weg gekregen (een demo-persona, een geseed account, een aanmelding van
vóór de contractmotor), dus *ik vind geen afspraak* betekent **ik weet het niet**
en niet *er is niets afgesproken*. `CONTROLPLANE.md` zegt dat in één regel:
`ONBEKEND` is geen `WEIGEREN`. Wie ze optelt, laat de schaduw melden dat vrijwel
elk lid tegengehouden zou worden, leest iedereen dat als ruis, en dan is het echte
getal — hoeveel passen hun eigen afspraak overleven — niet meer te vinden.

**Daarom twee schaduwregels en niet één**, want ze vragen een ander besluit:

| regel | afdwingen betekent |
|---|---|
| `lidcontract.geeindigd` | de afspraak is voorbij — verdedigbaar |
| `lidcontract.ontbreekt` | elk lid zonder vastgelegde afspraak buitensluiten — stap 7, en een productbesluit |

Met één regel krijgt een mens die de eerste aanzet de tweede er stilzwijgend bij.
Geen van de twee is vrijgesteld: die som mág `routepoort.js` maken (daar kan een
capability op elke trede zitten en dan pakt hij niemand iets af), hier pakt elke
regel een lid zijn pas af. `zetModus('AFDWINGEN')` geeft 409 tot er 200
waarnemingen over 7 dagen liggen.

**Een weging per LID en niet per verzoek**, en dat is de juiste eenheid en geen
zuinigheid: de vraag is hoeveel *leden* een pas zonder lopende afspraak hebben.
Per verzoek tellen laat het getal bepalen door wie het hardst klikt. De keerzijde
hoort erbij en staat in de code: de teller van deze twee regels is daarmee **niet
vergelijkbaar** met die van de abonnementspoort, die per verzoek telt.

**Wat er met opzet niet is: een pad-tabel.** Bij `routepoort.js` hoort die er wel
— kassa is niet personeel. Hier is de vraag voor elke ledenroute dezelfde, en een
tabel zou een lijst **gokken** zijn over welke van die 46 bestanden "echt" een
betalende pas nodig heeft. Die 46 dragen die kennis vandaag niet; ze vragen iets
anders. Een tabel verzinnen vervangt de meting door een mening.

**En een gat in het recht op vergetelheid, dat deze stap zelf maakte.** De weging
gaf de sessiesleutel van het lid mee als VOORBEELD aan `commercie/schaduw.js` — en
dat bewaart voorbeelden met een goede reden, want "120 keer" zonder "van wie,
waarop" is niet te beoordelen. Alleen: wat daar dan ontstaat is een **lijst leden
van wie de pas mogelijk vervalt**, in een teller, zonder bewaartermijn. En het lid
kon hem niet meer kwijt — `test/vergeten-gezelschap.test.js` zag de sleutel na het
uitoefenen van dat recht nog in `schaduwregels` staan. Die tak hield tot dan alleen
zaakcodes (`routepoort.js`), dus de bezem kwam er nooit langs.

De reparatie is **niet** de tak vrijstellen en **niet** de bezem verbreden: beide
erkennen het gat en laten het staan. De identiteit wordt niet meer opgeslagen. Het
product van deze laag is een getal, en wat een mens nodig heeft om te besluiten of
hij de regel aanzet is de **stand** — loopt er geen afspraak, of is er geen
gevonden. De `wie`-parameter is daarom helemaal weg en niet op `null` gezet: een
ongebruikt argument vult de volgende aanroeper alsnog. De prijs staat erbij in
plaats van eronder: een mens kan op het bord niet zien of het dezelfde drie leden
zijn of driehonderd verschillende.

**En een fout die de toets vond en het lezen niet.** De kop
`RTG-Niet-Afgedwongen` wordt nu door twee lagen gezet, dus de eerste versie
gebruikte `res.append`. **Die bestond niet:** `server/web/verrijk.js` is een eigen
Express-achtige schil en geen Express — `set` zit erin, `append` zat er niet.
Binnen de `try/catch` van `auth()` (die er staat omdat een storing in de bewijslaag
geen overtreding mag worden) verdween die TypeError volledig en bleef de kop
gewoon leeg: de regel liep, de meting liep, en het antwoord zei er niets over.
Een ontbrekende methode op die schil faalt dus **stil**, en dat geldt voor elke
aanroeper. `append` staat nu in de schil zelf, één keer, naast `set`.

Twee toetsen waren bovendien **leeg** en zijn dat niet meer, en beide in de vorm
die `LAT.md` regel 9 beschrijft. De ene had een `if (status === 200)` om een
kantoorblok met het verkeerde pad erin (`/api/office/commercie/schaduw`; het is
`/api/office/handhaving`), dus dat blok sloeg stilzwijgend over. De andere bewees
alleen dat de kop **ontbrak** — en dat is waar zodra de hele laag stuk is; hij telt
nu dat het lid wel degelijk gewogen is, als noemer zonder bezwaar.

---

Twee dingen in die lijst zijn **geen bouwwerk maar een besluit**, en ze zijn
allebei goedkoop en blokkerend: de naam van het blad (par. 2.2) en het anker
(par. 9). Ze staan hier apart omdat een besluit dat in een bouwlijst meeloopt,
een jaar later nog open is.

---

## 15. Waar de AI wel en niet bij mag

Drie rollen, en maar één ervan raakt iets aan:

- **Lezen en ordenen.** "Welke overeenkomsten hebben actie nodig" — de AI leest
  de structurele stand en geeft prioriteit. Dat is `tonen`, de laagste gezagstrede.
- **Uitleggen.** "Waarom is mijn abonnement beperkt" — in gewone taal, met de
  reden en de datum. Ook `tonen`.
- **Klaarzetten.** Een herinnering, een concept, een voorstel. `klaarzetten`, en
  een mens bevestigt.

Wat de AI nooit doet: een contractstand wijzigen, geld innen, rechten toekennen,
of vaststellen wat juridisch een materiële wijziging is. Dat laatste is de
scherpste: **de AI vertaalt, het beleid beslist.** `CODE.md` zegt het algemeen —
AI mag betekenis voorstellen, alleen deterministische systemen mogen waarheid
vaststellen.

En de reden dat dit geen voorzichtigheid is maar rekenkunde: `VERTROUWEN.json`
staat op **0 bewezen** en 4716 verzwakt (stempel 3 september 2026), dus de
bewijspoort waar een autonome AI-rol op zou leunen houdt vandaag niets tegen. Wie
dat register citeert, leest eerst zijn stempel: een ronde op een andere commit is
een ander getal.

---

## 16. De meting die dit document eerlijk houdt

Elk getal hierboven is gemeten en draagt zijn graad. Twee ervan zijn een
ONDERgrens en mogen nooit als bovengrens worden gelezen: de 31 tekenwegen
(lexicaal) en de 1 met cryptografisch bewijs.

Wat er nog geen meter heeft, en dat hoort er net zo hard bij:

- **Delen die 31 tekenwegen een vorm?** Niet gemeten. Zolang dat zo is, is de
  bewijsprimitive van par. 3 gerechtvaardigd als *platformvermogen* (OS.md) en
  niet als gedeeld *type*. Een meter in de vorm van `scripts/objectmodel.js`
  zou die vraag beantwoorden; tot dan is het een verklaring en geen bewijs.
- **Optimistische gelijktijdigheid bestaat hier vrijwel niet.** Eén bestand in
  `server/` kent `expectedVersion`, en dat is de spelwereld. Twee toestellen die
  tegelijk opzeggen is vandaag last-write-wins. Dat is geen meting maar een
  afwezigheid, en hij hoort bij stap 2 en 7 in plaats van erna.
