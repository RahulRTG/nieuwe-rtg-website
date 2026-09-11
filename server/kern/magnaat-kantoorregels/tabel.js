/* De eigenaarsregels van het RTG Controleregister: DE TABEL.

   Een eigen bestand omdat het een TABEL is en geen logica, en omdat
   ../magnaat-kantoorregels.js er met deze tabel erin over de 10 KB ging
   (keuringsregel 13). Die grens is een dakpan: eroverheen betekent dat er een
   tweede onderwerp in zit, en dat was hier ook zo -- de tabel en de opzoeking
   eromheen. Dezelfde knip als bij ../platformregister/bediening.js.

   VOLGORDE IS GEDRAG. Eerste match wint, dus specialistische kamers staan voor
   brede bedrijfs- en ledendomeinen. Wie hier een regel tussenvoegt, verandert
   waar alles eronder terechtkomt; de redenen staan per blok in het commentaar.
   ========================================================================== */
'use strict';

const REGELS = [
  [/office\/boardroom|\/boardroom|\/decision-room\.html/, 'boardroom', 'De Boardroom'],
  [/member\/magnaat|office\/magnaat|magnaat-kantoor|\/command\b|\/lab2\b/, 'controleregister', 'RTG Controleregister'],
  [/office\/(?:paniek|rampbeeld)|paniekkamer|\/noodkaart|\/veiligheid|\/kmar/, 'paniekkamer', 'De Paniekkamer'],
  [/office\/bank/, 'bank', 'RTG Rekening'],
  [/office\/weefsel|\/stad|\/gemeente|\/overheid|\/huur|\/vastgoed/, 'stad', 'RTG Stad'],
  [/office\/regering|\/rijksloket|\/defensie/, 'regering', 'Het Regeringskantoor'],
  [/office\/opvang/, 'opvang', 'Opvang & migratie'],
  [/office\/balie|\/ledenregister/, 'balie', 'De Ledenbalie'],
  /* HET CARRIERE LEDGER, en deze regel staat VOOR de brede office-, supplier-
     en ledenregels -- dezelfde reden als bij RTG Service hieronder. Het ledger
     heeft DRIE deuren (lid, kantoor, zaak) en dat is een capability; zonder
     deze regel kwamen ze in drie kamers, en geen van de drie gekozen.
     De Ledenbalie en niet HR: HR is het personeel van RTG, dit is het eigen
     dossier van een LID -- zoals `/ledenregister` hierboven. */
  [/\/carriere\b|\/loopbaan/, 'balie', 'De Ledenbalie'],
  /* RTG SERVICE HOORT BIJ DE KLANTENSERVICE, en dat moest hier staan: zonder
     deze regel viel de hele hulplijn terug op "Onderzoek & data", en die
     terugval bestaat juist om te voorkomen dat onbekend werk stilletjes ergens
     belandt (zie de kop van ../magnaat-kantoorregels.js). Hij staat VOOR de
     brede office- en ledenregels hieronder, want /api/office/service/* is
     servicewerk en geen kantoorwerk -- en de volgorde is hier gedrag.

     Het ondertitelen staat er los bij: die deur wordt door ELK gesprek in dit
     huis gebruikt en niet alleen door de hulplijn, maar hij is wel in dezelfde
     ronde en met hetzelfde doel gebouwd (SERVICE.md par. 13d). */
  [/\/api\/service\b|\/service\/(?:zaak|bevestig|machtiging|gesprek|kanalen)|service-bel|leverancier-service|\/service\.html/, 'klantenservice', 'Klantenservice'],
  [/\/api\/ondertiteling\b/, 'klantenservice', 'Klantenservice'],
  [/office\/redactie|\/redactie|\/krant|\/nieuws/, 'redactie', 'RTG Redactie'],
  [/office\/atelier(?:web)?|\/atelier/, 'atelier', 'RTG Atelier'],
  [/office\/studio|\/studio/, 'studio', 'RTG Ontwerpstudio'],
  [/office\/hardware|\/hardware|\/doos|\/toestellen/, 'hardware', 'RTG Hardwarelab'],
  [/office\/architect|\/architect/, 'architect', 'RTG Architectenbureau'],
  [/office\/werkplaats|\/werkplaats|\/gereedschap/, 'werkplaats', 'RTG Werkplaats'],
  /* De routedekking hoort bij de Ingenieurs ("de motor van het platform gezond,
     snel en meetbaar houden") en staat VOOR de brede /api/office-regel: die zou
     de route bij Intern & IT leggen terwijl het scherm ernaast nergens op
     matchte en op de terugval bleef staan. Dan wijst dezelfde capability naar
     twee kamers, en dat is precies wat deze lijst moet voorkomen. Een regel voor
     alle drie, zodat route en scherm bij elkaar horen.

     Het routedossier en het platformregister staan in DEZELFDE regel en niet in
     een eigen regel ernaast: het is dezelfde routelijst, een laag dieper en een
     laag breder. Losse regels lopen na een hernoeming uit elkaar, en dan hangt
     het ene scherm bij de Ingenieurs en het andere op de terugval. */
  [/routedekking|routedossier|platformregister/, 'ingenieurs', 'Ingenieurs'],
  [/office\/ideeen|\/ideeen/, 'ideeen', 'De Ideeënkamer'],
  [/office\/kantine/, 'kantine', 'Kantine'],
  [/office\/(?:koppel|onboarding|conversations)|\/integratie|\/webhook|\/project-room\.html/, 'integraties', 'Integratiekamer'],
  [/office\/(?:rtgai|journaal)|\/instant-reality|\/test\b|\/spelscherm|\/spelen\.html/, 'controleregister', 'RTG Controleregister'],
  [/office\/(?:kamer|kamers|dienst|stats|inzage|kachat|bureau|concierge|briefing|doc|nudge|reply)|\/kantoorpda|\/rtgkantoor|\/backoffice|\/office\.html|\/kantoor\.html|\/kantoren\.html|\/werkruimte/, 'intern', 'Intern & IT'],
  [/office\/(?:login|state|timeline|export\.csv|web)|\/login|\/logout|\/ready|\/health|\/cluster|\/fout\b/, 'intern', 'Intern & IT'],
  [/office\/(?:mail)|\/rtmail|leverancier-rtmail/, 'integraties', 'Integratiekamer'],
  [/office\/(?:mob)|\/mob\b|\/ride\b|\/transfer\b|\/voertuig|\/dispatch/, 'klantenservice', 'Klantenservice'],
  [/office\/(?:ondernemersregie|trust)|leverancier-aanvragen|\/aanmelding/, 'balie', 'De Ledenbalie'],
  [/office\/(?:school|schools)|\/les\b|\/bijles|\/vak\b|\/bieb|\/rtgschool|\/lesmaker|\/labpas|\/livinglab/, 'onderzoek', 'Onderzoek & data']
];

/* Daarachter de platformlaag (./tabel-platform.js), de ledenlaag
   (./tabel-lid.js), de HDI-laag (./tabel-hdi.js) en dan de brede domeinen
   (./tabel-breed.js). De volgorde is gedrag, dus deze vijf lijsten worden
   geplakt en niet apart doorzocht: smal voor breed, en de brede het laatst. */
module.exports = REGELS.concat(require('./tabel-platform'), require('./tabel-lid'),
  require('./tabel-hdi'), require('./tabel-breed'));
