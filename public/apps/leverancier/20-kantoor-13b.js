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
      '<b style="font-size:0.78rem;">📍 '+T('wv.plekh','Werkplek-zone')+'</b>'+
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
        '<button class="obtn'+(p.thuiswerk?' primary':'')+'" data-wvthuis="'+(p.thuiswerk?'1':'0')+'">🏠 '+(p.thuiswerk?T('wv.thuisaan','Thuiswerk aan'):T('wv.thuisuit','Thuiswerk uit'))+'</button></div>';
    }).join('');
    const psBlok = psRows ? '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.55rem;">'+
      '<b style="font-size:0.78rem;">👥 '+T('wv.persh','Per persoon')+'</b>'+
      '<div class="tkc-who">'+T('wv.perss','Wanneer de PDA en de werkpagina voor wie beschikbaar zijn: volgens het venster van de zaak, altijd, nooit, of eigen tijden. Thuiswerk aan = deze persoon kan ook buiten de werkplek-zone aan het werk.')+'</div>'+
      psRows+'</div>' : '';
    return '<div class="tkc"><h3>🕰 '+T('wv.h','Werkvenster')+'</h3>'+
      '<div class="tkc-who">'+T('wv.s','U bepaalt wanneer uw personeel op de werkpagina en de PDA kan. Buiten het venster geeft de server geen werksessie; managers vallen er nooit onder. Rahul mag op basis van agenda en gezondheid iets anders adviseren, maar de toegang bepaalt u.')+'</div>'+
      '<div class="st-row"><span>'+T('wv.aanh','Venster actief')+'<span class="sub">'+T('wv.aans','Uit = iedereen kan altijd inloggen')+'</span></span>'+
      '<button class="obtn'+(wv.aan?' primary':' warn')+'" id="wvAan" data-val="'+(wv.aan?'0':'1')+'">'+(wv.aan?T('sw.aan','Aan'):T('sw.uit','Uit'))+'</button></div>'+
      rows+plekBlok+psBlok+
      '<div style="margin-top:0.5rem;text-align:right;"><button class="obtn primary" id="wvSave">'+T('wv.bewaar','Venster bewaren')+'</button></div>'+
      '<div class="tkc-who" style="margin-top:0.4rem;">'+T('wv.leeg','Een dag zonder tijden is gewoon open; "Dicht" sluit de hele dag.')+'</div></div>';
  }
  function bindWerkvenster(el){
    const aan = el.querySelector('#wvAan');
    if (aan) aan.addEventListener('click', async () => {
      try { await API.call('/supplier/werkvenster', { aan: aan.dataset.val === '1' }); boData = null; await refresh(); }
      catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-wvdicht]').forEach(b => b.addEventListener('click', () => {
      // lokaal wisselen; pas "Venster bewaren" stuurt alles in een keer op
      const rij = b.closest('[data-wvdag]');
      const dicht = b.textContent.trim() !== T('wv.dicht','Dicht');
      b.textContent = dicht ? T('wv.dicht','Dicht') : T('wv.open','Open');
      b.classList.toggle('warn', dicht);
      rij.querySelectorAll('input').forEach(i => { i.disabled = dicht; });
    }));
    // de werkplek-zone: hier zetten, aan/uit of weghalen
    const plekHier = el.querySelector('#wvPlekHier');
    if (plekHier) plekHier.addEventListener('click', () => {
      if (!navigator.geolocation) { toast(T('wv.geengps','Dit toestel deelt geen locatie.')); return; }
      navigator.geolocation.getCurrentPosition(async p => {
        const radiusM = Number(el.querySelector('#wvPlekStraal').value) || 250;
        try {
          await API.call('/supplier/werkvenster', { plek: { lat: p.coords.latitude, lng: p.coords.longitude, radiusM, aan: true } });
          toast('📍 '+T('wv.plekok','Werkplek-zone ingesteld.')); boData = null; await refresh();
        } catch(e){ toast(e.message); }
      }, () => toast(T('wv.gpsmis','Locatie ophalen lukte niet; sta locatie toe in de browser.')), { enableHighAccuracy: true, timeout: 8000 });
    });
    const plekAan = el.querySelector('#wvPlekAan');
    if (plekAan) plekAan.addEventListener('click', async () => {
      try { await API.call('/supplier/werkvenster', { plek: { aan: plekAan.dataset.val === '1' } }); boData = null; await refresh(); }
      catch(e){ toast(e.message); }
    });
    const plekWeg = el.querySelector('#wvPlekWeg');
    if (plekWeg) plekWeg.addEventListener('click', async () => {
      try { await API.call('/supplier/werkvenster', { plek: null }); boData = null; await refresh(); }
      catch(e){ toast(e.message); }
    });
    // per persoon: eigen tijden tonen zodra de stand "eigen" is; thuiswerk wisselt lokaal
    el.querySelectorAll('[data-wvps] .wvps-stand').forEach(sel => sel.addEventListener('change', () => {
      const rij = sel.closest('[data-wvps]');
      const eigen = sel.value === 'eigen';
      rij.querySelector('.wvps-van').hidden = !eigen;
      rij.querySelector('.wvps-tot').hidden = !eigen;
    }));
    el.querySelectorAll('[data-wvthuis]').forEach(b => b.addEventListener('click', () => {
      const aan = b.dataset.wvthuis !== '1';
      b.dataset.wvthuis = aan ? '1' : '0';
      b.classList.toggle('primary', aan);
      b.textContent = '🏠 ' + (aan ? T('wv.thuisaan','Thuiswerk aan') : T('wv.thuisuit','Thuiswerk uit'));
    }));
    const opslaan = el.querySelector('#wvSave');
    if (opslaan) opslaan.addEventListener('click', async () => {
      const dagen = {};
      el.querySelectorAll('[data-wvdag]').forEach(rij => {
        const d = rij.dataset.wvdag;
        const knop = rij.querySelector('[data-wvdicht]');
        if (knop.textContent.trim() === T('wv.dicht','Dicht')) { dagen[d] = { dicht: true }; return; }
        const van = rij.querySelector('.wv-van').value, tot = rij.querySelector('.wv-tot').value;
        dagen[d] = (van && tot) ? { van, tot } : { dicht: false }; // leeg = weer altijd open
      });
      const perStaff = {};
      el.querySelectorAll('[data-wvps]').forEach(rij => {
        perStaff[rij.dataset.wvps] = {
          stand: rij.querySelector('.wvps-stand').value,
          van: rij.querySelector('.wvps-van').value, tot: rij.querySelector('.wvps-tot').value,
          thuiswerk: rij.querySelector('[data-wvthuis]').dataset.wvthuis === '1'
        };
      });
      try { await API.call('/supplier/werkvenster', { dagen, perStaff }); toast('🕰 '+T('wv.bewaard','Werkvenster bewaard.')); boData = null; await refresh(); }
      catch(e){ toast(e.message); }
    });
  }
