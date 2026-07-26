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
  function showGateForm(which){
    ['#loginForm','#regForm','#forgotForm','#resetForm'].forEach(sel => { const f=$(sel); if(f) f.style.display='none'; });
    const map = { login:'#loginForm', register:'#regForm', forgot:'#forgotForm', reset:'#resetForm' };
    const f = $(map[which]); if (f) f.style.display = 'flex';
    if (toReg) toReg.style.display = which==='login' ? '' : 'none';
    if (toForgot) toForgot.style.display = which==='login' ? '' : 'none';
    if (toLogin) toLogin.style.display = which==='login' ? 'none' : '';
  }
  if (toReg) toReg.addEventListener('click', () => { regTier = 'rtg'; showGateForm('register'); updateRegKop(); });
  if (toForgot) toForgot.addEventListener('click', () => showGateForm('forgot'));
  if (toLogin) toLogin.addEventListener('click', () => showGateForm('login'));
  const forgotForm = document.getElementById('forgotForm');
  if (forgotForm) forgotForm.addEventListener('submit', async e => {
    e.preventDefault();
    try { await API.call('/auth/forgot', { email: $('#fgEmail').value }); }
    catch (e2){ /* stil, geen bestaan lekken */ }
    toast(T('gate.forgotsent','Als dit e-mailadres bekend is, sturen we een herstel-link.'));
    showGateForm('login');
  });
  // wachtwoord-herstel: de link uit de e-mail komt hier binnen (?reset=)
  let resetToken = null;
  const resetForm = document.getElementById('resetForm');
  if (resetForm) resetForm.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await API.call('/auth/reset', { token: resetToken, code: $('#rsCode').value, password: $('#rsPass').value });
      toast(T('gate.resetok','Wachtwoord aangepast. Log in met uw nieuwe wachtwoord.'));
      showGateForm('login');
    } catch (e2){ toast(e2.message || 'Herstel mislukt.'); }
  });
  // bevestigings- en herstel-links uit de e-mail afhandelen (voorheen het
  // aparte ledenportaal; het grote scherm zit nu gewoon in de pas-apps zelf)
  (function handleAuthLinks(){
    const q = new URLSearchParams(location.search);
    if (q.get('verify')){
      API.call('/auth/verify-email', { token: q.get('verify') })
        .then(() => toast(T('gate.verified','Uw e-mailadres is bevestigd.')))
        .catch(() => toast(T('gate.verifyfail','Bevestigingslink ongeldig of verlopen.')))
        .finally(() => history.replaceState(null, '', location.pathname + (vastePas ? '?pas=' + vastePas : '')));
    }
    if (q.get('reset')){ resetToken = q.get('reset'); showGateForm('reset'); }
  })();

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
            location.replace(location.pathname + '?pas=' + doelPas);
            return;
          }
        } catch (e) { toast(e.message || 'Onjuiste inloggegevens.'); return; }
      } else {
        if (!(String(cred.u).trim().toLowerCase() === 'rahul' && cred.p === 'Imran')){
          toast('Onjuiste inloggegevens.'); return;
        }
        tier = 'business'; user = {...PERSONAS[tier]};
      }
    } else {
      user = {...PERSONAS[tier]};
      if (API.enabled){
        try {
          const data = await API.call('/login', {tier, pasApp: vastePas || undefined});
          API.token = data.token;
          applyState(data.state);
        } catch (e) { API.enabled = false; }
      }
    }
    if (!API.live) creatorLikes = ({rtg:320, lifestyle:680, business:210})[tier] || 0;
    if (API.live) try { localStorage.setItem('rtg_member_token', API.token); } catch(e){}
    $('#gate').style.display = 'none';
    $('#app').classList.add('active');
    renderAll();
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
