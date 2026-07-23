      const omzet = klaarVandaag.reduce((s2, r) => s2 + (r.quote || 0), 0);
      html += '<div class="st-sec">'+T('ch.mijn','Mijn rit')+' ('+actief.length+')</div>';
      html += actief.length ? actief.map(r => {
        const nxt = NEXT_RIDE[r.status];
        return '<div class="tkc" style="grid-column:1/-1;">'+
          '<div class="tkc-top"><span class="tkc-code" style="font-size:1.3rem;">'+r.customerCodename+'</span><span class="tkc-age">'+tStatus(r.status)+'</span></div>'+
          '<div class="tkc-who" style="font-size:0.95rem;">'+(r.from||'')+' → '+(r.to||T('sup.opendest','open bestemming'))+'</div>'+
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
      const kaartB = (b, acties) => '<div class="tkc" style="grid-column:1/-1;">'+
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
