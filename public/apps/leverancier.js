(function(){
  const $ = s => document.querySelector(s);
  const T = (k, nl) => (window.RTGi18n ? RTGi18n.t(k, nl) : nl);
  const lang = () => (window.RTGi18n ? RTGi18n.lang : 'nl');
  const eur = n => '€ ' + Number(n).toLocaleString(lang() === 'en' ? 'en-US' : 'nl-NL');
  const STATUS = { 'nieuw':'new', 'in bereiding':'in preparation', 'klaar':'ready', 'geserveerd':'served', 'geweigerd':'declined', 'terugbetaald':'refunded',
    'aangevraagd':'requested', 'onderweg':'on the way', 'aangekomen':'at pickup', 'rijdt':'driving', 'gearriveerd':'completed' };
  const tStatus = s => (lang() === 'en' ? (STATUS[s] || s) : s);
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
    { code:'LIENZO',  name:'Galeria Lienzo', type:'Galerie', icon:'🖼️', sub:'Kunst & galerie · Dalt Vila' }
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

  const TABDEF = {
    home:     { label:'Overzicht', svg:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>' },
    orders:   { label:'Orders',    svg:'<path d="M6 2h9l3 3v17H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>', cap:'orders' },
    rides:    { label:'Ritten',    svg:'<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><rect x="3" y="11" width="18" height="6" rx="2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>', cap:'rides' },
    menu:     { label:'Menu',      svg:'<path d="M4 3v18M8 3v6a2 2 0 0 1-4 0M18 3c-2 0-3 2-3 5s1 4 3 4v9"/>', cap:'menu' },
    price:    { label:'Prijs',     svg:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2 0 0 1 5 0c0 2-2.5 1.5-2.5 3.5M12 16v.5"/>', cap:'pricing' },
    kassa:    { label:'Kassa',     svg:'<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M6 9V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"/><path d="M7 13h2M11 13h2M15 13h2M7 16.5h2M11 16.5h2M15 16.5h2"/>' },
    bezorg:   { label:'Bezorgen',  svg:'<circle cx="6.5" cy="17" r="2.5"/><circle cx="17.5" cy="17" r="2.5"/><path d="M6.5 17h6.5l2.2-6.5H19"/><path d="M12.5 6.5H16l1.8 4"/><path d="M4 12h4"/>' },
    tickets:  { label:'Tickets',   svg:'<path d="M4 8a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M12 6v2M12 11v2M12 16v2"/>', cap:'tickets' },
    vastgoed: { label:'Vastgoed',  svg:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>', cap:'vastgoed' },
    boerderij:{ label:'Boerderij', svg:'<path d="M4 10l6-4 6 4"/><path d="M6 10v9h8v-9"/><path d="M14 13h6v6h-6z"/><path d="M9 19v-4h2v4"/>', cap:'boerderij' },
    creator:  { label:'Creator',   svg:'<rect x="3" y="5" width="13" height="14" rx="2"/><path d="M16 9l5-3v12l-5-3"/>', cap:'creator' },
    samenwerking:{ label:'Samenwerken', svg:'<path d="M9 11l2 2 4-4"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/><path d="M7 10v4a3 3 0 0 0 3 3h4"/>' },
    facturen: { label:'Facturen',  svg:'<path d="M6 2h9l3 3v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/>' },
    rtfmarkt: { label:'De Salon · RTF', svg:'<path d="M4 7h16l-1 4a3 3 0 0 1-3 2.4H8A3 3 0 0 1 5 11z"/><path d="M4 7 6 3h12l2 4"/><path d="M6 13v7h12v-7"/>' },
    huur:     { label:'Verhuur',   svg:'<path d="M5 12l1.6-4.6A2 2 0 0 1 8.5 6h7a2 2 0 0 1 1.9 1.4L19 12"/><rect x="3.5" y="12" width="17" height="5.5" rx="1.8"/><circle cx="7.5" cy="17.5" r="1.6"/><circle cx="16.5" cy="17.5" r="1.6"/><path d="M7 9.5h10"/>', cap:'huur' },
    verkoop:  { label:'Verkoop',   svg:'<path d="M5 12l1.6-4.6A2 2 0 0 1 8.5 6h7a2 2 0 0 1 1.9 1.4L19 12"/><rect x="3.5" y="12" width="17" height="5.5" rx="1.8"/><circle cx="7.5" cy="17.5" r="1.6"/><circle cx="16.5" cy="17.5" r="1.6"/><path d="M9.5 9.2l1.6 1.6 3-3"/>', cap:'huur' },
    retail:   { label:'Mode',      svg:'<path d="M8 4l-4 3 1.5 2.5L7 8.5V20h10V8.5l1.5 1L20 7l-4-3-2 1.5a2 2 0 0 1-4 0z"/>', cap:'retail' },
    winkelvloer:{ label:'Winkelvloer', svg:'<path d="M4 7h16l-1 4a3 3 0 0 1-3 2.4H8A3 3 0 0 1 5 11z"/><path d="M4 7 6 3h12l2 4"/><path d="M6 13v7h12v-7"/><path d="M10 20v-4h4v4"/>', cap:'retail' },
    zorgbalie:{ label:'Zorgbalie', svg:'<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"/>', cap:'care' },
    charter:  { label:'Charter',   svg:'<path d="M4 15l8-3 8 3-1.6 4H5.6z"/><path d="M12 12V4l6 4-6 1"/><path d="M3 20c1.2.8 2.4.8 3.6 0 1.2.8 2.4.8 3.6 0 1.2.8 2.4.8 3.6 0 1.2.8 2.4.8 3.6 0"/>', cap:'charter' },
    groothandel:{ label:'Groothandel', svg:'<rect x="3" y="8" width="18" height="12" rx="1.5"/><path d="M3 8l2-4h14l2 4"/><path d="M10 12h4"/>', cap:'groothandel' },
    inkoop:   { label:'Inkoop',    svg:'<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M2 3h3l2.2 12.3a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L21 7H6"/>', cap:'menu' },
    boardroom:{ label:'Boardroom', svg:'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 20h10M12 18v2"/><path d="M7 12l2.5-2.5L12 12l3-3 2 2"/>' },
    beveiliging:{ label:'Commandocentrum', svg:'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9.5 12l1.8 1.8 3.4-3.6"/>', cap:'beveiliging' },
    paspoort: { label:'Identiteit', svg:'<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="10" r="2.4"/><path d="M8 16c0.5-2 2.2-3 4-3s3.5 1 4 3"/>' },
    rooms:    { label:'Kamers',    svg:'<path d="M3 18v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8"/><path d="M3 18h18M3 21v-3M21 21v-3"/><path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/>', cap:'bookings' },
    dorp:     { label:'Afdelingen', svg:'<path d="M3 21h18"/><path d="M5 21V8l4-3 4 3v13"/><path d="M13 21v-9h6v9"/><path d="M8 12h.01M8 15h.01M16 15h.01M16 18h.01"/>' },
    minibar:  { label:'Minibar',   svg:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 12h14"/><path d="M9 7.5v1.5M9 15.5v1.5"/>', cap:'bookings' },
    tafels:   { label:'Tafels',    svg:'<circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>', cap:'menu' },
    klussen:  { label:'Klussen',   svg:'<path d="M14.5 6.5a4 4 0 0 0-5.6 4.9L3 17.3V21h3.7l5.9-5.9a4 4 0 0 0 4.9-5.6l-2.6 2.6-2.4-2.4z"/>', cap:'bookings' },
    beheer:   { label:'Beheer',    svg:'<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>' },
    doors:    { label:'Deuren',    svg:'<rect x="5" y="3" width="14" height="18" rx="1.5"/><circle cx="15" cy="12" r="1.2"/><path d="M5 21h14"/>', cap:'doors' },
    gasten:   { label:'Gasten',    svg:'<circle cx="12" cy="7.5" r="3"/><path d="M5.5 20c.7-3.6 3.2-5.5 6.5-5.5s5.8 1.9 6.5 5.5"/><path d="M12 14.5v2M12 19v.5"/>' },
    location: { label:'Locatie',   svg:'<path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>', cap:'location' },
    gchat:    { label:'Gastchat',  svg:'<path d="M21 12a8 8 0 0 1-8 8H4l2.5-3A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>' },
    ai:       { label:'AI',        svg:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>' },
    meer:     { label:'Meer',      svg:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>' },
    contract: { label:'Contracten', svg:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/><path d="M14.5 18.5l1.5 1.5 3-3"/>' },
    borden:   { label:'Borden',     svg:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 8v8M12.5 8v5M17 8v3"/>' },
    reviews:  { label:'Reviews',    svg:'<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7z"/>' },
    voorraad: { label:'Voorraad',   svg:'<path d="M3 8l9-5 9 5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19z"/><path d="M3 8h18M9 12h6"/>' },
    onboarding: { label:'Onboarding', svg:'<path d="M16 11a4 4 0 1 0-8 0"/><circle cx="12" cy="7" r="3"/><path d="M4 21c0-4 3.5-7 8-7 1.4 0 2.7 0.3 3.8 0.8"/><path d="M15.5 19l1.8 1.8 3.2-3.6"/>' },
    page:     { label:'Pagina',    svg:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M3 17l5-5 4 4 3-3 6 6"/>' },
    team:     { label:'Team',       svg:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.5a3 3 0 0 1 0 5.5M17 14c2.6 0.6 4 2.7 4 6"/>' }
  };

  // API-client uit de gedeelde app-shell (public/shared/appshell.js).
  const API = RTGApp.maakAPI({ foutTekst: 'API-fout' });

  let S = null;          // supplier
  let state = null;      // dashboard state
  let notifs = [];
  let source = null;

  let toastTimer;
  function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),3000); }

  // ---- sollicitatiechat: samen met de kandidaat een afspraak maken ----
  let apChatId = null, apChatTimer = null;
  function escT(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function ensureApChatEl(){
    let ov = document.getElementById('apchat'); if (ov) return ov;
    ov = document.createElement('div'); ov.id='apchat';
    ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:none;align-items:flex-end;justify-content:center;';
    ov.innerHTML='<div style="background:var(--bg,#12100f);border:1px solid var(--line,#2a2622);border-radius:16px 16px 0 0;width:min(100%,34rem);max-height:80vh;display:flex;flex-direction:column;">'+
      '<div style="display:flex;align-items:center;gap:.6rem;padding:.8rem 1rem;border-bottom:1px solid var(--line,#2a2622);"><b id="apchatWie" style="flex:1;"></b><button id="apchatX" style="background:none;border:none;color:var(--soft,#9a938c);font-size:1.2rem;cursor:pointer;">✕</button></div>'+
      '<div id="apchatMsgs" style="flex:1;overflow:auto;padding:1rem;display:flex;flex-direction:column;gap:.4rem;"></div>'+
      '<div style="display:flex;gap:.5rem;padding:.7rem 1rem;border-top:1px solid var(--line,#2a2622);"><input id="apchatIn" placeholder="'+T('ap.chat.ph','Bericht (bijv. Kun je donderdag om 15u?)')+'" style="flex:1;background:var(--card2,#1b1817);border:1px solid var(--line,#2a2622);border-radius:12px;padding:.55rem .8rem;color:var(--txt,#fff);"><button id="apchatSend" class="obtn primary">'+T('ap.chat.send','Stuur')+'</button></div>'+
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('#apchatX').addEventListener('click', closeApChat);
    ov.addEventListener('click', e=>{ if(e.target===ov) closeApChat(); });
    ov.querySelector('#apchatSend').addEventListener('click', sendApChat);
    ov.querySelector('#apchatIn').addEventListener('keydown', e=>{ if(e.key==='Enter') sendApChat(); });
    return ov;
  }
  function apMsgHtml(m){
    const mij = m.van==='werkgever';
    const inner = mij ? escT(m.tekst) : '<span class="xlate">'+escT(m.tekst)+'</span>';
    return '<div style="align-self:'+(mij?'flex-end':'flex-start')+';max-width:80%;padding:.45rem .75rem;border-radius:12px;'+(mij?'background:var(--gold,#C9A24B);color:#1a1710;':'background:var(--card2,#1b1817);border:1px solid var(--line,#2a2622);')+'white-space:pre-wrap;">'+inner+'</div>';
  }
  function apVertaal(root){ if(!root||!window.Vertaal) return; const to=(window.RTGi18n?RTGi18n.lang:'nl'); root.querySelectorAll('.xlate:not([data-vt])').forEach(el=>{ el.setAttribute('data-vt','1'); Vertaal.vul(el, el.textContent, to); }); }
  async function laadApChat(){
    if (!apChatId) return;
    try { const d = await API.call('/supplier/apply/chat', { id: apChatId });
      const box = document.getElementById('apchatMsgs'); if(!box) return;
      box.innerHTML = (d.chat.berichten||[]).map(apMsgHtml).join('') || '<div style="color:var(--soft,#9a938c);text-align:center;margin:auto;font-size:.85rem;">'+T('ap.chat.leeg','Nog geen berichten. Stel een afspraak voor.')+'</div>';
      apVertaal(box); box.scrollTop = box.scrollHeight;
    } catch(e){}
  }
  function openApChat(id, wie){
    apChatId = id; const ov = ensureApChatEl();
    ov.querySelector('#apchatWie').textContent = (wie||T('ap.chat.title','Chat met kandidaat'));
    ov.style.display='flex'; laadApChat();
    clearInterval(apChatTimer); apChatTimer = setInterval(laadApChat, 4000);
  }
  function closeApChat(){ apChatId=null; clearInterval(apChatTimer); const ov=document.getElementById('apchat'); if(ov) ov.style.display='none'; }
  async function sendApChat(){
    const inp = document.getElementById('apchatIn'); const t=(inp.value||'').trim(); if(!t||!apChatId) return; inp.value='';
    try { await API.call('/supplier/apply/chat/send', { id: apChatId, text: t }); laadApChat(); } catch(e){ toast(e.message); }
  }
  function timeAgo(iso){ const s=Math.max(1,Math.round((Date.now()-new Date(iso))/1000)); if(s<60)return T('t.now','zojuist'); const ago=T('t.ago',' geleden'); const m=Math.round(s/60); if(m<60)return m+T('t.min',' min')+ago; const h=Math.round(m/60); if(h<24)return h+T('t.hour',' uur')+ago; return Math.round(h/24)+T('t.days',' dag(en)')+ago; }
  function has(cap){ return S && S.caps && S.caps.includes(cap); }

  // ---- login ----
  function initials(name){ return String(name||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase(); }

  function renderGate(){
    const list = SDEF ? DEMO.filter(d => SDEF.codes.includes(d.code)) : DEMO;
    if (SDEF){
      document.title = SDEF.label + ', RTG Partners';
      const badge = document.querySelector('#gate .badge');
      if (badge) badge.textContent = (lang() === 'en' ? SDEF.labelEn : SDEF.label);
    }
    // het inlogscherm blijft kaal: geen demo-partnerlijst; de demo logt in met
    // de account-gegevens (of via ?sector=). De lijst blijft wel bestaan als
    // element voor eventuele diepe koppelingen, maar wordt niet gevuld.
    const gl = $('#gateList');
    if (gl) gl.innerHTML = '';
    document.querySelectorAll('[data-code]').forEach(b => b.addEventListener('click', () => pickPartner(b.dataset.code)));
    const lf = document.getElementById('loginForm');
    if (lf) lf.addEventListener('submit', e => {
      e.preventDefault();
      login({ username: document.getElementById('liUser').value, password: document.getElementById('liPass').value }, true);
    });
    const tog = document.getElementById('enrollToggle'), ef = document.getElementById('enrollForm');
    if (tog && ef) tog.addEventListener('click', () => {
      const open = ef.hasAttribute('hidden');
      if (open) { ef.removeAttribute('hidden'); tog.setAttribute('aria-expanded', 'true'); document.getElementById('enBedrijf').focus(); }
      else { ef.setAttribute('hidden', ''); tog.setAttribute('aria-expanded', 'false'); }
    });
    if (ef) ef.addEventListener('submit', enroll);
    gateTik();
  }
  // De klok en de datum op het inlogscherm komen van de ene RTG-klok
  // (/shared/klok.js): overal dezelfde cijfers, met seconden en milliseconden.
  function gateTik(){ if (window.RTGKlok) RTGKlok.alles(); }

  // Uitgenodigd door de werkgever: aanmelden met bedrijfsnaam + kassacode + eigen
  // RTG-inlog. Alleen echte RTG/Lifestyle/Business-leden komen erin.
  async function enroll(e){
    e.preventDefault();
    if (!API.enabled){ toast(T('sup.needserver','Start de server (npm start) om de leverancier-app te gebruiken.')); return; }
    const msg = document.getElementById('enrollMsg');
    const bedrijf = document.getElementById('enBedrijf').value.trim();
    const kassacode = document.getElementById('enCode').value.trim();
    const login2 = document.getElementById('enLogin').value.trim();
    const password = document.getElementById('enPass').value;
    const pin = document.getElementById('enPin').value.trim();
    msg.className = 'enroll-msg';
    msg.textContent = T('enr.busy','Bezig met aanmelden...');
    try {
      const r = await API.call('/supplier/staff/join', { bedrijf, kassacode, login: login2, password, pin });
      msg.className = 'enroll-msg ok';
      msg.textContent = T('enr.ok','Gelukt! U bent aangemeld. U wordt ingelogd...');
      await login({ code: r.code, staffId: r.staffId, pin }, false, true);
    } catch (err) {
      msg.className = 'enroll-msg err';
      msg.textContent = err.message || T('enr.fail','Aanmelden mislukt. Controleer de gegevens.');
    }
  }

  // Functies per genre: zo kiest personeel direct de eigen rol,
  // en solliciteert een kandidaat overal op dezelfde manier.
  const TYPEOF = { KIKUNOI:'restaurant', PONTO:'bar', HOSHI:'hotel', SAKURA:'apartment', MKKX:'taxi', JETAG:'jet', IBIZAIR:'helikopter', AYAKA:'zzp', KAITO:'zzp', ESVEDRA:'activiteit', MACE:'activiteit', ISLAREN:'verhuur', IBIZALIV:'vastgoed', MAISON:'retail', AZUL:'charter' };
  const FUNCS = {
    restaurant: ['Bediening','Keuken','Gastheer/gastvrouw','Afwas'],
    bar:        ['Bediening','Bar','Keuken','Security'],
    club:       ['Bediening','Bar','Security'],
    hotel:      ['Receptie','Housekeeping','Roomservice','Onderhoud','Security'],
    apartment:  ['Beheer','Housekeeping','Onderhoud'],
    taxi:       ['Taxi centrale','Chauffeur'],
    jet:        ['Operations','Crew','Piloot'],
    helikopter: ['Operations','Piloot','Crew','Grondpersoneel'],
    activiteit: ['Gids','Security','Ticketbalie'],
    verhuur:    ['Balie','Monteur','Schoonmaak'],
    vastgoed:   ['Makelaar','Bezichtigingen','Backoffice']
  };
  let pickCode = null, gateRoster = null, pendingStation = null;
  const spH2 = () => document.querySelector('#staffPick h2');
  const spDeck = () => document.querySelector('#staffPick .sp-deck');

  async function pickPartner(code){
    if (!API.enabled){ toast(T('sup.needserver','Start de server (npm start) om de leverancier-app te gebruiken.')); return; }
    pickCode = code;
    gateRoster = { supplier:{ name: code }, staff: [] };
    try { gateRoster = await API.call('/supplier/roster', { code }); } catch(e){}
    $('#spBiz').textContent = gateRoster.supplier.name;
    $('#spPin').classList.remove('open');
    renderRoles();
    $('#staffPick').classList.add('open');
  }
  // Stap 1: de rol
  function renderRoles(){
    spH2().textContent = T('sp.roleq','Wie bent u?');
    spDeck().textContent = T('sp.roledeck','Kies uw rol; u logt in met uw eigen pincode.');
    $('#spBack2') && $('#spBack2').remove();
    $('#spList').innerHTML = [
      ['personeel','👥',T('sp.r.staff','Personeel'),T('sp.r.staff.s','Bediening, keuken, receptie, chauffeurs...')],
      ['management','⭐',T('sp.r.mgmt','Management'),T('sp.r.mgmt.s','Managers en chefs, volledige toegang met eigen pincode')],
      ['sollicit','📝',T('sp.r.apply','Solliciteren'),T('sp.r.apply.s','Werken bij ' + gateRoster.supplier.name + '? Solliciteer direct.')]
    ].map(r =>
      '<button class="sp-person" data-rol="'+r[0]+'"><span class="av">'+r[1]+'</span><span><b>'+r[2]+'</b><span>'+r[3]+'</span></span></button>'
    ).join('');
    // Vaste werkplekken. Horeca krijgt keuken, bar, bediening en events;
    // elk bedrijf krijgt een Kantoor waar het management alles regelt.
    // Een werkplek open je met je eigen naam en PIN.
    const gtype = (gateRoster.supplier && gateRoster.supplier.type) || TYPEOF[pickCode] || '';
    const horeca = ['restaurant','bar','club'].includes(gtype);
    const st = [];
    if (horeca){
      st.push(
        ['keuken','\uD83D\uDD25',T('st.keuken','Keuken-scherm'),T('st.keuken.s','Bontickets, bump-knoppen, allergieen groot in beeld')],
        ['bar','\uD83C\uDF78',T('st.bar','Bar-scherm'),T('st.bar.s','Drankjes klaarmelden, ophaalcodes groot in beeld')],
        ['bediening','\uD83E\uDDFE',T('st.bediening','Bedieningspost'),T('st.bediening.s','Uitserveren, tafels en de PDA op een plek')],
        ['events','\uD83C\uDF9F',T('st.events','Events-scherm'),T('st.events.s','Gastenlijst en check-in aan de deur')]
      );
    }
    if (gtype === 'zzp'){
      st.push(['agenda','\uD83D\uDDD3\uFE0F',T('st.agenda','Agenda'),T('st.agenda.s','Uw boekingen: bevestigen, leveren en afronden')]);
    }
    if (['taxi','jet'].includes(gtype)){
      st.push(['chauffeur', gtype==='jet' ? '\u2708\uFE0F' : '\uD83D\uDE98',
        gtype==='jet' ? T('st.crew','Crew-post') : T('st.chauffeur','Chauffeurspost'),
        T('st.chauffeur.s','Uw ritten, route en verdiensten; grote knoppen per ritfase')]);
    }
    st.push(['kantoor','\uD83D\uDDDD',T('st.kantoor','Kantoor'),
      horeca ? T('st.kantoor.s','Alles aanpassen: HR, keuken, bar, bediening en events (alleen management)')
             : T('st.kantoor.s2','Alles aanpassen: HR, marketing en het aanbod (alleen management)')]);
    $('#spList').innerHTML += '<div style="margin:0.9rem 0 0.4rem;font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--soft);">'+T('st.h','Werkplekken')+'</div>' +
      st.map(r => '<button class="sp-person" data-station="'+r[0]+'"><span class="av">'+r[1]+'</span><span><b>'+r[2]+'</b><span>'+r[3]+'</span></span></button>').join('');
    $('#spList').querySelectorAll('[data-station]').forEach(b => b.addEventListener('click', () => {
      pendingStation = b.dataset.station;
      renderStationPersons();
    }));
    $('#spList').querySelectorAll('[data-rol]').forEach(b => b.addEventListener('click', () => {
      const r = b.dataset.rol;
      pendingStation = null;
      if (r === 'management') renderPersons(null, true);
      else if (r === 'personeel') renderFuncs();
      else renderApply();
    }));
  }

  // Werkplek openen: iedereen van het team mag dat, op eigen naam en PIN.
  function renderStationPersons(){
    let all = gateRoster.staff || [];
    if (pendingStation === 'kantoor') all = all.filter(m => m.role === 'manager');
    const naam = stationLabel(pendingStation);
    spH2().textContent = naam;
    spDeck().textContent = pendingStation === 'kantoor'
      ? T('st.pickmgr','Het Kantoor is voor eigenaren en managers. Kies uw naam en voer uw pincode in.')
      : T('st.pickname','Wie opent deze werkplek? Kies uw naam en voer uw pincode in.');
    $('#spList').innerHTML = (all.map(m =>
      '<button class="sp-person" data-sid="'+m.id+'" data-name="'+m.name.replace(/"/g,'&quot;')+'" data-role="'+m.role+'">'+
        '<span class="av">'+initials(m.name)+'</span><span><b>'+m.name+'</b><span>'+(m.func||T('role.'+m.role, m.role==='manager'?'Manager':'Medewerker'))+'</span></span></button>'
    ).join('') || '<div class="empty" style="padding:1.2rem 0;">'+T('sp.nostaff','Nog geen persoonlijke accounts. Log in als Beheer en voeg je team toe.')+'</div>') + backBtn();
    $('#spList').querySelectorAll('.sp-person[data-sid]').forEach(b => b.addEventListener('click', () => openPin(b.dataset.sid, b.dataset.name, b.dataset.role)));
    bindBack(() => { pendingStation = null; renderRoles(); });
  }
  // Stap 2a: personeel kiest de functie
  function renderFuncs(){
    const type = TYPEOF[pickCode] || 'restaurant';
    spH2().textContent = T('sp.funcq','Wat is uw functie?');
    spDeck().textContent = T('sp.funcdeck','Kies uw functie, daarna uw naam en pincode.');
    $('#spList').innerHTML = (FUNCS[type]||[]).map(f =>
      '<button class="sp-person" data-func="'+f.replace(/"/g,'&quot;')+'"><span class="av">'+f[0]+'</span><span><b>'+f+'</b></span></button>'
    ).join('') + backBtn();
    $('#spList').querySelectorAll('[data-func]').forEach(b => b.addEventListener('click', () => renderPersons(b.dataset.func, false)));
    bindBack(renderRoles);
  }
  // Stap 2b/3: personen (van een functie, of het management)
  function renderPersons(func, mgmt){
    const all = gateRoster.staff || [];
    let list = mgmt ? all.filter(m => m.role === 'manager')
      : all.filter(m => (m.func||'').toLowerCase() === String(func).toLowerCase());
    const fallback = !mgmt && !list.length;
    if (fallback) list = all;
    spH2().textContent = mgmt ? T('sp.r.mgmt','Management') : func;
    spDeck().textContent = fallback ? T('sp.nofunc','Nog niemand met deze functie; kies uw naam uit het team.') : T('sp.pickname','Kies uw naam en voer uw pincode in.');
    $('#spList').innerHTML = (list.map(m =>
      '<button class="sp-person" data-sid="'+m.id+'" data-name="'+m.name.replace(/"/g,'&quot;')+'" data-role="'+m.role+'">'+
        '<span class="av">'+initials(m.name)+'</span><span><b>'+m.name+'</b><span>'+(m.func||T('role.'+m.role, m.role==='manager'?'Manager':'Medewerker'))+'</span></span></button>'
    ).join('') || '<div class="empty" style="padding:1.2rem 0;">'+T('sp.nostaff','Nog geen persoonlijke accounts. Log in als Beheer en voeg je team toe.')+'</div>') + backBtn();
    $('#spList').querySelectorAll('.sp-person[data-sid]').forEach(b => b.addEventListener('click', () => openPin(b.dataset.sid, b.dataset.name, b.dataset.role)));
    bindBack(mgmt ? renderRoles : renderFuncs);
  }
  // Solliciteren: bij elk bedrijf hetzelfde formulier
  function renderApply(){
    const type = TYPEOF[pickCode] || 'restaurant';
    spH2().textContent = T('sp.applyh','Solliciteren');
    spDeck().textContent = T('sp.applydeck','Bij elke RTG-partner solliciteert u op dezelfde manier. Het bedrijf ziet uw sollicitatie direct in de app.');
    $('#spList').innerHTML =
      '<div class="field" style="margin-top:0.4rem;"><label>'+T('sp.a.name','Uw naam')+'</label><input id="apName"></div>'+
      '<div class="field"><label>'+T('sp.a.func','Functie')+'</label><select id="apFunc" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.8rem 1rem;font-size:0.9rem;color:var(--txt);outline:none;">'+
        (FUNCS[type]||[]).map(f=>'<option>'+f+'</option>').join('')+'</select></div>'+
      '<div class="field"><label>'+T('sp.a.contact','Telefoon of e-mail')+'</label><input id="apContact"></div>'+
      '<div class="field"><label>'+T('sp.a.note','Korte motivatie (optioneel)')+'</label><textarea id="apNote" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.8rem 1rem;font-size:0.9rem;color:var(--txt);outline:none;min-height:70px;resize:vertical;"></textarea></div>'+
      '<button class="bigbtn" id="apSend">'+T('sp.a.send','Verstuur sollicitatie')+'</button>' + backBtn();
    bindBack(renderRoles);
    $('#apSend').addEventListener('click', async () => {
      const name = $('#apName').value.trim(), contact = $('#apContact').value.trim();
      if (!name || !contact){ toast(T('sp.a.fill','Vul uw naam en telefoonnummer of e-mailadres in.')); return; }
      try {
        await API.call('/supplier/apply', { code: pickCode, name, func: $('#apFunc').value, contact, note: $('#apNote').value.trim() });
        toast(T('sp.a.sent','Verstuurd. ') + gateRoster.supplier.name + ' ' + T('sp.a.sent2','neemt contact met u op.'));
        renderRoles();
      } catch(e){ toast(e.message); }
    });
  }
  function backBtn(){ return '<button class="sp-biz-btn" id="spBack2" style="margin-top:0.9rem;">← '+T('sp.back','Terug')+'</button>'; }
  function bindBack(fn){ const b = $('#spBack2'); if (b) b.addEventListener('click', fn); }

  $('#spBack').addEventListener('click', () => $('#staffPick').classList.remove('open'));

  // Stap 2: persoon gekozen → pincode invoeren.
  let pinFor = null, pinBuf = '';
  function renderDots(){
    document.querySelectorAll('#spDots i').forEach((el,i)=> el.classList.toggle('on', i < pinBuf.length));
  }
  function openPin(sid, name, role){
    pinFor = Number(sid); pinBuf = '';
    $('#spPinName').textContent = name;
    $('#spPinRole').textContent = T('role.'+role, role==='manager'?'Manager':'Medewerker');
    $('#spDots').classList.remove('bad'); renderDots();
    $('#spPin').classList.add('open');
  }
  function buildPad(){
    const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
    $('#spPad').innerHTML = keys.map(k => k==='' ? '<span></span>' :
      '<button class="sp-key'+(k==='⌫'?' wide':'')+'" data-k="'+k+'">'+k+'</button>').join('');
    document.querySelectorAll('#spPad [data-k]').forEach(b => b.addEventListener('click', () => pinKey(b.dataset.k)));
  }
  async function pinKey(k){
    $('#spDots').classList.remove('bad');
    if (k==='⌫'){ pinBuf = pinBuf.slice(0,-1); renderDots(); return; }
    if (pinBuf.length >= 4) return;
    pinBuf += k; renderDots();
    if (pinBuf.length === 4){
      const pin = pinBuf;
      const ok = await login({ code: pickCode, staffId: pinFor, pin }, false, true);
      if (!ok){ $('#spDots').classList.add('bad'); pinBuf=''; setTimeout(renderDots, 400); }
    }
  }
  $('#spPinCancel').addEventListener('click', () => { $('#spPin').classList.remove('open'); pinBuf=''; });

  // Gemeenschappelijke login. Geeft true/false terug bij PIN, zodat de pad kan reageren.
  async function login(body, isCred, silent){
    if (!API.enabled){ toast(T('sup.needserver','Start de server (npm start) om de leverancier-app te gebruiken.')); return false; }
    try {
      const d = await API.call('/supplier/login', body);
      API.token = d.token;
      applyState(d.state);
      koppelAanRtgAccount(body, isCred); // een account voor alles: stil koppelen
    } catch(e){
      if (silent) return false;
      toast(isCred ? T('login.bad','Onjuiste gebruikersnaam of wachtwoord.') : (e.message||T('login.failed','Inloggen mislukt.')));
      return false;
    }
    try { localStorage.setItem('rtg_sup_token', API.token); } catch(e){}
    // de zaak opent zijn eigen sector-app (behalve midden in een kassa-station)
    if (!pendingStation && naarEigenSector(S)) return true;
    if (pendingStation){
      try { localStorage.setItem('rtg_sup_station', pendingStation); } catch(e){}
      enterStation(pendingStation);
    } else {
      try { localStorage.removeItem('rtg_sup_station'); } catch(e){}
      enterApp();
    }
    return true;
  }

  function enterApp(){
    $('#staffPick').classList.remove('open');
    $('#spPin').classList.remove('open');
    $('#gate').style.display = 'none';
    $('#app').classList.add('active');
    buildTabs();
    renderAll();
    startStream();
    loadNotifs();
  }

  // Blijf ingelogd: met een bewaard token direct de app in, zonder PIN.
  async function restoreSession(){
    if (!API.enabled) return;
    let t = null; try { t = localStorage.getItem('rtg_sup_token'); } catch(e){}
    if (!t) return;
    API.token = t;
    try {
      const st = (await API.call('/supplier/state')).state;
      // de bewaarde sessie weet bij welke sector hij hoort: verkeerde (of
      // ontbrekende) ingang stuurt meteen door naar de eigen sector-app
      if (st.supplier && naarEigenSector(st.supplier)) return;
      // vangnet voor zaken zonder eigen sector-ingang
      if (SDEF && st.supplier && !SDEF.codes.includes(st.supplier.code)){ API.token = null; return; }
      applyState(st);
      let stn = null; try { stn = localStorage.getItem('rtg_sup_station'); } catch(e2){}
      if (stn) enterStation(stn); else enterApp();
    } catch(e){
      API.token = null;
      try { localStorage.removeItem('rtg_sup_token'); } catch(e2){}
    }
  }

  // Wissel van gebruiker: sessie loslaten, terug naar het inlogscherm.
  function switchUser(){
    if (source){ try{ source.close(); }catch(_){} source = null; }
    stationMode = null; pendingStation = null;
    $('#station').classList.remove('on');
    API.token = null; state = null; S = null; notifs = [];
    try { localStorage.removeItem('rtg_sup_token'); localStorage.removeItem('rtg_sup_station'); } catch(e){}
    $('#app').classList.remove('active');
    $('#gate').style.display = '';
    if (pickCode) pickPartner(pickCode); else $('#staffPick').classList.remove('open');
  }

  function applyState(st){ state = st; S = st.supplier; }

  /* ---- Een account voor alles ----
     Wie hier net zijn werk-inlog bewees EN een RTG-leden-account op dit
     toestel heeft, wordt stil gekoppeld: voortaan is dat ene account genoeg.
     En op het inlogscherm: staat er al een koppeling, dan verschijnt een
     "verder met uw RTG-account"-keuze die de werk-sessie direct start. */
  function lidToken(){ try { return localStorage.getItem('rtg_member_token'); } catch(e){ return null; } }
  const accApi = (pad, body) => fetch('/api/account/' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lidToken() },
    body: JSON.stringify(body || {}) }).then(r => r.json().then(j => ({ ok: r.ok, j })));
  async function koppelAanRtgAccount(body, isCred){
    if (!lidToken()) return;
    try {
      const soort = body.staffId != null ? 'personeel' : (isCred ? 'zaak' : null);
      if (!soort) return;
      const r = await accApi('koppel', soort === 'personeel'
        ? { soort, code: body.code, staffId: body.staffId, pin: body.pin }
        : { soort, username: body.username, password: body.password });
      if (r.ok) toast(T('acc.gekoppeld', 'Gekoppeld aan uw RTG-account: voortaan is een inlog genoeg.'));
    } catch(e){}
  }
  async function rtgAccountKeuze(){
    const gate = $('#gate');
    if (!gate || !API.enabled || !lidToken()) return;
    try {
      const r = await accApi('rollen');
      const rollen = (r.ok && r.j.rollen || []).filter(x => x.rol === 'zaak' || x.rol === 'personeel');
      if (!rollen.length) return;
      const doos = document.createElement('div');
      doos.className = 'login-form';
      doos.setAttribute('aria-label', 'Verder met uw RTG-account');
      doos.innerHTML = rollen.map((x, i) =>
        '<button type="button" data-acc-start="' + i + '">👤 ' + (x.naam || 'Beheer') + ' · ' + (x.zaakNaam || x.code) +
        ' <small>' + T('acc.een', 'met uw RTG-account') + '</small></button>').join('');
      gate.querySelector('.login-form').after(doos);
      doos.querySelectorAll('[data-acc-start]').forEach(b => b.addEventListener('click', async () => {
        const x = rollen[Number(b.dataset.accStart)];
        const s = await accApi('start', { rol: x.rol, code: x.code, staffId: x.staffId });
        if (!s.ok) return toast(s.j.error || T('login.failed', 'Inloggen mislukt.'));
        API.token = s.j.token;
        try { localStorage.setItem('rtg_sup_token', API.token); } catch(e){}
        applyState(s.j.state);
        if (naarEigenSector(S)) return;
        enterApp();
      }));
    } catch(e){}
  }
  setTimeout(rtgAccountKeuze, 800);


  /* De Zaakdoos: draait dit scherm op het kastje in de zaak, zeg dan eerlijk
     wanneer de lijn weg is. Alles blijft gewoon werken; het journaal
     synchroniseert vanzelf zodra de lijn terug is. */
  (function () {
    let doosTimer = null, doosBanner = false;
    async function doosCheck() {
      try {
        const d = await (await fetch('/api/doos/status')).json();
        if (!d.doos) return; // gewone cloudserver: niets te bewaken
        if (!doosTimer) doosTimer = setInterval(doosCheck, 10000);
        if (d.modus === 'lokaal' && window.RTGNet) {
          doosBanner = true;
          RTGNet.toon('📦 ' + T('doos.lokaal', 'Zaakdoos: de lijn is weg; de zaak draait lokaal door en synchroniseert vanzelf.') + (d.journaal ? ' (' + d.journaal + ' actie(s) in het journaal)' : ''));
        } else if (doosBanner && window.RTGNet) { doosBanner = false; RTGNet.verberg(); }
      } catch (e) {}
    }
    setTimeout(doosCheck, 2500);
  })();
  /* ================= werkplekken: keuken, bar, bediening =================
     Elk gerecht op de kaart hoort bij een station (keuken of bar). Een
     bestelling verschijnt als ticket op elk station dat iets moet maken;
     pas als alle stations klaar zijn, is de bestelling klaar en ziet de
     bedieningspost hem bij "Uit te serveren". */
  let stationMode = null, stClockTimer = null;
  // een scherm per keukensectie: hetzelfde keukenscherm, zes kanten
  const KSECTIES = {
    chef:    ['\uD83D\uDC68\u200D\uD83C\uDF73', 'Chef'],
    warm:    ['\uD83D\uDD25', 'Warme kant'],
    koud:    ['\u2744\uFE0F', 'Koude kant'],
    snack:   ['\uD83C\uDF5F', 'Snacks'],
    dessert: ['\uD83C\uDF70', 'Desserts'],
    pas:     ['\uD83C\uDF7D\uFE0F', 'De pas']
  };
  let keukenSectie = (() => { try { return localStorage.getItem('rtg_sup_ksectie') || 'chef'; } catch(e){ return 'chef'; } })();
  function sectieOf(it){
    const m = (state && state.menu || []).find(x => x.id === it.id);
    return (m && m.station !== 'bar') ? (m.sectie || 'warm') : null;
  }
  function sectiesVanOrder(o){
    const set = new Set();
    (o.items||[]).forEach(it => { const s2 = sectieOf(it); if (s2) set.add(s2); });
    return [...set];
  }

  function stationOf(it){
    const m = (state && state.menu || []).find(x => x.id === it.id);
    return m && m.station === 'bar' ? 'bar' : 'keuken';
  }

  /* ---- het vuurplan: zelfde rekenregels als de servercoach ----
     Nominale tijd per kant (prepMin op het gerecht wint); klaar telt 0,
     bezig de halve tijd, niet gestart de volle tijd. De langzaamste kant
     bepaalt het doel; de rest start precies zo laat dat alles tegelijk
     warm op de pas ligt. */
  const KTIJD = { warm: 12, koud: 6, snack: 8, dessert: 5 };
  function sectieDuur(o, sec){
    let t = KTIJD[sec] || 8;
    (o.items||[]).forEach(it => {
      const m = (state && state.menu || []).find(x => x.id === it.id);
      if (m && m.station !== 'bar' && (m.sectie||'warm') === sec && m.prepMin) t = Math.max(t, m.prepMin);
    });
    return t;
  }
  function vuurplan(o){
    const nodig = sectiesVanOrder(o);
    const fase = o.secties || {};
    const faseVan = k => k === 'bar' ? (o.stations||{}).bar : fase[k];
    const rest = {};
    nodig.forEach(sec => { const t = sectieDuur(o, sec); rest[sec] = fase[sec]==='klaar' ? 0 : fase[sec]==='bezig' ? Math.ceil(t/2) : t; });
    // de bar telt als eigen kant mee: drankjes gaan met de rest van de bon samen uit
    if ((o.items||[]).some(it => stationOf(it) === 'bar')){
      const bf = (o.stations||{}).bar;
      rest.bar = bf === 'klaar' ? 0 : bf === 'bezig' ? 2 : 4;
    }
    const alle = Object.keys(rest);
    let doel = alle.length ? Math.max.apply(null, alle.map(k => rest[k])) : 0;
    // de deurhost-koppeling: deelt de gast zijn reis (GPS), dan mikt het
    // vuurplan op de aankomst, zodat alles warm klaarstaat als de gast zit
    // (behalve bij spoed: dan telt alleen de kooktijd)
    if (!o.spoed && !o.guestArrived && Number.isFinite(o.guestEtaMin) && o.guestEtaMin > doel) doel = o.guestEtaMin;
    const plan = {};
    alle.forEach(k => {
      const f = faseVan(k);
      if (f==='klaar') plan[k] = doel > 0 ? { doe:'warm', min:doel } : { doe:'pas', min:0 };
      else if (f==='bezig') plan[k] = { doe:'bezig', min:rest[k] };
      else { const w = doel - rest[k]; plan[k] = w >= 2 ? { doe:'wacht', min:w } : { doe:'nu', min:0 }; }
    });
    // spoed van de bediening: niets houdt nog in, alles start nu
    if (o.spoed) alle.forEach(k => { if (plan[k].doe === 'wacht') plan[k] = { doe:'nu', min:0 }; });
    return { doel, plan };
  }
  // spoedbonnen bovenaan, daarna de oudste eerst; het spoedmerkje per gerecht
  const spoedEerst = (a,b) => ((b.spoed?1:0) - (a.spoed?1:0)) || opTijd(a,b);
  const spoedMerk = (o, it) => (o.spoed && (!o.spoed.itemId || o.spoed.itemId === it.id)) ? '⚡ ' : '';
  // KDS-tijdbanden: groen tot 6 min, amber tot 12, rood daarna, knipperen vanaf 18
  function ageKlasse(a){ return a >= 18 ? ' late flash' : a >= 12 ? ' late' : a >= 6 ? ' warn' : ' ok'; }
  function vpChip(sec, p){
    if (!p) return '';
    const kant = KSECTIES[sec] || (sec === 'bar' ? ['🍸','Bar'] : ['·', sec]);
    const lbl = { nu: T('vp.nu','start nu'), wacht: T('vp.wacht','wacht'), bezig: T('vp.bezig','bezig'), warm: T('vp.warm','houd warm'), pas: T('vp.pas','naar de pas') }[p.doe] || '';
    const min = (p.doe==='wacht'||p.doe==='bezig'||p.doe==='warm') && p.min ? ' ~'+p.min+'m' : '';
    return '<span class="vp '+p.doe+'">'+kant[0]+' '+T('ks.'+sec, kant[1])+' · '+lbl+min+'</span>';
  }
  // de deurhost-regel op de bon: waar is de gast (GPS uit de leden-app)
  function gastRegel(o){
    if (o.guestArrived) return '<div class="tkc-who">✅ '+T('kds.gastin','De gast is binnen.')+'</div>';
    if (Number.isFinite(o.guestEtaMin)) return '<div class="tkc-who">🧭 '+T('kds.gast','Gast onderweg, ~')+o.guestEtaMin+' min</div>';
    return '';
  }
  // hoe lang staat het al op de pas: sneller rood dan de bontijd (eten wordt koud)
  function pasKlasse(a){ return a >= 6 ? ' late flash' : a >= 3 ? ' warn' : ' ok'; }
  // de statusbalk boven de bonnen: open, te laat, oudste
  function stStats(list){
    const ages = list.map(o => ageMin(o.at));
    const laat = ages.filter(a => a >= 12).length;
    const oudste = ages.length ? Math.max.apply(null, ages) : 0;
    return '<div class="st-stats">'+
      '<div class="st-stat"><b>'+list.length+'</b><span>'+T('kds.open','Open bonnen')+'</span></div>'+
      '<div class="st-stat'+(laat?' rood':' groen')+'"><b>'+laat+'</b><span>'+T('kds.laat','Te laat')+'</span></div>'+
      '<div class="st-stat"><b>'+oudste+'m</b><span>'+T('kds.oudste','Oudste bon')+'</span></div>'+
    '</div>';
  }
  // de all-day-telling: totalen per gerecht over alle open bonnen, zoals op een echte lijn
  function allDay(list, filt){
    const per = {};
    list.forEach(o => (o.items||[]).forEach(it => {
      if (filt === 'bar'){
        // de barkant: alle drankjes die nog gemaakt moeten worden
        if (stationOf(it) !== 'bar' || (o.stations||{}).bar === 'klaar') return;
        per[it.name] = (per[it.name]||0) + it.qty;
        return;
      }
      const sec = sectieOf(it); if (!sec) return;
      if (filt && sec !== filt) return;
      if ((o.secties||{})[sec] === 'klaar') return;
      per[it.name] = (per[it.name]||0) + it.qty;
    }));
    minOverschot(per);
    const rows = Object.entries(per).sort((a,b) => b[1]-a[1]).slice(0, 14);
    if (!rows.length) return '';
    return '<div class="allday"><span class="ad-h">'+T('kds.allday','All day')+'</span>'+rows.map(r => '<span class="ad"><b>'+r[1]+'×</b>'+r[0]+'</span>').join('')+'</div>';
  }
  const opTijd = (a,b) => new Date(a.at) - new Date(b.at);
  /* ---- het overschot: te veel gemaakt is voorraad op de pas ----
     De AI verrekent het overal: maak-nu en all day tellen het eraf, en de
     coach zegt: gebruik eerst wat er ligt. */
  const overschotLijst = () => (state && state.overschot) || [];
  const overQty = naam => overschotLijst().filter(x => x.name === naam).reduce((n,x) => n + x.qty, 0);
  // trek het overschot van de telling af (wat er ligt hoef je niet te maken)
  function minOverschot(per){
    Object.keys(per).forEach(n => {
      const ov = overQty(n);
      if (!ov) return;
      if (typeof per[n] === 'number') per[n] = Math.max(0, per[n] - ov);
      else per[n].n = Math.max(0, per[n].n - ov);
      if ((typeof per[n] === 'number' ? per[n] : per[n].n) <= 0) delete per[n];
    });
    return per;
  }
  function overschotChips(){
    const l = overschotLijst();
    if (!l.length) return '';
    return '<div class="allday"><span class="ad-h">🥡 '+T('over.h','Op de pas over')+'</span>'+
      l.map(x => '<span class="ad"><b>'+x.qty+'×</b>'+x.name+'</span>').join('')+'</div>';
  }
  // de melder voor de pas-schermen: is over, gebruikt of afschrijven
  function overschotBlok(){
    const l = overschotLijst();
    return '<div class="tkc" style="grid-column:1/-1;"><h3>🥡 '+T('over.h','Op de pas over')+'</h3>'+
      '<div class="tkc-who">'+T('over.deck','Te veel gemaakt? Meld het hier; elk scherm telt het van de maaklijst af en de coach zegt: gebruik eerst wat er ligt.')+'</div>'+
      '<div class="row-gap"><select class="st-in" id="ovGerecht" style="flex:2;">'+
        (state.menu||[]).map(m=>'<option value="'+m.id+'">'+m.name+'</option>').join('')+'</select>'+
      '<input class="st-in" id="ovAantal" type="number" inputmode="numeric" min="1" value="1" style="flex:0 0 4.5rem;">'+
      '<button class="tkc-start" id="ovBij" style="flex:1;border-radius:10px;">'+T('over.is','Is over')+'</button></div>'+
      (l.length ? l.map(x => '<div class="st-row"><span><b style="color:var(--gold);">'+x.qty+'×</b> '+x.name+'<span class="sub">'+timeAgo(x.at)+' · '+(x.door||'')+'</span></span>'+
        '<span class="acts"><button class="obtn primary" data-overgebruikt="'+x.id+'">'+T('over.gebruikt','Gebruikt')+'</button><button class="obtn warn" data-overweg="'+x.id+'">✕</button></span></div>').join('')
      : '<div class="tkc-who">'+T('over.leeg','Er ligt nu niets over.')+'</div>')+'</div>';
  }
  function orderStations(o){
    const set = new Set();
    (o.items||[]).forEach(it => set.add(stationOf(it)));
    return [...set];
  }
  function stationLabel(st){
    return { keuken: T('st.keuken','Keuken-scherm'), bar: T('st.bar','Bar-scherm'), bediening: T('st.bediening','Bedieningspost'),
             events: T('st.events','Events-scherm'), kantoor: T('st.kantoor','Kantoor'),
             chauffeur: (S && S.type === 'jet') ? T('st.crew','Crew-post') : T('st.chauffeur','Chauffeurspost') }[st] || st;
  }
  function tickClock(){
    const el = $('#stClock');
    if (el) el.textContent = new Date().toLocaleTimeString(lang()==='en'?'en-GB':'nl-NL', { hour:'2-digit', minute:'2-digit' });
  }
  function enterStation(st){
    stationMode = st;
    $('#staffPick').classList.remove('open');
    $('#spPin').classList.remove('open');
    $('#gate').style.display = 'none';
    $('#app').classList.add('active');
    $('#station').classList.add('on');
    $('#stBiz').textContent = S ? S.name : '';
    $('#stLabel').textContent = stationLabel(st);
    tickClock();
    clearInterval(stClockTimer);
    stClockTimer = setInterval(tickClock, 20000);
    renderStation();
    startStream();
  }
  $('#stExit').addEventListener('click', () => {
    stationMode = null;
    clearInterval(stClockTimer);
    $('#station').classList.remove('on');
    try { localStorage.removeItem('rtg_sup_station'); } catch(e){}
    buildTabs();
    renderAll();
  });

  function ageMin(iso){ return Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000)); }
  function ticketCard(o, st, opts){
    opts = opts || {};
    const items = (o.items||[]).filter(it => !st || stationOf(it) === st);
    const secIcon = it => (st === 'keuken' && sectieOf(it)) ? KSECTIES[sectieOf(it)][0] + ' ' : '';
    const a = ageMin(o.at);
    const tier = opts.dim ? '' : ageKlasse(a);
    const phase = (o.stations||{})[st];
    let act = '';
    if (opts.serve){
      act = '<div class="tkc-act"><button class="tkc-serve" data-stserve="'+o.ref+'">'+T('st.served','Geserveerd')+'</button></div>';
    } else if (st && !opts.dim){
      act = '<div class="tkc-act">'+
        (!phase ? '<button class="tkc-start" data-stgo="'+o.ref+'" data-phase="bezig">'+T('st.start','Start')+'</button>' : '')+
        '<button class="tkc-ready" data-stgo="'+o.ref+'" data-phase="klaar">'+T('st.ready','Klaar')+'</button></div>';
    }
    return '<div class="tkc'+tier+(opts.dim?' dim':'')+'">'+
      '<div class="tkc-top"><span class="tkc-code">'+o.pickup+(o.table?' <span class="txt-md">\uD83E\uDE91 '+o.table+'</span>':'')+'</span><span class="tkc-age">'+a+' min</span></div>'+
      '<div class="tkc-who">'+o.customerCodename+' \u00b7 '+o.ref+(o.paid?'':' \u00b7 '+T('st.unpaid','onbetaald'))+'</div>'+
      '<div class="tkc-items">'+items.map(it=>'<span class="rcp-item" data-rcp="'+it.id+'"><b>'+it.qty+'\u00d7</b>'+secIcon(it)+it.name+'</span>').join('')+'</div>'+
      (o.allergyNote?'<div class="tkc-alg">\u26a0 '+o.allergyNote+'</div>':'')+
      (o.leeftijdOk?'<div class="tkc-alg" style="background:rgba(45,140,80,0.14);color:#2d8c50;">\uD83D\uDD1E '+T('st.agever','Leeftijd in de app geverifieerd (paspoort)')+'</div>':'')+
      ((st==='keuken'||st==='bar')&&!opts.dim?(function(){
        const vp = vuurplan(o);
        const kanten = Object.keys(vp.plan);
        return kanten.length ? '<div class="st-badges">'+kanten.map(s2 => vpChip(s2, vp.plan[s2])).join('')+'</div>' : '';
      })():'')+
      (opts.dim?'':gastRegel(o))+
      (opts.badges?'<div class="st-badges">'+orderStations(o).map(s2=>{
        const p=(o.stations||{})[s2]||'';
        return '<span class="st-badge '+p+'">'+(s2==='bar'?'\uD83C\uDF78':'\uD83D\uDD25')+' '+s2+(p?' \u00b7 '+(p==='klaar'?T('st.b.klaar','klaar'):T('st.b.bezig','bezig')):'')+'</span>';
      }).join('')+'</div>':'')+
      act+'</div>';
  }

  // draaiboek-regels voor een werkplek: alle gepubliceerde events vanaf vandaag
  function dueOf(e, it){
    const d = new Date((e.date || '2099-01-01') + 'T00:00:00');
    d.setDate(d.getDate() - (it.daysBefore || 0));
    return d.toISOString().slice(0, 10);
  }
  function dueLabel(due, daysBefore){
    const today = new Date().toISOString().slice(0, 10);
    const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const naam = due === today ? T('rs.today','vandaag') : due === morgen ? T('rs.tomorrow','morgen') : due;
    return naam + (daysBefore ? ' \u00b7 D-' + daysBefore : '');
  }
  function runsheetFor(station){
    const today = new Date().toISOString().slice(0, 10);
    const out = [];
    for (const e of (state.events || [])){
      if (!e.published || (e.date || '') < today) continue;
      for (const it of (e.runsheet || [])){
        if (station === 'party' || it.station === station || it.station === 'alle')
          out.push({ e, it, due: dueOf(e, it) });
      }
    }
    out.sort((a, b) => a.due.localeCompare(b.due) || (a.it.time.localeCompare(b.it.time)));
    return out;
  }
  const RUN_ICON = { keuken:'\uD83D\uDD25', bar:'\uD83C\uDF78', bediening:'\uD83E\uDDFE', party:'\uD83C\uDF9F', alle:'\uD83D\uDCE2' };
  function runsheetStrip(station){
    const rows = runsheetFor(station);
    if (!rows.length) return '';
    const today = new Date().toISOString().slice(0, 10);
    return '<div class="st-sec">\uD83D\uDCCB '+T('rs.h','Draaiboek')+' & '+T('rs.mep','mise en place')+'</div>'+
      '<div class="tkc" style="grid-column:1/-1;">'+rows.map(r =>
        '<div class="st-row'+(r.it.done?'" style="opacity:0.5;':'"')+'">'+
        '<span>'+
        '<span style="display:inline-block;min-width:5.4rem;margin-right:0.5rem;font-size:0.62rem;letter-spacing:0.06em;text-transform:uppercase;color:'+(r.due===today?'var(--burgundy)':'var(--soft)')+';">'+dueLabel(r.due, r.it.daysBefore)+'</span>'+
        '<b style="color:var(--gold);font-variant-numeric:tabular-nums;margin-right:0.6rem;">'+r.it.time+'</b>'+
        (station==='party'?'<span style="margin-right:0.4rem;">'+(RUN_ICON[r.it.station]||'')+'</span>':'')+
        (r.it.done?'<s>'+r.it.text+'</s>':r.it.text)+
        '<span class="sub">'+r.e.name+' \u00b7 '+r.e.date+(r.it.done&&r.it.doneBy?' \u00b7 \u2713 '+r.it.doneBy:'')+'</span></span>'+
        '<button class="obtn'+(r.it.done?' primary':'')+'" data-rundone="'+r.e.id+'" data-item="'+r.it.id+'">'+(r.it.done?'\u2713':T('rs.doit','Gedaan'))+'</button></div>'
      ).join('')+'</div>';
  }

  /* De voorraadbalk op de werkvloer: wat is laag, wat is op, en welke
     gerechten verdienen een 86 omdat een ingredient uit het recept op is.
     Gevoed door het keukenbrein (kern/keuken.js), zuinig ververst. */
  let wvInfo = null, wvAt = 0, wvBezig = false;
  function laadWerkvloer(){
    if (wvBezig || Date.now() - wvAt < 15000) return;
    wvBezig = true;
    API.call('/supplier/keuken/werkvloer').then(d => { wvInfo = d; wvAt = Date.now(); wvBezig = false; renderStation(); }).catch(() => { wvBezig = false; wvAt = Date.now(); });
  }
  function werkvloerBalk(){
    if (!wvInfo) return '';
    const chips = [];
    (wvInfo.adviezen||[]).forEach(a => chips.push('<button class="obtn warn" data-st86adv="'+a.menuItemId+'">\u26d4 86: '+esc(a.gerecht)+' ('+esc(a.ingredient)+' '+T('st.isop','is op')+')</button>'));
    (wvInfo.op||[]).forEach(a => chips.push('<span class="ad" style="color:#FF8589;font-weight:600;">'+esc(a.naam)+' '+T('st.op','OP')+'</span>'));
    (wvInfo.laag||[]).forEach(a => chips.push('<span class="ad">'+esc(a.naam)+' '+T('st.laag','laag')+' ('+a.aantal+' '+esc(a.eenheid)+')</span>'));
    chips.push('<button class="obtn ghost" data-stderf>\u267b '+T('st.derf','Derving melden')+'</button>');
    return '<div class="allday"><span class="ad-h">\ud83d\udce6 '+T('st.voorraad','Voorraad')+'</span>'+chips.join('')+'</div>';
  }
  function renderStation(){
    const el = $('#stBody'); if (!el || !state) return;
    $('#stBiz').textContent = S ? S.name : '';
    $('#stLabel').textContent = stationLabel(stationMode) + (stationMode === 'keuken' ? ' \u00b7 ' + T('ks.'+keukenSectie, (KSECTIES[keukenSectie]||['',''])[1]) : '');
    const live = (state.orders||[]).filter(o => !['geserveerd','geweigerd','terugbetaald'].includes(o.status));
    let html = '';
    if (stationMode === 'keuken' || stationMode === 'bar'){ laadWerkvloer(); html += werkvloerBalk(); }
    if (stationMode === 'bediening'){
      /* De bedieningspas: wat kan er NU gelopen worden en waarheen. Spoed en
         het langst wachtende eerst; de bestemming (tafel of ophaalcode) staat
         groot; de tafelklok bundelt complete tafels in een loop. */
      const serve = live.filter(o => o.status === 'klaar')
        .sort((a,b) => ((b.spoed?1:0)-(a.spoed?1:0)) || (new Date(a.pasAt||a.at) - new Date(b.pasAt||b.at)));
      const making = live.filter(o => o.status !== 'klaar').sort(spoedEerst);
      // wie is er echt ingeklokt: de pas weet op wie hij kan rekenen
      const binnen = (state.klok && state.klok.binnen) || [];
      html += '<div class="allday"><span class="ad-h">\uD83D\uDC65 '+T('bp.binnen','Ingeklokt')+'</span>'+
        (binnen.length ? '<span class="ad">'+binnen.join(', ')+'</span>' : '<span class="ad">'+T('bp.niemand','Niemand ingeklokt')+'</span>')+'</div>';
      const tafelsKlaar = {};
      serve.forEach(o => { if (o.table) (tafelsKlaar[o.table] = tafelsKlaar[o.table] || []).push(o); });
      const loop = Object.keys(tafelsKlaar).filter(t => !making.some(o => (o.table||'') === t));
      if (loop.length)
        html += '<div class="allday" role="status"><span class="ad-h">\uD83E\uDE91 '+T('pas.compleet','Tafel compleet')+'</span>'+
          loop.map(t => '<span class="ad"><b>'+t+'</b>'+tafelsKlaar[t].map(o=>o.pickup).join(', ')+' \u00b7 '+T('bp.eenloop','pak alles in een loop')+'</span>').join('')+'</div>';
      html += '<div class="st-sec">'+T('bp.h','Bedieningspas, klaar om te lopen')+' ('+serve.length+')</div>';
      html += serve.length ? serve.map(o => {
        const pa = ageMin(o.pasAt || o.at);
        return '<div class="tkc'+pasKlasse(pa)+'">'+
          '<div class="tkc-top"><span class="tkc-code">'+(o.table?'\uD83E\uDE91 '+o.table:'\uD83D\uDCE6 '+o.pickup)+'</span><span class="tkc-age">'+pa+' '+T('pas.op','min op de pas')+'</span></div>'+
          '<div class="tkc-who">'+(o.table?T('bp.naar','breng naar de tafel'):T('bp.ophaal','ophaalbestelling, code ')+o.pickup)+' \u00b7 '+o.customerCodename+(o.spoed?' \u00b7 \u26A1 '+T('spoed.chip','Spoed'):'')+'</div>'+
          '<div class="tkc-items">'+(o.items||[]).map(it=>'<span><b>'+it.qty+'\u00D7</b>'+it.name+'</span>').join('')+'</div>'+
          gastRegel(o)+
          (o.allergyNote?'<div class="tkc-alg">\u26A0 '+o.allergyNote+'</div>':'')+
          '<div class="tkc-act"><button class="tkc-serve" data-stserve="'+o.ref+'">'+T('st.served','Geserveerd')+'</button></div></div>';
      }).join('') : '<div class="st-empty">'+T('st.noserve','Niets klaar om uit te serveren. Zodra keuken en bar klaar zijn, verschijnt de bestelling hier.')+'</div>';
      // de spoedbon: een enkel gerecht komt als gewone bon op de lijn en telt
      // gewoon mee in de maak-nu- en all-day-tellingen; geen bel, geen flits
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>\u26A1 '+T('spoed.h','Spoedbon')+'</h3>'+
        '<div class="tkc-who">'+T('spoed.deck','Gerecht gevallen of vergeten? Zet het als gewone bon op de lijn; de keuken ziet gewoon een bon erbij.')+'</div>'+
        '<div class="row-gap"><select class="st-in" id="spGerecht" style="flex:2;">'+
          (state.menu||[]).map(m=>'<option value="'+m.id+'">'+m.name+'</option>').join('')+'</select>'+
        '<input class="st-in" id="spAantal" type="number" inputmode="numeric" min="1" value="1" style="flex:0 0 4.5rem;">'+
        '<select class="st-in" id="spTafel" style="flex:1;"><option value="">'+T('spoed.geentafel','geen tafel')+'</option>'+
          (state.tables||[]).map(t=>'<option value="'+t.name+'">'+t.name+'</option>').join('')+'</select></div>'+
        '<div class="tkc-act"><button class="tkc-ready" id="spGo">\u26A1 '+T('spoed.go','Zet op de lijn')+'</button></div></div>';
      html += overschotBlok();
      html += '<div class="st-sec">'+T('st.making','In de maak')+' ('+making.length+')</div>';
      html += making.length ? making.map(o => {
        const vp = vuurplan(o);
        return '<div class="tkc">'+
          '<div class="tkc-top"><span class="tkc-code">'+o.pickup+(o.table?' <span class="txt-md">\uD83E\uDE91 '+o.table+'</span>':'')+'</span><span class="tkc-age">'+ageMin(o.at)+' min</span></div>'+
          (o.intern?'<div class="tkc-who">\u26A1 '+T('spoed.van','Spoedbon van ')+(o.spoed&&o.spoed.door?o.spoed.door:'')+'</div>':'')+
          '<div class="tkc-items">'+(o.items||[]).map(it=>'<span>'+spoedMerk(o,it)+'<b>'+it.qty+'\u00D7</b>'+it.name+'</span>').join('')+'</div>'+
          '<div class="st-badges">'+Object.entries(vp.plan).map(([k,p])=>vpChip(k,p)).join('')+'</div>'+
          gastRegel(o)+
          '<div class="tkc-act"><button class="tkc-start" data-settbl="'+o.ref+'" data-cur="'+(o.table||'')+'">\uD83E\uDE91 '+(o.table?o.table+' \u00b7 '+T('st.tblwissel','wijzig'):T('st.tblset','Tafel kiezen'))+'</button>'+
          (o.intern?'<button class="obtn" data-spoedaf="'+o.ref+'" style="margin-left:0.5rem;">'+T('spoed.af','Intrekken')+'</button>':'')+'</div></div>';
      }).join('') : '<div class="st-empty">'+T('st.nomaking','Geen lopende bestellingen.')+'</div>';
      html += runsheetStrip('bediening');
      const tables = state.tables || [];
      if (tables.length){
        html += '<div class="st-sec">'+T('st.tables','Tafels, tik om te wisselen')+'</div><div class="st-tblgrid">'+
          tables.map(t=>'<button class="tbl tbl-'+t.status+'" data-sttbl="'+t.id+'" data-cur="'+t.status+'"><b>'+t.name+'</b><span>'+t.seats+' '+T('tbl.pers','pers.')+'</span><i>'+tTbl(t.status)+'</i></button>').join('')+'</div>';
      }
      html += '<div class="st-sec">'+T('st.more','Meer')+'</div>'+
        '<a class="tkc" style="text-decoration:none;align-items:flex-start;" href="/apps/personeel.html"><b style="font-size:0.95rem;">\uD83D\uDCF1 '+T('st.pda','Open de volledige PDA')+'</b><span style="font-size:0.74rem;color:var(--soft);">'+T('st.pda.s','Rooster, taken, teamchat, videobellen en SOS.')+'</span></a>';
    } else if (stationMode === 'events'){
      const evs = state.events || [];
      html += runsheetStrip('party');
      html += evs.length ? evs.map(e => {
        const taken = (e.guests||[]).reduce((n,g)=>n+g.qty,0);
        const inb = (e.guests||[]).filter(g=>g.checkedIn).reduce((n,g)=>n+g.qty,0);
        return '<div class="tkc'+(e.published?'':' dim')+'">'+
          '<div class="tkc-top"><span style="font-size:1.05rem;font-weight:600;">'+e.name+(e.published?'':' \u00b7 '+T('ev.concept','concept'))+'</span><span class="tkc-age">'+e.date+(e.time?' \u00b7 '+e.time:'')+'</span></div>'+
          (e.desc?'<div class="tkc-who">'+e.desc+'</div>':'')+
          '<div class="tkc-who">'+taken+' / '+e.capacity+' '+T('ev.signedup','aangemeld')+' \u00b7 '+inb+' '+T('ev.inside','binnen')+(e.price?' \u00b7 '+eur(e.price)+' p.p.':'')+'</div>'+
          '<div class="ev-bar"><i style="width:'+Math.min(100, Math.round(taken/e.capacity*100))+'%;"></i></div>'+
          ((e.guests||[]).length ? '<div style="display:flex;flex-direction:column;">'+e.guests.map(g =>
            '<div class="st-row"><span>'+g.codename+' \u00b7 '+g.qty+' '+T('ev.pers','pers.')+'</span>'+
            '<button class="obtn'+(g.checkedIn?' primary':'')+'" data-evcheck="'+e.id+'" data-key="'+g.key+'">'+(g.checkedIn?'\u2713 '+T('ev.in','binnen'):T('ev.checkin','Check in'))+'</button></div>'
          ).join('')+'</div>' : '<div class="tkc-who">'+T('ev.noguests','Nog geen aanmeldingen.')+'</div>')+
        '</div>';
      }).join('') : '<div class="st-empty">'+T('ev.none','Nog geen events. De manager maakt ze aan in het Kantoor; leden melden zich aan via de leden-app.')+'</div>';
    } else if (stationMode === 'kantoor'){
      html += renderKantoor();
    } else if (stationMode === 'chauffeur'){
      // de chauffeurspost: mijn actieve rit groot in beeld, open ritten om te
      // pakken, en de verdiensten van vandaag
      const mij = actor().staffId;
      const ritten = state.rides || [];
      const actief = ritten.filter(r => !RIT_KLAAR(r.status) && r.driver && r.driver.staffId === mij);
      const straks = r => r.plannedFor && (new Date(r.plannedFor) - Date.now()) > 45 * 60000;
      const alleOpen = ritten.filter(r => r.status === 'aangevraagd' && !r.driver);
      const open = alleOpen.filter(r => !straks(r));
      const gepland = alleOpen.filter(straks);
      const vandaag = new Date().toISOString().slice(0, 10);
      const klaarVandaag = ritten.filter(r => (r.status === 'afgerond' || r.status === 'gearriveerd') && r.driver && r.driver.staffId === mij && String(r.finishedAt || r.at).slice(0, 10) === vandaag);
      const omzet = klaarVandaag.reduce((s2, r) => s2 + (r.quote || 0), 0);
      html += '<div class="st-sec">'+T('ch.mijn','Mijn rit')+' ('+actief.length+')</div>';
      html += actief.length ? actief.map(r => {
        const nxt = NEXT_RIDE[r.status];
        return '<div class="tkc" style="grid-column:1/-1;">'+
          '<div class="tkc-top"><span class="tkc-code" style="font-size:1.3rem;">'+r.customerCodename+'</span><span class="tkc-age">'+tStatus(r.status)+'</span></div>'+
          '<div class="tkc-who" style="font-size:0.95rem;">'+(r.from||'')+' → '+(r.to||T('sup.opendest','open bestemming'))+'</div>'+
          '<div class="tkc-who">'+ritRegel(r)+(r.vehicle?' · 🚘 '+r.vehicle.name+' ('+(r.vehicle.plate||'')+')':'')+'</div>'+
          (r.note?'<div class="tkc-alg">📝 '+r.note+'</div>':'')+
          (r.pickupEtaMin!=null && r.status==='onderweg' ? '<div class="tkc-who">🧭 ~'+r.pickupEtaMin+' min '+T('ch.naargast','naar de gast')+'</div>':'')+
          (r.dropEtaMin!=null && r.status==='aan-boord' ? '<div class="tkc-who">🏁 ~'+r.dropEtaMin+' min '+T('ch.naarbestemming','naar de bestemming')+'</div>':'')+
          (nxt?'<div class="tkc-act"><button class="tkc-ready" data-chgo="'+r.ref+'" data-st="'+nxt+'">'+T(RIDE_NEXT_LABEL[nxt], RIDE_NEXT_NL[nxt])+'</button></div>':'')+
        '</div>';
      }).join('') : '<div class="st-empty">'+T('ch.geenrit','Geen actieve rit. Neem hieronder een open rit aan.')+'</div>';
      html += '<div class="st-sec">'+T('ch.open','Open ritten')+' ('+open.length+')</div>';
      html += open.length ? open.map(r =>
        '<div class="tkc">'+
          '<div class="tkc-top"><span class="tkc-code">'+r.customerCodename+'</span><span class="tkc-age">'+timeAgo(r.at)+'</span></div>'+
          '<div class="tkc-who">'+(r.from||'')+' → '+(r.to||T('sup.opendest','open bestemming'))+'</div>'+
          '<div class="tkc-who">'+ritRegel(r)+' · '+r.when+'</div>'+
          '<div class="tkc-act"><button class="tkc-start" data-chneem="'+r.ref+'">'+T('ch.neem','Neem deze rit')+'</button></div>'+
        '</div>'
      ).join('') : '<div class="st-empty">'+T('ch.geenopen','Geen open aanvragen. Nieuwe ritten verschijnen hier vanzelf.')+'</div>';
      if (gepland.length){
        html += '<div class="st-sec">'+T('ch.gepland','Gepland')+' ('+gepland.length+')</div>';
        html += gepland.map(r =>
          '<div class="tkc dim">'+
            '<div class="tkc-top"><span class="tkc-code">'+r.customerCodename+'</span><span class="tkc-age">📅</span></div>'+
            '<div class="tkc-who">'+(r.from||'')+' → '+(r.to||T('sup.opendest','open bestemming'))+'</div>'+
            '<div class="tkc-who">'+ritRegel(r)+' · <b>'+r.when+'</b></div>'+
            '<div class="tkc-act"><button class="tkc-start" data-chneem="'+r.ref+'">'+T('ch.neem','Neem deze rit')+'</button></div>'+
          '</div>'
        ).join('');
      }
      html += '<div class="st-sec">'+T('ch.vandaag','Vandaag')+'</div>'+
        '<div class="tkc"><div class="tkc-top"><span style="font-weight:600;">'+klaarVandaag.length+' '+T('ch.ritten','rit(ten) afgerond')+'</span>'+
        '<span class="tkc-code">'+eur(omzet)+'</span></div><div class="tkc-who">'+T('ch.netto','Volledig voor de zaak: RTG rekent 0% commissie.')+'</div></div>';
    } else if (stationMode === 'agenda'){
      // de agenda van de zelfstandige professional: aanvragen bevestigen,
      // leveren en afronden, met de verdiensten van vandaag eronder
      const bs = state.boekingen || [];
      const openB = bs.filter(b => b.status === 'aangevraagd');
      const komend = bs.filter(b => b.status === 'bevestigd');
      const vandaagB = new Date().toISOString().slice(0, 10);
      const klaarB = bs.filter(b => b.status === 'afgerond' && String(b.finishedAt || b.at).slice(0, 10) === vandaagB);
      const omzetB = klaarB.reduce((x, b) => x + (b.price || 0), 0);
      const kaartB = (b, acties) => '<div class="tkc" style="grid-column:1/-1;">'+
        '<div class="tkc-top"><span class="tkc-code" style="font-size:1.2rem;">'+b.customerCodename+'</span><span class="tkc-age">'+(b.wanneer || timeAgo(b.at))+'</span></div>'+
        '<div class="tkc-who" style="font-size:0.95rem;">'+(b.service.soort==='product'?'📦 ':'🗓️ ')+b.service.name+(b.service.duurMin?' · '+b.service.duurMin+' min':'')+' · <b style="color:var(--gold);">'+eur(b.price)+'</b></div>'+
        (b.note?'<div class="tkc-alg">📝 '+b.note+'</div>':'')+
        (b.zorg?'<div class="tkc-alg" style="color:#E2B93B;">⚠ '+T('sup.zorgp','Zorgprofiel gast:')+' '+[((b.zorg.allergenen||[]).length?T('zorg.allergie','Allergie')+': '+b.zorg.allergenen.join(', '):''), b.zorg.dieet, b.zorg.medisch].filter(Boolean).join(' · ')+'</div>':'')+
        (acties?'<div class="tkc-act">'+acties+'</div>':'')+
      '</div>';
      html += '<div class="st-sec">'+T('ag.open','Nieuwe aanvragen')+' ('+openB.length+')</div>';
      html += openB.length ? openB.map(b => kaartB(b,
        '<button class="tkc-start" data-bkgo="'+b.ref+'" data-st="bevestigd">'+T('ag.bevestig','Bevestig')+'</button>'+
        '<button class="obtn warn" data-bkgo="'+b.ref+'" data-st="geweigerd" style="margin-left:0.5rem;">'+T('ag.weiger','Weiger')+'</button>')).join('')
        : '<div class="st-empty">'+T('ag.geenopen','Geen nieuwe aanvragen. Leden boeken uw diensten en producten via de RTG-app; betaald is definitief.')+'</div>';
      html += '<div class="st-sec">'+T('ag.komend','Bevestigd')+' ('+komend.length+')</div>';
      html += komend.length ? komend.map(b => kaartB(b,
        '<button class="tkc-ready" data-bkgo="'+b.ref+'" data-st="afgerond">'+T('ag.rondaf','Rond af')+'</button>')).join('')
        : '<div class="st-empty">'+T('ag.geenkomend','Nog niets bevestigd.')+'</div>';
      html += '<div class="st-sec">'+T('ch.vandaag','Vandaag')+'</div>'+
        '<div class="tkc"><div class="tkc-top"><span style="font-weight:600;">'+klaarB.length+' '+T('ag.klaar','afspraak/afspraken afgerond')+'</span>'+
        '<span class="tkc-code">'+eur(omzetB)+'</span></div><div class="tkc-who">'+T('ch.netto','Volledig voor de zaak: RTG rekent 0% commissie.')+'</div></div>';
    } else {
      const st = stationMode;
      if (st === 'keuken'){
        // kies de kant: chef ziet alles, elke sectie alleen het eigen werk, de pas verzamelt
        html += '<div class="st-chips">'+Object.keys(KSECTIES).map(k =>
          '<button data-ksel="'+k+'"'+(keukenSectie===k?' class="on"':'')+'>'+KSECTIES[k][0]+' '+T('ks.'+k, KSECTIES[k][1])+'</button>').join('')+'</div>';
        html += '<div id="coachBox" style="grid-column:1/-1;display:none;"></div>';
        if (keukenSectie !== 'chef' && keukenSectie !== 'pas'){
          const sec = keukenSectie;
          const mijn = live.filter(o => sectiesVanOrder(o).includes(sec));
          const actief = mijn.filter(o => (o.secties||{})[sec] !== 'klaar').sort(spoedEerst);
          const klaarHier = mijn.filter(o => (o.secties||{})[sec] === 'klaar');
          const kaart = (o, dim) => {
            const items = (o.items||[]).filter(it => sectieOf(it) === sec);
            const a = ageMin(o.at);
            const tier = dim ? '' : ageKlasse(a);
            const fase = (o.secties||{})[sec];
            const advies = dim ? null : vuurplan(o).plan[sec];
            return '<div class="tkc'+tier+(dim?' dim':'')+'">'+
              '<div class="tkc-top"><span class="tkc-code">'+o.pickup+(o.table?' <span class="txt-md">\uD83E\uDE91 '+o.table+'</span>':'')+'</span><span class="tkc-age">'+a+' min</span></div>'+
              '<div class="tkc-who">'+o.customerCodename+' \u00b7 '+o.ref+'</div>'+
              '<div class="tkc-items">'+items.map(it=>'<span class="rcp-item" data-rcp="'+it.id+'"><b>'+it.qty+'\u00d7</b>'+it.name+'</span>').join('')+'</div>'+
              (o.allergyNote?'<div class="tkc-alg">\u26a0 '+o.allergyNote+'</div>':'')+
              (advies?'<div class="st-badges">'+vpChip(sec, advies)+'</div>':'')+
              (dim?'':'<div class="tkc-act">'+(!fase?'<button class="tkc-start" data-secgo="'+o.ref+'" data-phase="bezig">'+T('st.start','Start')+'</button>':'')+
                '<button class="tkc-ready" data-secgo="'+o.ref+'" data-phase="klaar">'+T('st.ready','Klaar')+'</button></div>')+
            '</div>';
          };
          html += stStats(actief) + allDay(actief, sec) + overschotChips();
          // de bezetting: wie staat er op deze kant; het scherm rekent per kok
          const koks = ((state.lijn||{})[sec]) || [];
          const ikSta = koks.some(k => k.id === actor().staffId);
          const perKok = koks.length ? Math.ceil(actief.length / koks.length) : actief.length;
          html += '<div class="allday"><span class="ad-h">👥 '+T('lijn.h','Bezetting')+'</span>'+
            (koks.length ? '<span class="ad">'+koks.map(k=>k.name.split(' ')[0]).join(', ')+' · <b>'+perKok+'</b> '+T('lijn.perkok','bon(nen) p.p.')+'</span>' : '<span class="ad">'+T('lijn.leeg','Niemand aangemeld')+'</span>')+
            '<button class="obtn'+(ikSta?' primary':'')+'" data-lijnaan="'+sec+'">'+(ikSta?'✔ '+T('lijn.af','Aangemeld, tik om af te melden'):T('lijn.aan','Meld je aan op deze kant'))+'</button></div>';
          // maak nu: wat deze kant NU in een keer maakt, gebundeld over de bonnen
          const nuPer = {};
          actief.forEach(o => {
            const p = vuurplan(o).plan[sec];
            if (!p || (p.doe !== 'nu' && p.doe !== 'bezig')) return;
            (o.items||[]).forEach(it => { if (sectieOf(it) === sec){ const r = nuPer[it.name] = nuPer[it.name] || { n:0, bonnen:[] }; r.n += it.qty; r.bonnen.push(o.pickup); } });
          });
          minOverschot(nuPer);
          const nuRows = Object.entries(nuPer).sort((a,b)=>b[1].n-a[1].n);
          if (nuRows.length)
            html += '<div class="tkc" style="grid-column:1/-1;border-top:4px solid #2E7D5B;"><h3>🔥 '+T('lijn.maaknu','Maak nu, in een keer')+'</h3>'+
              nuRows.map(([naam,r])=>'<div class="st-row"><span><b style="color:var(--gold);">'+r.n+'×</b> '+naam+'<span class="sub">'+T('lijn.bonnen','bonnen ')+[...new Set(r.bonnen)].join(', ')+'</span></span></div>').join('')+'</div>';
          // tussendoor: slim gebruik van de wachttijd (voorbereiden, MEP, de lijn)
          const straks = {};
          actief.forEach(o => {
            const p = vuurplan(o).plan[sec];
            if (!p || p.doe !== 'wacht') return;
            (o.items||[]).forEach(it => { if (sectieOf(it) === sec){ const r = straks[it.name] = straks[it.name] || { n:0, min:p.min }; r.n += it.qty; r.min = Math.min(r.min, p.min); } });
          });
          const straksRows = Object.entries(straks).sort((a,b)=>a[1].min-b[1].min).slice(0,6);
          const dmsK = (state.dailyMeps||{})[new Date().toISOString().slice(0,10)];
          const mepOpen = dmsK ? (dmsK.tasks||[]).filter(x=>!x.done).slice(0,3) : [];
          if (straksRows.length || mepOpen.length || !actief.length)
            html += '<div class="tkc" style="grid-column:1/-1;"><h3>⏳ '+T('lijn.tussendoor','Tussendoor')+'</h3>'+
              straksRows.map(([naam,r])=>'<div class="st-row"><span>'+T('lijn.zetklaar','Zet vast klaar: ')+'<b>'+r.n+'×</b> '+naam+'<span class="sub">'+T('lijn.startover','start over ~')+r.min+' min</span></span></div>').join('')+
              mepOpen.map(x=>'<div class="st-row"><span><b style="color:var(--gold);font-variant-numeric:tabular-nums;margin-right:0.5rem;">'+x.time+'</b>'+x.task+'<span class="sub">'+T('lijn.mep','mise en place van vandaag')+'</span></span></div>').join('')+
              (!straksRows.length && !mepOpen.length ? '<div class="tkc-who">'+T('lijn.hygiene','Rustig moment: werkbank afnemen, koeling en parstock checken, garnituur bijvullen.')+'</div>' : '')+
            '</div>';
          html += actief.length ? actief.map(o=>kaart(o,false)).join('') : '<div class="st-empty">'+T('ks.calm','Niets voor deze kant. Nieuwe bestellingen met werk voor ')+T('ks.'+sec, KSECTIES[sec][1]).toLowerCase()+T('ks.calm2',' verschijnen hier vanzelf.')+'</div>';
          if (klaarHier.length){
            html += '<div class="st-sec">'+T('ks.done','Klaargemeld door deze kant')+'</div>';
            html += klaarHier.map(o=>kaart(o,true)).join('');
          }
          el.innerHTML = html;
          bindStation(el);
          return;
        }
        if (keukenSectie === 'pas'){
          const keukenOrders = live.filter(o => sectiesVanOrder(o).length);
          const bezig = keukenOrders.filter(o => (o.stations||{}).keuken !== 'klaar').sort(spoedEerst);
          const opDePas = keukenOrders.filter(o => (o.stations||{}).keuken === 'klaar')
            .sort((a,b) => new Date(a.pasAt||a.at) - new Date(b.pasAt||b.at));
          const badge = o => '<div class="st-badges">'+Object.entries(vuurplan(o).plan).map(([s2,p]) => vpChip(s2, p)).join('')+'</div>';
          // de tafelklok van de pas: staat alles van een tafel op de pas, dan
          // kan de hele tafel in een keer uit
          const tafels = {};
          opDePas.forEach(o => { if (o.table) (tafels[o.table] = tafels[o.table] || []).push(o); });
          const compleet = Object.keys(tafels).filter(t => !bezig.some(o => (o.table||'') === t));
          if (compleet.length)
            html += '<div class="allday" role="status"><span class="ad-h">\uD83E\uDE91 '+T('pas.compleet','Tafel compleet')+'</span>'+
              compleet.map(t => '<span class="ad"><b>'+t+'</b>'+tafels[t].map(o=>o.pickup).join(', ')+' \u00b7 '+T('pas.samen','stuur samen uit')+'</span>').join('')+'</div>';
          html += overschotBlok();
          html += '<div class="st-sec">'+T('ks.pas.klaar','Op de pas, samenstellen en doorgeven')+' ('+opDePas.length+')</div>';
          html += opDePas.length ? opDePas.map(o => {
            const pa = ageMin(o.pasAt || o.at);
            return '<div class="tkc'+pasKlasse(pa)+'"><div class="tkc-top"><span class="tkc-code">'+o.pickup+(o.table?' <span class="txt-md">\uD83E\uDE91 '+o.table+'</span>':'')+'</span><span class="tkc-age">'+pa+' '+T('pas.op','min op de pas')+'</span></div>'+
            '<div class="tkc-who">'+o.customerCodename+' \u00b7 '+(o.status==='klaar'?T('ks.pas.wacht','wacht op bediening'):T('ks.pas.bar','wacht nog op de bar'))+'</div>'+
            '<div class="tkc-items">'+(o.items||[]).filter(it=>sectieOf(it)).map(it=>'<span><b>'+it.qty+'\u00d7</b>'+KSECTIES[sectieOf(it)][0]+' '+it.name+'</span>').join('')+'</div>'+
            gastRegel(o)+
            (o.allergyNote?'<div class="tkc-alg">\u26a0 '+o.allergyNote+'</div>':'')+'</div>';
          }).join('') : '<div class="st-empty">'+T('ks.pas.leeg','Nog niets op de pas. Zodra alle kanten klaar zijn, komt de bestelling hier binnen.')+'</div>';
          html += '<div class="st-sec">'+T('ks.pas.bezig','In de maak, per kant')+' ('+bezig.length+')</div>';
          html += bezig.map(o =>
            '<div class="tkc"><div class="tkc-top"><span class="tkc-code">'+o.pickup+(o.table?' <span class="txt-md">\uD83E\uDE91 '+o.table+'</span>':'')+'</span><span class="tkc-age">'+ageMin(o.at)+' min</span></div>'+
            badge(o)+
            gastRegel(o)+
            (o.allergyNote?'<div class="tkc-alg">\u26a0 '+o.allergyNote+'</div>':'')+'</div>'
          ).join('');
          el.innerHTML = html;
          bindStation(el);
          return;
        }
      }
      const mine = live.filter(o => (o.items||[]).some(it => stationOf(it) === st));
      const act = mine.filter(o => (o.stations||{})[st] !== 'klaar').sort(spoedEerst);
      const done = mine.filter(o => (o.stations||{})[st] === 'klaar');
      if (st === 'keuken' || st === 'bar') html += stStats(act);
      if (st === 'keuken') html += allDay(act);
      if (st === 'bar') html += allDay(act, 'bar') + overschotChips() + overschotBlok();
      html += act.length ? act.map(o => ticketCard(o, st, {})).join('') : '<div class="st-empty">'+T('st.calm','Rustig. Nieuwe bestellingen verschijnen hier vanzelf, met geluid van de bel in de app.')+'</div>';
      if (done.length){
        html += '<div class="st-sec">'+T('st.done','Klaargemeld, wacht op uitserveren')+'</div>';
        html += done.map(o => ticketCard(o, st, { dim:true })).join('');
      }
      if (st === 'keuken'){
        const vandaagStr = new Date().toISOString().slice(0, 10);
        const morgenStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const dms = state.dailyMeps || {};
        html += '<div class="st-sec">\uD83D\uDCC5 '+T('dm.h','Dagelijkse mise en place (\u00e0 la carte)')+'</div>';
        const dmCard = (plan, label) => {
          const open = plan.tasks.filter(x=>!x.done).length;
          return '<div class="tkc" style="grid-column:1/-1;">'+
            '<div class="tkc-top"><span style="font-weight:600;">'+label+' \u00b7 \u00b1'+plan.covers+' couverts</span><span class="tkc-age">'+plan.factorLabel+' \u00b7 '+T('dm.by','voorspeld door')+' '+plan.by+'</span></div>'+
            '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">'+plan.portions.map(p=>'<span class="st-badge">'+p.name+' \u00b7 <b style="color:var(--gold);">'+p.n+'\u00d7</b></span>').join('')+'</div>'+
            plan.tasks.map(x=>'<div class="st-row'+(x.done?'" style="opacity:0.5;':'"')+'"><span><b style="color:var(--gold);font-variant-numeric:tabular-nums;margin-right:0.6rem;">'+x.time+'</b>'+(x.done?'<s>'+x.task+'</s>':x.task)+(x.done&&x.doneBy?'<span class="sub">\u2713 '+x.doneBy+'</span>':'')+'</span>'+
              '<button class="obtn'+(x.done?' primary':'')+'" data-dmdone="'+plan.date+'" data-item="'+x.id+'">'+(x.done?'\u2713':T('rs.doit','Gedaan'))+'</button></div>').join('')+
            (open?'':'<div class="tkc-who">\u2705 '+T('dm.alldone','Alles afgevinkt, de lijn staat.')+'</div>')+
          '</div>';
        };
        if (dms[vandaagStr]) html += dmCard(dms[vandaagStr], T('rs.today','vandaag').toUpperCase());
        if (dms[morgenStr]) html += dmCard(dms[morgenStr], T('rs.tomorrow','morgen').toUpperCase());
        html += '<div class="tkc"><div class="tkc-who">'+T('dm.deck','De voorspelling rekent met de verkoop van de afgelopen drie weken, de tafelcapaciteit en de weekdag.')+'</div>'+
          '<div class="tkc-act"><button class="tkc-start" data-dmgen="vandaag">\u2728 '+(dms[vandaagStr]?T('dm.redo','Opnieuw voor vandaag'):T('dm.today','Voorspel vandaag'))+'</button>'+
          '<button class="tkc-start" data-dmgen="morgen">\u2728 '+(dms[morgenStr]?T('dm.redo2','Opnieuw voor morgen'):T('dm.tomorrow','Voorspel morgen'))+'</button></div></div>';
        const evs2 = (state.events||[]).filter(e => e.published && (e.date||'') >= vandaagStr && (e.catering && e.catering.mode !== 'geen' || (e.allergies||[]).length));
        if (evs2.length){
          html += '<div class="st-sec">\uD83D\uDC68\u200D\uD83C\uDF73 '+T('ek.h','Event-keuken')+'</div>';
          html += evs2.map(e => {
            const dishes = e.catering.mode === 'menu'
              ? e.catering.itemIds.map(id => (state.menu||[]).find(m => m.id === id)).filter(Boolean)
              : (state.menu||[]).filter(m => m.station !== 'bar');
            const covers = Math.max((e.guests||[]).reduce((n,g)=>n+g.qty,0), Math.ceil(e.capacity*0.6));
            return '<div class="tkc">'+
              '<div class="tkc-top"><span style="font-weight:600;">'+e.name+'</span><span class="tkc-age">'+e.date+'</span></div>'+
              '<div class="tkc-who">'+(e.catering.mode==='menu'?T('ek.menu','Vast menu')+' \u00b7 '+dishes.length+' '+T('ek.courses','gangen'):e.catering.mode==='alacarte'?'\u00c0 la carte':'')+' \u00b7 \u00b1'+covers+' couverts</div>'+
              (e.catering.mode==='menu' && dishes.length ? '<div class="tkc-items" style="font-size:0.82rem;">'+dishes.map(d=>'<span>\u2022 '+d.name+'</span>').join('')+'</div>' : '')+
              ((e.allergies||[]).length ? (e.allergies||[]).map(a =>
                '<div class="tkc-alg">\u26a0 '+a.allergen+' ('+a.count+'\u00d7)'+
                (a.alternative?'<br>\u2192 <b>'+a.alternative.name+'</b>'+(a.alternative.desc?': '+a.alternative.desc:''):'<br>'+T('ek.noalt','Nog geen vervangend gerecht, vraag het Kantoor of tik hieronder.'))+'</div>').join('') : '')+
              '<div class="tkc-act"><button class="tkc-ready" data-kmep="'+e.id+'">\u2728 '+T('ek.mep','Organiseer de mise en place')+'</button></div>'+
            '</div>';
          }).join('');
        }
      }
      html += runsheetStrip(st);
    }
    el.innerHTML = html;
    bindStation(el);
  }

  // de keukenhulp: haalt live advies op (Claude of de regel-coach) en toont het
  let coachSeq = 0;
  async function loadCoach(el){
    const box = el.querySelector('#coachBox'); if (!box) return;
    const mijn = ++coachSeq;
    try {
      const d = await API.call('/supplier/kitchen/coach', {});
      if (mijn !== coachSeq) return; // er is al een nieuwere render
      if (!d.lines || !d.lines.length){ box.style.display = 'none'; return; }
      box.style.display = 'block';
      box.innerHTML = '<div class="tkc" style="border-color:rgba(169,143,28,0.5);">'+
        '<h3>\uD83E\uDD16 '+T('kc.h','Keukenhulp')+(d.ai?' \u00b7 Claude':'')+'</h3>'+
        d.lines.map(l=>'<div style="font-size:0.9rem;line-height:1.6;padding:0.2rem 0;">'+l+'</div>').join('')+'</div>';
    } catch(e){ box.style.display = 'none'; }
  }
  /* Het gerechtenmenu: tik op een gerecht en kies recept, bereidingswijze,
     allergenen met vervangers, een dranksuggestie of een 86-melding
     (uitverkocht; leden kunnen het per direct niet meer bestellen). */
  function sluitDish(){ const d = document.getElementById('dishSheet'); if (d) d.remove(); }
  function dishSheet(itemId){
    sluitDish();
    const m = (state.menu||[]).find(x => x.id === itemId); if (!m) return;
    const host = $('#station') || document.body;
    const wrap = document.createElement('div');
    wrap.id = 'dishSheet';
    const alg = (m.allergens||[]).length
      ? m.allergens.map(a => '<span class="ds-alg">⚠ '+a+'</span>').join('')
      : '<span class="ds-alg ok">'+T('ds.noalg','geen allergenen geregistreerd')+'</span>';
    const icoon = KSECTIES[m.sectie||'warm'] && m.station !== 'bar' ? KSECTIES[m.sectie||'warm'][0]+' ' : (m.station==='bar'?'🍸 ':'');
    wrap.innerHTML = '<div class="ds-scrim"></div>'+
      '<div class="ds-card" role="dialog" aria-modal="true" aria-label="'+m.name+'">'+
        '<div class="ds-top"><div><b>'+icoon+m.name+'</b>'+
          (m.desc?'<span class="ds-desc">'+m.desc+'</span>':'')+
          '<div class="ds-algs">'+alg+'</div></div>'+
          '<button class="st-exit" data-dsluit>'+T('ds.sluit','Sluit')+'</button></div>'+
        '<div class="ds-acts">'+
          '<button data-dsk="recept">📖 '+T('ds.recept','Recept')+'</button>'+
          '<button data-dsk="bereiding">👨‍🍳 '+T('ds.bereiding','Bereidingswijze')+'</button>'+
          '<button data-dsk="allergenen">⚠️ '+T('ds.allergenen','Allergenen en vervangers')+'</button>'+
          '<button data-dsk="pairing">🍷 '+T('ds.pairing','Dranksuggestie')+'</button>'+
          '<button data-ds86'+(m.uitverkocht?' class="aan"':'')+'>⛔ '+(m.uitverkocht?T('ds.86off','86 opheffen'):T('ds.86','86, uitverkocht'))+'</button>'+
        '</div>'+
        (m.uitverkocht?'<div class="ds-86">'+T('ds.86nu','Dit gerecht staat op 86: leden kunnen het nu niet bestellen.')+'</div>':'')+
        '<div class="ds-body" id="dsBody">'+T('ds.kies','Kies hierboven wat je wilt zien.')+'</div>'+
      '</div>';
    host.appendChild(wrap);
    wrap.querySelector('.ds-scrim').addEventListener('click', sluitDish);
    wrap.querySelector('[data-dsluit]').addEventListener('click', sluitDish);
    wrap.querySelectorAll('[data-dsk]').forEach(b => b.addEventListener('click', async () => {
      const body = wrap.querySelector('#dsBody');
      wrap.querySelectorAll('[data-dsk]').forEach(x => x.classList.toggle('aan', x === b));
      body.textContent = T('ds.laden','De AI-chef schrijft...');
      try {
        const d = await API.call('/supplier/menu/kennis', { itemId, soort: b.dataset.dsk });
        body.textContent = d.tekst;
        if (b.dataset.dsk === 'recept') m.recept = d.tekst;
      } catch(e){ body.textContent = e.message; }
    }));
    wrap.querySelector('[data-ds86]').addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/menu/86', { itemId, op: !m.uitverkocht });
        m.uitverkocht = d.uitverkocht;
        toast(m.uitverkocht ? '⛔ 86: '+m.name : '✅ '+m.name+' '+T('ds.weerbeschikbaar','is weer beschikbaar'));
        dishSheet(itemId);
      } catch(e){ toast(e.message); }
    });
  }

  function bindStation(el){
    if (stationMode === 'keuken') loadCoach(el);
    // de voorraadbalk: 86 zetten op advies en derving melden vanaf de vloer
    el.querySelectorAll('[data-st86adv]').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/supplier/menu/86', { itemId: b.dataset.st86adv, op: true });
        toast('⛔ '+T('st.86gezet','86 gezet; leden kunnen het niet meer bestellen.'));
        wvAt = 0; laadWerkvloer(); await refresh();
      } catch(e){ toast(e.message); }
    }));
    const stDerf = el.querySelector('[data-stderf]'); if (stDerf) stDerf.addEventListener('click', async () => {
      const naam = prompt(T('st.derfwat','Welk artikel is er weg (naam van de voorraadlijst)?')); if (!naam) return;
      const art = ((wvInfo && wvInfo.artikelen) || []).find(a => a.naam.toLowerCase() === naam.trim().toLowerCase());
      if (!art){ toast(T('st.derfgeen','Dat artikel staat niet op de voorraadlijst.')); return; }
      const hv = prompt(T('vr.derfvraag','Hoeveel is er weg (breuk, derving)?')); if (!hv) return;
      const reden = prompt(T('vr.derfreden','Reden?')) || '';
      try {
        await API.call('/supplier/keuken/verspilling', { artikelId: art.id, hoeveelheid: Number(String(hv).replace(',', '.')), reden });
        toast('♻ '+T('st.derfok','Geboekt in het voorraadlogboek.'));
        wvAt = 0; laadWerkvloer();
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('.rcp-item').forEach(s2 => s2.addEventListener('click', () => dishSheet(s2.dataset.rcp)));
    el.querySelectorAll('[data-settbl]').forEach(b => b.addEventListener('click', async () => {
      const t = prompt(T('st.tblq','Welke tafel? (leeg = geen tafel)'), b.dataset.cur || '');
      if (t === null) return;
      try { await API.call('/supplier/order/table', { ref: b.dataset.settbl, table: t.trim() }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // het overschot: is over melden, gebruikt afboeken of afschrijven
    const ovBij = el.querySelector('#ovBij'); if (ovBij) ovBij.addEventListener('click', async () => {
      try { await API.call('/supplier/overschot', { op: 'erbij', itemId: el.querySelector('#ovGerecht').value, qty: el.querySelector('#ovAantal').value }); toast('🥡 '+T('over.toast','Gemeld; elk scherm telt het nu van de maaklijst af.')); await refresh(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-overgebruikt]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/overschot', { op: 'gebruikt', id: b.dataset.overgebruikt }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-overweg]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/overschot', { op: 'weg', id: b.dataset.overweg }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // de spoedbon: als gewone bon op de lijn zetten, of intrekken
    const spGo = el.querySelector('#spGo'); if (spGo) spGo.addEventListener('click', async () => {
      try {
        await API.call('/supplier/order/spoed', { itemId: el.querySelector('#spGerecht').value, qty: el.querySelector('#spAantal').value, table: el.querySelector('#spTafel').value });
        toast('⚡ '+T('spoed.toast','Spoedbon staat op de lijn, als gewone bon.'));
        await refresh();
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-spoedaf]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/spoed', { ref: b.dataset.spoedaf, op: false }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-lijnaan]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/lijn', { sectie: b.dataset.lijnaan }); toast(d.aangemeld ? '👥 '+T('lijn.aant','Aangemeld op deze kant.') : T('lijn.aftoast','Afgemeld van deze kant.')); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ksel]').forEach(b => b.addEventListener('click', () => {
      keukenSectie = b.dataset.ksel;
      try { localStorage.setItem('rtg_sup_ksectie', keukenSectie); } catch(e){}
      renderStation();
    }));
    el.querySelectorAll('[data-secgo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/sectie', { ref: b.dataset.secgo, sectie: keukenSectie, phase: b.dataset.phase }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-stgo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/station', { ref: b.dataset.stgo, station: stationMode, phase: b.dataset.phase }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-stserve]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/status', { ref: b.dataset.stserve, status: 'geserveerd' }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-sttbl]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/table/status', { id: b.dataset.sttbl, status: TBL_NEXT[b.dataset.cur]||'vrij' }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-evcheck]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/event/checkin', { eventId: b.dataset.evcheck, key: b.dataset.key }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-rundone]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/event/runsheet/done', { id: b.dataset.rundone, itemId: b.dataset.item }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kmep]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = T('ek.busy','De mise en place wordt georganiseerd...');
      try { const d = await API.call('/supplier/event/mep', { id: b.dataset.kmep });
        toast('\u2705 '+d.added+' '+T('ek.planned','MEP-taken ingepland voor '+d.covers+' couverts.'));
        await refresh(); } catch(e){ toast(e.message); b.disabled = false; }
    }));
    el.querySelectorAll('[data-dmgen]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = T('dm.busy','Voorspellen...');
      try { const d = await API.call('/supplier/mep/daily', { day: b.dataset.dmgen });
        toast('\u2728 '+T('dm.done1','Voorspelling klaar:')+' '+d.plan.covers+' couverts ('+d.plan.factorLabel+')'+(d.histDagen?', '+T('dm.hist','op basis van')+' '+d.histDagen+' '+T('dm.days','dagen historie'):''));
        await refresh(); } catch(e){ toast(e.message); b.disabled = false; }
    }));
    el.querySelectorAll('[data-dmdone]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/mep/daily/done', { date: b.dataset.dmdone, taskId: b.dataset.item }); await refresh(); } catch(e){ toast(e.message); }
    }));
    if (stationMode === 'kantoor') bindKantoor(el);
    // chauffeurspost: ritfase doorzetten of een open rit aannemen
    el.querySelectorAll('[data-chgo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/ride/status', { ref: b.dataset.chgo, status: b.dataset.st }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-bkgo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/booking/status', { ref: b.dataset.bkgo, status: b.dataset.st }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-chneem]').forEach(b => b.addEventListener('click', async () => {
      try {
        const s2 = await API.call('/supplier/ride/suggest', { ref: b.dataset.chneem });
        await API.call('/supplier/ride/assign', { ref: b.dataset.chneem, self: true, vehicleId: s2.vehicleId });
        toast(T('ch.genomen','Rit is van u.') + (s2.vehicleName ? ' 🚘 ' + s2.vehicleName : ''));
        await refresh();
      } catch(e){ toast(e.message); }
    }));
  }

  /* ---- het Kantoor: de eigenaar/manager past hier alles aan ---- */
  let kantoorSec = 'bo', kantoorMsg = '';
  let kantoorEdit = null;   // gerecht dat open staat in de kaart-bewerker
  // de AI-bedrijfsagent: vaste leverancier, inkoopvoorstellen en het AI-weekrooster
  let agentData = null, agentMarkt = null, agentBusy = false;
  // de urenregistratie: iedereen klokt via de PDA, het kantoor ziet het beeld
  let klokOverzicht = null, klokBusy = false;
  async function laadKlok(){
    if (klokBusy) return;
    klokBusy = true;
    try { klokOverzicht = (await API.call('/staff/klok/overzicht', {})).rows; } catch(e){ klokOverzicht = []; }
    klokBusy = false;
    renderStation();
  }
  async function laadAgent(){
    if (agentBusy) return;
    agentBusy = true;
    try { agentData = (await API.call('/supplier/agent', {})).agent; } catch(e){ agentData = { voorstellen: [], error: e.message }; }
    try { if (!agentMarkt) agentMarkt = (await API.call('/supplier/inkoop/markt', {})).groothandels || []; } catch(e){ agentMarkt = agentMarkt || []; }
    agentBusy = false;
    renderStation();
  }
  // eigen backoffice van de zaak: dagcijfers, weektrend, toppers en actiecentrum
  let boData = null, boBusy = false;
  async function laadBackoffice(){
    if (boBusy) return;
    boBusy = true;
    try { boData = await API.call('/supplier/backoffice', {}); }
    catch(e){ boData = { error: e.message }; }
    boBusy = false;
    renderStation();
  }
  // open uitnodigingen (kassacodes) van het team, voor de HR-sectie
  let invData = null, invBusy = false;
  async function laadInvites(){
    if (invBusy) return;
    invBusy = true;
    try { invData = await API.call('/supplier/staff/invites', {}); }
    catch(e){ invData = { invites: [] }; }
    invBusy = false;
    renderStation();
  }
  // boekhouding: btw per genre, personeelskosten en cadeaukaarten, per land
  let finData = null, finBusy = false, finMsg = '', accAntwoord = '';
  // Salon-bedrijfsprofiel: volgers, aanbiedingen, polls en cijfers
  let mktData = null, mktBusy = false, mktMsg = '';
  async function laadMarketing(){
    if (mktBusy) return;
    mktBusy = true;
    try { mktData = await API.call('/supplier/salon/stats', {}); }
    catch(e){ mktData = { error: e.message }; }
    mktBusy = false;
    renderStation();
  }
  // Een bestand (PDF/CSV) ophalen met het token en als download aanbieden.
  async function dlBestand(pad, body, filename){
    if (!API.token) return;
    try {
      const res = await fetch('/api' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API.token }, body: JSON.stringify(body || {}) });
      if (!res.ok) throw new Error('fout');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch(e){ toast(T('fn.dlfout','Exporteren lukte niet.')); }
  }
  async function laadFinance(){
    if (finBusy) return;
    finBusy = true;
    try { finData = await API.call('/supplier/finance', {}); }
    catch(e){ finData = { error: e.message }; }
    finBusy = false;
    renderStation();
  }
  // ritgeschiedenis komt gepagineerd van de server (schaalvast bij miljoenen ritten)
  let histData = null, histPage = 1, histQ = '', histBusy = false;
  async function laadHistorie(){
    if (histBusy) return;
    histBusy = true;
    try { histData = await API.call('/supplier/ride/history', { page: histPage, q: histQ }); }
    catch(e){ histData = { items: [], total: 0, page: 1, pages: 1, omzet: 0 }; }
    histBusy = false;
    renderStation();
  }
  function renderKantoor(){
    // Elk bedrijf heeft HR en Marketing; de rest van de secties hangt af van
    // de sector: horeca beheert de kaart en events, een hotel de kamers en
    // minibar, een appartement de deuren, vervoer de prijzen aan RTG.
    const type = (S && S.type) || 'restaurant';
    const horeca = ['restaurant','bar','club'].includes(type);
    const secs = [
      ['bo','\uD83D\uDCCA',T('kt.bo','Backoffice')],
      ['fin','\uD83D\uDCDA',T('kt.fin','Boekhouding')],
      ['hr','\uD83D\uDC65',T('kt.hr','HR & team')]
    ];
    if (horeca) secs.push(
      ['keuken','\uD83D\uDD25',T('kt.keuken','Keuken')],
      ['bar','\uD83C\uDF78','Bar'],
      ['bediening','\uD83E\uDDFE',T('kt.bediening','Bediening')],
      ['events','\uD83C\uDF9F','Events']
    );
    if (type === 'hotel') secs.push(
      ['kamers','\uD83D\uDECF',T('kt.kamers','Kamers')],
      ['minibar','\uD83E\uDDCA','Minibar']
    );
    if (type === 'apartment') secs.push(
      ['kamers','\uD83C\uDFE1',T('kt.units','Verblijven')],
      ['deuren','\uD83D\uDEAA',T('kt.deuren','Deuren')]
    );
    if (type === 'taxi' || type === 'jet') secs.push(
      ['ritten','\uD83D\uDDFA',T('kt.ritten','Ritten')],
      ['historie','\uD83D\uDCD2',T('kt.historie','Historie')],
      ['vloot', type==='jet' ? '\u2708\uFE0F' : '\uD83D\uDE98', T('kt.vloot','Vloot')],
      ['tarief','\uD83E\uDDEE',T('kt.tarief','Tarief')],
      ['prijzen','\uD83D\uDCB6',T('kt.prijzen','Prijzen')]
    );
    if (type === 'zzp') secs.push(['diensten','\uD83D\uDDC2\uFE0F',T('kt.diensten','Aanbod')]);
    secs.push(['marketing','\uD83D\uDCE3','Marketing']);
    if (!secs.some(s2 => s2[0] === kantoorSec)) kantoorSec = 'bo';
    let html = '<div class="st-chips">'+secs.map(s2 =>
      '<button data-ksec="'+s2[0]+'"'+(kantoorSec===s2[0]?' class="on"':'')+'>'+s2[1]+' '+s2[2]+'</button>').join('')+'</div>';
    if (kantoorMsg){ html += '<div class="tkc" style="grid-column:1/-1;border-color:var(--gold);">'+kantoorMsg+'</div>'; }

    if (kantoorSec === 'bo'){
      // de eigen backoffice van de zaak, met dezelfde patronen als het
      // RTG-controlecentrum maar dan uitsluitend over dit bedrijf
      if (!boData){
        laadBackoffice();
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>📊 '+T('kt.bo','Backoffice')+'</h3><div class="tkc-who">'+T('kt.laden','Laden...')+'</div></div>';
      } else if (boData.error){
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>📊 '+T('kt.bo','Backoffice')+'</h3><div class="tkc-who">'+boData.error+'</div></div>';
      } else {
        const b = boData;
        html += '<div class="tkc" style="grid-column:1/-1;">'+
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:0.55rem;">'+
          [[T('bz.today','Omzet vandaag'), eur(b.stats.omzetVandaag)],
           [T('bz.trans','Transacties'), b.stats.transactiesVandaag],
           [T('bz.kassa','Waarvan kassa'), eur(b.stats.kassaVandaag)],
           [T('bz.week','Weekomzet'), eur(b.stats.omzetWeek)],
           [T('bz.binnen','Nu ingeklokt'), b.stats.binnenNu],
           [T('bz.acties','Open acties'), b.stats.openActies]]
          .map(x => '<div style="background:rgba(255,255,255,0.04);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;">'+
            '<div style="font-size:0.54rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+x[0]+'</div>'+
            '<div style="font-family:\'Bodoni Moda\',serif;font-size:1.2rem;color:var(--gold);margin-top:0.15rem;">'+x[1]+'</div></div>').join('')+'</div>'+
          '<div class="tkc-who" style="margin-top:0.5rem;">'+T('bz.nulcom','RTG rekent 0% commissie: deze omzet is volledig van u.')+'</div>'+
          '<button class="obtn" id="boBrief" style="align-self:flex-start;">📋 '+T('bz.brief','Dagbriefing')+'</button>'+
          '<div id="boBriefTxt" style="display:none;border:1px solid var(--gold);border-radius:12px;padding:0.7rem 0.9rem;font-size:0.82rem;line-height:1.6;"></div></div>';
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>🎯 '+T('bz.actie','Actiecentrum van de zaak')+'</h3>'+
          (b.alerts.length ? b.alerts.map(a =>
            '<div class="st-row"><span>'+(a.level==='rood'?'🔴':a.level==='amber'?'🟠':'🟢')+' '+a.text+'</span></div>').join('')
            : '<div class="tkc-who">✓ '+T('bz.niks','Alles loopt. Vastgelopen bestellingen, wachtende gasten en open personeelszaken verschijnen hier vanzelf.')+'</div>')+'</div>';
        // baas over uw zaak: elke functie aan of uit; alleen app-betalen heeft
        // bewust geen knop, wel kiest u het moment (vooraf of achteraf)
        const caps2 = (S && S.caps) || [];
        const inst = state.settings || {};
        const optAan = k => !inst.opties || inst.opties[k] !== false;
        const rijen = [];
        if (caps2.includes('menu') || caps2.includes('rooms')){
          rijen.push(['ordersOpen', T('sw.orders','Bestellen via de app'), T('sw.orders.s','Leden kunnen bij u bestellen'), inst.ordersOpen !== false]);
          rijen.push(['reservationsOpen', T('sw.res','Reserveringen'), T('sw.res.s','Nieuwe reserveringen aannemen'), inst.reservationsOpen !== false]);
        }
        rijen.push(['betaalVooraf', T('sw.vooraf','Vooraf betalen'), T('sw.vooraf.s','Uit = gasten betalen achteraf. Betalen zelf gaat altijd via de app.'), optAan('betaalVooraf')]);
        rijen.push(['gastchat', T('sw.chat','Gastchat'), T('sw.chat.s','Gasten kunnen uw team berichten sturen'), optAan('gastchat')]);
        if (caps2.includes('rides')) rijen.push(['ritten', T('sw.ritten','Ritaanvragen'), T('sw.ritten.s','Nieuwe ritten aannemen via de app'), optAan('ritten')]);
        if (caps2.includes('doors')) rijen.push(['deurenGast', T('sw.deuren','Digitale gastsleutel'), T('sw.deuren.s','Gearriveerde gasten openen zelf de voordeur'), optAan('deurenGast')]);
        if (horeca) rijen.push(['events', T('sw.events','Event-aanmeldingen'), T('sw.events.s','Leden kunnen zich aanmelden voor uw events'), optAan('events')]);
        const swRows = rijen.map(r =>
          '<div class="st-row"><span>'+r[1]+'<span class="sub">'+r[2]+'</span></span>'+
          '<button class="obtn'+(r[3]?' primary':' warn')+'" data-kopt="'+r[0]+'" data-val="'+(r[3]?'0':'1')+'">'+(r[3]?T('sw.aan','Aan'):T('sw.uit','Uit'))+'</button></div>').join('');
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>🎛 '+T('sw.h','Baas over uw zaak')+'</h3>'+
          '<div class="tkc-who">'+T('sw.s','Zet elke functie aan of uit wanneer u dat wilt. Alleen betalen via de app staat altijd aan; het moment (vooraf of achteraf) bepaalt u zelf.')+'</div>'+
          funcBlok(T('sw.blok','Schakelaars'), rijen.map(r => ({ aan: r[3] })), swRows)+
          '<div class="st-row"><span>'+T('sw.apppay','Betalen via de app')+'<span class="sub">'+T('sw.apppay.s','Vast onderdeel van elk RTG-partnerschap')+'</span></span>'+
          '<span class="pill klaar">'+T('sw.altijd','Altijd aan')+'</span></div></div>';
        const maxD = Math.max.apply(null, b.week.map(d => d.omzet).concat([1]));
        html += '<div class="tkc"><h3>📈 '+T('bz.weekh','Omzet per dag')+'</h3>'+
          '<div style="display:flex;align-items:flex-end;gap:0.45rem;height:120px;margin-top:0.4rem;">'+
          b.week.map((d, i) =>
            '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:0.2rem;height:100%;min-width:0;">'+
            '<span style="font-size:0.54rem;color:var(--soft);white-space:nowrap;">'+(d.omzet?eur(d.omzet):'·')+'</span>'+
            '<i style="display:block;width:100%;max-width:32px;border-radius:5px 5px 2px 2px;min-height:2px;height:'+Math.max(2, Math.round(d.omzet/maxD*70))+'%;background:'+(i===6?'var(--burgundy)':'var(--gold)')+';"></i>'+
            '<span style="font-size:0.52rem;color:var(--soft);text-transform:uppercase;">'+d.label+'</span></div>').join('')+'</div></div>';
        html += '<div class="tkc"><h3>🏆 '+T('bz.top','Toppers')+'</h3>'+
          (b.toppers.length ? b.toppers.map((t2, i) =>
            '<div class="st-row"><span>'+(['🥇','🥈','🥉'][i]||'')+' '+t2.naam+'<span class="sub">'+t2.aantal+'x '+T('bz.verkocht','verkocht')+'</span></span><b style="color:var(--gold);">'+eur(t2.omzet)+'</b></div>').join('')
            : '<div class="tkc-who">'+T('bz.geentop','Nog geen verkopen. Zodra er via de app of de kassa verkocht wordt, staan de toppers hier.')+'</div>')+'</div>';
      }
    }
    if (kantoorSec === 'fin'){
      // de boekhouding van de zaak: btw per genre, personeelskosten uit de
      // klokuren en een boekhoudkundig correcte cadeaukaartenadministratie
      if (!finData){
        laadFinance();
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>📚 '+T('kt.fin','Boekhouding')+'</h3><div class="tkc-who">'+T('kt.laden','Laden...')+'</div></div>';
      } else if (finData.error){
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>📚 '+T('kt.fin','Boekhouding')+'</h3><div class="tkc-who">'+finData.error+'</div></div>';
      } else {
        const f = finData;
        if (finMsg){ html += '<div class="tkc" style="grid-column:1/-1;border-color:var(--gold);">'+finMsg+'</div>'; }
        // De onderste streep bovenaan: wat blijft er deze maand over? Omzet min de
        // af te dragen btw en de loonkosten. RTG houdt niets in (0% commissie).
        const omzetMaand = (f.btw || []).reduce((s2, r) => s2 + (r.omzet || 0), 0);
        const loonTot = (f.personeel && f.personeel.totaal) || 0;
        const nettoOver = Math.round((omzetMaand - (f.btwTotaal || 0) - loonTot) * 100) / 100;
        html += '<div class="tkc" style="grid-column:1/-1;border-color:var(--gold);"><h3>💶 '+T('fn.netto','Wat u overhoudt')+' ('+f.maand+')</h3>'+
          '<div class="st-row"><span>'+T('fn.omzetmaand','Omzet deze maand')+'<span class="sub">'+T('fn.nulcom','RTG rekent 0% commissie')+'</span></span><b>'+eur(omzetMaand)+'</b></div>'+
          '<div class="st-row"><span>'+T('fn.minbtw','Af te dragen btw')+'</span><b style="color:var(--burgundy);">- '+eur(f.btwTotaal || 0)+'</b></div>'+
          '<div class="st-row"><span>'+T('fn.minloon','Loonkosten')+'</span><b style="color:var(--burgundy);">- '+eur(loonTot)+'</b></div>'+
          '<div class="st-row" style="border-top:1px solid var(--line);"><span><b>'+T('fn.overhoudt','Blijft over (indicatie)')+'</b></span><b style="color:var(--gold);font-size:1.05rem;">'+eur(nettoOver)+'</b></div>'+
          '<div class="tkc-who">'+T('fn.netto.s','Indicatie vóór inkoop, huur en overige kosten. Uw omzet is volledig van u; RTG houdt niets in.')+'</div>'+
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.6rem;">'+
          '<button class="obtn" id="fnPdf">⤓ '+T('fn.exportpdf','Overzicht (PDF)')+'</button>'+
          '<button class="obtn" id="fnCsv">⤓ '+T('fn.exportcsv','Boekhouding (CSV)')+'</button></div></div>';
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>🌍 '+T('fn.land','Land & uurloon')+'</h3>'+
          '<div class="tkc-who">'+T('fn.land.s','Het land bepaalt de btw-tarieven, werkgeverslasten en aangifteregels; het uurloon voedt de personeelskosten.')+'</div>'+
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">'+
          '<select class="st-in" id="fnLand" style="flex:2;min-width:130px;">'+f.landen.map(l=>'<option value="'+l.code+'"'+(l.code===f.land?' selected':'')+'>'+l.naam+'</option>').join('')+'</select>'+
          '<input class="st-in" id="fnUur" type="number" step="0.5" value="'+f.personeel.uurloon+'" style="flex:1;min-width:80px;" placeholder="€/uur">'+
          '<button class="obtn primary" id="fnSave">'+T('fn.save','Opslaan')+'</button></div></div>';
        html += '<div class="tkc"><h3>🧾 '+T('fn.btw','Btw deze maand')+' ('+f.maand+')</h3>'+
          (f.btw.length ? f.btw.map(r =>
            '<div class="st-row"><span>'+r.label+'<span class="sub">'+T('fn.omzet','omzet')+' '+eur(r.omzet)+' · '+T('fn.grondslag','grondslag')+' '+eur(r.grondslag)+' · '+r.tarief+'%</span></span>'+
            '<b style="color:var(--gold);">'+eur(r.btw)+'</b></div>').join('')
            : '<div class="tkc-who">'+T('fn.geenomzet','Nog geen omzet deze maand.')+'</div>')+
          '<div class="st-row" style="border-top:1px solid var(--line);"><span><b>'+T('fn.afdragen','Af te dragen btw')+'</b></span><b style="color:var(--gold);">'+eur(f.btwTotaal)+'</b></div></div>';
        html += '<div class="tkc"><h3>👥 '+T('fn.personeel','Personeelskosten')+' ('+f.maand+')</h3>'+
          '<div class="st-row"><span>'+T('fn.uren','Geklokte uren')+' × € '+f.personeel.uurloon+'<span class="sub">'+f.personeel.uren+' '+T('fn.uur','uur')+'</span></span><b>'+eur(f.personeel.bruto)+'</b></div>'+
          '<div class="st-row"><span>'+T('fn.lasten','Werkgeverslasten')+'<span class="sub">~'+f.personeel.lastenPct+'% ('+f.landNaam+')</span></span><b>'+eur(f.personeel.lasten)+'</b></div>'+
          (f.personeel.vakantiegeld ? '<div class="st-row"><span>'+T('fn.vak','Vakantiegeldreserve')+'<span class="sub">'+f.personeel.vakantiegeldPct+'%</span></span><b>'+eur(f.personeel.vakantiegeld)+'</b></div>' : '')+
          '<div class="st-row" style="border-top:1px solid var(--line);"><span><b>'+T('fn.totaal','Totale loonkosten')+'</b></span><b style="color:var(--gold);">'+eur(f.personeel.totaal)+'</b></div>'+
          '<div class="tkc-who">'+T('fn.minuur','Indicatie minimumuurloon')+': € '+f.personeel.uurloonMin+'</div></div>';
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>🎁 '+T('fn.gc','Cadeaukaarten')+'</h3>'+
          '<div class="st-row"><span>'+T('fn.gcverkocht','Verkocht deze maand')+'<span class="sub">'+T('fn.gcv.s','nog geen omzet, geen btw')+'</span></span><b>'+eur(f.giftcards.verkocht)+'</b></div>'+
          '<div class="st-row"><span>'+T('fn.gcin','Ingewisseld deze maand')+'<span class="sub">'+T('fn.gci.s','omzet + btw-moment')+'</span></span><b>'+eur(f.giftcards.ingewisseld)+'</b></div>'+
          '<div class="st-row"><span>'+T('fn.gcopen','Openstaand saldo')+'<span class="sub">'+T('fn.gco.s','verplichting op de balans')+' · '+f.giftcards.aantal+' '+T('fn.kaarten','kaart(en)')+'</span></span><b style="color:var(--gold);">'+eur(f.giftcards.open)+'</b></div>'+
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.4rem;">'+
          '<input class="st-in" id="gcBedrag" type="number" placeholder="€ 50" style="flex:1;min-width:80px;">'+
          '<button class="obtn primary" id="gcSell">🎁 '+T('fn.gcsell','Verkoop kaart')+'</button></div>'+
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.3rem;">'+
          '<input class="st-in" id="gcCode" placeholder="RTG-GC-XXXXXX" style="flex:2;min-width:130px;">'+
          '<input class="st-in" id="gcInBedrag" type="number" placeholder="€" style="flex:1;min-width:70px;">'+
          '<button class="obtn" id="gcRedeem">'+T('fn.gcredeem','In te wisselen')+'</button></div></div>';
        html += '<div class="tkc"><h3>📜 '+T('fn.regels','Regels in ')+f.landNaam+'</h3>'+
          f.regels.map(r => '<div class="tkc-who" style="line-height:1.5;">• '+r+'</div>').join('')+'</div>';
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>🤖 '+T('fn.ai','AI-boekhouder')+'</h3>'+
          '<div class="tkc-who">'+T('fn.ai.s2','Kent uw branche, uw cijfers en de regels. Stel een vraag, of laat hem u proactief bijsturen met adviezen op uw eigen cijfers.')+'</div>'+
          '<div id="accVragen" style="display:flex;gap:0.4rem;flex-wrap:wrap;margin:0.5rem 0;"></div>'+
          '<div class="row-gap"><input class="st-in" id="accQ" placeholder="'+T('fn.ai.ph','Bijv. hoeveel btw draag ik deze maand af?')+'" style="flex:1;">'+
          '<button class="obtn primary" id="accGo">'+T('fn.vraag','Vraag')+'</button></div>'+
          '<div id="accA" style="display:'+(accAntwoord?'block':'none')+';border:1px solid var(--gold);border-radius:12px;padding:0.7rem 0.9rem;font-size:0.82rem;line-height:1.6;margin-top:0.5rem;">'+accAntwoord+'</div>'+
          '<button class="obtn" id="accAdvies" style="margin-top:0.6rem;">✨ '+T('fn.adviezen','Stuur mij bij, geef adviezen')+'</button>'+
          '<div id="accAdv"></div></div>';
      }
    }
    if (kantoorSec === 'hr'){
      // het AI-weekrooster: voorstel op de verwachte drukte, de gemachtigde stelt vast
      if (!agentData) laadAgent();
      const rp = agentData && agentData.rooster;
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>🗓 '+T('ag2.rooster','AI-weekrooster')+'</h3>'+
        '<div class="tkc-who">'+T('ag2.rooster.deck','De AI plant de week op de verwachte drukte per dag: drukke dagen iedereen op de vloer, rustige dagen om de beurt vrij.')+'</div>'+
        (rp ? rp.days.map(d=>'<div class="st-row"><span><b>'+d.label+'</b> <span class="sub">'+d.date+'</span></span>'+
            '<span class="sub" style="text-align:right;">'+d.staff.map(m=>m.name.split(' ')[0]+': '+m.shift.split(' ')[0]).join(' · ')+'</span></div>').join('')+
          (rp.status==='voorstel'
            ? '<div class="tkc-act"><button class="tkc-ready" id="agRoosterOk">✔ '+T('ag2.rooster.ok','Stel vast')+'</button><button class="obtn warn" id="agRoosterNee" style="margin-left:0.5rem;">'+T('ag2.nee','Wijs af')+'</button></div>'
            : '<div class="tkc-who">✔ '+T('ag2.rooster.vast','Vastgesteld; het rooster in de PDA volgt dit plan.')+'</div>')
        : '<div class="tkc-act"><button class="tkc-start" id="agRooster">✨ '+T('ag2.rooster.stel','Stel het weekrooster voor')+'</button></div>')+'</div>';
      // urenregistratie: wie is binnen, wie werkte wanneer en hoelang
      if (!klokOverzicht) laadKlok();
      const tijd = iso => new Date(iso).toLocaleString(lang()==='en'?'en-GB':'nl-NL', { weekday:'short', hour:'2-digit', minute:'2-digit' });
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>⏱ '+T('kt.uren','Urenregistratie')+'</h3>'+
        '<div class="tkc-who">'+T('kt.uren.deck','Iedereen klokt via de PDA; hier staat precies wie wanneer en hoelang werkt.')+'</div>'+
        (klokOverzicht && klokOverzicht.length ? klokOverzicht.map(r =>
          '<div class="st-row"><span>'+(r.binnen?'🟢 ':'⚪ ')+r.name+'<span class="sub">'+(r.func||(r.role==='manager'?'Manager':''))+
            (r.laatsteIn?' · '+T('kt.uren.in','in ')+tijd(r.laatsteIn)+(r.laatsteUit?' · '+T('kt.uren.uit','uit ')+tijd(r.laatsteUit):' · '+T('kt.uren.nu','nu binnen')):' · '+T('kt.uren.nooit','nog niet geklokt'))+'</span></span>'+
          '<span class="sub" style="text-align:right;font-variant-numeric:tabular-nums;">'+T('kt.uren.vandaag','vandaag ')+r.vandaagUren+'u<br>'+T('kt.uren.week','week ')+r.weekUren+'u</span></div>').join('')
        : '<div class="tkc-who">…</div>')+'</div>';
      const apps = (state.applications||[]).filter(x=>x.status==='nieuw');
      html += '<div class="tkc"><h3>'+T('kt.sollicitaties','Sollicitaties')+(apps.length?' ('+apps.length+')':'')+'</h3>'+
        (apps.length ? apps.map(x=>'<div class="st-row"><span>'+x.name+' \u00b7 '+x.func+(x.viaRTG?' \u00b7 RTG':'')+'<span class="sub">'+x.contact+'</span></span>'+
          '<span class="acts"><button class="obtn primary" data-khire="'+x.id+'">'+T('ap.hire','Aannemen')+'</button><button class="obtn warn" data-kno="'+x.id+'">'+T('ap.reject','Afwijzen')+'</button></span></div>').join('')
        : '<div class="tkc-who">'+T('kt.noapps','Geen open sollicitaties.')+'</div>')+'</div>';
      html += '<div class="tkc"><h3>'+T('kt.team','Team & uitnodigingen')+'</h3>'+
        (state.staff||[]).map(m=>'<div class="st-row" style="flex-wrap:wrap;"><span>'+m.name+'<span class="sub">'+(m.func||'')+' \u00b7 '+(m.role==='manager'?'Manager':T('kt.staff','Medewerker'))+(m.lid?' \u00b7 '+T('kt.lid','RTG-lid'):'')+'</span></span>'+
          '<span class="acts">'+(m.id!==actor().staffId
            ? '<button class="obtn" data-kreset="'+m.id+'">'+T('kt.reset','Reset code')+'</button><button class="obtn warn" data-kdel="'+m.id+'">'+T('kt.ontslag','Ontslag')+'</button>'
            : '')+'</span></div>').join('')+
        '<div class="tkc-who" style="margin-top:0.55rem;line-height:1.5;">'+T('kt.invite.intro','Nodig uit; de medewerker meldt zich zelf aan met bedrijfsnaam + kassacode en een eigen RTG-account.')+'</div>'+
        '<div class="st-form"><input class="st-in" id="ktName" placeholder="'+T('kt.name.opt','Naam (optioneel)')+'"><input class="st-in" id="ktFunc" placeholder="'+T('kt.func','Functie (bijv. Bediening)')+'">'+
        '<select class="st-in" id="ktRole"><option value="staff">'+T('kt.staff','Medewerker')+'</option><option value="manager">Manager</option></select>'+
        '<button class="bigbtn" id="ktInvite" style="margin-top:0.2rem;">'+T('kt.invite','Nodig uit, kassacode verschijnt')+'</button></div></div>';
      // open kassacodes: teruglezen en intrekken
      if (!invData) laadInvites();
      const openInv = (invData && invData.invites) || [];
      html += '<div class="tkc"><h3>\ud83c\udf9f '+T('kt.openinv','Open kassacodes')+(openInv.length?' ('+openInv.length+')':'')+'</h3>'+
        (invData
          ? (openInv.length ? openInv.map(i =>
              '<div class="st-row"><span><span style="font-family:monospace;letter-spacing:0.14em;color:var(--gold);">'+escT(i.kassacode)+'</span>'+
              '<span class="sub">'+(i.naam?escT(i.naam)+' \u00b7 ':'')+(i.func?escT(i.func)+' \u00b7 ':'')+(i.role==='manager'?'Manager \u00b7 ':'')+T('kt.geldigtot','geldig t/m')+' '+new Date(i.expires).toLocaleDateString()+'</span></span>'+
              '<span class="acts"><button class="obtn warn" data-kinv="'+escT(i.kassacode)+'">'+T('kt.intrek','Trek in')+'</button></span></div>').join('')
            : '<div class="tkc-who">'+T('kt.geeninv','Geen open uitnodigingen.')+'</div>')
          : '<div class="tkc-who">'+T('kt.laden','Laden...')+'</div>')+'</div>';
      html += '<div class="tkc"><h3>'+T('kt.oproep','Hele team oproepen')+'</h3><div class="tkc-who">'+T('kt.oproep.s','Laat alle telefoons trillen, bijvoorbeeld bij een briefing.')+'</div>'+
        '<button class="obtn" id="ktBuzz" style="margin-top:0.4rem;">\uD83D\uDCE2 '+T('kt.buzzall','Buzz iedereen')+'</button></div>';
      // personeelszaken: verlofaanvragen beslissen en zien wie er nu is ingeklokt
      const verlofOpen = (state.verlof || []).filter(v => v.status === 'nieuw');
      const verlofRest = (state.verlof || []).filter(v => v.status !== 'nieuw').slice(0, 8);
      html += '<div class="tkc"><h3>\uD83C\uDF34 '+T('kt.verlof','Verlof & ziek')+(verlofOpen.length ? ' ('+verlofOpen.length+')' : '')+'</h3>'+
        (verlofOpen.length ? verlofOpen.map(v =>
          '<div class="st-row" style="flex-wrap:wrap;"><span>'+v.name+'<span class="sub">'+v.van+' t/m '+(v.tot||'')+(v.reden?' \u00B7 '+v.reden:'')+'</span></span>'+
          '<span class="acts"><button class="obtn primary" data-kvja="'+v.id+'">'+T('kt.vja','Goedkeuren')+'</button><button class="obtn warn" data-kvnee="'+v.id+'">'+T('kt.vnee','Afwijzen')+'</button></span></div>').join('')
          : '<div class="tkc-who">'+T('kt.geenverlof','Geen open aanvragen. Personeel vraagt verlof aan via de PDA; ziekmeldingen komen hier ook binnen.')+'</div>')+
        (verlofRest.length ? verlofRest.map(v =>
          '<div class="st-row"><span>'+v.name+'<span class="sub">'+(v.soort==='ziek'?T('kt.ziek','ziek gemeld')+' '+v.van:v.van+' t/m '+(v.tot||''))+'</span></span>'+
          '<span class="sub" style="text-transform:uppercase;font-size:0.6rem;letter-spacing:0.06em;">'+(v.status==='goedgekeurd'?'\u2705 '+T('kt.vok','goedgekeurd'):v.status==='afgewezen'?'\u2715 '+T('kt.vno','afgewezen'):'\uD83E\uDD12 '+T('kt.vzm','gemeld'))+'</span></div>').join('') : '')+'</div>';
      const klok2 = state.klok || { vandaag: [], binnen: [] };
      html += '<div class="tkc"><h3>\u23F1 '+T('kt.klok','Nu ingeklokt')+' ('+klok2.binnen.length+')</h3>'+
        (klok2.binnen.length ? klok2.binnen.map(n => '<div class="st-row"><span>\uD83D\uDFE2 '+n+'</span></div>').join('')
          : '<div class="tkc-who">'+T('kt.niemandin','Niemand is nu ingeklokt.')+'</div>')+
        (klok2.vandaag.length ? '<div class="tkc-who" style="margin-top:0.4rem;">'+T('kt.klokv','Vandaag geklokt')+': '+klok2.vandaag.length+' '+T('kt.klokr','registratie(s)')+' \u00B7 '+[...new Set(klok2.vandaag.map(e=>e.name))].length+' '+T('kt.klokp','personen')+'</div>' : '')+'</div>';
    }
    if (kantoorSec === 'keuken' || kantoorSec === 'bar'){
      const stn = kantoorSec;
      const items = (state.menu||[]).filter(m=>(m.station==='bar')===(stn==='bar'));
      const KANTEN = { warm:'Warme kant', koud:'Koude kant', snack:'Snacks', dessert:'Desserts' };
      // de kaart-bewerker: de chef past alles per gerecht aan, ook het vuurplan
      const bewerker = x => '<div class="st-form" data-kedit-form="'+x.id+'" style="border:1px solid var(--line);border-radius:12px;padding:0.7rem;margin:0.3rem 0 0.5rem;">'+
        '<input class="st-in" data-kf="name" value="'+escT(x.name)+'" placeholder="'+T('menu.name','Naam')+'">'+
        '<div class="row-gap"><input class="st-in" data-kf="cat" value="'+escT(x.cat||'')+'" placeholder="'+T('menu.cat','Categorie')+'" style="flex:2;"><input class="st-in" data-kf="price" type="number" inputmode="decimal" value="'+x.price+'" placeholder="\u20ac" style="flex:1;"></div>'+
        '<input class="st-in" data-kf="desc" value="'+escT(x.desc||'')+'" placeholder="'+T('kt.m.desc','Omschrijving (voor gast en keuken)')+'">'+
        (stn==='keuken'
          ? '<div class="row-gap"><select class="st-in" data-kf="sectie" style="flex:2;">'+Object.keys(KANTEN).map(k=>'<option value="'+k+'"'+((x.sectie||'warm')===k?' selected':'')+'>'+T('ks.'+k, KANTEN[k])+'</option>').join('')+'</select>'+
            '<input class="st-in" data-kf="prepMin" type="number" inputmode="numeric" value="'+(x.prepMin||'')+'" placeholder="'+T('kt.m.vuur','vuurplan-min')+'" style="flex:1;" title="'+T('kt.m.vuur.t','Bereidingstijd in minuten voor het vuurplan; leeg = de standaardtijd van de kant')+'"></div>'
          : '')+
        '<input class="st-in" data-kf="allergens" value="'+escT((x.allergens||[]).join(', '))+'" placeholder="'+T('kt.m.alg','Allergenen, met komma ertussen')+'">'+
        '<div class="row-gap"><button class="bigbtn" data-ksave="'+x.id+'" style="flex:1;">'+T('kt.m.save','Opslaan')+'</button>'+
        '<button class="obtn" data-kedit="'+x.id+'">'+T('kt.m.klaar','Klaar')+'</button></div></div>';
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+(stn==='bar'?'\uD83C\uDF78 Bar':'\uD83D\uDD25 '+T('kt.keuken','Keuken'))+' \u00b7 '+items.length+' '+T('kt.items','items op de kaart')+'</h3>'+
        (items.length ? items.map(x=>'<div class="st-row"><span>'+x.name+(x.uitverkocht?' <b style="color:#FF8589;">86</b>':'')+
          '<span class="sub">'+x.cat+' \u00b7 '+eur(x.price)+(stn==='keuken'?' \u00b7 '+T('ks.'+(x.sectie||'warm'), KANTEN[x.sectie||'warm'])+(x.prepMin?' \u00b7 \uD83D\uDD25 '+x.prepMin+' min':''):'')+'</span></span>'+
          '<span class="acts"><button class="obtn'+(kantoorEdit===x.id?' primary':'')+'" data-kedit="'+x.id+'">\u270E</button><button class="obtn" data-kst="'+x.id+'">\u21c4 '+(stn==='bar'?T('kt.tokeuken','naar keuken'):T('kt.tobar','naar bar'))+'</button><button class="obtn warn" data-kmdel="'+x.id+'">\u2715</button></span></div>'+
          (kantoorEdit===x.id ? bewerker(x) : '')).join('')
        : '<div class="tkc-who">'+T('kt.noitems','Nog niets op de kaart voor deze werkplek.')+'</div>')+
        '<div class="st-form"><input class="st-in" id="ktMn" placeholder="'+T('menu.name','Naam')+'"><div class="row-gap"><input class="st-in" id="ktMc" placeholder="'+T('menu.cat','Categorie')+'" style="flex:2;"><input class="st-in" id="ktMp" type="number" inputmode="decimal" placeholder="\u20ac" style="flex:1;"></div>'+
        '<button class="bigbtn" id="ktMAdd" style="margin-top:0.2rem;">'+T('kt.addcard','Zet op de kaart bij ')+(stn==='bar'?'de bar':T('kt.dekitchen','de keuken'))+'</button></div></div>';
      if (stn === 'keuken'){
        // de AI-inkoop: vaste leverancier koppelen, voorstellen goedkeuren of aanpassen
        if (!agentData){
          html += '<div class="tkc" style="grid-column:1/-1;"><h3>\ud83e\udde0 '+T('ag2.h','AI-inkoop')+'</h3><div class="tkc-who">\u2026</div></div>';
          laadAgent();
        } else {
          const A = agentData;
          html += '<div class="tkc" style="grid-column:1/-1;"><h3>\ud83e\udde0 '+T('ag2.h','AI-inkoop')+'</h3>'+
            '<div class="tkc-who">'+T('ag2.deck','De AI stelt de inkoop voor op de verkoop, de mise en place en de verwachte drukte. De gemachtigde keurt goed, past aan of wijst af; pas dan wordt er echt besteld bij de vaste leverancier.')+'</div>'+
            // meerdere groothandels: elke gekoppelde staat als chip met een weg-knop
            ((A.partners||[]).length ? '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.4rem;">'+
              A.partners.map(p=>'<span style="display:inline-flex;align-items:center;gap:0.4rem;border:1px solid var(--gold);border-radius:999px;padding:0.3rem 0.7rem;font-size:0.74rem;">\ud83d\udce6 '+p.naam+
                '<button data-agweg="'+p.code+'" style="background:none;border:none;color:var(--soft);cursor:pointer;font-size:0.8rem;" title="'+T('ag2.weg','loskoppelen')+'">\u2715</button></span>').join('')+'</div>' : '')+
            '<div class="row-gap"><select class="st-in" id="agGh" style="flex:2;"><option value="">'+T('ag2.kies2','Groothandel erbij...')+'</option>'+
              (agentMarkt||[]).filter(g=>!(A.partners||[]).find(p=>p.code===g.code)).map(g=>'<option value="'+g.code+'">'+g.name+'</option>').join('')+'</select>'+
              '<label style="display:flex;align-items:center;gap:0.35rem;font-size:0.72rem;color:var(--muted);"><input type="checkbox" id="agAuto"'+(A.auto?' checked':'')+'>'+T('ag2.auto','automatisch na de MEP-voorspelling')+'</label></div>'+
            '<div class="tkc-act"><button class="tkc-start" id="agKoppel">'+T('ag2.koppel2','Koppel erbij')+'</button>'+
            ((A.partners||[]).length?'<button class="tkc-ready" id="agStel">\u2728 '+T('ag2.stel','Stel inkoop voor')+'</button>':'')+'</div>'+
            ((A.partners||[]).length>1?'<div class="tkc-who" style="margin-top:0.3rem;">'+T('ag2.multi','De AI vergelijkt de gekoppelde groothandels per bestelling en kiest de beste dekking en prijs.')+'</div>':'')+
            (A.voorstellen||[]).slice(0,3).map(v=>{
              const wacht = v.status === 'wacht-op-goedkeuring';
              return '<div style="border:1px solid var(--line);border-radius:12px;padding:0.7rem;margin-top:0.5rem;">'+
                '<div class="tkc-top"><span style="font-weight:600;">'+(v.groothandelNaam||'')+' \u00b7 \u20ac '+v.totaal+'</span><span class="tkc-age">'+(wacht?'\u23f3 '+T('ag2.wacht','wacht op de gemachtigde'):v.status+(v.ref?' \u00b7 '+v.ref:''))+'</span></div>'+
                '<div class="tkc-who">'+v.uitleg+'</div>'+
                (v.regels||[]).slice(0,10).map(r=>'<div class="st-row"><span>'+r.naam+'<span class="sub">'+(r.reden||'')+' \u00b7 \u20ac '+r.prijs+' / '+(r.eenheid||'st')+'</span></span>'+
                  (wacht?'<input class="st-in" style="width:4.5rem;flex:none;" type="number" min="1" value="'+r.aantal+'" data-agr="'+v.id+'" data-pid="'+r.productId+'">':'<span class="sub">'+r.aantal+'\u00d7</span>')+'</div>').join('')+
                (wacht?'<div class="tkc-act"><button class="tkc-ready" data-agok="'+v.id+'">\u2714 '+T('ag2.ok','Keur goed en bestel')+'</button><button class="obtn warn" data-agnee="'+v.id+'" style="margin-left:0.5rem;">'+T('ag2.nee','Wijs af')+'</button></div>':'')+
              '</div>';
            }).join('')+'</div>';
        }
      }
    }
    if (kantoorSec === 'bediening'){
      const st2 = state.settings || {};
      html += '<div class="tkc"><h3>'+T('kt.open','Open of dicht')+'</h3>'+
        '<div class="st-row"><span>'+T('bh.orders','Bestellingen')+'<span class="sub">'+T('kt.orders.s','Leden kunnen bestellen via de app')+'</span></span><button class="obtn'+(st2.ordersOpen!==false?' primary':' warn')+'" data-ktoggle="ordersOpen">'+(st2.ordersOpen!==false?T('kt.isopen','Open'):T('kt.isclosed','Dicht'))+'</button></div>'+
        '<div class="st-row"><span>'+T('bh.res','Reserveringen')+'<span class="sub">'+T('kt.res.s','Nieuwe reserveringen aannemen')+'</span></span><button class="obtn'+(st2.reservationsOpen!==false?' primary':' warn')+'" data-ktoggle="reservationsOpen">'+(st2.reservationsOpen!==false?T('kt.isopen','Open'):T('kt.isclosed','Dicht'))+'</button></div></div>';
      html += '<div class="tkc"><h3>'+T('kt.tafels','Tafelindeling')+'</h3>'+
        (state.tables||[]).map(t=>'<div class="st-row"><span>'+t.name+'<span class="sub">'+t.seats+' '+T('tbl.pers','pers.')+' \u00b7 '+tTbl(t.status)+'</span></span>'+
          '<span class="acts"><button class="obtn" data-sttbl="'+t.id+'" data-cur="'+t.status+'">\u21bb</button><button class="obtn warn" data-ktdel="'+t.id+'">\u2715</button></span></div>').join('')+
        '<div class="st-form"><div class="row-gap"><input class="st-in" id="ktTn" placeholder="'+T('kt.tafelnaam','Tafelnaam')+'" style="flex:2;"><input class="st-in" id="ktTs" type="number" placeholder="4" style="flex:1;"></div>'+
        '<button class="bigbtn" id="ktTAdd" style="margin-top:0.2rem;">'+T('kt.tafeladd','Tafel toevoegen')+'</button></div></div>';
    }
    if (kantoorSec === 'events'){
      const evs = state.events || [];
      html += '<div class="tkc"><h3>'+T('kt.newevent','Nieuw event')+'</h3><div class="st-form">'+
        '<input class="st-in" id="kEvName" placeholder="'+T('kt.ev.name','Naam, bijv. Jazz & sake night')+'">'+
        '<div class="row-gap"><input class="st-in" id="kEvDate" type="date" style="flex:2;"><input class="st-in" id="kEvTime" type="time" style="flex:1;"></div>'+
        '<input class="st-in" id="kEvDesc" placeholder="'+T('kt.ev.desc','Korte omschrijving')+'">'+
        '<div class="row-gap"><input class="st-in" id="kEvCap" type="number" placeholder="'+T('kt.ev.cap','Capaciteit')+'" style="flex:1;"><input class="st-in" id="kEvPrice" type="number" placeholder="'+T('kt.ev.price','Prijs p.p. (0 = gratis)')+'" style="flex:1;"></div>'+
        '<button class="bigbtn" id="kEvAdd" style="margin-top:0.2rem;">'+T('kt.ev.add','Maak aan als concept')+'</button></div></div>';
      html += evs.map(e=>{
        const taken=(e.guests||[]).reduce((n,g)=>n+g.qty,0);
        const rs = e.runsheet || [];
        const stOpts = [['keuken','\uD83D\uDD25 '+T('kt.keuken','Keuken')],['bar','\uD83C\uDF78 Bar'],['bediening','\uD83E\uDDFE '+T('kt.bediening','Bediening')],['party','\uD83C\uDF9F Party manager'],['alle','\uD83D\uDCE2 '+T('rs.all','Iedereen')]];
        return '<div class="tkc'+(e.published?'':' dim')+'" style="grid-column:1/-1;"><div class="tkc-top"><span style="font-weight:600;">'+e.name+'</span><span class="tkc-age">'+e.date+(e.time?' \u00b7 '+e.time:'')+'</span></div>'+
        '<div class="tkc-who">'+taken+' / '+e.capacity+' '+T('ev.signedup','aangemeld')+(e.price?' \u00b7 '+eur(e.price)+' p.p.':'')+(e.published?'':' \u00b7 '+T('ev.concept','concept'))+'</div>'+
        '<h3 style="margin-top:0.4rem;">\uD83D\uDC68\u200D\uD83C\uDF73 '+T('ek.h','Event-keuken')+'</h3>'+
        '<div class="st-form"><select class="st-in" id="kcm'+e.id+'">'+
          '<option value="geen"'+(e.catering.mode==='geen'?' selected':'')+'>'+T('ek.none','Geen eten / n.v.t.')+'</option>'+
          '<option value="menu"'+(e.catering.mode==='menu'?' selected':'')+'>'+T('ek.menu','Vast menu')+'</option>'+
          '<option value="alacarte"'+(e.catering.mode==='alacarte'?' selected':'')+'>\u00c0 la carte</option></select>'+
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">'+(state.menu||[]).filter(m=>m.station!=='bar').map(m=>
          '<button class="mn-station'+(e.catering.itemIds.includes(m.id)?'" style="border-color:var(--gold);color:var(--gold);':'"')+'" data-kdish="'+m.id+'" data-ev="'+e.id+'">'+m.name+'</button>').join('')+'</div>'+
        '<button class="obtn" data-kcat="'+e.id+'">'+T('ek.save','Bewaar de eventkeuken')+'</button></div>'+
        '<div class="st-form" style="margin-top:0.5rem;">'+
        ((e.allergies||[]).map(a=>'<div class="st-row"><span>\u26a0 '+a.allergen+' ('+a.count+'\u00d7)'+
          (a.alternative?'<span class="sub">\u2192 '+a.alternative.name+'</span>':'')+'</span>'+
          '<span class="acts">'+(!a.alternative?'<button class="obtn primary" data-kalt="'+e.id+'" data-al="'+a.id+'">\u2728 '+T('ek.alt','Vervangend gerecht')+'</button>':'')+
          '<button class="obtn warn" data-kaldel="'+e.id+'" data-al="'+a.id+'">\u2715</button></span></div>').join(''))+
        '<div class="row-gap"><input class="st-in" id="kaN'+e.id+'" placeholder="'+T('ek.allergen','Allergeen, bijv. noten')+'" style="flex:2;"><input class="st-in" id="kaC'+e.id+'" type="number" placeholder="1\u00d7" style="flex:1;"></div>'+
        '<button class="obtn" data-kaladd="'+e.id+'">'+T('ek.addal','Allergeen registreren')+'</button>'+
        '<button class="obtn primary" data-kmep="'+e.id+'">\u2728 '+T('ek.mep','Organiseer de mise en place')+'</button></div>'+
        '<h3 style="margin-top:0.6rem;">\uD83D\uDCCB '+T('rs.h','Draaiboek')+' ('+rs.length+')</h3>'+
        (rs.length ? rs.map(it=>'<div class="st-row"><span>'+(it.daysBefore?'<span style="font-size:0.6rem;letter-spacing:0.06em;color:var(--soft);margin-right:0.4rem;">D-'+it.daysBefore+'</span>':'')+'<b style="color:var(--gold);font-variant-numeric:tabular-nums;margin-right:0.6rem;">'+it.time+'</b>'+(RUN_ICON[it.station]||'')+' '+it.text+(it.done?' <span class="sub" style="display:inline;">\u2713 '+(it.doneBy||'')+'</span>':'')+'</span>'+
          '<button class="obtn warn" data-krdel="'+e.id+'" data-item="'+it.id+'">\u2715</button></div>').join('')
          : '<div class="tkc-who">'+T('rs.none','Nog geen draaiboek. Voer regels in, plak een bestaand draaiboek, of laat de AI er een opstellen.')+'</div>')+
        '<div class="st-form"><div class="row-gap"><input class="st-in" type="time" id="krT'+e.id+'" style="flex:1;">'+
        '<select class="st-in" id="krD'+e.id+'" style="flex:1;"><option value="0">'+T('rs.d0','Dag zelf')+'</option><option value="1">D-1</option><option value="2">D-2</option><option value="3">D-3</option></select>'+
        '<select class="st-in" id="krS'+e.id+'" style="flex:1.4;">'+stOpts.map(o=>'<option value="'+o[0]+'">'+o[1]+'</option>').join('')+'</select></div>'+
        '<input class="st-in" id="krX'+e.id+'" placeholder="'+T('rs.what','Wat moet er gebeuren?')+'">'+
        '<button class="obtn" data-kradd="'+e.id+'">'+T('rs.add','Regel toevoegen')+'</button></div>'+
        '<div class="st-form" style="margin-top:0.7rem;">'+
        '<textarea class="st-in" id="krP'+e.id+'" placeholder="'+T('rs.paste','Plak hier een bestaand draaiboek (per regel een tijd en taak), of kies een bestand...')+'" style="min-height:64px;resize:vertical;"></textarea>'+
        '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">'+
        '<label class="obtn" style="cursor:pointer;">\uD83D\uDCC4 '+T('rs.upload','Upload bestand')+'<input type="file" accept=".txt,.csv,.md,text/plain" data-krfile="'+e.id+'" style="display:none;"></label>'+
        '<button class="obtn" data-krimp="'+e.id+'">'+T('rs.import','Verwerk met AI')+'</button>'+
        '<button class="obtn primary" data-krai="'+e.id+'">\u2728 '+T('rs.suggest','Laat de AI een draaiboek opstellen')+'</button></div></div>'+
        '<div class="tkc-act" style="margin-top:0.7rem;"><button class="'+(e.published?'tkc-start':'tkc-ready')+'" data-kevpub="'+e.id+'">'+(e.published?T('kt.ev.offline','Haal offline'):T('kt.ev.publish','Publiceer voor leden'))+'</button>'+
        '<button class="tkc-start" data-kevdel="'+e.id+'" style="flex:0 0 auto;">\u2715</button></div></div>';
      }).join('');
    }
    if (kantoorSec === 'kamers'){
      const rooms = state.rooms || [];
      const unit = type === 'apartment' ? T('kt.unit','verblijf') : T('kt.kamer','kamer');
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+(type==='apartment'?'🏡 '+T('kt.units','Verblijven'):'🛏 '+T('kt.kamers','Kamers'))+' ('+rooms.length+')</h3>'+
        (rooms.length ? rooms.map(r => {
          const hk = (r.hk && r.hk.status) || 'schoon';
          return '<div class="st-row"><span>'+r.name+(r.available?'':' · '+T('kt.offline','offline'))+
            '<span class="sub">'+eur(r.price)+' '+T('sup.pernight','p.n.')+' · '+tHk(hk)+(hk==='defect'&&r.hk&&r.hk.note?' · ⚠ '+r.hk.note:'')+'</span></span>'+
            '<span class="acts"><button class="obtn'+(r.available?' primary':' warn')+'" data-kmrt="'+r.id+'">'+(r.available?T('kt.isopen','Open'):T('kt.isclosed','Dicht'))+'</button>'+
            '<button class="obtn" data-kmhk="'+r.id+'" data-cur="'+hk+'">🧹 '+tHk(hk)+'</button>'+
            '<button class="obtn warn" data-kmrd="'+r.id+'">✕</button></span></div>';
        }).join('') : '<div class="tkc-who">'+T('sup.norooms','Nog geen kamers. Voeg uw eerste kamer toe.')+'</div>')+
        '<div class="st-form"><div class="row-gap"><input class="st-in" id="kRmN" placeholder="'+T('sup.roomname','Kamernaam')+'" style="flex:2;"><input class="st-in" id="kRmP" type="number" inputmode="decimal" placeholder="€" style="flex:1;"></div>'+
        '<button class="bigbtn" id="kRmAdd" style="margin-top:0.2rem;">'+(type==='apartment'?T('kt.unitadd','Verblijf toevoegen'):T('kt.kameradd','Kamer toevoegen'))+'</button></div>'+
        '<div class="tkc-who">'+T('kt.hknote','Tik op de bezem om de housekeeping-status door te schakelen; Dicht = direct onzichtbaar voor gasten.')+'</div></div>';
    }
    if (kantoorSec === 'minibar'){
      const cat = (state.minibar && state.minibar.catalog) || [];
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>🧊 '+T('kt.mbcat','Minibar-catalogus')+' ('+cat.length+')</h3>'+
        (cat.length ? cat.map(m=>'<div class="st-row"><span>'+m.name+'<span class="sub">'+eur(m.price)+'</span></span>'+
          '<button class="obtn warn" data-kmbd="'+m.id+'">✕</button></div>').join('')
        : '<div class="tkc-who">'+T('kt.nomb','Nog geen artikelen in de minibar.')+'</div>')+
        '<div class="st-form"><div class="row-gap"><input class="st-in" id="kMbN" placeholder="'+T('mb.newitem','Nieuw artikel')+'" style="flex:2;"><input class="st-in" id="kMbP" type="number" inputmode="decimal" placeholder="€" style="flex:1;"></div>'+
        '<button class="bigbtn" id="kMbAdd" style="margin-top:0.2rem;">'+T('team.add','Toevoegen')+'</button></div>'+
        '<div class="tkc-who">'+T('kt.mbnote','De telling per kamer doet housekeeping in het tabblad Minibar; hier beheert u het assortiment en de prijzen.')+'</div></div>';
    }
    if (kantoorSec === 'deuren'){
      const doors = state.doors || [];
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>🚪 '+T('kt.deuren','Deuren')+'</h3>'+
        (doors.length ? doors.map(d=>'<div class="st-row"><span>'+(d.locked?'🔒':'🔓')+' '+d.name+
          '<span class="sub">'+(d.locked?T('door.locked','Vergrendeld'):T('door.open','OPEN, vergrendelt zichzelf'))+(d.lastBy?' · '+T('door.lastby','laatst:')+' '+d.lastBy:'')+'</span></span>'+
          '<button class="obtn'+(d.locked?' primary':' warn')+'" data-kdoor="'+d.id+'">'+(d.locked?T('door.openbtn','Open 10 sec'):T('door.lockbtn','Vergrendel nu'))+'</button></div>').join('')
        : '<div class="tkc-who">'+T('door.none','Nog geen digitale deuren gekoppeld.')+'</div>')+
        '<div class="tkc-who">'+T('door.note','Elke opening komt in de activiteitenfeed: wie, welke deur, wanneer. Gearriveerde gasten kunnen de voordeur zelf openen via hun app.')+'</div></div>';
    }
    if (kantoorSec === 'ritten'){
      // dispatch: open ritten toewijzen (slim voorstel met een tik), lopende ritten volgen
      const ritten = state.rides || [];
      const straks2 = r => r.plannedFor && (new Date(r.plannedFor) - Date.now()) > 45 * 60000;
      const alleOpenK = ritten.filter(r => r.status === 'aangevraagd' && !r.driver);
      const open = alleOpenK.filter(r => !straks2(r));
      const geplandK = alleOpenK.filter(straks2);
      const bezig = ritten.filter(r => !RIT_KLAAR(r.status) && (r.driver || r.status !== 'aangevraagd'));
      const chauffeurs = (state.staff||[]);
      const wagens = (state.fleet||[]).filter(v=>v.active);
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>🗺 '+T('kt.openritten','Open aanvragen')+' ('+open.length+')</h3>'+
        (open.length ? open.map(r =>
          '<div class="st-row" style="flex-wrap:wrap;"><span>'+r.customerCodename+'<span class="sub">'+(r.from||'')+' → '+(r.to||'?')+' · '+ritRegel(r)+' · '+r.when+'</span></span>'+
          '<span class="acts" style="flex-wrap:wrap;">'+
            '<select class="st-in" data-ktch="'+r.ref+'" style="width:auto;padding:0.45rem 0.6rem;">'+chauffeurs.map(m=>'<option value="'+m.id+'">'+m.name+'</option>').join('')+'</select>'+
            '<select class="st-in" data-ktvg="'+r.ref+'" style="width:auto;padding:0.45rem 0.6rem;">'+wagens.map(v=>'<option value="'+v.id+'">'+v.name+'</option>').join('')+'</select>'+
            '<button class="obtn primary" data-ktwijs="'+r.ref+'">'+T('kt.wijs','Wijs toe')+'</button>'+
            '<button class="obtn" data-ktslim="'+r.ref+'">✨ '+T('kt.slim','Slim')+'</button></span></div>'
        ).join('') : '<div class="tkc-who">'+T('kt.geenopen','Geen open aanvragen.')+'</div>')+'</div>';
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>📅 '+T('kt.gepland','Gepland')+' ('+geplandK.length+')</h3>'+
        (geplandK.length ? geplandK.map(r =>
          '<div class="st-row" style="flex-wrap:wrap;"><span>'+r.customerCodename+'<span class="sub">'+(r.from||'')+' → '+(r.to||'?')+' · '+ritRegel(r)+' · <b>'+r.when+'</b></span></span>'+
          '<span class="acts" style="flex-wrap:wrap;">'+
            '<select class="st-in" data-ktch="'+r.ref+'" style="width:auto;padding:0.45rem 0.6rem;">'+chauffeurs.map(m=>'<option value="'+m.id+'">'+m.name+'</option>').join('')+'</select>'+
            '<select class="st-in" data-ktvg="'+r.ref+'" style="width:auto;padding:0.45rem 0.6rem;">'+wagens.map(v=>'<option value="'+v.id+'">'+v.name+'</option>').join('')+'</select>'+
            '<button class="obtn primary" data-ktwijs="'+r.ref+'">'+T('kt.wijs','Wijs toe')+'</button>'+
            '<button class="obtn" data-ktslim="'+r.ref+'">✨ '+T('kt.slim','Slim')+'</button></span></div>'
        ).join('') : '<div class="tkc-who">'+T('kt.nietsgepland','Geen geplande ritten. Leden kunnen ritten dagen vooruit boeken.')+'</div>')+'</div>';
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('kt.lopend','Lopend')+' ('+bezig.length+')</h3>'+
        (bezig.length ? bezig.map(r =>
          '<div class="st-row"><span>'+r.customerCodename+' · '+tStatus(r.status)+
          '<span class="sub">'+(r.driver?r.driver.name:'?')+(r.vehicle?' · '+r.vehicle.name:'')+' · '+(r.to||'?')+' · '+(r.quote?eur(r.quote):'')+'</span></span></div>'
        ).join('') : '<div class="tkc-who">'+T('kt.geenlopend','Niets onderweg.')+'</div>')+'</div>';
    }
    if (kantoorSec === 'historie'){
      // ritgeschiedenis: gepagineerd en doorzoekbaar via de server, zodat dit
      // scherm er hetzelfde uitziet met tien of tien miljoen afgeronde ritten
      if (!histData){
        laadHistorie();
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>📒 '+T('kt.historie','Historie')+'</h3><div class="tkc-who">'+T('kt.laden','Laden...')+'</div></div>';
      } else {
        const h = histData;
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>📒 '+T('kt.historie','Historie')+' ('+h.total+')</h3>'+
          '<div class="tkc-who">'+T('kt.omzet','Totale ritomzet')+': <b style="color:var(--gold);">'+eur(h.omzet)+'</b> · '+T('kt.nulcom','RTG rekent 0% commissie.')+'</div>'+
          '<div style="display:flex;gap:0.5rem;margin:0.5rem 0;"><input class="st-in" id="ktHz" placeholder="'+T('kt.zoekrit','Zoek op gast, referentie of chauffeur')+'" value="'+histQ.replace(/"/g,'&quot;')+'" style="flex:1;">'+
          '<button class="obtn" id="ktHzGo">🔍 '+T('kt.zoek','Zoek')+'</button></div>'+
          (h.items.length ? h.items.map(r =>
            '<div class="st-row"><span>'+r.customerCodename+'<span class="sub">'+(r.from||'')+' → '+(r.to||'?')+' · '+ritRegel(r)+' · '+String(r.finishedAt||r.at).slice(0,16).replace('T',' ')+(r.driver?' · '+r.driver.name:'')+'</span></span>'+
            '<b style="color:var(--gold);">'+(r.quote?eur(r.quote):'')+'</b></div>'
          ).join('') : '<div class="tkc-who">'+(histQ ? T('kt.nietsgevonden','Niets gevonden voor deze zoekopdracht.') : T('kt.geenhistorie','Nog geen afgeronde ritten.'))+'</div>')+
          (h.pages > 1 ? '<div style="display:flex;align-items:center;justify-content:center;gap:0.9rem;margin-top:0.6rem;">'+
            '<button class="obtn" data-khist="-1"'+(h.page<=1?' disabled':'')+'>‹</button>'+
            '<span class="tkc-who" style="margin:0;">'+T('kt.pagina','Pagina')+' '+h.page+' / '+h.pages+'</span>'+
            '<button class="obtn" data-khist="1"'+(h.page>=h.pages?' disabled':'')+'>›</button></div>' : '')+
          (h.total ? '<div class="st-form"><button class="bigbtn" id="ktCsv">⬇ '+T('kt.csv','Exporteer alles als CSV')+' ('+h.total+')</button></div>' : '')+'</div>';
      }
    }
    if (kantoorSec === 'vloot'){
      const wagens = state.fleet || [];
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+(type==='jet'?'✈️ '+T('kt.vloot','Vloot'):'🚘 '+T('kt.vloot','Vloot'))+' ('+wagens.length+')</h3>'+
        (wagens.length ? wagens.map(v =>
          '<div class="st-row"><span>'+v.name+(v.active?'':' · '+T('kt.offline','offline'))+'<span class="sub">'+(v.plate||'')+' · '+v.seats+' '+T('tbl.pers','pers.')+'</span></span>'+
          '<span class="acts"><button class="obtn'+(v.active?' primary':' warn')+'" data-ktvt="'+v.id+'">'+(v.active?T('kt.isopen','Open'):T('kt.isclosed','Dicht'))+'</button>'+
          '<button class="obtn warn" data-ktvd="'+v.id+'">✕</button></span></div>'
        ).join('') : '<div class="tkc-who">'+T('kt.geenvloot','Nog geen voertuigen.')+'</div>')+
        '<div class="st-form"><input class="st-in" id="ktVn" placeholder="'+T('kt.vnaam','Naam, bijv. Mercedes S-klasse')+'">'+
        '<div class="row-gap"><input class="st-in" id="ktVp" placeholder="'+T('kt.kenteken','Kenteken / registratie')+'" style="flex:2;"><input class="st-in" id="ktVs" type="number" placeholder="4" style="flex:1;"></div>'+
        '<button class="bigbtn" id="ktVAdd" style="margin-top:0.2rem;">'+T('kt.vadd','Voertuig toevoegen')+'</button></div></div>';
    }
    if (kantoorSec === 'tarief'){
      const t2 = (state.settings && state.settings.tarief) || {};
      html += '<div class="tkc"><h3>🧮 '+T('kt.tarief','Tarief')+'</h3>'+
        '<div class="tkc-who">'+T('kt.tarief.s','Elke aanvraag krijgt hiermee direct een vaste nettoprijs voor het lid; u houdt 100%.')+'</div>'+
        '<div class="st-form">'+
        '<label class="soft-xs">'+T('kt.start','Starttarief (€)')+'</label><input class="st-in" id="ktTa" type="number" step="0.1" value="'+(t2.start||0)+'">'+
        '<label class="soft-xs">'+T('kt.perkm','Per kilometer (€)')+'</label><input class="st-in" id="ktTb" type="number" step="0.1" value="'+(t2.perKm||0)+'">'+
        '<label class="soft-xs">'+T('kt.min','Minimumprijs (€)')+'</label><input class="st-in" id="ktTc" type="number" step="1" value="'+(t2.minimum||0)+'">'+
        '<button class="bigbtn" id="ktTSave" style="margin-top:0.2rem;">'+T('kt.tsave','Tarief opslaan')+'</button></div></div>';
    }
    if (kantoorSec === 'diensten'){
      // het aanbod van de zelfstandige: diensten en producten, eigen beheer
      const sv = state.services || [];
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>🗂️ '+T('kt.aanbod','Uw diensten en producten')+' ('+sv.length+')</h3>'+
        (sv.length ? sv.map(x =>
          '<div class="st-row"><span>'+(x.soort==='product'?'📦':'🗓️')+' '+x.name+'<span class="sub">'+(x.desc||'')+(x.duurMin?' · '+x.duurMin+' min':'')+'</span></span>'+
          '<span class="acts"><b style="color:var(--gold);margin-right:0.4rem;">'+eur(x.price)+'</b><button class="obtn warn" data-svdel="'+x.id+'">✕</button></span></div>').join('')
          : '<div class="tkc-who">'+T('kt.geenaanbod','Nog geen aanbod. Voeg hieronder uw eerste dienst of product toe.')+'</div>')+
        '<div class="st-form"><input class="st-in" id="svNaam" placeholder="'+T('kt.svnaam','Naam, bijv. Personal styling')+'">'+
        '<input class="st-in" id="svDesc" placeholder="'+T('kt.svdesc','Korte omschrijving')+'">'+
        '<div class="row-gap"><input class="st-in" id="svPrijs" type="number" placeholder="€" style="flex:1;">'+
        '<input class="st-in" id="svDuur" type="number" placeholder="'+T('kt.svduur','min.')+'" style="flex:1;">'+
        '<select class="st-in" id="svSoort" style="flex:1;"><option value="dienst">'+T('kt.svdienst','Dienst')+'</option><option value="product">'+T('kt.svproduct','Product')+'</option></select></div>'+
        '<button class="bigbtn" id="svAdd" style="margin-top:0.2rem;">'+T('kt.svadd','Zet in de RTG-app')+'</button></div>'+
        '<div class="tkc-who">'+T('kt.svnote','Leden zien dit direct in de app en boeken met datum en tijd; u houdt 100% van de prijs.')+'</div></div>';
    }
    if (kantoorSec === 'prijzen'){
      const h = state.prices || [];
      html += '<div class="tkc"><h3>💶 '+T('kt.newprice','Prijs doorgeven aan RTG')+'</h3>'+
        '<div class="st-form"><input class="st-in" id="kPrS" placeholder="'+T('kt.service','Dienst, bijv. Luchthaven, centrum')+'">'+
        '<input class="st-in" id="kPrP" type="number" inputmode="decimal" placeholder="€">'+
        '<button class="bigbtn" id="kPrSend" style="margin-top:0.2rem;">'+T('kt.sendprice','Verstuur naar RTG')+'</button></div>'+
        '<div class="tkc-who">'+T('kt.pricenote','RTG-leden betalen uw nettoprijs; u ontvangt altijd het volledige bedrag, RTG rekent 0% commissie.')+'</div></div>';
      html += '<div class="tkc"><h3>'+T('sup.pricehist','Eerder doorgegeven')+'</h3>'+
        (h.length ? h.slice(0,10).map(p=>'<div class="st-row"><span>'+p.service+'<span class="sub">'+timeAgo(p.at)+'</span></span><b style="color:var(--gold);">'+eur(p.price)+'</b></div>').join('')
        : '<div class="tkc-who">'+T('sup.noprices','Nog geen prijzen doorgegeven.')+'</div>')+'</div>';
    }
    if (kantoorSec === 'marketing'){
      const photos = state.photos || [];
      html += '<div class="tkc"><h3>📷 '+T('sup.photos','Foto\'s op uw pagina')+' ('+photos.length+'/6)</h3>'+
        '<div class="ph-grid" style="margin-top:0.5rem;">'+
        photos.map((p,i)=>'<div class="ph"><img src="'+p+'" alt=""><button data-kphd="'+i+'">✕</button></div>').join('')+
        (photos.length<6?'<label class="ph add">+<input type="file" id="kPhFile" accept="image/jpeg,image/png,image/webp" style="display:none;"></label>':'')+
        '</div><div class="tkc-who">'+T('sup.photonote','Gasten zien deze foto\'s in de RTG-app bij uw pagina, direct na plaatsen.')+'</div></div>';
      html += '<div class="tkc"><h3>📣 '+T('sup.salonpub','Publiceer op De Salon')+'</h3>'+
        '<div class="st-form"><textarea class="st-in" id="kSpText" placeholder="'+T('kt.salonph','Vertel RTG-leden over uw nieuwste aanbod, suite of avond...')+'" style="min-height:70px;resize:vertical;"></textarea>'+
        (photos.length?'<div class="ph-pick">'+photos.map((p,i)=>'<img src="'+p+'" data-kpick="'+i+'" alt="">').join('')+'</div>':'')+
        '<button class="bigbtn" id="kSpPost">'+T('sup.salonpost','Publiceer als RTG-partner')+'</button></div>'+
        '<div class="tkc-who">'+T('sup.salonnote','Uw bericht staat er direct, zonder wachttijd (de 7-dagen-regel geldt alleen voor leden). Alle leden zien het met uw bedrijfsnaam als partner; uw volgers krijgen een melding.')+'</div></div>';
      // het verplichte Salon-bedrijfsaccount met marketinggereedschap en cijfers
      if (!mktData){
        laadMarketing();
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>✦ '+T('mk.salon','Uw Salon-bedrijfsaccount')+'</h3><div class="tkc-who">'+T('kt.laden','Laden...')+'</div></div>';
      } else if (mktData.error){
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>✦ '+T('mk.salon','Uw Salon-bedrijfsaccount')+'</h3><div class="tkc-who">'+mktData.error+'</div></div>';
      } else {
        const mk = mktData;
        if (mktMsg){ html += '<div class="tkc" style="grid-column:1/-1;border-color:var(--gold);">'+mktMsg+'</div>'; }
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>✦ '+T('mk.salon','Uw Salon-bedrijfsaccount')+'</h3>'+
          '<div class="tkc-who">'+T('mk.salon.s','Vast onderdeel van uw RTG-partnerschap: leden volgen uw zaak en krijgen een melding bij elk bericht.')+'</div>'+
          '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.55rem;">'+
          [[T('mk.volgers','Volgers'), mk.volgers], [T('mk.posts','Berichten'), mk.posts], ['Likes', mk.likes], [T('mk.reacties','Reacties'), mk.reacties]]
          .map(x => '<div style="background:rgba(255,255,255,0.04);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;text-align:center;">'+
            '<div style="font-family:\'Bodoni Moda\',serif;font-size:1.25rem;color:var(--gold);">'+x[1]+'</div>'+
            '<div style="font-size:0.54rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);margin-top:0.1rem;">'+x[0]+'</div></div>').join('')+'</div>'+
          '<div class="st-form"><textarea class="st-in" id="mkBio" placeholder="'+T('mk.bioph','Uw bio op De Salon, bijv. aan zee sinds 1998, drie generaties.')+'" style="min-height:52px;resize:vertical;">'+(mk.bio||'')+'</textarea>'+
          '<button class="obtn primary" id="mkBioSave" style="align-self:flex-start;">'+T('mk.biosave','Bio opslaan')+'</button></div></div>';
        html += '<div class="tkc"><h3>🎁 '+T('mk.deal','Exclusieve aanbieding')+'</h3>'+
          '<div class="tkc-who">'+T('mk.deal.s','Alleen voor leden; zij claimen met een persoonlijke code die u aan de kassa verzilvert. Pure klantbinding.')+'</div>'+
          '<div class="st-form"><input class="st-in" id="mkDt" placeholder="'+T('mk.dealtitel','Titel, bijv. Amuse van het huis')+'">'+
          '<input class="st-in" id="mkDx" placeholder="'+T('mk.dealtekst','Tekst, bijv. Bij elk diner deze maand')+'">'+
          '<input class="st-in" id="mkDg" type="date">'+
          '<button class="bigbtn" id="mkDealGo">'+T('mk.dealgo','Zet op De Salon')+'</button></div>'+
          (mk.deals.length ? mk.deals.map(d2 =>
            '<div class="st-row"><span>'+d2.titel+'<span class="sub">'+(d2.geldigTot?'t/m '+d2.geldigTot+' · ':'')+d2.claims+' '+T('mk.claims','geclaimd')+' · '+d2.verzilverd+' '+T('mk.verzilverd','verzilverd')+'</span></span></div>').join('') : '')+
          '<div style="display:flex;gap:0.5rem;margin-top:0.4rem;"><input class="st-in" id="mkCode" placeholder="RTG-D-XXXXXX" style="flex:1;">'+
          '<button class="obtn" id="mkRedeem">'+T('mk.innen','Verzilver')+'</button></div></div>';
        html += '<div class="tkc"><h3>📊 '+T('mk.poll','Vraag het uw leden (poll)')+'</h3>'+
          '<div class="tkc-who">'+T('mk.poll.s','Marketinginzicht: laat leden kiezen en zie live de uitslag.')+'</div>'+
          '<div class="st-form"><input class="st-in" id="mkPv" placeholder="'+T('mk.pollvraag','Vraag, bijv. welk menu in december?')+'">'+
          '<input class="st-in" id="mkP1" placeholder="'+T('mk.optie','Optie')+' 1"><input class="st-in" id="mkP2" placeholder="'+T('mk.optie','Optie')+' 2"><input class="st-in" id="mkP3" placeholder="'+T('mk.optie','Optie')+' 3 ('+T('mk.optioneel','optioneel')+')">'+
          '<button class="bigbtn" id="mkPollGo">'+T('mk.pollgo','Plaats de poll')+'</button></div>'+
          (mk.polls.length ? mk.polls.map(pl =>
            '<div style="margin-top:0.4rem;"><div class="tkc-who" style="color:var(--txt);">'+pl.vraag+'</div>'+
            pl.opties.map(o => '<div class="st-row" style="padding:0.3rem 0;"><span class="sub">'+o.tekst+'</span><b style="color:var(--gold);">'+o.stemmen+'</b></div>').join('')+'</div>').join('') : '')+'</div>';
      }
    }
    return html;
  }

  function bindKantoor(el){
    el.querySelectorAll('[data-ksec]').forEach(b => b.addEventListener('click', () => { kantoorSec = b.dataset.ksec; kantoorMsg=''; histData = null; histPage = 1; boData = null; finData = null; finMsg = ''; mktData = null; mktMsg = ''; invData = null; renderStation(); }));
    // Salon-bedrijfsaccount: bio, aanbiedingen (plaatsen en verzilveren) en polls
    const mkB = el.querySelector('#mkBioSave'); if (mkB) mkB.addEventListener('click', async () => {
      try { await API.call('/supplier/salon/bio', { bio: el.querySelector('#mkBio').value }); mktMsg = '✅ '+T('mk.bioklaar','Bio opgeslagen.'); mktData = null; renderStation(); } catch(e){ toast(e.message); }
    });
    const mkD = el.querySelector('#mkDealGo'); if (mkD) mkD.addEventListener('click', async () => {
      try {
        await API.call('/supplier/salon/deal', { titel: el.querySelector('#mkDt').value, text: el.querySelector('#mkDx').value, geldigTot: el.querySelector('#mkDg').value });
        mktMsg = '🎁 '+T('mk.dealklaar','Aanbieding staat op De Salon; uw volgers hebben een melding gekregen.');
        mktData = null;
        renderStation();
      } catch(e){ toast(e.message); }
    });
    const mkR = el.querySelector('#mkRedeem'); if (mkR) mkR.addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/salon/deal/redeem', { code: el.querySelector('#mkCode').value });
        mktMsg = '✅ '+T('mk.geind','Verzilverd:')+' <b>'+d.titel+'</b> · '+d.codename;
        mktData = null;
        renderStation();
      } catch(e){ toast(e.message); }
    });
    const mkP = el.querySelector('#mkPollGo'); if (mkP) mkP.addEventListener('click', async () => {
      try {
        await API.call('/supplier/salon/poll', { vraag: el.querySelector('#mkPv').value,
          opties: [el.querySelector('#mkP1').value, el.querySelector('#mkP2').value, el.querySelector('#mkP3').value].filter(x => x && x.trim()) });
        mktMsg = '📊 '+T('mk.pollklaar','Poll staat op De Salon.');
        mktData = null;
        renderStation();
      } catch(e){ toast(e.message); }
    });
    // boekhouding: land en uurloon opslaan, cadeaukaarten en de AI-boekhouder
    const fnS = el.querySelector('#fnSave'); if (fnS) fnS.addEventListener('click', async () => {
      try {
        await API.call('/supplier/settings', { land: el.querySelector('#fnLand').value, uurloon: Number(el.querySelector('#fnUur').value) });
        finData = null; finMsg = '';
        await refresh();
      } catch(e){ toast(e.message); }
    });
    const fnP = el.querySelector('#fnPdf'); if (fnP) fnP.addEventListener('click', () => dlBestand('/supplier/finance/export', { formaat: 'pdf' }, 'RTG-boekhouding.pdf'));
    const fnC = el.querySelector('#fnCsv'); if (fnC) fnC.addEventListener('click', () => dlBestand('/supplier/finance/export', { formaat: 'csv' }, 'RTG-boekhouding.csv'));
    const gS = el.querySelector('#gcSell'); if (gS) gS.addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/giftcard/sell', { bedrag: Number(el.querySelector('#gcBedrag').value) });
        finMsg = '🎁 '+T('fn.gcklaar','Cadeaukaart verkocht. Geef deze code mee:')+' <b style="color:var(--gold);">'+d.kaart.code+'</b> (€ '+d.kaart.bedrag+')';
        finData = null;
        renderStation();
      } catch(e){ toast(e.message); }
    });
    const gR = el.querySelector('#gcRedeem'); if (gR) gR.addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/giftcard/redeem', { code: el.querySelector('#gcCode').value, bedrag: Number(el.querySelector('#gcInBedrag').value) });
        finMsg = '✅ '+T('fn.gcgeind','Ingewisseld. Restsaldo op de kaart:')+' <b style="color:var(--gold);">€ '+d.saldo+'</b>';
        finData = null;
        renderStation();
      } catch(e){ toast(e.message); }
    });
    const aG = el.querySelector('#accGo'); if (aG) aG.addEventListener('click', async () => {
      const q = el.querySelector('#accQ').value.trim();
      if (!q) return;
      accAntwoord = '…';
      renderStation();
      try { accAntwoord = esc((await API.call('/supplier/accountant', { question: q })).answer); }
      catch(e){ accAntwoord = esc(e.message); }
      renderStation();
    });
    const aQ = el.querySelector('#accQ'); if (aQ) aQ.addEventListener('keydown', e => { if (e.key === 'Enter' && aG) aG.click(); });
    // branchevragen als klikbare chips
    const vBox = el.querySelector('#accVragen');
    if (vBox) API.call('/supplier/accountant/vragen', {}).then(d => {
      vBox.innerHTML = (d.vragen || []).map(q => '<button class="obtn js-accv" style="font-size:0.72rem;padding:0.3rem 0.7rem;">' + esc(q) + '</button>').join('');
      vBox.querySelectorAll('.js-accv').forEach(b => b.addEventListener('click', () => { const q = el.querySelector('#accQ'); q.value = b.textContent; if (aG) aG.click(); }));
    }).catch(() => {});
    // proactieve adviezen op de eigen cijfers
    const adv = el.querySelector('#accAdvies');
    if (adv) adv.addEventListener('click', async () => {
      const box = el.querySelector('#accAdv');
      box.innerHTML = '<div class="tkc-who" style="margin-top:0.6rem;">' + T('fn.advbezig', 'Ik kijk naar uw cijfers…') + '</div>';
      try {
        const d = await API.call('/supplier/accountant/adviezen', {});
        box.innerHTML = (d.intro ? '<div style="font-size:0.82rem;margin:0.6rem 0;line-height:1.6;">' + esc(d.intro) + '</div>' : '') +
          (d.adviezen || []).map(a => '<div style="border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.8rem;margin-top:0.5rem;"><b style="color:var(--gold);font-size:0.8rem;">' + esc(a.titel) + '</b><div style="font-size:0.8rem;color:var(--soft);margin-top:0.2rem;line-height:1.5;">' + esc(a.tekst) + '</div></div>').join('');
      } catch(e){ box.innerHTML = '<div class="tkc-who">' + esc(e.message) + '</div>'; }
    });
    // schakelaars van de zaak: elke functie aan of uit, direct doorgevoerd
    wireFuncBlok(el);
    el.querySelectorAll('[data-kopt]').forEach(b => b.addEventListener('click', async () => {
      const k = b.dataset.kopt, v = b.dataset.val === '1';
      b.disabled = true;
      try {
        if (k === 'ordersOpen' || k === 'reservationsOpen') await API.call('/supplier/settings', { [k]: v });
        else await API.call('/supplier/settings', { opties: { [k]: v } });
        boData = null;
        await refresh();
      } catch(e){ toast(e.message); b.disabled = false; }
    }));
    const bb = el.querySelector('#boBrief'); if (bb) bb.addEventListener('click', () => {
      const t2 = el.querySelector('#boBriefTxt');
      if (!t2) return;
      t2.textContent = (boData && boData.briefing) || '';
      t2.style.display = t2.style.display === 'none' ? 'block' : 'none';
    });
    el.querySelectorAll('[data-khire]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/apply/decide', { id: b.dataset.khire, action: 'aannemen' });
        kantoorMsg = '\u2705 '+T('kt.hired','Aangenomen.')+' <b>'+escT(d.invite.naam)+'</b> '+T('kt.hired.geef','meldt zich zelf aan met bedrijfsnaam')+' <b>'+escT(d.bedrijf)+'</b> + '+T('kt.invite.code','Kassacode')+' <b style="color:var(--gold);font-family:monospace;letter-spacing:0.14em;">'+escT(d.invite.kassacode)+'</b>';
        invData = null;
        await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kreset]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/staff/reset-pin', { staffId: b.dataset.kreset });
        kantoorMsg = '\ud83d\udd11 '+T('kt.resetdone','Code gereset voor')+' <b>'+escT(d.staff.name)+'</b> \u00b7 '+T('kt.newpin','nieuwe pincode')+': <b style="color:var(--gold);">'+escT(d.pin)+'</b> ('+T('kt.pinonce','geef eenmalig door')+')';
        await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kinv]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/staff/invite/intrek', { kassacode: b.dataset.kinv });
        invData = null; toast(T('kt.ingetrokken','Uitnodiging ingetrokken.')); renderStation(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kno]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/apply/decide', { id: b.dataset.kno, action: 'afwijzen' }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/staff/remove', { staffId: b.dataset.kdel }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const ktInvite = el.querySelector('#ktInvite'); if (ktInvite) ktInvite.addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/staff/invite', { name: el.querySelector('#ktName').value.trim(), func: el.querySelector('#ktFunc').value.trim(), role: el.querySelector('#ktRole').value });
        kantoorMsg = T('kt.invite.done','Uitnodiging klaar. Geef deze twee dingen door aan uw medewerker:')+'<br>'+
          '<b>'+T('kt.invite.biz','Bedrijfsnaam')+':</b> '+escT(d.bedrijf)+'<br>'+
          '<b>'+T('kt.invite.code','Kassacode')+':</b> <span style="font-family:monospace;font-size:1.25rem;letter-spacing:0.18em;color:var(--gold);">'+escT(d.invite.kassacode)+'</span><br>'+
          '<span class="sub">'+T('kt.invite.note','Eenmalig, 30 dagen geldig.')+'</span>';
        toast(T('kt.invite.toast','Kassacode aangemaakt.'));
        invData = null; laadInvites();
      } catch(e){ toast(e.message); }
    });
    const ktBuzz = el.querySelector('#ktBuzz'); if (ktBuzz) ktBuzz.addEventListener('click', async () => {
      try { await API.call('/supplier/team/buzz', { all: true }); toast(T('kt.buzzed','Iedereen opgeroepen.')); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-kst]').forEach(b => b.addEventListener('click', async () => {
      const menu = (state.menu||[]).map(x => x.id === b.dataset.kst ? { ...x, station: x.station === 'bar' ? 'keuken' : 'bar' } : x);
      try { await API.call('/supplier/menu', { menu }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // de kaart-bewerker openen/sluiten en opslaan (alles per gerecht, ook het vuurplan)
    el.querySelectorAll('[data-kedit]').forEach(b => b.addEventListener('click', () => {
      kantoorEdit = kantoorEdit === b.dataset.kedit ? null : b.dataset.kedit;
      renderStation();
    }));
    el.querySelectorAll('[data-ksave]').forEach(b => b.addEventListener('click', async () => {
      const form = el.querySelector('[data-kedit-form="'+b.dataset.ksave+'"]'); if (!form) return;
      const v = k => { const inp = form.querySelector('[data-kf="'+k+'"]'); return inp ? inp.value : null; };
      const menu = (state.menu||[]).map(x => {
        if (x.id !== b.dataset.ksave) return x;
        const naam = (v('name')||'').trim();
        return { ...x,
          name: naam || x.name,
          cat: (v('cat')||'').trim() || x.cat,
          price: Number(v('price')) > 0 ? Number(v('price')) : x.price,
          desc: (v('desc')||'').trim(),
          sectie: v('sectie') != null ? v('sectie') : x.sectie,
          prepMin: v('prepMin') != null ? (parseInt(v('prepMin'), 10) || 0) : x.prepMin,
          allergens: v('allergens') != null ? v('allergens').split(',').map(a=>a.trim()).filter(Boolean) : x.allergens
        };
      });
      try { await API.call('/supplier/menu', { menu }); kantoorEdit = null; toast(T('kt.m.saved','Kaart bijgewerkt; het vuurplan rekent er direct mee.')); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kmdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/menu', { menu: (state.menu||[]).filter(x=>x.id!==b.dataset.kmdel) }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const ktM = el.querySelector('#ktMAdd'); if (ktM) ktM.addEventListener('click', async () => {
      const name = el.querySelector('#ktMn').value.trim(), price = Number(el.querySelector('#ktMp').value);
      if (!name || !(price>0)){ toast(T('menu.fill','Vul een naam en prijs in.')); return; }
      const item = { id: 'm'+Date.now().toString(36), cat: el.querySelector('#ktMc').value.trim()||T('menu.other','Overig'), name, desc:'', price, allergens:[], station: kantoorSec };
      try { await API.call('/supplier/menu', { menu: [...(state.menu||[]), item] }); await refresh(); } catch(e){ toast(e.message); }
    });
    // de AI-bedrijfsagent: koppelen, inkoop voorstellen, goedkeuren/aanpassen/afwijzen, rooster
    const agK = el.querySelector('#agKoppel'); if (agK) agK.addEventListener('click', async () => {
      try { await API.call('/supplier/agent/koppel', { groothandelCode: el.querySelector('#agGh').value, auto: el.querySelector('#agAuto').checked }); agentData = null; toast(T('ag2.gekoppeld','Vaste leverancier bijgewerkt.')); renderStation(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-agweg]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/agent/koppel', { groothandelCode: b.dataset.agweg, weg: true }); agentData = null; toast(T('ag2.los','Groothandel losgekoppeld.')); renderStation(); } catch(e){ toast(e.message); }
    }));
    const agS = el.querySelector('#agStel'); if (agS) agS.addEventListener('click', async () => {
      try { await API.call('/supplier/agent/voorstel', {}); agentData = null; renderStation(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-agok]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.agok;
      const regels = [...el.querySelectorAll('[data-agr="'+id+'"]')].map(inp => ({ productId: inp.dataset.pid, aantal: inp.value }));
      try { const d = await API.call('/supplier/agent/beslis', { id, actie: 'akkoord', regels }); toast('✔ '+T('ag2.besteld','Besteld bij de leverancier')+(d.order?' ('+d.order.ref+')':'')); agentData = null; renderStation(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-agnee]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/agent/beslis', { id: b.dataset.agnee, actie: 'afwijzen' }); agentData = null; renderStation(); } catch(e){ toast(e.message); }
    }));
    const agR = el.querySelector('#agRooster'); if (agR) agR.addEventListener('click', async () => {
      try { await API.call('/supplier/rooster/voorstel', {}); agentData = null; renderStation(); } catch(e){ toast(e.message); }
    });
    const agRok = el.querySelector('#agRoosterOk'); if (agRok) agRok.addEventListener('click', async () => {
      try { await API.call('/supplier/rooster/beslis', { actie: 'akkoord' }); agentData = null; toast(T('ag2.rooster.vastok','Weekrooster vastgesteld.')); renderStation(); } catch(e){ toast(e.message); }
    });
    const agRnee = el.querySelector('#agRoosterNee'); if (agRnee) agRnee.addEventListener('click', async () => {
      try { await API.call('/supplier/rooster/beslis', { actie: 'afwijzen' }); agentData = null; renderStation(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-ktoggle]').forEach(b => b.addEventListener('click', async () => {
      const k = b.dataset.ktoggle, cur = (state.settings||{})[k] !== false;
      try { const body = {}; body[k] = !cur; await API.call('/supplier/settings', body); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ktdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/table/remove', { id: b.dataset.ktdel }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const ktT = el.querySelector('#ktTAdd'); if (ktT) ktT.addEventListener('click', async () => {
      const name = el.querySelector('#ktTn').value.trim(); if(!name){ toast(T('kt.filltafel','Geef de tafel een naam.')); return; }
      try { await API.call('/supplier/table/add', { name, seats: Number(el.querySelector('#ktTs').value)||4 }); await refresh(); } catch(e){ toast(e.message); }
    });
    const kEv = el.querySelector('#kEvAdd'); if (kEv) kEv.addEventListener('click', async () => {
      const name = el.querySelector('#kEvName').value.trim(), date = el.querySelector('#kEvDate').value;
      if (!name || !date){ toast(T('kt.ev.fill','Vul minimaal een naam en datum in.')); return; }
      try { await API.call('/supplier/event', { action:'add', event: { name, date, time: el.querySelector('#kEvTime').value, desc: el.querySelector('#kEvDesc').value.trim(), capacity: Number(el.querySelector('#kEvCap').value)||50, price: Number(el.querySelector('#kEvPrice').value)||0 } });
        kantoorMsg = '\u2705 '+T('kt.ev.made','Event aangemaakt als concept. Publiceer hem zodra hij af is.');
        await refresh(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-kevpub]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/event', { action:'publish', id: b.dataset.kevpub }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kevdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/event', { action:'remove', id: b.dataset.kevdel }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // draaiboek: regel toevoegen / weghalen / plakken / uploaden / AI
    el.querySelectorAll('[data-kradd]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.kradd;
      const text = el.querySelector('#krX'+id).value.trim();
      if (!text){ toast(T('rs.fill','Omschrijf wat er moet gebeuren.')); return; }
      try { await API.call('/supplier/event/runsheet', { id, action:'add', item: { time: el.querySelector('#krT'+id).value || '00:00', station: el.querySelector('#krS'+id).value, text, daysBefore: Number(el.querySelector('#krD'+id).value)||0 } }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // eventkeuken: gerechten aan/uit tikken en bewaren
    el.querySelectorAll('[data-kdish]').forEach(b => b.addEventListener('click', () => {
      const aan = b.style.borderColor !== '';
      b.style.borderColor = aan ? '' : 'var(--gold)';
      b.style.color = aan ? '' : 'var(--gold)';
    }));
    el.querySelectorAll('[data-kcat]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.kcat;
      const itemIds = [...el.querySelectorAll('[data-kdish][data-ev="'+id+'"]')].filter(x => x.style.borderColor !== '').map(x => x.dataset.kdish);
      try { await API.call('/supplier/event/catering', { id, mode: el.querySelector('#kcm'+id).value, itemIds });
        kantoorMsg = '\u2705 '+T('ek.saved','Eventkeuken bewaard; de keuken ziet het direct op het keukenscherm.');
        await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kaladd]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.kaladd;
      const allergen = el.querySelector('#kaN'+id).value.trim();
      if (!allergen){ toast(T('ek.fillallergen','Vul het allergeen in.')); return; }
      try { await API.call('/supplier/event/allergy', { id, action:'add', allergen, count: Number(el.querySelector('#kaC'+id).value)||1 }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kaldel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/event/allergy', { id: b.dataset.kaldel, action:'remove', allergyId: b.dataset.al }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kalt]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = T('ek.thinking','De chef denkt na...');
      try { const d = await API.call('/supplier/event/allergy/alt', { id: b.dataset.kalt, allergyId: b.dataset.al });
        kantoorMsg = '\u2728 '+T('ek.altmade','Vervangend gerecht')+': <b>'+d.alternative.name+'</b>'+(d.alternative.desc?' \u00b7 '+d.alternative.desc:'');
        await refresh(); } catch(e){ toast(e.message); b.disabled = false; }
    }));
    el.querySelectorAll('[data-kmep]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = T('ek.busy','De mise en place wordt georganiseerd...');
      try { const d = await API.call('/supplier/event/mep', { id: b.dataset.kmep });
        kantoorMsg = '\u2705 '+d.added+' '+T('ek.planned2','MEP-taken ingepland (') + d.covers + ' couverts); '+T('ek.onscreen','de keuken ziet ze dagen vooruit op het keukenscherm.');
        await refresh(); } catch(e){ toast(e.message); b.disabled = false; }
    }));
    el.querySelectorAll('[data-krdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/event/runsheet', { id: b.dataset.krdel, action:'remove', itemId: b.dataset.item }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-krfile]').forEach(inp => inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { el.querySelector('#krP'+inp.dataset.krfile).value = String(rd.result || '').slice(0, 6000); toast(T('rs.loaded','Bestand ingeladen, klik op Verwerk met AI.')); };
      rd.readAsText(f);
    }));
    el.querySelectorAll('[data-krimp]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.krimp;
      const text = el.querySelector('#krP'+id).value.trim();
      if (!text){ toast(T('rs.pastefirst','Plak eerst een draaiboek of upload een bestand.')); return; }
      b.disabled = true;
      try { const d = await API.call('/supplier/event/runsheet/ai', { id, mode:'import', text });
        kantoorMsg = '\u2705 '+d.added+' '+T('rs.imported','regels in het draaiboek gezet, verdeeld over de werkplekken.');
        await refresh(); } catch(e){ toast(e.message); b.disabled = false; }
    }));
    el.querySelectorAll('[data-krai]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = T('rs.thinking','De AI stelt het draaiboek op...');
      try { const d = await API.call('/supplier/event/runsheet/ai', { id: b.dataset.krai, mode:'suggest' });
        kantoorMsg = '\u2728 '+d.added+' '+T('rs.suggested','regels voorgesteld. Pas aan wat niet past en publiceer het event.');
        await refresh(); } catch(e){ toast(e.message); b.disabled = false; }
    }));
    // kamers of verblijven: open/dicht, housekeeping doorschakelen, toevoegen
    el.querySelectorAll('[data-kmrt]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/toggle', { id: b.dataset.kmrt }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kmhk]').forEach(b => b.addEventListener('click', async () => {
      const volg = { schoon:'vuil', vuil:'bezig', bezig:'bezet', bezet:'defect', defect:'schoon' };
      try { await API.call('/supplier/room/hk', { id: b.dataset.kmhk, status: volg[b.dataset.cur] || 'schoon' }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kmrd]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/remove', { id: b.dataset.kmrd }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const kRm = el.querySelector('#kRmAdd'); if (kRm) kRm.addEventListener('click', async () => {
      const name = el.querySelector('#kRmN').value.trim(), price = Number(el.querySelector('#kRmP').value);
      if (!name || !(price>0)){ toast(T('sup.roomfill','Vul een kamernaam en prijs in.')); return; }
      try { await API.call('/supplier/room/add', { name, price }); kantoorMsg = '\u2705 '+T('sup.roomadded','Kamer toegevoegd en direct zichtbaar.'); await refresh(); } catch(e){ toast(e.message); }
    });
    // minibar-assortiment
    el.querySelectorAll('[data-kmbd]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/minibar/item/remove', { id: b.dataset.kmbd }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const kMb = el.querySelector('#kMbAdd'); if (kMb) kMb.addEventListener('click', async () => {
      const name = el.querySelector('#kMbN').value.trim(), price = Number(el.querySelector('#kMbP').value);
      if (!name || !(price>0)){ toast(T('mb.fill','Vul een artikel en prijs in.')); return; }
      try { await API.call('/supplier/minibar/item/add', { name, price }); await refresh(); } catch(e){ toast(e.message); }
    });
    // deuren
    el.querySelectorAll('[data-kdoor]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/door/toggle', { id: b.dataset.kdoor }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // aanbodbeheer van de zelfstandige
    const svA = el.querySelector('#svAdd'); if (svA) svA.addEventListener('click', async () => {
      try {
        await API.call('/supplier/service', { action: 'add',
          name: el.querySelector('#svNaam').value, desc: el.querySelector('#svDesc').value,
          price: Number(el.querySelector('#svPrijs').value), duurMin: Number(el.querySelector('#svDuur').value),
          soort: el.querySelector('#svSoort').value });
        kantoorMsg = '✅ '+T('kt.svklaar','In de app gezet; leden kunnen direct boeken.');
        await refresh();
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-svdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/service', { action: 'remove', id: b.dataset.svdel }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // verlofaanvragen beslissen
    el.querySelectorAll('[data-kvja]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/leave/decide', { id: b.dataset.kvja, action: 'goedkeuren' }); kantoorMsg = '✅ '+T('kt.vgedaan','Verlof goedgekeurd; het staflid ziet dit direct op de PDA.'); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kvnee]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/leave/decide', { id: b.dataset.kvnee, action: 'afwijzen' }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // ritgeschiedenis: bladeren, zoeken en de volledige export van de server
    const ktCsv = el.querySelector('#ktCsv'); if (ktCsv) ktCsv.addEventListener('click', () => {
      window.open('/api/supplier/rides.csv?token=' + encodeURIComponent(API.token), '_blank');
    });
    el.querySelectorAll('[data-khist]').forEach(b => b.addEventListener('click', () => {
      histPage = Math.max(1, histPage + Number(b.dataset.khist));
      histData = null;
      renderStation();
    }));
    const ktHzoek = () => {
      histQ = (el.querySelector('#ktHz') ? el.querySelector('#ktHz').value : '').trim();
      histPage = 1;
      histData = null;
      renderStation();
    };
    const hzGo = el.querySelector('#ktHzGo'); if (hzGo) hzGo.addEventListener('click', ktHzoek);
    const hzIn = el.querySelector('#ktHz'); if (hzIn) hzIn.addEventListener('keydown', e => { if (e.key === 'Enter') ktHzoek(); });
    // dispatch: toewijzen met de hand of met het slimme voorstel
    el.querySelectorAll('[data-ktwijs]').forEach(b => b.addEventListener('click', async () => {
      const ref = b.dataset.ktwijs;
      try {
        await API.call('/supplier/ride/assign', { ref, staffId: Number(el.querySelector('[data-ktch="'+ref+'"]').value), vehicleId: el.querySelector('[data-ktvg="'+ref+'"]') ? el.querySelector('[data-ktvg="'+ref+'"]').value : null });
        kantoorMsg = '✅ '+T('kt.gewezen','Rit toegewezen; de gast en de chauffeur zijn op de hoogte.');
        await refresh();
      } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ktslim]').forEach(b => b.addEventListener('click', async () => {
      const ref = b.dataset.ktslim;
      b.disabled = true;
      try {
        const s2 = await API.call('/supplier/ride/suggest', { ref });
        if (!s2.staffId){ toast(T('kt.niemandvrij','Iedereen is bezet.')); b.disabled = false; return; }
        await API.call('/supplier/ride/assign', { ref, staffId: s2.staffId, vehicleId: s2.vehicleId });
        kantoorMsg = '✨ '+T('kt.slimgewezen','Slim toegewezen:')+' <b>'+s2.staffName+'</b>'+(s2.vehicleName?' · '+s2.vehicleName:'');
        await refresh();
      } catch(e){ toast(e.message); b.disabled = false; }
    }));
    // vloot
    el.querySelectorAll('[data-ktvt]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/fleet', { action: 'toggle', id: b.dataset.ktvt }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ktvd]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/fleet', { action: 'remove', id: b.dataset.ktvd }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const ktV = el.querySelector('#ktVAdd'); if (ktV) ktV.addEventListener('click', async () => {
      const name = el.querySelector('#ktVn').value.trim();
      if (!name){ toast(T('kt.vnaamleeg','Geef het voertuig een naam.')); return; }
      try { await API.call('/supplier/fleet', { action: 'add', name, plate: el.querySelector('#ktVp').value.trim(), seats: Number(el.querySelector('#ktVs').value)||4 }); await refresh(); } catch(e){ toast(e.message); }
    });
    // tarief
    const ktT2 = el.querySelector('#ktTSave'); if (ktT2) ktT2.addEventListener('click', async () => {
      try {
        await API.call('/supplier/settings', { tarief: { start: Number(el.querySelector('#ktTa').value), perKm: Number(el.querySelector('#ktTb').value), minimum: Number(el.querySelector('#ktTc').value) } });
        kantoorMsg = '✅ '+T('kt.tklaar','Tarief opgeslagen; nieuwe aanvragen krijgen direct de nieuwe prijs.');
        await refresh();
      } catch(e){ toast(e.message); }
    });
    // prijzen aan RTG
    const kPr = el.querySelector('#kPrSend'); if (kPr) kPr.addEventListener('click', async () => {
      const service = el.querySelector('#kPrS').value.trim(), price = Number(el.querySelector('#kPrP').value);
      if (!service || !(price>0)){ toast(T('sup.fillprice','Vul een dienst en prijs in.')); return; }
      try { await API.call('/supplier/price', { service, price }); kantoorMsg = '\u2705 '+T('sup.pricesent','Prijs verstuurd naar RTG.'); await refresh(); } catch(e){ toast(e.message); }
    });
    // marketing: foto's en een Salon-bericht
    el.querySelectorAll('[data-kphd]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/photo/remove', { index: Number(b.dataset.kphd) }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const kPh = el.querySelector('#kPhFile'); if (kPh) kPh.addEventListener('change', () => {
      const file = kPh.files && kPh.files[0]; if (!file) return;
      if (file.size > 1024*1024){ toast(T('sup.phtoobig','Foto te groot (max 1 MB).')); return; }
      fileToDataURL(file, async url => {
        try { await API.call('/supplier/photo/add', { image: url }); kantoorMsg = '\u2705 '+T('sup.phadded','Foto geplaatst.'); await refresh(); } catch(e){ toast(e.message); }
      });
    });
    let kPicked = null;
    el.querySelectorAll('[data-kpick]').forEach(img => img.addEventListener('click', () => {
      kPicked = kPicked === Number(img.dataset.kpick) ? null : Number(img.dataset.kpick);
      el.querySelectorAll('[data-kpick]').forEach(x => x.classList.toggle('sel', Number(x.dataset.kpick) === kPicked));
    }));
    const kSp = el.querySelector('#kSpPost'); if (kSp) kSp.addEventListener('click', async () => {
      const text = el.querySelector('#kSpText').value.trim();
      if (!text){ toast(T('sup.salonempty','Schrijf eerst een tekst.')); return; }
      try { await API.call('/supplier/salon/post', { text, photoIndex: kPicked });
        kantoorMsg = '\u2705 '+T('sup.salondone','Gepubliceerd op De Salon.');
        await refresh(); } catch(e){ toast(e.message); }
    });
  }

  async function refresh(){ try { applyState((await API.call('/supplier/state')).state); renderAll(); } catch(e){} }

  // ---- navigatie: vijf vaste knoppen, de rest overzichtelijk onder "Meer" ----
  const MAIN_TABS = ['home', 'kassa', 'ai', 'gchat', 'meer'];
  // de spiegel-koppeling met het tweede scherm: welke werkplek hoort bij welke tab
  const SPIEGEL_WERK = { keuken: 'keuken', bar: 'bar', bediening: 'serveren', kassa: 'kassa',
    tafels: 'gasten', gasten: 'gasten', rooms: 'kamers', dorp: 'serveren' };
  let spiegelKanaal = null;
  try { spiegelKanaal = new BroadcastChannel('rtg-scherm'); } catch (e) {}
  function zendSpiegel(tab){
    const werk = SPIEGEL_WERK[tab]; if (!werk || !spiegelKanaal) return;
    try { spiegelKanaal.postMessage({ type: 'werkplek', werk }); } catch (e) {}
  }
  function buildTabs(){
    $('#tabbar').innerHTML = MAIN_TABS.map((k,i) =>
      '<button data-tab="'+k+'"'+(i===0?' class="active"':'')+'><svg viewBox="0 0 24 24">'+TABDEF[k].svg+'</svg>'+T('tab.'+k, TABDEF[k].label)+'</button>'
    ).join('');
    document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab, true)));
  }
  function openTab(tab, focusView){
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view===tab));
    const hi = MAIN_TABS.includes(tab) ? tab : 'meer';
    document.querySelectorAll('.tabbar button').forEach(b => {
      const on = b.dataset.tab===hi;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); // schermlezer meldt de actieve tab
    });
    $('#content').scrollTop = 0;
    // het tweede scherm (spiegel-modus) volgt de werkplek van dit hoofdscherm:
    // we zenden de best passende werkplek uit over een BroadcastChannel.
    zendSpiegel(tab);
    // Alleen bij een echte klik de focus naar de nieuwe weergave verplaatsen, zodat
    // toetsenbord- en schermlezergebruikers meelopen (niet bij programmatische wissels).
    if (focusView){
      const v = document.querySelector('.view[data-view="'+tab+'"]');
      if (v){ v.setAttribute('tabindex','-1'); v.focus({ preventScroll: true }); }
    }
  }
  // ---- vastgoed: de slimme makelaars-backoffice ----
  let vg = null;
  const PAND_ST = { 'beschikbaar':'beschikbaar', 'onder-optie':'onder optie', 'verkocht':'verkocht', 'verhuurd':'verhuurd' };
  async function laadVastgoed(){
    if (!has('vastgoed') || !API.live) return;
    try { vg = await API.call('/supplier/vastgoed/overzicht', {}); } catch(e){ vg = { stats:{}, panden:[], aanbiedingen:[], bezichtigingen:[], biedingen:[] }; }
    renderVastgoed();
  }
  const geld = n => '\u20AC ' + Number(n||0).toLocaleString('nl-NL');
  function renderVastgoed(){
    const el = $('#vgWrap'); if (!el) return;
    if (!has('vastgoed')){ el.innerHTML = ''; return; }
    if (!vg){ el.innerHTML = '<div class="empty">\u2026</div>'; laadVastgoed(); return; }
    const canEdit = actor().manager;
    const st = vg.stats || {};
    const sel = 'style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"';
    let html = '';
    // dashboard
    html += '<div class="card"><div class="tt-h">'+T('vg.dash','Portefeuille')+'</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-top:0.6rem;">'+
      [[st.beschikbaar||0, T('vg.beschikbaar','beschikbaar')],[st.onderOptie||0, T('vg.optie','onder optie')],[st.verkocht||0, T('vg.verkocht','verkocht/verhuurd')],
       [st.openBezichtigingen||0, T('vg.bez','open bezichtigingen')],[st.openBiedingen||0, T('vg.bod','open biedingen')],[st.totaal||0, T('vg.totaal','panden')]]
      .map(c => '<div style="background:var(--card2,var(--card));border:1px solid var(--line);border-radius:12px;padding:0.6rem;text-align:center;"><div style="font-size:1.3rem;font-weight:700;color:var(--gold);">'+c[0]+'</div><div style="font-size:0.64rem;color:var(--soft);text-transform:uppercase;letter-spacing:0.06em;">'+c[1]+'</div></div>').join('')+
      '</div><div style="margin-top:0.6rem;font-size:0.78rem;color:var(--muted);">'+T('vg.waarde','Portefeuillewaarde (koop):')+' <b style="color:var(--gold);">'+geld(st.portefeuille)+'</b></div></div>';
    // open biedingen
    const openBod = (vg.biedingen||[]).filter(b => b.status === 'open');
    if (openBod.length) html += '<div class="card"><div class="tt-h">\uD83D\uDCB0 '+T('vg.biedingen','Biedingen')+' ('+openBod.length+')</div>'+
      openBod.map(b => '<div class="mitem"><div class="r1"><span class="nm">'+esc(b.codename)+' \u00B7 '+esc(b.pand)+'</span><span class="pr">'+geld(b.bedrag)+'</span></div>'+
        (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;"><button class="obtn primary" data-bod="'+b.ref+'" data-actie="accepteren">'+T('vg.accept','Accepteren')+'</button>'+
        '<button class="obtn" data-bod="'+b.ref+'" data-actie="tegenbod">'+T('vg.tegen','Tegenbod')+'</button>'+
        '<button class="obtn" data-bod="'+b.ref+'" data-actie="afwijzen">'+T('vg.afwijs','Afwijzen')+'</button></div>':'')+'</div>').join('')+'</div>';
    // open bezichtigingen
    const openBez = (vg.bezichtigingen||[]).filter(b => b.status === 'aangevraagd');
    if (openBez.length) html += '<div class="card"><div class="tt-h">\uD83D\uDC41\uFE0F '+T('vg.bezichtigingen','Bezichtigingen')+' ('+openBez.length+')</div>'+
      openBez.map(b => '<div class="mitem"><div class="r1"><span class="nm">'+esc(b.codename)+' \u00B7 '+esc(b.pand)+'</span></div>'+
        (b.wens?'<div class="ds">'+T('vg.wens','wens')+': '+esc(b.wens)+'</div>':'')+
        '<div style="margin-top:0.4rem;display:flex;gap:0.4rem;"><button class="obtn primary" data-bezbev="'+b.ref+'">'+T('vg.bevestig','Bevestig + keyless')+'</button>'+
        '<button class="obtn" data-bezafw="'+b.ref+'">'+T('vg.afwijs','Afwijzen')+'</button></div></div>').join('')+'</div>';
    // panden
    html += '<div class="card"><div class="tt-h">'+T('vg.panden','Panden')+' ('+(vg.panden||[]).length+')</div>'+
      (vg.panden||[]).map(p => '<div class="mitem"><div class="r1"><span class="nm">'+esc(p.titel)+'</span><span class="pr">'+geld(p.prijs)+(p.transactie==='huur'?'/mnd':'')+'</span></div>'+
        '<div class="ds">'+esc(p.soort)+' \u00B7 '+esc(p.plaats||'')+' \u00B7 \uD83D\uDECF\uFE0F'+(p.slaapkamers||0)+' \u00B7 \uD83D\uDEC1'+(p.badkamers||0)+' \u00B7 '+(p.oppervlakte||0)+'m\u00B2'+(p.keyless?' \u00B7 \uD83D\uDD13 keyless':'')+' \u00B7 '+T('vg.st.'+p.status, PAND_ST[p.status]||p.status)+' \u00B7 \uD83D\uDCF7'+((p.fotos||[]).length)+'</div>'+
        (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;">'+
          '<button class="obtn primary" data-vgaanbod="'+p.id+'" data-titel="'+escAttr(p.titel)+'">'+T('vg.aanbieden','Aanbieden')+'</button>'+
          '<button class="obtn" data-vgfoto="'+p.id+'">\uD83D\uDCF7 '+T('vg.foto','Foto')+'</button>'+
          '<button class="obtn" data-vgcontract="'+p.id+'" data-titel="'+escAttr(p.titel)+'">\uD83D\uDCDD '+T('vg.contract','Contract')+'</button>'+
          '<button class="rr-del" data-vgdel="'+p.id+'">\u2715</button></div>':'')+'</div>').join('')+
      (canEdit ? '<details style="margin-top:1rem;"><summary style="cursor:pointer;font-size:0.82rem;color:var(--gold);">'+T('vg.nieuw','Pand toevoegen')+'</summary><div style="margin-top:0.8rem;">'+
        '<div class="field"><label>'+T('vg.f.titel','Titel')+'</label><input id="vgTitel" placeholder="Villa met zeezicht"></div>'+
        '<div class="row-gap"><div class="field" style="flex:1;"><label>'+T('vg.f.soort','Soort')+'</label><select id="vgSoort" '+sel+'><option value="woning">woning</option><option value="appartement">appartement</option><option value="villa">villa</option><option value="commercieel">commercieel</option><option value="grond">grond</option></select></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vg.f.trans','Koop/huur')+'</label><select id="vgTrans" '+sel+'><option value="koop">koop</option><option value="huur">huur (p/mnd)</option></select></div></div>'+
        '<div class="row-gap"><div class="field" style="flex:2;"><label>'+T('vg.f.plaats','Plaats')+'</label><input id="vgPlaats"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vg.f.prijs','Prijs \u20AC')+'</label><input id="vgPrijs" type="number" inputmode="numeric"></div></div>'+
        '<div class="row-gap"><div class="field" style="flex:1;"><label>'+T('vg.f.slk','Slaapk.')+'</label><input id="vgSlk" type="number" value="3"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vg.f.bdk','Badk.')+'</label><input id="vgBdk" type="number" value="2"></div>'+
        '<div class="field" style="flex:1;"><label>m\u00B2</label><input id="vgOpp" type="number"></div></div>'+
        '<div class="field"><label>'+T('vg.f.oms','Omschrijving')+'</label><textarea id="vgOms" rows="2" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem;color:var(--txt);outline:none;font-family:inherit;"></textarea></div>'+
        '<label class="field" style="display:flex;align-items:center;gap:0.4rem;"><input type="checkbox" id="vgKeyless" checked style="accent-color:var(--gold);"> '+T('vg.f.keyless','Keyless toegang mogelijk')+'</label>'+
        '<button class="obtn primary" id="vgAdd">'+T('vg.f.voeg','Toevoegen')+'</button></div></details>' : '')+'</div>'+
      '<input type="file" id="vgFile" accept="image/*" style="display:none;">';
    el.innerHTML = html;
    // acties
    document.querySelectorAll('[data-bod]').forEach(k => k.addEventListener('click', async () => {
      const body = { ref: k.dataset.bod, actie: k.dataset.actie };
      if (k.dataset.actie === 'tegenbod'){ const t = prompt(T('vg.q.tegen','Tegenbod in euro?')); if (!t) return; body.tegenbod = Number(t); }
      try { await API.call('/supplier/bod/beslis', body); await laadVastgoed(); openTab('vastgoed'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-bezbev]').forEach(k => k.addEventListener('click', async () => {
      const m = prompt(T('vg.q.moment','Datum en tijd van de bezichtiging (JJJJ-MM-DD UU:MM):'), new Date(Date.now()+86400000).toISOString().slice(0,16).replace('T',' '));
      if (!m) return;
      try { await API.call('/supplier/bezichtiging/beslis', { ref: k.dataset.bezbev, actie: 'bevestigen', moment: m.replace(' ','T') }); toast(T('vg.bevok','Bevestigd; keyless staat klaar als het pand keyless is.')); await laadVastgoed(); openTab('vastgoed'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-bezafw]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/bezichtiging/beslis', { ref: k.dataset.bezafw, actie: 'afwijzen' }); await laadVastgoed(); openTab('vastgoed'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vgaanbod]').forEach(k => k.addEventListener('click', async () => {
      const wie = prompt(T('vg.q.aan','Aanbieden aan wie? Typ codenamen (komma\'s), of laat leeg voor PUBLIEK:'));
      if (wie === null) return;
      const body = { pandId: k.dataset.vgaanbod };
      if (wie.trim()) body.codenamen = wie.split(','); else { body.publiek = true; body.salon = confirm(T('vg.q.salon','Ook op De Salon plaatsen voor uw volgers?')); }
      try { const r = await API.call('/supplier/aanbieding', body); toast(T('vg.aanbok','Aangeboden aan ')+(r.aanbieding.publiek?T('vg.iedereen','iedereen'):(r.aanbieding.aan+' lid/leden'))+(r.aanbieding.nietGevonden.length?' ('+T('vg.nietgev','niet gevonden')+': '+r.aanbieding.nietGevonden.join(', ')+')':'')); await laadVastgoed(); openTab('vastgoed'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vgcontract]').forEach(k => k.addEventListener('click', () => {
      openTab('contract');
      setTimeout(() => { const t = document.getElementById('ctTitel'); if (t){ t.value = T('vg.koopc','Koopovereenkomst ')+k.dataset.titel; const so = document.getElementById('ctSoort'); if (so){ so.value='algemeen'; } } }, 200);
      toast(T('vg.contracttip','Vul de codenaam van de koper in en verstuur het contract.'));
    }));
    document.querySelectorAll('[data-vgfoto]').forEach(k => k.addEventListener('click', () => {
      const file = document.getElementById('vgFile');
      file.onchange = () => { if (!file.files[0]) return; fotoKlein(file.files[0], async (d) => {
        try { await API.call('/supplier/pand/foto', { id: k.dataset.vgfoto, foto: d }); toast(T('vg.fotook','Foto toegevoegd.')); await laadVastgoed(); openTab('vastgoed'); } catch(e){ toast(e.message); }
      }); file.value=''; };
      file.click();
    }));
    document.querySelectorAll('[data-vgdel]').forEach(k => k.addEventListener('click', async () => {
      if (!confirm(T('vg.delvraag','Dit pand verwijderen?'))) return;
      try { await API.call('/supplier/pand', { id: k.dataset.vgdel, weg: true }); await laadVastgoed(); openTab('vastgoed'); } catch(e){ toast(e.message); }
    }));
    const add = document.getElementById('vgAdd');
    if (add) add.addEventListener('click', async () => {
      const g = id => $(id) ? $(id).value : undefined;
      try { await API.call('/supplier/pand', { titel: g('#vgTitel'), soort: g('#vgSoort'), transactie: g('#vgTrans'), plaats: g('#vgPlaats'),
        prijs: Number(g('#vgPrijs')), slaapkamers: Number(g('#vgSlk')), badkamers: Number(g('#vgBdk')), oppervlakte: Number(g('#vgOpp')),
        omschrijving: g('#vgOms'), keyless: $('#vgKeyless') ? $('#vgKeyless').checked : true });
        toast(T('vg.addok','Het pand staat in uw portefeuille.')); await laadVastgoed(); openTab('vastgoed'); } catch(e){ toast(e.message); }
    });
  }

  // ---- contracten: opstellen en ondertekenen ----
  let contracten = null;
  const CON_ST = { 'wacht': 'wacht op handtekening(en)', 'getekend': 'volledig getekend', 'geweigerd': 'geweigerd' };
  async function laadContracten(){
    if (!API.live) return;
    try { contracten = (await API.call('/supplier/contracten')).contracten; } catch(e){ contracten = []; }
    renderContracten();
  }
  /* Onboarding & contract voor de eigen mensen: welke gegevens ze invullen en
     welk contract ze tekenen. Aan te passen met AI in gewone taal. */
  let onbCfg = null;
  const ONB_WIE = { guest:'gast', rtg:'RTG', lifestyle:'Lifestyle', business:'Business', rtf:'RTF' };
  async function laadOnbCfg(){ try { onbCfg = await API.call('/supplier/onboarding/config'); } catch(e){ onbCfg = { fout:1 }; } renderOnbCfg(); }
  function renderOnbCfg(){
    const el = $('#onbCfgWrap'); if (!el) return;
    if (onbCfg === null){ el.innerHTML = '<div class="empty">\u2026</div>'; laadOnbCfg(); return; }
    if (onbCfg.fout){ el.innerHTML = '<div class="softline">'+T('onb.err','Kon de onboarding niet laden.')+'</div>'; return; }
    const canEdit = actor().manager;
    const c = onbCfg.config, cnt = onbCfg.ondertekenaars || [];
    let h = '';
    if (canEdit) h += '<div class="card" style="border-color:var(--gold);"><div class="tt-h">\u2728 '+T('onb.ai','Aanpassen met AI')+'</div>'+
      '<p class="sub">'+T('onb.ai.s','Beschrijf in gewone taal wat u wilt. Bijv. "voeg het veld BSN toe" of "zet in het contract dat annuleren tot 24 uur vooraf kan".')+'</p>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="onbAiIn" class="st-in" style="flex:1;" placeholder="'+T('onb.ai.ph','Wat wilt u aanpassen?')+'"><button class="obtn primary" id="onbAiGo">'+T('onb.ai.go','Aanpassen')+'</button></div>'+
      '<div id="onbAiUit" class="sub" style="margin-top:0.5rem;"></div></div>';
    h += '<div class="card"><div class="tt-h">\ud83d\udccb '+T('onb.velden','Verplichte gegevens')+'</div>'+
      c.velden.map(v => '<div class="st-row"><span>'+esc(v.label)+'<span class="sub">'+esc(v.type)+' \u00b7 '+(v.voorWie||[]).map(w=>ONB_WIE[w]||w).join(', ')+'</span></span></div>').join('')+'</div>';
    h += '<div class="card"><div class="tt-h">\ud83d\udcc4 '+esc(c.contract.titel)+' <span class="sub">v'+c.contract.versie+'</span></div>'+
      '<div style="max-height:15rem;overflow:auto;white-space:pre-wrap;font-size:0.8rem;line-height:1.6;color:var(--soft);margin-top:0.4rem;">'+esc(c.contract.tekst)+'</div></div>';
    h += '<div class="card"><div class="tt-h">\u270d\ufe0f '+T('onb.get','Ondertekend')+' ('+cnt.length+')</div>'+
      (cnt.length ? cnt.slice(0,30).map(o=>'<div class="st-row"><span>'+esc(o.naam)+'<span class="sub">v'+o.versie+' \u00b7 '+new Date(o.at).toLocaleDateString('nl-NL')+'</span></span></div>').join('') : '<p class="sub">'+T('onb.niemand','Nog niemand heeft getekend.')+'</p>')+'</div>';
    el.innerHTML = h;
    const go = $('#onbAiGo'); if (go) go.addEventListener('click', async () => {
      const opdracht = (($('#onbAiIn')||{}).value || '').trim();
      if (opdracht.length < 3){ toast(T('onb.ai.kort','Beschrijf iets uitgebreider.')); return; }
      go.disabled = true; $('#onbAiUit').textContent = T('onb.ai.bezig','Bezig...');
      try { const r = await API.call('/supplier/onboarding/ai', { opdracht }); onbCfg = { config: r.config, ondertekenaars: cnt }; renderOnbCfg(); toast('\u2728 ' + (r.uitleg || T('onb.klaar','Aangepast.'))); }
      catch(e){ $('#onbAiUit').textContent = e.message; go.disabled = false; }
    });
  }
  function renderContracten(){
    const el = $('#contractWrap'); if (!el) return;
    if (contracten === null){ el.innerHTML = '<div class="empty">\u2026</div>'; laadContracten(); return; }
    const canEdit = actor().manager;
    let html = '';
    html += '<div class="card"><div class="tt-h">'+T('ct.lijst','Contracten')+' ('+contracten.length+')</div>'+
      (contracten.length ? contracten.map(c => {
        const ontv = c.partij.kind === 'lid' ? c.partij.codename : c.partij.naam;
        const zaakGetekend = !!c.tekenZaak, partijGetekend = !!c.tekenPartij;
        const magZaakTekenen = canEdit && !zaakGetekend && c.status !== 'geweigerd';
        const magIkTekenen = !partijGetekend && c.partij.kind === 'staff' && c.status !== 'geweigerd' && !canEdit;
        return '<div class="mitem"><div class="r1"><span class="nm">'+esc(c.titel)+'</span><span class="pr" style="font-size:0.7rem;">'+T('ct.st.'+c.status, CON_ST[c.status]||c.status)+'</span></div>'+
          '<div class="ds">'+T('ct.soort.'+c.soort, c.soort)+' \u00B7 '+esc(ontv)+' \u00B7 '+(zaakGetekend?'\u2705':'\u25CB')+' '+T('ct.zaak','zaak')+' / '+(partijGetekend?'\u2705':'\u25CB')+' '+T('ct.partij','ontvanger')+'</div>'+
          (c.velden && c.velden.length ? '<div class="ds">'+c.velden.map(v=>esc(v.label)+': '+esc(v.waarde)).join(' \u00B7 ')+'</div>' : '')+
          '<details style="margin-top:0.3rem;"><summary style="cursor:pointer;font-size:0.72rem;color:var(--gold);">'+T('ct.tekst','Voorwaarden')+'</summary><div style="font-size:0.78rem;color:var(--muted);white-space:pre-wrap;margin-top:0.3rem;">'+esc(c.tekst)+'</div></details>'+
          ((magZaakTekenen||magIkTekenen)?'<div style="margin-top:0.5rem;"><button class="obtn primary" data-cteken="'+c.ref+'">'+T('ct.teken','Onderteken')+'</button></div>':'')+
          '</div>';
      }).join('') : '<div class="empty">'+T('ct.geen','Nog geen contracten.')+'</div>')+'</div>';
    if (canEdit){
      html += '<div class="card"><div class="tt-h">'+T('ct.nieuw','Nieuw contract')+'</div>'+
        '<div class="field"><label>'+T('ct.f.soort','Soort')+'</label><select id="ctSoort" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"><option value="verhuur">'+T('ct.soort.verhuur','Verhuur')+'</option><option value="personeel">'+T('ct.soort.personeel','Personeel')+'</option><option value="algemeen">'+T('ct.soort.algemeen','Algemeen')+'</option></select></div>'+
        '<div class="field"><label>'+T('ct.f.ontv','Voor wie')+'</label><select id="ctOntv" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"><option value="lid">'+T('ct.f.lid','Een lid (codenaam)')+'</option><option value="staff">'+T('ct.f.staff','Een personeelslid')+'</option></select></div>'+
        '<div class="field" id="ctLidVeld"><label>'+T('ct.f.code','Codenaam van het lid')+'</label><input id="ctCode" placeholder="'+T('ct.f.codeph','Bijv. Zilveren Valk 12')+'"></div>'+
        '<div class="field" id="ctStaffVeld" style="display:none;"><label>'+T('ct.f.wie','Personeelslid')+'</label><select id="ctStaff" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"></select></div>'+
        '<div class="field"><label>'+T('ct.f.titel','Titel')+'</label><input id="ctTitel" placeholder="'+T('ct.f.titelph','Bijv. Huurovereenkomst')+'"></div>'+
        '<div class="field"><label>'+T('ct.f.tekst','Voorwaarden')+'</label><textarea id="ctTekst" rows="4" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;font-family:inherit;" placeholder="'+T('ct.f.tekstph','De afspraken en voorwaarden\u2026')+'"></textarea></div>'+
        '<button class="obtn primary" id="ctMaak">'+T('ct.f.maak','Contract versturen')+'</button></div>';
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-cteken]').forEach(k => k.addEventListener('click', async () => {
      const naam = prompt(T('ct.tekenvraag','Typ uw naam om digitaal te ondertekenen:'));
      if (!naam) return;
      try { await API.call('/supplier/contract/teken', { ref: k.dataset.cteken, naam, akkoord: true }); toast(T('ct.tekenok','Ondertekend.')); await laadContracten(); openTab('contract'); } catch(e){ toast(e.message); }
    }));
    const ontvSel = document.getElementById('ctOntv');
    if (ontvSel){
      const staffSel = document.getElementById('ctStaff');
      if (staffSel) staffSel.innerHTML = (Array.isArray(state.team) ? state.team : []).map(m => '<option value="'+m.id+'">'+esc(m.name)+' ('+esc(m.func||m.role||'')+')</option>').join('');
      ontvSel.addEventListener('change', () => {
        document.getElementById('ctLidVeld').style.display = ontvSel.value === 'lid' ? '' : 'none';
        document.getElementById('ctStaffVeld').style.display = ontvSel.value === 'staff' ? '' : 'none';
      });
    }
    const maak = document.getElementById('ctMaak');
    if (maak) maak.addEventListener('click', async () => {
      const soort = $('#ctSoort').value, ontv = $('#ctOntv').value;
      const body = { soort, titel: $('#ctTitel').value, tekst: $('#ctTekst').value };
      if (ontv === 'staff') body.staffId = $('#ctStaff') ? $('#ctStaff').value : null;
      else body.codenaam = $('#ctCode').value;
      try { await API.call('/supplier/contract/maak', body); toast(T('ct.maakok','Contract verstuurd; de ontvanger tekent in de app.')); await laadContracten(); openTab('contract'); } catch(e){ toast(e.message); }
    });
  }

  // ---- boerderij: de slimme boer-backoffice (percelen, dieren, taken, AI) ----
  let boer = null;
  const FASE_LBL = { 'leeg':'leeg', 'gezaaid':'net gezaaid', 'groeit':'groeit', 'te-oogsten':'oogstklaar', 'geoogst':'geoogst' };
  const FASE_KL = { 'te-oogsten':'#7EE0A3', 'groeit':'var(--gold)', 'gezaaid':'#8FB8D8', 'geoogst':'var(--soft)', 'leeg':'var(--soft)' };
  const URG_KL = { 'hoog':'#E0736A', 'midden':'var(--gold)', 'laag':'var(--soft)' };
  async function laadBoerderij(){
    if (!has('boerderij') || !API.live) return;
    try { boer = await API.call('/supplier/boerderij/overzicht', {}); } catch(e){ boer = null; }
    renderBoerderij();
  }
  function boerToe(r){ if (r && r.overzicht){ boer = r.overzicht; } else if (r && r.percelen){ boer = r; } renderBoerderij(); }
  function renderBoerderij(){
    const el = $('#boerWrap'); if (!el) return;
    if (!has('boerderij')){ el.innerHTML = ''; return; }
    if (!boer){ el.innerHTML = '<div class="empty">…</div>'; laadBoerderij(); return; }
    const canEdit = actor().manager;
    const o = boer, st = o.stats || {}, isDier = o.kind !== 'gewas', isGewas = o.kind !== 'dier';
    const sel = 'style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;font-size:0.82rem;color:var(--txt);"';
    let html = '';
    // type + kiezer
    html += '<div class="card"><div class="tt-h">'+T('boer.type','Soort boerderij')+'</div>'+
      '<div style="margin-top:0.5rem;font-size:0.9rem;">'+(o.typeIcon||'🚜')+' <b>'+esc(o.typeLabel||T('boer.geen','nog niet gekozen'))+'</b></div>'+
      (canEdit ? '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.6rem;">'+
        o.types.map(t => '<button class="obtn'+(t.id===o.type?' primary':'')+'" data-btype="'+t.id+'">'+t.icon+' '+esc(t.label)+'</button>').join('')+'</div>' : '')+'</div>';
    // Vandaag-briefing
    const br = o.briefing || { punten:[] };
    html += '<div class="card"><div class="tt-h">🌱 '+T('boer.vandaag','Vandaag')+' · '+esc(br.seizoenLabel||'')+'</div>'+
      (br.punten.length ? br.punten.map(p => '<div class="mitem" style="border-left:3px solid '+(URG_KL[p.urgentie]||'var(--soft)')+';"><div class="ds" style="color:var(--txt);">'+esc(p.tekst)+'</div></div>').join('')
        : '<div class="ds" style="margin-top:0.5rem;">'+T('boer.rustig','Niets dringends. Mooie dag om vooruit te werken.')+'</div>')+'</div>';
    // stats
    const tiles = [[st.percelen||0, T('boer.percelen','percelen')],[ (st.hectare||0)+' ha', T('boer.opp','oppervlak')],[st.teOogsten||0, T('boer.oogstklaar','oogstklaar')],[st.dieren||0, T('boer.dieren','dieren')]];
    if (isDier){ tiles.push([st.melkPerDag||0, T('boer.melk','L melk/dag')]); tiles.push([st.eierenPerDag||0, T('boer.eieren','eieren/dag')]); tiles.push([(st.voerPerDag||0)+' kg', T('boer.voer','voer/dag')]); }
    tiles.push([st.openTaken||0, T('boer.taken','open taken')]);
    html += '<div class="card"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;">'+
      tiles.map(c => '<div style="background:var(--card2,var(--card));border:1px solid var(--line);border-radius:12px;padding:0.6rem;text-align:center;"><div style="font-size:1.15rem;font-weight:700;color:var(--gold);">'+c[0]+'</div><div style="font-size:0.6rem;color:var(--soft);text-transform:uppercase;letter-spacing:0.05em;">'+c[1]+'</div></div>').join('')+'</div></div>';
    // percelen (gewasbedrijven)
    if (isGewas){
      html += '<div class="card"><div class="tt-h">'+T('boer.perc','Percelen')+' ('+(o.percelen||[]).length+')</div>'+
        (o.percelen||[]).map(p => {
          const bar = '<div style="height:6px;border-radius:4px;background:var(--line);overflow:hidden;margin-top:0.35rem;"><div style="height:100%;width:'+(p.voortgang||0)+'%;background:'+(FASE_KL[p.fase]||'var(--gold)')+';"></div></div>';
          return '<div class="mitem"><div class="r1"><span class="nm">'+esc(p.naam)+'</span><span class="pr">'+(p.ha||0)+' ha</span></div>'+
          '<div class="ds">'+(p.gewasLabel ? esc(p.gewasLabel)+' · <span style="color:'+(FASE_KL[p.fase]||'var(--soft)')+';">'+T('boer.fase.'+p.fase, FASE_LBL[p.fase]||p.fase)+'</span>'+(p.fase==='groeit'||p.fase==='gezaaid'?' · '+(p.restDagen)+' '+T('boer.dgn','dagen tot oogst'):'')+(p.opbrengst?' · '+p.opbrengst+' '+(p.eenheid||'kg'):'') : T('boer.braak','braak, nog niet ingezaaid'))+'</div>'+
          (p.gewasLabel && p.fase!=='geoogst' ? bar : '')+
          '<div style="margin-top:0.45rem;display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">'+
            (canEdit ? '<select data-zaaisel="'+p.id+'" '+sel+'><option value="">'+T('boer.zaaikies','zaai...')+'</option>'+o.gewaskeuze.map(g=>'<option value="'+g.id+'">'+esc(g.label)+'</option>').join('')+'</select>' : '')+
            (p.gewasLabel && p.fase==='te-oogsten' ? '<button class="obtn primary" data-oogst="'+p.id+'">🌾 '+T('boer.oogsten','Oogsten')+'</button>' : '')+
            (p.gewasLabel && p.fase!=='geoogst' ? '<button class="obtn" data-water="'+p.id+'">💧 '+T('boer.water','Water')+'</button>' : '')+
            (canEdit ? '<button class="rr-del" data-percdel="'+p.id+'">✕</button>' : '')+
          '</div></div>';
        }).join('')+
        (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;"><input id="boerPcNaam" placeholder="'+T('boer.pcnaam','Naam perceel')+'" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"><input id="boerPcHa" type="number" min="0" step="0.1" placeholder="ha" style="width:5rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"><button class="obtn primary" id="boerPcAdd">+</button></div>' : '')+'</div>';
    }
    // dieren
    if (isDier){
      html += '<div class="card"><div class="tt-h">'+T('boer.dgroep','Dieren')+' ('+(o.dieren||[]).length+')</div>'+
        (o.dieren||[]).map(d => '<div class="mitem"><div class="r1"><span class="nm">'+esc(d.soortLabel)+' × '+(d.aantal||0)+'</span><span class="pr">'+(d.dagopbrengst||0)+' '+(d.eenheid||'')+'/dag</span></div>'+
          '<div class="ds">'+(d.stal?esc(d.stal)+' · ':'')+T('boer.voernodig','voer')+' '+(d.voerKgPerDag||0)+' kg/dag · '+T('boer.gezond','gezondheid')+': <span style="color:'+(d.gezondheid==='goed'?'#7EE0A3':d.gezondheid==='ziek'?'#E0736A':'var(--gold)')+';">'+esc(d.gezondheid)+'</span>'+(d.laatsteVoer?' · '+T('boer.gevoerd','gevoerd')+' '+timeAgo(d.laatsteVoer):'')+'</div>'+
          '<div style="margin-top:0.45rem;display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">'+
            '<button class="obtn primary" data-voer="'+d.id+'">🌾 '+T('boer.voeren','Voeren')+'</button>'+
            '<input type="number" min="0" data-opbin="'+d.id+'" placeholder="'+(d.eenheid||'')+'/dag" style="width:6rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.4rem 0.5rem;color:var(--txt);"><button class="obtn" data-opbset="'+d.id+'">'+T('boer.opbregistr','Opbrengst')+'</button>'+
            (canEdit ? '<select data-gezond="'+d.id+'" '+sel+'><option value="goed"'+(d.gezondheid==='goed'?' selected':'')+'>'+T('boer.g.goed','goed')+'</option><option value="aandacht"'+(d.gezondheid==='aandacht'?' selected':'')+'>'+T('boer.g.aandacht','aandacht')+'</option><option value="ziek"'+(d.gezondheid==='ziek'?' selected':'')+'>'+T('boer.g.ziek','ziek')+'</option></select><button class="rr-del" data-dierdel="'+d.id+'">✕</button>' : '')+
          '</div></div>').join('')+
        (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><select id="boerDrSoort" '+sel+'>'+o.dierkeuze.map(g=>'<option value="'+g.id+'">'+esc(g.label)+'</option>').join('')+'</select><input id="boerDrAantal" type="number" min="0" placeholder="'+T('boer.aantal','aantal')+'" style="width:6rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"><button class="obtn primary" id="boerDrAdd">+</button></div>' : '')+'</div>';
    }
    // takenbord
    html += '<div class="card"><div class="tt-h">'+T('boer.takenbord','Takenbord')+'</div>'+
      (o.taken||[]).map(t => '<div class="mitem" style="opacity:'+(t.klaar?'0.55':'1')+';"><div class="r1"><span class="nm">'+(t.klaar?'✓ ':'')+esc(t.wat)+'</span>'+(t.voor?'<span class="pr" style="color:'+(!t.klaar&&t.voor<new Date().toISOString().slice(0,10)?'#E0736A':'var(--soft)')+';">'+esc(t.voor)+'</span>':'')+'</div>'+
        (t.waar?'<div class="ds">📍 '+esc(t.waar)+(t.door?' · '+esc(t.door):'')+'</div>':'')+
        (!t.klaar ? '<div style="margin-top:0.4rem;display:flex;gap:0.4rem;"><button class="obtn primary" data-taakklaar="'+t.id+'">'+T('boer.afronden','Afronden')+'</button>'+(canEdit?'<button class="rr-del" data-taakdel="'+t.id+'">✕</button>':'')+'</div>' : '')+'</div>').join('')+
      (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><input id="boerTkWat" placeholder="'+T('boer.tkwat','Nieuwe taak')+'" style="flex:1;min-width:9rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"><input id="boerTkVoor" type="date" style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"><button class="obtn primary" id="boerTkAdd">+</button></div>' : '')+'</div>';
    // Verkoop: producten (oogst vult de voorraad) en verkopen via de Salon
    html += '<div class="card"><div class="tt-h">🛒 '+T('boer.verkoop','Verkoop via de Salon')+'</div>'+
      '<p class="sub" style="margin-top:0.2rem;">'+T('boer.verkoop.sub','Uw oogst komt hier automatisch in de voorraad. Zet een prijs en plaats het in de Salon; leden claimen en halen op.')+'</p>'+
      ((o.producten||[]).length ? (o.producten||[]).map(pr => '<div class="mitem"><div class="r1"><span class="nm">'+esc(pr.naam)+'</span><span class="pr">'+pr.voorraad+' '+esc(pr.eenheid)+'</span></div>'+
        '<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">'+
          '<span style="font-size:0.78rem;color:var(--soft);">€</span><input type="number" min="0" step="0.1" value="'+(pr.prijs||'')+'" data-prijsin="'+pr.id+'" style="width:5rem;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:0.35rem 0.5rem;color:var(--txt);"><span style="font-size:0.78rem;color:var(--soft);">/'+esc(pr.eenheid)+'</span>'+
          (canEdit?'<button class="obtn" data-prijsset="'+pr.id+'">'+T('boer.prijsopslaan','Prijs')+'</button>':'')+
          (canEdit?'<button class="obtn primary" data-naarsalon="'+pr.id+'">'+(pr.inSalon?'🔁 '+T('boer.opnieuwsalon','Opnieuw in Salon'):'✦ '+T('boer.insalon','In de Salon'))+'</button>':'')+
          (canEdit?'<button class="rr-del" data-proddel="'+pr.id+'">✕</button>':'')+
        '</div></div>').join('')
        : '<div class="ds" style="margin-top:0.5rem;">'+T('boer.geenprod','Nog geen producten. Oogst een perceel of voeg er hieronder een toe.')+'</div>')+
      (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><input id="boerPrNaam" placeholder="'+T('boer.prnaam','Product')+'" style="flex:1;min-width:7rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"><input id="boerPrEenh" placeholder="'+T('boer.preenh','kg')+'" style="width:4rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"><input id="boerPrPrijs" type="number" min="0" step="0.1" placeholder="€" style="width:5rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"><button class="obtn primary" id="boerPrAdd">+</button></div>' : '')+'</div>';
    // AI-adviseur
    if (canEdit){
      html += '<div class="card"><div class="tt-h">✨ '+T('boer.ai','AI-adviseur')+'</div>'+
        '<p class="sub" style="margin-top:0.3rem;">'+T('boer.ai.sub','Vraag advies of geef een opdracht, bijv. "zaai tomaat op Kasblok 1" of "voeg 20 melkkoeien toe".')+'</p>'+
        '<div id="boerAiOut" style="margin-top:0.5rem;"></div>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="boerAiIn" placeholder="'+T('boer.ai.ph','Uw vraag of opdracht...')+'" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.7rem;color:var(--txt);"><button class="obtn primary" id="boerAiGo">'+T('boer.ai.go','Vraag')+'</button></div></div>';
    }
    el.innerHTML = html;
    // wiring
    el.querySelectorAll('[data-btype]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/type', { type: b.dataset.btype })); toast(T('boer.typeok','Boerderijtype ingesteld.')); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-zaaisel]').forEach(s2 => s2.addEventListener('change', async () => { if (!s2.value) return; try { const r = await API.call('/supplier/boerderij/zaai', { id: s2.dataset.zaaisel, gewas: s2.value }); toast(T('boer.zaaiok','Gezaaid. Oogst verwacht rond ')+r.oogstVerwacht); boerToe(r); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-oogst]').forEach(b => b.addEventListener('click', async () => { try { const r = await API.call('/supplier/boerderij/oogst', { id: b.dataset.oogst }); toast(T('boer.oogstok','Geoogst: ')+r.opbrengst+' '+r.eenheid); boerToe(r); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-water]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/water', { id: b.dataset.water })); toast(T('boer.waterok','Beregend.')); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-percdel]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/perceel', { weg: true, id: b.dataset.percdel })); } catch(e){ toast(e.message); } }));
    const pcAdd = $('#boerPcAdd'); if (pcAdd) pcAdd.addEventListener('click', async () => { const naam = $('#boerPcNaam').value.trim(); if (!naam) return; try { boerToe(await API.call('/supplier/boerderij/perceel', { naam, ha: Number($('#boerPcHa').value)||0 })); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-voer]').forEach(b => b.addEventListener('click', async () => { try { const r = await API.call('/supplier/boerderij/voer', { id: b.dataset.voer }); toast(T('boer.voerok','Gevoerd ')+'('+r.voerKg+' kg).'); boerToe(r); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-opbset]').forEach(b => b.addEventListener('click', async () => { const inp = el.querySelector('[data-opbin="'+b.dataset.opbset+'"]'); const v = inp?Number(inp.value):0; try { boerToe(await API.call('/supplier/boerderij/opbrengst', { id: b.dataset.opbset, waarde: v })); toast(T('boer.opbok','Opbrengst vastgelegd.')); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-gezond]').forEach(s2 => s2.addEventListener('change', async () => { try { boerToe(await API.call('/supplier/boerderij/dier', { id: s2.dataset.gezond, gezondheid: s2.value })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-dierdel]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/dier', { weg: true, id: b.dataset.dierdel })); } catch(e){ toast(e.message); } }));
    const drAdd = $('#boerDrAdd'); if (drAdd) drAdd.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/dier', { soort: $('#boerDrSoort').value, aantal: Number($('#boerDrAantal').value)||0 })); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-taakklaar]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/taak/klaar', { id: b.dataset.taakklaar })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-taakdel]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/taak', { weg: true, id: b.dataset.taakdel })); } catch(e){ toast(e.message); } }));
    const tkAdd = $('#boerTkAdd'); if (tkAdd) tkAdd.addEventListener('click', async () => { const wat = $('#boerTkWat').value.trim(); if (!wat) return; try { boerToe(await API.call('/supplier/boerderij/taak', { wat, voor: $('#boerTkVoor').value })); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-prijsset]').forEach(b => b.addEventListener('click', async () => { const inp = el.querySelector('[data-prijsin="'+b.dataset.prijsset+'"]'); try { boerToe(await API.call('/supplier/boerderij/product', { id: b.dataset.prijsset, prijs: inp?Number(inp.value):0 })); toast(T('boer.prijsok','Prijs opgeslagen.')); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-naarsalon]').forEach(b => b.addEventListener('click', async () => { try { const r = await API.call('/supplier/boerderij/naar-salon', { id: b.dataset.naarsalon }); toast(T('boer.salonok','In de Salon gezet; leden zien het nu.')); boerToe(r); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-proddel]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/product', { weg: true, id: b.dataset.proddel })); } catch(e){ toast(e.message); } }));
    const prAdd = $('#boerPrAdd'); if (prAdd) prAdd.addEventListener('click', async () => { const naam = $('#boerPrNaam').value.trim(); if (!naam) return; try { boerToe(await API.call('/supplier/boerderij/product', { naam, eenheid: $('#boerPrEenh').value.trim()||'kg', prijs: Number($('#boerPrPrijs').value)||0 })); } catch(e){ toast(e.message); } });
    const aiGo = $('#boerAiGo'); if (aiGo){
      const doeAi = async () => { const vraag = $('#boerAiIn').value.trim(); if (!vraag) return; const out = $('#boerAiOut'); out.innerHTML = '<div class="ds">'+T('boer.aidenkt','Even denken...')+'</div>';
        try { const r = await API.call('/supplier/boerderij/ai', { vraag }); out.innerHTML = '<div class="mitem"'+(r.gedaan?' style="border-left:3px solid #7EE0A3;"':'')+'><div class="ds" style="color:var(--txt);white-space:pre-wrap;">'+esc(r.antwoord)+'</div></div>'; $('#boerAiIn').value=''; if (r.overzicht){ boer = r.overzicht; } if (r.gedaan) renderBoerderij(); }
        catch(e){ out.innerHTML = '<div class="ds" style="color:#E0736A;">'+esc(e.message)+'</div>'; } };
      aiGo.addEventListener('click', doeAi);
      const aiIn = $('#boerAiIn'); if (aiIn) aiIn.addEventListener('keydown', e => { if (e.key==='Enter') doeAi(); });
    }
  }

  // ---- content creator: de carriere-backoffice ----
  let cr = null;
  const IDEE_KL = { 'idee':'var(--soft)', 'productie':'var(--gold)', 'gepost':'#7EE0A3' };
  const PLAT_ICO = { instagram:'📸', tiktok:'🎵', youtube:'▶️', x:'𝕏', twitch:'🎮', podcast:'🎙️', blog:'✍️' };
  async function laadCreator(){
    if (!has('creator') || !API.live) return;
    try { cr = await API.call('/supplier/creator/overzicht', {}); } catch(e){ cr = null; }
    renderCreator();
  }
  function crToe(r){ if (r && r.overzicht) cr = r.overzicht; else if (r && r.stats) cr = r; renderCreator(); }
  function renderCreator(){
    const el = $('#creatorWrap'); if (!el) return;
    if (!has('creator')){ el.innerHTML = ''; return; }
    if (!cr){ el.innerHTML = '<div class="empty">…</div>'; laadCreator(); return; }
    const canEdit = actor().manager, o = cr, st = o.stats || {};
    const inp = 'style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"';
    const kort = n => n >= 1000 ? (Math.round(n/100)/10)+'K' : String(n);
    let html = '';
    // profiel
    html += '<div class="card"><div class="tt-h">🎬 '+T('cr.profiel','Profiel')+'</div>'+
      (canEdit ? '<div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem;"><input id="crNiche" placeholder="'+T('cr.niche','Niche (bijv. Reizen & lifestyle)')+'" value="'+escAttr(o.niche||'')+'" '+inp+'><textarea id="crBio" placeholder="'+T('cr.bio','Korte bio')+'" '+inp+' rows="2">'+esc(o.bio||'')+'</textarea><button class="obtn primary" id="crProfielOp" style="align-self:flex-start;">'+T('cr.opslaan','Opslaan')+'</button></div>'
        : '<div style="margin-top:0.4rem;"><b>'+esc(o.niche||'')+'</b><div class="ds">'+esc(o.bio||'')+'</div></div>')+'</div>';
    // stats
    const tiles = [[kort(st.bereik||0), T('cr.bereik','totaal bereik')],[st.platforms||0, T('cr.platforms','platforms')],[st.teProduceren||0, T('cr.productie','in productie')],[st.gepost||0, T('cr.gepost','gepost')],['€ '+(st.gemTarief||0), T('cr.gemtarief','gem. tarief')],[st.portfolio||0, T('cr.portfolio','portfolio')]];
    html += '<div class="card"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;">'+
      tiles.map(c => '<div style="background:var(--card2,var(--card));border:1px solid var(--line);border-radius:12px;padding:0.6rem;text-align:center;"><div style="font-size:1.1rem;font-weight:700;color:var(--gold);">'+c[0]+'</div><div style="font-size:0.6rem;color:var(--soft);text-transform:uppercase;letter-spacing:0.05em;">'+c[1]+'</div></div>').join('')+'</div></div>';
    // platforms
    html += '<div class="card"><div class="tt-h">'+T('cr.platf','Platforms & bereik')+'</div>'+
      (o.platforms||[]).map(p => '<div class="mitem"><div class="r1"><span class="nm">'+(PLAT_ICO[p.platform]||'🔗')+' '+esc(p.handle||p.platform)+'</span><span class="pr">'+kort(p.volgers||0)+'</span></div>'+
        (canEdit?'<div style="margin-top:0.35rem;display:flex;gap:0.4rem;"><input type="number" min="0" data-pfvin="'+p.id+'" value="'+(p.volgers||0)+'" style="width:7rem;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:0.3rem 0.5rem;color:var(--txt);"><button class="obtn" data-pfvset="'+p.id+'">'+T('cr.volgersop','Bereik')+'</button><button class="rr-del" data-pfdel="'+p.id+'">✕</button></div>':'')+'</div>').join('')+
      (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><select id="crPfPlat" style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;color:var(--txt);">'+o.platformkeuze.map(p=>'<option value="'+p+'">'+(PLAT_ICO[p]||'')+' '+p+'</option>').join('')+'</select><input id="crPfHandle" placeholder="@handle" '+inp+' style="flex:1;min-width:7rem;"><input id="crPfVolg" type="number" min="0" placeholder="'+T('cr.volgers','volgers')+'" style="width:6rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;color:var(--txt);"><button class="obtn primary" id="crPfAdd">+</button></div>' : '')+'</div>';
    // tarieven
    html += '<div class="card"><div class="tt-h">'+T('cr.tarieven','Tarieven')+'</div>'+
      (o.tarieven||[]).map(t => '<div class="mitem"><div class="r1"><span class="nm">'+esc(t.soort)+'</span><span class="pr">€ '+(t.prijs||0)+(canEdit?' <button class="rr-del" data-trdel="'+t.id+'">✕</button>':'')+'</span></div></div>').join('')+
      (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><select id="crTrSoort" style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;color:var(--txt);">'+o.soortkeuze.map(x=>'<option value="'+x+'">'+x+'</option>').join('')+'</select><input id="crTrPrijs" type="number" min="0" placeholder="€" style="width:6rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;color:var(--txt);"><button class="obtn primary" id="crTrAdd">+</button></div>' : '')+'</div>';
    // content-kalender
    html += '<div class="card"><div class="tt-h">📅 '+T('cr.kalender','Content-kalender')+'</div>'+
      (o.ideeen||[]).map(i => '<div class="mitem" style="border-left:3px solid '+(IDEE_KL[i.status]||'var(--soft)')+';"><div class="r1"><span class="nm">'+esc(i.tekst)+'</span>'+(i.voor?'<span class="pr" style="color:var(--soft);">'+esc(i.voor)+'</span>':'')+'</div>'+
        '<div class="ds">'+T('cr.status.'+i.status, i.status)+(i.script?' · 📝 '+T('cr.heeftscript','script klaar'):'')+'</div>'+
        (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;">'+
          (i.status!=='productie'?'<button class="obtn" data-ideest="'+i.id+'" data-st="productie">▶ '+T('cr.naarprod','In productie')+'</button>':'')+
          (i.status!=='gepost'?'<button class="obtn primary" data-ideest="'+i.id+'" data-st="gepost">✓ '+T('cr.naargepost','Gepost')+'</button>':'')+
          (i.script?'<button class="obtn" data-ideescript="'+i.id+'">📝 '+T('cr.bekijkscript','Script')+'</button>':'')+
          '<button class="rr-del" data-ideedel="'+i.id+'">✕</button></div>':'')+
        '<div class="crScript" data-scriptbox="'+i.id+'" style="display:none;white-space:pre-wrap;font-size:0.8rem;color:var(--soft);margin-top:0.4rem;border-top:1px solid var(--line);padding-top:0.4rem;">'+esc(i.script||'')+'</div></div>').join('')+
      (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><input id="crIdTekst" placeholder="'+T('cr.nieuwidee','Nieuw idee')+'" '+inp+' style="flex:1;min-width:9rem;"><input id="crIdVoor" type="date" '+inp+'><button class="obtn primary" id="crIdAdd">+</button></div>' : '')+'</div>';
    // AI content-helper
    if (canEdit){
      html += '<div class="card"><div class="tt-h">✨ '+T('cr.ai','AI content-helper')+'</div>'+
        '<p class="sub" style="margin-top:0.3rem;">'+T('cr.ai.sub','Vraag om ideeen of een kant-en-klaar script, bijv. "schrijf een script voor een reel over een strandclub" of "voeg idee ... toe aan de kalender".')+'</p>'+
        '<div id="crAiOut" style="margin-top:0.5rem;"></div>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="crAiIn" placeholder="'+T('cr.ai.ph','Vraag of opdracht...')+'" '+inp+' style="flex:1;"><button class="obtn primary" id="crAiGo">'+T('cr.ai.go','Vraag')+'</button></div></div>';
    }
    el.innerHTML = html;
    // wiring
    const pOp = $('#crProfielOp'); if (pOp) pOp.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/profiel', { niche: $('#crNiche').value, bio: $('#crBio').value })); toast(T('cr.profielok','Profiel opgeslagen.')); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-pfvset]').forEach(b => b.addEventListener('click', async () => { const i2 = el.querySelector('[data-pfvin="'+b.dataset.pfvset+'"]'); try { crToe(await API.call('/supplier/creator/platform', { id: b.dataset.pfvset, volgers: i2?Number(i2.value):0 })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-pfdel]').forEach(b => b.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/platform', { weg: true, id: b.dataset.pfdel })); } catch(e){ toast(e.message); } }));
    const pfAdd = $('#crPfAdd'); if (pfAdd) pfAdd.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/platform', { platform: $('#crPfPlat').value, handle: $('#crPfHandle').value, volgers: Number($('#crPfVolg').value)||0 })); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-trdel]').forEach(b => b.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/tarief', { weg: true, id: b.dataset.trdel })); } catch(e){ toast(e.message); } }));
    const trAdd = $('#crTrAdd'); if (trAdd) trAdd.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/tarief', { soort: $('#crTrSoort').value, prijs: Number($('#crTrPrijs').value)||0 })); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-ideest]').forEach(b => b.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/idee', { id: b.dataset.ideest, status: b.dataset.st })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-ideedel]').forEach(b => b.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/idee', { weg: true, id: b.dataset.ideedel })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-ideescript]').forEach(b => b.addEventListener('click', () => { const box = el.querySelector('[data-scriptbox="'+b.dataset.ideescript+'"]'); if (box) box.style.display = box.style.display==='none'?'block':'none'; }));
    const idAdd = $('#crIdAdd'); if (idAdd) idAdd.addEventListener('click', async () => { const tekst = $('#crIdTekst').value.trim(); if (!tekst) return; try { crToe(await API.call('/supplier/creator/idee', { tekst, voor: $('#crIdVoor').value })); } catch(e){ toast(e.message); } });
    const aiGo = $('#crAiGo'); if (aiGo){
      const doe = async () => { const opdracht = $('#crAiIn').value.trim(); if (!opdracht) return; const out = $('#crAiOut'); out.innerHTML = '<div class="ds">'+T('cr.aidenkt','Even denken...')+'</div>';
        try { const r = await API.call('/supplier/creator/ai', { opdracht }); out.innerHTML = '<div class="mitem"'+(r.gedaan?' style="border-left:3px solid #7EE0A3;"':'')+'><div class="ds" style="color:var(--txt);white-space:pre-wrap;">'+esc(r.antwoord)+'</div></div>'; $('#crAiIn').value=''; if (r.overzicht){ cr = r.overzicht; } if (r.gedaan) renderCreator(); }
        catch(e){ out.innerHTML = '<div class="ds" style="color:#E0736A;">'+esc(e.message)+'</div>'; } };
      aiGo.addEventListener('click', doe);
      const aiIn = $('#crAiIn'); if (aiIn) aiIn.addEventListener('keydown', e => { if (e.key==='Enter') doe(); });
    }
  }

  // ---- samenwerken: creators <-> leveranciers, met EGn knop ----
  let sw = null, swLijst = null;
  const kortN = n => n >= 1000 ? (Math.round(n/100)/10)+'K' : String(n);
  async function laadSamenwerking(){
    if (!API.live) return;
    try { sw = await API.call('/supplier/samenwerking/mijn', {}); } catch(e){ sw = null; }
    try { swLijst = sw && sw.isCreator ? { leveranciers: (await API.call('/supplier/samenwerking/leveranciers', {})).leveranciers } : { creators: (await API.call('/supplier/samenwerking/creators', {})).creators }; } catch(e){ swLijst = {}; }
    renderSamenwerking();
  }
  function renderSamenwerking(){
    const el = $('#swWrap'); if (!el) return;
    if (!sw){ el.innerHTML = '<div class="empty">…</div>'; laadSamenwerking(); return; }
    const canEdit = actor().manager, mk = sw.isCreator;
    const st = 'style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"';
    const kaartAnder = a => a.niche != null || a.bereik != null
      ? '🎬 <b>'+esc(a.name)+'</b>'+(a.niche?' · '+esc(a.niche):'')+(a.bereik?' · '+kortN(a.bereik)+' '+T('sw.bereik','bereik'):'')
      : (a.icon||'🏷️')+' <b>'+esc(a.name)+'</b>'+(a.typeLabel?' · '+esc(a.typeLabel):'');
    const statusKl = { 'voorgesteld':'var(--gold)', 'geaccepteerd':'#7EE0A3', 'afgewezen':'#E0736A' };
    let html = '';
    // lopende samenwerkingen (in + uit)
    const inl = (sw.voorstellen&&sw.voorstellen.in)||[], uitl = (sw.voorstellen&&sw.voorstellen.uit)||[];
    html += '<div class="card"><div class="tt-h">🤝 '+T('sw.mijn','Mijn samenwerkingen')+'</div>'+
      (inl.length||uitl.length ? [].concat(inl,uitl).map(x => '<div class="mitem" style="border-left:3px solid '+(statusKl[x.status]||'var(--soft)')+';"><div class="r1"><span class="nm">'+kaartAnder(x.ander)+'</span><span class="pr" style="color:'+(statusKl[x.status]||'var(--soft)')+';">'+T('sw.st.'+x.status, x.status)+'</span></div>'+
        (x.bericht?'<div class="ds">'+esc(x.bericht)+(x.budget?' · € '+x.budget:'')+(x.soort?' · '+esc(x.soort):'')+'</div>':'')+
        (x.richting==='in'&&x.status==='voorgesteld'&&canEdit ? '<div style="margin-top:0.4rem;display:flex;gap:0.4rem;"><button class="obtn primary" data-swja="'+x.id+'">'+T('sw.accept','Accepteren')+'</button><button class="obtn" data-swnee="'+x.id+'">'+T('sw.afwijs','Afwijzen')+'</button></div>' : '')+
        '</div>').join('')
        : '<div class="ds" style="margin-top:0.5rem;">'+T('sw.geen','Nog geen samenwerkingen. Start er hieronder een.')+'</div>')+'</div>';

    if (mk){
      // CREATOR: leveranciers vinden + open oproepen
      html += '<div class="card"><div class="tt-h">'+T('sw.vind','Vind een leverancier om mee samen te werken')+'</div>'+
        ((swLijst&&swLijst.leveranciers)||[]).slice(0,40).map(l => '<div class="mitem"><div class="r1"><span class="nm">'+(l.icon||'🏷️')+' '+esc(l.name)+'</span><span class="pr" style="font-size:0.72rem;color:var(--soft);">'+esc(l.typeLabel||'')+'</span></div>'+
          (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;"><input placeholder="'+T('sw.pitch','Korte pitch...')+'" data-swpitch="'+l.code+'" '+st+' style="flex:1;min-width:8rem;"><button class="obtn primary" data-swvoorstel="'+l.code+'">🤝 '+T('sw.werksamen','Werk samen')+'</button></div>':'')+'</div>').join('')+'</div>';
      const oproepen = (sw.openOproepen||[]).filter(op => !op.ikReageerde);
      html += '<div class="card"><div class="tt-h">📣 '+T('sw.oproepen','Open oproepen van leveranciers')+' ('+oproepen.length+')</div>'+
        (oproepen.length ? oproepen.map(op => '<div class="mitem"><div class="r1"><span class="nm">'+esc(op.titel)+'</span><span class="pr">'+(op.budget?'€ '+op.budget:'')+'</span></div>'+
          '<div class="ds">'+(op.van?esc(op.van.name)+' · ':'')+esc(op.omschrijving||'')+(op.soort?' · '+esc(op.soort):'')+'</div>'+
          (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;"><input placeholder="'+T('sw.reactie','Jouw reactie...')+'" data-swreactie="'+op.id+'" '+st+' style="flex:1;min-width:8rem;"><button class="obtn primary" data-swreageer="'+op.id+'">'+T('sw.reageer','Reageer')+'</button></div>':'')+'</div>').join('')
          : '<div class="ds" style="margin-top:0.5rem;">'+T('sw.geenoproep','Nu geen open oproepen.')+'</div>')+'</div>';
    } else {
      // LEVERANCIER: creators oproepen + reacties + creators direct benaderen
      if (canEdit) html += '<div class="card"><div class="tt-h">📣 '+T('sw.roepop','Roep content creators op')+'</div>'+
        '<div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem;"><input id="swOpTitel" placeholder="'+T('sw.optitel','Titel (bijv. Zomercampagne)')+'" '+st+'><input id="swOpOms" placeholder="'+T('sw.opoms','Wat zoek je?')+'" '+st+'><div style="display:flex;gap:0.4rem;"><select id="swOpSoort" '+st+'>'+['reel','post','video','campagne','review','story'].map(x=>'<option value="'+x+'">'+x+'</option>').join('')+'</select><input id="swOpBudget" type="number" min="0" placeholder="'+T('sw.budget','budget €')+'" style="width:7rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;color:var(--txt);"><button class="obtn primary" id="swOpPlaats">'+T('sw.plaats','Plaats oproep')+'</button></div></div></div>';
      // mijn oproepen met reacties
      (sw.mijnOproepen||[]).forEach(op => {
        html += '<div class="card"><div class="tt-h">'+esc(op.titel)+' '+(op.open?'<span style="font-size:0.68rem;color:#7EE0A3;">'+T('sw.open','open')+'</span>':'<span style="font-size:0.68rem;color:var(--soft);">'+T('sw.dicht','gesloten')+'</span>')+'</div>'+
          '<div class="ds" style="margin-bottom:0.4rem;">'+esc(op.omschrijving||'')+(op.budget?' · € '+op.budget:'')+'</div>'+
          ((op.reacties||[]).length ? (op.reacties||[]).map(r => '<div class="mitem"><div class="r1"><span class="nm">🎬 '+esc(r.creator.name)+(r.creator.bereik?' · '+kortN(r.creator.bereik):'')+'</span>'+(r.status==='gekozen'?'<span class="pr" style="color:#7EE0A3;">'+T('sw.gekozen','gekozen')+'</span>':'')+'</div>'+
            (r.bericht?'<div class="ds">'+esc(r.bericht)+'</div>':'')+
            (canEdit&&r.status!=='gekozen'&&op.open?'<div style="margin-top:0.35rem;"><button class="obtn primary" data-swkies="'+op.id+'" data-creator="'+r.creatorCode+'">'+T('sw.kiesdeze','Kies deze creator')+'</button></div>':'')+'</div>').join('')
            : '<div class="ds">'+T('sw.geenreacties','Nog geen reacties.')+'</div>')+
          (canEdit&&op.open?'<button class="obtn" data-swsluit="'+op.id+'" style="margin-top:0.5rem;">'+T('sw.sluit','Oproep sluiten')+'</button>':'')+'</div>';
      });
      // creators direct benaderen
      html += '<div class="card"><div class="tt-h">🎬 '+T('sw.vindcreator','Benader een creator direct')+'</div>'+
        ((swLijst&&swLijst.creators)||[]).slice(0,40).map(c => '<div class="mitem"><div class="r1"><span class="nm">'+esc(c.name)+(c.niche?' · '+esc(c.niche):'')+'</span><span class="pr">'+kortN(c.bereik||0)+'</span></div>'+
          (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;"><input placeholder="'+T('sw.pitch','Korte pitch...')+'" data-swpitch="'+c.code+'" '+st+' style="flex:1;min-width:8rem;"><button class="obtn primary" data-swvoorstel="'+c.code+'">🤝 '+T('sw.werksamen','Werk samen')+'</button></div>':'')+'</div>').join('')+'</div>';
    }
    el.innerHTML = html;
    // wiring
    el.querySelectorAll('[data-swja]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/samenwerking/beslis', { id: b.dataset.swja, actie: 'accepteren' }); toast(T('sw.geaccept','Samenwerking geaccepteerd.')); laadSamenwerking(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-swnee]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/samenwerking/beslis', { id: b.dataset.swnee, actie: 'afwijzen' }); laadSamenwerking(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-swvoorstel]').forEach(b => b.addEventListener('click', async () => { const pi = el.querySelector('[data-swpitch="'+b.dataset.swvoorstel+'"]'); try { await API.call('/supplier/samenwerking/voorstel', { naarCode: b.dataset.swvoorstel, bericht: pi?pi.value:'' }); toast(T('sw.verstuurd','Voorstel verstuurd.')); laadSamenwerking(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-swreageer]').forEach(b => b.addEventListener('click', async () => { const ri = el.querySelector('[data-swreactie="'+b.dataset.swreageer+'"]'); try { await API.call('/supplier/samenwerking/reageer', { oproepId: b.dataset.swreageer, bericht: ri?ri.value:'' }); toast(T('sw.gereageerd','Reactie verstuurd.')); laadSamenwerking(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-swkies]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/samenwerking/kies', { oproepId: b.dataset.swkies, creatorCode: b.dataset.creator }); toast(T('sw.gekozenok','Creator gekozen; samenwerking staat vast.')); laadSamenwerking(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-swsluit]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/samenwerking/oproep/sluit', { id: b.dataset.swsluit }); laadSamenwerking(); } catch(e){ toast(e.message); } }));
    const opP = $('#swOpPlaats'); if (opP) opP.addEventListener('click', async () => { const titel = $('#swOpTitel').value.trim(); if (!titel) return; try { await API.call('/supplier/samenwerking/oproep', { titel, omschrijving: $('#swOpOms').value, soort: $('#swOpSoort').value, budget: Number($('#swOpBudget').value)||0 }); toast(T('sw.oproepok','Oproep geplaatst; creators zien het.')); laadSamenwerking(); } catch(e){ toast(e.message); } });
  }

  // ---- facturen: automatisch bij elke verkoop, plus de AI-factuurtool ----
  let fact = null, factAiAntwoord = '';   // het laatste AI-antwoord blijft staan over herbouw heen
  async function laadFacturen(){
    if (!API.live) return;
    try { fact = await API.call('/supplier/facturen/mijn', {}); } catch(e){ fact = { verkocht:[], gekocht:[], stats:{} }; }
    renderFacturen();
  }
  function factRij(f, kant){
    return '<div class="mitem"><div class="r1"><span class="nm">'+esc(f.nummer)+' · '+esc(kant==='in'?f.verkoper:f.koper)+'</span><span class="pr">'+geld(f.totaal)+'</span></div>'+
      '<div class="ds">'+esc(f.datum)+' · '+T('fact.soort.'+f.soort, f.soort)+' · '+T('fact.btw','btw')+' '+geld(f.btwBedrag)+(f.methode?' · '+esc(f.methode):'')+'</div>'+
      '<div style="margin-top:0.35rem;"><button class="obtn" data-factpdf="'+f.id+'" data-nr="'+escAttr(f.nummer)+'">⬇ PDF</button></div></div>';
  }
  function renderFacturen(){
    const el = $('#factWrap'); if (!el) return;
    if (!fact){ el.innerHTML = '<div class="empty">…</div>'; laadFacturen(); return; }
    const canEdit = actor().manager, st = fact.stats || {};
    let html = '';
    html += '<div class="card"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;">'+
      [[st.verkocht||0, T('fact.verkocht','verkoopfacturen')],[geld(st.omzet||0), T('fact.omzet','omzet')],[geld(st.btwAfdracht||0), T('fact.btwaf','btw')]]
      .map(c => '<div style="background:var(--card2,var(--card));border:1px solid var(--line);border-radius:12px;padding:0.6rem;text-align:center;"><div style="font-size:1.05rem;font-weight:700;color:var(--gold);">'+c[0]+'</div><div style="font-size:0.6rem;color:var(--soft);text-transform:uppercase;letter-spacing:0.05em;">'+c[1]+'</div></div>').join('')+'</div></div>';
    if (canEdit){
      html += '<div class="card"><div class="tt-h">✨ '+T('fact.ai','AI-factuurtool')+'</div>'+
        '<p class="sub" style="margin-top:0.3rem;">'+T('fact.ai.sub','Vraag iets, of maak een factuur in gewone taal: "maak een factuur voor [codenaam], 3 uur advies a 90 euro".')+'</p>'+
        '<div id="factAiOut" style="margin-top:0.5rem;"></div>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="factAiIn" placeholder="'+T('fact.ai.ph','Vraag of opdracht...')+'" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.7rem;color:var(--txt);"><button class="obtn primary" id="factAiGo">'+T('fact.ai.go','Vraag')+'</button></div></div>';
    }
    html += '<div class="card"><div class="tt-h">'+T('fact.uit','Verstuurde facturen')+' ('+(fact.verkocht||[]).length+')</div>'+
      ((fact.verkocht||[]).length ? (fact.verkocht||[]).slice(0,60).map(f => factRij(f,'uit')).join('') : '<div class="ds" style="margin-top:0.5rem;">'+T('fact.geenuit','Nog geen facturen. Bij elke kassaverkoop komt hier automatisch een factuur.')+'</div>')+'</div>';
    if ((fact.gekocht||[]).length) html += '<div class="card"><div class="tt-h">'+T('fact.in','Ontvangen facturen')+' ('+fact.gekocht.length+')</div>'+
      fact.gekocht.slice(0,60).map(f => factRij(f,'in')).join('')+'</div>';
    el.innerHTML = html;
    // het laatste AI-antwoord terugzetten, zodat een tussentijdse herbouw (bijv.
    // door de sync-SSE van de nieuwe factuur) het niet wegveegt
    const outHerstel = $('#factAiOut'); if (outHerstel && factAiAntwoord) outHerstel.innerHTML = factAiAntwoord;
    el.querySelectorAll('[data-factpdf]').forEach(b => b.addEventListener('click', () => dlBestand('/supplier/facturen/pdf', { id: b.dataset.factpdf }, (b.dataset.nr||'factuur')+'.pdf')));
    const aiGo = $('#factAiGo'); if (aiGo){
      const doe = async () => { const opdracht = $('#factAiIn').value.trim(); if (!opdracht) return; factAiAntwoord = '<div class="ds">…</div>'; const out = $('#factAiOut'); out.innerHTML = factAiAntwoord;
        try { const r = await API.call('/supplier/facturen/ai', { opdracht });
          factAiAntwoord = '<div class="mitem"'+(r.gedaan?' style="border-left:3px solid #7EE0A3;"':'')+'><div class="ds" style="color:var(--txt);white-space:pre-wrap;">'+esc(r.antwoord)+'</div></div>';
          if (r.overzicht){ fact = r.overzicht; }
          renderFacturen(); }
        catch(e){ factAiAntwoord = '<div class="ds" style="color:#E0736A;">'+esc(e.message)+'</div>'; const o2 = $('#factAiOut'); if (o2) o2.innerHTML = factAiAntwoord; } };
      aiGo.addEventListener('click', doe);
      const i2 = $('#factAiIn'); if (i2) i2.addEventListener('keydown', e => { if (e.key==='Enter') doe(); });
    }
  }

  // ---- De Salon: de zaak verkoopt (optioneel) op de gezinsmarktplaats ----
  let rtfmData = null, rtfmCats = [], rtfmStaatVar = 'gebruikt', rtfmBusy = false;
  async function laadRtfm(){
    if (rtfmBusy) return; rtfmBusy = true;
    try { rtfmData = await API.call('/supplier/markt/mijn', {}); if (rtfmData.categorieen) rtfmCats = rtfmData.categorieen; }
    catch(e){ rtfmData = { ads: [], postvak: [] }; }
    rtfmBusy = false; renderRtfMarkt();
  }
  function rtfmCatNaam(c){ return ({kleding:'Kleding',kids:'Kids & baby',wonen:'Wonen',elektronica:'Elektronica','vrije-tijd':'Vrije tijd',tuin:'Tuin',vervoer:'Vervoer',boeken:'Boeken',sport:'Sport',overig:'Overig'}[c])||c; }
  function renderRtfMarkt(){
    const el = $('#mktWrap'); if (!el) return;
    if (!rtfmData){ el.innerHTML = '<div class="empty">…</div>'; laadRtfm(); return; }
    const canEdit = actor().manager;
    let html = '';
    if (canEdit){
      html += '<div class="card"><div class="tt-h">➕ '+T('mkt.plaats','Plaats een advertentie')+'</div>'+
        '<input id="mktTitel" placeholder="'+T('mkt.titel','Titel, bijv. Etalagepop tweedehands')+'" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.7rem;color:var(--txt);margin-top:0.5rem;">'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.4rem;flex-wrap:wrap;">'+
          '<select id="mktCat" style="flex:1;min-width:8rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.6rem;color:var(--txt);">'+rtfmCats.map(c=>'<option value="'+c+'">'+rtfmCatNaam(c)+'</option>').join('')+'</select>'+
          '<select id="mktStaat" style="flex:1;min-width:8rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.6rem;color:var(--txt);"><option value="gebruikt">Gebruikt</option><option value="zgan">Zo goed als nieuw</option><option value="nieuw">Nieuw</option></select>'+
          '<input id="mktPrijs" type="number" inputmode="numeric" placeholder="€" style="width:5.5rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.6rem;color:var(--txt);">'+
        '</div>'+
        '<textarea id="mktOms" placeholder="'+T('mkt.oms','Omschrijving')+'" style="width:100%;min-height:4rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.7rem;color:var(--txt);margin-top:0.4rem;"></textarea>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.4rem;flex-wrap:wrap;">'+
          '<input id="mktPlaats" placeholder="'+T('mkt.plaatsnaam','Plaats')+'" style="flex:1;min-width:6rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.6rem;color:var(--txt);">'+
          '<button class="obtn" id="mktAiOms">✨ '+T('mkt.aioms','AI-omschrijving')+'</button>'+
          '<button class="obtn" id="mktAiPrijs">✨ '+T('mkt.aiprijs','AI-prijs')+'</button>'+
        '</div>'+
        '<div id="mktAiUit" class="sub" style="margin-top:0.35rem;color:var(--gold);"></div>'+
        '<label style="display:flex;gap:0.5rem;align-items:flex-start;font-size:0.8rem;color:var(--soft);margin:0.6rem 0;"><input type="checkbox" id="mktAkkoord" style="margin-top:0.2rem;"><span>'+T('mkt.akkoord','Ik bied alleen toegestane waar aan en houd het netjes en respectvol.')+'</span></label>'+
        '<button class="obtn primary" id="mktPlaatsBtn" style="width:100%;">'+T('mkt.plaatsbtn','Zet in De Salon')+'</button>'+
        '<div id="mktMelding" class="sub" style="margin-top:0.4rem;"></div></div>';
    }
    const ads = rtfmData.ads || [];
    html += '<div class="card"><div class="tt-h">'+T('mkt.mijn','Mijn advertenties')+' ('+ads.length+')</div>'+
      (ads.length ? ads.map(a =>
        '<div class="mitem" style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;"><div><b>'+esc(a.titel)+'</b><div class="ds">'+(a.prijs>0?'€ '+a.prijs:'Gratis')+' · '+a.status+(a.meldingen?' · '+a.meldingen+' melding(en)':'')+'</div></div>'+
        '<div style="display:flex;gap:0.3rem;">'+(canEdit?(a.status!=='verkocht'?'<button class="obtn" data-mktverk="'+a.id+'">'+T('mkt.verkocht','Verkocht')+'</button>':'<button class="obtn" data-mktheropen="'+a.id+'">'+T('mkt.heropen','Te koop')+'</button>')+'<button class="obtn warn" data-mktdel="'+a.id+'">'+T('mkt.del','Verwijder')+'</button>':'')+'</div></div>'
      ).join('') : '<div class="ds" style="margin-top:0.5rem;">'+T('mkt.geen','Nog niets geplaatst. Zet uw eerste advertentie hierboven.')+'</div>')+'</div>';
    const pv = rtfmData.postvak || [];
    if (pv.length) html += '<div class="card"><div class="tt-h">'+T('mkt.berichten','Berichten')+' ('+pv.length+')</div>'+
      pv.map(c => '<div class="mitem"><b>'+esc(c.adTitel)+'</b><div class="ds">'+esc(c.metNaam)+': '+esc(c.laatste)+'</div></div>').join('')+'</div>';
    el.innerHTML = html;
    const uit = $('#mktAiUit');
    const aiOms = $('#mktAiOms'); if (aiOms) aiOms.addEventListener('click', async () => {
      const titel = $('#mktTitel').value.trim(); if (!titel){ uit.textContent = T('mkt.eerst','Vul eerst een titel in.'); return; }
      try { const r = await API.call('/supplier/markt/ai', { soort:'beschrijving', titel, beschrijving:$('#mktOms').value.trim(), categorie:$('#mktCat').value, staat:$('#mktStaat').value }); if (r.tekst) $('#mktOms').value = r.tekst; } catch(e){}
    });
    const aiPr = $('#mktAiPrijs'); if (aiPr) aiPr.addEventListener('click', async () => {
      try { const r = await API.call('/supplier/markt/ai', { soort:'prijs', titel:$('#mktTitel').value.trim(), categorie:$('#mktCat').value, staat:$('#mktStaat').value }); if (r.prijs && !$('#mktPrijs').value) $('#mktPrijs').value = r.prijs.midden; uit.textContent = r.tekst||''; } catch(e){}
    });
    const plaatsBtn = $('#mktPlaatsBtn'); if (plaatsBtn) plaatsBtn.addEventListener('click', async () => {
      const m = $('#mktMelding');
      try {
        const r = await API.call('/supplier/markt/plaats', { akkoord:$('#mktAkkoord').checked, titel:$('#mktTitel').value.trim(), beschrijving:$('#mktOms').value.trim(), categorie:$('#mktCat').value, staat:$('#mktStaat').value, prijs:Number($('#mktPrijs').value)||0, plaats:$('#mktPlaats').value.trim(), levering:['ophalen'] });
        m.style.color = '#7EE0A3'; m.textContent = r.waarschuwing ? T('mkt.let','Geplaatst. Let op: ')+r.waarschuwing : T('mkt.gedaan','Geplaatst in De Salon.');
        rtfmData = null; laadRtfm();
      } catch(e){ m.style.color = '#E0736A'; m.textContent = e.message; }
    });
    el.querySelectorAll('[data-mktverk]').forEach(b => b.addEventListener('click', async () => { await API.call('/supplier/markt/status', { id:b.dataset.mktverk, status:'verkocht' }).catch(()=>{}); rtfmData=null; laadRtfm(); }));
    el.querySelectorAll('[data-mktheropen]').forEach(b => b.addEventListener('click', async () => { await API.call('/supplier/markt/status', { id:b.dataset.mktheropen, status:'te-koop' }).catch(()=>{}); rtfmData=null; laadRtfm(); }));
    el.querySelectorAll('[data-mktdel]').forEach(b => b.addEventListener('click', async () => { if(!confirm(T('mkt.delc','Deze advertentie verwijderen?')))return; await API.call('/supplier/markt/verwijder', { id:b.dataset.mktdel }).catch(()=>{}); rtfmData=null; laadRtfm(); }));
  }

  // ---- retail / mode: de slimme merk-backoffice ----
  let retailData = null;         // volledige retail-toestand van de server
  let retailSec = 'overzicht';   // overzicht | catalogus | voorraad | clienteling
  let retailKlant = null;        // geopend klantdossier (clienteling)
  let retailArtBewerk = null;    // id van het artikel dat bewerkt wordt (of 'nieuw')
  const RSEC = [['overzicht','📈','Overzicht'],['catalogus','👗','Collecties'],['voorraad','📦','Voorraad'],['clienteling','💎','Klanten']];
  async function laadRetail(){
    if (!has('retail') || !API.live) return;
    try { retailData = (await API.call('/supplier/retail', {})).retail; } catch(e){ retailData = { collecties:[], artikelen:[], apart:[], paskamer:[], styling:[], klanten:[], stats:{}, maten:[], seizoenen:[] }; }
    renderRetail();
  }
  function rSelStyle(){ return 'style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"'; }
  function retailSubnav(){
    return '<div class="st-chips" style="display:flex;gap:0.4rem;overflow-x:auto;margin-bottom:0.9rem;-webkit-overflow-scrolling:touch;">'+
      RSEC.map(s => { const on = retailSec===s[0]; return '<button data-rsec="'+s[0]+'" style="white-space:nowrap;border:1px solid '+(on?'var(--gold)':'var(--line)')+';background:var(--card2);color:'+(on?'var(--gold)':'var(--txt)')+';border-radius:999px;padding:0.5rem 0.9rem;font-size:0.74rem;font-weight:'+(on?'600':'500')+';">'+s[1]+' '+T('rt.sec.'+s[0], s[2])+'</button>'; }).join('')+'</div>';
  }
  function collNaam(cid){ const c = (retailData.collecties||[]).find(x => x.id===cid); return c ? (c.seizoen+' '+c.jaar+' · '+c.naam) : T('rt.los','Losse artikelen'); }
  function renderRetail(){
    const el = $('#retailWrap'); if (!el) return;
    if (!has('retail')){ el.innerHTML = ''; return; }
    if (!retailData){ el.innerHTML = '<div class="empty">…</div>'; laadRetail(); return; }
    const canEdit = actor().manager;
    let html = retailSubnav();
    if (retailSec === 'overzicht') html += retailOverzicht(canEdit);
    else if (retailSec === 'catalogus') html += retailCatalogusView(canEdit);
    else if (retailSec === 'voorraad') html += retailVoorraadView();
    else if (retailSec === 'clienteling') html += retailClienteling(canEdit);
    el.innerHTML = html;
    el.querySelectorAll('[data-rsec]').forEach(b => b.addEventListener('click', () => { retailSec = b.dataset.rsec; retailKlant = null; retailArtBewerk = null; renderRetail(); }));
    retailBindActions(el, canEdit);
  }
  function retailOverzicht(canEdit){
    const st = retailData.stats || {};
    const kpi = (v,l) => '<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0.7rem 0.8rem;"><div style="font-size:1.25rem;font-weight:700;">'+v+'</div><div class="tt-h" style="margin-top:0.15rem;">'+l+'</div></div>';
    let html = '<div class="card"><div class="tt-h">'+T('rt.vandaag','Vandaag')+'</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-top:0.6rem;">'+
      kpi(geld(st.omzetVandaag||0), T('rt.omzet','omzet'))+kpi(st.bonnenVandaag||0, T('rt.bonnen','bonnen'))+kpi(st.klanten||0, T('rt.klanten','klanten'))+
      kpi(st.artikelen||0, T('rt.artikelen','artikelen'))+kpi(st.voorraadTotaal||0, T('rt.voorraad','stuks voorraad'))+kpi((retailData.paskamer||[]).length+(retailData.apart||[]).length, T('rt.vloer','op de vloer'))+
      '</div></div>';
    // bestsellers
    const bs = st.bestsellers || [];
    html += '<div class="card"><div class="tt-h">'+T('rt.bestsellers','Bestsellers')+'</div>'+
      (bs.length ? '<div style="margin-top:0.5rem;">'+bs.map((b,i) => '<div class="mitem"><div class="r1"><span class="nm">'+(i+1)+'. '+esc(b.naam)+'</span><span class="pr">'+b.aantal+'×</span></div></div>').join('') + '</div>'
        : '<div class="empty">'+T('rt.geenverkoop','Nog geen verkopen vandaag.')+'</div>')+'</div>';
    // sell-through per collectie (balkjes)
    const sthr = st.sellThrough || [];
    if (sthr.length) html += '<div class="card"><div class="tt-h">'+T('rt.sellthrough','Sell-through per collectie')+'</div>'+
      '<div style="margin-top:0.5rem;display:grid;gap:0.6rem;">'+sthr.map(c =>
        '<div><div style="display:flex;justify-content:space-between;font-size:0.8rem;"><span>'+esc(c.collectie)+'</span><span style="color:var(--gold);">'+c.pct+'%</span></div>'+
        '<div style="height:7px;background:var(--card2);border-radius:999px;margin-top:0.3rem;overflow:hidden;"><div style="height:100%;width:'+c.pct+'%;background:var(--gold);"></div></div>'+
        '<div class="tt-h" style="margin-top:0.2rem;">'+c.verkocht+' '+T('rt.verkocht','verkocht')+' · '+c.voorraad+' '+T('rt.opvoorraad','op voorraad')+'</div></div>').join('')+'</div></div>';
    // lage voorraad / bijbestellen
    const laag = st.laag || [];
    html += '<div class="card"><div class="tt-h">'+T('rt.bijbestel','Bijbestellen (lage voorraad)')+'</div>'+
      (laag.length ? '<div style="margin-top:0.5rem;">'+laag.map(v => '<div class="mitem"><div class="r1"><span class="nm">'+esc(v.artikel)+'</span><span class="pr" style="color:'+(v.voorraad<=0?'var(--burgundy)':'var(--amber)')+';">'+v.voorraad+'</span></div><div class="ds">'+esc(v.kleur)+' · '+T('rt.maat','maat')+' '+esc(v.maat)+' · '+esc(v.vsku)+'</div></div>').join('')+'</div>'
        : '<div class="empty">'+T('rt.voorraadok','Alle maten ruim op voorraad.')+'</div>')+'</div>';
    // open paskamerverzoeken (ook af te handelen vanuit de backoffice)
    const pk = retailData.paskamer || [];
    if (pk.length) html += '<div class="card"><div class="tt-h">'+T('rt.paskamer','Paskamerverzoeken')+'</div>'+
      '<div style="margin-top:0.5rem;">'+pk.map(v => '<div class="mitem"><div class="r1"><span class="nm">'+esc(v.artikelNaam)+'</span><span class="pr">'+esc(v.maat)+'</span></div>'+
        '<div class="ds">'+esc(v.codenaam||'Gast')+' · '+esc(v.kleur)+(v.paskamer?' · '+esc(v.paskamer):'')+'</div>'+
        '<div style="margin-top:0.4rem;"><button class="obtn primary" data-rpkbreng="'+v.id+'">'+T('rt.breng','Breng gebracht')+'</button></div></div>').join('')+'</div></div>';
    // artikelen met een aangekondigde drop (release)
    if (canEdit){
      const drops = (retailData.artikelen||[]).filter(a => a.drop && !a.drop.gereleased);
      if (drops.length) html += '<div class="card"><div class="tt-h">'+T('rt.drops','Aangekondigde drops')+'</div>'+
        '<div style="margin-top:0.5rem;">'+drops.map(a => '<div class="mitem"><div class="r1"><span class="nm">'+esc(a.naam)+'</span><span class="pr">'+esc(a.drop.datum)+' '+esc(a.drop.tijd)+'</span></div>'+
          '<div style="margin-top:0.4rem;"><button class="obtn primary" data-rrelease="'+a.id+'">'+T('rt.release','Nu vrijgeven')+'</button></div></div>').join('')+'</div></div>';
    }
    return html;
  }
  function retailCatalogusView(canEdit){
    let html = '';
    // collecties
    const cols = retailData.collecties || [];
    html += '<div class="card"><div class="tt-h">'+T('rt.collecties','Collecties')+'</div>'+
      (cols.length ? '<div style="margin-top:0.5rem;">'+cols.map(c => '<div class="mitem"><div class="r1"><span class="nm">'+esc(c.naam)+'</span><span class="pr">'+esc(c.seizoen)+' '+c.jaar+'</span></div>'+
        (canEdit?'<div style="margin-top:0.4rem;"><button class="obtn warn" data-rcoldel="'+c.id+'">'+T('rt.verwijder','Verwijder')+'</button></div>':'')+'</div>').join('')+'</div>'
        : '<div class="empty">'+T('rt.geencoll','Nog geen collecties.')+'</div>')+
      (canEdit ? '<div style="margin-top:0.7rem;display:grid;grid-template-columns:1fr auto auto auto;gap:0.4rem;align-items:end;">'+
        '<div class="field" style="margin:0;"><label>'+T('rt.f.collnaam','Naam')+'</label><input id="rColNaam" placeholder="'+T('rt.f.collnaamph','Bijv. Riviera')+'"></div>'+
        '<div class="field" style="margin:0;"><label>'+T('rt.f.seizoen','Seizoen')+'</label><select id="rColSeiz" '+rSelStyle()+'>'+(retailData.seizoenen||['SS','AW']).map(s=>'<option>'+s+'</option>').join('')+'</select></div>'+
        '<div class="field" style="margin:0;width:70px;"><label>'+T('rt.f.jaar','Jaar')+'</label><input id="rColJaar" type="number" value="'+(new Date().getFullYear())+'"></div>'+
        '<button class="obtn primary" id="rColAdd">'+T('rt.f.voeg','Voeg toe')+'</button></div>' : '')+'</div>';
    // artikelen
    const arts = retailData.artikelen || [];
    html += '<div class="card"><div class="tt-h">'+T('rt.artikelen2','Artikelen')+' ('+arts.length+')</div>'+
      (arts.length ? '<div style="margin-top:0.5rem;display:grid;gap:0.5rem;">'+arts.map(a => {
        const drop = a.drop && !a.drop.gereleased ? '<span class="pill" style="color:var(--gold);border-color:rgba(212,175,55,0.4);margin-left:0.3rem;">'+T('rt.drop','drop')+' '+esc(a.drop.datum)+'</span>' : '';
        return '<div class="mitem"><div style="display:flex;gap:0.7rem;">'+
          (a.foto ? '<img src="'+esc(a.foto)+'" alt="'+esc(a.naam)+'" style="width:52px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0;">' : '<div style="width:52px;height:64px;border-radius:8px;background:var(--card2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">👗</div>')+
          '<div style="flex:1;min-width:0;"><div class="r1"><span class="nm">'+esc(a.naam)+drop+'</span><span class="pr">'+geld(a.price)+'</span></div>'+
          '<div class="ds">'+esc(collNaam(a.collectieId))+' · '+esc(a.categorie||'')+'</div>'+
          '<div class="ds">'+esc((a.varianten||[]).map(v=>v.kleur).filter((x,i,z)=>z.indexOf(x)===i).join(', '))+' · '+T('rt.totvoorraad','voorraad')+' '+(a.voorraad||0)+'</div>'+
          (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;"><button class="obtn" data-rartedit="'+a.id+'">'+T('rt.bewerk','Bewerk')+'</button><button class="obtn warn" data-rartdel="'+a.id+'">'+T('rt.verwijder','Verwijder')+'</button></div>':'')+
          '</div></div></div>';
      }).join('')+'</div>' : '<div class="empty">'+T('rt.geenart','Nog geen artikelen.')+'</div>')+
      (canEdit ? '<div style="margin-top:0.8rem;"><button class="obtn primary" id="rArtNieuw">'+T('rt.nieuwart','+ Nieuw artikel')+'</button></div>' : '')+'</div>';
    // artikel-formulier
    if (canEdit && retailArtBewerk) html += retailArtikelForm();
    return html;
  }
  function retailArtikelForm(){
    const a = retailArtBewerk === 'nieuw' ? null : (retailData.artikelen||[]).find(x => x.id === retailArtBewerk);
    const maten = retailData.maten || ['XS','S','M','L','XL','XXL'];
    const gekozenM = a ? [...new Set((a.varianten||[]).map(v=>v.maat))] : ['S','M','L'];
    const kleuren = a ? [...new Set((a.varianten||[]).map(v=>v.kleur))].join(', ') : '';
    return '<div class="card" id="rArtForm"><div class="tt-h">'+(a?T('rt.bewerkart','Artikel bewerken'):T('rt.nieuwart2','Nieuw artikel'))+'</div>'+
      '<div class="field"><label>'+T('rt.f.naam','Naam')+'</label><input id="rArtNaam" value="'+esc(a?a.naam:'')+'" placeholder="'+T('rt.f.naamph','Bijv. Zijden slipdress')+'"></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">'+
        '<div class="field"><label>'+T('rt.f.sku','SKU')+'</label><input id="rArtSku" value="'+esc(a?a.sku:'')+'" placeholder="'+T('rt.optioneel','optioneel')+'"></div>'+
        '<div class="field"><label>'+T('rt.f.cat','Categorie')+'</label><input id="rArtCat" value="'+esc(a?a.categorie:'')+'" placeholder="'+T('rt.f.catph','Bijv. Jurken')+'"></div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">'+
        '<div class="field"><label>'+T('rt.f.materiaal','Materiaal')+'</label><input id="rArtMat" value="'+esc(a?a.materiaal:'')+'" placeholder="'+T('rt.f.materiaalph','Bijv. 100% zijde')+'"></div>'+
        '<div class="field"><label>'+T('rt.f.prijs','Publieke prijs (€)')+'</label><input id="rArtPrijs" type="number" step="0.01" value="'+(a?a.publiekePrijs:'')+'"></div>'+
      '</div>'+
      '<div class="field"><label>'+T('rt.f.coll','Collectie')+'</label><select id="rArtColl" '+rSelStyle()+'>'+(retailData.collecties||[]).map(c=>'<option value="'+c.id+'"'+(a&&a.collectieId===c.id?' selected':'')+'>'+esc(c.seizoen+' '+c.jaar+' · '+c.naam)+'</option>').join('')+'</select></div>'+
      '<div class="field"><label>'+T('rt.f.oms','Omschrijving')+'</label><textarea id="rArtOms" rows="2">'+esc(a?a.omschrijving:'')+'</textarea></div>'+
      '<div class="field"><label>'+T('rt.f.kleuren','Kleuren (komma’s)')+'</label><input id="rArtKleuren" value="'+esc(kleuren)+'" placeholder="'+T('rt.f.kleurenph','Bijv. Zwart, Ivoor, Camel')+'"></div>'+
      '<div class="field"><label>'+T('rt.f.maten','Maten')+'</label><div id="rArtMaten" style="display:flex;flex-wrap:wrap;gap:0.4rem;">'+
        maten.map(m => '<button type="button" class="obtn rmaat'+(gekozenM.includes(m)?' primary':'')+'" data-rmaat="'+m+'">'+m+'</button>').join('')+'</div></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">'+
        '<div class="field"><label>'+T('rt.f.startvoorraad','Startvoorraad p. maat')+'</label><input id="rArtVoorraad" type="number" value="'+(a?'':'8')+'" placeholder="'+T('rt.optioneel','optioneel')+'"></div>'+
        '<div class="field"><label>'+T('rt.f.drop','Drop-datum')+'</label><input id="rArtDrop" type="date" value="'+esc(a&&a.drop?a.drop.datum:'')+'"></div>'+
      '</div>'+
      '<div class="field"><label>'+T('rt.f.foto','Foto')+'</label><label class="obtn" style="cursor:pointer;">📷 '+T('rt.f.kiesfoto','Kies foto')+'<input type="file" id="rArtFoto" accept="image/*" style="display:none;"></label> <span id="rArtFotoNaam" style="font-size:0.75rem;color:var(--muted);">'+(a&&a.foto?T('rt.fotoaanwezig','foto aanwezig'):'')+'</span></div>'+
      '<div style="margin-top:0.8rem;display:flex;gap:0.5rem;"><button class="obtn primary" id="rArtBewaar">'+T('rt.bewaar','Bewaar artikel')+'</button><button class="obtn" id="rArtAnnuleer">'+T('rt.annuleer','Annuleer')+'</button></div></div>';
  }
  function retailVoorraadView(){
    let html = '<div class="card"><div class="tt-h">'+T('rt.zoekvoorraad','Voorraad opzoeken')+'</div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="rZoek" placeholder="'+T('rt.zoekph','Naam, kleur of maat…')+'" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.9rem;color:var(--txt);outline:none;"><button class="obtn primary" id="rZoekBtn">'+T('rt.zoek','Zoek')+'</button></div>'+
      '<div id="rZoekUit" style="margin-top:0.6rem;"></div></div>';
    // alle varianten met snelle bijstelknoppen
    html += '<div class="card"><div class="tt-h">'+T('rt.allevoorraad','Alle voorraad')+'</div><div style="margin-top:0.5rem;">'+
      (retailData.artikelen||[]).map(a => '<div style="margin-bottom:0.7rem;"><div style="font-size:0.85rem;font-weight:600;margin-bottom:0.3rem;">'+esc(a.naam)+'</div>'+
        (a.varianten||[]).map(v => retailVariantRij(v)).join('')+'</div>').join('') + '</div></div>';
    return html;
  }
  function retailVariantRij(v){
    return '<div class="mitem" style="display:flex;align-items:center;gap:0.5rem;"><div style="flex:1;min-width:0;"><div class="nm">'+esc(v.kleur)+' · '+esc(v.maat)+'</div><div class="ds">'+esc(v.vsku)+'</div></div>'+
      '<button class="obtn" data-rvmin="'+esc(v.vsku)+'">−</button>'+
      '<span style="min-width:2ch;text-align:center;font-weight:700;color:'+(v.voorraad<=3?'var(--amber)':'var(--txt)')+';">'+v.voorraad+'</span>'+
      '<button class="obtn" data-rvplus="'+esc(v.vsku)+'">+</button></div>';
  }
  function retailClienteling(canEdit){
    if (retailKlant) return retailKlantDossier(canEdit);
    const kl = retailData.klanten || [];
    let html = '<div class="card"><div class="tt-h">'+T('rt.klantdossier','Clienteling')+' ('+kl.length+')</div>'+
      '<p class="ds" style="margin:0.4rem 0 0.2rem;">'+T('rt.clienteltip','Het geheime wapen van elk modehuis: maten, verlanglijst, aankoophistorie en stylist-notities per klant.')+'</p>'+
      (kl.length ? '<div style="margin-top:0.5rem;display:grid;gap:0.4rem;">'+kl.map(k => '<button class="mitem" data-rklant="'+esc(k.key)+'" style="text-align:left;width:100%;background:var(--card);border:1px solid var(--line);cursor:pointer;"><div class="r1"><span class="nm">'+esc(k.codenaam||k.key)+'</span><span class="pr">'+geld(k.besteedTotaal)+'</span></div><div class="ds">'+k.aankopen+' '+T('rt.aankopen','aankopen')+' · '+(k.wishlist?k.wishlist.length:0)+' '+T('rt.opverlang','op verlanglijst')+'</div></button>').join('')+'</div>'
        : '<div class="empty">'+T('rt.geenklant','Nog geen klantdossiers. Ze ontstaan zodra u een klant erbij pakt op de vloer (PDA) of een verkoop op naam boekt.')+'</div>')+'</div>';
    return html;
  }
  function retailKlantDossier(canEdit){
    const k = retailKlant;
    const maten = retailData.maten || [];
    let html = '<div style="margin-bottom:0.6rem;"><button class="obtn" id="rKlantTerug">← '+T('rt.terug','Terug')+'</button></div>';
    html += '<div class="card"><div class="r1"><span class="nm" style="font-size:1rem;">'+esc(k.codenaam||k.key)+'</span><span class="pr">'+geld(k.besteedTotaal)+'</span></div>'+
      '<div class="ds">'+k.aankopen+' '+T('rt.aankopen','aankopen')+(k.sinds?' · '+T('rt.klantsinds','klant sinds')+' '+esc(String(k.sinds).slice(0,10)):'')+'</div></div>';
    // maten + voorkeuren
    html += '<div class="card"><div class="tt-h">'+T('rt.maten2','Maten & voorkeuren')+'</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.4rem;margin-top:0.5rem;">'+
      ['Boven','Onder','Schoen','Jurk','Confectie'].map(cat => '<div class="field" style="margin:0;"><label>'+T('rt.mt.'+cat.toLowerCase(),cat)+'</label><input class="rMaatIn" data-rmaatcat="'+cat+'" value="'+esc((k.maten&&k.maten[cat])||'')+'" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;font-size:0.85rem;color:var(--txt);outline:none;"></div>').join('')+'</div>'+
      '<div class="field"><label>'+T('rt.voorkeuren','Voorkeuren')+'</label><textarea id="rVoorkeuren" rows="2">'+esc(k.voorkeuren||'')+'</textarea></div>'+
      '<button class="obtn primary" id="rMatenBewaar">'+T('rt.bewaarmaten','Bewaar maten')+'</button></div>';
    // verlanglijst
    html += '<div class="card"><div class="tt-h">'+T('rt.verlanglijst','Verlanglijst')+'</div>'+
      ((k.wishlist&&k.wishlist.length) ? '<div style="margin-top:0.5rem;display:grid;gap:0.4rem;">'+k.wishlist.map(w => '<div class="mitem"><div class="r1"><span class="nm">'+esc(w.naam)+'</span><span class="pr">'+geld(w.price)+'</span></div></div>').join('')+'</div>'
        : '<div class="empty">'+T('rt.geenverlang','Nog niets op de verlanglijst.')+'</div>')+'</div>';
    // historie
    html += '<div class="card"><div class="tt-h">'+T('rt.historie','Aankoophistorie')+'</div>'+
      ((k.historie&&k.historie.length) ? '<div style="margin-top:0.5rem;">'+k.historie.slice().reverse().map(h => '<div class="mitem"><div class="r1"><span class="nm">'+esc(h.naam)+'</span><span class="pr">'+geld(h.bedrag)+'</span></div><div class="ds">'+esc(String(h.at).slice(0,10))+'</div></div>').join('')+'</div>'
        : '<div class="empty">'+T('rt.geenhist','Nog geen aankopen.')+'</div>')+'</div>';
    // notities
    html += '<div class="card"><div class="tt-h">'+T('rt.notities','Stylist-notities')+'</div>'+
      ((k.notities&&k.notities.length) ? '<div style="margin-top:0.5rem;">'+k.notities.slice().reverse().map(n => '<div class="mitem"><div class="ds" style="color:var(--txt);">'+esc(n.tekst)+'</div><div class="ds">'+esc(n.door||'Team')+' · '+esc(String(n.at).slice(0,10))+'</div></div>').join('')+'</div>' : '')+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="rNotitie" placeholder="'+T('rt.notitieph','Nieuwe notitie…')+'" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.85rem;color:var(--txt);outline:none;"><button class="obtn primary" id="rNotitieAdd">'+T('rt.voegtoe','Voeg toe')+'</button></div></div>';
    // stylingvoorstel sturen
    html += '<div class="card"><div class="tt-h">'+T('rt.styling','Stylingvoorstel sturen')+'</div>'+
      '<p class="ds" style="margin:0.3rem 0;">'+T('rt.stylingtip','Kies artikelen; ze verschijnen als voorstel in de app van de klant.')+'</p>'+
      '<div style="max-height:180px;overflow-y:auto;display:grid;gap:0.3rem;margin-top:0.4rem;">'+(retailData.artikelen||[]).map(a => '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;"><input type="checkbox" class="rStylPick" value="'+a.id+'"> '+esc(a.naam)+' · '+geld(a.price)+'</label>').join('')+'</div>'+
      '<div class="field"><label>'+T('rt.stylingtitel','Titel')+'</label><input id="rStylTitel" value="'+T('rt.stylingtiteldef','Een selectie voor u')+'"></div>'+
      '<div class="field"><label>'+T('rt.stylingbericht','Bericht')+'</label><input id="rStylBericht" placeholder="'+T('rt.stylingberichtph','Optioneel persoonlijk bericht')+'"></div>'+
      '<button class="obtn primary" id="rStylStuur">'+T('rt.stuurstyling','Stuur voorstel')+'</button></div>';
    return html;
  }
  function retailBindActions(el, canEdit){
    el.querySelectorAll('[data-rpkbreng]').forEach(b => b.addEventListener('click', async () => {
      const paskamer = prompt(T('rt.welkepaskamer','In welke paskamer? (optioneel)')) || '';
      try { await API.call('/supplier/retail/paskamer/breng', { id: b.dataset.rpkbreng, paskamer }); toast(T('rt.gebracht','Gemarkeerd als gebracht.')); await laadRetail(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-rrelease]').forEach(b => b.addEventListener('click', async () => {
      try { const r = await API.call('/supplier/retail/drop/release', { artikelId: b.dataset.rrelease }); toast(T('rt.gereleased','Drop is live')+(r.bericht?' · '+r.bericht+' '+T('rt.opwachtlijst','op de wachtlijst geinformeerd'):'')); await laadRetail(); } catch(e){ toast(e.message); }
    }));
    // collecties
    const colAdd = el.querySelector('#rColAdd');
    if (colAdd) colAdd.addEventListener('click', async () => {
      try { await API.call('/supplier/retail/collectie', { naam: $('#rColNaam').value, seizoen: $('#rColSeiz').value, jaar: Number($('#rColJaar').value) }); toast(T('rt.colok','Collectie toegevoegd.')); await laadRetail(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-rcoldel]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm(T('rt.colweg','Deze collectie verwijderen?'))) return;
      try { await API.call('/supplier/retail/collectie', { action:'remove', id: b.dataset.rcoldel }); await laadRetail(); } catch(e){ toast(e.message); }
    }));
    // artikelen
    const artNieuw = el.querySelector('#rArtNieuw');
    if (artNieuw) artNieuw.addEventListener('click', () => { retailArtBewerk = 'nieuw'; renderRetail(); const f = $('#rArtForm'); if (f) f.scrollIntoView({ behavior:'smooth' }); });
    el.querySelectorAll('[data-rartedit]').forEach(b => b.addEventListener('click', () => { retailArtBewerk = b.dataset.rartedit; renderRetail(); const f = $('#rArtForm'); if (f) f.scrollIntoView({ behavior:'smooth' }); }));
    el.querySelectorAll('[data-rartdel]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm(T('rt.artweg','Dit artikel verwijderen?'))) return;
      try { await API.call('/supplier/retail/artikel', { action:'remove', id: b.dataset.rartdel }); toast(T('rt.artwegok','Artikel verwijderd.')); retailArtBewerk = null; await laadRetail(); } catch(e){ toast(e.message); }
    }));
    // artikel-formulier
    let artFotoData = null;
    el.querySelectorAll('[data-rmaat]').forEach(b => b.addEventListener('click', () => b.classList.toggle('primary')));
    const artFoto = el.querySelector('#rArtFoto');
    if (artFoto) artFoto.addEventListener('change', () => { if (artFoto.files && artFoto.files[0]) fileToDataURL(artFoto.files[0], d => { artFotoData = d; const n = $('#rArtFotoNaam'); if (n) n.textContent = T('rt.fotogekozen','foto gekozen'); }); });
    const artAnn = el.querySelector('#rArtAnnuleer');
    if (artAnn) artAnn.addEventListener('click', () => { retailArtBewerk = null; renderRetail(); });
    const artBewaar = el.querySelector('#rArtBewaar');
    if (artBewaar) artBewaar.addEventListener('click', async () => {
      const naam = $('#rArtNaam').value.trim();
      if (!naam) return toast(T('rt.geefnaam','Geef het artikel een naam.'));
      const maten = [...el.querySelectorAll('[data-rmaat].primary')].map(b => b.dataset.rmaat);
      if (!maten.length) return toast(T('rt.kiesmaat','Kies minstens een maat.'));
      const kleuren = $('#rArtKleuren').value.split(',').map(s => s.trim()).filter(Boolean);
      if (!kleuren.length) kleuren.push('Zwart');
      const start = Math.max(0, parseInt($('#rArtVoorraad').value, 10) || 0);
      const bestaand = retailArtBewerk === 'nieuw' ? null : (retailData.artikelen||[]).find(x => x.id === retailArtBewerk);
      const bestaandeV = {}; if (bestaand) (bestaand.varianten||[]).forEach(v => { bestaandeV[v.kleur+'|'+v.maat] = v.voorraad; });
      const varianten = [];
      for (const kl of kleuren) for (const m of maten) varianten.push({ kleur: kl, maat: m, voorraad: bestaand ? (bestaandeV[kl+'|'+m] != null ? bestaandeV[kl+'|'+m] : start) : start });
      const dropDatum = $('#rArtDrop').value;
      const artikel = { naam, sku: $('#rArtSku').value, categorie: $('#rArtCat').value, materiaal: $('#rArtMat').value,
        omschrijving: $('#rArtOms').value, publiekePrijs: Number($('#rArtPrijs').value) || 0, collectieId: $('#rArtColl').value || null,
        varianten, drop: dropDatum ? { datum: dropDatum, tijd: '10:00' } : null };
      if (artFotoData) artikel.foto = artFotoData;
      const body = { artikel }; if (bestaand) body.id = bestaand.id;
      try { await API.call('/supplier/retail/artikel', body); toast(T('rt.artok','Artikel bewaard.')); retailArtBewerk = null; await laadRetail(); openTab('retail'); } catch(e){ toast(e.message); }
    });
    // voorraad
    const zoekBtn = el.querySelector('#rZoekBtn');
    const doeZoek = async () => {
      try { const r = await API.call('/supplier/retail/zoek', { q: $('#rZoek').value }); const uit = $('#rZoekUit');
        uit.innerHTML = r.resultaten.length ? r.resultaten.map(v => '<div class="mitem"><div class="r1"><span class="nm">'+esc(v.artikel)+'</span><span class="pr" style="color:'+(v.laag?'var(--amber)':'var(--txt)')+';">'+v.voorraad+'</span></div><div class="ds">'+esc(v.kleur)+' · '+T('rt.maat','maat')+' '+esc(v.maat)+' · '+geld(v.price)+'</div></div>').join('') : '<div class="empty">'+T('rt.nietsgevonden','Niets gevonden.')+'</div>';
      } catch(e){ toast(e.message); }
    };
    if (zoekBtn) zoekBtn.addEventListener('click', doeZoek);
    const zoekIn = el.querySelector('#rZoek'); if (zoekIn) zoekIn.addEventListener('keydown', e => { if (e.key === 'Enter') doeZoek(); });
    const pasVoorraad = async (vsku, delta) => { try { await API.call('/supplier/retail/voorraad', { vsku, delta }); await laadRetail(); } catch(e){ toast(e.message); } };
    el.querySelectorAll('[data-rvmin]').forEach(b => b.addEventListener('click', () => pasVoorraad(b.dataset.rvmin, -1)));
    el.querySelectorAll('[data-rvplus]').forEach(b => b.addEventListener('click', () => pasVoorraad(b.dataset.rvplus, 1)));
    // clienteling
    el.querySelectorAll('[data-rklant]').forEach(b => b.addEventListener('click', async () => {
      try { retailKlant = (await API.call('/supplier/retail/klant', { key: b.dataset.rklant })).klant; renderRetail(); } catch(e){ toast(e.message); }
    }));
    const klTerug = el.querySelector('#rKlantTerug'); if (klTerug) klTerug.addEventListener('click', () => { retailKlant = null; renderRetail(); });
    const matBew = el.querySelector('#rMatenBewaar');
    if (matBew) matBew.addEventListener('click', async () => {
      const maten = {}; el.querySelectorAll('.rMaatIn').forEach(i => { if (i.value.trim()) maten[i.dataset.rmaatcat] = i.value.trim(); });
      try { await API.call('/supplier/retail/klant/maten', { key: retailKlant.key, maten, voorkeuren: $('#rVoorkeuren').value }); toast(T('rt.matenok','Maten bewaard.')); retailKlant = (await API.call('/supplier/retail/klant', { key: retailKlant.key })).klant; renderRetail(); } catch(e){ toast(e.message); }
    });
    const notAdd = el.querySelector('#rNotitieAdd');
    if (notAdd) notAdd.addEventListener('click', async () => {
      const tekst = $('#rNotitie').value.trim(); if (!tekst) return;
      try { await API.call('/supplier/retail/klant/notitie', { key: retailKlant.key, tekst }); retailKlant = (await API.call('/supplier/retail/klant', { key: retailKlant.key })).klant; renderRetail(); } catch(e){ toast(e.message); }
    });
    const stylStuur = el.querySelector('#rStylStuur');
    if (stylStuur) stylStuur.addEventListener('click', async () => {
      const artikelIds = [...el.querySelectorAll('.rStylPick:checked')].map(c => c.value);
      if (!artikelIds.length) return toast(T('rt.kiesart','Kies minstens een artikel.'));
      try { await API.call('/supplier/retail/styling', { key: retailKlant.key, artikelIds, titel: $('#rStylTitel').value, bericht: $('#rStylBericht').value }); toast(T('rt.stylok','Voorstel verstuurd naar de klant.')); renderRetail(); } catch(e){ toast(e.message); }
    });
  }

  // ---- identiteit & leeftijd: het gecontroleerde paspoortkanaal ----
  let paspoortData = null;      // eigen verzoeken + incidenten
  let paspoortBevestiging = null;  // laatste ja/nee-uitslag
  let paspoortInzage = null;    // geopende inzage (id-kaart of scan)
  async function laadPaspoort(){
    if (!API.live) return;
    try { paspoortData = await API.call('/supplier/paspoort/overzicht', {}); } catch(e){ paspoortData = { verzoeken:[], incidenten:[], niveaus:[] }; }
    renderPaspoort();
  }
  function pnBadge(st){
    const kleur = st==='goedgekeurd'?'var(--green)':st==='geweigerd'||st==='afgewezen'?'var(--burgundy)':st==='verlopen'||st==='ingetrokken'?'var(--soft)':'var(--amber)';
    return '<span class="pill" style="color:'+kleur+';border-color:'+kleur+';">'+T('pn.st.'+st, st)+'</span>';
  }
  function renderPaspoort(){
    const el = $('#paspoortWrap'); if (!el) return;
    if (!paspoortData){ el.innerHTML = '<div class="empty">…</div>'; laadPaspoort(); return; }
    const sel = 'style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"';
    let html = '';
    // aanvraagformulier
    html += '<div class="card"><div class="tt-h">'+T('pn.vraag','Identiteit opvragen')+'</div>'+
      '<div class="field"><label>'+T('pn.codenaam','Codenaam van de gast')+'</label><input id="pnCode" placeholder="'+T('pn.codeph','Bijv. Zilveren Valk 12')+'" autocomplete="off"></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">'+
        '<div class="field" style="margin:0;"><label>'+T('pn.minleeftijd','Leeftijdseis (optioneel)')+'</label><input id="pnLeeftijd" type="number" placeholder="18" inputmode="numeric"></div>'+
        '<div class="field" style="margin:0;"><label>'+T('pn.reden','Reden (optioneel)')+'</label><input id="pnReden" placeholder="'+T('pn.redenph','Bijv. leeftijdscontrole')+'"></div>'+
      '</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.8rem;">'+
        '<button class="obtn primary" data-pnvraag="bevestiging">'+T('pn.jaNee','Ja/nee-check')+'</button>'+
        '<button class="obtn" data-pnvraag="idkaart">'+T('pn.idkaart','ID-kaart vragen')+'</button>'+
        '<button class="obtn" data-pnvraag="paspoort">'+T('pn.paspoort','Paspoort vragen')+'</button>'+
      '</div>'+
      '<div id="pnUitslag" style="margin-top:0.7rem;"></div></div>';
    // geopende inzage
    if (paspoortInzage) html += paspoortInzageKaart(paspoortInzage);
    // lopende en afgehandelde verzoeken
    const vz = paspoortData.verzoeken || [];
    html += '<div class="card"><div class="tt-h">'+T('pn.verzoeken','Mijn verzoeken')+'</div>'+
      (vz.length ? '<div style="margin-top:0.5rem;display:grid;gap:0.4rem;">'+vz.map(v => '<div class="mitem"><div class="r1"><span class="nm">'+esc(v.codenaam||'\u2013')+'</span>'+pnBadge(v.status)+'</div>'+
        '<div class="ds">'+T('pn.niveau.'+v.niveau, v.niveau)+(v.incident?' · '+T('pn.viaIncident','via incident'):'')+(v.reden?' · '+esc(v.reden):'')+'</div>'+
        (v.status==='goedgekeurd'?'<div style="margin-top:0.4rem;"><button class="obtn primary" data-pnbekijk="'+v.id+'">'+T('pn.bekijk','Inzage openen')+'</button>'+(v.vervalt?' <span class="ds">'+T('pn.tot','geldig tot')+' '+new Date(v.vervalt).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})+'</span>':'')+'</div>':'')+
        '</div>').join('')+'</div>'
        : '<div class="empty">'+T('pn.geenverzoek','Nog geen verzoeken.')+'</div>')+'</div>';
    // incident melden
    html += '<div class="card"><div class="tt-h">'+T('pn.incident','Incident: identiteit opeisen')+'</div>'+
      '<p class="ds" style="margin:0.3rem 0;">'+T('pn.incidenttip','Alleen bij een echt incident. RTG-kantoor beoordeelt het verzoek en geeft de identiteit pas daarna vrij. Alles wordt gelogd.')+'</p>'+
      '<div class="field"><label>'+T('pn.codenaam','Codenaam van de gast')+'</label><input id="pnIncCode" placeholder="'+T('pn.codeph','Bijv. Zilveren Valk 12')+'" autocomplete="off"></div>'+
      '<div class="field"><label>'+T('pn.incReden','Wat is er gebeurd?')+'</label><textarea id="pnIncReden" rows="2" '+sel+' placeholder="'+T('pn.incRedenph','Beschrijf het incident (min. 10 tekens)')+'"></textarea></div>'+
      '<div class="field"><label>'+T('pn.incNiveau','Gevraagd niveau')+'</label><select id="pnIncNiveau" '+sel+'><option value="idkaart">'+T('pn.niveau.idkaart','ID-kaart')+'</option><option value="paspoort">'+T('pn.niveau.paspoort','Paspoort')+'</option></select></div>'+
      '<button class="obtn warn" id="pnIncMeld" style="margin-top:0.7rem;">'+T('pn.incMeld','Incident melden bij RTG')+'</button></div>';
    // eigen incidenten
    const inc = paspoortData.incidenten || [];
    if (inc.length) html += '<div class="card"><div class="tt-h">'+T('pn.incidenten','Mijn incidenten')+'</div>'+
      '<div style="margin-top:0.5rem;">'+inc.map(i => '<div class="mitem"><div class="r1"><span class="nm">'+esc(i.codenaam||'\u2013')+'</span>'+pnBadge(i.status)+'</div><div class="ds">'+esc(i.reden)+'</div></div>').join('')+'</div></div>';
    el.innerHTML = html;
    paspoortBind(el);
  }
  function paspoortInzageKaart(inh){
    let body = '';
    if (inh.niveau === 'bevestiging'){
      body = '<div style="font-size:0.9rem;">'+(inh.geverifieerd?'✅ '+T('pn.geverifieerd','RTG-geverifieerd'):'⛔ '+T('pn.nietgeverifieerd','niet geverifieerd'))+
        (inh.voldoetLeeftijd!=null?'<br>'+(inh.voldoetLeeftijd?'✅ '+T('pn.voldoet','voldoet aan de leeftijdseis'):'⛔ '+T('pn.voldoetniet','voldoet NIET aan de leeftijdseis')):'')+'</div>';
    } else {
      body = '<div style="display:flex;gap:0.8rem;">'+
        (inh.foto?'<img src="'+esc(inh.foto)+'" alt="'+T('pn.pasfoto','Pasfoto')+'" style="width:80px;height:100px;object-fit:cover;border-radius:10px;flex-shrink:0;">':'')+
        '<div><div style="font-weight:700;font-size:0.95rem;">'+esc(inh.naam||'')+'</div>'+
        '<div class="ds">'+(inh.nationaliteit?esc(inh.nationaliteit)+' · ':'')+(inh.geboortedatum?esc(inh.geboortedatum):'')+(inh.leeftijd!=null?' ('+inh.leeftijd+')':'')+'</div>'+
        '<div class="ds" style="margin-top:0.3rem;color:var(--green);">'+(inh.geverifieerd?'✅ '+T('pn.geverifieerd','RTG-geverifieerd'):'')+(inh.gezichtGecontroleerd?' · '+T('pn.gezicht','gezicht gecontroleerd'):'')+'</div></div></div>'+
        (inh.scan?'<div style="margin-top:0.6rem;"><div class="tt-h">'+T('pn.scan','Paspoortscan')+'</div><img src="'+esc(inh.scan)+'" alt="'+T('pn.scan','Paspoortscan')+'" style="width:100%;border-radius:10px;margin-top:0.4rem;"></div>':'');
    }
    return '<div class="card" style="border-color:var(--gold);"><div class="tt-h" style="color:var(--gold);">'+T('pn.inzage','Inzage')+' · '+T('pn.niveau.'+inh.niveau, inh.niveau)+'</div><div style="margin-top:0.5rem;">'+body+'</div>'+
      '<button class="obtn" id="pnSluit" style="margin-top:0.7rem;">'+T('pn.sluit','Sluiten')+'</button></div>';
  }
  function paspoortBind(el){
    el.querySelectorAll('[data-pnvraag]').forEach(b => b.addEventListener('click', async () => {
      const codenaam = ($('#pnCode').value||'').trim(); if (!codenaam) return toast(T('pn.geefcode','Vul een codenaam in.'));
      const body = { codenaam, niveau: b.dataset.pnvraag };
      const lft = $('#pnLeeftijd').value; if (lft) body.minLeeftijd = Number(lft);
      const reden = $('#pnReden').value; if (reden) body.reden = reden;
      try {
        const r = await API.call('/supplier/paspoort/vraag', body);
        const uit = $('#pnUitslag');
        if (r.niveau === 'bevestiging'){
          const be = r.bevestiging;
          uit.innerHTML = '<div style="padding:0.6rem 0.8rem;border:1px solid var(--line);border-radius:12px;font-size:0.88rem;">'+
            (be.geverifieerd?'✅ '+T('pn.geverifieerd','RTG-geverifieerd'):'⛔ '+T('pn.nietgeverifieerd','niet geverifieerd'))+
            (be.voldoetLeeftijd!=null?' · '+(be.voldoetLeeftijd?'✅ '+be.minLeeftijd+'+':'⛔ '+T('pn.voldoetniet','voldoet niet')):'')+'</div>';
        } else {
          uit.innerHTML = '<div style="padding:0.6rem 0.8rem;border:1px solid var(--line);border-radius:12px;font-size:0.85rem;color:var(--amber);">⏳ '+T('pn.verstuurd','Verzoek verstuurd. De gast krijgt een melding en kan het goedkeuren of weigeren.')+'</div>';
          await laadPaspoort();
        }
      } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-pnbekijk]').forEach(b => b.addEventListener('click', async () => {
      try { const r = await API.call('/supplier/paspoort/bekijk', { id: b.dataset.pnbekijk }); paspoortInzage = r.inhoud; renderPaspoort(); const c = $('#paspoortWrap'); if (c) c.scrollTop = 0; }
      catch(e){ toast(e.message); await laadPaspoort(); }
    }));
    const sluit = el.querySelector('#pnSluit'); if (sluit) sluit.addEventListener('click', () => { paspoortInzage = null; renderPaspoort(); });
    const incBtn = el.querySelector('#pnIncMeld');
    if (incBtn) incBtn.addEventListener('click', async () => {
      const codenaam = ($('#pnIncCode').value||'').trim(); const reden = ($('#pnIncReden').value||'').trim();
      if (!codenaam) return toast(T('pn.geefcode','Vul een codenaam in.'));
      if (reden.length < 10) return toast(T('pn.geefreden','Beschrijf het incident (min. 10 tekens).'));
      try { await API.call('/supplier/paspoort/incident', { codenaam, reden, niveau: $('#pnIncNiveau').value }); toast(T('pn.incok','Incident gemeld. RTG beoordeelt het.')); $('#pnIncCode').value=''; $('#pnIncReden').value=''; await laadPaspoort(); }
      catch(e){ toast(e.message); }
    });
  }

  // ---- groothandel: de groothandel beheert assortiment, functies en orders ----
  let ghEdit = null;
  async function renderGroothandel(){
    const el = $('#groothandelWrap'); if (!el) return;
    if (!has('groothandel')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/groothandel/overzicht'); } catch(e){ return; }
    const cats = d.categorieen || [];
    // functie-schakelaars
    const ghChips = '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">' +
      (d.functies||[]).map(f => '<button class="js-ghf" data-id="'+f.id+'" data-aan="'+f.aan+'" style="border:1px solid '+(f.aan?'#1f5637':'var(--line)')+';background:'+(f.aan?'#12321f':'var(--card2)')+';color:'+(f.aan?'#7EE0A3':'var(--soft)')+';border-radius:999px;padding:0.32rem 0.7rem;font-size:0.72rem;font-weight:600;font-family:inherit;">'+esc(f.naam)+'</button>').join('') +
      '</div>';
    let h = funcBlok(T('gh.functies','Uw functies (aan/uit)'), d.functies||[], ghChips);
    // binnenkomende orders
    const ink = d.inkomend || { open:[], afgerond:[], omzet:0 };
    h += '<div class="st-sec">'+T('gh.orders','Bestellingen')+' · '+T('gh.omzet','omzet')+' '+eur(ink.omzet||0)+'</div>';
    h += ink.open.length ? ink.open.map(o => ghOrderKaart(o, true)).join('') : '<p class="sub">'+T('gh.geenorders','Geen openstaande bestellingen.')+'</p>';
    if (ink.afgerond.length) h += '<details style="margin-top:0.6rem;"><summary class="sub" style="cursor:pointer;">'+T('gh.afgerond','Afgerond')+' ('+ink.afgerond.length+')</summary>'+ink.afgerond.map(o=>ghOrderKaart(o,false)).join('')+'</details>';
    // assortiment
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('gh.assortiment','Assortiment')+' <button class="js-ghnew" style="float:right;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.25rem 0.6rem;font-size:0.72rem;font-weight:600;font-family:inherit;">+ '+T('gh.nieuw','Nieuw product')+'</button></div>';
    h += '<div id="ghForm"></div>';
    h += '<div style="margin-top:0.5rem;">'+(d.producten||[]).map(p =>
      '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0;border-top:1px solid var(--line);">'+
      '<div style="flex:1;"><b style="font-size:0.85rem;">'+esc(p.naam)+'</b><span class="sub"> · '+esc(p.categorie)+' · '+T('gh.per','per')+' '+esc(p.eenheid)+'</span>'+
      '<div class="sub">'+T('gh.inkoop','inkoop')+' '+eur(p.inkoopPrijs)+' · '+T('gh.consument','consument')+' '+eur(p.consumentPrijs)+' · '+T('gh.voorraad','voorraad')+' '+p.voorraad+(p.actief?'':' · <span style="color:var(--gold);">'+T('gh.uit','uit')+'</span>')+'</div></div>'+
      '<button class="js-ghedit" data-id="'+p.id+'" style="background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:0.3rem 0.6rem;color:var(--txt);font-size:0.72rem;font-family:inherit;">'+T('gh.bewerk','Bewerk')+'</button></div>').join('');
    el.innerHTML = h;
    wireFuncBlok(el);
    el.querySelectorAll('.js-ghf').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/groothandel/functie', { id:b.dataset.id, aan: b.dataset.aan!=='true' }); renderGroothandel(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ghverder]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/groothandel/order/status', { ref:b.dataset.ghverder, actie:'verder' }); renderGroothandel(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ghweiger]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/groothandel/order/status', { ref:b.dataset.ghweiger, actie:'weiger' }); renderGroothandel(); } catch(e){ toast(e.message); }
    }));
    const nw = el.querySelector('.js-ghnew'); if (nw) nw.addEventListener('click', () => { ghEdit = { }; ghForm(cats); });
    el.querySelectorAll('.js-ghedit').forEach(b => b.addEventListener('click', () => { ghEdit = (d.producten||[]).find(p=>p.id===b.dataset.id) || {}; ghForm(cats); }));
    if (ghEdit) ghForm(cats);
  }
  function ghOrderKaart(o, open){
    const naam = o.klant ? (o.klant.naam || '') : '';
    return '<div style="border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.85rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;"><b style="flex:1;font-size:0.85rem;">'+esc(naam)+' · '+eur(o.subtotaal)+'</b>'+
      '<span class="sub">'+esc(o.soort)+(o.bron==='ai'?' · AI':'')+' · '+esc(o.status)+'</span></div>'+
      '<div class="sub">'+o.regels.map(r=>r.aantal+'× '+esc(r.naam)).join(', ')+'</div>'+
      (open ? '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><button data-ghverder="'+o.ref+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('gh.verder','Volgende stap')+'</button>'+
        '<button data-ghweiger="'+o.ref+'" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--soft);font-family:inherit;font-size:0.75rem;">'+T('gh.weiger','Weiger')+'</button></div>' : '')+'</div>';
  }
  function ghForm(cats){
    const el = $('#ghForm'); if (!el) return; const p = ghEdit || {};
    el.innerHTML = '<div style="border:1px solid var(--gold);border-radius:12px;padding:0.8rem;margin-top:0.5rem;">'+
      '<input id="ghNaam" class="st-in" placeholder="'+T('gh.f.naam','Productnaam')+'" value="'+esc(p.naam||'')+'" style="width:100%;margin-bottom:0.4rem;">'+
      '<div class="row-gap"><select id="ghCat" class="st-in" style="flex:1;">'+cats.map(c=>'<option'+(p.categorie===c?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+
      '<input id="ghEen" class="st-in" placeholder="'+T('gh.f.eenheid','Eenheid')+'" value="'+esc(p.eenheid||'stuk')+'" style="flex:1;"></div>'+
      '<div class="row-gap"><input id="ghIn" class="st-in" type="number" step="0.01" placeholder="'+T('gh.f.inkoop','Inkoopprijs')+'" value="'+(p.inkoopPrijs!=null?p.inkoopPrijs:'')+'" style="flex:1;"><input id="ghCon" class="st-in" type="number" step="0.01" placeholder="'+T('gh.f.consument','Consumentprijs')+'" value="'+(p.consumentPrijs!=null?p.consumentPrijs:'')+'" style="flex:1;"></div>'+
      '<div class="row-gap"><input id="ghVoor" class="st-in" type="number" placeholder="'+T('gh.f.voorraad','Voorraad')+'" value="'+(p.voorraad!=null?p.voorraad:'')+'" style="flex:1;"><input id="ghMin" class="st-in" type="number" placeholder="'+T('gh.f.min','Min. bestel')+'" value="'+(p.minBestel!=null?p.minBestel:1)+'" style="flex:1;"></div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><button id="ghSave" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('gh.opslaan','Opslaan')+'</button>'+
      '<button id="ghCancel" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.45rem 0.8rem;color:var(--soft);font-family:inherit;">'+T('gh.annuleer','Annuleer')+'</button></div></div>';
    $('#ghCancel').addEventListener('click', () => { ghEdit = null; renderGroothandel(); });
    $('#ghSave').addEventListener('click', async () => {
      const body = { id:p.id, naam:$('#ghNaam').value.trim(), categorie:$('#ghCat').value, eenheid:$('#ghEen').value.trim(),
        inkoopPrijs:$('#ghIn').value, consumentPrijs:$('#ghCon').value, voorraad:$('#ghVoor').value, minBestel:$('#ghMin').value };
      try { await API.call('/supplier/groothandel/product', body); ghEdit = null; toast(T('gh.opgeslagen','Product opgeslagen.')); renderGroothandel(); } catch(e){ toast(e.message); }
    });
  }

  // ---- inkoop: een horecazaak koopt in bij een groothandel (met AI-bijbestellen) ----
  let inkVoorstel = null;
  async function renderInkoop(){
    const el = $('#inkoopWrap'); if (!el) return;
    if (!has('menu')){ el.innerHTML = ''; return; }
    let markt, mijn;
    try { markt = await API.call('/supplier/inkoop/markt'); mijn = await API.call('/supplier/inkoop/mijn'); } catch(e){ return; }
    let h = '';
    for (const g of (markt.groothandels||[])){
      h += '<div style="border:1px solid var(--line);border-radius:14px;padding:0.85rem;margin-bottom:0.8rem;">'+
        '<div style="display:flex;gap:0.5rem;align-items:center;"><b style="flex:1;">'+esc(g.naam)+'</b>'+
        '<button class="js-inkai" data-code="'+g.code+'" style="background:var(--card2);border:1px solid var(--gold);border-radius:8px;padding:0.3rem 0.6rem;color:var(--gold);font-size:0.72rem;font-weight:600;font-family:inherit;">✨ '+T('ink.ai','AI-bijbestellen')+'</button></div>'+
        '<div id="inkai-'+g.code+'"></div>'+
        g.producten.slice(0,60).map(p => '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-top:1px solid var(--line);">'+
          '<div style="flex:1;"><span style="font-size:0.83rem;">'+esc(p.naam)+'</span><span class="sub"> · '+eur(p.prijs)+'/'+esc(p.eenheid)+'</span></div>'+
          '<input class="st-in js-inkq" data-code="'+g.code+'" data-pid="'+p.id+'" type="number" min="0" placeholder="0" style="width:4rem;text-align:center;"></div>').join('')+
        '<button class="js-inkbestel" data-code="'+g.code+'" style="width:100%;margin-top:0.5rem;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.5rem;font-weight:600;font-family:inherit;">'+T('ink.bestel','Bestellen')+'</button></div>';
    }
    if (!(markt.groothandels||[]).length) h += '<p class="sub">'+T('ink.geen','Geen groothandel beschikbaar voor inkoop.')+'</p>';
    // mijn bestellingen
    if ((mijn.bestellingen||[]).length){
      h += '<div class="st-sec">'+T('ink.mijn','Mijn inkooporders')+'</div>';
      h += mijn.bestellingen.slice(0,20).map(o => '<div style="border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.75rem;margin-bottom:0.4rem;"><div style="display:flex;gap:0.5rem;"><b style="flex:1;font-size:0.82rem;">'+esc(o.groothandelNaam)+' · '+eur(o.subtotaal)+'</b><span class="sub">'+esc(o.status)+(o.bron==='ai'?' · AI':'')+'</span></div><div class="sub">'+o.regels.map(r=>r.aantal+'× '+esc(r.naam)).join(', ')+'</div></div>').join('');
    }
    el.innerHTML = h;
    el.querySelectorAll('.js-inkbestel').forEach(b => b.addEventListener('click', () => inkBestel(b.dataset.code, false)));
    el.querySelectorAll('.js-inkai').forEach(b => b.addEventListener('click', () => inkAi(b.dataset.code)));
  }
  function inkRegels(code){
    const regels = [];
    document.querySelectorAll('.js-inkq[data-code="'+code+'"]').forEach(inp => { const a = Number(inp.value)||0; if (a>0) regels.push({ productId: inp.dataset.pid, aantal: a }); });
    return regels;
  }
  async function inkBestel(code){
    const regels = inkRegels(code);
    if (!regels.length) return toast(T('ink.kies','Vul minstens een aantal in.'));
    try { await API.call('/supplier/inkoop/bestel', { groothandelCode: code, regels }); toast(T('ink.besteld','Bestelling geplaatst.')); renderInkoop(); } catch(e){ toast(e.message); }
  }
  async function inkAi(code){
    const box = $('#inkai-'+code); if (box) box.innerHTML = '<p class="sub">'+T('ink.aidenkt','De AI kijkt naar uw verkoop en mise-en-place…')+'</p>';
    try {
      const v = await API.call('/supplier/inkoop/ai', { groothandelCode: code });
      inkVoorstel = v;
      if (!box) return;
      if (!v.regels.length){ box.innerHTML = '<p class="sub">'+esc(v.uitleg)+'</p>'; return; }
      box.innerHTML = '<div style="border:1px solid var(--gold);border-radius:10px;padding:0.6rem;margin:0.5rem 0;">'+
        '<div class="sub" style="margin-bottom:0.35rem;">'+esc(v.uitleg)+'</div>'+
        v.regels.map(r=>'<div class="sub">'+r.aantal+'× '+esc(r.naam)+' · '+eur(r.prijs)+' <span style="opacity:0.7;">('+esc(r.reden)+')</span></div>').join('')+
        '<button class="js-inkaiok" data-code="'+code+'" style="width:100%;margin-top:0.5rem;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('ink.aibevestig','Bijbestelling plaatsen')+'</button></div>';
      box.querySelector('.js-inkaiok').addEventListener('click', async () => {
        try { await API.call('/supplier/inkoop/ai-bevestig', { groothandelCode: code, regels: v.regels.map(r=>({productId:r.productId, aantal:r.aantal})) }); toast(T('ink.aiok','Bijbestelling geplaatst.')); renderInkoop(); } catch(e){ toast(e.message); }
      });
    } catch(e){ if (box) box.innerHTML = '<p class="sub">'+esc(e.message)+'</p>'; }
  }

  // ---- mode-bezorging: veilig laten bezorgen, in een tik op te zetten ----
  async function renderModeBezorg(){
    const el = $('#modeBezorgWrap'); if (!el) return;
    if (!has('retail')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/mode/bezorg/overzicht'); } catch(e){ el.innerHTML=''; return; }
    const ins = d.instellingen || { aan:false };
    let h = '<div class="st-sec" style="margin-top:1.4rem;">🛍️ '+T('mb.h','Veilige bezorgdienst')+'</div>';
    h += '<div style="border:1px solid var(--line);border-radius:12px;padding:0.8rem;margin-bottom:0.8rem;">'+
      '<label style="display:flex;align-items:center;gap:0.6rem;font-size:0.85rem;"><input type="checkbox" id="mbAan"'+(ins.aan?' checked':'')+'> '+T('mb.aan','Bezorgen aan (met bezorgcode, foto-bewijs en live volgen)')+'</label>'+
      '<div class="row-gap" style="margin-top:0.5rem;"><input id="mbKosten" class="st-in" type="number" step="0.5" placeholder="'+T('mb.kosten','Kosten €')+'" value="'+(ins.kosten!=null?ins.kosten:'')+'" style="flex:1;"><input id="mbGratis" class="st-in" type="number" placeholder="'+T('mb.gratis','Gratis vanaf €')+'" value="'+(ins.gratisVanaf!=null?ins.gratisVanaf:'')+'" style="flex:1;"><input id="mbId" class="st-in" type="number" placeholder="'+T('mb.idgrens','ID vanaf €')+'" value="'+(ins.waardegrensId!=null?ins.waardegrensId:'')+'" style="flex:1;"></div>'+
      '<button id="mbSave" style="width:100%;margin-top:0.5rem;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.5rem;font-weight:600;font-family:inherit;">'+T('mb.opslaan','Opslaan')+'</button></div>';
    // bezorgbord
    h += '<div class="st-sec">'+T('mb.bord','Bezorgingen')+' · '+T('mb.omzet','omzet')+' '+eur(d.omzet||0)+'</div>';
    h += (d.open||[]).length ? (d.open||[]).map(mbKaart).join('') : '<p class="sub">'+T('mb.geen','Geen open bezorgingen.')+'</p>';
    if ((d.afgerond||[]).length) h += '<details style="margin-top:0.5rem;"><summary class="sub" style="cursor:pointer;">'+T('mb.afgerond','Afgerond')+' ('+d.afgerond.length+')</summary>'+d.afgerond.map(mbKaart).join('')+'</details>';
    el.innerHTML = h;
    const save = $('#mbSave'); if (save) save.addEventListener('click', async () => {
      try { await API.call('/supplier/mode/bezorg/setup', { aan: $('#mbAan').checked, kosten:$('#mbKosten').value, gratisVanaf:$('#mbGratis').value, waardegrensId:$('#mbId').value }); toast(T('mb.opgeslagen','Bezorgdienst bijgewerkt.')); renderModeBezorg(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-mbneem]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/mode/bezorg/neem', { ref:b.dataset.mbneem }); renderModeBezorg(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-mbretour]').forEach(b => b.addEventListener('click', async () => { const r = prompt(T('mb.retourreden','Reden van retour?'),'Past niet'); if (r===null) return; try { await API.call('/supplier/mode/bezorg/retour', { ref:b.dataset.mbretour, reden:r }); renderModeBezorg(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-mbaf]').forEach(b => b.addEventListener('click', async () => {
      const code = prompt(T('mb.vraagcode','Bezorgcode van de klant (uit de app):')); if (!code) return;
      try { await API.call('/supplier/mode/bezorg/overhandig', { ref:b.dataset.mbaf, bezorgcode:code.trim(), idOk:true }); toast('✅ '+T('mb.afgeleverd','Veilig afgeleverd.')); renderModeBezorg(); } catch(e){ toast(e.message); }
    }));
  }
  function mbKaart(b){
    const done = ['afgeleverd','retour','geannuleerd'].includes(b.status);
    return '<div style="border:1px solid '+(b.status==='onderweg'?'var(--gold)':'var(--line)')+';border-radius:12px;padding:0.7rem 0.85rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;"><b style="flex:1;font-size:0.85rem;">'+esc(b.codenaam)+' · '+eur(b.waarde)+(b.kosten?' + '+eur(b.kosten):'')+'</b>'+
      '<span class="sub">'+esc(b.status)+(b.idVereist?' · 🪪':'')+'</span></div>'+
      '<div class="sub">'+b.items.map(i=>i.aantal+'× '+esc(i.naam)+(i.maat?' ('+esc(i.maat)+')':'')).join(', ')+' · '+esc(b.adres)+'</div>'+
      (b.koerier?'<div class="sub">'+T('mb.koerier','koerier')+': '+esc(b.koerier)+'</div>':'')+
      (!done ? '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;flex-wrap:wrap;">'+
        (b.status==='onderweg' ? '<button data-mbaf="'+b.ref+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('mb.afronden','Afronden (code)')+'</button>' :
          '<button data-mbneem="'+b.ref+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('mb.aannemen','Aannemen')+'</button>')+
        '<button data-mbretour="'+b.ref+'" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--soft);font-family:inherit;font-size:0.75rem;">'+T('mb.retour','Retour')+'</button></div>' : '')+'</div>';
  }

  // ---- autoverkoop: showroom + proefritten + koopaanvragen ----
  let vkAutoBewerk = null;
  async function renderVerkoop(){
    const el = $('#verkoopWrap'); if (!el) return;
    if (!has('huur')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/verkoop/overzicht'); } catch(e){ el.innerHTML=''; return; }
    let h = '<div style="border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;margin-bottom:0.9rem;"><label style="display:flex;align-items:center;gap:0.6rem;font-size:0.85rem;"><input type="checkbox" id="vkAan"'+(d.aan?' checked':'')+'> '+T('vk.aan','Autoverkoop aan (exclusieve showroom voor leden)')+'</label></div>';
    // open aanvragen
    h += '<div class="st-sec">'+T('vk.aanvragen','Aanvragen')+'</div>';
    h += (d.open||[]).length ? (d.open||[]).map(vkDeal).join('') : '<p class="sub">'+T('vk.geen','Geen open aanvragen.')+'</p>';
    // showroom
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('vk.showroom','Showroom')+' <button class="js-vknew" style="float:right;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.25rem 0.6rem;font-size:0.72rem;font-weight:600;font-family:inherit;">+ '+T('vk.nieuw','Auto toevoegen')+'</button></div><div id="vkForm"></div>';
    h += (d.showroom||[]).map(a => '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0;border-top:1px solid var(--line);">'+
      '<div style="flex:1;"><b style="font-size:0.85rem;">'+(a.vip?'★ ':'')+esc(a.naam)+'</b><span class="sub"> · '+eur(a.prijs)+' · '+a.km.toLocaleString('nl-NL')+' km · '+esc(a.brandstof)+'</span>'+
      '<div class="sub">'+esc(a.status)+(a.garantieMnd?' · '+a.garantieMnd+' mnd garantie':'')+'</div></div>'+
      '<button class="js-vkedit" data-id="'+a.id+'" style="background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:0.3rem 0.6rem;color:var(--txt);font-size:0.72rem;font-family:inherit;">'+T('vk.bewerk','Bewerk')+'</button></div>').join('');
    el.innerHTML = h;
    const aan = $('#vkAan'); if (aan) aan.addEventListener('change', async () => { try { await API.call('/supplier/verkoop/aan', { aan: aan.checked }); renderVerkoop(); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-vkplan]').forEach(b => b.addEventListener('click', async () => { const m = prompt(T('vk.moment','Wanneer? (bv. za 10:00)')); if(m===null) return; try { await API.call('/supplier/verkoop/deal', { ref:b.dataset.vkplan, actie:'plan', moment:m }); renderVerkoop(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-vkact]').forEach(b => b.addEventListener('click', async () => {
      const actie = b.dataset.act; const body = { ref:b.dataset.vkact, actie };
      if (actie==='aanvaard'){ const p = prompt(T('vk.tegenbod','Verkoopprijs bevestigen of tegenbod (€):'), b.dataset.prijs||''); if(p===null) return; body.prijs = p; if (b.dataset.inruil==='1'){ const t = prompt(T('vk.taxatie','Inruil taxeren op (€):'),'0'); if(t!==null) body.taxatie = t; } }
      try { await API.call('/supplier/verkoop/deal', body); renderVerkoop(); } catch(e){ toast(e.message); }
    }));
    const nw = el.querySelector('.js-vknew'); if (nw) nw.addEventListener('click', () => { vkAutoBewerk = {}; vkForm(d.brandstoffen||[]); });
    el.querySelectorAll('.js-vkedit').forEach(b => b.addEventListener('click', () => { vkAutoBewerk = (d.showroom||[]).find(a=>a.id===b.dataset.id) || {}; vkForm(d.brandstoffen||[]); }));
    if (vkAutoBewerk) vkForm(d.brandstoffen||[]);
  }
  function vkDeal(d){
    const koop = d.soort==='koop';
    let acties = '';
    if (koop){
      if (d.status==='aangevraagd') acties = '<button class="js-vkact" data-vkact="'+d.ref+'" data-act="aanvaard" data-prijs="'+(d.prijs||'')+'" data-inruil="'+(d.inruil?1:0)+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('vk.aanvaard','Aanvaarden')+'</button>';
      else if (d.status==='getekend') acties = '<button class="js-vkact" data-vkact="'+d.ref+'" data-act="afgeleverd" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('vk.aflever','Afgeleverd')+'</button>';
      else acties = '<span class="sub" style="flex:1;align-self:center;">'+T('vk.wacht','wacht op tekenen')+'</span>';
    } else {
      if (d.status==='aangevraagd') acties = '<button data-vkplan="'+d.ref+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('vk.plan','Inplannen')+'</button>';
      else if (d.status==='ingepland') acties = '<button class="js-vkact" data-vkact="'+d.ref+'" data-act="gereden" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('vk.gereden','Gereden')+'</button>';
    }
    return '<div style="border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.85rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;"><b style="flex:1;font-size:0.85rem;">'+(koop?'🔑 ':'🚗 ')+esc(d.autoNaam)+'</b><span class="sub">'+esc(d.codenaam)+' · '+esc(d.status)+'</span></div>'+
      '<div class="sub">'+(koop? (T('vk.bod','bod')+' '+eur(d.bod||0)+(d.inruil?' · '+T('vk.inruil','inruil')+' '+esc([d.inruil.merk,d.inruil.model].filter(Boolean).join(' ')):'')+(d.concierge?' · '+T('vk.concierge','concierge')+' '+esc(d.adres||''):'')) : (d.wens?esc(d.wens):T('vk.proefrit','proefrit'))+(d.moment?' · '+esc(d.moment):''))+'</div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;">'+acties+'<button class="js-vkact" data-vkact="'+d.ref+'" data-act="afwijs" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--soft);font-family:inherit;font-size:0.75rem;">'+T('vk.afwijs','Afwijzen')+'</button></div></div>';
  }
  function vkForm(brandstoffen){
    const el = $('#vkForm'); if (!el) return; const a = vkAutoBewerk || {};
    el.innerHTML = '<div style="border:1px solid var(--gold);border-radius:12px;padding:0.8rem;margin-top:0.5rem;">'+
      '<div class="row-gap"><input id="vkMerk" class="st-in" placeholder="'+T('vk.f.merk','Merk')+'" value="'+esc(a.merk||'')+'" style="flex:1;"><input id="vkModel" class="st-in" placeholder="'+T('vk.f.model','Model')+'" value="'+esc(a.model||'')+'" style="flex:1;"></div>'+
      '<div class="row-gap"><input id="vkJaar" class="st-in" type="number" placeholder="'+T('vk.f.jaar','Jaar')+'" value="'+(a.jaar||'')+'" style="flex:1;"><input id="vkKm" class="st-in" type="number" placeholder="'+T('vk.f.km','Km')+'" value="'+(a.km!=null?a.km:'')+'" style="flex:1;"><input id="vkPrijs" class="st-in" type="number" placeholder="'+T('vk.f.prijs','Prijs €')+'" value="'+(a.prijs!=null?a.prijs:'')+'" style="flex:1;"></div>'+
      '<div class="row-gap"><select id="vkBr" class="st-in" style="flex:1;">'+(brandstoffen||['Benzine']).map(b=>'<option'+(a.brandstof===b?' selected':'')+'>'+esc(b)+'</option>').join('')+'</select><input id="vkPk" class="st-in" type="number" placeholder="'+T('vk.f.pk','Pk')+'" value="'+(a.vermogenPk||'')+'" style="flex:1;"><input id="vkGar" class="st-in" type="number" placeholder="'+T('vk.f.garantie','Garantie mnd')+'" value="'+(a.garantieMnd!=null?a.garantieMnd:12)+'" style="flex:1;"></div>'+
      '<input id="vkHist" class="st-in" placeholder="'+T('vk.f.historie','Historie / bijzonderheden')+'" value="'+esc(a.historie||'')+'" style="width:100%;">'+
      '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;margin:0.3rem 0;"><input type="checkbox" id="vkVip"'+(a.vip?' checked':'')+'> '+T('vk.f.vip','VIP / exclusief (bovenaan)')+'</label>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.4rem;"><button id="vkSave" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('vk.opslaan','Opslaan')+'</button>'+
      '<button id="vkCancel" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.45rem 0.8rem;color:var(--soft);font-family:inherit;">'+T('vk.annuleer','Annuleer')+'</button></div></div>';
    $('#vkCancel').addEventListener('click', () => { vkAutoBewerk = null; renderVerkoop(); });
    $('#vkSave').addEventListener('click', async () => {
      const body = { id:a.id, merk:$('#vkMerk').value.trim(), model:$('#vkModel').value.trim(), jaar:$('#vkJaar').value, km:$('#vkKm').value,
        prijs:$('#vkPrijs').value, brandstof:$('#vkBr').value, vermogenPk:$('#vkPk').value, garantieMnd:$('#vkGar').value,
        historie:$('#vkHist').value.trim(), vip:$('#vkVip').checked };
      try { await API.call('/supplier/verkoop/auto', body); vkAutoBewerk = null; toast(T('vk.opgeslagen','Auto opgeslagen.')); renderVerkoop(); } catch(e){ toast(e.message); }
    });
  }

  // ---- de eigen mini-boardroom van de zaak: functies + HR + marketing ----
  // ---- interactieve AI-agenda in de boardroom + ballon-badge op de Meer-tab ----
  let agendaSupData = null;
  function agendaBadgeSup(n){
    const tab = document.querySelector('#tabbar [data-tab="meer"]'); if (!tab) return;
    tab.style.position = 'relative';
    let b = tab.querySelector('.ag-ballon');
    if (n > 0){
      if (!b){ b = document.createElement('span'); b.className = 'ag-ballon'; b.setAttribute('aria-label', T('ag.badge','afspraken op de agenda')); tab.appendChild(b); }
      b.textContent = n > 9 ? '9+' : String(n);
      b.style.cssText = 'position:absolute;top:3px;left:50%;margin-left:6px;min-width:15px;height:15px;padding:0 3px;border-radius:8px;background:#E0736A;color:#fff;font-size:9px;font-weight:700;line-height:15px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.4);';
    } else if (b) b.remove();
  }
  async function laadAgendaSup(){ if (!API.live) return; try { agendaSupData = await API.call('/supplier/agenda/lijst', {}); } catch(e){ agendaSupData = { items:[], telling:0 }; } agendaBadgeSup(agendaSupData.telling||0); renderAgendaSup(); }
  function agendaToeSup(r){ if (r && r.items){ agendaSupData = r; agendaBadgeSup(r.telling||0); } renderAgendaSup(); }
  function agendaCardHtml(o, canEdit, prefix, aiPad){
    const dagLbl = d => { try { return new Date(d+'T12:00:00').toLocaleDateString(lang()==='en'?'en-GB':'nl-NL',{weekday:'short',day:'numeric',month:'short'}); } catch(e){ return d; } };
    const inp = 'style="background:var(--card,var(--bg));border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"';
    const items = o.items||[];
    return '<div class="card"><div class="tt-h">📅 '+T('ag.titel','Agenda')+(o.telling?' <span style="color:#E0736A;">('+o.telling+')</span>':'')+'</div>'+
      (items.length ? items.map(i => '<div class="mitem" data-agitem="'+i.id+'" style="opacity:'+(i.gedaan?'0.55':'1')+';"><div class="r1"><span class="nm">'+(i.gedaan?'✓ ':'')+esc(i.titel)+'</span><span class="pr" style="color:var(--soft);">'+esc(dagLbl(i.datum))+(i.tijd?' · '+esc(i.tijd):'')+'</span></div>'+
        (canEdit?'<div style="margin-top:0.35rem;display:flex;gap:0.4rem;">'+(!i.gedaan?'<button class="obtn" data-'+prefix+'done="'+i.id+'">'+T('ag.gedaan','Gedaan')+'</button>':'')+'<button class="rr-del" data-'+prefix+'del="'+i.id+'">✕</button></div>':'')+'</div>').join('')
        : '<div class="ds" style="margin-top:0.5rem;">'+T('ag.leeg','Nog niets gepland. Typ hieronder of laat de AI het inplannen.')+'</div>')+
      (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><input id="'+prefix+'Titel" placeholder="'+T('ag.wat','Afspraak')+'" '+inp+' style="flex:1;min-width:8rem;"><input id="'+prefix+'Datum" type="date" '+inp+'><input id="'+prefix+'Tijd" type="time" '+inp+'><button class="obtn primary" id="'+prefix+'Add">+</button></div>'+
        '<div style="margin-top:0.6rem;border-top:1px solid var(--line);padding-top:0.6rem;"><div style="font-size:0.72rem;color:var(--soft);margin-bottom:0.3rem;">✨ '+T('ag.aihint','Of typ het in gewone taal:')+'</div><div id="'+prefix+'AiOut"></div><div style="display:flex;gap:0.4rem;margin-top:0.4rem;"><input id="'+prefix+'AiIn" placeholder="'+T('ag.aiph','bijv. vergadering morgen om 15u')+'" '+inp+' style="flex:1;"><button class="obtn primary" id="'+prefix+'AiGo">'+T('ag.plan','Plan')+'</button></div></div>' : '')+'</div>';
  }
  function renderAgendaSup(){
    const el = $('#agendaSupCard'); if (!el) return;
    if (!actor().manager){ el.innerHTML = ''; return; }
    if (!agendaSupData){ el.innerHTML = ''; laadAgendaSup(); return; }
    el.innerHTML = agendaCardHtml(agendaSupData, true, 'sag', '/supplier/agenda');
    el.querySelectorAll('[data-sagdone]').forEach(b => b.addEventListener('click', async () => { try { agendaToeSup(await API.call('/supplier/agenda/wijzig', { id: b.dataset.sagdone, gedaan: true })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-sagdel]').forEach(b => b.addEventListener('click', async () => { try { agendaToeSup(await API.call('/supplier/agenda/verwijder', { id: b.dataset.sagdel })); } catch(e){ toast(e.message); } }));
    const add = $('#sagAdd'); if (add) add.addEventListener('click', async () => { const titel = $('#sagTitel').value.trim(); const datum = $('#sagDatum').value; if (!titel||!datum){ toast(T('ag.vulin','Vul een afspraak en datum in.')); return; } try { agendaToeSup(await API.call('/supplier/agenda/toevoegen', { titel, datum, tijd: $('#sagTijd').value })); } catch(e){ toast(e.message); } });
    const aiGo = $('#sagAiGo'); if (aiGo){ const doe = async () => { const opdracht = $('#sagAiIn').value.trim(); if (!opdracht) return; const out = $('#sagAiOut'); out.innerHTML = '<div class="ds">…</div>'; try { const r = await API.call('/supplier/agenda/ai', { opdracht }); out.innerHTML = '<div class="ds" style="color:'+(r.gedaan?'#7EE0A3':'var(--txt)')+';">'+esc(r.antwoord)+'</div>'; $('#sagAiIn').value=''; agendaToeSup(r); } catch(e){ out.innerHTML = '<div class="ds" style="color:#E0736A;">'+esc(e.message)+'</div>'; } }; aiGo.addEventListener('click', doe); const i2 = $('#sagAiIn'); if (i2) i2.addEventListener('keydown', e => { if (e.key==='Enter') doe(); }); }
  }

  async function renderZaakBoard(){
    const el = $('#boardroomWrap'); if (!el) return;
    renderAgendaSup();
    let d; try { d = await API.call('/supplier/zaak/board'); } catch(e){ return; }
    const zbChips = '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">'+
      (d.functies||[]).map(f => '<button class="js-zbf" data-id="'+f.id+'" data-aan="'+f.aan+'" style="border:1px solid '+(f.aan?'#1f5637':'var(--rood)')+';background:'+(f.aan?'#12321f':'#3a1420')+';color:'+(f.aan?'#7EE0A3':'#F4B8C6')+';border-radius:999px;padding:0.34rem 0.75rem;font-size:0.74rem;font-weight:600;font-family:inherit;">'+(f.aan?'● ':'○ ')+esc(f.naam)+'</button>').join('')+
      '</div>';
    let h = funcBlok(T('zb.functies','Functies (aan/uit)'), d.functies||[], zbChips);
    // HR
    const hr = d.hr || {};
    h += '<div class="st-sec">👥 '+T('zb.hr','HR')+'</div><div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.6rem;">'+
      zbCel(hr.teamAantal||0, T('zb.team','Team'))+zbCel(hr.ingeklokt||0, T('zb.ingeklokt','Ingeklokt'))+
      zbCel(hr.openVerlof||0, T('zb.verlof','Verlof/ziek'), hr.openVerlof)+zbCel(hr.openSollicitaties||0, T('zb.soll','Sollicitaties'), hr.openSollicitaties)+
      zbCel(hr.openVacatures||0, T('zb.vac','Vacatures'))+'</div>'+
      '<button class="js-zbnaar" data-tab="team" style="background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--txt);font-size:0.75rem;font-family:inherit;margin-bottom:1rem;">'+T('zb.naarteam','Naar het team ›')+'</button>';
    // Marketing
    const mk = d.marketing || {};
    h += '<div class="st-sec">📣 '+T('zb.marketing','Marketing (De Salon)')+'</div><div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
      zbCel(mk.volgers||0, T('zb.volgers','Volgers'))+zbCel(mk.posts||0, T('zb.posts','Posts'))+
      zbCel(mk.lopendeDeal?1:0, T('zb.deal','Actie'))+zbCel(mk.lopendePoll?1:0, T('zb.poll','Poll'))+'</div>'+
      '<div class="sub" style="margin-bottom:0.4rem;">'+(mk.salonActief? (mk.bioIngevuld&&mk.fotoIngevuld ? '✓ '+T('zb.compleet','profiel compleet, zichtbaar voor leden') : '⚠️ '+T('zb.onvolledig','profiel onvolledig, nog niet zichtbaar')) : '○ '+T('zb.salonuit','Salon-marketing staat uit'))+'</div>'+
      (mk.laatstePost? '<div class="sub">'+T('zb.laatste','Laatste post')+': '+esc(mk.laatstePost.text)+'</div>' : '')+
      '<button class="js-zbnaar" data-tab="page" style="background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--txt);font-size:0.75rem;font-family:inherit;margin-top:0.5rem;">'+T('zb.naarsalon','Naar De Salon ›')+'</button>';
    // Rechtstreekse ontvangsten: geld dat direct van klanten binnenkwam (Face ID)
    let ont = null; try { ont = await API.call('/supplier/ontvangsten'); } catch(e){}
    if (ont){
      const e2 = n => '€ '+((n||0)/100).toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2});
      h += '<div class="st-sec">💸 '+T('zb.ontvangsten','Rechtstreekse ontvangsten')+'</div>'+
        '<div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
        '<div class="b" style="flex:1;min-width:5rem;"><div class="v">'+e2(ont.som)+'</div><div class="l">'+T('zb.binnen','Binnengekomen')+'</div></div>'+
        '<div class="b" style="flex:1;min-width:4.5rem;"><div class="v">'+(ont.aantal||0)+'</div><div class="l">'+T('zb.betalingen','Betalingen')+'</div></div>'+
        '<div class="b" style="flex:1;min-width:5rem;"><div class="v">'+e2(ont.saldo)+'</div><div class="l">'+T('zb.saldo','Uitbetaalbaar')+'</div></div></div>'+
        '<div class="sub" style="margin-bottom:0.4rem;">'+T('zb.directsub','Face ID-betalingen van klanten, rechtstreeks op uw rekening.')+'</div>'+
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
        '<input id="bvCode" placeholder="'+T('zb.codenaam','codenaam klant')+'" style="width:9rem;">'+
        '<input id="bvBedrag" type="number" min="0.5" step="0.5" placeholder="'+T('zb.bedrag','bedrag €')+'" style="width:6.5rem;">'+
        '<input id="bvOms" placeholder="'+T('zb.waarvoor','waarvoor')+'" style="width:9rem;">'+
        '<button class="abtn" id="bvSend">'+T('zb.stuurverzoek','Stuur betaalverzoek')+'</button></div>'+
        (ont.openVerzoeken&&ont.openVerzoeken.length? '<div class="sub" style="margin-bottom:0.3rem;">'+T('zb.open','Openstaand')+':</div>'+ont.openVerzoeken.map(v=>'<div style="display:flex;justify-content:space-between;gap:0.5rem;border-bottom:1px solid var(--line);padding:0.3rem 0;font-size:0.8rem;"><span>'+esc(v.naarCodename||'')+' · '+esc(v.omschrijving||'')+'</span><span>'+e2(v.bedrag)+' <button class="bev-plan" data-bvweg="'+v.ref+'">✕</button></span></div>').join(''):'')+
        (ont.betalingen&&ont.betalingen.length? '<div class="sub" style="margin:0.4rem 0 0.3rem;">'+T('zb.recent','Recent binnen')+':</div>'+ont.betalingen.slice(0,6).map(b=>'<div style="display:flex;justify-content:space-between;gap:0.5rem;font-size:0.8rem;padding:0.2rem 0;"><span>'+esc(b.codename||'')+' · '+esc(b.omschrijving||'')+'</span><b>'+e2(b.bedrag)+'</b></div>').join(''):'');
    }
    // Boerderij-KPI's: de boardroom van de boer (oogst, dieropbrengst, taken)
    if (has('boerderij')){
      let bo = boer; if (!bo){ try { bo = await API.call('/supplier/boerderij/overzicht', {}); boer = bo; } catch(e){} }
      if (bo){ const bst = bo.stats||{}; const bbr = bo.briefing||{ punten:[] };
        h += '<div class="st-sec">🚜 '+T('zb.boer','Boerderij')+(bo.typeLabel?' · '+esc(bo.typeLabel):'')+'</div>'+
          '<div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
          zbCel(bst.teOogsten||0, T('zb.oogstklaar','Oogstklaar'), bst.teOogsten)+
          zbCel((bst.hectare||0)+' ha', T('zb.areaal','Areaal'))+
          zbCel(bst.melkPerDag||0, T('zb.melk','L melk/dag'))+
          zbCel(bst.dieren||0, T('zb.dieren','Dieren'))+
          zbCel(bst.openTaken||0, T('zb.boertaken','Open taken'), bst.openTaken)+'</div>'+
          (bbr.punten.length ? '<div class="sub" style="margin-bottom:0.4rem;">'+esc(bbr.punten[0].tekst)+'</div>' : '')+
          '<button class="js-zbnaar" data-tab="boerderij" style="background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--txt);font-size:0.75rem;font-family:inherit;margin-bottom:1rem;">'+T('zb.naarboer','Naar de boerderij ›')+'</button>';
      }
    }
    // de belastingtool van de zaak: dezelfde motor als de Business Pass
    h += '<div class="st-sec">🧮 '+T('zb.bel','Belastingtool')+'</div>'+
      '<div class="sub" style="margin-bottom:0.4rem;">'+T('zb.bel.s','Vul de verwachte jaarwinst in voor een indicatie van de belasting, de nettowinst en wat u maandelijks opzij zet. Het land van de zaak is het vertrekpunt.')+'</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
      '<input id="zbBelWinst" type="number" min="1" placeholder="'+T('zb.bel.ph','jaarwinst €')+'" style="width:9rem;">'+
      '<button class="abtn" id="zbBelGo">'+T('zb.bel.reken','Reken')+'</button></div>'+
      '<div id="zbBelRes" style="display:none;border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;font-size:0.78rem;line-height:1.7;color:var(--muted);margin-bottom:0.8rem;"></div>';
    el.innerHTML = h;
    const zbGo = el.querySelector('#zbBelGo');
    if (zbGo) zbGo.addEventListener('click', async () => {
      const box = el.querySelector('#zbBelRes');
      box.style.display = 'block'; box.textContent = '…';
      try {
        const d2 = await API.call('/supplier/belasting', { winst: Number(el.querySelector('#zbBelWinst').value) });
        const rij = (l, v, sterk) => '<div style="display:flex;justify-content:space-between;gap:0.8rem;"><span>'+l+'</span><span style="flex-shrink:0;'+(sterk?'color:var(--txt);font-weight:600;':'')+'">'+v+'</span></div>';
        box.innerHTML = '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);margin-bottom:0.35rem;">'+d2.regime+' · '+d2.landNaam+'</div>'+
          rij(T('zb.bel.winst','Jaarwinst'), eur(d2.winst))+
          d2.posten.map(p2 => rij(p2.label, (p2.bedrag<0?'- ':'')+eur(Math.abs(p2.bedrag)))).join('')+
          rij(T('zb.bel.betalen','Te betalen (indicatie)'), eur(d2.belasting), true)+
          rij(T('zb.bel.netto','Netto over'), eur(d2.netto), true)+
          '<div style="margin-top:0.5rem;color:var(--gold);">💡 '+T('zb.bel.zet','Zet ~')+d2.reserveerPct+'% '+T('zb.bel.opzij','opzij: ongeveer')+' '+eur(d2.perMaand)+' '+T('zb.bel.pm','per maand')+'.</div>'+
          '<div style="margin-top:0.4rem;font-size:0.64rem;color:var(--soft);">'+T('zb.bel.disc','Indicatie; dit is voorlichting, geen bindend fiscaal advies.')+'</div>';
      } catch(e){ box.textContent = e.message; }
    });
    wireFuncBlok(el);
    el.querySelectorAll('.js-zbf').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/zaak/functie', { id:b.dataset.id, aan: b.dataset.aan!=='true' }); await refresh(); renderZaakBoard(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-zbnaar').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab)));
    const bvSend = $('#bvSend');
    if (bvSend) bvSend.addEventListener('click', async () => {
      const bedrag = Number(($('#bvBedrag')||{}).value);
      if (!(bedrag >= 0.5)) { toast(T('zb.bedragmin','Kies een bedrag van minstens € 0,50.')); return; }
      try { await API.call('/supplier/betaalverzoek', { codename: ($('#bvCode')||{}).value, bedrag, omschrijving: ($('#bvOms')||{}).value }); toast('💸 '+T('zb.verzoekgestuurd','Betaalverzoek verstuurd.')); renderZaakBoard(); }
      catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-bvweg]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/betaalverzoek/intrek', { ref:b.dataset.bvweg }); renderZaakBoard(); } catch(e){ toast(e.message); }
    }));
  }
  function zbCel(n, label, waarschuw){
    return '<div class="b" style="flex:1;min-width:4.5rem;"><div class="v'+(waarschuw?' a':'')+'">'+n+'</div><div class="l">'+label+'</div></div>';
  }
  /* Gedeeld met de Boardroom: vat een rij aan/uit-schakelaars samen tot een
     rustige, inklapbare kop "titel · X/Y aan". Alleen open als er iets uit staat
     (de uitzondering telt), of wanneer de gebruiker erop tikt. Zo lijken alle
     schakelpanelen op elkaar en oogt veel opties nooit slordig. */
  function funcBlok(titel, functies, chipsHTML){
    const totaal = functies.length;
    const aan = functies.filter(f => f.aan).length;
    const uit = totaal - aan;
    const afwijkt = uit > 0;
    return '<button type="button" class="func-kop" data-funcblok>'+
      '<span class="func-chev">'+(afwijkt?'▾':'▸')+'</span>'+
      '<span class="func-naam">'+esc(titel)+'</span>'+
      '<span class="func-tel'+(afwijkt?' let':'')+'">'+aan+'/'+totaal+' '+T('fb.aan','aan')+(uit?' · '+uit+' '+T('fb.uit','uit'):'')+'</span></button>'+
      '<div class="func-body"'+(afwijkt?'':' hidden')+'>'+chipsHTML+'</div>';
  }
  /* Klap elk funcBlok in een container open/dicht (chevron mee). */
  function wireFuncBlok(root){
    if (!root) return;
    root.querySelectorAll('[data-funcblok]').forEach(k => k.addEventListener('click', () => {
      const body = k.nextElementSibling; if (!body) return;
      const chev = k.querySelector('.func-chev');
      const dicht = body.hidden; body.hidden = !dicht;
      if (chev) chev.textContent = dicht ? '▾' : '▸';
    }));
  }

  /* ---- het beveiligings-commandocentrum ---- */
  let bevDatum = null; // gekozen roosterdag
  function bevVandaag(){ return new Date().toISOString().slice(0,10); }
  async function renderBeveiliging(){
    const el = $('#bevWrap'); if (!el) return;
    if (!has('beveiliging')) { el.innerHTML=''; return; }
    let cmd, roo;
    if (!bevDatum) bevDatum = bevVandaag();
    try { cmd = await API.call('/supplier/beveiliging/command'); } catch(e){ el.innerHTML='<div class="softline">'+esc(e.message)+'</div>'; return; }
    try { roo = await API.call('/supplier/beveiliging/rooster', { van: bevDatum, dagen: 1 }); } catch(e){ roo = { dagen: [] }; }
    const b = cmd.budget || {};
    // 1) momentopname
    let h = '<div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.8rem;">'+
      zbCel(cmd.opDienst.length, T('bev.opdienst','Op dienst'))+
      zbCel(cmd.team, T('bev.team','Bewakers'))+
      zbCel(cmd.posten, T('bev.posten','Posten'))+
      zbCel(cmd.openVandaag, T('bev.openvandaag','Open vandaag'), cmd.openVandaag)+
      zbCel(cmd.openAanvragen, T('bev.aanvragen','Aanvragen'), cmd.openAanvragen)+
      zbCel(cmd.incidentenOpen, T('bev.incidenten','Incidenten'), cmd.incidentenOpen)+'</div>';
    if (cmd.sosActief) h += '<div class="card" style="border:1px solid var(--rood);background:#3a1420;color:#F4B8C6;margin-bottom:0.8rem;font-weight:600;">🆘 '+T('bev.sos','Actieve SOS! Een bewaker heeft de noodknop ingedrukt. Bekijk het incident en stuur bijstand.')+'</div>';
    // 2) functies aan/uit
    const bevChips = '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">'+
      (cmd.functies||[]).map(f => '<button class="js-bevf" data-id="'+f.id+'" data-aan="'+f.aan+'" style="border:1px solid '+(f.aan?'#1f5637':'var(--rood)')+';background:'+(f.aan?'#12321f':'#3a1420')+';color:'+(f.aan?'#7EE0A3':'#F4B8C6')+';border-radius:999px;padding:0.34rem 0.75rem;font-size:0.74rem;font-weight:600;font-family:inherit;">'+(f.aan?'● ':'○ ')+esc(f.naam)+'</button>').join('')+'</div>';
    h += funcBlok(T('bev.func','Functies (aan/uit)'), cmd.functies||[], bevChips);
    // 3) budget
    if (b.budgetUren){
      const kleur = b.overschrijding ? 'var(--rood)' : (b.pct>=85?'#E0A93A':'#7EE0A3');
      h += '<div class="st-sec">💶 '+T('bev.budget','Budget & uren')+'</div>'+
        '<div class="card" style="margin-bottom:1rem;">'+
        '<div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:0.3rem;"><span>'+b.urenGepland+' / '+b.budgetUren+' '+T('bev.uur','uur')+' ('+b.maand+')</span><b>€ '+b.bestedBedrag+' / € '+b.budgetBedrag+'</b></div>'+
        '<div style="height:8px;border-radius:99px;background:var(--card2);overflow:hidden;"><div style="height:100%;width:'+Math.min(100,b.pct)+'%;background:'+kleur+';"></div></div>'+
        '<div class="sub" style="margin-top:0.4rem;">'+esc(b.advies)+'</div>'+
        (b.perPost&&b.perPost.length? '<div class="sub" style="margin-top:0.4rem;">'+b.perPost.map(p=>esc(p.naam)+': '+p.uren+' u (€ '+p.bedrag+')').join(' · ')+'</div>':'')+
        '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;flex-wrap:wrap;"><input id="bevBudUren" type="number" min="0" placeholder="'+T('bev.buduren','budget-uren/mnd')+'" value="'+b.budgetUren+'" style="width:9rem;">'+
        '<input id="bevBudTarief" type="number" min="0" placeholder="'+T('bev.tarief','tarief/uur')+'" value="'+b.tariefUur+'" style="width:8rem;">'+
        '<button class="abtn" id="bevBudSave">'+T('bev.opslaan','Opslaan')+'</button></div>'+
        '</div>';
    }
    // 4) rooster met AI-overname
    h += '<div class="st-sec">📋 '+T('bev.rooster','Rooster')+'</div>'+
      '<div style="display:flex;gap:0.4rem;align-items:center;margin-bottom:0.6rem;flex-wrap:wrap;">'+
      '<input id="bevDag" type="date" value="'+bevDatum+'" style="width:11rem;">'+
      '<button class="abtn" id="bevAI">✨ '+T('bev.ai','AI neemt het over')+'</button></div>';
    const dag = roo.dagen && roo.dagen[0];
    if (dag){
      h += '<div class="card" style="margin-bottom:1rem;">'+ (dag.posten.length? dag.posten.map(p =>
        '<div style="border-bottom:1px solid var(--line);padding:0.5rem 0;">'+
          '<div style="display:flex;justify-content:space-between;"><b>'+esc(p.post)+'</b>'+(p.open?'<span style="color:var(--rood);font-size:0.72rem;">'+p.open+' '+T('bev.open','open')+'</span>':'<span style="color:#7EE0A3;font-size:0.72rem;">'+T('bev.gedekt','gedekt')+'</span>')+'</div>'+
          p.shifts.map(sl => '<div class="sub" style="margin-top:0.2rem;">'+esc(sl.shift)+': '+
            (sl.bezet.length? sl.bezet.map(d=>'<span class="bev-chip'+(d.status==='ingeklokt'?' on':'')+'">'+esc(d.guardNaam||'?')+(d.status==='ingeklokt'?' ●':'')+' <a data-schrap="'+d.id+'">✕</a></span>').join(' ') : '')+
            (sl.open? ' <button class="bev-plan" data-post="'+p.postId+'" data-shift="'+sl.shiftId+'">+ '+T('bev.plan','plan')+'</button>':'')+
          '</div>').join('')+
        '</div>'
      ).join('') : '<div class="softline">'+T('bev.geenpost','Nog geen posten. Voeg hieronder objecten toe.')+'</div>')+'</div>';
    }
    // 5) inzetaanvragen
    h += '<div class="st-sec">🛡️ '+T('bev.inzet','Inzetaanvragen')+'</div>';
    const open = (cmd.functies||[]).find(f=>f.id==='aanvragen' && f.aan);
    h += '<div class="card" style="margin-bottom:1rem;"><div id="bevAvLijst"></div>'+
      (open? '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">'+
        '<input id="bevAvKlant" placeholder="'+T('bev.klant','klant')+'" style="width:8rem;">'+
        '<input id="bevAvObject" placeholder="'+T('bev.object','object/locatie')+'" style="width:9rem;">'+
        '<input id="bevAvDatum" type="date" value="'+bevDatum+'" style="width:10rem;">'+
        '<input id="bevAvAantal" type="number" min="1" value="1" style="width:5rem;" title="'+T('bev.aantal','aantal bewakers')+'">'+
        '<button class="abtn" id="bevAvAdd">'+T('bev.avadd','Aanvraag toevoegen')+'</button></div>':'')+
      '</div>';
    // 6) posten beheren
    const posten = cmd.postenLijst || [];
    h += '<div class="st-sec">📍 '+T('bev.postbeheer','Posten & objecten')+'</div>'+
      '<div class="card" style="margin-bottom:1rem;">'+
      (posten.length? posten.map(p => '<div style="border-bottom:1px solid var(--line);padding:0.35rem 0;display:flex;justify-content:space-between;gap:0.5rem;">'+
        '<span><b>'+esc(p.naam)+'</b>'+(p.klant?' · '+esc(p.klant):'')+' · '+(p.minMan||1)+' '+T('bev.man','man')+(p.orders?'<br><span class="sub">'+esc(p.orders)+'</span>':'')+'</span>'+
        '<button class="abtn ghost" data-postweg="'+p.id+'">✕</button></div>').join('') : '<div class="softline">'+T('bev.geenpost2','Nog geen posten.')+'</div>')+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">'+
      '<input id="bevPostNaam" placeholder="'+T('bev.postnaam','postnaam')+'" style="width:9rem;">'+
      '<input id="bevPostKlant" placeholder="'+T('bev.klant','klant')+'" style="width:8rem;">'+
      '<input id="bevPostMin" type="number" min="1" value="1" style="width:5rem;" title="'+T('bev.min','min. bezetting')+'">'+
      '<button class="abtn" id="bevPostAdd">'+T('bev.postadd','Post toevoegen')+'</button></div></div>';
    // 7) incidenten
    if (cmd.incidenten && cmd.incidenten.length){
      h += '<div class="st-sec">🚨 '+T('bev.incs','Incidenten')+'</div><div class="card" style="margin-bottom:0.5rem;">'+
        cmd.incidenten.map(x => '<div style="border-bottom:1px solid var(--line);padding:0.4rem 0;display:flex;justify-content:space-between;gap:0.5rem;">'+
          '<span><b'+(x.ernst==='kritiek'||x.ernst==='hoog'?' style="color:var(--rood);"':'')+'>'+(x.sos?'🆘 ':'')+esc(x.soort)+'</b> · '+esc(x.post)+' · '+esc(x.guardNaam||'')+'<br><span class="sub">'+esc(x.tekst)+'</span></span>'+
          '<button class="bev-inc" data-id="'+x.id+'" style="align-self:flex-start;">'+(x.status==='open'?T('bev.afh','Afhandelen'):T('bev.heropen','Heropen'))+'</button></div>').join('')+'</div>';
    }
    el.innerHTML = h;
    wireFuncBlok(el);
    // bindingen
    el.querySelectorAll('.js-bevf').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/functie', { id:x.dataset.id, aan: x.dataset.aan!=='true' }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    const bind = (id, fn) => { const e2=$('#'+id); if (e2) e2.addEventListener('click', fn); };
    const dagInp = $('#bevDag'); if (dagInp) dagInp.addEventListener('change', () => { bevDatum = dagInp.value || bevVandaag(); renderBeveiliging(); });
    bind('bevAI', async () => { try { const r = await API.call('/supplier/beveiliging/planauto', { datum: bevDatum }); toast(r.uitleg); renderBeveiliging(); } catch(e){ toast(e.message); } });
    bind('bevBudSave', async () => { try { await API.call('/supplier/beveiliging/budget', { periodeUren: $('#bevBudUren').value, tariefUur: $('#bevBudTarief').value }); renderBeveiliging(); } catch(e){ toast(e.message); } });
    bind('bevAvAdd', async () => { try { await API.call('/supplier/beveiliging/aanvraag', { klant:$('#bevAvKlant').value, object:$('#bevAvObject').value, datum:$('#bevAvDatum').value, aantal:$('#bevAvAantal').value }); renderBeveiliging(); } catch(e){ toast(e.message); } });
    bind('bevPostAdd', async () => { try { await API.call('/supplier/beveiliging/post', { naam:$('#bevPostNaam').value, klant:$('#bevPostKlant').value, minMan:$('#bevPostMin').value }); renderBeveiliging(); } catch(e){ toast(e.message); } });
    el.querySelectorAll('.bev-plan').forEach(x => x.addEventListener('click', async () => {
      const gid = prompt(T('bev.wieplan','Welke bewaker? Typ de naam precies.')); if (!gid) return;
      const staff = (state.staff||[]).find(m => m.name.toLowerCase() === gid.trim().toLowerCase());
      if (!staff) { toast(T('bev.geenbewaker','Geen bewaker met die naam.')); return; }
      try { await API.call('/supplier/beveiliging/dienst', { postId:x.dataset.post, shiftId:x.dataset.shift, datum:bevDatum, guardId:staff.id }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-schrap]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/dienst/weg', { id:x.dataset.schrap }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.bev-inc').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/incident/beslis', { id:x.dataset.id }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-postweg]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/post/weg', { id:x.dataset.postweg }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    // de aanvragenlijst los inladen (eigen endpoint met open + afgerond)
    bevLaadAanvragen();
  }
  async function bevLaadAanvragen(){
    const el = $('#bevAvLijst'); if (!el) return;
    let d; try { d = await API.call('/supplier/beveiliging/aanvragen'); } catch(e){ return; }
    if (!d.open.length && !d.afgerond.length){ el.innerHTML = '<div class="softline">'+T('bev.geenav','Nog geen inzetaanvragen.')+'</div>'; return; }
    el.innerHTML = d.open.map(a => '<div style="border-bottom:1px solid var(--line);padding:0.4rem 0;display:flex;justify-content:space-between;gap:0.5rem;">'+
      '<span><b>'+esc(a.klant)+'</b> · '+esc(a.object)+' · '+esc(a.datum)+' · '+a.aantal+'× '+esc(a.shiftId)+'</span>'+
      '<span style="display:flex;gap:0.3rem;"><button class="abtn" data-avplan="'+a.ref+'">'+T('bev.avplan','Inplannen')+'</button>'+
      '<button class="abtn ghost" data-avweg="'+a.ref+'">'+T('bev.avweg','Afwijzen')+'</button></span></div>').join('')+
      (d.afgerond.length? '<div class="sub" style="margin-top:0.4rem;">'+d.afgerond.slice(0,5).map(a=>esc(a.object)+' ('+esc(a.status)+')').join(' · ')+'</div>':'');
    el.querySelectorAll('[data-avplan]').forEach(x => x.addEventListener('click', async () => {
      try { const r = await API.call('/supplier/beveiliging/aanvraag/beslis', { ref:x.dataset.avplan, actie:'plan' }); toast(T('bev.ingepland','Ingepland en op het rooster gezet.')); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-avweg]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/aanvraag/beslis', { ref:x.dataset.avweg, actie:'afwijzen' }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
  }

  // alle overige functies als nette knoppen in het Meer-scherm
  function renderMeer(){
    const el = $('#meerWrap'); if (!el) return;
    // het afdelingenbord (dorp) is er voor kamers (hotel), de nachtzaak, restaurants en beachclubs
    const dorpKan = has('bookings') || ['bar', 'club', 'beachclub', 'restaurant'].includes(S && S.type);
    const keys = Object.keys(TABDEF).filter(k => !MAIN_TABS.includes(k) && (!TABDEF[k].cap || has(TABDEF[k].cap)) && (k !== 'bezorg' || !!(state && state.bezorg)) && (k !== 'dorp' || dorpKan));
    // vervoerszaken krijgen de Ghost Driver erbij: de vooruitkijkende
    // verkeersleider (eigen app-pagina, zelfde zaak-inlog)
    const ghost = has('rides')
      ? '<button class="meer-btn" data-ghost="1"><svg viewBox="0 0 24 24"><path d="M12 3a7 7 0 0 1 7 7v9l-2.3-2-2.4 2-2.3-2-2.3 2-2.4-2L5 19v-9a7 7 0 0 1 7-7z"/><circle cx="9.5" cy="11" r="1"/><circle cx="14.5" cy="11" r="1"/></svg><b>Ghost Driver</b></button>'
      : '';
    // een tweede scherm aansluiten: een extra beeldscherm dat schermvullend een
    // werkplek toont (keuken, bar, uit te serveren, kassa, gasten) of het
    // hoofdscherm spiegelt. Werkt op elke zaak; opent een eigen venster.
    const scherm = '<button class="meer-btn" data-scherm="1"><svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 20h8M12 17v3"/></svg><b>'+T('tab.scherm','Tweede scherm')+'</b></button>';
    el.innerHTML = '<div class="meer-grid">' + keys.map(k =>
      '<button class="meer-btn" data-goto2="'+k+'"><svg viewBox="0 0 24 24">'+TABDEF[k].svg+'</svg><b>'+T('tab.'+k, TABDEF[k].label)+'</b></button>'
    ).join('') + ghost + scherm + '</div>';
    el.querySelectorAll('[data-goto2]').forEach(b => b.addEventListener('click', () => openTab(b.dataset.goto2)));
    el.querySelectorAll('[data-ghost]').forEach(b => b.addEventListener('click', () => { location.href = '/apps/ghost.html'; }));
    el.querySelectorAll('[data-scherm]').forEach(b => b.addEventListener('click', () => {
      window.open('/apps/scherm.html', 'rtg-scherm', 'width=1280,height=800');
      toast(T('scherm.geopend','Tweede scherm geopend. Sleep het venster naar uw extra beeldscherm en kies daar een werkplek of "Spiegel".'));
    }));
  }

  function renderAll(){
    $('#supIcon').textContent = S.icon;
    $('#supName').textContent = S.name;
    $('#supType').textContent = tType(S.typeLabel) + ' · ' + S.city;
    renderActor();
    if (stationMode){ renderStation(); return; }
    renderHome(); renderOrders(); renderRides(); renderMenu(); renderPrice(); renderLocation(); renderKassa(); renderBezorg(); renderTickets(); renderVerhuur(); renderCharter(); renderVastgoed(); renderBoerderij(); renderCreator(); renderSamenwerking(); renderFacturen(); renderRtfMarkt(); renderRetail(); renderModeBezorg(); renderWinkelvloer(); renderZorgbalieLev(); renderVerkoop(); renderGroothandel(); renderInkoop(); renderZaakBoard(); renderBeveiliging(); renderPaspoort(); renderContracten(); renderOnbCfg(); renderRooms(); renderDorp(); renderMinibar(); renderKlussen(); renderTafels(); renderBeheer(); renderDoors(); renderGasten(); renderGChat(); renderPage(); renderTeam(); renderBorden(); renderReviews(); renderVoorraad(); renderMeer(); renderAIChips();
    // Zorg dat het actieve tabblad ook echt zichtbaar is: de tabbar-knop staat al
    // op 'active', maar zonder deze aanroep krijgt geen enkele .view de active-klasse
    // en blijft het overzicht leeg bij de eerste render.
    if (!document.querySelector('.view.active')){
      const knop = document.querySelector('.tabbar button.active');
      openTab(knop ? knop.dataset.tab : 'home');
    }
  }

  function actor(){ return (state && state.actor) || { name:'Beheer', role:'manager', manager:true }; }
  function renderActor(){
    const a = actor();
    $('#actorAv').textContent = initials(a.name);
    $('#actorName').textContent = a.name;
  }

  // ---- home ----
  function renderHome(){
    const open = (state.orders||[]).filter(o => !['geserveerd','geweigerd','terugbetaald'].includes(o.status));
    const revenue = (state.orders||[]).filter(o=>o.paid).reduce((s,o)=>s+o.total,0);
    $('#homeH').textContent = T('sup.hello','Goedendag,') + ' ' + S.name.split(' ')[0] + '.';
    const rating = state.reviews && state.reviews.rating;
    $('#homeSub').textContent = tType(S.typeLabel) + (rating ? ' · ⭐ ' + rating.score + ' (' + rating.aantal + ' reviews)' : '') + ' · ' + T('sup.connected','verbonden met RTG');
    let stat = '';
    if (has('orders')) stat += '<div class="b"><div class="l">'+T('sup.openorders','Open orders')+'</div><div class="v a">'+open.length+'</div></div>';
    if (has('rides')) stat += '<div class="b"><div class="l">'+T('tab.rides','Ritten')+'</div><div class="v a">'+(state.rides||[]).length+'</div></div>';
    if (has('bookings')) stat += '<div class="b"><div class="l">'+T('sup.bookings','Boekingen')+'</div><div class="v a">'+(state.orders||[]).length+'</div></div>';
    stat += '<div class="b"><div class="l">'+T('sup.received','Ontvangen')+'</div><div class="v g">'+eur(revenue)+'</div></div>';
    $('#homeStat').innerHTML = stat;
    let extra = '';

    // Vandaag nog doen: alles wat aandacht vraagt, met een sprong naar de juiste tab
    const todos = [];
    const unreadChats = (state.guestChats || []).reduce((n, c) => n + (c.unread || 0), 0);
    if (unreadChats) todos.push({ icon:'💬', txt: unreadChats + ' ' + T('todo.chats','onbeantwoord(e) gastbericht(en)'), tab:'gchat' });
    const newOrders = (state.orders || []).filter(o => o.status === 'nieuw').length;
    if (newOrders) todos.push({ icon:'🛎️', txt: newOrders + ' ' + T('todo.orders','nieuwe bestelling(en)'), tab:'orders' });
    const newRides = (state.rides || []).filter(r => r.status === 'aangevraagd').length;
    if (newRides) todos.push({ icon:'🚗', txt: newRides + ' ' + T('todo.rides','open ritaanvraag/-vragen'), tab:'rides' });
    if (state.minibar){
      const roomsAll = (state.rooms || []).map(r => r.name);
      const notCounted = roomsAll.filter(r => !state.minibar.countedToday.includes(r));
      if (notCounted.length) todos.push({ icon:'🧊', txt: notCounted.length + ' ' + T('todo.minibar','minibar(s) nog tellen'), tab:'minibar' });
    }
    const openRooms = Object.keys((state.pos && state.pos.openRooms) || {}).length;
    if (openRooms) todos.push({ icon:'🧾', txt: openRooms + ' ' + T('todo.folio','open kamerrekening(en)'), tab:'kassa' });
    const dirty = (state.rooms || []).filter(r => r.hk && (r.hk.status === 'vuil')).length;
    if (dirty) todos.push({ icon:'🧹', txt: dirty + ' ' + T('todo.dirty','kamer(s) schoon te maken'), tab:'rooms' });
    const defect = (state.rooms || []).filter(r => r.hk && r.hk.status === 'defect').length;
    if (defect) todos.push({ icon:'⚠️', txt: defect + ' ' + T('todo.defect','kamer(s) defect'), tab:'rooms' });
    const openTickets = (state.tickets || []).filter(t => t.status !== 'klaar').length;
    if (openTickets) todos.push({ icon:'🔧', txt: openTickets + ' ' + T('todo.tickets','open klus(sen)'), tab:'klussen' });
    const newApps = (state.applications || []).filter(x => x.status === 'nieuw').length;
    if (newApps) todos.push({ icon:'📝', txt: newApps + ' ' + T('todo.apps','nieuwe sollicitatie(s)'), tab:'team' });
    const openRes = (state.reserveringen || []).filter(r => r.status === 'aangevraagd').length;
    if (openRes) todos.push({ icon:'🪑', txt: openRes + ' ' + T('todo.res','open reservering(en) om te bevestigen'), tab:'orders' });
    extra += '<div class="card"><div class="tt-h">' + T('todo.h','Vandaag nog doen') + '</div>' +
      (todos.length ? todos.map(t =>
        '<button class="todo-row" data-goto="' + t.tab + '"><span>' + t.icon + '</span><b>' + t.txt + '</b><i>›</i></button>'
      ).join('') : '<div style="margin-top:0.5rem;font-size:0.82rem;color:var(--green);">✓ ' + T('todo.none','Alles is bij. Geen openstaande acties.') + '</div>') +
      '</div>';

    // recente reviews van gasten (1-5 sterren, geplaatst na afronding)
    const recentRevs = (state.reviews && state.reviews.recent) || [];
    if (recentRevs.length){
      extra += '<div class="card"><div class="tt-h">⭐ ' + T('rev.h','Recente reviews') + '</div>' +
        recentRevs.slice(0,3).map(r =>
          '<div style="margin-top:0.55rem;font-size:0.8rem;"><b>' + '★'.repeat(r.score) + '<span style="opacity:0.25;">' + '★'.repeat(5 - r.score) + '</span></b> <span class="cn">' + r.codename + '</span>' +
          (r.tekst ? '<div style="color:var(--soft);font-size:0.76rem;margin-top:0.15rem;">' + r.tekst + '</div>' : '') + '</div>'
        ).join('') + '</div>';
    }

    const guests = (state.guests || []);
    if (guests.length){
      extra += '<div class="card" style="border-color:rgba(194,58,94,0.35);"><div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--burgundy);display:flex;align-items:center;gap:0.4rem;"><span class="livedot"></span>'+T('sup.enroute','Gasten onderweg naar u')+'</div>'+
        guests.map(g => '<div class="guest-row"><span class="cn">'+g.codename+'</span>'+
          (g.arrived?'<span class="ge here">✓ '+T('sup.arrived','gearriveerd')+'</span>':(g.etaMin!=null?'<span class="ge"><b>'+g.etaMin+'</b> '+T('sup.minaway','min')+'</span>':'<span class="ge">'+T('sup.enrouteshort','onderweg')+'</span>'))+
        '</div>').join('')+'</div>';
    }
    extra += '<div class="card"><div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+T('sup.yourprice','Uw prijs voor RTG-leden')+'</div>'+
      '<div style="margin-top:0.4rem;font-size:0.85rem;color:var(--muted);">'+T('sup.pricebody','U levert RTG-leden uw beste prijs; RTG brengt de gasten en rekent 0% commissie. U houdt 100% van elke boeking.')+'</div>'+
      '<button class="obtn primary" style="margin-top:0.8rem;" data-goto="price">'+T('sup.newprice','Nieuwe prijs doorgeven')+'</button></div>';
    if (has('menu')) extra += '<div class="card"><div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+T('sup.menu','Menukaart')+'</div><div style="margin-top:0.4rem;font-size:0.85rem;color:var(--muted);">'+(state.menu||[]).length+' '+T('sup.dishesvisible','gerechten zichtbaar voor gasten.')+'</div><button class="obtn" style="margin-top:0.8rem;" data-goto="menu">'+T('sup.viewmenu','Bekijk menu')+'</button></div>';
    $('#homeExtra').innerHTML = extra;
    document.querySelectorAll('#content [data-goto]').forEach(b => b.addEventListener('click', ()=>openTab(b.dataset.goto)));
  }

  // ---- orders ----
  const NEXT = { 'nieuw':'in bereiding', 'in bereiding':'klaar', 'klaar':'geserveerd' };
  function pillClass(st){ return st==='nieuw'?'nieuw':st==='in bereiding'?'bereiding':(st==='klaar'||st==='geserveerd')?'klaar':''; }
  // Met het componentframework (Util.el): tekst (gast-codenaam, gerechtnamen,
  // allergie) wordt structureel als tekstknoop gezet -> altijd veilig, en elke
  // knop draagt zijn eigen handler (geen losse her-binding meer).
  function orderKaart(o){
    const E = Util.el;
    return E('div', { class: 'order', dataset: { ref: o.ref } },
      E('div', { class: 'top' },
        E('div', {},
          E('div', { class: 'who' }, T('sup.guest', 'Gast') + ' ', E('span', { class: 'cn' }, o.customerCodename)),
          E('div', { class: 'ref' }, o.ref + ' · ' + timeAgo(o.at)),
          (o.pickup && !['geserveerd', 'geweigerd', 'terugbetaald'].includes(o.status))
            ? E('div', { class: 'pickup' }, T('sup.pickup', 'Ophaalcode') + ' ', E('b', {}, o.pickup)) : null),
        E('div', { style: { textAlign: 'right' } },
          E('div', { class: 'amt' }, eur(o.total)),
          E('div', { style: { marginTop: '0.3rem' } }, E('span', { class: 'pill ' + pillClass(o.status) }, tStatus(o.status))))),
      E('ul', {}, o.items.map(i => E('li', {}, E('span', {}, i.qty + '× ' + i.name), E('span', {}, eur(i.price * i.qty))))),
      o.guestArrived ? E('div', { class: 'enroute here' }, '🎉 ' + T('sup.guesthere', 'Gast is gearriveerd. Serveer nu.'))
        : (o.guestEtaMin != null ? E('div', { class: 'enroute' }, '📍 ' + T('sup.guesteta', 'Gast onderweg, arriveert over ~') + o.guestEtaMin + ' ' + T('sup.min', 'min') + '. ' + T('sup.readyontime', 'Zet op tijd klaar.')) : null),
      o.allergyNote ? E('div', { class: 'allergy' }, '⚠ ' + T('sup.allergy', 'Allergie:') + ' ' + o.allergyNote) : null,
      // het zorgprofiel van de gast reist automatisch mee (alleen met toestemming)
      o.zorg ? E('div', { class: 'allergy' }, '⚠ ' + T('sup.zorgp', 'Zorgprofiel gast:') + ' ' + zorgTekst(o.zorg)) : null,
      o.tagSalon ? E('div', { class: 'salon' }, '✦ ' + T('sup.wantssalon', 'Gast wil dit taggen voor De Salon')) : null,
      E('div', { class: 'acts' },
        E('span', { class: 'pill ' + (o.paid ? 'betaald' : 'onbetaald') },
          o.refunded ? T('sup.refunded', 'terugbetaald') : (o.paid ? '✓ ' + T('bo.paid', 'betaald') : T('sup.notpaid', 'nog niet betaald'))),
        NEXT[o.status] ? E('button', { class: 'obtn primary js-next', onclick: () => setStatus(o.ref, NEXT[o.status]) }, T('sup.markas', 'Markeer:') + ' ' + tStatus(NEXT[o.status])) : null,
        o.status === 'nieuw' ? E('button', { class: 'obtn warn js-reject', onclick: () => setStatus(o.ref, 'geweigerd') }, T('sup.reject', 'Weiger')) : null,
        (o.paid && !o.refunded) ? E('button', { class: 'obtn warn js-refund', onclick: () => refund(o.ref) }, T('sup.refund', 'Terugstorten')) : null));
  }
  function renderOrders(){
    renderReserveringen();
    const list = state.orders || [];
    const wrap = $('#orderList');
    if (!list.length){ Util.vervang(wrap, Util.el('div', { class: 'empty' }, T('sup.noorders', 'Nog geen bestellingen. Zodra een RTG-gast bij u bestelt, verschijnt het hier, live.'))); return; }
    Util.vervang(wrap, list.map(orderKaart));
  }

  /* De tafelplanning: vandaag als gedekte avond (tafels, komst, walk-ins) en
     de komende dagen als lijst. Elke rij draagt zijn eigen knoppen: bevestigen,
     tafel toewijzen, gast is er, no-show, vertrokken. */
  const RES_PILL = { aangevraagd:'nieuw', bevestigd:'bereiding', aangekomen:'klaar' };
  function resStatusTekst(st){
    return st==='aangevraagd'?T('res.st.nieuw','nieuw'):st==='bevestigd'?T('res.bevestigd','bevestigd'):st==='aangekomen'?T('res.st.er','aan tafel'):st==='no-show'?'no-show':st==='afgerond'?T('res.st.weg','vertrokken'):st;
  }
  function resRij(r, vandaag){
    const knoppen = [];
    if (r.status === 'aangevraagd') knoppen.push('<button class="obtn primary js-resok">'+T('res.ok','Bevestig')+'</button>','<button class="obtn warn js-resnee">'+T('sup.reject','Weiger')+'</button>');
    if (r.status === 'bevestigd'){
      knoppen.push('<button class="obtn js-restafel">🪑 '+(r.tafel?esc(r.tafel):T('res.tafel','Tafel'))+'</button>');
      if (vandaag) knoppen.push('<button class="obtn primary js-reser">'+T('res.er','Gast is er')+'</button>','<button class="obtn warn js-resno">'+T('res.noshow','No-show')+'</button>');
    }
    if (r.status === 'aangekomen') knoppen.push('<button class="obtn js-resweg">'+T('res.weg','Vertrokken')+'</button>');
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;margin-top:0.55rem;font-size:0.82rem;flex-wrap:wrap;" data-res="'+r.id+'">'+
      '<span><b>'+r.tijd+'</b> · <b class="cn">'+esc(r.customerCodename)+'</b> · '+r.personen+'p'+
        (r.tafel?' · 🪑 '+esc(r.tafel):'')+(r.notitie?' · 📝 '+esc(r.notitie):'')+(vandaag?'':' · '+r.datum)+
        (r.zorg?'<span style="display:block;color:#E2B93B;">⚠ '+esc(zorgTekst(r.zorg))+'</span>':'')+'</span>'+
      (knoppen.length
        ? '<span style="display:flex;gap:0.4rem;flex-shrink:0;">'+knoppen.join('')+'</span>'
        : '<span class="pill '+(RES_PILL[r.status]||'klaar')+'" style="flex-shrink:0;">'+resStatusTekst(r.status)+'</span>')+
    '</div>';
  }
  async function renderReserveringen(){
    const wrap = $('#resWrap');
    if (!wrap) return;
    const later = (state.reserveringen || []).filter(r => r.datum > new Date().toISOString().slice(0,10) && ['aangevraagd','bevestigd'].includes(r.status));
    let plan = null;
    try { plan = await API.call('/supplier/tafelplan', {}); } catch(e){ plan = { reserveringen: [], tafels: [], verwachtePersonen: 0, openAanvragen: 0, zonderTafel: 0 }; }
    if (!plan.reserveringen.length && !later.length && !plan.tafels.length){ wrap.innerHTML = ''; return; }
    const chips = plan.tafels.length
      ? '<div class="pos-chips" style="margin-top:0.5rem;">'+plan.tafels.map(t =>
          t.status==='vrij'
            ? '<span><button class="obtn js-walkin" data-tafel="'+esc(t.name)+'" style="padding:0.15rem 0.5rem;">'+esc(t.name)+' · '+T('res.vrij','vrij')+'</button></span>'
            : '<span>'+esc(t.name)+' · '+t.status+(t.reserveringen.length?' · '+t.reserveringen.join(', '):'')+(t.rekening?' · '+eur(t.rekening.totaal):'')+'</span>'
        ).join('')+'</div>'+
        '<div class="softline" style="margin-top:0.3rem;">'+T('res.walkins','Een vrije tafel aantikken plaatst een walk-in.')+'</div>'
      : '';
    // de open rekeningen: alles wat de kassa op de tafel zette, hier afrekenen
    const rekeningen = plan.tafels.filter(t => t.rekening);
    const rekBlok = rekeningen.length
      ? rekeningen.map(t => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;margin-top:0.55rem;font-size:0.82rem;flex-wrap:wrap;" data-tafelrek="'+esc(t.name)+'">'+
          '<span><b>'+esc(t.name)+'</b> · '+t.rekening.posten+' '+T('pos.posts','post(en)')+' · <b style="color:var(--gold);">'+eur(t.rekening.totaal)+'</b></span>'+
          '<span style="display:flex;gap:0.4rem;flex-shrink:0;flex-wrap:wrap;">'+
            '<button class="obtn primary js-rekpay" data-method="rtgpay">RTG Pay</button>'+
            '<button class="obtn js-reksplit">'+T('res.splits','Splits')+'</button>'+
            '<button class="obtn js-rekpay" data-method="contant">'+T('pos.cash','Contant')+'</button></span>'+
        '</div>').join('')
      : '';
    wrap.innerHTML = '<div class="card"><div class="tt-h">🪑 '+T('res.vandaag','Tafelplanning vandaag')+'</div>'+
      '<div class="pos-chips" style="margin-top:0.4rem;">'+
        '<span>👥 '+plan.verwachtePersonen+' '+T('res.verwacht','verwacht')+'</span>'+
        (plan.openAanvragen?'<span>✋ '+plan.openAanvragen+' '+T('res.open','open aanvraag(en)')+'</span>':'')+
        (plan.zonderTafel?'<span>🪑 '+plan.zonderTafel+' '+T('res.zonder','zonder tafel')+'</span>':'')+
      '</div>'+chips+rekBlok+
      (plan.reserveringen.length ? plan.reserveringen.map(r => resRij(r, true)).join('') : '<div class="softline" style="margin-top:0.5rem;">'+T('res.leeg','Nog geen reserveringen voor vandaag.')+'</div>')+
      '</div>'+
      (later.length ? '<div class="card"><div class="tt-h">🗓 '+T('res.later','Komende dagen')+'</div>'+later.map(r => resRij(r, false)).join('')+'</div>' : '');
    // een open rekening afrekenen: RTG Pay (met tap to pay) of contant, tafel weer vrij
    wrap.querySelectorAll('[data-tafelrek]').forEach(el => {
      const rekenAf = async (extra) => {
        try {
          const body = Object.assign({ room: el.dataset.tafelrek }, extra);
          if (body.method === 'rtgpay'){
            body.payCode = await vraagPayCode(); if (!body.payCode) return;
            body.idem = 'trek' + Date.now();
          }
          const d = await API.call('/supplier/pos/checkout', body);
          let boodschap = T('res.rekklaar','Rekening afgerekend:')+' '+el.dataset.tafelrek+', '+eur(d.sale.total)+' ('+methodLabel(d.sale.method)+')';
          if (d.gesplitst) boodschap += ' · '+T('res.gesplitst','gesplitst met')+' '+d.gesplitst.vrienden+' ('+eur(d.gesplitst.perPersoon/100)+' p.p.)';
          if (d.splitsFout) boodschap += ' · '+d.splitsFout;
          toast(boodschap);
          await refresh(); renderReserveringen();
        } catch(e){ toast(e.message); }
      };
      el.querySelectorAll('.js-rekpay').forEach(b => b.addEventListener('click', () => rekenAf({ method: b.dataset.method })));
      // splitsen: een gast betaalt het geheel met RTG Pay, de tafelgenoten
      // krijgen meteen een Klompje voor hun deel, uit naam van de betaler
      const sp = el.querySelector('.js-reksplit'); if (sp) sp.addEventListener('click', () => {
        const namen = window.prompt(T('res.splitswie','Codenamen van de tafelgenoten (met komma); de betaler tikt zo zijn code:'));
        if (!namen) return;
        rekenAf({ method: 'rtgpay', splitsMet: namen.split(',').map(x => x.trim()).filter(Boolean) });
      });
    });
    wrap.querySelectorAll('.js-walkin').forEach(b => b.addEventListener('click', async () => {
      const p = window.prompt(T('res.walkinp','Walk-in aan '+b.dataset.tafel+': met hoeveel personen?'), '2');
      if (!p) return;
      try { await API.call('/supplier/walkin', { tafel: b.dataset.tafel, personen: Number(p) }); toast('🪑 '+T('res.walkintoast','Walk-in geplaatst.')); renderReserveringen(); }
      catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-res]').forEach(el => {
      const doe = async (pad, body, boodschap) => {
        try { await API.call(pad, body); if (boodschap) toast(boodschap); await refresh(); }
        catch(e){ toast(e.message); }
      };
      const id = el.dataset.res;
      const ok = el.querySelector('.js-resok'); if (ok) ok.addEventListener('click', () => doe('/supplier/reservering/beslis', { id, action:'bevestig' }, '🪑 '+T('res.oktoast','Reservering bevestigd; de gast hoort het meteen.')));
      const nee = el.querySelector('.js-resnee'); if (nee) nee.addEventListener('click', () => doe('/supplier/reservering/beslis', { id, action:'weiger' }, T('res.neetoast','Reservering geweigerd.')));
      const tf = el.querySelector('.js-restafel'); if (tf) tf.addEventListener('click', () => {
        const namen = plan.tafels.map(t => t.name);
        const keuze = window.prompt(T('res.tafelp','Welke tafel?')+' ('+namen.join(', ')+')');
        if (keuze) doe('/supplier/reservering/tafel', { id, tafel: keuze.trim() }, '🪑 '+T('res.tafeltoast','Tafel toegewezen; de gast krijgt bericht.'));
      });
      const er = el.querySelector('.js-reser'); if (er) er.addEventListener('click', () => doe('/supplier/reservering/komst', { id, actie:'aangekomen' }, T('res.ertoast','Welkom; de tafel staat op bezet.')));
      const no = el.querySelector('.js-resno'); if (no) no.addEventListener('click', () => doe('/supplier/reservering/komst', { id, actie:'no-show' }, T('res.noshowtoast','Gemeld als no-show; de tafel is weer vrij.')));
      const weg = el.querySelector('.js-resweg'); if (weg) weg.addEventListener('click', () => doe('/supplier/reservering/komst', { id, actie:'vertrokken' }, T('res.wegtoast','Afgerond; de tafel is weer vrij.')));
    });
  }
  async function setStatus(ref, status){
    try { await API.call('/supplier/order/status', {ref, status}); toast(T('sup.status','Status:')+' '+tStatus(status)); await refresh(); }
    catch(e){ toast(e.message); }
  }
  async function refund(ref){
    try { const d = await API.call('/supplier/refund', {ref}); toast(T('sup.refundedtoast','Terugbetaald:')+' '+eur(d.order.total)); await refresh(); }
    catch(e){ toast(e.message); }
  }

  // ---- rides (taxi/jet) ----
  const NEXT_RIDE = { 'aangevraagd':'geaccepteerd', 'geaccepteerd':'onderweg', 'onderweg':'aangekomen', 'aangekomen':'aan-boord', 'aan-boord':'afgerond',
                      'rijdt':'afgerond', 'gearriveerd':null };
  const RIDE_NEXT_LABEL = { 'geaccepteerd':'sup.ride.accept', 'onderweg':'sup.ride.go', 'aangekomen':'sup.ride.atpickup', 'aan-boord':'sup.ride.driving', 'afgerond':'sup.ride.done' };
  const RIDE_NEXT_NL = { 'geaccepteerd':'Accepteer de rit', 'onderweg':'Ik rijd naar de gast', 'aangekomen':'Ik sta voor', 'aan-boord':'Gast aan boord', 'afgerond':'Rit afronden' };
  const RIT_KLAAR = st => st === 'gearriveerd' || st === 'afgerond' || st === 'geweigerd';
  function ridePill(st){ return st==='aangevraagd'?'nieuw':RIT_KLAAR(st)?'klaar':'bereiding'; }
  function ritRegel(r){
    return (r.passengers?'👤 '+r.passengers+' ':'')+(r.luggage?'🧳 '+r.luggage+' ':'')+(r.km?'· '+r.km+' km ':'')+(r.quote?'· <b style="color:var(--gold);">'+eur(r.quote)+'</b>':'');
  }
  function renderRides(){
    const list = (state.rides || []).filter(r => !RIT_KLAAR(r.status));
    $('#rideList').innerHTML = list.length ? list.map(r => {
      const nxt = NEXT_RIDE[r.status];
      const eta = (r.status === 'aangevraagd' || r.status === 'onderweg')
        ? (r.pickupEtaMin != null ? '<div class="enroute">🚗 '+T('sup.pickupeta','Gast op ~')+r.pickupEtaMin+' '+T('sup.min','min')+' '+T('sup.rijden','rijden')+'.</div>' : '')
        : (r.status === 'rijdt' && r.dropEtaMin != null ? '<div class="enroute">🏁 '+T('sup.dropeta','Aankomst bestemming over ~')+r.dropEtaMin+' '+T('sup.min','min')+'.</div>' : '');
      return '<div class="order" data-rref="'+r.ref+'">'+
        '<div class="top"><div><div class="who">'+T('sup.guest','Gast')+' <span class="cn">'+r.customerCodename+'</span></div>'+
          '<div class="ref">'+(r.from||'')+' → '+(r.to||T('sup.opendest','open bestemming'))+' · '+timeAgo(r.at)+'</div></div>'+
          '<span class="pill '+ridePill(r.status)+'">'+tStatus(r.status)+'</span></div>'+
        '<div class="ref" style="margin-top:0.25rem;">'+ritRegel(r)+
          (r.driver?' · 🚘 '+r.driver.name+(r.vehicle?' ('+r.vehicle.name+')':''):' · <span style="color:var(--amber,#B8860B);">'+T('sup.ride.nodriver','nog geen chauffeur')+'</span>')+'</div>'+
        (r.note?'<div class="ref">📝 '+r.note+'</div>':'')+
        (r.zorg?'<div class="allergy">⚠ '+T('sup.zorgp','Zorgprofiel gast:')+' '+esc(zorgTekst(r.zorg))+'</div>':'')+
        eta +
        '<div class="acts">'+
          (nxt?'<button class="obtn primary js-rnext">'+T(RIDE_NEXT_LABEL[nxt], RIDE_NEXT_NL[nxt])+'</button>':'')+
          (r.status==='aangevraagd'?'<button class="obtn warn js-rreject">'+T('sup.reject','Weiger')+'</button>':'')+
        '</div>'+
      '</div>';
    }).join('') : '<div class="empty">'+T('sup.norides','Geen ritaanvragen. RTG-gasten die een rit boeken, verschijnen hier met bestemming en live locatie.')+'</div>';
    document.querySelectorAll('[data-rref]').forEach(el => {
      const ref = el.dataset.rref;
      const r = (state.rides||[]).find(x=>x.ref===ref);
      const nb = el.querySelector('.js-rnext'); if (nb) nb.addEventListener('click', ()=>setRideStatus(ref, NEXT_RIDE[r.status]));
      const rj = el.querySelector('.js-rreject'); if (rj) rj.addEventListener('click', ()=>setRideStatus(ref,'geweigerd'));
    });
  }
  async function setRideStatus(ref, status){
    try { await API.call('/supplier/ride/status', {ref, status}); toast(T('sup.status','Status:')+' '+tStatus(status)); await refresh(); }
    catch(e){ toast(e.message); }
  }

  // ---- menu: bekijken voor iedereen, bewerken voor managers/chefs ----
  function renderMenu(){
    const el = $('#menuList'); if (!el) return;
    const m = state.menu || [];
    const canEdit = actor().manager;
    const cats = [...new Set(m.map(x=>x.cat))];
    let html = m.length ? cats.map(c =>
      '<div class="menu-cat">'+c+'</div>' + m.filter(x=>x.cat===c).map(x =>
        '<div class="mitem"><div class="r1"><span class="nm">'+x.name+'</span><span class="row-mid-gap">'+
        (canEdit?'<button class="mn-station" data-mst="'+x.id+'">'+(x.station==='bar'?'\uD83C\uDF78 bar':'\uD83D\uDD25 '+T('menu.keuken','keuken'))+'</button>':'<span class="soft-xs">'+(x.station==='bar'?'\uD83C\uDF78':'\uD83D\uDD25')+'</span>')+
        '<span class="pr">'+eur(x.price)+'</span>'+
        (canEdit?'<button class="rr-del" data-mdel="'+x.id+'">✕</button>':'')+'</span></div>'+
        (x.desc?'<div class="ds">'+x.desc+'</div>':'')+
        (x.allergens&&x.allergens.length?'<div class="alg">'+x.allergens.map(a=>'<span>'+tAlg(a)+'</span>').join('')+'</div>':'')+
        '</div>'
      ).join('')
    ).join('') : '<div class="empty">'+T('sup.nomenu','Nog geen menukaart. Voeg gerechten toe zodat gasten vooraf kunnen bestellen.')+'</div>';
    if (canEdit){
      html += '<div class="card" style="margin-top:1.2rem;"><div class="tt-h">'+T('menu.add','Gerecht toevoegen')+'</div>'+
        '<div class="field"><label>'+T('menu.name','Naam')+'</label><input id="mnName" placeholder="'+T('menu.nameph','Bijv. gegrilde octopus')+'"></div>'+
        '<div class="row-gap"><div class="field" style="flex:2;"><label>'+T('menu.cat','Categorie')+'</label><input id="mnCat" placeholder="'+T('menu.catph','Bijv. Voorgerechten')+'"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('menu.price','Prijs (€)')+'</label><input id="mnPrice" type="number" inputmode="decimal" placeholder="45"></div></div>'+
        '<div class="field"><label>'+T('menu.desc','Omschrijving')+'</label><input id="mnDesc" placeholder="'+T('menu.descph','Kort en smakelijk')+'"></div>'+
        '<div class="field"><label>'+T('menu.alg','Allergenen (komma\'s)')+'</label><input id="mnAlg" placeholder="vis, soja"></div>'+
        '<div class="field"><label>'+T('menu.station','Werkplek')+'</label><select id="mnStation" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.8rem 1rem;font-size:0.9rem;color:var(--txt);outline:none;">'+
        '<option value="keuken"'+((S&&(S.type==='bar'||S.type==='club'))?'':' selected')+'>\uD83D\uDD25 '+T('menu.keuken','Keuken')+'</option>'+
        '<option value="bar"'+((S&&(S.type==='bar'||S.type==='club'))?' selected':'')+'>\uD83C\uDF78 Bar</option></select></div>'+
        '<button class="bigbtn" id="mnAdd">'+T('menu.addbtn','Zet op de kaart')+'</button></div>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-mdel]').forEach(b => b.addEventListener('click', async () => {
      const menu = (state.menu||[]).filter(x => x.id !== b.dataset.mdel);
      try { await API.call('/supplier/menu', { menu }); toast(T('menu.removed','Van de kaart gehaald.')); await refresh(); openTab('menu'); } catch(e){ toast(e.message); }
    }));
    // gerecht wisselen van werkplek: keuken <-> bar (bepaalt op welk scherm het ticket komt)
    el.querySelectorAll('[data-mst]').forEach(b => b.addEventListener('click', async () => {
      const menu = (state.menu||[]).map(x => x.id === b.dataset.mst ? { ...x, station: x.station === 'bar' ? 'keuken' : 'bar' } : x);
      try { await API.call('/supplier/menu', { menu }); toast(T('menu.stmoved','Verplaatst naar de andere werkplek.')); await refresh(); openTab('menu'); } catch(e){ toast(e.message); }
    }));
    const add = $('#mnAdd'); if (add) add.addEventListener('click', async () => {
      const name = $('#mnName').value.trim(), price = Number($('#mnPrice').value);
      if (!name || !(price>0)){ toast(T('menu.fill','Vul een naam en prijs in.')); return; }
      const item = { id: 'm'+Date.now().toString(36), cat: $('#mnCat').value.trim()||T('menu.other','Overig'), name, desc: $('#mnDesc').value.trim(), price, allergens: $('#mnAlg').value.split(',').map(a=>a.trim().toLowerCase()).filter(Boolean), station: $('#mnStation') ? $('#mnStation').value : 'keuken' };
      try { await API.call('/supplier/menu', { menu: [...(state.menu||[]), item] }); toast(T('menu.added','Staat op de kaart, gasten zien het direct.')); await refresh(); openTab('menu'); } catch(e){ toast(e.message); }
    });
  }

  // ---- dynamische prijs ----
  function renderPrice(){
    const h = state.prices || [];
    $('#prHistory').innerHTML = '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);margin-bottom:0.3rem;">'+T('sup.pricehist','Eerder doorgegeven')+'</div>' +
      (h.length ? h.slice(0,8).map(p=>'<div class="price-row"><span class="s">'+p.service+'<br><span style="font-size:0.66rem;color:var(--soft);">'+timeAgo(p.at)+'</span></span><span class="p">'+eur(p.price)+'</span></div>').join('') : '<div class="softline">'+T('sup.noprices','Nog geen prijzen doorgegeven.')+'</div>');
  }
  $('#prSend').addEventListener('click', async () => {
    const service = $('#prService').value.trim();
    const price = Number($('#prPrice').value);
    if (!service || !(price>0)){ toast(T('sup.fillprice','Vul een dienst en prijs in.')); return; }
    try { await API.call('/supplier/price', {service, price}); toast(T('sup.pricesent','Prijs verstuurd naar RTG.')); $('#prService').value=''; $('#prPrice').value=''; await refresh(); openTab('price'); }
    catch(e){ toast(e.message); }
  });

  // ---- locatie ----
  function renderLocation(){
    const loc = S.loc || {};
    $('#locWrap').innerHTML =
      '<div class="loc-card"><div class="loc-map"><div class="pin"></div><div class="lbl">'+(loc.label||T('sup.locunknown','Locatie onbekend'))+'</div></div>'+
      '<div class="loc-info">'+T('sup.locinfo','Uw locatie is zichtbaar voor RTG-gasten met een actieve rit of bestelling bij u. Gasten delen hun locatie terug wanneer zij onderweg zijn.')+'</div></div>'+
      '<button class="bigbtn" id="locShare">'+T('sup.sharelive','Deel mijn live locatie')+'</button>';
    $('#locShare').addEventListener('click', shareLocation);
  }
  function shareLocation(){
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(async pos => {
        try { await API.call('/supplier/location', { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Live positie' }); toast(T('sup.locshared','Live locatie gedeeld met gasten.')); await refresh(); }
        catch(e){ toast(e.message); }
      }, () => demoShare(), { timeout: 4000 });
    } else demoShare();
  }
  async function demoShare(){
    try { await API.call('/supplier/location', { lat: S.loc.lat, lng: S.loc.lng, label: S.loc.label }); toast(T('sup.locshareddemo','Locatie gedeeld (demo-positie).')); }
    catch(e){ toast(e.message); }
  }

  // ---- kassa, per sector ----
  let bon = {};        // horeca: menu-id -> aantal
  function bonTotal(){ return (state.menu||[]).reduce((s,m)=>s+m.price*(bon[m.id]||0),0); }
  function methodLabel(m){ return m==='rtgpay'?'RTG Pay':m==='pin'?T('pos.pin','PIN'):m==='contant'?T('pos.cash','Contant'):m==='rtg'?T('pos.rtg','RTG-code'):m==='kamer'?T('pos.room','Op de kamer'):m==='tafel'?T('pos.table','Op de tafel'):m==='app'?T('pos.app','In de app'):m; }
  /* RTG Pay aan de kassa: tap to pay als het kan (de gast houdt zijn toestel
     hiertegen), met altijd de uitweg om de code te typen; werkt de NFC-chip
     niet of tikt er niemand, dan komt het typvenster vanzelf. */
  async function vraagPayCode(){
    if (window.TapPay && TapPay.kan()){
      const tap = window.confirm(T('pos.tapkeuze','Tap to pay: de gast tikt zijn toestel hiertegen. Liever de code typen (bijv. als NFC niet werkt)? Kies dan Annuleren.'));
      if (tap){
        toast('📳 '+T('pos.tap','Tap to pay: laat de gast het toestel hiertegen houden...'));
        const code = await TapPay.lees(12000);
        if (code){ toast('📳 '+T('pos.tapok','Code ontvangen via tap to pay.')); return code; }
        toast(T('pos.tapmis','Geen tik ontvangen; typ de code van de gast.'));
      }
    }
    const c = window.prompt(T('pos.paycode','Betaalcode van de gast (uit de app):'));
    return c ? c.trim().toUpperCase() : null;
  }

  function renderKassa(){
    const el = $('#kassaWrap'); if (!el) return;
    const type = S.type;
    let html = '';
    if (type==='restaurant'||type==='bar'||type==='club') html = kassaHoreca();
    else if (type==='hotel'||type==='apartment') html = kassaHotel();
    else html = kassaVervoer();
    html += kassaDay();
    html += '<div id="zWrap"></div><div id="shiftWrap"></div>';
    el.innerHTML = html;
    bindKassa(type);
    laadZ();
    laadShift();
  }

  /* De shift-samenvatting: het avondbriefing-moment. Gasten, no-shows en
     walk-ins, de toppers van de dag, de derving en wie er op de kassa stond. */
  async function laadShift(){
    const el = $('#shiftWrap'); if (!el) return;
    let r; try { r = await API.call('/supplier/shift', {}); } catch(e){ return; }
    const heeftGasten = r.gasten.reserveringen || r.gasten.walkIns || r.gasten.noShows;
    if (!r.bonnen && !heeftGasten) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="card"><div class="tt-h">🌙 '+T('shift.h','Shift-samenvatting')+'</div>'+
      (heeftGasten?'<div class="pos-chips" style="margin-top:0.4rem;">'+
        '<span>👥 '+r.gasten.personen+' '+T('shift.gasten','gasten aan tafel')+'</span>'+
        '<span>🪑 '+r.gasten.reserveringen+' '+T('shift.res','reservering(en)')+'</span>'+
        (r.gasten.walkIns?'<span>🚶 '+r.gasten.walkIns+' walk-in(s)</span>':'')+
        (r.gasten.noShows?'<span style="color:var(--burgundy);">✗ '+r.gasten.noShows+' no-show(s)</span>':'')+
      '</div>':'')+
      (r.verblijf?'<div class="pos-chips" style="margin-top:0.4rem;">'+
        '<span>🛏 '+r.verblijf.bezet+' / '+r.verblijf.totaal+' '+T('rc.bezet','bezet')+'</span>'+
        (r.verblijf.aankomsten?'<span>🗝️ '+r.verblijf.aankomsten+' '+T('shift.aank','check-in(s)')+'</span>':'')+
        (r.verblijf.vertrekken?'<span>👋 '+r.verblijf.vertrekken+' '+T('shift.vertr','check-out(s)')+'</span>':'')+
        (r.verblijf.noShows?'<span style="color:var(--burgundy);">✗ '+r.verblijf.noShows+' no-show(s)</span>':'')+
        (r.verblijf.adr?'<span>ADR '+eur(r.verblijf.adr)+'</span>':'')+
      '</div>':'')+
      ((r.toppers||[]).length?'<div class="st-row" style="margin-top:0.4rem;"><span>'+T('shift.toppers','Toppers')+'</span><span class="sub">'+r.toppers.map(t=>t.aantal+'× '+esc(t.naam)).join(' · ')+'</span></div>':'')+
      (r.derving?'<div class="st-row"><span>'+T('shift.derving','Derving (kostprijs)')+'</span><b style="color:var(--burgundy);">'+eur(r.derving)+'</b></div>':'')+
      ((r.team||[]).length?'<div class="st-row"><span>'+T('shift.team','Op de kassa')+'</span><span class="sub">'+r.team.map(t=>esc(t.naam)+' '+eur(t.omzet)).join(' · ')+'</span></div>':'')+
      '<div class="softline" style="margin-top:0.3rem;">'+T('shift.s','Samen met het Z-rapport hierboven is dit de briefing voor morgen.')+'</div></div>';
  }

  /* De dagafsluiting (Z-rapport): omzet, bonnen, fooien en de btw-splitsing
     van vandaag, met de boekhoudexport (journaalregels als CSV) eronder. */
  async function laadZ(){
    const el = $('#zWrap'); if (!el) return;
    let r; try { r = await API.call('/supplier/dagrapport', {}); } catch(e){ return; }
    el.innerHTML = '<div class="card"><div class="tt-h">🧾 '+T('pos.z','Dagafsluiting (Z-rapport)')+'</div>'+
      '<div class="st-row"><span>'+T('pos.z.omzet','Omzet vandaag')+'</span><b>'+eur(r.omzet)+'</b></div>'+
      '<div class="st-row"><span>'+T('pos.z.bonnen','Bonnen')+'</span><b>'+r.bonnen+'</b></div>'+
      (r.fooien?'<div class="st-row"><span>'+T('pos.fooien','Fooien')+'</span><b>'+eur(r.fooien)+'</b></div>':'')+
      (r.btw||[]).map(b => '<div class="st-row"><span>'+esc(b.label)+' · '+b.tarief+'% btw</span><b>'+eur(b.omzet)+' <span class="sub">'+T('pos.z.waarvanbtw','waarvan btw')+' '+eur(b.btw)+'</span></b></div>').join('')+
      Object.entries(r.betaalwijzen||{}).map(([w, b2]) => '<div class="st-row"><span class="sub">'+T('pos.z.ontv','Ontvangsten')+' '+esc(methodLabel(w))+'</span><span class="sub">'+eur(b2)+'</span></div>').join('')+
      '<button class="bigbtn" id="zCsv" style="margin-top:0.5rem;">⬇ '+T('pos.z.csv','Boekhoudexport (CSV)')+'</button>'+
      '<div class="softline" style="margin-top:0.3rem;">'+T('pos.z.s','Journaalregels per btw-categorie en betaalwijze; in te lezen in Exact, Twinfield of Excel.')+'</div></div>';
    const k = el.querySelector('#zCsv');
    if (k) k.addEventListener('click', () => { window.open('/api/supplier/dagrapport.csv?token='+encodeURIComponent(API.token)+'&datum='+r.datum, '_blank'); });
  }

  // horeca: tik gerechten aan, bon loopt op, afrekenen met PIN of contant
  function kassaHoreca(){
    const m = state.menu || [];
    if (!m.length) return '<div class="card"><div style="font-size:0.84rem;color:var(--muted);">'+T('pos.nomenu','Zet eerst gerechten op de menukaart; die worden hier uw kassaknoppen.')+'</div></div>';
    const total = bonTotal();
    const lines = m.filter(x=>bon[x.id]).map(x=>'<div class="pos-line"><span>'+bon[x.id]+'× '+x.name+'</span><span>'+eur(x.price*bon[x.id])+'</span></div>').join('');
    return '<div class="card"><div class="tt-h">'+T('pos.newbon','Nieuwe bon')+'</div>'+
      '<div class="pos-grid">'+m.map(x=>'<button class="pos-key" data-pos="'+x.id+'"><b>'+x.name+'</b><span>'+eur(x.price)+(bon[x.id]?' · '+bon[x.id]+'×':'')+'</span></button>').join('')+'</div>'+
      (lines?'<div class="pos-bon">'+lines+'<div class="pos-line total"><span>'+T('pos.total','Totaal')+'</span><span>'+eur(total)+'</span></div></div>':'')+
      '<div class="pos-pay">'+
        '<button class="obtn" id="posClear"'+(total?'':' disabled')+'>'+T('pos.clear','Leegmaken')+'</button>'+
        '<button class="obtn primary js-pay" data-method="rtgpay"'+(total?'':' disabled')+'>'+T('pos.payrtg','Afrekenen, RTG Pay')+'</button>'+
        '<button class="obtn js-pay" data-method="contant"'+(total?'':' disabled')+'>'+T('pos.cash','Contant')+'</button>'+
      '</div>'+
      ((state.tables||[]).length ? '<div class="pos-pay" style="margin-top:0.4rem;">'+
        '<select id="posTafel" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;">'+
          '<option value="">'+T('pos.tafelkies','Tafel...')+'</option>'+
          (state.tables||[]).map(t=>'<option value="'+t.name.replace(/"/g,'&quot;')+'">'+t.name+'</option>').join('')+'</select>'+
        '<button class="obtn js-pay" data-method="tafel"'+(total?'':' disabled')+'>'+T('pos.optafel','Op de tafel')+'</button>'+
      '</div>' : '')+
      '</div>'+
      // gast toont het oplichtende scherm; sla de code aan om de bestelling uit te geven
      '<div class="card"><div class="tt-h">'+T('pos.redeemh','RTG-ophaalcode innen')+'</div>'+
      '<div style="margin-top:0.4rem;font-size:0.78rem;color:var(--muted);">'+T('pos.redeemsub','De gast laat het oplichtende scherm zien. Sla de code aan; de bestelling wordt gekoppeld, zo nodig afgerekend en uitgegeven.')+'</div>'+
      '<div class="tt-add"><input id="posCode" placeholder="'+T('pos.codeph','Bijv. TBS9')+'" maxlength="4" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:0.2em;font-weight:700;"><button id="posRedeem">'+T('pos.redeem','Innen')+'</button></div>'+
      '<div id="posRedeemResult"></div></div>';
  }

  // hotel: bedrag op de kamer zetten of direct afrekenen
  function kassaHotel(){
    const rooms = state.rooms || [];
    return '<div class="card"><div class="tt-h">'+T('pos.charge','Afrekening of kamerlast')+'</div>'+
      '<div class="field"><label>'+T('pos.roomlbl','Kamer (optioneel)')+'</label><select id="posRoom" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:0.8rem 1rem;font-size:0.9rem;color:var(--txt);outline:none;">'+
        '<option value="">'+T('pos.noroom','Geen kamer, losse verkoop')+'</option>'+
        rooms.map(r=>'<option value="'+r.name.replace(/"/g,'&quot;')+'">'+r.name+'</option>').join('')+'</select></div>'+
      '<div class="field"><label>'+T('pos.desc','Omschrijving')+'</label><input id="posDesc" placeholder="'+T('pos.deschotel','Bijv. minibar, spa, roomservice')+'"></div>'+
      '<div class="field"><label>'+T('pos.amount','Bedrag (€)')+'</label><input id="posAmt" type="number" inputmode="decimal" placeholder="45"></div>'+
      '<div class="pos-pay">'+
        '<button class="obtn primary js-pay" data-method="kamer">'+T('pos.toroom','Op de kamer')+'</button>'+
        '<button class="obtn js-pay" data-method="rtgpay">RTG Pay</button>'+
        '<button class="obtn js-pay" data-method="contant">'+T('pos.cash','Contant')+'</button>'+
      '</div></div>' + kassaOpenRooms();
  }

  // open kamerrekeningen: alles wat op de kamer staat, in één keer uitchecken
  function kassaOpenRooms(){
    const open = (state.pos && state.pos.openRooms) || {};
    const rooms = Object.keys(open);
    if (!rooms.length) return '';
    return '<div class="card"><div class="tt-h">'+T('pos.openrooms','Open kamerrekeningen')+'</div>'+
      rooms.map(r =>
        '<div class="pos-sale"><div><b>'+r+'</b><span>'+open[r].count+' '+T('pos.posts','post(en)')+'</span></div>'+
        '<div class="row-mid-gap"><span class="amt" style="font-family:\'Bodoni Moda\',serif;">'+eur(open[r].total)+'</span>'+
        '<button class="obtn primary js-checkout" data-room="'+r.replace(/"/g,'&quot;')+'" data-method="rtgpay">'+T('pos.checkoutrtg','Check-out, RTG Pay')+'</button>'+
        '<button class="obtn js-checkout" data-room="'+r.replace(/"/g,'&quot;')+'" data-method="contant">'+T('pos.cash','Contant')+'</button></div></div>'
      ).join('')+'</div>';
  }

  // vervoer: rit afrekenen
  function kassaVervoer(){
    return '<div class="card"><div class="tt-h">'+T('pos.ridebill','Rit afrekenen')+'</div>'+
      '<div class="field"><label>'+T('pos.ride','Rit')+'</label><input id="posDesc" placeholder="'+T('pos.descride','Bijv. luchthaven naar Cala Jondal')+'"></div>'+
      '<div class="field"><label>'+T('pos.amount','Bedrag (€)')+'</label><input id="posAmt" type="number" inputmode="decimal" placeholder="28"></div>'+
      '<div class="pos-pay">'+
        '<button class="obtn primary js-pay" data-method="rtgpay">'+T('pos.payrtg','Afrekenen, RTG Pay')+'</button>'+
        '<button class="obtn js-pay" data-method="contant">'+T('pos.cash','Contant')+'</button>'+
      '</div></div>';
  }

  // dagoverzicht: totaal, per betaalmethode, per medewerker, laatste bonnen
  function kassaDay(){
    const p = state.pos || { total:0, count:0, byMethod:{}, byActor:{}, sales:[] };
    let html = '<div class="card"><div class="tt-h">'+T('pos.today','Vandaag')+'</div>'+
      '<div class="pos-day"><b>'+eur(p.total)+'</b><span>'+p.count+' '+T('pos.bons','bon(nen)')+'</span></div>';
    const methods = Object.keys(p.byMethod);
    if (methods.length) html += '<div class="pos-chips">'+methods.map(m=>'<span>'+methodLabel(m)+' '+eur(p.byMethod[m])+'</span>').join('')+(p.fooien?'<span>💛 '+T('pos.fooien','Fooien')+' '+eur(p.fooien)+'</span>':'')+'</div>';
    else if (p.fooien) html += '<div class="pos-chips"><span>💛 '+T('pos.fooien','Fooien')+' '+eur(p.fooien)+'</span></div>';
    const actors = Object.keys(p.byActor);
    if (actors.length>1 || (actors.length===1 && actors[0]!==actor().name))
      html += '<div class="pos-chips actors">'+actors.map(a=>'<span>'+a+' '+eur(p.byActor[a])+'</span>').join('')+'</div>';
    html += p.sales.length
      ? p.sales.map(s=>'<div class="pos-sale"><div><b>'+(s.desc||((s.items||[]).map(i=>i.qty+'× '+i.name).join(', '))||T('pos.sale','Verkoop'))+'</b>'+
          '<span>'+s.bon+' · '+s.actor+(s.room?' · '+s.room:'')+' · '+timeAgo(s.at)+'</span></div>'+
          '<div class="amt">'+eur(s.total)+'<span class="m">'+methodLabel(s.method)+'</span></div></div>').join('')
      : '<div class="softline">'+T('pos.nosales','Nog geen verkopen vandaag.')+'</div>';
    return html + '</div>';
  }

  function bindKassa(type){
    document.querySelectorAll('[data-pos]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.pos; bon[id] = (bon[id]||0)+1; renderKassa(); openTab('kassa');
    }));
    const clear = $('#posClear'); if (clear) clear.addEventListener('click', () => { bon = {}; renderKassa(); openTab('kassa'); });
    document.querySelectorAll('.js-pay').forEach(b => b.addEventListener('click', () => paySale(type, b.dataset.method)));
    const redeem = $('#posRedeem'); if (redeem) redeem.addEventListener('click', redeemCode);
    const codeInp = $('#posCode'); if (codeInp) codeInp.addEventListener('keydown', e => { if (e.key==='Enter') redeemCode(); });
    document.querySelectorAll('.js-checkout').forEach(b => b.addEventListener('click', async () => {
      try {
        const body = { room: b.dataset.room, method: b.dataset.method };
        if (body.method === 'rtgpay'){
          body.payCode = await vraagPayCode(); if (!body.payCode) return;
          body.idem = 'co' + Date.now();
        }
        const d = await API.call('/supplier/pos/checkout', body);
        toast(T('pos.checkedout','Uitgecheckt:')+' '+b.dataset.room+', '+eur(d.sale.total)+' ('+methodLabel(d.sale.method)+')');
        await refresh(); openTab('kassa');
      } catch(e){ toast(e.message); }
    }));
  }

  async function redeemCode(){
    const inp = $('#posCode');
    const code = (inp.value||'').trim().toUpperCase();
    if (!code){ toast(T('pos.entercode','Voer een ophaalcode in.')); return; }
    const box = $('#posRedeemResult');
    try {
      const d = await API.call('/supplier/pos/redeem', { code });
      const o = d.order;
      box.innerHTML = '<div class="enroute here" style="margin-top:0.8rem;">✓ '+code+' · '+T('sup.guest','Gast')+' <b>'+o.codename+'</b> · '+
        o.items.map(i=>i.qty+'× '+i.name).join(', ')+' · '+eur(o.total)+
        (o.wasPaid ? ' · '+T('pos.waspaid','al betaald in de app') : ' · '+T('pos.chargedrtg','afgerekend via RTG'))+'</div>';
      inp.value = '';
      toast(T('pos.redeemed','Uitgegeven aan')+' '+o.codename+'.');
      await refresh(); openTab('kassa');
      $('#posRedeemResult').innerHTML = box.innerHTML;
    } catch(e){
      box.innerHTML = '<div class="enroute" style="margin-top:0.8rem;border-color:rgba(194,58,94,0.4);color:var(--burgundy);">'+e.message+'</div>';
      toast(e.message);
    }
  }

  async function paySale(type, method){
    let body = { method };
    if (type==='restaurant'||type==='bar'||type==='club'){
      const items = (state.menu||[]).filter(m=>bon[m.id]).map(m=>({ name:m.name, qty:bon[m.id], price:m.price }));
      if (!items.length){ toast(T('pos.empty','Tik eerst gerechten aan.')); return; }
      body.items = items; body.total = bonTotal();
      if (method === 'tafel'){
        body.room = (($('#posTafel')||{}).value||'');
        if (!body.room){ toast(T('pos.kiestafel','Kies eerst een tafel.')); return; }
      }
    } else {
      body.total = Number(($('#posAmt')||{}).value);
      body.desc = (($('#posDesc')||{}).value||'').trim();
      const room = ($('#posRoom')||{}).value;
      if (room) body.room = room;
      if (!(body.total>0)){ toast(T('pos.fillamount','Vul een bedrag in.')); return; }
    }
    if (method === 'rtgpay'){
      body.payCode = await vraagPayCode(); if (!body.payCode) return;
      body.idem = 'pos' + Date.now();
    }
    try {
      const d = await API.call('/supplier/pos/sale', body);
      bon = {};
      toast(T('pos.done','Afgerekend:')+' '+eur(d.sale.total)+' ('+methodLabel(d.sale.method)+'), '+T('pos.bonnr','bon')+' '+d.sale.bon);
      await refresh(); openTab('kassa');
    } catch(e){ toast(e.message); }
  }

  // ---- kamers (hotel/appartement): beschikbaarheid + housekeeping ----
  const HK_LABEL = { schoon:'Schoon', vuil:'Vuil', bezig:'Bezig', bezet:'Bezet', defect:'Defect' };
  const HK_LABEL_EN = { schoon:'Clean', vuil:'Dirty', bezig:'In progress', bezet:'Occupied', defect:'Out of order' };
  const tHk = s => (lang() === 'en' ? (HK_LABEL_EN[s] || s) : (HK_LABEL[s] || s));
  let hkDefectFor = null; // kamer-id waarvoor de defect-notitie openstaat
  // ---- tickets: dagprogramma, entree-check en aanbodbeheer ----
  let programma = null;
  async function laadProgramma(){
    if (!has('tickets') || !API.live) return;
    try { programma = await API.call('/supplier/programma', {}); } catch(e){ programma = { datum: '', slots: [] }; } // nooit null laten: dat zou opnieuw laden blijven aanroepen
    renderTickets();
  }
  function renderTickets(){
    const el = $('#ticketsWrap'); if (!el) return;
    if (!has('tickets')){ el.innerHTML = ''; return; }
    if (!programma){ el.innerHTML = '<div class="empty">'+T('tk2.laden','Programma laden\u2026')+'</div>'; laadProgramma(); return; }
    const canEdit = actor().manager;
    let html = '';
    // entree-check: code afvinken op eigen naam
    html += '<div class="card"><div class="tt-h">'+T('tk2.deur','Entree-check')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;">'+
      '<input id="tkCode" placeholder="'+T('tk2.codeph','Entreecode, bijv. K7M2PX')+'" style="flex:1;background:var(--card2,var(--card));border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;font-size:1rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--txt);outline:none;">'+
      '<button class="obtn primary" id="tkCheck">'+T('tk2.binnen','Binnen')+'</button></div>'+
      '<div id="tkUit" style="margin-top:0.5rem;font-size:0.82rem;color:var(--muted);"></div></div>';
    // dagprogramma
    const slots = programma.slots || [];
    html += '<div class="card"><div class="tt-h">'+T('tk2.prog','Programma vandaag')+' \u00B7 '+programma.datum+'</div>'+
      (slots.length ? slots.map((sl, i) =>
        '<div class="mitem"><div class="r1"><span class="nm">'+sl.tijd+' \u00B7 '+esc(sl.naam)+'</span>'+
        '<span class="pr">'+sl.binnen+'/'+sl.verkocht+' '+T('tk2.binnenkort','binnen')+' \u00B7 '+sl.verkocht+'/'+sl.capaciteit+'</span></div>'+
        (sl.gasten.length ? '<div class="ds"><button class="obtn" data-tkg="'+i+'" style="padding:0.2rem 0.8rem;font-size:0.7rem;">'+T('tk2.gasten','Gastenlijst')+' ('+sl.gasten.length+')</button>'+
          '<span id="tkGast-'+i+'" style="display:none;">'+sl.gasten.map(g => '<br>'+(g.binnen?'\u2705':'\u25CB')+' '+esc(g.codename)+' \u00B7 '+g.personen+'p \u00B7 '+g.code).join('')+'</span></div>' : '')+
        '</div>').join('')
      : '<div class="empty">'+T('tk2.leeg','Nog geen tijdsloten. '+(canEdit?'Voeg hieronder een activiteit toe.':''))+'</div>')+'</div>';
    // de eigen transferdienst (chauffeurs van de zaak rijden; ritten in de Ritten-tab)
    const tr = state.transfer;
    if (tr){
      html += '<div class="card"><div class="tt-h">'+T('tk2.transfer','Eigen transferdienst')+'</div>'+
        '<div style="margin-top:0.5rem;font-size:0.85rem;color:'+(tr.aan?'var(--green)':'var(--soft)')+';">'+
        (tr.aan ? '\u25CF '+T('tk2.tr.aan','Aan: gasten met een ticket vragen de transfer aan; uw chauffeurs zien de ritten in de Ritten-tab en op de PDA.')
                : '\u25CB '+T('tk2.tr.uit','Uit.'))+'</div>'+
        '<div style="margin-top:0.4rem;font-size:0.8rem;color:var(--muted);">'+T('tk2.tr.prijs','Prijs per rit:')+' <b style="color:var(--gold);">'+(tr.prijs ? eur(tr.prijs) : T('tk2.tr.incl','inclusief bij het ticket (\u20AC 0)'))+'</b></div>'+
        (canEdit ? '<div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.8rem;flex-wrap:wrap;">'+
          '<button class="obtn'+(tr.aan?'':' primary')+'" data-traan="'+(tr.aan?'0':'1')+'">'+(tr.aan?T('tk2.tr.zetuit','Zet uit'):T('tk2.tr.zetaan','Zet aan'))+'</button>'+
          '<input id="trPrijs" type="number" inputmode="decimal" value="'+(tr.prijs||0)+'" style="width:6rem;background:var(--card2,var(--card));border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.7rem;color:var(--txt);outline:none;">'+
          '<button class="obtn" id="trPrijsZet">'+T('tk2.tr.prijszet','Prijs opslaan')+'</button>'+
          '<span style="font-size:0.68rem;color:var(--soft);">'+T('tk2.tr.nul','0 = inclusief')+'</span></div>' : '')+'</div>';
    }
    // aanbodbeheer (manager)
    const acts = state.activiteiten || [];
    html += '<div class="card"><div class="tt-h">'+T('tk2.aanbod','Aanbod')+' ('+acts.length+')</div>'+
      acts.map(a => '<div class="mitem"><div class="r1"><span class="nm">'+esc(a.name)+'</span><span class="row-mid-gap"><span class="pr">'+eur(a.prijs)+'</span>'+
        (canEdit?'<button class="rr-del" data-tkdel="'+a.id+'">\u2715</button>':'')+'</span></div>'+
        '<div class="ds">'+(a.desc?esc(a.desc)+' \u00B7 ':'')+T('tk2.cap','cap.')+' '+a.capaciteit+' \u00B7 '+(a.tijden||[]).join(', ')+(a.duur?' \u00B7 '+esc(a.duur):'')+'</div></div>').join('')+
      (canEdit ? '<div style="margin-top:1rem;">'+
        '<div class="field"><label>'+T('tk2.f.naam','Activiteit')+'</label><input id="tkName" placeholder="'+T('tk2.f.naamph','Bijv. sunset cruise')+'"></div>'+
        '<div class="field"><label>'+T('tk2.f.desc','Omschrijving')+'</label><input id="tkDesc"></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('tk2.f.prijs','Prijs p.p. (\u20AC)')+'</label><input id="tkPrijs" type="number" inputmode="decimal"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('tk2.f.cap','Capaciteit')+'</label><input id="tkCap" type="number" inputmode="numeric"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('tk2.f.duur','Duur')+'</label><input id="tkDuur" placeholder="2 uur"></div></div>'+
        '<div class="field"><label>'+T('tk2.f.tijden','Tijdsloten (komma\'s)')+'</label><input id="tkTijden" placeholder="10:00, 14:00, 17:30"></div>'+
        '<button class="obtn primary" id="tkAdd">'+T('tk2.f.voeg','Toevoegen')+'</button></div>' : '')+'</div>';
    el.innerHTML = html;
    const check = document.getElementById('tkCheck');
    if (check) check.addEventListener('click', async () => {
      const uit = document.getElementById('tkUit');
      try {
        const r = await API.call('/supplier/ticket/checkin', { code: $('#tkCode').value });
        uit.innerHTML = '<span style="color:var(--green);">\u2705 '+esc(r.ticket.codename)+' \u00B7 '+esc(r.ticket.naam)+' \u00B7 '+r.ticket.personen+'p \u00B7 '+T('tk2.welkom','welkom!')+'</span>';
        $('#tkCode').value = '';
        laadProgramma();
      } catch(e){ uit.innerHTML = '<span style="color:var(--burgundy);">\u26D4 '+esc(e.message)+'</span>'; }
    });
    document.querySelectorAll('[data-traan]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/transfer', { aan: k.dataset.traan === '1' }); await refresh(); openTab('tickets'); } catch(e){ toast(e.message); }
    }));
    const trZet = document.getElementById('trPrijsZet');
    if (trZet) trZet.addEventListener('click', async () => {
      try { await API.call('/supplier/transfer', { prijs: Number($('#trPrijs').value) }); toast(T('tk2.tr.ok','De transferprijs staat vast.')); await refresh(); openTab('tickets'); } catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-tkg]').forEach(k => k.addEventListener('click', () => {
      const g = document.getElementById('tkGast-' + k.dataset.tkg);
      if (g) g.style.display = g.style.display === 'none' ? '' : 'none';
    }));
    document.querySelectorAll('[data-tkdel]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/activiteit', { id: k.dataset.tkdel, weg: true }); await refresh(); await laadProgramma(); openTab('tickets'); } catch(e){ toast(e.message); }
    }));
    const voeg = document.getElementById('tkAdd');
    if (voeg) voeg.addEventListener('click', async () => {
      try {
        await API.call('/supplier/activiteit', { name: $('#tkName').value, desc: $('#tkDesc').value, prijs: Number($('#tkPrijs').value),
          capaciteit: Number($('#tkCap').value), duur: $('#tkDuur').value, tijden: $('#tkTijden').value });
        toast(T('tk2.f.ok','De activiteit staat in het aanbod.'));
        await refresh(); await laadProgramma(); openTab('tickets');
      } catch(e){ toast(e.message); }
    });
  }

  // ---- autoverhuur: vloot, huren, foto's, SOS ----
  let huren = null;
  function fotoKlein(file, cb){
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => {
      const c = document.createElement('canvas'); const sc = Math.min(1, 900 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.7));
    }; img.src = r.result; };
    r.readAsDataURL(file);
  }
  async function laadHuren(){
    if (!has('huur') || !API.live) return;
    try { huren = (await API.call('/supplier/huur/overzicht')).huren; } catch(e){ huren = []; }
    renderVerhuur();
  }
  const HUUR_ST = { 'aangevraagd': 'geboekt, klaar voor uitgifte', 'lopend': 'onderweg met de gast', 'afgerond': 'afgerond' };
  function renderVerhuur(){
    const el = $('#huurWrap'); if (!el) return;
    if (!has('huur')){ el.innerHTML = ''; return; }
    if (huren === null){ el.innerHTML = '<div class="empty">\u2026</div>'; laadHuren(); return; }
    const canEdit = actor().manager;
    let html = '';
    // lopende en geboekte huren
    html += '<div class="card"><div class="tt-h">'+T('vh.huren','Huren')+' ('+huren.length+')</div>'+
      (huren.length ? huren.map(h => {
        let knop = '';
        if (h.status === 'aangevraagd') knop =
          '<button class="obtn" data-vhfoto="'+h.ref+'" data-fase="voor">\uD83D\uDCF7 '+T('vh.fotovoor','Voor-foto')+' ('+h.fotosVoor+')</button> '+
          '<button class="obtn primary" data-vhst="'+h.ref+'" data-st="lopend">'+T('vh.uitgeven','Uitgeven')+'</button>';
        else if (h.status === 'lopend') knop =
          '<button class="obtn" data-vhfoto="'+h.ref+'" data-fase="na">\uD83D\uDCF7 '+T('vh.fotona','Na-foto')+' ('+h.fotosNa+')</button> '+
          '<button class="obtn primary" data-vhst="'+h.ref+'" data-st="afgerond">'+T('vh.innemen','Innemen en afronden')+'</button>';
        return '<div class="mitem">'+
          (h.sos && h.sos.length ? '<div style="background:rgba(194,58,94,0.16);border:1px solid var(--burgundy);border-radius:10px;padding:0.5rem 0.7rem;margin-bottom:0.5rem;font-size:0.8rem;">\uD83D\uDEA8 <b>SOS:</b> '+esc(h.sos[0].bericht)+
            (Number.isFinite(h.sos[0].lat) ? ' \u00B7 <a style="color:var(--gold);" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='+h.sos[0].lat+','+h.sos[0].lng+'">'+T('vh.kaart','kaart')+'</a>' : '')+
            ' <button class="obtn" data-vhsosok="'+h.ref+'" style="padding:0.15rem 0.7rem;font-size:0.7rem;">'+T('vh.sosok','Afgehandeld')+'</button></div>' : '')+
          '<div class="r1"><span class="nm">'+esc(h.codename)+' \u00B7 '+esc(h.auto)+(h.kenteken?' ('+esc(h.kenteken)+')':'')+'</span><span class="pr">'+eur(h.prijs)+'</span></div>'+
          '<div class="ds">'+h.van+' \u2192 '+h.tot+' \u00B7 '+T('vh.st.'+h.status, HUUR_ST[h.status]||h.status)+
          ' \u00B7 \uD83D\uDCF7 '+h.fotosVoor+'/'+h.fotosNa+(h.borg?' \u00B7 '+T('vh.borg','borg')+' '+eur(h.borg):'')+
          (h.uitgifte ? ' \u00B7 '+h.uitgifte.kmStart+' km' : '')+
          (h.locatie ? ' \u00B7 <a style="color:var(--gold);" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='+h.locatie.lat+','+h.locatie.lng+'">\uD83D\uDCCD '+T('vh.live','live locatie')+'</a>' : '')+'</div>'+
          (h.inname ? '<div class="ds" style="color:'+(h.inname.meerkosten>0?'var(--gold)':'var(--green)')+';">'+
            (h.inname.meerkosten>0 ? T('vh.meer','Meerkosten')+': '+eur(h.inname.meerkosten)+' ('+h.inname.gereden+' km, '+h.inname.extraKm+' extra'+(h.inname.tankKosten>0?', tank '+eur(h.inname.tankKosten):'')+')'
              : '\u2713 '+h.inname.gereden+' km, '+T('vh.geenmeer','geen meerkosten \u2013 borg vrij'))+'</div>' : '')+
          (knop ? '<div style="margin-top:0.5rem;">'+knop+'</div>' : '')+'</div>';
      }).join('') : '<div class="empty">'+T('vh.geen','Nog geen huren. Betaalde boekingen verschijnen hier live.')+'</div>')+'</div>';
    // de vloot
    const autos = state.autos || [];
    html += '<div class="card"><div class="tt-h">'+T('vh.vloot','Vloot')+' ('+autos.filter(a=>a.actief!==false).length+')</div>'+
      autos.filter(a => a.actief !== false).map(a =>
        '<div class="mitem"><div class="r1"><span class="nm">'+(a.icoon||'\uD83D\uDE97')+' '+esc(a.name)+(a.plate?' \u00B7 '+esc(a.plate):'')+'</span><span class="row-mid-gap"><span class="pr">'+eur(a.dagprijs)+'/'+T('vh.dag','dag')+'</span>'+
        (canEdit?'<button class="rr-del" data-vhdel="'+a.id+'">\u2715</button>':'')+'</span></div>'+
        '<div class="ds">'+esc(a.categorie||'')+' \u00B7 '+(a.transmissie==='automaat'?T('vh.aut','automaat'):T('vh.hand','handgeschakeld'))+' \u00B7 '+esc(a.brandstof||'')+' \u00B7 \uD83D\uDC65 '+(a.stoelen||'-')+' \u00B7 \uD83E\uDDF3 '+(a.bagage||0)+(a.airco?' \u00B7 \u2744\uFE0F':'')+
        ' \u00B7 '+(a.kmPerDag?a.kmPerDag+' km/'+T('vh.dag','dag')+' (+'+eur(a.meerKm||0)+'/km)':T('vh.onbeperkt','onbeperkt km'))+' \u00B7 '+T('vh.borg','borg')+' '+eur(a.borg||0)+' \u00B7 '+T('vh.vanaf','vanaf')+' '+(a.minLeeftijd||21)+' jr</div></div>').join('')+
      (canEdit ? '<details style="margin-top:1rem;"><summary style="cursor:pointer;font-size:0.82rem;color:var(--gold);">'+T('vh.f.nieuw','Auto toevoegen')+'</summary><div style="margin-top:0.8rem;">'+
        '<div class="row-gap"><div class="field" style="flex:2;"><label>'+T('vh.f.auto','Auto')+'</label><input id="vhName" placeholder="Fiat 500 Cabrio"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.kenteken','Kenteken')+'</label><input id="vhPlate"></div></div>'+
        '<div class="field"><label>'+T('vh.f.cat','Categorie')+'</label><input id="vhCat" placeholder="Compact cabrio"></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.trans','Schakeling')+'</label><select id="vhTrans" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"><option value="handgeschakeld">'+T('vh.hand','handgeschakeld')+'</option><option value="automaat">'+T('vh.aut','automaat')+'</option></select></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.brand','Brandstof')+'</label><select id="vhBrand" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"><option value="benzine">benzine</option><option value="diesel">diesel</option><option value="elektrisch">elektrisch</option><option value="hybride">hybride</option></select></div></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.stoelen','Stoelen')+'</label><input id="vhStoelen" type="number" inputmode="numeric" value="5"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.deuren','Deuren')+'</label><input id="vhDeuren" type="number" inputmode="numeric" value="4"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.bagage','Koffers')+'</label><input id="vhBagage" type="number" inputmode="numeric" value="2"></div></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.prijs','\u20AC/dag')+'</label><input id="vhPrijs" type="number" inputmode="numeric"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.borg','Borg \u20AC')+'</label><input id="vhBorg" type="number" inputmode="numeric" value="300"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.leeftijd','Min. lft')+'</label><input id="vhLft" type="number" inputmode="numeric" value="21"></div></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.km','Km/dag (0=onbep.)')+'</label><input id="vhKm" type="number" inputmode="numeric" value="200"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.meerkm','\u20AC per extra km')+'</label><input id="vhMeerkm" type="number" inputmode="decimal" value="0.25"></div>'+
        '<label class="field" style="flex:1;display:flex;align-items:center;gap:0.4rem;"><input type="checkbox" id="vhAirco" checked style="accent-color:var(--gold);"> '+T('vh.f.airco','Airco')+'</label></div>'+
        '<button class="obtn primary" id="vhAdd">'+T('vh.f.voeg','Toevoegen')+'</button></div></details>' : '')+'</div>'+
      '<input type="file" id="vhFile" accept="image/*" capture="environment" style="display:none;">';
    el.innerHTML = html;
    document.querySelectorAll('[data-vhst]').forEach(k => k.addEventListener('click', async () => {
      const body = { ref: k.dataset.vhst, status: k.dataset.st };
      if (k.dataset.st === 'lopend'){
        const km = prompt(T('vh.q.kmstart','Km-stand bij uitgifte?')); if (km == null) return;
        body.kmStart = Number(km);
        const tank = prompt(T('vh.q.tankstart','Tankniveau bij uitgifte in achtsten (8 = vol)?'), '8'); body.tankStart = Number(tank);
      } else if (k.dataset.st === 'afgerond'){
        const km = prompt(T('vh.q.kmeind','Km-stand bij inname?')); if (km == null) return;
        body.kmEind = Number(km);
        const tank = prompt(T('vh.q.tankeind','Tankniveau bij inname in achtsten (8 = vol)?'), '8'); body.tankEind = Number(tank);
      }
      try { await API.call('/supplier/huur/status', body); await laadHuren(); openTab('huur'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vhsosok]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/huur/sos-ok', { ref: k.dataset.vhsosok }); await laadHuren(); openTab('huur'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vhfoto]').forEach(k => k.addEventListener('click', () => {
      const file = document.getElementById('vhFile');
      file.onchange = () => {
        if (!file.files[0]) return;
        fotoKlein(file.files[0], async (dataUrl) => {
          try { await API.call('/supplier/huur/foto', { ref: k.dataset.vhfoto, fase: k.dataset.fase, foto: dataUrl });
            toast(T('vh.foto.ok','De staat is vastgelegd.')); await laadHuren(); openTab('huur'); }
          catch(e){ toast(e.message); }
        });
        file.value = '';
      };
      file.click();
    }));
    document.querySelectorAll('[data-vhdel]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/auto', { id: k.dataset.vhdel, weg: true }); await refresh(); openTab('huur'); } catch(e){ toast(e.message); }
    }));
    const voeg = document.getElementById('vhAdd');
    if (voeg) voeg.addEventListener('click', async () => {
      const g = id => $(id) ? $(id).value : undefined;
      try { await API.call('/supplier/auto', { name: g('#vhName'), plate: g('#vhPlate'), dagprijs: Number(g('#vhPrijs')),
        categorie: g('#vhCat'), transmissie: g('#vhTrans'), brandstof: g('#vhBrand'),
        stoelen: Number(g('#vhStoelen')), deuren: Number(g('#vhDeuren')), bagage: Number(g('#vhBagage')),
        borg: Number(g('#vhBorg')), minLeeftijd: Number(g('#vhLft')), kmPerDag: Number(g('#vhKm')),
        meerKm: Number(g('#vhMeerkm')), airco: $('#vhAirco') ? $('#vhAirco').checked : true });
        toast(T('vh.f.ok','De auto staat in de vloot.')); await refresh(); openTab('huur'); } catch(e){ toast(e.message); }
    });
  }

  // ---- charter: boten en jachten ----
  let charters = null;
  async function laadCharters(){
    if (!has('charter') || !API.live) return;
    try { charters = (await API.call('/supplier/charter/overzicht')).charters; } catch(e){ charters = []; }
    renderCharter();
  }
  const CHARTER_ST = { 'aangevraagd': 'geboekt, klaar om uit te varen', 'lopend': 'onderweg op zee', 'afgerond': 'afgerond' };
  const BOOT_TYPES = ['Motorjacht','Zeiljacht','Catamaran','RIB','Sloep'];
  function renderCharter(){
    const el = $('#charterWrap'); if (!el) return;
    if (!has('charter')){ el.innerHTML = ''; return; }
    if (charters === null){ el.innerHTML = '<div class="empty">…</div>'; laadCharters(); return; }
    const canEdit = actor().manager;
    const selCss = 'style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"';
    let html = '';
    // lopende en geboekte charters
    html += '<div class="card"><div class="tt-h">'+T('ch.charters','Charters')+' ('+charters.length+')</div>'+
      (charters.length ? charters.map(c => {
        let knop = '';
        if (c.status === 'aangevraagd') knop =
          '<button class="obtn" data-chfoto="'+c.ref+'" data-fase="voor">📷 '+T('ch.fotovoor','Voor-foto')+' ('+c.fotosVoor+')</button> '+
          '<button class="obtn primary" data-chst="'+c.ref+'" data-st="lopend">'+T('ch.uitvaren','Uitvaren')+'</button>';
        else if (c.status === 'lopend') knop =
          '<button class="obtn" data-chfoto="'+c.ref+'" data-fase="na">📷 '+T('ch.fotona','Na-foto')+' ('+c.fotosNa+')</button> '+
          '<button class="obtn primary" data-chst="'+c.ref+'" data-st="afgerond">'+T('ch.teruggeven','Teruggeven en afronden')+'</button>';
        return '<div class="mitem">'+
          (c.sos && c.sos.length ? '<div style="background:rgba(194,58,94,0.16);border:1px solid var(--burgundy);border-radius:10px;padding:0.5rem 0.7rem;margin-bottom:0.5rem;font-size:0.8rem;">🚨 <b>SOS:</b> '+esc(c.sos[0].bericht)+
            (Number.isFinite(c.sos[0].lat) ? ' · <a style="color:var(--gold);" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='+c.sos[0].lat+','+c.sos[0].lng+'">'+T('ch.kaart','kaart')+'</a>' : '')+
            ' <button class="obtn" data-chsosok="'+c.ref+'" style="padding:0.15rem 0.7rem;font-size:0.7rem;">'+T('ch.sosok','Afgehandeld')+'</button></div>' : '')+
          '<div class="r1"><span class="nm">'+esc(c.codename)+' · '+esc(c.boot)+' ('+esc(c.type)+')</span><span class="pr">'+eur(c.prijs)+'</span></div>'+
          '<div class="ds">'+c.van+' → '+c.tot+' · '+(c.gasten?c.gasten+' '+T('ch.gasten','gasten')+' · ':'')+(c.metSkipper?'⚓ '+T('ch.metskipper','met schipper')+(c.skipperNaam?' ('+esc(c.skipperNaam)+')':''):T('ch.bareboat','bareboat'))+' · '+T('ch.st.'+c.status, CHARTER_ST[c.status]||c.status)+
          ' · 📷 '+c.fotosVoor+'/'+c.fotosNa+(c.borg?' · '+T('ch.borg','borg')+' '+eur(c.borg):'')+
          (c.uitvaart ? ' · '+c.uitvaart.urenStart+' '+T('ch.uur','mu') : '')+
          (c.locatie ? ' · <a style="color:var(--gold);" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='+c.locatie.lat+','+c.locatie.lng+'">📍 '+T('ch.live','live positie')+'</a>' : '')+'</div>'+
          (c.teruggave ? '<div class="ds" style="color:'+(c.teruggave.meerkosten>0?'var(--gold)':'var(--green)')+';">'+
            (c.teruggave.meerkosten>0 ? T('ch.meer','Meerkosten')+': '+eur(c.teruggave.meerkosten)+' ('+c.teruggave.gevaren+' '+T('ch.uur','mu')+(c.teruggave.brandstofKosten>0?', '+T('ch.brandstof','brandstof')+' '+eur(c.teruggave.brandstofKosten):'')+')'
              : '✓ '+c.teruggave.gevaren+' '+T('ch.uur','mu')+', '+T('ch.geenmeer','geen meerkosten, borg vrij'))+'</div>' : '')+
          (knop ? '<div style="margin-top:0.5rem;">'+knop+'</div>' : '')+'</div>';
      }).join('') : '<div class="empty">'+T('ch.geen','Nog geen charters. Betaalde boekingen verschijnen hier live.')+'</div>')+'</div>';
    // de vloot
    const boten = state.boten || [];
    html += '<div class="card"><div class="tt-h">'+T('ch.vloot','Vloot')+' ('+boten.filter(b=>b.actief!==false).length+')</div>'+
      boten.filter(b => b.actief !== false).map(b =>
        '<div class="mitem"><div class="r1"><span class="nm">'+(b.icoon||'🛥️')+' '+esc(b.naam)+'</span><span class="row-mid-gap"><span class="pr">'+eur(b.dagprijs)+'/'+T('ch.dag','dag')+'</span>'+
        (canEdit?'<button class="rr-del" data-chdel="'+b.id+'">✕</button>':'')+'</span></div>'+
        '<div class="ds">'+esc(b.type||'')+' · '+(b.lengte||0)+'m · 👥 '+(b.gasten||0)+(b.hutten?' · 🛏️ '+b.hutten+' '+T('ch.hutten','hutten'):'')+' · '+esc(b.brandstof||'')+' · '+(b.snelheidKn||0)+' kn · '+esc(b.ligplaats||'')+
        ' · '+T('ch.borg','borg')+' '+eur(b.borg||0)+' · '+(b.skipperVerplicht?'⚓ '+T('ch.skipperv','schipper verplicht'):(b.vaarbewijsVereist?T('ch.vaarbewijs','vaarbewijs vereist'):T('ch.vrij','vrij te huren')))+
        (b.skipperPrijsPerDag?' (+'+eur(b.skipperPrijsPerDag)+'/'+T('ch.dag','dag')+')':'')+'</div></div>').join('')+
      (canEdit ? '<details style="margin-top:1rem;"><summary style="cursor:pointer;font-size:0.82rem;color:var(--gold);">'+T('ch.f.nieuw','Vaartuig toevoegen')+'</summary><div style="margin-top:0.8rem;">'+
        '<div class="row-gap"><div class="field" style="flex:2;"><label>'+T('ch.f.naam','Naam')+'</label><input id="chNaam" placeholder="Serenidad"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.type','Type')+'</label><select id="chType" '+selCss+'>'+BOOT_TYPES.map(t=>'<option>'+t+'</option>').join('')+'</select></div></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.lengte','Lengte (m)')+'</label><input id="chLengte" type="number" inputmode="decimal" value="14"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.gasten','Gasten')+'</label><input id="chGasten" type="number" inputmode="numeric" value="10"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.hutten','Hutten')+'</label><input id="chHutten" type="number" inputmode="numeric" value="2"></div></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.brand','Brandstof')+'</label><select id="chBrand" '+selCss+'><option value="diesel">diesel</option><option value="benzine">benzine</option><option value="elektrisch">elektrisch</option><option value="geen">geen</option></select></div>'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.snelheid','Snelheid (kn)')+'</label><input id="chSnelheid" type="number" inputmode="numeric" value="24"></div></div>'+
        '<div class="field"><label>'+T('ch.f.ligplaats','Ligplaats')+'</label><input id="chLig" placeholder="Marina Botafoch"></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.prijs','€/dag')+'</label><input id="chPrijs" type="number" inputmode="numeric"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.borg','Borg €')+'</label><input id="chBorg" type="number" inputmode="numeric" value="2000"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.skipperprijs','Schipper €/dag')+'</label><input id="chSkPrijs" type="number" inputmode="numeric" value="300"></div></div>'+
        '<label class="field" style="display:flex;align-items:center;gap:0.4rem;"><input type="checkbox" id="chSkV" style="accent-color:var(--gold);"> '+T('ch.f.skipperv','Schipper verplicht')+'</label>'+
        '<label class="field" style="display:flex;align-items:center;gap:0.4rem;"><input type="checkbox" id="chVb" checked style="accent-color:var(--gold);"> '+T('ch.f.vaarbewijs','Vaarbewijs vereist bij bareboat')+'</label>'+
        '<button class="obtn primary" id="chAdd">'+T('ch.f.voeg','Toevoegen')+'</button></div></details>' : '')+'</div>'+
      '<input type="file" id="chFile" accept="image/*" capture="environment" style="display:none;">';
    el.innerHTML = html;
    document.querySelectorAll('[data-chst]').forEach(k => k.addEventListener('click', async () => {
      const body = { ref: k.dataset.chst, status: k.dataset.st };
      if (k.dataset.st === 'lopend'){
        const uren = prompt(T('ch.q.urenstart','Motorurenstand bij uitvaren?')); if (uren == null) return;
        body.urenStart = Number(uren);
        body.brandstofStart = Number(prompt(T('ch.q.brandstart','Brandstofniveau bij uitvaren in achtsten (8 = vol)?'), '8'));
      } else if (k.dataset.st === 'afgerond'){
        const uren = prompt(T('ch.q.ureneind','Motorurenstand bij teruggave?')); if (uren == null) return;
        body.urenEind = Number(uren);
        body.brandstofEind = Number(prompt(T('ch.q.brandeind','Brandstofniveau bij teruggave in achtsten (8 = vol)?'), '8'));
      }
      try { await API.call('/supplier/charter/status', body); await laadCharters(); openTab('charter'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-chsosok]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/charter/sos-ok', { ref: k.dataset.chsosok }); await laadCharters(); openTab('charter'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-chfoto]').forEach(k => k.addEventListener('click', () => {
      const file = document.getElementById('chFile');
      file.onchange = () => {
        if (!file.files[0]) return;
        fotoKlein(file.files[0], async (dataUrl) => {
          try { await API.call('/supplier/charter/foto', { ref: k.dataset.chfoto, fase: k.dataset.fase, foto: dataUrl });
            toast(T('ch.foto.ok','De staat is vastgelegd.')); await laadCharters(); openTab('charter'); }
          catch(e){ toast(e.message); }
        });
        file.value = '';
      };
      file.click();
    }));
    document.querySelectorAll('[data-chdel]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/boot', { id: k.dataset.chdel, weg: true }); await refresh(); openTab('charter'); } catch(e){ toast(e.message); }
    }));
    const voeg = document.getElementById('chAdd');
    if (voeg) voeg.addEventListener('click', async () => {
      const g = id => $(id) ? $(id).value : undefined;
      try { await API.call('/supplier/boot', { naam: g('#chNaam'), type: g('#chType'), lengte: Number(g('#chLengte')),
        gasten: Number(g('#chGasten')), hutten: Number(g('#chHutten')), brandstof: g('#chBrand'), snelheidKn: Number(g('#chSnelheid')),
        ligplaats: g('#chLig'), dagprijs: Number(g('#chPrijs')), borg: Number(g('#chBorg')), skipperPrijsPerDag: Number(g('#chSkPrijs')),
        skipperVerplicht: $('#chSkV') ? $('#chSkV').checked : false, vaarbewijsVereist: $('#chVb') ? $('#chVb').checked : true });
        toast(T('ch.f.ok','Het vaartuig staat in de vloot.')); await refresh(); openTab('charter'); } catch(e){ toast(e.message); }
    });
  }

  // ---- de ophaal/bezorgdienst van de zaak ----
  const BZ_ST = { 'nieuw':'nieuw', 'in bereiding':'in bereiding', 'klaar':'klaar', 'onderweg':'onderweg' };
  function renderBezorg(){
    const el = $('#bezorgWrap'); if (!el) return;
    const b = state && state.bezorg;
    if (!b){ el.innerHTML = ''; return; }
    const canEdit = actor().manager;
    let html = '';
    // dienststatus + schakelaars
    html += '<div class="card"><div class="tt-h">'+T('bz.dienst','De dienst')+'</div>'+
      '<div style="margin-top:0.5rem;font-size:0.85rem;color:'+(b.aan?'var(--green)':'var(--soft)')+';">'+
      (b.aan ? '\u25CF ' + T('bz.open','Open: leden kunnen bestellen.') : '\u25CB ' + T('bz.dicht','Gesloten: leden zien u niet in de bestellijst.'))+'</div>'+
      (canEdit ? '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.8rem;">'+
        '<button class="obtn'+(b.aan?'':' primary')+'" data-bzaan="'+(b.aan?'0':'1')+'">'+(b.aan?T('bz.zetdicht','Dienst sluiten'):T('bz.zetopen','Dienst openen'))+'</button>'+
        '<button class="obtn" data-bzk="ophalen" data-bzv="'+(b.ophalen?'0':'1')+'">'+(b.ophalen?'\u2713 ':'')+T('bz.ophalen','Ophalen')+'</button>'+
        '<button class="obtn" data-bzk="bezorgen" data-bzv="'+(b.bezorgen?'0':'1')+'">'+(b.bezorgen?'\u2713 ':'')+T('bz.bezorgen','Bezorgen')+'</button>'+
      '</div>' : '')+
      '<div style="margin-top:0.6rem;font-size:0.78rem;color:var(--soft);">'+T('bz.vandaag','Vandaag afgerond:')+' <b>'+(b.vandaagKlaar||0)+'</b></div></div>';
    // lopende leveringen met statusknoppen
    const lopend = b.lopend || [];
    html += '<div class="card"><div class="tt-h">'+T('bz.lopend','Lopende leveringen')+' ('+lopend.length+')</div>'+
      (lopend.length ? lopend.map(o => {
        const wie = o.bezorger ? ' \u00B7 \uD83D\uDEF5 ' + esc(o.bezorger.name) : '';
        const eta = o.etaMin ? ' \u00B7 ' + o.etaMin + ' min' : '';
        let knop = '';
        if (o.status === 'nieuw') knop = '<button class="obtn" data-bzord="'+o.ref+'" data-st="in bereiding">'+T('bz.bereiden','In bereiding')+'</button>';
        else if (o.status === 'in bereiding') knop = '<button class="obtn" data-bzord="'+o.ref+'" data-st="klaar">'+T('bz.klaar','Klaar')+'</button>';
        else if (o.status === 'klaar' && o.levering === 'ophalen') knop = '<button class="obtn primary" data-bzlev="'+o.ref+'" data-st="opgehaald">'+T('bz.opgehaald','Opgehaald')+'</button>';
        else if (o.status === 'klaar' && o.levering === 'bezorgen') knop = o.bezorger ? '<button class="obtn primary" data-bzlev="'+o.ref+'" data-st="onderweg">'+T('bz.vertrek','Onderweg')+'</button>' : '<span style="font-size:0.72rem;color:var(--soft);">'+T('bz.wachtbez','wacht op een bezorger (PDA)')+'</span>';
        else if (o.status === 'onderweg') knop = '<button class="obtn primary" data-bzlev="'+o.ref+'" data-st="bezorgd">'+T('bz.bezorgd','Bezorgd')+'</button>';
        return '<div class="mitem"><div class="r1"><span class="nm">'+(o.levering==='bezorgen'?'\uD83D\uDEF5':'\uD83E\uDDFA')+' '+esc(o.customerCodename)+' \u00B7 '+T('bz.st.'+o.status, BZ_ST[o.status]||o.status)+wie+eta+'</span><span class="pr">'+eur(o.total)+'</span></div>'+
          '<div class="ds">'+o.items.map(i=>i.qty+'x '+esc(i.name)).join(', ')+(o.levering==='bezorgen'&&o.adres?' \u00B7 \uD83D\uDCCD '+esc(o.adres):' \u00B7 '+T('bz.code','code')+' <b>'+o.pickup+'</b>')+'</div>'+
          (knop?'<div style="margin-top:0.5rem;">'+knop+'</div>':'')+'</div>';
      }).join('') : '<div class="empty">'+T('bz.geen','Nog geen lopende leveringen. Betaalde bestellingen verschijnen hier live.')+'</div>')+'</div>';
    // assortiment
    const prods = b.producten || [];
    html += '<div class="card"><div class="tt-h">'+T('bz.assort','Assortiment')+' ('+prods.length+')</div>'+
      (prods.length ? prods.map(p =>
        '<div class="mitem"><div class="r1"><span class="nm">'+esc(p.name)+'</span><span class="row-mid-gap"><span class="pr">'+eur(p.price)+'</span>'+
        (canEdit?'<button class="rr-del" data-bzdel="'+p.id+'">\u2715</button>':'')+'</span></div>'+
        (p.desc?'<div class="ds">'+esc(p.desc)+'</div>':'')+'</div>'
      ).join('') : '<div class="empty">'+T('bz.leeg','Nog geen producten. Voeg ze hieronder toe; dan kan de dienst open.')+'</div>')+
      (canEdit ? '<div style="margin-top:1rem;">'+
        '<div class="field"><label>'+T('bz.f.naam','Product')+'</label><input id="bzName" placeholder="'+T('bz.f.naamph','Bijv. paella om mee te nemen')+'"></div>'+
        '<div class="row-gap"><div class="field" style="flex:2;"><label>'+T('bz.f.desc','Omschrijving')+'</label><input id="bzDesc" placeholder="'+T('bz.f.descph','Kort en duidelijk')+'"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('bz.f.prijs','Prijs (\u20AC)')+'</label><input id="bzPrice" type="number" inputmode="decimal" placeholder="24"></div></div>'+
        '<button class="obtn primary" id="bzAdd">'+T('bz.f.voeg','Toevoegen')+'</button></div>' : '')+'</div>';
    el.innerHTML = html;
    // acties
    document.querySelectorAll('[data-bzaan]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/bezorg/instellingen', { aan: k.dataset.bzaan === '1' }); await refresh(); openTab('bezorg'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-bzk]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/bezorg/instellingen', { [k.dataset.bzk]: k.dataset.bzv === '1' }); await refresh(); openTab('bezorg'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-bzord]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/order/status', { ref: k.dataset.bzord, status: k.dataset.st }); await refresh(); openTab('bezorg'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-bzlev]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/bezorg/status', { ref: k.dataset.bzlev, status: k.dataset.st }); await refresh(); openTab('bezorg'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-bzdel]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/bezorg/product', { id: k.dataset.bzdel, weg: true }); await refresh(); openTab('bezorg'); } catch(e){ toast(e.message); }
    }));
    const voeg = document.getElementById('bzAdd');
    if (voeg) voeg.addEventListener('click', async () => {
      try {
        await API.call('/supplier/bezorg/product', { name: $('#bzName').value, desc: $('#bzDesc').value, price: Number($('#bzPrice').value) });
        toast(T('bz.f.ok','Het product staat in het assortiment.'));
        await refresh(); openTab('bezorg');
      } catch(e){ toast(e.message); }
    });
  }

  /* Het receptiebord: vandaag in een oogopslag. Aanvragen bevestigen,
     aankomsten inchecken (de logies gaan meteen als kamerlast op de
     rekening), vertrekken uitchecken; staat er nog iets open, dan wijst
     de check-out naar de kassa. */
  async function laadReceptie(){
    const el = $('#receptieWrap'); if (!el) return;
    let r; try { r = await API.call('/supplier/receptie', {}); } catch(e){ el.innerHTML = ''; return; }
    const leeg = !r.aanvragen.length && !r.aankomsten.length && !r.inHuis.length && !r.komend.length;
    const rij = (v, knoppen, sub) => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;margin-top:0.55rem;font-size:0.82rem;flex-wrap:wrap;" data-vb="'+v.id+'">'+
      '<span><b class="cn">'+esc(v.codenaam)+'</b> · '+esc(v.roomName)+' · '+(sub||v.aankomst+' tot '+v.vertrek+' · '+v.personen+'p · '+eur(v.totaal))+
      (v.notitie?' · 📝 '+esc(v.notitie):'')+
      (v.zorg?'<span style="display:block;color:#E2B93B;">⚠ '+esc(zorgTekst(v.zorg))+'</span>':'')+'</span>'+
      (knoppen?'<span style="display:flex;gap:0.4rem;flex-shrink:0;flex-wrap:wrap;">'+knoppen+'</span>':'')+
    '</div>';
    el.innerHTML = '<div class="card"><div class="tt-h">🛎️ '+T('rc.h','Receptie vandaag')+'</div>'+
      '<div class="pos-chips" style="margin-top:0.4rem;">'+
        '<span>🛏 '+r.bezetting.bezet+' / '+r.bezetting.totaal+' '+T('rc.bezet','bezet')+'</span>'+
        (r.bezetting.vuil?'<span>🧹 '+r.bezetting.vuil+' '+T('rc.vuil','voor housekeeping')+'</span>':'')+
        (r.aanvragen.length?'<span>✋ '+r.aanvragen.length+' '+T('rc.aanvragen','aanvraag(en)')+'</span>':'')+
      '</div>'+
      ((r.hkEerst||[]).length?'<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--burgundy);border:1px solid rgba(194,58,94,0.35);border-radius:10px;padding:0.45rem 0.6rem;">🧹 '+T('rc.hkeerst','Housekeeping eerst:')+' <b>'+r.hkEerst.map(esc).join(', ')+'</b> · '+T('rc.hkeerst2','daar komt vandaag alweer een gast aan.')+'</div>':'')+
      (r.aanvragen.length?'<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('rc.nieuw','Aanvragen')+'</div>'+r.aanvragen.map(v => rij(v,
        '<button class="obtn primary js-vbok">'+T('res.ok','Bevestig')+'</button><button class="obtn warn js-vbnee">'+T('sup.reject','Weiger')+'</button>')).join(''):'')+
      (r.aankomsten.length?'<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('rc.aankomst','Aankomsten')+'</div>'+r.aankomsten.map(v => rij(v,
        '<button class="obtn primary js-vbin">🗝️ '+T('rc.checkin','Check-in')+'</button><button class="obtn warn js-vbnoshow">'+T('res.noshow','No-show')+'</button>')).join(''):'')+
      (r.inHuis.length?'<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('rc.inhuis','In huis')+'</div>'+r.inHuis.map(v => rij(v,
        '<button class="obtn js-vbuit">'+T('rc.checkout','Check-out')+'</button>',
        T('rc.tot','tot')+' '+v.vertrek+(v.vertrek<=r.datum?' · <b style="color:var(--gold);">'+T('rc.vandaagweg','vertrekt vandaag')+'</b>':'')+(v.openLast?' · '+T('rc.open','rekening')+' <b>'+eur(v.openLast)+'</b>':''))).join(''):'')+
      (r.komend.length?'<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('rc.komend','Komende dagen')+'</div>'+r.komend.map(v => rij(v, '')).join(''):'')+
      (leeg?'<div class="softline" style="margin-top:0.5rem;">'+T('rc.leeg','Nog geen verblijven. Zodra een gast boekt, staat het hier.')+'</div>':'')+
      '</div>';
    el.querySelectorAll('[data-vb]').forEach(elv => {
      const id = elv.dataset.vb;
      const doe = async (pad, body, boodschap) => {
        try { await API.call(pad, Object.assign({ id }, body)); if (boodschap) toast(boodschap); await refresh(); laadReceptie(); }
        catch(e){ toast(e.message); }
      };
      const ok = elv.querySelector('.js-vbok'); if (ok) ok.addEventListener('click', () => doe('/supplier/verblijf/beslis', { actie:'bevestig' }, '🛎️ '+T('rc.oktoast','Bevestigd; de gast hoort het meteen.')));
      const nee = elv.querySelector('.js-vbnee'); if (nee) nee.addEventListener('click', () => doe('/supplier/verblijf/beslis', { actie:'weiger' }, T('rc.neetoast','Geweigerd.')));
      const inb = elv.querySelector('.js-vbin'); if (inb) inb.addEventListener('click', () => doe('/supplier/verblijf/checkin', {}, '🗝️ '+T('rc.intoast','Ingecheckt; de logies staan op de kamerrekening.')));
      const uit = elv.querySelector('.js-vbuit'); if (uit) uit.addEventListener('click', () => doe('/supplier/verblijf/checkout', {}, T('rc.uittoast','Uitgecheckt; de kamer staat klaar voor housekeeping.')));
      const ns = elv.querySelector('.js-vbnoshow'); if (ns) ns.addEventListener('click', () => doe('/supplier/verblijf/noshow', {}, T('rc.noshowtoast','Gemeld als no-show; de kamer blijft vrij.')));
    });
  }

  function renderRooms(){
    const el = $('#roomsWrap'); if (!el) return;
    const rooms = state.rooms;
    if (!Array.isArray(rooms)){ el.innerHTML = ''; return; }
    let html = '<div id="receptieWrap"></div><div id="planWrap"></div><div class="card">';
    html += rooms.length ? rooms.map(r => {
      const hk = (r.hk && r.hk.status) || 'schoon';
      return '<div class="room-row'+(r.available?'':' off')+'" style="flex-wrap:wrap;">'+
        '<div class="rr-t"><b>'+r.name+' <span class="hk-pill hk-'+hk+'">'+tHk(hk)+'</span>'+
          (r.vroegVrij ? ' <span class="hk-pill hk-schoon">🛎 '+T('hk.vroegvrij','vroege check-in')+'</span>' : '')+'</b>'+
          '<span>'+(r.desc||'')+' · '+eur(r.price)+' '+T('sup.pernight','p.n.')+
          (r.hk && r.hk.by ? ' · '+r.hk.by+(r.hk.at?', '+timeAgo(r.hk.at):'') : '')+
          (r.vroegVrij ? ' · 🛎 '+T('hk.vroegvrij2','vrijgegeven door housekeeping')+' ('+r.vroegVrij.door+')' : '')+
          (hk==='defect' && r.hk.note ? ' · ⚠ '+r.hk.note : '')+'</span></div>'+
        '<button class="rr-toggle'+(r.available?' on':'')+'" data-rtoggle="'+r.id+'" aria-label="aan/uit"><span></span></button>'+
        '<button class="rr-del" data-rdel="'+r.id+'">✕</button>'+
        '<div class="hk-chips">'+['schoon','vuil','bezig','bezet','defect'].map(s =>
          '<button class="hk-chip hk-'+s+(hk===s?' on':'')+'" data-hk="'+r.id+'" data-hkst="'+s+'">'+tHk(s)+'</button>').join('')+'</div>'+
        (hkDefectFor===r.id ? '<div class="tt-add" style="width:100%;"><input id="hkNote" placeholder="'+T('hk.noteph','Wat is er kapot?')+'"><button id="hkNoteOk">'+T('hk.report','Meld defect')+'</button></div>' : '')+
      '</div>';
    }).join('') : '<div class="softline">'+T('sup.norooms','Nog geen kamers. Voeg uw eerste kamer toe.')+'</div>';
    html += '<div class="tt-add" style="flex-wrap:wrap;">'+
      '<input id="rmName" placeholder="'+T('sup.roomname','Kamernaam')+'" style="flex:2;min-width:120px;">'+
      '<input id="rmPrice" type="number" inputmode="decimal" placeholder="€" style="flex:1;min-width:70px;">'+
      '<button id="rmAdd">'+T('team.add','Toevoegen')+'</button></div>';
    html += '<div class="note-soft">'+T('sup.roomnote','Uit = direct onzichtbaar voor gasten en de backoffice, zonder telefoontjes.')+'</div>';
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-rtoggle]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/toggle', { id: b.dataset.rtoggle }); await refresh(); openTab('rooms'); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-hk]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.hk, st = b.dataset.hkst;
      if (st === 'defect'){ hkDefectFor = id; renderRooms(); openTab('rooms'); const n = $('#hkNote'); if (n) n.focus(); return; }
      hkDefectFor = null;
      try { await API.call('/supplier/room/hk', { id, status: st }); await refresh(); openTab('rooms'); } catch(e){ toast(e.message); }
    }));
    const hkOk = $('#hkNoteOk'); if (hkOk) hkOk.addEventListener('click', async () => {
      const note = ($('#hkNote').value || '').trim();
      const id = hkDefectFor; hkDefectFor = null;
      try { await API.call('/supplier/room/hk', { id, status: 'defect', note }); toast(T('hk.reported','Defect gemeld, klus staat klaar voor onderhoud en de kamer is uit de verkoop.')); await refresh(); openTab('rooms'); }
      catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-rdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/remove', { id: b.dataset.rdel }); toast(T('sup.roomremoved','Kamer verwijderd.')); await refresh(); openTab('rooms'); } catch(e){ toast(e.message); }
    }));
    const add = $('#rmAdd'); if (add) add.addEventListener('click', async () => {
      const name = $('#rmName').value.trim(), price = Number($('#rmPrice').value);
      if (!name || !(price>0)){ toast(T('sup.roomfill','Vul een kamernaam en prijs in.')); return; }
      try { await API.call('/supplier/room/add', { name, price }); toast(T('sup.roomadded','Kamer toegevoegd en direct zichtbaar.')); await refresh(); openTab('rooms'); } catch(e){ toast(e.message); }
    });
    laadReceptie();
    laadPlanning();
  }

  /* De kamerkalender: veertien dagen vooruit, per kamer een rij blokjes.
     Goud = bevestigd, merkrood = ingecheckt; tik-tekst (title) toont wie. */
  async function laadPlanning(){
    const el = $('#planWrap'); if (!el) return;
    let p; try { p = await API.call('/supplier/kamerplanning', {}); } catch(e){ el.innerHTML = ''; return; }
    if (!p.kamers.length){ el.innerHTML = ''; return; }
    const dagLabel = d => d.slice(8, 10);
    el.innerHTML = '<div class="card"><div class="tt-h">🗓 '+T('rc.plan','Kamerkalender')+' <span class="sub">('+p.dagen.length+' '+T('vr.dagen','dagen')+')</span></div>'+
      '<div style="display:flex;gap:2px;margin:0.5rem 0 0.15rem;padding-left:96px;overflow:hidden;">'+p.dagen.map(d => '<span style="width:16px;flex-shrink:0;font-size:0.55rem;color:var(--soft);text-align:center;">'+dagLabel(d)+'</span>').join('')+'</div>'+
      p.kamers.map(k => '<div style="display:flex;align-items:center;gap:0;margin-top:3px;">'+
        '<span style="width:96px;flex-shrink:0;font-size:0.7rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:6px;">'+esc(k.name)+'</span>'+
        '<span style="display:flex;gap:2px;overflow:hidden;">'+k.dagen.map(d =>
          '<span title="'+d.datum+(d.codenaam?', '+esc(d.codenaam):'')+'" style="width:16px;height:16px;flex-shrink:0;border-radius:3px;border:1px solid var(--line);background:'+
          (d.status==='ingecheckt'?'#7F1734':d.status==='bevestigd'?'#A98F1C':'transparent')+';"></span>').join('')+'</span>'+
      '</div>').join('')+
      '<div class="softline" style="margin-top:0.45rem;">'+T('rc.plan.s','Goud is bevestigd, rood slaapt er nu; leeg is vrij om te verkopen.')+'</div></div>';
  }

  /* ---- het hoteldorp: negen afdelingen, een motor ----
     Elke afdeling (front office, guest manager, concierge, parking, security,
     gym, spa, klusjesman, IT) heeft dezelfde lichte lijst: waar + wat + wie,
     met een eigen statusketen. Een tik zet de post een stap verder. */
  let dorpKant = (() => { try { return localStorage.getItem('rtg_dorp_kant') || 'frontoffice'; } catch(e){ return 'frontoffice'; } })();
  async function renderDorp(){
    const el = $('#dorpWrap'); if (!el) return;
    // kamers geven het hoteldorp; nachtzaken, restaurants en beachclubs hun eigen dorp
    if (!Array.isArray(state.rooms) && !['bar', 'club', 'beachclub', 'restaurant'].includes(S && S.type)){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/dorp', {}); } catch(e){ el.innerHTML = ''; return; }
    const afd = d.afdelingen.find(a => a.key === dorpKant) || d.afdelingen[0];
    dorpKant = afd.key;
    const rij = p => {
      const i = afd.keten.indexOf(p.status);
      const volgende = i >= 0 && i < afd.keten.length - 1 ? afd.keten[i + 1] : null;
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;margin-top:0.55rem;font-size:0.82rem;flex-wrap:wrap;" data-dpost="'+p.id+'">'+
        '<span>'+(p.waar?'<b>'+esc(p.waar)+'</b> · ':'')+esc(p.tekst)+' <span class="sub">'+esc(p.door)+' · '+timeAgo(p.updatedAt||p.at)+
          ((p.via||[]).length?' · '+T('dorp.via','via')+' '+p.via.map(esc).join(', '):'')+'</span></span>'+
        (volgende
          ? '<span style="display:flex;gap:0.4rem;align-items:center;flex-shrink:0;"><span class="pill bereiding">'+esc(p.status)+'</span><button class="obtn primary js-dverder">'+esc(volgende)+'</button><button class="obtn js-dstuur" title="'+T('dorp.stuur','Stuur door naar een andere afdeling')+'">↪</button></span>'
          : '<span class="pill klaar" style="flex-shrink:0;">'+esc(p.status)+'</span>')+
      '</div>';
    };
    // het specialistische gereedschap van deze afdeling (dagstaat, wachtrij...)
    let tools = null;
    try { tools = await API.call('/supplier/dorp/tools', { afdeling: dorpKant }); } catch(e){}
    const kop = t => '<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+t+'</div>';
    // de gereedschapskist: generieke widgets (cijfers, lijst, knoppen, actie, meter)
    let toolsBlok = '';
    if (tools && Array.isArray(tools.tools)) toolsBlok = tools.tools.map(w => {
      if (w.type === 'cijfers') return kop(esc(w.titel))+'<div class="pos-chips" style="margin-top:0.35rem;">'+
        w.items.map(i => '<span>'+esc(i.label)+' · <b>'+esc(String(i.waarde))+'</b></span>').join('')+'</div>';
      if (w.type === 'lijst') return kop(esc(w.titel))+((w.rijen||[]).length ? w.rijen.map(r =>
        '<div class="st-row"><span>'+(r.icoon?r.icoon+' ':'')+esc(r.tekst)+(r.sub?'<span class="sub" style="display:block;">'+esc(r.sub)+'</span>':'')+'</span>'+
        (r.rechts?'<b style="color:'+(r.rood?'var(--burgundy)':'var(--gold)')+';white-space:nowrap;">'+esc(r.rechts)+'</b>':'')+'</div>').join('')
        : '<div class="softline" style="margin-top:0.35rem;">'+esc(w.leeg||'')+'</div>');
      if (w.type === 'knoppen') return kop(esc(w.titel))+'<div class="pos-chips" style="margin-top:0.35rem;">'+
        w.knoppen.map(k => '<span><button class="obtn js-dsnel" data-snel="'+esc(k)+'" style="padding:0.15rem 0.55rem;">'+esc(k)+'</button></span>').join('')+'</div>';
      if (w.type === 'actie') return kop(esc(w.titel))+'<button class="obtn primary js-dactie" data-tekst="'+esc(w.tekst)+'" style="margin-top:0.35rem;">'+esc(w.knop)+'</button>';
      if (w.type === 'meter') return kop(esc(w.titel))+'<div class="pos-chips" style="margin-top:0.35rem;">'+
        w.opties.map(o => '<span><button class="obtn'+(w.stand&&w.stand.stand===o?' primary':'')+'" data-meter="'+esc(o)+'" style="padding:0.15rem 0.55rem;">'+esc(o)+'</button></span>').join('')+'</div>'+
        (w.stand?'<div class="softline" style="margin-top:0.25rem;">'+T('gy.nu','Nu')+' '+esc(w.stand.stand)+' · '+esc(w.stand.door)+', '+timeAgo(w.stand.at)+'</div>':'');
      // de leeftijdscheck aan de deur: ja/nee op codenaam, zonder gegevens
      if (w.type === 'leeftijd') return kop(esc(w.titel))+
        '<div class="tt-add" style="margin-top:0.35rem;flex-wrap:wrap;"><input id="dorpLftIn" placeholder="'+T('dorp.lft.ph','Codenaam van de gast')+'" style="flex:2;min-width:140px;">'+
        '<button class="obtn js-dlft" data-min="18">18+?</button><button class="obtn js-dlft" data-min="21">21+?</button></div>'+
        '<div id="dorpLftUit" class="softline" style="margin-top:0.3rem;">'+esc(w.hint||'')+'</div>';
      return '';
    }).join('');
    // de buurt op het conciergescherm: partners om de hoek, op afstand gesorteerd
    let buurtBlok = '';
    if (dorpKant === 'concierge'){
      if (!renderDorp.buurt){
        try { renderDorp.buurt = (await API.call('/supplier/dorp/buurt', {})).buurt || []; } catch(e){ renderDorp.buurt = []; }
      }
      if (renderDorp.buurt.length) buurtBlok = '<div style="margin-top:0.7rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('dorp.buurt','In de buurt')+'</div>'+
        '<div class="pos-chips" style="margin-top:0.35rem;">'+renderDorp.buurt.map(b =>
          '<span><button class="obtn js-dbuurt" data-naam="'+esc(b.naam)+'" data-soort="'+esc(b.soort)+'" data-km="'+b.km+'" style="padding:0.15rem 0.5rem;">'+b.icon+' '+esc(b.naam)+' · '+b.km+' km</button></span>').join('')+'</div>'+
        '<div class="softline" style="margin-top:0.3rem;">'+T('dorp.buurt.s','Een tik zet de naam alvast in de wens.')+'</div>';
    }
    el.innerHTML =
      '<div class="card" style="display:flex;gap:0.4rem;flex-wrap:wrap;">'+d.afdelingen.map(a =>
        '<button class="obtn'+(a.key===dorpKant?' primary':'')+'" data-dkant="'+a.key+'">'+a.icon+' '+esc(a.label)+(a.openAantal?' · '+a.openAantal:'')+'</button>').join('')+'</div>'+
      '<div class="card"><div class="tt-h">'+afd.icon+' '+esc(afd.label)+' <span class="sub">('+afd.keten.join(' · ')+')</span></div>'+
        toolsBlok+
        (afd.open.length ? afd.open.map(rij).join('') : '<div class="softline" style="margin-top:0.5rem;">'+T('dorp.leeg','Niets open bij deze afdeling.')+'</div>')+
        buurtBlok+
        (afd.klaar.length ? '<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('dorp.klaar','Net afgerond')+'</div>'+afd.klaar.map(rij).join('') : '')+
        '<div class="tt-add" style="flex-wrap:wrap;margin-top:0.7rem;">'+
          '<input id="dorpWaar" placeholder="'+esc(afd.waarHint)+'" style="flex:1;min-width:110px;">'+
          '<input id="dorpTekst" placeholder="'+esc(afd.watHint)+'" style="flex:2;min-width:160px;">'+
          '<button id="dorpAdd">'+T('dorp.zet','Zet erbij')+'</button></div>'+
      '</div>';
    el.querySelectorAll('[data-dkant]').forEach(b => b.addEventListener('click', () => {
      dorpKant = b.dataset.dkant;
      try { localStorage.setItem('rtg_dorp_kant', dorpKant); } catch(e){}
      renderDorp();
    }));
    el.querySelectorAll('[data-dpost]').forEach(elp => {
      const knop = elp.querySelector('.js-dverder');
      if (knop) knop.addEventListener('click', async () => {
        try { await API.call('/supplier/dorp/verder', { id: elp.dataset.dpost }); renderDorp(); } catch(e){ toast(e.message); }
      });
      // afdelingen praten met elkaar: de post reist door, met het spoor erbij
      const stuurKnop = elp.querySelector('.js-dstuur');
      if (stuurKnop) stuurKnop.addEventListener('click', async () => {
        const naar = window.prompt(T('dorp.stuurwaar','Naar welke afdeling?')+' ('+d.afdelingen.map(a=>a.key).join(', ')+')');
        if (!naar) return;
        try {
          const r = await API.call('/supplier/dorp/stuurdoor', { id: elp.dataset.dpost, naar: naar.trim().toLowerCase() });
          const doel = d.afdelingen.find(a => a.key === r.post.afdeling);
          toast((doel?doel.icon+' ':'')+T('dorp.gestuurd','Doorgestuurd naar')+' '+(doel?doel.label:r.post.afdeling)+'.');
          renderDorp();
        } catch(e){ toast(e.message); }
      });
    });
    // de buurt: een tik zet de naam alvast in de wens van de concierge
    el.querySelectorAll('.js-dbuurt').forEach(b => b.addEventListener('click', () => {
      const inp = el.querySelector('#dorpTekst');
      if (inp){ inp.value = T('dorp.regelbij','Regel bij')+' '+b.dataset.naam+' ('+b.dataset.soort+', '+b.dataset.km+' km): '; inp.focus(); }
    }));
    // de leeftijdscheck: de paspoort-bevestiging geeft ja/nee, nooit gegevens
    el.querySelectorAll('.js-dlft').forEach(b => b.addEventListener('click', async () => {
      const inp = el.querySelector('#dorpLftIn'), uit = el.querySelector('#dorpLftUit');
      const codenaam = (inp && inp.value || '').trim();
      if (!codenaam){ toast(T('dorp.lft.leeg','Vul de codenaam van de gast in.')); return; }
      const min = Number(b.dataset.min);
      try {
        const r = await API.call('/supplier/paspoort/vraag', { codenaam, niveau: 'bevestiging', minLeeftijd: min });
        const ok = r.bevestiging && r.bevestiging.voldoetLeeftijd === true;
        uit.innerHTML = ok
          ? '<b style="color:var(--green,#7ecb8f);font-size:1rem;">✅ '+esc(codenaam)+' '+T('dorp.lft.ja','is')+' '+min+'+</b>'
          : '<b style="color:var(--burgundy,#C23A5E);font-size:1rem;">⛔ '+esc(codenaam)+' '+T('dorp.lft.nee','is NIET aantoonbaar')+' '+min+'+</b>';
      } catch(e){ uit.innerHTML = '<b style="color:var(--burgundy,#C23A5E);">'+esc(e.message)+'</b>'; }
    }));
    // het logmoment: een tik en het staat geklokt als afgeronde post
    el.querySelectorAll('.js-dactie').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/dorp/post', { afdeling: dorpKant, waar: '', tekst: b.dataset.tekst, directKlaar: true }); toast(afd.icon+' '+T('dorp.geklokt','Geklokt.')); renderDorp(); }
      catch(e){ toast(e.message); }
    }));
    // de meter van de afdeling: drukte, voorraad, seizoen
    el.querySelectorAll('[data-meter]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/dorp/drukte', { afdeling: dorpKant, stand: b.dataset.meter }); renderDorp(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-dsnel').forEach(b => b.addEventListener('click', () => {
      const inp = el.querySelector('#dorpTekst');
      if (inp){ inp.value = b.dataset.snel+' '; inp.focus(); }
    }));
    const add = el.querySelector('#dorpAdd'); if (add) add.addEventListener('click', async () => {
      const waar = el.querySelector('#dorpWaar').value.trim();
      const tekst = el.querySelector('#dorpTekst').value.trim();
      if (!tekst){ toast(T('dorp.vul','Schrijf kort op wat er speelt.')); return; }
      try { await API.call('/supplier/dorp/post', { afdeling: dorpKant, waar, tekst }); toast(afd.icon+' '+T('dorp.gezet','Staat op de lijst van')+' '+afd.label+'.'); renderDorp(); }
      catch(e){ toast(e.message); }
    });
  }

  // ---- minibar-telling per kamer ----
  let mbRoom = null;       // gekozen kamer
  let mbQty = {};          // artikel-id -> gebruikt aantal
  function renderMinibar(){
    const el = $('#minibarWrap'); if (!el) return;
    const mb = state.minibar;
    if (!mb){ el.innerHTML = ''; return; }
    const rooms = (state.rooms || []).map(r => r.name);
    if (mbRoom && !rooms.includes(mbRoom)) mbRoom = null;

    // telling invoeren
    let html = '<div class="card"><div class="tt-h">' + T('mb.count','Telling invoeren') + '</div>';
    html += '<div class="mb-rooms">' + rooms.map(r => {
      const done = mb.countedToday.includes(r);
      return '<button class="mb-room' + (mbRoom === r ? ' on' : '') + '" data-mbroom="' + r.replace(/"/g,'&quot;') + '">' + (done ? '✓ ' : '') + r + '</button>';
    }).join('') + '</div>';
    if (mbRoom){
      html += '<div style="margin-top:0.8rem;font-size:0.74rem;color:var(--soft);">' + T('mb.howmany','Hoeveel is er gebruikt uit') + ' ' + mbRoom + '?</div>';
      html += mb.catalog.map(m => {
        const q = mbQty[m.id] || 0;
        return '<div class="mb-item"><div class="mi"><b>' + m.name + '</b><span>' + eur(m.price) + '</span></div>' +
          '<div class="qty"><button data-mbmin="' + m.id + '">−</button><b>' + q + '</b><button data-mbplus="' + m.id + '">+</button></div></div>';
      }).join('');
      const total = mb.catalog.reduce((s, m) => s + m.price * (mbQty[m.id] || 0), 0);
      html += '<button class="bigbtn" id="mbSubmit">' + (total > 0
        ? T('mb.register','Registreer telling') + ', ' + eur(total) + ' ' + T('mb.toroom','op de kamer')
        : T('mb.registerzero','Registreer: niets gebruikt')) + '</button>';
    }
    html += '</div>';

    // vandaag-overzicht
    const notCounted = rooms.filter(r => !mb.countedToday.includes(r));
    html += '<div class="card"><div class="tt-h">' + T('mb.today','Vandaag geteld') + ' (' + mb.countedToday.length + '/' + rooms.length + ')</div>' +
      (notCounted.length
        ? '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--amber);">' + T('mb.todo','Nog tellen:') + ' ' + notCounted.join(', ') + '</div>'
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--green);">✓ ' + T('mb.alldone','Alle kamers zijn vandaag geteld.') + '</div>') +
      (mb.recent.length ? mb.recent.map(e =>
        '<div class="pos-sale"><div><b>' + e.room + '</b><span>' + (e.items.length ? e.items.map(i => i.qty + 'x ' + i.name).join(', ') : T('mb.nothing','niets gebruikt')) + ' · ' + e.actor + ' · ' + timeAgo(e.at) + '</span></div>' +
        '<div class="amt" style="font-family:\'Bodoni Moda\',serif;">' + (e.total ? eur(e.total) : '') + '</div></div>').join('') : '') +
      '</div>';

    // catalogus
    html += '<div class="card"><div class="tt-h">' + T('mb.catalog','Catalogus') + '</div>' +
      mb.catalog.map(m => '<div class="pos-sale"><div><b>' + m.name + '</b></div><div class="row-mid-gap"><span class="amt" style="font-family:\'Bodoni Moda\',serif;">' + eur(m.price) + '</span><button class="rr-del" data-mbdel="' + m.id + '">✕</button></div></div>').join('') +
      '<div class="tt-add"><input id="mbName" placeholder="' + T('mb.newitem','Nieuw artikel') + '" style="flex:2;min-width:110px;"><input id="mbPrice" type="number" inputmode="decimal" placeholder="€" style="flex:1;min-width:60px;"><button id="mbAdd">' + T('team.add','Toevoegen') + '</button></div></div>';

    el.innerHTML = html;
    el.querySelectorAll('[data-mbroom]').forEach(b => b.addEventListener('click', () => { mbRoom = b.dataset.mbroom; mbQty = {}; renderMinibar(); openTab('minibar'); }));
    el.querySelectorAll('[data-mbplus]').forEach(b => b.addEventListener('click', () => { mbQty[b.dataset.mbplus] = (mbQty[b.dataset.mbplus] || 0) + 1; renderMinibar(); openTab('minibar'); }));
    el.querySelectorAll('[data-mbmin]').forEach(b => b.addEventListener('click', () => { mbQty[b.dataset.mbmin] = Math.max(0, (mbQty[b.dataset.mbmin] || 0) - 1); renderMinibar(); openTab('minibar'); }));
    const sub = $('#mbSubmit'); if (sub) sub.addEventListener('click', submitMinibar);
    el.querySelectorAll('[data-mbdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/minibar/item/remove', { id: b.dataset.mbdel }); await refresh(); openTab('minibar'); } catch(e){ toast(e.message); }
    }));
    const add = $('#mbAdd'); if (add) add.addEventListener('click', async () => {
      const name = $('#mbName').value.trim(), price = Number($('#mbPrice').value);
      if (!name || !(price > 0)){ toast(T('mb.fill','Vul een artikel en prijs in.')); return; }
      try { await API.call('/supplier/minibar/item/add', { name, price }); toast(T('mb.added','Artikel toegevoegd.')); await refresh(); openTab('minibar'); } catch(e){ toast(e.message); }
    });
  }
  async function submitMinibar(){
    if (!mbRoom) return;
    const items = Object.entries(mbQty).filter(([,q]) => q > 0).map(([id, qty]) => ({ id, qty }));
    try {
      const d = await API.call('/supplier/minibar/count', { room: mbRoom, items });
      toast(d.charged > 0
        ? T('mb.done','Geteld. ') + eur(d.charged) + ' ' + T('mb.charged','op de kamerrekening gezet.')
        : T('mb.donezero','Geteld: niets gebruikt.'));
      mbRoom = null; mbQty = {};
      await refresh(); openTab('minibar');
    } catch(e){ toast(e.message); }
  }

  // ---- tafelindeling (horeca) ----
  const TBL_NEXT = { vrij:'bezet', bezet:'gereserveerd', gereserveerd:'dicht', dicht:'vrij' };
  const TBL_EN = { vrij:'free', bezet:'occupied', gereserveerd:'reserved', dicht:'closed' };
  const tTbl = s => (lang()==='en' ? (TBL_EN[s]||s) : s);
  function renderTafels(){
    const el = $('#tafelsWrap'); if (!el) return;
    const tables = state.tables;
    if (!Array.isArray(tables)){ el.innerHTML = ''; return; }
    const canEdit = actor().manager;
    const free = tables.filter(t=>t.status==='vrij').length;
    let html = '<div class="card"><div class="tt-h">'+T('tbl.floor','Zaal')+' · '+free+'/'+tables.length+' '+T('tbl.free','vrij')+'</div>'+
      '<div class="tbl-grid">'+tables.map(t =>
        '<button class="tbl tbl-'+t.status+'" data-tbl="'+t.id+'"><b>'+t.name+'</b><span>'+t.seats+' '+T('tbl.pers','pers.')+'</span><i>'+tTbl(t.status)+'</i>'+
        (canEdit?'<em class="tbl-del" data-tdel="'+t.id+'">✕</em>':'')+'</button>'
      ).join('')+'</div>'+
      '<div class="note-soft">'+T('tbl.note','Tik een tafel: vrij, bezet, gereserveerd, dicht. Gasten zien live hoeveel tafels vrij zijn.')+'</div>';
    if (canEdit){
      html += '<div class="tt-add"><input id="tblName" placeholder="'+T('tbl.nameph','Bijv. Tafel 7 of Bar links')+'" style="flex:2;min-width:130px;"><input id="tblSeats" type="number" inputmode="numeric" placeholder="4" style="flex:1;min-width:60px;"><button id="tblAdd">'+T('team.add','Toevoegen')+'</button></div>';
    }
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-tbl]').forEach(b => b.addEventListener('click', async e => {
      if (e.target.classList.contains('tbl-del')) return;
      const t = tables.find(x=>x.id===b.dataset.tbl);
      try { await API.call('/supplier/table/status', { id: t.id, status: TBL_NEXT[t.status]||'vrij' }); await refresh(); openTab('tafels'); } catch(err){ toast(err.message); }
    }));
    el.querySelectorAll('[data-tdel]').forEach(x => x.addEventListener('click', async e => {
      e.stopPropagation();
      try { await API.call('/supplier/table/remove', { id: x.dataset.tdel }); await refresh(); openTab('tafels'); } catch(err){ toast(err.message); }
    }));
    const add = $('#tblAdd'); if (add) add.addEventListener('click', async () => {
      const name = $('#tblName').value.trim(), seats = Number($('#tblSeats').value)||2;
      if (!name){ toast(T('tbl.fill','Geef de tafel een naam.')); return; }
      try { await API.call('/supplier/table/add', { name, seats }); await refresh(); openTab('tafels'); } catch(e){ toast(e.message); }
    });
  }

  // ---- beheer: open/dicht-schakelaars (managers/chefs) ----
  function renderBeheer(){
    const el = $('#beheerWrap'); if (!el) return;
    if (!actor().manager){
      el.innerHTML = '<div class="card"><div style="font-size:0.84rem;color:var(--muted);">'+T('bh.only','Alleen managers en chefs kunnen instellingen aanpassen. Vraag uw manager.')+'</div></div>';
      return;
    }
    const st = state.settings || { ordersOpen: true, reservationsOpen: true };
    const row = (key, label, sub, on) =>
      '<div class="room-row"><div class="rr-t"><b>'+label+'</b><span>'+sub+'</span></div>'+
      '<button class="rr-toggle'+(on?' on':'')+'" data-set="'+key+'" data-val="'+(!on)+'"><span></span></button></div>';
    el.innerHTML = '<div class="card">'+
      row('ordersOpen', T('bh.orders','Bestellingen'), on1(st.ordersOpen), st.ordersOpen) +
      row('reservationsOpen', T('bh.res','Reserveringen'), on1(st.reservationsOpen), st.reservationsOpen) +
      '<div class="note-soft">'+T('bh.note','Dicht = leden kunnen direct niet meer bestellen of reserveren; de kaart blijft zichtbaar. Alles wordt gelogd.')+'</div></div>'+
      '<div class="card"><div class="tt-h">'+T('bh.more','Verder beheren')+'</div>'+
      '<div style="margin-top:0.5rem;font-size:0.82rem;color:var(--muted);line-height:1.7;">'+T('bh.tips','Menukaart bewerken doet u onder Menu. Tafels onder Tafels. Kamers en prijzen onder Kamers. Personeel en pincodes onder Team.')+'</div></div>';
    function on1(v){ return v ? T('bh.open','Open, gasten kunnen dit nu gebruiken') : T('bh.closed','Dicht, tijdelijk niet beschikbaar'); }
    el.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/settings', { [b.dataset.set]: b.dataset.val === 'true' }); toast(T('bh.saved','Opgeslagen, leden zien het direct.')); await refresh(); openTab('beheer'); } catch(e){ toast(e.message); }
    }));
  }

  // ---- klussen (onderhoud) + gevonden voorwerpen ----
  function renderKlussen(){
    const el = $('#klussenWrap'); if (!el) return;
    if (!has('bookings')){ el.innerHTML = ''; return; }
    const tickets = state.tickets || [];
    const lost = state.lostfound || [];
    const open = tickets.filter(t => t.status !== 'klaar');
    const done = tickets.filter(t => t.status === 'klaar').slice(0, 6);
    const roomOpts = (state.rooms || []).map(r => '<option value="' + r.name.replace(/"/g,'&quot;') + '">' + r.name + '</option>').join('');

    let html = '<div class="card"><div class="tt-h">' + T('tk.open','Openstaande klussen') + ' (' + open.length + ')</div>';
    html += open.length ? open.map(t =>
      '<div class="tk-row"><div class="tk-t"><b>' + t.text + '</b><span>' + (t.room ? t.room + ' · ' : '') + t.by + ' · ' + timeAgo(t.at) + '</span></div>' +
      '<span class="pill ' + (t.status === 'bezig' ? 'bereiding' : 'nieuw') + '">' + (t.status === 'bezig' ? T('tk.busy','bezig') : T('tk.new','open')) + '</span>' +
      (t.status === 'open'
        ? '<button class="obtn primary" data-tk="' + t.id + '" data-tkst="bezig">' + T('tk.pickup','Oppakken') + '</button>'
        : '<button class="obtn primary" data-tk="' + t.id + '" data-tkst="klaar">' + T('tk.done','Klaar') + '</button>') +
      '</div>'
    ).join('') : '<div style="font-size:0.82rem;color:var(--green);padding:0.6rem 0;">✓ ' + T('tk.none','Geen openstaande klussen.') + '</div>';
    html += '<div class="tt-add" style="flex-wrap:wrap;"><input id="tkText" placeholder="' + T('tk.newph','Nieuwe klus, bijv. lamp vervangen') + '" style="flex:2;min-width:140px;">' +
      '<select id="tkRoom" style="background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:0 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;"><option value="">' + T('tk.noroom','Algemeen') + '</option>' + roomOpts + '</select>' +
      '<button id="tkAdd">' + T('team.add','Toevoegen') + '</button></div>';
    if (done.length) html += '<div class="tt-h" style="margin-top:1rem;">' + T('tk.donelist','Afgerond') + '</div>' + done.map(t =>
      '<div class="tk-row done"><div class="tk-t"><b>' + t.text + '</b><span>' + (t.doneBy || '') + (t.doneAt ? ' · ' + timeAgo(t.doneAt) : '') + '</span></div><span class="pill klaar">✓</span></div>').join('');
    html += '</div>';

    html += '<div class="card"><div class="tt-h">' + T('lf.h','Gevonden voorwerpen') + '</div>';
    const kept = lost.filter(l => l.status === 'bewaard');
    html += kept.length ? kept.map(l =>
      '<div class="tk-row"><div class="tk-t"><b>' + l.item + '</b><span>' + (l.room ? l.room + ' · ' : '') + (l.storage ? T('lf.at','ligt bij') + ' ' + l.storage + ' · ' : '') + l.by + ' · ' + timeAgo(l.at) + '</span></div>' +
      '<button class="obtn" data-lf="' + l.id + '">' + T('lf.picked','Opgehaald') + '</button></div>'
    ).join('') : '<div class="softline">' + T('lf.none','Niets in bewaring.') + '</div>';
    html += '<div class="tt-add" style="flex-wrap:wrap;"><input id="lfItem" placeholder="' + T('lf.itemph','Voorwerp, bijv. zonnebril') + '" style="flex:2;min-width:120px;">' +
      '<input id="lfStorage" placeholder="' + T('lf.storageph','Bewaarplek') + '" style="flex:1;min-width:90px;">' +
      '<select id="lfRoom" style="background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:0 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;"><option value="">' + T('lf.noroom','Elders') + '</option>' + roomOpts + '</select>' +
      '<button id="lfAdd">' + T('team.add','Toevoegen') + '</button></div></div>';

    el.innerHTML = html;
    el.querySelectorAll('[data-tk]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/ticket/status', { id: b.dataset.tk, status: b.dataset.tkst }); await refresh(); openTab('klussen'); } catch(e){ toast(e.message); }
    }));
    const ta = $('#tkAdd'); if (ta) ta.addEventListener('click', async () => {
      const text = $('#tkText').value.trim();
      if (!text){ toast(T('tk.fill','Omschrijf de klus.')); return; }
      try { await API.call('/supplier/ticket/add', { text, room: $('#tkRoom').value }); toast(T('tk.added','Klus gemeld.')); await refresh(); openTab('klussen'); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-lf]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/lost/done', { id: b.dataset.lf }); toast(T('lf.pickedtoast','Meegegeven en afgemeld.')); await refresh(); openTab('klussen'); } catch(e){ toast(e.message); }
    }));
    const la = $('#lfAdd'); if (la) la.addEventListener('click', async () => {
      const item = $('#lfItem').value.trim();
      if (!item){ toast(T('lf.fill','Omschrijf het voorwerp.')); return; }
      try { await API.call('/supplier/lost/add', { item, storage: $('#lfStorage').value, room: $('#lfRoom').value }); toast(T('lf.added','Geregistreerd.')); await refresh(); openTab('klussen'); } catch(e){ toast(e.message); }
    });
  }

  // ---- slimme deuren (appartementen) ----
  function renderDoors(){
    const el = $('#doorsWrap'); if (!el) return;
    const doors = state.doors;
    if (!Array.isArray(doors)){ el.innerHTML = ''; return; }
    el.innerHTML = '<div class="card">'+
      (doors.length ? doors.map(d =>
        '<div class="door-row'+(d.locked?'':' open')+'">'+
          '<span class="dl">'+(d.locked?'🔒':'🔓')+'</span>'+
          '<div class="dt"><b>'+d.name+'</b><span>'+(d.locked?T('door.locked','Vergrendeld'):T('door.open','OPEN, vergrendelt zichzelf'))+
            (d.lastBy?' · '+T('door.lastby','laatst:')+' '+d.lastBy+(d.lastAt?', '+timeAgo(d.lastAt):''):'')+'</span></div>'+
          '<button class="obtn'+(d.locked?' primary':' warn')+'" data-door="'+d.id+'">'+(d.locked?T('door.openbtn','Open 10 sec'):T('door.lockbtn','Vergrendel nu'))+'</button>'+
        '</div>'
      ).join('') : '<div class="softline">'+T('door.none','Nog geen digitale deuren gekoppeld.')+'</div>')+
      '<div class="note-soft">'+T('door.note','Elke opening komt in de activiteitenfeed: wie, welke deur, wanneer. Gearriveerde gasten kunnen de voordeur zelf openen via hun app.')+'</div>'+
    '</div>';
    el.querySelectorAll('[data-door]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/door/toggle', { id: b.dataset.door }); await refresh(); openTab('doors'); }
      catch(e){ toast(e.message); }
    }));
  }

  // ---- gasten live volgen (hotel/appartement) ----
  // het zorgprofiel van de gast, kort en leesbaar op een regel
  function zorgTekst(z){
    const parts = [];
    if ((z.allergenen || []).length) parts.push(T('zorg.allergie', 'Allergie') + ': ' + z.allergenen.join(', '));
    if (z.dieet) parts.push(z.dieet);
    if (z.medisch) parts.push(z.medisch);
    return parts.join(' · ');
  }
  // live meekijken met toestemming: de gast wijst de zaak aan, de zaak stopt het
  let gastLoc = null, gastLocBezig = false, gastLocAt = 0;
  function laadGastLoc(){
    if (gastLocBezig || Date.now() - gastLocAt < 15000) return;
    gastLocBezig = true;
    API.call('/supplier/gastlocaties', {})
      .then(d => { gastLoc = d.gasten || []; gastLocAt = Date.now(); gastLocBezig = false; renderGasten(); })
      .catch(() => { gastLoc = gastLoc || []; gastLocAt = Date.now(); gastLocBezig = false; });
  }
  function gastLocBlok(){
    const lijst = gastLoc || [];
    return '<div class="card"><div class="tt-h">📍 '+T('gl.h','Live meekijken (met toestemming)')+'</div>'+
      '<div style="font-size:0.75rem;color:var(--soft);margin-bottom:0.5rem;">'+T('gl.sub','De gast deelt zelf de live gps-locatie met uw zaak. Zet het uit zodra u het niet meer nodig heeft; de gast krijgt daar direct bericht van.')+'</div>'+
      (lijst.length ? lijst.map(g =>
        '<div class="guest-row" style="flex-wrap:wrap;gap:0.4rem;"><span class="cn">'+esc(g.codenaam)+'</span>'+
        (g.wachtOpLocatie ? '<span class="ge">'+T('gl.wacht','toestemming, wacht op gps')+'</span>'
          : '<span class="ge"><b>'+(g.km!=null?g.km+' km':'')+'</b>'+(g.etaMin!=null?' · ~'+g.etaMin+' min':'')+'</span>')+
        '<button class="obtn" data-glstop="'+g.id+'" style="font-size:0.62rem;">'+T('gl.stop','Niet meer nodig')+'</button>'+
        (g.zorg ? '<div style="flex-basis:100%;font-size:0.74rem;color:#E2B93B;">⚠ '+esc(zorgTekst(g.zorg))+'</div>' : '')+
        '</div>').join('')
      : '<div class="softline">'+T('gl.leeg','Nog geen gasten die hun locatie met u delen.')+'</div>')+'</div>';
  }
  function bindGastLoc(el){
    el.querySelectorAll('[data-glstop]').forEach(b => b.addEventListener('click', async () => {
      try {
        const r = await API.call('/supplier/gastlocatie/stop', { id: b.dataset.glstop });
        toast('📍 '+T('gl.gestopt','Meekijken gestopt;')+' '+r.deel.codenaam+' '+T('gl.gestopt2','heeft bericht gekregen.'));
        gastLocAt = 0; laadGastLoc();
      } catch(e){ toast(e.message); }
    }));
  }
  function renderGasten(){
    const el = $('#gastenWrap'); if (!el) return;
    laadGastLoc();
    if (!has('bookings')){ el.innerHTML = gastLocBlok(); bindGastLoc(el); return; }
    const guests = state.guests || [];
    const nearby = state.nearbyGuests || [];

    // kaartje: het eigen pand + verbonden gasten met positie
    const pts = [];
    if (S.loc) pts.push({ lat:S.loc.lat, lng:S.loc.lng, me:true });
    guests.forEach(g => { if (g.loc) pts.push({ lat:g.loc.lat, lng:g.loc.lng, name:g.codename }); });
    // gasten die met toestemming live meekijken laten, staan ook op de kaart
    (gastLoc || []).forEach(g => { if (g.loc && !pts.some(p => p.name === g.codenaam)) pts.push({ lat:g.loc.lat, lng:g.loc.lng, name:g.codenaam }); });
    let map = '';
    if (pts.length > 1){
      const lats = pts.map(p=>p.lat), lngs = pts.map(p=>p.lng);
      let minLat=Math.min(...lats), maxLat=Math.max(...lats), minLng=Math.min(...lngs), maxLng=Math.max(...lngs);
      let dLat=(maxLat-minLat)||0.002, dLng=(maxLng-minLng)||0.002;
      minLat-=dLat*0.2; maxLat+=dLat*0.2; minLng-=dLng*0.2; maxLng+=dLng*0.2;
      dLat=maxLat-minLat; dLng=maxLng-minLng;
      map = '<div class="gmap">'+pts.map(p=>{
        const x=((p.lng-minLng)/dLng)*100, y=(1-(p.lat-minLat)/dLat)*100;
        return '<div class="mk" style="left:'+x.toFixed(1)+'%;top:'+y.toFixed(1)+'%;">'+
          (p.me?'<div>'+S.icon+'</div>':'<div class="gpin"></div>')+
          '<div class="lbl">'+(p.me?S.name.split(' ')[0]:p.name)+'</div></div>';
      }).join('')+'</div>';
    }

    let html = gastLocBlok();
    html += '<div class="card"><div class="tt-h">'+T('gst.connected','Verbonden gasten')+'</div>'+map+
      (guests.length ? guests.map(g =>
        '<div class="guest-row"><span class="cn">'+g.codename+'</span>'+
        (g.arrived?'<span class="ge here">✓ '+T('sup.arrived','gearriveerd')+'</span>'
          : g.etaMin!=null?'<span class="ge"><b>'+g.etaMin+'</b> '+T('sup.minaway','min')+'</span>'
          : '<span class="ge">'+T('sup.enrouteshort','onderweg')+'</span>')+'</div>'
      ).join('') : '<div class="softline">'+T('gst.none','Nog geen verbonden gasten.')+'</div>')+'</div>';

    html += '<div class="card"><div class="tt-h">'+T('gst.nearby','Nu onderweg (nog niet verbonden)')+'</div>'+
      (nearby.length ? nearby.map(g =>
        '<div class="guest-row"><span class="cn">'+g.codename+'</span>'+
        '<div style="display:flex;align-items:center;gap:0.6rem;">'+(g.dest?'<span class="ge">'+T('gst.to','naar')+' '+g.dest+'</span>':'')+
        '<button class="obtn primary" data-connect="'+g.codename.replace(/"/g,'&quot;')+'">'+T('gst.connect','Verbind')+'</button></div></div>'
      ).join('') : '<div class="softline">'+T('gst.nonearby','Er is nu niemand live onderweg.')+'</div>')+
      '<div class="note-soft">'+T('gst.note','Verbinden meldt het bij de gast: u volgt de aankomst om alles klaar te zetten. U ziet daarna live de positie en aankomsttijd.')+'</div></div>';

    el.innerHTML = html;
    bindGastLoc(el);
    el.querySelectorAll('[data-connect]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/guest/connect', { codename: b.dataset.connect }); toast(T('gst.done','Verbonden. De gast is op de hoogte.')); await refresh(); openTab('gasten'); }
      catch(e){ toast(e.message); }
    }));
  }

  // ---- gastchat: berichten van gasten beantwoorden ----
  let gchatKey = null; // open gesprek
  function renderGChat(){
    const el = $('#gchatWrap'); if (!el) return;
    const chats = state.guestChats || [];
    if (gchatKey && !chats.find(c => c.key === gchatKey)) gchatKey = null;
    if (!gchatKey){
      el.innerHTML = '<div class="card">' + (chats.length ? chats.map(c =>
        '<button class="gc-row" data-gchat="' + c.key + '">' +
          '<span class="av">' + c.codename.split(' ').map(w=>w[0]).slice(0,2).join('') + '</span>' +
          '<span class="gt"><b>' + c.codename + ' <em class="gc-dept">' + c.dept + '</em>' + (c.unread ? ' <i class="gc-unread">' + c.unread + '</i>' : '') + '</b>' +
          '<span>' + (c.lastFrom === 'partner' ? T('gc.you','U: ') : '') + c.last + ' · ' + timeAgo(c.lastAt) + '</span></span>' +
        '</button>'
      ).join('') : '<div class="softline">' + T('gc.none','Nog geen gesprekken. Berichten van gasten verschijnen hier live.') + '</div>') + '</div>';
      el.querySelectorAll('[data-gchat]').forEach(b => b.addEventListener('click', () => { gchatKey = b.dataset.gchat; klantSalonOpen = false; renderGChat(); openTab('gchat'); }));
      return;
    }
    const meta = chats.find(c => c.key === gchatKey);
    el.innerHTML = '<button class="sp-back" id="gcBack">← ' + T('gc.back','Alle gesprekken') + '</button>' +
      '<div class="card"><div class="tt-h">' + T('sup.guest','Gast') + ' <span style="color:var(--gold);">' + (meta ? meta.codename : '') + '</span>' + (meta && meta.dept ? ' · ' + meta.dept : '') +
        ' <button class="gc-salon-btn" id="gcSalonBtn">' + T('gc.salon','Bekijk Salon') + '</button></div>' +
      '<div id="gcSalon"></div>' +
      '<div class="tt-chat" id="gcThread"></div>' +
      '<div class="tt-compose"><input id="gcMsg" placeholder="' + T('gc.ph','Antwoord de gast') + '" autocomplete="off"><button id="gcSend">' + T('team.send','Stuur') + '</button></div></div>';
    $('#gcBack').addEventListener('click', () => { gchatKey = null; renderGChat(); openTab('gchat'); });
    $('#gcSalonBtn').addEventListener('click', toggleKlantSalon);
    $('#gcSend').addEventListener('click', sendGChat);
    $('#gcMsg').addEventListener('keydown', e => { if (e.key === 'Enter') sendGChat(); });
    loadGChatThread();
  }
  // De partner bekijkt vooraf de Salon van het lid: geen vreemden van elkaar.
  // Privacy-first: alleen de codenaam, de pas en de eigen posts van het lid.
  let klantSalonOpen = false;
  async function toggleKlantSalon(){
    const box = $('#gcSalon'); if (!box || !gchatKey) return;
    klantSalonOpen = !klantSalonOpen;
    if (!klantSalonOpen){ box.innerHTML = ''; return; }
    box.innerHTML = '<div class="softline">' + T('gc.salonLaad','Salon laden…') + '</div>';
    try {
      const d = await API.call('/supplier/klant/salon', { key: gchatKey });
      const posts = (d.posts || []).map(p =>
        '<div class="ks-post">' + (p.photo ? '<img src="' + p.photo + '" alt="' + T('gc.salonFoto','Salon-foto van het lid') + '">' : '') +
          '<div>' + (p.place ? '<em>' + esc(p.place) + '</em> ' : '') + esc(p.text) + '</div></div>'
      ).join('');
      box.innerHTML = '<div class="ks-card"><div class="ks-h">' +
          '<span class="av">' + (d.codename||'?').split(' ').map(w=>w[0]).slice(0,2).join('') + '</span>' +
          '<b>' + esc(d.codename || '') + '</b> <span class="ks-pas">' + esc(d.tier || '') + '</span></div>' +
        (posts || '<div class="softline">' + T('gc.salonLeeg','Dit lid heeft nog geen Salon-posts.') + '</div>') + '</div>';
    } catch(e){ box.innerHTML = '<div class="softline">' + T('gc.salonFout','Salon nu niet te laden.') + '</div>'; }
  }
  async function loadGChatThread(){
    if (!gchatKey) return;
    try {
      const d = await API.call('/supplier/chat/history', { key: gchatKey });
      fillGChatThread(d.messages);
    } catch(e){}
  }
  function fillGChatThread(msgs){
    const t = $('#gcThread'); if (!t) return;
    t.innerHTML = (msgs || []).map(m =>
      '<div class="tt-msg ' + (m.from === 'partner' ? 'me' : (m.from === 'systeem' ? 'sys' : 'other')) + '"><span class="who">' + (m.who || (m.from === 'systeem' ? 'RTG' : '')) + '</span>' +
      m.text.replace(/&/g,'&amp;').replace(/</g,'&lt;') +
      (m.orig ? '<span style="display:block;margin-top:0.25rem;font-size:0.68rem;color:var(--soft);font-style:italic;">' + m.orig.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' : '') +
      '<time>' + timeAgo(m.at) + '</time></div>'
    ).join('');
    t.scrollTop = t.scrollHeight;
  }
  async function sendGChat(){
    const inp = $('#gcMsg');
    const text = (inp.value || '').trim();
    if (!text || !gchatKey) return;
    inp.value = '';
    try { fillGChatThread((await API.call('/supplier/chat/send', { key: gchatKey, text })).messages); }
    catch(e){ toast(e.message); }
  }

  // ---- pagina: foto's + publiceren op De Salon ----
  function fileToDataURL(file, cb){
    const reader = new FileReader();
    reader.onload = () => cb(String(reader.result));
    reader.readAsDataURL(file);
  }
  let salonStatus = null;
  async function laadSalonStatus(){
    if (!API.live) return;
    try { salonStatus = await API.call('/supplier/salon/status', {}); } catch(e){ salonStatus = null; }
    renderPage();
  }
  function renderPage(){
    const el = $('#pageWrap'); if (!el) return;
    const photos = state.photos || [];
    if (salonStatus === null){ laadSalonStatus(); }
    let html = '';
    // De Salon is verplicht: een blijvende profielkaart met compleetheidsmeter
    if (salonStatus){
      const st = salonStatus, canEdit = actor().manager;
      const kleur = st.compleet ? 'var(--green)' : 'var(--burgundy)';
      html += '<div class="card" style="border-color:'+kleur+';"><div class="tt-h" style="color:'+kleur+';">'+
        (st.compleet ? '✅ '+T('sn.compleet','Salon-profiel compleet') : '⚠️ '+T('sn.verplicht','De Salon is verplicht'))+'</div>'+
        '<p class="ds" style="margin:0.4rem 0;">'+T('sn.uitleg','Al uw marketing, producten en folders lopen via De Salon. Zonder compleet profiel bent u niet zichtbaar voor leden en kunt u niets publiceren.')+'</p>'+
        '<div style="height:8px;background:var(--card2);border-radius:999px;overflow:hidden;margin:0.5rem 0;"><div style="height:100%;width:'+st.percentage+'%;background:'+kleur+';"></div></div>'+
        '<div style="display:grid;gap:0.35rem;">'+st.stappen.map(s => '<div style="font-size:0.82rem;">'+(s.klaar?'✅':'⬜')+' '+T('sn.stap.'+s.id, s.tekst)+'</div>').join('')+'</div>'+
        (canEdit ? '<div class="field" style="margin-top:0.7rem;"><label>'+T('sn.bio','Bio (wie bent u?)')+'</label><textarea id="snBio" rows="2" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;font-family:inherit;">'+esc(st.bio||'')+'</textarea></div>'+
          '<div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.5rem;flex-wrap:wrap;">'+
          '<label class="obtn" style="cursor:pointer;">📷 '+T('sn.foto','Profielfoto')+'<input type="file" id="snFoto" accept="image/*" style="display:none;"></label>'+
          (st.foto?'<img src="'+esc(st.foto)+'" alt="'+T('sn.foto','Profielfoto')+'" style="width:44px;height:44px;object-fit:cover;border-radius:8px;">':'')+
          '<button class="obtn primary" id="snBioSave">'+T('sn.opslaan','Profiel opslaan')+'</button></div>' : '')+
        '</div>';
    }
    html += '<div class="card"><div class="tt-h">'+T('sup.photos','Foto\'s op uw pagina')+' ('+photos.length+'/6)</div>';
    html += '<div class="ph-grid">'+
      photos.map((p,i)=>'<div class="ph"><img src="'+p+'" alt=""><button data-phdel="'+i+'">✕</button></div>').join('')+
      (photos.length<6?'<label class="ph add">+<input type="file" id="phFile" accept="image/jpeg,image/png,image/webp" style="display:none;"></label>':'')+
    '</div>';
    html += '<div style="margin-top:0.6rem;font-size:0.72rem;color:var(--soft);">'+T('sup.photonote','Gasten zien deze foto\'s in de RTG-app bij uw pagina, direct na plaatsen.')+'</div></div>';

    html += '<div class="card"><div class="tt-h">'+T('sup.salonpub','Publiceer op De Salon')+'</div>'+
      '<textarea id="spText" class="salon-ta" placeholder="'+T('sup.salonph','Vertel RTG-leden over uw nieuwste gerecht, suite of avond...')+'"></textarea>'+
      (photos.length?'<div class="ph-pick">'+photos.map((p,i)=>'<img src="'+p+'" data-pick="'+i+'" alt="">').join('')+'</div>':'')+
      '<button class="bigbtn" id="spPost" style="margin-top:0.8rem;">'+T('sup.salonpost','Publiceer als RTG-partner')+'</button>'+
      '<div style="margin-top:0.6rem;font-size:0.72rem;color:var(--soft);">'+T('sup.salonnote','Uw bericht verschijnt in De Salon van alle leden, met uw bedrijfsnaam als partner.')+'</div></div>';

    // folder (digitale brochure): titel + foto's + producten
    if (actor().manager) html += '<div class="card"><div class="tt-h">'+T('sn.folder','Folder plaatsen (producten & aanbod)')+'</div>'+
      '<p class="ds" style="margin:0.3rem 0;">'+T('sn.foldertip','Een digitale brochure: foto\'s en producten met prijs. Zo staan uw producten in De Salon, niet los in de leden-app.')+'</p>'+
      '<div class="field"><label>'+T('sn.f.titel','Titel')+'</label><input id="snFdTitel" placeholder="'+T('sn.f.titelph','Bijv. Zomerkaart')+'"></div>'+
      '<div class="field"><label>'+T('sn.f.tekst','Korte intro (optioneel)')+'</label><input id="snFdTekst"></div>'+
      '<div class="field"><label>'+T('sn.f.fotos','Foto\'s')+'</label><div id="snFdFotos" style="display:flex;gap:0.4rem;flex-wrap:wrap;"></div>'+
        '<label class="obtn" style="cursor:pointer;margin-top:0.4rem;display:inline-block;">📷 '+T('sn.f.fotoadd','Foto toevoegen')+'<input type="file" id="snFdFoto" accept="image/*" style="display:none;"></label></div>'+
      '<div class="field"><label>'+T('sn.f.items','Producten')+'</label><div id="snFdItems"></div>'+
        '<button class="obtn" id="snFdItemAdd" style="margin-top:0.4rem;">+ '+T('sn.f.itemadd','Product toevoegen')+'</button></div>'+
      '<button class="obtn primary" id="snFdPlaats" style="margin-top:0.7rem;">'+T('sn.f.plaats','Folder plaatsen')+'</button></div>';

    el.innerHTML = html;

    // Salon-profiel: bio + foto opslaan
    let snFotoData = null;
    const snFoto = el.querySelector('#snFoto');
    if (snFoto) snFoto.addEventListener('change', () => { const file = snFoto.files && snFoto.files[0]; if (!file) return;
      if (file.size > 1.4*1024*1024){ toast(T('sup.phtoobig','Foto te groot (max 1 MB).')); return; } fileToDataURL(file, d => { snFotoData = d; toast(T('sn.fotoklaar','Foto gekozen; sla het profiel op.')); }); });
    const snSave = el.querySelector('#snBioSave');
    if (snSave) snSave.addEventListener('click', async () => {
      const body = { bio: $('#snBio').value }; if (snFotoData) body.foto = snFotoData;
      try { await API.call('/supplier/salon/bio', body); toast(T('sn.opgeslagen','Profiel opgeslagen.')); await laadSalonStatus(); await refresh(); } catch(e){ toast(e.message); }
    });
    // folder-composer
    const fdFotos = [], fdItems = [];
    const tekenFdFotos = () => { const c = el.querySelector('#snFdFotos'); if (c) c.innerHTML = fdFotos.map((f,i)=>'<div style="position:relative;"><img src="'+f+'" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:8px;"><button class="rr-del" data-fdfdel="'+i+'" style="position:absolute;top:-6px;right:-6px;">✕</button></div>').join('');
      c && c.querySelectorAll('[data-fdfdel]').forEach(b => b.addEventListener('click', () => { fdFotos.splice(Number(b.dataset.fdfdel),1); tekenFdFotos(); })); };
    const tekenFdItems = () => { const c = el.querySelector('#snFdItems'); if (!c) return; c.innerHTML = fdItems.map((it,i)=>'<div style="display:flex;gap:0.4rem;margin-top:0.3rem;"><input data-fdinaam="'+i+'" placeholder="'+T('sn.f.naam','Product')+'" value="'+esc(it.naam)+'" style="flex:2;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;font-size:0.82rem;color:var(--txt);"><input data-fdiprijs="'+i+'" type="number" placeholder="€" value="'+(it.prijs!=null?it.prijs:'')+'" style="width:70px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;font-size:0.82rem;color:var(--txt);"><button class="rr-del" data-fdidel="'+i+'">✕</button></div>').join('');
      c.querySelectorAll('[data-fdinaam]').forEach(inp => inp.addEventListener('input', () => { fdItems[Number(inp.dataset.fdinaam)].naam = inp.value; }));
      c.querySelectorAll('[data-fdiprijs]').forEach(inp => inp.addEventListener('input', () => { fdItems[Number(inp.dataset.fdiprijs)].prijs = inp.value === '' ? null : Number(inp.value); }));
      c.querySelectorAll('[data-fdidel]').forEach(b => b.addEventListener('click', () => { fdItems.splice(Number(b.dataset.fdidel),1); tekenFdItems(); })); };
    const fdFoto = el.querySelector('#snFdFoto');
    if (fdFoto) fdFoto.addEventListener('change', () => { const file = fdFoto.files && fdFoto.files[0]; if (!file) return;
      if (fdFotos.length >= 8) return toast(T('sn.f.max','Maximaal 8 foto\'s.')); fotoKlein(file, d => { fdFotos.push(d); tekenFdFotos(); }); });
    const fdItemAdd = el.querySelector('#snFdItemAdd');
    if (fdItemAdd) fdItemAdd.addEventListener('click', () => { if (fdItems.length >= 30) return; fdItems.push({ naam:'', prijs:null }); tekenFdItems(); });
    const fdPlaats = el.querySelector('#snFdPlaats');
    if (fdPlaats) fdPlaats.addEventListener('click', async () => {
      const titel = $('#snFdTitel').value.trim();
      if (!titel) return toast(T('sn.f.geeftitel','Geef de folder een titel.'));
      if (!fdFotos.length && !fdItems.some(i=>i.naam.trim())) return toast(T('sn.f.leeg','Voeg minstens een foto of product toe.'));
      try { await API.call('/supplier/salon/folder', { titel, tekst: $('#snFdTekst').value, fotos: fdFotos, items: fdItems.filter(i=>i.naam.trim()) });
        toast(T('sn.f.ok','Folder geplaatst op De Salon.')); await laadSalonStatus(); openTab('page'); } catch(e){ toast(e.message); }
    });

    el.querySelectorAll('[data-phdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/photo/remove', { index: Number(b.dataset.phdel) }); await refresh(); openTab('page'); } catch(e){ toast(e.message); }
    }));
    const f = $('#phFile'); if (f) f.addEventListener('change', () => {
      const file = f.files && f.files[0]; if (!file) return;
      if (file.size > 1024*1024){ toast(T('sup.phtoobig','Foto te groot (max 1 MB).')); return; }
      fileToDataURL(file, async url => {
        try { await API.call('/supplier/photo/add', { image: url }); toast(T('sup.phadded','Foto geplaatst.')); await refresh(); openTab('page'); } catch(e){ toast(e.message); }
      });
    });
    let picked = null;
    el.querySelectorAll('[data-pick]').forEach(img => img.addEventListener('click', () => {
      picked = picked === Number(img.dataset.pick) ? null : Number(img.dataset.pick);
      el.querySelectorAll('[data-pick]').forEach(x => x.classList.toggle('sel', Number(x.dataset.pick) === picked));
    }));
    const post = $('#spPost'); if (post) post.addEventListener('click', async () => {
      const text = $('#spText').value.trim();
      if (!text){ toast(T('sup.salonempty','Schrijf eerst een tekst.')); return; }
      try {
        await API.call('/supplier/salon/post', { text, photoIndex: picked });
        toast(T('sup.salondone','Gepubliceerd op De Salon.'));
        $('#spText').value = ''; picked = null;
        el.querySelectorAll('[data-pick]').forEach(x => x.classList.remove('sel'));
      } catch(e){ toast(e.message); }
    });
  }

  /* ================= winkelvloer + zorgbalie in de zaak-app =================
     Dezelfde vloerfuncties als op de personeels-PDA, maar dan in de eigen
     app van de zaak: wie inlogt bij een modehuis krijgt de Winkelvloer als
     app op het springboard, wie inlogt bij een spa of kliniek de Zorgbalie.
     Zo landt elk account vanzelf in de juiste app met de juiste werkvloer. */

  // ---- de winkelvloer: mobiele kassa, voorraad, paskamer, klant erbij ----
  let wvRetail = null;   // vloer-toestand (voorraad, paskamer, apart)
  let wvKlant = null;    // geopend klantdossier
  let wvCart = [];       // bon: [{vsku, naam, kleur, maat, price, aantal}]
  async function laadWinkelvloer(){
    if (!has('retail') || !API.live) return;
    try { wvRetail = (await API.call('/supplier/retail', {})).retail; }
    catch(e){ wvRetail = { artikelen:[], paskamer:[], apart:[], klanten:[], stats:{} }; }
    renderWinkelvloer();
  }
  function wvInput(id, ph){ return '<input id="'+id+'" placeholder="'+ph+'" style="flex:1;background:var(--card2,var(--card));border:1px solid var(--line);border-radius:10px;padding:0.7rem 0.85rem;font-size:0.9rem;color:var(--txt);outline:none;font-family:inherit;">'; }
  function wvKlantKaart(k){
    const maten = Object.entries(k.maten||{}).map(([a,b]) => esc(a)+': '+esc(b)).join(' · ');
    return '<div style="border-top:1px solid var(--line);padding-top:0.6rem;margin-top:0.5rem;">'+
      '<div style="display:flex;justify-content:space-between;"><b>'+esc(k.codenaam||k.key)+'</b><span style="color:var(--gold);">'+eur(k.besteedTotaal)+'</span></div>'+
      '<div style="font-size:0.78rem;color:var(--muted);margin-top:0.2rem;">'+k.aankopen+' '+T('wv.aankopen','aankopen')+(maten?' · '+maten:'')+'</div>'+
      (k.voorkeuren?'<div style="font-size:0.78rem;color:var(--soft);margin-top:0.2rem;">'+esc(k.voorkeuren)+'</div>':'')+
      ((k.wishlist&&k.wishlist.length)?'<div style="font-size:0.78rem;margin-top:0.35rem;">💛 '+k.wishlist.map(w=>esc(w.naam)).join(', ')+'</div>':'')+
      '</div>';
  }
  function renderWinkelvloer(){
    const wrap = $('#wvWrap'); if (!wrap) return;
    if (!has('retail')){ wrap.innerHTML = ''; return; }
    if (!wvRetail){ wrap.innerHTML = '<div class="empty">…</div>'; laadWinkelvloer(); return; }
    const cartTot = wvCart.reduce((n, r) => n + r.price * r.aantal, 0);
    let html = '';
    html += '<div class="card"><div class="tt-h" style="display:flex;justify-content:space-between;align-items:center;">'+T('wv.kassa','Mobiele kassa')+
      (wvKlant?'<span style="color:var(--gold);font-size:0.7rem;">'+esc(wvKlant.codenaam||wvKlant.key)+'</span>':'')+'</div>'+
      (wvCart.length ? '<div style="margin-top:0.5rem;">'+wvCart.map((r,i) =>
        '<div class="mitem"><div class="r1"><span class="nm">'+esc(r.naam)+' · '+esc(r.kleur)+' · '+esc(r.maat)+'</span><span class="pr">'+eur(r.price)+' × '+r.aantal+'</span></div>'+
        '<button class="obtn" data-wvdel="'+i+'" style="margin-top:0.3rem;">✕ '+T('wv.weg','Weg')+'</button></div>').join('')+
        '<div style="display:flex;justify-content:space-between;font-weight:700;margin-top:0.6rem;"><span>'+T('wv.totaal','Totaal')+'</span><span>'+eur(cartTot)+'</span></div>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;flex-wrap:wrap;"><button class="obtn primary" data-wvbetaal="rtgpay">RTG Pay</button>'+
        '<button class="obtn" data-wvbetaal="contant">'+T('wv.contant','Contant')+'</button>'+
        '<button class="obtn" id="wvLeeg">'+T('wv.leeg','Bon leegmaken')+'</button></div>'
        : '<div class="empty">'+T('wv.leegbon','Zoek een artikel en tik + om het op de bon te zetten.')+'</div>')+'</div>';
    html += '<div class="card"><div class="tt-h">'+T('wv.zoek','Voorraad opzoeken')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.55rem;">'+wvInput('wvZoek', T('wv.zoekph','Naam, kleur of maat…'))+'<button class="obtn primary" id="wvZoekBtn">'+T('wv.zoekbtn','Zoek')+'</button></div>'+
      '<div id="wvZoekUit" style="margin-top:0.5rem;"></div></div>';
    const pk = wvRetail.paskamer || [];
    html += '<div class="card"><div class="tt-h">'+T('wv.paskamer','Paskamerverzoeken')+' ('+pk.length+')</div>'+
      (pk.length ? pk.map(v => '<div class="mitem"><div class="r1"><span class="nm">🚪 '+esc(v.artikelNaam)+' · '+esc(v.maat)+'</span></div>'+
        '<div class="ds">'+esc(v.codenaam||'Gast')+' · '+esc(v.kleur)+(v.paskamer?' · '+esc(v.paskamer):'')+'</div>'+
        '<button class="obtn primary" data-wvbreng="'+v.id+'" style="margin-top:0.35rem;">'+T('wv.breng','Gebracht')+'</button></div>').join('')
        : '<div class="empty">'+T('wv.geenpk','Geen open verzoeken.')+'</div>')+'</div>';
    const ap = wvRetail.apart || [];
    if (ap.length) html += '<div class="card"><div class="tt-h">'+T('wv.apart','Apart gelegd')+' ('+ap.length+')</div>'+
      ap.map(r => '<div class="mitem"><div class="r1"><span class="nm">🛍 '+esc(r.artikelNaam)+' · '+esc(r.maat)+'</span></div><div class="ds">'+esc(r.codenaam||r.key)+' · '+T('wv.tot','tot')+' '+esc(r.tot)+'</div></div>').join('')+'</div>';
    html += '<div class="card"><div class="tt-h">'+T('wv.klant','Klant erbij pakken')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.55rem;">'+wvInput('wvKlantKey', T('wv.klantph','Codenaam of sleutel van het lid'))+'<button class="obtn primary" id="wvKlantBtn">'+T('wv.open','Open')+'</button></div>'+
      '<div id="wvKlantUit">'+(wvKlant?wvKlantKaart(wvKlant):'')+'</div></div>';
    wrap.innerHTML = html;
    wvBind(wrap);
  }
  function wvBind(wrap){
    wrap.querySelectorAll('[data-wvdel]').forEach(b => b.addEventListener('click', () => { wvCart.splice(Number(b.dataset.wvdel), 1); renderWinkelvloer(); }));
    const leeg = wrap.querySelector('#wvLeeg'); if (leeg) leeg.addEventListener('click', () => { wvCart = []; renderWinkelvloer(); });
    wrap.querySelectorAll('[data-wvbetaal]').forEach(b => b.addEventListener('click', async () => {
      if (!wvCart.length) return;
      const body = { method: b.dataset.wvbetaal, regels: wvCart.map(r => ({ vsku: r.vsku, aantal: r.aantal })) };
      if (body.method === 'rtgpay'){
        const c = window.prompt(T('wv.paycode','Betaalcode van de klant (uit de app):'));
        if (!c) return;
        body.payCode = c.trim().toUpperCase();
      }
      if (wvKlant) body.klantKey = wvKlant.key;
      try {
        const r = await API.call('/supplier/retail/verkoop', body);
        toast('✅ '+T('wv.verkocht','Verkocht')+' · '+eur(r.sale.total));
        wvCart = [];
        if (wvKlant){ try { wvKlant = (await API.call('/supplier/retail/klant', { key: wvKlant.key })).klant; } catch(e){} }
        await laadWinkelvloer();
      } catch(e){ toast(e.message); }
    }));
    const doeZoek = async () => {
      const uit = wrap.querySelector('#wvZoekUit');
      try {
        const r = await API.call('/supplier/retail/zoek', { q: wrap.querySelector('#wvZoek').value });
        uit.innerHTML = r.resultaten.length ? r.resultaten.map(v =>
          '<div class="mitem"><div class="r1"><span class="nm">'+(v.voorraad>0?'👕':'🚫')+' '+esc(v.artikel)+'</span><span class="pr">'+eur(v.price)+'</span></div>'+
          '<div class="ds">'+esc(v.kleur)+' · '+esc(v.maat)+' · '+T('wv.voorraad','voorraad')+' '+v.voorraad+'</div>'+
          (v.voorraad>0?'<div style="display:flex;gap:0.35rem;margin-top:0.35rem;"><button class="obtn primary" data-wvadd="'+esc(v.vsku)+'" data-nm="'+esc(v.artikel)+'" data-kl="'+esc(v.kleur)+'" data-mt="'+esc(v.maat)+'" data-pr="'+v.price+'">+ '+T('wv.opbon','Op de bon')+'</button>'+
          '<button class="obtn" data-wvapart="'+esc(v.vsku)+'">'+T('wv.legapart','Apart')+'</button></div>':'')+'</div>').join('')
          : '<div class="empty">'+T('wv.niets','Niets gevonden.')+'</div>';
        uit.querySelectorAll('[data-wvadd]').forEach(b => b.addEventListener('click', () => {
          const bestaand = wvCart.find(r => r.vsku === b.dataset.wvadd);
          if (bestaand) bestaand.aantal++;
          else wvCart.push({ vsku: b.dataset.wvadd, naam: b.dataset.nm, kleur: b.dataset.kl, maat: b.dataset.mt, price: Number(b.dataset.pr), aantal: 1 });
          renderWinkelvloer();
        }));
        uit.querySelectorAll('[data-wvapart]').forEach(b => b.addEventListener('click', async () => {
          if (!wvKlant) return toast(T('wv.eerstklant','Pak eerst een klant erbij.'));
          try { await API.call('/supplier/retail/apart', { key: wvKlant.key, vsku: b.dataset.wvapart }); toast(T('wv.apartok','Apart gelegd voor de klant.')); await laadWinkelvloer(); } catch(e){ toast(e.message); }
        }));
      } catch(e){ toast(e.message); }
    };
    const zb2 = wrap.querySelector('#wvZoekBtn'); if (zb2) zb2.addEventListener('click', doeZoek);
    const zi = wrap.querySelector('#wvZoek'); if (zi) zi.addEventListener('keydown', e => { if (e.key === 'Enter') doeZoek(); });
    wrap.querySelectorAll('[data-wvbreng]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/retail/paskamer/breng', { id: b.dataset.wvbreng }); toast(T('wv.gebracht','Gebracht.')); await laadWinkelvloer(); } catch(e){ toast(e.message); }
    }));
    const kb = wrap.querySelector('#wvKlantBtn');
    const openKlant = async () => {
      const key = wrap.querySelector('#wvKlantKey').value.trim(); if (!key) return;
      try { wvKlant = (await API.call('/supplier/retail/klant', { key })).klant; renderWinkelvloer(); }
      catch(e){ toast(e.message); }
    };
    if (kb) kb.addEventListener('click', openKlant);
    const ki = wrap.querySelector('#wvKlantKey'); if (ki) ki.addEventListener('keydown', e => { if (e.key === 'Enter') openKlant(); });
  }

  // ---- de zorgbalie: de behandelaar-agenda van een spa of kliniek ----
  let zbLev = null, zbLevDatum = null;
  async function laadZorgbalieLev(){
    if (!has('care') || !API.live) return;
    try { zbLev = await API.call('/supplier/care/agenda', zbLevDatum ? { datum: zbLevDatum } : {}); }
    catch(e){ zbLev = null; }
    renderZorgbalieLev();
  }
  function renderZorgbalieLev(){
    const wrap = $('#zbWrap'); if (!wrap) return;
    if (!has('care')){ wrap.innerHTML = ''; return; }
    if (!zbLev){ wrap.innerHTML = '<div class="empty">…</div>'; laadZorgbalieLev(); return; }
    const dagen = [];
    for (let i = 0; i < 7; i++){
      const dt = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
      const aan = dt === zbLev.datum;
      dagen.push('<button class="obtn'+(aan?' primary':'')+'" data-zblevdag="'+dt+'"'+(aan?' aria-current="date"':'')+'>'+
        (i===0 ? T('zb.vandaag','vandaag') : dt.slice(8)+'/'+dt.slice(5,7))+'</button>');
    }
    const perBehandelaar = (zbLev.behandelaars || []).map(b => {
      const eigen = (zbLev.afspraken || []).filter(a => a.behandelaarId === b.id);
      return '<div class="card"><div class="tt-h">'+esc(b.naam)+' · '+esc(b.functie)+'</div>'+
        (eigen.length ? eigen.map(a =>
          '<div class="mitem"><div class="r1"><span class="nm" style="font-variant-numeric:tabular-nums;">'+(a.soort==='medisch'?'🩺':'🧖')+' '+esc(a.tijd)+' · '+esc(a.behandelingNaam)+'</span><span class="pr">'+eur(a.prijs)+'</span></div>'+
          '<div class="ds">'+T('zb.gast','Gast')+': '+esc(a.codenaam || '')+' · '+a.duurMin+' min</div>'+
          (a.zorg ? '<div class="ds" style="color:#E2B93B;">⚠ '+esc([((a.zorg.allergenen||[]).length?T('zb.allergie','Allergie')+': '+a.zorg.allergenen.join(', '):''), a.zorg.dieet, a.zorg.medisch].filter(Boolean).join(' · '))+'</div>' : '')+
          (a.intake ? '<div class="ds" style="color:#E2B93B;">🩺 '+esc(a.intake)+'</div>' : '')+
          (a.status === 'afgerond' ? '<div class="ds" style="color:var(--green,#4C9A75);">✅ '+T('zb.klaar','Afgerond')+'</div>'
            : '<button class="obtn primary" data-zblevklaar="'+esc(a.ref)+'" style="margin-top:0.35rem;">'+T('zb.afronden','Afronden')+'</button>')+
          '</div>').join('')
        : '<div class="empty">'+T('zb.leeg','Geen afspraken op deze dag.')+'</div>')+
      '</div>';
    }).join('');
    wrap.innerHTML = '<div class="card"><div class="tt-h">'+esc(zbLev.aanbieder || '')+'</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.55rem;">'+dagen.join('')+'</div></div>' + perBehandelaar;
    wrap.querySelectorAll('[data-zblevdag]').forEach(b => b.addEventListener('click', () => { zbLevDatum = b.dataset.zblevdag; laadZorgbalieLev(); }));
    wrap.querySelectorAll('[data-zblevklaar]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/care/afronden', { ref: b.dataset.zblevklaar }); toast('✅ '+T('zb.klaar','Afgerond')); laadZorgbalieLev(); }
      catch(e){ toast(e.message); }
    }));
  }
  // ---- AI-assistent ----
  let aiMsgs = [];
  function renderAIChips(){
    const el = $('#aiChips'); if (!el) return;
    let chips = [T('ai.c1','Dagomzet'), T('ai.c2','Onbeantwoorde berichten')];
    if (has('bookings')) chips.push(T('ai.c3','Welke kamers zijn vuil?'), T('ai.c4','Welke minibars nog tellen?'));
    if (has('orders')) chips.push(T('ai.c5','Open bestellingen'));
    if (has('doors')) chips.push(T('ai.c6','Open de voordeur'));
    chips.push(T('ai.c7','Wie is er onderweg?'), T('ai.c8','Welke klussen staan open?'));
    el.innerHTML = chips.map(c => '<button class="ai-chip">'+c+'</button>').join('');
    el.querySelectorAll('.ai-chip').forEach(b => b.addEventListener('click', () => { $('#aiInput').value = b.textContent; sendAI(); }));
  }
  function renderAIThread(){
    const t = $('#aiThread'); if (!t) return;
    t.innerHTML = aiMsgs.length ? aiMsgs.map(m =>
      '<div class="tt-msg ' + (m.role === 'user' ? 'me' : 'other') + '">' +
      (m.role === 'ai' ? '<span class="who">✦ AI</span>' : '') +
      m.text.replace(/&/g,'&amp;').replace(/</g,'&lt;') +
      (m.did ? '<span class="ai-did">✓ ' + T('ai.did','uitgevoerd') + '</span>' : '') + '</div>'
    ).join('') : '<div class="pcempty" style="padding:1.4rem 0.5rem;text-align:center;color:var(--soft);font-size:0.82rem;line-height:1.6;">' + T('ai.empty','Uw assistent kent het hele bedrijf: de kassa, de kamers, de klussen, de gasten. Vraag iets of geef een opdracht.') + '</div>';
    t.scrollTop = t.scrollHeight;
  }
  async function sendAI(){
    const inp = $('#aiInput');
    const q = (inp.value || '').trim();
    if (!q) return;
    inp.value = '';
    aiMsgs.push({ role: 'user', text: q });
    aiMsgs.push({ role: 'ai', text: '…' });
    renderAIThread();
    try {
      const d = await API.call('/supplier/ai', { q });
      aiMsgs[aiMsgs.length - 1] = { role: 'ai', text: d.reply, did: d.did };
      renderAIThread();
      if (d.did) await refresh();
      openTab('ai');
    } catch(e){
      aiMsgs[aiMsgs.length - 1] = { role: 'ai', text: e.message };
      renderAIThread();
    }
  }

  // ---- team ----
  let lastPin = null; // laatst gemaakte uitnodiging (kassacode), eenmalig getoond aan de manager
  function renderTeam(){
    const a = actor();
    const staff = state.staff || [];
    const activity = state.activity || [];
    const team = state.team || [];
    let html = '';

    // personeel
    html += '<div class="card"><div class="tt-h" style="display:flex;justify-content:space-between;align-items:center;">'+T('team.roster','Personeel')+'<span style="display:flex;gap:0.4rem;">'+
      (a.staffId ? '<button class="obtn" id="teamCallSup" style="font-size:0.66rem;">📹 '+T('team.call','Teamcall')+'</button>' : '')+
      '<button class="obtn" id="buzzAll" style="font-size:0.66rem;">📢 '+T('team.buzzall','Iedereen')+'</button></span></div>';
    html += staff.map(m => {
      const you = a.staffId && m.id === a.staffId;
      // iedereen bereikt iedereen: een interne (video)call of een direct bericht
      const bel = (you || !a.staffId) ? '' : '<button class="tt-buzz" data-belm="'+m.id+'" data-naam="'+escAttr(m.name)+'" title="'+T('team.belhint','Interne call (video)')+'">📞</button>';
      const dm = (you || !a.staffId) ? '' : '<button class="tt-buzz" data-dmm="'+m.id+'" data-naam="'+escAttr(m.name)+'" title="'+T('team.dmhint','Direct bericht')+'" style="position:relative;">💬<i data-dmbadge="'+m.id+'" style="display:none;position:absolute;top:-5px;right:-5px;background:#C23A5E;color:#fff;border-radius:999px;font-style:normal;font-size:0.58rem;min-width:1rem;height:1rem;line-height:1rem;text-align:center;"></i></button>';
      const buzz = you ? '' : '<button class="tt-buzz" data-buzz="'+m.id+'" title="'+T('team.buzz','Oproepen (tril)')+'">📳</button>';
      const rm = (a.manager && !you) ? '<button class="tt-rm" data-rm="'+m.id+'">'+T('team.remove','Verwijder')+'</button>' : '';
      const tag = you ? '<span class="you">'+T('team.you','jij')+'</span>' : '';
      return '<div class="tt-person"><span class="av">'+initials(m.name)+'</span><span class="nm"><b>'+m.name+' '+tag+'</b><span>'+(m.func? m.func+' · ':'')+T('role.'+m.role, m.role==='manager'?'Manager':'Medewerker')+'</span></span>'+bel+dm+buzz+rm+'</div>';
    }).join('') || '<div class="softline">'+T('team.nostaff','Nog geen personeel toegevoegd.')+'</div>';
    if (a.manager){
      html += '<div class="tt-add" style="flex-wrap:wrap;"><input id="ttName" placeholder="'+T('team.name','Naam')+'" style="flex:2;min-width:110px;"><input id="ttFunc" placeholder="'+T('team.func','Functie')+'" style="flex:1;min-width:90px;"><select id="ttRole"><option value="staff">'+T('role.staff','Medewerker')+'</option><option value="manager">'+T('role.manager','Manager')+'</option></select><button id="ttAdd">'+T('team.invite','Nodig uit')+'</button></div>';
      if (lastPin) html += '<div class="tt-pinbox">'+T('team.invintro','Uitnodiging voor')+' '+escT(lastPin.name)+' · '+T('kt.invite.biz','Bedrijfsnaam')+': <b>'+escT(lastPin.bedrijf)+'</b> · '+T('kt.invite.code','Kassacode')+': <b>'+escT(lastPin.kassacode)+'</b><br>'+T('team.invnote','Eenmalige code; aanmelden met eigen RTG-account.')+'</div>';
    }
    html += '</div>';

    // vacatures: het bedrijf plaatst openstaande functies; die verschijnen ook
    // in de RTFoundation zodat leden vanaf 16 jaar met hun cv solliciteren.
    const vacs = state.vacatures || [];
    html += '<div class="card"><div class="tt-h">'+T('vac.h','Vacatures')+' <i style="font-style:normal;font-size:0.58rem;letter-spacing:0.08em;color:#7ecb8f;border:1px solid #7ecb8f;border-radius:999px;padding:0.1rem 0.45rem;vertical-align:middle;">'+T('vac.rtf','ook in RTFoundation')+'</i></div>';
    html += '<div style="font-size:0.78rem;color:var(--soft);margin-bottom:0.6rem;">'+T('vac.intro','Vacatures die je hier plaatst komen ook in de RTFoundation-app. Leden van gezinnen die het minder breed hebben solliciteren er vanaf 16 jaar in een tik op, met hun cv.')+'</div>';
    html += vacs.length ? vacs.map(v =>
      '<div class="tk-row" style="flex-wrap:wrap;'+(v.open?'':'opacity:0.55;')+'"><div class="tk-t"><b>'+esc(v.func)+' <span style="font-weight:400;color:var(--soft);">'+T('vac.soort.'+v.soort, v.soort)+' · '+T('vac.vanaf','vanaf')+' '+v.minLeeftijd+' '+T('vac.jaar','jaar')+'</span></b><span>'+(v.plaats?esc(v.plaats)+' · ':'')+(v.uren?esc(v.uren)+' · ':'')+(v.open?T('vac.open','staat open'):T('vac.dicht','gesloten'))+'</span></div>'+
      (a.manager ? '<button class="obtn" data-vactoggle="'+v.id+'" data-vacnow="'+(v.open?'sluit':'open')+'">'+(v.open?T('vac.sluitbtn','Sluiten'):T('vac.openbtn','Openen'))+'</button><button class="obtn warn" data-vacdel="'+v.id+'">'+T('vac.del','Verwijderen')+'</button>' : '')+
      '</div>'
    ).join('') : '<div style="font-size:0.82rem;color:var(--soft);padding:0.4rem 0;">'+T('vac.geen','Nog geen vacatures. Plaats er een om personeel te vinden via de RTFoundation.')+'</div>';
    if (a.manager){
      html += '<div class="tt-add" style="flex-wrap:wrap;gap:0.4rem;margin-top:0.7rem;">'+
        '<input id="vacFunc" placeholder="'+T('vac.func','Functie (bijv. afwasser)')+'" style="flex:2;min-width:130px;">'+
        '<select id="vacSoort" style="flex:1;min-width:110px;"><option value="bijbaan">'+T('vac.soort.bijbaan','Bijbaan')+'</option><option value="vakantiewerk">'+T('vac.soort.vakantiewerk','Vakantiewerk')+'</option><option value="parttime">'+T('vac.soort.parttime','Parttime')+'</option><option value="fulltime">'+T('vac.soort.fulltime','Fulltime')+'</option><option value="stage">'+T('vac.soort.stage','Stage')+'</option><option value="vrijwilliger">'+T('vac.soort.vrijwilliger','Vrijwilliger')+'</option></select>'+
        '<select id="vacLft" style="flex:1;min-width:90px;"><option value="16">'+T('vac.vanaf','vanaf')+' 16</option><option value="18">'+T('vac.vanaf','vanaf')+' 18</option><option value="21">'+T('vac.vanaf','vanaf')+' 21</option></select>'+
        '<input id="vacPlaats" placeholder="'+T('vac.plaats','Plaats')+'" style="flex:1;min-width:90px;">'+
        '<input id="vacUren" placeholder="'+T('vac.uren','Uren (bijv. 8-16u/week)')+'" style="flex:1;min-width:110px;">'+
        '<input id="vacOms" placeholder="'+T('vac.oms','Korte omschrijving')+'" style="flex:2;min-width:150px;">'+
        '<button id="vacAdd">'+T('vac.plaatsbtn','Vacature plaatsen')+'</button></div>';
    }
    html += '</div>';

    // sollicitaties: overal hetzelfde kanaal, de manager beslist
    const apps = (state.applications || []).filter(x => x.status === 'nieuw');
    const decided = (state.applications || []).filter(x => x.status !== 'nieuw').slice(0, 4);
    html += '<div class="card"><div class="tt-h">'+T('ap.h','Sollicitaties')+(apps.length?' <i class="gc-unread">'+apps.length+'</i>':'')+'</div>';
    const apCv = x => {
      if (!x.viaRTG || !x.cv) return '';
      const c = x.cv, parts = [];
      if (c.headline) parts.push('<b style="color:var(--txt);">'+c.headline+'</b>');
      if (c.experience && c.experience.length) parts.push(c.experience.slice(0,3).join(' · '));
      if (c.skills && c.skills.length) parts.push(T('ap.skills','Vaardigheden')+': '+c.skills.join(', '));
      if (c.languages) parts.push(T('ap.langs','Talen')+': '+c.languages);
      if (!parts.length) return '';
      return '<div style="flex-basis:100%;font-size:0.72rem;color:var(--muted);line-height:1.5;margin-top:0.35rem;background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.7rem;">📄 '+parts.join('<br>')+'</div>';
    };
    html += apps.length ? apps.map(x =>
      '<div class="tk-row" style="flex-wrap:wrap;"><div class="tk-t"><b>'+x.name+' · '+x.func+
      (x.viaRTG?' <i style="font-style:normal;font-size:0.58rem;letter-spacing:0.08em;color:var(--gold);border:1px solid var(--gold);border-radius:999px;padding:0.1rem 0.45rem;vertical-align:middle;">RTG</i>':'')+
      '</b><span>'+x.contact+(x.note?' · "'+x.note.slice(0,60)+'"':'')+' · '+timeAgo(x.at)+'</span></div>'+
      (a.manager ? '<button class="obtn" data-apinvite="'+x.id+'">'+T('ap.invite','Uitnodigen')+'</button><button class="obtn primary" data-aphire="'+x.id+'">'+T('ap.hire','Aannemen')+'</button><button class="obtn warn" data-apno="'+x.id+'">'+T('ap.reject','Afwijzen')+'</button>' : '')+
      apCv(x)+
      '</div>'
    ).join('') : '<div style="font-size:0.82rem;color:var(--soft);padding:0.5rem 0;">'+T('ap.none','Geen open sollicitaties. Kandidaten solliciteren via het startscherm van deze app, RTG-leden via de leden-app met hun cv.')+'</div>';
    html += decided.map(x => {
      const kanChat = x.status === 'uitgenodigd' || x.status === 'aangenomen';
      const stLabel = x.status === 'uitgenodigd' ? T('ap.st.invited','uitgenodigd') : x.status === 'aangenomen' ? T('ap.st.hired','aangenomen') : T('ap.st.rejected','afgewezen');
      return '<div class="tk-row done" style="flex-wrap:wrap;"><div class="tk-t"><b>'+x.name+' · '+x.func+'</b><span>'+stLabel+'</span></div>'+
        (kanChat && a.manager ? '<button class="obtn primary" data-apchat="'+x.id+'" data-apname="'+encodeURIComponent(x.name)+'">💬 '+T('ap.chat','Chat')+'</button>' : '')+'</div>';
    }).join('');
    html += '</div>';

    // de PDA van dit bedrijf: personeel opent met deze link (of QR) meteen
    // het eigen team, zonder sector- en bedrijfskeuze
    html += '<a class="obtn" style="text-decoration:none;display:inline-block;margin:0.2rem 0 0.8rem;" href="/apps/personeel.html?bedrijf='+encodeURIComponent(S.code)+'">👤 '+T('team.pdalink','Personeels-app van dit bedrijf')+'</a>';

    // activiteit
    html += '<div class="card"><div class="tt-h">'+T('team.activity','Wie deed wat')+'</div>';
    html += activity.length ? activity.map(e =>
      '<div class="tt-act"><span class="aw">'+e.who+'</span><span class="ax">'+e.text+'</span><time>'+timeAgo(e.at)+'</time></div>'
    ).join('') : '<div class="softline">'+T('team.noactivity','Nog geen activiteit vastgelegd.')+'</div>';
    html += '</div>';

    // interne chat
    html += '<div class="card"><div class="tt-h" style="margin-bottom:0.6rem;">'+T('team.chat','Interne teamchat')+'</div><div class="tt-chat" id="ttChat">';
    html += team.length ? team.map(m =>
      '<div class="tt-msg '+(m.who===a.name?'me':'other')+'"><span class="who">'+m.who+'</span>'+esc(m.text)+'<time>'+timeAgo(m.at)+'</time></div>'
    ).join('') : '<div style="font-size:0.82rem;color:var(--soft);padding:0.4rem 0;">'+T('team.nochat','Nog geen berichten. Stuur je team een bericht.')+'</div>';
    html += '</div><div class="tt-compose"><input id="ttMsg" placeholder="'+T('team.msgph','Bericht aan het team')+'"><button id="ttSend">'+T('team.send','Stuur')+'</button></div></div>';

    $('#teamWrap').innerHTML = html;

    document.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', ()=>removeStaff(Number(b.dataset.rm))));
    // de interne call en het directe bericht (shared/teamcall.js en collegachat.js)
    document.querySelectorAll('[data-belm]').forEach(b => b.addEventListener('click', () => window.TeamCall && TeamCall.bel(parseInt(b.dataset.belm, 10), b.dataset.naam)));
    document.querySelectorAll('[data-dmm]').forEach(b => b.addEventListener('click', () => window.CollegaChat && CollegaChat.open(parseInt(b.dataset.dmm, 10), b.dataset.naam)));
    if (window.CollegaChat && a.staffId) CollegaChat.badges();
    const tcs = $('#teamCallSup'); if (tcs) tcs.addEventListener('click', () => window.TeamCall && TeamCall.groep());
    const ba = $('#buzzAll'); if (ba) ba.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/team/buzz', { all: true });
        toast('📢 '+T('team.allbuzzed','Hele team opgeroepen')+' ('+d.reached+' '+T('team.online','online')+').'); }
      catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-buzz]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/team/buzz', { staffId: Number(b.dataset.buzz) });
        toast(d.reached ? '📳 '+d.name+' '+T('team.buzzed','wordt opgeroepen.') : d.name+' '+T('team.buzzoff','heeft de app nu niet open.')); }
      catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-aphire]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/apply/decide', { id: b.dataset.aphire, action: 'aannemen' });
        lastPin = { name: d.invite.naam, kassacode: d.invite.kassacode, bedrijf: d.bedrijf };
        toast(T('ap.hired2','Aangenomen. Kassacode: ') + d.invite.kassacode);
        await refresh(); openTab('team');
      } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-apno]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/apply/decide', { id: b.dataset.apno, action: 'afwijzen' }); await refresh(); openTab('team'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-apinvite]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/apply/decide', { id: b.dataset.apinvite, action: 'uitnodigen' });
        toast('💬 '+T('ap.invited','Uitgenodigd. Maak samen een afspraak in de chat.'));
        await refresh(); openTab('team'); openApChat(b.dataset.apinvite, d.chat && d.chat.metWie); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-apchat]').forEach(b => b.addEventListener('click', () => openApChat(b.dataset.apchat, decodeURIComponent(b.dataset.apname||''))));
    const vacAdd = $('#vacAdd'); if (vacAdd) vacAdd.addEventListener('click', async () => {
      const func = $('#vacFunc').value.trim();
      if (!func) { toast(T('vac.needfunc','Geef de functie een naam.')); return; }
      try {
        await API.call('/supplier/vacature', {
          func, soort: $('#vacSoort').value, minLeeftijd: Number($('#vacLft').value),
          plaats: $('#vacPlaats').value.trim(), uren: $('#vacUren').value.trim(), omschrijving: $('#vacOms').value.trim()
        });
        toast('✅ '+T('vac.geplaatst','Vacature geplaatst en zichtbaar in de RTFoundation.'));
        await refresh(); openTab('team');
      } catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-vactoggle]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/vacature/verwijder', { id: b.dataset.vactoggle, action: b.dataset.vacnow }); await refresh(); openTab('team'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vacdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/vacature/verwijder', { id: b.dataset.vacdel }); await refresh(); openTab('team'); } catch(e){ toast(e.message); }
    }));
    const addBtn = $('#ttAdd'); if (addBtn) addBtn.addEventListener('click', addStaff);
    const send = $('#ttSend'); if (send) send.addEventListener('click', sendTeam);
    const msg = $('#ttMsg'); if (msg) msg.addEventListener('keydown', e => { if (e.key==='Enter') sendTeam(); });
    const chat = $('#ttChat'); if (chat) chat.scrollTop = chat.scrollHeight;
  }

  // ---- opgeroepen worden: trilscherm ----
  function showBuzz(from){
    if (navigator.vibrate) navigator.vibrate([300,120,300,120,600]);
    let el = document.getElementById('buzzOverlay');
    if (!el){
      el = document.createElement('div');
      el.id = 'buzzOverlay';
      document.getElementById('shell').appendChild(el);
      el.addEventListener('click', () => el.classList.remove('on'));
    }
    el.innerHTML = '<div class="bz"><div class="bz-ic">📳</div><b>'+esc(from)+'</b><span>'+T('buzz.calls','roept u op')+'</span><i>'+T('buzz.close','Tik om te bevestigen')+'</i></div>';
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 8000);
  }

  // security-alarm: schermvullend, met locatie
  function showAlarm(d){
    if (navigator.vibrate) navigator.vibrate([500,150,500,150,800]);
    let el = document.getElementById('alarmOverlay');
    if (!el){
      el = document.createElement('div');
      el.id = 'alarmOverlay';
      document.getElementById('shell').appendChild(el);
      el.addEventListener('click', () => el.classList.remove('on'));
    }
    const locTxt = d.loc ? (d.label ? d.label + ' · ' : '') + d.loc.lat.toFixed(4) + ', ' + d.loc.lng.toFixed(4) : T('alarm.noloc','locatie onbekend');
    el.innerHTML = '<div class="bz"><div class="bz-ic">🚨</div><b>'+esc(d.from)+'</b><span>'+(d.note?esc(d.note):T('alarm.needs','heeft direct assistentie nodig'))+'</span>'+
      '<span style="margin-top:0.6rem;font-size:0.8rem;">📍 '+esc(locTxt)+'</span><i>'+T('buzz.close','Tik om te bevestigen')+'</i></div>';
    el.classList.add('on');
  }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escAttr(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  async function addStaff(){
    const name = ($('#ttName').value||'').trim();
    const func = ($('#ttFunc') && $('#ttFunc').value || '').trim();
    const role = $('#ttRole').value;
    try {
      const d = await API.call('/supplier/staff/invite', { name, func, role });
      lastPin = { name: d.invite.naam || name || T('kt.staff','Medewerker'), kassacode: d.invite.kassacode, bedrijf: d.bedrijf };
      toast(T('team.invited','Uitnodiging gemaakt. Kassacode: ')+d.invite.kassacode);
      await refresh(); openTab('team');
    } catch(e){ toast(e.message); }
  }
  async function removeStaff(id){
    try { await API.call('/supplier/staff/remove', { staffId: id }); toast(T('team.removed','Verwijderd uit het team.')); await refresh(); openTab('team'); }
    catch(e){ toast(e.message); }
  }
  async function sendTeam(){
    const el = $('#ttMsg'); const text = (el.value||'').trim();
    if (!text) return;
    el.value = '';
    try { await API.call('/supplier/team/message', { text }); await refresh(); openTab('team'); }
    catch(e){ toast(e.message); }
  }

  /* ---- Borden: het gedeelde werkbord van de zaak (shared/borden.js) ----
     Dezelfde module draait ook in de PDA en de Business Pass, zodat het bord
     overal identiek werkt. */
  let bordenUI = null;
  function renderBorden(){
    const wrap = $('#bordenWrap');
    if (!wrap || !window.BordenUI) return;
    if (bordenUI) { bordenUI.refresh(); return; }
    bordenUI = BordenUI.mount(wrap, {
      laad: () => API.call('/supplier/borden'),
      doe: b => API.call('/supplier/bord', b),
      teamleden: () => (state && state.staff || []).map(m => ({ id: m.id, name: m.name })),
      kanBeheren: () => { const a = actor(); return !!(a.manager || a.role === 'manager' || !a.staffId); },
      T, toast
    });
  }

  /* ---- Reviews & reputatie: reageren op elke gastreview, met AI-concept ---- */
  function renderReviews(){
    const el = $('#reviewsWrap'); if (!el) return;
    const rating = state && state.reviews && state.reviews.rating;
    const revs = (state && state.reviews && state.reviews.recent) || [];
    let h = '<div class="card"><div class="tt-h">⭐ '+T('rev2.score','Uw reputatie')+'</div>'+
      '<div style="margin-top:0.4rem;font-size:1.4rem;font-family:\'Bodoni Moda\',serif;">'+
      (rating ? rating.score+' <span style="font-size:0.8rem;color:var(--soft);">/ 5 · '+rating.aantal+' '+T('rev2.stuks','review(s)')+'</span>' : T('rev2.geen','Nog geen reviews'))+'</div>'+
      '<div class="softline" style="margin-top:0.3rem;">'+T('rev2.deck','Een snel, persoonlijk antwoord weegt zwaar: gasten lezen mee, en de schrijver krijgt uw reactie direct als melding.')+'</div></div>';
    h += revs.length ? revs.map(r =>
      '<div class="card">'+
      '<div class="tt-top" style="display:flex;justify-content:space-between;gap:0.5rem;"><b>'+'⭐'.repeat(r.score)+'<span style="opacity:0.25;">'+'⭐'.repeat(5-r.score)+'</span> · '+esc(r.codename||'gast')+'</b><time style="color:var(--soft);font-size:0.7rem;">'+timeAgo(r.at)+'</time></div>'+
      (r.tekst ? '<div style="margin-top:0.35rem;font-size:0.86rem;">'+esc(r.tekst)+'</div>' : '')+
      (r.reactie
        ? '<div style="margin-top:0.5rem;border-left:3px solid var(--gold);padding:0.4rem 0.7rem;font-size:0.82rem;"><b style="color:var(--gold);">'+T('rev2.uw','Uw reactie')+'</b> · '+timeAgo(r.reactie.at)+'<br>'+esc(r.reactie.tekst)+'</div>'
        : '<div class="tt-compose" style="margin-top:0.5rem;"><input id="rv-'+r.id+'" placeholder="'+T('rev2.ph','Schrijf een persoonlijke reactie...')+'">'+
          '<button class="obtn ghost" data-rvai="'+r.id+'">✨</button><button data-rvsend="'+r.id+'">'+T('team.send','Stuur')+'</button></div>')+
      '</div>').join('')
      : '<div class="card softline">'+T('rev2.leeg','Nog geen reviews. Na elke afgeronde dienst kan de gast er een achterlaten.')+'</div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-rvai]').forEach(b => b.addEventListener('click', async () => {
      b.textContent = '…';
      try { const d = await API.call('/supplier/review/concept', { id: b.dataset.rvai }); const inp = $('#rv-'+b.dataset.rvai); if (inp) inp.value = d.concept; }
      catch(e){ toast(e.message); }
      b.textContent = '✨';
    }));
    el.querySelectorAll('[data-rvsend]').forEach(b => b.addEventListener('click', async () => {
      const inp = $('#rv-'+b.dataset.rvsend);
      if (!inp || !inp.value.trim()) return;
      try { await API.call('/supplier/review/reageer', { id: b.dataset.rvsend, tekst: inp.value.trim() }); toast('💬 '+T('rev2.ok','Reactie geplaatst; de gast krijgt een melding.')); await refresh(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---- Voorraad: de lichte inventaris, iedereen telt mee ---- */
  // het keukenbrein: voorraad met waarde, recepten met marge, telling,
  // verspilling, levering en het inkoopadvies (server: kern/keuken.js)
  async function renderVoorraad(){
    const el = $('#voorraadWrap'); if (!el) return;
    let d; try { d = await API.call('/supplier/keuken'); } catch(e){ return; }
    let ma = null; try { ma = await API.call('/supplier/keuken/menu-analyse'); } catch(e){}
    const vs = d.artikelen || [];
    const mgr = (() => { const a = actor(); return !!(a.manager || a.role === 'manager' || !a.staffId); })();
    const geld = x => '€ ' + (Number(x)||0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let h = '<div class="card"><div class="st-row"><span>'+T('vr.waarde','Voorraadwaarde')+'</span><b>'+geld(d.totaalWaarde)+'</b></div>'+
      '<div class="st-row"><span>'+T('vr.onder','Onder minimum')+'</span><b'+(d.onderMinimum?' style="color:#FF8589;"':'')+'>'+d.onderMinimum+'</b></div></div>';
    // het inkoopadvies: aanvullen tot twee keer het minimum
    if ((d.advies||[]).length) h += '<div class="card" style="border-left:4px solid var(--gold,#A98F1C);"><div class="tt-h">🛒 '+T('vr.advies','Inkoopadvies')+'</div>'+
      d.advies.map(a => '<div class="st-row"><span>'+esc(a.naam)+' <span class="sub">'+a.aantal+' '+esc(a.eenheid)+', min '+a.min+'</span></span><b>+ '+a.advies+' '+esc(a.eenheid)+(a.kosten?' <span class="sub">'+geld(a.kosten)+'</span>':'')+'</b></div>').join('')+
      (mgr?'<button class="bigbtn" id="vrBestel" style="margin-top:0.5rem;">🛒 '+T('vr.bestel','Bestel dit advies bij de groothandel')+'</button>':'')+
      '<div class="softline" style="margin-top:0.3rem;">'+T('vr.advies.s','Geleverd = automatisch bijgeboekt, met de inkoopprijs als nieuwe kostprijs.')+'</div></div>';
    // de artikelen zelf, met kostprijs en de vloerhandelingen
    h += '<div class="card">'+(vs.length ? vs.map(v =>
      '<div class="st-row" style="align-items:center;"><span'+(v.min>0&&v.aantal<=v.min?' style="color:#FF8589;"':'')+'>'+esc(v.naam)+
        '<span class="sub">min '+v.min+(v.kostprijs?' · '+geld(v.kostprijs)+'/'+esc(v.eenheid):'')+(v.waarde?' · '+T('vr.wrd','waarde')+' '+geld(v.waarde):'')+'</span></span>'+
      '<span style="display:flex;gap:0.35rem;align-items:center;flex-shrink:0;">'+
        '<b style="min-width:3.6rem;text-align:center;">'+v.aantal+' '+esc(v.eenheid)+'</b>'+
        '<button class="obtn ghost" data-vtel="'+v.id+'" title="'+T('vr.tel','Telling')+'">🧮</button>'+
        '<button class="obtn ghost" data-vderf="'+v.id+'" title="'+T('vr.derf','Verspilling')+'">♻</button>'+
        (mgr?'<button class="obtn ghost" data-vlev="'+v.id+'" title="'+T('vr.lev','Levering')+'">🚚</button><button class="obtn warn" data-vweg="'+v.id+'">🗑</button>':'')+'</span></div>').join('')
      : '<div class="softline">'+T('vr.leeg','Nog geen voorraaditems. Het management zet hieronder de lijst op.')+'</div>')+'</div>';
    // recepten en marge per gerecht: dit maakt de afboeking automatisch
    const rec = (d.recepten||[]);
    if (rec.length) h += '<div class="card"><div class="tt-h">📖 '+T('vr.recepten','Recepten en marge')+'</div>'+
      rec.map(r => '<div style="border-bottom:1px solid var(--line);padding:0.4rem 0;">'+
        '<div class="st-row"><span><b>'+esc(r.naam)+'</b> <span class="sub">'+geld(r.prijs)+(r.regels.length?' · '+T('vr.kost','kost')+' '+geld(r.kostprijs)+' · '+T('vr.marge','marge')+' '+geld(r.marge)+(r.margePct!=null?' ('+r.margePct+'%)':''):'')+'</span></span>'+
        (mgr?'<button class="obtn ghost" data-vrec="'+r.id+'">'+(r.regels.length?T('vr.rbew','Recept'):T('vr.rzet','+ Recept'))+'</button>':'')+'</div>'+
        (r.regels.length?'<div class="sub">'+r.regels.map(x=>x.hoeveelheid+' '+esc(x.eenheid)+' '+esc(x.naam)).join(' · ')+'</div>':'')+
        '</div>').join('')+
      '<div class="softline" style="margin-top:0.3rem;">'+T('vr.rec.s','Elke kassabon en betaalde bestelling boekt de ingredienten automatisch af via het recept.')+'</div></div>';
    // menu-engineering: volume maal marge, in de klassieke kwadranten
    if (ma && (ma.rijen||[]).some(r => r.verkocht > 0 || r.heeftRecept)){
      const KLASSE = { ster: ['⭐', '#D8B940'], werkpaard: ['🐴', '#69B98B'], puzzel: ['🧩', '#7FA6D9'], hond: ['🐕', '#FF8589'], onbekend: ['·', 'var(--soft)'] };
      h += '<div class="card"><div class="tt-h">📊 '+T('vr.me','Menu-engineering')+' <span class="sub">('+ma.dagen+' '+T('vr.dagen','dagen')+')</span></div>'+
        ma.rijen.map(r => '<div style="border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
          '<div class="st-row"><span><b style="color:'+KLASSE[r.klasse][1]+';">'+KLASSE[r.klasse][0]+' '+esc(r.klasse)+'</b> '+esc(r.naam)+'</span>'+
          '<span class="sub">'+r.verkocht+'× · '+T('vr.marge','marge')+' '+geld(r.marge)+' · '+T('vr.winst','winst')+' '+geld(r.brutowinst)+'</span></div>'+
          '<div class="sub">'+esc(r.advies)+'</div></div>').join('')+
        (mgr?'<button class="bigbtn" id="vrPlan" style="margin-top:0.5rem;">🧠 '+T('vr.plan','Vraag het actieplan')+'</button><div id="vrPlanUit"></div>':'')+'</div>';
    }
    // het logboek: elke beweging herleidbaar
    if ((d.logboek||[]).length) h += '<div class="card"><div class="tt-h">🧾 '+T('vr.log','Laatste bewegingen')+'</div>'+
      d.logboek.slice(0,8).map(l => '<div class="st-row"><span>'+esc(l.artikel)+' <span class="sub">'+esc(l.soort)+' · '+esc(l.oms||'')+' · '+esc(l.wie||'')+'</span></span><b'+(l.delta<0?' style="color:#FF8589;"':' style="color:#69B98B;"')+'>'+(l.delta>0?'+':'')+l.delta+'</b></div>').join('')+'</div>';
    if (mgr) h += '<div class="card"><div class="tt-h">'+T('vr.nieuw','Nieuw item')+'</div>'+
      '<div class="row-gap" style="margin-top:0.5rem;"><input class="st-in" id="vrNaam" placeholder="'+T('vr.naam','Naam, bijv. Cava brut')+'" style="flex:2;">'+
      '<input class="st-in" id="vrAantal" type="number" min="0" placeholder="'+T('vr.aantal','aantal')+'" style="flex:1;">'+
      '<input class="st-in" id="vrMin" type="number" min="0" placeholder="'+T('vr.mindr','min.')+'" style="flex:1;">'+
      '<input class="st-in" id="vrEenheid" placeholder="'+T('vr.eenheid','eenheid (fles, kg...)')+'" style="flex:1;">'+
      '<input class="st-in" id="vrKost" type="number" min="0" step="0.01" placeholder="'+T('vr.kostph','€/eenheid')+'" style="flex:1;"></div>'+
      '<button class="bigbtn" id="vrAdd" style="margin-top:0.5rem;">'+T('vr.voeg','Zet op de lijst')+'</button></div>';
    el.innerHTML = h;
    const doe = async (pad, body) => { try { await API.call(pad, body); renderVoorraad(); } catch(e){ toast(e.message); } };
    // een knop: het advies wordt een echte groothandelsbestelling
    const vb = el.querySelector('#vrBestel'); if (vb) vb.addEventListener('click', async () => {
      try {
        const markt = await API.call('/supplier/inkoop/markt', {});
        const ghs = markt.groothandels || [];
        if (!ghs.length){ toast(T('vr.geengh','Er is nog geen groothandel actief op het platform.')); return; }
        let code = ghs[0].code;
        if (ghs.length > 1){
          const keuze = prompt(T('vr.welkegh','Welke groothandel? ') + ghs.map(g=>g.code+' ('+g.naam+')').join(', '), code);
          if (!keuze) return;
          code = keuze.trim().toUpperCase();
        }
        const r = await API.call('/supplier/keuken/bestel-advies', { groothandelCode: code });
        toast('🛒 '+T('vr.besteld','Bestelling ')+r.order.ref+' '+T('vr.besteld2','geplaatst.')+(r.nietGevonden.length?' '+T('vr.nietgev','Niet in het assortiment: ')+r.nietGevonden.join(', '):''));
        renderVoorraad();
      } catch(e){ toast(e.message); }
    });
    // het actieplan van de chef-adviseur: kwadranten plus derving, in euro's
    const vp = el.querySelector('#vrPlan'); if (vp) vp.addEventListener('click', async () => {
      const uit = el.querySelector('#vrPlanUit');
      uit.innerHTML = '<div class="softline" style="margin-top:0.4rem;">'+T('vr.plan.laden','De adviseur rekent...')+'</div>';
      try {
        const p = await API.call('/supplier/keuken/menu-advies', {});
        uit.innerHTML = '<div class="sub" style="margin-top:0.5rem;">'+esc(p.samenvatting)+'</div>'+
          (p.acties||[]).map(x => '<div style="border-top:1px solid var(--line);padding:0.35rem 0;font-size:0.82rem;">'+
            (x.impact?'<b style="color:var(--gold);">'+geld(x.impact)+'</b> · ':'')+esc(x.tekst)+'</div>').join('');
      } catch(e){ uit.innerHTML = ''; toast(e.message); }
    });
    el.querySelectorAll('[data-vtel]').forEach(b => b.addEventListener('click', () => {
      const g = prompt(T('vr.telvraag','Wat is de getelde stand?')); if (g == null || g === '') return;
      doe('/supplier/keuken/telling', { artikelId: b.dataset.vtel, geteld: Number(String(g).replace(',', '.')) });
    }));
    el.querySelectorAll('[data-vderf]').forEach(b => b.addEventListener('click', () => {
      const hv = prompt(T('vr.derfvraag','Hoeveel is er weg (breuk, derving)?')); if (hv == null || hv === '') return;
      const reden = prompt(T('vr.derfreden','Reden?')) || '';
      doe('/supplier/keuken/verspilling', { artikelId: b.dataset.vderf, hoeveelheid: Number(String(hv).replace(',', '.')), reden });
    }));
    el.querySelectorAll('[data-vlev]').forEach(b => b.addEventListener('click', () => {
      const hv = prompt(T('vr.levvraag','Hoeveel is er geleverd?')); if (hv == null || hv === '') return;
      const k = prompt(T('vr.levkost','Inkoopprijs per eenheid in euro (leeg = ongewijzigd)?'));
      doe('/supplier/keuken/levering', { artikelId: b.dataset.vlev, hoeveelheid: Number(String(hv).replace(',', '.')), kostprijs: k ? Number(String(k).replace(',', '.')) : undefined });
    }));
    el.querySelectorAll('[data-vweg]').forEach(b => b.addEventListener('click', () => doe('/supplier/voorraad/zet', { id: b.dataset.vweg, weg: true })));
    el.querySelectorAll('[data-vrec]').forEach(b => b.addEventListener('click', () => {
      const r = rec.find(x => x.id === b.dataset.vrec); if (!r) return;
      // compact recept-bewerken: "hoeveelheid x artikelnaam" per regel
      const huidig = r.regels.map(x => x.hoeveelheid + ' x ' + x.naam).join('\n');
      const inp = prompt(T('vr.recvraag','Recept voor ') + r.naam + T('vr.recuitleg',': per regel "hoeveelheid x artikelnaam", bijv. "0.2 x Lamsrack".'), huidig);
      if (inp == null) return;
      const regels = inp.split('\n').map(x => {
        const m = /^\s*([\d.,]+)\s*[xX]\s*(.+)$/.exec(x); if (!m) return null;
        const a = vs.find(v => v.naam.toLowerCase() === m[2].trim().toLowerCase());
        return a ? { artikelId: a.id, hoeveelheid: Number(m[1].replace(',', '.')) } : null;
      }).filter(Boolean);
      doe('/supplier/keuken/recept', { menuItemId: r.id, regels });
    }));
    const va = $('#vrAdd'); if (va) va.addEventListener('click', async () => {
      const naam = $('#vrNaam').value.trim(); if (!naam) return;
      try {
        await API.call('/supplier/voorraad/zet', { naam, aantal: Number($('#vrAantal').value)||0, min: Number($('#vrMin').value)||0, eenheid: $('#vrEenheid').value.trim(), kostprijs: Number(String($('#vrKost').value).replace(',', '.'))||0 });
        renderVoorraad();
      } catch(e){ toast(e.message); }
    });
  }

  // ---- meldingen ----
  function renderBell(){
    const unread = notifs.filter(n=>!n.read).length;
    const b = $('#bellBadge'); b.style.display = unread>0?'flex':'none'; b.textContent = unread>9?'9+':unread;
    $('#notifList').innerHTML = notifs.length ? notifs.map(n =>
      '<div class="notif-item'+(n.read?'':' unread')+'"><div class="ic">'+(n.icon||'•')+'</div><div class="tx"><b>'+n.title+'</b><span>'+n.body+'</span><time>'+timeAgo(n.at)+'</time></div></div>'
    ).join('') : '<div class="empty">'+T('sup.nonotif','Nog geen meldingen. Nieuwe bestellingen en betalingen ziet u hier live.')+'</div>';
  }
  async function loadNotifs(){ try { const d = await API.call('/supplier/notifications', {}); } catch(e){} }
  $('#bell').addEventListener('click', () => { $('#notifPanel').classList.add('open'); $('#notifScrim').classList.add('open'); if (notifs.some(n=>!n.read)){ notifs.forEach(n=>n.read=true); API.call('/supplier/notifications/read').catch(()=>{}); renderBell(); } });
  $('#notifClose').addEventListener('click', () => { $('#notifPanel').classList.remove('open'); $('#notifScrim').classList.remove('open'); });
  $('#notifScrim').addEventListener('click', () => { $('#notifPanel').classList.remove('open'); $('#notifScrim').classList.remove('open'); });

  // ---- live stream ----
  function startStream(){
    if (!window.EventSource) return;
    // de interne call en het directe bericht draaien op dezelfde stroom
    if (window.TeamCall) TeamCall.init({ API, mij: () => { const a = actor(); return a.staffId ? { staffId: a.staffId, name: a.name } : null; }, T, toast });
    if (window.CollegaChat) CollegaChat.init({ API, mij: () => ({ staffId: actor().staffId, name: actor().name }), T, toast });
    try { source = new EventSource('/api/supplier/stream?token='+encodeURIComponent(API.token)); } catch(e){ return; }
    source.addEventListener('hello', e => { const d=JSON.parse(e.data); notifs = d.unread||[]; renderBell(); });
    source.addEventListener('buzz', e => { const d=JSON.parse(e.data); showBuzz(d.from); });
    source.addEventListener('alarm', e => { const d=JSON.parse(e.data); showAlarm(d); });
    source.addEventListener('rtc', e => { if (window.TeamCall) TeamCall.event(e); });
    source.addEventListener('dm', e => { if (window.CollegaChat) CollegaChat.event(e); });
    source.addEventListener('sync', e => { refresh(); if (has('retail') && retailData) laadRetail(); if (has('retail') && wvRetail) laadWinkelvloer(); if (has('care') && zbLev) laadZorgbalieLev(); if (has('charter') && charters !== null) laadCharters(); if (paspoortData) laadPaspoort(); if (has('boerderij') && boer) laadBoerderij(); if (has('creator') && cr) laadCreator(); if (sw) laadSamenwerking(); if (fact) laadFacturen(); laadAgendaSup(); });
    // de keuken praat met de bediening: bon compleet op de pas -> belletje op
    // elk open scherm van de zaak (bedieningspost, kassa, kantoor)
    source.addEventListener('pas', e => {
      try {
        const d = JSON.parse(e.data || '{}');
        toast('🛎️ ' + T('pas.klaar', 'Op de pas: bon ') + d.pickup + (d.table ? ' (' + d.table + ')' : ''));
      } catch(err){}
    });
    source.addEventListener('notify', e => {
      const n = JSON.parse(e.data); notifs.unshift(n); renderBell();
      if ('Notification' in window && Notification.permission==='granted'){ try{ new Notification(n.title,{body:n.body,icon:'icon.svg',tag:n.id}); }catch(_){} }
      toast(n.title + ', ' + n.body);
      refresh();
    });
  }

  window.addEventListener('rtglang', () => {
    if (!S) return;
    const active = (document.querySelector('.tabbar button.active') || {}).dataset ? document.querySelector('.tabbar button.active').dataset.tab : 'home';
    buildTabs(); renderAll(); openTab(active || 'home');
  });

  $('#actorChip').addEventListener('click', switchUser);
  $('#aiSend').addEventListener('click', sendAI);
  $('#aiInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendAI(); });
  renderAIThread();
  buildPad();
  renderGate();
  // het Werk-OS: springboard, dock, klok en Cmd+K over het bestaande tabmodel
  if (window.WerkOS) WerkOS.koppel({
    thuisTab: 'home', dock: ['orders', 'kassa', 'menu', 'ai', 'team'],
    // het Meer-grid waaiert uit over het springboard: alle functies als apps
    verberg: ['meer'], extra: { houder: '#meerWrap', knop: '.meer-btn' }
  });
  restoreSession();
  if ('serviceWorker' in navigator && (location.protocol==='http:'||location.protocol==='https:')) navigator.serviceWorker.register('/sw.js').catch(()=>{});
})();
