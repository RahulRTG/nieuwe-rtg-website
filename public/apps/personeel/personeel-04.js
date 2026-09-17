/* De apparaatpoort: bedrijf, medewerker en pincode; daarna de kantoorpoort. */
  function stepSector(){
    kantoorStop();
    teamAccessView('device','pd.access.device','Uw werkplek.', 'pd.access.devicehelp','Vul de bedrijfscode van uw werkgever in. Daarna kunt u met uw naam en pincode inloggen.');
    const direct = teamBack('deviceBack')+'<form class="lform" id="vastBedrijf" autocomplete="off">' +
      teamField('vastCode','pd.code','Bedrijfscode','text','autocapitalize="characters" spellcheck="false" maxlength="32" required') +
      '<button class="prim" type="submit">'+teamText('pd.openbedrijf','Open bedrijf')+'</button></form>' +
      '<div class="lhint">'+teamText('pd.codehint','Gebruik de code van uw werkgever. Nieuwe RTG-partners werken hier direct, zonder dat deze app hoeft te worden aangepast.')+'</div>';
    const voorbeelden = demoOmgeving ? '<div class="glist compact">' + SECTORS.map(s =>
      '<button class="gbtn" data-sec="'+s.id+'"><span class="ic">'+(window.RTGGlyf?RTGGlyf.svgHTML(s.icon):'')+'</span><span><b>'+(lang()==='en'?s.en:s.nl)+'</b><span>'+s.sub+'</span></span></button>'
    ).join('') +
      '</div>' : '';
    $('#gateStep').innerHTML = direct + voorbeelden +
      '<div class="glist compact"><button class="gbtn" id="gKantoor"><span class="ic"></span><span><b>'+teamText('pd.kantoor','RTG Kantoor')+'</b><span>'+teamText('pd.kantoor.sub','Aanmelden en meewerken, ook vanuit huis')+'</span></span></button></div>';
    $('#deviceBack').addEventListener('click',stepLogin);
    $('#vastBedrijf').addEventListener('submit', e => {
      e.preventDefault(); const c = String($('#vastCode').value || '').trim().toUpperCase();
      if (!geldigeBedrijfscode(c)) { toast(T('pd.badcode','Controleer de bedrijfscode.')); return; }
      stepWie(null, c);
    });
    document.querySelectorAll('[data-sec]').forEach(b => b.addEventListener('click', () => stepBedrijf(b.dataset.sec)));
    $('#gKantoor').addEventListener('click', stepKantoor);
  }
  function stepBedrijf(secId){
    const sec = SECTORS.find(s => s.id === secId);
    $('#gateStep').innerHTML = '<button class="gback" id="gb1">← '+teamText('pd.back','Terug')+'</button><div class="glist">' + sec.codes.map(c =>
      '<button class="gbtn" data-bedrijf="'+c+'"><span class="ic">'+(window.RTGGlyf?RTGGlyf.svgHTML(sec.icon):'')+'</span><span><b>'+BEDRIJVEN[c].name+'</b><span>'+teamText('pd.choose','Kies uw bedrijf')+'</span></span></button>'
    ).join('') + '</div>';
    $('#gb1').addEventListener('click', stepSector);
    document.querySelectorAll('[data-bedrijf]').forEach(b => b.addEventListener('click', () => stepWie(secId, b.dataset.bedrijf)));
  }
  async function stepWie(secId, c){
    let roster = { staff: [] };
    try { roster = await API.call('/supplier/roster', { code: c }); }
    catch(e){ toast(T('pd.needserver','Start de server om in te loggen.')); return; }
    onthoudBedrijf(roster.supplier || { code: c, name: c });
    // dit apparaat staat nu vast op dit bedrijf
    try { localStorage.setItem('rtg_pda_bedrijf', c); } catch(e){}
    teamAccessView('team','pd.access.team','Kies uw naam.', 'pd.access.teamhelp','Kies uw eigen account om veilig verder te gaan met uw pincode.');
    $('#gateStep').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.6rem;margin-bottom:0.25rem;">'+
        '<div style="font-size:0.9rem;"><b>'+BEDRIJVEN[c].icon+' '+esc(BEDRIJVEN[c].name)+'</b><div style="font-size:0.68rem;color:var(--soft);">'+teamText('pd.vast','Deze PDA staat op dit bedrijf')+'</div></div>'+
        '<button class="gback" id="gbSwitch" style="margin:0;">'+teamText('pd.switch','Ander bedrijf')+'</button>'+
      '</div><div class="glist">' + (roster.staff||[]).map(m =>
      '<button class="gbtn" data-wie="'+m.id+'" data-nm="'+esc(m.name)+'"><span class="ic">'+(m.role==='manager'?'':'')+'</span><span><b>'+m.name+'</b><span>'+(m.role==='manager'?'Manager':teamText('pd.staff','Medewerker'))+'</span></span></button>'
    ).join('') + '</div>'+
      '<div style="margin-top:0.75rem;font-size:0.7rem;line-height:1.5;color:var(--soft);">'+teamText('pd.nieuw','Nieuw? Vraag uw werkgever om een kassacode en meld u eenmalig aan in de leverancier-app.')+'</div>';
    $('#gbSwitch').addEventListener('click', () => {
      try { localStorage.removeItem('rtg_pda_bedrijf'); } catch(e){}
      stepSector();
    });
    document.querySelectorAll('[data-wie]').forEach(b => b.addEventListener('click', () => stepPin(secId, c, Number(b.dataset.wie), b.dataset.nm)));
  }
  function stepPin(secId, c, staffId, nm){
    teamAccessView('pin','pd.access.pin','Welkom terug.', 'pd.access.pinhelp','Vul uw persoonlijke pincode in om uw werkplek te openen.');
    $('#gateStep').innerHTML = '<button class="gback" id="gb3">← '+teamText('pd.back','Terug')+'</button>'+
      '<div style="margin-top:0.5rem;font-size:0.9rem;"><b>'+esc(nm)+'</b> · '+BEDRIJVEN[c].name+'</div>'+
      '<div class="pinrow"><input id="pinInp" aria-label="'+T('pd.access.pinlabel','Uw viercijferige pincode')+'" data-i18n-aria="pd.access.pinlabel" type="password" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off"><button id="pinGo">'+teamText('pd.login','Inloggen')+'</button></div>'+
      (demoOmgeving && DEMO_BEDRIJVEN.has(c) ? '<div class="pd-demo-hint">'+T('pd.pinhint','Magnaat Test: manager 1234, medewerker 5678.')+'</div>' : '');
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
  let kaToken = null, kaDienst = null, kaTimer = null;
  try { kaToken = localStorage.getItem('rtg_office_token'); } catch(e){}
  try { kaDienst = JSON.parse(localStorage.getItem('rtg_kantoor_dienst') || 'null'); } catch(e){}
  const kaApi = (pad, body) => fetch('/api/office/' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kaToken },
    body: JSON.stringify(body || {})
  }).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || T('pd.mis','Er ging iets mis.')); return d; });
  function kantoorStop(){ if (kaTimer){ clearInterval(kaTimer); kaTimer = null; } }
  // het terug-adres van een kantoren-deeplink (?kamer=...): alleen eigen paden
  function kaTerugPad(){
    const t = new URLSearchParams(location.search).get('terug') || '';
    return (t.startsWith('/') && !t.startsWith('//')) ? t : null;
  }
  function stepKantoor(){
    kantoorStop();
    if (kaToken){ enterKantoor().catch(() => toonKantoorLogin()); return; }
    toonKantoorLogin();
  }
  function toonKantoorLogin(){
    teamAccessView('office','pd.access.office','Welkom bij RTG Kantoor.', 'pd.access.officehelp','Gebruik uw toegangscode voor kantoor. Is tweestapsverificatie ingesteld? Vul dan ook de code uit uw authenticator in.');
    $('#gateStep').innerHTML = '<button class="gback" id="kaTerug">← '+teamText('pd.back','Terug')+'</button>'+
      '<div class="card"><div class="k">'+teamText('pd.ka.code','Kantoorcode')+'</div>'+
      '<div class="pinrow h-mt60 rtg-duimeind"><input id="kaCode" data-i18n-aria="pd.ka.code" aria-label="Kantoorcode" type="password" autocomplete="current-password" style="letter-spacing:0.1em;" placeholder="&bull;&bull;&bull;&bull;">'+
      /* Binnenkomen is de hoofdhandeling (GRAMMATICA.md), voor vier poorten. */
      '<button id="kaGo" class="hoofd" data-hoofdactie>'+teamText('pd.ka.binnen','Binnen')+'</button></div>'+
      '<div class="k h-mt70">'+teamText('pd.ka.totp','TOTP-code (alleen als die is ingesteld)')+'</div>'+
      '<input class="hin h-mt40" id="kaTotp" data-i18n-aria="pd.ka.totp" aria-label="TOTP-code (alleen als die is ingesteld)" inputmode="numeric" autocomplete="one-time-code" placeholder="123456">'+
      '<div id="kaFout" style="margin-top:0.5rem;font-size:0.76rem;color:var(--burgundy);min-height:1rem;"></div></div>';
    $('#kaTerug').addEventListener('click', stepSector);
