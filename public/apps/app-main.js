/* de bouwstempel-controle en de start van de app-bundel: html en script van dezelfde bouw */
(function(){
/* HTML EN SCRIPT MOETEN VAN DEZELFDE BOUW ZIJN.

   Een browser, een CDN of een service worker kan de pagina vers hebben en dit
   script nog uren oud (of omgekeerd). Die mix bouwt het beginscherm niet meer
   op: de gebruiker ziet zwart, en niets in de console legt uit waarom. Dat is
   hier echt gebeurd, meer dan eens, en elke keer duurde het lang voordat
   iemand doorhad dat de code al gerepareerd was.

   npm run build zet in beide bestanden dezelfde stempel. Wijken ze af, dan
   haalt de app zichzelf EEN keer vers op -- met een merk in sessionStorage,
   zodat een blijvend verschil (een proxy die niets doorlaat) geen herlaadlus
   wordt maar gewoon doorgaat. Doorgaan met een mismatch is nog altijd beter
   dan een zwart scherm, en de melding in de console zegt dan wat er speelt. */
var RTG_BOUW = 'b3bf2c3b';
(function bouwWacht(){
  try {
    var m = document.querySelector('meta[name="rtg-bouw"]');
    var html = m ? m.getAttribute('content') : null;
    if (!html || html === RTG_BOUW) return;
    if (sessionStorage.getItem('rtg_bouw_ververst') === html) {
      console.warn('[rtg] html-bouw ' + html + ' naast script-bouw ' + RTG_BOUW + '; verversen hielp niet, we gaan door.');
      return;
    }
    sessionStorage.setItem('rtg_bouw_ververst', html);
    console.warn('[rtg] html-bouw ' + html + ' naast script-bouw ' + RTG_BOUW + '; eenmalig vers ophalen.');
    location.reload();
  } catch (e) { /* geen sessionStorage: dan liever doorgaan dan omvallen */ }
})();
  const $ = s => document.querySelector(s);
  const T = (k, nl) => (window.RTGi18n ? RTGi18n.t(k, nl) : nl);
  const lang = () => (window.RTGi18n ? RTGi18n.lang : 'nl');
  const nfmt = n => Number(n).toLocaleString(lang() === 'en' ? 'en-US' : 'nl-NL');
  const eur = n => '€ ' + nfmt(n);
  const STATUS = { 'wacht-op-betaling':'awaiting payment', 'nieuw':'new', 'in bereiding':'in preparation', 'klaar':'ready', 'geserveerd':'served', 'geweigerd':'declined', 'terugbetaald':'refunded' };
  const tStatus = s => (lang() === 'en' ? (STATUS[s] || s) : s);
  const LBL = { 'Bevestigd':'Confirmed', 'Wacht op betaling':'Awaiting payment', 'In aanvraag':'Requested', 'Betaald':'Paid' };
  const tLbl = s => (lang() === 'en' ? (LBL[s] || s) : s);
  const ALG = { 'vis':'fish', 'soja':'soy', 'sesam':'sesame', 'gluten':'gluten', 'noten':'nuts', 'schaaldieren':'shellfish', 'ei':'egg', 'melk':'milk', 'pinda':'peanut', 'selderij':'celery', 'mosterd':'mustard' };
  const tAlg = a => (lang() === 'en' ? (ALG[a] || a) : a);
  const TYPELABEL = { 'Hotel':'Hotel', 'Restaurant':'Restaurant', 'Bar':'Bar', 'Taxi':'Taxi', 'Privéjet':'Private jet', 'Appartement':'Apartment', 'Club':'Club' };
  const tType = s => (lang() === 'en' ? (TYPELABEL[s] || s) : s);
  const LANGNAME = { nl: { nl:'Nederlands', en:'Engels' }, en: { nl:'Dutch', en:'English' } };
  const langName = code => (LANGNAME[lang()] || LANGNAME.nl)[code] || code;
  const escAttr = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  // Een bericht dat in een andere taal is geschreven, wordt automatisch voor de
  // lezer vertaald (met knop om het origineel te tonen).
  function msgHTML(text, olang){
    return '<span class="msg" data-olang="'+(olang||'nl')+'" data-otext="'+escAttr(text)+'">' +
      '<span class="msg-t">'+String(text).replace(/</g,'&lt;')+'</span>' +
      '<span class="msg-note"></span></span>';
  }
  async function hydrateMsgs(root){
    const to = lang();
    for (const el of root.querySelectorAll('.msg')){
      const from = el.dataset.olang || 'nl';
      if (from === to || el.dataset.done) continue;
      el.dataset.done = '1';
      if (!API.live) continue;
      try {
        const r = await API.call('/translate', { text: el.dataset.otext, to, from });
        if (r && r.translated){
          const tEl = el.querySelector('.msg-t'); tEl.textContent = r.text;
          const note = el.querySelector('.msg-note');
          note.innerHTML = '<button class="msg-toggle" type="button"></button>';
          const btn = note.querySelector('.msg-toggle');
          const setLabel = shown => btn.textContent = shown==='t'
            ? '' + T('msg.from','vertaald uit') + ' ' + langName(from) + ' · ' + T('msg.orig','toon origineel')
            : '' + T('msg.showtrans','toon vertaling');
          let shown = 't'; setLabel(shown);
          btn.addEventListener('click', () => {
            shown = shown==='t' ? 'o' : 't';
            tEl.textContent = shown==='t' ? r.text : el.dataset.otext;
            setLabel(shown);
          });
        }
      } catch (e) {}
    }
  }

  /* ---------- gegevens: echt via API, synthetisch alleen via Magnaat ---------- */

  const MAGNAAT = window.RTG_MAGNAAT_PROEF && window.RTG_MAGNAAT_DATA
    ? window.RTG_MAGNAAT_DATA : {};
  const PERSONAS = MAGNAAT.personas || {};
  const TIER_LABEL = {rtg:'RTG Pass', lifestyle:'Lifestyle Pass', business:'Business Pass', partner:'RTG-partner'};

  /* DEZE DRIE BEGINNEN LEEG, en dat is de hele pointe van de demo-erfenis.

     Hier stonden vier facturen, een uitgewerkte zomerreis en een stapel
     Salon-posts als BEGINWAARDE. applyState() overschrijft wat de server
     stuurt -- maar een reis die er niet is stuurt de server niet mee
     (`if (state.trip)`), en dan bleef die demo-villa gewoon staan op het
     beginscherm van iemand die zich net had aangemeld. De server begint een nieuw account leeg
     (server/kern/lid.js); dit was de laatste plek waar demo-inhoud nog voor
     eigen gegevens doorging.

     De trainingsinhoud staat apart in magnaat-data.js en wordt alleen door
     laadMagnaatData() geladen in de afgeschermde Magnaat-kopie, zonder backend.

     test/nieuwlid-leeg.test.js legt allebei de helften vast. */
  let user = null;
  let invoices = [];
  let trip = null;
  let posts = [];
  let creatorLikes = 0;
  let rtf = { gekoppeld: [], meldingen: [] }; // RTFoundation-gezinnen die dit lid als oppas/familie koppelde

  /* ---------- backend-koppeling ---------- */

  // Zakelijke rekening voor handmatige overboekingen (tot de betaalprovider live is).
  const RTG_IBAN = 'NL62 INGB 0111 1775 88';
  // Filters voor de facturenlijst (jaar en soort).
  let payFilterJaar = 'alle', payFilterType = 'alle';
  // Munt-ontvangst (crypto): opties komen eenmalig van de server; staat de
  // acceptatie uit, dan blijft alles zoals het was (geen munt-knoppen).
  let muntOpties = null;
  async function laadMuntOpties(){
    if (muntOpties || !API.enabled) return muntOpties;
    try { muntOpties = await API.call('/munt/opties'); } catch(e){ muntOpties = { aan: false, munten: [] }; }
    return muntOpties;
  }
  // Een PDF (factuur, overzicht) ophalen met het token en als download aanbieden.
  async function downloadPdf(pad, body, filename){
  /* De synthetische inhoud woont uitsluitend in magnaat-data.js. Dit deel
     bewaart alleen de naad in de bundel; de echte app draagt daardoor geen
     voorbeeldfacturen, reizen of Salon-berichten meer mee. */

/* de API-laag van de app: elke aanroep met token, taal en foutafhandeling */
    if (!API.token) return;
    try {
      const res = await fetch('/api' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API.token }, body: JSON.stringify(body || {}) });
      if (!res.ok) throw new Error('fout');
      const blob = await res.blob();
      // het eigen toestel als opslag: elke download krijgt stil een kopie in
      // de Toestelkluis (OPFS), zodat het exemplaar van het lid lokaal blijft
      if (window.Toestelkluis) Toestelkluis.bewaar(filename, blob).catch(() => {});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch(e){ toast(T('fin.dlfout','Downloaden lukte niet.')); }
  }

  // API-client uit de gedeelde app-shell (public/shared/appshell.js).
  const API = RTGApp.maakAPI({ foutTekst: 'API-fout' });
  let magnaatProef = false;
  // Een 403 met kyc:true (bijv. een gratis lid dat RTG Pay gebruikt zonder
  // paspoort) laat Rahul meteen de paspoort-stap van de onboarding tonen.
  const _apiCall = API.call.bind(API);
  API.call = function (pad, body) {
    return _apiCall(pad, body).catch(function (e) {
      if (e && e.data && e.data.kyc && typeof checkOnboarding === 'function') { try { checkOnboarding(); } catch (x) {} }
      throw e;
    });
  };

  function applyState(state){
    if (!state) return;
    if (state.user) user = state.user;
    if (state.invoices) invoices = state.invoices;
    if (state.trip) trip = state.trip;
    if (state.posts) posts = state.posts;
    if (typeof state.creatorLikes === 'number') creatorLikes = state.creatorLikes;
    if (state.myApplications) myApps = state.myApplications;
    if (state.foundation) rtf = state.foundation;
  }

  /* Meenemen: de app kent zijn eigen model, dus geeft hij dat door in plaats
     van de gedeelde laag naar het scherm te laten raden. Facturen zijn hier het
     ding dat een lid meeneemt naar zijn eigen boekhouding: nummer, bedrag, btw
     en afboekcode staan al op het scherm, dus staan ze ook in het bestand.
     'termijn' heet geen datum, want dat is het niet: het model houdt hier een
     zin bij ("Vervalt 1 augustus 2026"), en er wordt geen datum verzonnen die
     de app niet heeft. */
  if (window.RTGUitvoer) RTGUitvoer.bron(function () {
    if (!invoices || !invoices.length) return null;
    return {
      naam: 'facturen',
      kolommen: ['factuurnummer', 'omschrijving', 'netto', 'bijdrage', 'btw', 'totaal', 'status', 'termijn', 'afboekcode'],
      rijen: invoices.map(function (i) {
        return [i.id || '', i.desc || '', i.netto || 0, i.bijdrage || 0, i.btw || 0,
          (i.netto || 0) + (i.bijdrage || 0), i.status || '', i.date || '', i.afboekcode || ''];
      })
    };
  });

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

  /* ---------- login & tabs ----------
     De poort zelf is een gesprek met Rahul (app-main-06); die roept login()
     aan met de gegevens uit het gesprek. De oude keuzeknoppen per pas
     ([data-login]) en de kop boven het registratieformulier bestaan niet meer,
     dus staat er hier ook geen bediening meer voor. De gratis laag blijft wat
     hij was: alleen na aanmelden met een paspoort, nooit een anonieme sessie. */

  /* ---------- eigen app per pas, geen brede app ----------
     Elke betaalde pas heeft zijn eigen ingang (pas-rtg/lifestyle/business.html)
     die hier binnenkomt met ?pas=. Dan wordt dit DE app van die pas: het
     manifest (eigen naam en icoon op het beginscherm) wisselt mee, de poort
     toont alleen de eigen ingang, en de server weigert inloggegevens van een
     andere pas. De gratis laag heeft GEEN eigen app: die speelt mee in de
     RTG-app, met minder functies. ZONDER ?pas= bestaat er geen brede app
     meer: dan is dit alleen een keuzescherm dat naar de pas-apps verwijst. */
  const zoekParams = new URLSearchParams(location.search);
  magnaatProef = zoekParams.get('magnaat') === '1';
  if (magnaatProef) API.enabled = false;
  let vastePas = zoekParams.get('pas');
  if (vastePas === 'guest') vastePas = 'rtg'; // gratis speelt in de RTG-app
  if (!['rtg','lifestyle','business'].includes(vastePas)) vastePas = null;
  // vangnet voor oude e-maillinks zonder pas: die landen in de RTG-app
  if (!vastePas && (zoekParams.get('verify') || zoekParams.get('reset'))) vastePas = 'rtg';

  /* HET DOORSTUREN NAAR DE JUISTE PAS-APP MAG DE REST VAN HET ADRES NIET OPETEN.

     Hieronder sturen twee plekken door naar de eigen app van de pas, en allebei
     bouwden ze het nieuwe adres op als pathname + '?pas=' + doelPas. Daarmee
     ging ELKE andere parameter verloren -- en juist daar komen onze e-maillinks
     binnen. De pin-herstellink (/apps/app.html?pinherstel=SLEUTEL) heeft geen
     ?pas=, dus restoreSession stuurde meteen door naar ?pas=<tier> en de sleutel
     was weg voordat /shared/pinherstel.js hem kon opvangen. Resultaat: de link
     uit de mail deed niets, en er was geen weg terug naar je pin.

     Hetzelfde gold stil voor ?verify= en ?reset= van een lid dat GEEN RTG-pas
     heeft: het vangnet hierboven zet die op 'rtg', waarna de omleiding naar de
     eigen pas-app hun token alsnog weggooide.

     Dus: we nemen het hele adres mee en wisselen alleen de pas om. */
  const pasAdres = (doelPas) => {
    const p = new URLSearchParams(location.search);
    p.set('pas', doelPas);
    return location.pathname + '?' + p.toString() + location.hash;
  };

  /* Een aanvraag van de publieke website reist uitsluitend in het fragment
     (#aanvraag=...), niet in queryparameters. Een fragment wordt niet naar de
     webserver gestuurd en belandt daardoor niet in toegangslogs. De app leest
     alleen de eigen, versie-1 envelop, begrenst elk veld en bewaart hem enkel
     in dit browservenster totdat de ingelogde app-lijn hem heeft aangenomen. */
  function websiteAanvraagUitAdres(){
    const raw = new URLSearchParams(location.hash.replace(/^#/, '')).get('aanvraag');
    if (!raw || raw.length > 6000) return null;
    try {
      const basis = raw.replace(/-/g, '+').replace(/_/g, '/');
      const binair = atob(basis + '='.repeat((4 - basis.length % 4) % 4));
      const bytes = Uint8Array.from(binair, teken => teken.charCodeAt(0));
      const data = JSON.parse(new TextDecoder().decode(bytes));
      if (!data || data.version !== 1 || data.source !== 'rtravelgroup.store') return null;
      const veld = (waarde, grens) => String(waarde || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, grens);
      const aanvraag = {
        name: veld(data.name, 80), email: veld(data.email, 180), phone: veld(data.phone, 30),
        requirement: veld(data.requirement, 100), message: veld(data.message, 500)
      };
      return aanvraag.name && aanvraag.email && aanvraag.requirement && aanvraag.message ? aanvraag : null;
    } catch(e){ return null; }
  }
  let websiteAanvraag = websiteAanvraagUitAdres();
  if (vastePas){
    const ml = document.getElementById('manifestLink');
    if (ml) ml.href = '/manifests/pas-' + vastePas + '.webmanifest';
    const tl = document.getElementById('touchLink');
    if (tl) tl.href = '/icons/pas-' + vastePas + '-192.png';
    document.title = { rtg:'RTG Pass', lifestyle:'RTG Lifestyle Pass', business:'RTG Business Pass' }[vastePas];
  } else {

    // de ene poort: het scherm blijft kaal (alleen inloggen, aanmelden en
    // wachtwoord vergeten). Log in en uw account opent vanzelf de juiste
    // pas-app (RTG, Lifestyle of Business); aanmelden maakt een RTG-account.
    document.title = 'RTG, log in';
    const ml = document.getElementById('manifestLink');
    if (ml) ml.remove(); // een keuzescherm installeer je niet als app
  }
/* de trainingsmelding: een proef is een toestand, geen terugval na een storing */
  /* TRAINING IS VAN MAGNAAT, NIET VAN RTG. Alleen de afgeschermde Magnaat-kopie
     mag verzonnen leden, reizen en Salon-berichten laden. */
  const magnaatKopie = magnaatProef;

  /* Een demo is een toestand, geen terugval na een storing. De melding stond
     altijd op het homescreen en daardoor leek ook een echte installatie een
     demo. Alleen Magnaat kiest de trainingskopie expliciet. */
  function zetDemoMelding(aan, tekst) {
    const el = document.getElementById('osDemoWet');
    if (!el) return;
    el.hidden = !aan;
    if (tekst) { el.removeAttribute('data-i18n'); el.textContent = tekst; }
  }
  if (magnaatProef) {
    zetDemoMelding(true, 'MAGNAAT TEST · geïsoleerde trainingskopie · geen echte klant-, geld- of productieactie');
  }
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
/* de stem van de pas: welke koppen en teksten bij RTG, Lifestyle of Business horen */
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

  /* De poort is een gesprek met Rahul (zie app-main-06): inloggen, aanmelden en
     wachtwoord-herstel gaan alle drie via dat gesprek. De oude formulieren
     (loginForm/regForm/forgotForm/resetForm met hun wisselknoppen) staan niet
     meer in app.html; hun afhandeling hoort hier dus ook niet meer te staan. Wat
     blijft, zijn de LINKS uit de e-mail: die komen los van de poort binnen. */
  (function bevestigEmailLink(){
    const token = new URLSearchParams(location.search).get('verify');
    if (!token) return;
    API.call('/auth/verify-email', { token })
      .then(() => toast(T('gate.verified','Uw e-mailadres is bevestigd.')))
      .catch(() => toast(T('gate.verifyfail','Bevestigingslink ongeldig of verlopen.')))
      // alleen ?verify= uit het adres halen; ?reset= NIET aanraken, want de poort
      // van Rahul (app-main-04/05) leest die parameter hierna zelf nog
      .finally(() => history.replaceState(null, '', location.pathname + (vastePas ? '?pas=' + vastePas : '')));
  })();

  /* De afgeschermde Magnaat-kopie laadt haar losse trainingsbestand hier.
     De echte app-bundel blijft daardoor vrij van synthetische dossiers. */
  function laadMagnaatData(){
    invoices = JSON.parse(JSON.stringify(MAGNAAT.invoices || []));
    trip = MAGNAAT.trip ? JSON.parse(JSON.stringify(MAGNAAT.trip)) : null;
    posts = JSON.parse(JSON.stringify(MAGNAAT.posts || []));
    creatorLikes = Number(MAGNAAT.creatorLikes || 0);
  }

  async function login(tier, cred){
    if (cred){
      if (API.enabled){
        try {
          const data = cred.register
            ? await API.call('/auth/register', { name: cred.name, email: cred.u, phone: cred.phone, geboortedatum: cred.geboortedatum, password: cred.p, tier: cred.tier, pasApp: vastePas || undefined })
            : await API.call('/auth/login', { login: cred.u, password: cred.p, pasApp: vastePas || undefined });
          API.token = data.token;
          applyState(data.state);           // user = het echte account
          tier = user.tier;
          // uw account weet zelf bij welke pas hij hoort: zonder ?pas= (of in
          // de verkeerde pas-app) opent meteen de juiste app, zoals de
          // leeftijdskeuze dat bij de RTFoundation doet
          const doelPas = user.tier === 'guest' ? 'rtg' : user.tier;
          const magHier = vastePas ? (vastePas === 'rtg' ? ['rtg', 'guest'] : [vastePas]) : [];
          if (!magHier.includes(user.tier) && ['rtg', 'lifestyle', 'business'].includes(doelPas)){
            try { localStorage.setItem('rtg_member_token', API.token); } catch (e2) {}
            location.replace(pasAdres(doelPas));
            return;
          }
        } catch (e) { toast(e.message || 'Onjuiste inloggegevens.'); return; }
      } else {
        /* HIER STOND EEN WACHTWOORD IN DE CLIENT. De tak controleerde
           letterlijk op een naam en een wachtwoord en gaf daarna de
           business-pas -- leesbaar voor iedereen die de bron opent, en de
           naam van een echt mens. Weg. Zonder server valt er niets in te
           loggen, en dat hoort een lege deur te zijn en geen achterdeur. */
        if (!magnaatKopie){
          toast('Geen serververbinding. Start RTG via de server.'); return;
        }
        tier = 'business'; user = {...PERSONAS[tier]}; laadMagnaatData();
      }
    } else {
      if (API.enabled){
        try {
          const data = await API.call('/login', {tier, pasApp: vastePas || undefined});
          API.token = data.token;
          applyState(data.state);
        } catch (e) { toast(e.message || 'De server kon de sessie niet openen.'); return; }
      } else if (magnaatKopie) {
        user = {...PERSONAS[tier]}; laadMagnaatData();
      } else {
        toast('Geen serververbinding. Start RTG via de server.'); return;
      }
    }
    if (API.live) try { localStorage.setItem('rtg_member_token', API.token); } catch(e){}
    $('#gate').style.display = 'none';
    $('#app').classList.add('active');
    renderAll();
    await verwerkWebsiteAanvraag();
    if (API.live && window.RTGRealtime){
      RTGRealtime.start(API.token, { onSync: syncScope, onChange: renderBell, onSocial: opSociaal, onCall: opBelsignaal, onBezorg: opBezorg, onOntmoetSignaal: opOntmoetSignaal });
    }
    loadSocial();
    checkOnboarding(); laadAgendaLid();
  }

  // Blijf ingelogd: met een bewaard token slaat de app het startscherm over.
  // De sessie weet zelf bij welke pas hij hoort: zonder ?pas= (of in de
  // verkeerde pas-app) sturen we meteen door naar de juiste app.
  async function restoreSession(){
    if (!API.enabled) return;
    let t = null; try { t = localStorage.getItem('rtg_member_token'); } catch(e){}
    if (!t) return;
/* inloggen en de staat binnenhalen: token, pas en het eerste scherm */
    API.token = t;
    try {
      applyState((await API.call('/state')).state);
      const doelPas = user.tier === 'guest' ? 'rtg' : user.tier;
      const magHier = vastePas ? (vastePas === 'rtg' ? ['rtg','guest'] : [vastePas]) : [];
      if (!magHier.includes(user.tier)){
        if (['rtg','lifestyle','business'].includes(doelPas)){ location.replace(pasAdres(doelPas)); return; }
        API.token = null; return; // onbekende pas: poort tonen
      }
      $('#gate').style.display = 'none';
      $('#app').classList.add('active');
      renderAll();
      await verwerkWebsiteAanvraag();
      if (window.RTGRealtime) RTGRealtime.start(API.token, { onSync: syncScope, onChange: renderBell, onSocial: opSociaal, onCall: opBelsignaal, onBezorg: opBezorg, onOntmoetSignaal: opOntmoetSignaal });
      loadSocial();
      checkOnboarding(); laadAgendaLid();
    } catch(e){
      API.token = null;
      try { localStorage.removeItem('rtg_member_token'); } catch(e2){}
    }
  }

  async function doLogout(){
    try { if (API.live) await API.call('/logout'); } catch(e){}
    try { localStorage.removeItem('rtg_member_token'); } catch(e){}
    try { localStorage.removeItem('rtg_actieve_tab'); } catch(e){} // de volgende gast begint op het beginscherm
    /* En zijn werktafel staat leeg. Sinds WERELD.md hervat de werktafel je
       laatste bladen (shared/command/geheugen.js); zonder deze regel zou de
       volgende mens op een gedeeld toestel de titels van de vorige zien. */
    try { localStorage.removeItem('rtg_cmd_bladen'); } catch(e){}
    location.reload();
  }

  /* De poort is van Rahul: inloggen, aanmelden EN wachtwoord-herstel als een
     gesprek. Er zijn geen ouderwetse formulieren meer; Rahul is de enige poort.
     Hij ontdekt zelf of je terugkomt of nieuw bent, vraagt subtiel wat hij
     nodig heeft en legt op "waarom?" uit waarvoor iets dient. Alle paden
     eindigen op de bestaande routes: aanmelden via login() -> /auth/register,
     inloggen via login() -> /auth/login, herstel via /auth/reset. Het
     wachtwoord van een terugkerend lid gaat NOOIT door het gespreks-endpoint
     maar rechtstreeks naar de inlogroute. In beeld: de klok, Rahuls
     signatuurmond van bewegende lichtpuntjes, zijn zin en de ene regel van de
     gebruiker. Deelt de IIFE-scope met 00-kern-03.js (login, restoreSession,
     API, T). */
  (function aanmeldGesprek(){
    const gate = document.getElementById('gate');
    if (!gate || !API.enabled) return;
    const st = document.createElement('style');
    st.textContent =
      '.ag-doos{display:flex;flex-direction:column;width:100%;}' +
      // geen chatbubbels: alleen Rahuls zin, groot en stil in Bodoni, en
      // daaronder de ene regel van de gebruiker; verder niets
      /* VASTE KLEUR, GEEN MEEBEWEGENDE. Deze zin is het enige wat je aan de
         poort te lezen krijgt, op een donkere sterrenhemel. Hij stond op
         var(--txt), en die schuift mee met de dagkleur: afhankelijk van het
         tijdstip werd hij warmer en doffer, en een gebruiker meldde dat de
         letters bij hem niet zo wit waren. Leesbaarheid van de enige tekst op
         het scherm hoort niet van het uur van de dag af te hangen. CLAUDE.md
         is hier ook duidelijk over: op zwart is de tekstkleur wit. */
      ".ag-zin{font-family:'Bodoni Moda',serif;font-weight:400;font-size:1.12rem;line-height:1.65;color:#FBFAF8;" +
        'text-align:center;min-height:4.6rem;display:flex;align-items:center;justify-content:center;' +
        'padding:0.9rem 0.4rem 1.1rem;text-wrap:balance;animation:agZin 0.5s ease;}' +
      '@keyframes agZin{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}' +
      '.ag-rij{display:flex;align-items:center;border-bottom:1px solid var(--line);margin:0 0.6rem;transition:border-color 0.2s;}' +
      '.ag-rij[hidden]{display:none;}' +
      '.ag-rij:focus-within{border-color:var(--burgundy);}' +
      '.ag-rij input{flex:1;min-width:0;background:none;border:none;outline:none;color:var(--txt);' +
        "font-family:'Inter',sans-serif;font-size:0.95rem;text-align:center;padding:0.75rem 0.4rem;}" +
      '.ag-rij input::placeholder{color:var(--soft);}' +
      '.ag-rij button{background:none;border:none;cursor:pointer;color:var(--gold,#857007);font-size:1.15rem;' +
        'padding:0.4rem 0.2rem;opacity:0;transition:opacity 0.2s;font-family:inherit;}' +
      '.ag-rij:focus-within button,.ag-rij.vol button{opacity:0.85;}' +
      '.ag-mond{display:block;margin:0.15rem auto 0.3rem;width:220px;height:100px;}' +
      // De passkey is de voordeur: groot genoeg als eerste handeling, maar nog
      // steeds in de stille horlogetaal van het huis.
      '.ag-passkey{margin:0.95rem auto 0;background:color-mix(in srgb,var(--gold,#857007) 10%,transparent);' +
        'border:1px solid color-mix(in srgb,var(--gold,#857007) 48%,transparent);border-radius:0;color:var(--gold,#857007);' +
        'font-family:inherit;font-size:0.82rem;letter-spacing:0.03em;cursor:pointer;min-height:44px;padding:0.65rem 1.15rem;' +
        'display:flex;align-items:center;justify-content:center;gap:0.48rem;min-width:min(18rem,82vw);}' +
      '.ag-passkey[hidden]{display:none;}' +
      '.ag-passkey svg{width:17px;height:17px;stroke:currentColor;fill:none;}' +
      '.ag-anders{margin:0.65rem auto 0;padding:0.4rem 0.7rem;background:none;border:0;color:var(--soft);' +
        'font:inherit;font-size:0.72rem;letter-spacing:0.025em;cursor:pointer;text-decoration:underline;text-underline-offset:0.22rem;}' +
      '.ag-anders[hidden]{display:none;}' +
      /* De ballotage-regalia: pas zichtbaar zodra de vier vragen beginnen.
         Een stille kopregel met haarlijnen (de horlogetaal van het huis), en
         daaronder vier Romeinse cijfers als plaatsbepaling -- een uitnodiging,
         geen formulierbalk. Bij vertrouwelijke vragen (geboortedatum,
         wachtwoord) verschijnt een gedempte kluisregel onder het veld. */
      '.ag-kop{display:none;align-items:center;gap:0.8rem;justify-content:center;margin:0 0 0.35rem;' +
        "font-family:'Inter',sans-serif;font-size:0.62rem;font-weight:500;letter-spacing:0.34em;" +
        'text-transform:uppercase;color:var(--gold,#857007);opacity:0;transition:opacity var(--rtg-royaal,560ms) var(--rtg-ease,ease);}' +
      '.ag-kop::before,.ag-kop::after{content:"";flex:0 0 2.2rem;height:1px;' +
        'background:color-mix(in srgb, var(--gold,#857007) 45%, transparent);}' +
      '.ag-doos.ag-ballotage .ag-kop{display:flex;opacity:1;}' +
      '.ag-stappen:empty{display:none !important;}' +
      ".ag-stappen{display:none;justify-content:center;gap:1.6rem;margin:1.05rem 0 0;font-family:'Bodoni Moda',serif;" +
        'font-size:0.8rem;color:var(--soft);opacity:0;transition:opacity var(--rtg-royaal,560ms) var(--rtg-ease,ease);}' +
      '.ag-doos.ag-ballotage .ag-stappen{display:flex;opacity:1;}' +
      '.ag-stappen span{transition:color var(--rtg-tempo,340ms) var(--rtg-ease,ease);}' +
      '.ag-stappen span.nu{color:var(--gold,#857007);}' +
      '.ag-stappen span.gehad{color:color-mix(in srgb, var(--gold,#857007) 55%, var(--soft));}' +
      ".ag-kluis{display:none;justify-content:center;margin:0.7rem 0 0;font-family:'Inter',sans-serif;" +
        'font-size:0.68rem;letter-spacing:0.06em;color:var(--soft);opacity:0;transition:opacity var(--rtg-tempo,340ms) var(--rtg-ease,ease);}' +
      '.ag-doos.ag-kluis-aan .ag-kluis{display:flex;opacity:1;}' +
      // de sterrenhemel gaat achter alles; de poort-inhoud eroverheen
      '#gate > *:not(canvas){position:relative;z-index:1;}' +
      /* OP DESKTOP VULT DE HEMEL HET SCHERM. De poort was een kaart van 662px
         midden op een venster van 1600: de sterren stonden opgesloten in een
         rechthoek met afgeronde hoeken en daarbuiten was het vlak zwart. Een
         inlogscherm hoort geen venster in een venster te zijn.
         De inhoud houdt zijn eigen breedte -- alleen de HEMEL wordt groot. */
    /* Vervolg van app-main-04: de compositieregels van de poort (een kolom:
       klok, lippen, aanspreking, veld). Geknipt omdat deel 04 opnieuw over de
       10 KB-grens ging. De knip ligt midden in een stringconcatenatie -- deel
       04 eindigt op een + en dit deel maakt hem af.

       DE VOLGORDE IS DE BESTANDSNAAM. bundel.js plakt de delen in de volgorde
       van readdirSync().sort(), dus puur alfabetisch: 04, 04a, 04ab, 04b. Deze
       regels stonden een commit lang in 04ab, DUS na de `document.head
       .appendChild(st);` die 04a afsloot -- waarmee ze een losse expressie
       werden die JavaScript netjes uitrekent en weggooit. Geen syntaxfout,
       geen consolemelding, en de halo, de klokschaal en de uitlijning van de
       zin waren simpelweg weg terwijl de code er nog stond.
       controleer() kon dat niet zien: die vergelijkt de bundel met dezelfde
       som van dezelfde delen en is dus per definitie consistent met zichzelf.
       Wat het nu wel ziet, is toets 43 in scripts/check.js. */
      /* DE COMPOSITIE. Dit scherm had vijf objecten die allemaal ongeveer even
         belangrijk waren -- klok, lippen, zin, invoerveld, koekjesmelding --
         met grote lege vlakken ertussen die niets deden. Leegte in een premium
         ontwerp is bewust; dit was leegte omdat de inhoud niet wist waar hij
         moest staan.
         Nu is het EEN verticale kolom met een duidelijke rangorde: de klok is
         de identiteit en de held, Rahul komt er direct onder uit, en daaronder
         staat de actie. Alles daaronder is bijzaak. */
      '#gate{display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'gap:0;padding:6vh 1.1rem;}' +
      /* DE POORT IS ALTIJD NACHT, ook onder een licht thema.
         Dit scherm is een sterrenhemel; dat is niet een van de vier smaken
         maar wat het scherm IS. Toen de thema's platformbreed gingen, zette
         champagne netjes zijn donkere inkt op de body -- en die inkt landde op
         een invoerveld dat op een zwarte hemel ligt. Gemeten: 1,11:1. Niet
         "wat flets": onzichtbaar.
         De poort verklaart daarom zijn eigen materiaal (onyx) en laat het
         thema alleen los op wat er OP die hemel ligt: de wijzerplaat van de
         klok. Een lichte wijzerplaat tegen een nachthemel is precies wat een
         horloge met een wit blad 's avonds doet. */
      '#gate{color:var(--op-onyx);' +
        '--rtg-txt:var(--op-onyx);--txt:var(--op-onyx);' +
        '--rtg-muted:rgba(244,240,233,0.72);--rtg-soft:rgba(244,240,233,0.56);' +
        '--muted:rgba(244,240,233,0.72);--soft:rgba(244,240,233,0.56);}' +
      '#gate input,#gate textarea{color:inherit;}' +
      /* DE HALO. De sterren waren overal even druk, ook precies daar waar de
         klok en de tekst staan -- en dan moet het oog zelf uitzoeken wat het
         onderwerp is. Een zachte donkere ovaal achter de kolom maakt het daar
         stil, zodat de klok vanzelf naar voren komt. Geen vlak en geen kader:
         een verloop dat aan de randen volledig verdwijnt, zodat je hem niet
         als vorm ziet maar alleen als rust. */
      '#gate::after{content:"";position:absolute;left:50%;top:50%;' +
        'width:min(150vw,1100px);height:min(120vh,1000px);' +
        'transform:translate(-50%,-50%);pointer-events:none;z-index:0;' +
        'background:radial-gradient(ellipse at center,' +
          'rgba(0,0,0,0.62) 0%,rgba(0,0,0,0.45) 32%,rgba(0,0,0,0.18) 58%,rgba(0,0,0,0) 78%);}' +
      /* de klok groeit: hij is letterlijk het merk, en stond op een zesde van
         de hoogte alsof hij een illustratie was */
      '#gate .os-lock{margin:0;}' +
      /* SCHALEN MET TRANSFORM, niet met width/height. De klok tekent zijn
         wijzers, het merkje en de datumvensters op VASTE posities binnen zijn
         eigen maat; zet je die maat om, dan verschuift het draaipunt en staat
         alles scheef -- precies wat er gebeurde toen ik hem groter maakte.
         transform schaalt het hele beeld uniform, dus de geometrie blijft heel. */
      /* Schaal op de telefoon: 1,2. Hij stond op 1 omdat elke vergroting het
         invoerveld uit beeld duwde -- maar dat was toen de koekjesmelding nog
         een kaart van 160px was. Nu die een regel van 26px is, past het wel,
         en de kolom vulde met schaal 1 maar 51% van de hoogte terwijl de
         opzet 70 a 80% vraagt. Gemeten op 430 en op 375 breed. */
      '#gate{--klokschaal:1;}' +
      /* En de indeling moet de GESCHAALDE maat reserveren. Een transform tekent
         groter maar verandert de doos niet: op 1,5x groeide de klok 73px naar
         boven en 73px naar beneden buiten zijn eigen vak, en de lippen -- die
         netjes 10px onder de rand horen te zitten, en dat op een telefoon ook
         deden -- kwamen op een breed scherm midden op de wijzerplaat te liggen.
         Gemeten, niet gegokt: telefoon klok 201-494 met mond op 484 (goed),
         breed klok 98-537 met mond op 454 (83px de plaat in).
         Daarom draagt het vak zelf de hoogte, en schaalt de ring erin. */
      '#gate .os-lock{display:flex;align-items:center;justify-content:center;padding:0;margin:0;' +
        'height:calc(var(--rtg-klok-maat,16rem) * var(--klokschaal,1));transform:none;}' +
      '#gate .os-lock > .rtg-ring{transform:scale(var(--klokschaal,1));transform-origin:center;}' +
      /* DE MOND HOORT BIJ DE KLOK, dus meet hij zich aan de klok en niet aan
         het venster. Met min(52vw,240px) was hij op een telefoon 224 breed
         onder een klok van 256 (verhouding 0,87) en op een breed scherm 240
         onder een klok van 384 (0,63) -- dezelfde mond, twee verhoudingen.

         DE HOOGTE IS TWEE KEER MISGEGAAN, EEN KEER NAAR ELKE KANT.

         Eerst zweefde de mond tientallen pixels onder de klok. Toen werd hij
         opgetrokken tot hij "aansloot" -- en dat is te ver de andere kant op:
         gemeten op vijf schermmaten begon de INKT op 0 tot -1 pixel van de
         onderrand van de wijzerplaat. De lippen lagen dus tegen de gouden rand
         en middenin de contactschaduw van de kast (zie .rtg-ring::before in
         shared/klok.js, die zo'n 30px naar onderen reikt). Op een afdruk zie je
         dat meteen; in de code niet, want er stond alleen een getal.

         Daarom staat de rekensom er nu uit elkaar gehaald, met de twee
         eigenschappen van het doek als eigen maat. Het doek is 440 bij 200, dus
         0,4545 keer zo hoog als breed, en de tekening begint pas op 27,9% van
         die hoogte -- boven de inkt zit ruim een kwart niets. Wie de lippen
         ergens wil hebben, moet die leegte meerekenen; wie alleen de doos
         verschuift, verschuift de tekening net niet.

         --lipgat is het enige getal dat over SMAAK gaat: hoeveel lucht er
         tussen de wijzerplaat en de lippen hoort. 0,126 mondbreed is 0,11 klok,
         net voorbij de schaduw. De rest volgt eruit. */
      '#gate .ag-mond{--mondbreed:calc(var(--rtg-klok-maat,16rem) * var(--klokschaal,1) * 0.62);' +
        '--doekhoog:calc(var(--mondbreed) * 0.4545);' +
        '--doekleeg:calc(var(--doekhoog) * 0.279);' +
        '--lipgat:calc(var(--mondbreed) * 0.25);' +
        'width:var(--mondbreed);height:auto;opacity:0.82;' +
        'margin:calc(var(--lipgat) - var(--doekleeg)) auto 0.9rem;}' +
      // de zin is de aanspreking en geen onderschrift
      /* margin-inline:auto, anders staat de zin 43px links van de as. De doos
         is een flexkolom met align-items:stretch, dus een kind met een
         max-width blijft aan de linkerrand plakken -- gemeten, niet gegokt. */
      '#gate .ag-zin{font-size:clamp(1.35rem,5.2vw,1.9rem);line-height:1.3;' +
        'min-height:0;padding:1rem 0 1.6rem;max-width:22ch;margin-inline:auto;}' +
      // het invoerveld is de actie: breed en royaal, geen streepje
      /* EEN rand, niet twee. De rij had al een border-bottom uit de basisstijl;
         daar een volledige rand overheen leggen gaf een dubbele doos met een
         verspringende binnenrand. Eerst de oude weg, dan de nieuwe. */
      /* EEN doos, en symmetrisch. De rij droeg mijn ring en het invoerveld
         binnenin had zijn EIGEN achtergrond, rand en radius -- vandaar de
         dubbele doos met een binnenvlak dat 8px uit het midden lag. De rij
         draagt nu het kader, het veld erin is kaal. De padding was ook
         asymmetrisch (0,9rem links tegen 0,5rem rechts). */
      '#gate .ag-rij{width:min(100%,30rem);min-height:58px;border:0;' +
        'background:color-mix(in srgb,var(--onyx-basis) 82%,transparent);' +
        'box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--gold-tekst) 34%,transparent),' +
          'inset 0 1px 0 color-mix(in srgb,var(--gold-hoog) 15%,transparent);border-radius:0;' +
        'margin-inline:auto;padding:0.35rem 0.45rem 0.35rem 0.9rem;}' +
      '#gate .ag-rij:focus-within{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--gold-tekst) 70%,transparent);}' +
      '#gate .ag-rij input{background:none;border:0;border-radius:0;box-shadow:none;}' +
      '#gate .ag-rij input{font-size:1rem;padding:1rem 0.4rem;text-align:left;}' +
      '#gate .ag-rij #agGo{display:grid;place-items:center;flex:0 0 42px;width:42px;height:42px;' +
        'padding:0;border:1px solid color-mix(in srgb,var(--gold-tekst) 62%,transparent);' +
        'border-radius:50%;background:var(--gold-tekst);color:var(--onyx-diep);' +
        'font-size:1.2rem;line-height:1;opacity:1;}' +
      '#gate .ag-rij #agGo:hover{background:var(--gold-hoog);}' +
      /* De koekjesmelding hoort niet midden in de kennismaking. Hij zweeft
         onderaan, buiten de kolom, waar hij de compositie niet meer breekt.

         Deze regel stond er als `.rtgcookie`, een klasse die nergens bestaat.
         Het element heet `#rtg-cookie` en ligt anders met z-index 9999 over
         het enige invoerveld. De kolom houdt daarom alleen ruimte vrij zolang
         de melding er werkelijk staat. */
      'body:has(#rtg-cookie) #gate{padding-bottom:calc(6vh + 3rem);}' +
      /* RTG ACCESS COMPOSITIE.

         De klok, Rahul en passkey bestonden al. Wat ontbrak was de formele
         producthierarchie uit het goedgekeurde ontwerp: identificatie boven,
         een vaste begroeting, een duidelijke beveiligde handeling en op
         telefoon een rustige vooruitblik op de vier werelden. Deze regels
         veranderen geen authenticatie; ze ordenen uitsluitend de bestaande
         toegangspoort. */
      '#gate{overflow-y:auto;overscroll-behavior:contain;' +
        'padding:calc(env(safe-area-inset-top,0px) + 4.25rem) 1.1rem calc(env(safe-area-inset-bottom,0px) + 1.5rem);}' +
      '#gate>.rtg-toegang-signatuur{position:absolute;top:calc(env(safe-area-inset-top,0px) + 1rem);' +
        'left:50%;right:auto;width:min(calc(100% - 2rem),50rem);transform:translateX(-50%);' +
        'margin:0;padding-bottom:.7rem;}' +
      '#gate .os-lock{flex:0 0 auto;}' +
      '#gate .ag-doos{align-items:center;max-width:36rem;margin:0 auto;}' +
      '#gate .ag-mond{margin-bottom:.1rem;}' +
      '#gate .ag-rahul-label{margin:-.15rem 0 .45rem;color:var(--gold-hoog,#E1C77B);' +
        "font:italic 500 .72rem/1 'Bodoni Moda',serif;letter-spacing:.04em;}" +
      '#gate .ag-intro{display:flex;flex-direction:column;align-items:center;width:100%;}' +
      '#gate .ag-welkom{margin:0;color:#F5EFE6;text-align:center;' +
        "font:400 clamp(2.05rem,4.4vw,3rem)/1.04 'Bodoni Moda',serif;letter-spacing:-.025em;}" +
      '#gate .ag-zin{min-height:1.8rem;max-width:38ch;margin:.45rem auto .8rem;padding:0;' +
        "font:400 .72rem/1.45 'Inter',sans-serif;color:var(--rtg-soft);letter-spacing:.02em;}" +
      '#gate .ag-passkey-kaart{width:min(100%,30rem);padding:1.05rem 1.15rem 1.15rem;' +
        'border:1px solid color-mix(in srgb,var(--gold-tekst) 48%,transparent);' +
        'background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.008));' +
        'box-shadow:0 24px 70px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.035);}' +
      '#gate .ag-passkey-kaart[hidden]{display:none;}' +
      '#gate .ag-passkey-embleem{display:grid;place-items:center;width:2.35rem;height:2.35rem;' +
        'margin:0 auto .35rem;color:var(--gold-hoog,#E1C77B);}' +
      '#gate .ag-passkey-embleem svg{display:block;width:100%;height:100%;}' +
      '#gate .ag-passkey-kaart p{margin:0 0 .75rem;text-align:center;color:#E7E0D7;' +
        "font:400 .82rem/1.4 'Inter',sans-serif;letter-spacing:.015em;}" +
      '#gate .ag-passkey{width:100%;min-width:0;min-height:54px;margin:0;padding:.8rem 1rem;' +
        'border-color:color-mix(in srgb,var(--gold-hoog,#E1C77B) 72%,transparent);' +
        'background:linear-gradient(180deg,rgba(201,162,75,.14),rgba(201,162,75,.065));' +
        'color:var(--gold-hoog,#E1C77B);font-size:.86rem;letter-spacing:.045em;}' +
      '#gate .ag-passkey:hover{background:linear-gradient(180deg,rgba(201,162,75,.21),rgba(201,162,75,.1));}' +
      '#gate .ag-passkey svg{width:22px;height:22px;}' +
      '#gate .ag-anders{display:flex;align-items:center;gap:.85rem;width:min(100%,26rem);' +
        'margin:.75rem auto 0;padding:.45rem 0;text-decoration:none;color:var(--rtg-muted);' +
        'font-size:.72rem;letter-spacing:.035em;}' +
      '#gate .ag-anders::before,#gate .ag-anders::after{content:"";height:1px;flex:1;' +
        'background:color-mix(in srgb,var(--gold-tekst) 42%,transparent);}' +
      '#gate .ag-anders span{white-space:nowrap;}' +
      '#gate .ag-anders[hidden]{display:none!important;}' +
      '#gate .ag-werelden{display:none;width:100%;margin-top:1.1rem;color:var(--rtg-soft);' +
        "font:500 .56rem/1 'Inter',sans-serif;letter-spacing:.11em;text-transform:uppercase;}" +
      '#gate .ag-werelden span{min-width:0;padding:.15rem .35rem;text-align:center;}' +
      '#gate .ag-werelden span+span{border-left:1px solid color-mix(in srgb,var(--gold-tekst) 28%,transparent);}' +
      /* Zodra iemand de gesprekspoort kiest, wordt de vaste begroeting weer
         Rahuls levende zin. Een herkende gebruiker houdt de passkey als
         compacte tweede route naast het wachtwoordveld. */
      '#gate .ag-doos:has(.ag-rij:not([hidden])) .ag-welkom{display:none;}' +
      '#gate .ag-doos:has(.ag-rij:not([hidden])) .ag-zin{font-family:\'Bodoni Moda\',serif;' +
        'font-size:clamp(1.25rem,4.6vw,1.7rem);line-height:1.3;color:#FBFAF8;' +
        'min-height:3.6rem;max-width:24ch;margin:.4rem auto 1rem;}' +
      '#gate .ag-doos:has(.ag-rij:not([hidden])) .ag-passkey-kaart{margin-top:.75rem;padding:0;border:0;' +
        'background:none;box-shadow:none;}' +
      '#gate .ag-doos:has(.ag-rij:not([hidden])) .ag-passkey-embleem,' +
      '#gate .ag-doos:has(.ag-rij:not([hidden])) .ag-passkey-kaart p{display:none;}' +
      '#gate .ag-doos:has(.ag-rij:not([hidden])) .ag-werelden{display:none;}' +
      '@media (max-width:999px){' +
        '#gate{--klokschaal:.84;padding-inline:.9rem;}' +
        '#gate .ag-werelden:not(:empty){display:grid;grid-template-columns:repeat(4,minmax(0,1fr));}' +
      '}' +
      '@media (max-height:760px){' +
        '#gate{--klokschaal:.76;padding-top:3.6rem;padding-bottom:.75rem;}' +
        '#gate>.rtg-toegang-signatuur{top:.65rem;}' +
        '#gate .ag-mond{--lipgat:calc(var(--mondbreed) * .18);}' +
        '#gate .ag-rahul-label{margin-top:-.3rem;}' +
        '#gate .ag-welkom{font-size:1.8rem;}' +
        '#gate .ag-zin{margin-bottom:.55rem;}' +
        '#gate .ag-passkey-kaart{padding:.75rem .9rem .85rem;}' +
        '#gate .ag-passkey-embleem{display:none;}' +
        '#gate .ag-passkey-kaart p{margin-bottom:.5rem;font-size:.76rem;}' +
        '#gate .ag-passkey{min-height:48px;}' +
        '#gate .ag-anders{margin-top:.45rem;}' +
        '#gate .ag-werelden{margin-top:.65rem;}' +
      '}' +
    /* Slotstuk van de poortstijl: de brede-schermregels, en daarna pas het
       insluiten van het blad. Dit deel MOET het laatste van de reeks 04.. zijn
       dat aan de stijlstring bijdraagt, want het sluit hem af met een `;` en
       hangt hem in de kop. Alles wat na deze regel nog `'...' +` schrijft,
       staat buiten de string en doet niets.

       De brede-schermregels komen bewust NA de compositie in 04a: bij gelijke
       specificiteit wint de laatste, en op een breed scherm hoort de poort het
       hele venster te vullen in plaats van de kolompadding van 04a te houden. */
      /* Bordeauxfluweel boven en onder, een rustig onyx midden. */
      '#gate{background:' +
        'radial-gradient(ellipse 115% 52% at 50% -8%,color-mix(in srgb,var(--bordeaux-basis) 44%,var(--onyx-diep)) 0%,color-mix(in srgb,var(--bordeaux-diep) 24%,var(--onyx-basis)) 44%,transparent 76%),' +
        'radial-gradient(ellipse 120% 54% at 50% 108%,color-mix(in srgb,var(--bordeaux-basis) 46%,var(--onyx-diep)) 0%,color-mix(in srgb,var(--bordeaux-diep) 26%,var(--onyx-basis)) 45%,transparent 76%),' +
        'linear-gradient(180deg,var(--onyx-diep),var(--onyx-basis) 31%,var(--onyx-diep) 50%,var(--onyx-basis) 69%,var(--onyx-diep));}' +
      '@media (min-width:900px){' +
        /* op #gate en niet op .os-lock: de mond meet zich aan de klok en
           moet die schaal dus ook kunnen erven. Stond hij op .os-lock, dan
           bleef de mond op een breed scherm 224 breed onder een klok van 384. */
        '#gate{--klokschaal:1.08;}' +
        '#gate{position:fixed;inset:0;width:100vw;max-width:none;height:100vh;' +
          'margin:0;border-radius:0;border:0;display:flex;align-items:center;' +
          'justify-content:center;flex-direction:column;}' +
        '#gate canvas:not(.ag-mond){position:absolute;inset:0;width:100vw;height:100vh;}' +
        '#gate .ag-doos{max-width:34rem;}' +
      '}';
    document.head.appendChild(st);
    /* Vervolg van app-main-04: de poort-inhoud (mond, zin, invoerveld,
       passkey) en het gesprek erachter. Geknipt omdat deel 04 met de
       schermvullende sterrenhemel over de 10 KB-grens ging die het
       modulebeleid stelt; de bundel plakt 04 en 04b weer aaneen tot exact
       hetzelfde bestand. De cut ligt op een statement-grens binnen dezelfde
       gesloten scope, dus er verandert niets aan het gedrag. */

    // Een dicht maar fluisterzacht starlight-veld over het hele scherm. Meer
    // lichtpunten geeft de indruk van ontelbaar veel vezels; de lagere
    // helderheid voorkomt dat de poort glitterig of onrustig wordt.
    (function sterrenhemel(){
      var hang = function(){ if (window.RTGSterren) window.RTGSterren.hang(gate, { dichtheid: 1.35, helderheid: 0.72 }); };
      if (window.RTGSterren) return hang();
      var s = document.createElement('script'); s.src = '/shared/sterren.js'; s.async = true;
      s.onload = hang; document.head.appendChild(s);
    })();

    const doos = document.createElement('div');
    doos.className = 'ag-doos';
    doos.innerHTML =
      '<div class="ag-kop" id="agKop" aria-hidden="true"></div>' +
      '<canvas class="ag-mond" id="agMond" width="440" height="200" aria-hidden="true"></canvas>' +
      '<div class="ag-rahul-label" aria-hidden="true">' + T('ag.log','Rahul') + '</div>' +
      '<div class="ag-intro"><h1 class="ag-welkom">' + T('ag.welkom.kop','Welkom terug') + '</h1>' +
      '<div class="ag-zin" id="agZin" role="status" aria-live="polite" aria-label="' + T('ag.log','Rahul') + '"></div></div>' +
      '<div class="ag-rij" hidden><input id="agIn" autocomplete="off" data-i18n-ph="ag.plho" aria-label="' + T('ag.in','Je antwoord aan Rahul') + '" placeholder="' + T('ag.plho','Ik wil zeggen dat..') + '">' +
      '<button type="button" id="agGo" aria-label="' + T('ag.stuur','Stuur') + '">&#8594;</button></div>' +
      '<div class="ag-stappen" id="agStappen" aria-hidden="true"></div>' +
      '<div class="ag-kluis" id="agKluis"></div>' +
      '<div class="ag-passkey-kaart"><div class="ag-passkey-embleem" aria-hidden="true">' +
        '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.35"><circle cx="13" cy="10" r="4"/><path d="M5 23c.8-5 3.4-7 8-7 3.4 0 5.8 1.3 7 4"/><circle cx="23" cy="19" r="3"/><path d="M26 19h5m-2 0v3m-2-3v2"/></svg></div>' +
        '<p>' + T('ag.pk.uitleg','Ga verder met je passkey') + '</p>' +
      '<button type="button" class="ag-passkey" id="agPasskey">' +
        '<svg viewBox="0 0 24 24" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 11a2 2 0 0 0-2 2c0 2-.4 3.6-1 5"/><path d="M8 9a4 4 0 0 1 7 2c0 3-.5 5.4-1.5 7.5"/><path d="M12 13c0 3-.6 5.6-1.6 7.7"/><path d="M5.5 8a7 7 0 0 1 12 3c0 3.4-.5 6.4-1.5 9"/></svg>' +
        '<span>' + T('ag.pk.veilig','Veilig openen') + '</span></button></div>' +
      '<button type="button" class="ag-anders" id="agAnders"><span>' + T('ag.anders','Andere manier') + '</span></button>' +
      '<div class="ag-werelden" id="agWerelden" aria-label="' + T('ag.werelden','Beschikbare RTG-werelden') + '"></div>';
    gate.appendChild(doos);
    /* Op telefoon vervangt deze rail de ingeklapte command-bank. De namen
       komen uit dezelfde navigatiebron; dit is dus geen tweede wereldregister
       dat later los van LivingOS, WorkOS, TravelOS of FoundationOS kan raken. */
    let wereldPogingen = 0, wereldWachter = null;
    function vulWerelden(){
      const rail = doos.querySelector('#agWerelden');
      if (!rail || rail.children.length) return;
      const knoppen = document.querySelectorAll('#rtgCommand .cmd-nav button');
      const namen = Array.from(knoppen).slice(0, 4).map(function(knop){
        return knop.textContent.trim();
      }).filter(Boolean);
      if (namen.length < 4){
        if (!wereldWachter && window.MutationObserver){
          wereldWachter = new MutationObserver(vulWerelden);
          wereldWachter.observe(document.body, { childList: true, subtree: true });
        } else if (!window.MutationObserver && wereldPogingen++ < 100) setTimeout(vulWerelden, 100);
        return;
      }
      if (wereldWachter){ wereldWachter.disconnect(); wereldWachter = null; }
      namen.forEach(function(naam){
        const item = document.createElement('span'); item.textContent = naam; rail.appendChild(item);
      });
    }
    vulWerelden();
    // een wachtwoord-herstel-link uit de e-mail (?reset=): Rahul regelt het herstel zelf
    const herstel = new URLSearchParams(location.search).get('reset');

    const zin = doos.querySelector('#agZin');
    const inp = doos.querySelector('#agIn');
    let gesprek = null, bezig = false, loginU = null;

    /* De RTG-signatuur: de mond bestaat uit duizenden bewegende lichtpuntjes
       (eigen canvas, geen extern beeld). Bordeaux als basis, goud erdoorheen
       geweven, een enkel wit puntje als glinstering, en een gouden lichtgolf
       die om de paar seconden door de lippen trekt. De onderlip beweegt mee
       als Rahul praat. Wie minder beweging wil, krijgt een stilstaand beeld. */
    const mond = doos.querySelector('#agMond');
    /* EEN mond voor het hele systeem: shared/mond.js. Hier stond een eigen,
       tweede kopie van dezelfde puntenwolk -- met een eigen tekenlus die na
       het inloggen eeuwig bleef pollen (het canvas en 2820 objecten werden
       nooit vrijgegeven) en met een sinus in plaats van echte spraak. Die
       kopie is weg; de gedeelde motor doet kaak, spreiding en tuit, en stopt
       vanzelf zodra de poort uit beeld is. */
    /* mond.js laadt met defer en is er dus nog NIET wanneer de poort bouwt:
       meteen aanhaken zou een stille mond geven. Vandaar de na-lading op
       DOMContentLoaded (uitgestelde scripts draaien daarvoor al). */
    let mondje = { praat: function(){} };
    function mondStart(){
      if (window.RTGMond && mond && !mond.dataset.rtgMondActief) mondje = RTGMond.maak(mond);
    }
    mondStart();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mondStart);
    const praat = ms => mondje.praat(ms);

    // een zin, geen logboek: Rahuls woorden vervangen elkaar rustig
    function zeg(wie, tekst){
      if (wie !== 'rahul') return;
      /* De zin staat er METEEN, niet letter voor letter. Dat typen was mooi
         bedoeld, maar aan de poort staat iemand die naar binnen wil: die leest
         sneller dan de machine tikt, en zit dan te wachten op tekst die er al
         is. De mond beweegt wel gewoon mee -- dat is Rahuls gezicht, geen
         leesvertraging. */
      zin.style.animation = 'none';
      void zin.offsetWidth;              // de fade opnieuw laten lopen
      zin.style.animation = '';
      zin.textContent = tekst;
      praat(Math.min(2600, 500 + tekst.length * 28));
    }
    /* De ballotage-regalia volgen de metadata van de server: `voortgang`
       {nr, van} toont de kop en de Romeinse plaatsbepaling, `vertrouwelijk`
       de kluisregel. Geen metadata (het open gesprek, de inlog, het einde) =
       alles weer stil. De teksten lopen via T() mee met de taalkiezer. */
    const kopEl = doos.querySelector('#agKop');
    const stappenEl = doos.querySelector('#agStappen');
    const kluisEl = doos.querySelector('#agKluis');
    const ROMEINS = ['I', 'II', 'III', 'IV', 'V', 'VI'];
    function toonVoortgang(d){
      const v = d && d.voortgang;
      const entree = d && (d.entree || d.login) && !d.ingelogd;
      if (v && v.nr && !d.klaar){
        if (kopEl) kopEl.textContent = T('ag.ballotage','De ballotage');
        if (stappenEl){
          stappenEl.textContent = '';
          for (let i = 1; i <= (v.van || 4); i++){
            const s = document.createElement('span');
            s.textContent = ROMEINS[i - 1] || String(i);
            if (i === v.nr) s.className = 'nu';
            else if (i < v.nr) s.className = 'gehad';
            stappenEl.appendChild(s);
          }
        }
        doos.classList.add('ag-ballotage');
      } else if (entree){
        // het spiegelbeeld voor wie al lid is: dezelfde kopregel-taal,
        // zonder stappen (thuiskomen is geen procedure)
        if (kopEl) kopEl.textContent = T('ag.entree','De entree');
        if (stappenEl) stappenEl.textContent = '';
        doos.classList.add('ag-ballotage');
      } else {
        doos.classList.remove('ag-ballotage');
      }
      const kluisTekst = d && d.login ? T('ag.kluisdirect','Rechtstreeks naar de kluis, niet door dit gesprek')
        : (d && d.vertrouwelijk ? T('ag.kluis','Versleuteld · rechtstreeks de kluis in') : null);
      if (kluisEl && kluisTekst && !d.klaar){
        kluisEl.textContent = kluisTekst;
        doos.classList.add('ag-kluis-aan');
      } else {
        doos.classList.remove('ag-kluis-aan');
      }
    }
    const pkKnop = doos.querySelector('#agPasskey');
    const pkKaart = doos.querySelector('.ag-passkey-kaart');
    const andersKnop = doos.querySelector('#agAnders');
    const antwoordRij = inp.closest('.ag-rij');
    let passkeyBezig = false, passkeyAbort = null;
    function toonPasskey(aan){
      if (!pkKnop) return;
      pkKnop.hidden = !aan;
      if (pkKaart) pkKaart.hidden = !aan;
      // het label pas hier vertalen: bij het bouwen van de poort is de i18n
      // soms nog niet geladen
      if (aan){ const s = pkKnop.querySelector('span'); if (s) s.textContent = T('ag.pk.veilig','Veilig openen'); }
    }
    function wachtwoordVeld(placeholder){
      inp.type = 'password';
      inp.placeholder = placeholder || T('ag.ww','Je wachtwoord');
      // wie herkend is (loginU) mag ook met Face ID / vingerafdruk / sleutel
      toonPasskey(!!loginU);
    }
    function tekstVeld(){
      inp.type = 'text';
      inp.placeholder = T('ag.plho','Ik wil zeggen dat..');
      toonPasskey(false);
    }

    /* RTG Deur: eerst bewijst het toestel wie er staat; pas daarna zoekt de
       server het account bij de credential. Na "Andere manier" kan dezelfde
       functie ook de oude, gerichte passkey van een genoemd account gebruiken. */
    async function passkeyInlog(automatisch){
      if (passkeyBezig) return;
      if (!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.get)){
        zeg('rahul', T('ag.pk.geen','Dit toestel kent geen passkey. Kies Andere manier.')); return;
      }
      const b2u = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
      const u2b = buf => btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      passkeyBezig = true;
      passkeyAbort = window.AbortController ? new AbortController() : null;
      try {
        zeg('rahul', T('ag.pk.vraag','Je toestel vraagt nu om je Face ID, vingerafdruk of sleutel.'));
        const o = await API.call('/webauthn/opties', loginU ? { login: loginU } : {});
        const pub = o.opties; pub.challenge = b2u(pub.challenge);
        pub.allowCredentials = (pub.allowCredentials || []).map(c => Object.assign({}, c, { id: b2u(c.id) }));
        const vraag = { publicKey: pub };
        if (passkeyAbort) vraag.signal = passkeyAbort.signal;
        const cred = await navigator.credentials.get(vraag);
        const antwoord = { id: cred.id, rawId: u2b(cred.rawId), type: cred.type,
          clientExtensionResults: cred.getClientExtensionResults(),
          response: { authenticatorData: u2b(cred.response.authenticatorData), clientDataJSON: u2b(cred.response.clientDataJSON),
            signature: u2b(cred.response.signature), userHandle: cred.response.userHandle ? u2b(cred.response.userHandle) : null } };
        const r = await API.call('/webauthn/login', { login: loginU || undefined, ceremonie: o.ceremonie, antwoord,
          pasApp: vastePas || undefined, lang: document.documentElement.lang || 'nl' });
        passkeyBezig = false; passkeyAbort = null;
        if (r && r.token){
          API.token = r.token; try { localStorage.setItem('rtg_member_token', r.token); } catch(e){}
          zeg('rahul', T('ag.welkom','Daar ben je weer. Welkom terug.'));
          if (typeof restoreSession === 'function') await restoreSession();
        }
      } catch(e){
        passkeyBezig = false; passkeyAbort = null;
        if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')){
          if (!automatisch && e.name !== 'AbortError') zeg('rahul', T('ag.pk.afgebroken','Niet geopend. Probeer opnieuw of kies Andere manier.'));
          return;
        }
        zeg('rahul', (e && e.message ? e.message + ' ' : '') + T('ag.pk.mis','Dat lukte niet met de passkey. Kies Andere manier.'));
      }
    }
    function andereManier(stil){
      if (passkeyAbort) passkeyAbort.abort();
      antwoordRij.hidden = false;
      toonPasskey(false);
      if (andersKnop) andersKnop.hidden = true;
      if (!stil){ start(); inp.focus(); }
    }
    if (pkKnop) pkKnop.addEventListener('click', () => passkeyInlog(false));
    if (andersKnop) andersKnop.addEventListener('click', () => andereManier(false));

    /* ---------- wachtwoord-herstel, geheel in het gesprek ----------
       Rahul vraagt de zescijferige code (tweede kanaal, per SMS) en daarna het
       nieuwe wachtwoord, en zet het via de bestaande /auth/reset-route (die de
       herstel-link uit de e-mail plus de code samen eist). Daarna gaat het
       gewone inloggesprek verder. */
    let resetStap = 0, resetCode = '';
    function resetStart(){
      resetStap = 1;
      inp.type = 'text'; inp.inputMode = 'numeric';
      inp.placeholder = T('ag.reset.codeph','De zes cijfers');
      zeg('rahul', T('ag.reset.hoi','Je stelt een nieuw wachtwoord in. Uit veiligheid stuurde ik een code van zes cijfers naar je telefoon. Wat is die code?'));
    }
    async function resetStuur(tekst){
      if (resetStap === 1){
        resetCode = tekst.replace(/\D/g, '').slice(0, 6);
        if (resetCode.length !== 6){ zeg('rahul', T('ag.reset.code6','Het zijn zes cijfers; kijk nog even in het bericht op je telefoon.')); return; }
        resetStap = 2;
        wachtwoordVeld(T('ag.wwnieuw','Kies een wachtwoord'));
        zeg('rahul', T('ag.reset.ww','Dank je. En wat wordt je nieuwe wachtwoord? Minstens zes tekens.'));
      } else if (resetStap === 2){
        if (tekst.length < 6){ zeg('rahul', T('ag.reset.ww6','Minstens zes tekens graag.')); return; }
        try {
          await API.call('/auth/reset', { token: herstel, code: resetCode, password: tekst });
          resetStap = 3; resetCode = ''; tekstVeld(); inp.inputMode = 'text';
          zeg('rahul', T('ag.reset.klaar','Klaar, je nieuwe wachtwoord staat. Zeg "inloggen" en ik laat je binnen.'));
        } catch(e){
          resetStap = 1; resetCode = ''; inp.type = 'text';
          zeg('rahul', (e && e.message ? e.message + ' ' : '') + T('ag.reset.mis','Zeg "opnieuw" en dan proberen we het nog eens.'));
        }
      } else {
        // klaar: over naar het gewone inloggesprek, ?reset uit de URL halen
        resetStap = 0;
        const pas = new URLSearchParams(location.search).get('pas');
        try { history.replaceState(null, '', location.pathname + (pas ? '?pas=' + pas : '')); } catch(e){}
        gesprek = null; start();
      }
    }

    async function start(){
      if (gesprek || bezig) return;
      bezig = true;
      try { const d = await API.call('/aanmeld/start', { lang: document.documentElement.lang || 'nl' }); gesprek = d.id; zeg('rahul', d.tekst); }
      catch(e){ zeg('rahul', T('ag.mis','Het gesprek wil even niet starten; zeg iets, dan probeer ik het opnieuw.')); gesprek = null; }
      bezig = false;
    }
/* het gesprek met Rahul: versturen, wachten en het antwoord tonen */
    async function stuur(){
      const tekst = inp.value.trim();
      if (!tekst || bezig) return;
      inp.value = '';
      inp.closest('.ag-rij').classList.remove('vol');
      // wachtwoord-herstel loopt via zijn eigen kleine gesprek
      if (resetStap){ bezig = true; try { await resetStuur(tekst); } catch(e){ zeg('rahul', e.message || T('ag.mis2','Dat ging even mis; zeg het nog eens.')); } bezig = false; inp.focus(); return; }
      bezig = true;
      try {
        // "opnieuw" en "wachtwoord vergeten" zijn commando's voor het gesprek,
        // ook midden in het wachtwoordstadium; al het andere is daar een
        // wachtwoordpoging, rechtstreeks naar de ene inlogroute
        const commando = loginU && tekst.length <= 40 && /\b(opnieuw|vergeten)\b/i.test(tekst);
        if (loginU && !commando){
          try {
            await login('rtg', { u: loginU, p: tekst });
            zeg('rahul', T('ag.welkom','Daar ben je weer: welkom terug in het huis.'));
            toonVoortgang({});
          } catch(e){
            zeg('rahul', (e && e.message ? e.message + ' ' : '') + T('ag.wwmis','Probeer het nog eens, zeg "opnieuw", of zeg "wachtwoord vergeten" en dan regel ik een herstel-link.'));
          }
        } else {
          const d = await API.call('/aanmeld/zeg', { id: gesprek, tekst, lang: document.documentElement.lang || 'nl' });
          zeg('rahul', d.tekst);
          toonVoortgang(d);
          // ingelogd via de sleutelwoorden: de server heeft server-side
          // geverifieerd en een echte token gemunt; wij bewaren hem en
          // herstellen de sessie precies zoals na een gewone inlog
          if (d.ingelogd && d.token){
            try { API.token = d.token; localStorage.setItem('rtg_member_token', d.token); } catch(e2){}
            bezig = false;
            if (typeof restoreSession === 'function') await restoreSession();
            return;
          }
          // wachtwoord vergeten: Rahul belooft de herstel-link, de app vraagt
          // hem stil aan op de bestaande route (die nooit een bestaan lekt)
          if (d.vergeten && d.vergeten.u){
            API.call('/auth/forgot', { email: d.vergeten.u }).catch(() => {});
          }
          if (d.login && d.login.u){
            loginU = d.login.u;
            wachtwoordVeld();
          } else if (/wachtwoord/i.test(d.tekst) && !d.klaar){
            // de aanmeld-wachtwoordstap: niemand kijkt mee, ook op het scherm niet
            wachtwoordVeld(T('ag.wwnieuw','Kies een wachtwoord'));
          } else {
            tekstVeld();
          }
          if (d.klaar && d.velden){
            if (d.werkgever) { try { localStorage.setItem('rtg_ag_werkgever', JSON.stringify(d.werkgever)); } catch(e2){} }
            if (d.woonplaats) { try { localStorage.setItem('rtg_ag_woonplaats', d.woonplaats); } catch(e2){} }
            // dezelfde ene registratieroute als het formulier
            await login('rtg', { register: true, name: d.velden.name, u: d.velden.email, phone: d.velden.phone,
              geboortedatum: d.velden.geboortedatum, p: d.velden.password, tier: d.velden.tier });
          }
        }
      } catch(e){ zeg('rahul', e.message || T('ag.mis2','Dat ging even mis; zeg het nog eens.')); }
      // zei de gebruiker "opnieuw", dan verlaat de motor het inlogpad;
      // de app volgt door het wachtwoordveld weer een tekstveld te maken
      if (loginU && /\bopnieuw\b/i.test(tekst)){ loginU = null; tekstVeld(); }
      bezig = false;
      inp.focus();
    }
    doos.querySelector('#agGo').addEventListener('click', stuur);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); stuur(); } });
    inp.addEventListener('input', () => inp.closest('.ag-rij').classList.toggle('vol', !!inp.value.trim()));
    // Herstel uit de e-mail begint meteen. Een gewone bezoeker krijgt eerst de
    // zichtbare passkeydeur en opent die zelf: biometrie of een accountsleutel
    // hoort nooit zonder een bewuste handeling van de mens te verschijnen.
    let onthouden = null;
    try { onthouden = localStorage.getItem('rtg_member_token'); } catch(e){}
    if (herstel){ andereManier(true); setTimeout(resetStart, 400); }
    inp.addEventListener('focus', () => { if (!herstel && !resetStap) start(); }, { once: true });
  })();
  /* ================= SALON-CONNECTIES =================
     Leden voegen elkaar toe op codenaam, chatten 1-op-1, delen posts
     en bellen elkaar. Bellen is echte WebRTC: beeld en geluid gaan
     rechtstreeks tussen de twee telefoons; de server geeft alleen de
     belsignalen door en ziet nooit het gesprek. */
  let social = { me: null, codename: null, connections: [], requests: [] };
  let socialOK = false;      // false = gast of nog niet geladen: geen sociale UI
  let dmWith = null, dmNaam = '';
  const escT = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const initCN = cn => String(cn||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();

  async function loadSocial(){
    if (!API.live) return;
    try {
      const d = await API.call('/member/connections');
      social = d; socialOK = true;
    } catch(e){ socialOK = false; }
    renderSocialBar();
    renderContacts();
    renderSpelen();
  }

  // Spelen-kaart op Home: voor elke pas (RTG, Lifestyle en Business dezelfde
  // spelgroep); alleen een anonieme demo-gast zonder account speelt niet mee
  function renderSpelen(){
    const el = $('#homeSpelen'); if (!el) return;
    // de kaart begint verborgen (hidden in de HTML): zo staat er nooit een
    // lege kaart op Home als de sociale laag (nog) niet geladen is
    if (!socialOK || !user || (user.tier === 'guest' && !user.account)){ el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<div class="label">'+T('spel.label','Spelen')+'</div>'+
      '<div class="big" style="font-size:1.02rem;">'+T('spel.kop','Een potje tussendoor?')+'</div>'+
      '<div class="meta" style="margin:0.25rem 0 0.75rem;">'+T('spel.uitleg','Schaken, Woordduel, Magnaat, 30 Seconden, Proost (18+) en Vingerroulette. Tegen vrienden of een random tegenstander; samen spelen maakt je niet automatisch vrienden.')+'</div>'+
      '<button class="go" id="gaSpelen">'+T('spel.ga','Naar de spellen')+' →</button>';
    el.querySelector('#gaSpelen').addEventListener('click', () => { location.href = '/apps/spelen.html?pas=' + encodeURIComponent(vastePas || 'rtg'); });
  }

  // Contacten-kaart op Home: na het toevoegen bericht of (video)bel je elkaar met één tik
  function snelBel(key, naam, video){ dmWith = key; dmNaam = naam; beginGesprek(video); }
  function renderContacts(){
    const el = $('#homeContacts'); if (!el) return;
    // ook een gratis account (met paspoort) chat met vrienden; alleen een
    // anonieme demo-gast zonder account niet
    if (!socialOK || !user || (user.tier === 'guest' && !user.account)){ el.style.display='none'; return; }
    el.style.display='';
    const conns = social.connections || [], reqs = social.requests || [];
    const totUnread = conns.reduce((n,c)=> n + (c.unread||0), 0);
    let html = '<div class="label">Contacten'+(totUnread?' · <span style="color:var(--rtg-leesgoud,var(--gold))">'+totUnread+' nieuw</span>':'')+'</div>';
    reqs.forEach(r => {
      html += '<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);">'+
        '<span class="sc-av" style="width:2rem;height:2rem;">'+initCN(r.codename)+'</span>'+
        '<div class="grow-min"><b>'+escT(r.codename)+'</b><div class="meta">wil verbinden</div></div>'+
        '<button class="go" style="padding:.2rem .6rem;" data-cja="'+escT(r.key)+'">Accepteer</button>'+
        '<button class="go" style="background:transparent;color:var(--muted);padding:.2rem .4rem;" data-cnee="'+escT(r.key)+'">✕</button></div>';
    });
/* het contactenblok op het beginscherm, met de lege staat */
    if (!conns.length && !reqs.length){
      html += '<div class="big" style="font-size:1.02rem;">Nog geen contacten</div>'+
        '<div class="meta" style="margin:0.25rem 0 0.75rem;">Voeg iemand toe in De Salon; daarna bericht of (video)bel je elkaar met één tik, zonder telefoonnummer.</div>'+
        '<div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;">'+
        '<button class="go" data-goto="salon">Iemand toevoegen →</button>'+
        '<button class="rahul-leeg-knop" data-rahul-leeg="Zoek in De Salon iemand die bij me past en help me die toe te voegen als connectie">Laat Rahul iemand voorstellen</button>'+
        '</div>';
    } else {
      // de naamlaag: een zelfgekozen naam (eigenNaam) gaat voor de codenaam;
      // het potloodje zet of wist hem, en hij werkt overal in dit account door
      html += conns.map(c => { const nm = c.eigenNaam || c.codename; return (
        '<div class="hc-rij" style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);">'+
        '<span class="sc-av" style="width:2.2rem;height:2.2rem;cursor:pointer;" data-dm="'+escT(c.key)+'" data-cn="'+escT(nm)+'">'+initCN(nm)+(c.unread?'<span class="sc-badge">'+c.unread+'</span>':'')+'</span>'+
        '<b style="flex:1;min-width:0;cursor:pointer;" data-dm="'+escT(c.key)+'" data-cn="'+escT(nm)+'" title="'+escT(c.codename)+'">'+escT(nm)+(c.eigenNaam?' <span class="meta" style="font-weight:400;">· '+escT(c.codename)+'</span>':'')+'</b>'+
        '<button class="go" style="background:transparent;padding:.2rem .35rem;color:var(--muted);" data-hernoem="'+escT(c.codename)+'" title="Eigen naam geven">✎</button>'+
        '<button class="go" style="padding:.2rem .5rem;" data-dm="'+escT(c.key)+'" data-cn="'+escT(nm)+'">Bericht</button>'+
        '<button class="go" style="background:transparent;padding:.2rem .35rem;" data-snap="'+escT(c.key)+'" data-cn="'+escT(nm)+'" title="Snap">'+RTGGlyf.svgHTML('camera')+'</button>'+
        '<button class="go" style="background:transparent;padding:.2rem .35rem;" data-bel="'+escT(c.key)+'" data-cn="'+escT(nm)+'">'+RTGGlyf.svgHTML('bellen')+'</button>'+
        '<button class="go" style="background:transparent;padding:.2rem .35rem;" data-vid="'+escT(c.key)+'" data-cn="'+escT(nm)+'">'+RTGGlyf.svgHTML('videobellen')+'</button></div>'); }
      ).join('') + '<button class="go" style="margin-top:0.75rem;background:transparent;color:var(--muted);" data-goto="salon">+ Iemand toevoegen</button>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-dm]').forEach(b => b.addEventListener('click', () => openDm(b.dataset.dm, b.dataset.cn)));
    el.querySelectorAll('[data-snap]').forEach(b => b.addEventListener('click', () => snapKies(b.dataset.snap)));
    el.querySelectorAll('[data-bel]').forEach(b => b.addEventListener('click', () => snelBel(b.dataset.bel, b.dataset.cn, false)));
    el.querySelectorAll('[data-vid]').forEach(b => b.addEventListener('click', () => snelBel(b.dataset.vid, b.dataset.cn, true)));
    el.querySelectorAll('[data-hernoem]').forEach(b => b.addEventListener('click', async () => {
      const naam = prompt('Hoe wil jij deze vriend noemen? (leeg = terug naar de codenaam)', '');
      if (naam === null) return;
      try { await API.call('/member/naam/zet', { codenaam: b.dataset.hernoem, naam }); toast(naam.trim() ? 'Opgeslagen; alleen jij ziet deze naam.' : 'Terug naar de codenaam.'); loadSocial(); } catch(e){ toast(e.message); }
    }));
    renderSnapsStories();
    el.querySelectorAll('[data-cja]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/member/connect/respond', { key: b.dataset.cja, action: 'accept' }); toast(T('sal.verbonden','Verbonden.')); loadSocial(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-cnee]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/member/connect/respond', { key: b.dataset.cnee, action: 'decline' }); loadSocial(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => openTab(b.dataset.goto)));
  }

  /* ---------- snaps en 24-uurs verhalen (Snapchat-achtig) ---------- */
  let snapNaar = null, snapStoryMode = false, snapFileEl = null;
  function snapFile(){ if (!snapFileEl){ snapFileEl = document.createElement('input'); snapFileEl.type='file'; snapFileEl.accept='image/*'; snapFileEl.style.display='none'; document.body.appendChild(snapFileEl); snapFileEl.addEventListener('change', snapGekozen); } return snapFileEl; }
  function snapKies(key){ snapNaar = key; snapStoryMode = false; snapFile().click(); }
  function storyKies(){ snapStoryMode = true; snapNaar = null; snapFile().click(); }
  async function snapGekozen(e){
    const f = e.target.files[0]; e.target.value=''; if(!f) return;
    const foto = await snapVerklein(f); if(!foto){ toast(T('snap.leesfout','Kon de foto niet lezen.')); return; }
    const tekst = prompt(T('snap.tekst','Tekst erbij (mag leeg):'),'') || '';
    try {
      if (snapStoryMode){ await API.call('/member/story/post', { foto, tekst }); toast(''+T('snap.storyok','Je verhaal staat er 24 uur op.')); loadStories(); }
      else { await API.call('/member/snap/send', { toKey: snapNaar, foto, tekst }); toast(''+T('snap.verstuurd','Snap verstuurd. Hij verdwijnt na bekijken.')); }
    } catch(err){ toast(err.message); }
  }
  function snapVerklein(file){
    return new Promise(res => { const img=new Image(), rd=new FileReader();
      rd.onload=()=>{ img.onload=()=>{ const max=1000; let w=img.width,h=img.height; if(w>max||h>max){ const r=Math.min(max/w,max/h); w=Math.round(w*r); h=Math.round(h*r);} const cv=document.createElement('canvas'); cv.width=w; cv.height=h; cv.getContext('2d').drawImage(img,0,0,w,h); res(cv.toDataURL('image/jpeg',0.7)); }; img.onerror=()=>res(null); img.src=rd.result; };
      rd.onerror=()=>res(null); rd.readAsDataURL(file); });
  }
  /* ---------- verplichte onboarding als gesprek met Rahul ----------
     Geen formulier meer: Rahul vraagt de ontbrekende gegevens één voor één,
     laat de overeenkomst lezen en laat je tekenen door je naam te typen. Alles
     loopt over dezelfde routes als voorheen (/onboarding/status|opslaan|teken
     en /verify/upload). De invoerregel + knoppen worden in 10-social-02
     bedraad; de gespreksfuncties staan hier. */
  let onbBezig = false, onbSt = null, onbRij = [], onbStap = null, onbHuidig = null, onbGeopend = false, onbMond = null;
  function onbEl(id){ return document.getElementById(id); }
  // Rahuls signatuurmond boven de onboarding, dezelfde als op de poort. De
  // zin staat er meteen volledig; alleen de mond beweegt mee.
  function onbMondMaak(){ const c = onbEl('onbMond'); if (c && !onbMond && window.RTGMond) onbMond = RTGMond.maak(c); }
  function onbZeg(t){
    const z = onbEl('onbTitel'); if (!z) return;
    const praat = onbMond ? function(ms){ onbMond.praat(ms); } : null;
    /* Ook hier meteen de hele zin; zie app-main-05.js voor waarom. */
    z.textContent = t;
    if (praat) praat(Math.min(2600, 500 + t.length * 28));
  }
  function onbInputType(t){ return t==='date'?'date':t==='email'?'email':t==='tel'?'tel':'text'; }
  function onbOpenVelden(){ return ((onbSt && onbSt.velden) || []).filter(function(v){ return !v.ingevuld; }); }

  // Na de onboarding kiest het lid zelf een wereld; de inlog opent niets voor.
  function naarWereldkeuze(){
    if (window.RTGCommand && typeof RTGCommand.land === 'function') RTGCommand.land();
  }

  async function checkOnboarding(){
    // Een bewuste lokale demo heeft geen onboardingroute.
    if (!API.live){ naarWereldkeuze(); return true; }
    if (!API.token || onbBezig) return false;
    let st; try { st = await API.call('/onboarding/status'); } catch(e){ return false; }
    if (!st || st.klaar){
      const g0 = onbEl('onbGate'); if (g0) g0.hidden = true;
      naarWereldkeuze();
      return true;
    }
    onbStartGesprek(st);
    return false;
  }
  function onbStartGesprek(st){
    const g = onbEl('onbGate'); if (!g) return;
    if (!g.hidden && onbStap) return; // al bezig, niet opnieuw beginnen
    onbSt = st; onbMondMaak();
    onbRij = onbOpenVelden();
    onbStap = onbRij.length ? 'veld' : 'teken';
    const eerste = !onbGeopend; onbGeopend = true;
    g.hidden = false;
    if (eerste) onbZeg(T('onb.intro','Fijn dat je er bent. Nog een paar dingen en je kunt op reis.'));
    setTimeout(onbVolgende, eerste ? 750 : 0);
  }
  function onbVolgende(){
    if (onbStap === 'veld' && onbRij.length){
      onbHuidig = onbRij[0];
      if (onbHuidig.type === 'kyc') return onbVraagPaspoort();
      return onbVraagVeld(onbHuidig);
    }
    onbStap = 'teken';
    onbTekenVraag();
  }
  function onbVraagTekst(v){
    const M = {
      adres: T('onb.q.adres','Wat is je straat en huisnummer?'),
      postcode: T('onb.q.postcode','En je postcode?'),
      woonplaats: T('onb.q.woonplaats','In welke plaats woon je?'),
      land: T('onb.q.land','En in welk land?'),
      geboortedatum: T('onb.q.geboortedatum','Wat is je geboortedatum?'),
      nationaliteit: T('onb.q.nationaliteit','Wat is je nationaliteit?'),
      naam: T('onb.q.naam','Hoe heet je voluit?'),
      email: T('onb.q.email','Wat is je e-mailadres?'),
      telefoon: T('onb.q.telefoon','En je telefoonnummer?')
    };
    return M[v.id] || (T('onb.q.veld','Wat is je ') + String(v.label || '').toLowerCase() + '?');
  }
  function onbVraagVeld(v){
    const inp = onbEl('onbIn'), rij = onbEl('onbRij');
    if (rij) rij.style.display = '';
    if (inp){ inp.type = onbInputType(v.type); inp.value = ''; inp.placeholder = T('onb.typ','Typ je antwoord'); }
    onbActies([]);
    onbZeg(onbVraagTekst(v));
    if (inp) inp.focus();
  }
  function onbVraagPaspoort(){
    const rij = onbEl('onbRij'); if (rij) rij.style.display = 'none';
    onbZeg(T('onb.q.paspoort','Tot slot je paspoort, zodat ik zeker weet dat jij het bent. Scan het met de RTG-scanner of kies een foto.'));
/* de onboarding: het paspoort scannen of een bestand kiezen */
    onbActies([
      { txt: T('onb.scan','Scan je paspoort'), prim: true, doe: function(){
          if (window.RTGPaspoortScan) RTGPaspoortScan.open({ onKlaar: function(d, mrz){ onbPaspoortUpload(d, mrz); } });
          else onbEl('onbKycFile').click();
        } },
      { txt: T('onb.upload','Kies een foto'), doe: function(){ onbEl('onbKycFile').click(); } }
    ]);
  }
  // de gekozen/gescande foto versleuteld naar de kluis en het gesprek vervolgen.
  // mrz = (optioneel) de op het toestel uitgelezen paspoortzone; kloppen de
  // controlecijfers, dan vult Rahul naam/geboortedatum/nationaliteit vast in.
  async function onbPaspoortUpload(data, mrz){
    if (!data) return;
    const fout = onbEl('onbFout'); if (fout) fout.textContent = '';
    onbBezig = true;
    try {
      await API.call('/verify/upload', { image: data });
      if (user) user.verified = 'pending';
      const gelezen = await onbMrzOpslaan(mrz);
      try { onbSt = await API.call('/onboarding/status'); } catch(e){}
      onbBezig = false;
      if (gelezen) onbZeg(T('onb.mrz1','Ik heb je paspoort gelezen: ') + gelezen + T('onb.mrz2','. Klopt dat? Dan gaan we verder.'));
      if (onbSt && onbSt.klaar) return setTimeout(onbKlaar, gelezen ? 900 : 0);
      onbRij = onbOpenVelden();
      onbStap = onbRij.length ? 'veld' : 'teken';
      if (gelezen) setTimeout(onbVolgende, 900); else onbVolgende();
    } catch(e){ onbBezig = false; if (fout) fout.textContent = (e && e.message) || T('onb.upmis','Uploaden lukte niet.'); }
  }
  // MRZ-velden opslaan in het onboarding-profiel; geeft een korte omschrijving
  // terug van wat gelezen is (voor Rahul), of '' als er niets bruikbaars was.
  async function onbMrzOpslaan(mrz){
    if (!mrz) return '';
    // de vervaldatum los bewaren (geen onboarding-veld): Rahul seint er een half
    // jaar vooraf mee dat het paspoort verloopt
    if (mrz.vervaldatum){ try { await API.call('/onboarding/paspoort', { vervaldatum: mrz.vervaldatum, nummer: mrz.nummer }); } catch(e){} }
    const heeft = {}; (onbSt && onbSt.velden || []).forEach(function(v){ heeft[v.id] = v; });
    const velden = {}, stukjes = [];
    if (mrz.geboortedatum && heeft.geboortedatum){ velden.geboortedatum = mrz.geboortedatum; stukjes.push(mrz.geboortedatum); }
    if (mrz.nationaliteit && heeft.nationaliteit){ velden.nationaliteit = mrz.nationaliteit; stukjes.push(mrz.nationaliteit); }
    if (mrz.naam && heeft.naam && !heeft.naam.ingevuld){ velden.naam = mrz.naam; stukjes.push(mrz.naam); }
    if (!Object.keys(velden).length) return '';
    try { onbSt = await API.call('/onboarding/opslaan', { velden }); } catch(e){ return ''; }
    return stukjes.join(', ');
  }
  function onbTekenVraag(){
    const inp = onbEl('onbIn'), rij = onbEl('onbRij');
    if (rij) rij.style.display = '';
    if (inp){ inp.type = 'text'; inp.value = ''; inp.placeholder = T('onb.naamph','Typ je volledige naam'); }
    const c = (onbSt && onbSt.contract) || {};
    onbZeg(T('onb.teken','Laatste stap: de ') + (c.titel || T('onb.overeenkomst','overeenkomst')) + T('onb.teken2','. Typ je volledige naam om te tekenen; daarmee ga je akkoord. Wil je hem eerst lezen?'));
    onbActies([{ txt: T('onb.lees','Lees de overeenkomst'), doe: onbToonLees }]);
    if (inp) inp.focus();
  }
  function onbToonLees(){
    const l = onbEl('onbLees'); if (!l) return;
    if (l.hidden){ l.textContent = ((onbSt && onbSt.contract) || {}).tekst || ''; l.hidden = false; }
    else l.hidden = true;
  }
  function onbActies(lijst){
    const box = onbEl('onbActies'); if (!box) return;
    box.textContent = '';
    (lijst || []).forEach(function(a){
      const b = document.createElement('button'); b.type = 'button'; b.textContent = a.txt;
      if (a.prim) b.className = 'prim'; b.addEventListener('click', a.doe); box.appendChild(b);
    });
  }
  /* Het inrichten: ná het tekenen biedt Rahul één keer aan in te vullen wat de
     gegevenspoort anders per keer komt vragen. Een aanbod, geen poort -- waarom
     en waar het landt staat in server/kern/onboarding/inrichten.js. */
  let onbInr = [], onbInrHuidig = null;
  async function onbInrichtenAanbod(){
    let st; try { st = await API.call('/onboarding/inrichten'); } catch(e){ return onbMeebouwen(); }
    if (!st || st.klaar || !(st.open || []).length) return onbMeebouwen();
    onbInr = st.open.slice(); onbStap = 'inrichten-aanbod';
    const rij = onbEl('onbRij'); if (rij) rij.style.display = 'none';
    onbZeg(T('onb.inr.aanbod','Getekend, welkom. Zodra je iets bestelt of laat bezorgen heb ik een paar gegevens nodig. Zal ik ze nu in één keer doorlopen?'));
    onbActies([{ txt: T('onb.inr.ja','Ja, nu meteen'), prim: true, doe: onbInrVolgende },
      { txt: T('onb.inr.later','Liever later'), doe: onbMeebouwen }]);
  }
  function onbInrVolgende(){
    if (!onbInr.length) return onbMeebouwen();
    onbInrHuidig = onbInr.shift(); onbStap = 'inrichten';
    const inp = onbEl('onbIn'), rij = onbEl('onbRij');
    if (rij) rij.style.display = '';
    if (inp){ inp.type = onbInputType(onbInrHuidig.type); inp.value = ''; inp.placeholder = T('onb.typ','Typ je antwoord'); }
    // het waarom staat erbij: nooit een veld zonder de handeling die erom vraagt
    onbZeg(onbInrHuidig.vraag + ' ' + (onbInrHuidig.waarom || ''));
    onbActies([{ txt: T('onb.inr.sla','Sla dit over'), doe: onbInrVolgende }]);
    if (inp) inp.focus();
  }
  async function onbInrOpslaan(t){
    const velden = {}; velden[onbInrHuidig.id] = t;
    onbBezig = true;
    try { await API.call('/onboarding/inricht', { velden }); } catch(e){}
    onbBezig = false; onbInrVolgende();
  }

  function onbKlaar(){
    const g = onbEl('onbGate'); if (g) g.hidden = true;
    onbStap = null; onbGeopend = false; onbSt = null; onbRij = []; onbInr = []; onbInrHuidig = null; onbMb = []; onbMbHuidig = null;
    onbActies([]); const l = onbEl('onbLees'); if (l){ l.hidden = true; }
    naarWereldkeuze();
    toast(T('onb.welkom','Welkom aan boord! Fijne reis.'));
  }
  async function onbInvoer(tekst){
    if (onbBezig || !onbStap) return;
    tekst = String(tekst == null ? '' : tekst).trim();
    const inp = onbEl('onbIn'); if (inp) inp.value = '';
    const fout = onbEl('onbFout'); if (fout) fout.textContent = '';
    if (onbStap === 'veld'){
      if (!tekst || !onbHuidig) return;
      onbBezig = true;
      try {
        const velden = {}; velden[onbHuidig.id] = tekst;
        onbSt = await API.call('/onboarding/opslaan', { velden });
        onbBezig = false;
        onbRij = onbOpenVelden();
        onbStap = onbRij.length ? 'veld' : 'teken';
        onbVolgende();
      } catch(e){ onbBezig = false; if (fout) fout.textContent = (e && e.message) || T('onb.mis','Dat lukte niet, probeer het nog eens.'); }
    } else if (onbStap === 'inrichten'){
      if (!tekst || !onbInrHuidig) return;
      return onbInrOpslaan(tekst);
    } else if (onbStap === 'meebouw'){
      if (!tekst || !onbMbHuidig) return;
      return onbMbOpslaan(tekst);
    } else if (onbStap === 'teken'){
      if (tekst.length < 2){ if (fout) fout.textContent = T('onb.naamkort','Typ je volledige naam om te tekenen.'); return; }
      onbBezig = true;
      try {
        const r = await API.call('/onboarding/teken', { naam: tekst, akkoord: true });
        onbBezig = false; onbSt = r;
        if (r && r.klaar) return onbInrichtenAanbod();
        onbRij = onbOpenVelden();
        onbStap = onbRij.length ? 'veld' : 'teken';
        onbVolgende();
      } catch(e){ onbBezig = false; if (fout) fout.textContent = (e && e.message) || T('onb.mis','Dat lukte niet, probeer het nog eens.'); }
    }
  }
  async function onbPaspoortGekozen(file){
    const fout = onbEl('onbFout'); if (fout) fout.textContent = '';
    if (!file) return;
    if (file.size > 5*1024*1024){ if (fout) fout.textContent = T('onb.toobig','De foto is te groot (max 5 MB).'); return; }
    const data = await snapVerklein(file); if (!data) return;
    const mrz = await onbMrzUitFoto(data);
    return onbPaspoortUpload(data, mrz);
  }
  // een gekozen foto in een canvas laden en er de MRZ uit proberen te lezen
  function onbMrzUitFoto(dataURL){
    return new Promise(function(res){
      if (!window.RTGMRZ){ res(null); return; }
      const img = new Image();
      img.onload = function(){
        try {
          const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
          cv.getContext('2d').drawImage(img, 0, 0);
          res(RTGMRZ.lees(cv));
        } catch(e){ res(null); }
      };
      img.onerror = function(){ res(null); };
      img.src = dataURL;
    });
  }
  // Het onboarding-gesprek bedraden: de invoerregel, de stuur-knop en de
  // paspoort-upload. De gespreksfuncties zelf staan in 10-social-01.
  (function initOnbGesprek(){
    const go = document.getElementById('onbGo'), inp = document.getElementById('onbIn');
    if (go && inp) go.addEventListener('click', function(){ onbInvoer(inp.value); });
    if (inp) inp.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); onbInvoer(inp.value); } });
    const kf = document.getElementById('onbKycFile');
    if (kf) kf.addEventListener('change', function(){ const f = kf.files[0]; kf.value = ''; onbPaspoortGekozen(f); });
  })();

  /* Vervolg van app-main-08: het meebouwen aan het eind van de onboarding.
     Apart bestand omdat deel 08 over de 10 kB van het modulebeleid ging; de
     naad ligt op een top-niveau-grens, dus de functies staan nog gewoon in
     dezelfde omhulling als de rest van de poort. */
  /* Meebouwen: het eerste Salon-bericht en het eigen bedrijf. Hier staat WEL een
     vinkje en bij het inrichten niet, en dat is het verschil: deze twee verlaten
     het lid echt. Uit staat uit. Zie server/kern/onboarding/meebouwen.js. */
  let onbMb = [], onbMbHuidig = null, onbMbJa = false;
  async function onbMeebouwen(){
    let st; try { st = await API.call('/onboarding/meebouwen'); } catch(e){ return onbKlaar(); }
    if (!st || st.klaar || !(st.open || []).length) return onbKlaar();
    onbMb = st.open.slice(); onbMbVolgende();
  }
  function onbMbVolgende(){
    if (!onbMb.length) return onbKlaar();
    onbMbHuidig = onbMb.shift(); onbMbJa = false; onbStap = 'meebouw';
    const inp = onbEl('onbIn'), rij = onbEl('onbRij');
    if (rij) rij.style.display = '';
    if (inp){ inp.type = 'text'; inp.value = '';
      inp.placeholder = onbMbHuidig.id === 'salon' ? T('onb.mb.ph1','Schrijf iets') : T('onb.mb.ph2','Naam van je bedrijf'); }
    onbZeg(onbMbHuidig.vraag);
    onbMbKnoppen();
    if (inp) inp.focus();
  }
  /* Het vinkje als knop: uit is uit, en je ziet wat aan staat. Kan het gegeven
     niet -- de gratis laag mag geen bedrijf aanmelden voor de catalogus -- dan
     is er geen schakelaar maar een zin: een vinkje dat niets doet is erger dan
     geen vinkje. De server zegt dat met catalogusMag. */
  function onbMbKnoppen(){
    if (onbMbHuidig.catalogusMag === false){
      onbZeg(onbMbHuidig.vraag + ' ' + onbMbHuidig.toestemming);
      return onbActies([{ txt: T('onb.mb.sla','Sla dit over'), doe: onbMbVolgende }]);
    }
    onbActies([
      { txt: (onbMbJa ? '\u2713 ' : '') + onbMbHuidig.toestemming, doe: function(){ onbMbJa = !onbMbJa; onbMbKnoppen(); } },
      { txt: T('onb.mb.sla','Sla dit over'), doe: onbMbVolgende }
    ]);
  }
  async function onbMbOpslaan(t){
    onbBezig = true;
    const fout = onbEl('onbFout');
    try {
      if (onbMbHuidig.id === 'salon') await API.call('/onboarding/salonpost', { tekst: t, promoMag: onbMbJa });
      else {
        const r = await API.call('/onboarding/bedrijf', { naam: t, catalogus: onbMbJa });
        // Rahul zegt wat er NU gebeurt; nooit "geregeld"
        if (r && r.vervolg) toast(r.vervolg);
      }
    } catch(e){ if (fout) fout.textContent = (e && e.message) || T('onb.mis','Dat lukte niet, probeer het nog eens.'); }
    onbBezig = false; onbMbVolgende();
  }

  /* Vervolg van app-main-08: de snaps- en verhalenstrip boven de contactenkaart.
     Geknipt toen deel 08 met het inrichten (de onboarding-stap erboven) over de
     10 KB-lat ging, en langs de enige naad die er zat: hierboven is het gesprek
     bij de voordeur, hieronder De Salon. Let op de STAART: renderSnapsStories
     loopt door in deel 09, precies zoals hij dat in 08 deed -- die grens is
     alleen van bestand veranderd, niet van plek. */
  function snapOverlay(){
    let ov = document.getElementById('snapOv'); if (ov) return ov;
    ov = document.createElement('div'); ov.id='snapOv';
    ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.9);display:none;flex-direction:column;align-items:center;justify-content:center;padding:1rem;';
    ov.innerHTML='<button id="snapOvX" style="position:absolute;top:1rem;right:1rem;background:none;border:none;color:#fff;font-size:1.6rem;">✕</button>'+
      '<div id="snapOvVan" style="color:#fff;font-size:.85rem;margin-bottom:.6rem;"></div>'+
      '<img id="snapOvImg" alt="" style="max-width:100%;max-height:72vh;border-radius:0;">'+
      '<div id="snapOvTxt" style="color:#fff;margin-top:.7rem;text-align:center;"></div>'+
      '<div id="snapOvNote" style="color:#999;font-size:.72rem;margin-top:.7rem;"></div>';
    document.body.appendChild(ov);
    ov.querySelector('#snapOvX').addEventListener('click', ()=>{ ov.style.display='none'; ov.querySelector('#snapOvImg').src=''; loadSocial(); });
    return ov;
  }
  async function renderSnapsStories(){
    const el = $('#homeContacts'); if (!el || !socialOK) return;
    // verhalen-strip + inkomende snaps bovenaan de contactenkaart
    let stories = [], snaps = [];
    try { stories = (await API.call('/member/stories')).stories || []; } catch(e){}
    try { snaps = (await API.call('/member/snaps')).snaps || []; } catch(e){}
    let box = el.querySelector('#snapStrip');
    if (!box){ box = document.createElement('div'); box.id='snapStrip'; el.insertBefore(box, el.firstChild.nextSibling); }
/* de storyrij bovenaan De Salon */
    let h = '<div style="display:flex;gap:.6rem;overflow-x:auto;padding:.2rem 0 .7rem;">';
    h += '<button id="storyPlus" style="flex:0 0 auto;background:none;border:none;text-align:center;width:3.6rem;cursor:pointer;"><span style="display:flex;width:3rem;height:3rem;border-radius:50%;margin:0 auto;align-items:center;justify-content:center;font-size:1.2rem;background:var(--card2);border:2px dashed var(--gold);color:var(--rtg-leesgoud,var(--gold));">＋</span><span style="display:block;font-size:.6rem;color:var(--soft);margin-top:.2rem;">Verhaal</span></button>';
    h += stories.map(v=>'<button class="js-story" data-id="'+escT(v.id)+'" style="flex:0 0 auto;background:none;border:none;text-align:center;width:3.6rem;cursor:pointer;"><span style="display:flex;width:3rem;height:3rem;border-radius:50%;margin:0 auto;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;background:var(--card2);border:2px solid '+(v.gezien?'var(--line)':'var(--gold)')+';">'+initCN(v.van)+'</span><span style="display:block;font-size:.6rem;color:var(--soft);margin-top:.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escT(v.vanMij?'Jij':v.van)+'</span></button>').join('');
    h += '</div>';
    if (snaps.length){
      h += '<div style="display:flex;flex-direction:column;gap:.35rem;margin-bottom:.5rem;">'+snaps.map(sn=>
        '<div style="display:flex;align-items:center;gap:.5rem;font-size:.78rem;"><span></span><b style="flex:1;color:var(--rtg-leesgoud,var(--gold));">'+escT(sn.van)+'</b><span style="color:var(--soft);">stuurde een snap</span><button class="js-opensnap go" data-id="'+escT(sn.id)+'" style="padding:.15rem .55rem;">Bekijk</button></div>'
      ).join('')+'</div>';
    }
    box.innerHTML = h;
    box.querySelector('#storyPlus').addEventListener('click', storyKies);
    box.querySelectorAll('.js-story').forEach(b => b.addEventListener('click', () => openStory(b.dataset.id)));
    box.querySelectorAll('.js-opensnap').forEach(b => b.addEventListener('click', () => openSnap(b.dataset.id)));
  }
  async function openSnap(id){
    let d; try { d = await API.call('/member/snap/view', { id }); } catch(e){ toast(e.message); return; }
    const ov = snapOverlay();
    ov.querySelector('#snapOvVan').textContent = 'Snap van ' + d.van;
    ov.querySelector('#snapOvImg').src = d.foto;
    ov.querySelector('#snapOvTxt').textContent = d.tekst || '';
    ov.querySelector('#snapOvNote').textContent = T('snap.weg','Deze snap verdwijnt zodra je sluit.');
    ov.style.display='flex';
  }
  async function openStory(id){
    let d; try { d = await API.call('/member/story/view', { id }); } catch(e){ toast(e.message); return; }
    const ov = snapOverlay();
    ov.querySelector('#snapOvVan').textContent = 'Verhaal van ' + d.van;
    ov.querySelector('#snapOvImg').src = d.foto;
    ov.querySelector('#snapOvTxt').textContent = d.tekst || '';
    ov.querySelector('#snapOvNote').textContent = '';
    ov.style.display='flex';
  }

  function renderSocialBar(){
    const el = $('#socialBar'); if (!el) return;
    /* Eerst de camera vrijgeven. Deze balk wordt ook opnieuw opgebouwd door een
       binnenkomend bericht, en dan verdwijnt het video-vak uit de DOM terwijl
       de scanner er nog op draait -- met een camera die aan blijft staan als
       gevolg. Dat is geen schoonheidsfoutje maar een lampje dat blijft branden.
       pinScanUit staat in ./app-main-09a.js. */
    pinScanUit();
    if (!socialOK){ el.innerHTML = ''; return; }
    let html = '';
    for (const r of (social.requests || [])){
      /* WAARLANGS dit verzoek binnenkwam, en dat is meer dan een detail: staat
         er "via je pin" bij iemand die je niet verwacht, dan gaat de pin die je
         ooit ergens neerzette nog rond -- en dan is dit het moment om hem te
         vernieuwen. Zonder dat verschil merk je dat nooit. */
      const langs = r.via === 'pin' ? T('sal.viapin','via je pin')
                  : r.via === 'code' ? T('sal.viacode','via je live code')
                  : T('sal.wilverbinden','wil verbinden');
      html += '<div class="sc-req"><b>' + escT(r.codename) + '</b><span style="color:var(--soft);font-size:0.7rem;">' + langs + '</span>' +
        '<button class="ja" data-scja="' + escT(r.key) + '">' + T('sal.accepteer','Accepteer') + '</button>' +
        '<button data-scnee="' + escT(r.key) + '">✕</button></div>';
    }
    html += '<div class="sc-strip">' +
      '<button class="sc-p add" id="scAddBtn"><span class="sc-av">+</span><span>' + T('sal.add','Toevoegen') + '</span></button>' +
      (social.connections || []).map(c => { const nm = c.eigenNaam || c.codename; return (
        '<button class="sc-p" data-scdm="' + escT(c.key) + '" data-cn="' + escT(nm) + '" title="' + escT(c.codename) + '">' +
          '<span class="sc-av">' + initCN(nm) + (c.unread ? '<span class="sc-badge">' + c.unread + '</span>' : '') + '</span>' +
          '<span>' + escT(nm.split(' ')[0]) + '</span></button>'); }
      ).join('') + '</div>';
    html += '<div class="sc-zoek" id="scZoek"><input id="scQ" placeholder="' + T('sal.zoekph','Zoek op codenaam, bijv. Gouden Ibis') + '"><button id="scGo">' + T('sal.zoek','Zoek') + '</button></div>' +
      '<div class="sc-res" id="scRes"></div>' +
      // en de tweede weg naar dezelfde vriendschap: de contactpin (zie ./app-main-09a.js)
      '<div class="sc-pin" id="scPin"></div>';
    el.innerHTML = html;

    el.querySelectorAll('[data-scja]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/member/connect/respond', { key: b.dataset.scja, action: 'accept' }); toast(T('sal.verbonden','Verbonden.')); loadSocial(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-scnee]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/member/connect/respond', { key: b.dataset.scnee, action: 'decline' }); loadSocial(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-scdm]').forEach(b => b.addEventListener('click', () => openDm(b.dataset.scdm, b.dataset.cn)));
    const add = $('#scAddBtn'); if (add) add.addEventListener('click', () => {
      const open = $('#scZoek').classList.toggle('open');
      $('#scPin').classList.toggle('open', open);
      if (open) { pinBlokVul(); const q = $('#scQ'); if (q) q.focus(); } else pinScanUit();
    });
    const go = $('#scGo'); if (go) go.addEventListener('click', zoekLeden);
    const q = $('#scQ'); if (q) q.addEventListener('keydown', e => { if (e.key === 'Enter') zoekLeden(); });
  }

  async function zoekLeden(){
    const q = $('#scQ').value.trim();
    if (q.length < 2){ toast(T('sal.zoekkort','Typ minimaal twee letters.')); return; }
    try {
      const d = await API.call('/member/find', { q });
      $('#scRes').innerHTML = (d.results || []).map(r =>
        '<div class="sc-hit"><span class="sc-av" style="width:34px;height:34px;font-size:0.7rem;">' + initCN(r.codename) + '</span><b>' + escT(r.codename) + '</b>' +
        (r.status === 'geen' ? '<button data-scvz="' + escT(r.key) + '">' + T('sal.verzoek','Verzoek sturen') + '</button>'
         : r.status === 'verbonden' ? '<span style="color:var(--rtg-leesgroen,var(--green,#2E7D4F));font-size:0.72rem;">✓ ' + T('sal.isverbonden','verbonden') + '</span>'
         : r.status === 'aangevraagd' ? '<span style="color:var(--soft);font-size:0.72rem;">' + T('sal.gevraagd','aangevraagd') + '</span>'
         : '<span style="color:var(--rtg-leesgoud,var(--gold));font-size:0.72rem;">' + T('sal.wachtu','wacht op u') + '</span>') + '</div>'
      ).join('') || '<div style="font-size:0.78rem;color:var(--soft);">' + T('sal.niksgevonden','Geen leden gevonden met deze codenaam.') + '</div>';
      $('#scRes').querySelectorAll('[data-scvz]').forEach(b => b.addEventListener('click', async () => {
        try { await API.call('/member/connect', { key: b.dataset.scvz }); toast(T('sal.verzonden','Verzoek verstuurd.')); zoekLeden(); } catch(e){ toast(e.message); }
      }));
    } catch(e){ toast(e.message); }
  }

  /* ---- de contactpin: je eigen code, als tekst en als QR ----

     Zoeken op codenaam vraagt dat je iets van de ander AL weet. Een pin draait
     dat om: hij staat op je eigen scherm, je geeft hem af -- voorgelezen,
     gedeeld of voorgehouden -- en pas dan kan iemand er iets mee. De QR draagt
     precies dezelfde pin (rtg:pin:..., zie /shared/rtgcode.js), dus scannen en
     overtypen komen op hetzelfde uit.

     Zoeken en versturen staan met opzet uit elkaar: het scherm laat eerst zien
     WIE er achter de pin zit, en pas daarna is er een knop. Een gescande code
     die meteen een verzoek de deur uit doet, is een verzoek dat niemand
     bewust deed. */
  let mijnPin = null;

  function pinBlokVul(){
    const el = $('#scPin'); if (!el) return;
    el.innerHTML =
      '<div class="sc-pin-mijn">' +
        '<div class="sc-pin-kop"><span>' + T('pin.mijn','Jouw RTG PIN') + '</span>' +
          '<b id="scPinCode">' + (mijnPin ? escT(mijnPin.toon) : '·····-·····') + '</b>' +
          '<em id="scPinStatus" class="sc-pin-status">' + T('pin.veilig','beveiligd adres') + '</em></div>' +
        '<div class="sc-pin-belofte">' + T('pin.belofte','Je RTG PIN wijst je aan, maar geeft nooit toegang tot je account, geld of documenten.') + '</div>' +
        '<div class="sc-pin-akt">' +
          '<button id="scPinLive" class="aanbevolen">' + T('pin.live','Tijdelijke QR') + ' · ' + T('pin.aanbev','aanbevolen') + '</button>' +
          '<button id="scPinKopie">' + T('pin.kopieer','Kopieer') + '</button>' +
          '<button id="scPinQr">' + T('pin.qr','Vaste QR') + '</button>' +
          '<button id="scPinNieuw">' + T('pin.nieuw','Nieuwe pin') + '</button>' +
          '<button id="scPinUit">' + (mijnPin && mijnPin.uit ? T('pin.aan','Pin aanzetten') : T('pin.uit','Pin uitzetten')) + '</button>' +
          '<button id="scPinNood" class="gevaar">' + T('pin.nood','Noodslot') + '</button>' +
        '</div>' +
        '<img id="scPinQrBeeld" alt="' + T('pin.qralt','QR-code met jouw pin') + '" hidden>' +
        '<div id="scPinLiveDoek" hidden></div>' +
        '<div id="scPinUitNoot" class="sc-pin-noot"' + (mijnPin && mijnPin.uit ? '' : ' hidden') + '>' +
          T('pin.uitnoot','Je vaste pin staat uit: niemand kan je er nog mee toevoegen. Een live code werkt wel: die houd je bewust op.') + '</div>' +
        '<div id="scPinNoodNoot" class="sc-pin-noot alarm" hidden>' +
          T('pin.noodnoot','Noodslot actief: vaste én tijdelijke PIN-handelingen zijn geblokkeerd. Bestaande vrienden blijven behouden.') + '</div>' +
        '<div id="scPinHistorie" class="sc-pin-historie"></div>' +
      '</div>' +
      '<div class="sc-zoek open">' +
        '<input id="scPinIn" maxlength="13" autocapitalize="characters" spellcheck="false" placeholder="' + T('pin.ph','RTG PIN, bijv. 7K2M9-XPQH3') + '">' +
        '<button id="scPinGo">' + T('pin.zoek','Zoek') + '</button>' +
        '<button id="scPinScan" class="grijs">' + T('pin.scan','Scan') + '</button>' +
      '</div>' +
      '<div class="sc-res" id="scPinRes"></div>';
    $('#scPinKopie').addEventListener('click', pinKopieer);
    $('#scPinQr').addEventListener('click', pinQrWissel);
    $('#scPinNieuw').addEventListener('click', pinNieuw);
    $('#scPinLive').addEventListener('click', pinLiveWissel);
    $('#scPinUit').addEventListener('click', pinUitWissel);
    $('#scPinNood').addEventListener('click', pinNoodslotWissel);
    $('#scPinGo').addEventListener('click', () => pinOpzoeken($('#scPinIn').value));
    $('#scPinScan').addEventListener('click', pinScanOpen);
    $('#scPinIn').addEventListener('keydown', e => { if (e.key === 'Enter') pinOpzoeken($('#scPinIn').value); });
    if (!mijnPin) pinHalen();
  }

  async function pinHalen(){
    try { mijnPin = await API.call('/member/pin', {}); } catch(e){ return; }
    pinStandTonen();
  }
  // een uitgezette pin blijft leesbaar (het is je pin, je mag hem zien) maar
  // draagt zichtbaar dat hij niemand aanwijst
  function pinStandTonen(){
    const c = $('#scPinCode'); if (!c || !mijnPin) return;
    c.textContent = mijnPin.toon;
    c.classList.toggle('uit', !!mijnPin.uit);
    const u = $('#scPinUit'); if (u) u.textContent = mijnPin.uit ? T('pin.aan','Pin aanzetten') : T('pin.uit','Pin uitzetten');
    const n = $('#scPinUitNoot'); if (n) n.hidden = !mijnPin.uit;
  }
  async function pinNieuw(){
    if (!confirm(T('pin.nieuwvraag','Een nieuwe pin maken? Wie je oude pin nog heeft, kan je daarmee niet meer toevoegen. Je huidige vrienden merken er niets van.'))) return;
    try { mijnPin = await API.call('/member/pin/nieuw', {}); } catch(e){ toast(e.message); return; }
    pinStandTonen();
    const b = $('#scPinQrBeeld'); if (b && !b.hidden) pinQrTeken();
    toast(T('pin.nieuwok','Je hebt een nieuwe pin.'));
  }
  function pinKopieer(){
    if (!mijnPin) return;
    /* Zonder klembord (oudere webweergaven, of een pagina zonder toestemming)
       niet stil mislukken: dan selecteren we de pin zodat hij met de hand te
       kopieren is. Een knop die niets doet en niets zegt is erger dan geen knop. */
    const klaar = () => toast(T('pin.gekopieerd','Pin gekopieerd.'));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(mijnPin.toon).then(klaar, () => pinSelecteer());
    } else pinSelecteer();
  }
  function pinSelecteer(){
    const el = $('#scPinCode'); if (!el || !window.getSelection) return;
    const r = document.createRange(); r.selectNodeContents(el);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    toast(T('pin.selecteer','Kopieer de pin met de hand.'));
  }
  function pinQrWissel(){
    const b = $('#scPinQrBeeld'); if (!b) return;
    if (!b.hidden) { b.hidden = true; return; }
    if (!pinQrTeken()) return;
    b.hidden = false;
  }
  function pinQrTeken(){
    const b = $('#scPinQrBeeld');
    if (!b || !mijnPin || !window.RTGQRteken || !window.RTGCode) { toast(T('pin.qrniet','De QR-code kan hier niet getekend worden.')); return false; }
    try { b.src = RTGQRteken.dataURLRTG(RTGCode.bouwPin(mijnPin.pin), { schaal: 5 }); }
    catch(e){ toast(T('pin.qrniet','De QR-code kan hier niet getekend worden.')); return false; }
    return true;
  }

  /* Scannen gaat langs de HUISOVERLAY (/shared/scanknop.js). Hier stond een
     eigen camerablad met een RTGScanner eromheen -- de laatste tweede
     uitvoering van iets dat het huis al heeft. Wat dit scherm ermee wint is
     geen netheid maar een uitweg: de overlay draagt altijd een handinvoer, en
     legt uit waarom de camera niet start (buiten https geeft de browser hem
     niet vrij -- op een telefoon de meest voorkomende reden). Het beeld
     verlaat het toestel nog steeds niet.

     Een gescande code die GEEN RTG-pin is, houdt de overlay open: `onCode` mag
     `false` teruggeven. Anders viel het venster dicht op een verkeerde QR en
     moest een mens opnieuw beginnen. */
  function pinScanOpen(){
    if (!window.RTGScanknop) { toast(T('pin.scanniet','Scannen kan hier niet. Typ de pin over.')); return; }
    RTGScanknop.open({
      titel: T('pin.scantitel','Pin scannen'),
      hint: T('pin.scanhint','Richt de camera op de QR van de ander.'),
      handTekst: T('pin.oftyp','Of typ de code'),
      onCode: (c) => {
        const g = window.RTGCode ? RTGCode.lees(c.tekst) : { soort: 'tekst', tekst: c.tekst };
        /* Twee soorten, want er zijn er twee: de vaste pin staat leesbaar in de
           code (rtg:pin:...), de levende is een ondertekend token (RTG1....) dat
           alleen de server kan duiden. Voor wie scant is dat hetzelfde gebaar. */
        if (g.soort === 'rtg1') { pinLiveKijken(g.token); return; }
        if (g.soort !== 'pin') { toast(T('pin.geenpin','Dit is geen RTG-pin.')); return false; }
        $('#scPinIn').value = g.pin;
        pinOpzoeken(g.pin);
      }
    });
  }
  /* Blijft bestaan, en niet als restje: hij stopt de LEVENDE CODE, die zichzelf
     elke minuut ververst en niet hoort door te lopen in een la die dicht is of
     een balk die weg is. Het camerawerk zat er alleen bij in; dat doet de
     overlay nu zelf. */
  function pinScanUit(){
    pinLiveUit();
  }

  // stap 1: wie is dit? (nog niets versturen)
  /* De trefferregel, EEN KEER. Hij stond hier en in ./app-main-09a2.js in twee
     kopieen die alleen in de knop verschilden -- en dat is precies het soort
     verdubbeling dat een half jaar later uit elkaar loopt, met een vaste pin
     die "verbonden" zegt waar de levende code "vriend" zegt. De opmaak zit nu
     in klassen (zie .sc-st in apps/app.html) in plaats van in style-attributen;
     die houden style-src-attr in de CSP open. */
  function pinRegel(codename, status, knopHtml){
    const staat = status === 'verbonden' ? '<span class="sc-st ok">✓ ' + T('sal.isverbonden','verbonden') + '</span>'
      : status === 'aangevraagd' ? '<span class="sc-st">' + T('sal.gevraagd','aangevraagd') + '</span>'
      : status === 'geen' ? knopHtml
      : '<span class="sc-st wacht">' + T('sal.wachtu','wacht op u') + '</span>';
    return '<div class="sc-hit"><span class="sc-av klein">' + initCN(codename) + '</span><b>' +
      escT(codename) + '</b>' + staat + '</div>';
  }
  const pinMelding = tekst => '<div class="sc-hit"><span class="sc-st">' + escT(tekst) + '</span></div>';

  async function pinOpzoeken(ruw){
    const res = $('#scPinRes'); if (!res) return;
    const pin = String(ruw || '').trim();
    if (!pin) return;
    res.innerHTML = '';
    let d;
    try { d = await API.call('/member/pin/zoek', { pin }); }
    catch(e){ res.innerHTML = pinMelding(e.message); return; }
    res.innerHTML = pinRegel(d.codename, d.status,
      '<button data-pinvz="' + escT(pin) + '" data-pinbevestig="' + escT(d.bevestiging) + '">' + T('sal.verzoek','Verzoek sturen') + '</button>');
    const b = res.querySelector('[data-pinvz]');
    if (b) b.addEventListener('click', () => pinVerbinden(b.dataset.pinvz, b.dataset.pinbevestig));
  }
  /* stap 2: en nu pas versturen -- omdat een mens erop drukte.

     GEEN loadSocial() erna, en dat is geen vergeetachtigheid. renderSocialBar
     bouwt de hele balk opnieuw op (innerHTML), dus die la klapt eronder dicht
     terwijl je er nog in staat -- en de regel die net "aangevraagd" ging zeggen
     is dan al weg. De regel zelf werken we hieronder bij; een verstuurd verzoek
     verandert aan de vriendenlijst nog niets, dus er valt ook niets te
     verversen. Zoeken op codenaam doet het om dezelfde reden zo. */
  async function pinVerbinden(pin, bevestiging){
    try { await API.call('/member/pin/connect', { pin, bevestiging }); }
    catch(e){ toast(e.message); return; }
    toast(T('sal.verzonden','Verzoek verstuurd.'));
    await pinOpzoeken(pin);
  }
  /* ---- jouw RTG PIN: stand, veiligheidsjournaal en vaste QR ---- */
  async function pinHalen(){
    try { mijnPin = await API.call('/member/pin', {}); } catch(e){ return; }
    pinStandTonen();
  }
  // een uitgezette pin blijft leesbaar (het is je pin, je mag hem zien) maar
  // draagt zichtbaar dat hij niemand aanwijst
  function pinStandTonen(){
    const c = $('#scPinCode'); if (!c || !mijnPin) return;
    c.textContent = mijnPin.toon;
    c.classList.toggle('uit', !!mijnPin.uit || !!mijnPin.bevroren);
    const u = $('#scPinUit'); if (u) u.textContent = mijnPin.uit ? T('pin.aan','Pin aanzetten') : T('pin.uit','Pin uitzetten');
    const n = $('#scPinUitNoot'); if (n) n.hidden = !mijnPin.uit;
    const nn = $('#scPinNoodNoot'); if (nn) nn.hidden = !mijnPin.bevroren;
    const nk = $('#scPinNood'); if (nk) nk.textContent = mijnPin.bevroren ? T('pin.nooduit','Noodslot opheffen') : T('pin.nood','Noodslot');
    const st = $('#scPinStatus'); if (st) {
      st.textContent = mijnPin.bevroren ? T('pin.dicht','alles geblokkeerd') : mijnPin.uit ? T('pin.vastuit','vast adres uit') : T('pin.veilig','beveiligd adres');
      st.classList.toggle('alarm', !!mijnPin.bevroren);
    }
    pinHistorieTonen();
  }
  function pinHistorieTonen(){
    const vak = $('#scPinHistorie'); if (!vak || !mijnPin) return;
    const regels = (mijnPin.gebeurtenissen || []).slice(0, 5);
    if (!regels.length) { vak.innerHTML = ''; return; }
    const namen = { pin_gemaakt:'RTG PIN aangemaakt', pin_vernieuwd:'RTG PIN vernieuwd', pin_bekeken:'Vaste PIN bekeken',
      pin_verzoek:'Contactverzoek ontvangen', pin_bevestigd:'Contact bevestigd', livecode_gemaakt:'Tijdelijke QR getoond',
      livecode_bekeken:'Tijdelijke QR gescand', livecode_bevestigd:'Tijdelijk contact bevestigd',
      vaste_pin_uit:'Vaste PIN uitgezet', vaste_pin_aan:'Vaste PIN aangezet', noodslot_aan:'Noodslot aangezet', noodslot_uit:'Noodslot opgeheven' };
    vak.innerHTML = '<strong>' + T('pin.historie','Recente veiligheid') + '</strong>' + regels.map(r =>
      '<div><span>' + escT(namen[r.soort] || r.soort) + (r.aantal > 1 ? ' ×' + Number(r.aantal) : '') + '</span><time>' +
      escT(new Date(r.laatst || r.at).toLocaleString()) + '</time></div>').join('');
  }
  async function pinNieuw(){
    if (!confirm(T('pin.nieuwvraag','Een nieuwe pin maken? Wie je oude pin nog heeft, kan je daarmee niet meer toevoegen. Je huidige vrienden merken er niets van.'))) return;
    try {
      const bewijs = await pinPasskeyBewijs('rtg-pin-vernieuw');
      mijnPin = await API.call('/member/pin/nieuw', bewijs);
    } catch(e){ toast(e.message); return; }
    pinStandTonen();
    const b = $('#scPinQrBeeld'); if (b && !b.hidden) pinQrTeken();
    toast(T('pin.nieuwok','Je hebt een nieuwe pin.'));
  }
  function pinKopieer(){
    if (!mijnPin) return;
    /* Zonder klembord (oudere webweergaven, of een pagina zonder toestemming)
       niet stil mislukken: dan selecteren we de pin zodat hij met de hand te
       kopieren is. Een knop die niets doet en niets zegt is erger dan geen knop. */
    const klaar = () => toast(T('pin.gekopieerd','Pin gekopieerd.'));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(mijnPin.toon).then(klaar, () => pinSelecteer());
    } else pinSelecteer();
  }
  function pinSelecteer(){
    const el = $('#scPinCode'); if (!el || !window.getSelection) return;
    const r = document.createRange(); r.selectNodeContents(el);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    toast(T('pin.selecteer','Kopieer de pin met de hand.'));
  }
  function pinQrWissel(){
    const b = $('#scPinQrBeeld'); if (!b) return;
    if (!b.hidden) { b.hidden = true; return; }
    if (!pinQrTeken()) return;
    b.hidden = false;
  }
  function pinQrTeken(){
    const b = $('#scPinQrBeeld');
    if (!b || !mijnPin || !window.RTGQRteken || !window.RTGCode) { toast(T('pin.qrniet','De QR-code kan hier niet getekend worden.')); return false; }
    try { b.src = RTGQRteken.dataURLRTG(RTGCode.bouwPin(mijnPin.pin), { schaal: 5 }); }
    catch(e){ toast(T('pin.qrniet','De QR-code kan hier niet getekend worden.')); return false; }
    return true;
  }
  /* ---- de levende code en de aan/uit-schakelaar ----

     De vaste pin uit ./app-main-09a.js is een adres: hij blijft werken, ook als
     je allang niet meer weet aan wie je hem gaf. Dat is precies wat je wilt
     wanneer hij in je profiel staat, en precies wat je NIET wilt wanneer je
     tegenover iemand staat. Daar hoort een code bij die na 45 seconden niets
     meer is en je pin niet eens draagt (server/kern/sociaal/pin-live.js).

     De toner is dezelfde als die van de RTG-code (/shared/dyncode.js): hij
     tekent, telt af en haalt net voor het verval vanzelf een verse. Alleen de
     deur is een andere, want bij een contactcode bepaalt de SERVER wat erin
     komt te staan -- de client mag daar niets over te zeggen hebben. */
  let pinLive = null;

  /* Gevoelige wijzigingen worden, zodra het account een passkey heeft, aan
     precies deze handeling gebonden. Geen herbruikbaar "2FA was recent"-vinkje:
     vernieuwen, noodslot opheffen en het vaste adres weer aanzetten krijgen elk
     hun eigen eenmalige WebAuthn-challenge. */
  async function pinPasskeyBewijs(actie){
    const o = await API.call('/member/pin/actie/opties', { actie });
    if (!o.nodig) return {};
    if (!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.get))
      throw new Error(T('pin.pkgeen','Deze wijziging vraagt je passkey. Open dit op een toestel met je Face ID, vingerafdruk of beveiligingssleutel.'));
    const b2u = s => Uint8Array.from(atob(String(s).replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
    const u2b = buf => btoa(String.fromCharCode.apply(null,new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const pub = o.opties;
    pub.challenge = b2u(pub.challenge);
    pub.allowCredentials = (pub.allowCredentials || []).map(c => Object.assign({},c,{ id:b2u(c.id) }));
    const cred = await navigator.credentials.get({ publicKey:pub });
    const antwoord = { id:cred.id, rawId:u2b(cred.rawId), type:cred.type,
      clientExtensionResults:cred.getClientExtensionResults(), response:{
        authenticatorData:u2b(cred.response.authenticatorData), clientDataJSON:u2b(cred.response.clientDataJSON),
        signature:u2b(cred.response.signature), userHandle:cred.response.userHandle?u2b(cred.response.userHandle):null } };
    return { ceremonie:o.ceremonie, antwoord };
  }

  function pinLiveWissel(){
    const doek = $('#scPinLiveDoek'); if (!doek) return;
    if (pinLive) { pinLiveUit(); return; }
    if (!window.RTGDyn || !window.RTGQRteken) { toast(T('pin.qrniet','De QR-code kan hier niet getekend worden.')); return; }
    // de vaste QR en de levende code delen een plek: twee codes naast elkaar
    // is precies de verwarring die dit onderscheid juist moet wegnemen
    const beeld = $('#scPinQrBeeld'); if (beeld) beeld.hidden = true;
    doek.hidden = false;
    // het volledige pad, want RTGDyn praat rechtstreeks met fetch en niet via
    // API.call (die zet er zelf /api voor)
    pinLive = RTGDyn.plaats(doek, { pad: '/api/member/pin/live', lijf: {}, ttlMs: 45000, schaal: 6 });
    $('#scPinLive').textContent = T('pin.livestop','Verberg live code');
  }
  function pinLiveUit(){
    if (pinLive) { try { pinLive.stop(); } catch(e){} pinLive = null; }
    const doek = $('#scPinLiveDoek'); if (doek) { doek.hidden = true; doek.innerHTML = ''; }
    const knop = $('#scPinLive'); if (knop) knop.textContent = T('pin.live','Live code');
  }

  /* Een gescande levende code. Zelfde volgorde als bij de vaste pin: eerst zien
     wie het is, dan pas een knop -- en de code gaat pas op bij het verbinden,
     zodat een blik op de verkeerde persoon niet andermans code verbrandt.
     De sleutel komt hier niet mee terug: de code zelf is het bewijs, dus het
     scherm hoeft nooit te weten hoe iemand in de database heet. */
  async function pinLiveKijken(token){
    const res = $('#scPinRes'); if (!res) return;
    res.innerHTML = '';
    let d;
    try { d = await API.call('/member/pin/live/kijk', { livecode: token }); }
    catch(e){ res.innerHTML = pinMelding(e.message); return; }
    // dezelfde regel als bij de vaste pin (pinRegel in ./app-main-09a.js): het
    // is dezelfde mens en dezelfde stand, alleen langs een andere weg gevonden
    res.innerHTML = pinRegel(d.codename, d.status,
      '<button data-pinlv="1" data-pinbevestig="' + escT(d.bevestiging) + '">' + T('sal.verzoek','Verzoek sturen') + '</button>');
    const b = res.querySelector('[data-pinlv]');
    if (b) b.addEventListener('click', async () => {
      try { await API.call('/member/pin/live/verbind', { livecode: token, bevestiging: b.dataset.pinbevestig }); }
      catch(e){ toast(e.message); return; }
      toast(T('sal.verzonden','Verzoek verstuurd.'));
      b.replaceWith(Object.assign(document.createElement('span'),
        { className: 'sc-st', textContent: '✓ ' + T('sal.gevraagd','aangevraagd') }));
    });
  }

  /* De pin uitzetten. Vernieuwen helpt tegen een pin die is rondgegaan; dit is
     het andere verzoek -- ik wil helemaal niet zo gevonden worden. Het scherm
     zegt er meteen bij wat er dan nog wel werkt, want een schakelaar die meer
     uitzet dan je denkt is erger dan geen schakelaar. */
  async function pinUitWissel(){
    if (!mijnPin) return;
    const uit = !mijnPin.uit;
    if (uit && !confirm(T('pin.uitvraag','Je vaste pin uitzetten? Niemand kan je er dan nog mee toevoegen. Je vrienden merken er niets van, en een live code werkt gewoon.'))) return;
    try {
      const bewijs = uit ? {} : await pinPasskeyBewijs('rtg-pin-vast-aan');
      mijnPin = await API.call('/member/pin/uit', Object.assign({ uit }, bewijs));
    } catch(e){ toast(e.message); return; }
    pinStandTonen();
    toast(uit ? T('pin.uitok','Je pin staat uit.') : T('pin.aanok','Je pin staat weer aan.'));
  }

  /* Het noodslot is expres een andere handeling dan de vaste pin uitzetten:
     dit blokkeert ook levende codes en alle nieuwe uitgaande PIN-handelingen.
     Aanzetten moet altijd snel kunnen; opheffen vraagt een expliciete tweede
     bevestiging en blijft zichtbaar in het veiligheidsjournaal. */
  async function pinNoodslotWissel(){
    if (!mijnPin) return;
    const aan = !mijnPin.bevroren;
    const vraag = aan
      ? T('pin.noodvraag','Noodslot aanzetten? Alle nieuwe vaste en tijdelijke RTG PIN-handelingen stoppen onmiddellijk. Bestaande vrienden blijven behouden.')
      : T('pin.nooduitvraag','Noodslot opheffen? Controleer eerst of je account en apparaten veilig zijn.');
    if (!confirm(vraag)) return;
    try {
      const bewijs = aan ? {} : await pinPasskeyBewijs('rtg-pin-noodslot-uit');
      mijnPin = await API.call('/member/pin/uit', Object.assign({ bevroren: aan }, bewijs));
    }
    catch(e){ toast(e.message); return; }
    if (aan) pinLiveUit();
    pinStandTonen();
    toast(aan ? T('pin.noodok','Noodslot actief.') : T('pin.nooduitok','Noodslot opgeheven.'));
  }
/* de directe berichten openen */
  async function openDm(key, naam){
    dmWith = key; dmNaam = naam;
    $('#dmNaam').textContent = naam;
    $('#dm-sheet').classList.add('open'); $('#dm-scrim').classList.add('open');
    await laadDm();
    loadSocial(); // ongelezen-teller bijwerken
  }
  async function laadDm(){
    if (!dmWith) return;
    try {
      const d = await API.call('/member/dm', { withKey: dmWith });
      $('#dmBody').innerHTML = (d.messages || []).map(m => dmBubbel(m)).join('') ||
        '<div style="font-size:0.78rem;color:var(--soft);text-align:center;margin:auto 0;">' + T('sal.dm.leeg','Nog geen berichten. Zeg hallo.') + '</div>';
      vertaalBubbels($('#dmBody'));
      $('#dmBody').scrollTop = 999999;
    } catch(e){ toast(e.message); }
  }
  // Vertaal binnenkomende berichten naar de gekozen taal van de lezer. Alleen
  // berichten van de ander (.xlate) worden vertaald; eigen berichten niet.
  function vertaalBubbels(root){
    if (!root || !window.Vertaal) return;
    root.querySelectorAll('.xlate:not([data-vt])').forEach(function(el){
      el.setAttribute('data-vt','1');
      Vertaal.vul(el, el.textContent, lang());
    });
  }
  function dmBubbel(m){
    const mijn = m.from === social.me;
    const tijd = new Date(m.at).toLocaleTimeString(lang()==='en'?'en-GB':'nl-NL',{hour:'2-digit',minute:'2-digit'});
    const emo = s => window.RTGEmoji ? RTGEmoji.render(escT(s)) : escT(s);
    const txt = mijn ? emo(m.text) : '<span class="xlate">' + escT(m.text) + '</span>';
    return '<div class="dm-m' + (mijn ? ' mine' : '') + '">' + txt +
      (m.post ? '<div class="dm-post"><b>↗ ' + escT(m.post.author) + ' · ' + escT(m.post.place) + '</b>' + escT(m.post.text) + '…</div>' : '') +
      '<span class="tijd">' + tijd + '</span></div>';
  }
  function dmToevoegen(m){ const b = $('#dmBody'); b.insertAdjacentHTML('beforeend', dmBubbel(m)); vertaalBubbels(b); b.scrollTop = 999999; }
  async function stuurDm(){
    const text = $('#dmInput').value.trim();
    if (!text || !dmWith) return;
/* de directe berichten: versturen en aan het gesprek toevoegen */
    $('#dmInput').value = '';
    try {
      const d = await API.call('/member/dm/send', { toKey: dmWith, text });
      dmToevoegen(d.message);
    } catch(e){ toast(e.message); }
  }
  $('#dmSend').addEventListener('click', stuurDm);
  $('#dmInput').addEventListener('keydown', e => { if (e.key === 'Enter') stuurDm(); });
  // RTG-eigen emoji-kiezer bij de DM-invoer
  (function(){ const inp = $('#dmInput'); if (inp && inp.parentNode && window.RTGEmoji && !inp.parentNode.querySelector('.rtg-emo-knop')) { inp.parentNode.insertBefore(RTGEmoji.knop(inp), inp); } })();
  const dmDicht = () => { $('#dm-sheet').classList.remove('open'); $('#dm-scrim').classList.remove('open'); dmWith = null; };
  $('#dmClose').addEventListener('click', dmDicht);
  $('#rideGo').addEventListener('click', verstuurRit);
  $('#rideClose').addEventListener('click', () => { $('#ride-sheet').classList.remove('open'); $('#ride-scrim').classList.remove('open'); });
  $('#ride-scrim').addEventListener('click', () => { $('#ride-sheet').classList.remove('open'); $('#ride-scrim').classList.remove('open'); });
  $('#dm-scrim').addEventListener('click', dmDicht);

  /* ---- post delen ---- */
  let deelPost = null;
  function openShare(postId){
    if (!socialOK){ toast(T('sal.eerstlid','Alleen voor leden.')); return; }
    if (!(social.connections || []).length){ toast(T('sal.geenconn','Nog geen connecties. Voeg eerst iemand toe in De Salon.')); return; }
    deelPost = postId;
    $('#shareList').innerHTML = social.connections.map(c =>
      '<button class="sc-hit" style="width:100%;cursor:pointer;" data-deel="' + escT(c.key) + '"><span class="sc-av" style="width:34px;height:34px;font-size:0.7rem;">' + initCN(c.codename) + '</span><b>' + escT(c.codename) + '</b><span style="color:var(--rtg-leesgoud,var(--gold));font-size:0.72rem;">↗</span></button>'
    ).join('');
    $('#shareList').querySelectorAll('[data-deel]').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/member/dm/send', { toKey: b.dataset.deel, postId: deelPost, text: '' });
        toast(T('sal.gedeeld','Gedeeld.'));
        $('#share-sheet').classList.remove('open'); $('#share-scrim').classList.remove('open');
      } catch(e){ toast(e.message); }
    }));
    $('#share-sheet').classList.add('open'); $('#share-scrim').classList.add('open');
  }
  $('#shareClose').addEventListener('click', () => { $('#share-sheet').classList.remove('open'); $('#share-scrim').classList.remove('open'); });
  $('#share-scrim').addEventListener('click', () => { $('#share-sheet').classList.remove('open'); $('#share-scrim').classList.remove('open'); });

  /* ---- bellen en videobellen (WebRTC) ---- */
  let call = null;        // { pc, stream, withKey, naam, video, richting, pendingIce, timer, t0 }
  let inkomend = null;    // { from, codename, video }
  let csMee = null;       // de tekstbaan van het gesprek (shared/meelezen.js)

  /* MEELEZEN. Zonder tekstbaan kan wie doof is niet meedoen aan een gesprek in
     dit huis (TOEGANKELIJK.md). Getypt EN, waar een lokaal model draait,
     herkend uit de eigen stem -- zie /shared/meelezen.js en /shared/meeluister.js. */
  function csBaan(){
    if (csMee || !window.RTGMeelezen) return csMee;
    csMee = window.RTGMeelezen.maak({
      stroom: () => (call && call.stream) || null,
      stuur: r => {
        if (call) API.call('/member/call', { toKey: call.withKey, kind: 'tekst', payload: { r } }).catch(()=>{});
      } });
    csMee.el.style.cssText += 'position:absolute;left:12px;right:12px;bottom:96px;z-index:4;color:#F7F5F1;';
    const scherm = $('#callScreen'); if (scherm) scherm.appendChild(csMee.el);
    return csMee;
  }

  function belUI(open){
    $('#callScreen').classList.toggle('open', !!open);
    if (open) csBaan();
    if (!open){ $('#csRemote').srcObject = null; $('#csLocal').srcObject = null; if (csMee) csMee.leeg(); }
  }
  function belTimer(){
    if (!call) return;
    const s = Math.round((Date.now() - call.t0) / 1000);
    $('#csTijd').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  let iceConfig = null;
  // Elke oproep verse ICE-servers (TURN met kort geldige inloggegevens roteert).
  async function haalIce(){ try { iceConfig = (await (await fetch('/api/ice')).json()).iceServers; } catch(e){ iceConfig = [{ urls:'stun:stun.l.google.com:19302' }]; } return iceConfig; }
  function maakPc(){
    const pc = new RTCPeerConnection({ iceServers: iceConfig || [{ urls:'stun:stun.l.google.com:19302' }] });
    call.stream.getTracks().forEach(t => pc.addTrack(t, call.stream));
    pc.onicecandidate = ev => { if (ev.candidate && call) API.call('/member/call', { toKey: call.withKey, kind: 'ice', payload: ev.candidate }).catch(()=>{}); };
    pc.ontrack = ev => {
      const v = $('#csRemote');
      if (v.srcObject !== ev.streams[0]) v.srcObject = ev.streams[0];
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected' && call && !call.t0){ call.t0 = Date.now(); call.timer = setInterval(belTimer, 1000); }
      if (pc.connectionState === 'failed'){ toast(T('sal.belmislukt','Verbinding mislukt. Op een streng netwerk lukt bellen soms niet.')); eindeGesprek(false); }
      else if (pc.connectionState === 'closed') eindeGesprek(false);
    };
    call.pc = pc;
    window.__rtgCall = () => call; // voor tests
    return pc;
  }
  async function pakMedia(video){
    // shared/media.js noemt de oorzaak en plaatst de volle uitleg zelf
    try { return await RTGMedia.vraag({ audio: true, video: video ? { facingMode: 'user' } : false }); }
    catch(e){ toast((e.rtg && e.rtg.kort) || T('sal.geenmedia','Geen toegang tot microfoon of camera.')); return null; }
  }
  function toonGesprek(naam, video){
    $('#csNaam').textContent = naam; $('#csNaam2').textContent = naam;
    $('#csAv').textContent = initCN(naam);
    $('#csAudioOnly').style.display = video ? 'none' : 'flex';
    $('#csLocal').style.display = video ? '' : 'none';
    $('#csCam').style.display = video ? '' : 'none';
    $('#csTijd').textContent = T('sal.belt','gaat over…');
    belUI(true);
  }
  async function beginGesprek(video){
    if (!dmWith) return;
    if (call){ toast(T('sal.algesprek','Er loopt al een gesprek.')); return; }
    await haalIce();
    const stream = await pakMedia(video);
    if (!stream) return;
    call = { withKey: dmWith, naam: dmNaam, video, richting: 'uit', pendingIce: [], stream, t0: 0 };
    $('#csLocal').srcObject = stream;
    toonGesprek(dmNaam, video);
    try { await API.call('/member/call', { toKey: call.withKey, kind: 'ring', video }); }
    catch(e){ toast(e.message); eindeGesprek(false); }
  }
  $('#dmBel').addEventListener('click', () => beginGesprek(false));
  $('#dmVideo').addEventListener('click', () => beginGesprek(true));
  $('#dmBlok').addEventListener('click', async () => {
    if (!dmWith) return;
    const keuze = prompt('Wat wil je doen met ' + dmNaam + '?\n\n1 = Blokkeren\n2 = Melden\n3 = Blokkeren en melden', '1');
    if (keuze === null) return;
    try {
      if (keuze === '2' || keuze === '3') { const reden = prompt('Wat is er aan de hand?', '') || ''; await API.call('/member/report', { key: dmWith, reden }); }
      if (keuze === '1' || keuze === '3') { await API.call('/member/block', { key: dmWith }); $('#dm-sheet').classList.remove('open'); loadSocial(); }
      toast(keuze === '2' ? T('sal.gemeld', 'Bedankt, je melding is doorgegeven.') : T('sal.geblokkeerd', 'Geblokkeerd.'));
    } catch (e) { toast(e.message); }
  });

  async function neemOp(){
    $('#callIncoming').classList.remove('open');
    if (!inkomend) return;
    await haalIce();
    const stream = await pakMedia(inkomend.video);
    if (!stream){ API.call('/member/call', { toKey: inkomend.from, kind: 'decline' }).catch(()=>{}); inkomend = null; return; }
    call = { withKey: inkomend.from, naam: inkomend.codename, video: inkomend.video, richting: 'in', pendingIce: [], stream, t0: 0 };
    $('#csLocal').srcObject = stream;
    toonGesprek(inkomend.codename, inkomend.video);
    await API.call('/member/call', { toKey: call.withKey, kind: 'accept' }).catch(()=>{});
    inkomend = null;
  }
  $('#ciJa').addEventListener('click', neemOp);
  $('#ciNee').addEventListener('click', () => {
    $('#callIncoming').classList.remove('open');
    if (inkomend) API.call('/member/call', { toKey: inkomend.from, kind: 'decline' }).catch(()=>{});
    inkomend = null;
  });

  function eindeGesprek(zeggen){
    if (!call) { belUI(false); return; }
    if (zeggen) API.call('/member/call', { toKey: call.withKey, kind: 'hangup' }).catch(()=>{});
    clearInterval(call.timer);
    try { call.stream.getTracks().forEach(t => t.stop()); } catch(e){}
    try { if (call.pc) call.pc.close(); } catch(e){}
    call = null;
    belUI(false);
  }
  $('#csWeg').addEventListener('click', () => eindeGesprek(true));
  $('#csMute').addEventListener('click', () => {
    if (!call) return;
    const t = call.stream.getAudioTracks()[0]; if (!t) return;
    t.enabled = !t.enabled;
    $('#csMute').classList.toggle('dicht', !t.enabled);
  });
  $('#csCam').addEventListener('click', () => {
    if (!call) return;
    const t = call.stream.getVideoTracks()[0]; if (!t) return;
    t.enabled = !t.enabled;
    $('#csCam').classList.toggle('dicht', !t.enabled);
  });

  async function flushIce(){
    if (!call || !call.pc || !call.pc.remoteDescription) return;
    for (const c of call.pendingIce.splice(0)) { try { await call.pc.addIceCandidate(c); } catch(e){} }
  }
  async function opBelsignaal(d){
    if (d.kind === 'ring'){
      if (call){ API.call('/member/call', { toKey: d.from, kind: 'busy' }).catch(()=>{}); return; }
      inkomend = { from: d.from, codename: d.codename, video: d.video };
      $('#ciAv').textContent = initCN(d.codename);
      $('#ciNaam').textContent = d.codename;
      $('#ciSoort').textContent = d.video ? T('sal.videogesprek','Videogesprek') : T('sal.spraakoproep','Spraakoproep');
      $('#callIncoming').classList.add('open');
      return;
    }
    if (!call || d.from !== call.withKey) return;
/* het videogesprek: aanbod, antwoord en de verbinding */
    if (d.kind === 'accept'){
      const pc = maakPc();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      API.call('/member/call', { toKey: call.withKey, kind: 'offer', payload: offer }).catch(()=>{});
    } else if (d.kind === 'offer'){
      const pc = maakPc();
      await pc.setRemoteDescription(d.payload);
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      API.call('/member/call', { toKey: call.withKey, kind: 'answer', payload: answer }).catch(()=>{});
    } else if (d.kind === 'answer'){
      await call.pc.setRemoteDescription(d.payload);
      await flushIce();
    } else if (d.kind === 'ice'){
      if (call.pc && call.pc.remoteDescription) { try { await call.pc.addIceCandidate(d.payload); } catch(e){} }
      else call.pendingIce.push(d.payload);
    } else if (d.kind === 'tekst'){
      const m = csBaan();
      if (m && d.payload && d.payload.r) m.voed(d.payload.r, { wie: d.codename, bron: 'mens' });
    } else if (d.kind === 'hangup' || d.kind === 'decline' || d.kind === 'busy'){
      toast(d.kind === 'busy' ? T('sal.bezet','In gesprek.') : d.kind === 'decline' ? T('sal.geweigerd','Oproep geweigerd.') : T('sal.opgehangen','Gesprek beëindigd.'));
      eindeGesprek(false);
    }
  }

  function opSociaal(d){
    if (d.kind === 'request'){ toast('' + d.from + ' ' + T('sal.wilverbinden','wil verbinden')); loadSocial(); }
    else if (d.kind === 'accepted'){ toast('' + d.by + ' ' + T('sal.accepteerde','accepteerde uw verzoek')); loadSocial(); }
    else if (d.kind === 'dm'){
      if (dmWith === d.from && $('#dm-sheet').classList.contains('open')){
        dmToevoegen({ from: d.from, text: d.text, post: d.post, at: d.at });
        API.call('/member/dm', { withKey: d.from }).catch(()=>{}); // gelezen
      } else {
        toast('' + d.codename + ': ' + (d.text || '↗').slice(0, 60));
        loadSocial();
      }
    }
  }


  /* seam voor de RTG OS-laag: de eigen Bellen-, Videobellen- en Snaps-apps
     openen hiermee een kiezer en starten dan direct het gesprek of de snap */
  window.RTGSocial = {
    ok: () => socialOK,
    lijst: () => (social.connections || []),
    bel: (key, naam, video) => snelBel(key, naam, video),
    snap: key => snapKies(key)
  };

  /* ---- het salongesprek: jouw Rahul kletst met die van je vriend ----

     Een gimmick, en zo staat het er ook. De knop zit in de kop van de DM,
     want daar zit je al met precies die ene persoon.

     Twee dingen die hier bewust in het scherm staan en niet alleen in de
     server: de schakelaar (standaard uit) en de zin dat alle plekken
     verzonnen zijn. Wie niet weet dat er iets over zijn dag verteld wordt,
     heeft geen keuze gemaakt, en dan is "aan" geen toestemming. */
  let kletsAan = false;

  async function kletsLaad(){
    try {
      const d = await API.call('/klets', {});
      kletsAan = !!d.aan;
      return d;
    } catch(e){ return { aan: false, gesprekken: [], uitleg: '' }; }
  }

  function kletsTekenLeeg(d){
    $('#kletsBody').innerHTML =
      '<p class="stil" style="font-size:.82rem;color:var(--soft);line-height:1.6;">' + escT(d.uitleg || '') + '</p>' +
      '<label style="display:flex;gap:.6rem;align-items:flex-start;margin:0.75rem 0;font-size:.85rem;">' +
        '<input class="h-mt20" type="checkbox" id="kletsSchakel"' + (kletsAan ? ' checked' : '') + '>' +
        '<span>Rahul mag met de Rahul van mijn vrienden kletsen over hoe mijn dag was.' +
        '<br><span style="color:var(--soft);font-size:.78rem;">Uit te zetten wanneer je wilt. Zolang het uit staat, gebeurt er niets.</span></span>' +
      '</label>' +
      '<button class="knop" id="kletsGo"' + (kletsAan ? '' : ' disabled') + '>Laat ze kletsen</button>' +
      (d.gesprekken && d.gesprekken.length
        ? '<div style="margin-top:1.25rem;border-top:1px solid var(--line);padding-top:.8rem;">' +
          d.gesprekken.slice(0, 8).map(g =>
            '<button class="klets-eerder" data-klets="' + escT(g.id) + '" style="display:block;width:100%;text-align:left;background:none;border:0;color:inherit;padding:.5rem 0;font:inherit;cursor:pointer;">' +
            '<b style="font-size:.78rem;color:var(--rtg-leesgoud,var(--gold));">' + escT(g.metCodenaam) + '</b>' +
            '<span style="display:block;font-size:.82rem;color:var(--soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escT(g.eerste) + '</span></button>'
          ).join('') + '</div>'
        : '');
    const schakel = $('#kletsSchakel');
    if (schakel) schakel.addEventListener('change', async () => {
      try { const r = await API.call('/klets/zet', { aan: schakel.checked }); kletsAan = !!r.aan; $('#kletsGo').disabled = !kletsAan; }
      catch(e){ toast(e.message); schakel.checked = kletsAan; }
    });
    const go = $('#kletsGo');
    if (go) go.addEventListener('click', kletsStart);
    $('#kletsBody').querySelectorAll('[data-klets]').forEach(b => b.addEventListener('click', async () => {
      try { kletsToon(await API.call('/klets/gesprek', { id: b.dataset.klets })); } catch(e){ toast(e.message); }
    }));
  }

  function kletsToon(g){
    $('#kletsBody').innerHTML =
      '<div class="klets-draad">' + (g.beurten || []).map(b =>
        '<div class="dm-m' + (b.mij ? ' mine' : '') + '">' + escT(b.tekst) + '</div>').join('') + '</div>' +
      '<p style="font-size:.75rem;color:var(--soft);line-height:1.6;margin-top:.9rem;">' + escT(g.noot || '') +
      (g.echt ? '' : ' Dit antwoord komt uit de ingebouwde assistent; vrije AI is niet actief.') + '</p>' +
      '<button class="knop h-mt70" id="kletsTerug">Terug</button>';
    const t = $('#kletsTerug');
    if (t) t.addEventListener('click', async () => kletsTekenLeeg(await kletsLaad()));
  }

  async function kletsStart(){
    if (!dmWith) return;
    const go = $('#kletsGo');
    if (go) { go.disabled = true; go.textContent = 'Ze zijn bezig...'; }
    try { kletsToon(await API.call('/klets/start', { vriend: dmWith })); }
    catch(e){ toast(e.message); if (go) { go.disabled = false; go.textContent = 'Laat ze kletsen'; } }
  }

  async function kletsOpen(){
    if (!dmWith) return;
    $('#kletsNaam').textContent = dmNaam || '';
    $('#klets-sheet').classList.add('open'); $('#klets-scrim').classList.add('open');
    $('#kletsBody').innerHTML = '<p style="color:var(--soft);font-size:.85rem;">Laden...</p>';
    kletsTekenLeeg(await kletsLaad());
  }
  const kletsDicht = () => { $('#klets-sheet').classList.remove('open'); $('#klets-scrim').classList.remove('open'); };
  if ($('#dmKlets')) $('#dmKlets').addEventListener('click', kletsOpen);
  if ($('#kletsClose')) $('#kletsClose').addEventListener('click', kletsDicht);
  if ($('#klets-scrim')) $('#klets-scrim').addEventListener('click', kletsDicht);
  /* ---------- live updates ---------- */

  // een scherm werkt zichzelf bij zonder page-refresh
  async function syncScope(scope){
    if (!API.live) return;
    try {
      const data = await API.call('/state');
      applyState(data.state);
    } catch (e) { return; }
    if (scope === 'payments'){ renderPay(); renderHome(); renderTrip(); }
    else if (scope === 'salon'){ renderSalon(); renderHome(); }
    else if (scope === 'orders'){ renderTerPlaatse(); if (user.tier === 'guest') loadGuestHistory(); }
        else if (scope === 'gchat'){ if (pchat) loadPChat(); }
    else if (scope === 'apply'){ renderCvCard(); if (apChatId) laadApplyChat(); }
    else if (scope === 'chat'){ if (user.account) renderChat(); }
    else if (scope === 'tickets'){ laadTickets(); }
    else if (scope === 'huur'){ laadVerhuur(); }
    else if (scope === 'charter'){ laadCharter(); }
    else if (scope === 'groothandel'){ laadBoodschappen(); }
    else if (scope === 'verkoop'){ laadShowroom(); }
    else if (scope === 'contract'){ laadContracten(); }
    else if (scope === 'vastgoed'){ laadVastgoed(); }
    else if (scope === 'care'){ laadCare(); }
    else if (scope === 'live'){ renderLive(); laadTickets(); }
    else if (scope === 'paspoort'){ laadPaspoortInbox(); }
    else if (scope === 'ontmoeting'){ laadOntmoet(); }
    else { renderPay(); renderHome(); renderTrip(); renderSalon(); renderTerPlaatse(); if (user.account) renderChat(); laadPaspoortInbox(); laadOntmoet(); }
  }

  function timeAgo(iso){
    const s = Math.max(1, Math.round((Date.now() - new Date(iso)) / 1000));
    if (s < 60) return T('t.now','zojuist');
    const ago = T('t.ago',' geleden');
    const m = Math.round(s / 60);
    if (m < 60) return m + T('t.min',' min') + ago;
    const h = Math.round(m / 60);
    if (h < 24) return h + T('t.hour',' uur') + ago;
    return Math.round(h / 24) + T('t.days',' dag(en)') + ago;
  }

  function renderBell(){
    const R = window.RTGRealtime;
    if (!R) return;
    const n = R.unread();
    const badge = $('#bellBadge');
    badge.style.display = n > 0 ? 'flex' : 'none';
    badge.textContent = n > 9 ? '9+' : n;
    /* De bel zelf staat verborgen (de statusbalk is leeg); zijn teller staat op
       de tegel in het bedieningspaneel. Hier bijgewerkt en niet daar, want dit
       is de plek die weet hoeveel er ligt -- twee tellers die elkaar naschrijven
       is precies hoe ze uit elkaar gaan lopen. */
    const ccTel = $('#osCcBelTel');
    if (ccTel){ ccTel.hidden = n <= 0; ccTel.textContent = n > 0 ? (n > 9 ? '9+' : n) : ''; }
    const list = $('#notifList');
/* de meldingenlijst en het ongelezen-merk */
    list.innerHTML = R.notifications.length
      ? R.notifications.map(x =>
          '<div class="notif-item' + (x.read ? '' : ' unread') + '">' +
            '<div class="ic">' + (window.RTGGlyf && RTGGlyf.heeft(x.icon) ? RTGGlyf.svgHTML(x.icon, { klasse: 'gl-inline' }) : (x.icon || '•')) + '</div>' +
            '<div class="tx"><b>' + x.title + '</b><span>' + x.body + '</span><time>' + timeAgo(x.at) + '</time></div>' +
          '</div>').join('')
      : '<div class="notif-empty">'+T('app.nonotif','Nog geen meldingen. Zodra iemand op uw post reageert of u een bericht stuurt, ziet u het hier.')+'</div>';
    const pb = $('#notifPush');
    const st = R.pushState();
    if (st === 'on'){ pb.textContent = '✓ '+T('app.pushon','Push aan'); pb.classList.add('on'); }
    else if (st === 'unsupported'){ pb.style.display = 'none'; }
    else { pb.textContent = T('app.pushenable','Push aanzetten'); pb.classList.remove('on'); }
  }

  function openNotif(open){
    $('#notifPanel').classList.toggle('open', open);
    $('#notifScrim').classList.toggle('open', open);
    if (open && window.RTGRealtime && RTGRealtime.unread() > 0){
      RTGRealtime.markRead();
      renderBell();
    }
  }
  $('#bell').addEventListener('click', () => openNotif(true));
  $('#notifScrim').addEventListener('click', () => openNotif(false));
  $('#notifPush').addEventListener('click', async () => {
    if (!window.RTGRealtime) return;
    const r = await RTGRealtime.enablePush();
    toast(r === 'on' ? T('app.pushtoast.on','Push-notificaties staan aan.') : r === 'denied' ? T('app.pushtoast.denied','Toestemming geweigerd, zet meldingen aan in uw instellingen.') : T('app.pushtoast.no','Push is hier niet beschikbaar.'));
    renderBell();
  });

  document.querySelectorAll('.tabbar button').forEach(b =>
    b.addEventListener('click', () => openTab(b.dataset.tab, true)));
  // de codenaam in de statusbalk is de korte weg naar je pas: die ligt sinds
  // het OS-beginscherm in je wallet, niet meer op de home
  $('#codeChip').addEventListener('click', () => { location.href = '/apps/geld.html#wallet'; });

  /* EEN TABBLAD HAALT ZIJN GEGEVENS OP ALS JE HEM OPENT, NIET EERDER.

     Gemeten, niet gegokt: een keer de app openen kostte 66 API-verzoeken. De
     rem op de deur (server/middleware/remmen.js) laat er 300 per minuut door,
     dus wie de app drie keer achter elkaar opende kreeg "te veel verzoeken"
     terug van zijn eigen app. Dat is precies wat er gemeld werd, en het is
     onze fout: drie keer openen is doodgewoon gedrag.

     Waar die 66 vandaan kwamen: renderAll() vulde alle vijftien tabbladen bij
     het opstarten. Een eerdere ingreep zette dat na het eerste beeld en met
     adempauzes ertussen (naBeeld in ./app-main-12a.js). Dat hielp voor hoe snel
     het VOELT, maar het aantal verzoeken bleef gelijk: uitstellen is niet
     hetzelfde als niet doen. De oorzaak is dat we gegevens ophalen voor
     schermen die op dat moment niemand ziet.

     De indeling hieronder is afgeleid en niet bedacht: per lader is opgezocht
     welke element-ids hij vult, en in welke .view die in apps/app.html staan.
     Drie laders (laadCare, laadBestellen, loadCv) schrijven nergens zo'n id;
     die blijven bij het openen laden, want stil iets NIET tonen is erger dan
     een verzoek te veel. Na de eerste keer blijft een tabblad gevuld, en de
     live-verbinding (syncScope) houdt bij wat er verandert. */
  const LADERS_PER_TAB = {
    reizen:     [['renderTrip', () => renderTrip()], ['laadShowroom', () => laadShowroom()]],
    betalen:    [['renderPay', () => renderPay()]],
    ai:         [['renderAI', () => renderAI()], ['renderFluister', () => renderFluister()]],
    assets:     [['renderAssets', () => renderAssets()]],
    salon:      [['renderSalon', () => renderSalon()], ['loadVacatures', () => loadVacatures()],
                 ['laadOntmoet', () => laadOntmoet()]],
    bestellen:  [['laadBoodschappen', () => laadBoodschappen()]],
    terplaatse: [['renderTerPlaatse', () => renderTerPlaatse()], ['laadTickets', () => laadTickets()],
                 ['laadVerhuur', () => laadVerhuur()], ['laadCharter', () => laadCharter()],
                 ['laadContracten', () => laadContracten()], ['laadVastgoed', () => laadVastgoed()]]
  };
  const gevuldeTabs = {};

  /* Vullen loopt via stap() uit ./app-main-12a.js, om dezelfde reden als daar:
     valt er een lader om, dan staat de rest van het tabblad er gewoon en zegt
     de console welke het was. */
  function vulTab(tab){
    const lijst = LADERS_PER_TAB[tab];
    if (!lijst || gevuldeTabs[tab]) return;
    gevuldeTabs[tab] = true;
    // een gratis gebruiker heeft geen reizen, betalen, AI, assets of zorg: die
    // tabbladen staan voor hem verborgen, dus halen we er ook niets voor op
    if (user.tier === 'guest' && ['reizen','betalen','ai','assets','zorg'].includes(tab)) return;
    for (const [naam, fn] of lijst) stap(naam, fn);
  }

  /* De pin-herstellink uit de mail (?pinherstel=...) wordt opgevangen door
     /shared/pinherstel.js. Dat staat apart en niet hier, omdat dit deel daarmee
     over de 10 KB ging -- en omdat het een op zichzelf staand schermpje is dat
     niets van de app-schil nodig heeft. */
  function pinHerstelUitAdres(){ if (window.RTGPinHerstel) RTGPinHerstel.opvangen(API, T); }

  function openTab(tab, focusView){
    vulTab(tab);   // nu pas de gegevens van dit tabblad, en alleen de eerste keer
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === tab));
    document.querySelectorAll('.tabbar button').forEach(b => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); // schermlezer meldt de actieve tab
    });
    /* Onthouden waar je bent: op een telefoon wordt de app voortdurend door
       het systeem gedood en herstart (iOS doet dat al na een paar minuten
       achtergrond), en elke herstart betekende terug-naar-home -- midden in
       de Salon of een bestelling. Dat voelt als een app die je plek kwijt-
       raakt. renderAll() leest dit terug en zet je waar je was. */
    try { localStorage.setItem('rtg_actieve_tab', JSON.stringify({ tab, t: Date.now() })); } catch(e){}
    $('#content').scrollTop = 0;
    /* HET SCHERM WISSELDE, MAAR DE SCHIL HOORDE HET NIET.

       sync() (app-main-28.js) zet os-open op #app, en daaraan hangt de hele
       app-modus: de terugknop en de titel in de statusbalk in plaats van het
       woordmerk, en de schermvaste pill. Hij hing aan een MutationObserver op
       #app zelf -- en openTab raakt #app niet aan. Hij raakt de views en de
       tabknoppen aan. Gevolg: je opende Ter plaatse en de balk bleef die van
       het beginscherm, zonder weg terug.

       Dat viel niet op zolang het springboard eronder lag: je kon altijd nog
       op een tegel tikken. Nu de werktafel het beginscherm is, is deze balk de
       enige uitweg uit zo'n scherm -- en dan is "hij hoort het niet" geen
       schoonheidsfoutje meer. De waarnemer blijft staan voor de gate-wissel
       (in- en uitloggen); dit is de wissel die hij niet kon zien.

       Via window omdat sync() in een andere scope woont dan deze functie -- zie
       de naad in app-main-28.js. */
    if (window.RTGOSSync) RTGOSSync();
    // Alleen bij een echte klik de focus naar de nieuwe weergave verplaatsen, zodat
    // toetsenbord- en schermlezergebruikers meelopen (niet bij programmatische wissels).
    if (focusView){
      const v = document.querySelector('.view[data-view="'+tab+'"]');
      if (v){ v.setAttribute('tabindex','-1'); v.focus({ preventScroll: true }); }
    }
  }

  /* EEN KAPOTTE KAART MAG NIET HET HELE SCHERM MEENEMEN.

     renderAll() riep twintig opbouwfuncties na elkaar aan, zonder vangnet.
     Struikelde de eerste, dan stierf de rest mee en bleef er van het
     beginscherm niets over dan wat er vast in de HTML staat -- de balk van
     Rahul. Dat is precies het beeld dat gemeld werd: "ik zie alleen de AI-balk".
     Een zwart scherm is bovendien de slechtste foutmelding die er is: hij zegt
     niet wat er stuk is, en niet dat de rest het nog zou doen.

     stap() draait elk onderdeel apart. Gaat er een mis, dan gaat de rest
     gewoon door en zegt de console WELKE het was. Dat is geen doekje voor het
     bloeden: een lid dat zijn tegels, klok en wallet ziet terwijl een van de
     twintig kaarten ontbreekt, heeft een werkende app -- en wij een spoor. */
  /* De opbouw van het beginscherm: het vangnet, de melding als er iets leeg
     blijft, en de volgorde eerst-beeld-dan-gegevens. Apart deel omdat
     app-main-12.js hiermee op 11,5 KB kwam en keuringsregel 13 op 10 staat --
     en de regel heeft gelijk over de reden: de rest van dat deel is de schil
     van de app (meldingen, tabbladen), dit gaat over hoe het scherm ontstaat. */
  /* WAT ER MISGING, OP HET SCHERM ZELF.

     Een gebruiker met een half leeg beginscherm hoort niet de console te
     hoeven openen om te weten wat er speelt -- en wij horen niet te moeten
     raden. Deze regel verschijnt alleen als er echt iets omviel: een rustige
     mededeling onderaan met de naam van het onderdeel, en verder niets. Geen
     stacktrace, geen alarm; wie het niet interesseert leest er gewoon
     overheen, en wie het meldt kan het letterlijk overtypen. */
  let leegGemeld = false;
  function meldLeegScherm(wat) {
    if (leegGemeld) return;
    leegGemeld = true;
    try {
      const el = document.createElement('div');
      el.id = 'rtgOnderdeelStuk';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);z-index:9970;' +
        'bottom:calc(env(safe-area-inset-bottom,0px) + 8.5rem);width:min(26rem,calc(100vw - 2rem));' +
        'background:var(--card,#151312);border:1px solid var(--line,#2A2724);border-radius:0;' +
        'padding:.7rem .9rem;color:var(--muted,#8A8680);font-family:Inter,system-ui,sans-serif;' +
        'font-size:.76rem;line-height:1.5;text-align:center;';
      el.textContent = 'Een onderdeel van dit scherm laadde niet: ' + wat + '. De rest werkt gewoon.';
      document.body.appendChild(el);
    } catch (e) { /* zelfs de melding mag niets breken */ }
  }
  // de tegelbouw (app-main-26b.js) meldt hier ook, dus hij moet daar bereikbaar zijn
  window.RTGMeldStuk = meldLeegScherm;

  function stap(naam, fn) {
    try { fn(); } catch (e) {
      console.error('[rtg] onderdeel "' + naam + '" van het beginscherm ging mis:', e);
      meldLeegScherm(naam);
    }
  }

  /* EERST BEELD, DAN GEGEVENS.

     renderAll() deed alles in een adem: het beginscherm, en meteen ook de
     vijftien tabbladen erachter. Op deze machine valt dat niet op; op een
     telefoon wel. Gemeten bij een gebruiker die "hij laadt heel lang" meldde:
     203 verzoeken bij het openen, 53 scripts en een bundel van 530 KB, en
     tweeentwintig opbouwstappen voordat er ook maar iets in beeld kwam. Wat je
     dan ziet is een leeg scherm, en lang genoeg leeg voelt als kapot.

     Alleen het beginscherm heeft de gegevens nodig die er al zijn; de andere
     tabbladen kijkt niemand naar voordat hij erop tikt. Die gaan daarom NA het
     eerste beeld, een voor een, met een adempauze ertussen zodat de telefoon
     tussendoor kan tekenen en reageren. Wie meteen op een tabblad tikt vindt
     hem gewoon gevuld of even later; wie op het beginscherm blijft, ziet het
     nu meteen.

     De volgorde is niet willekeurig: wat op het beginscherm zichtbaar is gaat
     voor, daarna de rest. */
  function naBeeld(stappen) {
    let i = 0;
    const volgende = () => {
      if (i >= stappen.length) return;
      const [naam, fn] = stappen[i++];
      stap(naam, fn);
      // een adempauze: de telefoon mag tussendoor tekenen en op een tik reageren
      if (window.requestIdleCallback) requestIdleCallback(volgende, { timeout: 400 });
      else setTimeout(volgende, 16);
    };
    if (window.requestIdleCallback) requestIdleCallback(volgende, { timeout: 400 });
    else setTimeout(volgende, 50);
  }

  function renderAll(){
    /* Ook deze aanloop liep zonder vangnet, en juist hier staan de regels die
       aannemen dat een element bestaat. Viel er een om, dan kwam de rest van
       renderAll niet eens op gang en hielp het afschermen van de stappen
       hieronder niets. */
    // gratis gebruiker (zonder pas): reizen, betalen en AI zijn voor leden
    const guest = user.tier === 'guest';
    stap('scherm-aanloop', () => {
    $('#codeChipTxt').textContent = user.codename;
    ['reizen','betalen','ai','assets','zorg'].forEach(t => { const b = document.querySelector('.tabbar button[data-tab="'+t+'"]'); if (b) b.style.display = guest ? 'none' : ''; });
    // het OS-beginscherm leest dit: zonder pas geen wallet-tegel en geen balk
    // van Rahul, want allebei zijn ze voor leden
    document.getElementById('app').classList.toggle('os-gast', guest);
    });
    stap('renderHome', renderHome);
    // een pin-herstellink uit de mail opvangen (zie ./app-main-12.js)
    stap('pin-herstel', pinHerstelUitAdres);
    // Rahul opent het gesprek op het beginscherm zelf, met wat hij nu ziet
    stap('rahul-thuis', () => { if (!guest && window.RTGThuisRahul) RTGThuisRahul.opent(); });
    /* Terug waar je was, maar KORT. Dit venster stond op een half uur, en dat
       was te ver doorgeschoten: openTab schrijft de tijd bij elke schermwissel
       bij, dus het venster schoof steeds mee en in gewoon gebruik landde je
       vrijwel altijd weer in de app waar je was. Het beginscherm -- de tegels,
       de klok, het gezicht van het huis -- kreeg je dan nooit meer te zien.

       Waar dit voor bedoeld is, is de app die ONDER je vandaan wordt gedood:
       iOS ruimt een app in de achtergrond op, of je herlaadt per ongeluk, en
       dan hoor je niet je plek kwijt te raken. Dat gebeurt binnen seconden,
       niet binnen een half uur. Twee minuten dekt dat ruim, en alles wat
       later komt is een NIEUWE keer openen -- en die begint thuis. */
    const PLEK_VENSTER = 2 * 60000;
    let beginTab = 'home';
    try {
      const b = JSON.parse(localStorage.getItem('rtg_actieve_tab') || 'null');
      if (b && b.tab && Date.now() - (b.t || 0) < PLEK_VENSTER){
        const knop = document.querySelector('.tabbar button[data-tab="' + b.tab + '"]');
        if (knop && knop.style.display !== 'none') beginTab = b.tab;
      }
    } catch(e){}
    /* De tabbladen achter het beginscherm halen hun gegevens nu pas op als je
       ze opent -- zie LADERS_PER_TAB in ./app-main-12.js voor waarom, en wat
       er gemeten is. Hier blijven alleen de drie laders staan die aan geen
       enkel tabblad vastzitten; die gaan na het eerste beeld, een voor een. */
    naBeeld([
      ...(guest ? [] : [['laadCare', laadCare]]),
      ['laadBestellen', laadBestellen], ['loadCv', loadCv]
    ]);

    openTab(beginTab);

    /* KIJKT DE APP OF ER IETS TE ZIEN IS. Een zwart scherm meldt zichzelf niet:
       er gooit niets, alle verzoeken slagen, en toch staat er niets. Daarom
       meten we het na het opbouwen gewoon na. Is het beginscherm leeg, dan
       gaan de MATEN naar het logboek (venster, hoogtes, aantal tegels, de
       rekeneenheid) -- genoeg om een layoutstoring te plaatsen zonder dat
       iemand een console hoeft te openen. Staat er wel wat, dan gebeurt er
       niets en weet niemand hiervan. */
    setTimeout(() => {
      try {
        /* WAT STAAT ER WERKELIJK MIDDEN OP HET SCHERM?

           De eerste versie van deze controle keek of er tegels BESTONDEN, en
           dat was te nauw: bij de melder stonden ze er wel en zag hij ze toch
           niet, dus zweeg de controle precies in het geval waarvoor hij bedoeld
           was. Bestaan is niet hetzelfde als zichtbaar zijn -- inhoud kan naast
           het scherm staan, nul hoog zijn, of achter iets anders liggen.

           elementFromPoint op het midden van het venster stelt de enige vraag
           die telt: kijkt de gebruiker naar iets van de app, of naar niets? */
        const thuis = document.querySelector('.os-thuisscherm');
        const tegels = document.querySelectorAll('.os-app').length;
        const hoog = thuis ? thuis.getBoundingClientRect().height : 0;
        const midden = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight / 2));
        const leegMidden = !midden || midden === document.body || midden === document.documentElement;
        const buitenBeeld = thuis && (() => { const b = thuis.getBoundingClientRect();
          return b.bottom <= 0 || b.top >= innerHeight || b.width < 10; })();

        let reden = null;
        if (!tegels) reden = 'geen tegels';
        else if (hoog < 40) reden = 'thuisscherm zonder hoogte';
        else if (buitenBeeld) reden = 'thuisscherm buiten beeld';
        else if (leegMidden) reden = 'niets in het midden van het scherm';

        if (reden && window.RTGFoutmelder && RTGFoutmelder.meetLeeg) RTGFoutmelder.meetLeeg(reden);
      } catch (e) { /* een controle mag nooit de oorzaak van iets worden */ }
    }, 2500);
    if ((rtf.gekoppeld || []).length) ensurePush(false); // stil vernieuwen als het al aan staat
  }

  /* ---------- tickets: activiteiten, tours en musea ---------- */
  let tkPartners = [], tkOpen = null, tkKeuze = null;
  /* De tickets van het lid: het aanbod en wat hij al heeft. Apart deel omdat
     app-main-12.js met deze twee functies erbij op 10,9 KB kwam en
     keuringsregel 13 op 10 staat. De regel heeft gelijk over de reden: de rest
     van dat deel is de schil van de app (meldingen, tabbladen, opbouw), en dit
     gaat over tickets. */
  async function laadTickets(){
    if (!API.live) return;
    try { tkPartners = (await API.call('/tickets/aanbod')).partners || []; } catch(e){ tkPartners = []; }
    let mijn = [];
    try { mijn = (await API.call('/tickets/mijn')).tickets || []; } catch(e){}
    const mijnEl = $('#tkMijn');
    if (mijnEl) mijnEl.innerHTML = mijn.filter(t => !t.gebruikt || t.datum >= new Date().toISOString().slice(0, 10)).map(t =>
      '<div class="card" style="border-color:rgba(208,172,87,0.35);">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--rtg-leesgoud,var(--gold));">\uD83C\uDF9F\uFE0F '+T('tk.ticket','Ticket')+' \u00B7 '+esc(t.supplierName)+'</div>'+
      '<div style="margin-top:0.35rem;font-size:0.92rem;"><b>'+esc(t.naam)+'</b> \u00B7 '+t.datum+' '+t.tijd+' \u00B7 '+t.personen+'p</div>'+
      (t.gebruikt
        ? '<div style="margin-top:0.4rem;font-size:0.8rem;color:var(--rtg-leesgroen,var(--green));">\u2705 '+T('tk.gebruikt','Binnen; ingecheckt door ')+esc(t.checkin.door)+'</div>'
        : '<div style="margin-top:0.5rem;text-align:center;background:rgba(208,172,87,0.12);border:1px dashed rgba(208,172,87,0.5);border-radius:0;padding:0.55rem;">'+
          '<span style="font-size:1.3rem;letter-spacing:0.35em;color:var(--rtg-leesgoud,var(--gold));font-weight:700;">'+esc(t.code)+'</span>'+
          '<div style="font-size:0.66rem;color:var(--soft);margin-top:0.2rem;">'+T('tk.laatzien','Laat deze code zien aan de deur')+'</div></div>')+
      // de eigen transferdienst van de zaak: aanvragen, of live zien wie er komt
      (t.transfer
        ? '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--muted);">\uD83D\uDE90 '+T('tk.tr','Transfer')+': <b style="color:var(--txt);">'+
          ({ 'wacht-op-betaling': T('tk.tr.betalen','nog betalen'), 'aangevraagd': T('tk.tr.aangevraagd','aangevraagd'), 'geaccepteerd': T('tk.tr.geacc','bevestigd'), 'onderweg': T('tk.tr.onderweg','onderweg naar u') }[t.transfer.status] || t.transfer.status)+'</b>'+
          (t.transfer.chauffeur ? ' \u00B7 '+esc(t.transfer.chauffeur) : '')+(t.transfer.etaMin ? ' \u00B7 \u23F1 '+t.transfer.etaMin+' min' : '')+
          (t.transfer.prijs ? ' \u00B7 '+eur(t.transfer.prijs) : ' \u00B7 '+T('tk.tr.incl','inclusief'))+'</div>'
        : (t.transferAan && !t.gebruikt
          ? '<div style="margin-top:0.55rem;display:flex;gap:0.4rem;">'+
            '<input id="trVan-'+t.ref+'" placeholder="'+T('tk.tr.vanph','Ophaaladres')+'" style="flex:1;background:var(--card2,var(--card));border:1px solid var(--line);border-radius:0;padding:0.5rem 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;">'+
            '<button class="bz-btn" data-trvraag="'+t.ref+'" data-trprijs="'+t.transferPrijs+'">\uD83D\uDE90 '+(t.transferPrijs ? eur(t.transferPrijs) : T('tk.tr.gratis','Gratis'))+'</button></div>'
          : ''))+
      '</div>').join('');
    document.querySelectorAll('[data-trvraag]').forEach(b => b.addEventListener('click', async () => {
      const veld = document.getElementById('trVan-' + b.dataset.trvraag);
      try {
        const r = await API.call('/transfer/aanvraag', { ticketRef: b.dataset.trvraag, van: veld ? veld.value : '' });
        if (Number(b.dataset.trprijs) > 0) await API.call('/ride/pay', { ref: r.ride.ref });
        toast(T('tk.tr.ok','Transfer aangevraagd. U ziet hier wie u komt halen.'));
        laadTickets();
      } catch(e){ toast(e.message); }
    }));
    renderTkAanbod();
  }
  function renderTkAanbod(){
    const el = $('#tkAanbod'); if (!el) return;
    if (!tkPartners.length){ el.innerHTML = ''; return; }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.25rem 0 0.5rem;">'+T('tk.kop','Activiteiten, tours en musea')+'</div>';
/* het ticketkanaal: partners, activiteiten en hun tijden */
    for (const p of tkPartners){
      html += '<div class="card"><b>'+esc(p.name)+'</b> <span class="soft-sm">\u00B7 '+esc(p.city||'')+'</span>';
      for (const a of p.activiteiten){
        const open = tkOpen === p.code + ':' + a.id;
        html += '<div style="margin-top:0.75rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><div class="h-flex1"><div style="font-size:0.88rem;">'+esc(a.name)+'</div>'+
          (a.desc?'<div class="soft-sm">'+esc(a.desc)+(a.duur?' \u00B7 '+esc(a.duur):'')+'</div>':'')+'</div>'+
          '<span style="color:var(--gold);font-size:0.82rem;white-space:nowrap;">'+eur(a.prijs)+' p.p.</span></div>';
        if (open){
          const k = tkKeuze;
          const dagen = [];
          for (let d = 0; d < 7; d++){ const dt = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10); dagen.push(dt); }
          html += '<div class="h-mt50">'+
            '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;">'+dagen.map(d =>
              '<button class="bz-btn'+(k.datum===d?' on':'')+'" data-tkd="'+d+'">'+(d===dagen[0]?T('tk.vandaag','vandaag'):d.slice(8)+'/'+d.slice(5,7))+'</button>').join('')+'</div>'+
            '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.5rem;">'+(a.tijden||[]).map(t2 =>
              '<button class="bz-btn'+(k.tijd===t2?' on':'')+'" data-tkt="'+t2+'">'+t2+'</button>').join('')+'</div>'+
            '<div style="display:flex;align-items:center;gap:0.6rem;margin-top:0.5rem;">'+
            '<span style="font-size:0.78rem;color:var(--muted);">'+T('tk.personen','Personen')+'</span>'+
            '<button class="bz-btn" data-tkp="-1" style="padding:0.2rem 0.7rem;">\u2212</button><b>'+k.personen+'</b><button class="bz-btn" data-tkp="1" style="padding:0.2rem 0.7rem;">+</button></div>'+
            '<button class="bz-groot h-mt70" id="tkKoop"'+(k.tijd?'':' disabled')+'>'+T('tk.koop','Koop tickets')+' \u00B7 '+eur(a.prijs * k.personen)+'</button></div>';
        } else {
          html += '<button class="bz-btn h-mt45" data-tkopen="'+p.code+':'+a.id+'">'+T('tk.kies','Kies datum en tijd')+'</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-tkopen]').forEach(b => b.addEventListener('click', () => {
      tkOpen = b.dataset.tkopen;
      tkKeuze = { datum: new Date().toISOString().slice(0, 10), tijd: null, personen: 2 };
      renderTkAanbod();
    }));
    document.querySelectorAll('[data-tkd]').forEach(b => b.addEventListener('click', () => { tkKeuze.datum = b.dataset.tkd; renderTkAanbod(); }));
    document.querySelectorAll('[data-tkt]').forEach(b => b.addEventListener('click', () => { tkKeuze.tijd = b.dataset.tkt; renderTkAanbod(); }));
    document.querySelectorAll('[data-tkp]').forEach(b => b.addEventListener('click', () => {
      tkKeuze.personen = Math.min(10, Math.max(1, tkKeuze.personen + Number(b.dataset.tkp))); renderTkAanbod();
    }));
    const koop = document.getElementById('tkKoop');
    if (koop) koop.addEventListener('click', async () => {
      const [code, actId] = tkOpen.split(':');
      try {
        const t = await API.call('/ticket/koop', { supplierCode: code, activiteitId: actId, datum: tkKeuze.datum, tijd: tkKeuze.tijd, personen: tkKeuze.personen });
        await API.call('/booking/pay', { ref: t.ticket.ref });
        toast(T('tk.ok','Betaald! Uw entreecode: ') + t.ticket.code);
        tkOpen = null; tkKeuze = null;
        laadTickets();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- Toren 4: Zorg & welzijn (RTG Care) ----------
     Een eigen tab: mijn boekingen, mijn intake-delingen, herstelpakketten
     en het aanbod van spa's, wellness en klinieken. Boeken kiest een dag en
     tijdslot bij een behandelaar; betalen loopt via RTG Pay. Het zorgprofiel
     reist automatisch mee; medische context deelt het lid apart en per
     aanbieder, met een einddatum en altijd te stoppen. */
  let careOv = null, careOpen = null, careKeuze = null, careIntakeTekst = {};
  let carePak = [], carePakMijn = [], carePakOpen = null, carePakKeuze = null;
  const careSoort = { spa: 'Spa', wellness: 'Wellness', kliniek: 'Kliniek' };
  async function laadCare(){
    if (!API.live) return;
    try { careOv = await API.call('/care', {}); } catch(e){ careOv = null; }
    let mijn = [];
    try { mijn = (await API.call('/care/mijn', {})).boekingen || []; } catch(e){}
    try { carePak = (await API.call('/care/pakketten', {})).pakketten || []; } catch(e){ carePak = []; }
    try { carePakMijn = (await API.call('/care/pakket/mijn', {})).pakketten || []; } catch(e){ carePakMijn = []; }
    renderCareMijn(mijn);
    renderCareIntakes();
    renderCarePakketten();
    renderCareAanbod();
    laadVerzorging(); // de kapper en de barbier, apart gehouden van de zorg
  }
  function renderCareMijn(mijn){
    const el = $('#careMijn'); if (!el) return;
    if (!mijn.length){ el.innerHTML = ''; return; }
    el.innerHTML = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:0 0 0.5rem;">'+T('care.mijn','Mijn afspraken')+'</div>'+
      mijn.map(b => '<div class="card" style="border-color:rgba(139,195,168,0.35);">'+
        '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--green,#8bc3a8);">'+esc(b.aanbiederNaam)+'</div>'+
        '<div style="margin-top:0.25rem;font-size:0.92rem;"><b>'+esc(b.behandelingNaam)+'</b>'+(b.behandelaarNaam?' · '+esc(b.behandelaarNaam):'')+'</div>'+
        '<div class="soft-sm h-mt15">'+b.datum+' · '+b.tijd+' · '+eur(b.prijs)+' · '+
          (b.paid ? '<span style="color:var(--green,#8bc3a8);">'+T('care.betaald','betaald')+'</span>' : '<span style="color:var(--gold);">'+T('care.tebetalen','nog te betalen')+'</span>')+'</div>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;">'+
          (b.paid ? '' : '<button class="bz-groot h-flex1" data-care-pay="'+esc(b.ref)+'">'+T('care.betaal','Betaal')+' · '+eur(b.prijs)+'</button>')+
          '<button class="bz-btn" data-care-annul="'+esc(b.ref)+'">'+T('care.annuleer','Annuleer')+'</button>'+
        '</div></div>').join('');
    el.querySelectorAll('[data-care-pay]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/care/betaal', { ref: x.dataset.carePay }); toast(T('care.paytoast','Betaald. Tot uw afspraak.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-care-annul]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/care/annuleer', { ref: x.dataset.careAnnul }); toast(T('care.annultoast','Afspraak geannuleerd.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
  }
  function renderCareIntakes(){
    const el = $('#careIntakes'); if (!el) return;
    const list = (careOv && careOv.intakes) || [];
    if (!list.length){ el.innerHTML = ''; return; }
    el.innerHTML = '<div class="card" style="border-color:rgba(208,172,87,0.3);">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">'+T('care.intakes','Gedeelde medische context')+'</div>'+
      list.map(i => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.5rem;">'+
        '<div style="font-size:0.85rem;">'+esc(i.aanbiederNaam)+'<div class="soft-sm">'+T('care.tot','tot')+' '+i.vervaltOp+'</div></div>'+
        '<button class="bz-btn" data-care-intakestop="'+esc(i.id)+'">'+T('care.stopdelen','Stop delen')+'</button></div>').join('')+
      '</div>';
    el.querySelectorAll('[data-care-intakestop]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/care/intake/stop', { id: x.dataset.careIntakestop }); toast(T('care.stoptoast','Deling gestopt. Weg is weg.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
  }
  function renderCareAanbod(){
    const el = $('#careAanbod'); if (!el) return;
    const aanb = (careOv && careOv.aanbieders) || [];
    if (!aanb.length){ el.innerHTML = ''; return; }
    const dagen = [];
    for (let d = 0; d < 7; d++){ dagen.push(new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)); }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.25rem 0 0.5rem;">'+T('care.aanbod','Spa’s, wellness en klinieken')+'</div>';
/* het zorgaanbod: klinieken, behandelingen en het medische onderscheid */
    for (const a of aanb){
      const medisch = a.soort === 'kliniek' || (a.behandelingen || []).some(b => b.soort === 'medisch');
      html += '<div class="card"><div style="display:flex;gap:0.5rem;align-items:baseline;"><span style="font-size:1.1rem;">'+esc(a.icon||'')+'</span>'+
        '<div class="h-flex1"><b>'+esc(a.naam)+'</b> <span class="soft-sm">· '+esc(careSoort[a.soort]||a.soort)+(a.waar?' · '+esc(a.waar):'')+'</span>'+
        (a.beschrijving?'<div class="soft-sm h-mt15">'+esc(a.beschrijving)+'</div>':'')+
        ((a.behandelaars||[]).length?'<div class="soft-sm h-mt20">'+a.behandelaars.map(b => esc(b.naam)+(b.functie?' ('+esc(b.functie)+')':'')).join(' · ')+'</div>':'')+'</div></div>';
      // intake-deling voor klinieken/medische zorg: uitdrukkelijk en per aanbieder
      if (medisch){
        const actief = !!a.intakeActief;
        html += '<div style="margin-top:0.5rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div class="soft-sm" style="margin-bottom:0.25rem;">'+(actief
            ? T('care.intakeaan','U deelt medische context met deze kliniek. U kunt dit bij Mijn afspraken stoppen.')
            : T('care.intakeuit','Wilt u dat de behandelaar iets weet (medicijnen, allergie, aandoening)? Deel het apart en alleen met deze kliniek.'))+'</div>'+
          (actief ? '' :
            '<textarea data-care-intaketxt="'+esc(a.id)+'" rows="2" placeholder="'+T('care.intakeph','Bijv. ik gebruik bloedverdunners en ben allergisch voor penicilline')+'" style="width:100%;box-sizing:border-box;background:var(--card2,var(--card));border:1px solid var(--line);border-radius:0;padding:0.5rem 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;resize:vertical;">'+esc(careIntakeTekst[a.id]||'')+'</textarea>'+
            '<button class="bz-btn h-mt40" data-care-intakedeel="'+esc(a.id)+'">'+T('care.intakedeel','Deel met deze kliniek')+'</button>')+
          '</div>';
      }
      for (const b of (a.behandelingen || [])){
        const open = careOpen === a.id + ':' + b.id;
        const behlr = (a.behandelaars || []).find(x => x.id === b.behandelaarId);
        html += '<div style="margin-top:0.75rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><div class="h-flex1"><div style="font-size:0.88rem;">'+esc(b.naam)+
            ' <span style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:'+(b.soort==='medisch'?'var(--gold)':'var(--green,#8bc3a8)')+';">'+(b.soort==='medisch'?T('care.med','medisch'):T('care.well','wellness'))+'</span></div>'+
            '<div class="soft-sm">'+b.duurMin+' '+T('care.min','min')+(behlr?' · '+esc(behlr.naam):'')+'</div></div>'+
            '<span style="color:var(--rtg-leesgoud,var(--gold));font-size:0.82rem;white-space:nowrap;">'+eur(b.prijs)+'</span></div>';
        if (open){
          const k = careKeuze;
          html += '<div class="h-mt50">'+
            '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;">'+dagen.map(d =>
              '<button class="bz-btn'+(k.datum===d?' on':'')+'" data-cared="'+d+'">'+(d===dagen[0]?T('care.vandaag','vandaag'):d.slice(8)+'/'+d.slice(5,7))+'</button>').join('')+'</div>'+
            '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.5rem;">'+(b.tijden||[]).map(t2 =>
              '<button class="bz-btn'+(k.tijd===t2?' on':'')+'" data-caret="'+t2+'">'+t2+'</button>').join('')+'</div>'+
            '<button class="bz-groot h-mt70" id="careBoek"'+(k.tijd?'':' disabled')+'>'+T('care.boek','Boek en betaal')+' · '+eur(b.prijs)+'</button></div>';
        } else {
          html += '<button class="bz-btn h-mt45" data-careopen="'+a.id+':'+b.id+'">'+T('care.kies','Kies dag en tijd')+'</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-care-intaketxt]').forEach(t => t.addEventListener('input', () => { careIntakeTekst[t.dataset.careIntaketxt] = t.value; }));
    el.querySelectorAll('[data-care-intakedeel]').forEach(x => x.addEventListener('click', async () => {
      const id = x.dataset.careIntakedeel;
      try { await API.call('/care/intake/deel', { aanbiederId: id, medisch: careIntakeTekst[id] || '' }); careIntakeTekst[id] = ''; toast(T('care.deeltoast','Gedeeld. Alleen deze kliniek ziet het, tot u stopt.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-careopen]').forEach(x => x.addEventListener('click', () => {
      careOpen = x.dataset.careopen; careKeuze = { datum: dagen[0], tijd: null }; renderCareAanbod();
    }));
    el.querySelectorAll('[data-cared]').forEach(x => x.addEventListener('click', () => { careKeuze.datum = x.dataset.cared; renderCareAanbod(); }));
    el.querySelectorAll('[data-caret]').forEach(x => x.addEventListener('click', () => { careKeuze.tijd = x.dataset.caret; renderCareAanbod(); }));
    const boek = document.getElementById('careBoek');
    if (boek) boek.addEventListener('click', async () => {
      const [aanbiederId, behandelingId] = careOpen.split(':');
      try {
        const r = await API.call('/care/boek', { aanbiederId, behandelingId, datum: careKeuze.datum, tijd: careKeuze.tijd });
        await API.call('/care/betaal', { ref: r.boeking.ref });
        toast(T('care.oktoast','Geboekt en betaald. Tot uw afspraak.'));
        careOpen = null; careKeuze = null;
        laadCare();
      } catch(e){ toast(e.message); }
    });
  }
  /* ---- verzorging: de kapper, de barbier en de nagelstudio ----
     Ze staan in dezelfde tab als de zorg, want een lid denkt niet in
     stelsels; hij denkt "ik moet naar de kapper". Maar ze staan er als een
     EIGEN blok met een eigen kop, want cosmetische verzorging is geen zorg:
     hier reist geen zorgprofiel mee en is er geen intake te delen. Boeken
     gaat naar /api/verzorging, dat de agenda van de salon zelf vult. */
  let verzOv = null, verzOpen = null, verzKeuze = null;
  async function laadVerzorging(){
    if (!API.live) return;
    const datum = (verzKeuze && verzKeuze.datum) || new Date().toISOString().slice(0, 10);
    try { verzOv = await API.call('/verzorging', { datum }); } catch(e){ verzOv = null; }
    renderVerzorging();
  }
  function renderVerzorging(){
    const el = $('#verzorgingAanbod'); if (!el) return;
    const aanb = (verzOv && verzOv.aanbieders) || [];
    if (!aanb.length){ el.innerHTML = ''; return; }
    const dagen = [];
    for (let d = 0; d < 7; d++){ dagen.push(new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)); }
    const gekozenDag = (verzKeuze && verzKeuze.datum) || dagen[0];
    const mijn = (verzOv && verzOv.mijn) || [];
    let html = '';
    if (mijn.length){
      html += '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.25rem 0 0.5rem;">'+T('verz.mijn','Mijn verzorgingsafspraken')+'</div>';
      html += mijn.map(a => '<div class="card">'+
        '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+esc(a.salon)+'</div>'+
        '<div style="margin-top:0.25rem;font-size:0.92rem;"><b>'+esc(a.behandeling)+'</b> <span class="soft-sm">· '+esc(a.stoel)+'</span></div>'+
        '<div class="soft-sm h-mt15">'+a.datum+' · '+a.van+' tot '+a.tot+' · '+eur(a.prijs)+' · '+T('verz.bijsalon','af te rekenen bij de salon')+'</div>'+
        '<button class="bz-btn h-mt55" data-verzannul="'+esc(a.code)+':'+esc(a.id)+'">'+T('verz.annuleer','Annuleer')+'</button></div>').join('');
    }
    html += '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.25rem 0 0.25rem;">'+T('verz.kop','Kapper, barbier en nagels')+'</div>'+
      '<div class="soft-sm" style="margin-bottom:0.5rem;">'+T('verz.uitleg','Verzorging, geen zorg: er reist geen zorgprofiel mee en er valt niets medisch te delen. U boekt op uw codenaam.')+'</div>'+
      '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+dagen.map(d =>
        '<button class="bz-btn'+(gekozenDag===d?' on':'')+'" data-verzdag="'+d+'">'+(d===dagen[0]?T('care.vandaag','vandaag'):d.slice(8)+'/'+d.slice(5,7))+'</button>').join('')+'</div>';
    for (const a of aanb){
      html += '<div class="card"><div><b>'+esc(a.naam)+'</b>'+(a.waar?' <span class="soft-sm">· '+esc(a.waar)+'</span>':'')+'</div>';
      for (const b of a.behandelingen){
        const sleutel = a.code+':'+b.id;
        html += '<div style="border-top:1px solid var(--line,rgba(255,255,255,0.08));margin-top:0.5rem;padding-top:0.55rem;">'+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:baseline;">'+
            '<span>'+esc(b.naam)+' <span class="soft-sm">· '+b.duurMin+' min</span></span>'+
            '<span class="soft-sm">'+eur(b.prijs)+'</span></div>';
        if (!b.tijden.length){
          html += '<div class="soft-sm h-mt30">'+T('verz.vol','Deze dag is vol. Kies een andere dag.')+'</div>';
        } else if (verzOpen === sleutel){
          html += '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.5rem;">'+b.tijden.map(t2 =>
            '<button class="bz-btn'+((verzKeuze&&verzKeuze.tijd===t2)?' on':'')+'" data-verzt="'+t2+'">'+t2+'</button>').join('')+'</div>'+
            '<button class="bz-groot h-mt70" id="verzBoek"'+((verzKeuze&&verzKeuze.tijd)?'':' disabled')+'>'+T('verz.boek','Maak deze afspraak')+'</button>';
        } else {
          html += '<button class="bz-btn h-mt45" data-verzopen="'+esc(sleutel)+'">'+T('verz.kies','Kies een tijd')+'</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-verzdag]').forEach(x => x.addEventListener('click', () => {
      verzKeuze = { datum: x.dataset.verzdag, tijd: null }; verzOpen = null; laadVerzorging();
    }));
    el.querySelectorAll('[data-verzopen]').forEach(x => x.addEventListener('click', () => {
      verzOpen = x.dataset.verzopen;
      verzKeuze = { datum: gekozenDag, tijd: null };
      renderVerzorging();
    }));
    el.querySelectorAll('[data-verzt]').forEach(x => x.addEventListener('click', () => {
      verzKeuze = { datum: gekozenDag, tijd: x.dataset.verzt }; renderVerzorging();
    }));
    el.querySelectorAll('[data-verzannul]').forEach(x => x.addEventListener('click', async () => {
      const [code, id] = x.dataset.verzannul.split(':');
      try { await API.call('/verzorging/annuleer', { code, id }); toast(T('verz.annultoast','Afspraak geannuleerd.')); laadVerzorging(); }
      catch(e){ toast(e.message); }
    }));
    const boek = $('#verzBoek');
    if (boek) boek.addEventListener('click', async () => {
      const [code, behandelingId] = verzOpen.split(':');
      try {
        await API.call('/verzorging/boek', { code, behandelingId, datum: verzKeuze.datum, tijd: verzKeuze.tijd });
        toast(T('verz.oktoast','Afspraak staat genoteerd. U rekent af bij de salon.'));
        verzOpen = null; verzKeuze = { datum: verzKeuze.datum, tijd: null };
        laadVerzorging();
      } catch(e){ toast(e.message); }
    });
  }
/* de zorgpakketten: wat er loopt en wat er te kiezen valt */
  function renderCarePakketten(){
    const el = $('#carePakketten'); if (!el) return;
    if (!carePak.length && !carePakMijn.length){ el.innerHTML = ''; return; }
    const dagen = [];
    for (let d = 0; d < 7; d++){ dagen.push(new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)); }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.25rem 0 0.5rem;">'+T('care.pakketten','Herstel- & verblijfpakketten')+'</div>';
    // mijn geboekte pakketten
    for (const b of carePakMijn){
      html += '<div class="card" style="border-color:rgba(194,58,94,0.3);">'+
        '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--burgundy);">'+T('care.pakket','Pakket')+'</div>'+
        '<div style="margin-top:0.25rem;font-size:0.92rem;"><b>'+esc(b.naam)+'</b></div>'+
        '<div class="soft-sm">'+b.nachten+' '+T('care.nachten','nachten')+' · '+esc(b.hotelNaam)+' · '+b.datum+' '+b.tijd+' · '+eur(b.prijs)+
          ' · '+(b.paid?'<span style="color:var(--green,#8bc3a8);">'+T('care.betaald','betaald')+'</span>':'<span style="color:var(--gold);">'+T('care.tebetalen','nog te betalen')+'</span>')+'</div>'+
        (b.paid?'':'<button class="bz-groot h-mt50" data-carepakpay="'+esc(b.ref)+'">'+T('care.betaal','Betaal')+' · '+eur(b.prijs)+'</button>')+
        '</div>';
    }
    // aanbod
    for (const p of carePak){
      const open = carePakOpen === p.id;
      html += '<div class="card"><div style="display:flex;justify-content:space-between;gap:0.5rem;">'+
        '<div class="h-flex1"><b>'+esc(p.naam)+'</b>'+
        '<div class="soft-sm h-mt15">'+esc(p.beschrijving)+'</div>'+
        '<div class="soft-sm h-mt25">'+esc(p.hotelNaam)+' · '+p.nachten+' '+T('care.nachten','nachten')+' + '+esc(p.behandelingNaam)+' ('+p.duurMin+' min)</div></div>'+
        '<div style="text-align:right;white-space:nowrap;"><div style="color:var(--gold);font-size:0.95rem;">'+eur(p.prijs)+'</div>'+
        (p.bespaar>0?'<div class="soft-sm" style="color:var(--green,#8bc3a8);">'+T('care.bespaar','bespaar')+' '+eur(p.bespaar)+'</div>':'')+'</div></div>';
      if (open){
        const k = carePakKeuze;
        html += '<div style="margin-top:0.5rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div class="soft-sm" style="margin-bottom:0.25rem;">'+T('care.pakkies','Kies wanneer de behandeling valt:')+'</div>'+
          '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;">'+dagen.map(d =>
            '<button class="bz-btn'+(k.datum===d?' on':'')+'" data-carepakd="'+d+'">'+(d===dagen[0]?T('care.vandaag','vandaag'):d.slice(8)+'/'+d.slice(5,7))+'</button>').join('')+'</div>'+
          '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.5rem;">'+(p.tijden||[]).map(t2 =>
            '<button class="bz-btn'+(k.tijd===t2?' on':'')+'" data-carepakt="'+t2+'">'+t2+'</button>').join('')+'</div>'+
          '<button class="bz-groot h-mt70" id="carePakBoek"'+(k.tijd?'':' disabled')+'>'+T('care.pakboek','Boek dit pakket')+' · '+eur(p.prijs)+'</button></div>';
      } else {
        html += '<button class="bz-btn h-mt50" data-carepakopen="'+esc(p.id)+'">'+T('care.pakkies2','Kies dag en tijd')+'</button>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
/* de knoppen onder een zorgpakket: betalen en openen */
    el.querySelectorAll('[data-carepakpay]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/care/pakket/betaal', { ref: x.dataset.carepakpay }); toast(T('care.paktoast','Pakket betaald. Fijn verblijf.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-carepakopen]').forEach(x => x.addEventListener('click', () => {
      carePakOpen = x.dataset.carepakopen; carePakKeuze = { datum: dagen[0], tijd: null }; renderCarePakketten();
    }));
    el.querySelectorAll('[data-carepakd]').forEach(x => x.addEventListener('click', () => { carePakKeuze.datum = x.dataset.carepakd; renderCarePakketten(); }));
    el.querySelectorAll('[data-carepakt]').forEach(x => x.addEventListener('click', () => { carePakKeuze.tijd = x.dataset.carepakt; renderCarePakketten(); }));
    const pb = document.getElementById('carePakBoek');
    if (pb) pb.addEventListener('click', async () => {
      try {
        const r = await API.call('/care/pakket/boek', { pakketId: carePakOpen, datum: carePakKeuze.datum, tijd: carePakKeuze.tijd });
        await API.call('/care/pakket/betaal', { ref: r.pakket.ref });
        toast(T('care.paktoast','Pakket betaald. Fijn verblijf.'));
        carePakOpen = null; carePakKeuze = null;
        laadCare();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- autoverhuur: eerlijk huren ---------- */
  let vhPartners = [], vhOpen = null, vhKeuze = null, vhLocWatch = {};
  function vhFotoKlein(file, cb){
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => {
      const c = document.createElement('canvas'); const sc = Math.min(1, 900 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.7));
    }; img.src = r.result; };
    r.readAsDataURL(file);
  }
  async function laadVerhuur(){
    if (!API.live) return;
    try { vhPartners = (await API.call('/verhuur/aanbod')).partners || []; } catch(e){ vhPartners = []; }
    let mijn = [];
    try { mijn = (await API.call('/huur/mijn')).huren || []; } catch(e){}
    const el = $('#vhMijn');
    const VH_ST = { 'aangevraagd': T('vh.m.geboekt','geboekt; leg de staat vast bij het ophalen'), 'lopend': T('vh.m.lopend','onderweg; goede reis'), 'afgerond': T('vh.m.af','afgerond') };
    if (el) el.innerHTML = mijn.filter(h => h.status !== 'afgerond' || h.tot >= new Date().toISOString().slice(0, 10)).map(h =>
      '<div class="card" style="border-color:rgba(91,185,140,0.35);">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--rtg-leesgroen,var(--green));">\uD83D\uDE97 '+T('vh.m.kop','Huurauto')+' \u00B7 '+esc(h.supplierName)+'</div>'+
      '<div style="margin-top:0.35rem;font-size:0.92rem;"><b>'+esc(h.auto)+'</b>'+(h.kenteken?' ('+esc(h.kenteken)+')':'')+' \u00B7 '+h.van+' \u2192 '+h.tot+' \u00B7 '+eur(h.prijs)+'</div>'+
      (h.spec ? '<div style="margin-top:0.25rem;font-size:0.72rem;color:var(--soft);">'+esc(h.spec.categorie||'')+' \u00B7 '+(h.spec.transmissie==='automaat'?T('vh.aut','automaat'):T('vh.hand','handgesch.'))+' \u00B7 \uD83D\uDC65'+(h.spec.stoelen||'-')+' \u00B7 '+(h.spec.kmPerDag?h.spec.kmPerDag+' km/'+T('vh.dag','dag'):T('vh.onbeperkt','onbeperkt km'))+(h.borg?' \u00B7 '+T('vh.borg','borg')+' '+eur(h.borg):'')+'</div>' : '')+
      '<div style="margin-top:0.25rem;font-size:0.78rem;color:var(--muted);">'+(VH_ST[h.status]||h.status)+' \u00B7 \uD83D\uDCF7 '+T('vh.m.voor','voor')+' '+h.fotosVoor+' \u00B7 '+T('vh.m.na','na')+' '+h.fotosNa+(h.uitgifte?' \u00B7 '+h.uitgifte.kmStart+' km':'')+'</div>'+
      (h.inname ? '<div style="margin-top:0.25rem;font-size:0.78rem;color:'+(h.inname.meerkosten>0?'var(--gold)':'var(--green)')+';">'+(h.inname.meerkosten>0 ? T('vh.m.meer','Meerkosten')+': '+eur(h.inname.meerkosten)+' ('+h.inname.gereden+' km)' : '\u2713 '+h.inname.gereden+' km \u00B7 '+T('vh.m.geenmeer','geen meerkosten, borg vrij'))+'</div>' : '')+
      (h.status !== 'afgerond' ?
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">'+
        (h.status === 'aangevraagd' ? '<button class="bz-btn" data-vhf="'+h.ref+'" data-fase="voor">\uD83D\uDCF7 '+T('vh.m.fotovoor','Staat vastleggen (voor)')+'</button>' : '')+
        (h.status === 'lopend' ? '<button class="bz-btn" data-vhf="'+h.ref+'" data-fase="na">\uD83D\uDCF7 '+T('vh.m.fotona','Staat vastleggen (na)')+'</button>'+
          '<button class="bz-btn'+(h.locatieAan?' on':'')+'" data-vhloc="'+h.ref+'" data-aan="'+(h.locatieAan?'0':'1')+'">\uD83D\uDCCD '+(h.locatieAan?T('vh.m.locuit','Locatie delen uit'):T('vh.m.locaan','Deel live locatie'))+'</button>' : '')+
        '<button data-vhsos="'+h.ref+'" style="background:var(--burgundy-deep);border:1px solid var(--burgundy);color:#fff;border-radius:0;padding:0.5rem 1rem;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">\uD83C\uDD98 SOS</button>'+
        '</div>' : '')+
      '</div>').join('');
    renderVhAanbod();
    koppelVhActies();
  }
  function koppelVhActies(){
    const file = (() => { let f = document.getElementById('vhLidFile');
      if (!f){ f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.capture = 'environment'; f.id = 'vhLidFile'; f.style.display = 'none'; document.body.appendChild(f); }
      return f; })();
    document.querySelectorAll('[data-vhf]').forEach(b => b.addEventListener('click', () => {
      file.onchange = () => {
        if (!file.files[0]) return;
        vhFotoKlein(file.files[0], async (dataUrl) => {
          try { await API.call('/huur/foto', { ref: b.dataset.vhf, fase: b.dataset.fase, foto: dataUrl });
            toast(T('vh.m.foto.ok','Vastgelegd. Dit is uw bewijs van de staat.')); laadVerhuur(); }
          catch(e){ toast(e.message); }
        });
        file.value = '';
      };
      file.click();
    }));
    document.querySelectorAll('[data-vhsos]').forEach(b => b.addEventListener('click', () => {
      const bericht = prompt(T('vh.m.sosvraag','Wat is er aan de hand? (gaat direct naar de verhuurder EN naar RTG)'));
      if (bericht == null) return;
      const stuur = (lat, lng) => API.call('/huur/sos', { ref: b.dataset.vhsos, bericht, lat, lng })
        .then(() => toast(T('vh.m.sosok','SOS verstuurd. De verhuurder en RTG zijn gewaarschuwd.')))
        .catch(e => toast(e.message));
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => stuur(p.coords.latitude, p.coords.longitude), () => stuur());
      else stuur();
    }));
    document.querySelectorAll('[data-vhloc]').forEach(b => b.addEventListener('click', async () => {
      const ref = b.dataset.vhloc, aan = b.dataset.aan === '1';
      try {
        if (aan && navigator.geolocation){
          vhLocWatch[ref] = navigator.geolocation.watchPosition(p =>
            API.call('/huur/locatie', { ref, aan: true, lat: p.coords.latitude, lng: p.coords.longitude }).catch(()=>{}));
          await API.call('/huur/locatie', { ref, aan: true });
        } else {
          if (vhLocWatch[ref] != null){ navigator.geolocation.clearWatch(vhLocWatch[ref]); delete vhLocWatch[ref]; }
          await API.call('/huur/locatie', { ref, aan: false });
        }
        toast(aan ? T('vh.m.locaanok','U deelt uw locatie met de verhuurder; uitzetten kan altijd.') : T('vh.m.locuitok','Locatie delen staat uit en is gewist.'));
        laadVerhuur();
      } catch(e){ toast(e.message); }
    }));
  }
  function renderVhAanbod(){
    const el = $('#vhAanbod'); if (!el) return;
    if (!vhPartners.length){ el.innerHTML = ''; return; }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.25rem 0 0.5rem;">'+T('vh.kop','Autoverhuur, RTG-veilig')+'</div>'+
      '<div style="font-size:0.72rem;color:var(--soft);margin-bottom:0.5rem;">'+T('vh.uitleg','Vaste prijs vooraf betaald. Staat vastgelegd met foto\'s voor en na. SOS-knop en RTG als scheidsrechter.')+'</div>';
/* het voertuigkanaal: partners en hun auto's */
    for (const p of vhPartners){
      html += '<div class="card"><b>'+esc(p.name)+'</b> <span class="soft-sm">\u00B7 '+esc(p.city||'')+'</span>';
      for (const a of p.autos){
        const open = vhOpen === p.code + ':' + a.id;
        html += '<div style="margin-top:0.75rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><div style="font-size:0.88rem;">'+(a.icoon||'\uD83D\uDE97')+' '+esc(a.name)+'</div>'+
          '<span style="color:var(--rtg-leesgoud,var(--gold));font-size:0.82rem;white-space:nowrap;">'+eur(a.dagprijs)+'/'+T('vh.dag','dag')+'</span></div>'+
          '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.2rem;">'+esc(a.categorie||'')+' \u00B7 '+(a.transmissie==='automaat'?T('vh.aut','automaat'):T('vh.hand','handgesch.'))+' \u00B7 '+esc(a.brandstof||'')+' \u00B7 \uD83D\uDC65'+(a.stoelen||'-')+' \u00B7 \uD83E\uDDF3'+(a.bagage||0)+(a.airco?' \u00B7 \u2744\uFE0F':'')+
          ' \u00B7 '+(a.kmPerDag?a.kmPerDag+' km/'+T('vh.dag','dag'):T('vh.onbeperkt','onbeperkt km'))+' \u00B7 '+T('vh.borg','borg')+' '+eur(a.borg||0)+'</div>'+
          (a.apk && a.apk.bekend ? '<div style="font-size:0.68rem;margin-top:0.25rem;color:'+(a.apk.geldig?'var(--green)':'var(--gold)')+';">\uD83D\uDEE1\uFE0F RDW '+(a.apk.geldig?T('vh.apkok','APK geldig'):T('vh.apkuit','APK verloopt'))+' \u00B7 '+T('vh.apktot','tot')+' '+esc(a.apk.apkTot)+'</div>' : '');
        if (open){
          html += '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;">'+
            '<div class="bz-veld" style="flex:1;margin-top:0;"><label>'+T('vh.van','Ophalen')+'</label><input type="date" id="vhVan" value="'+vhKeuze.van+'"></div>'+
            '<div class="bz-veld" style="flex:1;margin-top:0;"><label>'+T('vh.tot','Inleveren')+'</label><input type="date" id="vhTot" value="'+vhKeuze.tot+'"></div></div>'+
            '<button class="bz-groot h-mt70" id="vhBoek">'+T('vh.boek','Boek en betaal, vaste prijs')+'</button>';
        } else {
          html += '<button class="bz-btn h-mt45" data-vhopen="'+p.code+':'+a.id+'">'+T('vh.kies','Kies periode')+'</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-vhopen]').forEach(b => b.addEventListener('click', () => {
      vhOpen = b.dataset.vhopen;
      const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const overmorgen = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      vhKeuze = { van: morgen, tot: overmorgen };
      renderVhAanbod(); koppelVhActies();
    }));
    const boek = document.getElementById('vhBoek');
    if (boek) boek.addEventListener('click', async () => {
      const [code, autoId] = vhOpen.split(':');
      try {
        const h = await API.call('/huur/boek', { supplierCode: code, autoId, van: $('#vhVan').value, tot: $('#vhTot').value });
        await API.call('/booking/pay', { ref: h.huur.ref });
        toast(T('vh.ok','Geboekt en betaald: ') + eur(h.huur.price) + T('vh.ok2',' vast, geen verrassingen aan de balie.'));
        vhOpen = null; vhKeuze = null;
        laadVerhuur();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- charter: boten en jachten huren ---------- */
  let chPartners = [], chOpen = null, chKeuze = null, chLocWatch = {};
  async function laadCharter(){
    if (!API.live) return;
    try { chPartners = (await API.call('/charter/aanbod')).partners || []; } catch(e){ chPartners = []; }
    let mijn = [];
    try { mijn = (await API.call('/charter/mijn')).charters || []; } catch(e){}
    const el = $('#chMijn');
    const CH_ST = { 'aangevraagd': T('ch.m.geboekt','geboekt; leg de staat vast bij het uitvaren'), 'lopend': T('ch.m.lopend','op zee; behouden vaart'), 'afgerond': T('ch.m.af','afgerond') };
    if (el) el.innerHTML = mijn.filter(c => c.status !== 'afgerond' || c.tot >= new Date().toISOString().slice(0, 10)).map(c =>
      '<div class="card" style="border-color:rgba(91,185,140,0.35);">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--rtg-leesgroen,var(--green));">'+T('ch.m.kop','Charter')+' · '+esc(c.supplierName)+'</div>'+
      '<div style="margin-top:0.35rem;font-size:0.92rem;"><b>'+esc(c.boot)+'</b> ('+esc(c.type)+') · '+c.van+' → '+c.tot+' · '+eur(c.prijs)+'</div>'+
      (c.spec ? '<div style="margin-top:0.25rem;font-size:0.72rem;color:var(--soft);">'+(c.spec.lengte||0)+'m · '+(c.spec.gasten||'-')+(c.spec.hutten?' · '+c.spec.hutten:'')+' · '+(c.spec.snelheidKn||0)+' kn · '+esc(c.spec.ligplaats||'')+(c.borg?' · '+T('ch.borg','borg')+' '+eur(c.borg):'')+'</div>' : '')+
      '<div style="margin-top:0.25rem;font-size:0.78rem;color:var(--muted);">'+(c.metSkipper?''+T('ch.m.metskipper','met schipper')+(c.skipperNaam?' ('+esc(c.skipperNaam)+')':''):T('ch.m.bareboat','bareboat'))+' · '+(CH_ST[c.status]||c.status)+' ·  '+c.fotosVoor+'/'+c.fotosNa+'</div>'+
      (c.teruggave ? '<div style="margin-top:0.25rem;font-size:0.78rem;color:'+(c.teruggave.meerkosten>0?'var(--gold)':'var(--green)')+';">'+(c.teruggave.meerkosten>0 ? T('ch.m.meer','Meerkosten')+': '+eur(c.teruggave.meerkosten) : '✓ '+T('ch.m.geenmeer','geen meerkosten, borg vrij'))+'</div>' : '')+
      (c.status !== 'afgerond' ?
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">'+
        (c.status === 'aangevraagd' ? '<button class="bz-btn" data-chf="'+c.ref+'" data-fase="voor">'+T('ch.m.fotovoor','Staat vastleggen (voor)')+'</button>' : '')+
        (c.status === 'lopend' ? '<button class="bz-btn" data-chf="'+c.ref+'" data-fase="na">'+T('ch.m.fotona','Staat vastleggen (na)')+'</button>'+
          '<button class="bz-btn'+(c.locatieAan?' on':'')+'" data-chloc="'+c.ref+'" data-aan="'+(c.locatieAan?'0':'1')+'">'+(c.locatieAan?T('ch.m.locuit','Positie delen uit'):T('ch.m.locaan','Deel live positie'))+'</button>' : '')+
        '<button data-chsos="'+c.ref+'" style="background:var(--burgundy-deep);border:1px solid var(--burgundy);color:#fff;border-radius:0;padding:0.5rem 1rem;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">SOS</button>'+
        '</div>' : '')+
      '</div>').join('');
    renderChAanbod();
    koppelChActies();
  }
  function koppelChActies(){
    const file = (() => { let f = document.getElementById('chLidFile');
      if (!f){ f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.capture = 'environment'; f.id = 'chLidFile'; f.style.display = 'none'; document.body.appendChild(f); }
      return f; })();
    document.querySelectorAll('[data-chf]').forEach(b => b.addEventListener('click', () => {
      file.onchange = () => {
        if (!file.files[0]) return;
        vhFotoKlein(file.files[0], async (dataUrl) => {
          try { await API.call('/charter/foto', { ref: b.dataset.chf, fase: b.dataset.fase, foto: dataUrl });
            toast(T('ch.m.foto.ok','Vastgelegd. Dit is uw bewijs van de staat.')); laadCharter(); }
          catch(e){ toast(e.message); }
        });
        file.value = '';
      };
      file.click();
    }));
    document.querySelectorAll('[data-chsos]').forEach(b => b.addEventListener('click', () => {
      const bericht = prompt(T('ch.m.sosvraag','Wat is er aan de hand? (gaat direct naar het charterbedrijf EN naar RTG)'));
      if (bericht == null) return;
      const stuur = (lat, lng) => API.call('/charter/sos', { ref: b.dataset.chsos, bericht, lat, lng })
        .then(() => toast(T('ch.m.sosok','SOS verstuurd. Het charterbedrijf en RTG zijn gewaarschuwd.')))
        .catch(e => toast(e.message));
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => stuur(p.coords.latitude, p.coords.longitude), () => stuur());
      else stuur();
    }));
    document.querySelectorAll('[data-chloc]').forEach(b => b.addEventListener('click', async () => {
      const ref = b.dataset.chloc, aan = b.dataset.aan === '1';
      try {
        if (aan && navigator.geolocation){
          chLocWatch[ref] = navigator.geolocation.watchPosition(p =>
            API.call('/charter/locatie', { ref, aan: true, lat: p.coords.latitude, lng: p.coords.longitude }).catch(()=>{}));
          await API.call('/charter/locatie', { ref, aan: true });
        } else {
          if (chLocWatch[ref] != null){ navigator.geolocation.clearWatch(chLocWatch[ref]); delete chLocWatch[ref]; }
          await API.call('/charter/locatie', { ref, aan: false });
        }
        toast(aan ? T('ch.m.locaanok','U deelt uw positie met het charterbedrijf; uitzetten kan altijd.') : T('ch.m.locuitok','Positie delen staat uit en is gewist.'));
        laadCharter();
      } catch(e){ toast(e.message); }
    }));
  }
  function renderChAanbod(){
    const el = $('#chAanbod'); if (!el) return;
    if (!chPartners.length){ el.innerHTML = ''; return; }
/* het chauffeurskanaal: vaste prijzen per partner */
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.25rem 0 0.5rem;">'+T('ch.kop','Boten & jachten, RTG-veilig')+'</div>'+
      '<div style="font-size:0.72rem;color:var(--soft);margin-bottom:0.5rem;">'+T('ch.uitleg','Vaste prijs vooraf. Met of zonder schipper (bareboat met vaarbewijs). Staat met foto\'s voor en na, SOS op zee en RTG als scheidsrechter.')+'</div>';
    for (const p of chPartners){
      html += '<div class="card"><b>'+esc(p.name)+'</b> <span class="soft-sm">· '+esc(p.city||'')+'</span>';
      for (const b of p.boten){
        const open = chOpen === p.code + ':' + b.id;
        html += '<div style="margin-top:0.75rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><div style="font-size:0.88rem;">'+(b.icoon||'')+' '+esc(b.naam)+'</div>'+
          '<span style="color:var(--rtg-leesgoud,var(--gold));font-size:0.82rem;white-space:nowrap;">'+eur(b.dagprijs)+'/'+T('ch.dag','dag')+'</span></div>'+
          '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.2rem;">'+esc(b.type||'')+' · '+(b.lengte||0)+'m · '+(b.gasten||'-')+(b.hutten?' · '+b.hutten:'')+' · '+(b.snelheidKn||0)+' kn · '+esc(b.ligplaats||'')+' · '+T('ch.borg','borg')+' '+eur(b.borg||0)+
          ' · '+(b.skipperVerplicht?''+T('ch.skipperv','schipper verplicht'):(b.vaarbewijsVereist?T('ch.vaarbewijs','vaarbewijs of schipper'):T('ch.vrij','vrij')))+'</div>';
        if (open){
          const verplicht = b.skipperVerplicht;
          html += '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;">'+
            '<div class="bz-veld" style="flex:1;margin-top:0;"><label>'+T('ch.van','Vanaf')+'</label><input type="date" id="chVan" value="'+chKeuze.van+'"></div>'+
            '<div class="bz-veld" style="flex:1;margin-top:0;"><label>'+T('ch.tot','Tot')+'</label><input type="date" id="chTot" value="'+chKeuze.tot+'"></div>'+
            '<div class="bz-veld" style="width:76px;margin-top:0;"><label>'+T('ch.gastn','Gasten')+'</label><input type="number" id="chGasten" min="1" max="'+(b.gasten||12)+'" value="'+Math.min(2,b.gasten||2)+'"></div></div>'+
            (verplicht
              ? '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.5rem;">'+T('ch.altijdskipper','Dit vaartuig vaart altijd met een schipper (+'+eur(b.skipperPrijsPerDag||0)+'/'+T('ch.dag','dag')+').')+'</div>'
              : '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;margin-top:0.5rem;"><input type="checkbox" id="chSkipper">  '+T('ch.wilskipper','Met schipper (+'+eur(b.skipperPrijsPerDag||0)+'/'+T('ch.dag','dag')+')')+'</label>'+
                '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;margin-top:0.25rem;"><input type="checkbox" id="chVaarbewijs"> '+T('ch.hebvaarbewijs','Ik vaar bareboat en heb een geldig vaarbewijs')+'</label>')+
            '<button class="bz-groot h-mt70" id="chBoek" data-verplicht="'+(verplicht?'1':'0')+'">'+T('ch.boek','Boek en betaal, vaste prijs')+'</button>';
        } else {
          html += '<button class="bz-btn h-mt45" data-chopen="'+p.code+':'+b.id+'">'+T('ch.kies','Kies periode')+'</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-chopen]').forEach(b => b.addEventListener('click', () => {
      chOpen = b.dataset.chopen;
      chKeuze = { van: new Date(Date.now() + 86400000).toISOString().slice(0, 10), tot: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) };
      renderChAanbod(); koppelChActies();
    }));
    const boek = document.getElementById('chBoek');
    if (boek) boek.addEventListener('click', async () => {
      const [code, bootId] = chOpen.split(':');
      const verplicht = boek.dataset.verplicht === '1';
      const metSkipper = verplicht || ($('#chSkipper') && $('#chSkipper').checked);
      const body = { supplierCode: code, bootId, van: $('#chVan').value, tot: $('#chTot').value, gasten: Number($('#chGasten').value), metSkipper };
      if (!metSkipper && $('#chVaarbewijs')) body.vaarbewijs = $('#chVaarbewijs').checked;
      try {
        const c = await API.call('/charter/boek', body);
        await API.call('/booking/pay', { ref: c.charter.ref });
        toast(T('ch.ok','Geboekt en betaald: ') + eur(c.charter.price) + T('ch.ok2',' vast. Behouden vaart.'));
        chOpen = null; chKeuze = null;
        laadCharter();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- vastgoed: aanbod, interesse, bod, keyless ---------- */
  let vgOpen = null;
  const vgGeld = n => '\u20AC ' + Number(n||0).toLocaleString('nl-NL');
  async function laadVastgoed(){
    if (!API.live) return;
    let d = { panden: [], bezichtigingen: [], biedingen: [] };
    try { d = await API.call('/vastgoed/aanbod'); } catch(e){}
    const el = $('#vgMijn'); if (!el) return;
    if (!d.panden.length && !d.bezichtigingen.length && !d.biedingen.length){ el.innerHTML = ''; return; }
    let html = '';
    // lopende bezichtigingen met keyless
    for (const b of d.bezichtigingen){
      if (b.status === 'afgewezen') continue;
      html += '<div class="card" style="border-color:rgba(91,185,140,0.4);">'+
        '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--rtg-leesgroen,var(--green));">\uD83D\uDD11 '+T('vg.m.bez','Bezichtiging')+' \u00B7 '+esc(b.pand)+'</div>'+
        '<div style="margin-top:0.3rem;font-size:0.85rem;">'+({ 'aangevraagd': T('vg.m.aangevr','aangevraagd, wacht op bevestiging'), 'bevestigd': T('vg.m.bevestigd','bevestigd')+(b.moment?' \u00B7 '+String(b.moment).replace('T',' ').slice(0,16):''), 'afgewezen': T('vg.m.afgewezen','afgewezen') }[b.status] || b.status)+'</div>'+
        (b.keyless ? (b.keyless.actiefNu
          ? '<button class="bz-groot h-mt60" data-vgkey="'+b.ref+'">\uD83D\uDD13 '+T('vg.m.open','Open de deur (keyless)')+'</button>'
          : '<div style="margin-top:0.5rem;font-size:0.76rem;color:var(--soft);">\uD83D\uDD12 '+T('vg.m.venster','Keyless toegang rond het afgesproken moment')+'</div>') : '')+
        '</div>';
    }
    // eigen biedingen
    for (const b of d.biedingen){
      html += '<div class="card"><div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--rtg-leesgoud,var(--gold));">\uD83D\uDCB0 '+T('vg.m.bod','Uw bod')+' \u00B7 '+esc(b.pand)+'</div>'+
        '<div style="margin-top:0.3rem;font-size:0.85rem;">'+vgGeld(b.bedrag)+' \u00B7 <b>'+({ 'open':T('vg.m.open2','in behandeling'),'geaccepteerd':T('vg.m.acc','geaccepteerd!'),'afgewezen':T('vg.m.afg','afgewezen'),'tegenbod':T('vg.m.tegen','tegenbod')+(b.tegenbod?' '+vgGeld(b.tegenbod):'') }[b.status]||b.status)+'</b></div></div>';
    }
    // aangeboden panden
    if (d.panden.length){
      html += '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.25rem 0 0.5rem;">\uD83C\uDFE1 '+T('vg.m.aanbod','Voor u: vastgoed')+'</div>';
      for (const p of d.panden){
        const open = vgOpen === p.supplierCode + ':' + p.id;
        html += '<div class="card">'+
          (p.fotos && p.fotos.length ? '<img src="'+p.fotos[0]+'" alt="" style="width:100%;border-radius:0;margin-bottom:0.5rem;max-height:180px;object-fit:cover;">' : '')+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><b>'+esc(p.titel)+(p.gericht?' <span style="font-size:0.6rem;color:var(--burgundy);">\u2605 '+T('vg.m.gericht','persoonlijk')+'</span>':'')+'</b>'+
          '<span style="color:var(--rtg-leesgoud,var(--gold));white-space:nowrap;">'+vgGeld(p.prijs)+(p.transactie==='huur'?'/mnd':'')+'</span></div>'+
          '<div style="font-size:0.74rem;color:var(--soft);margin-top:0.2rem;">'+esc(p.soort)+' \u00B7 '+esc(p.plaats||'')+' \u00B7 \uD83D\uDECF\uFE0F'+(p.slaapkamers||0)+' \u00B7 \uD83D\uDEC1'+(p.badkamers||0)+' \u00B7 '+(p.oppervlakte||0)+'m\u00B2'+(p.zwembad?' \u00B7 \uD83C\uDFCA':'')+'</div>'+
          (open ? '<div style="margin-top:0.5rem;font-size:0.82rem;color:var(--muted);">'+escT(p.omschrijving||'')+'</div>'+
            (p.fotos && p.fotos.length > 1 ? '<div style="display:flex;gap:0.4rem;overflow-x:auto;margin-top:0.5rem;">'+p.fotos.slice(1).map(f=>'<img src="'+f+'" alt="" style="height:70px;border-radius:0;">').join('')+'</div>' : '')+
            '<div style="display:flex;gap:0.5rem;margin-top:0.7rem;">'+
            '<button class="bz-groot h-flex1" data-vgint="'+p.supplierCode+':'+p.id+'">\uD83D\uDC41\uFE0F '+T('vg.m.interesse','Bezichtigen')+'</button>'+
            '<button class="bz-btn" data-vgbod="'+p.supplierCode+':'+p.id+'">\uD83D\uDCB0 '+T('vg.m.doebod','Bod')+'</button></div>'
            : '<button class="bz-btn h-mt50" data-vgopen="'+p.supplierCode+':'+p.id+'">'+T('vg.m.bekijk','Bekijk')+'</button>')+
          '</div>';
      }
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-vgopen]').forEach(b => b.addEventListener('click', () => { vgOpen = b.dataset.vgopen; laadVastgoed(); }));
/* een bezichtiging aanvragen bij een vastgoedpartner */
    document.querySelectorAll('[data-vgint]').forEach(b => b.addEventListener('click', async () => {
      const [code, pid] = b.dataset.vgint.split(':');
      const wens = prompt(T('vg.m.wensvraag','Wanneer zou u willen bezichtigen? (bijv. zaterdagochtend)'));
      if (wens === null) return;
      try { await API.call('/vastgoed/interesse', { supplierCode: code, pandId: pid, wens }); toast(T('vg.m.intok','De makelaar krijgt uw aanvraag en bevestigt een moment.')); laadVastgoed(); }
      catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vgbod]').forEach(b => b.addEventListener('click', async () => {
      const [code, pid] = b.dataset.vgbod.split(':');
      const bod = prompt(T('vg.m.bodvraag','Uw bod in euro:'));
      if (!bod) return;
      try { await API.call('/vastgoed/bod', { supplierCode: code, pandId: pid, bedrag: Number(bod) }); toast(T('vg.m.bodok','Uw bod is verstuurd naar de makelaar.')); laadVastgoed(); }
      catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vgkey]').forEach(b => b.addEventListener('click', async () => {
      try { const r = await API.call('/vastgoed/keyless', { ref: b.dataset.vgkey }); toast('\uD83D\uDD13 '+T('vg.m.geopend','De deur is open. Code: ')+r.code); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- contracten: digitaal ondertekenen ---------- */  /* ---------- contracten: digitaal ondertekenen ---------- */
  async function laadContracten(){
    if (!API.live) return;
    let lijst = [];
    try { lijst = (await API.call('/contracten/mijn')).contracten || []; } catch(e){}
    const el = $('#conMijn'); if (!el) return;
    const open = lijst.filter(c => c.status !== 'geweigerd');
    if (!open.length){ el.innerHTML = ''; return; }
    el.innerHTML = open.map(c =>
      '<div class="card" style="border-color:'+(c.getekendDoorMij?'rgba(91,185,140,0.4)':'rgba(208,172,87,0.5)')+';">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:'+(c.getekendDoorMij?'var(--green)':'var(--gold)')+';">\uD83D\uDCDD '+esc(c.supplierName)+' \u00B7 '+T('con.'+c.soort, c.soort)+'</div>'+
      '<div style="margin-top:0.25rem;font-size:0.92rem;"><b>'+esc(c.titel)+'</b></div>'+
      (c.velden && c.velden.length ? '<div style="margin-top:0.25rem;font-size:0.76rem;color:var(--muted);">'+c.velden.map(v=>esc(v.label)+': '+esc(v.waarde)).join(' \u00B7 ')+'</div>' : '')+
      '<details class="h-mt40"><summary style="cursor:pointer;font-size:0.74rem;color:var(--gold);">'+T('con.lees','Lees de voorwaarden')+'</summary><div style="font-size:0.8rem;color:var(--muted);white-space:pre-wrap;margin-top:0.25rem;">'+escT(c.tekst)+'</div></details>'+
      (c.getekendDoorMij
        ? '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--green);">\u2705 '+(c.status==='getekend'?T('con.klaar','Getekend door beide partijen.'):T('con.wacht','U tekende; de zaak tekent nog.'))+'</div>'
        : '<div style="margin-top:0.5rem;display:flex;gap:0.5rem;"><button class="bz-groot h-flex1" data-conteken="'+c.ref+'">'+T('con.teken','Ondertekenen')+'</button><button class="bz-btn" data-conweiger="'+c.ref+'">'+T('con.weiger','Weiger')+'</button></div>')+
      '</div>').join('');
    document.querySelectorAll('[data-conteken]').forEach(b => b.addEventListener('click', async () => {
      const naam = prompt(T('con.tekenvraag','Typ uw naam om digitaal te ondertekenen. Zo gaat u akkoord met de voorwaarden.'));
      if (!naam) return;
      try { await API.call('/contract/teken', { ref: b.dataset.conteken, naam, akkoord: true }); toast(T('con.tekenok','Getekend. Bedankt!')); laadContracten(); }
      catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-conweiger]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm(T('con.weigervraag','Dit contract weigeren?'))) return;
      try { await API.call('/contract/weiger', { ref: b.dataset.conweiger }); toast(T('con.weigerok','Geweigerd.')); laadContracten(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- bestellen: de ophaal/bezorgdienst ---------- */
  let bzPartners = [], bzZaak = null, bzMand = {}, bzLevering = 'bezorgen', bzGeo = null, bzAdresW = '';
  async function laadBestellen(){
    if (!API.live) return;
    try { bzPartners = (await API.call('/bezorg/partners')).partners || []; } catch(e){ bzPartners = []; }
    renderBestellen();
    laadBzMijn();
  }

  // De exclusieve autoshowroom: bekijken, proefrit, kopen (bod/inruil/concierge)
  async function laadShowroom(){
    const el = $('#showroom'); if (!el || !API.live) return;
    if (user && user.tier === 'guest'){ el.innerHTML = ''; return; }
    let d, mijn;
    try { d = await API.call('/verkoop/showroom'); mijn = await API.call('/verkoop/mijn'); } catch(e){ el.innerHTML = ''; return; }
    const autos = d.autos || [];
    const deals = (mijn.deals || []).filter(x => !['gereden','afgeleverd','afgewezen','geannuleerd'].includes(x.status));
    if (!autos.length && !deals.length){ el.innerHTML = ''; return; }
    let h = '<h3 style="margin:1.25rem 0 0.25rem;font-size:1rem;">' + T('vk.h','Autoshowroom') + '</h3><p class="sub" style="margin-bottom:0.5rem;">' + T('vk.sub','Exclusieve occasions. Proefrit, bod of inruil.') + '</p>';
    for (const d2 of deals){
      h += '<div style="border:1px solid var(--gold);border-radius:0;padding:0.7rem 0.9rem;margin-bottom:0.7rem;"><div style="font-size:0.7rem;color:var(--gold);text-transform:uppercase;letter-spacing:0.08em;">' + (d2.soort==='koop'?''+T('vk.koop','Koop'):''+T('vk.proefritk','Proefrit')) + ' · ' + escT(d2.status) + '</div>' +
        '<div style="font-size:0.86rem;margin-top:0.2rem;">' + escT(d2.autoNaam) + (d2.prijs?' · € ' + d2.prijs.toLocaleString('nl-NL'):'') + (d2.moment?' · ' + escT(d2.moment):'') + '</div>' +
        (d2.soort==='koop' && d2.status==='aanvaard' ? '<button class="js-vkteken" data-ref="' + d2.ref + '" style="margin-top:0.5rem;background:var(--gold);color:#000;border:none;border-radius:0;padding:0.5rem 0.9rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('vk.teken','Koopcontract tekenen') + '</button>' : '') + '</div>';
    }
    h += autos.slice(0,20).map(a => '<div style="border:1px solid var(--line);border-radius:0;padding:0.85rem;margin-bottom:0.7rem;" data-av="' + a.id + '">' +
      '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><b style="font-size:0.95rem;">' + (a.vip?'':'') + escT(a.naam) + '</b><span style="font-weight:600;">€ ' + a.prijs.toLocaleString('nl-NL') + '</span></div>' +
      '<div class="sub">' + a.km.toLocaleString('nl-NL') + ' km · ' + escT(a.brandstof) + ' · ' + escT(a.transmissie) + (a.vermogenPk?' · ' + a.vermogenPk + ' pk':'') + (a.garantieMnd?' · ' + a.garantieMnd + ' mnd garantie':'') + '</div>' +
      (a.opties && a.opties.length ? '<div class="sub h-mt20">' + a.opties.slice(0,4).map(escT).join(' · ') + '</div>' : '') +
      '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;">' +
      '<button class="js-vkproef" data-code="' + a.supplierCode + '" data-id="' + a.id + '" style="flex:1;background:none;border:1px solid var(--gold);border-radius:0;padding:0.45rem;color:var(--gold);font-weight:600;font-family:inherit;cursor:pointer;">' + T('vk.proefritk','Proefrit') + '</button>' +
      '<button class="js-vkkoop" data-code="' + a.supplierCode + '" data-id="' + a.id + '" data-prijs="' + a.prijs + '" data-naam="' + escAttr(a.naam) + '" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:0;padding:0.45rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('vk.bodknop','Bod / kopen') + '</button>' +
      '</div></div>').join('');
    el.innerHTML = h;
    el.querySelectorAll('.js-vkteken').forEach(b => b.addEventListener('click', async () => {
      const naam = prompt(T('vk.tekennaam','Typ uw naam om het koopcontract te tekenen:')); if (!naam) return;
      try { await API.call('/verkoop/teken', { ref: b.dataset.ref, naam }); toast('' + T('vk.getekend','Getekend. De zaak levert de auto af.')); laadShowroom(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-vkproef').forEach(b => b.addEventListener('click', async () => {
      const wens = prompt(T('vk.wens','Wanneer wilt u proefrijden? (bv. zaterdagochtend)')) || '';
      try { await API.call('/verkoop/proefrit', { supplierCode: b.dataset.code, autoId: b.dataset.id, wens }); toast('' + T('vk.proefok','Proefrit aangevraagd. De zaak plant hem in.')); laadShowroom(); } catch(e){ toast(e.message); }
    }));
/* een auto kopen of inruilen, met een bod */
    el.querySelectorAll('.js-vkkoop').forEach(b => b.addEventListener('click', async () => {
      const bod = prompt(T('vk.bodvraag','Uw bod in € (leeg = vraagprijs):'), b.dataset.prijs);
      if (bod === null) return;
      const wilInruil = confirm(T('vk.inruilvraag','Wilt u een auto inruilen?'));
      let inruil = null;
      if (wilInruil){ const merk = prompt(T('vk.inmerk','Merk + model van uw inruilauto:')); if (merk){ const jaar = prompt(T('vk.injaar','Bouwjaar?'),''); const km = prompt(T('vk.inkm','Kilometerstand?'),''); inruil = { merk, model: '', jaar, km }; } }
      const concierge = confirm(T('vk.concvraag','Concierge-aflevering op uw adres?'));
      const adres = concierge ? (prompt(T('vk.adres','Afleveradres:')) || '') : '';
      try { await API.call('/verkoop/koop', { supplierCode: b.dataset.code, autoId: b.dataset.id, bod: bod===''?undefined:bod, inruil, concierge, adres }); toast('' + T('vk.koopok','Aanvraag verstuurd. U hoort snel van de zaak.')); laadShowroom(); } catch(e){ toast(e.message); }
    }));
  }

  // Boodschappen bij een groothandel/supermarkt (consumentprijs, met bezorging)
  async function laadBoodschappen(){
    const el = $('#boodschappen'); if (!el || !API.live) return;
    if (user && user.tier === 'guest'){ el.innerHTML = ''; return; }
    let markt, mijn;
    try { markt = await API.call('/groothandel/markt'); mijn = await API.call('/groothandel/mijn'); } catch(e){ el.innerHTML = ''; return; }
    const winkels = markt.groothandels || [];
    if (!winkels.length && !(mijn.bestellingen||[]).length){ el.innerHTML = ''; return; }
    let h = '<h3 style="margin:1.25rem 0 0.25rem;font-size:1rem;">' + T('bo.h','Boodschappen') + '</h3><p class="sub" style="margin-bottom:0.5rem;">' + T('bo.sub','Bestel en laat bezorgen.') + '</p>';
    for (const g of winkels){
      h += '<div style="border:1px solid var(--line);border-radius:0;padding:0.85rem;margin-bottom:0.8rem;">' +
        '<b>' + escT(g.naam) + '</b><span class="sub"> · ' + escT(g.city||'') + '</span>' +
        g.producten.slice(0,50).map(p => '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-top:1px solid var(--line);">' +
          '<div class="h-flex1"><span style="font-size:0.85rem;">' + escT(p.naam) + '</span><span class="sub"> · € ' + p.prijs + '/' + escT(p.eenheid) + '</span></div>' +
          '<input class="js-boq" data-code="' + g.code + '" data-pid="' + p.id + '" type="number" min="0" placeholder="0" aria-label="' + T('bo.aantal','Aantal') + '" style="width:3.6rem;text-align:center;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.35rem;color:var(--txt);font-family:inherit;"></div>').join('') +
        '<button class="js-bobestel" data-code="' + g.code + '" style="width:100%;margin-top:0.5rem;background:var(--gold);color:#000;border:none;border-radius:0;padding:0.55rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('bo.bestel','Bezorgen') + '</button></div>';
    }
    if ((mijn.bestellingen||[]).length){
      h += '<div class="sub" style="margin:0.6rem 0 0.3rem;">' + T('bo.mijn','Mijn boodschappen') + '</div>';
      h += mijn.bestellingen.slice(0,10).map(o => '<div style="border:1px solid var(--line);border-radius:0;padding:0.5rem 0.7rem;margin-bottom:0.35rem;"><div style="display:flex;gap:0.5rem;"><b style="flex:1;font-size:0.82rem;">' + escT(o.groothandelNaam) + ' · € ' + o.subtotaal + '</b><span class="sub">' + escT(o.status) + '</span></div></div>').join('');
    }
    el.innerHTML = h;
    el.querySelectorAll('.js-bobestel').forEach(b => b.addEventListener('click', async () => {
      const regels = [];
      el.querySelectorAll('.js-boq[data-code="' + b.dataset.code + '"]').forEach(inp => { const a = Number(inp.value)||0; if (a>0) regels.push({ productId: inp.dataset.pid, aantal: a }); });
      if (!regels.length) return toast(T('bo.kies','Vul minstens een aantal in.'));
      try { await API.call('/groothandel/bestel', { groothandelCode: b.dataset.code, regels }); toast('' + T('bo.ok','Boodschappen besteld.')); laadBoodschappen(); } catch(e){ toast(e.message); }
    }));
  }
  async function laadBzMijn(){
    const el = $('#bzMijn'); if (!el || !API.live) return;
    let mijn = [];
    try { mijn = ((await API.call('/orders/mine')).orders || []).filter(o => o.levering && !['bezorgd','opgehaald','geweigerd','terugbetaald','wacht-op-betaling'].includes(o.status)); } catch(e){}
    if (!mijn.length){ el.innerHTML = ''; return; }
    el.innerHTML = mijn.map(o => {
      const st = { 'nieuw': T('bz.m.nieuw','ontvangen door de zaak'), 'in bereiding': T('bz.m.bereid','wordt bereid'),
        'klaar': o.levering === 'ophalen' ? T('bz.m.haal','klaar om op te halen') : T('bz.m.wachtb','klaar, wacht op de bezorger'),
        'onderweg': T('bz.m.weg','onderweg naar u') }[o.status] || o.status;
      return '<div class="card" style="border-color:rgba(194,58,94,0.35);" data-bzvolg="'+o.ref+'">'+
        '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--burgundy);display:flex;align-items:center;gap:0.4rem;"><span class="livedot"></span>'+esc(o.supplierName)+' \u00B7 '+(o.levering==='ophalen'?T('bz.m.ophalen','ophalen'):T('bz.m.bezorgen','bezorging'))+'</div>'+
        '<div style="margin-top:0.4rem;font-size:0.9rem;"><b>'+st+'</b><span id="bzEta-'+o.ref+'">'+(o.status==='onderweg'&&o.etaMin?' \u00B7 \u23F1 '+o.etaMin+' min':'')+'</span></div>'+
        '<div style="margin-top:0.3rem;font-size:0.78rem;color:var(--muted);">'+o.items.map(i=>i.qty+'x '+esc(i.name)).join(', ')+
        (o.levering==='ophalen' ? ' \u00B7 '+T('bz.m.code','code')+' <b style="color:var(--rtg-leesgoud,var(--gold));">'+o.pickup+'</b>' : (o.bezorger?' \u00B7 \uD83D\uDEF5 '+esc(o.bezorger.name):''))+'</div></div>';
    }).join('');
  }
  function opBezorg(d){
    // live: status, bezorger of GPS/ETA veranderd
    if (d.kind === 'gps'){
      const el = document.getElementById('bzEta-' + d.ref);
      if (el && d.etaMin) el.textContent = ' \u00B7 \u23F1 ' + d.etaMin + ' min';
      return;
    }
    laadBzMijn();
    if (d.kind === 'status' && (d.status === 'bezorgd' || d.status === 'opgehaald')) toast(T('bz.m.klaar2','Eet smakelijk! Uw bestelling is er.'));
  }
  function renderBestellen(){
    const el = $('#bzInhoud'); if (!el) return;
    if (bzZaak) return renderBzZaak();
    if (!bzPartners.length){
      el.innerHTML = '<div class="card"><div style="font-size:0.85rem;color:var(--muted);">'+T('bz.geen','Nog geen partners met een bezorgdienst op uw bestemming. Zodra een zaak de dienst opent, staat hij hier.')+'</div>'+
        '<button class="rahul-leeg-knop h-mt60" data-rahul-leeg="Zoek waar ik hier iets kan bestellen en laten bezorgen, en regel het">'+T('bz.geendoe','Laat Rahul iets bestellen')+'</button></div>';
      return;
    }
    el.innerHTML = bzPartners.map(p =>
      '<button class="card" style="display:block;width:100%;text-align:left;cursor:pointer;" data-bzkies="'+p.code+'">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;"><b>'+esc(p.name)+'</b><span class="soft-sm">'+esc(p.city||'')+'</span></div>'+
      '<div style="margin-top:0.25rem;font-size:0.76rem;color:var(--muted);">'+(p.bezorgen?'\uD83D\uDEF5 '+T('bz.kan.bez','bezorgen'):'')+(p.bezorgen&&p.ophalen?' \u00B7 ':'')+(p.ophalen?'\uD83E\uDDFA '+T('bz.kan.oph','ophalen'):'')+' \u00B7 '+p.producten.length+' '+T('bz.prod','producten')+'</div></button>'
    ).join('');
    document.querySelectorAll('[data-bzkies]').forEach(b => b.addEventListener('click', () => {
      bzZaak = bzPartners.find(p => p.code === b.dataset.bzkies); bzMand = {};
      bzLevering = bzZaak.bezorgen ? 'bezorgen' : 'ophalen';
      renderBzZaak();
    }));
  }
  function bzTotaal(){ return (bzZaak.producten||[]).reduce((t,p) => t + (bzMand[p.id]||0) * p.price, 0); }
  function renderBzZaak(){
    const el = $('#bzInhoud'); if (!el) return;
    const p = bzZaak;
    const n = Object.values(bzMand).reduce((a,b)=>a+b,0);
/* de bazaar van een partner: producten en bestellen */
    el.innerHTML =
      '<button class="bz-btn" id="bzTerug" style="margin-bottom:0.75rem;">\u2039 '+T('bz.terug','Alle partners')+'</button>'+
      '<div class="card"><b>'+esc(p.name)+'</b>'+
      p.producten.map(x =>
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.75rem;">'+
        '<div class="h-flex1"><div style="font-size:0.88rem;">'+esc(x.name)+'</div>'+(x.desc?'<div class="soft-sm">'+esc(x.desc)+'</div>':'')+'</div>'+
        '<span style="color:var(--gold);font-size:0.82rem;">'+eur(x.price)+'</span>'+
        '<span style="display:flex;align-items:center;gap:0.45rem;">'+
        '<button class="bz-btn" data-bzmin="'+x.id+'" style="padding:0.2rem 0.7rem;">\u2212</button><b>'+(bzMand[x.id]||0)+'</b><button class="bz-btn" data-bzplus="'+x.id+'" style="padding:0.2rem 0.7rem;">+</button></span></div>'
      ).join('')+'</div>'+
      '<div class="card">'+
      '<div style="display:flex;gap:0.5rem;">'+
      (p.bezorgen?'<button class="bz-btn'+(bzLevering==='bezorgen'?' on':'')+'" data-bzlev="bezorgen">\uD83D\uDEF5 '+T('bz.kan.bez','bezorgen')+'</button>':'')+
      (p.ophalen?'<button class="bz-btn'+(bzLevering==='ophalen'?' on':'')+'" data-bzlev="ophalen">\uD83E\uDDFA '+T('bz.kan.oph','ophalen')+'</button>':'')+'</div>'+
      (bzLevering==='bezorgen' ? '<div class="bz-veld"><label>'+T('bz.adres','Bezorgadres')+'</label><input id="bzAdres" value="'+escAttr(bzAdresW)+'" placeholder="'+T('bz.adresph','Straat, nummer, plaats')+'"></div>'+
        '<button class="bz-btn'+(bzGeo?' on':'')+' h-mt50" id="bzHier">\uD83D\uDCCD '+(bzGeo?T('bz.hierok','Locatie gedeeld voor de ETA'):T('bz.hier','Deel mijn locatie voor een live ETA'))+'</button>' : '')+
      '<button class="bz-groot h-mt100" id="bzBestel"'+(n?'':' disabled')+'>'+T('bz.bestel','Bestel en betaal')+(n?' \u00B7 '+eur(bzTotaal()):'')+'</button></div>';
    const adresIn = document.getElementById('bzAdres');
    if (adresIn) adresIn.addEventListener('input', () => { bzAdresW = adresIn.value; });
    $('#bzTerug').addEventListener('click', () => { bzZaak = null; renderBestellen(); });
    document.querySelectorAll('[data-bzplus]').forEach(b => b.addEventListener('click', () => { bzMand[b.dataset.bzplus]=(bzMand[b.dataset.bzplus]||0)+1; renderBzZaak(); }));
    document.querySelectorAll('[data-bzmin]').forEach(b => b.addEventListener('click', () => { const k=b.dataset.bzmin; if (bzMand[k]) bzMand[k]--; if (!bzMand[k]) delete bzMand[k]; renderBzZaak(); }));
    document.querySelectorAll('[data-bzlev]').forEach(b => b.addEventListener('click', () => { bzLevering = b.dataset.bzlev; renderBzZaak(); }));
    const hier = document.getElementById('bzHier');
    if (hier) hier.addEventListener('click', () => {
      if (!navigator.geolocation) return toast(T('bz.geengps','Dit apparaat deelt geen locatie.'));
      navigator.geolocation.getCurrentPosition(pos => { bzGeo = { lat: pos.coords.latitude, lng: pos.coords.longitude }; renderBzZaak(); },
        () => toast(T('bz.gpsfout','Locatie delen is geweigerd; de ETA blijft dan een schatting.')));
    });
    $('#bzBestel').addEventListener('click', async () => {
      const items = Object.entries(bzMand).map(([id, qty]) => ({ id, qty }));
      if (!items.length) return;
      try {
        const b = await API.call('/bezorg/bestel', { supplierCode: p.code, levering: bzLevering, items,
          adres: bzLevering === 'bezorgen' ? bzAdresW : undefined,
          lat: bzGeo ? bzGeo.lat : undefined, lng: bzGeo ? bzGeo.lng : undefined });
        await API.call('/order/pay', { ref: b.order.ref });
        // niet-leden zien de servicekosten eerlijk terug op de bevestiging
        // het bedrag komt van de server (order.servicekosten), niet uit deze regel:
        // stond het hier ook, dan noemt dit scherm het oude tarief bij een nieuw totaal
        const skV = b.order.servicekosten;
        const sk = skV ? ' ' + T('bz.service','(incl. EUR {bedrag} servicekosten ex btw voor niet-leden)')
          .replace('{bedrag}', String(skV.exBtw).replace('.', ',')) : '';
        toast((bzLevering === 'ophalen' ? T('bz.ok.oph','Betaald. Uw ophaalcode: ') + b.order.pickup : T('bz.ok.bez','Betaald. U volgt de bezorging hierboven live.')) + sk);
        bzZaak = null; bzMand = {};
        renderBestellen(); laadBzMijn();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- ter plaatse: bestellen bij RTG-partners ---------- */
  const ALG_ICON = '<svg viewBox="0 0 64 64" fill="none" stroke="#0C0C0B" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 19 V13 a7 7 0 0 1 7-7 h6"/><path d="M45 6 h6 a7 7 0 0 1 7 7 v6"/><path d="M58 45 v6 a7 7 0 0 1-7 7 h-6"/><path d="M19 58 h-6 a7 7 0 0 1-7-7 v-6"/><circle cx="23.5" cy="26.5" r="2.6" fill="#0C0C0B"/><circle cx="40.5" cy="26.5" r="2.6" fill="#0C0C0B"/><path d="M32 26 v8.5 a2.2 2.2 0 0 1-2.2 2.2"/><path d="M23 42.5 a12.5 8.5 0 0 0 18 0"/></svg>';
  let suppliers = [];
  let myOrders = [];
  let menuState = null; // { supplier, menu, qty:{}, note, tag }

  async function renderTerPlaatse(){
    if (!API.live){
      $('#supplierList').innerHTML = '<div class="empty" style="padding:2rem 1rem;color:var(--soft);text-align:center;font-size:0.85rem;">'+T('app.tp.needserver','Ter plaatse werkt via de RTG-server. Start de app met de backend om te bestellen bij partners.')+'</div>';
      return;
    }
    try {
      /* De stad komt van de EIGEN reis. Stond hier onvoorwaardelijk trip.dest,
         en trip was altijd gevuld -- desnoods met de demo-reis, waardoor elk lid
         "RTG-partners in Ibiza" te zien kreeg. Zonder reis vragen we de hele
         lijst op en zegt de ondertitel dat ook. */
      const stad = trip ? trip.dest : null;
      const [sd, od] = await Promise.all([API.call('/suppliers', stad ? { city: stad } : {}), API.call('/orders/mine')]);
      suppliers = sd.suppliers || [];
      myOrders = od.orders || [];
      const waar = sd.city || stad;
      $('#tpSub').textContent = waar
        ? T('app.tp.partnersin','RTG-partners in') + ' ' + waar + ', ' + T('app.tp.orderpayreserve','bestel, betaal en reserveer.')
        : T('app.tp.partnersall','Alle RTG-partners: bestel, betaal en reserveer. Zodra er een reis staat, ziet u hier de partners op uw bestemming.');
    } catch (e) { return; }

    renderLive();  // live "onderweg"-paneel bovenaan
    renderZorg();  // zorgprofiel + wie er (met toestemming) live meekijkt

    // mijn lopende bestellingen bovenaan
    const active = myOrders.filter(o => o.status !== 'terugbetaald');
    // "De rekening": achteraf-lopende bonnen per zaak, om na het eten in een keer
    // te voldoen (aan-de-balie-bonnen tellen niet mee: die gaan langs de kassa)
    const rekBij = {};
    active.filter(o => !o.paid && o.betaalMoment === 'achteraf' && !o.aanBalie).forEach(o => {
      const r = rekBij[o.supplierCode] = rekBij[o.supplierCode] || { naam: o.supplierName, tafel: '', n: 0, som: 0 };
      r.n++; r.som += o.total || 0; if (o.table && !r.tafel) r.tafel = o.table;
    });
    const rekLijst = Object.entries(rekBij);
    const rekHtml = rekLijst.length
      ? '<div class="sec-label">' + T('app.rek.k','De rekening') + '</div>' + rekLijst.map(([code, r]) =>
          '<div class="rek-card"><div class="rek-top"><div><b>' + r.naam + '</b>' + (r.tafel ? ' · ' + r.tafel : '') +
            '<div class="sub2">' + r.n + ' ' + T('app.rek.bonnen','bon(nen) lopen') + ' · ' + T('app.rek.napm','betaal na het eten') + '</div></div>' +
            '<div class="amt">' + eur(r.som) + '</div></div>' +
          '<button class="rek-pay" data-rekpay="' + code + '">' + T('app.rek.vraag','Vraag de rekening') + '</button></div>').join('')
      : '';
    $('#myOrders').innerHTML = rekHtml + (active.length
      ? '<div class="sec-label">'+T('app.tp.myorders','Mijn bestellingen')+'</div>' + active.map(o => {
          const pc = o.status === 'nieuw' ? 'nieuw' : o.status === 'in bereiding' ? 'bereiding' : 'klaar';
          return '<div class="myorder" data-ref="' + o.ref + '">' +
            '<div class="r1"><div><div class="nm">' + o.supplierName + '</div><div class="sub2">' + o.items.reduce((n,i)=>n+i.qty,0) + ' ' + T('app.items','item(s)') + ' · ' + timeAgo(o.at) + '</div></div>' +
              '<div style="text-align:right;"><div class="amt">' + eur(o.total) + '</div><span class="mo-pill ' + pc + '">' + tStatus(o.status) + '</span></div></div>' +
            (o.regieKorting ? '<div class="sub2" style="text-align:right;color:var(--gold);">✦ ' + T('app.ledenvoordeel','RTG-ledenvoordeel') + ' − ' + eur(o.regieKorting) + '</div>' : '') +
            '<div class="acts">' + (o.paid
              ? '<span class="mo-paid">✓ '+T('app.paid','Betaald')+'</span>'
              : '<button class="mo-pay js-opay">' + FID_MINI + T('app.paywithfid','Betaal met Face ID') + '</button>') +
              (o.pickup ? '<button class="mo-code js-ocode">' + T('app.showcode','Toon ophaalcode') + '</button>' : '') +
              (['nieuw','wacht-op-betaling'].includes(o.status) ? '<button class="mo-code js-oann">✕ ' + T('erv.annuleer','Annuleer') + '</button>' : '') +
              (o.paid && !o.splitst ? '<button class="mo-code js-osplit">' + T('erv.splits','Splits') + '</button>' : '') +
              (['geserveerd','bezorgd','opgehaald'].includes(o.status) ? '<button class="mo-code js-orev">' + T('erv.review','Beoordeel') + '</button>' : '') +
              (o.tagSalon ? '<span style="font-size:0.68rem;color:var(--burgundy);margin-left:auto;">✦ '+T('app.taggedsalon','getagd voor Salon')+'</span>' : '') +
            '</div></div>';
        }).join('')
      : '');
    $('#myOrders').querySelectorAll('[data-rekpay]').forEach(b => b.addEventListener('click', () => vraagRekening(b.dataset.rekpay)));
/* mijn bestellingen: betalen en volgen */
    $('#myOrders').querySelectorAll('.myorder').forEach(el => {
      const o = active.find(x => x.ref === el.dataset.ref);
      const pb = el.querySelector('.js-opay');
      if (pb) pb.addEventListener('click', () => payOrder(o));
      const cb = el.querySelector('.js-ocode');
      if (cb) cb.addEventListener('click', () => showGlow(o));
      const ab = el.querySelector('.js-oann');
      if (ab) ab.addEventListener('click', async () => {
        try {
          const d = await API.call('/annuleer', { soort: 'order', ref: o.ref });
          toast(d.terugbetaald ? T('erv.retour','U ontvangt') + ' ' + eur(d.terugbetaald) + ' ' + T('erv.terug','retour.') : T('erv.geannuleerd','Geannuleerd.'));
          renderTerPlaatse();
        } catch(e){ toast(e.message); }
      });
      const rb = el.querySelector('.js-orev');
      if (rb) rb.addEventListener('click', () => reviewUI(el, o));
      const sb = el.querySelector('.js-osplit');
      if (sb) sb.addEventListener('click', () => splitsUI(el, o));
    });

    // partners: op afstand tonen en sorteren wanneer we de locatie weten
    const mijnPlek = window.Geo ? Geo.laatste() : null;
    const supRij = suppliers.map(s => ({ s, km: mijnPlek && s.loc ? Geo.afstandKm(mijnPlek, s.loc) : null }));
    if (mijnPlek) supRij.sort((a,b) => (a.km==null?1e9:a.km) - (b.km==null?1e9:b.km));
    $('#supplierList').innerHTML = '<div class="sec-label">'+T('app.tp.partnersdest','Partners op uw bestemming')+'</div>' + supRij.map(({s, km}) => {
      const rooms = (s.rooms || []).length, photos = (s.photos || []).length;
      const zzp = (s.services || []).length > 0;
      const viewable = s.hasMenu || rooms || photos;
      const afst = km!=null ? ' · ' + Geo.tekst(km) : '';
      const ster = s.rating ? ' · ' + s.rating.score : '';
      const sub = (s.vak ? s.vak : tType(s.typeLabel)) + ster + ' · ' + s.city + (rooms ? ' · ' + rooms + ' ' + T('app.roomsfree','kamer(s) vrij') : '') + afst;
      return '<div class="sup-card">' +
        '<span class="ic">' + (s.icon || RTGGlyf.svgHTML('gps')) + '</span>' +
        '<div class="t"><b>' + s.name + '</b><span>' + sub + '</span></div>' +
        '<button class="chatb js-fav" data-fav="' + s.code + '" aria-label="' + T('fav.aria','Favoriet') + '">' + RTGGlyf.svgHTML('hart', s.favoriet ? { fill: true } : {}) + '</button>' +
        '<button class="chatb" data-chat="' + s.code + '" aria-label="Chat">' + RTGGlyf.svgHTML('berichten') + '</button>' +
        (zzp
          ? '<button class="go" data-boek="' + s.code + '">'+T('app.tp.boek','Boek')+'</button>'
          : viewable
          ? '<button class="go" data-menu="' + s.code + '">'+(s.hasMenu ? T('app.tp.viewmenu','Bekijk kaart') : T('app.tp.view','Bekijk'))+'</button>'
          : '<button class="go ghost" data-loc="' + s.code + '">'+T('app.tp.location','Locatie')+'</button>') +
      '</div>';
    }).join('');
    $('#supplierList').querySelectorAll('[data-chat]').forEach(b => b.addEventListener('click', () => openPChat(b.dataset.chat)));
    $('#supplierList').querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', () => openMenu(b.dataset.menu)));
    $('#supplierList').querySelectorAll('[data-boek]').forEach(b => b.addEventListener('click', () => openBoekSheet(b.dataset.boek)));
    $('#supplierList').querySelectorAll('.js-fav').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/favoriet', { supplierCode: b.dataset.fav });
        b.innerHTML = RTGGlyf.svgHTML('hart', d.favoriet ? { fill: true } : {});
        toast(d.favoriet ? T('fav.on','Bewaard bij mijn adressen.') : T('fav.off','Uit mijn adressen gehaald.'));
      } catch(e){ toast(e.message); }
    }));
    // eenmalig de locatie ophalen zodat partners op afstand worden getoond en gesorteerd
    /* `Geo.mag()` erbij: staat de locatieschakelaar uit, dan geeft Geo.positie()
       meteen null, en zonder deze toets zou de grendel hieronder wel gezet zijn.
       Wie de schakelaar daarna aanzet, kreeg dan de rest van de sessie nog steeds
       geen afstanden te zien. Nu grendelen we alleen als we het echt gevraagd hebben. */
    if (window.Geo && Geo.mag() && !mijnPlek && !renderTerPlaatse._gps){ renderTerPlaatse._gps = true; Geo.positie().then(p => { if (p) renderTerPlaatse(); }); }
    renderAfspraken();
  }

  // review: de actie-rij wordt vijf sterren; een tik plaatst de beoordeling
  function reviewUI(el, o){
    const acts = el.querySelector('.acts');
    acts.innerHTML = '<span style="font-size:0.72rem;color:var(--soft);align-self:center;">' + T('erv.hoewas','Hoe was het?') + '</span>' +
      [1,2,3,4,5].map(n => '<button class="mo-code js-star" data-n="' + n + '" aria-label="' + n + ' ' + T('erv.sterren','sterren') + '">' + RTGGlyf.svgHTML('ster', { fill: true }) + n + '</button>').join('');
    acts.querySelectorAll('.js-star').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/review', { soort: 'order', ref: o.ref, score: Number(b.dataset.n) });
        toast('' + T('erv.bedanktreview','Dank voor uw beoordeling.'));
        renderTerPlaatse();
      } catch(e){ toast(e.message); renderTerPlaatse(); }
    }));
  }

  // splitsen: kies verbonden vrienden; ieder krijgt een betaalverzoek voor een gelijk deel
  async function splitsUI(el, o){
    let cons = [];
    try { cons = (await API.call('/member/connections')).connections || []; } catch(e){}
    if (!cons.length){ toast(T('erv.geenvrienden','Voeg eerst vrienden toe via de Salon om te kunnen splitsen.')); return; }
    const acts = el.querySelector('.acts');
    acts.innerHTML = '<div style="width:100%;">' +
      '<div style="font-size:0.72rem;color:var(--soft);margin-bottom:0.25rem;">' + T('erv.splitsmet','Splits gelijk met:') + '</div>' +
      cons.slice(0,8).map(c => '<label style="display:inline-flex;align-items:center;gap:0.3rem;margin:0 0.5rem 0.5rem 0;font-size:0.78rem;"><input type="checkbox" class="js-splid" value="' + c.key + '"> ' + c.codename + '</label>').join('') +
      '<button class="mo-pay js-splgo" style="width:100%;margin-top:0.25rem;">' + T('erv.stuurverzoek','Stuur betaalverzoeken') + '</button></div>';
    acts.querySelector('.js-splgo').addEventListener('click', async () => {
      const metKeys = [...acts.querySelectorAll('.js-splid:checked')].map(x => x.value);
      if (!metKeys.length){ toast(T('erv.kiesvriend','Kies minstens een vriend.')); return; }
      try {
        const d = await API.call('/splits', { ref: o.ref, metKeys });
        toast('' + T('erv.verzoekweg','Betaalverzoeken verstuurd:') + ' ' + eur(d.splits.delen[0].bedrag) + ' ' + T('erv.pp','p.p.'));
        renderTerPlaatse();
      } catch(e){ toast(e.message); }
    });
  }

  // mijn afspraken bij zelfstandigen: status volgen en achteraf betalen
  async function renderAfspraken(){
    const wrap = $('#afsprakenList');
    if (!wrap) return;
    let bs = [];
    try { bs = (await API.call('/bookings/mine')).boekingen || []; } catch(e){}
    const actief = bs.filter(b => b.status !== 'afgerond' && b.status !== 'geweigerd').slice(0, 6);
    const BST = {
      'wacht-op-betaling': [T('boek.st.wacht','wacht op betaling'), 'var(--amber, #C99A2E)'],
      'aangevraagd': [T('boek.st.aan','aangevraagd'), 'var(--soft)'],
      'bevestigd': [T('boek.st.ok','bevestigd'), 'var(--green, #4C9A75)']
    };
    wrap.innerHTML = actief.length ? '<div class="sec-label">'+T('boek.mijn','Mijn afspraken')+'</div>' + actief.map(b => {
      const st = BST[b.status] || [b.status, 'var(--soft)'];
      return '<div class="myorder">' +
        '<div class="r1"><div><div class="nm">' + b.supplierName + '</div><div class="sub2">' + b.service.name + (b.wanneer ? ' · ' + b.wanneer : '') + '</div></div>' +
        '<div style="text-align:right;"><div class="amt">' + eur(b.price) + '</div><span style="font-size:0.62rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:' + st[1] + ';">' + st[0] + '</span></div></div>' +
        (!b.paid ? '<div class="acts"><button class="mo-pay js-bpay" data-bref="' + b.ref + '" data-bamt="' + b.price + '">' + FID_MINI + T('app.paywithfid','Betaal met Face ID') + '</button></div>' : '') +
      '</div>';
    }).join('') : '';
    wrap.querySelectorAll('.js-bpay').forEach(k => k.addEventListener('click', () => {
      payWithFaceId(eur(Number(k.dataset.bamt)), async () => {
        await API.call('/booking/pay', { ref: k.dataset.bref });
      }, { message: () => T('boek.betaald','Geboekt en betaald; u hoort het zodra het bevestigd is.'), after: () => renderTerPlaatse() });
    }));
    $('#supplierList').querySelectorAll('[data-loc]').forEach(b => b.addEventListener('click', () => {
      const s = suppliers.find(x => x.code === b.dataset.loc);
      toast(s.name + ', ' + (s.loc && s.loc.label ? s.loc.label : T('app.tp.locwhenenroute','locatie gedeeld zodra u onderweg bent')) + '.');
    }));
  }

  /* ---------- zelfstandigen boeken: diensten en producten met datum en tijd ---------- */
  let boekKeuze = null;
  function openBoekSheet(code){
    const s = suppliers.find(x => x.code === code);
    if (!s || !(s.services || []).length) return;
    boekKeuze = null;
    $('#boekSup').textContent = s.name;
    const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
/* het boekingsblad: de diensten van een partner kiezen */
    $('#boekBody').innerHTML =
      (s.vak ? '<div style="font-size:0.72rem;color:var(--rtg-leesgoud,var(--gold));letter-spacing:0.1em;text-transform:uppercase;margin-bottom:0.6rem;">' + s.vak + ' · ' + s.city + '</div>' : '') +
      s.services.map(x =>
        '<div class="rowitem js-svc" data-svc="' + x.id + '" style="cursor:pointer;border:1px solid var(--line);border-radius:0;padding:0.75rem 0.9rem;margin-bottom:0.55rem;">' +
        '<div class="t"><b>' + (x.soort === 'product' ? '' : '') + x.name + '</b><span>' + (x.desc || '') + (x.duurMin ? ' · ' + x.duurMin + ' min' : '') + '</span></div>' +
        '<span class="amount">' + eur(x.price) + '</span></div>').join('') +
      '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;">' +
      '<input id="boekDatum" type="date" value="' + morgen + '" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem;color:var(--txt);font-family:inherit;color-scheme:dark;">' +
      '<input id="boekTijd" type="time" value="14:00" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem;color:var(--txt);font-family:inherit;color-scheme:dark;"></div>' +
      '<div class="h-mt50" id="boekSlots"></div>' +
      '<input id="boekNote" placeholder="' + T('boek.noteph','Bijv. maat, locatie of blessure') + '" style="width:100%;margin-top:0.5rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.82rem;">' +
      '<div style="font-size:0.66rem;color:var(--soft);margin:0.5rem 0 0;">' + T('boek.los','U boekt rechtstreeks bij deze professional: een losse overeenkomst, en uw betaling gaat rechtstreeks naar de professional.') + '</div>' +
      '<button id="boekGo" class="btn-pay" style="width:100%;margin-top:0.75rem;justify-content:center;">' + FID + T('boek.go','Boek en betaal') + '</button>';
    $('#boek-sheet').classList.add('open');
    $('#boek-scrim').classList.add('open');
    // de vrije tijdvakken van de professional ophalen en als chips tonen
    async function laadSlots(){
      const box = $('#boekSlots'); if (!box) return;
      if (!boekKeuze){ box.innerHTML = ''; return; }
      box.innerHTML = '<div style="font-size:0.7rem;color:var(--soft);">' + T('boek.slotsladen','Vrije tijden laden...') + '</div>';
      let d;
      try { d = await API.call('/booking/slots', { supplierCode: code, serviceId: boekKeuze, date: $('#boekDatum').value }); }
      catch(e){ box.innerHTML = ''; return; }
      if (!d.tijden || !d.tijden.length){
        box.innerHTML = '<div style="font-size:0.7rem;color:var(--soft);">' + T('boek.geenslots','Geen vrije tijden op deze dag; kies een andere datum of typ een tijd.') + '</div>';
        return;
      }
      box.innerHTML = '<div style="font-size:0.66rem;color:var(--soft);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.25rem;">' + T('boek.vrijetijden','Vrije tijden') + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">' + d.tijden.map(t =>
          '<button class="js-slot" data-t="' + t + '" style="background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.35rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.8rem;cursor:pointer;">' + t + '</button>').join('') + '</div>';
      box.querySelectorAll('.js-slot').forEach(b => b.addEventListener('click', () => {
        $('#boekTijd').value = b.dataset.t;
        box.querySelectorAll('.js-slot').forEach(x => { x.style.borderColor = 'var(--line)'; x.style.color = 'var(--txt)'; });
        b.style.borderColor = 'var(--gold)'; b.style.color = 'var(--gold)';
      }));
    }
    $('#boekBody').querySelectorAll('.js-svc').forEach(el => el.addEventListener('click', () => {
      boekKeuze = el.dataset.svc;
      $('#boekBody').querySelectorAll('.js-svc').forEach(x => x.style.borderColor = x.dataset.svc === boekKeuze ? 'var(--gold)' : 'var(--line)');
      laadSlots();
    }));
    $('#boekDatum').addEventListener('change', laadSlots);
    $('#boekGo').addEventListener('click', async () => {
      if (!boekKeuze){ toast(T('boek.kies','Kies eerst een dienst of product.')); return; }
      let d;
      try {
        d = await API.call('/booking/request', { supplierCode: code, serviceId: boekKeuze,
          date: $('#boekDatum').value, time: $('#boekTijd').value, note: $('#boekNote').value.trim() });
      } catch(e){ toast(e.message); return; }
      $('#boek-sheet').classList.remove('open');
      $('#boek-scrim').classList.remove('open');
      if (d.boeking.status === 'wacht-op-betaling'){
        payWithFaceId(eur(d.boeking.price), async () => {
          await API.call('/booking/pay', { ref: d.boeking.ref });
          return d.boeking;
        }, { message: () => T('boek.betaald','Geboekt en betaald; u hoort het zodra het bevestigd is.'), after: () => renderTerPlaatse() });
      } else {
        toast('' + T('boek.ok','Aanvraag verstuurd; betalen kan achteraf.'));
        renderTerPlaatse();
      }
    });
  }
  $('#boekClose').addEventListener('click', () => { $('#boek-sheet').classList.remove('open'); $('#boek-scrim').classList.remove('open'); });
  $('#boek-scrim').addEventListener('click', () => { $('#boek-sheet').classList.remove('open'); $('#boek-scrim').classList.remove('open'); });


  /* "De rekening" (betalen na het eten): haal de lopende achteraf-bonnen bij de
     zaak op, toon ze als een itemgewijze rekening met een fooikeuze, en reken
     alles in een keer af met Face ID. Dezelfde /api/rekening-route bedient ook
     Rahul, zodat "rekenen af" via de AI langs precies dit pad loopt.
     Losse part (5-10 KB-discipline), afgesplitst van 20-navigatie-genres-10.js. */
  function vraagRekening(code){
/* de lopende rekening bij een partner opvragen */
    API.call('/rekening', { supplierCode: code }).then(d => {
      const r = d.rekening;
      if (!r || !r.aantal) return toast(T('app.rek.leeg','Er staat geen lopende rekening open.'));
      const oud = document.getElementById('rekOverlay'); if (oud) oud.remove();
      const ov = document.createElement('div'); ov.className = 'rek-ov'; ov.id = 'rekOverlay';
      const regels = r.regels.map(o => (o.items || []).map(it =>
        '<div class="rek-reg"><span><span class="q">' + it.qty + '× </span>' + esc(it.name) + '</span><span>' + eur(it.price * it.qty) + '</span></div>').join('')).join('');
      ov.innerHTML = '<div class="rek-sheet" role="dialog" aria-modal="true" aria-label="' + T('app.rek.k','De rekening') + '">' +
        '<h3>' + T('app.rek.k','De rekening') + '</h3>' +
        '<div class="sub2" style="color:var(--soft);margin-bottom:0.5rem;">' + esc(r.supplierName) + (r.tafel ? ' · ' + esc(r.tafel) : '') + ' · ' + r.aantal + ' ' + T('app.rek.bonnen','bon(nen) lopen') + '</div>' +
        regels +
        '<div class="rek-sub"><span>' + T('app.rek.totaal','Totaal') + '</span><span>' + eur(r.subtotaal) + '</span></div>' +
        '<select class="rek-fooi" id="rekFooi" aria-label="' + T('erv.fooi','Fooi') + '">' +
          '<option value="0">' + T('erv.fooi.geen','Geen fooi') + '</option>' +
          '<option value="p5">' + T('erv.fooi.team','Fooi voor het team') + ': 5%</option>' +
          '<option value="p10">' + T('erv.fooi.team','Fooi voor het team') + ': 10%</option>' +
          '<option value="e5">' + T('erv.fooi.team','Fooi voor het team') + ': € 5</option>' +
          '<option value="e10">' + T('erv.fooi.team','Fooi voor het team') + ': € 10</option>' +
        '</select>' +
        '<div style="font-size:0.66rem;color:var(--soft);margin:0.5rem 0;">' + T('app.rek.uitleg','U rekent alle bonnen van dit bezoek in een keer af. De betaling gaat rechtstreeks naar de zaak.') + '</div>' +
        '<button class="rek-pay" id="rekBetaal">' + T('app.rek.betaal','Betaal de rekening') + '</button>' +
        '<button id="rekSluit" style="margin-top:0.5rem;width:100%;background:none;border:none;text-align:center;color:var(--soft);cursor:pointer;font-family:inherit;font-size:0.8rem;padding:0.5rem;">' + T('app.later','Later') + '</button>' +
      '</div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
      document.getElementById('rekSluit').addEventListener('click', () => ov.remove());
      document.getElementById('rekBetaal').addEventListener('click', () => {
        const keus = document.getElementById('rekFooi').value;
        const fooi = keus === 'p5' ? Math.round(r.subtotaal * 5) / 100 : keus === 'p10' ? Math.round(r.subtotaal * 10) / 100 : keus === 'e5' ? 5 : keus === 'e10' ? 10 : 0;
        ov.remove();
        payWithFaceId(eur(r.subtotaal + fooi), async () => {
          const res = await API.call('/rekening/betaal', { supplierCode: code, fooi });
          return res.rekening;
        }, { message: () => '' + T('app.rek.voldaan','De rekening is voldaan bij') + ' ' + r.supplierName + '.' + (fooi ? '  ' + eur(fooi) + ' ' + T('erv.fooivoorteam','fooi voor het team.') : ''), after: () => renderTerPlaatse() });
      });
    }).catch(e => toast(e.message));
  }
/* ============================== RTG OS-schil ==============================
   De leden-app als besturingssysteem. Het beginscherm is één scherm met vier
   lagen, van boven naar beneden:

     1. de mappen met apps
     2. de ronde RTG-klok, in het midden
     3. de functierij: bellen, berichten, videobellen, je wallet
     4. de balk van Rahul

   Verder is er een bedieningspaneel (thema, taal, push, helderheid,
   uitloggen), Spotlight-zoeken en herschikken met een lange druk
   (wiebel-modus, volgorde in localStorage). Geen tweede beginscherm, geen
   dock, geen App Store: alles waar je pas je recht op geeft staat er al, en
   in de Boardroom zet je uit wat je niet wilt zien.

   De (verborgen) tabbar blijft het model: alle bestaande logica schakelt daar
   tabs, zichtbaarheid (gast-modus, Assets, Gezin) en badges. Deze laag
   SPIEGELT dat model; kliks op tab-iconen lopen terug het model in
   (button.click()), dus er is een navigatiepad en geen drift. */
(() => {
  const $ = s => document.querySelector(s);
  const tabbar = $('#tabbar'), app = $('#app'), content = $('#content');
  // rij 0 = de mappen boven de klok, rij 1 = de functies eronder
  const rijen = [$('#osMappen'), $('#osFuncties')];
  if (!tabbar || !app || !rijen[0] || !rijen[1]) return;

  const pas = new URLSearchParams(location.search).get('pas') || 'rtg';

  /* ---------- de indeling: tab-apps, link-apps en mappen ----------
     Link-apps zijn losse leden-pagina's die als eigen app openen. */
  // Elke app kent zijn eigen huisstijl-glyf (shared/glyf.js) op naam van de
  // sleutel; de tegel tekent die als dunne lijn-icoon (geen emoji meer).
  const LINKS = {
    ontdek:      { naam: 'Ontdekken',     url: '/apps/rtg.html' },
    /* De cockpit van LivingOS (WERELDEN.md). Het bestand heet nog living-os,
       want een bestandsnaam is geen merknaam; de APP heette dat ook, en dat
       botste vier regels ver in de bank met de WERELD LivingOS. */
    vooruitzicht:{ naam: 'Het Vooruitzicht', url: '/apps/living-os.html' },
    /* De STICHTING, en niet het gezin eromheen. Onder /apps/foundation/ staan
       71 schermen; negen daarvan gaan over RTFoundation als organisatie en de
       rest over het leven van een kind (WERELDEN.md). Deze twee zijn de deuren
       naar die negen: het portaal (donateur, vrijwilliger, deelnemer) en de
       publieke kant. Foundation OS zelf (os.html) staat er niet bij: dat vraagt
       een kantoortoken en is geen deur voor een lid. */
    rtfportaal:  { naam: 'RTFoundation portaal', url: '/apps/foundation/os-portaal.html' },
    /* DE TWAALF UIT DE SOFTWARE-RIJ, en dit blok is de reden dat die rij weg is.
       De bank had onder de werelden een tweede kopje, Software, met twaalf apps
       die in geen enkele wereld hingen. Dat is precies de vraag die WERELDEN.md
       wil afschaffen: 'staat dit in een wereld of in de lijst ernaast?' Een app
       hoort in de context waarin een mens hem gebruikt, en anders nergens.
       Negen kregen hier een sleutel; Reizen & Veilig, Gastdossier en Het
       Vooruitzicht hingen al ergens. shared/command/catalog.js houdt zijn lijst
       -- die is Rahuls routeertabel en de bron van werkbladtitels -- maar tekent
       geen bank-sectie meer. test/wereldregister.test.js bewaakt dat elke app
       uit die catalogus ook echt in een wereld hangt. */
    vandaag:     { naam: 'Vandaag',        url: '/apps/vandaag.html' },
    leven:       { naam: 'Mijn leven',     url: '/apps/leven.html' },
    sociaal:     { naam: 'Sociaal',        url: '/apps/sociaal.html' },
    /* De WERELDLAAG (README: server/kern/wereld/) -- een LEESLAAG over vijf
       contexten met een schakelaar Alles / Lifestyle / Business / Communities /
       Prive. Hij bezit die domeinen niet en plaatsen loopt er nooit langs; wie
       in Lifestyle plaatst, plaatst in De Salon.

       Hij stond hier niet, en niets in het huis linkte ernaar: een scherm van
       23 KB dat gebouwd, gedocumenteerd en onbereikbaar was (gevonden met
       scripts/lib/bereik.js op 19 augustus 2026). Hij hangt in LivingOS en niet
       in een van de vijf werelden die hij toont, want de contextvraag van
       WERELDEN.md gaat over de MENS: wie zijn eigen tijdlijn leest, is bezig
       met zijn dagelijks leven. */
    wereldlaag:  { naam: 'Alles bij elkaar', url: '/apps/wereld.html' },
    geldcommand: { naam: 'Geld',           url: '/apps/geld-command.html' },
    commerce:    { naam: 'Commerce',       url: '/apps/commerce.html' },
    /* HIER STONDEN INSTANTREALITY EN PRIVATEOFFICE, en die zijn 19 augustus 2026
       samengevoegd met de sleutel ernaast (WERELDEN.md, "de twee dubbele
       paren"). Instant Reality en Het Vooruitzicht (link:vooruitzicht) beloofden
       allebei een intentie in drie werelden met twee beslissingen; Private
       Office en het Privekantoor (link:rechterhand) allebei een directietafel.
       Vier ingangen naar twee dingen. Wie de oude sleutel nog gebruikt, komt
       niets tegen: een onbekende sleutel levert geen tegel op, en beide adressen
       bestaan niet meer. */
    horeca:      { naam: 'Horeca',         url: '/apps/horeca.html' },
    partnernetwerk:{ naam: 'Partner Network', url: '/apps/partner-network.html' },
    rtfbuurt:    { naam: 'RTFoundation in jouw buurt', url: '/apps/foundation/os-publiek.html' },
    klimaat:     { naam: 'Klimaatfonds', url: '/apps/foundation/klimaatfonds.html' },
    buurtruil:   { naam: 'Buurtruil', url: '/apps/foundation/buurtruil.html' },
    geven:       { naam: 'Geven', url: '/apps/foundation/geven.html' },
    rtfwinkel:   { naam: 'Winkel van de RTFoundation', url: '/apps/foundation/winkel.html' },
    spelen:      { naam: 'Spelen',       url: '/apps/spelen.html?pas=' + encodeURIComponent(pas) },
    vrienden:    { naam: 'Vrienden',     url: '/apps/foundation/vrienden.html' },
    juridisch:   { naam: 'Juridisch',    url: '/apps/juridisch.html' },
    camera:      { naam: 'Camera',       url: '/apps/camera.html' },
    muziek:      { naam: 'Muziek',    url: '/apps/muziek.html' },
    podium:      { naam: 'Live',       url: '/apps/podium.html' },
    flits:       { naam: 'Verkeer',           url: '/apps/flits.html' },
    navigatie:   { naam: 'Navigatie',    url: '/apps/navigatie.html' },
    theater:     { naam: 'Films en series',      url: '/apps/theater.html' },
    residentie:  { naam: 'Verblijven', url: '/apps/residentie.html' },
    wbw:         { naam: 'Samen betalen', url: '/apps/geld.html#wbw' },
    passkeys:    { naam: 'Passkeys',     url: '/apps/passkeys.html' },
    sessies:     { naam: 'Waar ben ik aanwezig', url: '/apps/mijn-sessies.html' },
    relaties:    { naam: 'Wie heeft toegang tot mij', url: '/apps/mijn-relaties.html' },
    gegevens:    { naam: 'Wat weet RTG van mij', url: '/apps/mijn-gegevens.html' },
    post:        { naam: 'Post van RTG', url: '/apps/mijn-post.html' },
  /* Afgesplitst van app-main-23.js, dat met dit blok over de 10 KB ging
     (keuringsregel 13). De snede loopt midden door LINKS -- dat mag hier, want
     de bundel plakt de delen rauw aan elkaar (scripts/bundel.js) en 24a2/24a2b
     doen precies hetzelfde met MAPPEN. De naad ligt op een echte grens: hierbo-
     ven staat wat er altijd al hing, hieronder wat de tikkenmeting vond. */
    /* ---------- VEERTIEN SCHERMEN DIE NERGENS AAN HINGEN ----------
       Gevonden met scripts/tikken.js op 30 augustus 2026: die meter loopt het
       huis af vanaf het beginscherm op telefoonformaat en vraagt per scherm
       hoeveel tikken het kost. Tweeenvijftig schermen bleken vanaf het
       beginscherm HELEMAAL niet te bereiken -- niet diep, maar los.

       Van die tweeenvijftig zijn dit de schermen van een LID. De rest is met
       reden onbereikbaar en staat als zodanig genoemd in scripts/tikken.js:
       schermen van een rol (de kantoren, de PDA's, de leverancierskant) komen
       niet op een beginscherm van een lid, en vier adressen zijn een stand van
       een andere app geworden (Metier, Codewoord, Thuisrust, Thuiswacht) en
       horen dus juist NIET opnieuw als tegel te bestaan.

       Ze krijgen hier een sleutel en hangen hieronder in de wereld waar de mens
       denkt te zijn als hij ze gebruikt (WERELDEN.md), niet in de wereld van
       wie ze gebouwd heeft.

       TWEE STAAN ER NIET BIJ, en dat is geen vergeten maar een bestaand besluit:
       /apps/gast.html en /apps/festival-gast.html zijn LANDINGSPAGINA'S. Je komt
       daar door een code op een tafel te scannen of via de link van je groep, en
       scripts/lib/bereik.js zegt dat met zoveel woorden (MAG_LOS). Ze alsnog in
       een wereld hangen zou een deur maken naar een tafel waar u niet zit. */
    mall:        { naam: 'Mall',          url: '/apps/mall.html' },
    mijnmall:    { naam: 'Mijn bestellingen', url: '/apps/mijnmall.html' },
    pay:         { naam: 'Betalen',       url: '/apps/pay.html' },
    huis:        { naam: 'Thuis',         url: '/apps/thuis.html' },
    uitgaan:     { naam: 'Uitgaan',       url: '/apps/uitgaan.html' },
    foodcourt:   { naam: 'Food Court',    url: '/apps/foodcourt.html' },
    spelavond:   { naam: 'Game Night',    url: '/apps/spelscherm.html' },
    tweedescherm:{ naam: 'Tweede scherm', url: '/apps/scherm.html' },
    /* Het inkoopdossier staat bij het LID en niet achter een kantoorpoort
       (APPSTORE.md). Dat het nergens aan hing, maakte die belofte leeg. */
    appdossier:  { naam: 'App-dossier',   url: '/apps/appstore-dossier.html' },
    aankomst:    { naam: 'Aankomst',      url: '/apps/arrival.html' },
    routedossier:{ naam: 'Routedossier',  url: '/apps/routedossier.html' },
    ovroutes:    { naam: 'OV-routes',     url: '/apps/ovroutes.html' },
    rtfbord:     { naam: 'Het bord',      url: '/apps/foundation/bord.html' },
    rtfschrift:  { naam: 'Het schrift',   url: '/apps/foundation/schrift.html' },
    /* Veiligheid en verbinding. Hier stonden VIER tegels -- Thuiswacht,
       Codewoord, Vitaal en Thuisrust -- op een gedeelde kern. Ze zijn nu vier
       standen van een app (/apps/veilig.html), want een systeem dat een systeem
       is, hoort niet als vier losse deuren op een beginscherm te staan: wie de
       Thuiswacht kende, had het Codewoord daardoor vaak nooit gezien. De oude
       paden leiden met een hash naar hun eigen stand, dus een bladwijzer of een
       geinstalleerde PWA komt nog steeds uit waar hij hoort. */
    ik:          { naam: 'Wie ben ik',   url: '/apps/ik.html' },
    veilig:      { naam: 'RTG Veilig',   url: '/apps/veilig.html' },
    ov:          { naam: 'Openbaar vervoer',           url: '/apps/ov.html' },
    stad:        { naam: 'Stad',    url: '/apps/stad.html' },
    clips:       { naam: 'Video',        url: '/apps/clips.html' },
    /* RTG Media staat NAAST Video, Sound, Theater en Podium en niet in plaats
       daarvan: het is de laag die ze tot een wereld maakt, en wie recht naar de
       studio of de zaal wil, hoort daar gewoon heen te kunnen.

       De NAMEN komen van deze kant en de app van de andere: deze ronde
       hernoemde de tegels naar gewone woorden ("Video" in plaats van "Clips"),
       en een tak die daarvoor aftakte kent die keuze nog niet. */
    mediaos:     { naam: 'RTG Media',    url: '/apps/media.html' },
    office:      { naam: 'Documenten',   url: '/apps/office.html' },
    rtgone:      { naam: 'RTG One',      url: '/apps/rtgone.html' },
    rtmail:      { naam: 'RTMail',       url: '/apps/rtmail.html' },
    magnaat:     { naam: 'Magnaat',      url: '/apps/magnaat.html' },
    /* Hier stond een losse "Werk OS"-tegel naast "Mijn werkplekken": twee
       tegels met hetzelfde koffertje, en erger, twee INLOGS. De ene ging via
       het ene RTG-account, de andere vroeg opnieuw om een werkruimtecode en
       een lid-token. Dat is precies wat "een account voor alles" niet mag
       betekenen. De werkruimte is nu een sleutel aan diezelfde bos, dus er is
       nog een deur: Mijn werkplekken. Wie er voor het eerst in moet, vindt de
       werkruimte-inlog onderaan diezelfde kiezer. */
    /* Het Ondernemers-OS stond hier NIET, en dat was een gat waar de hele
       ondernemersweg in verdween: /apps/onderneming.html bestond, werkte en had
       zelfs een hulptekst in de appgids -- maar hij stond in geen enkele
       registry en in geen enkele map, dus niemand kon hem vinden. Een scherm dat
       nergens vandaan te bereiken is, is geen scherm.

       Eén tegel, niet twee. De concern-laag (CONCERN.md) krijgt geen eigen
       tegel maar hangt achter deze: dat is PLATFORM.md paragraaf 0 -- een
       onderdeel binnen een app, geen tweede adres in de bibliotheek. */
    onderneming: { naam: 'Onderneming', url: '/apps/onderneming.html' },
    sitemaker:   { naam: 'Website', url: '/apps/sitemaker.html' },
    browser:     { naam: 'Web',  url: '/apps/browser.html' },
    vonk:        { naam: 'Daten',         url: '/apps/vonk.html' },
    balans:      { naam: 'Balans',       url: '/apps/geld.html#balans' },
    /* Mijn loon staat bij Geld en niet bij Werk: het is uw geld, niet iets van
       uw werkgever. Wie nergens werkt vindt een lege lijst met de zin die dat
       uitlegt -- dat is beter dan een tegel die verdwijnt zodra u van baan
       wisselt. Prive: dit scherm draagt uw loon en uw inzagespoor. */
    loonstrook:  { naam: 'Loon',    url: '/apps/loonstrook.html' },
    rechterhand: { naam: 'Privekantoor', url: '/apps/lifestyle.html' },
    werkos:      { naam: 'RTG Werk OS', url: '/apps/werk.html' },
    reisboek:    { naam: 'Reisboek',      url: '/apps/reisboek.html' },
    cellier:     { naam: 'Cellier',       url: '/apps/cellier.html' },
    table:       { naam: 'Table',         url: '/apps/table.html' },
    maison:      { naam: 'Maison',        url: '/apps/maison.html' },
    garderobe:   { naam: 'Garde-robe',    url: '/apps/garderobe.html' },
    mecenaat:    { naam: 'Mecenaat',      url: '/apps/geld.html#mecenaat' },
    labfonds:    { naam: 'Fonds',     url: '/apps/geld.html#labfonds' },
    rtgcode:     { naam: 'Betaalcode',      url: '/apps/geld.html#rtgcode' },
    nalatenschap:{ naam: 'Nalatenschap',  url: '/apps/geld.html#nalatenschap' },
    logboek:     { naam: 'Logboek',       url: '/apps/geld.html#logboek' },
    cercle:      { naam: 'Cercle',        url: '/apps/cercle.html' },
    pulse:       { naam: 'Vandaag',         url: '/apps/pulse.html' },
    nieuws:      { naam: 'Nieuws',        url: '/apps/nieuws.html' },
    krant:       { naam: 'Krant',     url: '/apps/krant.html' },
    /* RTG Reizen staat NAAST Vluchten, Verblijven, Reisbureau en Hangar en niet
       in plaats daarvan -- net als RTG Media naast Video, Sound, Theater en
       Podium. Het is de laag die er een wereld van maakt (PLATFORM.md, laag 2);
       wie recht naar het inchecken of de hangar wil, hoort daar gewoon heen te
       kunnen. */
    /* "RTG Reizen" en niet "Reizen": de map draagt al een OS-tab die Reizen
       heet (tab:reizen, het boeken zelf), en twee tegels met dezelfde naam in
       een map is voor een gebruiker een raadsel en voor test/appmenu.e2e.js een
       fout -- die toets bewaakt dat een app in precies EEN map staat en meet dat
       op het label. De bibliotheek noemt hem ook RTG Reizen. */
    reizen:      { naam: 'Reizen & Veilig', url: '/apps/reizen-veilig.html' },
    vluchten:    { naam: 'Vluchten',      url: '/apps/vluchten.html' },
    sport:       { naam: 'Sport',         url: '/apps/sport.html' },
    school:      { naam: 'School',    url: '/apps/rtgschool.html' },
    berichten:   { naam: 'Berichten',     url: '/apps/comm.html' },
    /* EEN app voor alle communicatie (kern/comm + apps/comm.html). Hier
       stonden er vier op het beginscherm -- Berichten, Bellen, Videobellen en
       Snaps -- voor iets dat een mens als EEN ding ziet: contact met iemand.
       Bellen en videobellen zijn nu twee knoppen in de kop van het gesprek
       waar je toch al bent; de oude /apps/berichten.html blijft bestaan als
       pad -- als OMLEIDING, dus deze tegel wijst naar comm.html zelf. */
    hangar:      { naam: 'Hangar',        url: '/apps/hangar.html' },
    entourage:   { naam: 'Entourage',     url: '/apps/entourage.html' },
    attenties:   { naam: 'Attenties',     url: '/apps/attenties.html' },
    rendezvous:  { naam: 'Rendez-vous',   url: '/apps/rendezvous.html' },
    // De wallet draagt je ledenpas; hij staat in de functierij onder de klok.
    wallet:      { naam: 'Wallet',        url: '/apps/geld.html#wallet' },
    /* Bank ONTBRAK, en dat was stil. `link:bank` stond wel in MAPPEN, maar
       zonder deze regel geeft itemDef() undefined, wordt itemZichtbaar() false
       en tekent RTG zich gewoon een tegel kleiner -- zonder fout, zonder lege
       plek. De stand zelf bestond al die tijd (apps/geld/bankc.js, id 'bank').
       test/wereldregister.test.js vangt dit soort gaten nu. */
    bank:        { naam: 'Bank',          url: '/apps/geld.html#bank' }
  };
  /* Elke functie zijn eigen app: Bellen, Videobellen en Snaps zijn eigen
     OS-apps die een kiezer openen en dan meteen doen wat u koos, via de
     sociale laag van de leden-app (WebRTC-bellen, snaps op codenaam).
     RTFoundation is EEN app: een tik toont de leeftijdskeuze en opent dan
     de hub in de passende jas (?groep= zet de bril op). */
  /* WERK STOND ER WEL EN BESTOND ER NIET. `os:werk` staat in RTG Kantoor en
     openOsApp() heeft er een eigen tak voor (openWerkKiezer), maar de wacht
     bovenaan die functie -- `const app = OSAPPS[naam]; if (!app) return;` --
     kwam daarvoor. Zonder deze regel was de werkplekkiezer dus onbereikbaar EN
     was de tegel onzichtbaar: twee gaten die elkaar verborgen. */
  const OSAPPS = {
    werk:        { naam: 'Werk' },
    bellen:      { naam: 'Bellen' },
    videobellen: { naam: 'Videobellen' },
    snaps:       { naam: 'Snaps' },
    rtf:         { naam: 'RTFoundation' }
  };
  const RTF_GROEPEN = [
    { g: 'mini',   naam: 'RTF Mini',      sub: '0 t/m 4 jaar' },
    { g: 'kind',   naam: 'RTF Kids',      sub: '5 t/m 11 jaar' },
    { g: 'tiener', naam: 'RTF Tiener',    sub: '12 t/m 15 jaar' },
    { g: 'jong',   naam: 'RTF Jong',      sub: '16 t/m 21+' },
    { g: 'volw',   naam: 'RTF Volwassen', sub: 'ouders en verzorgers' }
  ];
  /* ---------- de functierij, onder de klok ----------
     De vier dingen die je zonder nadenken moet kunnen pakken. Ze staan vast en
     kunnen niet uit.

     Bellen en videobellen stonden hier als eigen app; ze zitten nu in
     Berichten, bij het gesprek -- dat waren vier iconen voor iets dat een mens
     als EEN ding ziet (RTG Communication Core, e67be4d). De vrijgekomen plek
     gaat naar Camera, de andere manier waarop je iets met iemand deelt, zodat
     de rij er vier houdt.

     Ook deze regel is door een merge teruggezet naar de oude vier, samen met
     de rest van het beginscherm; zie de opmerking bij .os-aibalk in
     apps/app.html. test/comm.e2e.js bewaakt hem. */
  /* LEEG, EN DAT IS DE BEDOELING. Het beginscherm toont alleen nog de acht
     werelden: dat is de hele afspraak van PLATFORM.md par. 0, en een rij losse
     apps eronder is precies de uitzondering die de afspraak weer uitholt.

     De vier zijn niet weg, ze staan waar ze horen: Berichten en Camera in
     Sociaal, de Wallet IS de Geld-wereld (geld.html laadt wallet.js), en Snaps
     zit in Berichten sinds de vier contact-apps er een werden. De lijst blijft
     als lege lijst bestaan zodat de rij later opnieuw te vullen is zonder de
     tekenlaag aan te raken -- en zodat hier staat waarom hij leeg is. */
  const FUNCTIES = [];

  /* ---------- de mappen, boven de klok ----------
     Vier mappen, en daar zit alles in waar je pas je recht op geeft. Niets
     installeren: het staat er al. Wil je iets niet zien, dan zet je het uit
     in de Boardroom (die zet het uit, hij hoeft het niet aan te zetten).

     Een map heeft een vaste sleutel (waar je eigen naam onder bewaard wordt),
     een standaardnaam en zijn apps. Apps die voor jouw pas niet bestaan
     vallen er vanzelf uit (itemZichtbaar). */

  /* Afgesplitst van app-main-24.js, dat over de 10 KB ging. De snede loopt
     langs een echte grens: hierboven staat de registry van alle apps en de
     vaste functierij, hieronder de MAPPEN waarin die apps vallen en de vraag
     welke ervan bij welke pas horen. */
  /* ---------- de hoofdwerelden ----------
     VIER MENSELIJKE CONTEXTEN, en dat is het enige criterium. WERELDEN.md stelt
     de vraag waar een onderdeel bij hoort niet als "van wie is dit" maar als:
     in welke context denkt de mens dat hij zich bevindt terwijl hij dit
     gebruikt? Dezelfde persoon opent zijn rooster in WorkOS, bestelt eten in
     LivingOS, vliegt naar Ibiza in TravelOS en doet vrijwilligerswerk in
     FoundationOS. De pas bepaalt wat binnen zo'n huis beschikbaar is, nooit of
     de voordeur er armer uitziet.

     Een wereld hoeft niet even groot te zijn als de andere; dat is geen
     scheefheid maar het verschil tussen een reis en een dagelijks leven. Wat
     wel voor alle vier geldt: een app staat in precies EEN wereld en
     premiumrechten gelden pas op onderdeelniveau.

     EN ER IS GEEN LIJST ERNAAST MEER. De bank had onder de werelden een tweede
     kopje (Software) met twaalf apps die nergens in hingen; die twaalf staan nu
     in de wereld waar ze horen. Wie hier iets niet kwijt kan, heeft niet een
     lijst nodig maar het antwoord op de contextvraag hierboven.

     WAT HIER NIET STAAT is RTG Core: RTG iD, inloggen, de gegevenspoort,
     meldingen, taal, Rahul, betalen. Vierentwintig functies zitten in ELKE
     doelgroep (zie GROEPEN.md) en reizen met de mens mee. Een laag die overal
     geldt is geen tegel op een beginscherm.

     Een map heeft een vaste sleutel (waar je eigen naam onder bewaard wordt),
     een standaardnaam en zijn apps. Apps die voor jouw pas niet bestaan
     vallen er vanzelf uit (itemZichtbaar). Een app staat in precies EEN map:
     twee plekken voor hetzelfde is precies waarom je hem nergens meer vindt. */
  const MAPPEN = [
    /* --- één gecentreerde rij --- */
    /* LIVINGOS EN NIET RTG, EN OOK NIET LIFEOS. Twee besluiten in een naam.
       `rtg` is de naam van de INSTAPPAS, en pas en wereld zijn twee loodrechte
       assen: vielen die woorden samen, dan las een lid een plek als een prijs.
       En `LifeOS` -- de eerste kandidaat -- haalde de toets alleen op een
       technische woordvergelijking: `life` is niet `lifestyle`, terwijl een lid
       wel "Life" ziet staan naast een pas die "Lifestyle" heet. Een regel die je
       op de letter volgt en niet op de bedoeling, is geen regel; de toets kijkt
       nu ook naar de stam. Het huis (/apps/rtg.html) en de glyf houden hun naam:
       een huis is een merk, een wereld is een context. */
    { sleutel: 'map-rtg', naam: 'LivingOS', wereld: '/apps/rtg.html', glyf: 'rtg', items: [
      'link:vooruitzicht', 'link:vandaag', 'link:leven', 'link:sociaal',
      'link:geldcommand', 'link:mediaos',
    /* HET GEZIN KOMT UIT FOUNDATIONOS HIERHEEN, en dat is het eigendomsprincipe
       van WERELDEN.md in de praktijk: de bouwer van een capability bepaalt niet
       in welke wereld hij hoort, de gebruikerscontext doet dat. RTF Mini, Kids,
       Tiener, Jong en Volwassen gaan over babyboek, dromen, gevoel, gezondheid,
       ochtend, rust, opvoeden, school en club -- dat is iemands dagelijks leven
       en geen stichtingswerk. Gemeten: 62 van de 71 schermen onder
       /apps/foundation/ zijn zo. De stichting houdt de andere negen.
       Er verhuist geen bestand: alleen de deur staat nu in de juiste wereld. */
      'os:rtf',
      'tab:betalen', 'link:wallet', 'link:bank', 'link:wbw', 'link:rtgcode',
      'link:balans', 'tab:assets', 'link:labfonds', 'link:mecenaat',
      'link:nalatenschap', 'link:logboek',
    /* De Salon is weer De Salon: mensen en wat je met ze deelt. Wat je in je
       eentje kijkt of luistert staat bij Media. */
      'tab:salon', 'link:wereldlaag', 'link:pulse', 'link:vrienden', 'os:snaps', 'link:camera',
    /* CONTACT MET IEMAND HOORT HIER, en het stond nergens: deze drie bestonden
       in LINKS/OSAPPS maar werden door geen enkele map genoemd, en dat bleef
       stil omdat scripts/wereldlijst.js alleen tabs op dakloosheid controleerde
       (die kijkt nu naar alle drie de soorten). Wie belt denkt niet dat hij in
       zijn werk of op reis is; en niet Core, want dat is een laag die meereist
       en een gesprek is een handeling. */
      'link:berichten', 'os:bellen', 'os:videobellen',
      'link:vonk', 'link:cercle', 'link:entourage', 'link:rendezvous', 'link:attenties',
    /* Het Huis is het huishouden in de brede zin: waar je woont, wat er op
       tafel komt, wat er in de kast hangt -- en hoe het met de mensen erin
       gaat. Die laatste helft (zorg, gezin, vitaal, rust) stond even in een
       eigen map Zorg; die is hier terug, want zonder haar was Het Huis op een
       RTG-pas een map met drie tegels. De kantoorkant zit bij Werk. */
    /* os:rtf stond hier, en staat nu in zijn eigen wereld hieronder. Regel 44
       in scripts/check.js ving dat meteen: een app in twee werelden is precies
       waarom je hem nergens meer vindt. */
      'link:ontdek', 'link:commerce', 'tab:bestellen', 'tab:zorg', 'tab:gezin',
      'link:rechterhand',
      'link:maison', 'link:table', 'link:cellier', 'link:garderobe',

      'link:muziek', 'link:podium', 'link:theater', 'link:clips', 'link:spelen',
      'link:nieuws', 'link:krant', 'link:sport',
    /* NEGEN UIT DE TIKKENMETING. Kopen, betalen, thuis, uitgaan, eten, samen
       kijken en spelen -- allemaal een gewone dag, en allemaal hingen ze
       nergens aan (scripts/tikken.js, 30 augustus 2026). Het app-dossier hoort
       hier ook: APPSTORE.md zet het bij het lid en niet in een kantoor, en een
       dossier dat nergens aan hangt is die belofte op papier. */
      'link:mall', 'link:mijnmall', 'link:pay', 'link:appdossier',
      'link:huis', 'link:uitgaan', 'link:foodcourt',
      'link:spelavond', 'link:tweedescherm'] },
    /* INSTELLINGEN, EN MET OPZET ZONDER `wereld`. Een wereld is een context waar
       je in leeft; deze vier gaan niet over een dag maar over het systeem. Ze
       zijn RTG Core, en Core heeft in de bank een gezicht: het bedieningspaneel
       in de voet. Vandaar `paneel`: geen vijfde wereldtegel, geen tweede
       instellingenscherm. wereldBij() in 29c filtert deze map er vanzelf uit. */
    { sleutel: 'map-instellingen', naam: 'Instellingen', paneel: '#osCcBtn', items: [
      'link:ik', 'link:veilig', 'link:passkeys', 'link:sessies', 'link:relaties', 'link:gegevens', 'link:post', 'link:juridisch'] },
    /* WORKOS IS EEN CONTEXT EN GEEN PRODUCT MET EEN PRIJS. De naam ging van
       "RTG Kantoor" naar WorkOS omdat er twee verschillende toegangsmodellen in
       dezelfde wereld wonen, en die verschillen mogen de wereld niet splitsen:
       een werknemer krijgt de werkvloer VIA zijn werkgever, een werkgever KOOPT
       de werkruimte. In het functieregister staat dat vandaag nog als twee
       losse dingen ('Werk OS (werkruimtes)' draagt intern+business, 'De
       werkvloer' draagt leverancier+personeel). Een wereld eroverheen ontkent
       dat verschil niet -- de commerciele verpakking zit BINNEN de wereld.
       Het huis houdt zijn eigen naam: RTG Kantoor is een merk in WorkOS. */
    { sleutel: 'map-werk', naam: 'WorkOS', wereld: '/apps/kantoor.html', glyf: 'office', items: [
      'link:werkos', 'link:rtgone', 'link:rtmail', 'link:magnaat', 'link:office', 'os:werk', 'link:onderneming', 'link:loonstrook', 'link:school',
      'link:browser', 'link:sitemaker', 'link:horeca', 'link:partnernetwerk'] },
    /* TRAVELOS IS DE KLEINSTE WERELD EN DAT IS GEEN ARGUMENT TEGEN HEM: een
       wereld is geen categorie in een spreadsheet maar een bestemming in het
       hoofd van een mens, en deze bezit de hele keten van vertrekken tot
       thuiskomen (WERELDEN.md). Deze elf stonden in LivingOS en zijn er
       letterlijk uit geknipt; geen item is nieuw, geen item is verdwenen.
       Het huis bestond al en hing nergens aan: /apps/reizen.html. */
    { sleutel: 'map-reizen', naam: 'TravelOS', wereld: '/apps/reizen.html', glyf: 'reizen', items: [
      'tab:reizen', 'link:reizen', 'tab:terplaatse', 'link:vluchten', 'link:ov', 'link:navigatie',
      'link:flits', 'link:stad', 'link:reisboek', 'link:hangar', 'link:residentie',
    /* Drie uit de tikkenmeting: aankomst, routedossier en OV-routes hingen
       nergens aan. Ze horen hier, want wie ze opent is onderweg. */
      'link:aankomst', 'link:routedossier', 'link:ovroutes'] },
    /* Veilig: wie je bent en wie er over je waakt. De vier apps op dezelfde
       kern zijn een app met vier standen geworden (zie de opmerking bij LINKS),
       plus de sleutels waarmee je binnenkomt. Drie is hier geen tekort maar de
       hele set -- dit is de enige map die op elke pas even groot is.

       Vitaal en Thuisrust stonden bij Het Huis en niet hier, omdat ze over zorg
       en huishouden gingen. Nu ze standen zijn van een app, kan die app maar in
       een map staan (geen enkel item staat in twee mappen) en dat is deze:
       waar de andere twee standen ook al woonden. Het Huis houdt zorg en gezin
       als eigen tabbladen, dus daar verdwijnt het onderwerp niet.

       Juridisch komt hier vandaan uit de map Werk. Vier tegels werden een, en
       daarmee zakte deze map naar drie -- onder de ondergrens die
       test/appmenu.e2e.js bewaakt, en die ondergrens is er niet voor niets: een
       bijna lege map op de instappas is precies waar de merkregel over gaat.
       Juridisch is geen noodgreep om een gat te vullen maar hoort hier: de
       app-bibliotheek zet hem zelf al in de categorie "Veiligheid & identiteit"
       naast Wie ben ik en Passkeys, en het gaat over jouw voorwaarden en jouw
       akkoorden -- wie je bent, niet waar je werkt. Werk houdt zes tegels. */
  /* Afgesplitst van app-main-24a2.js, dat over de 10 KB ging (keuringsregel 13).
     De snede loopt langs een echte grens: hierboven de drie werelden waarin een
     lid leeft, werkt en reist, hier FoundationOS -- de wereld die als laatste
     bijkwam. De MAPPEN-array loopt door over de snede heen; dat is geen
     uitzondering maar hoe deze bundel werkt (scripts/bundel.js plakt de delen
     eerst aaneen, en scripts/lib/wereldregister.js leest ze zo ook). */
    /* De zelfstandige Foundation-wereld. De stichting stond als EEN tegel binnen Het Huis
       ('os:rtf'), terwijl ze zeventien onderdelen, een eigen service worker en
       een eigen huis heeft. Een wereld die als tegel in een andere wereld
       hangt, is geen wereld. */
    /* De wereldtegel NAVIGEERT naar het huis; een tweede item in deze lijst zou
       nooit in beeld komen (openMap navigeert, zie 26.js). Het
       levens-command-center staat daarom als tegel OP de hub zelf, in de
       oudersectie -- zie de opmerking daar over de twee sessiewerelden. */
    /* FOUNDATIONOS IS DE WERELD, RTFOUNDATION IS HET MERK ERIN. Van de 71
       schermen onder /apps/foundation/ gaan er acht over de stichting; de rest
       is het leven van een kind en hoort in LivingOS. Want de bouwer van een
       capability bepaalt niet in welke wereld hij hoort, de gebruikerscontext
       doet dat (WERELDEN.md). Die verhuizing staat daar als genoemde stap. */
    /* HET HUIS IS os-publiek EN NIET os-portaal, en dat scheelde een deur die naar
       het verkeerde publiek leidt. os.html is een kantoorconsole achter een
       kantoortoken ("KANTOORCODE"), os-portaal.html heet met zoveel woorden
       "Portaal voor partners, gemeenten en ondernemers", en os-publiek.html zegt
       "Wat wij doen, bij u in de buurt". Alleen dat laatste is een voordeur voor
       een lid; de andere twee zijn deuren BINNEN de wereld. */
    { sleutel: 'map-rtf', naam: 'FoundationOS', wereld: '/apps/foundation/os-publiek.html', glyf: 'rtf', items: [
      'link:rtfbuurt', 'link:rtfportaal',
    /* Twee uit de tikkenmeting (scripts/tikken.js): het bord en het schrift
       bestonden en hingen nergens aan. */
    /* Het Klimaatfonds is een VENSTER op het Living Lab en geen tweede lab:
       klimaat is daar de soort 'duurzaam' (kern/livinglab/kader.js). */
      'link:rtfbord', 'link:rtfschrift', 'link:klimaat', 'link:buurtruil', 'link:geven'] }
  ];
  /* Afgesplitst van app-main-24a2.js toen dat over de 10 KB ging. De snede loopt
     langs een echte grens, en het is dezelfde grens waar WERELDEN.md over gaat:
     hierboven staat WAAR iets is (de werelden), hier staat WIE het mag zien (de
     pas). Wereld en pas zijn twee loodrechte assen; ze horen niet in hetzelfde
     bestand omdat ze toevallig allebei over tegels gaan. */

  /* De premium-suite (De Rechterhand) bestaat alleen voor Lifestyle en
     Business. De registry kent de apps voor iedereen; hier staat wie ze mag
     zien, zodat een RTG-pas ze niet in zijn mappen of in Spotlight tegenkomt.

     DIT IS DE TWEEDE PLEK WAAR STAAT WAT EEN PAS KRIJGT, en sinds vandaag
     weten die twee van elkaar. De server weigert /api/member/rechterhand aan
     wie geen Lifestyle of Business heeft; dezelfde veertien sleutels staan als
     `apps` op de functie `rechterhand` in het register, en
     test/wereldregister.test.js legt ze naast deze set. Wie er een vijftiende
     bij zet, zet hem op beide plekken of de bouw zakt.

     De korrel blijft wel verschillen, en dat is geen slordigheid: de server
     schakelt op FUNCTIE en per doelgroep, deze set verbergt APPS en kent geen
     verschil tussen Lifestyle en Business. Wat ze nu delen is de inhoud, niet
     de vorm. */
  const PREMIUM = new Set(['rechterhand', 'reisboek', 'cellier', 'table', 'maison', 'garderobe',
    'mecenaat', 'nalatenschap', 'logboek', 'cercle', 'hangar', 'entourage', 'attenties', 'rendezvous']);
  const premiumPas = pas === 'lifestyle' || pas === 'business';

  /* Afgesplitst van app-main-24.js, dat over de 10 KB ging toen "Mijn loon"
     erbij kwam. De snede loopt langs een echte grens: hierboven staat WAT er
     op het OS staat (de registry, de mappen), hieronder staat hoe je WERK
     opent. Twee onderwerpen die elkaar niet nodig hebben. */
  /* ---------- Werk op het OS + de algemene pin ----------
     De werk-apps zijn gewone apps op het RTG-OS: een tik op "Mijn werkplekken"
     toont de
     werkplekken die aan het ene RTG-account gekoppeld zijn (bevoegdheid), en
     openen gaat met de algemene pin (het bewijs), dezelfde pin die de
     privacygevoelige apps op dit OS beschermt. Onder water munt
     /api/account/start de werksessie, dus alle regels (zoals het werkvenster
     van de werkgever) blijven gewoon gelden. Deelt de OS-IIFE-scope:
     OSAPPS/MAPPEN/LINKS komen uit 25-os-01.js, de kiezer-scrim uit 01b. */
  /* "Mijn werkplekken", en niet "Werk". Deze tegel staat in Het Huis naast
     "Werk OS" (de werkplek-app zelf, link:werk) en droeg hetzelfde koffertje-
     icoon: twee tegels die er identiek uitzagen en bijna hetzelfde heetten,
     terwijl ze iets anders doen. Dit is de KIEZER -- hij toont de werkplekken
     die aan je RTG-account gekoppeld zijn (personeel, leverancier, kantoor) en
     opent die met je algemene pin. De naam zegt dat nu. */
  OSAPPS.werk = { naam: 'Mijn werkplekken' };
  // Werk staat in de map "Het Huis" en opent met de algemene pin.
  // deze apps zijn prive: openen kan pas na de algemene pin (5 min geldig)
  for (const pk of ['berichten', 'vonk', 'rendezvous', 'wbw', 'loonstrook']) { if (LINKS[pk]) LINKS[pk].prive = true; }

  let pinOkTot = 0; // de pin blijft vijf minuten geldig, zoals op een telefoon
  // de werkplek-zone kan om een positie vragen: dan een keer ophalen en
  // opnieuw proberen; de server vergelijkt en bewaart er niets van
  const vraagPositie = () => new Promise(af => {
    if (!navigator.geolocation) return af(null);
    navigator.geolocation.getCurrentPosition(
      p => af({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => af(null), { enableHighAccuracy: true, timeout: 8000 });
  });
  const WERKDOEL = {
    personeel: { glyf: 'navigatie', app: 'Personeel (PDA)', url: '/apps/personeel.html', bewaar: (t, r) => { localStorage.setItem('rtg_pda_token', t); localStorage.setItem('rtg_pda_code', r.code || ''); } },
    zaak:      { glyf: 'maison', app: 'Leverancier',    url: '/apps/leverancier.html', bewaar: (t) => { localStorage.setItem('rtg_sup_token', t); } },
    kantoor:   { glyf: 'office', app: 'Backoffice',     url: '/apps/backoffice.html', bewaar: (t) => { localStorage.setItem('rtg_office_token', t); } },
    /* De werkruimte van het RTG Werk OS. Die had zijn eigen tweede inlog
       (werkruimtecode + lid-token); wie zijn RTG-account er een keer aan
       koppelde, moest daarna alsnog opnieuw inloggen om binnen te komen. De
       server leest die koppeling nu ook de andere kant op, dus hier is het
       gewoon een sleutel als alle andere. Wat we bewaren is precies wat de
       losse inlog bewaart: de code en het lid-token. */
    werkruimte: { glyf: 'werk', app: 'Werk OS', url: '/apps/werk.html',
      bewaar: (t, r) => { localStorage.setItem('rtg_werk_sessie', JSON.stringify({ werkruimte: r.code, lidToken: t })); } }
  };

  /* vraag de algemene pin (of zet hem eerst) en geef hem door aan af(pin) */
  function metAlgPin(af) {
    if (Date.now() < pinOkTot) return af(null);
/* de algemene pin: zetten of vragen */
    API.call('/pin/status', {}).then(st => {
      const zetten = !st.gezet;
      belTitel.textContent = zetten ? T('pin.zet', 'Kies uw algemene pin') : T('pin.vraag', 'Algemene pin');
      belLijst.textContent = '';
      const uitleg = document.createElement('div');
      uitleg.className = 'os-bel-leeg';
      uitleg.textContent = zetten
        ? T('pin.zetuit', 'Een pincode van 4 tot 8 cijfers, overal dezelfde: hij beschermt uw prive-apps en opent uw werk-apps.')
        : T('pin.vrguit', 'Dezelfde pin die uw prive-apps beschermt.');
      belLijst.appendChild(uitleg);
      const inp = document.createElement('input');
      inp.type = 'password'; inp.inputMode = 'numeric'; inp.maxLength = 8; inp.autocomplete = 'off';
      inp.setAttribute('aria-label', T('pin.veld', 'Algemene pin'));
      inp.style.cssText = 'width:100%;margin:0.5rem 0;background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.8rem;font-size:1rem;letter-spacing:0.4em;text-align:center;color:var(--txt);';
      belLijst.appendChild(inp);
      const fout = document.createElement('div');
      fout.className = 'os-bel-leeg'; fout.style.color = 'var(--burgundy-on-dark,#C23A5E)';
      belLijst.appendChild(fout);
      const ga = document.createElement('button');
      ga.textContent = zetten ? T('pin.bewaar', 'Pin instellen') : T('pin.open', 'Ontgrendel');
      const doe = async () => {
        const pin = inp.value.trim();
        if (!/^\d{4,8}$/.test(pin)) { fout.textContent = T('pin.vorm', '4 tot 8 cijfers.'); return; }
        try {
          if (zetten) await API.call('/pin/zet', { pin });
          else await API.call('/pin/check', { pin });
          pinOkTot = Date.now() + 5 * 60000;
          sluitScrims();
          af(pin);
        } catch (e) { fout.textContent = e.message || T('pin.mis', 'Dat ging niet goed.'); inp.value = ''; inp.focus(); }
      };
      ga.addEventListener('click', doe);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') doe(); });
      belLijst.appendChild(ga);

      // "Pin vergeten?" onder het veld. De hele stroom -- de knop, de aanvraag
      // en het scherm dat de nieuwe pin zet -- woont in /shared/pinherstel.js:
      // een plek voor een ding, en dit deel zat al aan de 10 KB-grens.
      if (!zetten && window.RTGPinHerstel) RTGPinHerstel.knop(belLijst, fout, API, T);
      belScrim.classList.add('open');
      setTimeout(() => inp.focus(), 60);
    }).catch(() => af(null)); // geen account/lijn: niet blokkeren, de werk-app vraagt zelf
  }

  /* de Werk-kiezer: gekoppelde werkplekken uit het ene account */
  function openWerkKiezer() {
    belTitel.textContent = T('werk.h', 'Mijn werkplekken');
    belLijst.textContent = '';
    API.call('/account/rollen', {}).then(d => {
      const rollen = (d.rollen || []).filter(r => WERKDOEL[r.rol]);
      if (!rollen.length) {
        const leeg = document.createElement('div');
        leeg.className = 'os-bel-leeg';
        leeg.textContent = T('werk.leeg', 'Nog geen werkplek gekoppeld. Bewijs eenmalig uw werk-inlog (bijvoorbeeld uw personeels-PIN in de leverancier-app); daarna opent uw werk hier met uw algemene pin.');
        belLijst.appendChild(leeg);
      }
      for (const r of rollen) {
        // Een manager hoort in de zaak-app en niet in de PDA. accStart() munt
        // dezelfde sessie: geen bevoegdheid verandert, alleen waar hij landt.
        const doel = (r.rol === 'personeel' && r.manager) ? WERKDOEL.zaak : WERKDOEL[r.rol];
        const b = document.createElement('button');
        const zi = document.createElement('span'); zi.className = 'zi';
        const zg = window.RTGGlyf && RTGGlyf.svg(doel.glyf); if (zg) zi.appendChild(zg);
        b.appendChild(zi);
        b.appendChild(document.createTextNode(doel.app));
        const m = document.createElement('span'); m.className = 'zm';
        m.textContent = (r.zaakNaam || r.naam || '') + (r.naam && r.zaakNaam ? ' · ' + r.naam : '');
        b.appendChild(m);
        b.addEventListener('click', () => metAlgPin(async (pin) => {
          try {
            const body = { rol: r.rol, code: r.code, staffId: r.staffId, pin };
            let s;
            try { s = await API.call('/account/start', body); }
            catch (e1) {
              if (!(e1.data && e1.data.locatieNodig)) throw e1;
              const pos = await vraagPositie();
              if (!pos) throw e1;
              s = await API.call('/account/start', Object.assign({ positie: pos }, body));
            }
            try { doel.bewaar(s.token, r); } catch (e2) {}
            // Rahuls welzijnszin (late dienst, veel starts): stil tonen, nooit blokkeren
            if (s.welzijn) bannerToon('', 'Rahul', s.welzijn);
            // de werk-app opent schermvullend, op elk formaat
            location.href = doel.url;
          } catch (e) { bannerToon('', T('werk.dicht', 'Werk'), e.message || T('werk.mis', 'Openen lukte niet.')); }
        }));
        belLijst.appendChild(b);
      }
      /* De eerste keer. Een werkruimte heeft zijn eigen inlog (code +
         lid-token) en hoort dat te houden: hij moet ook werken voor iemand
         zonder RTG-pas. Maar dan moet die deur hier wel te vinden zijn --
         anders is "een inlog" alleen waar voor wie al binnen was. Deze rij
         staat er dus altijd, ook als de lijst leeg is. */
      const nieuw = document.createElement('button');
      const nzi = document.createElement('span'); nzi.className = 'zi';
      const nzg = window.RTGGlyf && RTGGlyf.svg('werk'); if (nzg) nzi.appendChild(nzg);
      nieuw.appendChild(nzi);
      nieuw.appendChild(document.createTextNode(T('werk.nieuw', 'Werkruimte openen')));
      const nm = document.createElement('span'); nm.className = 'zm';
      nm.textContent = T('werk.nieuw.sub', 'Eerste keer: met uw werkruimtecode en lid-token. Koppelt u daar uw RTG-account, dan staat hij hierboven.');
      nieuw.appendChild(nm);
      nieuw.addEventListener('click', () => { location.href = '/apps/werk.html'; });
      belLijst.appendChild(nieuw);
    }).catch(() => {
      const leeg = document.createElement('div');
      leeg.className = 'os-bel-leeg';
      leeg.textContent = T('werk.acc', 'Werk op het OS werkt met een echt RTG-account.');
      belLijst.appendChild(leeg);
    });
    belScrim.classList.add('open');
  }
/* ---------- Mappen, gebruik en het bouwen van de tegels ----------

   Afgesplitst van app-main-25.js toen die over de 10 kB ging. Let op de VORM
   van deze knip: de bundel plakt de delen rauw aaneen en app-main-25.js eindigt
   MIDDEN in een functie (tegelInhoud loopt door in 26). Een blok uit het midden
   verplaatsen zou de volgorde van de stroom veranderen -- dat is hier een keer
   gebeurd, en toen belandde openWerkKiezer() binnen in tegelInhoud(). Regel 42
   van de keuring ving dat meteen: "aangeroepen buiten de functie waarin hij
   verklaard staat", op het scherm een lege bel.

   Een deel van een bundel mag dus alleen aan de STAART worden afgeknipt, nooit
   uit het midden. Wat hier staat is precies de staart van 25. */
  /* ---------- mappen: eigen namen ----------
     De naam van een map is van de gebruiker: hernoemen kan in de wiebel-modus
     (tik op de map) of via Rahul; de keuze staat per pas in localStorage. */
  function mapNamen() { try { return JSON.parse(localStorage.getItem('rtg_os_mapnamen_' + pas) || '{}'); } catch (e) { return {}; } }
  function mapNaam(map) { return (mapNamen()[map.sleutel] || '').trim() || map.naam; }
  function zetMapNaam(map, naam) {
    try {
      const m = mapNamen();
      const schoon = (naam || '').trim().slice(0, 18);
      if (schoon && schoon !== map.naam) m[map.sleutel] = schoon; else delete m[map.sleutel];
      localStorage.setItem('rtg_os_mapnamen_' + pas, JSON.stringify(m));
    } catch (e) {}
    bouw();
  }

  /* ---------- gebruik bijhouden: het OS leert wat u vaak opent ----------
     Telt per app hoe vaak hij geopend wordt, met verval per dag; Spotlight
     zet daar de rij "Voor u" van. Alles blijft lokaal op het toestel. */
  function gebruik() { try { return JSON.parse(localStorage.getItem('rtg_os_gebruik_' + pas) || '{}'); } catch (e) { return {}; } }
  function telGebruik(sleutel) {
    try {
      const g = gebruik(), nu = Date.now(), oud = g[sleutel] || { n: 0, t: nu };
      const dagen = Math.max(0, (nu - (oud.t || nu)) / 86400000);
      g[sleutel] = { n: (oud.n || 0) * Math.pow(0.85, dagen) + 1, t: nu };
      localStorage.setItem('rtg_os_gebruik_' + pas, JSON.stringify(g));
    } catch (e) {}
  }
  /* HIER STOND HET RITME: WANNEER je iets opende.

     Een tweede teller naast die hierboven, met wereld + uur als sleutel, zodat
     Rahul op de wereldring kon zeggen "normaal opent u nu Kantoor". Die ring
     hing om de klok, de klok was het beginscherm, en dat beginscherm is de
     werktafel geworden -- de enige lezer van deze teller is dus verdwenen.

     Hij is meegegaan en niet blijven staan. Een teller die gedrag per uur
     wegschrijft en die niemand meer leest, is geen ongebruikte functie maar een
     verzameling die geen doel meer heeft; dat is precies wat je in een huis dat
     op codenamen draait niet wilt laten liggen. De teller die WEL een lezer
     heeft (gebruik/topGebruik, voor de rij "Voor u" in Spotlight) staat
     hierboven en blijft. */

  function topGebruik(k) {
    const g = gebruik(), nu = Date.now();
    return Object.entries(g)
      .map(([s, v]) => [s, (v.n || 0) * Math.pow(0.85, Math.max(0, (nu - (v.t || nu)) / 86400000))])
      .sort((a, b) => b[1] - a[1])
      .map(([s]) => s)
      .filter(itemZichtbaar)
      .slice(0, k);
  }

  const sleutelVan = it => typeof it === 'string' ? it : it.sleutel;
  // rij 0 = de mappen boven de klok, rij 1 = de functies eronder
  const RIJEN = () => [MAPPEN, FUNCTIES];
  function bewaardeVolgorde(p) { try { return JSON.parse(localStorage.getItem('rtg_os_indeling_' + pas + '_' + p) || 'null'); } catch (e) { return null; } }
  function bewaarVolgorde(p, volgorde) { try { localStorage.setItem('rtg_os_indeling_' + pas + '_' + p, JSON.stringify(volgorde)); } catch (e) {} }
  function gesorteerd(p) {
    const basis = RIJEN()[p], orde = bewaardeVolgorde(p);
    if (!orde) return basis;
    const perSleutel = new Map(basis.map(it => [sleutelVan(it), it]));
    const uit = [];
    for (const s of orde) if (perSleutel.has(s)) { uit.push(perSleutel.get(s)); perSleutel.delete(s); }
    for (const it of basis) if (perSleutel.has(sleutelVan(it))) uit.push(it); // nieuw sinds de bewaring: achteraan
    return uit;
  }

  /* ---------- iconen bouwen ---------- */
  const tabKnop = t => tabbar.querySelector('button[data-tab="' + t + '"]');
  const tabZichtbaar = t => { const b = tabKnop(t); return !!b && b.style.display !== 'none'; };
  const tabNaam = t => { const s = tabKnop(t); const sp = s && s.querySelector('span'); return sp ? sp.textContent : t; };

  function itemDef(item) { // os-app of link-app: de registry-invoer
    return item.startsWith('os:') ? OSAPPS[item.slice(3)] : LINKS[item.slice(5)];
  }
  // een Bodoni-monogram als de app (nog) geen eigen glyf heeft: de eerste
  // letters van de naam, netjes in de display-letter (huisstijl, geen emoji).
  function monogram(naam) {
    const woorden = String(naam || '').trim().split(/\s+/).filter(w => !/^(de|het|een|rtg|rtf|mijn)$/i.test(w));
    let m = woorden.length >= 2 ? (woorden[0][0] + woorden[1][0])
      : (woorden[0] || naam || '?').slice(0, 2);
    const span = document.createElement('span');
    span.className = 'os-monogram';
    span.textContent = m.toUpperCase();
    return span;
  }
  function glyfVoor(item) { // huisstijl-glyf op naam van de sleutel
    const sleutel = item.slice(item.indexOf(':') + 1);
    return window.RTGGlyf ? RTGGlyf.svg(sleutel) : null;
  }
  function tegelInhoud(item) { // svg (tab), glyf (link/os-app) of monogram in de tegel
/* de taakbalk: welke knop welk tabblad opent */
    if (item.startsWith('tab:')) {
      const svg = tabKnop(item.slice(4)) && tabKnop(item.slice(4)).querySelector('svg');
      return svg ? svg.cloneNode(true) : document.createTextNode('•');
    }
    return glyfVoor(item) || monogram((itemDef(item) || {}).naam || item);
  }
  function itemNaam(item) {
    return item.startsWith('tab:') ? tabNaam(item.slice(4)) : (itemDef(item) || {}).naam || item;
  }
  /* Zichtbaar is een app als hij bestaat, bij jouw pas hoort, en als de functie
     erachter in je boardroom aan staat (isAan, 25-os-04b.js). Ook de functierij
     onder de klok volgt dat: zet je "Directe berichten" uit, dan verdwijnt de
     tegel Berichten. Een tegel die je wel kunt openen maar die daarna 403 geeft
     is erger dan geen tegel.

     Wat NIET uit kan, bepaalt de boardroom zelf (vast:true op de server, zoals
     je wallet met de ledenpas) -- niet dit scherm. Zo staat de regel op een
     plek in plaats van op twee. */
  function itemZichtbaar(item) {
    if (!item || typeof item !== 'string') return false;
    if (gast() && LEDEN_ONLY.has(item)) return false;
    if (item.startsWith('tab:')) return tabZichtbaar(item.slice(4)) && isAan(item);
    if (item.startsWith('link:') && PREMIUM.has(item.slice(5)) && !premiumPas) return false;
    if (!itemDef(item)) return false;
    return isAan(item);
  }
  // een gratis account (zonder pas) heeft geen wallet en geen Rahul; de kern
  // zet daarvoor de klasse os-gast op #app (00-kern-05.js)
  const gast = () => app.classList.contains('os-gast');
  const LEDEN_ONLY = new Set(['link:wallet']);
  function openItem(item) {
    if (wiebel) return; // in wiebel-modus opent er niets, net als op een telefoon
    telGebruik(item);
    if (item.startsWith('tab:')) { const b = tabKnop(item.slice(4)); if (b) b.click(); }
    else if (item.startsWith('os:')) { openOsApp(item.slice(3)); }
    else {
      const l = LINKS[item.slice(5)];
      if (!l) return;
      // Op telefoon blijft een app één scherm. Op een computer wordt hetzelfde
      // scherm een blad in de Command-werktafel; zo kunnen meerdere bladen van
      // dezelfde software naast elkaar blijven staan zonder extra knoppen.
      const openen = () => {
        if (window.RTGCommand && RTGCommand.actief()) RTGCommand.open(l.url, l.naam);
        else location.href = l.url;
      };
      // prive-apps openen pas na de algemene pin (25-os-01a.js)
      if (l.prive) return metAlgPin(openen);
      openen();
    }
  }

  /* ---------- de kiezer: Bellen, Videobellen en Snaps ----------
     Een tik op de app opent uw contacten; een tik op een contact belt,
     videobelt of stuurt de snap meteen (via de sociale laag, RTGSocial). */
  const belScrim = $('#osBelScrim'), belTitel = $('#osBelTitel'), belLijst = $('#osBelLijst');
  function openOsApp(naam) {
    const app = OSAPPS[naam]; if (!app || !belScrim) return;
    sluitScrims();
    // Werk: de eigen kiezer met gekoppelde werkplekken en de algemene pin
    if (naam === 'werk') { openWerkKiezer(); return; }
    belTitel.textContent = app.naam;
    belLijst.textContent = '';
    // RTFoundation: een leeftijdskeuze, daarna opent de juiste app (RTF-jas)
    if (naam === 'rtf') {
      let onthouden = null;
      try { onthouden = localStorage.getItem('rtf_app_groep'); } catch (e) {}
      for (const gr of RTF_GROEPEN) {
        const b = document.createElement('button');
        const zi = document.createElement('span'); zi.className = 'zi';
        const gg = window.RTGGlyf && RTGGlyf.svg('rtf-' + gr.g);
        if (gg) zi.appendChild(gg); else zi.textContent = (gr.naam.match(/[A-Z]/g) || ['R']).slice(0, 2).join('');
        b.appendChild(zi);
        b.appendChild(document.createTextNode(gr.naam));
        const m = document.createElement('span'); m.className = 'zm';
        m.textContent = gr.sub + (onthouden === gr.g ? ' · vorige keer' : '');
        b.appendChild(m);
        b.addEventListener('click', () => { location.href = '/apps/foundation/index.html?groep=' + gr.g; });
        belLijst.appendChild(b);
      }
      belScrim.classList.add('open');
      return;
    }
    const S = window.RTGSocial;
    const lijst = S && S.ok && S.ok() ? S.lijst() : [];
    if (!lijst.length) {
      const d = document.createElement('div');
      d.className = 'os-bel-leeg';
      d.textContent = 'Nog geen contacten. Voeg iemand toe in De Salon; daarna belt, videobelt en snapt u met een tik, zonder telefoonnummer.';
      belLijst.appendChild(d);
      const ga = document.createElement('button');
      const gi = document.createElement('span'); gi.className = 'zi';
      const gis = window.RTGGlyf && RTGGlyf.svg('salon'); if (gis) gi.appendChild(gis);
      ga.appendChild(gi); ga.appendChild(document.createTextNode('Naar De Salon'));
      ga.addEventListener('click', () => { sluitScrims(); const b = tabKnop('salon'); if (b) b.click(); });
      belLijst.appendChild(ga);
    }
    for (const c of lijst) {
      const b = document.createElement('button');
      const zi = document.createElement('span'); zi.className = 'zi';
      zi.textContent = String(c.codename || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
      b.appendChild(zi);
      b.appendChild(document.createTextNode(c.codename || ''));
      const m = document.createElement('span'); m.className = 'zm';
      const mg = window.RTGGlyf && RTGGlyf.svg(naam); if (mg) m.appendChild(mg); b.appendChild(m);
      b.addEventListener('click', () => {
        sluitScrims();
        if (!window.RTGSocial) return;
        if (naam === 'snaps') RTGSocial.snap(c.key);
        else RTGSocial.bel(c.key, c.codename, naam === 'videobellen');
      });
      belLijst.appendChild(b);
    }
    belScrim.classList.add('open');
  }
  /* Rahuls signatuurmond in de balk onderaan het beginscherm. Eén gedeeld
     canvas (de mond-lus hervat vanzelf zodra hij weer in beeld is); de
     tekenlaag (shared/mond.js) laden we er zelf bij. */
  var aiMondCv = null, aiMondBezig = false, aiOrbMond = null;
  function aiMond() {
    if (!aiMondCv) {
      aiMondCv = document.createElement('canvas');
      aiMondCv.width = 440; aiMondCv.height = 200;
      aiMondCv.className = 'os-ai-mond'; aiMondCv.setAttribute('aria-hidden', 'true');
      // de handle bewaren: als Rahul in de draad iets zegt, beweegt de mond mee
      var mount = function () { if (window.RTGMond) aiOrbMond = RTGMond.maak(aiMondCv); };
      if (window.RTGMond) mount();
      else if (!aiMondBezig) {
        aiMondBezig = true;
        var s = document.createElement('script'); s.src = '/shared/mond.js'; s.async = true;
        s.onload = mount; document.head.appendChild(s);
      }
    }
    return aiMondCv;
  }

  function maakAppIcoon(item) {
    const el = document.createElement('button');
    el.className = 'os-app'; el.dataset.sleutel = item;
    if (item.startsWith('tab:')) el.dataset.tab = item.slice(4);
    el.setAttribute('aria-label', itemNaam(item));
    const tegel = document.createElement('span'); tegel.className = 'os-tegel';
    tegel.appendChild(tegelInhoud(item));
    if (item.startsWith('tab:')) {
      const dot = tabKnop(item.slice(4)) && tabKnop(item.slice(4)).querySelector('span[id$="Dot"]');
      if (dot && dot.style.display !== 'none') { const b = document.createElement('span'); b.className = 'os-badge'; tegel.appendChild(b); }
    }
    el.appendChild(tegel);
    const n = document.createElement('span'); n.className = 'os-naam'; n.textContent = itemNaam(item); el.appendChild(n);
    el.addEventListener('click', () => openItem(item));
    return el;
  }
  function maakMapIcoon(map) {
    const el = document.createElement('button');
    el.className = 'os-app os-map'; el.dataset.sleutel = map.sleutel;
    el.setAttribute('aria-label', 'Map ' + mapNaam(map));
    /* EEN WERELD IS EEN APP EN ZIET ERUIT ALS EEN APP: een tegel met een glyf,
       geen mapvoorbeeld met minitegels (PLATFORM.md par. 0). Het mapvoorbeeld
       had ook een echt gebrek: het telde de ZICHTBARE onderdelen, dus op de
       instappas toonde RTG Leven drie snippers en RTFoundation een -- en dan
       oogt de instap budget, precies wat de merkregel verbiedt. Een glyf is
       op elke pas even vol. */
    if (map.wereld) {
      const tegel = document.createElement('span'); tegel.className = 'os-tegel';
      const g = window.RTGGlyf && RTGGlyf.svg(map.glyf);
      if (g) tegel.appendChild(g);
      else { const m = document.createElement('span'); m.className = 'os-monogram'; m.textContent = mapNaam(map).replace(/^RTG /, '').slice(0, 2); tegel.appendChild(m); }
      el.appendChild(tegel);
      const nm = document.createElement('span'); nm.className = 'os-naam'; nm.textContent = mapNaam(map); el.appendChild(nm);
      el.addEventListener('click', () => { if (!wiebel) openMap(map); });
      return el;
    }
    const tegel = document.createElement('span'); tegel.className = 'os-tegel os-map-tegel';
    for (const item of map.items.filter(itemZichtbaar).slice(0, 9)) {
      const mini = document.createElement('span'); mini.className = 'os-map-mini';
      mini.appendChild(tegelInhoud(item)); tegel.appendChild(mini);
    }
    el.appendChild(tegel);
    const n = document.createElement('span'); n.className = 'os-naam'; n.textContent = mapNaam(map); el.appendChild(n);
    // gewoon tikken opent de map; in de wiebel-modus tik je om te hernoemen
    el.addEventListener('click', () => {
      if (!wiebel) { openMap(map); return; }
      if (Date.now() - wiebelStart > 600) openHernoem(map);
    });
    return el;
  }

  /* Het beginscherm tekenen: de mappen bovenaan, de functies onder de klok.
     Een lege map (alles erin uitgezet of niet van toepassing op deze pas)
     laten we weg -- geen tegels die nergens heen gaan. */
  /* De afdruk van het beginscherm: precies datgene wat bouw() zou tekenen, als
     een tekenreeks -- welke tegels, in welke volgorde, met welke mapnaam EN
     met welk meldingsbolletje. Dat laatste hoort erbij: een badge die opkomt
     is een echte verandering en moet wel doortekenen. Zo kunnen we zien of
     opnieuw tekenen ergens toe leidt. */
  let vorigeAfdruk = null;
  const badgeVan = item => {
    if (!item.startsWith('tab:')) return '';
    const knop = tabKnop(item.slice(4));
    const dot = knop && knop.querySelector('span[id$="Dot"]');
    return (dot && dot.style.display !== 'none') ? '!' : '';
  };
  const afdruk = () => rijen.map((_, p) => gesorteerd(p).map(it =>
    typeof it === 'string'
      ? (itemZichtbaar(it) ? it + badgeVan(it) : '')
      : (it.items.some(itemZichtbaar) ? it.sleutel + ':' + mapNaam(it) + ':' + it.items.filter(itemZichtbaar).slice(0, 9).join('+') : '')
  ).join(',')).join('|');

  /* EEN KAPOTTE TEGEL MAG NIET HET HELE BEGINSCHERM KOSTEN.

     Dit is de plek waar de tegels ontstaan, en hij stond buiten elk vangnet:
     gooide een van de iconen (of een van de regels die bepaalt of hij zichtbaar
     is), dan brak de hele lus af en bleef er geen enkele tegel over. Wat je dan
     ziet is een leeg beginscherm met alleen de vaste onderdelen -- precies de
     melding "ik zie alleen de Rahul-balk".

     Nu valt per tegel te falen: de rest van de rij wordt gewoon gebouwd, en de
     console noemt de tegel bij naam. Een scherm met negentien van de twintig
     tegels is een werkende app; een leeg scherm is dat niet. */
  function bouw() {
    const stuk = [];
    rijen.forEach((rij, p) => {
      rij.textContent = '';
      for (const it of gesorteerd(p)) {
        try {
          if (typeof it === 'string') {  if (itemZichtbaar(it)) rij.appendChild(maakAppIcoon(it)); }
          else if (it.items.some(itemZichtbaar)) rij.appendChild(maakMapIcoon(it));
        } catch (e) {
          const naam = typeof it === 'string' ? it : (it && it.sleutel) || 'onbekend';
          stuk.push(naam);
          console.error('[rtg] tegel "' + naam + '" kon niet gebouwd worden:', e);
        }
      }
    });
    if (stuk.length) meldLeegScherm('tegels: ' + stuk.join(', '));
    // wat er nu staat is per definitie bij; de waarnemer hoeft er niet overheen
    vorigeAfdruk = afdruk();
    sync();
    /* De ring van de wereldstand hangt aan DEZELFDE bouw() als de tegels. Dat is
       geen nettigheid maar de kern van de afspraak: welke werelden je ziet en
       welke onderdelen erin zitten hangt aan je pas en je boardroom, dus twee
       lijsten die op verschillende momenten worden bijgewerkt lopen uit elkaar.
       Eerder hing de ring aan het laden van de pagina, en die is een slag
       eerder dan de boardroom-gegevens: het beginscherm was leeg. */
    if (typeof wereldBij === 'function') wereldBij();
    // en om dezelfde reden de deuren naar het systeem (app-main-29c.js)
    if (typeof systeemBij === 'function') systeemBij();
  }
  /* Afgesplitst van app-main-26b.js toen dat over de 10 KB ging (regel 13).
     De snede loopt langs een echte grens: hierboven wordt het beginscherm
     GETEKEND (tegels, mappen, functies, bouw()), hier wordt er iets mee GEDAAN
     -- een map openen en een map hernoemen. */

  /* ---------- mappen openen ---------- */
  const mapScrim = $('#osMapScrim'), mapGrid = $('#osMapGrid'), mapTitel = $('#osMapTitel');
  /* HIER STOND EEN SECTIE-INDELING, EN DIE WERD NOOIT GEBRUIKT.

     De opzet was: een brede map opent in kopjes ("Betalen", "Rekeningen")
     in plaats van een raster losse merknamen. Alleen las deze functie
     `map.secties` en zette NIEMAND dat ooit -- MAPPEN in 24a2.js draagt alleen
     `items`, van de bewaarde indeling wordt alleen de NAAM onthouden
     (rtg_os_mapnamen_*), en de server bemoeit zich er niet mee. Elke map liep
     dus altijd door de terugvaltak. `.os-sectiekop` had bovendien nergens CSS:
     was er ooit een kopje verschenen, dan als kale h4 met browsermarges.

     Dat is precies de rommel waar deze codebase elders een naam voor heeft: een
     klasse zonder element, en hier een tak zonder aanroeper. Hij leest als een
     feature die bestaat, dus niemand durft eraan te komen. Weg dus -- en met
     hem de reden dat de tegels over elkaar heen lagen: de sectie-lus maakte
     RIJEN, die rijen kregen zelf een raster, en ze hingen in een #osMapGrid dat
     ook al een raster was. Nu is er een raster en liggen de tegels er direct
     in.

     Komt de indeling terug, geef de rijen dan een eigen wikkel en haal het
     raster van #osMapGrid af -- niet twee rasters in elkaar.
     test/appmenu.e2e.js meet de meetkunde en zakt als dat weer gebeurt. */
  function openMap(map) {
    /* DRIE WERELDEN (PLATFORM.md par. 0). Een wereld is een APP en geen map:
       tikken opent hem, en er komt geen tussenscherm met tegels. De `items`
       blijven staan zolang de onderdelen nog eigen pagina's zijn -- Spotlight
       indexeert ze en zonder die index is er halverwege de verhuizing van
       alles onvindbaar. Naarmate een wereld zijn secties opslokt, loopt die
       lijst vanzelf leeg. */
    if (map.wereld) { location.href = map.wereld; return; }
    /* INSTELLINGEN IS GEEN WERELD MAAR OOK GEEN TEGELVELD (WERELDEN.md): het is
       het zichtbare gezicht van RTG Core, en dat gezicht bestaat al -- het
       bedieningspaneel in de voet van de bank. Een map met `paneel` opent die
       knop in plaats van een eigen scherm.

       EN DAAROM IS HET GEEN TWEEDE INGANG. De vier identiteits-apps horen niet
       in LivingOS, maar ze los uit MAPPEN halen zou ze uit Spotlight halen, en
       dat is verbergen (ADAPTIEF.md). Ze staan nu in een eigen map: Spotlight
       indexeert ze, en de map zelf gaat naar de ENE plek waar ze wonen. */
    if (map.paneel) { const knop = $(map.paneel); if (knop) { knop.click(); return; } }
    mapTitel.textContent = mapNaam(map);
    mapGrid.textContent = '';
    const zicht = map.items.filter(itemZichtbaar);
    /* Een brede app met maar EEN deur opent die deur. Het Privekantoor is zo'n
       geval -- het is zelf al een app met kamers, dus een tussenscherm met een
       enkele tegel erop zou een extra tik zijn die niets kiest. Dit geldt ook
       als een lid de rest van een map heeft uitgezet in zijn boardroom. */
    if (zicht.length === 1) { openItem(zicht[0]); return; }
    for (const item of zicht) {
      const el = maakAppIcoon(item);
      // alleen de map zelf dicht: een os-app (Bellen) opent hierna zijn kiezer
      el.addEventListener('click', () => mapScrim.classList.remove('open'));
      mapGrid.appendChild(el);
    }
    mapScrim.classList.add('open');
  }

  /* ---------- map hernoemen (wiebel-modus of Rahul) ---------- */
  const hernoemScrim = $('#osHernoemScrim'), hernoemIn = $('#osHernoemIn');
  const hernoemOk = $('#osHernoemOk'), hernoemReset = $('#osHernoemReset');
  let hernoemDoel = null;
  function openHernoem(map) {
    if (!hernoemScrim) return;
    hernoemDoel = map;
    hernoemIn.value = mapNaam(map);
    hernoemScrim.classList.add('open');
/* een map hernoemen op het springboard */
    setTimeout(() => { hernoemIn.focus(); hernoemIn.select(); }, 60);
  }
  if (hernoemOk) hernoemOk.addEventListener('click', () => { if (hernoemDoel) zetMapNaam(hernoemDoel, hernoemIn.value); sluitScrims(); });
  if (hernoemReset) hernoemReset.addEventListener('click', () => { if (hernoemDoel) zetMapNaam(hernoemDoel, ''); sluitScrims(); });
  if (hernoemIn) hernoemIn.addEventListener('keydown', e => { if (e.key === 'Enter' && hernoemOk) hernoemOk.click(); });

  /* ---------- overlays: gedeeld sluiten ---------- */
  const scrims = ['#osMapScrim', '#osZoekScrim', '#osCcScrim', '#osHernoemScrim', '#osBelScrim', '#osWinkelScrim']
    .map(s => $(s)).filter(Boolean);
  function sluitScrims() { scrims.forEach(s => s.classList.remove('open')); }
  scrims.forEach(s => s.addEventListener('click', e => { if (e.target === s) sluitScrims(); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { sluitScrims(); zetWiebel(false); } });

  /* ---------- zoeken (Spotlight) ---------- */
  const zoekScrim = $('#osZoekScrim'), zoekInput = $('#osZoekInput'), zoekLijst = $('#osZoekLijst');
  function alleItems() {
    const uit = [], gezien = new Set();
    const voeg = (item, map) => {
      if (gezien.has(item) || !itemZichtbaar(item)) return;
      gezien.add(item); uit.push({ item: item, uit: map });
    };
    FUNCTIES.forEach(it => voeg(it, null));
    MAPPEN.forEach(mp => mp.items.forEach(sub => voeg(sub, mapNaam(mp))));
    return uit;
  }
  // acties zijn ook gewoon vindbaar in Spotlight: instellingen als resultaten
  function osActies() {
    const uit = [
      { naam: 'Licht of donker', glyf: 'thema', doe: () => { const b = $('#rtg-thema-knop'); if (b) b.click(); } },
      { naam: 'Meldingen', glyf: 'meldingen', doe: () => { const b = $('#bell'); if (b) b.click(); } },
      { naam: 'Bedieningspaneel', glyf: 'paneel', doe: () => { ccSync(); if (ccScrim) ccScrim.classList.add('open'); } },
      { naam: 'Taal kiezen', glyf: 'taal', doe: () => { if (window.RTGi18n) RTGi18n.openModal(); } },
      { naam: 'Push aanzetten', glyf: 'push', doe: () => { if (window.RTGRealtime) RTGRealtime.enablePush(); } },
      { naam: 'Uitloggen', glyf: 'uitloggen', doe: () => { const b = $('#logoutBtn'); if (b) b.click(); } }
    ];
    if (window.RTGOSThema && RTGOSThema.keuzeMogelijk()) {
      for (const t of ['bordeaux', 'parelmoer', 'standaard']) {
        uit.push({ naam: 'Thema ' + (t === 'standaard' ? 'klassiek' : t), glyf: 'thema', doe: () => RTGOSThema.zet(t) });
      }
    }
    return uit;
  }
  // Rahul vanuit het zoekscherm: open zijn app, vul de vraag in en verstuur
  // via de bestaande chat-knoppen; de hele acties-registry van Rahul
  // (bestellen, boeken, betalen, plannen, annuleren) doet dan gewoon zijn werk.
  function vraagRahul(q) {
    sluitScrims();
    const b = tabKnop('ai'); if (b) b.click();
    const inp = $('#askInput'), knop = $('#askBtn');
    if (inp && knop && q) { inp.value = q; setTimeout(() => knop.click(), 150); }
    else if (inp) inp.focus();
  }
  /* Ook buiten deze laag bruikbaar. Twee plekken in de buitenste IIFE deden
     `if (typeof ask === 'function') ask(vraag)` -- en `ask` bestaat nergens, dus
     die knoppen openden Rahul wel en vulden de vraag NOOIT in. De guard ving het
     stil af. Eén functie, hier, en daar aangeroepen: geen tweede kopie. */
  window.RTGVraag = vraagRahul;
  /* De handelingen worden EEN keer opgehaald en daarna hergebruikt; hij is
     klein en verandert alleen bij een nieuwe bouw. Mislukt het ophalen, dan is
     de lijst leeg en doet de lade gewoon wat hij hiervoor deed. */
  let HANDELINGEN = [];
  fetch('/shared/handelingindex.json', { credentials: 'same-origin' })
    .then(r => (r.ok ? r.json() : { items: [] }))
    .then(j => { HANDELINGEN = (j && j.items) || []; })
    .catch(() => { HANDELINGEN = []; });

  function zoekSectie(tekst) {
    const d = document.createElement('div'); d.className = 'os-zoek-sectie'; d.textContent = tekst;
    zoekLijst.appendChild(d);
  }
  /* `sleutel` is optioneel en alleen gezet op rijen die een APP zijn.

     Waarom hij er is: Spotlight is sinds het springboard verdween de enige
     plek waar de onderdelen van een wereld nog te vinden zijn (zie openMap in
     app-main-26b.js -- de `items` blijven bestaan zodat deze index ze kan
     indexeren). Een rij droeg alleen zijn ZICHTBARE naam, en die namen
     veranderen met beleid: "Werk OS" werd "Mijn werkplekken", "RTG Office"
     werd "Documenten". Wie wil nagaan of een app nog vindbaar is, moest dus
     op een etiket zoeken dat juist hoort te mogen schuiven.

     De sleutel schuift niet: die verandert alleen als de app echt een andere
     app wordt. Hij staat hier dus naast het etiket, net als op een tegel
     (app-main-26b.js doet hetzelfde met dataset.sleutel). */
  function zoekRij(icoonNode, label, meta, doe, sleutel) {
    const b = document.createElement('button');
    if (sleutel) b.dataset.sleutel = sleutel;
    /* HET ADRES OP DE RIJ. Een rij die alleen in een klikafhandelaar weet waar
       hij heen gaat, bestaat niet voor scripts/tikken.js -- de meter die telt
       hoeveel tikken een functie van het beginscherm af ligt, en die met opzet
       alleen ECHTE bestemmingen telt (anders is hij op te poetsen met een
       belofte). Zwijgt deze lijst, dan meet het huis zich dieper dan het is.
       De klik blijft lopen via openItem(): dit is een etiket en geen tweede weg. */
    if (sleutel && sleutel.indexOf('link:') === 0) {
      const l = LINKS[sleutel.slice(5)];
      if (l && l.url) b.dataset.url = l.url;
    }
    const zi = document.createElement('span'); zi.className = 'zi'; zi.appendChild(icoonNode);
    b.appendChild(zi);
    b.appendChild(document.createTextNode(label));
    if (meta) { const m = document.createElement('span'); m.className = 'zm'; m.textContent = meta; b.appendChild(m); }
    b.addEventListener('click', doe);
    zoekLijst.appendChild(b);
  }
  function zoek() {
    const q = (zoekInput.value || '').trim().toLowerCase();
    zoekLijst.textContent = '';
    // zodra je iets typt: Rahul bovenaan. Zoeken gaat zo naadloos over in laten-
    // doen -- wat je ook typt (een app-naam, een klus, een vraag), Rahul pakt het
    // op met je eigen inlog. De letterlijke tekst gaat mee (niet de lowercase).
    if (q) {
      const bt = document.createElement('span'); bt.textContent = '✦';
      zoekRij(bt, 'Laat Rahul dit doen: "' + zoekInput.value.trim() + '"', null,
        () => vraagRahul(zoekInput.value.trim()));
    }
    // leeg veld: eerst "Voor u", de apps die u hier het vaakst opent
    if (!q) {
      const top = topGebruik(4);
      if (top.length) {
        zoekSectie('Voor u');
        for (const s of top) zoekRij(tegelInhoud(s), itemNaam(s), null, () => { sluitScrims(); openItem(s); }, s);
        zoekSectie('Alle apps');
      }
    }
    for (const { item, uit } of alleItems()) {
      if (q && !itemNaam(item).toLowerCase().includes(q)) continue;
      zoekRij(tegelInhoud(item), itemNaam(item), uit, () => { sluitScrims(); openItem(item); }, item);
    }
    /* HANDELINGEN DIE IN EEN ANDERE APP WONEN. Dezelfde lijst die de sprong op
       elk ander scherm toont (shared/handelingindex.json, gegenereerd uit de
       knoppen van de schermen zelf). Zonder dit deed de zoeklade hier MINDER dan
       de sprong drie schermen verderop, en dat is precies het soort verschil dat
       een mens niet kan onthouden.

       Alleen bij een zoekwoord, en een tik brengt je ERHEEN: uitvoeren doet de
       mens op het scherm zelf (GRAMMATICA.md). */
    if (q && HANDELINGEN.length) {
      const treffers = HANDELINGEN.filter(h => (h.label + ' ' + h.app).toLowerCase().includes(q)).slice(0, 8);
      if (treffers.length) {
        zoekSectie('Handelingen');
        for (const h of treffers) {
          const ic = document.createElement('span'); ic.textContent = '>';
          zoekRij(ic, h.label, 'in ' + h.app, () => {
            sluitScrims();
            if (window.RTGCommand && RTGCommand.actief()) RTGCommand.open(h.url, h.app);
            else location.href = h.url;
          });
        }
      }
    }
    // acties (instellingen en schakelaars) doen mee zodra er getypt wordt
    if (q) {
      const acts = osActies().filter(a => a.naam.toLowerCase().includes(q));
      if (acts.length) {
        zoekSectie('Acties');
        for (const a of acts) {
          const ic = (window.RTGGlyf && RTGGlyf.svg(a.glyf)) || document.createTextNode('');
          zoekRij(ic, a.naam, null, () => { sluitScrims(); a.doe(); });
        }
      }
    }
    // altijd onderaan: geef de vraag aan Rahul, wat het ook is
    // bij een lege zoekbalk staat Rahul onderaan als vaste ingang; zodra je typt
    // staat hij al bovenaan (zie zoek()), dus dan slaan we de dubbele rij over.
    if (!q) {
      const bi = document.createElement('span'); bi.textContent = '✦';
      zoekRij(bi, 'Vraag Rahul', null, () => vraagRahul(''));
    }
  }
  function openZoek() { sluitScrims(); zoekScrim.classList.add('open'); zoekInput.value = ''; zoek(); zoekInput.focus(); }
  /* EEN KEER VOORAF OPBOUWEN. De lade blijft dicht; wat verandert is dat de
     lijst er al IN staat. Twee redenen: hij staat er meteen als u hem opent, en
     hij is meetbaar -- een korte weg die pas na een tik bestaat, telt in geen
     enkele meting mee (zie de opmerking bij zoekRij hierboven). */
  if (zoekLijst) setTimeout(zoek, 800);
  if (zoekInput) zoekInput.addEventListener('input', zoek);


  /* Afgesplitst van app-main-27.js, dat over de 10 KB ging. De snede loopt
     langs de grens tussen ZOEKEN (Spotlight: wat staat er op dit OS) en
     BEDIENEN (het paneel, de helderheid, de wiebel-modus). */
  /* ---------- bedieningspaneel ---------- */
  const ccScrim = $('#osCcScrim');
  const ccBtn = $('#osCcBtn');
  if (ccBtn) ccBtn.addEventListener('click', () => { const open = ccScrim.classList.contains('open'); sluitScrims(); if (!open) { ccSync(); ccScrim.classList.add('open'); } });
  function ccSync() {
    const T = window.RTGOSThema;
    const rij = $('#osCcThema');
    // het thema (Champagne / Donker / Bordeaux) is een ROS-brede keuze voor iedereen
    if (rij) rij.style.display = '';
    if (T) document.querySelectorAll('#osCcThema button').forEach(b => b.classList.toggle('actief', b.dataset.thema === T.huidig()));
    const push = $('#osCcPush');
    if (push && window.RTGRealtime) push.classList.toggle('aan', RTGRealtime.pushOn && RTGRealtime.pushOn());
    const gps = $('#osCcGps');
    if (gps) {
      const g = window.RTGPlek ? RTGPlek.aan() : false;
      gps.classList.toggle('aan', g);
      gps.setAttribute('aria-pressed', String(g));
    }
  }
  document.querySelectorAll('#osCcThema button').forEach(b => b.addEventListener('click', () => {
    if (window.RTGOSThema) { RTGOSThema.zet(b.dataset.thema); ccSync(); }
  }));
  const ccTaal = $('#osCcTaal');
  if (ccTaal) ccTaal.addEventListener('click', () => { sluitScrims(); if (window.RTGi18n) RTGi18n.openModal(); });
  const ccPush = $('#osCcPush');
  if (ccPush) ccPush.addEventListener('click', async () => { if (window.RTGRealtime) { await RTGRealtime.enablePush(); ccSync(); } });
  /* DE LOCATIESCHAKELAAR, DIE ER NIET WAS.

     Zeven plekken (navigatie, flits, ov, ovdienst, de sterrenhemel, het
     levensteken van RTG Veilig en de ontmoet-lus) lezen `rtg_os_gps` en
     behandelen hem als de waarheid: alleen een uitdrukkelijke '1' geeft je
     positie vrij. Terecht -- maar niemand zette hem ooit op '1', want deze
     tegel bestond niet en shared/osmenu.js, waar de commentaren naar
     verwijzen, bestaat evenmin. De schakelaar stond dus voor iedereen, voor
     altijd, op uit. Dat is geen instelling maar een dode functie: "de gps doet
     het niet", en gelijk heeft wie dat zegt.

     shared/plek.js houdt de sleutel; hier staat alleen de knop. Aanzetten
     vraagt meteen een positie op, zodat de tegel niet "aan" zegt terwijl het
     toestel weigert -- dan springt hij zichtbaar terug op uit. */
  const ccGps = $('#osCcGps');
  if (ccGps) ccGps.addEventListener('click', async () => {
    if (!window.RTGPlek) return;
    await RTGPlek.zetAan(!RTGPlek.aan());
    ccSync();
  });
  const ccPin = $('#osCcPin');
  if (ccPin) ccPin.addEventListener('click', () => { sluitScrims(); metAlgPin(() => {}); });
  const ccZoek = $('#osCcZoek');
  if (ccZoek) ccZoek.addEventListener('click', openZoek);
  /* Scannen, je Zegel, je backoffice en de bel zaten als losse knopjes in de
     statusbalk; die staat nu helemaal leeg. Het beginscherm is mappen, klok,
     functies en de balk van Rahul -- en verder niets. De knoppen zelf blijven
     het model (verborgen in de HTML): we klikken ze hier gewoon aan, zodat het
     gedrag op EEN plek blijft wonen.

     De bel hoorde er per se bij. Zonder deze tegel was er na het leegmaken van
     de balk geen enkele ingang meer naar wat er voor je klaarligt, en dat merk
     je pas als je iets mist -- de stilste storing die er is. */
  [['#osCcScan', '#scanBtn'], ['#osCcZegel', '#zegelBtn'], ['#osCcBo', '#boBtn'],
   ['#osCcBel', '#bell']].forEach(([tegel, knop]) => {
    const t = $(tegel), k = $(knop);
    if (t && k) t.addEventListener('click', () => { sluitScrims(); k.click(); });
    else if (t) t.hidden = true;
  });
  /* De vier van Instellingen: identiteit, bescherming, sleutels en akkoorden.
     Ze staan hier als tegel en in MAPPEN als map zonder `wereld` -- twee
     weergaven van EEN lijst, want de tegel leest zijn item uit het attribuut en
     opent hem met dezelfde openItem als overal. Wie er een vijfde bij zet, zet
     hem op beide plekken of nergens; dat is de prijs van een paneel dat in HTML
     staat en een register dat in JS staat, en hij hoort hier genoemd te worden
     in plaats van pas op te vallen als er een mist. */
  document.querySelectorAll('[data-cc-open]').forEach((t) => {
    t.addEventListener('click', () => { sluitScrims(); openItem(t.dataset.ccOpen); });
  });
  // twee apps naast elkaar (split screen)
  const ccSplit = $('#osCcSplit');
  if (ccSplit) ccSplit.addEventListener('click', () => { sluitScrims(); if (window.RTGSplit) RTGSplit.open(); });
  // licht/donker: de (verborgen) gedeelde themaknop blijft de motor
  const ccLicht = $('#osCcLicht');
  if (ccLicht) ccLicht.addEventListener('click', () => { const b = $('#rtg-thema-knop'); if (b) b.click(); });
  const ccUit = $('#osCcUit');
  if (ccUit) ccUit.addEventListener('click', () => { sluitScrims(); const b = $('#logoutBtn'); if (b) b.click(); });
  // helderheid: puur visueel, onthouden per browser
  const helder = $('#osCcHelder');
  function zetHelder(v) { app.style.filter = v >= 110 ? '' : 'brightness(' + (v / 100) + ')'; try { localStorage.setItem('rtg_os_helder', String(v)); } catch (e) {} }
  if (helder) {
    const h = Number(localStorage.getItem('rtg_os_helder') || 100);
    helder.value = h; zetHelder(h);
    helder.addEventListener('input', () => zetHelder(Number(helder.value)));
  }
  // beweging: snelheid/intensiteit van de levende grond (via de gedeelde motor)
  const beweeg = $('#osCcBeweging');
  if (beweeg) {
    if (window.RTGBeweging) beweeg.value = RTGBeweging.waarde();
    beweeg.addEventListener('input', () => { if (window.RTGBeweging) RTGBeweging.zet(Number(beweeg.value)); });
  }

  /* ---------- wiebel-modus: herschikken met een lange druk ---------- */
  let wiebel = false, drukTimer = null, sleepEl = null, wiebelStart = 0, drukX = 0, drukY = 0;
  const klaarKnop = $('#osKlaar');
  function zetWiebel(aan) {
    wiebel = aan;
    if (aan) wiebelStart = Date.now();
    rijen.forEach(g => g.classList.toggle('os-wiebel', aan));
    if (klaarKnop) klaarKnop.hidden = !aan;
    if (!aan) { rijen.forEach((g, p) => bewaarVolgorde(p, [...g.children].map(c => c.dataset.sleutel))); sleepEl = null; }
  }
  if (klaarKnop) klaarKnop.addEventListener('click', () => zetWiebel(false));
  rijen.forEach(grid => {
/* het springboard verslepen, met vinger en met muis */
    grid.addEventListener('pointerdown', e => {
      const el = e.target.closest('.os-app'); if (!el) return;
      // waar de vinger begon: movementX/Y is bij touch in Safari altijd 0, dus
      // daarop afgaan betekende dat wegvegen de lange-druk NIET afbrak en de
      // wiebel-modus zomaar aansprong tijdens het scrollen. Nu meten we de
      // afstand zelf, en dat werkt op elk toestel gelijk.
      drukX = e.clientX; drukY = e.clientY;
      drukTimer = setTimeout(() => { zetWiebel(true); }, 550);
      if (wiebel) { sleepEl = el; el.classList.add('os-sleep'); el.setPointerCapture && el.setPointerCapture(e.pointerId); }
    });
    grid.addEventListener('pointermove', e => {
      if (drukTimer && !wiebel && Math.hypot(e.clientX - drukX, e.clientY - drukY) > 10) { clearTimeout(drukTimer); drukTimer = null; }
      if (!wiebel || !sleepEl) return;
      const onder = document.elementFromPoint(e.clientX, e.clientY);
      const doel = onder && onder.closest && onder.closest('.os-app');
      if (doel && doel !== sleepEl && doel.parentElement === sleepEl.parentElement) {
        const kinderen = [...sleepEl.parentElement.children];
        sleepEl.parentElement.insertBefore(sleepEl, kinderen.indexOf(doel) > kinderen.indexOf(sleepEl) ? doel.nextSibling : doel);
      }
    });
    const laat = () => { if (drukTimer) { clearTimeout(drukTimer); drukTimer = null; } if (sleepEl) { sleepEl.classList.remove('os-sleep'); sleepEl = null; rijen.forEach((g, p) => bewaarVolgorde(p, [...g.children].map(c => c.dataset.sleutel))); } };
    grid.addEventListener('pointerup', laat);
    grid.addEventListener('pointercancel', laat);
  });

  /* ---------- app-modus, statusbalk en model-spiegeling (als voorheen) ---------- */
  function actieveTab() { const b = tabbar.querySelector('button.active'); return b ? b.dataset.tab : 'home'; }
  function sync() {
    const tab = actieveTab(), open = tab !== 'home';
    app.classList.toggle('os-open', open);
    // schermvast zodra de app zichtbaar is: de pill echt onderin beeld
    document.body.classList.toggle('os-vast', getComputedStyle(app).display !== 'none');
    if (content) content.classList.toggle('os-thuis', !open);
    const terug = $('#osTerug'), brand = $('#osBrand'), titel = $('#osAppTitel');
    if (terug) terug.hidden = !open;
    if (brand) brand.style.display = open ? 'none' : '';
    if (titel) titel.textContent = open ? tabNaam(tab) : '';
  }
  /* Het springboard spiegelt de tabbar, dus we kijken mee -- maar alleen naar
     wat het beeld echt verandert.

     Hier stond 'class' in de filter, en dat was duur op de verkeerde momenten:
     openTab() zet bij ELKE schermwissel class="active" om op elke tabknop, dus
     bij elke tik werden alle mappen en tegels weggegooid en opnieuw getekend
     (inclusief hun SVG-iconen). Dat is het schokkerige gevoel bij navigeren,
     en het brak een lopende sleep-actie halverwege af.

     Zichtbaarheid en badges lopen via style.display (zie tabZichtbaar), nooit
     via een klasse -- 'style' volstaat dus. En voor de zekerheid daarbovenop
     een inhoudscontrole: verandert de uitkomst niet, dan tekenen we niet. */
  let gepland = null;
  const bouwAlsAnders = () => { if (afdruk() !== vorigeAfdruk) bouw(); };
  new MutationObserver(() => {
    if (gepland) return;
    gepland = requestAnimationFrame(() => { gepland = null; bouwAlsAnders(); });
  }).observe(tabbar, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style'] });
  // de gate/app-wissel (inloggen, uitloggen) stuurt de schermvaste modus
  new MutationObserver(sync).observe(app, { attributes: true, attributeFilter: ['style', 'class'] });

  /* sync() woont in deze scope en niet in die van openTab (app-main-12.js), dus
     kan die hem niet aanroepen -- vandaar deze naad, dezelfde vorm als
     window.RTGVraag in app-main-27.js. Waarom openTab hem nodig heeft staat
     daar, bij de aanroep. */
  window.RTGOSSync = sync;

  const naarHome = () => { const b = tabKnop('home'); if (b) b.click(); };
  const terug = $('#osTerug'), pill = $('#osPill');
  if (terug) terug.addEventListener('click', naarHome);
  // de pill: een tik gaat naar het beginscherm, vasthouden roept Rahul
  // (het Siri-gebaar van dit OS), en omhoog vegen sluit de open app: de app
  // krimpt onder de vinger weg (of veert terug als de veeg te kort was)
  let pillLang = false, pillTimer = null, pillY = null, pillDy = 0, pillVeeg = false;
  const rustigOS = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (pill) {
    pill.addEventListener('pointerdown', e => {
      pillLang = false; pillY = e.clientY; pillDy = 0; pillVeeg = false;
      try { pill.setPointerCapture(e.pointerId); } catch (x) {}
      pillTimer = setTimeout(() => { pillLang = true; vraagRahul(''); }, 550);
    });
    pill.addEventListener('pointermove', e => {
      if (pillY == null || pillLang) return;
      pillDy = Math.max(0, pillY - e.clientY);
      if (pillDy > 8 && !pillVeeg) {
        pillVeeg = true;
        if (pillTimer) { clearTimeout(pillTimer); pillTimer = null; } // vegen is geen vasthouden
      }
      if (!pillVeeg || rustigOS || !content) return;
      const p = Math.min(pillDy / 240, 1);
      content.style.transformOrigin = '50% 90%';
      content.style.transform = 'scale(' + (1 - p * 0.15).toFixed(4) + ') translateY(' + Math.round(-pillDy * 0.35) + 'px)';
      content.style.opacity = String(1 - p * 0.3);
    });
    const pillLos = () => {
      if (pillTimer) { clearTimeout(pillTimer); pillTimer = null; }
      if (pillY == null) return;
      const d = pillDy; pillY = null;
      if (!pillVeeg || !content) return;
      if (d > 70) {
        content.style.transform = ''; content.style.opacity = '';
        if (rustigOS) { naarHome(); return; }
        content.classList.add('os-veeg-weg');
        setTimeout(() => { naarHome(); content.classList.remove('os-veeg-weg'); }, 170);
      } else {
        content.classList.add('os-veeg-terug');
        content.style.transform = ''; content.style.opacity = '';
        setTimeout(() => content.classList.remove('os-veeg-terug'), 240);
      }
    };
    pill.addEventListener('pointerup', pillLos);
    pill.addEventListener('pointercancel', pillLos);
    pill.addEventListener('click', () => { if (!pillLang && !pillVeeg) naarHome(); pillLang = false; pillVeeg = false; });
  }

  /* De klok en de datum komen van de ene RTG-klok (/shared/klok.js), zodat
     elke app exact dezelfde tijd toont: Bodoni-cijfers met seconden en
     milliseconden. De elementen dragen data-rtg-klok / data-rtg-datum. */
  if (window.RTGKlok) RTGKlok.alles();

  /* Een app (zoals Balans) kan met #ai terugverwijzen naar de Rahul-chat:
     na het opstarten openen we dan meteen de AI-tab. */
  if (location.hash === '#ai') setTimeout(() => {
    const t = tabKnop('ai');
    if (t) t.click();
  }, 600);

  /* DEZELFDE AFSPRAAK, MAAR DAN VOOR ELKE STAND. De sprong (shared/sprong.js)
     staat op elk scherm van het huis, ook op schermen die deze app niet laden.
     Wil een lid daar naar een stand die IN deze app woont (Betalen, Salon,
     Zorg), dan kan de sprong die knop niet indrukken -- hij staat er niet.
     Hij stuurt dan hierheen met de stand in de hash, en wij drukken hem in.

     Alleen een knop die er ECHT is: een stand die uw pas niet opent, staat
     niet in de tabbalk, en dan gebeurt er niets. Zo kan een adres uit een
     bericht nooit een tab openen die u niet hoort te hebben. */
  const stand = /^#tab=(.+)$/.exec(location.hash);
  if (stand) setTimeout(() => {
    const t = tabKnop(decodeURIComponent(stand[1]));
    if (t) t.click();
  }, 600);

  /* ---------- batterij in de statusbalk, zoals op een telefoon ---------- */
  const bat = $('#osBat'), batVul = $('#osBatVul'), batPct = $('#osBatPct');
  if (bat && navigator.getBattery) {
    navigator.getBattery().then(b => {
      const verf = () => {
        bat.hidden = false;
        const p = Math.round(b.level * 100);
        batVul.style.width = Math.max(6, p) + '%';
        batPct.textContent = p + '%';
        bat.classList.toggle('laag', p <= 20 && !b.charging);
      };
      b.addEventListener('levelchange', verf);
      b.addEventListener('chargingchange', verf);
      verf();
    }).catch(() => {});
  }

  /* ---------- notificatie-banner: glijdt bovenin binnen ---------- */
  let bannerEl = null, bannerTimer = null;
  function bannerToon(icoon, titel, tekst) {
    if (!bannerEl) {
      bannerEl = document.createElement('button');
      bannerEl.className = 'os-banner';
      bannerEl.setAttribute('aria-live', 'polite');
      bannerEl.addEventListener('click', () => { bannerWeg(); const b = $('#bell'); if (b) b.click(); });
      app.appendChild(bannerEl);
    }
    bannerEl.textContent = '';
    const ic = document.createElement('span'); ic.className = 'ob-ic';
    const glyf = (window.RTGGlyf && RTGGlyf.heeft(icoon)) ? RTGGlyf.svg(icoon) : null;
    if (glyf) ic.appendChild(glyf); else ic.textContent = icoon || '';
    const kol = document.createElement('span');
    const t = document.createElement('div'); t.className = 'ob-titel'; t.textContent = titel || 'RTG';
    kol.appendChild(t);
    if (tekst) { const bd = document.createElement('div'); bd.className = 'ob-body'; bd.textContent = tekst; kol.appendChild(bd); }
    bannerEl.appendChild(ic); bannerEl.appendChild(kol);
    requestAnimationFrame(() => bannerEl.classList.add('open'));
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(bannerWeg, 4500);
  }
  function bannerWeg() {
    if (bannerEl) bannerEl.classList.remove('open');
    if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }
  }
  // live meldingen als banner: de kern geeft zijn onChange pas bij start() aan
  // de realtime-bus, dus wikkelen we start() in en haken we daar op mee.
  if (window.RTGRealtime && typeof RTGRealtime.start === 'function') {
    const echteStart = RTGRealtime.start.bind(RTGRealtime);
/* de realtime-verbinding starten en herstellen */
    RTGRealtime.start = (token, opts) => {
      opts = opts || {};
      const oud = opts.onChange;
      opts.onChange = n => {
        if (oud) oud(n);
        if (n && n.title) bannerToon(n.icon || '', n.title, n.body || '');
      };
      return echteStart(token, opts);
    };
  }

  /* ---------- Rahul bestuurt het OS ----------
     Zinnen die het OS zelf kan uitvoeren (open <app>, thema, licht/donker,
     zoek, home) onderscheppen we in de capture-fase, vóór de chat-handlers;
     al het andere gaat gewoon door naar Rahul-chat, die met zijn
     acties-registry op de server bestelt, boekt, betaalt en annuleert. */
  function alleDoelen() {
    const uit = [];
    for (const { item } of alleItems()) uit.push({ naam: itemNaam(item), doe: () => openItem(item) });
    MAPPEN.forEach(mp => uit.push({ naam: mapNaam(mp), doe: () => openMap(mp) }));
    return uit;
  }
  function osCommando(ruw) {
    const schoon = (ruw || '').trim().replace(/[?.!]+$/, '');
    const q = schoon.toLowerCase();
    if (!q) return false;
    if (/^(home|thuis|beginscherm)$/.test(q)) { sluitScrims(); naarHome(); bannerToon('✦', 'Rahul', 'Naar het beginscherm.'); return true; }
    // elke functie een eigen app: bellen en videobellen direct via Rahul
    if (/^(bel|bellen|iemand bellen)$/.test(q)) { sluitScrims(); openItem('os:bellen'); return true; }
    if (/^(videobel|videobellen|video bellen)$/.test(q)) { sluitScrims(); openItem('os:videobellen'); return true; }
    // RTF met leeftijd erbij slaat de keuze over: "open rtf kids"
    let mr = q.match(/^(?:open\s+|start\s+|ga naar\s+)?rtf\s+(mini|kids|kind|tiener|jong|volw|volwassen)$/);
    if (mr) {
      const g = ({ kids: 'kind', volwassen: 'volw' })[mr[1]] || mr[1];
      sluitScrims(); location.href = '/apps/foundation/index.html?groep=' + g;
      return true;
    }
    // mappen hernoemen: "hernoem sociaal naar vrienden" of "noem de map rtg & info om naar over rtg"
    const mh = schoon.match(/^(?:hernoem|noem)\s+(?:de\s+)?(?:map\s+)?(.+?)\s+(?:om\s+)?naar\s+(.+)$/i);
    if (mh) {
      // lidwoorden tellen niet mee: "de crew" en "crew" wijzen dezelfde map aan
      const kaal = s => String(s || '').toLowerCase().replace(/^(?:de|het|een)\s+/, '');
      const doel = MAPPEN.find(mp => kaal(mapNaam(mp)) === kaal(mh[1]) || kaal(mp.naam) === kaal(mh[1]));
      if (doel) {
        zetMapNaam(doel, mh[2]);
        bannerToon('✦', 'Rahul', 'De map heet nu "' + mapNaam(doel) + '".');
        return true;
      }
    }
    let m = q.match(/^zoek(?:en)?(?:\s+naar)?\s+(.+)$/);
    if (m) { openZoek(); zoekInput.value = m[1]; zoek(); return true; }
    m = q.match(/^thema\s+(bordeaux|parelmoer|standaard|klassiek)$/);
    if (m && window.RTGOSThema && RTGOSThema.keuzeMogelijk()) {
      RTGOSThema.zet(m[1] === 'klassiek' ? 'standaard' : m[1]);
      bannerToon('✦', 'Rahul', 'Het thema staat op ' + m[1] + '.');
      return true;
    }
    if (/^(licht|donker|lichte modus|donkere modus)$/.test(q)) {
      const b = $('#rtg-thema-knop');
      if (b) { b.click(); bannerToon('✦', 'Rahul', 'De weergave is omgezet.'); return true; }
      return false;
    }
    m = q.match(/^(?:open|start|ga naar)\s+(.+)$/);
    if (m) {
      const naam = m[1].replace(/^(?:de|het|een)\s+/, '');
      const doelen = alleDoelen();
      const doel = doelen.find(d => d.naam.toLowerCase() === naam) || doelen.find(d => d.naam.toLowerCase().includes(naam));
      if (doel) { sluitScrims(); doel.doe(); bannerToon('✦', 'Rahul', doel.naam + ' staat voor u open.'); return true; }
    }
    return false;
  }
  document.addEventListener('click', e => {
    if (!e.target || !e.target.closest || !e.target.closest('#askBtn')) return;
    const inp = $('#askInput');
    if (inp && osCommando(inp.value)) { inp.value = ''; e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target || e.target.id !== 'askInput') return;
    if (osCommando(e.target.value)) { e.target.value = ''; e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);


  /* ---------- de balk van Rahul, onderaan het beginscherm ----------
     Eén regel waarin je alles kwijt kunt. Is het een opdracht die het OS zelf
     kan uitvoeren ("open Reizen", "donker", "zoek villa", "hernoem Geld naar
     Bank"), dan doet het OS het meteen en blijf je op het beginscherm. Al het
     andere gaat naar Rahul zelf: zijn app opent met de vraag er al in, en zijn
     acties-registry op de server regelt de rest.

     Rahuls signatuurmond (dezelfde bewegende lippen als op het inlogscherm)
     zit in de balk, zodat zichtbaar is tegen wie je praat. */
  const aiBalk = $('#osAiBalk'), aiIn = $('#osAiIn'), aiOrb = $('#osAiOrb');
  if (aiOrb) aiOrb.appendChild(aiMond());
  if (aiBalk && aiIn) {
    aiBalk.addEventListener('submit', e => {
      e.preventDefault();
      const vraag = aiIn.value.trim();
      if (!vraag) { vraagRahul(''); return; } // lege balk: zijn hele app openen
      aiIn.value = '';
      if (osCommando(vraag)) return; // het OS kon het zelf; blijf thuis
      /* En anders antwoordt hij HIER, in de draad boven de balk. Je blijft dus
         op het beginscherm; wie het hele gesprek wil ziet dat in zijn app. */
      osRahulVraag(vraag);
    });
    // een tik op de mond opent Rahul zonder dat je iets hoeft te typen
    if (aiOrb) {
      aiOrb.style.cursor = 'pointer';
      aiOrb.addEventListener('click', () => vraagRahul(aiIn.value.trim()));
    }
  }
  /* ---------- het gesprek met Rahul op het beginscherm ----------

     De balk onderaan was een doorgeefluik: je typte iets en belandde in zijn
     app. Nu is het een gesprek dat op het beginscherm zelf staat, en Rahul
     BEGINT. Niet met een praatje, maar met wat hij op dit moment werkelijk
     ziet: een seintje, een verwachting, of een gedachte die hij voor je heeft
     geparkeerd. Ziet hij niets, dan zegt hij dat ook gewoon.

     Alles wat hij hier zegt komt van de server (/fluister/profiel, /voorspel,
     /spar/lijst) -- er wordt hier niets verzonnen om het scherm te vullen, en
     er staat nooit een kunstmatige haast bij. Je kunt het negeren; dan blijft
     het staan en gaat er niets knipperen.

     Antwoorden gaat via dezelfde motor als in zijn app (/fluister), dus hij kan
     hier ook echt iets regelen. Wat hij niet oppakt, gaat naar de gewone
     gesprekslaag. Geld gaat nooit zonder een "ja" de deur uit; dat zit in de
     motor zelf, niet hier. */
  const aiDraad = $('#osAiDraad'), aiTips = $('#osAiTips');
  let draadOpen = false, rahulBegon = false;
  const gezegd = new Set();   // wat hij al gezegd heeft; nooit twee keer hetzelfde

  /* `leeg` betekent: dit is Rahuls terugvalzin, hij heeft niets gevonden. Dat is
     geen detail maar precies het moment waarop het RITME iets mag zeggen -- "er
     ligt niets dringends" is per definitie een lege ring. Zonder dit vlaggetje
     wint zijn beleefde niets-zin het altijd van je gewoonte, en zie je het ritme
     nooit. */
  function draadBel(tekst, wie, leeg) {
    if (!aiDraad) return null;
    const b = document.createElement('div');
    b.className = 'os-bel van-' + (wie === 'mij' ? 'mij' : 'rahul');
    b.textContent = tekst;
    aiDraad.appendChild(b);
    // hoogstens de laatste zes beurten; het beginscherm blijft een beginscherm
    while (aiDraad.children.length > 6) aiDraad.removeChild(aiDraad.firstChild);
    aiDraad.hidden = false;
    draadOpen = true;
    aiDraad.scrollTop = aiDraad.scrollHeight;
    if (window.RTGMond && aiOrbMond && wie !== 'mij') aiOrbMond.praat(Math.min(4200, 420 + tekst.length * 38));
    /* Hier ging deze zin ook naar de gouden ring van Rahul in de wereldstand.
       Die stand hing om de klok van het beginscherm; dat beginscherm is de
       werktafel geworden en de ring is met hem verdwenen. Rahul zegt zijn zin nu
       op één plek -- hier, in de draad -- in plaats van op twee. */
    return b;
  }

  function draadTips(lijst) {
    if (!aiTips) return;
    aiTips.textContent = '';
    if (!lijst || !lijst.length) { aiTips.hidden = true; return; }
    lijst.slice(0, 3).forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = t.tekst;
      b.addEventListener('click', () => { aiTips.hidden = true; osRahulVraag(t.vraag || t.tekst); });
      aiTips.appendChild(b);
    });
    aiTips.hidden = false;
  }

  /* Wat Rahul uit zichzelf zegt zodra je thuis bent. Eén zin, de belangrijkste;
     de rest laat hij staan tot je erom vraagt. Volgorde: wat hij ziet, wat hij
     verwacht, wat hij heeft geparkeerd, en anders een rustige opening. */
  async function osRahulOpent() {
    if (rahulBegon || !aiDraad || !API.live || gast()) return;
    rahulBegon = true;
    let zin = null, tips = [];
    try {
      const prof = await API.call('/fluister/profiel');
      const sein = (prof && prof.seintjes || [])[0];
      if (sein && sein.tekst) {
        zin = sein.tekst;
        gezegd.add(sein.tekst);   // en dan niet nog eens bij het volgende rondje
        tips.push({ tekst: T('os.ai.t.regel', 'Regel dit'), vraag: sein.tekst });
      }
    } catch (e) { /* geen profiel: dan gewoon de volgende bron */ }
    if (!zin) {
      try {
        const v = ((await API.call('/voorspel')).verwachtingen || [])[0];
        if (v && v.wat) {
          zin = T('os.ai.verwacht', 'Ik verwacht') + ': ' + v.wat + (v.waarom ? ' (' + v.waarom + ')' : '') + '.';
          tips.push({ tekst: T('os.ai.t.klaar', 'Zet het klaar'), vraag: v.wat });
        }
      } catch (e) { /* niets verwacht */ }
    }
    if (!zin) {
      try {
        const s = ((await API.call('/spar/lijst', {})).spar || [])[0];
        if (s && s.wat) zin = T('os.ai.spar', 'We waren nog bezig met') + ': ' + s.wat + '.';
      } catch (e) { /* niets geparkeerd */ }
    }
    var leeg = !zin;
    if (!zin) zin = T('os.ai.rustig', 'Er ligt niets dringends. Zeg het maar; ik zoek het op, zet het klaar of regel het.');
    draadBel(zin, 'rahul', leeg);
    tips.push({ tekst: T('os.ai.t.dag', 'Hoe ziet mijn dag eruit?'), vraag: T('os.ai.q.dag', 'hoe ziet mijn dag eruit') });
    tips.push({ tekst: T('os.ai.t.kun', 'Wat kun je?'), vraag: T('os.ai.q.kun', 'wat kun je') });
    draadTips(tips);
  }

  /* Een vraag beantwoorden ZONDER het beginscherm te verlaten. Pakt de motor
     hem niet op, dan gaat hij alsnog naar de gewone gesprekslaag; en heeft die
     ook niets, dan zegt Rahul dat eerlijk in plaats van iets te verzinnen. */
  async function osRahulVraag(vraag) {
    const q = String(vraag || '').trim();
    if (!q) return;
    draadBel(q, 'mij');
    if (aiTips) aiTips.hidden = true;
    if (!API.live) { draadBel(T('os.ai.offline', 'Ik kan er nu niet bij; start de server en vraag het nog eens.'), 'rahul'); return; }
    const wacht = draadBel(T('os.ai.denkt', 'Even kijken…'), 'rahul');
    if (wacht) wacht.classList.add('denkt');
    const zet = (tekst) => {
      if (!wacht) return draadBel(tekst, 'rahul');
      wacht.classList.remove('denkt');
      wacht.textContent = tekst;
      if (aiOrbMond) aiOrbMond.praat(Math.min(4200, 420 + tekst.length * 38));
      aiDraad.scrollTop = aiDraad.scrollHeight;
    };
    try {
      const r = await API.call('/fluister', { q });
      if (r && r.pakte && r.antwoord) {
        zet(r.antwoord);
        if (r.gedaan) toast(T('fl.gedaan', 'Rahul heeft het geregeld.'));
        // een voorstel van Rahul krijgt hier dezelfde twee knoppen als in zijn app
        draadTips(r.voorstel
          ? [{ tekst: T('fl.ja', 'Ja, doe maar'), vraag: 'ja' }, { tekst: T('fl.nee', 'Nee, laat maar'), vraag: 'nee' }]
          : []);
        return;
      }
    } catch (e) { /* de motor pakte het niet; door naar de gesprekslaag */ }
    try {
      const d = await API.call('/ai', { messages: [{ role: 'user', content: q }] });
      zet((d && d.reply) || T('os.ai.geen', 'Daar kwam ik even niet uit. Vraag het gerust anders.'));
    } catch (e) {
      zet(T('os.ai.geen', 'Daar kwam ik even niet uit. Vraag het gerust anders.'));
    }
  }

  /* ---------- hij blijft meekijken ----------
     Proactief zijn is niet één zin bij binnenkomst. Als er ondertussen iets
     verandert, hoort hij dat te zeggen. Dus kijkt hij nog eens zodra je
     terugkomt bij de app, en verder rustig elk kwartier -- alleen als het
     scherm echt zichtbaar is en je op het beginscherm staat.

     Twee regels waar we ons aan houden. Hij zegt alleen iets als het NIEUW is
     (dezelfde zin komt nooit twee keer), en er gaat niets knipperen, tellen of
     trillen. Geen kunstmatige haast: dat is precies het soort aandacht-trekkerij
     dat hier niet thuishoort. Staat er iets en doe je er niets mee, dan blijft
     het gewoon staan. */
  async function osRahulKijkt() {
    if (!aiDraad || !API.live || gast() || document.hidden) return;
    const thuis = document.querySelector('.view.active');
    if (!thuis || thuis.dataset.view !== 'home') return;
    let sein = null;
    try { sein = ((await API.call('/fluister/profiel')).seintjes || [])[0]; } catch (e) { return; }
    if (!sein || !sein.tekst || gezegd.has(sein.tekst)) return;
    gezegd.add(sein.tekst);
    draadBel(sein.tekst, 'rahul');
    draadTips([{ tekst: T('os.ai.t.regel', 'Regel dit'), vraag: sein.tekst }]);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) osRahulKijkt(); });
  setInterval(osRahulKijkt, 15 * 60 * 1000);

  /* Het beginscherm zit in zijn eigen blok; de rest van de app (renderAll, die
     weet wanneer je gegevens binnen zijn) zit in een ander. Daarom hangen we
     Rahuls opening hier aan het venster: dat is de enige draad tussen die twee,
     en zo begint hij pas als er echt iets te vertellen valt. */
  window.RTGThuisRahul = { opent: osRahulOpent, vraag: osRahulVraag, kijkt: osRahulKijkt };
  /* ---------- de werelden aanreiken aan de bank van RTG Command ----------
     WAAR DIT VANDAAN KOMT. Hier stond de aanreiking aan shared/wereld.js: het
     beginscherm als kring om de klok, met de werelden als merken op een bezel.
     Dat beginscherm is weg -- de werktafel van RTG Command is het geworden -- en
     de klok is met hem meegegaan. De werelden niet. Ze staan nu bovenaan de
     bank, en dit blok is de plek waar ze daarheen gaan.

     De regel eromheen is niet veranderd: shared/command.js weet met opzet NIETS
     over welke werelden er zijn en welke onderdelen bij jouw pas horen. Dat
     staat hier al -- in MAPPEN, itemZichtbaar en mapNaam -- en wordt van hieruit
     doorgegeven. Wie daar ooit een eigen lijst werelden ziet ontstaan, heeft de
     fout te pakken waar LAT.md regel 4 over gaat.

     WAT ER PER WERELD MEEGAAT, en wat bewust niet. Naam, huis en teken: genoeg
     om een deur te zijn. De onderdelen gaan NIET mee. Ze horen bij de wereld en
     staan op het huis zelf (/apps/rtg.html en de andere twee dragen ze alle drie
     compleet); ze een tweede keer in de bank hangen zou een rail van veertig
     regels maken en de vraag oproepen welke van de twee lijsten de echte is.

     Ontbreekt de schil (een pagina zonder shared/command.js, een oude
     service-worker-cache), dan gebeurt er niets. Een beginscherm dat leeg blijft
     omdat een aanreiking niet aankwam is erger dan een bank zonder kopje. */

  /* Wordt aan het eind van bouw() aangeroepen, dus op precies het moment dat
     ook de tegels worden bijgewerkt. De schil vergelijkt zelf niets, maar
     opnieuw vullen kost een rij knoppen -- en het houdt de bank gelijk met een
     pas die intussen veranderd is. */
  function wereldBij() {
    if (!window.RTGCommand || !RTGCommand.werelden) return;
    RTGCommand.werelden(MAPPEN.filter(function (m) {
      return m.sleutel !== 'map-instellingen' && m.wereld && m.items.some(itemZichtbaar);
    }).map(function (m) {
      return {
        sleutel: m.sleutel,
        naam: mapNaam(m),
        url: m.wereld,
        /* De glyf van de wereld: hetzelfde teken als op zijn huis, uit dezelfde
           bron. Een tweede tekenset zou twee werelden geven die anders heten. */
        teken: function () { return (window.RTGGlyf && RTGGlyf.svg(m.glyf)) || null; }
      };
    }));
  }

  /* ---------- het bedieningspaneel aanreiken aan de voet van de bank ----------
     HET SPRINGBOARD IS ALS SCHERM VERDWENEN, EN DIT MOEST BLIJVEN.

     Het bedieningspaneel hing achter de knop rechtsboven op dat scherm, en
     draagt alles wat geen wereld is: thema, helderheid, taal, achtergrond, en de
     tegels scannen, je Zegel, je backoffice, de Boardroom, de algemene pin,
     push, zoeken, meldingen en uitloggen. Zonder een nieuwe deur was dat met het
     scherm meegegaan -- inclusief de enige uitlogknop die een lid heeft.

     Een deur en niet zestien. Het paneel is al de plek waar deze dingen samen
     staan; ze los in de bank hangen zou dezelfde lijst een tweede keer maken, op
     een plek die er niet over gaat.

     We klikken de bestaande knop aan in plaats van het paneel zelf te openen.
     Die knop draagt het gedrag (app-main-27b.js) en blijft de enige plek waar
     dat staat -- ook nu hij zelf niet meer in beeld komt. */
  function systeemBij() {
    if (!window.RTGCommand || !RTGCommand.systeem) return;
    var knop = $('#osCcBtn');
    /* RAHUL STOND HIER OOK, en is verhuisd naar shared/command.js: de werktafel
       levert zijn eigen deur, want zijn plek is de mond in de schilbalk. Hier
       riep hij RTGRahul.open() aan -- de zwevende handenvrij-balk -- en dat zou
       een tweede Rahul zijn naast die in de balk. */
    /* DIT HEET INSTELLINGEN EN NIET MEER BEDIENINGSPANEEL, en dat is geen
       cosmetiek maar het opruimen van een botsing. In de voet van de bank
       stonden twee knoppen: "Bedieningspaneel" (dit paneel: thema, taal, push,
       Zegel, uitloggen en sinds WERELDEN.md ook wie je bent, RTG Veilig,
       Passkeys en Juridisch) en "Instellingen" -- dat laatste is blad 3 van de
       console en gaat over de ACTIEVE PAGINA. Twee keer hetzelfde woord voor
       twee verschillende dingen, naast elkaar.

       Het paneel is wat een lid instellingen noemt, dus krijgt het die naam.
       De ander heet nu Pagina-instellingen, precies zoals zijn eigen blad zich
       al noemde (shared/command/werktafel.js). */
    RTGCommand.systeem(knop ? [{ naam: T('os.instellingen', 'Instellingen'), teken: 'instel',
      doe: function () { knop.click(); } }] : []);
  }
/* de app-regie van de boardroom: uitgezette apps verdwijnen van het springboard */
  bouw();

  /* De app-regie van de RTG-boardroom: apps die voor deze pas zijn uitgezet
     verdwijnen van het springboard (de server weigert hun API's sowieso al;
     dit houdt het scherm eerlijk). De sleutel hier is de functie-id op het
     schakelbord; alles wat niet genoemd wordt, blijft gewoon staan. */
  const REGIE = { spelen: 'spellen', podium: 'podium', flits: 'flits', theater: 'theater',
    wbw: 'wbw', passkeys: 'webauthn', ov: 'ov', clips: 'clips', office: 'kantoorpakket', vonk: 'vonk',
    mediaos: 'mediaos' };
  (function () {
    let tok = null; try { tok = localStorage.getItem('rtg_member_token'); } catch (e) {}
    if (!tok) return;
    fetch('/api/member/apps', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: '{}' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d || !Array.isArray(d.uit) || !d.uit.length) return;
        const uit = new Set(d.uit);
        let anders = false;
        for (const sleutel of Object.keys(REGIE))
          if (uit.has(REGIE[sleutel]) && LINKS[sleutel]) { delete LINKS[sleutel]; anders = true; }
        if (anders) bouw();
      }).catch(() => {});
    /* De RTG Rekening-tegel bestaat pas als de boardroom de rekeninglaag live heeft
       gezet: de registry-invoer ontbreekt standaard ('link:bank' in de indeling
       blijft dan onzichtbaar) en komt er hier bij zodra de bank online meldt. */
    fetch('/api/bank/overzicht', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: '{}' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d && d.online) { LINKS.bank = { naam: 'RTG Rekening', url: '/apps/geld.html#bank' }; bouw(); }
      }).catch(() => {});
  })();

  /* ============ De boardroom bestuurt het beginscherm ============
     Er is EEN boardroom, en die staat op de server (/api/member/boardroom,
     kern/lidboard). Daar zet je je functies aan en uit; de stand reist mee naar
     al je toestellen en de server handhaaft hem ook echt op de API.

     Dit scherm is daar de spiegel van, geen tweede lijstje. Zet je "Spelen" uit
     in je boardroom, dan verdwijnt de tegel hier -- niet omdat dit scherm een
     eigen voorkeur bijhoudt (dat was een lijstje in localStorage dat alleen op
     dit toestel bestond en de API niets deed), maar omdat de functie zelf uit
     staat. Een tegel die je wel kunt openen maar die daarna 403 geeft, is
     erger dan geen tegel.

     Wat er niet in BORDKAART staat, kent geen boardroom-schakelaar en staat er
     dus altijd: de mappen houden het scherm toch al rustig. */
  var BORDKAART = {
    'tab:reizen': 'reizen',
    'tab:salon': 'salon',
    'tab:bestellen': 'bestellen',
    'tab:betalen': 'pay',
    'tab:zorg': 'care',
    'link:spelen': 'spelen',
    'link:berichten': 'dm',
    'link:wallet': 'wallet'
  };
  var bordUit = null;   // Set met functie-id's die UIT staan; null = nog niet geladen
  function isAan(item) {
    if (!bordUit) return true;                 // nog niets geladen: niets verbergen
    var fid = BORDKAART[item];
    return !fid || !bordUit.has(fid);
  }
  function laadBoardroom() {
    var tok = null; try { tok = localStorage.getItem('rtg_member_token'); } catch (e) {}
    if (!tok) return;
    fetch('/api/member/boardroom', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: '{}' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.bord) return;
        var uit = new Set();
        (d.bord.categorieen || []).forEach(function (cat) {
          (cat.functies || []).forEach(function (fn) { if (!fn.aan) uit.add(fn.id); });
        });
        bordUit = uit;
        bouw();
      }).catch(function () { /* geen bord: dan staat alles gewoon aan */ });
  }
  laadBoardroom();
  // terug van de boardroom-app? Dan de verse stand ophalen.
  window.addEventListener('pageshow', function (e) { if (e.persisted) laadBoardroom(); });

  // De tegel in het bedieningspaneel opent de echte boardroom.
  var ccBoard = $('#osCcBoardroom');
  if (ccBoard) ccBoard.addEventListener('click', function () {
    sluitScrims();
    location.href = '/apps/boardroom.html';
  });

  /* ---------- Achtergrond (wallpaper) in het bedieningspaneel ---------- */
  var WALLEN = ['standaard', 'nacht', 'bordeaux', 'beeld'];
  function zetWall(naam) {
    if (WALLEN.indexOf(naam) < 0) naam = 'standaard';
    WALLEN.forEach(function (w) { app.classList.toggle('os-wall-' + w, w === naam); });
    try { localStorage.setItem('rtg_os_wall', naam); } catch (e) {}
    document.querySelectorAll('#osCcWp button').forEach(function (b) { b.classList.toggle('actief', b.dataset.wall === naam); });
  }
  document.querySelectorAll('#osCcWp button').forEach(function (b) { b.addEventListener('click', function () { zetWall(b.dataset.wall); }); });
  var wallStart = 'standaard'; try { wallStart = localStorage.getItem('rtg_os_wall') || 'standaard'; } catch (e) {}
  zetWall(wallStart);

  /* ---------- Samen: verhuisd naar het bedieningspaneel ----------
     De metgezel-laag (shared/metgezel.js) houdt op dit OS zijn zwevende
     Samen-knop weg en biedt window.RTGMetgezel.samen() aan; hier openen we die
     vanuit Instellingen. Rahul blijft gewoon in de buurt. */
  var ccSamen = $('#osCcSamen');
  if (ccSamen) ccSamen.addEventListener('click', function () {
    sluitScrims();
    if (window.RTGMetgezel && RTGMetgezel.samen) RTGMetgezel.samen();
    else bannerToon('', T('os.samen', 'Samen'), T('os.samen.straks', 'Samen is zo beschikbaar.'));
  });

  /* ---------- Scherm draaien en volledig scherm: verhuisd naar het paneel ----------
     De schermbeeld-laag (shared/schermbeeld.js) houdt op dit OS zijn zwevende
     pil weg en biedt window.RTGscherm aan; hier bedienen we die vanuit het
     bedieningspaneel. Volledig scherm vraagt om een gebruikersgebaar -- de tik
     op deze knop is dat gebaar, dus we roepen het meteen aan. */
  var ccDraai = $('#osCcDraai');
  if (ccDraai) ccDraai.addEventListener('click', function () { sluitScrims(); if (window.RTGscherm) RTGscherm.draai(); });
  var ccVol = $('#osCcVol');
  if (ccVol) ccVol.addEventListener('click', function () { if (window.RTGscherm) RTGscherm.volledig(); sluitScrims(); });

  /* Rand tot rand: de tablet laat zijn kader los en het OS wordt het hele
     scherm. Iets anders dan "volledig scherm" hierboven -- dat gaat over de
     browser, dit over het kader waar de app in staat. Op de telefoon is er
     geen kader, dus dan blijft de tegel weg (RTGVol.mogelijk). */
  var ccRand = $('#osCcRand');
  if (ccRand && window.RTGVol && RTGVol.mogelijk()) {
    ccRand.hidden = false;
    ccRand.classList.toggle('aan', RTGVol.aan());
    ccRand.addEventListener('click', function () {
      RTGVol.wissel();
      ccRand.classList.toggle('aan', RTGVol.aan());
    });
  }

  /* ---------- Now Playing: je muziek bedienen vanaf de ROS ----------
     De muziek-apps melden hun stand via de gedeelde speler-laag
     (shared/speler.js). Dit paneel toont die stand en stuurt bediening terug;
     speelt er live een app (in een tab of tweede scherm), dan gaat het direct,
     anders openen we RTG Sound om daar verder te spelen. */
  (function () {
    if (!window.RTGSpeler) return;
    var kaart = $('#osNu'), hoes = $('#osNuHoes'), titel = $('#osNuTitel'), sub = $('#osNuSub'), speelKnop = $('#osNuSpeel');
    if (!kaart) return;
    var nu = null;
    // in huisstijl getekende tekens (geen emoji): een noot voor de hoes en
    // een play/pauze die met de stand meewisselt
    var SVG_NOOT = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>';
    var SVG_PLAY = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
    var SVG_PAUZE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
    function toon(state) {
      nu = state;
      if (!state || !state.titel) { kaart.hidden = true; return; }
      kaart.hidden = false;
      if (hoes) hoes.innerHTML = SVG_NOOT;   // de hoes blijft de RTG-noot; geen emoji
      titel.textContent = state.titel;
      sub.textContent = (state.artiest || 'RTG Sound') + (state.station ? ' · ' + state.station : '');
      if (speelKnop) speelKnop.innerHTML = state.speelt ? SVG_PAUZE : SVG_PLAY;
    }
    function openSound(speel) {
      var q = '/apps/muziek.html';
      if (nu && nu.stationId) q += '?station=' + encodeURIComponent(nu.stationId) + '&seed=' + (nu.seed || 0) + '&speel=' + (speel === false ? '0' : '1');
      location.href = q;
    }
    function bedien(cmd) {
      var G = window.RTGGeluid, s = G && G.stand();
      if (s) {                          // de motor draait hier in de ROS zelf: stuur hem rechtstreeks
        if (cmd === 'next') G.volgende();
        else if (cmd === 'prev') G.opnieuw();
        else if (cmd === 'pause') G.pauze();
        else if (cmd === 'play') G.hervat();
        else s.speelt ? G.pauze() : G.hervat();
        return;
      }
      if (RTGSpeler.live()) { RTGSpeler.stuur(cmd); if (cmd === 'toggle' && nu) { nu.speelt = !nu.speelt; toon(nu); } return; }
      if (G && nu && nu.stationId && cmd !== 'pause') {  // niets live: pak de laatste stand hier weer op
        var off = nu.start ? Math.max(0, (Date.now() - nu.start) / 1000) : 0;
        G.speel(nu.stationId, nu.seed, off); return;
      }
      openSound(cmd !== 'pause');        // geen motor beschikbaar: open RTG Sound en speel daar verder
    }
    var vorige = $('#osNuVorige'), volgende = $('#osNuVolgende'), open = $('#osNuOpen');
    if (speelKnop) speelKnop.addEventListener('click', function () { bedien('toggle'); });
    if (vorige) vorige.addEventListener('click', function () { bedien('prev'); });
    if (volgende) volgende.addEventListener('click', function () { bedien('next'); });
    if (open) open.addEventListener('click', function () { openSound(true); });
    toon(RTGSpeler.opStand(toon));
    // de muziek loopt met je mee: stond ze aan, dan pakt ze op je eerste tik weer op
    if (window.RTGGeluid) RTGGeluid.hervatBijGebaar();/* Onderweg: de live reis */
  })();
})();
  /* ---------- Onderweg (live reis) ---------- */
  let liveData = null;
  let liveMode = 'driving';
  let simTimer = null;
  const RIDE_ST = { 'wacht-op-betaling':'awaiting payment', 'aangevraagd':'requested', 'geaccepteerd':'confirmed', 'onderweg':'on the way', 'aangekomen':'arrived', 'rijdt':'driving', 'aan-boord':'on board', 'gearriveerd':'completed', 'afgerond':'completed', 'geweigerd':'declined' };
  const tRide = s => (lang() === 'en' ? (RIDE_ST[s] || s) : s);

  async function renderLive(){
    if (!API.live){ $('#livePanel').innerHTML = ''; return; }
    try { liveData = (await API.call('/live/state')).live; }
    catch (e){ $('#livePanel').innerHTML = ''; return; }
    if (!liveData || !liveData.active){ stopSim(); renderLiveStart(); }
    else renderLivePanel();
  }

  function renderLiveStart(){
    const opts = suppliers.map(s => '<option value="' + s.code + '">' + s.name + ' (' + tType(s.typeLabel) + ')</option>').join('');
    const modes = [['walking','Lopen'],['driving','Rijden'],['flying','Vliegen']];
    $('#livePanel').innerHTML =
      '<div class="live-start">' +
        '<div class="lh">' + T('live.start.h','Ergens heen?') + '</div>' +
        '<div class="ld">' + T('live.start.d','Zet uw reis live. Uw partners, uw taxi, het restaurant, zien waar u bent en zorgen dat alles klaarstaat wanneer u aankomt. Altijd op codenaam, nooit op naam.') + '</div>' +
        '<div class="live-dest-row"><select id="liveDest">' + opts + '</select></div>' +
        '<div class="live-mode">' + modes.map(m => '<button data-mode="' + m[0] + '"' + (m[0]===liveMode?' class="on"':'') + '>' + T('live.mode.'+m[0], m[1]) + '</button>').join('') + '</div>' +
        '<button class="live-go" id="liveGo">' + T('live.go','Start onderweg') + '</button>' +
        '<button class="rahul-leeg-knop h-mt45" data-rahul-leeg="Boek een rit voor me: vraag waar ik heen wil en regel het vervoer">' + T('live.rahulrit','Laat Rahul een rit boeken') + '</button>' +
        '<button class="live-go" id="liveDeel" style="margin-top:0.5rem;background:none;border:1px solid var(--line);color:var(--txt);">' + T('live.deel','Deel mijn live locatie met deze zaak') + '</button>' +
        '<div style="margin-top:0.5rem;font-size:0.62rem;color:var(--soft);line-height:1.5;">' + T('live.deel.s','Alleen deze zaak ziet dan waar u bent, tot de zaak het niet meer nodig heeft of u het zelf stopt.') + '</div>' +
      '</div>';
/* het live-paneel: van modus wisselen */
    $('#livePanel').querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      liveMode = b.dataset.mode;
      $('#livePanel').querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x.dataset.mode === liveMode));
    }));
    $('#liveGo').addEventListener('click', startLive);
    const ld = $('#liveDeel');
    if (ld) ld.addEventListener('click', async () => {
      try {
        const r = await API.call('/locatie/deel', { supplierCode: $('#liveDest').value });
        toast('' + r.deel.supplierName + ' ' + T('live.deelok','kijkt nu met u mee, tot het niet meer nodig is.'));
        renderZorg();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- Toren 3: RTG Shared Assets ----------
     Altijd 300 tickets per object; een ticket is 24 uur per jaar, tien jaar
     lang. Access loopt af, Asset heeft restwaarde en stapt uit via een Tik. */
  async function renderAssets(){
    const el = $('#assetsWrap'); if (!el) return;
    if (!API.live){ el.innerHTML = ''; return; }
    let d, mijn;
    try {
      d = await API.call('/assets');
      mijn = (await API.call('/asset/mijn')).posities || [];
    } catch(e){ el.innerHTML = ''; return; }
    const posVan = id => mijn.find(p => p.assetId === id);
    el.innerHTML = d.assets.map(a => {
      const p = posVan(a.id);
      const vol = a.beschikbaar === 0;
      return '<div class="live-start h-mt80">' +
        '<div class="lh">' +RTGGlyf.tekst(a.icon)+ ' ' + esc(a.naam) + '</div>' +
        '<div class="ld">' + esc(a.beschrijving) + '<br>' + esc(a.waar) + ' · ' + T('as.waarde','objectwaarde') + ' ' + eur(a.waarde) + '</div>' +
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.55rem;font-size:0.72rem;color:var(--soft);">' +
          '<span style="border:1px solid var(--line);border-radius:0;padding:0.2rem 0.6rem;">' + a.totaal + ' ' + T('as.tickets','tickets') + ' · ' + (vol ? T('as.vol','uitverkocht') : a.beschikbaar + ' ' + T('as.vrij','beschikbaar')) + '</span>' +
          '<span style="border:1px solid var(--line);border-radius:0;padding:0.2rem 0.6rem;">1 ' + T('as.ticket','ticket') + ' = 24 ' + T('as.uur','uur per jaar') + ' · ' + d.regels.jaren + ' ' + T('as.jaar','jaar') + '</span>' +
          '<span style="border:1px solid var(--line);border-radius:0;padding:0.2rem 0.6rem;">' + T('as.tw','ticketwaarde nu') + ' ' + eur(a.ticketWaarde) + '</span>' +
        '</div>' +
        (p ? '<div style="margin-top:0.7rem;border:1px solid var(--gold-soft,rgba(201,154,46,0.4));border-radius:0;padding:0.6rem 0.75rem;font-size:0.78rem;">' +
            '<b>' + T('as.mijn','Mijn positie') + ':</b> ' + p.tickets + ' ' + T('as.tickets','tickets') + ' (' + p.access + ' Access · ' + p.asset + ' Asset)' + (p.tickets ? ' · ' +
            '<b style="color:var(--gold-bright,#C99A2E);">' + p.dagenTegoed + '</b> ' + T('as.dagen','x 24 uur over dit jaar') + ' · ' + T('as.geldig','geldig tot') + ' ' + p.vervaltOp : '') +
            (p.asset ? '<br>' + T('as.uitstapw','Uitstapwaarde vandaag') + ': <b>' + eur(p.uitstapWaarde) + '</b>' : '') +
            ((p.terugkoopOnderweg||[]).length ? '<br>' + T('as.tkw','Terugkoop onderweg') + ': ' + p.terugkoopOnderweg.map(v => eur(v.waarde) + ' ' + T('as.uiterlijk','uiterlijk') + ' ' + v.uiterlijk).join(', ') : '') +
            (p.gepland.length ? '<br>' + T('as.gepland','Gepland') + ': ' + p.gepland.join(', ') : '') +
            '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-top:0.5rem;">' +
              (p.tickets ? '<input type="date" data-asdatum="' + a.id + '" min="' + new Date().toISOString().slice(0,10) + '" style="flex:1;min-width:130px;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.45rem 0.6rem;font-size:0.78rem;color:var(--txt);" aria-label="' + T('as.dag','Kies uw dag') + '">' +
              '<button class="mo-code js-asboek" data-id="' + a.id + '">' + T('as.boek','Boek mijn 24 uur') + '</button>' : '') +
              (p.asset ? '<button class="mo-code js-asuit" data-id="' + a.id + '" data-tid="' + p.assetTicketIds[0] + '" data-w="' + p.ticketWaarde + '">' + T('as.uitstap','Stap uit (1 ticket)') + '</button>' : '') +
              ((p.herroepbaar||[]).length ? '<button class="mo-code js-asherroep" data-tid="' + p.herroepbaar[0].id + '" data-p="' + p.herroepbaar[0].prijs + '">↩ ' + T('as.herroep','Herroep (14 dgn)') + '</button>' : '') +
            '</div></div>' : '') +
        (vol
          ? '<div style="margin-top:0.75rem;font-size:0.74rem;color:var(--soft);">' + T('as.volh','De pool is vol.') + ' ' + (a.wachtenden ? a.wachtenden + ' ' + T('as.wachten','op de wachtlijst.') : '') + '</div>' +
            (a.opWachtlijst
              ? '<div style="margin-top:0.5rem;font-size:0.74rem;color:var(--gold-bright,#C99A2E);">✓ ' + T('as.opwl','U staat op de wachtlijst; bij de eerstvolgende uitstapper bent u aan de beurt.') + '</div>'
              : '<button class="live-go js-aswacht h-mt50" data-id="' + a.id + '">' + T('as.wachtknop','Zet mij op de wachtlijst') + '</button>')
          : '<div style="margin-top:0.75rem;font-size:0.72rem;color:var(--soft);line-height:1.6;">' +
            '<b style="color:var(--txt);">Access</b> · ' + eur(a.prijsAccess) + ' · ' + T('as.access.s','dienstenvoucher: alleen het gebruik (25% van de ticketwaarde). Teller reset elk jaar, na tien jaar is het klaar.') + '<br>' +
            '<b style="color:var(--txt);">Asset</b> · ' + eur(a.prijsAsset) + ' · ' + T('as.asset.s','deelnemingsbewijs in') + ' ' + esc(a.entiteit) + ': ' + T('as.asset.s2','zelfde gebruik, plus uw aandeel in de restwaarde. Uitstappen via de wachtlijst, anders koopt RTG terug binnen 30 dagen.') + '<br>' +
            '<span style="font-size:0.66rem;">' + T('as.taxatie','Servicefee') + ' ' + eur(a.serviceFee) + '/' + T('as.perjaar','jaar per ticket') + ' · ' + T('as.bedenk','14 dagen bedenktijd met volledige terugbetaling') + ' · ' + T('as.beweegt','prijzen en uitstapwaarde bewegen mee met de taxatie.') + '</span></div>' +
          '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-top:0.5rem;">' +
            '<input type="number" min="1" max="10" value="1" data-asaantal="' + a.id + '" style="width:64px;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.45rem 0.6rem;font-size:0.8rem;color:var(--txt);" aria-label="aantal">' +
            '<button class="live-go js-askoop" data-id="' + a.id + '" data-smaak="access" style="flex:1;margin-top:0;">Access</button>' +
            '<button class="live-go js-askoop" data-id="' + a.id + '" data-smaak="asset" data-ent="' + esc(a.entiteit) + '" data-fee="' + a.serviceFee + '" style="flex:1;margin-top:0;background:var(--gold-bright,#C99A2E);">Asset</button>' +
          '</div>')+
        '<button class="mo-code js-asdoc h-mt50" data-id="' + a.id + '">' + T('as.doc','Essentiele informatie') + '</button>' +
        '<div data-asdocuit="' + a.id + '" style="display:none;margin-top:0.5rem;font-size:0.7rem;color:var(--soft);line-height:1.6;border:1px solid var(--line);border-radius:0;padding:0.6rem 0.75rem;"></div>' +
      '</div>';
    }).join('');
    el.querySelectorAll('.js-askoop').forEach(b => b.addEventListener('click', async () => {
      const aantal = parseInt((el.querySelector('[data-asaantal="' + b.dataset.id + '"]') || {}).value, 10) || 1;
      const body = { assetId: b.dataset.id, smaak: b.dataset.smaak, aantal };
      if (b.dataset.smaak === 'asset'){
        // deelnemingsbewijs: uitdrukkelijk akkoord na de kerninformatie
        if (!window.confirm(T('as.akk1','U koopt een deelnemingsbewijs in') + ' ' + b.dataset.ent + '.\n\n' +
          T('as.akk2','De restwaarde beweegt mee met de taxatie en kan dalen. Jaarlijkse servicefee:') + ' ' + eur(Number(b.dataset.fee)) + ' ' + T('as.akk3','per ticket. Uitstappen loopt eerst via de wachtlijst; anders koopt RTG terug binnen 30 dagen. U heeft 14 dagen bedenktijd met volledige terugbetaling.') + '\n\n' +
          T('as.akk4','Gaat u akkoord?'))) return;
        body.akkoord = true;
      }
      try {
        const r = await API.call('/asset/koop', body);
        toast('' + r.tickets.length + ' ticket(s) · ' + eur(r.totaalPrijs) + '. ' + T('as.welkom','Welkom in de pool.'));
        renderAssets();
      } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-aswacht').forEach(b => b.addEventListener('click', async () => {
      try { const r = await API.call('/asset/wachtlijst', { assetId: b.dataset.id }); toast('' + T('as.wlok','U staat op de wachtlijst, positie') + ' ' + r.positie + '.'); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
/* een asset herroepen binnen de bedenktijd */
    el.querySelectorAll('.js-asherroep').forEach(b => b.addEventListener('click', async () => {
      if (!window.confirm(T('as.herroepvraag','Herroepen binnen de bedenktijd? U krijgt de volledige koopsom') + ' (' + eur(Number(b.dataset.p)) + ') ' + T('as.herroepvraag2','terug via een Tik.'))) return;
      try { const r = await API.call('/asset/herroep', { ticketId: b.dataset.tid }); toast('↩ ' + T('as.herroepok','Herroepen. De Tik van') + ' ' + eur(r.terug) + ' ' + T('as.uitok2','staat in uw tegoed.')); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-asdoc').forEach(b => b.addEventListener('click', async () => {
      const uit = el.querySelector('[data-asdocuit="' + b.dataset.id + '"]');
      if (!uit) return;
      if (uit.style.display !== 'none'){ uit.style.display = 'none'; return; }
      try {
        const d = (await API.call('/asset/document', { assetId: b.dataset.id })).document;
        uit.innerHTML = '<b style="color:var(--txt);">' + esc(d.object) + '</b> · ' + esc(d.entiteit) + '<br>' +
          esc(d.gebruik) + '<br><b>Access:</b> ' + esc(d.smaken.access.aard) + '<br><b>Asset:</b> ' + esc(d.smaken.asset.aard) + '<br>' +
          esc(d.kosten.serviceFee) + '<br>' + esc(d.kosten.overdracht) + '<br><b>' + T('as.doc.uit','Uitstappen') + ':</b> ' + esc(d.uitstappen) + '<br><b>' + T('as.doc.bed','Bedenktijd') + ':</b> ' + esc(d.bedenktijd) + '<br><b>' + T('as.doc.risico','Risico') + ':</b> ' + esc(d.risico);
        uit.style.display = '';
      } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-asboek').forEach(b => b.addEventListener('click', async () => {
      const datum = (el.querySelector('[data-asdatum="' + b.dataset.id + '"]') || {}).value;
      if (!datum){ toast(T('as.kiesdag','Kies eerst een dag.')); return; }
      try { const r = await API.call('/asset/gebruik', { assetId: b.dataset.id, datum }); toast('' + datum + ' ' + T('as.vast','staat vast.') + ' ' + r.dagenTegoed + ' ' + T('as.dagenover','x 24 uur over dit jaar.')); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-asuit').forEach(b => b.addEventListener('click', async () => {
      if (!window.confirm(T('as.uitvraag','Uitstappen? RTG betaalt de actuele ticketwaarde') + ' (' + eur(Number(b.dataset.w)) + ') ' + T('as.uitvraag2','uit via een Tik en het ticket gaat terug in de pool.'))) return;
      try { const r = await API.call('/asset/uitstap', { ticketId: b.dataset.tid }); toast('' + T('as.uitok','Uitgestapt. De Tik van') + ' ' + eur(r.waarde) + ' ' + T('as.uitok2','staat in uw tegoed.')); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- het brein van Rahul: geheugen en seintjes ----------
     Het gesprek zelf loopt via de gewone Rahul-chat op de AI-tab; deze
     kaart toont rustig wat hij weet (wisbaar) en wat hij zelf ziet. */
  let fluisterSyncAt = 0;
  async function renderFluister(){
    const el = $('#fluisterWrap'); if (!el) return;
    if (!API.live){ el.innerHTML = ''; return; }
    // de inklap-laag deelt (alleen) de gebruikstellers, zodat Rahul leert
    if (window.FocusUI && Date.now() - fluisterSyncAt > 60000){
      fluisterSyncAt = Date.now();
      API.call('/fluister/focus', { scores: FocusUI.scores() }).catch(() => {});
    }
    let prof;
    try { prof = await API.call('/fluister/profiel'); } catch(e){ el.innerHTML = ''; return; }
    // de voorspeller: RTG leert uw ritme en zet de beste verwachting klaar
    let vw = null;
    try { vw = await API.call('/voorspel'); } catch(e){}
    const v = vw && (vw.verwachtingen || [])[0];
    // synergie-pakketten: aanbod dat zaken samen hebben samengesteld
    let pk = [];
    try { pk = ((await API.call('/pakketten')).pakketten || []).slice(0, 2); } catch(e){}
    // sparren: gedachten die Rahul heeft geparkeerd om er op een rustig moment
    // op terug te komen
    let sparLijst = [];
    try { sparLijst = ((await API.call('/spar/lijst', {})).spar) || []; } catch(e){}
    el.innerHTML =
      (v
        ? '<div class="live-start" style="margin-bottom:0.75rem;">' +
            '<div class="lh">' + T('vs.h','Rahul verwacht') + '</div>' +
            '<div class="ld">' + esc(v.wat) + ' · ' + esc(v.waarom) + '. ' +
              T('vs.d','Klopt het niet, dan negeert u dit gewoon; Rahul leert vanzelf bij.') + '</div>' +
            '<button class="chip js-vsdoe h-mt50">' + T('vs.doe','Laat Rahul het klaarzetten') + '</button>' +
          '</div>'
        : '') +
      (pk.length
        ? '<div class="live-start" style="margin-bottom:0.75rem;">' +
            '<div class="lh">' + T('pk.h','Pakketten van onze huizen') + '</div>' +
            pk.map(p => '<div class="h-mt45">' +
              '<div style="font-size:0.85rem;"><b>' + esc(p.naam) + '</b> · € ' + (p.prijsCenten/100).toFixed(2).replace('.', ',') + '</div>' +
              '<div style="font-size:0.72rem;color:var(--soft);">' + p.zaken.map(esc).join(' + ') +
                (p.omschrijving ? ' · ' + esc(p.omschrijving) : '') + '</div>' +
              '<button class="chip js-pkboek h-mt35" data-pk="' + esc(p.id) + '" data-pknaam="' + esc(p.naam) + '" data-pkprijs="' + p.prijsCenten + '">' + T('pk.boek','Boek dit pakket') + '</button></div>').join('') +
          '</div>'
        : '') +
      '<div class="live-start" style="margin-bottom:0.75rem;">' +
        '<div class="lh">' + T('fl.h','Wat Rahul weet en ziet') + '</div>' +
        '<div class="ld">' + T('fl.d','Hij onthoudt wat u vertelt ("onthoud dat..."), leert van wat u gebruikt en regelt alles in de chat hieronder: zoeken, reserveren, bestellen en afrekenen, uw 24 uur, een Tik of betaalverzoek. Vraag "wat kun je" voor het hele overzicht; geld gaat nooit zonder uw "ja" de deur uit.') + '</div>' +
        ((prof.seintjes || []).length
          ? '<div style="margin-top:0.55rem;border:1px solid var(--line);border-radius:0;padding:0.55rem 0.7rem;">' +
              '<div style="font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">' + T('fl.sein','Rahul ziet') + '</div>' +
              prof.seintjes.map(x => '<div style="margin-top:0.25rem;font-size:0.76rem;line-height:1.45;">' + esc(x.icoon) + ' ' + esc(x.tekst) + '</div>').join('') + '</div>'
          : '') +
        (prof.weetjes.length
          ? '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.5rem;">' + prof.weetjes.map((w, i) =>
              '<span style="display:inline-flex;align-items:center;gap:0.35rem;border:1px solid var(--line);border-radius:0;padding:0.25rem 0.6rem;font-size:0.68rem;color:var(--txt);">' + esc(w.tekst) +
              '<button class="js-flweg" data-i="' + i + '" aria-label="' + T('fl.weg','vergeet dit') + '" style="background:none;border:none;color:var(--soft);cursor:pointer;font-size:0.75rem;padding:0;">✕</button></span>').join('') + '</div>'
          : '<div style="margin-top:0.5rem;font-size:0.68rem;color:var(--soft);">' + T('fl.leeg','Nog geen weetjes. Zeg bijvoorbeeld: "onthoud dat ik cava drink, nooit rode wijn".') + '</div>') +
        (prof.top.length ? '<div style="margin-top:0.5rem;font-size:0.64rem;color:var(--soft);">' + T('fl.top','Ik zie dat u het meest werkt met') + ': ' + prof.top.map(esc).join(', ') + '.</div>' : '') +
        // sparren: samen een idee beter maken; Rahul komt er op een rustig moment op terug
        sparBlokHtml(sparLijst) +
      '</div>';
    el.querySelectorAll('.js-flweg').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/fluister/vergeet', { wat: Number(b.dataset.i) }); renderFluister(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-vsdoe').forEach(b => b.addEventListener('click', () => {
      const tegel = document.querySelector('.os-app[data-tab="ai"]'); if (tegel) tegel.click();
      // `ask` bestond nooit; RTGVraag is de echte helper (app-main-27.js)
      if (window.RTGVraag) RTGVraag(v.vraag);
    }));
    bindSparBlok(el);
    el.querySelectorAll('.js-pkboek').forEach(b => b.addEventListener('click', async () => {
      const prijs = '€ ' + (Number(b.dataset.pkprijs)/100).toFixed(2).replace('.', ',');
      if (!window.confirm(T('pk.zeker','Pakket boeken voor') + ' ' + prijs + '? ' + T('pk.zeker2','Het bedrag gaat direct van uw RTG Pay-saldo.'))) return;
      try {
        await API.call('/pakket/koop', { id: b.dataset.pk, idem: RTGIdem('pk') });
        toast('' + T('pk.ok','Geboekt. De zaken weten ervan.'));
        renderFluister();
      } catch(e){ toast(e.message); }
    }));
  }

  /* ---------- de zorgvolle keten: zorgprofiel + wie kijkt mee ---------- */
  async function renderZorg(){
    const el = $('#zorgPanel'); if (!el) return;
    if (!API.live){ el.innerHTML = ''; return; }
    let zorg, delen;
    try {
      zorg = (await API.call('/zorgprofiel')).zorg;
      delen = await API.call('/locatie/mijn');
    } catch(e){ el.innerHTML = ''; return; }
/* mijn zorgprofiel */
    el.innerHTML =
      '<div class="live-start h-mt80">' +
        '<div class="lh">' + T('zorg.h','Mijn zorgprofiel') + '</div>' +
        '<div class="ld">' + T('zorg.d','Allergenen en aandachtspunten reizen automatisch mee met uw bestellingen en verblijven, alleen als u delen aanzet. De keuken en de receptie weten het dan meteen.') + '</div>' +
        '<input id="zAll" placeholder="' + T('zorg.all','Allergenen, gescheiden door komma (bijv. noten, schaaldieren)') + '" value="' + esc((zorg.allergenen || []).join(', ')) + '" style="width:100%;margin-top:0.5rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);">' +
        '<input id="zDieet" placeholder="' + T('zorg.dieet','Dieet (bijv. vegetarisch, halal)') + '" value="' + esc(zorg.dieet || '') + '" style="width:100%;margin-top:0.4rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);">' +
        '<input id="zMed" placeholder="' + T('zorg.med','Medische aandachtspunten (bijv. diabetes, rolstoel)') + '" value="' + esc(zorg.medisch || '') + '" style="width:100%;margin-top:0.4rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);">' +
        '<label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.55rem;font-size:0.74rem;color:var(--txt);"><input type="checkbox" id="zDelen"' + (zorg.delen ? ' checked' : '') + '> ' + T('zorg.delen','Deel dit automatisch met zaken waar ik bestel of verblijf') + '</label>' +
        '<button class="live-go h-mt55" id="zOpslaan">' + T('zorg.opslaan','Bewaar zorgprofiel') + '</button>' +
        ((delen.actief || []).length
          ? '<div style="margin-top:0.75rem;font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">' + T('zorg.kijkt','Kijkt live met mij mee') + '</div>' +
            delen.actief.map(d => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.5rem;font-size:0.78rem;"><span><b>' + esc(d.supplierName) + '</b> · ' + T('zorg.sinds','sinds') + ' ' + String(d.at).slice(11, 16) + '</span><button class="mo-code js-zstop" data-id="' + d.id + '">' + T('zorg.stop','Stop delen') + '</button></div>').join('')
          : '<div style="margin-top:0.75rem;font-size:0.68rem;color:var(--soft);">' + T('zorg.niemand','Er kijkt nu niemand live met u mee.') + '</div>') +
      '</div>';
    $('#zOpslaan').addEventListener('click', async () => {
      try {
        await API.call('/zorgprofiel/zet', { allergenen: $('#zAll').value, dieet: $('#zDieet').value, medisch: $('#zMed').value, delen: $('#zDelen').checked });
        toast('' + T('zorg.bewaard','Zorgprofiel bewaard.'));
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('.js-zstop').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/locatie/stop', { id: b.dataset.id }); toast('' + T('zorg.gestopt','Delen gestopt.')); renderZorg(); }
      catch(e){ toast(e.message); }
    }));
  }

  async function startLive(){
    const destCode = $('#liveDest').value;
    try { liveData = (await API.call('/live/start', { destCode, mode: liveMode })).live; toast(T('live.started','U bent onderweg. Uw partners zijn op de hoogte.')); renderLivePanel(); }
    catch (e){ toast(e.message); }
  }

  // projecteer lat/lng-punten in het 130px-kaartje (percentage-coördinaten)
  function projectPoints(pts){
    if (!pts.length) return [];
    const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
    let minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    let dLat = (maxLat - minLat) || 0.002, dLng = (maxLng - minLng) || 0.002;
    minLat -= dLat*0.2; maxLat += dLat*0.2; minLng -= dLng*0.2; maxLng += dLng*0.2;
    dLat = maxLat - minLat; dLng = maxLng - minLng;
    return pts.map(p => ({ x: ((p.lng - minLng)/dLng)*100, y: (1 - (p.lat - minLat)/dLat)*100 }));
  }

  function renderLivePanel(){
    const L = liveData; if (!L) return;
    const dest = L.dest;
    let head, sub = '';
    if (L.arrived && dest){ head = T('live.arrivedh','U bent <em>gearriveerd</em>'); sub = dest.name; }
    else if (dest){ head = T('live.headingto','Onderweg naar') + ' <em>' + dest.name + '</em>'; sub = dest.etaMin != null ? T('live.aankomst','aankomst over ~') + dest.etaMin + ' ' + T('live.min','min') : ''; }
    else { head = T('live.moving','U bent <em>onderweg</em>'); }

    const pts = [];
    if (L.me) pts.push({ lat: L.me.lat, lng: L.me.lng, me: true });
    L.partners.forEach(p => { if (p.loc) pts.push({ lat: p.loc.lat, lng: p.loc.lng, icon: p.icon, name: p.name }); });
    const proj = projectPoints(pts);
    const markers = proj.map((pt,i) => {
      const s = pts[i];
      return '<div class="mk' + (s.me?' me':'') + '" style="left:' + pt.x.toFixed(1) + '%;top:' + pt.y.toFixed(1) + '%;">' +
        (s.me ? '<div class="pin"></div>' : '<div>' +RTGGlyf.tekst(s.icon)+ '</div>') +
        '<div class="lbl">' + (s.me ? T('live.you','U') : s.name) + '</div></div>';
    }).join('');

    const partners = L.partners.map(p => {
      const isVeh = p.type === 'taxi' || p.type === 'jet';
      let eta;
      if (p.ride && isVeh){
        eta = p.taxiEtaMin != null && p.ride.status !== 'gearriveerd'
          ? '<div class="eta"><div class="n">' + p.taxiEtaMin + '</div><div class="u">' + T('live.mintoyou','min naar u') + '</div></div>'
          : '<div class="eta"><div class="n" style="font-size:0.9rem;">' + tRide(p.ride.status) + '</div></div>';
      } else if (p.isDest && L.arrived){
        eta = '<div class="eta arr"><div class="n">✓ ' + T('live.here','ter plaatse') + '</div></div>';
      } else {
        eta = p.etaMin != null ? '<div class="eta"><div class="n">' + p.etaMin + '</div><div class="u">' + T('live.minaway','min heen') + '</div></div>' : '';
      }
      let line2 = tType(p.typeLabel);
      if (p.ride){
        line2 += ' · ' + T('live.ride','rit') + ' ' + tRide(p.ride.status);
        const extra = [];
        if (p.ride.driver) extra.push('' + p.ride.driver + (p.ride.vehicle ? ' · ' + p.ride.vehicle : ''));
        if (p.ride.quote) extra.push(T('live.vast','vaste nettoprijs') + ' ' + eur(p.ride.quote));
        if (extra.length) line2 += '<br>' + extra.join(' · ');
        // betaling achteraf: de zaak liet de rit direct rijden; afrekenen kan nu
        if (!p.ride.paid && p.ride.quote && p.ride.status !== 'wacht-op-betaling')
          line2 += '<br><button class="js-rpay" data-rref="' + p.ride.ref + '" data-rq="' + p.ride.quote + '" style="margin-top:0.35rem;background:none;border:1px solid var(--gold);color:var(--rtg-leesgoud,var(--gold));border-radius:0;padding:0.3rem 0.8rem;font-size:0.7rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('live.betaalrit','Betaal de rit') + ' · ' + eur(p.ride.quote) + '</button>';
      }
      else if (p.order) line2 += ' · ' + p.order.items + ' ' + T('app.items','item(s)') + ', ' + tStatus(p.order.status);
      return '<div class="live-partner"><span class="pic">' +RTGGlyf.tekst(p.icon)+ '</span><div class="pt"><b>' + p.name + '</b><span>' + line2 + '</span></div>' + eta + '</div>';
    }).join('');

    let preorder = '';
    const destSup = dest ? suppliers.find(s => s.code === dest.code) : null;
    if (dest && destSup && destSup.hasMenu && !dest.order && !L.arrived){
      preorder = '<div class="live-preorder"><span>' + T('live.preorder','Bestel vast vooruit, dan staat het klaar als u aankomt.') + '</span><button id="livePre">' + T('live.preorderbtn','Vooruit bestellen') + '</button></div>';
    }

    const hasVeh = L.partners.some(p => p.type === 'taxi' || p.type === 'jet');
    const canDoor = L.arrived && dest && dest.hasDoors;
    const acts = '<div class="live-acts">' +
      (canDoor ? '<button class="prim glowbtn" id="liveDoor">' + T('live.door','Open de deur') + '</button>' : '') +
      '<button class="sec" id="liveSim">' + T('live.simulate','Simuleer rit') + '</button>' +
      (hasVeh ? '' : '<button class="sec" id="liveTaxi">' + T('live.taxi','Vraag een taxi') + '</button>') +
      (canDoor ? '' : '<button class="prim" id="liveShare">' + T('live.share','Deel mijn locatie') + '</button>') +
      (canDoor ? '<button class="sec" id="liveShare">' + T('live.share','Deel mijn locatie') + '</button>' : '') +
    '</div>';

    $('#livePanel').innerHTML =
      '<div class="live-panel">' +
        '<div class="live-top"><span class="live-badge"><span class="dot"></span>' + T('live.badge','Live onderweg') + '</span><button class="live-stop" id="liveStop">' + T('live.stop','Stop') + '</button></div>' +
        '<div class="live-headline">' + head + '</div>' + (sub ? '<div class="live-sub">' + sub + '</div>' : '') +
        '<div class="live-map">' + markers + '</div>' +
        preorder +
        '<div class="h-mt50">' + partners + '</div>' +
        acts +
      '</div>';

    $('#liveStop').addEventListener('click', stopLive);
    $('#liveSim').addEventListener('click', simulateRide);
/* betalen met Face ID vanuit een rekeningregel */
    document.querySelectorAll('.js-rpay').forEach(b => b.addEventListener('click', () => {
      const bedrag = eur(Number(b.dataset.rq));
      payWithFaceId(bedrag, async () => {
        await API.call('/ride/pay', { ref: b.dataset.rref });
      }, { message: () => T('live.ritbetaald','Rit betaald en definitief:') + ' ' + bedrag, after: () => renderLive() });
    }));
    $('#liveShare').addEventListener('click', shareMyLocation);
    const tx = $('#liveTaxi'); if (tx) tx.addEventListener('click', requestTaxi);
    const pre = $('#livePre'); if (pre) pre.addEventListener('click', () => { if (dest) openMenu(dest.code); });
    const dr = $('#liveDoor'); if (dr) dr.addEventListener('click', async () => {
      try { const d = await API.call('/live/door'); toast('' + d.door.name + ' ' + T('live.dooropen','is open. Vergrendelt zichzelf na') + ' ' + d.door.relockSec + ' ' + T('live.sec','seconden.')); }
      catch(e){ toast(e.message); }
    });
  }

  async function stopLive(){
    stopSim();
    try { await API.call('/live/stop'); } catch (e) {}
    liveData = null; toast(T('live.stopped','Reis gestopt.')); renderLive();
  }

  function requestTaxi(){
    const veh = suppliers.find(s => s.type === 'taxi') || suppliers.find(s => s.type === 'jet');
    if (!veh){ toast(T('live.notaxi','Geen vervoerspartner beschikbaar op deze bestemming.')); return; }
    // paspoortleeftijd: privejets boek je vanaf 18 jaar
    if (veh.type === 'jet' && user.leeftijdsgroep === '15-17'){ toast(T('live.jet18','Privejets boek je vanaf 18 jaar. Een taxi regelen we graag voor je.')); return; }
    // nette aanvraag: personen, bagage en tijdstip; de prijs komt direct terug
    $('#rideSup').textContent = veh.name;
    $('#ride-sheet').dataset.code = veh.code;
    $('#ride-sheet').classList.add('open'); $('#ride-scrim').classList.add('open');
  }
  async function verstuurRit(){
    const code = $('#ride-sheet').dataset.code;
    const wanneer = $('#ridePlan').value === 'later' ? ($('#rideTijd').value ? T('live.om','om') + ' ' + $('#rideTijd').value : 'Zo snel mogelijk') : 'Zo snel mogelijk';
    try {
      const d = await API.call('/ride/request', {
        supplierCode: code,
        toCode: (liveData && liveData.destCode) || undefined,
        passengers: Number($('#ridePax').value) || 1,
        luggage: Number($('#rideBag').value) || 0,
        when: wanneer,
        date: $('#ridePlan').value === 'later' ? $('#rideDatum').value : '',
        time: $('#ridePlan').value === 'later' ? $('#rideTijd').value : '',
        note: $('#rideNote').value.trim()
      });
      $('#ride-sheet').classList.remove('open'); $('#ride-scrim').classList.remove('open');
      if (d.ride && d.ride.status === 'wacht-op-betaling'){
        // betalen-eerst: pas na afrekenen gaat de aanvraag naar de vervoerder
        payWithFaceId(eur(d.ride.quote), async () => {
          await API.call('/ride/pay', { ref: d.ride.ref });
          return d.ride;
        }, { message: () => T('live.ritbetaald','Rit betaald en definitief:') + ' ' + eur(d.ride.quote), after: () => renderLive() });
      } else {
        toast('' + T('live.taxireq2','Rit aangevraagd.') + (d.ride && d.ride.quote ? ' ' + T('live.vast','vaste nettoprijs') + ': ' + eur(d.ride.quote) : ''));
        await renderLive();
      }
    } catch (e){ toast(e.message); }
  }

  function shareMyLocation(){
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(async pos => {
        try { liveData = (await API.call('/live/update', { lat: pos.coords.latitude, lng: pos.coords.longitude })).live; renderLivePanel(); toast(T('live.shared','Locatie gedeeld met uw partners.')); }
        catch (e){ toast(e.message); }
      }, () => toast(T('live.geodenied','Locatie niet beschikbaar. Vul de locatie handmatig in.')), { timeout: 4000 });
    } else toast(T('live.geono','Locatie is hier niet beschikbaar.'));
  }

  function stopSim(){ if (simTimer){ clearInterval(simTimer); simTimer = null; } }
  function simulateRide(){
    const L = liveData;
    if (!L || !L.me || !L.dest || !L.dest.loc){ toast(T('live.nosim','Kies eerst een bestemming.')); return; }
    stopSim();
    const start = { lat: L.me.lat, lng: L.me.lng };
    const end = { lat: L.dest.loc.lat, lng: L.dest.loc.lng };
    let step = 0; const N = 16;
    toast(T('live.simstart','Simulatie gestart, u nadert de bestemming.'));
    simTimer = setInterval(async () => {
      step++;
      const t = step / N;
      const lat = start.lat + (end.lat - start.lat) * t + (Math.random() - 0.5) * 0.0004;
      const lng = start.lng + (end.lng - start.lng) * t + (Math.random() - 0.5) * 0.0004;
      try { liveData = (await API.call('/live/update', { lat, lng })).live; renderLivePanel(); } catch (e) {}
      if (step >= N) stopSim();
    }, 900);
  }

  const FID_MINI = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 19 V13 a7 7 0 0 1 7-7 h6"/><path d="M45 6 h6 a7 7 0 0 1 7 7 v6"/><path d="M58 45 v6 a7 7 0 0 1-7 7 h-6"/><path d="M19 58 h-6 a7 7 0 0 1-7-7 v-6"/><circle cx="23.5" cy="26.5" r="3" fill="currentColor"/><circle cx="40.5" cy="26.5" r="3" fill="currentColor"/><path d="M32 26 v8.5 a2.2 2.2 0 0 1-2.2 2.2"/><path d="M23 42.5 a12.5 8.5 0 0 0 18 0"/></svg>';

  async function openMenu(code){
    let data;
    try { data = await API.call('/supplier/menu/get', { code }); }
    catch (e) { toast(e.message); return; }
    menuState = { supplier: data.supplier, menu: data.menu, alcohol: data.alcohol || null, qty: {}, note: '', tag: false, table: '', retail: null, retailMijn: null };
    // het eigen allergieprofiel: gerechten met een botsend allergeen worden in de
    // kaart meteen gemarkeerd (en de server keurt ze af bij het bestellen)
    try { menuState.allergenen = (((await API.call('/zorgprofiel', {})).zorg || {}).allergenen || []).map(a => String(a).toLowerCase()); } catch(e){ menuState.allergenen = []; }
    $('#msName').textContent = data.supplier.name;
    $('#msMeta').textContent = tType(data.supplier.typeLabel) + ' · ' + data.supplier.city + (data.supplier.loc ? ' · ' + data.supplier.loc.label : '');
    // mode-/retailpartner: haal de catalogus en de eigen apart/styling erbij
    if ((data.supplier.caps || []).includes('retail')){
      try { menuState.retail = await API.call('/retail/catalogus', { supplierCode: code }); } catch(e){}
      try { menuState.retailMijn = await API.call('/retail/mijn', {}); } catch(e){}
      try { menuState.modeBezorg = (await API.call('/mode/bezorg/mijn', {})).bezorgingen || []; } catch(e){ menuState.modeBezorg = []; }
    }
    renderMenuSheet();
    $('#menu-sheet').classList.add('open');
    $('#menu-scrim').classList.add('open');
  }

  function renderMenuSheet(){
    const m = menuState.menu;
    const s = menuState.supplier;
    // fotostrip + kamers van de partner (hotels, of elke partner met foto's)
    let head = '';
    // rating + favoriet-hart + tafel reserveren (de ervaring-laag)
    head += '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.2rem 0 0.6rem;">' +
      (s.rating ? '<span style="font-size:0.8rem;"><b>' + s.rating.score + '</b> <span style="color:var(--soft);font-size:0.7rem;">(' + s.rating.aantal + ')</span></span>' : '<span style="font-size:0.72rem;color:var(--soft);">' + T('erv.nogGeenReviews','Nog geen reviews') + '</span>') +
      '<button id="msFav" style="margin-left:auto;background:none;border:1px solid var(--line);border-radius:0;padding:0.35rem 0.8rem;font-size:0.85rem;" aria-label="' + T('fav.aria','Favoriet') + '">' + (s.favoriet ? '' + T('fav.bewaard','Bewaard') : '' + T('fav.bewaar','Bewaar')) + '</button></div>';
    if ((s.tableNames || []).length && s.reservationsOpen !== false){
      const morgen = new Date(Date.now() + 86400000).toISOString().slice(0,10);
      head += '<div class="ms-cat">' + T('erv.reserveer.h','Tafel reserveren') + '</div>' +
        '<div style="display:flex;gap:0.4rem;align-items:center;padding:0.2rem 0 0.9rem;flex-wrap:wrap;">' +
        '<input type="date" id="rsvDatum" value="' + morgen + '" min="' + new Date().toISOString().slice(0,10) + '" style="flex:2;min-width:120px;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.datum','Datum') + '">' +
        '<input type="time" id="rsvTijd" value="20:00" style="flex:1;min-width:84px;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.tijd','Tijd') + '">' +
        '<select id="rsvPers" style="flex:1;min-width:70px;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.5rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.personen','Personen') + '">' +
        [1,2,3,4,5,6,8,10].map(n => '<option' + (n===2?' selected':'') + '>' + n + '</option>').join('') + '</select>' +
        '<button class="vbtn" id="rsvGo">' + T('erv.reserveer','Reserveer') + '</button></div>';
    }
/* een verblijf tonen: foto's en kamers */
    if (s.photos && s.photos.length)
      head += '<div class="ms-photos">' + s.photos.map(p => '<img src="' + p + '" alt="">').join('') + '</div>';
    if (s.rooms && s.rooms.length){
      const inDatum = new Date(Date.now() + 86400000).toISOString().slice(0,10);
      const uitDatum = new Date(Date.now() + 3 * 86400000).toISOString().slice(0,10);
      head += '<div class="ms-cat">' + T('app.ms.rooms','Beschikbare kamers') + '</div>' +
        '<div style="display:flex;gap:0.4rem;align-items:center;padding:0.2rem 0 0.6rem;flex-wrap:wrap;">' +
        '<input type="date" id="vbAankomst" value="' + inDatum + '" min="' + new Date().toISOString().slice(0,10) + '" style="flex:1;min-width:120px;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('vb.aankomst','Aankomst') + '">' +
        '<input type="date" id="vbVertrek" value="' + uitDatum + '" min="' + inDatum + '" style="flex:1;min-width:120px;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('vb.vertrek','Vertrek') + '">' +
        '<select id="vbPers" style="flex:0 1 70px;min-width:64px;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.5rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.personen','Personen') + '">' +
        [1,2,3,4,6].map(n => '<option' + (n===2?' selected':'') + '>' + n + '</option>').join('') + '</select></div>' +
        s.rooms.map(r => '<div class="ms-room"><div class="rt"><b>' + r.name + '</b>' + (r.desc ? '<span>' + r.desc + '</span>' : '') + '</div>' +
          '<div class="rp" style="display:flex;align-items:center;gap:0.5rem;">' + eur(r.price) + ' <span style="font-size:0.62rem;color:var(--soft);">' + T('app.ms.pernight','p.n.') + '</span>' +
          '<button class="vbtn" data-vbboek="' + r.id + '">' + T('vb.boek','Boek') + '</button></div></div>').join('') +
        '<div style="margin:0.5rem 0 0.5rem;font-size:0.74rem;color:var(--soft);">' + T('app.ms.roomnote2','Tegen nettoprijs; het huis bevestigt uw verblijf en de rekening loopt op de kamer.') + '</div>' +
        // keyless: tijdens een ingecheckt verblijf is de telefoon de sleutel
        '<div style="display:flex;gap:0.5rem;padding-bottom:0.8rem;">' +
        '<button class="vbtn h-flex1" id="vbDeurKamer">' + T('vb.deurkamer','Open mijn kamerdeur') + '</button>' +
        '<button class="vbtn" id="vbDeurEntree" style="flex:1;background:var(--card);color:var(--txt);border:1px solid var(--line);">' + T('vb.deurentree','Open de entree') + '</button></div>';
    }
    const funcs = APPLY_FUNCS[s.type] || [];
    const applyBlock = funcs.length
      ? '<div class="ms-cat">' + T('cv.workat','Werken bij') + ' ' + s.name + '</div>' +
        '<div style="display:flex;gap:0.5rem;align-items:center;padding:0.3rem 0 0.9rem;">' +
        '<select id="apFunc2" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.7rem 0.9rem;font-size:0.86rem;color:var(--txt);outline:none;">' +
        funcs.map(f => '<option>' + f + '</option>').join('') + '</select>' +
        '<button class="vbtn" id="apGo2">' + T('cv.apply','Solliciteer') + '</button></div>'
      : '';
    const evs = s.events || [];
    const eventsBlock = evs.length
      ? '<div class="ms-cat">\uD83C\uDF9F ' + T('ev.h','Events') + '</div>' + evs.map(e =>
          '<div style="border:1px solid var(--line);border-radius:0;padding:0.85rem 1rem;margin-bottom:0.6rem;">' +
          '<div style="display:flex;justify-content:space-between;gap:0.6rem;align-items:baseline;"><b style="font-size:0.92rem;">' + e.name + '</b><span style="font-size:0.7rem;color:var(--soft);flex-shrink:0;">' + e.date + (e.time ? ' \u00b7 ' + e.time : '') + '</span></div>' +
          (e.desc ? '<div style="font-size:0.78rem;color:var(--muted);margin-top:0.25rem;">' + e.desc + '</div>' : '') +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem;gap:0.6rem;">' +
          '<span style="font-size:0.72rem;color:' + (e.spotsLeft > 0 ? 'var(--soft)' : 'var(--burgundy)') + ';">' + (e.spotsLeft > 0 ? e.spotsLeft + ' ' + T('ev.spots','plekken vrij') : T('ev.full','Vol')) + (e.price ? ' \u00b7 ' + eur(e.price) + ' p.p.' : ' \u00b7 ' + T('ev.free','gratis')) + '</span>' +
          (e.spotsLeft > 0 ? '<button class="vbtn" data-rsvp="' + e.id + '">' + T('ev.join','Zet mij op de lijst') + '</button>'
            : '<button class="vbtn" data-wl="' + e.id + '">' + T('erv.wachtlijst','Wachtlijst') + '</button>') +
          '</div></div>'
        ).join('')
      : '';
    const retailBlock = menuState.retail ? retailMenuBlock() : '';
    const cats = [...new Set(m.map(x => x.cat))];
    $('#msBody').innerHTML = head + retailBlock + eventsBlock + applyBlock + cats.map(c =>
      '<div class="ms-cat">' + c + '</div>' + m.filter(x => x.cat === c).map(x => {
        const q = menuState.qty[x.id] || 0;
        // alcohol op slot: onder de landsgrens (paspoortleeftijd) niet bestelbaar
        const slot = x.station === 'bar' && menuState.alcohol && menuState.alcohol.mag === false;
        // 86 van het keukenscherm: uitverkocht, dus even niet te bestellen
        const op86 = !!x.uitverkocht;
        // allergie: welke allergenen van dit gerecht staan in jouw profiel?
        const botst = ((menuState.allergenen || []).length && (x.allergens || []).filter(a => menuState.allergenen.includes(String(a).toLowerCase()))) || [];
        return '<div class="ms-item' + (botst.length ? ' ms-allergie' : '') + '" data-id="' + x.id + '"' + (op86 ? ' style="opacity:0.5;"' : '') + '>' +
          '<div class="info"><div class="nm">' + x.name + '</div>' +
            (x.desc ? '<div class="ds">' + x.desc + '</div>' : '') +
            (botst.length ? '<div class="alg-waarschuwing">' + T('menu.jouwallergie','jouw allergie') + ': ' + botst.map(a => tAlg(a)).join(', ') + '</div>' : '') +
            (x.allergens && x.allergens.length ? '<div class="alg">' + x.allergens.map(a => '<span>' + tAlg(a) + '</span>').join('') + '</div>' : '') +
          '</div>' +
          '<div class="side"><div class="pr">' + eur(x.price) + '</div>' +
            (op86 ? '<div class="qty" style="opacity:0.7;font-size:0.64rem;justify-content:center;">' + T('menu.86','uitverkocht') + '</div>'
              : slot ? '<div class="qty" style="opacity:0.55;font-size:0.64rem;justify-content:center;">' + menuState.alcohol.grens + '+</div>'
              : '<div class="qty"><button class="js-minus">−</button><b>' + q + '</b><button class="js-plus">+</button></div>') +
          '</div></div>';
      }).join('')
    ).join('');
    const apGo = $('#apGo2');
    if (apGo) apGo.addEventListener('click', () => memberApply(menuState.supplier.code, $('#apFunc2').value, ''));
    document.querySelectorAll('[data-rsvp]').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/event/rsvp', { supplierCode: menuState.supplier.code, eventId: b.dataset.rsvp, qty: 1 });
        toast(T('ev.joined','U staat op de gastenlijst. Uw codenaam is uw toegang.'));
        await openMenu(menuState.supplier.code); // sheet ververst: plekken en knop kloppen weer
      } catch(e){ toast(e.message); }
    }));
    // vol event: op de wachtlijst; bij een vrijgekomen plek krijgt u meteen bericht
    document.querySelectorAll('[data-wl]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/wachtlijst', { supplierCode: menuState.supplier.code, eventId: b.dataset.wl });
        toast('' + T('erv.wlok','U staat op de wachtlijst (nr. ') + d.positie + '). ' + T('erv.wlbericht','Bij een vrije plek hoort u het meteen.'));
      } catch(e){ toast(e.message); }
    }));
    // favoriet-hart + tafel reserveren
    const favB = $('#msFav');
    if (favB) favB.addEventListener('click', async () => {
      try {
        const d = await API.call('/favoriet', { supplierCode: s.code });
        menuState.supplier.favoriet = d.favoriet;
        renderMenuSheet();
      } catch(e){ toast(e.message); }
    });
    const rsvGo = $('#rsvGo');
    if (rsvGo) rsvGo.addEventListener('click', async () => {
      try {
        const d = await API.call('/reserveer', { supplierCode: s.code, datum: $('#rsvDatum').value, tijd: $('#rsvTijd').value, personen: Number($('#rsvPers').value) });
        toast('' + T('erv.reserveerok','Reservering aangevraagd voor') + ' ' + d.reservering.datum + ' ' + d.reservering.tijd + '. ' + T('erv.zaakbevestigt','De zaak bevestigt hem zo.'));
      } catch(e){ toast(e.message); }
    });
    // keyless: de deur van je kamer of de entree, met je telefoon als sleutel
    const deur = async welke => {
      try {
        const d = await API.call('/verblijf/deur', { supplierCode: s.code, welke });
        toast('' + d.door.name + ' ' + T('vb.deuropen','is open; hij vergrendelt zelf weer na') + ' ' + d.door.relockSec + 's.');
      } catch(e){ toast(e.message); }
    };
/* de deur van kamer of entree openen, en een kamer boeken */
    const dk = $('#vbDeurKamer'); if (dk) dk.addEventListener('click', () => deur('kamer'));
    const de = $('#vbDeurEntree'); if (de) de.addEventListener('click', () => deur('entree'));
    // een kamer boeken: datums kiezen, een knop, het huis bevestigt
    $('#msBody').querySelectorAll('[data-vbboek]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/verblijf', {
          supplierCode: s.code, roomId: b.dataset.vbboek,
          aankomst: $('#vbAankomst').value, vertrek: $('#vbVertrek').value,
          personen: Number($('#vbPers').value)
        });
        toast('' + T('vb.ok','Verblijf aangevraagd:') + ' ' + d.verblijf.roomName + ', ' + d.verblijf.nachten + ' ' + T('vb.nachten','nacht(en)') + ' (' + eur(d.verblijf.totaal) + '). ' + T('erv.zaakbevestigt','De zaak bevestigt hem zo.'));
      } catch(e){ toast(e.message); }
    }));
    if (menuState.retail) bindRetailMenu();
    $('#msBody').querySelectorAll('.ms-item').forEach(el => {
      const id = el.dataset.id;
      const plus = el.querySelector('.js-plus'), min = el.querySelector('.js-minus');
      if (plus) plus.addEventListener('click', () => { menuState.qty[id] = (menuState.qty[id]||0)+1; renderMenuSheet(); });
      if (min) min.addEventListener('click', () => { menuState.qty[id] = Math.max(0,(menuState.qty[id]||0)-1); renderMenuSheet(); });
    });
    if (!m.length){ $('#msFoot').innerHTML = ''; return; }
    if (menuState.supplier.ordersOpen === false){
      $('#msFoot').innerHTML = '<div style="padding:0.9rem 0;text-align:center;font-size:0.82rem;color:var(--soft);">' + T('app.ms.closed','Bestellingen zijn tijdelijk gesloten. De kaart blijft ter inzage.') + '</div>';
      return;
    }
    const total = m.reduce((s,x) => s + x.price * (menuState.qty[x.id]||0), 0);
    const count = Object.values(menuState.qty).reduce((a,b)=>a+b,0);
    const tafels = menuState.supplier.tableNames || [];
    $('#msFoot').innerHTML =
      (tafels.length ? '<select class="ms-note" id="msTable" style="margin-bottom:0.5rem;">'+
        '<option value="">' + T('app.ms.tableq','Aan welke tafel zit u? (optioneel)') + '</option>'+
        tafels.map(t => '<option' + (menuState.table === t ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>' : '') +
      '<input class="ms-note" id="msNote" placeholder="' + T('app.ms.note','Allergie of opmerking (bijv. geen noten)') + '" value="' + menuState.note.replace(/"/g,'&quot;') + '">' +
      '<label class="ms-tag"><input type="checkbox" id="msTag"' + (menuState.tag ? ' checked' : '') + '> ' + T('app.ms.tag','Tag dit voor De Salon (7 dagen na verblijf)') + '</label>' +
      '<select class="ms-note h-mt40" id="msFooi" aria-label="' + T('erv.fooi','Fooi') + '">' +
        '<option value="0">' + T('erv.fooi.geen','Geen fooi') + '</option>' +
        '<option value="p5"' + (menuState.fooi==='p5'?' selected':'') + '>' + T('erv.fooi.team','Fooi voor het team') + ': 5%</option>' +
        '<option value="p10"' + (menuState.fooi==='p10'?' selected':'') + '>' + T('erv.fooi.team','Fooi voor het team') + ': 10%</option>' +
        '<option value="e5"' + (menuState.fooi==='e5'?' selected':'') + '>' + T('erv.fooi.team','Fooi voor het team') + ': € 5</option>' +
      '</select>' +
      '<div style="font-size:0.66rem;color:var(--soft);margin:0.25rem 0;">' + T('app.ms.los','U bestelt rechtstreeks bij deze zaak: een losse overeenkomst, en uw betaling gaat rechtstreeks naar de zaak.') + '</div>' +
      ((menuState.supplier.hasMenu !== false && (menuState.menu || []).some(x => x.station === 'bar'))
        ? '<div style="font-size:0.66rem;color:var(--soft);margin:0.25rem 0;">' +
          (menuState.alcohol && menuState.alcohol.mag === false
            ? T('app.ms.geenalc','Alcohol staat voor u uit:') + ' ' + (menuState.alcohol.land || '') + ' ' + T('app.ms.vanaf','hanteert') + ' ' + menuState.alcohol.grens + '+ ' + T('app.ms.pasp','(leeftijd geverifieerd via uw paspoort).')
            : 'Alcohol: ' + ((menuState.alcohol && menuState.alcohol.grens) || 18) + '+; ' + T('app.ms.18b','de zaak kan om legitimatie vragen.')) + '</div>' : '') +
      '<button class="ms-order" id="msOrder"' + (count ? '' : ' disabled') + '>' + (count ? T('app.ms.order','Bestel') + ' ' + count + ' ' + T('app.items','item(s)') + ', ' + eur(total) : T('app.ms.choose','Kies gerechten')) + '</button>' +
      (count ? '<button class="ms-order" id="msKassa" style="margin-top:0.5rem;background:none;border:1px solid var(--line);color:var(--txt);">' + T('app.ms.naarkassa','Stuur naar de kassa, betaal aan de balie') + '</button>' : '');
    const mt = $('#msTable');
    if (mt) mt.addEventListener('change', e => menuState.table = e.target.value);
    $('#msNote').addEventListener('input', e => menuState.note = e.target.value);
    $('#msTag').addEventListener('change', e => menuState.tag = e.target.checked);
    const mf = $('#msFooi');
    if (mf) mf.addEventListener('change', e => menuState.fooi = e.target.value);
    const ob = $('#msOrder');
    if (count) ob.addEventListener('click', () => placeOrder());
    const kb = $('#msKassa');
    if (kb) kb.addEventListener('click', () => placeOrder({ naarKassa: true }));
  }

  // ---- mode-/retailcatalogus in de partner-sheet ----
  function retailMenuBlock(){
    const r = menuState.retail;
    const mijn = menuState.retailMijn || { apart: [], styling: [] };
    let html = '<div class="ms-cat">' + T('rt.m.cat','Collectie') + '</div>';
    // eigen apart-artikelen en stylingvoorstellen bij dit merk
    const apart = (mijn.apart || []).filter(a => a.supplierName === r.supplier.name);
    if (apart.length) html += '<div style="background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.7rem 0.9rem;margin-bottom:0.7rem;"><div style="font-size:0.7rem;color:var(--rtg-leesgoud,var(--gold));letter-spacing:0.08em;text-transform:uppercase;">' + T('rt.m.apart','Voor u apart gelegd') + '</div>' +
      apart.map(a => '<div style="font-size:0.82rem;margin-top:0.3rem;">' + esc(a.artikelNaam) + ' · ' + esc(a.kleur) + ', ' + esc(a.maat) + ' <span style="color:var(--soft);">(' + T('rt.m.tot','tot') + ' ' + esc(a.tot) + ')</span></div>').join('') +
      '<button class="rt-bezorg" style="margin-top:0.55rem;width:100%;background:var(--gold);color:#000;border:none;border-radius:0;padding:0.5rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('mb.laat','Veilig laten bezorgen') + '</button>' +
      '<div style="font-size:0.66rem;color:var(--soft);margin-top:0.3rem;">' + T('mb.veiliguitleg','Met bezorgcode, live volgen en pas-aan-de-deur. Dure stukken: ID aan de deur.') + '</div></div>';
    // lopende bezorgingen van deze winkel
    const bez = (menuState.modeBezorg || []).filter(b => b.supplierName === r.supplier.name && !['afgeleverd','retour','geannuleerd'].includes(b.status));
    if (bez.length) html += bez.map(b => '<div style="background:var(--card);border:1px solid var(--gold);border-radius:0;padding:0.7rem 0.9rem;margin-bottom:0.7rem;"><div style="font-size:0.7rem;color:var(--rtg-leesgoud,var(--gold));letter-spacing:0.08em;text-transform:uppercase;">' + T('mb.onderweg','Bezorging') + ' · ' + esc(b.status) + '</div>' +
      '<div style="font-size:0.85rem;margin-top:0.3rem;">' + T('mb.code','Bezorgcode') + ': <b style="letter-spacing:0.2em;font-size:1.05rem;">' + esc(b.bezorgcode) + '</b></div>' +
      '<div style="font-size:0.68rem;color:var(--soft);margin-top:0.2rem;">' + (b.koerier ? T('mb.koerieris','Koerier') + ': ' + esc(b.koerier) + (b.etaMin != null ? ' · ETA ' + b.etaMin + ' min' : '') : T('mb.geefcode','Geef deze code alleen aan de RTG-koerier aan de deur.')) + '</div></div>').join('');
    const styling = (mijn.styling || []).filter(v => v.supplierName === r.supplier.name);
    if (styling.length) html += styling.map(v => '<div style="background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.7rem 0.9rem;margin-bottom:0.7rem;"><div style="font-size:0.7rem;color:var(--rtg-leesgoud,var(--gold));letter-spacing:0.08em;text-transform:uppercase;">' + esc(v.titel) + '</div>' +
      (v.bericht ? '<div style="font-size:0.78rem;color:var(--muted);margin-top:0.25rem;">' + esc(v.bericht) + '</div>' : '') +
      '<div style="font-size:0.8rem;margin-top:0.25rem;">' + v.items.map(i => esc(i.naam)).join(' · ') + '</div><div style="font-size:0.68rem;color:var(--soft);margin-top:0.25rem;">' + T('rt.m.van','van') + ' ' + esc(v.van) + '</div></div>').join('');
    // de artikelen
/* de artikelen van een partner, met drops die nog niet los zijn */
    const now = Date.now();
    html += (r.artikelen || []).map(a => {
      const drop = a.drop && a.drop.releaseMs > now;
      const bes = a.beschikbaar || [];
      return '<div style="border:1px solid var(--line);border-radius:0;padding:0.8rem;margin-bottom:0.7rem;" data-rart="' + escAttr(a.id) + '">' +
        '<div style="display:flex;gap:0.8rem;">' +
        (a.foto ? '<img src="' + escAttr(a.foto) + '" alt="' + escAttr(a.naam) + '" style="width:72px;height:92px;object-fit:cover;border-radius:0;flex-shrink:0;">' : '<div style="width:72px;height:92px;border-radius:0;background:var(--card);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.4rem;"></div>') +
        '<div style="flex:1;min-width:0;">' +
        '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><b style="font-size:0.92rem;">' + esc(a.naam) + '</b>' +
        '<button class="rt-fav" data-rfav="' + escAttr(a.id) + '" style="background:none;border:none;font-size:1.1rem;flex-shrink:0;cursor:pointer;" aria-label="' + T('rt.m.verlang','Verlanglijst') + '">' + RTGGlyf.svgHTML('hart', a.opWishlist ? { fill: true } : {}) + '</button></div>' +
        '<div style="font-size:0.78rem;color:var(--soft);">' + esc(a.categorie || '') + (a.materiaal ? ' · ' + esc(a.materiaal) : '') + '</div>' +
        (a.kleuren && a.kleuren.length ? '<div style="font-size:0.76rem;color:var(--muted);margin-top:0.2rem;">' + a.kleuren.map(k => esc(k)).join(' · ') + '</div>' : '') +
        '<div style="font-weight:600;margin-top:0.3rem;">' + eur(a.price) + '</div>' +
        (drop ? '<div style="font-size:0.72rem;color:var(--rtg-leesgoud,var(--gold));margin-top:0.3rem;">' + T('rt.m.drop','Drop') + ' ' + esc(a.drop.datum) + ' ' + esc(a.drop.tijd) + '</div>' : '') +
        '</div></div>' +
        (!drop && bes.length ? '<div style="display:flex;gap:0.4rem;align-items:center;margin-top:0.5rem;flex-wrap:wrap;">' +
          '<span style="font-size:0.72rem;color:var(--soft);">' + T('rt.m.paskamer','Vraag een maat in de paskamer:') + '</span>' +
          '<select class="rt-maat" style="background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.45rem 0.6rem;font-size:0.8rem;color:var(--txt);">' +
          bes.map(v => '<option value="' + escAttr(v.vsku) + '">' + esc(v.kleur) + ' · ' + esc(v.maat) + '</option>').join('') + '</select>' +
          '<button class="vbtn rt-pas" data-rpas="' + escAttr(a.id) + '">' + T('rt.m.vraag','Vraag') + '</button></div>'
          : (drop ? '' : '<div style="font-size:0.72rem;color:var(--soft);margin-top:0.5rem;">' + T('rt.m.uitverkocht','Tijdelijk uitverkocht.') + '</div>')) +
        '</div>';
    }).join('');
    return html;
  }
  function bindRetailMenu(){
    const code = menuState.supplier.code;
    const bezBtn = document.querySelector('.rt-bezorg');
    if (bezBtn) bezBtn.addEventListener('click', async () => {
      const mijn = menuState.retailMijn || { apart: [] };
      const items = (mijn.apart || []).filter(a => a.supplierName === menuState.supplier.name)
        .map(a => ({ naam: a.artikelNaam, maat: a.maat, kleur: a.kleur, prijs: a.price || 0, aantal: 1 }));
      if (!items.length) return toast(T('mb.geenitems','Geen apart-gelegde stukken om te bezorgen.'));
      const adres = prompt(T('mb.vraagadres','Op welk adres bezorgen we?'));
      if (!adres || !adres.trim()) return;
      try {
        const r = await API.call('/mode/bezorg/aanvraag', { supplierCode: code, adres: adres.trim(), items });
        toast('' + T('mb.aangevraagd','Bezorging aangevraagd. Bezorgcode:') + ' ' + r.bezorging.bezorgcode);
        try { menuState.modeBezorg = (await API.call('/mode/bezorg/mijn', {})).bezorgingen || []; } catch(e){}
        renderMenuSheet();
      } catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-rfav]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/retail/wishlist', { code, artikelId: b.dataset.rfav });
        b.innerHTML = RTGGlyf.svgHTML('hart', d.wishlist ? { fill: true } : {});
        const a = (menuState.retail.artikelen || []).find(x => x.id === b.dataset.rfav); if (a) a.opWishlist = d.wishlist;
        toast(d.wishlist ? T('rt.m.opverlang','Op uw verlanglijst. De boetiek ziet het.') : T('rt.m.afverlang','Van uw verlanglijst gehaald.'));
      } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-rpas]').forEach(b => b.addEventListener('click', async () => {
      const card = b.closest('[data-rart]');
      const sel = card ? card.querySelector('.rt-maat') : null;
      if (!sel || !sel.value) return;
      try {
        await API.call('/retail/paskamer', { code, vsku: sel.value });
        toast('' + T('rt.m.pasok','Uw maat is aangevraagd. Een medewerker brengt hem naar de paskamer.'));
      } catch(e){ toast(e.message); }
    }));
  }

  async function placeOrder(opts){
    opts = opts || {};
    const items = Object.entries(menuState.qty).filter(([,q]) => q > 0).map(([id,qty]) => ({ id, qty }));
    if (!items.length) return;
    let d;
    try {
      d = await API.call('/order', { supplierCode: menuState.supplier.code, items, table: menuState.table || '', allergyNote: menuState.note, tagSalon: menuState.tag, naarKassa: !!opts.naarKassa, allergieAkkoord: !!opts.allergieAkkoord });
    } catch (e) {
      // allergieveiligheid: de server houdt een botsend gerecht tegen. Vraag het
      // lid het bewust te bevestigen; pas dan sturen we het met allergieAkkoord door.
      const bots = e.status === 409 && e.data && e.data.allergieBotsing;
      if (bots && !opts.allergieAkkoord){
        const namen = bots.map(b => b.naam + ' (' + b.allergenen.map(a => tAlg(a)).join(', ') + ')').join('; ');
        if (confirm('' + T('menu.allergiebevestig','Dit botst met je allergieprofiel') + ': ' + namen + '.\n\n' + T('menu.allergietochbestel','Weet je zeker dat je dit toch wilt bestellen?')))
          return placeOrder(Object.assign({}, opts, { allergieAkkoord: true }));
        return;
      }
      toast(e.message); return;
    }
    $('#menu-sheet').classList.remove('open');
    $('#menu-scrim').classList.remove('open');
    if (d.order.status === 'wacht-op-betaling'){
      // betalen-eerst (vooraf-zaak of jeugdlid): definitief na directe betaling
      payOrder(d.order, menuState.fooi);
    } else if (d.order.aanBalie){
      // naar de kassa: de keuken maakt hem al; toon de code groot om aan de balie
      // te laten scannen of tonen
      toast('' + T('app.naarkassaok','Naar de kassa gestuurd. Toon je code aan de balie.'));
      showGlow(d.order);
    } else {
      // deze zaak koos betaling achteraf: de bestelling loopt al; na het eten
      // vraagt u de rekening (alle bonnen in een keer) bij Mijn bestellingen
      toast('' + T('app.orderok','Bestelling geplaatst.') + ' ' + T('app.betaalnaeten','Betaal na het eten: vraag de rekening bij Mijn bestellingen.'));
    }
    renderTerPlaatse();
  }

  function payOrder(o, fooiKeus){
    // fooi voor het team: percentage of vast bedrag, gekozen in de bestelbon
    const fooi = fooiKeus === 'p5' ? Math.round(o.total * 5) / 100
      : fooiKeus === 'p10' ? Math.round(o.total * 10) / 100
      : fooiKeus === 'e5' ? 5 : 0;
    payWithFaceId(eur(o.total + fooi), async () => {
      await API.call('/order/pay', { ref: o.ref, fooi });
      return o;
    }, { message: () => T('app.paidto','Betaald aan') + ' ' + o.supplierName + '.' + (fooi ? '  ' + eur(fooi) + ' ' + T('erv.fooivoorteam','fooi voor het team.') : ''), after: () => renderTerPlaatse() });
  }

  $('#msClose').addEventListener('click', () => { $('#menu-sheet').classList.remove('open'); $('#menu-scrim').classList.remove('open'); });
  $('#menu-scrim').addEventListener('click', () => { $('#menu-sheet').classList.remove('open'); $('#menu-scrim').classList.remove('open'); });

  /* ---------- cv-builder + solliciteren via RTG ---------- */
  let myCv = null, myCvReady = false, myApps = [];
  const APPLY_FUNCS = {
    restaurant: ['Bediening','Keuken','Gastheer/gastvrouw','Afwas'],
    bar:        ['Bediening','Bar','Keuken','Security'],
    club:       ['Bediening','Bar','Security'],
    hotel:      ['Receptie','Housekeeping','Roomservice','Onderhoud','Security'],
    apartment:  ['Beheer','Housekeeping','Onderhoud'],
    villa:      ['Beheer','Housekeeping','Onderhoud'],
    taxi:       ['Taxi centrale','Chauffeur'],
    jet:        ['Operations','Crew','Piloot']
  };
  async function loadCv(){
    if (!API.live) return;
    try { const d = await API.call('/cv/get'); myCv = d.cv; myCvReady = d.ready; renderCvCard(); } catch(e){}
  }
  function renderCvCard(){
    const el = $('#homeCv'); if (!el) return;
/* de cv-kaart: klaar of nog niet */
    el.innerHTML = '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+T('cv.card.k','Werken via RTG')+'</div>'+
      (myCvReady
        ? '<div style="margin-top:0.5rem;font-size:0.85rem;color:var(--muted);">✓ '+T('cv.card.ready','Uw cv staat klaar. Solliciteer bij elke RTG-partner in een tik, via Ter plaatse.')+'</div>'
        : '<div style="margin-top:0.5rem;font-size:0.85rem;color:var(--muted);">'+T('cv.card.build','Maak eenmalig uw cv met de cv-builder en solliciteer daarna bij elke RTG-partner op dezelfde manier.')+'</div>')+
      (myApps.length ? '<div style="margin-top:0.75rem;display:flex;flex-direction:column;gap:0.45rem;">'+myApps.map(a => {
        const kleur = a.status==='aangenomen' ? '#4CAF7D' : a.status==='afgewezen' ? 'var(--burgundy)' : a.status==='uitgenodigd' ? '#4CAF7D' : 'var(--gold)';
        const label = a.status==='aangenomen' ? T('cv.st.hired','aangenomen') : a.status==='afgewezen' ? T('cv.st.rejected','afgewezen') : a.status==='uitgenodigd' ? T('cv.st.invited','uitgenodigd') : T('cv.st.new','in behandeling');
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.6rem;font-size:0.78rem;color:var(--muted);">'+
          '<span>'+a.company+' · '+a.func+'</span>'+
          '<span style="display:flex;align-items:center;gap:0.4rem;flex-shrink:0;">'+
          (a.chatId ? '<button class="chatb" style="width:auto;padding:0.2rem 0.55rem;font-size:0.7rem;" data-apchat="'+a.chatId+'" data-apco="'+encodeURIComponent(a.company)+'">'+T('cv.chat','Chat')+'</button>' : '')+
          '<span style="font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:'+kleur+';border:1px solid '+kleur+';border-radius:0;padding:0.15rem 0.55rem;">'+label+'</span></span></div>';
      }).join('')+'</div>' : '')+
      '<button class="vbtn h-mt80" id="cvOpen">'+(myCvReady?T('cv.card.edit','Bewerk mijn cv'):T('cv.card.make','Maak mijn cv'))+'</button>';
    $('#cvOpen').addEventListener('click', openCvSheet);
    el.querySelectorAll('[data-apchat]').forEach(b => b.addEventListener('click', () => openApplyChat(b.dataset.apchat, decodeURIComponent(b.dataset.apco||''))));
  }
  function openCvSheet(){
    const c = myCv || {};
    $('#cvName').value = c.name || (user && user.full) || '';
    $('#cvContact').value = c.contact || (user && (user.phone || user.email)) || '';
    $('#cvHeadline').value = c.headline || '';
    $('#cvExp').value = (c.experience || []).join('\n');
    $('#cvSkills').value = (c.skills || []).join(', ');
    $('#cvLang').value = (c.languages || []).join(', ');
    $('#cvAbout').value = c.about || '';
    $('#cv-sheet').classList.add('open');
    $('#cv-scrim').classList.add('open');
  }
  function closeCvSheet(){ $('#cv-sheet').classList.remove('open'); $('#cv-scrim').classList.remove('open'); }
  $('#cvClose').addEventListener('click', closeCvSheet);
  $('#cv-scrim').addEventListener('click', closeCvSheet);
  $('#cvSave').addEventListener('click', async () => {
    try {
      const d = await API.call('/cv/save', {
        name: $('#cvName').value, contact: $('#cvContact').value, headline: $('#cvHeadline').value,
        experience: $('#cvExp').value, skills: $('#cvSkills').value, languages: $('#cvLang').value, about: $('#cvAbout').value
      });
      myCv = d.cv; myCvReady = d.ready;
      toast(d.ready ? T('cv.saved','Cv bewaard. U kunt nu overal solliciteren.') : T('cv.savedpart','Bewaard. Vul ervaring of vaardigheden aan om te kunnen solliciteren.'));
      renderCvCard(); closeCvSheet();
    } catch(e){ toast(e.message); }
  });
  async function memberApply(code, func, note){
    try {
      await API.call('/member/apply', { supplierCode: code, func, note });
      toast(T('cv.applied','Sollicitatie verstuurd, met uw RTG-cv erbij.'));
      return true;
    } catch(e){
      toast(e.message);
      if (/cv/i.test(e.message)) openCvSheet();
      return false;
    }
  }

  /* ---------- vacatures: dezelfde partnervacatures als in de RTFoundation,
     nu ook voor RTG-leden, met land- en afstandfilter en solliciteren met cv ---------- */
  const VACSOORT = { bijbaan:'Bijbaan', vakantiewerk:'Vakantiewerk', parttime:'Parttime', fulltime:'Fulltime', stage:'Stage', vrijwilliger:'Vrijwilliger' };
  let vacs = [], vacLanden = [], vacLand = '';
  async function loadVacatures(){
    try {
      const d = await API.call('/member/vacatures', vacLand ? { land: vacLand } : {});
      vacs = d.vacatures || []; vacLanden = d.landen || [];
      renderVacatures();
      // locatie ophalen zodat vacatures op afstand komen (eenmalig)
      // Geo.mag(): zie app-main-21.js -- niet grendelen op een vraag die nooit gesteld is
      if (window.Geo && Geo.mag() && !Geo.laatste() && !loadVacatures._gps){ loadVacatures._gps = true; Geo.positie().then(p => { if (p) renderVacatures(); }); }
    } catch(e){ $('#homeVacatures').hidden = true; }
  }
  function renderVacatures(){
    const el = $('#homeVacatures'); if (!el) return;
    if (!vacs.length && !vacLand){ el.hidden = true; return; }
    el.hidden = false;
    const mijnPlek = window.Geo ? Geo.laatste() : null;
    const rij = vacs.map(v => ({ v, km: mijnPlek && v.loc ? Geo.afstandKm(mijnPlek, v.loc) : null }));
    if (mijnPlek) rij.sort((a,b) => (a.km==null?1e9:a.km) - (b.km==null?1e9:b.km));
    const isApplied = (v) => myApps.some(a => a.func === v.func && a.company === v.bedrijf);
    const landOpts = '<option value="">'+T('vac.overal','Overal')+'</option>' +
      vacLanden.map(l => '<option value="'+l.code+'"'+(l.code===vacLand?' selected':'')+'>'+(VLAG[l.code]||'')+' '+esc(l.naam)+'</option>').join('');
    let h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+T('vac.k','Werk en vacatures')+'</div>'+
      '<select id="vacLand" style="background:var(--card2);color:var(--txt,#fff);border:1px solid var(--line);border-radius:0;padding:0.3rem 0.6rem;font-size:0.72rem;">'+landOpts+'</select></div>';
    if (!rij.length){
      h += '<div style="margin-top:0.5rem;font-size:0.82rem;color:var(--muted);">'+T('vac.leeg','Nu geen open vacatures die bij u passen. Kijk gerust later nog eens.')+'</div>'+
        '<button class="rahul-leeg-knop h-mt50" data-rahul-leeg="Zoek werk dat bij mijn profiel past en help me solliciteren">'+T('vac.leegdoe','Laat Rahul werk zoeken dat past')+'</button>';
    } else {
      h += '<div style="margin-top:0.75rem;display:flex;flex-direction:column;gap:0.6rem;">'+ rij.slice(0,20).map(({v,km})=>{
        const al = isApplied(v);
        const meta = [ VACSOORT[v.soort]||v.soort, (VLAG[v.land]||'')+' '+(v.landNaam||''), v.plaats||v.stad, km!=null?(''+Geo.tekst(km)):'' ].filter(x=>x&&x.trim()).join(' · ');
        return '<div style="border:1px solid var(--line);border-radius:0;padding:0.7rem 0.85rem;">'+
          '<div style="display:flex;align-items:flex-start;gap:0.5rem;justify-content:space-between;">'+
          '<div style="min-width:0;"><b style="font-size:0.9rem;">'+esc(v.func)+'</b>'+
          '<div style="font-size:0.74rem;color:var(--rtg-leesgoud,var(--gold));font-weight:600;">'+esc(v.bedrijf)+'</div>'+
          '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.15rem;">'+esc(meta)+'</div></div>'+
          (al ? '<span style="flex-shrink:0;font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase;color:#4CAF7D;border:1px solid #4CAF7D;border-radius:0;padding:0.15rem 0.5rem;">'+T('vac.verstuurd','verstuurd')+'</span>'
               : '<button class="vbtn" style="flex-shrink:0;width:auto;padding:0.4rem 0.8rem;font-size:0.74rem;" data-vac="'+v.id+'" data-sup="'+v.supplierCode+'">'+T('vac.sol','Solliciteer')+'</button>')+
          '</div>'+
          (v.omschrijving?'<div style="font-size:0.74rem;color:var(--muted);margin-top:0.5rem;line-height:1.4;">'+esc(v.omschrijving)+'</div>':'')+
          '</div>';
      }).join('')+'</div>';
    }
    el.innerHTML = h;
    const sel = $('#vacLand'); if (sel) sel.addEventListener('change', () => { vacLand = sel.value; loadVacatures(); });
    el.querySelectorAll('[data-vac]').forEach(b => b.addEventListener('click', () => applyVac(b.dataset.sup, b.dataset.vac)));
  }
  async function applyVac(supplierCode, vacatureId){
    const v = vacs.find(x => x.id === vacatureId);
    try {
      await API.call('/member/apply', { supplierCode, vacatureId });
      toast(T('cv.applied','Sollicitatie verstuurd, met uw RTG-cv erbij.'));
      if (v) myApps.unshift({ company: v.bedrijf, func: v.func, status: 'nieuw', at: new Date().toISOString() });
      renderVacatures(); renderCvCard();
    } catch(e){
      toast(e.message);
      if (/cv/i.test(e.message)) openCvSheet();
    }
  }

  /* ---------- chat met de werkgever (na uitnodigen/aannemen) ----------
     De sollicitant en de werkgever maken hier samen een afspraak om langs te
     komen. Berichten worden automatisch naar de gekozen taal vertaald. */
  let apChatId = null, apChatTimer = null;
  function apMsgHtml(m){
    const mij = m.van === 'sollicitant';
/* een chatbericht opmaken, met vertaling voor de ander */
    const inner = mij ? escT(m.tekst) : '<span class="xlate">' + escT(m.tekst) + '</span>';
    return '<div class="dm-m' + (mij ? ' mine' : '') + '">' + inner + '</div>';
  }
  function ensureApChatEl(){
    let ov = document.getElementById('apchat'); if (ov) return ov;
    ov = document.createElement('div'); ov.id='apchat';
    ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:none;align-items:flex-end;justify-content:center;';
    ov.innerHTML='<div style="background:var(--bg,#0C0C0B);border:1px solid var(--line);border-radius:0;width:min(100%,34rem);height:78vh;display:flex;flex-direction:column;">'+
      '<div style="display:flex;align-items:center;gap:.6rem;padding:.9rem 1rem;border-bottom:1px solid var(--line);"><b class="h-flex1" id="apchatWie"></b><button id="apchatX" style="background:none;border:none;color:var(--soft);font-size:1.3rem;">✕</button></div>'+
      '<div id="apchatMsgs" class="dm-body" style="flex:1;overflow:auto;padding:1rem;display:flex;flex-direction:column;gap:.4rem;"></div>'+
      '<div style="display:flex;gap:.5rem;padding:.8rem 1rem;border-top:1px solid var(--line);"><input id="apchatIn" placeholder="'+T('cv.chat.ph','Bericht (bijv. Kan ik donderdag om 15u langskomen?)')+'" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:0;padding:.6rem .85rem;color:var(--txt,#fff);"><button id="apchatSend" class="vbtn" style="width:auto;padding:.5rem 1rem;">'+T('cv.chat.send','Stuur')+'</button></div>'+
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('#apchatX').addEventListener('click', closeApplyChat);
    ov.addEventListener('click', e=>{ if(e.target===ov) closeApplyChat(); });
    ov.querySelector('#apchatSend').addEventListener('click', sendApplyChat);
    ov.querySelector('#apchatIn').addEventListener('keydown', e=>{ if(e.key==='Enter') sendApplyChat(); });
    return ov;
  }
  async function laadApplyChat(){
    if (!apChatId) return;
    try { const d = await API.call('/member/apply/chat', { id: apChatId });
      const box = document.getElementById('apchatMsgs'); if(!box) return;
      box.innerHTML = (d.chat.berichten||[]).map(apMsgHtml).join('') || '<div style="color:var(--soft);text-align:center;margin:auto;font-size:0.82rem;">'+T('cv.chat.leeg','Nog geen berichten. Stel een moment voor om langs te komen.')+'</div>';
      vertaalBubbels(box); box.scrollTop = box.scrollHeight;
    } catch(e){}
  }
  function openApplyChat(id, bedrijf){
    apChatId = id; const ov = ensureApChatEl();
    ov.querySelector('#apchatWie').textContent = bedrijf || T('cv.chat.title','Chat met de werkgever');
    ov.style.display='flex'; laadApplyChat();
    clearInterval(apChatTimer); apChatTimer = setInterval(laadApplyChat, 4000);
  }
  function closeApplyChat(){ apChatId=null; clearInterval(apChatTimer); const ov=document.getElementById('apchat'); if(ov) ov.style.display='none'; }
  async function sendApplyChat(){
    const inp = document.getElementById('apchatIn'); const t=(inp.value||'').trim(); if(!t||!apChatId) return; inp.value='';
    try { await API.call('/member/apply/chat/send', { id: apChatId, text: t }); laadApplyChat(); } catch(e){ toast(e.message); }
  }

  /* ---------- gastchat met een partner ---------- */
  let pchat = null; // { code, name, dept, depts }
  const DEPT_EN = { 'Receptie':'Reception', 'Roomservice':'Room service', 'Housekeeping':'Housekeeping', 'Onderhoud':'Maintenance', 'Security':'Security', 'Beheer':'Management', 'Team':'Team' };
  const tDept = d => (lang() === 'en' ? (DEPT_EN[d] || d) : d);
  async function openPChat(code){
    const s = suppliers.find(x => x.code === code);
    if (!s) return;
    const depts = s.depts && s.depts.length ? s.depts : ['Team'];
    pchat = { code, name: s.name, dept: depts[0], depts };
    $('#pcName').textContent = s.name;
    renderPChatDepts();
    $('#pchat-sheet').classList.add('open');
    $('#pchat-scrim').classList.add('open');
    await loadPChat();
    $('#pcInput').focus();
  }
  function renderPChatDepts(){
    const el = $('#pcDepts');
    if (!pchat || pchat.depts.length < 2){ el.innerHTML = ''; return; }
    el.innerHTML = pchat.depts.map(d =>
      '<button data-dept="' + d + '"' + (d === pchat.dept ? ' class="on"' : '') + '>' + tDept(d) + '</button>'
    ).join('');
    el.querySelectorAll('[data-dept]').forEach(b => b.addEventListener('click', async () => {
      pchat.dept = b.dataset.dept;
      renderPChatDepts();
      await loadPChat();
    }));
  }
  function closePChat(){
    pchat = null;
    $('#pchat-sheet').classList.remove('open');
    $('#pchat-scrim').classList.remove('open');
  }
  async function loadPChat(){
    if (!pchat) return;
    let msgs = [];
    try { msgs = (await API.call('/partner/chat/history', { supplierCode: pchat.code, dept: pchat.dept })).messages || []; }
    catch(e){ return; }
    renderPChat(msgs);
  }
  function renderPChat(msgs){
    // Met Util.el: zowel de naam van de afzender (m.who) als de berichttekst gaan
    // structureel als tekstknoop. Dat sluit een gat: de oude versie zette m.who
    // ongefilterd in de HTML en escapete de tekst maar deels.
    const E = Util.el, body = $('#pcBody');
    if (!msgs.length){
      Util.vervang(body, E('div', { class: 'pc-empty' }, T('app.pc.empty', 'Stel uw vraag rechtstreeks aan het team. Roomservice, een verzoek aan de eigenaar, of gewoon even iets regelen.')));
      return;
    }
    Util.vervang(body, msgs.map(m => E('div', { class: 'pc-msg ' + (m.from === 'guest' ? 'me' : 'them') },
      m.from === 'partner' ? E('span', { class: 'who' }, m.who) : null,
      m.text,
      m.orig ? E('span', { style: { display: 'block', marginTop: '0.25rem', fontSize: '0.66rem', opacity: '0.55', fontStyle: 'italic' } }, m.orig) : null,
      E('time', {}, timeAgo(m.at)))));
    body.scrollTop = body.scrollHeight;
  }
  async function sendPChat(){
    const inp = $('#pcInput');
    const text = (inp.value || '').trim();
    if (!text || !pchat) return;
    inp.value = '';
    try { renderPChat((await API.call('/partner/chat/send', { supplierCode: pchat.code, dept: pchat.dept, text })).messages); }
    catch(e){ toast(e.message); }
  }
  $('#pcClose').addEventListener('click', closePChat);
  $('#pchat-scrim').addEventListener('click', closePChat);
  // vooraf al op elkaars Salon kijken: nooit vreemden van elkaar
  $('#pcSalon').addEventListener('click', () => { if (pchat) openEtalage(pchat.code); });
  $('#pcSend').addEventListener('click', sendPChat);
  $('#pcInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendPChat(); });
  // De gast vraagt zelf om aandacht: het team krijgt meteen een prioriteitsmelding.
  document.querySelectorAll('#pcAttn [data-attn]').forEach(b => b.addEventListener('click', async () => {
    if (!pchat) return;
    try { await API.call('/aandacht', { supplierCode: pchat.code, reden: b.dataset.attn }); toast(T('app.attn.ok','Het team is gewaarschuwd en komt eraan.')); }
/* sparren met Rahul, en de geparkeerde gedachten */
    catch(e){ toast(e.message); }
  }));

  /* Het "Sparren met Rahul"-blok in het Rahul-paneel: samen een idee beter
     maken (niet om zijn gelijk te halen), en geparkeerde gedachten waar hij op
     een rustig moment op terugkomt. Als losse helper afgesplitst van
     30-live-menu-werk-03.js, zodat beide parts in de 5-10 KB-band blijven. */
  function sparBlokHtml(sparLijst){
    return '<div style="margin-top:0.75rem;border-top:1px solid var(--line);padding-top:0.6rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">' + T('spar.h','Sparren met Rahul') + '</div>' +
      '<div style="font-size:0.68rem;color:var(--soft);margin-top:0.25rem;">' + T('spar.d','Hij denkt mee om je idee beter te maken, niet om zijn gelijk te halen. Parkeer een gedachte; als je rustig thuis bent met een lege agenda komt hij er zelf op terug.') + '</div>' +
      ((sparLijst || []).length
        ? '<div style="display:flex;flex-direction:column;gap:0.4rem;margin-top:0.5rem;">' + sparLijst.map(s =>
            '<div style="border:1px solid var(--line);border-radius:0;padding:0.5rem 0.65rem;">' +
            '<div style="font-size:0.78rem;line-height:1.4;">' + esc(s.tekst) + '</div>' +
            '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;">' +
              '<button class="chip js-sparchat" data-t="' + esc(s.tekst) + '" style="font-size:0.68rem;">' + T('spar.nu','Spar nu') + '</button>' +
              '<button class="chip js-spardone" data-id="' + esc(s.id) + '" style="font-size:0.68rem;">✓ ' + T('spar.klaar','Besproken') + '</button>' +
              '<button class="chip js-sparweg" data-id="' + esc(s.id) + '" style="font-size:0.68rem;">✕ ' + T('spar.weg','Weg') + '</button>' +
            '</div></div>').join('') + '</div>'
        : '') +
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;">' +
        '<input id="sparIn" placeholder="' + T('spar.plho','Waar wil je later over sparren?') + '" style="flex:1;min-width:0;background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:0;padding:0.45rem 0.65rem;font-size:0.76rem;color:var(--txt);outline:none;font-family:inherit;">' +
        '<button class="chip" id="sparPark" style="flex-shrink:0;">' + T('spar.park','Parkeer') + '</button>' +
      '</div>' +
    '</div>';
  }
  function bindSparBlok(el){
    // nu erover praten, of het onderwerp als besproken/weg zetten
    el.querySelectorAll('.js-sparchat').forEach(b => b.addEventListener('click', () => {
      const tegel = document.querySelector('.os-app[data-tab="ai"]'); if (tegel) tegel.click();
      // idem: `ask` bestond nooit, dus dit vulde de vraag nooit in
      if (window.RTGVraag) RTGVraag(T('spar.over','Spar met me over') + ': ' + b.dataset.t);
    }));
    el.querySelectorAll('.js-spardone').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/spar/status', { id: b.dataset.id, status: 'besproken' }); renderFluister(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-sparweg').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/spar/status', { id: b.dataset.id, status: 'weg' }); renderFluister(); } catch(e){ toast(e.message); }
    }));
    const sparPark = el.querySelector('#sparPark'), sparIn = el.querySelector('#sparIn');
    if (sparPark && sparIn) {
      const park = async () => {
        const tekst = sparIn.value.trim(); if (!tekst) return;
        try { await API.call('/spar/parkeer', { tekst }); sparIn.value = ''; toast('' + T('spar.geparkeerd','Geparkeerd. Rahul komt er op een rustig moment op terug.')); renderFluister(); } catch(e){ toast(e.message); }
      };
      sparPark.addEventListener('click', park);
      sparIn.addEventListener('keydown', e => { if (e.key === 'Enter') park(); });
    }
  }
  /* ---------- oplichtend ophaalcode-scherm ---------- */
  function showGlow(o){
    $('#gcSup').textContent = o.supplierName;
    $('#gcCode').textContent = o.pickup;
    // een echte, scanbare QR van de ophaalcode: de kassa scant hem, of typt de code
    const qh = $('#gcQr');
    if (qh){
      qh.innerHTML = ''; qh.style.display = 'none';
      if (window.RTGQRteken && o.pickup){
        try { qh.appendChild(RTGQRteken.teken(String(o.pickup), { schaal: 5, ecc: 'M' })); qh.style.display = 'inline-block'; } catch(e){}
      }
    }
    $('#glowCode').classList.add('open');
  }
  $('#glowCode').addEventListener('click', () => $('#glowCode').classList.remove('open'));

  /* ---------- home ---------- */

  function renderVerifyBanner(){
    const el = $('#verifyBanner');
    if (!el) return;
    const v = user && user.account ? user.verified : null;
    if (!user || !user.account || v === 'verified'){ el.innerHTML = ''; return; }
    if (v === 'pending'){
      el.innerHTML = '<div class="vbanner pending"><b>'+T('vf.pending.h','Verificatie in behandeling')+'</b><span>'+T('vf.pending.b','We controleren uw document. U kunt de app gewoon blijven gebruiken.')+'</span>'+
        '<button class="vbtn h-mt50" id="selfieStart">'+T('vf.selfie','Selfie toevoegen (gezichtscontrole)')+'</button></div>';
      const sb = $('#selfieStart'); if (sb) sb.addEventListener('click', () => $('#selfieFile').click());
      return;
    }
    el.innerHTML = '<div class="vbanner"><b>'+T('vf.h','Verifieer uw identiteit, boek in één tik')+'</b>' +
      '<span>'+T('vf.b','Eén foto van de voorkant van uw paspoort plus een selfie. Zo weet RTG zeker dat u het bent (gezicht x paspoort), houden we nepaccounts buiten, en boekt u daarna zonder gedoe. Uw gegevens zijn alleen zichtbaar voor RTG.')+'</span>' +
      '<button class="vbtn" id="verifyStart">'+T('vf.btn','Document uploaden')+'</button></div>';
    $('#verifyStart').addEventListener('click', () => $('#verifyFile').click());
  }
  (function initVerifyUpload(){
    const vf = document.getElementById('verifyFile');
    if (!vf) return;
    vf.addEventListener('change', () => {
      const file = vf.files[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024){ toast(T('vf.toobig','Bestand te groot (max 5 MB).')); vf.value=''; return; }
      const reader = new FileReader();
      reader.onload = async () => {
        try { await API.call('/verify/upload', { image: reader.result }); user.verified = 'pending'; renderVerifyBanner(); toast(T('vf.sent','Document ontvangen, we controleren het.')); }
        catch (e){ toast(e.message || 'Upload mislukt.'); }
      };
      reader.readAsDataURL(file);
      vf.value = '';
    });
    const sf = document.getElementById('selfieFile');
    if (sf) sf.addEventListener('change', () => {
      const file = sf.files[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024){ toast(T('vf.toobig','Bestand te groot (max 5 MB).')); sf.value=''; return; }
      const reader = new FileReader();
      reader.onload = async () => {
        try { await API.call('/verify/selfie', { image: reader.result }); toast(T('vf.selfieok','Selfie ontvangen. RTG controleert het gezicht bij uw paspoort.')); }
        catch (e){ toast(e.message || 'Upload mislukt.'); }
      };
      reader.readAsDataURL(file);
      sf.value = '';
    });
  })();

  /* ---- paspoortverzoeken: een partner vroeg uw identiteit op (u beslist) ---- */
  let paspoortInboxData = null;
  async function laadPaspoortInbox(){
    if (!user || !user.account){ const el = $('#paspoortInbox'); if (el) el.innerHTML = ''; return; }
    try { paspoortInboxData = await API.call('/paspoort/mijn', {}); } catch(e){ paspoortInboxData = null; }
    renderPaspoortInbox();
  }
  function renderPaspoortInbox(){
    const el = $('#paspoortInbox'); if (!el) return;
    if (!user || !user.account){ el.innerHTML = ''; return; }
    if (!paspoortInboxData){ laadPaspoortInbox(); return; }
    const open = (paspoortInboxData.verzoeken || []).filter(v => v.status === 'aangevraagd');
    const lopend = (paspoortInboxData.verzoeken || []).filter(v => v.status === 'goedgekeurd');
    let html = '';
/* de verzoeken van partners om een niveau: u beslist */
    if (open.length) html += open.map(v => '<div class="vbanner" style="border-color:var(--gold,#c9a227);">' +
      '<b>'+esc(v.supplierName)+' '+T('pi.vraagt','vraagt uw')+' '+T('pi.n.'+v.niveau, v.niveau)+'</b>' +
      '<span>'+(v.reden?esc(v.reden)+' · ':'')+T('pi.uitleg','U beslist. Bij goedkeuren ziet de partner dit 10 minuten; daarna vervalt het vanzelf.')+'</span>' +
      '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;"><button class="vbtn" data-pigo="'+v.id+'">'+T('pi.goed','Goedkeuren')+'</button>' +
      '<button class="vbtn" data-piweiger="'+v.id+'" style="background:none;border:1px solid var(--line);color:var(--txt);">'+T('pi.weiger','Weigeren')+'</button></div></div>').join('');
    if (lopend.length) html += lopend.map(v => '<div class="vbanner pending"><b>'+esc(v.supplierName)+' · '+T('pi.n.'+v.niveau, v.niveau)+' '+T('pi.gedeeld','gedeeld')+'</b>' +
      '<span>'+T('pi.lopend','De inzage loopt. U kunt hem intrekken.')+'</span>' +
      '<button class="vbtn" data-pitrek="'+v.id+'" style="margin-top:0.5rem;background:none;border:1px solid var(--line);color:var(--txt);">'+T('pi.trek','Intrekken')+'</button></div>').join('');
    el.innerHTML = html;
    el.querySelectorAll('[data-pigo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/paspoort/beslis', { id: b.dataset.pigo, akkoord: true }); toast(T('pi.goedok','Goedgekeurd.')); await laadPaspoortInbox(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-piweiger]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/paspoort/beslis', { id: b.dataset.piweiger, akkoord: false }); toast(T('pi.weigerok','Geweigerd.')); await laadPaspoortInbox(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-pitrek]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/paspoort/trek-in', { id: b.dataset.pitrek }); toast(T('pi.trekok','Ingetrokken.')); await laadPaspoortInbox(); } catch(e){ toast(e.message); }
    }));
  }

  function renderHome(){
    renderVerifyBanner();
    laadVakbewijs();
    laadPaspoortInbox();
    // gratis gebruiker (zonder pas): beperkte, veilige startpagina
    if (user.tier === 'guest'){ renderHomeGuest(); return; }
    const first = user.full.split(' ')[0];
    const E = Util.el; // componentframework voor de kaarten hieronder
    // de stem volgt de pas van het ingelogde lid (niet alleen de ingang)
    document.documentElement.setAttribute('data-stem', user.tier);
    stemKoppen();
    /* De begroeting ("Ha <naam>, goed je te zien.") is van het beginscherm af:
       zie de opmerking bij .os-thuisscherm in apps/app.html. De regel eronder
       blijft -- die groet niet, die zegt welke pas je hebt en sinds wanneer. */
    $('#homeSub').textContent = TIER_LABEL[user.tier] + ' · ' + T('app.membersince','lid sinds') + ' ' + user.since;

    // De ledenpas staat niet meer op het beginscherm: daar staat de klok, en
    // je pas ligt waar hij hoort -- bovenin je wallet (/apps/wallet.html, tegel
    // in de functierij onder de klok). De codenaam in de statusbalk blijft de
    // korte weg ernaartoe.

    const open = invoices.filter(i => i.status === 'open');
    const openSum = open.reduce((s,i) => s + i.netto + i.bijdrage, 0);

    // Deze twee kaarten met Util.el: tekst structureel veilig, data-goto blijft
    // (de globale [data-goto]-binding onderaan pakt de knoppen op).
    /* GEEN REIS IS EEN UITNODIGING, GEEN LEEG VAK.

       Een nieuw account begint leeg (server/kern/lid.js), dus dit is het eerste
       dat een echt nieuw lid hier ziet. Vroeger stond er de reis van de demo --
       Ibiza, een villa in Cala Jondal -- en dat leek een boeking op zijn naam.
       Nu staat er wat dit vak IS en wat het lid moet doen om het te vullen. */
    Util.vervang($('#homeTrip'), trip
      ? [E('div', { class: 'label' }, T('app.nexttrip', 'Eerstvolgende reis')),
         E('div', { class: 'big' }, trip.dest),
         E('div', { class: 'meta' }, trip.dates + ' · ' + T('app.in', 'over') + ' ' + trip.days + ' ' + T('app.days', 'dagen')),
         E('button', { class: 'go', dataset: { goto: 'reizen' } }, (stem('Bekijk je reis', 'Naar je reizen', 'Bekijk uw reis') || T('app.viewtrip', 'Bekijk uw reis')) + ' →')]
      : [E('div', { class: 'label' }, T('app.nexttrip', 'Eerstvolgende reis')),
         E('div', { class: 'big' }, T('app.notrip', 'Nog niets gepland')),
         E('div', { class: 'meta' }, stem(
             'Vraag een reis aan bij het reisbureau. Vanaf dat moment staat hij hier, eerst als aanvraag, en bevestigd zodra een reisadviseur hem rond heeft.',
             'Vraag een reis aan bij het reisbureau. Vanaf dat moment staat hij hier: eerst als aanvraag, bevestigd zodra een reisadviseur hem rond heeft.',
             'Vraagt u een reis aan bij het reisbureau. Vanaf dat moment staat hij hier, eerst als aanvraag, en bevestigd zodra een reisadviseur hem rond heeft.')
           || T('app.notrip.sub', 'Request a trip at the travel desk. From that moment it stands here: as a request first, and confirmed once a travel adviser has it settled.')),
         E('button', { class: 'go js-naarreisbureau' },
           (stem('Naar het reisbureau', 'Naar het reisbureau', 'Naar het reisbureau')
             || T('app.notrip.go', 'To the travel desk')) + ' →')]);
    /* De knop wijst naar de plek waar een reis ECHT ontstaat: het reisbureau
       (/apps/reisbureau.html). Daar vraag je een reis aan, en vanaf dat moment
       staat hij in je dossier -- als aanvraag, tot een reisadviseur hem
       bevestigt (server/kern/lid/reisdossier.js). Het is een eigen app en geen
       tabblad hier, dus geen data-goto maar een gewone navigatie. */
    const naarRb = $('#homeTrip .js-naarreisbureau');
    if (naarRb) naarRb.addEventListener('click', () => {
      location.href = '/apps/reisbureau.html' + (vastePas ? '?pas=' + encodeURIComponent(vastePas) : '');
    });
    Util.vervang($('#homePay'), open.length
      ? [E('div', { class: 'label' }, T('app.outstanding', 'Openstaand')),
         E('div', { class: 'big accent' }, eur(openSum)),
         E('div', { class: 'meta' }, open.length + ' ' + (open.length === 1 ? T('app.payment', 'betaling') : T('app.payments', 'betalingen')) + ' · ' + T('app.onetapfid', 'één tik met Face ID')),
         E('button', { class: 'go', dataset: { goto: 'betalen' } }, T('app.paynow', 'Nu betalen') + ' →')]
      : invoices.length
        ? [E('div', { class: 'label' }, T('app.payments.cap', 'Betalingen')),
           E('div', { class: 'big', style: { color: 'var(--green)' } }, T('app.allsettled', 'Alles voldaan')),
           E('div', { class: 'meta' }, T('app.nothingopen', 'Er staat niets open.'))]
        // nog nooit een factuur: zeg wat hier komt te staan in plaats van
        // "alles voldaan" over een lijst die niet bestaat
        : [E('div', { class: 'label' }, T('app.payments.cap', 'Betalingen')),
           E('div', { class: 'big' }, T('app.nobills', 'Nog geen rekeningen')),
           E('div', { class: 'meta' }, T('app.nobills.sub', 'Wat RTG voor u regelt en wat u bij partners besteedt, komt hier te staan, met btw en afboekcode erbij.'))]);
    $('#homeSalon').innerHTML =
      '<div class="label">'+T('app.thesalon','De Salon')+'</div>' +
      '<div class="big gold">' + nfmt(creatorLikes) + '</div>' +
      '<div class="meta">'+T('app.likesquarter','likes dit kwartaal, content levert voorrang, korting en gratis diensten op')+'</div>' +
      '<button class="go" data-goto="salon">'+T('app.tosalon','Naar De Salon')+' →</button>';
    document.querySelectorAll('#content [data-goto]').forEach(b =>
      b.addEventListener('click', () => openTab(b.dataset.goto)));
    renderContacts();
    renderFoundation();
  }

  // De gratis gebruiker (zonder pas): betalen bij partners, De Salon bekijken
  // en solliciteren. Geen ledenpas, geen reis, geen Rahul. Wat hij wel en niet
  // kan staat bij Ter plaatse -- dat is zijn app.
  function renderHomeGuest(){
    document.documentElement.setAttribute('data-stem', 'rtg');
    stemKoppen();
    $('#homeSub').textContent = T('app.guestsub','Gratis, zonder pas');
    const gastKaart = $('#homeGast');
    if (gastKaart){
      gastKaart.hidden = false;
      gastKaart.innerHTML =
        '<div class="label">'+T('app.guest.k','Gratis account')+'</div>'+
        '<div class="big" style="font-size:1.35rem;">'+T('app.guest.title','Zonder pas')+'</div>'+
        '<div class="meta" style="margin-top:0.75rem;line-height:1.55;">'+T('app.guest.body','Je kunt bij RTG-partners betalen via de app, de foto’s in De Salon bekijken en solliciteren op vacatures met je cv. Liken en reageren bij leden hoort bij een pas.')+'</div>';
    }
    const trip = $('#homeTrip'); if (trip) trip.style.display='none';
    // de gratis app is een bestel/betaal-app: toon de betaalgeschiedenis
    const pay = $('#homePay'); if (pay){ pay.style.display=''; pay.innerHTML = '<div class="label">'+T('app.guest.history','Mijn bestellingen en betalingen')+'</div><div class="meta">'+T('app.loading','Laden...')+'</div>'; }
    loadGuestHistory();
    const salon = $('#homeSalon');
    if (salon){ salon.style.display='';
      salon.innerHTML = '<div class="label">'+T('app.thesalon','De Salon')+'</div>'+
        '<div class="big" style="font-size:1.1rem;">'+T('app.guest.salon','Bekijk de foto’s')+'</div>'+
        '<div class="meta" style="margin:0.25rem 0 0.75rem;">'+T('app.guest.salonsub','Ontdek wat leden en partners delen.')+'</div>'+
        '<button class="go" data-goto="salon">'+T('app.tosalon','Naar De Salon')+' →</button>';
    }
    document.querySelectorAll('#content [data-goto]').forEach(b => b.addEventListener('click', () => openTab(b.dataset.goto)));
    const fEl = $('#homeFoundation'); if (fEl) fEl.style.display='none';
    const gtab = $('#tabGezin'); if (gtab) gtab.style.display='none';
    // een gratis account (met paspoort) kan vrienden toevoegen en met hen chatten
/* de betaalgeschiedenis van de gratis gebruiker */
    if (user.account) loadSocial(); else { const c = $('#homeContacts'); if (c) c.style.display='none'; }
  }
  // Betaalgeschiedenis van de gratis gebruiker: wat is besteld en betaald.
  async function loadGuestHistory(){
    const el = $('#homePay'); if (!el) return;
    let orders = [];
    try { orders = (await API.call('/orders/mine')).orders || []; } catch(e){}
    const betaald = orders.filter(o => o.paid);
    const som = betaald.reduce((s,o) => s + o.total, 0);
    const open = orders.filter(o => !o.paid);
    el.innerHTML = '<div class="label">'+T('app.guest.history','Mijn bestellingen en betalingen')+'</div>'+
      (orders.length
        ? '<div class="big" style="font-size:1.05rem;">'+eur(som)+' <span style="font-size:0.7rem;color:var(--soft);font-weight:400;">'+T('app.guest.paid','betaald')+'</span></div>'+
          '<div class="meta" style="margin:0.25rem 0 0.5rem;">'+betaald.length+' '+T('app.guest.paidorders','betaalde bestelling(en)')+(open.length?(' · '+open.length+' '+T('app.guest.open','open')):'')+'</div>'+
          '<div style="display:flex;flex-direction:column;gap:.45rem;">'+orders.slice(0,6).map(o=>{
            const kleur = o.paid ? 'var(--green,#4CAF7D)' : 'var(--gold)';
            const st = o.paid ? T('app.guest.ok','betaald') : T('app.guest.te','te betalen');
            return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;font-size:0.78rem;color:var(--muted);">'+
              '<span>'+escT(o.supplierName)+' · '+o.items.reduce((n,i)=>n+i.qty,0)+' '+T('app.items','item(s)')+' · '+timeAgo(o.at)+'</span>'+
              '<span style="flex-shrink:0;white-space:nowrap;">'+eur(o.total)+' · <span style="color:'+kleur+';">'+st+'</span>'+
              (o.paid?'':' <button class="pa" data-guestpay="'+o.ref+'" style="padding:.12rem .5rem;font-size:0.66rem;margin-left:0.25rem;">'+T('app.guest.paynow','betaal')+'</button>')+'</span></div>';
          }).join('')+'</div>'
        : '<div class="meta">'+T('app.guest.none','Je hebt nog niets besteld. Betaal bij een partner via Ter plaatse.')+'</div>');
    el.querySelectorAll('[data-guestpay]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/order/pay', { ref: b.dataset.guestpay }); toast(T('app.guest.paid2','Betaald.')); loadGuestHistory(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- RTFoundation: eigen gezinsruimte voor gekoppelde oppas/opa/oma ---------- */
  function esc(t){ return String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function renderFoundation(){
    const homeEl = $('#homeFoundation'), tab = $('#tabGezin'), dot = $('#tabGezinDot');
    if (!user || !user.account){ if(homeEl) homeEl.style.display='none'; if(tab) tab.style.display='none'; return; }
    const g = (rtf.gekoppeld || []), m = (rtf.meldingen || []);
    const ongelezen = m.filter(x=>!x.gelezen).length;
    if (tab) tab.style.display = g.length ? '' : 'none';
    if (dot) dot.style.display = (g.length && ongelezen) ? 'block' : 'none';
    // compacte ingang op Home
    if (homeEl){
      homeEl.style.display='';
      if (!g.length){
        homeEl.innerHTML = '<div class="label">RTFoundation</div>'+
          '<div class="big" style="font-size:1.05rem;line-height:1.4;">Ben je oppas, opa of oma?</div>'+
          '<div class="meta" style="margin:0.25rem 0 0.75rem;">Volg een RTFoundation-gezin met je pas, dan krijg je hun meldingen hier op je telefoon, zonder een extra app.</div>'+
          '<button class="go" id="rtfKoppelBtn">Koppel een gezin →</button>';
      } else {
        homeEl.innerHTML = '<div class="label">Je gezinsruimte'+(ongelezen?' · <span style="color:var(--rtg-leesgoud,var(--gold))">'+ongelezen+' nieuw</span>':'')+'</div>'+
          '<div class="big" style="font-size:1.05rem;">'+g.map(x=>esc(x.gezinNaam)).join(', ')+'</div>'+
          '<div class="meta" style="margin:0.25rem 0 0.75rem;">'+(ongelezen? ongelezen+' nieuwe melding'+(ongelezen>1?'en':'') : 'Alles gelezen')+'</div>'+
          '<button class="go" data-goto="gezin">Open je gezinsruimte →</button>';
      }
      const kb = $('#rtfKoppelBtn'); if (kb) kb.addEventListener('click', rtfKoppelStart);
      homeEl.querySelectorAll('[data-goto]').forEach(b=> b.addEventListener('click', ()=> openTab(b.dataset.goto)));
    }
    renderGezin();
  }
  function rtfBerichtHtml(x){
    return '<div style="padding:.55rem .7rem;border:1px solid var(--line);border-radius:0;margin:.4rem 0;'+(x.gelezen?'':'border-color:var(--burgundy,#C23A5E);')+(x.soort==='hulp'?'background:rgba(194,58,94,.08);':'')+'">'+
      '<div style="font-size:.72rem;color:var(--muted);">'+(x.soort==='hulp'?'':(x.soort==='reis'?'':''))+esc(x.gezin)+' · '+esc(x.van||'')+'</div>'+
      '<div style="font-size:.92rem;line-height:1.4;margin-top:0.25rem;white-space:pre-wrap;">'+esc(x.tekst)+'</div></div>';
  }
  function renderGezin(){
    const fam = $('#gezinFamilies'), feed = $('#gezinFeed'); if (!fam || !feed) return;
    const g = (rtf.gekoppeld || []), m = (rtf.meldingen || []);
    $('#gezinSub').textContent = g.length ? 'De RTFoundation-gezinnen die je als oppas of familie volgt.' : 'Je volgt nog geen gezin.';
    fam.innerHTML = '<div class="label">Gevolgde gezinnen</div>'+
      (g.length ? g.map(x=>'<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);"><b class="h-flex1">'+esc(x.gezinNaam)+'</b><span class="meta">als '+esc(x.profielNaam)+'</span><button class="go" style="background:transparent;color:var(--muted);padding:.2rem .4rem;" data-los="'+x.code+'|'+x.profielId+'">Ontkoppel</button></div>').join('') : '<div class="meta">Nog geen gezin gekoppeld.</div>')+
      '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:0.75rem;"><button class="go" id="rtfKoppelBtn2">Koppel een gezin →</button><button class="go" id="rtfPushBtn" style="background:transparent;color:var(--muted);">Meldingen op mijn telefoon</button></div>';
    feed.innerHTML = '<div class="label">Meldingen van het gezin</div>'+
      (m.length ? m.slice(0,30).map(rtfBerichtHtml).join('') : '<div class="meta">Nog geen meldingen. Zodra het gezin iets deelt, zie je het hier en op je telefoon.</div>')+
      (g.length ? '<div style="display:flex;gap:.5rem;margin-top:.8rem;"><input id="rtfReplyIn" placeholder="Antwoord het gezin..." style="flex:1;background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:0;padding:.6rem .8rem;color:var(--txt);"><button class="go" id="rtfReplyBtn">Stuur</button></div>' : '');
    fam.querySelectorAll('[data-los]').forEach(b=> b.addEventListener('click', async ()=>{ const [code,pid]=b.dataset.los.split('|'); if(!confirm('Dit gezin niet meer volgen?')) return; try{ await API.call('/rtf/ontkoppel',{code,profielId:pid}); toast('Ontkoppeld.'); await refreshState(); renderFoundation(); if(!(rtf.gekoppeld||[]).length) openTab('home'); }catch(e){ toast(e.message); } }));
    const kb=$('#rtfKoppelBtn2'); if(kb) kb.addEventListener('click', rtfKoppelStart);
    const pb=$('#rtfPushBtn'); if(pb) pb.addEventListener('click', ()=> ensurePush(true));
    const rb=$('#rtfReplyBtn'); if(rb) rb.addEventListener('click', rtfReply);
    const ri=$('#rtfReplyIn'); if(ri) ri.addEventListener('keydown', e=>{ if(e.key==='Enter') rtfReply(); });
    if (m.filter(x=>!x.gelezen).length) API.call('/rtf/meldingen/gelezen').catch(()=>{});
    if (g.length){ laadGezinInfo(); laadGezinChat(); } else { const gc=$('#gezinChat'); if(gc) gc.style.display='none'; }
  }
  let grtInit=false, grtActief=null;
  async function laadGezinChat(){
    const box=$('#gezinChat'); if(!box) return;
    const g=(rtf.gekoppeld||[]); if(!g.length){ box.style.display='none'; return; }
    box.style.display='';
    let kan; try{ kan=await API.call('/rtf/kanaal',{ code:g[0].code }); }catch(e){ box.innerHTML='<div class="meta">Chat is nu niet beschikbaar.</div>'; return; }
    if (!grtInit && window.GezinRT){ GezinRT.init({ base:'/api/foundation', code:kan.code, token:kan.token, mijnId:kan.profielId, mijnNaam:'ik', leden:kan.leden, onChat:onGrtChat }); grtInit=true; }
    else if (window.GezinRT){ GezinRT.setLeden(kan.leden); }
    let chats=[]; try{ chats=(await GezinRT.chats()).chats||[]; }catch(e){}
    const byId={}; chats.forEach(c=> byId[c.id]=c);
/* het gezinsblok: chatten en bellen met het gezin */
    box.innerHTML='<div class="label">Chat en bellen</div>'+
      '<div class="meta" style="margin-bottom:0.5rem;">Bericht of (video)bel het gezin in de app.</div>'+
      kan.leden.map(function(l){ var c=byId[l.id]||{}; return '<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);"><span style="width:2rem;height:2rem;border-radius:50%;background:'+(l.kleur||'#C9A24B')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.85rem;font-weight:700;color:#0C0C0B;">'+(l.avatar||esc((l.naam||'?').charAt(0).toUpperCase()))+'</span><div class="grow-min"><b>'+esc(l.naam)+'</b>'+(c.ongelezen?' <span style="color:var(--burgundy);">('+c.ongelezen+')</span>':'')+(c.laatste?'<div class="meta" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(c.laatste)+'</div>':'')+'</div><button class="go" style="padding:.2rem .5rem;" data-chat="'+l.id+'">Chat</button><button class="go" style="background:transparent;padding:.2rem .4rem;" data-bel="'+l.id+'">'+RTGGlyf.svgHTML('bellen')+'</button><button class="go" style="background:transparent;padding:.2rem .4rem;" data-video="'+l.id+'">'+RTGGlyf.svgHTML('videobellen')+'</button></div>'; }).join('')+
      '<div id="grtThread" style="display:none;margin-top:0.75rem;"></div>';
    box.querySelectorAll('[data-chat]').forEach(function(b){ b.onclick=function(){ openGrtThread(b.dataset.chat, kan.leden.find(function(x){return x.id===b.dataset.chat;})); }; });
    box.querySelectorAll('[data-bel]').forEach(function(b){ b.onclick=function(){ GezinRT.bel(b.dataset.bel,false); }; });
    box.querySelectorAll('[data-video]').forEach(function(b){ b.onclick=function(){ GezinRT.bel(b.dataset.video,true); }; });
  }
  function grtMsgHtml(m){ var mij=m.vanMij; var inner = mij ? esc(m.tekst) : '<span class="xlate">'+esc(m.tekst)+'</span>'; return '<div style="align-self:'+(mij?'flex-end':'flex-start')+';max-width:80%;padding:.4rem .7rem;border-radius:0;'+(mij?'background:var(--gold);color:#1a1710;':'background:var(--card2,#1B1817);border:1px solid var(--line);')+'white-space:pre-wrap;">'+inner+'</div>'; }
  function scrollGrt(){ var m=$('#grtMsgs'); if(m) m.scrollTop=m.scrollHeight; }
  async function openGrtThread(id, lid){
    grtActief=id; var t=$('#grtThread'); t.style.display='';
    var d={berichten:[]}; try{ d=await GezinRT.thread(id); }catch(e){}
    t.innerHTML='<div style="font-weight:600;margin-bottom:0.5rem;">Gesprek met '+esc(lid?lid.naam:'')+'</div>'+
      '<div id="grtMsgs" style="max-height:14rem;overflow:auto;display:flex;flex-direction:column;gap:.3rem;">'+(d.berichten||[]).map(grtMsgHtml).join('')+'</div>'+
      '<div style="display:flex;gap:.5rem;margin-top:.5rem;"><input id="grtIn" placeholder="Bericht..." style="flex:1;background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:0;padding:.5rem .7rem;color:var(--txt);"><button class="go" id="grtStuur">Stuur</button></div>';
    $('#grtStuur').onclick=grtStuur; $('#grtIn').addEventListener('keydown',function(e){ if(e.key==='Enter') grtStuur(); });
    vertaalBubbels($('#grtMsgs'));
    scrollGrt();
  }
  async function grtStuur(){ var inp=$('#grtIn'); if(!inp) return; var t=(inp.value||'').trim(); if(!t||!grtActief) return; inp.value=''; try{ var r=await GezinRT.stuur(grtActief,t); var el=$('#grtMsgs'); if(el){ el.insertAdjacentHTML('beforeend', grtMsgHtml({tekst:r.bericht.tekst,vanMij:true})); scrollGrt(); } }catch(e){ toast(e.message); } }
  function onGrtChat(m){ if(grtActief && m.van===grtActief){ var el=$('#grtMsgs'); if(el){ el.insertAdjacentHTML('beforeend', grtMsgHtml({tekst:m.tekst,vanMij:false})); vertaalBubbels(el); scrollGrt(); } } }
  const telHref = t => 'tel:' + String(t||'').replace(/[^0-9+]/g,'');
  function geleden(iso){ const s=Math.floor((Date.now()-new Date(iso).getTime())/1000); if(s<60)return 'net nu'; if(s<3600)return Math.floor(s/60)+' min geleden'; if(s<86400)return Math.floor(s/3600)+' uur geleden'; return Math.floor(s/86400)+' dag(en) geleden'; }
  function datumKort(d){ try{ const dt=new Date(d+'T00:00:00'); const vd=new Date(); vd.setHours(0,0,0,0); const mo=new Date(vd); mo.setDate(mo.getDate()+1); if(dt.getTime()===vd.getTime())return 'Vandaag'; if(dt.getTime()===mo.getTime())return 'Morgen'; return dt.toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}); }catch(e){ return d; } }
  async function laadGezinInfo(){
    const box = $('#gezinInfo'); if(!box) return;
    let d; try{ d = await API.call('/rtf/overzicht'); }catch(e){ box.innerHTML=''; return; }
    box.innerHTML = (d.gezinnen||[]).map(gz=>{
      const o = gz.oppasinfo||{};
      const meerdan1 = (d.gezinnen||[]).length>1;
      let h = '';
      if (meerdan1) h += '<div class="label" style="margin:0.5rem 0 0.25rem;color:var(--burgundy);">'+esc(gz.gezinNaam)+'</div>';
      // Belangrijke info
      h += '<div class="card"><div class="label">Belangrijke info</div>';
      h += (o.noodcontacten&&o.noodcontacten.length)
        ? '<div style="margin:0.25rem 0 0.5rem;">'+o.noodcontacten.map(c=>'<a href="'+telHref(c.telefoon)+'" style="display:flex;align-items:center;gap:.5rem;padding:.45rem 0;border-bottom:1px solid var(--line);text-decoration:none;color:var(--txt);"><b class="h-flex1">'+esc(c.naam||'Contact')+(c.wie?' <span class="meta">· '+esc(c.wie)+'</span>':'')+'</b><span style="color:var(--gold);">'+esc(c.telefoon)+'</span></a>').join('')+'</div>'
        : '';
      h += infoRij('Allergieën en medisch', o.allergie);
      h += infoRij('Eten en bedtijden', o.eten);
      h += infoRij('Huisregels', o.huisregels);
      if (!(o.noodcontacten&&o.noodcontacten.length) && !o.allergie && !o.eten && !o.huisregels) h += '<div class="meta">Het gezin heeft nog geen info ingevuld.</div>';
      h += '<div class="meta h-mt60">Bij nood: bel 112.</div></div>';
      // Agenda
      const ag = (gz.agenda||[]).filter(a=>!a.voorbij).slice(0,8);
      h += '<div class="card"><div class="label">Agenda</div>'+
        (ag.length ? ag.map(a=>'<div style="display:flex;gap:.6rem;padding:.4rem 0;border-bottom:1px solid var(--line);"><b style="color:var(--gold);white-space:nowrap;">'+(a.tijd||datumKort(a.datum))+'</b><span class="h-flex1">'+esc(a.titel)+(a.wieNaam?' <span class="meta">· '+esc(a.wieNaam)+'</span>':'')+'<div class="meta">'+datumKort(a.datum)+'</div></span></div>').join('') : '<div class="meta">Niets gepland.</div>')+'</div>';
      // Waar is iedereen
      const loc = (gz.locaties||[]);
      h += '<div class="card"><div class="label">Waar is iedereen</div>'+
        (loc.length ? loc.map(l=>'<div style="display:flex;align-items:center;gap:.6rem;padding:.45rem 0;border-bottom:1px solid var(--line);"><span style="width:1.8rem;height:1.8rem;border-radius:50%;background:'+(l.kleur||'#C9A24B')+';display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;color:#0C0C0B;">'+(l.avatar||esc((l.naam||'?').charAt(0).toUpperCase()))+'</span><div class="h-flex1"><b>'+esc(l.naam)+'</b><div class="meta">'+esc(l.status)+' · '+geleden(l.at)+'</div></div>'+(l.lat!=null?'<a href="geo:'+l.lat+','+l.lon+'?q='+l.lat+','+l.lon+'" target="_blank" rel="noopener" style="color:var(--gold);white-space:nowrap;">Kaart →</a>':'')+'</div>').join('') : '<div class="meta">Niemand deelt nu iets.</div>')+'</div>';
      return h;
    }).join('');
  }
  function infoRij(titel, tekst){ return tekst ? '<div class="h-mt50"><div class="meta" style="font-weight:600;color:var(--txt);">'+esc(titel)+'</div><div style="white-space:pre-wrap;line-height:1.4;font-size:.92rem;">'+esc(tekst)+'</div></div>' : ''; }
  async function rtfReply(){
    const inp=$('#rtfReplyIn'); if(!inp) return; const t=(inp.value||'').trim(); if(!t) return;
    const g=(rtf.gekoppeld||[]); if(!g.length) return;
    try{ await API.call('/rtf/bericht',{ code:g[0].code, tekst:t }); inp.value=''; toast('Verstuurd naar '+g[0].gezinNaam+'.'); }
    catch(e){ toast(e.message); }
  }
  async function rtfKoppelStart(){
    const uitnodiging = prompt('Plak de persoonlijke uitnodigingslink of code die je van het gezin kreeg:');
    if (!uitnodiging) return;
    try {
      const r = await API.call('/rtf/uitnodiging/accepteer', { uitnodiging: uitnodiging.trim() });
      toast('Gekoppeld aan '+r.gezinNaam+'. Je krijgt hun meldingen nu ook op je telefoon.');
      await refreshState(); renderFoundation(); openTab('gezin');
      ensurePush(true);
    } catch(e){ toast(e.message || 'Koppelen lukte niet.'); }
  }
  // web-push aanzetten voor gezinsmeldingen op de telefoon
  function urlB64ToUint8(base64){
    const pad='='.repeat((4-base64.length%4)%4); const b=(base64+pad).replace(/-/g,'+').replace(/_/g,'/');
/* pushmeldingen aanzetten en de sleutel omzetten */
    const raw=atob(b); const arr=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i); return arr;
  }
  async function ensurePush(interactief){
    try{
      if (!('serviceWorker' in navigator) || !('PushManager' in window)){ if(interactief) toast('Push wordt op dit toestel niet ondersteund.'); return; }
      const keyRes = await fetch('/api/push/key').then(r=>r.json()).catch(()=>({}));
      if (!keyRes.key){ if(interactief) toast('Meldingen zijn nu niet beschikbaar.'); return; }
      if (interactief || Notification.permission==='default'){
        const perm = await Notification.requestPermission();
        if (perm !== 'granted'){ if(interactief) toast('Zet meldingen aan in je instellingen om ze te ontvangen.'); return; }
      } else if (Notification.permission !== 'granted'){ return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: urlB64ToUint8(keyRes.key) });
      await API.call('/push/subscribe', { subscription: sub });
      if (interactief) toast('Top! Gezinsmeldingen komen nu ook op je telefoon binnen.');
    }catch(e){ if(interactief) toast('Meldingen aanzetten lukte niet.'); }
  }

  /* ---------- reizen ---------- */

  function renderTrip(){
    /* Nog geen reis: dan staat hier wat een reisoverzicht IS en hoe het ontstaat.
       Een nieuw account begint leeg en erft de demo-reis niet meer. */
    if (!trip){
      $('#tripSub').textContent = T('app.trip.emptysub','Uw reisoverzicht is nog leeg.');
      const uitleg = (k, kop, tekst) =>
        '<div class="rowitem"><div class="t"><b>' + T('app.trip.' + k, kop) + '</b><span>' +
          T('app.trip.' + k + 's', tekst) + '</span></div></div>';
      $('#tripList').innerHTML =
        uitleg('e1', 'Vlucht, verblijf en transfer',
          'Alles wat RTG aanvraagt komt hier per dag onder elkaar te staan, met de status erbij.') +
        uitleg('e2', 'Wat nog niet vaststaat',
          'Een aanvraag blijft een aanvraag tot de partner ja zegt. RTG bevestigt niets namens hen.') +
        uitleg('e3', 'Beginnen doe je bij het reisbureau',
          'Vraag daar een reis aan; vanaf dat moment staat hij hier, en Rahul denkt mee over de rest.');
      renderAgenda();
      return;
    }
    $('#tripSub').textContent = trip.dest + ' · ' + trip.dates + ' · ' + T('app.in','over') + ' ' + trip.days + ' ' + T('app.days','dagen');
    $('#tripList').innerHTML = trip.items.map(it =>
      '<div class="rowitem">' +
        '<div class="t"><b>' + it.title + '</b><span>' + it.when + ' · ' + it.sub + '</span></div>' +
        '<span class="pill ' + (it.status === 'paid' ? 'paid' : it.status === 'req' ? 'req' : 'open') + '">' + tLbl(it.label) + '</span>' +
      '</div>').join('');
    renderAgenda();
  }

  /* de reisagenda: alles met een datum (tafels, tickets, ritten, events)
     automatisch samengevoegd tot een dagprogramma onder de reis */
  const AGENDA_ICO = {};  // geen emoji-markers meer; alle items dragen het rustige '·'
  async function renderAgenda(){
    if (!API.live) return;
    let wrap = $('#agendaWrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.id = 'agendaWrap';
      $('#tripList').insertAdjacentElement('afterend', wrap);
    }
    let dagen = [];
    try { dagen = (await API.call('/agenda/mijn')).dagen || []; } catch(e){ return; }
    if (!dagen.length){ wrap.innerHTML = ''; return; }
    const dagNaam = d => new Date(d + 'T12:00:00').toLocaleDateString(lang() === 'en' ? 'en-GB' : 'nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
    wrap.innerHTML = '<div class="sec-label h-mt120">' + T('erv.agenda','Mijn programma') + '</div>' +
      dagen.map(d =>
        '<div style="font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--rtg-leesgoud,var(--gold));margin:0.7rem 0 0.35rem;">' + dagNaam(d.datum) + '</div>' +
        d.items.map(it =>
          '<div class="rowitem"><div class="t"><b>' + (AGENDA_ICO[it.soort] || '·') + ' ' + it.titel + '</b><span>' + (it.tijd || T('erv.heledag','hele dag')) + ' · ' + tStatus(it.status) + '</span></div></div>'
        ).join('')
      ).join('');
  }

  /* ---------- betalen (Face ID) ---------- */

  const FID = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M6 19 V13 a7 7 0 0 1 7-7 h6"/><path d="M45 6 h6 a7 7 0 0 1 7 7 v6"/>' +
    '<path d="M58 45 v6 a7 7 0 0 1-7 7 h-6"/><path d="M19 58 h-6 a7 7 0 0 1-7-7 v-6"/>' +
    '<circle cx="23.5" cy="26.5" r="2.6" fill="currentColor" stroke="none"/><circle cx="40.5" cy="26.5" r="2.6" fill="currentColor" stroke="none"/>' +
    '<path d="M32 26 v8.5 a2.2 2.2 0 0 1-2.2 2.2"/><path d="M23 42.5 a12.5 8.5 0 0 0 18 0"/></svg>';
  const CHECK = '<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28" stroke="#2E6B4F" stroke-width="3.5"/>' +
    '<path d="M20 33 l8.5 8.5 L45 23" stroke="#2E6B4F" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  async function executePay(target){
    let foundation = 0;
    if (API.live){
      const data = await API.call('/pay', target === 'all' ? {all:true} : {invoiceId: target});
      foundation = data.foundation;
      applyState(data.state);
    } else {
      const targets = target === 'all' ? invoices.filter(i => i.status === 'open') : invoices.filter(i => i.id === target);
      for (const inv of targets){
        inv.status = 'paid'; inv.date = 'Zojuist betaald';
        foundation += Math.round(inv.bijdrage * 0.3);
        for (const t of (trip ? trip.items : [])) if (t.invoiceId === inv.id){ t.status = 'paid'; t.label = 'Bevestigd'; }
      }
    }
    return foundation;
  }

  let payBusy = false;
  function payWithFaceId(amount, doPay, opts){
    if (payBusy) return;
    opts = opts || {};
    payBusy = true;
    const pw = $('#paywait'), card = pw.querySelector('.paycard');
    $('#payAmt').textContent = amount;
    $('#payIcon').innerHTML = FID.replace(/currentColor/g, '#0C0C0B');
    $('#payLbl').textContent = T('app.payingfid','Betalen met Face ID…');
    card.classList.add('scanning'); card.classList.remove('done');
    pw.classList.add('open');
    setTimeout(async () => {
      try {
        const result = await doPay();
        card.classList.remove('scanning'); card.classList.add('done');
        $('#payIcon').innerHTML = CHECK;
        $('#payLbl').textContent = T('app.confirmed','Bevestigd');
        setTimeout(() => {
          pw.classList.remove('open');
          payBusy = false;
          if (opts.message) toast(opts.message(result));
          else { toast(T('app.paid','Betaald') + '. ' + eur(result) + ' ' + T('app.tofoundation','gaat naar de RTFoundation.')); renderPay(); renderHome(); renderTrip(); }
          if (opts.after) opts.after(result);
        }, 700);
      } catch (e) {
        pw.classList.remove('open');
        payBusy = false;
        toast(e.message || T('app.payfailed','Betaling mislukt.'));
      }
    }, 1100);
  }

  /* ---------- betalen met munten (crypto) ----------
     Kies een munt, ontvang het exacte bedrag en een adres. RTG zet de munten via
     een vergunninghoudende aanbieder meteen om naar euro; wij houden zelf geen
     crypto vast. Zodra het netwerk bevestigt, zetten we de factuur op betaald. */
  let muntPoll = null;
  function muntStop(){ if (muntPoll){ clearInterval(muntPoll); muntPoll = null; } }
  // cfg: { euro, titel, maak: async(munt)=>verzoek, klaar?: async()=>bool }
  function openMuntSheet(cfg){
    muntStop();
    let ov = document.getElementById('munt-ov');
    if (!ov){ ov = document.createElement('div'); ov.id = 'munt-ov';
      ov.style.cssText = 'position:fixed;inset:0;z-index:130;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov){ muntStop(); ov.remove(); } });
    }
    const munten = (muntOpties && muntOpties.munten) || [];
    const naam = { btc:'Bitcoin', eth:'Ethereum', usdc:'USD Coin', usdt:'Tether' };
    ov.innerHTML = '<div style="width:100%;max-width:460px;background:var(--bg);border-radius:0;border:1px solid var(--line);padding:1.1rem 1.2rem 1.4rem;">' +
      '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;"><b style="font-size:1rem;">◈ ' + escT(cfg.titel || T('munt.title','Betaal met munten')) + '</b>' +
        '<button id="muntX" style="margin-left:auto;background:none;border:none;color:var(--muted);font-size:1.1rem;cursor:pointer;">✕</button></div>' +
      '<div style="font-size:0.78rem;color:var(--soft);margin-bottom:0.8rem;">' + T('munt.bedrag','Te betalen') + ': <b style="color:var(--txt);">' + eur(cfg.euro) + '</b>. ' + T('munt.omzet','RTG zet uw munten meteen om naar euro.') + '</div>' +
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.2rem;">' +
        munten.map(m => '<button class="js-muntpick" data-munt="' + m.munt + '" style="flex:1;min-width:5rem;background:var(--card);border:1px solid var(--line);color:var(--txt);border-radius:0;padding:0.6rem;font-family:inherit;cursor:pointer;"><b style="text-transform:uppercase;">' + m.munt + '</b><br><span style="font-size:0.62rem;color:var(--soft);">' + (naam[m.munt] || m.munt) + '</span></button>').join('') +
      '</div>' +
      '<div id="muntDetail"></div></div>';
    ov.querySelector('#muntX').addEventListener('click', () => { muntStop(); ov.remove(); });
    ov.querySelectorAll('.js-muntpick').forEach(b => b.addEventListener('click', () => muntVraag(cfg, b.dataset.munt)));
  }

  async function muntVraag(cfg, munt){
    const det = document.getElementById('muntDetail');
    if (det) det.innerHTML = '<div style="font-size:0.8rem;color:var(--soft);padding:0.6rem 0;">' + T('munt.laden','Adres aanmaken…') + '</div>';
    let vz;
    try { vz = await cfg.maak(munt); }
/* de details van een verzending */
    catch(e){ if (det) det.innerHTML = '<div style="font-size:0.8rem;color:var(--burgundy);padding:0.6rem 0;">' + (e.message || T('munt.fout','Kon geen adres maken.')) + '</div>'; return; }
    if (!det || !vz) return;
    const dot = '<span style="width:8px;height:8px;border-radius:50%;background:var(--gold);display:inline-block;flex-shrink:0;"></span>';
    det.innerHTML =
      '<div style="background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.9rem 1rem;margin-top:0.6rem;">' +
        '<div style="font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">' + T('munt.stuur','Stuur exact') + '</div>' +
        '<div style="font-family:\'Bodoni Moda\',serif;font-size:1.5rem;color:var(--rtg-leesgoud,var(--gold));margin:0.15rem 0 0.1rem;">' + vz.bedragMunt + ' <span style="text-transform:uppercase;font-size:1rem;">' + munt + '</span></div>' +
        '<div style="font-size:0.66rem;color:var(--muted);">≈ ' + eur((vz.euroCenten || 0) / 100) + ' · ' + T('munt.koers','koers vastgezet') + '</div>' +
        '<div style="font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);margin-top:0.7rem;">' + T('munt.adres','Naar dit adres') + '</div>' +
        '<div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.2rem;">' +
          '<code style="flex:1;font-size:0.66rem;word-break:break-all;color:var(--txt);background:rgba(0,0,0,0.15);border-radius:0;padding:0.4rem 0.5rem;">' + escT(vz.adres) + '</code>' +
          '<button id="muntCopy" style="flex-shrink:0;background:none;border:1px solid var(--line);border-radius:0;padding:0.3rem 0.6rem;font-size:0.62rem;color:var(--muted);cursor:pointer;">' + T('munt.kopieer','Kopieer') + '</button>' +
        '</div>' +
        '<div style="margin-top:0.75rem;font-size:0.72rem;color:var(--soft);display:flex;align-items:center;gap:0.4rem;">' + dot + T('munt.wacht','Wachten op bevestiging van het netwerk…') + '</div>' +
      '</div>';
    const cp = document.getElementById('muntCopy');
    if (cp) cp.addEventListener('click', async () => { try { await navigator.clipboard.writeText(vz.adres); toast(T('munt.gekopieerd','Adres gekopieerd.')); } catch(e){ toast(vz.adres); } });
    // Poll: de aanbieder-webhook bevestigt de ontvangst. In demo blijft dit staan
    // tot een echte ontvangst binnenkomt.
    if (typeof cfg.klaar !== 'function') return;
    muntStop();
    let n = 0;
    muntPoll = setInterval(async () => {
      n++;
      try {
        if (await cfg.klaar()){
          muntStop();
          const o = document.getElementById('munt-ov'); if (o) o.remove();
          toast('◈ ' + T('munt.ontvangen','Betaald met munten. Dank u.'));
          renderPay(); renderHome();
        }
      } catch(e){}
      if (n > 150) muntStop(); // na ~10 minuten stoppen met pollen
    }, 4000);
  }

  /* ---------- rechtstreeks betalen aan een partner (Face ID) ----------
     Overal in de app: één bedrag, Face ID, geld gaat direct naar de partner.
     Bereikbaar vanuit de Salon en vanuit de AI/concierge. */
  function betaalPartner(code, name, opts){
    opts = opts || {};
    const idem = RTGIdem('dp');
    let ov = document.getElementById('dp-ov');
    if (!ov){ ov = document.createElement('div'); ov.id = 'dp-ov';
      ov.style.cssText = 'position:fixed;inset:0;z-index:130;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    }
    ov.innerHTML = '<div style="width:100%;max-width:460px;background:var(--bg);border-radius:0;border:1px solid var(--line);padding:1.1rem 1.2rem 1.4rem;">' +
      '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.2rem;"><b style="font-size:1rem;">' + FID_MINI + T('dp.title','Betaal direct') + '</b>' +
        '<button id="dpX" style="margin-left:auto;background:none;border:none;color:var(--muted);font-size:1.1rem;cursor:pointer;">✕</button></div>' +
      '<div style="font-size:0.8rem;color:var(--soft);margin-bottom:0.75rem;">' + T('dp.naar','Aan') + ' <b style="color:var(--txt);">' + escT(name) + '</b>. ' + T('dp.direct','Het bedrag gaat rechtstreeks naar de partner.') + '</div>' +
      (opts.omschrijving ? '<div style="font-size:0.82rem;margin-bottom:0.5rem;">' + escT(opts.omschrijving) + '</div>' : '') +
      '<label style="font-size:0.72rem;color:var(--soft);">' + T('dp.bedrag','Bedrag (€)') + '</label>' +
      '<input id="dpBedrag" type="number" inputmode="decimal" min="0.50" step="0.50" ' + (opts.bedrag ? 'value="' + opts.bedrag + '"' : '') + ' style="width:100%;font-size:1.3rem;padding:0.6rem 0.8rem;margin:0.25rem 0 0.7rem;background:var(--card);border:1px solid var(--line);border-radius:0;color:var(--txt);">' +
      '<input id="dpNote" placeholder="' + T('dp.note','Waarvoor? (optioneel)') + '" ' + (opts.omschrijving ? 'value="' + escT(opts.omschrijving) + '"' : '') + ' style="width:100%;padding:0.55rem 0.8rem;margin-bottom:0.9rem;background:var(--card);border:1px solid var(--line);border-radius:0;color:var(--txt);">' +
      '<button id="dpPay" class="mo-pay" style="width:100%;justify-content:center;padding:0.8rem;">' + FID_MINI + T('app.paywithfid','Betaal met Face ID') + '</button>' +
      (muntOpties && muntOpties.aan ? '<button id="dpMunt" style="width:100%;margin-top:0.5rem;background:none;border:1px solid var(--line);color:var(--muted);border-radius:0;padding:0.7rem;font-family:inherit;font-size:0.8rem;cursor:pointer;">◈ ' + T('fin.paycoins','Met munten') + '</button>' : '') +
      '</div>';
    ov.querySelector('#dpX').addEventListener('click', () => ov.remove());
    const dpLees = () => {
      const bedrag = Math.round(Number(ov.querySelector('#dpBedrag').value) * 100) / 100;
      if (!(bedrag >= 0.5)) { toast(T('dp.min','Kies een bedrag van minstens € 0,50.')); return null; }
      return { bedrag, note: (ov.querySelector('#dpNote').value || '').trim() };
    };
    ov.querySelector('#dpPay').addEventListener('click', () => {
      const v = dpLees(); if (!v) return;
      ov.remove();
      payWithFaceId(eur(v.bedrag), async () => {
        const d = await API.call('/betaal/direct', { supplierCode: code, bedrag: v.bedrag, omschrijving: v.note, bron: opts.bron || 'app', idem });
        return d.betaling;
      }, { message: b => T('dp.betaald','Betaald aan') + ' ' + name + ': ' + eur((b.bedrag||0)/100), after: () => { if (opts.after) opts.after(); } });
    });
    const dm = ov.querySelector('#dpMunt');
    if (dm) dm.addEventListener('click', () => {
      const v = dpLees(); if (!v) return;
      ov.remove();
      openMuntSheet({
        euro: v.bedrag, titel: name,
        maak: async (munt) => (await API.call('/munt/direct', { supplierCode: code, bedrag: v.bedrag, omschrijving: v.note, munt })).verzoek,
        klaar: async () => { const mine = (await API.call('/betaal/mijn')).betalingen || []; return mine.some(p => p.betaalwijze === 'munt' && p.supplierCode === code && Math.round(p.bedrag) === Math.round(v.bedrag * 100)); }
      });
    });
  }
  // Een betaalverzoek van een partner met Face ID afrekenen.
  function betaalVerzoekPay(v){
    payWithFaceId(eur((v.bedrag||0)/100), async () => {
      const d = await API.call('/betaal/verzoek/pay', { ref: v.ref, idem: 'bv-' + v.ref });
      return d.betaling;
    }, { message: () => T('dp.verzoekbetaald','Betaalverzoek voldaan:') + ' ' + eur((v.bedrag||0)/100), after: () => { laadBetaalVerzoeken(); renderHome(); } });
  }
  // open betaalverzoeken ophalen (aan dit lid gericht)
  let betaalVerzoeken = [];
  async function laadBetaalVerzoeken(){
    if (!user || user.tier === 'guest') { betaalVerzoeken = []; return; }
    try { betaalVerzoeken = (await API.call('/betaal/verzoeken', {})).verzoeken || []; } catch(e){ betaalVerzoeken = []; }
  }

  function renderPay(){
    const open = invoices.filter(i => i.status === 'open');
    const openSum = open.reduce((s,i) => s + i.netto + i.bijdrage, 0);
    // Munt-opties eenmalig laden; zodra bekend, deze weergave opnieuw tekenen
    // (dan verschijnen de munt-knoppen). Verandert niets als acceptatie uit staat.
    if (muntOpties === null && API.live) { laadMuntOpties().then(() => renderPay()); }
    const muntAan = !!(muntOpties && muntOpties.aan && user && user.tier !== 'guest');
    // Business Pass: de volledige, boekhoudklare specificatie onder elke factuur
    // (incl. afboekcode en btw). RTG en Lifestyle houden de rustige weergave.
    const eurC = n => '€ ' + Number(n).toLocaleString(lang() === 'en' ? 'en-US' : 'nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const specRow = (l, v, strong) => '<div style="display:flex;justify-content:space-between;gap:1rem;"><span>' + l + '</span><span style="text-align:right;flex-shrink:0;' + (strong ? 'color:var(--txt);font-weight:600;' : '') + '">' + v + '</span></div>';
/* de zakelijke specificatie op een factuur */
    const bizSpec = inv => {
      if (user.tier !== 'business') return '';
      const total = inv.netto + inv.bijdrage;
      return '<div style="margin:0 0 0.9rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.8rem 1rem;font-size:0.7rem;color:var(--muted);line-height:1.8;">' +
        '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--rtg-leesgoud,var(--gold));margin-bottom:0.3rem;">' + T('inv.spec','Factuurspecificatie') + '</div>' +
        specRow(T('inv.number','Factuurnummer'), inv.id) +
        specRow(T('inv.holder','Op naam van'), user.codename + ' · Business Pass') +
        (inv.netto > 0 ? specRow(T('inv.net','Nettoprijs (inkoop)'), eurC(inv.netto)) : '') +
        specRow(T('inv.contrib','Ledenbijdrage'), eurC(inv.bijdrage)) +
        specRow(T('inv.foundation','waarvan naar de RTFoundation (30%)'), eurC(Math.round(inv.bijdrage / 1.21 * 0.3 * 100) / 100)) +
        specRow(T('inv.vat','Btw 21% (in de bijdrage begrepen)'), eurC(inv.btw || 0)) +
        (inv.netto > 0 ? specRow(T('inv.toms','Reisdeel: btw-margeregeling reisdiensten'), eurC(0)) : '') +
        specRow(T('inv.total','Totaal'), eurC(total), true) +
        specRow(T('inv.ledger','Afboekcode (grootboek)'), '<b style="color:var(--txt);">' + (inv.afboekcode || '4510') + '</b> · ' + (inv.afboeklabel || '')) +
        '<div style="margin-top:0.5rem;border-top:1px solid var(--line);padding-top:0.5rem;font-size:0.64rem;">RTG (Rahul Travel Group) · KvK 82273510 · btw NL002291440B89 · ' + RTG_IBAN + '</div>' +
      '</div>';
    };
    // Financiën in één oogopslag: openstaand, dit jaar betaald, en de eigen
    // bijdrage aan de RTFoundation. Voor elke pas, rustig en zonder uitleg.
    const isContrib = d => /lidmaatschap|jaarbijdrage|maandbijdrage/i.test(d || '');
    const paidInv = invoices.filter(i => i.status === 'paid');
    const betaaldSom = paidInv.reduce((s,i) => s + i.netto + i.bijdrage, 0);
    const rtfBij = paidInv.filter(i => isContrib(i.desc)).reduce((s,i) => s + Math.round(i.bijdrage / 1.21 * 0.3 * 100) / 100, 0);
    const rtfKomt = open.filter(i => isContrib(i.desc)).reduce((s,i) => s + Math.round(i.bijdrage / 1.21 * 0.3 * 100) / 100, 0);
    const btwSom = paidInv.reduce((s,i) => s + (i.btw || 0), 0);
    const tegel = (l, v, klas) => '<div style="flex:1;min-width:6.5rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.7rem;">' +
      '<div style="font-size:0.56rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">' + l + '</div>' +
      '<div style="font-family:\'Bodoni Moda\',serif;font-size:1.15rem;margin-top:0.15rem;' + (klas === 'g' ? 'color:var(--rtg-leesgoud,var(--gold));' : '') + '">' + v + '</div></div>';
    const finKaart = '<div style="margin-bottom:0.9rem;">' +
      '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);margin:0 0 0.5rem;">' + T('fin.title','Uw financiën') + '</div>' +
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
        tegel(T('fin.open','Openstaand'), eur(openSum)) +
        tegel(T('fin.paid','Betaald'), eur(betaaldSom)) +
        tegel(T('fin.rtf','Naar de RTFoundation'), eur(rtfBij), 'g') +
        (user.tier === 'business' ? tegel(T('fin.vat','Btw betaald'), eur(btwSom)) : '') +
      '</div>' +
      (rtfKomt > 0 ? '<div style="margin-top:0.5rem;font-size:0.72rem;color:var(--muted);">' + T('fin.rtfnext','Van uw openstaande bijdrage gaat') + ' <b style="color:var(--rtg-leesgoud,var(--gold));">' + eur(rtfKomt) + '</b> ' + T('fin.rtfnext2','naar de RTFoundation.') + '</div>' : '') +
      (API.live ? '<button id="dlOverzicht" style="margin-top:0.6rem;background:none;border:1px solid var(--line);color:var(--muted);border-radius:0;padding:0.35rem 0.85rem;font-size:0.68rem;font-family:inherit;cursor:pointer;">⤓ ' + T('fin.dloverzicht','Download factuuroverzicht (PDF)') + '</button>' : '') +
    '</div>';
    // Filterbalk: op jaar en op soort. Handig zodra er meer facturen zijn.
    const jaarVan = i => (String(i.date || '').match(/\d{4}/) || [''])[0];
    const jaren = [...new Set(invoices.map(jaarVan).filter(Boolean))].sort().reverse();
    const zichtbaar = invoices.filter(i =>
      (payFilterJaar === 'alle' || jaarVan(i) === payFilterJaar) &&
      (payFilterType === 'alle' || (payFilterType === 'abo' ? isContrib(i.desc) : !isContrib(i.desc))));
    const chip = (actief, val, groep, label) => '<button class="js-payfilter" data-groep="' + groep + '" data-val="' + val + '" style="border:1px solid ' + (actief ? 'var(--gold)' : 'var(--line)') + ';color:' + (actief ? 'var(--gold)' : 'var(--soft)') + ';background:none;border-radius:0;padding:0.25rem 0.7rem;font-size:0.66rem;font-family:inherit;cursor:pointer;">' + label + '</button>';
    const filterBar = (jaren.length > 1 || invoices.length > 3)
      ? '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.75rem;align-items:center;">' +
          chip(payFilterType === 'alle', 'alle', 'type', T('fin.f.alle','Alles')) +
          chip(payFilterType === 'abo', 'abo', 'type', T('fin.f.abo','Abonnement')) +
          chip(payFilterType === 'overig', 'overig', 'type', T('fin.f.overig','Overig')) +
          (jaren.length > 1 ? '<span style="width:1px;height:1rem;background:var(--line);margin:0 0.25rem;"></span>' + chip(payFilterJaar === 'alle', 'alle', 'jaar', T('fin.f.jaren','Alle jaren')) + jaren.map(j => chip(payFilterJaar === j, j, 'jaar', j)).join('') : '') +
        '</div>'
      : '';
    /* Nog nooit een factuur gehad is iets anders dan "niets in deze selectie".
       Een nieuw account begint leeg, dus dit is wat een nieuw lid hier leest:
       niet dat het filter niets vond, maar wat er komt te staan en waarom. */
    const leegTekst = invoices.length
      ? T('fin.f.leeg','Geen facturen in deze selectie.')
      : T('fin.f.nognooit','Hier komen uw facturen te staan: wat RTG voor u regelt, wat u bij partners besteedt en uw maandbijdrage. Btw en afboekcode staan er meteen bij, zodat het zo de boekhouding in kan. Van elke bijdrage gaat 30% naar de RTFoundation.');
    $('#payList').innerHTML = finKaart + filterBar + (zichtbaar.length ? '' : '<div style="color:var(--soft);font-size:0.8rem;padding:0.5rem 0;line-height:1.6;">' + leegTekst + '</div>') + zichtbaar.map(inv => {
      const total = inv.netto + inv.bijdrage;
      return '<div class="rowitem">' +
        '<div class="t"><b>' + inv.desc + '</b><span>' + inv.id + ' · ' + inv.date + '</span></div>' +
        '<div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:0.45rem;">' +
          '<span class="amount">' + eur(total) + '</span>' +
          (inv.status === 'open'
            ? '<button class="btn-pay js-pay" data-inv="' + inv.id + '" data-amt="' + total + '">' + FID + T('app.pay','Betaal') + '</button>' +
              (API.live && user.tier !== 'guest' ? '<button class="js-saldo" data-inv="' + inv.id + '" data-amt="' + total + '" style="background:none;border:1px solid var(--line);color:var(--muted);border-radius:0;padding:0.3rem 0.75rem;font-size:0.66rem;font-family:inherit;cursor:pointer;">◉ ' + T('fin.paysaldo','Uit RTG Pay-saldo') + '</button>' : '') +
              (muntAan ? '<button class="js-munt" data-inv="' + inv.id + '" data-amt="' + total + '" style="background:none;border:1px solid var(--line);color:var(--muted);border-radius:0;padding:0.3rem 0.75rem;font-size:0.66rem;font-family:inherit;cursor:pointer;">◈ ' + T('fin.paycoins','Met munten') + '</button>' : '')
            : '<span class="pill paid">'+T('app.paid','Betaald')+'</span>') +
          (API.live ? '<button class="js-dlinv" data-inv="' + inv.id + '" style="background:none;border:none;color:var(--soft);font-size:0.66rem;font-family:inherit;cursor:pointer;padding:0.15rem 0;">⤓ ' + T('fin.download','Download factuur') + '</button>' : '') +
        '</div>' +
      '</div>' + bizSpec(inv);
    }).join('');
    /* Uit het eigen RTG Pay-saldo (de derde betaalweg): dezelfde bevestigde
       betaalflow als de kaart, maar de afschrijving komt uit de wallet. */
    document.querySelectorAll('.js-saldo').forEach(b =>
      b.addEventListener('click', () => payWithFaceId(eur(Number(b.dataset.amt)), async () => {
        const r = await API.call('/pay/saldo', { invoiceId: b.dataset.inv });
        applyState((await API.call('/state')).state);
        return r;
      }, {
        message: r => T('fin.saldobetaald','Betaald uit uw RTG Pay-saldo') + (r && r.bijgeladen ? ' (' + eur(r.bijgeladen / 100) + ' ' + T('fin.bijgeladen','automatisch bijgeladen') + ')' : '') + '.',
        after: () => { renderPay(); renderHome(); renderTrip(); }
      })));
    document.querySelectorAll('.js-munt').forEach(b =>
      b.addEventListener('click', () => openMuntSheet({
        euro: Number(b.dataset.amt), titel: T('munt.title','Betaal met munten'),
        maak: async (munt) => (await API.call('/munt/verzoek', { invoiceId: b.dataset.inv, munt })).verzoek,
        klaar: async () => { applyState((await API.call('/state')).state); const inv = (invoices || []).find(i => i.id === b.dataset.inv); return !!(inv && inv.status === 'paid'); }
      })));
    document.querySelectorAll('.js-dlinv').forEach(b =>
      b.addEventListener('click', () => downloadPdf('/factuur', { invoiceId: b.dataset.inv }, 'RTG-factuur-' + b.dataset.inv + '.pdf')));
    document.querySelectorAll('.js-payfilter').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.groep === 'type') payFilterType = b.dataset.val; else payFilterJaar = b.dataset.val;
      renderPay();
    }));
    const dlo = $('#dlOverzicht');
    if (dlo) dlo.addEventListener('click', () => downloadPdf('/facturen/overzicht', payFilterJaar !== 'alle' ? { jaar: payFilterJaar } : {}, 'RTG-factuuroverzicht' + (payFilterJaar !== 'alle' ? '-' + payFilterJaar : '') + '.pdf'));
/* alles in een keer betalen */
    $('#payAllWrap').innerHTML = (open.length
      ? '<button class="btn-pay payall" id="payAll">' + FID + T('app.payall','Betaal alles') + ', ' + eur(openSum) + '</button>'
      : '') +
      (open.length ? '<div style="margin-top:1rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.9rem 1.1rem;font-size:0.74rem;color:var(--muted);line-height:1.6;">' +
        '<b style="color:var(--txt);font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;">'+T('app.bank.h','Liever overboeken?')+'</b><br>' +
        T('app.bank.to','Maak het bedrag over naar')+' <b style="color:var(--txt);" id="rtgIban">' + RTG_IBAN + '</b> ' +
        T('app.bank.name','t.n.v. RTG, o.v.v. uw codenaam')+' (<b style="color:var(--rtg-leesgoud,var(--gold));">' + user.codename + '</b>) ' +
        T('app.bank.ref','en het factuurnummer. Na ontvangst zetten wij de factuur op betaald.') +
        ' <button id="ibanCopy" style="background:none;border:1px solid var(--line);border-radius:0;padding:0.25rem 0.7rem;font-size:0.66rem;color:var(--muted);margin-left:0.2rem;">'+T('app.bank.copy','Kopieer IBAN')+'</button></div>' : '');
    document.querySelectorAll('.js-pay').forEach(b =>
      b.addEventListener('click', () => payWithFaceId(eur(Number(b.dataset.amt)), () => executePay(b.dataset.inv))));
    const pa = $('#payAll');
    if (pa) pa.addEventListener('click', () => payWithFaceId(eur(openSum), () => executePay('all')));
    const ic = $('#ibanCopy');
    if (ic) ic.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(RTG_IBAN); toast(T('app.bank.copied','IBAN gekopieerd.')); }
      catch(e){ toast(RTG_IBAN); }
    });
    renderGiftcards();
    renderBoekhouder();
    renderPunten();
  }

  /* RTG-punten + open betaalverzoeken (gesplitste rekeningen) + meldingsvoorkeuren */
  async function renderPunten(){
    if (!API.live || user.tier === 'guest') return;
    let wrap = $('#puntenWrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.id = 'puntenWrap';
      $('#payAllWrap').insertAdjacentElement('afterend', wrap);
    }
    let p = null, splitsen = [], vk = null;
    try {
      [p, splitsen, vk] = await Promise.all([
        API.call('/punten').catch(() => null),
        API.call('/splitsen/mijn').then(d => d.splitsen || []).catch(() => []),
        API.call('/meldingen/voorkeur').then(d => d.voorkeur).catch(() => null)
      ]);
    } catch(e){ return; }
    const kaart = inhoud => '<div style="margin-top:1rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.9rem 1.1rem;">' + inhoud + '</div>';
    let html = '';
    // punten: saldo, tegoed en verzilveren
    if (p) html += kaart(
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.8rem;">' +
        '<div><b style="font-size:0.86rem;">✦ ' + T('erv.punten','RTG-punten') + '</b>' +
        '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.25rem;">' + p.saldo + ' ' + T('erv.puntensaldo','punten') + (p.tegoed ? ' · € ' + p.tegoed + ' ' + T('erv.tegoed','tegoed (verrekent automatisch)') : '') + '</div>' +
        '<div style="font-size:0.64rem;color:var(--soft);margin-top:0.25rem;">' + T('erv.puntenuitleg','1 punt per € 10; 100 punten = € 10 tegoed. RTG legt bij, de zaak ontvangt alles.') + '</div></div>' +
        (p.saldo >= 100 ? '<button class="vbtn" id="pzGo">' + T('erv.verzilver','Verzilver 100') + '</button>' : '') +
      '</div>');
    // open betaalverzoeken: mijn deel van gesplitste rekeningen
    const mijnKey = user.id != null ? 'user-' + user.id : user.tier;
    const echteOpen = splitsen.filter(s => s.delen.some(d2 => !d2.paid)).slice(0, 6);
    if (echteOpen.length) html += kaart(
      '<b style="font-size:0.86rem;">' + T('erv.verzoeken','Gesplitste rekeningen') + '</b>' +
      echteOpen.map(s => {
        const mijnDeel = s.delen.find(d2 => d2.key === mijnKey && !d2.paid);
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;margin-top:0.5rem;font-size:0.78rem;">' +
          '<span>' + s.supplierName + ' · ' + eur(s.totaal) + ' · ' + s.delen.filter(d2 => d2.paid).length + '/' + s.delen.length + ' ' + T('erv.betaald','betaald') + '</span>' +
          (mijnDeel
            ? '<button class="vbtn js-splpay" data-id="' + s.id + '" data-amt="' + mijnDeel.bedrag + '">' + T('erv.betaaldeel','Betaal mijn deel') + '</button>'
            : '<span style="color:var(--soft);font-size:0.68rem;">' + T('erv.wachtop','wacht op vrienden') + '</span>') +
        '</div>';
      }).join(''));
    // meldingsvoorkeuren: per soort aan of uit
    if (vk) html += kaart(
      '<b style="font-size:0.86rem;">' + T('erv.meldingen','Meldingen') + '</b>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.5rem 1rem;margin-top:0.5rem;">' +
      [['orders', T('erv.m.orders','Bestellingen')], ['events', T('erv.m.events','Events')], ['salon', 'De Salon'], ['live', T('erv.m.live','Onderweg')], ['wachtlijst', T('erv.wachtlijst','Wachtlijst')]].map(([k, l]) =>
        '<label style="display:inline-flex;align-items:center;gap:0.35rem;font-size:0.76rem;"><input type="checkbox" class="js-vk" data-scope="' + k + '"' + (vk[k] !== false ? ' checked' : '') + '> ' + l + '</label>'
      ).join('') + '</div>');
    wrap.innerHTML = html;
    const pz = $('#pzGo');
    if (pz) pz.addEventListener('click', async () => {
      try { const d = await API.call('/punten/verzilver', { punten: 100 }); toast('✦ ' + T('erv.verzilverd','Verzilverd:') + ' € ' + d.tegoed + ' ' + T('erv.tegoedkort','tegoed.')); renderPunten(); }
      catch(e){ toast(e.message); }
    });
    wrap.querySelectorAll('.js-splpay').forEach(b => b.addEventListener('click', () =>
      payWithFaceId(eur(Number(b.dataset.amt)), async () => { await API.call('/splits/betaal', { id: b.dataset.id }); return null; },
        { message: () => T('erv.deelbetaald','Uw deel is betaald.'), after: () => renderPunten() })));
    wrap.querySelectorAll('.js-vk').forEach(c => c.addEventListener('change', async () => {
      try { await API.call('/meldingen/voorkeur', { zet: { [c.dataset.scope]: c.checked } }); }
      catch(e){ toast(e.message); }
    }));
  }

  // cadeaukaarten: kopen met Face ID, cadeau doen, inwisselen bij de zaak op code
  async function renderGiftcards(){
    const wrap = $('#gcWrap');
    if (!wrap) return;
    let kaarten = [];
    try { kaarten = (await API.call('/giftcards/mine')).kaarten || []; } catch(e){}
    if (!suppliers.length){
      try { suppliers = (await API.call('/suppliers')).suppliers || []; } catch(e){}
    }
    const opties = suppliers.map(s => '<option value="' + s.code + '">' + s.name + '</option>').join('');
    wrap.innerHTML = '<div style="margin-top:1.6rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:1rem 1.1rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--rtg-leesgoud,var(--gold));">' + T('gc.h','Cadeaukaarten') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;line-height:1.5;">' + T('gc.s','Koop een cadeaukaart van een partner en geef de code cadeau. Inwisselen gaat bij de zaak.') + '</div>' +
      (kaarten.length ? kaarten.map(k =>
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.7rem;padding:0.55rem 0;border-bottom:1px solid var(--line);font-size:0.8rem;">' +
        '<span>' + k.supplierName + '<span style="display:block;font-size:0.66rem;color:var(--rtg-leesgoud,var(--gold));letter-spacing:0.06em;">' + k.code + '</span></span>' +
        '<b>' + eur(k.saldo) + '</b></div>').join('') : '') +
      '<div style="display:flex;gap:0.5rem;margin-top:0.7rem;flex-wrap:wrap;">' +
      '<select id="gcSup" style="flex:2;min-width:120px;background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.6rem;color:var(--txt);font-family:inherit;">' + opties + '</select>' +
      '<input id="gcAmt" type="number" placeholder="€ 50" style="flex:1;min-width:70px;background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.6rem;color:var(--txt);font-family:inherit;">' +
      '<button id="gcBuy" style="background:var(--knop);color:var(--knop-txt);border:none;border-radius:0;padding:0.6rem 1rem;font-size:0.74rem;font-weight:600;font-family:inherit;">' + T('gc.koop','Koop') + '</button></div></div>';
    const kb = $('#gcBuy');
    if (kb) kb.addEventListener('click', () => {
      const bedrag = Math.round(Number($('#gcAmt').value));
      if (!(bedrag >= 10)) { toast(T('gc.min','Kies een bedrag vanaf € 10.')); return; }
      payWithFaceId(eur(bedrag), async () => {
        const d = await API.call('/giftcard/buy', { supplierCode: $('#gcSup').value, bedrag });
        return d.kaart;
      }, { message: k => T('gc.klaar','Cadeaukaart gekocht. Code:') + ' ' + k.code, after: () => renderGiftcards() });
    });
  }

  // Business Pass: de AI-boekhouder die per land weet wat terug te vorderen is
  let lidBordenUI = null;
  function renderBoekhouder(){
    const wrap = $('#bhWrap');
    if (!wrap) return;
/* het boekland van een zakelijk lid */
    if (user.tier !== 'business'){ wrap.innerHTML = ''; return; }
    let land = 'NL';
    try { land = localStorage.getItem('rtg_boekland') || 'NL'; } catch(e){}
    const landen = [['NL','Nederland'],['BE','Belgie'],['DE','Duitsland'],['FR','Frankrijk'],['ES','Spanje'],['JP','Japan']];
    wrap.innerHTML = '<div style="margin-top:1rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:1rem 1.1rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold);">' + T('bh2.h','AI-boekhouder · Business Pass') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;line-height:1.5;">' + T('bh2.s','Kent per land de aftrekregels voor uw zakelijke reiskosten. Uw facturen staan al boekhoudklaar, met afboekcode en btw-specificatie.') + '</div>' +
      '<div style="display:flex;gap:0.5rem;margin-top:0.7rem;">' +
      '<select id="bhLand" style="background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.55rem;color:var(--txt);font-family:inherit;">' +
      landen.map(l => '<option value="' + l[0] + '"' + (l[0] === land ? ' selected' : '') + '>' + l[1] + '</option>').join('') + '</select>' +
      '<input id="bhQ" placeholder="' + T('bh2.ph','Bijv. kan ik dit diner terugvorderen?') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.55rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.8rem;">' +
      '<button id="bhGo" style="background:var(--knop);color:var(--knop-txt);border:none;border-radius:0;padding:0.55rem 0.95rem;font-size:0.74rem;font-weight:600;font-family:inherit;">' + T('bh2.vraag','Vraag') + '</button></div>' +
      '<div id="bhA" style="display:none;margin-top:0.7rem;border:1px solid var(--gold);border-radius:0;padding:0.7rem 0.9rem;font-size:0.78rem;line-height:1.6;color:var(--muted);"></div>' +
      // zzp-belastingtool: jaarwinst in, indicatie van aftrek, belasting en netto uit
      '<div style="margin-top:0.75rem;border-top:1px solid var(--line);padding-top:0.9rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold);">' + T('zzp.h','Zzp-belastingtool') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;line-height:1.5;">' + T('zzp.s','Voor zelfstandigen: vul uw verwachte jaarwinst in voor een indicatie van uw belasting, nettowinst en wat u maandelijks opzij zet. Het land volgt de keuze hierboven.') + '</div>' +
      '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;">' +
      '<input id="zzpWinst" type="number" placeholder="' + T('zzp.winstph','Jaarwinst, bijv. 60000') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.55rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.8rem;">' +
      '<button id="zzpGo" style="background:var(--knop);color:var(--knop-txt);border:none;border-radius:0;padding:0.55rem 0.95rem;font-size:0.74rem;font-weight:600;font-family:inherit;">' + T('zzp.reken','Reken') + '</button></div>' +
      '<div style="display:flex;gap:1rem;margin-top:0.5rem;font-size:0.72rem;color:var(--muted);flex-wrap:wrap;">' +
      '<label style="display:flex;align-items:center;gap:0.35rem;"><input type="checkbox" id="zzpUren" checked> ' + T('zzp.uren','Urencriterium (1.225 uur)') + '</label>' +
      '<label style="display:flex;align-items:center;gap:0.35rem;"><input type="checkbox" id="zzpStart"> ' + T('zzp.start','Startersaftrek') + '</label></div>' +
      '<div id="zzpRes" style="display:none;margin-top:0.7rem;border:1px solid var(--line);border-radius:0;padding:0.8rem 0.95rem;font-size:0.76rem;line-height:1.7;color:var(--muted);"></div></div></div>' +
      // Borden: dezelfde werkbord-module als de zaken gebruiken (shared/borden.js)
      '<div style="margin-top:1rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:1rem 1.1rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold);">' + T('bd2.h','Borden · uw projecten') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.25rem;line-height:1.5;">' + T('bd2.s','Hetzelfde werkbord als in de RTG-bedrijfsapps: lijsten en kaarten voor uw eigen projecten en administratie.') + '</div>' +
      '<div id="lidBordenWrap"></div></div>';
    if (window.BordenUI){
      if (lidBordenUI) lidBordenUI = null; // het element is zojuist opnieuw opgebouwd
      lidBordenUI = BordenUI.mount($('#lidBordenWrap'), {
        laad: () => API.call('/member/borden'),
        doe: b => API.call('/member/bord', b),
        teamleden: null,
        kanBeheren: () => true,
        T, toast
      });
    }
    const go = $('#bhGo');
    if (go) go.addEventListener('click', async () => {
      const q = $('#bhQ').value.trim();
      if (!q) return;
      try { localStorage.setItem('rtg_boekland', $('#bhLand').value); } catch(e){}
      const box = $('#bhA');
      box.style.display = 'block';
      box.textContent = '…';
      try { box.textContent = (await API.call('/member/accountant', { question: q, land: $('#bhLand').value })).answer; }
      catch(e){ box.textContent = e.message; }
    });
    const qi = $('#bhQ');
    if (qi) qi.addEventListener('keydown', e => { if (e.key === 'Enter' && go) go.click(); });
    const zg = $('#zzpGo');
    if (zg) zg.addEventListener('click', async () => {
      const winst = Math.round(Number($('#zzpWinst').value));
      const box = $('#zzpRes');
      if (!(winst > 0)) { toast(T('zzp.leeg','Vul eerst uw verwachte jaarwinst in.')); return; }
      try { localStorage.setItem('rtg_boekland', $('#bhLand').value); } catch(e){}
      box.style.display = 'block';
      box.textContent = '…';
      try {
        const d = await API.call('/member/zzp', { winst, land: $('#bhLand').value, urencriterium: $('#zzpUren').checked, starter: $('#zzpStart').checked });
        const rij = (l, v, sterk) => '<div style="display:flex;justify-content:space-between;gap:0.8rem;"><span>' + l + '</span><span style="flex-shrink:0;' + (sterk ? 'color:var(--txt);font-weight:600;' : '') + '">' + v + '</span></div>';
        box.innerHTML =
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);margin-bottom:0.25rem;">' + d.regime + ' · ' + d.landNaam + '</div>' +
          rij(T('zzp.winst','Jaarwinst'), eur(d.winst)) +
          d.posten.map(p2 => rij(p2.label, (p2.bedrag < 0 ? '- ' : '') + eur(Math.abs(p2.bedrag)))).join('') +
          rij(T('zzp.belastbaar','Belastbaar (na aftrek)'), eur(d.belastbaar)) +
          rij(T('zzp.teBetalen','Te betalen (indicatie)'), eur(d.belasting), true) +
          rij(T('zzp.netto','Netto over'), eur(d.netto), true) +
          '<div style="margin-top:0.5rem;padding-top:0.55rem;border-top:1px solid var(--line);color:var(--gold);">' + T('zzp.reserveer','Zet ~') + d.reserveerPct + '% ' + T('zzp.opzij','opzij: ongeveer') + ' ' + eur(d.perMaand) + ' ' + T('zzp.pm','per maand') + '.</div>' +
          '<div class="h-mt50">' + d.regels.map(r => '• ' + r).join('<br>') + '</div>' +
          '<div style="margin-top:0.5rem;font-size:0.64rem;color:var(--soft);">' + T('zzp.disc','Indicatie op jaarbasis; dit is voorlichting, geen bindend fiscaal advies.') + '</div>';
      } catch(e){ box.textContent = e.message; }
    });
  }

  /* De AI-kant van de app: de opener van Rahul en zijn regelantwoorden zonder
     backend. Afgesplitst van app-main-49.js (de zzp-rekenhulp) toen dat bestand
     de 10 KB-lat passeerde; dat was ook de natuurlijke naad, want een
     belastingrekenaar en een gesprek zijn twee onderwerpen. De staart van
     aiAnswer staat in app-main-50.js -- die grens lag er al. */
  /* ---------- AI ---------- */

  const chatHistory = [];

  function aiOpener(){
    const first = user.full.split(' ')[0];
    const groet = (lang()==='en' ? 'Good day' : 'Goedendag') + (user.tier === 'business' ? '.' : ', ' + first + '.');
    /* ZONDER REIS OPENT RAHUL MET EEN VRAAG. Hier stond onvoorwaardelijk "Uw reis
       naar " + trip.dest, en trip was altijd gevuld -- desnoods met de demo-reis,
       zodat een vers lid werd begroet met een reis die het nooit boekte. */
    if (!trip) return [
      groet + ' ' + (lang()==='en'
        ? 'There is nothing planned yet. Tell me where you want to go and when, and I will take it from there:'
        : (stem('Er staat nog niets gepland. Zeg me waar je heen wilt en wanneer, dan neem ik het over:',
                'Er staat nog niets gepland. Geef me de bestemming en de data, dan neem ik het over:',
                'Er staat nog niets gepland. Zegt u mij waar het heen mag en wanneer, dan neem ik het over:'))),
      (lang()==='en'
        ? '• Flight, stay, transfer and tables: I request them with our partners; the status stands in your travel overview.'
        : '• Vlucht, verblijf, transfer en tafels: ik vraag ze aan bij onze partners; de status staat in het reisoverzicht.'),
      (lang()==='en'
        ? '• Nothing is confirmed until a partner says yes, and I will never tell you otherwise.'
        : '• Niets staat vast tot een partner ja zegt; ik zeg nooit dat iets geregeld is als dat niet zo is.'),
      (lang()==='en' ? '• Where would you like to go?' : (stem('• Waar wil je heen?', '• Waar mag het heen?', '• Waar mag het heen?')))
    ].join('\n');
    const lines = [ lang()==='en'
      ? (groet + ' Your journey to ' + trip.dest + ' begins in ' + trip.days + ' days. I have already thought ahead:')
      : (groet + ' Uw reis naar ' + trip.dest + ' begint over ' + trip.days + ' dagen. Ik heb alvast vooruitgedacht:') ];
    const open = invoices.filter(i => i.status === 'open');
    if (open.length){
      const sum = open.reduce((s,i) => s + i.netto + i.bijdrage, 0);
      lines.push(lang()==='en'
        ? ('• There ' + (open.length === 1 ? 'is 1 payment' : 'are ' + open.length + ' payments') + ' still open (' + eur(sum) + '). One tap in Payments and it is done.')
        : ('• Er ' + (open.length === 1 ? 'staat nog 1 betaling' : 'staan nog ' + open.length + ' betalingen') + ' open (' + eur(sum) + '). Eén tik in Betalen en het is geregeld.'));
    }
    const pending = trip.items.find(i => i.status === 'req');
    if (pending) lines.push(lang()==='en'
      ? ('• ' + pending.title.replace('Diner, ', 'Your table at ') + ' is still being requested; I am watching for the confirmation.')
      : ('• ' + pending.title.replace('Diner, ', 'Uw tafel bij ') + ' is nog in aanvraag; ik bewaak de bevestiging.'));
    lines.push(T('ai.opener.plan','• Zal ik vast een paklijst en een dagplan voor 14 oktober klaarzetten? Eén "ja" is genoeg.'));
    return lines.join('\n');
  }

  function aiAnswer(q){
    const l = q.toLowerCase().trim();
    /* DE ANTWOORDEN VAN DE APP ZELF, ZONDER SERVER. Deze stonden woordelijk op de
       DEMO-reis (Ibiza, Formentera, Sal de Mar) en het eerste begon met
       "Geregeld. De paklijst staat klaar ... is ingepland", terwijl er niets
       geboekt wordt -- dezelfde fout die serverkant al recht stond
       (kern/ai/demoantwoorden.js). En hij liep niet alleen in de demostand: dit
       bestand valt ook op aiAnswer terug als de SERVERAANROEP MISLUKT, dus een
       echt lid met een haperende verbinding kreeg hem net zo goed. Nu dragen ze
       de eigen reis; zonder reis vraagt Rahul waar het heen mag. */
    const dest = trip && trip.dest ? trip.dest : null;
    const heen = T('ai.a.ask','Waar mag het heen, en wanneer? Zodra ik dat weet zet ik het hele voortraject klaar.');
    if (/^(ja|graag|ja graag|doe maar|prima|goed|regel het|ja, regel het|yes|please|go ahead|sure|arrange it)\b/.test(l))
      return dest
        ? T('ai.a.yes','Ik zet het in gang: het voorstel komt in het reisoverzicht en wat een partner moet bevestigen gaat als aanvraag de deur uit. Niets staat vast tot zij ja zeggen; ik laat het weten zodra dat zo is.')
        : T('ai.a.yesleeg','Ik pak het op. Alleen staat er nog geen reis in het systeem: er is dus niets in aanvraag en niets bevestigd. ') + heen;
    if (l.includes('inpak') || l.includes('paklijst') || l.includes('pack'))
      return dest
        ? T('ai.a.pack','Voor ') + dest + T('ai.a.pack2',' loop ik het per dag na: kleding voor buiten, iets nets voor de avonden, en documenten en medicijnen apart. Zal ik er een afvinklijst van maken?')
        : T('ai.a.packleeg','Een paklijst maak ik op de bestemming, het seizoen en wat u daar gaat doen. ') + heen;
    if (l.includes('visum') || l.includes('paspoort') || l.includes('visa') || l.includes('passport'))
      return dest
        ? T('ai.a.visa','Ik zoek de document- en visumeisen na voor ') + dest + T('ai.a.visa2',' bij uw nationaliteit en geef het antwoord met de bron erbij. Zal ik dat nu uitzoeken?')
        : T('ai.a.visaleeg','Welke documenten u nodig heeft hangt af van de bestemming en uw paspoort; ik zoek dat liever op dan dat ik het gok. ') + heen;
    if (l.includes('weer') || l.includes('weather'))
      return dest
        ? T('ai.a.weather','De verwachting voor ') + dest + T('ai.a.weather2',' houd ik bij en trek ik vlak voor vertrek na; ver vooruit is het een aanname en geen voorspelling.')
        : T('ai.a.weatherleeg','Het weer haal ik op voor de plek en de dagen waar het om gaat. ') + heen;
    if (l.includes('plan') || l.includes('dag') || l.includes('day'))
      return dest
        ? T('ai.a.plan','Ik zet een dagindeling voor ') + dest + T('ai.a.plan2',' als voorstel klaar: ochtend rustig, het uitje midden op de dag, de avond op tafel. Alles wat een partner moet bevestigen gaat als aanvraag.')
        : T('ai.a.planleeg','Een dagplan bouw ik op wat er op de bestemming te doen is en op uw tempo. ') + heen;
    if (l.includes('restaurant') || l.includes('diner') || l.includes('eten') || l.includes('dinner') || l.includes('eat'))
      return dest
        ? T('ai.a.rest','Voor ') + dest + T('ai.a.rest2',' leg ik u twee of drie adressen uit ons netwerk voor, tegen normale prijs, en vraag ik de tafel aan zodra u kiest. Voor welke avond en met hoeveel personen?')
        : T('ai.a.restleeg','Een tafel regel ik via ons netwerk, tegen de normale prijs. Waar bent u, of waar gaat u heen, en met hoeveel personen?');
    return T('ai.a.default','Daar kom ik vandaag nog op terug. Ik kan alvast helpen met de paklijst, documenten, het weer of een dagplan, zeg het maar.');
  }
/* de chatbellen van het Rahul-gesprek: een bericht als element, met wie het zei */
  function bubble(text, who){
    const el = document.createElement('div');
    el.className = 'bubble ' + who;
    el.textContent = text;
    $('#chat').appendChild(el);
    $('#content').scrollTop = $('#content').scrollHeight;
    return el;
  }

  const escHtml = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  // een voorstel van Rahul ("even checken...") krijgt echte knoppen
  function voorstelChips(aan){
    const box = $('#chips'); if (!box) return;
    if (aan){
      box.dataset.voorstel = '1';
      box.innerHTML = '<button class="chip" id="flJa">✓ ' + T('fl.ja','Ja, doe maar') + '</button>' +
        '<button class="chip" id="flNee">✕ ' + T('fl.nee','Nee, laat maar') + '</button>';
      $('#flJa').addEventListener('click', () => ask('ja'));
      $('#flNee').addEventListener('click', () => ask('nee'));
      return;
    }
    if (!box.dataset.voorstel) return;
    delete box.dataset.voorstel;
    if (user.account && user.tier !== 'guest'){
      box.innerHTML = '<button class="chip" id="aiBetaalChip">' + FID_MINI + T('dp.aichip','Betaal een partner') + '</button>';
      const bc = $('#aiBetaalChip'); if (bc) bc.addEventListener('click', () => kiesPartnerEnBetaal('ai'));
    } else standaardChips();
  }

  async function ask(qIn){
    const q = String(qIn || '').trim();
    if (!q) return;
    // eerst Rahul-motor: geheugen, seintjes, zoeken en echt regelen
    // (reserveren, het 24-uursblok, een Tik, betaalverzoeken); pakt hij de
    // vraag niet, dan neemt de gewone gesprekslaag het over
    if (API.live){
      let r = null;
      try { r = await API.call('/fluister', { q }); } catch(e){}
      if (r && r.pakte){
        bubble(q, 'user');
        bubble(r.antwoord, 'ai');
        if (!user.account){ chatHistory.push({role:'user', content:q}); chatHistory.push({role:'assistant', content:r.antwoord}); }
        if (r.gedaan) toast('' + T('fl.gedaan','Rahul heeft het geregeld.'));
        voorstelChips(!!r.voorstel);
        if (typeof renderFluister === 'function') renderFluister();
        $('#content').scrollTop = $('#content').scrollHeight;
        return;
      }
    }
    if (user.account){ chatSend(q); return; }   // echte accounts: gekoppeld gesprek
    bubble(q, 'user');
    chatHistory.push({role:'user', content:q});
    if (API.live){
      const pending = bubble('…', 'ai');
      API.call('/ai', {messages: chatHistory})
        .then(d => { pending.textContent = d.reply; chatHistory.push({role:'assistant', content:d.reply}); })
        .catch(() => { const r = aiAnswer(q); pending.textContent = r; chatHistory.push({role:'assistant', content:r}); })
        .finally(() => { $('#content').scrollTop = $('#content').scrollHeight; });
    } else {
      setTimeout(() => { const r = aiAnswer(q); bubble(r, 'ai'); chatHistory.push({role:'assistant', content:r}); }, 500);
    }
  }

  /* ---------- doorlopend gesprek in de app voor echte accounts ---------- */
  function renderChatMsgs(msgs, concierge){
    const chat = $('#chat');
    if (!msgs.length){
      chat.innerHTML = '';
      bubble(concierge ? T('chat.concierge.hi','Goedendag. Schrijf ons hier in de app; uw concierge helpt u persoonlijk.') : aiOpener(), 'ai');
      return;
    }
    // Met Util.el: de berichttekst (van de gast of de concierge) gaat structureel
    // als tekstknoop, dus altijd veilig ge-escaped, geen escHtml-discipline nodig.
    const E = Util.el;
    const bubbels = msgs.map(m => E('div', { class: 'bubble ' + (m.from === 'member' ? 'user' : 'ai') },
      null,
      m.text));
    const last = msgs[msgs.length - 1];
    if (concierge && last && last.from === 'member'){
      bubbels.push(E('div', { class: 'bubble ai pending' }, T('chat.concierge.pending', 'Uw concierge is ingelicht en reageert zo.')));
    }
    Util.vervang(chat, bubbels);
    $('#content').scrollTop = $('#content').scrollHeight;
  }
  async function renderChat(){
    const concierge = user.tier !== 'rtg';
    $('#aiTitle').textContent = concierge ? T('chat.concierge.title','Uw concierge.') : T('ai.title.rtg','Rahul.');
    const deck = document.querySelector('.view[data-view="ai"] .sub');
    if (deck) deck.textContent = concierge
      ? T('chat.concierge.deck','Uw persoonlijke concierge, in uw beveiligde app-lijn. Eén doorlopend gesprek.')
      : T('chat.rahul.deck','Rahul, in uw beveiligde app-lijn. Eén doorlopend gesprek.');
    // Vaste snelactie: alles regelen én afrekenen kan hier. Face ID, direct naar de partner.
    if (user.tier !== 'guest'){
      $('#chips').innerHTML = '<button class="chip" id="aiBetaalChip">' + FID_MINI + T('dp.aichip','Betaal een partner') + '</button>';
      const bc = $('#aiBetaalChip'); if (bc) bc.addEventListener('click', () => kiesPartnerEnBetaal('ai'));
    } else { $('#chips').innerHTML = ''; }
    if (!API.live){ $('#chat').innerHTML = ''; bubble(aiOpener(), 'ai'); return; }
    try { const d = await API.call('/chat/history'); renderChatMsgs(d.messages, concierge); }
    catch (e) { $('#chat').innerHTML = ''; bubble(aiOpener(), 'ai'); }
  }
  // Kies een partner en reken direct met Face ID af (vanuit de AI/concierge).
  function kiesPartnerEnBetaal(bron){
    const lijst = (suppliers || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (!lijst.length){ toast(T('dp.geenpartner','Nog geen partners om aan te betalen.')); return; }
    let ov = document.getElementById('dp-pick'); if (ov) ov.remove();
    ov = document.createElement('div'); ov.id = 'dp-pick';
    ov.style.cssText = 'position:fixed;inset:0;z-index:130;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov.innerHTML = '<div style="width:100%;max-width:460px;max-height:80vh;overflow-y:auto;background:var(--bg);border-radius:0;border:1px solid var(--line);padding:1.1rem 1.2rem 1.4rem;">' +
      '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.8rem;"><b style="font-size:1rem;">' + T('dp.kiespartner','Aan welke partner?') + '</b><button id="dpPickX" style="margin-left:auto;background:none;border:none;color:var(--muted);font-size:1.1rem;cursor:pointer;">✕</button></div>' +
      lijst.map(s => '<button class="js-dppick" data-code="' + s.code + '" style="display:flex;align-items:center;gap:0.6rem;width:100%;text-align:left;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.8rem;margin-bottom:0.4rem;color:var(--txt);font-family:inherit;cursor:pointer;"><span style="font-size:1.1rem;">' + (s.icon || RTGGlyf.svgHTML('gebouw')) + '</span><span><b style="font-size:0.86rem;">' + escT(s.name) + '</b><span style="display:block;font-size:0.68rem;color:var(--soft);">' + escT(s.typeLabel || '') + (s.city ? ' · ' + escT(s.city) : '') + '</span></span></button>').join('') +
      '</div>';
    ov.querySelector('#dpPickX').addEventListener('click', () => ov.remove());
/* een betaalpartner kiezen */
    ov.querySelectorAll('.js-dppick').forEach(b => b.addEventListener('click', () => {
      const s = lijst.find(x => x.code === b.dataset.code); ov.remove();
      betaalPartner(s.code, s.name, { bron });
    }));
  }
  async function chatSend(q){
    if (!API.live){ bubble(q, 'user'); setTimeout(() => bubble(aiAnswer(q), 'ai'), 400); return; }
    try { const d = await API.call('/chat/send', { text: q }); renderChatMsgs(d.messages, user.tier !== 'rtg'); }
    catch (e) { toast(e.message || 'Versturen mislukt.'); }
  }

  /* De websitebrief gaat pas naar de server NADAT de gebruiker in deze app is
     ingelogd. Geen externe berichtendienst of openbaar aanvraag-endpoint:
     dezelfde ingelogde /chat/send-lijn die de app zelf gebruikt. We wissen het
     fragment pas na een geslaagde aanname, zodat een netwerkstoring de aanvraag
     niet stil laat verdwijnen en een herlaad hem opnieuw kan proberen. */
  let websiteAanvraagBezig = false;
  async function verwerkWebsiteAanvraag(){
    if (!websiteAanvraag || websiteAanvraagBezig || !user.account || !API.live) return;
    websiteAanvraagBezig = true;
    const regels = [
      'Aanvraag via rtravelgroup.store', '',
      'Wereld / behoefte: ' + websiteAanvraag.requirement,
      'Naam: ' + websiteAanvraag.name,
      'E-mail: ' + websiteAanvraag.email,
      websiteAanvraag.phone ? 'Telefoon: ' + websiteAanvraag.phone : null,
      '', 'Brief:', websiteAanvraag.message
    ].filter(regel => regel !== null);
    try {
      const d = await API.call('/chat/send', { text: regels.join('\n') });
      openTab('ai');
      renderChatMsgs(d.messages, user.tier !== 'rtg');
      websiteAanvraag = null;
      history.replaceState(null, '', location.pathname + location.search);
      toast(T('aanvraag.app.ok','Uw aanvraag staat in uw beveiligde RTG-lijn.'));
    } catch(e){
      openTab('ai');
      const invoer = $('#askInput');
      if (invoer) invoer.value = regels.join('\n');
      toast(e.message || T('aanvraag.app.mis','De aanvraag staat klaar; verstuur hem zodra de verbinding terug is.'));
    } finally { websiteAanvraagBezig = false; }
  }

  function standaardChips(){
    const chips = lang()==='en'
      ? ['Yes, arrange it','What do you know about me?','What should I pack?','Plan my day','Arrange a restaurant']
      : ['Ja, regel het','Wat weet je over mij?','Wat moet ik inpakken?','Plan mijn dag','Regel een restaurant'];
    $('#chips').innerHTML = chips.map(c => '<button class="chip">' + c + '</button>').join('');
    document.querySelectorAll('#chips .chip').forEach(c => c.addEventListener('click', () => ask(c.textContent)));
  }
  function renderAI(){
    if (user.account){ renderChat(); return; }
    $('#aiTitle').textContent = user.tier === 'rtg' ? T('ai.title.rtg','Rahul.') : user.tier === 'lifestyle' ? T('ai.title.life','Uw AI.') : T('ai.title.biz','Uw uitvoerende AI.');
    $('#chat').innerHTML = '';
    chatHistory.length = 0;
    const opener = aiOpener();
    bubble(opener, 'ai');
    chatHistory.push({role:'assistant', content:opener});
    standaardChips();
  }
  $('#askBtn').addEventListener('click', () => { ask($('#askInput').value); $('#askInput').value = ''; });
  $('#askInput').addEventListener('keydown', e => { if (e.key === 'Enter'){ ask(e.target.value); e.target.value = ''; } });
  // spreek uw vraag in: de gedeelde spraakmotor luistert, Rahul doet de rest
  if (window.Spraak) Spraak.koppel($('#askMic'), {
    opTekst: zin => { $('#askInput').value = zin; ask(zin); $('#askInput').value = ''; },
    nietVerstaan: () => toast(T('fl.michoor','Ik kon u niet verstaan; probeer het nog eens of typ het gewoon.')),
    kanNiet: () => toast(T('fl.micniet','Spraak werkt niet in deze browser; typen kan altijd.'))
  });

  /* ---------- RTG Zakelijk: het professionele netwerk van de Business Pass ---------- */
  let zakView = 'feed';
  function zakOpen(){ $('#zak-scrim').classList.add('open'); $('#zak-sheet').classList.add('open'); zakRender(); }
  function zakDicht(){ $('#zak-scrim').classList.remove('open'); $('#zak-sheet').classList.remove('open'); }
  $('#zakClose').addEventListener('click', zakDicht);
  $('#zak-scrim').addEventListener('click', zakDicht);
  document.querySelectorAll('.zak-tab').forEach(b => b.addEventListener('click', () => {
    zakView = b.dataset.zaktab;
    document.querySelectorAll('.zak-tab').forEach(x => x.classList.toggle('active', x === b));
    zakRender();
  }));

  const zakStatusKnop = (p) =>
    p.status === 'verbonden' ? '<span class="zak-open" style="color:var(--rtg-leesgoud,var(--gold));border-color:var(--gold);">✓ ' + T('zak.verbonden','Verbonden') + '</span>'
    : p.status === 'aangevraagd' ? '<span class="zak-chip">' + T('zak.wacht','Aangevraagd') + '</span>'
    : p.status === 'wacht-op-u' ? '<span class="zak-chip mijn">' + T('zak.wachtu','Accepteer in Contacten') + '</span>'
    : '<button class="go js-zcon" data-key="' + escT(p.key) + '" style="padding:0.25rem 0.7rem;font-size:0.68rem;">+ ' + T('zak.verbind','Verbind') + '</button>';

  function zakProfielKaart(p){
    const skills = (p.vaardigheden || []).map(v =>
      '<span class="zak-chip' + (p.status === 'verbonden' ? ' klik js-zaanb' : '') + (v.doorMij ? ' mijn' : '') + '"' +
      ' data-key="' + escT(p.key) + '" data-v="' + escT(v.naam) + '">' + escT(v.naam) + (v.aanbevolen ? ' · ' + v.aanbevolen + ' ' : '') + '</span>').join('');
    return '<div class="zak-kaart">' +
      '<div style="display:flex;align-items:center;gap:0.6rem;">' +
        '<div class="grow-min"><b>' + escT(p.naam) + '</b>' +
        (p.pas ? ' <span style="font-size:0.56rem;letter-spacing:0.08em;color:var(--rtg-leesgoud,var(--gold));border:1px solid var(--gold);border-radius:0;padding:0.08rem 0.4rem;vertical-align:middle;">' + (TIER_LABEL[p.pas] || p.pas) + '</span>' : '') +
        (p.openVoorWerk ? ' <span class="zak-open">' + T('zak.open','open voor werk') + '</span>' : '') +
        '<div style="font-size:0.74rem;color:var(--muted);">' + escT(p.kop) +
        (p.sector ? ' · ' + escT(p.sector) : '') + (p.plaats ? ' · ' + escT(p.plaats) : '') + '</div>' +
        '<div style="font-size:0.62rem;color:var(--soft);">' + T('zak.codenaam','codenaam') + ' ' + escT(p.codenaam) +
        (p.gedeeld ? ' · ' + p.gedeeld + ' ' + T('zak.gedeeld','gedeelde connectie(s)') + (p.gedeeldNamen && p.gedeeldNamen.length ? ' (' + p.gedeeldNamen.map(escT).join(', ') + ')' : '') : '') + '</div></div>' +
        zakStatusKnop(p) + '</div>' +
      (p.bio ? '<div style="font-size:0.76rem;color:var(--muted);margin-top:0.5rem;line-height:1.5;">' + escT(p.bio) + '</div>' : '') +
      ((p.ervaring || []).length ? '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.5rem;">' + p.ervaring.map(escT).join('<br>') + '</div>' : '') +
      (skills ? '<div class="h-mt35">' + skills +
        (p.status === 'verbonden' ? '<div style="font-size:0.6rem;color:var(--soft);margin-top:0.25rem;">' + T('zak.tikskill','Tik een vaardigheid aan om hem aan te bevelen.') + '</div>' : '') + '</div>' : '') +
      '</div>';
  }

  async function zakRender(){
    const body = $('#zakBody');
/* het zakelijke blad: feed en lijsten */
    body.innerHTML = '<div style="color:var(--soft);font-size:0.8rem;padding:1rem 0;">…</div>';
    try {
      if (zakView === 'feed'){
        const d = await API.call('/zakelijk/feed');
        body.innerHTML =
          '<div class="zak-kaart"><textarea id="zakPostTekst" placeholder="' + T('zak.postph','Deel een inzicht, vraag of mijlpaal met het netwerk…') + '" style="width:100%;min-height:64px;background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.8rem;"></textarea>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.45rem;">' +
          '<span style="font-size:0.62rem;color:var(--soft);">' + (d.mijnProfiel ? T('zak.alsprof','U post onder uw professionele naam.') : T('zak.eerstprof','Maak eerst uw profiel aan (tab Mijn profiel).')) + '</span>' +
          '<button class="go" id="zakPost" style="padding:0.35rem 0.9rem;font-size:0.7rem;">' + T('zak.plaats','Plaats') + '</button></div></div>' +
          (d.posts.length ? d.posts.map(x =>
            '<div class="zak-kaart"><div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="font-size:0.82rem;">' + escT(x.naam) + '</b>' +
            '<span style="font-size:0.64rem;color:var(--soft);">' + escT(x.kop) + ' · ' + timeAgo(x.at) + '</span>' +
            (x.openVoorWerk ? '<span class="zak-open">' + T('zak.open','open voor werk') + '</span>' : '') + '</div>' +
            '<div style="font-size:0.8rem;line-height:1.55;margin-top:0.25rem;white-space:pre-wrap;">' + msgHTML(x.tekst, x.lang) + '</div>' +
            '<div style="display:flex;gap:0.9rem;margin-top:0.5rem;font-size:0.7rem;color:var(--muted);">' +
            '<button class="js-zlike" data-id="' + x.id + '" style="background:none;border:none;color:' + (x.mijnLike ? 'var(--gold)' : 'var(--muted)') + ';font-family:inherit;cursor:pointer;">' + x.likes + '</button>' +
            '<span>' + x.reactiesTotaal + '</span></div>' +
            x.reacties.map(r => '<div style="font-size:0.72rem;margin-top:0.35rem;color:var(--muted);"><b style="color:var(--txt);">' + escT(r.naam) + '</b> ' + msgHTML(r.tekst, r.lang) + '</div>').join('') +
            '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input class="js-zretxt" data-id="' + x.id + '" placeholder="' + T('zak.reageer','Reageer…') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.4rem 0.75rem;color:var(--txt);font-family:inherit;font-size:0.72rem;">' +
            '<button class="js-zre" data-id="' + x.id + '" style="background:none;border:1px solid var(--line);border-radius:0;padding:0.4rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.68rem;cursor:pointer;">↩</button></div></div>').join('')
          : '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + T('zak.leeg','Nog geen posts. Wees de eerste: deel waar u aan werkt.') + '<br><button class="rahul-leeg-knop h-mt60" data-rahul-leeg="Stel een korte zakelijke post voor me op over waar ik aan werk">' + T('zak.leegdoe','Laat Rahul een post opstellen') + '</button></div>');
        $('#zakPost').addEventListener('click', async () => {
          try { await API.call('/zakelijk/post', { tekst: $('#zakPostTekst').value }); zakRender(); }
          catch(e){ if (e.status === 409){ zakView = 'profiel'; document.querySelectorAll('.zak-tab').forEach(x => x.classList.toggle('active', x.dataset.zaktab === 'profiel')); zakRender(); } toast(e.message); }
        });
        body.querySelectorAll('.js-zlike').forEach(b => b.addEventListener('click', async () => {
          try { await API.call('/zakelijk/like', { id: b.dataset.id }); zakRender(); } catch(e){ toast(e.message); }
        }));
        body.querySelectorAll('.js-zre').forEach(b => b.addEventListener('click', async () => {
          const inp = body.querySelector('.js-zretxt[data-id="' + b.dataset.id + '"]');
          try { await API.call('/zakelijk/reactie', { id: b.dataset.id, tekst: inp.value }); zakRender(); } catch(e){ toast(e.message); }
        }));
        hydrateMsgs(body); // zakelijke feed leest per kijker in de eigen taal
      } else if (zakView === 'netwerk'){
        const zoek = async (q) => {
          const d = await API.call('/zakelijk/gids', { q, openVoorWerk: $('#zakFilterWerk') ? $('#zakFilterWerk').checked : false });
          $('#zakGids').innerHTML = d.resultaten.length ? d.resultaten.map(zakProfielKaart).join('')
            : '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + T('zak.geen','Geen profielen gevonden. Leden verschijnen hier zodra ze hun zakelijke profiel aanzetten.') + '</div>';
          $('#zakGids').querySelectorAll('.js-zcon').forEach(b => b.addEventListener('click', async () => {
            try { const r = await API.call('/zakelijk/connect', { key: b.dataset.key }); toast(r.status === 'aangevraagd' ? T('zak.gevraagd','Verzoek gestuurd. De ander accepteert in Contacten.') : r.status); zoek($('#zakZoek').value); }
            catch(e){ toast(e.message); }
          }));
          $('#zakGids').querySelectorAll('.js-zaanb').forEach(ch => ch.addEventListener('click', async () => {
            try { const r = await API.call('/zakelijk/aanbevelen', { key: ch.dataset.key, vaardigheid: ch.dataset.v });
              toast(r.aanbevolen ? T('zak.aanbevolen','Aanbevolen') + ': ' + ch.dataset.v : T('zak.ingetrokken','Aanbeveling ingetrokken.')); zoek($('#zakZoek').value); }
            catch(e){ toast(e.message); }
          }));
        };
        body.innerHTML = '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;">' +
          '<input id="zakZoek" placeholder="' + T('zak.zoekph','Zoek op naam, sector of vaardigheid…') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.5rem 0.85rem;color:var(--txt);font-family:inherit;font-size:0.76rem;">' +
          '<button class="go" id="zakZoekGo" style="padding:0.35rem 0.9rem;font-size:0.7rem;">' + T('zak.zoek','Zoek') + '</button></div>' +
          '<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.7rem;color:var(--muted);margin-top:0.5rem;"><input type="checkbox" id="zakFilterWerk"> ' + T('zak.filterwerk','Alleen leden die open voor werk zijn') + '</label>' +
          '<div id="zakGids"></div>';
        $('#zakZoekGo').addEventListener('click', () => zoek($('#zakZoek').value));
        $('#zakZoek').addEventListener('keydown', e => { if (e.key === 'Enter') zoek(e.target.value); });
        $('#zakFilterWerk').addEventListener('change', () => zoek($('#zakZoek').value));
        zoek('');
      } else if (zakView === 'kansen'){
        const SOORT_ICO = { opdracht:'', samenwerking:'', vacature:'', investering:'', anders:'' };
        const laad = async () => {
          const d = await API.call('/zakelijk/kansen', { q: $('#kansZoek').value, soort: $('#kansSoortF').value || undefined });
          const kaart = (k) => '<div class="zak-kaart">' +
            '<div style="display:flex;gap:0.5rem;align-items:baseline;"><span>' + (SOORT_ICO[k.soort] || k.icon || '') + '</span>' +
            '<div class="grow-min"><b style="font-size:0.84rem;">' + escT(k.titel) + '</b>' +
            (!k.open ? ' <span class="zak-chip">' + T('zak.k.dicht','vervuld') + '</span>' : '') +
            '<div style="font-size:0.66rem;color:var(--soft);">' +
            (k.bron === 'partner' ? T('zak.k.partner','Vacature bij RTG-partner') : escT(k.naam) + (k.kop ? ' · ' + escT(k.kop) : '')) +
            (k.plaats ? ' · ' + escT(k.plaats) : '') + (k.land ? ' · ' + escT(k.land) : '') + ' · ' + timeAgo(k.at) + '</div></div></div>' +
            (k.omschrijving ? '<div style="font-size:0.76rem;color:var(--muted);line-height:1.5;margin-top:0.25rem;">' + escT(k.omschrijving) + '</div>' : '') +
            ((k.skills || []).length ? '<div class="h-mt30">' + k.skills.map(s => '<span class="zak-chip">' + escT(s) + '</span>').join('') + '</div>' : '') +
            (k.bron === 'partner'
              ? '<div style="font-size:0.64rem;color:var(--soft);margin-top:0.5rem;">' + T('zak.k.sollhint','Solliciteren gaat met uw RTG-cv via Werk & vacatures op het thuisscherm.') + '</div>'
              : (k.vanMij
                ? ((k.reacties || []).map(r => '<div style="font-size:0.72rem;margin-top:0.35rem;color:var(--muted);"><b style="color:var(--txt);">' + escT(r.naam) + '</b> <span style="color:var(--soft);">(' + escT(r.kop || '') + ')</span> ' + escT(r.tekst) + '</div>').join('') +
                  (k.open ? '<button class="js-ksluit" data-id="' + k.id + '" style="margin-top:0.5rem;background:none;border:1px solid var(--line);border-radius:0;padding:0.35rem 0.8rem;color:var(--muted);font-family:inherit;font-size:0.66rem;cursor:pointer;">✓ ' + T('zak.k.sluit','Markeer als vervuld') + '</button>' : ''))
                : (k.open
                  ? '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input class="js-kretxt" data-id="' + k.id + '" placeholder="' + T('zak.k.reageerph','Reageer met wat u kunt betekenen…') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.4rem 0.75rem;color:var(--txt);font-family:inherit;font-size:0.72rem;">' +
                    '<button class="js-kre" data-id="' + k.id + '" style="background:none;border:1px solid var(--line);border-radius:0;padding:0.4rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.68rem;cursor:pointer;">↩</button></div>' +
/* de reactieteller onder een bericht */
                    (k.reactiesTotaal ? '<div style="font-size:0.62rem;color:var(--soft);margin-top:0.25rem;">' + k.reactiesTotaal + ' ' + T('zak.k.reacties','reactie(s)') + '</div>' : '')
                  : ''))) +
            '</div>';
          const alle = (d.kansen || []).concat(d.partnerVacatures || []);
          $('#kansLijst').innerHTML = alle.length ? alle.map(kaart).join('')
            : '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + T('zak.k.leeg','Nog geen kansen. Plaats de eerste: een opdracht, samenwerking of investeringsvraag.') + '<br><button class="rahul-leeg-knop h-mt60" data-rahul-leeg="Stel een kans op (een opdracht, samenwerking of investeringsvraag) en plaats hem voor me">' + T('zak.k.leegdoe','Laat Rahul een kans opstellen') + '</button></div>';
          $('#kansLijst').querySelectorAll('.js-kre').forEach(b => b.addEventListener('click', async () => {
            const inp = $('#kansLijst').querySelector('.js-kretxt[data-id="' + b.dataset.id + '"]');
            try { await API.call('/zakelijk/kans/reageer', { id: b.dataset.id, tekst: inp.value }); toast(T('zak.k.gereageerd','Reactie geplaatst; de plaatser ziet hem direct.')); laad(); }
            catch(e){ toast(e.message); }
          }));
          $('#kansLijst').querySelectorAll('.js-ksluit').forEach(b => b.addEventListener('click', async () => {
            try { await API.call('/zakelijk/kans/sluit', { id: b.dataset.id }); laad(); } catch(e){ toast(e.message); }
          }));
        };
        const opt = (v, l) => '<option value="' + v + '">' + l + '</option>';
        body.innerHTML =
          '<div class="zak-kaart"><b style="font-size:0.8rem;">' + T('zak.k.nieuw','Plaats een kans') + '</b>' +
          '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;">' +
          '<select id="kansSoort" aria-label="' + T('zak.k.soort','Soort kans') + '" style="background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.45rem 0.5rem;color:var(--txt);font-family:inherit;font-size:0.74rem;">' +
          opt('opdracht','' + T('zak.k.opdracht','Opdracht')) + opt('samenwerking','' + T('zak.k.samen','Samenwerking')) +
          opt('vacature','' + T('zak.k.vac','Vacature')) + opt('investering','' + T('zak.k.inv','Investering')) + opt('anders','' + T('zak.k.anders','Anders')) + '</select>' +
          '<input id="kansTitel" placeholder="' + T('zak.k.titelph','Titel, bijv. Fotograaf gezocht voor merkcampagne') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.45rem 0.6rem;color:var(--txt);font-family:inherit;font-size:0.74rem;"></div>' +
          '<textarea id="kansOms" placeholder="' + T('zak.k.omsph','Omschrijf kort wat u zoekt of biedt…') + '" style="width:100%;min-height:52px;background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.5rem 0.6rem;color:var(--txt);font-family:inherit;font-size:0.74rem;margin-top:0.4rem;"></textarea>' +
          '<div style="display:flex;gap:0.4rem;margin-top:0.4rem;align-items:center;">' +
          '<input id="kansPlaats" placeholder="' + T('zak.k.plaatsph','Plaats (optioneel)') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.45rem 0.6rem;color:var(--txt);font-family:inherit;font-size:0.74rem;">' +
          '<button class="go" id="kansPlaatsBtn" style="padding:0.4rem 0.95rem;font-size:0.7rem;">' + T('zak.plaats','Plaats') + '</button></div></div>' +
          '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;">' +
          '<input id="kansZoek" placeholder="' + T('zak.k.zoekph','Zoek in kansen en vacatures…') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.45rem 0.8rem;color:var(--txt);font-family:inherit;font-size:0.74rem;">' +
          '<select id="kansSoortF" aria-label="' + T('zak.k.filter','Filter op soort') + '" style="background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.4rem 0.5rem;color:var(--txt);font-family:inherit;font-size:0.7rem;">' +
          '<option value="">' + T('zak.k.alles','Alles') + '</option>' +
          opt('opdracht',T('zak.k.opdracht','Opdracht')) + opt('samenwerking',T('zak.k.samen','Samenwerking')) +
          opt('vacature',T('zak.k.vac','Vacature')) + opt('investering',T('zak.k.inv','Investering')) + '</select></div>' +
          '<div id="kansLijst"></div>';
        $('#kansPlaatsBtn').addEventListener('click', async () => {
          try {
            await API.call('/zakelijk/kans', { soort: $('#kansSoort').value, titel: $('#kansTitel').value,
              omschrijving: $('#kansOms').value, plaats: $('#kansPlaats').value });
            $('#kansTitel').value = ''; $('#kansOms').value = ''; toast(T('zak.k.geplaatst','Kans geplaatst.')); laad();
          } catch(e){
            if (e.status === 409){ zakView = 'profiel'; document.querySelectorAll('.zak-tab').forEach(x => x.classList.toggle('active', x.dataset.zaktab === 'profiel')); zakRender(); }
            toast(e.message);
          }
        });
        $('#kansZoek').addEventListener('keydown', e => { if (e.key === 'Enter') laad(); });
        $('#kansSoortF').addEventListener('change', laad);
        laad();
      } else {
        const d = await API.call('/zakelijk/profiel');
        const p = d.profiel || {};
        const veld = (label, id, val, ph) => '<div class="field"><label>' + label + '</label><input id="' + id + '" value="' + escT(val || '') + '"' + (ph ? ' placeholder="' + ph + '"' : '') + '></div>';
        body.innerHTML =
          '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.5rem;line-height:1.5;">' + T('zak.uitleg','Uw profiel is pas zichtbaar in de gids als u het bewaart. U kiest zelf welke naam u zakelijk gebruikt.') + '</div>' +
          (d.cvSuggestie ? '<button id="zakUitCv" class="zak-chip klik h-mt50">' + T('zak.uitcv','Vul aan vanuit mijn RTG-cv') + '</button>' : '') +
          veld(T('zak.naam','Professionele naam'), 'zakNaam', p.naam, T('zak.naamph','Standaard: uw codenaam')) +
          veld(T('zak.kop','Kop'), 'zakKop', p.kop, T('zak.kopph','Bijv. Oprichter, Fotograaf, Jurist')) +
          veld(T('zak.sector','Sector'), 'zakSector', p.sector) +
          veld(T('zak.plaats2','Plaats'), 'zakPlaats', p.plaats) +
          '<div class="field"><label>' + T('zak.bio','Over u') + '</label><textarea id="zakBio" style="min-height:70px;">' + escT(p.bio || '') + '</textarea></div>' +
          veld(T('zak.skills','Vaardigheden (komma’s)'), 'zakSkills', (p.vaardigheden || []).map(v => v.naam).join(', ')) +
          '<div class="field"><label>' + T('zak.erv','Ervaring (een regel per rol)') + '</label><textarea id="zakErv" style="min-height:80px;">' + escT((p.ervaring || []).join('\n')) + '</textarea></div>' +
          '<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.76rem;margin-top:0.5rem;"><input type="checkbox" id="zakOpenWerk"' + (p.openVoorWerk ? ' checked' : '') + '> ' + T('zak.openwerk','Open voor werk of opdrachten') + '</label>' +
          '<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.76rem;margin-top:0.25rem;"><input type="checkbox" id="zakZicht"' + (d.zichtbaar !== false ? ' checked' : '') + '> ' + T('zak.zicht','Zichtbaar in de gids') + '</label>' +
          '<button class="ms-order" id="zakBewaar" style="margin-top:0.75rem;width:100%;">' + T('zak.bewaar','Bewaar mijn profiel') + '</button>';
        if (d.cvSuggestie) $('#zakUitCv').addEventListener('click', () => {
          const s = d.cvSuggestie;
          if (!$('#zakKop').value && s.kop) $('#zakKop').value = s.kop;
          if (!$('#zakSkills').value && s.vaardigheden.length) $('#zakSkills').value = s.vaardigheden.join(', ');
          if (!$('#zakErv').value && s.ervaring.length) $('#zakErv').value = s.ervaring.join('\n');
          if (!$('#zakBio').value && s.bio) $('#zakBio').value = s.bio;
          toast(T('zak.cvok','Aangevuld vanuit uw cv. Controleer en bewaar.'));
        });
        $('#zakBewaar').addEventListener('click', async () => {
          try {
            await API.call('/zakelijk/profiel/zet', {
              naam: $('#zakNaam').value, kop: $('#zakKop').value, sector: $('#zakSector').value,
              plaats: $('#zakPlaats').value, bio: $('#zakBio').value,
              vaardigheden: $('#zakSkills').value.split(',').map(s => s.trim()).filter(Boolean),
              ervaring: $('#zakErv').value.split('\n').map(s => s.trim()).filter(Boolean),
              openVoorWerk: $('#zakOpenWerk').checked, zichtbaar: $('#zakZicht').checked
            });
            toast(T('zak.bewaard','Profiel bewaard.'));
          } catch(e){ toast(e.message); }
        });
      }
    } catch(e){
      body.innerHTML = '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + escT(e.message) + '</div>';
    }
  }

  /* ---------- interactieve AI-agenda in de backoffice + ballon op boBtn ---------- */
  let memberAgenda = null;
  function agendaBadgeLid(n){
/* de ballon op de boardroom-knop */
    const btn = document.getElementById('boBtn'); if (!btn) return;
    btn.style.position = 'relative';
    let b = btn.querySelector('.ag-ballon');
    if (n > 0){
      if (!b){ b = document.createElement('span'); b.className = 'ag-ballon'; b.setAttribute('aria-label', T('ag.badge','afspraken op de agenda')); btn.appendChild(b); }
      b.textContent = n > 9 ? '9+' : String(n);
      b.style.cssText = 'position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:0;background:#E0736A;color:#fff;font-size:10px;font-weight:700;line-height:16px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.4);';
    } else if (b) b.remove();
  }
  async function laadAgendaLid(){ if (!API.live || !API.token) return; try { memberAgenda = await API.call('/agenda/mijn-lijst', {}); } catch(e){ return; } agendaBadgeLid(memberAgenda.telling || 0); }
  function agendaToeLid(r){ if (r && r.items){ memberAgenda = r; agendaBadgeLid(r.telling || 0); } renderAgendaLid(); }

  function renderAgendaLid(){
    const el = document.getElementById('boAgendaCard'); if (!el) return;
    if (!memberAgenda){ el.innerHTML = '<div class="zak-kaart"><b style="font-size:0.8rem;">' + T('ag.titel','Agenda') + '</b><div class="fineprint">…</div></div>'; laadAgendaLid().then(renderAgendaLid); return; }
    const o = memberAgenda, items = o.items || [];
    const dagLbl = d => { try { return new Date(d+'T12:00:00').toLocaleDateString(lang()==='en'?'en-GB':'nl-NL',{weekday:'short',day:'numeric',month:'short'}); } catch(e){ return d; } };
    const inp = 'style="background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.45rem 0.55rem;color:var(--txt);font-family:inherit;font-size:0.76rem;"';
    let h = '<div class="zak-kaart"><b style="font-size:0.8rem;">' + T('ag.titel','Agenda') + (o.telling?' <span style="color:#E0736A;">('+o.telling+')</span>':'') + '</b>';
    h += items.length ? items.map(i => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:0.78rem;margin-top:0.45rem;opacity:'+(i.gedaan?'0.55':'1')+';"><span>'+(i.gedaan?'✓ ':'')+esc(i.titel)+'<span style="color:var(--muted);"> · '+esc(dagLbl(i.datum))+(i.tijd?' '+esc(i.tijd):'')+'</span></span><span style="white-space:nowrap;">'+(!i.gedaan?'<button class="ag-done" data-agdone="'+i.id+'" style="background:none;border:1px solid var(--line);border-radius:0;padding:0.15rem 0.45rem;color:var(--txt);font-size:0.68rem;cursor:pointer;">✓</button> ':'')+'<button class="ag-del" data-agdel="'+i.id+'" style="background:none;border:none;color:var(--soft);cursor:pointer;">✕</button></span></div>').join('') : '<div class="fineprint h-mt40">'+T('ag.leeg','Nog niets gepland. Typ het of laat de AI het inplannen.')+'</div>'+
      '<button class="rahul-leeg-knop h-mt50" data-rahul-leeg="Plan mijn dag: kijk wat er speelt en zet afspraken klaar">'+T('ag.leegdoe','Laat Rahul mijn dag plannen')+'</button>';
    h += '<div style="display:flex;gap:0.35rem;margin-top:0.6rem;flex-wrap:wrap;"><input id="agLidTitel" placeholder="'+T('ag.wat','Afspraak')+'" '+inp+' style="flex:1;min-width:7rem;"><input id="agLidDatum" type="date" '+inp+'><input id="agLidTijd" type="time" '+inp+'><button id="agLidAdd" style="background:var(--gold);border:none;border-radius:0;padding:0.45rem 0.7rem;color:#000;font-weight:700;cursor:pointer;">+</button></div>';
    h += '<div style="margin-top:0.55rem;border-top:1px solid var(--line);padding-top:0.5rem;"><div style="font-size:0.68rem;color:var(--soft);margin-bottom:0.3rem;">'+T('ag.aihint','Of typ het in gewone taal:')+'</div><div id="agLidAiOut"></div><div style="display:flex;gap:0.35rem;margin-top:0.35rem;"><input class="h-flex1" id="agLidAiIn" placeholder="'+T('ag.aiph','bijv. vergadering morgen om 15u')+'" '+inp+'><button id="agLidAiGo" style="background:var(--gold);border:none;border-radius:0;padding:0.45rem 0.7rem;color:#000;font-weight:700;cursor:pointer;">'+T('ag.plan','Plan')+'</button></div></div>';
    h += '</div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-agdone]').forEach(b => b.addEventListener('click', async () => { try { agendaToeLid(await API.call('/agenda/wijzig', { id: b.dataset.agdone, gedaan: true })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-agdel]').forEach(b => b.addEventListener('click', async () => { try { agendaToeLid(await API.call('/agenda/verwijder', { id: b.dataset.agdel })); } catch(e){ toast(e.message); } }));
    const add = document.getElementById('agLidAdd'); if (add) add.addEventListener('click', async () => { const titel = document.getElementById('agLidTitel').value.trim(); const datum = document.getElementById('agLidDatum').value; if (!titel||!datum){ toast(T('ag.vulin','Vul een afspraak en datum in.')); return; } try { agendaToeLid(await API.call('/agenda/toevoegen', { titel, datum, tijd: document.getElementById('agLidTijd').value })); } catch(e){ toast(e.message); } });
    const aiGo = document.getElementById('agLidAiGo'); if (aiGo){ const doe = async () => { const opdracht = document.getElementById('agLidAiIn').value.trim(); if (!opdracht) return; const out = document.getElementById('agLidAiOut'); out.innerHTML = '<div class="fineprint">…</div>'; try { const r = await API.call('/agenda/ai', { opdracht }); out.innerHTML = '<div class="fineprint" style="color:'+(r.gedaan?'#7EE0A3':'var(--txt)')+';">'+esc(r.antwoord)+'</div>'; document.getElementById('agLidAiIn').value=''; agendaToeLid(r); } catch(e){ out.innerHTML = '<div class="fineprint" style="color:#E0736A;">'+esc(e.message)+'</div>'; } }; aiGo.addEventListener('click', doe); const i2 = document.getElementById('agLidAiIn'); if (i2) i2.addEventListener('keydown', e => { if (e.key==='Enter') doe(); }); }
  }

  /* ---------- mijn facturen: automatisch bij elke aankoop ---------- */
  let memberFacturen = null;
  async function laadFacturenLid(){ if (!API.live || !API.token) return; try { memberFacturen = await API.call('/facturen/mijn', {}); } catch(e){ return; } renderFacturenLid(); }
  function renderFacturenLid(){
    const el = document.getElementById('boFacturenCard'); if (!el) return;
    if (!memberFacturen){ laadFacturenLid(); return; }
    const o = memberFacturen, items = o.facturen || [];
    const inp = 'style="background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.45rem 0.55rem;color:var(--txt);font-family:inherit;font-size:0.76rem;"';
    let h = '<div class="zak-kaart"><b style="font-size:0.8rem;">' + T('fact.mijn','Mijn facturen') + (o.telling?' <span style="color:var(--rtg-leesgoud,var(--gold));">('+o.telling+')</span>':'') + '</b>';
    h += items.length
      ? '<div style="font-size:0.72rem;color:var(--muted);margin:0.3rem 0 0.4rem;">'+T('fact.besteed','Samen besteed')+': '+eur(o.besteed||0)+'</div>' + items.slice(0,30).map(f => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:0.78rem;margin-top:0.4rem;"><span>'+esc(f.verkoper)+'<span style="color:var(--muted);"> · '+esc(f.datum)+' · '+esc(f.nummer)+'</span></span><span style="white-space:nowrap;"><b>'+eur(f.totaal)+'</b> <button class="fact-pdf" data-fpdf="'+f.id+'" data-nr="'+esc(f.nummer)+'" style="background:none;border:1px solid var(--line);border-radius:0;padding:0.15rem 0.45rem;color:var(--txt);font-size:0.68rem;cursor:pointer;">PDF</button></span></div>').join('')
      : '<div class="fineprint h-mt40">'+T('fact.geenlid','U heeft nog geen facturen. Bij een aankoop op uw codenaam verschijnt hier automatisch de factuur.')+'</div>';
    h += '<div style="margin-top:0.55rem;border-top:1px solid var(--line);padding-top:0.5rem;"><div id="factLidAiOut"></div><div style="display:flex;gap:0.35rem;margin-top:0.35rem;"><input class="h-flex1" id="factLidAiIn" placeholder="'+T('fact.lidph','Vraag over uw facturen...')+'" '+inp+'><button id="factLidAiGo" style="background:var(--gold);border:none;border-radius:0;padding:0.45rem 0.7rem;color:#000;font-weight:700;cursor:pointer;">'+T('fact.vraag','Vraag')+'</button></div></div>';
    h += '</div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-fpdf]').forEach(b => b.addEventListener('click', () => downloadPdf('/facturen/pdf', { id: b.dataset.fpdf }, (b.dataset.nr||'factuur')+'.pdf')));
    renderKluisLid(el);
    const aiGo = document.getElementById('factLidAiGo'); if (aiGo){ const doe = async () => { const opdracht = document.getElementById('factLidAiIn').value.trim(); if (!opdracht) return; const out = document.getElementById('factLidAiOut'); out.innerHTML = '<div class="fineprint">…</div>'; try { const r = await API.call('/facturen/ai', { opdracht }); out.innerHTML = '<div class="fineprint" style="color:var(--txt);white-space:pre-wrap;">'+esc(r.antwoord)+'</div>'; document.getElementById('factLidAiIn').value=''; if (r.overzicht){ memberFacturen = r.overzicht; } } catch(e){ out.innerHTML = '<div class="fineprint" style="color:#E0736A;">'+esc(e.message)+'</div>'; } }; aiGo.addEventListener('click', doe); const i2 = document.getElementById('factLidAiIn'); if (i2) i2.addEventListener('keydown', e => { if (e.key==='Enter') doe(); }); }
  }
/* DIT SLUITHAAKJE HOORT HIER, EN NIET DRIE BESTANDEN VERDEROP.

   Het stond aan het begin van 54.js, waardoor renderFacturenLid() pas daar
   dichtging -- en alles wat er in 53b.js en 53c.js tussen stond, kwam daarmee
   BINNEN die functie te liggen. De Vooruit-kaart en de postvoorstellen waren
   daardoor niet zichtbaar voor boRender() in 55.js: "renderVooruit is not
   defined", en dus een lege kaart op het scherm terwijl elke API-toets groen
   stond. Gevonden door test/vooruitscherm.e2e.js, de eerste toets die die kaart
   ECHT opende.

   Wie hier weer een deelbestand tussenvoegt: knip op een plek waar de functie
   AL dicht is. scripts/kruisscan.js ziet dit niet -- die zoekt kale verwijzingen
   naar top-level namen van een zuster, en deze namen stonden helemaal niet op
   top-level. */
  /* De Vooruit-kaart: uw termijnen, voor elke pas. Afgesplitst van 53.js toen
     dat over de 10 kB ging; de snede loopt langs een echte grens -- 53 gaat over
     de AGENDA (wat u zelf plant), dit over wat er VANZELF op u afkomt.
     Deelt de IIFE-scope met 53: API, T, esc, lang komen daarvandaan. */
  /* ---------- "Vooruit": uw termijnen, voor ELKE pas ----------
     Alles wat een datum heeft en van u is: uw paspoort uit de kluis, uw
     boekingen, uw agenda, en -- als u een Lifestyle Pass heeft -- ook uw
     verzekeringen, keuringen en visa. De motor (kern/levensgraaf) kent geen
     pas-controle; de bronnen die het premium-dossier lezen geven vanzelf niets
     terug voor wie dat dossier niet heeft.

     NIEMAND TYPT DIT. Dat is de hele reden dat deze kaart bestaat, en daarom
     staat er ook bij WAAR het vandaan komt: een lid dat ziet dat zijn paspoort
     er vanzelf in staat, vertrouwt de rest van de lijst ook. */
  let vooruitData = null;
  async function laadVooruit(){
    if (!API.live || !API.token) return;
    try { vooruitData = await API.call('/member/vooruit', {}); } catch(e){ vooruitData = { fout: true }; }
  }
  function renderVooruit(){
    const el = document.getElementById('boVooruitCard'); if (!el) return;
    if (!vooruitData){
      el.setAttribute('aria-busy', 'true');
      el.innerHTML = '<div class="zak-kaart"><b class="vo-kop">' + T('vo.titel','Vooruit') + '</b><div class="fineprint">…</div></div>';
      laadVooruit().then(renderVooruit);
      return;
    }
    el.removeAttribute('aria-busy');
    const d = vooruitData;
    if (d.fout){ el.innerHTML = ''; return; }
    const dagLbl = x => { try { return new Date(x+'T12:00:00').toLocaleDateString(lang()==='en'?'en-GB':'nl-NL',{day:'numeric',month:'short'}); } catch(e){ return x; } };
    const regel = r => '<div class="vo-rij">'
      + '<span>' + esc((r.waarvan ? r.waarvan + ' · ' : '') + r.naam) + '</span>'
      + '<span class="vo-dag">' + esc(dagLbl(r.datum)) + '</span></div>';
    let h = '<div class="zak-kaart"><b class="vo-kop">' + T('vo.titel','Vooruit')
      + (d.achterstallig.length ? ' <span class="vo-let">(' + d.achterstallig.length + ')</span>' : '') + '</b>';
    if (!d.totaal){
      h += '<div class="fineprint vo-mt">' + T('vo.leeg','Er staat nog niets met een datum op uw naam. Zodra u iets boekt of uw paspoort scant, verschijnt het hier vanzelf.') + '</div>';
    } else {
      if (d.achterstallig.length){
        h += '<div class="vo-groep laat">' + T('vo.laat','Al voorbij') + '</div>';
        h += d.achterstallig.slice(0,4).map(regel).join('');
      }
      for (const v of d.vensters){
        if (!v.aantal) continue;
        h += '<div class="vo-groep">' + esc(v.label) + '</div>';
        h += v.items.slice(0,5).map(regel).join('');
        break;   // alleen het eerstvolgende venster met inhoud; dit is een kaart, geen lijst
      }
      h += '<div class="fineprint vo-mt2">'
        + T('vo.bron','Automatisch verzameld uit') + ': ' + esc(d.bronnen.join(', ')) + '.</div>';
    }
    for (const a of (d.afgekapt || [])) h += '<div class="fineprint vo-dak">' + T('vo.dak','Wij tonen de eerste') + ' ' + a.dak + ' ' + T('vo.uit','uit') + ' ' + esc(a.bron) + '.</div>';
    for (const s2 of (d.stuk || [])) h += '<div class="fineprint vo-let">' + T('vo.stuk','Wij kunnen dit deel nu niet uitlezen') + ': ' + esc(s2) + '.</div>';
    h += '</div>';
    el.innerHTML = h;
  }
  /* De post-voorstellen: datums die zichzelf aandienen.

     Afgesplitst van 53b, en de snede loopt langs een echte grens: 53b toont wat
     er AL vaststaat, dit toont wat er nog niet vaststaat en wat u kunt
     bevestigen.

     WAAROM HIER EEN KNOP ZIT EN GEEN AUTOMAAT. Wat hieronder staat komt uit
     gewone taal in een bericht -- "uw afspraak staat op 14 september om 19:30".
     Dat raden gaat vaak goed en soms mis, en een datum die er ongezien in glijdt
     staat op een dag op de verkeerde dag. Vandaar: de ZIN erbij, uw oordeel
     erover, en pas dan de agenda in. Zie de kop van server/kern/postdatum.js.

     Deelt de IIFE-scope met 53/53b: API, T, esc, lang komen daarvandaan. */
  let postData = null;
  async function laadPostDatums(){
    if (!API.live || !API.token) return;
    try { postData = await API.call('/member/vooruit/post', {}); } catch(e){ postData = { fout: true }; }
  }
  function renderPostDatums(){
    const el = document.getElementById('boPostCard'); if (!el) return;
    if (!postData){ el.innerHTML = ''; laadPostDatums().then(renderPostDatums); return; }
    const d = postData;
    if (d.fout || !d.voorstellen || !d.voorstellen.length){
      /* Niets voor te stellen is GEEN reden om te zwijgen als de lezer wel iets
         heeft laten liggen: dan hoort er te staan dat er iets is overgeslagen,
         anders leest een lege kaart als "er stond niets in uw post". */
      el.innerHTML = (!d.fout && d.overgeslagen)
        ? '<div class="zak-kaart"><b class="vo-kop">' + T('po.titel','Uit uw post') + '</b>'
          + '<div class="fineprint vo-mt">' + T('po.niets','Wij vonden geen datum die wij met zekerheid konden lezen.') + ' '
          + d.overgeslagen + ' ' + T('po.over','stonden er te twijfelachtig bij (bijvoorbeeld 03/04: dat is 3 april of 4 maart).') + '</div></div>'
        : '';
      return;
    }
    const dagLbl = x => { try { return new Date(x+'T12:00:00').toLocaleDateString(lang()==='en'?'en-GB':'nl-NL',{day:'numeric',month:'short'}); } catch(e){ return x; } };
    let h = '<div class="zak-kaart"><b class="vo-kop">' + T('po.titel','Uit uw post')
      + ' <span class="vo-let">(' + d.voorstellen.length + ')</span></b>'
      + '<div class="fineprint vo-mt">' + T('po.uitleg','Dit vonden wij in uw eigen post. Er gaat niets vanzelf in uw agenda; u bevestigt.') + '</div>';
    for (const v of d.voorstellen.slice(0,6)){
      h += '<div class="po-blok">'
        + '<div class="po-van">' + esc(v.van) + (v.vertrouwd ? '' : ' · <span class="vo-let">' + T('po.buiten','van buiten') + '</span>') + '</div>'
        + '<div class="po-ond">' + esc(v.onderwerp) + '</div>';
      for (const dt of v.datums.slice(0,3)){
        h += '<div class="vo-rij"><span>' + esc(dt.zin) + '</span>'
          + '<span class="vo-dag">' + esc(dagLbl(dt.datum)) + (dt.tijd ? ' ' + esc(dt.tijd) : '') + '</span></div>'
          + '<div class="po-knoppen"><button class="po-ja" data-poneem="' + esc(v.id) + '" data-podag="' + esc(dt.datum) + '" data-potitel="' + esc(v.onderwerp) + '">'
          + T('po.zet','Zet in mijn agenda') + '</button></div>';
      }
      h += '<div class="po-knoppen"><button class="po-nee" data-poweg="' + esc(v.id) + '">' + T('po.weg','Niet nodig') + '</button></div>'
        + '</div>';
    }
    if (d.overgeslagen) h += '<div class="fineprint vo-dak">' + d.overgeslagen + ' '
      + T('po.over2','datums waren te twijfelachtig om voor te stellen.') + '</div>';
    h += '</div>';
    el.innerHTML = h;

    const opnieuw = async () => { postData = null; vooruitData = null; renderPostDatums(); renderVooruit(); };
    el.querySelectorAll('[data-poneem]').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/member/vooruit/post/neem', { id: b.dataset.poneem, datum: b.dataset.podag, titel: b.dataset.potitel });
        opnieuw();
      } catch(e){ if (typeof toast === 'function') toast(e.message); }
    }));
    el.querySelectorAll('[data-poweg]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/member/vooruit/post/negeer', { id: b.dataset.poweg }); opnieuw(); }
      catch(e){ if (typeof toast === 'function') toast(e.message); }
    }));
  }
  /* ---------- de Toestelkluis: eigen kopieen op het eigen toestel ----------
     Elke download (factuur, overzicht) krijgt stil een kopie in de prive
     browseropslag van dit toestel; hier ziet het lid ze, opent of wist ze.
     De server houdt alleen het gezaghebbende record. */
  async function renderKluisLid(host){
    if (!window.Toestelkluis || !Toestelkluis.kan()) return;
    const items = await Toestelkluis.lijst();
    const kaart = document.createElement('div');
    kaart.className = 'zak-kaart';
    kaart.innerHTML = '<b style="font-size:0.8rem;">' + T('kluis.h','Op dit toestel') + '</b>' +
      '<div class="fineprint h-mt25">' + T('kluis.d','Uw eigen kopieen, opgeslagen in de beveiligde opslag van deze browser. Alleen u kunt erbij; er gaat niets over de lijn.') + '</div>' +
      (items.length ? items.slice(0, 10).map(x =>
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:0.76rem;margin-top:0.5rem;">' +
          '<span>' + esc(x.naam) + '<span style="color:var(--muted);"> · ' + Math.max(1, Math.round(x.bytes/1024)) + ' kB</span></span>' +
          '<span style="white-space:nowrap;"><button class="js-klopen" data-k="' + esc(x.naam) + '" style="background:none;border:1px solid var(--line);border-radius:0;padding:0.15rem 0.45rem;color:var(--txt);font-size:0.68rem;cursor:pointer;">' + T('kluis.open','Open') + '</button> ' +
          '<button class="js-klwis" data-k="' + esc(x.naam) + '" aria-label="' + T('kluis.wis','wis') + '" style="background:none;border:1px solid var(--line);border-radius:0;padding:0.15rem 0.45rem;color:var(--soft);font-size:0.68rem;cursor:pointer;">✕</button></span></div>').join('')
        : '<div class="fineprint h-mt40">' + T('kluis.leeg','Nog leeg. Download een factuur of overzicht en uw kopie verschijnt hier vanzelf.') + '</div>');
    host.appendChild(kaart);
    kaart.querySelectorAll('.js-klopen').forEach(b => b.addEventListener('click', async () => {
      const f = await Toestelkluis.haal(b.dataset.k); if (!f) return;
      const url = URL.createObjectURL(f);
      const a = document.createElement('a'); a.href = url; a.download = b.dataset.k; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }));
    kaart.querySelectorAll('.js-klwis').forEach(b => b.addEventListener('click', async () => {
      await Toestelkluis.wis(b.dataset.k); renderFacturenLid();
    }));
  }

  /* ---------- Mijn backoffice: de slimme accountkamer van elke pas ---------- */
  function boOpen(){ $('#bo-scrim').classList.add('open'); $('#bo-sheet').classList.add('open'); boRender(); }
  function boDicht(){ $('#bo-scrim').classList.remove('open'); $('#bo-sheet').classList.remove('open'); }
  $('#boBtn').addEventListener('click', boOpen);
  $('#boClose').addEventListener('click', boDicht);
  $('#bo-scrim').addEventListener('click', boDicht);
  const naarTab = (naam) => { boDicht(); const b = document.querySelector('#tabbar [data-tab="' + naam + '"]'); if (b) b.click(); };

  async function boRender(){
    const body = $('#boBody');
    $('#boSub').textContent = (TIER_LABEL[user.tier] || '') + ' · ' + (user.codename || user.name || '');
    const kaart = (titel, inhoud) => '<div class="zak-kaart"><b style="font-size:0.8rem;">' + titel + '</b>' + inhoud + '</div>';
    const rij = (l, w) => '<div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-top:0.4rem;"><span style="color:var(--muted);">' + l + '</span><b>' + w + '</b></div>';
    const knopje = (id, tekst) => '<button id="' + id + '" style="margin-top:0.55rem;margin-right:0.4rem;background:none;border:1px solid var(--line);border-radius:0;padding:0.4rem 0.85rem;color:var(--txt);font-family:inherit;font-size:0.7rem;cursor:pointer;">' + tekst + '</button>';

    // de slimme cijfers: wat er open staat komt bovenaan, met een knop erbij
    const open = invoices.filter(i => i.status === 'open');
    const betaald = invoices.filter(i => i.status === 'paid');
    const totaalBetaald = betaald.reduce((s, i) => s + (i.netto || 0) + (i.bijdrage || 0), 0);
    const fonds = betaald.reduce((s, i) => s + Math.round((i.bijdrage || 0) * 0.3), 0);
    const acties = [];
    if (open.length) acties.push('' + open.length + ' ' + T('bo2.open','openstaande factuur/facturen; betaal in één tik via Betalen.'));
    if (user.account && user.emailVerified === false) acties.push('' + T('bo2.mailniet','Uw e-mailadres is nog niet bevestigd.'));
    if (user.account && user.verified && user.verified !== 'verified') acties.push('' + T('bo2.kyc','Verifieer uw identiteit om in één tik te boeken.'));

    let html = '';
    if (acties.length) html += kaart('' + T('bo2.acties','Nu aandacht nodig'),
      acties.map(a => '<div class="fineprint">' + a + '</div>').join('') +
      (open.length ? knopje('boNaarBetalen', T('bo2.betaalnu','Naar Betalen')) : ''));
    else html += kaart('✓ ' + T('bo2.alsklaar','Alles op orde'), '<div style="font-size:0.76rem;color:var(--muted);margin-top:0.5rem;">' + T('bo2.geen','Geen openstaande zaken op uw account.') + '</div>');

    html += kaart('' + T('bo2.cijfers','Mijn cijfers'),
      rij(T('bo2.betaald','Betaald via RTG'), eur(totaalBetaald)) +
      rij(T('bo2.facturen','Facturen'), betaald.length + ' ' + T('bo2.voldaan','voldaan') + (open.length ? ' · ' + open.length + ' open' : '')) +
      rij('RTFoundation', eur(fonds) + ' ' + T('bo2.viamij','via mijn bijdragen')) +
      (myApps && myApps.length ? rij(T('bo2.sollicitaties','Sollicitaties'), String(myApps.length)) : ''));

    // interactieve AI-agenda
    /* "Vooruit": uw termijnen, voor ELKE pas -- ook de gratis app. De motor
       (kern/levensgraaf) zit niet achter een pas, want een gratis lid heeft ook
       een paspoort dat verloopt en een boeking die komt. Vandaar geen
       tier-controle op deze regel, in tegenstelling tot de twee eronder. */
    html += '<div id="boVooruitCard"></div>';
    /* En de voorstellen uit de eigen post (53c). Wel achter "geen gast": een
       gast heeft geen postvak, dus die kaart zou voor hem altijd leeg zijn. */
    if (user.tier !== 'guest') html += '<div id="boPostCard"></div>';
    if (user.tier !== 'guest') html += '<div id="boAgendaCard"></div>';
    // mijn facturen (automatisch bij elke aankoop)
    if (user.tier !== 'guest') html += '<div id="boFacturenCard"></div>';

    if (user.account){
      html += kaart('' + T('bo2.beveiliging','Beveiliging'),
        rij(T('bo2.lidsinds','Lid sinds'), user.since || '') +
        rij(T('bo2.email','E-mail bevestigd'), user.emailVerified === false ? T('bo2.nee','nee') : T('bo2.ja','ja')) +
        '<div style="font-size:0.68rem;color:var(--soft);margin-top:0.5rem;line-height:1.5;">' + T('bo2.2fa','Wachtwoord vergeten? Dat herstelt u via de website in twee stappen: een link per e-mail plus een code op uw telefoon.') + '</div>' +
        '<div style="display:flex;gap:0.4rem;margin-top:0.55rem;flex-wrap:wrap;">' +
        '<input id="boWwHuidig" type="password" placeholder="' + T('bo2.huidig','Huidig wachtwoord') + '" autocomplete="current-password" style="flex:1;min-width:9rem;background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.5rem 0.65rem;color:var(--txt);font-family:inherit;font-size:0.76rem;">' +
        '<input id="boWwNieuw" type="password" placeholder="' + T('bo2.nieuw','Nieuw wachtwoord') + '" autocomplete="new-password" style="flex:1;min-width:9rem;background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.5rem 0.65rem;color:var(--txt);font-family:inherit;font-size:0.76rem;">' +
        '</div>' + knopje('boWwZet', T('bo2.wijzig','Wijzig wachtwoord')) +
        (user.emailVerified === false ? knopje('boVerstuur', T('bo2.verstuur','Stuur bevestigingsmail opnieuw')) : ''));
    } else {
      html += kaart('' + T('bo2.beveiliging','Beveiliging'),
        '<div class="fineprint">' + T('bo2.demo','Magnaat-testprofiel · accountbeheer en tweestapsherstel zijn in deze geïsoleerde training uitgeschakeld.') + '</div>');
    }

    // weergave: RTG en Lifestyle kunnen tussen het pas-thema en klassiek donker
/* het thema van de vaste pas */
    if (vastePas === 'rtg' || vastePas === 'lifestyle'){
      const pasNaam = vastePas === 'rtg' ? T('bo2.thema.bordeaux','Bordeaux (RTG)') : T('bo2.thema.parel','Parelmoer (Lifestyle)');
      const nu = pasThemaHuidig();
      const knop = (val, tekst) => '<button class="js-thema" data-thema="' + val + '" style="margin-top:0.5rem;margin-right:0.4rem;border-radius:0;padding:0.4rem 0.85rem;font-family:inherit;font-size:0.7rem;cursor:pointer;border:1px solid ' + (nu===val?'var(--gold)':'var(--line)') + ';background:' + (nu===val?'var(--gold)':'none') + ';color:' + (nu===val?'#000':'var(--txt)') + ';">' + tekst + '</button>';
      html += kaart('' + T('bo2.weergave','Weergave'),
        '<div class="fineprint">' + T('bo2.weergave.s','Kies het kleurthema van deze app.') + '</div>' +
        knop(THEMA_STANDAARD[vastePas], pasNaam) + knop('standaard', T('bo2.thema.klassiek','Klassiek (donker)')));
    }

    // pas-specifiek: elke pas zijn eigen slimme snelkoppelingen
    if (user.tier === 'business'){
      html += kaart('' + T('bo2.vb','Voor uw Business Pass'),
        '<div class="fineprint">' + T('bo2.vb.s','Uw facturen zijn boekhoudklaar. De AI-boekhouder en de zzp-belastingtool staan onder Betalen; uw netwerk onder Salon.') + '</div>' +
        knopje('boNaarBoekhouder', '' + T('bo2.boekhouder','AI-boekhouder')) + knopje('boNaarZakelijk', 'RTG Zakelijk'));
    } else if (user.tier === 'lifestyle'){
      html += kaart('' + T('bo2.vl','Voor uw Lifestyle Pass'),
        '<div class="fineprint">' + T('bo2.vl.s','Uw concierge denkt vooruit onder AI; uw professionele netwerk staat onder Salon.') + '</div>' +
        knopje('boNaarAi', '' + T('bo2.concierge','Concierge')) + knopje('boNaarZakelijk', 'RTG Zakelijk'));
    } else {
      html += kaart('' + T('bo2.vr','Voor uw pas'),
        '<div class="fineprint">' + T('bo2.vr.s','Boeken, betalen, vrienden en De Salon zitten in uw pas. Lifestyle en Business voegen de concierge, de AI-boekhouder en RTG Zakelijk toe.') + '</div>');
    }
    body.innerHTML = html;
    renderVooruit();
    renderPostDatums();
    renderAgendaLid();
    renderFacturenLid();

    const bind = (id, fn) => { const e = document.getElementById(id); if (e) e.addEventListener('click', fn); };
    bind('boNaarBetalen', () => naarTab('betalen'));
    bind('boNaarBoekhouder', () => naarTab('betalen'));
    bind('boNaarAi', () => naarTab('ai'));
    bind('boNaarZakelijk', () => { boDicht(); naarTab('salon'); setTimeout(() => { const z = document.getElementById('zakOpenBtn'); if (z) z.click(); }, 150); });
    body.querySelectorAll('.js-thema').forEach(b => b.addEventListener('click', () => { pasThemaZet(b.dataset.thema); boRender(); }));
    bind('boVerstuur', async () => {
      try { const d = await API.call('/auth/resend'); toast(T('bo2.gestuurd','Bevestigingsmail verstuurd.')); if (d.devVerifyUrl) console.log('verify:', d.devVerifyUrl); }
      catch(e){ toast(e.message); }
    });
    bind('boWwZet', async () => {
      try {
        await API.call('/auth/password', { huidig: $('#boWwHuidig').value, nieuw: $('#boWwNieuw').value });
        $('#boWwHuidig').value = ''; $('#boWwNieuw').value = '';
        toast(T('bo2.gewijzigd','Wachtwoord gewijzigd.'));
      } catch(e){ toast(e.message); }
    });
  }


  /* ---------- Toon je Zegel: officiele ID-/leeftijdscontrole zonder je naam ----------
     Het lid kiest welk FEIT het bewijst (18+, 21+, lid, welke pas) en toont een
     QR. De leverancier scant en verifieert die offline met de publieke sleutel:
     RTG staat met de handtekening garant dat het paspoort is gezien. Er gaat
     nooit een naam, geboortedatum of pasnummer mee; alleen het bewezen feit. */
  function zegelStijlEenmalig(){
    if (document.getElementById('rtg-zegel-stijl')) return;
    const st = document.createElement('style'); st.id = 'rtg-zegel-stijl';
    st.textContent = [
      '.zg-ov{position:fixed;inset:0;z-index:99998;background:rgba(12,12,11,.72);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;}',
      '.zg-card{background:var(--bg,#0C0C0B);color:var(--txt,#fff);width:100%;max-width:520px;border-radius:0;padding:1.3rem 1.3rem calc(1.3rem + env(safe-area-inset-bottom,0));max-height:92vh;overflow-y:auto;}',
      '.zg-card h3{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;font-size:1.25rem;margin:.1rem 0 .2rem;}',
      '.zg-sub{color:var(--soft,#8A8680);font-size:.82rem;margin-bottom:1rem;}',
      '.zg-opt{display:flex;align-items:center;gap:.7rem;padding:.7rem .2rem;border-bottom:1px solid var(--line,#26251f);cursor:pointer;font-size:.95rem;}',
      '.zg-opt input{width:20px;height:20px;accent-color:#7F1634;}',
      '.zg-btn{width:100%;margin-top:1rem;background:#7F1634;color:#fff;border:none;border-radius:0;padding:.85rem;font-weight:600;font-family:inherit;font-size:.95rem;cursor:pointer;}',
      '.zg-btn.sec{background:none;border:1px solid var(--line,#3a3a38);color:var(--soft,#8A8680);}',
      '.zg-qrwrap{text-align:center;}',
      '.zg-qr{background:#fff;display:inline-block;padding:14px;border-radius:0;margin:.4rem 0;}',
      '.zg-qr canvas{display:block;width:min(64vw,260px);height:auto;image-rendering:pixelated;}',
      '.zg-badge{display:inline-flex;align-items:center;gap:.4rem;background:rgba(133,112,7,.16);color:#C9A227;border:1px solid rgba(133,112,7,.4);border-radius:0;padding:.3rem .8rem;font-size:.78rem;font-weight:600;margin:.2rem 0;}',
      '.zg-claims{display:flex;flex-wrap:wrap;gap:.4rem;justify-content:center;margin:.6rem 0;}',
      '.zg-claim{background:rgba(194,58,94,.14);color:#C23A5E;border-radius:0;padding:.25rem .7rem;font-size:.8rem;font-weight:600;}',
      '.zg-tel{font-size:.8rem;color:var(--soft,#8A8680);}'
    ].join('');
    document.head.appendChild(st);
  }
  const ZG_CLAIMS = [
    { id: 'leeftijd18', label: '18 jaar of ouder' },
    { id: 'leeftijd21', label: '21 jaar of ouder' },
    { id: 'lid', label: 'Geldig RTG-lid' },
    { id: 'pas', label: 'Welke pas ik heb' }
  ];
  let zgTimer = null;
  function sluitZegel(){ if (zgTimer){ clearInterval(zgTimer); zgTimer = null; } const o = document.getElementById('zgOverlay'); if (o) o.remove(); }
  function openZegel(){
    if (!window.RTGQRteken){ toast(T('zg.nietklaar','Het QR-onderdeel is nog niet geladen.')); return; }
    zegelStijlEenmalig(); sluitZegel();
    const ov = document.createElement('div'); ov.className = 'zg-ov'; ov.id = 'zgOverlay';
    ov.innerHTML = '<div class="zg-card" role="dialog" aria-modal="true" aria-label="'+T('zg.titel','Toon je Zegel')+'">'+
      '<h3>'+T('zg.titel','Toon je Zegel')+'</h3>'+
      '<div class="zg-sub">'+T('zg.sub','Bewijs een feit aan de zaak zonder je naam te tonen. RTG staat garant dat je paspoort is gezien.')+'</div>'+
      '<div id="zgKies">'+ ZG_CLAIMS.map((c,i) => '<label class="zg-opt"><input type="checkbox" data-claim="'+c.id+'"'+(i<1?' checked':'')+'><span>'+c.label+'</span></label>').join('') +
      '<button class="zg-btn" id="zgMaak">'+T('zg.toon','Toon mijn Zegel')+'</button>'+
      '<button class="zg-btn sec" id="zgAnnuleer">'+T('zg.annuleer','Annuleren')+'</button></div>'+
      '<div id="zgResultaat"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) sluitZegel(); });
    document.getElementById('zgAnnuleer').addEventListener('click', sluitZegel);
    document.getElementById('zgMaak').addEventListener('click', maakZegel);
  }
  async function maakZegel(){
    const gekozen = Array.from(document.querySelectorAll('#zgKies [data-claim]:checked')).map(x => x.dataset.claim);
    if (!gekozen.length){ toast(T('zg.kies','Kies minstens een feit om te bewijzen.')); return; }
    let d;
    try { d = await API.call('/zegel/maak', { claims: gekozen, geldigMin: 5 }); }
    catch(e){ toast(e.message); return; }
    const claims = d.claims || {};
    const bewezen = Object.keys(claims);
    if (!bewezen.length){ toast(T('zg.geen','Geen van deze feiten kon worden bewezen voor jouw account.')); return; }
    // teken de QR met ruime foutcorrectie-marge (niveau L past de meeste combinaties
    // in een scanbare code); lukt het niet, vraag dan om minder feiten tegelijk
    let canvas;
    try { canvas = RTGQRteken.teken(d.token, { schaal: 6, ecc: 'L' }); }
    catch(e){ toast(T('zg.telang','Te veel feiten tegelijk voor een scanbare code. Kies er een of twee.')); return; }
    const labelVoor = k => k === 'pas' ? (T('zg.pas','Pas') + ': ' + claims[k]) : (ZG_CLAIMS.find(c => c.id === k) || {}).label || k;
    const kies = document.getElementById('zgKies'); if (kies) kies.style.display = 'none';
    const res = document.getElementById('zgResultaat');
    res.innerHTML = '<div class="zg-qrwrap"><div class="zg-badge">\u{1F6E1} '+T('zg.geverifieerd','RTG-geverifieerd')+'</div>'+
      '<div class="zg-qr" id="zgQr"></div>'+
      '<div class="zg-claims">'+ bewezen.map(k => '<span class="zg-claim">✓ '+labelVoor(k)+'</span>').join('') +'</div>'+
      '<div class="zg-tel" id="zgTel"></div>'+
      '<button class="zg-btn sec" id="zgSluit">'+T('zg.klaar','Klaar')+'</button></div>';
    document.getElementById('zgQr').appendChild(canvas);
/* het zegel: aftellen en sluiten */
    document.getElementById('zgSluit').addEventListener('click', sluitZegel);
    const eind = Date.now() + (d.geldigMin || 5) * 60000;
    const tel = document.getElementById('zgTel');
    function tik(){
      const over = Math.max(0, eind - Date.now());
      const m = Math.floor(over / 60000), s = Math.floor((over % 60000) / 1000);
      tel.textContent = over > 0 ? T('zg.geldig','Geldig nog ') + m + ':' + String(s).padStart(2,'0') : T('zg.verlopen','Verlopen; maak een nieuwe.');
      if (over <= 0 && zgTimer){ clearInterval(zgTimer); zgTimer = null; }
    }
    tik(); zgTimer = setInterval(tik, 1000);
  }
  const _zegelBtn = document.getElementById('zegelBtn');
  if (_zegelBtn) _zegelBtn.addEventListener('click', openZegel);
/* RTG Scan: de scanknop van de leden-app. Stond in ./app-main-56.js naast het
   zegel, en dat waren twee onderwerpen in een bestand -- de omvangregel van de
   keuring wees dat aan zodra deze laag er inhoud bij kreeg. */
  /* ---------- RTG Scan: EEN weg voor elke code (LINK.md par. 4, stap 4) ----------

     HIER STOND EEN KETEN VAN ALS-DANS: is het een tafel, dan het menu; is het
     een kascode, dan een tekstje; is het een entree, dan een ander tekstje; en
     anders de ruwe tekst. Elke nieuwe soort code kwam er als een tak bij, en
     elke app had zijn eigen keten -- precies de versnippering waar RTG Link voor
     bestaat. De vraag "wat is dit en wat kan ik ermee" wordt nu EEN keer
     gesteld, aan de laag die het weet.

     De weg is die van LINK.md par. 2: oplossen, laten zien wat er gaat gebeuren
     (shared/linkkaart.js), een mens laten bevestigen, en dan pas uitvoeren.

     WAT ER NIET VERANDERT: de handelingen zelf. Een tafel opent nog steeds het
     menu, een verzoek gaat nog steeds langs /member/pin/connect. De laag zegt
     alleen WELKE weg erbij hoort; deze tabel weet hoe die weg er in dit scherm
     uitziet -- soms een aanroep, soms een la die opengaat. */
  const LINK_ACTIES = {
    // een mens toevoegen: de vaste pin draagt hij leesbaar, de levende code niet
    'contact.verbinden': async (kaart, tekst, intentie) => {
      const g = window.RTGCode ? RTGCode.lees(tekst) : { soort: 'tekst' };
      const lijf = kaart.vorm === 'levend'
        ? { livecode: tekst, bevestiging: kaart.bevestiging }
        : { pin: g.pin || tekst, bevestiging: kaart.bevestiging };
      const r = await API.call(intentie.weg.replace(/^\/api/, ''), lijf);
      toast(T('scan.verzoekuit','Verzoek verstuurd naar ') + (kaart.onderwerp.codename || r.codename || ''));
      if (typeof loadSocial === 'function') loadSocial();
    },
    // al verbonden: dan is de volgende stap een gesprek, geen tweede verzoek
    'contact.gesprek': async (kaart) => {
      if (!kaart.onderwerp.key) { toast(T('scan.geenchat','Open het gesprek vanuit je vriendenlijst.')); return; }
      openDm(kaart.onderwerp.key, kaart.onderwerp.codename || '');
    },
    // de tafel-QR: hetzelfde als altijd, alleen nu met de kaart ervoor
    'plaats.bestellen': async (kaart) => {
      await openMenu(kaart.onderwerp.code);
      if (menuState){ menuState.table = kaart.onderwerp.plek || ''; renderMenuSheet(); }
      toast('\u{1FA91} ' + (kaart.onderwerp.plek ? T('scan.tafel','Tafel') + ' ' + kaart.onderwerp.plek : T('scan.zaakopen','Menu geopend')));
    },
    /* Een capability: iemand vraagt je iets te doen -- vandaag "betaal mij" uit
       kern/pay/vraagcode.js. Wat er precies gebeurt stond op de kaart; hier
       wordt het alleen nog uitgevoerd. */
    'capability.aanvaarden': async (kaart, tekst, intentie) => {
      const r = await API.call(intentie.weg.replace(/^\/api/, ''), { capcode: tekst });
      toast((r.kaart && r.kaart.wat ? r.kaart.wat + ': ' : '') + T('scan.gedaan','gelukt.'));
      if (typeof ververs === 'function') ververs();
    }
  };

  async function scanRoute(tekst){
    if (!window.RTGLinkKaart){ toast(T('scan.nietklaar','De scanner is nog niet geladen.')); return; }
    let kaart;
    try {
      kaart = await API.call('/link/los', { tekst });
    } catch(e){
      /* 422 = dit is geen code van ons. Dan is de eerlijkste uitkomst nog steeds
         wat er stond: een QR van de bushalte hoort geen foutmelding te geven. */
      if (e && e.status === 422) { toast(String(tekst || '').slice(0, 90)); return; }
      toast(e.message || T('scan.nietgevonden','Deze code kon niet worden geopend.'));
      return;
    }
    const keuze = await RTGLinkKaart.toon(kaart, {});
    if (!keuze) return;
    const doen = LINK_ACTIES[keuze.id];
    /* Een knop zonder handeling hoort niet te bestaan: de lijst van de server en
       deze tabel gaan over dezelfde intenties, en test/linkscan.test.js zakt
       zodra er een bijkomt die hier ontbreekt. */
    if (!doen){ toast(T('scan.nognietkan','Dit kan in deze app nog niet.')); return; }
    try { await doen(kaart, tekst, keuze); }
    catch(e){ toast(e.message || T('scan.mislukt','Dat lukte niet.')); }
  }
  const _scanBtn = document.getElementById('scanBtn');
  if (_scanBtn) _scanBtn.addEventListener('click', () => {
    if (!window.RTGScanknop){ toast(T('scan.nietklaar','De scanner is nog niet geladen.')); return; }
    RTGScanknop.open({
      titel: T('scan.titel','Scan een RTG-code'),
      hint: T('scan.hint','Richt op de QR op je tafel om te bestellen, of op een andere RTG-code.'),
      onCode: (c) => { scanRoute(c.tekst); }
    });
  });
/* De Salon: de etalage van een partner en de tijdlijn. Stond in ./app-main-56.js,
   samen met het zegel en de scanknop -- drie onderwerpen in een bestand, wat de
   omvangregel van de keuring aanwees zodra RTG Scan er inhoud bij kreeg. */
  /* ---------- salon ---------- */

  // De publieke Salon-etalage van een partner: bio, foto's, folders, deals, polls
  async function openEtalage(code){
    let d;
    try { d = await API.call('/salon/profiel', { code }); } catch(e){ toast(e.message); return; }
    const p = d.partner;
    await laadBetaalVerzoeken();
    const vz = betaalVerzoeken.filter(v => v.supplierCode === code);
    const kanBetalen = user && user.tier !== 'guest';
    let ov = document.getElementById('etalage-ov');
    if (!ov){ ov = document.createElement('div'); ov.id = 'etalage-ov';
      ov.style.cssText = 'position:fixed;inset:0;z-index:120;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    }
    const eur2 = n => '€ ' + Number(n||0).toLocaleString('nl-NL');
    const items = d.items || [];
    const html =
      '<div style="width:100%;max-width:560px;max-height:88vh;overflow-y:auto;background:var(--bg);border-radius:0;border:1px solid var(--line);">' +
      '<div style="position:relative;">' +
        (p.foto ? '<img src="' + p.foto + '" alt="" style="width:100%;height:150px;object-fit:cover;border-radius:0;">' : '<div style="height:80px;"></div>') +
        '<button id="etaClose" style="position:absolute;top:0.7rem;right:0.7rem;background:rgba(0,0,0,0.5);color:#fff;border:none;border-radius:0;width:34px;height:34px;font-size:1rem;cursor:pointer;">✕</button>' +
      '</div>' +
      '<div style="padding:1rem 1.1rem 1.4rem;">' +
        '<div style="display:flex;align-items:center;gap:0.6rem;"><b style="font-size:1.1rem;font-family:\'Bodoni Moda\',serif;">' + escT(p.name) + '</b>' +
          '<button id="etaVolg" style="margin-left:auto;background:' + (p.volgIk ? 'var(--rtg-leesgoud,var(--goud))' : 'none') + ';color:' + (p.volgIk ? '#000' : 'var(--rtg-leesgoud,var(--goud))') + ';border:1px solid var(--rtg-leesgoud,var(--goud));border-radius:0;padding:0.3rem 0.9rem;font-size:0.72rem;font-weight:600;font-family:inherit;cursor:pointer;">' + (p.volgIk ? '✓ ' + T('sal.volgt','Volgt') : '+ ' + T('sal.volg','Volg')) + '</button></div>' +
        '<div style="font-size:0.74rem;color:var(--soft);margin-top:0.2rem;">' + (p.icon ? p.icon + ' ' : '') + escT(p.typeLabel || '') + ' · ' + escT(p.city || '') + ' · ' + p.volgers + ' ' + T('sal.volgers','volgers') + '</div>' +
        (p.bio ? '<div style="font-size:0.86rem;margin-top:0.6rem;line-height:1.5;">' + escT(p.bio) + '</div>' : '') +
        (kanBetalen ? '<button id="etaBetaal" class="mo-pay" style="width:100%;justify-content:center;margin-top:0.8rem;padding:0.7rem;">' + FID_MINI + T('dp.betaaldirect','Betaal direct met Face ID') + '</button>' : '') +
        (vz.length ? '<div class="h-mt80">' + vz.map(v =>
          '<div style="border:1px solid var(--rtg-leesgoud,var(--goud));border-radius:0;padding:0.7rem 0.9rem;margin-top:0.5rem;background:var(--card);">' +
          '<div style="font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--rtg-leesgoud,var(--goud));">' + FID_MINI + T('dp.verzoek','Betaalverzoek') + '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.3rem;"><span style="font-size:0.85rem;">' + escT(v.omschrijving || '') + '</span><b style="color:var(--rtg-leesgoud,var(--goud));white-space:nowrap;">' + eur2((v.bedrag||0)/100) + '</b></div>' +
          '<button class="mo-pay js-vzpay" data-vz="' + v.ref + '" style="width:100%;justify-content:center;margin-top:0.5rem;padding:0.6rem;">' + FID_MINI + T('dp.betaalverzoek','Betaal dit verzoek') + '</button></div>').join('') + '</div>' : '') +
        (items.length
          ? items.map(it =>
            '<div style="border:1px solid var(--line);border-radius:0;padding:0.7rem 0.9rem;margin-top:0.7rem;">' +
            '<div style="font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--rtg-leesgoud,var(--goud));">' + (it.soort === 'folder' ? '' + T('sal.folder','Folder') : it.soort === 'deal' ? '' + T('sal.deal','Aanbieding') : it.soort === 'poll' ? 'Poll' : '' + T('sal.bericht','Bericht')) + '</div>' +
            (it.folder ? '<div style="font-weight:600;margin-top:0.2rem;">' + escT(it.folder.titel) + '</div>' +
              ((it.folder.fotos && it.folder.fotos.length) ? '<div style="display:flex;gap:0.4rem;overflow-x:auto;margin-top:0.45rem;">' + it.folder.fotos.map(f => '<img src="' + f + '" alt="" style="height:90px;border-radius:0;flex-shrink:0;">').join('') + '</div>' : '') +
              ((it.folder.items && it.folder.items.length) ? '<div style="margin-top:0.45rem;display:grid;gap:0.2rem;">' + it.folder.items.map(x => '<div style="display:flex;justify-content:space-between;font-size:0.8rem;"><span>' + escT(x.naam) + '</span>' + (x.prijs != null ? '<span class="h-leesgoud">' + eur2(x.prijs) + '</span>' : '') + '</div>').join('') + '</div>' : '')
              : (it.deal ? '<div style="font-weight:600;margin-top:0.2rem;">' + escT(it.deal.titel) + (it.deal.mijnCode ? ' · <span class="h-leesgoud">' + it.deal.mijnCode + '</span>' : '') + '</div>'
              : '<div style="font-size:0.85rem;margin-top:0.2rem;">' + escT(it.text || '') + '</div>')) +
            '</div>').join('')
          : '<div style="text-align:center;color:var(--soft);font-size:0.82rem;padding:1.4rem 0;">' + T('sal.etaleeg','Nog geen folders of aanbiedingen.') + '</div>') +
      '</div></div>';
    ov.innerHTML = html;
    ov.querySelector('#etaClose').addEventListener('click', () => ov.remove());
    ov.querySelector('#etaVolg').addEventListener('click', async () => {
      try { await API.call('/salon/volg', { code }); await refreshState(); renderSalon(); openEtalage(code); } catch(e){ toast(e.message); }
    });
    const eb = ov.querySelector('#etaBetaal');
    if (eb) eb.addEventListener('click', () => { ov.remove(); betaalPartner(code, p.name, { bron: 'salon' }); });
    ov.querySelectorAll('.js-vzpay').forEach(b => b.addEventListener('click', () => {
      const v = vz.find(x => x.ref === b.dataset.vz); if (!v) return;
      ov.remove(); betaalVerzoekPay(v);
    }));
  }

  function renderSalon(){
    const isGuest = user && user.tier === 'guest';
    // RTG Zakelijk: de ingang staat aan voor de Lifestyle en Business Pass
    const zakL = $('#zakLauncher');
/* de zakelijke lade voor Business en Lifestyle */
    if (user && (user.tier === 'business' || user.tier === 'lifestyle')){
      zakL.style.display = 'block';
      zakL.innerHTML = '<button id="zakOpenBtn" style="display:flex;align-items:center;gap:0.7rem;width:100%;text-align:left;background:none;border:1px solid var(--gold);border-radius:0;padding:0.75rem 1rem;margin-bottom:0.8rem;color:var(--txt);font-family:inherit;cursor:pointer;">' +
        '<span style="font-size:1.2rem;"></span><span class="h-flex1"><b style="font-size:0.85rem;">' + T('zak.h','RTG Zakelijk') + '</b>' +
        '<span style="display:block;font-size:0.68rem;color:var(--muted);">' + T('zak.launch','Uw professionele netwerk: profiel, gids, feed en aanbevelingen.') + '</span></span>' +
        '<span style="color:var(--rtg-leesgoud,var(--gold));">›</span></button>';
      $('#zakOpenBtn').addEventListener('click', zakOpen);
    } else { zakL.style.display = 'none'; }
    $('#feed').innerHTML = posts.map(p => {
      const engage = canEngage(p);
      // gratis gebruikers (zonder pas) liken/reageren niet bij particulieren
      const mayLike = !(isGuest && !p.partner);
      // waarom staat dit bericht in De Salon? Vreemden zien alleen wat viraal
      // gaat of maatschappelijk belangrijk is; van een vriend of iemand die je
      // volgt zie je het sowieso. Een klein, ingetogen chipje maakt de reden
      // zichtbaar (partner-etalage en uitgelichte posts dragen geen chip).
      const REDEN_LABEL = {
        vriend: T('sal.reden.vriend', 'Vriend'),
        volgend: T('sal.reden.volgend', 'Je volgt'),
        belangrijk: T('sal.reden.belangrijk', 'Belangrijk'),
        viraal: T('sal.reden.viraal', 'Trending')
      };
      const redenChip = (p.reden && REDEN_LABEL[p.reden])
        ? '<span class="salon-reden salon-reden-' + p.reden + '">' + REDEN_LABEL[p.reden] + '</span>'
        : '';
      const visual = p.photo
        ? '<div class="visual"><img src="' + p.photo + '" alt="">' + redenChip + '<span class="place">' + escT(p.place) + '</span></div>'
        : '<div class="visual ' + (p.visual || 'v-partner') + '">' + redenChip + '<span class="place">' + escT(p.place) + '</span></div>';
      // partners posten zonder wachttijd: hun bericht staat er direct, met
      // tijdstempel; de 7-dagen-privacyregel geldt alleen voor ledenposts
      const meta = p.partner
        ? TIER_LABEL.partner + ' · ' + p.place + ' · ' + (p.at ? timeAgo(p.at) : T('app.salon.direct','direct geplaatst'))
        : TIER_LABEL[p.tier] + ' · ' + p.place + ' · ' + T('app.salon.7days','7 dagen na verblijf');
      // bedrijfslaag: volg-knop, exclusieve aanbieding en poll
      const volg = p.partnerCode
        ? '<button class="js-volg" data-code="' + p.partnerCode + '" style="margin-left:auto;background:' + (p.volgIk ? 'var(--gold)' : 'none') + ';color:' + (p.volgIk ? '#000' : 'var(--gold)') + ';border:1px solid var(--gold);border-radius:0;padding:0.25rem 0.75rem;font-size:0.66rem;font-weight:600;font-family:inherit;flex-shrink:0;cursor:pointer;">' + (p.volgIk ? '✓ ' + T('sal.volgt','Volgt') : '+ ' + T('sal.volg','Volg')) + '</button>'
        : '';
      const deal = p.deal
        ? '<div style="margin:0.6rem 1.1rem 0;border:1px solid var(--gold);border-radius:0;padding:0.7rem 0.9rem;">' +
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--rtg-leesgoud,var(--gold));">' + T('sal.deal','Exclusief voor leden') + (p.deal.geldigTot ? ' · t/m ' + p.deal.geldigTot : '') + '</div>' +
          '<div style="font-weight:600;font-size:0.9rem;margin-top:0.25rem;">' + p.deal.titel + '</div>' +
          (p.deal.mijnCode
            ? '<div style="margin-top:0.45rem;font-size:0.8rem;color:var(--rtg-leesgoud,var(--gold));letter-spacing:0.08em;">' + T('sal.uwcode','Uw code') + ': <b>' + p.deal.mijnCode + '</b> <span style="color:var(--soft);font-size:0.68rem;">· ' + T('sal.toon','toon aan de kassa') + '</span></div>'
            : '<button class="js-claim" style="margin-top:0.5rem;background:var(--knop);color:var(--knop-txt);border:none;border-radius:0;padding:0.45rem 0.95rem;font-size:0.72rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('sal.claim','Claim deze aanbieding') + '</button>') +
          '<div style="margin-top:0.35rem;font-size:0.62rem;color:var(--soft);">' + p.deal.claims + ' ' + T('sal.geclaimd','keer geclaimd') + '</div></div>'
        : '';
      const poll = p.poll
        ? '<div style="margin:0.6rem 1.1rem 0;border:1px solid var(--line);border-radius:0;padding:0.7rem 0.9rem;">' +
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--rtg-leesgoud,var(--gold));">' + T('sal.poll','Poll') + ' · ' + p.poll.totaal + ' ' + T('sal.stemmen','stem(men)') + '</div>' +
          p.poll.opties.map((o, i) => {
            const pct = p.poll.totaal ? Math.round(o.stemmen / p.poll.totaal * 100) : 0;
            return p.poll.gestemd
              ? '<div class="h-mt45"><div style="display:flex;justify-content:space-between;font-size:0.76rem;"><span>' + (o.mijn ? '✓ ' : '') + o.tekst + '</span><span style="color:var(--soft);">' + pct + '%</span></div>' +
                '<div style="height:4px;border-radius:0;background:rgba(255,255,255,0.08);margin-top:0.25rem;overflow:hidden;"><i style="display:block;height:100%;width:' + pct + '%;background:' + (o.mijn ? 'var(--gold)' : 'var(--soft)') + ';border-radius:0;"></i></div></div>'
              : '<button class="js-stem" data-optie="' + i + '" style="display:block;width:100%;margin-top:0.45rem;background:none;border:1px solid var(--line);border-radius:0;padding:0.5rem 0.7rem;color:var(--txt);font-size:0.78rem;font-family:inherit;text-align:left;cursor:pointer;">' + o.tekst + '</button>';
          }).join('') + '</div>'
        : '';
      const folder = p.folder
        ? '<div style="margin:0.6rem 1.1rem 0;border:1px solid var(--line);border-radius:0;padding:0.7rem 0.9rem;">' +
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--rtg-leesgoud,var(--gold));">' + T('sal.folder','Folder') + '</div>' +
          '<div style="font-weight:600;font-size:0.9rem;margin-top:0.25rem;">' + escT(p.folder.titel) + '</div>' +
          ((p.folder.fotos && p.folder.fotos.length) ? '<div style="display:flex;gap:0.4rem;overflow-x:auto;margin-top:0.5rem;">' + p.folder.fotos.map(f => '<img src="' + f + '" alt="" style="height:96px;border-radius:0;flex-shrink:0;">').join('') + '</div>' : '') +
          ((p.folder.items && p.folder.items.length) ? '<div style="margin-top:0.5rem;display:grid;gap:0.2rem;">' + p.folder.items.slice(0, 12).map(it => '<div style="display:flex;justify-content:space-between;font-size:0.8rem;"><span>' + escT(it.naam) + (it.tekst ? ' <span style="color:var(--soft);">· ' + escT(it.tekst) + '</span>' : '') + '</span>' + (it.prijs != null ? '<span style="color:var(--rtg-leesgoud,var(--gold));white-space:nowrap;">' + eur(it.prijs) + '</span>' : '') + '</div>').join('') + '</div>' : '') +
          '</div>'
        : '';
      const etalageBtn = p.partnerCode
        ? '<button class="pa js-etalage" data-code="' + p.partnerCode + '" title="' + T('sal.etalage','Etalage') + '">' + T('sal.etalage','Etalage') + '</button>'
        : '';
      return '<article class="post" data-post="' + p.id + '">' +
        '<div class="head">' +
          '<div class="avatar a-' + p.tier + '">' + escT((p.author || ' ')[0]) + '</div>' +
          '<div><b>' + escT(p.author) + (p.partner ? '<span class="partner-badge">' + T('app.partner','Partner') + '</span>' : '') + '</b><span>' + escT(meta) + (p.partnerCode && p.volgers != null ? ' · ' + p.volgers + ' ' + T('sal.volgers','volgers') : '') + '</span></div>' +
          volg +
        '</div>' +
        visual +
        '<div class="body">' + msgHTML(p.text, p.lang) + '</div>' +
        folder + deal + poll +
        '<div class="acts">' +
          '<button class="pa js-like' + (p.liked ? ' liked' : '') + '"' + (mayLike ? '' : ' disabled') + '>' + RTGGlyf.svgHTML('hart', p.liked ? { fill: true } : {}) + ' <span class="lc">' + p.likes + '</span></button>' +
          '<button class="pa js-comm"' + (engage ? '' : ' disabled') + '>' + T('app.salon.comment','Reageren') + ' (' + p.comments.length + ')</button>' +
          etalageBtn +
          '<button class="pa js-share" title="' + T('sal.deel','Delen met een connectie') + '">↗</button>' +
        '</div>' +
        '<div class="comments">' +
          '<div class="clist">' + p.comments.map(c => '<div class="comment"><b>' + escT(c.who) + '</b>, ' + msgHTML(c.text, c.lang) + '</div>').join('') + '</div>' +
          '<div class="cform"><input placeholder="' + T('app.salon.write','Schrijf een reactie…') + '"><button>' + T('app.salon.post','Plaats') + '</button></div>' +
        '</div>' +
      '</article>';
    }).join('');
    hydrateMsgs($('#feed'));

/* de knoppen onder een Salon-bericht */
    document.querySelectorAll('.post').forEach(el => {
      const post = posts.find(p => p.id === Number(el.dataset.post));
      el.querySelector('.js-like').addEventListener('click', ev => {
        // zonder pas kun je berichten van leden wel zien, maar niet liken
        if (user && user.tier === 'guest' && !post.partner){ toast(T('sal.guestlike','Zonder pas bekijk je de Salon; liken en reageren bij leden is voor leden.')); return; }
        post.liked = !post.liked;
        post.likes += post.liked ? 1 : -1;
        ev.currentTarget.classList.toggle('liked', post.liked);
        el.querySelector('.lc').textContent = post.likes;
        if (API.live) API.call('/like', {postId: post.id, liked: post.liked}).catch(() => {});
      });
      const shareBtn = el.querySelector('.js-share');
      if (shareBtn) shareBtn.addEventListener('click', () => openShare(post.id));
      const volgBtn = el.querySelector('.js-volg');
      if (volgBtn) volgBtn.addEventListener('click', async () => {
        try {
          const d = await API.call('/salon/volg', { code: volgBtn.dataset.code });
          toast(d.volgIk ? '✦ ' + T('sal.volgok','U volgt') + ' ' + post.author + '.' : T('sal.ontvolgd','Niet meer gevolgd.'));
          await refreshState();
          renderSalon();
        } catch(e){ toast(e.message); }
      });
      const claimBtn = el.querySelector('.js-claim');
      if (claimBtn) claimBtn.addEventListener('click', async () => {
        try {
          const d = await API.call('/salon/deal/claim', { postId: post.id });
          toast('' + T('sal.claimok','Geclaimd. Uw code:') + ' ' + d.code);
          await refreshState();
          renderSalon();
        } catch(e){ toast(e.message); }
      });
      const etaBtn = el.querySelector('.js-etalage');
      if (etaBtn) etaBtn.addEventListener('click', () => openEtalage(etaBtn.dataset.code));
      el.querySelectorAll('.js-stem').forEach(sb => sb.addEventListener('click', async () => {
        try {
          await API.call('/salon/poll/stem', { postId: post.id, optie: Number(sb.dataset.optie) });
          await refreshState();
          renderSalon();
        } catch(e){ toast(e.message); }
      }));
      const commBtn = el.querySelector('.js-comm');
      commBtn.addEventListener('click', () => {
        if (commBtn.disabled) return;
        el.querySelector('.comments').classList.toggle('open');
      });
      el.querySelectorAll('.pa:disabled').forEach(b => {
        b.style.pointerEvents = 'auto';
        b.addEventListener('click', e => {
          e.preventDefault();
          toast(user.tier === 'rtg'
            ? T('app.salon.rtgnote','Met de RTG Pass reageert u met RTG-leden, of met wie u eerst aanspreekt.')
            : T('app.salon.nocomment','Reageren is hier niet beschikbaar.'));
        });
      });
      el.querySelector('.cform button').addEventListener('click', async () => {
        const inp = el.querySelector('.cform input');
        if (!inp.value.trim()) return;
        if (API.live){
          try { await API.call('/comment', {postId: post.id, text: inp.value.trim()}); }
          catch (e) { toast(e.message || T('app.salon.notallowed','Reageren niet toegestaan.')); return; }
        }
        post.comments.push({who: user.full, tier: user.tier, text: inp.value.trim()});
        const d = document.createElement('div');
        d.className = 'comment';
        d.innerHTML = '<b>' + user.full + '</b>, ' + inp.value.trim().replace(/</g, '&lt;');
        el.querySelector('.clist').appendChild(d);
        inp.value = '';
        commBtn.textContent = T('app.salon.comment','Reageren') + ' (' + post.comments.length + ')';
        toast(T('app.salon.posted','Reactie geplaatst.'));
      });
    });
  }

  /* ================= Salon-ontmoetingen (wederzijdse connecties in de buurt) =
     Elk lid zet dit zelf aan/uit. Aan: de app stuurt af en toe de positie mee;
     een verbonden vriend die ook aanstaat en vlakbij is levert een voorstel op.
     Beiden kiezen een activiteit (of niets = afwijzen); bij een match tekenen ze
     een veiligheidscontract, waarna RTG-kantoor live meekijkt tot het klaar is.
     Bij een SOS gaat de camera aan en kijkt kantoor mee (WebRTC). */
  let ontmoetState = null, ontmoetTimer = null, ontmoetSosPc = null, ontmoetSosDate = null, ontmoetPending = null;

  async function laadOntmoet(){
    const el = $('#ontmoetPaneel'); if (!el) return;
    if (!API.live || !user || !user.account){ el.style.display = 'none'; stopOntmoetTimer(); return; }
    try { ontmoetState = await API.call('/ontmoeten/state'); }
    catch(e){ el.style.display = 'none'; return; }
    renderOntmoet();
    beheerOntmoetTimer();
  }
  function stopOntmoetTimer(){ if (ontmoetTimer){ clearInterval(ontmoetTimer); ontmoetTimer = null; } }
  // terwijl de functie aanstaat (of er een afspraak loopt) periodiek de positie sturen
  function beheerOntmoetTimer(){
    const s = ontmoetState;
    const loopt = s && (s.aan || (s.dates && s.dates.some(d => d.status === 'actief' || d.status === 'noodgeval')));
    if (loopt && !ontmoetTimer){ ontmoetTick(); ontmoetTimer = setInterval(ontmoetTick, 20000); }
    else if (!loopt) stopOntmoetTimer();
  }
  function ontmoetPositie(){
    return new Promise(res => {
      // De GPS-schakelaar in het OS-menu (rtg_os_gps, gezet in shared/osmenu)
      // wint van deze lus. Zonder deze poort vroeg de tick elke twintig
      // seconden om een positie -- op een toestel met toestemming op "vraag
      // elke keer" is dat een systeemprompt per tick, ook op het beginscherm,
      // terwijl de schakelaar in de app op "uit" stond. De server kan al
      // zonder positie (pos || {} hieronder), dus uit is gewoon: geen plek.
      try { if (localStorage.getItem('rtg_os_gps') !== '1') return res(null); } catch (e) {}
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { maximumAge: 15000, timeout: 8000 });
    });
  }
  async function ontmoetTick(){
    const s = ontmoetState; if (!s) return;
    const pos = await ontmoetPositie();
    try {
      if (s.aan){ const r = await API.call('/ontmoeten/hier', pos || {}); ontmoetState = r.state; renderOntmoet(); }
      // live-positie voor lopende afspraken naar kantoor
      for (const d of (ontmoetState.dates || [])) if (d.status === 'actief' || d.status === 'noodgeval'){
        try { await API.call('/ontmoeten/hier-date', { dateId: d.id, lat: pos ? pos.lat : undefined, lng: pos ? pos.lng : undefined }); } catch(e){}
      }
    } catch(e){}
  }

  function ontmoetActBtns(voorstelId){
    return (ontmoetState.activiteiten || []).map(a =>
      '<button class="js-oa" data-v="' + voorstelId + '" data-a="' + a.id + '" style="flex:1;min-width:5.5rem;background:none;border:1px solid var(--gold);border-radius:0;padding:0.6rem 0.4rem;color:var(--txt);font-family:inherit;cursor:pointer;text-align:center;">' +
      '<span style="font-size:1.3rem;display:block;">' +RTGGlyf.tekst(a.icon)+ '</span><b style="font-size:0.78rem;">' + escT(a.label) + '</b>' +
      '<span style="display:block;font-size:0.6rem;color:var(--muted);">' + escT(a.tekst) + '</span></button>').join('');
  }
  function renderOntmoet(){
    const el = $('#ontmoetPaneel'); const s = ontmoetState;
    if (!s){ el.style.display = 'none'; return; }
    el.style.display = 'block';
    const kaart = (inner) => '<div style="border:1px solid var(--line);border-radius:0;padding:0.9rem 1rem;margin-bottom:0.8rem;background:rgba(255,255,255,0.02);">' + inner + '</div>';
    let h = '';
    // kop met aan/uit
    const uit = !s.aan;
    h += '<div style="display:flex;align-items:flex-start;gap:0.7rem;">' +
      '<span style="font-size:1.3rem;"></span>' +
      '<div class="h-flex1"><b style="font-size:0.9rem;">' + T('ont.titel','Ontmoetingen') + '</b>' +
      '<span style="display:block;font-size:0.68rem;color:var(--muted);">' + T('ont.sub','Connecties die vlakbij zijn kunnen samen afspreken. Alleen jij bepaalt of dit aanstaat.') + '</span></div>' +
      (s.mag
        ? '<button id="ontToggle" role="switch" aria-checked="' + (s.aan ? 'true' : 'false') + '" style="flex-shrink:0;width:52px;height:30px;border-radius:0;border:1px solid var(--gold);background:' + (s.aan ? 'var(--gold)' : 'none') + ';position:relative;cursor:pointer;" aria-label="' + T('ont.toggle','Ontmoetingen aan of uit') + '"><span style="position:absolute;top:3px;left:' + (s.aan ? '25px' : '3px') + ';width:22px;height:22px;border-radius:50%;background:' + (s.aan ? '#000' : 'var(--gold)') + ';transition:left .15s;"></span></button>'
        : '') +
      '</div>';
    if (!s.mag){
      h += '<div style="margin-top:0.5rem;font-size:0.72rem;color:var(--soft);border-top:1px solid var(--line);padding-top:0.6rem;">' + escT(s.reden || T('ont.magniet','Nog niet beschikbaar.')) + '</div>';
      el.innerHTML = kaart(h);
      bindOntmoet();
      return;
    }
    if (uit){
      el.innerHTML = kaart(h);
      bindOntmoet();
      return;
    }
    // lopende afspraken (tekenen / actief / noodgeval)
    let blokken = '';
/* de afspraken en hun status */
    for (const d of (s.dates || [])){
      const metNaam = escT(d.met);
      if (d.status === 'wacht-op-tekenen'){
        blokken += '<div style="margin-top:0.75rem;border-top:1px solid var(--line);padding-top:0.7rem;">' +
          '<b style="font-size:0.82rem;">' +RTGGlyf.tekst(d.icon)+ ' ' + escT(d.activiteitLabel) + ' ' + T('ont.met','met') + ' ' + metNaam + '</b>' +
          '<div style="font-size:0.66rem;color:var(--muted);margin:0.3rem 0;">' + T('ont.tekenuitleg','Teken het veiligheidscontract om te starten. RTG-kantoor kijkt dan mee voor jullie veiligheid.') + '</div>' +
          '<pre style="white-space:pre-wrap;font-family:inherit;font-size:0.64rem;color:var(--soft);background:rgba(0,0,0,0.15);border-radius:0;padding:0.6rem;max-height:8rem;overflow:auto;">' + escT(d.contract) + '</pre>' +
          '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;">' +
          (d.ikTekende
            ? '<span style="flex:1;font-size:0.72rem;color:var(--rtg-leesgoud,var(--gold));align-self:center;">✓ ' + T('ont.jijtekende','Jij tekende. ') + (d.anderTekende ? '' : T('ont.wachtander','Wachten op ') + metNaam) + '</span>'
            : '<button class="js-oteken" data-d="' + d.id + '" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:0;padding:0.55rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('ont.teken','Contract tekenen') + '</button>') +
          '<button class="js-ostop" data-d="' + d.id + '" style="background:none;border:1px solid var(--line);border-radius:0;padding:0.55rem 0.8rem;color:var(--soft);font-family:inherit;cursor:pointer;">' + T('ont.annuleer','Annuleren') + '</button>' +
          '</div></div>';
      } else if (d.status === 'actief' || d.status === 'noodgeval'){
        const nood = d.status === 'noodgeval';
        blokken += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.7rem;' + (nood ? 'background:rgba(220,40,40,0.08);border-radius:0;padding:0.7rem;' : '') + '">' +
          '<b style="font-size:0.82rem;">' +RTGGlyf.tekst(d.icon)+ ' ' + escT(d.activiteitLabel) + ' ' + T('ont.met','met') + ' ' + metNaam + '</b>' +
          '<div style="font-size:0.64rem;color:var(--muted);margin:0.25rem 0 0.5rem;">' + T('ont.kijktmee','RTG-kantoor kijkt live mee voor jullie veiligheid, tot jullie afronden.') + '</div>' +
          (nood ? '<div style="font-size:0.72rem;color:#ff8a8a;font-weight:600;margin-bottom:0.5rem;">' + T('ont.noodloopt','Noodsignaal actief. Kantoor kijkt mee via je camera.') + '</div>' : '') +
          '<div style="display:flex;gap:0.5rem;">' +
          '<button class="js-osos" data-d="' + d.id + '" style="flex:1;background:#c62828;color:#fff;border:none;border-radius:0;padding:0.6rem;font-weight:700;font-family:inherit;cursor:pointer;">' + T('ont.sos','SOS') + '</button>' +
          '<button class="js-ostop" data-d="' + d.id + '" style="background:none;border:1px solid var(--line);border-radius:0;padding:0.6rem 0.8rem;color:var(--soft);font-family:inherit;cursor:pointer;">' + T('ont.afronden','Afronden') + '</button>' +
          '</div></div>';
      }
    }
    // open voorstellen
    let voors = '';
    for (const v of (s.voorstellen || [])){
      const metNaam = escT(v.met);
      voors += '<div style="margin-top:0.75rem;border-top:1px solid var(--line);padding-top:0.7rem;">' +
        '<b style="font-size:0.82rem;">' + metNaam + ' ' + T('ont.indebuurt','is in de buurt') + '</b>';
      if (v.mijnKeuze){
        voors += '<div style="font-size:0.72rem;color:var(--rtg-leesgoud,var(--gold));margin-top:0.35rem;">✓ ' + T('ont.jijkoos','Jij koos') + ' ' + escT((s.activiteiten.find(a => a.id === v.mijnKeuze) || {}).label || v.mijnKeuze) + '. ' + T('ont.wachtkeuze','Wachten op de keuze van ') + metNaam + '.</div>';
      } else {
        voors += '<div style="font-size:0.66rem;color:var(--muted);margin:0.25rem 0;">' + T('ont.kiessamen','Kies samen. Niets doen betekent afwijzen.') + '</div>' +
          '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">' + ontmoetActBtns(v.id) + '</div>' +
          '<button class="js-oweiger" data-v="' + v.id + '" style="margin-top:0.5rem;background:none;border:none;color:var(--soft);font-size:0.68rem;font-family:inherit;cursor:pointer;text-decoration:underline;">' + T('ont.nietnu','Niet nu') + '</button>';
      }
      voors += '</div>';
    }
    if (!blokken && !voors) h += '<div style="margin-top:0.5rem;font-size:0.68rem;color:var(--muted);border-top:1px solid var(--line);padding-top:0.6rem;">' + T('ont.aanuitleg','Staat aan. Zodra een connectie vlakbij is, verschijnt hier een voorstel.') + '</div>';
    el.innerHTML = kaart(h + blokken + voors);
    bindOntmoet();
  }
  function bindOntmoet(){
    const el = $('#ontmoetPaneel');
    const tg = el.querySelector('#ontToggle');
    if (tg) tg.addEventListener('click', async () => {
      const aan = !(ontmoetState && ontmoetState.aan);
      try { const r = await API.call('/ontmoeten/aan', { aan }); ontmoetState = r.state; renderOntmoet(); beheerOntmoetTimer(); }
      catch(e){ toast(e.message); }
    });
    el.querySelectorAll('.js-oa').forEach(b => b.addEventListener('click', () => ontmoetKies(b.dataset.v, b.dataset.a)));
    el.querySelectorAll('.js-oweiger').forEach(b => b.addEventListener('click', () => ontmoetKies(b.dataset.v, 'afwijzen')));
    el.querySelectorAll('.js-oteken').forEach(b => b.addEventListener('click', () => ontmoetTeken(b.dataset.d)));
    el.querySelectorAll('.js-ostop').forEach(b => b.addEventListener('click', () => ontmoetStop(b.dataset.d)));
    el.querySelectorAll('.js-osos').forEach(b => b.addEventListener('click', () => ontmoetSos(b.dataset.d)));
  }
  async function ontmoetKies(voorstelId, keuze){
    try { const r = await API.call('/ontmoeten/kies', { voorstelId, keuze }); ontmoetState = r.state;
      if (r.status === 'gematcht') toast('' + T('ont.match','Match! Teken het contract om te starten.'));
      renderOntmoet();
    } catch(e){ toast(e.message); }
  }
  async function ontmoetTeken(dateId){
    if (!confirm(T('ont.tekenbevestig','Ik ben 18+ met een geverifieerd paspoort en ga akkoord met het veiligheidscontract: RTG-kantoor mag mijn live-locatie zien tot de afspraak klaar is, en bij SOS meekijken via de camera en 112 bellen.'))) return;
    try { const r = await API.call('/ontmoeten/teken', { dateId }); ontmoetState = r.state; renderOntmoet(); beheerOntmoetTimer();
      if (r.status === 'actief') toast('' + T('ont.gestart','Afspraak gestart. RTG kijkt mee voor jullie veiligheid.'));
    } catch(e){ toast(e.message); }
  }
  async function ontmoetStop(dateId){
    try { const r = await API.call('/ontmoeten/stop', { dateId }); ontmoetState = r.state; ontmoetSosStop(); renderOntmoet(); beheerOntmoetTimer(); }
    catch(e){ toast(e.message); }
  }
  async function ontmoetSos(dateId){
    const pos = await ontmoetPositie();
    try {
      await API.call('/ontmoeten/sos', { dateId, bericht: T('ont.sosbericht','Ik voel me niet veilig'), lat: pos ? pos.lat : undefined, lng: pos ? pos.lng : undefined });
      toast('' + T('ont.sosverstuurd','SOS verstuurd. RTG-kantoor is gewaarschuwd en kijkt mee.'));
      ontmoetSosLive(dateId);         // camera + microfoon naar kantoor
      try { window.location.href = 'tel:112'; } catch(e){}   // en direct de hulpdiensten
      await laadOntmoet();
    } catch(e){ toast(e.message); }
  }
  // WebRTC: stuur camera + microfoon naar RTG-kantoor (kantoor beantwoordt via SSE)
  async function ontmoetSosLive(dateId){
    if (ontmoetSosPc) return;
    try {
      await haalIce();
      const stream = await RTGMedia.camera({ achter: true, audio: true });
      const pc = new RTCPeerConnection({ iceServers: iceConfig || [{ urls: 'stun:stun.l.google.com:19302' }] });
      ontmoetSosPc = pc; ontmoetSosDate = dateId;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.onicecandidate = e => { if (e.candidate) API.call('/ontmoeten/signaal', { dateId, payload: { ice: e.candidate } }).catch(() => {}); };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await API.call('/ontmoeten/signaal', { dateId, payload: { sdp: pc.localDescription } });
    } catch(e){ /* camera geweigerd of niet beschikbaar: de SOS zelf is al binnen */ }
  }
  function ontmoetSosStop(){
    if (ontmoetSosPc){ try { ontmoetSosPc.getSenders().forEach(s => s.track && s.track.stop()); ontmoetSosPc.close(); } catch(e){} ontmoetSosPc = null; ontmoetSosDate = null; }
  }
  // antwoord van RTG-kantoor op ons SOS-beeld (WebRTC-signaal)
  async function opOntmoetSignaal(d){
    if (!ontmoetSosPc || !d || d.dateId !== ontmoetSosDate || !d.payload) return;
    try {
      if (d.payload.sdp) await ontmoetSosPc.setRemoteDescription(new RTCSessionDescription(d.payload.sdp));
      else if (d.payload.ice) await ontmoetSosPc.addIceCandidate(new RTCIceCandidate(d.payload.ice));
    } catch(e){}
  }

  /* ---------- taal gewijzigd: dynamische schermen opnieuw opbouwen ---------- */
  window.addEventListener('rtglang', async () => {
    if (!user) return;
    const active = (document.querySelector('.tabbar button.active') || {}).dataset;
/* van taal wisselen: alles opnieuw ophalen */
    const tab = active ? active.tab : 'home';
    // inhoud opnieuw ophalen in de nieuwe taal (facturen, reis, menu's)
    if (API.live){ try { applyState((await API.call('/state')).state); } catch (e) {} }
    renderAll();
    renderBell();
    openTab(tab);
  });

  /* ---------- PWA ---------- */

  /* WAAROM HIER NIETS EXTRA'S STAAT.

     Na de uitrol van 28 augustus 2026 zag de eigenaar nog de oude schil. Er
     stonden hier kort twee toevoegingen; allebei weer weg. Een reload() op
     controllerchange sloot de lade halverwege (grammatica.e2e.js liep in zijn
     tijdslimiet) -- een pagina die zichzelf onder je handen herlaadt is een
     echte bijwerking. En registration.update() voegt niets toe: sw.js komt met
     `cache-control: no-cache`, dus de browser hervalideert hem AL bij elke
     navigatie; de 24-uursregel geldt alleen voor een cachebare worker. Hij
     schaadde wel -- met die regel erin zakte de toegankelijkheidskeuring twee
     rondes op twee VERSCHILLENDE toetsen, terwijl die taak op andere takken 7
     van de 7 groen stond. Een extra netwerkronde in elk opstartpad verschuift
     precies zulke timing. */
  if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')){
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

  /* ---------- AVG: inzage en vergetelheid ---------- */
  /* MIJN KOPPELINGEN (RTG Link, LINK.md stap 6). Hij hoort in deze la en niet bij
     de contactpin: dit gaat niet over je adres maar over wat er met je codes is
     gebeurd -- naast inzage en vergetelheid, waar het thuishoort.

     Het scherm haalt zelf niets op en voert zelf niets uit: het krijgt `haal` en
     `doe` mee, want de weg naar de server is van de app (LAT.md regel 4). */
  const privKoppel = document.getElementById('privKoppel');
  if (privKoppel) privKoppel.addEventListener('click', () => {
    if (!API.live){ toast(T('app.priv.needlogin','Log eerst in.')); return; }
    if (!window.RTGKoppelingen){ toast(T('app.priv.koppelniet','Dit scherm is nog niet geladen.')); return; }
    RTGKoppelingen.toon(() => API.call('/link/koppelingen', {}), {
      doe: (weg, lijf) => API.call(String(weg).replace(/^\/api/, ''), lijf),
      melden: (m) => toast(m)
    });
  });

  const privExport = document.getElementById('privExport');
  if (privExport) privExport.addEventListener('click', async () => {
    if (!API.live){ toast(T('app.priv.needlogin','Log eerst in.')); return; }
    try {
      const data = await API.call('/privacy/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'rtg-mijn-gegevens.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(T('app.priv.exported','Uw gegevens zijn gedownload als JSON.'));
    } catch(e){ toast(e.message); }
  });
  const privDelete = document.getElementById('privDelete');
  if (privDelete) privDelete.addEventListener('click', async () => {
    if (!API.live){ toast(T('app.priv.needlogin','Log eerst in.')); return; }
    if (!confirm(T('app.priv.confirm','Weet u het zeker? Dit wist uw cv, chats, likes en locatie definitief en logt u overal uit.'))) return;
    try {
      await API.call('/privacy/delete');
      try { localStorage.removeItem('rtg_member_token'); } catch(e2){}
      location.reload();
    } catch(e){ toast(e.message); }
  });

  // In Magnaat start de echte OS-schil direct op een synthetische Business
  // persona. Normaal blijft de bestaande sessieherstelroute ongewijzigd.
  if (magnaatProef) login(vastePas === 'lifestyle' ? 'lifestyle' : vastePas === 'rtg' ? 'rtg' : 'business');
  else restoreSession();

  /* ---- HET VAKBEWIJS: de stukken die bij je WERK horen ----

     WAAROM DIT SCHERM ER MOEST KOMEN. server/kern/persoonseis.js houdt personeel
     in een kinderopvang, een praktijk, een beveiligingsteam of een korps tegen
     tot hun stuk is gezien. Zonder deze plek kon je dat stuk nergens indienen --
     en dan is de poort geen beveiliging maar een storing: je staat op het
     rooster en komt er niet in, zonder weg terug.

     WAAROM HET HIER STAAT EN NIET BIJ DE IDENTITEITSVERIFICATIE IN DEEL 41,
     waar het inhoudelijk hoort. De delen van app-main zijn op GROOTTE geknipt
     en niet op structuur: deel 41 eindigt midden in laadPaspoortInbox() en deel
     42 zet diezelfde functie voort. Een nieuw bestand ertussen belandt dus
     BINNEN die functie, en dan is laadVakbewijs() vanuit renderHome() niet te
     zien. Dat is precies wat er gebeurde -- de banner bleef leeg en renderHome
     brak stil af na de verificatiebanner, zonder dat er iets klaagde. Het einde
     van het laatste deel is de enige echte top-niveau grens in deze reeks.

     HIJ VERSCHIJNT ALLEEN ALS HIJ ERGENS OVER GAAT. Wie niet in zo'n genre
     werkt, ziet niets. Een banner die iedereen om papieren vraagt die 55 van de
     73 genres niet kennen, is ruis -- en door ruis leren mensen heen klikken.

     WAT ER NIET GEBEURT. Geen foto, geen scan, geen upload. Er wordt vastgelegd
     WELK stuk je hebt, met zijn nummer en tot wanneer het geldt; het document
     zelf blijft waar het hoort. Dezelfde regel die kern/gegevenspoort.js al
     trekt: geen tweede intake naast de eerste. */
  async function laadVakbewijs(){
    const el = document.getElementById('vakbewijsBanner');
    if (!el || !user || !user.account) return;
    let r = null;
    try { r = await API.call('/vakbewijs', {}); } catch(e){ return; }
    const eisen = r.eisen || [], mijn = r.vakbewijzen || [], soorten = r.soorten || {};

    /* Wat vraagt mijn werk, en wat heb ik daarvan? De handeling-eisen tellen
       mee: een arts die niet kan voorschrijven staat niet buiten de deur, maar
       hij hoort wel te weten waarom die knop niets doet. */
    const nodig = new Map();
    for (const e of eisen){
      for (const s of (e.werk || [])) nodig.set(s.id, { soort: s, waarvoor: 'werk' });
      for (const h of Object.values(e.handelingen || {}))
        for (const s of (h.nodig || [])) if (!nodig.has(s.id)) nodig.set(s.id, { soort: s, waarvoor: h.wat });
    }
    /* `identiteit` staat er niet bij: die loopt over de verificatie hierboven en
       heeft daar zijn eigen banner. Twee plekken die om hetzelfde vragen, laten
       een mens twee keer hetzelfde doen. */
    nodig.delete('identiteit');
    if (!nodig.size){ el.innerHTML = ''; return; }

    const stand = id => mijn.find(v => v.wat === id) || null;
    const regels = [...nodig.entries()].map(([id, n]) => {
      const v = stand(id), naam = (soorten[id] && soorten[id].naam) || id;
      let stateTekst, klasse;
      if (!v){ stateTekst = T('vak.geen','nog niet ingediend'); klasse = 'open'; }
      else if (v.ingetrokken){ stateTekst = T('vak.in','ingetrokken'); klasse = 'open'; }
      else if (v.verlopen){ stateTekst = T('vak.verlopen','verlopen op')+' '+esc(v.tot || ''); klasse = 'open'; }
      else if (!v.gezien){ stateTekst = T('vak.wacht','ingediend, RTG kijkt ernaar'); klasse = 'pending'; }
      else { stateTekst = T('vak.ok','gezien en afgetekend') + (v.tot ? ' · '+T('vak.tot','geldig tot')+' '+esc(v.tot) : ''); klasse = 'ok'; }
      return '<div class="vakrij" data-soort="'+esc(id)+'">' +
        '<div><b>'+esc(naam)+'</b> <span class="vaksub">'+esc(n.waarvoor === 'werk'
          ? T('vak.voorwerk','nodig om hier te werken')
          : T('vak.voor','nodig om ')+esc(n.waarvoor))+'</span>' +
        '<div class="vaksub vak-'+klasse+'">'+stateTekst+'</div>' +
        /* Je EIGEN nummer, gewoon zichtbaar. Dat is zelf-inzage en geen inzage
           in andermans gegevens; het journaal slaat die om dezelfde reden over.
           Wie zijn eigen stuk niet kan terugzien, kan ook niet nakijken of hij
           het goed heeft ingevoerd -- en dat is precies wat je wilt dat iemand
           doet voordat RTG ernaar kijkt. */
        (v && v.nummer ? '<div class="vaksub">'+esc(v.nummer)+'</div>' : '') + '</div>' +
        (klasse === 'ok' ? '' : '<button class="vbtn" data-vak="'+esc(id)+'">' +
          (v ? T('vak.opnieuw','Opnieuw indienen') : T('vak.indienen','Indienen')) + '</button>') +
        '</div>';
    }).join('');

    el.innerHTML = '<div class="vbanner"><b>'+T('vak.h','Papieren voor uw werk')+'</b>' +
      '<span>'+T('vak.b','Uw werk vraagt om een stuk op uw eigen naam. U legt hier vast welk stuk dat is en tot wanneer het geldt; een medewerker van RTG tekent af dat hij het heeft gezien. RTG beoordeelt de inhoud niet en uw werkgever ziet alleen of het rond is.')+'</span>' +
      regels + '</div>';
    el.querySelectorAll('[data-vak]').forEach(b =>
      b.addEventListener('click', () => vakIndienen(b.dataset.vak, (soorten[b.dataset.vak] || {}))));
  }

  /* Indienen. Drie vragen, want dat is precies wat de server bewaart: welk stuk,
     welk nummer, tot wanneer. Het uitleg-zinnetje van het register komt mee, dus
     de vraag heet bij de naam die de mens zelf kent ("uw BIG-nummer"). */
  async function vakIndienen(soort, def){
    const nummer = prompt((def.uitleg || T('vak.watnr','Wat is het nummer van dit stuk?')) + '\n\n' +
      T('vak.nr','Nummer:'));
    if (nummer === null) return;
    if (!nummer.trim()){ toast(T('vak.nrnodig','Zonder nummer kan RTG het stuk niet terugvinden.')); return; }
    const tot = prompt(T('vak.totvraag','Tot wanneer is het geldig? (jjjj-mm-dd; leeg laten mag als er geen einddatum op staat)'), '');
    if (tot === null) return;
    if (tot.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(tot.trim())){
      toast(T('vak.datumfout','Een datum ziet eruit als 2030-01-31.')); return;
    }
    try {
      const r = await API.call('/vakbewijs/zet', { wat: soort, nummer: nummer.trim(), tot: tot.trim() || null });
      toast(r.uitleg || T('vak.ontvangen','Vastgelegd.'));
    } catch(e){ toast(e.message); return; }
    laadVakbewijs();
  }
})();
