  // ---- home ----
  function renderHome(){
    const open = (state.orders||[]).filter(o => !['geserveerd','geweigerd','terugbetaald'].includes(o.status));
    const revenue = (state.orders||[]).filter(o=>o.paid).reduce((s,o)=>s+o.total,0);
    $('#homeH').textContent = T('sup.hello','Goedendag,') + ' ' + S.name.split(' ')[0] + '.';
    const rating = state.reviews && state.reviews.rating;
    $('#homeSub').textContent = tType(S.typeLabel) + (rating ? ' · ⭐ ' + rating.score + ' (' + rating.aantal + ' reviews)' : '') + ' · ' + T('sup.connected','verbonden met RTG');
    let stat = '';
    if (has('orders')) stat += '<div class="b"><div class="l">'+T('sup.openorders','Open orders')+'</div><div class="v a">'+open.length+'</div></div>';
    if (has('rides')) stat += '<div class="b"><div class="l">'+T('tab.rides','Ritten')+'</div><div class="v a">'+(state.rides||[]).length+'</div></div>';
    if (has('bookings')) stat += '<div class="b"><div class="l">'+T('sup.bookings','Boekingen')+'</div><div class="v a">'+(state.orders||[]).length+'</div></div>';
    stat += '<div class="b"><div class="l">'+T('sup.received','Ontvangen')+'</div><div class="v g">'+eur(revenue)+'</div></div>';
    $('#homeStat').innerHTML = stat;
    let extra = '';

    // Vandaag nog doen: alles wat aandacht vraagt, met een sprong naar de juiste tab
    const todos = [];
    const unreadChats = (state.guestChats || []).reduce((n, c) => n + (c.unread || 0), 0);
    if (unreadChats) todos.push({ icon:'💬', txt: unreadChats + ' ' + T('todo.chats','onbeantwoord(e) gastbericht(en)'), tab:'gchat' });
    const newOrders = (state.orders || []).filter(o => o.status === 'nieuw').length;
    if (newOrders) todos.push({ icon:'🛎️', txt: newOrders + ' ' + T('todo.orders','nieuwe bestelling(en)'), tab:'orders' });
    const newRides = (state.rides || []).filter(r => r.status === 'aangevraagd').length;
    if (newRides) todos.push({ icon:'🚗', txt: newRides + ' ' + T('todo.rides','open ritaanvraag/-vragen'), tab:'rides' });
    if (state.minibar){
      const roomsAll = (state.rooms || []).map(r => r.name);
      const notCounted = roomsAll.filter(r => !state.minibar.countedToday.includes(r));
      if (notCounted.length) todos.push({ icon:'🧊', txt: notCounted.length + ' ' + T('todo.minibar','minibar(s) nog tellen'), tab:'minibar' });
    }
    const openRooms = Object.keys((state.pos && state.pos.openRooms) || {}).length;
    if (openRooms) todos.push({ icon:'🧾', txt: openRooms + ' ' + T('todo.folio','open kamerrekening(en)'), tab:'kassa' });
    const dirty = (state.rooms || []).filter(r => r.hk && (r.hk.status === 'vuil')).length;
    if (dirty) todos.push({ icon:'🧹', txt: dirty + ' ' + T('todo.dirty','kamer(s) schoon te maken'), tab:'rooms' });
    const defect = (state.rooms || []).filter(r => r.hk && r.hk.status === 'defect').length;
    if (defect) todos.push({ icon:'⚠️', txt: defect + ' ' + T('todo.defect','kamer(s) defect'), tab:'rooms' });
    const openTickets = (state.tickets || []).filter(t => t.status !== 'klaar').length;
    if (openTickets) todos.push({ icon:'🔧', txt: openTickets + ' ' + T('todo.tickets','open klus(sen)'), tab:'klussen' });
    const newApps = (state.applications || []).filter(x => x.status === 'nieuw').length;
    if (newApps) todos.push({ icon:'📝', txt: newApps + ' ' + T('todo.apps','nieuwe sollicitatie(s)'), tab:'team' });
    const openRes = (state.reserveringen || []).filter(r => r.status === 'aangevraagd').length;
    if (openRes) todos.push({ icon:'🪑', txt: openRes + ' ' + T('todo.res','open reservering(en) om te bevestigen'), tab:'orders' });
    extra += '<div class="card"><div class="tt-h">' + T('todo.h','Vandaag nog doen') + '</div>' +
      (todos.length ? todos.map(t =>
        '<button class="todo-row" data-goto="' + t.tab + '"><span>' + t.icon + '</span><b>' + t.txt + '</b><i>›</i></button>'
      ).join('') : '<div style="margin-top:0.5rem;font-size:0.82rem;color:var(--green);">✓ ' + T('todo.none','Alles is bij. Geen openstaande acties.') + '</div>') +
      '</div>';

    // recente reviews van gasten (1-5 sterren, geplaatst na afronding)
    const recentRevs = (state.reviews && state.reviews.recent) || [];
    if (recentRevs.length){
      extra += '<div class="card"><div class="tt-h">⭐ ' + T('rev.h','Recente reviews') + '</div>' +
        recentRevs.slice(0,3).map(r =>
          '<div style="margin-top:0.55rem;font-size:0.8rem;"><b>' + '★'.repeat(r.score) + '<span style="opacity:0.25;">' + '★'.repeat(5 - r.score) + '</span></b> <span class="cn">' + r.codename + '</span>' +
          (r.tekst ? '<div style="color:var(--soft);font-size:0.76rem;margin-top:0.15rem;">' + r.tekst + '</div>' : '') + '</div>'
        ).join('') + '</div>';
    }

    const guests = (state.guests || []);
    if (guests.length){
      extra += '<div class="card" style="border-color:rgba(194,58,94,0.35);"><div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--burgundy);display:flex;align-items:center;gap:0.4rem;"><span class="livedot"></span>'+T('sup.enroute','Gasten onderweg naar u')+'</div>'+
        guests.map(g => '<div class="guest-row"><span class="cn">'+g.codename+'</span>'+
          (g.arrived?'<span class="ge here">✓ '+T('sup.arrived','gearriveerd')+'</span>':(g.etaMin!=null?'<span class="ge"><b>'+g.etaMin+'</b> '+T('sup.minaway','min')+'</span>':'<span class="ge">'+T('sup.enrouteshort','onderweg')+'</span>'))+
        '</div>').join('')+'</div>';
    }
    extra += '<div class="card"><div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+T('sup.yourprice','Uw prijs voor RTG-leden')+'</div>'+
      '<div style="margin-top:0.4rem;font-size:0.85rem;color:var(--muted);">'+T('sup.pricebody','U levert RTG-leden uw beste prijs; RTG brengt de gasten en rekent 0% commissie. U houdt 100% van elke boeking.')+'</div>'+
      '<button class="obtn primary" style="margin-top:0.8rem;" data-goto="price">'+T('sup.newprice','Nieuwe prijs doorgeven')+'</button></div>';
    if (has('menu')) extra += '<div class="card"><div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+T('sup.menu','Menukaart')+'</div><div style="margin-top:0.4rem;font-size:0.85rem;color:var(--muted);">'+(state.menu||[]).length+' '+T('sup.dishesvisible','gerechten zichtbaar voor gasten.')+'</div><button class="obtn" style="margin-top:0.8rem;" data-goto="menu">'+T('sup.viewmenu','Bekijk menu')+'</button></div>';
    $('#homeExtra').innerHTML = extra;
    document.querySelectorAll('#content [data-goto]').forEach(b => b.addEventListener('click', ()=>openTab(b.dataset.goto)));
  }

  // ---- orders ----
  const NEXT = { 'nieuw':'in bereiding', 'in bereiding':'klaar', 'klaar':'geserveerd' };
  function pillClass(st){ return st==='nieuw'?'nieuw':st==='in bereiding'?'bereiding':(st==='klaar'||st==='geserveerd')?'klaar':''; }
  // Met het componentframework (Util.el): tekst (gast-codenaam, gerechtnamen,
  // allergie) wordt structureel als tekstknoop gezet -> altijd veilig, en elke
  // knop draagt zijn eigen handler (geen losse her-binding meer).
  function orderKaart(o){
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
      o.guestArrived ? E('div', { class: 'enroute here' }, '🎉 ' + T('sup.guesthere', 'Gast is gearriveerd. Serveer nu.'))
        : (o.guestEtaMin != null ? E('div', { class: 'enroute' }, '📍 ' + T('sup.guesteta', 'Gast onderweg, arriveert over ~') + o.guestEtaMin + ' ' + T('sup.min', 'min') + '. ' + T('sup.readyontime', 'Zet op tijd klaar.')) : null),
      o.allergyNote ? E('div', { class: 'allergy' }, '⚠ ' + T('sup.allergy', 'Allergie:') + ' ' + o.allergyNote) : null,
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
    const list = state.orders || [];
    const wrap = $('#orderList');
    if (!list.length){ Util.vervang(wrap, Util.el('div', { class: 'empty' }, T('sup.noorders', 'Nog geen bestellingen. Zodra een RTG-gast bij u bestelt, verschijnt het hier, live.'))); return; }
    Util.vervang(wrap, list.map(orderKaart));
  }

  /* De tafelplanning: vandaag als gedekte avond (tafels, komst, walk-ins) en
     de komende dagen als lijst. Elke rij draagt zijn eigen knoppen: bevestigen,
     tafel toewijzen, gast is er, no-show, vertrokken. */
  const RES_PILL = { aangevraagd:'nieuw', bevestigd:'bereiding', aangekomen:'klaar' };
  function resStatusTekst(st){
    return st==='aangevraagd'?T('res.st.nieuw','nieuw'):st==='bevestigd'?T('res.bevestigd','bevestigd'):st==='aangekomen'?T('res.st.er','aan tafel'):st==='no-show'?'no-show':st==='afgerond'?T('res.st.weg','vertrokken'):st;
  }
  function resRij(r, vandaag){
    const knoppen = [];
    if (r.status === 'aangevraagd') knoppen.push('<button class="obtn primary js-resok">'+T('res.ok','Bevestig')+'</button>','<button class="obtn warn js-resnee">'+T('sup.reject','Weiger')+'</button>');
    if (r.status === 'bevestigd'){
      knoppen.push('<button class="obtn js-restafel">🪑 '+(r.tafel?esc(r.tafel):T('res.tafel','Tafel'))+'</button>');
      if (vandaag) knoppen.push('<button class="obtn primary js-reser">'+T('res.er','Gast is er')+'</button>','<button class="obtn warn js-resno">'+T('res.noshow','No-show')+'</button>');
    }
    if (r.status === 'aangekomen') knoppen.push('<button class="obtn js-resweg">'+T('res.weg','Vertrokken')+'</button>');
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;margin-top:0.55rem;font-size:0.82rem;flex-wrap:wrap;" data-res="'+r.id+'">'+
      '<span><b>'+r.tijd+'</b> · <b class="cn">'+esc(r.customerCodename)+'</b> · '+r.personen+'p'+
        (r.tafel?' · 🪑 '+esc(r.tafel):'')+(r.notitie?' · 📝 '+esc(r.notitie):'')+(vandaag?'':' · '+r.datum)+'</span>'+
      (knoppen.length
        ? '<span style="display:flex;gap:0.4rem;flex-shrink:0;">'+knoppen.join('')+'</span>'
        : '<span class="pill '+(RES_PILL[r.status]||'klaar')+'" style="flex-shrink:0;">'+resStatusTekst(r.status)+'</span>')+
    '</div>';
  }
  async function renderReserveringen(){
    const wrap = $('#resWrap');
    if (!wrap) return;
    const later = (state.reserveringen || []).filter(r => r.datum > new Date().toISOString().slice(0,10) && ['aangevraagd','bevestigd'].includes(r.status));
    let plan = null;
    try { plan = await API.call('/supplier/tafelplan', {}); } catch(e){ plan = { reserveringen: [], tafels: [], verwachtePersonen: 0, openAanvragen: 0, zonderTafel: 0 }; }
    if (!plan.reserveringen.length && !later.length && !plan.tafels.length){ wrap.innerHTML = ''; return; }
    const chips = plan.tafels.length
      ? '<div class="pos-chips" style="margin-top:0.5rem;">'+plan.tafels.map(t =>
          t.status==='vrij'
            ? '<span><button class="obtn js-walkin" data-tafel="'+esc(t.name)+'" style="padding:0.15rem 0.5rem;">'+esc(t.name)+' · '+T('res.vrij','vrij')+'</button></span>'
            : '<span>'+esc(t.name)+' · '+t.status+(t.reserveringen.length?' · '+t.reserveringen.join(', '):'')+(t.rekening?' · '+eur(t.rekening.totaal):'')+'</span>'
        ).join('')+'</div>'+
        '<div class="softline" style="margin-top:0.3rem;">'+T('res.walkins','Een vrije tafel aantikken plaatst een walk-in.')+'</div>'
      : '';
    // de open rekeningen: alles wat de kassa op de tafel zette, hier afrekenen
    const rekeningen = plan.tafels.filter(t => t.rekening);
    const rekBlok = rekeningen.length
      ? rekeningen.map(t => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;margin-top:0.55rem;font-size:0.82rem;flex-wrap:wrap;" data-tafelrek="'+esc(t.name)+'">'+
          '<span><b>'+esc(t.name)+'</b> · '+t.rekening.posten+' '+T('pos.posts','post(en)')+' · <b style="color:var(--gold);">'+eur(t.rekening.totaal)+'</b></span>'+
          '<span style="display:flex;gap:0.4rem;flex-shrink:0;flex-wrap:wrap;">'+
            '<button class="obtn primary js-rekpay" data-method="rtgpay">RTG Pay</button>'+
            '<button class="obtn js-reksplit">'+T('res.splits','Splits')+'</button>'+
            '<button class="obtn js-rekpay" data-method="contant">'+T('pos.cash','Contant')+'</button></span>'+
        '</div>').join('')
      : '';
    wrap.innerHTML = '<div class="card"><div class="tt-h">🪑 '+T('res.vandaag','Tafelplanning vandaag')+'</div>'+
      '<div class="pos-chips" style="margin-top:0.4rem;">'+
        '<span>👥 '+plan.verwachtePersonen+' '+T('res.verwacht','verwacht')+'</span>'+
        (plan.openAanvragen?'<span>✋ '+plan.openAanvragen+' '+T('res.open','open aanvraag(en)')+'</span>':'')+
        (plan.zonderTafel?'<span>🪑 '+plan.zonderTafel+' '+T('res.zonder','zonder tafel')+'</span>':'')+
      '</div>'+chips+rekBlok+
      (plan.reserveringen.length ? plan.reserveringen.map(r => resRij(r, true)).join('') : '<div class="softline" style="margin-top:0.5rem;">'+T('res.leeg','Nog geen reserveringen voor vandaag.')+'</div>')+
      '</div>'+
      (later.length ? '<div class="card"><div class="tt-h">🗓 '+T('res.later','Komende dagen')+'</div>'+later.map(r => resRij(r, false)).join('')+'</div>' : '');
    // een open rekening afrekenen: RTG Pay (met tap to pay) of contant, tafel weer vrij
    wrap.querySelectorAll('[data-tafelrek]').forEach(el => {
      const rekenAf = async (extra) => {
        try {
          const body = Object.assign({ room: el.dataset.tafelrek }, extra);
          if (body.method === 'rtgpay'){
            body.payCode = await vraagPayCode(); if (!body.payCode) return;
            body.idem = 'trek' + Date.now();
          }
          const d = await API.call('/supplier/pos/checkout', body);
          let boodschap = T('res.rekklaar','Rekening afgerekend:')+' '+el.dataset.tafelrek+', '+eur(d.sale.total)+' ('+methodLabel(d.sale.method)+')';
          if (d.gesplitst) boodschap += ' · '+T('res.gesplitst','gesplitst met')+' '+d.gesplitst.vrienden+' ('+eur(d.gesplitst.perPersoon/100)+' p.p.)';
          if (d.splitsFout) boodschap += ' · '+d.splitsFout;
          toast(boodschap);
          await refresh(); renderReserveringen();
        } catch(e){ toast(e.message); }
      };
      el.querySelectorAll('.js-rekpay').forEach(b => b.addEventListener('click', () => rekenAf({ method: b.dataset.method })));
      // splitsen: een gast betaalt het geheel met RTG Pay, de tafelgenoten
      // krijgen meteen een Klompje voor hun deel, uit naam van de betaler
      const sp = el.querySelector('.js-reksplit'); if (sp) sp.addEventListener('click', () => {
        const namen = window.prompt(T('res.splitswie','Codenamen van de tafelgenoten (met komma); de betaler tikt zo zijn code:'));
        if (!namen) return;
        rekenAf({ method: 'rtgpay', splitsMet: namen.split(',').map(x => x.trim()).filter(Boolean) });
      });
    });
    wrap.querySelectorAll('.js-walkin').forEach(b => b.addEventListener('click', async () => {
      const p = window.prompt(T('res.walkinp','Walk-in aan '+b.dataset.tafel+': met hoeveel personen?'), '2');
      if (!p) return;
      try { await API.call('/supplier/walkin', { tafel: b.dataset.tafel, personen: Number(p) }); toast('🪑 '+T('res.walkintoast','Walk-in geplaatst.')); renderReserveringen(); }
      catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-res]').forEach(el => {
      const doe = async (pad, body, boodschap) => {
        try { await API.call(pad, body); if (boodschap) toast(boodschap); await refresh(); }
        catch(e){ toast(e.message); }
      };
      const id = el.dataset.res;
      const ok = el.querySelector('.js-resok'); if (ok) ok.addEventListener('click', () => doe('/supplier/reservering/beslis', { id, action:'bevestig' }, '🪑 '+T('res.oktoast','Reservering bevestigd; de gast hoort het meteen.')));
      const nee = el.querySelector('.js-resnee'); if (nee) nee.addEventListener('click', () => doe('/supplier/reservering/beslis', { id, action:'weiger' }, T('res.neetoast','Reservering geweigerd.')));
      const tf = el.querySelector('.js-restafel'); if (tf) tf.addEventListener('click', () => {
        const namen = plan.tafels.map(t => t.name);
        const keuze = window.prompt(T('res.tafelp','Welke tafel?')+' ('+namen.join(', ')+')');
        if (keuze) doe('/supplier/reservering/tafel', { id, tafel: keuze.trim() }, '🪑 '+T('res.tafeltoast','Tafel toegewezen; de gast krijgt bericht.'));
      });
      const er = el.querySelector('.js-reser'); if (er) er.addEventListener('click', () => doe('/supplier/reservering/komst', { id, actie:'aangekomen' }, T('res.ertoast','Welkom; de tafel staat op bezet.')));
      const no = el.querySelector('.js-resno'); if (no) no.addEventListener('click', () => doe('/supplier/reservering/komst', { id, actie:'no-show' }, T('res.noshowtoast','Gemeld als no-show; de tafel is weer vrij.')));
      const weg = el.querySelector('.js-resweg'); if (weg) weg.addEventListener('click', () => doe('/supplier/reservering/komst', { id, actie:'vertrokken' }, T('res.wegtoast','Afgerond; de tafel is weer vrij.')));
    });
  }
  async function setStatus(ref, status){
    try { await API.call('/supplier/order/status', {ref, status}); toast(T('sup.status','Status:')+' '+tStatus(status)); await refresh(); }
    catch(e){ toast(e.message); }
  }
  async function refund(ref){
    try { const d = await API.call('/supplier/refund', {ref}); toast(T('sup.refundedtoast','Terugbetaald:')+' '+eur(d.order.total)); await refresh(); }
    catch(e){ toast(e.message); }
  }

  // ---- rides (taxi/jet) ----
  const NEXT_RIDE = { 'aangevraagd':'geaccepteerd', 'geaccepteerd':'onderweg', 'onderweg':'aangekomen', 'aangekomen':'aan-boord', 'aan-boord':'afgerond',
                      'rijdt':'afgerond', 'gearriveerd':null };
  const RIDE_NEXT_LABEL = { 'geaccepteerd':'sup.ride.accept', 'onderweg':'sup.ride.go', 'aangekomen':'sup.ride.atpickup', 'aan-boord':'sup.ride.driving', 'afgerond':'sup.ride.done' };
  const RIDE_NEXT_NL = { 'geaccepteerd':'Accepteer de rit', 'onderweg':'Ik rijd naar de gast', 'aangekomen':'Ik sta voor', 'aan-boord':'Gast aan boord', 'afgerond':'Rit afronden' };
  const RIT_KLAAR = st => st === 'gearriveerd' || st === 'afgerond' || st === 'geweigerd';
  function ridePill(st){ return st==='aangevraagd'?'nieuw':RIT_KLAAR(st)?'klaar':'bereiding'; }
  function ritRegel(r){
    return (r.passengers?'👤 '+r.passengers+' ':'')+(r.luggage?'🧳 '+r.luggage+' ':'')+(r.km?'· '+r.km+' km ':'')+(r.quote?'· <b style="color:var(--gold);">'+eur(r.quote)+'</b>':'');
  }
  function renderRides(){
    const list = (state.rides || []).filter(r => !RIT_KLAAR(r.status));
    $('#rideList').innerHTML = list.length ? list.map(r => {
      const nxt = NEXT_RIDE[r.status];
      const eta = (r.status === 'aangevraagd' || r.status === 'onderweg')
        ? (r.pickupEtaMin != null ? '<div class="enroute">🚗 '+T('sup.pickupeta','Gast op ~')+r.pickupEtaMin+' '+T('sup.min','min')+' '+T('sup.rijden','rijden')+'.</div>' : '')
        : (r.status === 'rijdt' && r.dropEtaMin != null ? '<div class="enroute">🏁 '+T('sup.dropeta','Aankomst bestemming over ~')+r.dropEtaMin+' '+T('sup.min','min')+'.</div>' : '');
      return '<div class="order" data-rref="'+r.ref+'">'+
        '<div class="top"><div><div class="who">'+T('sup.guest','Gast')+' <span class="cn">'+r.customerCodename+'</span></div>'+
          '<div class="ref">'+(r.from||'')+' → '+(r.to||T('sup.opendest','open bestemming'))+' · '+timeAgo(r.at)+'</div></div>'+
          '<span class="pill '+ridePill(r.status)+'">'+tStatus(r.status)+'</span></div>'+
        '<div class="ref" style="margin-top:0.25rem;">'+ritRegel(r)+
          (r.driver?' · 🚘 '+r.driver.name+(r.vehicle?' ('+r.vehicle.name+')':''):' · <span style="color:var(--amber,#B8860B);">'+T('sup.ride.nodriver','nog geen chauffeur')+'</span>')+'</div>'+
        (r.note?'<div class="ref">📝 '+r.note+'</div>':'')+
        eta +
        '<div class="acts">'+
          (nxt?'<button class="obtn primary js-rnext">'+T(RIDE_NEXT_LABEL[nxt], RIDE_NEXT_NL[nxt])+'</button>':'')+
          (r.status==='aangevraagd'?'<button class="obtn warn js-rreject">'+T('sup.reject','Weiger')+'</button>':'')+
        '</div>'+
      '</div>';
    }).join('') : '<div class="empty">'+T('sup.norides','Geen ritaanvragen. RTG-gasten die een rit boeken, verschijnen hier met bestemming en live locatie.')+'</div>';
    document.querySelectorAll('[data-rref]').forEach(el => {
      const ref = el.dataset.rref;
      const r = (state.rides||[]).find(x=>x.ref===ref);
      const nb = el.querySelector('.js-rnext'); if (nb) nb.addEventListener('click', ()=>setRideStatus(ref, NEXT_RIDE[r.status]));
      const rj = el.querySelector('.js-rreject'); if (rj) rj.addEventListener('click', ()=>setRideStatus(ref,'geweigerd'));
    });
  }
  async function setRideStatus(ref, status){
    try { await API.call('/supplier/ride/status', {ref, status}); toast(T('sup.status','Status:')+' '+tStatus(status)); await refresh(); }
    catch(e){ toast(e.message); }
  }

  // ---- menu: bekijken voor iedereen, bewerken voor managers/chefs ----
  function renderMenu(){
    const el = $('#menuList'); if (!el) return;
    const m = state.menu || [];
    const canEdit = actor().manager;
    const cats = [...new Set(m.map(x=>x.cat))];
    let html = m.length ? cats.map(c =>
      '<div class="menu-cat">'+c+'</div>' + m.filter(x=>x.cat===c).map(x =>
        '<div class="mitem"><div class="r1"><span class="nm">'+x.name+'</span><span class="row-mid-gap">'+
        (canEdit?'<button class="mn-station" data-mst="'+x.id+'">'+(x.station==='bar'?'\uD83C\uDF78 bar':'\uD83D\uDD25 '+T('menu.keuken','keuken'))+'</button>':'<span class="soft-xs">'+(x.station==='bar'?'\uD83C\uDF78':'\uD83D\uDD25')+'</span>')+
        '<span class="pr">'+eur(x.price)+'</span>'+
        (canEdit?'<button class="rr-del" data-mdel="'+x.id+'">✕</button>':'')+'</span></div>'+
        (x.desc?'<div class="ds">'+x.desc+'</div>':'')+
        (x.allergens&&x.allergens.length?'<div class="alg">'+x.allergens.map(a=>'<span>'+tAlg(a)+'</span>').join('')+'</div>':'')+
        '</div>'
      ).join('')
    ).join('') : '<div class="empty">'+T('sup.nomenu','Nog geen menukaart. Voeg gerechten toe zodat gasten vooraf kunnen bestellen.')+'</div>';
    if (canEdit){
      html += '<div class="card" style="margin-top:1.2rem;"><div class="tt-h">'+T('menu.add','Gerecht toevoegen')+'</div>'+
        '<div class="field"><label>'+T('menu.name','Naam')+'</label><input id="mnName" placeholder="'+T('menu.nameph','Bijv. gegrilde octopus')+'"></div>'+
        '<div class="row-gap"><div class="field" style="flex:2;"><label>'+T('menu.cat','Categorie')+'</label><input id="mnCat" placeholder="'+T('menu.catph','Bijv. Voorgerechten')+'"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('menu.price','Prijs (€)')+'</label><input id="mnPrice" type="number" inputmode="decimal" placeholder="45"></div></div>'+
        '<div class="field"><label>'+T('menu.desc','Omschrijving')+'</label><input id="mnDesc" placeholder="'+T('menu.descph','Kort en smakelijk')+'"></div>'+
        '<div class="field"><label>'+T('menu.alg','Allergenen (komma\'s)')+'</label><input id="mnAlg" placeholder="vis, soja"></div>'+
        '<div class="field"><label>'+T('menu.station','Werkplek')+'</label><select id="mnStation" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.8rem 1rem;font-size:0.9rem;color:var(--txt);outline:none;">'+
        '<option value="keuken"'+((S&&(S.type==='bar'||S.type==='club'))?'':' selected')+'>\uD83D\uDD25 '+T('menu.keuken','Keuken')+'</option>'+
        '<option value="bar"'+((S&&(S.type==='bar'||S.type==='club'))?' selected':'')+'>\uD83C\uDF78 Bar</option></select></div>'+
        '<button class="bigbtn" id="mnAdd">'+T('menu.addbtn','Zet op de kaart')+'</button></div>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-mdel]').forEach(b => b.addEventListener('click', async () => {
      const menu = (state.menu||[]).filter(x => x.id !== b.dataset.mdel);
      try { await API.call('/supplier/menu', { menu }); toast(T('menu.removed','Van de kaart gehaald.')); await refresh(); openTab('menu'); } catch(e){ toast(e.message); }
    }));
    // gerecht wisselen van werkplek: keuken <-> bar (bepaalt op welk scherm het ticket komt)
    el.querySelectorAll('[data-mst]').forEach(b => b.addEventListener('click', async () => {
      const menu = (state.menu||[]).map(x => x.id === b.dataset.mst ? { ...x, station: x.station === 'bar' ? 'keuken' : 'bar' } : x);
      try { await API.call('/supplier/menu', { menu }); toast(T('menu.stmoved','Verplaatst naar de andere werkplek.')); await refresh(); openTab('menu'); } catch(e){ toast(e.message); }
    }));
    const add = $('#mnAdd'); if (add) add.addEventListener('click', async () => {
      const name = $('#mnName').value.trim(), price = Number($('#mnPrice').value);
      if (!name || !(price>0)){ toast(T('menu.fill','Vul een naam en prijs in.')); return; }
      const item = { id: 'm'+Date.now().toString(36), cat: $('#mnCat').value.trim()||T('menu.other','Overig'), name, desc: $('#mnDesc').value.trim(), price, allergens: $('#mnAlg').value.split(',').map(a=>a.trim().toLowerCase()).filter(Boolean), station: $('#mnStation') ? $('#mnStation').value : 'keuken' };
      try { await API.call('/supplier/menu', { menu: [...(state.menu||[]), item] }); toast(T('menu.added','Staat op de kaart, gasten zien het direct.')); await refresh(); openTab('menu'); } catch(e){ toast(e.message); }
    });
  }

  // ---- dynamische prijs ----
  function renderPrice(){
    const h = state.prices || [];
    $('#prHistory').innerHTML = '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);margin-bottom:0.3rem;">'+T('sup.pricehist','Eerder doorgegeven')+'</div>' +
      (h.length ? h.slice(0,8).map(p=>'<div class="price-row"><span class="s">'+p.service+'<br><span style="font-size:0.66rem;color:var(--soft);">'+timeAgo(p.at)+'</span></span><span class="p">'+eur(p.price)+'</span></div>').join('') : '<div class="softline">'+T('sup.noprices','Nog geen prijzen doorgegeven.')+'</div>');
  }
  $('#prSend').addEventListener('click', async () => {
    const service = $('#prService').value.trim();
    const price = Number($('#prPrice').value);
    if (!service || !(price>0)){ toast(T('sup.fillprice','Vul een dienst en prijs in.')); return; }
    try { await API.call('/supplier/price', {service, price}); toast(T('sup.pricesent','Prijs verstuurd naar RTG.')); $('#prService').value=''; $('#prPrice').value=''; await refresh(); openTab('price'); }
    catch(e){ toast(e.message); }
  });

  // ---- locatie ----
  function renderLocation(){
    const loc = S.loc || {};
    $('#locWrap').innerHTML =
      '<div class="loc-card"><div class="loc-map"><div class="pin"></div><div class="lbl">'+(loc.label||T('sup.locunknown','Locatie onbekend'))+'</div></div>'+
      '<div class="loc-info">'+T('sup.locinfo','Uw locatie is zichtbaar voor RTG-gasten met een actieve rit of bestelling bij u. Gasten delen hun locatie terug wanneer zij onderweg zijn.')+'</div></div>'+
      '<button class="bigbtn" id="locShare">'+T('sup.sharelive','Deel mijn live locatie')+'</button>';
    $('#locShare').addEventListener('click', shareLocation);
  }
  function shareLocation(){
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(async pos => {
        try { await API.call('/supplier/location', { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Live positie' }); toast(T('sup.locshared','Live locatie gedeeld met gasten.')); await refresh(); }
        catch(e){ toast(e.message); }
      }, () => demoShare(), { timeout: 4000 });
    } else demoShare();
  }
  async function demoShare(){
    try { await API.call('/supplier/location', { lat: S.loc.lat, lng: S.loc.lng, label: S.loc.label }); toast(T('sup.locshareddemo','Locatie gedeeld (demo-positie).')); }
    catch(e){ toast(e.message); }
  }

  // ---- kassa, per sector ----
  let bon = {};        // horeca: menu-id -> aantal
  function bonTotal(){ return (state.menu||[]).reduce((s,m)=>s+m.price*(bon[m.id]||0),0); }
  function methodLabel(m){ return m==='rtgpay'?'RTG Pay':m==='pin'?T('pos.pin','PIN'):m==='contant'?T('pos.cash','Contant'):m==='rtg'?T('pos.rtg','RTG-code'):m==='kamer'?T('pos.room','Op de kamer'):m==='tafel'?T('pos.table','Op de tafel'):m==='app'?T('pos.app','In de app'):m; }
  /* RTG Pay aan de kassa: tap to pay als het kan (de gast houdt zijn toestel
     hiertegen), met altijd de uitweg om de code te typen; werkt de NFC-chip
     niet of tikt er niemand, dan komt het typvenster vanzelf. */
  async function vraagPayCode(){
    if (window.TapPay && TapPay.kan()){
      const tap = window.confirm(T('pos.tapkeuze','Tap to pay: de gast tikt zijn toestel hiertegen. Liever de code typen (bijv. als NFC niet werkt)? Kies dan Annuleren.'));
      if (tap){
        toast('📳 '+T('pos.tap','Tap to pay: laat de gast het toestel hiertegen houden...'));
        const code = await TapPay.lees(12000);
        if (code){ toast('📳 '+T('pos.tapok','Code ontvangen via tap to pay.')); return code; }
        toast(T('pos.tapmis','Geen tik ontvangen; typ de code van de gast.'));
      }
    }
    const c = window.prompt(T('pos.paycode','Betaalcode van de gast (uit de app):'));
    return c ? c.trim().toUpperCase() : null;
  }

  function renderKassa(){
    const el = $('#kassaWrap'); if (!el) return;
    const type = S.type;
    let html = '';
    if (type==='restaurant'||type==='bar'||type==='club') html = kassaHoreca();
    else if (type==='hotel'||type==='apartment') html = kassaHotel();
    else html = kassaVervoer();
    html += kassaDay();
    html += '<div id="zWrap"></div><div id="shiftWrap"></div>';
    el.innerHTML = html;
    bindKassa(type);
    laadZ();
    laadShift();
  }

  /* De shift-samenvatting: het avondbriefing-moment. Gasten, no-shows en
     walk-ins, de toppers van de dag, de derving en wie er op de kassa stond. */
  async function laadShift(){
    const el = $('#shiftWrap'); if (!el) return;
    let r; try { r = await API.call('/supplier/shift', {}); } catch(e){ return; }
    const heeftGasten = r.gasten.reserveringen || r.gasten.walkIns || r.gasten.noShows;
    if (!r.bonnen && !heeftGasten) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="card"><div class="tt-h">🌙 '+T('shift.h','Shift-samenvatting')+'</div>'+
      (heeftGasten?'<div class="pos-chips" style="margin-top:0.4rem;">'+
        '<span>👥 '+r.gasten.personen+' '+T('shift.gasten','gasten aan tafel')+'</span>'+
        '<span>🪑 '+r.gasten.reserveringen+' '+T('shift.res','reservering(en)')+'</span>'+
        (r.gasten.walkIns?'<span>🚶 '+r.gasten.walkIns+' walk-in(s)</span>':'')+
        (r.gasten.noShows?'<span style="color:var(--burgundy);">✗ '+r.gasten.noShows+' no-show(s)</span>':'')+
      '</div>':'')+
      ((r.toppers||[]).length?'<div class="st-row" style="margin-top:0.4rem;"><span>'+T('shift.toppers','Toppers')+'</span><span class="sub">'+r.toppers.map(t=>t.aantal+'× '+esc(t.naam)).join(' · ')+'</span></div>':'')+
      (r.derving?'<div class="st-row"><span>'+T('shift.derving','Derving (kostprijs)')+'</span><b style="color:var(--burgundy);">'+eur(r.derving)+'</b></div>':'')+
      ((r.team||[]).length?'<div class="st-row"><span>'+T('shift.team','Op de kassa')+'</span><span class="sub">'+r.team.map(t=>esc(t.naam)+' '+eur(t.omzet)).join(' · ')+'</span></div>':'')+
      '<div class="softline" style="margin-top:0.3rem;">'+T('shift.s','Samen met het Z-rapport hierboven is dit de briefing voor morgen.')+'</div></div>';
  }

  /* De dagafsluiting (Z-rapport): omzet, bonnen, fooien en de btw-splitsing
     van vandaag, met de boekhoudexport (journaalregels als CSV) eronder. */
  async function laadZ(){
    const el = $('#zWrap'); if (!el) return;
    let r; try { r = await API.call('/supplier/dagrapport', {}); } catch(e){ return; }
    el.innerHTML = '<div class="card"><div class="tt-h">🧾 '+T('pos.z','Dagafsluiting (Z-rapport)')+'</div>'+
      '<div class="st-row"><span>'+T('pos.z.omzet','Omzet vandaag')+'</span><b>'+eur(r.omzet)+'</b></div>'+
      '<div class="st-row"><span>'+T('pos.z.bonnen','Bonnen')+'</span><b>'+r.bonnen+'</b></div>'+
      (r.fooien?'<div class="st-row"><span>'+T('pos.fooien','Fooien')+'</span><b>'+eur(r.fooien)+'</b></div>':'')+
      (r.btw||[]).map(b => '<div class="st-row"><span>'+esc(b.label)+' · '+b.tarief+'% btw</span><b>'+eur(b.omzet)+' <span class="sub">'+T('pos.z.waarvanbtw','waarvan btw')+' '+eur(b.btw)+'</span></b></div>').join('')+
      Object.entries(r.betaalwijzen||{}).map(([w, b2]) => '<div class="st-row"><span class="sub">'+T('pos.z.ontv','Ontvangsten')+' '+esc(methodLabel(w))+'</span><span class="sub">'+eur(b2)+'</span></div>').join('')+
      '<button class="bigbtn" id="zCsv" style="margin-top:0.5rem;">⬇ '+T('pos.z.csv','Boekhoudexport (CSV)')+'</button>'+
      '<div class="softline" style="margin-top:0.3rem;">'+T('pos.z.s','Journaalregels per btw-categorie en betaalwijze; in te lezen in Exact, Twinfield of Excel.')+'</div></div>';
    const k = el.querySelector('#zCsv');
    if (k) k.addEventListener('click', () => { window.open('/api/supplier/dagrapport.csv?token='+encodeURIComponent(API.token)+'&datum='+r.datum, '_blank'); });
  }

  // horeca: tik gerechten aan, bon loopt op, afrekenen met PIN of contant
  function kassaHoreca(){
    const m = state.menu || [];
    if (!m.length) return '<div class="card"><div style="font-size:0.84rem;color:var(--muted);">'+T('pos.nomenu','Zet eerst gerechten op de menukaart; die worden hier uw kassaknoppen.')+'</div></div>';
    const total = bonTotal();
    const lines = m.filter(x=>bon[x.id]).map(x=>'<div class="pos-line"><span>'+bon[x.id]+'× '+x.name+'</span><span>'+eur(x.price*bon[x.id])+'</span></div>').join('');
    return '<div class="card"><div class="tt-h">'+T('pos.newbon','Nieuwe bon')+'</div>'+
      '<div class="pos-grid">'+m.map(x=>'<button class="pos-key" data-pos="'+x.id+'"><b>'+x.name+'</b><span>'+eur(x.price)+(bon[x.id]?' · '+bon[x.id]+'×':'')+'</span></button>').join('')+'</div>'+
      (lines?'<div class="pos-bon">'+lines+'<div class="pos-line total"><span>'+T('pos.total','Totaal')+'</span><span>'+eur(total)+'</span></div></div>':'')+
      '<div class="pos-pay">'+
        '<button class="obtn" id="posClear"'+(total?'':' disabled')+'>'+T('pos.clear','Leegmaken')+'</button>'+
        '<button class="obtn primary js-pay" data-method="rtgpay"'+(total?'':' disabled')+'>'+T('pos.payrtg','Afrekenen, RTG Pay')+'</button>'+
        '<button class="obtn js-pay" data-method="contant"'+(total?'':' disabled')+'>'+T('pos.cash','Contant')+'</button>'+
      '</div>'+
      ((state.tables||[]).length ? '<div class="pos-pay" style="margin-top:0.4rem;">'+
        '<select id="posTafel" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;">'+
          '<option value="">'+T('pos.tafelkies','Tafel...')+'</option>'+
          (state.tables||[]).map(t=>'<option value="'+t.name.replace(/"/g,'&quot;')+'">'+t.name+'</option>').join('')+'</select>'+
        '<button class="obtn js-pay" data-method="tafel"'+(total?'':' disabled')+'>'+T('pos.optafel','Op de tafel')+'</button>'+
      '</div>' : '')+
      '</div>'+
      // gast toont het oplichtende scherm; sla de code aan om de bestelling uit te geven
      '<div class="card"><div class="tt-h">'+T('pos.redeemh','RTG-ophaalcode innen')+'</div>'+
      '<div style="margin-top:0.4rem;font-size:0.78rem;color:var(--muted);">'+T('pos.redeemsub','De gast laat het oplichtende scherm zien. Sla de code aan; de bestelling wordt gekoppeld, zo nodig afgerekend en uitgegeven.')+'</div>'+
      '<div class="tt-add"><input id="posCode" placeholder="'+T('pos.codeph','Bijv. TBS9')+'" maxlength="4" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:0.2em;font-weight:700;"><button id="posRedeem">'+T('pos.redeem','Innen')+'</button></div>'+
      '<div id="posRedeemResult"></div></div>';
  }

  // hotel: bedrag op de kamer zetten of direct afrekenen
  function kassaHotel(){
    const rooms = state.rooms || [];
    return '<div class="card"><div class="tt-h">'+T('pos.charge','Afrekening of kamerlast')+'</div>'+
      '<div class="field"><label>'+T('pos.roomlbl','Kamer (optioneel)')+'</label><select id="posRoom" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:0.8rem 1rem;font-size:0.9rem;color:var(--txt);outline:none;">'+
        '<option value="">'+T('pos.noroom','Geen kamer, losse verkoop')+'</option>'+
        rooms.map(r=>'<option value="'+r.name.replace(/"/g,'&quot;')+'">'+r.name+'</option>').join('')+'</select></div>'+
      '<div class="field"><label>'+T('pos.desc','Omschrijving')+'</label><input id="posDesc" placeholder="'+T('pos.deschotel','Bijv. minibar, spa, roomservice')+'"></div>'+
      '<div class="field"><label>'+T('pos.amount','Bedrag (€)')+'</label><input id="posAmt" type="number" inputmode="decimal" placeholder="45"></div>'+
      '<div class="pos-pay">'+
        '<button class="obtn primary js-pay" data-method="kamer">'+T('pos.toroom','Op de kamer')+'</button>'+
        '<button class="obtn js-pay" data-method="rtgpay">RTG Pay</button>'+
        '<button class="obtn js-pay" data-method="contant">'+T('pos.cash','Contant')+'</button>'+
      '</div></div>' + kassaOpenRooms();
  }

  // open kamerrekeningen: alles wat op de kamer staat, in één keer uitchecken
  function kassaOpenRooms(){
    const open = (state.pos && state.pos.openRooms) || {};
    const rooms = Object.keys(open);
    if (!rooms.length) return '';
    return '<div class="card"><div class="tt-h">'+T('pos.openrooms','Open kamerrekeningen')+'</div>'+
      rooms.map(r =>
        '<div class="pos-sale"><div><b>'+r+'</b><span>'+open[r].count+' '+T('pos.posts','post(en)')+'</span></div>'+
        '<div class="row-mid-gap"><span class="amt" style="font-family:\'Bodoni Moda\',serif;">'+eur(open[r].total)+'</span>'+
        '<button class="obtn primary js-checkout" data-room="'+r.replace(/"/g,'&quot;')+'" data-method="rtgpay">'+T('pos.checkoutrtg','Check-out, RTG Pay')+'</button>'+
        '<button class="obtn js-checkout" data-room="'+r.replace(/"/g,'&quot;')+'" data-method="contant">'+T('pos.cash','Contant')+'</button></div></div>'
      ).join('')+'</div>';
  }

  // vervoer: rit afrekenen
  function kassaVervoer(){
    return '<div class="card"><div class="tt-h">'+T('pos.ridebill','Rit afrekenen')+'</div>'+
      '<div class="field"><label>'+T('pos.ride','Rit')+'</label><input id="posDesc" placeholder="'+T('pos.descride','Bijv. luchthaven naar Cala Jondal')+'"></div>'+
      '<div class="field"><label>'+T('pos.amount','Bedrag (€)')+'</label><input id="posAmt" type="number" inputmode="decimal" placeholder="28"></div>'+
      '<div class="pos-pay">'+
        '<button class="obtn primary js-pay" data-method="rtgpay">'+T('pos.payrtg','Afrekenen, RTG Pay')+'</button>'+
        '<button class="obtn js-pay" data-method="contant">'+T('pos.cash','Contant')+'</button>'+
      '</div></div>';
  }

  // dagoverzicht: totaal, per betaalmethode, per medewerker, laatste bonnen
  function kassaDay(){
    const p = state.pos || { total:0, count:0, byMethod:{}, byActor:{}, sales:[] };
    let html = '<div class="card"><div class="tt-h">'+T('pos.today','Vandaag')+'</div>'+
      '<div class="pos-day"><b>'+eur(p.total)+'</b><span>'+p.count+' '+T('pos.bons','bon(nen)')+'</span></div>';
    const methods = Object.keys(p.byMethod);
    if (methods.length) html += '<div class="pos-chips">'+methods.map(m=>'<span>'+methodLabel(m)+' '+eur(p.byMethod[m])+'</span>').join('')+(p.fooien?'<span>💛 '+T('pos.fooien','Fooien')+' '+eur(p.fooien)+'</span>':'')+'</div>';
    else if (p.fooien) html += '<div class="pos-chips"><span>💛 '+T('pos.fooien','Fooien')+' '+eur(p.fooien)+'</span></div>';
    const actors = Object.keys(p.byActor);
    if (actors.length>1 || (actors.length===1 && actors[0]!==actor().name))
      html += '<div class="pos-chips actors">'+actors.map(a=>'<span>'+a+' '+eur(p.byActor[a])+'</span>').join('')+'</div>';
    html += p.sales.length
      ? p.sales.map(s=>'<div class="pos-sale"><div><b>'+(s.desc||((s.items||[]).map(i=>i.qty+'× '+i.name).join(', '))||T('pos.sale','Verkoop'))+'</b>'+
          '<span>'+s.bon+' · '+s.actor+(s.room?' · '+s.room:'')+' · '+timeAgo(s.at)+'</span></div>'+
          '<div class="amt">'+eur(s.total)+'<span class="m">'+methodLabel(s.method)+'</span></div></div>').join('')
      : '<div class="softline">'+T('pos.nosales','Nog geen verkopen vandaag.')+'</div>';
    return html + '</div>';
  }

  function bindKassa(type){
    document.querySelectorAll('[data-pos]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.pos; bon[id] = (bon[id]||0)+1; renderKassa(); openTab('kassa');
    }));
    const clear = $('#posClear'); if (clear) clear.addEventListener('click', () => { bon = {}; renderKassa(); openTab('kassa'); });
    document.querySelectorAll('.js-pay').forEach(b => b.addEventListener('click', () => paySale(type, b.dataset.method)));
    const redeem = $('#posRedeem'); if (redeem) redeem.addEventListener('click', redeemCode);
    const codeInp = $('#posCode'); if (codeInp) codeInp.addEventListener('keydown', e => { if (e.key==='Enter') redeemCode(); });
    document.querySelectorAll('.js-checkout').forEach(b => b.addEventListener('click', async () => {
      try {
        const body = { room: b.dataset.room, method: b.dataset.method };
        if (body.method === 'rtgpay'){
          body.payCode = await vraagPayCode(); if (!body.payCode) return;
          body.idem = 'co' + Date.now();
        }
        const d = await API.call('/supplier/pos/checkout', body);
        toast(T('pos.checkedout','Uitgecheckt:')+' '+b.dataset.room+', '+eur(d.sale.total)+' ('+methodLabel(d.sale.method)+')');
        await refresh(); openTab('kassa');
      } catch(e){ toast(e.message); }
    }));
  }

  async function redeemCode(){
    const inp = $('#posCode');
    const code = (inp.value||'').trim().toUpperCase();
    if (!code){ toast(T('pos.entercode','Voer een ophaalcode in.')); return; }
    const box = $('#posRedeemResult');
    try {
      const d = await API.call('/supplier/pos/redeem', { code });
      const o = d.order;
      box.innerHTML = '<div class="enroute here" style="margin-top:0.8rem;">✓ '+code+' · '+T('sup.guest','Gast')+' <b>'+o.codename+'</b> · '+
        o.items.map(i=>i.qty+'× '+i.name).join(', ')+' · '+eur(o.total)+
        (o.wasPaid ? ' · '+T('pos.waspaid','al betaald in de app') : ' · '+T('pos.chargedrtg','afgerekend via RTG'))+'</div>';
      inp.value = '';
      toast(T('pos.redeemed','Uitgegeven aan')+' '+o.codename+'.');
      await refresh(); openTab('kassa');
      $('#posRedeemResult').innerHTML = box.innerHTML;
    } catch(e){
      box.innerHTML = '<div class="enroute" style="margin-top:0.8rem;border-color:rgba(194,58,94,0.4);color:var(--burgundy);">'+e.message+'</div>';
      toast(e.message);
    }
  }

  async function paySale(type, method){
    let body = { method };
    if (type==='restaurant'||type==='bar'||type==='club'){
      const items = (state.menu||[]).filter(m=>bon[m.id]).map(m=>({ name:m.name, qty:bon[m.id], price:m.price }));
      if (!items.length){ toast(T('pos.empty','Tik eerst gerechten aan.')); return; }
      body.items = items; body.total = bonTotal();
      if (method === 'tafel'){
        body.room = (($('#posTafel')||{}).value||'');
        if (!body.room){ toast(T('pos.kiestafel','Kies eerst een tafel.')); return; }
      }
    } else {
      body.total = Number(($('#posAmt')||{}).value);
      body.desc = (($('#posDesc')||{}).value||'').trim();
      const room = ($('#posRoom')||{}).value;
      if (room) body.room = room;
      if (!(body.total>0)){ toast(T('pos.fillamount','Vul een bedrag in.')); return; }
    }
    if (method === 'rtgpay'){
      body.payCode = await vraagPayCode(); if (!body.payCode) return;
      body.idem = 'pos' + Date.now();
    }
    try {
      const d = await API.call('/supplier/pos/sale', body);
      bon = {};
      toast(T('pos.done','Afgerekend:')+' '+eur(d.sale.total)+' ('+methodLabel(d.sale.method)+'), '+T('pos.bonnr','bon')+' '+d.sale.bon);
      await refresh(); openTab('kassa');
    } catch(e){ toast(e.message); }
  }

  // ---- kamers (hotel/appartement): beschikbaarheid + housekeeping ----
  const HK_LABEL = { schoon:'Schoon', vuil:'Vuil', bezig:'Bezig', bezet:'Bezet', defect:'Defect' };
  const HK_LABEL_EN = { schoon:'Clean', vuil:'Dirty', bezig:'In progress', bezet:'Occupied', defect:'Out of order' };
  const tHk = s => (lang() === 'en' ? (HK_LABEL_EN[s] || s) : (HK_LABEL[s] || s));
  let hkDefectFor = null; // kamer-id waarvoor de defect-notitie openstaat
  // ---- tickets: dagprogramma, entree-check en aanbodbeheer ----
  let programma = null;
  async function laadProgramma(){
    if (!has('tickets') || !API.live) return;
    try { programma = await API.call('/supplier/programma', {}); } catch(e){ programma = { datum: '', slots: [] }; } // nooit null laten: dat zou opnieuw laden blijven aanroepen
    renderTickets();
  }
  function renderTickets(){
    const el = $('#ticketsWrap'); if (!el) return;
    if (!has('tickets')){ el.innerHTML = ''; return; }
    if (!programma){ el.innerHTML = '<div class="empty">'+T('tk2.laden','Programma laden\u2026')+'</div>'; laadProgramma(); return; }
    const canEdit = actor().manager;
    let html = '';
    // entree-check: code afvinken op eigen naam
    html += '<div class="card"><div class="tt-h">'+T('tk2.deur','Entree-check')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;">'+
      '<input id="tkCode" placeholder="'+T('tk2.codeph','Entreecode, bijv. K7M2PX')+'" style="flex:1;background:var(--card2,var(--card));border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;font-size:1rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--txt);outline:none;">'+
      '<button class="obtn primary" id="tkCheck">'+T('tk2.binnen','Binnen')+'</button></div>'+
      '<div id="tkUit" style="margin-top:0.5rem;font-size:0.82rem;color:var(--muted);"></div></div>';
    // dagprogramma
    const slots = programma.slots || [];
    html += '<div class="card"><div class="tt-h">'+T('tk2.prog','Programma vandaag')+' \u00B7 '+programma.datum+'</div>'+
      (slots.length ? slots.map((sl, i) =>
        '<div class="mitem"><div class="r1"><span class="nm">'+sl.tijd+' \u00B7 '+esc(sl.naam)+'</span>'+
        '<span class="pr">'+sl.binnen+'/'+sl.verkocht+' '+T('tk2.binnenkort','binnen')+' \u00B7 '+sl.verkocht+'/'+sl.capaciteit+'</span></div>'+
        (sl.gasten.length ? '<div class="ds"><button class="obtn" data-tkg="'+i+'" style="padding:0.2rem 0.8rem;font-size:0.7rem;">'+T('tk2.gasten','Gastenlijst')+' ('+sl.gasten.length+')</button>'+
          '<span id="tkGast-'+i+'" style="display:none;">'+sl.gasten.map(g => '<br>'+(g.binnen?'\u2705':'\u25CB')+' '+esc(g.codename)+' \u00B7 '+g.personen+'p \u00B7 '+g.code).join('')+'</span></div>' : '')+
        '</div>').join('')
      : '<div class="empty">'+T('tk2.leeg','Nog geen tijdsloten. '+(canEdit?'Voeg hieronder een activiteit toe.':''))+'</div>')+'</div>';
    // de eigen transferdienst (chauffeurs van de zaak rijden; ritten in de Ritten-tab)
    const tr = state.transfer;
    if (tr){
      html += '<div class="card"><div class="tt-h">'+T('tk2.transfer','Eigen transferdienst')+'</div>'+
        '<div style="margin-top:0.5rem;font-size:0.85rem;color:'+(tr.aan?'var(--green)':'var(--soft)')+';">'+
        (tr.aan ? '\u25CF '+T('tk2.tr.aan','Aan: gasten met een ticket vragen de transfer aan; uw chauffeurs zien de ritten in de Ritten-tab en op de PDA.')
                : '\u25CB '+T('tk2.tr.uit','Uit.'))+'</div>'+
        '<div style="margin-top:0.4rem;font-size:0.8rem;color:var(--muted);">'+T('tk2.tr.prijs','Prijs per rit:')+' <b style="color:var(--gold);">'+(tr.prijs ? eur(tr.prijs) : T('tk2.tr.incl','inclusief bij het ticket (\u20AC 0)'))+'</b></div>'+
        (canEdit ? '<div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.8rem;flex-wrap:wrap;">'+
          '<button class="obtn'+(tr.aan?'':' primary')+'" data-traan="'+(tr.aan?'0':'1')+'">'+(tr.aan?T('tk2.tr.zetuit','Zet uit'):T('tk2.tr.zetaan','Zet aan'))+'</button>'+
          '<input id="trPrijs" type="number" inputmode="decimal" value="'+(tr.prijs||0)+'" style="width:6rem;background:var(--card2,var(--card));border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.7rem;color:var(--txt);outline:none;">'+
          '<button class="obtn" id="trPrijsZet">'+T('tk2.tr.prijszet','Prijs opslaan')+'</button>'+
          '<span style="font-size:0.68rem;color:var(--soft);">'+T('tk2.tr.nul','0 = inclusief')+'</span></div>' : '')+'</div>';
    }
    // aanbodbeheer (manager)
    const acts = state.activiteiten || [];
    html += '<div class="card"><div class="tt-h">'+T('tk2.aanbod','Aanbod')+' ('+acts.length+')</div>'+
      acts.map(a => '<div class="mitem"><div class="r1"><span class="nm">'+esc(a.name)+'</span><span class="row-mid-gap"><span class="pr">'+eur(a.prijs)+'</span>'+
        (canEdit?'<button class="rr-del" data-tkdel="'+a.id+'">\u2715</button>':'')+'</span></div>'+
        '<div class="ds">'+(a.desc?esc(a.desc)+' \u00B7 ':'')+T('tk2.cap','cap.')+' '+a.capaciteit+' \u00B7 '+(a.tijden||[]).join(', ')+(a.duur?' \u00B7 '+esc(a.duur):'')+'</div></div>').join('')+
      (canEdit ? '<div style="margin-top:1rem;">'+
        '<div class="field"><label>'+T('tk2.f.naam','Activiteit')+'</label><input id="tkName" placeholder="'+T('tk2.f.naamph','Bijv. sunset cruise')+'"></div>'+
        '<div class="field"><label>'+T('tk2.f.desc','Omschrijving')+'</label><input id="tkDesc"></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('tk2.f.prijs','Prijs p.p. (\u20AC)')+'</label><input id="tkPrijs" type="number" inputmode="decimal"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('tk2.f.cap','Capaciteit')+'</label><input id="tkCap" type="number" inputmode="numeric"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('tk2.f.duur','Duur')+'</label><input id="tkDuur" placeholder="2 uur"></div></div>'+
        '<div class="field"><label>'+T('tk2.f.tijden','Tijdsloten (komma\'s)')+'</label><input id="tkTijden" placeholder="10:00, 14:00, 17:30"></div>'+
        '<button class="obtn primary" id="tkAdd">'+T('tk2.f.voeg','Toevoegen')+'</button></div>' : '')+'</div>';
    el.innerHTML = html;
    const check = document.getElementById('tkCheck');
    if (check) check.addEventListener('click', async () => {
      const uit = document.getElementById('tkUit');
      try {
        const r = await API.call('/supplier/ticket/checkin', { code: $('#tkCode').value });
        uit.innerHTML = '<span style="color:var(--green);">\u2705 '+esc(r.ticket.codename)+' \u00B7 '+esc(r.ticket.naam)+' \u00B7 '+r.ticket.personen+'p \u00B7 '+T('tk2.welkom','welkom!')+'</span>';
        $('#tkCode').value = '';
        laadProgramma();
      } catch(e){ uit.innerHTML = '<span style="color:var(--burgundy);">\u26D4 '+esc(e.message)+'</span>'; }
    });
    document.querySelectorAll('[data-traan]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/transfer', { aan: k.dataset.traan === '1' }); await refresh(); openTab('tickets'); } catch(e){ toast(e.message); }
    }));
    const trZet = document.getElementById('trPrijsZet');
    if (trZet) trZet.addEventListener('click', async () => {
      try { await API.call('/supplier/transfer', { prijs: Number($('#trPrijs').value) }); toast(T('tk2.tr.ok','De transferprijs staat vast.')); await refresh(); openTab('tickets'); } catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-tkg]').forEach(k => k.addEventListener('click', () => {
      const g = document.getElementById('tkGast-' + k.dataset.tkg);
      if (g) g.style.display = g.style.display === 'none' ? '' : 'none';
    }));
    document.querySelectorAll('[data-tkdel]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/activiteit', { id: k.dataset.tkdel, weg: true }); await refresh(); await laadProgramma(); openTab('tickets'); } catch(e){ toast(e.message); }
    }));
    const voeg = document.getElementById('tkAdd');
    if (voeg) voeg.addEventListener('click', async () => {
      try {
        await API.call('/supplier/activiteit', { name: $('#tkName').value, desc: $('#tkDesc').value, prijs: Number($('#tkPrijs').value),
          capaciteit: Number($('#tkCap').value), duur: $('#tkDuur').value, tijden: $('#tkTijden').value });
        toast(T('tk2.f.ok','De activiteit staat in het aanbod.'));
        await refresh(); await laadProgramma(); openTab('tickets');
      } catch(e){ toast(e.message); }
    });
  }

  // ---- autoverhuur: vloot, huren, foto's, SOS ----
  let huren = null;
  function fotoKlein(file, cb){
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => {
      const c = document.createElement('canvas'); const sc = Math.min(1, 900 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.7));
    }; img.src = r.result; };
    r.readAsDataURL(file);
  }
  async function laadHuren(){
    if (!has('huur') || !API.live) return;
    try { huren = (await API.call('/supplier/huur/overzicht')).huren; } catch(e){ huren = []; }
    renderVerhuur();
  }
  const HUUR_ST = { 'aangevraagd': 'geboekt, klaar voor uitgifte', 'lopend': 'onderweg met de gast', 'afgerond': 'afgerond' };
  function renderVerhuur(){
    const el = $('#huurWrap'); if (!el) return;
    if (!has('huur')){ el.innerHTML = ''; return; }
    if (huren === null){ el.innerHTML = '<div class="empty">\u2026</div>'; laadHuren(); return; }
    const canEdit = actor().manager;
    let html = '';
    // lopende en geboekte huren
    html += '<div class="card"><div class="tt-h">'+T('vh.huren','Huren')+' ('+huren.length+')</div>'+
      (huren.length ? huren.map(h => {
        let knop = '';
        if (h.status === 'aangevraagd') knop =
          '<button class="obtn" data-vhfoto="'+h.ref+'" data-fase="voor">\uD83D\uDCF7 '+T('vh.fotovoor','Voor-foto')+' ('+h.fotosVoor+')</button> '+
          '<button class="obtn primary" data-vhst="'+h.ref+'" data-st="lopend">'+T('vh.uitgeven','Uitgeven')+'</button>';
        else if (h.status === 'lopend') knop =
          '<button class="obtn" data-vhfoto="'+h.ref+'" data-fase="na">\uD83D\uDCF7 '+T('vh.fotona','Na-foto')+' ('+h.fotosNa+')</button> '+
          '<button class="obtn primary" data-vhst="'+h.ref+'" data-st="afgerond">'+T('vh.innemen','Innemen en afronden')+'</button>';
        return '<div class="mitem">'+
          (h.sos && h.sos.length ? '<div style="background:rgba(194,58,94,0.16);border:1px solid var(--burgundy);border-radius:10px;padding:0.5rem 0.7rem;margin-bottom:0.5rem;font-size:0.8rem;">\uD83D\uDEA8 <b>SOS:</b> '+esc(h.sos[0].bericht)+
            (Number.isFinite(h.sos[0].lat) ? ' \u00B7 <a style="color:var(--gold);" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='+h.sos[0].lat+','+h.sos[0].lng+'">'+T('vh.kaart','kaart')+'</a>' : '')+
            ' <button class="obtn" data-vhsosok="'+h.ref+'" style="padding:0.15rem 0.7rem;font-size:0.7rem;">'+T('vh.sosok','Afgehandeld')+'</button></div>' : '')+
          '<div class="r1"><span class="nm">'+esc(h.codename)+' \u00B7 '+esc(h.auto)+(h.kenteken?' ('+esc(h.kenteken)+')':'')+'</span><span class="pr">'+eur(h.prijs)+'</span></div>'+
          '<div class="ds">'+h.van+' \u2192 '+h.tot+' \u00B7 '+T('vh.st.'+h.status, HUUR_ST[h.status]||h.status)+
          ' \u00B7 \uD83D\uDCF7 '+h.fotosVoor+'/'+h.fotosNa+(h.borg?' \u00B7 '+T('vh.borg','borg')+' '+eur(h.borg):'')+
          (h.uitgifte ? ' \u00B7 '+h.uitgifte.kmStart+' km' : '')+
          (h.locatie ? ' \u00B7 <a style="color:var(--gold);" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='+h.locatie.lat+','+h.locatie.lng+'">\uD83D\uDCCD '+T('vh.live','live locatie')+'</a>' : '')+'</div>'+
          (h.inname ? '<div class="ds" style="color:'+(h.inname.meerkosten>0?'var(--gold)':'var(--green)')+';">'+
            (h.inname.meerkosten>0 ? T('vh.meer','Meerkosten')+': '+eur(h.inname.meerkosten)+' ('+h.inname.gereden+' km, '+h.inname.extraKm+' extra'+(h.inname.tankKosten>0?', tank '+eur(h.inname.tankKosten):'')+')'
              : '\u2713 '+h.inname.gereden+' km, '+T('vh.geenmeer','geen meerkosten \u2013 borg vrij'))+'</div>' : '')+
          (knop ? '<div style="margin-top:0.5rem;">'+knop+'</div>' : '')+'</div>';
      }).join('') : '<div class="empty">'+T('vh.geen','Nog geen huren. Betaalde boekingen verschijnen hier live.')+'</div>')+'</div>';
    // de vloot
    const autos = state.autos || [];
    html += '<div class="card"><div class="tt-h">'+T('vh.vloot','Vloot')+' ('+autos.filter(a=>a.actief!==false).length+')</div>'+
      autos.filter(a => a.actief !== false).map(a =>
        '<div class="mitem"><div class="r1"><span class="nm">'+(a.icoon||'\uD83D\uDE97')+' '+esc(a.name)+(a.plate?' \u00B7 '+esc(a.plate):'')+'</span><span class="row-mid-gap"><span class="pr">'+eur(a.dagprijs)+'/'+T('vh.dag','dag')+'</span>'+
        (canEdit?'<button class="rr-del" data-vhdel="'+a.id+'">\u2715</button>':'')+'</span></div>'+
        '<div class="ds">'+esc(a.categorie||'')+' \u00B7 '+(a.transmissie==='automaat'?T('vh.aut','automaat'):T('vh.hand','handgeschakeld'))+' \u00B7 '+esc(a.brandstof||'')+' \u00B7 \uD83D\uDC65 '+(a.stoelen||'-')+' \u00B7 \uD83E\uDDF3 '+(a.bagage||0)+(a.airco?' \u00B7 \u2744\uFE0F':'')+
        ' \u00B7 '+(a.kmPerDag?a.kmPerDag+' km/'+T('vh.dag','dag')+' (+'+eur(a.meerKm||0)+'/km)':T('vh.onbeperkt','onbeperkt km'))+' \u00B7 '+T('vh.borg','borg')+' '+eur(a.borg||0)+' \u00B7 '+T('vh.vanaf','vanaf')+' '+(a.minLeeftijd||21)+' jr</div></div>').join('')+
      (canEdit ? '<details style="margin-top:1rem;"><summary style="cursor:pointer;font-size:0.82rem;color:var(--gold);">'+T('vh.f.nieuw','Auto toevoegen')+'</summary><div style="margin-top:0.8rem;">'+
        '<div class="row-gap"><div class="field" style="flex:2;"><label>'+T('vh.f.auto','Auto')+'</label><input id="vhName" placeholder="Fiat 500 Cabrio"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.kenteken','Kenteken')+'</label><input id="vhPlate"></div></div>'+
        '<div class="field"><label>'+T('vh.f.cat','Categorie')+'</label><input id="vhCat" placeholder="Compact cabrio"></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.trans','Schakeling')+'</label><select id="vhTrans" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"><option value="handgeschakeld">'+T('vh.hand','handgeschakeld')+'</option><option value="automaat">'+T('vh.aut','automaat')+'</option></select></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.brand','Brandstof')+'</label><select id="vhBrand" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"><option value="benzine">benzine</option><option value="diesel">diesel</option><option value="elektrisch">elektrisch</option><option value="hybride">hybride</option></select></div></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.stoelen','Stoelen')+'</label><input id="vhStoelen" type="number" inputmode="numeric" value="5"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.deuren','Deuren')+'</label><input id="vhDeuren" type="number" inputmode="numeric" value="4"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.bagage','Koffers')+'</label><input id="vhBagage" type="number" inputmode="numeric" value="2"></div></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.prijs','\u20AC/dag')+'</label><input id="vhPrijs" type="number" inputmode="numeric"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.borg','Borg \u20AC')+'</label><input id="vhBorg" type="number" inputmode="numeric" value="300"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.leeftijd','Min. lft')+'</label><input id="vhLft" type="number" inputmode="numeric" value="21"></div></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.km','Km/dag (0=onbep.)')+'</label><input id="vhKm" type="number" inputmode="numeric" value="200"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.meerkm','\u20AC per extra km')+'</label><input id="vhMeerkm" type="number" inputmode="decimal" value="0.25"></div>'+
        '<label class="field" style="flex:1;display:flex;align-items:center;gap:0.4rem;"><input type="checkbox" id="vhAirco" checked style="accent-color:var(--gold);"> '+T('vh.f.airco','Airco')+'</label></div>'+
        '<button class="obtn primary" id="vhAdd">'+T('vh.f.voeg','Toevoegen')+'</button></div></details>' : '')+'</div>'+
      '<input type="file" id="vhFile" accept="image/*" capture="environment" style="display:none;">';
    el.innerHTML = html;
    document.querySelectorAll('[data-vhst]').forEach(k => k.addEventListener('click', async () => {
      const body = { ref: k.dataset.vhst, status: k.dataset.st };
      if (k.dataset.st === 'lopend'){
        const km = prompt(T('vh.q.kmstart','Km-stand bij uitgifte?')); if (km == null) return;
        body.kmStart = Number(km);
        const tank = prompt(T('vh.q.tankstart','Tankniveau bij uitgifte in achtsten (8 = vol)?'), '8'); body.tankStart = Number(tank);
      } else if (k.dataset.st === 'afgerond'){
        const km = prompt(T('vh.q.kmeind','Km-stand bij inname?')); if (km == null) return;
        body.kmEind = Number(km);
        const tank = prompt(T('vh.q.tankeind','Tankniveau bij inname in achtsten (8 = vol)?'), '8'); body.tankEind = Number(tank);
      }
      try { await API.call('/supplier/huur/status', body); await laadHuren(); openTab('huur'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vhsosok]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/huur/sos-ok', { ref: k.dataset.vhsosok }); await laadHuren(); openTab('huur'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vhfoto]').forEach(k => k.addEventListener('click', () => {
      const file = document.getElementById('vhFile');
      file.onchange = () => {
        if (!file.files[0]) return;
        fotoKlein(file.files[0], async (dataUrl) => {
          try { await API.call('/supplier/huur/foto', { ref: k.dataset.vhfoto, fase: k.dataset.fase, foto: dataUrl });
            toast(T('vh.foto.ok','De staat is vastgelegd.')); await laadHuren(); openTab('huur'); }
          catch(e){ toast(e.message); }
        });
        file.value = '';
      };
      file.click();
    }));
    document.querySelectorAll('[data-vhdel]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/auto', { id: k.dataset.vhdel, weg: true }); await refresh(); openTab('huur'); } catch(e){ toast(e.message); }
    }));
    const voeg = document.getElementById('vhAdd');
    if (voeg) voeg.addEventListener('click', async () => {
      const g = id => $(id) ? $(id).value : undefined;
      try { await API.call('/supplier/auto', { name: g('#vhName'), plate: g('#vhPlate'), dagprijs: Number(g('#vhPrijs')),
        categorie: g('#vhCat'), transmissie: g('#vhTrans'), brandstof: g('#vhBrand'),
        stoelen: Number(g('#vhStoelen')), deuren: Number(g('#vhDeuren')), bagage: Number(g('#vhBagage')),
        borg: Number(g('#vhBorg')), minLeeftijd: Number(g('#vhLft')), kmPerDag: Number(g('#vhKm')),
        meerKm: Number(g('#vhMeerkm')), airco: $('#vhAirco') ? $('#vhAirco').checked : true });
        toast(T('vh.f.ok','De auto staat in de vloot.')); await refresh(); openTab('huur'); } catch(e){ toast(e.message); }
    });
  }

  // ---- charter: boten en jachten ----
  let charters = null;
  async function laadCharters(){
    if (!has('charter') || !API.live) return;
    try { charters = (await API.call('/supplier/charter/overzicht')).charters; } catch(e){ charters = []; }
    renderCharter();
  }
  const CHARTER_ST = { 'aangevraagd': 'geboekt, klaar om uit te varen', 'lopend': 'onderweg op zee', 'afgerond': 'afgerond' };
  const BOOT_TYPES = ['Motorjacht','Zeiljacht','Catamaran','RIB','Sloep'];
  function renderCharter(){
    const el = $('#charterWrap'); if (!el) return;
    if (!has('charter')){ el.innerHTML = ''; return; }
    if (charters === null){ el.innerHTML = '<div class="empty">…</div>'; laadCharters(); return; }
    const canEdit = actor().manager;
    const selCss = 'style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"';
    let html = '';
    // lopende en geboekte charters
    html += '<div class="card"><div class="tt-h">'+T('ch.charters','Charters')+' ('+charters.length+')</div>'+
      (charters.length ? charters.map(c => {
        let knop = '';
        if (c.status === 'aangevraagd') knop =
          '<button class="obtn" data-chfoto="'+c.ref+'" data-fase="voor">📷 '+T('ch.fotovoor','Voor-foto')+' ('+c.fotosVoor+')</button> '+
          '<button class="obtn primary" data-chst="'+c.ref+'" data-st="lopend">'+T('ch.uitvaren','Uitvaren')+'</button>';
        else if (c.status === 'lopend') knop =
          '<button class="obtn" data-chfoto="'+c.ref+'" data-fase="na">📷 '+T('ch.fotona','Na-foto')+' ('+c.fotosNa+')</button> '+
          '<button class="obtn primary" data-chst="'+c.ref+'" data-st="afgerond">'+T('ch.teruggeven','Teruggeven en afronden')+'</button>';
        return '<div class="mitem">'+
          (c.sos && c.sos.length ? '<div style="background:rgba(194,58,94,0.16);border:1px solid var(--burgundy);border-radius:10px;padding:0.5rem 0.7rem;margin-bottom:0.5rem;font-size:0.8rem;">🚨 <b>SOS:</b> '+esc(c.sos[0].bericht)+
            (Number.isFinite(c.sos[0].lat) ? ' · <a style="color:var(--gold);" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='+c.sos[0].lat+','+c.sos[0].lng+'">'+T('ch.kaart','kaart')+'</a>' : '')+
            ' <button class="obtn" data-chsosok="'+c.ref+'" style="padding:0.15rem 0.7rem;font-size:0.7rem;">'+T('ch.sosok','Afgehandeld')+'</button></div>' : '')+
          '<div class="r1"><span class="nm">'+esc(c.codename)+' · '+esc(c.boot)+' ('+esc(c.type)+')</span><span class="pr">'+eur(c.prijs)+'</span></div>'+
          '<div class="ds">'+c.van+' → '+c.tot+' · '+(c.gasten?c.gasten+' '+T('ch.gasten','gasten')+' · ':'')+(c.metSkipper?'⚓ '+T('ch.metskipper','met schipper')+(c.skipperNaam?' ('+esc(c.skipperNaam)+')':''):T('ch.bareboat','bareboat'))+' · '+T('ch.st.'+c.status, CHARTER_ST[c.status]||c.status)+
          ' · 📷 '+c.fotosVoor+'/'+c.fotosNa+(c.borg?' · '+T('ch.borg','borg')+' '+eur(c.borg):'')+
          (c.uitvaart ? ' · '+c.uitvaart.urenStart+' '+T('ch.uur','mu') : '')+
          (c.locatie ? ' · <a style="color:var(--gold);" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='+c.locatie.lat+','+c.locatie.lng+'">📍 '+T('ch.live','live positie')+'</a>' : '')+'</div>'+
          (c.teruggave ? '<div class="ds" style="color:'+(c.teruggave.meerkosten>0?'var(--gold)':'var(--green)')+';">'+
            (c.teruggave.meerkosten>0 ? T('ch.meer','Meerkosten')+': '+eur(c.teruggave.meerkosten)+' ('+c.teruggave.gevaren+' '+T('ch.uur','mu')+(c.teruggave.brandstofKosten>0?', '+T('ch.brandstof','brandstof')+' '+eur(c.teruggave.brandstofKosten):'')+')'
              : '✓ '+c.teruggave.gevaren+' '+T('ch.uur','mu')+', '+T('ch.geenmeer','geen meerkosten, borg vrij'))+'</div>' : '')+
          (knop ? '<div style="margin-top:0.5rem;">'+knop+'</div>' : '')+'</div>';
      }).join('') : '<div class="empty">'+T('ch.geen','Nog geen charters. Betaalde boekingen verschijnen hier live.')+'</div>')+'</div>';
    // de vloot
    const boten = state.boten || [];
    html += '<div class="card"><div class="tt-h">'+T('ch.vloot','Vloot')+' ('+boten.filter(b=>b.actief!==false).length+')</div>'+
      boten.filter(b => b.actief !== false).map(b =>
        '<div class="mitem"><div class="r1"><span class="nm">'+(b.icoon||'🛥️')+' '+esc(b.naam)+'</span><span class="row-mid-gap"><span class="pr">'+eur(b.dagprijs)+'/'+T('ch.dag','dag')+'</span>'+
        (canEdit?'<button class="rr-del" data-chdel="'+b.id+'">✕</button>':'')+'</span></div>'+
        '<div class="ds">'+esc(b.type||'')+' · '+(b.lengte||0)+'m · 👥 '+(b.gasten||0)+(b.hutten?' · 🛏️ '+b.hutten+' '+T('ch.hutten','hutten'):'')+' · '+esc(b.brandstof||'')+' · '+(b.snelheidKn||0)+' kn · '+esc(b.ligplaats||'')+
        ' · '+T('ch.borg','borg')+' '+eur(b.borg||0)+' · '+(b.skipperVerplicht?'⚓ '+T('ch.skipperv','schipper verplicht'):(b.vaarbewijsVereist?T('ch.vaarbewijs','vaarbewijs vereist'):T('ch.vrij','vrij te huren')))+
        (b.skipperPrijsPerDag?' (+'+eur(b.skipperPrijsPerDag)+'/'+T('ch.dag','dag')+')':'')+'</div></div>').join('')+
      (canEdit ? '<details style="margin-top:1rem;"><summary style="cursor:pointer;font-size:0.82rem;color:var(--gold);">'+T('ch.f.nieuw','Vaartuig toevoegen')+'</summary><div style="margin-top:0.8rem;">'+
        '<div class="row-gap"><div class="field" style="flex:2;"><label>'+T('ch.f.naam','Naam')+'</label><input id="chNaam" placeholder="Serenidad"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.type','Type')+'</label><select id="chType" '+selCss+'>'+BOOT_TYPES.map(t=>'<option>'+t+'</option>').join('')+'</select></div></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.lengte','Lengte (m)')+'</label><input id="chLengte" type="number" inputmode="decimal" value="14"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.gasten','Gasten')+'</label><input id="chGasten" type="number" inputmode="numeric" value="10"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.hutten','Hutten')+'</label><input id="chHutten" type="number" inputmode="numeric" value="2"></div></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.brand','Brandstof')+'</label><select id="chBrand" '+selCss+'><option value="diesel">diesel</option><option value="benzine">benzine</option><option value="elektrisch">elektrisch</option><option value="geen">geen</option></select></div>'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.snelheid','Snelheid (kn)')+'</label><input id="chSnelheid" type="number" inputmode="numeric" value="24"></div></div>'+
        '<div class="field"><label>'+T('ch.f.ligplaats','Ligplaats')+'</label><input id="chLig" placeholder="Marina Botafoch"></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.prijs','€/dag')+'</label><input id="chPrijs" type="number" inputmode="numeric"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.borg','Borg €')+'</label><input id="chBorg" type="number" inputmode="numeric" value="2000"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.skipperprijs','Schipper €/dag')+'</label><input id="chSkPrijs" type="number" inputmode="numeric" value="300"></div></div>'+
        '<label class="field" style="display:flex;align-items:center;gap:0.4rem;"><input type="checkbox" id="chSkV" style="accent-color:var(--gold);"> '+T('ch.f.skipperv','Schipper verplicht')+'</label>'+
        '<label class="field" style="display:flex;align-items:center;gap:0.4rem;"><input type="checkbox" id="chVb" checked style="accent-color:var(--gold);"> '+T('ch.f.vaarbewijs','Vaarbewijs vereist bij bareboat')+'</label>'+
        '<button class="obtn primary" id="chAdd">'+T('ch.f.voeg','Toevoegen')+'</button></div></details>' : '')+'</div>'+
      '<input type="file" id="chFile" accept="image/*" capture="environment" style="display:none;">';
    el.innerHTML = html;
    document.querySelectorAll('[data-chst]').forEach(k => k.addEventListener('click', async () => {
      const body = { ref: k.dataset.chst, status: k.dataset.st };
      if (k.dataset.st === 'lopend'){
        const uren = prompt(T('ch.q.urenstart','Motorurenstand bij uitvaren?')); if (uren == null) return;
        body.urenStart = Number(uren);
        body.brandstofStart = Number(prompt(T('ch.q.brandstart','Brandstofniveau bij uitvaren in achtsten (8 = vol)?'), '8'));
      } else if (k.dataset.st === 'afgerond'){
        const uren = prompt(T('ch.q.ureneind','Motorurenstand bij teruggave?')); if (uren == null) return;
        body.urenEind = Number(uren);
        body.brandstofEind = Number(prompt(T('ch.q.brandeind','Brandstofniveau bij teruggave in achtsten (8 = vol)?'), '8'));
      }
      try { await API.call('/supplier/charter/status', body); await laadCharters(); openTab('charter'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-chsosok]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/charter/sos-ok', { ref: k.dataset.chsosok }); await laadCharters(); openTab('charter'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-chfoto]').forEach(k => k.addEventListener('click', () => {
      const file = document.getElementById('chFile');
      file.onchange = () => {
        if (!file.files[0]) return;
        fotoKlein(file.files[0], async (dataUrl) => {
          try { await API.call('/supplier/charter/foto', { ref: k.dataset.chfoto, fase: k.dataset.fase, foto: dataUrl });
            toast(T('ch.foto.ok','De staat is vastgelegd.')); await laadCharters(); openTab('charter'); }
          catch(e){ toast(e.message); }
        });
        file.value = '';
      };
      file.click();
    }));
    document.querySelectorAll('[data-chdel]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/boot', { id: k.dataset.chdel, weg: true }); await refresh(); openTab('charter'); } catch(e){ toast(e.message); }
    }));
    const voeg = document.getElementById('chAdd');
    if (voeg) voeg.addEventListener('click', async () => {
      const g = id => $(id) ? $(id).value : undefined;
      try { await API.call('/supplier/boot', { naam: g('#chNaam'), type: g('#chType'), lengte: Number(g('#chLengte')),
        gasten: Number(g('#chGasten')), hutten: Number(g('#chHutten')), brandstof: g('#chBrand'), snelheidKn: Number(g('#chSnelheid')),
        ligplaats: g('#chLig'), dagprijs: Number(g('#chPrijs')), borg: Number(g('#chBorg')), skipperPrijsPerDag: Number(g('#chSkPrijs')),
        skipperVerplicht: $('#chSkV') ? $('#chSkV').checked : false, vaarbewijsVereist: $('#chVb') ? $('#chVb').checked : true });
        toast(T('ch.f.ok','Het vaartuig staat in de vloot.')); await refresh(); openTab('charter'); } catch(e){ toast(e.message); }
    });
  }

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

  /* Het receptiebord: vandaag in een oogopslag. Aanvragen bevestigen,
     aankomsten inchecken (de logies gaan meteen als kamerlast op de
     rekening), vertrekken uitchecken; staat er nog iets open, dan wijst
     de check-out naar de kassa. */
  async function laadReceptie(){
    const el = $('#receptieWrap'); if (!el) return;
    let r; try { r = await API.call('/supplier/receptie', {}); } catch(e){ el.innerHTML = ''; return; }
    const leeg = !r.aanvragen.length && !r.aankomsten.length && !r.inHuis.length && !r.komend.length;
    const rij = (v, knoppen, sub) => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;margin-top:0.55rem;font-size:0.82rem;flex-wrap:wrap;" data-vb="'+v.id+'">'+
      '<span><b class="cn">'+esc(v.codenaam)+'</b> · '+esc(v.roomName)+' · '+(sub||v.aankomst+' tot '+v.vertrek+' · '+v.personen+'p · '+eur(v.totaal))+
      (v.notitie?' · 📝 '+esc(v.notitie):'')+'</span>'+
      (knoppen?'<span style="display:flex;gap:0.4rem;flex-shrink:0;flex-wrap:wrap;">'+knoppen+'</span>':'')+
    '</div>';
    el.innerHTML = '<div class="card"><div class="tt-h">🛎️ '+T('rc.h','Receptie vandaag')+'</div>'+
      '<div class="pos-chips" style="margin-top:0.4rem;">'+
        '<span>🛏 '+r.bezetting.bezet+' / '+r.bezetting.totaal+' '+T('rc.bezet','bezet')+'</span>'+
        (r.bezetting.vuil?'<span>🧹 '+r.bezetting.vuil+' '+T('rc.vuil','voor housekeeping')+'</span>':'')+
        (r.aanvragen.length?'<span>✋ '+r.aanvragen.length+' '+T('rc.aanvragen','aanvraag(en)')+'</span>':'')+
      '</div>'+
      (r.aanvragen.length?'<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('rc.nieuw','Aanvragen')+'</div>'+r.aanvragen.map(v => rij(v,
        '<button class="obtn primary js-vbok">'+T('res.ok','Bevestig')+'</button><button class="obtn warn js-vbnee">'+T('sup.reject','Weiger')+'</button>')).join(''):'')+
      (r.aankomsten.length?'<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('rc.aankomst','Aankomsten')+'</div>'+r.aankomsten.map(v => rij(v,
        '<button class="obtn primary js-vbin">🗝️ '+T('rc.checkin','Check-in')+'</button><button class="obtn warn js-vbnoshow">'+T('res.noshow','No-show')+'</button>')).join(''):'')+
      (r.inHuis.length?'<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('rc.inhuis','In huis')+'</div>'+r.inHuis.map(v => rij(v,
        '<button class="obtn js-vbuit">'+T('rc.checkout','Check-out')+'</button>',
        T('rc.tot','tot')+' '+v.vertrek+(v.vertrek<=r.datum?' · <b style="color:var(--gold);">'+T('rc.vandaagweg','vertrekt vandaag')+'</b>':'')+(v.openLast?' · '+T('rc.open','rekening')+' <b>'+eur(v.openLast)+'</b>':''))).join(''):'')+
      (r.komend.length?'<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('rc.komend','Komende dagen')+'</div>'+r.komend.map(v => rij(v, '')).join(''):'')+
      (leeg?'<div class="softline" style="margin-top:0.5rem;">'+T('rc.leeg','Nog geen verblijven. Zodra een gast boekt, staat het hier.')+'</div>':'')+
      '</div>';
    el.querySelectorAll('[data-vb]').forEach(elv => {
      const id = elv.dataset.vb;
      const doe = async (pad, body, boodschap) => {
        try { await API.call(pad, Object.assign({ id }, body)); if (boodschap) toast(boodschap); await refresh(); laadReceptie(); }
        catch(e){ toast(e.message); }
      };
      const ok = elv.querySelector('.js-vbok'); if (ok) ok.addEventListener('click', () => doe('/supplier/verblijf/beslis', { actie:'bevestig' }, '🛎️ '+T('rc.oktoast','Bevestigd; de gast hoort het meteen.')));
      const nee = elv.querySelector('.js-vbnee'); if (nee) nee.addEventListener('click', () => doe('/supplier/verblijf/beslis', { actie:'weiger' }, T('rc.neetoast','Geweigerd.')));
      const inb = elv.querySelector('.js-vbin'); if (inb) inb.addEventListener('click', () => doe('/supplier/verblijf/checkin', {}, '🗝️ '+T('rc.intoast','Ingecheckt; de logies staan op de kamerrekening.')));
      const uit = elv.querySelector('.js-vbuit'); if (uit) uit.addEventListener('click', () => doe('/supplier/verblijf/checkout', {}, T('rc.uittoast','Uitgecheckt; de kamer staat klaar voor housekeeping.')));
      const ns = elv.querySelector('.js-vbnoshow'); if (ns) ns.addEventListener('click', () => doe('/supplier/verblijf/noshow', {}, T('rc.noshowtoast','Gemeld als no-show; de kamer blijft vrij.')));
    });
  }

  function renderRooms(){
    const el = $('#roomsWrap'); if (!el) return;
    const rooms = state.rooms;
    if (!Array.isArray(rooms)){ el.innerHTML = ''; return; }
    let html = '<div id="receptieWrap"></div><div class="card">';
    html += rooms.length ? rooms.map(r => {
      const hk = (r.hk && r.hk.status) || 'schoon';
      return '<div class="room-row'+(r.available?'':' off')+'" style="flex-wrap:wrap;">'+
        '<div class="rr-t"><b>'+r.name+' <span class="hk-pill hk-'+hk+'">'+tHk(hk)+'</span>'+
          (r.vroegVrij ? ' <span class="hk-pill hk-schoon">🛎 '+T('hk.vroegvrij','vroege check-in')+'</span>' : '')+'</b>'+
          '<span>'+(r.desc||'')+' · '+eur(r.price)+' '+T('sup.pernight','p.n.')+
          (r.hk && r.hk.by ? ' · '+r.hk.by+(r.hk.at?', '+timeAgo(r.hk.at):'') : '')+
          (r.vroegVrij ? ' · 🛎 '+T('hk.vroegvrij2','vrijgegeven door housekeeping')+' ('+r.vroegVrij.door+')' : '')+
          (hk==='defect' && r.hk.note ? ' · ⚠ '+r.hk.note : '')+'</span></div>'+
        '<button class="rr-toggle'+(r.available?' on':'')+'" data-rtoggle="'+r.id+'" aria-label="aan/uit"><span></span></button>'+
        '<button class="rr-del" data-rdel="'+r.id+'">✕</button>'+
        '<div class="hk-chips">'+['schoon','vuil','bezig','bezet','defect'].map(s =>
          '<button class="hk-chip hk-'+s+(hk===s?' on':'')+'" data-hk="'+r.id+'" data-hkst="'+s+'">'+tHk(s)+'</button>').join('')+'</div>'+
        (hkDefectFor===r.id ? '<div class="tt-add" style="width:100%;"><input id="hkNote" placeholder="'+T('hk.noteph','Wat is er kapot?')+'"><button id="hkNoteOk">'+T('hk.report','Meld defect')+'</button></div>' : '')+
      '</div>';
    }).join('') : '<div class="softline">'+T('sup.norooms','Nog geen kamers. Voeg uw eerste kamer toe.')+'</div>';
    html += '<div class="tt-add" style="flex-wrap:wrap;">'+
      '<input id="rmName" placeholder="'+T('sup.roomname','Kamernaam')+'" style="flex:2;min-width:120px;">'+
      '<input id="rmPrice" type="number" inputmode="decimal" placeholder="€" style="flex:1;min-width:70px;">'+
      '<button id="rmAdd">'+T('team.add','Toevoegen')+'</button></div>';
    html += '<div class="note-soft">'+T('sup.roomnote','Uit = direct onzichtbaar voor gasten en de backoffice, zonder telefoontjes.')+'</div>';
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-rtoggle]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/toggle', { id: b.dataset.rtoggle }); await refresh(); openTab('rooms'); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-hk]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.hk, st = b.dataset.hkst;
      if (st === 'defect'){ hkDefectFor = id; renderRooms(); openTab('rooms'); const n = $('#hkNote'); if (n) n.focus(); return; }
      hkDefectFor = null;
      try { await API.call('/supplier/room/hk', { id, status: st }); await refresh(); openTab('rooms'); } catch(e){ toast(e.message); }
    }));
    const hkOk = $('#hkNoteOk'); if (hkOk) hkOk.addEventListener('click', async () => {
      const note = ($('#hkNote').value || '').trim();
      const id = hkDefectFor; hkDefectFor = null;
      try { await API.call('/supplier/room/hk', { id, status: 'defect', note }); toast(T('hk.reported','Defect gemeld, klus staat klaar voor onderhoud en de kamer is uit de verkoop.')); await refresh(); openTab('rooms'); }
      catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-rdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/remove', { id: b.dataset.rdel }); toast(T('sup.roomremoved','Kamer verwijderd.')); await refresh(); openTab('rooms'); } catch(e){ toast(e.message); }
    }));
    const add = $('#rmAdd'); if (add) add.addEventListener('click', async () => {
      const name = $('#rmName').value.trim(), price = Number($('#rmPrice').value);
      if (!name || !(price>0)){ toast(T('sup.roomfill','Vul een kamernaam en prijs in.')); return; }
      try { await API.call('/supplier/room/add', { name, price }); toast(T('sup.roomadded','Kamer toegevoegd en direct zichtbaar.')); await refresh(); openTab('rooms'); } catch(e){ toast(e.message); }
    });
    laadReceptie();
  }

  // ---- minibar-telling per kamer ----
  let mbRoom = null;       // gekozen kamer
  let mbQty = {};          // artikel-id -> gebruikt aantal
  function renderMinibar(){
    const el = $('#minibarWrap'); if (!el) return;
    const mb = state.minibar;
    if (!mb){ el.innerHTML = ''; return; }
    const rooms = (state.rooms || []).map(r => r.name);
    if (mbRoom && !rooms.includes(mbRoom)) mbRoom = null;

    // telling invoeren
    let html = '<div class="card"><div class="tt-h">' + T('mb.count','Telling invoeren') + '</div>';
    html += '<div class="mb-rooms">' + rooms.map(r => {
      const done = mb.countedToday.includes(r);
      return '<button class="mb-room' + (mbRoom === r ? ' on' : '') + '" data-mbroom="' + r.replace(/"/g,'&quot;') + '">' + (done ? '✓ ' : '') + r + '</button>';
    }).join('') + '</div>';
    if (mbRoom){
      html += '<div style="margin-top:0.8rem;font-size:0.74rem;color:var(--soft);">' + T('mb.howmany','Hoeveel is er gebruikt uit') + ' ' + mbRoom + '?</div>';
      html += mb.catalog.map(m => {
        const q = mbQty[m.id] || 0;
        return '<div class="mb-item"><div class="mi"><b>' + m.name + '</b><span>' + eur(m.price) + '</span></div>' +
          '<div class="qty"><button data-mbmin="' + m.id + '">−</button><b>' + q + '</b><button data-mbplus="' + m.id + '">+</button></div></div>';
      }).join('');
      const total = mb.catalog.reduce((s, m) => s + m.price * (mbQty[m.id] || 0), 0);
      html += '<button class="bigbtn" id="mbSubmit">' + (total > 0
        ? T('mb.register','Registreer telling') + ', ' + eur(total) + ' ' + T('mb.toroom','op de kamer')
        : T('mb.registerzero','Registreer: niets gebruikt')) + '</button>';
    }
    html += '</div>';

    // vandaag-overzicht
    const notCounted = rooms.filter(r => !mb.countedToday.includes(r));
    html += '<div class="card"><div class="tt-h">' + T('mb.today','Vandaag geteld') + ' (' + mb.countedToday.length + '/' + rooms.length + ')</div>' +
      (notCounted.length
        ? '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--amber);">' + T('mb.todo','Nog tellen:') + ' ' + notCounted.join(', ') + '</div>'
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--green);">✓ ' + T('mb.alldone','Alle kamers zijn vandaag geteld.') + '</div>') +
      (mb.recent.length ? mb.recent.map(e =>
        '<div class="pos-sale"><div><b>' + e.room + '</b><span>' + (e.items.length ? e.items.map(i => i.qty + 'x ' + i.name).join(', ') : T('mb.nothing','niets gebruikt')) + ' · ' + e.actor + ' · ' + timeAgo(e.at) + '</span></div>' +
        '<div class="amt" style="font-family:\'Bodoni Moda\',serif;">' + (e.total ? eur(e.total) : '') + '</div></div>').join('') : '') +
      '</div>';

    // catalogus
    html += '<div class="card"><div class="tt-h">' + T('mb.catalog','Catalogus') + '</div>' +
      mb.catalog.map(m => '<div class="pos-sale"><div><b>' + m.name + '</b></div><div class="row-mid-gap"><span class="amt" style="font-family:\'Bodoni Moda\',serif;">' + eur(m.price) + '</span><button class="rr-del" data-mbdel="' + m.id + '">✕</button></div></div>').join('') +
      '<div class="tt-add"><input id="mbName" placeholder="' + T('mb.newitem','Nieuw artikel') + '" style="flex:2;min-width:110px;"><input id="mbPrice" type="number" inputmode="decimal" placeholder="€" style="flex:1;min-width:60px;"><button id="mbAdd">' + T('team.add','Toevoegen') + '</button></div></div>';

    el.innerHTML = html;
    el.querySelectorAll('[data-mbroom]').forEach(b => b.addEventListener('click', () => { mbRoom = b.dataset.mbroom; mbQty = {}; renderMinibar(); openTab('minibar'); }));
    el.querySelectorAll('[data-mbplus]').forEach(b => b.addEventListener('click', () => { mbQty[b.dataset.mbplus] = (mbQty[b.dataset.mbplus] || 0) + 1; renderMinibar(); openTab('minibar'); }));
    el.querySelectorAll('[data-mbmin]').forEach(b => b.addEventListener('click', () => { mbQty[b.dataset.mbmin] = Math.max(0, (mbQty[b.dataset.mbmin] || 0) - 1); renderMinibar(); openTab('minibar'); }));
    const sub = $('#mbSubmit'); if (sub) sub.addEventListener('click', submitMinibar);
    el.querySelectorAll('[data-mbdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/minibar/item/remove', { id: b.dataset.mbdel }); await refresh(); openTab('minibar'); } catch(e){ toast(e.message); }
    }));
    const add = $('#mbAdd'); if (add) add.addEventListener('click', async () => {
      const name = $('#mbName').value.trim(), price = Number($('#mbPrice').value);
      if (!name || !(price > 0)){ toast(T('mb.fill','Vul een artikel en prijs in.')); return; }
      try { await API.call('/supplier/minibar/item/add', { name, price }); toast(T('mb.added','Artikel toegevoegd.')); await refresh(); openTab('minibar'); } catch(e){ toast(e.message); }
    });
  }
  async function submitMinibar(){
    if (!mbRoom) return;
    const items = Object.entries(mbQty).filter(([,q]) => q > 0).map(([id, qty]) => ({ id, qty }));
    try {
      const d = await API.call('/supplier/minibar/count', { room: mbRoom, items });
      toast(d.charged > 0
        ? T('mb.done','Geteld. ') + eur(d.charged) + ' ' + T('mb.charged','op de kamerrekening gezet.')
        : T('mb.donezero','Geteld: niets gebruikt.'));
      mbRoom = null; mbQty = {};
      await refresh(); openTab('minibar');
    } catch(e){ toast(e.message); }
  }

  // ---- tafelindeling (horeca) ----
  const TBL_NEXT = { vrij:'bezet', bezet:'gereserveerd', gereserveerd:'dicht', dicht:'vrij' };
  const TBL_EN = { vrij:'free', bezet:'occupied', gereserveerd:'reserved', dicht:'closed' };
  const tTbl = s => (lang()==='en' ? (TBL_EN[s]||s) : s);
  function renderTafels(){
    const el = $('#tafelsWrap'); if (!el) return;
    const tables = state.tables;
    if (!Array.isArray(tables)){ el.innerHTML = ''; return; }
    const canEdit = actor().manager;
    const free = tables.filter(t=>t.status==='vrij').length;
    let html = '<div class="card"><div class="tt-h">'+T('tbl.floor','Zaal')+' · '+free+'/'+tables.length+' '+T('tbl.free','vrij')+'</div>'+
      '<div class="tbl-grid">'+tables.map(t =>
        '<button class="tbl tbl-'+t.status+'" data-tbl="'+t.id+'"><b>'+t.name+'</b><span>'+t.seats+' '+T('tbl.pers','pers.')+'</span><i>'+tTbl(t.status)+'</i>'+
        (canEdit?'<em class="tbl-del" data-tdel="'+t.id+'">✕</em>':'')+'</button>'
      ).join('')+'</div>'+
      '<div class="note-soft">'+T('tbl.note','Tik een tafel: vrij, bezet, gereserveerd, dicht. Gasten zien live hoeveel tafels vrij zijn.')+'</div>';
    if (canEdit){
      html += '<div class="tt-add"><input id="tblName" placeholder="'+T('tbl.nameph','Bijv. Tafel 7 of Bar links')+'" style="flex:2;min-width:130px;"><input id="tblSeats" type="number" inputmode="numeric" placeholder="4" style="flex:1;min-width:60px;"><button id="tblAdd">'+T('team.add','Toevoegen')+'</button></div>';
    }
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-tbl]').forEach(b => b.addEventListener('click', async e => {
      if (e.target.classList.contains('tbl-del')) return;
      const t = tables.find(x=>x.id===b.dataset.tbl);
      try { await API.call('/supplier/table/status', { id: t.id, status: TBL_NEXT[t.status]||'vrij' }); await refresh(); openTab('tafels'); } catch(err){ toast(err.message); }
    }));
    el.querySelectorAll('[data-tdel]').forEach(x => x.addEventListener('click', async e => {
      e.stopPropagation();
      try { await API.call('/supplier/table/remove', { id: x.dataset.tdel }); await refresh(); openTab('tafels'); } catch(err){ toast(err.message); }
    }));
    const add = $('#tblAdd'); if (add) add.addEventListener('click', async () => {
      const name = $('#tblName').value.trim(), seats = Number($('#tblSeats').value)||2;
      if (!name){ toast(T('tbl.fill','Geef de tafel een naam.')); return; }
      try { await API.call('/supplier/table/add', { name, seats }); await refresh(); openTab('tafels'); } catch(e){ toast(e.message); }
    });
  }

  // ---- beheer: open/dicht-schakelaars (managers/chefs) ----
  function renderBeheer(){
    const el = $('#beheerWrap'); if (!el) return;
    if (!actor().manager){
      el.innerHTML = '<div class="card"><div style="font-size:0.84rem;color:var(--muted);">'+T('bh.only','Alleen managers en chefs kunnen instellingen aanpassen. Vraag uw manager.')+'</div></div>';
      return;
    }
    const st = state.settings || { ordersOpen: true, reservationsOpen: true };
    const row = (key, label, sub, on) =>
      '<div class="room-row"><div class="rr-t"><b>'+label+'</b><span>'+sub+'</span></div>'+
      '<button class="rr-toggle'+(on?' on':'')+'" data-set="'+key+'" data-val="'+(!on)+'"><span></span></button></div>';
    el.innerHTML = '<div class="card">'+
      row('ordersOpen', T('bh.orders','Bestellingen'), on1(st.ordersOpen), st.ordersOpen) +
      row('reservationsOpen', T('bh.res','Reserveringen'), on1(st.reservationsOpen), st.reservationsOpen) +
      '<div class="note-soft">'+T('bh.note','Dicht = leden kunnen direct niet meer bestellen of reserveren; de kaart blijft zichtbaar. Alles wordt gelogd.')+'</div></div>'+
      '<div class="card"><div class="tt-h">'+T('bh.more','Verder beheren')+'</div>'+
      '<div style="margin-top:0.5rem;font-size:0.82rem;color:var(--muted);line-height:1.7;">'+T('bh.tips','Menukaart bewerken doet u onder Menu. Tafels onder Tafels. Kamers en prijzen onder Kamers. Personeel en pincodes onder Team.')+'</div></div>';
    function on1(v){ return v ? T('bh.open','Open, gasten kunnen dit nu gebruiken') : T('bh.closed','Dicht, tijdelijk niet beschikbaar'); }
    el.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/settings', { [b.dataset.set]: b.dataset.val === 'true' }); toast(T('bh.saved','Opgeslagen, leden zien het direct.')); await refresh(); openTab('beheer'); } catch(e){ toast(e.message); }
    }));
  }

  // ---- klussen (onderhoud) + gevonden voorwerpen ----
  function renderKlussen(){
    const el = $('#klussenWrap'); if (!el) return;
    if (!has('bookings')){ el.innerHTML = ''; return; }
    const tickets = state.tickets || [];
    const lost = state.lostfound || [];
    const open = tickets.filter(t => t.status !== 'klaar');
    const done = tickets.filter(t => t.status === 'klaar').slice(0, 6);
    const roomOpts = (state.rooms || []).map(r => '<option value="' + r.name.replace(/"/g,'&quot;') + '">' + r.name + '</option>').join('');

    let html = '<div class="card"><div class="tt-h">' + T('tk.open','Openstaande klussen') + ' (' + open.length + ')</div>';
    html += open.length ? open.map(t =>
      '<div class="tk-row"><div class="tk-t"><b>' + t.text + '</b><span>' + (t.room ? t.room + ' · ' : '') + t.by + ' · ' + timeAgo(t.at) + '</span></div>' +
      '<span class="pill ' + (t.status === 'bezig' ? 'bereiding' : 'nieuw') + '">' + (t.status === 'bezig' ? T('tk.busy','bezig') : T('tk.new','open')) + '</span>' +
      (t.status === 'open'
        ? '<button class="obtn primary" data-tk="' + t.id + '" data-tkst="bezig">' + T('tk.pickup','Oppakken') + '</button>'
        : '<button class="obtn primary" data-tk="' + t.id + '" data-tkst="klaar">' + T('tk.done','Klaar') + '</button>') +
      '</div>'
    ).join('') : '<div style="font-size:0.82rem;color:var(--green);padding:0.6rem 0;">✓ ' + T('tk.none','Geen openstaande klussen.') + '</div>';
    html += '<div class="tt-add" style="flex-wrap:wrap;"><input id="tkText" placeholder="' + T('tk.newph','Nieuwe klus, bijv. lamp vervangen') + '" style="flex:2;min-width:140px;">' +
      '<select id="tkRoom" style="background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:0 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;"><option value="">' + T('tk.noroom','Algemeen') + '</option>' + roomOpts + '</select>' +
      '<button id="tkAdd">' + T('team.add','Toevoegen') + '</button></div>';
    if (done.length) html += '<div class="tt-h" style="margin-top:1rem;">' + T('tk.donelist','Afgerond') + '</div>' + done.map(t =>
      '<div class="tk-row done"><div class="tk-t"><b>' + t.text + '</b><span>' + (t.doneBy || '') + (t.doneAt ? ' · ' + timeAgo(t.doneAt) : '') + '</span></div><span class="pill klaar">✓</span></div>').join('');
    html += '</div>';

    html += '<div class="card"><div class="tt-h">' + T('lf.h','Gevonden voorwerpen') + '</div>';
    const kept = lost.filter(l => l.status === 'bewaard');
    html += kept.length ? kept.map(l =>
      '<div class="tk-row"><div class="tk-t"><b>' + l.item + '</b><span>' + (l.room ? l.room + ' · ' : '') + (l.storage ? T('lf.at','ligt bij') + ' ' + l.storage + ' · ' : '') + l.by + ' · ' + timeAgo(l.at) + '</span></div>' +
      '<button class="obtn" data-lf="' + l.id + '">' + T('lf.picked','Opgehaald') + '</button></div>'
    ).join('') : '<div class="softline">' + T('lf.none','Niets in bewaring.') + '</div>';
    html += '<div class="tt-add" style="flex-wrap:wrap;"><input id="lfItem" placeholder="' + T('lf.itemph','Voorwerp, bijv. zonnebril') + '" style="flex:2;min-width:120px;">' +
      '<input id="lfStorage" placeholder="' + T('lf.storageph','Bewaarplek') + '" style="flex:1;min-width:90px;">' +
      '<select id="lfRoom" style="background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:0 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;"><option value="">' + T('lf.noroom','Elders') + '</option>' + roomOpts + '</select>' +
      '<button id="lfAdd">' + T('team.add','Toevoegen') + '</button></div></div>';

    el.innerHTML = html;
    el.querySelectorAll('[data-tk]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/ticket/status', { id: b.dataset.tk, status: b.dataset.tkst }); await refresh(); openTab('klussen'); } catch(e){ toast(e.message); }
    }));
    const ta = $('#tkAdd'); if (ta) ta.addEventListener('click', async () => {
      const text = $('#tkText').value.trim();
      if (!text){ toast(T('tk.fill','Omschrijf de klus.')); return; }
      try { await API.call('/supplier/ticket/add', { text, room: $('#tkRoom').value }); toast(T('tk.added','Klus gemeld.')); await refresh(); openTab('klussen'); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-lf]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/lost/done', { id: b.dataset.lf }); toast(T('lf.pickedtoast','Meegegeven en afgemeld.')); await refresh(); openTab('klussen'); } catch(e){ toast(e.message); }
    }));
    const la = $('#lfAdd'); if (la) la.addEventListener('click', async () => {
      const item = $('#lfItem').value.trim();
      if (!item){ toast(T('lf.fill','Omschrijf het voorwerp.')); return; }
      try { await API.call('/supplier/lost/add', { item, storage: $('#lfStorage').value, room: $('#lfRoom').value }); toast(T('lf.added','Geregistreerd.')); await refresh(); openTab('klussen'); } catch(e){ toast(e.message); }
    });
  }

  // ---- slimme deuren (appartementen) ----
  function renderDoors(){
    const el = $('#doorsWrap'); if (!el) return;
    const doors = state.doors;
    if (!Array.isArray(doors)){ el.innerHTML = ''; return; }
    el.innerHTML = '<div class="card">'+
      (doors.length ? doors.map(d =>
        '<div class="door-row'+(d.locked?'':' open')+'">'+
          '<span class="dl">'+(d.locked?'🔒':'🔓')+'</span>'+
          '<div class="dt"><b>'+d.name+'</b><span>'+(d.locked?T('door.locked','Vergrendeld'):T('door.open','OPEN, vergrendelt zichzelf'))+
            (d.lastBy?' · '+T('door.lastby','laatst:')+' '+d.lastBy+(d.lastAt?', '+timeAgo(d.lastAt):''):'')+'</span></div>'+
          '<button class="obtn'+(d.locked?' primary':' warn')+'" data-door="'+d.id+'">'+(d.locked?T('door.openbtn','Open 10 sec'):T('door.lockbtn','Vergrendel nu'))+'</button>'+
        '</div>'
      ).join('') : '<div class="softline">'+T('door.none','Nog geen digitale deuren gekoppeld.')+'</div>')+
      '<div class="note-soft">'+T('door.note','Elke opening komt in de activiteitenfeed: wie, welke deur, wanneer. Gearriveerde gasten kunnen de voordeur zelf openen via hun app.')+'</div>'+
    '</div>';
    el.querySelectorAll('[data-door]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/door/toggle', { id: b.dataset.door }); await refresh(); openTab('doors'); }
      catch(e){ toast(e.message); }
    }));
  }

  // ---- gasten live volgen (hotel/appartement) ----
  function renderGasten(){
    const el = $('#gastenWrap'); if (!el) return;
    if (!has('bookings')){ el.innerHTML = ''; return; }
    const guests = state.guests || [];
    const nearby = state.nearbyGuests || [];

    // kaartje: het eigen pand + verbonden gasten met positie
    const pts = [];
    if (S.loc) pts.push({ lat:S.loc.lat, lng:S.loc.lng, me:true });
    guests.forEach(g => { if (g.loc) pts.push({ lat:g.loc.lat, lng:g.loc.lng, name:g.codename }); });
    let map = '';
    if (pts.length > 1){
      const lats = pts.map(p=>p.lat), lngs = pts.map(p=>p.lng);
      let minLat=Math.min(...lats), maxLat=Math.max(...lats), minLng=Math.min(...lngs), maxLng=Math.max(...lngs);
      let dLat=(maxLat-minLat)||0.002, dLng=(maxLng-minLng)||0.002;
      minLat-=dLat*0.2; maxLat+=dLat*0.2; minLng-=dLng*0.2; maxLng+=dLng*0.2;
      dLat=maxLat-minLat; dLng=maxLng-minLng;
      map = '<div class="gmap">'+pts.map(p=>{
        const x=((p.lng-minLng)/dLng)*100, y=(1-(p.lat-minLat)/dLat)*100;
        return '<div class="mk" style="left:'+x.toFixed(1)+'%;top:'+y.toFixed(1)+'%;">'+
          (p.me?'<div>'+S.icon+'</div>':'<div class="gpin"></div>')+
          '<div class="lbl">'+(p.me?S.name.split(' ')[0]:p.name)+'</div></div>';
      }).join('')+'</div>';
    }

    let html = '<div class="card"><div class="tt-h">'+T('gst.connected','Verbonden gasten')+'</div>'+map+
      (guests.length ? guests.map(g =>
        '<div class="guest-row"><span class="cn">'+g.codename+'</span>'+
        (g.arrived?'<span class="ge here">✓ '+T('sup.arrived','gearriveerd')+'</span>'
          : g.etaMin!=null?'<span class="ge"><b>'+g.etaMin+'</b> '+T('sup.minaway','min')+'</span>'
          : '<span class="ge">'+T('sup.enrouteshort','onderweg')+'</span>')+'</div>'
      ).join('') : '<div class="softline">'+T('gst.none','Nog geen verbonden gasten.')+'</div>')+'</div>';

    html += '<div class="card"><div class="tt-h">'+T('gst.nearby','Nu onderweg (nog niet verbonden)')+'</div>'+
      (nearby.length ? nearby.map(g =>
        '<div class="guest-row"><span class="cn">'+g.codename+'</span>'+
        '<div style="display:flex;align-items:center;gap:0.6rem;">'+(g.dest?'<span class="ge">'+T('gst.to','naar')+' '+g.dest+'</span>':'')+
        '<button class="obtn primary" data-connect="'+g.codename.replace(/"/g,'&quot;')+'">'+T('gst.connect','Verbind')+'</button></div></div>'
      ).join('') : '<div class="softline">'+T('gst.nonearby','Er is nu niemand live onderweg.')+'</div>')+
      '<div class="note-soft">'+T('gst.note','Verbinden meldt het bij de gast: u volgt de aankomst om alles klaar te zetten. U ziet daarna live de positie en aankomsttijd.')+'</div></div>';

    el.innerHTML = html;
    el.querySelectorAll('[data-connect]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/guest/connect', { codename: b.dataset.connect }); toast(T('gst.done','Verbonden. De gast is op de hoogte.')); await refresh(); openTab('gasten'); }
      catch(e){ toast(e.message); }
    }));
  }

  // ---- gastchat: berichten van gasten beantwoorden ----
  let gchatKey = null; // open gesprek
  function renderGChat(){
    const el = $('#gchatWrap'); if (!el) return;
    const chats = state.guestChats || [];
    if (gchatKey && !chats.find(c => c.key === gchatKey)) gchatKey = null;
    if (!gchatKey){
      el.innerHTML = '<div class="card">' + (chats.length ? chats.map(c =>
        '<button class="gc-row" data-gchat="' + c.key + '">' +
          '<span class="av">' + c.codename.split(' ').map(w=>w[0]).slice(0,2).join('') + '</span>' +
          '<span class="gt"><b>' + c.codename + ' <em class="gc-dept">' + c.dept + '</em>' + (c.unread ? ' <i class="gc-unread">' + c.unread + '</i>' : '') + '</b>' +
          '<span>' + (c.lastFrom === 'partner' ? T('gc.you','U: ') : '') + c.last + ' · ' + timeAgo(c.lastAt) + '</span></span>' +
        '</button>'
      ).join('') : '<div class="softline">' + T('gc.none','Nog geen gesprekken. Berichten van gasten verschijnen hier live.') + '</div>') + '</div>';
      el.querySelectorAll('[data-gchat]').forEach(b => b.addEventListener('click', () => { gchatKey = b.dataset.gchat; klantSalonOpen = false; renderGChat(); openTab('gchat'); }));
      return;
    }
    const meta = chats.find(c => c.key === gchatKey);
    el.innerHTML = '<button class="sp-back" id="gcBack">← ' + T('gc.back','Alle gesprekken') + '</button>' +
      '<div class="card"><div class="tt-h">' + T('sup.guest','Gast') + ' <span style="color:var(--gold);">' + (meta ? meta.codename : '') + '</span>' + (meta && meta.dept ? ' · ' + meta.dept : '') +
        ' <button class="gc-salon-btn" id="gcSalonBtn">' + T('gc.salon','Bekijk Salon') + '</button></div>' +
      '<div id="gcSalon"></div>' +
      '<div class="tt-chat" id="gcThread"></div>' +
      '<div class="tt-compose"><input id="gcMsg" placeholder="' + T('gc.ph','Antwoord de gast') + '" autocomplete="off"><button id="gcSend">' + T('team.send','Stuur') + '</button></div></div>';
    $('#gcBack').addEventListener('click', () => { gchatKey = null; renderGChat(); openTab('gchat'); });
    $('#gcSalonBtn').addEventListener('click', toggleKlantSalon);
    $('#gcSend').addEventListener('click', sendGChat);
    $('#gcMsg').addEventListener('keydown', e => { if (e.key === 'Enter') sendGChat(); });
    loadGChatThread();
  }
  // De partner bekijkt vooraf de Salon van het lid: geen vreemden van elkaar.
  // Privacy-first: alleen de codenaam, de pas en de eigen posts van het lid.
  let klantSalonOpen = false;
  async function toggleKlantSalon(){
    const box = $('#gcSalon'); if (!box || !gchatKey) return;
    klantSalonOpen = !klantSalonOpen;
    if (!klantSalonOpen){ box.innerHTML = ''; return; }
    box.innerHTML = '<div class="softline">' + T('gc.salonLaad','Salon laden…') + '</div>';
    try {
      const d = await API.call('/supplier/klant/salon', { key: gchatKey });
      const posts = (d.posts || []).map(p =>
        '<div class="ks-post">' + (p.photo ? '<img src="' + p.photo + '" alt="' + T('gc.salonFoto','Salon-foto van het lid') + '">' : '') +
          '<div>' + (p.place ? '<em>' + esc(p.place) + '</em> ' : '') + esc(p.text) + '</div></div>'
      ).join('');
      box.innerHTML = '<div class="ks-card"><div class="ks-h">' +
          '<span class="av">' + (d.codename||'?').split(' ').map(w=>w[0]).slice(0,2).join('') + '</span>' +
          '<b>' + esc(d.codename || '') + '</b> <span class="ks-pas">' + esc(d.tier || '') + '</span></div>' +
        (posts || '<div class="softline">' + T('gc.salonLeeg','Dit lid heeft nog geen Salon-posts.') + '</div>') + '</div>';
    } catch(e){ box.innerHTML = '<div class="softline">' + T('gc.salonFout','Salon nu niet te laden.') + '</div>'; }
  }
  async function loadGChatThread(){
    if (!gchatKey) return;
    try {
      const d = await API.call('/supplier/chat/history', { key: gchatKey });
      fillGChatThread(d.messages);
    } catch(e){}
  }
  function fillGChatThread(msgs){
    const t = $('#gcThread'); if (!t) return;
    t.innerHTML = (msgs || []).map(m =>
      '<div class="tt-msg ' + (m.from === 'partner' ? 'me' : (m.from === 'systeem' ? 'sys' : 'other')) + '"><span class="who">' + (m.who || (m.from === 'systeem' ? 'RTG' : '')) + '</span>' +
      m.text.replace(/&/g,'&amp;').replace(/</g,'&lt;') +
      (m.orig ? '<span style="display:block;margin-top:0.25rem;font-size:0.68rem;color:var(--soft);font-style:italic;">' + m.orig.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' : '') +
      '<time>' + timeAgo(m.at) + '</time></div>'
    ).join('');
    t.scrollTop = t.scrollHeight;
  }
  async function sendGChat(){
    const inp = $('#gcMsg');
    const text = (inp.value || '').trim();
    if (!text || !gchatKey) return;
    inp.value = '';
    try { fillGChatThread((await API.call('/supplier/chat/send', { key: gchatKey, text })).messages); }
    catch(e){ toast(e.message); }
  }

  // ---- pagina: foto's + publiceren op De Salon ----
  function fileToDataURL(file, cb){
    const reader = new FileReader();
    reader.onload = () => cb(String(reader.result));
    reader.readAsDataURL(file);
  }
  let salonStatus = null;
  async function laadSalonStatus(){
    if (!API.live) return;
    try { salonStatus = await API.call('/supplier/salon/status', {}); } catch(e){ salonStatus = null; }
    renderPage();
  }
  function renderPage(){
    const el = $('#pageWrap'); if (!el) return;
    const photos = state.photos || [];
    if (salonStatus === null){ laadSalonStatus(); }
    let html = '';
    // De Salon is verplicht: een blijvende profielkaart met compleetheidsmeter
    if (salonStatus){
      const st = salonStatus, canEdit = actor().manager;
      const kleur = st.compleet ? 'var(--green)' : 'var(--burgundy)';
      html += '<div class="card" style="border-color:'+kleur+';"><div class="tt-h" style="color:'+kleur+';">'+
        (st.compleet ? '✅ '+T('sn.compleet','Salon-profiel compleet') : '⚠️ '+T('sn.verplicht','De Salon is verplicht'))+'</div>'+
        '<p class="ds" style="margin:0.4rem 0;">'+T('sn.uitleg','Al uw marketing, producten en folders lopen via De Salon. Zonder compleet profiel bent u niet zichtbaar voor leden en kunt u niets publiceren.')+'</p>'+
        '<div style="height:8px;background:var(--card2);border-radius:999px;overflow:hidden;margin:0.5rem 0;"><div style="height:100%;width:'+st.percentage+'%;background:'+kleur+';"></div></div>'+
        '<div style="display:grid;gap:0.35rem;">'+st.stappen.map(s => '<div style="font-size:0.82rem;">'+(s.klaar?'✅':'⬜')+' '+T('sn.stap.'+s.id, s.tekst)+'</div>').join('')+'</div>'+
        (canEdit ? '<div class="field" style="margin-top:0.7rem;"><label>'+T('sn.bio','Bio (wie bent u?)')+'</label><textarea id="snBio" rows="2" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;font-family:inherit;">'+esc(st.bio||'')+'</textarea></div>'+
          '<div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.5rem;flex-wrap:wrap;">'+
          '<label class="obtn" style="cursor:pointer;">📷 '+T('sn.foto','Profielfoto')+'<input type="file" id="snFoto" accept="image/*" style="display:none;"></label>'+
          (st.foto?'<img src="'+esc(st.foto)+'" alt="'+T('sn.foto','Profielfoto')+'" style="width:44px;height:44px;object-fit:cover;border-radius:8px;">':'')+
          '<button class="obtn primary" id="snBioSave">'+T('sn.opslaan','Profiel opslaan')+'</button></div>' : '')+
        '</div>';
    }
    html += '<div class="card"><div class="tt-h">'+T('sup.photos','Foto\'s op uw pagina')+' ('+photos.length+'/6)</div>';
    html += '<div class="ph-grid">'+
      photos.map((p,i)=>'<div class="ph"><img src="'+p+'" alt=""><button data-phdel="'+i+'">✕</button></div>').join('')+
      (photos.length<6?'<label class="ph add">+<input type="file" id="phFile" accept="image/jpeg,image/png,image/webp" style="display:none;"></label>':'')+
    '</div>';
    html += '<div style="margin-top:0.6rem;font-size:0.72rem;color:var(--soft);">'+T('sup.photonote','Gasten zien deze foto\'s in de RTG-app bij uw pagina, direct na plaatsen.')+'</div></div>';

    html += '<div class="card"><div class="tt-h">'+T('sup.salonpub','Publiceer op De Salon')+'</div>'+
      '<textarea id="spText" class="salon-ta" placeholder="'+T('sup.salonph','Vertel RTG-leden over uw nieuwste gerecht, suite of avond...')+'"></textarea>'+
      (photos.length?'<div class="ph-pick">'+photos.map((p,i)=>'<img src="'+p+'" data-pick="'+i+'" alt="">').join('')+'</div>':'')+
      '<button class="bigbtn" id="spPost" style="margin-top:0.8rem;">'+T('sup.salonpost','Publiceer als RTG-partner')+'</button>'+
      '<div style="margin-top:0.6rem;font-size:0.72rem;color:var(--soft);">'+T('sup.salonnote','Uw bericht verschijnt in De Salon van alle leden, met uw bedrijfsnaam als partner.')+'</div></div>';

    // folder (digitale brochure): titel + foto's + producten
    if (actor().manager) html += '<div class="card"><div class="tt-h">'+T('sn.folder','Folder plaatsen (producten & aanbod)')+'</div>'+
      '<p class="ds" style="margin:0.3rem 0;">'+T('sn.foldertip','Een digitale brochure: foto\'s en producten met prijs. Zo staan uw producten in De Salon, niet los in de leden-app.')+'</p>'+
      '<div class="field"><label>'+T('sn.f.titel','Titel')+'</label><input id="snFdTitel" placeholder="'+T('sn.f.titelph','Bijv. Zomerkaart')+'"></div>'+
      '<div class="field"><label>'+T('sn.f.tekst','Korte intro (optioneel)')+'</label><input id="snFdTekst"></div>'+
      '<div class="field"><label>'+T('sn.f.fotos','Foto\'s')+'</label><div id="snFdFotos" style="display:flex;gap:0.4rem;flex-wrap:wrap;"></div>'+
        '<label class="obtn" style="cursor:pointer;margin-top:0.4rem;display:inline-block;">📷 '+T('sn.f.fotoadd','Foto toevoegen')+'<input type="file" id="snFdFoto" accept="image/*" style="display:none;"></label></div>'+
      '<div class="field"><label>'+T('sn.f.items','Producten')+'</label><div id="snFdItems"></div>'+
        '<button class="obtn" id="snFdItemAdd" style="margin-top:0.4rem;">+ '+T('sn.f.itemadd','Product toevoegen')+'</button></div>'+
      '<button class="obtn primary" id="snFdPlaats" style="margin-top:0.7rem;">'+T('sn.f.plaats','Folder plaatsen')+'</button></div>';

    el.innerHTML = html;

    // Salon-profiel: bio + foto opslaan
    let snFotoData = null;
    const snFoto = el.querySelector('#snFoto');
    if (snFoto) snFoto.addEventListener('change', () => { const file = snFoto.files && snFoto.files[0]; if (!file) return;
      if (file.size > 1.4*1024*1024){ toast(T('sup.phtoobig','Foto te groot (max 1 MB).')); return; } fileToDataURL(file, d => { snFotoData = d; toast(T('sn.fotoklaar','Foto gekozen; sla het profiel op.')); }); });
    const snSave = el.querySelector('#snBioSave');
    if (snSave) snSave.addEventListener('click', async () => {
      const body = { bio: $('#snBio').value }; if (snFotoData) body.foto = snFotoData;
      try { await API.call('/supplier/salon/bio', body); toast(T('sn.opgeslagen','Profiel opgeslagen.')); await laadSalonStatus(); await refresh(); } catch(e){ toast(e.message); }
    });
    // folder-composer
    const fdFotos = [], fdItems = [];
    const tekenFdFotos = () => { const c = el.querySelector('#snFdFotos'); if (c) c.innerHTML = fdFotos.map((f,i)=>'<div style="position:relative;"><img src="'+f+'" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:8px;"><button class="rr-del" data-fdfdel="'+i+'" style="position:absolute;top:-6px;right:-6px;">✕</button></div>').join('');
      c && c.querySelectorAll('[data-fdfdel]').forEach(b => b.addEventListener('click', () => { fdFotos.splice(Number(b.dataset.fdfdel),1); tekenFdFotos(); })); };
    const tekenFdItems = () => { const c = el.querySelector('#snFdItems'); if (!c) return; c.innerHTML = fdItems.map((it,i)=>'<div style="display:flex;gap:0.4rem;margin-top:0.3rem;"><input data-fdinaam="'+i+'" placeholder="'+T('sn.f.naam','Product')+'" value="'+esc(it.naam)+'" style="flex:2;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;font-size:0.82rem;color:var(--txt);"><input data-fdiprijs="'+i+'" type="number" placeholder="€" value="'+(it.prijs!=null?it.prijs:'')+'" style="width:70px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;font-size:0.82rem;color:var(--txt);"><button class="rr-del" data-fdidel="'+i+'">✕</button></div>').join('');
      c.querySelectorAll('[data-fdinaam]').forEach(inp => inp.addEventListener('input', () => { fdItems[Number(inp.dataset.fdinaam)].naam = inp.value; }));
      c.querySelectorAll('[data-fdiprijs]').forEach(inp => inp.addEventListener('input', () => { fdItems[Number(inp.dataset.fdiprijs)].prijs = inp.value === '' ? null : Number(inp.value); }));
      c.querySelectorAll('[data-fdidel]').forEach(b => b.addEventListener('click', () => { fdItems.splice(Number(b.dataset.fdidel),1); tekenFdItems(); })); };
    const fdFoto = el.querySelector('#snFdFoto');
    if (fdFoto) fdFoto.addEventListener('change', () => { const file = fdFoto.files && fdFoto.files[0]; if (!file) return;
      if (fdFotos.length >= 8) return toast(T('sn.f.max','Maximaal 8 foto\'s.')); fotoKlein(file, d => { fdFotos.push(d); tekenFdFotos(); }); });
    const fdItemAdd = el.querySelector('#snFdItemAdd');
    if (fdItemAdd) fdItemAdd.addEventListener('click', () => { if (fdItems.length >= 30) return; fdItems.push({ naam:'', prijs:null }); tekenFdItems(); });
    const fdPlaats = el.querySelector('#snFdPlaats');
    if (fdPlaats) fdPlaats.addEventListener('click', async () => {
      const titel = $('#snFdTitel').value.trim();
      if (!titel) return toast(T('sn.f.geeftitel','Geef de folder een titel.'));
      if (!fdFotos.length && !fdItems.some(i=>i.naam.trim())) return toast(T('sn.f.leeg','Voeg minstens een foto of product toe.'));
      try { await API.call('/supplier/salon/folder', { titel, tekst: $('#snFdTekst').value, fotos: fdFotos, items: fdItems.filter(i=>i.naam.trim()) });
        toast(T('sn.f.ok','Folder geplaatst op De Salon.')); await laadSalonStatus(); openTab('page'); } catch(e){ toast(e.message); }
    });

    el.querySelectorAll('[data-phdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/photo/remove', { index: Number(b.dataset.phdel) }); await refresh(); openTab('page'); } catch(e){ toast(e.message); }
    }));
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

