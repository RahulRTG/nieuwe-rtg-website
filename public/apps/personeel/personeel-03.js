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
        b.textContent = '' + T('pd.ka.een', 'Verder met uw RTG-account');
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
