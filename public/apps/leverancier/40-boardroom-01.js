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
    return '<div class="card"><div class="tt-h">📅 '+T('ag.titel','Agenda')+(o.telling?' <span style="color:#E0736A;">('+o.telling+')</span>':'')+'</div>'+
      (items.length ? items.map(i => '<div class="mitem" data-agitem="'+i.id+'" style="opacity:'+(i.gedaan?'0.55':'1')+';"><div class="r1"><span class="nm">'+(i.gedaan?'✓ ':'')+esc(i.titel)+'</span><span class="pr" style="color:var(--soft);">'+esc(dagLbl(i.datum))+(i.tijd?' · '+esc(i.tijd):'')+'</span></div>'+
        (canEdit?'<div style="margin-top:0.35rem;display:flex;gap:0.4rem;">'+(!i.gedaan?'<button class="obtn" data-'+prefix+'done="'+i.id+'">'+T('ag.gedaan','Gedaan')+'</button>':'')+'<button class="rr-del" data-'+prefix+'del="'+i.id+'">✕</button></div>':'')+'</div>').join('')
        : '<div class="ds" style="margin-top:0.5rem;">'+T('ag.leeg','Nog niets gepland. Typ hieronder of laat de AI het inplannen.')+'</div>')+
      (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><input id="'+prefix+'Titel" placeholder="'+T('ag.wat','Afspraak')+'" '+inp+' style="flex:1;min-width:8rem;"><input id="'+prefix+'Datum" type="date" '+inp+'><input id="'+prefix+'Tijd" type="time" '+inp+'><button class="obtn primary" id="'+prefix+'Add">+</button></div>'+
        '<div style="margin-top:0.6rem;border-top:1px solid var(--line);padding-top:0.6rem;"><div style="font-size:0.72rem;color:var(--soft);margin-bottom:0.3rem;">✨ '+T('ag.aihint','Of typ het in gewone taal:')+'</div><div id="'+prefix+'AiOut"></div><div style="display:flex;gap:0.4rem;margin-top:0.4rem;"><input id="'+prefix+'AiIn" placeholder="'+T('ag.aiph','bijv. vergadering morgen om 15u')+'" '+inp+' style="flex:1;"><button class="obtn primary" id="'+prefix+'AiGo">'+T('ag.plan','Plan')+'</button></div></div>' : '')+'</div>';
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
    renderAgendaSup();
    let d; try { d = await API.call('/supplier/zaak/board'); } catch(e){ return; }
    const zbChips = '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">'+
      (d.functies||[]).map(f => '<button class="js-zbf" data-id="'+f.id+'" data-aan="'+f.aan+'" style="border:1px solid '+(f.aan?'#1f5637':'var(--rood)')+';background:'+(f.aan?'#12321f':'#3a1420')+';color:'+(f.aan?'#7EE0A3':'#F4B8C6')+';border-radius:999px;padding:0.34rem 0.75rem;font-size:0.74rem;font-weight:600;font-family:inherit;">'+(f.aan?'● ':'○ ')+esc(f.naam)+'</button>').join('')+
      '</div>';
    let h = funcBlok(T('zb.functies','Functies (aan/uit)'), d.functies||[], zbChips);
    // HR
    const hr = d.hr || {};
    h += '<div class="st-sec">👥 '+T('zb.hr','HR')+'</div><div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.6rem;">'+
      zbCel(hr.teamAantal||0, T('zb.team','Team'))+zbCel(hr.ingeklokt||0, T('zb.ingeklokt','Ingeklokt'))+
      zbCel(hr.openVerlof||0, T('zb.verlof','Verlof/ziek'), hr.openVerlof)+zbCel(hr.openSollicitaties||0, T('zb.soll','Sollicitaties'), hr.openSollicitaties)+
      zbCel(hr.openVacatures||0, T('zb.vac','Vacatures'))+'</div>'+
      '<button class="js-zbnaar" data-tab="team" style="background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--txt);font-size:0.75rem;font-family:inherit;margin-bottom:1rem;">'+T('zb.naarteam','Naar het team ›')+'</button>';
    // Marketing
    const mk = d.marketing || {};
    h += '<div class="st-sec">📣 '+T('zb.marketing','Marketing (De Salon)')+'</div><div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
      zbCel(mk.volgers||0, T('zb.volgers','Volgers'))+zbCel(mk.posts||0, T('zb.posts','Posts'))+
      zbCel(mk.lopendeDeal?1:0, T('zb.deal','Actie'))+zbCel(mk.lopendePoll?1:0, T('zb.poll','Poll'))+'</div>'+
      '<div class="sub" style="margin-bottom:0.4rem;">'+(mk.salonActief? (mk.bioIngevuld&&mk.fotoIngevuld ? '✓ '+T('zb.compleet','profiel compleet, zichtbaar voor leden') : '⚠️ '+T('zb.onvolledig','profiel onvolledig, nog niet zichtbaar')) : '○ '+T('zb.salonuit','Salon-marketing staat uit'))+'</div>'+
      (mk.laatstePost? '<div class="sub">'+T('zb.laatste','Laatste post')+': '+esc(mk.laatstePost.text)+'</div>' : '')+
      '<button class="js-zbnaar" data-tab="page" style="background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--txt);font-size:0.75rem;font-family:inherit;margin-top:0.5rem;">'+T('zb.naarsalon','Naar De Salon ›')+'</button>';
    // Rechtstreekse ontvangsten: geld dat direct van klanten binnenkwam (Face ID)
    let ont = null; try { ont = await API.call('/supplier/ontvangsten'); } catch(e){}
