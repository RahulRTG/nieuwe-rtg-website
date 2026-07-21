  /* ---------- stappen-gate: sector -> bedrijf -> wie -> pincode ----------
     De PDA staat vast op een bedrijf: na de eerste keuze onthoudt het apparaat
     het bedrijf en opent hij direct op het eigen team. Inloggen kan alleen wie
     door de werkgever is uitgenodigd en zich heeft aangemeld (dan sta je in het
     team), met de eigen pincode. */
  function pdaBedrijf(){
    try { const c = localStorage.getItem('rtg_pda_bedrijf'); return (c && BEDRIJVEN[c]) ? c : null; } catch(e){ return null; }
  }
  function stepStart(){
    // 1x aanmelden is de gewone ingang: log één keer in met uw eigen RTG-account
    // en u landt meteen op de juiste bedrijfspagina. Een vast apparaat in de zaak
    // (QR / ?bedrijf=CODE, of een onthouden bedrijf) houdt de naam-en-pincode-ingang.
    const qs = new URLSearchParams(location.search);
    if (qs.get('kantoor') != null){ stepKantoor(); return; }
    const qb = String(qs.get('bedrijf') || '').toUpperCase();
    if (qb && BEDRIJVEN[qb]){ stepWie(null, qb); return; }
    const vast = pdaBedrijf();
    if (vast) stepWie(null, vast);
    else stepLogin();
  }
  // de klok en de datum op het inlogscherm (de naam van de app staat in de badge)
  function gateTik(){ if (window.RTGKlok) RTGKlok.alles(); }
  // De hoofd-ingang: inloggen met het eigen RTG-account (e-mail/gebruikersnaam +
  // wachtwoord). Daaronder alleen aanmelden en wachtwoord vergeten; een vast
  // apparaat kan nog op naam met pincode.
  function stepLogin(){
    kantoorStop();
    $('#gateStep').innerHTML =
      '<form class="lform" id="loginForm" autocomplete="on">'+
        '<input id="liUser" type="text" autocomplete="username" placeholder="'+T('pd.li.user','E-mail of gebruikersnaam')+'" aria-label="'+T('pd.li.user','E-mail of gebruikersnaam')+'">'+
        '<input id="liPass" type="password" autocomplete="current-password" placeholder="'+T('pd.li.pass','Wachtwoord')+'" aria-label="'+T('pd.li.pass','Wachtwoord')+'">'+
        '<div class="err" id="liErr" role="alert"></div>'+
        '<button class="prim" type="submit">'+T('pd.login','Inloggen')+'</button>'+
      '</form>'+
      '<div class="llinks">'+
        '<button class="llink" id="toJoin" type="button">'+T('pd.aanmelden','Aanmelden bij een bedrijf')+'</button>'+
        '<button class="llink" id="toForgot" type="button">'+T('pd.forgot','Wachtwoord vergeten?')+'</button>'+
        '<button class="llink" id="toDevice" type="button">'+T('pd.ondevice','Vast apparaat? Inloggen met naam en pincode')+'</button>'+
      '</div>';
    $('#loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      $('#liErr').textContent = '';
      const btn = e.target.querySelector('button.prim'); btn.disabled = true;
      try { await mijnLogin($('#liUser').value.trim(), $('#liPass').value); }
      catch(err){ $('#liErr').textContent = err.message || T('pd.badlogin','Onjuiste inloggegevens.'); btn.disabled = false; }
    });
    $('#toJoin').addEventListener('click', stepAanmelden);
    $('#toForgot').addEventListener('click', stepForgot);
    $('#toDevice').addEventListener('click', stepSector);
    $('#liUser').focus();
  }
  // Aanmelden bij een bedrijf: bedrijfsnaam + kassacode (van de werkgever) +
  // het eigen RTG-account + een zelfgekozen pincode. Daarna landt u meteen.
