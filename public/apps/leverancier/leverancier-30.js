/* de boerderijkaart: dier of gewas, met zijn cijfers */
    const o = boer, st = o.stats || {}, isDier = o.kind !== 'gewas', isGewas = o.kind !== 'dier';
    const sel = 'style="background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.5rem 0.6rem;font-size:0.82rem;color:var(--txt);"';
    let html = '';
    // type + kiezer
    html += '<div class="card"><div class="tt-h">'+T('boer.type','Soort boerderij')+'</div>'+
      '<div style="margin-top:0.5rem;font-size:0.9rem;display:flex;align-items:center;gap:0.35rem;">'+(window.RTGGlyf?RTGGlyf.svgHTML(o.typeIcon,{klasse:'gl-inline'}):'')+' <b>'+esc(o.typeLabel||T('boer.geen','nog niet gekozen'))+'</b></div>'+
      (canEdit ? '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">'+
        o.types.map(t => '<button class="obtn'+(t.id===o.type?' primary':'')+'" data-btype="'+t.id+'">'+(window.RTGGlyf?RTGGlyf.svgHTML(t.icon,{klasse:'gl-inline'}):'')+' '+esc(t.label)+'</button>').join('')+'</div>' : '')+'</div>';
    // Vandaag-briefing
    const br = o.briefing || { punten:[] };
    html += '<div class="card"><div class="tt-h">'+T('boer.vandaag','Vandaag')+' · '+esc(br.seizoenLabel||'')+'</div>'+
      (br.punten.length ? br.punten.map(p => '<div class="mitem" style="border-left:3px solid '+(URG_KL[p.urgentie]||'var(--soft)')+';"><div class="ds" style="color:var(--txt);">'+esc(p.tekst)+'</div></div>').join('')
        : '<div class="ds h-mt50">'+T('boer.rustig','Niets dringends. Mooie dag om vooruit te werken.')+'</div>')+'</div>';
    // stats
    const tiles = [[st.percelen||0, T('boer.percelen','percelen')],[ (st.hectare||0)+' ha', T('boer.opp','oppervlak')],[st.teOogsten||0, T('boer.oogstklaar','oogstklaar')],[st.dieren||0, T('boer.dieren','dieren')]];
    if (isDier){ tiles.push([st.melkPerDag||0, T('boer.melk','L melk/dag')]); tiles.push([st.eierenPerDag||0, T('boer.eieren','eieren/dag')]); tiles.push([(st.voerPerDag||0)+' kg', T('boer.voer','voer/dag')]); }
    tiles.push([st.openTaken||0, T('boer.taken','open taken')]);
    html += '<div class="card"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;">'+
      tiles.map(c => '<div style="background:var(--card2,var(--card));border:1px solid var(--line);border-radius:0;padding:0.6rem;text-align:center;"><div style="font-size:1.15rem;font-weight:700;color:var(--rtg-leesgoud,var(--gold));">'+c[0]+'</div><div style="font-size:0.6rem;color:var(--soft);text-transform:uppercase;letter-spacing:0.05em;">'+c[1]+'</div></div>').join('')+'</div></div>';
    // percelen (gewasbedrijven)
    if (isGewas){
      html += '<div class="card"><div class="tt-h">'+T('boer.perc','Percelen')+' ('+(o.percelen||[]).length+')</div>'+
        (o.percelen||[]).map(p => {
          const bar = '<div style="height:6px;border-radius:0;background:var(--line);overflow:hidden;margin-top:0.35rem;"><div style="height:100%;width:'+(p.voortgang||0)+'%;background:'+(FASE_KL[p.fase]||'var(--gold)')+';"></div></div>';
          return '<div class="mitem"><div class="r1"><span class="nm">'+esc(p.naam)+'</span><span class="pr">'+(p.ha||0)+' ha</span></div>'+
          '<div class="ds">'+(p.gewasLabel ? esc(p.gewasLabel)+' · <span style="color:'+(FASE_KL[p.fase]||'var(--soft)')+';">'+T('boer.fase.'+p.fase, FASE_LBL[p.fase]||p.fase)+'</span>'+(p.fase==='groeit'||p.fase==='gezaaid'?' · '+(p.restDagen)+' '+T('boer.dgn','dagen tot oogst'):'')+(p.opbrengst?' · '+p.opbrengst+' '+(p.eenheid||'kg'):'') : T('boer.braak','braak, nog niet ingezaaid'))+'</div>'+
          (p.gewasLabel && p.fase!=='geoogst' ? bar : '')+
          '<div style="margin-top:0.5rem;display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">'+
            (canEdit ? '<select data-zaaisel="'+p.id+'" '+sel+'><option value="">'+T('boer.zaaikies','zaai...')+'</option>'+o.gewaskeuze.map(g=>'<option value="'+g.id+'">'+esc(g.label)+'</option>').join('')+'</select>' : '')+
            (p.gewasLabel && p.fase==='te-oogsten' ? '<button class="obtn primary" data-oogst="'+p.id+'">'+T('boer.oogsten','Oogsten')+'</button>' : '')+
            (p.gewasLabel && p.fase!=='geoogst' ? '<button class="obtn" data-water="'+p.id+'">'+T('boer.water','Water')+'</button>' : '')+
            (canEdit ? '<button class="rr-del" data-percdel="'+p.id+'">✕</button>' : '')+
          '</div></div>';
        }).join('')+
        (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;"><input id="boerPcNaam" placeholder="'+T('boer.pcnaam','Naam perceel')+'" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.5rem 0.6rem;color:var(--txt);"><input id="boerPcHa" type="number" min="0" step="0.1" placeholder="ha" style="width:5rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.5rem 0.6rem;color:var(--txt);"><button class="obtn primary" id="boerPcAdd">+</button></div>' : '')+'</div>';
    }
    // dieren
    if (isDier){
      html += '<div class="card"><div class="tt-h">'+T('boer.dgroep','Dieren')+' ('+(o.dieren||[]).length+')</div>'+
        (o.dieren||[]).map(d => '<div class="mitem"><div class="r1"><span class="nm">'+esc(d.soortLabel)+' × '+(d.aantal||0)+'</span><span class="pr">'+(d.dagopbrengst||0)+' '+(d.eenheid||'')+'/dag</span></div>'+
          '<div class="ds">'+(d.stal?esc(d.stal)+' · ':'')+T('boer.voernodig','voer')+' '+(d.voerKgPerDag||0)+' kg/dag · '+T('boer.gezond','gezondheid')+': <span style="color:'+(d.gezondheid==='goed'?'#7EE0A3':d.gezondheid==='ziek'?'#E0736A':'var(--gold)')+';">'+esc(d.gezondheid)+'</span>'+(d.laatsteVoer?' · '+T('boer.gevoerd','gevoerd')+' '+timeAgo(d.laatsteVoer):'')+'</div>'+
          '<div style="margin-top:0.5rem;display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">'+
            '<button class="obtn primary" data-voer="'+d.id+'">'+T('boer.voeren','Voeren')+'</button>'+
            '<input type="number" min="0" data-opbin="'+d.id+'" placeholder="'+(d.eenheid||'')+'/dag" style="width:6rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.4rem 0.5rem;color:var(--txt);"><button class="obtn" data-opbset="'+d.id+'">'+T('boer.opbregistr','Opbrengst')+'</button>'+
            (canEdit ? '<select data-gezond="'+d.id+'" '+sel+'><option value="goed"'+(d.gezondheid==='goed'?' selected':'')+'>'+T('boer.g.goed','goed')+'</option><option value="aandacht"'+(d.gezondheid==='aandacht'?' selected':'')+'>'+T('boer.g.aandacht','aandacht')+'</option><option value="ziek"'+(d.gezondheid==='ziek'?' selected':'')+'>'+T('boer.g.ziek','ziek')+'</option></select><button class="rr-del" data-dierdel="'+d.id+'">✕</button>' : '')+
          '</div></div>').join('')+
        (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><select id="boerDrSoort" '+sel+'>'+o.dierkeuze.map(g=>'<option value="'+g.id+'">'+esc(g.label)+'</option>').join('')+'</select><input id="boerDrAantal" type="number" min="0" placeholder="'+T('boer.aantal','aantal')+'" style="width:6rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.5rem 0.6rem;color:var(--txt);"><button class="obtn primary" id="boerDrAdd">+</button></div>' : '')+'</div>';
    }
    // takenbord
    html += '<div class="card"><div class="tt-h">'+T('boer.takenbord','Takenbord')+'</div>'+
      (o.taken||[]).map(t => '<div class="mitem" style="opacity:'+(t.klaar?'0.55':'1')+';"><div class="r1"><span class="nm">'+(t.klaar?'✓ ':'')+esc(t.wat)+'</span>'+(t.voor?'<span class="pr" style="color:'+(!t.klaar&&t.voor<new Date().toISOString().slice(0,10)?'#E0736A':'var(--soft)')+';">'+esc(t.voor)+'</span>':'')+'</div>'+
        (t.waar?'<div class="ds">'+esc(t.waar)+(t.door?' · '+esc(t.door):'')+'</div>':'')+
        (!t.klaar ? '<div style="margin-top:0.4rem;display:flex;gap:0.4rem;"><button class="obtn primary" data-taakklaar="'+t.id+'">'+T('boer.afronden','Afronden')+'</button>'+(canEdit?'<button class="rr-del" data-taakdel="'+t.id+'">✕</button>':'')+'</div>' : '')+'</div>').join('')+
      (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><input id="boerTkWat" placeholder="'+T('boer.tkwat','Nieuwe taak')+'" style="flex:1;min-width:9rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.5rem 0.6rem;color:var(--txt);"><input id="boerTkVoor" type="date" style="background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.5rem 0.6rem;color:var(--txt);"><button class="obtn primary" id="boerTkAdd">+</button></div>' : '')+'</div>';
