    /* Vakwerk Pro op het vandaag-bord: de functies waar vakbedrijven elders
       per maand voor betalen -- offertes, werkbonnen, het klantenboek en de
       onderhoudsherinneringen. Alles op codenaam. */
    if (kantoorSec === 'vandaag' && vakData && !vakData.error && vakPro && vakPro.ok){
      const open = vakPro.offertes.filter(o => o.status === 'aangevraagd');
      const gedaan = vakPro.offertes.filter(o => o.status !== 'aangevraagd').slice(0, 5);
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('vp.offertes','Offertes')+' ('+open.length+')</h3>'+
        '<div class="tkc-who" style="margin-top:0;">'+T('vp.offertes.s','Leden vragen vrije klussen aan; u antwoordt met een prijs. Bij akkoord staat de klus direct als bevestigde boeking in de agenda.')+'</div>'+
        (open.length ? open.map(o =>
          '<div class="st-row" style="flex-wrap:wrap;"><span style="flex:1 1 100%;">'+o.omschrijving+
            '<span class="sub">'+o.klant+(o.wens?' · '+T('vp.wens','gewenst')+' '+o.wens:'')+' · '+o.at.slice(0,10)+'</span></span>'+
          '<span class="acts" style="flex:1 1 100%;display:flex;gap:0.35rem;align-items:center;">'+
            '<input class="st-in" type="number" placeholder="€" data-vpprijs="'+o.id+'" style="flex:1;min-width:4rem;">'+
            '<input class="st-in" placeholder="'+T('vp.toel','Toelichting (optioneel)')+'" data-vptoel="'+o.id+'" style="flex:2;min-width:6rem;">'+
            '<button class="obtn primary" data-vpbied="'+o.id+'">'+T('vp.bied','Bied aan')+'</button>'+
            '<button class="obtn warn" data-vpwei="'+o.id+'">✕</button></span></div>').join('')
          : '<div class="tkc-who">'+T('vp.geenoff','Geen open offerte-aanvragen.')+'</div>')+
        (gedaan.length ? '<div class="tkc-who" style="margin-top:0.4rem;">'+gedaan.map(o => o.status+': '+o.omschrijving.slice(0,40)+(o.prijs?' ('+eur(o.prijs)+')':'')).join(' · ')+'</div>' : '')+'</div>';
      // werkbonnen: afgeronde klussen netjes afsluiten voor de klant
      if (vakPro.werkbonOpen.length) html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('vp.werkbon','Werkbonnen')+' ('+vakPro.werkbonOpen.length+')</h3>'+
        '<div class="tkc-who" style="margin-top:0;">'+T('vp.werkbon.s','Sluit een afgeronde klus af met een digitale werkbon; het lid ziet hem bij de boeking.')+'</div>'+
        vakPro.werkbonOpen.map(b =>
          '<div class="st-row" style="flex-wrap:wrap;"><span style="flex:1 1 100%;">'+b.dienst+'<span class="sub">'+b.klant+(b.datum?' · '+b.datum:'')+'</span></span>'+
          '<span class="acts" style="flex:1 1 100%;display:flex;gap:0.35rem;">'+
            '<input class="st-in" placeholder="'+T('vp.wbwerk','Uitgevoerd werk')+'" data-vpwbw="'+b.ref+'" style="flex:2;min-width:7rem;">'+
            '<input class="st-in" placeholder="'+T('vp.wbmat','Materiaal (optioneel)')+'" data-vpwbm="'+b.ref+'" style="flex:2;min-width:6rem;">'+
            '<button class="obtn primary" data-vpwb="'+b.ref+'">'+T('vp.wbdoe','Werkbon')+'</button></span></div>').join('')+'</div>';
      // het klantenboek: vaste klanten op codenaam, met een eigen notitie
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('vp.klanten','Klantenboek')+' ('+vakPro.klanten.length+')</h3>'+
        '<div class="tkc-who" style="margin-top:0;">'+T('vp.klanten.s','Uw klanten op codenaam: historie, omzet en uw eigen notitie. Echte namen kent dit boek bewust niet.')+'</div>'+
        (vakPro.klanten.length ? vakPro.klanten.slice(0,8).map(k =>
          '<div class="st-row" style="flex-wrap:wrap;"><span>'+k.codenaam+'<span class="sub">'+k.aantal+' '+(vakData.werkMv||'boekingen')+' · '+eur(k.omzet)+(k.laatste?' · '+T('vp.laatst','laatst')+' '+k.laatste:'')+'</span></span>'+
          '<span class="acts" style="flex:1 1 100%;display:flex;gap:0.35rem;">'+
            '<input class="st-in" placeholder="'+T('vp.notitie','Eigen notitie, bijv. sleutel bij de buren')+'" value="'+(k.notitie||'').replace(/"/g,'&quot;')+'" data-vpnin="'+k.codenaam+'" style="flex:1;">'+
            '<button class="obtn" data-vpnzet="'+k.codenaam+'">'+T('vp.bewaar','Bewaar')+'</button></span></div>').join('')
          : '<div class="tkc-who">'+T('vp.geenklant','Nog geen klanten; na de eerste boeking vult dit boek zichzelf.')+'</div>')+'</div>';
      // onderhoud: wie op basis van het herhaal-interval weer aan de beurt is
      if (vakPro.onderhoud.length) html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('vp.onderhoud','Onderhoud verlopen')+' ('+vakPro.onderhoud.length+')</h3>'+
        '<div class="tkc-who" style="margin-top:0;">'+T('vp.onderhoud.s','Deze klanten zijn volgens het herhaal-interval weer aan de beurt; een herinnering sturen kan een keer per 30 dagen.')+'</div>'+
        vakPro.onderhoud.map(o =>
          '<div class="st-row"><span>'+o.codenaam+'<span class="sub">'+o.dienst+' · '+T('vp.laatst','laatst')+' '+o.laatst+' · '+o.mndGeleden+' '+T('vp.mnd','mnd geleden')+'</span></span>'+
          '<span class="acts">'+(o.herinnerd?'<span class="sub">'+T('vp.herinnerd','herinnerd')+'</span>':'<button class="obtn" data-vpher="'+o.codenaam+'" data-vpherd="'+o.dienstId+'">'+T('vp.herinner','Herinner')+'</button>')+'</span></div>').join('')+'</div>';
    }
    if (kantoorSec === 'diensten'){
      // herhaal-onderhoud: een interval per dienst (bijv. APK: 12 maanden)
      const svv = (state.services || []).filter(x => (x.soort||'dienst') === 'dienst');
      if (svv.length) html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('vp.herhaal','Herhaal-onderhoud')+'</h3>'+
        '<div class="tkc-who" style="margin-top:0;">'+T('vp.herhaal.s','Geef een dienst een herhaal-interval in maanden; klanten die aan de beurt zijn verschijnen op het vandaag-bord.')+'</div>'+
        svv.map(x =>
          '<div class="st-row"><span>'+x.name+'<span class="sub">'+(x.herhaalMnd?T('vp.elke','elke')+' '+x.herhaalMnd+' '+T('vp.mnd2','maanden'):T('vp.geenherhaal','geen herhaling'))+'</span></span>'+
          '<span class="acts" style="display:flex;gap:0.35rem;"><input class="st-in" type="number" min="1" max="60" placeholder="'+T('vp.mnd2','maanden')+'" value="'+(x.herhaalMnd||'')+'" data-vphin="'+x.id+'" style="width:5.5rem;">'+
          '<button class="obtn" data-vphzet="'+x.id+'">'+T('vp.bewaar','Bewaar')+'</button></span></div>').join('')+'</div>';
    }
