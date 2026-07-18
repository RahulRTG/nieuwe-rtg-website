    const lijnBtn = wrap.querySelector('[data-pklijn]'); if (lijnBtn) lijnBtn.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/lijn', { sectie: pdaKant }); toast(d.aangemeld ? '👥 '+T('lijn.aant','Aangemeld op deze kant.') : T('lijn.aftoast','Afgemeld van deze kant.')); await refresh(); openTab('keuken'); } catch(e){ toast(e.message); }
    });
    // de gekozen personen: pas-meldingen (tril + toast) per toestel aan of uit
    const bel = wrap.querySelector('[data-pkbel]'); if (bel) bel.addEventListener('click', () => {
      pdaPasBel = !pdaPasBel;
      try { localStorage.setItem('rtg_pda_pasbel', pdaPasBel ? 'aan' : 'uit'); } catch(e){}
      toast(pdaPasBel ? '🔔 '+T('pd.k.belaan','Dit toestel krijgt pas-meldingen.') : '🔕 '+T('pd.k.beluit','Pas-meldingen staan uit op dit toestel.'));
      renderKeuken();
    });
    wrap.querySelectorAll('[data-pkgo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/sectie', { ref: b.dataset.pkgo, sectie: pdaKant, phase: b.dataset.phase }); toast(b.dataset.phase==='klaar'?T('pd.k.klaar','Kant klaargemeld; het keukenscherm ziet het direct.'):T('pd.k.gestart','Gestart.')); await refresh(); openTab('keuken'); } catch(e){ toast(e.message); }
    }));
    // de barkant meldt via het station, precies zoals het grote barscherm
    wrap.querySelectorAll('[data-pkbar]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/station', { ref: b.dataset.pkbar, station: 'bar', phase: b.dataset.phase }); toast(b.dataset.phase==='klaar'?T('pd.b.klaar','Drankjes klaargemeld; de bediening ziet het direct.'):T('pd.k.gestart','Gestart.')); await refresh(); openTab('keuken'); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-pkdish]').forEach(d => d.addEventListener('click', async () => {
      // gerechtenkennis op zak: tik op het gerecht voor de bereidingswijze
      const open = d.nextElementSibling && d.nextElementSibling.classList.contains('pk-kennis');
      wrap.querySelectorAll('.pk-kennis').forEach(x => x.remove());
      if (open) return;
      const div = document.createElement('div');
      div.className = 'pk-kennis';
      div.style.cssText = 'white-space:pre-line;font-size:0.78rem;color:var(--soft);background:var(--card2,#191715);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.75rem;margin:0.25rem 0 0.4rem;line-height:1.55;';
      div.textContent = T('ds.laden','De AI-chef schrijft...');
      d.insertAdjacentElement('afterend', div);
      try { const k = await API.call('/supplier/menu/kennis', { itemId: d.dataset.pkdish, soort: 'bereiding' }); div.textContent = k.tekst; } catch(e){ div.textContent = e.message; }
    }));
  }

  /* ---- entree: programma van vandaag + check-in op eigen naam ---- */
  let pdProgramma = null;
  let pdVkLaatst = ''; // de laatste deurverkoop (de entreecode blijft leesbaar na verversen)
  // ---- winkelvloer (retail) ----
  let pdRetail = null;      // retail-toestand van het merk (voorraad, paskamer, apart)
  let winkelKlant = null;   // geopend klantdossier op de vloer
  let winkelCart = [];      // mobiele kassa: [{vsku, naam, kleur, maat, price, aantal}]
  const heeftRetail = () => !!(state && state.supplier && (state.supplier.caps || []).includes('retail'));
  async function laadWinkel(){
    if (!heeftRetail()) return;
    try { pdRetail = (await API.call('/supplier/retail', {})).retail; } catch(e){ pdRetail = { artikelen:[], paskamer:[], apart:[], klanten:[], stats:{} }; }
    renderWinkel();
  }
  function winkelInput(id, ph){ return '<input id="'+id+'" placeholder="'+ph+'" style="flex:1;background:var(--card2,#191715);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.85rem;font-size:0.95rem;color:var(--txt);outline:none;font-family:inherit;">'; }
  function renderWinkel(){
    const tabBtn = document.getElementById('tabWinkel');
    if (tabBtn) tabBtn.style.display = heeftRetail() ? '' : 'none';
    const wrap = $('#winkelWrap');
    if (!wrap) return;
    if (!heeftRetail()){ wrap.innerHTML = ''; return; }
    if (!pdRetail){ wrap.innerHTML = '<div class="card">…</div>'; laadWinkel(); return; }
    let html = '';
    // mobiele kassa (bon)
    const cartTot = winkelCart.reduce((n, r) => n + r.price * r.aantal, 0);
    html += '<div class="card"><div class="k" style="display:flex;justify-content:space-between;align-items:center;">'+T('pd.w.kassa','Mobiele kassa')+
      (winkelKlant?'<span style="color:var(--gold);font-size:0.66rem;">'+esc(winkelKlant.codenaam||winkelKlant.key)+'</span>':'')+'</div>'+
      (winkelCart.length ? '<div style="margin-top:0.5rem;">'+winkelCart.map((r,i) => '<div class="task"><span class="ic">👕</span><div class="t"><b>'+esc(r.naam)+'</b><span>'+esc(r.kleur)+' · '+esc(r.maat)+' · '+eur(r.price)+' × '+r.aantal+'</span></div><button class="abtn ghost" data-wcartdel="'+i+'">✕</button></div>').join('')+
        '<div style="display:flex;justify-content:space-between;font-weight:700;margin-top:0.6rem;font-size:1rem;"><span>'+T('pd.w.totaal','Totaal')+'</span><span>'+eur(cartTot)+'</span></div>'+
        '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;"><button class="abtn" data-wbetaal="rtgpay" style="flex:1;">RTG Pay</button><button class="abtn" data-wbetaal="contant" style="flex:1;background:var(--card2);color:var(--txt);border:1px solid var(--line);">'+T('pd.w.contant','Contant')+'</button></div>'+
        '<button class="abtn ghost" id="wCartLeeg" style="margin-top:0.5rem;width:100%;">'+T('pd.w.leeg','Bon leegmaken')+'</button></div>'
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.w.leegbon','Zoek een artikel en tik + om het op de bon te zetten.')+'</div>')+'</div>';
    // voorraad opzoeken
    html += '<div class="card"><div class="k">'+T('pd.w.zoek','Voorraad opzoeken')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.55rem;">'+winkelInput('wZoek', T('pd.w.zoekph','Naam, kleur of maat…'))+'<button class="abtn" id="wZoekBtn">'+T('pd.w.zoekbtn','Zoek')+'</button></div>'+
      '<div id="wZoekUit" style="margin-top:0.5rem;"></div></div>';
    // paskamerverzoeken
    const pk = pdRetail.paskamer || [];
    html += '<div class="card"><div class="k">'+T('pd.w.paskamer','Paskamerverzoeken')+' ('+pk.length+')</div>'+
      (pk.length ? pk.map(v => '<div class="task"><span class="ic">🚪</span><div class="t"><b>'+esc(v.artikelNaam)+' · '+esc(v.maat)+'</b><span>'+esc(v.codenaam||'Gast')+' · '+esc(v.kleur)+(v.paskamer?' · '+esc(v.paskamer):'')+'</span></div><button class="abtn" data-wbreng="'+v.id+'">'+T('pd.w.breng','Gebracht')+'</button></div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.w.geenpk','Geen open verzoeken.')+'</div>')+'</div>';
    // apart gelegd
    const ap = pdRetail.apart || [];
    if (ap.length) html += '<div class="card"><div class="k">'+T('pd.w.apart','Apart gelegd')+' ('+ap.length+')</div>'+
      ap.map(r => '<div class="task"><span class="ic">🛍</span><div class="t"><b>'+esc(r.artikelNaam)+' · '+esc(r.maat)+'</b><span>'+esc(r.codenaam||r.key)+' · '+T('pd.w.tot','tot')+' '+esc(r.tot)+'</span></div></div>').join('')+'</div>';
    // klant erbij pakken
    html += '<div class="card"><div class="k">'+T('pd.w.klant','Klant erbij pakken')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.55rem;">'+winkelInput('wKlantKey', T('pd.w.klantph','Codenaam of sleutel van het lid'))+'<button class="abtn" id="wKlantBtn">'+T('pd.w.open','Open')+'</button></div>'+
      '<div id="wKlantUit" style="margin-top:0.5rem;">'+(winkelKlant?winkelKlantKaart(winkelKlant):'')+'</div></div>';
    wrap.innerHTML = html;
    winkelBind(wrap);
  }
  function winkelKlantKaart(k){
    const maten = Object.entries(k.maten||{}).map(([a,b]) => esc(a)+': '+esc(b)).join(' · ');
    return '<div style="border-top:1px solid var(--line);padding-top:0.6rem;">'+
      '<div style="display:flex;justify-content:space-between;"><b>'+esc(k.codenaam||k.key)+'</b><span style="color:var(--gold);">'+eur(k.besteedTotaal)+'</span></div>'+
      '<div style="font-size:0.78rem;color:var(--muted);margin-top:0.2rem;">'+k.aankopen+' '+T('pd.w.aankopen','aankopen')+(maten?' · '+maten:'')+'</div>'+
      (k.voorkeuren?'<div style="font-size:0.78rem;color:var(--soft);margin-top:0.2rem;">'+esc(k.voorkeuren)+'</div>':'')+
      ((k.wishlist&&k.wishlist.length)?'<div style="font-size:0.78rem;color:var(--txt);margin-top:0.35rem;">💛 '+k.wishlist.map(w=>esc(w.naam)).join(', ')+'</div>':'')+
      '</div>';
  }
  function winkelBind(wrap){
    // kassa
    wrap.querySelectorAll('[data-wcartdel]').forEach(b => b.addEventListener('click', () => { winkelCart.splice(Number(b.dataset.wcartdel), 1); renderWinkel(); }));
    const leeg = wrap.querySelector('#wCartLeeg'); if (leeg) leeg.addEventListener('click', () => { winkelCart = []; renderWinkel(); });
    wrap.querySelectorAll('[data-wbetaal]').forEach(b => b.addEventListener('click', async () => {
      if (!winkelCart.length) return;
      const body = { method: b.dataset.wbetaal, regels: winkelCart.map(r => ({ vsku: r.vsku, aantal: r.aantal })) };
