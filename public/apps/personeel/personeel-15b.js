    // -- de handlers van de bezorg-tab: inpakken, pakken, vertrekken, nemen --
    const g = document.getElementById('pdGps'); if (g) g.addEventListener('click', gpsAanUit);
    document.querySelectorAll('[data-inpak]').forEach(kaart => {
      kaart.querySelector('.ipKlaar').addEventListener('click', async () => {
        const items = [...kaart.querySelectorAll('.ipItem:checked')].map(x => x.value);
        try {
          await API.call('/supplier/bezorg/inpak', { ref: kaart.dataset.inpak, items,
            tas: kaart.querySelector('.ipTas').value.trim(), bon: kaart.querySelector('.ipBon').value.trim() });
          toast(T('pd.bz.ipok','Ingepakt: alles afgevinkt op tas en bon.'));
          await refresh(); openTab('bezorgen');
        } catch(e){ toast(e.message); }
      });
    });
    document.querySelectorAll('[data-vt]').forEach(b => b.addEventListener('click', () => {
      try { localStorage.setItem('pd_voertuig', b.dataset.vt); } catch(e){}
      renderBezorgen();
    }));
    const pk = document.getElementById('pdPakcheck'); if (pk) pk.addEventListener('click', async () => {
      try {
        await API.call('/supplier/bezorg/pakcheck', { refs: tePakken });
        toast(T('pd.bz.pakok','Afgevinkt: u heeft alles gepakt.'));
        await refresh(); openTab('bezorgen');
      } catch(e){ toast(e.message); }
    });
    const v = document.getElementById('pdVertrek'); if (v) v.addEventListener('click', async () => {
      try {
        await API.call('/supplier/bezorg/status', { refs: teVertrekken, status: 'onderweg' });
        if (gpsWatch == null) gpsAanUit(); // rijden bevestigd = GPS automatisch aan
        // de beste route in de gekozen vervoersvorm; de navigatie opent vanzelf
        try {
          const r = await API.call('/supplier/bezorg/route', { refs: teVertrekken, voertuig: voertuig() });
          window.__pdRoute = r;
          if (r.stops && r.stops.length) window.open(r.stops[0].nav, '_blank');
        } catch(e){ window.__pdRoute = null; }
        await refresh(); openTab('bezorgen');
      } catch(e){ toast(e.message); }
    });
    const n = document.getElementById('pdNeem'); if (n) n.addEventListener('click', async () => {
      const refs = [...document.querySelectorAll('.pdbzkies:checked')].map(x => x.value);
      if (!refs.length) { toast(T('pd.bz.kies','Vink eerst een of meer leveringen aan.')); return; }
      try { const r = await API.call('/supplier/bezorg/neem', { refs }); toast(r.genomen.length + ' ' + T('pd.bz.opnaam','rit(ten) op uw naam.')); await refresh(); openTab('bezorgen'); } catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-pdbz]').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/supplier/bezorg/status', { ref: b.dataset.pdbz, status: b.dataset.st });
        // de laatste levering bezorgd? De routekaart mag weg; de GPS gaat pas
        // uit als de bezorger echt terug is op de zaak (autoTerug ziet dat).
        await refresh(); openTab('bezorgen');
      } catch(e){ toast(e.message); }
    }));
