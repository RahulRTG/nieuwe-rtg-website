/* mijn zorgprofiel */
    el.innerHTML =
      '<div class="live-start h-mt80">' +
        '<div class="lh">' + T('zorg.h','Mijn zorgprofiel') + '</div>' +
        '<div class="ld">' + T('zorg.d','Allergenen en aandachtspunten reizen automatisch mee met uw bestellingen en verblijven, alleen als u delen aanzet. De keuken en de receptie weten het dan meteen.') + '</div>' +
        '<input id="zAll" placeholder="' + T('zorg.all','Allergenen, gescheiden door komma (bijv. noten, schaaldieren)') + '" value="' + esc((zorg.allergenen || []).join(', ')) + '" style="width:100%;margin-top:0.5rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);">' +
        '<input id="zDieet" placeholder="' + T('zorg.dieet','Dieet (bijv. vegetarisch, halal)') + '" value="' + esc(zorg.dieet || '') + '" style="width:100%;margin-top:0.4rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);">' +
        '<input id="zMed" placeholder="' + T('zorg.med','Medische aandachtspunten (bijv. diabetes, rolstoel)') + '" value="' + esc(zorg.medisch || '') + '" style="width:100%;margin-top:0.4rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);">' +
        '<label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.55rem;font-size:0.74rem;color:var(--txt);"><input type="checkbox" id="zDelen"' + (zorg.delen ? ' checked' : '') + '> ' + T('zorg.delen','Deel dit automatisch met zaken waar ik bestel of verblijf') + '</label>' +
        '<button class="live-go h-mt55" id="zOpslaan">' + T('zorg.opslaan','Bewaar zorgprofiel') + '</button>' +
        ((delen.actief || []).length
          ? '<div style="margin-top:0.75rem;font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">' + T('zorg.kijkt','Kijkt live met mij mee') + '</div>' +
            delen.actief.map(d => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.5rem;font-size:0.78rem;"><span><b>' + esc(d.supplierName) + '</b> · ' + T('zorg.sinds','sinds') + ' ' + String(d.at).slice(11, 16) + '</span><button class="mo-code js-zstop" data-id="' + d.id + '">' + T('zorg.stop','Stop delen') + '</button></div>').join('')
          : '<div style="margin-top:0.75rem;font-size:0.68rem;color:var(--soft);">' + T('zorg.niemand','Er kijkt nu niemand live met u mee.') + '</div>') +
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

  /* De positie komt van het toestel en nergens anders vandaan: de server vult
     hem niet meer zelf in (NAVIGATIE.md par. 12, gebrek 11). Weigert het lid of
     is er geen locatie, dan start Onderweg gewoon zonder -- het paneel zegt dat
     hardop en de knop "Deel mijn locatie" blijft vooraan staan. */
  function huidigePositie(){
    return new Promise(res => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => res(null), { maximumAge: 15000, timeout: 4000 });
    });
  }
  async function startLive(){
    const destCode = $('#liveDest').value;
    const hier = await huidigePositie();
    try { liveData = (await API.call('/live/start', Object.assign({ destCode, mode: liveMode }, hier || {}))).live; toast(T('live.started','U bent onderweg. Uw partners zijn op de hoogte.')); renderLivePanel(); }
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

