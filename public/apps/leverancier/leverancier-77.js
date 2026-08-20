/* de paskamerverzoeken van een retailzaak */
    const pk = wvRetail.paskamer || [];
    html += '<div class="card"><div class="tt-h">'+T('wv.paskamer','Paskamerverzoeken')+' ('+pk.length+')</div>'+
      (pk.length ? pk.map(v => '<div class="mitem"><div class="r1"><span class="nm">'+esc(v.artikelNaam)+' · '+esc(v.maat)+'</span></div>'+
        '<div class="ds">'+esc(v.codenaam||'Gast')+' · '+esc(v.kleur)+(v.paskamer?' · '+esc(v.paskamer):'')+'</div>'+
        '<button class="obtn primary" data-wvbreng="'+v.id+'" class="h-mt35">'+T('wv.breng','Gebracht')+'</button></div>').join('')
        : '<div class="empty">'+T('wv.geenpk','Geen open verzoeken.')+'</div>')+'</div>';
    const ap = wvRetail.apart || [];
    if (ap.length) html += '<div class="card"><div class="tt-h">'+T('wv.apart','Apart gelegd')+' ('+ap.length+')</div>'+
      ap.map(r => '<div class="mitem"><div class="r1"><span class="nm">'+esc(r.artikelNaam)+' · '+esc(r.maat)+'</span></div><div class="ds">'+esc(r.codenaam||r.key)+' · '+T('wv.tot','tot')+' '+esc(r.tot)+'</div></div>').join('')+'</div>';
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
        toast(''+T('wv.verkocht','Verkocht')+' · '+eur(r.sale.total));
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
          '<div class="mitem"><div class="r1"><span class="nm">'+(v.voorraad>0?'':'')+' '+esc(v.artikel)+'</span><span class="pr">'+eur(v.price)+'</span></div>'+
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
    const zi = wrap.querySelector('#wvZoek'); if (zi) zi.addEventListener('keydown', e => { if (e.key === 'Enter') doeZoek(); });
    wrap.querySelectorAll('[data-wvbreng]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/retail/paskamer/breng', { id: b.dataset.wvbreng }); toast(T('wv.gebracht','Gebracht.')); await laadWinkelvloer(); } catch(e){ toast(e.message); }
    }));
    const kb = wrap.querySelector('#wvKlantBtn');
    const openKlant = async () => {
      const key = wrap.querySelector('#wvKlantKey').value.trim(); if (!key) return;
      try { wvKlant = (await API.call('/supplier/retail/klant', { key })).klant; renderWinkelvloer(); }
      catch(e){ toast(e.message); }
    };
    if (kb) kb.addEventListener('click', openKlant);
    const ki = wrap.querySelector('#wvKlantKey'); if (ki) ki.addEventListener('keydown', e => { if (e.key === 'Enter') openKlant(); });
  }

  // ---- de zorgbalie: de behandelaar-agenda van een spa of kliniek ----
  let zbLev = null, zbLevDatum = null;
  async function laadZorgbalieLev(){
    if (!has('care') || !API.live) return;
    try { zbLev = await API.call('/supplier/care/agenda', zbLevDatum ? { datum: zbLevDatum } : {}); }
    catch(e){ zbLev = null; }
    renderZorgbalieLev();
  }
  function renderZorgbalieLev(){
    const wrap = $('#zbWrap'); if (!wrap) return;
    if (!has('care')){ wrap.innerHTML = ''; return; }
    if (!zbLev){ wrap.innerHTML = '<div class="empty">…</div>'; laadZorgbalieLev(); return; }
    const dagen = [];
    for (let i = 0; i < 7; i++){
      const dt = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
      const aan = dt === zbLev.datum;
      dagen.push('<button class="obtn'+(aan?' primary':'')+'" data-zblevdag="'+dt+'"'+(aan?' aria-current="date"':'')+'>'+
        (i===0 ? T('zb.vandaag','vandaag') : dt.slice(8)+'/'+dt.slice(5,7))+'</button>');
    }
    const perBehandelaar = (zbLev.behandelaars || []).map(b => {
      const eigen = (zbLev.afspraken || []).filter(a => a.behandelaarId === b.id);
      return '<div class="card"><div class="tt-h">'+esc(b.naam)+' · '+esc(b.functie)+'</div>'+
        (eigen.length ? eigen.map(a =>
          '<div class="mitem"><div class="r1"><span class="nm" style="font-variant-numeric:tabular-nums;">'+(a.soort==='medisch'?'':'')+' '+esc(a.tijd)+' · '+esc(a.behandelingNaam)+'</span><span class="pr">'+eur(a.prijs)+'</span></div>'+
          '<div class="ds">'+T('zb.gast','Gast')+': '+esc(a.codenaam || '')+' · '+a.duurMin+' min</div>'+
          (a.zorg ? '<div class="ds" style="color:#E2B93B;">'+esc([((a.zorg.allergenen||[]).length?T('zb.allergie','Allergie')+': '+a.zorg.allergenen.join(', '):''), a.zorg.dieet, a.zorg.medisch].filter(Boolean).join(' · '))+'</div>' : '')+
          (a.intake ? '<div class="ds" style="color:#E2B93B;">'+esc(a.intake)+'</div>' : '')+
          (a.status === 'afgerond' ? '<div class="ds" style="color:var(--rtg-leesgroen,var(--green,#4C9A75));">'+T('zb.klaar','Afgerond')+'</div>'
            : '<button class="obtn primary" data-zblevklaar="'+esc(a.ref)+'" class="h-mt35">'+T('zb.afronden','Afronden')+'</button>')+
          '</div>').join('')
        : '<div class="empty">'+T('zb.leeg','Geen afspraken op deze dag.')+'</div>')+
      '</div>';
    }).join('');
    wrap.innerHTML = '<div class="card"><div class="tt-h">'+esc(zbLev.aanbieder || '')+'</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.55rem;">'+dagen.join('')+'</div></div>' + perBehandelaar;
    wrap.querySelectorAll('[data-zblevdag]').forEach(b => b.addEventListener('click', () => { zbLevDatum = b.dataset.zblevdag; laadZorgbalieLev(); }));
    wrap.querySelectorAll('[data-zblevklaar]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/care/afronden', { ref: b.dataset.zblevklaar }); toast(''+T('zb.klaar','Afgerond')); laadZorgbalieLev(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- ID-/leeftijdscheck met het Zegel ----------
     De zaak scant het Zegel van een lid en verifieert het HIER, op het toestel,
     met de publieke sleutel van RTG -- offline. Groen betekent: RTG staat met de
     handtekening garant dat het paspoort is gezien; de partner leert enkel het
     bewezen feit (18+, lid, welke pas), nooit de naam. De controle wordt ook op
     de server gelogd als officiele ID-check. */
  function zcStijlEenmalig(){
    if (document.getElementById('rtg-zc-stijl')) return;
