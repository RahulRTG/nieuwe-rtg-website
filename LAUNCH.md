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

## Nog te doen voor livegang (extern)

1. **Domein + hosting.** Node 18+, `npm install && NODE_ENV=production npm start` achter
   een reverse proxy (Caddy/Nginx/hosting-platform) met TLS-certificaat.
   De app leunt op `trust proxy`; zet de proxy zo dat `X-Forwarded-Proto` meekomt.
2. **Omgevingsvariabelen zetten:**
   - `NODE_ENV=production`
   - `OFFICE_CODE=<eigen sterke code>` (vervangt RTG-OFFICE)
   - `DEMO_USER` / `DEMO_PASS` wijzigen of demo-account uitzetten
   - `SMTP_URL=smtp://user:pass@host:587` + `MAIL_FROM="Rahul Travel Group <no-reply@domein.nl>"`
   - `ANTHROPIC_API_KEY=...` voor echte AI en vloeiende chatvertaling
3. **E-maildomein:** SPF/DKIM/DMARC instellen bij de DNS zodat mail aankomt.
4. **Betalingen:** Mollie of Adyen koppelen. KvK (82273510, statutair RTG, met
   handelsnamen RTG Lifestyle en RTG Business) en zakelijke rekening
   (NL62 INGB 0111 1775 88, t.n.v. RTG) zijn er allebei en de tenaamstelling komt
   overeen met de KvK-naam, dus het aanmelden bij een betaalprovider kan per direct. Tot de koppeling blijven app-betalingen gesimuleerd; leden zien
   in het betaalscherm wel al de overboekingsinstructie met deze IBAN en hun
   codenaam als kenmerk.
5. **Kluis-sleutels:** `server/data/secret.key` en `vault.key` verhuizen naar een
   secrets manager van de hosting; nooit in git.
6. **Database:** bij groei db.json vervangen door PostgreSQL; de SQLite-accounts
   kunnen langer mee. Back-ups extern opslaan (nu lokaal, 14 dagen).
7. **Juridisch nalopen:** privacybeleid en voorwaarden door een jurist laten toetsen;
   e-mailadressen (privacy@/legal@/security@) echt aanmaken; verwerkersovereenkomsten
   met partners.
8. **Extern security-audit / pentest** voor de eerste echte klantdata.
9. **App stores (optioneel):** de PWA's werken al op het beginscherm; native
   verpakking (Capacitor) kan later zonder herbouw.

## Handig om te weten

- Outbox-mails lezen: `ls server/data/outbox/` (nieuwste bovenaan met `ls -t`)
- Back-ups staan in `server/data/backups/<datum>/`
- Verse demo-data: stop de server en verwijder `server/data/db.json` (en `rtg.db` voor accounts)
