/* een foto uploaden bij de zaak */
    const f = $('#phFile'); if (f) f.addEventListener('change', () => {
      const file = f.files && f.files[0]; if (!file) return;
      if (file.size > 1024*1024){ toast(T('sup.phtoobig','Foto te groot (max 1 MB).')); return; }
      fileToDataURL(file, async url => {
        try { await API.call('/supplier/photo/add', { image: url }); toast(T('sup.phadded','Foto geplaatst.')); await refresh(); openTab('page'); } catch(e){ toast(e.message); }
      });
    });
    let picked = null;
    el.querySelectorAll('[data-pick]').forEach(img => img.addEventListener('click', () => {
      picked = picked === Number(img.dataset.pick) ? null : Number(img.dataset.pick);
      el.querySelectorAll('[data-pick]').forEach(x => x.classList.toggle('sel', Number(x.dataset.pick) === picked));
    }));
    const post = $('#spPost'); if (post) post.addEventListener('click', async () => {
      const text = $('#spText').value.trim();
      if (!text){ toast(T('sup.salonempty','Schrijf eerst een tekst.')); return; }
      try {
        await API.call('/supplier/salon/post', { text, photoIndex: picked });
        toast(T('sup.salondone','Gepubliceerd op De Salon.'));
        $('#spText').value = ''; picked = null;
        el.querySelectorAll('[data-pick]').forEach(x => x.classList.remove('sel'));
      } catch(e){ toast(e.message); }
    });
  }


  /* ---------- tafel-QR's printen ----------
     Elke tafel krijgt een sticker met een QR: het lid scant hem en bestelt en
     betaalt meteen voor die tafel, zonder een code over te typen. De QR bevat
     alleen de zaakcode en de tafelnaam, nooit persoonsdata. */
  function printTafelQRs(){
    if (!window.RTGQRteken || !window.RTGCode){ toast(T('tblqr.nietklaar','Het QR-onderdeel is nog niet geladen.')); return; }
    const code = S && S.code, tafels = (state && state.tables) || [];
    if (!code || !tafels.length){ toast(T('tblqr.geen','Er zijn nog geen tafels om te printen.')); return; }
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
    const naam = (S && S.name) || 'RTG';
    let kaarten = '';
    for (const t of tafels){
      let url = '';
      try { url = RTGQRteken.dataURL(RTGCode.bouwTafel(code, t.name), { schaal: 6, ecc: 'M' }); } catch(e){ continue; }
      kaarten += '<div class="k"><img src="'+url+'" alt=""><div class="n">'+esc(t.name)+'</div><div class="s">'+esc(naam)+' · '+esc(T('tblqr.sub','scan en bestel'))+'</div></div>';
    }
    const w = window.open('', '_blank');
    if (!w){ toast(T('tblqr.popup','Sta pop-ups toe om de tafel-QR’s te printen.')); return; }
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(naam)+' · tafel-QR</title><style>'+
      'body{font-family:Inter,system-ui,sans-serif;margin:0;padding:14mm;color:#0C0C0B;}'+
      'h1{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;font-size:18pt;margin:0 0 6mm;}'+
      '.g{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm;}'+
      '.k{border:1px solid #DEDBD5;border-radius:10px;padding:7mm 4mm;text-align:center;page-break-inside:avoid;}'+
      '.k img{width:100%;max-width:44mm;image-rendering:pixelated;}'+
      '.k .n{font-family:"Bodoni Moda",Georgia,serif;font-size:19pt;margin-top:3mm;}'+
      '.k .s{font-size:8pt;color:#8A8680;margin-top:1mm;letter-spacing:.02em;}'+
      '@media print{.noprint{display:none;}}'+
      '</style></head><body><button class="noprint" id="tblqrPrint" style="margin-bottom:7mm;padding:9px 18px;border:1px solid #7F1634;background:#7F1634;color:#fff;border-radius:8px;font:inherit;cursor:pointer;">'+esc(T('tblqr.printknop','Printen'))+'</button>'+
      '<h1>'+esc(naam)+'</h1><div class="g">'+kaarten+'</div></body></html>');
    w.document.close();
    /* De knop krijgt hier een listener, en de handler staat NIET in het
       HTML-attribuut. Een venster uit window.open('') erft de CSP van deze
       pagina, en die staat geen handler in een attribuut toe. Zo stond het hier
       wel, en dus deed de printknop niets: het blad zag er goed uit, alleen
       printen gebeurde niet. (De naam van dat attribuut staat hier ook niet
       uitgeschreven: de toets in test/blindevlek.test.js zoekt op het patroon
       en kan niet zien dat dit een opmerking is.) */
    try {
      var pk = w.document.getElementById('tblqrPrint');
      if (pk) pk.addEventListener('click', function () { w.print(); });
    } catch (e) { /* venster al gesloten */ }
  }
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-tblqr]'); if (b) printTafelQRs(); });
  /* ================= winkelvloer + zorgbalie in de zaak-app =================
     Dezelfde vloerfuncties als op de personeels-PDA, maar dan in de eigen
     app van de zaak: wie inlogt bij een modehuis krijgt de Winkelvloer als
     app op het springboard, wie inlogt bij een spa of kliniek de Zorgbalie.
     Zo landt elk account vanzelf in de juiste app met de juiste werkvloer. */

  // ---- de winkelvloer: mobiele kassa, voorraad, paskamer, klant erbij ----
  let wvRetail = null;   // vloer-toestand (voorraad, paskamer, apart)
  let wvKlant = null;    // geopend klantdossier
  let wvCart = [];       // bon: [{vsku, naam, kleur, maat, price, aantal}]
  async function laadWinkelvloer(){
    if (!has('retail') || !API.live) return;
    try { wvRetail = (await API.call('/supplier/retail', {})).retail; }
    catch(e){ wvRetail = { artikelen:[], paskamer:[], apart:[], klanten:[], stats:{} }; }
    renderWinkelvloer();
  }
  function wvInput(id, ph){ return '<input id="'+id+'" placeholder="'+ph+'" style="flex:1;background:var(--card2,var(--card));border:1px solid var(--line);border-radius:10px;padding:0.7rem 0.85rem;font-size:0.9rem;color:var(--txt);outline:none;font-family:inherit;">'; }
  function wvKlantKaart(k){
    const maten = Object.entries(k.maten||{}).map(([a,b]) => esc(a)+': '+esc(b)).join(' · ');
    return '<div style="border-top:1px solid var(--line);padding-top:0.6rem;margin-top:0.5rem;">'+
      '<div style="display:flex;justify-content:space-between;"><b>'+esc(k.codenaam||k.key)+'</b><span style="color:var(--gold);">'+eur(k.besteedTotaal)+'</span></div>'+
      '<div style="font-size:0.78rem;color:var(--muted);margin-top:0.25rem;">'+k.aankopen+' '+T('wv.aankopen','aankopen')+(maten?' · '+maten:'')+'</div>'+
      (k.voorkeuren?'<div style="font-size:0.78rem;color:var(--soft);margin-top:0.25rem;">'+esc(k.voorkeuren)+'</div>':'')+
      ((k.wishlist&&k.wishlist.length)?'<div style="font-size:0.78rem;margin-top:0.25rem;">'+k.wishlist.map(w=>esc(w.naam)).join(', ')+'</div>':'')+
      '</div>';
  }
  function renderWinkelvloer(){
    const wrap = $('#wvWrap'); if (!wrap) return;
    if (!has('retail')){ wrap.innerHTML = ''; return; }
    if (!wvRetail){ wrap.innerHTML = '<div class="empty">…</div>'; laadWinkelvloer(); return; }
    const cartTot = wvCart.reduce((n, r) => n + r.price * r.aantal, 0);
    let html = '';
    html += '<div class="card"><div class="tt-h" style="display:flex;justify-content:space-between;align-items:center;">'+T('wv.kassa','Mobiele kassa')+
      (wvKlant?'<span style="color:var(--gold);font-size:0.7rem;">'+esc(wvKlant.codenaam||wvKlant.key)+'</span>':'')+'</div>'+
      (wvCart.length ? '<div class="h-mt50">'+wvCart.map((r,i) =>
        '<div class="mitem"><div class="r1"><span class="nm">'+esc(r.naam)+' · '+esc(r.kleur)+' · '+esc(r.maat)+'</span><span class="pr">'+eur(r.price)+' × '+r.aantal+'</span></div>'+
        '<button class="obtn" data-wvdel="'+i+'" class="h-mt30">✕ '+T('wv.weg','Weg')+'</button></div>').join('')+
        '<div style="display:flex;justify-content:space-between;font-weight:700;margin-top:0.5rem;"><span>'+T('wv.totaal','Totaal')+'</span><span>'+eur(cartTot)+'</span></div>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;flex-wrap:wrap;"><button class="obtn primary" data-wvbetaal="rtgpay">RTG Pay</button>'+
        '<button class="obtn" data-wvbetaal="contant">'+T('wv.contant','Contant')+'</button>'+
        '<button class="obtn" id="wvLeeg">'+T('wv.leeg','Bon leegmaken')+'</button></div>'
        : '<div class="empty">'+T('wv.leegbon','Zoek een artikel en tik + om het op de bon te zetten.')+'</div>')+'</div>';
    html += '<div class="card"><div class="tt-h">'+T('wv.zoek','Voorraad opzoeken')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;">'+wvInput('wvZoek', T('wv.zoekph','Naam, kleur of maat…'))+'<button class="obtn primary" id="wvZoekBtn">'+T('wv.zoekbtn','Zoek')+'</button></div>'+
      '<div id="wvZoekUit" class="h-mt50"></div></div>';
