/* een activiteit toevoegen of verwijderen */
    document.querySelectorAll('[data-tkdel]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/activiteit', { id: k.dataset.tkdel, weg: true }); await refresh(); await laadProgramma(); openTab('tickets'); } catch(e){ toast(e.message); }
    }));
    const voeg = document.getElementById('tkAdd');
    if (voeg) voeg.addEventListener('click', async () => {
      try {
        await API.call('/supplier/activiteit', { name: $('#tkName').value, desc: $('#tkDesc').value, prijs: Number($('#tkPrijs').value),
          capaciteit: Number($('#tkCap').value), duur: $('#tkDuur').value, tijden: $('#tkTijden').value });
        toast(T('tk2.f.ok','De activiteit staat in het aanbod.'));
        await refresh(); await laadProgramma(); openTab('tickets');
      } catch(e){ toast(e.message); }
    });
  }

  // ---- autoverhuur: vloot, huren, foto's, SOS ----
  let huren = null;
  function fotoKlein(file, cb){
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => {
      const c = document.createElement('canvas'); const sc = Math.min(1, 900 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.7));
    }; img.src = r.result; };
    r.readAsDataURL(file);
  }
  async function laadHuren(){
    if (!has('huur') || !API.live) return;
    try { huren = (await API.call('/supplier/huur/overzicht')).huren; } catch(e){ huren = []; }
    renderVerhuur();
  }
  const HUUR_ST = { 'aangevraagd': 'geboekt, klaar voor uitgifte', 'lopend': 'onderweg met de gast', 'afgerond': 'afgerond' };
  function renderVerhuur(){
    const el = $('#huurWrap'); if (!el) return;
    if (!has('huur')){ el.innerHTML = ''; return; }
    if (huren === null){ el.innerHTML = '<div class="empty">\u2026</div>'; laadHuren(); return; }
    const canEdit = actor().manager;
    let html = '';
    // lopende en geboekte huren
    html += '<div class="card"><div class="tt-h">'+T('vh.huren','Huren')+' ('+huren.length+')</div>'+
      (huren.length ? huren.map(h => {
        let knop = '';
        if (h.status === 'aangevraagd') knop =
          '<button class="obtn" data-vhfoto="'+h.ref+'" data-fase="voor">\uD83D\uDCF7 '+T('vh.fotovoor','Voor-foto')+' ('+h.fotosVoor+')</button> '+
          '<button class="obtn primary" data-vhst="'+h.ref+'" data-st="lopend">'+T('vh.uitgeven','Uitgeven')+'</button>';
        else if (h.status === 'lopend') knop =
          '<button class="obtn" data-vhfoto="'+h.ref+'" data-fase="na">\uD83D\uDCF7 '+T('vh.fotona','Na-foto')+' ('+h.fotosNa+')</button> '+
          '<button class="obtn primary" data-vhst="'+h.ref+'" data-st="afgerond">'+T('vh.innemen','Innemen en afronden')+'</button>';
        return '<div class="mitem">'+
          (h.sos && h.sos.length ? '<div style="background:rgba(194,58,94,0.16);border:1px solid var(--burgundy);border-radius:10px;padding:0.5rem 0.7rem;margin-bottom:0.5rem;font-size:0.8rem;">\uD83D\uDEA8 <b>SOS:</b> '+esc(h.sos[0].bericht)+
            (Number.isFinite(h.sos[0].lat) ? ' \u00B7 <a style="color:var(--gold);" target="_blank" rel="noopener" href="geo:'+h.sos[0].lat+','+h.sos[0].lng+'?q='+h.sos[0].lat+','+h.sos[0].lng+'">'+T('vh.kaart','kaart')+'</a>' : '')+
            ' <button class="obtn" data-vhsosok="'+h.ref+'" style="padding:0.15rem 0.7rem;font-size:0.7rem;">'+T('vh.sosok','Afgehandeld')+'</button></div>' : '')+
          '<div class="r1"><span class="nm">'+esc(h.codename)+' \u00B7 '+esc(h.auto)+(h.kenteken?' ('+esc(h.kenteken)+')':'')+'</span><span class="pr">'+eur(h.prijs)+'</span></div>'+
          '<div class="ds">'+h.van+' \u2192 '+h.tot+' \u00B7 '+T('vh.st.'+h.status, HUUR_ST[h.status]||h.status)+
          ' \u00B7 \uD83D\uDCF7 '+h.fotosVoor+'/'+h.fotosNa+(h.borg?' \u00B7 '+T('vh.borg','borg')+' '+eur(h.borg):'')+
          (h.uitgifte ? ' \u00B7 '+h.uitgifte.kmStart+' km' : '')+
          (h.locatie ? ' \u00B7 <a style="color:var(--gold);" target="_blank" rel="noopener" href="geo:'+h.locatie.lat+','+h.locatie.lng+'?q='+h.locatie.lat+','+h.locatie.lng+'">\uD83D\uDCCD '+T('vh.live','live locatie')+'</a>' : '')+'</div>'+
          (h.inname ? '<div class="ds" style="color:'+(h.inname.meerkosten>0?'var(--gold)':'var(--green)')+';">'+
            (h.inname.meerkosten>0 ? T('vh.meer','Meerkosten')+': '+eur(h.inname.meerkosten)+' ('+h.inname.gereden+' km, '+h.inname.extraKm+' extra'+(h.inname.tankKosten>0?', tank '+eur(h.inname.tankKosten):'')+')'
              : '\u2713 '+h.inname.gereden+' km, '+T('vh.geenmeer','geen meerkosten \u2013 borg vrij'))+'</div>' : '')+
          (knop ? '<div class="h-mt50">'+knop+'</div>' : '')+'</div>';
      }).join('') : '<div class="empty">'+T('vh.geen','Nog geen huren. Betaalde boekingen verschijnen hier live.')+'</div>')+'</div>';
    // de vloot
