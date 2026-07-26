    if (open.length) html += open.map(v => '<div class="vbanner" style="border-color:var(--gold,#c9a227);">' +
      '<b>'+esc(v.supplierName)+' '+T('pi.vraagt','vraagt uw')+' '+T('pi.n.'+v.niveau, v.niveau)+'</b>' +
      '<span>'+(v.reden?esc(v.reden)+' · ':'')+T('pi.uitleg','U beslist. Bij goedkeuren ziet de partner dit 10 minuten; daarna vervalt het vanzelf.')+'</span>' +
      '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;"><button class="vbtn" data-pigo="'+v.id+'">'+T('pi.goed','Goedkeuren')+'</button>' +
      '<button class="vbtn" data-piweiger="'+v.id+'" style="background:none;border:1px solid var(--line);color:var(--txt);">'+T('pi.weiger','Weigeren')+'</button></div></div>').join('');
    if (lopend.length) html += lopend.map(v => '<div class="vbanner pending"><b>'+esc(v.supplierName)+' · '+T('pi.n.'+v.niveau, v.niveau)+' '+T('pi.gedeeld','gedeeld')+'</b>' +
      '<span>'+T('pi.lopend','De inzage loopt. U kunt hem intrekken.')+'</span>' +
      '<button class="vbtn" data-pitrek="'+v.id+'" style="margin-top:0.4rem;background:none;border:1px solid var(--line);color:var(--txt);">'+T('pi.trek','Intrekken')+'</button></div>').join('');
    el.innerHTML = html;
    el.querySelectorAll('[data-pigo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/paspoort/beslis', { id: b.dataset.pigo, akkoord: true }); toast(T('pi.goedok','Goedgekeurd.')); await laadPaspoortInbox(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-piweiger]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/paspoort/beslis', { id: b.dataset.piweiger, akkoord: false }); toast(T('pi.weigerok','Geweigerd.')); await laadPaspoortInbox(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-pitrek]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/paspoort/trek-in', { id: b.dataset.pitrek }); toast(T('pi.trekok','Ingetrokken.')); await laadPaspoortInbox(); } catch(e){ toast(e.message); }
    }));
  }

  function renderHome(){
    renderVerifyBanner();
    laadPaspoortInbox();
    // gratis gebruiker (zonder pas): beperkte, veilige startpagina
    if (user.tier === 'guest'){ renderHomeGuest(); return; }
    const first = user.full.split(' ')[0];
    const E = Util.el; // componentframework voor de kaarten hieronder
    // de stem volgt de pas van het ingelogde lid (niet alleen de ingang)
    document.documentElement.setAttribute('data-stem', user.tier);
    stemKoppen();
    $('#homeGreeting').textContent = stem(
      'Ha ' + first + ', goed je te zien.',
      'Dag ' + first + '. Alles onder controle.',
      'Welkom terug, ' + first + '. Alles staat voor u klaar.'
    ) || (T('app.welcome','Welkom,') + ' ' + first + '.');
    $('#homeSub').textContent = TIER_LABEL[user.tier] + ' · ' + T('app.membersince','lid sinds') + ' ' + user.since;

    // De codecard met Util.el: codenaam, lidnummer en leeftijdsgroep gaan
    // structureel als tekstknoop. De QR is gegenereerd (geen gebruikerstekst) en
    // blijft als kant-en-klare SVG in een eigen container.
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
