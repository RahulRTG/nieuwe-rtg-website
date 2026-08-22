/* de incidenten op het beveiligingsbord */
    if (cmd.incidenten && cmd.incidenten.length){
      h += '<div class="st-sec">'+T('bev.incs','Incidenten')+'</div><div class="card" style="margin-bottom:0.5rem;">'+
        cmd.incidenten.map(x => '<div style="border-bottom:1px solid var(--line);padding:0.4rem 0;display:flex;justify-content:space-between;gap:0.5rem;">'+
          '<span><b'+(x.ernst==='kritiek'||x.ernst==='hoog'?' style="color:var(--rood);"':'')+'>'+(x.sos?'':'')+esc(x.soort)+'</b> · '+esc(x.post)+' · '+esc(x.guardNaam||'')+'<br><span class="sub">'+esc(x.tekst)+'</span></span>'+
          '<button class="bev-inc" data-id="'+x.id+'" style="align-self:flex-start;">'+(x.status==='open'?T('bev.afh','Afhandelen'):T('bev.heropen','Heropen'))+'</button></div>').join('')+'</div>';
    }
    el.innerHTML = h;
    wireFuncBlok(el);
    // bindingen
    el.querySelectorAll('.js-bevf').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/functie', { id:x.dataset.id, aan: x.dataset.aan!=='true' }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    const bind = (id, fn) => { const e2=$('#'+id); if (e2) e2.addEventListener('click', fn); };
    const dagInp = $('#bevDag'); if (dagInp) dagInp.addEventListener('change', () => { bevDatum = dagInp.value || bevVandaag(); renderBeveiliging(); });
    bind('bevAI', async () => { try { const r = await API.call('/supplier/beveiliging/planauto', { datum: bevDatum }); toast(r.uitleg); renderBeveiliging(); } catch(e){ toast(e.message); } });
    bind('bevBudSave', async () => { try { await API.call('/supplier/beveiliging/budget', { periodeUren: $('#bevBudUren').value, tariefUur: $('#bevBudTarief').value }); renderBeveiliging(); } catch(e){ toast(e.message); } });
    bind('bevAvAdd', async () => { try { await API.call('/supplier/beveiliging/aanvraag', { klant:$('#bevAvKlant').value, object:$('#bevAvObject').value, datum:$('#bevAvDatum').value, aantal:$('#bevAvAantal').value }); renderBeveiliging(); } catch(e){ toast(e.message); } });
    bind('bevPostAdd', async () => { try { await API.call('/supplier/beveiliging/post', { naam:$('#bevPostNaam').value, klant:$('#bevPostKlant').value, minMan:$('#bevPostMin').value }); renderBeveiliging(); } catch(e){ toast(e.message); } });
    el.querySelectorAll('.bev-plan').forEach(x => x.addEventListener('click', async () => {
      const gid = prompt(T('bev.wieplan','Welke bewaker? Typ de naam precies.')); if (!gid) return;
      const staff = (state.staff||[]).find(m => m.name.toLowerCase() === gid.trim().toLowerCase());
      if (!staff) { toast(T('bev.geenbewaker','Geen bewaker met die naam.')); return; }
      try { await API.call('/supplier/beveiliging/dienst', { postId:x.dataset.post, shiftId:x.dataset.shift, datum:bevDatum, guardId:staff.id }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-schrap]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/dienst/weg', { id:x.dataset.schrap }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.bev-inc').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/incident/beslis', { id:x.dataset.id }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-postweg]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/post/weg', { id:x.dataset.postweg }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    // de aanvragenlijst los inladen (eigen endpoint met open + afgerond)
    bevLaadAanvragen();
  }
  async function bevLaadAanvragen(){
    const el = $('#bevAvLijst'); if (!el) return;
    let d; try { d = await API.call('/supplier/beveiliging/aanvragen'); } catch(e){ return; }
    if (!d.open.length && !d.afgerond.length){ el.innerHTML = '<div class="softline">'+T('bev.geenav','Nog geen inzetaanvragen.')+'</div>'; return; }
    el.innerHTML = d.open.map(a => '<div style="border-bottom:1px solid var(--line);padding:0.4rem 0;display:flex;justify-content:space-between;gap:0.5rem;">'+
      '<span><b>'+esc(a.klant)+'</b> · '+esc(a.object)+' · '+esc(a.datum)+' · '+a.aantal+'× '+esc(a.shiftId)+'</span>'+
      '<span style="display:flex;gap:0.3rem;"><button class="abtn" data-avplan="'+a.ref+'">'+T('bev.avplan','Inplannen')+'</button>'+
      '<button class="abtn ghost" data-avweg="'+a.ref+'">'+T('bev.avweg','Afwijzen')+'</button></span></div>').join('')+
      (d.afgerond.length? '<div class="sub h-mt40">'+d.afgerond.slice(0,5).map(a=>esc(a.object)+' ('+esc(a.status)+')').join(' · ')+'</div>':'');
    el.querySelectorAll('[data-avplan]').forEach(x => x.addEventListener('click', async () => {
      try { const r = await API.call('/supplier/beveiliging/aanvraag/beslis', { ref:x.dataset.avplan, actie:'plan' }); toast(T('bev.ingepland','Ingepland en op het rooster gezet.')); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-avweg]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/aanvraag/beslis', { ref:x.dataset.avweg, actie:'afwijzen' }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
  }

  // alle overige functies als nette knoppen in het Meer-scherm
  function renderMeer(){
    const el = $('#meerWrap'); if (!el) return;
    // het afdelingenbord (dorp) is er voor kamers (hotel), de nachtzaak, restaurants en beachclubs
    const dorpKan = has('bookings') || ['bar', 'club', 'beachclub', 'restaurant'].includes(S && S.type);
    const keys = Object.keys(TABDEF).filter(k => !MAIN_TABS.includes(k) && (!TABDEF[k].cap || has(TABDEF[k].cap)) && (k !== 'bezorg' || !!(state && state.bezorg)) && (k !== 'dorp' || dorpKan));
    // vervoerszaken krijgen de Ghost Driver erbij: de vooruitkijkende
    // verkeersleider (eigen app-pagina, zelfde zaak-inlog)
    const ghost = has('rides')
      ? '<button class="meer-btn" data-ghost="1"><svg viewBox="0 0 24 24"><path d="M12 3a7 7 0 0 1 7 7v9l-2.3-2-2.4 2-2.3-2-2.3 2-2.4-2L5 19v-9a7 7 0 0 1 7-7z"/><circle cx="9.5" cy="11" r="1"/><circle cx="14.5" cy="11" r="1"/></svg><b>Ghost Driver</b></button>'
      : '';
    // een tweede scherm aansluiten: een extra beeldscherm dat schermvullend een
    // werkplek toont (keuken, bar, uit te serveren, kassa, gasten) of het
    // hoofdscherm spiegelt. Werkt op elke zaak; opent een eigen venster.
    const scherm = '<button class="meer-btn" data-scherm="1"><svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 20h8M12 17v3"/></svg><b>'+T('tab.scherm','Tweede scherm')+'</b></button>';
    // RTG Office hoort bij elke zaak: de team-drive met documenten,
    // rekenbladen en presentaties (zelfde zaak-inlog, eigen pagina)
    const office = '<button class="meer-btn" data-office="1"><svg viewBox="0 0 24 24"><path d="M6 2h9l3 3v17H6z"/><path d="M9 9h6M9 13h6M9 17h4"/></svg><b>RTG Office</b></button>';
    // RTMAIL voor de zaak: het postvak op de zaakcode, waar de draaiboeken hun
    // seintjes bezorgen (eigen pagina, zelfde zaak-inlog).
    const rtmail = '<button class="meer-btn" data-rtmail="1"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg><b>RTMAIL</b></button>';
    /* RTG Handel: inkoop bij andere zaken, over alle genres heen (eigen pagina,
       zelfde zaak-inlog). Zie server/kern/handelsketen.js. */
    const handel = '<button class="meer-btn" data-handel="1"><svg viewBox="0 0 24 24"><path d="M3 7h13l2 4h3v6H3z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg><b>RTG Handel</b></button>';
    /* Mijn RTG-website: de automatische bedrijfssite op naam.rtg (eigen
       pagina, zelfde zaak-inlog). Zie server/kern/webplatform.js. */
    const festival = '<button class="meer-btn" data-festival="1"><svg viewBox="0 0 24 24"><path d="M3 20h18M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6"/></svg><b>' + T('tab.festival','Festival') + '</b></button>';
    const web = '<button class="meer-btn" data-zaakweb="1"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg><b>'+T('tab.zaakweb','Mijn website')+'</b></button>';
    el.innerHTML = '<div class="meer-grid">' + keys.map(k =>
      '<button class="meer-btn" data-goto2="'+k+'"><svg viewBox="0 0 24 24">'+TABDEF[k].svg+'</svg><b>'+T('tab.'+k, TABDEF[k].label)+'</b></button>'
    ).join('') + web + office + rtmail + handel + ghost + festival + scherm + '</div>';
    el.querySelectorAll('[data-goto2]').forEach(b => b.addEventListener('click', () => openTab(b.dataset.goto2)));
    el.querySelectorAll('[data-festival]').forEach(b => b.addEventListener('click', () => { location.href = '/apps/festival.html'; }));
    el.querySelectorAll('[data-zaakweb]').forEach(b => b.addEventListener('click', () => { location.href = '/apps/zaakweb.html'; }));
    el.querySelectorAll('[data-office]').forEach(b => b.addEventListener('click', () => { location.href = '/apps/office.html?werk=zaak'; }));
    el.querySelectorAll('[data-rtmail]').forEach(b => b.addEventListener('click', () => { location.href = '/apps/leverancier-rtmail.html'; }));
    el.querySelectorAll('[data-handel]').forEach(b => b.addEventListener('click', () => { location.href = '/apps/handel.html'; }));
    el.querySelectorAll('[data-ghost]').forEach(b => b.addEventListener('click', () => { location.href = '/apps/ghost.html'; }));
    el.querySelectorAll('[data-scherm]').forEach(b => b.addEventListener('click', () => {
      window.open('/apps/scherm.html', 'rtg-scherm', 'width=1280,height=800');
      toast(T('scherm.geopend','Tweede scherm geopend. Sleep het venster naar uw extra beeldscherm en kies daar een werkplek of "Spiegel".'));
    }));
  }

  function renderAll(){
    $('#supIcon').textContent = S.icon;
    $('#supName').textContent = S.name;
    $('#supType').textContent = tType(S.typeLabel) + ' · ' + S.city;
    renderActor();
    if (stationMode){ renderStation(); return; }
