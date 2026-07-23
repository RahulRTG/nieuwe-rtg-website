  // ---- AI-assistent ----
  let aiMsgs = [];
  function renderAIChips(){
    const el = $('#aiChips'); if (!el) return;
    let chips = [T('ai.c1','Dagomzet'), T('ai.c2','Onbeantwoorde berichten')];
    if (has('bookings')) chips.push(T('ai.c3','Welke kamers zijn vuil?'), T('ai.c4','Welke minibars nog tellen?'));
    if (has('orders')) chips.push(T('ai.c5','Open bestellingen'));
    if (has('doors')) chips.push(T('ai.c6','Open de voordeur'));
    chips.push(T('ai.c7','Wie is er onderweg?'), T('ai.c8','Welke klussen staan open?'));
    el.innerHTML = chips.map(c => '<button class="ai-chip">'+c+'</button>').join('');
    el.querySelectorAll('.ai-chip').forEach(b => b.addEventListener('click', () => { $('#aiInput').value = b.textContent; sendAI(); }));
  }
  function renderAIThread(){
    const t = $('#aiThread'); if (!t) return;
    t.innerHTML = aiMsgs.length ? aiMsgs.map(m =>
      '<div class="tt-msg ' + (m.role === 'user' ? 'me' : 'other') + '">' +
      (m.role === 'ai' ? '<span class="who">✦ AI</span>' : '') +
      m.text.replace(/&/g,'&amp;').replace(/</g,'&lt;') +
      (m.did ? '<span class="ai-did">✓ ' + T('ai.did','uitgevoerd') + '</span>' : '') + '</div>'
    ).join('') : '<div class="pcempty" style="padding:1.4rem 0.5rem;text-align:center;color:var(--soft);font-size:0.82rem;line-height:1.6;">' + T('ai.empty','Uw assistent kent het hele bedrijf: de kassa, de kamers, de klussen, de gasten. Vraag iets of geef een opdracht.') + '</div>';
    t.scrollTop = t.scrollHeight;
  }
  async function sendAI(){
    const inp = $('#aiInput');
    const q = (inp.value || '').trim();
    if (!q) return;
    inp.value = '';
    aiMsgs.push({ role: 'user', text: q });
    aiMsgs.push({ role: 'ai', text: '…' });
    renderAIThread();
    try {
      const d = await API.call('/supplier/ai', { q });
      aiMsgs[aiMsgs.length - 1] = { role: 'ai', text: d.reply, did: d.did };
      renderAIThread();
      if (d.did) await refresh();
      openTab('ai');
    } catch(e){
      aiMsgs[aiMsgs.length - 1] = { role: 'ai', text: e.message };
      renderAIThread();
    }
  }

  // ---- team ----
  let lastPin = null; // laatst gemaakte uitnodiging (kassacode), eenmalig getoond aan de manager
  function renderTeam(){
    const a = actor();
    const staff = state.staff || [];
    const activity = state.activity || [];
    const team = state.team || [];
    let html = '';

    // personeel
    html += '<div class="card"><div class="tt-h" style="display:flex;justify-content:space-between;align-items:center;">'+T('team.roster','Personeel')+'<span style="display:flex;gap:0.4rem;">'+
      (a.staffId ? '<button class="obtn" id="teamCallSup" style="font-size:0.66rem;">'+T('team.call','Teamcall')+'</button>' : '')+
      '<button class="obtn" id="buzzAll" style="font-size:0.66rem;">'+T('team.buzzall','Iedereen')+'</button></span></div>';
    html += staff.map(m => {
      const you = a.staffId && m.id === a.staffId;
      // iedereen bereikt iedereen: een interne (video)call of een direct bericht
      const bel = (you || !a.staffId) ? '' : '<button class="tt-buzz" data-belm="'+m.id+'" data-naam="'+escAttr(m.name)+'" title="'+T('team.belhint','Interne call (video)')+'"></button>';
      const dm = (you || !a.staffId) ? '' : '<button class="tt-buzz" data-dmm="'+m.id+'" data-naam="'+escAttr(m.name)+'" title="'+T('team.dmhint','Direct bericht')+'" style="position:relative;"><i data-dmbadge="'+m.id+'" style="display:none;position:absolute;top:-5px;right:-5px;background:#C23A5E;color:#fff;border-radius:999px;font-style:normal;font-size:0.58rem;min-width:1rem;height:1rem;line-height:1rem;text-align:center;"></i></button>';
      const buzz = you ? '' : '<button class="tt-buzz" data-buzz="'+m.id+'" title="'+T('team.buzz','Oproepen (tril)')+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg></button>';
      const rm = (a.manager && !you) ? '<button class="tt-rm" data-rm="'+m.id+'">'+T('team.remove','Verwijder')+'</button>' : '';
      const tag = you ? '<span class="you">'+T('team.you','jij')+'</span>' : '';
      return '<div class="tt-person"><span class="av">'+initials(m.name)+'</span><span class="nm"><b>'+m.name+' '+tag+'</b><span>'+(m.func? m.func+' · ':'')+T('role.'+m.role, m.role==='manager'?'Manager':'Medewerker')+'</span></span>'+bel+dm+buzz+rm+'</div>';
    }).join('') || '<div class="softline">'+T('team.nostaff','Nog geen personeel toegevoegd.')+'</div>';
    if (a.manager){
      html += '<div class="tt-add" style="flex-wrap:wrap;"><input id="ttName" placeholder="'+T('team.name','Naam')+'" style="flex:2;min-width:110px;"><input id="ttFunc" placeholder="'+T('team.func','Functie')+'" style="flex:1;min-width:90px;"><select id="ttRole"><option value="staff">'+T('role.staff','Medewerker')+'</option><option value="manager">'+T('role.manager','Manager')+'</option></select><button id="ttAdd">'+T('team.invite','Nodig uit')+'</button></div>';
      if (lastPin) html += '<div class="tt-pinbox">'+T('team.invintro','Uitnodiging voor')+' '+escT(lastPin.name)+' · '+T('kt.invite.biz','Bedrijfsnaam')+': <b>'+escT(lastPin.bedrijf)+'</b> · '+T('kt.invite.code','Kassacode')+': <b>'+escT(lastPin.kassacode)+'</b><br>'+T('team.invnote','Eenmalige code; aanmelden met eigen RTG-account.')+'</div>';
    }
    html += '</div>';

    // vacatures: het bedrijf plaatst openstaande functies; die verschijnen ook
    // in de RTFoundation zodat leden vanaf 16 jaar met hun cv solliciteren.
    const vacs = state.vacatures || [];
    html += '<div class="card"><div class="tt-h">'+T('vac.h','Vacatures')+' <i style="font-style:normal;font-size:0.58rem;letter-spacing:0.08em;color:#7ecb8f;border:1px solid #7ecb8f;border-radius:999px;padding:0.1rem 0.45rem;vertical-align:middle;">'+T('vac.rtf','ook in RTFoundation')+'</i></div>';
    html += '<div style="font-size:0.78rem;color:var(--soft);margin-bottom:0.6rem;">'+T('vac.intro','Vacatures die je hier plaatst komen ook in de RTFoundation-app. Leden van gezinnen die het minder breed hebben solliciteren er vanaf 16 jaar in een tik op, met hun cv.')+'</div>';
    html += vacs.length ? vacs.map(v =>
      '<div class="tk-row" style="flex-wrap:wrap;'+(v.open?'':'opacity:0.55;')+'"><div class="tk-t"><b>'+esc(v.func)+' <span style="font-weight:400;color:var(--soft);">'+T('vac.soort.'+v.soort, v.soort)+' · '+T('vac.vanaf','vanaf')+' '+v.minLeeftijd+' '+T('vac.jaar','jaar')+'</span></b><span>'+(v.plaats?esc(v.plaats)+' · ':'')+(v.uren?esc(v.uren)+' · ':'')+(v.open?T('vac.open','staat open'):T('vac.dicht','gesloten'))+'</span></div>'+
      (a.manager ? '<button class="obtn" data-vactoggle="'+v.id+'" data-vacnow="'+(v.open?'sluit':'open')+'">'+(v.open?T('vac.sluitbtn','Sluiten'):T('vac.openbtn','Openen'))+'</button><button class="obtn warn" data-vacdel="'+v.id+'">'+T('vac.del','Verwijderen')+'</button>' : '')+
      '</div>'
    ).join('') : '<div style="font-size:0.82rem;color:var(--soft);padding:0.4rem 0;">'+T('vac.geen','Nog geen vacatures. Plaats er een om personeel te vinden via de RTFoundation.')+'</div>';
    if (a.manager){
      html += '<div class="tt-add" style="flex-wrap:wrap;gap:0.4rem;margin-top:0.7rem;">'+
        '<input id="vacFunc" placeholder="'+T('vac.func','Functie (bijv. afwasser)')+'" style="flex:2;min-width:130px;">'+
        '<select id="vacSoort" style="flex:1;min-width:110px;"><option value="bijbaan">'+T('vac.soort.bijbaan','Bijbaan')+'</option><option value="vakantiewerk">'+T('vac.soort.vakantiewerk','Vakantiewerk')+'</option><option value="parttime">'+T('vac.soort.parttime','Parttime')+'</option><option value="fulltime">'+T('vac.soort.fulltime','Fulltime')+'</option><option value="stage">'+T('vac.soort.stage','Stage')+'</option><option value="vrijwilliger">'+T('vac.soort.vrijwilliger','Vrijwilliger')+'</option></select>'+
        '<select id="vacLft" style="flex:1;min-width:90px;"><option value="16">'+T('vac.vanaf','vanaf')+' 16</option><option value="18">'+T('vac.vanaf','vanaf')+' 18</option><option value="21">'+T('vac.vanaf','vanaf')+' 21</option></select>'+
        '<input id="vacPlaats" placeholder="'+T('vac.plaats','Plaats')+'" style="flex:1;min-width:90px;">'+
        '<input id="vacUren" placeholder="'+T('vac.uren','Uren (bijv. 8-16u/week)')+'" style="flex:1;min-width:110px;">'+
        '<input id="vacOms" placeholder="'+T('vac.oms','Korte omschrijving')+'" style="flex:2;min-width:150px;">'+
        '<button id="vacAdd">'+T('vac.plaatsbtn','Vacature plaatsen')+'</button></div>';
    }
    html += '</div>';

    // sollicitaties: overal hetzelfde kanaal, de manager beslist
    const apps = (state.applications || []).filter(x => x.status === 'nieuw');
    const decided = (state.applications || []).filter(x => x.status !== 'nieuw').slice(0, 4);
    html += '<div class="card"><div class="tt-h">'+T('ap.h','Sollicitaties')+(apps.length?' <i class="gc-unread">'+apps.length+'</i>':'')+'</div>';
