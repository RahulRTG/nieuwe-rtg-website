
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
