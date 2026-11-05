// Verbindt leveranciersoverlays met de bestaande presentatiebasis.
  function leverancierOverlayPresentatie() {
    if (document.documentElement.hasAttribute('data-ds') || document.getElementById('rtgDsRuntimeCss')) return;
    const link = document.createElement('link');
    link.id = 'rtgDsRuntimeCss'; link.rel = 'stylesheet'; link.href = '/ds/rtg-ds.css';
    document.head.appendChild(link);
  }
  function idResultaat(r){
    const geldig = r && r.geldig, claims = (geldig && r.claims) || {};
    const LBL = { leeftijd18: '18 jaar of ouder', leeftijd21: '21 jaar of ouder', lid: 'Geldig RTG-lid', pas: 'Pas', foundation: 'RTFoundation', zakelijk: 'Zakelijk lid' };
    const rijen = Object.keys(claims).map(k => '<div class="zc-claim">✓ '+(LBL[k]||k)+(k==='pas'?': '+claims[k]:'')+'</div>').join('') || '<div class="zc-tot">'+T('zc.geenclaim','geldig, maar geen feit gedeeld')+'</div>';
    const geldTot = geldig && r.exp ? new Date(r.exp*1000).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'}) : null;
    const reden = { vorm:'geen geldige code', handtekening:'handtekening klopt niet', verlopen:'de code is verlopen', fout:'onleesbaar', 'geen-webcrypto':'kan niet controleren op dit toestel' }[r && r.reden] || (r && r.reden) || 'ongeldig';
    leverancierOverlayPresentatie();
    const ov = document.createElement('div'); ov.className = 'ds-leverancier-overlay zc-ov';
    ov.innerHTML = '<div class="zc-card '+(geldig?'ok':'nee')+'" role="dialog" aria-modal="true" aria-label="'+(geldig?'Geldig':'Niet geldig')+'">'+
      '<div class="zc-icon">'+(geldig?'✓':'✕')+'</div>'+
      '<div class="zc-kop">'+(geldig?T('zc.ok','RTG-geverifieerd'):T('zc.nee','Niet geldig'))+'</div>'+
      (geldig ? '<div class="zc-claims">'+rijen+'</div>'+(geldTot?'<div class="zc-tot">'+T('zc.geldigtot','Geldig tot ')+geldTot+'</div>':'')
              : '<div class="zc-tot">'+reden+'</div>')+
      '<div class="zc-priv">'+T('zc.priv','Zonder naam of geboortedatum. Een leeftijd staat er alleen op als RTG het identiteitsbewijs heeft gezien; ontbreekt hij, dan is hij niet bewezen.')+'</div>'+
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
  const AW_GROEPEN = [ { id: 'man', label: 'Man', icoon: '' }, { id: 'vrouw', label: 'Vrouw', icoon: '' }, { id: 'onbekend', label: 'Onbekend / anders', icoon: '○' } ];
  async function awPas(groep, delta){
    try { const d = await API.call('/supplier/aanwezig/pas', { groep, delta }); awToon(d.aanwezig); } catch(e){ toast(e.message); }
  }
  function awToon(a){
    const b = document.getElementById('awBinnen'); if (b) b.textContent = a.binnen;
    for (const g of AW_GROEPEN){ const n = document.getElementById('awN-' + g.id); if (n) n.textContent = a[g.id]; }
  }
  async function openAanwezig(){
    let a = { man: 0, vrouw: 0, onbekend: 0, binnen: 0 };
    try { a = (await API.call('/supplier/aanwezig', {})).aanwezig; } catch(e){ toast(e.message); return; }
    const oud = document.getElementById('awOverlay'); if (oud) oud.remove();
    leverancierOverlayPresentatie();
    const ov = document.createElement('div'); ov.className = 'ds-leverancier-overlay aw-ov'; ov.id = 'awOverlay';
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
