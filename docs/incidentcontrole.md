# Permanente controle en incidentbediening

De technische pagina bevat een eigenaar-only controlelaag voor drie vragen:

1. Draait exact de code die is gebouwd?
2. Welke bestanden, routes en functies bestaan er nu?
3. Hoe sluit ik bij een incident gericht iets af en hoe herstel ik exact de oude stand?

De laag heeft geen externe dependencies en stuurt nooit broninhoud of geheimen
naar de browser. Het scherm toont uitsluitend paden, methoden, groottes,
SHA-256-hashes, functieschakelaars en auditregels.

Deze Node-laag is de fijnmazige binnenbediening. De zelfstandige Rust Sentinel
staat vóór de app en kan haar ook afsluiten wanneer Node niet meer te vertrouwen
is. Gebruik bij een mogelijk proces- of codecompromis eerst de Sentinel volgens
`docs/sentinel.md`; gebruik daarna dit scherm voor diagnose en losse functies.

## Integriteit

`npm run release:build` bouwt frontend en Rust en schrijft daarna
`.release/release-bewijs.json`. De Docker-build schrijft hetzelfde bewijs naar
`/app/release-bewijs.json`. De knop **Controleer alle code nu** vergelijkt alle
runtimebestanden opnieuw en meldt:

- nieuw bestand buiten het bewijs;
- ontbrekend bestand;
- veranderde grootte of inhoud;
- beschadigd bewijs;
- een bewijsbestand dat afwijkt van de externe pin.

Een hashbewijs dat op dezelfde beschrijfbare machine staat, beschermt goed tegen
onbedoelde wijzigingen maar niet tegen een aanvaller die code en bewijs beide mag
overschrijven. Bewaar daarom de SHA-256 van het bewijs ook buiten de server en zet
hem als `RTG_RELEASE_BEWIJS_SHA256`. De controlekamer toont expliciet of die pin
aanwezig is en klopt.

## Vier standen

| Stand | Effect |
| --- | --- |
| Normaal | Geen incident actief. Bestaande schakelaars gelden. |
| Waakzaam | Legt een incident en reden vast zonder verkeer te sluiten. |
| Beperkt | Zet een gekozen functie direct uit via de bestaande functieschakelaar. |
| Isolatie | Zet alle productfuncties en de onderhoudszekering uit. |

Techniek, Boardroom, health, ready, monitoring en wettelijke privacy- en
toestemmingsroutes blijven bewust buiten de noodschakelaars. Daardoor blijft de
eigenaar binnen, blijven monitors eerlijk en kan een gebruiker zijn wettelijke
rechten blijven uitoefenen.

Bij de eerste beperking bewaart de incidentcontrole de bestaande stand van elke
geraakte functie. Een latere uitbreiding bewaart alleen de nieuw geraakte standen.
**Bewaarde standen herstellen** zet precies die waarden terug; wijzigingen aan
andere functies tijdens het incident worden niet overschreven. Isolatie en herstel
vragen daarnaast de letterlijke bevestiging `ISOLEER RTG` of `HERSTEL RTG`.

Elke handeling bevat tijd, eigenaarssleutel, reden, revisie en geraakte functies.
Het incidentauditspoor wordt niet door een herstelactie gewist.

## Handelwijze bij mogelijke malware

1. Open `/apps/techniek.html` en lees De Wacht en De Ontsmetter.
2. Klik **Controleer alle code nu**.
3. Is slechts één domein verdacht, kies de bijbehorende functie en klik
   **Functie direct dicht**.
4. Is de omvang onbekend of wijkt kerncode af, kies **Hele app isoleren**.
5. Bewaar logs, releasebewijs en container/image voor onderzoek. Verwijder niets.
6. Rol een bekende schone, opnieuw gebouwde image uit.
7. Controleer de code opnieuw. Herstel pas bij een groene uitslag en leg de reden
   vast.

De uploadscanner blokkeert besmette uploads al vóór opslag en stelt bronquarantaine
voor. Een upload schakelt niet automatisch een compleet productdomein uit: anders
kan een aanvaller met een testvirus zelf een denial-of-service veroorzaken. De
eigenaar ziet bij uploadmeldingen wel de route en de aanbevolen functieschakelaar.

## Eigenaar-API

- `GET /api/techniek/controle/status`
- `POST /api/techniek/controle/integriteit`
- `GET /api/techniek/controle/inventaris?soort=routes|bestanden&zoek=...`
- `POST /api/techniek/controle/incident`

Al deze routes vereisen het geldige accounttoken van de huidige eigenaar en staan
buiten de productschakelaars. De volledige contracten zijn vastgelegd in
`test/incidentcontrole.test.js` en `test/incidentcontrole-route.test.js`.
