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
