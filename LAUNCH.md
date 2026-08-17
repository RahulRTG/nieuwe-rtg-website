# Livegang-checklist Rahul Travel Group

Alles wat zonder externe accounts kon, is gedaan en getest. Dit document is de
lijst van wat er nog moet gebeuren om echt online te gaan, in volgorde.

> **Lees eerst `LIVEGANG.md`.** Dat is de kortste ondersteunde productieroute en
> beschrijft de techniek zoals die NU is: Docker, PostgreSQL, Redis, TLS en
> Let's Encrypt in de app zelf, versleutelde back-ups met een off-site
> WORM-kopie. Dit bestand gaat over de rest — het juridische, commerciële en
> organisatorische werk dat daarnaast moet gebeuren, en dat geen enkel script
> voor je kan doen.
>
> Waar de twee elkaar tegenspraken, is `LIVEGANG.md` leidend en is dit bestand
> bijgewerkt. Die tegenspraak was echt: hier stond "Node 18+" terwijl de
> accountsdatabase Node 22 eist, en "zet een reverse proxy met TLS ervoor"
> terwijl de app zijn eigen certificaten regelt. Wie deze lijst volgde, bouwde
> de verkeerde opstelling.

## Al geregeld (zit in de code)

- [x] Alle apps en flows: leden, partners per genre, personeel, backoffice
- [x] Geautomatiseerde tests (`npm test`, Node's testrunner, geen extra packages):
      identiteitskluis en wachtwoord-hashing, sessietokens, de zzp-belastingtool
      (rekenkundige invarianten + peiljaar), de leeftijdslaag, De Salon-rechten,
      de bestel- en betaalflow en de AVG-rechten. Draaien in een tijdelijke
      datamap (`RTG_DATA_DIR`), raken echte data niet aan
- [x] Datamap instelbaar met `RTG_DATA_DIR` (data en sleutels los van de app-schijf)
- [x] Blijf ingelogd + uitloggen in elke app; sessies overleven een herstart
- [x] Tokens gehasht op schijf, sessieverloop na 30 dagen, PIN- en login-rate-limiting
- [x] Security-headers: CSP, HSTS (productie), anti-framing, nosniff, Permissions-Policy
- [x] AVG: gegevens downloaden en definitief verwijderen, rechtstreeks in de leden-app
- [x] E-maillaag af: verificatie, wachtwoord-herstel, sollicitatie-besluit,
      verificatie-besluit, partner-onboarding. Zonder SMTP gaan mails naar `server/data/outbox`
- [x] Partner-onboarding: aanmelden via het aanvraag-endpoint, goedkeuren in de backoffice,
      code + manager-PIN automatisch, welkomstmail
- [x] Privacybeleid en algemene voorwaarden (kloppen met de techniek), 404-pagina,
      robots.txt, security.txt
- [x] HTTPS-redirect en HSTS zodra `NODE_ENV=production`
- [x] Dagelijkse back-ups, netjes afsluiten bij herstart. In de livegangroute
      versleuteld (AES-256-GCM), gevalideerd, buiten de Docker-schijf én met een
      tweede write-once-kopie off-site — zie punt 6 en `LIVEGANG.md`
- [x] Onveilige productieconfiguratie blokkeert de start (exitcode 1) in plaats
      van alleen te waarschuwen: ontbrekende `RTG_ENC_KEY`, kluissleutels uit de
      omgeving, demo-betaalprovider, webhook zonder secret. `server/config/productie.js`
- [x] Node-ondergrens wordt bij de start afgedwongen (Node 22+, wegens `node:sqlite`)
- [x] Failover: `npm start` draait drie servers (poort 3001-3003) achter een
      poortwachter op poort 3000. Valt de actieve server uit, dan neemt de
      volgende gezonde server het binnen enkele seconden over (met de laatste
      data van schijf) en wordt de gevallen server automatisch herstart; zodra
      die weer stabiel is, krijgt hij het werk terug. Alleen de actieve server
      schrijft naar de database, en het wegschrijven is atomisch zodat een
      crash nooit een half bestand achterlaat. Een enkele server zonder
      failover starten kan met `npm run single`.

## Nog te doen voor livegang (extern)

1. **Domein + hosting.** **Node 22 of nieuwer** (de accountsdatabase draait op de
   ingebouwde `node:sqlite`; op Node 18 weigert de server nu te starten met die
   reden erbij). Een domein waarvan A/AAAA naar de server wijst, en publiek
   bereikbare poorten 80/443 TCP plus 3478 UDP.

   Een reverse proxy is **niet meer nodig**: met `RTG_TLS=1` en `RTG_ACME=1`
   regelt de app zelf HTTP/2, TLS 1.2/1.3, Let's Encrypt en de vernieuwing. Zet
   je er tóch Caddy/Nginx voor, geef dan `X-Forwarded-Proto` door, want de app
   leunt op `trust proxy`.

   Het failover-trio vangt vastlopers en crashes van de software op; kies bij
   de hoster daarnaast een pakket met redundante hardware (of twee machines),
   want tegen een kapotte machine of stroomuitval helpt alleen een tweede machine.
   Reserveer circa 4 GB RAM extra voor de ClamAV-container die uploads scant.
2. **Omgevingsvariabelen zetten.** `npm run live:init` schrijft ze voor je (zie
   `LIVEGANG.md`); onderstaande lijst is wat je bewust moet kiezen:
   - `NODE_ENV=production`
   - `RTG_ENC_KEY` en de twee kluissleutels — zonder deze weigert de start
   - `OFFICE_CODE=<eigen sterke code>` (vervangt RTG-OFFICE)
   - `DEMO_USER` / `DEMO_PASS` wijzigen of demo-account uitzetten
   - `SMTP_URL=smtp://user:pass@host:587` + `MAIL_FROM="Rahul Travel Group <no-reply@domein.nl>"`
   - **AI:** de standaard livegangroute zet `RTG_AI_UIT=1` — geen externe
     modelserver, de handmatige werkmodus blijft volledig bruikbaar. Wil je wél
     vrije taal, geef dan de voorkeur aan `LOCAL_AI_URL` (lokaal, eigen
     omgeving). Een externe sleutel is een bewuste, aparte keuze en geen
     voorwaarde om live te gaan.
   - **Betalen:** de standaard livegangroute zet `RTG_BETALEN_UIT=1`, waardoor
     elke betaalactie fail-closed weigert. Zie punt 4: zonder provider kun je
     live, maar dan kun je nog geen geld innen.

   De productiestart *weigert* (exitcode 1) bij een onveilige combinatie in
   plaats van te waarschuwen — zie `server/config/productie.js`.
3. **E-maildomein:** SPF/DKIM/DMARC instellen bij de DNS zodat mail aankomt.
4. **Betalingen:** Mollie of Adyen koppelen. Alles wat zij vragen is er:
   KvK 82273510 (statutair RTG, handelsnamen RTG Lifestyle en RTG Business),
   btw-id NL002291440B89 en zakelijke rekening NL62 INGB 0111 1775 88 t.n.v. RTG
   (tenaamstelling komt overeen met de KvK-naam). Aanmelden kan per direct.

   **In productie blijven betalingen niet "gesimuleerd" — dat kan niet meer.**
   Zonder echte provider weigert de productiestart, juist omdat de demo-provider
   elke betaling zelf bevestigt; dat is precies de stille onveilige stand die
   `server/config/productie.js` uitsluit. Je hebt dus twee eerlijke opties:
   koppel een provider, óf ga live met `RTG_BETALEN_UIT=1`, waarbij elke
   betaalactie fail-closed weigert en leden in het betaalscherm de
   overboekingsinstructie zien met bovenstaande IBAN en hun codenaam als
   kenmerk. Dat tweede is een geldige start, maar reken erop dat je dan
   handmatig incasseert en afletteren mensenwerk is.
5. **Kluis-sleutels:** `server/data/secret.key` en `vault.key` verhuizen naar een
   secrets manager van de hosting; nooit in git.
6. **Database en schaal (belangrijk, eerlijk):** PostgreSQL is er inmiddels en is
   in de livegangroute de standaard — de opslagkeuze volgt uit de omgeving
   (`DATABASE_URL`, of `RTG_STORE` als die is gezet; zie `server/db/keuze.js`).
   Zonder `DATABASE_URL` valt de app terug op het enkele `db.json` dat bij elke
   wijziging in zijn geheel atomisch wordt herschreven: veilig en simpel, maar
   het schaalt niet naar duizenden gelijktijdige gebruikers. **Ga niet live op
   de json-stand.** Controleer na de uitrol expliciet dat je op Postgres draait
   en niet stil op het bestand bent teruggevallen.

   Twee dingen om open over te zijn:
   - De Postgres-client is er een van eigen makelij (`server/pgwire/`, ruim 400
     regels op `node:net`/`node:tls`, met SCRAM en een eigen pool) in plaats van
     het `pg`-pakket. Dat past bij de nul-dependency-lijn en het is getoetst,
     maar het mist zaken die `pg` wél heeft — onder meer het annuleren van een
     lopende query (`CancelRequest`) en het COPY-protocol. Er wordt een
     `statement_timeout` gezet, en dat is op dit moment je enige rem op een
     doorgeslagen query. Houd dit in de gaten bij de eerste echte belasting.
   - Het failover-trio vangt een vastloper of crash van de software op
     (crashbestendigheid), maar geeft GEEN extra capaciteit; er schrijft maar
     één server tegelijk. Bescherming tegen kapotte hardware komt pas met
     meerdere machines.

   Back-ups: de livegangroute maakt dagelijks een gevalideerde, met AES-256-GCM
   versleutelde back-up buiten de Docker-schijf, plus een tweede write-once-set
   op een off-site WORM/Object-Lock-doel. Bewaar de privésleutel offline en
   test het herstelpad — een back-up die je nooit hebt teruggezet is geen
   back-up.
7. **Juridisch nalopen (voor livegang door een advocaat laten toetsen):**
   - De drie documenten: privacybeleid, algemene voorwaarden en partnervoorwaarden
     (gebundeld in de juridische ROS-app: `/apps/juridisch/privacy.html`,
     `/apps/juridisch/voorwaarden.html`, `/apps/juridisch/partnervoorwaarden.html`).
     Het partner-akkoord wordt al technisch afgedwongen en vastgelegd bij de aanvraag.
   - E-mailadressen (privacy@/legal@/partners@/security@) echt aanmaken.
   - Verwerkersovereenkomsten met partners formeel ondertekenen (de afspraken staan
     in de partnervoorwaarden, maar een getekende DPA per partner is netter).
   - **Platformmodel (bewuste keuze):** RTG is bemiddelaar, geen reisorganisator.
     Elke dienst is een losse overeenkomst tussen lid en partner en wordt apart en
     rechtstreeks aan de partner betaald. Laat de advocaat toetsen dat deze
     constructie standhoudt (organisator vs. gekoppeld reisarrangement) en of de
     informatieplicht bij gekoppelde reisarrangementen (standaardformulieren)
     voldoende in de bestelflow zit.
   - **Productregel die dit model beschermt:** bundel NOOIT meerdere reisdiensten
     in een boeking of betaling ("boek je hele reis in een tik" zou RTG alsnog
     organisator maken en SGR/insolventiedekking vereisen).
   - **Founding-actie:** bepaal en publiceer de sluitingsdatum (staat nu als "wordt
     nog aangekondigd" in de partnervoorwaarden) en leg per
     partner vast wanneer de uitnodiging is verstuurd en wat het antwoord was; dat
     bewijs bepaalt later wie founding is. Laat de doorbelasting van
     onderhoudskosten "zonder maximum" toetsen: een open kostenclausule is b2b
     toegestaan maar moet transparant en gespecificeerd zijn om afdwingbaar te
     blijven (overweeg een jaarlijkse specificatieplicht en een opzegrecht bij
     forse stijging).
   - **Ledenprijsgarantie (bewust geen prijspariteit):** de partnervoorwaarden
     bevatten een ledenprijsgarantie die uitsluitend aan de EIGEN publieke prijs
     van de partner refereert. Dit is bewust: brede prijspariteitsclausules
     (verbod om elders goedkoper te zijn) vallen sinds 2022 buiten de Europese
     groepsvrijstelling en zijn in o.a. Frankrijk, Belgie, Oostenrijk en Italie
     voor hotels zelfs helemaal verboden (zie ook HvJ EU 2024 inzake Booking.com).
     Laat de clausule per land toetsen en verbreed hem nooit naar andere kanalen;
     exclusiviteit eisen is om dezelfde reden uitgesloten.
   - **Merchant of record:** richt de betaaldienstverlener zo in dat de partner de
     ontvanger van elke betaling is (bijv. directe charges op het account van de
     partner, zoals Stripe Connect direct charges). RTG mag zelf geen reizigersgeld
     onder zich houden; anders komen derdengelden en mogelijk een PSD2-vraag terug.
   - **Cadeaukaarten:** het openstaande saldo is een verplichting van de uitgevende
     partner; de verkoop loopt, net als alles, rechtstreeks naar de partner. Laat
     toetsen dat RTG hiermee buiten een derdengeldenregeling blijft.
   - **Fiscale/AI-tools:** de disclaimers ("voorlichting, geen advies") staan overal
     in de app en in de voorwaarden; laat de landenregels (LANDEN/ZZP in
     `server/server.js`) jaarlijks actualiseren.
   - **Vertrouwenspersoon:** wijs een echte, gekwalificeerde vertrouwenspersoon aan;
     de app garandeert al dat werkgevers geen inzage hebben.
   - **Leeftijdscontrole alcohol:** contractueel bij de partner belegd
     (partnervoorwaarden art. 4) en zichtbaar in de bestelflow (18+-melding).
8. **Noodserver extern hosten:** draai `server/nood.js` bij een ANDERE hoster in
   een ANDER datacenter dan de hoofdservers (bijv. hoofdservers bij hoster A,
   noodserver bij hoster B), met `RTG_HOOFD_URL` naar de hoofdingang. Publiceer
   het noodadres (bijv. nood.rahultravelgroup.example) op een plek die leden
   kennen, of regel DNS-failover naar het noodadres.
9. **Extern security-audit / pentest** voor de eerste echte klantdata.
10. **App stores (optioneel):** de PWA's werken al op het beginscherm; native
   verpakking (Capacitor) kan later zonder herbouw.

## Handig om te weten

- Outbox-mails lezen: `ls server/data/outbox/` (nieuwste bovenaan met `ls -t`)
- Back-ups staan in `server/data/backups/<datum>/`
- Verse demo-data: stop de server en verwijder `server/data/db.json` (en `rtg.db` voor accounts)
