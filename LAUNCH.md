# Livegang-checklist Rahul Travel Group

Alles wat zonder externe accounts kon, is gedaan en getest. Dit document is de
lijst van wat er nog moet gebeuren om echt online te gaan, in volgorde.

## Al geregeld (zit in de code)

- [x] Alle apps en flows: leden, partners per genre, personeel, backoffice
- [x] Blijf ingelogd + uitloggen in elke app; sessies overleven een herstart
- [x] Tokens gehasht op schijf, sessieverloop na 30 dagen, PIN- en login-rate-limiting
- [x] Security-headers: CSP, HSTS (productie), anti-framing, nosniff, Permissions-Policy
- [x] AVG: gegevens downloaden en definitief verwijderen, rechtstreeks in de leden-app
- [x] E-maillaag af: verificatie, wachtwoord-herstel, sollicitatie-besluit,
      verificatie-besluit, partner-onboarding. Zonder SMTP gaan mails naar `server/data/outbox`
- [x] Partner-onboarding: aanmelden via `/site/partner-worden.html`, goedkeuren in de backoffice,
      code + manager-PIN automatisch, welkomstmail
- [x] Privacybeleid en algemene voorwaarden (kloppen met de techniek), 404-pagina,
      robots.txt, security.txt
- [x] HTTPS-redirect en HSTS zodra `NODE_ENV=production`
- [x] Dagelijkse back-ups (14 dagen) van db.json en rtg.db, netjes afsluiten bij herstart
- [x] Waarschuwingen bij het opstarten als demo-instellingen mee naar productie gaan
- [x] Failover: `npm start` draait drie servers (poort 3001-3003) achter een
      poortwachter op poort 3000. Valt de actieve server uit, dan neemt de
      volgende gezonde server het binnen enkele seconden over (met de laatste
      data van schijf) en wordt de gevallen server automatisch herstart; zodra
      die weer stabiel is, krijgt hij het werk terug. Alleen de actieve server
      schrijft naar de database, en het wegschrijven is atomisch zodat een
      crash nooit een half bestand achterlaat. Een enkele server zonder
      failover starten kan met `npm run single`.

## Nog te doen voor livegang (extern)

1. **Domein + hosting.** Node 18+, `npm install && NODE_ENV=production npm start` achter
   een reverse proxy (Caddy/Nginx/hosting-platform) met TLS-certificaat.
   De app leunt op `trust proxy`; zet de proxy zo dat `X-Forwarded-Proto` meekomt.
   Het failover-trio vangt vastlopers en crashes van de software op; kies bij
   de hoster daarnaast een pakket met redundante hardware (of twee machines),
   want tegen een kapotte machine of stroomuitval helpt alleen een tweede machine.
2. **Omgevingsvariabelen zetten:**
   - `NODE_ENV=production`
   - `OFFICE_CODE=<eigen sterke code>` (vervangt RTG-OFFICE)
   - `DEMO_USER` / `DEMO_PASS` wijzigen of demo-account uitzetten
   - `SMTP_URL=smtp://user:pass@host:587` + `MAIL_FROM="Rahul Travel Group <no-reply@domein.nl>"`
   - `ANTHROPIC_API_KEY=...` voor echte AI en vloeiende chatvertaling
3. **E-maildomein:** SPF/DKIM/DMARC instellen bij de DNS zodat mail aankomt.
4. **Betalingen:** Mollie of Adyen koppelen. Alles wat zij vragen is er:
   KvK 82273510 (statutair RTG, handelsnamen RTG Lifestyle en RTG Business),
   btw-id NL002291440B89 en zakelijke rekening NL62 INGB 0111 1775 88 t.n.v. RTG
   (tenaamstelling komt overeen met de KvK-naam). Aanmelden kan per direct. Tot de koppeling blijven app-betalingen gesimuleerd; leden zien
   in het betaalscherm wel al de overboekingsinstructie met deze IBAN en hun
   codenaam als kenmerk.
5. **Kluis-sleutels:** `server/data/secret.key` en `vault.key` verhuizen naar een
   secrets manager van de hosting; nooit in git.
6. **Database:** bij groei db.json vervangen door PostgreSQL; de SQLite-accounts
   kunnen langer mee. Back-ups extern opslaan (nu lokaal, 14 dagen).
7. **Juridisch nalopen (voor livegang door een advocaat laten toetsen):**
   - De drie documenten: privacybeleid, algemene voorwaarden en partnervoorwaarden
     (`/site/privacy.html`, `/site/voorwaarden.html`, `/site/partnervoorwaarden.html`).
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
     nog aangekondigd" op partner-worden en in de partnervoorwaarden) en leg per
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
