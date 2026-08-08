    // de pas-controle: alleen actief, pakket en codenaam
    h += '<div class="st-sec h-mt100">'+T('zp.check','Pas-controle')+'</div>'+
      '<div class="row-gap"><input id="zpCPas" class="st-in" placeholder="'+T('zp.pasnr','Pasnummer (ZP-XXXX)')+'" maxlength="12" style="flex:2;text-transform:uppercase;">'+
      '<button id="zpCGo" style="flex:1;'+goud+'">'+T('zp.controle','Controleer')+'</button></div><div id="zpCUit" class="sub h-mt40"></div>';
    el.innerHTML = h;

    const doe = (sel, pad, body) => el.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      try { await API.call(pad, body(b.dataset)); renderZorgpolis(); } catch(e){ toast(e.message); }
    }));
    const bz = (id, fn) => { const b = el.querySelector('#'+id); if (b) b.addEventListener('click', fn); };
    bz('zpIn', async () => { try { const r = await API.call('/supplier/zorgpolis/inschrijf', { codenaam: $('#zpCode').value, pakket: $('#zpPakket').value, door: (state && state.actor && state.actor.name) || '' }); toast(T('zp.klaar','Ingeschreven; pas ')+r.verzekerde.pas+T('zp.inwallet',' ligt in de wallet van het lid.')); renderZorgpolis(); } catch(e){ toast(e.message); } });
    bz('zpDIn', async () => { try { await API.call('/supplier/zorgpolis/declaratie', { pas: $('#zpDPas').value, omschrijving: $('#zpDOms').value, bedrag: $('#zpDBedrag').value }); renderZorgpolis(); } catch(e){ toast(e.message); } });
    bz('zpCGo', async () => { try { const r = await API.call('/supplier/zorgpolis/pas', { pas: $('#zpCPas').value });
      $('#zpCUit').textContent = (r.actief ? T('zp.actief','Actief') : T('zp.nietactief','Niet actief')) + ' · ' + r.pakket + ' · ' + r.codenaam;
    } catch(e){ $('#zpCUit').textContent = e.message; } });
    doe('data-zpstop', '/supplier/zorgpolis/stop', ds => ({ id: ds.zpstop }));
    doe('data-zpgoed', '/supplier/zorgpolis/declaratie/beslis', ds => ({ id: ds.zpgoed, besluit: 'goedgekeurd', door: (state && state.actor && state.actor.name) || '' }));
    el.querySelectorAll('[data-zpaf]').forEach(b => b.addEventListener('click', async () => {
      const idd = b.dataset.zpaf;
      try { await API.call('/supplier/zorgpolis/declaratie/beslis', { id: idd, besluit: 'afgewezen',
        reden: (el.querySelector('[data-zpredin="'+idd+'"]')||{}).value, door: (state && state.actor && state.actor.name) || '' }); renderZorgpolis(); } catch(e){ toast(e.message); }
    }));
  }
  // ---- de eigen mini-boardroom van de zaak: functies + HR + marketing ----
  // ---- interactieve AI-agenda in de boardroom + ballon-badge op de Meer-tab ----
  let agendaSupData = null;
  function agendaBadgeSup(n){
    const tab = document.querySelector('#tabbar [data-tab="meer"]'); if (!tab) return;
    tab.style.position = 'relative';
    let b = tab.querySelector('.ag-ballon');
    if (n > 0){
      if (!b){ b = document.createElement('span'); b.className = 'ag-ballon'; b.setAttribute('aria-label', T('ag.badge','afspraken op de agenda')); tab.appendChild(b); }
      b.textContent = n > 9 ? '9+' : String(n);
      b.style.cssText = 'position:absolute;top:3px;left:50%;margin-left:6px;min-width:15px;height:15px;padding:0 3px;border-radius:8px;background:#E0736A;color:#fff;font-size:9px;font-weight:700;line-height:15px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.4);';
    } else if (b) b.remove();
  }
  async function laadAgendaSup(){ if (!API.live) return; try { agendaSupData = await API.call('/supplier/agenda/lijst', {}); } catch(e){ agendaSupData = { items:[], telling:0 }; } agendaBadgeSup(agendaSupData.telling||0); renderAgendaSup(); }
  function agendaToeSup(r){ if (r && r.items){ agendaSupData = r; agendaBadgeSup(r.telling||0); } renderAgendaSup(); }
  function agendaCardHtml(o, canEdit, prefix, aiPad){
    const dagLbl = d => { try { return new Date(d+'T12:00:00').toLocaleDateString(lang()==='en'?'en-GB':'nl-NL',{weekday:'short',day:'numeric',month:'short'}); } catch(e){ return d; } };
    const inp = 'style="background:var(--card,var(--bg));border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"';
    const items = o.items||[];
    return '<div class="card"><div class="tt-h">'+T('ag.titel','Agenda')+(o.telling?' <span style="color:#E0736A;">('+o.telling+')</span>':'')+'</div>'+
      (items.length ? items.map(i => '<div class="mitem" data-agitem="'+i.id+'" style="opacity:'+(i.gedaan?'0.55':'1')+';"><div class="r1"><span class="nm">'+(i.gedaan?'✓ ':'')+esc(i.titel)+'</span><span class="pr" style="color:var(--soft);">'+esc(dagLbl(i.datum))+(i.tijd?' · '+esc(i.tijd):'')+'</span></div>'+
        (canEdit?'<div style="margin-top:0.35rem;display:flex;gap:0.4rem;">'+(!i.gedaan?'<button class="obtn" data-'+prefix+'done="'+i.id+'">'+T('ag.gedaan','Gedaan')+'</button>':'')+'<button class="rr-del" data-'+prefix+'del="'+i.id+'">✕</button></div>':'')+'</div>').join('')
        : '<div class="ds h-mt50">'+T('ag.leeg','Nog niets gepland. Typ hieronder of laat de AI het inplannen.')+'</div>')+
      (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><input id="'+prefix+'Titel" placeholder="'+T('ag.wat','Afspraak')+'" '+inp+' style="flex:1;min-width:8rem;"><input id="'+prefix+'Datum" type="date" '+inp+'><input id="'+prefix+'Tijd" type="time" '+inp+'><button class="obtn primary" id="'+prefix+'Add">+</button></div>'+
        '<div style="margin-top:0.6rem;border-top:1px solid var(--line);padding-top:0.6rem;"><div style="font-size:0.72rem;color:var(--soft);margin-bottom:0.3rem;">'+T('ag.aihint','Of typ het in gewone taal:')+'</div><div id="'+prefix+'AiOut"></div><div style="display:flex;gap:0.4rem;margin-top:0.4rem;"><input id="'+prefix+'AiIn" placeholder="'+T('ag.aiph','bijv. vergadering morgen om 15u')+'" '+inp+' class="h-flex1"><button class="obtn primary" id="'+prefix+'AiGo">'+T('ag.plan','Plan')+'</button></div></div>' : '')+'</div>';
  }
  function renderAgendaSup(){
    const el = $('#agendaSupCard'); if (!el) return;
    if (!actor().manager){ el.innerHTML = ''; return; }
    if (!agendaSupData){ el.innerHTML = ''; laadAgendaSup(); return; }
    el.innerHTML = agendaCardHtml(agendaSupData, true, 'sag', '/supplier/agenda');
    el.querySelectorAll('[data-sagdone]').forEach(b => b.addEventListener('click', async () => { try { agendaToeSup(await API.call('/supplier/agenda/wijzig', { id: b.dataset.sagdone, gedaan: true })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-sagdel]').forEach(b => b.addEventListener('click', async () => { try { agendaToeSup(await API.call('/supplier/agenda/verwijder', { id: b.dataset.sagdel })); } catch(e){ toast(e.message); } }));
    const add = $('#sagAdd'); if (add) add.addEventListener('click', async () => { const titel = $('#sagTitel').value.trim(); const datum = $('#sagDatum').value; if (!titel||!datum){ toast(T('ag.vulin','Vul een afspraak en datum in.')); return; } try { agendaToeSup(await API.call('/supplier/agenda/toevoegen', { titel, datum, tijd: $('#sagTijd').value })); } catch(e){ toast(e.message); } });
    const aiGo = $('#sagAiGo'); if (aiGo){ const doe = async () => { const opdracht = $('#sagAiIn').value.trim(); if (!opdracht) return; const out = $('#sagAiOut'); out.innerHTML = '<div class="ds">…</div>'; try { const r = await API.call('/supplier/agenda/ai', { opdracht }); out.innerHTML = '<div class="ds" style="color:'+(r.gedaan?'#7EE0A3':'var(--txt)')+';">'+esc(r.antwoord)+'</div>'; $('#sagAiIn').value=''; agendaToeSup(r); } catch(e){ out.innerHTML = '<div class="ds" style="color:#E0736A;">'+esc(e.message)+'</div>'; } }; aiGo.addEventListener('click', doe); const i2 = $('#sagAiIn'); if (i2) i2.addEventListener('keydown', e => { if (e.key==='Enter') doe(); }); }
  }

  async function renderZaakBoard(){
    const el = $('#boardroomWrap'); if (!el) return;
    renderVooruitSup();   // wat er vanzelf op de zaak afkomt (54b), boven de agenda
    renderAgendaSup();
    let d; try { d = await API.call('/supplier/zaak/board'); } catch(e){ return; }
    const zbChips = '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">'+
      (d.functies||[]).map(f => '<button class="js-zbf" data-id="'+f.id+'" data-aan="'+f.aan+'" style="border:1px solid '+(f.aan?'#1f5637':'var(--rood)')+';background:'+(f.aan?'#12321f':'#3a1420')+';color:'+(f.aan?'#7EE0A3':'#F4B8C6')+';border-radius:999px;padding:0.34rem 0.75rem;font-size:0.74rem;font-weight:600;font-family:inherit;">'+(f.aan?'● ':'○ ')+esc(f.naam)+'</button>').join('')+
      '</div>';
    let h = funcBlok(T('zb.functies','Functies (aan/uit)'), d.functies||[], zbChips);
    // HR
