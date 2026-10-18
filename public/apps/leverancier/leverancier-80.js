/* de AI-draad van de zaak */
    renderAIThread();
    try {
      const d = await API.call('/supplier/ai', { q });
      aiMsgs[aiMsgs.length - 1] = { role: 'ai', text: d.reply, did: d.did };
      renderAIThread();
      const v = (d.goedkeuringen || [])[0];
      if (v && confirm(T('ai.check','Controleer deze exacte actie:')+'\n\n'+(v.samenvatting || v.pad)+'\n\n'+T('ai.confirm','Wilt u dit eenmalige voorstel uitvoeren?'))) {
        const w = d.goedkeuringWereld === 'staff' ? 'staff' : 'supplier';
        const b = await API.call('/'+w+'/doe/bevestig', { goedkeuringId: v.id, akkoord: true });
        aiMsgs.push({ role: 'ai', text: b.ok ? T('ai.confirmed','U heeft het voorstel bevestigd; de actie is uitgevoerd.') : T('ai.refused','De server heeft de actie geweigerd.'), did: !!b.ok });
        renderAIThread();
        if (b.ok) await refresh();
      }
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
    html += '<div class="card"><div class="tt-h s-1jdlxp5">'+T('team.roster','Personeel')+'<span class="s-1x93582">'+
      (a.staffId ? '<button class="obtn" id="teamCallSup" style="font-size:0.66rem;">'+T('team.call','Teamcall')+'</button>' : '')+
      '<button class="obtn" id="buzzAll" style="font-size:0.66rem;">'+T('team.buzzall','Iedereen')+'</button></span></div>';
    html += staff.map(m => {
      const you = a.staffId && m.id === a.staffId;
      // iedereen bereikt iedereen: een interne (video)call of een direct bericht
      const bel = (you || !a.staffId) ? '' : '<button class="tt-buzz" data-belm="'+m.id+'" data-naam="'+escAttr(m.name)+'" title="'+T('team.belhint','Interne call (video)')+'"></button>';
      const dm = (you || !a.staffId) ? '' : '<button class="tt-buzz s-mw4zr1" data-dmm="'+m.id+'" data-naam="'+escAttr(m.name)+'" title="'+T('team.dmhint','Direct bericht')+'"><i data-dmbadge="'+m.id+'" style="display:none;position:absolute;top:-5px;right:-5px;background:#C23A5E;color:#fff;border-radius:0;font-style:normal;font-size:0.58rem;min-width:1rem;height:1rem;line-height:1rem;text-align:center;"></i></button>';
      const buzz = you ? '' : '<button class="tt-buzz" data-buzz="'+m.id+'" title="'+T('team.buzz','Oproepen (tril)')+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg></button>';
      const rm = (a.manager && !you) ? '<button class="tt-rm" data-rm="'+m.id+'">'+T('team.remove','Verwijder')+'</button>' : '';
      const tag = you ? '<span class="you">'+T('team.you','jij')+'</span>' : '';
      return '<div class="tt-person"><span class="av">'+initials(m.name)+'</span><span class="nm"><b>'+m.name+' '+tag+'</b><span>'+(m.func? m.func+' · ':'')+T('role.'+m.role, m.role==='manager'?'Manager':'Medewerker')+'</span></span>'+bel+dm+buzz+rm+'</div>';
    }).join('') || '<div class="softline">'+T('team.nostaff','Nog geen personeel toegevoegd.')+'</div>';
    if (a.manager){
      html += '<div class="tt-add h-wrap"><input id="ttName" placeholder="'+T('team.name','Naam')+'" class="s-7sjb3"><input id="ttFunc" placeholder="'+T('team.func','Functie')+'" class="s-jwsg6x"><select id="ttRole"><option value="staff">'+T('role.staff','Medewerker')+'</option><option value="manager">'+T('role.manager','Manager')+'</option></select><button id="ttAdd">'+T('team.invite','Nodig uit')+'</button></div>';
      if (lastPin) html += '<div class="tt-pinbox">'+T('team.invintro','Uitnodiging voor')+' '+escT(lastPin.name)+' · '+T('kt.invite.biz','Bedrijfsnaam')+': <b>'+escT(lastPin.bedrijf)+'</b> · '+T('kt.invite.code','Kassacode')+': <b>'+escT(lastPin.kassacode)+'</b><br>'+T('team.invnote','Eenmalige code; aanmelden met eigen RTG-account.')+'</div>';
    }
    html += '</div>';

    // vacatures: het bedrijf plaatst openstaande functies; die verschijnen ook
    // in de RTFoundation zodat leden vanaf 16 jaar met hun cv solliciteren.
    const vacs = state.vacatures || [];
    html += '<div class="card"><div class="tt-h">'+T('vac.h','Vacatures')+' <i class="s-1njtjbx">'+T('vac.rtf','ook in RTFoundation')+'</i></div>';
    html += '<div class="s-8z6rc1">'+T('vac.intro','Vacatures die je hier plaatst komen ook in de RTFoundation-app. Leden van gezinnen die het minder breed hebben solliciteren er vanaf 16 jaar in een tik op, met hun cv.')+'</div>';
    html += vacs.length ? vacs.map(v =>
      '<div class="tk-row" style="flex-wrap:wrap;'+(v.open?'':'opacity:0.55;')+'"><div class="tk-t"><b>'+esc(v.func)+' <span class="s-vf8k9o">'+T('vac.soort.'+v.soort, v.soort)+' · '+T('vac.vanaf','vanaf')+' '+v.minLeeftijd+' '+T('vac.jaar','jaar')+'</span></b><span>'+(v.plaats?esc(v.plaats)+' · ':'')+(v.uren?esc(v.uren)+' · ':'')+(v.werkvorm?esc(v.werkvorm.replace('-',' '))+' · ':'')+(v.salarisMin?'€'+esc(v.salarisMin)+(v.salarisMax?' tot €'+esc(v.salarisMax):'+')+' · ':'')+(v.open?T('vac.open','staat open'):T('vac.dicht','gesloten'))+'</span></div>'+
      (a.manager ? '<button class="obtn" data-vactoggle="'+v.id+'" data-vacnow="'+(v.open?'sluit':'open')+'">'+(v.open?T('vac.sluitbtn','Sluiten'):T('vac.openbtn','Openen'))+'</button><button class="obtn warn" data-vacdel="'+v.id+'">'+T('vac.del','Verwijderen')+'</button>' : '')+
      '</div>'
    ).join('') : '<div class="s-1oaiz9h">'+T('vac.geen','Nog geen vacatures. Plaats er een om personeel te vinden via de RTFoundation.')+'</div>';
    if (a.manager){
      html += '<div class="tt-add s-2vq720">'+
        '<input id="vacFunc" placeholder="'+T('vac.func','Functie (bijv. afwasser)')+'" class="s-7tta5">'+
        '<select id="vacSoort" class="s-1cv6gu6"><option value="bijbaan">'+T('vac.soort.bijbaan','Bijbaan')+'</option><option value="vakantiewerk">'+T('vac.soort.vakantiewerk','Vakantiewerk')+'</option><option value="parttime">'+T('vac.soort.parttime','Parttime')+'</option><option value="fulltime">'+T('vac.soort.fulltime','Fulltime')+'</option><option value="stage">'+T('vac.soort.stage','Stage')+'</option><option value="vrijwilliger">'+T('vac.soort.vrijwilliger','Vrijwilliger')+'</option></select>'+
        '<select id="vacLft" class="s-jwsg6x"><option value="16">'+T('vac.vanaf','vanaf')+' 16</option><option value="18">'+T('vac.vanaf','vanaf')+' 18</option><option value="21">'+T('vac.vanaf','vanaf')+' 21</option></select>'+
        '<input id="vacPlaats" placeholder="'+T('vac.plaats','Plaats')+'" class="s-jwsg6x">'+
        '<input id="vacUren" placeholder="'+T('vac.uren','Uren (bijv. 8-16u/week)')+'" class="s-1cv6gu6">'+
        '<select id="vacWerkvorm" class="s-1cv73tp"><option value="">Werkvorm</option><option value="op-locatie">Op locatie</option><option value="hybride">Hybride</option><option value="op-afstand">Op afstand</option><option value="flexibel">Flexibel</option></select>'+
        '<input id="vacSalMin" type="number" min="0" placeholder="Salaris vanaf" class="s-1cv6gu6">'+
        '<input id="vacSalMax" type="number" min="0" placeholder="Salaris tot" class="s-1cv6gu6">'+
        '<input id="vacSkills" placeholder="Vaardigheden, met komma’s" class="s-7wd89">'+
        '<input id="vacBenefits" placeholder="Voordelen, met komma’s" class="s-7wd89">'+
        '<input id="vacOms" placeholder="'+T('vac.oms','Korte omschrijving')+'" class="s-7v397">'+
        '<button id="vacAdd">'+T('vac.plaatsbtn','Vacature plaatsen')+'</button></div>';
    }
    html += '</div>';
