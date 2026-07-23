
  /* ---------- Aanwezigheid: hoeveel binnen + man/vrouw ----------
     Elke receptie/entree telt hoeveel mensen er binnen zijn en de verdeling
     man/vrouw. Bewust alleen geaggregeerd -- nooit per persoon, nooit een naam.
     De deur telt op en af; bij het sluiten leeg je de teller. */
  function awStijlEenmalig(){
    if (document.getElementById('rtg-aw-stijl')) return;
    const st = document.createElement('style'); st.id = 'rtg-aw-stijl';
    st.textContent = [
      '.aw-ov{position:fixed;inset:0;z-index:100000;background:rgba(12,12,11,.78);display:flex;align-items:flex-end;justify-content:center;}',
      '.aw-card{width:100%;max-width:480px;background:var(--card,#161615);border-radius:20px 20px 0 0;padding:1.3rem 1.2rem calc(1.3rem + env(safe-area-inset-bottom,0));color:var(--txt,#fff);}',
      '.aw-kop{display:flex;align-items:baseline;gap:.6rem;margin-bottom:.2rem;}',
      '.aw-kop h3{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;font-size:1.2rem;margin:0;flex:1;}',
      '.aw-binnen{text-align:center;margin:.4rem 0 1rem;}',
      '.aw-binnen b{font-size:3rem;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;}',
      '.aw-binnen span{display:block;color:var(--soft,#8A8680);font-size:.8rem;letter-spacing:.04em;text-transform:uppercase;}',
      '.aw-rij{display:flex;align-items:center;gap:.8rem;padding:.6rem .2rem;border-top:1px solid var(--line,#2a2a28);}',
      '.aw-rij .lbl{flex:1;font-size:.95rem;}',
      '.aw-rij .n{min-width:2.2rem;text-align:center;font-size:1.3rem;font-weight:700;font-variant-numeric:tabular-nums;}',
      '.aw-btn{width:44px;height:44px;border-radius:12px;border:1px solid var(--line,#3a3a38);background:var(--bg,#0C0C0B);color:var(--txt,#fff);font-size:1.4rem;cursor:pointer;line-height:1;}',
      '.aw-btn.plus{background:#7F1634;border-color:#7F1634;}',
      '.aw-acts{display:flex;gap:.6rem;margin-top:1rem;}',
      '.aw-acts button{flex:1;border-radius:12px;padding:.75rem;font-family:inherit;font-weight:600;cursor:pointer;border:1px solid var(--line,#3a3a38);background:none;color:var(--soft,#8A8680);}'
    ].join('');
    document.head.appendChild(st);
  }
  const AW_GROEPEN = [ { id: 'man', label: 'Man', icoon: '' }, { id: 'vrouw', label: 'Vrouw', icoon: '' }, { id: 'onbekend', label: 'Onbekend / anders', icoon: '○' } ];
  async function awPas(groep, delta){
    try { const d = await API.call('/supplier/aanwezig/pas', { groep, delta }); awToon(d.aanwezig); } catch(e){ toast(e.message); }
  }
  function awToon(a){
    const b = document.getElementById('awBinnen'); if (b) b.textContent = a.binnen;
    for (const g of AW_GROEPEN){ const n = document.getElementById('awN-' + g.id); if (n) n.textContent = a[g.id]; }
  }
  async function openAanwezig(){
    awStijlEenmalig();
    let a = { man: 0, vrouw: 0, onbekend: 0, binnen: 0 };
    try { a = (await API.call('/supplier/aanwezig', {})).aanwezig; } catch(e){ toast(e.message); return; }
    const oud = document.getElementById('awOverlay'); if (oud) oud.remove();
    const ov = document.createElement('div'); ov.className = 'aw-ov'; ov.id = 'awOverlay';
    ov.innerHTML = '<div class="aw-card" role="dialog" aria-modal="true" aria-label="'+T('aw.titel','Aanwezigheid')+'">'+
      '<div class="aw-kop"><h3>'+T('aw.titel','Aanwezigheid')+'</h3><button class="aw-btn" id="awSluit" aria-label="Sluiten">✕</button></div>'+
      '<div class="aw-binnen"><b id="awBinnen">'+a.binnen+'</b><span>'+T('aw.binnen','nu binnen')+'</span></div>'+
      AW_GROEPEN.map(g => '<div class="aw-rij"><span class="lbl">'+g.icoon+' '+T('aw.'+g.id, g.label)+'</span>'+
        '<button class="aw-btn" data-awmin="'+g.id+'" aria-label="'+g.label+' eraf">−</button>'+
        '<span class="n" id="awN-'+g.id+'">'+a[g.id]+'</span>'+
        '<button class="aw-btn plus" data-awplus="'+g.id+'" aria-label="'+g.label+' erbij">+</button></div>').join('')+
      '<div class="aw-acts"><button id="awLeeg">'+T('aw.leeg','Leeg de teller (bij sluiten)')+'</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.getElementById('awSluit').addEventListener('click', () => ov.remove());
    ov.querySelectorAll('[data-awplus]').forEach(b => b.addEventListener('click', () => awPas(b.dataset.awplus, 1)));
    ov.querySelectorAll('[data-awmin]').forEach(b => b.addEventListener('click', () => awPas(b.dataset.awmin, -1)));
    document.getElementById('awLeeg').addEventListener('click', async () => {
      if (!confirm(T('aw.leegvraag','De teller op nul zetten?'))) return;
      try { const d = await API.call('/supplier/aanwezig/leeg', {}); awToon(d.aanwezig); } catch(e){ toast(e.message); }
    });
  }
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-aanwezig]'); if (b) openAanwezig(); });
