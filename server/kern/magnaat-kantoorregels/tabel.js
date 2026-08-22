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
  [/office\/boardroom|\/boardroom/, 'boardroom', 'De Boardroom'],
  [/member\/magnaat|office\/magnaat|magnaat-kantoor|\/command\b|\/lab2\b/, 'controleregister', 'RTG Controleregister'],
  [/office\/(?:paniek|rampbeeld)|paniekkamer|\/noodkaart|\/veiligheid|\/kmar/, 'paniekkamer', 'De Paniekkamer'],
  [/office\/bank/, 'bank', 'RTG Rekening'],
  [/office\/weefsel|\/stad|\/gemeente|\/overheid|\/huur|\/vastgoed/, 'stad', 'RTG Stad'],
  [/office\/regering|\/rijksloket|\/defensie/, 'regering', 'Het Regeringskantoor'],
  [/office\/opvang/, 'opvang', 'Opvang & migratie'],
  [/office\/balie|\/ledenregister/, 'balie', 'De Ledenbalie'],
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
  [/office\/(?:koppel|onboarding|conversations)|\/integratie|\/webhook/, 'integraties', 'Integratiekamer'],
  [/office\/(?:rtgai|journaal)|\/instant-reality|\/test\b|\/spelscherm|\/spelen\.html/, 'controleregister', 'RTG Controleregister'],
  [/office\/(?:kamer|kamers|dienst|stats|inzage|kachat|bureau|concierge|briefing|doc|nudge|reply)|\/kantoorpda|\/rtgkantoor|\/backoffice|\/office\.html|\/kantoor\.html|\/kantoren\.html|\/werkruimte/, 'intern', 'Intern & IT'],
  [/office\/(?:login|state|timeline|export\.csv|web)|\/login|\/logout|\/ready|\/health|\/cluster|\/fout\b/, 'intern', 'Intern & IT'],
  [/office\/(?:mail)|\/rtmail|leverancier-rtmail/, 'integraties', 'Integratiekamer'],
  [/office\/(?:mob)|\/mob\b|\/ride\b|\/transfer\b|\/voertuig|\/dispatch/, 'klantenservice', 'Klantenservice'],
  [/office\/(?:ondernemersregie|trust)|leverancier-aanvragen|\/aanmelding/, 'balie', 'De Ledenbalie'],
  [/office\/(?:school|schools)|\/les\b|\/bijles|\/vak\b|\/bieb|\/rtgschool|\/lesmaker|\/labpas|\/livinglab/, 'onderzoek', 'Onderzoek & data'],
  /* Het vakbewijs en de persoonseis liggen bij Juridisch, en met opzet in
     dezelfde regel als `verifications`: het is dezelfde handeling, een stap
     verder. Een mens van RTG ziet een stuk (VOG, BIG-registratie,
     legitimatiebewijs) en tekent af dat hij het heeft gezien -- zonder de
     inhoud te beoordelen, want RTG is geen inspectie. Bij HR zou het niet
     kloppen: dit is geen personeelsbeheer maar een controle die juist NIET bij
     de werkgever hoort te liggen. */
  [/office\/(?:bewaarverzoek|uitgifte|verifications|vakbewijs)|\/vakbewijs|\/persoonseis|\/onboarding|\/zegel|\/codewoord/, 'juridisch', 'Juridisch'],
  [/office\/(?:aidata)|\/belastingkantoor|\/loonstrook/, 'financien', 'Financiën'],
  [/office\/wereld|\/wereld\b/, 'controleregister', 'RTG Controleregister'],
  [/\/api\/office\b|\/kantoor\/gesprek|\/living-os|\/scherm\.html|\/app\.html/, 'intern', 'Intern & IT'],
  [/\/techniek|\/wacht|\/incident|\/storing/, 'techniek', 'Techniek & De Wacht'],
  /* RTG Link (LINK.md): de adres- en capabilitylaag. Hij hoort bij Intern & IT,
     bij de familie waar hij thuishoort -- codes, scanners, sleutels, identiteit
     (zie de platformregel verderop met /code, /scanner en /rtgid).

     Hij staat HIER en niet in dat blok, want zijn deuren wonen in drie werelden:
     /api/link (leden), /api/rtf/link (gezin) en /api/supplier/link (de kassa).
     Verderop zouden `rtf` en `supplier` hem eerder afvangen en lag dezelfde laag
     bij drie kantoren. Een laag heeft een eigenaar; waar zijn deuren staan doet
     daar niet aan af.

     Zonder deze regel viel elk Link-punt terug op de restpost, en dat is met
     opzet rood: onbekend werk hoort niet stilletjes bij Onderzoek te belanden.
     De volle toetssuite wees dat aan (test/kantoren.test.js, acht gaten).
     Het patroon liet eerst een schuine streep NA `link` vallen, waardoor
     /api/link zelf erbuiten viel; /api/linkkaart matcht nog steeds niet. */
  [/(?:^|\/)link(?:\/|$)/, 'intern', 'Intern & IT'],
];

/* En de brede domeinen erachteraan: zie ./tabel-breed.js. De volgorde is
   gedrag, dus deze twee lijsten worden geplakt en niet apart doorzocht. */
module.exports = REGELS.concat(require('./tabel-breed'));
