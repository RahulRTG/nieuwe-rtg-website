          });
          const straksRows = Object.entries(straks).sort((a,b)=>a[1].min-b[1].min).slice(0,6);
          const dmsK = (state.dailyMeps||{})[new Date().toISOString().slice(0,10)];
          const mepOpen = dmsK ? (dmsK.tasks||[]).filter(x=>!x.done).slice(0,3) : [];
          if (straksRows.length || mepOpen.length || !actief.length)
            html += '<div class="tkc h-volbreed"><h3>'+T('lijn.tussendoor','Tussendoor')+'</h3>'+
              straksRows.map(([naam,r])=>'<div class="st-row"><span>'+T('lijn.zetklaar','Zet vast klaar: ')+'<b>'+r.n+'×</b> '+naam+'<span class="sub">'+T('lijn.startover','start over ~')+r.min+' min</span></span></div>').join('')+
              mepOpen.map(x=>'<div class="st-row"><span><b style="color:var(--gold);font-variant-numeric:tabular-nums;margin-right:0.5rem;">'+x.time+'</b>'+x.task+'<span class="sub">'+T('lijn.mep','mise en place van vandaag')+'</span></span></div>').join('')+
              (!straksRows.length && !mepOpen.length ? '<div class="tkc-who">'+T('lijn.hygiene','Rustig moment: werkbank afnemen, koeling en parstock checken, garnituur bijvullen.')+'</div>' : '')+
            '</div>';
          html += actief.length ? actief.map(o=>kaart(o,false)).join('') : '<div class="st-empty">'+T('ks.calm','Niets voor deze kant. Nieuwe bestellingen met werk voor ')+T('ks.'+sec, KSECTIES[sec][1]).toLowerCase()+T('ks.calm2',' verschijnen hier vanzelf.')+'</div>';
          if (klaarHier.length){
            html += '<div class="st-sec">'+T('ks.done','Klaargemeld door deze kant')+'</div>';
            html += klaarHier.map(o=>kaart(o,true)).join('');
          }
          el.innerHTML = html;
          bindStation(el);
          return;
        }
        if (keukenSectie === 'pas'){
          const keukenOrders = live.filter(o => sectiesVanOrder(o).length);
          const bezig = keukenOrders.filter(o => (o.stations||{}).keuken !== 'klaar').sort(spoedEerst);
          const opDePas = keukenOrders.filter(o => (o.stations||{}).keuken === 'klaar')
            .sort((a,b) => new Date(a.pasAt||a.at) - new Date(b.pasAt||b.at));
          const badge = o => '<div class="st-badges">'+Object.entries(vuurplan(o).plan).map(([s2,p]) => vpChip(s2, p)).join('')+'</div>';
          // de tafelklok van de pas: staat alles van een tafel op de pas, dan
          // kan de hele tafel in een keer uit
          const tafels = {};
          opDePas.forEach(o => { if (o.table) (tafels[o.table] = tafels[o.table] || []).push(o); });
          const compleet = Object.keys(tafels).filter(t => !bezig.some(o => (o.table||'') === t));
          if (compleet.length)
            html += '<div class="allday" role="status"><span class="ad-h">\uD83E\uDE91 '+T('pas.compleet','Tafel compleet')+'</span>'+
              compleet.map(t => '<span class="ad"><b>'+t+'</b>'+tafels[t].map(o=>o.pickup).join(', ')+' \u00b7 '+T('pas.samen','stuur samen uit')+'</span>').join('')+'</div>';
          html += overschotBlok();
          html += '<div class="st-sec">'+T('ks.pas.klaar','Op de pas, samenstellen en doorgeven')+' ('+opDePas.length+')</div>';
          html += opDePas.length ? opDePas.map(o => {
            const pa = ageMin(o.pasAt || o.at);
            return '<div class="tkc'+pasKlasse(pa)+'"><div class="tkc-top"><span class="tkc-code">'+o.pickup+(o.table?' <span class="txt-md">\uD83E\uDE91 '+o.table+'</span>':'')+'</span><span class="tkc-age">'+pa+' '+T('pas.op','min op de pas')+'</span></div>'+
            '<div class="tkc-who">'+o.customerCodename+' \u00b7 '+(o.status==='klaar'?T('ks.pas.wacht','wacht op bediening'):T('ks.pas.bar','wacht nog op de bar'))+'</div>'+
            '<div class="tkc-items">'+(o.items||[]).filter(it=>sectieOf(it)).map(it=>'<span><b>'+it.qty+'\u00d7</b>'+KSECTIES[sectieOf(it)][0]+' '+it.name+'</span>').join('')+'</div>'+
            gastRegel(o)+
            (o.allergyNote?'<div class="tkc-alg">\u26a0 '+o.allergyNote+'</div>':'')+'</div>';
          }).join('') : '<div class="st-empty">'+T('ks.pas.leeg','Nog niets op de pas. Zodra alle kanten klaar zijn, komt de bestelling hier binnen.')+'</div>';
          html += '<div class="st-sec">'+T('ks.pas.bezig','In de maak, per kant')+' ('+bezig.length+')</div>';
          html += bezig.map(o =>
            '<div class="tkc"><div class="tkc-top"><span class="tkc-code">'+o.pickup+(o.table?' <span class="txt-md">\uD83E\uDE91 '+o.table+'</span>':'')+'</span><span class="tkc-age">'+ageMin(o.at)+' min</span></div>'+
            badge(o)+
            gastRegel(o)+
            (o.allergyNote?'<div class="tkc-alg">\u26a0 '+o.allergyNote+'</div>':'')+'</div>'
          ).join('');
          el.innerHTML = html;
          bindStation(el);
          return;
        }
      }
      const mine = live.filter(o => (o.items||[]).some(it => stationOf(it) === st));
      const act = mine.filter(o => (o.stations||{})[st] !== 'klaar').sort(spoedEerst);
      const done = mine.filter(o => (o.stations||{})[st] === 'klaar');
      if (st === 'keuken' || st === 'bar') html += stStats(act);
      if (st === 'keuken') html += allDay(act);
      if (st === 'bar') html += allDay(act, 'bar') + overschotChips() + overschotBlok();
      html += act.length ? act.map(o => ticketCard(o, st, {})).join('') : '<div class="st-empty">'+T('st.calm','Rustig. Nieuwe bestellingen verschijnen hier vanzelf, met geluid van de bel in de app.')+'</div>';
      if (done.length){
        html += '<div class="st-sec">'+T('st.done','Klaargemeld, wacht op uitserveren')+'</div>';
        html += done.map(o => ticketCard(o, st, { dim:true })).join('');
      }
      if (st === 'keuken'){
        const vandaagStr = new Date().toISOString().slice(0, 10);
        const morgenStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const dms = state.dailyMeps || {};
        html += '<div class="st-sec">\uD83D\uDCC5 '+T('dm.h','Dagelijkse mise en place (\u00e0 la carte)')+'</div>';
        const dmCard = (plan, label) => {
          const open = plan.tasks.filter(x=>!x.done).length;
          return '<div class="tkc h-volbreed">'+
            '<div class="tkc-top"><span style="font-weight:600;">'+label+' \u00b7 \u00b1'+plan.covers+' couverts</span><span class="tkc-age">'+plan.factorLabel+' \u00b7 '+T('dm.by','voorspeld door')+' '+plan.by+'</span></div>'+
            '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">'+plan.portions.map(p=>'<span class="st-badge">'+p.name+' \u00b7 <b style="color:var(--gold);">'+p.n+'\u00d7</b></span>').join('')+'</div>'+
            plan.tasks.map(x=>'<div class="st-row'+(x.done?'" style="opacity:0.5;':'"')+'"><span><b style="color:var(--gold);font-variant-numeric:tabular-nums;margin-right:0.6rem;">'+x.time+'</b>'+(x.done?'<s>'+x.task+'</s>':x.task)+(x.done&&x.doneBy?'<span class="sub">\u2713 '+x.doneBy+'</span>':'')+'</span>'+
              '<button class="obtn'+(x.done?' primary':'')+'" data-dmdone="'+plan.date+'" data-item="'+x.id+'">'+(x.done?'\u2713':T('rs.doit','Gedaan'))+'</button></div>').join('')+
            (open?'':'<div class="tkc-who">\u2705 '+T('dm.alldone','Alles afgevinkt, de lijn staat.')+'</div>')+
          '</div>';
        };
        if (dms[vandaagStr]) html += dmCard(dms[vandaagStr], T('rs.today','vandaag').toUpperCase());
        if (dms[morgenStr]) html += dmCard(dms[morgenStr], T('rs.tomorrow','morgen').toUpperCase());
        html += '<div class="tkc"><div class="tkc-who">'+T('dm.deck','De voorspelling rekent met de verkoop van de afgelopen drie weken, de tafelcapaciteit en de weekdag.')+'</div>'+
          '<div class="tkc-act"><button class="tkc-start" data-dmgen="vandaag">\u2728 '+(dms[vandaagStr]?T('dm.redo','Opnieuw voor vandaag'):T('dm.today','Voorspel vandaag'))+'</button>'+
          '<button class="tkc-start" data-dmgen="morgen">\u2728 '+(dms[morgenStr]?T('dm.redo2','Opnieuw voor morgen'):T('dm.tomorrow','Voorspel morgen'))+'</button></div></div>';
        const evs2 = (state.events||[]).filter(e => e.published && (e.date||'') >= vandaagStr && (e.catering && e.catering.mode !== 'geen' || (e.allergies||[]).length));
        if (evs2.length){
          html += '<div class="st-sec">\uD83D\uDC68\u200D\uD83C\uDF73 '+T('ek.h','Event-keuken')+'</div>';
          html += evs2.map(e => {
            const dishes = e.catering.mode === 'menu'
              ? e.catering.itemIds.map(id => (state.menu||[]).find(m => m.id === id)).filter(Boolean)
              : (state.menu||[]).filter(m => m.station !== 'bar');
            const covers = Math.max((e.guests||[]).reduce((n,g)=>n+g.qty,0), Math.ceil(e.capacity*0.6));
            return '<div class="tkc">'+
              '<div class="tkc-top"><span style="font-weight:600;">'+e.name+'</span><span class="tkc-age">'+e.date+'</span></div>'+
              '<div class="tkc-who">'+(e.catering.mode==='menu'?T('ek.menu','Vast menu')+' \u00b7 '+dishes.length+' '+T('ek.courses','gangen'):e.catering.mode==='alacarte'?'\u00c0 la carte':'')+' \u00b7 \u00b1'+covers+' couverts</div>'+
              (e.catering.mode==='menu' && dishes.length ? '<div class="tkc-items" style="font-size:0.82rem;">'+dishes.map(d=>'<span>\u2022 '+d.name+'</span>').join('')+'</div>' : '')+
              ((e.allergies||[]).length ? (e.allergies||[]).map(a =>
                '<div class="tkc-alg">\u26a0 '+a.allergen+' ('+a.count+'\u00d7)'+
                (a.alternative?'<br>\u2192 <b>'+a.alternative.name+'</b>'+(a.alternative.desc?': '+a.alternative.desc:''):'<br>'+T('ek.noalt','Nog geen vervangend gerecht, vraag het Kantoor of tik hieronder.'))+'</div>').join('') : '')+
              '<div class="tkc-act"><button class="tkc-ready" data-kmep="'+e.id+'">\u2728 '+T('ek.mep','Organiseer de mise en place')+'</button></div>'+
            '</div>';
          }).join('');
        }
      }
      html += runsheetStrip(st);
    }
