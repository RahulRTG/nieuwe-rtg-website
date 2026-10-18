/* de inkoop-AI: wat is er nodig bij deze groothandel */
    const box = $('#inkai-'+code); if (box) box.innerHTML = '<p class="sub">'+T('ink.aidenkt','De AI kijkt naar uw verkoop en mise-en-place…')+'</p>';
    try {
      const v = await API.call('/supplier/inkoop/ai', { groothandelCode: code });
      inkVoorstel = v;
      if (!box) return;
      if (!v.regels.length){ box.innerHTML = '<p class="sub">'+esc(v.uitleg)+'</p>'; return; }
      box.innerHTML = '<div class="s-1ej7ge6">'+
        '<div class="sub" style="margin-bottom:0.35rem;">'+esc(v.uitleg)+'</div>'+
        v.regels.map(r=>'<div class="sub">'+r.aantal+'× '+esc(r.naam)+' · '+eur(r.prijs)+' <span style="opacity:0.7;">('+esc(r.reden)+')</span></div>').join('')+
        '<button class="js-inkaiok s-14rskzv" data-code="'+code+'">'+T('ink.aibevestig','Bijbestelling plaatsen')+'</button></div>';
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
    let h = '<div class="st-sec h-mt140">'+T('mb.h','Veilige bezorgdienst')+'</div>';
    h += '<div class="s-1sjhzq7">'+
      '<label class="s-86dceh"><input type="checkbox" id="mbAan"'+(ins.aan?' checked':'')+'> '+T('mb.aan','Bezorgen aan (met bezorgcode, foto-bewijs en live volgen)')+'</label>'+
      '<div class="row-gap h-mt50"><input id="mbKosten" class="st-in h-flex1" type="number" step="0.5" placeholder="'+T('mb.kosten','Kosten €')+'" value="'+(ins.kosten!=null?ins.kosten:'')+'"><input id="mbGratis" class="st-in h-flex1" type="number" placeholder="'+T('mb.gratis','Gratis vanaf €')+'" value="'+(ins.gratisVanaf!=null?ins.gratisVanaf:'')+'"><input id="mbId" class="st-in h-flex1" type="number" placeholder="'+T('mb.idgrens','ID vanaf €')+'" value="'+(ins.waardegrensId!=null?ins.waardegrensId:'')+'"></div>'+
      '<button id="mbSave" class="s-ie5m1d">'+T('mb.opslaan','Opslaan')+'</button></div>';
    // bezorgbord
    h += '<div class="st-sec">'+T('mb.bord','Bezorgingen')+' · '+T('mb.omzet','omzet')+' '+eur(d.omzet||0)+'</div>';
    h += (d.open||[]).length ? (d.open||[]).map(mbKaart).join('') : '<p class="sub">'+T('mb.geen','Geen open bezorgingen.')+'</p>';
    if ((d.afgerond||[]).length) h += '<details class="h-mt50"><summary class="sub" style="cursor:pointer;">'+T('mb.afgerond','Afgerond')+' ('+d.afgerond.length+')</summary>'+d.afgerond.map(mbKaart).join('')+'</details>';
    el.innerHTML = h;
    const save = $('#mbSave'); if (save) save.addEventListener('click', async () => {
      try { await API.call('/supplier/mode/bezorg/setup', { aan: $('#mbAan').checked, kosten:$('#mbKosten').value, gratisVanaf:$('#mbGratis').value, waardegrensId:$('#mbId').value }); toast(T('mb.opgeslagen','Bezorgdienst bijgewerkt.')); renderModeBezorg(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-mbneem]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/mode/bezorg/neem', { ref:b.dataset.mbneem }); renderModeBezorg(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-mbretour]').forEach(b => b.addEventListener('click', async () => { const r = prompt(T('mb.retourreden','Reden van retour?'),'Past niet'); if (r===null) return; try { await API.call('/supplier/mode/bezorg/retour', { ref:b.dataset.mbretour, reden:r }); renderModeBezorg(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-mbaf]').forEach(b => b.addEventListener('click', async () => {
      const code = prompt(T('mb.vraagcode','Bezorgcode van de klant (uit de app):')); if (!code) return;
      try { await API.call('/supplier/mode/bezorg/overhandig', { ref:b.dataset.mbaf, bezorgcode:code.trim(), idOk:true }); toast(''+T('mb.afgeleverd','Veilig afgeleverd.')); renderModeBezorg(); } catch(e){ toast(e.message); }
    }));
  }
  function mbKaart(b){
    const done = ['afgeleverd','retour','geannuleerd'].includes(b.status);
    return '<div class="' + (b.status==='onderweg' ? 's-18tbc4' : 's-1aizwhk') + '">'+
      '<div class="s-1x93s7l"><b class="s-1q6kbkp">'+esc(b.codenaam)+' · '+eur(b.waarde)+(b.kosten?' + '+eur(b.kosten):'')+'</b>'+
      '<span class="sub">'+esc(b.status)+(b.idVereist?' · ':'')+'</span></div>'+
      '<div class="sub">'+b.items.map(i=>i.aantal+'× '+esc(i.naam)+(i.maat?' ('+esc(i.maat)+')':'')).join(', ')+' · '+esc(b.adres)+'</div>'+
      (b.koerier?'<div class="sub">'+T('mb.koerier','koerier')+': '+esc(b.koerier)+'</div>':'')+
      (!done ? '<div class="s-1e47xc3">'+
        (b.status==='onderweg' ? '<button data-mbaf="'+b.ref+'" class="s-7o62ce">'+T('mb.afronden','Afronden (code)')+'</button>' :
          '<button data-mbneem="'+b.ref+'" class="s-7o62ce">'+T('mb.aannemen','Aannemen')+'</button>')+
        '<button data-mbretour="'+b.ref+'" class="s-1gth2jo">'+T('mb.retour','Retour')+'</button></div>' : '')+'</div>';
  }

  // ---- autoverkoop: showroom + proefritten + koopaanvragen ----
  let vkAutoBewerk = null;
  async function renderVerkoop(){
    const el = $('#verkoopWrap'); if (!el) return;
    if (!has('huur')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/verkoop/overzicht'); } catch(e){ el.innerHTML=''; return; }
    let h = '<div class="s-fjc5rs"><label class="s-86dceh"><input type="checkbox" id="vkAan"'+(d.aan?' checked':'')+'> '+T('vk.aan','Autoverkoop aan (exclusieve showroom voor leden)')+'</label></div>';
    // open aanvragen
    h += '<div class="st-sec">'+T('vk.aanvragen','Aanvragen')+'</div>';
    h += (d.open||[]).length ? (d.open||[]).map(vkDeal).join('') : '<p class="sub">'+T('vk.geen','Geen open aanvragen.')+'</p>';
    // showroom
    h += '<div class="st-sec h-mt100">'+T('vk.showroom','Showroom')+' <button class="js-vknew s-2vt4hk">+ '+T('vk.nieuw','Auto toevoegen')+'</button></div><div id="vkForm"></div>';
    h += (d.showroom||[]).map(a => '<div class="s-wx1jrq">'+
      '<div class="h-flex1"><b class="s-2txdhg">'+(a.vip?'':'')+esc(a.naam)+'</b><span class="sub"> · '+eur(a.prijs)+' · '+a.km.toLocaleString('nl-NL')+' km · '+esc(a.brandstof)+'</span>'+
      '<div class="sub">'+esc(a.status)+(a.garantieMnd?' · '+a.garantieMnd+' mnd garantie':'')+'</div></div>'+
      '<button class="js-vkedit s-nvw2hz" data-id="'+a.id+'">'+T('vk.bewerk','Bewerk')+'</button></div>').join('');
    el.innerHTML = h;
    const aan = $('#vkAan'); if (aan) aan.addEventListener('change', async () => { try { await API.call('/supplier/verkoop/aan', { aan: aan.checked }); renderVerkoop(); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-vkplan]').forEach(b => b.addEventListener('click', async () => { const m = prompt(T('vk.moment','Wanneer? (bv. za 10:00)')); if(m===null) return; try { await API.call('/supplier/verkoop/deal', { ref:b.dataset.vkplan, actie:'plan', moment:m }); renderVerkoop(); } catch(e){ toast(e.message); } }));
