/* een melding in het vrachtlogboek */
    el.querySelectorAll('[data-vrmeld]').forEach(b => b.addEventListener('click', async () => {
      const t = prompt(T('vr.meldvraag','Korte melding voor het logboek (de klant ziet dit op de volgcode):')); if (!t) return;
      try { await API.call('/supplier/vracht/melding', { id:b.dataset.vrmeld, tekst:t }); renderVracht(); } catch(e){ toast(e.message); }
    }));
  }

  // ---- het kantoorgebouw (RTG Enterprise): het hele huis op een scherm ----
  const GB_MELD = { schoonmaak: 'Schoonmaak', onderhoud: 'Onderhoud', catering: 'Catering' };
  const GB_JET = { concierge: 'Concierge', chauffeur: 'Chauffeur', 'jet-transfer': 'Jet-transfer', lounge: 'Executive lounge' };

  function gbKnop(attr, id, tekst, goud){
    return '<button '+attr+'="'+id+'" style="'+(goud?'background:var(--gold);color:#000;border:none;':'background:none;border:1px solid var(--line);color:var(--soft);')+'border-radius:0;padding:0.35rem 0.7rem;font-family:inherit;font-size:0.72rem;'+(goud?'font-weight:600;':'')+'">'+tekst+'</button>';
  }
  async function renderGebouw(){
    const el = $('#gebWrap'); if (!el) return;
    if (!has('gebouw')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/gebouw'); } catch(e){ el.innerHTML = '<p class="sub">'+esc(e.message)+'</p>'; return; }
    const k = d.kpi;
    let h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr));gap:0.5rem;">'+
      [[k.huurders, T('gb.k.huurders','huurders')],[k.bezetting+'%', T('gb.k.bezetting','bezetting')],[k.zalenVandaag, T('gb.k.zalen','zalen vandaag')],[k.openMeldingen, T('gb.k.meld','open meldingen')],[k.bezoekersBinnen, T('gb.k.binnen','bezoekers binnen')],[k.jetsetOpen, T('gb.k.jetset','jetset open')]]
        .map(x=>'<div style="border:1px solid var(--line);border-radius:0;padding:0.55rem 0.7rem;text-align:center;"><b style="font-size:1.1rem;display:block;">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    // de stapeling: huurders per verdieping, van boven naar beneden
    h += '<div class="st-sec h-mt100">'+T('gb.toren',(d.naam||'De toren')+' · '+d.vloeren+' verdiepingen')+'</div>';
    h += d.huurders.map(x => '<div style="display:flex;gap:0.6rem;align-items:baseline;border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
      '<span class="sub" style="flex:0 0 5.5rem;">'+T('gb.verd','verdieping')+' '+x.verdiepingen.join(' + ')+'</span><b style="flex:1;font-size:0.85rem;">'+esc(x.naam)+'</b><span class="sub">'+x.badges+' '+T('gb.passen','passen')+'</span></div>').join('');

    // vergaderzalen: boeken zonder dubbele boekingen
    h += '<div class="st-sec h-mt100">'+T('gb.zalen','Vergaderzalen')+'</div>'+
      '<div style="border:1px solid var(--line);border-radius:0;padding:0.8rem;">'+
      '<div class="row-gap"><select id="gbZaal" class="st-in h-flex2">'+d.zalen.map(z=>'<option value="'+z.id+'">'+esc(z.naam)+' · vd '+z.verdieping+' · '+z.capaciteit+'p · '+eur(z.uurprijs)+'/u</option>').join('')+'</select>'+
      '<input id="gbHuurder" class="st-in" placeholder="'+T('gb.huurder','Huurder')+'" maxlength="60" class="h-flex2"></div>'+
      '<div class="row-gap h-mt40"><input id="gbDatum" class="st-in" type="date" class="h-flex1"><input id="gbVan" class="st-in" type="time" class="h-flex1"><input id="gbTot" class="st-in" type="time" class="h-flex1">'+
      '<button id="gbBoek" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:0;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('gb.boek','Boek')+'</button></div>'+
      ((d.boekingen||[]).length ? d.boekingen.slice(0,8).map(b=>'<div class="sub h-mt35">'+esc(b.datum)+' '+esc(b.van)+' tot '+esc(b.tot)+' · '+esc(b.zaal)+' · '+esc(b.huurder)+' · '+eur(b.prijs)+' <button data-gbzweg="'+b.id+'" style="background:none;border:none;color:var(--soft);cursor:pointer;">✕</button></div>').join('') : '<p class="sub h-mt40">'+T('gb.geenboek','Nog geen boekingen.')+'</p>')+'</div>';

    // receptie: de bezoekersstroom
    h += '<div class="st-sec h-mt100">'+T('gb.receptie','Receptie · bezoekers')+'</div>'+
      '<div class="row-gap"><input id="gbBezNaam" class="st-in" placeholder="'+T('gb.bez.naam','Naam bezoeker')+'" maxlength="60" class="h-flex2"><input id="gbBezVoor" class="st-in" placeholder="'+T('gb.bez.voor','Voor welke huurder')+'" maxlength="60" class="h-flex2"><button id="gbBezMeld" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:0;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('gb.bez.meld','Aanmelden')+'</button></div>';
    h += (d.bezoekers||[]).slice(0,8).map(b=>'<div style="display:flex;gap:0.5rem;align-items:center;border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
      '<b style="flex:1;font-size:0.85rem;">'+esc(b.naam)+'</b><span class="sub">'+esc(b.voorWie)+' · '+esc(b.status)+(b.badge?' · '+esc(b.badge):'')+'</span>'+
      (b.status==='verwacht'?gbKnop('data-gbbin', b.id, T('gb.bez.binnen','Binnen'), true):b.status==='binnen'?gbKnop('data-gbweg', b.id, T('gb.bez.weg','Vertrokken')):'')+'</div>').join('') || '<p class="sub">'+T('gb.bez.geen','Nog geen bezoekers aangemeld.')+'</p>';

    // facilitair: meldingen door het gebouw
    h += '<div class="st-sec h-mt100">'+T('gb.fac','Facilitair · meldingen')+'</div>'+
      '<div class="row-gap"><select id="gbMSoort" class="st-in h-flex1">'+Object.keys(GB_MELD).map(s=>'<option value="'+s+'">'+GB_MELD[s]+'</option>').join('')+'</select>'+
      '<input id="gbMVerd" class="st-in" type="number" min="1" max="'+d.vloeren+'" placeholder="'+T('gb.m.verd','Verd.')+'" style="flex:0 0 5rem;"><input id="gbMTekst" class="st-in" placeholder="'+T('gb.m.tekst','Wat is er nodig?')+'" maxlength="160" style="flex:3;"><button id="gbMeld" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:0;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('gb.m.meld','Meld')+'</button></div>';
    h += (d.meldingen||[]).filter(m=>m.status!=='klaar').map(m=>'<div style="display:flex;gap:0.5rem;align-items:center;border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
      '<span class="sub" style="flex:0 0 7rem;">'+GB_MELD[m.soort]+' · vd '+m.verdieping+'</span><b style="flex:1;font-size:0.82rem;">'+esc(m.tekst)+'</b><span class="sub">'+esc(m.status)+'</span>'+
      (m.status==='open'?gbKnop('data-gbmb', m.id, T('gb.m.pak','Oppakken'), true):gbKnop('data-gbmk', m.id, T('gb.m.klaar','Klaar'), true))+'</div>').join('') || '<p class="sub">'+T('gb.m.geen','Geen open meldingen; het huis is op orde.')+'</p>';

    // valet + de jetset-laag
    h += '<div class="st-sec h-mt100">'+T('gb.jetset','Valet en de jetset-diensten')+'</div>'+
      '<div class="row-gap"><input id="gbValetWie" class="st-in" placeholder="'+T('gb.valet.wie','Valet: voor wie?')+'" maxlength="60" class="h-flex2"><button id="gbValet" style="flex:1;background:none;border:1px solid var(--line);border-radius:0;padding:0.45rem;color:var(--txt);font-family:inherit;">'+T('gb.valet.vraag','Wagen voorrijden')+'</button></div>';
    h += (d.valet||[]).filter(v=>v.status!=='klaar').map(v=>'<div class="sub" style="padding:0.3rem 0;">'+esc(v.wie)+' · '+esc(v.wagen)+' · '+esc(v.status)+' '+
      (v.status==='gevraagd'?gbKnop('data-gbvv', v.id, T('gb.valet.voor','Voorgereden'), true):gbKnop('data-gbvk', v.id, T('gb.valet.klaar','Klaar'), true))+'</div>').join('');
    h += '<div class="row-gap h-mt50"><select id="gbJSoort" class="st-in h-flex1">'+Object.keys(GB_JET).map(s=>'<option value="'+s+'">'+GB_JET[s]+'</option>').join('')+'</select>'+
      '<input id="gbJVoor" class="st-in" placeholder="'+T('gb.j.voor','Voor wie')+'" maxlength="60" class="h-flex1"><input id="gbJWens" class="st-in" placeholder="'+T('gb.j.wens','De wens (bijv. wagen naar Schiphol om 16:00)')+'" maxlength="160" style="flex:3;"><button id="gbJVraag" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:0;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('gb.j.vraag','Vraag aan')+'</button></div>';
    h += (d.jetset||[]).map(j=>'<div style="border:1px solid '+(j.status==='afgerond'?'var(--line)':'var(--gold)')+';border-radius:0;padding:0.6rem 0.8rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="flex:1;font-size:0.85rem;">'+GB_JET[j.soort]+' · '+esc(j.voorWie)+'</b><span class="sub">'+esc(j.status)+'</span></div>'+
      '<div class="sub">'+esc(j.wens)+' · '+esc(j.moment)+(j.notitie?' · '+esc(j.notitie):'')+'</div>'+
      (j.status!=='afgerond'?'<div style="display:flex;gap:0.4rem;margin-top:0.5rem;">'+
        (j.status==='aangevraagd'?gbKnop('data-gbjb', j.id, T('gb.j.bevestig','Bevestig'), true):'')+gbKnop('data-gbja', j.id, T('gb.j.afgerond','Afgerond'))+'</div>':'')+'</div>').join('');
    h += '<p class="sub h-mt50">'+T('gb.j.regel','Een jet-transfer is een dienstverzoek aan RTG Aviation; de concierge bevestigt pas na overleg, nooit vanzelf.')+'</p>';
    el.innerHTML = h;

