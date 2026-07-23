      if (body.method === 'rtgpay'){
        // tap to pay als het kan, met altijd de uitweg om de code te typen
        let code = null;
        if (window.TapPay && TapPay.kan() && window.confirm(T('pd.w.tapkeuze','Tap to pay: de klant tikt zijn toestel hiertegen. Liever de code typen (bijv. als NFC niet werkt)? Kies dan Annuleren.'))){
          toast(''+T('pd.w.tap','Tap to pay: laat de klant het toestel hiertegen houden...'));
          code = await TapPay.lees(12000);
          if (!code) toast(T('pd.w.tapmis','Geen tik ontvangen; typ de code van de klant.'));
        }
        if (!code){
          const c = window.prompt(T('pd.w.paycode','Betaalcode van de klant (uit de app):'));
          if (!c) return;
          code = c.trim().toUpperCase();
        }
        body.payCode = code;
      }
      if (winkelKlant) body.klantKey = winkelKlant.key;
      try {
        const r = await API.call('/supplier/retail/verkoop', body);
        toast(''+T('pd.w.verkocht','Verkocht')+' · '+eur(r.sale.total));
        winkelCart = [];
        if (winkelKlant){ try { winkelKlant = (await API.call('/supplier/retail/klant', { key: winkelKlant.key })).klant; } catch(e){} }
        await laadWinkel();
      } catch(e){ toast(e.message); }
    }));
    // zoeken
    const doeZoek = async () => {
      const uit = wrap.querySelector('#wZoekUit');
      try {
        const r = await API.call('/supplier/retail/zoek', { q: wrap.querySelector('#wZoek').value });
        uit.innerHTML = r.resultaten.length ? r.resultaten.map(v =>
          '<div class="task"><span class="ic">'+(v.voorraad>0?'':'')+'</span><div class="t"><b>'+esc(v.artikel)+'</b><span>'+esc(v.kleur)+' · '+esc(v.maat)+' · '+eur(v.price)+' · '+T('pd.w.voorraad','voorraad')+' '+v.voorraad+'</span></div>'+
          '<div style="display:flex;gap:0.3rem;">'+
          (v.voorraad>0?'<button class="abtn" data-wadd="'+esc(v.vsku)+'" data-wnaam="'+esc(v.artikel)+'" data-wkleur="'+esc(v.kleur)+'" data-wmaat="'+esc(v.maat)+'" data-wprice="'+v.price+'">+</button>':'')+
          (v.voorraad>0?'<button class="abtn ghost" data-wapart="'+esc(v.vsku)+'">'+T('pd.w.legapart','Apart')+'</button>':'')+
          '</div></div>').join('') : '<div style="font-size:0.8rem;color:var(--soft);">'+T('pd.w.niets','Niets gevonden.')+'</div>';
        // knoppen in de resultaten binden
        uit.querySelectorAll('[data-wadd]').forEach(b => b.addEventListener('click', () => {
          const bestaand = winkelCart.find(r => r.vsku === b.dataset.wadd);
          if (bestaand) bestaand.aantal++;
          else winkelCart.push({ vsku: b.dataset.wadd, naam: b.dataset.wnaam, kleur: b.dataset.wkleur, maat: b.dataset.wmaat, price: Number(b.dataset.wprice), aantal: 1 });
          renderWinkel();
        }));
        uit.querySelectorAll('[data-wapart]').forEach(b => b.addEventListener('click', async () => {
          if (!winkelKlant) return toast(T('pd.w.eerstklant','Pak eerst een klant erbij.'));
          try { await API.call('/supplier/retail/apart', { key: winkelKlant.key, vsku: b.dataset.wapart }); toast(T('pd.w.apartok','Apart gelegd voor de klant.')); await laadWinkel(); } catch(e){ toast(e.message); }
        }));
      } catch(e){ toast(e.message); }
    };
    const zb = wrap.querySelector('#wZoekBtn'); if (zb) zb.addEventListener('click', doeZoek);
    const zi = wrap.querySelector('#wZoek'); if (zi) zi.addEventListener('keydown', e => { if (e.key === 'Enter') doeZoek(); });
    // paskamer gebracht
    wrap.querySelectorAll('[data-wbreng]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/retail/paskamer/breng', { id: b.dataset.wbreng }); toast(T('pd.w.gebracht','Gebracht.')); await laadWinkel(); } catch(e){ toast(e.message); }
    }));
    // klant openen
    const kb = wrap.querySelector('#wKlantBtn');
    const openKlant = async () => {
      const key = wrap.querySelector('#wKlantKey').value.trim(); if (!key) return;
      try { winkelKlant = (await API.call('/supplier/retail/klant', { key })).klant; renderWinkel(); }
      catch(e){ toast(e.message); }
    };
    if (kb) kb.addEventListener('click', openKlant);
    const ki = wrap.querySelector('#wKlantKey'); if (ki) ki.addEventListener('keydown', e => { if (e.key === 'Enter') openKlant(); });
  }

  // ---- op het land (boerderij): de knecht doet de taken van vandaag ----
  let pdBoer = null;
  const heeftBoer = () => !!(state && state.supplier && (state.supplier.caps || []).includes('boerderij'));
  async function laadBoer(){
    if (!heeftBoer()) return;
    try { pdBoer = (await API.call('/supplier/boerderij/overzicht', {})); } catch(e){ pdBoer = null; }
    renderBoer();
  }
  function boerPdaToe(r){ if (r && r.overzicht) pdBoer = r.overzicht; renderBoer(); }
  function renderBoer(){
    const tabBtn = document.getElementById('tabBoer');
    if (tabBtn) tabBtn.style.display = heeftBoer() ? '' : 'none';
    const wrap = $('#boerPdaWrap'); if (!wrap) return;
    if (!heeftBoer()){ wrap.innerHTML = ''; return; }
    if (!pdBoer){ wrap.innerHTML = '<div class="card">…</div>'; laadBoer(); return; }
    const o = pdBoer, vandaag = new Date().toISOString().slice(0,10);
    let html = '';
    // Vandaag-briefing (leesbaar samengevat voor de knecht)
    const br = o.briefing || { punten:[] };
    html += '<div class="card"><div class="k">'+T('pd.boer.vandaag','Vandaag op het land')+'</div>'+
      (br.punten.length ? br.punten.map(p => '<div class="task"><span class="ic">'+(p.soort==='oogst'?'':p.soort==='voer'?'':p.soort==='water'?'':p.soort==='gezondheid'?'':'')+'</span><div class="t"><b>'+esc(p.tekst)+'</b></div></div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.boer.rustig','Niets dringends. Fijne dag.')+'</div>')+'</div>';
    // Taken van vandaag / open
    const open = (o.taken||[]).filter(t => !t.klaar);
    html += '<div class="card"><div class="k">'+T('pd.boer.taken','Taken')+' ('+open.length+')</div>'+
      (open.length ? open.map(t => '<div class="task"><span class="ic">'+((t.voor&&t.voor<vandaag)?'':'')+'</span><div class="t"><b>'+esc(t.wat)+'</b><span>'+(t.waar?''+esc(t.waar):'')+(t.voor?' · '+esc(t.voor):'')+'</span></div><button class="abtn" data-btaak="'+t.id+'">'+T('pd.boer.klaar','Klaar')+'</button></div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.boer.geentaak','Geen open taken.')+'</div>')+'</div>';
    // Percelen: oogsten en water geven
    const perc = (o.percelen||[]).filter(p => p.gewasLabel && p.fase !== 'geoogst');
    if (perc.length) html += '<div class="card"><div class="k">'+T('pd.boer.perc','Percelen')+'</div>'+
      perc.map(p => '<div class="task"><span class="ic">'+(p.fase==='te-oogsten'?'':'')+'</span><div class="t"><b>'+esc(p.naam)+' · '+esc(p.gewasLabel)+'</b><span>'+(p.fase==='te-oogsten'?T('pd.boer.oogstklaar','oogstklaar'):(p.restDagen+' '+T('pd.boer.dgn','dagen tot oogst')))+'</span></div>'+
        (p.fase==='te-oogsten' ? '<button class="abtn" data-boogst="'+p.id+'">'+T('pd.boer.oogsten','Oogst')+'</button>' : '<button class="abtn" data-bwater="'+p.id+'" style="background:var(--card2);color:var(--txt);border:1px solid var(--line);"></button>')+'</div>').join('')+'</div>';
    // Dieren: voeren
    const dr = (o.dieren||[]);
