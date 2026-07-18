  // ---- de ophaal/bezorgdienst van de zaak ----
  const BZ_ST = { 'nieuw':'nieuw', 'in bereiding':'in bereiding', 'klaar':'klaar', 'onderweg':'onderweg' };
  function renderBezorg(){
    const el = $('#bezorgWrap'); if (!el) return;
    const b = state && state.bezorg;
    if (!b){ el.innerHTML = ''; return; }
    const canEdit = actor().manager;
    let html = '';
    // dienststatus + schakelaars
    html += '<div class="card"><div class="tt-h">'+T('bz.dienst','De dienst')+'</div>'+
      '<div style="margin-top:0.5rem;font-size:0.85rem;color:'+(b.aan?'var(--green)':'var(--soft)')+';">'+
      (b.aan ? '\u25CF ' + T('bz.open','Open: leden kunnen bestellen.') : '\u25CB ' + T('bz.dicht','Gesloten: leden zien u niet in de bestellijst.'))+'</div>'+
      (canEdit ? '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.8rem;">'+
        '<button class="obtn'+(b.aan?'':' primary')+'" data-bzaan="'+(b.aan?'0':'1')+'">'+(b.aan?T('bz.zetdicht','Dienst sluiten'):T('bz.zetopen','Dienst openen'))+'</button>'+
        '<button class="obtn" data-bzk="ophalen" data-bzv="'+(b.ophalen?'0':'1')+'">'+(b.ophalen?'\u2713 ':'')+T('bz.ophalen','Ophalen')+'</button>'+
        '<button class="obtn" data-bzk="bezorgen" data-bzv="'+(b.bezorgen?'0':'1')+'">'+(b.bezorgen?'\u2713 ':'')+T('bz.bezorgen','Bezorgen')+'</button>'+
      '</div>' : '')+
      '<div style="margin-top:0.6rem;font-size:0.78rem;color:var(--soft);">'+T('bz.vandaag','Vandaag afgerond:')+' <b>'+(b.vandaagKlaar||0)+'</b></div></div>';
    // lopende leveringen met statusknoppen
    const lopend = b.lopend || [];
    html += '<div class="card"><div class="tt-h">'+T('bz.lopend','Lopende leveringen')+' ('+lopend.length+')</div>'+
      (lopend.length ? lopend.map(o => {
        const wie = o.bezorger ? ' \u00B7 \uD83D\uDEF5 ' + esc(o.bezorger.name) : '';
        const eta = o.etaMin ? ' \u00B7 ' + o.etaMin + ' min' : '';
        let knop = '';
        if (o.status === 'nieuw') knop = '<button class="obtn" data-bzord="'+o.ref+'" data-st="in bereiding">'+T('bz.bereiden','In bereiding')+'</button>';
        else if (o.status === 'in bereiding') knop = '<button class="obtn" data-bzord="'+o.ref+'" data-st="klaar">'+T('bz.klaar','Klaar')+'</button>';
        else if (o.status === 'klaar' && o.levering === 'ophalen') knop = '<button class="obtn primary" data-bzlev="'+o.ref+'" data-st="opgehaald">'+T('bz.opgehaald','Opgehaald')+'</button>';
        else if (o.status === 'klaar' && o.levering === 'bezorgen') knop = o.bezorger ? '<button class="obtn primary" data-bzlev="'+o.ref+'" data-st="onderweg">'+T('bz.vertrek','Onderweg')+'</button>' : '<span style="font-size:0.72rem;color:var(--soft);">'+T('bz.wachtbez','wacht op een bezorger (PDA)')+'</span>';
        else if (o.status === 'onderweg') knop = '<button class="obtn primary" data-bzlev="'+o.ref+'" data-st="bezorgd">'+T('bz.bezorgd','Bezorgd')+'</button>';
        return '<div class="mitem"><div class="r1"><span class="nm">'+(o.levering==='bezorgen'?'\uD83D\uDEF5':'\uD83E\uDDFA')+' '+esc(o.customerCodename)+' \u00B7 '+T('bz.st.'+o.status, BZ_ST[o.status]||o.status)+wie+eta+'</span><span class="pr">'+eur(o.total)+'</span></div>'+
          '<div class="ds">'+o.items.map(i=>i.qty+'x '+esc(i.name)).join(', ')+(o.levering==='bezorgen'&&o.adres?' \u00B7 \uD83D\uDCCD '+esc(o.adres):' \u00B7 '+T('bz.code','code')+' <b>'+o.pickup+'</b>')+'</div>'+
          (knop?'<div style="margin-top:0.5rem;">'+knop+'</div>':'')+'</div>';
      }).join('') : '<div class="empty">'+T('bz.geen','Nog geen lopende leveringen. Betaalde bestellingen verschijnen hier live.')+'</div>')+'</div>';
    // assortiment
    const prods = b.producten || [];
    html += '<div class="card"><div class="tt-h">'+T('bz.assort','Assortiment')+' ('+prods.length+')</div>'+
      (prods.length ? prods.map(p =>
        '<div class="mitem"><div class="r1"><span class="nm">'+esc(p.name)+'</span><span class="row-mid-gap"><span class="pr">'+eur(p.price)+'</span>'+
        (canEdit?'<button class="rr-del" data-bzdel="'+p.id+'">\u2715</button>':'')+'</span></div>'+
        (p.desc?'<div class="ds">'+esc(p.desc)+'</div>':'')+'</div>'
      ).join('') : '<div class="empty">'+T('bz.leeg','Nog geen producten. Voeg ze hieronder toe; dan kan de dienst open.')+'</div>')+
      (canEdit ? '<div style="margin-top:1rem;">'+
        '<div class="field"><label>'+T('bz.f.naam','Product')+'</label><input id="bzName" placeholder="'+T('bz.f.naamph','Bijv. paella om mee te nemen')+'"></div>'+
        '<div class="row-gap"><div class="field" style="flex:2;"><label>'+T('bz.f.desc','Omschrijving')+'</label><input id="bzDesc" placeholder="'+T('bz.f.descph','Kort en duidelijk')+'"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('bz.f.prijs','Prijs (\u20AC)')+'</label><input id="bzPrice" type="number" inputmode="decimal" placeholder="24"></div></div>'+
        '<button class="obtn primary" id="bzAdd">'+T('bz.f.voeg','Toevoegen')+'</button></div>' : '')+'</div>';
    el.innerHTML = html;
    // acties
    document.querySelectorAll('[data-bzaan]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/bezorg/instellingen', { aan: k.dataset.bzaan === '1' }); await refresh(); openTab('bezorg'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-bzk]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/bezorg/instellingen', { [k.dataset.bzk]: k.dataset.bzv === '1' }); await refresh(); openTab('bezorg'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-bzord]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/order/status', { ref: k.dataset.bzord, status: k.dataset.st }); await refresh(); openTab('bezorg'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-bzlev]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/bezorg/status', { ref: k.dataset.bzlev, status: k.dataset.st }); await refresh(); openTab('bezorg'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-bzdel]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/bezorg/product', { id: k.dataset.bzdel, weg: true }); await refresh(); openTab('bezorg'); } catch(e){ toast(e.message); }
    }));
    const voeg = document.getElementById('bzAdd');
    if (voeg) voeg.addEventListener('click', async () => {
      try {
        await API.call('/supplier/bezorg/product', { name: $('#bzName').value, desc: $('#bzDesc').value, price: Number($('#bzPrice').value) });
        toast(T('bz.f.ok','Het product staat in het assortiment.'));
        await refresh(); openTab('bezorg');
      } catch(e){ toast(e.message); }
    });
  }

