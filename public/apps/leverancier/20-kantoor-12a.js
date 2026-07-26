      if (!name || !(price>0)){ toast(T('sup.roomfill','Vul een kamernaam en prijs in.')); return; }
      try { await API.call('/supplier/room/add', { name, price }); kantoorMsg = '\u2705 '+T('sup.roomadded','Kamer toegevoegd en direct zichtbaar.'); await refresh(); } catch(e){ toast(e.message); }
    });
    // minibar-assortiment
    el.querySelectorAll('[data-kmbd]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/minibar/item/remove', { id: b.dataset.kmbd }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const kMb = el.querySelector('#kMbAdd'); if (kMb) kMb.addEventListener('click', async () => {
      const name = el.querySelector('#kMbN').value.trim(), price = Number(el.querySelector('#kMbP').value);
      if (!name || !(price>0)){ toast(T('mb.fill','Vul een artikel en prijs in.')); return; }
      try { await API.call('/supplier/minibar/item/add', { name, price }); await refresh(); } catch(e){ toast(e.message); }
    });
    // deuren
    el.querySelectorAll('[data-kdoor]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/door/toggle', { id: b.dataset.kdoor }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // aanbodbeheer van de zelfstandige
    const svA = el.querySelector('#svAdd'); if (svA) svA.addEventListener('click', async () => {
      try {
        await API.call('/supplier/service', { action: 'add',
          name: el.querySelector('#svNaam').value, desc: el.querySelector('#svDesc').value,
          price: Number(el.querySelector('#svPrijs').value), duurMin: Number(el.querySelector('#svDuur').value),
          soort: el.querySelector('#svSoort').value });
        kantoorMsg = ''+T('kt.svklaar','In de app gezet; leden kunnen direct boeken.');
        await refresh();
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-svdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/service', { action: 'remove', id: b.dataset.svdel }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // vakwerk: een aanvraag bevestigen of een afspraak afronden
    el.querySelectorAll('[data-vakbev]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/booking/status', { ref: b.dataset.vakbev, status: 'bevestigd' }); vakData = null; kantoorMsg = ''+T('vk.bevok','Bevestigd; het lid krijgt bericht.'); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-vakaf]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/booking/status', { ref: b.dataset.vakaf, status: 'afgerond' }); vakData = null; kantoorMsg = ''+T('vk.afok','Afgerond en genoteerd.'); await refresh(); } catch(e){ toast(e.message); }
    }));
    // vakwerk: werkdagen aan/uit tikken (lokaal, tot Opslaan)
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
