# FABRIC.md -- de AI Execution Fabric

Dit is het richtingsdocument voor de laag boven PROOF: van "software bedienen"
naar "een doel uitspreken". Lees PROOF.md eerst -- dit document leunt er
volledig op en heeft zonder die bewijslaag geen bodem.

De lat is niet "onze AI kan alle functies bedienen". De lat is:

> **Vertel RTG wat je wilt bereiken. RTG regelt de rest -- binnen jouw rechten,
> budget, privacy en regels -- en kan achteraf exact bewijzen wat het heeft
> gedaan en waarom.**

En de zin die de hele architectuur draagt: **een onbewezen handeling staat niet
in de lijst waaruit de AI kiest.** Niet "de AI probeert iets en de beveiliging
houdt hem misschien tegen". De keuze is al vernauwd voordat het model denkt.

## 0. Waarom de nul van PROOF de sleutel is

Zolang er onverklaarde punten in de bewijslaag staan, is elke uitbreiding van
AI-autonomie een gok. Met een bewijslaag die mechanisch op 100% stuurt (PROOF.md
par. 0: bewijs mag alleen groeien, schuld alleen krimpen) wordt autonomie iets
dat je GECONTROLEERD vrijgeeft in plaats van iets dat je hoopt te overzien.

De nul is dus niet het einde van PROOF. Het is de sleutel waarmee deze laag
opengaat -- en per capability, niet in een keer voor het hele huis.

## 1. Wat er AL staat, en dat is meer dan een begin

Dit hoofdstuk staat vooraan omdat de verleiding is om naast bestaand werk te
bouwen. Dat mag hier niet (LAT.md regel 4).

| Bouwsteen | Waar | Wat het al doet |
|---|---|---|
| Het stuur | `server/kern/stuur.js` | Elke AI-actie loopt als interne aanroep over de gewone API met de eigen inlog van de gebruiker. Een codepad, dezelfde auth, dezelfde limieten. De AI kan nooit MEER dan de persoon die hem iets vraagt. |
| Allowlist per rol | `server/kern/stuur/beleid.js` | Een nieuwe route is nooit automatisch AI-bedienbaar. `direct` (lezen, klein, omkeerbaar) tegenover `voorstel` (wijzigt, deelt, boekt, beweegt geld). |
| Voorstel + bevestiging | `stuur/goedkeuring.js` | Een mutatie komt terug als exact, eenmalig, sessiegebonden servervoorstel. Alleen een apart menselijk endpoint voert het uit. Promptinjectie kan zichzelf niet goedkeuren (getoetst in `test/stuur-aanval.test.js`). |
| Stappenbudget | `classificeer()` in het stuur | Licht ("zet een timer") krijgt 4 stappen, zwaar ("plan een complete reis") 24. De eerste vorm van een executieplan. |
| **Bewijspoort** | `beleid.js` + `server/lib/vervalstaat.js` | Proof-aware routing: een capability met vervalstaat GESCHORST valt uit `toegestanePaden`. De AI krijgt hem niet aangeboden. |
| Schorspoort | `server/middleware/schorspoort.js` | Het runtime-vangnet eronder: een schrijvende aanroep op een geschorste route krijgt 503 met reden. Lezen blijft open. |
| Vervalstaten | `scripts/vertrouwen.js`, `VERTROUWEN.json` | Per route bewezen / verschaald / verzwakt / geschorst / ongemeten, met de reden en met wat de staat zou veranderen. |
| **Actiebewijs** | `server/kern/stuur/bon.js` | Elke door een mens bevestigde AI-handeling levert een bon: wat, waarom het mocht, de gemeten bewijsstand eronder, de uitkomst, en wat er NIET is gemeten. |
| Idempotentie | `server/middleware/idempotentie.js` | Een sleutel, een uitvoering, hetzelfde antwoord. De bodem onder een transactie die halverwege hapert. |
| Capability-graaf | het routedossier in Kantoor | 4195 routes over elf bewijsschakels, met bron en reden per cel. |

Wat er dus NIET nog een keer gebouwd wordt: een tweede AI-actielaag, een tweede
rechtenmodel, een tweede routelijst.

## 2. De keten

```
                    GEBRUIKER
                       |
                    INTENTIE
                       v
              +-- PERSOONLIJKE GRAAF
              |
              v
             AI-PLANNER            (model: denkt)
                       |
                INTENT-COMPILER    (deterministisch: structureert)
                       v
             EXECUTIEGRAAF
                       |
          +------------+------------+
          v            v            v
       BEWIJS      BEVOEGDHEID    RISICO
       (PROOF)     (rol+budget)   (bedrag, omkeerbaarheid)
          +------------+------------+
                       v
                  SIMULATIE
                       v
                 BELEIDSBESLUIT
                 /     |     \
             WEIGER   VRAAG   VOER UIT
                             v
                  PARALLELLE UITVOERDER
                             v
                       CONTROLE
                             v
                    ACTIEBEWIJS
                             v
                    LEER VAN DE UITKOMST
```

Het model denkt, de compiler structureert, PROOF controleert, de uitvoerder
voert uit. Die volgorde is de veiligheid: een model met honderden losse
gereedschappen is iets anders dan een model dat een PLAN oplevert dat daarna
door een deterministische laag wordt gewogen.

## 3. De negen bouwstenen

### 3.1 Persoonlijke capability-graaf
Machineleesbaar weten: persoon, rollen, organisaties, apparaten, relaties,
voorkeuren, toestemmingen, budgetten, capabilities, actuele context. Zodat de AI
niet elke keer opnieuw hoeft te vragen wat hij al mag weten.

*Grens:* dit huis draait op codenamen (CLAUDE.md, privacy by design). De graaf
werkt op de codenaam; de echte naam blijft in de kluis. Gevoelige voorkeuren
worden alleen bewaard en gebruikt met expliciete, intrekbare toestemming, en een
kind is geen profiel (LEVEN.md par. 2).

### 3.2 Intent-compiler
Een doel wordt eerst een PLAN: doel, subtaken, benodigde capabilities,
afhankelijkheden, rechten, risico, kosten. Pas daarna uitvoering. De AI kiest
nooit rechtstreeks losse API's.

*Wat er al is:* het stuur met zijn stappenbudget en allowlist. *Wat erbij moet:*
het plan als expliciet object dat te tonen, te wegen en te weigeren is.

### 3.3 Proof-aware routing -- GEBOUWD
Elke capability draagt zijn bewijsstand. Staat die op geschorst, dan bestaat de
actie niet voor de AI. De bewijspoort in `beleid.js` doet dit vandaag.

*De bewuste grens:* alleen GESCHORST sluit. `verzwakt` draagt op dit moment
vrijwel elke route (er is bijna altijd een schakel ongemeten); daarop sluiten zou
de hele laag dichtzetten, en dat is precies de vorm van veiligheid die mensen
uitzetten. Geschorst is TEGENSPREKEND bewijs; verzwakt is ONTBREKEND bewijs. Dat
is een verschil. Naarmate de bewijslaag naar 100% loopt, kan de drempel
strenger: eerst voor geld en gezondheid, dan breder. Die aanscherping is een
BESLUIT met een datum, geen automatisme.

### 3.4 Risico-adaptieve autonomie
Niet elke handeling verdient dezelfde frictie. Een tafel zoeken gaat direct; een
reservering van 35 euro kan binnen een budget vanzelf; 8.000 euro overboeken
vraagt een bevestiging met passkey; een medisch, juridisch of arbeidsrechtelijk
besluit vraagt een mens.

*Grens:* GELD.md blijft boven alles staan -- geld verlaat het huis nooit
vanzelf, welke autonomie er ook is ingesteld. En het pas-besluit blijft
mensenwerk: de AI belooft of verleent nooit toegang tot Lifestyle of Business.

### 3.5 Transactionele AI
`PLAN -> SIMULEER -> RESERVEER -> BEVESTIG -> CONTROLEER`, en waar het kan
`MISLUKT -> DRAAI TERUG`. Een opdracht van twintig acties mag niet als halve
werkelijkheid achterblijven wanneer stap zeventien faalt.

*Wat er al is:* de idempotentielaag (een herhaling voert niets dubbel uit) en de
ROLLBACK-schakel in de bewijsmatrix (weigeren zonder sporen achter te laten, en
sinds vandaag met 0 gezakte cellen). *Wat erbij moet:* het reserveren als eigen
stap, zodat "geboekt" en "definitief" twee dingen zijn.

### 3.6 Digitale tweeling voor de uitvoering
Risicovolle plannen eerst tegen een kopie: wat gebeurt er als we morgen 4.000
bezoekers binnenlaten, of als ik deze 312 facturen verstuur? Simuleren voor je
uitvoert.

*Wat er al is:* de wegwerpserver met een eigen datamap (elke proef in dit huis
draait al tegen een kopie) en de vingerafdruk die toestandsverschillen meet. Dat
is precies het fundament voor een simulatie die iets betekent.

### 3.7 Geen wachttijd
Onafhankelijke stappen parallel, met een afhankelijkheidsgraaf in plaats van een
rij. Twintig handelingen mogen als een handeling van een paar seconden voelen.

*Grens:* parallel uitvoeren mag de VOLGORDE-eisen van de bevestiging nooit
omzeilen. Wat een tweede persoon bereikt (een uitnodiging, een bericht, een
boeking, een betaling) wordt nooit automatisch verstuurd omdat het toevallig
sneller kon (LIFE.md par. 4).

### 3.8 Verklaarbaar actiebewijs
Na een complexe opdracht geen AI-verhaal maar een bon:

```
Geregeld
8 medewerkers ingepland - voorraad aangepast - 1.840 euro bestelling klaargezet
verwachte capaciteit +23%
Geen betalingen uitgevoerd zonder jouw toestemming.

Waarom?   Wat is gewijzigd?   Bewijs   Ongedaan maken
```

*Grens:* elke regel op die bon komt uit een register dat een proef of het
actielog zelf schreef. Bewijs is nooit een verhaal (PROOF.md par. 9.1). "Ongedaan
maken" mag alleen op de bon staan als het ook echt kan.

### 3.9 Leren van uitkomsten
Doet iemand elke vrijdag hetzelfde, dan mag de AI dat opmerken en VRAGEN of hij
het voortaan voorbereidt. De gebruiker promoveert automatisering bewust:

```
voorstellen  ->  een keer goedkeuren  ->  als regel goedkeuren  ->  zelfstandig binnen een grens
```

*Grens:* nooit stil patronen opslaan en nooit stil rechten uitbreiden. Geen
verslavende patronen, geen score op het leven tussen mensen (LIFE.md par. 4,
CLAUDE.md).

## 4. De premiumlaag: grenzen voor digitale arbeid

Een gebruiker of onderneming stelt de bevoegdheid zelf in, in gewone taal:

> "Je mag zelfstandig inkopen tot 500 euro als de voorraad onder de
> veiligheidsgrens komt, maar alleen bij goedgekeurde leveranciers."

Dat compileert naar een regel met tanden: `max 500` + `goedgekeurde leverancier`
+ `voorraadtrigger` + `vers bewijs` + `auditplicht` + `stopvoorwaarden`.

En een onderneming:

> "AI mag roosters optimaliseren, maar niemand ontslaan, contracturen niet
> verminderen en loonkosten maximaal 2% boven budget brengen."

Dit is geen RBAC meer. Het zijn grenzen voor autonome digitale arbeid, en ze
horen in dezelfde vorm te leven als de rest van dit huis: leesbaar, meetbaar,
met een reden erbij, en met een proef die aantoont dat de grens ook echt sluit.

## 5. De grenzen (hier vervalt de functie, niet de grens)

1. **De AI kan nooit meer dan de persoon die hem iets vraagt.** Geen eigen
   sessie, geen eigen rechten, geen omweg om een poort heen.
2. **Geld verlaat het huis nooit vanzelf** (GELD.md). Geen autonomiegrens heft
   dat op.
3. **Wat een tweede persoon bereikt, bevestigt een mens** (LIFE.md). De fabric
   stelt samen en zet klaar; versturen is een handeling van iemand.
4. **Een onbewezen handeling wordt niet aangeboden.** En de bewijspoort verruimt
   nooit: hij kan alleen sluiten (3.3).
5. **Toegang tot Lifestyle en Business blijft mensenwerk.** De AI belooft en
   verleent nooit toegang (CLAUDE.md).
6. **Nooit doen alsof.** Geen echte hotel- of luchtvaartmerken als bevestigde
   partners, nooit claimen dat een boeking is verwerkt als dat niet zo is.
7. **Codenamen blijven de eenheid.** De fabric krijgt geen eigen ingang tot de
   identiteitskluis.
8. **Autonomie wordt gepromoveerd, nooit geslopen** (3.9).
9. **Elke uitgevoerde actie draagt een bon** met actor, intentie, gebruikte
   capabilities, bewijsstand, wijzigingen en waar mogelijk een terugweg.
10. **De progressiegrens blijft staan**: onder de 18+-poort wordt er niets
    bewaard buiten het potje (CLAUDE.md).

## 6. Bouwvolgorde

1. **Proof-aware routing** -- GEDAAN (bewijspoort + gedeelde vervalstaat-lezer).
2. **Het plan als object.** De compiler geeft een expliciete executiegraaf terug
   in plaats van een reeks losse aanroepen. Zonder dit is de rest niet te wegen.
3. **Het actiebewijs** -- GEBOUWD (`server/kern/stuur/bon.js`), aangehaakt aan
   de bestaande voorstel-bevestig-keten. Op de bon: de handeling, dat een MENS
   bevestigde (met een kort kenmerk van het voorstel, nooit het token), de
   bevoegdheid, de gemeten vervalstaat uit VERTROUWEN.json, en de uitkomst.
   Twee dingen staan er als `nietGemeten` OP in plaats van eraf: welke gegevens
   precies veranderden (dat meet de vingerafdruk over de hele opslag, een
   proefinstrument en geen kosten per klik) en of de handeling terug te draaien
   is (alleen een route met een bekende tegenhanger mag dat beloven). Een bon
   die zwijgt over wat hij niet weet, leest als volledigheid. Geen
   persoonsgegevens: codenamen blijven de eenheid, ook op papier.
4. **Risicoklassen per capability** (bedrag, omkeerbaarheid, wie het raakt),
   zodat frictie kan meebewegen in plaats van overal gelijk te staan.
5. **Reserveren als eigen stap**, en daarmee de terugweg bij een half mislukte
   opdracht.
6. **Parallelle uitvoering** op de afhankelijkheidsgraaf.
7. **Simulatie** voor de zware plannen, op de bestaande wegwerpserver.
8. **Regels in gewone taal** (par. 4), als laatste -- want die leunt op alle
   voorgaande.

Elke stap volgt LAT.md: de meter eerst zien uitslaan, een waarheid op een plek,
en de oorzaak repareren en niet het symptoom.
