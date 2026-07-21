(function(){
  const $ = s => document.querySelector(s);
  const T = (k, nl) => (window.RTGi18n ? RTGi18n.t(k, nl) : nl);
  const lang = () => (window.RTGi18n ? RTGi18n.lang : 'nl');
  const eur = n => '€ ' + Number(n).toLocaleString(lang() === 'en' ? 'en-US' : 'nl-NL');
  const STATUS = { 'nieuw':'new', 'in bereiding':'in preparation', 'klaar':'ready', 'geserveerd':'served', 'geweigerd':'declined', 'terugbetaald':'refunded',
    'aangevraagd':'requested', 'onderweg':'on the way', 'aangekomen':'at pickup', 'rijdt':'driving', 'gearriveerd':'completed' };
  const tStatus = s => (lang() === 'en' ? (STATUS[s] || s) : s);
  // dynamische tekst (bon-regels, gerechten) in de moedertaal van de ingelogde medewerker
  const MTX = t => (window.MoederTaal ? MoederTaal.tekst(t) : t);
  const TYPELABEL = { 'Hotel':'Hotel', 'Restaurant':'Restaurant', 'Bar':'Bar', 'Taxi':'Taxi', 'Privéjet':'Private jet', 'Appartement':'Apartment', 'Club':'Club' };
  const tType = s => (lang() === 'en' ? (TYPELABEL[s] || s) : s);
  const ALG = { 'vis':'fish', 'soja':'soy', 'sesam':'sesame', 'gluten':'gluten', 'noten':'nuts', 'schaaldieren':'shellfish', 'ei':'egg', 'melk':'milk', 'pinda':'peanut', 'selderij':'celery', 'mosterd':'mustard' };
  const tAlg = a => (lang() === 'en' ? (ALG[a] || a) : a);

  const DEMO = [
    { code:'KIKUNOI', name:'Sal de Mar',      type:'Restaurant', icon:'🍽️', sub:'Restaurant · Ibiza' },
    { code:'PONTO',   name:'Sunset Ibiza',    type:'Bar',        icon:'🍸', sub:'Bar · Ibiza' },
    { code:'HOSHI',   name:'Aguamarina Ibiza', type:'Hotel',     icon:'🏨', sub:'Hotel · Ibiza' },
    { code:'SAKURA',  name:'Villa Bahia Ibiza', type:'Appartement', icon:'🏡', sub:'Appartement · Ibiza' },
    { code:'MKKX',    name:'Ibiza Executive Cars', type:'Taxi',  icon:'🚘', sub:'Taxi · Ibiza' },
    { code:'JETAG',   name:'Aria Private Aviation', type:'Privéjet', icon:'✈️', sub:'Privéjet · Amsterdam' },
    { code:'IBIZAIR', name:'Ibiza Sky Charter', type:'Helikopter', icon:'🚁', sub:'Helikopter transfers · Ibiza' },
    { code:'AYAKA',   name:'Atelier Marfil', type:'Zelfstandig', icon:'🧑‍🎨', sub:'Sieraden & goudsmid · Ibiza' },
    { code:'KAITO',   name:'Studio Milan', type:'Zelfstandig', icon:'🏋️', sub:'Health & wellness · Ibiza' },
    { code:'ESVEDRA', name:'Es Vedra Cruises', type:'Activiteit', icon:'⛵', sub:'Tours & cruises · Ibiza' },
    { code:'MACE',    name:'MACE Museum Eivissa', type:'Activiteit', icon:'🏛️', sub:'Museum · Ibiza' },
    { code:'ISLAREN', name:'Isla Rent Ibiza', type:'Autoverhuur', icon:'🚗', sub:'Autoverhuur · Ibiza' },
    { code:'IBIZALIV', name:'Ibiza Living Estates', type:'Vastgoed', icon:'🏡', sub:'Makelaar · Ibiza' },
    { code:'MAISON',  name:'Maison Solène', type:'Mode', icon:'🛍️', sub:'Modehuis · Ibiza' },
    { code:'AZUL',    name:'Azul Yacht Charter', type:'Charter', icon:'⛵', sub:'Boten & jachten · Ibiza' },
    { code:'MERCABIZA', name:'Mercabiza', type:'Groothandel', icon:'📦', sub:'Groothandel & versmarkt · Ibiza' },
    { code:'AEGIS',   name:'Aegis Elite Security', type:'Beveiliging', icon:'🛡️', sub:'Beveiliging · Ibiza' },
    { code:'CANFERRER', name:'Finca Can Ferrer', type:'Boerderij', icon:'🚜', sub:'Boerderij · Ibiza' },
    { code:'LUMINA',  name:'Lumina Media', type:'Creator', icon:'🎬', sub:'Content creators · Ibiza' },
    { code:'VORA',    name:'Vora Beach Club', type:'Beachclub', icon:'🏖️', sub:'Beachclub · Cala Nova' },
    { code:'BRISA',   name:'Cafe Brisa', type:'Koffie', icon:'☕', sub:'Koffie & patisserie · Ibiza-stad' },
    { code:'FUEGO',   name:'Chef Fuego', type:'Privéchef', icon:'👨‍🍳', sub:'Privéchef & catering · op locatie' },
    { code:'LUNARA',  name:'Casa Lunara', type:'Villa\'s', icon:'🌴', sub:'Villa\'s & fincas · Es Cubells' },
    { code:'MOTOISLA', name:'Moto Isla', type:'Tweewielers', icon:'🛵', sub:'Scooters, motoren & quads · Ibiza' },
    { code:'FESTA',   name:'Festa Ibiza Events', type:'Events', icon:'🎪', sub:'Events & festivals · Cala Comte' },
    { code:'SERENA',  name:'Serena Spa', type:'Wellness', icon:'🧖', sub:'Wellness & spa · Santa Eularia' },
    { code:'ZENITH',  name:'Zenith Spa & Wellness', type:'Zorg', icon:'🧖', sub:'Dagspa & behandelingen · Talamanca' },
    { code:'CLARA',   name:'Kliniek Clara Ibiza', type:'Zorg', icon:'🩺', sub:'Privékliniek & herstel · Vila' },
    { code:'ORODOR',  name:'Casa d\'Oro', type:'Juwelier', icon:'💎', sub:'Juwelier & horloges · Dalt Vila' },
    { code:'LIENZO',  name:'Galeria Lienzo', type:'Galerie', icon:'🖼️', sub:'Kunst & galerie · Dalt Vila' },
    { code:'TERRAMAR', name:'TerraMar Cargo', type:'Vracht', icon:'🚢', sub:'Internationale vracht · Haven van Ibiza' },
    { code:'MERIDIAAN', name:'Meridiaan Toren', type:'Kantoorgebouw', icon:'🏢', sub:'Kantoorgebouw · Amsterdam Zuidas' },
    { code:'SAROCA',  name:'Club de Golf Sa Roca', type:'Golfclub', icon:'⛳', sub:'Golf & countryclub · Roca Llisa' },
    { code:'FORTIA',  name:'Fortia Club', type:'Fitnessclub', icon:'🏋️', sub:'Sport & fitnessclub · Marina Botafoch' },
    { code:'VELVET',  name:'Velvet & Blade', type:'Beauty-salon', icon:'✂️', sub:'Beauty-salon & barbier · Vara de Rey' },
    { code:'AMICS',   name:'Amics Petcare', type:'Petcare', icon:'🐾', sub:'Pension, uitlaat & trim · Sant Jordi' },
    { code:'NIDO',    name:'Nido Kinderopvang & Nanny', type:'Kinderopvang', icon:'🧸', sub:'Opvang & nanny-service · Santa Gertrudis' },
    { code:'PORTELL', name:'Marina Portell', type:'Marina', icon:'⚓', sub:'Marina & jachthaven · Marina Botafoch' },
    { code:'AURELIA', name:'Aurelia Weddings & Events', type:'Weddings', icon:'💐', sub:'Weddings & privé-events · Sant Antoni' },
    { code:'LEXNOVA', name:'LexNova Advocaten & Notarissen', type:'Professioneel', icon:'⚖️', sub:'Advocaat, notaris, fiscalist · Vara de Rey' },
    { code:'SEGUR',   name:'Segur Advies', type:'Verzekeringen', icon:'🛡️', sub:'Verzekeringsadvies · Ibiza-stad' },
    { code:'VALAURA', name:"Val d'Aurora Resort", type:'Wintersport', icon:'⛷️', sub:"Wintersport & seizoensresort · Val d'Aurora" }
  ];

  // Eigen app per sector: dezelfde motor, een eigen ingang, naam en kassa.
