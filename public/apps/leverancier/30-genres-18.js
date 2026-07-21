
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

    // facilitair: meldingen door het gebouw
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('gb.fac','Facilitair · meldingen')+'</div>'+
      '<div class="row-gap"><select id="gbMSoort" class="st-in" style="flex:1;">'+Object.keys(GB_MELD).map(s=>'<option value="'+s+'">'+GB_MELD[s]+'</option>').join('')+'</select>'+
      '<input id="gbMVerd" class="st-in" type="number" min="1" max="'+d.vloeren+'" placeholder="'+T('gb.m.verd','Verd.')+'" style="flex:0 0 5rem;"><input id="gbMTekst" class="st-in" placeholder="'+T('gb.m.tekst','Wat is er nodig?')+'" maxlength="160" style="flex:3;"><button id="gbMeld" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('gb.m.meld','Meld')+'</button></div>';
    h += (d.meldingen||[]).filter(m=>m.status!=='klaar').map(m=>'<div style="display:flex;gap:0.5rem;align-items:center;border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
      '<span class="sub" style="flex:0 0 7rem;">'+GB_MELD[m.soort]+' · vd '+m.verdieping+'</span><b style="flex:1;font-size:0.82rem;">'+esc(m.tekst)+'</b><span class="sub">'+esc(m.status)+'</span>'+
      (m.status==='open'?gbKnop('data-gbmb', m.id, T('gb.m.pak','Oppakken'), true):gbKnop('data-gbmk', m.id, T('gb.m.klaar','Klaar'), true))+'</div>').join('') || '<p class="sub">'+T('gb.m.geen','Geen open meldingen; het huis is op orde.')+'</p>';

    // valet + de jetset-laag
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('gb.jetset','Valet en de jetset-diensten')+'</div>'+
      '<div class="row-gap"><input id="gbValetWie" class="st-in" placeholder="'+T('gb.valet.wie','Valet: voor wie?')+'" maxlength="60" style="flex:2;"><button id="gbValet" style="flex:1;background:none;border:1px solid var(--line);border-radius:8px;padding:0.45rem;color:var(--txt);font-family:inherit;">'+T('gb.valet.vraag','Wagen voorrijden')+'</button></div>';
    h += (d.valet||[]).filter(v=>v.status!=='klaar').map(v=>'<div class="sub" style="padding:0.3rem 0;">'+esc(v.wie)+' · '+esc(v.wagen)+' · '+esc(v.status)+' '+
      (v.status==='gevraagd'?gbKnop('data-gbvv', v.id, T('gb.valet.voor','Voorgereden'), true):gbKnop('data-gbvk', v.id, T('gb.valet.klaar','Klaar'), true))+'</div>').join('');
    h += '<div class="row-gap" style="margin-top:0.5rem;"><select id="gbJSoort" class="st-in" style="flex:1;">'+Object.keys(GB_JET).map(s=>'<option value="'+s+'">'+GB_JET[s]+'</option>').join('')+'</select>'+
      '<input id="gbJVoor" class="st-in" placeholder="'+T('gb.j.voor','Voor wie')+'" maxlength="60" style="flex:1;"><input id="gbJWens" class="st-in" placeholder="'+T('gb.j.wens','De wens (bijv. wagen naar Schiphol om 16:00)')+'" maxlength="160" style="flex:3;"><button id="gbJVraag" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('gb.j.vraag','Vraag aan')+'</button></div>';
    h += (d.jetset||[]).map(j=>'<div style="border:1px solid '+(j.status==='afgerond'?'var(--line)':'var(--gold)')+';border-radius:12px;padding:0.6rem 0.8rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="flex:1;font-size:0.85rem;">'+GB_JET[j.soort]+' · '+esc(j.voorWie)+'</b><span class="sub">'+esc(j.status)+'</span></div>'+
      '<div class="sub">'+esc(j.wens)+' · '+esc(j.moment)+(j.notitie?' · '+esc(j.notitie):'')+'</div>'+
      (j.status!=='afgerond'?'<div style="display:flex;gap:0.4rem;margin-top:0.45rem;">'+
        (j.status==='aangevraagd'?gbKnop('data-gbjb', j.id, T('gb.j.bevestig','Bevestig'), true):'')+gbKnop('data-gbja', j.id, T('gb.j.afgerond','Afgerond'))+'</div>':'')+'</div>').join('');
    h += '<p class="sub" style="margin-top:0.5rem;">'+T('gb.j.regel','Een jet-transfer is een dienstverzoek aan RTG Aviation; de concierge bevestigt pas na overleg, nooit vanzelf.')+'</p>';
    el.innerHTML = h;

    const doe = (sel, pad, body) => el.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      try { await API.call(pad, body(b.dataset)); renderGebouw(); } catch(e){ toast(e.message); }
    }));
    const bind3 = (id, fn) => { const b = el.querySelector('#'+id); if (b) b.addEventListener('click', fn); };
    bind3('gbBoek', async () => { try { await API.call('/supplier/gebouw/zaal', { zaalId: $('#gbZaal').value, huurder: $('#gbHuurder').value, datum: $('#gbDatum').value, van: $('#gbVan').value, tot: $('#gbTot').value }); toast(T('gb.geboekt','Zaal geboekt.')); renderGebouw(); } catch(e){ toast(e.message); } });
    bind3('gbBezMeld', async () => { try { await API.call('/supplier/gebouw/bezoeker', { naam: $('#gbBezNaam').value, voorWie: $('#gbBezVoor').value }); renderGebouw(); } catch(e){ toast(e.message); } });
    bind3('gbMeld', async () => { try { await API.call('/supplier/gebouw/melding', { soort: $('#gbMSoort').value, verdieping: $('#gbMVerd').value, tekst: $('#gbMTekst').value }); renderGebouw(); } catch(e){ toast(e.message); } });
    bind3('gbValet', async () => { try { await API.call('/supplier/gebouw/valet', { wie: $('#gbValetWie').value }); renderGebouw(); } catch(e){ toast(e.message); } });
    bind3('gbJVraag', async () => { try { await API.call('/supplier/gebouw/jetset', { soort: $('#gbJSoort').value, voorWie: $('#gbJVoor').value, wens: $('#gbJWens').value }); renderGebouw(); } catch(e){ toast(e.message); } });
    doe('data-gbzweg', '/supplier/gebouw/zaal/weg', ds => ({ id: ds.gbzweg }));
    doe('data-gbbin', '/supplier/gebouw/bezoeker/status', ds => ({ id: ds.gbbin, status: 'binnen' }));
    doe('data-gbweg', '/supplier/gebouw/bezoeker/status', ds => ({ id: ds.gbweg, status: 'vertrokken' }));
    doe('data-gbmb', '/supplier/gebouw/melding/status', ds => ({ id: ds.gbmb, status: 'bezig' }));
    doe('data-gbmk', '/supplier/gebouw/melding/status', ds => ({ id: ds.gbmk, status: 'klaar' }));
    doe('data-gbvv', '/supplier/gebouw/valet/status', ds => ({ id: ds.gbvv, status: 'voorgereden' }));
    doe('data-gbvk', '/supplier/gebouw/valet/status', ds => ({ id: ds.gbvk, status: 'klaar' }));
    doe('data-gbjb', '/supplier/gebouw/jetset/status', ds => ({ id: ds.gbjb, status: 'bevestigd' }));
    doe('data-gbja', '/supplier/gebouw/jetset/status', ds => ({ id: ds.gbja, status: 'afgerond' }));
  }
