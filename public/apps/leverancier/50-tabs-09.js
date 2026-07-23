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
          (knop ? '<div style="margin-top:0.5rem;">'+knop+'</div>' : '')+'</div>';
      }).join('') : '<div class="empty">'+T('vh.geen','Nog geen huren. Betaalde boekingen verschijnen hier live.')+'</div>')+'</div>';
    // de vloot
    const autos = state.autos || [];
    html += '<div class="card"><div class="tt-h">'+T('vh.vloot','Vloot')+' ('+autos.filter(a=>a.actief!==false).length+')</div>'+
      autos.filter(a => a.actief !== false).map(a =>
        '<div class="mitem"><div class="r1"><span class="nm">'+(a.icoon||'\uD83D\uDE97')+' '+esc(a.name)+(a.plate?' \u00B7 '+esc(a.plate):'')+'</span><span class="row-mid-gap"><span class="pr">'+eur(a.dagprijs)+'/'+T('vh.dag','dag')+'</span>'+
        (canEdit?'<button class="rr-del" data-vhdel="'+a.id+'">\u2715</button>':'')+'</span></div>'+
        '<div class="ds">'+esc(a.categorie||'')+' \u00B7 '+(a.transmissie==='automaat'?T('vh.aut','automaat'):T('vh.hand','handgeschakeld'))+' \u00B7 '+esc(a.brandstof||'')+' \u00B7 \uD83D\uDC65 '+(a.stoelen||'-')+' \u00B7 \uD83E\uDDF3 '+(a.bagage||0)+(a.airco?' \u00B7 \u2744\uFE0F':'')+
        ' \u00B7 '+(a.kmPerDag?a.kmPerDag+' km/'+T('vh.dag','dag')+' (+'+eur(a.meerKm||0)+'/km)':T('vh.onbeperkt','onbeperkt km'))+' \u00B7 '+T('vh.borg','borg')+' '+eur(a.borg||0)+' \u00B7 '+T('vh.vanaf','vanaf')+' '+(a.minLeeftijd||21)+' jr</div></div>').join('')+
      (canEdit ? '<details style="margin-top:1rem;"><summary style="cursor:pointer;font-size:0.82rem;color:var(--gold);">'+T('vh.f.nieuw','Auto toevoegen')+'</summary><div style="margin-top:0.8rem;">'+
        '<div class="row-gap"><div class="field" style="flex:2;"><label>'+T('vh.f.auto','Auto')+'</label><input id="vhName" placeholder="Fiat 500 Cabrio"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.kenteken','Kenteken')+'</label><input id="vhPlate"></div></div>'+
        '<div class="field"><label>'+T('vh.f.cat','Categorie')+'</label><input id="vhCat" placeholder="Compact cabrio"></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.trans','Schakeling')+'</label><select id="vhTrans" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"><option value="handgeschakeld">'+T('vh.hand','handgeschakeld')+'</option><option value="automaat">'+T('vh.aut','automaat')+'</option></select></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.brand','Brandstof')+'</label><select id="vhBrand" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"><option value="benzine">benzine</option><option value="diesel">diesel</option><option value="elektrisch">elektrisch</option><option value="hybride">hybride</option></select></div></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.stoelen','Stoelen')+'</label><input id="vhStoelen" type="number" inputmode="numeric" value="5"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.deuren','Deuren')+'</label><input id="vhDeuren" type="number" inputmode="numeric" value="4"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.bagage','Koffers')+'</label><input id="vhBagage" type="number" inputmode="numeric" value="2"></div></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.prijs','\u20AC/dag')+'</label><input id="vhPrijs" type="number" inputmode="numeric"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.borg','Borg \u20AC')+'</label><input id="vhBorg" type="number" inputmode="numeric" value="300"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.leeftijd','Min. lft')+'</label><input id="vhLft" type="number" inputmode="numeric" value="21"></div></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.km','Km/dag (0=onbep.)')+'</label><input id="vhKm" type="number" inputmode="numeric" value="200"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('vh.f.meerkm','\u20AC per extra km')+'</label><input id="vhMeerkm" type="number" inputmode="decimal" value="0.25"></div>'+
        '<label class="field" style="flex:1;display:flex;align-items:center;gap:0.4rem;"><input type="checkbox" id="vhAirco" checked style="accent-color:var(--gold);"> '+T('vh.f.airco','Airco')+'</label></div>'+
        '<button class="obtn primary" id="vhAdd">'+T('vh.f.voeg','Toevoegen')+'</button></div></details>' : '')+'</div>'+
      '<input type="file" id="vhFile" accept="image/*" capture="environment" style="display:none;">';
    el.innerHTML = html;
    document.querySelectorAll('[data-vhst]').forEach(k => k.addEventListener('click', async () => {
      const body = { ref: k.dataset.vhst, status: k.dataset.st };
      if (k.dataset.st === 'lopend'){
        const km = prompt(T('vh.q.kmstart','Km-stand bij uitgifte?')); if (km == null) return;
        body.kmStart = Number(km);
        const tank = prompt(T('vh.q.tankstart','Tankniveau bij uitgifte in achtsten (8 = vol)?'), '8'); body.tankStart = Number(tank);
      } else if (k.dataset.st === 'afgerond'){
        const km = prompt(T('vh.q.kmeind','Km-stand bij inname?')); if (km == null) return;
        body.kmEind = Number(km);
        const tank = prompt(T('vh.q.tankeind','Tankniveau bij inname in achtsten (8 = vol)?'), '8'); body.tankEind = Number(tank);
      }
      try { await API.call('/supplier/huur/status', body); await laadHuren(); openTab('huur'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vhsosok]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/huur/sos-ok', { ref: k.dataset.vhsosok }); await laadHuren(); openTab('huur'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vhfoto]').forEach(k => k.addEventListener('click', () => {
      const file = document.getElementById('vhFile');
      file.onchange = () => {
        if (!file.files[0]) return;
        fotoKlein(file.files[0], async (dataUrl) => {
          try { await API.call('/supplier/huur/foto', { ref: k.dataset.vhfoto, fase: k.dataset.fase, foto: dataUrl });
            toast(T('vh.foto.ok','De staat is vastgelegd.')); await laadHuren(); openTab('huur'); }
          catch(e){ toast(e.message); }
        });
        file.value = '';
      };
      file.click();
    }));
    document.querySelectorAll('[data-vhdel]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/auto', { id: k.dataset.vhdel, weg: true }); await refresh(); openTab('huur'); } catch(e){ toast(e.message); }
    }));
    const voeg = document.getElementById('vhAdd');
    if (voeg) voeg.addEventListener('click', async () => {
      const g = id => $(id) ? $(id).value : undefined;
      try { await API.call('/supplier/auto', { name: g('#vhName'), plate: g('#vhPlate'), dagprijs: Number(g('#vhPrijs')),
        categorie: g('#vhCat'), transmissie: g('#vhTrans'), brandstof: g('#vhBrand'),
        stoelen: Number(g('#vhStoelen')), deuren: Number(g('#vhDeuren')), bagage: Number(g('#vhBagage')),
        borg: Number(g('#vhBorg')), minLeeftijd: Number(g('#vhLft')), kmPerDag: Number(g('#vhKm')),
        meerKm: Number(g('#vhMeerkm')), airco: $('#vhAirco') ? $('#vhAirco').checked : true });
        toast(T('vh.f.ok','De auto staat in de vloot.')); await refresh(); openTab('huur'); } catch(e){ toast(e.message); }
    });
  }

