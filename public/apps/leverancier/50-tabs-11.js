  function renderCharter(){
    const el = $('#charterWrap'); if (!el) return;
    if (!has('charter')){ el.innerHTML = ''; return; }
    if (charters === null){ el.innerHTML = '<div class="empty">…</div>'; laadCharters(); return; }
    const canEdit = actor().manager;
    const selCss = 'style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"';
    let html = '';
    // lopende en geboekte charters
    html += '<div class="card"><div class="tt-h">'+T('ch.charters','Charters')+' ('+charters.length+')</div>'+
      (charters.length ? charters.map(c => {
        let knop = '';
        if (c.status === 'aangevraagd') knop =
          '<button class="obtn" data-chfoto="'+c.ref+'" data-fase="voor">'+T('ch.fotovoor','Voor-foto')+' ('+c.fotosVoor+')</button> '+
          '<button class="obtn primary" data-chst="'+c.ref+'" data-st="lopend">'+T('ch.uitvaren','Uitvaren')+'</button>';
        else if (c.status === 'lopend') knop =
          '<button class="obtn" data-chfoto="'+c.ref+'" data-fase="na">'+T('ch.fotona','Na-foto')+' ('+c.fotosNa+')</button> '+
          '<button class="obtn primary" data-chst="'+c.ref+'" data-st="afgerond">'+T('ch.teruggeven','Teruggeven en afronden')+'</button>';
        return '<div class="mitem">'+
          (c.sos && c.sos.length ? '<div style="background:rgba(194,58,94,0.16);border:1px solid var(--burgundy);border-radius:10px;padding:0.5rem 0.7rem;margin-bottom:0.5rem;font-size:0.8rem;"><b>SOS:</b> '+esc(c.sos[0].bericht)+
            (Number.isFinite(c.sos[0].lat) ? ' · <a style="color:var(--gold);" target="_blank" rel="noopener" href="geo:'+c.sos[0].lat+','+c.sos[0].lng+'?q='+c.sos[0].lat+','+c.sos[0].lng+'">'+T('ch.kaart','kaart')+'</a>' : '')+
            ' <button class="obtn" data-chsosok="'+c.ref+'" style="padding:0.15rem 0.7rem;font-size:0.7rem;">'+T('ch.sosok','Afgehandeld')+'</button></div>' : '')+
          '<div class="r1"><span class="nm">'+esc(c.codename)+' · '+esc(c.boot)+' ('+esc(c.type)+')</span><span class="pr">'+eur(c.prijs)+'</span></div>'+
          '<div class="ds">'+c.van+' → '+c.tot+' · '+(c.gasten?c.gasten+' '+T('ch.gasten','gasten')+' · ':'')+(c.metSkipper?''+T('ch.metskipper','met schipper')+(c.skipperNaam?' ('+esc(c.skipperNaam)+')':''):T('ch.bareboat','bareboat'))+' · '+T('ch.st.'+c.status, CHARTER_ST[c.status]||c.status)+
          ' ·  '+c.fotosVoor+'/'+c.fotosNa+(c.borg?' · '+T('ch.borg','borg')+' '+eur(c.borg):'')+
          (c.uitvaart ? ' · '+c.uitvaart.urenStart+' '+T('ch.uur','mu') : '')+
          (c.locatie ? ' · <a style="color:var(--gold);" target="_blank" rel="noopener" href="geo:'+c.locatie.lat+','+c.locatie.lng+'?q='+c.locatie.lat+','+c.locatie.lng+'">'+T('ch.live','live positie')+'</a>' : '')+'</div>'+
          (c.teruggave ? '<div class="ds" style="color:'+(c.teruggave.meerkosten>0?'var(--gold)':'var(--green)')+';">'+
            (c.teruggave.meerkosten>0 ? T('ch.meer','Meerkosten')+': '+eur(c.teruggave.meerkosten)+' ('+c.teruggave.gevaren+' '+T('ch.uur','mu')+(c.teruggave.brandstofKosten>0?', '+T('ch.brandstof','brandstof')+' '+eur(c.teruggave.brandstofKosten):'')+')'
              : '✓ '+c.teruggave.gevaren+' '+T('ch.uur','mu')+', '+T('ch.geenmeer','geen meerkosten, borg vrij'))+'</div>' : '')+
          (knop ? '<div style="margin-top:0.5rem;">'+knop+'</div>' : '')+'</div>';
      }).join('') : '<div class="empty">'+T('ch.geen','Nog geen charters. Betaalde boekingen verschijnen hier live.')+'</div>')+'</div>';
    // de vloot
    const boten = state.boten || [];
    html += '<div class="card"><div class="tt-h">'+T('ch.vloot','Vloot')+' ('+boten.filter(b=>b.actief!==false).length+')</div>'+
      boten.filter(b => b.actief !== false).map(b =>
        '<div class="mitem"><div class="r1"><span class="nm">'+(b.icoon||'')+' '+esc(b.naam)+'</span><span class="row-mid-gap"><span class="pr">'+eur(b.dagprijs)+'/'+T('ch.dag','dag')+'</span>'+
        (canEdit?'<button class="rr-del" data-chdel="'+b.id+'">✕</button>':'')+'</span></div>'+
        '<div class="ds">'+esc(b.type||'')+' · '+(b.lengte||0)+'m ·  '+(b.gasten||0)+(b.hutten?' ·  '+b.hutten+' '+T('ch.hutten','hutten'):'')+' · '+esc(b.brandstof||'')+' · '+(b.snelheidKn||0)+' kn · '+esc(b.ligplaats||'')+
        ' · '+T('ch.borg','borg')+' '+eur(b.borg||0)+' · '+(b.skipperVerplicht?''+T('ch.skipperv','schipper verplicht'):(b.vaarbewijsVereist?T('ch.vaarbewijs','vaarbewijs vereist'):T('ch.vrij','vrij te huren')))+
        (b.skipperPrijsPerDag?' (+'+eur(b.skipperPrijsPerDag)+'/'+T('ch.dag','dag')+')':'')+'</div></div>').join('')+
      (canEdit ? '<details style="margin-top:1rem;"><summary style="cursor:pointer;font-size:0.82rem;color:var(--gold);">'+T('ch.f.nieuw','Vaartuig toevoegen')+'</summary><div style="margin-top:0.8rem;">'+
        '<div class="row-gap"><div class="field" style="flex:2;"><label>'+T('ch.f.naam','Naam')+'</label><input id="chNaam" placeholder="Serenidad"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.type','Type')+'</label><select id="chType" '+selCss+'>'+BOOT_TYPES.map(t=>'<option>'+t+'</option>').join('')+'</select></div></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.lengte','Lengte (m)')+'</label><input id="chLengte" type="number" inputmode="decimal" value="14"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.gasten','Gasten')+'</label><input id="chGasten" type="number" inputmode="numeric" value="10"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.hutten','Hutten')+'</label><input id="chHutten" type="number" inputmode="numeric" value="2"></div></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.brand','Brandstof')+'</label><select id="chBrand" '+selCss+'><option value="diesel">diesel</option><option value="benzine">benzine</option><option value="elektrisch">elektrisch</option><option value="geen">geen</option></select></div>'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.snelheid','Snelheid (kn)')+'</label><input id="chSnelheid" type="number" inputmode="numeric" value="24"></div></div>'+
        '<div class="field"><label>'+T('ch.f.ligplaats','Ligplaats')+'</label><input id="chLig" placeholder="Marina Botafoch"></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.prijs','€/dag')+'</label><input id="chPrijs" type="number" inputmode="numeric"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.borg','Borg €')+'</label><input id="chBorg" type="number" inputmode="numeric" value="2000"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('ch.f.skipperprijs','Schipper €/dag')+'</label><input id="chSkPrijs" type="number" inputmode="numeric" value="300"></div></div>'+
        '<label class="field" style="display:flex;align-items:center;gap:0.4rem;"><input type="checkbox" id="chSkV" style="accent-color:var(--gold);"> '+T('ch.f.skipperv','Schipper verplicht')+'</label>'+
        '<label class="field" style="display:flex;align-items:center;gap:0.4rem;"><input type="checkbox" id="chVb" checked style="accent-color:var(--gold);"> '+T('ch.f.vaarbewijs','Vaarbewijs vereist bij bareboat')+'</label>'+
        '<button class="obtn primary" id="chAdd">'+T('ch.f.voeg','Toevoegen')+'</button></div></details>' : '')+'</div>'+
      '<input type="file" id="chFile" accept="image/*" capture="environment" style="display:none;">';
    el.innerHTML = html;
    document.querySelectorAll('[data-chst]').forEach(k => k.addEventListener('click', async () => {
      const body = { ref: k.dataset.chst, status: k.dataset.st };
      if (k.dataset.st === 'lopend'){
        const uren = prompt(T('ch.q.urenstart','Motorurenstand bij uitvaren?')); if (uren == null) return;
        body.urenStart = Number(uren);
        body.brandstofStart = Number(prompt(T('ch.q.brandstart','Brandstofniveau bij uitvaren in achtsten (8 = vol)?'), '8'));
      } else if (k.dataset.st === 'afgerond'){
        const uren = prompt(T('ch.q.ureneind','Motorurenstand bij teruggave?')); if (uren == null) return;
        body.urenEind = Number(uren);
        body.brandstofEind = Number(prompt(T('ch.q.brandeind','Brandstofniveau bij teruggave in achtsten (8 = vol)?'), '8'));
      }
      try { await API.call('/supplier/charter/status', body); await laadCharters(); openTab('charter'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-chsosok]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/charter/sos-ok', { ref: k.dataset.chsosok }); await laadCharters(); openTab('charter'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-chfoto]').forEach(k => k.addEventListener('click', () => {
      const file = document.getElementById('chFile');
      file.onchange = () => {
        if (!file.files[0]) return;
        fotoKlein(file.files[0], async (dataUrl) => {
          try { await API.call('/supplier/charter/foto', { ref: k.dataset.chfoto, fase: k.dataset.fase, foto: dataUrl });
            toast(T('ch.foto.ok','De staat is vastgelegd.')); await laadCharters(); openTab('charter'); }
          catch(e){ toast(e.message); }
        });
        file.value = '';
      };
      file.click();
    }));
    document.querySelectorAll('[data-chdel]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/boot', { id: k.dataset.chdel, weg: true }); await refresh(); openTab('charter'); } catch(e){ toast(e.message); }
    }));
    const voeg = document.getElementById('chAdd');
    if (voeg) voeg.addEventListener('click', async () => {
      const g = id => $(id) ? $(id).value : undefined;
      try { await API.call('/supplier/boot', { naam: g('#chNaam'), type: g('#chType'), lengte: Number(g('#chLengte')),
        gasten: Number(g('#chGasten')), hutten: Number(g('#chHutten')), brandstof: g('#chBrand'), snelheidKn: Number(g('#chSnelheid')),
        ligplaats: g('#chLig'), dagprijs: Number(g('#chPrijs')), borg: Number(g('#chBorg')), skipperPrijsPerDag: Number(g('#chSkPrijs')),
        skipperVerplicht: $('#chSkV') ? $('#chSkV').checked : false, vaarbewijsVereist: $('#chVb') ? $('#chVb').checked : true });
        toast(T('ch.f.ok','Het vaartuig staat in de vloot.')); await refresh(); openTab('charter'); } catch(e){ toast(e.message); }
    });
  }

