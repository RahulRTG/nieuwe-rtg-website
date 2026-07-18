    let el = document.getElementById('alarmOverlay');
    if (!el){
      el = document.createElement('div');
      el.id = 'alarmOverlay';
      document.getElementById('shell').appendChild(el);
      el.addEventListener('click', () => el.classList.remove('on'));
    }
    const locTxt = d.loc ? (d.label ? d.label + ' · ' : '') + d.loc.lat.toFixed(4) + ', ' + d.loc.lng.toFixed(4) : T('alarm.noloc','locatie onbekend');
    el.innerHTML = '<div class="bz"><div class="bz-ic">🚨</div><b>'+esc(d.from)+'</b><span>'+(d.note?esc(d.note):T('alarm.needs','heeft direct assistentie nodig'))+'</span>'+
      '<span style="margin-top:0.6rem;font-size:0.8rem;">📍 '+esc(locTxt)+'</span><i>'+T('buzz.close','Tik om te bevestigen')+'</i></div>';
    el.classList.add('on');
  }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escAttr(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  async function addStaff(){
    const name = ($('#ttName').value||'').trim();
    const func = ($('#ttFunc') && $('#ttFunc').value || '').trim();
    const role = $('#ttRole').value;
    try {
      const d = await API.call('/supplier/staff/invite', { name, func, role });
      lastPin = { name: d.invite.naam || name || T('kt.staff','Medewerker'), kassacode: d.invite.kassacode, bedrijf: d.bedrijf };
      toast(T('team.invited','Uitnodiging gemaakt. Kassacode: ')+d.invite.kassacode);
      await refresh(); openTab('team');
    } catch(e){ toast(e.message); }
  }
  async function removeStaff(id){
    try { await API.call('/supplier/staff/remove', { staffId: id }); toast(T('team.removed','Verwijderd uit het team.')); await refresh(); openTab('team'); }
    catch(e){ toast(e.message); }
  }
  async function sendTeam(){
    const el = $('#ttMsg'); const text = (el.value||'').trim();
    if (!text) return;
    el.value = '';
    try { await API.call('/supplier/team/message', { text }); await refresh(); openTab('team'); }
    catch(e){ toast(e.message); }
  }

  /* ---- Borden: het gedeelde werkbord van de zaak (shared/borden.js) ----
     Dezelfde module draait ook in de PDA en de Business Pass, zodat het bord
     overal identiek werkt. */
  let bordenUI = null;
  function renderBorden(){
    const wrap = $('#bordenWrap');
    if (!wrap || !window.BordenUI) return;
    if (bordenUI) { bordenUI.refresh(); return; }
    bordenUI = BordenUI.mount(wrap, {
      laad: () => API.call('/supplier/borden'),
      doe: b => API.call('/supplier/bord', b),
      teamleden: () => (state && state.staff || []).map(m => ({ id: m.id, name: m.name })),
      kanBeheren: () => { const a = actor(); return !!(a.manager || a.role === 'manager' || !a.staffId); },
      T, toast
    });
  }

  /* ---- Reviews & reputatie: reageren op elke gastreview, met AI-concept ---- */
  function renderReviews(){
    const el = $('#reviewsWrap'); if (!el) return;
    const rating = state && state.reviews && state.reviews.rating;
    const revs = (state && state.reviews && state.reviews.recent) || [];
    let h = '<div class="card"><div class="tt-h">⭐ '+T('rev2.score','Uw reputatie')+'</div>'+
      '<div style="margin-top:0.4rem;font-size:1.4rem;font-family:\'Bodoni Moda\',serif;">'+
      (rating ? rating.score+' <span style="font-size:0.8rem;color:var(--soft);">/ 5 · '+rating.aantal+' '+T('rev2.stuks','review(s)')+'</span>' : T('rev2.geen','Nog geen reviews'))+'</div>'+
      '<div class="softline" style="margin-top:0.3rem;">'+T('rev2.deck','Een snel, persoonlijk antwoord weegt zwaar: gasten lezen mee, en de schrijver krijgt uw reactie direct als melding.')+'</div></div>';
    h += revs.length ? revs.map(r =>
      '<div class="card">'+
      '<div class="tt-top" style="display:flex;justify-content:space-between;gap:0.5rem;"><b>'+'⭐'.repeat(r.score)+'<span style="opacity:0.25;">'+'⭐'.repeat(5-r.score)+'</span> · '+esc(r.codename||'gast')+'</b><time style="color:var(--soft);font-size:0.7rem;">'+timeAgo(r.at)+'</time></div>'+
      (r.tekst ? '<div style="margin-top:0.35rem;font-size:0.86rem;">'+esc(r.tekst)+'</div>' : '')+
      (r.reactie
        ? '<div style="margin-top:0.5rem;border-left:3px solid var(--gold);padding:0.4rem 0.7rem;font-size:0.82rem;"><b style="color:var(--gold);">'+T('rev2.uw','Uw reactie')+'</b> · '+timeAgo(r.reactie.at)+'<br>'+esc(r.reactie.tekst)+'</div>'
        : '<div class="tt-compose" style="margin-top:0.5rem;"><input id="rv-'+r.id+'" placeholder="'+T('rev2.ph','Schrijf een persoonlijke reactie...')+'">'+
          '<button class="obtn ghost" data-rvai="'+r.id+'">✨</button><button data-rvsend="'+r.id+'">'+T('team.send','Stuur')+'</button></div>')+
      '</div>').join('')
      : '<div class="card softline">'+T('rev2.leeg','Nog geen reviews. Na elke afgeronde dienst kan de gast er een achterlaten.')+'</div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-rvai]').forEach(b => b.addEventListener('click', async () => {
      b.textContent = '…';
      try { const d = await API.call('/supplier/review/concept', { id: b.dataset.rvai }); const inp = $('#rv-'+b.dataset.rvai); if (inp) inp.value = d.concept; }
      catch(e){ toast(e.message); }
      b.textContent = '✨';
    }));
    el.querySelectorAll('[data-rvsend]').forEach(b => b.addEventListener('click', async () => {
      const inp = $('#rv-'+b.dataset.rvsend);
      if (!inp || !inp.value.trim()) return;
      try { await API.call('/supplier/review/reageer', { id: b.dataset.rvsend, tekst: inp.value.trim() }); toast('💬 '+T('rev2.ok','Reactie geplaatst; de gast krijgt een melding.')); await refresh(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---- Voorraad: de lichte inventaris, iedereen telt mee ---- */
  // het keukenbrein: voorraad met waarde, recepten met marge, telling,
  // verspilling, levering en het inkoopadvies (server: kern/keuken.js)
  async function renderVoorraad(){
    const el = $('#voorraadWrap'); if (!el) return;
    let d; try { d = await API.call('/supplier/keuken'); } catch(e){ return; }
    let ma = null; try { ma = await API.call('/supplier/keuken/menu-analyse'); } catch(e){}
    const vs = d.artikelen || [];
    const mgr = (() => { const a = actor(); return !!(a.manager || a.role === 'manager' || !a.staffId); })();
    const geld = x => '€ ' + (Number(x)||0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let h = '<div class="card"><div class="st-row"><span>'+T('vr.waarde','Voorraadwaarde')+'</span><b>'+geld(d.totaalWaarde)+'</b></div>'+
      '<div class="st-row"><span>'+T('vr.onder','Onder minimum')+'</span><b'+(d.onderMinimum?' style="color:#FF8589;"':'')+'>'+d.onderMinimum+'</b></div></div>';
    // het inkoopadvies: aanvullen tot twee keer het minimum
    if ((d.advies||[]).length) h += '<div class="card" style="border-left:4px solid var(--gold,#A98F1C);"><div class="tt-h">🛒 '+T('vr.advies','Inkoopadvies')+'</div>'+
      d.advies.map(a => '<div class="st-row"><span>'+esc(a.naam)+' <span class="sub">'+a.aantal+' '+esc(a.eenheid)+', min '+a.min+'</span></span><b>+ '+a.advies+' '+esc(a.eenheid)+(a.kosten?' <span class="sub">'+geld(a.kosten)+'</span>':'')+'</b></div>').join('')+
      (mgr?'<button class="bigbtn" id="vrBestel" style="margin-top:0.5rem;">🛒 '+T('vr.bestel','Bestel dit advies bij de groothandel')+'</button>':'')+
      '<div class="softline" style="margin-top:0.3rem;">'+T('vr.advies.s','Geleverd = automatisch bijgeboekt, met de inkoopprijs als nieuwe kostprijs.')+'</div></div>';
    // de artikelen zelf, met kostprijs en de vloerhandelingen
    h += '<div class="card">'+(vs.length ? vs.map(v =>
      '<div class="st-row" style="align-items:center;"><span'+(v.min>0&&v.aantal<=v.min?' style="color:#FF8589;"':'')+'>'+esc(v.naam)+
        '<span class="sub">min '+v.min+(v.kostprijs?' · '+geld(v.kostprijs)+'/'+esc(v.eenheid):'')+(v.waarde?' · '+T('vr.wrd','waarde')+' '+geld(v.waarde):'')+'</span></span>'+
      '<span style="display:flex;gap:0.35rem;align-items:center;flex-shrink:0;">'+
        '<b style="min-width:3.6rem;text-align:center;">'+v.aantal+' '+esc(v.eenheid)+'</b>'+
        '<button class="obtn ghost" data-vtel="'+v.id+'" title="'+T('vr.tel','Telling')+'">🧮</button>'+
        '<button class="obtn ghost" data-vderf="'+v.id+'" title="'+T('vr.derf','Verspilling')+'">♻</button>'+
        (mgr?'<button class="obtn ghost" data-vlev="'+v.id+'" title="'+T('vr.lev','Levering')+'">🚚</button><button class="obtn warn" data-vweg="'+v.id+'">🗑</button>':'')+'</span></div>').join('')
      : '<div class="softline">'+T('vr.leeg','Nog geen voorraaditems. Het management zet hieronder de lijst op.')+'</div>')+'</div>';
    // recepten en marge per gerecht: dit maakt de afboeking automatisch
    const rec = (d.recepten||[]);
