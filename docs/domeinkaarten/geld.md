# Premiumdomeinkaart Geld, versie 2

Status: **werkdocument, voorstel aan de eigenaar.** Niets hierin is
toegezegd werk; een functie wordt pas werk als de eigenaar haar per familie
toezegt (besluit van 19 oktober 2026). Opgesteld door de Geld-sessie op de tak
`appwerkt/geld`.

Versie 2 volgt de aanscherping van dezelfde dag:
- per app vier onderzoeken: bestaande werkelijkheid, marktmaximum,
  domeinmaximum en RTG Beyond;
- elke functie bouwbaar concreet;
- ook kijken buiten de eigen apps;
- per app een uitkomst A, binnen de huidige architectuur en scope, en een
  uitkomst B, het domeinmaximum;
- een toetsbaar eindcontract over acht dimensies.

**Wat deze kaart beslaat.**
- **De apps.** Wallet, Pay, Bank, Balans, RTG Code, Geld Command, WBW,
  Labfonds, Mecenaat, Nalatenschap en de tab Betalen, volgens de verdeling van
  de integrator.
- **Logboek**, maar alleen de financiële registratie (zie de grens in 4.3).
- **Eén scherm.** Ze zijn allemaal een stand of alias van `/apps/geld.html`,
  met eigenaar `geld.overzicht` in `SCHERMEIGENAAR.json`. Alleen Pay heeft een
  eigen scherm (`/apps/pay.html`, `betalen.rtgpay`).
- **Vijf families.** 0 reis, 1 betalen, 2 rekening en overzicht, 3 samen geld,
  4 bewaren en geven.

**Hoe te lezen.**
- **Hoofdstukken.** Per app staan eerst de bestaande inventaris, de catalogus
  en LOS en SAMEN uit versie 1. Daarna volgt het blok **"v2"** met:
  - de vier onderzoeken;
  - de nu-functies bouwbaar uitgeschreven;
  - wat alleen RTG kan;
  - de bouwstenen en ontbrekende schakels;
  - de prioriteit;
  - de uitkomsten A en B;
  - het eindcontract.
- **Acht velden per nu-functie.** Een nu-functie staat uitgeschreven met:
  - de gegevens en hun bron;
  - de regels en grenzen;
  - de rekenwijze;
  - de onzekerheid en hoe die zichtbaar is;
  - wanneer iemand iets hoort;
  - de rollen en de toestemming;
  - de uitzonderingen;
  - het acceptatiecriterium.

  Bij **later** en **niet** staan één regel en de reden.
- **"Bestaat" en "bewezen".** "Bestaat" betekent: in de code, met een toets of
  voltooiscenario. "Bewezen" betekent: gesloten in de registers (`APPWERKT.json`,
  `VOLTOOIPROEF.json`, `IDOR.json`, `BEVOEGD.json`).
- **De registerstand.** Op deze tak zijn de registers gemeten op 19 oktober
  tussen 04:47 en 05:16 UTC. Dat gebeurde **vóór** de samenvoeging van de
  voltooiscenario's van Geld (wallet, bank, wbw, labfonds, rtgcode, geldcommand
  en balans). Die sluiten lokaal (`node scripts/voltooiproef.js --alleen=<app>`),
  maar de centrale meetronde moet ze nog vastleggen. Waar hieronder "3/8"
  staat, is dat dus de registerstand, geen oordeel over de code.
- **Het eindcontract** vervangt de acht bewijzen niet (bereikbaar, bedienbaar,
  voltooibaar, waarheidsgetrouw, persistent, bevoegd, herstelbaar, menselijk).
  Het komt erbovenop.

**Grenzen die overal gelden.**
- Geld verlaat het huis nooit vanzelf (`AFBOUWPROGRAMMA.md` par. 1.3).
- Samenwerking loopt via verwijzingen en projecties, nooit via een gedeelde
  database (par. 1.2). Geld toont de gevolgen; het domein blijft eigenaar.
- Er komt geen nieuwe motor of laag. Wat er al is, staat in G.1.
- Geen beleggings-, krediet- of verzekeringsadvies (`GELD.md` par. 7). Waar die
  Wft-grens precies loopt, staat in G.2.
- Een voorspelling is nooit een feit.
- Geen echte merken als partner, geen verzonnen gegevens.

**Over de bronnen.** In deze sessie was het web niet rechtstreeks te openen:
WebFetch gaf `ENOTFOUND` en de proxy gaf 403. Daarom staat bij elke bron wat
voor soort bron het is:
- **fragment**: uit een zoekresultaat, met de URL en de datum 19 oktober 2026;
- **kennis**: uit kennis, niet nagelezen.

Beide zijn een ondergrens om na te lezen, geen geciteerde pagina. Bij de
prijsniveaus van marktpartijen geldt dat in het bijzonder.

---

## 0. De reisfamilie, het Geld-deel (gaat voor)

Prioriteit van de eigenaar: boeken, betalen, agenda en reisdossier worden als
eerste compleet, los en samen getest. Afgestemd met TravelOS (hun kaart
`docs/domeinkaarten/travelos.md` par. 1.5) en met Toegang.

### 0.1 Bestaande werkelijkheid

**Betalen.**
- `POST /api/reisbureau/betaal` roept `betaal()` aan in
  `kern/reisbureau-betaling.js`.
- Alleen een bevestigde reis met samenstelling wordt betaald.
- Er komt één boeking (`pay.boekAsync`, economische sleutel
  `pay-handeling:[reis, ref]`).
- Daarna volgen:
  1. de herkomstrijen;
  2. de uitkeringen aan derden, klaargezet maar niet uitgevoerd;
  3. `markeerBetaald`.
- Bewijs: `test/reisherkomst.test.js`, toetsen 12 en 13.

**Teruggave.**
- Na afzeggen bestaat er een teruggaverecht. Een mens op naam voert het uit,
  met passkey.
- Vanaf € 1.000 kijkt er een tweede mens mee (`kern/reisbureau-teruggave.js`).

**Sinds versie 1 gerepareerd of toegevoegd.**
- **De paspoortpoort (`960cc45a`).**
  - Een reis boeken mag elk account.
  - Een reis betalen mag elk account dat gekeurd is met de paspoortpoort
    (besluit van 19 oktober). Dat vervangt "Alleen voor leden".
  - Een bezoeker zonder account krijgt 403.
  - Bewijs: `test/reisbetaal-poorten.test.js`.
- **De bezitspoort** (Toegang, `54f4b42c` op `appwerkt/toegang`).
  `/api/reisbureau/betaal` staat in de bezitspaden.
- **Een dubbele herkomst na een crash (`6016db28`).**
  - Wat er misging: een herhaling na een crash tussen de boeking en "betaald"
    schreef de rijen en uitkeringen opnieuw weg. Ibiza kreeg 12 rijen waar
    het er 6 horen te zijn.
  - Gevonden door TravelOS. Ik heb het eerst nagemeten met een toets die
    zakte, en daarna gerepareerd.
  - Bewijs: `test/reisbetaling-herhaal.test.js`.

**Nog open.**
- **K2.** Geen scherm betaalt. Afgesproken is dat de knop in `reisbureau.html`
  komt, bij de reis.
- Er wordt alleen uit het walletsaldo betaald, zonder de betaalwaarheid.
- **K3.** Er is geen betaalbewijs.
- Er staat geen verplichting in Geld.
- Defecten van TravelOS, die zij oplossen:
  - **K1.** Het reisdossier zet 'paid' al bij het bevestigen.
  - **K4.** Het reisoverzicht staat hard op `betaald:false`.

### 0.2 Markt en domein, kort

**Markt.**
- Een reisorganisatie vraagt doorgaans een aanbetaling en het restant een
  aantal weken voor vertrek (kennis).
- Een betaalbewijs per boeking is standaard (kennis).

**Domein.**
- Wie in Nederland een pakketreis verkoopt, valt onder de garantie van de
  SGR/het Garantiefonds (kennis). RTG claimt dat niet.
- De factuurvereisten gelden ook voor reizen (G.2).

**Besluit B2 (TravelOS).** Er is geen betaaltermijn. Daarom staat een reis in
Geld als "open, geen vervaldag".

### 0.3 Functies, bouwbaar concreet (bak **nu**)

**R1. Een reis betalen via de betaalwaarheid, met bijladen (L1/L5, middel).**
- *Gegevens.*
  - De bevestigde aanvraag, van TravelOS: `ref`, `prijs.totaal` en `status`.
  - Het walletsaldo, van Pay.
  - De kaart, via de betaalprovider.
- *Regels.*
  - Alleen bij `status = bevestigd`, en met samenstelling.
  - Elk account, gekeurd met de paspoortpoort, met het bezitsbewijs.
  - `betaalWaarheid.maak({ soort: 'reis', bronRef: ref, idem: 'reis:' + ref })`.
  - De afhandelaar boekt van de wallet naar `rtg:reisbureau`, met de bestaande
    sleutel, en roept dan `markeerBetaald`.
  - Dezelfde vorm als `kern/bank/stortwaarheid.js` en
    `kern/markt/handel/dealbetaal.js`.
- *Rekenwijze.* Het tekort is de reissom min het beschikbare saldo. Alleen dat
  tekort wordt bijgeladen.
- *Onzekerheid.*
  - De afloop is betaald, geweigerd of traag.
  - "Wacht op bevestiging" heet nooit "betaald".
- *Wanneer hoort iemand iets.*
  - Het lid ziet de uitkomst meteen op het scherm. Komt de bevestiging later,
    dan volgt een melding van Pay.
  - De reisadviseur ziet het in het kantooroverzicht.
- *Rollen.*
  - Het lid betaalt zelf: één tik en een bevestiging.
  - Het kantoor bevestigt de reis vooraf.
- *Uitzonderingen.*
  - **Afzegging tijdens een hangende betaling.** De teruggave volgt het
    bestaande recht.
  - **De betaalwaarheid valt uit.** 503, met "er is niets afgeschreven".
  - **Bedrag of valuta wijkt af.** De betaling gaat naar `CONTROLE_NODIG`, en
    een mens op naam rondt af (`kern/betaalwaarheid/controle.js`).
- *Acceptatie.*
  - Een gekeurd account met te weinig saldo betaalt een bevestigde reis met de
    kaart.
  - De reis heet pas betaald na de bevestiging, en dan één keer, ook na een
    dubbele tik of een crash.
  - Bij een weigering heet ze nergens betaald.

**R2. Het betaalbewijs (L5, klein, na R1).**
- *Gegevens.*
  - De pay-boeking: id, centen en datum.
  - De reis: ref en titel.
- *Regels.* De afhandelaar van R1 roept `factuurVoorLid` aan. Zo is er één
  plek die een lidtransactie tot factuur maakt; dat is het voorstel van
  TravelOS.
- *Rekenwijze.* Het bedrag van de boeking.
- *Onzekerheid.* Geen: een bewijs bestaat pas na de bevestiging.
- *Wanneer hoort iemand iets.* Het lid ziet het bewijs bij de reis en in
  Facturen.
- *Rollen.* Alleen het lid en het kantoor.
- *Uitzonderingen.* Na een teruggave volgt een creditnota
  (`kern/factuurcorrectie.js`).
- *Acceptatie.*
  - Na het betalen opent het lid het bewijs, met bedrag, datum,
    boekingsnummer en reis.
  - Het bewijs blijft bestaan als de agenda of het reisdossier uit staat.

**R3. De reis als verplichting en kasstroom in Geld (L4/L6, middel).**
- *Gegevens.* Een projectie van TravelOS, zonder kopie: `ref`, `prijs.totaal`,
  `vertrek` en `betaald`.
- *Regels.* Er is geen vervaldag (besluit B2).
- *Rekenwijze.*
  - **Kasstroom** (`geldgraaf/vooruitblik.js`): de reis telt als "verwacht" op
    de vertrekdatum, maar alleen als het lid dat aanzet.
  - **Na het betalen**: uitgaand op de betaaldag.
  - **Een teruggave**: inkomend.
- *Onzekerheid.* "Verwacht" en "geboekt" zien er zichtbaar verschillend uit.
- *Wanneer hoort iemand iets.* Geen eigen melding. De verplichting staat in de
  kalender van Geld Command.
- *Rollen.* Alleen het lid.
- *Uitzonderingen.*
  - Na een afzegging verdwijnt de verplichting.
  - Valt TravelOS uit, dan zegt de kalender "niet opgehaald".
- *Acceptatie.*
  - Een bevestigde, onbetaalde reis staat in Geld als open bedrag, met een
    link naar de reis.
  - Na het betalen verdwijnt ze uit "open" en staat ze één keer als uitgave.

### 0.4 Keten en storingen

**De keten.**
1. Boeken.
2. Bevestigen.
3. Betalen (R1).
4. Het bewijs (R2).
5. De agenda en het reisdossier (TravelOS).
6. Geld toont het (R3).

**Storingen.**
- **De agenda valt uit.** De betaling en het bewijs blijven staan.
- **Pay of de betaalwaarheid valt uit.** 503. De reis blijft bevestigd en
  onbetaald, en het scherm zegt dat.
- **De bank weigert.** De reis heet nergens betaald.
- **De bank blijft hangen.** Er staat "wacht op bevestiging", en de veegronde
  rondt het één keer af.
- **Een crash na de boeking.** Er blijft één boeking en één set rijen
  (`6016db28`).
- **Het reisdossier valt uit.** Het bewijs staat nog in Facturen.

### 0.5 Afspraken en open punten

**Afgesproken met TravelOS.**
- Het betaalscherm komt in `reisbureau.html`.
- Er is geen vervaldag.
- "Betaald" ontstaat alleen via de afhandelaar van de betaalwaarheid.
- Het bewijs komt van `factuurVoorLid`.
- K1 en K4 zijn van TravelOS; K3 en K7 van Geld.
- K7 is af (`6016db28`).

**Vraag van TravelOS aan de eigenaar.** Bevestig de lezing van het besluit:
- de paspoortpoort geldt alleen bij **betalen**, niet bij boeken;
- een boeking kost niets, dus er is geen geldmoment.

Zo is het nu gebouwd (`960cc45a`).

**Wanneer ik R1 bouw.** Pas nadat de eigenaar deze familie toezegt.

---

## G. Gemeenschappelijk voor alle Geld-apps

### G.1 Bouwstenen die er al zijn (hergebruik eerst)

| Bouwsteen | Pad | Wat hij doet | Eigen of projectie |
|---|---|---|---|
| Betaalwaarheid | `server/kern/betaalwaarheid/` | Een betaling bestaat vóór de provider wordt gebeld. Afloop: betaald, geweigerd of traag. Veegronden voor betalingen en terugbetalingen. Een controle wordt door een mens op naam afgerond. | eigen |
| RTG Pay | `server/kern/pay/` | Saldo, boekingen, `metIdem`, walletplafond, eigen geldgrens, opdrachtenrij voor terugstorten | eigen |
| Geldgraaf | `server/kern/geldgraaf/` | Projectie over wallet, wbw, mecenaat, labfonds en payroll. Herkent terugkerende posten (`patronen.js`). Vooruitblik over 7, 30 en 90 dagen. | projectie |
| Geldbeleid | `server/kern/geldbeleid/` | Regels met vier niveaus, potten, een harde geldgrens die weigert, een actielog waaraan alleen toegevoegd wordt | eigen |
| Scenario-engine | `server/kern/fiscaal/scenario.js` | "Wat als" (personeel, omzet). Schrijft niets. | projectie |
| Stuurlaag | `server/kern/stuur/` | Welke route de AI mag aansturen. Een mandaat versmalt alleen. | beleid |
| Fiscale klassen | `server/kern/fiscaal/zekerheid.js` | Bepaald, uitlegbaar, advies of voorbehouden | regel |
| Facturatie | `server/kern/facturatie/motor.js`, `factuurVoorLid` | Facturen met betaaltermijn en vervaldatum | eigen |
| Contractklok | `server/bedrijf/contract.js` | Einde, opzegtermijn en `laatsteOpzegdag` (bedrijven) | eigen |
| Simulatiebank | `server/betaal/synthetisch*.js` | Betalen, terugbetalen en uitbetalen met alle afloopvormen, zonder echte sleutels | toetsbank |

### G.2 Het domeinmaximum: hoe het financiële domein werkt

Per beroepsgroep: het werk, de normen en de grens. Elke bron staat erbij.

**Huishoudens.**
- Het Nibud deelt de uitgaven in drie groepen: vaste lasten,
  reserveringsuitgaven en huishoudelijke uitgaven (fragment,
  zoek.officielebekendmakingen.nl/kst-32777-11.html).
- Het Budgethandboek verschijnt elk jaar, met referentiebudgetten. Die zijn
  een voorbeeld, geen norm voor één persoon (fragment,
  nibud.nl/samenwerken/cijfers-en-rekentools/referentiebegrotingen/).
- Ook de buffer hangt af van het huishouden (fragment,
  radar.avrotros.nl/artikelen/18100).

**Budgetcoaches en schuldhulp.**
- Sinds 2021 is vroegsignalering een wettelijke taak van de gemeente (Wgs).
  Vier partijen melden een achterstand: woningcorporatie, zorgverzekeraar,
  energiebedrijf en waterbedrijf (fragment, binnenlandsbestuur.nl).
- De gedragscode van de NVVK bouwt op NEN 8048 (fragment, nvvk.nl).
- De beslagvrije voet is 95% van de bijstandsnorm, inclusief vakantiegeld. De
  officiële rekentool is uwbeslagvrijevoet.nl (fragment, rvr.org).
- De Wsnp duurt 18 maanden, voor wie vanaf 1 juli 2023 is toegelaten
  (fragment, rechtspraak.nl).
- **Grens.** Een schuldregeling is aan de gemeente en de NVVK-leden; de Wsnp
  aan de rechter.

**Zzp, mkb en boekhouders.**
- De administratie- en bewaarplicht is 7 jaar, en 10 jaar voor onroerende
  zaken (art. 52 AWR, fragment, wetten.overheid.nl/BWBR0002320).
- De btw-aangifte per kwartaal moet uiterlijk de laatste dag van de maand na
  het kwartaal binnen zijn (fragment, belastingdienst.nl).
- Er gelden factuurvereisten (fragment, mkbservicedesk.nl).
- De KOR geldt tot € 20.000 omzet (fragment, onderneming.nl).

**Stichtingen (ANBI) en verenigingen.**
- Een ANBI publiceert haar beleidsplan, haar bestuur en haar financiële
  verantwoording (fragment, taxence.nl).
- Een losse gift is aftrekbaar boven een drempel van 1% (minimaal € 60) tot
  10% van het inkomen. Een periodieke gift (5 jaar) heeft geen drempel
  (fragment, consumentenbond.nl).
- Een vereniging heeft een kascommissie en legt verantwoording af aan de ALV
  (art. 2:48 BW, kennis).

**Financieel planners.**
- Advies is een persoonlijke aanbeveling over een specifiek nieuw product, en
  vraagt een Wft-vergunning. Informeren vraagt dat niet (fragment,
  afm.nl/…/interpretatie-informeren-en-adviseren.pdf).
- Een FFP werkt met levensloopscenario's (fragment, ffp.nl).
- **Grens voor RTG.**
  - Scenario's met de eigen getallen van het lid en zonder productkeuze zijn
    informeren. Die mogen.
  - Een productaanbeveling doen wij nooit.

**Nalatenschap.**
- De aangifte erfbelasting moet binnen 8 maanden bij een overlijden tot en met
  2025, en binnen 20 maanden bij een overlijden vanaf 1 januari 2026
  (fragment, belastingdienst.nl, rendement.nl).
- Er zijn de executeur, het Centraal Testamentenregister en de
  boedelbeschrijving.
- De digitale nalatenschap is wettelijk niet geregeld (fragment,
  consumentenbond.nl).
- **Grens.** Het testament, de verklaring van erfrecht en het register zijn
  aan de notaris.

**Gedeeld geld.**
- Het Nibud noemt vier verdeelmethoden (fragment, rabobank.nl):
  - naar inkomen;
  - gelijk overhouden;
  - helft-helft;
  - een vaste bijdrage.
- Zakgeld is een vast bedrag op een vast moment (fragment,
  wijzeringeldzaken.nl).
- Een verenigingskas heeft een penningmeester en een ALV.

**Betaalregulering.**
- Rekeninginformatie (AISP, PSD2) vraagt een DNB-vergunning, of een partner
  die zelf contractpartij is (fragment, dnb.nl).
- Elektronisch geld vraagt een vergunning, behalve binnen een beperkt netwerk
  (art. 1:5a Wft). Boven € 1 miljoen moet dat gemeld worden (fragment,
  dnb.nl).
- De Wwft-poortwachters zijn de bank, de betaalinstelling en de notaris
  (fragment, dnb.nl).

### G.3 Financiële behoeften buiten de eigen apps

Geld toont de gevolgen; het domein blijft eigenaar. Gemeten in de code; de
eigenaar staat volgens `SCHERMEIGENAAR.json`.

| Domein (eigenaar) | Geldobject vandaag | Via RTG Pay? | Wat Geld als projectie zou tonen |
|---|---|---|---|
| Reizen (`reisbureau.html`, `reizen.reisbureau`) | aanvraag `RTG-R-…`, `prijs.totaal`, `vertrek`, `betaald`; teruggave | ja (`boekAsync`, `terugGave`), nog zonder betaalwaarheid | verplichting, uitgave en teruggave (R3) |
| Logeren (`thuis.html`, `verblijf.logeren-bij-leden`, TravelOS) | boeking `RTG-T-…` met `prijsopbouw.totaal`, `borg`, `van` en `terugPct` | **nee**: er staat alleen de tekst "De betaling loopt via RTG Pay bij bevestiging" | verplichting en borg, zodra er een geldpad is |
| Horeca (`gast.html`, `bestellen.html` …) | rekening en bestelling (`pay.betaalZaak`); aanbetaling en annuleringsboete bij een reservering | de rekening wel; **de aanbetaling en de boete niet** (bewaard, nooit geïnd) | uitgave per zaak; een aanbetaling als verplichting, zodra die geïnd wordt |
| School (`foundation/school.html`, `rtf.school`) | facturen voor schoolgeld, ouderbijdrage en excursie met `vervalt`; machtiging | **nee**: met de hand als betaald gemarkeerd; de betaallink `#factuur=` wordt nergens verwerkt | open bedrag met vervaldag in de kalender; een betaling als het lid betaalt |
| Onderneming (`onderneming.html`, `werk.onderneming`) | facturen met `vervaldatum`, btw-saldo per periode, contracten met `laatsteOpzegdag` | de facturen niet (de verkoper markeert betaald); de werkopdracht wel | voor het eigen bedrijf: btw-reservering, debiteuren en crediteuren, alleen als het lid de zaak koppelt |
| Gezin (`foundation/zakgeld.html`, `geld.zakgeld`) | zakgeldpotje, weekgeld en spaardoelen: leerboeken, "geen echt geld" | nee, met opzet | niets, want het is leergeld en geen geld; hooguit een verwijzing |
| Wonen (`wonen.html`, `woning.overzicht`) | meldingen zonder bedrag; geen woonlasten | nee | niets, tot er woonlasten zijn (besluit G.5-4) |
| Assets (`tab:assets`, LivingOS-A) | koop en herroeping via de betaalwaarheid; servicefee | ja | de servicefee als verplichting; Assets blijft eigenaar |
| Hangar (`hangar.html`, `reizen.vliegtuig`) | toestellen en vluchten, zonder kosten | nee | — (onderhoud: zie Logboek, 4.3) |

**Wat hieruit volgt voor Geld (één bouwsteen, geen laag).** Elk domein met een
open bedrag (Reizen, Logeren, School, Assets, later Wonen) levert dezelfde
kleine projectie aan Geld:

| Veld | Wat erin staat |
|---|---|
| `bron` | de capability van de eigenaar |
| `ref` | de verwijzing naar het object bij de eigenaar |
| `centen` | het open bedrag |
| `vervalt` | de vervaldag, of leeg |
| `status` | `open`, `betaald` of `vervallen` |
| `link` | het adres van het scherm van de eigenaar |

Geld leest dat met de bestaande `bronnen`-vorm van de geldgraaf en bewaart
niets. Dat is de verplichtingenkalender (2.2, F-GC4).

### G.4 Veiligheid, gemeten door Toegang (ligt bij de integrator)

Ongeveer twintig ledenroutes belasten de eigen wallet buiten de bezitspaden.
Op de app store na hebben ze ook geen paspoortpoort. Het gaat om:

- order, rekening en ride;
- ov/uit, mob kaart en abo;
- pakket en vonk;
- rtfos winkel en gift;
- giftcard, wbw, podium en fluister.

De geldroutes van de bank (`/api/bank/*`) hebben geen paspoortpoort. Geld voegt
die poorten toe zodra de integrator kiest. Voor de tab Betalen
(`/api/betaal/direct`) en de bank staat het in de catalogi hieronder.

### G.5 Besluiten gevraagd (alle apps)

1. **Geld Command en WBW.** Ze weigeren elk gratis account (`geenGast`). Vallen
   ze onder "minimaal een account"?
2. **Krediet en de AI-bankier.** Ze staan allebei achter de leden-bank, die uit
   staat, terwijl `GELD.md` par. 7 ze uitsluit. Blijven ze?
   - Krediet staat in `kern/bank/krediet.js`: leningen tot € 50 miljoen tegen
     7%; het kantoor beslist.
   - De AI-bankier staat in `kern/bank/advies.js` en adviseert.
3. **De paspoortpoort op de routes uit G.4.** Welke wel en welke niet?
4. **Woonlasten.** Komt er een verplichtingenobject van Geld waar Wonen naar
   verwijst, of levert Wonen de projectie uit G.3?
5. **Mecenaat en Labfonds.** Een gift of toezegging echt betalen of innen?
6. **Nalatenschap.** Een genre "notaris" in de leveranciersapp (CIVILIS)?
7. **Logboek.** De onderhoudsregels van een vliegtuig naar Hangar (4.3)?
8. **De reis.** De paspoortpoort alleen bij betalen (vraag van TravelOS, 0.5)?

### G.6 Het eindcontract, de vorm

Per app staat aan het einde van het v2-blok een eindcontract over acht
dimensies:

1. functionele breedte;
2. professionele diepte;
3. levenscyclus;
4. samenwerking en rollen;
5. domeinintelligentie;
6. los functioneren;
7. RTG-ketens;
8. bewezen betrouwbaarheid.

**Hoe een dimensie getoetst wordt.** Elke dimensie is één toetsbare zin die
een toets of voltooiscenario kan worden. Een dimensie die bij een app niet van
toepassing is, zegt dat met de reden. De achtste dimensie is altijd dezelfde:

> "alle acht bewijzen gesloten in de centrale meetronde, IDOR zonder
> doorbraak, BEVOEGD zonder DEFECT"

**Wat het contract niet vervangt.** Het eindcontract vervangt de acht bewijzen
niet.

---

## Familie 1 — betalen

Vier apps die samen één vraag beantwoorden: "kan ik betalen, en is het echt
gebeurd?". Pay is de rekening van het lid in het huis; Wallet bewaart passen
en munten; de tab Betalen is de snelle weg in de hoofdapp; RTG Code is de
code die de kassa scant.

### 1.1 Pay (`/apps/pay.html`, capability `betalen.rtgpay`)

**a. Doel.** Het lid wil zonder nadenken kunnen betalen, ontvangen en terughalen
binnen het huis, en altijd weten wat er werkelijk met zijn geld gebeurde.

**b. Wat er is.**
- Routes:
  - `server/routes/pay.js`: overzicht, oplaad, stuur, verzoek(*), saldo;
  - `pay-tegoed.js`: tegoed, tik, kascode;
  - `pay-terug.js`: terugstand, rekening, terug;
  - `pay-waarde.js`: portefeuille, graaf;
  - de zaakkant in `pay-zaak*.js`;
  - de kantoorkant: `/api/office/pay/bewijs` en `pay-correctie.js`.
- Kern: `server/kern/pay/*`, met opladen via de betaalwaarheid, `metIdem` op
  elke geldhandeling, de opdrachtenrij voor terugstorten, het walletplafond
  (`plafond.js`) en de eigen geldgrens (`koppelGrens`).
- Voltooiscenario: `scripts/lib/voltooi/pay.js` (`link:pay`).
- Toetsen:
  - `test/wallet-gratisaccount*.test.js`;
  - `test/sociaal-gratisaccount.test.js`;
  - `test/tegoedterug-gratisaccount.test.js`;
  - `test/simulatie-uitbetaling.test.js`.

**c. Objecten en eigenaar.**
- Saldi, boekingen en verzoeken (`paySaldi`, `payBoekingen`, `payVerzoeken`) en
  de idem-bak `payIdem` zijn van Pay.
- `apps/pay.html` is de eigenaar van `betalen.rtgpay` (`SCHERMEIGENAAR.json`).

**d. Handelingen, van begin tot herstel.**
- opladen
- zien
- sturen
- een Klompje vragen en betalen
- tikken
- tegoed klaarzetten en verzilveren
- de kascode
- terugstorten naar het eigen IBAN

Wat er misgaat:
- een weigering van de bank;
- de bank blijft hangen; de veegronde vangt dat op;
- een dubbele tik;
- een crash.

Herstel en terugdraaien:
- het controleren en afronden door een mens op naam;
- de terugboeking.

**e. Rechten.**
- Elk account, ook gratis, met de paspoortpoort op elk geldmoment.
- De zaak int via de kassa.
- Het kantoor ziet het bewijsbord en corrigeert facturen.
- De Lifestyle- en Business-pas zijn vrij van de paspoortpoort.
- Geldgrenzen:
  - 1 cent tot € 5.000 per boeking;
  - een walletplafond van € 10.000 (de boardroom zet het);
  - de eigen geldgrens, die weigert.

**Zes lagen, oordeel.**
- **L1 vol.**
- **L2** bestaat aan de zaakkant (`pay-zaak*.js`), niet voor professionals van
  het lid.
- **L3** alleen voor de zaak (budgetten, treasury); geen gezamenlijke rekening
  voor een huishouden.
- **L4** de waardegraaf ("waar ging deze euro heen") bestaat; een vooruitblik
  zit in Geld Command.
- **L5** het bijladen gaat via de betaalwaarheid; terugstorten via de
  opdrachtenrij; de veegronden voor betalingen en terugbetalingen bestaan.
- **L6** veel ontvangen ketens (zorg, assets, markt, wbw, festival, kassa).

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Opladen, sturen, Klompje, tikken | L1 | bestaat | Een gekeurd account laadt op, stuurt en betaalt een Klompje; een dubbele tik of crash boekt één keer. | — | — |
| Terugstorten naar het eigen IBAN | L5 | bestaat | Alleen naar de eigen gekeurde rekening en het beschikbare deel, één keer; weigert de rail, dan komt het geld terug. | — | — |
| De kascode tonen in Pay | L1 | half | Het lid toont in Pay een kassacode die vijf minuten geldt; vandaag roept `pay.html` `/api/pay/kascode` niet aan. | klein | nu |
| Eigen categorieën en zoeken in de geschiedenis | L1 | ontbreekt | Het lid zoekt een betaling op tekst, bedrag of datum en geeft een betaling een eigen categorie. Bij Emma is dit Pro, bij Monzo Extra (fragment). | middel | nu |
| Export van de geschiedenis (CSV/PDF) | L5 | half | Het lid downloadt zijn betalingen van een periode. De bank heeft al `afschrift.csv`; Pay nog niet. Bij Emma is dit Pro (fragment). | klein | nu |
| Potjes met een eigen doel | L1 | bestaat (in Geld Command) | Het lid zet geld opzij in een pot; de pot gaat nooit onder nul. Bij bunq kost een extra rekening een betaald pakket (fragment). | — | — |
| Gezamenlijke pot of rekening voor een huishouden | L3 | ontbreekt | Twee leden zien en vullen samen een pot; elk ziet wie wat deed; geld eruit vraagt de bevestiging van beide. Bij bunq is aanmaken betaald (fragment). | groot | later |
| Afrondsparen | L1 | ontbreekt | Bij elke betaling rondt het lid af naar de pot die hij kiest; uitzetten kan altijd. Bij Monzo is het veelvoud betaald (fragment). | middel | later |
| Wegwerp- of extra virtuele kaarten | L1 | niet | — | — | niet: RTG geeft zelf geen kaarten uit; die horen bij een bankvergunning (extern) |
| Aankoop- en annuleringsdekking, lounges | — | niet | — | — | niet: verzekering of verdienmodel (GELD.md par. 7) |

**f. De twee modi.**
- **LOS.** Pay rondt zijn kerntaak zelf af. Wat er gebeurt als er iets uitvalt:
  - de betaalprovider valt uit: opladen geeft 503 met "er is niets
    afgeschreven", en sturen uit het saldo werkt gewoon door;
  - de betaalstop staat aan: "Betalen staat bewust uitgeschakeld. Er is niets
    afgeschreven.";
  - de bank is niet live: het bijladen vanaf de bank zegt dat, maar de kaart
    werkt.
- **SAMEN.** Pay geeft een boekingsnummer, een tikcode, een kascode en een
  tegoedcode uit. Hij ontvangt betalingen van zorg, assets, markt, wbw, de
  kassa, festival en de app store.

**Keten.** Een lid betaalt een zorgbehandeling:
1. Zorg vraagt `pay.betaalZaak` aan, met de sleutel per boeking.
2. Pay boekt, en laadt bij als het saldo tekortschiet.
3. Zorg zet "betaald".

Storingen:
- Weigert de bank, dan blijft de boeking "wacht op betaling" en verdienen de
  punten niets.
- Valt zorg uit, dan blijft de betaling in Pay staan met het boekingsnummer.

**g. Betaalmuur** (fragment, 19 oktober 2026):
- Revolut Plus/Premium/Metal/Ultra: koopbescherming, voorrang bij support en
  ruimere wisselgrenzen; alleen in Ultra: lounges, partnerabonnementen en
  annuleringsdekking (revolut.com/revolut-plus/, revolut.com/ultra-plan/).
- bunq Core/Pro/Elite: aantal IBAN's (3/5/25), een gezamenlijke rekening
  aanmaken en budgetfuncties; alleen in Elite: reisverzekering en ZeroFX
  (us.fitgap.com/products/bunq, help.bunq.com/articles/whats-a-joint-account-and-how-do-i-create-one).
- Monzo Extra/Perks/Max: andere banken koppelen, afrondsparen, eigen
  categorieën, virtuele kaarten (monzo.com/current-account/extra).

Wij hebben:
- de basis (betalen, sturen, verzoeken, potten, terugstorten);
- half: de export;
- niet: categorieën en zoeken.

**j. Extern.** Een echte betaalprovider en zijn vrijgave. Elektronisch geld
(B3) zolang er een terugstorting naar een IBAN bestaat; de vrijgavepoort beslist.
Een kaart uitgeven vraagt een bankpartner.

#### v2 — Pay

**Bestaande werkelijkheid.**
- Registers: 7/8; alleen *bevoegd* staat op NIET_GETEST (5 van de 17 routes
  open). IDOR: geen doorbraak.
- Sinds versie 1 bewezen voor een gratis account:
  - sturen, verzoeken en tikken (`test/sociaal-gratisaccount.test.js`);
  - tegoed en terugstorten (`test/tegoedterug-gratisaccount.test.js`);
  - de verplichte bezitspoort met een gebonden toestel
    (`test/wallet-gratisaccount-verplicht.test.js`);
  - de uitbetaalrail in de simulatiebank (`test/simulatie-uitbetaling.test.js`).
- Een vastgelopen terugbetaling staat als regel op de kantoorlijst
  (`test/terugvastgelopen.test.js`).

**Marktmaximum, met de duurste niveaus** (fragment, 19 oktober 2026):

| Aanbieder | Duurste niveau | Wat alleen daar zit | Bron |
|---|---|---|---|
| Revolut | Ultra | lounges, partnerabonnementen, annuleringsdekking, lagere handelskosten | revolut.com/ultra-plan/ |
| bunq | Elite | reisverzekering, ZeroFX, eSIM, 25 IBAN's | bunq.com/personal-account/banking-plans/bunq-elite |
| Monzo | Max | verzekeringen en een gezinsaanvulling | monzo.com/current-account/plans |

Wat de middenniveaus vragen:
- **Monzo Extra:** eigen categorieën, export naar een spreadsheet, andere
  banken koppelen.

Wat gratis is:
- Wise (betalen per gebruik, wise.com/eu/pricing);
- Tikkie;
- de betaalfuncties van Apple en Google.

De markt vraagt geld voor drie soorten dingen, geen van alle betaalfuncties:
- verzekering;
- valuta;
- status.

**Domeinmaximum.**
- Een betaalrekening van een huishouden heeft drie dingen nodig:
  - een afschrift dat sluit;
  - een categorie per post (de Nibud-indeling, G.2);
  - een export voor de belastingaangifte of de schuldhulp.
- De bewaarplicht van 7 jaar geldt voor ondernemers (art. 52 AWR). Voor
  particulieren is er geen plicht, wel een gewoonte (kennis).

**De nu-functies, bouwbaar.**

**F-P1. De kascode in Pay (L1, klein).**
- *Gegevens.* `/api/pay/kascode` bestaat al.
- *Regels.* De code geldt vijf minuten en wordt één keer gebruikt. Er is een
  paspoortpoort.
- *Rekenwijze.* Geen.
- *Onzekerheid.* Een verlopen code zegt "verlopen".
- *Wanneer hoort iemand iets.* Het lid ziet de betaling direct na de scan.
- *Rollen.* Het lid toont de code, de zaak scant.
- *Uitzonderingen.* Is er geen netwerk, dan staat er geen code en de reden
  waarom.
- *Acceptatie.* Het lid opent Pay, tikt op "Kassacode" en ziet een code met
  een aflopende tijd. Na een scan door de zaak staat de betaling in de
  geschiedenis.

**F-P2. Zoeken, eigen categorieën en export (L1/L5, middel).**
- *Gegevens.* `payBoekingen` van het lid. De categorie is een veld dat het
  lid zelf zet en dat bij Pay hoort.
- *Regels.*
  - De categorieën volgen de drie Nibud-groepen, met eigen subcategorieën.
  - Een categorie verandert het bedrag nooit.
  - De export omvat alleen de eigen boekingen, als CSV in dezelfde vorm als
    `afschrift.csv`.
- *Rekenwijze.* Het totaal per categorie per maand.
- *Onzekerheid.* "Zonder categorie" is een eigen groep en wordt nooit
  stilzwijgend ingedeeld.
- *Wanneer hoort iemand iets.* Geen melding.
- *Rollen.* Alleen het lid.
- *Uitzonderingen.* Een export van meer dan 10.000 regels gaat per jaar.
- *Acceptatie.*
  - Het lid vindt een betaling op bedrag of tekst.
  - Het lid geeft een betaling een categorie en ziet het maandtotaal.
  - Het lid downloadt een periode. Het CSV telt op tot het saldoverschil van
    die periode.

**Wat alleen RTG kan.**
- **Herkomst per cent.** Elke betaling in het huis weet waar het geld heen
  ging: de waardegraaf.
- **De betaalwaarheid.** Iets heet pas betaald na de bevestiging, ook bij
  een zorg-, reis- of horecabetaling.
- **De eigen geldgrens.** Het lid zet zelf een grens, en die weigert ook
  namens hem.

Een bank kan dat alle drie alleen binnen zijn eigen rekening.

**Bouwstenen en ontbrekende schakels.**
- Er zijn al: `metIdem`, de opdrachtenrij, de veegronden en `afschrift.csv`
  (de vorm).
- Er ontbreken:
  - het categorieveld;
  - de kascode in het scherm.

**Prioriteit.**
1. F-P1: klein en los.
2. F-P2: middel en los.
3. Een gezamenlijke pot: groot, en hangt af van de rollen in 3.

**Uitkomst A (binnen de architectuur):**
- de kascode;
- zoeken, categorieën en export;
- afrondsparen naar een eigen pot (later, middel).

**Uitkomst B (domeinmaximum):**
- een echte betaalrekening met IBAN, kaartuitgifte en valuta;
- wat daarvoor nodig is:
  - een gereguleerde bankpartner;
  - een vergunning voor elektronisch geld, of een beperkt netwerk
    (art. 1:5a Wft);
  - een Wwft-proces.

RTG levert dat niet zelf.

**Eindcontract Pay.**
1. **Breedte.** Het lid kan opladen, sturen, verzoeken, tikken, een tegoed
   en de kascode gebruiken, terugstorten, zoeken, categoriseren en
   exporteren, elk op één scherm.
2. **Diepte.** De categorieën volgen de Nibud-indeling, en de export sluit op
   het saldo.
3. **Levenscyclus.** Elke geldhandeling heeft een weg terug (terugstorten,
   terugboeken, controle afronden) die bewezen is in de simulatiebank.
4. **Rollen.** Het lid, de zaak en het kantoor zien elk alleen het hunne;
   een kantoorhandeling gebeurt op naam.
5. **Intelligentie.** Het maandtotaal per categorie wordt alleen getoond, en
   er wordt niets voorspeld zonder het label "verwacht".
6. **Los.** Als de provider uitvalt, werkt sturen uit het saldo door, en
   opladen zegt "er is niets afgeschreven".
7. **Ketens.** Zorg, assets, markt, wbw, de kassa en reis betalen via Pay en
   heten pas betaald na de bevestiging.
8. **Betrouwbaarheid.** Zie G.6.

### 1.2 Wallet (`/apps/geld.html#wallet`)

**a. Doel.** Alles wat je bij je wilt hebben (passen, kaarten, munten) op één
plek, en weten wanneer iets verloopt.

**b. Wat er is.**
- Routes (`server/routes/zorgwallet.js`): `/api/wallet`, `/voeg`, `/weg`,
  `/munt/koop` (met de paspoortpoort) en `/munt/wissel`; voor elk account
  (`eenAccount`).
- Kern: `server/kern/wallet.js`. Munten worden betaald via `pay.huisIn`; een
  herhaling geeft geen munten erbij.
- Voltooiscenario: `voltooi/wallet.js` (`link:wallet`).

**c. Objecten en eigenaar.**
- `db.data.wallet[key]` hoort bij `geld.overzicht`.
- De zorgpas komt binnen van `kern/zorgpolis.js` (walletVoeg/walletWegBron); de
  pas blijft van de verzekeraar.

**e. Rechten.** Elk account; alleen een munt kopen vraagt het paspoort.

**Zes lagen, oordeel.**
- **L1** passen en munten bestaan.
- **L2** de verzekeraar levert de zorgpas.
- **L3** niet van toepassing.
- **L4** verloopsignalen ontbreken (GELD.md fase 5).
- **L5** een pas toevoegen, laten verlopen en weghalen: het verlopen ontbreekt.
- **L6** de zorgpas komt binnen; andere passen (gemeente, sportclub,
  bibliotheek) nog niet.

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Passen en munten bewaren | L1 | bestaat | Een lid legt een kaart in de wallet en haalt hem weg; een ander lid ziet hem niet. | — | — |
| Feestmunten kopen en inwisselen | L1 | bestaat | Munten worden één keer betaald en gaan nooit onder nul. | — | — |
| Verloopsignaal per pas | L4 | ontbreekt | Dertig dagen voor een pas verloopt, ziet het lid een signaal met de pas en de datum; een pas zonder datum geeft geen signaal. | klein | nu |
| Passen uit andere apps ontvangen | L6 | half | Een pas die een andere app uitgeeft, verschijnt in de wallet als verwijzing; haalt die app hem in, dan verdwijnt hij. Vandaag doet alleen de zorgpas dat. | middel | later |
| Pass tonen aan de balie (QR) | L1 | bestaat (RTG Code) | Zie 1.4. | — | — |

**f. LOS en SAMEN.**
- **LOS.** Passen staan lokaal in de wallet. Valt Pay uit, dan kan het lid geen
  munten kopen ("er is niets afgeschreven"), maar de passen blijven zichtbaar.
- **SAMEN.** De wallet ontvangt passen als verwijzing. **Keten:** een
  verzekeraar schrijft een lid in, en de zorgpas verschijnt in de wallet.
  Stopt de polis, dan gaat de pas eruit. Valt de verzekeraar uit, dan blijft de
  laatst bekende pas staan, met de datum van de laatste stand.

**g. Betaalmuur.** De Apple- en Google-wallets zijn gratis. Hier zit geen
betaalmuur bij de marktleiders (fragment, payconiq.be/en/faq/…). De ondergrens
is dus: alles gratis, en dat zijn wij.

#### v2 — Wallet

**Bestaande werkelijkheid.**
- Registers: 3/8 en GEEN_FIXTURE (vóór de samenvoeging van het
  voltooiscenario).
- IDOR: de vermeende doorbraak op `/api/wallet/munt/koop` is nagemeten en is
  geen doorbraak. De 409 kwam van de idem-laag. Zie `b2698f2b` en
  `test/wallet-muntkoop-idor.test.js`.
- Sinds 19 oktober is de wallet er voor elk account (`eenAccount`), ook met
  de verplichte bezitspoort.

**Marktmaximum.**
- Apple Wallet en Google Wallet zijn gratis en bewaren daarbij:
  - passen;
  - kaartjes;
  - sleutels;
  - identiteitsbewijzen, waar dat wettelijk mag (kennis).
- Geen enkel fragment noemt een betaald niveau.

**Domeinmaximum.**
- Er gelden geen normen.
- Wel geldt de regel: een pas blijft van de uitgever. Dat is hier al zo voor
  de zorgpas.

**De nu-functie, bouwbaar.**

**F-W1. Het verloopsignaal (L4, klein).**

- *Gegevens.* Een optioneel veld `geldigTot` per item. Dat veld zet het lid,
  of de uitgever bij een verwijzing.
- *Regels.*
  - 30 dagen vooraf verschijnt een signaal.
  - Een item zonder datum geeft nooit een signaal.
- *Rekenwijze.* Vandaag tegen `geldigTot`, in de tijdzone van het huis
  (`kern/tijdzone`).
- *Onzekerheid.* Geen. De datum is een opgave, en dat staat erbij.
- *Wanneer hoort iemand iets.* Het lid ziet het signaal in de wallet en in de
  kalender van Geld Command. Er gaat geen push uit (geen kunstmatige urgentie).
- *Rollen.* Alleen het lid.
- *Uitzonderingen.* Een pas van een uitgever volgt de datum van die uitgever.
- *Acceptatie.*
  - Een pas met een datum over 20 dagen toont het signaal.
  - Een pas zonder datum toont het niet.
  - Een ander lid ziet het niet.

**Wat alleen RTG kan.** Passen uit het huis zelf, als verwijzing die vanzelf
vervalt wanneer de uitgever haar intrekt:

- zorgpolis;
- schoolpas;
- festivalmunten;
- RTG-pas.

**Uitkomst A.**
- Het verloopsignaal.
- Passen uit andere RTG-apps, zoals de schoolpas en het festivalbandje.

**Uitkomst B.**
- Een pas in Apple Wallet of Google Wallet.
- Wat daarvoor nodig is: een developeraccount en ondertekening, buiten RTG.

**Eindcontract Wallet.**

1. **Breedte.** Het lid kan bewaren, tonen, laten verlopen en verwijderen, en
   munten kopen en wisselen.
2. **Diepte.** Niet van toepassing (geen beroepsgroep).
3. **Levenscyclus.** Een pas wordt toegevoegd, verloopt met een signaal en
   wordt ingetrokken door de uitgever.
4. **Rollen.** De uitgever blijft eigenaar van een verwijzing. Het lid kan
   die verwijzing niet wijzigen.
5. **Intelligentie.** Alleen het verloopsignaal.
6. **Los.** Valt Pay uit, dan blijven de passen zichtbaar, maar kan het lid
   geen munten kopen.
7. **Ketens.** De zorgpas, en later de school- en festivalpas, verschijnen en
   verdwijnen met hun bron.
8. **Betrouwbaarheid.** Zie G.6.

### 1.3 De tab Betalen (`/apps/app.html#tab=betalen`)

**a. Doel.** In twee tikken een zaak of een verzoek betalen vanuit de hoofdapp.

**b. Wat er is.**
- Routes (`server/routes/member/kopen.js`): `/api/betaal/direct`, `/verzoeken`,
  `/verzoek/pay`, `/mijn`, en `/api/munt/direct`.
- Kern: `server/kern/directpay/` (direct betalen via de betaalwaarheid, met
  verzoeken van zaken).
- Voltooiscenario: `voltooi/betalen.js` (`tab:betalen`).
- Bezitspoort: `/api/betaal/` staat in de bezitspaden.

**c. Objecten en eigenaar.** `directBetalingen`, `betaalVerzoeken` en
`directOntvangsten` horen bij `geld.overzicht` via `kern/directpay`.

**e. Rechten.**
- Een lid betaalt.
- Een zaak maakt verzoeken (`routes/supplier/gastcontact.js`).
- Een gast wordt geweerd (403).

**Gemeten gat.** Er is geen paspoortpoort in `kopen.js`, terwijl Pay die op elk
geldmoment heeft. De betaalwaarheid rondt de betaling wel eerlijk af, maar de
regel "het paspoort op elk geldmoment" (besluit van 19 oktober) geldt hier
niet.

**Zes lagen, oordeel.**
- **L1** bestaat.
- **L5** de betaalwaarheid: een weigering wordt gemeld en een betaling die
  blijft hangen, wordt niet "betaald".
- **L6** de zaakverzoeken komen binnen.
- L2, L3 en L4: niet van toepassing; het overzicht zit in Pay en Geld Command.

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Een zaakverzoek betalen | L1 | bestaat | Een verzoek van een zaak wordt één keer betaald; een bankweigering wordt gemeld. | — | — |
| De paspoortpoort op direct betalen | L1 | ontbreekt | Een ongekeurd account betaalt niet en krijgt de paspoortweg; een gekeurd account wel. | klein | nu |
| De reis betalen vanuit de tab | L6 | ontbreekt | Zie 0.3: een bevestigde reis staat in de lijst met verzoeken en wordt daar betaald. | klein | nu (na de vraag aan TravelOS) |

**f. LOS en SAMEN.**
- **LOS.** Valt de betaalwaarheid uit, dan staat er "De betaalwaarheid is niet
  aangesloten; er is niets afgeschreven." (503). Staat de betaalstop aan, dan
  staat er "Betalen is tijdelijk uitgeschakeld."
- **SAMEN.** De tab ontvangt verzoeken van zaken (verzoek-ref) en geeft
  betaling-id's uit. **Keten:** een restaurant stuurt de rekening, het lid
  betaalt in de tab, en de zaak ziet de ontvangst. Weigert de bank, dan blijft
  het verzoek open; valt de zaakapp uit, dan staat de betaling bij het lid.

#### v2 — tab Betalen

**Bestaande werkelijkheid.**
- Registers: 0/8, omdat de tab geen eigen adres heeft in het register. De
  meting hangt aan `app.html`.
- Het voltooiscenario `voltooi/betalen.js` bestaat.
- Toegang meet: geen paspoortpoort.

**Marktmaximum.** Payconiq en iDEAL QR zijn gratis voor consumenten
(fragment).

**De nu-functie, bouwbaar.**

**F-T1. De paspoortpoort op direct betalen (L1, klein).**
- *Gegevens.* De sessie.
- *Regels.* `kern.onboarding.payGate(s)` op `/api/betaal/direct` en op
  `/verzoek/pay`, in dezelfde vorm als `reisPoort` in `routes/member/winkel.js`.
- *Rekenwijze.* Geen.
- *Onzekerheid.* Geen.
- *Wanneer hoort iemand iets.* Een ongekeurd account krijgt meteen de
  paspoortweg (`kyc: true`).
- *Rollen.* Het lid.
- *Uitzonderingen.* De Lifestyle- en de Business-pas zijn vrijgesteld, zoals
  overal.
- *Acceptatie.*
  - Een ongekeurd gratis account betaalt geen zaakverzoek en ziet de
    paspoortstap.
  - Een gekeurd account betaalt wel, één keer.
  - Dit is een toets die eerst zakt.

**Uitkomst A.**
- De paspoortpoort.
- Een eigen adres in het register, zodat de acht bewijzen meetbaar worden.
- Een reis betalen vanuit de tab, na R1.

**Uitkomst B.** Gelijk aan A. De markt heeft hier geen maximum boven gratis.

**Eindcontract tab Betalen.**
1. **Breedte.** Een zaakverzoek en een reis betalen in twee tikken.
2. **Diepte.** Niet van toepassing.
3. **Levenscyclus.** Het verzoek is open, wordt betaald, geweigerd of blijft
   traag, en wordt daarna afgerond.
4. **Rollen.** Alleen de zaak maakt een verzoek. Alleen het lid betaalt.
5. **Intelligentie.** Niet van toepassing.
6. **Los.** Valt de betaalwaarheid uit, dan geeft de tab 503 met "er is
   niets afgeschreven".
7. **Ketens.** De zaak ziet de ontvangst pas na de bevestiging.
8. **Betrouwbaarheid.** Zie G.6, met een eigen registeradres.

### 1.4 RTG Code (`/apps/geld.html#rtgcode`)

**a. Doel.** Laten zien wie je bent of betalen aan de balie, zonder iets
persoonlijks prijs te geven.

**b. Wat er is.**
- Routes (`server/routes/code.js`): `/api/code/dyn` en `/api/code/scan`, met
  `appSessie`.
- Kern: `server/kern/betaalcode.js` (een ondoorzichtige verwijzing van 128 bit,
  eenmalig) en `kern/dyncode.js`.
- Voltooiscenario: `voltooi/rtgcode.js` (`link:rtgcode`).

**c. Objecten en eigenaar.** `betaalcodes` (duurzaam) hoort bij
`geld.overzicht`.

**e. Rechten.**
- Een lid toont de code.
- Alleen een kassa (zaak, personeel, kantoor) verbruikt hem en krijgt de
  codenaam.
- Een lid dat scant, krijgt niets persoonlijks.

**Zes lagen, oordeel.**
- **L1** bestaat.
- **L2** de zaak scant.
- **L5** een code verloopt en wordt één keer gebruikt.
- **L6** de code wordt verbruikt in de bestaande afrekenroutes.
- L3 en L4: niet van toepassing.

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Een levende code tonen en eenmalig laten scannen | L1 | bestaat | Een kassa scant de code één keer; een tweede scan zegt "al gebruikt". Een vervalste of verlopen code wordt geweigerd. | — | — |
| Code zonder netwerk tonen | L1 | ontbreekt | Zonder verbinding toont het toestel nog een code die een paar minuten geldt en offline te controleren is. | middel | later |

**f. LOS en SAMEN.**
- **LOS.** Zonder camera staat er "Camera niet beschikbaar." Een verlopen code
  zegt "Laat een verse code tonen."
- **SAMEN.** De code is een verwijzing die de kassa inwisselt voor de codenaam.
  **Keten:** een lid laat de code zien, de kassa rekent af via Pay en het lid
  ziet de betaling. Valt Pay uit, dan geeft de kassa geen "betaald".

**g. Betaalmuur.** Payconiq, iDEAL QR en Apple Pay zijn gratis voor
consumenten; geen enkel fragment noemt een betaalde functie (fragment,
payconiq.be/en/faq/is-the-payconiq-by-bancontact-app-free-of-charge). De
ondergrens is dus gratis, en dat zijn wij.

#### v2 — RTG Code

**Bestaande werkelijkheid.**
- Registers: 3/8 en GEEN_FIXTURE, gemeten vóór het voltooiscenario.
- Een code is een verwijzing van 128 bit en wordt één keer gebruikt.

**Markt- en domeinmaximum.**
- iDEAL QR en Payconiq zijn gratis.
- EMVCo-QR is de internationale norm (kennis).

**Wat alleen RTG kan.** De kassa krijgt een codenaam en geen naam: privacy by
design aan de balie.

**Uitkomst A.** Gelijk aan wat er nu is. Daarna later, in de bak middel, een
code die offline te controleren is: een ondertekend token met een korte
geldigheid.

**Uitkomst B.** Een EMVCo-QR die ook buiten het huis werkt. Daarvoor is een
acquirer nodig.

**Eindcontract RTG Code.**
1. **Breedte.** De code wordt getoond en gescand. Een tweede scan krijgt "al
   gebruikt".
2. **Diepte.** Niet van toepassing.
3. **Levenscyclus.** De code wordt uitgegeven, gebruikt en verloopt.
4. **Rollen.** Alleen een kassa verbruikt de code. Een lid dat scant, krijgt
   niets persoonlijks.
5. **Intelligentie.** Niet van toepassing.
6. **Los.** Zonder camera of netwerk wordt dat eerlijk gezegd.
7. **Ketens.** De afrekening loopt via Pay. Valt Pay uit, dan komt er geen
   "betaald".
8. **Betrouwbaarheid.** Zie G.6.

---

## Familie 2 — rekening en overzicht

Drie apps:
- de **Bank**: de echte rekening, zodra het kantoor hem live zet;
- **Geld Command**: het overzicht met beleid, potten en vooruitblik; hier komen
  de zes uitbreidingen van de eigenaar en de zes "Beyond"-systemen samen;
- **Balans**: werk, privé en rust.

### 2.1 Bank (`/apps/geld.html#bank`)

**a. Doel.** Een eigen rekening waarop je geld ontvangt, spaart en overboekt,
met een afschrift dat klopt tot op de cent.

**b. Wat er is.**
- Routes (`server/routes/bank.js`, `bankhart.js`): akkoord, rekening/open,
  storten, overboeken, naar-wallet en van-wallet, sepa, spaardoel, passen,
  krediet, terugkerend, bulk, salaris, advies en `afschrift.csv`, plus `hart`,
  `inzichten`, `vastelasten` en `veeg`.
- Alles achter `gate`: "De RTG Bank is nog niet live voor leden."
- Kern: `server/kern/bank/*`.
  - Storten loopt via de betaalwaarheid (`stortwaarheid.js`).
  - SEPA-uit loopt via de opdrachtenrij.
  - Er draaien ronden voor rente en incasso.
- Voltooiscenario: `voltooi/bank.js` (`link:bank`).

**c. Objecten en eigenaar.** `bankRekeningen`, `bankSaldi`, `bankBoekingen`,
`bankKredieten` en `bankAkkoord` horen bij `geld.overzicht`.

**e. Rechten.**
- Een lid met een pas, en alleen als het kantoor de leden-bank live zet.
- Een zaak heeft een zakelijke rekening (`supplierAuth`).
- Het kantoor zet de regels en de schakelaar.
- Er is geen paspoortpoort in de bankroutes (gemeten).

**Zes lagen, oordeel.**
- **L1** rekening, storten, overboeken en afschrift bestaan.
- **L2** de zakelijke rekening, zzp en salaris bestaan.
- **L3** bulkbetalingen en salaris bestaan; meerdere handtekeningen binnen een
  bedrijf niet.
- **L4** `inzichten` en `vastelasten` bestaan.
- **L5** van akkoord tot sluiten, met de opdrachtenrij en rondes.
- **L6** de wallet wordt gedekt vanuit de bank (`walletbrug.js`).

**Afwijking van een harde grens (vraagt besluit).** In de code staan twee dingen
die `GELD.md` par. 7 uitsluit:
- **krediet**: `server/kern/bank/krediet.js`, leningen van € 100 tot € 50
  miljoen tegen 7% rente; het kantoor beslist;
- **advies**: `server/kern/bank/advies.js`, een AI-bankier die "concreet,
  eerlijk advies" geeft over rood staan en sparen.

Beide staan achter de leden-bank, die uit staat. Ik bouw hier niets bij en
haal ook niets weg: of ze blijven is aan de eigenaar. Krediet vraagt hoe dan
ook een vergunning.

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Rekening openen, storten, overboeken, afschrift | L1 | bestaat | Na akkoord opent het lid een rekening, stort er geld op en boekt over; het afschrift sluit. Een dubbele tik boekt één keer. | — | — |
| Meerdere eigen rekeningen (potjes met IBAN) | L1 | half | Het lid opent een spaarrekening naast de betaalrekening. Bij bunq is 5 of 25 betaald (fragment). | klein | later (na live) |
| Vaste lasten zien | L4 | bestaat | `vastelasten` toont de terugkerende afschrijvingen. | — | — |
| Paspoortpoort op de bank | L1 | ontbreekt | Een ongekeurd account opent geen rekening en krijgt de paspoortweg. | klein | nu (vóór live) |
| Gezamenlijke rekening | L3 | ontbreekt | Twee leden openen samen een rekening; elk ziet alles, en overboeken boven een grens vraagt beide. | groot | later |
| Krediet en lening | — | bestaat | — | — | **niet**, tenzij de eigenaar anders besluit: GELD.md par. 7 sluit krediet uit, en het vraagt een vergunning |
| AI-bankier "advies" | L4 | bestaat | — | — | **vraagt besluit**: alleen uitleg en geen advies. De tekst herschrijven naar de fiscale klassen ("advies" betekent: een mens beoordeelt) |

**f. LOS en SAMEN.**
- **LOS.** Staat de bank niet live, dan toont het scherm "RTG Rekening opent hier
  zodra RTG hem live zet. Je RTG Pay-wallet werkt gewoon door." De wallet blijft
  werken.
- **SAMEN.** De bank geeft een IBAN en een boekingsnummer uit, dekt de wallet
  (`pay.koppelBank`) en ontvangt salaris.

**Keten.** Het salaris komt binnen via de payroll. De bank boekt het, en Geld
Command toont "inkomen verwacht en binnen".

Storingen:
- Valt de payroll uit, dan blijft de bankboeking staan.
- Valt de bank uit, dan heet het salaris "verwacht" en niet "ontvangen".

**g. Betaalmuur** (fragment):
- bunq: extra IBAN's en het aanmaken van een gezamenlijke rekening zijn
  betaald (us.fitgap.com/products/bunq;
  help.bunq.com/articles/whats-a-joint-account-and-how-do-i-create-one).
- Monzo Extra: andere banken koppelen en eigen categorieën
  (monzo.com/current-account/extra).

Wij hebben:
- de rekening;
- de vaste lasten (gratis);
- half: meerdere rekeningen;
- niet: de gezamenlijke rekening.

**j. Extern.**
- Een bankvergunning, of een gereguleerde bankpartner; zonder dat blijft de
  leden-bank uit.
- SEPA via een partner.
- Krediet: een vergunning plus een eigen besluit.

#### v2 — Bank

**Bestaande werkelijkheid.**
- Registers: 3/8 en GEEN_FIXTURE.
- IDOR: `/api/bank` is onbereikbaar, omdat de leden-bank uit staat.
- Toegang meet: geen paspoortpoort.
- Krediet en de AI-bankier staan in de code (G.5-2).

**Marktmaximum** (fragment):
- **bunq Elite.** 25 IBAN's, ZeroFX en reisverzekering.
- **Revolut Ultra.** Lounges en lagere handelskosten.
- **Gezamenlijke rekening.** Bij bunq is die betaald.

**Domeinmaximum.**
- **Wat een rekening is.** Een rekening met IBAN is een bankproduct
  (vergunning) of een betaalinstellingsproduct.
- **Beslag.** Bij beslag geldt de beslagvrije voet (95%, G.2). Die moet een
  bank respecteren.
- **Schuldhulp.** Bij schuldhulp is een budgetbeheerrekening gebruikelijk
  (kennis).

**De nu-functie, bouwbaar.**

**F-B1. De paspoortpoort op de bank, vóór de bank live gaat (L1, klein).**
- *Gegevens.* De sessie.
- *Regels.* `payGate` op `rekening/open`, `storten`, `overboeken`, `sepa`,
  `naar-wallet` en `van-wallet`.
- *Rekenwijze.* Geen.
- *Onzekerheid.* Geen.
- *Wanneer hoort iemand iets.* Het lid krijgt meteen de paspoortweg.
- *Rollen.* Het lid.
- *Uitzonderingen.* Lifestyle en Business, en de zakelijke rekening
  (`supplierAuth`, met een eigen keuring).
- *Acceptatie.* Met de leden-bank live (toets-env) opent een ongekeurd account
  geen rekening, en een gekeurd account wel.

**Wat alleen RTG kan.**
- **`walletbrug`.** De bank dekt de wallet binnen één huis.
- **Salaris.** Het salaris van de payroll komt op de eigen rekening en staat
  als "verwacht" in Geld Command.

**Uitkomst A.**
- de paspoortpoort;
- meerdere eigen rekeningen (na live);
- een gezamenlijke rekening met tweemansbevestiging boven een grens (groot,
  later).

**Uitkomst B.**
- echte IBAN's en SEPA;
- beslagvrije-voetbewaking;
- een budgetbeheerrekening samen met schuldhulp.

Wat daarvoor nodig is:
- een bankvergunning of een gereguleerde bankpartner;
- Wwft;
- DNB-toezicht.

Krediet hoort hier niet bij (GELD.md par. 7).

**Eindcontract Bank.**
1. **Breedte.** Openen, storten, overboeken, afschrift, vaste lasten en
   meerdere rekeningen.
2. **Diepte.** Het afschrift sluit tot op de cent. De vaste lasten volgen de
   Nibud-groep "vaste lasten".
3. **Levenscyclus.** Akkoord, openen, gebruiken, sluiten. De opdrachtenrij
   draait terug bij `MISLUKT_RAIL`.
4. **Rollen.** Het lid, de zaak en het kantoor zetten elk hun eigen deel. Een
   kantoorhandeling gebeurt op naam.
5. **Intelligentie.** De inzichten zijn uitleg, met een fiscale klasse.
   Advies geven ze niet.
6. **Los.** Zolang de bank niet live is, werkt de wallet door. Valt de bank
   uit, dan heet salaris "verwacht".
7. **Ketens.** De payroll schrijft naar de bank, de bank naar de wallet en de
   wallet naar Geld Command, elk één keer.
8. **Betrouwbaarheid.** Zie G.6, en IDOR met de leden-bank live.

### 2.2 Geld Command (`/apps/geld.html`, eerste stand)

**a. Doel.** In één oogopslag weten hoe je ervoor staat, wat er aankomt en
wat je moet doen, en verder niets.

**b. Wat er is.**
- Routes (`server/routes/geld.js`): `/api/geld/cockpit`, beleid,
  pot/zet/reserveer/weg, actielog, grens/zet/weg, en `/api/geld/rahul`.
- Kern:
  - `server/kern/geldbeleid/` (regels met vier niveaus, potten, een harde
    geldgrens die weigert, het actielog: alleen toevoegen, maximaal 200);
  - `server/kern/geldgraaf/` (een alleen-lezen projectie over wallet, wbw,
    mecenaat, labfonds en payroll; `patronen.js` herkent terugkerende posten;
    `vooruitblik.js` geeft het verwachte saldo per horizon; `tijdlijn`).
- Voltooiscenario: `voltooi/geldcommand.js` (`link:geldcommand`).
- GELD.md fase 1 staat "in aanbouw"; fase 2 tot en met 5 nog niet.

**c. Objecten en eigenaar.** `geldbeleid.perLid[codenaam]` (regels, potten, log,
grenzen) hoort bij `geld.overzicht`. De geldgraaf heeft niets eigens; hij is een
projectie.

**e. Rechten.**
- Alleen een lid met een pas: `geenGast` weigert ook een gratis account ("RTG
  Geld is voor leden.").
- **Vraagt besluit**: valt Geld Command onder "minimaal een account", zoals
  Wallet en Pay?

**Zes lagen, oordeel.**
- **L1** beleid, potten en grens bestaan.
- **L4** de vooruitblik en de patronen bestaan; scenario's ontbreken.
- **L5** het actielog bestaat; een jaararchief ontbreekt.
- **L6** de projectie over vijf bronnen bestaat.
- L2 en L3: niet van toepassing, of bij Bank en Pay.

**De zes uitbreidingen van de eigenaar, naast wat er al is.**

| Functie | Laag | Stand | Wat er al voor is | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Vermogensoverzicht | L1 | half | `/api/pay/portefeuille` (vrij besteedbaar en gebonden, per positie), `bank/overzicht` | Het lid ziet al zijn eigen posities bij RTG naast elkaar, en zelf ingevoerde bezittingen en schulden apart gemarkeerd als "eigen opgave". Er is geen totaal zonder bron. Bij Emma Pro, bij Monarch Core (fragment). | middel | nu |
| Schuldenplanning (aflosplan) | L4 | ontbreekt | niets (alleen in het spel Magnaat) | Het lid voert zelf een schuld in met bedrag, rente en termijn, en ziet hoe lang aflossen duurt bij een gekozen bedrag per maand. Er staat bij dat dit een rekensom is, geen advies. Undebt.it heeft het gratis (fragment). | middel | nu |
| Contracten en abonnementen | L1/L4 | half | `geldgraaf/patronen.js` herkent terugkerende posten; `bank/vastelasten` | Het lid ziet zijn terugkerende afschrijvingen als lijst, kan er zelf een contract met einddatum en opzegtermijn aan koppelen, en krijgt een signaal vóór de opzegdatum. Opzeggen doet het lid zelf. Dyme heeft een gratis overzicht; bij Rocket Money is een opzegdienst betaald (fragment). | middel | nu |
| Prijsstijging en ongebruikt abonnement | L4 | ontbreekt | `patronen.js` (ritme, geen bedrag) | Stijgt een terugkerende post, dan ziet het lid het verschil en de datum. "Ongebruikt" verschijnt alleen als het lid zelf aangeeft dat hij het niet gebruikt. GELD.md fase 2. | klein | nu |
| Huishoudscenario's | L4 | half | `kern/fiscaal/scenario.js` (zaken: personeel, omzet; schrijft niets); `geldgraaf/vooruitblik.js` | Het lid kiest "wat als" (een reis, een aankoop, minder inkomen) en ziet het verwachte saldo per maand ernaast, met de aanname. Niets wordt opgeslagen als feit. GELD.md fase 2. Bij Monarch is forecasting alleen Plus (fragment). | middel | nu |
| Verplichtingenkalender en financiële gebeurtenissen | L4/L6 | half | `vooruitblik.js` neemt gedateerde verplichtingen mee; `kern/commercie/contract/verplichting.js` (RTG-contracten) | Het lid ziet per maand wat er vast moet gebeuren (verwachte afschrijving, bevestigde reis, servicefee, contractdatum), elk met een verwijzing naar de app die het bezit. Wat geen datum heeft, staat apart. Monarch heeft een kalender (fragment). | middel | nu |
| Gezamenlijke budgetten | L3 | ontbreekt | WBW (een gedeeld lijstje), potten (per lid) | Twee leden maken samen een budget; elk ziet de stand; wat privé blijft, blijft privé. Bij Emma alleen Ultimate (fragment). | groot | later |
| Kasstroomprognose | L4 | half | `vooruitblik.js` (7/30/90 dagen) | Het lid ziet de verwachte in- en uitstroom per week of maand; verwacht heet "verwacht", nooit "geboekt"; een post zonder datum telt niet mee. | klein | nu |
| Besluitvergelijking | L4 | ontbreekt | `fiscaal/scenario.js`-vorm | Het lid zet twee keuzes naast elkaar (huren of kopen, nu of later betalen) met zijn eigen getallen, en ziet het verschil per jaar. Geen advies over beleggen, krediet of verzekeren; de uitkomst draagt de fiscale klasse "advies". | middel | later |
| Langetermijnplanning | L4 | ontbreekt | potten met doel | Het lid zet een doel met bedrag en datum en ziet hoeveel per maand nodig is. Er is geen rendement of beleggingsaanname. Boldin noemt Monte Carlo betaald (fragment); dat doen wij niet. | middel | later |

**De zes "Beyond"-systemen van de eigenaar, naast wat er al is.** Er komt geen
nieuwe laag (bijstelling van 19 oktober):

| Systeem | Bestaat al als | Wat het nog vraagt |
|---|---|---|
| Financiële werkelijkheid | geldgraaf (projectie over vijf bronnen), portefeuille, de betaalwaarheid (alleen bevestigd heet betaald) | meer bronnen als verwijzing: bank, reis, assets, zorg |
| Toekomstsimulator | `geldgraaf/vooruitblik.js`, `fiscaal/scenario.js` | huishoudscenario's (hierboven) |
| Beslismotor | `geldbeleid/regels.js` en `evalueer.js` (vier niveaus, gift-bevestiging) | besluitvergelijking (hierboven) |
| Contractbewaking | `patronen.js`, `bank/vastelasten` | een contract koppelen met opzegtermijn (hierboven) |
| Automatisering met goedkeuring | geldbeleid: automatisch alleen de maandelijkse reservering binnen het eigen tegoed; de rest klaarzetten. Stuurlaag: `kern/stuur/beleid.js`, `mandaat.js` | niets nieuws; de grens blijft (geld verlaat het huis nooit vanzelf) |
| Financieel geheugen | `geldbeleid/actielog.js` (alleen toevoegen), `geldgraaf.tijdlijn` | een jaaroverzicht en export (Familie 1, Pay) |

**f. LOS en SAMEN.**
- **LOS.** Valt een bron uit, dan zegt het overzicht "Niet opgehaald: … Dit
  beeld is niet compleet." (`overzicht.js:122`) en rekent niet verder op een
  gat. Geld Command werkt met wat er is.
- **SAMEN.** Geld Command ontvangt projecties van Pay, WBW, Mecenaat, Labfonds
  en payroll, en (voorstel) van een reis, assets en wonen (zie L6 hieronder).
  Het geeft alleen links uit naar `/apps/geld.html#<stand>`.

**Keten.** Een lid zet een pot voor de huur. De geldgrens weigert een betaling
die de buffer zou breken. Het actielog bewaart beide.

Storingen:
- Valt de geldgraaf uit, dan blijven pot en grens werken; de grens zit in de
  betaalpoort.

**Ontvangen ketens (L6), uit LivingOS-A en -B (voorlopig).**
- **Assets:** koop en herroeping via de betaalwaarheid. De servicefee: het
  voorstel is dat Assets eigenaar blijft en Geld alleen de projectie in de
  verplichtingenkalender toont.
- **Wonen:** woonlasten. Een eigen verplichtingenobject bestaat niet. Het
  voorstel aan de eigenaar is "verplichting van Geld"; tot dan geldt "Wonen
  verwijst".
- **Vakwerk:** een betaling per opdracht met bronRef.
- **Sport:** een stadionticket.
- **Mall en foodcourt:** bestellingen.
- **Table:** een aanbetaling, waar die bestaat.

Bij alle ketens geldt: het lid bevestigt elke betaling, en geen gegevens
worden gedeeld.

**g. Betaalmuur** (fragment, 19 oktober 2026):
- YNAB: alles betaald, er is geen gratis laag (ynab.com/pricing).
- Monarch Core: budgetten, nettovermogen en een gedeelde partner; Plus-only:
  forecasting en het modelleren van levensgebeurtenissen
  (help.monarch.com/hc/en-us/articles/48349699981972-Monarch-Plus-Tier).
- Emma Pro: nettovermogen, eigen categorieën en export; Ultimate-only: "Spaces"
  (een gedeeld budget)
  (help.emma-app.com/en/article/what-are-the-features-of-emma-plus-pro-and-ultimate-678fjp/).
- Dyme (NL): een gratis abonnementsoverzicht; budgetten en export betaald
  (financer.nl/persoonlijke-financien/dyme-app-review).

Wij hebben:
- budgetregels, potten, de vooruitblik en de terugkerende posten (gratis);
- half: het vermogensoverzicht;
- niet: scenario's, de gezamenlijke budgetten en de kalender als scherm.

**j. Extern.** Een bankkoppeling met andere banken (PSD2) vraagt een
AISP-vergunning of -partner; tot dan alleen RTG-bronnen en de eigen opgave.

#### v2 — Geld Command

**Bestaande werkelijkheid.**
- Registers: 3/8 en GEEN_FIXTURE.
- `geenGast` weigert een gratis account (G.5-1).
- `GELD.md` fase 1 staat "in aanbouw".

**Marktmaximum** (fragment):

| Aanbieder | Duurste niveau | Wat het niveau geeft | Bron |
|---|---|---|---|
| Monarch | Plus | forecasting, levensgebeurtenissen | help.monarch.com/hc/en-us/articles/48349699981972 |
| Emma | Ultimate | Spaces, een gedeeld budget | help.emma-app.com/en/article/what-are-the-features-of-emma-plus-pro-and-ultimate-678fjp/ |
| YNAB | volledig betaald | — | ynab.com/pricing |
| Boldin | betaald niveau | Monte Carlo | — |
| Rocket Money | betaald niveau | opzegdienst | — |

Het maximum van de markt is dus:
- vermogen;
- forecast;
- levensgebeurtenissen;
- een gedeeld budget;
- een opzegdienst.

**Domeinmaximum.**
- **Nibud.** Drie groepen uitgaven, een referentiebudget en een buffer.
- **Budgetcoach.** Werkt met een maandbegroting, een kasboek en een
  betalingsachterstandenlijst.
- **Vroegsignalering.** Huur, zorgverzekering, energie en water zijn de vier
  signaalposten (Wgs).
- **FFP-planner.** Levensloopscenario's, maar zonder productadvies (G.2).

**De nu-functies, bouwbaar.** Elk gebouwd op de geldgraaf en het geldbeleid,
zonder nieuwe motor.

**F-GC1. Vermogensoverzicht (L1, middel).**
- *Gegevens.*
  - De posities bij RTG: `/api/pay/portefeuille`, `bank/overzicht`,
    assets als projectie.
  - De eigen opgave: een lijst `{soort: bezit | schuld, naam, centen, peildatum}`
    in `geldbeleid.perLid`.
- *Regels.*
  - De opgave is nooit een RTG-bron. Er wordt nooit een koers opgehaald of
    een waarde geschat.
- *Rekenwijze.*
  - Het totaal is de RTG-posten plus de opgave.
  - Beide staan apart getoond, met de peildatum.
- *Onzekerheid.*
  - Een opgave ouder dan 12 maanden heet "verouderd".
  - Valt een bron uit, dan staat er "niet opgehaald" en is er geen totaal.
- *Wanneer hoort iemand iets.* Geen melding.
- *Rollen.* Alleen het lid.
- *Uitzonderingen.* Een schuld zonder bedrag wordt geweigerd.
- *Acceptatie.*
  - Het lid ziet zijn RTG-saldo en zijn eigen opgave apart, met een totaal.
  - Valt Pay uit, dan verdwijnt het totaal en staat er "niet opgehaald".

**F-GC2. Aflosplan als rekensom (L4, middel).**
- *Gegevens.* De schulden uit de opgave, met rente (zoals de lener die
  opgeeft) en een bedrag per maand.
- *Regels.*
  - Het is een rekensom en geen advies.
  - Er staat geen product bij, geen oversluiten en geen volgorde-aanbeveling.
- *Rekenwijze.* Annuïtair:
  `n = -ln(1 - r·S/B) / ln(1 + r)`, met `r` de maandrente, `S` de schuld en
  `B` het maandbedrag.
- *Onzekerheid.*
  - De uitkomst heeft de klasse **uitlegbaar**.
  - Is `B ≤ r·S`, dan staat er "met dit bedrag wordt de schuld niet kleiner".
- *Wanneer hoort iemand iets.* Geen melding.
- *Rollen.* Alleen het lid.
- *Uitzonderingen.* Bij een betalingsachterstand verwijst het scherm naar
  gemeentelijke schuldhulp, met het nummer en zonder doorverkoop.
- *Acceptatie.*
  - € 5.000 tegen 6% met € 200 per maand geeft 27 maanden.
  - € 5.000 tegen 6% met € 25 per maand geeft "wordt niet kleiner".

**F-GC3. Contracten en abonnementen (L1/L4, middel).**
- *Gegevens.*
  - Herkenning: `geldgraaf/patronen.js` en `bank/vastelasten`.
  - Opgave per contract: `{naam, centen, ritme, einde, opzegtermijn}`.
- *Regels.*
  - De vorm komt uit `server/bedrijf/contract.js` (`laatsteOpzegdag`).
  - Opzeggen doet het lid zelf. RTG zegt nooit iets op namens het lid.
- *Rekenwijze.*
  - `laatsteOpzegdag = einde − opzegtermijn`.
  - Een prijsstijging is het laatste bedrag min het vorige bedrag van hetzelfde
    patroon.
- *Onzekerheid.*
  - Een herkend patroon heet "herkend, niet bevestigd" tot het lid het
    bevestigt.
  - "Ongebruikt" staat er alleen als het lid dat zelf aangeeft.
- *Wanneer hoort iemand iets.* 30 dagen en 7 dagen vóór de `laatsteOpzegdag`,
  in de kalender.
- *Rollen.* Alleen het lid.
- *Uitzonderingen.* Een contract zonder einddatum geeft geen opzegsignaal.
- *Acceptatie.*
  - Een herkende maandpost van € 12,99 wordt bevestigd als contract met een
    einde en een maand opzegtermijn.
  - Het signaal verschijnt op de juiste dag.
  - Een stijging naar € 14,99 toont + € 2,00 en de datum.

**F-GC4. Verplichtingenkalender (L4/L6, middel).**
- *Gegevens.*
  - De projecties uit G.3: reis, school, assets en later wonen.
  - De contracten uit F-GC3.
  - De verwachte posten uit `vooruitblik.js`.
- *Regels.*
  - Elke regel draagt de `link` naar de eigenaar.
  - Geld bewaart niets.
  - Een bron die uitvalt, krijgt "niet opgehaald".
- *Rekenwijze.* Gesorteerd per maand. Een regel zonder datum staat apart.
- *Onzekerheid.*
  - "Verwacht" en "geboekt" zijn zichtbaar verschillend.
  - De vier signaalposten van de Wgs (huur, zorg, energie, water) worden niet
    automatisch herkend. Het lid markeert ze, en dan krijgen ze voorrang in de
    weergave.
- *Wanneer hoort iemand iets.* Een vervaldag van een eigenaar (school) die
  binnen 7 dagen valt, verschijnt bovenaan. Er gaat geen push uit.
- *Rollen.* Alleen het lid.
- *Uitzonderingen.* Een bron die het lid niet koppelt, verschijnt niet.
- *Acceptatie.*
  - Een bevestigde reis, een schoolfactuur met vervaldag en een contract
    staan in dezelfde maand, elk met een link.
  - Valt School uit, dan staat er "niet opgehaald: School".

**F-GC5. Huishoudscenario's en kasstroomprognose (L4, middel).**
- *Gegevens.* `vooruitblik.js` (7, 30 en 90 dagen), uitgebreid naar 12
  maanden, plus de vorm van `fiscaal/scenario.js`.
- *Regels.*
  - Een scenario schrijft niets.
  - Er is geen rendement en geen inflatie, tenzij het lid die zelf invult, en
    dan staat het erbij.
- *Rekenwijze.* Het verwachte saldo per maand is het saldo, plus de
  verwachte instroom, min de verwachte uitstroom, plus of min de wijziging
  van het scenario.
- *Onzekerheid.*
  - Alles na vandaag heet "verwacht".
  - Na 3 maanden staat er een band: de laagste en de hoogste maand van het
    patroon in het afgelopen jaar.
  - De uitkomst heeft de klasse **uitlegbaar**.
- *Wanneer hoort iemand iets.* Zakt de prognose onder de eigen buffer uit het
  geldbeleid, dan verschijnt dat in het overzicht. Geld verplaatst niets.
- *Rollen.* Alleen het lid.
- *Uitzonderingen.* Met minder dan 2 maanden geschiedenis is er geen band.
- *Acceptatie.*
  - "Reis van € 2.200 in juni" verlaagt de verwachte stand in juni en later
    met precies € 2.200.
  - Er wordt niets opgeslagen.

**Later.** Elk met de reden:
- **Een gezamenlijk budget.** Groot, en vraagt de rollen uit hoofdstuk 3.
- **Besluitvergelijking en lange termijn.** Middel, met een doelbedrag en
  datum zonder rendement.
- **De fiscale klasse "advies"** zodra er een keuze tussen producten in zit.

**Wat alleen RTG kan.**
- Geld Command ziet de verplichtingen van het hele huis (reis, school,
  assets) als verwijzing, zonder bankkoppeling.
- De harde geldgrens weigert ook in die andere domeinen.
- Het actielog laat zien wie wat besloot.

**Bouwstenen en ontbrekende schakels.**
- De projectievorm uit G.3 ontbreekt bij de eigenaren.
- Volgorde: eerst reis (R3), dan school en assets.

**Prioriteit.**
1. F-GC4, de kalender. Die bundelt ketens.
2. F-GC3.
3. F-GC5.
4. F-GC1.
5. F-GC2.

**Uitkomst A.** F-GC1 tot en met F-GC5, en de zes Beyond-systemen als
bestaande bouwstenen (tabel in versie 1).

**Uitkomst B.**
- Een koppeling met andere banken, die alle rekeningen automatisch in het
  vermogen en de kasstroom zet. Nodig: een AISP-vergunning of -partner (PSD2).
- Samenwerken met een schuldhulporganisatie (Wgs en NVVK), waarbij het lid zelf
  toestemming geeft om te delen. Nodig: afspraken met de gemeente of NVVK-leden.
- Bij een productkeuze een gelicentieerd adviseur. Nodig: een
  Wft-vergunning, buiten RTG.

**Eindcontract Geld Command.**
1. **Breedte.** Vermogen, schulden, contracten, kalender, scenario's,
   kasstroom, beleid, potten en grens.
2. **Diepte.** De Nibud-groepen, de Wgs-signaalposten als markering en een
   aflosrekensom die klopt op het voorbeeld.
3. **Levenscyclus.** Een contract van herkend tot bevestigd tot opgezegd. Een
   scenario wordt gemaakt en weggegooid zonder spoor.
4. **Rollen.** Alleen het lid. Een gezamenlijk budget pas met toestemming van
   beide.
5. **Intelligentie.** "Verwacht" is nergens "geboekt". Elke uitkomst draagt
   een klasse. Er is geen productadvies.
6. **Los.** Valt een bron uit, dan staat er "niet opgehaald" en is er geen
   totaal.
7. **Ketens.** Reis, school en assets verschijnen als verwijzing en
   verdwijnen bij betaling of afzegging.
8. **Betrouwbaarheid.** Zie G.6.

### 2.3 Balans (`/apps/geld.html#balans`)

**a. Doel.** Rust: zien of je week ademt, zonder dat iemand je bijhoudt.

**b. Wat er is.**
- Routes: `/api/balans` (`server/routes/balans.js`) en `/api/staff/balans`.
- Kern: `server/kern/balans.js`, een weekbeeld uit de eigen agenda en de
  grootboekrijen, met adviezen. Er wordt niets nieuws vastgelegd.
- Voltooiscenario: `voltooi/balans.js` (`link:balans`).

**c. Objecten en eigenaar.** Balans heeft niets eigens; het leest de agenda en
de boekingen.

**Zes lagen, oordeel.**
- **L1** het weekbeeld bestaat.
- **L4** de adviezen zijn regels, geen voorspelling.
- **L6** leest de agenda en Pay.
- L2, L3 en L5: niet van toepassing. Het weekbeeld voor personeel (`staff`)
  bestaat al.

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Weekbeeld en rustadvies | L1 | bestaat | Een lege week "ademt"; een volle week geeft een rustadvies; een ander lid ziet niets. | — | — |
| Trend over meerdere weken | L4 | ontbreekt | Het lid ziet vier weken naast elkaar; er wordt niets opgeslagen, alles wordt berekend uit de agenda. Reclaim heeft analyse in een betaald pakket (fragment). | klein | later |
| Financieel welzijn (GELD.md fase 3) | L4 | ontbreekt | Balans toont naast de tijd ook de vrije ruimte deze maand, uit Geld Command, als verwijzing. | middel | later |

**f. LOS en SAMEN.**
- **LOS.** Zonder agenda toont Balans een lege week en zegt dat de agenda de
  bron is.
- **SAMEN.** Balans leest de agenda en Pay; het geeft niets uit.

**Keten.** Een lid plant vier avonden; Balans raadt een rustdag aan.
- Valt de agenda uit, dan geeft Balans geen verzonnen beeld.

**g. Betaalmuur** (fragment): Reclaim Starter (People Analytics) en Clockwise
Teams (team analytics) zijn betaald (reclaim.ai/pricing,
support.getclockwise.com/article/75-clockwise-plan-offerings). Wij hebben het
weekbeeld gratis; een trend niet.

#### v2 — Balans

**Bestaande werkelijkheid.** Registers: 3/8 en GEEN_FIXTURE. Het scenario is
geregistreerd (`87039a31`).

**Marktmaximum.** Reclaim en Clockwise geven analyse in een betaald niveau
(fragment).

**Domeinmaximum.** Over werkdruk zijn er de arbo-normen, maar die zijn voor de
werkgever. Balans is voor het lid zelf en meet geen werk voor een baas.

**Wat alleen RTG kan.** De tijd en het geld van hetzelfde lid naast elkaar,
zonder dat iemand anders meekijkt.

**Uitkomst A.**
- Een trend over vier weken, berekend en niet opgeslagen.
- De vrije ruimte deze maand uit F-GC5, als verwijzing.

**Uitkomst B.** Gelijk aan A. Er is geen extern maximum dat RTG nodig heeft.

**Eindcontract Balans.**
1. **Breedte.** Weekbeeld, trend en vrije ruimte.
2. **Diepte.** Niet van toepassing.
3. **Levenscyclus.** Alles berekend, niets bewaard.
4. **Rollen.** Alleen het lid. Het weekbeeld van het personeel ziet geen
   leden.
5. **Intelligentie.** Een advies is een regel en geen voorspelling.
6. **Los.** Zonder agenda zegt Balans dat.
7. **Ketens.** De agenda en Pay worden gelezen, en er wordt niets
   geschreven.
8. **Betrouwbaarheid.** Zie G.6.

---

## Familie 3 — samen geld

### 3.1 WBW, Wie betaalt wat (`/apps/geld.html#wbw`)

**a. Doel.** Met vrienden samen uitgeven zonder ruzie: weten wie wat betaalde en
het in één tik rechtzetten.

**b. Wat er is.**
- Routes (`server/routes/wbw.js`): mijn, maak, groep, uitgave, verreken en
  verzoek.
  - `verreken` heeft de paspoortpoort en de bezitspoort.
  - `geenGast` weigert elk gratis account ("Wie betaalt wat is voor leden.").
- Kern: `server/kern/wbw.js`.
  - Alleen Salon-vrienden.
  - Een exacte verdeling tot op de cent.
  - Verrekenen loopt via `pay.stuur`, met een sleutel per boeking.
- Voltooiscenario: `voltooi/wbw.js` (`link:wbw`).

**c. Objecten en eigenaar.** `wbwGroepen` (kern/wbw) hoort bij
`geld.overzicht`. De vriendschap blijft van de Salon.

**e. Rechten.**
- Alleen een lid met een pas.
- Alleen Salon-vrienden kunnen in een groep.
- Grenzen: 50 groepen, 12 leden en 500 regels; € 25.000 per uitgave.
- **Vraagt besluit**: een gratis account mag sinds 19 oktober sturen en
  betaalverzoeken doen, maar WBW weigert het nog.

**Zes lagen, oordeel.**
- **L1** groep, uitgave en verrekenen bestaan.
- **L4** alleen de verdeling; geen statistiek.
- **L5** verrekenen gaat één keer, ook bij een crash. Een verzoek heeft geen
  sleutel.
- **L6** de Salon (vrienden) en Pay (stuur, Klompje).
- L2 en L3: niet van toepassing.

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Groep, uitgave en exacte verdeling | L1 | bestaat | Drie vrienden delen een rekening; de stand klopt tot op de cent; een buitenstaander ziet niets. | — | — |
| In één tik verrekenen | L1 | bestaat | Wie rood staat, verrekent via RTG Pay; een dubbele tik betaalt één keer. | — | — |
| Onbeperkt uitgaven | L1 | bestaat | Er is geen daglimiet. Splitwise Free heeft er een (fragment). | — | — |
| Bon per regel splitsen | L1 | ontbreekt | Het lid splitst een uitgave per regel van de bon over verschillende mensen. Splitwise Pro (fragment). | middel | later |
| Valuta omrekenen in de groep | L1 | ontbreekt | Een uitgave in een andere munt telt in euro mee, met de koers en datum erbij. Splitwise Pro (fragment). | middel | later |
| Export en afrekenoverzicht | L5 | ontbreekt | Het lid downloadt de groep met alle regels en de eindstand. Tricount haalde dit weg (fragment). | klein | nu |
| Een sleutel op het verzoek | L5 | ontbreekt | Twee tikken op "vraag" maken één betaalverzoek. | klein | nu |
| Automatisch de groep herkennen (GELD.md fase 4) | L4 | ontbreekt | — | — | later: het vraagt context van reis en salon, en eerst toestemming |

**f. LOS en SAMEN.**
- **LOS.** Valt Pay uit, dan houdt het lijstje de stand. Verrekenen zegt dat
  betalen nu niet kan, en de stand blijft onveranderd.
- **SAMEN.** Leest de vriendschap uit de Salon; verrekent via Pay; geeft een
  verwijzing per groep uit.

**Keten.** Een weekend weg (reis):
1. Iedereen zet uitgaven in de groep.
2. Wie rood staat, verrekent.
3. Pay boekt het.
4. Geld Command toont het als uitgave aan een vriend.

Storingen:
- Valt de Salon uit, dan blijft een bestaande groep werken, maar kan er geen
  nieuw lid bij.
- Weigert Pay, dan blijft de schuld staan en heet het niet "verrekend".

**g. Betaalmuur** (fragment):
- Splitwise Pro: onbeperkt uitgaven, bonscan, per regel splitsen, omrekenen,
  grafieken en zoeken
  (androidcentral.com/apps-software/the-app-splitwise-is-the-best-hack-to-split-group-trip-expenses-in-2026).
- Tricount: gratis, maar export en statistiek zijn weggehaald
  (help.tricount.com/articles/what-happened-with-tricount-premium).
- Tikkie: gratis (abnamro.nl/…/tikkie/).

Wij hebben:
- onbeperkt, en direct verrekenen;
- niet: per regel splitsen, omrekenen en export.

#### v2 — WBW

**Bestaande werkelijkheid.**
- Registers: 3/8 en GEEN_FIXTURE.
- IDOR: onbereikbaar.
- Toegang meet: geen bezitspoort op de walletbelastende route.
- `geenGast` (G.5-1).

**Marktmaximum** (fragment):
- **Splitwise Pro:** bonscan, splitsen per regel, valuta, grafieken.
- **Tricount:** de premiumversie is weggehaald.
- **Tikkie:** gratis.

**Domeinmaximum.** De vier Nibud-verdeelmethoden (G.2):
- naar inkomen;
- gelijk overhouden;
- helft-helft;
- een vaste bijdrage.

Een verenigingskas legt verantwoording af.

**De nu-functies, bouwbaar.**

**F-WB1. Export en afrekenoverzicht (L5, klein).**
- *Gegevens.* De regels en de stand van de groep.
- *Regels.* Elk lid van de groep mag exporteren, alleen deze groep, als CSV
  en als printbare pagina.
- *Rekenwijze.* De bestaande exacte verdeling.
- *Onzekerheid.* Geen.
- *Wanneer hoort iemand iets.* Geen melding.
- *Rollen.* Elk lid van de groep.
- *Uitzonderingen.* Een lid dat uit de groep is, kan niet meer exporteren.
- *Acceptatie.* De export van een groep met drie leden telt per lid op tot de
  stand op het scherm, tot op de cent.

**F-WB2. Een sleutel op het verzoek (L5, klein).**
- *Gegevens.* Het verzoek.
- *Regels.* `metIdem` met de sleutel `wbw-verzoek:groep:van:aan:stand`.
- *Rekenwijze.* Geen.
- *Onzekerheid.* Geen.
- *Wanneer hoort iemand iets.* De ontvanger krijgt één verzoek.
- *Rollen.* Het lid dat rood staat, krijgt het verzoek.
- *Uitzonderingen.* Verandert de stand, dan mag er een nieuw verzoek komen.
- *Acceptatie.*
  - Twee tikken maken één Klompje.
  - Dit is een toets die eerst zakt.

**F-WB3. De verdeelmethode kiezen (L4, klein).**
- *Gegevens.* Per uitgave een methode: gelijk, vaste bedragen of naar
  verhouding.
- *Regels.* Naar inkomen alleen als elk lid zijn eigen verhouding opgeeft.
  RTG leest geen inkomen.
- *Rekenwijze.* De exacte verdeling, met resten volgens de bestaande regel.
- *Onzekerheid.* Geen.
- *Wanneer hoort iemand iets.* Geen melding.
- *Rollen.* De groep.
- *Uitzonderingen.* Een verhouding die niet optelt tot 100, wordt geweigerd.
- *Acceptatie.* Een verhouding van 60/40 op € 100,01 geeft € 60,01 en
  € 40,00.

**Wat alleen RTG kan.**
- Verrekenen in één tik binnen het huis, met de betaalwaarheid.
- Een groep alleen van Salon-vrienden.
- Na een reis (TravelOS) een groep met de reisgenoten. Dat kan pas na
  toestemming van elke genoot (later).

**Uitkomst A.** F-WB1 tot en met F-WB3, en later valuta met de koers en de
datum erbij.

**Uitkomst B.**
- Een bonscan met OCR. Kan lokaal-eerst zonder extern model.
- Verrekenen met mensen buiten RTG. Nodig: een betaalverzoek via iDEAL, en dus
  een acquirer.

**Eindcontract WBW.**
1. **Breedte.** Groep, uitgave, methode, verrekenen, verzoek en export.
2. **Diepte.** De vier Nibud-methoden.
3. **Levenscyclus.** Een groep wordt geopend, gebruikt, verrekend en
   gesloten. De export blijft.
4. **Rollen.** Alleen Salon-vrienden. Een buitenstaander ziet niets.
5. **Intelligentie.** Niet van toepassing.
6. **Los.** Valt Pay uit, dan houdt het lijstje de stand.
7. **Ketens.** Verrekenen loopt via Pay en verschijnt in Geld Command.
8. **Betrouwbaarheid.** Zie G.6, met de bezitspoort (G.4).

### 3.2 Labfonds (`/apps/geld.html#labfonds`)

**a. Doel.** Samen geld toezeggen aan een plek of onderzoek dat je raakt, en er
samen over beslissen.

**b. Wat er is.**
- Routes (`server/routes/labfonds.js`): overzicht, locatie/maak, doneer,
  voorstel/maak, stem, scheidsrechter, beslis en financiering, plus de
  gezinsdeur `/api/rtf/labfonds/*` en `/api/labfonds/boardroom` voor het
  kantoor.
- Kern: `server/kern/labfonds.js`, `labfonds/voorstellen.js` en
  `labfonds/onderzoek.js`.
- "Een toezeggingen-grootboek en geen kas; er verhuist hier geen euro."
- Voltooiscenario: `voltooi/labfonds.js` (`link:labfonds`).

**c. Objecten en eigenaar.** `labFonds` (locaties, bijdragen en voorstellen)
hoort bij `geld.overzicht`. De onderzoeken blijven van het RTF-onderzoekslab.

**e. Rechten.**
- Elk account, ook gratis; een anonieme gast niet.
- Alleen wie het voorstel indiende, sluit de stemming.
- In het gezin zegt een volwassene toe.

**Zes lagen, oordeel.**
- **L1** toezeggen, voorstellen en stemmen bestaan.
- **L3** de scheidsrechter en het gezin bestaan.
- **L5** een toezegging telt één keer.
- **L6** het onderzoekslab en de Foundation.
- L2 en L4: niet van toepassing.

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Toezeggen, voorstellen en stemmen | L1/L3 | bestaat | Een toezegging telt één keer; alleen de indiener sluit; een ander lid stemt. | — | — |
| Openbare verantwoording van een pot | L5 | half | Iedereen in de pot ziet wat er is toegezegd, waaraan het besteed is en wie besloot. `financiering` bestaat; een overzicht per pot nog niet. Open Collective zet dit in een betaald pakket (fragment). | klein | nu |
| Toezegging omzetten in een echte betaling | L6 | ontbreekt | — | — | **vraagt besluit**: vandaag beweegt er bewust geen euro; een betaling vraagt een kas en de fiscale klassen |

**f. LOS en SAMEN.**
- **LOS.** Zonder onderzoeksplatform staat er "Het onderzoeksplatform is hier
  niet beschikbaar; koppelen kan nu niet." Toezeggen werkt gewoon.
- **SAMEN.** Labfonds verwijst naar een studie-id en levert de financiering aan
  `/api/lab2/publiek/onderzoek`.

**Keten.** Een lid zegt toe aan een speelplek. Een ouder stelt een besteding
voor, het gezin stemt en de indiener sluit. Geld Command toont de toezegging als
"toegezegd, niet betaald".

**g. Betaalmuur** (fragment): Open Collective Pro heeft bank-sync en beheerde
fondsen (opencollective.com/ofico/updates/…); Snapshot-stemmen is gratis
(help.snapshot.box/…). Wij hebben toezeggen en stemmen gratis; de verantwoording
half.

#### v2 — Labfonds

**Bestaande werkelijkheid.**
- Registers: 3/8 en GEEN_FIXTURE.
- Labfonds is een grootboek van toezeggingen, geen kas.

**Marktmaximum.**
- Open Collective Pro: banksync en beheerde fondsen (fragment).
- Snapshot: stemmen, gratis.

**Domeinmaximum.**
- **Verenigingen.** De kascommissie en de ALV (art. 2:48 BW).
- **ANBI.** Publicatieplicht (G.2).

**De nu-functie, bouwbaar.**

**F-L1. Verantwoording per pot (L5, klein).**
- *Gegevens.* `labFonds`: de toezeggingen, de voorstellen, de besluiten en de
  financiering.
- *Regels.* Alleen de deelnemers van de pot zien de verantwoording. Van een
  bijdrager zien ze de codenaam, nooit de naam.
- *Rekenwijze.* De stand van de pot is toegezegd min besteed.
- *Onzekerheid.* "Toegezegd" is nooit "ontvangen".
- *Wanneer hoort iemand iets.* Na een besluit krijgen de deelnemers een
  melding.
- *Rollen.* De indiener sluit. Een scheidsrechter beslist bij twijfel.
- *Uitzonderingen.* Een ingetrokken toezegging blijft zichtbaar als
  ingetrokken.
- *Acceptatie.* Na drie toezeggingen en één besluit tonen de stand en de
  regels de juiste optelling.

**Wat alleen RTG kan.** Het onderzoekslab en de Foundation zijn eigen
ontvangers, met een studie-id.

**Uitkomst A.**
- F-L1.
- Een toezegging omzetten in een betaling, na besluit G.5-5, via de
  betaalwaarheid.

**Uitkomst B.**
- Een echte kas, met de bewijzen voor ANBI-giftenaftrek.
- Nodig: de ANBI-status van de ontvanger en een boekhouding met kascommissie.

**Eindcontract Labfonds.**
1. **Breedte.** Toezeggen, voorstellen, stemmen, beslissen en verantwoorden.
2. **Diepte.** De verantwoording volgt de vorm van een kascommissie.
3. **Levenscyclus.** Toegezegd, besteed, verantwoord.
4. **Rollen.** De indiener, de scheidsrechter, het gezin en de deelnemers.
5. **Intelligentie.** Niet van toepassing.
6. **Los.** Zonder onderzoeksplatform werkt toezeggen gewoon.
7. **Ketens.** Het onderzoekslab ontvangt de financiering. Geld Command toont
   "toegezegd, niet betaald".
8. **Betrouwbaarheid.** Zie G.6.

---

## Familie 4 — bewaren en geven (Mecenaat, Nalatenschap, Logboek)

Beide zijn vandaag alleen voor de Lifestyle- en Business Pass ("Deze app is
onderdeel van de Lifestyle Pass.", `server/routes/member/rechterhand.js:20`).
Beide bewegen geen geld en geven geen advies.

### 4.1 Mecenaat (`/apps/geld.html#mecenaat`)

**a. Doel.** Weten wat je geeft, aan wat en waarom, en dat het klopt bij de
belastingaangifte zonder dat iemand je adviseert.

**b. Wat er is.**
- Routes: `/api/member/rechterhand/mecenaat`, `/gift`, `/gift/weg` en
  `/betaald`.
- Kern: `server/kern/rechterhand/mecenaat.js` (thema's, en een periode:
  eenmalig, maand, kwartaal of jaar).
- "Er beweegt geen geld; betaald is een aantekening van het lid."
- Voltooiscenario: `voltooi/mecenaat.js`.

**c. Objecten en eigenaar.** Het levensdossier-veld `mecenaat` is van de
rechterhand.

**e. Rechten.** Lifestyle en Business.

**Zes lagen, oordeel.**
- **L1** het bijhouden bestaat.
- **L4** de regel gift-bevestiging bestaat in geldbeleid.
- **L5** een jaaroverzicht ontbreekt.
- **L6** de Foundation-vlag bestaat; er gaat geen aanroep naar de Foundation.
- L2 en L3: niet van toepassing.

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Giften bijhouden en als betaald markeren | L1 | bestaat | Toegezegd, betaald en via de Foundation tellen apart; een gift zonder doel wordt geweigerd. | — | — |
| Jaaroverzicht van giften | L5 | ontbreekt | Het lid downloadt per jaar zijn giften per doel. Het overzicht draagt de klasse "uitlegbaar" en zegt dat aftrekbaarheid afhangt van de ANBI-status, die het lid zelf controleert. Every.org stuurt kwitanties gratis (fragment). | klein | nu |
| Een gift echt betalen | L6 | ontbreekt | — | — | **vraagt besluit**: dat raakt de doneerknop (`GIFT.md`) |
| Fiscale aftrek berekenen | — | ontbreekt | — | — | niet zelfstandig: het is fiscaal "advies", een mens beoordeelt |

**f. LOS en SAMEN.**
- **LOS.** Mecenaat werkt volledig los; het is een lijst van het lid.
- **SAMEN.** Geld Command telt de toezeggingen mee, en de regel
  "gift-bevestiging" vraagt het lid te bevestigen.

**g. Betaalmuur** (fragment): Every.org en de GoFundMe Giving Fund geven een
jaaroverzicht gratis (every.org/pricing, gofundme.com/c/pricing); Geef.nl: niet
gevonden. Wij hebben het bijhouden; het jaaroverzicht niet.

**j. Extern.** ANBI-gegevens zijn openbaar; RTG controleert ze niet
inhoudelijk en zegt dat.

#### v2 — Mecenaat

**Bestaande werkelijkheid.**
- Registers: 7/8, alleen *bevoegd* is NIET_GETEST.
- Er beweegt geen geld.

**Marktmaximum.** Every.org en GoFundMe Giving Fund maken gratis een
jaaroverzicht (fragment).

**Domeinmaximum.**
- **Losse gift.** Aftrekbaar boven 1%, met een minimum van € 60, tot 10%.
- **Periodieke gift.** Vijf jaar lang, zonder drempel, via een akte of
  overeenkomst.
- **Ontvanger.** Moet een ANBI zijn.

Bronnen: G.2.

**De nu-functie, bouwbaar.**

**F-M1. Jaaroverzicht van giften (L5, klein).**
- *Gegevens.* De giften van het lid: doel, bedrag, datum, of er betaald is,
  en of het een periodieke gift is.
- *Regels.*
  - Het overzicht heeft de klasse **uitlegbaar**.
  - Het lid controleert zelf de ANBI-status. RTG valideert die niet en zegt
    dat ook.
  - Aftrek berekent RTG niet; dat is "advies".
- *Rekenwijze.* Per jaar telt het overzicht apart op:
  - wat betaald is;
  - wat alleen is toegezegd;
  - en daaronder apart de periodieke giften.
- *Onzekerheid.* "Toegezegd" telt niet als betaald.
- *Wanneer hoort iemand iets.* Geen melding.
- *Rollen.* Alleen het lid.
- *Uitzonderingen.* Een gift zonder datum valt in het jaar waarin hij is
  ingevoerd. Dat staat er dan bij.
- *Acceptatie.*
  - Twee betaalde giften en één toezegging in 2026 geven een overzicht met
    twee bedragen en één aparte regel.
  - De klassezin staat onderaan.

**Wat alleen RTG kan.** Een gift via de RTFoundation staat apart, met de
doorgifte van 30%.

**Uitkomst A.**
- F-M1.
- Een gift echt betalen, na besluit G.5-5 en `GIFT.md`.

**Uitkomst B.**
- Een periodieke gift vastleggen, en de ANBI-status controleren tegen het
  openbare register.
- Nodig: een overeenkomst die geldig is voor de Belastingdienst, en een
  bronkoppeling.

**Eindcontract Mecenaat.**
1. **Breedte.** Bijhouden, betaald markeren en een jaaroverzicht maken.
2. **Diepte.** Losse en periodieke giften staan apart. De ANBI-zin staat
   erbij.
3. **Levenscyclus.** Toegezegd, betaald, in het jaaroverzicht.
4. **Rollen.** Alleen het lid.
5. **Intelligentie.** De klasse "uitlegbaar". Een aftrekbedrag wordt nergens
   berekend.
6. **Los.** Mecenaat werkt volledig los.
7. **Ketens.** Geld Command toont de giften. De Foundation ontvangt pas na het
   besluit.
8. **Betrouwbaarheid.** Zie G.6.

### 4.2 Nalatenschap (`/apps/geld.html#nalatenschap`)

**a. Doel.** Rust voor later: weten dat je naasten vinden wat ze nodig hebben,
zonder dat iemand het nu kan lezen.

**b. Wat er is.**
- Routes: `/api/member/rechterhand/nalatenschap`, `/doc`, `/contact` en
  `/wens`, met hun `weg`-varianten.
- Kern: `server/kern/rechterhand/nalatenschap.js`, met AES-256-GCM op de
  gevoelige velden.
- Voltooiscenario: `voltooi/nalatenschap.js`. Dat bewijst dat de gevoelige
  velden versleuteld in de opslag staan en een crash overleven.

**c. Objecten en eigenaar.** Het levensdossier-veld `nalatenschap` (documenten,
contacten en wensen) is van de rechterhand.

**e. Rechten.**
- Lifestyle en Business; alleen het lid zelf.
- "Notaris" is een contactlabel; er is geen rol voor de notaris.

**Zes lagen, oordeel.**
- **L1** bewaren bestaat.
- **L2** de notaris als professional vraagt een genre en een besluit.
- **L5** de vrijgave aan nabestaanden ontbreekt (GELD.md fase 5).
- **L6** bewust geïsoleerd: de concierge ziet het niet.
- L3 en L4: niet van toepassing.

**Functiecatalogus**

| Functie | Laag | Stand | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|
| Documenten, contacten en wensen versleuteld bewaren | L1 | bestaat | Wat gevoelig is, staat versleuteld in de opslag; alleen het lid ziet het na inloggen. | — | — |
| Vertrouwenspersoon met vrijgavevoorwaarde | L5 | ontbreekt | Het lid wijst iemand aan die pas na een vrijgavevoorwaarde iets ziet. Die voorwaarde is altijd een menselijke bevestiging, nooit alleen een timer. Elke inzage komt in een audit die het lid kan lezen. Google en Apple hebben dit gratis (fragment). | groot | later (GELD.md fase 5) |
| Versiegeschiedenis en inzage-audit | L5 | ontbreekt | Het lid ziet elke wijziging en elke inzage met datum. | middel | later |
| Notaris als professional | L2 | ontbreekt | — | — | **vraagt besluit**: een genre in de leveranciersapp (CIVILIS) |
| Een testament opstellen | — | ontbreekt | — | — | niet: juridisch "voorbehouden" |

**f. LOS en SAMEN.**
- **LOS.** Nalatenschap werkt volledig los. Met opzet geen SAMEN: "Besloten
  zaken (gezondheid, nalatenschap) komen hier niet binnen"
  (`server/routes/office/concierge.js:33`). Een keten komt er pas met een
  vrijgavevoorwaarde, en dan alleen naar de aangewezen mens.

**g. Betaalmuur** (fragment):
- Trust & Will: een membership voor de kluis (trustandwill.com/learn/trust-and-will-membership).
- Google Inactive Account Manager en Apple Legacy Contact: gratis
  (support.google.com/accounts/answer/3036546, support.apple.com/en-us/102631).
- Mijndigisafe (NL): een notariële kluis tegen betaling (id.nl/…).

Wij hebben de versleutelde kluis; de vrijgave aan nabestaanden niet.
#### v2 — Nalatenschap

**Bestaande werkelijkheid.**
- Registers: 7/8.
- De gevoelige velden staan versleuteld (AES-256-GCM).

**Marktmaximum.**
- Trust & Will: een kluis met membership.
- Mijndigisafe: een notariële kluis, betaald.
- Google Inactive Account Manager en Apple Legacy Contact: gratis.

Bron: fragment.

**Domeinmaximum.**
- Aangifte erfbelasting binnen 8 of 20 maanden (G.2).
- De rollen van de executeur, het CTR en de notaris.
- Voor de digitale nalatenschap is geen wet.

**Wat alleen RTG kan.**
- Een geldbeeld van het huis voor de executeur, na een vrijgave: welke
  posities, welke contracten en welke verplichtingen. Dat komt uit Geld
  Command, als verwijzing.

**Uitkomst A.**
- Een vertrouwenspersoon met een vrijgavevoorwaarde. Die voorwaarde is altijd
  een menselijke bevestiging.
- Versies en een audit.
- Daarna het geldbeeld voor de executeur.

Groot, en later.

**Uitkomst B.**
- Een koppeling met het CTR en een notarisgenre.
- Wat daarvoor nodig is:
  - besluit G.5-6;
  - de notaris als Wwft-poortwachter;
  - voor het testament: "voorbehouden".

**Eindcontract Nalatenschap.**
1. **Breedte.** Documenten, contacten, wensen, een vertrouwenspersoon en een
   geldbeeld.
2. **Diepte.** De termijnen van de erfbelasting worden getoond als
   voorlichting, met een klasse.
3. **Levenscyclus.** Bewaren, wijzigen (met versie), vrijgeven en inzien
   (met audit).
4. **Rollen.** Het lid en de aangewezen mens, en niemand anders.
5. **Intelligentie.** Niet van toepassing.
6. **Los.** Nalatenschap werkt volledig los.
7. **Ketens.** Alleen na een vrijgave, en alleen naar de aangewezen mens.
8. **Betrouwbaarheid.** Zie G.6, en de versleuteling overleeft een crash.


### 4.3 Logboek (`/apps/geld.html#logboek`), alleen de financiële registratie

**Waar de grens ligt.** Afgesproken met LivingOS-A en bevestigd door de
integrator.

- **Geld** bezit de financiële registratie van een kostbaar bezit:
  - de aanschaf;
  - de waarde, als eigen opgave met peildatum;
  - de kosten per regel.
- **Het onderhoud** is van het objectdomein:
  - het huis bij **Wonen** (`wonen.html`, `woning.overzicht`);
  - een vliegtuig bij **Hangar** (`hangar.html`, `reizen.vliegtuig`);
  - een jacht of oldtimer bij geen eigen domein. Dan blijft het onderhoud in
    Logboek, tot er een domein komt.
- **Logboek** verwijst naar het onderhoud en bezit het niet.
- **Een gemeten spanning.** `server/kern/rechterhand/logboek.js` bewaart nu
  zelf de keuring-, service- en reparatieregels met `volgende` (de
  attenties). Voor een vliegtuig hoort dat bij Hangar. Dat is besluit
  G.5-7: verhuizen of laten staan. Ik raak het niet aan zonder dat besluit.

**Bestaande werkelijkheid.**
- Registers: 7/8, met alleen *bevoegd* op NIET_GETEST.
- Objecten: maximaal 200. Regels: maximaal 5.000.
- Het veld `kosten` is een getal (`getal(b.kosten, 1e9)`) zonder eenheid. Het
  scherm vraagt om hele euro's, en `totaalKosten` telt ze op.
- Er is geen koppeling met Pay of Geld Command.

**Markt.**
- Er zijn onderhoudsapps voor auto's, boten en vliegtuigen, met kosten per
  object (kennis).
- Bij een vliegtuig is het officiële logboek wettelijk voorgeschreven en van
  de eigenaar of operator. Dat is aan de luchtvaartautoriteit, niet aan RTG
  (kennis).

**De nu-functie, bouwbaar.**

**F-LB1. Kosten per object in Geld Command (L6, klein).**
- *Gegevens.* `logboek(key).objecten[].kosten` en `regels[].kosten`, met de
  `datum` erbij.
- *Regels.*
  - Geld leest alleen; het schrijft niets terug.
  - De bedragen zijn hele euro's, en dat staat erbij.
- *Rekenwijze.* Per object de kosten per jaar, met de datum van de regel.
- *Onzekerheid.* Een kostenregel zonder datum staat apart en telt niet mee
  in een jaar.
- *Wanneer hoort iemand iets.* Geen melding. De attenties blijven van het
  objectdomein.
- *Rollen.* Alleen het lid.
- *Uitzonderingen.* Een object dat is verwijderd, verdwijnt ook uit Geld.
- *Acceptatie.*
  - Een jacht met twee kostenregels in 2026 toont het jaartotaal in Geld
    Command, met een link naar Logboek.
  - Valt Logboek uit, dan staat er "niet opgehaald: Logboek".

**Uitkomst A.**
- F-LB1.
- De aanschaf en de waarde als eigen opgave in het vermogensoverzicht
  (F-GC1).

**Uitkomst B.** Hetzelfde, plus een waardebron per object. Die levert RTG
niet; het blijft een eigen opgave.

**Eindcontract Logboek, het Geld-deel.**
1. **Breedte.** Aanschaf, waarde en kosten per object.
2. **Diepte.** Bedragen met eenheid en datum.
3. **Levenscyclus.** Van aanschaf tot verkoop of verwijdering.
4. **Rollen.** Alleen het lid.
5. **Intelligentie.** Niet van toepassing.
6. **Los.** Logboek werkt zonder Geld.
7. **Ketens.** Geld leest; het objectdomein bezit het onderhoud.
8. **Betrouwbaarheid.** Zie G.6.

---

## Voorstel aan de eigenaar, in drie bakken (versie 2)

Elke functie wordt pas werk na een toezegging per familie. Per functie staat
het nummer uit het v2-blok.

### Aanbevolen nu, in deze volgorde

1. **De reis.**
   - R1, betalen via de betaalwaarheid met bijladen (middel);
   - R2, het betaalbewijs (klein);
   - R3, de verplichting en kasstroom in Geld (middel).

   Dat zijn gaten 1, 2 en 5 uit versie 1, nu K2, K3 en R3. De poorten (gaten 3
   en 4) en de dubbele herkomst zijn al gedicht.
2. **Paspoortpoorten.**
   - F-T1, de tab Betalen;
   - F-B1, de bank;
   - de routes uit G.4, na de keuze van de integrator.

   Allemaal klein.
3. **De verplichtingenkalender** (F-GC4, middel), met de projectievorm uit
   G.3, als eerste bij reis.
4. **Contracten en abonnementen** (F-GC3, middel).
5. **Huishoudscenario's en kasstroom** (F-GC5, middel).
6. **Vermogensoverzicht** (F-GC1, middel), met de kosten uit Logboek
   (F-LB1, klein).
7. **Aflosplan als rekensom** (F-GC2, middel).
8. **Pay: de kascode, zoeken, categorieën en export** (F-P1 klein, F-P2
   middel).
9. **WBW** (allemaal klein):
   - F-WB1, export;
   - F-WB2, een sleutel op het verzoek;
   - F-WB3, de verdeelmethode.
10. **Klein werk in de overige apps.**
    - F-W1, het verloopsignaal in Wallet;
    - F-L1, de verantwoording in Labfonds;
    - F-M1, het jaaroverzicht in Mecenaat.

### Later

Groot werk:
- een gezamenlijke pot, rekening of budget;
- de vertrouwenspersoon en het geldbeeld voor de executeur in Nalatenschap.

Middel werk:
- besluitvergelijking en lange termijn;
- afrondsparen;
- valuta in WBW;
- de offline RTG Code;
- passen uit andere apps in Wallet.

Klein werk:
- een trend in Balans;
- meerdere rekeningen bij de bank (na live).

### Niet doen, en waarom

Dit is ongewijzigd ten opzichte van versie 1.

- **Krediet en AI-advies als advies.** Die vallen onder G.5-2.
- **Verzekering en dekking.** Uitgesloten.
- **Lounges en partnerabonnementen.** Uitgesloten.
- **Rendement en Monte Carlo.** Uitgesloten.
- **Een testament opstellen of fiscale aftrek vaststellen.** Uitgesloten.
- **Eigen kaarten uitgeven.** Uitgesloten.
- **Namens het lid opzeggen of betalen.** Geld verlaat het huis nooit vanzelf.
- **Een bankkoppeling zonder AISP-partner.** Uitgesloten.

### Uitkomst B per app (wat er buiten RTG nodig is)

| App | Wat er nodig is |
|---|---|
| Pay en Bank | een gereguleerde bankpartner, regels voor elektronisch geld (art. 1:5a Wft), Wwft |
| Geld Command | een AISP-partner (PSD2); afspraken met schuldhulp (Wgs, NVVK); een Wft-adviseur buiten RTG |
| WBW en tab Betalen | een acquirer, voor iDEAL naar buiten |
| Mecenaat en Labfonds | de ANBI-status van de ontvanger; een kas met een kascommissie |
| Nalatenschap | een notarisgenre (CIVILIS); CTR |
| Wallet | ondertekening voor Apple en Google Wallet |

### Menselijke beoordeling

Deze punten vragen een mens met vakkennis:

- **De klassezinnen** onder F-GC2, F-GC5 en F-M1.
- **De tekst bij schuldhulp** in F-GC2.
- **De Wft-grens** tussen informeren en adviseren.
- **De termijnen van de erfbelasting** in Nalatenschap.

Ze staan hier als voorstel en zijn juridisch en fiscaal niet nagelezen.
