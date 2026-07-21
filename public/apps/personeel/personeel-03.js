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
    $('#gateStep').innerHTML = '<button class="gback" id="kaTerug">← '+T('pd.back','Terug')+'</button>'+
      '<div class="card"><div class="k">'+T('pd.ka.code','Kantoorcode')+'</div>'+
      '<div class="pinrow" style="margin-top:0.6rem;"><input id="kaCode" type="password" autocomplete="current-password" style="letter-spacing:0.1em;" placeholder="&bull;&bull;&bull;&bull;">'+
      '<button id="kaGo">'+T('pd.ka.binnen','Binnen')+'</button></div>'+
      '<div class="k" style="margin-top:0.7rem;">'+T('pd.ka.totp','TOTP-code (alleen als die is ingesteld)')+'</div>'+
      '<input class="hin" id="kaTotp" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" style="margin-top:0.4rem;">'+
      '<div id="kaFout" style="margin-top:0.5rem;font-size:0.76rem;color:var(--burgundy);min-height:1rem;"></div></div>';
    $('#kaTerug').addEventListener('click', stepSector);
    const go = async () => {
      $('#kaFout').textContent = '';
      try {
        const r = await fetch('/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: $('#kaCode').value.trim(), totp: $('#kaTotp').value.trim() }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || T('pd.ka.fout','Die code klopt niet.'));
        kaToken = d.token; try { localStorage.setItem('rtg_office_token', kaToken); } catch(e){}
        // een account voor alles: net bewezen code stil aan het RTG-account koppelen
        try {
          const lt = localStorage.getItem('rtg_member_token');
          if (lt) fetch('/api/account/koppel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lt },
            body: JSON.stringify({ soort: 'kantoor', code: $('#kaCode').value.trim(), totp: $('#kaTotp').value.trim() }) });
        } catch(e){}
        enterKantoor();
      } catch(e){ $('#kaFout').textContent = e.message; }
    };
    $('#kaGo').addEventListener('click', go);
    $('#kaCode').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    $('#kaCode').focus();
    // is de kantoor-rol al aan het RTG-account op dit toestel gekoppeld,
    // dan is een tik genoeg (het ene account start dezelfde kantoor-sessie)
    (async () => {
      let lt = null; try { lt = localStorage.getItem('rtg_member_token'); } catch(e){}
      if (!lt) return;
      try {
        const r = await fetch('/api/account/rollen', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lt }, body: '{}' });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !(d.rollen || []).some(x => x.rol === 'kantoor')) return;
        const b = document.createElement('button');
        b.className = 'abtn'; b.style.cssText = 'margin-top:0.7rem;width:100%;padding:0.8rem;';
        b.textContent = '👤 ' + T('pd.ka.een', 'Verder met uw RTG-account');
        b.addEventListener('click', async () => {
          const s = await fetch('/api/account/start', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lt }, body: JSON.stringify({ rol: 'kantoor' }) });
          const sd = await s.json().catch(() => ({}));
          if (!s.ok) { $('#kaFout').textContent = sd.error || T('pd.mis', 'Er ging iets mis.'); return; }
          kaToken = sd.token; try { localStorage.setItem('rtg_office_token', kaToken); } catch(e){}
          enterKantoor();
        });
        const kaart = $('#gateStep').querySelector('.card');
        if (kaart) kaart.appendChild(b);
      } catch(e){}
    })();
  }
  async function enterKantoor(){
    const k = await kaApi('kamers');
    // een kantoren-deeplink bracht ons hier alleen voor het inloggen: meteen door
    const terug = kaTerugPad();
    if (terug){ location.replace(terug); return; }
    let naam = ''; try { naam = localStorage.getItem('rtg_kantoor_naam') || ''; } catch(e){}
    $('#gateStep').innerHTML = '<button class="gback" id="kaTerug">← '+T('pd.ka.staf','Personeel van een zaak')+'</button>'+
      '<div class="card" id="kaMeld">'+
        '<div class="k">'+T('pd.ka.naam','Jouw naam')+'</div>'+
        '<input class="hin" id="kaNaam" maxlength="30" style="margin-top:0.4rem;" value="'+esc(naam)+'">'+
        '<div class="row"><select class="hin" id="kaKamer">'+k.kamers.map(x => '<option value="'+x.id+'">'+x.emoji+' '+esc(x.naam)+'</option>').join('')+'</select>'+
        '<select class="hin" id="kaWaar" style="max-width:9.5rem;"><option value="thuis">🏠 '+T('pd.ka.thuis','Thuis')+'</option><option value="kantoor">🏢 '+T('pd.ka.hier','Kantoor')+'</option></select></div>'+
        '<button class="abtn" id="kaMeldGo" style="margin-top:0.7rem;width:100%;padding:0.8rem;">'+T('pd.ka.meld','Meld je aan voor je dienst')+'</button>'+
        '<div id="kaMFout" style="margin-top:0.4rem;font-size:0.76rem;color:var(--burgundy);min-height:1rem;"></div></div>'+
      '<div class="card" id="kaDienstBlok" hidden><div id="kaDienstTekst" style="font-size:0.9rem;"></div>'+
        '<button class="abtn ghost" id="kaAfmeld" style="margin-top:0.6rem;">'+T('pd.ka.afmeld','Meld je af')+'</button></div>'+
      '<div class="card"><div class="k">'+T('pd.ka.wie','Nu aan het werk')+'</div><div id="kaWie" style="margin-top:0.4rem;"></div></div>'+
      '<div class="card"><div class="k">'+T('pd.ka.chat','De chat van jouw kamer')+'</div>'+
        '<div id="kaChat" style="max-height:15rem;overflow-y:auto;font-size:0.85rem;margin-top:0.4rem;"></div>'+
        '<div class="row"><input class="hin" id="kaTekst" maxlength="500" placeholder="'+T('pd.ka.bericht','Bericht...')+'">'+
        '<button class="abtn" id="kaStuur">'+T('pd.ka.stuur','Stuur')+'</button></div></div>'+
      '<div style="margin-top:0.6rem;font-size:0.7rem;line-height:1.5;color:var(--soft);">'+T('pd.ka.uitleg','Het volledige kantoor (statistieken, taken, boardroom) staat in de kantoren-app; dit is je zak-versie voor aanmelden en contact.')+'</div>';
    $('#kaTerug').addEventListener('click', stepSector);
    const toonDienst = () => {
      $('#kaMeld').hidden = !!kaDienst;
      $('#kaDienstBlok').hidden = !kaDienst;
      if (kaDienst) $('#kaDienstTekst').textContent = '✅ ' + kaDienst.naam + ' ' + T('pd.ka.aangemeld','is aangemeld') + ' (' + kaDienst.waar + ', ' + kaDienst.kamer + ').';
    };
    const laadWie = async () => {
      try {
        const d = await kaApi('dienst');
        $('#kaWie').innerHTML = d.aangemeld.length ? d.aangemeld.map(x =>
          '<div class="task"><span class="ic">'+(x.waar==='thuis'?'🏠':'🏢')+'</span><div class="t"><b>'+esc(x.naam)+'</b><span>'+esc(x.kamer)+'</span></div></div>').join('')
          : '<div style="color:var(--soft);font-size:0.8rem;">'+T('pd.ka.niemand','Nog niemand aangemeld.')+'</div>';
      } catch(e){}
    };
    const laadChat = async () => {
      try {
        const kamer = kaDienst ? kaDienst.kamer : $('#kaKamer').value;
        if (!kamer) return;
        const d = await kaApi('kachat', { kamer });
        $('#kaChat').innerHTML = d.berichten.length ? d.berichten.slice(-25).map(m =>
          '<div style="padding:0.25rem 0;border-bottom:1px solid var(--line);"><b style="color:var(--gold);">'+esc(m.naam)+'</b> '+esc(m.tekst||'')+(m.foto?' 📸':'')+'</div>').join('')
          : '<div style="color:var(--soft);font-size:0.8rem;">'+T('pd.ka.stil','Nog stil hier.')+'</div>';
        $('#kaChat').scrollTop = $('#kaChat').scrollHeight;
      } catch(e){}
    };
    $('#kaMeldGo').addEventListener('click', async () => {
      $('#kaMFout').textContent = '';
      try {
        const d = await kaApi('dienst/in', { naam: $('#kaNaam').value, kamer: $('#kaKamer').value, waar: $('#kaWaar').value });
        kaDienst = d.dienst;
        try { localStorage.setItem('rtg_kantoor_dienst', JSON.stringify(kaDienst)); localStorage.setItem('rtg_kantoor_naam', kaDienst.naam); } catch(e){}
        toonDienst(); laadWie();
      } catch(e){ $('#kaMFout').textContent = e.message; }
    });
    $('#kaAfmeld').addEventListener('click', async () => {
      try { await kaApi('dienst/uit', { id: kaDienst.id }); } catch(e){}
      kaDienst = null; try { localStorage.removeItem('rtg_kantoor_dienst'); } catch(e){}
      toonDienst(); laadWie();
    });
    const stuur = async () => {
      try {
        await kaApi('kachat/stuur', { kamer: kaDienst ? kaDienst.kamer : $('#kaKamer').value, naam: (kaDienst && kaDienst.naam) || $('#kaNaam').value || T('pd.ka.collega','collega'), tekst: $('#kaTekst').value });
        $('#kaTekst').value = ''; laadChat();
      } catch(e){}
    };
    $('#kaStuur').addEventListener('click', stuur);
    $('#kaTekst').addEventListener('keydown', e => { if (e.key === 'Enter') stuur(); });
    toonDienst(); laadWie(); laadChat();
    kantoorStop();
    kaTimer = setInterval(() => { if (!document.hidden && document.getElementById('kaChat')) { laadWie(); laadChat(); } else kantoorStop(); }, 8000);
  }

  function enter(){
    $('#gate').style.display = 'none';
    $('#app').classList.add('active');
    $('#meName').textContent = me.name;
    const bedrijfNaam = (BEDRIJVEN[code] && BEDRIJVEN[code].name) || (state && state.supplier && state.supplier.name) || code;
    $('#meSub').textContent = bedrijfNaam + ' · ' + (me.role==='manager'?'Manager':T('pd.staff','Medewerker'));
    renderAll();
    laadZaken().then(renderAll);
    laadZorgbalie();
    laadMeldkamerPda();
    startStream();
    // de moedertaal van dit personeelslid: het hele scherm en de taken volgen
    if (window.MoederTaal) MoederTaal.start((p, b) => API.call(p, b), renderAll);
  }
  function renderAll(){ renderToday(); renderRooster(); renderTaken(); renderKeuken(); renderKamers(); renderHulp(); renderRitten(); renderBezorgen(); renderEntree(); renderWinkel(); renderVaart(); renderVerkoop(); renderBevPda(); renderBoer(); renderGebouwPda(); renderMarinaPda(); renderPolisPda(); renderZorgbalie(); renderMeldkamerPda(); renderBorden(); renderTeam(); }

  /* ---- Borden: hetzelfde werkbord als in de leverancier-app (shared/borden.js) ---- */
  let pdBordenUI = null;
  function renderBorden(){
    const wrap = $('#pdBordenWrap');
    if (!wrap || !window.BordenUI) return;
