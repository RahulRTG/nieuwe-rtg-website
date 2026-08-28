/* Verdieping 1 t/m 8 van de enterprise-campus: brand tot impact. */
'use strict';

const { tool, kantoor } = require('./werkplek-kantoren-vorm');

module.exports = code => [
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
