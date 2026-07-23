      const eigen = (zbData.afspraken || []).filter(a => a.behandelaarId === b.id);
      return '<div class="card"><div class="k">'+esc(b.naam)+' · '+esc(b.functie)+'</div>'+
        (eigen.length ? eigen.map(a =>
          '<div class="task"><span class="ic">'+(a.soort==='medisch'?'':'')+'</span><div class="t">'+
            '<b style="font-variant-numeric:tabular-nums;">'+esc(a.tijd)+' · '+esc(a.behandelingNaam)+'</b>'+
            '<span>'+T('pd.zb.gast','Gast')+': '+esc(a.codenaam || '')+' · '+a.duurMin+' min · '+eur(a.prijs)+'</span>'+
            (a.zorg ? '<span style="display:block;color:#E2B93B;">'+esc(pkZorg(a.zorg))+'</span>' : '')+
            (a.intake ? '<span style="display:block;color:#E2B93B;">'+esc(a.intake)+'</span>' : '')+
          '</div>'+
          (a.status === 'afgerond' ? '<span class="pill g">'+T('pd.zb.klaar','Afgerond')+'</span>'
            : '<button class="abtn" data-zbklaar="'+esc(a.ref)+'">'+T('pd.zb.afronden','Afronden')+'</button>')+
          '</div>').join('')
        : '<div style="margin-top:0.5rem;color:var(--soft);font-size:0.8rem;">'+T('pd.zb.leeg','Geen afspraken op deze dag.')+'</div>')+
      '</div>';
    }).join('');
    wrap.innerHTML = '<div class="card"><div class="k">'+esc(zbData.aanbieder || '')+'</div>'+
      '<div class="row" style="flex-wrap:wrap;margin-top:0.5rem;">'+dagen.join('')+'</div></div>' + perBehandelaar;
    wrap.querySelectorAll('[data-zbdag]').forEach(b => b.addEventListener('click', () => { zbDatum = b.dataset.zbdag; laadZorgbalie(); }));
    wrap.querySelectorAll('[data-zbklaar]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/care/afronden', { ref: b.dataset.zbklaar }); toast(T('pd.zb.klaar','Afgerond') + ' '); laadZorgbalie(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- de meldkamer op de PDA: het korps in de binnenzak ----------
     Voor de hulpdiensten (politie, brandweer, ambulance, special forces) de
     open meldingen met de veld-knoppen (ter plaatse, afronden); voor de
     zorg-zaken de medische receptie en de eerste hulp. De tab verschijnt
     alleen als de zaak een korps of zorg-zaak is. */
  let mkHulp = null, mkZorg = null, mkKeten = null, mkKanaal = 'keten', mkGesprek = null;
  async function laadMeldkamerPda(){
    if (!API.token) return;
    try { mkHulp = await API.call('/supplier/hulp/overzicht'); } catch(e){ mkHulp = null; }
    try { mkZorg = await API.call('/supplier/zorg/overzicht'); } catch(e){ mkZorg = null; }
    try { mkKeten = await API.call('/supplier/keten/status'); } catch(e){ mkKeten = null; }
    if (mkKeten && (mkKeten.kanalen || []).length){
      if (!mkKeten.kanalen.some(k => k.id === mkKanaal)) mkKanaal = mkKeten.kanalen[0].id;
      try { mkGesprek = await API.call('/supplier/keten/gesprek', { kanaal: mkKanaal }); } catch(e){ mkGesprek = null; }
    } else mkGesprek = null;
    renderMeldkamerPda();
  }
  function renderMeldkamerPda(){
    const tabBtn = document.getElementById('tabMeldkamer');
    if (tabBtn) tabBtn.style.display = (mkHulp || mkZorg) ? '' : 'none';
    const wrap = $('#meldkamerWrap');
    if (!wrap) return;
    if (!mkHulp && !mkZorg){ wrap.innerHTML = ''; return; }
    let html = '';
    if (mkHulp){
      const open = [...(mkHulp.bijstand || []), ...(mkHulp.meldingen || []).filter(m => m.status !== 'afgerond')];
      html += '<div class="card"><div class="k">'+esc(mkHulp.korps.naam)+' · '+(mkHulp.open || 0)+' '+T('pd.mk.open','open')+'</div>'+
        (open.length ? open.map(m =>
          '<div class="task"><span class="ic">'+(m.prio === 1 ? '' : m.prio === 2 ? '' : '')+'</span><div class="t"><b>'+esc(m.tekst)+'</b>'+
          '<span>'+(m.plek ? esc(m.plek)+' · ' : '')+esc(m.status)+'</span></div>'+
          '<button class="abtn ghost" data-mkst="ter-plaatse" data-mkm="'+m.id+'">'+T('pd.mk.tp','Ter plaatse')+'</button>'+
          '<button class="abtn" data-mkst="afgerond" data-mkm="'+m.id+'">'+T('pd.mk.af','Rond af')+'</button></div>').join('')
        : '<div style="font-size:0.8rem;color:var(--soft);">'+T('pd.mk.rustig','Geen open meldingen; rustig op het bord.')+'</div>')+
        '<div style="margin-top:0.5rem;font-size:0.75rem;color:var(--soft);">'+(mkHulp.eenheden || []).map(e => e.naam+' ('+e.status+')').join(' · ')+'</div></div>';
    }
    if (mkZorg && mkZorg.receptie){
      html += '<div class="card"><div class="k">'+T('pd.mk.receptie','Medische receptie')+'</div>'+
        (mkZorg.receptie.length ? mkZorg.receptie.map(p =>
          '<div class="task"><span class="ic"></span><div class="t"><b>'+esc(p.aanduiding)+'</b><span>'+esc(p.status)+(p.kamer ? ' ('+esc(p.kamer)+')' : '')+'</span></div>'+
          (p.status === 'wacht' ? '<button class="abtn" data-mkroep="'+p.id+'">'+T('pd.mk.roep','Roep op')+'</button>' : '')+
          '<button class="abtn ghost" data-mkpk="'+p.id+'">'+T('pd.mk.klaar','Klaar')+'</button></div>').join('')
        : '<div style="font-size:0.8rem;color:var(--soft);">'+T('pd.mk.wkleeg','De wachtkamer is leeg.')+'</div>')+'</div>';
    }
    if (mkZorg && mkZorg.seh){
      html += '<div class="card"><div class="k">'+T('pd.mk.seh','Eerste hulp')+' · '+mkZorg.seh.length+' '+T('pd.mk.inrij','in de rij')+'</div>'+
        mkZorg.seh.slice(0, 6).map(p => '<div class="task"><span class="ic">'+({rood:'',oranje:'',geel:'',groen:'',blauw:''}[p.triage]||'')+'</span><div class="t"><b>'+esc(p.klacht)+'</b><span>'+esc(p.status)+' · via '+esc(p.via)+'</span></div></div>').join('')+'</div>';
    }
    // de ketenchat: het gedeelde kanaal en de eigen besloten groepen
    if (mkKeten && (mkKeten.kanalen || []).length){
      html += '<div class="card"><div class="k">'+T('pd.mk.keten','Ketenchat')+'</div>'+
        '<div class="row" style="flex-wrap:wrap;margin-top:0.4rem;">'+mkKeten.kanalen.map(k =>
          '<button class="abtn '+(k.id===mkKanaal?'':'ghost')+'" data-mkkan="'+k.id+'"'+(k.id===mkKanaal?' aria-current="true"':'')+'>'+esc(k.naam)+'</button>').join('')+'</div>'+
        '<div class="chat" style="margin-top:0.4rem;">'+((mkGesprek && mkGesprek.berichten) || []).slice(-15).map(m =>
          '<div class="msg other"><span class="who">'+esc(m.van)+' · '+esc(m.korpsNaam || m.korps)+'</span>'+esc(m.tekst)+'</div>').join('')+'</div>'+
        (mkGesprek && mkGesprek.magSchrijven === false
          ? '<div style="font-size:0.75rem;color:var(--soft);margin-top:0.3rem;">'+T('pd.mk.meekijk','U kijkt mee als meldkamer; alleen de leden schrijven.')+'</div>'
          : '<div class="compose" style="margin-top:0.4rem;"><input id="mkMsg" placeholder="'+T('pd.mk.msg','Bericht aan de keten')+'" maxlength="500"><button id="mkSend">'+T('pd.send','Stuur')+'</button></div>')+
        '</div>';
    }
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-mkkan]').forEach(b => b.addEventListener('click', () => { mkKanaal = b.dataset.mkkan; laadMeldkamerPda(); }));
    const mkSend = wrap.querySelector('#mkSend');
    if (mkSend) mkSend.addEventListener('click', async () => {
      const i = wrap.querySelector('#mkMsg'); const t = (i.value || '').trim(); if (!t) return; i.value = '';
      try { await API.call('/supplier/keten/bericht', { kanaal: mkKanaal, tekst: t }); laadMeldkamerPda(); } catch(e){ toast(e.message); }
    });
    wrap.querySelectorAll('[data-mkm]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/hulp/melding/status', { melding: b.dataset.mkm, status: b.dataset.mkst }); toast(''); laadMeldkamerPda(); }
      catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-mkroep]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/zorg/receptie/roep', { id: b.dataset.mkroep }); laadMeldkamerPda(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-mkpk]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/zorg/receptie/klaar', { id: b.dataset.mkpk }); laadMeldkamerPda(); } catch(e){ toast(e.message); }
    }));
  }

