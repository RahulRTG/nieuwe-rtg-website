  // ---- home ----
  function renderHome(){
    const open = (state.orders||[]).filter(o => !['geserveerd','geweigerd','terugbetaald'].includes(o.status));
    const revenue = (state.orders||[]).filter(o=>o.paid).reduce((s,o)=>s+o.total,0);
    $('#homeH').textContent = T('sup.hello','Goedendag,') + ' ' + S.name.split(' ')[0] + '.';
    const rating = state.reviews && state.reviews.rating;
    $('#homeSub').textContent = tType(S.typeLabel) + (rating ? ' ·  ' + rating.score + ' (' + rating.aantal + ' reviews)' : '') + ' · ' + T('sup.connected','verbonden met RTG');
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
    if (unreadChats) todos.push({ icon:'', txt: unreadChats + ' ' + T('todo.chats','onbeantwoord(e) gastbericht(en)'), tab:'gchat' });
    const newOrders = (state.orders || []).filter(o => o.status === 'nieuw').length;
    if (newOrders) todos.push({ icon:'', txt: newOrders + ' ' + T('todo.orders','nieuwe bestelling(en)'), tab:'orders' });
    const newRides = (state.rides || []).filter(r => r.status === 'aangevraagd').length;
    if (newRides) todos.push({ icon:'', txt: newRides + ' ' + T('todo.rides','open ritaanvraag/-vragen'), tab:'rides' });
    if (state.minibar){
      const roomsAll = (state.rooms || []).map(r => r.name);
      const notCounted = roomsAll.filter(r => !state.minibar.countedToday.includes(r));
      if (notCounted.length) todos.push({ icon:'', txt: notCounted.length + ' ' + T('todo.minibar','minibar(s) nog tellen'), tab:'minibar' });
    }
    const openRooms = Object.keys((state.pos && state.pos.openRooms) || {}).length;
    if (openRooms) todos.push({ icon:'', txt: openRooms + ' ' + T('todo.folio','open kamerrekening(en)'), tab:'kassa' });
    const dirty = (state.rooms || []).filter(r => r.hk && (r.hk.status === 'vuil')).length;
    if (dirty) todos.push({ icon:'', txt: dirty + ' ' + T('todo.dirty','kamer(s) schoon te maken'), tab:'rooms' });
    const defect = (state.rooms || []).filter(r => r.hk && r.hk.status === 'defect').length;
    if (defect) todos.push({ icon:'', txt: defect + ' ' + T('todo.defect','kamer(s) defect'), tab:'rooms' });
    const openTickets = (state.tickets || []).filter(t => t.status !== 'klaar').length;
    if (openTickets) todos.push({ icon:'', txt: openTickets + ' ' + T('todo.tickets','open klus(sen)'), tab:'klussen' });
    const newApps = (state.applications || []).filter(x => x.status === 'nieuw').length;
    if (newApps) todos.push({ icon:'', txt: newApps + ' ' + T('todo.apps','nieuwe sollicitatie(s)'), tab:'team' });
    const openRes = (state.reserveringen || []).filter(r => r.status === 'aangevraagd').length;
    if (openRes) todos.push({ icon:'', txt: openRes + ' ' + T('todo.res','open reservering(en) om te bevestigen'), tab:'orders' });
    extra += '<div class="card"><div class="tt-h">' + T('todo.h','Vandaag nog doen') + '</div>' +
      (todos.length ? todos.map(t =>
        '<button class="todo-row" data-goto="' + t.tab + '"><span>' + t.icon + '</span><b>' + t.txt + '</b><i>›</i></button>'
      ).join('') : '<div style="margin-top:0.5rem;font-size:0.82rem;color:var(--green);">✓ ' + T('todo.none','Alles is bij. Geen openstaande acties.') + '</div>') +
      '</div>';

    // recente reviews van gasten (1-5 sterren, geplaatst na afronding)
    const recentRevs = (state.reviews && state.reviews.recent) || [];
    if (recentRevs.length){
      extra += '<div class="card"><div class="tt-h">' + T('rev.h','Recente reviews') + '</div>' +
        recentRevs.slice(0,3).map(r =>
          '<div style="margin-top:0.55rem;font-size:0.8rem;"><b>' + ''.repeat(r.score) + '<span style="opacity:0.25;">' + ''.repeat(5 - r.score) + '</span></b> <span class="cn">' + r.codename + '</span>' +
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
