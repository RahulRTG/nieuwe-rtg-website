    // Talent Exchange: alleen anonieme, expliciete interesse. Naam en contact
    // blijven dicht tot de kandidaat na een wederzijdse match zelf de Deal
    // Room opent en de gewone sollicitatiestroom gebruikt.
    const talent = state.talentMatches || [];
    html += '<div class="card"><div class="tt-h">Talent Exchange <i class="talent-badge">dubbele toestemming</i></div>'+
      '<div class="talent-intro">Kandidaten verschijnen zonder naam, foto of contact. Pas wanneer u allebei interesse toont, kan de kandidaat zelf een beveiligde kennismaking openen.</div>'+
      (talent.length ? talent.map(m => '<div class="tk-row talent-row"><div class="tk-t"><b>'+esc(m.headline||('Talent voor '+m.func))+'</b><span>'+esc(m.func)+' · '+(m.experienceCount?m.experienceCount+' ervaringsonderdelen · ':'')+(m.skills||[]).map(esc).join(', ')+'</span></div>'+
        (m.status==='wederzijds'?'<i class="talent-mutual">Wederzijds · kandidaat beslist</i>':(a.manager?'<button class="obtn" data-talentyes="'+m.id+'">Ook interesse</button><button class="obtn warn" data-talentno="'+m.id+'">Niet passend</button>':''))+'</div>').join('')
        : '<div class="softline">Nog geen anonieme talentmatches voor uw vacatures.</div>')+'</div>';

    // sollicitaties: overal hetzelfde kanaal, de manager beslist
    const apps = (state.applications || []).filter(x => x.status === 'nieuw');
    const decided = (state.applications || []).filter(x => x.status !== 'nieuw').slice(0, 4);
    html += '<div class="card"><div class="tt-h">'+T('ap.h','Sollicitaties')+(apps.length?' <i class="gc-unread">'+apps.length+'</i>':'')+'</div>';
