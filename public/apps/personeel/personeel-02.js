  function stepAanmelden(){
    $('#gateStep').innerHTML =
      '<button class="gback" id="jaBack">← '+T('pd.back','Terug')+'</button>'+
      '<form class="lform" id="joinForm" autocomplete="on">'+
        '<input id="jaBedrijf" type="text" placeholder="'+T('pd.ja.bedrijf','Bedrijfsnaam')+'" aria-label="'+T('pd.ja.bedrijf','Bedrijfsnaam')+'">'+
        '<input id="jaCode" type="text" autocapitalize="characters" placeholder="'+T('pd.ja.code','Kassacode van uw werkgever')+'" aria-label="'+T('pd.ja.code','Kassacode van uw werkgever')+'">'+
        '<input id="jaUser" type="text" autocomplete="username" placeholder="'+T('pd.li.user','E-mail of gebruikersnaam')+'" aria-label="'+T('pd.li.user','E-mail of gebruikersnaam')+'">'+
        '<input id="jaPass" type="password" autocomplete="current-password" placeholder="'+T('pd.ja.rtgpass','Wachtwoord van uw RTG-account')+'" aria-label="'+T('pd.ja.rtgpass','Wachtwoord van uw RTG-account')+'">'+
        '<input id="jaPin" type="password" inputmode="numeric" maxlength="4" placeholder="'+T('pd.ja.pin','Kies een pincode (4 cijfers)')+'" aria-label="'+T('pd.ja.pin','Kies een pincode van 4 cijfers')+'">'+
        '<div class="err" id="jaErr" role="alert"></div>'+
        '<button class="prim" type="submit">'+T('pd.aanmelden.go','Aanmelden')+'</button>'+
      '</form>'+
      '<div class="lhint">'+T('pd.ja.hint','Nog geen RTG-account? Maak er gratis een aan in de leden-app; daarna meldt u zich hier aan met de kassacode van uw werkgever.')+'</div>';
    $('#jaBack').addEventListener('click', stepLogin);
    $('#joinForm').addEventListener('submit', async e => {
      e.preventDefault();
      $('#jaErr').textContent = '';
      const btn = e.target.querySelector('button.prim'); btn.disabled = true;
      try {
        await API.call('/supplier/staff/join', { bedrijf: $('#jaBedrijf').value.trim(), kassacode: $('#jaCode').value.trim(),
          login: $('#jaUser').value.trim(), password: $('#jaPass').value, pin: $('#jaPin').value.trim() });
        // aangemeld: log meteen in met hetzelfde account en land op het bedrijf
        await mijnLogin($('#jaUser').value.trim(), $('#jaPass').value);
      } catch(err){ $('#jaErr').textContent = err.message || T('pd.mis','Er ging iets mis.'); btn.disabled = false; }
    });
    $('#jaBedrijf').focus();
  }
  // Wachtwoord vergeten: stuurt de herstelmail; verder gaat het via de leden-app.
  function stepForgot(){
    $('#gateStep').innerHTML =
      '<button class="gback" id="fgBack">← '+T('pd.back','Terug')+'</button>'+
      '<form class="lform" id="forgotForm" autocomplete="on">'+
        '<input id="fgEmail" type="email" autocomplete="email" placeholder="'+T('pd.fg.email','Uw e-mailadres')+'" aria-label="'+T('pd.fg.email','Uw e-mailadres')+'">'+
        '<div class="err" id="fgErr" role="alert"></div>'+
        '<button class="prim" type="submit">'+T('pd.fg.go','Stuur herstel-link')+'</button>'+
      '</form>'+
      '<div class="lhint">'+T('pd.fg.hint','We sturen een link en een code om uw wachtwoord opnieuw in te stellen. Dat rondt u af in de leden-app.')+'</div>';
    $('#fgBack').addEventListener('click', stepLogin);
    $('#forgotForm').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button.prim'); btn.disabled = true;
      try { await API.call('/auth/forgot', { email: $('#fgEmail').value.trim() });
        toast(T('pd.fg.ok','Als dit adres bij ons bekend is, is de herstel-link onderweg.'));
        stepLogin();
      } catch(err){ $('#fgErr').textContent = err.message || T('pd.mis','Er ging iets mis.'); btn.disabled = false; }
    });
    $('#fgEmail').focus();
  }
  // Inloggen met het RTG-account en landen op de juiste bedrijfspagina.
  async function mijnLogin(login, password, bedrijf){
    const d = await API.call('/supplier/mijn/login', { login, password, bedrijf: bedrijf || '' });
    await landMijn(d);
  }
  // Land (of wissel) naar een van de eigen werkplekken: sessie zetten en de app openen.
  async function landMijn(d){
    API.token = d.token; state = d.state; code = d.supplier.code;
    me = { name: d.actor.name, role: d.actor.role, staffId: d.actor.staffId };
    mijnPosities = d.posities || [];
    try { localStorage.setItem('rtg_pda_token', API.token); localStorage.setItem('rtg_pda_code', code); } catch(e){}
    week = await API.call('/supplier/schedule', {}).catch(()=>null);
    enter();
  }
  function stepSector(){
    kantoorStop();
    $('#gateStep').innerHTML = '<div class="glist">' + SECTORS.map(s =>
      '<button class="gbtn" data-sec="'+s.id+'"><span class="ic">'+s.icon+'</span><span><b>'+(lang()==='en'?s.en:s.nl)+'</b><span>'+s.sub+'</span></span></button>'
    ).join('') +
      '<button class="gbtn" id="gKantoor"><span class="ic"></span><span><b>'+T('pd.kantoor','RTG Kantoor')+'</b><span>'+T('pd.kantoor.sub','Aanmelden en meewerken, ook vanuit huis')+'</span></span></button>'
    + '</div>';
    document.querySelectorAll('[data-sec]').forEach(b => b.addEventListener('click', () => stepBedrijf(b.dataset.sec)));
    $('#gKantoor').addEventListener('click', stepKantoor);
  }
  function stepBedrijf(secId){
    const sec = SECTORS.find(s => s.id === secId);
    $('#gateStep').innerHTML = '<button class="gback" id="gb1">← '+T('pd.back','Terug')+'</button><div class="glist">' + sec.codes.map(c =>
      '<button class="gbtn" data-bedrijf="'+c+'"><span class="ic">'+BEDRIJVEN[c].icon+'</span><span><b>'+BEDRIJVEN[c].name+'</b><span>'+T('pd.choose','Kies uw bedrijf')+'</span></span></button>'
    ).join('') + '</div>';
    $('#gb1').addEventListener('click', stepSector);
    document.querySelectorAll('[data-bedrijf]').forEach(b => b.addEventListener('click', () => stepWie(secId, b.dataset.bedrijf)));
  }
  async function stepWie(secId, c){
    let roster = { staff: [] };
    try { roster = await API.call('/supplier/roster', { code: c }); }
    catch(e){ toast(T('pd.needserver','Start de server om in te loggen.')); return; }
    // dit apparaat staat nu vast op dit bedrijf
    try { localStorage.setItem('rtg_pda_bedrijf', c); } catch(e){}
    $('#gateStep').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.6rem;margin-bottom:0.3rem;">'+
        '<div style="font-size:0.9rem;"><b>'+BEDRIJVEN[c].icon+' '+esc(BEDRIJVEN[c].name)+'</b><div style="font-size:0.68rem;color:var(--soft);">'+T('pd.vast','Deze PDA staat op dit bedrijf')+'</div></div>'+
        '<button class="gback" id="gbSwitch" style="margin:0;">'+T('pd.switch','Ander bedrijf')+'</button>'+
      '</div><div class="glist">' + (roster.staff||[]).map(m =>
      '<button class="gbtn" data-wie="'+m.id+'" data-nm="'+esc(m.name)+'"><span class="ic">'+(m.role==='manager'?'':'')+'</span><span><b>'+m.name+'</b><span>'+(m.role==='manager'?'Manager':T('pd.staff','Medewerker'))+'</span></span></button>'
    ).join('') + '</div>'+
      '<div style="margin-top:0.8rem;font-size:0.7rem;line-height:1.5;color:var(--soft);">'+T('pd.nieuw','Nieuw? Vraag uw werkgever om een kassacode en meld u eenmalig aan in de leverancier-app.')+'</div>';
    $('#gbSwitch').addEventListener('click', () => {
      try { localStorage.removeItem('rtg_pda_bedrijf'); } catch(e){}
      stepSector();
    });
    document.querySelectorAll('[data-wie]').forEach(b => b.addEventListener('click', () => stepPin(secId, c, Number(b.dataset.wie), b.dataset.nm)));
  }
  function stepPin(secId, c, staffId, nm){
    $('#gateStep').innerHTML = '<button class="gback" id="gb3">← '+T('pd.back','Terug')+'</button>'+
      '<div style="margin-top:0.4rem;font-size:0.9rem;"><b>'+esc(nm)+'</b> · '+BEDRIJVEN[c].name+'</div>'+
      '<div class="pinrow"><input id="pinInp" type="password" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off"><button id="pinGo">'+T('pd.login','Inloggen')+'</button></div>'+
      '<div style="margin-top:0.7rem;font-size:0.72rem;color:var(--soft);">'+T('pd.pinhint','Demo: manager 1234, medewerker 5678.')+'</div>';
    $('#gb3').addEventListener('click', () => stepWie(secId, c));
    // de werkplek-zone kan om een positie vragen: dan een keer ophalen en
    // opnieuw proberen; de server vergelijkt en bewaart er niets van
    const vraagPositie = () => new Promise(af => {
      if (!navigator.geolocation) return af(null);
      navigator.geolocation.getCurrentPosition(
        p => af({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => af(null), { enableHighAccuracy: true, timeout: 8000 });
    });
    const go = async () => {
      try {
        const body = { code: c, staffId, pin: $('#pinInp').value };
        let d;
        try { d = await API.call('/supplier/login', body); }
        catch(e1){
          if (!(e1.data && e1.data.locatieNodig)) throw e1;
          const pos = await vraagPositie();
          if (!pos) throw e1;
          d = await API.call('/supplier/login', Object.assign({ positie: pos }, body));
        }
        API.token = d.token; state = d.state; code = c;
        me = { name: d.state.actor.name, role: d.state.actor.role, staffId: d.state.actor.staffId };
        try { localStorage.setItem('rtg_pda_token', API.token); localStorage.setItem('rtg_pda_code', code); } catch(e2){}
        week = await API.call('/supplier/schedule', {}).catch(()=>null);
        enter();
        // Rahul denkt mee (agenda, uren, zorgprofiel): een advies, nooit een slot
        API.call('/supplier/werkadvies', {}).then(a => { if (a && a.advies) toast('' + a.advies.tekst); }).catch(()=>{});
      } catch(e){ toast(e.message || T('pd.badpin','Onjuiste pincode.')); }
    };
    $('#pinGo').addEventListener('click', go);
    $('#pinInp').addEventListener('keydown', e => { if (e.key==='Enter') go(); });
    $('#pinInp').focus();
  }

  /* ---------- de kantoor-modus: de oude kantoor-PDA, nu een ingang hier ----------
     Kantoormensen zijn geen zaak-personeel: zij melden zich met de kantoorcode,
     kiezen hun kamer en werkplek (thuis of kantoor) en houden de kamerchat bij.
     Het volledige kantoor (taken, statistieken, boardroom) blijft kantoren.html. */
