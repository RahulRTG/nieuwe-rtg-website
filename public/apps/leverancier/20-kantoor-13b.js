  /* Het werkvenster (werkgever): wanneer mag personeel de werkomgeving in
     (leverancier-app en PDA), en wanneer niet. Per weekdag een tijdslot of de
     dag dicht; de manager valt er nooit onder. De server dwingt het af bij
     elke ingang (PIN-login en het ene RTG-account); dit paneel stelt het
     alleen in. Rahul adviseert los hiervan (agenda/uren), maar blokkeert
     nooit. Helpers voor 20-kantoor-02 (html) en 20-kantoor-10 (binden). */
  function werkvensterBlokHtml(inst){
    const wv = (inst && inst.werkvenster) || { aan: false, dagen: {}, vrijgesteld: [] };
    const DAG = [[1,T('wv.ma','ma')],[2,T('wv.di','di')],[3,T('wv.wo','wo')],[4,T('wv.do','do')],[5,T('wv.vr','vr')],[6,T('wv.za','za')],[0,T('wv.zo','zo')]];
    const rows = DAG.map(d => {
      const slot = wv.dagen[d[0]] || {};
      return '<div class="st-row" data-wvdag="'+d[0]+'" style="gap:0.5rem;">'+
        '<span style="min-width:2.2rem;text-transform:uppercase;font-size:0.68rem;">'+d[1]+'</span>'+
        '<input type="time" class="wv-van" value="'+(slot.van||'')+'" aria-label="'+T('wv.vanaf','Vanaf')+' '+d[1]+'" '+(slot.dicht?'disabled':'')+' style="background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:0.25rem 0.4rem;font-size:0.72rem;">'+
        '<input type="time" class="wv-tot" value="'+(slot.tot||'')+'" aria-label="'+T('wv.tot','Tot')+' '+d[1]+'" '+(slot.dicht?'disabled':'')+' style="background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:0.25rem 0.4rem;font-size:0.72rem;">'+
        '<button class="obtn'+(slot.dicht?' warn':'')+'" data-wvdicht="'+d[0]+'">'+(slot.dicht?T('wv.dicht','Dicht'):T('wv.open','Open'))+'</button></div>';
    }).join('');
    // de werkplek-zone: een punt met straal; buiten de zone geen werksessie,
    // tenzij iemand thuiswerk-toestemming heeft (dan werkt het overal, net
    // als op de desktop). De positie van het toestel wordt alleen op het
    // inlogmoment vergeleken en nooit opgeslagen.
    const plek = wv.plek || null;
    const veldStijl = 'background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:0.25rem 0.4rem;font-size:0.72rem;';
    const plekBlok = '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.55rem;">'+
      '<b style="font-size:0.78rem;">'+T('wv.plekh','Werkplek-zone')+'</b>'+
      '<div class="tkc-who">'+T('wv.pleks','Alleen op de werkplek inloggen: het toestel deelt bij het inloggen eenmalig zijn positie, de server vergelijkt die met deze zone en bewaart er niets van. Thuiswerk-toestemming per persoon heft de zone op.')+'</div>'+
      '<div class="st-row" style="gap:0.5rem;flex-wrap:wrap;">'+
      '<span style="flex:1;min-width:8rem;">'+(plek ? (plek.lat.toFixed(3))+', '+(plek.lng.toFixed(3))+' · '+plek.radiusM+' m' : T('wv.plekleeg','Nog geen zone ingesteld'))+'</span>'+
      '<input type="number" id="wvPlekStraal" min="50" max="50000" step="50" value="'+(plek?plek.radiusM:250)+'" aria-label="'+T('wv.straal','Straal in meters')+'" style="'+veldStijl+'width:5.5rem;">'+
      '<button class="obtn" id="wvPlekHier">'+T('wv.hier','Zet op mijn huidige locatie')+'</button>'+
      (plek ? '<button class="obtn'+(plek.aan?' primary':' warn')+'" id="wvPlekAan" data-val="'+(plek.aan?'0':'1')+'">'+(plek.aan?T('sw.aan','Aan'):T('sw.uit','Uit'))+'</button>'+
        '<button class="obtn warn" id="wvPlekWeg">'+T('wv.weg','Weghalen')+'</button>' : '')+
      '</div></div>';
    // per persoon: wanneer de PDA en de werkpagina voor wie beschikbaar zijn
    const stnd = { zaak: T('wv.zaak','Volgens de zaak'), altijd: T('wv.altijd','Altijd'), nooit: T('wv.nooit','Nooit'), eigen: T('wv.eigen','Eigen tijden') };
    const psRows = (state.staff||[]).filter(m => m.role !== 'manager').map(m => {
      const p = (wv.perStaff||{})[m.id] || {};
      const stand = p.stand || 'zaak';
      return '<div class="st-row" data-wvps="'+m.id+'" style="gap:0.4rem;flex-wrap:wrap;">'+
        '<span style="flex:1;min-width:7rem;">'+esc(m.name)+'</span>'+
        '<select class="wvps-stand" aria-label="'+T('wv.stand','Beschikbaarheid')+' '+esc(m.name)+'" style="'+veldStijl+'">'+
        Object.keys(stnd).map(k => '<option value="'+k+'"'+(stand===k?' selected':'')+'>'+stnd[k]+'</option>').join('')+'</select>'+
        '<input type="time" class="wvps-van" value="'+(p.van||'')+'" aria-label="'+T('wv.vanaf','Vanaf')+' '+esc(m.name)+'"'+(stand==='eigen'?'':' hidden')+' style="'+veldStijl+'">'+
        '<input type="time" class="wvps-tot" value="'+(p.tot||'')+'" aria-label="'+T('wv.tot','Tot')+' '+esc(m.name)+'"'+(stand==='eigen'?'':' hidden')+' style="'+veldStijl+'">'+
        '<button class="obtn'+(p.thuiswerk?' primary':'')+'" data-wvthuis="'+(p.thuiswerk?'1':'0')+'">'+(p.thuiswerk?T('wv.thuisaan','Thuiswerk aan'):T('wv.thuisuit','Thuiswerk uit'))+'</button></div>';
    }).join('');
