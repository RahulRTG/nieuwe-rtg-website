/* Team access uses the same canvas and Edge as the member portal. Labels are
   translated in place: no rerender may erase credentials or repeat a request. */
  function teamText(key, source){
    return '<span data-i18n="'+esc(key)+'" data-i18n-source="'+esc(source)+'">'+esc(T(key, source))+'</span>';
  }
  function teamField(id, key, source, type, attributes){
    return '<label class="access-field" for="'+id+'">'+teamText(key, source)+
      '<input id="'+id+'" type="'+type+'" '+attributes+'></label>';
  }
  function teamBack(id){
    return '<button class="access-secondary access-back" id="'+id+'" type="button">'+teamText('pd.back','Terug')+'</button>';
  }
  function teamAccessView(view, key, title, descriptionKey, description){
    $('#gate').dataset.accessView = view;
    $('#teamAccessTitle').innerHTML = teamText(key, title);
    $('#teamAccessDescription').innerHTML = teamText(descriptionKey, description);
    $('#gate').scrollTop = 0;
  }
  /* De gewone accountinlog (met zijn tweede factor) en daarna de kantoordeur.
     Vraagt het account een tweede stap, dan loopt die via de leden-app: die
     stap nog eens nabouwen zou een tweede inlog met eigen regels zijn. */
  async function naarKantoorMetAccount(login, password){
    let d = {};
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login, password }) });
      d = await r.json().catch(() => ({}));
      if (!r.ok) return false;
    } catch(e){ return false; }
    if (!d.token) {
      $('#liErr').textContent = T('pd.ka.tweede','Uw account heeft toegang tot RTG Kantoor en vraagt een tweede stap. Log in via de leden-app en open daar Mijn werkplekken, Backoffice.');
      return true;
    }
    try { localStorage.setItem('rtg_member_token', d.token); } catch(e){}
    stepKantoor();
    await kantoorMetAccount(d.token);
    return true;
  }
  function formulierLogin(){
    $('#gateStep').innerHTML =
      '<form class="lform" id="loginForm" autocomplete="on">'+
        teamField('liUser', 'pd.li.user', 'E-mail of gebruikersnaam', 'text', 'autocomplete="username" autocapitalize="none" spellcheck="false" required')+
        teamField('liPass', 'pd.li.pass', 'Wachtwoord', 'password', 'autocomplete="current-password" required')+
        '<div class="access-error" id="liErr" role="alert" data-i18n-ignore></div>'+
        '<button class="access-primary" type="submit">'+teamText('pd.access.logingo','Ga verder naar mijn werkplek.')+'</button>'+
      '</form><div class="llinks">'+
        '<button class="access-link" id="toJoin" type="button">'+teamText('pd.access.joinlink','Ik wil mij aanmelden bij een bedrijf.')+'</button>'+
        '<button class="access-link" id="toForgot" type="button">'+teamText('pd.access.forgotlink','Ik ben mijn wachtwoord vergeten.')+'</button>'+
        '<button class="access-link" id="toDevice" type="button">'+teamText('pd.access.devicelink','Ik gebruik een apparaat op mijn werkplek.')+'</button>'+
      '</div>';
    $('#loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      $('#liErr').textContent = '';
      const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true;
      try { await mijnLogin($('#liUser').value.trim(), $('#liPass').value); }
      catch(err){
        btn.disabled = false;
        // geen zaak, wel kantoor: zelfde account, andere deur (pda/posities.js)
        if (err.data && err.data.kantoor && await naarKantoorMetAccount($('#liUser').value.trim(), $('#liPass').value)) return;
        $('#liErr').textContent = err.message || T('pd.badlogin','Onjuiste inloggegevens.');
      }
    });
    $('#toJoin').addEventListener('click', stepAanmelden);
    $('#toForgot').addEventListener('click', stepForgot);
    $('#toDevice').addEventListener('click', stepSector);
  }
  /* DE TWEEDE STAP (N19). Staat de tweede factor van het account aan, dan geeft
     het wachtwoord alleen een bewijs, en DEZELFDE route ruilt dat met een code
     om (server/routes/supplier/pda/posities-inlog.js). Het gevraagde bedrijf
     reist mee. Een verlopen bewijs brengt u terug naar het wachtwoord. Zelfde
     veld als de leden-app en de techniekpagina: een code of een herstelcode. */
  function stapCode(d, bedrijf){
    teamAccessView('second', 'pd.access.second', 'Bevestig dat u het bent.',
      'pd.access.secondhelp', 'Vul de code uit uw authenticator-app of een van uw herstelcodes in.');
    $('#gateStep').innerHTML = teamBack('tcBack')+
      '<form class="lform" id="codeForm" autocomplete="off">'+
        teamField('tcCode', 'pd.tc.code', 'Code uit uw authenticator of herstelcode', 'text',
          'inputmode="numeric" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" '+
          'aria-label="'+esc(T('pd.tc.code', 'Code uit uw authenticator of herstelcode'))+'" data-i18n-aria="pd.tc.code" required')+
        '<div class="access-error" id="tcErr" role="alert" data-i18n-ignore></div>'+
        '<button class="access-primary" type="submit">'+teamText('pd.access.codego', 'Bevestig en ga naar mijn werkplek.')+'</button>'+
      '</form>';
    $('#tcBack').addEventListener('click', stepLogin);
    $('#codeForm').addEventListener('submit', async e => {
      e.preventDefault();
      $('#tcErr').textContent = '';
      const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true;
      try {
        const r = await API.call('/supplier/mijn/login', { bewijs: d.bewijs, code: $('#tcCode').value.trim(), bedrijf: bedrijf || '' });
        await landMijn(r);
        if (r.let) toast(r.let);   // bijvoorbeeld: nog twee herstelcodes over
      } catch(err){
        btn.disabled = false; $('#tcCode').value = '';
        // verlopen of niet meer geldig: terug naar het wachtwoord, met de reden
        if (err.status === 401) { stepLogin(); $('#liErr').textContent = err.message; return; }
        $('#tcErr').textContent = err.data && err.data.kantoor
          ? T('pd.ka.tweede', 'Uw account heeft toegang tot RTG Kantoor en vraagt een tweede stap. Log in via de leden-app en open daar Mijn werkplekken, Backoffice.')
          : (err.message || T('pd.mis', 'Er ging iets mis.'));
      }
    });
    try { $('#tcCode').focus(); } catch(e){}
  }
