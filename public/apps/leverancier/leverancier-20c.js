    /* Vakwerk Pro, tweede laag: vaste afspraken, wachtlijst, beoordelingen
       en de team-capaciteit -- ook dit elders betaalde functies. */
    if (kantoorSec === 'vandaag' && vakData && !vakData.error && vakPro && vakPro.ok){
      // vaste afspraken: het ritme per klant; de motor plant, u bevestigt
      if ((vakPro.ritmes || []).length) html += '<div class="tkc h-volbreed"><h3>'+T('vp.ritmes','Vaste afspraken')+' ('+vakPro.ritmes.length+')</h3>'+
        '<div class="tkc-who" style="margin-top:0;">'+T('vp.ritmes.s','Terugkerende klussen: de app plant telkens de volgende afspraak als aanvraag in; u bevestigt gewoon. Stoppen kan door beide kanten.')+'</div>'+
        vakPro.ritmes.map(r =>
          '<div class="st-row"><span>'+r.klant+'<span class="sub">'+r.dienst+' · '+(r.intervalWeken===1?T('vp.elkeweek','elke week'):T('vp.elke','elke')+' '+r.intervalWeken+' '+T('vp.weken','weken'))+' · '+r.tijd+' · '+T('vp.laatst','laatst')+' '+r.laatst+'</span></span>'+
          '<span class="acts"><button class="obtn warn" data-vprstop="'+r.id+'">'+T('vp.stop','Stop')+'</button></span></div>').join('')+'</div>';
      // de wachtlijst: wie wacht op een plek; uitnodigen is een seintje, geen boeking
      if ((vakPro.wachtlijst || []).length) html += '<div class="tkc h-volbreed"><h3>'+T('vp.wacht','Wachtlijst')+' ('+vakPro.wachtlijst.length+')</h3>'+
        '<div class="tkc-who" style="margin-top:0;">'+T('vp.wacht.s','Bij een geweigerde of vrijgevallen afspraak krijgt de eerste wachtende vanzelf bericht; uitnodigen kan ook met de hand. Het lid boekt altijd zelf.')+'</div>'+
        vakPro.wachtlijst.map(w =>
          '<div class="st-row"><span>'+w.klant+'<span class="sub">'+w.datum+(w.dienst?' · '+w.dienst:'')+'</span></span>'+
          '<span class="acts">'+(w.uitgenodigd?'<span class="sub">'+T('vp.uitgenodigd','uitgenodigd')+'</span>':'<button class="obtn" data-vpwnodig="'+w.id+'">'+T('vp.nodig','Nodig uit')+'</button>')+'</span></div>').join('')+'</div>';
      // beoordelingen: het gemiddelde en de laatste woorden van klanten
      if (vakPro.beoordelingen && vakPro.beoordelingen.score) html += '<div class="tkc h-volbreed"><h3>'+T('vp.reviews','Beoordelingen')+' · ✶ '+vakPro.beoordelingen.score.score+' ('+vakPro.beoordelingen.score.aantal+')</h3>'+
        vakPro.beoordelingen.recent.map(r =>
          '<div class="st-row"><span>✶ '+r.sterren+' · '+r.klant+'<span class="sub">'+r.dienst+(r.tekst?' · "'+r.tekst+'"':'')+' · '+r.datum+'</span></span></div>').join('')+'</div>';
      // team-capaciteit: zoveel vaklieden tegelijk, zoveel boekingen naast elkaar
      if (vakUren) html += '<div class="tkc h-volbreed"><h3>'+T('vp.cap','Team-capaciteit')+'</h3>'+
        '<div class="tkc-who" style="margin-top:0;">'+T('vp.cap.s','Hoeveel vaklieden werken er tegelijk? Zoveel boekingen mogen elkaar overlappen in de tijdvakken (1 = eenmanszaak).')+'</div>'+
        '<div class="row-gap"><input class="st-in" id="vpCap" type="number" min="1" max="20" value="'+(vakUren.capaciteit||1)+'" style="width:5.5rem;">'+
        '<button class="obtn" id="vpCapZet">'+T('vp.bewaar','Bewaar')+'</button></div></div>';
    }
