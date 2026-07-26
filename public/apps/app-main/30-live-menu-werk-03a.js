  /* ---------- de zorgvolle keten: zorgprofiel + wie kijkt mee ---------- */
  async function renderZorg(){
    const el = $('#zorgPanel'); if (!el) return;
    if (!API.live){ el.innerHTML = ''; return; }
    let zorg, delen;
    try {
      zorg = (await API.call('/zorgprofiel')).zorg;
      delen = await API.call('/locatie/mijn');
    } catch(e){ el.innerHTML = ''; return; }
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
