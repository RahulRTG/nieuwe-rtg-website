/* DE VERKLAARDE RANDEN -- wat een mens over een rand heeft vastgesteld.

   scripts/verstrengeling.js kan drie soorten AFLEIDEN (laagrand, eigen data,
   gemeten primitief) en de rest niet. Die rest heet ONBEKEND, en dat getal moet
   naar nul -- niet door de meter slimmer te maken maar door hier een regel bij
   te schrijven met een reden die klopt.

   Een regel is: { van, naar, soort, reden }. Van en naar zijn knopen in de vorm
   laag:domein, precies zoals ze in het rapport staan.

   DE REDEN IS HET HELE PUNT. 'hoort zo' verklaart niets; het onderdrukt alleen
   een melding. Wie een rand niet in een zin kan uitleggen, heeft hem niet
   begrepen en laat hem beter op ONBEKEND staan -- daar is dat woord voor.

   LEGACY is een eerlijke soort: bekend, fout, en niet vandaag op te lossen.
   Een rand daarheen verplaatsen is een besluit dat je kunt terugvinden; hem
   DOMEINRELATIE noemen om van het getal af te zijn, is de meter kapotmaken. */
module.exports = [
  /* DE RAILS ONDER EEN MOTOR. server/ai.js kiest tussen vier modelaanbieders en
     server/betaal.js tussen betaalproviders. Dat is geen verstrengeling maar de
     enige plek waar zo'n keuze hoort: een adapter per rail, en een motor die
     hem uitkiest. MAGNAATLAB.md zegt het andersom voor de betaalkant -- een
     simulatie-adapter vervangt de RAIL, nooit de poort -- en dat kan alleen
     omdat de rails hier los naast elkaar liggen. */
  { van: 'motor:ai', naar: 'motor:anthropic', soort: 'DOMEINRELATIE',
    reden: 'modelrail: server/ai.js r.13 kiest tussen vier aanbieders, elk een eigen dunne client' },
  { van: 'motor:ai', naar: 'motor:openai', soort: 'DOMEINRELATIE',
    reden: 'modelrail: zie motor:ai -> motor:anthropic' },
  { van: 'motor:ai', naar: 'motor:gemini', soort: 'DOMEINRELATIE',
    reden: 'modelrail: zie motor:ai -> motor:anthropic' },
  { van: 'motor:ai', naar: 'motor:local-ai', soort: 'DOMEINRELATIE',
    reden: 'modelrail, en de enige die zonder externe verbinding werkt (RTG_EXTERNE_AI_UIT=1 laat deze over)' },
  { van: 'motor:betaal', naar: 'motor:stripe', soort: 'DOMEINRELATIE',
    reden: 'betaalrail: server/betaal.js r.36 laadt de client alleen met een sleutel, in een try -- geen sleutel is geen rail' },
  { van: 'motor:betaal', naar: 'motor:mollie', soort: 'DOMEINRELATIE',
    reden: 'betaalrail: zie motor:betaal -> motor:stripe' },

  /* DE MUTATIEPOORT. kern/mutatie.js is de plek waar een schrijfroute zijn
     herhaalgedrag verklaart (MUTATIECONTRACT.md). Elke schrijvende module hoort
     hem aan te roepen; dat is de bedoeling en niet een rand die weg moet. */
  { van: 'domein:appstore', naar: 'domein:mutatie', soort: 'BELEID',
    reden: 'kern/appstore/brug.js r.83 roept mutatie.poort() aan: het huis van de mutatiesemantiek (MUTATIECONTRACT.md)' },

  /* DE IDENTITEITSKLUIS EN ZIJN EIGEN OPSLAG. accounts/ draagt de echte namen;
     migraties en pgaccounts zijn zijn schema en zijn PostgreSQL-kant, geen
     vreemde domeinen. Ze heten alleen 'lek' omdat de kluis veel gebruikers
     heeft -- dat is precies wat je van een kluis verwacht. */
  { van: 'motor:accounts', naar: 'motor:migraties', soort: 'EIGEN_DATA',
    reden: 'accounts/index.js r.29: het schema van de identiteitskluis zelf' },
  { van: 'motor:accounts', naar: 'motor:pgaccounts', soort: 'EIGEN_DATA',
    reden: 'accounts/mirror.js r.93: de PostgreSQL-kant van diezelfde kluis' },

  /* ---- DE OPSLAG EN HAAR RAILS ---- */
  { van: 'motor:betaal', naar: 'motor:adyen', soort: 'DOMEINRELATIE',
    reden: 'betaalrail, zelfde vorm als stripe en mollie hierboven: een adapter per rail en een motor die kiest' },
  { van: 'motor:betaal-sandbox', naar: 'motor:iban', soort: 'DOMEINRELATIE',
    reden: 'de zandbak maakt geldige rekeningnummers aan; de IBAN-regels wonen op een plek en niet twee keer' },
  { van: 'motor:db', naar: 'motor:pg', soort: 'DOMEINRELATIE',
    reden: 'db/postgres.js r.132 maakt de eigen PostgreSQL-client (server/pg/) -- de opslag en haar protocol, geen twee domeinen' },
  { van: 'motor:pg', naar: 'motor:db', soort: 'DOMEINRELATIE',
    reden: 'de tegenrichting: pg/sync.js r.49 leest TX_SOORT uit het grootboek om te weten welke tabellen gedekt zijn. Wederkerig, en dat is hier de bedoeling: het protocol moet weten wat de opslag boekt' },
  { van: 'motor:db', naar: 'domein:werkvormen', soort: 'DOMEINRELATIE',
    reden: 'db/index.js r.27 haakt de werkvormen aan de database (haakAan): welke soorten zaak er bestaan is een eigenschap van de opslag zelf' },
  { van: 'motor:bus', naar: 'motor:redis', soort: 'DOMEINRELATIE',
    reden: 'de bus over meerdere servers; zonder redis is hij in-proces, en dat is dezelfde bus met een andere rail' },
  { van: 'motor:bus', naar: 'domein:envelop', soort: 'BELEID',
    reden: 'bus.js r.35: elk bericht krijgt de envelop van OS.md (id, tijd, actor, correlatie, oorzaak, classificatie). Een bus zonder envelop levert berichten zonder keten en zonder classificatie' },

  /* ---- DE BEWAARKETEN. Drie bestanden, een onderwerp: welke gegevens hoe lang
     blijven. Ze zijn geknipt op de omvangsgrens en niet op een naad. ---- */
  { van: 'motor:bewaarwacht', naar: 'motor:bewaartermijnen', soort: 'DOMEINRELATIE',
    reden: 'de wacht leest de termijnen; hetzelfde onderwerp (AVG-bewaartermijnen) over meerdere bestanden' },
  { van: 'motor:bewaartermijnen', naar: 'motor:bewaarbeleid-eigenregie', soort: 'DOMEINRELATIE',
    reden: 'r.44 leest EIGEN_REGIE: de termijnen die een lid zelf mag kiezen, naast het gewone beleid uit ./bewaarbeleid' },

  /* ---- DOMEINEN DIE ELKAAR ECHT NODIG HEBBEN ---- */
  { van: 'domein:bedrijf', naar: 'domein:werkcommand', soort: 'DOMEINRELATIE',
    reden: 'bedrijf/geheugen.js r.44 gebruikt maakWerkRegister: het zakelijke geheugen leest wat er te doen staat, en dat register woont in werkcommand' },
  { van: 'domein:foundation', naar: 'domein:school', soort: 'DOMEINRELATIE',
    reden: 'foundation/gasten/gezinsleven.js r.7 leest schoolPunten uit de schoolplanner: het gezinsleven van de RTFoundation gaat over kinderen die naar school gaan' },
  { van: 'domein:foundation', naar: 'domein:agenda-pro', soort: 'DOMEINRELATIE',
    reden: 'zelfde bestand: het gezinsleven zet afspraken in de agenda' },
  { van: 'domein:appstore', naar: 'domein:platformfout', soort: 'DOMEINRELATIE',
    reden: 'appstore/brug.js r.28: de gedeelde foutvorm van het platform, zodat een derdenapp dezelfde foutmelding krijgt als de rest van het huis' },
  { van: 'domein:bankregie', naar: 'domein:bevoegdheid', soort: 'BELEID',
    reden: 'bankregie/index.js r.22 leest de bevoegdheden (WALLET_SALDO, GELD_UITGEVEN): wat de bank mag is beleid en hoort niet in de bankcode zelf te staan (TOKEN.md)' },
  { van: 'domein:clips-studio', naar: 'domein:ondertitels', soort: 'DOMEINRELATIE',
    reden: 'clips-studio.js r.42 gebruikt schoonCues en CUES_MAX: ondertiteling is een eigen onderwerp (TOEGANKELIJK.md) en wordt door de studio gebruikt, niet nagebouwd' },
  { van: 'domein:mall', naar: 'domein:ervaring', soort: 'DOMEINRELATIE',
    reden: 'mall/aanbod.js r.52 leest ratingVanZaak: de waardering van een zaak hoort bij de ervaring en wordt in de mall alleen getoond' },
  { van: 'domein:stadsweefsel', naar: 'domein:navigatie', soort: 'DOMEINRELATIE',
    reden: 'stadsweefsel/geografie.js r.31 gebruikt REF en BOUNDS: waar Nederland ligt staat op een plek' },
  { van: 'domein:vakwerk', naar: 'domein:klantenboek', soort: 'DOMEINRELATIE',
    reden: 'vakwerk/index.js r.28 gebruikt geldDag uit het klantenboek: de vakman werkt op de dagen die bij de klant staan' },
  { van: 'domein:school', naar: 'domein:schooladvies', soort: 'DOMEINRELATIE',
    reden: 'school/analyse-signalen.js r.15 gebruikt uitspraak(): het advies is een eigen onderwerp met een eigen grens, en de analyse leest het' },
  { van: 'motor:config', naar: 'motor:local-ai', soort: 'DOMEINRELATIE',
    reden: 'config/productie-ai.js r.16 gebruikt de URL-normalisatie van de lokale AI om de opstelling te keuren; de regel voor een geldige URL staat bij de client en niet twee keer' },

  /* ---- EEN OPEN VRAAG, EN DIE WORDT NIET WEGGESCHREVEN ---- */
  { van: 'domein:spellen', naar: 'domein:hospitality-universe', soort: 'DOMEINRELATIE',
    reden: 'Magnaat leest het wereldmodel van de hospitality-universe (economie.js r.48, r.151). MAGNAATLAB.md noemt dit met zoveel woorden: er staan TWEE synthetische werelden die elkaar aanroepen, en die vraag hoort beantwoord vóór er een derde bij komt. De rand is dus bekend en bedoeld; de vraag erachter staat open en staat daar' },

  /* ---- EEN ONDERWERP, GEKNIPT OP DE OMVANGSGRENS ----

     Deze randen zien er uit als twee domeinen en zijn er een. De namen delen
     geen koppelteken, dus de familieregel van de meter kan ze niet zien -- en
     die mag hem ook niet zien: op beginletters knippen zou `bank` familie van
     `bankregie` maken, en dat zijn wel twee dingen. Vandaar met de hand, per
     stuk, met de plek erbij. */
  { van: 'domein:journaalbestand', naar: 'domein:journaalrotatie', soort: 'EIGEN_DATA',
    reden: 'journaalbestand.js r.77 maakt de rotatie; een journaal en zijn rotatie zijn een onderwerp, geknipt op de 10 KB van keuringsregel 13' },
  { van: 'domein:journaalbestand', naar: 'domein:journaallezen', soort: 'EIGEN_DATA',
    reden: 'r.135: de leeskant van datzelfde journaal' },
  { van: 'domein:journaalbestand', naar: 'domein:doorgeefjournaal', soort: 'EIGEN_DATA',
    reden: 'r.165: het doorgeven van datzelfde journaal naar een volgende bestemming' },
  { van: 'domein:doorgeefjournaal', naar: 'domein:journaalvorm', soort: 'EIGEN_DATA',
    reden: 'r.57 gebruikt padVorm en bestemmingVorm: de vorm van een journaalregel, uit hetzelfde onderwerp' },
  { van: 'domein:doorgeefjournaal', naar: 'domein:journaalverhuizing', soort: 'EIGEN_DATA',
    reden: 'r.80 verhuist oude journalen; eenmalige migratie van hetzelfde onderwerp' },
  { van: 'domein:handelsregelwacht', naar: 'domein:handelsregelbronnen', soort: 'EIGEN_DATA',
    reden: 'de wacht leest zijn eigen bronnenlijst; een onderwerp over twee bestanden' },
  { van: 'domein:handelsregelbronnen', naar: 'domein:internationalehandel', soort: 'EIGEN_DATA',
    reden: 'r.4: de internationale tak van diezelfde handelsregels' },
  { van: 'domein:appbieb', naar: 'domein:appcatalogus-data', soort: 'EIGEN_DATA',
    reden: 'r.12 leest CATEGORIEEN en APPS: de bieb toont de catalogus, en die staat als gegevens apart' },
  { van: 'domein:atelierweb', naar: 'domein:webmaker-schoon', soort: 'DOMEINRELATIE',
    reden: 'r.27: het atelier gebruikt de schoonmaak van de Website-maker. CREATE.md par. 3: die twee delen aantoonbaar een kern, en dat is de bedoelde richting -- de maker bezit de bloktaal, het atelier gebruikt hem' },

  /* ---- DOMEINEN DIE ELKAAR NODIG HEBBEN, TWEEDE RONDE ---- */
  { van: 'domein:appgids', naar: 'domein:wereldroutes', soort: 'DOMEINRELATIE',
    reden: 'r.8 gebruikt wereldVanRoute: in welke wereld een scherm hoort staat op een plek (WERELDEN.md), en de gids leest hem' },
  { van: 'domein:bank', naar: 'domein:motorverbinding', soort: 'DOMEINRELATIE',
    reden: 'bank/motorklant.js r.18: de bank praat met de Rust-geldmotor via de gedeelde verbinding' },
  { van: 'domein:code-inventaris', naar: 'domein:bestuursroutes', soort: 'BEWIJS',
    reden: 'r.5 gebruikt redenVoor(): de inventaris moet per bestuursroute de reden kunnen tonen, en die reden woont bij de route' },
  { van: 'domein:command', naar: 'domein:payroll', soort: 'DOMEINRELATIE',
    reden: 'command/lagen.js r.35 leest payroll/valuta naast fiscaal/landen: de cockpit toont bedragen in de juiste munt en rekent zelf niet' },
  { van: 'domein:directpay', naar: 'domein:betaalwaarheid', soort: 'BELEID',
    reden: 'directpay/betalen.js r.3 leest betaalwaarheid/staten: welke betaalstaten er bestaan is een waarheid van het huis en niet van een betaalweg (WAARDE.md: een poort waar elke betaling langs gaat)' },
  { van: 'domein:doelen', naar: 'domein:herkomst', soort: 'BEWIJS',
    reden: 'doelen.js r.21 gebruikt magHerkomst en BESCHIKBAAR: een doel toont waar zijn getal vandaan komt (BESTUUR.md, bewijsgraad)' },
  { van: 'domein:ervaring', naar: 'domein:reservering', soort: 'DOMEINRELATIE',
    reden: 'ervaring/tafels.js r.4 leest reservering/beleid: of een tafel te reserveren is, is beleid van de reservering en niet van de tafel' },
  { van: 'domein:facturatie', naar: 'domein:regelsom', soort: 'DOMEINRELATIE',
    reden: 'facturatie/motor.js r.6: de som over factuurregels staat op een plek, zodat een bedrag nooit twee keer wordt uitgerekend (COMMERCIE.md)' },
  { van: 'domein:gemeente', naar: 'domein:stadsweefsel', soort: 'DOMEINRELATIE',
    reden: 'gemeente/index.js r.27 leest CATS en PLOEG: waar de stad uit bestaat is een eigenschap van het stadsweefsel, en de gemeente werkt erop' },
  { van: 'domein:gemeente', naar: 'domein:dubbelemelding', soort: 'DOMEINRELATIE',
    reden: 'gemeente/meldingen.js r.8: of dezelfde melding kort geleden al binnenkwam is een eigen vraag, en hij wordt gedeeld met wie meldingen aanneemt' },
  { van: 'domein:incidentcontrole', naar: 'domein:beschermstand', soort: 'BELEID',
    reden: 'incidentcontrole.js r.11 maakt de beschermstand: bij een incident gaat het huis naar een strengere stand, en die stand is beleid' },
  { van: 'domein:leerstof-vervolg', naar: 'domein:schooladvies', soort: 'DOMEINRELATIE',
    reden: 'r.11 gebruikt uitspraak() en volledig(): wat een leerling hierna kan doen leunt op het advies, dat zijn eigen grenzen draagt' },
  { van: 'domein:leverancier', naar: 'domein:pda', soort: 'DOMEINRELATIE',
    reden: 'leverancier/state.js r.11 leest modulesVoor uit pda/modules: welke werkstanden een zaak heeft, bepaalt wat de leverancier ziet (HORECA.md, de zes werkstanden)' },

  /* ---- DERDE RONDE: nog eens vierentwintig, per stuk nagelezen ---- */
  { van: 'domein:lid', naar: 'domein:lidmaatschap', soort: 'EIGEN_DATA',
    reden: 'lid.js r.11: een lid en zijn lidmaatschap zijn een onderwerp, geknipt op de omvangsgrens' },
  { van: 'domein:lidacties', naar: 'domein:servicekosten', soort: 'DOMEINRELATIE',
    reden: 'lidacties/bestellen.js r.8: wat een bestelling aan servicekosten draagt staat op een plek (COMMERCIE.md: catalogusprijs is niet factuurbedrag)' },
  { van: 'domein:lidacties', naar: 'domein:activiteitendicht', soort: 'DOMEINRELATIE',
    reden: 'lidacties.js r.46: of een activiteit op die datum dicht is, is een eigen vraag met eigen regels' },
  { van: 'domein:life', naar: 'domein:metingen', soort: 'DOMEINRELATIE',
    reden: 'life.js r.32 leest ONDERWERPEN: waarover een mens iets over zichzelf kan bijhouden, staat in de metingen (LIFE.md par. 4: er komt geen score op het leven)' },
  { van: 'domein:metingen', naar: 'domein:herkomst', soort: 'BEWIJS',
    reden: 'metingen.js r.26 gebruikt magHerkomst en rangVan: elke meting draagt haar bewijsgraad (BESTUUR.md)' },
  { van: 'domein:magnaat-dekkingsmatrix', naar: 'domein:bestuursroutes', soort: 'BEWIJS',
    reden: 'r.7 leest dezelfde redenVoor() als code-inventaris: de dekkingsmatrix moet per bestuursroute zeggen waarom hij er niet in zit' },
  { van: 'domein:magnaatwereld', naar: 'domein:magnaat-werkroutefabriek', soort: 'EIGEN_DATA',
    reden: 'magnaatwereld.js is 58 KB en is opgeknipt in magnaat-*; dit is een van die delen (GAMEHALL.md)' },
  { van: 'domein:magnaatwereld', naar: 'domein:magnaat-capabilities', soort: 'EIGEN_DATA',
    reden: 'zelfde opknipping van magnaatwereld.js' },
  { van: 'domein:magnaatwereld', naar: 'domein:magnaat-economie', soort: 'EIGEN_DATA',
    reden: 'zelfde opknipping van magnaatwereld.js' },
  { van: 'domein:magnaatwereld', naar: 'domein:magnaat-trainingslobby', soort: 'EIGEN_DATA',
    reden: 'zelfde opknipping van magnaatwereld.js' },
  { van: 'domein:magnaatwereld', naar: 'domein:magnaat-controle', soort: 'EIGEN_DATA',
    reden: 'zelfde opknipping van magnaatwereld.js' },
  { van: 'domein:mailauth', naar: 'domein:mailspf', soort: 'EIGEN_DATA',
    reden: 'mailauth.js r.18: SPF is een van de drie lagen van mailauthenticatie (met DKIM en DMARC), geknipt op de omvangsgrens' },
  { van: 'domein:mailinkomend', naar: 'domein:mailmime', soort: 'EIGEN_DATA',
    reden: 'mailinkomend.js r.31: het uitpakken van een MIME-bericht hoort bij het inlezen ervan' },
  { van: 'domein:mall', naar: 'domein:leverancier', soort: 'DOMEINRELATIE',
    reden: 'mall/aanbod.js r.59 leest bezorgtNu: of een zaak nu bezorgt, weet de leverancier -- de mall toont het alleen' },
  { van: 'domein:mall', naar: 'domein:reisbureau', soort: 'DOMEINRELATIE',
    reden: 'mall/aanbodrtg.js r.30: reizen zijn een van de dingen die in de mall te koop staan (COMMERCE.md: 437 koopbare vormen in 100 domeinen)' },
  { van: 'domein:mall', naar: 'domein:logies', soort: 'DOMEINRELATIE',
    reden: 'r.60: zelfde reden -- logies is een koopbare vorm die in de mall verschijnt' },
  { van: 'domein:mall', naar: 'domein:markt', soort: 'DOMEINRELATIE',
    reden: 'r.94 leest advertentieOpenbaar: wat er van een advertentie openbaar mag, beslist de markt' },
  { van: 'domein:mall', naar: 'domein:winkelcatalogus', soort: 'DOMEINRELATIE',
    reden: 'mall/index.js r.14: de winkelcatalogus is de bron van producten; de mall is de etalage' },
  { van: 'domein:motorverbinding', naar: 'domein:motorzekering', soort: 'EIGEN_DATA',
    reden: 'motorverbinding.js r.27: de zekering hoort bij de verbinding met de geldmotor, geknipt op de omvangsgrens' },
  { van: 'domein:mutatiecontract', naar: 'domein:mutatie', soort: 'BELEID',
    reden: 'mutatiecontract/keuring.js r.12: de keuring toetst tegen kern/mutatie.js, het enige huis van de mutatiesemantiek (MUTATIECONTRACT.md: vijf assen met elk precies een huis)' },
  { van: 'domein:onboarding', naar: 'domein:paseis', soort: 'BELEID',
    reden: 'onboarding/meebouwen.js r.32 gebruikt heeftPas: of iets een pas vereist is beleid en staat op een plek' },
  { van: 'domein:onderneming', naar: 'domein:agendatijd', soort: 'DOMEINRELATIE',
    reden: 'onderneming/capaciteit.js r.29: rekenen met tijd in een agenda staat op een plek en niet in elke capaciteitsmotor opnieuw' },
  { van: 'domein:onderneming', naar: 'domein:aanmeldingen', soort: 'DOMEINRELATIE',
    reden: 'onderneming/intake.js r.23 leest GENRES: welke soorten zaak zich kunnen aanmelden staat bij de aanmeldingen, met hun vergunningseisen (CLAUDE.md: acht genres houden de zaak tegen)' },
  { van: 'domein:onderneming', naar: 'domein:klantenboek', soort: 'DOMEINRELATIE',
    reden: 'onderneming/lagen.js r.30: het klantenboek van een zaak, gemaakt met de opslag van die zaak' },

  /* ---- VIERDE RONDE: de staart ----

     TWEE GROEPEN SPRINGEN ERUIT, en ze zeggen allebei iets over de vorm van dit
     huis. server/school/ is het School-subsysteem dat BUITEN kern/ woont en zijn
     eigen kern-modules gebruikt: een onderwerp over twee mappen, en de meter kan
     dat niet zien omdat de ene `domein:school` heet en de andere `domein:bijles`.
     En een route-bestand dat een zuster-route ophangt is geen ingang die een
     andere ingang nodig heeft, maar dezelfde ingang in twee bestanden. */
  { van: 'domein:school', naar: 'domein:belasting', soort: 'DOMEINRELATIE',
    reden: 'server/school/ gebruikt zijn eigen kernmodule kern/belasting: een onderwerp dat buiten kern/ woont en zijn kern daar wel heeft staan' },
  { van: 'domein:school', naar: 'domein:bijles', soort: 'DOMEINRELATIE',
    reden: 'server/school/ gebruikt zijn eigen kernmodule kern/bijles: een onderwerp dat buiten kern/ woont en zijn kern daar wel heeft staan' },
  { van: 'domein:school', naar: 'domein:opvolging', soort: 'DOMEINRELATIE',
    reden: 'server/school/ gebruikt zijn eigen kernmodule kern/opvolging: een onderwerp dat buiten kern/ woont en zijn kern daar wel heeft staan' },
  { van: 'domein:school', naar: 'domein:overdracht', soort: 'DOMEINRELATIE',
    reden: 'server/school/ gebruikt zijn eigen kernmodule kern/overdracht: een onderwerp dat buiten kern/ woont en zijn kern daar wel heeft staan' },
  { van: 'domein:school', naar: 'domein:koppelvlak', soort: 'DOMEINRELATIE',
    reden: 'server/school/ gebruikt zijn eigen kernmodule kern/koppelvlak: een onderwerp dat buiten kern/ woont en zijn kern daar wel heeft staan' },
  { van: 'domein:school', naar: 'domein:taalcheck', soort: 'DOMEINRELATIE',
    reden: 'server/school/ gebruikt zijn eigen kernmodule kern/taalcheck: een onderwerp dat buiten kern/ woont en zijn kern daar wel heeft staan' },
  { van: 'domein:school', naar: 'domein:betekenis', soort: 'DOMEINRELATIE',
    reden: 'server/school/ gebruikt zijn eigen kernmodule kern/betekenis: een onderwerp dat buiten kern/ woont en zijn kern daar wel heeft staan' },
  { van: 'domein:school', naar: 'domein:toetsbouw', soort: 'DOMEINRELATIE',
    reden: 'server/school/ gebruikt zijn eigen kernmodule kern/toetsbouw: een onderwerp dat buiten kern/ woont en zijn kern daar wel heeft staan' },
  { van: 'domein:school', naar: 'domein:toetsspiegel', soort: 'DOMEINRELATIE',
    reden: 'server/school/ gebruikt zijn eigen kernmodule kern/toetsspiegel: een onderwerp dat buiten kern/ woont en zijn kern daar wel heeft staan' },
  { van: 'domein:school', naar: 'domein:leerstof-denkfout', soort: 'DOMEINRELATIE',
    reden: 'server/school/ gebruikt zijn eigen kernmodule kern/leerstof-denkfout: een onderwerp dat buiten kern/ woont en zijn kern daar wel heeft staan' },
  { van: 'ingang:geld', naar: 'ingang:geldrahul', soort: 'PRESENTATIE',
    reden: 'routes/geld.js r.118 hangt de Rahul-kant van dezelfde ingang op' },
  { van: 'ingang:kantoren', naar: 'ingang:papieren-deur', soort: 'PRESENTATIE',
    reden: 'routes/kantoren/regie.js r.28: dezelfde papierendeur wordt door meerdere ingangen opgehangen, en dat is precies een deur en geen kopie' },
  { van: 'ingang:leven', naar: 'ingang:levenmentor', soort: 'PRESENTATIE',
    reden: 'routes/leven.js r.61 hangt de mentorkant van dezelfde ingang op' },
  { van: 'ingang:sociaal', naar: 'ingang:socialerahul', soort: 'PRESENTATIE',
    reden: 'routes/sociaal.js r.45 hangt de Rahul-kant van dezelfde ingang op' },
  { van: 'ingang:techniek', naar: 'ingang:papieren-deur', soort: 'PRESENTATIE',
    reden: 'routes/techniek/papieren.js r.21: zie kantoren -- dezelfde deur, tweede ingang' },
  { van: 'ingang:vakbewijs-kantoor', naar: 'ingang:office', soort: 'PRESENTATIE',
    reden: 'routes/vakbewijs-kantoor.js r.32 gebruikt office/wiekijkt: wie er in een dossier kijkt wordt op een plek bepaald en overal hetzelfde gelogd (CLAUDE.md: het inzagejournaal)' },
  { van: 'ingang:werving', naar: 'ingang:supplier', soort: 'PRESENTATIE',
    reden: 'routes/werving.js r.45 gebruikt de uitnodiging van de leverancierskant: de wervingslink hoort bij de zaak die werft' },
  { van: 'domein:onderneming', naar: 'domein:regelsom', soort: 'DOMEINRELATIE',
    reden: 'offertebouw.js r.37: dezelfde som over regels als de facturatie gebruikt -- een bedrag wordt niet twee keer uitgerekend' },
  { van: 'domein:overheid', naar: 'domein:dubbelemelding', soort: 'DOMEINRELATIE',
    reden: 'overheid/regio.js r.7: zelfde vraag als bij de gemeente -- kwam deze melding kort geleden al binnen' },
  { van: 'domein:pay', naar: 'domein:motorverbinding', soort: 'DOMEINRELATIE',
    reden: 'pay/motorklant.js r.18: de betaalpoort praat met de Rust-geldmotor via dezelfde gedeelde verbinding als de bank' },
  { van: 'domein:reisbureau', naar: 'domein:lid', soort: 'DOMEINRELATIE',
    reden: 'reisbureau.js r.36 maakt het reisdossier van een lid; het dossier woont bij het lid en niet bij het reisbureau (REIZEN.md: de Reis bezit geen boeking maar een verwijzing)' },
  { van: 'domein:rendezvous', naar: 'domein:ontmoetpoort', soort: 'BELEID',
    reden: 'rendezvous.js r.19: de 18+-poort met geverifieerd paspoort staat op EEN plek en wordt door beide datingapps gedeeld (ONTMOETEN.md par. 4)' },
  { van: 'domein:vonk', naar: 'domein:ontmoetpoort', soort: 'BELEID',
    reden: 'vonk/index.js r.26: zelfde gedeelde poort als bij rendez-vous -- dat is de bedoelde vorm en geen dubbeling' },
  { van: 'domein:rendezvous', naar: 'domein:beschikbaar', soort: 'DOMEINRELATIE',
    reden: 'rendezvous.js r.28: aanwezigheid is zelf opgegeven en wordt nooit afgeleid (ONTMOETEN.md); die regel woont in beschikbaar' },
  { van: 'domein:vonk', naar: 'domein:beschikbaar', soort: 'DOMEINRELATIE',
    reden: 'vonk/index.js r.28: zelfde reden als bij rendez-vous' },
  { van: 'domein:rtfbieb', naar: 'domein:rtfappcatalogus-data', soort: 'EIGEN_DATA',
    reden: 'rtfbieb.js r.12 leest zijn eigen catalogusgegevens, apart gezet omdat het een tabel is' },
  { van: 'domein:salon', naar: 'domein:mediaopruim', soort: 'DOMEINRELATIE',
    reden: 'salon/index.js r.28: media die bij een verwijderde post horen, worden door een gedeelde opruimer weggehaald' },
  { van: 'domein:webmaker-fotos', naar: 'domein:mediaopruim', soort: 'DOMEINRELATIE',
    reden: 'webmaker-fotos.js r.23: zelfde opruimer, tweede gebruiker' },
  { van: 'domein:staffseed-papieren', naar: 'domein:persoonseis', soort: 'BELEID',
    reden: 'staffseed-papieren.js r.33 leest EISEN: welk vakbewijs een beroep vraagt is beleid en staat op een plek (CLAUDE.md: server/kern/persoonseis.js)' },
  { van: 'domein:taalcheck', naar: 'domein:leerstof-taalvorm', soort: 'DOMEINRELATIE',
    reden: 'taalcheck.js r.29: de vorm van een taalvraag hoort bij de leerstof, de controle erop is een eigen onderwerp' },
  { van: 'domein:theater', naar: 'domein:ondertitels', soort: 'DOMEINRELATIE',
    reden: 'theater/video.js r.7: zelfde ondertitellaag als clips-studio -- een onderwerp, twee gebruikers' },
  { van: 'domein:uploadquarantaine', naar: 'domein:clamd', soort: 'DOMEINRELATIE',
    reden: 'uploadquarantaine.js r.11: elke upload gaat langs de losse ClamAV-container (LIVEGANG.md); de client daarvoor staat apart' },
  { van: 'domein:vakwerk', naar: 'domein:agendatijd', soort: 'DOMEINRELATIE',
    reden: 'vakwerk/index.js r.25: rekenen met tijd staat op een plek, zie ook onderneming' },
  { van: 'domein:webmaker', naar: 'domein:webdomein', soort: 'DOMEINRELATIE',
    reden: 'webmaker.js r.43: een gemaakte site en zijn domeinnaam zijn twee onderwerpen die elkaar nodig hebben' },
  { van: 'motor:local-ai', naar: 'motor:openai', soort: 'DOMEINRELATIE',
    reden: 'local-ai.js r.18: de lokale server spreekt het OpenAI-protocol, dus hij hergebruikt die client. Dat is een PROTOCOL en geen verbinding naar buiten -- RTG_EXTERNE_AI_UIT=1 raakt de lokale weg niet' },
  { van: 'motor:log', naar: 'domein:doorgeefjournaal', soort: 'DOMEINRELATIE',
    reden: 'log.js r.119 laadt het doorgeefjournaal pas bij gebruik (lui): wat gelogd wordt kan worden doorgegeven, en die keten hoort niet bij het loggen zelf' },
  { van: 'motor:mail-bezorgen', naar: 'motor:smtp-direct', soort: 'DOMEINRELATIE',
    reden: 'mail-bezorgen.js r.22: bezorgen zonder tussenpartij is een van de wegen; de andere loopt via een relay' },
  { van: 'motor:mail-opstellen', naar: 'motor:smtp', soort: 'DOMEINRELATIE',
    reden: 'mail-opstellen.js r.38 gebruikt de kop- en datumvorm van SMTP: hoe een kop eruitziet staat in het protocol' },
  { van: 'motor:mail', naar: 'motor:smtp', soort: 'DOMEINRELATIE',
    reden: 'mail.js r.50: de transporter van de mail; een onderwerp over meerdere bestanden' },
  { van: 'motor:mail', naar: 'motor:smtp-direct', soort: 'DOMEINRELATIE',
    reden: 'zelfde bestand: de tweede bezorgweg, zonder relay' },
  { van: 'motor:papieren', naar: 'motor:bewaarveger', soort: 'DOMEINRELATIE',
    reden: 'papieren/huidig.js r.15 leest STANDAARD: welke termijn standaard geldt staat bij de veger die hem uitvoert' },
  { van: 'motor:pg', naar: 'motor:pgwire', soort: 'EIGEN_DATA',
    reden: 'pg/index.js r.28: pgwire is het draadprotocol onder de eigen PostgreSQL-client; een onderwerp, twee lagen' },
  { van: 'motor:pgaccounts', naar: 'motor:pgwire', soort: 'DOMEINRELATIE',
    reden: 'pgaccounts.js r.49: de identiteitskluis gebruikt hetzelfde draadprotocol' },
  { van: 'motor:seed', naar: 'domein:muziek-stijlen', soort: 'DOMEINRELATIE',
    reden: 'seed/media.js r.32: de zaaiset maakt voorbeelden met de echte stijlenlijst in plaats van met verzonnen waarden' },
  { van: 'motor:techniek-basis', naar: 'motor:trio-stand', soort: 'DOMEINRELATIE',
    reden: 'techniek-basis.js r.105: de technische pagina toont de stand van het failover-trio' },

  /* ---- DRIE RANDEN DIE MET DE MERGE VAN 2 SEPTEMBER 2026 MEEKWAMEN ----
     Ze staan hier niet om het getal weg te krijgen maar omdat het alle drie
     dezelfde vorm is: EEN plek waar een regel woont, en meerdere domeinen die
     hem lezen. Dat is precies wat regel 4 van de lat vraagt; een tweede kopie
     zou de bevinding zijn, niet deze rand. */
  { van: 'domein:identiteit', naar: 'domein:totp', soort: 'GEDEELDE_PRIMITIEF',
    reden: 'kern/totp.js is RFC 6238 in pure Node-crypto zonder enige afhankelijkheid; kern/identiteit/tweefactor.js r.31 leest er alleen totpOk uit. Een tweede TOTP-implementatie naast deze zou betekenen dat twee deuren van dit huis een code anders valideren' },
  { van: 'domein:rtfos', naar: 'domein:machtiging', soort: 'BELEID',
    reden: 'kern/machtiging.js draagt met opzet DE REGELS en niet de opslag: wat een geldige SEPA-machtiging is (een maximum, geen volledig rekeningnummer, altijd per direct in te trekken) is een ding, ook al hangt hij bij een school aan een leerling en bij een gift aan de gever. kern/rtfos/gift-machtiging.js r.55 leest die regels' },
  { van: 'domein:school', naar: 'domein:machtiging', soort: 'BELEID',
    reden: 'zelfde regels, andere houder: server/school/machtiging.js r.34 leest kern/machtiging.js. Dit IS het register waar die regels vandaan komen -- het schoolregister was er eerst, en de gift kreeg geen kopie maar dezelfde bron (SEMANTIEK.json noemt twee registers onder een naam duur)' },
  /* ---- DE NADEN VAN DE SAMENVOEGING VAN 3 SEPTEMBER 2026 ----
     Zes randen uit vijf takken die elk eerder vertakten dan de meter bestond
     (#174 bracht hem mee). Geen ervan is nieuw werk van de samenvoeging; ze
     staan hier omdat de meter ze nu voor het eerst ziet. */
  { van: 'domein:ai', naar: 'domein:service', soort: 'DOMEINRELATIE',
    reden: 'kern/ai.js r.27 leest service/mens: de ondergrens "ik wil een mens" (SERVICE.md). Het gesprek van de RTG Pass zet een servicezaak KLAAR in plaats van needsConcierge hard op false te houden; de AI opent zelf niets en leent geen machtiging' },
  { van: 'domein:isolatie', naar: 'domein:beschermstand-lijst', soort: 'DOMEINRELATIE',
    reden: 'kern/isolatie/leesset.js r.61 leest de UITZONDERINGEN van de beschermstand op de plek waar die wonen. De isolatielaag ligt BOVEN de vijf incidentstanden (ISOLATIE.md) en mag de leeslijst niet met een eigen kopie van die uitzonderingen vullen -- dan lopen twee lijsten uiteen op de dag dat er een stand bijkomt' },
  { van: 'domein:isolatie', naar: 'domein:sessies', soort: 'DOMEINRELATIE',
    reden: 'kern/isolatie/sessiedragers.js r.27 gebruikt tokenHash uit het sessieregister: de drager "sessie" wijst een sessie aan met DEZELFDE hash als het register zelf. Een tweede hash zou een sessie op twee manieren identificeren, en dan houdt een stand op de ene sleutel de andere niet tegen (SEC-LOCK-003)' },
  { van: 'domein:mailaanname', naar: 'domein:mailontvanger', soort: 'DOMEINRELATIE',
    reden: 'kern/mailaanname.js r.49 vraagt de ontvangertoets of een adres een postvak heeft (550 zo niet). De aanname bewaakt de buitenpoort, de ontvanger weet wie er woont; dat zijn twee vragen en ze horen niet in een module' },
  { van: 'domein:rtfos', naar: 'domein:beschermzaak', soort: 'DOMEINRELATIE',
    reden: 'kern/rtfos/index.js r.134 monteert de beschermlaag (HDI.md) op de context van de RTFoundation: de beschermzaak is een onderdeel van de stichting en geen vreemd domein, maar hij houdt met opzet een eigen dataklasse die velden WEIGERT -- vandaar een eigen module en geen tak in rtfos/' },
  /* ---- HET EIGENAARSHERSTEL (EIGENAAR.md par. 5) ---- */
  { van: 'domein:eigenaarherstel', naar: 'domein:herstelquorum', soort: 'DOMEINRELATIE',
    reden: 'kern/eigenaarherstel.js leest de rekenkant uit kern/herstelquorum.js. De splitsing is met opzet: het quorum REKENT (delen munten, samenvoegen, verifieren) en weet niets van wachttijden, meldingen of afbreken; de ceremonie doet dat en rekent zelf niets. Zou de ene de andere overnemen, dan zit de crypto in een bestand dat ook over de klok gaat, en dan is de eerste plek onbeproefbaar zonder de tweede' },
  { van: 'ingang:techniek', naar: 'ingang:eigenaarherstel', soort: 'DOMEINRELATIE',
    reden: 'routes/techniek.js monteert routes/eigenaarherstel.js op zijn gedeelde context. Die context draagt techAuth en eigenaarAlleen, en die twee horen bij de technische pagina en niet op de kern -- ze daarheen tillen zou elk domein toegang geven tot de eigenaarscontrole. De publieke helft van dat bestand (/api/herstel/*) heeft alleen `app` nodig en reist mee' },
  { van: 'domein:rtgid-bewijs', naar: 'domein:persoonseis-lijst', soort: 'DOMEINRELATIE',
    reden: 'kern/rtgid-bewijs.js r.54 leest SOORTEN uit de persoonseislijst: de bewijsmap toont dat een lid aan een persoonseis voldoet zonder het registratienummer af te geven, en welke eisen er bestaan staat op EEN plek (kern/persoonseis-lijst.js), niet nog eens in de map' }
];
