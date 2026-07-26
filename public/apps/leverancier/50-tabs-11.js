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
