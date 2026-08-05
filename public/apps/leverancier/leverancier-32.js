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
        : '<div class="h-mt40"><b>'+esc(o.niche||'')+'</b><div class="ds">'+esc(o.bio||'')+'</div></div>')+'</div>';
    // stats
    const tiles = [[kort(st.bereik||0), T('cr.bereik','totaal bereik')],[st.platforms||0, T('cr.platforms','platforms')],[st.teProduceren||0, T('cr.productie','in productie')],[st.gepost||0, T('cr.gepost','gepost')],['€ '+(st.gemTarief||0), T('cr.gemtarief','gem. tarief')],[st.portfolio||0, T('cr.portfolio','portfolio')]];
    html += '<div class="card"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;">'+
      tiles.map(c => '<div style="background:var(--card2,var(--card));border:1px solid var(--line);border-radius:12px;padding:0.6rem;text-align:center;"><div style="font-size:1.1rem;font-weight:700;color:var(--gold);">'+c[0]+'</div><div style="font-size:0.6rem;color:var(--soft);text-transform:uppercase;letter-spacing:0.05em;">'+c[1]+'</div></div>').join('')+'</div></div>';
    // platforms
    html += '<div class="card"><div class="tt-h">'+T('cr.platf','Platforms & bereik')+'</div>'+
      (o.platforms||[]).map(p => '<div class="mitem"><div class="r1"><span class="nm">'+(PLAT_ICO[p.platform]||'')+' '+esc(p.handle||p.platform)+'</span><span class="pr">'+kort(p.volgers||0)+'</span></div>'+
        (canEdit?'<div style="margin-top:0.35rem;display:flex;gap:0.4rem;"><input type="number" min="0" data-pfvin="'+p.id+'" value="'+(p.volgers||0)+'" style="width:7rem;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:0.3rem 0.5rem;color:var(--txt);"><button class="obtn" data-pfvset="'+p.id+'">'+T('cr.volgersop','Bereik')+'</button><button class="rr-del" data-pfdel="'+p.id+'">✕</button></div>':'')+'</div>').join('')+
      (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><select id="crPfPlat" style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;color:var(--txt);">'+o.platformkeuze.map(p=>'<option value="'+p+'">'+(PLAT_ICO[p]||'')+' '+p+'</option>').join('')+'</select><input id="crPfHandle" placeholder="@handle" '+inp+' style="flex:1;min-width:7rem;"><input id="crPfVolg" type="number" min="0" placeholder="'+T('cr.volgers','volgers')+'" style="width:6rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;color:var(--txt);"><button class="obtn primary" id="crPfAdd">+</button></div>' : '')+'</div>';
    // tarieven
    html += '<div class="card"><div class="tt-h">'+T('cr.tarieven','Tarieven')+'</div>'+
      (o.tarieven||[]).map(t => '<div class="mitem"><div class="r1"><span class="nm">'+esc(t.soort)+'</span><span class="pr">€ '+(t.prijs||0)+(canEdit?' <button class="rr-del" data-trdel="'+t.id+'">✕</button>':'')+'</span></div></div>').join('')+
      (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><select id="crTrSoort" style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;color:var(--txt);">'+o.soortkeuze.map(x=>'<option value="'+x+'">'+x+'</option>').join('')+'</select><input id="crTrPrijs" type="number" min="0" placeholder="€" style="width:6rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;color:var(--txt);"><button class="obtn primary" id="crTrAdd">+</button></div>' : '')+'</div>';
    // content-kalender
    html += '<div class="card"><div class="tt-h">'+T('cr.kalender','Content-kalender')+'</div>'+
      (o.ideeen||[]).map(i => '<div class="mitem" style="border-left:3px solid '+(IDEE_KL[i.status]||'var(--soft)')+';"><div class="r1"><span class="nm">'+esc(i.tekst)+'</span>'+(i.voor?'<span class="pr" style="color:var(--soft);">'+esc(i.voor)+'</span>':'')+'</div>'+
        '<div class="ds">'+T('cr.status.'+i.status, i.status)+(i.script?' ·  '+T('cr.heeftscript','script klaar'):'')+'</div>'+
        (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;">'+
          (i.status!=='productie'?'<button class="obtn" data-ideest="'+i.id+'" data-st="productie">▶ '+T('cr.naarprod','In productie')+'</button>':'')+
          (i.status!=='gepost'?'<button class="obtn primary" data-ideest="'+i.id+'" data-st="gepost">✓ '+T('cr.naargepost','Gepost')+'</button>':'')+
          (i.script?'<button class="obtn" data-ideescript="'+i.id+'">'+T('cr.bekijkscript','Script')+'</button>':'')+
          '<button class="rr-del" data-ideedel="'+i.id+'">✕</button></div>':'')+
        '<div class="crScript" data-scriptbox="'+i.id+'" style="display:none;white-space:pre-wrap;font-size:0.8rem;color:var(--soft);margin-top:0.4rem;border-top:1px solid var(--line);padding-top:0.4rem;">'+esc(i.script||'')+'</div></div>').join('')+
      (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><input id="crIdTekst" placeholder="'+T('cr.nieuwidee','Nieuw idee')+'" '+inp+' style="flex:1;min-width:9rem;"><input id="crIdVoor" type="date" '+inp+'><button class="obtn primary" id="crIdAdd">+</button></div>' : '')+'</div>';
    // AI content-helper
    if (canEdit){
      html += '<div class="card"><div class="tt-h">'+T('cr.ai','AI content-helper')+'</div>'+
        '<p class="sub h-mt30">'+T('cr.ai.sub','Vraag om ideeen of een kant-en-klaar script, bijv. "schrijf een script voor een reel over een strandclub" of "voeg idee ... toe aan de kalender".')+'</p>'+
        '<div id="crAiOut" class="h-mt50"></div>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="crAiIn" placeholder="'+T('cr.ai.ph','Vraag of opdracht...')+'" '+inp+' class="h-flex1"><button class="obtn primary" id="crAiGo">'+T('cr.ai.go','Vraag')+'</button></div></div>';
    }
    el.innerHTML = html;
    // wiring
    const pOp = $('#crProfielOp'); if (pOp) pOp.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/profiel', { niche: $('#crNiche').value, bio: $('#crBio').value })); toast(T('cr.profielok','Profiel opgeslagen.')); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-pfvset]').forEach(b => b.addEventListener('click', async () => { const i2 = el.querySelector('[data-pfvin="'+b.dataset.pfvset+'"]'); try { crToe(await API.call('/supplier/creator/platform', { id: b.dataset.pfvset, volgers: i2?Number(i2.value):0 })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-pfdel]').forEach(b => b.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/platform', { weg: true, id: b.dataset.pfdel })); } catch(e){ toast(e.message); } }));
