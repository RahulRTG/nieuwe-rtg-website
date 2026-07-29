# Verwerkersovereenkomsten — wat u per partij moet regelen (AVG art. 28)

**Dit document is geen verwerkersovereenkomst en vervangt er geen.** Een
verwerkersovereenkomst is een contract tussen twee partijen; die tekent u, niet
de bouwer. Wat hier staat is het werk dat eraan voorafgaat en dat in de praktijk
de meeste tijd kost: **wie ziet welke gegevens, waarom, en wat moet er dus in
het contract staan.**

Elke regel hieronder is afgeleid uit wat de code werkelijk doet. Rahul vraagt
per partij uit óf er een overeenkomst ligt (`server/papieren/`); dit document
vertelt u *wat* u dan moet vragen.

---

## Waarom dit niet kan wachten

Zonder verwerkersovereenkomst is de verwerking een overtreding, en ligt de
aansprakelijkheid **volledig bij RTG** — ook als de fout bij de andere partij
zit. Art. 28 lid 3 somt op wat er minimaal in moet staan; die lijst staat
onderaan dit document.

---

## De partijen, in volgorde van wat ze zien

### 1. Hostingpartij / VPS-leverancier

| | |
|---|---|
| **Wat zij feitelijk kunnen zien** | Alles wat op de schijf staat: de database, de kluis, de uploads |
| **Waarom** | De server draait op hun hardware |
| **Bijzondere categorie erbij?** | **Ja** — zorg- en allergiegegevens staan in de database |
| **Doorgifte buiten de EU?** | Hangt af van de regio; controleer het datacenter |
| **Extra afspraak nodig** | Versleuteling at rest, wie fysiek bij de schijven kan, wat er gebeurt bij beslaglegging of een overheidsverzoek |

De meeste hostingpartijen hebben een standaard verwerkersovereenkomst. Het is
meestal een kwestie van accepteren, niet van onderhandelen.

### 2. CDN / WAF (bijvoorbeeld Cloudflare)

| | |
|---|---|
| **Wat zij zien** | Elk IP-adres en elk verzoek van elk lid |
| **Waarom** | Zij staan vóór de server |
| **Let op** | Een IP-adres is een persoonsgegeven. Bij TLS-terminatie bij de CDN zien zij ook de **inhoud** van verzoeken |
| **Doorgifte buiten de EU?** | Vrijwel zeker — dit zijn wereldwijde netwerken |
| **Extra afspraak nodig** | Of TLS bij hen of bij u termineert; hoe lang zij logs bewaren |

### 3. Betaalprovider

| | |
|---|---|
| **Wat zij zien** | Betaalgegevens, bedragen, tijdstippen, en genoeg om een persoon te identificeren |
| **Waarom** | Zij voeren de betaling uit |
| **Nuance** | Voor een deel is de betaalprovider **zelf verwerkingsverantwoordelijke** (eigen wettelijke plichten rond witwassen). Dan is het geen zuivere verwerkersrelatie en hoort het contract dat te benoemen |
| **Extra afspraak nodig** | Wie meldt aan wie bij een incident; hoe de webhook is ondertekend |

> Technisch is dit sinds de poortwacht-ronde dichtgezet: een betaalsleutel
> zonder webhook-secret blokkeert de productiestart, en de webhook weigert
> onondertekende berichten. Zie `test/poortwacht.test.js`.

### 4. E-mailverzender (SMTP)

| | |
|---|---|
| **Wat zij zien** | E-mailadressen **en de inhoud**: bevestigingen, herstel-links, besluiten over aanmeldingen |
| **Waarom** | Zij bezorgen de post |
| **Let op** | Een herstel-link in een e-mail is in feite een sleutel. Wie de mail ziet, kan het account overnemen |
| **Extra afspraak nodig** | Bewaartermijn van verzonden berichten; of zij inhoud scannen |

Zonder SMTP-configuratie gaan berichten naar `server/data/outbox/` en verlaten
ze de server niet. Dat is de huidige stand.

### 5. AI-aanbieder

| | |
|---|---|
| **Wat zij zien** | Alles wat een lid tegen Rahul typt — en dat kan van alles zijn |
| **Waarom** | Zij draaien het model |
| **Wanneer** | **Alleen met een echte sleutel.** Zonder `ANTHROPIC_API_KEY` draait alles op vaste demo-antwoorden en gaat er niets naar buiten |
| **Bijzondere categorie erbij?** | Mogelijk. Een lid kan in een gesprek over zijn gezondheid beginnen zonder dat iemand daarom vroeg |
| **Doorgifte buiten de EU?** | Vaak wel. Dit is de eerste plek om te controleren |
| **Extra afspraak nodig** | Of invoer wordt gebruikt om modellen te trainen (dat wilt u uitsluiten), bewaartermijn van prompts, en de standaardcontractbepalingen voor de doorgifte |

> Sinds de poortwacht-ronde raakt een **niet-ingelogde** bezoeker de AI-aanbieder
> niet meer via het vertaal-endpoint; daarvoor was dat een open doorgeefluik.

### 6. Externe foutentracker

| | |
|---|---|
| **Wat zij zien** | Foutmeldingen — en die bevatten vaak meer context dan je denkt |
| **Waarom** | Fouten opsporen |
| **Nuance** | RTG heeft een **eigen** foutaggregatie op het techniekbord. Dit kan dus gewoon "nee" zijn, en dan is er niets te regelen. Dat is de goedkoopste manier om een verwerker te schrappen |

### 7. Elke partner-zaak

| | |
|---|---|
| **Wat zij zien** | Codenaam, bestelling, en bij horeca/care het relevante deel van het **zorgprofiel** |
| **Waarom** | Zij voeren de dienst uit |
| **Bijzondere categorie erbij?** | **Ja** — allergieën en medische aandachtspunten |
| **Aantal** | Elke horecazaak, elk hotel, elke vervoerder. Dit is de grootste groep en de makkelijkste om te vergeten |

**Dit is de belangrijkste rij van het hele document.** Eén losse overeenkomst
per zaak regelen werkt niet bij honderden partners. De enige houdbare vorm is
een **verwerkersbepaling in de partnerovereenkomst die elke zaak toch al
tekent**, als vast onderdeel van het onboarding-proces.

Wat de zaak níet ziet: de echte naam. Dat verkleint de impact, maar het maakt
haar geen niet-verwerker: een codenaam blijft een persoonsgegeven.

---

## Doorgifte buiten de EU

Loop de zeven partijen hierboven af en beantwoord per partij: verwerkt deze
partij gegevens buiten de EER? Zo ja, op welke grondslag (hoofdstuk V AVG)?

De twee die er in de praktijk vrijwel altijd uitspringen: de **AI-aanbieder** en
een eventuele **foutentracker**. Let ook op de CDN.

Standaardcontractbepalingen alleen zijn sinds *Schrems II* niet automatisch
genoeg; er hoort een afweging bij of het beschermingsniveau in dat land
gelijkwaardig is, en of aanvullende maatregelen nodig zijn.

`[TE BEOORDELEN door een jurist]`

---

## Wat er minimaal in elke overeenkomst moet staan (art. 28 lid 3)

Gebruik dit als afvinklijst bij een contract dat een leverancier u voorlegt:

- [ ] **Onderwerp, duur, aard en doel** van de verwerking
- [ ] **Soort persoonsgegevens** en **categorieën betrokkenen**
- [ ] De verwerker handelt **uitsluitend op schriftelijke instructie** van RTG
- [ ] **Geheimhouding** voor iedereen die toegang heeft
- [ ] **Beveiligingsmaatregelen** conform art. 32
- [ ] **Subverwerkers** alleen met toestemming, en met dezelfde verplichtingen
      doorgelegd *(let op: dit is de meest overgeslagen regel — uw hoster huurt
      zelf ook in)*
- [ ] **Bijstand** bij verzoeken van betrokkenen (inzage, verwijdering)
- [ ] **Bijstand** bij datalekken, DPIA's en voorafgaande raadpleging
- [ ] **Melding van een datalek zonder onredelijke vertraging** — met een
      concrete termijn erin, want uw eigen 72-uursklok loopt door
- [ ] Aan het eind: **wissen of teruggeven** van alle gegevens, naar uw keuze
- [ ] **Auditrecht**: informatie beschikbaar stellen en inspecties toestaan

Die voorlaatste twee zijn degene die leveranciers het vaakst afzwakken. Een
melding "binnen 72 uur" is voor u te laat — dan is uw eigen klok al afgelopen.
Vraag om 24 uur of minder.

---

## Volgorde van aanpakken

1. **Partner-zaken** — de bepaling in de partnerovereenkomst. Grootste aantal,
   raakt bijzondere persoonsgegevens, en wordt met elke nieuwe partner erger als
   u wacht.
2. **AI-aanbieder** — zodra er een echte sleutel in productie gaat. Tot dan is
   er niets te regelen, en dat is een geldige reden om te wachten.
3. **Hosting en betaalprovider** — meestal een standaardcontract accepteren.
4. **CDN en SMTP** — idem.
5. **Foutentracker** — controleer eerst of u er wel een gebruikt. Zo niet:
   schrappen, en één verwerker minder.
