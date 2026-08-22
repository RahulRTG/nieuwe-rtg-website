    /* Een gezette handtekening terugtekenen: de paden staan in verhoudingen
       (0 tot 1), dus hij past op elk formaat. */
    function handtekeningSvg(paden){
      if (!paden || !paden.length) return '';
      const d = paden.map(function(p){
        return 'M' + p.map(function(pt){ return (pt[0]*160).toFixed(1)+' '+(pt[1]*54).toFixed(1); }).join(' L');
      }).join(' ');
      return '<svg viewBox="0 0 160 54" width="120" height="40" aria-label="handtekening" style="vertical-align:middle;">'+
        '<path d="'+d+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
    }

    if (kantoorSec === 'werkvloer'){
      /* DE WERKVLOER: het bureau-scherm van de koppellaag (wat staat er op
         het andere scherm klaar), de tafellijst met wensen en allergenen,
         en de checklijsten die met het team zijn gedeeld. */
      if (!wvData){
        if (!wvBusy){
          wvBusy = true;
          Promise.all([API.call('/werkvloer/koppel', {}), API.call('/werkvloer/keukenbord', {}), API.call('/werkvloer/checklijsten', {})])
            .then(function(u){ wvData = { koppel: u[0], keuken: u[1], chk: u[2] }; })
            .catch(function(e){ wvData = { error: e.message }; })
            .then(function(){ wvBusy = false; renderStation(); });
        }
        html += '<div class="tkc h-volbreed"><h3>'+T('wv.kop','Werkvloer')+'</h3><div class="tkc-who">'+T('kt.laden','Laden...')+'</div></div>';
      } else if (wvData.error){
        html += '<div class="tkc h-volbreed"><h3>'+T('wv.kop','Werkvloer')+'</h3><div class="tkc-who">'+wvData.error+'</div></div>';
      } else {
        const tabs = [['koppel', T('wv.t1','Het andere scherm')], ['tafels', T('wv.t2','Tafels & allergenen')], ['chk', T('wv.t3','Checklijsten')]];
        html += '<div class="tkc h-volbreed"><div style="display:flex;gap:0.4rem;flex-wrap:wrap;">'+
          tabs.map(function(t){ return '<button class="obtn'+(wvTab===t[0]?' primary':'')+'" data-wvtab="'+t[0]+'">'+escT(t[1])+'</button>'; }).join('')+'</div></div>';

        if (wvTab === 'koppel'){
          const k = wvData.koppel;
          html += '<div class="tkc" style="grid-column:1/-1;border-color:var(--gold);"><h3>'+T('wv.koppel','Zet klaar voor het andere scherm')+'</h3>'+
            '<div class="tkc-who">'+escT(k.uitleg)+'</div>'+
            '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem;">'+
            '<select class="st-in" id="wvSoort" style="flex:1;min-width:150px;">'+
              '<option value="betaal">'+T('wv.s1','Betalen op afstand')+'</option>'+
              '<option value="verzenden">'+T('wv.s2','Aftekenen voor verzending')+'</option>'+
              '<option value="ontvangst">'+T('wv.s3','Tekenen voor ontvangst')+'</option></select>'+
            '<input class="st-in" id="wvTitel" placeholder="'+T('wv.titel','Waar gaat het over?')+'" style="flex:2;min-width:160px;">'+
            '<input class="st-in" id="wvBedrag" type="number" min="0" step="0.01" placeholder="'+T('wv.bedrag','Bedrag (alleen bij betalen)')+'" style="flex:1;min-width:120px;">'+
            '<input class="st-in" id="wvRef" placeholder="'+T('wv.ref','Bon- of factuurnummer')+'" style="flex:1;min-width:120px;">'+
            '<button class="obtn primary" id="wvMaak">'+T('wv.zet','Zet klaar')+'</button></div></div>';
          html += '<div class="tkc h-volbreed"><h3>'+T('wv.open','Openstaand en afgerond')+' ('+k.open+' '+T('wv.openn','open')+')</h3>'+
            (k.verzoeken.length ? k.verzoeken.map(function(v){
              const st = v.status === 'open' ? T('wv.st.open','wacht op het andere scherm')
                : v.status === 'getekend' ? T('wv.st.get','getekend')
                : v.status === 'betaald' ? T('wv.st.bet','betaald')
                : v.status === 'verlopen' ? T('wv.st.ver','verlopen') : T('wv.st.an','geannuleerd');
              return '<div class="st-row"><span><b>'+escT(v.titel)+'</b> · '+escT(v.soortLabel)+(v.bedrag?' · '+eur(v.bedrag):'')+
                '<span class="sub">'+escT(st)+' · '+T('wv.door','door')+' '+escT(v.door)+
                (v.handtekening ? ' · '+T('wv.getdoor','getekend door')+' '+escT(v.handtekening.door) : '')+
                (v.betaald ? ' · '+escT(v.betaald.hoe)+(v.betaald.ref?' '+escT(v.betaald.ref):'') : '')+'</span></span>'+
                '<span>'+(v.status === 'open' && v.soort === 'betaal' ? '<button class="obtn" data-wvbet="'+escT(v.id)+'">'+T('wv.gemeld','Betaling melden')+'</button> ' : '')+
                (v.status === 'open' ? '<button class="obtn" data-wvann="'+escT(v.id)+'">'+T('wv.stop','Intrekken')+'</button>' : '')+
                (v.handtekening ? handtekeningSvg(v.handtekening.paden) : '')+'</span></div>';
            }).join('') : '<div class="tkc-who">'+T('wv.niets','Niets klaargezet. Begin hierboven; wat u klaarzet staat meteen op uw telefoon.')+'</div>')+'</div>';
        }

        if (wvTab === 'tafels'){
          const kb = wvData.keuken;
          html += '<div class="tkc" style="grid-column:1/-1;border-color:var(--gold);"><h3>'+T('wv.keuken','Het keukenbord')+'</h3>'+
            '<div class="st-row"><span>'+T('wv.gasten','Gasten op de lijst')+'</span><b>'+kb.gasten+'</b></div>'+
            '<div class="st-row"><span>'+T('wv.metall','Tafels met een allergeen')+'</span><b style="color:var(--rtg-leesgoud,var(--gold));">'+kb.tafelsMetAllergeen+'</b></div>'+
            (kb.samen.length ? kb.samen.map(function(r){
              return '<div class="st-row"><span>'+(r.soort==='allergeen'?'<b style="color:var(--rtg-leesgoud,var(--gold));">'+escT(r.wat)+'</b>':escT(r.wat))+
                '<span class="sub">'+T('wv.optafels','op tafel')+' '+escT(r.tafels.join(', '))+'</span></span><b>'+r.aantal+'x</b></div>';
            }).join('') : '<div class="tkc-who">'+T('wv.geentafels','Nog geen tafels op de lijst.')+'</div>')+
            '<div class="tkc-who">'+escT(kb.regel)+'</div></div>';
          html += '<div class="tkc h-volbreed"><h3>'+T('wv.tafels','De tafels')+'</h3>'+
            kb.tafels.map(function(t){
              return '<div class="st-row"><span><b>'+T('wv.tafel','Tafel')+' '+escT(t.tafel)+'</b>'+(t.event?' · '+escT(t.event):'')+' · '+t.aantalGasten+' '+T('wv.pers','personen')+
                '<span class="sub">'+(t.telling.length ? t.telling.map(function(r){ return escT(r.wat)+' '+r.aantal+'x'; }).join(' · ') : T('wv.geenbijz','geen bijzonderheden'))+'</span></span>'+
                '<button class="obtn" data-wvkaart="'+escT(t.id)+'">'+T('wv.kaart','Bedieningskaart')+'</button></div>';
            }).join('')+
            '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.6rem;">'+
            '<input class="st-in" id="wvTafel" placeholder="'+T('wv.tafelnr','Tafel')+'" style="flex:1;min-width:80px;">'+
            '<input class="st-in" id="wvEvent" placeholder="'+T('wv.event','Event (optioneel)')+'" style="flex:1;min-width:130px;">'+
            '<input class="st-in" id="wvGasten" type="number" min="1" max="30" value="4" style="flex:1;min-width:80px;" placeholder="'+T('wv.aantal','Personen')+'">'+
            '<button class="obtn primary" id="wvTafelZet">'+T('wv.tafelbij','Tafel bijzetten')+'</button></div>'+
            '<div class="tkc-who">'+T('wv.tafeluit','Zet de tafel hier neer en vul de wensen per stoel aan op de telefoon, aan tafel, waar de gast ze vertelt.')+'</div></div>';
        }

        if (wvTab === 'chk'){
          const c = wvData.chk;
          html += '<div class="tkc h-volbreed"><h3>'+T('wv.chk','Checklijsten')+'</h3>'+
            '<div class="tkc-who">'+escT(c.uitleg)+'</div>'+
            (c.lijsten.length ? c.lijsten.map(function(l){
              return '<div class="st-row"><span><b>'+escT(l.titel)+'</b>'+(l.event?' · '+escT(l.event):'')+
                '<span class="sub">'+l.af+'/'+l.totaal+' ('+l.pct+'%) · '+T('wv.meedoen','meedoen')+': '+escT(l.meedoen.join(', '))+'</span></span>'+
                '<span>'+(l.klaar?'<b style="color:var(--rtg-leesgoud,var(--gold));">'+T('wv.af','af')+'</b> ':'')+
                '<button class="obtn" data-wvdeel="'+escT(l.id)+'">'+T('wv.deel','Delen met')+'</button></span></div>'+
                l.items.map(function(i){
                  return '<div class="st-row" style="padding-left:1rem;"><span>'+(i.klaar?'✓ ':'○ ')+escT(i.tekst)+
                    (i.voor?' <span class="sub">'+T('wv.voor','voor')+' '+escT(i.voor)+'</span>':'')+
                    (i.klaar?'<span class="sub">'+T('wv.doorwie','afgevinkt door')+' '+escT(i.klaar.door)+'</span>':'')+'</span>'+
                    '<button class="obtn" data-wvvink="'+escT(l.id)+'" data-wvitem="'+escT(i.id)+'" data-wvaan="'+(i.klaar?'0':'1')+'">'+
                    (i.klaar?T('wv.terug','Terug'):T('wv.vink','Afvinken'))+'</button></div>';
                }).join('');
            }).join('') : '<div class="tkc-who">'+T('wv.geenchk','Nog geen checklijsten.')+'</div>')+
            '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.6rem;">'+
            '<input class="st-in" id="wvChkTitel" placeholder="'+T('wv.chktitel','Titel van de lijst')+'" style="flex:2;min-width:150px;">'+
            '<input class="st-in" id="wvChkEvent" placeholder="'+T('wv.event','Event (optioneel)')+'" style="flex:1;min-width:120px;">'+
            '<input class="st-in" id="wvChkItems" placeholder="'+T('wv.chkitems','Punten, gescheiden door een komma')+'" style="flex:2;min-width:180px;">'+
            '<input class="st-in" id="wvChkDeel" placeholder="'+T('wv.chkdeel','Delen met (namen, komma)')+'" style="flex:1;min-width:150px;">'+
            '<button class="obtn primary" id="wvChkMaak">'+T('wv.chkmaak','Maak de lijst')+'</button></div></div>';
        }
      }
    }
