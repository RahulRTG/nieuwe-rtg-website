# RTG V1 — RELEASE READINESS AUDIT

> **STATUS 6 oktober 2026 — remediatie ronde 1 tot en met 4 uitgevoerd.**
>
> - **Ronde 1:** de 2 P0's, de P1 en de kapotte release-gate uit ronde 0 zijn
>   gerepareerd, met regressietests én een onafhankelijke adversariële
>   herkeuring. Het verdict ging van **🔴 NO-GO** naar **🟡 CONDITIONAL GO**.
> - **Ronde 2:** de P2-staart (C3, C4, C5, C6, D1) is VERIFIED FIXED, na vier
>   herkeuringsrondes.
> - **Nieuw:** de herkeuringen vonden een P1 die er al was (N1: de
>   techniek-inlog zonder tweede factor) plus negen kleinere punten.
> - **Ronde 3:** de besluiten over N1, N2, N4 en N6 zijn uitgevoerd. N2 en N4
>   zijn VERIFIED FIXED. N1 en N6 zijn dicht met een kanttekening.
> - **Ronde 4:** N3, N11 en N12 zijn VERIFIED FIXED, na een herkeuring per
>   bevinding en een gezamenlijke eindkeuring. Er staat geen P0 of P1 meer open
>   in de code.
> - **Verdict nu:** 🟡 CONDITIONAL GO, **84/100**. Wat nog open staat:
>   - de externe poorten F3–F6;
>   - een besluit over twee P2's die er al waren: N19 (een werksessie zonder
>     tweede factor) en N18 (een slash omzeilt de inlogpauze).
>
> Zie **§REMEDIATIESTATUS** (ronde 1 tot en met 4) direct onder sectie A. De
> oorspronkelijke ronde-0-bevindingen blijven hieronder staan met hun status
> (OPEN / FIXED / VERIFIED FIXED).

*Volledige end-to-end release-audit van de gehele RTG-codebase. Doel: één vraag —
kan RTG V1 verantwoord naar productie voor echte gebruikers, bedrijven en
organisaties?*

- **Commit:** `b7f14dfa` (main, 5 oktober 2026)
- **Methode:** 12 parallelle, read-only dimensie-audits (authN, authZ, isolatie,
  betalingen, data/transacties, websec, secrets/deploy, privacy/AVG,
  reliability, architectuur, frontend↔backend, observability/tests). Elke
  P0/P1-bevinding adversarieel nagetrokken tegen de echte code. De twee zwaarste
  bevindingen zijn door de auditor zélf gereproduceerd/narekend.
- **Bewijsbasis:** de code is leidend. De ~150 `.md`-documenten en ~200
  `.json`-registers in de repo zijn als **claims** behandeld, niet als bewijs;
  afwijkingen staan expliciet gemeld. Veel registers lopen enkele dagen tot
  weken achter op `HEAD`.
- **Zelf uitgevoerd (read-only):** Rust-motor gebouwd; volledige Node-testsuite
  gedraaid tegen echte PostgreSQL 16 + Redis (15.773 tests); de 2FA-bypass
  live gereproduceerd tegen de echte `accounts`-module; webhook-,
  meldingen- en productie-gating-code regel-voor-regel geverifieerd.
- **Niet verifieerbaar in deze omgeving:** gedrag tegen een echte productiehost
  (TLS/ACME/DNS/objectopslag/SMTP/betaalprovider), de low-level pgwire-driver
  onder echte concurrency, en de externe/juridische vrijgave-items. Deze staan
  als zodanig gemarkeerd.

---

## A. EXECUTIVE VERDICT

### 🔴 NO-GO
**Release readiness: 70/100**

1. De technische grondslag is **sterk en op veel punten aantoonbaar
   productierijp** (betalingen, cryptografie/kluis, PostgreSQL-transacties, CSP,
   auditspoor, backup/herstel, AVG-wissing). Dit is geen fragiele codebase.
2. **Maar twee bevestigde P0's blokkeren een publieke V1** en bijten juist in
   productie (onzichtbaar in de demo-opzet).
3. **P0-1 — volledige 2FA-bypass + sessie-uit-e-maillink.** `verifyToken`
   onderscheidt een sessietoken niet van een actietoken; elk `inlog2`- of
   `verify-email`-token werkt als volwaardige sessie. **Door de auditor live
   gereproduceerd.**
4. **P0-2 — cross-member privacylek (AVG).** Persoonlijke meldingen (boekingen,
   conciërge-/gast-chat, identiteitsverificatie) komen in een per-pas gedeelde
   bak + SSE-broadcast en zijn zichtbaar voor álle leden met dezelfde pas.
5. **P1 — productie-hardening hangt aan `NODE_ENV=production`.** De ondersteunde
   Docker/golive-weg zet die en is veilig, maar een publieke deploy die hem
   vergeet opent de backoffice (identiteitskluis, paspoortscans) op een gedeelde
   code en zet encryptie-at-rest stil uit. Door 4 onafhankelijke dimensies
   gezien.
6. **De testsuite is ROOD op de release-commit** (`test/schermeigenaar.test.js`
   faalt: `site/techniek/techniek.html` ontbreekt in `SCHERMEIGENAAR.json`). De
   release-gate eist een volledig groene, skip-vrije suite, dus hij kan vandaag
   hoe dan ook niet READY worden.
7. **Externe/juridische randvoorwaarden zijn niet vervuld** (en kúnnen niet in
   code worden opgelost): geen onafhankelijke pentest, geen bewezen
   productiehost/TLS, geen getekende DPIA/verwerkersovereenkomsten, geen
   besluit over het geldmodel/uitbetaalprovider. Deze blokkeren een
   verantwoorde launch onafhankelijk van de P0's.
8. **De code-blockers zijn weinig en lokaal.** P0-1 en P0-2 zijn elk een kleine,
   geïsoleerde reparatie; de P1 is een fail-safe-default-wijziging. De afstand
   in *codewerk* tot CONDITIONAL GO is klein.
9. **Waarom 70 en niet lager:** het overgrote deel van de ~5.182 routes, de
   geldlaag en de dataconsistentie zijn solide; 15.770/15.773 tests groen; de
   gevaarlijkste stromen (AVG-wissing, betaalwebhook, ongeverifieerde
   betaalbevestiging) zijn met echte modules beproefd, niet gemockt.
10. **Waarom niet hoger:** twee live exploiteerbare security/privacy-gaten, een
    rode suite op de release-commit, en een reeks onvervulde externe/legale
    poorten maken een publieke launch vandaag onverantwoord.

**Samengevat:** een smalle NO-GO. Repareer P0-1 en P0-2, maak de P1-hardening
deploy-onafhankelijk, krijg de suite groen, en los de externe/legale poorten op
→ dan CONDITIONAL GO.

---

## REMEDIATIESTATUS — ronde 1 (5 oktober 2026)

Branch: `codex/rtg-v1-release-blockers`. Alle code-blockers uit ronde 0 zijn
gerepareerd, elk met een regressietest die vóór de fix zakt en erna slaagt, en
daarna onafhankelijk adversarieel herkeurd (een andere agent dan de implementer
heeft de oorspronkelijke exploits opnieuw tegen de patch gedraaid, met
≥2 ontwijkvarianten per blocker).

### Nieuw verdict (code): 🟡 CONDITIONAL GO — Release readiness: 82/100

De concrete *technische* redenen voor de ronde-0 NO-GO zijn aantoonbaar weg
(nieuw bewijs, niet louter "er is code gewijzigd"): de 2FA-/actietoken-bypass,
het cross-member meldingenlek en de `NODE_ENV`-afhankelijke hardening zijn
gereproduceerd-dicht en door een tweede, onafhankelijke keuring bevestigd; de
release-gate (rode suite) is groen op alle register-/schermeigenaar-toetsen.

Waarom CONDITIONAL en geen GO, en waarom 82 en niet hoger: de resterende poorten
zijn **extern/juridisch en niet in code op te lossen** — onafhankelijke pentest,
bewezen productiehost + TLS/DNS, getekende DPIA/verwerkersovereenkomsten, het
besluit geldmodel + uitbetaalprovider, en een image-kwetsbaarheidsscan (sectie F,
F3–F6). Ook de P2/P3-staart (secties C-G) is bewust *niet* aangeraakt (geen scope
creep). De code kan dus richting V1; de launch-kwalificatie hangt op de externe
gates.

### Per blocker — BEFORE / FIX / AFTER / REGRESSION

| # | Sev | Status | Commit | Bewijs (regressie + herkeuring) |
|---|---|---|---|---|
| 1 | P0 | **VERIFIED FIXED** | `247fa66e` | Actietokens tekenen onder een per-doel HKDF-sleutel (`kluis.signMet`/`sleutelVoor('actie:'+purpose)`); `verifyToken` weigert elk actietoken (+ numerieke-exp-grens). `test/token-domeinscheiding.test.js` 11/11; herkeuring reproduceerde de bypass **dicht** voor `inlog2`/`verify-email`/`mailwissel`/`sso-overdracht` + varianten; 2FA-flow intact. |
| 2 | P0 | **VERIFIED FIXED** | `eea75f7f` (+`b70c1383`) | `meld()` routeert op bestemmingssoort (lid-sleutel = persoonlijk; pas = fail-closed drop tenzij expliciete `notify.broadcast`); `meldingenVan` geeft uit de pas-bak alleen broadcasts; alle persoonlijke schrijvers op de ledensleutel. `test/meldingen-isolatie.test.js` 5/5 (unit-routing + e2e: B leest A's melding niet; SSE-isolatie deterministisch via `doel:'key'`). Herkeuring: census van álle `notify()`-callers, geen lek. |
| 3 | P1 | **VERIFIED FIXED** | `37415250` | Een aantoonbaar openbaar adres telt voor beveiliging als productie: `config/openbaar.js` → hardeFouten (start afgebroken ongeacht `NODE_ENV`), `productiedeur.isProductie` sluit de gedeelde kantoorcode, inlogrem aan. `test/productie-failclosed.test.js` 10/10; herkeuring bevestigde fail-closed + contrast (lokaal/onbekend blokkeert niet). |
| 4 | gate (P2) | **VERIFIED FIXED** | `28d0fc4e` | `site/techniek/techniek.html` geregistreerd in `SCHERMEIGENAAR.json`; `test/schermeigenaar.test.js` 11/11; `registerklopt` groen op alle register-toetsen (enige rest: het shallow-clone `bewijskosten`-artefact = INFRA). AFGELEID/GASTSPLITSING/FUNCTIES herijkt. |

**Onafhankelijke herkeuring (samengevat):** *"De concrete technische oorzaken van
de oorspronkelijke P0/P1 NO-GO zijn aantoonbaar weg … Geen enkele blocker was nog
exploiteerbaar."* Enige resterende rode poort: het bekende shallow-clone
git-artefact in `bewijskosten.test.js` (INFRA, geen exploit).

### Testbewijs (PASS / FAIL / INFRA / NIET GEVERIFIEERD)

- **PASS** — regressiesuites: token-domeinscheiding (11), meldingen-isolatie (5),
  productie-failclosed (10), schermeigenaar (11); plus de aangrenzende bestaande
  suites die de fixes raken (auth/tokens, orders/salon/supplier/realtime,
  config/kantoor, sqlite-audit-selectief 39/39, klokwacht, functielijst).
- **INFRA** (geen codefout, omgeving ontbreekt het artefact; raakt geen door deze
  tak gewijzigde code): `bewijskosten` (git-diff over commits die in de shallow
  clone ontbreken), `*.pg`/living-world (vereisen `DATABASE_URL`), sentinel-/
  motor-/magnaat-subtoetsen (vereisen de gebouwde Rust-binaries). De diff raakt
  geen van die domeinen, dus ze hangen puur aan het ontbrekende artefact; in
  CI/sandbox mét die artefacten slagen ze.
- **NIET GEVERIFIEERD** (ongewijzigd t.o.v. ronde 0): echte productiehost
  TLS/DNS/objectopslag/SMTP, de pgwire-driver onder echte concurrency, loadtests,
  en alle externe/juridische items (F3–F6).

### Wat deze ronde NIET heeft gedaan (bewust)
Geen nieuwe functies, geen redesign, geen P2/P3-opruiming, geen nieuwe
architectuurlaag. Uitsluitend de vier release-blockers + de direct daaruit
volgende register-/testherijking.

---

## REMEDIATIESTATUS — ronde 2: de P2-staart (5 oktober 2026)

Branch: `codex/rtg-v1-release-blockers` (PR #487). Na ronde 1 koos de eigenaar
voor **de hele P2-staart**: C3, C4, C5, C6 en D1. Voor C6 koos hij **alleen de
gevaarlijke combinatie**:

- SQLite met meer dan een schrijvend proces wordt in productie en op een
  openbaar adres geweigerd;
- een enkel SQLite-proces blijft een geldige productiestand;
- een samenvoegbotsing die er dan nog is, moet hoorbaar zijn en niet stil.

Werkwijze per bevinding:

1. reproduceren;
2. de oorzaak vinden;
3. repareren;
4. een regressietoets die vóór de reparatie zakt en erna slaagt;
5. een onafhankelijke adversariële herkeuring: een andere agent dan de
   implementer draait de exploit opnieuw, met varianten en mutaties;
6. breder zoeken in dezelfde foutklasse.

Er zijn **vier herkeuringsrondes** geweest. Elke ronde vond iets wat de vorige
reparatie miste, en dat is hieronder niet weggepoetst.

### Nieuw verdict (code): 🟡 CONDITIONAL GO — Release readiness: 80/100

**Waarom lager dan 82, terwijl de P2-staart dicht is.** Dat ligt niet aan iets
dat slechter werd. De herkeuringen vonden **een P1 die er in ronde 1 al was en
niet was meegeteld**: de inlog op de techniekpagina geeft op alleen het
wachtwoord een volwaardig accounttoken (N1 hieronder), ook voor het
eigenaarsaccount. Dat weegt zwaarder dan vijf gesloten P2's.

**Wat het nieuwe bewijs wel oplevert:**

- C3, C4, C5 en D1 zijn VERIFIED FIXED. Hun regressietoetsen zakken op de oude
  code en slagen op de nieuwe, en de herkeuring van ronde 3 draaide de exploits
  opnieuw dicht.
- Ook de kern van C6 is VERIFIED FIXED. In ronde 4 ontstonden in geen enkel
  scenario nog twee leiders of twee schrijvers, ook niet met echte processen en
  niet in 140 fuzzrondes.
- Dertien mutanten die de herkeuringen zagen overleven, worden nu door een
  toets gevangen.

**De code-voorwaarden voor GO**, bovenop de externe poorten van ronde 1 (sectie
F, F3–F6):

- **N1 dicht** (techniek-inlog zonder tweede factor);
- **een besluit over N2** (nieuwe herstelcodes met alleen het wachtwoord);
- **voor een uitrol met het failover-trio: N6 dicht** (een stand-by bevestigt
  schrijfacties met 200 zonder ze te bewaren).

### Per bevinding — BEFORE / FIX / AFTER / REGRESSIE

| # | Sev | Status | Commits | BEFORE → AFTER | Regressie (zakt vóór, slaagt na) |
|---|---|---|---|---|---|
| C3 | P2 | **VERIFIED FIXED** | `ce494056`, `d4391f3d`, `d8d6154c`, `dd8a3a49` | **Vóór:** de TOTP-code op `/api/auth/tweede` was onbeperkt te raden; een verkeerde code trekt het bewijs met opzet niet in. **Na:** een emmer per ACCOUNT (10) en een per BRON (50), via `tooManyTries`/`noteFailedTry`. Een vol slot houdt ook de juiste code tegen. `/api/mijn/tweefactor/uit` deelt dezelfde accountemmer. | `test/tweede-rem.test.js` 1-4. Toets 3 gokt over tien adressen en twee bewijzen. Toets 4 gokt op `/uit` vanaf wisselende adressen en kijkt daarna of de inlog ook dicht zit. |
| C4 | P2 | **VERIFIED FIXED** | `abe4a2f1`, `7de740f4`, `d8d6154c`, `dd8a3a49` | **Vóór:** `RTG_DEV_LINKS=1` zette herstellinks en sms-codes in het HTTP-antwoord en kwam door de productiekeuring. **Na:** deze vlaggen zijn een harde fout in productie én op een openbaar adres zonder `NODE_ENV`: `RTG_DEV_LINKS`, `RTG_LIEG`, `RTG_STAATLOG` (1/2), `RTG_VERRAAD`, `RTG_KLOK` en `RTG_DUURZAAM=uit`. Op een onbekend adres geeft `RTG_DEV_LINKS` een waarschuwing. | `test/productie-failclosed.test.js` 18-20. Toets 20 toetst per vlag meer dan één waarde (hoofdletters, een absoluut moment, elke bekende verraadnaam). |
| C5 | P2 | **VERIFIED FIXED** | `5ce141b7`, `6453dcc3`, `d8d6154c`, `dd8a3a49` | **Vóór:** de payroll-bronlaag haalde een opgegeven URL op zonder filter op interne adressen en volgde omleidingen. **Na:** `kern/payroll/bronophalen.js`, bij het registreren én bij het ophalen. Het pakket: alleen https, een naam met domein en een publiek ogend topdomein (`redis.rtg_data` en `.internal`/`.lan`/`.local` tellen niet), `veiligeExternalUrl`, `redirect: 'error'`, 10 s tijdslimiet (ook op het lezen), 2 MB grens, en een BOM vooraan breekt de bron niet. | `test/payroll-ssrf.test.js` 1-10. Toets 9 loopt over het productiepad `urlBron`. Plus `test/office-payroll-dekking.test.js`. |
| C6 | P2 | **VERIFIED FIXED** (kern, herkeuring ronde 4). Het restvenster uit ronde 4 (een herstarte stand-by kreeg 95-803 ms verkeer) is FIXED in `b6c423e2`, maar niet meer onafhankelijk herkeurd | `5e8ed2f9`, `dad44086`, `d8d6154c`, `4c68adee`, `b6c423e2` | **Vóór:** de samenvoeging tussen processen liet stil de laatste schrijver winnen. **Na:** (a) productie en een openbaar adres weigeren SQLite met `RTG_SPREIDING=1`+`REDIS_URL` of een opgesplitst `RTG_DOMAINS`. (b) Elke SQLite-merge meldt een botsing (`db/botsing.js`), ook "de ene kant verwijderde wat de andere wijzigde". (c) In het failover-trio wordt een oude leider of een niet-bevestigde kandidaat aantoonbaar afgezet (of gestopt) voordat een ander leider wordt. De failback loopt onder het slot van `kiesActieve`. Een actieve die zelf `leider: false` meldt, wordt opnieuw gepromoveerd en krijgt tot dan geen verkeer. | `test/productie-failclosed.test.js` 13-17, `test/sqlite-botsing.test.js` 1-9, `test/trio-afzetten.test.js` 1-14 (4-9 en 14 zakken op de vorige reparatie, 10-13 vangen mutanten), en de `/api/health`-contracttoets in `test/api-contract.test.js`. |
| D1 | P2 | **VERIFIED FIXED** | `9b35baa5`, `6ba08c8f`, `d8d6154c`, `dd8a3a49` | **Vóór:** een crash (`uncaughtException`) spoelde minder dan SIGTERM. **Na:** één lijst (`opzet/stopspoeling.js`) voor beide wegen. Een crash midden in een `bijeen()`-bundel spoelt de opslag NIET, zodat een halve geldmutatie niet op schijf belandt; zonder bundelvraag valt dat dicht. De genadetermijn is begrensd, de exitcode is altijd 1, en de bedrading in `server.js` wordt op de echte bundelvraag getoetst. | `test/stopspoeling.test.js` 1-5. Toets 4g crasht een echte SQLite-opslag midden in een bundel en vindt `{X:100,Y:0}` terug. |

### Herkeuringsverloop

- **Ronde 1 (op `3b2400d8`).** **D1 werd erger.** De crashweg flushte nu ook
  de write-behind, dus een crash midden in een bundel legde een halve mutatie
  vast (`{X:50,Y:0}`). Gerepareerd in `6ba08c8f`. **C6 was niet gefixt:** het
  trio kon promoveren terwijl de oude leider nog leefde. **C3, C4 en C5 waren
  deels dicht**, met restpunten (emmer per bewijs, namen zonder domein,
  `RTG_LIEG`/`RTG_STAATLOG`).
- **Ronde 2 (op `2b7c4e41`).** **C6 nog steeds niet gefixt (P1, blokkerend).**
  Een promote die bij de poortwachter een time-out gaf maar door de server wel
  was uitgevoerd, leverde twee leiders op. D1, C3, C4 en C5 waren dicht met
  kanttekeningen. Gerepareerd in `d8d6154c`, met de restpunten van C3, C4, C5 en
  D1.
- **Ronde 3 (op `f55a4a68`).** **C3, C4, C5 en D1: VERIFIED FIXED**, maar met
  zeven overlevende mutanten. Die worden sinds `dd8a3a49` gevangen.
  **C6: FIXED_MET_KANTTEKENING.** De blokkerende fout uit ronde 2 was dicht,
  maar de reparatie opende **een nieuwe weg naar twee leiders**: een
  `kiesActieve` tijdens de failback-wissel. Daarnaast bleek een bestaande fout:
  een actieve die als stand-by herstartte, werd zonder promote teruggenomen.
  Beide gerepareerd in `4c68adee`.
- **Ronde 4 (op `93dabce2`, C6): de kern is VERIFIED FIXED.** Nergens nog twee
  leiders of twee schrijvers:
  - de reproducties van ronde 3 zakken op de oude code en slagen op de nieuwe;
  - echte processen, achttien keer gestopt met SIGKILL: altijd hooguit één
    leider, en na 30 s schreef de actieve elke keer;
  - 140 fuzzrondes zonder fout, terwijl de fuzzer op de oude code wel uitsloeg.

  Drie restpunten, alle drie dicht in `b6c423e2` en met een mutant
  nagetrokken, maar niet meer onafhankelijk herkeurd:
  - geen toets ving het weghalen van `!switching` (nu toets 13);
  - tussen gezondheidscontrole en herpromotie kon een herstarte stand-by 95-803
    ms verkeer krijgen (nu weigert `wachtOpActieve` dat, toets 14);
  - geen toets legde vast dat `/api/health` `leider` meldt (nu de
    contracttoets).

### Nieuwe bevindingen uit de herkeuringen (OPEN)

Deze punten kwamen tijdens de herkeuringen boven. Ze vallen buiten de opdracht
van ronde 2 of vragen een besluit, en zijn in deze ronde niet gerepareerd. Ze
staan hier zodat ze niet verdwijnen.

| ID | Sev | Status | Waar | Probleem | Bewijs | Voorstel |
|---|---|---|---|---|---|---|
| **N1** | **P1** | FIXED_MET_KANTTEKENING (ronde 3; doel open door N3). Doel bereikt in ronde 4, nu N3 VERIFIED FIXED is | `server/routes/techniek/inlog.js:56` | `/api/techniek/inloggen` geeft na wachtwoord en toegangslijst `accounts.issueToken(user.id, 1)` zonder `tweefactor`-poort. Voor de eigenaar en elk account op de techniektoegangslijst is de tweede factor daar geen drempel. | Code gelezen door twee herkeurders en de implementer. Niet uitgevoerd. | Dezelfde tweede stap als `/api/auth/login` (bewijs, daarna `/api/auth/tweede`), of een `code` in hetzelfde verzoek. Vraagt een kleine aanpassing in de techniekpagina. |
| **N2** | P2 | VERIFIED FIXED (ronde 3) | `server/routes/member/tweefactor.js` `/codes` | Nieuwe herstelcodes vragen alleen sessie + wachtwoord. Met zo'n code zet `/uit` de tweede factor uit, dus de rem op `/uit` houdt wie sessie én wachtwoord heeft niet tegen. `test/mijnrtg-routes.test.js` 9 legt "vraagt het wachtwoord" vast als contract. | Uitgevoerd door de herkeuring van ronde 3: 10 nieuwe codes, daarna `/uit` 200. | Een geldige code (TOTP of herstelcode) eisen voor `/codes`, zoals `/uit`. Geen scherm gebruikt de route, dus het raakt alleen het API-contract. |
| **N3** | P2 → **P1** (ronde 3) | OPEN | `server/routes/aanmeldgesprek.js:73-77` | Het aanmeldgesprek met sleutelwoorden geeft een sessietoken zonder `inlogPoort` en zonder tweede factor, ook als de tweede stap op slot zit. | Uitgevoerd door de herkeuring van ronde 3: token terwijl `/api/auth/tweede` 429 gaf. | Langs dezelfde inlogpoort laten lopen. |
| **N4** | P2 | VERIFIED FIXED (ronde 3) | `server/server.js` `noteFailedTry` | Tien foute codes melden brute force, en dat zet het adres van de laatste poging een uur in quarantaine. Wie het wachtwoord kent, kan negen gokken vooraf laden; de eerste typefout van het lid zet dan zijn eigen adres in quarantaine. De emmer wordt bij succes niet geleegd. | Quarantaine uitgevoerd door de herkeuring van ronde 3. | Zie besluitpunt 2. |
| **N5** | P3 | OPEN | `server/server.js:584` | De pogingenemmers zijn een `Map` per proces. Met meerdere processen krijgt elk proces opnieuw tien gokken. | Code gelezen. | Emmers via Redis delen als `REDIS_URL` gezet is. |
| **N6** | P1 (alleen met het trio) | FIXED_MET_KANTTEKENING (ronde 3; restvenster N11, P2). N11 is VERIFIED FIXED in ronde 4 | `server/db/index.js:61` `bewaar`, `server/trio-schaduw.js` | Een stand-by antwoordt 200 op een schrijfverzoek en bewaart niets. Sinds `d8d6154c`, `4c68adee` en `b6c423e2` krijgt een stand-by tijdens de failback geen verkeer, en een actieve die geen leider is, wordt opnieuw gepromoveerd en krijgt tot dan niets. Het venster blijft bestaan voor: een verzoek dat al onderweg was, en de werkers van `RTG_POORTWACHTERS` (die sturen bij actief -1 naar de eerste gezonde server). | Herkeuring ronde 2 en 3, deels met echte processen. | Op de server zelf: een muterend verzoek krijgt 503 als `!db.writable`, in plaats van 200 zonder bewaren. Raakt elke route, dus een eigen ronde. |
| **N7** | P3 | OPEN | `server/kern/ssrf.js:72-87` | De gedeelde SSRF-poort: `startsWith('fc'/'fd')` weigert ook domeinnamen (`fd.nl`, `fcbarcelona.com`), en enkele IPv6-vormen (`::7f00:1`, NAT64 `64:ff9b::/96`) komen erdoor. De school-webhooks laten `redis`, `localhost.` en `metadata.google.internal.` nog door; de reparatie van C5 zit alleen in de payrollmodule. | Herkeuring ronde 2 en 3. IPv6 niet te meten in de sandbox. | De regels van `bronophalen.js` naar `ssrf.js` tillen, met een IP-literal-tak die alleen op IP's kijkt. |
| **N8** | P3 | OPEN | `server/config/openbaar.js:66-87`, diverse `RTG_*` | Een publiek IPv6-literal en `RTG_ACME`/`RTG_TLS_DOMAIN` worden niet als openbaar ingedeeld, dus `RTG_DEV_LINKS` krijgt daar alleen een waarschuwing. Ongekeurd zijn ook `RTG_GRENS_MELD`, `RTG_SCHOOL_WEBHOOK_INTERN`, `RTG_SCRYPT_*`, `RTG_ANKERPOST_ONVEILIG`, `RTG_DOOS_SLEUTEL`, `RTG_CSP_NONCE=0`, `RTG_BEZITSBEWIJS=uit`, `RTG_DOELBINDING=uit` en `RTG_SCHORSPOORT_UIT`. Daarnaast verraadt `/api/auth/forgot` via `tweestaps` of een account bestaat. | Herkeuring ronde 2 en 3. | De keuring per vlag afleiden uit de `lees()` van de module zelf, in plaats van kopieën. |
| **N9** | P3 | OPEN | `server/opzet/stopspoeling.js`, `server/db/bijeen.js` | Een crash uit een andere context terwijl een bundel half staat (op een niet-geldcollectie boven 512 KB, of na een `save()` van een ander verzoek binnen de genadetermijn) kan de halve stand alsnog wegschrijven. SIGTERM met een open achtergrondbundel eindigt met 0 op een halve stand. De PostgreSQL-modus is niet live beproefd. | Herkeuring ronde 2, deels zelf gemeten. | Een procesbrede teller van open bundels, of de schrijfpoort bevriezen bij een crash. |
| **N10** | P3 | OPEN | `server/db/pg/*.js` | De merges op Postgres (`pg/inlezen.js`, `pg/schrijflanen.js`, `pg/collectietransactie.js`) geven geen melder mee. | Herkeuring ronde 2 en 3. | Dezelfde melder als op SQLite. |

### Besluitpunten voor de eigenaar

1. **N1 (techniek-inlog zonder tweede factor).**
   - **(a) Aanbevolen:** dezelfde tweede stap als de gewone inlog; de
     techniekpagina vraagt dan de code.
   - (b) Een `code` in hetzelfde verzoek.
   - (c) Bewust laten zoals het is, met de reden in het document.
2. **Quarantaine bij tien foute codes (N4).**
   - **(a) Aanbevolen:** de emmer bij succes legen, en de tweede stap NIET aan de
     noodrem koppelen. Het slot van vijf minuten blijft, maar een gok van een
     ander kan het adres van het lid niet meer in quarantaine zetten.
   - (b) Zo laten: huisbeleid, gelijk aan het wachtwoord.
3. **`/codes` zonder code (N2).**
   - **(a) Aanbevolen:** een geldige code eisen. Dat verandert het contract in
     toets 9 van `test/mijnrtg-routes.test.js`.
   - (b) Zo laten, en de rem op `/uit` daarmee als symbolisch erkennen.
4. **N6 (stand-by antwoordt 200).** Alleen nodig als het trio in productie
   draait: een eigen ronde voor een 503 op muterende verzoeken bij
   `!db.writable`.

### Testbewijs (PASS / FAIL / INFRA / NIET GEVERIFIEERD)

- **PASS: de regressiesuites op de huidige head.**

  | Suite | Uitslag |
  |---|---|
  | `tweede-rem` | 4/4 |
  | `productie-failclosed` | 21/21 |
  | `payroll-ssrf` + `office-payroll-dekking` | 21/21 |
  | `stopspoeling` | 11/11 |
  | `trio-afzetten` | 14/14 |
  | `sqlite-botsing` | 9/9 |

- **PASS: de suites eromheen.**

  | Suites | Uitslag |
  |---|---|
  | trio en contract (`trio-kleef`, `trio-wees`, `trio-werkers`, `spreidingsoordeel`, `wacht`, `wachter`, `api-contract`) | 64/64 |
  | merge en opslag, inclusief de eigenschapstoets van `merge3` | 100/100 |
  | `mijnrtg-routes`, `tweefactor`, `config`, `openbare-bouwstand` | 63/63 |
  | registertoetsen | 132/132 |

- **PASS: de statische poorten.** `npm run check` (Alles in orde), `npm run
  norm` (gehaald) en de deltapoort tegen main (gehaald).
- **PASS: CI.** Op `7212a375` en `f55a4a68` was de volledige matrix groen,
  behalve `github-advanced-security`. Die stopt op het Copilot-maandquotum
  (402) voordat hij één bestand bekijkt.
- **INFRA:**
  - `bewijskosten` toets 9. De ondiepe kloon mist historische commits; in CI
    slaagt hij.
  - `*.pg`-toetsen buiten `scripts/pgtoetsen.js` (die vragen `DATABASE_URL`).
- **FLAKY, niet van deze tak:** de WebKit-toets *Pass inhoud, tabblad en
  hervatten* in `test/mobile-content.e2e.js`.
  - Rood op main `2cb57c61` en op `209f0298`/`dd8a3a49` van deze tak.
  - Groen op `f55a4a68`.
  - Deze tak raakt geen schermcode. Gemeld op PR #487.
- **NIET GEVERIFIEERD:**
  - `ci:lokaal` als geheel op de laatste head. Op `2b7c4e41` stond elke poort
    vóór e2e op *staat*; de e2e-stap is na twee uur afgebroken, en in CI is e2e
    op `7212a375` en `f55a4a68` groen.
  - De crashspoeling en de merges in PostgreSQL-modus, live.
  - De IPv6-bereikbaarheid van N7.

### Wat deze ronde NIET heeft gedaan (bewust)

Geen nieuwe functies en geen herontwerp. De nieuwe bevindingen N1–N10 zijn
vastgelegd en niet gerepareerd, ook waar de reparatie klein lijkt. Ze raken
een contract (N2), een inlogweg buiten C3 (N1, N3), huisbeleid (N4) of elke
route (N6), en horen eerst een besluit te krijgen.

---

## REMEDIATIESTATUS — ronde 3: de besluitpunten N1, N2, N4 en N6 (5 oktober 2026)

Branch: `codex/rtg-v1-release-blockers` (PR #487). De eigenaar besliste over de
vier besluitpunten van ronde 2:

- **N1:** (a), dezelfde tweede stap als de gewone inlog;
- **N4:** (a), het slot houden, maar zonder quarantaine;
- **N2:** (a), een geldige code eisen;
- **N6:** in deze ronde meenemen.

De werkwijze is die van ronde 2: reproduceren, de oorzaak vinden, repareren, een
regressietoets die vóór de reparatie zakt en erna slaagt, en een onafhankelijke
adversariële herkeuring door een andere agent dan de implementer.

### Nieuw verdict (code): 🟡 CONDITIONAL GO — Release readiness: 81/100

**Waarom 81 en niet hoger.** N1 is aan de deur van de techniekpagina dicht, en
de herkeuring zag die deur dicht. Maar de herkeuring liet ook een tweede weg naar
dezelfde sessie zien. Het aanmeldgesprek met sleutelwoorden (N3) geeft ook het
eigenaarsaccount met tweede factor een token van 30 dagen, en met dat token geeft
`GET /api/techniek/tenant` 200. Het DOEL van N1 is daarmee niet bereikt: geen
eigenaarssessie op de techniekpagina zonder tweede factor. N3 gaat daarom van P2
naar **P1**, en er blijft één open P1.

**Wat het nieuwe bewijs wel oplevert:**

- **N2 en N4 zijn VERIFIED FIXED.** De herkeuring draaide de exploit op de oude
  code (open) en op de nieuwe (dicht).
- **N6 staat.** De herkeuring stuurde muterende verzoeken naar een afgezette
  server: logins, registraties, betaal-, munt- en storingenwebhooks, PUT, PATCH,
  DELETE, padtrucs en hoofdletters. Alles kreeg 503 met `Retry-After`, en lezen
  en de clusterroute bleven open. De P1 in het trio is teruggebracht tot een P2:
  een verzoek dat al voorbij de poort was op het moment van de afzetting (N11).
- **De vijf mutanten die de herkeuring zag overleven, worden nu gevangen**
  (sinds `d6f51cc4`): M1, M4, M5, M9 en de volgorde van de poort (M12). De
  andere vijf (M6, M7, M8, M10, M11) ving een toets al.

Twee P2's dicht en een P1 verkleind tot een P2 levert één punt op. Een nieuwe P1
die het doel van N1 openhoudt, houdt de rest tegen.

**De code-voorwaarden voor GO**, bovenop de externe poorten van ronde 1 (sectie
F, F3–F6):

- **N3 dicht** (het aanmeldgesprek zonder tweede factor);
- **voor een uitrol met het failover-trio: een besluit over N11** (het
  restvenster van N6).

### Per bevinding — BEFORE / FIX / AFTER / REGRESSIE

| # | Sev | Status | Commits | BEFORE → AFTER | Regressie (zakt vóór, slaagt na) |
|---|---|---|---|---|---|
| N1 | P1 | **FIXED_MET_KANTTEKENING.** De deur is dicht en herkeurd. Het doel is niet bereikt zolang N3 open staat | `e8374b84`, `4c70964c`, `d6f51cc4` | **Vóór:** `/api/techniek/inloggen` gaf na wachtwoord en toegangslijst meteen een accounttoken, ook voor de eigenaar met tweede factor. **Na:** met de tweede factor aan komt er een bewijs van vijf minuten met een eigen doel (`tech2`). Dezelfde route ruilt het met een code om voor een techniektoken van een dag. Een gewoon inlogbewijs werkt hier niet, en dit bewijs werkt niet bij `/api/auth/tweede`. In de tweede stap wordt het recht opnieuw gelezen. De techniekpagina vraagt de code. | `test/techniek-tweede.test.js` 1-6. Toets 6 trekt het recht in tussen stap een en twee. |
| N2 | P2 | **VERIFIED FIXED** | `e8374b84`, `d6f51cc4` | **Vóór:** `/api/mijn/tweefactor/codes` gaf op sessie plus wachtwoord tien nieuwe herstelcodes. Met zo'n code zette `/uit` de tweede factor uit. **Na:** de route eist ook een geldige code (TOTP of herstelcode) en deelt de rem van de tweede stap. | `test/mijnrtg-routes.test.js` 9 (contract gewijzigd: een code is verplicht) en `test/tweede-rem.test.js` 8 (tien foute codes sluiten ook de juiste). |
| N4 | P2 | **VERIFIED FIXED**, ook het restpunt (de bronemmer, `d6f51cc4`, apart herkeurd) | `e8374b84`, `d6f51cc4` | **Vóór:** tien foute codes meldden brute force, en dat zette het adres van de laatste poging een uur in quarantaine. **Na:** het slot van vijf minuten blijft, ook voor de juiste code. Het slot meldt zich als `tweede-stap-slot`: een waarschuwing op het veiligheidsbord, en de noodrem reageert er niet op. Een geslaagde code leegt alleen de emmer van het ACCOUNT. Leegde hij ook die van het adres, dan zette een aanvaller met een eigen account de limiet van 50 per adres terug (herkeuring: 6 slachtoffers × 9 gokken vanaf een adres, 0 keer 429). | `test/tweede-rem.test.js` 5-7 en `test/noodrem-bron.test.js` 3 (het wachtwoordslot blijft wel quarantaine geven). |
| N6 | P1 (trio) → P2 | **FIXED_MET_KANTTEKENING.** De ingang is dicht en herkeurd. Het restvenster is N11 | `e8374b84`, `d6f51cc4` | **Vóór:** een server die niet schrijft (`RTG_ROL=standby`, of afgezet door de poortwachter) antwoordde 200 op een schrijfverzoek en bewaarde niets. **Na:** `server/opzet/standbypoort.js` staat vóór de betaalwebhooks en de body-lezer. Zolang `db.writable` false is, krijgt elk verzoek dat iets kan veranderen een 503 met `Retry-After: 2`. Lezen en `/api/cluster/*` blijven open. | `test/standbypoort.test.js`. Op de stand na een afzetting leest hij de tekst van de weigering, en hij stuurt een betaalwebhook (met de poort na de lijfpoort gaf die 200). |

### Herkeuring (op `3d817478`, onafhankelijk)

- **N1: FIXED_MET_KANTTEKENING.**
  - Zelf gezien: zonder tweede factor verandert er niets. Met de tweede factor
    geeft het wachtwoord alleen een bewijs, en de bewijzen zijn niet
    uitwisselbaar tussen de twee deuren.
  - Zelf gezien: een recht dat tussen stap een en twee is ingetrokken, geeft 401.
    De mutant zonder die hercontrole (M1) overleefde nog; sinds `d6f51cc4` vangt
    toets 6 hem.
  - Kanttekening: N3 (hieronder, nu P1) en N12.
- **N2: VERIFIED FIXED.** Oud: tien codes, daarna zette `/uit` de factor uit.
  Nieuw: 403. Met wachtwoord plus herstelcode komen er nieuwe codes, en de oude
  code werkt daarna niet meer. De rem op `/codes` werkte wel, maar geen toets
  legde hem vast (M4, M5); sinds `d6f51cc4` doet toets 8 dat.
- **N4: VERIFIED FIXED.**
  - Oud: tien keer 403, daarna quarantaine, ook voor een juiste inlog vanaf dat
    adres. Nieuw: tien keer 403, daarna 429, en een inlog vanaf hetzelfde adres
    geeft 200.
  - Een brute force op het WACHTWOORD zet het adres nog steeds in quarantaine.
  - Restpunt (P3): een geslaagde code leegde ook de bronemmer. FIXED in
    `d6f51cc4`, en toets 7 vangt de mutant (M9).
- **Herkeuring van `d6f51cc4` (onafhankelijk): het N4-restpunt is VERIFIED
  FIXED.**
  - Zelf gezien, met een aanvaller en zes slachtoffers, 54 foute gokken vanaf
    een adres en drie eigen geslaagde codes ertussen. Op de oude code kwam er
    geen enkele 429. Op de nieuwe kwam de eerste 429 bij gok 51. Op de oude code
    zonder die eigen codes kwam de 429 ook bij gok 51: het gat zat dus precies
    in `gelukt()`.
  - M1, M4, M5, M9 en M12 zakken elk op de bewering die de toets noemt.
  - Geen omzeiling gevonden. Geen andere deur raakt `tweede:bron:`, en een
    geslaagde wachtwoordinlog leegt alleen de emmers van de wachtwoordinlog.
- **N6: FIXED_MET_KANTTEKENING.**
  - Zelf gezien, op de stand na promote en demote: oud gaf 200 en verloor de
    schrijfactie stil. Nieuw: 503 op alle muterende verzoeken; GET, HEAD en de
    clusterroute met sleutel blijven werken.
  - De eerste bewering van de toets slaagde ook op de oude code. Dat kwam door de
    opslagpoort, die een verse stand-by al 503 gaf. Ook de volgorde vóór de
    webhooks lag niet vast (M12). Beide gerepareerd in `d6f51cc4`.
  - Restvenster: N11.

### Bewust zo

**Op een stand-by krijgen ook de techniek-inlog en `/api/logout` een 503.**
De herkeuring meldde dat als nadeel (P3), en het blijft zo. Op beide wegen
gebeurt iets wat een stand-by niet kan bevestigen:

- een gebruikte herstelcode afschrijven;
- een melding op het veiligheidsbord zetten;
- een bewijs of sessie intrekken.

Een uitlog die alleen op de stand-by zou zijn vastgelegd, laat het token op de
leider doorwerken. Dat is de stille 200 die N6 juist weghaalt. Een GET met een
bestaand token blijft werken, dus de eigenaar kan de stand-by wel bekijken.

### Nieuwe en bijgestelde bevindingen (OPEN)

| ID | Sev | Status | Waar | Probleem | Bewijs | Voorstel |
|---|---|---|---|---|---|---|
| **N3** | **P1** (was P2) | VERIFIED FIXED (ronde 4) | `server/routes/aanmeldgesprek.js:77` | Het aanmeldgesprek met sleutelwoorden geeft `issueToken` (30 dagen) zonder `inlogPoort` en zonder tweede factor. Dat geldt ook voor de eigenaar met tweede factor, en het token opent de techniekpagina. Daarmee staat het doel van N1 open. | Zelf gezien door de herkeuring: `/api/aanmeld/start` en `/zeg` gaven een token, en `GET /api/techniek/tenant` gaf daarmee 200. | Zie besluitpunt 1. |
| **N11** | P2 (alleen met het trio) | VERIFIED FIXED (ronde 4) | `server/opzet/standbypoort.js:39`, `server/db/index.js:61` | Een verzoek dat al voorbij de poort is op het moment van de afzetting, krijgt nog 200 en wordt niet bewaard. De poort kijkt alleen bij de ingang, en `bewaar()` keert stil terug. | Zelf gezien door de herkeuring: `zet` verstuurd, 5 of 30 ms later de demote. `zet` antwoordde ±160 ms na de demote met 200, en na een nieuwe promotie stond er niets. | Zie besluitpunt 2. |
| **N12** | P3 | VERIFIED FIXED (ronde 4) | `server/accounts/actietokens.js:31-48` | Een `tech2`- of inlogbewijs van vóór een wachtwoordwijziging werkt na die wijziging nog (vijf minuten). `verifyActionToken` kijkt niet naar `sessies_vanaf`. Voor het inlogbewijs was dat al zo vóór deze tak. | Zelf gezien door de herkeuring: de oude sessie gaf 401, het oude bewijs plus een herstelcode gaf 200 en een werkend token. | Actietokens laten vervallen bij `sessies_vanaf`, zoals sessietokens. Raakt elk doel, dus ook herstellinks. |
| **N13** | P3 | OPEN | `server/routes/member/tweefactor.js` `/codes`, `/uit` | Een fout wachtwoord op `/codes` en `/uit` vult geen emmer. Met een gestolen sessie is het wachtwoord daar onbeperkt te raden. Al zo vóór deze tak. | Zelf gezien door de herkeuring: 30 foute wachtwoorden, 30 keer 403, geen 429. | De wachtwoordemmer van de inlog ook hier laten vullen. |
| **N14** | P3 | OPEN | `server/trio-proxy.js` | De proxy geeft een 503 van een stand-by gewoon door aan de client. Opnieuw proberen gebeurt alleen bij een netwerkfout. | Alleen code gelezen, niet live. | Een 503 met `Retry-After` van een stand-by bij de volgende server proberen, als het lijf nog in handen is. |
| **N15** | Info | OPEN | o.a. `/api/doos/update` | Een paar GET-routes schrijven. Op een stand-by gaan die schrijfacties stil verloren, want de poort laat GET door. | Herkeuring, code gelezen. | Die routes POST maken. |
| **N17** | Info | Bewust zo | `server/kern/identiteit/tweedestap-rem.js`, `server/opzet/onderhoud.js` | De bronemmer loopt alleen nog af via de onderhoudsveger (15 minuten stilte). Een gedeeld adres (NAT, kantoor) dat binnen die tijd 50 mislukte codes over meerdere leden haalt, zit vijf minuten op slot, en een geslaagde code heft dat niet op. | Herkeuring van `d6f51cc4`, code gelezen. | Geen actie: dat is de prijs van N4, en limiet 50 met een slot van vijf minuten houdt hem klein. |
| **N16** | Info | OPEN | `server/kern/identiteit/tweedestap-rem.js` | Het slot is nu een waarschuwing. Er gaat dus geen bericht meer naar de eigenaar, en ook niet naar het lid, terwijl een vol slot betekent dat iemand zijn wachtwoord kent. | Herkeuring, code gelezen. | Het lid een bericht sturen bij een vol slot, zonder quarantaine. |

### Besluitpunten voor de eigenaar

1. **N3 (P1): het aanmeldgesprek met sleutelwoorden.**
   - **(a) Aanbevolen:** dezelfde tweede stap als de gewone inlog. Met de tweede
     factor aan geeft het gesprek een bewijs en vraagt het de code.
   - (b) De sleutelwoordeninlog uitzetten voor accounts met tweede factor.
   - (c) Bewust laten zoals het is, met de reden in het document.
2. **N11 (P2, alleen met het trio): een verzoek dat onderweg was.**
   - **(a) Aanbevolen:** bij het antwoord opnieuw kijken. Is de server tijdens
     het verzoek afgezet, dan 503 in plaats van 200. Een te strenge weigering
     kost een herhaling, een stille 200 kost een schrijfactie.
   - (b) `bewaar()` laten falen als het proces niet schrijft. Dat is
     grondiger, maar raakt elke aanroeper.
   - (c) Zo laten: de poortwachter stuurt een stand-by geen verkeer, en het
     venster is kort.
3. **N12 (P3): een bewijs na een wachtwoordwijziging.**
   - **(a) Aanbevolen:** actietokens laten vervallen bij `sessies_vanaf`.
   - (b) Alleen de twee inlogbewijzen.

### Testbewijs (PASS / FAIL / INFRA / NIET GEVERIFIEERD)

- **PASS: de regressiesuites op `8d24f606`.**

  | Suite | Uitslag |
  |---|---|
  | `tweede-rem` | 8/8 |
  | `techniek-tweede` | 6/6 |
  | `standbypoort` | 1/1 |

- **PASS: de suites eromheen.** `noodrem-bron`, `mijnrtg-routes`, `techniek`,
  `tweefactor`, `beveiliging`, `isolatie-techniek`, `api-contract` en
  `trio-afzetten`: 88/88.
- **PASS: de onafhankelijke herkeuring van `d6f51cc4`.** `tweede-rem` 8/8,
  `techniek-tweede` 6/6, `standbypoort` 1/1, `mijnrtg-routes` 12/12,
  `noodrem-bron` 3/3 en `tweefactor` 18/18. De aanval op de bronemmer is live
  nagespeeld op de oude en de nieuwe code.
- **PASS: mutaties, zelf gedraaid op `d6f51cc4`.** M9, M1, M4, M5 en M12 zakken
  elk in hun toets. Zonder de standbypoort zakt de toets ook. M12 zakt op de
  webhookbewering: de webhook gaf dan 200 op een stand-by.
- **PASS: de statische poorten.** `npm run norm` en de deltapoort tegen main
  zijn gehaald. `npm run check` meldde alleen dat BEWIJS.md achterliep; dat is
  daarna herijkt in `8d24f606`.
- **INFRA:** zoals in ronde 2 (`bewijskosten` toets 9, de `*.pg`-toetsen).
- **NIET GEVERIFIEERD:**
  - de volledige CI-matrix op de laatste head;
  - N14 live.

### Wat deze ronde NIET heeft gedaan (bewust)

- N3, N11 en N12 zijn vastgelegd en niet gerepareerd. N3 is een inlogweg
  buiten de vier besluiten. N11 raakt het antwoord van elke route, en N12 elk
  soort actietoken. Ze horen eerst een besluit te krijgen.
- N13 tot en met N16 zijn kleiner of bestonden al vóór deze tak.

---

## REMEDIATIESTATUS — ronde 4: N3, N11 en N12 (6 oktober 2026)

Branch: `codex/rtg-v1-release-blockers` (PR #487). De eigenaar besliste over de
drie besluitpunten van ronde 3, telkens met de aanbevolen keuze:

- **N3:** (a), dezelfde tweede stap als de gewone inlog;
- **N11:** (a), bij het antwoord opnieuw kijken;
- **N12:** (a), elk actietoken vervalt bij de sessiegrens.

Alle drie gingen in deze PR. De werkwijze is die van de vorige rondes, nu als
workflow met een eigen branch per bevinding:

1. een implementer bouwt de reparatie, met een regressietoets die op de basis
   (`c881636c`) zakt;
2. een andere agent herkeurt adversarieel;
3. bevindingen binnen het besluit worden hersteld en opnieuw gekeurd (hooguit
   twee rondes).

Daarna is alles samengevoegd en deden **drie nieuwe keurders samen een
eindkeuring**, elk vanuit een eigen hoek: de restpunten van N11, het samenspel
van N3 en N12, en een brede regressie met de poorten. Een volledigheidscriticus
las hun rapporten na.

### Nieuw verdict (code): 🟡 CONDITIONAL GO — Release readiness: 84/100

**Waarom hoger dan 81.**

- **De laatste open P1 in de code (N3) is dicht, en dat is bewezen.** De
  herkeuring en de eindkeuring speelden live na dat de eigenaar met tweede
  factor via het aanmeldgesprek alleen een bewijs krijgt, en dat de
  techniekpagina daarmee 401 geeft. Zonder dat bewijs geen sessie.
- **N11** (P2 in het trio) en **N12** (P3) zijn dicht en herkeurd.
- Er staat geen P0 of P1 meer open in de code.

**Waarom niet hoger.**

- De eindkeuring vond **twee P2's die er al vóór deze branch waren**:
  - N18: een pad met een slash erachter komt langs de inlogpauze;
  - N19: `/api/supplier/mijn/login` geeft een werksessie op alleen het
    wachtwoord, ook als de tweede factor aan staat.
- Die twee horen een besluit te krijgen. Het zijn twee nieuwe deuren naast de
  deuren die N1 en N3 dichtdeden.
- De externe poorten van ronde 1 (sectie F, F3–F6) staan nog open, en de
  PostgreSQL-stand van N11 en N12 is niet live beproefd.

**Voorwaarden voor GO:**

- de externe poorten F3–F6;
- **aanbevolen vóór GO: een besluit over N19 en N18** (zie de besluitpunten).

### Per bevinding — BEFORE / FIX / AFTER / REGRESSIE

| # | Sev | Status | Commits | BEFORE → AFTER | Regressie (zakt vóór, slaagt na) |
|---|---|---|---|---|---|
| N3 | P1 | **VERIFIED FIXED** | `b1a9a7a4`, `71ff5d0c`, `43c42fc8` | **Vóór:** `/api/aanmeld/zeg` gaf na de sleutelwoorden een sessie van 30 dagen, zonder tweede factor en zonder de poorten van `/api/auth/login`. **Na:** met de tweede factor aan komt alleen het antwoord van `tweefactor.inlogPoort` terug: een bewijs `inlog2` en een eigen zin ("Je sleutelwoorden kloppen"). `/api/auth/tweede` ruilt dat om met de gedeelde rem. Een account met actief 0 krijgt 403 met de tekst van de gewone inlog, ook als de tweede factor aan staat. `/api/aanmeld/zeg` staat in `INLOG_PADEN`. Zonder `tweefactor.inlogPoort` start de route niet, en `GRENZEN.json` laat het domein `tweefactor` lezen. Er is **geen client** van het gesprek (gegrept); het antwoord heeft dezelfde vorm als dat van `/api/auth/login`. | `test/aanmeldgesprek-tweede.test.js` 1-8. Op de basis zakten er 6 van de 7 (toets 1 bewaakt het ongewijzigde pad). Zes mutanten van de implementer en M8 van de herkeuring worden gevangen. |
| N11 | P2 (trio) | **VERIFIED FIXED** | `e63e33dd`, `7762f1cd`, `43c42fc8`, `4a7327ec`, `fb7bcf56` | **Vóór:** een server die tijdens een verzoek werd afgezet, antwoordde 200 terwijl `bewaar()` stil niets bewaarde. **Na:** `server/opzet/standbypoort-antwoord.js` vervangt bij het antwoord een SUCCES door 503, met `Retry-After: 2`, `Cache-Control: no-store` en de tekst dat het niet vaststaat. Dat gebeurt als het proces bij de ingang schreef en bij het antwoord niet meer. Een stroom die al begonnen is, blijft ongemoeid. `server/lib/eindstatus.js` laat idem-poort, dubbeltik en `middleware/idempotentie` pas onthouden als vaststaat welke status vertrok. Zonder dat kreeg de herhaling waar de 503 om vraagt een bewaarde 200 over iets dat niet stond. | `test/standbypoort-antwoord.test.js` (25) en `test/standbypoort-race.test.js` (3). Op de basis braken alle vijf de racepogingen de invariant. In de eindkeuring werden 30 mutanten op `eindstatus.js` gedraaid: 23 gedood, 5 gelijkwaardig, en M18/M19 sinds `fb7bcf56` ook gedood. |
| N12 | P3 | **VERIFIED FIXED** | `a9333c1a`, `313f60ca`, `43c42fc8` | **Vóór:** `verifyActionToken` keek niet naar `sessies_vanaf`. Een bewijs van vóór een wachtwoordwijziging gaf erna met een code een werkende sessie. **Na:** een actietoken draagt zijn uitgiftemoment als vijfde deel, en `server/accounts/sessiegrens.js` is de ENE vergelijking voor sessie- en actietokens. Een token in de oude vorm (zonder uitgiftemoment): dicht voor `inlog2`, `tech2` en `sso-overdracht`; als moment 0 voor `verify-email` en `mailwissel`. | `test/actietoken-sessiegrens.test.js` (22) en het e2e-scenario uit de herkeuring. Elk van de vijf doelen vervalt bij elk van de drie grenszetters. |

### Herkeuringsverloop

- **N3.** Herkeuring 1: VERIFIED FIXED, met drie P3's binnen het besluit:
  - een toetsgat (M8);
  - het commentaar "de ene inlogdeur" klopte niet;
  - na sleutelwoorden plus code heet de inlog in het spoor
    `wachtwoord+totp`.

  Hersteld in `71ff5d0c`. Dat laatste label is een kanttekening die toets 8
  vastlegt; er is met opzet geen nieuw veld bijgekomen. Herkeuring 2: VERIFIED
  FIXED, met de slash als bevinding buiten het besluit (N18).
- **N11.** Herkeuring 1: FIXED_MET_KANTTEKENING. Drie punten:
  - de idempotentielagen onthielden een 200 vóór de haak er een 503 van maakte;
  - een vervangen `sendFile` hield zijn bestand open;
  - op koppen ontbraken toetsen.

  Hersteld in `7762f1cd`. Herkeuring 2: VERIFIED FIXED, maar die herstelronde
  gaf zelf een regressie: met een `Idempotency-Key` per verzoek een
  `MaxListenersExceededWarning`. Daarnaast een toetsgat (E08). Beide hersteld in
  `43c42fc8`.
- **N12.** Herkeuring 1: VERIFIED FIXED, met een te ruim commentaar (hersteld in
  `313f60ca`). Herkeuring 2: VERIFIED FIXED; alleen informatieve punten.
- **Eindkeuring op `43c42fc8`** (drie keurders en een criticus):
  - **samenspel: GROEN.** Live nagespeeld: het bewijs uit het gesprek vervalt
    na een wachtwoordwijziging en na een herstel via e-mail. Een juiste code
    zonder een van beide geeft een sessie. 60 auth-toetsbestanden: 449 van 450
    geslaagd, 1 overgeslagen (PostgreSQL).
  - **N11-restpunten: GROEN_MET_KANTTEKENING.** Er kwam geen waarschuwing meer
    op een lidroute. M18/M19 overleefden: een onbegrensde grens zou een echt lek
    verbergen. Hersteld in `fb7bcf56`.
  - **regressie: ROOD**, op drie punten die door deze branch kwamen:
    1. toets 3 van `standbypoort-race` zakt onder `RTG_ROUTELOG`. De
       auditmeting van de testrun hangt dan een eigen luisteraar op; ook op de
       basis gaf dat al een waarschuwing. Hersteld in `4a7327ec`;
    2. de klokwacht-ratel steeg van 32 naar 39. De nieuwe toetsen wachten nu op
       een toestand; hersteld in `fb7bcf56`;
    3. `SEMANTIEK.json` en `CAPABILITEIT.json` liepen achter; herijkt.

    De drie andere rode bestanden (sentinel, magnaat-capabilities, bewijskosten)
    zijn ook rood op de basis. Ze komen door de omgeving: geen Rust-motor en een
    ondiepe kloon.
  - **CI op `fc8e7c1c`** zakte in scherf 3 op dezelfde toets 3. Daarmee is
    ontdekt dat de CI `RTG_ROUTELOG` zet.

  De herstelcommits na de eindkeuring (`4a7327ec`, `fb7bcf56`) zijn met
  mutaties nagetrokken, maar **niet meer onafhankelijk herkeurd**. De CI op
  `0b1d1ade` moet ze bevestigen.

### Bewust zo

- **N12, tokens in de oude vorm.** Een inlogbewijs van vóór de uitrol (`inlog2`,
  `tech2`, `sso-overdracht`) wordt geweigerd; dat kost hooguit een nieuwe inlog.
  Een mailboxlink (`verify-email`, `mailwissel`) telt als moment 0. Die valt
  alleen af als er ooit een grens is gezet, net als een sessietoken zonder
  uitgiftemoment.
  - Voor `mailwissel` wijkt dat af van de aanbeveling: die leeft een etmaal en
    geen minuten. De reden staat in de kop van `actietokens.js`.
  - **Rol niet gemengd uit.** Een oude knoop aanvaardt nieuwe tokens zonder naar
    de grens te kijken, en een nieuwe knoop weigert oude bewijzen.
- **N3 heeft alleen een serverkant.** Er is geen scherm voor het gesprek. Komt
  er een, dan hoort het `tweedeFactorNodig` af te handelen zoals het
  ledeninlogscherm al doet.

### Nieuwe bevindingen (OPEN)

| ID | Sev | Status | Waar | Probleem | Bewijs | Voorstel |
|---|---|---|---|---|---|---|
| **N18** | P2 | OPEN, al aanwezig | `server/middleware/remmen.js` `inlogpauzePoort` | De inlogpauze vergelijkt `req.path` letterlijk, maar de router laat een pad met een slash erachter bij dezelfde handler komen. Tijdens een gesprongen pauze gaf `/api/auth/login/` 200, en `/api/aanmeld/zeg/` een token. Dat geldt voor alle negen paden in `INLOG_PADEN`. | Zelf gezien door herkeuring 2 van N3, op de basis en op de fix. | Zie besluitpunt 2. |
| **N19** | P2 | OPEN, al aanwezig | `server/routes/supplier/pda/posities.js:106` (`POST /api/supplier/mijn/login`) | Een lid met de tweede factor aan krijgt op alleen e-mail en wachtwoord een werksessie die aan zijn account hangt, zonder `tweefactor.inlogPoort`. Het pad staat ook niet in `INLOG_PADEN`. | Zelf gezien in de eindkeuring: `/api/auth/login` gaf een bewijs, `/api/supplier/mijn/login` gaf een token, en `/api/supplier/state` gaf daarmee 200. Op de basis precies zo. | Zie besluitpunt 1. |
| **N20** | P3 | OPEN, al aanwezig | `server/accounts/actietokens.js` `verifyActionToken` | Een actietoken controleert `actief === 0` niet. Bij een uitgezet account geven alle vijf de doelen de gebruiker terug, terwijl een sessietoken daar null geeft. | Zelf gezien door de herkeuringen van N12. | Zie besluitpunt 3. |
| **N21** | P3 | OPEN, al aanwezig | `server/routes/member/sessies.js` (sluit-overige) | "Sluit alle andere sessies" trekt per sessie in en verzet `sessies_vanaf` niet. Een openstaande mailwissel of een inlogbewijs blijft dus geldig; voor het inlogbewijs blijft wel een code nodig. | Zelf gezien in de herkeuring van N12 en in de eindkeuring. | Zie besluitpunt 3. |
| **N22** | Info | OPEN, al aanwezig | kantoorroutes `/api/office/*` met `Idempotency-Key` | 12 'finish'-luisteraars bij een grens van 11: een `MaxListenersExceededWarning` per verzoek, ook in productie. Op de basis waren het 11 bij een grens van 10, dus de marge is gelijk gebleven. | Zelf gezien in de eindkeuring, op vier kantoorroutes. | Uitzoeken welke laag de negende luisteraar hangt; een `close`-luisteraar volstaat daar mogelijk. |
| **N23** | Info | OPEN, al aanwezig | `server/accounts/herstel.js` tegenover `tokens.js` en `actietokens.js` | De grens wordt gezet met `lib/klok` (te verzetten met `RTG_KLOK`), de uitgifte met `Date.now()`. Onder een verzette klok vallen tokens verkeerd. In productie weigert `RTG_KLOK`. | Zelf gezien in de eindkeuring. | Beide met dezelfde klok. |
| **N24** | P3 | OPEN, al aanwezig | `server/routes/aanmeldgesprek.js`, `server/kern/sleutelwoorden-uitdaging.js` | Het gesprek schrijft niets in het inlogspoor (`logInlog`), ook geen geweigerde poging. Daarnaast zegt het na de eerste twee woorden alleen "ik hoor je ... terug" als die twee goed waren. Wie gokt, weet dus vóór het derde woord of de eerste twee klopten. | Alleen in de code gelezen, door herkeuring 2 van N3. | Het spoor aansluiten. De echo pas na alle woorden geven. |
| **N25** | Info | OPEN | PostgreSQL-stand van N11 en N12 | Niet live beproefd met een echte `DATABASE_URL`: de 503 boven de PG-grens, de commit die dan niet komt, en het verse lezen van `sessies_vanaf`. Alleen met de nepmotor van de toetsen. | Volledigheidscriticus van de eindkeuring. | De `*.pg.test.js` en `standbypoort-antwoord` draaien met een database (in CI gebeurt dat voor de PG-toetsen). |

### Besluitpunten voor de eigenaar

1. **N19 (P2): `/api/supplier/mijn/login` zonder tweede factor.**
   - **(a) Aanbevolen:** dezelfde `inlogPoort` als `/api/auth/login`, met een
     eigen bewijsdoel dat alleen deze deur omruilt. Het pad komt daarnaast in
     `INLOG_PADEN`.
   - (b) De werkplek alleen openen vanuit een bestaande lidsessie.
   - (c) Zo laten, met de reden in het document.
2. **N18 (P2): een slash achter een pad omzeilt de inlogpauze.**
   - **(a) Aanbevolen:** in `inlogpauzePoort` het pad normaliseren (slashes aan
     het eind weghalen) voordat de lijst wordt geraadpleegd. Met een toets op een
     echte server.
   - (b) Zo laten.
3. **N20 en N21 (P3): de grens van actietokens.**
   - **(a) Aanbevolen:** `verifyActionToken` weigert een uitgezet account, net
     als een sessie. "Sluit alle andere sessies" blijft zoals het is, met de
     reden in het document: er blijft een code nodig, en de knop gaat over
     sessies.
   - (b) Allebei: ook "sluit alle andere sessies" zet de grens. Dat logt het lid
     op dit apparaat niet uit, maar maakt elke openstaande link ongeldig.
   - (c) Zo laten.

### Testbewijs (PASS / FAIL / INFRA / NIET GEVERIFIEERD)

- **PASS: de regressiesuites op `fb7bcf56`.**

  | Suite | Uitslag |
  |---|---|
  | `aanmeldgesprek-tweede` | 8/8 |
  | `actietoken-sessiegrens` | 22/22 |
  | `standbypoort-antwoord` | 25/25 |
  | `standbypoort-race` | 3/3, ook met `RTG_ROUTELOG` |
  | `klokwacht` | 6/6 (wachtschuld weer 32) |

- **PASS: de suites eromheen.**
  - De drie sporen en hun omgeving: 195/195.
  - De idempotentielagen: 98/98.
  - In de eindkeuring: 26 bestanden met idem, dubbeltik, idempotent, standby of
    trio in de naam, en 60 auth-bestanden (449/450, 1 PostgreSQL overgeslagen).
- **PASS: de statische poorten op `0b1d1ade`.** `npm run check` en `npm run
  norm` zijn gehaald, net als de deltapoort tegen main en `document-fitness`.
- **PASS: `registerklopt`**, op de bekende `bewijskosten` 9 na.
- **PASS: CI op `c881636c`**: helemaal groen.
- **FAIL, opgelost: CI op `fc8e7c1c`.** Scherf 3 zakte op toets 3 van
  `standbypoort-race` (`RTG_ROUTELOG`); opgelost in `4a7327ec`.
- **INFRA:**
  - `bewijskosten` 9 (ondiepe kloon);
  - sentinel en magnaat-capabilities zonder de Rust-motor;
  - `gevolgcontract` zolang er worktrees van een workflow onder
    `.claude/worktrees/` staan.
- **NIET GEVERIFIEERD:**
  - de CI op `0b1d1ade`;
  - de PostgreSQL-stand (N25);
  - een gemengde uitrol van N12;
  - `npm run ci:lokaal` als geheel.

### Wat deze ronde NIET heeft gedaan (bewust)

N18 tot en met N25 zijn vastgelegd en niet gerepareerd. Ze bestonden al vóór
deze branch of vallen buiten de drie besluiten, en horen eerst een besluit te
krijgen.

---

## B. V1 RELEASE BLOCKERS (P0/P1)

> **Statuskolom hieronder bijgewerkt in ronde 1.** De bevindingen zelf (BEFORE)
> blijven ongewijzigd staan als historisch record.

| ID | Sev | Systeem | Probleem | Impact | Bewijs | Fix |
|---|---|---|---|---|---|---|
| **B1** ✅ VERIFIED FIXED (247fa66e) | **P0** | `server/accounts/tokens.js` `verifyToken` | `verifyToken` ontleedt de body als `id.exp.uitgegeven.sid`, maar een actietoken is `id.purpose.exp.nonce`. `Number('inlog2')`=NaN, `NaN < Date.now()`=false → vervalcheck slaat niet aan; het echte account komt terug. Sessie- en actietokens worden met dezelfde `kluis.sign(S.SECRET)` getekend; geen enkele discriminator. | **Volledige 2FA-bypass:** wie alleen het wachtwoord kent krijgt bij `/api/auth/login` het `inlog2`-bewijs in de respons en gebruikt dat als `Bearer`-sessietoken zonder ooit TOTP in te voeren. Idem voor élk gelekt actietoken (`verify-email` = 3 dagen geldig, lekt via e-maillogs/referrer): sessie-escalatie. Altijd-actief pad, geen productiepoort dekt dit. | `tokens.js:124-125` (`[id,exp,uitgegeven,sid]=body.split('.'); if(Number(exp)<Date.now()) return null`); `tokens.js:146-151` (`body = userId+'.'+purpose+'.'+(…)+'.'+nonce`); bewijs teruggegeven in `server/kern/identiteit/tweefactor.js:164-167` + `server/routes/auth/inlog.js:136-137`. **Gereproduceerd:** inlog2- én verify-email-token → `verifyToken` geeft user id 1. | Teken actietokens met `kluis.sleutelVoor('actie:'+purpose)` (HKDF-domeinscheiding, bestaat al) zodat een sessieverifier ze cryptografisch nooit accepteert; in `verifyToken` ook `Number.isFinite(Number(exp))` eisen. Zie **K / Blocker 1**. |
| **B2** ✅ VERIFIED FIXED (eea75f7f) | **P0** | `server/opzet/meldingen.js` + `server/server.js` `meldingenVan` + SSE | `meld(tier,note)` schrijft in de **gedeelde** bak `db.data.notifications[tier]` en SSE-broadcast naar `match:[tier]` (`classificatie:'persoonsgegeven'`). `meldingenVan(sess)` geeft `db.data.notifications[sess.tier]` onverkort terug; voor een echt account is `tier` de pas-waarde, dus alle leden van één pas delen de bak. De sleutel-bak filtert de tier-bak niet weg. | **Cross-member AVG-lek:** elk lid ziet in `/api/notifications` én realtime de persoonlijke meldingen van alle leden met dezelfde pas — boekings-/order-/rit-bevestigingen (zaaknaam, datum), letterlijke conciërge- en gast-chatteksten, identiteitsverificatie-uitslagen. Treedt op in productie (meerdere echte accounts/pas), onzichtbaar in demo (key===tier). | `opzet/meldingen.js:65-70`; `server.js:1092-1100` (`opTier = db.data.notifications[sess.tier]`, altijd teruggegeven); `opzet/diensten2.js:216` (`tier:user.tier`); `kern/sse.js:66` (`m.doel==='tier'→raak=m.match.includes(c.tier)`); schrijvers o.a. `routes/supplier/boekingen.js:36`, `routes/office/werk.js:121`, `routes/supplier/gastcontact.js:44`, `routes/office/verificaties.js:99`. De code erkent de val zelf (`server.js:1080-1091`, `opzet/meldaan.js` kop). | Route persoonlijke meldingen via `meldLid(key)` → `db.data.notifications['user-'+id]`; reserveer `notify(tier)` voor echte broadcasts; laat `meldingenVan` de tier-bak alleen voor expliciet-broadcast-items lezen; fix `/api/notifications/read` idem. Zie **K / Blocker 2**. |
| **B3** ✅ VERIFIED FIXED (37415250) | **P1** | `server/config/openbaar.js`, `server/config.js`, `server/kern/kantoor/productiedeur.js`, `server/opzet/poortwachters.js`, alle `server/middleware/*-productiepoort.js` | Vrijwel alle productie-hardening keyt op `NODE_ENV==='production'`: kantoordeur-passkey, config-keuring (kluissleutels, encryptie-at-rest, webhook-secrets), inlogrem, foundation-/legacy-/travel-/simulatiepoorten. Een publiek adres zónder `NODE_ENV=production` start met alleen schaduw-waarschuwingen; alleen de demo-combinatie is een harde fout. | Publieke deploy die de env-var vergeet: `/api/office/login` opent de backoffice (identiteitskluis, paspoortscans) op de gedeelde `OFFICE_CODE` zonder passkey; encryptie-at-rest/kluissleutels vallen stil terug op bestanden; onvolgroeide Foundation-routes staan open. Vereist operator-misconfiguratie; de ondersteunde Docker/compose/golive-weg zet `NODE_ENV=production` en is veilig. | `server.js:470`; `productiedeur.js:37,40-44,53-54`; `routes/office/toegang.js:11-16`; `config.js:66-73` (exit alleen in prod-tak); `config/openbaar.js:109-146` (openbaar-maar-niet-prod → schaduwFouten → waarschuwingen); `poortwachters.js:44`. Mitigatie: office heeft eigen rem (`toegang.js:13-19` + `server.js:589-632`), `OFFICE_CODE` is willekeurig (niet hardcoded). | Laat hardening afgaan op `openbaar.installatieSoort(env).soort==='openbaar'` **OF** `NODE_ENV==='production'`; promoveer de schaduwfouten tot `hardeFouten` zodra het adres aantoonbaar openbaar is (zoals demo-op-publiek al is). Zie **K / Blocker 3**. |
| **B4** ✅ VERIFIED FIXED (28d0fc4e) | **P1→P2** | Release-gate / `test/schermeigenaar.test.js` | De volledige Node-suite is **rood op `b7f14dfa`**: `public/site/techniek/techniek.html` (toegevoegd door merge #473) staat niet in `SCHERMEIGENAAR.json`, dus de schermeigenaar-governancetoets faalt (2 subtests). De release-gate (`productie-oordeel.js`) eist een volledig groene, skip-vrije suite. | Zuiver release-gate-blokkerend, niet exploiteerbaar: zolang de suite rood is kan `productie:status`/`release:gate` nooit READY worden. Weerlegt de claim in `RELEASEKANDIDAAT.md` ("npm test → 0 gezakt", gemeten op oudere commit `115ceb85`). | **Zelf geverifieerd op de echte repo:** `node --test test/schermeigenaar.test.js` → `# fail 2`; `grep -c techniek/techniek.html SCHERMEIGENAAR.json` → 0; het bestand bestaat (`public/site/techniek/techniek.html`). | Registreer `site/techniek/techniek.html` in `SCHERMEIGENAAR.json` (capability + rol, of alias met oordeel); draai de volledige suite groen vóór enige release-stempel. Technisch triviaal, maar het is een harde poort. |

> B4 is op zichzelf P2 qua ernst, maar staat in deze tabel omdat hij de
> release-gate **nu** hard dichtzet en een gedocumenteerde claim weerlegt.

---

## C. SECURITY BLOCKERS

| ID | Sev | Systeem | Probleem | Impact | Bewijs | Fix |
|---|---|---|---|---|---|---|
| **C1** | **P0** | authenticatie | = **B1** (2FA-bypass via actietoken). | Accountovername met alleen wachtwoord; sessie uit gelekte e-maillink. | zie B1 (gereproduceerd). | zie K/Blocker 1. |
| **C2** | **P1** | deploy-hardening | = **B3** (`NODE_ENV`-afhankelijke poorten). | Backoffice/kluis open bij één vergeten env-var. | zie B3. | zie K/Blocker 3. |
| **C3** ✅ VERIFIED FIXED (ronde 2) | **P2** | `server/routes/member/tweefactor.js` | `/api/auth/tweede` (TOTP-controle) kent geen eigen pogingenrem binnen het 5-min bewijsvenster. | TOTP brute-forcebaar binnen het venster (verzwakt door de korte TTL). | `routes/member/tweefactor.js:109-114` (geen `tooManyTries`/`noteFailedTry`). | `tooManyTries`/`noteFailedTry` op deze route, zoals bij `/api/auth/login`. |
| **C4** ✅ VERIFIED FIXED (ronde 2) | **P2** | `server/routes/auth.js`, `herstel.js`, `account.js` | `RTG_DEV_LINKS=1` lekt herstel-/verify-URL's en SMS-code in de HTTP-respons; niet gedekt door de release-poort. | Bij een gezette dev-vlag in een verkeerde omgeving lekken herstelgeheimen. | `routes/auth.js:65`; `routes/auth/herstel.js:122`. | `RTG_DEV_LINKS` als harde fout in `config/productie-lokaal.js` / openbaar-adres. |
| **C5** ✅ VERIFIED FIXED (ronde 2) | **P2** | `server/kern/payroll/bijwerken.js`, `dekking-bronnen.js` | SSRF: payroll-bronlaag haalt een kantoor-opgegeven URL op zonder intern-adresfilter en volgt redirects (anders dan de voorbeeldige SSO-fetch). | Kantoorhouder kan interne adressen laten aanroepen. | `payroll/bijwerken.js:160-163`; `dekking-bronnen.js:31-34`. | Hergebruik de SSRF-hardening van `server/sso/haal.js` (intern-adres/redirect-filter) + liefst IP-pin tegen DNS-rebinding. |
| **C6** ✅ VERIFIED FIXED (ronde 2; keuze eigenaar: alleen de gevaarlijke combinatie geweigerd) | **P2** | `server/db/merge.js` + `server/db/sqlite.js` | SQLite-productiestand: de kruisproces-merge lost een scalar-conflict stil op ten gunste van de laatste schrijver → verloren saldo-update. | Stille lost-update op geld/stand bij gelijktijdigheid in SQLite-modus. | `merge.js:29` (`return ours; // laatste schrijver`); `sqlite.js:109`. Contrast: `pg/verzoekmerge.js` geeft 409. | **Verbied SQLite als productiestand** (eis PostgreSQL in prod) óf til de 409-conflictdetectie van de PG-merge naar de SQLite-merge. Scope: DISABLE_V1. |

> Opt-in `RTG_EIGEN_HTTP=1`-motoren (`server/lib/http1.js`, `http1-res.js`)
> missen request-smuggling- en CRLF-verdediging (P2, DISABLE_V1). Niet in
> productie geblokkeerd — **houd de standaard `node:http`-motor in productie**.

---

## D. RELIABILITY / DATA BLOCKERS

Geen P0/P1 in deze dimensies. De PostgreSQL-productiestand is sterk: de
requestcommit-gate geeft nooit een valse 200 (`server/db/postgres-verzoeken.js`),
accounts committen atomair mee (`server/accounts/transactie.js` +
`server/db/deelnemers.js`), en de drie-weg requestmerge faalt gesloten op
scalar-conflicten (`server/pg/verzoekmerge.js`). De in `RELEASEKANDIDAAT.md`
gevreesde "`save()` zet alleen een vlag" blijkt in PG-modus gedekt.

| ID | Sev | Systeem | Probleem | Impact | Bewijs | Fix |
|---|---|---|---|---|---|---|
| **D1** ✅ VERIFIED FIXED (ronde 2) | **P2** | `server/server.js` crash-handler | `uncaughtException` flusht minder dan SIGTERM: geen synchrone journaal-/vertaal-/snapshotflush. | Bij een crash verdwijnt een write-behind-venster + gebufferde auditregels — precies waar incidentreconstructie op leunt. | `server.js:143-154` (alleen `save()`); vgl. SIGTERM `opzet/luister.js:135-139`. | Laat de `uncaughtException`-handler dezelfde flush draaien als SIGTERM vóór `exit(1)`. |
| **D2** | **P2** | audit/opslag (`STILSPOOR.json`) | 41 spoor-/opslagschrijvers met gesmoorde fout, 0 met een vastgelegd besluit (LAT.md regel 21-schuld). | Een mislukte audit-/opslagschrijf kan stil verdwijnen. | `STILSPOOR.json` (`spoorGesmoord:17, opslagGesmoord:24, …MetBesluit:0`); `server/db/postgres.js:176`. | Per gesmoorde schrijver een expliciet besluit (bewust of repareren); de kritieke audit-schrijvers fail-closed. |
| **D3** | **P2** | `server/middleware/idempotentie.js` | Generieke idempotentielaag is per-proces (`new Map()`); dekt in een cluster niet. | Dubbele niet-geld-mutaties als een retry op een andere werker landt. (Geld-idempotentie is wél cluster-breed via PG.) | `idempotentie.js:92` + docstring 59-61. | Deel de idempotentiekas via PG/Redis voor muterende routes in clustermodus. |
| **D4** | **P2** | `IDEMPROEF.json` / `MUTATIECONTRACT.json` | Idempotentie/mutatiecontract is voor 1739 van ~5148 routes beproefd (3409 ongemeten); registers stale t.o.v. `b7f14dfa`. | Onbekende herhaalbaarheid op een groot deel van de muterende routes. | `IDEMPROEF.json` (`beoordeeld 1739, ongemeten 3409`), stempel `387b942c5` ≠ HEAD. | Meet door op de kritieke muterende routes; herijk de registers op de release-commit. |
| **D5** | **P2** | geldmotor-cutover | Rust-motoridempotentie is op de meeste geldpaden niet bedraad (callers zonder `economischeSleutel`). | Double-book-risico bij cutover naar de Rust-geldmotor. | `kern/pay/boeking.js:69`; callers `kern/pay/huis.js:30,43`. | Bedraad `economischeSleutel` op alle geldcallers vóór motor-cutover (los van V1 zolang `RTG_MOTOR_GELD` uit staat). |

---

## E. TEST GAPS — onbewezen kritieke stromen

**Positief:** 15.773 tests, waarvan 15.770 groen (de 3 reds: 2× schermeigenaar
governance-drift = B4; 1× `bewijskosten` = shallow-clone/git-history-artefact,
niet-reproduceerbaar in echte CI). AVG-wissing (`vergeten.test.js`,
database-brede bezem), betaalwebhook-faalinjectie
(`betaalwebhook-fouten.test.js`) en ongeverifieerde betaalbevestiging worden
tegen **echte modules** beproefd, niet gemockt. 36 PG-integratietests tegen
echte `postgres:16` in CI.

Onbewezen / ontbrekend:

- **Sessie-/tokentype-scheiding:** geen toets dwong af dat `verifyToken` een
  actietoken weigert (B1 bleef daardoor onzichtbaar). **Toe te voegen.**
- **Cross-member meldingenisolatie:** geen toets dekt de tier-bak-leak (B2); de
  IDOR-proef test alleen object-id-hergebruik, niet gedeelde bakken.
- **Concurrency/race op geld in SQLite-modus:** geen toets dekt de lost-update
  van C6.
- **Deploy-misconfiguratie:** geen toets dat een openbaar adres zonder
  `NODE_ENV=production` weigert te starten (B3).
- **PG- en browser-e2e draaien niet in `npm test`** en per-PR alleen
  incrementeel (`ci.yml`); 22 PG-toetsen worden lokaal overgeslagen zonder
  `DATABASE_URL` (tellen als gezakt voor de release).
- **Provider-failure/timeout op de echte betaalrail** en de Rust-geldmotor onder
  split-brain zijn niet uitvoerbaar getest in deze read-only context.
- `SUITE.json` (laatste-ronde-register) meldt zelf `groen:false`, `mislukt:9`,
  `overgeslagen:43`, stempel `c47e0090` — stale en niet-groen.

---

## F. PRODUCTION / DEPLOYMENT BLOCKERS

| ID | Sev | Systeem | Probleem | Bewijs |
|---|---|---|---|---|
| **F1** | **P1** | `NODE_ENV`-gating | = B3: hardening fail-open buiten `NODE_ENV=production`. | zie B3. |
| **F2** | **P2** | release-gate | Suite rood op release-commit (B4) → `release:gate`/`productie:status` kan niet READY worden. | `productie-oordeel.js` eist groene, skip-vrije suite; `SUITE.json groen:false`. |
| **F3** | **extern** | geldmodel/uitbetaalprovider (RELEASEKANDIDAAT B2/B3, E9) | `uitgaandGeconfigureerd=false` (`config/productie-geld.js:95-102`); `betaal.js` weigert uitbetaling. Besluit "met/zonder geld" + merchant-account ontbreekt. | `config/productie-geld.js`. Besluit van de eigenaar + E9. |
| **F4** | **extern** | host/TLS/DNS/objectopslag/SMTP (E2-E7) | Geen bewezen productiehost, ACME/TLS, S3-bucket, SMTP+SPF/DKIM/DMARC, foutalarm-sink, off-site back-up. | `RELEASEKANDIDAAT.md` §1 E-reeks. |
| **F5** | **extern/legaal** | pentest + DPIA + verwerkersovereenkomsten (E1, E8, B4) | Geen onafhankelijke pentest; DPIA-fundament niet beoordeeld/getekend; verwerkersregister/datalek-papierwerk open. | `DPIA.md`, `VERWERKINGSREGISTER.md`, `DATALEK.md`. |
| **F6** | **besluit** | image-kwetsbaarheidsscan (B6) | Geen scanner in CI; dossier eist `imageVulnerabilityScan`. | `RELEASEKANDIDAAT.md` B6. |

> **Sterk:** de *ondersteunde* productieweg (Docker-image + compose + `golive`)
> is non-root, read-only, `cap_drop ALL`, secrets-as-files, met harde
> exitcodes en cryptografisch verankerde release-handtekeningen
> (`release-trust.js`, `external-release.js`, `productie-oordeel.js`). De
> A1-blokkade uit `RELEASEKANDIDAAT.md` (release-gate gaf afbouwslot niet door)
> is in de code opgelost; het register loopt achter.

---

## G. ARCHITECTURE VIOLATIONS

Geen P0/P1. De kern-grenzen worden in de praktijk gehandhaafd (domeingrens-Proxy
fail-closed; kantoordeur dicht in prod; huisbreed hash-geketend auditspoor met
actor-uit-sessie; envelop leidt actor uit de servergezette sessie). De
afwijkingen zijn bewuste schaduw of register-drift:

| ID | Sev | Systeem | Overtreding | Bewijs |
|---|---|---|---|---|
| **G1** | **P2** | `server/kern/stuur/beleid.js`, `middleware/schorspoort.js` | Proof-aware routing houdt **niets** tegen: 0 bewezen, 0 geschorst. De handhaving rust volledig op de legacy-poorten. Presenteer de "bewijs-gestuurde" beloften (FABRIC/AUTHORITY.md) daarom niet als afgedwongen. | `beleid.js:133`; `schorspoort.js:48`; `VERTROUWEN.json {bewezen:0,geschorst:0}`. |
| **G2** | **P2** | `server/kern/beleidsmotor` | AUTHORITY.md-beleidsmotor is uitsluitend schaduw; dwingt alleen af als `afdwingen.aan(deur)` (nergens true). | `beleidsmotor/index.js:13,93`; `afdwingen.js:26`. |
| **G3** | **P2** | `server/opzet/domeingrens.js` | Data-eigendom niet afgedwongen: elk domein krijgt volledige `db`/`save` via de gedeelde interface; source-of-truth is voor DATA conventioneel. | `domeingrens.js:47-54,101`. |
| **G4** | **P3** | registers | Meetregisters lopen achter op HEAD; `EXECUTION_MAP.json` mist een stempel; `KANTOORMACHT.json anoniemUitvoerbaar:358` is een lexicale overschatting (de routes zijn feitelijk gepoort); `ROUTEBRON.json` incompleet (≥25 bestaande routes ontbreken). | `VERTROUWEN.json 2026-09-29` vs HEAD 2026-10-05; `regering.js:31` (`officeAuth`); FRONTEND-crosscheck. |

> Geen bewezen directe-DB-write die het officiële mutatiepad omzeilt; geen
> privileged route zonder poort in de steekproef; geen metric-als-waarheid
> zonder bewijsgraad in de kritieke paden.

---

## H. WAT AL PRODUCTION-GRADE IS

| Systeem | Bewijs | Waarom releasewaardig |
|---|---|---|
| **Betaalwebhooks** | `betaal/webhook.js:20-44`, `stripe.js:60-75`, `adyen.js:34-46` | Echte HMAC-handtekeningcontrole, timing-safe, replay-tolerantievenster; demo weigert zonder secret. Client kan status niet vervalsen. *(Auditor-geverifieerd.)* |
| **Betaalwaarheid** | `kern/betaalwaarheid/*`, `kern/betaalopdracht/inzending.js` (MONEY-012) | Providerantwoord = bewijs, geen auto-waarheid; dubbele/gedeeltelijke refund, verkeerd bedrag, payout-timeout correct afgehandeld; geen geld uit niets. |
| **Identiteitskluis** | `accounts/kluis.js` | AES-256-GCM + HMAC-zoekhash + HKDF-domeinscheiding + AAD-gebonden KYC; echte naam nooit in operationele data. |
| **PostgreSQL-transacties** | `db/postgres-verzoeken.js`, `accounts/transactie.js`, `pg/verzoekmerge.js` | Geen valse 200; atomische account-commit; 409 i.p.v. stille lost-update; vaste lock-ordening tegen deadlocks. |
| **Websec-grondslag** | `middleware/csp.js`, `opzet/koppen.js`, `web/bestanden.js`, `media/bestand.js`, `lib/rtgjson.js` | Bearer-only (CSRF structureel n.v.t.), CSP met per-verzoek nonce zonder `unsafe-inline` (XSS-impact ~nul), padtraversal/MIME-sniffing/prototype-pollution afgevangen. |
| **Demo-backdoor dicht in prod** | `config/productie-lokaal.js:6-9`, `config.js:64-70` | `RTG_DEMO`/`RTG_MAGNAAT_TEST` zijn harde fouten → `exit(1)`. Geen demo-accounts, pincode-uit-broncode of zelfbevestigende betaalprovider in productie. *(Auditor-geverifieerd.)* |
| **AVG-wissing** | `kern/vergeten.js` (`vergeten.test.js`) | Dekt wees-bytes, mediastore, `member_state`-selfie, write-behind-race; wettelijke retentie-uitzonderingen. |
| **Auditspoor** | `opzet/auditspoor.js`, `db/audit-sqlite.js` | Onwisbaar, hash-geketend, landt vóór de requestcommit, actor uit de sessie (niet het verzoek). |
| **Backup/herstel** | `scripts/docker/herstel.sh`, `live.sh`, `db/duurzaam.js` | Ondertekend + checksum-geverifieerd herstel; geld en gepoortte toestemming via synchrone `fsync`-`saveDuurzaam()`. |
| **Frontend↔backend-contract** | FRONTEND-crosscheck (322 schermen × ~1109 API-calls) | 0 niet-bestaande routes; geen dode knoppen; geen TODO/FIXME/HACK; uniforme server-side autorisatie. |
| **Kantoordeur in prod** | `kern/kantoor/productiedeur.js` | 26 kamers achter één gedeelde code → in prod dicht; toegang op naam met aan de sessie gebonden passkey. |

---

## I. V1-SCOPE

### SHIP IN V1 (werkt, veilig, bewezen — ná B1/B2/B3/B4)
- Ledenportaal + PWA kern: account, login/2FA *(na B1)*, profiel, boardroom.
- Betalingen (inkomend) met echte provider + webhooks *(na besluit F3/E9)*;
  betaalwaarheid, settlement, refunds, cadeaukaart.
- Supplier/zaak-backoffice met zaak-isolatie; kantoor op naam met passkey.
- Data op PostgreSQL (niet SQLite — zie C6); AVG-wissing, inzagejournaal.
- Horeca/mobiliteit/reizen/commerce-kernketens (tafel-, rit-, toelatingsproeven
  groen).

### DISABLE FOR V1 (hard dicht laten tot verder bewijs)
- **SQLite als productie-opslag** (C6) → eis PostgreSQL.
- **Eigen HTTP/HTTP2-motor** (`RTG_EIGEN_HTTP`) → standaard `node:http`.
- **Rust-geldmotor-cutover** (D5) tot `economischeSleutel` overal bedraad.
- **FoundationOS voor minderjarigen** (RELEASEKANDIDAAT B8, default `GESLOTEN`).
- Onvolgroeide "werelden" die 503 geven in dicht-productie: verberg de tegels
  (zie FRONTEND P2) i.p.v. ze te tonen.

### POST-V1 (bewust uitgeschakeld / later)
- DemocratieOS/POLITIEK fase C, HDI-lagen, toekomstige OS-lagen.
- Proof-aware routing / beleidsmotor als afdwingende laag (G1/G2) — eerst
  schaduw volmeten.
- Uitbetalingen aan leden / e-money-rail (vergunningsbesluit, RELEASEKANDIDAAT
  B2a/B3).

---

## J. RELEASE GATE CHECKLIST

Alleen `[x]` waar technisch bewezen in deze audit.

- [ ] **Security** — twee P0 open (B1, B2); C3-C6 open.
- [ ] **Authentication** — B1 (2FA-bypass) blokkeert.
- [x] **Authorization** — rol/tier server-side uit de sessie; ledengate weigert
  andere rollen; tier alleen via menselijk besluit. *(Bewezen; least-privilege
  binnen kantoor is P2.)*
- [x] **Tenant isolation** — zaak/supplier-isolatie uit de sessie; object-IDOR
  consistent afgevangen. *(Bewezen; uitzondering = B2 meldingen.)*
- [ ] **Privacy** — B2 (cross-member PII-lek) blokkeert; fail-open kluissporen
  (P2) open.
- [x] **Critical data integrity (PostgreSQL)** — requestcommit-gate, atomische
  accounts, 409-conflictdetectie. *(Bewezen in PG-modus; SQLite = C6.)*
- [x] **Payments** — webhookverificatie, betaalwaarheid, geen dubbele
  betaling/refund. *(Code-bewezen; echte provider/host = F3/E9.)*
- [x] **Core workflows** — tafel-/rit-/toelatingsketens groen; frontend-contract
  heel.
- [x] **Recovery** — crash-handlers, degradatie, duurzame geld-/consent-writes.
  *(D1 flush-gap = P2.)*
- [ ] **Backups** — keten bewezen in code; off-site/echte host niet
  geverifieerd (E6).
- [x] **Observability** — gestructureerd loggen + correlatie-id, hash-geketend
  auditspoor, health/ready, foutmelder. *(E-sink extern = F4.)*
- [ ] **Deployment** — B3 (`NODE_ENV`-fail-open) + externe host/TLS (F4).
- [ ] **Critical tests** — suite rood op release-commit (B4); PG/e2e niet in
  `npm test`.
- [~] **Performance** — geen blokkerende bevinding; geen loadtest uitgevoerd in
  deze read-only audit (niet bewezen).
- [x] **Error handling** — centrale async-isolatie, 4xx/5xx-afsluiter,
  crash-vangnetten. *(Gesmoorde schrijvers = D2.)*
- [ ] **External integrations** — betaalprovider/SMTP/objectopslag/pentest/DPIA
  open (F3-F6).

---

## K. EXACT AFBOUWPLAN (geordend)

> Volgorde: eerst de twee P0's (security/privacy), dan de deploy-hardening, dan
> de release-gate, dan de risico-verlagers. Elke stap is klein en lokaal.

### RELEASE BLOCKER 1 — 2FA-bypass / actietoken telt als sessie (P0)
- **Bestanden:** `server/accounts/tokens.js` (`verifyToken`, `issueActionToken`,
  `verifyActionToken`); evt. `server/accounts/kluis.js` (`sleutelVoor`).
- **Probleem:** `verifyToken` accepteert elk door de server getekend actietoken
  (`inlog2`, `verify-email`, `mailwissel`, `sso-overdracht`) als volwaardige
  sessie, omdat sessie- en actietokens met dezelfde sleutel worden getekend en
  er geen type-discriminator is; `Number('inlog2') < Date.now()` is `false`.
- **Gewenste architectuur:** sessie- en actietokens zijn
  **cryptografisch niet-uitwisselbaar** — consistent met de bestaande
  HKDF-domeinscheiding (`kluis.sleutelVoor`) die juist hiervoor bestaat.
- **Concrete wijziging:** onderteken actietokens met
  `kluis.sleutelVoor('actie:'+purpose)` i.p.v. de kale `kluis.sign(S.SECRET)`;
  `verifyActionToken` verifieert met dezelfde afgeleide sleutel. Aanvullend in
  `verifyToken`: eis `Number.isFinite(Number(exp))` én een plausibele
  ms-timestamp (`> 1e12`) zodat een niet-numerieke `purpose` nooit door de
  vervalcheck glipt. (Let op terugwaartse geldigheid van bestaande tokens:
  of korte uitfasering, of de numerieke-check als overgang.)
- **Toe te voegen tests:** `verifyToken(issueActionToken(id,'inlog2',…))===null`
  en idem voor `verify-email`/`mailwissel`/`sso-overdracht`; e2e: wachtwoord-only
  login → `bewijs`; `bewijs` als `Bearer` op `/api/auth/me` → 401.
- **Bewijs dat het opgelost is:** de reproductie
  (`scratchpad/repro-2fa.js`) geeft dan `null` voor beide actietokens en nog
  steeds de user voor een echt sessietoken; de nieuwe unit-toetsen groen.

### RELEASE BLOCKER 2 — cross-member meldingenlek (P0, AVG)
- **Bestanden:** `server/opzet/meldingen.js` (`meld`), `server/server.js`
  (`meldingenVan`, `/api/notifications/read`), en de persoonlijke schrijvers:
  `routes/supplier/boekingen.js:36`, `routes/office/werk.js:121`,
  `routes/supplier/gastcontact.js:44`, `routes/office/verificaties.js:99`, plus
  `orders/afhandeling.js`, `kassa/innen.js`, vervoer/verhuur/charter.
- **Probleem:** persoonlijke meldingen gaan via `notify(tier)` naar een per-pas
  gedeelde bak + SSE-broadcast; elk lid leest de meldingen van alle leden met
  dezelfde pas.
- **Gewenste architectuur:** persoonlijke meldingen op de **ledensleutel**
  (`user-<id>`); `notify(tier)` uitsluitend voor echte, niet-persoonlijke
  broadcasts.
- **Concrete wijziging:** vervang in de schrijvers `b.customerTier`→
  `b.customerKey`, `u.tier`→`'user-'+u.id`, `meta.tier`→`lijn.lidKey`, en roep
  `meldLid(key)` aan (`server/opzet/meldaan.js:83`). Laat `meldingenVan` de
  tier-bak alleen nog lezen voor items met een expliciete broadcast-markering.
  Fix `/api/notifications/read` zodat het niet de gedeelde tier-bak voor
  iedereen op gelezen zet.
- **Toe te voegen tests:** twee echte leden, zelfde pas; A maakt een boeking/chat
  → B's `/api/notifications` en B's SSE-stream bevatten die melding **niet**;
  uitbreiding van `scripts/gluurronde.js` met de meldingen-as.
- **Bewijs dat het opgelost is:** de isolatietoets groen; `meld()` schrijft voor
  persoonlijke inhoud aantoonbaar alleen op `user-<id>`.

### RELEASE BLOCKER 3 — productie-hardening deploy-onafhankelijk maken (P1)
- **Bestanden:** `server/config/openbaar.js` (`keurOpenbareBouwstand`),
  `server/config.js`, `server/kern/kantoor/productiedeur.js`,
  `server/opzet/poortwachters.js`, encryptie-/kluissleutel-checks in
  `config/productie*.js`.
- **Probleem:** alle hardening keyt op `NODE_ENV==='production'`; een openbaar
  adres zonder die vlag start wijd open met configfouten als loutere
  waarschuwing.
- **Gewenste architectuur:** "aantoonbaar openbaar" (`installatieSoort`) is net
  zo bindend als `NODE_ENV=production`; fail-closed.
- **Concrete wijziging:** laat `productiedeur`, de kluissleutel-/encryptie-eisen
  en de inlogrem afgaan op `openbaar.installatieSoort(env).soort==='openbaar'`
  **OF** `NODE_ENV==='production'`; promoveer in `keurOpenbareBouwstand` de
  `schaduwFouten` tot `hardeFouten` voor een openbaar adres (zoals demo-op-publiek
  al is).
- **Toe te voegen tests:** `valideer({APP_URL:'https://echt.nl',
  NODE_ENV:undefined, RTG_ENC_KEY:undefined})` → hardeFout/exit; office-login
  dicht; foundation-poort doet geen `next()` bij openbaar adres zonder
  `NODE_ENV`.
- **Bewijs dat het opgelost is:** start met openbaar `APP_URL` zonder
  `NODE_ENV` weigert (exit 1); met `NODE_ENV=production` + sleutels start
  normaal.

### RELEASE BLOCKER 4 — suite groen op de release-commit (P2, gate-blokkerend)
- **Bestanden:** `SCHERMEIGENAAR.json`, evt. `public/site/techniek/techniek.html`.
- **Probleem:** `test/schermeigenaar.test.js` faalt — het techniek-scherm staat
  niet in het eigenaarsregister.
- **Concrete wijziging:** registreer `site/techniek/techniek.html` in
  `SCHERMEIGENAAR.json` met capability + rol (of als alias met oordeel), conform
  de consolidatiedoctrine.
- **Toe te voegen tests:** geen nieuwe; de bestaande
  `test/schermeigenaar.test.js` moet groen worden, en de volledige suite
  (`scripts/test-runner.js`) skip-vrij groen op de release-commit.
- **Bewijs dat het opgelost is:** `node --test test/schermeigenaar.test.js`
  `# fail 0`; `npm test` groen; `SUITE.json groen:true` op de release-commit.

### DAARNA (risico-verlagers, in deze volgorde)
5. **C6** — verbied SQLite als productiestand (eis PostgreSQL) of til de
   409-conflictdetectie naar de SQLite-merge.
6. **C3/C4/C5** — rem op `/api/auth/tweede`; `RTG_DEV_LINKS` harde fout op
   openbaar adres; SSRF-filter op de payroll-bronlaag.
7. **D1/D2** — `uncaughtException` dezelfde flush als SIGTERM; expliciet besluit
   per gesmoorde audit-/opslagschrijver.
8. **FRONTEND P2** — verberg FoundationOS-tegels (`vrienden`, `rtfbord`,
   `rtfschrift`, `klimaat`) wanneer de foundation-poort dicht is, zodat er geen
   zichtbare ingang naar een 503 bestaat.
9. **Registers herijken** op de release-commit (`ROUTEBRON`, `VERTROUWEN`,
   `IDEMPROEF`, `MUTATIECONTRACT`, `EXECUTION_MAP`-stempel, `KANTOORMACHT`).
10. **Externe/legale poorten** (F3-F6): geldmodel + uitbetaalprovider,
    productiehost/TLS/objectopslag/SMTP, onafhankelijke pentest, DPIA +
    verwerkersovereenkomsten, image-kwetsbaarheidsscan.

---

## Verantwoording & grenzen van deze audit

- **Zelf gereproduceerd/geverifieerd:** B1 (live tegen de echte
  `accounts`-module), B2/B3/B4 (code + testrun), webhook- en demo-gating
  (strengths H).
- **Agent-bevindingen, adversarieel nagetrokken:** alle P0/P1 zijn door een
  tweede, onafhankelijke verificatiepas tegen de code gehaald; de privacy-P1
  (BIG-nummer fail-open journaal) is daarbij terecht naar **P2** bijgesteld
  (achter `kluisAuth` op naam + tweede pushpad; bijt alleen onder
  infrastructuurfalen).
- **Niet verifieerbaar hier (read-only, geen echte host):** TLS/ACME/DNS,
  objectopslag, SMTP-bezorging, echte betaalprovider-sandbox, de pgwire-driver
  onder echte concurrency, loadtests, en alle externe/legale items. Deze zijn
  als `extern` gemarkeerd, niet als bewezen.
- **Registers lopen achter op HEAD** — overal waar een register is geciteerd, is
  de code als leidend behandeld.
