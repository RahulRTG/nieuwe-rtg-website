#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE OVERGANGSVORM -- is er EEN overgang onder werk, leren, bevoegdheid, de
   buurt, kennis en blauwdrukken? Of zijn het families, of niets?

   DE VRAAG, EN WIE HEM STELDE. Het voorstel voor FoundationOS (VERDER.md) zet
   een lus centraal: wereld -> mogelijkheid -> OVERGANG -> voorwaarden ->
   voorbereiden -> bevestigen -> uitvoeren -> bewijzen -> resultaat ->
   ervaring -> kennis -> overdragen -> lokaal aanpassen -> terugvloeien. De
   verleiding is dan een universele `Overgang` met veertien velden. De eigenaar
   vroeg deze meter uitdrukkelijk om dat idee KAPOT te proberen te krijgen en
   niet om het te bewijzen: *welke minimale grammatica blijft overeind als
   alles door dezelfde proef gaat?* -- met "geen universele overgang gevonden"
   als volwaardige uitkomst.

   DAT IS DE VORM WAARIN `Asset`, `Koopbaar`, `Career`, `Moment`, `Manier`,
   `Ontdekking` en de planningsgrond SNEUVELDEN. Dus wordt hij eerst gemeten.

   WAT HIJ MEET. Zestien overgangen -- de dertien van het voorstel, plus de
   mislukte poging in drie stappen (poging -> gestopt -> les -> kennisvoorstel),
   want een mislukking is niet automatisch kennis -- tegen veertien dimensies.
   Per cel een stand:

     poort    de drager WEIGERT als hier niet aan is voldaan
     draagt   de drager legt het vast of gebruikt het, maar weigert er niet op
     afwezig  de drager kent het niet, en de reden staat erbij

   ELKE poort- en draagt-cel heeft een CITAAT dat letterlijk in de CODE van de
   drager moet staan -- niet in een commentaar, want een zin in een toelichting
   is een belofte en geen handhaving (scripts/lib/bron.js haalt het commentaar
   eruit en laat de tekenreeksen staan, zodat een weigerzin telt). Een citaat
   dat er niet meer staat heet ROT en telt niet mee; dat is de ratel
   `overgangCitaatRot`. De indeling zelf is een OORDEEL van wie hem schreef, en
   daarom staat er een tweede as naast (B) die hetzelfde LEXICAAL probeert en
   elke onenigheid hardop meldt in plaats van er een winnaar uit te kiezen.

   VIER ASSEN, EN ZE WORDEN NOOIT OPGETELD.

     A. DE DIMENSIES   de verklaarde standen met hun nagetrokken citaten.
                       Hierop rust de conclusie.
     B. DE WOORDEN     dezelfde vraag lexicaal over de gedefinieerde namen van
                       de drager. Graad `vermoed`, een ONDERgrens; hij kleurt
                       en beslist niet.
     C. DE VORM        delen de dragers VELDEN? De Asset-vraag, met de lezer
                       van scripts/objectmodel.js zodat het getal naast de
                       vorige zeven metingen te leggen is.
     D. DE PROEVEN     de echte modules gedraaid, met een verzonnen context:
                       gaat een poort werkelijk dicht, en slaagt een
                       universele motor die alleen de kern kent daar ten
                       onrechte waar de drager weigert? Dit is de mutatieproef
                       die de vraag eiste, niet op een model maar op de code.

   WAT HIJ MET OPZET NIET DOET. Hij bouwt niets en verandert geen gedrag. Hij
   zegt niet of een overgang GOED werkt (dat is een ketenproef) en ook niet of
   de bevindingen onder D gerepareerd moeten worden -- die staan in VERDER.md
   met de vraag erbij.

   Draaien: npm run overgangsvorm   (vastleggen: npm run overgangsvorm:vast)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const om = require('./objectmodel.js');
const { zonderCommentaar } = require('./lib/bron');
const { stempel } = require('./lib/stempel');
const R = require('./lib/overgangsrekening');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'OVERGANGSVORM.json');

/* ---------------------------------------------------------------------------
   DE VEERTIEN DIMENSIES, met wat ze hier betekenen. De definitie staat erbij
   omdat een dimensie zonder definitie door elke indeler anders wordt gelezen.
   ------------------------------------------------------------------------ */
const DIMENSIES = {
  van:                    'de begintoestand wordt getoetst (je kunt deze overgang alleen maken VANUIT iets)',
  naar:                   'de eindtoestand wordt vastgelegd',
  voorwaarden:            'een voorwaarde aan de omstandigheden of de invoer, anders dan bewijs of bevoegdheid',
  actor:                  'wie de overgang maakt, en of dat uit de sessie komt',
  bevoegdheid:            'een rol, recht of relatie die de handelende mens moet hebben',
  actie:                  'de handeling die de overgang uitvoert',
  bewijs:                 'iets wat in de echte wereld aantoonbaar is gebeurd of vastgesteld',
  uitkomst:               'een vastgelegd resultaat naast de nieuwe stand (een besluit, een record, een dossierregel)',
  blokkade:               'een weigering die zegt wat er ontbreekt en wat de volgende stap is',
  terugweg:               'een handeling die de overgang ongedaan maakt of compenseert',
  kennis:                 'de overgang vraagt of levert een les, aanpak of kennisitem',
  overdracht:             'de overgang geeft iets door aan een andere partij, plek of mens',
  privacyklasse:          'een expliciete privacyregel: codenaam, abstractie, minderjarigen, wat niet mee mag',
  menselijke_bevestiging: 'een tweede mens (of de betrokkene zelf) moet bevestigen'
};
const DIMS = Object.keys(DIMENSIES);

/* De lexicale as (B). Over de GEDEFINIEERDE en GEBRUIKTE namen in de code, met
   commentaar en tekenreeksen eruit (om.wring) -- een weigerzin telt hier dus
   NIET mee; dat doet as A. Zes dimensies hebben geen patroon: van, naar, actie,
   uitkomst en blokkade zijn in elke drager lexicaal aanwezig en dus geen
   meting, en een patroon dat altijd raak is, is geen instrument. */
const WOORDEN = {
  voorwaarden:            /(?:geldig|open|gesloten|verlopen|actief)/i,
  actor:                  /(?:wie\(|sessie|session|boardroomwie|door\b|melder)/i,
  bevoegdheid:            /(?:poort|auth\b|officeauth|kluisauth|balieauth|manageronly|eisbestuur|bevoegd|rol\b)/i,
  bewijs:                 /(?:bewijs|indicator|vog|afgetekend|proven|incheck)/i,
  terugweg:               /(?:intrek|beeindig|ongeldig|afmeld|revoked|deprecated|\blos\b|herbeoordel)/i,
  kennis:                 /(?:geleerd|kennis|aanpak|reden\b|voorstel)/i,
  overdracht:             /(?:overgenomen|uitleen|maginstad|mensvraag|werkvoorzaak|catalogus|impact)/i,
  privacyklasse:          /(?:codenaam|privacy|minderjarig|volwassen|kluis|member_state)/i,
  menselijke_bevestiging: /(?:bevestig|tweede|eisniet|toestemming|akkoord|accepteer)/i
};

/* NAGEKEKEN ONENIGHEID. Waar de woorden en de indeling het oneens zijn, heeft
   een mens beide bestanden geopend. Wat hier staat, is verklaard; wat hier NIET
   staat en toch oneens is, telt als `onverklaard` en hoort nagekeken te worden.
   De lijst verandert de indeling niet en telt nooit af van de onenigheid zelf --
   hij scheidt alleen oud nieuws van nieuw. Een onenigheid die ooit tot een
   correctie leidde, staat hier niet meer: die is verdwenen doordat de indeling
   is aangepast (`oplossen.privacyklasse`, 30 september 2026). */
const RUIS = 'Het woord staat er, maar in een andere handeling dan deze overgang.';
const NAGEKEKEN = {
  'werk.kennis': '`reden` en `voorstel` zijn hier de uitslag van de brug ({ gemaakt: false, reden }) en de inhaallijst, geen les.',
  'leren.kennis': '`reden` bij een ongeldig oordeel en `kennis` als verwijzing naar een kennisitem; de beoordeling zelf legt geen les vast.',
  'bevoegd.kennis': '`reden` is de weigerreden en de intrekreden, geen les.',
  'buurtidee.bewijs': 'Een project draagt een bewijsmap en indicatoren, maar goedgekeurd -> actief vraagt er niet naar.',
  'buurtidee.overdracht': '`uitleen` in basis.js gaat over vrijwilligers tussen steden, niet over het project.',
  'deelnemen.kennis': '`reden` is de verplichte reden bij het loskoppelen van een account.',
  'mentor.kennis': RUIS + ' standen.js beschrijft ook de kennis- en voorstelmachine.',
  'melden.bevoegdheid': '`auth` is de inlog (actor), geen recht: melden mag iedereen met een account.',
  'melden.kennis': '`reden` bij de weg naar een mens.',
  'melden.menselijke_bevestiging': RUIS + ' De bevestiging in RTG Service is die van een machtiging, niet van een melding.',
  'oplossen.kennis': '`reden` bij een machtiging en bij de weg naar een mens.',
  'oplossen.menselijke_bevestiging': RUIS + ' De bevestiging in de kantoorroutes is die van een machtiging, niet van het sluiten.',
  'kennisvoorstel.terugweg': RUIS + ' DEPRECATED en REVOKED zijn standen van een kennisVERSIE, niet van een voorstel.',
  'kennisvoorstel.menselijke_bevestiging': RUIS + ' `eisNiet` hoort bij voorstelStand (overgang kennis-actief), niet bij indienen.',
  'fork.bewijs': RUIS + ' Het bewijs hoort bij deel(), de overgang ervoor.',
  'gestopt.voorwaarden': '`actief` is de naam van een stand en `Geldig` een hulpfunctie; stoppen stelt geen voorwaarde.',
  'gestopt.bewijs': RUIS + ' Bewijsmap en indicatoren bestaan, stoppen vraagt er niet naar.',
  'gestopt.overdracht': '`uitleen` gaat over vrijwilligers tussen steden.',
  'les.bewijs': RUIS + ' Het bewijs hoort bij de stappen van het onderzoek voor het besluit.',
  'les.privacyklasse': RUIS + ' De privacyregels in de route gaan over deelnemers aan een studie.',
  'les.menselijke_bevestiging': RUIS + ' Toestemming in de route is die van een deelnemer aan een studie.',
  'werk.overdracht': 'De uitnodiging gaat naar de persoon; de woordenlijst kent `accepteer` alleen als bevestiging.',
  'leren.privacyklasse': 'De leeftijdspoort staat in de ROUTE (maakVolwassen), en het woord `volwassen` zit daar in een aanroep die de wringer als naam telt.',
  'bevoegd.menselijke_bevestiging': 'Aftekenen is een bevestiging door een mens; het woord in de code is `afgetekend`, niet `bevestig`.',
  'buurtidee.terugweg': 'De herbeoordeling is een tekenreeks in een auditregel; de woordenas leest geen tekenreeksen.',
  'buurtidee.menselijke_bevestiging': 'De vier-ogenregel staat in een weigerzin (een tekenreeks); de woordenas leest geen tekenreeksen.',
  'blauwdruk.privacyklasse': 'De abstractie is een veldselectie ({ naam, doel }), geen woord.',
  'melden.privacyklasse': 'De melder uit de sessie heet `melder`, en dat woord valt onder actor.',
  'fork.privacyklasse': 'Het bedrag dat NIET meereist is `budgetCenten: 0`, geen woord.',
  'oplossen.terugweg': 'Terugzetten is dezelfde zetStand, geen apart woord.',
  'les.voorwaarden': 'De keuzelijst staat in een tekenreeks; de woordenas leest geen tekenreeksen.'
};

/* ---------------------------------------------------------------------------
   DE ZESTIEN OVERGANGEN. Per overgang de drager(s) en per dimensie een stand.
   Waar een overgang meer dragers heeft, telt de STERKSTE stand over die
   dragers, en de reden zegt welke drager hem niet haalt -- anders verbergt het
   samenvoegen precies het verschil dat deze meter zoekt.

   De familie is de HYPOTHESE van de eigenaar (toestand, kennis, overdracht) en
   geen uitkomst; as A rekent daarna of de data haar draagt.
   ------------------------------------------------------------------------ */
const p = (bestand, citaat, reden) => ({ stand: 'poort', bestand, citaat, reden: reden || null });
const d = (bestand, citaat, reden) => ({ stand: 'draagt', bestand, citaat, reden: reden || null });
const a = (reden) => ({ stand: 'afwezig', reden });

const K = 'server/kern/';
const OVERGANGEN = [
  { id: 'werk', van: 'werkzoekend', naar: 'eerste werkdag', familie: 'toestand',
    dragers: [K + 'concern/aanname.js', K + 'concern/employment.js', K + 'concern/uitnodiging.js',
      'server/routes/supplier/werving/sollicitaties.js'],
    dimensies: {
      van: p(K + 'concern/uitnodiging.js', 'Deze uitnodiging is al gebruikt.'),
      naar: d('server/routes/supplier/werving/sollicitaties.js', "'aangenomen'"),
      voorwaarden: p(K + 'concern/aanname.js', 'De vestiging van deze zaak is gesloten.'),
      actor: p(K + 'concern/uitnodiging.js', 'Log in of maak een gratis werkidentiteit aan.'),
      bevoegdheid: p('server/routes/supplier/werving/sollicitaties.js', 'managerOnly'),
      actie: d(K + 'concern/aanname.js', 'dienstverbandUitAanname'),
      bewijs: a('Bij de aanname wordt niets bewezen. Het eerste echte werk wordt pas gepoort door persoonseis.js (magWerkenHier), en dat is overgang `bevoegd`.'),
      uitkomst: d(K + 'concern/employment.js', 'employmentNieuw'),
      blokkade: d(K + 'concern/aanname.js', 'dus er is geen werkgever om een dienstverband bij te maken'),
      terugweg: d(K + 'concern/employment.js', 'employmentBeeindig'),
      kennis: a('Een aanname vraagt en levert geen les.'),
      overdracht: d(K + 'concern/uitnodiging.js', 'uitnodigingAccepteer'),
      privacyklasse: a('De aanname zelf draagt geen privacyregel; de persoon komt uit een geverifieerd account, maar dat is de actor en geen klasse.'),
      menselijke_bevestiging: p(K + 'concern/aanname.js', 'er wordt niets vastgelegd zonder uw keuze',
        'Een dienstverband op iemands naam is een verklaring van een werkgever; de inhaalweg legt niets vast zonder keuze. De aanname zelf wacht daarnaast op de persoon die zijn uitnodiging aanneemt.')
    } },

  { id: 'leren', van: 'leerling', naar: 'competent', familie: 'toestand',
    dragers: [K + 'leerhuis/acties-oordeel.js', K + 'leerhuis/acties-mens.js', K + 'leerhuis/index.js'],
    dimensies: {
      van: p(K + 'leerhuis/acties-oordeel.js', 'er loopt al een beoordeling voor deze vaardigheid'),
      naar: d(K + 'leerhuis/acties-oordeel.js', 'PROVEN'),
      voorwaarden: p(K + 'leerhuis/acties-oordeel.js', 'een PROVEN noemt de criteria waartegen is beoordeeld'),
      actor: p(K + 'leerhuis/index.js', 'de actor komt uit de sessie en is een geldige sleutel'),
      bevoegdheid: p(K + 'leerhuis/acties-oordeel.js', 'de assessor is niet (meer) bevoegd'),
      actie: d(K + 'leerhuis/acties-oordeel.js', 'beoordelingAfronden'),
      bewijs: p(K + 'leerhuis/acties-oordeel.js', 'zonder bewijs is er niets te beoordelen'),
      uitkomst: d(K + 'leerhuis/acties-oordeel.js', 'ASSESSMENT_EVIDENCE'),
      blokkade: d(K + 'leerhuis/acties-mens.js', 'volgt uit een beoordeling of certificaat, niet uit een handeling'),
      terugweg: d(K + 'leerhuis/acties-oordeel.js', 'beoordelingOngeldig'),
      kennis: a('Een beoordeling legt geen les vast en schrijft geen kennis; kennis die verandert stuurt wel mensen terug naar leren (overgang `kennis-actief`), maar dat is de andere richting.'),
      overdracht: a('Competent worden geeft niets door aan een ander; het certificaat is een aparte handeling.'),
      privacyklasse: d('server/routes/leerhuis.js', 'maakVolwassen',
        'Wie jonger is dan 18 ziet geen niveau (de route, niet de kern).'),
      menselijke_bevestiging: p(K + 'leerhuis/acties-oordeel.js', 'niemand beoordeelt zichzelf')
    } },

  { id: 'bevoegd', van: 'competent', naar: 'bevoegd', familie: 'toestand',
    dragers: [K + 'persoonseis.js', K + 'vakbewijs.js', K + 'vakbewijs-aftekenen.js', 'server/routes/vakbewijs-kantoor.js'],
    dimensies: {
      van: p(K + 'vakbewijs-aftekenen.js', 'Dit stuk is al afgetekend.'),
      naar: d(K + 'vakbewijs-aftekenen.js', 'v.afgetekend = { door: naam'),
      voorwaarden: p(K + 'persoonseis.js', 'Het vastgelegde stuk is verlopen.'),
      actor: p(K + 'vakbewijs-aftekenen.js', 'Wie tekent af? Een aftekening zonder naam is geen aftekening.'),
      bevoegdheid: p('server/routes/vakbewijs-kantoor.js', 'kluisAuth'),
      actie: d(K + 'vakbewijs-aftekenen.js', 'vakbewijsTeken'),
      bewijs: p(K + 'persoonseis.js', 'Uw stuk is ingediend maar nog niet door RTG gezien.'),
      uitkomst: d(K + 'vakbewijs.js', 'vakbewijsHeeft'),
      blokkade: d(K + 'persoonseis.js', 'op uw eigen naam nodig'),
      terugweg: d(K + 'vakbewijs-aftekenen.js', 'vakbewijsIntrek'),
      kennis: a('Bevoegd worden vraagt of levert geen les.'),
      overdracht: a('De bevoegdheid blijft bij de mens; hij wordt nergens doorgegeven.'),
      privacyklasse: d(K + 'vakbewijs.js', 'nummerZet', 'Het documentnummer woont in de identiteitskluis en niet naast de codenaam.'),
      menselijke_bevestiging: d(K + 'vakbewijs-aftekenen.js', 'afgetekend',
        'Een mens van RTG tekent af, maar niets toetst dat die mens niet de betrokkene zelf is: de sleutel van de aftekenaar wordt nergens naast die van het stuk gelegd. Daarom DRAAGT en geen POORT.')
    } },

  { id: 'buurtidee', van: 'buurtidee', naar: 'eerste uitvoering', familie: 'toestand',
    dragers: [K + 'rtfos/projecten.js', K + 'rtfos/projecten-besluit.js', K + 'rtfos/basis.js'],
    dimensies: {
      van: p(K + 'rtfos/projecten-besluit.js', 'kan een project naar'),
      naar: d(K + 'rtfos/projecten.js', "'actief'"),
      voorwaarden: p(K + 'rtfos/projecten.js', 'alleen een actieve partner draagt een project.'),
      actor: p(K + 'rtfos/basis.js', 'boardroomWie'),
      bevoegdheid: p(K + 'rtfos/projecten-besluit.js', 'Een project goed- of afkeuren doet het stadsbestuur'),
      actie: d(K + 'rtfos/projecten.js', 'KETEN'),
      bewijs: a('Van goedgekeurd naar actief vraagt geen enkel bewijs; wat er gebeurt, komt pas in de rapportage.'),
      uitkomst: d(K + 'rtfos/projecten-besluit.js', 'p.besluit'),
      blokkade: d(K + 'rtfos/projecten-besluit.js', 'Laat een ander uit het bestuur kijken.'),
      terugweg: d(K + 'rtfos/projecten.js', "'project.herbeoordeling'",
        'Alleen terug naar beoordeling bij een hoger budget; van actief is er geen weg terug behalve stoppen.'),
      kennis: a('Een idee aanmaken of goedkeuren vraagt geen les; de knelpunten komen pas per periode in de rapportage.'),
      overdracht: a('Het project blijft in de eigen stad.'),
      privacyklasse: a('Een project draagt geen privacyregel; het gaat over een aanpak en niet over mensen.'),
      menselijke_bevestiging: p(K + 'rtfos/projecten-besluit.js', 'Wie een project indient, keurt het niet zelf goed.')
    } },

  { id: 'blauwdruk', van: 'uitvoering', naar: 'bewezen blauwdruk', familie: 'overdracht',
    dragers: [K + 'rtfos/netwerk.js'],
    dimensies: {
      van: p(K + 'rtfos/netwerk.js', 'Een blauwdruk komt uit een project dat draait of gedraaid heeft'),
      naar: d(K + 'rtfos/netwerk.js', 'B().push(rij)'),
      voorwaarden: p(K + 'rtfos/netwerk.js', 'Beschrijf de aanpak'),
      actor: d(K + 'rtfos/netwerk.js', 'door: w.key'),
      bevoegdheid: p(K + 'rtfos/netwerk.js', "'project.beheren'"),
      actie: d(K + 'rtfos/netwerk.js', 'function deel('),
      bewijs: p(K + 'rtfos/netwerk.js', 'Zonder cijfers is dit een idee en geen blauwdruk.'),
      uitkomst: d(K + 'rtfos/netwerk.js', 'blauwdruk: beeld(rij)'),
      blokkade: d(K + 'rtfos/netwerk.js', 'Een blauwdruk zonder dat stuk laat de volgende stad dezelfde fout maken.'),
      terugweg: a('Een gedeelde blauwdruk is niet in te trekken of te bewerken.'),
      kennis: p(K + 'rtfos/netwerk.js', 'Wat ging er mis of anders dan verwacht?'),
      overdracht: d(K + 'rtfos/netwerk.js', 'function catalogus('),
      privacyklasse: d(K + 'rtfos/netwerk.js', '({ naam: i.naam, doel: i.doel })',
        'Alleen de naam en het doel van een indicator reizen mee; de resultaten, deelnemers en bedragen van die stad blijven daar.'),
      menselijke_bevestiging: a('Wie deelt, publiceert. Er kijkt geen tweede mens naar een blauwdruk voordat hij in de catalogus staat.')
    } },

  { id: 'deelnemen', van: 'bezoeker', naar: 'vrijwillige deelnemer', familie: 'toestand',
    dragers: [K + 'rtfos/activiteiten-deur.js', K + 'rtfos/vrijwilligeraccount.js'],
    dimensies: {
      van: p(K + 'rtfos/activiteiten-deur.js', 'neemt geen inschrijvingen aan.'),
      naar: d(K + 'rtfos/activiteiten-deur.js', 'function inschrijven('),
      voorwaarden: d(K + 'rtfos/activiteiten-deur.js', 'wachtlijst',
        'Vol is geen weigering: wie te laat is, komt op de wachtlijst.'),
      actor: d(K + 'rtfos/activiteiten-deur.js', 'wie(req)',
        'De actor is de medewerker uit de sessie, en niet de bezoeker: inschrijven is een kantoorhandeling.'),
      bevoegdheid: p(K + 'rtfos/activiteiten-deur.js', "'project.beheren'"),
      actie: d(K + 'rtfos/activiteiten-deur.js', 'function inchecken('),
      bewijs: p(K + 'rtfos/activiteiten-deur.js', 'Deze incheckcode hoort niet bij deze activiteit.'),
      uitkomst: a('Inschrijven en inchecken laten geen auditregel na; alleen afmelden doet dat.'),
      blokkade: d(K + 'rtfos/activiteiten-deur.js', 'heeft nog geen plek.'),
      terugweg: d(K + 'rtfos/activiteiten-deur.js', 'function afmelden('),
      kennis: a('Meedoen vraagt of levert geen les.'),
      overdracht: a('Er gaat niets naar een ander.'),
      privacyklasse: p(K + 'rtfos/activiteiten-deur.js', 'Onder welke codenaam schrijft deze deelnemer in?'),
      menselijke_bevestiging: p(K + 'rtfos/activiteiten-deur.js', 'Zonder die toestemming doet een minderjarige niet mee.',
        'Toestemming van de ouders voor een minderjarige. Voor een volwassene bevestigt niemand iets: het kantoor schrijft hem in.')
    } },

  { id: 'mentor', van: 'deelnemer', naar: 'mentor', familie: 'toestand',
    dragers: [K + 'rtfos/vrijwilligers-inzet.js', K + 'leerhuis/acties-mens.js', K + 'leerhuis/standen.js'],
    dimensies: {
      van: p(K + 'rtfos/vrijwilligers-inzet.js', 'kan pas mee als de status'),
      naar: d(K + 'leerhuis/standen.js', 'MENTOR'),
      voorwaarden: p(K + 'rtfos/vrijwilligers-inzet.js', 'heeft de gedragscode nog niet ondertekend.'),
      actor: d(K + 'rtfos/vrijwilligers-inzet.js', 'wie(req)'),
      bevoegdheid: p(K + 'rtfos/vrijwilligers-inzet.js', "'vrijwilliger.beheren'"),
      actie: d(K + 'leerhuis/acties-mens.js', 'trainerKwalificeer'),
      bewijs: p(K + 'rtfos/vrijwilligers-inzet.js', 'is een geldige VOG verplicht.'),
      uitkomst: d(K + 'rtfos/vrijwilligers-inzet.js', "'vrijwilliger.koppel'"),
      blokkade: d(K + 'rtfos/vrijwilligers-inzet.js', 'Vraag de eigen afdeling om een uitleen'),
      terugweg: d(K + 'rtfos/vrijwilligers-inzet.js', "'vrijwilliger.los'"),
      kennis: a('Mentor worden vraagt geen les van de mentor; wel dat hij zelf heeft bewezen wat hij doorgeeft, en dat is bewijs.'),
      overdracht: d(K + 'rtfos/vrijwilligers-inzet.js', 'magInStad'),
      privacyklasse: a('De koppeling draagt geen privacyregel in code; dat de VOG-inhoud niet wordt bewaard, staat in een commentaar.'),
      menselijke_bevestiging: p(K + 'leerhuis/acties-mens.js', 'niemand kwalificeert zichzelf als trainer')
    } },

  { id: 'melden', van: 'probleem', naar: 'zaak', familie: 'toestand',
    dragers: [K + 'service/zaak.js', K + 'stadsweefsel/zaken.js', K + 'service/loop.js', 'server/routes/service.js'],
    dimensies: {
      van: a('Een zaak ontstaat uit niets: er is geen begintoestand die getoetst wordt. Twee meldingen over hetzelfde voegt het stadsweefsel samen, maar dat is ontdubbelen en geen begintoestand.'),
      naar: d(K + 'service/zaak.js', "'geopend'"),
      voorwaarden: p(K + 'stadsweefsel/zaken.js', 'Waar is het? Geef een gebied of een positie binnen de stad.'),
      actor: p(K + 'service/zaak.js', 'Een zaak zonder melder kan niemand beantwoorden.'),
      bevoegdheid: a('Iedereen met een account mag melden. Dat is met opzet: een melding vraagt geen recht.'),
      actie: d(K + 'service/zaak.js', 'function open('),
      bewijs: a('Een melding vraagt geen bewijs.'),
      uitkomst: d(K + 'stadsweefsel/zaken.js', 'werkVoorZaak'),
      blokkade: d(K + 'stadsweefsel/zaken.js', 'de veldploeg is ermee bezig.'),
      terugweg: a('Er is geen handeling waarmee de melder zijn eigen melding intrekt.'),
      kennis: a('Melden vraagt of levert geen les.'),
      overdracht: d(K + 'service/loop.js', 'mensVraag'),
      privacyklasse: d('server/routes/service.js', 'melder(req)', 'De melder is een sleutel of codenaam uit de sessie, nooit een naam.'),
      menselijke_bevestiging: a('Niemand bevestigt een melding; dat is de bedoeling.')
    } },

  { id: 'oplossen', van: 'zaak', naar: 'opgelost', familie: 'toestand',
    dragers: [K + 'service/loop.js', K + 'stadsweefsel/werkorders.js', K + 'stadsweefsel/zaakbeeld.js', 'server/routes/service-kantoor.js'],
    dimensies: {
      van: p(K + 'stadsweefsel/werkorders.js', 'Deze werkorder is al afgerond.',
        'Alleen het stadsweefsel. RTG Service laat elke stand naar elke stand gaan.'),
      naar: d(K + 'stadsweefsel/zaakbeeld.js', 'zaakKlaar'),
      voorwaarden: p(K + 'stadsweefsel/werkorders.js', 'Klaarmelden gaat via de klaarmelding (met naam en kosten).'),
      actor: p('server/routes/service-kantoor.js', 'RTG Service vraagt een zetel op naam.'),
      bevoegdheid: p('server/routes/service-kantoor.js', 'balieAuth'),
      actie: d(K + 'service/loop.js', 'zetStand'),
      bewijs: a('Klaar vraagt geen bewijs dat het probleem weg is. `sluitbaar` in service/klassen.js heeft geen enkele lezer, en het commentaar ernaast verwijst naar een `sluit()` in zaak.js die niet bestaat.'),
      uitkomst: d(K + 'stadsweefsel/zaakbeeld.js', 'klaarDoor'),
      blokkade: d(K + 'service/loop.js', 'Kies een stand'),
      terugweg: d(K + 'service/loop.js', 'zetStand',
        'In RTG Service kan een zaak terug naar elke stand; het stadsweefsel heeft geen heropenen.'),
      kennis: a('Een zaak sluiten vraagt geen les.'),
      overdracht: d(K + 'stadsweefsel/zaakbeeld.js', 'ctx.zaakSeintje(z)', 'De melder hoort dat zijn zaak klaar is.'),
      privacyklasse: d(K + 'stadsweefsel/zaakbeeld.js', 'tekst: mijn.tekst',
        'De melder ziet de klaarmelding met alleen zijn EIGEN tekst, niet die van de buren die hetzelfde meldden. Eerst als afwezig ingedeeld; de woordenas vond hem.'),
      menselijke_bevestiging: a('De melder bevestigt niet dat het probleem weg is. SERVICE.md zegt dat een hersteld incident geen zaken sluit; voor een zaak zelf ligt die bevestiging nergens vast.')
    } },

  { id: 'kennisvoorstel', van: 'ervaring', naar: 'kennisvoorstel', familie: 'kennis',
    dragers: [K + 'leerhuis/acties-kennis.js', K + 'leerhuis/index.js', K + 'leerhuis/standen.js'],
    dimensies: {
      van: a('Een ervaring is geen vastgelegde toestand; het voorstel begint uit het niets.'),
      naar: d(K + 'leerhuis/standen.js', "begin: 'SUBMITTED'"),
      voorwaarden: p(K + 'leerhuis/acties-kennis.js', "weiger('kennisitem '"),
      actor: p(K + 'leerhuis/index.js', 'de actor komt uit de sessie en is een geldige sleutel'),
      bevoegdheid: p(K + 'leerhuis/acties-kennis.js', 'alleen wie hier werkt of meedoet kan een voorstel indienen'),
      actie: d(K + 'leerhuis/acties-kennis.js', 'voorstelIndienen'),
      bewijs: d(K + 'leerhuis/acties-kennis.js', 'bewijs', 'Bewijs mag, en hoeft niet.'),
      uitkomst: d(K + 'leerhuis/acties-kennis.js', "soort: 'voorstel'"),
      blokkade: d(K + 'leerhuis/acties-kennis.js', 'een voorstel noemt '),
      terugweg: a('De indiener kan zijn voorstel niet intrekken; het kan alleen worden afgewezen.'),
      kennis: p(K + 'leerhuis/acties-kennis.js', 'een voorstel noemt '),
      overdracht: d(K + 'leerhuis/acties-kennis.js', 'KNOWLEDGE_OWNER'),
      privacyklasse: a('Het voorstel draagt geen privacyregel: wat de indiener opschrijft, gaat mee.'),
      menselijke_bevestiging: a('Indienen vraagt geen bevestiging; die komt bij de volgende overgang.')
    } },

  { id: 'kennis-actief', van: 'kennisvoorstel', naar: 'actieve kennis', familie: 'kennis',
    dragers: [K + 'leerhuis/acties-kennis.js', K + 'leerhuis/index.js', K + 'leerhuis/standen.js'],
    dimensies: {
      van: p(K + 'leerhuis/acties-kennis.js', 'is niet goedgekeurd'),
      naar: d(K + 'leerhuis/acties-kennis.js', 'ACTIVE'),
      voorwaarden: p(K + 'leerhuis/acties-kennis.js', 'een opvolgende versie vraagt een impactklasse'),
      actor: p(K + 'leerhuis/index.js', 'de actor komt uit de sessie en is een geldige sleutel'),
      bevoegdheid: p(K + 'leerhuis/acties-kennis.js', 'goedkeuren of afwijzen vraagt KNOWLEDGE_OWNER'),
      actie: d(K + 'leerhuis/acties-kennis.js', 'kennisStand'),
      bewijs: p(K + 'leerhuis/acties-kennis.js', 'kennis zonder bron is geen officiele kennis'),
      uitkomst: d(K + 'leerhuis/acties-kennis.js', 'kennisSchrijf'),
      blokkade: d(K + 'leerhuis/acties-kennis.js', 'er ligt al een concept van'),
      terugweg: d(K + 'leerhuis/standen.js', "ACTIVE: ['DEPRECATED', 'REVOKED']"),
      kennis: p(K + 'leerhuis/acties-kennis.js', 'wordt pas officiele kennis met de eigen bron van deze organisatie'),
      overdracht: d(K + 'leerhuis/acties-kennis.js', 'geraakt(st, i.id, i.impactKlasse)',
        'Wie door een nieuwe versie geraakt wordt, gaat terug naar leren.'),
      privacyklasse: a('Een kennisversie draagt geen privacyregel.'),
      menselijke_bevestiging: p(K + 'leerhuis/acties-kennis.js', 'wie een kennisversie schrijft, keurt hem niet zelf goed')
    } },

  { id: 'fork', van: 'blauwdruk', naar: 'lokale fork', familie: 'overdracht',
    dragers: [K + 'rtfos/netwerk.js'],
    dimensies: {
      van: p(K + 'rtfos/netwerk.js', 'Deze blauwdruk bestaat niet.'),
      naar: d(K + 'rtfos/netwerk.js', "status: 'idee'"),
      voorwaarden: p(K + 'rtfos/netwerk.js', 'Overnemen doet een ANDERE afdeling.'),
      actor: d(K + 'rtfos/netwerk.js', 'leiderKey: w.key'),
      bevoegdheid: p(K + 'rtfos/netwerk.js', "'project.beheren'"),
      actie: d(K + 'rtfos/netwerk.js', 'function neemOver('),
      bewijs: a('Overnemen vraagt geen bewijs; dat zat bij het delen.'),
      uitkomst: d(K + 'rtfos/netwerk.js', 'uitBlauwdruk: bd.id'),
      blokkade: d(K + 'rtfos/netwerk.js', 'een blauwdruk is geen besluit.'),
      terugweg: a('Een overname is alleen ongedaan te maken door het nieuwe project te stoppen.'),
      kennis: d(K + 'rtfos/netwerk.js', 'doel: bd.aanpak.slice(0, 400)'),
      overdracht: d(K + 'rtfos/netwerk.js', 'bd.overgenomen.push'),
      privacyklasse: d(K + 'rtfos/netwerk.js', 'budgetCenten: 0',
        'Het bedrag van de andere stad reist niet mee; de indicatoren beginnen op nul.'),
      menselijke_bevestiging: a('De overname zelf vraagt niemand; de eigen goedkeuring volgt daarna in overgang `buurtidee`.')
    } },

  { id: 'upstream', van: 'lokale fork', naar: 'verbetering upstream', familie: 'overdracht',
    dragers: [], geenDrager: 'Niets stuurt een verbetering terug naar de blauwdruk waar een project uit kwam. `uitBlauwdruk` wordt nergens gelezen, en een blauwdruk heeft geen versie en geen bewerkfunctie. Wie een overgenomen project later zelf deelt, maakt een NIEUWE blauwdruk zonder band met de oude.' },

  { id: 'gestopt', van: 'poging', naar: 'gestopt', familie: 'toestand',
    dragers: [K + 'rtfos/projecten-besluit.js', K + 'rtfos/projecten.js', K + 'rtfos/basis.js'],
    dimensies: {
      van: p(K + 'rtfos/projecten-besluit.js', 'kan een project naar'),
      naar: d(K + 'rtfos/projecten.js', "'gestopt'"),
      voorwaarden: a('Stoppen stelt geen voorwaarde.'),
      actor: p(K + 'rtfos/basis.js', 'boardroomWie'),
      bevoegdheid: p(K + 'rtfos/projecten-besluit.js', "'project.besluit'"),
      actie: d(K + 'rtfos/projecten.js', 'KETEN'),
      bewijs: a('Stoppen vraagt geen bewijs.'),
      uitkomst: d(K + 'rtfos/projecten-besluit.js', "'project.status'"),
      blokkade: d(K + 'rtfos/projecten.js', 'Een afgerond of gestopt project wijzigt niet meer.'),
      terugweg: a('Gestopt is een eindstation; de keten heeft er geen uitgang.'),
      kennis: a('Stoppen vraagt geen reden en geen les. Daardoor verdwijnt wat een gestopte poging leerde; de blauwdruk weigert gestopte projecten (terecht), en er is geen andere plek.'),
      overdracht: a('Er gaat niets naar een ander.'),
      privacyklasse: a('Geen privacyregel.'),
      menselijke_bevestiging: a('Stoppen vraagt geen tweede mens.')
    } },

  { id: 'les', van: 'gestopt', naar: 'les', familie: 'kennis',
    dragers: [K + 'livinglab/cyclus.js', 'server/routes/livinglab/index.js'],
    notitie: 'Alleen het Living Lab draagt deze overgang, voor ONDERZOEK en niet voor buurtprojecten. Voor een RTF-project is er geen drager (zie `gestopt`).',
    dimensies: {
      van: p(K + 'livinglab/cyclus.js', 'Een besluit hoort bij de stap besluit'),
      naar: d(K + 'livinglab/cyclus.js', 's.dossier.besluitenlog.unshift'),
      voorwaarden: p(K + 'livinglab/cyclus.js', 'Kies doorzetten, opschalen of gestopt.'),
      actor: d(K + 'livinglab/cyclus.js', 'const door = schoon(b.door, 80)',
        'Hij weigert zonder naam, maar die naam komt uit het VERZOEK en niet uit de sessie. De poort toetst dus een getypte naam en geen actor; AUTHORITY.md zegt dat de actor van een auditregel uit de sessie komt. Daarom DRAAGT en geen POORT.'),
      bevoegdheid: p('server/routes/livinglab/index.js', 'officeAuth'),
      actie: d(K + 'livinglab/cyclus.js', 'function besluitZet('),
      bewijs: a('Het besluit zelf vraagt geen bewijs; het onderzoek ervoor wel.'),
      uitkomst: d(K + 'livinglab/cyclus.js', 's.besluit = { soort, door, reden, at: nu() }'),
      blokkade: d(K + 'livinglab/cyclus.js', 'is dat de waardevolle regel.'),
      terugweg: a('Een besluit is niet terug te draaien.'),
      kennis: p(K + 'livinglab/cyclus.js', 'Waarom dit besluit?'),
      overdracht: a('De les blijft in het dossier van de studie.'),
      privacyklasse: a('Geen privacyregel.'),
      menselijke_bevestiging: a('Een mens neemt het besluit; niemand bevestigt het.')
    } },

  { id: 'les-voorstel', van: 'les', naar: 'kennisvoorstel', familie: 'kennis',
    dragers: [], geenDrager: 'Een les uit een gestopte poging wordt nergens een kennisvoorstel. Het besluitenlog van het Living Lab heeft geen lezer in het leerhuis, en `voorstelIndienen` kent geen herkomst uit een gestopte poging. Dat is precies de tussenstand die het voorstel mist: een waarneming is nog geen kennis.' }
];

/* ---------------------------------------------------------------------------
   DE INVARIANT EN DE WETTEN. Wat het document belooft, met de plek in de code
   die het afdwingt -- of de eerlijke mededeling dat die er niet is.

   Standen:
     gehandhaafd       er is code die het afdwingt, met een citaat
     deels             er is code die een helft afdwingt; de reden zegt welke
     document          het staat alleen in proza, niemand dwingt het af
     eigenaarbesluit   OWNER_DECISION_REQUIRED: geen technische keuze
     te-bouwen         het ontwerpbesluit is genomen, de code is er nog niet
   ------------------------------------------------------------------------ */
const h = (stand, bestand, citaat, reden) => ({ stand, bestand: bestand || null, citaat: citaat || null, reden });

const WETTEN = [
  { nr: 1, wet: 'De mens is geen route-object: een route ondersteunt een mens en definieert hem niet.',
    ...h('deels', K + 'knelpunt/aanvoer.js', 'draagt een gegeven over de mens: ',
      'De aanvoerlaag weigert een vondst die een gegeven over de mens draagt. Dat houdt de mens UIT de mogelijkheid; een route-object dat een mens beschrijft, houdt niemand tegen.') },
  { nr: 2, wet: 'Iedere route heeft alternatieven. Geen systeemgegenereerde lotsbestemming.',
    ...h('document', null, null, 'Nergens wordt geweigerd om EEN pad te tonen. FOUNDATION.md en HDI.md zeggen het, geen code dwingt het af.') },
  { nr: 3, wet: 'Een blokkade is informatie, geen oordeel.',
    ...h('document', null, null, 'Dit huis schrijft weigeringen met een reden (as A telt `blokkade` in bijna elke overgang), maar niets dwingt het af: een weigering zonder reden laat geen toets zakken.') },
  { nr: 4, wet: 'Een vondst is geen recht, bevoegdheid of geschiktheid.',
    ...h('deels', K + 'knelpunt/aanvoer.js', 'draagt een gegeven over de mens: ',
      'Omdat een vondst de mens niet kent, KAN hij geen geschiktheidsoordeel zijn. Of iemand mag solliciteren, beslist de sollicitatielaag; dat een vondst nooit als toegang wordt gelezen, dwingt niemand af.') },
  { nr: 5, wet: 'Een rol verleent geen competentie; competentie verleent geen authority.',
    ...h('gehandhaafd', K + 'leerhuis/brug.js', 'Geschiktheid is geen bevoegdheid',
      'De brug van het leerhuis geeft hoogstens AUTHORITY_ELIGIBLE met `verleent: false`. Let op: het leerhuis is NIET verbonden met persoonseis/vakbewijs, dus bewezen competentie en afgetekende bevoegdheid zijn twee werelden zonder brug.') },
  { nr: 6, wet: 'De echte wereld is leidend: digitaal voltooid zonder werkelijk bewijs telt niet waar bewijs vereist is.',
    ...h('gehandhaafd', K + 'rtfos/netwerk.js', 'Zonder cijfers is dit een idee en geen blauwdruk.',
      'Waar bewijs een poort is (blauwdruk, VOG, beoordeling, vakbewijs, kennisbron), dwingt de drager het af. Waar het afwezig is (een zaak sluiten, een project actief zetten), telt digitaal voltooid gewoon.') },
  { nr: 7, wet: 'Persoonlijke ervaring wordt nooit automatisch collectieve kennis.',
    ...h('deels', K + 'leerhuis/acties-kennis.js', 'wie een kennisversie schrijft, keurt hem niet zelf goed',
      'Binnen het leerhuis wordt een voorstel pas kennis na een tweede mens. Daarbuiten bestaat er geen collectieve kennis om automatisch in te lopen.') },
  { nr: 8, wet: 'Alleen vrijwillig vrijgegeven en veilig geabstraheerde kennis mag reizen.',
    ...h('deels', K + 'rtfos/netwerk.js', '({ naam: i.naam, doel: i.doel })',
      'Het ABSTRAHEREN wordt afgedwongen. Het VRIJWILLIGE niet: een blauwdruk deelt wie `project.beheren` heeft, niet de mensen van wie de ervaring was.') },
  { nr: 9, wet: 'Mislukking mag kennis worden, maar niet automatisch een blauwdruk.',
    ...h('deels', K + 'rtfos/netwerk.js', "['actief', 'afgerond'].includes(p.status)",
      'De tweede helft staat: een gestopt project wordt nooit een blauwdruk (proef `gestoptGeenBlauwdrukbron`). De eerste helft niet: een gestopt RTF-project laat geen les achter.') },
  { nr: 10, wet: 'Een fork erft methode, nooit deelnemers, toestemming, geld of authority.',
    ...h('gehandhaafd', K + 'rtfos/netwerk.js', 'budgetCenten: 0',
      'Overnemen begint op idee, met budget nul, zonder resultaten en met de eigen goedkeuringsketen.') },
  { nr: 11, wet: 'AI stelt voor; bevoegde mensen en organisaties beslissen waar dat vereist is.',
    ...h('deels', K + 'stuur/beleid.js', "voorstel: 'voorstel'",
      'Het stuur kent `voorstel` als niveau waarop een mens bevestigt. Voor de Foundation-overgangen zelf is er geen AI-pad om te begrenzen.') },
  { nr: 12, wet: 'Foundation optimaliseert uitvoerbaarheid, niet gehoorzaamheid.',
    ...h('document', null, null, 'Een richtingsregel; er is niets om af te dwingen zolang er geen optimizer is.') },
  { nr: 13, wet: 'Aandacht is geen impact.',
    ...h('gehandhaafd', K + 'connect/portfolio.js', 'a && a.portfolio',
      '`bereikt` draagt `aanspraak: geen` en komt niet in het portfolio.') },
  { nr: 14, wet: 'Geen mens of buurt krijgt een waardescore.',
    ...h('deels', 'scripts/lib/cijferopmens.js', 'VERBODEN_ONDERWERP',
      'CAR-05 heeft een toets voor een cijfer op een MENS. Een score op een BUURT staat daar niet in.') },
  { nr: 15, wet: 'Het systeem leert van overgangen, niet van surveillance.',
    ...h('gehandhaafd', K + 'connect/horizon.js', 'const GEEN_SIGNAAL',
      'Kijktijd, scrollsnelheid en tijdstip zijn als signaal geweigerd.') },
  { nr: 16, wet: 'Wie een probleem kan oplossen, krijgt minimaal noodzakelijke informatie.',
    ...h('deels', K + 'rtfos/gemeente.js', 'const K = 5',
      'Celveilig, niet queryveilig: als precies een buurt onder de drempel valt, staat haar exacte aantal onder "overige buurten (1)" (proef `buurtenQueryveilig`).') },
  { nr: 17, wet: 'Iedere materiele aanbeveling heeft herkomst.',
    ...h('deels', K + 'knelpunt/aanvoer.js', "'herkomst'",
      'Een vondst zonder herkomst wordt geweigerd. Een aanbeveling buiten de aanvoerlaag draagt er geen.') },
  { nr: 18, wet: 'Teruggeven blijft vrijwillig: je mag Foundation gebruiken zonder ooit bij te dragen.',
    ...h('document', null, null, 'Er is geen poort die bijdragen eist, maar ook niets dat een toekomstige eis tegenhoudt.') },
  { nr: 19, wet: 'Vergeten moet mogelijk blijven.',
    ...h('eigenaarbesluit', null, null, 'OWNER_DECISION_REQUIRED: wat er met AANGENOMEN collectieve kennis gebeurt als de maker wordt vergeten -- alleen de naam eraf, of de kennis ook. Zie besluit B7.') },
  { nr: 20, wet: 'Wie na jou komt, moet verder kunnen beginnen -- niet verplicht verder moeten gaan.',
    ...h('document', null, null, 'Een richtingsregel.') }
];

const BESLUITEN = [
  { nr: 'B1', besluit: 'Aggregatie is queryveilig, niet alleen celveilig: vaste views, minimumcel, complementaire onderdrukking, tijdvensters, geen vrije gemeentelijke OLAP over gevoelige dimensies.',
    ...h('te-bouwen', K + 'rtfos/gemeente.js', 'const K = 5',
      'Er is een minimumcel en een vaste view (het portaal roept alleen `cijfersVan` aan). Complementaire onderdrukking en tijdvensters ontbreken; zie proef `buurtenQueryveilig`.') },
  { nr: 'B2', besluit: 'Foundation zet financiele handelingen klaar maar wordt geen betaalroute; de organisatie betaalt via haar eigen geld- en arbeidsketen.',
    ...h('deels', K + 'rtfos/gift-betalen.js', 'partnerIn',
      'Een gift komt binnen over RTG Pay als bij elke zaak. Er is geen pad waarlangs de Foundation een mens betaalt, en dat moet zo blijven.') },
  { nr: 'B3', besluit: 'De vijf standen (werk, leren, vrijwillig, oefenen, helpen) krijgen toelatingsregels; misclassificatie eindigt fail-closed in WEIGER.',
    ...h('te-bouwen', null, null, 'Geen van de vijf bestaat als stand. Er is VRIJWILLIG (vrijwilligers.js) en WERK (employment.js), zonder regel ertussen.') },
  { nr: 'B4', besluit: 'Vrijwillige menselijke ontwikkeling krijgt geen funnelmetriek.',
    ...h('document', null, null, 'Er is vandaag geen conversiecijfer op bezoeker -> deelnemer -> mentor, en niets dat er een tegenhoudt.') },
  { nr: 'B5', besluit: 'VERDER is onherleidbaar: geen plaats, persoon of exacte tijd, vertraagd, alleen extern bewezen gebruikt/doorgegeven, geen oplopende teller.',
    ...h('te-bouwen', K + 'connect/tredenlijst.js', 'eenmalig: true',
      'De treden zijn eenmalig en `bereikt` telt niet. VERDER zelf bestaat niet.') },
  { nr: 'B6', besluit: 'Intentie blijft prive: een organisatie ziet iemand pas na diens expliciete overdracht.',
    ...h('document', null, null, 'Overgang `deelnemen` laat het KANTOOR inschrijven; er is geen stap waarin de mens zijn eigen voornemen overdraagt.') },
  { nr: 'B7', besluit: 'Vergeten tegenover aangenomen collectieve kennis.',
    ...h('eigenaarbesluit', null, null, 'OWNER_DECISION_REQUIRED.') },
  { nr: 'B8', besluit: '"Waarom zie ik dit?" toont zowel de gebruikte als de bewust niet gebruikte factoren.',
    ...h('deels', K + 'connect/horizon.js', 'const GEEN_SIGNAAL',
      'Connect houdt een lijst van wat bewust NIET wordt gebruikt, en de mixer zegt per motor waarom hij niet kijkt. Een scherm "Waarom zie ik dit?" dat beide toont, bestaat niet.') }
];

/* ---------------------------------------------------------------------------
   DE CITATEN NATREKKEN. Een citaat telt alleen als het in de CODE staat: de
   bron zonder commentaar, maar met de tekenreeksen erin (een weigerzin IS
   code). Een citaat dat alleen in een toelichting staat, is ROT.
   ------------------------------------------------------------------------ */
const codeCache = new Map();
function code(bestand) {
  if (!codeCache.has(bestand)) {
    const vol = path.join(WORTEL, bestand);
    codeCache.set(bestand, fs.existsSync(vol) ? zonderCommentaar(fs.readFileSync(vol, 'utf8')) : null);
  }
  return codeCache.get(bestand);
}
/* Een stand die iets BEWEERT (poort, draagt, gehandhaafd, deels) zonder citaat
   is rot, niet vrijgesteld. De eerste versie liet hem door -- `if (!citaat)
   return null` -- en dan kon een poort zonder enige grond de kern verhogen. */
const BEWEERT = new Set(['poort', 'draagt', 'gehandhaafd', 'deels']);
function natrek(cel) {
  if (!cel.bestand || !cel.citaat) return BEWEERT.has(cel.stand) ? 'geen citaat bij een stand die iets beweert' : null;
  const c = code(cel.bestand);
  if (c === null) return 'bestand bestaat niet';
  if (!c.includes(cel.citaat)) return 'citaat staat niet (meer) in de code';
  return null;
}

/* ---------------------------------------------------------------------------
   A + B. De dimensies, nagetrokken, met de woorden ernaast.
   ------------------------------------------------------------------------ */
function dimensieAs(overgangen) {
  const rot = [];
  const gemeten = [];
  const zonderDrager = [];
  const onenig = [];
  for (const o of overgangen) {
    if (!o.dragers.length) { zonderDrager.push({ id: o.id, van: o.van, naar: o.naar, reden: o.geenDrager }); continue; }
    const dims = {};
    for (const dim of DIMS) {
      const cel = o.dimensies[dim];
      if (!cel) { rot.push({ overgang: o.id, dimensie: dim, reden: 'geen stand opgegeven' }); dims[dim] = { stand: 'afwezig', reden: 'niet ingedeeld' }; continue; }
      if (cel.stand === 'afwezig') { dims[dim] = cel; continue; }
      const fout = natrek(cel);
      if (fout) {
        rot.push({ overgang: o.id, dimensie: dim, bestand: cel.bestand, citaat: cel.citaat, reden: fout });
        /* Een rot citaat telt als AFWEZIG en niet als zijn verklaarde stand:
           de goede kant om fout te zitten, want het verlaagt de kern en kan
           dus geen gedeelde vorm verzinnen. */
        dims[dim] = { stand: 'afwezig', reden: 'citaat rot: ' + fout };
      } else dims[dim] = cel;
    }
    // B. de woorden over de dragers samen
    const namen = o.dragers.map(b => {
      const vol = path.join(WORTEL, b);
      return fs.existsSync(vol) ? om.wring(fs.readFileSync(vol, 'utf8')) : '';
    }).join('\n');
    for (const [dim, re] of Object.entries(WOORDEN)) {
      const woord = re.test(namen);
      const verklaard = R.aanwezig({ dimensies: dims }, dim);
      if (woord !== verklaard) onenig.push({ overgang: o.id, dimensie: dim,
        verklaard: dims[dim].stand, woorden: woord ? 'raak' : 'mis',
        nagekeken: NAGEKEKEN[o.id + '.' + dim] || null,
        lezing: woord ? 'de woorden vinden iets waar de indeling niets ziet -- nakijken of de indeling iets mist'
          : 'de indeling ziet iets dat de woorden niet vinden -- meestal een weigerzin (die staat in een tekenreeks)' });
    }
    gemeten.push({ id: o.id, van: o.van, naar: o.naar, familie: o.familie, dragers: o.dragers,
      notitie: o.notitie || null, dimensies: dims });
  }
  /* Een nagekeken onenigheid die niet meer voorkomt, is verouderd: de indeling
     of de code is veranderd en de verklaring hangt nergens meer aan. Blijft hij
     staan, dan verklaart hij straks een NIEUWE onenigheid op dezelfde plek
     zonder dat iemand keek. */
  const nu = new Set(onenig.map(x => x.overgang + '.' + x.dimensie));
  const verouderd = Object.keys(NAGEKEKEN).filter(k => !nu.has(k));
  return { gemeten, zonderDrager, rot, onenig, verouderd };
}

/* ---------------------------------------------------------------------------
   C. De vorm: delen de dragers VELDEN? Dezelfde rekenwijze als planvorm.
   ------------------------------------------------------------------------ */
function vormAs(gemeten) {
  const g = om.lees();
  const envelop = new Set(JSON.parse(fs.readFileSync(path.join(WORTEL, 'OBJECTMODEL.json'), 'utf8')).envelop);
  const per = new Map();
  for (const o of gemeten) {
    const velden = new Set();
    for (const v of g.vormen) if (o.dragers.includes(v.module)) for (const f of v.velden) if (!envelop.has(f)) velden.add(f);
    if (velden.size) per.set(o.id, velden);
  }
  const ids = [...per.keys()];
  const veldOvergang = new Map();
  for (const id of ids) for (const f of per.get(id)) {
    if (!veldOvergang.has(f)) veldOvergang.set(f, new Set());
    veldOvergang.get(f).add(id);
  }
  /* Een drager die in twee overgangen staat (netwerk.js in blauwdruk en fork)
     deelt zijn velden met zichzelf. Dat staat erbij, want het verhoogt de
     gedeeldheid zonder dat er iets gedeeld wordt. */
  const gedeeldeDragers = [];
  for (let i = 0; i < gemeten.length; i++) for (let j = i + 1; j < gemeten.length; j++) {
    const samen = gemeten[i].dragers.filter(x => gemeten[j].dragers.includes(x));
    if (samen.length) gedeeldeDragers.push({ paar: [gemeten[i].id, gemeten[j].id], dragers: samen });
  }
  const n = ids.length;
  const velden = veldOvergang.size;
  const inAlle = [...veldOvergang].filter(([, s]) => s.size === n).map(([f]) => f).sort();
  const inEen = [...veldOvergang].filter(([, s]) => s.size === 1).length;
  return {
    overgangenMetVorm: ids, zonderVorm: gemeten.map(o => o.id).filter(id => !per.has(id)),
    velden, inAlleOvergangen: inAlle,
    inEenOvergangPct: velden ? Number(((inEen / velden) * 100).toFixed(1)) : 0,
    gedeeldeDragers
  };
}

/* ---------------------------------------------------------------------------
   D. DE PROEVEN op de echte modules. Elke proef heeft een BESTURING: een
   invoer waarop hij juist WEL moet slagen. Een poort die altijd dicht zit,
   laat een weigering zien die niets bewijst.
   ------------------------------------------------------------------------ */
function stubCtx(extra) {
  let n = 0;
  return Object.assign({
    nu: () => '2026-09-30T12:00:00.000Z', rid: () => 'id' + (++n),
    schoon: (s, max) => String(s == null ? '' : s).trim().slice(0, max || 200),
    euro: (c) => c, audit: () => {}, save: () => {},
    wie: () => ({ key: 'lid:1' }),
    poort: () => ({ ok: true, stad: { id: 's1', naam: 'Proefstad' } }),
    bereik: () => ['s1'], stadVan: () => ({ id: 's1', naam: 'Proefstad' })
  }, extra || {});
}

function proefNetwerk(status, indicatoren) {
  const staat = { projecten: [{ id: 'p1', stad: 's1', naam: 'Avondwerkplaats', soort: 'buurt', vlag: 'x',
    status, indicatoren }], blauwdrukken: [] };
  const net = require('../server/kern/rtfos/netwerk.js')(stubCtx({ S: () => staat }));
  return net.deel({}, 'p1', { aanpak: 'Begin op maandag met een open avond in het buurthuis.', geleerd: 'Een begeleider was te weinig.' });
}

function proefVog(vogGeldig) {
  const v = { id: 'v1', stad: 's1', naam: 'Proefvrijwilliger', status: 'actief', gedragscode: true, projecten: [],
    vogGeldigTot: vogGeldig ? '2099-01-01' : null };
  const staat = { projecten: [{ id: 'p1', stad: 's1', naam: 'Huiswerkklas', soort: 'huiswerk', vrijwilligers: [] }] };
  const ctx = stubCtx({ S: () => staat, magInStad: () => true });
  const inzet = require('../server/kern/rtfos/vrijwilligers-inzet.js')(ctx, {
    vind: () => v, vogGeldig: (x) => !!x.vogGeldigTot, beeld: (x) => ({ id: x.id }),
    VOG_VERPLICHT: require('../server/kern/rtfos/vrijwilligers.js').VOG_VERPLICHT });
  return inzet.koppel({}, 'v1', 'p1');
}

/* Een UNIVERSELE MOTOR die alleen de kern kent. Hij laat een overgang door als
   alle kerndimensies in de invoer staan -- meer kan een motor niet die zijn
   dimensies uit de gemeenschappelijke vorm haalt. Wat hier "ok" zegt terwijl
   de drager weigert, is een overgang die in die vorm TEN ONRECHTE slaagt. */
function universeleMotor(kern, invoer) {
  const mist = kern.filter(k => !(k in invoer));
  return mist.length ? { ok: false, mist } : { ok: true };
}

function proeven(kern) {
  const uit = {};
  const gemetenIndicator = [{ naam: 'deelnemers', doel: 10, bereikt: 6 }];

  // 1. De invariant: gestopt is nooit een blauwdrukbron.
  const gestopt = proefNetwerk('gestopt', gemetenIndicator);
  const besturing1 = proefNetwerk('actief', gemetenIndicator);
  uit.gestoptGeenBlauwdrukbron = {
    wat: 'Een gestopt project met een gemeten indicator probeert een blauwdruk te worden.',
    gestopt: gestopt.ok ? 'geslaagd' : 'geweigerd: ' + gestopt.error,
    besturing: besturing1.ok ? 'geslaagd' : 'geweigerd: ' + besturing1.error,
    houdt: !gestopt.ok && besturing1.ok
  };

  // 2. De mutatieproef op bewijs, op twee dragers, tegen de universele motor.
  const zonderIndicator = proefNetwerk('actief', []);
  const zonderVog = proefVog(false);
  const metVog = proefVog(true);
  const invoer = Object.fromEntries(kern.map(k => [k, true]));
  const motor = universeleMotor(kern, invoer);
  uit.mutatieBewijs = {
    wat: 'Haal `bewijs` uit de vorm. Twee echte dragers krijgen een verzoek zonder bewijs; een universele motor die alleen de kern (' +
      kern.join(', ') + ') kent, krijgt hetzelfde verzoek.',
    blauwdrukZonderIndicator: { drager: zonderIndicator.ok ? 'geslaagd' : 'geweigerd: ' + zonderIndicator.error,
      universeleMotor: motor.ok ? 'geslaagd' : 'geweigerd' },
    koppelingZonderVog: { drager: zonderVog.ok ? 'geslaagd' : 'geweigerd: ' + zonderVog.error,
      universeleMotor: motor.ok ? 'geslaagd' : 'geweigerd' },
    besturing: { blauwdrukMetIndicator: besturing1.ok ? 'geslaagd' : 'geweigerd', koppelingMetVog: metVog.ok ? 'geslaagd' : 'geweigerd: ' + metVog.error },
    tenOnrechte: (!zonderIndicator.ok && motor.ok ? 1 : 0) + (!zonderVog.ok && motor.ok ? 1 : 0),
    besturingHoudt: besturing1.ok && metVog.ok
  };

  // 3. Bevoegdheid: dezelfde koppeling met een poort die NEE zegt.
  const staat = { projecten: [{ id: 'p1', stad: 's1', naam: 'Huiswerkklas', soort: 'huiswerk', vrijwilligers: [] }] };
  const v = { id: 'v1', stad: 's1', naam: 'Proefvrijwilliger', status: 'actief', gedragscode: true, projecten: [], vogGeldigTot: '2099-01-01' };
  const zonderRecht = require('../server/kern/rtfos/vrijwilligers-inzet.js')(stubCtx({ S: () => staat, magInStad: () => true,
    poort: () => ({ ok: false, status: 403, error: 'geen bevoegdheid (proef)' }) }), {
    vind: () => v, vogGeldig: (x) => !!x.vogGeldigTot, beeld: (x) => ({ id: x.id }), VOG_VERPLICHT: ['huiswerk'] }).koppel({}, 'v1', 'p1');
  uit.mutatieBevoegdheid = {
    wat: 'Haal `bevoegdheid` uit de vorm: dezelfde koppeling, maar de handelende mens heeft het recht niet.',
    drager: zonderRecht.ok ? 'geslaagd' : 'geweigerd: ' + zonderRecht.error,
    universeleMotor: kern.includes('bevoegdheid') ? 'geweigerd (bevoegdheid zit in de kern)' : (motor.ok ? 'geslaagd' : 'geweigerd'),
    tenOnrechte: !zonderRecht.ok && !kern.includes('bevoegdheid') && motor.ok ? 1 : 0
  };

  // 4. Queryveiligheid: een drempel per cel is geen drempel per vraag.
  const gem = require('../server/kern/rtfos/gemeente.js')({}, { cijfersVan() {} });
  const een = gem.buurten({ Zeewijk: 3, Centrum: 10, Noord: 12 });
  const twee = gem.buurten({ Zeewijk: 3, Oost: 2, Centrum: 10 });
  const lek = (rijen) => rijen.filter(r => r.samengevoegd && /\(1\)/.test(r.wijk) && r.aantal < gem.K);
  uit.buurtenQueryveilig = {
    wat: 'De gemeente ziet hulpvragen per buurt; buurten onder ' + gem.K + ' worden samengevoegd. Wat als er precies een onder de drempel valt?',
    eenKleineBuurt: een, tweeKleineBuurten: twee,
    lekt: lek(een).length > 0,
    besturing: lek(twee).length === 0,
    lezing: 'De gemeente kent haar eigen buurten. Staat er "overige buurten (1)", dan weet zij welke buurt ontbreekt -- en ziet zij haar exacte aantal, onder de drempel die het moest verbergen. Dat is celveilig en niet queryveilig.'
  };
  return uit;
}

function meet(opties) {
  const overgangen = (opties && opties.overgangen) || OVERGANGEN;
  const A = dimensieAs(overgangen);
  const indeling = {};
  for (const o of overgangen) (indeling[o.familie] = indeling[o.familie] || []).push(o.id);
  const oordeel = R.oordeel(A.gemeten, DIMS, indeling, 0.6);
  const C = vormAs(A.gemeten);
  const D = proeven(oordeel.kern);

  const wetRot = [];
  const wetten = WETTEN.concat(BESLUITEN).map(w => {
    const fout = natrek(w);
    if (fout) wetRot.push({ nr: w.nr, bestand: w.bestand, citaat: w.citaat, reden: fout });
    return fout ? Object.assign({}, w, { stand: 'document', rot: fout }) : w;
  });
  const telStand = (lijst) => lijst.reduce((t, w) => (t[w.stand] = (t[w.stand] || 0) + 1, t), {});

  /* DE CONCLUSIE WORDT AFGELEID EN NIET OPGESCHREVEN: elk getal erin komt uit
     de rekening hierboven, zodat de zin niet kan blijven staan als de uitslag
     verschuift. */
  const fam = oordeel.families;
  const meer = fam.afgeleid.groepen.filter(g => g.leden.length > 1);

  /* DE BIJNA-KERN: dimensies die in alle overgangen staan op hoogstens TWEE
     na, met die uitzonderingen erbij. Dit is geen tweede kern en hij draagt de
     uitkomst niet -- een kern met uitzonderingen IS geen kern. Hij staat er
     omdat de vraag "welke kleine grammatica blijft over" anders alleen de vier
     dimensies hoort die letterlijk overal staan, terwijl de uitzonderingen zelf
     het antwoord dragen: welke overgangen wijken af, en is dat met opzet? */
  const n = A.gemeten.length;
  const bijnaKern = DIMS.filter(dim => !oordeel.kern.includes(dim)).map(dim => {
    const zonder = A.gemeten.filter(o => !R.aanwezig(o, dim)).map(o => o.id);
    return { dimensie: dim, aanwezig: n - zonder.length, zonder };
  }).filter(x => x.zonder.length <= 2);
  const conclusie = {
    UNIVERSEEL: 'UNIVERSEEL: geen enkele dimensie is ergens een poort en elders afwezig. Een gedeelde overgang met ' +
      'precies de kern (' + oordeel.kern.join(', ') + ') is verdedigbaar.',
    FAMILIES: 'FAMILIES: er is geen universele overgang (' + oordeel.dilemmas.length + ' dilemma\'s), maar elke ' +
      'voorgestelde familie is dilemmavrij en onderscheidt zich van de rest. Bouw per familie, met de kern (' +
      oordeel.kern.join(', ') + ') als gedeelde grammatica eronder.',
    ANDERE_FAMILIES: 'ANDERE FAMILIES: de voorgestelde indeling houdt niet, maar de groepen die de data zelf vormt ' +
      'zijn dilemmavrij: ' + meer.map(g => '[' + g.leden.join(' ') + ']').join(' ') + '. De gedachte klopt, de indeling niet.',
    GEEN: 'GEEN UNIVERSELE OVERGANG GEVONDEN. ' + oordeel.dilemmas.length + ' van de ' + DIMS.length + ' dimensies zijn ' +
      'ergens een poort en elders afwezig (' + oordeel.dilemmas.map(x => x.dimensie).join(', ') + '). Een gemeenschappelijke ' +
      'vorm moet ze weglaten -- dan slaagt een overgang ten onrechte, en dat is op de echte code gedraaid -- of overal ' +
      'verplichten, en dan verzinnen overgangen een bewijs, een bevoegdheid of een les die ze niet kennen. De voorgestelde ' +
      'families onderscheiden zich wel van elkaar (' + fam.hypothese.filter(h => h.onderscheidt).length + ' van ' +
      fam.hypothese.length + '), en ' + fam.hypothese.filter(h => h.dilemmavrij).length + ' ervan is dilemmavrij; van de ' +
      meer.length + ' groepen die de data zelf vormt zijn dat er ' + meer.filter(g => !g.dilemmas.length).length + '. Wat overal staat is ' + oordeel.kern.join(', ') + ': iemand doet iets, er is een nieuwe stand, en een ' +
      'weigering zegt waarom. Dat is een VERKLARING VAN WERKWOORDEN en geen objecttype; de poorten blijven bij de ' +
      'domeinen die ze vandaag al hebben.'
  }[oordeel.uitkomst];

  return {
    stempel: stempel(),
    uitleg: 'Is er EEN overgang onder werk, leren, bevoegdheid, buurtinitiatieven, kennis en blauwdrukken? ' +
      'Zestien overgangen tegen veertien dimensies, met een citaat per cel dat letterlijk in de code moet staan, ' +
      'plus proeven op de echte modules. De vraag staat in VERDER.md par. 2; de eigenaar vroeg deze meter het idee ' +
      'kapot te proberen te krijgen.',
    grens: 'DE INDELING IS EEN OORDEEL: het citaat bewijst dat de code er staat, niet dat hij deze dimensie IS. Daarom ' +
      'staat de lexicale as ernaast en wordt elke onenigheid gemeld in plaats van beslecht. De vormas leest alleen ' +
      'expliciete velden (de blinde vlek van scripts/objectmodel.js) en een drager die in twee overgangen staat, deelt ' +
      'zijn velden met zichzelf. De proeven draaien de echte modules met een verzonnen context: ze bewijzen dat een ' +
      'poort dichtgaat en een besturing opengaat, niet dat de route eromheen hetzelfde doet. Een overgang zonder drager ' +
      'telt niet mee in de noemer.',
    uitkomst: oordeel.uitkomst, conclusie,
    dimensies: DIMENSIES,
    noemer: { overgangen: overgangen.length, metDrager: A.gemeten.length, zonderDrager: A.zonderDrager.length },
    kern: oordeel.kern,
    bijnaKern,
    dilemmas: oordeel.dilemmas,
    mutatieproef: oordeel.mutatieproef,
    families: oordeel.families,
    citaten: { rot: A.rot.length, rotLijst: A.rot },
    woorden: { onenig: A.onenig.length, onverklaard: A.onenig.filter(x => !x.nagekeken).length,
      verouderd: A.verouderd,
      lijst: A.onenig, graad: 'vermoed' },
    vorm: C,
    proeven: D,
    wetten: { stand: telStand(wetten.filter(w => typeof w.nr === 'number')),
      besluiten: telStand(wetten.filter(w => typeof w.nr === 'string')), rot: wetRot.length, rotLijst: wetRot, lijst: wetten },
    overgangen: A.gemeten,
    zonderDrager: A.zonderDrager
  };
}

function druk(u) {
  const kort = { poort: 'P', draagt: 'd', afwezig: '.' };
  console.log('\nDE OVERGANGSVORM -- ' + u.noemer.overgangen + ' overgangen, ' + u.noemer.metDrager + ' met een drager\n');
  console.log('  ' + ''.padEnd(16) + DIMS.map(x => x.slice(0, 3)).join(' '));
  for (const o of u.overgangen)
    console.log('  ' + o.id.padEnd(16) + DIMS.map(x => ' ' + kort[o.dimensies[x].stand] + ' ').join(' '));
  for (const z of u.zonderDrager) console.log('  ' + z.id.padEnd(16) + '\x1b[33m-- geen drager\x1b[0m');
  console.log('\n  P = poort (weigert), d = draagt, . = afwezig');
  console.log('\n  kern (in alle overgangen)  ' + (u.kern.join(', ') || '(leeg)'));
  console.log('  dilemma\'s                  ' + u.dilemmas.map(x => x.dimensie).join(', '));
  for (const b of u.bijnaKern) console.log('  bijna-kern ' + b.dimensie.padEnd(15) + ' ' + b.aanwezig + '/' + u.noemer.metDrager + ', niet in: ' + b.zonder.join(', '));
  for (const f of u.families.hypothese)
    console.log('  familie ' + f.familie.padEnd(11) + ' kern ' + String(f.kern.length).padStart(2) + ', dilemma\'s ' +
      String(f.dilemmas.length).padStart(2) + ', binnen ' + f.gelijkenisBinnen + ' / buiten ' + f.gelijkenisBuiten +
      '  ' + (f.onderscheidt === null ? 'niet te toetsen' : (f.onderscheidt ? 'onderscheidt zich' : 'onderscheidt zich NIET') + ', ' + (f.dilemmavrij ? 'dilemmavrij' : 'NIET dilemmavrij')));
  for (const g of u.families.afgeleid.groepen) console.log('  afgeleid [' + g.leden.join(' ') + ']  dilemma\'s: ' + (g.dilemmas.join(', ') || 'geen'));
  console.log('\n  vorm: ' + u.vorm.velden + ' velden, in ALLE ' + u.vorm.inAlleOvergangen.length + ', in precies een ' + u.vorm.inEenOvergangPct + '%');
  console.log('  citaten rot: ' + u.citaten.rot + '   woorden oneens: ' + u.woorden.onenig + ', onverklaard ' + u.woorden.onverklaard + ' (vermoed)');
  const P = u.proeven;
  console.log('\n  proef gestopt != blauwdrukbron   ' + (P.gestoptGeenBlauwdrukbron.houdt ? 'houdt' : '\x1b[31mBREEKT\x1b[0m'));
  console.log('  mutatie bewijs: ten onrechte     ' + P.mutatieBewijs.tenOnrechte + ' (besturing ' + (P.mutatieBewijs.besturingHoudt ? 'houdt' : 'BREEKT') + ')');
  console.log('  mutatie bevoegdheid: ten onrechte ' + P.mutatieBevoegdheid.tenOnrechte);
  console.log('  buurten queryveilig               ' + (P.buurtenQueryveilig.lekt ? '\x1b[33mNEE -- een kleine buurt lekt\x1b[0m' : 'ja'));
  console.log('\n  wetten: ' + JSON.stringify(u.wetten.stand) + '   besluiten: ' + JSON.stringify(u.wetten.besluiten) + '   rot: ' + u.wetten.rot);
  console.log('\n' + (u.uitkomst === 'UNIVERSEEL' ? '\x1b[33m' : '\x1b[32m') + u.conclusie + '\x1b[0m');
}

module.exports = { meet, druk, DOEL, DIMENSIES, DIMS, OVERGANGEN, WETTEN, BESLUITEN, natrek, universeleMotor };

if (require.main === module) {
  const u = meet();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); return; }
  druk(u);
  for (const r of u.citaten.rotLijst) console.log('  \x1b[31mrot\x1b[0m ' + r.overgang + '.' + r.dimensie + ': ' + r.reden + ' -- ' + (r.citaat || ''));
  for (const r of u.wetten.rotLijst) console.log('  \x1b[31mrot\x1b[0m wet ' + r.nr + ': ' + r.reden + ' -- ' + r.citaat);
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
    console.log('\ngeschreven: OVERGANGSVORM.json');
  }
}
