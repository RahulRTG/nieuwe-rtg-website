    if (kantoorSec === 'bo'){
      // de eigen backoffice van de zaak, met dezelfde patronen als het
      // RTG-controlecentrum maar dan uitsluitend over dit bedrijf
      if (!boData){
        laadBackoffice();
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>📊 '+T('kt.bo','Backoffice')+'</h3><div class="tkc-who">'+T('kt.laden','Laden...')+'</div></div>';
      } else if (boData.error){
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>📊 '+T('kt.bo','Backoffice')+'</h3><div class="tkc-who">'+boData.error+'</div></div>';
      } else {
        const b = boData;
        html += '<div class="tkc" style="grid-column:1/-1;">'+
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:0.55rem;">'+
          [[T('bz.today','Omzet vandaag'), eur(b.stats.omzetVandaag)],
           [T('bz.trans','Transacties'), b.stats.transactiesVandaag],
           [T('bz.kassa','Waarvan kassa'), eur(b.stats.kassaVandaag)],
           [T('bz.week','Weekomzet'), eur(b.stats.omzetWeek)],
           [T('bz.binnen','Nu ingeklokt'), b.stats.binnenNu],
           [T('bz.acties','Open acties'), b.stats.openActies]]
          .map(x => '<div style="background:rgba(255,255,255,0.04);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;">'+
            '<div style="font-size:0.54rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+x[0]+'</div>'+
            '<div style="font-family:\'Bodoni Moda\',serif;font-size:1.2rem;color:var(--gold);margin-top:0.15rem;">'+x[1]+'</div></div>').join('')+'</div>'+
          '<div class="tkc-who" style="margin-top:0.5rem;">'+T('bz.nulcom','RTG rekent 0% commissie: deze omzet is volledig van u.')+'</div>'+
          '<button class="obtn" id="boBrief" style="align-self:flex-start;">📋 '+T('bz.brief','Dagbriefing')+'</button>'+
          '<div id="boBriefTxt" style="display:none;border:1px solid var(--gold);border-radius:12px;padding:0.7rem 0.9rem;font-size:0.82rem;line-height:1.6;"></div></div>';
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>🎯 '+T('bz.actie','Actiecentrum van de zaak')+'</h3>'+
          (b.alerts.length ? b.alerts.map(a =>
            '<div class="st-row"><span>'+(a.level==='rood'?'🔴':a.level==='amber'?'🟠':'🟢')+' '+a.text+'</span></div>').join('')
            : '<div class="tkc-who">✓ '+T('bz.niks','Alles loopt. Vastgelopen bestellingen, wachtende gasten en open personeelszaken verschijnen hier vanzelf.')+'</div>')+'</div>';
        // de voorspeller: eerlijk vooruitkijken op basis van het eigen ritme
        if (vwData && vwData.ok){
          const m = vwData.morgen;
          html += '<div class="tkc" style="grid-column:1/-1;"><h3>🔮 '+T('vw.h','Verwachting voor morgen')+'</h3>'+
            (m
              ? '<div class="tkc-who">'+T('vw.d','Op basis van uw eigen ritme van de afgelopen weken')+' ('+vwData.weken+' '+T('vw.weken','weken geschiedenis')+'): '+
                  '<b>'+m.verwachtTransacties+'</b> '+T('vw.trans','transacties')+' · <b>'+eur(m.verwachtCenten)+'</b> '+T('vw.omzet','omzet')+' ('+m.dagNaam+').'+
                  (m.drukUren.length ? ' '+T('vw.druk','Drukste uren')+': '+m.drukUren.map(u => u.uur+':00').join(', ')+'.' : '')+
                  ((vwData.vasteGasten||[]).length ? ' '+T('vw.gast','Vaste gasten')+': '+vwData.vasteGasten.map(g => g.codenaam).join(', ')+'.' : '')+
                  (m.advies ? '<br>🧭 '+m.advies : '')+
                  (m.bevoorrading ? '<br>📦 '+m.bevoorrading : '')+'</div>'
              : '<div class="tkc-who">'+(vwData.uitleg||'')+'</div>')+'</div>';
        }
        // baas over uw zaak: elke functie aan of uit; alleen app-betalen heeft
        // bewust geen knop, wel kiest u het moment (vooraf of achteraf)
        const caps2 = (S && S.caps) || [];
        const inst = state.settings || {};
        const optAan = k => !inst.opties || inst.opties[k] !== false;
        const rijen = [];
        if (caps2.includes('menu') || caps2.includes('rooms')){
          rijen.push(['ordersOpen', T('sw.orders','Bestellen via de app'), T('sw.orders.s','Leden kunnen bij u bestellen'), inst.ordersOpen !== false]);
          rijen.push(['reservationsOpen', T('sw.res','Reserveringen'), T('sw.res.s','Nieuwe reserveringen aannemen'), inst.reservationsOpen !== false]);
        }
        rijen.push(['betaalVooraf', T('sw.vooraf','Vooraf betalen'), T('sw.vooraf.s','Uit = gasten betalen achteraf. Betalen zelf gaat altijd via de app.'), optAan('betaalVooraf')]);
        rijen.push(['gastchat', T('sw.chat','Gastchat'), T('sw.chat.s','Gasten kunnen uw team berichten sturen'), optAan('gastchat')]);
        if (caps2.includes('rides')) rijen.push(['ritten', T('sw.ritten','Ritaanvragen'), T('sw.ritten.s','Nieuwe ritten aannemen via de app'), optAan('ritten')]);
        if (caps2.includes('doors')) rijen.push(['deurenGast', T('sw.deuren','Digitale gastsleutel'), T('sw.deuren.s','Gearriveerde gasten openen zelf de voordeur'), optAan('deurenGast')]);
        if (horeca) rijen.push(['events', T('sw.events','Event-aanmeldingen'), T('sw.events.s','Leden kunnen zich aanmelden voor uw events'), optAan('events')]);
        const swRows = rijen.map(r =>
          '<div class="st-row"><span>'+r[1]+'<span class="sub">'+r[2]+'</span></span>'+
          '<button class="obtn'+(r[3]?' primary':' warn')+'" data-kopt="'+r[0]+'" data-val="'+(r[3]?'0':'1')+'">'+(r[3]?T('sw.aan','Aan'):T('sw.uit','Uit'))+'</button></div>').join('');
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>🎛 '+T('sw.h','Baas over uw zaak')+'</h3>'+
          '<div class="tkc-who">'+T('sw.s','Zet elke functie aan of uit wanneer u dat wilt. Alleen betalen via de app staat altijd aan; het moment (vooraf of achteraf) bepaalt u zelf.')+'</div>'+
          funcBlok(T('sw.blok','Schakelaars'), rijen.map(r => ({ aan: r[3] })), swRows)+
          '<div class="st-row"><span>'+T('sw.apppay','Betalen via de app')+'<span class="sub">'+T('sw.apppay.s','Vast onderdeel van elk RTG-partnerschap')+'</span></span>'+
          '<span class="pill klaar">'+T('sw.altijd','Altijd aan')+'</span></div></div>';
        const maxD = Math.max.apply(null, b.week.map(d => d.omzet).concat([1]));
        html += '<div class="tkc"><h3>📈 '+T('bz.weekh','Omzet per dag')+'</h3>'+
          '<div style="display:flex;align-items:flex-end;gap:0.45rem;height:120px;margin-top:0.4rem;">'+
          b.week.map((d, i) =>
            '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:0.2rem;height:100%;min-width:0;">'+
            '<span style="font-size:0.54rem;color:var(--soft);white-space:nowrap;">'+(d.omzet?eur(d.omzet):'·')+'</span>'+
            '<i style="display:block;width:100%;max-width:32px;border-radius:5px 5px 2px 2px;min-height:2px;height:'+Math.max(2, Math.round(d.omzet/maxD*70))+'%;background:'+(i===6?'var(--burgundy)':'var(--gold)')+';"></i>'+
            '<span style="font-size:0.52rem;color:var(--soft);text-transform:uppercase;">'+d.label+'</span></div>').join('')+'</div></div>';
        html += '<div class="tkc"><h3>🏆 '+T('bz.top','Toppers')+'</h3>'+
          (b.toppers.length ? b.toppers.map((t2, i) =>
            '<div class="st-row"><span>'+(['🥇','🥈','🥉'][i]||'')+' '+t2.naam+'<span class="sub">'+t2.aantal+'x '+T('bz.verkocht','verkocht')+'</span></span><b style="color:var(--gold);">'+eur(t2.omzet)+'</b></div>').join('')
            : '<div class="tkc-who">'+T('bz.geentop','Nog geen verkopen. Zodra er via de app of de kassa verkocht wordt, staan de toppers hier.')+'</div>')+'</div>';
      }
    }
