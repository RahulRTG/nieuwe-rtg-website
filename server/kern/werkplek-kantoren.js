/* De enterprise-campus van de werkplek.

   Een kantoor is hier geen tweede app en ook geen verzameling nagebouwde
   functies. Het is de herkenbare ingang voor een afdeling: welke rollen er
   werken, waarvoor de kamer bestaat en welke bestaande RTG-producten het
   vakwerk doen. Daardoor blijft Finance gewoon Geld/Bank/Office gebruiken en
   blijft Technologie gewoon Techniek/Routedekking/Hardwarelab gebruiken.

   De catalogus is per huis. RTG en RTF delen de vorm, maar niet de opdracht,
   de links, de bezetting of de taken. */
'use strict';

const tool = (naam, uitleg, href, glyf) => ({ naam, uitleg, href, glyf });
const kantoor = (id, naam, glyf, doel, functies, tools, verdieping) =>
  ({ id, naam, glyf, doel, functies, tools, verdieping });

const GEMEENSCHAPPELIJK = code => [
  kantoor('directie', code === 'rtg' ? 'Executive Office' : 'Bestuur & Toezicht', 'maison',
    code === 'rtg'
      ? 'Koers, kapitaal, prioriteiten en besluiten voor de hele Rahul Travel Group.'
      : 'Bestuur, toezicht, continuiteit en besluiten voor de hele Foundation.',
    code === 'rtg' ? ['CEO', 'Chief of Staff', 'Executive Assistant', 'Strategy Director']
      : ['Bestuurder', 'Secretaris', 'Toezichthouder', 'Bestuursadviseur'],
    code === 'rtg' ? [
      tool('Boardroom', 'Besluiten en bevoegdheden', '/apps/boardroom.html', 'maison'),
      tool('Command Center', 'Concernbreed overzicht', '/apps/backoffice.html', 'paneel'),
      tool('Directiestukken', 'Memo\'s, bladen en presentaties', '/apps/office.html', 'office')
    ] : [
      tool('Bestuurskamer', 'Bestuur en toezicht', '/apps/foundation/os-bestuur.html', 'maison'),
      tool('Foundation-kantoor', 'Stichtingbreed overzicht', '/apps/foundation/kantoor.html', 'paneel'),
      tool('Directiestukken', 'Memo\'s, bladen en presentaties', '/apps/office.html', 'office')
    ], 16),

  kantoor('finance', 'Finance & Treasury', 'bank',
    code === 'rtg' ? 'Cash, facturen, begroting, payroll en financiele beheersing.'
      : 'Begroting, afdrachten, fondsen, verantwoording en financiele beheersing.',
    ['CFO', 'Controller', 'Treasury Lead', 'Financial Analyst'],
    code === 'rtg' ? [
      tool('Geld', 'Financieel command center', '/apps/geld.html', 'betalen'),
      tool('Bank', 'Rekeningen en treasury', '/apps/bank.html', 'bank'),
      tool('Payroll', 'Loonruns en controles', '/apps/payroll.html', 'loonstrook')
    ] : [
      tool('Foundation Geld', 'Fondsen en afdrachten', '/apps/foundation/geld.html', 'betalen'),
      tool('Budget', 'Begroting en besteding', '/apps/foundation/budget.html', 'grafiek'),
      tool('Office', 'Verantwoording en stukken', '/apps/office.html', 'office')
    ], 15),

  kantoor('business', code === 'rtg' ? 'Business & Growth' : 'Fondsen & Partners', 'grafiek',
    code === 'rtg' ? 'Groei, proposities, marktontwikkeling en concernvorming.'
      : 'Fondsenwerving, institutionele relaties en duurzame partnerschappen.',
    code === 'rtg' ? ['Chief Business Officer', 'Growth Lead', 'Commercial Strategist', 'Venture Builder']
      : ['Fondsenwerver', 'Partnership Lead', 'Programmamanager', 'Subsidieadviseur'],
    code === 'rtg' ? [
      tool('Onderneming', 'Van idee naar bedrijf', '/apps/onderneming.html', 'werk'),
      tool('Concern', 'Meerdere bedrijven onder regie', '/apps/concern.html', 'gebouw'),
      tool('Magnaat', 'Strategie en simulatie', '/apps/magnaat.html', 'grafiek')
    ] : [
      tool('Steun', 'Donaties en ondersteuning', '/apps/foundation/steun.html', 'mecenaat'),
      tool('Partners', 'Partnerprogramma', '/apps/foundation/partner.html', 'entourage'),
      tool('Projecten', 'Programma- en projectportfolio', '/apps/foundation/projecten.html', 'werk')
    ], 14),

  kantoor('operations', code === 'rtg' ? 'Travel Operations' : 'Programma Operations',
    code === 'rtg' ? 'reizen' : 'werk',
    code === 'rtg' ? 'Boekingen, reizen, capaciteit en uitzonderingen van vertrek tot thuiskomst.'
      : 'Programma\'s, clubs, veldwerk en uitvoering van plan tot aantoonbaar resultaat.',
    code === 'rtg' ? ['COO', 'Travel Operations Lead', 'Duty Manager', 'Service Coordinator']
      : ['Operations Lead', 'Programmacoordinator', 'Veldcoordinator', 'Clubregisseur'],
    code === 'rtg' ? [
      tool('Reizen', 'Boekingen en dossiers', '/apps/reizen.html', 'reizen'),
      tool('Reisbureau', 'Aanbod en reisregie', '/apps/reisbureau.html', 'reisboek'),
      tool('Ritten', 'Transfers en uitvoering', '/apps/rit.html', 'auto')
    ] : [
      tool('Projecten', 'Programmaportfolio', '/apps/foundation/projecten.html', 'werk'),
      tool('Clubswerk', 'Uitvoering in de steden', '/apps/foundation/clubswerk.html', 'rtf'),
      tool('Veldwerk', 'Mobiele uitvoering', '/apps/foundation/os-veld.html', 'gps')
    ], 13),

  kantoor('people', 'People & Culture', 'entourage',
    code === 'rtg' ? 'Talent, organisatie, leren, payroll-overdracht en een gezonde werkcultuur.'
      : 'Medewerkers, vrijwilligers, leren, inzetbaarheid en een veilige cultuur.',
    code === 'rtg' ? ['Chief People Officer', 'People Partner', 'Talent Lead', 'Learning Lead']
      : ['People Lead', 'Vrijwilligerscoordinator', 'Talentbegeleider', 'Learning Lead'],
    code === 'rtg' ? [
      tool('Personeel', 'Dienst, team en instroom', '/apps/personeel.html', 'entourage'),
      tool('Payroll', 'Loonrun en controles', '/apps/payroll.html', 'loonstrook'),
      tool('RTG School', 'Leren en vakbekwaamheid', '/apps/rtgschool.html', 'diploma')
    ] : [
      tool('Vrijwilligers', 'Inzet en ondersteuning', '/apps/foundation/os-vrijwilliger.html', 'entourage'),
      tool('Foundation Werk', 'Werk en ontwikkeling', '/apps/foundation/werk.html', 'werk'),
      tool('School', 'Leren en programma\'s', '/apps/foundation/school.html', 'diploma')
    ], 12),

  kantoor('service', code === 'rtg' ? 'Member Experience' : 'Deelnemers & Families', 'vrienden',
    code === 'rtg' ? 'Een excellente ledenreis: vragen, service, behoud en menselijke opvolging.'
      : 'Een veilige, begrijpelijke deelnemersreis voor gezinnen, jongeren en volwassenen.',
    code === 'rtg' ? ['Chief Experience Officer', 'Member Success Lead', 'Service Designer', 'Case Manager']
      : ['Deelnemersregisseur', 'Gezinsbegeleider', 'Case Manager', 'Community Host'],
    code === 'rtg' ? [
      tool('RTMail', 'Team- en ledencommunicatie', '/apps/rtmail.html', 'berichten'),
      tool('Agenda', 'Afspraken en opvolging', '/apps/agenda.html', 'agenda'),
      tool('Bestanden', 'Veilige dossiers', '/apps/bestanden.html', 'slot')
    ] : [
      tool('Deelnemersportaal', 'Persoonlijke programmaomgeving', '/apps/foundation/os-deelnemer.html', 'vrienden'),
      tool('Contact', 'Vragen en opvolging', '/apps/foundation/contact.html', 'berichten'),
      tool('Agenda', 'Afspraken en programma\'s', '/apps/foundation/agenda.html', 'agenda')
    ], 11),

  kantoor('partners', 'Partnerships & Procurement', 'entourage',
    code === 'rtg' ? 'Partnernetwerk, inkoop, contractering en leverancierskwaliteit.'
      : 'Maatschappelijke partners, inkoop, afspraken en ketenkwaliteit.',
    ['Partnership Director', 'Procurement Lead', 'Supplier Manager', 'Contract Manager'],
    code === 'rtg' ? [
      tool('Partner Network', 'Relaties en samenwerking', '/apps/partner-network.html', 'entourage'),
      tool('Aanvragen', 'Nieuwe partneraanvragen', '/apps/leverancier-aanvragen.html', 'werk'),
      tool('Kantoren', 'Operationele partnerregie', '/apps/kantoren.html', 'office')
    ] : [
      tool('Partners', 'Partnerprogramma', '/apps/foundation/partner.html', 'entourage'),
      tool('Markt', 'Aanbod en lokale economie', '/apps/foundation/markt.html', 'store'),
      tool('Office', 'Afspraken en contractstukken', '/apps/office.html', 'office')
    ], 10),

  kantoor('lifestyle', code === 'rtg' ? 'Lifestyle & Private Client' : 'Welzijn & Gezondheid', 'salon',
    code === 'rtg' ? 'Lifestyle, hospitality, private-clientregie en de kwaliteit van het goede leven.'
      : 'Welzijn, gezondheid, rust en ondersteuning rondom het dagelijks leven.',
    code === 'rtg' ? ['Lifestyle Director', 'Private Client Lead', 'Concierge', 'Experience Curator']
      : ['Welzijnsregisseur', 'Gezondheidscoordinator', 'Familiebegeleider', 'Community Host'],
    code === 'rtg' ? [
      tool('Privékantoor', 'Persoonlijke regie', '/apps/lifestyle.html', 'rechterhand'),
      tool('Living OS', 'Verbonden leefomgeving', '/apps/living-os.html', 'maison'),
      tool('Salon', 'Community en lifestyle', '/apps/salon.html', 'salon')
    ] : [
      tool('Gezondheid', 'Welzijn en gezondheid', '/apps/foundation/gezondheid.html', 'zorg'),
      tool('Rust', 'Herstel en dagelijkse rust', '/apps/foundation/rust.html', 'balans'),
      tool('Hulpwijzer', 'De juiste ondersteuning', '/apps/foundation/hulpwijzer.html', 'help')
    ], 9),

  kantoor('brand', 'Brand, Media & Communications', 'megafoon',
    code === 'rtg' ? 'Merk, reputatie, redactie, campagnes en alle publieke uitingen van RTG.'
      : 'Verhalen, publiekscommunicatie, magazine en aantoonbare impact.',
    ['Brand Director', 'Communications Lead', 'Editor in Chief', 'Content Strategist'],
    code === 'rtg' ? [
      tool('Redactie', 'Nieuws en publicaties', '/apps/redactie.html', 'krant'),
      tool('Merken', 'Merkportfolio en identiteit', '/apps/merken.html', 'ster'),
      tool('Website Studio', 'Digitale publicatie', '/apps/websitestudio.html', 'sitemaker')
    ] : [
      tool('Magazine', 'Verhalen en publicaties', '/apps/foundation/magazine.html', 'krant'),
      tool('Mediawijs', 'Veilige mediavaardigheid', '/apps/foundation/mediawijs.html', 'nieuws'),
      tool('Office', 'Redactieplanning en stukken', '/apps/office.html', 'office')
    ], 8),

  kantoor('product', 'Product, Design & Innovation', 'ontwerp',
    code === 'rtg' ? 'Nieuwe producten, fysieke ervaringen, hardware en service-innovatie.'
      : 'Inclusieve programma\'s, hulpmiddelen, ruimtes en sociale innovatie.',
    ['Chief Product Officer', 'Design Director', 'Product Manager', 'Research Lead'],
    [
      tool('Ontwerpbureaus', 'De zes ateliers van dit huis', '#ontwerptak', 'ontwerp'),
      tool('Office', 'Briefings en productspecificaties', '/apps/office.html', 'office'),
      tool('Notities', 'Onderzoek en ideevorming', '/apps/notities.html', 'ontdek')
    ], 7),

  kantoor('technology', 'Technology & AI', 'gear',
    code === 'rtg' ? 'Platform engineering, apparaten, AI, betrouwbaarheid en developer experience.'
      : 'Veilige digitale diensten, informatievoorziening, AI en technische continuiteit.',
    ['CTO', 'Engineering Lead', 'AI Lead', 'Platform Reliability Lead'],
    code === 'rtg' ? [
      tool('Techniek', 'Platformstatus en beheer', '/apps/techniek.html', 'gear'),
      tool('Routedekking', 'Kwaliteit en dekking', '/apps/routedekking.html', 'netwerk'),
      tool('RTG AI', 'AI-regie en onderzoek', '/apps/rtgkantoor.html', 'pulse')
    ] : [
      tool('Beheer', 'Foundation-platformbeheer', '/apps/foundation/beheer.html', 'gear'),
      tool('Routedekking', 'Kwaliteit en dekking', '/apps/routedekking.html', 'netwerk'),
      tool('Hardwarelab', 'Apparaten en hulpmiddelen', '/apps/hardware-pda.html', 'paneel')
    ], 6),

  kantoor('data', 'Data & Intelligence', 'grafiek',
    code === 'rtg' ? 'Eenduidige stuurinformatie, analyse, forecasting en besluitondersteuning.'
      : 'Impactmeting, programmadata, leren en transparante verantwoording.',
    code === 'rtg' ? ['Chief Data Officer', 'BI Lead', 'Data Steward', 'Insights Analyst']
      : ['Impact Lead', 'Data Steward', 'Onderzoeker', 'Monitoring Specialist'],
    code === 'rtg' ? [
      tool('RTG One', 'Concernbreed operationeel beeld', '/apps/rtgone.html', 'paneel'),
      tool('Magnaat', 'Scenario\'s en strategie', '/apps/magnaat.html', 'grafiek'),
      tool('Office', 'Analyses en bestuursinformatie', '/apps/office.html', 'office')
    ] : [
      tool('Projecten', 'Portfolio en voortgang', '/apps/foundation/projecten.html', 'werk'),
      tool('Onderzoek', 'Leren en kennisopbouw', '/apps/foundation/studie.html', 'ontdek'),
      tool('Office', 'Impactrapportages', '/apps/office.html', 'office')
    ], 5),

  kantoor('risk', 'Legal, Risk & Compliance', 'juridisch',
    code === 'rtg' ? 'Juridische kwaliteit, privacy, security, risico en aantoonbare beheersing.'
      : 'Rechten, privacy, veiligheid, governance en zorgvuldige verantwoording.',
    ['General Counsel', 'Risk Lead', 'Privacy Officer', 'Compliance Officer'],
    code === 'rtg' ? [
      tool('Boardroom', 'Bevoegdheden en besluiten', '/apps/boardroom.html', 'juridisch'),
      tool('Techniek', 'Security en continuiteit', '/apps/techniek.html', 'schild'),
      tool('Routedekking', 'Aantoonbare beheersing', '/apps/routedekking.html', 'netwerk')
    ] : [
      tool('Rechten', 'Rechten en bescherming', '/apps/foundation/rechten.html', 'juridisch'),
      tool('Privacy', 'Privacy en gegevenszorg', '/apps/foundation/privacy.html', 'slot'),
      tool('Veilig', 'Veiligheid en signalen', '/apps/foundation/veilig.html', 'schild')
    ], 4),

  kantoor('workplace', 'Workplace & Facilities', 'gebouw',
    code === 'rtg' ? 'Kantoren, werkplekken, faciliteiten, devices en fysieke continuiteit.'
      : 'Clubhuizen, werkplekken, faciliteiten, toegankelijkheid en veilige locaties.',
    ['Workplace Director', 'Facilities Lead', 'Office Manager', 'Asset Manager'],
    code === 'rtg' ? [
      tool('Werkruimte', 'Ruimtes en samenwerking', '/apps/werkruimte.html', 'gebouw'),
      tool('Hardware', 'Apparaten en uitgifte', '/apps/hardware-pda.html', 'paneel'),
      tool('Kantoren', 'Operationele kantoorregie', '/apps/kantoren.html', 'office')
    ] : [
      tool('Club', 'Clubhuis en community', '/apps/foundation/club.html', 'maison'),
      tool('Werk', 'Werkplekken en ontwikkeling', '/apps/foundation/werk.html', 'werk'),
      tool('Beheer', 'Faciliteiten en platform', '/apps/foundation/beheer.html', 'gear')
    ], 3),

  kantoor('academy', 'Learning & Academy', 'diploma',
    code === 'rtg' ? 'Vakbekwaamheid, leiderschap, onboarding en continue professionele groei.'
      : 'Leren, ontwikkelen, talent ontdekken en kennis delen in elke levensfase.',
    ['Academy Director', 'Learning Designer', 'Coach', 'Knowledge Manager'],
    code === 'rtg' ? [
      tool('RTG School', 'Leren en certificeren', '/apps/rtgschool.html', 'diploma'),
      tool('Office', 'Leerpaden en materiaal', '/apps/office.html', 'office'),
      tool('Bestanden', 'Kennisbibliotheek', '/apps/bestanden.html', 'ontdek')
    ] : [
      tool('School', 'Leren en programma\'s', '/apps/foundation/school.html', 'diploma'),
      tool('Campus', 'Studie en ontwikkeling', '/apps/foundation/campus.html', 'gebouw'),
      tool('Bieb', 'Kennis en verhalen', '/apps/foundation/bieb.html', 'ontdek')
    ], 2),

  kantoor('impact', code === 'rtg' ? 'Sustainability & Impact' : 'Impact & Community', 'rtf',
    code === 'rtg' ? 'Duurzame waarde, maatschappelijke bijdrage en de relatie met de Foundation.'
      : 'Maatschappelijke impact, gemeenschappen, clubs en duurzame verandering.',
    code === 'rtg' ? ['Impact Director', 'Sustainability Lead', 'Foundation Liaison', 'Reporting Lead']
      : ['Impact Director', 'Community Lead', 'Program Evaluator', 'Club Coordinator'],
    code === 'rtg' ? [
      tool('Foundation', 'De maatschappelijke wereld', '/apps/foundation/index.html', 'rtf'),
      tool('Office', 'ESG- en impactrapportage', '/apps/office.html', 'office'),
      tool('Partner Network', 'Keten en samenwerking', '/apps/partner-network.html', 'entourage')
    ] : [
      tool('Projecten', 'Portfolio en resultaten', '/apps/foundation/projecten.html', 'werk'),
      tool('Clubswerk', 'Impact in de steden', '/apps/foundation/clubswerk.html', 'rtf'),
      tool('Bestuur', 'Koers en verantwoording', '/apps/foundation/os-bestuur.html', 'maison')
    ], 1)
];

module.exports = function werkplekKantoren(code, mensen, taken) {
  const m = Array.isArray(mensen) ? mensen : [];
  const t = Array.isArray(taken) ? taken : [];
  return GEMEENSCHAPPELIJK(code).map(k => Object.assign({}, k, {
    mensen: m.filter(x => x && (x.afdeling || 'operations') === k.id).length,
    takenOpen: t.filter(x => x && (x.afdeling || 'operations') === k.id && !x.af).length
  }));
};
