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
        '<svg viewBox="0 0 24 24" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 11a2 2 0 0 0-2 2c0 2-.4 3.6-1 5"/><path d="M8 9a4 4 0 0 1 7 2c0 3-.5 5.4-1.5 7.5"/><path d="M12 13c0 3-.6 5.6-1.6 7.7"/><path d="M5.5 8a7 7 0 0 1 12 3c0 1"/></svg>' +
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
    const mctx = mond.getContext('2d');
    const RUSTIG = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const PUNTEN = [];
    (function zaai(){
      // de lipvormen als functies: de middellijn met cupidoboog, de boog van
      // de bovenlip en de boog van de onderlip (mondhoeken op x=50 en x=170)
      const midden = x => 52 - 6 * Math.exp(-Math.pow(x - 110, 2) / 98);
      const boven = x => { const t = (x - 110) / 60; return 52 - 24 * Math.pow(Math.max(0, 1 - t * t), 0.8) + 7 * Math.exp(-Math.pow(x - 110, 2) / 72); };
      const onder = x => { const t = (x - 110) / 60; return 52 + 27 * Math.pow(Math.max(0, 1 - t * t), 0.9); };
      for (let i = 0; i < 2400; i++){
        const lip = Math.random() < 0.45 ? 'b' : 'o';
        const x = 50 + Math.random() * 120;
        const y1 = lip === 'b' ? boven(x) : midden(x), y2 = lip === 'b' ? midden(x) : onder(x);
        if (y2 - y1 < 0.8) continue;
        const r = Math.random();
        PUNTEN.push({ x, y: y1 + Math.random() * (y2 - y1), lip,
          fase: Math.random() * Math.PI * 2, maat: 0.5 + Math.random() * 0.9,
          kleur: r < 0.62 ? '#9E1C40' : (r < 0.9 ? '#C9A24B' : '#FFFFFF'),
          diep: (y2 - y1) > 0 ? ((y1 + (y2 - y1) / 2) - y1) / (y2 - y1) : 0 });
      }
      // de gouden middellijn loopt door tot voorbij de mondhoeken en vervaagt
      for (let i = 0; i < 420; i++){
        const x = 14 + Math.random() * 192;
        PUNTEN.push({ x, y: midden(Math.min(170, Math.max(50, x))) + (Math.random() - 0.5) * 1.6,
          lip: 'm', fase: Math.random() * Math.PI * 2, maat: 0.4 + Math.random() * 0.7,
          kleur: '#C9A24B', rand: Math.min(1, Math.min(x - 14, 206 - x) / 55), diep: 0 });
      }
    })();
    let praatTot = 0;
    const praat = ms => { praatTot = performance.now() + ms; };
    function verfMond(t){
      mctx.clearRect(0, 0, 440, 200);
      mctx.save();
      mctx.scale(2, 2);
      const golf = ((t / 4200) % 1) * 260 - 20; // de lichtshow: een gouden golf
      const spreek = t < praatTot ? Math.sin(t / 1000 * Math.PI * 4.4) : 0;
      for (const p of PUNTEN){
        const gloed = Math.exp(-Math.pow(p.x - golf, 2) / 420);
        const twinkel = 0.45 + 0.4 * Math.sin(p.fase + t / 700);
        mctx.globalAlpha = Math.min(1, twinkel * (p.rand == null ? 1 : p.rand) + gloed * 0.9);
        mctx.fillStyle = gloed > 0.45 ? '#F5E6B8' : p.kleur;
        mctx.fillRect(p.x, p.lip === 'o' ? p.y + spreek * 4 * p.diep : p.y, p.maat, p.maat);
      }
      mctx.restore();
    }
    if (RUSTIG) verfMond(0);
    else (function lus(){
      // alleen verven zolang de poort in beeld is; daarna zuinig wachten
      if (mond.offsetParent) { verfMond(performance.now()); requestAnimationFrame(lus); }
      else setTimeout(lus, 600);
    })();

    // een zin, geen logboek: Rahuls woorden vervangen elkaar rustig
    function zeg(wie, tekst){
      if (wie !== 'rahul') return;
      // Rahul typt zijn zin letter voor letter en de mond beweegt mee
      if (window.RTGTyp){ RTGTyp.schrijf(zin, tekst, { praat: praat }); return; }
      zin.style.animation = 'none';
      void zin.offsetWidth; // de fade opnieuw laten lopen
      zin.style.animation = '';
      zin.textContent = tekst;
      praat(Math.min(2600, 500 + tekst.length * 28));
    }
    const pkKnop = doos.querySelector('#agPasskey');
    function toonPasskey(aan){
      if (!pkKnop) return;
      pkKnop.hidden = !aan;
      // het label pas hier vertalen: bij het bouwen van de poort is de i18n
      // soms nog niet geladen
      if (aan){ const s = pkKnop.querySelector('span'); if (s) s.textContent = T('ag.pk.knop','Face ID of passkey'); }
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

