
  /* ---------- ID-/leeftijdscheck met het Zegel ----------
     De zaak scant het Zegel van een lid en verifieert het HIER, op het toestel,
     met de publieke sleutel van RTG -- offline. Groen betekent: RTG staat met de
     handtekening garant dat het paspoort is gezien; de partner leert enkel het
     bewezen feit (18+, lid, welke pas), nooit de naam. De controle wordt ook op
     de server gelogd als officiele ID-check. */
  function zcStijlEenmalig(){
    if (document.getElementById('rtg-zc-stijl')) return;
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
