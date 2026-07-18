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
