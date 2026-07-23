    if (state.myApplications) myApps = state.myApplications;
    if (state.foundation) rtf = state.foundation;
  }

  // verse state van de server (bijv. na volgen, claimen of stemmen op De Salon)
  async function refreshState(){
    try { applyState((await API.call('/state')).state); } catch(e){}
  }

  let toastTimer;
  function toast(msg){
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
  }

  function canEngage(p){
    if (typeof p.canEngage === 'boolean') return p.canEngage;
    if (user.tier === 'rtg') return p.tier === 'rtg';
    return true;
  }

  /* ---------- login & tabs ---------- */

  // De gratis (bestel/betaal) laag is alleen te gebruiken na registratie met een
  // paspoort. De gratis-knop opent daarom het registratieformulier, niet een
  // anonieme sessie. De betaalde passen (demo) loggen wel direct in.
  let regTier = 'rtg';
  function updateRegKop(){
    const el = $('#regKop'); if (!el) return;
    el.textContent = regTier === 'guest'
      ? T('gate.reg.free','Gratis account met paspoort: bestel en betaal bij partners, bekijk De Salon en solliciteer. Geen betaalde pas.')
      : T('gate.reg.paid','Maak uw RTG-account aan. Aanmelden gebeurt met uw paspoort (geboortedatum).');
    const btn = $('#regForm button[type="submit"]');
    if (btn) btn.textContent = regTier === 'guest' ? T('gate.reg.freebtn','Gratis account aanmaken') : T('gate.createacc','Account aanmaken');
  }
  document.querySelectorAll('[data-login]').forEach(b =>
    b.addEventListener('click', () => {
      if (b.dataset.login === 'guest'){ regTier = 'guest'; showGateForm('register'); updateRegKop(); }
      else login(b.dataset.login);
    }));

  /* ---------- eigen app per pas, geen brede app ----------
     Elke betaalde pas heeft zijn eigen ingang (pas-rtg/lifestyle/business.html)
     die hier binnenkomt met ?pas=. Dan wordt dit DE app van die pas: het
     manifest (eigen naam en icoon op het beginscherm) wisselt mee, de poort
     toont alleen de eigen ingang, en de server weigert inloggegevens van een
     andere pas. De gratis laag heeft GEEN eigen app: die speelt mee in de
     RTG-app, met minder functies. ZONDER ?pas= bestaat er geen brede app
     meer: dan is dit alleen een keuzescherm dat naar de pas-apps verwijst. */
  const zoekParams = new URLSearchParams(location.search);
  let vastePas = zoekParams.get('pas');
  if (vastePas === 'guest') vastePas = 'rtg'; // gratis speelt in de RTG-app
  if (!['rtg','lifestyle','business'].includes(vastePas)) vastePas = null;
  // vangnet voor oude e-maillinks zonder pas: die landen in de RTG-app
  if (!vastePas && (zoekParams.get('verify') || zoekParams.get('reset'))) vastePas = 'rtg';
  if (vastePas){
    const ml = document.getElementById('manifestLink');
    if (ml) ml.href = '/manifests/pas-' + vastePas + '.webmanifest';
    const tl = document.getElementById('touchLink');
    if (tl) tl.href = '/icons/pas-' + vastePas + '-192.png';
    document.title = { rtg:'RTG Pass', lifestyle:'RTG Lifestyle Pass', business:'RTG Business Pass' }[vastePas];
    // in de RTG-app mag ook de gratis ingang (minder functies); elders alleen de eigen pas
    const mag = vastePas === 'rtg' ? ['rtg','guest'] : [vastePas];
    document.querySelectorAll('[data-login]').forEach(b => { if (!mag.includes(b.dataset.login)) b.style.display = 'none'; });
    regTier = vastePas;
  } else {

    // de ene poort: het scherm blijft kaal (alleen inloggen, aanmelden en
    // wachtwoord vergeten). Log in en uw account opent vanzelf de juiste
    // pas-app (RTG, Lifestyle of Business); aanmelden maakt een RTG-account.
    document.title = 'RTG, log in';
    const ml = document.getElementById('manifestLink');
    if (ml) ml.remove(); // een keuzescherm installeer je niet als app
    regTier = 'rtg';
  }

  /* ---------- pas-thema (kleuren van de website) ----------
     RTG krijgt het bordeauxrode thema, Lifestyle het parelmoeren thema,
     Business blijft klassiek donker. RTG en Lifestyle mogen terug naar
     klassiek; die keuze onthouden we per pas in localStorage. */
  // Het ROS-thema (Champagne=parelmoer, Donker=standaard, Bordeaux) is een keuze
  // voor IEDEREEN, per apparaat onthouden. Zonder eigen keuze is Bordeaux (rood)
  // de standaard voor elke pas -- de huiskleur. De levende grond (kleur die met
  // het moment meebeweegt) volgt de gekozen familie.
  const THEMA_STANDAARD = { rtg: 'bordeaux', lifestyle: 'bordeaux', business: 'bordeaux' };
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
    const s = pasStem();
    return s === 'business' ? business : s === 'lifestyle' ? lifestyle : rtg;
  }
  const STEMKOPPEN = [
    ['gate.title', true,
      'Zo, daar ben je.<br>Je pas, <em>altijd</em> op zak.',
      'Welkom.<br>Zaken, <em>strak</em> geregeld.',
      'Welkom thuis.<br>Uw wereld, <em>altijd</em> bij de hand.'],
    ['gate.deck', false,
      'Boeken, betalen met één tik, je eigen AI en De Salon. Alles draait op je codenaam, niet op je echte naam. Zo hoort het.',
      'Reizen, betalingen en je AI-boekhouder in één app, alles op codenaam. Efficiënt, discreet, zonder gedoe.',
      'Uw reizen, uw concierge en De Salon, verzameld in één stille app. Alles op uw codenaam; uw echte naam blijft van u.'],
    ['app.v.trip', false, 'Jouw reis.', 'Je reizen.', 'Uw reis.'],
    ['app.v.trip.note', false,
      'Wijzigen of toevoegen? Eén berichtje aan je AI is genoeg.',
      'Wijzigen of toevoegen? Meld het je AI; het staat direct in de agenda.',
      'Een wens? Fluister het uw AI; het wordt geregeld.'],
    ['app.v.pay.sub', false,
      'Eén tik, Face ID. Alles op je codenaam, zoals het hoort.',
      'Eén tik, Face ID. Elke betaling strak geboekt, op codenaam.',
      'Eén tik, Face ID. Uw betalingen dragen uw codenaam, niet uw naam.'],
    ['app.v.ai.sub', false,
      'Hij regelt het. Eén ja is genoeg.',
      'Hij regelt het en boekt het meteen in. Eén ja is genoeg.',
      'Uw wens is aan één woord genoeg.'],
    ['app.v.salon.sub', false,
      'Posts verschijnen 7 dagen na verblijf, voor je veiligheid.',
      'Posts verschijnen 7 dagen na verblijf, voor je veiligheid.',
      'Uw posts verschijnen 7 dagen na verblijf, voor uw veiligheid.']
  ];
  function stemKoppen(){
    if (lang() === 'en') return;
    const i = pasStem() === 'business' ? 1 : pasStem() === 'lifestyle' ? 2 : 0;
    STEMKOPPEN.forEach(rij => {
      const el = document.querySelector('[data-i18n="' + rij[0] + '"], [data-i18n-html="' + rij[0] + '"]');
      if (!el) return;
      if (rij[1]) el.innerHTML = rij[2 + i]; else el.textContent = rij[2 + i];
    });
    const ai = document.getElementById('aiTitle');
    if (ai) ai.textContent = ['Jouw AI.', 'Je AI.', 'Uw AI.'][i];
  }
  // meteen: de poort spreekt de taal van de gekozen ingang (?pas=...)
  stemKoppen();

  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', e => {
    e.preventDefault();
    login(null, { u: $('#liUser').value, p: $('#liPass').value });
  });
  const regForm = document.getElementById('regForm');
  if (regForm) regForm.addEventListener('submit', e => {
    e.preventDefault();
    login(null, { register: true, tier: regTier, name: $('#rgName').value, u: $('#rgEmail').value, phone: $('#rgPhone').value, geboortedatum: $('#rgGeb').value, p: $('#rgPass').value });
  });
  const toReg = document.getElementById('toReg'), toLogin = document.getElementById('toLogin'), toForgot = document.getElementById('toForgot');
