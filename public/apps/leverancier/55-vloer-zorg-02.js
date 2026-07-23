    const zi = wrap.querySelector('#wvZoek'); if (zi) zi.addEventListener('keydown', e => { if (e.key === 'Enter') doeZoek(); });
    wrap.querySelectorAll('[data-wvbreng]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/retail/paskamer/breng', { id: b.dataset.wvbreng }); toast(T('wv.gebracht','Gebracht.')); await laadWinkelvloer(); } catch(e){ toast(e.message); }
    }));
    const kb = wrap.querySelector('#wvKlantBtn');
    const openKlant = async () => {
      const key = wrap.querySelector('#wvKlantKey').value.trim(); if (!key) return;
      try { wvKlant = (await API.call('/supplier/retail/klant', { key })).klant; renderWinkelvloer(); }
      catch(e){ toast(e.message); }
    };
    if (kb) kb.addEventListener('click', openKlant);
    const ki = wrap.querySelector('#wvKlantKey'); if (ki) ki.addEventListener('keydown', e => { if (e.key === 'Enter') openKlant(); });
  }

  // ---- de zorgbalie: de behandelaar-agenda van een spa of kliniek ----
  let zbLev = null, zbLevDatum = null;
  async function laadZorgbalieLev(){
    if (!has('care') || !API.live) return;
    try { zbLev = await API.call('/supplier/care/agenda', zbLevDatum ? { datum: zbLevDatum } : {}); }
    catch(e){ zbLev = null; }
    renderZorgbalieLev();
  }
  function renderZorgbalieLev(){
    const wrap = $('#zbWrap'); if (!wrap) return;
    if (!has('care')){ wrap.innerHTML = ''; return; }
    if (!zbLev){ wrap.innerHTML = '<div class="empty">…</div>'; laadZorgbalieLev(); return; }
    const dagen = [];
    for (let i = 0; i < 7; i++){
      const dt = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
      const aan = dt === zbLev.datum;
      dagen.push('<button class="obtn'+(aan?' primary':'')+'" data-zblevdag="'+dt+'"'+(aan?' aria-current="date"':'')+'>'+
        (i===0 ? T('zb.vandaag','vandaag') : dt.slice(8)+'/'+dt.slice(5,7))+'</button>');
    }
    const perBehandelaar = (zbLev.behandelaars || []).map(b => {
      const eigen = (zbLev.afspraken || []).filter(a => a.behandelaarId === b.id);
      return '<div class="card"><div class="tt-h">'+esc(b.naam)+' · '+esc(b.functie)+'</div>'+
        (eigen.length ? eigen.map(a =>
          '<div class="mitem"><div class="r1"><span class="nm" style="font-variant-numeric:tabular-nums;">'+(a.soort==='medisch'?'':'')+' '+esc(a.tijd)+' · '+esc(a.behandelingNaam)+'</span><span class="pr">'+eur(a.prijs)+'</span></div>'+
          '<div class="ds">'+T('zb.gast','Gast')+': '+esc(a.codenaam || '')+' · '+a.duurMin+' min</div>'+
          (a.zorg ? '<div class="ds" style="color:#E2B93B;">'+esc([((a.zorg.allergenen||[]).length?T('zb.allergie','Allergie')+': '+a.zorg.allergenen.join(', '):''), a.zorg.dieet, a.zorg.medisch].filter(Boolean).join(' · '))+'</div>' : '')+
          (a.intake ? '<div class="ds" style="color:#E2B93B;">'+esc(a.intake)+'</div>' : '')+
          (a.status === 'afgerond' ? '<div class="ds" style="color:var(--green,#4C9A75);">'+T('zb.klaar','Afgerond')+'</div>'
            : '<button class="obtn primary" data-zblevklaar="'+esc(a.ref)+'" style="margin-top:0.35rem;">'+T('zb.afronden','Afronden')+'</button>')+
          '</div>').join('')
        : '<div class="empty">'+T('zb.leeg','Geen afspraken op deze dag.')+'</div>')+
      '</div>';
    }).join('');
    wrap.innerHTML = '<div class="card"><div class="tt-h">'+esc(zbLev.aanbieder || '')+'</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.55rem;">'+dagen.join('')+'</div></div>' + perBehandelaar;
    wrap.querySelectorAll('[data-zblevdag]').forEach(b => b.addEventListener('click', () => { zbLevDatum = b.dataset.zblevdag; laadZorgbalieLev(); }));
    wrap.querySelectorAll('[data-zblevklaar]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/care/afronden', { ref: b.dataset.zblevklaar }); toast(''+T('zb.klaar','Afgerond')); laadZorgbalieLev(); }
      catch(e){ toast(e.message); }
    }));
  }
