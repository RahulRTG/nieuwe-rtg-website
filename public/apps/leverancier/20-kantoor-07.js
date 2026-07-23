    if (kantoorSec === 'minibar'){
      const cat = (state.minibar && state.minibar.catalog) || [];
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('kt.mbcat','Minibar-catalogus')+' ('+cat.length+')</h3>'+
        (cat.length ? cat.map(m=>'<div class="st-row"><span>'+m.name+'<span class="sub">'+eur(m.price)+'</span></span>'+
          '<button class="obtn warn" data-kmbd="'+m.id+'">✕</button></div>').join('')
        : '<div class="tkc-who">'+T('kt.nomb','Nog geen artikelen in de minibar.')+'</div>')+
        '<div class="st-form"><div class="row-gap"><input class="st-in" id="kMbN" placeholder="'+T('mb.newitem','Nieuw artikel')+'" style="flex:2;"><input class="st-in" id="kMbP" type="number" inputmode="decimal" placeholder="€" style="flex:1;"></div>'+
        '<button class="bigbtn" id="kMbAdd" style="margin-top:0.2rem;">'+T('team.add','Toevoegen')+'</button></div>'+
        '<div class="tkc-who">'+T('kt.mbnote','De telling per kamer doet housekeeping in het tabblad Minibar; hier beheert u het assortiment en de prijzen.')+'</div></div>';
    }
    if (kantoorSec === 'deuren'){
      const doors = state.doors || [];
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('kt.deuren','Deuren')+'</h3>'+
        (doors.length ? doors.map(d=>'<div class="st-row"><span>'+(d.locked?'':'')+' '+d.name+
          '<span class="sub">'+(d.locked?T('door.locked','Vergrendeld'):T('door.open','OPEN, vergrendelt zichzelf'))+(d.lastBy?' · '+T('door.lastby','laatst:')+' '+d.lastBy:'')+'</span></span>'+
          '<button class="obtn'+(d.locked?' primary':' warn')+'" data-kdoor="'+d.id+'">'+(d.locked?T('door.openbtn','Open 10 sec'):T('door.lockbtn','Vergrendel nu'))+'</button></div>').join('')
        : '<div class="tkc-who">'+T('door.none','Nog geen digitale deuren gekoppeld.')+'</div>')+
        '<div class="tkc-who">'+T('door.note','Elke opening komt in de activiteitenfeed: wie, welke deur, wanneer. Gearriveerde gasten kunnen de voordeur zelf openen via hun app.')+'</div></div>';
    }
    if (kantoorSec === 'ritten'){
      // dispatch: open ritten toewijzen (slim voorstel met een tik), lopende ritten volgen
      const ritten = state.rides || [];
      const straks2 = r => r.plannedFor && (new Date(r.plannedFor) - Date.now()) > 45 * 60000;
      const alleOpenK = ritten.filter(r => r.status === 'aangevraagd' && !r.driver);
      const open = alleOpenK.filter(r => !straks2(r));
      const geplandK = alleOpenK.filter(straks2);
      const bezig = ritten.filter(r => !RIT_KLAAR(r.status) && (r.driver || r.status !== 'aangevraagd'));
      const chauffeurs = (state.staff||[]);
      const wagens = (state.fleet||[]).filter(v=>v.active);
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('kt.openritten','Open aanvragen')+' ('+open.length+')</h3>'+
        (open.length ? open.map(r =>
          '<div class="st-row" style="flex-wrap:wrap;"><span>'+r.customerCodename+'<span class="sub">'+(r.from||'')+' → '+(r.to||'?')+' · '+ritRegel(r)+' · '+r.when+'</span></span>'+
          '<span class="acts" style="flex-wrap:wrap;">'+
            '<select class="st-in" data-ktch="'+r.ref+'" style="width:auto;padding:0.45rem 0.6rem;">'+chauffeurs.map(m=>'<option value="'+m.id+'">'+m.name+'</option>').join('')+'</select>'+
            '<select class="st-in" data-ktvg="'+r.ref+'" style="width:auto;padding:0.45rem 0.6rem;">'+wagens.map(v=>'<option value="'+v.id+'">'+v.name+'</option>').join('')+'</select>'+
            '<button class="obtn primary" data-ktwijs="'+r.ref+'">'+T('kt.wijs','Wijs toe')+'</button>'+
            '<button class="obtn" data-ktslim="'+r.ref+'">'+T('kt.slim','Slim')+'</button></span></div>'
        ).join('') : '<div class="tkc-who">'+T('kt.geenopen','Geen open aanvragen.')+'</div>')+'</div>';
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('kt.gepland','Gepland')+' ('+geplandK.length+')</h3>'+
        (geplandK.length ? geplandK.map(r =>
          '<div class="st-row" style="flex-wrap:wrap;"><span>'+r.customerCodename+'<span class="sub">'+(r.from||'')+' → '+(r.to||'?')+' · '+ritRegel(r)+' · <b>'+r.when+'</b></span></span>'+
          '<span class="acts" style="flex-wrap:wrap;">'+
            '<select class="st-in" data-ktch="'+r.ref+'" style="width:auto;padding:0.45rem 0.6rem;">'+chauffeurs.map(m=>'<option value="'+m.id+'">'+m.name+'</option>').join('')+'</select>'+
            '<select class="st-in" data-ktvg="'+r.ref+'" style="width:auto;padding:0.45rem 0.6rem;">'+wagens.map(v=>'<option value="'+v.id+'">'+v.name+'</option>').join('')+'</select>'+
            '<button class="obtn primary" data-ktwijs="'+r.ref+'">'+T('kt.wijs','Wijs toe')+'</button>'+
            '<button class="obtn" data-ktslim="'+r.ref+'">'+T('kt.slim','Slim')+'</button></span></div>'
        ).join('') : '<div class="tkc-who">'+T('kt.nietsgepland','Geen geplande ritten. Leden kunnen ritten dagen vooruit boeken.')+'</div>')+'</div>';
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('kt.lopend','Lopend')+' ('+bezig.length+')</h3>'+
        (bezig.length ? bezig.map(r =>
          '<div class="st-row"><span>'+r.customerCodename+' · '+tStatus(r.status)+
          '<span class="sub">'+(r.driver?r.driver.name:'?')+(r.vehicle?' · '+r.vehicle.name:'')+' · '+(r.to||'?')+' · '+(r.quote?eur(r.quote):'')+'</span></span></div>'
        ).join('') : '<div class="tkc-who">'+T('kt.geenlopend','Niets onderweg.')+'</div>')+'</div>';
    }
    if (kantoorSec === 'historie'){
      // ritgeschiedenis: gepagineerd en doorzoekbaar via de server, zodat dit
      // scherm er hetzelfde uitziet met tien of tien miljoen afgeronde ritten
      if (!histData){
        laadHistorie();
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('kt.historie','Historie')+'</h3><div class="tkc-who">'+T('kt.laden','Laden...')+'</div></div>';
      } else {
        const h = histData;
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('kt.historie','Historie')+' ('+h.total+')</h3>'+
          '<div class="tkc-who">'+T('kt.omzet','Totale ritomzet')+': <b style="color:var(--gold);">'+eur(h.omzet)+'</b> · '+T('kt.nulcom','RTG rekent 0% commissie.')+'</div>'+
          '<div style="display:flex;gap:0.5rem;margin:0.5rem 0;"><input class="st-in" id="ktHz" placeholder="'+T('kt.zoekrit','Zoek op gast, referentie of chauffeur')+'" value="'+histQ.replace(/"/g,'&quot;')+'" style="flex:1;">'+
          '<button class="obtn" id="ktHzGo">'+T('kt.zoek','Zoek')+'</button></div>'+
          (h.items.length ? h.items.map(r =>
            '<div class="st-row"><span>'+r.customerCodename+'<span class="sub">'+(r.from||'')+' → '+(r.to||'?')+' · '+ritRegel(r)+' · '+String(r.finishedAt||r.at).slice(0,16).replace('T',' ')+(r.driver?' · '+r.driver.name:'')+'</span></span>'+
            '<b style="color:var(--gold);">'+(r.quote?eur(r.quote):'')+'</b></div>'
          ).join('') : '<div class="tkc-who">'+(histQ ? T('kt.nietsgevonden','Niets gevonden voor deze zoekopdracht.') : T('kt.geenhistorie','Nog geen afgeronde ritten.'))+'</div>')+
          (h.pages > 1 ? '<div style="display:flex;align-items:center;justify-content:center;gap:0.9rem;margin-top:0.6rem;">'+
            '<button class="obtn" data-khist="-1"'+(h.page<=1?' disabled':'')+'>‹</button>'+
            '<span class="tkc-who" style="margin:0;">'+T('kt.pagina','Pagina')+' '+h.page+' / '+h.pages+'</span>'+
            '<button class="obtn" data-khist="1"'+(h.page>=h.pages?' disabled':'')+'>›</button></div>' : '')+
          (h.total ? '<div class="st-form"><button class="bigbtn" id="ktCsv">'+T('kt.csv','Exporteer alles als CSV')+' ('+h.total+')</button></div>' : '')+'</div>';
      }
    }
    if (kantoorSec === 'vloot'){
      const wagens = state.fleet || [];
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+(type==='jet'?''+T('kt.vloot','Vloot'):''+T('kt.vloot','Vloot'))+' ('+wagens.length+')</h3>'+
        (wagens.length ? wagens.map(v =>
          '<div class="st-row"><span>'+v.name+(v.active?'':' · '+T('kt.offline','offline'))+'<span class="sub">'+(v.plate||'')+' · '+v.seats+' '+T('tbl.pers','pers.')+'</span></span>'+
          '<span class="acts"><button class="obtn'+(v.active?' primary':' warn')+'" data-ktvt="'+v.id+'">'+(v.active?T('kt.isopen','Open'):T('kt.isclosed','Dicht'))+'</button>'+
          '<button class="obtn warn" data-ktvd="'+v.id+'">✕</button></span></div>'
        ).join('') : '<div class="tkc-who">'+T('kt.geenvloot','Nog geen voertuigen.')+'</div>')+
        '<div class="st-form"><input class="st-in" id="ktVn" placeholder="'+T('kt.vnaam','Naam, bijv. Mercedes S-klasse')+'">'+
        '<div class="row-gap"><input class="st-in" id="ktVp" placeholder="'+T('kt.kenteken','Kenteken / registratie')+'" style="flex:2;"><input class="st-in" id="ktVs" type="number" placeholder="4" style="flex:1;"></div>'+
        '<button class="bigbtn" id="ktVAdd" style="margin-top:0.2rem;">'+T('kt.vadd','Voertuig toevoegen')+'</button></div></div>';
    }
