/* een bestelkaart opbouwen */
    const E = Util.el;
    return E('div', { class: 'order', dataset: { ref: o.ref } },
      E('div', { class: 'top' },
        E('div', {},
          E('div', { class: 'who' }, T('sup.guest', 'Gast') + ' ', E('span', { class: 'cn' }, o.customerCodename)),
          E('div', { class: 'ref' }, o.ref + ' · ' + timeAgo(o.at)),
          (o.pickup && !['geserveerd', 'geweigerd', 'terugbetaald'].includes(o.status))
            ? E('div', { class: 'pickup' }, T('sup.pickup', 'Ophaalcode') + ' ', E('b', {}, o.pickup)) : null),
        E('div', { style: { textAlign: 'right' } },
          E('div', { class: 'amt' }, eur(o.total)),
          E('div', { style: { marginTop: '0.3rem' } }, E('span', { class: 'pill ' + pillClass(o.status) }, tStatus(o.status))))),
      E('ul', {}, o.items.map(i => E('li', {}, E('span', {}, i.qty + '× ' + i.name), E('span', {}, eur(i.price * i.qty))))),
      o.guestArrived ? E('div', { class: 'enroute here' }, '' + T('sup.guesthere', 'Gast is gearriveerd. Serveer nu.'))
        : (o.guestEtaMin != null ? E('div', { class: 'enroute' }, '' + T('sup.guesteta', 'Gast onderweg, arriveert over ~') + o.guestEtaMin + ' ' + T('sup.min', 'min') + '. ' + T('sup.readyontime', 'Zet op tijd klaar.')) : null),
      o.allergyNote ? E('div', { class: 'allergy' }, '' + T('sup.allergy', 'Allergie:') + ' ' + o.allergyNote) : null,
      o.zorg ? E('div', { class: 'allergy' }, '' + T('sup.zorgp', 'Zorgprofiel gast:') + ' ' + zorgTekst(o.zorg)) : null,
      o.tagSalon ? E('div', { class: 'salon' }, '✦ ' + T('sup.wantssalon', 'Gast wil dit taggen voor De Salon')) : null,
      E('div', { class: 'acts' },
        E('span', { class: 'pill ' + (o.paid ? 'betaald' : 'onbetaald') },
          o.refunded ? T('sup.refunded', 'terugbetaald') : (o.paid ? '✓ ' + T('bo.paid', 'betaald') : T('sup.notpaid', 'nog niet betaald'))),
        NEXT[o.status] ? E('button', { class: 'obtn primary js-next', onclick: () => setStatus(o.ref, NEXT[o.status]) }, T('sup.markas', 'Markeer:') + ' ' + tStatus(NEXT[o.status])) : null,
        o.status === 'nieuw' ? E('button', { class: 'obtn warn js-reject', onclick: () => setStatus(o.ref, 'geweigerd') }, T('sup.reject', 'Weiger')) : null,
        (o.paid && !o.refunded) ? E('button', { class: 'obtn warn js-refund', onclick: () => refund(o.ref) }, T('sup.refund', 'Terugstorten')) : null));
  }
  function renderOrders(){
    renderReserveringen();
    laadEtenWerkblad();
    const list = state.orders || [];
    const wrap = $('#orderList');
    if (!list.length){ Util.vervang(wrap, Util.el('div', { class: 'empty' }, T('sup.noorders', 'Nog geen bestellingen. Zodra een RTG-gast bij u bestelt, verschijnt het hier, live.'))); return; }
    Util.vervang(wrap, list.map(orderKaart));
  }

  const RES_PILL = { aangevraagd:'nieuw', bevestigd:'bereiding', aangekomen:'klaar' };
  function resStatusTekst(st){
    return st==='aangevraagd'?T('res.st.nieuw','nieuw'):st==='bevestigd'?T('res.bevestigd','bevestigd'):st==='aangekomen'?T('res.st.er','aan tafel'):st==='no-show'?'no-show':st==='afgerond'?T('res.st.weg','vertrokken'):st;
  }
  function resRij(r, vandaag){
    const knoppen = [];
    if (r.status === 'aangevraagd') knoppen.push('<button class="obtn primary js-resok">'+T('res.ok','Bevestig')+'</button>','<button class="obtn warn js-resnee">'+T('sup.reject','Weiger')+'</button>');
    if (r.status === 'bevestigd'){
      knoppen.push('<button class="obtn js-restafel">'+(r.tafel?esc(r.tafel):T('res.tafel','Tafel'))+'</button>');
      if (vandaag) knoppen.push('<button class="obtn primary js-reser">'+T('res.er','Gast is er')+'</button>','<button class="obtn warn js-resno">'+T('res.noshow','No-show')+'</button>');
    }
    if (r.status === 'aangekomen') knoppen.push('<button class="obtn js-resweg">'+T('res.weg','Vertrokken')+'</button>');
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;margin-top:0.5rem;font-size:0.82rem;flex-wrap:wrap;" data-res="'+r.id+'">'+
      '<span><b>'+r.tijd+'</b> · <b class="cn">'+esc(r.customerCodename)+'</b> · '+r.personen+'p'+
        (r.tafel?' ·  '+esc(r.tafel):'')+(r.notitie?' ·  '+esc(r.notitie):'')+(vandaag?'':' · '+r.datum)+
        (r.zorg?'<span style="display:block;color:#E2B93B;">'+esc(zorgTekst(r.zorg))+'</span>':'')+'</span>'+
      (knoppen.length ? '<span style="display:flex;gap:0.4rem;flex-shrink:0;">'+knoppen.join('')+'</span>'
        : '<span class="pill '+(RES_PILL[r.status]||'klaar')+'" style="flex-shrink:0;">'+resStatusTekst(r.status)+'</span>')+'</div>';
  }
  async function renderReserveringen(){
    const wrap = $('#resWrap');
    if (!wrap) return;
    const later = (state.reserveringen || []).filter(r => r.datum > new Date().toISOString().slice(0,10) && ['aangevraagd','bevestigd'].includes(r.status));
    let plan = null;
    try { plan = await API.call('/supplier/tafelplan', {}); } catch(e){ plan = { reserveringen: [], tafels: [], verwachtePersonen: 0, openAanvragen: 0, zonderTafel: 0 }; }
    if (!plan.reserveringen.length && !later.length && !plan.tafels.length){ wrap.innerHTML = ''; return; }
    const chips = plan.tafels.length
      ? '<div class="pos-chips h-mt50">'+plan.tafels.map(t => t.status==='vrij'
        ? '<span><button class="obtn js-walkin" data-tafel="'+esc(t.name)+'" style="padding:0.15rem 0.5rem;">'+esc(t.name)+' · '+T('res.vrij','vrij')+'</button></span>'
        : '<span>'+esc(t.name)+' · '+t.status+(t.reserveringen.length?' · '+t.reserveringen.join(', '):'')+(t.rekening?' · '+eur(t.rekening.totaal):'')+'</span>').join('')+'</div>'+ '<div class="softline h-mt30">'+T('res.walkins','Een vrije tafel aantikken plaatst een walk-in.')+'</div>' : '';
    const rekeningen = plan.tafels.filter(t => t.rekening);
    const rekBlok = rekeningen.length ? rekeningen.map(t => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;margin-top:0.5rem;font-size:0.82rem;flex-wrap:wrap;" data-tafelrek="'+esc(t.name)+'"><span><b>'+esc(t.name)+'</b> · '+t.rekening.posten+' '+T('pos.posts','post(en)')+' · <b style="color:var(--gold);">'+eur(t.rekening.totaal)+'</b></span><span style="display:flex;gap:0.4rem;flex-shrink:0;flex-wrap:wrap;"><button class="obtn primary js-rekpay" data-method="rtgpay">RTG Pay</button><button class="obtn js-reksplit">'+T('res.splits','Splits')+'</button><button class="obtn js-rekpay" data-method="contant">'+T('pos.cash','Contant')+'</button></span></div>').join('') : '';
    wrap.innerHTML = '<div class="card"><div class="tt-h">'+T('res.vandaag','Tafelplanning vandaag')+'</div><div class="pos-chips h-mt40"><span>'+plan.verwachtePersonen+' '+T('res.verwacht','verwacht')+'</span>'+(plan.openAanvragen?'<span>'+plan.openAanvragen+' '+T('res.open','open aanvraag(en)')+'</span>':'')+(plan.zonderTafel?'<span>'+plan.zonderTafel+' '+T('res.zonder','zonder tafel')+'</span>':'')+'</div>'+chips+rekBlok+(plan.reserveringen.length ? plan.reserveringen.map(r => resRij(r, true)).join('') : '<div class="softline h-mt50">'+T('res.leeg','Nog geen reserveringen voor vandaag.')+'</div>')+'</div>'+(later.length ? '<div class="card"><div class="tt-h">'+T('res.later','Komende dagen')+'</div>'+later.map(r => resRij(r, false)).join('')+'</div>' : '');
    // een open rekening afrekenen: RTG Pay (met tap to pay) of contant, tafel weer vrij
