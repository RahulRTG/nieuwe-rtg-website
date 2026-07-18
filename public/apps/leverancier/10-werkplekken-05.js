      if (st === 'keuken'){
        // kies de kant: chef ziet alles, elke sectie alleen het eigen werk, de pas verzamelt
        html += '<div class="st-chips">'+Object.keys(KSECTIES).map(k =>
          '<button data-ksel="'+k+'"'+(keukenSectie===k?' class="on"':'')+'>'+KSECTIES[k][0]+' '+T('ks.'+k, KSECTIES[k][1])+'</button>').join('')+'</div>';
        html += '<div id="coachBox" style="grid-column:1/-1;display:none;"></div>';
        if (keukenSectie !== 'chef' && keukenSectie !== 'pas'){
          const sec = keukenSectie;
          const mijn = live.filter(o => sectiesVanOrder(o).includes(sec));
          const actief = mijn.filter(o => (o.secties||{})[sec] !== 'klaar').sort(spoedEerst);
          const klaarHier = mijn.filter(o => (o.secties||{})[sec] === 'klaar');
          const kaart = (o, dim) => {
            const items = (o.items||[]).filter(it => sectieOf(it) === sec);
            const a = ageMin(o.at);
            const tier = dim ? '' : ageKlasse(a);
            const fase = (o.secties||{})[sec];
            const advies = dim ? null : vuurplan(o).plan[sec];
            return '<div class="tkc'+tier+(dim?' dim':'')+'">'+
              '<div class="tkc-top"><span class="tkc-code">'+o.pickup+(o.table?' <span class="txt-md">\uD83E\uDE91 '+o.table+'</span>':'')+'</span><span class="tkc-age">'+a+' min</span></div>'+
              '<div class="tkc-who">'+o.customerCodename+' \u00b7 '+o.ref+'</div>'+
              '<div class="tkc-items">'+items.map(it=>'<span class="rcp-item" data-rcp="'+it.id+'"><b>'+it.qty+'\u00d7</b>'+it.name+'</span>').join('')+'</div>'+
              (o.allergyNote?'<div class="tkc-alg">\u26a0 '+o.allergyNote+'</div>':'')+
              (advies?'<div class="st-badges">'+vpChip(sec, advies)+'</div>':'')+
              (dim?'':'<div class="tkc-act">'+(!fase?'<button class="tkc-start" data-secgo="'+o.ref+'" data-phase="bezig">'+T('st.start','Start')+'</button>':'')+
                '<button class="tkc-ready" data-secgo="'+o.ref+'" data-phase="klaar">'+T('st.ready','Klaar')+'</button></div>')+
            '</div>';
          };
          html += stStats(actief) + allDay(actief, sec) + overschotChips();
          // de bezetting: wie staat er op deze kant; het scherm rekent per kok
          const koks = ((state.lijn||{})[sec]) || [];
          const ikSta = koks.some(k => k.id === actor().staffId);
          const perKok = koks.length ? Math.ceil(actief.length / koks.length) : actief.length;
          html += '<div class="allday"><span class="ad-h">👥 '+T('lijn.h','Bezetting')+'</span>'+
            (koks.length ? '<span class="ad">'+koks.map(k=>k.name.split(' ')[0]).join(', ')+' · <b>'+perKok+'</b> '+T('lijn.perkok','bon(nen) p.p.')+'</span>' : '<span class="ad">'+T('lijn.leeg','Niemand aangemeld')+'</span>')+
            '<button class="obtn'+(ikSta?' primary':'')+'" data-lijnaan="'+sec+'">'+(ikSta?'✔ '+T('lijn.af','Aangemeld, tik om af te melden'):T('lijn.aan','Meld je aan op deze kant'))+'</button></div>';
          // maak nu: wat deze kant NU in een keer maakt, gebundeld over de bonnen
          const nuPer = {};
          actief.forEach(o => {
            const p = vuurplan(o).plan[sec];
            if (!p || (p.doe !== 'nu' && p.doe !== 'bezig')) return;
            (o.items||[]).forEach(it => { if (sectieOf(it) === sec){ const r = nuPer[it.name] = nuPer[it.name] || { n:0, bonnen:[] }; r.n += it.qty; r.bonnen.push(o.pickup); } });
          });
          minOverschot(nuPer);
          const nuRows = Object.entries(nuPer).sort((a,b)=>b[1].n-a[1].n);
          if (nuRows.length)
            html += '<div class="tkc" style="grid-column:1/-1;border-top:4px solid #2E7D5B;"><h3>🔥 '+T('lijn.maaknu','Maak nu, in een keer')+'</h3>'+
              nuRows.map(([naam,r])=>'<div class="st-row"><span><b style="color:var(--gold);">'+r.n+'×</b> '+naam+'<span class="sub">'+T('lijn.bonnen','bonnen ')+[...new Set(r.bonnen)].join(', ')+'</span></span></div>').join('')+'</div>';
          // tussendoor: slim gebruik van de wachttijd (voorbereiden, MEP, de lijn)
          const straks = {};
          actief.forEach(o => {
            const p = vuurplan(o).plan[sec];
            if (!p || p.doe !== 'wacht') return;
            (o.items||[]).forEach(it => { if (sectieOf(it) === sec){ const r = straks[it.name] = straks[it.name] || { n:0, min:p.min }; r.n += it.qty; r.min = Math.min(r.min, p.min); } });
          });
          const straksRows = Object.entries(straks).sort((a,b)=>a[1].min-b[1].min).slice(0,6);
          const dmsK = (state.dailyMeps||{})[new Date().toISOString().slice(0,10)];
          const mepOpen = dmsK ? (dmsK.tasks||[]).filter(x=>!x.done).slice(0,3) : [];
          if (straksRows.length || mepOpen.length || !actief.length)
            html += '<div class="tkc" style="grid-column:1/-1;"><h3>⏳ '+T('lijn.tussendoor','Tussendoor')+'</h3>'+
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
