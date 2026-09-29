/* het Onderweg-paneel: kaart, partners, handelingen en de bevestigde aankomst */
  function renderLivePanel(){
    const L = liveData; if (!L) return;
    const dest = L.dest;
    let head, sub = '';
    if (L.arrived && dest){ head = T('live.arrivedh','U bent <em>gearriveerd</em>'); sub = dest.name; }
    else if (dest){ head = T('live.headingto','Onderweg naar') + ' <em>' + dest.name + '</em>'; sub = dest.etaMin != null ? T('live.aankomst','aankomst over ~') + dest.etaMin + ' ' + T('live.min','min') : ''; }
    else { head = T('live.moving','U bent <em>onderweg</em>'); }
    if (L.positie && !L.arrived) sub = (sub ? sub + ' · ' : '') + T('live.geenpositie','uw positie is niet gedeeld');

    const pts = [];
    if (L.me) pts.push({ lat: L.me.lat, lng: L.me.lng, me: true });
    L.partners.forEach(p => { if (p.loc) pts.push({ lat: p.loc.lat, lng: p.loc.lng, icon: p.icon, name: p.name }); });
    const proj = projectPoints(pts);
    const markers = proj.map((pt,i) => {
      const s = pts[i];
      return '<div class="mk' + (s.me?' me':'') + '" data-x="' + pt.x.toFixed(1) + '" data-y="' + pt.y.toFixed(1) + '">' +
        (s.me ? '<div class="pin"></div>' : '<div>' +RTGGlyf.tekst(s.icon)+ '</div>') +
        '<div class="lbl">' + (s.me ? T('live.you','U') : s.name) + '</div></div>';
    }).join('');

    const partners = L.partners.map(p => {
      const isVeh = p.type === 'taxi' || p.type === 'jet';
      let eta;
      if (p.ride && isVeh){
        eta = p.taxiEtaMin != null && p.ride.status !== 'gearriveerd'
          ? '<div class="eta"><div class="n">' + p.taxiEtaMin + '</div><div class="u">' + T('live.mintoyou','min naar u') + '</div></div>'
          : '<div class="eta"><div class="n n-klein">' + tRide(p.ride.status) + '</div></div>';
      } else if (p.isDest && L.arrived){
        eta = '<div class="eta arr"><div class="n">✓ ' + T('live.here','ter plaatse') + '</div></div>';
      } else {
        eta = p.etaMin != null ? '<div class="eta"><div class="n">' + p.etaMin + '</div><div class="u">' + T('live.minaway','min heen') + '</div></div>' : '';
      }
      let line2 = tType(p.typeLabel);
      if (p.ride){
        line2 += ' · ' + T('live.ride','rit') + ' ' + tRide(p.ride.status);
        const extra = [];
        if (p.ride.driver) extra.push('' + p.ride.driver + (p.ride.vehicle ? ' · ' + p.ride.vehicle : ''));
        if (p.ride.quote) extra.push(T('live.vast','vaste nettoprijs') + ' ' + eur(p.ride.quote));
        if (extra.length) line2 += '<br>' + extra.join(' · ');
        // betaling achteraf: de zaak liet de rit direct rijden; afrekenen kan nu
        if (!p.ride.paid && p.ride.quote && p.ride.status !== 'wacht-op-betaling')
          line2 += '<br><button class="js-rpay live-rpay" data-rref="' + p.ride.ref + '" data-rq="' + p.ride.quote + '">' + T('live.betaalrit','Betaal de rit') + ' · ' + eur(p.ride.quote) + '</button>';
      }
      else if (p.order) line2 += ' · ' + p.order.items + ' ' + T('app.items','item(s)') + ', ' + tStatus(p.order.status);
      return '<div class="live-partner"><span class="pic">' +RTGGlyf.tekst(p.icon)+ '</span><div class="pt"><b>' + p.name + '</b><span>' + line2 + '</span></div>' + eta + '</div>';
    }).join('');

    let preorder = '';
    const destSup = dest ? suppliers.find(s => s.code === dest.code) : null;
    if (dest && destSup && destSup.hasMenu && !dest.order && !L.arrived){
      preorder = '<div class="live-preorder"><span>' + T('live.preorder','Bestel vast vooruit, dan staat het klaar als u aankomt.') + '</span><button id="livePre">' + T('live.preorderbtn','Vooruit bestellen') + '</button></div>';
    }

    const hasVeh = L.partners.some(p => p.type === 'taxi' || p.type === 'jet');
    const canDoor = L.arrived && dest && dest.hasDoors;
    /* Aankomst bevestigt de mens (NAVIGATIE.md N13): in de buurt is een vraag,
       en de knop staat er ook zonder gedeelde positie. */
    const kanBevestigen = dest && !L.arrived;
    const acts = '<div class="live-acts">' +
      (kanBevestigen ? '<button class="' + (L.nabij ? 'prim glowbtn' : 'sec') + '" id="liveHier">' + (L.nabij ? T('live.benuer','Bent u er? Bevestig uw aankomst') : T('live.ikbener','Ik ben er')) + '</button>' : '') +
      (canDoor ? '<button class="prim glowbtn" id="liveDoor">' + T('live.door','Open de deur') + '</button>' : '') +
      '<button class="sec" id="liveSim">' + T('live.simulate','Simuleer rit') + '</button>' +
      (hasVeh ? '' : '<button class="sec" id="liveTaxi">' + T('live.taxi','Vraag een taxi') + '</button>') +
      (canDoor ? '' : '<button class="prim" id="liveShare">' + T('live.share','Deel mijn locatie') + '</button>') +
      (canDoor ? '<button class="sec" id="liveShare">' + T('live.share','Deel mijn locatie') + '</button>' : '') +
    '</div>';

    $('#livePanel').innerHTML =
      '<div class="live-panel">' +
        '<div class="live-top"><span class="live-badge"><span class="dot"></span>' + T('live.badge','Live onderweg') + '</span><button class="live-stop" id="liveStop">' + T('live.stop','Stop') + '</button></div>' +
        '<div class="live-headline">' + head + '</div>' + (sub ? '<div class="live-sub">' + sub + '</div>' : '') +
        '<div class="live-map">' + markers + '</div>' +
        preorder +
        '<div class="h-mt50">' + partners + '</div>' +
        acts +
      '</div>';

    /* De markers krijgen hun plek hier en niet als style-attribuut: een
       stijlattribuut houdt style-src-attr open in de CSP (deltapoort). */
    $('#livePanel').querySelectorAll('.mk[data-x]').forEach(m => { m.style.left = m.dataset.x + '%'; m.style.top = m.dataset.y + '%'; });
    $('#liveStop').addEventListener('click', stopLive);
    const hier = $('#liveHier');
    if (hier) hier.addEventListener('click', async () => {
      try { const r = await API.call('/live/aangekomen', {}); liveData = r.live; renderLivePanel(); }
      catch (e) { toast(e.message); }
    });
    $('#liveSim').addEventListener('click', simulateRide);
