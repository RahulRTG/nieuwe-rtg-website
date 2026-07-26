    const st = document.createElement('style'); st.id = 'rtg-zc-stijl';
    st.textContent = [
      '.zc-ov{position:fixed;inset:0;z-index:100000;background:rgba(12,12,11,.78);display:flex;align-items:center;justify-content:center;padding:1.2rem;}',
      '.zc-card{width:100%;max-width:380px;background:var(--card,#161615);border-radius:20px;padding:1.6rem 1.3rem;text-align:center;color:var(--txt,#fff);border:1px solid var(--line,#2a2a28);}',
      '.zc-card.ok{border-color:rgba(46,160,86,.6);box-shadow:0 0 0 3px rgba(46,160,86,.14);}',
      '.zc-card.nee{border-color:rgba(194,58,94,.6);box-shadow:0 0 0 3px rgba(194,58,94,.14);}',
      '.zc-icon{width:64px;height:64px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto .6rem;font-weight:700;}',
      '.zc-card.ok .zc-icon{background:rgba(46,160,86,.18);color:#39B366;}',
      '.zc-card.nee .zc-icon{background:rgba(194,58,94,.18);color:#C23A5E;}',
      '.zc-kop{font-family:"Bodoni Moda",Georgia,serif;font-size:1.3rem;margin-bottom:.5rem;}',
      '.zc-claims{display:flex;flex-direction:column;gap:.35rem;margin:.5rem 0;}',
      '.zc-claim{background:rgba(46,160,86,.12);color:#39B366;border-radius:10px;padding:.4rem .6rem;font-weight:600;font-size:.92rem;}',
      '.zc-tot{color:var(--soft,#8A8680);font-size:.85rem;margin:.3rem 0;}',
      '.zc-priv{color:var(--soft,#8A8680);font-size:.72rem;line-height:1.5;margin:.7rem 0 0;}',
      '.zc-btn{width:100%;margin-top:1rem;background:#7F1634;color:#fff;border:none;border-radius:12px;padding:.8rem;font-weight:600;font-family:inherit;cursor:pointer;}'
    ].join('');
    document.head.appendChild(st);
  }
  function idResultaat(r){
    zcStijlEenmalig();
    const geldig = r && r.geldig, claims = (geldig && r.claims) || {};
    const LBL = { leeftijd18: '18 jaar of ouder', leeftijd21: '21 jaar of ouder', lid: 'Geldig RTG-lid', pas: 'Pas', foundation: 'RTFoundation', zakelijk: 'Zakelijk lid' };
    const rijen = Object.keys(claims).map(k => '<div class="zc-claim">✓ '+(LBL[k]||k)+(k==='pas'?': '+claims[k]:'')+'</div>').join('') || '<div class="zc-tot">'+T('zc.geenclaim','geldig, maar geen feit gedeeld')+'</div>';
    const geldTot = geldig && r.exp ? new Date(r.exp*1000).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'}) : null;
    const reden = { vorm:'geen geldige code', handtekening:'handtekening klopt niet', verlopen:'de code is verlopen', fout:'onleesbaar', 'geen-webcrypto':'kan niet controleren op dit toestel' }[r && r.reden] || (r && r.reden) || 'ongeldig';
    const ov = document.createElement('div'); ov.className = 'zc-ov';
    ov.innerHTML = '<div class="zc-card '+(geldig?'ok':'nee')+'" role="dialog" aria-modal="true" aria-label="'+(geldig?'Geldig':'Niet geldig')+'">'+
      '<div class="zc-icon">'+(geldig?'✓':'✕')+'</div>'+
      '<div class="zc-kop">'+(geldig?T('zc.ok','RTG-geverifieerd'):T('zc.nee','Niet geldig'))+'</div>'+
      (geldig ? '<div class="zc-claims">'+rijen+'</div>'+(geldTot?'<div class="zc-tot">'+T('zc.geldigtot','Geldig tot ')+geldTot+'</div>':'')
              : '<div class="zc-tot">'+reden+'</div>')+
      '<div class="zc-priv">'+T('zc.priv','Zonder naam of geboortedatum: RTG staat met de handtekening garant dat het paspoort is gezien.')+'</div>'+
      '<button class="zc-btn" id="zcDicht">'+T('zc.klaar','Klaar')+'</button></div>';
    document.body.appendChild(ov);
    const dicht = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov) dicht(); });
    ov.querySelector('#zcDicht').addEventListener('click', dicht);
  }
  async function idCheckVerwerk(tekst){
    let r = null;
    try { if (window.RTGZegelcheck){ const sleutel = await RTGZegelcheck.haalSleutel(); r = await RTGZegelcheck.verifieer(tekst, sleutel); } } catch(e){}
    // ook de server laten verifieren en loggen (officiele, controleerbare check)
    try { const s = await API.call('/supplier/zegel/check', { token: tekst }); if (!r || r.reden === 'geen-webcrypto') r = s; } catch(e){ if (!r) r = { geldig:false, reden:'fout' }; }
    idResultaat(r);
  }
  function idCheck(){
    if (!window.RTGScanknop){ toast(T('zc.nietklaar','De scanner is nog niet geladen.')); return; }
    RTGScanknop.open({ titel: T('zc.titel','ID / leeftijd controleren'), hint: T('zc.hint','Laat het lid het Zegel tonen en scan de QR.'), onCode: (c) => { idCheckVerwerk(c.tekst); } });
  }
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-idcheck]'); if (b) idCheck(); });

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
