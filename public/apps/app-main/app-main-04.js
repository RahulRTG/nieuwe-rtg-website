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
      '.ag-rij:focus-within button,.ag-rij.vol button{opacity:0.85;}' +
      '.ag-mond{display:block;margin:0.15rem auto 0.3rem;width:220px;height:100px;}' +
      // Face ID / passkey: een ingetogen gouden regel onder het veld, alleen
      // zichtbaar zodra Rahul weet met wie hij praat (een terugkerend lid)
      '.ag-passkey{margin:0.95rem auto 0;background:none;border:none;color:var(--gold,#857007);' +
        'font-family:inherit;font-size:0.78rem;letter-spacing:0.03em;cursor:pointer;opacity:0.9;' +
        'display:flex;align-items:center;gap:0.4rem;}' +
      '.ag-passkey[hidden]{display:none;}' +
      '.ag-passkey svg{width:15px;height:15px;stroke:currentColor;fill:none;}' +
      // de sterrenhemel gaat achter alles; de poort-inhoud eroverheen
      '#gate > *:not(canvas){position:relative;z-index:1;}';
    document.head.appendChild(st);

    // een heel subtiele 3D-sterrenhemel over het hele inlogscherm, in RTG-stijl
    (function sterrenhemel(){
      var hang = function(){ if (window.RTGSterren) window.RTGSterren.hang(gate, { helderheid: 0.9 }); };
      if (window.RTGSterren) return hang();
      var s = document.createElement('script'); s.src = '/shared/sterren.js'; s.async = true;
      s.onload = hang; document.head.appendChild(s);
    })();

    const doos = document.createElement('div');
    doos.className = 'ag-doos';
    doos.innerHTML =
      '<canvas class="ag-mond" id="agMond" width="440" height="200" aria-hidden="true"></canvas>' +
      '<div class="ag-zin" id="agZin" role="status" aria-live="polite" aria-label="' + T('ag.log','Rahul') + '"></div>' +
      '<div class="ag-rij"><input id="agIn" autocomplete="off" data-i18n-ph="ag.plho" aria-label="' + T('ag.in','Je antwoord aan Rahul') + '" placeholder="' + T('ag.plho','Ik wil zeggen dat..') + '">' +
      '<button type="button" id="agGo" aria-label="' + T('ag.stuur','Stuur') + '">&#8594;</button></div>' +
      '<button type="button" class="ag-passkey" id="agPasskey" hidden>' +
        '<svg viewBox="0 0 24 24" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 11a2 2 0 0 0-2 2c0 2-.4 3.6-1 5"/><path d="M8 9a4 4 0 0 1 7 2c0 3-.5 5.4-1.5 7.5"/><path d="M12 13c0 3-.6 5.6-1.6 7.7"/><path d="M5.5 8a7 7 0 0 1 12 3c0 3.4-.5 6.4-1.5 9"/></svg>' +
        '<span>' + T('ag.pk.knop','Face ID of passkey') + '</span></button>';
    gate.appendChild(doos);
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
    const mondje = (window.RTGMond && mond) ? RTGMond.maak(mond) : { praat: function(){} };
    const praat = ms => mondje.praat(ms);
