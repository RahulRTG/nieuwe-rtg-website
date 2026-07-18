    const qr = E('div');
    qr.innerHTML = qrSvg(user.number.length * 7919);
    Util.vervang($('#codecard'),
      E('div', { class: 'label' }, stem(
        'Je codenaam, je identiteit in onze wereld',
        'Je codenaam, de identiteit van de zaak onderweg',
        'Uw codenaam, uw identiteit in onze wereld'
      ) || T('app.cc.label', 'Uw codenaam, uw identiteit in onze systemen')),
      E('div', { class: 'cn' }, user.codename),
      E('div', { class: 'row' },
        E('div', {},
          E('div', { class: 'mrow' }, T('app.cc.membernr', 'Lidnummer'), E('b', {}, user.number)),
          E('div', { class: 'mrow', style: { marginTop: '0.55rem' } }, T('app.cc.pass', 'Pas'), E('b', {}, TIER_LABEL[user.tier])),
          user.leeftijdsgroep ? E('div', { class: 'mrow', style: { marginTop: '0.55rem' } }, T('app.cc.age', 'Leeftijd'), E('b', {}, user.leeftijdsgroep + ' \u00b7 ' + T('app.cc.ageok', 'paspoort'))) : null),
        qr),
      E('button', { class: 'whybtn', id: 'whyBtn', onclick: () => toggleWhy() }, T('app.cc.why', 'Waarom een codenaam?') + ' \u2192'),
      E('div', { class: 'why' }, E('b', {}, T('app.cc.why.h', 'Uw echte naam staat niet in onze reisdata.')),
        ' ' + T('app.cc.why.b', 'Reserveringen, betalingen en Salon-activiteit staan op uw codenaam. Uw echte naam ligt in een gescheiden, versleutelde kluis en wordt pas bij ticketing en check-in eenmalig gekoppeld. Zou reisdata ooit gestolen worden, dan heeft de aanvaller nooit de juiste naam bij uw reizen.')));

    const open = invoices.filter(i => i.status === 'open');
    const openSum = open.reduce((s,i) => s + i.netto + i.bijdrage, 0);

    // Deze twee kaarten met Util.el: tekst structureel veilig, data-goto blijft
    // (de globale [data-goto]-binding onderaan pakt de knoppen op).
    Util.vervang($('#homeTrip'),
      E('div', { class: 'label' }, T('app.nexttrip', 'Eerstvolgende reis')),
      E('div', { class: 'big' }, trip.dest),
      E('div', { class: 'meta' }, trip.dates + ' · ' + T('app.in', 'over') + ' ' + trip.days + ' ' + T('app.days', 'dagen')),
      E('button', { class: 'go', dataset: { goto: 'reizen' } }, (stem('Bekijk je reis', 'Naar je reizen', 'Bekijk uw reis') || T('app.viewtrip', 'Bekijk uw reis')) + ' →'));
    Util.vervang($('#homePay'), open.length
      ? [E('div', { class: 'label' }, T('app.outstanding', 'Openstaand')),
         E('div', { class: 'big accent' }, eur(openSum)),
         E('div', { class: 'meta' }, open.length + ' ' + (open.length === 1 ? T('app.payment', 'betaling') : T('app.payments', 'betalingen')) + ' · ' + T('app.onetapfid', 'één tik met Face ID')),
         E('button', { class: 'go', dataset: { goto: 'betalen' } }, T('app.paynow', 'Nu betalen') + ' →')]
      : [E('div', { class: 'label' }, T('app.payments.cap', 'Betalingen')),
         E('div', { class: 'big', style: { color: 'var(--green)' } }, T('app.allsettled', 'Alles voldaan')),
         E('div', { class: 'meta' }, T('app.nothingopen', 'Er staat niets open.'))]);
    $('#homeSalon').innerHTML =
      '<div class="label">'+T('app.thesalon','De Salon')+'</div>' +
      '<div class="big gold">' + nfmt(creatorLikes) + '</div>' +
      '<div class="meta">'+T('app.likesquarter','likes dit kwartaal, content levert voorrang, korting en gratis diensten op')+'</div>' +
      '<button class="go" data-goto="salon">'+T('app.tosalon','Naar De Salon')+' →</button>';
    document.querySelectorAll('#content [data-goto]').forEach(b =>
      b.addEventListener('click', () => openTab(b.dataset.goto)));
    renderContacts();
    renderFoundation();
  }

  // Startpagina voor de gratis gebruiker (zonder pas): betalen bij partners,
  // De Salon bekijken en solliciteren. Geen ledenkaart, reis of betalingen.
  function renderHomeGuest(){
    document.documentElement.setAttribute('data-stem', 'rtg');
    stemKoppen();
    $('#homeGreeting').textContent = stem('Ha, fijn dat je er bent.', '', '') || (T('app.welcome','Welkom,') + '.');
    $('#homeSub').textContent = T('app.guestsub','Gratis, zonder pas');
    $('#codecard').innerHTML =
      '<div class="label">'+T('app.guest.k','Gratis account')+'</div>'+
      '<div class="cn" style="font-size:1.35rem;">'+T('app.guest.title','Zonder pas')+'</div>'+
      '<div style="font-size:0.82rem;color:var(--muted);line-height:1.55;margin-top:0.7rem;">'+T('app.guest.body','Je kunt bij RTG-partners betalen via de app, de foto’s in De Salon bekijken en solliciteren op vacatures met je cv. Liken en reageren bij leden hoort bij een pas.')+'</div>'+
      '<button class="go" data-goto="terplaatse" style="margin-top:0.9rem;">'+T('app.guest.pay','Betaal bij een partner')+' →</button>';
    const trip = $('#homeTrip'); if (trip) trip.style.display='none';
    // de gratis app is een bestel/betaal-app: toon de betaalgeschiedenis
    const pay = $('#homePay'); if (pay){ pay.style.display=''; pay.innerHTML = '<div class="label">'+T('app.guest.history','Mijn bestellingen en betalingen')+'</div><div class="meta">'+T('app.loading','Laden...')+'</div>'; }
    loadGuestHistory();
    const salon = $('#homeSalon');
    if (salon){ salon.style.display='';
      salon.innerHTML = '<div class="label">'+T('app.thesalon','De Salon')+'</div>'+
        '<div class="big" style="font-size:1.1rem;">'+T('app.guest.salon','Bekijk de foto’s')+'</div>'+
        '<div class="meta" style="margin:.2rem 0 .7rem;">'+T('app.guest.salonsub','Ontdek wat leden en partners delen.')+'</div>'+
        '<button class="go" data-goto="salon">'+T('app.tosalon','Naar De Salon')+' →</button>';
    }
    document.querySelectorAll('#content [data-goto]').forEach(b => b.addEventListener('click', () => openTab(b.dataset.goto)));
    const fEl = $('#homeFoundation'); if (fEl) fEl.style.display='none';
    const gtab = $('#tabGezin'); if (gtab) gtab.style.display='none';
    // een gratis account (met paspoort) kan vrienden toevoegen en met hen chatten
    if (user.account) loadSocial(); else { const c = $('#homeContacts'); if (c) c.style.display='none'; }
  }
  // Betaalgeschiedenis van de gratis gebruiker: wat is besteld en betaald.
  async function loadGuestHistory(){
    const el = $('#homePay'); if (!el) return;
    let orders = [];
    try { orders = (await API.call('/orders/mine')).orders || []; } catch(e){}
    const betaald = orders.filter(o => o.paid);
    const som = betaald.reduce((s,o) => s + o.total, 0);
    const open = orders.filter(o => !o.paid);
    el.innerHTML = '<div class="label">'+T('app.guest.history','Mijn bestellingen en betalingen')+'</div>'+
      (orders.length
        ? '<div class="big" style="font-size:1.05rem;">'+eur(som)+' <span style="font-size:0.7rem;color:var(--soft);font-weight:400;">'+T('app.guest.paid','betaald')+'</span></div>'+
          '<div class="meta" style="margin:.2rem 0 .6rem;">'+betaald.length+' '+T('app.guest.paidorders','betaalde bestelling(en)')+(open.length?(' · '+open.length+' '+T('app.guest.open','open')):'')+'</div>'+
          '<div style="display:flex;flex-direction:column;gap:.45rem;">'+orders.slice(0,6).map(o=>{
            const kleur = o.paid ? 'var(--green,#4CAF7D)' : 'var(--gold)';
            const st = o.paid ? T('app.guest.ok','betaald') : T('app.guest.te','te betalen');
            return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;font-size:0.78rem;color:var(--muted);">'+
              '<span>'+escT(o.supplierName)+' · '+o.items.reduce((n,i)=>n+i.qty,0)+' '+T('app.items','item(s)')+' · '+timeAgo(o.at)+'</span>'+
              '<span style="flex-shrink:0;white-space:nowrap;">'+eur(o.total)+' · <span style="color:'+kleur+';">'+st+'</span>'+
              (o.paid?'':' <button class="pa" data-guestpay="'+o.ref+'" style="padding:.12rem .5rem;font-size:0.66rem;margin-left:.2rem;">'+T('app.guest.paynow','betaal')+'</button>')+'</span></div>';
          }).join('')+'</div>'
        : '<div class="meta">'+T('app.guest.none','Je hebt nog niets besteld. Betaal bij een partner via Ter plaatse.')+'</div>');
    el.querySelectorAll('[data-guestpay]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/order/pay', { ref: b.dataset.guestpay }); toast(T('app.guest.paid2','Betaald.')); loadGuestHistory(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- RTFoundation: eigen gezinsruimte voor gekoppelde oppas/opa/oma ---------- */
  function esc(t){ return String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function renderFoundation(){
    const homeEl = $('#homeFoundation'), tab = $('#tabGezin'), dot = $('#tabGezinDot');
    if (!user || !user.account){ if(homeEl) homeEl.style.display='none'; if(tab) tab.style.display='none'; return; }
    const g = (rtf.gekoppeld || []), m = (rtf.meldingen || []);
    const ongelezen = m.filter(x=>!x.gelezen).length;
    if (tab) tab.style.display = g.length ? '' : 'none';
    if (dot) dot.style.display = (g.length && ongelezen) ? 'block' : 'none';
    // compacte ingang op Home
    if (homeEl){
      homeEl.style.display='';
