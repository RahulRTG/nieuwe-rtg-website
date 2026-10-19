# Premiumdomeinkaart · Instellingen

*APPWERKT Toegang, 19 oktober 2026. Dit document beschrijft de apps en doet
voorstellen. Het belooft niets. Een functie wordt pas werk na een toezegging
van de eigenaar, per familie.*

Dit zijn de negen Instellingen-apps: Ik, Gegevens, Sessies, Passkeys,
Verificatie, Bescherming, Relaties, Neigingen en Post. Juridisch staat erbij,
maar nog zonder scenario. RTG Veilig staat **niet** in deze kaart. LivingOS-A en
-B kozen op 19 oktober allebei optie (a): Veilig komt in
`docs/domeinkaarten/livingos-a.md`. Hier staat alleen wat Instellingen aan
Veilig levert (par. 13).

Wie welk scherm bezit, volgt uit `SCHERMEIGENAAR.json`. Alle tien schermen
hebben daar rol `eigenaar`, en `server/kern/wereldroutes/instellingen.js` zet ze
in de Instellingen-schil. Er komt geen nieuwe laag en geen vierde
identiteitsmodel (`TENANT.md` par. 2: een RTG-account is een mens, `org` is de
tenant, een leverancierscode is nooit een identiteit). Codenamen en de kluis
blijven.

## 0. Leeswijzer

**Bronnen van "bestaat".** Een stand hieronder komt uit de registers van 19
oktober 2026. Elk register draagt een eigen stempel:

| register | gemeten op commit | geeft |
|---|---|---|
| `APPWERKT.json` | af81b538 | bewijs 1, 2, 4, 6 en 8 per app |
| `VOLTOOIPROEF.json` | f85c044e | bewijs 3, 5 en 7, met een scenario in `scripts/lib/voltooi/*.js` |
| `IDOR.json` | 34b3fc25 | per route: gescheiden, publiek, nagekeken of onbereikbaar |
| `BEVOEGD.json` | 55ed79f9 | bewijs 6, per scherm |
| `ROLPROEF.json` | 897b5888 | rolkruising per route |

De acht bewijzen staan in `BETROUWBAARHEID.md` par. 2: bereikbaar, bedienbaar,
voltooibaar, waarheidsgetrouw, persistent, bevoegd, herstelbaar en menselijk.
Het eindcontract per app (h) vervangt ze **nooit**. Het komt erbovenop.

**Standen in de functiecatalogus.** **B** = bestaat, met bron en toets. **H** =
half: er bestaat een deel, of het bestaat maar is niet bewezen. **O** = ontbreekt.

**Kosten.** **K** is klein (≤ 2 dagen, één module, bestaande opslag). **M** is
middel (≤ 2 weken, meerdere modules of een nieuw scherm-blok). **G** is groot
(meer dan 2 weken, of een externe partij, of juridische toetsing).

**Bakken.** **Nu** = aanbevolen nu. **Later** = later. **Niet** = niet doen, met
de reden erbij.

**Lagen.** L1 Persoonlijk · L2 Professioneel · L3 Organisatorisch · L4
Domeinintelligentie · L5 Volledige levenscyclus · L6 RTG-samenhang.

**Twee uitkomsten per app.** **(A)** is wat binnen de huidige architectuur en
scope kan. **(B)** is het domeinmaximum, ook buiten de huidige scope.

**Onzekerheid.** **[U]** betekent: niet in een primaire bron gecontroleerd.
Het marktonderzoek en het domeinonderzoek gebeurden op 19 oktober 2026 via
zoekresultaten, omdat WebFetch in deze omgeving geen enkele host kon bereiken.
Elke URL hieronder stond in een zoekresultaat, maar geen enkele pagina is
geopend. Een bewering met [U] is daarom een aanwijzing en geen bouwgrond. Wie
gaat bouwen, opent eerst de bron.

---

## 1. Wat elke andere app van Instellingen nodig heeft

Instellingen is de bron van account, toestemming en bezitsbewijs voor alle 114
apps. Een app leest die dingen bij Instellingen en kopieert ze nooit. Hieronder
staat per levering wat er vandaag gebeurt als de bron hapert. Alles is gemeten
in de code (bestand:regel), niet aangenomen.

| Levering | Wie gebruikt het | Wat er nu gebeurt bij een storing | Toets | Oordeel |
|---|---|---|---|---|
| **Sessie → account** (`resolveSession`, `server/accounts/tokens.js:109-143`) | elke app achter `auth` | een leesfout in de kluis of de intreklijst wordt `null`, en dat wordt **401 "Niet ingelogd"** (`diensten2.js:228`). Dicht, maar het lid denkt dat hij uitgelogd is | `intreklijst-failclosed`, `tokens-weerbaar`, `verifier-failclosed` | dicht is goed, de boodschap niet: dit hoort een **503 "even niet"** te zijn, en niet "log opnieuw in" |
| **Sessiecontext** (sessieregister) | Sessies, zware paden | onleesbaar zet `sessieContextStoring` aan. Een licht pad gaat door, een zwaar pad krijgt 503 via het bezitsbewijs (`bezitsbewijs.js:118-123`) | `verifier-failclosed:70` | goed |
| **Bezitsbewijs** (`kern/identiteit/bezitsbewijs.js`, stand uit `bezitsstand.js`) | geld, privacy-export en -verwijdering, wachtwoord, passkey, machtigingen | een exceptie geeft **503**, een onbekend toestel **403**. De standaard is **verplicht**, en in productie wordt schaduw ook verplicht | `bezitsbewijs-weerbaar`, `verifier-failclosed:83` | goed. Bevinding: de kop van `bezitsbewijs.js` (r.44) zegt nog "valt terug op `aanbevolen`", maar `bezitsstand.js` zegt verplicht. Dat commentaar loopt achter |
| **Volwassen / A-niveau** (`kern/volwassen.js`, `kern/betrouwbaarheid.js:97-110`) | spellen (Arena, `progressieMag`), lab-paspoort, jeugdbestuur | onleesbare `member_state` geeft `md={}`, dus `leeftijd=null`, dus **`false`**, en niemand weet waarom | **niet gevonden** | dicht, maar **stil**: het lid krijgt "u bent geen 18+" terwijl de kluis hapert |
| **Toestemming per laag** (`kern/consent-lezers.js:68-78`) | Relaties, RTG iD | per laag gevangen, met `storingen[]` in het antwoord | `consent-*` | goed: gedeeltelijk en zichtbaar |
| **Postpoort** (`kern/identiteit/commercieel.js` `mag()`) | elke verzender van marketing | **geen aanroeper gevonden**. De keuze in Post wordt vastgelegd, maar geen verzender vraagt er aantoonbaar naar | `commercieel*` (de keuze zelf) | **gat**: de belofte van Post is niet afgedwongen (par. 11) |
| **Doelpoort** (`kern/identiteit/doelpoort.js`) | alle apps die gegevens voor een doel gebruiken | in de stand schaduw (de standaard) wordt alleen gemeten, en een storing blokkeert nooit. `mag()` heeft **geen aanroeper**, alleen `meter()` | `doelbinding` | gat, bewust nog in de schaduw |
| **Neiging** (`kern/neiging` `lees()`) | `kern/experience/volgorde.js` | valt terug op de onpersoonlijke volgorde, met de uitleg "De voorkeuren waren niet te lezen" | **niet gevonden** | goed gedrag, ongetoetst |
| **Isolatiestand** (`middleware/isolatiepoort-drager.js`) | alle paden met een sessie | een exceptie geeft **503 `ISOLATIE_ONBEPAALD`** als de poort bijt, en productie eist `RTG_ISOLATIE_AFDWINGEN=1` | `isolatiepoort-weerbaar` | goed |
| **Inzagejournaal** (`server/inzagelog-vast.js:75-135`) | kluis-inzage, verificatie, ledenbalie, payroll, vakbewijs | **503** als niet vast is wat vast moet. Een exceptie van de vastlegger zelf wordt niet gevangen | `inzagejournaal-weerbaar` | goed, met één randgeval |
| **Passkey-ceremonie** (`kern/webauthn-ceremonie.js`) | Passkeys, de kantoordeur, zware bevestiging | de uitdaging staat in het RAM van één proces. Na een herstart, of op een ander proces, volgt **400 "verlopen"** | `webauthn*` (één proces) | **gat bij meerdere instances** (par. 5) |

### De keten die elke app van Instellingen nodig heeft, met haar storingen

*Een lid opent een app en doet een zware handeling, bijvoorbeeld een export,
een betaling of een machtiging.*

1. Het token wordt gelezen via `resolveSession` in de kluis.
   - *Storing:* kluis of intreklijst onleesbaar → nu 401 (zie boven); doel: 503
     met "probeer het zo opnieuw", zodat het lid niet opnieuw gaat inloggen.
2. De isolatiestand van de drager wordt gewogen.
   - *Storing:* 503 `ISOLATIE_ONBEPAALD`.
3. Het bezitsbewijs van het toestel wordt gecontroleerd.
   - *Storing:* toestelregister onleesbaar → 503; toestel onbekend → 403, met
     de weg "bevestig dit toestel" (Sessies).
4. Doel en toestemming worden gecontroleerd.
   - *Storing:* doelpoort meet alleen (schaduw); geen blokkade.
5. Leeftijd of niveau, waar de handeling dat vraagt.
   - *Storing:* stil `false` (gat).
6. Inzage wordt in het journaal gezet.
   - *Storing:* 503, en er gebeurt niets.

**Los (andere apps uit).** Elke stap hierboven woont in Instellingen of in de
kluis. Valt een andere app weg, dan heeft dat geen invloed op inloggen, sessies,
passkeys, bescherming of toestemming. Andersom geldt: valt de kluis weg, dan
staat het hele huis stil. Dat is bedoeld, want zonder identiteit is er geen
gebruik (AGENTS.md, besluit van 19 oktober 2026). Dan moet het wel als
**storing** gemeld worden en niet als uitlog.

**Samen (verwijzing, geen overname).** Een app ontvangt een **codenaam-sleutel**
en een **ja of nee**. Hij krijgt nooit naam, geboortedatum of documentnummer.
Dat is de regel die ook voor de gezinsdeur, de codekoppeling en de partijrol
geldt (`server/kern/codekoppel.js`, `server/kern/democratie/partijrol.js`): de
koppeling bewaart de sleutel en de codenaam, nooit de echte naam.

### Vier leveringen die nog niet bestaan en die elke app zou gebruiken (aanbevolen nu)

| # | Levering | Acceptatiecriterium | Kosten |
|---|---|---|---|
| X1 | **Storing ≠ uitlog.** `verifyToken` geeft bij een kluis- of intreklijststoring een eigen uitkomst `onzeker`, en `auth` antwoordt **503 `IDENTITEIT_ONBEPAALD`** in plaats van 401. | Een toets die de intreklijst laat gooien, ziet 503 en géén 401. De client toont "even niet" en wist het token **niet**. | K |
| X2 | **Volwassen met reden.** `volwassen()` geeft naast `false` ook de reden: `geen-account`, `niveau`, `leeftijd-onbekend` of `storing`. | Een toets met een onleesbare `member_state` krijgt `{ok:false, reden:'storing'}`. De Arena toont "even niet te controleren" en niet "u bent geen 18+". | K |
| X3 | **Postpoort afdwingen.** Elke marketingverzender (mail, sms, push) loopt door `commercieel.mag(key, soort, kanaal)`. | Een architectuurtoets: elke aanroep van de mailer met soort ∉ ALTIJD heeft een `mag()`-oordeel in dezelfde keten. Een lid met alles uit krijgt 0 berichten in de mailvanger. | M |
| X4 | **Gedeelde uitdagingsopslag** voor passkeys, in dezelfde opslag als de intreklijst, met dezelfde TTL van 5 minuten en eenmalig gebruik. | Opties op proces A en login op proces B slagen; dezelfde uitdaging twee keer gebruiken faalt. | M |

---

## 2. Het domeinmaximum dat voor alle tien geldt

Een keer opgeschreven, en per app aangehaald met §2.x.

- **§2.1 AVG-rechten.**
  - Een verzoek wordt binnen **één kalendermaand** beantwoord, en kan met
    **2 maanden** verlengd worden als dat binnen de eerste maand gemeld en
    gemotiveerd wordt. Het is kosteloos (art. 12).
  - Inzage (art. 15) betekent een kopie, plus: doelen, categorieën,
    ontvangers, bewaartermijn of criteria, bron, en geautomatiseerde besluiten
    met "zinvolle informatie over de logica".
  - Rectificatie (art. 16).
  - Wissen (art. 17), met uitzonderingen in lid 3, waaronder een wettelijke
    plicht en rechtsvorderingen.
  - Beperking (art. 18).
  - Kennisgeving aan ontvangers (art. 19).
  - Overdraagbaarheid (art. 20): alleen *verstrekte* gegevens, verwerkt op
    toestemming of overeenkomst, in een gestructureerd, gangbaar en
    machineleesbaar formaat. Afgeleide gegevens vallen er waarschijnlijk niet
    onder.
  - Bezwaar tegen direct marketing is **absoluut** (art. 21 lid 2).
  - Art. 22: geen besluit uitsluitend op geautomatiseerde verwerking met
    rechtsgevolg. Een schijnmenselijke toets telt niet (HvJ C-634/21,
    SCHUFA).
  - Intrekken van toestemming moet net zo makkelijk zijn als geven (art. 7 lid 3).
  - Een datalek wordt **binnen 72 uur** bij de AP gemeld, en aan de
    betrokkenen bij een hoog risico (art. 33/34). Elk lek gaat in een intern
    register (art. 33 lid 5).
  - Bronnen: https://gdpr-info.eu/art-15/ · https://gdpr-info.eu/art-18-gdpr/ ·
    https://gdpr-info.eu/art-20-gdpr/ · https://www.convert.com/eu-gdpr/article-12-gdpr/ ·
    https://complydog.com/blog/gdpr-automated-decision-making-article-22.
  - De handleiding van de AP zelf is niet gevonden [U].
- **§2.2 eIDAS 2.0 (Vo. (EU) 2024/1183) en de EUDI-wallet.**
  - Lidstaten bieden rond **eind 2026** een wallet aan.
  - Private partijen die wettelijk sterke authenticatie moeten gebruiken, en
    zeer grote platforms (DSA, meer dan 45 miljoen gebruikers), moeten de
    wallet accepteren, ongeveer vanaf eind 2027 [U].
  - Een relying party registreert zich nationaal en vraagt alleen de
    attributen op die ze geregistreerd heeft.
  - Selectieve onthulling: `age_over_18` zonder geboortedatum.
  - Een pseudoniem mag niet geweigerd worden waar de wet geen identificatie
    eist [U: artikelnummer].
  - **RTG is geen VLOP en waarschijnlijk geen verplichte sector, dus
    acceptatie is een keuze [U, eigen lezing].**
  - De Nederlandse wallet is per oktober 2026 **niet live** gevonden. Brede
    invoering wordt in 2028 verwacht.
  - Bronnen: https://didit.me/blog/eidas-2-compliance-deadlines/ ·
    https://walt.id/eidas2/very-large-online-platforms ·
    https://docs.igrant.io/docs/eu-age-verification/ ·
    https://www.nldigitalgovernment.nl/overview/identity/ ·
    https://www.webpronews.com/eu-age-verification-wallets-privacy-flaw-github-critique-exposes-unproven-claims-ahead-of-2026-rollout/.
- **§2.3 Accountbeveiliging.**
  - NIST SP 800-63B-4 (definitief in juli 2025):
    - Een **synchroniseerbare passkey** telt als AAL2, mits het syncaccount
      zelf AAL2 is.
    - Wachtwoorden: **geen** samenstellingsregels en **geen** periodieke
      wissel, wel een **verplichte check tegen gelekte wachtwoorden**. Minimaal
      15 tekens als enige factor [U: 8 of 15].
    - Herstel loopt via opgeslagen herstelcodes, een vooraf geregistreerd
      adres of herstelcontacten. **Na herstel worden de vervangen
      authenticator, de sessies en de vertrouwde toestellen ingetrokken.**
  - De FIDO Alliance raadt eerst meerdere authenticators aan, en pas daarna
    opnieuw identiteit aantonen.
  - OWASP: een idle-timeout en een absolute timeout, allebei aan de
    serverkant [U: getallen].
  - Bronnen: https://www.corbado.com/blog/nist-passkeys · https://www.enzoic.com/blog/nist-sp-800-63b-rev4/ ·
    https://fidoalliance.org/white-paper-multiple-authenticators-for-reducing-account-recovery-needs-for-fido-enabled-consumer-accounts ·
    https://owasp.org/www-project-web-security-testing-guide/stable/4-Web_Application_Security_Testing/06-Session_Management_Testing/07-Testing_Session_Timeout.
- **§2.4 Communicatie.**
  - Telecommunicatiewet art. 11.7:
    - E-mail en sms voor marketing vragen vooraf een opt-in.
    - Uitzondering voor een bestaande klant met eigen, gelijksoortige
      producten, mits elke boodschap een afmelding bevat [U: tekst lid 3].
  - Cookies vragen toestemming, behalve analytische cookies met weinig impact
    (art. 11.7a).
  - Handhaving: de ACM.
  - Bronnen: https://www.acm.nl/nl/node/11818 · https://overloop.com/nl/blog/koude-acquisitie-wetgeving.
- **§2.5 Profilering en advertenties (DSA).**
  - Art. 26: bij elke advertentie wie, wie betaalde, en de belangrijkste
    parameters ("waarom zie ik dit").
  - Geen advertentie op bijzondere persoonsgegevens.
  - Art. 28: geen advertentie op basis van profilering aan een minderjarige.
  - Art. 38: een niet-geprofileerde aanbeveler is alleen voor een VLOP
    verplicht.
  - Bronnen: https://streamlex.eu/articles/dsa-en-art-26/ · https://presencis.com/regulations/dsa/article-28/ ·
    https://www.springlex.eu/en/packages/dsa/dsa-regulation/article-38/.
- **§2.6 Voorwaarden wijzigen.**
  - Art. 6:237 sub c BW (grijze lijst).
  - Richtlijn 93/13: transparantie.
  - Richtlijn digitale inhoud 2019/770, art. 19: bij een meer dan geringe
    negatieve wijziging een vooraankondiging op een duurzame drager, en
    kosteloos opzeggen binnen **30 dagen**.
  - Bronnen: https://www.legislation.gov.uk/eudr/2019/770/article/19/2020-01-31 (VK-kopie) ·
    https://lawandmore.eu/amendment-clauses-general-terms-and-conditions/.
  - Art. 6:236 sub i BW (prijsverhoging binnen 3 maanden) [U].

---
## 3. Ik — "Wie ben ik" (`apps/ik.html` · `instellingen.profiel`)

**Doel.** Hoe RTG mij aanspreekt en bedient: aanhef, voornaamwoord, levensfase, omgang, toegankelijkheid en levensbeschouwing. Het is ook de ingang naar de andere acht apps.

**a. Bewezen bestaand.**
- Routes `/api/ik`, `/zet`, `/geloof`, `/toegankelijk/zet` en `/vandaag` in `server/routes/ik.js`.
  - Opslag in de versleutelde `member_state` van de kluis (`server/accounts/dossier.js`).
  - Zonder `req.session.account` geeft elke route 403.
  - Een minderjarige kan alleen de fase `kind` of `scholier` kiezen. "plagerig" wordt onder 18 geweigerd en niet opgeslagen.
- Registers:
  - Bewijs 1, 3, 4, 5 en 7 staan op **B** (VOLTOOIPROEF `ik.js`, 5/5, 3/3 en 4/4).
  - Bewijs 2 staat op **NG**: 7 van 19 eigen knoppen gemeten, 3 niet aantikbaar.
  - Bewijs 8 staat op **NG**: het scenario lokte geen weigering uit.
  - Bewijs 6 staat op **NG**: 3 van 12 routes open, namelijk `/api/veiligheid/kring/mail`, `/kring/toevoegen` en `/plek`.
  - Volwassenheid in de catalogus: **L3**, module `profile`.
- Niet in het scenario: geloof, workspace en de veiligheidskring.
- De handvoorkeur staat alleen in localStorage en een cookie (`shared/hand.js`), dus niet op de server en niet op het volgende toestel.

**b. Markt.**
- **Google:** persoonlijke info met zichtbaarheid per veld (iedereen / sommigen / alleen ik). https://support.google.com/accounts/answer/15781205
- **Apple:** een geboortedatum wijzig je één keer, met 24 uur om te herstellen; onder 13 is gezinsgoedkeuring nodig. https://support.apple.com/en-us/102473
- **Microsoft:** een kindaccount wordt alleen door de instemmende ouder bewerkt. https://support.microsoft.com/en-us/account-billing/how-to-change-a-birth-date-on-a-microsoft-account-837badbc-999e-54d2-2617-d19206b9540a
- Geen van de drie heeft een aanhef of aanspreekvorm per relatie, en geen van de drie heeft levensbeschouwing.
- Het duurste pakket in deze klasse is de profielkant van een enterprise-IdP (Okta, Entra): attributen worden naar applicaties doorgezet met per-app mapping [U, geen bron opgevraagd].

**c. Domein.**
- AVG art. 5 lid 1 sub d (juistheid) en art. 16 (rectificatie): zie §2.1.
- Levensbeschouwing is een bijzonder persoonsgegeven (art. 9 AVG). Het mag alleen met uitdrukkelijke toestemming en mag nooit voor advertenties gebruikt worden (DSA art. 26 lid 3, §2.5).
- Toegankelijkheid is een productplicht en geen voorkeur: `TOEGANKELIJK.md`.
- Het volledige werkgebied is meer dan "profiel". Het gaat om **hoe een mens over alle apps heen benaderd wil worden**, in welke hoedanigheid, en welke van die hoedanigheden zichtbaar zijn voor wie.

**d. Functiecatalogus.**

| # | Functie | L | St | Bron | Gegevens · regels · rekenwijze · onzekerheid · melding · rollen · uitzondering | Acceptatie | K | Bak |
|---|---|---|---|---|---|---|---|---|
| I1 | Aanhef, voornaamwoord, fase, omgang | L1 | B | `routes/ik.js`, kluis | `member_state`. Een minderjarige heeft een beperkte keuze. Alleen het lid zelf beheert dit. | bestaat (VOLTOOIPROEF) | — | — |
| I2 | Toegankelijkheid op elk toestel | L1 | H | `kern/toegankelijk.js`, `shared/hand.js` | De hand naar `member_state.toegankelijk`, net als de rest. localStorage blijft de cache. Bij een conflict wint de server en zegt dat. | Op toestel A links kiezen, op toestel B inloggen: de bediening staat links zonder opnieuw te kiezen. | K | Nu |
| I3 | Bewijs 2 en 8 sluiten | — | H | APPWERKT | De 12 ongemeten knoppen en de 3 niet-aantikbare knoppen. Een weigering uitlokken in het scenario. | APPWERKT: bewijs 2 en 8 op B voor `link:ik` | K | Nu |
| I4 | Zichtbaarheid per veld | L1/L6 | O | — | Per veld (aanhef, voornaamwoord) kiest het lid wie het ziet: *alleen RTG*, *mijn kring*, *zaken waar ik klant ben*. Een andere app krijgt het veld via een lezer `aanspreekVoor(key, ontvanger)`, nooit als kopie. De standaard is alleen RTG. | Een zaak in Horeca ziet de aanhef alleen als het lid "zaken" aanzette. Uitzetten werkt meteen: de volgende lezing geeft niets. | M | Later |
| I5 | Mijn hoedanigheden | L2/L3/L6 | O | `kern/vakbewijs.js`, werkruimtelid (`TENANT.md` §2), `codekoppel.js`, `democratie/partijrol.js` | Een **alleen-lezen** overzicht van elke rol die dit account draagt: werkruimtelid per org, vakbewijs (met vervaldatum), partijrol, codegekoppelde dossiers en gezinseigenaar. Een regel per rol, met bron-app, sinds wanneer en "losmaken bij" (een verwijzing naar de eigenaar). Er komt geen nieuw object: het is een projectie, en elke bron levert een lezer. De onzekerheid wordt per bron getoond (`aanwezig:null` bij een storing, zoals de gegevenskaart doet). | Een lid met een partijrol en een codekoppeling ziet allebei, met een werkende link naar de plek van losmaken. Na losmaken bij de bron verdwijnt de regel. | M | Nu |
| I6 | Wijzigingsgeschiedenis profiel | L5 | O | — | Een append-only regel per wijziging (veld, oud → nieuw als dat geen bijzonder gegeven is, anders alleen "gewijzigd"), in `member_state`, maximaal 200 regels, zoals Post doet. | Na drie wijzigingen ziet het lid drie regels. Bij geloof staat er "gewijzigd" en geen inhoud. | K | Later |
| I7 | Geboortedatum wijzigen met regel | L1/L5 | H | `md.geboren`, `geborenBron` | Een opgegeven datum is vrij te wijzigen tot verificatie. Na `geborenBron=paspoort` kan het lid hem niet meer zelf wijzigen; dan loopt het via rectificatie (G6). Elke wijziging die de 18+-grens kruist, wordt gelogd. | Na verificatie geeft een poging tot wijzigen 409 met de weg naar rectificatie. | K | Nu |
| I8 | Levensbeschouwing nooit naar advertenties | L4 | H | `kern/geloof` | Een architectuurtoets: geen lezer van het geloofprofiel in een commercieel of aanbevelend pad. | De toets faalt als `commercieel` of `experience/volgorde` het geloofprofiel leest. | K | Nu |
| I9 | Kind- en gezinsprofielen beheren | L3 | B (bij Foundation) | gezinseigenaar | Blijft bij de gezinsdeur. Ik verwijst er alleen naar. | — | — | Niet: de eigenaar is FoundationOS (SCHERMEIGENAAR). Een kopie zou een tweede beheerplek maken. |

**e. RTG-exclusief.** *Mijn hoedanigheden* (I5): op één plek alle petten die je in RTG draagt, over 114 apps heen, zonder dat er een vierde identiteitsmodel bijkomt. Geen marktleider heeft dit, omdat geen enkele marktleider tegelijk werkgever, partij, stichting en zaak is.

**f. Bouwstenen en ontbrekende koppelingen.**
- Bestaand:
  - kluis `member_state`
  - `kern/vakbewijs.js`
  - `codekoppel.koppelingVan`
  - `partijrol.vanAccount`
  - het tenantregister
- Ontbreekt:
  - een lezer per bron "rollen van deze sleutel"
  - `aanspreekVoor()`

**g. Prioritering.** Eerst I3 (K), I2 (K), I7 (K) en I8 (K). Daarna I5 (M, hangt aan een lezer per bron). Daarna I4 en I6.

**(A)** is I1 t/m I8 binnen de huidige schil. **(B)** voegt toe:
- Hoedanigheden die door derden zijn bevestigd en uit een EUDI-wallet komen: een beroepsattestatie (QEAA, §2.2) in plaats van een handmatig vakbewijs.
- Een aanspreekvorm per relatie, die over de grenzen van RTG heen meegaat via de wallet.

**Keten (los).** Het lid zet "u" en de aanhef. Elke tekst in Ik leest dat meteen.
- *Storing:* kluis onleesbaar → nu 401 (zie X1); doel: 503 met "uw instellingen zijn zo terug".

**Keten (samen).** Het lid zet de fase op "scholier". Arena en School lezen de fase via de leeftijdspoort en niet via een kopie.
- *Storing:* `member_state` onleesbaar → `volwassen()` stil `false` (X2).

**h. Eindcontract Beyond Premium (Ik).**

| Dimensie | Toetsbaar als |
|---|---|
| Breedte | I1–I8 bestaan, en I5 toont minstens vijf soorten rol |
| Professionele diepte | vakbewijs en partijrol zijn zichtbaar met vervaldatum en bron |
| Levenscyclus | wijzigen, vastzetten na verificatie, rectificatie en geschiedenis, allemaal met een toets |
| Samenwerking en rollen | ouder en kind via de gezinsdeur, aantoonbaar zonder tweede beheerplek |
| Domeinintelligentie | fase en leeftijd sturen de keuzes, en I8 bewaakt het bijzondere gegeven |
| Los functioneren | met alle andere apps uit blijven I1–I7 werken (toets met een gestubde wereld) |
| RTG-ketens | `aanspreekVoor` wordt door minstens één app gelezen en ingetrokken |
| Bewezen betrouwbaarheid | de acht bewijzen op B (nu 2, 6 en 8 open) |

---

## 4. Gegevens — "Wat weet RTG van mij" (`apps/mijn-gegevens.html` · `privacy.gegevens`)

**Doel.** De inzage volgens art. 15: welke gegevens RTG over mij heeft, waarvoor, hoe lang, en wat er gebeurt als ik vertrek.

**a. Bewezen bestaand.**
- `/api/mijn/gegevens` → `kern/identiteit/gegevenskaart.js`.
  - Dat bevraagt gegevenssoorten, peiling, termijn en doelen.
  - De kaart bewaart zelf niets. Een peiling die faalt, staat als `aanwezig:null` met een reden, nooit als "nee".
- `/api/privacy/opnieuw` → `kern/opnieuwbeginnen.js`.
- Export via `/api/privacy/export` (in `app.html`).
  - Geeft JSON **in het antwoord**, dus geen bestand.
  - Inhoud: `profile`, `cv`, `applications`, `invoices`, `trip`, `live`, `orders`, `guestChats`, `likedPosts`, `notifications`, `foundationGezin`, boardroom (200), handelingen (500) en `inzageInUwDossier`.
- Verwijderen via `/api/privacy/delete` → `kern/vergeten.js` `wisLid`.
  - Wist of anonimiseert tientallen collecties (`vergeten/positie`, `eigen`, `gesprekken`, `anoniem`, `bytes`, `account` en `sporen`).
  - Het inzagejournaal blijft bewust staan.
  - De route heeft **geen try/catch**. Een ontbrekende module in `positie.js` gooit, en dan wordt de rest niet gewist.
- Registers:
  - Bewijs 1–5, 7 en 8 staan op **B** (VOLTOOIPROEF `gegevens.js`).
  - Bewijs 6 staat op **NG**: 6 van 14 routes open.
  - Niet in het scenario: `/api/privacy/delete`, WebAuthn en het intrekken van een toestel.

**b. Markt.**
- **Google:** My Activity met automatisch wissen na 3, 18 of 36 maanden. Takeout exporteert per product, met een keuze van formaat. https://support.google.com/accounts/answer/465 (de hulppagina van Takeout zelf niet gevonden [U])
- **Apple:** privacy.apple.com heeft drie knoppen: een kopie per categorie (klaar binnen ongeveer een week), tijdelijk deactiveren, en definitief verwijderen met een toegangscode. https://support.apple.com/en-us/102283
- **Meta:** Accounts Center. Een export in HTML of JSON met wachtwoord. Verwijderen kent een **bedenktijd van 30 dagen**. https://www.facebook.com/help/212802592074644
- **Microsoft:** een privacydashboard per categorie: bekijken, downloaden en wissen. https://support.microsoft.com/en-us/privacy/access-your-account-privacy-settings
- **Duurste pakketten:** DSAR-automatisering (OneTrust, Transcend) koppelt verzoeken aan elk systeem, met termijnbewaking [U, geen bron opgevraagd].

**c. Domein.** §2.1 helemaal.
- De termijn is één maand.
- Art. 15 vraagt meer dan "welke soorten": ook ontvangers, bron en geautomatiseerde besluiten.
- Art. 20 gaat alleen over verstrekte gegevens.
- Art. 17 lid 3 kent uitzonderingen. Het inzagejournaal en de boekhouding zijn wettelijke plichten.
- Art. 19 vraagt dat ontvangers op de hoogte worden gebracht.
- Het volledige werkgebied is dus een **verzoekdossier met een klok**, en geen scherm.

**d. Functiecatalogus.**

| # | Functie | L | St | Bron | Gegevens · regels · rekenwijze · onzekerheid · melding · rollen · uitzondering | Acceptatie | K | Bak |
|---|---|---|---|---|---|---|---|---|
| G1 | Kaart per soort met doel en termijn | L1 | B | `gegevenskaart.js` | Per soort: aanwezig, doel en termijn. Een storing is `null` met een reden. | bestaat | — | — |
| G2 | Art. 15 compleet: ontvangers, bron, geautomatiseerde besluiten | L4 | H | `gegevenssoorten`, `doelen` | Per soort twee extra velden: `ontvangers[]` (soorten ontvanger, zoals "de zaak waar u bestelde" of "betaaldienst") en `bron` (zelf gegeven, afgeleid of van derden). Een vlag `geautomatiseerd` met een zin uitleg. Ontbreekt een veld in het register, dan staat er "niet ingedeeld" en nooit niets. | Elke soort in `gegevenssoorten` heeft `ontvangers` en `bron`, of de toets faalt. Het scherm toont "niet ingedeeld" voor een lege soort. | M | Nu |
| G3 | Export als bestand, en compleet | L1/L5 | H | `privacy.js:33-95`, `vergeten/*` | Twee bestanden: (1) **inzage**, alles, JSON en leesbare HTML; (2) **overdraagbaar** (art. 20), alleen de verstrekte gegevens, JSON. Regel: elke collectie die `wisLid` raakt, staat in de export **of** in een lijst "niet exporteerbaar, omdat …" (bijvoorbeeld media te groot: een aparte download). Het is een zwaar pad met bezitsbewijs, wat al zo is. | Een architectuurtoets vergelijkt de collecties uit de wislijst met de exportlijst en de uitzonderingslijst; elke collectie staat in een van beide. | M | Nu |
| G4 | Verwijderen met bedenktijd | L5 | O | `wisLid` | De stand `opgezegd` blokkeert inloggen. Na 30 dagen draait `wisLid`, en tot dan kan het lid annuleren (de 30 dagen van Meta; Apple is korter). Art. 17 zegt "zonder onredelijke vertraging", en een bedenktijd die het lid zelf kiest, is daarmee verenigbaar [U, eigen lezing: juridisch toetsen]. Melding via Post (verplicht bericht) bij de start en een dag voor het wissen. | Na een verzoek kan het lid niet inloggen. Na annuleren werkt alles weer. Na 30 dagen is het gewist (een toets met een klok). | M | Later (eigenaarskeuze: direct of met bedenktijd) |
| G5 | Wissen heel of hervat | L5 | H | `kern/vergeten.js` | `wisLid` als taak met stappen. Een stap die faalt, laat een hervatbare taak achter. Het lid ziet "deels gewist, wordt afgerond". Het kantoor ziet de taak. | Een toets die `positie.js` laat gooien: de andere stappen lopen door, de taak staat open, en een herstart rondt af. | M | Nu |
| G6 | Rectificatieverzoek (art. 16) | L5 | O | — | Voor velden die het lid niet zelf mag wijzigen (geboortedatum na verificatie, of een gegeven van derden): een verzoek met een reden. Een mens van RTG beslist, met een **klok van één maand** (verlengen alleen met een reden). | Een verzoek staat open met een vervaldatum. Na 1 maand zonder besluit kleurt het kantoor rood. | M | Later |
| G7 | Verzoekdossier met wettelijke klok | L3/L5 | O | — | Elk verzoek (inzage, rectificatie, wissen, beperking, bezwaar) krijgt een datum, een termijn van 1 maand, en `verlengd` (+2 maanden, met reden, gemeld binnen de eerste maand). Alleen het lid en het kantoor kunnen het zien. | De rekenwijze van de termijn heeft een eigen toets: indienen op 31 januari geeft een vervaldag van 28 of 29 februari (kalendermaand). | M | Later |
| G8 | Ontvangers informeren (art. 19) | L6 | O | `codekoppel`, partnerkanaal | Bij wissen of rectificeren gaat er een signaal naar elke zaak die gegevens via een verwijzing ontving, via het bestaande partnerkanaal. Zonder adres van de zaak komt er een regel "niet te bereiken" in het dossier. | Na wissen heeft elke zaak met een koppeling een melding of een regel "niet te bereiken". | G | Later |
| G9 | Beperking (art. 18) | L5 | O | — | Een vlag per soort: `beperkt`. De doelpoort (`doelpoort.js`) weigert dan elk doel behalve bewaren en rechtsvordering. Dit hangt aan X-doelpoort uit de schaduw. | Met `beperkt` geeft een lezer met doel `tonen` "geweigerd". | M | Later |
| G10 | Lekmelding aan betrokkene (art. 34) | L5 | O (niet onderzocht) | — | Er moet eerst gemeten worden of er een lekregister bestaat. Dat is in dit onderzoek niet gezocht. | — | — | Later (eerst meten) |

**e. RTG-exclusief.** De kaart polst de eigenaars en kopieert niet. Daardoor kan RTG **per gegeven zeggen of het er is, waarom, en hoe zeker dat is**, met een storing als `null` en niet als "nee". Samen met G3 wordt dat een export die bewijsbaar compleet is. De markt belooft dat niet.

**f. Bouwstenen en ontbrekende koppelingen.**
- Bestaand: `gegevenskaart`, `vergeten/*`, de exportroute en de bewaarveger.
- Ontbreekt:
  - een register "collectie → soort → exporteerbaar"
  - een taakvorm voor `wisLid`
  - het verzoekdossier
  - de velden ontvangers en bron

**g. Prioritering.** G5 (wissen heel), G3 (export compleet) en G2 (art. 15 compleet): deze drie sluiten wettelijke gaten. Daarna G7, G6, G4, G9 en G8.

**(A)** is G1–G7 en G9. **(B)** is G8 met alle ontvangers automatisch, plus een export rechtstreeks naar een andere aanbieder (art. 20 lid 2) of naar de EUDI-wallet (§2.2).

**Keten (los).** Het lid opent de kaart.
- *Storing:* een eigenaar-app (bijvoorbeeld Reizen) faalt → die soort staat op `aanwezig:null` met de reden. De rest verschijnt gewoon. Dit bestaat al.

**Keten (samen).** Het lid wist zijn account. Reizen, Horeca en Foundation verliezen de gegevens die aan zijn sleutel hingen.
- *Storing:* een module ontbreekt → nu stopt het wissen halverwege (G5 lost dat op).

**h. Eindcontract (Gegevens).**

| Dimensie | Toetsbaar als |
|---|---|
| Breedte | elke collectie die `wisLid` raakt, staat op de kaart (een architectuurtoets) |
| Professionele diepte | art. 15: doel, ontvangers, termijn, bron en geautomatiseerde besluiten per soort |
| Levenscyclus | inzage, export, rectificatie, beperking en wissen, met een klok van 1 maand en elk met een toets |
| Samenwerking en rollen | het kantoor ziet verzoeken en nooit de inhoud zonder een journaalregel |
| Domeinintelligentie | de termijnberekening is getoetst (kalendermaand, verlenging) |
| Los functioneren | de kaart verschijnt ook als de helft van de eigenaars faalt |
| RTG-ketens | wissen bereikt elke eigenaar, of laat een hervatbare taak achter |
| Bewezen betrouwbaarheid | de acht bewijzen op B, en VOLTOOIPROEF dekt ook delete en export |

---

## 5. Sessies — "Waar ben ik aanwezig" (`apps/mijn-sessies.html` · `account.sessies`)

**Doel.** Zien waar mijn account open staat, hoe zeker dat is, en sluiten wat ik niet vertrouw.

**a. Bewezen bestaand.**
- `/api/mijn/sessies`, `/sluit` en `/sluit-overige` (`routes/member/sessies.js`).
- `/api/mijn/toestel/uitdaging` en `/bind` (`toestellen.js`).
- `/noem` en `/introk` bestaan wel, maar het scherm **roept ze niet aan**.
- Opslag:
  - `sessiecontext`, zonder token en zonder persoonsgegevens
  - `toestelregister`
  - de intreklijst
- Elke sluiting komt in het handelingsspoor.
- "Sluit alle andere" laat de huidige sessie open.
- Een sessie zonder sid staat niet in de lijst. Daarvoor is het advies "wijzig uw wachtwoord".
- Levensduur:
  - Het token is **absoluut 30 dagen** (`tokens.js:64`).
  - Er is **geen idle-timeout**.
  - Het register vervalt glijdend na 30 dagen (`sessieregister.js:43`).
- Registers:
  - Bewijs 1–5, 7 en 8 staan op **B**.
  - Bewijs 2 staat op 3/4: één knop overgeslagen omdat hij onomkeerbaar is.
  - Bewijs 6 staat op **NG**: 8 van 17 routes open, waaronder `/toestel/bind`.

**b. Markt.**
- **Google:** "Your devices" toont het toestel, de browser, de laatste activiteit en een plaats, met "Don't recognize this device?" → afmelden plus wachtwoord (officiële pagina niet gevonden [U]).
- **Apple:** apparaten verwijderen, en dan houden iCloud, Zoek mijn en de 2FA-codes op dat apparaat op. https://support.apple.com/en-us/102649
- **Microsoft:** een activiteitenpagina over 30 dagen met "This wasn't me". https://support.microsoft.com/en-us/accounts-billing/security/what-is-the-recent-activity-page
- **WhatsApp:** een gekoppeld apparaat valt af na 30 dagen inactiviteit. https://faq.whatsapp.com/834124628020911/

**c. Domein.**
- §2.3: na herstel worden de sessies en de vertrouwde toestellen ingetrokken.
- OWASP vraagt een idle-timeout en een absolute timeout aan de serverkant [U getallen].
- Het volledige werkgebied is meer dan een lijst. Het gaat om **"was dit ik?"** als ingang voor een overname-respons.

**d. Functiecatalogus.**

| # | Functie | L | St | Bron | Gegevens · regels · rekenwijze · onzekerheid · melding · rollen · uitzondering | Acceptatie | K | Bak |
|---|---|---|---|---|---|---|---|---|
| S1 | Lijst, sluiten, alle andere sluiten, toestel binden | L1 | B | `sessies.js`, `toestellen.js` | zie (a) | bestaat | — | — |
| S2 | Toestel intrekken en hernoemen vanuit het scherm | L1 | H | `/toestel/introk`, `/noem` | De routes bestaan en vallen onder het bezitsbewijs. Alleen de knoppen ontbreken. | In het scherm een toestel intrekken: de sessies erop vallen af (VOLTOOIPROEF-schakel). | K | Nu |
| S3 | "Dit was ik niet" | L5/L6 | O | S1, Bescherming, wachtwoord | **Eén** keten: (1) sluit die sessie en trek het toestel in; (2) zet Bescherming op `waakzaam` (alleen verstrengen, dat mag al); (3) vraag om een nieuw wachtwoord of een passkey-bevestiging; (4) bevestiging via Post (een beveiligingsbericht kan niet uit). Bij een storing in stap 2 of 3 blijft stap 1 staan, en het lid ziet welke stap nog open is. | Na de knop: de sessie is dicht, de stand is `waakzaam`, en er zit een bericht in de mailvanger. Een toets met een storing in stap 2 laat stap 1 staan en meldt "nog niet beschermd". | M | Nu |
| S4 | Inactiviteitsverval | L4/L5 | O | `sessieregister` `laatst` | Een sessie die N dagen niet gebruikt is, vervalt: `verifyToken` weigert als `nu − laatst > N`. **N is een eigenaarsbesluit**; een voorstel is 30 dagen (gelijk aan WhatsApp). De onzekerheid zit in de lees-storing van het register, en die valt onder X1 (503 en niet door). | Een toets met een verschoven klok: na N+1 dagen zonder gebruik 401 met de reden `inactief`. | K | Nu (na de keuze van N) |
| S5 | Recente activiteit | L1/L4 | H | `kern/identiteit/inlogherkomst.js` | De laatste 30 dagen aan inlogpogingen: wanneer, ongeveer waar en welk toestel, uit inlogherkomst (welke velden die bewaart, is niet gemeten). Er komen geen IP-adressen in beeld. | Het lid ziet een mislukte poging van gisteren met "dit was ik niet" ernaast (S3). | M | Later |
| S6 | Bericht bij een nieuw toestel | L5 | O (niet onderzocht) | Post | Of dit al bestaat, is niet gemeten. Voorstel: een beveiligingsbericht (verplicht) bij elke nieuwe binding. | Binden op een nieuw toestel geeft één bericht in de mailvanger. | K | Later (eerst meten) |
| S7 | Bewijs 6 sluiten | — | H | BEVOEGD | De 8 open routes in de IDOR-meting. | BEVOEGD: `link:sessies` op BEWEZEN | K | Nu |

**e. RTG-exclusief.** De zekerheidsgraad per veld ("hoe zeker is het dat dit toestel is wie het zegt") staat al in het scherm. Gekoppeld aan S3 en Bescherming wordt "was ik dit niet?" een complete overname-respons in één keten, over drie apps heen. Elders is dat drie losse pagina's.

**f. Bouwstenen en ontbrekende koppelingen.**
- Bestaand: het sessieregister, toestellen, de intreklijst, isolatie (alleen verstrengen) en inlogherkomst.
- Ontbreekt:
  - een sessie → Bescherming-keten (S3)
  - `laatst` als weigergrond (S4)
  - de knoppen voor S2

**g. Prioritering.** S2 (K), S7 (K), S4 (K, na de keuze van N), S3 (M), S5, S6.

**(A)** is S1–S7. **(B)** voegt toe:
- risicogebaseerd herauthenticeren (een nieuw land of een nieuw toestel vraagt een passkey)
- sessies van een EUDI-wallet-login met eigen zekerheid (§2.2)

**Keten (los).** Het lid sluit een verdachte sessie.
- *Storing:* de intreklijst is niet beschrijfbaar → nu `INTREKOPSLAG_ONZEKER`, het lid krijgt een fout en geen nep-"ok". Dat is goed (`intreklijst.js:248`).

**Keten (samen).** "Dit was ik niet" (S3) raakt Sessies, Bescherming en Post.
- *Storing:* Post is uit → het bericht komt in de wachtrij; de sluiting staat al.

**h. Eindcontract (Sessies).**

| Dimensie | Toetsbaar als |
|---|---|
| Breedte | S1–S3 en S5 bestaan |
| Professionele diepte | de zekerheid per veld, en inactiviteitsverval met een eigenaars-N |
| Levenscyclus | binden, hernoemen, sluiten, intrekken en verval, elk getoetst |
| Samenwerking en rollen | geen rol behalve het lid; het kantoor sluit via een eigen route met een journaalregel |
| Domeinintelligentie | "dit was ik niet" zet de beschermstand en vraagt herauthenticatie |
| Los functioneren | sluiten werkt met Post en Bescherming uit |
| RTG-ketens | S3 is getoetst over drie apps |
| Bewezen betrouwbaarheid | de acht bewijzen op B, en VOLTOOIPROEF dekt ook "sluit alle andere" en intrekken |

---

## 6. Passkeys (`apps/passkeys.html` · `account.passkeys`)

**Doel.** Inloggen zonder wachtwoord, en passkeys toevoegen en weghalen.

**a. Bewezen bestaand.**
- `/api/webauthn/registreer/opties`, `/registreer`, `/lijst`, `/weg`, `/opties`, `/login` en `/bevestig/opties` (`routes/auth/webauthn.js`).
- Er worden alleen publieke sleutels en tellers bewaard (`webauthn`, `webauthnSpoor`), met **een maximum van 8 per account**.
- De eerste passkey vraagt het huidige wachtwoord. Een volgende vraagt een verse passkey-bevestiging.
- Weghalen is een zwaar pad (`passkey-weg`).
- **Herstel bij verlies: niet gevonden.** Er is alleen een wachtwoord plus "wachtwoord vergeten" per e-mail, met een sms-code als er een telefoon is (`routes/auth/herstel.js`).
- De uitdaging staat in het RAM van één proces (zie X4).
- Registers:
  - Bewijs 1, 2 en 4 staan op **B**.
  - Bewijs 3, 5 en 7 staan op **GF**: er is geen VOLTOOIPROEF-scenario.
  - Bewijs 6 staat op **NG**: alle 5 webauthn-routes zijn onbereikbaar in IDOR.
  - Bewijs 8 staat op **NG**.

**b. Markt.**
- **Google:** passkeys en sleutels in een lijst. Een verdachte passkey wordt uitgezet en na 30 dagen gewist. https://support.google.com/accounts/answer/13548313
- **Apple:** iCloud Keychain met end-to-end versleutelde sync, en de app Wachtwoorden. https://support.apple.com/en-us/120758
- **Microsoft:** een nieuw account is standaard wachtwoordloos (2025), en het wachtwoord kan helemaal weg. https://www.microsoft.com/en-us/security/blog/2025/05/01/pushing-passkeys-forward-microsofts-latest-updates-for-simpler-safer-sign-ins/
- **Duurste pakketten:** een wachtwoordmanager voor gezinnen en teams (1Password, Bitwarden) met nooddeling en herstelsets [U, geen bron opgevraagd].

**c. Domein.**
- §2.3: een synchroniseerbare passkey is AAL2, en een toestelgebonden passkey kan AAL3 zijn.
- Herstel loopt via herstelcodes, een vooraf geregistreerd adres of herstelcontacten, en na herstel wordt alles ingetrokken.
- De FIDO Alliance zegt: eerst meerdere authenticators, dan pas opnieuw identiteit aantonen.

**d. Functiecatalogus.**

| # | Functie | L | St | Bron | Gegevens · regels · rekenwijze · onzekerheid · melding · rollen · uitzondering | Acceptatie | K | Bak |
|---|---|---|---|---|---|---|---|---|
| P1 | Toevoegen, lijst, weghalen, inloggen | L1 | B | `webauthn*.js` | zie (a) | bestaat (bewijs 1, 2, 4) | — | — |
| P2 | VOLTOOIPROEF-scenario | — | O | — | Een virtuele authenticator in Playwright (Chromium ondersteunt dat) voor toevoegen, inloggen en weghalen. | VOLTOOIPROEF heeft `passkeys` met bewijs 3, 5 en 7 gesloten | K | Nu |
| P3 | Bewijs 6: IDOR voor webauthn | — | O | IDOR | Persona B probeert de passkey van A weg te halen of op te sommen. | IDOR: `/api/webauthn/weg` en `/lijst` staan op `gescheiden` | K | Nu |
| P4 | Gedeelde uitdaging | L5 | O | X4 | zie §1 | zie X4 | M | Nu |
| P5 | Herstelcodes | L5 | O | — | 10 codes voor eenmalig gebruik, gehasht (sha256 met zout) in de eigencollectie `webauthn`, één keer getoond. Een code gebruiken: (1) inloggen; (2) **alle** sessies en toestellen intrekken; (3) Bescherming op `waakzaam`; (4) een beveiligingsbericht via Post; (5) "nieuwe passkey nu". Nieuwe codes maken maakt de oude ongeldig. Codes maken is een zwaar pad. | Code 1 werkt één keer. Na het gebruik zijn alle andere sessies dicht en staat er een bericht in de mailvanger. Code 1 opnieuw gebruiken geeft 401. | M | Nu |
| P6 | Tweede passkey aanmoedigen | L4 | O | `/lijst` | Na de eerste passkey een zin: "voeg er een toe op een ander toestel". De lijst toont het soort per passkey (synchroniseerbaar of toestelgebonden) als de authenticator dat meldt; is dat onbekend, dan staat er "onbekend". | Een lid met één passkey ziet de aanmoediging. Met twee ziet hij hem niet meer. | K | Later |
| P7 | Wachtwoordloos | L1/L5 | O | — | Het wachtwoord kan weg **alleen** als er ≥ 2 passkeys zijn **en** herstelcodes (P5). Daarna geeft "wachtwoord vergeten" geen link maar een verwijzing naar de herstelcodes. | Zonder P5 is de knop uit, met een reden. | M | Later |
| P8 | Bericht bij een nieuwe of weggehaalde passkey | L5 | O | Post | Een beveiligingsbericht kan niet uit. | Toevoegen geeft één bericht in de mailvanger. | K | Later |
| P9 | Herstelcontacten (iemand uit de kring keurt herstel goed) | L6 | O | Relaties, Veilig-kring | NIST noemt herstelcontacten. Een vertrouwd contact (dat al een sociale connectie is) bevestigt herstel. Het contact ziet nooit iets van het account. | — | G | Later (B): het risico op sociale manipulatie vraagt een eigen dreigingsanalyse |
| P10 | Een gedeelde passkey met een gezinslid | — | — | — | — | — | — | Niet: een account is een mens (TENANT §2). Delen ondermijnt het bezitsbewijs; voor gezinnen bestaat de gezinsdeur. |

**e. RTG-exclusief.** Herstel is een keten met Sessies, Bescherming en Post (P5). Na herstel weet het hele huis het meteen, en de beschermstand gaat vanzelf omhoog. Dat volgt NIST letterlijk en is in één beweging te toetsen.

**f. Bouwstenen en ontbrekende koppelingen.**
- Bestaand: `webauthn-ceremonie` en `herbevestiging`. Het bezitsbewijs leidt de toestelsleutel af van de passkey (`isolatie/apparaatsleutel.js`).
- Ontbreekt:
  - een gedeelde uitdaging
  - herstelcodes
  - de keten herstel → intrekken → bescherming

**g. Prioritering.** P2, P3 (K, het bewijs), P4 (M, meerdere instances), P5 (M), daarna P6, P8, P7 en P9.

**(A)** is P1–P8. **(B)** voegt toe:
- herstelcontacten (P9)
- een EUDI-wallet als herstelbron (identiteit opnieuw aantonen met PID, §2.2)
- toestelgebonden passkeys voor medewerkers als AAL3-eis

**Keten (los).** Het lid logt in met een passkey.
- *Storing:* een herstart tussen opties en login → nu 400 "verlopen". Het lid probeert opnieuw en het lukt. Met meerdere instances zou het steeds kunnen falen (X4).

**Keten (samen).** Het lid verliest zijn telefoon en gebruikt een herstelcode (P5). Sessies, Bescherming en Post doen elk hun stap.
- *Storing:* Bescherming is onbepaald → 503 en geen half herstel. De code wordt pas verbruikt als de keten heel is (transactie, zoals `codekoppel.roteer`).

**h. Eindcontract (Passkeys).**

| Dimensie | Toetsbaar als |
|---|---|
| Breedte | P1, P5, P6 en P7 |
| Professionele diepte | het soort passkey is zichtbaar, en het wachtwoordloze pad is begrensd door P5 |
| Levenscyclus | toevoegen → gebruik → verlies → herstel → nieuw, elk getoetst |
| Samenwerking en rollen | geen gedeelde passkeys (P10), en de kantoordeur gebruikt dezelfde ceremonie |
| Domeinintelligentie | NIST: alles intrekken na herstel |
| Los functioneren | inloggen werkt met alle andere apps uit |
| RTG-ketens | herstel zet Sessies, Bescherming en Post in één transactie |
| Bewezen betrouwbaarheid | de acht bewijzen op B (nu 3, 5, 6, 7 en 8 open), plus een toets met meerdere instances |

---

## 7. Verificatie — "Laten zien wie u bent" (`apps/verificatie.html` · `identiteit.verificatie`)

**Doel.** Mijn identiteit en leeftijd laten zien. Een mens van RTG beoordeelt dat, en het niveau komt in het hele huis te gelden.

**a. Bewezen bestaand.**
- `/api/verify/status`, `/upload` en `/selfie` (`routes/auth/verificatie.js`).
- Op kantoor `/api/office/verifications` en `/api/office/verify` (`routes/office/verificaties.js`, achter `kluisAuth`).
- Niveaus in `kern/betrouwbaarheid.js`:
  - A0: geen account
  - A1: eigen account
  - A2: ingediend
  - A3: paspoort gezien
  - A4: plus een gezichtsmatch
- `leeftijdBron` is `paspoort` of `opgegeven`.
- Opslag:
  - Bestanden versleuteld (0600) via `server/kluis.js`.
  - Het besluit eerst in het inzagejournaal; faalt dat, dan 503 en verandert er niets.
  - Bij een afwijzing wordt het meteen gewist.
  - Een jaar na goedkeuring wordt het gewist (de bewaarveger).
- **Er is geen registercheck.** RTG belt geen register en doet ook niet alsof (AGENTS.md).
- **Bevinding:** het scherm zegt altijd "A3", ook als de code A4 geeft.
- **Intrekken of opnieuw verifiëren: niet gevonden.**
- Registers:
  - Bewijs 1–5, 7 en 8 staan op **B** (VOLTOOIPROEF `verificatie.js`, 7/7).
  - Bewijs 6 staat op **NG**: alle 3 routes onbereikbaar in IDOR.

**b. Markt.**
- **DigiD:** Basis, Midden, Substantieel (met de chip van het ID-document) en Hoog. Basis en Midden tellen voor eIDAS als "laag". https://vng.nl/artikelen/betrouwbaarheidsniveaus-online-dienstverlening
- **Persona:** ID-documenten uit meer dan 200 landen, een selfie met liveness en gezichtsmatch, registercontroles en een handmatige beoordeling. https://withpersona.com/product/verifications/government-id/
- **itsme:** onboarding op eIDAS-niveau Hoog via een documentscan en iProov (persbericht van 2021, een eigen claim). https://corporate.ansa.it/sito/notizie/economia/business_wire/news/2021-04-20_120145964.html
- Duurste klasse: Persona en Onfido-achtige diensten met een watchlist [U, geen prijs opgevraagd].

**c. Domein.**
- §2.2 (EUDI-wallet: `age_over_18` zonder geboortedatum; de NL-wallet is niet live, brede invoering in 2028).
- §2.1: art. 9 bij biometrie; de selfie is een biometrisch gegeven zodra hij voor een match gebruikt wordt [U, eigen lezing: juridisch toetsen].
- Het volledige werkgebied is meer dan "een keer aantonen". Het gaat ook om **geldigheid in de tijd** (een document verloopt) en om **selectief laten zien aan anderen**: een zaak die "18+?" vraagt.

**d. Functiecatalogus.**

| # | Functie | L | St | Bron | Gegevens · regels · rekenwijze · onzekerheid · melding · rollen · uitzondering | Acceptatie | K | Bak |
|---|---|---|---|---|---|---|---|---|
| V1 | Uploaden, laten beoordelen door een mens, wissen | L1/L5 | B | zie (a) | — | bestaat | — | — |
| V2 | Het niveau eerlijk tonen (A4) | L1 | H | `betrouwbaarheid.js` | Het scherm leest `niveauVan` en toont A3 of A4 met een zin. | Een lid met een faceMatch ziet "A4". Een toets op de tekst (bewijs 4: waarheidsgetrouw). | K | Nu |
| V3 | Bewijs 6 sluiten | — | O | IDOR | B kan de status en het bewijs van A niet lezen of overschrijven. | IDOR: de 3 routes staan op `gescheiden` | K | Nu |
| V4 | Geldig tot | L4/L5 | O | het document | De keurder neemt naast de geboortedatum ook `geldigTot` over (zoals `geborenBron`). Na `geldigTot` daalt het niveau naar **A2 "verlopen"**. `volwassen()` blijft waar als de leeftijd al gezien is, want leeftijd verloopt niet (**eigenaarsbesluit**). Een melding via Post 30 dagen ervoor en op de dag zelf. | Een toets met een klok: de dag na `geldigTot` is `niveauVan` A2, met de reden `verlopen`. | M | Nu (de regel voor leeftijd is een eigenaarsbesluit) |
| V5 | Bezwaar na afwijzing | L5 | H | `rejected` | Een afwijzing heeft een vaste reden uit een gesloten lijst, en het lid kan herbeoordeling vragen door een andere keurder (vier ogen). | Een afgewezen lid ziet de reden en "vraag herbeoordeling". De tweede keurder is niet de eerste. | M | Later |
| V6 | Volwassen met reden | L4 | O | X2 | zie §1 | zie X2 | K | Nu |
| V7 | Leeftijd tonen aan een zaak (alleen ja of nee) | L6 | O | `volwassen()` | Een zaak die alcohol schenkt of een 18+-activiteit heeft, vraagt via een verwijzing `volwassenVoor(sleutel)` en krijgt `{ja/nee, niveau, bron}`, **nooit** een datum. Er is toestemming per zaak nodig (consent-laag `leeftijd-tonen`, met een termijn), en het lid ziet het in Relaties. | Een zaak krijgt `true` zonder geboortedatum in het antwoord. Na intrekken in Relaties krijgt ze `toestemming-ingetrokken`. | M | Later |
| V8 | EUDI-wallet en NL-wallet als bron | L4/L6 | O | §2.2 | PID en `age_over_18` als attestatie. RTG registreert zich als relying party en vraagt **alleen** `age_over_18` en, voor A3, de naam die in de kluis gaat. De wallet-uitkomst wordt een nieuw niveau of is gelijk aan A3: een **eigenaarsbesluit**. | — | G | Later (B): de NL-wallet is niet live gevonden [U] |
| V9 | Registercheck (BIG of andere) | — | — | — | — | — | — | Niet: AGENTS.md zegt dat RTG niets inhoudelijk valideert en niet doet alsof. Een registercheck is een besluit van de eigenaar en geen gat. |

**e. RTG-exclusief.** Een mens keurt, het besluit staat eerst in het journaal, en RTG zegt hardop wat het **niet** doet. Met V7 kan één keer aantonen in de hele keten werken (Horeca, Arena, Living Lab), zonder dat een zaak ooit een geboortedatum ziet.

**f. Bouwstenen en ontbrekende koppelingen.**
- Bestaand: `betrouwbaarheid`, `volwassen`, `kluis`, het inzagejournaal en de bewaarveger.
- Ontbreekt:
  - `geldigTot`
  - `volwassenVoor` met de consent-laag
  - de herbeoordelingsstroom

**g. Prioritering.** V2, V3 en V6 (K), V4 (M, met een besluit), V5 en V7 (M), V8 (G).

**(A)** is V1–V7. **(B)** is V8 en andere wallets, plus een attestatie van een beroep (QEAA) naar Ik I5.

**Keten (los).** Het lid uploadt en het kantoor keurt.
- *Storing:* het inzagejournaal faalt → 503, en geen besluit zonder spoor. Dat bestaat al.

**Keten (samen).** Een gekeurd lid opent de Arena. `progressieMag` leest `volwassen()`.
- *Storing:* de kluis is onleesbaar → nu stil "geen 18+" (X2 lost dat op).

**h. Eindcontract (Verificatie).**

| Dimensie | Toetsbaar als |
|---|---|
| Breedte | V1, V2, V4, V5 en V7 |
| Professionele diepte | vier ogen bij herbeoordeling, en een gesloten lijst van redenen |
| Levenscyclus | indienen → keuren of afwijzen → verlopen → opnieuw → wissen, elk getoetst |
| Samenwerking en rollen | de keurder via `kluisAuth`, en een zaak alleen ja of nee |
| Domeinintelligentie | `geldigTot` en de leeftijdsbron worden apart gerekend |
| Los functioneren | indienen werkt met alle lezers uit |
| RTG-ketens | `volwassenVoor` wordt door minstens één zaak gelezen en ingetrokken |
| Bewezen betrouwbaarheid | de acht bewijzen op B (nu 6 open) |

---
## 8. Bescherming — "Mijn bescherming" (`apps/mijn-isolatie.html` · `account.bescherming`)

**Doel.** Mijn account strenger zetten als ik denk dat iemand meekijkt, en alleen via een ceremonie weer terug. Deze app gaat over **wie mij mag bereiken**. Bescherming tegen accountovername blijft hier (afspraak met LivingOS-A); persoonlijke veiligheid hoort bij Veilig (par. 13).

**a. Bewezen bestaand.**
- **Standen:** `normaal`, `waakzaam`, `beschermd` en `isolatie`. Het lid zet de drager `identiteit` alleen strenger (SEC-LOCK-001: `zet()` weigert elke verlaging).
- **Routes:** `/api/isolatie/mijn` en `/mijn/zet` (`routes/isolatie.js`), en de ceremonie `/mijn/ontsluiting`, `/stap/opties`, `/stap`, `/commit` en `/afbreken`.
- **De ceremonie** eist een reden, een passkey, een apparaat, een wachttijd en eventueel een tweede paar ogen. Zonder passkey wordt het een gemarkeerde "noodontsluiting".
- **Opslag:** `db.data.isolatie`. Het spoor kan alleen aangevuld worden.
- **Huisstand:** die wordt alleen gelezen. Het lid zet organisatie en huis niet.
- **Bij onzekerheid:** 503 `ISOLATIE_ONBEPAALD` als de poort bijt, en productie eist `RTG_ISOLATIE_AFDWINGEN=1`.
- **Wachtwoordherstel** valt onder de uitzonderingen en wordt dus niet bevroren onder `beschermd` (`beschermstand-lijst.js:54`).
- **Registers:**
  - Bewijs 1–5, 7 en 8 staan op **B**. Bewijs 2 haalt 4/5: één knop is niet aantikbaar.
  - Bewijs 6 staat op **NG**: 2 van de 7 routes zijn open, namelijk `/mijn/ontsluiting` en `/mijn/zet`.
  - De passkeystap draaide niet in het scenario.

**b. Markt.**
- **Google Advanced Protection:** sleutel of passkey verplicht, alleen geverifieerde apps, strengere scans en strenger herstel. https://landing.google.com/advancedprotection/ · https://support.google.com/accounts/answer/7519408
- **Apple Bewaking bij gestolen apparaat:** biometrie zonder codeterugval buiten bekende plekken, plus **een uur vertraging** voor gevoelige wijzigingen. https://support.apple.com/en-us/120340
- **Apple Lockdown-modus:** extreme verharding, geopperd tegen spyware. https://support.apple.com/guide/iphone/use-lockdown-mode-iph845f6f40c/ios
- **Microsoft:** **30 dagen vertraging** voor wijzigingen in de herstelgegevens. https://support.microsoft.com/en-us/accounts-billing/manage/how-to-get-a-microsoft-account-recovery-code

**c. Domein.**
- §2.3: na herstel alles intrekken.
- De les van Apple en Microsoft is **vertraging op gevoelige wijzigingen**. Een overnemer heeft haast, de eigenaar niet.
- Het volledige werkgebied loopt van vermoeden via verstrengen en onderzoeken (wat is er gebeurd?) tot herstellen en terug naar normaal.

**d. Functiecatalogus.**

| # | Functie | L | St | Bron | Gegevens · regels · rekenwijze · onzekerheid · melding · rollen · uitzondering | Acceptatie | K | Bak |
|---|---|---|---|---|---|---|---|---|
| B1 | Verstrengen meteen, terug via de ceremonie | L1/L5 | B | `kern/isolatie/*` | zie (a) | bestaat | — | — |
| B2 | Bewijs 6, en de passkeystap in VOLTOOIPROEF | — | H | BEVOEGD, VOLTOOIPROEF | De 2 open routes, plus een virtuele authenticator (zie P2). | BEVOEGD `link:bescherming` op B, en de ceremonie met passkey gesloten. | K | Nu |
| B3 | Vertraging op herstelwijzigingen | L4/L5 | O | `/api/mijn/herstelkanaal/*` | In `waakzaam` of strenger wordt een nieuw herstel-e-mailadres of -telefoonnummer pas na **N uur** actief. **N is een eigenaarsbesluit**; ter vergelijking: Apple houdt 1 uur aan, Microsoft 30 dagen. Een bericht gaat naar het **oude** kanaal, met "dit was ik niet" (S3). Intrekken kan tot het moment van activeren. | Een toets met een klok: na het wijzigen in `waakzaam` blijft het oude kanaal tot N uur geldig, en het oude adres krijgt een bericht. | M | Nu |
| B4 | "Wat is er gebeurd" | L4/L5 | O | het spoor, het sessieregister, inlogherkomst | Eén tijdlijn: standwijzigingen, inlogpogingen, sluitingen, passkey- en herstelwijzigingen. Het is alleen een projectie; elke regel linkt naar de bron. | Na een simulatie (een vreemde inlog, dan "dit was ik niet") toont de tijdlijn vier regels in de juiste volgorde. | M | Later |
| B5 | Uit Sessies (S3) en Passkeys (P5) | L6 | O | S3, P5 | Andere apps mogen **alleen verstrengen**, via dezelfde `zet()`. Verlagen kan alleen via de ceremonie. | Een toets: S3 zet `waakzaam`, en een poging om vanuit S3 te verlagen geeft een weigering. | K | Nu (met S3) |
| B6 | Huisstand uitleggen | L1 | H | `incidentcontrole.modus` | Het lid ziet de huisstand al. Voeg één zin toe: wat de huisstand voor hem betekent. | Bij huisstand `beschermd` zegt het scherm wat er nu niet kan. | K | Later |
| B7 | Lockdown-achtige stand per app | — | — | — | — | — | — | Niet: de standen zijn één partiële ordening (`ordening.js`). Een vijfde as per app zou de ordening breken. De stand `isolatie` dekt het al. |

**e. RTG-exclusief.** Het lid kan zelf verstrengen, en terug kan alleen via een ceremonie met een wachttijd. Dat is dezelfde machine die het kantoor gebruikt voor het hele huis. Met B5 kan elke app in één tik verstrengen, maar nooit verlagen.

**f. Bouwstenen en ontbrekende koppelingen.**
- Bestaand: `isolatie/*`, de ceremonie, het stapbewijs en `herstelkanaal`.
- Ontbreekt:
  - de vertraging op het herstelkanaal
  - de tijdlijnprojectie
  - S3 → `zet()`

**g. Prioritering.** B2 (K), B5 (K met S3), B3 (M), B4, B6.

**(A)** B1–B6.

**(B)** gaat verder:
- risicosignalen van buiten, zoals een datalek elders (HIBP-achtig [U]), die een verstrenging *voorstellen* en nooit zelf zetten;
- toestelintegriteit (attestatie).

**Keten (los).** Het lid zet `beschermd`.
- *Storing:* de opslag is onzeker. Dan geeft het systeem `ISOLATIE_OPSLAG_ONZEKER` en 503. Het systeem doet niet alsof het gelukt is.

**Keten (samen).** "Dit was ik niet" gaat via Sessies naar Bescherming.
- *Storing:* Bescherming is onbepaald. Dan blijft de sluiting staan en ziet het lid "nog niet beschermd, probeer zo opnieuw".

**h. Eindcontract (Bescherming).**

| Dimensie | Toetsbaar als |
|---|---|
| Breedte | B1 en B3–B5 |
| Professionele diepte | wachttijd, vier ogen en een gemarkeerde noodontsluiting, elk getoetst |
| Levenscyclus | verstrengen → onderzoek (B4) → ceremonie → normaal |
| Samenwerking en rollen | het lid zet identiteit; het kantoor zet huis en organisatie; andere apps mogen alleen verstrengen |
| Domeinintelligentie | vertraging op het herstelkanaal, naar het voorbeeld van Apple en Microsoft |
| Los functioneren | verstrengen werkt met alle andere apps uit |
| RTG-ketens | S3 en P5 zetten de stand (getoetst) |
| Bewezen betrouwbaarheid | de acht bewijzen op B (nu staat 6 open) |

---

## 9. Relaties — "Wie heeft toegang tot mij" (`apps/mijn-relaties.html` · `privacy.toegang`)

**Doel.** Wie toegang tot mij heeft, per partij en per soort; wie er gekeken heeft; en alles intrekken.

**a. Bewezen bestaand.**
- **Routes:** `/api/toestemming`, `/intrek`, `/relaties`, `/relatie/gevolgen` en `/relatie/sluit` (`routes/consent.js`), en `/api/inzagekaart`.
- **Consent-register:** `kern/consent-register.js` beschrijft **elf lagen**, elk met doel en termijn (o.a. care-intake, paspoort-inzage, rtgid-sessie, rtgid-machtiging, commercieel, locatie, zorgprofiel, toestel en wachtlijst). `NIET_GEDEKT` zegt wat het register níet dekt.
- **Storingen:** die vangt het systeem per laag op (`storingen[]`).
- **Inzagekaart:** vier bronnen. Medewerkers staan er zonder naam in. De export loopt via `RTGUitvoer`.
- **Een relatie sluiten** is onomkeerbaar, met eerst een gevolgenstap.
- **Machtigen** gebeurt in `rtgid.html` (`/api/rtgid/machtig`, een zwaar pad). Intrekken kan hier.
- **SCHERMEIGENAAR-oordeel:** `toestemming.html` en `rtgid.html` zijn functioneel dubbel met dit scherm, en de eigenaar is `mijn-relaties.html`.
- **Registers:**
  - Bewijs 1–5, 7 en 8 staan op **B**, maar het scenario raakt maar **2 van de lagen**.
  - Bewijs 6 staat op **NG**: 7 van de 18 routes zijn open, waaronder `/api/inzagekaart`.
  - Alle 9 `/api/rtgid`-routes zijn onbereikbaar in IDOR.

**b. Markt.**
- **Google:** "Third-party connections" scheidt inloggen en gegevenstoegang, met de reikwijdte. Verwijderen wist niets bij de derde partij, en dat staat er ook bij. https://support.google.com/accounts/answer/13533235
- **Apple:** Inloggen met Apple, per app te verwijderen, met het gevolg uitgelegd. https://support.apple.com/en-us/102571
- **Facebook:** apps en websites. Toegang **vervalt na 90 dagen** niet-gebruik, en er is een knop om alles uit te zetten. https://www.facebook.com/help/218345114850283

**c. Domein.**
- §2.1: art. 7 lid 3 (intrekken net zo makkelijk als geven), art. 19 en art. 15 (ontvangers).
- Het volledige werkgebied is **toegang als contract met een eindtijd**: wie, waarvoor, tot wanneer, met wat er gezien is, en wat er overblijft na intrekken.

**d. Functiecatalogus.**

| # | Functie | L | St | Bron | Gegevens · regels · rekenwijze · onzekerheid · melding · rollen · uitzondering | Acceptatie | K | Bak |
|---|---|---|---|---|---|---|---|---|
| R1 | Per partij en per soort, intrekken, sluiten met gevolgen, inzagekaart met export | L1/L5 | B | zie (a) | — | bestaat | — | — |
| R2 | Alle elf lagen in VOLTOOIPROEF | — | H | VOLTOOIPROEF | Een schakel per laag: geven → zien → intrekken → weg. | VOLTOOIPROEF `relaties`: 11 van de 11 lagen | M | Nu |
| R3 | Bewijs 6, ook voor rtgid | — | O | IDOR | `/api/inzagekaart` en de 9 rtgid-routes. | IDOR: alle routes op `gescheiden` of `publiek` met een reden | M | Nu |
| R4 | Vervallen na niet-gebruik | L4/L5 | H | `consent-termijn.js` | Elke laag heeft al een termijn. Daarbovenop komt een **gebruiksverval**: een machtiging of koppeling die N dagen niet gebruikt is, vervalt (Facebook: 90). N per laag is een eigenaarsbesluit. Een melding via Post 7 dagen ervoor. | Een toets met een klok: na N+1 dagen zonder gebruik staat de laag op `vervallen`. | M | Later |
| R5 | "Na intrekken blijft er dit over" | L4 | H | `/relatie/gevolgen` | Per laag een zin: wat de ontvanger nog heeft (bijvoorbeeld "de zaak houdt de factuur 7 jaar, wettelijke plicht"). Dat volgt Google ("wist niets bij de derde"). | Elke laag in het register heeft `naIntrekken`, en anders faalt de toets. | K | Nu |
| R6 | Leeftijd tonen aan een zaak (V7) | L6 | O | V7 | Een nieuwe laag `leeftijd-tonen` in hetzelfde register. Er komt **geen** tweede register. | zie V7 | — | Later |
| R7 | Alles in één keer intrekken | L1 | O | — | Een knop "trek alles in behalve het wettelijke", met de gevolgen vooraf. Het is een zwaar pad, met bezitsbewijs. | Na de knop staat elke laag op ingetrokken, behalve de lagen met `wettelijk:true`. | K | Later |
| R8 | Vertrouwde contacten als relatie (voor Veilig) | L6 | — | Veilig-kring | De kring van Veilig blijft van Veilig. Relaties **toont** haar als soort `veiligheidskring`, met een link naar Veilig om te beheren. | De kring staat hier alleen-lezen, met "beheren in RTG Veilig". | K | Later (afstemmen met LivingOS-A) |

**e. RTG-exclusief.** Eén register voor elf lagen. Daardoor is "wie heeft toegang tot mij" één antwoord over zorg, reizen, RTG iD en commercie heen, met een inzagekaart die laat zien **wie keek**, zonder medewerkersnamen. Grote platforms laten alleen derde apps zien; hun eigen inzage tonen ze niet.

**f. Bouwstenen en ontbrekende koppelingen.**
- Bestaand: `consent-*`, de inzagekaart, `inzagelog` en `rtgid`.
- Ontbreekt:
  - `naIntrekken` per laag
  - gebruiksverval
  - IDOR-dekking van rtgid

**g. Prioritering.**
1. R3 (M, de veiligheid)
2. R5 (K)
3. R2 (M)
4. R4, R7, R8

**(A)** R1–R8.

**(B)** gaat verder:
- art. 19-signalen naar elke ontvanger (G8);
- toestemmingsbewijzen als verifieerbare attestatie in de wallet van het lid (§2.2).

**Keten (los).** Het lid trekt een zorgtoestemming in.
- *Storing:* de laag zorgprofiel faalt. Dan staat die laag in `storingen[]` en werken de rest gewoon. Dat bestaat al.

**Keten (samen).** Het lid trekt de machtiging van een gemachtigde in. RTG iD leest de stand en de gemachtigde komt niet meer binnen.
- *Storing:* rtgid is onbereikbaar. Het intrekken moet dan dicht blijven: liever 503 dan "ingetrokken" zonder dat het vaststaat (dat moet nog getoetst worden).

**h. Eindcontract (Relaties).**

| Dimensie | Toetsbaar als |
|---|---|
| Breedte | alle lagen van het register staan op het scherm (architectuurtoets) |
| Professionele diepte | doel, termijn en `naIntrekken` per laag |
| Levenscyclus | geven → gebruiken → verval → intrekken → gevolgen, per laag getoetst |
| Samenwerking en rollen | gemachtigde, zaak en kring zijn zichtbaar, en het lid beheert ze |
| Domeinintelligentie | gebruiksverval en een inzagekaart met bron |
| Los functioneren | elke laag faalt los van de andere |
| RTG-ketens | intrekken werkt door in de eigenaar-app (rtgid, zorg, commercie) |
| Bewezen betrouwbaarheid | de acht bewijzen op B, en VOLTOOIPROEF dekt 11/11 |

---

## 10. Neigingen — "Mijn neigingen" (`apps/mijn-neigingen.html` · `privacy.voorkeuren`)

**Doel.** Wat RTG van mij **denkt** te weten, en waarvoor het dat mag gebruiken. Het scherm heet de geheugenkaart (`NEIGING.md`).

**a. Bewezen bestaand.**
- **Routes:** zeven, `/api/neiging/{intake,antwoord,overslaan,opnieuw,geheugen,vergeet,niet-voor}`, met `auth` en de paspoortdeur. Er is **geen** kantoor- of leveranciersroute.
- **Opslag:** de eigencollectie `kern/neiging`. De actor is een sha256 van de sessiesleutel.
- **Een neiging draagt:**
  - een grond: gezegd, gekozen of afgeleid;
  - een doel uit een gesloten lijst: `tonen` of `helpen`;
  - een einddatum: `vervalt`, met `BEWAARDAGEN` 730.
- **Vergeet** verwijdert echt.
- **`niet-voor`** zet per doel uit; zonder doel wordt de neiging `geweigerd`.
- **Lezer:** `kern/experience/volgorde.js`. Bij een fout valt die terug op de onpersoonlijke volgorde, met uitleg (ongetoetst).
- **Gaten:** `merkOp` (afleiden) heeft nog geen aanroeper, en de kring `rechterhand` ook niet.
- **Registers:**
  - Bewijs 1–5, 7 en 8 staan op **B**.
  - Bewijs 6 staat op **NG**: 7 van de 19 routes zijn open.

**b. Markt.**
- **Google My Ad Center:** meer of minder per onderwerp, een tab met gevoelige onderwerpen, en "More like this" vanuit de advertentie. https://support.google.com/My-Ad-Center-Help/answer/12155451
- **Meta:** "Why am I seeing this ad" laat afgeleide interesses en activiteit buiten Meta zien. https://www.facebook.com/help/562973647153813
- **Apple:** alleen segmenten van ≥ 5.000 mensen, en geen advertenties onder 13. https://www.apple.com/legal/privacy/data/en/apple-advertising/

**c. Domein.**
- §2.5: DSA art. 26 (waarom zie ik dit), art. 26 lid 3 (geen bijzondere gegevens) en art. 28 (geen profilering bij minderjarigen).
- §2.1: art. 21 (bezwaar) en art. 22.
- Het volledige werkgebied draait om **een afgeleide gedachte over een mens die die mens kan zien, betwisten en laten vergeten**, voordat iemand er iets mee doet.

**d. Functiecatalogus.**

| # | Functie | L | St | Bron | Gegevens · regels · rekenwijze · onzekerheid · melding · rollen · uitzondering | Acceptatie | K | Bak |
|---|---|---|---|---|---|---|---|---|
| N1 | Intake, geheugenkaart, vergeten, "niet hiervoor" | L1/L5 | B | `kern/neiging` | zie (a) | bestaat | — | — |
| N2 | "Waarom zie ik dit" bij elke gepersonaliseerde volgorde | L4/L6 | H | `volgorde.js` | `volgorde` geeft al `persoonlijk` en `uitleg`. Elk scherm dat de volgorde gebruikt, toont één tik naar de regel op de geheugenkaart die het gebruikte. | Een tik op "waarom" opent de geheugenkaart op die neiging. Met "niet hiervoor" verdwijnt de personalisatie de volgende keer. | M | Nu |
| N3 | Terugval getoetst | — | O | `volgorde.js:85-91` | De terugval bestaat al. Wat ontbreekt is de toets. | Een toets laat `lees()` gooien: de volgorde is onpersoonlijk, met uitleg. | K | Nu |
| N4 | Geen neiging over een bijzonder gegeven, en niets onder 18 | L4 | O | §2.5 | De lijst van vragen (`vraag-lijst`) en `merkOp` weigeren categorieën uit art. 9 (geloof, gezondheid, politiek, seksualiteit). Onder 18 slaat `merkOp` niets op en leest `lees()` niets. | Een architectuurtoets op de vragenlijst. Een toets met een lid van 16: `merkOp` geeft `geweigerd`. | K | Nu |
| N5 | Afleiden zichtbaar maken (`merkOp` krijgt een aanroeper) | L4 | O | `merkOp` | Een afgeleide neiging krijgt de grond `afgeleid`, met de bron-app en de datum, en vervalt na **90 dagen** (korter dan gezegd: 730). De onzekerheid wordt als graad getoond (die wordt al berekend). Een melding: "RTG denkt dit, klopt het?" in de geheugenkaart en niet als push. | Een afgeleide neiging staat op de kaart met de bron. Na 91 dagen is ze weg. | M | Later (eerst N4) |
| N6 | Bewijs 6 | — | O | IDOR | `/api/neiging/antwoord` is onbereikbaar. | IDOR op `gescheiden` | K | Nu |
| N7 | De rechterhand leest mee | L6 | O | `deel: rechterhand` | De kring bestaat in de opslag. De Lifestyle-rechterhand leest alleen wat het lid op `rechterhand` zette, en dat staat in Relaties als laag. | — | M | Later |
| N8 | Neigingen verkopen of aan zaken geven | — | — | — | — | — | — | Niet: er is bewust geen leveranciersroute. Een zaak krijgt hoogstens een volgorde, nooit de neiging. |

**e. RTG-exclusief.** Afgeleid heeft een kortere houdbaarheid dan gezegd. "Niet hiervoor gebruiken" werkt per doel. En er bestaat geen leveranciersroute. Geen marktleider scheidt **wat je zei** van **wat we denken** met een eigen vervaldatum.

**f. Bouwstenen en ontbrekende koppelingen.**
- Bestaand: `kern/neiging` en `volgorde`.
- Ontbreekt:
  - de "waarom"-link per scherm;
  - een aanroeper van `merkOp`;
  - de art. 9-weigering;
  - de toets van de terugval.

**g. Prioritering.**
1. N3, N4 en N6 (K)
2. N2 (M)
3. N5 en N7 (M)

**(A)** N1–N7. **(B)** gaat verder: het lid neemt zijn eigen neigingen mee als attestatie naar een andere aanbieder. Dat valt buiten art. 20, want afgeleide gegevens horen er niet bij, maar RTG kan het toch aanbieden.

**Keten (los).** Het lid zegt "ik reis graag met de trein".
- *Storing:* de opslag faalt. De intake geeft dan een fout, en er wordt niets half opgeslagen.

**Keten (samen).** Reizen toont de treinopties eerst en zegt waarom (N2).
- *Storing:* de neiging is onleesbaar. Reizen toont dan de gewone volgorde en zegt dat de voorkeuren niet te lezen waren (bestaat, N3 toetst het).

**h. Eindcontract (Neigingen).**

| Dimensie | Toetsbaar als |
|---|---|
| Breedte | N1, N2, N4 en N5 |
| Professionele diepte | grond, graad, doel en termijn per neiging |
| Levenscyclus | gezegd of afgeleid → gebruikt → betwist → vergeten of vervallen |
| Samenwerking en rollen | alleen het lid en een rechterhand met toestemming; geen zaak |
| Domeinintelligentie | geen art. 9-gegevens en niets onder 18 (getoetst) |
| Los functioneren | elke lezer valt terug op onpersoonlijk |
| RTG-ketens | "waarom" uit minstens twee apps, naar de kaart |
| Bewezen betrouwbaarheid | de acht bewijzen op B (nu staat 6 open) |

---

## 11. Post — "Post van RTG" (`apps/mijn-post.html` · `instellingen.postvoorkeuren`)

**Doel.** Per soort post en per kanaal kiezen wat ik krijg, alles in één keer uit, en terugzien wat ik koos.

**a. Bewezen bestaand.**
- **Routes:** `/api/mijn/post`, `/zet`, `/alles-uit` en `/geschiedenis` (in `routes/member/tweefactor.js:166-192`).
- **Opslag:** `kern/identiteit/commercieel.js`.
  - Soorten: aanbiedingen, productnieuws, onderzoek en partners.
  - Kanalen: e-mail, sms en push.
  - Standaard staat **alles uit** (opt-in).
  - De geschiedenis kan alleen aangevuld worden, tot maximaal 200 regels.
- **ALTIJD-lijst:** het scherm toont wat niet uit kan: beveiliging, facturen, wettelijke berichten en antwoorden op eigen vragen.
- **Afmelden** is een recht en is niet schakelbaar (`bediening-recht.js:67`).
- **Het grote gat:** `commercieel.mag()` heeft **geen aanroeper** (§1, X3). Het scenario zegt het zelf: "geen tweede partij leest de toestemming".
- **Registers:**
  - Bewijs 1–5 en 7 staan op **B**.
  - Bewijs 8 staat op **NG**.
  - Bewijs 6 staat op **NG**: 6 van de 16 routes zijn open.

**b. Markt.**
- **Google:** per type af te melden; dienstberichten kunnen niet uit. https://support.google.com/accounts/answer/12979594
- **Apple:** checkboxes per categorie. De afmeldlink in de voettekst schakelt dezelfde voorkeur, en een wijziging duurt tot 5 dagen. https://support.apple.com/en-us/102110
- **Microsoft:** per e-mailadres; facturen en beveiligingsberichten komen altijd. https://support.microsoft.com/en-us/accounts-billing/manage/manage-ads-and-promotional-emails

**c. Domein.**
- §2.4: Tw art. 11.7 vraagt opt-in en een afmelding in elk bericht.
- §2.1: art. 21 lid 2 (bezwaar tegen direct marketing is absoluut).
- Art. 7 lid 3: intrekken moet net zo makkelijk zijn als geven.
- Het volledige werkgebied draait om **een belofte die bij de verzender wordt afgedwongen**, niet bij het scherm.

**d. Functiecatalogus.**

| # | Functie | L | St | Bron | Gegevens · regels · rekenwijze · onzekerheid · melding · rollen · uitzondering | Acceptatie | K | Bak |
|---|---|---|---|---|---|---|---|---|
| T1 | Per soort en kanaal, alles uit, geschiedenis | L1/L5 | B | `commercieel.js` | zie (a) | bestaat | — | — |
| T2 | De poort bij de verzender | L6 | O | X3 | Elke verzender van soort ∉ ALTIJD vraagt `mag()`. Bij een storing van `mag()` gaat er **niets** uit (fail-closed). Een gemist bericht is goedkoper dan een bericht tegen de wil van het lid. | zie X3. Een toets met `bak()` die gooit: 0 berichten. | M | Nu |
| T3 | Afmelden in één klik in elk bericht | L1/L6 | O (niet gemeten) | §2.4 | Een getekende link per bericht (soort, kanaal en sleutel, met HMAC en zonder account-ID in de URL). Die zet dezelfde stand als het scherm, met `bron: 'afmeldlink'` in de geschiedenis. **Dit is uitzondering 6 van het accountbesluit** (machine-naar-machine met een eigen handtekening), of een mens die eerst inlogt: een **eigenaarsbesluit**. | De link uit de mailvanger zet `aanbiedingen.email` uit. De geschiedenis toont `bron: afmeldlink`. | M | Nu (met besluit) |
| T4 | Bewijs 8 en 6 | — | H | APPWERKT, BEVOEGD | Een weigering uitlokken, en de open routes. | APPWERKT en BEVOEGD op B | K | Nu |
| T5 | Een soort voor elke app die post stuurt | L3/L6 | O | — | Een app die post wil sturen, registreert een soort in **dit** register, met een doel en een standaard UIT. Een eigen opt-in-lijst in een app is verboden. Een architectuurtoets: geen tweede lijst van soorten. | Een nieuwe soort verschijnt vanzelf in het scherm. Een app met een eigen lijst laat de toets zakken. | M | Later |
| T6 | Rustige uren en een samenvatting | L4 | O | — | Per kanaal een venster (bijvoorbeeld geen push 22-8), en een weekbundel in plaats van losse berichten. Een beveiligingsbericht negeert het venster. | Een push om 23:00 wordt om 08:00 bezorgd. Een beveiligingsbericht komt meteen. | M | Later |
| T7 | Toestemming en kanaal als bewijs | L5 | H | geschiedenis | De geschiedenis heeft al `op`, `soort`, `van`, `naar`, `bron` en `handeling`. Voeg een export toe voor een ACM-vraag: "wanneer gaf dit lid toestemming". | Een export van de geschiedenis als CSV via `RTGUitvoer`. | K | Later |

**e. RTG-exclusief.** Eén register voor de post van alle 114 apps (T5), afgedwongen bij de verzender (T2). Elders heeft elk product een eigen voorkeurscentrum.

**f. Bouwstenen en ontbrekende koppelingen.**
- Bestaand: `commercieel.js` en de geschiedenis.
- Ontbreekt:
  - aanroepers van `mag()`;
  - de getekende afmeldlink;
  - de registratie van soorten per app.

**g. Prioritering.**
1. T2 (M, de belofte is nu niet afgedwongen)
2. T4 (K)
3. T3 (M, met besluit)
4. T5, T6, T7

**(A)** T1–T7. **(B)** gaat verder: een standaard afmeldkop in elke mail (List-Unsubscribe) [U, niet onderzocht], en een postbus voor derden die via RTG mailen.

**Keten (los).** Het lid zet alles uit.
- *Storing:* de opslag faalt. Het lid krijgt een fout, en er komt geen nep-"uit".

**Keten (samen).** Een campagne uit Commerce gaat naar leden.
- *Storing:* `mag()` faalt. Dan gaat er niets uit (T2). Vandaag is er geen poort: **de campagne gaat ongeacht de keuze** (zie §1).

**h. Eindcontract (Post).**

| Dimensie | Toetsbaar als |
|---|---|
| Breedte | T1–T3 en T5 |
| Professionele diepte | soort × kanaal, ALTIJD-lijst, geschiedenis met bron |
| Levenscyclus | geven → wijzigen → afmelden (scherm of link) → bewijs |
| Samenwerking en rollen | elke verzender vraagt het, niemand kan het omzeilen |
| Domeinintelligentie | Tw 11.7 en art. 21 lid 2 zijn afgedwongen (getoetst) |
| Los functioneren | het scherm werkt met alle verzenders uit |
| RTG-ketens | T2 bij minstens mail, sms en push |
| Bewezen betrouwbaarheid | de acht bewijzen op B (nu staan 6 en 8 open) |

---

## 12. Juridisch (`apps/juridisch.html` + `apps/juridisch/{voorwaarden,privacy,partnervoorwaarden}.html` · `site.juridisch*`)

*De opdracht zegt: nog zonder scenario. Dit deel beschrijft daarom vooral wat er is.*

**a. Wat er is.**
- **De pagina's:** een statische index met drie links, en drie statische pagina's, elk met "Laatst bijgewerkt: 22 juli 2026".
  - `voorwaarden` haalt `/api/pasprijzen` live op.
  - `partnervoorwaarden` haalt `/api/betaaldiensttarief` en `/api/pasprijzen` live op.
- **Er is geen:** versienummer, archief, vergelijking met de vorige versie of akkoordregistratie op deze pagina's.
- **Akkoord bestaat wel elders:**
  - Onboarding (`POST /api/onboarding/teken`, `kern/onboarding/lid.js`) bewaart `{versie, at, hash(versie|tekst|naam|pid)}`. Een verouderde versie geeft 409.
  - De contracttekst (`kern/onboarding/contract.js`) noemt de voorwaarden alleen in woorden en verwijst niet naar een versie van de pagina.
  - Een partneraanvraag bewaart `akkoord:{partnervoorwaarden, verwerkersafspraken, at}`, **zonder versie**.
- **Registers:** APPWERKT geeft bewijs 1, 2 en 4 op B. Er is geen VOLTOOIPROEF (GF). De drie onderpagina's staan in geen enkel register.
- **Doelgroep:** in SCHERMEIGENAAR `publiek`. Dat past bij uitzondering 4 (de openbare landing).

**b. Markt.**
- **Google:** archief sinds 1999, vergelijking per versie, en een belofte om rechten niet te verminderen zonder toestemming. https://policies.google.com/privacy/archive · https://policies.google.com/terms/archive
- **Apple Legal:** actuele voorwaarden per dienst; een archiefindex is niet gevonden [U]. https://www.apple.com/legal/privacy/en-ww/

**c. Domein.** §2.6:
- vooraankondiging op een duurzame drager;
- kosteloos opzeggen binnen 30 dagen bij een meer dan geringe negatieve wijziging (Richtlijn digitale inhoud art. 19);
- transparantie (Richtlijn 93/13);
- de grijze lijst (art. 6:237 BW).

Het volledige werkgebied: **welke versie gold voor wie, en wanneer.**

**d. Functiecatalogus (alleen beschrijvend; per deel een eigenaarsbesluit).**

| # | Functie | L | St | Gegevens · regels | Acceptatie | K | Bak |
|---|---|---|---|---|---|---|---|
| J1 | Versie en datum op elke pagina | L1 | H | Een versie-id (datum plus hash van de tekst) in de pagina, gelijk aan wat `teken()` opslaat. | Het id op de pagina is gelijk aan `contractVersion` in onboarding. | K | Later |
| J2 | Archief met vergelijking | L5 | O | Elke versie bevroren (de git-geschiedenis is de bron), met een leesbaar verschil. | De vorige versie is te openen en het verschil is zichtbaar. | M | Later |
| J3 | Akkoord met versie bij partners | L3/L5 | O | `akkoord.partnervoorwaarden` krijgt `versie`, net als bij leden. | Een partneraanvraag zonder versie geeft 409. | K | Later |
| J4 | Wijzigingsbericht met opzegrecht | L5/L6 | O | Via Post (een wettelijk bericht, kan niet uit), 30 dagen ervoor, met opzeggen als het nadelig is. | Een wijziging laat een bericht in de mailvanger achter, met de datum. | M | Later |
| J5 | Mijn akkoorden | L1 | O | In Gegevens of Ik: welke versie ik wanneer tekende, uit `p.ondertekend`. | Het lid ziet zijn versie en de datum. | K | Later |

**(A)** J1, J3 en J5. **(B)** J2 en J4. Een scenario en een bak volgen nadat de eigenaar Juridisch in de scope zet.

---

## 13. SAMEN met RTG Veilig (LivingOS-A, `docs/domeinkaarten/livingos-a.md`)

Afspraak van 19 oktober 2026 (LivingOS-A en -B kozen allebei optie (a)). **Veilig** bezit:
- het persoonlijke veiligheidsplan;
- de escalatie: nu tweetraps (genade, dan de kring), configureerbaar is nog niet gebouwd;
- de kring (`server/kern/veiligheid/kring`, maximaal 8, alleen wie al een sociale connectie is);
- tijdelijke toegang (het plek-venster, de Moment met eindtijd);
- incidenten;
- de noodcommunicatie (stil codewoord, alarm).

**Instellingen levert, als verwijzing:**

| Levering | Van | Bij een storing |
|---|---|---|
| Wie is dit lid (sessie → sleutel en codenaam) | Ik, Sessies | 503, en niet "uitgelogd" (X1). Een alarm dat al loopt, gaat door, want de sweep draait op de server. |
| Mag dit contact mijn plek zien | Relaties toont de kring als soort (R8); Veilig beheert hem | De Relaties-laag staat in `storingen[]`, en Veilig blijft werken |
| Is dit toestel van het lid (bezitsbewijs) | Sessies, Passkeys | Het codewoord en het alarm horen **geen** zwaar pad te zijn: een lid in nood mag niet op een toestelbewijs stranden. Dit is een eigenaarsbesluit om vast te leggen, en LivingOS-A toetst het. |
| Volwassen | Verificatie | Voor Veilig niet nodig. Kinderen gaan via `foundation/veilig.html` (de gezinsdeur). |
| Accountovername (iemand anders zit in je account) | Bescherming | Bescherming blijft hier. Het **stille** pad van Veilig ("ik word gedwongen") en de verstrenging van Bescherming mogen elkaar niet verraden: een zichtbare standwijziging terwijl de dader meekijkt, is gevaarlijk. Dat volgt `HDI.md` par. 5.7: duress wordt heel of niet gebouwd. |
| Verwijzen naar hulp | — | De beschermingsdeur (`/api/bescherming/deur/*`, uitzondering 5) blijft zonder account. Instellingen raakt die niet. |

Domeinbronnen die Veilig kan gebruiken (in het domeinonderzoek gevonden en aan LivingOS-A te geven):
- Veilig Thuis 0800-2000, 24/7 en anoniem: https://www.rijksoverheid.nl/onderwerpen/huiselijk-geweld/vraag-en-antwoord/wat-moet-ik-doen-bij-huiselijk-geweld
- Meldcode met vijf vragen: https://www.nji.nl/kennis/kindermishandeling/afwegingskader-meldcode
- 112NL-app en AML (een functie van het besturingssysteem, die RTG niet kan bouwen)
- Masker 19 (status in 2026 onbekend [U])
- Apple Safety Check met Quick Exit: https://support.apple.com/guide/personal-safety/safety-check-iphone-ios-16-ips2aad835e1/web
- Google Personal Safety: https://support.google.com/android/answer/9319337

---

## 14. Extern, open besluiten en wat een mens moet zien

**Extern (buiten RTG, buiten scope A).**
- De NL- of EUDI-wallet: niet live gevonden [U].
- Een sms-aanbieder voor herstel: productie blokkeert zonder aanbieder het herstel voor accounts met een telefoon.
- Een bron voor gelekte wachtwoorden (§2.3; of die al gebruikt wordt, is niet gemeten).

**Eigenaarsbesluiten die deze kaart nodig heeft (meerkeuze, met de aanbeveling eerst).**
1. **N voor inactiviteit van een sessie (S4).**
   - (a) **30 dagen** [aanbevolen]: gelijk aan het glijdende register, dus geen nieuwe klok, kosten K.
   - (b) 14 dagen: strenger, en leden loggen vaker opnieuw in.
   - (c) Geen idle; alleen de absolute 30 dagen blijven (dat is nu zo).
2. **Vertraging op het herstelkanaal in `waakzaam` (B3).**
   - (a) **24 uur** [aanbevolen].
   - (b) 1 uur (Apple).
   - (c) 30 dagen (Microsoft): sterk, maar een lid dat echt zijn adres kwijt is, wacht een maand.
3. **Leeftijd na een verlopen document (V4).**
   - (a) **De leeftijd blijft gezien** en het niveau daalt naar A2 [aanbevolen]: leeftijd verloopt niet.
   - (b) Alles vervalt, ook 18+.
4. **Afmeldlink zonder inloggen (T3).**
   - (a) **Als machineverkeer met een eigen handtekening (uitzondering 6)** [aanbevolen]: de wet eist een afmelding in elk bericht, en een inlog ervoor maakt afmelden moeilijker dan aanmelden (art. 7 lid 3).
   - (b) Altijd eerst inloggen.
5. **Verwijderen (G4).**
   - (a) **Direct, zoals nu, maar heel of hervatbaar (G5)** [aanbevolen].
   - (b) Met een bedenktijd van 30 dagen.
6. **Codewoord en alarm zonder zwaar pad (par. 13).**
   - (a) **Ja, nooit achter het bezitsbewijs** [aanbevolen].
   - (b) Achter het bezitsbewijs, net als geld.

**Voor een mens om te bekijken (gevonden tijdens dit werk).**
- **`/api/carriere/regel/toon` staat in `scripts/lib/publiek.js`** met de reden "een deelbewijs wordt getoond aan iemand zonder RTG-account". Dat is geen van de zeven uitzonderingen van het accountbesluit. Het moet óf een uitzondering worden, óf achter een (gratis) account. Dit is **niet** veranderd, omdat het een besluit is.
- Het commentaar in `server/kern/identiteit/bezitsbewijs.js` (r.44) zegt "valt terug op `aanbevolen`", terwijl `bezitsstand.js` zegt dat de standaard verplicht is. Dat commentaar loopt achter.
- `verificatie.html` toont "A3" bij een lid op A4 (V2, bewijs 4).
- `SCHERMEIGENAAR.json`: zeven schermen zeiden nog "zonder in te loggen" of "zonder account" (os-publiek, os-deelnemer, os-donateur, os-vrijwilliger, labpas, de tafelgast, en de reden bij labpas/livinglab). Rechtgezet in commit 8ec78c52, net als drie zinnen in README. De wegwijzer noemt nu zijn uitzondering (5).
