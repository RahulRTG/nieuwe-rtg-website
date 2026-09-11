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
| 2 | een lid ziet, verlengt en zegt zelf op | open |
| 3 | de contractstand in `auth()`, in de schaduw | open |
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
