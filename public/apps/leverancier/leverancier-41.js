/* de functies van een groothandel aan- en uitzetten */
    el.querySelectorAll('.js-ghf').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/groothandel/functie', { id:b.dataset.id, aan: b.dataset.aan!=='true' }); renderGroothandel(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ghverder]').forEach(b => b.addEventListener('click', async () => {
      // de stand die op het scherm stond gaat mee: een tweede tik slaat geen stap over
      try { await API.call('/supplier/groothandel/order/status', { ref:b.dataset.ghverder, actie:'verder', van:b.dataset.ghvan }); renderGroothandel(); } catch(e){ toast(e.message); }
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
    return '<div class="s-1aizwhk">'+
      '<div class="s-1x93s7l"><b class="s-1q6kbkp">'+esc(naam)+' · '+eur(o.subtotaal)+'</b>'+
      '<span class="sub">'+esc(o.soort)+(o.bron==='ai'?' · AI':'')+' · '+esc(o.status)+'</span></div>'+
      '<div class="sub">'+o.regels.map(r=>r.aantal+'× '+esc(r.naam)).join(', ')+'</div>'+
      (open ? '<div class="s-1stuony"><button data-ghverder="'+o.ref+'" data-ghvan="'+esc(o.status)+'" class="s-7o62ce">'+T('gh.verder','Volgende stap')+'</button>'+
        '<button data-ghweiger="'+o.ref+'" class="s-1gth2jo">'+T('gh.weiger','Weiger')+'</button></div>' : '')+'</div>';
  }
  function ghForm(cats){
    const el = $('#ghForm'); if (!el) return; const p = ghEdit || {};
    el.innerHTML = '<div class="s-1ejt61w">'+
      '<input id="ghNaam" class="st-in s-1j59oiv" placeholder="'+T('gh.f.naam','Productnaam')+'" value="'+esc(p.naam||'')+'">'+
      '<div class="row-gap"><select id="ghCat" class="st-in h-flex1">'+cats.map(c=>'<option'+(p.categorie===c?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+
      '<input id="ghEen" class="st-in h-flex1" placeholder="'+T('gh.f.eenheid','Eenheid')+'" value="'+esc(p.eenheid||'stuk')+'"></div>'+
      '<div class="row-gap"><input id="ghIn" class="st-in h-flex1" type="number" step="0.01" placeholder="'+T('gh.f.inkoop','Inkoopprijs')+'" value="'+(p.inkoopPrijs!=null?p.inkoopPrijs:'')+'"><input id="ghCon" class="st-in h-flex1" type="number" step="0.01" placeholder="'+T('gh.f.consument','Consumentprijs')+'" value="'+(p.consumentPrijs!=null?p.consumentPrijs:'')+'"></div>'+
      '<div class="row-gap"><input id="ghVoor" class="st-in h-flex1" type="number" placeholder="'+T('gh.f.voorraad','Voorraad')+'" value="'+(p.voorraad!=null?p.voorraad:'')+'"><input id="ghMin" class="st-in h-flex1" type="number" placeholder="'+T('gh.f.min','Min. bestel')+'" value="'+(p.minBestel!=null?p.minBestel:1)+'"></div>'+
      '<div class="s-1stuony"><button id="ghSave" class="s-ytc7pj">'+T('gh.opslaan','Opslaan')+'</button>'+
      '<button id="ghCancel" class="s-1js1zvy">'+T('gh.annuleer','Annuleer')+'</button></div></div>';
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
      h += '<div class="s-4ofu9k">'+
        '<div class="s-1nmb7fl"><b class="h-flex1">'+esc(g.naam)+'</b>'+
        '<button class="js-inkai s-1sp7iqy" data-code="'+g.code+'">'+T('ink.ai','AI-bijbestellen')+'</button></div>'+
        '<div id="inkai-'+g.code+'"></div>'+
        g.producten.slice(0,60).map(p => '<div class="s-14xlsom">'+
          '<div class="h-flex1"><span class="s-2tw3ie">'+esc(p.naam)+'</span><span class="sub"> · '+eur(p.prijs)+'/'+esc(p.eenheid)+'</span></div>'+
          '<input class="st-in js-inkq s-j8gmo9" data-code="'+g.code+'" data-pid="'+p.id+'" type="number" min="0" placeholder="0"></div>').join('')+
        '<button class="js-inkbestel s-ie5m1d" data-code="'+g.code+'">'+T('ink.bestel','Bestellen')+'</button></div>';
    }
    if (!(markt.groothandels||[]).length) h += '<p class="sub">'+T('ink.geen','Geen groothandel beschikbaar voor inkoop.')+'</p>';
    // mijn bestellingen
    if ((mijn.bestellingen||[]).length){
      h += '<div class="st-sec">'+T('ink.mijn','Mijn inkooporders')+'</div>';
      h += mijn.bestellingen.slice(0,20).map(o => '<div class="s-1k01xs1"><div class="s-1x93s7l"><b class="s-1q6iem4">'+esc(o.groothandelNaam)+' · '+eur(o.subtotaal)+'</b><span class="sub">'+esc(o.status)+(o.bron==='ai'?' · AI':'')+'</span></div><div class="sub">'+o.regels.map(r=>r.aantal+'× '+esc(r.naam)).join(', ')+'</div></div>').join('');
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
    if (!regels.length) return toast(T('ink.kies','Vul minstens een aantal in.'));
    try { await API.call('/supplier/inkoop/bestel', { groothandelCode: code, regels }); toast(T('ink.besteld','Bestelling geplaatst.')); renderInkoop(); } catch(e){ toast(e.message); }
  }
  async function inkAi(code){
