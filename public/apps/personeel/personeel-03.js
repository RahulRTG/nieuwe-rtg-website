    // de pas-controle
    html += '<div class="card"><div class="k">'+T('pd.pol.pas','Pas-controle')+'</div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="ppPas" placeholder="ZP-XXXX" maxlength="12" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:0;color:var(--txt);font:inherit;font-size:0.85rem;padding:0.45rem 0.6rem;text-transform:uppercase;">'+
      '<button class="abtn" id="ppGo">'+T('pd.pol.check','Controleer')+'</button></div>'+
      '<div id="ppUit" style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);"></div></div>';
    wrap.innerHTML = html;
    const doe2 = (sel, fn) => wrap.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', () => fn(b.dataset)));
    doe2('data-ppak', async ds => {
      try { await API.call('/supplier/polis/zet', { id: ds.ppak, status: 'advies-klaar', advies: (wrap.querySelector('[data-ppat="'+ds.ppak+'"]')||{}).value }); laadPolisPda(); } catch(e){ toast(e.message); }
    });
    doe2('data-ppdg', async ds => {
      try { await API.call('/supplier/zorgpolis/declaratie/beslis', { id: ds.ppdg, besluit: 'goedgekeurd', door: (me && me.name) || '' }); laadPolisPda(); } catch(e){ toast(e.message); }
    });
    doe2('data-ppda', async ds => {
      try { await API.call('/supplier/zorgpolis/declaratie/beslis', { id: ds.ppda, besluit: 'afgewezen', reden: (wrap.querySelector('[data-ppdr="'+ds.ppda+'"]')||{}).value, door: (me && me.name) || '' }); laadPolisPda(); } catch(e){ toast(e.message); }
    });
    const go = wrap.querySelector('#ppGo');
    if (go) go.addEventListener('click', async () => {
      try { const r = await API.call('/supplier/zorgpolis/pas', { pas: (wrap.querySelector('#ppPas')||{}).value });
        wrap.querySelector('#ppUit').textContent = (r.actief ? T('pd.pol.actief','Actief') : T('pd.pol.niet','Niet actief')) + ' · ' + r.pakket + ' · ' + r.codenaam;
      } catch(e){ const u = wrap.querySelector('#ppUit'); if (u) u.textContent = e.message; }
    });
  }


  /* ---------- stappen-gate: sector -> bedrijf -> wie -> pincode ----------
     De PDA staat vast op een bedrijf: na de eerste keuze onthoudt het apparaat
     het bedrijf en opent hij direct op het eigen team. Inloggen kan alleen wie
     door de werkgever is uitgenodigd en zich heeft aangemeld (dan sta je in het
     team), met de eigen pincode. */
  function pdaBedrijf(){
    try { const c = String(localStorage.getItem('rtg_pda_bedrijf') || '').toUpperCase(); return geldigeBedrijfscode(c) ? c : null; } catch(e){ return null; }
  }
  function stepStart(){
    // 1x aanmelden is de gewone ingang: log één keer in met uw eigen RTG-account
    // en u landt meteen op de juiste bedrijfspagina. Een vast apparaat in de zaak
    // (QR / ?bedrijf=CODE, of een onthouden bedrijf) houdt de naam-en-pincode-ingang.
    const qs = new URLSearchParams(location.search);
    if (qs.get('kantoor') != null){ stepKantoor(); return; }
    const qb = String(qs.get('bedrijf') || '').toUpperCase();
    if (geldigeBedrijfscode(qb)){ stepWie(null, qb); return; }
    const vast = pdaBedrijf();
    if (vast) stepWie(null, vast);
    else stepLogin();
  }
  // The shared access canvas changes presentation, never account authority.
  function stepLogin(){
    kantoorStop();
    teamAccessView('login', 'pd.access.welcome', 'Welkom bij uw team.',
      'pd.access.loginhelp', 'Log in met uw persoonlijke RTG-account om verder te gaan naar uw werkplek.');
    formulierLogin();
  }
  // Aanmelden bij een bedrijf: bedrijfsnaam + kassacode (van de werkgever) +
  // het eigen RTG-account + een zelfgekozen pincode. Daarna landt u meteen.
  function stepAanmelden(){
    teamAccessView('join', 'pd.access.join', 'Sluit u aan bij uw team.',
      'pd.access.joinhelp', 'Gebruik de gegevens van uw werkgever en uw eigen RTG-account. Kies daarna een pincode voor het apparaat op uw werkplek.');
    $('#gateStep').innerHTML = teamBack('jaBack')+
      '<form class="lform" id="joinForm" autocomplete="on">'+
        teamField('jaBedrijf', 'pd.ja.bedrijf', 'Bedrijfsnaam', 'text', 'autocomplete="organization" required')+
        teamField('jaCode', 'pd.ja.code', 'Kassacode van uw werkgever', 'text', 'autocapitalize="characters" spellcheck="false" required')+
        teamField('jaUser', 'pd.li.user', 'E-mail of gebruikersnaam', 'text', 'autocomplete="username" autocapitalize="none" spellcheck="false" required')+
        teamField('jaPass', 'pd.ja.rtgpass', 'Wachtwoord van uw RTG-account', 'password', 'autocomplete="current-password" required')+
        teamField('jaPin', 'pd.ja.pin', 'Kies een pincode van 4 cijfers', 'password', 'inputmode="numeric" minlength="4" maxlength="4" pattern="[0-9]{4}" autocomplete="new-password" required')+
        '<div class="access-error" id="jaErr" role="alert" data-i18n-ignore></div>'+
        '<button class="access-primary" type="submit">'+teamText('pd.access.joingo', 'Ik meld mij aan bij mijn team.')+'</button>'+
      '</form><p class="lhint">'+teamText('pd.access.accounthelp', 'Heeft u nog geen RTG-account? Maak dit eerst aan. Daarna kunt u zich hier bij uw team aanmelden.')+'</p>'+
      '<a class="access-secondary" href="/apps/app.html">'+teamText('pd.access.account', 'Ik wil een RTG-account aanmaken.')+'</a>';
    $('#jaBack').addEventListener('click', stepLogin);
    $('#joinForm').addEventListener('submit', async e => {
      e.preventDefault();
      $('#jaErr').textContent = '';
      const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true;
      try {
        await API.call('/supplier/staff/join', { bedrijf: $('#jaBedrijf').value.trim(), kassacode: $('#jaCode').value.trim(),
          login: $('#jaUser').value.trim(), password: $('#jaPass').value, pin: $('#jaPin').value.trim() });
        // aangemeld: log meteen in met hetzelfde account en land op het bedrijf
        await mijnLogin($('#jaUser').value.trim(), $('#jaPass').value);
      } catch(err){ $('#jaErr').textContent = err.message || T('pd.mis','Er ging iets mis.'); btn.disabled = false; }
    });

  }
  // Wachtwoord vergeten: stuurt de herstelmail; verder gaat het via de leden-app.
  function stepForgot(){
    teamAccessView('recovery', 'pd.access.recovery', 'We helpen u verder.',
      'pd.access.recoveryhelp', 'Vul het e-mailadres van uw RTG-account in. U ontvangt een link waarmee u uw wachtwoord opnieuw kunt instellen.');
    $('#gateStep').innerHTML = teamBack('fgBack')+
      '<form class="lform" id="forgotForm" autocomplete="on">'+
        teamField('fgEmail', 'pd.fg.email', 'Uw e-mailadres', 'email', 'autocomplete="email" autocapitalize="none" required')+
        '<div class="access-error" id="fgErr" role="alert" data-i18n-ignore></div>'+
        '<button class="access-primary" type="submit">'+teamText('pd.access.recovergo', 'Stuur mij een herstellink.')+'</button>'+
      '</form><p class="access-status" id="fgStatus" role="status"></p>';
    $('#fgBack').addEventListener('click', stepLogin);
    $('#forgotForm').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true;
      try { await API.call('/auth/forgot', { email: $('#fgEmail').value.trim() });
        $('#fgStatus').innerHTML = teamText('pd.fg.ok','Als dit adres bij ons bekend is, is de herstel-link onderweg.');
      } catch(err){ $('#fgErr').textContent = err.message || T('pd.mis','Er ging iets mis.'); btn.disabled = false; }
    });

  }
  // Inloggen met het RTG-account en landen op de juiste bedrijfspagina.
  async function mijnLogin(login, password, bedrijf){
    const d = await API.call('/supplier/mijn/login', { login, password, bedrijf: bedrijf || '' });
    await landMijn(d);
  }

  // Land (of wissel) naar een van de eigen werkplekken: sessie zetten en de app openen.
  async function landMijn(d){
    onthoudBedrijf(d.supplier);
    API.token = d.token; state = d.state; code = d.supplier.code;
    me = { name: d.actor.name, role: d.actor.role, staffId: d.actor.staffId };
    mijnPosities = d.posities || [];
    try { localStorage.setItem('rtg_pda_token', API.token); localStorage.setItem('rtg_pda_code', code); } catch(e){}
    week = await API.call('/supplier/schedule', {}).catch(()=>null);
    enter();
  }

  /* Meenemen (shared/uitvoer.js): het weekrooster dat onder Rooster op het
     scherm staat, met de velden LOS -- datum, dag, naam, rol en dienst -- in
     plaats van de regel "Carla Vidal 09:00-17:00" die er staat. Dit is precies
     wat /supplier/schedule teruggeeft; er wordt niets bij verzonnen, en er
     staat niemand in die niet ook op het rooster te zien is. */
  if (window.RTGUitvoer) RTGUitvoer.bron(function(){
    if (!week || !(week.days || []).length) return null;
    const rijen = [];
    week.days.forEach(function(dag){
      (dag.staff || []).forEach(function(m){
        rijen.push([dag.date, dag.label, m.name || '', m.role || '', m.shift || '']);
      });
    });
    if (!rijen.length) return null;
    return { naam: 'rooster', kolommen: ['datum','dag','naam','rol','dienst'], rijen: rijen };
  });
