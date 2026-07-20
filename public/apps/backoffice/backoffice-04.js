        const box = $('#paResult');
        box.style.display = 'block';
        box.innerHTML = '✅ '+T('bo.pa.done','Goedgekeurd. Geef dit eenmalig door (staat ook in de welkomstmail):')+
          '<br><b>'+T('bo.pa.code','Leverancierscode')+': '+d.code+'</b> · <b>'+T('bo.pa.pin','Manager-PIN')+': '+d.pin+'</b>';
        await refresh();
      } catch(e){ alert(e.message); }
    }));
    document.querySelectorAll('[data-pano]').forEach(b => b.addEventListener('click', async () => {
      try { await call('/office/partner/decide', { id: b.dataset.pano, action: 'afwijzen' }); await refresh(); } catch(e){ alert(e.message); }
    }));

    // schoolaanmeldingen: een school kan pas personeel toelaten en klassen maken
    // nadat RTG hem hier goedkeurt
    const scholen = (state.pendingSchools || []).filter(x => past(x.naam, x.code, x.plaats));
    $('#schoolList').innerHTML = scholen.length ? scholen.map(x =>
      '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(x.naam)+' <span style="color:var(--soft);font-weight:400;">· '+escHtml(x.plaats||'')+'</span></div>'+
        '<div class="sub">'+T('bo.sc.code','code')+' '+escHtml(x.code)+' · '+x.personeel+' '+T('bo.sc.staff','aanmelding(en) personeel')+' · '+timeAgo(x.at)+'</div></div>'+
        '<div style="display:flex;gap:0.4rem;flex-shrink:0;"><button class="vbtn ok" data-scok="'+escHtml(x.code)+'">'+T('bo.sc.approve','Goedkeuren')+'</button><button class="vbtn" data-scno="'+escHtml(x.code)+'">'+T('bo.sc.reject','Afwijzen')+'</button></div>'+
      '</div></div>'
    ).join('') : '<div class="empty">'+T('bo.nosc','Geen wachtende schoolaanmeldingen. Scholen melden zich aan via de RTFoundation-app; hier keurt u ze goed voordat ze personeel en klassen kunnen aanmaken.')+'</div>';
    document.querySelectorAll('[data-scok]').forEach(b => b.addEventListener('click', async () => {
      try { await call('/office/school/decide', { code: b.dataset.scok, action: 'goedkeuren' }); await refresh(); } catch(e){ alert(e.message); }
    }));
    document.querySelectorAll('[data-scno]').forEach(b => b.addEventListener('click', async () => {
      try { await call('/office/school/decide', { code: b.dataset.scno, action: 'afwijzen' }); await refresh(); } catch(e){ alert(e.message); }
    }));
  }

  // De tijdlijn is schaalvast: de server bladert en zoekt door de volledige
  // historie; het scherm toont altijd 25 regels plus het eerlijke totaal.
  async function laadTimeline(){
    try { tl = await call('/office/timeline', { page: tlPage, q: ($('#zoekInp').value || '').trim() }); }
    catch(e){ tl = { items: [], total: 0, page: 1, pages: 1 }; }
    renderTimeline();
  }
  function renderTimeline(){
    if (!tl) return;
    const KLAAR_R = { 'afgerond':1, 'gearriveerd':1, 'geweigerd':1, 'geserveerd':1, 'terugbetaald':1, 'klaar':1 };
    $('#tlTot').textContent = '(' + tl.total.toLocaleString(lang()==='en'?'en-US':'nl-NL') + ')';
    $('#orders').innerHTML = tl.items.length ? tl.items.map(x => {
      const pc = (x.status==='nieuw'||x.status==='aangevraagd')?'nieuw':KLAAR_R[x.status]?'klaar':'bereiding';
      const icoon = x.soort==='order'?'🛎️':x.soort==='jet'?'✈️':'🚗';
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(x.supplierName)+' <span style="color:var(--soft);font-weight:400;">· '+T('bo.guest','gast')+' '+escHtml(x.customerCodename)+'</span></div>'+
        '<div class="sub">'+icoon+' '+escHtml(x.sub||'')+' · '+timeAgo(x.at)+(x.when?' · '+escHtml(x.when):'')+' · '+(x.paid?T('bo.paid','betaald'):T('bo.unpaid','onbetaald'))+'</div></div>'+
        '<div style="text-align:right;"><div class="amt">'+eur(x.bedrag)+'</div><span class="pill '+pc+'">'+tStatus(x.status)+'</span></div></div></div>';
    }).join('') : '<div class="empty">'+T('bo.noorders','Nog geen bestellingen of ritten via partners.')+'</div>';
    const pager = $('#tlPager');
    pager.style.display = tl.pages > 1 ? 'flex' : 'none';
    $('#tlWaar').textContent = T('bo.pagina','Pagina') + ' ' + tl.page + ' / ' + tl.pages;
    $('#tlPrev').disabled = tl.page <= 1;
    $('#tlNext').disabled = tl.page >= tl.pages;
  }
  $('#tlPrev').addEventListener('click', () => { if (tlPage > 1){ tlPage--; laadTimeline(); } });
  $('#tlNext').addEventListener('click', () => { if (tl && tlPage < tl.pages){ tlPage++; laadTimeline(); } });

  function stream(){
    if (!window.EventSource) return;
    try { source = new EventSource('/api/office/stream?token='+encodeURIComponent(API.token)); } catch(e){ return; }
    source.addEventListener('sync', () => { refresh(); laadTimeline(); loadVerify(); loadConcierge(); loadIncidenten(); loadSalonNaleving(); loadOntmoetingen(); loadTrust(); });
    source.addEventListener('notify', e => { refresh(); const p=$('#prices'); if(p) p.classList.add('flash'); setTimeout(()=>p&&p.classList.remove('flash'),1600); });
    // Salon-ontmoetingen: SOS-alarm en het live camerabeeld (WebRTC-signaal)
    source.addEventListener('ontmoeting-sos', () => { loadOntmoetingen(); const p=$('#prices'); if(p) p.classList.add('flash'); });
    source.addEventListener('ontmoeting-signaal', e => { try { opOntSignaal(JSON.parse(e.data)); } catch(err){} });
  }

  $('#docScrim').addEventListener('click', () => { $('#docScrim').classList.remove('open'); $('#docImg').src = ''; });

  // dagbriefing: een samenvatting van vandaag in gewone taal, met een tik
  $('#briefBtn').addEventListener('click', async () => {
    const box = $('#briefBox');
    if (box.classList.contains('on')){ box.classList.remove('on'); return; }
    box.textContent = '…';
    box.classList.add('on');
    try { box.textContent = (await call('/office/briefing', { lang: lang() })).briefing; }
    catch(e){ box.textContent = e.message; }
  });

  // zoeken: filtert de panelen direct en laat de server door de volledige
  // tijdlijn zoeken (met een korte adempauze tegen onnodige verzoeken)
  $('#zoekInp').addEventListener('input', () => {
    if (!state) return;
    render();
    clearTimeout(tlTimer);
    tlTimer = setTimeout(() => { tlPage = 1; laadTimeline(); }, 350);
  });

  // export voor de boekhouding: de server bouwt het volledige bestand, hoe
  // groot de historie ook is. Via fetch met de Authorization-header (nooit
  // het token in een URL) en dan een blob-download.
  $('#csvBtn').addEventListener('click', async () => {
    if (!API.token) return;
    try {
      const r = await fetch('/api/office/export.csv', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + API.token }, body: '{}'
      });
      if (!r.ok) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await r.blob());
      a.download = 'rtg-backoffice-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {}
  });

  window.addEventListener('rtglang', () => { if (state){ render(); loadVerify(); } });
})();
