    if (kantoorSec === 'events'){
      const evs = state.events || [];
      html += '<div class="tkc"><h3>'+T('kt.newevent','Nieuw event')+'</h3><div class="st-form">'+
        '<input class="st-in" id="kEvName" placeholder="'+T('kt.ev.name','Naam, bijv. Jazz & sake night')+'">'+
        '<div class="row-gap"><input class="st-in" id="kEvDate" type="date" style="flex:2;"><input class="st-in" id="kEvTime" type="time" style="flex:1;"></div>'+
        '<input class="st-in" id="kEvDesc" placeholder="'+T('kt.ev.desc','Korte omschrijving')+'">'+
        '<div class="row-gap"><input class="st-in" id="kEvCap" type="number" placeholder="'+T('kt.ev.cap','Capaciteit')+'" style="flex:1;"><input class="st-in" id="kEvPrice" type="number" placeholder="'+T('kt.ev.price','Prijs p.p. (0 = gratis)')+'" style="flex:1;"></div>'+
        '<button class="bigbtn" id="kEvAdd" style="margin-top:0.2rem;">'+T('kt.ev.add','Maak aan als concept')+'</button></div></div>';
      html += evs.map(e=>{
        const taken=(e.guests||[]).reduce((n,g)=>n+g.qty,0);
        const rs = e.runsheet || [];
        const stOpts = [['keuken','\uD83D\uDD25 '+T('kt.keuken','Keuken')],['bar','\uD83C\uDF78 Bar'],['bediening','\uD83E\uDDFE '+T('kt.bediening','Bediening')],['party','\uD83C\uDF9F Party manager'],['alle','\uD83D\uDCE2 '+T('rs.all','Iedereen')]];
        return '<div class="tkc'+(e.published?'':' dim')+'" style="grid-column:1/-1;"><div class="tkc-top"><span style="font-weight:600;">'+e.name+'</span><span class="tkc-age">'+e.date+(e.time?' \u00b7 '+e.time:'')+'</span></div>'+
        '<div class="tkc-who">'+taken+' / '+e.capacity+' '+T('ev.signedup','aangemeld')+(e.price?' \u00b7 '+eur(e.price)+' p.p.':'')+(e.published?'':' \u00b7 '+T('ev.concept','concept'))+'</div>'+
        '<h3 style="margin-top:0.4rem;">\uD83D\uDC68\u200D\uD83C\uDF73 '+T('ek.h','Event-keuken')+'</h3>'+
        '<div class="st-form"><select class="st-in" id="kcm'+e.id+'">'+
          '<option value="geen"'+(e.catering.mode==='geen'?' selected':'')+'>'+T('ek.none','Geen eten / n.v.t.')+'</option>'+
          '<option value="menu"'+(e.catering.mode==='menu'?' selected':'')+'>'+T('ek.menu','Vast menu')+'</option>'+
          '<option value="alacarte"'+(e.catering.mode==='alacarte'?' selected':'')+'>\u00c0 la carte</option></select>'+
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">'+(state.menu||[]).filter(m=>m.station!=='bar').map(m=>
          '<button class="mn-station'+(e.catering.itemIds.includes(m.id)?'" style="border-color:var(--gold);color:var(--gold);':'"')+'" data-kdish="'+m.id+'" data-ev="'+e.id+'">'+m.name+'</button>').join('')+'</div>'+
        '<button class="obtn" data-kcat="'+e.id+'">'+T('ek.save','Bewaar de eventkeuken')+'</button></div>'+
        '<div class="st-form" style="margin-top:0.5rem;">'+
        ((e.allergies||[]).map(a=>'<div class="st-row"><span>\u26a0 '+a.allergen+' ('+a.count+'\u00d7)'+
          (a.alternative?'<span class="sub">\u2192 '+a.alternative.name+'</span>':'')+'</span>'+
          '<span class="acts">'+(!a.alternative?'<button class="obtn primary" data-kalt="'+e.id+'" data-al="'+a.id+'">\u2728 '+T('ek.alt','Vervangend gerecht')+'</button>':'')+
          '<button class="obtn warn" data-kaldel="'+e.id+'" data-al="'+a.id+'">\u2715</button></span></div>').join(''))+
        '<div class="row-gap"><input class="st-in" id="kaN'+e.id+'" placeholder="'+T('ek.allergen','Allergeen, bijv. noten')+'" style="flex:2;"><input class="st-in" id="kaC'+e.id+'" type="number" placeholder="1\u00d7" style="flex:1;"></div>'+
        '<button class="obtn" data-kaladd="'+e.id+'">'+T('ek.addal','Allergeen registreren')+'</button>'+
        '<button class="obtn primary" data-kmep="'+e.id+'">\u2728 '+T('ek.mep','Organiseer de mise en place')+'</button></div>'+
        '<h3 style="margin-top:0.6rem;">\uD83D\uDCCB '+T('rs.h','Draaiboek')+' ('+rs.length+')</h3>'+
        (rs.length ? rs.map(it=>'<div class="st-row"><span>'+(it.daysBefore?'<span style="font-size:0.6rem;letter-spacing:0.06em;color:var(--soft);margin-right:0.4rem;">D-'+it.daysBefore+'</span>':'')+'<b style="color:var(--gold);font-variant-numeric:tabular-nums;margin-right:0.6rem;">'+it.time+'</b>'+(RUN_ICON[it.station]||'')+' '+it.text+(it.done?' <span class="sub" style="display:inline;">\u2713 '+(it.doneBy||'')+'</span>':'')+'</span>'+
          '<button class="obtn warn" data-krdel="'+e.id+'" data-item="'+it.id+'">\u2715</button></div>').join('')
          : '<div class="tkc-who">'+T('rs.none','Nog geen draaiboek. Voer regels in, plak een bestaand draaiboek, of laat de AI er een opstellen.')+'</div>')+
        '<div class="st-form"><div class="row-gap"><input class="st-in" type="time" id="krT'+e.id+'" style="flex:1;">'+
        '<select class="st-in" id="krD'+e.id+'" style="flex:1;"><option value="0">'+T('rs.d0','Dag zelf')+'</option><option value="1">D-1</option><option value="2">D-2</option><option value="3">D-3</option></select>'+
        '<select class="st-in" id="krS'+e.id+'" style="flex:1.4;">'+stOpts.map(o=>'<option value="'+o[0]+'">'+o[1]+'</option>').join('')+'</select></div>'+
        '<input class="st-in" id="krX'+e.id+'" placeholder="'+T('rs.what','Wat moet er gebeuren?')+'">'+
        '<button class="obtn" data-kradd="'+e.id+'">'+T('rs.add','Regel toevoegen')+'</button></div>'+
        '<div class="st-form" style="margin-top:0.7rem;">'+
        '<textarea class="st-in" id="krP'+e.id+'" placeholder="'+T('rs.paste','Plak hier een bestaand draaiboek (per regel een tijd en taak), of kies een bestand...')+'" style="min-height:64px;resize:vertical;"></textarea>'+
        '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">'+
        '<label class="obtn" style="cursor:pointer;">\uD83D\uDCC4 '+T('rs.upload','Upload bestand')+'<input type="file" accept=".txt,.csv,.md,text/plain" data-krfile="'+e.id+'" style="display:none;"></label>'+
        '<button class="obtn" data-krimp="'+e.id+'">'+T('rs.import','Verwerk met AI')+'</button>'+
        '<button class="obtn primary" data-krai="'+e.id+'">\u2728 '+T('rs.suggest','Laat de AI een draaiboek opstellen')+'</button></div></div>'+
        '<div class="tkc-act" style="margin-top:0.7rem;"><button class="'+(e.published?'tkc-start':'tkc-ready')+'" data-kevpub="'+e.id+'">'+(e.published?T('kt.ev.offline','Haal offline'):T('kt.ev.publish','Publiceer voor leden'))+'</button>'+
        '<button class="tkc-start" data-kevdel="'+e.id+'" style="flex:0 0 auto;">\u2715</button></div></div>';
      }).join('');
    }
    if (kantoorSec === 'kamers'){
      const rooms = state.rooms || [];
      const verblijfGenre = type === 'apartment' || type === 'villa';
      const unit = verblijfGenre ? T('kt.unit','verblijf') : T('kt.kamer','kamer');
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+(verblijfGenre?'🏡 '+T('kt.units','Verblijven'):'🛏 '+T('kt.kamers','Kamers'))+' ('+rooms.length+')</h3>'+
        (rooms.length ? rooms.map(r => {
          const hk = (r.hk && r.hk.status) || 'schoon';
          return '<div class="st-row"><span>'+r.name+(r.available?'':' · '+T('kt.offline','offline'))+
            '<span class="sub">'+eur(r.price)+' '+T('sup.pernight','p.n.')+' · '+tHk(hk)+(hk==='defect'&&r.hk&&r.hk.note?' · ⚠ '+r.hk.note:'')+'</span></span>'+
            '<span class="acts"><button class="obtn'+(r.available?' primary':' warn')+'" data-kmrt="'+r.id+'">'+(r.available?T('kt.isopen','Open'):T('kt.isclosed','Dicht'))+'</button>'+
            '<button class="obtn" data-kmhk="'+r.id+'" data-cur="'+hk+'">🧹 '+tHk(hk)+'</button>'+
            '<button class="obtn warn" data-kmrd="'+r.id+'">✕</button></span></div>';
        }).join('') : '<div class="tkc-who">'+T('sup.norooms','Nog geen kamers. Voeg uw eerste kamer toe.')+'</div>')+
        '<div class="st-form"><div class="row-gap"><input class="st-in" id="kRmN" placeholder="'+T('sup.roomname','Kamernaam')+'" style="flex:2;"><input class="st-in" id="kRmP" type="number" inputmode="decimal" placeholder="€" style="flex:1;"></div>'+
        '<button class="bigbtn" id="kRmAdd" style="margin-top:0.2rem;">'+(verblijfGenre?T('kt.unitadd','Verblijf toevoegen'):T('kt.kameradd','Kamer toevoegen'))+'</button></div>'+
        '<div class="tkc-who">'+T('kt.hknote','Tik op de bezem om de housekeeping-status door te schakelen; Dicht = direct onzichtbaar voor gasten.')+'</div></div>';
    }
