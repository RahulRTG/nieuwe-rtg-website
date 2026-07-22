  /* De poort is van Rahul: inloggen EN aanmelden als een gesprek. Rahul
     ontdekt zelf of je terugkomt of nieuw bent, vraagt subtiel wat hij nodig
     heeft en legt op "waarom?" uit waarvoor iets dient. Beide paden eindigen
     op de bestaande routes: aanmelden via login() -> /auth/register, inloggen
     via login() -> /auth/login; het wachtwoord van een terugkerend lid gaat
     NOOIT door het gesprek maar rechtstreeks naar de inlogroute. Kaal en
     stil: alleen de klok, Rahuls zin en de ene regel van de gebruiker.
     Er is geen klassieke keuze: Rahul is de poort; de formulieren bestaan
     alleen nog als vangnet voor wachtwoord-herstel. Deelt de
     IIFE-scope met 00-kern-03.js (toReg, toForgot, login, API, T). */
  (function aanmeldGesprek(){
    const loginFormEl = document.getElementById('loginForm');
    const regForm = document.getElementById('regForm');
    if (!regForm || !loginFormEl || !API.enabled) return;
    const ouder = loginFormEl.parentNode;
    const st = document.createElement('style');
    st.textContent =
      // Rahul neemt de poort volledig over: geen formulieren en geen knoppen;
      // wachtwoord-herstel regelt Rahul in het gesprek zelf
      '.ag-over #loginForm,.ag-over #regForm,.ag-over #forgotForm,.ag-over #resetForm,.ag-over #toReg,.ag-over #toForgot,.ag-over #toLogin{display:none !important;}' +
      '.ag-doos{display:none;flex-direction:column;width:100%;}' +
      '.ag-over .ag-doos{display:flex;}' +
      // geen chatbubbels: alleen Rahuls zin, groot en stil in Bodoni, en
      // daaronder de ene regel van de gebruiker; verder niets
      ".ag-zin{font-family:'Bodoni Moda',serif;font-weight:400;font-size:1.12rem;line-height:1.65;color:var(--txt);" +
        'text-align:center;min-height:4.6rem;display:flex;align-items:center;justify-content:center;' +
        'padding:0.9rem 0.4rem 1.1rem;text-wrap:balance;animation:agZin 0.5s ease;}' +
      '@keyframes agZin{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}' +
      '.ag-rij{display:flex;align-items:center;border-bottom:1px solid var(--line);margin:0 0.6rem;transition:border-color 0.2s;}' +
      '.ag-rij:focus-within{border-color:var(--burgundy);}' +
      '.ag-rij input{flex:1;min-width:0;background:none;border:none;outline:none;color:var(--txt);' +
        "font-family:'Inter',sans-serif;font-size:0.95rem;text-align:center;padding:0.75rem 0.4rem;}" +
      '.ag-rij input::placeholder{color:var(--soft);}' +
      '.ag-rij button{background:none;border:none;cursor:pointer;color:var(--gold,#857007);font-size:1.15rem;' +
        'padding:0.4rem 0.2rem;opacity:0;transition:opacity 0.2s;font-family:inherit;}' +
      '.ag-rij:focus-within button,.ag-rij.vol button{opacity:0.85;}';
    document.head.appendChild(st);

    const doos = document.createElement('div');
    doos.className = 'ag-doos';
    doos.innerHTML =
      '<div class="ag-zin" id="agZin" role="status" aria-live="polite" aria-label="' + T('ag.log','Rahul') + '"></div>' +
      '<div class="ag-rij"><input id="agIn" autocomplete="off" aria-label="' + T('ag.in','Je antwoord aan Rahul') + '" placeholder="' + T('ag.plho','Zeg het gewoon...') + '">' +
      '<button type="button" id="agGo" aria-label="' + T('ag.stuur','Stuur') + '">&#8594;</button></div>';
    ouder.insertBefore(doos, loginFormEl);
    // een wachtwoord-herstel-link uit de e-mail heeft voorrang op het gesprek
    const herstel = new URLSearchParams(location.search).get('reset');
    if (!herstel) ouder.classList.add('ag-over');

    const zin = doos.querySelector('#agZin');
    const inp = doos.querySelector('#agIn');
    let gesprek = null, bezig = false, loginU = null;

    // een zin, geen logboek: Rahuls woorden vervangen elkaar rustig
    function zeg(wie, tekst){
      if (wie !== 'rahul') return;
      zin.style.animation = 'none';
      void zin.offsetWidth; // de fade opnieuw laten lopen
      zin.style.animation = '';
      zin.textContent = tekst;
    }
    function wachtwoordVeld(placeholder){
      inp.type = 'password';
      inp.placeholder = placeholder || T('ag.ww','Je wachtwoord');
    }
    function tekstVeld(){
      inp.type = 'text';
      inp.placeholder = T('ag.plho','Zeg het gewoon...');
    }
    async function start(){
      if (gesprek || bezig) return;
      bezig = true;
      try { const d = await API.call('/aanmeld/start', {}); gesprek = d.id; zeg('rahul', d.tekst); }
      catch(e){ zeg('rahul', T('ag.mis','Het gesprek wil even niet starten; de formulieren werken altijd.')); klassiek(); }
      bezig = false;
    }
    async function stuur(){
      const tekst = inp.value.trim();
      if (!tekst || bezig) return;
      inp.value = '';
      inp.closest('.ag-rij').classList.remove('vol');
      bezig = true;
      try {
        // "opnieuw" en "wachtwoord vergeten" zijn commando's voor het gesprek,
        // ook midden in het wachtwoordstadium; al het andere is daar een
        // wachtwoordpoging, rechtstreeks naar de ene inlogroute
        const commando = loginU && tekst.length <= 40 && /\b(opnieuw|vergeten)\b/i.test(tekst);
        if (loginU && !commando){
          try {
            await login('rtg', { u: loginU, p: tekst });
            zeg('rahul', T('ag.welkom','Daar ben je weer. Welkom terug.'));
          } catch(e){
            zeg('rahul', (e && e.message ? e.message + ' ' : '') + T('ag.wwmis','Probeer het nog eens, zeg "opnieuw", of zeg "wachtwoord vergeten" en dan regel ik een herstel-link.'));
          }
        } else {
          const d = await API.call('/aanmeld/zeg', { id: gesprek, tekst });
          zeg('rahul', d.tekst);
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
    // er is GEEN klassieke keuze meer: Rahul is de poort. De formulieren
    // bestaan alleen nog als vangnet: voor wachtwoord-herstel (de knop
    // hieronder en de e-maillink) en als het gesprek zelf niet kan starten.
    function klassiek(){
      ouder.classList.remove('ag-over');
    }
    doos.querySelector('#agGo').addEventListener('click', stuur);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); stuur(); } });
    inp.addEventListener('input', () => inp.closest('.ag-rij').classList.toggle('vol', !!inp.value.trim()));
    // het gesprek begint vanzelf zodra duidelijk is dat er geen sessie ligt
    let onthouden = null;
    try { onthouden = localStorage.getItem('rtg_member_token'); } catch(e){}
    if (!herstel && !onthouden) setTimeout(start, 400);
    inp.addEventListener('focus', start, { once: true });
  })();
