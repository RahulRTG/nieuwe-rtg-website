  // ---- de marina op zak: steiger, brandstof, service en de concierge ----
  let pdMar = null;
  const heeftMarina = () => !!(state && state.supplier && (state.supplier.caps || []).includes('marina'));
  async function laadMarinaPda(){
    if (!heeftMarina()) return;
    try { pdMar = await API.call('/supplier/marina', {}); } catch(e){ pdMar = null; }
    renderMarinaPda();
  }
  function renderMarinaPda(){
    const tabBtn = document.getElementById('tabMarina');
    if (tabBtn) tabBtn.style.display = heeftMarina() ? '' : 'none';
    const wrap = $('#marinaPdaWrap'); if (!wrap) return;
    if (!heeftMarina()){ wrap.innerHTML = ''; return; }
    if (!pdMar){ wrap.innerHTML = '<div class="card">…</div>'; laadMarinaPda(); return; }
    const d = pdMar;
    const SVC = { hijs: 'Hijskraan', helling: 'Hellingbaan', onderhoud: 'Onderhoud', schoonmaak: 'Schoonmaak' };
    const CON = { tender: 'Tender', catering: 'Catering aan boord', crew: 'Crew voor een dag', 'charter-transfer': 'Charter-transfer' };
    let html = '';
    // de steiger: bezetting in een oogopslag
    const vrij = (d.ligplaatsen||[]).filter(p => !p.boot);
    html += '<div class="card"><div class="k">'+T('pd.mr.steiger','De steiger')+' ('+d.kpi.bezet+' van '+d.kpi.ligplaatsen+')</div>'+
      '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+(vrij.length ? T('pd.mr.vrij','Vrij:')+' '+vrij.map(p=>p.id+' (tot '+p.lengteMax+' m)').join(' · ') : T('pd.mr.vol','De haven ligt vol.'))+'</div></div>';
    // de brandstofsteiger
    const tanken = (d.brandstof||[]).filter(b => b.status === 'gevraagd');
    html += '<div class="card"><div class="k">'+T('pd.mr.brand','Brandstof')+' ('+tanken.length+')</div>'+
      (tanken.length ? tanken.map(b => '<div class="task"><div class="t"><b>'+esc(b.boot)+'</b><span>'+esc(b.soort)+' · '+b.liters+' l</span></div><button class="abtn" data-pmbk="'+b.id+'">'+T('pd.mr.getankt','Getankt')+'</button></div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.mr.geenbrand','Niemand aan de pomp.')+'</div>')+'</div>';
    // service en de helling
    const werk = (d.service||[]).filter(s => s.status !== 'klaar');
    html += '<div class="card"><div class="k">'+T('pd.mr.svc','Service en de helling')+' ('+werk.length+')</div>'+
      (werk.length ? werk.map(s => '<div class="task"><div class="t"><b>'+esc(s.boot)+'</b><span>'+SVC[s.soort]+' · '+esc(s.wens)+' · '+esc(s.status)+'</span></div>'+
        (s.status==='open' ? '<button class="abtn" data-pmsb="'+s.id+'">'+T('pd.mr.pak','Pak op')+'</button>' : '<button class="abtn" data-pmsk="'+s.id+'">'+T('pd.mr.klaar','Klaar')+'</button>')+'</div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.mr.geensvc','De werf ligt er netjes bij.')+'</div>')+'</div>';
    // de marina-concierge
    const con = (d.concierge||[]).filter(c => c.status !== 'afgerond');
    html += '<div class="card"><div class="k">'+T('pd.mr.con','Marina-concierge')+' ('+con.length+')</div>'+
      (con.length ? con.map(c => '<div class="task"><div class="t"><b>'+CON[c.soort]+' · '+esc(c.voorWie)+'</b><span>'+esc(c.wens)+' · '+esc(c.moment)+' · '+esc(c.status)+'</span></div>'+
        (c.status==='aangevraagd' ? '<button class="abtn" data-pmcb="'+c.id+'">'+T('pd.mr.bevestig','Bevestig')+'</button>' : '<button class="abtn" data-pmca="'+c.id+'">'+T('pd.mr.afgerond','Afgerond')+'</button>')+'</div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.mr.geencon','Geen open verzoeken.')+'</div>')+'</div>';
    wrap.innerHTML = html;
    const doe = (sel, body) => wrap.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      const { pad, data } = body(b.dataset);
      try { await API.call(pad, data); laadMarinaPda(); } catch(e){ toast(e.message); }
    }));
    doe('data-pmbk', ds => ({ pad: '/supplier/marina/brandstof/klaar', data: { id: ds.pmbk } }));
    doe('data-pmsb', ds => ({ pad: '/supplier/marina/service/status', data: { id: ds.pmsb, status: 'bezig' } }));
    doe('data-pmsk', ds => ({ pad: '/supplier/marina/service/status', data: { id: ds.pmsk, status: 'klaar' } }));
    doe('data-pmcb', ds => ({ pad: '/supplier/marina/concierge/status', data: { id: ds.pmcb, status: 'bevestigd' } }));
    doe('data-pmca', ds => ({ pad: '/supplier/marina/concierge/status', data: { id: ds.pmca, status: 'afgerond' } }));
  }

  // ---- de verzekeraar op zak: adviesvragen, declaraties, pas-controle ----
  let pdPol = null, pdPolZorg = null;
  const heeftPolis = () => !!(state && state.supplier && (state.supplier.caps || []).includes('polis'));
  async function laadPolisPda(){
    if (!heeftPolis()) return;
    try { pdPol = await API.call('/supplier/polis', {}); } catch(e){ pdPol = null; }
    try { pdPolZorg = await API.call('/supplier/zorgpolis', {}); } catch(e){ pdPolZorg = null; }
    renderPolisPda();
  }
  function renderPolisPda(){
    const tabBtn = document.getElementById('tabPolis');
    if (tabBtn) tabBtn.style.display = heeftPolis() ? '' : 'none';
    const wrap = $('#polisPdaWrap'); if (!wrap) return;
    if (!heeftPolis()){ wrap.innerHTML = ''; return; }
    if (!pdPol || !pdPolZorg){ wrap.innerHTML = '<div class="card">…</div>'; laadPolisPda(); return; }
    let html = '';
    // open adviesvragen: de adviseur schrijft het advies zelf, ook op zak
    const open = (pdPol.aanvragen||[]).filter(a => a.status === 'aangevraagd');
    html += '<div class="card"><div class="k">'+T('pd.pol.advies','Adviesvragen')+' ('+open.length+')</div>'+
      (open.length ? open.map(a => '<div class="task"><div class="t"><b>'+esc(a.klant)+' · '+esc(a.product)+'</b><span>'+esc(a.situatie)+'</span></div></div>'+
        '<div style="display:flex;gap:0.4rem;margin:0.3rem 0 0.6rem;"><input data-ppat="'+a.id+'" placeholder="'+T('pd.pol.schrijf','Het advies (van u, niet van het systeem)')+'" maxlength="240" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:8px;color:var(--txt);font:inherit;font-size:0.78rem;padding:0.4rem 0.6rem;">'+
        '<button class="abtn" data-ppak="'+a.id+'">'+T('pd.pol.klaar','Advies klaar')+'</button></div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.pol.geenadvies','Geen open adviesvragen.')+'</div>')+'</div>';
    // declaraties: goedkeuren met een tik, afwijzen alleen met een reden
    const decl = (pdPolZorg.declaraties||[]).filter(x => x.status === 'ingediend');
    html += '<div class="card"><div class="k">'+T('pd.pol.decl','Declaraties')+' ('+decl.length+')</div>'+
      (decl.length ? decl.map(x => '<div class="task"><div class="t"><b>'+esc(x.codenaam)+' · '+esc(x.omschrijving)+'</b><span>'+eur(x.bedrag)+'</span></div>'+
        '<button class="abtn" data-ppdg="'+x.id+'">'+T('pd.pol.goed','Keur goed')+'</button></div>'+
        '<div style="display:flex;gap:0.4rem;margin:0.3rem 0 0.6rem;"><input data-ppdr="'+x.id+'" placeholder="'+T('pd.pol.reden','Reden bij afwijzen')+'" maxlength="160" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:8px;color:var(--txt);font:inherit;font-size:0.78rem;padding:0.4rem 0.6rem;">'+
        '<button class="abtn" data-ppda="'+x.id+'" style="background:var(--card2);color:var(--txt);border:1px solid var(--line);">'+T('pd.pol.af','Wijs af')+'</button></div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.pol.geendecl','Geen open declaraties.')+'</div>')+'</div>';
    // de pas-controle
    html += '<div class="card"><div class="k">'+T('pd.pol.pas','Pas-controle')+'</div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="ppPas" placeholder="ZP-XXXX" maxlength="12" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:8px;color:var(--txt);font:inherit;font-size:0.85rem;padding:0.45rem 0.6rem;text-transform:uppercase;">'+
      '<button class="abtn" id="ppGo">'+T('pd.pol.check','Controleer')+'</button></div>'+
      '<div id="ppUit" style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);"></div></div>';
    wrap.innerHTML = html;
    const doe2 = (sel, fn) => wrap.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', () => fn(b.dataset)));
    doe2('data-ppak', async ds => {
      try { await API.call('/supplier/polis/zet', { id: ds.ppak, status: 'advies-klaar', advies: (wrap.querySelector('[data-ppat="'+ds.ppak+'"]')||{}).value }); laadPolisPda(); } catch(e){ toast(e.message); }
    });
    doe2('data-ppdg', async ds => {
      try { await API.call('/supplier/zorgpolis/declaratie/beslis', { id: ds.ppdg, besluit: 'goedgekeurd', door: (me && me.name) || '' }); laadPolisPda(); } catch(e){ toast(e.message); }
    });
    doe2('data-ppda', async ds => {
      try { await API.call('/supplier/zorgpolis/declaratie/beslis', { id: ds.ppda, besluit: 'afgewezen', reden: (wrap.querySelector('[data-ppdr="'+ds.ppda+'"]')||{}).value, door: (me && me.name) || '' }); laadPolisPda(); } catch(e){ toast(e.message); }
    });
    const go = wrap.querySelector('#ppGo');
    if (go) go.addEventListener('click', async () => {
      try { const r = await API.call('/supplier/zorgpolis/pas', { pas: (wrap.querySelector('#ppPas')||{}).value });
        wrap.querySelector('#ppUit').textContent = (r.actief ? T('pd.pol.actief','Actief') : T('pd.pol.niet','Niet actief')) + ' · ' + r.pakket + ' · ' + r.codenaam;
      } catch(e){ const u = wrap.querySelector('#ppUit'); if (u) u.textContent = e.message; }
    });
  }


