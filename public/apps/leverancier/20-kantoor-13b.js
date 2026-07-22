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
    return '<div class="tkc"><h3>🕰 '+T('wv.h','Werkvenster')+'</h3>'+
      '<div class="tkc-who">'+T('wv.s','U bepaalt wanneer uw personeel op de werkpagina en de PDA kan. Buiten het venster geeft de server geen werksessie; managers vallen er nooit onder. Rahul mag op basis van agenda en gezondheid iets anders adviseren, maar de toegang bepaalt u.')+'</div>'+
      '<div class="st-row"><span>'+T('wv.aanh','Venster actief')+'<span class="sub">'+T('wv.aans','Uit = iedereen kan altijd inloggen')+'</span></span>'+
      '<button class="obtn'+(wv.aan?' primary':' warn')+'" id="wvAan" data-val="'+(wv.aan?'0':'1')+'">'+(wv.aan?T('sw.aan','Aan'):T('sw.uit','Uit'))+'</button></div>'+
      rows+
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
      try { await API.call('/supplier/werkvenster', { dagen }); toast('🕰 '+T('wv.bewaard','Werkvenster bewaard.')); boData = null; await refresh(); }
      catch(e){ toast(e.message); }
    });
  }
