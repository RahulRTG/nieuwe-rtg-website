/* Verdieping 9 t/m 16 van de enterprise-campus: directie tot lifestyle. */
'use strict';

const { tool, kantoor } = require('./werkplek-kantoren-vorm');

module.exports = code => [
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
    ], 9)
];
