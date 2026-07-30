# Beveiligingsbeleid - Rahul Travel Group

Bedankt dat je de veiligheid van onze gebruikers serieus neemt. Dit document legt
uit hoe je een kwetsbaarheid verantwoord bij ons meldt en wat je van ons mag
verwachten. *(This policy is also available on request in English - see
"Preferred-Languages" in [`/.well-known/security.txt`](public/.well-known/security.txt).)*

## Een kwetsbaarheid melden

Meld **niet** via een openbaar issue, pull request of discussie - zo blijven
gebruikers beschermd tot er een oplossing is. Gebruik in plaats daarvan:

1. **GitHub Private Vulnerability Reporting** (voorkeur): ga naar het tabblad
   **Security** van deze repository en klik op **"Report a vulnerability"**.
2. **E-mail**: `security@rahultravelgroup.example`
   (hetzelfde adres als in [`security.txt`](public/.well-known/security.txt)).
   Versleutel gerust; vraag anders om een sleutel.

Meld het liefst in het Nederlands of Engels.

### Wat we graag ontvangen
- Een duidelijke beschrijving van de kwetsbaarheid en de mogelijke impact.
- Stappen om het te reproduceren (proof-of-concept, verzoek/respons, of een korte video).
- De betrokken URL's/endpoints, en zo mogelijk een voorstel voor de oplossing.

## Wat je van ons mag verwachten

- **Ontvangstbevestiging** binnen **3 werkdagen**.
- Een eerste inhoudelijke **beoordeling** binnen **10 werkdagen**.
- We houden je op de hoogte van de voortgang en laten weten wanneer het is
  opgelost. Bij ernstige zaken werken we met spoed.
- Met jouw toestemming vermelden we je graag in onze dankbetuiging
  (hall of fame) zodra de melding is verholpen.

Dit is een project zonder commercieel bug-bountyprogramma: we bieden geen
geldelijke beloning, maar wél erkenning en een snelle, respectvolle afhandeling.

## Verantwoorde openbaarmaking (safe harbor)

Zolang je je aan dit beleid houdt, beschouwen we jouw onderzoek als te goeder
trouw en zullen we **geen juridische stappen** ondernemen. We vragen je:

- Blijf binnen de grenzen: **geen** toegang tot, wijziging van of vernietiging
  van gegevens die niet van jou zijn; werk met de **demo-/testgegevens**.
- **Geen** denial-of-service, spam, social engineering of fysieke aanvallen.
- Verzamel niet meer bewijs dan nodig is om de kwetsbaarheid aan te tonen; deel
  of bewaar geen gegevens van anderen.
- Geef ons **redelijke tijd** (richtlijn: 90 dagen) om het op te lossen voordat
  je iets openbaar maakt, en stem publicatie met ons af.

## Reikwijdte

**In scope:** de code in deze repository en de daarmee gedraaide diensten
(de leden-, leverancier-, kantoor- en personeelsapps, de API en de
foundation-laag).

**Buiten scope:** diensten van derden (hosting, e-mail, betaalproviders),
kwetsbaarheden die alleen met een verouderde browser of zonder realistische
impact bestaan, en meldingen die enkel uit geautomatiseerde scanneroutput
bestaan zonder aangetoonde impact.

## Onze eigen maatregelen

De beveiliging wordt in de CI en de testsuite continu bewaakt:

- **`npm audit`** (CI-poort): faalt op kwetsbare dependencies (high/critical).
- **Dependabot**: automatische update-/security-PR's voor dependencies en actions.
- **CodeQL**: statische code-analyse (SAST) op de broncode.
- **Secret-scan** (`npm run secrets`): weigert gelekte sleutels/tokens in de bron.
- **Hack-test** (`test/hack.test.js`): regressie-hek voor auth, rol-scheiding,
  IDOR, injectie, security-headers, path-traversal en brute-force.
- **Strenge testpoort**: elke onverwachte 5xx, uncaughtException of
  unhandledRejection laat de suite falen.

Zet daarnaast in de repo-instellingen GitHub's eigen **Secret scanning** en
**Push protection** aan; die vullen de bovenstaande lagen aan.

### De identiteitskluis is aan zijn rij gebonden

Persoonsgegevens (naam, e-mail, telefoon en het ledendossier) staan versleuteld in
de kluis, met een sleutel die los van de database leeft. Versleuteling alleen is
daar niet genoeg: een versleuteld veld zegt niets over waar het thuishoort, dus wie
de database kan bewerken zou een blob kunnen **verplaatsen** — de versleutelde naam
van het ene lid naar de naamkolom van het andere. De AEAD merkt daar niets van (het
blob is ongeschonden) en het huis leest daarna een echte naam bij de verkeerde
codenaam. Dat holt de scheiding tussen codenaam en kluis uit.

Daarom gaat de identiteit van de **plek** (tabel, kolom, rij-id) als additional
authenticated data mee in de authenticatie (`server/accounts/gebonden.js`).
Verplaatst iemand een blob naar een andere rij of kolom, dan klopt die context niet
meer, faalt de authenticatie en komt er niets uit. De Rust-kluis
(`motor/src/kluis.rs`) doet hetzelfde met de codenaam als context.

Bestaande installaties blijven leesbaar en migreren per rij mee bij de
eerstvolgende schrijfactie. Actief migreren en de stand aantonen:

```
npm run kluisbeheer               # stand opnemen, verandert niets
npm run kluisbeheer -- --migreer  # herzegel alles wat nog werk nodig heeft
```

Een rij die niet opengaat wordt met opzet niet aangeraakt: migreren mag nooit
gegevens vernietigen. `test/kluis-binding.test.js` valt de verplaatsing met rauwe
SQL aan en bewaakt tegelijk dat de oudere vormen leesbaar blijven.

### Opgeslagen bestanden zijn aan hun naam gebonden

Hetzelfde geldt voor de bestandsopslag (`server/kluis.js`). De versleuteling
beschermde de inhoud van een KYC-document, maar zei niet welk document het was —
dus kon wie bij de opslag kan twee blobs **omwisselen**, waarna de backoffice het
verkeerde identiteitsbewijs bij een goedkeuring te zien krijgt. Daarom gaat nu de
bestandsnaam als additional authenticated data mee, voor alle drie de
opslagplaatsen (`uploads`, `media`, `bestanden`): ze verwijzen allemaal met de kale
naam naar hun bestanden, en die naam is bij schrijven én lezen bekend.

Bestaande bestanden blijven leesbaar (`RTGENC1`, ongebonden) en nieuwe
schrijfacties zijn gebonden (`RTGENC2`). `test/bestand-binding.test.js` wisselt
twee blobs om en eist dat er niets opengaat.

### De kluissleutel is te roteren

Een gecompromitteerde sleutel moet te vervangen zijn zonder de gegevens te
verliezen en zonder downtime. De kluis houdt daarom een **keyring**: zegelen gaat
met de nieuwste sleutel, lezen probeert ze op volgorde. Roteren zet een verse
sleutel vooraan, schrijft de ring **eerst** duurzaam naar schijf en hersleutelt
daarna rij voor rij — dezelfde ordening als `motor/src/kluis.rs`, zodat elk blob
altijd naar een sleutel wijst die op schijf staat. Valt het proces er middenin om,
dan staat een deel op de nieuwe en een deel op de oude sleutel; dat leest gewoon
door en opnieuw draaien maakt het af.

```
npm run kluisbeheer -- --roteer   # verse sleutel erbij en alles hersleutelen
```

Wat **niet** meeroteert zijn de zoek-hashes op e-mail en telefoon. Die zijn een
HMAC met de oorspronkelijke sleutel en staan als opzoeksleutel in de database —
zouden ze meebewegen, dan kon niemand meer op zijn e-mailadres inloggen, en
halverwege een rotatie zou de helft van de leden buitenstaan. Die sleutel blijft
dus gepind. `test/kluis-rotatie.test.js` bewaakt precies dat: met een meeroterende
zoek-hash faalt de inlogtest.

Bij meerdere instances moet de ring, net als de sleutel zelf, op elke instance
gelijk zijn (`RTG_VAULT_RING`).
