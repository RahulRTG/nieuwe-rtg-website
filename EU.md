# RTG en de Europese regels: wat de code doet, wat een mens moet doen

*Opgesteld 2 augustus 2026. Dit is de kaart van de Europese (en waar nodig
Nederlandse) regels die op dit platform van toepassing zijn, met per regel:
wat er al in de code staat, wat er deze ronde bij is gekomen, en wat
uitsluitend een mens kan afmaken. Een codebase kan niet "legaal zijn"; hij
kan de naleving wel afdwingbaar maken. Dit document is voorlichting, geen
juridisch advies -- de externe toets (taak 22) en een jurist blijven nodig.*

## AVG / GDPR

**In de code, al langer:** privacy by design met codenamen (echte namen in de
gescheiden kluis, `accounts.js`); vergetelheid die ook mediastore, kluis en
ledensites wist; het inzagejournaal; bewaartermijnen; versleuteling-at-rest
(RTG_ENC_KEY); de verwerkingsregister-vragen als papierwerk in de boardroom
(18 vragen, go-live blokkeert zolang ze openstaan); dagelijkse back-ups.

**Deze ronde:** het privacybeleid draagt nu het echte vestigingsadres
(Overhoeksplein 1, 1031 KS Amsterdam), het vestigingsnummer en een echt
contactadres in plaats van een `.example`-placeholder; en een eigen paragraaf
over artikel 22: het aanmeldgesprek is AI-ondersteund maar het BESLUIT neemt
een medewerker op naam (`/api/aanmelding/beslis`, achter officeAuth, met de
naam van de beslisser in het spoor) -- dat stond al zo in de code, het stond
alleen nergens opgeschreven. Wie het oneens is kan om herbeoordeling door een
(andere) mens vragen; het recht op klagen bij de AP staat er nu bij.

**Mensenwerk:** de 16 open papierwerkvragen (FG ja/nee met onderbouwing,
bewaartermijnen, DPIA, doorgifte); verwerkersovereenkomsten met Stripe en
Anthropic controleren; bewaarbeleid identiteitskluis (taak 25).

## AI-verordening (2024/1689)

**Deze ronde:** de vaste AI-melding in de leden-app ("Rahul is een AI · over
passen en boekingen beslist altijd een mens") -- artikel 50 vraagt dat je het
WEET, niet dat je het te horen krijgt als je ernaar vraagt; de voorwaarden
zijn daarop aangepast. De AI-gegenereerde campagnebeelden (in eigen huis,
zonder echte personen) zijn nu als AI-gegenereerd benoemd in de alt-teksten
en in het privacybeleid.

**Al langer in de code:** de AI belooft nooit toegang, goedkeuring of een
boeking (merkregel, in de system prompts en getoetst); keuringsregel 34 dwingt
af dat elke AI-ingang de toegangsregel draagt.

**Mensenwerk:** de intake blijft juridisch een grijs gebied tussen "beperkt
risico" en meer; laat de kwalificatie meelopen in het Wft/AVG-adviesuur.

## DSA (digitaledienstenverordening)

**In de code, al langer:** melden en blokkeren in de sociale laag; De Salon
toont uitsluitend gecureerde, met naam gelabelde partnerposts ("Uit De Salon ·
naam" is in wezen reclametransparantie); geen verslavende patronen en geen
donkere patronen (merkregel); kinderbescherming (t/m 15 niet vindbaar, dm's
voor niemand leesbaar).

**Deze ronde:** een benoemd centraal contactpunt voor inhoudsmeldingen en
toezichthouders in het privacybeleid.

**Mensenwerk:** RTG is naar verwachting een "kleine" tussenhandelsdienst
(geen VLOP); bij groei boven 50 werknemers/10M omzet komen er
transparantieverslagplichten bij. Jaarlijks herijken.

## Consumentenrecht (richtlijn consumentenrechten, Omnibus)

**In de code, al langer:** de voorwaarden benoemen het herroepingsrecht en de
uitzondering voor diensten op datum/tijdstip; totaalprijzen per dienst; de
pakketreis-afbakening (losse diensten, bewust nooit gebundeld); prijzen ex/inc
btw benoemd; de ledenprijsgarantie.

**Deze ronde:** de wettelijke identificatiegegevens compleet (BW 3:15d):
KvK-nummer, vestigingsadres en e-mailadres op de juridische pagina's.

**Mensenwerk:** bij elke "van/voor"-prijsactie geldt de 30-dagenregel
(laagste prijs van de afgelopen 30 dagen tonen); er staat nu geen
doorstreepprijs-mechaniek in de code, dus dit is een regel voor later.
Let op: het EU-ODR-platform is medio 2025 gestopt; een ODR-link is dus niet
meer verplicht en hoort er ook niet meer in.

## Toegankelijkheid (European Accessibility Act, sinds juni 2025)

**In de code, al langer:** de eigen a11y-keuring (`scripts/a11y.js`,
A11Y_STRICT in CI) en `test/a11ykeuring.test.js`; toetsenbord-bedienbaarheid
is onderdeel van de schermtoetsen (knop-in-knop zakt de wings-toets).

**Mensenwerk:** een toegankelijkheidsverklaring publiceren zodra er echt
verkocht wordt; de keuring dekt de vlaggenschip-schermen, niet alle 189.

## Betaaldiensten (PSD2/EMD2) en de Wft -- de scherpste rand

**In de code, al langer:** RTG houdt geen reizigersgeld onder zich (de
partner is merchant of record, staat zo in de voorwaarden); Stripe als rail;
productie weigert te starten zonder betaalconfiguratie.

**Niet in code op te lossen, en met stip het urgentst:**
1. **"RTG Bank" als naam schendt Wft artikel 3:7** (het woord "bank" zonder
   bankvergunning; zie MARKT.md met bron). Hernoemen is een merkbesluit van
   de eigenaar -- 41 bestanden verwijzen naar de naam, de hernoeming zelf is
   een dag werk zodra de nieuwe naam er is. Ook "sparen en krediet" in de
   app-gids moet dan mee.
2. **RTG Pay-saldi zijn elektronisch geld.** Route om klein te beginnen: de
   DNB-vrijstelling (tot 5M uitstaand, max 150 euro per rekening,
   registratie + jaarrapportage). Zie MARKT.md; dit is taak 23.

## Overig, om niet te vergeten

- **DAC7**: zodra partners via het platform aan consumenten verkopen en RTG
  de betaling faciliteert, kan de platform-rapportageplicht aan de
  Belastingdienst gaan spelen. Mensenwerk, jaarlijks.
- **P2B (platform-to-business)**: partners hebben recht op uitleg over
  ranking (de Mall-etages) en een klachtafhandeling. De partnervoorwaarden
  zijn de plek; nu nog niet beschreven.
- **NIS2**: RTG valt naar verwachting onder geen enkele NIS2-sector op deze
  schaal; herijken bij groei.

## De pinnen in de toetsen

`test/eu-naleving.test.js` legt vast wat hierboven "in de code" heet: de
vaste AI-melding staat echt in de app, de juridische pagina's dragen echt
het adres en geen placeholder meer, het aanmeldbesluit loopt echt door een
mens, en de campagnebeelden dragen echt het AI-label. Zakt een van die
pinnen, dan is dit document aan het liegen -- en dan hoort de bouw te breken.
