  // ---- navigatie: vijf vaste knoppen, de rest overzichtelijk onder "Meer" ----
  const MAIN_TABS = ['home', 'kassa', 'ai', 'gchat', 'meer'];
  function buildTabs(){
    $('#tabbar').innerHTML = MAIN_TABS.map((k,i) =>
      '<button data-tab="'+k+'"'+(i===0?' class="active"':'')+'><svg viewBox="0 0 24 24">'+TABDEF[k].svg+'</svg>'+T('tab.'+k, TABDEF[k].label)+'</button>'
    ).join('');
    document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab, true)));
  }
  function openTab(tab, focusView){
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view===tab));
    const hi = MAIN_TABS.includes(tab) ? tab : 'meer';
    document.querySelectorAll('.tabbar button').forEach(b => {
      const on = b.dataset.tab===hi;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); // schermlezer meldt de actieve tab
    });
    $('#content').scrollTop = 0;
    // Alleen bij een echte klik de focus naar de nieuwe weergave verplaatsen, zodat
    // toetsenbord- en schermlezergebruikers meelopen (niet bij programmatische wissels).
    if (focusView){
      const v = document.querySelector('.view[data-view="'+tab+'"]');
      if (v){ v.setAttribute('tabindex','-1'); v.focus({ preventScroll: true }); }
    }
  }
  // ---- vastgoed: de slimme makelaars-backoffice ----
  let vg = null;
  const PAND_ST = { 'beschikbaar':'beschikbaar', 'onder-optie':'onder optie', 'verkocht':'verkocht', 'verhuurd':'verhuurd' };
  async function laadVastgoed(){
    if (!has('vastgoed') || !API.live) return;
    try { vg = await API.call('/supplier/vastgoed/overzicht', {}); } catch(e){ vg = { stats:{}, panden:[], aanbiedingen:[], bezichtigingen:[], biedingen:[] }; }
    renderVastgoed();
  }
  const geld = n => '\u20AC ' + Number(n||0).toLocaleString('nl-NL');
  function renderVastgoed(){
    const el = $('#vgWrap'); if (!el) return;
    if (!has('vastgoed')){ el.innerHTML = ''; return; }
    if (!vg){ el.innerHTML = '<div class="empty">\u2026</div>'; laadVastgoed(); return; }
    const canEdit = actor().manager;
    const st = vg.stats || {};
    const sel = 'style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"';
    let html = '';
    // dashboard
    html += '<div class="card"><div class="tt-h">'+T('vg.dash','Portefeuille')+'</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-top:0.6rem;">'+
      [[st.beschikbaar||0, T('vg.beschikbaar','beschikbaar')],[st.onderOptie||0, T('vg.optie','onder optie')],[st.verkocht||0, T('vg.verkocht','verkocht/verhuurd')],
       [st.openBezichtigingen||0, T('vg.bez','open bezichtigingen')],[st.openBiedingen||0, T('vg.bod','open biedingen')],[st.totaal||0, T('vg.totaal','panden')]]
      .map(c => '<div style="background:var(--card2,var(--card));border:1px solid var(--line);border-radius:12px;padding:0.6rem;text-align:center;"><div style="font-size:1.3rem;font-weight:700;color:var(--gold);">'+c[0]+'</div><div style="font-size:0.64rem;color:var(--soft);text-transform:uppercase;letter-spacing:0.06em;">'+c[1]+'</div></div>').join('')+
      '</div><div style="margin-top:0.6rem;font-size:0.78rem;color:var(--muted);">'+T('vg.waarde','Portefeuillewaarde (koop):')+' <b style="color:var(--gold);">'+geld(st.portefeuille)+'</b></div></div>';
    // open biedingen
    const openBod = (vg.biedingen||[]).filter(b => b.status === 'open');
    if (openBod.length) html += '<div class="card"><div class="tt-h">\uD83D\uDCB0 '+T('vg.biedingen','Biedingen')+' ('+openBod.length+')</div>'+
      openBod.map(b => '<div class="mitem"><div class="r1"><span class="nm">'+esc(b.codename)+' \u00B7 '+esc(b.pand)+'</span><span class="pr">'+geld(b.bedrag)+'</span></div>'+
        (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;"><button class="obtn primary" data-bod="'+b.ref+'" data-actie="accepteren">'+T('vg.accept','Accepteren')+'</button>'+
        '<button class="obtn" data-bod="'+b.ref+'" data-actie="tegenbod">'+T('vg.tegen','Tegenbod')+'</button>'+
        '<button class="obtn" data-bod="'+b.ref+'" data-actie="afwijzen">'+T('vg.afwijs','Afwijzen')+'</button></div>':'')+'</div>').join('')+'</div>';
    // open bezichtigingen
    const openBez = (vg.bezichtigingen||[]).filter(b => b.status === 'aangevraagd');
    if (openBez.length) html += '<div class="card"><div class="tt-h">\uD83D\uDC41\uFE0F '+T('vg.bezichtigingen','Bezichtigingen')+' ('+openBez.length+')</div>'+
      openBez.map(b => '<div class="mitem"><div class="r1"><span class="nm">'+esc(b.codename)+' \u00B7 '+esc(b.pand)+'</span></div>'+
        (b.wens?'<div class="ds">'+T('vg.wens','wens')+': '+esc(b.wens)+'</div>':'')+
        '<div style="margin-top:0.4rem;display:flex;gap:0.4rem;"><button class="obtn primary" data-bezbev="'+b.ref+'">'+T('vg.bevestig','Bevestig + keyless')+'</button>'+
        '<button class="obtn" data-bezafw="'+b.ref+'">'+T('vg.afwijs','Afwijzen')+'</button></div></div>').join('')+'</div>';
    // panden
    html += '<div class="card"><div class="tt-h">'+T('vg.panden','Panden')+' ('+(vg.panden||[]).length+')</div>'+
      (vg.panden||[]).map(p => '<div class="mitem"><div class="r1"><span class="nm">'+esc(p.titel)+'</span><span class="pr">'+geld(p.prijs)+(p.transactie==='huur'?'/mnd':'')+'</span></div>'+
        '<div class="ds">'+esc(p.soort)+' \u00B7 '+esc(p.plaats||'')+' \u00B7 \uD83D\uDECF\uFE0F'+(p.slaapkamers||0)+' \u00B7 \uD83D\uDEC1'+(p.badkamers||0)+' \u00B7 '+(p.oppervlakte||0)+'m\u00B2'+(p.keyless?' \u00B7 \uD83D\uDD13 keyless':'')+' \u00B7 '+T('vg.st.'+p.status, PAND_ST[p.status]||p.status)+' \u00B7 \uD83D\uDCF7'+((p.fotos||[]).length)+'</div>'+
        (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;">'+
          '<button class="obtn primary" data-vgaanbod="'+p.id+'" data-titel="'+escAttr(p.titel)+'">'+T('vg.aanbieden','Aanbieden')+'</button>'+
          '<button class="obtn" data-vgfoto="'+p.id+'">\uD83D\uDCF7 '+T('vg.foto','Foto')+'</button>'+
          '<button class="obtn" data-vgcontract="'+p.id+'" data-titel="'+escAttr(p.titel)+'">\uD83D\uDCDD '+T('vg.contract','Contract')+'</button>'+
          '<button class="rr-del" data-vgdel="'+p.id+'">\u2715</button></div>':'')+'</div>').join('')+
      (canEdit ? '<details style="margin-top:1rem;"><summary style="cursor:pointer;font-size:0.82rem;color:var(--gold);">'+T('vg.nieuw','Pand toevoegen')+'</summary><div style="margin-top:0.8rem;">'+
        '<div class="field"><label>'+T('vg.f.titel','Titel')+'</label><input id="vgTitel" placeholder="Villa met zeezicht"></div>'+
        '<div class="row-gap"><div class="field" style="flex:1;"><label>'+T('vg.f.soort','Soort')+'</label><select id="vgSoort" '+sel+'><option value="woning">woning</option><option value="appartement">appartement</option><option value="villa">villa</option><option value="commercieel">commercieel</option><option value="grond">grond</option></select></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vg.f.trans','Koop/huur')+'</label><select id="vgTrans" '+sel+'><option value="koop">koop</option><option value="huur">huur (p/mnd)</option></select></div></div>'+
        '<div class="row-gap"><div class="field" style="flex:2;"><label>'+T('vg.f.plaats','Plaats')+'</label><input id="vgPlaats"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vg.f.prijs','Prijs \u20AC')+'</label><input id="vgPrijs" type="number" inputmode="numeric"></div></div>'+
        '<div class="row-gap"><div class="field" style="flex:1;"><label>'+T('vg.f.slk','Slaapk.')+'</label><input id="vgSlk" type="number" value="3"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vg.f.bdk','Badk.')+'</label><input id="vgBdk" type="number" value="2"></div>'+
        '<div class="field" style="flex:1;"><label>m\u00B2</label><input id="vgOpp" type="number"></div></div>'+
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
    let html = '';
    html += '<div class="card"><div class="tt-h">'+T('ct.lijst','Contracten')+' ('+contracten.length+')</div>'+
      (contracten.length ? contracten.map(c => {
        const ontv = c.partij.kind === 'lid' ? c.partij.codename : c.partij.naam;
        const zaakGetekend = !!c.tekenZaak, partijGetekend = !!c.tekenPartij;
        const magZaakTekenen = canEdit && !zaakGetekend && c.status !== 'geweigerd';
        const magIkTekenen = !partijGetekend && c.partij.kind === 'staff' && c.status !== 'geweigerd' && !canEdit;
        return '<div class="mitem"><div class="r1"><span class="nm">'+esc(c.titel)+'</span><span class="pr" style="font-size:0.7rem;">'+T('ct.st.'+c.status, CON_ST[c.status]||c.status)+'</span></div>'+
          '<div class="ds">'+T('ct.soort.'+c.soort, c.soort)+' \u00B7 '+esc(ontv)+' \u00B7 '+(zaakGetekend?'\u2705':'\u25CB')+' '+T('ct.zaak','zaak')+' / '+(partijGetekend?'\u2705':'\u25CB')+' '+T('ct.partij','ontvanger')+'</div>'+
          (c.velden && c.velden.length ? '<div class="ds">'+c.velden.map(v=>esc(v.label)+': '+esc(v.waarde)).join(' \u00B7 ')+'</div>' : '')+
          '<details style="margin-top:0.3rem;"><summary style="cursor:pointer;font-size:0.72rem;color:var(--gold);">'+T('ct.tekst','Voorwaarden')+'</summary><div style="font-size:0.78rem;color:var(--muted);white-space:pre-wrap;margin-top:0.3rem;">'+esc(c.tekst)+'</div></details>'+
          ((magZaakTekenen||magIkTekenen)?'<div style="margin-top:0.5rem;"><button class="obtn primary" data-cteken="'+c.ref+'">'+T('ct.teken','Onderteken')+'</button></div>':'')+
          '</div>';
      }).join('') : '<div class="empty">'+T('ct.geen','Nog geen contracten.')+'</div>')+'</div>';
    if (canEdit){
      html += '<div class="card"><div class="tt-h">'+T('ct.nieuw','Nieuw contract')+'</div>'+
        '<div class="field"><label>'+T('ct.f.soort','Soort')+'</label><select id="ctSoort" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"><option value="verhuur">'+T('ct.soort.verhuur','Verhuur')+'</option><option value="personeel">'+T('ct.soort.personeel','Personeel')+'</option><option value="algemeen">'+T('ct.soort.algemeen','Algemeen')+'</option></select></div>'+
        '<div class="field"><label>'+T('ct.f.ontv','Voor wie')+'</label><select id="ctOntv" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"><option value="lid">'+T('ct.f.lid','Een lid (codenaam)')+'</option><option value="staff">'+T('ct.f.staff','Een personeelslid')+'</option></select></div>'+
        '<div class="field" id="ctLidVeld"><label>'+T('ct.f.code','Codenaam van het lid')+'</label><input id="ctCode" placeholder="'+T('ct.f.codeph','Bijv. Zilveren Valk 12')+'"></div>'+
        '<div class="field" id="ctStaffVeld" style="display:none;"><label>'+T('ct.f.wie','Personeelslid')+'</label><select id="ctStaff" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"></select></div>'+
        '<div class="field"><label>'+T('ct.f.titel','Titel')+'</label><input id="ctTitel" placeholder="'+T('ct.f.titelph','Bijv. Huurovereenkomst')+'"></div>'+
        '<div class="field"><label>'+T('ct.f.tekst','Voorwaarden')+'</label><textarea id="ctTekst" rows="4" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;font-family:inherit;" placeholder="'+T('ct.f.tekstph','De afspraken en voorwaarden\u2026')+'"></textarea></div>'+
        '<button class="obtn primary" id="ctMaak">'+T('ct.f.maak','Contract versturen')+'</button></div>';
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-cteken]').forEach(k => k.addEventListener('click', async () => {
      const naam = prompt(T('ct.tekenvraag','Typ uw naam om digitaal te ondertekenen:'));
      if (!naam) return;
      try { await API.call('/supplier/contract/teken', { ref: k.dataset.cteken, naam, akkoord: true }); toast(T('ct.tekenok','Ondertekend.')); await laadContracten(); openTab('contract'); } catch(e){ toast(e.message); }
    }));
    const ontvSel = document.getElementById('ctOntv');
    if (ontvSel){
      const staffSel = document.getElementById('ctStaff');
      if (staffSel) staffSel.innerHTML = (Array.isArray(state.team) ? state.team : []).map(m => '<option value="'+m.id+'">'+esc(m.name)+' ('+esc(m.func||m.role||'')+')</option>').join('');
      ontvSel.addEventListener('change', () => {
        document.getElementById('ctLidVeld').style.display = ontvSel.value === 'lid' ? '' : 'none';
        document.getElementById('ctStaffVeld').style.display = ontvSel.value === 'staff' ? '' : 'none';
      });
    }
    const maak = document.getElementById('ctMaak');
    if (maak) maak.addEventListener('click', async () => {
      const soort = $('#ctSoort').value, ontv = $('#ctOntv').value;
      const body = { soort, titel: $('#ctTitel').value, tekst: $('#ctTekst').value };
      if (ontv === 'staff') body.staffId = $('#ctStaff') ? $('#ctStaff').value : null;
      else body.codenaam = $('#ctCode').value;
      try { await API.call('/supplier/contract/maak', body); toast(T('ct.maakok','Contract verstuurd; de ontvanger tekent in de app.')); await laadContracten(); openTab('contract'); } catch(e){ toast(e.message); }
    });
  }

  // ---- boerderij: de slimme boer-backoffice (percelen, dieren, taken, AI) ----
  let boer = null;
  const FASE_LBL = { 'leeg':'leeg', 'gezaaid':'net gezaaid', 'groeit':'groeit', 'te-oogsten':'oogstklaar', 'geoogst':'geoogst' };
  const FASE_KL = { 'te-oogsten':'#7EE0A3', 'groeit':'var(--gold)', 'gezaaid':'#8FB8D8', 'geoogst':'var(--soft)', 'leeg':'var(--soft)' };
  const URG_KL = { 'hoog':'#E0736A', 'midden':'var(--gold)', 'laag':'var(--soft)' };
  async function laadBoerderij(){
    if (!has('boerderij') || !API.live) return;
    try { boer = await API.call('/supplier/boerderij/overzicht', {}); } catch(e){ boer = null; }
    renderBoerderij();
  }
  function boerToe(r){ if (r && r.overzicht){ boer = r.overzicht; } else if (r && r.percelen){ boer = r; } renderBoerderij(); }
  function renderBoerderij(){
    const el = $('#boerWrap'); if (!el) return;
    if (!has('boerderij')){ el.innerHTML = ''; return; }
    if (!boer){ el.innerHTML = '<div class="empty">…</div>'; laadBoerderij(); return; }
    const canEdit = actor().manager;
    const o = boer, st = o.stats || {}, isDier = o.kind !== 'gewas', isGewas = o.kind !== 'dier';
    const sel = 'style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;font-size:0.82rem;color:var(--txt);"';
    let html = '';
    // type + kiezer
    html += '<div class="card"><div class="tt-h">'+T('boer.type','Soort boerderij')+'</div>'+
      '<div style="margin-top:0.5rem;font-size:0.9rem;">'+(o.typeIcon||'🚜')+' <b>'+esc(o.typeLabel||T('boer.geen','nog niet gekozen'))+'</b></div>'+
      (canEdit ? '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.6rem;">'+
        o.types.map(t => '<button class="obtn'+(t.id===o.type?' primary':'')+'" data-btype="'+t.id+'">'+t.icon+' '+esc(t.label)+'</button>').join('')+'</div>' : '')+'</div>';
    // Vandaag-briefing
    const br = o.briefing || { punten:[] };
    html += '<div class="card"><div class="tt-h">🌱 '+T('boer.vandaag','Vandaag')+' · '+esc(br.seizoenLabel||'')+'</div>'+
      (br.punten.length ? br.punten.map(p => '<div class="mitem" style="border-left:3px solid '+(URG_KL[p.urgentie]||'var(--soft)')+';"><div class="ds" style="color:var(--txt);">'+esc(p.tekst)+'</div></div>').join('')
        : '<div class="ds" style="margin-top:0.5rem;">'+T('boer.rustig','Niets dringends. Mooie dag om vooruit te werken.')+'</div>')+'</div>';
    // stats
    const tiles = [[st.percelen||0, T('boer.percelen','percelen')],[ (st.hectare||0)+' ha', T('boer.opp','oppervlak')],[st.teOogsten||0, T('boer.oogstklaar','oogstklaar')],[st.dieren||0, T('boer.dieren','dieren')]];
    if (isDier){ tiles.push([st.melkPerDag||0, T('boer.melk','L melk/dag')]); tiles.push([st.eierenPerDag||0, T('boer.eieren','eieren/dag')]); tiles.push([(st.voerPerDag||0)+' kg', T('boer.voer','voer/dag')]); }
    tiles.push([st.openTaken||0, T('boer.taken','open taken')]);
    html += '<div class="card"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;">'+
      tiles.map(c => '<div style="background:var(--card2,var(--card));border:1px solid var(--line);border-radius:12px;padding:0.6rem;text-align:center;"><div style="font-size:1.15rem;font-weight:700;color:var(--gold);">'+c[0]+'</div><div style="font-size:0.6rem;color:var(--soft);text-transform:uppercase;letter-spacing:0.05em;">'+c[1]+'</div></div>').join('')+'</div></div>';
    // percelen (gewasbedrijven)
    if (isGewas){
      html += '<div class="card"><div class="tt-h">'+T('boer.perc','Percelen')+' ('+(o.percelen||[]).length+')</div>'+
        (o.percelen||[]).map(p => {
          const bar = '<div style="height:6px;border-radius:4px;background:var(--line);overflow:hidden;margin-top:0.35rem;"><div style="height:100%;width:'+(p.voortgang||0)+'%;background:'+(FASE_KL[p.fase]||'var(--gold)')+';"></div></div>';
          return '<div class="mitem"><div class="r1"><span class="nm">'+esc(p.naam)+'</span><span class="pr">'+(p.ha||0)+' ha</span></div>'+
          '<div class="ds">'+(p.gewasLabel ? esc(p.gewasLabel)+' · <span style="color:'+(FASE_KL[p.fase]||'var(--soft)')+';">'+T('boer.fase.'+p.fase, FASE_LBL[p.fase]||p.fase)+'</span>'+(p.fase==='groeit'||p.fase==='gezaaid'?' · '+(p.restDagen)+' '+T('boer.dgn','dagen tot oogst'):'')+(p.opbrengst?' · '+p.opbrengst+' '+(p.eenheid||'kg'):'') : T('boer.braak','braak, nog niet ingezaaid'))+'</div>'+
          (p.gewasLabel && p.fase!=='geoogst' ? bar : '')+
          '<div style="margin-top:0.45rem;display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">'+
            (canEdit ? '<select data-zaaisel="'+p.id+'" '+sel+'><option value="">'+T('boer.zaaikies','zaai...')+'</option>'+o.gewaskeuze.map(g=>'<option value="'+g.id+'">'+esc(g.label)+'</option>').join('')+'</select>' : '')+
            (p.gewasLabel && p.fase==='te-oogsten' ? '<button class="obtn primary" data-oogst="'+p.id+'">🌾 '+T('boer.oogsten','Oogsten')+'</button>' : '')+
            (p.gewasLabel && p.fase!=='geoogst' ? '<button class="obtn" data-water="'+p.id+'">💧 '+T('boer.water','Water')+'</button>' : '')+
            (canEdit ? '<button class="rr-del" data-percdel="'+p.id+'">✕</button>' : '')+
          '</div></div>';
        }).join('')+
        (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;"><input id="boerPcNaam" placeholder="'+T('boer.pcnaam','Naam perceel')+'" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"><input id="boerPcHa" type="number" min="0" step="0.1" placeholder="ha" style="width:5rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"><button class="obtn primary" id="boerPcAdd">+</button></div>' : '')+'</div>';
    }
    // dieren
    if (isDier){
      html += '<div class="card"><div class="tt-h">'+T('boer.dgroep','Dieren')+' ('+(o.dieren||[]).length+')</div>'+
        (o.dieren||[]).map(d => '<div class="mitem"><div class="r1"><span class="nm">'+esc(d.soortLabel)+' × '+(d.aantal||0)+'</span><span class="pr">'+(d.dagopbrengst||0)+' '+(d.eenheid||'')+'/dag</span></div>'+
          '<div class="ds">'+(d.stal?esc(d.stal)+' · ':'')+T('boer.voernodig','voer')+' '+(d.voerKgPerDag||0)+' kg/dag · '+T('boer.gezond','gezondheid')+': <span style="color:'+(d.gezondheid==='goed'?'#7EE0A3':d.gezondheid==='ziek'?'#E0736A':'var(--gold)')+';">'+esc(d.gezondheid)+'</span>'+(d.laatsteVoer?' · '+T('boer.gevoerd','gevoerd')+' '+timeAgo(d.laatsteVoer):'')+'</div>'+
          '<div style="margin-top:0.45rem;display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">'+
            '<button class="obtn primary" data-voer="'+d.id+'">🌾 '+T('boer.voeren','Voeren')+'</button>'+
            '<input type="number" min="0" data-opbin="'+d.id+'" placeholder="'+(d.eenheid||'')+'/dag" style="width:6rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.4rem 0.5rem;color:var(--txt);"><button class="obtn" data-opbset="'+d.id+'">'+T('boer.opbregistr','Opbrengst')+'</button>'+
            (canEdit ? '<select data-gezond="'+d.id+'" '+sel+'><option value="goed"'+(d.gezondheid==='goed'?' selected':'')+'>'+T('boer.g.goed','goed')+'</option><option value="aandacht"'+(d.gezondheid==='aandacht'?' selected':'')+'>'+T('boer.g.aandacht','aandacht')+'</option><option value="ziek"'+(d.gezondheid==='ziek'?' selected':'')+'>'+T('boer.g.ziek','ziek')+'</option></select><button class="rr-del" data-dierdel="'+d.id+'">✕</button>' : '')+
          '</div></div>').join('')+
        (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><select id="boerDrSoort" '+sel+'>'+o.dierkeuze.map(g=>'<option value="'+g.id+'">'+esc(g.label)+'</option>').join('')+'</select><input id="boerDrAantal" type="number" min="0" placeholder="'+T('boer.aantal','aantal')+'" style="width:6rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"><button class="obtn primary" id="boerDrAdd">+</button></div>' : '')+'</div>';
    }
    // takenbord
    html += '<div class="card"><div class="tt-h">'+T('boer.takenbord','Takenbord')+'</div>'+
      (o.taken||[]).map(t => '<div class="mitem" style="opacity:'+(t.klaar?'0.55':'1')+';"><div class="r1"><span class="nm">'+(t.klaar?'✓ ':'')+esc(t.wat)+'</span>'+(t.voor?'<span class="pr" style="color:'+(!t.klaar&&t.voor<new Date().toISOString().slice(0,10)?'#E0736A':'var(--soft)')+';">'+esc(t.voor)+'</span>':'')+'</div>'+
        (t.waar?'<div class="ds">📍 '+esc(t.waar)+(t.door?' · '+esc(t.door):'')+'</div>':'')+
        (!t.klaar ? '<div style="margin-top:0.4rem;display:flex;gap:0.4rem;"><button class="obtn primary" data-taakklaar="'+t.id+'">'+T('boer.afronden','Afronden')+'</button>'+(canEdit?'<button class="rr-del" data-taakdel="'+t.id+'">✕</button>':'')+'</div>' : '')+'</div>').join('')+
      (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><input id="boerTkWat" placeholder="'+T('boer.tkwat','Nieuwe taak')+'" style="flex:1;min-width:9rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"><input id="boerTkVoor" type="date" style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"><button class="obtn primary" id="boerTkAdd">+</button></div>' : '')+'</div>';
    // Verkoop: producten (oogst vult de voorraad) en verkopen via de Salon
    html += '<div class="card"><div class="tt-h">🛒 '+T('boer.verkoop','Verkoop via de Salon')+'</div>'+
      '<p class="sub" style="margin-top:0.2rem;">'+T('boer.verkoop.sub','Uw oogst komt hier automatisch in de voorraad. Zet een prijs en plaats het in de Salon; leden claimen en halen op.')+'</p>'+
      ((o.producten||[]).length ? (o.producten||[]).map(pr => '<div class="mitem"><div class="r1"><span class="nm">'+esc(pr.naam)+'</span><span class="pr">'+pr.voorraad+' '+esc(pr.eenheid)+'</span></div>'+
        '<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">'+
          '<span style="font-size:0.78rem;color:var(--soft);">€</span><input type="number" min="0" step="0.1" value="'+(pr.prijs||'')+'" data-prijsin="'+pr.id+'" style="width:5rem;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:0.35rem 0.5rem;color:var(--txt);"><span style="font-size:0.78rem;color:var(--soft);">/'+esc(pr.eenheid)+'</span>'+
          (canEdit?'<button class="obtn" data-prijsset="'+pr.id+'">'+T('boer.prijsopslaan','Prijs')+'</button>':'')+
          (canEdit?'<button class="obtn primary" data-naarsalon="'+pr.id+'">'+(pr.inSalon?'🔁 '+T('boer.opnieuwsalon','Opnieuw in Salon'):'✦ '+T('boer.insalon','In de Salon'))+'</button>':'')+
          (canEdit?'<button class="rr-del" data-proddel="'+pr.id+'">✕</button>':'')+
        '</div></div>').join('')
        : '<div class="ds" style="margin-top:0.5rem;">'+T('boer.geenprod','Nog geen producten. Oogst een perceel of voeg er hieronder een toe.')+'</div>')+
      (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><input id="boerPrNaam" placeholder="'+T('boer.prnaam','Product')+'" style="flex:1;min-width:7rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"><input id="boerPrEenh" placeholder="'+T('boer.preenh','kg')+'" style="width:4rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"><input id="boerPrPrijs" type="number" min="0" step="0.1" placeholder="€" style="width:5rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"><button class="obtn primary" id="boerPrAdd">+</button></div>' : '')+'</div>';
    // AI-adviseur
    if (canEdit){
      html += '<div class="card"><div class="tt-h">✨ '+T('boer.ai','AI-adviseur')+'</div>'+
        '<p class="sub" style="margin-top:0.3rem;">'+T('boer.ai.sub','Vraag advies of geef een opdracht, bijv. "zaai tomaat op Kasblok 1" of "voeg 20 melkkoeien toe".')+'</p>'+
        '<div id="boerAiOut" style="margin-top:0.5rem;"></div>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="boerAiIn" placeholder="'+T('boer.ai.ph','Uw vraag of opdracht...')+'" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.7rem;color:var(--txt);"><button class="obtn primary" id="boerAiGo">'+T('boer.ai.go','Vraag')+'</button></div></div>';
    }
    el.innerHTML = html;
    // wiring
    el.querySelectorAll('[data-btype]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/type', { type: b.dataset.btype })); toast(T('boer.typeok','Boerderijtype ingesteld.')); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-zaaisel]').forEach(s2 => s2.addEventListener('change', async () => { if (!s2.value) return; try { const r = await API.call('/supplier/boerderij/zaai', { id: s2.dataset.zaaisel, gewas: s2.value }); toast(T('boer.zaaiok','Gezaaid. Oogst verwacht rond ')+r.oogstVerwacht); boerToe(r); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-oogst]').forEach(b => b.addEventListener('click', async () => { try { const r = await API.call('/supplier/boerderij/oogst', { id: b.dataset.oogst }); toast(T('boer.oogstok','Geoogst: ')+r.opbrengst+' '+r.eenheid); boerToe(r); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-water]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/water', { id: b.dataset.water })); toast(T('boer.waterok','Beregend.')); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-percdel]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/perceel', { weg: true, id: b.dataset.percdel })); } catch(e){ toast(e.message); } }));
    const pcAdd = $('#boerPcAdd'); if (pcAdd) pcAdd.addEventListener('click', async () => { const naam = $('#boerPcNaam').value.trim(); if (!naam) return; try { boerToe(await API.call('/supplier/boerderij/perceel', { naam, ha: Number($('#boerPcHa').value)||0 })); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-voer]').forEach(b => b.addEventListener('click', async () => { try { const r = await API.call('/supplier/boerderij/voer', { id: b.dataset.voer }); toast(T('boer.voerok','Gevoerd ')+'('+r.voerKg+' kg).'); boerToe(r); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-opbset]').forEach(b => b.addEventListener('click', async () => { const inp = el.querySelector('[data-opbin="'+b.dataset.opbset+'"]'); const v = inp?Number(inp.value):0; try { boerToe(await API.call('/supplier/boerderij/opbrengst', { id: b.dataset.opbset, waarde: v })); toast(T('boer.opbok','Opbrengst vastgelegd.')); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-gezond]').forEach(s2 => s2.addEventListener('change', async () => { try { boerToe(await API.call('/supplier/boerderij/dier', { id: s2.dataset.gezond, gezondheid: s2.value })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-dierdel]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/dier', { weg: true, id: b.dataset.dierdel })); } catch(e){ toast(e.message); } }));
    const drAdd = $('#boerDrAdd'); if (drAdd) drAdd.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/dier', { soort: $('#boerDrSoort').value, aantal: Number($('#boerDrAantal').value)||0 })); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-taakklaar]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/taak/klaar', { id: b.dataset.taakklaar })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-taakdel]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/taak', { weg: true, id: b.dataset.taakdel })); } catch(e){ toast(e.message); } }));
    const tkAdd = $('#boerTkAdd'); if (tkAdd) tkAdd.addEventListener('click', async () => { const wat = $('#boerTkWat').value.trim(); if (!wat) return; try { boerToe(await API.call('/supplier/boerderij/taak', { wat, voor: $('#boerTkVoor').value })); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-prijsset]').forEach(b => b.addEventListener('click', async () => { const inp = el.querySelector('[data-prijsin="'+b.dataset.prijsset+'"]'); try { boerToe(await API.call('/supplier/boerderij/product', { id: b.dataset.prijsset, prijs: inp?Number(inp.value):0 })); toast(T('boer.prijsok','Prijs opgeslagen.')); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-naarsalon]').forEach(b => b.addEventListener('click', async () => { try { const r = await API.call('/supplier/boerderij/naar-salon', { id: b.dataset.naarsalon }); toast(T('boer.salonok','In de Salon gezet; leden zien het nu.')); boerToe(r); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-proddel]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/product', { weg: true, id: b.dataset.proddel })); } catch(e){ toast(e.message); } }));
    const prAdd = $('#boerPrAdd'); if (prAdd) prAdd.addEventListener('click', async () => { const naam = $('#boerPrNaam').value.trim(); if (!naam) return; try { boerToe(await API.call('/supplier/boerderij/product', { naam, eenheid: $('#boerPrEenh').value.trim()||'kg', prijs: Number($('#boerPrPrijs').value)||0 })); } catch(e){ toast(e.message); } });
    const aiGo = $('#boerAiGo'); if (aiGo){
      const doeAi = async () => { const vraag = $('#boerAiIn').value.trim(); if (!vraag) return; const out = $('#boerAiOut'); out.innerHTML = '<div class="ds">'+T('boer.aidenkt','Even denken...')+'</div>';
        try { const r = await API.call('/supplier/boerderij/ai', { vraag }); out.innerHTML = '<div class="mitem"'+(r.gedaan?' style="border-left:3px solid #7EE0A3;"':'')+'><div class="ds" style="color:var(--txt);white-space:pre-wrap;">'+esc(r.antwoord)+'</div></div>'; $('#boerAiIn').value=''; if (r.overzicht){ boer = r.overzicht; } if (r.gedaan) renderBoerderij(); }
        catch(e){ out.innerHTML = '<div class="ds" style="color:#E0736A;">'+esc(e.message)+'</div>'; } };
      aiGo.addEventListener('click', doeAi);
      const aiIn = $('#boerAiIn'); if (aiIn) aiIn.addEventListener('keydown', e => { if (e.key==='Enter') doeAi(); });
    }
  }

  // ---- content creator: de carriere-backoffice ----
  let cr = null;
  const IDEE_KL = { 'idee':'var(--soft)', 'productie':'var(--gold)', 'gepost':'#7EE0A3' };
  const PLAT_ICO = { instagram:'📸', tiktok:'🎵', youtube:'▶️', x:'𝕏', twitch:'🎮', podcast:'🎙️', blog:'✍️' };
  async function laadCreator(){
    if (!has('creator') || !API.live) return;
    try { cr = await API.call('/supplier/creator/overzicht', {}); } catch(e){ cr = null; }
    renderCreator();
  }
  function crToe(r){ if (r && r.overzicht) cr = r.overzicht; else if (r && r.stats) cr = r; renderCreator(); }
  function renderCreator(){
    const el = $('#creatorWrap'); if (!el) return;
    if (!has('creator')){ el.innerHTML = ''; return; }
    if (!cr){ el.innerHTML = '<div class="empty">…</div>'; laadCreator(); return; }
    const canEdit = actor().manager, o = cr, st = o.stats || {};
    const inp = 'style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"';
    const kort = n => n >= 1000 ? (Math.round(n/100)/10)+'K' : String(n);
    let html = '';
    // profiel
    html += '<div class="card"><div class="tt-h">🎬 '+T('cr.profiel','Profiel')+'</div>'+
      (canEdit ? '<div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem;"><input id="crNiche" placeholder="'+T('cr.niche','Niche (bijv. Reizen & lifestyle)')+'" value="'+escAttr(o.niche||'')+'" '+inp+'><textarea id="crBio" placeholder="'+T('cr.bio','Korte bio')+'" '+inp+' rows="2">'+esc(o.bio||'')+'</textarea><button class="obtn primary" id="crProfielOp" style="align-self:flex-start;">'+T('cr.opslaan','Opslaan')+'</button></div>'
        : '<div style="margin-top:0.4rem;"><b>'+esc(o.niche||'')+'</b><div class="ds">'+esc(o.bio||'')+'</div></div>')+'</div>';
    // stats
    const tiles = [[kort(st.bereik||0), T('cr.bereik','totaal bereik')],[st.platforms||0, T('cr.platforms','platforms')],[st.teProduceren||0, T('cr.productie','in productie')],[st.gepost||0, T('cr.gepost','gepost')],['€ '+(st.gemTarief||0), T('cr.gemtarief','gem. tarief')],[st.portfolio||0, T('cr.portfolio','portfolio')]];
    html += '<div class="card"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;">'+
      tiles.map(c => '<div style="background:var(--card2,var(--card));border:1px solid var(--line);border-radius:12px;padding:0.6rem;text-align:center;"><div style="font-size:1.1rem;font-weight:700;color:var(--gold);">'+c[0]+'</div><div style="font-size:0.6rem;color:var(--soft);text-transform:uppercase;letter-spacing:0.05em;">'+c[1]+'</div></div>').join('')+'</div></div>';
    // platforms
    html += '<div class="card"><div class="tt-h">'+T('cr.platf','Platforms & bereik')+'</div>'+
      (o.platforms||[]).map(p => '<div class="mitem"><div class="r1"><span class="nm">'+(PLAT_ICO[p.platform]||'🔗')+' '+esc(p.handle||p.platform)+'</span><span class="pr">'+kort(p.volgers||0)+'</span></div>'+
        (canEdit?'<div style="margin-top:0.35rem;display:flex;gap:0.4rem;"><input type="number" min="0" data-pfvin="'+p.id+'" value="'+(p.volgers||0)+'" style="width:7rem;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:0.3rem 0.5rem;color:var(--txt);"><button class="obtn" data-pfvset="'+p.id+'">'+T('cr.volgersop','Bereik')+'</button><button class="rr-del" data-pfdel="'+p.id+'">✕</button></div>':'')+'</div>').join('')+
      (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><select id="crPfPlat" style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;color:var(--txt);">'+o.platformkeuze.map(p=>'<option value="'+p+'">'+(PLAT_ICO[p]||'')+' '+p+'</option>').join('')+'</select><input id="crPfHandle" placeholder="@handle" '+inp+' style="flex:1;min-width:7rem;"><input id="crPfVolg" type="number" min="0" placeholder="'+T('cr.volgers','volgers')+'" style="width:6rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;color:var(--txt);"><button class="obtn primary" id="crPfAdd">+</button></div>' : '')+'</div>';
    // tarieven
    html += '<div class="card"><div class="tt-h">'+T('cr.tarieven','Tarieven')+'</div>'+
      (o.tarieven||[]).map(t => '<div class="mitem"><div class="r1"><span class="nm">'+esc(t.soort)+'</span><span class="pr">€ '+(t.prijs||0)+(canEdit?' <button class="rr-del" data-trdel="'+t.id+'">✕</button>':'')+'</span></div></div>').join('')+
      (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><select id="crTrSoort" style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;color:var(--txt);">'+o.soortkeuze.map(x=>'<option value="'+x+'">'+x+'</option>').join('')+'</select><input id="crTrPrijs" type="number" min="0" placeholder="€" style="width:6rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;color:var(--txt);"><button class="obtn primary" id="crTrAdd">+</button></div>' : '')+'</div>';
    // content-kalender
    html += '<div class="card"><div class="tt-h">📅 '+T('cr.kalender','Content-kalender')+'</div>'+
      (o.ideeen||[]).map(i => '<div class="mitem" style="border-left:3px solid '+(IDEE_KL[i.status]||'var(--soft)')+';"><div class="r1"><span class="nm">'+esc(i.tekst)+'</span>'+(i.voor?'<span class="pr" style="color:var(--soft);">'+esc(i.voor)+'</span>':'')+'</div>'+
        '<div class="ds">'+T('cr.status.'+i.status, i.status)+(i.script?' · 📝 '+T('cr.heeftscript','script klaar'):'')+'</div>'+
        (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;">'+
          (i.status!=='productie'?'<button class="obtn" data-ideest="'+i.id+'" data-st="productie">▶ '+T('cr.naarprod','In productie')+'</button>':'')+
          (i.status!=='gepost'?'<button class="obtn primary" data-ideest="'+i.id+'" data-st="gepost">✓ '+T('cr.naargepost','Gepost')+'</button>':'')+
          (i.script?'<button class="obtn" data-ideescript="'+i.id+'">📝 '+T('cr.bekijkscript','Script')+'</button>':'')+
          '<button class="rr-del" data-ideedel="'+i.id+'">✕</button></div>':'')+
        '<div class="crScript" data-scriptbox="'+i.id+'" style="display:none;white-space:pre-wrap;font-size:0.8rem;color:var(--soft);margin-top:0.4rem;border-top:1px solid var(--line);padding-top:0.4rem;">'+esc(i.script||'')+'</div></div>').join('')+
      (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><input id="crIdTekst" placeholder="'+T('cr.nieuwidee','Nieuw idee')+'" '+inp+' style="flex:1;min-width:9rem;"><input id="crIdVoor" type="date" '+inp+'><button class="obtn primary" id="crIdAdd">+</button></div>' : '')+'</div>';
    // AI content-helper
    if (canEdit){
      html += '<div class="card"><div class="tt-h">✨ '+T('cr.ai','AI content-helper')+'</div>'+
        '<p class="sub" style="margin-top:0.3rem;">'+T('cr.ai.sub','Vraag om ideeen of een kant-en-klaar script, bijv. "schrijf een script voor een reel over een strandclub" of "voeg idee ... toe aan de kalender".')+'</p>'+
        '<div id="crAiOut" style="margin-top:0.5rem;"></div>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="crAiIn" placeholder="'+T('cr.ai.ph','Vraag of opdracht...')+'" '+inp+' style="flex:1;"><button class="obtn primary" id="crAiGo">'+T('cr.ai.go','Vraag')+'</button></div></div>';
    }
    el.innerHTML = html;
    // wiring
    const pOp = $('#crProfielOp'); if (pOp) pOp.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/profiel', { niche: $('#crNiche').value, bio: $('#crBio').value })); toast(T('cr.profielok','Profiel opgeslagen.')); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-pfvset]').forEach(b => b.addEventListener('click', async () => { const i2 = el.querySelector('[data-pfvin="'+b.dataset.pfvset+'"]'); try { crToe(await API.call('/supplier/creator/platform', { id: b.dataset.pfvset, volgers: i2?Number(i2.value):0 })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-pfdel]').forEach(b => b.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/platform', { weg: true, id: b.dataset.pfdel })); } catch(e){ toast(e.message); } }));
    const pfAdd = $('#crPfAdd'); if (pfAdd) pfAdd.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/platform', { platform: $('#crPfPlat').value, handle: $('#crPfHandle').value, volgers: Number($('#crPfVolg').value)||0 })); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-trdel]').forEach(b => b.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/tarief', { weg: true, id: b.dataset.trdel })); } catch(e){ toast(e.message); } }));
    const trAdd = $('#crTrAdd'); if (trAdd) trAdd.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/tarief', { soort: $('#crTrSoort').value, prijs: Number($('#crTrPrijs').value)||0 })); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-ideest]').forEach(b => b.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/idee', { id: b.dataset.ideest, status: b.dataset.st })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-ideedel]').forEach(b => b.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/idee', { weg: true, id: b.dataset.ideedel })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-ideescript]').forEach(b => b.addEventListener('click', () => { const box = el.querySelector('[data-scriptbox="'+b.dataset.ideescript+'"]'); if (box) box.style.display = box.style.display==='none'?'block':'none'; }));
    const idAdd = $('#crIdAdd'); if (idAdd) idAdd.addEventListener('click', async () => { const tekst = $('#crIdTekst').value.trim(); if (!tekst) return; try { crToe(await API.call('/supplier/creator/idee', { tekst, voor: $('#crIdVoor').value })); } catch(e){ toast(e.message); } });
    const aiGo = $('#crAiGo'); if (aiGo){
      const doe = async () => { const opdracht = $('#crAiIn').value.trim(); if (!opdracht) return; const out = $('#crAiOut'); out.innerHTML = '<div class="ds">'+T('cr.aidenkt','Even denken...')+'</div>';
        try { const r = await API.call('/supplier/creator/ai', { opdracht }); out.innerHTML = '<div class="mitem"'+(r.gedaan?' style="border-left:3px solid #7EE0A3;"':'')+'><div class="ds" style="color:var(--txt);white-space:pre-wrap;">'+esc(r.antwoord)+'</div></div>'; $('#crAiIn').value=''; if (r.overzicht){ cr = r.overzicht; } if (r.gedaan) renderCreator(); }
        catch(e){ out.innerHTML = '<div class="ds" style="color:#E0736A;">'+esc(e.message)+'</div>'; } };
      aiGo.addEventListener('click', doe);
      const aiIn = $('#crAiIn'); if (aiIn) aiIn.addEventListener('keydown', e => { if (e.key==='Enter') doe(); });
    }
  }

  // ---- samenwerken: creators <-> leveranciers, met EGn knop ----
  let sw = null, swLijst = null;
  const kortN = n => n >= 1000 ? (Math.round(n/100)/10)+'K' : String(n);
  async function laadSamenwerking(){
    if (!API.live) return;
    try { sw = await API.call('/supplier/samenwerking/mijn', {}); } catch(e){ sw = null; }
    try { swLijst = sw && sw.isCreator ? { leveranciers: (await API.call('/supplier/samenwerking/leveranciers', {})).leveranciers } : { creators: (await API.call('/supplier/samenwerking/creators', {})).creators }; } catch(e){ swLijst = {}; }
    renderSamenwerking();
  }
  function renderSamenwerking(){
    const el = $('#swWrap'); if (!el) return;
    if (!sw){ el.innerHTML = '<div class="empty">…</div>'; laadSamenwerking(); return; }
    const canEdit = actor().manager, mk = sw.isCreator;
    const st = 'style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"';
    const kaartAnder = a => a.niche != null || a.bereik != null
      ? '🎬 <b>'+esc(a.name)+'</b>'+(a.niche?' · '+esc(a.niche):'')+(a.bereik?' · '+kortN(a.bereik)+' '+T('sw.bereik','bereik'):'')
      : (a.icon||'🏷️')+' <b>'+esc(a.name)+'</b>'+(a.typeLabel?' · '+esc(a.typeLabel):'');
    const statusKl = { 'voorgesteld':'var(--gold)', 'geaccepteerd':'#7EE0A3', 'afgewezen':'#E0736A' };
    let html = '';
    // lopende samenwerkingen (in + uit)
    const inl = (sw.voorstellen&&sw.voorstellen.in)||[], uitl = (sw.voorstellen&&sw.voorstellen.uit)||[];
    html += '<div class="card"><div class="tt-h">🤝 '+T('sw.mijn','Mijn samenwerkingen')+'</div>'+
      (inl.length||uitl.length ? [].concat(inl,uitl).map(x => '<div class="mitem" style="border-left:3px solid '+(statusKl[x.status]||'var(--soft)')+';"><div class="r1"><span class="nm">'+kaartAnder(x.ander)+'</span><span class="pr" style="color:'+(statusKl[x.status]||'var(--soft)')+';">'+T('sw.st.'+x.status, x.status)+'</span></div>'+
        (x.bericht?'<div class="ds">'+esc(x.bericht)+(x.budget?' · € '+x.budget:'')+(x.soort?' · '+esc(x.soort):'')+'</div>':'')+
        (x.richting==='in'&&x.status==='voorgesteld'&&canEdit ? '<div style="margin-top:0.4rem;display:flex;gap:0.4rem;"><button class="obtn primary" data-swja="'+x.id+'">'+T('sw.accept','Accepteren')+'</button><button class="obtn" data-swnee="'+x.id+'">'+T('sw.afwijs','Afwijzen')+'</button></div>' : '')+
        '</div>').join('')
        : '<div class="ds" style="margin-top:0.5rem;">'+T('sw.geen','Nog geen samenwerkingen. Start er hieronder een.')+'</div>')+'</div>';

    if (mk){
      // CREATOR: leveranciers vinden + open oproepen
      html += '<div class="card"><div class="tt-h">'+T('sw.vind','Vind een leverancier om mee samen te werken')+'</div>'+
        ((swLijst&&swLijst.leveranciers)||[]).slice(0,40).map(l => '<div class="mitem"><div class="r1"><span class="nm">'+(l.icon||'🏷️')+' '+esc(l.name)+'</span><span class="pr" style="font-size:0.72rem;color:var(--soft);">'+esc(l.typeLabel||'')+'</span></div>'+
          (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;"><input placeholder="'+T('sw.pitch','Korte pitch...')+'" data-swpitch="'+l.code+'" '+st+' style="flex:1;min-width:8rem;"><button class="obtn primary" data-swvoorstel="'+l.code+'">🤝 '+T('sw.werksamen','Werk samen')+'</button></div>':'')+'</div>').join('')+'</div>';
      const oproepen = (sw.openOproepen||[]).filter(op => !op.ikReageerde);
      html += '<div class="card"><div class="tt-h">📣 '+T('sw.oproepen','Open oproepen van leveranciers')+' ('+oproepen.length+')</div>'+
        (oproepen.length ? oproepen.map(op => '<div class="mitem"><div class="r1"><span class="nm">'+esc(op.titel)+'</span><span class="pr">'+(op.budget?'€ '+op.budget:'')+'</span></div>'+
          '<div class="ds">'+(op.van?esc(op.van.name)+' · ':'')+esc(op.omschrijving||'')+(op.soort?' · '+esc(op.soort):'')+'</div>'+
          (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;"><input placeholder="'+T('sw.reactie','Jouw reactie...')+'" data-swreactie="'+op.id+'" '+st+' style="flex:1;min-width:8rem;"><button class="obtn primary" data-swreageer="'+op.id+'">'+T('sw.reageer','Reageer')+'</button></div>':'')+'</div>').join('')
          : '<div class="ds" style="margin-top:0.5rem;">'+T('sw.geenoproep','Nu geen open oproepen.')+'</div>')+'</div>';
    } else {
      // LEVERANCIER: creators oproepen + reacties + creators direct benaderen
      if (canEdit) html += '<div class="card"><div class="tt-h">📣 '+T('sw.roepop','Roep content creators op')+'</div>'+
        '<div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem;"><input id="swOpTitel" placeholder="'+T('sw.optitel','Titel (bijv. Zomercampagne)')+'" '+st+'><input id="swOpOms" placeholder="'+T('sw.opoms','Wat zoek je?')+'" '+st+'><div style="display:flex;gap:0.4rem;"><select id="swOpSoort" '+st+'>'+['reel','post','video','campagne','review','story'].map(x=>'<option value="'+x+'">'+x+'</option>').join('')+'</select><input id="swOpBudget" type="number" min="0" placeholder="'+T('sw.budget','budget €')+'" style="width:7rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;color:var(--txt);"><button class="obtn primary" id="swOpPlaats">'+T('sw.plaats','Plaats oproep')+'</button></div></div></div>';
      // mijn oproepen met reacties
      (sw.mijnOproepen||[]).forEach(op => {
        html += '<div class="card"><div class="tt-h">'+esc(op.titel)+' '+(op.open?'<span style="font-size:0.68rem;color:#7EE0A3;">'+T('sw.open','open')+'</span>':'<span style="font-size:0.68rem;color:var(--soft);">'+T('sw.dicht','gesloten')+'</span>')+'</div>'+
          '<div class="ds" style="margin-bottom:0.4rem;">'+esc(op.omschrijving||'')+(op.budget?' · € '+op.budget:'')+'</div>'+
          ((op.reacties||[]).length ? (op.reacties||[]).map(r => '<div class="mitem"><div class="r1"><span class="nm">🎬 '+esc(r.creator.name)+(r.creator.bereik?' · '+kortN(r.creator.bereik):'')+'</span>'+(r.status==='gekozen'?'<span class="pr" style="color:#7EE0A3;">'+T('sw.gekozen','gekozen')+'</span>':'')+'</div>'+
            (r.bericht?'<div class="ds">'+esc(r.bericht)+'</div>':'')+
            (canEdit&&r.status!=='gekozen'&&op.open?'<div style="margin-top:0.35rem;"><button class="obtn primary" data-swkies="'+op.id+'" data-creator="'+r.creatorCode+'">'+T('sw.kiesdeze','Kies deze creator')+'</button></div>':'')+'</div>').join('')
            : '<div class="ds">'+T('sw.geenreacties','Nog geen reacties.')+'</div>')+
          (canEdit&&op.open?'<button class="obtn" data-swsluit="'+op.id+'" style="margin-top:0.5rem;">'+T('sw.sluit','Oproep sluiten')+'</button>':'')+'</div>';
      });
      // creators direct benaderen
      html += '<div class="card"><div class="tt-h">🎬 '+T('sw.vindcreator','Benader een creator direct')+'</div>'+
        ((swLijst&&swLijst.creators)||[]).slice(0,40).map(c => '<div class="mitem"><div class="r1"><span class="nm">'+esc(c.name)+(c.niche?' · '+esc(c.niche):'')+'</span><span class="pr">'+kortN(c.bereik||0)+'</span></div>'+
          (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;"><input placeholder="'+T('sw.pitch','Korte pitch...')+'" data-swpitch="'+c.code+'" '+st+' style="flex:1;min-width:8rem;"><button class="obtn primary" data-swvoorstel="'+c.code+'">🤝 '+T('sw.werksamen','Werk samen')+'</button></div>':'')+'</div>').join('')+'</div>';
    }
    el.innerHTML = html;
    // wiring
    el.querySelectorAll('[data-swja]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/samenwerking/beslis', { id: b.dataset.swja, actie: 'accepteren' }); toast(T('sw.geaccept','Samenwerking geaccepteerd.')); laadSamenwerking(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-swnee]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/samenwerking/beslis', { id: b.dataset.swnee, actie: 'afwijzen' }); laadSamenwerking(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-swvoorstel]').forEach(b => b.addEventListener('click', async () => { const pi = el.querySelector('[data-swpitch="'+b.dataset.swvoorstel+'"]'); try { await API.call('/supplier/samenwerking/voorstel', { naarCode: b.dataset.swvoorstel, bericht: pi?pi.value:'' }); toast(T('sw.verstuurd','Voorstel verstuurd.')); laadSamenwerking(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-swreageer]').forEach(b => b.addEventListener('click', async () => { const ri = el.querySelector('[data-swreactie="'+b.dataset.swreageer+'"]'); try { await API.call('/supplier/samenwerking/reageer', { oproepId: b.dataset.swreageer, bericht: ri?ri.value:'' }); toast(T('sw.gereageerd','Reactie verstuurd.')); laadSamenwerking(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-swkies]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/samenwerking/kies', { oproepId: b.dataset.swkies, creatorCode: b.dataset.creator }); toast(T('sw.gekozenok','Creator gekozen; samenwerking staat vast.')); laadSamenwerking(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-swsluit]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/samenwerking/oproep/sluit', { id: b.dataset.swsluit }); laadSamenwerking(); } catch(e){ toast(e.message); } }));
    const opP = $('#swOpPlaats'); if (opP) opP.addEventListener('click', async () => { const titel = $('#swOpTitel').value.trim(); if (!titel) return; try { await API.call('/supplier/samenwerking/oproep', { titel, omschrijving: $('#swOpOms').value, soort: $('#swOpSoort').value, budget: Number($('#swOpBudget').value)||0 }); toast(T('sw.oproepok','Oproep geplaatst; creators zien het.')); laadSamenwerking(); } catch(e){ toast(e.message); } });
  }

  // ---- facturen: automatisch bij elke verkoop, plus de AI-factuurtool ----
  let fact = null, factAiAntwoord = '';   // het laatste AI-antwoord blijft staan over herbouw heen
  async function laadFacturen(){
    if (!API.live) return;
    try { fact = await API.call('/supplier/facturen/mijn', {}); } catch(e){ fact = { verkocht:[], gekocht:[], stats:{} }; }
    renderFacturen();
  }
  function factRij(f, kant){
    return '<div class="mitem"><div class="r1"><span class="nm">'+esc(f.nummer)+' · '+esc(kant==='in'?f.verkoper:f.koper)+'</span><span class="pr">'+geld(f.totaal)+'</span></div>'+
      '<div class="ds">'+esc(f.datum)+' · '+T('fact.soort.'+f.soort, f.soort)+' · '+T('fact.btw','btw')+' '+geld(f.btwBedrag)+(f.methode?' · '+esc(f.methode):'')+'</div>'+
      '<div style="margin-top:0.35rem;"><button class="obtn" data-factpdf="'+f.id+'" data-nr="'+escAttr(f.nummer)+'">⬇ PDF</button></div></div>';
  }
  function renderFacturen(){
    const el = $('#factWrap'); if (!el) return;
    if (!fact){ el.innerHTML = '<div class="empty">…</div>'; laadFacturen(); return; }
    const canEdit = actor().manager, st = fact.stats || {};
    let html = '';
    html += '<div class="card"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;">'+
      [[st.verkocht||0, T('fact.verkocht','verkoopfacturen')],[geld(st.omzet||0), T('fact.omzet','omzet')],[geld(st.btwAfdracht||0), T('fact.btwaf','btw')]]
      .map(c => '<div style="background:var(--card2,var(--card));border:1px solid var(--line);border-radius:12px;padding:0.6rem;text-align:center;"><div style="font-size:1.05rem;font-weight:700;color:var(--gold);">'+c[0]+'</div><div style="font-size:0.6rem;color:var(--soft);text-transform:uppercase;letter-spacing:0.05em;">'+c[1]+'</div></div>').join('')+'</div></div>';
    if (canEdit){
      html += '<div class="card"><div class="tt-h">✨ '+T('fact.ai','AI-factuurtool')+'</div>'+
        '<p class="sub" style="margin-top:0.3rem;">'+T('fact.ai.sub','Vraag iets, of maak een factuur in gewone taal: "maak een factuur voor [codenaam], 3 uur advies a 90 euro".')+'</p>'+
        '<div id="factAiOut" style="margin-top:0.5rem;"></div>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="factAiIn" placeholder="'+T('fact.ai.ph','Vraag of opdracht...')+'" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.7rem;color:var(--txt);"><button class="obtn primary" id="factAiGo">'+T('fact.ai.go','Vraag')+'</button></div></div>';
    }
    html += '<div class="card"><div class="tt-h">'+T('fact.uit','Verstuurde facturen')+' ('+(fact.verkocht||[]).length+')</div>'+
      ((fact.verkocht||[]).length ? (fact.verkocht||[]).slice(0,60).map(f => factRij(f,'uit')).join('') : '<div class="ds" style="margin-top:0.5rem;">'+T('fact.geenuit','Nog geen facturen. Bij elke kassaverkoop komt hier automatisch een factuur.')+'</div>')+'</div>';
    if ((fact.gekocht||[]).length) html += '<div class="card"><div class="tt-h">'+T('fact.in','Ontvangen facturen')+' ('+fact.gekocht.length+')</div>'+
      fact.gekocht.slice(0,60).map(f => factRij(f,'in')).join('')+'</div>';
    el.innerHTML = html;
    // het laatste AI-antwoord terugzetten, zodat een tussentijdse herbouw (bijv.
    // door de sync-SSE van de nieuwe factuur) het niet wegveegt
    const outHerstel = $('#factAiOut'); if (outHerstel && factAiAntwoord) outHerstel.innerHTML = factAiAntwoord;
    el.querySelectorAll('[data-factpdf]').forEach(b => b.addEventListener('click', () => dlBestand('/supplier/facturen/pdf', { id: b.dataset.factpdf }, (b.dataset.nr||'factuur')+'.pdf')));
    const aiGo = $('#factAiGo'); if (aiGo){
      const doe = async () => { const opdracht = $('#factAiIn').value.trim(); if (!opdracht) return; factAiAntwoord = '<div class="ds">…</div>'; const out = $('#factAiOut'); out.innerHTML = factAiAntwoord;
        try { const r = await API.call('/supplier/facturen/ai', { opdracht });
          factAiAntwoord = '<div class="mitem"'+(r.gedaan?' style="border-left:3px solid #7EE0A3;"':'')+'><div class="ds" style="color:var(--txt);white-space:pre-wrap;">'+esc(r.antwoord)+'</div></div>';
          if (r.overzicht){ fact = r.overzicht; }
          renderFacturen(); }
        catch(e){ factAiAntwoord = '<div class="ds" style="color:#E0736A;">'+esc(e.message)+'</div>'; const o2 = $('#factAiOut'); if (o2) o2.innerHTML = factAiAntwoord; } };
      aiGo.addEventListener('click', doe);
      const i2 = $('#factAiIn'); if (i2) i2.addEventListener('keydown', e => { if (e.key==='Enter') doe(); });
    }
  }

  // ---- De Salon: de zaak verkoopt (optioneel) op de gezinsmarktplaats ----
  let rtfmData = null, rtfmCats = [], rtfmStaatVar = 'gebruikt', rtfmBusy = false;
  async function laadRtfm(){
    if (rtfmBusy) return; rtfmBusy = true;
    try { rtfmData = await API.call('/supplier/markt/mijn', {}); if (rtfmData.categorieen) rtfmCats = rtfmData.categorieen; }
    catch(e){ rtfmData = { ads: [], postvak: [] }; }
    rtfmBusy = false; renderRtfMarkt();
  }
  function rtfmCatNaam(c){ return ({kleding:'Kleding',kids:'Kids & baby',wonen:'Wonen',elektronica:'Elektronica','vrije-tijd':'Vrije tijd',tuin:'Tuin',vervoer:'Vervoer',boeken:'Boeken',sport:'Sport',overig:'Overig'}[c])||c; }
  function renderRtfMarkt(){
    const el = $('#mktWrap'); if (!el) return;
    if (!rtfmData){ el.innerHTML = '<div class="empty">…</div>'; laadRtfm(); return; }
    const canEdit = actor().manager;
    let html = '';
    if (canEdit){
      html += '<div class="card"><div class="tt-h">➕ '+T('mkt.plaats','Plaats een advertentie')+'</div>'+
        '<input id="mktTitel" placeholder="'+T('mkt.titel','Titel, bijv. Etalagepop tweedehands')+'" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.7rem;color:var(--txt);margin-top:0.5rem;">'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.4rem;flex-wrap:wrap;">'+
          '<select id="mktCat" style="flex:1;min-width:8rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.6rem;color:var(--txt);">'+rtfmCats.map(c=>'<option value="'+c+'">'+rtfmCatNaam(c)+'</option>').join('')+'</select>'+
          '<select id="mktStaat" style="flex:1;min-width:8rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.6rem;color:var(--txt);"><option value="gebruikt">Gebruikt</option><option value="zgan">Zo goed als nieuw</option><option value="nieuw">Nieuw</option></select>'+
          '<input id="mktPrijs" type="number" inputmode="numeric" placeholder="€" style="width:5.5rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.6rem;color:var(--txt);">'+
        '</div>'+
        '<textarea id="mktOms" placeholder="'+T('mkt.oms','Omschrijving')+'" style="width:100%;min-height:4rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.7rem;color:var(--txt);margin-top:0.4rem;"></textarea>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.4rem;flex-wrap:wrap;">'+
          '<input id="mktPlaats" placeholder="'+T('mkt.plaatsnaam','Plaats')+'" style="flex:1;min-width:6rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.6rem;color:var(--txt);">'+
          '<button class="obtn" id="mktAiOms">✨ '+T('mkt.aioms','AI-omschrijving')+'</button>'+
          '<button class="obtn" id="mktAiPrijs">✨ '+T('mkt.aiprijs','AI-prijs')+'</button>'+
        '</div>'+
        '<div id="mktAiUit" class="sub" style="margin-top:0.35rem;color:var(--gold);"></div>'+
        '<label style="display:flex;gap:0.5rem;align-items:flex-start;font-size:0.8rem;color:var(--soft);margin:0.6rem 0;"><input type="checkbox" id="mktAkkoord" style="margin-top:0.2rem;"><span>'+T('mkt.akkoord','Ik bied alleen toegestane waar aan en houd het netjes en respectvol.')+'</span></label>'+
        '<button class="obtn primary" id="mktPlaatsBtn" style="width:100%;">'+T('mkt.plaatsbtn','Zet in De Salon')+'</button>'+
        '<div id="mktMelding" class="sub" style="margin-top:0.4rem;"></div></div>';
    }
    const ads = rtfmData.ads || [];
    html += '<div class="card"><div class="tt-h">'+T('mkt.mijn','Mijn advertenties')+' ('+ads.length+')</div>'+
      (ads.length ? ads.map(a =>
        '<div class="mitem" style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;"><div><b>'+esc(a.titel)+'</b><div class="ds">'+(a.prijs>0?'€ '+a.prijs:'Gratis')+' · '+a.status+(a.meldingen?' · '+a.meldingen+' melding(en)':'')+'</div></div>'+
        '<div style="display:flex;gap:0.3rem;">'+(canEdit?(a.status!=='verkocht'?'<button class="obtn" data-mktverk="'+a.id+'">'+T('mkt.verkocht','Verkocht')+'</button>':'<button class="obtn" data-mktheropen="'+a.id+'">'+T('mkt.heropen','Te koop')+'</button>')+'<button class="obtn warn" data-mktdel="'+a.id+'">'+T('mkt.del','Verwijder')+'</button>':'')+'</div></div>'
      ).join('') : '<div class="ds" style="margin-top:0.5rem;">'+T('mkt.geen','Nog niets geplaatst. Zet uw eerste advertentie hierboven.')+'</div>')+'</div>';
    const pv = rtfmData.postvak || [];
    if (pv.length) html += '<div class="card"><div class="tt-h">'+T('mkt.berichten','Berichten')+' ('+pv.length+')</div>'+
      pv.map(c => '<div class="mitem"><b>'+esc(c.adTitel)+'</b><div class="ds">'+esc(c.metNaam)+': '+esc(c.laatste)+'</div></div>').join('')+'</div>';
    el.innerHTML = html;
    const uit = $('#mktAiUit');
    const aiOms = $('#mktAiOms'); if (aiOms) aiOms.addEventListener('click', async () => {
      const titel = $('#mktTitel').value.trim(); if (!titel){ uit.textContent = T('mkt.eerst','Vul eerst een titel in.'); return; }
      try { const r = await API.call('/supplier/markt/ai', { soort:'beschrijving', titel, beschrijving:$('#mktOms').value.trim(), categorie:$('#mktCat').value, staat:$('#mktStaat').value }); if (r.tekst) $('#mktOms').value = r.tekst; } catch(e){}
    });
    const aiPr = $('#mktAiPrijs'); if (aiPr) aiPr.addEventListener('click', async () => {
      try { const r = await API.call('/supplier/markt/ai', { soort:'prijs', titel:$('#mktTitel').value.trim(), categorie:$('#mktCat').value, staat:$('#mktStaat').value }); if (r.prijs && !$('#mktPrijs').value) $('#mktPrijs').value = r.prijs.midden; uit.textContent = r.tekst||''; } catch(e){}
    });
    const plaatsBtn = $('#mktPlaatsBtn'); if (plaatsBtn) plaatsBtn.addEventListener('click', async () => {
      const m = $('#mktMelding');
      try {
        const r = await API.call('/supplier/markt/plaats', { akkoord:$('#mktAkkoord').checked, titel:$('#mktTitel').value.trim(), beschrijving:$('#mktOms').value.trim(), categorie:$('#mktCat').value, staat:$('#mktStaat').value, prijs:Number($('#mktPrijs').value)||0, plaats:$('#mktPlaats').value.trim(), levering:['ophalen'] });
        m.style.color = '#7EE0A3'; m.textContent = r.waarschuwing ? T('mkt.let','Geplaatst. Let op: ')+r.waarschuwing : T('mkt.gedaan','Geplaatst in De Salon.');
        rtfmData = null; laadRtfm();
      } catch(e){ m.style.color = '#E0736A'; m.textContent = e.message; }
    });
    el.querySelectorAll('[data-mktverk]').forEach(b => b.addEventListener('click', async () => { await API.call('/supplier/markt/status', { id:b.dataset.mktverk, status:'verkocht' }).catch(()=>{}); rtfmData=null; laadRtfm(); }));
    el.querySelectorAll('[data-mktheropen]').forEach(b => b.addEventListener('click', async () => { await API.call('/supplier/markt/status', { id:b.dataset.mktheropen, status:'te-koop' }).catch(()=>{}); rtfmData=null; laadRtfm(); }));
    el.querySelectorAll('[data-mktdel]').forEach(b => b.addEventListener('click', async () => { if(!confirm(T('mkt.delc','Deze advertentie verwijderen?')))return; await API.call('/supplier/markt/verwijder', { id:b.dataset.mktdel }).catch(()=>{}); rtfmData=null; laadRtfm(); }));
  }

  // ---- retail / mode: de slimme merk-backoffice ----
  let retailData = null;         // volledige retail-toestand van de server
  let retailSec = 'overzicht';   // overzicht | catalogus | voorraad | clienteling
  let retailKlant = null;        // geopend klantdossier (clienteling)
  let retailArtBewerk = null;    // id van het artikel dat bewerkt wordt (of 'nieuw')
  const RSEC = [['overzicht','📈','Overzicht'],['catalogus','👗','Collecties'],['voorraad','📦','Voorraad'],['clienteling','💎','Klanten']];
  async function laadRetail(){
    if (!has('retail') || !API.live) return;
    try { retailData = (await API.call('/supplier/retail', {})).retail; } catch(e){ retailData = { collecties:[], artikelen:[], apart:[], paskamer:[], styling:[], klanten:[], stats:{}, maten:[], seizoenen:[] }; }
    renderRetail();
  }
  function rSelStyle(){ return 'style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"'; }
  function retailSubnav(){
    return '<div class="st-chips" style="display:flex;gap:0.4rem;overflow-x:auto;margin-bottom:0.9rem;-webkit-overflow-scrolling:touch;">'+
      RSEC.map(s => { const on = retailSec===s[0]; return '<button data-rsec="'+s[0]+'" style="white-space:nowrap;border:1px solid '+(on?'var(--gold)':'var(--line)')+';background:var(--card2);color:'+(on?'var(--gold)':'var(--txt)')+';border-radius:999px;padding:0.5rem 0.9rem;font-size:0.74rem;font-weight:'+(on?'600':'500')+';">'+s[1]+' '+T('rt.sec.'+s[0], s[2])+'</button>'; }).join('')+'</div>';
  }
  function collNaam(cid){ const c = (retailData.collecties||[]).find(x => x.id===cid); return c ? (c.seizoen+' '+c.jaar+' · '+c.naam) : T('rt.los','Losse artikelen'); }
  function renderRetail(){
    const el = $('#retailWrap'); if (!el) return;
    if (!has('retail')){ el.innerHTML = ''; return; }
    if (!retailData){ el.innerHTML = '<div class="empty">…</div>'; laadRetail(); return; }
    const canEdit = actor().manager;
    let html = retailSubnav();
    if (retailSec === 'overzicht') html += retailOverzicht(canEdit);
    else if (retailSec === 'catalogus') html += retailCatalogusView(canEdit);
    else if (retailSec === 'voorraad') html += retailVoorraadView();
    else if (retailSec === 'clienteling') html += retailClienteling(canEdit);
    el.innerHTML = html;
    el.querySelectorAll('[data-rsec]').forEach(b => b.addEventListener('click', () => { retailSec = b.dataset.rsec; retailKlant = null; retailArtBewerk = null; renderRetail(); }));
    retailBindActions(el, canEdit);
  }
  function retailOverzicht(canEdit){
    const st = retailData.stats || {};
    const kpi = (v,l) => '<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0.7rem 0.8rem;"><div style="font-size:1.25rem;font-weight:700;">'+v+'</div><div class="tt-h" style="margin-top:0.15rem;">'+l+'</div></div>';
    let html = '<div class="card"><div class="tt-h">'+T('rt.vandaag','Vandaag')+'</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-top:0.6rem;">'+
      kpi(geld(st.omzetVandaag||0), T('rt.omzet','omzet'))+kpi(st.bonnenVandaag||0, T('rt.bonnen','bonnen'))+kpi(st.klanten||0, T('rt.klanten','klanten'))+
      kpi(st.artikelen||0, T('rt.artikelen','artikelen'))+kpi(st.voorraadTotaal||0, T('rt.voorraad','stuks voorraad'))+kpi((retailData.paskamer||[]).length+(retailData.apart||[]).length, T('rt.vloer','op de vloer'))+
      '</div></div>';
    // bestsellers
    const bs = st.bestsellers || [];
    html += '<div class="card"><div class="tt-h">'+T('rt.bestsellers','Bestsellers')+'</div>'+
      (bs.length ? '<div style="margin-top:0.5rem;">'+bs.map((b,i) => '<div class="mitem"><div class="r1"><span class="nm">'+(i+1)+'. '+esc(b.naam)+'</span><span class="pr">'+b.aantal+'×</span></div></div>').join('') + '</div>'
        : '<div class="empty">'+T('rt.geenverkoop','Nog geen verkopen vandaag.')+'</div>')+'</div>';
    // sell-through per collectie (balkjes)
    const sthr = st.sellThrough || [];
    if (sthr.length) html += '<div class="card"><div class="tt-h">'+T('rt.sellthrough','Sell-through per collectie')+'</div>'+
      '<div style="margin-top:0.5rem;display:grid;gap:0.6rem;">'+sthr.map(c =>
        '<div><div style="display:flex;justify-content:space-between;font-size:0.8rem;"><span>'+esc(c.collectie)+'</span><span style="color:var(--gold);">'+c.pct+'%</span></div>'+
        '<div style="height:7px;background:var(--card2);border-radius:999px;margin-top:0.3rem;overflow:hidden;"><div style="height:100%;width:'+c.pct+'%;background:var(--gold);"></div></div>'+
        '<div class="tt-h" style="margin-top:0.2rem;">'+c.verkocht+' '+T('rt.verkocht','verkocht')+' · '+c.voorraad+' '+T('rt.opvoorraad','op voorraad')+'</div></div>').join('')+'</div></div>';
    // lage voorraad / bijbestellen
    const laag = st.laag || [];
    html += '<div class="card"><div class="tt-h">'+T('rt.bijbestel','Bijbestellen (lage voorraad)')+'</div>'+
      (laag.length ? '<div style="margin-top:0.5rem;">'+laag.map(v => '<div class="mitem"><div class="r1"><span class="nm">'+esc(v.artikel)+'</span><span class="pr" style="color:'+(v.voorraad<=0?'var(--burgundy)':'var(--amber)')+';">'+v.voorraad+'</span></div><div class="ds">'+esc(v.kleur)+' · '+T('rt.maat','maat')+' '+esc(v.maat)+' · '+esc(v.vsku)+'</div></div>').join('')+'</div>'
        : '<div class="empty">'+T('rt.voorraadok','Alle maten ruim op voorraad.')+'</div>')+'</div>';
    // open paskamerverzoeken (ook af te handelen vanuit de backoffice)
    const pk = retailData.paskamer || [];
    if (pk.length) html += '<div class="card"><div class="tt-h">'+T('rt.paskamer','Paskamerverzoeken')+'</div>'+
      '<div style="margin-top:0.5rem;">'+pk.map(v => '<div class="mitem"><div class="r1"><span class="nm">'+esc(v.artikelNaam)+'</span><span class="pr">'+esc(v.maat)+'</span></div>'+
        '<div class="ds">'+esc(v.codenaam||'Gast')+' · '+esc(v.kleur)+(v.paskamer?' · '+esc(v.paskamer):'')+'</div>'+
        '<div style="margin-top:0.4rem;"><button class="obtn primary" data-rpkbreng="'+v.id+'">'+T('rt.breng','Breng gebracht')+'</button></div></div>').join('')+'</div></div>';
    // artikelen met een aangekondigde drop (release)
    if (canEdit){
      const drops = (retailData.artikelen||[]).filter(a => a.drop && !a.drop.gereleased);
      if (drops.length) html += '<div class="card"><div class="tt-h">'+T('rt.drops','Aangekondigde drops')+'</div>'+
        '<div style="margin-top:0.5rem;">'+drops.map(a => '<div class="mitem"><div class="r1"><span class="nm">'+esc(a.naam)+'</span><span class="pr">'+esc(a.drop.datum)+' '+esc(a.drop.tijd)+'</span></div>'+
          '<div style="margin-top:0.4rem;"><button class="obtn primary" data-rrelease="'+a.id+'">'+T('rt.release','Nu vrijgeven')+'</button></div></div>').join('')+'</div></div>';
    }
    return html;
  }
  function retailCatalogusView(canEdit){
    let html = '';
    // collecties
    const cols = retailData.collecties || [];
    html += '<div class="card"><div class="tt-h">'+T('rt.collecties','Collecties')+'</div>'+
      (cols.length ? '<div style="margin-top:0.5rem;">'+cols.map(c => '<div class="mitem"><div class="r1"><span class="nm">'+esc(c.naam)+'</span><span class="pr">'+esc(c.seizoen)+' '+c.jaar+'</span></div>'+
        (canEdit?'<div style="margin-top:0.4rem;"><button class="obtn warn" data-rcoldel="'+c.id+'">'+T('rt.verwijder','Verwijder')+'</button></div>':'')+'</div>').join('')+'</div>'
        : '<div class="empty">'+T('rt.geencoll','Nog geen collecties.')+'</div>')+
      (canEdit ? '<div style="margin-top:0.7rem;display:grid;grid-template-columns:1fr auto auto auto;gap:0.4rem;align-items:end;">'+
        '<div class="field" style="margin:0;"><label>'+T('rt.f.collnaam','Naam')+'</label><input id="rColNaam" placeholder="'+T('rt.f.collnaamph','Bijv. Riviera')+'"></div>'+
        '<div class="field" style="margin:0;"><label>'+T('rt.f.seizoen','Seizoen')+'</label><select id="rColSeiz" '+rSelStyle()+'>'+(retailData.seizoenen||['SS','AW']).map(s=>'<option>'+s+'</option>').join('')+'</select></div>'+
        '<div class="field" style="margin:0;width:70px;"><label>'+T('rt.f.jaar','Jaar')+'</label><input id="rColJaar" type="number" value="'+(new Date().getFullYear())+'"></div>'+
        '<button class="obtn primary" id="rColAdd">'+T('rt.f.voeg','Voeg toe')+'</button></div>' : '')+'</div>';
    // artikelen
    const arts = retailData.artikelen || [];
    html += '<div class="card"><div class="tt-h">'+T('rt.artikelen2','Artikelen')+' ('+arts.length+')</div>'+
      (arts.length ? '<div style="margin-top:0.5rem;display:grid;gap:0.5rem;">'+arts.map(a => {
        const drop = a.drop && !a.drop.gereleased ? '<span class="pill" style="color:var(--gold);border-color:rgba(212,175,55,0.4);margin-left:0.3rem;">'+T('rt.drop','drop')+' '+esc(a.drop.datum)+'</span>' : '';
        return '<div class="mitem"><div style="display:flex;gap:0.7rem;">'+
          (a.foto ? '<img src="'+esc(a.foto)+'" alt="'+esc(a.naam)+'" style="width:52px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0;">' : '<div style="width:52px;height:64px;border-radius:8px;background:var(--card2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">👗</div>')+
          '<div style="flex:1;min-width:0;"><div class="r1"><span class="nm">'+esc(a.naam)+drop+'</span><span class="pr">'+geld(a.price)+'</span></div>'+
          '<div class="ds">'+esc(collNaam(a.collectieId))+' · '+esc(a.categorie||'')+'</div>'+
          '<div class="ds">'+esc((a.varianten||[]).map(v=>v.kleur).filter((x,i,z)=>z.indexOf(x)===i).join(', '))+' · '+T('rt.totvoorraad','voorraad')+' '+(a.voorraad||0)+'</div>'+
          (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;"><button class="obtn" data-rartedit="'+a.id+'">'+T('rt.bewerk','Bewerk')+'</button><button class="obtn warn" data-rartdel="'+a.id+'">'+T('rt.verwijder','Verwijder')+'</button></div>':'')+
          '</div></div></div>';
      }).join('')+'</div>' : '<div class="empty">'+T('rt.geenart','Nog geen artikelen.')+'</div>')+
      (canEdit ? '<div style="margin-top:0.8rem;"><button class="obtn primary" id="rArtNieuw">'+T('rt.nieuwart','+ Nieuw artikel')+'</button></div>' : '')+'</div>';
    // artikel-formulier
    if (canEdit && retailArtBewerk) html += retailArtikelForm();
    return html;
  }
  function retailArtikelForm(){
    const a = retailArtBewerk === 'nieuw' ? null : (retailData.artikelen||[]).find(x => x.id === retailArtBewerk);
    const maten = retailData.maten || ['XS','S','M','L','XL','XXL'];
    const gekozenM = a ? [...new Set((a.varianten||[]).map(v=>v.maat))] : ['S','M','L'];
    const kleuren = a ? [...new Set((a.varianten||[]).map(v=>v.kleur))].join(', ') : '';
    return '<div class="card" id="rArtForm"><div class="tt-h">'+(a?T('rt.bewerkart','Artikel bewerken'):T('rt.nieuwart2','Nieuw artikel'))+'</div>'+
      '<div class="field"><label>'+T('rt.f.naam','Naam')+'</label><input id="rArtNaam" value="'+esc(a?a.naam:'')+'" placeholder="'+T('rt.f.naamph','Bijv. Zijden slipdress')+'"></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">'+
        '<div class="field"><label>'+T('rt.f.sku','SKU')+'</label><input id="rArtSku" value="'+esc(a?a.sku:'')+'" placeholder="'+T('rt.optioneel','optioneel')+'"></div>'+
        '<div class="field"><label>'+T('rt.f.cat','Categorie')+'</label><input id="rArtCat" value="'+esc(a?a.categorie:'')+'" placeholder="'+T('rt.f.catph','Bijv. Jurken')+'"></div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">'+
        '<div class="field"><label>'+T('rt.f.materiaal','Materiaal')+'</label><input id="rArtMat" value="'+esc(a?a.materiaal:'')+'" placeholder="'+T('rt.f.materiaalph','Bijv. 100% zijde')+'"></div>'+
        '<div class="field"><label>'+T('rt.f.prijs','Publieke prijs (€)')+'</label><input id="rArtPrijs" type="number" step="0.01" value="'+(a?a.publiekePrijs:'')+'"></div>'+
      '</div>'+
      '<div class="field"><label>'+T('rt.f.coll','Collectie')+'</label><select id="rArtColl" '+rSelStyle()+'>'+(retailData.collecties||[]).map(c=>'<option value="'+c.id+'"'+(a&&a.collectieId===c.id?' selected':'')+'>'+esc(c.seizoen+' '+c.jaar+' · '+c.naam)+'</option>').join('')+'</select></div>'+
      '<div class="field"><label>'+T('rt.f.oms','Omschrijving')+'</label><textarea id="rArtOms" rows="2">'+esc(a?a.omschrijving:'')+'</textarea></div>'+
      '<div class="field"><label>'+T('rt.f.kleuren','Kleuren (komma’s)')+'</label><input id="rArtKleuren" value="'+esc(kleuren)+'" placeholder="'+T('rt.f.kleurenph','Bijv. Zwart, Ivoor, Camel')+'"></div>'+
      '<div class="field"><label>'+T('rt.f.maten','Maten')+'</label><div id="rArtMaten" style="display:flex;flex-wrap:wrap;gap:0.4rem;">'+
        maten.map(m => '<button type="button" class="obtn rmaat'+(gekozenM.includes(m)?' primary':'')+'" data-rmaat="'+m+'">'+m+'</button>').join('')+'</div></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">'+
        '<div class="field"><label>'+T('rt.f.startvoorraad','Startvoorraad p. maat')+'</label><input id="rArtVoorraad" type="number" value="'+(a?'':'8')+'" placeholder="'+T('rt.optioneel','optioneel')+'"></div>'+
        '<div class="field"><label>'+T('rt.f.drop','Drop-datum')+'</label><input id="rArtDrop" type="date" value="'+esc(a&&a.drop?a.drop.datum:'')+'"></div>'+
      '</div>'+
      '<div class="field"><label>'+T('rt.f.foto','Foto')+'</label><label class="obtn" style="cursor:pointer;">📷 '+T('rt.f.kiesfoto','Kies foto')+'<input type="file" id="rArtFoto" accept="image/*" style="display:none;"></label> <span id="rArtFotoNaam" style="font-size:0.75rem;color:var(--muted);">'+(a&&a.foto?T('rt.fotoaanwezig','foto aanwezig'):'')+'</span></div>'+
      '<div style="margin-top:0.8rem;display:flex;gap:0.5rem;"><button class="obtn primary" id="rArtBewaar">'+T('rt.bewaar','Bewaar artikel')+'</button><button class="obtn" id="rArtAnnuleer">'+T('rt.annuleer','Annuleer')+'</button></div></div>';
  }
  function retailVoorraadView(){
    let html = '<div class="card"><div class="tt-h">'+T('rt.zoekvoorraad','Voorraad opzoeken')+'</div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="rZoek" placeholder="'+T('rt.zoekph','Naam, kleur of maat…')+'" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.9rem;color:var(--txt);outline:none;"><button class="obtn primary" id="rZoekBtn">'+T('rt.zoek','Zoek')+'</button></div>'+
      '<div id="rZoekUit" style="margin-top:0.6rem;"></div></div>';
    // alle varianten met snelle bijstelknoppen
    html += '<div class="card"><div class="tt-h">'+T('rt.allevoorraad','Alle voorraad')+'</div><div style="margin-top:0.5rem;">'+
      (retailData.artikelen||[]).map(a => '<div style="margin-bottom:0.7rem;"><div style="font-size:0.85rem;font-weight:600;margin-bottom:0.3rem;">'+esc(a.naam)+'</div>'+
        (a.varianten||[]).map(v => retailVariantRij(v)).join('')+'</div>').join('') + '</div></div>';
    return html;
  }
  function retailVariantRij(v){
    return '<div class="mitem" style="display:flex;align-items:center;gap:0.5rem;"><div style="flex:1;min-width:0;"><div class="nm">'+esc(v.kleur)+' · '+esc(v.maat)+'</div><div class="ds">'+esc(v.vsku)+'</div></div>'+
      '<button class="obtn" data-rvmin="'+esc(v.vsku)+'">−</button>'+
      '<span style="min-width:2ch;text-align:center;font-weight:700;color:'+(v.voorraad<=3?'var(--amber)':'var(--txt)')+';">'+v.voorraad+'</span>'+
      '<button class="obtn" data-rvplus="'+esc(v.vsku)+'">+</button></div>';
  }
  function retailClienteling(canEdit){
    if (retailKlant) return retailKlantDossier(canEdit);
    const kl = retailData.klanten || [];
    let html = '<div class="card"><div class="tt-h">'+T('rt.klantdossier','Clienteling')+' ('+kl.length+')</div>'+
      '<p class="ds" style="margin:0.4rem 0 0.2rem;">'+T('rt.clienteltip','Het geheime wapen van elk modehuis: maten, verlanglijst, aankoophistorie en stylist-notities per klant.')+'</p>'+
      (kl.length ? '<div style="margin-top:0.5rem;display:grid;gap:0.4rem;">'+kl.map(k => '<button class="mitem" data-rklant="'+esc(k.key)+'" style="text-align:left;width:100%;background:var(--card);border:1px solid var(--line);cursor:pointer;"><div class="r1"><span class="nm">'+esc(k.codenaam||k.key)+'</span><span class="pr">'+geld(k.besteedTotaal)+'</span></div><div class="ds">'+k.aankopen+' '+T('rt.aankopen','aankopen')+' · '+(k.wishlist?k.wishlist.length:0)+' '+T('rt.opverlang','op verlanglijst')+'</div></button>').join('')+'</div>'
        : '<div class="empty">'+T('rt.geenklant','Nog geen klantdossiers. Ze ontstaan zodra u een klant erbij pakt op de vloer (PDA) of een verkoop op naam boekt.')+'</div>')+'</div>';
    return html;
  }
  function retailKlantDossier(canEdit){
    const k = retailKlant;
    const maten = retailData.maten || [];
    let html = '<div style="margin-bottom:0.6rem;"><button class="obtn" id="rKlantTerug">← '+T('rt.terug','Terug')+'</button></div>';
    html += '<div class="card"><div class="r1"><span class="nm" style="font-size:1rem;">'+esc(k.codenaam||k.key)+'</span><span class="pr">'+geld(k.besteedTotaal)+'</span></div>'+
      '<div class="ds">'+k.aankopen+' '+T('rt.aankopen','aankopen')+(k.sinds?' · '+T('rt.klantsinds','klant sinds')+' '+esc(String(k.sinds).slice(0,10)):'')+'</div></div>';
    // maten + voorkeuren
    html += '<div class="card"><div class="tt-h">'+T('rt.maten2','Maten & voorkeuren')+'</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.4rem;margin-top:0.5rem;">'+
      ['Boven','Onder','Schoen','Jurk','Confectie'].map(cat => '<div class="field" style="margin:0;"><label>'+T('rt.mt.'+cat.toLowerCase(),cat)+'</label><input class="rMaatIn" data-rmaatcat="'+cat+'" value="'+esc((k.maten&&k.maten[cat])||'')+'" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;font-size:0.85rem;color:var(--txt);outline:none;"></div>').join('')+'</div>'+
      '<div class="field"><label>'+T('rt.voorkeuren','Voorkeuren')+'</label><textarea id="rVoorkeuren" rows="2">'+esc(k.voorkeuren||'')+'</textarea></div>'+
      '<button class="obtn primary" id="rMatenBewaar">'+T('rt.bewaarmaten','Bewaar maten')+'</button></div>';
    // verlanglijst
    html += '<div class="card"><div class="tt-h">'+T('rt.verlanglijst','Verlanglijst')+'</div>'+
      ((k.wishlist&&k.wishlist.length) ? '<div style="margin-top:0.5rem;display:grid;gap:0.4rem;">'+k.wishlist.map(w => '<div class="mitem"><div class="r1"><span class="nm">'+esc(w.naam)+'</span><span class="pr">'+geld(w.price)+'</span></div></div>').join('')+'</div>'
        : '<div class="empty">'+T('rt.geenverlang','Nog niets op de verlanglijst.')+'</div>')+'</div>';
    // historie
    html += '<div class="card"><div class="tt-h">'+T('rt.historie','Aankoophistorie')+'</div>'+
      ((k.historie&&k.historie.length) ? '<div style="margin-top:0.5rem;">'+k.historie.slice().reverse().map(h => '<div class="mitem"><div class="r1"><span class="nm">'+esc(h.naam)+'</span><span class="pr">'+geld(h.bedrag)+'</span></div><div class="ds">'+esc(String(h.at).slice(0,10))+'</div></div>').join('')+'</div>'
        : '<div class="empty">'+T('rt.geenhist','Nog geen aankopen.')+'</div>')+'</div>';
    // notities
    html += '<div class="card"><div class="tt-h">'+T('rt.notities','Stylist-notities')+'</div>'+
      ((k.notities&&k.notities.length) ? '<div style="margin-top:0.5rem;">'+k.notities.slice().reverse().map(n => '<div class="mitem"><div class="ds" style="color:var(--txt);">'+esc(n.tekst)+'</div><div class="ds">'+esc(n.door||'Team')+' · '+esc(String(n.at).slice(0,10))+'</div></div>').join('')+'</div>' : '')+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="rNotitie" placeholder="'+T('rt.notitieph','Nieuwe notitie…')+'" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.85rem;color:var(--txt);outline:none;"><button class="obtn primary" id="rNotitieAdd">'+T('rt.voegtoe','Voeg toe')+'</button></div></div>';
    // stylingvoorstel sturen
    html += '<div class="card"><div class="tt-h">'+T('rt.styling','Stylingvoorstel sturen')+'</div>'+
      '<p class="ds" style="margin:0.3rem 0;">'+T('rt.stylingtip','Kies artikelen; ze verschijnen als voorstel in de app van de klant.')+'</p>'+
      '<div style="max-height:180px;overflow-y:auto;display:grid;gap:0.3rem;margin-top:0.4rem;">'+(retailData.artikelen||[]).map(a => '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;"><input type="checkbox" class="rStylPick" value="'+a.id+'"> '+esc(a.naam)+' · '+geld(a.price)+'</label>').join('')+'</div>'+
      '<div class="field"><label>'+T('rt.stylingtitel','Titel')+'</label><input id="rStylTitel" value="'+T('rt.stylingtiteldef','Een selectie voor u')+'"></div>'+
      '<div class="field"><label>'+T('rt.stylingbericht','Bericht')+'</label><input id="rStylBericht" placeholder="'+T('rt.stylingberichtph','Optioneel persoonlijk bericht')+'"></div>'+
      '<button class="obtn primary" id="rStylStuur">'+T('rt.stuurstyling','Stuur voorstel')+'</button></div>';
    return html;
  }
  function retailBindActions(el, canEdit){
    el.querySelectorAll('[data-rpkbreng]').forEach(b => b.addEventListener('click', async () => {
      const paskamer = prompt(T('rt.welkepaskamer','In welke paskamer? (optioneel)')) || '';
      try { await API.call('/supplier/retail/paskamer/breng', { id: b.dataset.rpkbreng, paskamer }); toast(T('rt.gebracht','Gemarkeerd als gebracht.')); await laadRetail(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-rrelease]').forEach(b => b.addEventListener('click', async () => {
      try { const r = await API.call('/supplier/retail/drop/release', { artikelId: b.dataset.rrelease }); toast(T('rt.gereleased','Drop is live')+(r.bericht?' · '+r.bericht+' '+T('rt.opwachtlijst','op de wachtlijst geinformeerd'):'')); await laadRetail(); } catch(e){ toast(e.message); }
    }));
    // collecties
    const colAdd = el.querySelector('#rColAdd');
    if (colAdd) colAdd.addEventListener('click', async () => {
      try { await API.call('/supplier/retail/collectie', { naam: $('#rColNaam').value, seizoen: $('#rColSeiz').value, jaar: Number($('#rColJaar').value) }); toast(T('rt.colok','Collectie toegevoegd.')); await laadRetail(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-rcoldel]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm(T('rt.colweg','Deze collectie verwijderen?'))) return;
      try { await API.call('/supplier/retail/collectie', { action:'remove', id: b.dataset.rcoldel }); await laadRetail(); } catch(e){ toast(e.message); }
    }));
    // artikelen
    const artNieuw = el.querySelector('#rArtNieuw');
    if (artNieuw) artNieuw.addEventListener('click', () => { retailArtBewerk = 'nieuw'; renderRetail(); const f = $('#rArtForm'); if (f) f.scrollIntoView({ behavior:'smooth' }); });
    el.querySelectorAll('[data-rartedit]').forEach(b => b.addEventListener('click', () => { retailArtBewerk = b.dataset.rartedit; renderRetail(); const f = $('#rArtForm'); if (f) f.scrollIntoView({ behavior:'smooth' }); }));
    el.querySelectorAll('[data-rartdel]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm(T('rt.artweg','Dit artikel verwijderen?'))) return;
      try { await API.call('/supplier/retail/artikel', { action:'remove', id: b.dataset.rartdel }); toast(T('rt.artwegok','Artikel verwijderd.')); retailArtBewerk = null; await laadRetail(); } catch(e){ toast(e.message); }
    }));
    // artikel-formulier
    let artFotoData = null;
    el.querySelectorAll('[data-rmaat]').forEach(b => b.addEventListener('click', () => b.classList.toggle('primary')));
    const artFoto = el.querySelector('#rArtFoto');
    if (artFoto) artFoto.addEventListener('change', () => { if (artFoto.files && artFoto.files[0]) fileToDataURL(artFoto.files[0], d => { artFotoData = d; const n = $('#rArtFotoNaam'); if (n) n.textContent = T('rt.fotogekozen','foto gekozen'); }); });
    const artAnn = el.querySelector('#rArtAnnuleer');
    if (artAnn) artAnn.addEventListener('click', () => { retailArtBewerk = null; renderRetail(); });
    const artBewaar = el.querySelector('#rArtBewaar');
    if (artBewaar) artBewaar.addEventListener('click', async () => {
      const naam = $('#rArtNaam').value.trim();
      if (!naam) return toast(T('rt.geefnaam','Geef het artikel een naam.'));
      const maten = [...el.querySelectorAll('[data-rmaat].primary')].map(b => b.dataset.rmaat);
      if (!maten.length) return toast(T('rt.kiesmaat','Kies minstens een maat.'));
      const kleuren = $('#rArtKleuren').value.split(',').map(s => s.trim()).filter(Boolean);
      if (!kleuren.length) kleuren.push('Zwart');
      const start = Math.max(0, parseInt($('#rArtVoorraad').value, 10) || 0);
      const bestaand = retailArtBewerk === 'nieuw' ? null : (retailData.artikelen||[]).find(x => x.id === retailArtBewerk);
      const bestaandeV = {}; if (bestaand) (bestaand.varianten||[]).forEach(v => { bestaandeV[v.kleur+'|'+v.maat] = v.voorraad; });
      const varianten = [];
      for (const kl of kleuren) for (const m of maten) varianten.push({ kleur: kl, maat: m, voorraad: bestaand ? (bestaandeV[kl+'|'+m] != null ? bestaandeV[kl+'|'+m] : start) : start });
      const dropDatum = $('#rArtDrop').value;
      const artikel = { naam, sku: $('#rArtSku').value, categorie: $('#rArtCat').value, materiaal: $('#rArtMat').value,
        omschrijving: $('#rArtOms').value, publiekePrijs: Number($('#rArtPrijs').value) || 0, collectieId: $('#rArtColl').value || null,
        varianten, drop: dropDatum ? { datum: dropDatum, tijd: '10:00' } : null };
      if (artFotoData) artikel.foto = artFotoData;
      const body = { artikel }; if (bestaand) body.id = bestaand.id;
      try { await API.call('/supplier/retail/artikel', body); toast(T('rt.artok','Artikel bewaard.')); retailArtBewerk = null; await laadRetail(); openTab('retail'); } catch(e){ toast(e.message); }
    });
    // voorraad
    const zoekBtn = el.querySelector('#rZoekBtn');
    const doeZoek = async () => {
      try { const r = await API.call('/supplier/retail/zoek', { q: $('#rZoek').value }); const uit = $('#rZoekUit');
        uit.innerHTML = r.resultaten.length ? r.resultaten.map(v => '<div class="mitem"><div class="r1"><span class="nm">'+esc(v.artikel)+'</span><span class="pr" style="color:'+(v.laag?'var(--amber)':'var(--txt)')+';">'+v.voorraad+'</span></div><div class="ds">'+esc(v.kleur)+' · '+T('rt.maat','maat')+' '+esc(v.maat)+' · '+geld(v.price)+'</div></div>').join('') : '<div class="empty">'+T('rt.nietsgevonden','Niets gevonden.')+'</div>';
      } catch(e){ toast(e.message); }
    };
    if (zoekBtn) zoekBtn.addEventListener('click', doeZoek);
    const zoekIn = el.querySelector('#rZoek'); if (zoekIn) zoekIn.addEventListener('keydown', e => { if (e.key === 'Enter') doeZoek(); });
    const pasVoorraad = async (vsku, delta) => { try { await API.call('/supplier/retail/voorraad', { vsku, delta }); await laadRetail(); } catch(e){ toast(e.message); } };
    el.querySelectorAll('[data-rvmin]').forEach(b => b.addEventListener('click', () => pasVoorraad(b.dataset.rvmin, -1)));
    el.querySelectorAll('[data-rvplus]').forEach(b => b.addEventListener('click', () => pasVoorraad(b.dataset.rvplus, 1)));
    // clienteling
    el.querySelectorAll('[data-rklant]').forEach(b => b.addEventListener('click', async () => {
      try { retailKlant = (await API.call('/supplier/retail/klant', { key: b.dataset.rklant })).klant; renderRetail(); } catch(e){ toast(e.message); }
    }));
    const klTerug = el.querySelector('#rKlantTerug'); if (klTerug) klTerug.addEventListener('click', () => { retailKlant = null; renderRetail(); });
    const matBew = el.querySelector('#rMatenBewaar');
    if (matBew) matBew.addEventListener('click', async () => {
      const maten = {}; el.querySelectorAll('.rMaatIn').forEach(i => { if (i.value.trim()) maten[i.dataset.rmaatcat] = i.value.trim(); });
      try { await API.call('/supplier/retail/klant/maten', { key: retailKlant.key, maten, voorkeuren: $('#rVoorkeuren').value }); toast(T('rt.matenok','Maten bewaard.')); retailKlant = (await API.call('/supplier/retail/klant', { key: retailKlant.key })).klant; renderRetail(); } catch(e){ toast(e.message); }
    });
    const notAdd = el.querySelector('#rNotitieAdd');
    if (notAdd) notAdd.addEventListener('click', async () => {
      const tekst = $('#rNotitie').value.trim(); if (!tekst) return;
      try { await API.call('/supplier/retail/klant/notitie', { key: retailKlant.key, tekst }); retailKlant = (await API.call('/supplier/retail/klant', { key: retailKlant.key })).klant; renderRetail(); } catch(e){ toast(e.message); }
    });
    const stylStuur = el.querySelector('#rStylStuur');
    if (stylStuur) stylStuur.addEventListener('click', async () => {
      const artikelIds = [...el.querySelectorAll('.rStylPick:checked')].map(c => c.value);
      if (!artikelIds.length) return toast(T('rt.kiesart','Kies minstens een artikel.'));
      try { await API.call('/supplier/retail/styling', { key: retailKlant.key, artikelIds, titel: $('#rStylTitel').value, bericht: $('#rStylBericht').value }); toast(T('rt.stylok','Voorstel verstuurd naar de klant.')); renderRetail(); } catch(e){ toast(e.message); }
    });
  }

  // ---- identiteit & leeftijd: het gecontroleerde paspoortkanaal ----
  let paspoortData = null;      // eigen verzoeken + incidenten
  let paspoortBevestiging = null;  // laatste ja/nee-uitslag
  let paspoortInzage = null;    // geopende inzage (id-kaart of scan)
  async function laadPaspoort(){
    if (!API.live) return;
    try { paspoortData = await API.call('/supplier/paspoort/overzicht', {}); } catch(e){ paspoortData = { verzoeken:[], incidenten:[], niveaus:[] }; }
    renderPaspoort();
  }
  function pnBadge(st){
    const kleur = st==='goedgekeurd'?'var(--green)':st==='geweigerd'||st==='afgewezen'?'var(--burgundy)':st==='verlopen'||st==='ingetrokken'?'var(--soft)':'var(--amber)';
    return '<span class="pill" style="color:'+kleur+';border-color:'+kleur+';">'+T('pn.st.'+st, st)+'</span>';
  }
  function renderPaspoort(){
    const el = $('#paspoortWrap'); if (!el) return;
    if (!paspoortData){ el.innerHTML = '<div class="empty">…</div>'; laadPaspoort(); return; }
    const sel = 'style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"';
    let html = '';
    // aanvraagformulier
    html += '<div class="card"><div class="tt-h">'+T('pn.vraag','Identiteit opvragen')+'</div>'+
      '<div class="field"><label>'+T('pn.codenaam','Codenaam van de gast')+'</label><input id="pnCode" placeholder="'+T('pn.codeph','Bijv. Zilveren Valk 12')+'" autocomplete="off"></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">'+
        '<div class="field" style="margin:0;"><label>'+T('pn.minleeftijd','Leeftijdseis (optioneel)')+'</label><input id="pnLeeftijd" type="number" placeholder="18" inputmode="numeric"></div>'+
        '<div class="field" style="margin:0;"><label>'+T('pn.reden','Reden (optioneel)')+'</label><input id="pnReden" placeholder="'+T('pn.redenph','Bijv. leeftijdscontrole')+'"></div>'+
      '</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.8rem;">'+
        '<button class="obtn primary" data-pnvraag="bevestiging">'+T('pn.jaNee','Ja/nee-check')+'</button>'+
        '<button class="obtn" data-pnvraag="idkaart">'+T('pn.idkaart','ID-kaart vragen')+'</button>'+
        '<button class="obtn" data-pnvraag="paspoort">'+T('pn.paspoort','Paspoort vragen')+'</button>'+
      '</div>'+
      '<div id="pnUitslag" style="margin-top:0.7rem;"></div></div>';
    // geopende inzage
    if (paspoortInzage) html += paspoortInzageKaart(paspoortInzage);
    // lopende en afgehandelde verzoeken
    const vz = paspoortData.verzoeken || [];
    html += '<div class="card"><div class="tt-h">'+T('pn.verzoeken','Mijn verzoeken')+'</div>'+
      (vz.length ? '<div style="margin-top:0.5rem;display:grid;gap:0.4rem;">'+vz.map(v => '<div class="mitem"><div class="r1"><span class="nm">'+esc(v.codenaam||'\u2013')+'</span>'+pnBadge(v.status)+'</div>'+
        '<div class="ds">'+T('pn.niveau.'+v.niveau, v.niveau)+(v.incident?' · '+T('pn.viaIncident','via incident'):'')+(v.reden?' · '+esc(v.reden):'')+'</div>'+
        (v.status==='goedgekeurd'?'<div style="margin-top:0.4rem;"><button class="obtn primary" data-pnbekijk="'+v.id+'">'+T('pn.bekijk','Inzage openen')+'</button>'+(v.vervalt?' <span class="ds">'+T('pn.tot','geldig tot')+' '+new Date(v.vervalt).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})+'</span>':'')+'</div>':'')+
        '</div>').join('')+'</div>'
        : '<div class="empty">'+T('pn.geenverzoek','Nog geen verzoeken.')+'</div>')+'</div>';
    // incident melden
    html += '<div class="card"><div class="tt-h">'+T('pn.incident','Incident: identiteit opeisen')+'</div>'+
      '<p class="ds" style="margin:0.3rem 0;">'+T('pn.incidenttip','Alleen bij een echt incident. RTG-kantoor beoordeelt het verzoek en geeft de identiteit pas daarna vrij. Alles wordt gelogd.')+'</p>'+
      '<div class="field"><label>'+T('pn.codenaam','Codenaam van de gast')+'</label><input id="pnIncCode" placeholder="'+T('pn.codeph','Bijv. Zilveren Valk 12')+'" autocomplete="off"></div>'+
      '<div class="field"><label>'+T('pn.incReden','Wat is er gebeurd?')+'</label><textarea id="pnIncReden" rows="2" '+sel+' placeholder="'+T('pn.incRedenph','Beschrijf het incident (min. 10 tekens)')+'"></textarea></div>'+
      '<div class="field"><label>'+T('pn.incNiveau','Gevraagd niveau')+'</label><select id="pnIncNiveau" '+sel+'><option value="idkaart">'+T('pn.niveau.idkaart','ID-kaart')+'</option><option value="paspoort">'+T('pn.niveau.paspoort','Paspoort')+'</option></select></div>'+
      '<button class="obtn warn" id="pnIncMeld" style="margin-top:0.7rem;">'+T('pn.incMeld','Incident melden bij RTG')+'</button></div>';
    // eigen incidenten
    const inc = paspoortData.incidenten || [];
    if (inc.length) html += '<div class="card"><div class="tt-h">'+T('pn.incidenten','Mijn incidenten')+'</div>'+
      '<div style="margin-top:0.5rem;">'+inc.map(i => '<div class="mitem"><div class="r1"><span class="nm">'+esc(i.codenaam||'\u2013')+'</span>'+pnBadge(i.status)+'</div><div class="ds">'+esc(i.reden)+'</div></div>').join('')+'</div></div>';
    el.innerHTML = html;
    paspoortBind(el);
  }
  function paspoortInzageKaart(inh){
    let body = '';
    if (inh.niveau === 'bevestiging'){
      body = '<div style="font-size:0.9rem;">'+(inh.geverifieerd?'✅ '+T('pn.geverifieerd','RTG-geverifieerd'):'⛔ '+T('pn.nietgeverifieerd','niet geverifieerd'))+
        (inh.voldoetLeeftijd!=null?'<br>'+(inh.voldoetLeeftijd?'✅ '+T('pn.voldoet','voldoet aan de leeftijdseis'):'⛔ '+T('pn.voldoetniet','voldoet NIET aan de leeftijdseis')):'')+'</div>';
    } else {
      body = '<div style="display:flex;gap:0.8rem;">'+
        (inh.foto?'<img src="'+esc(inh.foto)+'" alt="'+T('pn.pasfoto','Pasfoto')+'" style="width:80px;height:100px;object-fit:cover;border-radius:10px;flex-shrink:0;">':'')+
        '<div><div style="font-weight:700;font-size:0.95rem;">'+esc(inh.naam||'')+'</div>'+
        '<div class="ds">'+(inh.nationaliteit?esc(inh.nationaliteit)+' · ':'')+(inh.geboortedatum?esc(inh.geboortedatum):'')+(inh.leeftijd!=null?' ('+inh.leeftijd+')':'')+'</div>'+
        '<div class="ds" style="margin-top:0.3rem;color:var(--green);">'+(inh.geverifieerd?'✅ '+T('pn.geverifieerd','RTG-geverifieerd'):'')+(inh.gezichtGecontroleerd?' · '+T('pn.gezicht','gezicht gecontroleerd'):'')+'</div></div></div>'+
        (inh.scan?'<div style="margin-top:0.6rem;"><div class="tt-h">'+T('pn.scan','Paspoortscan')+'</div><img src="'+esc(inh.scan)+'" alt="'+T('pn.scan','Paspoortscan')+'" style="width:100%;border-radius:10px;margin-top:0.4rem;"></div>':'');
    }
    return '<div class="card" style="border-color:var(--gold);"><div class="tt-h" style="color:var(--gold);">'+T('pn.inzage','Inzage')+' · '+T('pn.niveau.'+inh.niveau, inh.niveau)+'</div><div style="margin-top:0.5rem;">'+body+'</div>'+
      '<button class="obtn" id="pnSluit" style="margin-top:0.7rem;">'+T('pn.sluit','Sluiten')+'</button></div>';
  }
  function paspoortBind(el){
    el.querySelectorAll('[data-pnvraag]').forEach(b => b.addEventListener('click', async () => {
      const codenaam = ($('#pnCode').value||'').trim(); if (!codenaam) return toast(T('pn.geefcode','Vul een codenaam in.'));
      const body = { codenaam, niveau: b.dataset.pnvraag };
      const lft = $('#pnLeeftijd').value; if (lft) body.minLeeftijd = Number(lft);
      const reden = $('#pnReden').value; if (reden) body.reden = reden;
      try {
        const r = await API.call('/supplier/paspoort/vraag', body);
        const uit = $('#pnUitslag');
        if (r.niveau === 'bevestiging'){
          const be = r.bevestiging;
          uit.innerHTML = '<div style="padding:0.6rem 0.8rem;border:1px solid var(--line);border-radius:12px;font-size:0.88rem;">'+
            (be.geverifieerd?'✅ '+T('pn.geverifieerd','RTG-geverifieerd'):'⛔ '+T('pn.nietgeverifieerd','niet geverifieerd'))+
            (be.voldoetLeeftijd!=null?' · '+(be.voldoetLeeftijd?'✅ '+be.minLeeftijd+'+':'⛔ '+T('pn.voldoetniet','voldoet niet')):'')+'</div>';
        } else {
          uit.innerHTML = '<div style="padding:0.6rem 0.8rem;border:1px solid var(--line);border-radius:12px;font-size:0.85rem;color:var(--amber);">⏳ '+T('pn.verstuurd','Verzoek verstuurd. De gast krijgt een melding en kan het goedkeuren of weigeren.')+'</div>';
          await laadPaspoort();
        }
      } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-pnbekijk]').forEach(b => b.addEventListener('click', async () => {
      try { const r = await API.call('/supplier/paspoort/bekijk', { id: b.dataset.pnbekijk }); paspoortInzage = r.inhoud; renderPaspoort(); const c = $('#paspoortWrap'); if (c) c.scrollTop = 0; }
      catch(e){ toast(e.message); await laadPaspoort(); }
    }));
    const sluit = el.querySelector('#pnSluit'); if (sluit) sluit.addEventListener('click', () => { paspoortInzage = null; renderPaspoort(); });
    const incBtn = el.querySelector('#pnIncMeld');
    if (incBtn) incBtn.addEventListener('click', async () => {
      const codenaam = ($('#pnIncCode').value||'').trim(); const reden = ($('#pnIncReden').value||'').trim();
      if (!codenaam) return toast(T('pn.geefcode','Vul een codenaam in.'));
      if (reden.length < 10) return toast(T('pn.geefreden','Beschrijf het incident (min. 10 tekens).'));
      try { await API.call('/supplier/paspoort/incident', { codenaam, reden, niveau: $('#pnIncNiveau').value }); toast(T('pn.incok','Incident gemeld. RTG beoordeelt het.')); $('#pnIncCode').value=''; $('#pnIncReden').value=''; await laadPaspoort(); }
      catch(e){ toast(e.message); }
    });
  }

  // ---- groothandel: de groothandel beheert assortiment, functies en orders ----
  let ghEdit = null;
  async function renderGroothandel(){
    const el = $('#groothandelWrap'); if (!el) return;
    if (!has('groothandel')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/groothandel/overzicht'); } catch(e){ return; }
    const cats = d.categorieen || [];
    // functie-schakelaars
    const ghChips = '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">' +
      (d.functies||[]).map(f => '<button class="js-ghf" data-id="'+f.id+'" data-aan="'+f.aan+'" style="border:1px solid '+(f.aan?'#1f5637':'var(--line)')+';background:'+(f.aan?'#12321f':'var(--card2)')+';color:'+(f.aan?'#7EE0A3':'var(--soft)')+';border-radius:999px;padding:0.32rem 0.7rem;font-size:0.72rem;font-weight:600;font-family:inherit;">'+esc(f.naam)+'</button>').join('') +
      '</div>';
    let h = funcBlok(T('gh.functies','Uw functies (aan/uit)'), d.functies||[], ghChips);
    // binnenkomende orders
    const ink = d.inkomend || { open:[], afgerond:[], omzet:0 };
    h += '<div class="st-sec">'+T('gh.orders','Bestellingen')+' · '+T('gh.omzet','omzet')+' '+eur(ink.omzet||0)+'</div>';
    h += ink.open.length ? ink.open.map(o => ghOrderKaart(o, true)).join('') : '<p class="sub">'+T('gh.geenorders','Geen openstaande bestellingen.')+'</p>';
    if (ink.afgerond.length) h += '<details style="margin-top:0.6rem;"><summary class="sub" style="cursor:pointer;">'+T('gh.afgerond','Afgerond')+' ('+ink.afgerond.length+')</summary>'+ink.afgerond.map(o=>ghOrderKaart(o,false)).join('')+'</details>';
    // assortiment
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('gh.assortiment','Assortiment')+' <button class="js-ghnew" style="float:right;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.25rem 0.6rem;font-size:0.72rem;font-weight:600;font-family:inherit;">+ '+T('gh.nieuw','Nieuw product')+'</button></div>';
    h += '<div id="ghForm"></div>';
    h += '<div style="margin-top:0.5rem;">'+(d.producten||[]).map(p =>
      '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0;border-top:1px solid var(--line);">'+
      '<div style="flex:1;"><b style="font-size:0.85rem;">'+esc(p.naam)+'</b><span class="sub"> · '+esc(p.categorie)+' · '+T('gh.per','per')+' '+esc(p.eenheid)+'</span>'+
      '<div class="sub">'+T('gh.inkoop','inkoop')+' '+eur(p.inkoopPrijs)+' · '+T('gh.consument','consument')+' '+eur(p.consumentPrijs)+' · '+T('gh.voorraad','voorraad')+' '+p.voorraad+(p.actief?'':' · <span style="color:var(--gold);">'+T('gh.uit','uit')+'</span>')+'</div></div>'+
      '<button class="js-ghedit" data-id="'+p.id+'" style="background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:0.3rem 0.6rem;color:var(--txt);font-size:0.72rem;font-family:inherit;">'+T('gh.bewerk','Bewerk')+'</button></div>').join('');
    el.innerHTML = h;
    wireFuncBlok(el);
    el.querySelectorAll('.js-ghf').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/groothandel/functie', { id:b.dataset.id, aan: b.dataset.aan!=='true' }); renderGroothandel(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ghverder]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/groothandel/order/status', { ref:b.dataset.ghverder, actie:'verder' }); renderGroothandel(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ghweiger]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/groothandel/order/status', { ref:b.dataset.ghweiger, actie:'weiger' }); renderGroothandel(); } catch(e){ toast(e.message); }
    }));
    const nw = el.querySelector('.js-ghnew'); if (nw) nw.addEventListener('click', () => { ghEdit = { }; ghForm(cats); });
    el.querySelectorAll('.js-ghedit').forEach(b => b.addEventListener('click', () => { ghEdit = (d.producten||[]).find(p=>p.id===b.dataset.id) || {}; ghForm(cats); }));
    if (ghEdit) ghForm(cats);
  }
  function ghOrderKaart(o, open){
    const naam = o.klant ? (o.klant.naam || '') : '';
    return '<div style="border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.85rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;"><b style="flex:1;font-size:0.85rem;">'+esc(naam)+' · '+eur(o.subtotaal)+'</b>'+
      '<span class="sub">'+esc(o.soort)+(o.bron==='ai'?' · AI':'')+' · '+esc(o.status)+'</span></div>'+
      '<div class="sub">'+o.regels.map(r=>r.aantal+'× '+esc(r.naam)).join(', ')+'</div>'+
      (open ? '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><button data-ghverder="'+o.ref+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('gh.verder','Volgende stap')+'</button>'+
        '<button data-ghweiger="'+o.ref+'" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--soft);font-family:inherit;font-size:0.75rem;">'+T('gh.weiger','Weiger')+'</button></div>' : '')+'</div>';
  }
  function ghForm(cats){
    const el = $('#ghForm'); if (!el) return; const p = ghEdit || {};
    el.innerHTML = '<div style="border:1px solid var(--gold);border-radius:12px;padding:0.8rem;margin-top:0.5rem;">'+
      '<input id="ghNaam" class="st-in" placeholder="'+T('gh.f.naam','Productnaam')+'" value="'+esc(p.naam||'')+'" style="width:100%;margin-bottom:0.4rem;">'+
      '<div class="row-gap"><select id="ghCat" class="st-in" style="flex:1;">'+cats.map(c=>'<option'+(p.categorie===c?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+
      '<input id="ghEen" class="st-in" placeholder="'+T('gh.f.eenheid','Eenheid')+'" value="'+esc(p.eenheid||'stuk')+'" style="flex:1;"></div>'+
      '<div class="row-gap"><input id="ghIn" class="st-in" type="number" step="0.01" placeholder="'+T('gh.f.inkoop','Inkoopprijs')+'" value="'+(p.inkoopPrijs!=null?p.inkoopPrijs:'')+'" style="flex:1;"><input id="ghCon" class="st-in" type="number" step="0.01" placeholder="'+T('gh.f.consument','Consumentprijs')+'" value="'+(p.consumentPrijs!=null?p.consumentPrijs:'')+'" style="flex:1;"></div>'+
      '<div class="row-gap"><input id="ghVoor" class="st-in" type="number" placeholder="'+T('gh.f.voorraad','Voorraad')+'" value="'+(p.voorraad!=null?p.voorraad:'')+'" style="flex:1;"><input id="ghMin" class="st-in" type="number" placeholder="'+T('gh.f.min','Min. bestel')+'" value="'+(p.minBestel!=null?p.minBestel:1)+'" style="flex:1;"></div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><button id="ghSave" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('gh.opslaan','Opslaan')+'</button>'+
      '<button id="ghCancel" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.45rem 0.8rem;color:var(--soft);font-family:inherit;">'+T('gh.annuleer','Annuleer')+'</button></div></div>';
    $('#ghCancel').addEventListener('click', () => { ghEdit = null; renderGroothandel(); });
    $('#ghSave').addEventListener('click', async () => {
      const body = { id:p.id, naam:$('#ghNaam').value.trim(), categorie:$('#ghCat').value, eenheid:$('#ghEen').value.trim(),
        inkoopPrijs:$('#ghIn').value, consumentPrijs:$('#ghCon').value, voorraad:$('#ghVoor').value, minBestel:$('#ghMin').value };
      try { await API.call('/supplier/groothandel/product', body); ghEdit = null; toast(T('gh.opgeslagen','Product opgeslagen.')); renderGroothandel(); } catch(e){ toast(e.message); }
    });
  }

  // ---- inkoop: een horecazaak koopt in bij een groothandel (met AI-bijbestellen) ----
  let inkVoorstel = null;
  async function renderInkoop(){
    const el = $('#inkoopWrap'); if (!el) return;
    if (!has('menu')){ el.innerHTML = ''; return; }
    let markt, mijn;
    try { markt = await API.call('/supplier/inkoop/markt'); mijn = await API.call('/supplier/inkoop/mijn'); } catch(e){ return; }
    let h = '';
    for (const g of (markt.groothandels||[])){
      h += '<div style="border:1px solid var(--line);border-radius:14px;padding:0.85rem;margin-bottom:0.8rem;">'+
        '<div style="display:flex;gap:0.5rem;align-items:center;"><b style="flex:1;">'+esc(g.naam)+'</b>'+
        '<button class="js-inkai" data-code="'+g.code+'" style="background:var(--card2);border:1px solid var(--gold);border-radius:8px;padding:0.3rem 0.6rem;color:var(--gold);font-size:0.72rem;font-weight:600;font-family:inherit;">✨ '+T('ink.ai','AI-bijbestellen')+'</button></div>'+
        '<div id="inkai-'+g.code+'"></div>'+
        g.producten.slice(0,60).map(p => '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-top:1px solid var(--line);">'+
          '<div style="flex:1;"><span style="font-size:0.83rem;">'+esc(p.naam)+'</span><span class="sub"> · '+eur(p.prijs)+'/'+esc(p.eenheid)+'</span></div>'+
          '<input class="st-in js-inkq" data-code="'+g.code+'" data-pid="'+p.id+'" type="number" min="0" placeholder="0" style="width:4rem;text-align:center;"></div>').join('')+
        '<button class="js-inkbestel" data-code="'+g.code+'" style="width:100%;margin-top:0.5rem;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.5rem;font-weight:600;font-family:inherit;">'+T('ink.bestel','Bestellen')+'</button></div>';
    }
    if (!(markt.groothandels||[]).length) h += '<p class="sub">'+T('ink.geen','Geen groothandel beschikbaar voor inkoop.')+'</p>';
    // mijn bestellingen
    if ((mijn.bestellingen||[]).length){
      h += '<div class="st-sec">'+T('ink.mijn','Mijn inkooporders')+'</div>';
      h += mijn.bestellingen.slice(0,20).map(o => '<div style="border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.75rem;margin-bottom:0.4rem;"><div style="display:flex;gap:0.5rem;"><b style="flex:1;font-size:0.82rem;">'+esc(o.groothandelNaam)+' · '+eur(o.subtotaal)+'</b><span class="sub">'+esc(o.status)+(o.bron==='ai'?' · AI':'')+'</span></div><div class="sub">'+o.regels.map(r=>r.aantal+'× '+esc(r.naam)).join(', ')+'</div></div>').join('');
    }
    el.innerHTML = h;
    el.querySelectorAll('.js-inkbestel').forEach(b => b.addEventListener('click', () => inkBestel(b.dataset.code, false)));
    el.querySelectorAll('.js-inkai').forEach(b => b.addEventListener('click', () => inkAi(b.dataset.code)));
  }
  function inkRegels(code){
    const regels = [];
    document.querySelectorAll('.js-inkq[data-code="'+code+'"]').forEach(inp => { const a = Number(inp.value)||0; if (a>0) regels.push({ productId: inp.dataset.pid, aantal: a }); });
    return regels;
  }
  async function inkBestel(code){
    const regels = inkRegels(code);
    if (!regels.length) return toast(T('ink.kies','Vul minstens een aantal in.'));
    try { await API.call('/supplier/inkoop/bestel', { groothandelCode: code, regels }); toast(T('ink.besteld','Bestelling geplaatst.')); renderInkoop(); } catch(e){ toast(e.message); }
  }
  async function inkAi(code){
    const box = $('#inkai-'+code); if (box) box.innerHTML = '<p class="sub">'+T('ink.aidenkt','De AI kijkt naar uw verkoop en mise-en-place…')+'</p>';
    try {
      const v = await API.call('/supplier/inkoop/ai', { groothandelCode: code });
      inkVoorstel = v;
      if (!box) return;
      if (!v.regels.length){ box.innerHTML = '<p class="sub">'+esc(v.uitleg)+'</p>'; return; }
      box.innerHTML = '<div style="border:1px solid var(--gold);border-radius:10px;padding:0.6rem;margin:0.5rem 0;">'+
        '<div class="sub" style="margin-bottom:0.35rem;">'+esc(v.uitleg)+'</div>'+
        v.regels.map(r=>'<div class="sub">'+r.aantal+'× '+esc(r.naam)+' · '+eur(r.prijs)+' <span style="opacity:0.7;">('+esc(r.reden)+')</span></div>').join('')+
        '<button class="js-inkaiok" data-code="'+code+'" style="width:100%;margin-top:0.5rem;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('ink.aibevestig','Bijbestelling plaatsen')+'</button></div>';
      box.querySelector('.js-inkaiok').addEventListener('click', async () => {
        try { await API.call('/supplier/inkoop/ai-bevestig', { groothandelCode: code, regels: v.regels.map(r=>({productId:r.productId, aantal:r.aantal})) }); toast(T('ink.aiok','Bijbestelling geplaatst.')); renderInkoop(); } catch(e){ toast(e.message); }
      });
    } catch(e){ if (box) box.innerHTML = '<p class="sub">'+esc(e.message)+'</p>'; }
  }

  // ---- mode-bezorging: veilig laten bezorgen, in een tik op te zetten ----
  async function renderModeBezorg(){
    const el = $('#modeBezorgWrap'); if (!el) return;
    if (!has('retail')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/mode/bezorg/overzicht'); } catch(e){ el.innerHTML=''; return; }
    const ins = d.instellingen || { aan:false };
    let h = '<div class="st-sec" style="margin-top:1.4rem;">🛍️ '+T('mb.h','Veilige bezorgdienst')+'</div>';
    h += '<div style="border:1px solid var(--line);border-radius:12px;padding:0.8rem;margin-bottom:0.8rem;">'+
      '<label style="display:flex;align-items:center;gap:0.6rem;font-size:0.85rem;"><input type="checkbox" id="mbAan"'+(ins.aan?' checked':'')+'> '+T('mb.aan','Bezorgen aan (met bezorgcode, foto-bewijs en live volgen)')+'</label>'+
      '<div class="row-gap" style="margin-top:0.5rem;"><input id="mbKosten" class="st-in" type="number" step="0.5" placeholder="'+T('mb.kosten','Kosten €')+'" value="'+(ins.kosten!=null?ins.kosten:'')+'" style="flex:1;"><input id="mbGratis" class="st-in" type="number" placeholder="'+T('mb.gratis','Gratis vanaf €')+'" value="'+(ins.gratisVanaf!=null?ins.gratisVanaf:'')+'" style="flex:1;"><input id="mbId" class="st-in" type="number" placeholder="'+T('mb.idgrens','ID vanaf €')+'" value="'+(ins.waardegrensId!=null?ins.waardegrensId:'')+'" style="flex:1;"></div>'+
      '<button id="mbSave" style="width:100%;margin-top:0.5rem;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.5rem;font-weight:600;font-family:inherit;">'+T('mb.opslaan','Opslaan')+'</button></div>';
    // bezorgbord
    h += '<div class="st-sec">'+T('mb.bord','Bezorgingen')+' · '+T('mb.omzet','omzet')+' '+eur(d.omzet||0)+'</div>';
    h += (d.open||[]).length ? (d.open||[]).map(mbKaart).join('') : '<p class="sub">'+T('mb.geen','Geen open bezorgingen.')+'</p>';
    if ((d.afgerond||[]).length) h += '<details style="margin-top:0.5rem;"><summary class="sub" style="cursor:pointer;">'+T('mb.afgerond','Afgerond')+' ('+d.afgerond.length+')</summary>'+d.afgerond.map(mbKaart).join('')+'</details>';
    el.innerHTML = h;
    const save = $('#mbSave'); if (save) save.addEventListener('click', async () => {
      try { await API.call('/supplier/mode/bezorg/setup', { aan: $('#mbAan').checked, kosten:$('#mbKosten').value, gratisVanaf:$('#mbGratis').value, waardegrensId:$('#mbId').value }); toast(T('mb.opgeslagen','Bezorgdienst bijgewerkt.')); renderModeBezorg(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-mbneem]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/mode/bezorg/neem', { ref:b.dataset.mbneem }); renderModeBezorg(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-mbretour]').forEach(b => b.addEventListener('click', async () => { const r = prompt(T('mb.retourreden','Reden van retour?'),'Past niet'); if (r===null) return; try { await API.call('/supplier/mode/bezorg/retour', { ref:b.dataset.mbretour, reden:r }); renderModeBezorg(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-mbaf]').forEach(b => b.addEventListener('click', async () => {
      const code = prompt(T('mb.vraagcode','Bezorgcode van de klant (uit de app):')); if (!code) return;
      try { await API.call('/supplier/mode/bezorg/overhandig', { ref:b.dataset.mbaf, bezorgcode:code.trim(), idOk:true }); toast('✅ '+T('mb.afgeleverd','Veilig afgeleverd.')); renderModeBezorg(); } catch(e){ toast(e.message); }
    }));
  }
  function mbKaart(b){
    const done = ['afgeleverd','retour','geannuleerd'].includes(b.status);
    return '<div style="border:1px solid '+(b.status==='onderweg'?'var(--gold)':'var(--line)')+';border-radius:12px;padding:0.7rem 0.85rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;"><b style="flex:1;font-size:0.85rem;">'+esc(b.codenaam)+' · '+eur(b.waarde)+(b.kosten?' + '+eur(b.kosten):'')+'</b>'+
      '<span class="sub">'+esc(b.status)+(b.idVereist?' · 🪪':'')+'</span></div>'+
      '<div class="sub">'+b.items.map(i=>i.aantal+'× '+esc(i.naam)+(i.maat?' ('+esc(i.maat)+')':'')).join(', ')+' · '+esc(b.adres)+'</div>'+
      (b.koerier?'<div class="sub">'+T('mb.koerier','koerier')+': '+esc(b.koerier)+'</div>':'')+
      (!done ? '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;flex-wrap:wrap;">'+
        (b.status==='onderweg' ? '<button data-mbaf="'+b.ref+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('mb.afronden','Afronden (code)')+'</button>' :
          '<button data-mbneem="'+b.ref+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('mb.aannemen','Aannemen')+'</button>')+
        '<button data-mbretour="'+b.ref+'" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--soft);font-family:inherit;font-size:0.75rem;">'+T('mb.retour','Retour')+'</button></div>' : '')+'</div>';
  }

  // ---- autoverkoop: showroom + proefritten + koopaanvragen ----
  let vkAutoBewerk = null;
  async function renderVerkoop(){
    const el = $('#verkoopWrap'); if (!el) return;
    if (!has('huur')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/verkoop/overzicht'); } catch(e){ el.innerHTML=''; return; }
    let h = '<div style="border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;margin-bottom:0.9rem;"><label style="display:flex;align-items:center;gap:0.6rem;font-size:0.85rem;"><input type="checkbox" id="vkAan"'+(d.aan?' checked':'')+'> '+T('vk.aan','Autoverkoop aan (exclusieve showroom voor leden)')+'</label></div>';
    // open aanvragen
    h += '<div class="st-sec">'+T('vk.aanvragen','Aanvragen')+'</div>';
    h += (d.open||[]).length ? (d.open||[]).map(vkDeal).join('') : '<p class="sub">'+T('vk.geen','Geen open aanvragen.')+'</p>';
    // showroom
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('vk.showroom','Showroom')+' <button class="js-vknew" style="float:right;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.25rem 0.6rem;font-size:0.72rem;font-weight:600;font-family:inherit;">+ '+T('vk.nieuw','Auto toevoegen')+'</button></div><div id="vkForm"></div>';
    h += (d.showroom||[]).map(a => '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0;border-top:1px solid var(--line);">'+
      '<div style="flex:1;"><b style="font-size:0.85rem;">'+(a.vip?'★ ':'')+esc(a.naam)+'</b><span class="sub"> · '+eur(a.prijs)+' · '+a.km.toLocaleString('nl-NL')+' km · '+esc(a.brandstof)+'</span>'+
      '<div class="sub">'+esc(a.status)+(a.garantieMnd?' · '+a.garantieMnd+' mnd garantie':'')+'</div></div>'+
      '<button class="js-vkedit" data-id="'+a.id+'" style="background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:0.3rem 0.6rem;color:var(--txt);font-size:0.72rem;font-family:inherit;">'+T('vk.bewerk','Bewerk')+'</button></div>').join('');
    el.innerHTML = h;
    const aan = $('#vkAan'); if (aan) aan.addEventListener('change', async () => { try { await API.call('/supplier/verkoop/aan', { aan: aan.checked }); renderVerkoop(); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-vkplan]').forEach(b => b.addEventListener('click', async () => { const m = prompt(T('vk.moment','Wanneer? (bv. za 10:00)')); if(m===null) return; try { await API.call('/supplier/verkoop/deal', { ref:b.dataset.vkplan, actie:'plan', moment:m }); renderVerkoop(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-vkact]').forEach(b => b.addEventListener('click', async () => {
      const actie = b.dataset.act; const body = { ref:b.dataset.vkact, actie };
      if (actie==='aanvaard'){ const p = prompt(T('vk.tegenbod','Verkoopprijs bevestigen of tegenbod (€):'), b.dataset.prijs||''); if(p===null) return; body.prijs = p; if (b.dataset.inruil==='1'){ const t = prompt(T('vk.taxatie','Inruil taxeren op (€):'),'0'); if(t!==null) body.taxatie = t; } }
      try { await API.call('/supplier/verkoop/deal', body); renderVerkoop(); } catch(e){ toast(e.message); }
    }));
    const nw = el.querySelector('.js-vknew'); if (nw) nw.addEventListener('click', () => { vkAutoBewerk = {}; vkForm(d.brandstoffen||[]); });
    el.querySelectorAll('.js-vkedit').forEach(b => b.addEventListener('click', () => { vkAutoBewerk = (d.showroom||[]).find(a=>a.id===b.dataset.id) || {}; vkForm(d.brandstoffen||[]); }));
    if (vkAutoBewerk) vkForm(d.brandstoffen||[]);
  }
  function vkDeal(d){
    const koop = d.soort==='koop';
    let acties = '';
    if (koop){
      if (d.status==='aangevraagd') acties = '<button class="js-vkact" data-vkact="'+d.ref+'" data-act="aanvaard" data-prijs="'+(d.prijs||'')+'" data-inruil="'+(d.inruil?1:0)+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('vk.aanvaard','Aanvaarden')+'</button>';
      else if (d.status==='getekend') acties = '<button class="js-vkact" data-vkact="'+d.ref+'" data-act="afgeleverd" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('vk.aflever','Afgeleverd')+'</button>';
      else acties = '<span class="sub" style="flex:1;align-self:center;">'+T('vk.wacht','wacht op tekenen')+'</span>';
    } else {
      if (d.status==='aangevraagd') acties = '<button data-vkplan="'+d.ref+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('vk.plan','Inplannen')+'</button>';
      else if (d.status==='ingepland') acties = '<button class="js-vkact" data-vkact="'+d.ref+'" data-act="gereden" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('vk.gereden','Gereden')+'</button>';
    }
    return '<div style="border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.85rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;"><b style="flex:1;font-size:0.85rem;">'+(koop?'🔑 ':'🚗 ')+esc(d.autoNaam)+'</b><span class="sub">'+esc(d.codenaam)+' · '+esc(d.status)+'</span></div>'+
      '<div class="sub">'+(koop? (T('vk.bod','bod')+' '+eur(d.bod||0)+(d.inruil?' · '+T('vk.inruil','inruil')+' '+esc([d.inruil.merk,d.inruil.model].filter(Boolean).join(' ')):'')+(d.concierge?' · '+T('vk.concierge','concierge')+' '+esc(d.adres||''):'')) : (d.wens?esc(d.wens):T('vk.proefrit','proefrit'))+(d.moment?' · '+esc(d.moment):''))+'</div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;">'+acties+'<button class="js-vkact" data-vkact="'+d.ref+'" data-act="afwijs" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--soft);font-family:inherit;font-size:0.75rem;">'+T('vk.afwijs','Afwijzen')+'</button></div></div>';
  }
  function vkForm(brandstoffen){
    const el = $('#vkForm'); if (!el) return; const a = vkAutoBewerk || {};
    el.innerHTML = '<div style="border:1px solid var(--gold);border-radius:12px;padding:0.8rem;margin-top:0.5rem;">'+
      '<div class="row-gap"><input id="vkMerk" class="st-in" placeholder="'+T('vk.f.merk','Merk')+'" value="'+esc(a.merk||'')+'" style="flex:1;"><input id="vkModel" class="st-in" placeholder="'+T('vk.f.model','Model')+'" value="'+esc(a.model||'')+'" style="flex:1;"></div>'+
      '<div class="row-gap"><input id="vkJaar" class="st-in" type="number" placeholder="'+T('vk.f.jaar','Jaar')+'" value="'+(a.jaar||'')+'" style="flex:1;"><input id="vkKm" class="st-in" type="number" placeholder="'+T('vk.f.km','Km')+'" value="'+(a.km!=null?a.km:'')+'" style="flex:1;"><input id="vkPrijs" class="st-in" type="number" placeholder="'+T('vk.f.prijs','Prijs €')+'" value="'+(a.prijs!=null?a.prijs:'')+'" style="flex:1;"></div>'+
      '<div class="row-gap"><select id="vkBr" class="st-in" style="flex:1;">'+(brandstoffen||['Benzine']).map(b=>'<option'+(a.brandstof===b?' selected':'')+'>'+esc(b)+'</option>').join('')+'</select><input id="vkPk" class="st-in" type="number" placeholder="'+T('vk.f.pk','Pk')+'" value="'+(a.vermogenPk||'')+'" style="flex:1;"><input id="vkGar" class="st-in" type="number" placeholder="'+T('vk.f.garantie','Garantie mnd')+'" value="'+(a.garantieMnd!=null?a.garantieMnd:12)+'" style="flex:1;"></div>'+
      '<input id="vkHist" class="st-in" placeholder="'+T('vk.f.historie','Historie / bijzonderheden')+'" value="'+esc(a.historie||'')+'" style="width:100%;">'+
      '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;margin:0.3rem 0;"><input type="checkbox" id="vkVip"'+(a.vip?' checked':'')+'> '+T('vk.f.vip','VIP / exclusief (bovenaan)')+'</label>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.4rem;"><button id="vkSave" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('vk.opslaan','Opslaan')+'</button>'+
      '<button id="vkCancel" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.45rem 0.8rem;color:var(--soft);font-family:inherit;">'+T('vk.annuleer','Annuleer')+'</button></div></div>';
    $('#vkCancel').addEventListener('click', () => { vkAutoBewerk = null; renderVerkoop(); });
    $('#vkSave').addEventListener('click', async () => {
      const body = { id:a.id, merk:$('#vkMerk').value.trim(), model:$('#vkModel').value.trim(), jaar:$('#vkJaar').value, km:$('#vkKm').value,
        prijs:$('#vkPrijs').value, brandstof:$('#vkBr').value, vermogenPk:$('#vkPk').value, garantieMnd:$('#vkGar').value,
        historie:$('#vkHist').value.trim(), vip:$('#vkVip').checked };
      try { await API.call('/supplier/verkoop/auto', body); vkAutoBewerk = null; toast(T('vk.opgeslagen','Auto opgeslagen.')); renderVerkoop(); } catch(e){ toast(e.message); }
    });
  }

