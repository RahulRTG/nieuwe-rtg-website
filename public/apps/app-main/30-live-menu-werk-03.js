      if (!datum){ toast(T('as.kiesdag','Kies eerst een dag.')); return; }
      try { const r = await API.call('/asset/gebruik', { assetId: b.dataset.id, datum }); toast('📅 ' + datum + ' ' + T('as.vast','staat vast.') + ' ' + r.dagenTegoed + ' ' + T('as.dagenover','x 24 uur over dit jaar.')); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-asuit').forEach(b => b.addEventListener('click', async () => {
      if (!window.confirm(T('as.uitvraag','Uitstappen? RTG betaalt de actuele ticketwaarde') + ' (' + eur(Number(b.dataset.w)) + ') ' + T('as.uitvraag2','uit via een Tik en het ticket gaat terug in de pool.'))) return;
      try { const r = await API.call('/asset/uitstap', { ticketId: b.dataset.tid }); toast('💰 ' + T('as.uitok','Uitgestapt. De Tik van') + ' ' + eur(r.waarde) + ' ' + T('as.uitok2','staat in uw tegoed.')); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- het brein van De Butler: geheugen en seintjes ----------
     Het gesprek zelf loopt via de gewone Butler-chat op de AI-tab; deze
     kaart toont rustig wat hij weet (wisbaar) en wat hij zelf ziet. */
  let fluisterSyncAt = 0;
  async function renderFluister(){
    const el = $('#fluisterWrap'); if (!el) return;
    if (!API.live){ el.innerHTML = ''; return; }
    // de inklap-laag deelt (alleen) de gebruikstellers, zodat de Butler leert
    if (window.FocusUI && Date.now() - fluisterSyncAt > 60000){
      fluisterSyncAt = Date.now();
      API.call('/fluister/focus', { scores: FocusUI.scores() }).catch(() => {});
    }
    let prof;
    try { prof = await API.call('/fluister/profiel'); } catch(e){ el.innerHTML = ''; return; }
    el.innerHTML =
      '<div class="live-start" style="margin-bottom:0.8rem;">' +
        '<div class="lh">🤵 ' + T('fl.h','Wat Rahul weet en ziet') + '</div>' +
        '<div class="ld">' + T('fl.d','Hij onthoudt wat u vertelt ("onthoud dat..."), leert van wat u gebruikt en regelt alles in de chat hieronder: zoeken, reserveren, bestellen en afrekenen, uw 24 uur, een Tik of betaalverzoek. Vraag "wat kun je" voor het hele overzicht; geld gaat nooit zonder uw "ja" de deur uit.') + '</div>' +
        ((prof.seintjes || []).length
          ? '<div style="margin-top:0.55rem;border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;">' +
              '<div style="font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">' + T('fl.sein','Rahul ziet') + '</div>' +
              prof.seintjes.map(x => '<div style="margin-top:0.3rem;font-size:0.76rem;line-height:1.45;">' + esc(x.icoon) + ' ' + esc(x.tekst) + '</div>').join('') + '</div>'
          : '') +
        (prof.weetjes.length
          ? '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.5rem;">' + prof.weetjes.map((w, i) =>
              '<span style="display:inline-flex;align-items:center;gap:0.35rem;border:1px solid var(--line);border-radius:999px;padding:0.25rem 0.6rem;font-size:0.68rem;color:var(--txt);">' + esc(w.tekst) +
              '<button class="js-flweg" data-i="' + i + '" aria-label="' + T('fl.weg','vergeet dit') + '" style="background:none;border:none;color:var(--soft);cursor:pointer;font-size:0.75rem;padding:0;">✕</button></span>').join('') + '</div>'
          : '<div style="margin-top:0.5rem;font-size:0.68rem;color:var(--soft);">' + T('fl.leeg','Nog geen weetjes. Zeg bijvoorbeeld: "onthoud dat ik cava drink, nooit rode wijn".') + '</div>') +
        (prof.top.length ? '<div style="margin-top:0.4rem;font-size:0.64rem;color:var(--soft);">' + T('fl.top','Ik zie dat u het meest werkt met') + ': ' + prof.top.map(esc).join(', ') + '.</div>' : '') +
      '</div>';
    el.querySelectorAll('.js-flweg').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/fluister/vergeet', { wat: Number(b.dataset.i) }); renderFluister(); } catch(e){ toast(e.message); }
    }));
  }

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
        '<div class="lh">🩺 ' + T('zorg.h','Mijn zorgprofiel') + '</div>' +
        '<div class="ld">' + T('zorg.d','Allergenen en aandachtspunten reizen automatisch mee met uw bestellingen en verblijven, alleen als u delen aanzet. De keuken en de receptie weten het dan meteen.') + '</div>' +
        '<input id="zAll" placeholder="' + T('zorg.all','Allergenen, gescheiden door komma (bijv. noten, schaaldieren)') + '" value="' + esc((zorg.allergenen || []).join(', ')) + '" style="width:100%;margin-top:0.5rem;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);">' +
        '<input id="zDieet" placeholder="' + T('zorg.dieet','Dieet (bijv. vegetarisch, halal)') + '" value="' + esc(zorg.dieet || '') + '" style="width:100%;margin-top:0.4rem;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);">' +
        '<input id="zMed" placeholder="' + T('zorg.med','Medische aandachtspunten (bijv. diabetes, rolstoel)') + '" value="' + esc(zorg.medisch || '') + '" style="width:100%;margin-top:0.4rem;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);">' +
        '<label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.55rem;font-size:0.74rem;color:var(--txt);"><input type="checkbox" id="zDelen"' + (zorg.delen ? ' checked' : '') + '> ' + T('zorg.delen','Deel dit automatisch met zaken waar ik bestel of verblijf') + '</label>' +
        '<button class="live-go" id="zOpslaan" style="margin-top:0.55rem;">' + T('zorg.opslaan','Bewaar zorgprofiel') + '</button>' +
        ((delen.actief || []).length
          ? '<div style="margin-top:0.8rem;font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">📍 ' + T('zorg.kijkt','Kijkt live met mij mee') + '</div>' +
            delen.actief.map(d => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.4rem;font-size:0.78rem;"><span><b>' + esc(d.supplierName) + '</b> · ' + T('zorg.sinds','sinds') + ' ' + String(d.at).slice(11, 16) + '</span><button class="mo-code js-zstop" data-id="' + d.id + '">' + T('zorg.stop','Stop delen') + '</button></div>').join('')
          : '<div style="margin-top:0.8rem;font-size:0.68rem;color:var(--soft);">📍 ' + T('zorg.niemand','Er kijkt nu niemand live met u mee.') + '</div>') +
      '</div>';
    $('#zOpslaan').addEventListener('click', async () => {
      try {
        await API.call('/zorgprofiel/zet', { allergenen: $('#zAll').value, dieet: $('#zDieet').value, medisch: $('#zMed').value, delen: $('#zDelen').checked });
        toast('🩺 ' + T('zorg.bewaard','Zorgprofiel bewaard.'));
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('.js-zstop').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/locatie/stop', { id: b.dataset.id }); toast('📍 ' + T('zorg.gestopt','Delen gestopt.')); renderZorg(); }
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
