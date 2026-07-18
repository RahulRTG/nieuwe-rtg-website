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
      '<div style="font-size:0.78rem;color:var(--muted);margin-top:0.2rem;">'+k.aankopen+' '+T('wv.aankopen','aankopen')+(maten?' · '+maten:'')+'</div>'+
      (k.voorkeuren?'<div style="font-size:0.78rem;color:var(--soft);margin-top:0.2rem;">'+esc(k.voorkeuren)+'</div>':'')+
      ((k.wishlist&&k.wishlist.length)?'<div style="font-size:0.78rem;margin-top:0.35rem;">💛 '+k.wishlist.map(w=>esc(w.naam)).join(', ')+'</div>':'')+
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
      (wvCart.length ? '<div style="margin-top:0.5rem;">'+wvCart.map((r,i) =>
        '<div class="mitem"><div class="r1"><span class="nm">'+esc(r.naam)+' · '+esc(r.kleur)+' · '+esc(r.maat)+'</span><span class="pr">'+eur(r.price)+' × '+r.aantal+'</span></div>'+
        '<button class="obtn" data-wvdel="'+i+'" style="margin-top:0.3rem;">✕ '+T('wv.weg','Weg')+'</button></div>').join('')+
        '<div style="display:flex;justify-content:space-between;font-weight:700;margin-top:0.6rem;"><span>'+T('wv.totaal','Totaal')+'</span><span>'+eur(cartTot)+'</span></div>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;flex-wrap:wrap;"><button class="obtn primary" data-wvbetaal="rtgpay">RTG Pay</button>'+
        '<button class="obtn" data-wvbetaal="contant">'+T('wv.contant','Contant')+'</button>'+
        '<button class="obtn" id="wvLeeg">'+T('wv.leeg','Bon leegmaken')+'</button></div>'
        : '<div class="empty">'+T('wv.leegbon','Zoek een artikel en tik + om het op de bon te zetten.')+'</div>')+'</div>';
    html += '<div class="card"><div class="tt-h">'+T('wv.zoek','Voorraad opzoeken')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.55rem;">'+wvInput('wvZoek', T('wv.zoekph','Naam, kleur of maat…'))+'<button class="obtn primary" id="wvZoekBtn">'+T('wv.zoekbtn','Zoek')+'</button></div>'+
      '<div id="wvZoekUit" style="margin-top:0.5rem;"></div></div>';
    const pk = wvRetail.paskamer || [];
    html += '<div class="card"><div class="tt-h">'+T('wv.paskamer','Paskamerverzoeken')+' ('+pk.length+')</div>'+
      (pk.length ? pk.map(v => '<div class="mitem"><div class="r1"><span class="nm">🚪 '+esc(v.artikelNaam)+' · '+esc(v.maat)+'</span></div>'+
        '<div class="ds">'+esc(v.codenaam||'Gast')+' · '+esc(v.kleur)+(v.paskamer?' · '+esc(v.paskamer):'')+'</div>'+
        '<button class="obtn primary" data-wvbreng="'+v.id+'" style="margin-top:0.35rem;">'+T('wv.breng','Gebracht')+'</button></div>').join('')
        : '<div class="empty">'+T('wv.geenpk','Geen open verzoeken.')+'</div>')+'</div>';
    const ap = wvRetail.apart || [];
    if (ap.length) html += '<div class="card"><div class="tt-h">'+T('wv.apart','Apart gelegd')+' ('+ap.length+')</div>'+
      ap.map(r => '<div class="mitem"><div class="r1"><span class="nm">🛍 '+esc(r.artikelNaam)+' · '+esc(r.maat)+'</span></div><div class="ds">'+esc(r.codenaam||r.key)+' · '+T('wv.tot','tot')+' '+esc(r.tot)+'</div></div>').join('')+'</div>';
    html += '<div class="card"><div class="tt-h">'+T('wv.klant','Klant erbij pakken')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.55rem;">'+wvInput('wvKlantKey', T('wv.klantph','Codenaam of sleutel van het lid'))+'<button class="obtn primary" id="wvKlantBtn">'+T('wv.open','Open')+'</button></div>'+
      '<div id="wvKlantUit">'+(wvKlant?wvKlantKaart(wvKlant):'')+'</div></div>';
    wrap.innerHTML = html;
    wvBind(wrap);
  }
  function wvBind(wrap){
    wrap.querySelectorAll('[data-wvdel]').forEach(b => b.addEventListener('click', () => { wvCart.splice(Number(b.dataset.wvdel), 1); renderWinkelvloer(); }));
    const leeg = wrap.querySelector('#wvLeeg'); if (leeg) leeg.addEventListener('click', () => { wvCart = []; renderWinkelvloer(); });
    wrap.querySelectorAll('[data-wvbetaal]').forEach(b => b.addEventListener('click', async () => {
      if (!wvCart.length) return;
      const body = { method: b.dataset.wvbetaal, regels: wvCart.map(r => ({ vsku: r.vsku, aantal: r.aantal })) };
      if (body.method === 'rtgpay'){
        const c = window.prompt(T('wv.paycode','Betaalcode van de klant (uit de app):'));
        if (!c) return;
        body.payCode = c.trim().toUpperCase();
      }
      if (wvKlant) body.klantKey = wvKlant.key;
      try {
        const r = await API.call('/supplier/retail/verkoop', body);
        toast('✅ '+T('wv.verkocht','Verkocht')+' · '+eur(r.sale.total));
        wvCart = [];
        if (wvKlant){ try { wvKlant = (await API.call('/supplier/retail/klant', { key: wvKlant.key })).klant; } catch(e){} }
        await laadWinkelvloer();
      } catch(e){ toast(e.message); }
    }));
    const doeZoek = async () => {
      const uit = wrap.querySelector('#wvZoekUit');
      try {
        const r = await API.call('/supplier/retail/zoek', { q: wrap.querySelector('#wvZoek').value });
        uit.innerHTML = r.resultaten.length ? r.resultaten.map(v =>
          '<div class="mitem"><div class="r1"><span class="nm">'+(v.voorraad>0?'👕':'🚫')+' '+esc(v.artikel)+'</span><span class="pr">'+eur(v.price)+'</span></div>'+
          '<div class="ds">'+esc(v.kleur)+' · '+esc(v.maat)+' · '+T('wv.voorraad','voorraad')+' '+v.voorraad+'</div>'+
          (v.voorraad>0?'<div style="display:flex;gap:0.35rem;margin-top:0.35rem;"><button class="obtn primary" data-wvadd="'+esc(v.vsku)+'" data-nm="'+esc(v.artikel)+'" data-kl="'+esc(v.kleur)+'" data-mt="'+esc(v.maat)+'" data-pr="'+v.price+'">+ '+T('wv.opbon','Op de bon')+'</button>'+
          '<button class="obtn" data-wvapart="'+esc(v.vsku)+'">'+T('wv.legapart','Apart')+'</button></div>':'')+'</div>').join('')
          : '<div class="empty">'+T('wv.niets','Niets gevonden.')+'</div>';
        uit.querySelectorAll('[data-wvadd]').forEach(b => b.addEventListener('click', () => {
          const bestaand = wvCart.find(r => r.vsku === b.dataset.wvadd);
          if (bestaand) bestaand.aantal++;
          else wvCart.push({ vsku: b.dataset.wvadd, naam: b.dataset.nm, kleur: b.dataset.kl, maat: b.dataset.mt, price: Number(b.dataset.pr), aantal: 1 });
          renderWinkelvloer();
        }));
        uit.querySelectorAll('[data-wvapart]').forEach(b => b.addEventListener('click', async () => {
          if (!wvKlant) return toast(T('wv.eerstklant','Pak eerst een klant erbij.'));
          try { await API.call('/supplier/retail/apart', { key: wvKlant.key, vsku: b.dataset.wvapart }); toast(T('wv.apartok','Apart gelegd voor de klant.')); await laadWinkelvloer(); } catch(e){ toast(e.message); }
        }));
      } catch(e){ toast(e.message); }
    };
    const zb2 = wrap.querySelector('#wvZoekBtn'); if (zb2) zb2.addEventListener('click', doeZoek);
