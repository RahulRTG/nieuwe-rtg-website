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
