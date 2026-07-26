    el.querySelectorAll('[data-vakdag]').forEach(b => b.addEventListener('click', () => {
      b.classList.toggle('primary');
    }));
    const vakUrenBtn = el.querySelector('#vakUrenSave'); if (vakUrenBtn) vakUrenBtn.addEventListener('click', async () => {
      const dagen = [...el.querySelectorAll('[data-vakdag]')].sort((a,c)=>a.dataset.vakdag-c.dataset.vakdag).map(b => b.classList.contains('primary'));
      try {
        await API.call('/supplier/vak/uren-zet', { dagen, van: el.querySelector('#vakVan').value, tot: el.querySelector('#vakTot').value });
        vakData = null; vakUren = null; kantoorMsg = ''+T('vk.urenok','Beschikbaarheid opgeslagen; leden zien alleen vrije tijden.');
        await refresh();
      } catch(e){ toast(e.message); }
    });
    // vakwerk: de genre-bewuste assistent om advies vragen
    const vakAiBtn = el.querySelector('#vakAi'); if (vakAiBtn) vakAiBtn.addEventListener('click', async () => {
      vakAiBusy = true; renderStation();
      try { const d = await API.call('/supplier/vak/ai', { q: (el.querySelector('#vakQ') ? el.querySelector('#vakQ').value : '') });
        vakAiMsg = d.antwoord + (d.voorstellen && d.voorstellen.length ? '\n\n• '+d.voorstellen.join('\n• ') : '');
      } catch(e){ vakAiMsg = e.message; }
      vakAiBusy = false; renderStation();
    });
    // verlofaanvragen beslissen
    el.querySelectorAll('[data-kvja]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/leave/decide', { id: b.dataset.kvja, action: 'goedkeuren' }); kantoorMsg = ''+T('kt.vgedaan','Verlof goedgekeurd; het staflid ziet dit direct op de PDA.'); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kvnee]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/leave/decide', { id: b.dataset.kvnee, action: 'afwijzen' }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // ritgeschiedenis: bladeren, zoeken en de volledige export van de server
    const ktCsv = el.querySelector('#ktCsv'); if (ktCsv) ktCsv.addEventListener('click', () => {
      window.open('/api/supplier/rides.csv?token=' + encodeURIComponent(API.token), '_blank');
    });
    el.querySelectorAll('[data-khist]').forEach(b => b.addEventListener('click', () => {
      histPage = Math.max(1, histPage + Number(b.dataset.khist));
      histData = null;
      renderStation();
    }));
    const ktHzoek = () => {
      histQ = (el.querySelector('#ktHz') ? el.querySelector('#ktHz').value : '').trim();
      histPage = 1;
      histData = null;
      renderStation();
    };
    const hzGo = el.querySelector('#ktHzGo'); if (hzGo) hzGo.addEventListener('click', ktHzoek);
    const hzIn = el.querySelector('#ktHz'); if (hzIn) hzIn.addEventListener('keydown', e => { if (e.key === 'Enter') ktHzoek(); });
    // dispatch: toewijzen met de hand of met het slimme voorstel
    el.querySelectorAll('[data-ktwijs]').forEach(b => b.addEventListener('click', async () => {
      const ref = b.dataset.ktwijs;
      try {
        await API.call('/supplier/ride/assign', { ref, staffId: Number(el.querySelector('[data-ktch="'+ref+'"]').value), vehicleId: el.querySelector('[data-ktvg="'+ref+'"]') ? el.querySelector('[data-ktvg="'+ref+'"]').value : null });
        kantoorMsg = ''+T('kt.gewezen','Rit toegewezen; de gast en de chauffeur zijn op de hoogte.');
        await refresh();
      } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ktslim]').forEach(b => b.addEventListener('click', async () => {
      const ref = b.dataset.ktslim;
      b.disabled = true;
      try {
        const s2 = await API.call('/supplier/ride/suggest', { ref });
        if (!s2.staffId){ toast(T('kt.niemandvrij','Iedereen is bezet.')); b.disabled = false; return; }
        await API.call('/supplier/ride/assign', { ref, staffId: s2.staffId, vehicleId: s2.vehicleId });
        kantoorMsg = ''+T('kt.slimgewezen','Slim toegewezen:')+' <b>'+s2.staffName+'</b>'+(s2.vehicleName?' · '+s2.vehicleName:'');
        await refresh();
      } catch(e){ toast(e.message); b.disabled = false; }
    }));
    // vloot
    el.querySelectorAll('[data-ktvt]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/fleet', { action: 'toggle', id: b.dataset.ktvt }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ktvd]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/fleet', { action: 'remove', id: b.dataset.ktvd }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const ktV = el.querySelector('#ktVAdd'); if (ktV) ktV.addEventListener('click', async () => {
      const name = el.querySelector('#ktVn').value.trim();
      if (!name){ toast(T('kt.vnaamleeg','Geef het voertuig een naam.')); return; }
      try { await API.call('/supplier/fleet', { action: 'add', name, plate: el.querySelector('#ktVp').value.trim(), seats: Number(el.querySelector('#ktVs').value)||4 }); await refresh(); } catch(e){ toast(e.message); }
    });
    // tarief
    const ktT2 = el.querySelector('#ktTSave'); if (ktT2) ktT2.addEventListener('click', async () => {
      try {
        await API.call('/supplier/settings', { tarief: { start: Number(el.querySelector('#ktTa').value), perKm: Number(el.querySelector('#ktTb').value), minimum: Number(el.querySelector('#ktTc').value) } });
        kantoorMsg = ''+T('kt.tklaar','Tarief opgeslagen; nieuwe aanvragen krijgen direct de nieuwe prijs.');
        await refresh();
      } catch(e){ toast(e.message); }
    });
    // prijzen aan RTG
    const kPr = el.querySelector('#kPrSend'); if (kPr) kPr.addEventListener('click', async () => {
      const service = el.querySelector('#kPrS').value.trim(), price = Number(el.querySelector('#kPrP').value);
      if (!service || !(price>0)){ toast(T('sup.fillprice','Vul een dienst en prijs in.')); return; }
      try { await API.call('/supplier/price', { service, price }); kantoorMsg = '\u2705 '+T('sup.pricesent','Prijs verstuurd naar RTG.'); await refresh(); } catch(e){ toast(e.message); }
    });
    // marketing: foto's en een Salon-bericht
    el.querySelectorAll('[data-kphd]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/photo/remove', { index: Number(b.dataset.kphd) }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const kPh = el.querySelector('#kPhFile'); if (kPh) kPh.addEventListener('change', () => {
      const file = kPh.files && kPh.files[0]; if (!file) return;
      if (file.size > 1024*1024){ toast(T('sup.phtoobig','Foto te groot (max 1 MB).')); return; }
      fileToDataURL(file, async url => {
        try { await API.call('/supplier/photo/add', { image: url }); kantoorMsg = '\u2705 '+T('sup.phadded','Foto geplaatst.'); await refresh(); } catch(e){ toast(e.message); }
      });
    });
    let kPicked = null;
    el.querySelectorAll('[data-kpick]').forEach(img => img.addEventListener('click', () => {
      kPicked = kPicked === Number(img.dataset.kpick) ? null : Number(img.dataset.kpick);
      el.querySelectorAll('[data-kpick]').forEach(x => x.classList.toggle('sel', Number(x.dataset.kpick) === kPicked));
    }));
    const kSp = el.querySelector('#kSpPost'); if (kSp) kSp.addEventListener('click', async () => {
      const text = el.querySelector('#kSpText').value.trim();
      if (!text){ toast(T('sup.salonempty','Schrijf eerst een tekst.')); return; }
      try { await API.call('/supplier/salon/post', { text, photoIndex: kPicked });
        kantoorMsg = '\u2705 '+T('sup.salondone','Gepubliceerd op De Salon.');
        await refresh(); } catch(e){ toast(e.message); }
    });
  }

  async function refresh(){ try { applyState((await API.call('/supplier/state')).state); renderAll(); } catch(e){} }

  /* Het werkvenster (werkgever): wanneer mag personeel de werkomgeving in
     (leverancier-app en PDA), en wanneer niet. Per weekdag een tijdslot of de
     dag dicht; de manager valt er nooit onder. De server dwingt het af bij
     elke ingang (PIN-login en het ene RTG-account); dit paneel stelt het
     alleen in. Rahul adviseert los hiervan (agenda/uren), maar blokkeert
     nooit. Helpers voor 20-kantoor-02 (html) en 20-kantoor-10 (binden). */
  function werkvensterBlokHtml(inst){
    const wv = (inst && inst.werkvenster) || { aan: false, dagen: {}, vrijgesteld: [] };
    const DAG = [[1,T('wv.ma','ma')],[2,T('wv.di','di')],[3,T('wv.wo','wo')],[4,T('wv.do','do')],[5,T('wv.vr','vr')],[6,T('wv.za','za')],[0,T('wv.zo','zo')]];
