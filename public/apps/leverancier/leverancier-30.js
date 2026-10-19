/* de boerderijkaart: dier of gewas, met zijn cijfers */
    const o = boer, st = o.stats || {}, isDier = o.kind !== 'gewas', isGewas = o.kind !== 'dier';
    const sel = 'style="background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.5rem 0.6rem;font-size:0.82rem;color:var(--txt);"';
    let html = '';
    // type + kiezer
    html += '<div class="card"><div class="tt-h">'+T('boer.type','Soort boerderij')+'</div>'+
      '<div class="s-eul1qn">'+(window.RTGGlyf?RTGGlyf.svgHTML(o.typeIcon,{klasse:'gl-inline'}):'')+' <b>'+esc(o.typeLabel||T('boer.geen','nog niet gekozen'))+'</b></div>'+
      (canEdit ? '<div class="s-1738il7">'+
        o.types.map(t => '<button class="obtn'+(t.id===o.type?' primary':'')+'" data-btype="'+t.id+'">'+(window.RTGGlyf?RTGGlyf.svgHTML(t.icon,{klasse:'gl-inline'}):'')+' '+esc(t.label)+'</button>').join('')+'</div>' : '')+'</div>';
    // Vandaag-briefing
    const br = o.briefing || { punten:[] };
    html += '<div class="card"><div class="tt-h">'+T('boer.vandaag','Vandaag')+' · '+esc(br.seizoenLabel||'')+'</div>'+
      (br.punten.length ? br.punten.map(p => '<div class="mitem" style="border-left:3px solid '+(URG_KL[p.urgentie]||'var(--soft)')+';"><div class="ds s-1btm41d">'+esc(p.tekst)+'</div></div>').join('')
        : '<div class="ds h-mt50">'+T('boer.rustig','Niets dringends. Mooie dag om vooruit te werken.')+'</div>')+'</div>';
    // stats
    const tiles = [[st.percelen||0, T('boer.percelen','percelen')],[ (st.hectare||0)+' ha', T('boer.opp','oppervlak')],[st.teOogsten||0, T('boer.oogstklaar','oogstklaar')],[st.dieren||0, T('boer.dieren','dieren')]];
    if (isDier){ tiles.push([st.melkPerDag||0, T('boer.melk','L melk/dag')]); tiles.push([st.eierenPerDag||0, T('boer.eieren','eieren/dag')]); tiles.push([(st.voerPerDag||0)+' kg', T('boer.voer','voer/dag')]); }
    tiles.push([st.openTaken||0, T('boer.taken','open taken')]);
    html += '<div class="card"><div class="s-o4320n">'+
      tiles.map(c => '<div class="s-nzmwiy"><div class="s-1r0guzu">'+c[0]+'</div><div class="s-1jq4whw">'+c[1]+'</div></div>').join('')+'</div></div>';
    // percelen (gewasbedrijven)
    if (isGewas){
      html += '<div class="card"><div class="tt-h">'+T('boer.perc','Percelen')+' ('+(o.percelen||[]).length+')</div>'+
        (o.percelen||[]).map(p => {
          const bar = '<div class="s-v9c81s"><div style="height:100%;width:'+(p.voortgang||0)+'%;background:'+(FASE_KL[p.fase]||'var(--gold)')+';"></div></div>';
          return '<div class="mitem"><div class="r1"><span class="nm">'+esc(p.naam)+'</span><span class="pr">'+(p.ha||0)+' ha</span></div>'+
          '<div class="ds">'+(p.gewasLabel ? esc(p.gewasLabel)+' · <span style="color:'+(FASE_KL[p.fase]||'var(--soft)')+';">'+T('boer.fase.'+p.fase, FASE_LBL[p.fase]||p.fase)+'</span>'+(p.fase==='groeit'||p.fase==='gezaaid'?' · '+(p.restDagen)+' '+T('boer.dgn','dagen tot oogst'):'')+(p.opbrengst?' · '+p.opbrengst+' '+(p.eenheid||'kg'):'') : T('boer.braak','braak, nog niet ingezaaid'))+'</div>'+
          (p.gewasLabel && p.fase!=='geoogst' ? bar : '')+
          '<div class="s-14dz8xb">'+
            (canEdit ? '<select data-zaaisel="'+p.id+'" '+sel+'><option value="">'+T('boer.zaaikies','zaai...')+'</option>'+o.gewaskeuze.map(g=>'<option value="'+g.id+'">'+esc(g.label)+'</option>').join('')+'</select>' : '')+
            (p.gewasLabel && p.fase==='te-oogsten' ? '<button class="obtn primary" data-oogst="'+p.id+'">'+T('boer.oogsten','Oogsten')+'</button>' : '')+
            (p.gewasLabel && p.fase!=='geoogst' ? '<button class="obtn" data-water="'+p.id+'">'+T('boer.water','Water')+'</button>' : '')+
            (canEdit ? '<button class="rr-del" data-percdel="'+p.id+'">✕</button>' : '')+
          '</div></div>';
        }).join('')+
        (canEdit ? '<div class="s-1stvyn0"><input id="boerPcNaam" placeholder="'+T('boer.pcnaam','Naam perceel')+'" class="s-11ts7hx"><input id="boerPcHa" type="number" min="0" step="0.1" placeholder="ha" class="s-xhqwuk"><button class="obtn primary" id="boerPcAdd">+</button></div>' : '')+'</div>';
    }
    // dieren
    if (isDier){
      html += '<div class="card"><div class="tt-h">'+T('boer.dgroep','Dieren')+' ('+(o.dieren||[]).length+')</div>'+
        (o.dieren||[]).map(d => '<div class="mitem"><div class="r1"><span class="nm">'+esc(d.soortLabel)+' × '+(d.aantal||0)+'</span><span class="pr">'+(d.dagopbrengst||0)+' '+(d.eenheid||'')+'/dag</span></div>'+
          '<div class="ds">'+(d.stal?esc(d.stal)+' · ':'')+T('boer.voernodig','voer')+' '+(d.voerKgPerDag||0)+' kg/dag · '+T('boer.gezond','gezondheid')+': <span style="color:'+(d.gezondheid==='goed'?'#7EE0A3':d.gezondheid==='ziek'?'#E0736A':'var(--gold)')+';">'+esc(d.gezondheid)+'</span>'+(d.laatsteVoer?' · '+T('boer.gevoerd','gevoerd')+' '+timeAgo(d.laatsteVoer):'')+'</div>'+
          '<div class="s-14dz8xb">'+
            '<button class="obtn primary" data-voer="'+d.id+'">'+T('boer.voeren','Voeren')+'</button>'+
            '<input type="number" min="0" data-opbin="'+d.id+'" placeholder="'+(d.eenheid||'')+'/dag" class="s-kl6gq5"><button class="obtn" data-opbset="'+d.id+'">'+T('boer.opbregistr','Opbrengst')+'</button>'+
            (canEdit ? '<select data-gezond="'+d.id+'" '+sel+'><option value="goed"'+(d.gezondheid==='goed'?' selected':'')+'>'+T('boer.g.goed','goed')+'</option><option value="aandacht"'+(d.gezondheid==='aandacht'?' selected':'')+'>'+T('boer.g.aandacht','aandacht')+'</option><option value="ziek"'+(d.gezondheid==='ziek'?' selected':'')+'>'+T('boer.g.ziek','ziek')+'</option></select><button class="rr-del" data-dierdel="'+d.id+'">✕</button>' : '')+
          '</div></div>').join('')+
        (canEdit ? '<div class="s-m6o005"><select id="boerDrSoort" '+sel+'>'+o.dierkeuze.map(g=>'<option value="'+g.id+'">'+esc(g.label)+'</option>').join('')+'</select><input id="boerDrAantal" type="number" min="0" placeholder="'+T('boer.aantal','aantal')+'" class="s-jvck5p"><button class="obtn primary" id="boerDrAdd">+</button></div>' : '')+'</div>';
    }
    // takenbord
    html += '<div class="card"><div class="tt-h">'+T('boer.takenbord','Takenbord')+'</div>'+
      (o.taken||[]).map(t => '<div class="mitem" style="opacity:'+(t.klaar?'0.55':'1')+';"><div class="r1"><span class="nm">'+(t.klaar?'✓ ':'')+esc(t.wat)+'</span>'+(t.voor?'<span class="pr ' + (!t.klaar&&t.voor<new Date().toISOString().slice(0,10) ? 's-14n40hq' : 's-1pv2lmv') + '">'+esc(t.voor)+'</span>':'')+'</div>'+
        (t.waar?'<div class="ds">'+esc(t.waar)+(t.door?' · '+esc(t.door):'')+'</div>':'')+
        (!t.klaar ? '<div class="s-jvldbz"><button class="obtn primary" data-taakklaar="'+t.id+'">'+T('boer.afronden','Afronden')+'</button>'+(canEdit?'<button class="rr-del" data-taakdel="'+t.id+'">✕</button>':'')+'</div>' : '')+'</div>').join('')+
      (canEdit ? '<div class="s-m6o005"><input id="boerTkWat" placeholder="'+T('boer.tkwat','Nieuwe taak')+'" class="s-q4snmy"><input id="boerTkVoor" type="date" class="s-1f8lgfe"><button class="obtn primary" id="boerTkAdd">+</button></div>' : '')+'</div>';
