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
    if (canEdit) h += '<div class="card" style="border-color:var(--gold);"><div class="tt-h">\u2728 '+T('onb.ai','Aanpassen met AI')+'</div>'+
      '<p class="sub">'+T('onb.ai.s','Beschrijf in gewone taal wat u wilt. Bijv. "voeg het veld BSN toe" of "zet in het contract dat annuleren tot 24 uur vooraf kan".')+'</p>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="onbAiIn" class="st-in" style="flex:1;" placeholder="'+T('onb.ai.ph','Wat wilt u aanpassen?')+'"><button class="obtn primary" id="onbAiGo">'+T('onb.ai.go','Aanpassen')+'</button></div>'+
      '<div id="onbAiUit" class="sub" style="margin-top:0.5rem;"></div></div>';
    h += '<div class="card"><div class="tt-h">\ud83d\udccb '+T('onb.velden','Verplichte gegevens')+'</div>'+
      c.velden.map(v => '<div class="st-row"><span>'+esc(v.label)+'<span class="sub">'+esc(v.type)+' \u00b7 '+(v.voorWie||[]).map(w=>ONB_WIE[w]||w).join(', ')+'</span></span></div>').join('')+'</div>';
    h += '<div class="card"><div class="tt-h">\ud83d\udcc4 '+esc(c.contract.titel)+' <span class="sub">v'+c.contract.versie+'</span></div>'+
      '<div style="max-height:15rem;overflow:auto;white-space:pre-wrap;font-size:0.8rem;line-height:1.6;color:var(--soft);margin-top:0.4rem;">'+esc(c.contract.tekst)+'</div></div>';
    h += '<div class="card"><div class="tt-h">\u270d\ufe0f '+T('onb.get','Ondertekend')+' ('+cnt.length+')</div>'+
      (cnt.length ? cnt.slice(0,30).map(o=>'<div class="st-row"><span>'+esc(o.naam)+'<span class="sub">v'+o.versie+' \u00b7 '+new Date(o.at).toLocaleDateString('nl-NL')+'</span></span></div>').join('') : '<p class="sub">'+T('onb.niemand','Nog niemand heeft getekend.')+'</p>')+'</div>';
    el.innerHTML = h;
    const go = $('#onbAiGo'); if (go) go.addEventListener('click', async () => {
      const opdracht = (($('#onbAiIn')||{}).value || '').trim();
      if (opdracht.length < 3){ toast(T('onb.ai.kort','Beschrijf iets uitgebreider.')); return; }
      go.disabled = true; $('#onbAiUit').textContent = T('onb.ai.bezig','Bezig...');
      try { const r = await API.call('/supplier/onboarding/ai', { opdracht }); onbCfg = { config: r.config, ondertekenaars: cnt }; renderOnbCfg(); toast('\u2728 ' + (r.uitleg || T('onb.klaar','Aangepast.'))); }
      catch(e){ $('#onbAiUit').textContent = e.message; go.disabled = false; }
    });
  }
  function renderContracten(){
    const el = $('#contractWrap'); if (!el) return;
    if (contracten === null){ el.innerHTML = '<div class="empty">\u2026</div>'; laadContracten(); return; }
    const canEdit = actor().manager;
