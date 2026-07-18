    if (kantoorSec === 'hr'){
      // het AI-weekrooster: voorstel op de verwachte drukte, de gemachtigde stelt vast
      if (!agentData) laadAgent();
      const rp = agentData && agentData.rooster;
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>🗓 '+T('ag2.rooster','AI-weekrooster')+'</h3>'+
        '<div class="tkc-who">'+T('ag2.rooster.deck','De AI plant de week op de verwachte drukte per dag: drukke dagen iedereen op de vloer, rustige dagen om de beurt vrij.')+'</div>'+
        (rp ? rp.days.map(d=>'<div class="st-row"><span><b>'+d.label+'</b> <span class="sub">'+d.date+'</span></span>'+
            '<span class="sub" style="text-align:right;">'+d.staff.map(m=>m.name.split(' ')[0]+': '+m.shift.split(' ')[0]).join(' · ')+'</span></div>').join('')+
          (rp.status==='voorstel'
            ? '<div class="tkc-act"><button class="tkc-ready" id="agRoosterOk">✔ '+T('ag2.rooster.ok','Stel vast')+'</button><button class="obtn warn" id="agRoosterNee" style="margin-left:0.5rem;">'+T('ag2.nee','Wijs af')+'</button></div>'
            : '<div class="tkc-who">✔ '+T('ag2.rooster.vast','Vastgesteld; het rooster in de PDA volgt dit plan.')+'</div>')
        : '<div class="tkc-act"><button class="tkc-start" id="agRooster">✨ '+T('ag2.rooster.stel','Stel het weekrooster voor')+'</button></div>')+'</div>';
      // urenregistratie: wie is binnen, wie werkte wanneer en hoelang
      if (!klokOverzicht) laadKlok();
      const tijd = iso => new Date(iso).toLocaleString(lang()==='en'?'en-GB':'nl-NL', { weekday:'short', hour:'2-digit', minute:'2-digit' });
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>⏱ '+T('kt.uren','Urenregistratie')+'</h3>'+
        '<div class="tkc-who">'+T('kt.uren.deck','Iedereen klokt via de PDA; hier staat precies wie wanneer en hoelang werkt.')+'</div>'+
        (klokOverzicht && klokOverzicht.length ? klokOverzicht.map(r =>
          '<div class="st-row"><span>'+(r.binnen?'🟢 ':'⚪ ')+r.name+'<span class="sub">'+(r.func||(r.role==='manager'?'Manager':''))+
            (r.laatsteIn?' · '+T('kt.uren.in','in ')+tijd(r.laatsteIn)+(r.laatsteUit?' · '+T('kt.uren.uit','uit ')+tijd(r.laatsteUit):' · '+T('kt.uren.nu','nu binnen')):' · '+T('kt.uren.nooit','nog niet geklokt'))+'</span></span>'+
          '<span class="sub" style="text-align:right;font-variant-numeric:tabular-nums;">'+T('kt.uren.vandaag','vandaag ')+r.vandaagUren+'u<br>'+T('kt.uren.week','week ')+r.weekUren+'u</span></div>').join('')
        : '<div class="tkc-who">…</div>')+'</div>';
      const apps = (state.applications||[]).filter(x=>x.status==='nieuw');
      html += '<div class="tkc"><h3>'+T('kt.sollicitaties','Sollicitaties')+(apps.length?' ('+apps.length+')':'')+'</h3>'+
        (apps.length ? apps.map(x=>'<div class="st-row"><span>'+x.name+' \u00b7 '+x.func+(x.viaRTG?' \u00b7 RTG':'')+'<span class="sub">'+x.contact+'</span></span>'+
          '<span class="acts"><button class="obtn primary" data-khire="'+x.id+'">'+T('ap.hire','Aannemen')+'</button><button class="obtn warn" data-kno="'+x.id+'">'+T('ap.reject','Afwijzen')+'</button></span></div>').join('')
        : '<div class="tkc-who">'+T('kt.noapps','Geen open sollicitaties.')+'</div>')+'</div>';
      html += '<div class="tkc"><h3>'+T('kt.team','Team & uitnodigingen')+'</h3>'+
        (state.staff||[]).map(m=>'<div class="st-row" style="flex-wrap:wrap;"><span>'+m.name+'<span class="sub">'+(m.func||'')+' \u00b7 '+(m.role==='manager'?'Manager':T('kt.staff','Medewerker'))+(m.lid?' \u00b7 '+T('kt.lid','RTG-lid'):'')+'</span></span>'+
          '<span class="acts">'+(m.id!==actor().staffId
            ? '<button class="obtn" data-kreset="'+m.id+'">'+T('kt.reset','Reset code')+'</button><button class="obtn warn" data-kdel="'+m.id+'">'+T('kt.ontslag','Ontslag')+'</button>'
            : '')+'</span></div>').join('')+
        '<div class="tkc-who" style="margin-top:0.55rem;line-height:1.5;">'+T('kt.invite.intro','Nodig uit; de medewerker meldt zich zelf aan met bedrijfsnaam + kassacode en een eigen RTG-account.')+'</div>'+
        '<div class="st-form"><input class="st-in" id="ktName" placeholder="'+T('kt.name.opt','Naam (optioneel)')+'"><input class="st-in" id="ktFunc" placeholder="'+T('kt.func','Functie (bijv. Bediening)')+'">'+
        '<select class="st-in" id="ktRole"><option value="staff">'+T('kt.staff','Medewerker')+'</option><option value="manager">Manager</option></select>'+
        '<button class="bigbtn" id="ktInvite" style="margin-top:0.2rem;">'+T('kt.invite','Nodig uit, kassacode verschijnt')+'</button></div></div>';
      // open kassacodes: teruglezen en intrekken
      if (!invData) laadInvites();
      const openInv = (invData && invData.invites) || [];
      html += '<div class="tkc"><h3>\ud83c\udf9f '+T('kt.openinv','Open kassacodes')+(openInv.length?' ('+openInv.length+')':'')+'</h3>'+
        (invData
          ? (openInv.length ? openInv.map(i =>
              '<div class="st-row"><span><span style="font-family:monospace;letter-spacing:0.14em;color:var(--gold);">'+escT(i.kassacode)+'</span>'+
              '<span class="sub">'+(i.naam?escT(i.naam)+' \u00b7 ':'')+(i.func?escT(i.func)+' \u00b7 ':'')+(i.role==='manager'?'Manager \u00b7 ':'')+T('kt.geldigtot','geldig t/m')+' '+new Date(i.expires).toLocaleDateString()+'</span></span>'+
              '<span class="acts"><button class="obtn warn" data-kinv="'+escT(i.kassacode)+'">'+T('kt.intrek','Trek in')+'</button></span></div>').join('')
            : '<div class="tkc-who">'+T('kt.geeninv','Geen open uitnodigingen.')+'</div>')
          : '<div class="tkc-who">'+T('kt.laden','Laden...')+'</div>')+'</div>';
      html += '<div class="tkc"><h3>'+T('kt.oproep','Hele team oproepen')+'</h3><div class="tkc-who">'+T('kt.oproep.s','Laat alle telefoons trillen, bijvoorbeeld bij een briefing.')+'</div>'+
        '<button class="obtn" id="ktBuzz" style="margin-top:0.4rem;">\uD83D\uDCE2 '+T('kt.buzzall','Buzz iedereen')+'</button></div>';
      // personeelszaken: verlofaanvragen beslissen en zien wie er nu is ingeklokt
      const verlofOpen = (state.verlof || []).filter(v => v.status === 'nieuw');
      const verlofRest = (state.verlof || []).filter(v => v.status !== 'nieuw').slice(0, 8);
      html += '<div class="tkc"><h3>\uD83C\uDF34 '+T('kt.verlof','Verlof & ziek')+(verlofOpen.length ? ' ('+verlofOpen.length+')' : '')+'</h3>'+
        (verlofOpen.length ? verlofOpen.map(v =>
          '<div class="st-row" style="flex-wrap:wrap;"><span>'+v.name+'<span class="sub">'+v.van+' t/m '+(v.tot||'')+(v.reden?' \u00B7 '+v.reden:'')+'</span></span>'+
          '<span class="acts"><button class="obtn primary" data-kvja="'+v.id+'">'+T('kt.vja','Goedkeuren')+'</button><button class="obtn warn" data-kvnee="'+v.id+'">'+T('kt.vnee','Afwijzen')+'</button></span></div>').join('')
          : '<div class="tkc-who">'+T('kt.geenverlof','Geen open aanvragen. Personeel vraagt verlof aan via de PDA; ziekmeldingen komen hier ook binnen.')+'</div>')+
        (verlofRest.length ? verlofRest.map(v =>
          '<div class="st-row"><span>'+v.name+'<span class="sub">'+(v.soort==='ziek'?T('kt.ziek','ziek gemeld')+' '+v.van:v.van+' t/m '+(v.tot||''))+'</span></span>'+
          '<span class="sub" style="text-transform:uppercase;font-size:0.6rem;letter-spacing:0.06em;">'+(v.status==='goedgekeurd'?'\u2705 '+T('kt.vok','goedgekeurd'):v.status==='afgewezen'?'\u2715 '+T('kt.vno','afgewezen'):'\uD83E\uDD12 '+T('kt.vzm','gemeld'))+'</span></div>').join('') : '')+'</div>';
      const klok2 = state.klok || { vandaag: [], binnen: [] };
      html += '<div class="tkc"><h3>\u23F1 '+T('kt.klok','Nu ingeklokt')+' ('+klok2.binnen.length+')</h3>'+
        (klok2.binnen.length ? klok2.binnen.map(n => '<div class="st-row"><span>\uD83D\uDFE2 '+n+'</span></div>').join('')
          : '<div class="tkc-who">'+T('kt.niemandin','Niemand is nu ingeklokt.')+'</div>')+
        (klok2.vandaag.length ? '<div class="tkc-who" style="margin-top:0.4rem;">'+T('kt.klokv','Vandaag geklokt')+': '+klok2.vandaag.length+' '+T('kt.klokr','registratie(s)')+' \u00B7 '+[...new Set(klok2.vandaag.map(e=>e.name))].length+' '+T('kt.klokp','personen')+'</div>' : '')+'</div>';
    }
