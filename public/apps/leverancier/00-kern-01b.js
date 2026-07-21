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
    beautysalon: { label:'RTG Beauty & Barbier', labelEn:'RTG Beauty & Barber', codes:['VELVET'], icon:'✂️' },
    petcare:     { label:'RTG Petcare', labelEn:'RTG Petcare', codes:['AMICS'], icon:'🐾' },
    kinderopvang: { label:'RTG Kinderopvang & Nanny', labelEn:'RTG Childcare & Nanny', codes:['NIDO'], icon:'🧸' },
    marina:      { label:'RTG Marina', labelEn:'RTG Marina', codes:['PORTELL'], icon:'⚓' },
    weddingplanner: { label:'RTG Weddings & Events', labelEn:'RTG Weddings & Events', codes:['AURELIA'], icon:'💐' },
    professioneel: { label:'RTG Professionele Diensten', labelEn:'RTG Professional Services', codes:['LEXNOVA'], icon:'⚖️' },
    verzekeringen: { label:'RTG Verzekeringsadvies', labelEn:'RTG Insurance Advice', codes:['SEGUR'], icon:'🛡️' },
    wintersport: { label:'RTG Alpine', labelEn:'RTG Alpine', codes:['VALAURA'], icon:'⛷️' },
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

