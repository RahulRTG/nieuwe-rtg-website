  /* ---------- pas-thema (kleuren van de website) ----------
     RTG krijgt het bordeauxrode thema, Lifestyle het parelmoeren thema,
     Business blijft klassiek donker. RTG en Lifestyle mogen terug naar
     klassiek; die keuze onthouden we per pas in localStorage. */
  // Het ROS-thema (Champagne=parelmoer, Donker=standaard, Bordeaux) is een keuze
  // voor IEDEREEN, per apparaat onthouden. Zonder eigen keuze heeft elke pas zijn
  // eigen standaard: RTG bordeaux (de huiskleur), Lifestyle champagne, Business
  // zwart. Wie geen pas heeft (bv. de poort) valt terug op bordeaux (rood).
  const THEMA_STANDAARD = { rtg: 'bordeaux', lifestyle: 'parelmoer', business: 'standaard' };
  function pasThemaKey(){ return 'rtg_ros_thema'; }
  function pasThemaHuidig(){
    let t = null; try { t = localStorage.getItem(pasThemaKey()); } catch(e){}
    if (t === 'standaard' || t === 'bordeaux' || t === 'parelmoer') return t;
    return THEMA_STANDAARD[vastePas] || 'bordeaux';
  }
  function pasThemaToepassen(){
    const t = pasThemaHuidig();
    const el = document.documentElement;
    if (t === 'standaard') el.removeAttribute('data-pas-thema');
    else el.setAttribute('data-pas-thema', t);
    // de systeem-themakleur (statusbalk) meelaten kleuren
    const kleur = { bordeaux: '#1E0912', parelmoer: '#ECE6DD' }[t] || '#0C0C0B';
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', kleur);
    // de levende grond de nieuwe familie laten oppakken (donker/champagne/bordeaux)
    if (window.RTGLevend) RTGLevend.familie();
  }
  function pasThemaZet(t){
    try { localStorage.setItem(pasThemaKey(), t); } catch(e){}
    pasThemaToepassen();
  }
  // meteen toepassen, ook op het beginscherm
  pasThemaToepassen();
  // seam voor de OS-schil (bedieningspaneel): thema lezen/zetten zonder de
  // logica hierboven te dupliceren. Iedereen mag kiezen.
  window.RTGOSThema = { huidig: pasThemaHuidig, zet: pasThemaZet, keuzeMogelijk: () => true };

  /* DE PAS AANNEMEN ZONDER HERLADEN. Een kale /apps/app.html (zonder ?pas=) is
     de deur waar bijna elk scherm naar terugwijst. Tot hier herlaadde de
     werktafel zich daar met location.replace(pasAdres(...)) zodra de sessie
     haar pas prijsgaf: de hele stapel twee keer, en elk API-verzoek van het
     opstarten dubbel (SCHILHERSTART.json, de eerste stap). De voorschotregel in
     de kop van app.html vangt dat alleen op als de pas al eens is onthouden;
     de eerste keer, en na een inlog, ging de herlading gewoon door.

     Zonder ?pas= is er nog niets gekozen dat een herlading nodig maakt: de
     pagina draagt dan de kale kop (titel 'RTG, log in', geen manifest) en
     verder dezelfde bundel. Dus: zet het adres goed met replaceState en neem
     de pas in DIT document aan -- vastePas, titel, manifest, icoon en het
     pas-thema (app-main-02b.js), precies wat de pas-tak hierboven bij een
     herlading had gezet. Staat er WEL een ?pas= die niet klopt, dan is dit de
     app van een andere pas en blijft de omleiding via pasAdres zoals hij was.
     test/werktafel-pas.e2e.js houdt vast dat het adres daarna op de pas van
     de sessie staat en het geheugen klopt. */
  function neemPasAan(doelPas){
    vastePas = doelPas;
    history.replaceState(history.state, '', pasAdres(doelPas));
    document.title = { rtg:'RTG Pass', lifestyle:'RTG Lifestyle Pass', business:'RTG Business Pass' }[doelPas];
    let ml = document.getElementById('manifestLink');
    if (!ml){ ml = document.createElement('link'); ml.id = 'manifestLink'; ml.rel = 'manifest'; document.head.appendChild(ml); }
    ml.href = '/manifests/pas-' + doelPas + '.webmanifest';
    const tl = document.getElementById('touchLink');
    if (tl) tl.href = '/icons/pas-' + doelPas + '-192.png';
    if (typeof pasThemaToepassen === 'function') pasThemaToepassen();
  }

  /* ---------- de stem van de pas (tone of voice) ----------
     Dezelfde vriend als op de website, maar in de taal van de pas:
     RTG (65 euro per maand) praat als de jetset-vriend (je), Business
     zakelijker en strakker, Lifestyle (20.000 per maand ex btw) als de
     concierge (u). De kleuren van de pas blijven ongemoeid; alleen de
     woorden draaien mee. In het Engels wint de i18n-laag: dan doet
     stem() niets en blijven de vertaalde teksten staan. */
  function pasStem(){
    const s = document.documentElement.getAttribute('data-stem') || vastePas;
    return s === 'lifestyle' || s === 'business' ? s : 'rtg';
  }
  function stem(rtg, business, lifestyle){
    if (lang() === 'en') return null;
