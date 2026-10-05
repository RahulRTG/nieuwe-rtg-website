# RTG Loop Fabric Decision Dossiers

Datum: 5 oktober 2026

Dit is technisch en productmatig architectuuradvies, geen juridisch advies. Dossiers met `LEGAL_VALIDATION_REQUIRED` blijven fail-closed tot bevoegde validatie.

De oorspronkelijke 144 capabilityblockers zijn teruggebracht tot 22 semantisch verschillende beslissingen. 60 capabilities hebben nu een productbesluit; 84 blijven menselijk of juridisch geblokkeerd.

## Leverage

| Dossier | Type | Capabilities | Veilige default |
|---|---|---:|---|
| D20_PAYMENT_OPERATIONS Betaaluitvoering en financieel bronspoor | LEGAL_VALIDATION_REQUIRED / LEGAL_VALIDATION_REQUIRED | 21 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D01_PERSONAL_MEMORY Persoonlijke levenscontext | PRIVACY_POLICY / RESOLVED_PRODUCT_POLICY | 13 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D06_WORKFORCE_DEVELOPMENT Werknemers-, talent- en loopbaancontext | MIXED / RESOLVED_PRODUCT_POLICY | 11 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D11_COMMUNITY_EVENTS Community-, event- en groepsdeelname | PRIVACY_POLICY / RESOLVED_PRODUCT_POLICY | 11 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D17_SECURITY_CREDENTIALS Credentials, toegang en veiligheidscontext | LEGAL_VALIDATION_REQUIRED / LEGAL_VALIDATION_REQUIRED | 11 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D04_COMMUNICATION_CONTENT Communicatie en gesprekken | MIXED / OPEN | 9 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D19_GOVERNANCE Governance, democratie en vertegenwoordiging | GOVERNANCE / OPEN | 8 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D21_FINANCIAL_PROFILING Financiële inzichten, krediet en AI | LEGAL_VALIDATION_REQUIRED / LEGAL_VALIDATION_REQUIRED | 8 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D07_TRAVEL_EXPERIENCE Reiservaring en toekomstige reisrecall | MIXED / RESOLVED_PRODUCT_POLICY | 7 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D13_DISCOVERY_COMMONS Saloon, sociaal/professioneel netwerk en Commons | PRODUCT_POLICY / RESOLVED_PRODUCT_POLICY | 6 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D14_AI_ASSISTANCE AI-assistentie, inference en voorspellen | ETHICAL/SAFETY / RESOLVED_PRODUCT_POLICY | 6 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D16_ACCOUNT_ORGANIZATION Account-, profiel- en organisatiecontext | PRIVACY_POLICY / OPEN | 6 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D08_FOUNDATION_ASSISTANCE Foundation-hulp en programma-ervaring | ETHICAL/SAFETY / RESOLVED_PRODUCT_POLICY | 5 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D09_CHILD_EDUCATION Kinderen, school en oudercontext | LEGAL_VALIDATION_REQUIRED / LEGAL_VALIDATION_REQUIRED | 4 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D10_RESEARCH_PARTICIPATION Living Lab en onderzoeksdeelname | MIXED / OPEN | 4 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D03_HEALTH_CONTEXT Zorg- en gezondheidscontext | LEGAL_VALIDATION_REQUIRED / LEGAL_VALIDATION_REQUIRED | 3 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D18_IDENTITY_VERIFICATION Identiteitsverificatie en gegevensdeling | LEGAL_VALIDATION_REQUIRED / LEGAL_VALIDATION_REQUIRED | 3 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D22_COMMERCIAL_CLAIMS Prijzen, garanties en commerciële claims | MIXED / OPEN | 3 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D05_DOCUMENT_CONTENT Bestanden, memo en samenvattingen | PRIVACY_POLICY / OPEN | 2 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D02_LOCATION_CONTEXT Locatie en aanwezigheid | PRIVACY_POLICY / OPEN | 1 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D12_DATING Dating en intieme voorkeuren | ETHICAL/SAFETY / LEGAL_VALIDATION_REQUIRED | 1 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |
| D15_SERVICE_IMPROVEMENT Service- en supportverbetering | MIXED / RESOLVED_PRODUCT_POLICY | 1 | Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken. |

## Dossiers

### D20_PAYMENT_OPERATIONS - Betaaluitvoering en financieel bronspoor

**Vraag:** Welke betaaloccurrences mogen na operationele afhandeling fraudepreventie of procesverbetering voeden?

**Waarom code dit niet kan bepalen:** Pay blijft financiële bronwaarheid; learningretentie, fraudedoel en cross-domain gebruik vragen aparte validatie.

**Type:** `LEGAL_VALIDATION_REQUIRED`

**Capabilities (21):** `wbw`, `betalen`, `dom-rekening`, `dom-bank-rekening-open`, `dom-bank-storten`, `dom-bank-sepa`, `dom-bank-incasso`, `dom-bank-passen`, `dom-bank-zakelijk`, `dom-wallet`, `dom-pay-wallet`, `dom-pay-tegoed`, `dom-pay-tegoed-zaak`, `dom-pay-terug`, `dom-pay-vooraf`, `dom-partner-uitbetaling`, `gld-munt`, `gld-rekening`, `gld-splitsen`, `gld-cadeau`, `gld-punten`

**Domeinen:** `pay`

**Optie A - Geen optionele learning:** Betaling, rekening, saldo, kaart, uitbetaling en settlement blijft uitsluitend primaire operationele state.

Product: Betaling, rekening, saldo, kaart, uitbetaling en settlement blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Betaling, rekening, saldo, kaart, uitbetaling en settlement kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Betaling, rekening, saldo, kaart, uitbetaling en settlement kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Betaling, rekening, saldo, kaart, uitbetaling en settlement levert uitsluitend geminimaliseerde failure/recovery zonder koop- of personenprofiel; de persoonlijke koppeling gaat niet mee.

Product: Betaling, rekening, saldo, kaart, uitbetaling en settlement levert uitsluitend geminimaliseerde failure/recovery zonder koop- of personenprofiel; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Kies C voor beoordeelde technische/operationele failures; transactie-inhoud en koopgedrag blijven buiten optionele learning.

**Unlock impact:** 21 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D01_PERSONAL_MEMORY - Persoonlijke levenscontext

**Vraag:** Mag persoonlijke levenscontext later proactief terugkomen of structurele verbetering voeden?

**Waarom code dit niet kan bepalen:** De code bezit persoonlijke functies, maar geen gedeeld besluit over geheugen, profilering of post-service-retentie.

**Type:** `PRIVACY_POLICY`

**Capabilities (13):** `rechterhand`, `neiging`, `privekantoor`, `life`, `doelen`, `dagmetingen`, `gemoed`, `gewoonten`, `training`, `tijdlijn`, `voeding`, `rust`, `ov-spar`

**Domeinen:** `personal-life`

**Optie A - Geen optionele learning:** Persoonlijke doelen, routines, reflecties en welzijnscontext blijft uitsluitend primaire operationele state.

Product: Persoonlijke doelen, routines, reflecties en welzijnscontext blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Persoonlijke doelen, routines, reflecties en welzijnscontext kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Persoonlijke doelen, routines, reflecties en welzijnscontext kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Persoonlijke doelen, routines, reflecties en welzijnscontext levert uitsluitend een expliciet gekozen, niet-identificeerbare structurele les; de persoonlijke koppeling gaat niet mee.

Product: Persoonlijke doelen, routines, reflecties en welzijnscontext levert uitsluitend een expliciet gekozen, niet-identificeerbare structurele les; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Kies B voor expliciete persoonlijke recall; organizational learning alleen via een aparte unlinking-release.

**Unlock impact:** 13 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D06_WORKFORCE_DEVELOPMENT - Werknemers-, talent- en loopbaancontext

**Vraag:** Welke werk- en ontwikkelingsinformatie mag institutional memory of opportunitymatching worden?

**Waarom code dit niet kan bepalen:** De code onderscheidt operationele werkstate, performance, loopbaanclaims en privécommunicatie nog niet als beleid.

**Type:** `MIXED`

**Capabilities (11):** `staff`, `dom-werkvloer`, `ov-kantoorgesprek`, `ov-werkmail`, `member-werk`, `carriereledger`, `supplier-apply`, `werving`, `vakbewijs`, `dom-metier`, `dom-vak`

**Domeinen:** `workos`, `talent`

**Optie A - Geen optionele learning:** Werknemersgedrag, gesprekken, sollicitaties, vakbewijs en loopbaan blijft uitsluitend primaire operationele state.

Product: Werknemersgedrag, gesprekken, sollicitaties, vakbewijs en loopbaan blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Werknemersgedrag, gesprekken, sollicitaties, vakbewijs en loopbaan kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Werknemersgedrag, gesprekken, sollicitaties, vakbewijs en loopbaan kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Werknemersgedrag, gesprekken, sollicitaties, vakbewijs en loopbaan levert uitsluitend procesles zonder individuele productiviteits- of gedragsprofielen; de persoonlijke koppeling gaat niet mee.

Product: Werknemersgedrag, gesprekken, sollicitaties, vakbewijs en loopbaan levert uitsluitend procesles zonder individuele productiviteits- of gedragsprofielen; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Laat objectieve processtate losstaan van mensbeoordeling; kies B alleen voor door de persoon gekozen portfolio- of ontwikkelingsdoelen.

**Unlock impact:** 11 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D11_COMMUNITY_EVENTS - Community-, event- en groepsdeelname

**Vraag:** Mag deelname-, groeps- of eventervaring community- of organizational memory worden?

**Waarom code dit niet kan bepalen:** Aanmelden of deelnemen bepaalt geen zichtbaarheid, herinnering, groepsprofilering of toekomstig hergebruik.

**Type:** `PRIVACY_POLICY`

**Capabilities (11):** `ontmoetingen`, `social`, `rtf-contacten`, `tickets`, `supplier-events`, `dom-agenda`, `dom-meet`, `bk-tickets`, `fs-terrein`, `fs-werk`, `fs-gast`

**Domeinen:** `community-events`

**Optie A - Geen optionele learning:** Deelname, programma, groep en eventervaring blijft uitsluitend primaire operationele state.

Product: Deelname, programma, groep en eventervaring blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Deelname, programma, groep en eventervaring kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Deelname, programma, groep en eventervaring kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Deelname, programma, groep en eventervaring levert uitsluitend capaciteit-, toegankelijkheids- of procesles zonder deelnemershistorie; de persoonlijke koppeling gaat niet mee.

Product: Deelname, programma, groep en eventervaring levert uitsluitend capaciteit-, toegankelijkheids- of procesles zonder deelnemershistorie; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Kies B voor vrijwillige bijdrage; C voor operationele eventlessen zonder deelnemerslijst.

**Unlock impact:** 11 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D17_SECURITY_CREDENTIALS - Credentials, toegang en veiligheidscontext

**Vraag:** Welke securitysignalen mogen voor fraudepreventie of incidentverbetering worden bewaard en gedeeld?

**Waarom code dit niet kan bepalen:** Credentials en veiligheidsgegevens vereisen purpose limitation, toegangsbeperking en juridisch gevalideerde retentie.

**Type:** `LEGAL_VALIDATION_REQUIRED`

**Capabilities (11):** `webauthn`, `eigenaarherstel`, `dom-beschermdeur`, `dom-rtgid`, `dom-veiligheid`, `dom-kmar`, `tg-inlog`, `tg-sso`, `tg-pin`, `tg-zegel`, `tg-link`

**Domeinen:** `identity-organizations`

**Optie A - Geen optionele learning:** Authenticatie, herstel, capabilities, grens- en veiligheidsstate blijft uitsluitend primaire operationele state.

Product: Authenticatie, herstel, capabilities, grens- en veiligheidsstate blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Authenticatie, herstel, capabilities, grens- en veiligheidsstate kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Authenticatie, herstel, capabilities, grens- en veiligheidsstate kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Authenticatie, herstel, capabilities, grens- en veiligheidsstate levert uitsluitend geminimaliseerd beoordeeld security-incident zonder secret; de persoonlijke koppeling gaat niet mee.

Product: Authenticatie, herstel, capabilities, grens- en veiligheidsstate levert uitsluitend geminimaliseerd beoordeeld security-incident zonder secret; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Sta alleen beoordeelde technische occurrences toe; nooit secrets of ruwe credentialinhoud in learning artifacts.

**Unlock impact:** 11 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D04_COMMUNICATION_CONTENT - Communicatie en gesprekken

**Vraag:** Mag bericht-, bel-, mail- of transcriptinhoud verbeteringsmateriaal worden?

**Waarom code dit niet kan bepalen:** Verzenden of ontvangen is geen toestemming voor analyse, geheugen, training of organizational reuse.

**Type:** `MIXED`

**Capabilities (9):** `member-snaps`, `member-connect`, `service-bel`, `ondertiteling`, `connectionos`, `kern-meldingen`, `kern-berichten`, `kern-comm`, `ov-mail-binnen`

**Domeinen:** `communication`

**Optie A - Geen optionele learning:** Berichten, gesprekken, ondertiteling en mail blijft uitsluitend primaire operationele state.

Product: Berichten, gesprekken, ondertiteling en mail blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Berichten, gesprekken, ondertiteling en mail kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Berichten, gesprekken, ondertiteling en mail kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Berichten, gesprekken, ondertiteling en mail levert uitsluitend geaggregeerde delivery- of bereikbaarheidsfouten zonder inhoud; de persoonlijke koppeling gaat niet mee.

Product: Berichten, gesprekken, ondertiteling en mail levert uitsluitend geaggregeerde delivery- of bereikbaarheidsfouten zonder inhoud; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Kies A voor inhoud; sta B alleen toe voor expliciet geselecteerde fragmenten. Technische deliverymetadata krijgt een apart doel.

**Unlock impact:** 9 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D19_GOVERNANCE - Governance, democratie en vertegenwoordiging

**Vraag:** Welke besluiten, beraadslagingen en uitkomsten mogen toekomstige governance informeren?

**Waarom code dit niet kan bepalen:** Stem, mandaat, contract, publieke rol en ambtelijke procedure hebben verschillende openbaarheid en authority.

**Type:** `GOVERNANCE`

**Capabilities (8):** `democratie`, `democratie-partijen`, `contracten`, `rtgone`, `vertegenwoordiging`, `dom-overheid`, `dom-gemeente`, `dom-samen`

**Domeinen:** `governance`

**Optie A - Geen optionele learning:** Voorstel, stem, mandaat, contract en bestuurlijk besluit blijft uitsluitend primaire operationele state.

Product: Voorstel, stem, mandaat, contract en bestuurlijk besluit blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Voorstel, stem, mandaat, contract en bestuurlijk besluit kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Voorstel, stem, mandaat, contract en bestuurlijk besluit kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Voorstel, stem, mandaat, contract en bestuurlijk besluit levert uitsluitend formeel gepubliceerd besluit en procesles met versie/provenance; de persoonlijke koppeling gaat niet mee.

Product: Voorstel, stem, mandaat, contract en bestuurlijk besluit levert uitsluitend formeel gepubliceerd besluit en procesles met versie/provenance; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Kies B/C per formeel proces met immutable besluitcontext; private beraadslaging blijft buiten recall.

**Unlock impact:** 8 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D21_FINANCIAL_PROFILING - Financiële inzichten, krediet en AI

**Vraag:** Welke financiële patronen mogen worden afgeleid, onthouden of voor advies/krediet gebruikt?

**Waarom code dit niet kan bepalen:** Dit raakt profiling, mogelijke rechtsgevolgen, AI-uitlegbaarheid en sterk doelgebonden financiële gegevens.

**Type:** `LEGAL_VALIDATION_REQUIRED`

**Capabilities (8):** `geldwereld`, `dom-bank-inzicht`, `dom-bank-vastelasten`, `dom-bank-spaardoel`, `dom-bank-krediet`, `dom-bank-advies`, `dom-kosten`, `gld-aitegoed`

**Domeinen:** `pay`

**Optie A - Geen optionele learning:** Financieel gedrag, doelen, krediet, kosten en AI-advies blijft uitsluitend primaire operationele state.

Product: Financieel gedrag, doelen, krediet, kosten en AI-advies blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Financieel gedrag, doelen, krediet, kosten en AI-advies kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Financieel gedrag, doelen, krediet, kosten en AI-advies kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Financieel gedrag, doelen, krediet, kosten en AI-advies levert uitsluitend uitsluitend door gebruiker bevestigde persoonlijke analyse voor één doel; de persoonlijke koppeling gaat niet mee.

Product: Financieel gedrag, doelen, krediet, kosten en AI-advies levert uitsluitend uitsluitend door gebruiker bevestigde persoonlijke analyse voor één doel; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Houd A totdat productbeleid en juridische validatie per advies- of kredietdoel bestaan.

**Unlock impact:** 8 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D07_TRAVEL_EXPERIENCE - Reiservaring en toekomstige reisrecall

**Vraag:** Welke reiservaring mag persoonlijk worden onthouden of losgekoppeld operationele verbetering voeden?

**Waarom code dit niet kan bepalen:** Een boeking of reis maakt geen keuze over experience sharing, profiling, locatie of toekomstige aanbevelingen.

**Type:** `MIXED`

**Capabilities (7):** `avondos`, `arrival`, `instantreality`, `dom-reisbureau`, `bk-reizen`, `bk-verblijf`, `bk-reiswijzer`

**Domeinen:** `travelos`

**Optie A - Geen optionele learning:** Reisintentie, verblijf, verplaatsing en ervaring blijft uitsluitend primaire operationele state.

Product: Reisintentie, verblijf, verplaatsing en ervaring blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Reisintentie, verblijf, verplaatsing en ervaring kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Reisintentie, verblijf, verplaatsing en ervaring kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Reisintentie, verblijf, verplaatsing en ervaring levert uitsluitend route-, service- of verstoringskennis zonder reizigershistorie; de persoonlijke koppeling gaat niet mee.

Product: Reisintentie, verblijf, verplaatsing en ervaring levert uitsluitend route-, service- of verstoringskennis zonder reizigershistorie; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Kies B voor persoonlijke triprecall en C voor losgekoppelde verstorings-/toegankelijkheidslessen.

**Unlock impact:** 7 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D13_DISCOVERY_COMMONS - Saloon, sociaal/professioneel netwerk en Commons

**Vraag:** Welke bijdragen mogen publiek/commons worden en welke signalen mogen discovery verbeteren?

**Waarom code dit niet kan bepalen:** Volgen, waarderen, netwerken en publiceren hebben verschillende betekenis; populariteit is geen kwaliteit.

**Type:** `PRODUCT_POLICY`

**Capabilities (6):** `zakelijk`, `socialewereld`, `connect`, `dom-genootschap`, `salon`, `kern-waardering`

**Domeinen:** `world-network`, `saloon`

**Optie A - Geen optionele learning:** Netwerkbijdragen, waarderingen en discoverygedrag blijft uitsluitend primaire operationele state.

Product: Netwerkbijdragen, waarderingen en discoverygedrag blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Netwerkbijdragen, waarderingen en discoverygedrag kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Netwerkbijdragen, waarderingen en discoverygedrag kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Netwerkbijdragen, waarderingen en discoverygedrag levert uitsluitend versiegebonden Commons-inhoud met provenance, zonder globaal reputatiecijfer; de persoonlijke koppeling gaat niet mee.

Product: Netwerkbijdragen, waarderingen en discoverygedrag levert uitsluitend versiegebonden Commons-inhoud met provenance, zonder globaal reputatiecijfer; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Kies B voor expliciete public release en C alleen voor inhoudsrelevantie zonder mensscore of pay-to-rank.

**Unlock impact:** 6 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D14_AI_ASSISTANCE - AI-assistentie, inference en voorspellen

**Vraag:** Welke AI-output mag worden bewaard, geleerd, uitgevoerd of later teruggebracht?

**Waarom code dit niet kan bepalen:** INFERRED, PROPOSED en GENERATED zijn geen menselijke uitspraak, toestemming of authority decision.

**Type:** `ETHICAL/SAFETY`

**Capabilities (6):** `oog`, `ghost`, `knelpunt`, `kern-rahul`, `ov-aandacht`, `stuur`

**Domeinen:** `edge-ai`, `service-support`

**Optie A - Geen optionele learning:** AI-input, output, voorspelling en aandachtssignaal blijft uitsluitend primaire operationele state.

Product: AI-input, output, voorspelling en aandachtssignaal blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** AI-input, output, voorspelling en aandachtssignaal kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: AI-input, output, voorspelling en aandachtssignaal kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** AI-input, output, voorspelling en aandachtssignaal levert uitsluitend door een bevoegde mens geaccepteerde voorstelreferentie met AI-provenance; de persoonlijke koppeling gaat niet mee.

Product: AI-input, output, voorspelling en aandachtssignaal levert uitsluitend door een bevoegde mens geaccepteerde voorstelreferentie met AI-provenance; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Kies B voor door de gebruiker bevestigde assistentiecontext; AI-training blijft een afzonderlijk doel en source truth blijft onaangeraakt.

**Unlock impact:** 6 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D16_ACCOUNT_ORGANIZATION - Account-, profiel- en organisatiecontext

**Vraag:** Welke account- of organisatiestate mag onboarding en service verbeteren?

**Waarom code dit niet kan bepalen:** Accountgebruik is noodzakelijk voor de dienst maar geen toestemming voor gedragsprofilering of cross-domain learning.

**Type:** `PRIVACY_POLICY`

**Capabilities (6):** `member`, `supplier`, `tenant`, `dom-onboarding`, `tg-account`, `tg-aanmeld`

**Domeinen:** `identity-organizations`

**Optie A - Geen optionele learning:** Account, profiel, tenant en onboarding blijft uitsluitend primaire operationele state.

Product: Account, profiel, tenant en onboarding blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Account, profiel, tenant en onboarding kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Account, profiel, tenant en onboarding kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Account, profiel, tenant en onboarding levert uitsluitend geaggregeerde procesfout zonder identiteit of profielinhoud; de persoonlijke koppeling gaat niet mee.

Product: Account, profiel, tenant en onboarding levert uitsluitend geaggregeerde procesfout zonder identiteit of profielinhoud; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Kies C voor geaggregeerde procesfrictie; persoonlijke profielinhoud blijft A tenzij expliciet gekozen.

**Unlock impact:** 6 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D08_FOUNDATION_ASSISTANCE - Foundation-hulp en programma-ervaring

**Vraag:** Mag vrijwillige ervaring uit hulp of Foundation-programma’s bijdragen aan verbetering?

**Waarom code dit niet kan bepalen:** De machtsverhouding maakt een technisch vinkje onvoldoende; weigering mag behandeling of kans nooit verslechteren.

**Type:** `ETHICAL/SAFETY`

**Capabilities (5):** `levenos`, `rugdekking`, `werk-rtf`, `dom-rtfkantoor`, `dom-rtfos`

**Domeinen:** `foundationos`

**Optie A - Geen optionele learning:** Ervaring met hulp, mentoring, kansen en Foundation-projecten blijft uitsluitend primaire operationele state.

Product: Ervaring met hulp, mentoring, kansen en Foundation-projecten blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Ervaring met hulp, mentoring, kansen en Foundation-projecten kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Ervaring met hulp, mentoring, kansen en Foundation-projecten kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Ervaring met hulp, mentoring, kansen en Foundation-projecten levert uitsluitend een vrijwillig vrijgegeven les zonder hulpdossier; de persoonlijke koppeling gaat niet mee.

Product: Ervaring met hulp, mentoring, kansen en Foundation-projecten levert uitsluitend een vrijwillig vrijgegeven les zonder hulpdossier; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Kies B met aantoonbare no-disadvantage en scheid zorg-/hulpdossier van de vrijwillige bijdrage.

**Unlock impact:** 5 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D09_CHILD_EDUCATION - Kinderen, school en oudercontext

**Vraag:** Welke leer- of ervaringscontext rond minderjarigen mag worden bewaard, gedeeld of hergebruikt?

**Waarom code dit niet kan bepalen:** Leeftijd, vertegenwoordiging, kindstem, schoolauthority en bewaartermijn vragen een expliciete beleids- en juridische keuze.

**Type:** `LEGAL_VALIDATION_REQUIRED`

**Capabilities (4):** `opvangwijzer`, `office-school`, `foundation`, `foundation-school`

**Domeinen:** `foundationos`

**Optie A - Geen optionele learning:** Kinderopvang-, leerling-, ouder- en schoolcontext blijft uitsluitend primaire operationele state.

Product: Kinderopvang-, leerling-, ouder- en schoolcontext blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Kinderopvang-, leerling-, ouder- en schoolcontext kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Kinderopvang-, leerling-, ouder- en schoolcontext kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Kinderopvang-, leerling-, ouder- en schoolcontext levert uitsluitend onderwijsprocesverbetering zonder leerlingprofiel; de persoonlijke koppeling gaat niet mee.

Product: Kinderopvang-, leerling-, ouder- en schoolcontext levert uitsluitend onderwijsprocesverbetering zonder leerlingprofiel; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Houd A totdat leeftijdsgebonden assent/consent, schoolrollen en verwijdering zijn gevalideerd.

**Unlock impact:** 4 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D10_RESEARCH_PARTICIPATION - Living Lab en onderzoeksdeelname

**Vraag:** Onder welke voorwaarden mogen studiegegevens, reflecties en resultaten later opnieuw worden gebruikt?

**Waarom code dit niet kan bepalen:** Studiedoel, ethische review, withdrawal, dataset-onomkeerbaarheid en secondary use zijn studiegebonden.

**Type:** `MIXED`

**Capabilities (4):** `dom-lab`, `dom-livinglab`, `dom-livinglab-bewoner`, `dom-labfonds`

**Domeinen:** `living-lab`

**Optie A - Geen optionele learning:** Onderzoeksobservaties, metingen, reflecties en conclusies blijft uitsluitend primaire operationele state.

Product: Onderzoeksobservaties, metingen, reflecties en conclusies blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Onderzoeksobservaties, metingen, reflecties en conclusies kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Onderzoeksobservaties, metingen, reflecties en conclusies kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Onderzoeksobservaties, metingen, reflecties en conclusies levert uitsluitend een versiegebonden gepubliceerd resultaat met provenance; de persoonlijke koppeling gaat niet mee.

Product: Onderzoeksobservaties, metingen, reflecties en conclusies levert uitsluitend een versiegebonden gepubliceerd resultaat met provenance; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Kies B per studie; Commons-publicatie en secondary use krijgen aparte releases.

**Unlock impact:** 4 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D03_HEALTH_CONTEXT - Zorg- en gezondheidscontext

**Vraag:** Welke zorgcontext mag voor welk verbeterdoel worden hergebruikt en wie mag haar terugzien?

**Waarom code dit niet kan bepalen:** De code kan medische gevoeligheid, beroepsgeheim, grondslag en bewaartermijn niet zelf vaststellen.

**Type:** `LEGAL_VALIDATION_REQUIRED`

**Capabilities (3):** `medicijnen`, `dom-care`, `ov-zorgprofiel`

**Domeinen:** `health-care`

**Optie A - Geen optionele learning:** Medicatie, zorgvraag en zorgprofiel blijft uitsluitend primaire operationele state.

Product: Medicatie, zorgvraag en zorgprofiel blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Medicatie, zorgvraag en zorgprofiel kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Medicatie, zorgvraag en zorgprofiel kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Medicatie, zorgvraag en zorgprofiel levert uitsluitend uitsluitend expliciet gevalideerde veiligheidskennis zonder patiëntkoppeling; de persoonlijke koppeling gaat niet mee.

Product: Medicatie, zorgvraag en zorgprofiel levert uitsluitend uitsluitend expliciet gevalideerde veiligheidskennis zonder patiëntkoppeling; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Houd A totdat productbeleid én juridische validatie per doel bestaan.

**Unlock impact:** 3 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D18_IDENTITY_VERIFICATION - Identiteitsverificatie en gegevensdeling

**Vraag:** Mag verificatie- of documentcontext buiten de concrete verificatie of gegevensoverdracht worden gebruikt?

**Waarom code dit niet kan bepalen:** De code kan rechtsgrond, documentretentie, ontvangers en verboden secondary use niet zelf beslissen.

**Type:** `LEGAL_VALIDATION_REQUIRED`

**Capabilities (3):** `verificatie`, `paspoort`, `tg-gegevens`

**Domeinen:** `identity-organizations`

**Optie A - Geen optionele learning:** KYC-, paspoort- en gegevenspoortinhoud blijft uitsluitend primaire operationele state.

Product: KYC-, paspoort- en gegevenspoortinhoud blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** KYC-, paspoort- en gegevenspoortinhoud kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: KYC-, paspoort- en gegevenspoortinhoud kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** KYC-, paspoort- en gegevenspoortinhoud levert uitsluitend een niet-herleidbaar technisch overdrachtsincident; de persoonlijke koppeling gaat niet mee.

Product: KYC-, paspoort- en gegevenspoortinhoud levert uitsluitend een niet-herleidbaar technisch overdrachtsincident; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Kies A voor inhoud; alleen technische kwaliteitsincidenten kunnen na review als C.

**Unlock impact:** 3 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D22_COMMERCIAL_CLAIMS - Prijzen, garanties en commerciële claims

**Vraag:** Mag een prijs- of garantieclaim worden hergebruikt voor beleid, ranking of toekomstige beslissingen?

**Waarom code dit niet kan bepalen:** Een commerciële claim is betwistbaar en wordt niet waar door herhaling of betaling.

**Type:** `MIXED`

**Capabilities (3):** `gld-prijzen`, `gld-claims`, `gld-prijsgarantie`

**Domeinen:** `pay`

**Optie A - Geen optionele learning:** Prijs-, tarief- en garantieclaims blijft uitsluitend primaire operationele state.

Product: Prijs-, tarief- en garantieclaims blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Prijs-, tarief- en garantieclaims kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Prijs-, tarief- en garantieclaims kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Prijs-, tarief- en garantieclaims levert uitsluitend geverifieerde procesuitkomst zonder mens- of zaakscore; de persoonlijke koppeling gaat niet mee.

Product: Prijs-, tarief- en garantieclaims levert uitsluitend geverifieerde procesuitkomst zonder mens- of zaakscore; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Kies B voor zaakgebonden behandeling; pas na source verification kan een geminimaliseerde procesles ontstaan.

**Unlock impact:** 3 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D05_DOCUMENT_CONTENT - Bestanden, memo en samenvattingen

**Vraag:** Mag documentinhoud of een afgeleide samenvatting voor learning of recall worden gebruikt?

**Waarom code dit niet kan bepalen:** Toegang tot een bestand zegt niets over hergebruik van inhoud, afgeleiden, AI of retentie.

**Type:** `PRIVACY_POLICY`

**Capabilities (2):** `dom-bestanden`, `kern-memo`

**Domeinen:** `files-documents`

**Optie A - Geen optionele learning:** Bestandsinhoud, memo en samenvatting blijft uitsluitend primaire operationele state.

Product: Bestandsinhoud, memo en samenvatting blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Bestandsinhoud, memo en samenvatting kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Bestandsinhoud, memo en samenvatting kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Bestandsinhoud, memo en samenvatting levert uitsluitend documenttype- en procesmetadata zonder inhoud; de persoonlijke koppeling gaat niet mee.

Product: Bestandsinhoud, memo en samenvatting levert uitsluitend documenttype- en procesmetadata zonder inhoud; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Kies B per document en doel; metadata alleen is geen inhoudsrelease.

**Unlock impact:** 2 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D02_LOCATION_CONTEXT - Locatie en aanwezigheid

**Vraag:** Mag locatiegeschiedenis worden gebruikt voor recall of verbetering buiten de actuele handeling?

**Waarom code dit niet kan bepalen:** Actuele locatie delen bepaalt niet of een historische bewegings- of aanwezigheidslijn mag ontstaan.

**Type:** `PRIVACY_POLICY`

**Capabilities (1):** `kern-locatie`

**Domeinen:** `personal-life`

**Optie A - Geen optionele learning:** Locatie en aanwezigheid blijft uitsluitend primaire operationele state.

Product: Locatie en aanwezigheid blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Locatie en aanwezigheid kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Locatie en aanwezigheid kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Locatie en aanwezigheid levert uitsluitend een plaatsgebonden signaal zonder persoon of routehistorie; de persoonlijke koppeling gaat niet mee.

Product: Locatie en aanwezigheid levert uitsluitend een plaatsgebonden signaal zonder persoon of routehistorie; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Bewaar standaard geen geschiedenis; B alleen per concreet doel en korte expiry.

**Unlock impact:** 1 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D12_DATING - Dating en intieme voorkeuren

**Vraag:** Mag datinginteractie ooit learning, ranking of cross-domain recall voeden?

**Waarom code dit niet kan bepalen:** Dit raakt intieme voorkeuren en veiligheidsrisico’s; productgebruik is geen profilingtoestemming.

**Type:** `ETHICAL/SAFETY`

**Capabilities (1):** `vonk`

**Domeinen:** `community-events`

**Optie A - Geen optionele learning:** Datinginteractie en intieme voorkeuren blijft uitsluitend primaire operationele state.

Product: Datinginteractie en intieme voorkeuren blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Datinginteractie en intieme voorkeuren kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Datinginteractie en intieme voorkeuren kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Datinginteractie en intieme voorkeuren levert uitsluitend uitsluitend beoordeeld safety-incident zonder matchingprofiel; de persoonlijke koppeling gaat niet mee.

Product: Datinginteractie en intieme voorkeuren levert uitsluitend uitsluitend beoordeeld safety-incident zonder matchingprofiel; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Kies A als platformregel; eventuele safety-signalen blijven doelgebonden en strikt afgescheiden.

**Unlock impact:** 1 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

### D15_SERVICE_IMPROVEMENT - Service- en supportverbetering

**Vraag:** Mag supportfeedback of ticketinhoud organizational improvement voeden?

**Waarom code dit niet kan bepalen:** Een hulpvraag kan gevoelige context bevatten; oplossen is geen automatische release voor analyse of training.

**Type:** `MIXED`

**Capabilities (1):** `service`

**Domeinen:** `service-support`

**Optie A - Geen optionele learning:** Supportticket, klacht en oplossingsgesprek blijft uitsluitend primaire operationele state.

Product: Supportticket, klacht en oplossingsgesprek blijft uitsluitend primaire operationele state. Privacy: Geen optionele learningkopie. Learning: Alleen operationele bronstate. AI: Geen AI-gebruik buiten de primaire dienst. Cross-domain: Uit. Retention: Bronretentie; geen extra memory. Gebruikerscontrole: Geen optionele deelname. Implementatie: Deny-gate; geen learning artifact of recallprojectie.

**Optie B - Vrijwillig en doelgebonden:** Supportticket, klacht en oplossingsgesprek kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen.

Product: Supportticket, klacht en oplossingsgesprek kan alleen na een afzonderlijke, begrijpelijke keuze aan één genoemd verbeterdoel bijdragen. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Source-issued eligibility met audience, fields, expiry en withdrawal.

**Optie C - Alleen structureel geminimaliseerd:** Supportticket, klacht en oplossingsgesprek levert uitsluitend door behandelaar geminimaliseerde procesles zonder klantinhoud; de persoonlijke koppeling gaat niet mee.

Product: Supportticket, klacht en oplossingsgesprek levert uitsluitend door behandelaar geminimaliseerde procesles zonder klantinhoud; de persoonlijke koppeling gaat niet mee. Privacy: Doelgebonden minimale gegevens. Learning: Alleen vrijgegeven of structureel geminimaliseerde artifacts. AI: AI blijft een afzonderlijke use-scope. Cross-domain: Alleen met afzonderlijke source-issued eligibility. Retention: Purpose-bound expiry, unlinking en revocation. Gebruikerscontrole: Inzien, corrigeren, intrekken waar toepasselijk. Implementatie: Reviewpoort, allowlist en aantoonbare unlinking vóór organizational memory.

**Veiligste default:** Optionele learning en cross-domain recall blijven dicht; de primaire dienst blijft werken.

**Aanbevolen productrichting:** Kies C voor procesmetadata en B voor expliciet geselecteerde inhoud.

**Unlock impact:** 1 capabilities kunnen na een besluit naar `NEEDS_TECHNICAL_PREREQUISITE`; geen wordt zonder technische bewijsslice direct READY.

## Afzonderlijk onderwijsdossier

### D23_LIBRARY_EDUCATION_RELEASE - Library Edition naar Academy

**Vraag:** Onder welke edition-bound voorwaarden mag Academy Library-inhoud gebruiken?

**Waarom:** RightsGrant kent education als actie, maar applicability, ontvangerauthority, withdrawal en cursusversioning vormen nog geen bewezen contract.

**Veiligste default:** Geen Library-naar-Academy overdracht.

**Aanbeveling:** Begin met één gratis, interne Academy-context, exact Edition X, geselecteerde ContentNodes, citation verplicht, geen derivatives of AI-training, en withdrawal voor toekomstige cursusversies.

**Capabilities:** `dom-library`, `leerhuis`, `dom-les`, `dom-leerstof`, `dom-onderwijs`, `ov-bijles`, `rtf-leerpaspoort`

De vereiste deelbesluiten staan machineleesbaar in `educationDossier.decisions` van `LOOP-FABRIC-DECISION-DOSSIERS.json`.

## Kandidaat Learning Constitution

### C01_SERVICE_IS_NOT_LEARNING_CONSENT

Gebruik van een RTG-dienst is geen toestemming voor optionele learning.

Lost blockers op uit: `D01`, `D04`, `D07`, `D11`, `D13`, `D15`, `D16`.

Domeinen: `personal-life`, `communication`, `travelos`, `community-events`, `saloon`, `service-support`, `identity-organizations`.

Tegenvoorbeeld: Noodzakelijke technische verwerking voor levering van de dienst is geen optionele learning.

Uitzonderingen: Een andere aantoonbare grond kan gelden voor strikt noodzakelijke security of wettelijke verplichting.

Runtime enforcement: Iedere promotion vraagt source-issued eligibility met purpose en basis; afwezig betekent DENY.

Benodigde tests: implicit use cannot issue eligibility; no-consent does not degrade primary service.

### C02_NO_SILENT_MEMORY_PROMOTION

Personal en Relationship Memory promoveren nooit stil naar Organizational, Domain/Asset of Commons Memory.

Lost blockers op uit: `D01`, `D04`, `D05`, `D06`, `D07`, `D11`.

Domeinen: `personal-life`, `communication`, `files-documents`, `workos`, `talent`, `travelos`, `community-events`.

Tegenvoorbeeld: Een bronobject dat vanaf creatie aantoonbaar Domain/Asset-state is, hoeft niet eerst Personal te zijn.

Uitzonderingen: Een nieuwe afzonderlijke release kan een geminimaliseerd nieuw artifact uitgeven.

Runtime enforcement: memoryClass is immutable in eligibility; promotion vereist nieuw artifact, nieuwe eligibility en lineage.

Benodigde tests: personal-to-organizational denied; personal-to-commons denied; new released artifact keeps provenance.

### C03_COMMONS_RELEASE

Commons-publicatie vereist een afzonderlijke expliciete, versiegebonden release.

Lost blockers op uit: `D10`, `D13`, `D19`, `D23`.

Domeinen: `living-lab`, `saloon`, `world-network`, `governance`, `libraryos`, `academy`.

Tegenvoorbeeld: Reeds publiek bronmateriaal kan als publieke bronreferentie worden gebruikt binnen zijn bestaande licentie.

Uitzonderingen: Wettelijke publicatieplicht kan een andere aantoonbare basis hebben.

Runtime enforcement: publish=true alleen bij source-issued release met scope, version, audience en withdrawalbeleid.

Benodigde tests: private artifact cannot become commons; new version does not inherit release silently.

### C04_AI_PURPOSE_SEPARATION

AI-assistentie, AI-inference en AI-training zijn afzonderlijke doelen.

Lost blockers op uit: `D03`, `D04`, `D05`, `D14`, `D18`, `D21`, `D23`.

Domeinen: `health-care`, `communication`, `files-documents`, `edge-ai`, `identity-organizations`, `pay`, `libraryos`, `academy`.

Tegenvoorbeeld: Deterministische lokale tekstzoekfunctie is geen modeltraining of inference.

Uitzonderingen: Geen.

Runtime enforcement: uses.ai krijgt benoemde modes; ontbrekende mode is denied; AI-herkomst blijft INFERRED/PROPOSED/GENERATED.

Benodigde tests: assistant consent does not allow training; AI output cannot become SOURCE_VERIFIED.

### C05_STRUCTURAL_LESSON_UNLINKING

Een persoonlijke Observation kan alleen organizational improvement voeden via een apart, minimaal artifact waarvan onnodige persoonskoppeling aantoonbaar is verwijderd.

Lost blockers op uit: `D06`, `D07`, `D08`, `D11`, `D15`, `D16`, `D20`.

Domeinen: `workos`, `talent`, `travelos`, `foundationos`, `community-events`, `service-support`, `identity-organizations`, `pay`.

Tegenvoorbeeld: Een individuele klachtbehandeling moet de relatie tijdelijk behouden om terug te koppelen.

Uitzonderingen: Legal hold of betwisting kan beperkte koppeling langer vereisen; dat geeft geen bredere recall.

Runtime enforcement: minimization allowlist, unlink receipt en aparte retention voor bron en lesson.

Benodigde tests: lesson survives permitted unlink; identity cannot be resolved after unlink; contest return path remains scoped.

### C06_FOUNDATION_NO_DISADVANTAGE

Foundation-hulp, onderwijsdeelname of kansen worden niet afhankelijk gemaakt van toestemming voor optionele learning.

Lost blockers op uit: `D08`, `D09`.

Domeinen: `foundationos`.

Tegenvoorbeeld: Informatie die noodzakelijk is om de aangevraagde dienst veilig te leveren mag vereist zijn.

Uitzonderingen: Noodzakelijke dienstdata blijft strikt bij dat doel.

Runtime enforcement: service decision mag geen optional eligibility-status lezen; architecture gate bewaakt de verboden dependency.

Benodigde tests: denied learning consent keeps service eligibility equal; withdrawal cannot reduce support.

### C07_EMPLOYEE_SURVEILLANCE_BOUNDARY

Persoonlijke productiviteit, communicatie en gedrag worden niet automatisch organizational memory.

Lost blockers op uit: `D04`, `D06`, `D15`.

Domeinen: `communication`, `workos`, `talent`, `service-support`.

Tegenvoorbeeld: Objectieve status van een toegewezen taak of geautoriseerde proceschange is organizationele processtate.

Uitzonderingen: Beoordeelde safety/security-incidenten volgen een afzonderlijk doel en authority.

Runtime enforcement: employee-linked fields ontbreken uit organizational artifact allowlists; recall weigert person-scoped refs.

Benodigde tests: employee note not institutional memory; process receipt may remain without worker profile.

### C08_ASSET_NOT_OCCUPANT

Een volgende gebruiker of bewoner erft asset history, niet automatisch de persoonsgeschiedenis van de vorige gebruiker.

Lost blockers op uit: `D01`, `D02`, `D07`, `D11`.

Domeinen: `personal-life`, `travelos`, `community-events`, `livingos`.

Tegenvoorbeeld: Een gedeelde contractuele verplichting kan bewust aan de assetrelatie zijn gekoppeld.

Uitzonderingen: Overdracht met expliciete bevoegdheid en dataminimalisatie.

Runtime enforcement: assetRef en actorRef hebben gescheiden retention; relatiebeëindiging unlinkt actor voor toekomstige recall.

Benodigde tests: next occupant sees asset intervention; next occupant cannot resolve former actor.

### C09_EPISTEMIC_PROVENANCE

Cross-domain overdracht verandert claim, inference of observatie niet vanzelf in geverifieerde waarheid.

Lost blockers op uit: `D10`, `D13`, `D14`, `D19`, `D22`, `D23`.

Domeinen: `living-lab`, `saloon`, `world-network`, `edge-ai`, `governance`, `pay`, `libraryos`, `academy`.

Tegenvoorbeeld: Een bevoegde bron kan na eigen verificatie een nieuw SOURCE_VERIFIED artifact uitgeven.

Uitzonderingen: Het nieuwe artifact behoudt lineage naar het oorspronkelijke epistemische type.

Runtime enforcement: epistemicType is verplicht en immutable per artifact; consumer kan alleen nieuw bronartifact uitgeven.

Benodigde tests: claim remains claim across three domains; verified artifact requires source authority.

### C10_CURRENT_AUTHORITY_AT_RECALL

Historische toegang geeft geen permanent recht op Recall.

Lost blockers op uit: `D03`, `D04`, `D05`, `D06`, `D09`, `D10`, `D17`, `D18`, `D19`, `D20`.

Domeinen: `health-care`, `communication`, `files-documents`, `workos`, `foundationos`, `living-lab`, `identity-organizations`, `governance`, `pay`.

Tegenvoorbeeld: Een publiek released Commons-object kan zonder historische relatie leesbaar blijven.

Uitzonderingen: Audit/verantwoording kan beperkte, afzonderlijk geautoriseerde toegang vereisen.

Runtime enforcement: Recall resolveert actuele authority, purpose, retention en source visibility bij iedere presentatie.

Benodigde tests: revoked role denies recall; public release follows current distribution status.

### C11_MINOR_CONTEXT_FAILS_CLOSED

Optionele learning rond minderjarigen blijft dicht zonder leeftijdsadequate toestemming, vertegenwoordiging en doel.

Lost blockers op uit: `D09`.

Domeinen: `foundationos`.

Tegenvoorbeeld: Noodzakelijke schooladministratie is operationele state en geen optionele learning.

Uitzonderingen: Alleen na gevalideerd beleid per leeftijd, rol en doel.

Runtime enforcement: minor sensitivity forceert HUMAN_REVIEW_REQUIRED totdat policyref en authority bestaan.

Benodigde tests: guardian relation alone does not publish; expired representation denies recall.

### C12_HIGH_IMPACT_SEPARATION

Zorg, financiële profilering, credentials en intieme context krijgen geen generiek cross-domain learningpad.

Lost blockers op uit: `D03`, `D12`, `D17`, `D18`, `D21`.

Domeinen: `health-care`, `community-events`, `identity-organizations`, `pay`.

Tegenvoorbeeld: Een geminimaliseerd technisch incident kan na menselijke review een operationele procesles worden.

Uitzonderingen: Doelgebonden gevalideerde adapters per domein, nooit een catch-all.

Runtime enforcement: sensitivity policy blokkeert cross-domain en AI standaard; expliciete domeinadapter vereist.

Benodigde tests: high-impact artifact rejected by generic adapter; technical incident excludes source payload.

