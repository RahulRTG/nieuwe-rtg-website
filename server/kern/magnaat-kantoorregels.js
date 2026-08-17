/* Expliciete eigenaarsregels voor het RTG Controleregister.

   Een codepunt wordt pas kantoor-groen wanneer een regel het bewust bij een
   bestaande RTG-ruimte legt. De laatste terugval blijft daarom rood: onbekend
   werk hoort niet stilletjes bij Onderzoek te belanden. Volgorde is gedrag;
   specialistische kamers gaan voor brede bedrijfs- en ledendomeinen. */
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
  [/office\/(?:kamer|kamers|dienst|stats|inzage|kachat|bureau|concierge|briefing|doc|nudge|reply)|\/kantoorpda|\/rtgkantoor|\/backoffice|\/private-office|\/office\.html|\/kantoor\.html|\/kantoren\.html|\/werkruimte/, 'intern', 'Intern & IT'],
  [/office\/(?:login|state|timeline|export\.csv|web)|\/login|\/logout|\/ready|\/health|\/cluster|\/fout\b/, 'intern', 'Intern & IT'],
  [/office\/(?:mail)|\/rtmail|leverancier-rtmail/, 'integraties', 'Integratiekamer'],
  [/office\/(?:mob)|\/mob\b|\/ride\b|\/transfer\b|\/voertuig|\/dispatch/, 'klantenservice', 'Klantenservice'],
  [/office\/(?:ondernemersregie|trust)|leverancier-aanvragen|\/aanmelding/, 'balie', 'De Ledenbalie'],
  [/office\/(?:school|schools)|\/les\b|\/bijles|\/vak\b|\/bieb|\/rtgschool|\/lesmaker|\/labpas|\/livinglab/, 'onderzoek', 'Onderzoek & data'],
  [/office\/(?:bewaarverzoek|uitgifte|verifications)|\/onboarding|\/zegel|\/codewoord/, 'juridisch', 'Juridisch'],
  [/office\/(?:aidata)|\/belastingkantoor|\/loonstrook/, 'financien', 'Financiën'],
  [/office\/wereld|\/wereld\b/, 'controleregister', 'RTG Controleregister'],
  [/\/api\/office\b|\/kantoor\/gesprek|\/living-os|\/scherm\.html|\/app\.html/, 'intern', 'Intern & IT'],
  [/\/techniek|\/wacht|\/incident|\/storing/, 'techniek', 'Techniek & De Wacht'],

  /* Geld, handel en groei. */
  [/bank|pay|betaal|factuur|finance|krediet|rekening|wallet|munt|wbw|\/geld|\/pin\b|giftcard|pasprijzen|\/balans|\/facturen/, 'financien', 'Financiën'],
  [/marketing|campagne|analytics|\/merk/, 'marketing', 'Marketing'],
  [/\/pr\/|communicatie|persbericht/, 'pr', 'PR & communicatie'],
  [/\/sales|acquisitie|lead/, 'sales', 'Sales'],
  [/supplier\/(?:inkoop|groothandel|keten|vracht)|\/inkoop|\/groothandel|\/vracht/, 'inkoop', 'Inkoop'],
  [/supplier\/(?:verkoop|retail|order|menu|reserver)|\/verkoop|\/mall|\/retail|\/bestellen|\/kassa|\/handel/, 'verkoop', 'Verkoop'],
  [/\/foodcourt|\/spar\b|\/pakket|\/order|\/reserveer|\/reservering|\/verhuur/, 'verkoop', 'Verkoop'],

  /* Mensen, recht en de eigen organisatie. */
  [/staff|personeel|vacature|sollicit|\/werving|\/cv\b|\/werkvloer|\/training|\/werk\.html/, 'hr', 'HR'],
  [/contract|juridisch|paspoort|machtig|privacy|avg|toestemming|rechtsvorm|\/drm\b/, 'juridisch', 'Juridisch'],
  [/ingenieur|engineering/, 'ingenieurs', 'Ingenieurs'],
  [/\/bedrijf|\/onderneming|\/concern|\/genootschap|\/zakelijk|\/metier/, 'support', 'Support team'],
  [/supplier|partner|\/gast/, 'support', 'Support team'],

  /* Platform, onderzoek en creatie. */
  [/asset|site|auth|webauthn|rtgid|verify|sleutel|passkeys|\/sso|\/account|\/bestanden|\/agenda|\/kantoorpakket|\/werkplek|\/browser|\/code\b|\/scanner|\/veilig\.html|\/rtgcode|\/table\.html|\/state\b|\/klok/, 'intern', 'Intern & IT'],
  [/\/rtgone|\/comm\b|\/gegevens|\/notifications|\/meldingen|\/push|\/stream|\/vertaal|\/translate|\/talen|\/nav\b|\/mail\b/, 'integraties', 'Integratiekamer'],
  [/foundation|rtf|labfonds|\/lab\b|\/onderzoek|\/onderwijs|\/leerstof|\/leren|\/meet\b|\/metrics|\/voorspel|\/projectie|\/sonde|\/sat\b/, 'onderzoek', 'Onderzoek & data'],
  [/podium|theater|clips|flits|creatief|\/mediaos|\/muziek|\/sport|\/avond|\/uitgaan|\/boeken|\/galerij/, 'creatief', 'Creatief'],

  /* Diensten voor leden en bezoekers. */
  [/salon|member|bericht|dm|ontmoet|vonk|care|zorg|reis|ticket|lucht|hotel|ov|rit|charter/, 'klantenservice', 'Klantenservice'],
  [/\/thuis|\/home|\/leven|\/life\b|\/ik\b|\/gemoed|\/gedachten|\/gewoonten|\/doelen|\/notities|\/memo|\/vitaal|\/voeding|\/medicatie|\/medicijnen|\/metingen|\/arrival|\/verblijf|\/booking|\/book\b|\/residentie|\/sociaal|\/samen|\/fluister|\/live\b|\/klets|\/chat\b|\/like\b|\/comment|\/tijdlijn|\/aandacht|\/attenties|\/favoriet|\/dag\b|\/locatie|\/adres|\/annuleer|\/gids\b|\/event\b|\/punten|\/vandaag|\/ice\b|\/rahul|\/ai\b|\/navigatie|\/reizen|\/vertaler/, 'klantenservice', 'Klantenservice'],
  [/\/cellier|\/cercle|\/concierge|\/zaal|\/entourage|\/garderobe|\/ghost|\/hangar|\/lifestyle|\/horloge|\/uitzicht|\/maison|\/mecenaat|\/pulse|\/rendezvous/, 'klantenservice', 'Klantenservice'],
  [/\/klankwerk|\/camera|\/oog\b|\/media\.html/, 'creatief', 'Creatief'],
  [/\/horeca|\/mijnmall|\/review|\/splits/, 'verkoop', 'Verkoop'],
  [/\/zaakweb|\/leverancier\.html/, 'support', 'Support team'],
  [/\/marechaussee|\/meldkamer/, 'paniekkamer', 'De Paniekkamer'],
  [/\/toestel/, 'hardware', 'RTG Hardwarelab'],
  [/\/nalatenschap/, 'juridisch', 'Juridisch'],
  [/\/aanmeld\b/, 'balie', 'De Ledenbalie'],
  [/\/magnaat\.html|\/rtg\.html|\/logboek/, 'controleregister', 'RTG Controleregister']
];

module.exports = function kantoorVan(route) {
  const waarde = String(route || '').toLowerCase();
  for (let i = 0; i < REGELS.length; i += 1) {
    const [patroon, id, naam] = REGELS[i];
    if (patroon.test(waarde)) return { id, naam, toewijzing: 'regel', regel: i + 1 };
  }
  return { id: 'onderzoek', naam: 'Onderzoek & data', toewijzing: 'terugval', regel: null };
};

module.exports.REGELS = REGELS;
