    // panden
    html += '<div class="card"><div class="tt-h">'+T('vg.panden','Panden')+' ('+(vg.panden||[]).length+')</div>'+
      (vg.panden||[]).map(p => '<div class="mitem"><div class="r1"><span class="nm">'+esc(p.titel)+'</span><span class="pr">'+geld(p.prijs)+(p.transactie==='huur'?'/mnd':'')+'</span></div>'+
        '<div class="ds">'+esc(p.soort)+' \u00B7 '+esc(p.plaats||'')+' \u00B7 \uD83D\uDECF\uFE0F'+(p.slaapkamers||0)+' \u00B7 \uD83D\uDEC1'+(p.badkamers||0)+' \u00B7 '+(p.oppervlakte||0)+'m\u00B2'+(p.keyless?' \u00B7 \uD83D\uDD13 keyless':'')+' \u00B7 '+T('vg.st.'+p.status, PAND_ST[p.status]||p.status)+' \u00B7 \uD83D\uDCF7'+((p.fotos||[]).length)+'</div>'+
        (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;">'+
          '<button class="obtn primary" data-vgaanbod="'+p.id+'" data-titel="'+escAttr(p.titel)+'">'+T('vg.aanbieden','Aanbieden')+'</button>'+
          '<button class="obtn" data-vgfoto="'+p.id+'">\uD83D\uDCF7 '+T('vg.foto','Foto')+'</button>'+
          '<button class="obtn" data-vgcontract="'+p.id+'" data-titel="'+escAttr(p.titel)+'">\uD83D\uDCDD '+T('vg.contract','Contract')+'</button>'+
          '<button class="rr-del" data-vgdel="'+p.id+'">\u2715</button></div>':'')+'</div>').join('')+
      (canEdit ? '<details class="h-mt100"><summary style="cursor:pointer;font-size:0.82rem;color:var(--gold);">'+T('vg.nieuw','Pand toevoegen')+'</summary><div style="margin-top:0.8rem;">'+
        '<div class="field"><label>'+T('vg.f.titel','Titel')+'</label><input id="vgTitel" placeholder="Villa met zeezicht"></div>'+
        '<div class="row-gap"><div class="field h-flex1"><label>'+T('vg.f.soort','Soort')+'</label><select id="vgSoort" '+sel+'><option value="woning">woning</option><option value="appartement">appartement</option><option value="villa">villa</option><option value="commercieel">commercieel</option><option value="grond">grond</option></select></div>'+
        '<div class="field h-flex1"><label>'+T('vg.f.trans','Koop/huur')+'</label><select id="vgTrans" '+sel+'><option value="koop">koop</option><option value="huur">huur (p/mnd)</option></select></div></div>'+
        '<div class="row-gap"><div class="field h-flex2"><label>'+T('vg.f.plaats','Plaats')+'</label><input id="vgPlaats"></div>'+
        '<div class="field h-flex1"><label>'+T('vg.f.prijs','Prijs \u20AC')+'</label><input id="vgPrijs" type="number" inputmode="numeric"></div></div>'+
        '<div class="row-gap"><div class="field h-flex1"><label>'+T('vg.f.slk','Slaapk.')+'</label><input id="vgSlk" type="number" value="3"></div>'+
        '<div class="field h-flex1"><label>'+T('vg.f.bdk','Badk.')+'</label><input id="vgBdk" type="number" value="2"></div>'+
        '<div class="field h-flex1"><label>m\u00B2</label><input id="vgOpp" type="number"></div></div>'+
        '<div class="field"><label>'+T('vg.f.oms','Omschrijving')+'</label><textarea id="vgOms" rows="2" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem;color:var(--txt);outline:none;font-family:inherit;"></textarea></div>'+
        '<label class="field" style="display:flex;align-items:center;gap:0.4rem;"><input type="checkbox" id="vgKeyless" checked style="accent-color:var(--gold);"> '+T('vg.f.keyless','Keyless toegang mogelijk')+'</label>'+
        '<button class="obtn primary" id="vgAdd">'+T('vg.f.voeg','Toevoegen')+'</button></div></details>' : '')+'</div>'+
      '<input type="file" id="vgFile" accept="image/*" style="display:none;">';
    el.innerHTML = html;
    // acties
    document.querySelectorAll('[data-bod]').forEach(k => k.addEventListener('click', async () => {
      const body = { ref: k.dataset.bod, actie: k.dataset.actie };
      if (k.dataset.actie === 'tegenbod'){ const t = prompt(T('vg.q.tegen','Tegenbod in euro?')); if (!t) return; body.tegenbod = Number(t); }
      try { await API.call('/supplier/bod/beslis', body); await laadVastgoed(); openTab('vastgoed'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-bezbev]').forEach(k => k.addEventListener('click', async () => {
      const m = prompt(T('vg.q.moment','Datum en tijd van de bezichtiging (JJJJ-MM-DD UU:MM):'), new Date(Date.now()+86400000).toISOString().slice(0,16).replace('T',' '));
      if (!m) return;
      try { await API.call('/supplier/bezichtiging/beslis', { ref: k.dataset.bezbev, actie: 'bevestigen', moment: m.replace(' ','T') }); toast(T('vg.bevok','Bevestigd; keyless staat klaar als het pand keyless is.')); await laadVastgoed(); openTab('vastgoed'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-bezafw]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/bezichtiging/beslis', { ref: k.dataset.bezafw, actie: 'afwijzen' }); await laadVastgoed(); openTab('vastgoed'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vgaanbod]').forEach(k => k.addEventListener('click', async () => {
      const wie = prompt(T('vg.q.aan','Aanbieden aan wie? Typ codenamen (komma\'s), of laat leeg voor PUBLIEK:'));
      if (wie === null) return;
      const body = { pandId: k.dataset.vgaanbod };
      if (wie.trim()) body.codenamen = wie.split(','); else { body.publiek = true; body.salon = confirm(T('vg.q.salon','Ook op De Salon plaatsen voor uw volgers?')); }
      try { const r = await API.call('/supplier/aanbieding', body); toast(T('vg.aanbok','Aangeboden aan ')+(r.aanbieding.publiek?T('vg.iedereen','iedereen'):(r.aanbieding.aan+' lid/leden'))+(r.aanbieding.nietGevonden.length?' ('+T('vg.nietgev','niet gevonden')+': '+r.aanbieding.nietGevonden.join(', ')+')':'')); await laadVastgoed(); openTab('vastgoed'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vgcontract]').forEach(k => k.addEventListener('click', () => {
      openTab('contract');
      setTimeout(() => { const t = document.getElementById('ctTitel'); if (t){ t.value = T('vg.koopc','Koopovereenkomst ')+k.dataset.titel; const so = document.getElementById('ctSoort'); if (so){ so.value='algemeen'; } } }, 200);
      toast(T('vg.contracttip','Vul de codenaam van de koper in en verstuur het contract.'));
    }));
    document.querySelectorAll('[data-vgfoto]').forEach(k => k.addEventListener('click', () => {
      const file = document.getElementById('vgFile');
      file.onchange = () => { if (!file.files[0]) return; fotoKlein(file.files[0], async (d) => {
        try { await API.call('/supplier/pand/foto', { id: k.dataset.vgfoto, foto: d }); toast(T('vg.fotook','Foto toegevoegd.')); await laadVastgoed(); openTab('vastgoed'); } catch(e){ toast(e.message); }
      }); file.value=''; };
      file.click();
    }));
    document.querySelectorAll('[data-vgdel]').forEach(k => k.addEventListener('click', async () => {
      if (!confirm(T('vg.delvraag','Dit pand verwijderen?'))) return;
      try { await API.call('/supplier/pand', { id: k.dataset.vgdel, weg: true }); await laadVastgoed(); openTab('vastgoed'); } catch(e){ toast(e.message); }
    }));
    const add = document.getElementById('vgAdd');
    if (add) add.addEventListener('click', async () => {
      const g = id => $(id) ? $(id).value : undefined;
      try { await API.call('/supplier/pand', { titel: g('#vgTitel'), soort: g('#vgSoort'), transactie: g('#vgTrans'), plaats: g('#vgPlaats'),
        prijs: Number(g('#vgPrijs')), slaapkamers: Number(g('#vgSlk')), badkamers: Number(g('#vgBdk')), oppervlakte: Number(g('#vgOpp')),
        omschrijving: g('#vgOms'), keyless: $('#vgKeyless') ? $('#vgKeyless').checked : true });
        toast(T('vg.addok','Het pand staat in uw portefeuille.')); await laadVastgoed(); openTab('vastgoed'); } catch(e){ toast(e.message); }
    });
  }

  // ---- contracten: opstellen en ondertekenen ----
  let contracten = null;
  const CON_ST = { 'wacht': 'wacht op handtekening(en)', 'getekend': 'volledig getekend', 'geweigerd': 'geweigerd' };
  async function laadContracten(){
    if (!API.live) return;
    try { contracten = (await API.call('/supplier/contracten')).contracten; } catch(e){ contracten = []; }
    renderContracten();
  }
  /* Onboarding & contract voor de eigen mensen: welke gegevens ze invullen en
     welk contract ze tekenen. Aan te passen met AI in gewone taal. */
  let onbCfg = null;
  const ONB_WIE = { guest:'gast', rtg:'RTG', lifestyle:'Lifestyle', business:'Business', rtf:'RTF' };
  async function laadOnbCfg(){ try { onbCfg = await API.call('/supplier/onboarding/config'); } catch(e){ onbCfg = { fout:1 }; } renderOnbCfg(); }
  function renderOnbCfg(){
    const el = $('#onbCfgWrap'); if (!el) return;
    if (onbCfg === null){ el.innerHTML = '<div class="empty">\u2026</div>'; laadOnbCfg(); return; }
    if (onbCfg.fout){ el.innerHTML = '<div class="softline">'+T('onb.err','Kon de onboarding niet laden.')+'</div>'; return; }
    const canEdit = actor().manager;
    const c = onbCfg.config, cnt = onbCfg.ondertekenaars || [];
    let h = '';
