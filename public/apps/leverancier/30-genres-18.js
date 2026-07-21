
  // ---- het kantoorgebouw (Zuidas): het hele huis op een scherm ----
  const GB_MELD = { schoonmaak: 'Schoonmaak', onderhoud: 'Onderhoud', catering: 'Catering' };
  const GB_JET = { concierge: 'Concierge', chauffeur: 'Chauffeur', 'jet-transfer': 'Jet-transfer', lounge: 'Executive lounge' };

  function gbKnop(attr, id, tekst, goud){
    return '<button '+attr+'="'+id+'" style="'+(goud?'background:var(--gold);color:#000;border:none;':'background:none;border:1px solid var(--line);color:var(--soft);')+'border-radius:8px;padding:0.35rem 0.7rem;font-family:inherit;font-size:0.72rem;'+(goud?'font-weight:600;':'')+'">'+tekst+'</button>';
  }
  async function renderGebouw(){
    const el = $('#gebWrap'); if (!el) return;
    if (!has('gebouw')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/gebouw'); } catch(e){ el.innerHTML = '<p class="sub">'+esc(e.message)+'</p>'; return; }
    const k = d.kpi;
    let h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr));gap:0.5rem;">'+
      [[k.huurders, T('gb.k.huurders','huurders')],[k.bezetting+'%', T('gb.k.bezetting','bezetting')],[k.zalenVandaag, T('gb.k.zalen','zalen vandaag')],[k.openMeldingen, T('gb.k.meld','open meldingen')],[k.bezoekersBinnen, T('gb.k.binnen','bezoekers binnen')],[k.jetsetOpen, T('gb.k.jetset','jetset open')]]
        .map(x=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;text-align:center;"><b style="font-size:1.1rem;display:block;">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    // de stapeling: huurders per verdieping, van boven naar beneden
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('gb.toren',(d.naam||'De toren')+' · '+d.vloeren+' verdiepingen')+'</div>';
    h += d.huurders.map(x => '<div style="display:flex;gap:0.6rem;align-items:baseline;border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
      '<span class="sub" style="flex:0 0 5.5rem;">'+T('gb.verd','verdieping')+' '+x.verdiepingen.join(' + ')+'</span><b style="flex:1;font-size:0.85rem;">'+esc(x.naam)+'</b><span class="sub">'+x.badges+' '+T('gb.passen','passen')+'</span></div>').join('');

    // vergaderzalen: boeken zonder dubbele boekingen
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('gb.zalen','Vergaderzalen')+'</div>'+
      '<div style="border:1px solid var(--line);border-radius:12px;padding:0.8rem;">'+
      '<div class="row-gap"><select id="gbZaal" class="st-in" style="flex:2;">'+d.zalen.map(z=>'<option value="'+z.id+'">'+esc(z.naam)+' · vd '+z.verdieping+' · '+z.capaciteit+'p · '+eur(z.uurprijs)+'/u</option>').join('')+'</select>'+
      '<input id="gbHuurder" class="st-in" placeholder="'+T('gb.huurder','Huurder')+'" maxlength="60" style="flex:2;"></div>'+
      '<div class="row-gap" style="margin-top:0.4rem;"><input id="gbDatum" class="st-in" type="date" style="flex:1;"><input id="gbVan" class="st-in" type="time" style="flex:1;"><input id="gbTot" class="st-in" type="time" style="flex:1;">'+
      '<button id="gbBoek" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('gb.boek','Boek')+'</button></div>'+
      ((d.boekingen||[]).length ? d.boekingen.slice(0,8).map(b=>'<div class="sub" style="margin-top:0.35rem;">'+esc(b.datum)+' '+esc(b.van)+' tot '+esc(b.tot)+' · '+esc(b.zaal)+' · '+esc(b.huurder)+' · '+eur(b.prijs)+' <button data-gbzweg="'+b.id+'" style="background:none;border:none;color:var(--soft);cursor:pointer;">✕</button></div>').join('') : '<p class="sub" style="margin-top:0.4rem;">'+T('gb.geenboek','Nog geen boekingen.')+'</p>')+'</div>';

    // receptie: de bezoekersstroom
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('gb.receptie','Receptie · bezoekers')+'</div>'+
      '<div class="row-gap"><input id="gbBezNaam" class="st-in" placeholder="'+T('gb.bez.naam','Naam bezoeker')+'" maxlength="60" style="flex:2;"><input id="gbBezVoor" class="st-in" placeholder="'+T('gb.bez.voor','Voor welke huurder')+'" maxlength="60" style="flex:2;"><button id="gbBezMeld" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('gb.bez.meld','Aanmelden')+'</button></div>';
    h += (d.bezoekers||[]).slice(0,8).map(b=>'<div style="display:flex;gap:0.5rem;align-items:center;border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
      '<b style="flex:1;font-size:0.85rem;">'+esc(b.naam)+'</b><span class="sub">'+esc(b.voorWie)+' · '+esc(b.status)+(b.badge?' · '+esc(b.badge):'')+'</span>'+
      (b.status==='verwacht'?gbKnop('data-gbbin', b.id, T('gb.bez.binnen','Binnen'), true):b.status==='binnen'?gbKnop('data-gbweg', b.id, T('gb.bez.weg','Vertrokken')):'')+'</div>').join('') || '<p class="sub">'+T('gb.bez.geen','Nog geen bezoekers aangemeld.')+'</p>';
