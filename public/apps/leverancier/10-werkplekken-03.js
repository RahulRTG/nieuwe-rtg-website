      const tafelsKlaar = {};
      serve.forEach(o => { if (o.table) (tafelsKlaar[o.table] = tafelsKlaar[o.table] || []).push(o); });
      const loop = Object.keys(tafelsKlaar).filter(t => !making.some(o => (o.table||'') === t));
      if (loop.length)
        html += '<div class="allday" role="status"><span class="ad-h">\uD83E\uDE91 '+T('pas.compleet','Tafel compleet')+'</span>'+
          loop.map(t => '<span class="ad"><b>'+t+'</b>'+tafelsKlaar[t].map(o=>o.pickup).join(', ')+' \u00b7 '+T('bp.eenloop','pak alles in een loop')+'</span>').join('')+'</div>';
      html += '<div class="st-sec">'+T('bp.h','Bedieningspas, klaar om te lopen')+' ('+serve.length+')</div>';
      html += serve.length ? serve.map(o => {
        const pa = ageMin(o.pasAt || o.at);
        return '<div class="tkc'+pasKlasse(pa)+'">'+
          '<div class="tkc-top"><span class="tkc-code">'+(o.table?'\uD83E\uDE91 '+o.table:'\uD83D\uDCE6 '+o.pickup)+'</span><span class="tkc-age">'+pa+' '+T('pas.op','min op de pas')+'</span></div>'+
          '<div class="tkc-who">'+(o.table?T('bp.naar','breng naar de tafel'):T('bp.ophaal','ophaalbestelling, code ')+o.pickup)+' \u00b7 '+o.customerCodename+(o.spoed?' \u00b7 \u26A1 '+T('spoed.chip','Spoed'):'')+'</div>'+
          '<div class="tkc-items">'+(o.items||[]).map(it=>'<span><b>'+it.qty+'\u00D7</b>'+MTX(it.name)+'</span>').join('')+'</div>'+
          gastRegel(o)+
          (o.allergyNote?'<div class="tkc-alg">\u26A0 '+MTX(o.allergyNote)+'</div>':'')+
          '<div class="tkc-act"><button class="tkc-serve" data-stserve="'+o.ref+'">'+T('st.served','Geserveerd')+'</button></div></div>';
      }).join('') : '<div class="st-empty">'+T('st.noserve','Niets klaar om uit te serveren. Zodra keuken en bar klaar zijn, verschijnt de bestelling hier.')+'</div>';
      // de spoedbon: een enkel gerecht komt als gewone bon op de lijn en telt
      // gewoon mee in de maak-nu- en all-day-tellingen; geen bel, geen flits
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>\u26A1 '+T('spoed.h','Spoedbon')+'</h3>'+
        '<div class="tkc-who">'+T('spoed.deck','Gerecht gevallen of vergeten? Zet het als gewone bon op de lijn; de keuken ziet gewoon een bon erbij.')+'</div>'+
        '<div class="row-gap"><select class="st-in" id="spGerecht" style="flex:2;">'+
          (state.menu||[]).map(m=>'<option value="'+m.id+'">'+m.name+'</option>').join('')+'</select>'+
        '<input class="st-in" id="spAantal" type="number" inputmode="numeric" min="1" value="1" style="flex:0 0 4.5rem;">'+
        '<select class="st-in" id="spTafel" style="flex:1;"><option value="">'+T('spoed.geentafel','geen tafel')+'</option>'+
          (state.tables||[]).map(t=>'<option value="'+t.name+'">'+t.name+'</option>').join('')+'</select></div>'+
        '<div class="tkc-act"><button class="tkc-ready" id="spGo">\u26A1 '+T('spoed.go','Zet op de lijn')+'</button></div></div>';
      html += overschotBlok();
      html += '<div class="st-sec">'+T('st.making','In de maak')+' ('+making.length+')</div>';
      html += making.length ? making.map(o => {
        const vp = vuurplan(o);
        return '<div class="tkc">'+
          '<div class="tkc-top"><span class="tkc-code">'+o.pickup+(o.table?' <span class="txt-md">\uD83E\uDE91 '+o.table+'</span>':'')+'</span><span class="tkc-age">'+ageMin(o.at)+' min</span></div>'+
          (o.intern?'<div class="tkc-who">\u26A1 '+T('spoed.van','Spoedbon van ')+(o.spoed&&o.spoed.door?o.spoed.door:'')+'</div>':'')+
          '<div class="tkc-items">'+(o.items||[]).map(it=>'<span>'+spoedMerk(o,it)+'<b>'+it.qty+'\u00D7</b>'+MTX(it.name)+'</span>').join('')+'</div>'+
          '<div class="st-badges">'+Object.entries(vp.plan).map(([k,p])=>vpChip(k,p)).join('')+'</div>'+
          gastRegel(o)+
          '<div class="tkc-act"><button class="tkc-start" data-settbl="'+o.ref+'" data-cur="'+(o.table||'')+'">\uD83E\uDE91 '+(o.table?o.table+' \u00b7 '+T('st.tblwissel','wijzig'):T('st.tblset','Tafel kiezen'))+'</button>'+
          (o.intern?'<button class="obtn" data-spoedaf="'+o.ref+'" style="margin-left:0.5rem;">'+T('spoed.af','Intrekken')+'</button>':'')+'</div></div>';
      }).join('') : '<div class="st-empty">'+T('st.nomaking','Geen lopende bestellingen.')+'</div>';
      html += runsheetStrip('bediening');
      const tables = state.tables || [];
      if (tables.length){
        html += '<div class="st-sec">'+T('st.tables','Tafels, tik om te wisselen')+'</div><div class="st-tblgrid">'+
          tables.map(t=>'<button class="tbl tbl-'+t.status+'" data-sttbl="'+t.id+'" data-cur="'+t.status+'"><b>'+t.name+'</b><span>'+t.seats+' '+T('tbl.pers','pers.')+'</span><i>'+tTbl(t.status)+'</i></button>').join('')+'</div>'+
          '<button class="obtn" data-tblqr style="margin-top:0.5rem;">🧾 '+T('st.tblqr','Print tafel-QR’s (scan en bestel)')+'</button>';
      }
      html += '<div class="st-sec">'+T('st.more','Meer')+'</div>'+
        '<button class="obtn" data-idcheck style="width:100%;margin-bottom:0.5rem;">\u{1F6E1}\uFE0F '+T('st.idcheck','ID / leeftijd controleren (Zegel scannen)')+'</button>'+
        '<a class="tkc" style="text-decoration:none;align-items:flex-start;" href="/apps/personeel.html"><b style="font-size:0.95rem;">\uD83D\uDCF1 '+T('st.pda','Open de volledige PDA')+'</b><span style="font-size:0.74rem;color:var(--soft);">'+T('st.pda.s','Rooster, taken, teamchat, videobellen en SOS.')+'</span></a>';
    } else if (stationMode === 'events'){
      const evs = state.events || [];
      html += runsheetStrip('party');
      html += evs.length ? evs.map(e => {
        const taken = (e.guests||[]).reduce((n,g)=>n+g.qty,0);
        const inb = (e.guests||[]).filter(g=>g.checkedIn).reduce((n,g)=>n+g.qty,0);
        return '<div class="tkc'+(e.published?'':' dim')+'">'+
          '<div class="tkc-top"><span style="font-size:1.05rem;font-weight:600;">'+e.name+(e.published?'':' \u00b7 '+T('ev.concept','concept'))+'</span><span class="tkc-age">'+e.date+(e.time?' \u00b7 '+e.time:'')+'</span></div>'+
          (e.desc?'<div class="tkc-who">'+e.desc+'</div>':'')+
          '<div class="tkc-who">'+taken+' / '+e.capacity+' '+T('ev.signedup','aangemeld')+' \u00b7 '+inb+' '+T('ev.inside','binnen')+(e.price?' \u00b7 '+eur(e.price)+' p.p.':'')+'</div>'+
          '<div class="ev-bar"><i style="width:'+Math.min(100, Math.round(taken/e.capacity*100))+'%;"></i></div>'+
          ((e.guests||[]).length ? '<div style="display:flex;flex-direction:column;">'+e.guests.map(g =>
            '<div class="st-row"><span>'+g.codename+' \u00b7 '+g.qty+' '+T('ev.pers','pers.')+'</span>'+
            '<button class="obtn'+(g.checkedIn?' primary':'')+'" data-evcheck="'+e.id+'" data-key="'+g.key+'">'+(g.checkedIn?'\u2713 '+T('ev.in','binnen'):T('ev.checkin','Check in'))+'</button></div>'
          ).join('')+'</div>' : '<div class="tkc-who">'+T('ev.noguests','Nog geen aanmeldingen.')+'</div>')+
        '</div>';
      }).join('') : '<div class="st-empty">'+T('ev.none','Nog geen events. De manager maakt ze aan in het Kantoor; leden melden zich aan via de leden-app.')+'</div>';
    } else if (stationMode === 'kantoor'){
      html += renderKantoor();
    } else if (stationMode === 'chauffeur'){
      // de chauffeurspost: mijn actieve rit groot in beeld, open ritten om te
      // pakken, en de verdiensten van vandaag
      const mij = actor().staffId;
      const ritten = state.rides || [];
      const actief = ritten.filter(r => !RIT_KLAAR(r.status) && r.driver && r.driver.staffId === mij);
      const straks = r => r.plannedFor && (new Date(r.plannedFor) - Date.now()) > 45 * 60000;
      const alleOpen = ritten.filter(r => r.status === 'aangevraagd' && !r.driver);
      const open = alleOpen.filter(r => !straks(r));
      const gepland = alleOpen.filter(straks);
      const vandaag = new Date().toISOString().slice(0, 10);
      const klaarVandaag = ritten.filter(r => (r.status === 'afgerond' || r.status === 'gearriveerd') && r.driver && r.driver.staffId === mij && String(r.finishedAt || r.at).slice(0, 10) === vandaag);
