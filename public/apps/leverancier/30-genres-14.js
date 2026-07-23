    // assortiment
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('gh.assortiment','Assortiment')+' <button class="js-ghnew" style="float:right;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.25rem 0.6rem;font-size:0.72rem;font-weight:600;font-family:inherit;">+ '+T('gh.nieuw','Nieuw product')+'</button></div>';
    h += '<div id="ghForm"></div>';
    h += '<div style="margin-top:0.5rem;">'+(d.producten||[]).map(p =>
      '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0;border-top:1px solid var(--line);">'+
      '<div style="flex:1;"><b style="font-size:0.85rem;">'+esc(p.naam)+'</b><span class="sub"> · '+esc(p.categorie)+' · '+T('gh.per','per')+' '+esc(p.eenheid)+'</span>'+
      '<div class="sub">'+T('gh.inkoop','inkoop')+' '+eur(p.inkoopPrijs)+' · '+T('gh.consument','consument')+' '+eur(p.consumentPrijs)+' · '+T('gh.voorraad','voorraad')+' '+p.voorraad+(p.actief?'':' · <span style="color:var(--gold);">'+T('gh.uit','uit')+'</span>')+'</div></div>'+
      '<button class="js-ghedit" data-id="'+p.id+'" style="background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:0.3rem 0.6rem;color:var(--txt);font-size:0.72rem;font-family:inherit;">'+T('gh.bewerk','Bewerk')+'</button></div>').join('');
    el.innerHTML = h;
    wireFuncBlok(el);
    el.querySelectorAll('.js-ghf').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/groothandel/functie', { id:b.dataset.id, aan: b.dataset.aan!=='true' }); renderGroothandel(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ghverder]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/groothandel/order/status', { ref:b.dataset.ghverder, actie:'verder' }); renderGroothandel(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ghweiger]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/groothandel/order/status', { ref:b.dataset.ghweiger, actie:'weiger' }); renderGroothandel(); } catch(e){ toast(e.message); }
    }));
    const nw = el.querySelector('.js-ghnew'); if (nw) nw.addEventListener('click', () => { ghEdit = { }; ghForm(cats); });
    el.querySelectorAll('.js-ghedit').forEach(b => b.addEventListener('click', () => { ghEdit = (d.producten||[]).find(p=>p.id===b.dataset.id) || {}; ghForm(cats); }));
    if (ghEdit) ghForm(cats);
  }
  function ghOrderKaart(o, open){
    const naam = o.klant ? (o.klant.naam || '') : '';
    return '<div style="border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.85rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;"><b style="flex:1;font-size:0.85rem;">'+esc(naam)+' · '+eur(o.subtotaal)+'</b>'+
      '<span class="sub">'+esc(o.soort)+(o.bron==='ai'?' · AI':'')+' · '+esc(o.status)+'</span></div>'+
      '<div class="sub">'+o.regels.map(r=>r.aantal+'× '+esc(r.naam)).join(', ')+'</div>'+
      (open ? '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><button data-ghverder="'+o.ref+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('gh.verder','Volgende stap')+'</button>'+
        '<button data-ghweiger="'+o.ref+'" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--soft);font-family:inherit;font-size:0.75rem;">'+T('gh.weiger','Weiger')+'</button></div>' : '')+'</div>';
  }
  function ghForm(cats){
    const el = $('#ghForm'); if (!el) return; const p = ghEdit || {};
    el.innerHTML = '<div style="border:1px solid var(--gold);border-radius:12px;padding:0.8rem;margin-top:0.5rem;">'+
      '<input id="ghNaam" class="st-in" placeholder="'+T('gh.f.naam','Productnaam')+'" value="'+esc(p.naam||'')+'" style="width:100%;margin-bottom:0.4rem;">'+
      '<div class="row-gap"><select id="ghCat" class="st-in" style="flex:1;">'+cats.map(c=>'<option'+(p.categorie===c?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+
      '<input id="ghEen" class="st-in" placeholder="'+T('gh.f.eenheid','Eenheid')+'" value="'+esc(p.eenheid||'stuk')+'" style="flex:1;"></div>'+
      '<div class="row-gap"><input id="ghIn" class="st-in" type="number" step="0.01" placeholder="'+T('gh.f.inkoop','Inkoopprijs')+'" value="'+(p.inkoopPrijs!=null?p.inkoopPrijs:'')+'" style="flex:1;"><input id="ghCon" class="st-in" type="number" step="0.01" placeholder="'+T('gh.f.consument','Consumentprijs')+'" value="'+(p.consumentPrijs!=null?p.consumentPrijs:'')+'" style="flex:1;"></div>'+
      '<div class="row-gap"><input id="ghVoor" class="st-in" type="number" placeholder="'+T('gh.f.voorraad','Voorraad')+'" value="'+(p.voorraad!=null?p.voorraad:'')+'" style="flex:1;"><input id="ghMin" class="st-in" type="number" placeholder="'+T('gh.f.min','Min. bestel')+'" value="'+(p.minBestel!=null?p.minBestel:1)+'" style="flex:1;"></div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><button id="ghSave" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('gh.opslaan','Opslaan')+'</button>'+
      '<button id="ghCancel" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.45rem 0.8rem;color:var(--soft);font-family:inherit;">'+T('gh.annuleer','Annuleer')+'</button></div></div>';
    $('#ghCancel').addEventListener('click', () => { ghEdit = null; renderGroothandel(); });
    $('#ghSave').addEventListener('click', async () => {
      const body = { id:p.id, naam:$('#ghNaam').value.trim(), categorie:$('#ghCat').value, eenheid:$('#ghEen').value.trim(),
        inkoopPrijs:$('#ghIn').value, consumentPrijs:$('#ghCon').value, voorraad:$('#ghVoor').value, minBestel:$('#ghMin').value };
      try { await API.call('/supplier/groothandel/product', body); ghEdit = null; toast(T('gh.opgeslagen','Product opgeslagen.')); renderGroothandel(); } catch(e){ toast(e.message); }
    });
  }

  // ---- inkoop: een horecazaak koopt in bij een groothandel (met AI-bijbestellen) ----
  let inkVoorstel = null;
  async function renderInkoop(){
    const el = $('#inkoopWrap'); if (!el) return;
    if (!has('menu')){ el.innerHTML = ''; return; }
    let markt, mijn;
    try { markt = await API.call('/supplier/inkoop/markt'); mijn = await API.call('/supplier/inkoop/mijn'); } catch(e){ return; }
    let h = '';
    for (const g of (markt.groothandels||[])){
      h += '<div style="border:1px solid var(--line);border-radius:14px;padding:0.85rem;margin-bottom:0.8rem;">'+
        '<div style="display:flex;gap:0.5rem;align-items:center;"><b style="flex:1;">'+esc(g.naam)+'</b>'+
        '<button class="js-inkai" data-code="'+g.code+'" style="background:var(--card2);border:1px solid var(--gold);border-radius:8px;padding:0.3rem 0.6rem;color:var(--gold);font-size:0.72rem;font-weight:600;font-family:inherit;">'+T('ink.ai','AI-bijbestellen')+'</button></div>'+
        '<div id="inkai-'+g.code+'"></div>'+
        g.producten.slice(0,60).map(p => '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-top:1px solid var(--line);">'+
          '<div style="flex:1;"><span style="font-size:0.83rem;">'+esc(p.naam)+'</span><span class="sub"> · '+eur(p.prijs)+'/'+esc(p.eenheid)+'</span></div>'+
          '<input class="st-in js-inkq" data-code="'+g.code+'" data-pid="'+p.id+'" type="number" min="0" placeholder="0" style="width:4rem;text-align:center;"></div>').join('')+
        '<button class="js-inkbestel" data-code="'+g.code+'" style="width:100%;margin-top:0.5rem;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.5rem;font-weight:600;font-family:inherit;">'+T('ink.bestel','Bestellen')+'</button></div>';
    }
    if (!(markt.groothandels||[]).length) h += '<p class="sub">'+T('ink.geen','Geen groothandel beschikbaar voor inkoop.')+'</p>';
    // mijn bestellingen
    if ((mijn.bestellingen||[]).length){
      h += '<div class="st-sec">'+T('ink.mijn','Mijn inkooporders')+'</div>';
      h += mijn.bestellingen.slice(0,20).map(o => '<div style="border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.75rem;margin-bottom:0.4rem;"><div style="display:flex;gap:0.5rem;"><b style="flex:1;font-size:0.82rem;">'+esc(o.groothandelNaam)+' · '+eur(o.subtotaal)+'</b><span class="sub">'+esc(o.status)+(o.bron==='ai'?' · AI':'')+'</span></div><div class="sub">'+o.regels.map(r=>r.aantal+'× '+esc(r.naam)).join(', ')+'</div></div>').join('');
    }
    el.innerHTML = h;
    el.querySelectorAll('.js-inkbestel').forEach(b => b.addEventListener('click', () => inkBestel(b.dataset.code, false)));
    el.querySelectorAll('.js-inkai').forEach(b => b.addEventListener('click', () => inkAi(b.dataset.code)));
  }
  function inkRegels(code){
    const regels = [];
    document.querySelectorAll('.js-inkq[data-code="'+code+'"]').forEach(inp => { const a = Number(inp.value)||0; if (a>0) regels.push({ productId: inp.dataset.pid, aantal: a }); });
    return regels;
  }
  async function inkBestel(code){
    const regels = inkRegels(code);
