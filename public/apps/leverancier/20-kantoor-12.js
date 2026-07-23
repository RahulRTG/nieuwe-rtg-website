    // eventkeuken: gerechten aan/uit tikken en bewaren
    el.querySelectorAll('[data-kdish]').forEach(b => b.addEventListener('click', () => {
      const aan = b.style.borderColor !== '';
      b.style.borderColor = aan ? '' : 'var(--gold)';
      b.style.color = aan ? '' : 'var(--gold)';
    }));
    el.querySelectorAll('[data-kcat]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.kcat;
      const itemIds = [...el.querySelectorAll('[data-kdish][data-ev="'+id+'"]')].filter(x => x.style.borderColor !== '').map(x => x.dataset.kdish);
      try { await API.call('/supplier/event/catering', { id, mode: el.querySelector('#kcm'+id).value, itemIds });
        kantoorMsg = '\u2705 '+T('ek.saved','Eventkeuken bewaard; de keuken ziet het direct op het keukenscherm.');
        await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kaladd]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.kaladd;
      const allergen = el.querySelector('#kaN'+id).value.trim();
      if (!allergen){ toast(T('ek.fillallergen','Vul het allergeen in.')); return; }
      try { await API.call('/supplier/event/allergy', { id, action:'add', allergen, count: Number(el.querySelector('#kaC'+id).value)||1 }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kaldel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/event/allergy', { id: b.dataset.kaldel, action:'remove', allergyId: b.dataset.al }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kalt]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = T('ek.thinking','De chef denkt na...');
      try { const d = await API.call('/supplier/event/allergy/alt', { id: b.dataset.kalt, allergyId: b.dataset.al });
        kantoorMsg = '\u2728 '+T('ek.altmade','Vervangend gerecht')+': <b>'+d.alternative.name+'</b>'+(d.alternative.desc?' \u00b7 '+d.alternative.desc:'');
        await refresh(); } catch(e){ toast(e.message); b.disabled = false; }
    }));
    el.querySelectorAll('[data-kmep]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = T('ek.busy','De mise en place wordt georganiseerd...');
      try { const d = await API.call('/supplier/event/mep', { id: b.dataset.kmep });
        kantoorMsg = '\u2705 '+d.added+' '+T('ek.planned2','MEP-taken ingepland (') + d.covers + ' couverts); '+T('ek.onscreen','de keuken ziet ze dagen vooruit op het keukenscherm.');
        await refresh(); } catch(e){ toast(e.message); b.disabled = false; }
    }));
    el.querySelectorAll('[data-krdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/event/runsheet', { id: b.dataset.krdel, action:'remove', itemId: b.dataset.item }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-krfile]').forEach(inp => inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { el.querySelector('#krP'+inp.dataset.krfile).value = String(rd.result || '').slice(0, 6000); toast(T('rs.loaded','Bestand ingeladen, klik op Verwerk met AI.')); };
      rd.readAsText(f);
    }));
    el.querySelectorAll('[data-krimp]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.krimp;
      const text = el.querySelector('#krP'+id).value.trim();
      if (!text){ toast(T('rs.pastefirst','Plak eerst een draaiboek of upload een bestand.')); return; }
      b.disabled = true;
      try { const d = await API.call('/supplier/event/runsheet/ai', { id, mode:'import', text });
        kantoorMsg = '\u2705 '+d.added+' '+T('rs.imported','regels in het draaiboek gezet, verdeeld over de werkplekken.');
        await refresh(); } catch(e){ toast(e.message); b.disabled = false; }
    }));
    el.querySelectorAll('[data-krai]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = T('rs.thinking','De AI stelt het draaiboek op...');
      try { const d = await API.call('/supplier/event/runsheet/ai', { id: b.dataset.krai, mode:'suggest' });
        kantoorMsg = '\u2728 '+d.added+' '+T('rs.suggested','regels voorgesteld. Pas aan wat niet past en publiceer het event.');
        await refresh(); } catch(e){ toast(e.message); b.disabled = false; }
    }));
    // kamers of verblijven: open/dicht, housekeeping doorschakelen, toevoegen
    el.querySelectorAll('[data-kmrt]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/toggle', { id: b.dataset.kmrt }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kmhk]').forEach(b => b.addEventListener('click', async () => {
      const volg = { schoon:'vuil', vuil:'bezig', bezig:'bezet', bezet:'defect', defect:'schoon' };
      try { await API.call('/supplier/room/hk', { id: b.dataset.kmhk, status: volg[b.dataset.cur] || 'schoon' }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kmrd]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/remove', { id: b.dataset.kmrd }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const kRm = el.querySelector('#kRmAdd'); if (kRm) kRm.addEventListener('click', async () => {
      const name = el.querySelector('#kRmN').value.trim(), price = Number(el.querySelector('#kRmP').value);
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
