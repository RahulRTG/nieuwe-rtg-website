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
      // het zorgprofiel van de gast reist automatisch mee (alleen met toestemming)
      o.zorg ? E('div', { class: 'allergy' }, '⚠ ' + T('sup.zorgp', 'Zorgprofiel gast:') + ' ' + zorgTekst(o.zorg)) : null,
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
