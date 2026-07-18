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
    API.token = t;
    try {
      applyState((await API.call('/state')).state);
      const doelPas = user.tier === 'guest' ? 'rtg' : user.tier;
      const magHier = vastePas ? (vastePas === 'rtg' ? ['rtg','guest'] : [vastePas]) : [];
      if (!magHier.includes(user.tier)){
        if (['rtg','lifestyle','business'].includes(doelPas)){ location.replace(location.pathname + '?pas=' + doelPas); return; }
        API.token = null; return; // onbekende pas: poort tonen
      }
      $('#gate').style.display = 'none';
      $('#app').classList.add('active');
      renderAll();
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
    location.reload();
  }

