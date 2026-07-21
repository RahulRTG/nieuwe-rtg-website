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
    { code:'FORTIA',  name:'Fortia Club', type:'Fitnessclub', icon:'🏋️', sub:'Sport & fitnessclub · Marina Botafoch' }
  ];

  // Eigen app per sector: dezelfde motor, een eigen ingang, naam en kassa.
  const SECTOR_DEF = {
    restaurant:  { label:'RTG Restaurant',  labelEn:'RTG Restaurant', codes:['KIKUNOI'], icon:'🍽️' },
    bar:         { label:'RTG Bar & Club',  labelEn:'RTG Bar & Club', codes:['PONTO'],   icon:'🍸' },
    hotel:       { label:'RTG Hotel',       labelEn:'RTG Hotel',      codes:['HOSHI'],   icon:'🏨' },
    appartement: { label:'RTG Appartement', labelEn:'RTG Apartment',  codes:['SAKURA'],  icon:'🏡' },
    taxi:        { label:'RTG Taxi',        labelEn:'RTG Taxi',       codes:['MKKX'],    icon:'🚘' },
    privejet:    { label:'RTG Privéjet',    labelEn:'RTG Private Jet', codes:['JETAG'],  icon:'✈️' },
    helikopter:  { label:'RTG Helikopter',  labelEn:'RTG Helicopter',  codes:['IBIZAIR'], icon:'🚁' },
    zzp:         { label:'RTG Zelfstandig', labelEn:'RTG Independent', codes:['AYAKA','KAITO'], icon:'🧑‍🎨' },
    activiteiten:{ label:'RTG Activiteiten', labelEn:'RTG Experiences', codes:['ESVEDRA','MACE'], icon:'🎟️' },
    autoverhuur: { label:'RTG Autoverhuur', labelEn:'RTG Car Rental', codes:['ISLAREN'], icon:'🚗' },
    vastgoed:    { label:'RTG Vastgoed', labelEn:'RTG Real Estate', codes:['IBIZALIV'], icon:'🏡' },
    boerderij:   { label:'RTG Boerderij', labelEn:'RTG Farm', codes:['CANFERRER'], icon:'🚜' },
    creator:     { label:'RTG Creators', labelEn:'RTG Creators', codes:['LUMINA'], icon:'🎬' },
    retail:      { label:'RTG Mode', labelEn:'RTG Fashion', codes:['MAISON'], icon:'🛍️' },
    groothandel: { label:'RTG Groothandel', labelEn:'RTG Wholesale', codes:['MERCABIZA'], icon:'📦' },
    charter:     { label:'RTG Charter', labelEn:'RTG Charter', codes:['AZUL'], icon:'⛵' },
    beveiliging: { label:'RTG Beveiliging', labelEn:'RTG Security', codes:['AEGIS'], icon:'🛡️' },
    beachclub:   { label:'RTG Beachclub', labelEn:'RTG Beach Club', codes:['VORA'], icon:'🏖️' },
    koffie:      { label:'RTG Koffie & Patisserie', labelEn:'RTG Coffee & Patisserie', codes:['BRISA'], icon:'☕' },
    chef:        { label:'RTG Privéchef & Catering', labelEn:'RTG Private Chef & Catering', codes:['FUEGO'], icon:'👨‍🍳' },
    villa:       { label:"RTG Villa's & Fincas", labelEn:'RTG Villas & Fincas', codes:['LUNARA'], icon:'🌴' },
    tweewielers: { label:'RTG Tweewielers & Quads', labelEn:'RTG Two-wheelers & Quads', codes:['MOTOISLA'], icon:'🛵' },
    events:      { label:'RTG Events & Festivals', labelEn:'RTG Events & Festivals', codes:['FESTA'], icon:'🎪' },
    wellness:    { label:'RTG Wellness & Spa', labelEn:'RTG Wellness & Spa', codes:['SERENA'], icon:'🧖' },
    zorg:        { label:'RTG Zorg & Welzijn', labelEn:'RTG Care & Wellness', codes:['ZENITH','CLARA'], icon:'🌿' },
    juwelier:    { label:'RTG Juwelier', labelEn:'RTG Jeweller', codes:['ORODOR'], icon:'💎' },
    galerie:     { label:'RTG Kunst & Galerie', labelEn:'RTG Art & Gallery', codes:['LIENZO'], icon:'🖼️' },
    vracht:      { label:'RTG Vracht', labelEn:'RTG Freight', codes:['TERRAMAR'], icon:'🚢' },
    kantoorgebouw: { label:'RTG Zuidas', labelEn:'RTG Zuidas', codes:['MERIDIAAN'], icon:'🏢' },
    golfclub:    { label:'RTG Golf & Countryclub', labelEn:'RTG Golf & Country Club', codes:['SAROCA'], icon:'⛳' },
    fitnessclub: { label:'RTG Sport & Fitness', labelEn:'RTG Sports & Fitness', codes:['FORTIA'], icon:'🏋️' },
    horeca:  { label:'RTG Horeca',   labelEn:'RTG Hospitality', codes:['KIKUNOI','PONTO'], icon:'🍽️', legacy:true },
    verblijf:{ label:'RTG Verblijf', labelEn:'RTG Stays',       codes:['HOSHI','SAKURA'],  icon:'🏨', legacy:true },
    vervoer: { label:'RTG Vervoer',  labelEn:'RTG Transport',   codes:['MKKX','JETAG','IBIZAIR'], icon:'🚘', legacy:true }
  };
  const SECTOR = (new URLSearchParams(location.search).get('sector') || '').toLowerCase();
  const SDEF = SECTOR_DEF[SECTOR] || null;

  /* De zaak weet zelf bij welke sector-app hij hoort: na het inloggen (of met
     een bewaarde sessie) opent meteen de juiste ingang, net zoals een
     ledenaccount zijn eigen pas-app opent. Demo-partners herkennen we aan hun
     code, alle andere zaken aan hun type. */
  const TYPE2SECTOR = { apartment: 'appartement', jet: 'privejet', activiteit: 'activiteiten', verhuur: 'autoverhuur' };
  function sectorVan(sup){
    if (!sup) return null;
    for (const k of Object.keys(SECTOR_DEF)){
      if (!SECTOR_DEF[k].legacy && SECTOR_DEF[k].codes.includes(sup.code)) return k;
    }
    const t = String(sup.type || '').toLowerCase();
    const k2 = TYPE2SECTOR[t] || t;
    return (SECTOR_DEF[k2] && !SECTOR_DEF[k2].legacy) ? k2 : null;
  }
  function naarEigenSector(sup){
    const doel = sectorVan(sup);
    if (!doel || SECTOR === doel) return false;
    location.replace(location.pathname + '?sector=' + doel);
    return true;
  }

