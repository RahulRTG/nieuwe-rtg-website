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
  const PLAT_ICO = { instagram:'', tiktok:'', youtube:'▶', x:'𝕏', twitch:'', podcast:'', blog:'' };
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
    html += '<div class="card"><div class="tt-h">'+T('cr.profiel','Profiel')+'</div>'+
      (canEdit ? '<div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem;"><input id="crNiche" placeholder="'+T('cr.niche','Niche (bijv. Reizen & lifestyle)')+'" value="'+escAttr(o.niche||'')+'" '+inp+'><textarea id="crBio" placeholder="'+T('cr.bio','Korte bio')+'" '+inp+' rows="2">'+esc(o.bio||'')+'</textarea><button class="obtn primary" id="crProfielOp" style="align-self:flex-start;">'+T('cr.opslaan','Opslaan')+'</button></div>'
        : '<div style="margin-top:0.4rem;"><b>'+esc(o.niche||'')+'</b><div class="ds">'+esc(o.bio||'')+'</div></div>')+'</div>';
    // stats
    const tiles = [[kort(st.bereik||0), T('cr.bereik','totaal bereik')],[st.platforms||0, T('cr.platforms','platforms')],[st.teProduceren||0, T('cr.productie','in productie')],[st.gepost||0, T('cr.gepost','gepost')],['€ '+(st.gemTarief||0), T('cr.gemtarief','gem. tarief')],[st.portfolio||0, T('cr.portfolio','portfolio')]];
    html += '<div class="card"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;">'+
      tiles.map(c => '<div style="background:var(--card2,var(--card));border:1px solid var(--line);border-radius:12px;padding:0.6rem;text-align:center;"><div style="font-size:1.1rem;font-weight:700;color:var(--gold);">'+c[0]+'</div><div style="font-size:0.6rem;color:var(--soft);text-transform:uppercase;letter-spacing:0.05em;">'+c[1]+'</div></div>').join('')+'</div></div>';
