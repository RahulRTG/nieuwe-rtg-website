  function renderTickets(){
    const el = $('#ticketsWrap'); if (!el) return;
    if (!has('tickets')){ el.innerHTML = ''; return; }
    if (!programma){ el.innerHTML = '<div class="empty">'+T('tk2.laden','Programma laden\u2026')+'</div>'; laadProgramma(); return; }
    const canEdit = actor().manager;
    let html = '';
    // entree-check: code afvinken op eigen naam
    html += '<div class="card"><div class="tt-h">'+T('tk2.deur','Entree-check')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;">'+
      '<input id="tkCode" placeholder="'+T('tk2.codeph','Entreecode, bijv. K7M2PX')+'" style="flex:1;background:var(--card2,var(--card));border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;font-size:1rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--txt);outline:none;">'+
      '<button class="obtn primary" id="tkCheck">'+T('tk2.binnen','Binnen')+'</button></div>'+
      '<div id="tkUit" style="margin-top:0.5rem;font-size:0.82rem;color:var(--muted);"></div></div>';
    // dagprogramma
    const slots = programma.slots || [];
    html += '<div class="card"><div class="tt-h">'+T('tk2.prog','Programma vandaag')+' \u00B7 '+programma.datum+'</div>'+
      (slots.length ? slots.map((sl, i) =>
        '<div class="mitem"><div class="r1"><span class="nm">'+sl.tijd+' \u00B7 '+esc(sl.naam)+'</span>'+
        '<span class="pr">'+sl.binnen+'/'+sl.verkocht+' '+T('tk2.binnenkort','binnen')+' \u00B7 '+sl.verkocht+'/'+sl.capaciteit+'</span></div>'+
        (sl.gasten.length ? '<div class="ds"><button class="obtn" data-tkg="'+i+'" style="padding:0.2rem 0.8rem;font-size:0.7rem;">'+T('tk2.gasten','Gastenlijst')+' ('+sl.gasten.length+')</button>'+
          '<span id="tkGast-'+i+'" style="display:none;">'+sl.gasten.map(g => '<br>'+(g.binnen?'\u2705':'\u25CB')+' '+esc(g.codename)+' \u00B7 '+g.personen+'p \u00B7 '+g.code).join('')+'</span></div>' : '')+
        '</div>').join('')
      : '<div class="empty">'+T('tk2.leeg','Nog geen tijdsloten. '+(canEdit?'Voeg hieronder een activiteit toe.':''))+'</div>')+'</div>';
    // de eigen transferdienst (chauffeurs van de zaak rijden; ritten in de Ritten-tab)
    const tr = state.transfer;
    if (tr){
      html += '<div class="card"><div class="tt-h">'+T('tk2.transfer','Eigen transferdienst')+'</div>'+
        '<div style="margin-top:0.5rem;font-size:0.85rem;color:'+(tr.aan?'var(--green)':'var(--soft)')+';">'+
        (tr.aan ? '\u25CF '+T('tk2.tr.aan','Aan: gasten met een ticket vragen de transfer aan; uw chauffeurs zien de ritten in de Ritten-tab en op de PDA.')
                : '\u25CB '+T('tk2.tr.uit','Uit.'))+'</div>'+
        '<div style="margin-top:0.4rem;font-size:0.8rem;color:var(--muted);">'+T('tk2.tr.prijs','Prijs per rit:')+' <b style="color:var(--gold);">'+(tr.prijs ? eur(tr.prijs) : T('tk2.tr.incl','inclusief bij het ticket (\u20AC 0)'))+'</b></div>'+
        (canEdit ? '<div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.8rem;flex-wrap:wrap;">'+
          '<button class="obtn'+(tr.aan?'':' primary')+'" data-traan="'+(tr.aan?'0':'1')+'">'+(tr.aan?T('tk2.tr.zetuit','Zet uit'):T('tk2.tr.zetaan','Zet aan'))+'</button>'+
          '<input id="trPrijs" type="number" inputmode="decimal" value="'+(tr.prijs||0)+'" style="width:6rem;background:var(--card2,var(--card));border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.7rem;color:var(--txt);outline:none;">'+
          '<button class="obtn" id="trPrijsZet">'+T('tk2.tr.prijszet','Prijs opslaan')+'</button>'+
          '<span style="font-size:0.68rem;color:var(--soft);">'+T('tk2.tr.nul','0 = inclusief')+'</span></div>' : '')+'</div>';
    }
    // aanbodbeheer (manager)
    const acts = state.activiteiten || [];
    html += '<div class="card"><div class="tt-h">'+T('tk2.aanbod','Aanbod')+' ('+acts.length+')</div>'+
      acts.map(a => '<div class="mitem"><div class="r1"><span class="nm">'+esc(a.name)+'</span><span class="row-mid-gap"><span class="pr">'+eur(a.prijs)+'</span>'+
        (canEdit?'<button class="rr-del" data-tkdel="'+a.id+'">\u2715</button>':'')+'</span></div>'+
        '<div class="ds">'+(a.desc?esc(a.desc)+' \u00B7 ':'')+T('tk2.cap','cap.')+' '+a.capaciteit+' \u00B7 '+(a.tijden||[]).join(', ')+(a.duur?' \u00B7 '+esc(a.duur):'')+'</div></div>').join('')+
      (canEdit ? '<div style="margin-top:1rem;">'+
        '<div class="field"><label>'+T('tk2.f.naam','Activiteit')+'</label><input id="tkName" placeholder="'+T('tk2.f.naamph','Bijv. sunset cruise')+'"></div>'+
        '<div class="field"><label>'+T('tk2.f.desc','Omschrijving')+'</label><input id="tkDesc"></div>'+
        '<div class="row-gap">'+
        '<div class="field" style="flex:1;"><label>'+T('tk2.f.prijs','Prijs p.p. (\u20AC)')+'</label><input id="tkPrijs" type="number" inputmode="decimal"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('tk2.f.cap','Capaciteit')+'</label><input id="tkCap" type="number" inputmode="numeric"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('tk2.f.duur','Duur')+'</label><input id="tkDuur" placeholder="2 uur"></div></div>'+
        '<div class="field"><label>'+T('tk2.f.tijden','Tijdsloten (komma\'s)')+'</label><input id="tkTijden" placeholder="10:00, 14:00, 17:30"></div>'+
        '<button class="obtn primary" id="tkAdd">'+T('tk2.f.voeg','Toevoegen')+'</button></div>' : '')+'</div>';
    el.innerHTML = html;
    const check = document.getElementById('tkCheck');
    if (check) check.addEventListener('click', async () => {
      const uit = document.getElementById('tkUit');
      try {
        const r = await API.call('/supplier/ticket/checkin', { code: $('#tkCode').value });
        uit.innerHTML = '<span style="color:var(--green);">\u2705 '+esc(r.ticket.codename)+' \u00B7 '+esc(r.ticket.naam)+' \u00B7 '+r.ticket.personen+'p \u00B7 '+T('tk2.welkom','welkom!')+'</span>';
        $('#tkCode').value = '';
        laadProgramma();
      } catch(e){ uit.innerHTML = '<span style="color:var(--burgundy);">\u26D4 '+esc(e.message)+'</span>'; }
    });
    document.querySelectorAll('[data-traan]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/transfer', { aan: k.dataset.traan === '1' }); await refresh(); openTab('tickets'); } catch(e){ toast(e.message); }
    }));
    const trZet = document.getElementById('trPrijsZet');
    if (trZet) trZet.addEventListener('click', async () => {
      try { await API.call('/supplier/transfer', { prijs: Number($('#trPrijs').value) }); toast(T('tk2.tr.ok','De transferprijs staat vast.')); await refresh(); openTab('tickets'); } catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-tkg]').forEach(k => k.addEventListener('click', () => {
      const g = document.getElementById('tkGast-' + k.dataset.tkg);
      if (g) g.style.display = g.style.display === 'none' ? '' : 'none';
    }));
    document.querySelectorAll('[data-tkdel]').forEach(k => k.addEventListener('click', async () => {
      try { await API.call('/supplier/activiteit', { id: k.dataset.tkdel, weg: true }); await refresh(); await laadProgramma(); openTab('tickets'); } catch(e){ toast(e.message); }
    }));
    const voeg = document.getElementById('tkAdd');
    if (voeg) voeg.addEventListener('click', async () => {
      try {
        await API.call('/supplier/activiteit', { name: $('#tkName').value, desc: $('#tkDesc').value, prijs: Number($('#tkPrijs').value),
          capaciteit: Number($('#tkCap').value), duur: $('#tkDuur').value, tijden: $('#tkTijden').value });
        toast(T('tk2.f.ok','De activiteit staat in het aanbod.'));
        await refresh(); await laadProgramma(); openTab('tickets');
      } catch(e){ toast(e.message); }
    });
  }

  // ---- autoverhuur: vloot, huren, foto's, SOS ----
  let huren = null;
  function fotoKlein(file, cb){
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => {
      const c = document.createElement('canvas'); const sc = Math.min(1, 900 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.7));
    }; img.src = r.result; };
    r.readAsDataURL(file);
  }
  async function laadHuren(){
    if (!has('huur') || !API.live) return;
    try { huren = (await API.call('/supplier/huur/overzicht')).huren; } catch(e){ huren = []; }
    renderVerhuur();
  }
  const HUUR_ST = { 'aangevraagd': 'geboekt, klaar voor uitgifte', 'lopend': 'onderweg met de gast', 'afgerond': 'afgerond' };
