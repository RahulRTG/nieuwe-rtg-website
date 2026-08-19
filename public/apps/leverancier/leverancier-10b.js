/* de rittenkaart van een chauffeur */
          '<div class="tkc-who">'+ritRegel(r)+(r.vehicle?' ·  '+r.vehicle.name+' ('+(r.vehicle.plate||'')+')':'')+'</div>'+
          (r.note?'<div class="tkc-alg">'+r.note+'</div>':'')+
          (r.pickupEtaMin!=null && r.status==='onderweg' ? '<div class="tkc-who">~'+r.pickupEtaMin+' min '+T('ch.naargast','naar de gast')+'</div>':'')+
          (r.dropEtaMin!=null && r.status==='aan-boord' ? '<div class="tkc-who">~'+r.dropEtaMin+' min '+T('ch.naarbestemming','naar de bestemming')+'</div>':'')+
          (nxt?'<div class="tkc-act"><button class="tkc-ready" data-chgo="'+r.ref+'" data-st="'+nxt+'">'+T(RIDE_NEXT_LABEL[nxt], RIDE_NEXT_NL[nxt])+'</button></div>':'')+
        '</div>';
      }).join('') : '<div class="st-empty">'+T('ch.geenrit','Geen actieve rit. Neem hieronder een open rit aan.')+'</div>';
      html += '<div class="st-sec">'+T('ch.open','Open ritten')+' ('+open.length+')</div>';
      html += open.length ? open.map(r =>
        '<div class="tkc">'+
          '<div class="tkc-top"><span class="tkc-code">'+r.customerCodename+'</span><span class="tkc-age">'+timeAgo(r.at)+'</span></div>'+
          '<div class="tkc-who">'+(r.from||'')+' → '+(r.to||T('sup.opendest','open bestemming'))+'</div>'+
          '<div class="tkc-who">'+ritRegel(r)+' · '+r.when+'</div>'+
          '<div class="tkc-act"><button class="tkc-start" data-chneem="'+r.ref+'">'+T('ch.neem','Neem deze rit')+'</button></div>'+
        '</div>'
      ).join('') : '<div class="st-empty">'+T('ch.geenopen','Geen open aanvragen. Nieuwe ritten verschijnen hier vanzelf.')+'</div>';
      if (gepland.length){
        html += '<div class="st-sec">'+T('ch.gepland','Gepland')+' ('+gepland.length+')</div>';
        html += gepland.map(r =>
          '<div class="tkc dim">'+
            '<div class="tkc-top"><span class="tkc-code">'+r.customerCodename+'</span><span class="tkc-age"></span></div>'+
            '<div class="tkc-who">'+(r.from||'')+' → '+(r.to||T('sup.opendest','open bestemming'))+'</div>'+
            '<div class="tkc-who">'+ritRegel(r)+' · <b>'+r.when+'</b></div>'+
            '<div class="tkc-act"><button class="tkc-start" data-chneem="'+r.ref+'">'+T('ch.neem','Neem deze rit')+'</button></div>'+
          '</div>'
        ).join('');
      }
      html += '<div class="st-sec">'+T('ch.vandaag','Vandaag')+'</div>'+
        '<div class="tkc"><div class="tkc-top"><span style="font-weight:600;">'+klaarVandaag.length+' '+T('ch.ritten','rit(ten) afgerond')+'</span>'+
        '<span class="tkc-code">'+eur(omzet)+'</span></div><div class="tkc-who">'+T('ch.netto','Volledig voor de zaak: RTG rekent 0% commissie.')+'</div></div>';
    } else if (stationMode === 'agenda'){
      // de agenda van de zelfstandige professional: aanvragen bevestigen,
      // leveren en afronden, met de verdiensten van vandaag eronder
      const bs = state.boekingen || [];
      const openB = bs.filter(b => b.status === 'aangevraagd');
      const komend = bs.filter(b => b.status === 'bevestigd');
      const vandaagB = new Date().toISOString().slice(0, 10);
      const klaarB = bs.filter(b => b.status === 'afgerond' && String(b.finishedAt || b.at).slice(0, 10) === vandaagB);
      const omzetB = klaarB.reduce((x, b) => x + (b.price || 0), 0);
      const kaartB = (b, acties) => '<div class="tkc h-volbreed">'+
        '<div class="tkc-top"><span class="tkc-code" style="font-size:1.2rem;">'+b.customerCodename+'</span><span class="tkc-age">'+(b.wanneer || timeAgo(b.at))+'</span></div>'+
        '<div class="tkc-who" style="font-size:0.95rem;">'+(b.service.soort==='product'?'':'')+b.service.name+(b.service.duurMin?' · '+b.service.duurMin+' min':'')+' · <b style="color:var(--gold);">'+eur(b.price)+'</b></div>'+
        (b.note?'<div class="tkc-alg">'+b.note+'</div>':'')+
        (b.zorg?'<div class="tkc-alg" style="color:#E2B93B;">'+T('sup.zorgp','Zorgprofiel gast:')+' '+[((b.zorg.allergenen||[]).length?T('zorg.allergie','Allergie')+': '+b.zorg.allergenen.join(', '):''), b.zorg.dieet, b.zorg.medisch].filter(Boolean).join(' · ')+'</div>':'')+
        (acties?'<div class="tkc-act">'+acties+'</div>':'')+
      '</div>';
      html += '<div class="st-sec">'+T('ag.open','Nieuwe aanvragen')+' ('+openB.length+')</div>';
      html += openB.length ? openB.map(b => kaartB(b,
        '<button class="tkc-start" data-bkgo="'+b.ref+'" data-st="bevestigd">'+T('ag.bevestig','Bevestig')+'</button>'+
        '<button class="obtn warn" data-bkgo="'+b.ref+'" data-st="geweigerd" style="margin-left:0.5rem;">'+T('ag.weiger','Weiger')+'</button>')).join('')
        : '<div class="st-empty">'+T('ag.geenopen','Geen nieuwe aanvragen. Leden boeken uw diensten en producten via de RTG-app; betaald is definitief.')+'</div>';
      html += '<div class="st-sec">'+T('ag.komend','Bevestigd')+' ('+komend.length+')</div>';
      html += komend.length ? komend.map(b => kaartB(b,
        '<button class="tkc-ready" data-bkgo="'+b.ref+'" data-st="afgerond">'+T('ag.rondaf','Rond af')+'</button>')).join('')
        : '<div class="st-empty">'+T('ag.geenkomend','Nog niets bevestigd.')+'</div>';
      html += '<div class="st-sec">'+T('ch.vandaag','Vandaag')+'</div>'+
        '<div class="tkc"><div class="tkc-top"><span style="font-weight:600;">'+klaarB.length+' '+T('ag.klaar','afspraak/afspraken afgerond')+'</span>'+
        '<span class="tkc-code">'+eur(omzetB)+'</span></div><div class="tkc-who">'+T('ch.netto','Volledig voor de zaak: RTG rekent 0% commissie.')+'</div></div>';
    } else {
      const st = stationMode;
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
          html += '<div class="allday"><span class="ad-h">'+T('lijn.h','Bezetting')+'</span>'+
            (koks.length ? '<span class="ad">'+koks.map(k=>k.name.split(' ')[0]).join(', ')+' · <b>'+perKok+'</b> '+T('lijn.perkok','bon(nen) p.p.')+'</span>' : '<span class="ad">'+T('lijn.leeg','Niemand aangemeld')+'</span>')+
            '<button class="obtn'+(ikSta?' primary':'')+'" data-lijnaan="'+sec+'">'+(ikSta?'✓ '+T('lijn.af','Aangemeld, tik om af te melden'):T('lijn.aan','Meld je aan op deze kant'))+'</button></div>';
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
            html += '<div class="tkc" style="grid-column:1/-1;border-top:4px solid #2E7D5B;"><h3>'+T('lijn.maaknu','Maak nu, in een keer')+'</h3>'+
              nuRows.map(([naam,r])=>'<div class="st-row"><span><b style="color:var(--gold);">'+r.n+'×</b> '+naam+'<span class="sub">'+T('lijn.bonnen','bonnen ')+[...new Set(r.bonnen)].join(', ')+'</span></span></div>').join('')+'</div>';
          // tussendoor: slim gebruik van de wachttijd (voorbereiden, MEP, de lijn)
          const straks = {};
          actief.forEach(o => {
            const p = vuurplan(o).plan[sec];
            if (!p || p.doe !== 'wacht') return;
            (o.items||[]).forEach(it => { if (sectieOf(it) === sec){ const r = straks[it.name] = straks[it.name] || { n:0, min:p.min }; r.n += it.qty; r.min = Math.min(r.min, p.min); } });
