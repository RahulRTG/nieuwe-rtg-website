    el.innerHTML =
      '<div class="live-start" style="margin-top:0.8rem;">' +
        '<div class="lh">' + T('zorg.h','Mijn zorgprofiel') + '</div>' +
        '<div class="ld">' + T('zorg.d','Allergenen en aandachtspunten reizen automatisch mee met uw bestellingen en verblijven, alleen als u delen aanzet. De keuken en de receptie weten het dan meteen.') + '</div>' +
        '<input id="zAll" placeholder="' + T('zorg.all','Allergenen, gescheiden door komma (bijv. noten, schaaldieren)') + '" value="' + esc((zorg.allergenen || []).join(', ')) + '" style="width:100%;margin-top:0.5rem;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);">' +
        '<input id="zDieet" placeholder="' + T('zorg.dieet','Dieet (bijv. vegetarisch, halal)') + '" value="' + esc(zorg.dieet || '') + '" style="width:100%;margin-top:0.4rem;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);">' +
        '<input id="zMed" placeholder="' + T('zorg.med','Medische aandachtspunten (bijv. diabetes, rolstoel)') + '" value="' + esc(zorg.medisch || '') + '" style="width:100%;margin-top:0.4rem;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);">' +
        '<label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.55rem;font-size:0.74rem;color:var(--txt);"><input type="checkbox" id="zDelen"' + (zorg.delen ? ' checked' : '') + '> ' + T('zorg.delen','Deel dit automatisch met zaken waar ik bestel of verblijf') + '</label>' +
        '<button class="live-go" id="zOpslaan" style="margin-top:0.55rem;">' + T('zorg.opslaan','Bewaar zorgprofiel') + '</button>' +
        ((delen.actief || []).length
          ? '<div style="margin-top:0.8rem;font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">' + T('zorg.kijkt','Kijkt live met mij mee') + '</div>' +
            delen.actief.map(d => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.4rem;font-size:0.78rem;"><span><b>' + esc(d.supplierName) + '</b> · ' + T('zorg.sinds','sinds') + ' ' + String(d.at).slice(11, 16) + '</span><button class="mo-code js-zstop" data-id="' + d.id + '">' + T('zorg.stop','Stop delen') + '</button></div>').join('')
          : '<div style="margin-top:0.8rem;font-size:0.68rem;color:var(--soft);">' + T('zorg.niemand','Er kijkt nu niemand live met u mee.') + '</div>') +
      '</div>';
    $('#zOpslaan').addEventListener('click', async () => {
      try {
        await API.call('/zorgprofiel/zet', { allergenen: $('#zAll').value, dieet: $('#zDieet').value, medisch: $('#zMed').value, delen: $('#zDelen').checked });
        toast('' + T('zorg.bewaard','Zorgprofiel bewaard.'));
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('.js-zstop').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/locatie/stop', { id: b.dataset.id }); toast('' + T('zorg.gestopt','Delen gestopt.')); renderZorg(); }
      catch(e){ toast(e.message); }
    }));
  }

  async function startLive(){
    const destCode = $('#liveDest').value;
    try { liveData = (await API.call('/live/start', { destCode, mode: liveMode })).live; toast(T('live.started','U bent onderweg. Uw partners zijn op de hoogte.')); renderLivePanel(); }
    catch (e){ toast(e.message); }
  }

  // projecteer lat/lng-punten in het 130px-kaartje (percentage-coördinaten)
  function projectPoints(pts){
    if (!pts.length) return [];
    const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
    let minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    let dLat = (maxLat - minLat) || 0.002, dLng = (maxLng - minLng) || 0.002;
    minLat -= dLat*0.2; maxLat += dLat*0.2; minLng -= dLng*0.2; maxLng += dLng*0.2;
    dLat = maxLat - minLat; dLng = maxLng - minLng;
    return pts.map(p => ({ x: ((p.lng - minLng)/dLng)*100, y: (1 - (p.lat - minLat)/dLat)*100 }));
  }

  function renderLivePanel(){
    const L = liveData; if (!L) return;
    const dest = L.dest;
    let head, sub = '';
    if (L.arrived && dest){ head = T('live.arrivedh','U bent <em>gearriveerd</em>'); sub = dest.name; }
    else if (dest){ head = T('live.headingto','Onderweg naar') + ' <em>' + dest.name + '</em>'; sub = dest.etaMin != null ? T('live.aankomst','aankomst over ~') + dest.etaMin + ' ' + T('live.min','min') : ''; }
    else { head = T('live.moving','U bent <em>onderweg</em>'); }

    const pts = [];
    if (L.me) pts.push({ lat: L.me.lat, lng: L.me.lng, me: true });
    L.partners.forEach(p => { if (p.loc) pts.push({ lat: p.loc.lat, lng: p.loc.lng, icon: p.icon, name: p.name }); });
    const proj = projectPoints(pts);
    const markers = proj.map((pt,i) => {
      const s = pts[i];
      return '<div class="mk' + (s.me?' me':'') + '" style="left:' + pt.x.toFixed(1) + '%;top:' + pt.y.toFixed(1) + '%;">' +
        (s.me ? '<div class="pin"></div>' : '<div>' +RTGGlyf.tekst(s.icon)+ '</div>') +
        '<div class="lbl">' + (s.me ? T('live.you','U') : s.name) + '</div></div>';
    }).join('');

    const partners = L.partners.map(p => {
      const isVeh = p.type === 'taxi' || p.type === 'jet';
      let eta;
      if (p.ride && isVeh){
        eta = p.taxiEtaMin != null && p.ride.status !== 'gearriveerd'
          ? '<div class="eta"><div class="n">' + p.taxiEtaMin + '</div><div class="u">' + T('live.mintoyou','min naar u') + '</div></div>'
          : '<div class="eta"><div class="n" style="font-size:0.9rem;">' + tRide(p.ride.status) + '</div></div>';
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
          line2 += '<br><button class="js-rpay" data-rref="' + p.ride.ref + '" data-rq="' + p.ride.quote + '" style="margin-top:0.35rem;background:none;border:1px solid var(--gold);color:var(--gold);border-radius:999px;padding:0.3rem 0.8rem;font-size:0.7rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('live.betaalrit','Betaal de rit') + ' · ' + eur(p.ride.quote) + '</button>';
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
    const acts = '<div class="live-acts">' +
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
        '<div style="margin-top:0.5rem;">' + partners + '</div>' +
        acts +
      '</div>';

    $('#liveStop').addEventListener('click', stopLive);
    $('#liveSim').addEventListener('click', simulateRide);
