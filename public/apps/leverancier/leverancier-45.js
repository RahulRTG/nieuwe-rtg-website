/* een melding in het vrachtlogboek */
    el.querySelectorAll('[data-vrmeld]').forEach(b => b.addEventListener('click', async () => {
      const t = prompt(T('vr.meldvraag','Korte melding voor het logboek (de klant ziet dit op de volgcode):')); if (!t) return;
      try { await API.call('/supplier/vracht/melding', { id:b.dataset.vrmeld, tekst:t, idem:RTGIdem('vracht-melding') }); renderVracht(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-vrcode]').forEach(b => b.addEventListener('click', async () => {
      if (b.dataset.vrcodeActief === '1' && !confirm(T('vr.codevervangvraag','De huidige klantcode wordt direct onbruikbaar. Een nieuwe uitgeven?'))) return;
      try {
        const d = await API.call('/supplier/vracht/volgcode/roteer', { id:b.dataset.vrcode, idem:RTGIdem('vracht-code') });
        vrToonCode(d.zending && d.zending.volgcode, T('vr.codekopvernieuw','Vernieuwde volgcode voor de klant'));
        renderVracht();
      } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-vrcode-weg]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm(T('vr.codeintrekvraag','Deze klantcode direct intrekken?'))) return;
      try { await API.call('/supplier/vracht/volgcode/intrek', { id:b.dataset.vrcodeWeg, reden:'ingetrokken vanuit vrachtbeheer' }); renderVracht(); }
      catch(e){ toast(e.message); }
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
    let h = '<div class="s-1ah2knl">'+
      [[k.huurders, T('gb.k.huurders','huurders')],[k.bezetting+'%', T('gb.k.bezetting','bezetting')],[k.zalenVandaag, T('gb.k.zalen','zalen vandaag')],[k.openMeldingen, T('gb.k.meld','open meldingen')],[k.bezoekersBinnen, T('gb.k.binnen','bezoekers binnen')],[k.jetsetOpen, T('gb.k.jetset','jetset open')]]
        .map(x=>'<div class="s-1fk9glc"><b class="s-123kxff">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    // de stapeling: huurders per verdieping, van boven naar beneden
    h += '<div class="st-sec h-mt100">'+T('gb.toren',(d.naam||'De toren')+' · '+d.vloeren+' verdiepingen')+'</div>';
    h += d.huurders.map(x => '<div class="s-15d06p3">'+
      '<span class="sub" style="flex:0 0 5.5rem;">'+T('gb.verd','verdieping')+' '+x.verdiepingen.join(' + ')+'</span><b class="s-1q6kbkp">'+esc(x.naam)+'</b><span class="sub">'+x.badges+' '+T('gb.passen','passen')+'</span></div>').join('');

    // vergaderzalen: boeken zonder dubbele boekingen
    h += '<div class="st-sec h-mt100">'+T('gb.zalen','Vergaderzalen')+'</div>'+
      '<div class="s-owx58s">'+
      '<div class="row-gap"><select id="gbZaal" class="st-in h-flex2">'+d.zalen.map(z=>'<option value="'+z.id+'">'+esc(z.naam)+' · vd '+z.verdieping+' · '+z.capaciteit+'p · '+eur(z.uurprijs)+'/u</option>').join('')+'</select>'+
      '<input id="gbHuurder" class="st-in h-flex2" placeholder="'+T('gb.huurder','Huurder')+'" maxlength="60"></div>'+
      '<div class="row-gap h-mt40"><input id="gbDatum" class="st-in h-flex1" type="date"><input id="gbVan" class="st-in h-flex1" type="time"><input id="gbTot" class="st-in h-flex1" type="time">'+
      '<button id="gbBoek" class="s-ytc7pj">'+T('gb.boek','Boek')+'</button></div>'+
      ((d.boekingen||[]).length ? d.boekingen.slice(0,8).map(b=>'<div class="sub h-mt35">'+esc(b.datum)+' '+esc(b.van)+' tot '+esc(b.tot)+' · '+esc(b.zaal)+' · '+esc(b.huurder)+' · '+eur(b.prijs)+' <button data-gbzweg="'+b.id+'" class="s-1c3qrvd">✕</button></div>').join('') : '<p class="sub h-mt40">'+T('gb.geenboek','Nog geen boekingen.')+'</p>')+'</div>';

    // receptie: de bezoekersstroom
    h += '<div class="st-sec h-mt100">'+T('gb.receptie','Receptie · bezoekers')+'</div>'+
      '<div class="row-gap"><input id="gbBezNaam" class="st-in h-flex2" placeholder="'+T('gb.bez.naam','Naam bezoeker')+'" maxlength="60"><input id="gbBezVoor" class="st-in h-flex2" placeholder="'+T('gb.bez.voor','Voor welke huurder')+'" maxlength="60"><button id="gbBezMeld" class="s-ytc7pj">'+T('gb.bez.meld','Aanmelden')+'</button></div>';
    h += (d.bezoekers||[]).slice(0,8).map(b=>'<div class="s-57bs1i">'+
      '<b class="s-1q6kbkp">'+esc(b.naam)+'</b><span class="sub">'+esc(b.voorWie)+' · '+esc(b.status)+(b.badge?' · '+esc(b.badge):'')+'</span>'+
      (b.status==='verwacht'?gbKnop('data-gbbin', b.id, T('gb.bez.binnen','Binnen'), true):b.status==='binnen'?gbKnop('data-gbweg', b.id, T('gb.bez.weg','Vertrokken')):'')+'</div>').join('') || '<p class="sub">'+T('gb.bez.geen','Nog geen bezoekers aangemeld.')+'</p>';

    // facilitair: meldingen door het gebouw
    h += '<div class="st-sec h-mt100">'+T('gb.fac','Facilitair · meldingen')+'</div>'+
      '<div class="row-gap"><select id="gbMSoort" class="st-in h-flex1">'+Object.keys(GB_MELD).map(s=>'<option value="'+s+'">'+GB_MELD[s]+'</option>').join('')+'</select>'+
      '<input id="gbMVerd" class="st-in s-12b8eiu" type="number" min="1" max="'+d.vloeren+'" placeholder="'+T('gb.m.verd','Verd.')+'"><input id="gbMTekst" class="st-in s-1dzu8du" placeholder="'+T('gb.m.tekst','Wat is er nodig?')+'" maxlength="160"><button id="gbMeld" class="s-ytc7pj">'+T('gb.m.meld','Meld')+'</button></div>';
    h += (d.meldingen||[]).filter(m=>m.status!=='klaar').map(m=>'<div class="s-57bs1i">'+
      '<span class="sub" style="flex:0 0 7rem;">'+GB_MELD[m.soort]+' · vd '+m.verdieping+'</span><b class="s-1q6iem4">'+esc(m.tekst)+'</b><span class="sub">'+esc(m.status)+'</span>'+
      (m.status==='open'?gbKnop('data-gbmb', m.id, T('gb.m.pak','Oppakken'), true):gbKnop('data-gbmk', m.id, T('gb.m.klaar','Klaar'), true))+'</div>').join('') || '<p class="sub">'+T('gb.m.geen','Geen open meldingen; het huis is op orde.')+'</p>';

    // valet + de jetset-laag
    h += '<div class="st-sec h-mt100">'+T('gb.jetset','Valet en de jetset-diensten')+'</div>'+
      '<div class="row-gap"><input id="gbValetWie" class="st-in h-flex2" placeholder="'+T('gb.valet.wie','Valet: voor wie?')+'" maxlength="60"><button id="gbValet" class="s-1kjog3n">'+T('gb.valet.vraag','Wagen voorrijden')+'</button></div>';
    h += (d.valet||[]).filter(v=>v.status!=='klaar').map(v=>'<div class="sub" style="padding:0.3rem 0;">'+esc(v.wie)+' · '+esc(v.wagen)+' · '+esc(v.status)+' '+
      (v.status==='gevraagd'?gbKnop('data-gbvv', v.id, T('gb.valet.voor','Voorgereden'), true):gbKnop('data-gbvk', v.id, T('gb.valet.klaar','Klaar'), true))+'</div>').join('');
    h += '<div class="row-gap h-mt50"><select id="gbJSoort" class="st-in h-flex1">'+Object.keys(GB_JET).map(s=>'<option value="'+s+'">'+GB_JET[s]+'</option>').join('')+'</select>'+
      '<input id="gbJVoor" class="st-in h-flex1" placeholder="'+T('gb.j.voor','Voor wie')+'" maxlength="60"><input id="gbJWens" class="st-in s-1dzu8du" placeholder="'+T('gb.j.wens','De wens (bijv. wagen naar Schiphol om 16:00)')+'" maxlength="160"><button id="gbJVraag" class="s-ytc7pj">'+T('gb.j.vraag','Vraag aan')+'</button></div>';
    h += (d.jetset||[]).map(j=>'<div class="' + (j.status==='afgerond' ? 's-q8bqou' : 's-dbavhu') + '">'+
      '<div class="s-tbd6xd"><b class="s-1q6kbkp">'+GB_JET[j.soort]+' · '+esc(j.voorWie)+'</b><span class="sub">'+esc(j.status)+'</span></div>'+
      '<div class="sub">'+esc(j.wens)+' · '+esc(j.moment)+(j.notitie?' · '+esc(j.notitie):'')+'</div>'+
      (j.status!=='afgerond'?'<div class="s-1stuony">'+
        (j.status==='aangevraagd'?gbKnop('data-gbjb', j.id, T('gb.j.bevestig','Bevestig'), true):'')+gbKnop('data-gbja', j.id, T('gb.j.afgerond','Afgerond'))+'</div>':'')+'</div>').join('');
    h += '<p class="sub h-mt50">'+T('gb.j.regel','Een jet-transfer is een dienstverzoek aan RTG Aviation; de concierge bevestigt pas na overleg, nooit vanzelf.')+'</p>';
    el.innerHTML = h;
