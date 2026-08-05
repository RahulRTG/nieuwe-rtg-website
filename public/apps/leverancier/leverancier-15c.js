    if (kantoorSec === 'thuis'){
      // het THUIS-KANTOOR: de zaak als host op RTG Thuis (verhuur onder de
      // zaaknaam) -- dashboard, aanvragen, aanbod, prijsadvies en blokkades
      if (!thuisData){
        if (!thuisBusy){
          thuisBusy = true;
          Promise.all([API.call('/supplier/thuis/bord', {}), API.call('/supplier/thuis/huizen', {}), API.call('/supplier/thuis/zakelijkbord', {})])
            .then(function(u){ thuisData = { bord: u[0], huizen: u[1].huizen, z: u[2] }; })
            .catch(function(e){ thuisData = { error: e.message }; })
            .then(function(){ thuisBusy = false; renderStation(); });
        }
        html += '<div class="tkc h-volbreed"><h3>'+T('th.kop','RTG Thuis')+'</h3><div class="tkc-who">'+T('kt.laden','Laden...')+'</div></div>';
      } else if (thuisData.error){
        html += '<div class="tkc h-volbreed"><h3>'+T('th.kop','RTG Thuis')+'</h3><div class="tkc-who">'+thuisData.error+'</div></div>';
      } else {
        const bord = thuisData.bord;
        html += '<div class="tkc" style="grid-column:1/-1;border-color:var(--gold);"><h3>'+T('th.bord','Het host-dashboard')+'</h3>'+
          '<div class="st-row"><span>'+T('th.live','Huizen live')+'</span><b>'+bord.live+' / '+bord.huizen+'</b></div>'+
          '<div class="st-row"><span>'+T('th.ink','Inkomsten (afgeronde verblijven)')+'</span><b style="color:var(--gold);">'+eur(bord.inkomstenTotaal)+'</b></div>'+
          '<div class="st-row"><span>'+T('th.bez','Bezetting komende 30 dagen')+'</span><b>'+bord.bezettingPct+'%</b></div>'+
          '<div class="st-row"><span>Superhost</span><b>'+(bord.superhost ? '★ '+T('th.ja','ja') : T('th.nog','nog niet (3 verblijven, gemiddeld 4,8+)'))+'</b></div>'+
          '<div class="tkc-who">'+T('th.uitbet','Uitbetalingen staan gepland naar de zakelijke RTG Rekening; RTG houdt 0% in. Gasten zien uw zaaknaam als host.')+'</div></div>';
        html += '<div class="tkc h-volbreed"><h3>'+T('th.aanvragen','Aanvragen')+' ('+bord.aanvragen.length+')</h3>'+
          (bord.aanvragen.length ? bord.aanvragen.map(function(a){
            return '<div class="st-row"><span><b>'+escT(a.titel)+'</b> · '+escT(a.van)+' → '+escT(a.tot)+' · '+a.gasten+' '+T('th.gasten','gasten')+
              '<span class="sub">'+T('th.gast','gast')+' '+escT(a.gast)+(a.gastRating ? ' · ★ '+a.gastRating : '')+' · '+eur(a.prijsopbouw.totaal)+'</span></span>'+
              '<span><button class="obtn primary" data-thok="'+escT(a.ref)+'">'+T('th.ok','Accepteer')+'</button> <button class="obtn" data-thnee="'+escT(a.ref)+'">'+T('th.nee','Wijs af')+'</button></span></div>';
          }).join('') : '<div class="tkc-who">'+T('th.geenaanvr','Geen openstaande aanvragen.')+'</div>')+'</div>';
        html += '<div class="tkc h-volbreed"><h3>'+T('th.komend','Komende en lopende verblijven')+'</h3>'+
          (bord.komend.length ? bord.komend.map(function(k){
            return '<div class="st-row"><span>'+escT(k.titel)+' · '+escT(k.van)+' → '+escT(k.tot)+'<span class="sub">'+escT(k.status)+' · '+T('th.gast','gast')+' '+escT(k.gast)+'</span></span>'+
              (k.status === 'ingecheckt' ? '<button class="obtn" data-thuit="'+escT(k.ref)+'">'+T('th.uit','Check uit')+'</button>' : '')+'</div>';
          }).join('') : '<div class="tkc-who">'+T('th.geenkomend','Nog niets geboekt.')+'</div>')+'</div>';
        /* de commerciele tak: wat een zaak anders maakt dan een prive-host --
           logies-btw uit de landtabel, langverblijf, factuur en de commissie */
        const zb = thuisData.z || {};
        const zHuizen = zb.huizen || [];
        const zVan = function(id){ for (var i=0;i<zHuizen.length;i++) if (zHuizen[i].id === id) return zHuizen[i]; return null; };
        html += '<div class="tkc" style="grid-column:1/-1;border-color:var(--gold);"><h3>'+T('th.zkop','De commerciele tak')+'</h3>'+
          '<div class="st-row"><span>'+T('th.zport','Commercieel aanbod (live)')+'</span><b>'+((zb.portefeuille||{}).live||0)+' / '+((zb.portefeuille||{}).commercieel||0)+'</b></div>'+
          '<div class="st-row"><span>'+T('th.zverb','Afgeronde verblijven')+'</span><b>'+(zb.verblijven||0)+' · '+(zb.nachten||0)+' '+T('th.znachten','nachten')+'</b></div>'+
          '<div class="st-row"><span>'+T('th.zomzet','Omzet exclusief btw')+'</span><b>'+eur(zb.omzetExclBtw||0)+'</b></div>'+
          '<div class="st-row"><span>'+T('th.zbtw','Logies-btw af te dragen')+'</span><b>'+eur(zb.btwAfTeDragen||0)+'</b></div>'+
          '<div class="st-row"><span>'+T('th.zcomm','Partnercommissie')+' ('+(zb.commissiePct||0)+'%)</span><b>'+eur(zb.commissie||0)+'</b></div>'+
          '<div class="st-row"><span>'+T('th.znetto','Netto uitbetaling (gepland)')+'</span><b style="color:var(--gold);">'+eur(zb.nettoUitbetaling||0)+'</b></div>'+
          '<div class="tkc-who">'+escT(zb.uitleg || T('th.zuit','Zet een huis commercieel om er beroepsmatig mee te verhuren: logies-btw uit de landtabel, langverblijf op maandtarief en boeken op factuur.'))+'</div></div>';
        html += '<div class="tkc h-volbreed"><h3>'+T('th.huizen','Ons aanbod op RTG Thuis')+'</h3>'+
          (thuisData.huizen.length ? thuisData.huizen.map(function(h){
            const zk = zVan(h.id);
            return '<div class="st-row"><span><b>'+escT(h.titel)+'</b> · '+escT(h.plaats)+' · '+eur(h.prijs)+'/'+T('th.nacht','nacht')+
              (h.rating.sterren ? ' · ★ '+h.rating.sterren : '')+(h.live ? '' : ' · '+T('th.pauze','gepauzeerd'))+
              (zk ? ' · <span style="color:var(--gold);">'+T('th.zcom','commercieel')+' · btw '+zk.btwPct+'%'+(zk.zakelijk.maandprijs?' · '+eur(zk.zakelijk.maandprijs)+'/'+T('th.zmaand','maand'):'')+'</span>' : '')+
              '<span class="sub" data-thadvuit="'+escT(h.id)+'">'+(h.instant?T('th.instant','instant boeken'):T('th.opaanvraag','op aanvraag'))+(h.keyless?' · keyless':'')+'</span></span>'+
              '<span><button class="obtn" data-thzak="'+escT(h.id)+'" data-thzaan="'+(zk?'1':'0')+'">'+(zk?T('th.zuitzet','Terug naar prive'):T('th.zaanzet','Maak commercieel'))+'</button> '+
              '<button class="obtn" data-thadv="'+escT(h.id)+'">'+T('th.advies','AI-prijsadvies')+'</button> <button class="obtn" data-thblok="'+escT(h.id)+'">'+T('th.blok','Blokkeer')+'</button></span></div>';
          }).join('') : '<div class="tkc-who">'+T('th.geenhuizen','Nog geen huizen; zet er hieronder een live.')+'</div>')+'</div>';
        html += '<div class="tkc h-volbreed"><h3>'+T('th.nieuw','Zet een huis live (manager)')+'</h3>'+
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">'+
          '<input class="st-in" id="thTitel" placeholder="'+T('th.titel','Titel')+'" style="flex:2;min-width:150px;">'+
          '<input class="st-in" id="thPlaats" placeholder="'+T('th.plaats','Plaats')+'" style="flex:1;min-width:110px;">'+
          '<select class="st-in" id="thType" style="flex:1;min-width:110px;"><option value="villa">Villa</option><option value="appartement">Appartement</option><option value="huis">Huis</option><option value="kamer">'+T('th.kamer','Privekamer')+'</option><option value="boot">'+T('th.boot','Woonboot')+'</option><option value="natuur">'+T('th.natuur','Natuurhuisje')+'</option></select>'+
          '<input class="st-in" id="thPrijs" type="number" min="1" value="150" style="flex:1;min-width:80px;" placeholder="€/'+T('th.nacht','nacht')+'">'+
          '<input class="st-in" id="thGasten" type="number" min="1" max="20" value="4" style="flex:1;min-width:70px;" placeholder="'+T('th.gasten','gasten')+'">'+
          '<label style="font-size:0.8rem;display:flex;gap:0.3rem;align-items:center;"><input type="checkbox" id="thInstant" checked> instant</label>'+
          '<label style="font-size:0.8rem;display:flex;gap:0.3rem;align-items:center;"><input type="checkbox" id="thKeyless" checked> keyless</label>'+
          '<button class="obtn primary" id="thZet">'+T('th.zet','Zet live')+'</button></div>'+
          '<div class="tkc-who">'+T('th.zet.s','Alle premium functies zijn inbegrepen: instant of aanvraag, kortingen, borg, keyless deurcodes, co-hosts en AI-prijsadvies. Leden betalen 0% servicekosten.')+'</div></div>';
      }
    }
