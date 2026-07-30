    // de pas-controle
    html += '<div class="card"><div class="k">'+T('pd.pol.pas','Pas-controle')+'</div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="ppPas" placeholder="ZP-XXXX" maxlength="12" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:8px;color:var(--txt);font:inherit;font-size:0.85rem;padding:0.45rem 0.6rem;text-transform:uppercase;">'+
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
  /* De hoofd-ingang is een GESPREK met Rahul, net als in de leden-app: hij
     vraagt wie u bent, daarna uw wachtwoord, en pas dan gaat hij aanbellen bij
     dezelfde inlogroute als voorheen (mijnLogin -> /api/auth/login). Er gaat
     niets van dit gesprek naar een taalmodel, en Rahul beslist niets: de server
     zegt ja of nee, precies als eerst. De zijpaden (aanmelden, wachtwoord
     vergeten, vast apparaat) staan er rustig onder.
     Is shared/rahulpoort.js er niet, dan valt hij terug op het oude formulier;
     zonder inlogscherm zou de app onbruikbaar zijn en dat risico nemen we niet. */
  function stepLogin(){
    kantoorStop();
    if (window.RTGPoort && window.RTGPoort.gesprek) return poortGesprek();
    formulierLogin();
  }
  function poortGesprek(){
    window.RTGPoort.gesprek($('#gateStep'), {
      groet: () => T('pd.rp.groet','Welkom terug bij RTG Personeel.'),
      wacht: () => T('pd.rp.wacht','Een ogenblik, ik kijk het na.'),
      stuurLabel: T('pd.rp.stuur','Stuur'),
      stappen: [
        { sleutel:'user', vraag: () => T('pd.rp.wie','Met wie heb ik het genoegen?'),
          plho: () => T('pd.li.user','E-mail of gebruikersnaam'), type:'text', autocomplete:'username' },
        { sleutel:'pass', vraag: () => T('pd.rp.pass','Dank u. En uw wachtwoord?'),
          plho: () => T('pd.li.pass','Wachtwoord'), type:'password', autocomplete:'current-password' }
      ],
      klaar: async (a) => {
        try { await mijnLogin(a.user, a.pass); }
        catch(err){ throw new Error(err && err.message || T('pd.badlogin','Onjuiste inloggegevens.')); }
      },
      zijpaden: [
        { tekst: () => T('pd.aanmelden','Aanmelden bij een bedrijf'), doe: stepAanmelden },
        { tekst: () => T('pd.forgot','Wachtwoord vergeten?'), doe: stepForgot },
        { tekst: () => T('pd.ondevice','Vast apparaat? Inloggen met naam en pincode'), doe: stepSector }
      ]
    });
  }
  // Aanmelden bij een bedrijf: bedrijfsnaam + kassacode (van de werkgever) +
  // het eigen RTG-account + een zelfgekozen pincode. Daarna landt u meteen.
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
