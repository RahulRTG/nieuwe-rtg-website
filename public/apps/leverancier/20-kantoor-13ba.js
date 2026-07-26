    const psBlok = psRows ? '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.55rem;">'+
      '<b style="font-size:0.78rem;">'+T('wv.persh','Per persoon')+'</b>'+
      '<div class="tkc-who">'+T('wv.perss','Wanneer de PDA en de werkpagina voor wie beschikbaar zijn: volgens het venster van de zaak, altijd, nooit, of eigen tijden. Thuiswerk aan = deze persoon kan ook buiten de werkplek-zone aan het werk.')+'</div>'+
      psRows+'</div>' : '';
    return '<div class="tkc"><h3>'+T('wv.h','Werkvenster')+'</h3>'+
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
          toast(''+T('wv.plekok','Werkplek-zone ingesteld.')); boData = null; await refresh();
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
      b.textContent = '' + (aan ? T('wv.thuisaan','Thuiswerk aan') : T('wv.thuisuit','Thuiswerk uit'));
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
      try { await API.call('/supplier/werkvenster', { dagen, perStaff }); toast(''+T('wv.bewaard','Werkvenster bewaard.')); boData = null; await refresh(); }
      catch(e){ toast(e.message); }
    });
  }
