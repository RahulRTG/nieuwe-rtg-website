/* Beroepen-Bibliotheek, deel "data": de bouwstenen van de twee werelden.
   Per wereld 100 beroepen x 50 app-soorten; met 20 edities x 10 niveaus
   (in index.js) telt elke wereld precies 100 x 50 x 20 x 10 = 1.000.000. */

// wereld 1: technische en agrarische beroepen (100)
const TECHNIEK_BEROEPEN = [
  // bouw & afbouw
  'Timmerman', 'Metselaar', 'Stukadoor', 'Dakdekker', 'Tegelzetter', 'Voeger', 'Betonwerker', 'Steigerbouwer', 'Glaszetter', 'Schilder',
  // installatie & energie
  'Elektricien', 'Loodgieter', 'CV-monteur', 'Zonnepanelenmonteur', 'Warmtepompmonteur', 'Windturbinemonteur', 'Liftmonteur', 'Koeltechnicus', 'Isolatiemonteur', 'Netbeheerder',
  // metaal & machine
  'Lasser', 'Constructiebankwerker', 'Verspaner', 'Machinebouwer', 'Onderhoudsmonteur', 'Hydraulicamonteur', 'Apparatenbouwer', 'Plaatwerker', 'Smid', 'Gereedschapsmaker',
  // voertuigen & mobiliteit
  'Automonteur', 'Vrachtwagenmonteur', 'Fietstechnicus', 'Scootertechnicus', 'Landbouwmechanisatiemonteur', 'Scheepsmonteur', 'Vliegtuigmonteur', 'Autoschadehersteller', 'Autospuiter', 'Bandenmonteur',
  // techniek breed
  'Mechatronicus', 'Robottechnicus', 'Domotica-installateur', 'Servicetechnicus', 'Meet- en regeltechnicus', 'Procesoperator', 'Waterzuiveraar', 'Rioolbeheerder', 'Wegenbouwer', 'Grondwerker',
  'Kraanmachinist', 'Heier', 'Sloper', 'Asfalteerder', 'Stratenmaker', 'Spoorwerker', 'Bruggenbouwer', 'Baggeraar', 'Duiker (onderwaterwerk)', 'Installatie-inspecteur',
  // hout & interieur
  'Meubelmaker', 'Interieurbouwer', 'Parketteur', 'Trappenmaker', 'Scheepsinterieurbouwer', 'Restauratietimmerman', 'Houtdraaier', 'Kastenmaker', 'Kozijnenmaker', 'Modelmaker',
  // agrarisch: dieren
  'Melkveehouder', 'Varkenshouder', 'Pluimveehouder', 'Geitenhouder', 'Schapenhouder', 'Paardenverzorger', 'Bijenhouder', 'Viskweker', 'Dierenartsassistent (landbouw)', 'Hoefsmid',
  // agrarisch: land & teelt
  'Akkerbouwer', 'Vollegrondsteler', 'Glastuinder', 'Fruitteler', 'Bollenkweker', 'Boomkweker', 'Champignonteler', 'Kruidenteler', 'Wijnboer', 'Zaadveredelaar',
  // agrarisch: groen & buiten
  'Hovenier', 'Greenkeeper', 'Boomverzorger', 'Bosbouwer', 'Natuurbeheerder', 'Loonwerker', 'Melkmachinemonteur', 'Agrarisch drone-piloot', 'Visser', 'Composteerder'
];

// de app-soorten van de techniek/agro-wereld (50)
const TECHNIEK_SOORTEN = [
  'Leerpad', 'Praktijkopdrachten', 'Simulator', 'Veiligheidsgids', 'Gereedschapswijzer', 'Materialenkennis', 'Vakrekenen', 'Tekeninglezen', 'Meten & controleren', 'Examentrainer',
  'Storingzoeker', 'Onderhoudsplanner', 'Normen & keuring', 'Werkvoorbereiding', 'Machinekennis', 'Eerste hulp op de werkvloer', 'Werkkleding & bescherming', 'Vakwoordenboek', 'Fotostappenplan', 'Videolessen',
  'Oefentoetsen', 'Meesterproef', 'Klusplanner', 'Kwaliteitscontrole', 'Duurzaam werken', 'Energiekennis', 'Weer & seizoenen', 'Bodemkennis', 'Gewasbescherming', 'Dierverzorging',
  'Voedselveiligheid', 'Oogstplanner', 'Staltechniek', 'Precisielandbouw', 'Vakgeschiedenis', 'Beroepskeuzehulp', 'Stagewijzer', 'Portfoliobouwer', 'Vakwiskunde', 'Natuurkunde op de werkvloer',
  'Techniektekenen', 'Lasoefeningen', 'Elektroschema\'s', 'Motorkennis', 'Grondbewerking', 'Snoeitechniek', 'Zaai- en plantkalender', 'Machinerijbewijs', 'Keuringsvoorbereiding', 'Vakmenstest'
];

// wereld 2: het bedrijfsleven (100)
const ZAKEN_BEROEPEN = [
  // ondernemen & leiding
  'Ondernemer', 'Winkelier', 'Franchisenemer', 'Startup-oprichter', 'Bedrijfsleider', 'Teamleider', 'Projectmanager', 'Operationeel manager', 'Directiesecretaresse', 'Officemanager',
  // verkoop & marketing
  'Verkoper', 'Accountmanager', 'Marketeer', 'Online marketeer', 'Merkstrateeg', 'Marktonderzoeker', 'Communicatieadviseur', 'PR-adviseur', 'Contentmaker (zakelijk)', 'Winkeletaleur',
  // geld & administratie
  'Boekhouder', 'Administrateur', 'Controller', 'Belastingadviseur', 'Salarisadministrateur', 'Debiteurenbeheerder', 'Kredietbeoordelaar', 'Verzekeringsadviseur', 'Hypotheekadviseur', 'Kassamedewerker',
  // mensen & organisatie
  'HR-adviseur', 'Recruiter', 'Opleidingscoordinator', 'Arbeidsbemiddelaar', 'Vertrouwenspersoon (werk)', 'Planner', 'Roostermaker', 'Kwaliteitsmanager', 'Arbo-adviseur', 'Bedrijfsjurist',
  // logistiek & handel
  'Inkoper', 'Logistiek planner', 'Magazijnbeheerder', 'Expediteur', 'Importeur', 'Exporteur', 'Groothandelaar', 'Voorraadbeheerder', 'Transportplanner', 'Douanedeclarant',
  // horeca & toerisme als bedrijf
  'Horeca-ondernemer', 'Restaurantmanager', 'Hotelmanager', 'Cateraar', 'Evenementenorganisator', 'Reisorganisator', 'Campinghouder', 'Barista-ondernemer', 'Foodtruck-ondernemer', 'Zaalverhuurder',
  // diensten & vakmanschap als zaak
  'Kapsalon-eigenaar', 'Schoonheidssalon-eigenaar', 'Sportschoolhouder', 'Rijschoolhouder', 'Fotostudio-eigenaar', 'Webshop-eigenaar', 'Kringloopondernemer', 'Uitgever', 'Drukkerij-eigenaar', 'Wasserette-eigenaar',
  // zakelijke dienstverlening
  'Consultant', 'Boekhoudkantoor-eigenaar', 'Administratiekantoor-eigenaar', 'Makelaar', 'Taxateur', 'Notarisklerk', 'Incassomedewerker', 'Klantenservicemanager', 'Callcentermanager', 'Dataanalist (zakelijk)',
  // digitaal ondernemen
  'E-commercemanager', 'SEO-specialist', 'Advertentiespecialist', 'Socialmediamanager', 'Platformbeheerder', 'App-ondernemer', 'SaaS-ondernemer', 'Affiliatemarketeer', 'Dropshipper', 'Marktplaatsverkoper',
  // groei & samenleving
  'Franchisegever', 'Investeerder', 'Bedrijfsovernameadviseur', 'Subsidieadviseur', 'Duurzaamheidsadviseur', 'Innovatiemanager', 'Exportmanager', 'Familiebedrijfsopvolger', 'Cooperatiebestuurder', 'Sociaal ondernemer'
];

// de app-soorten van de zakenwereld (50)
const ZAKEN_SOORTEN = [
  'Leerpad', 'Businessplan-hulp', 'Praktijkcases', 'Marketinggids', 'Verkooptrainer', 'Onderhandelen', 'Presenteren', 'Netwerkgids', 'Boekhoudoefeningen', 'Belastingbasis',
  'Prijsstrategie', 'Klantenservice', 'Inkoopgids', 'Voorraadleer', 'Exportwijzer', 'Contractenkennis', 'Personeelsgids', 'Sollicitatietrainer', 'Vergadertechniek', 'Timemanagement',
  'Pitchtrainer', 'Marktonderzoek', 'Concurrentieanalyse', 'Webshopbouw', 'Socialmediaplan', 'Advertentieleer', 'Merkenbouw', 'Huisstijlgids', 'Offertehulp', 'Facturatieleer',
  'Cashflowplanner', 'Begrotingshulp', 'Investeringsleer', 'Risicokennis', 'Verzekeringswijzer', 'Juridische basis', 'Privacy & AVG', 'Duurzaam ondernemen', 'Examentrainer', 'Oefentoetsen',
  'Stagewijzer', 'Portfoliobouwer', 'Beroepskeuzehulp', 'Zakelijk schrijven', 'Zakelijk Engels', 'Rekenvaardigheid', 'Excel-oefeningen', 'Ondernemersverhalen', 'Meesterproef', 'Ondernemerstest'
];

module.exports = { TECHNIEK_BEROEPEN, TECHNIEK_SOORTEN, ZAKEN_BEROEPEN, ZAKEN_SOORTEN };
