  async function laadGezinInfo(){
    const box = $('#gezinInfo'); if(!box) return;
    let d; try{ d = await API.call('/rtf/overzicht'); }catch(e){ box.innerHTML=''; return; }
    box.innerHTML = (d.gezinnen||[]).map(gz=>{
      const o = gz.oppasinfo||{};
      const meerdan1 = (d.gezinnen||[]).length>1;
      let h = '';
      if (meerdan1) h += '<div class="label" style="margin:.4rem 0 .2rem;color:var(--burgundy);">'+esc(gz.gezinNaam)+'</div>';
      // Belangrijke info
      h += '<div class="card"><div class="label">📋 Belangrijke info</div>';
      h += (o.noodcontacten&&o.noodcontacten.length)
        ? '<div style="margin:.2rem 0 .6rem;">'+o.noodcontacten.map(c=>'<a href="'+telHref(c.telefoon)+'" style="display:flex;align-items:center;gap:.5rem;padding:.45rem 0;border-bottom:1px solid var(--line);text-decoration:none;color:var(--txt);"><span>📞</span><b style="flex:1;">'+esc(c.naam||'Contact')+(c.wie?' <span class="meta">· '+esc(c.wie)+'</span>':'')+'</b><span style="color:var(--gold);">'+esc(c.telefoon)+'</span></a>').join('')+'</div>'
        : '';
      h += infoRij('💊 Allergieën en medisch', o.allergie);
      h += infoRij('🍽️ Eten en bedtijden', o.eten);
      h += infoRij('🏠 Huisregels', o.huisregels);
      if (!(o.noodcontacten&&o.noodcontacten.length) && !o.allergie && !o.eten && !o.huisregels) h += '<div class="meta">Het gezin heeft nog geen info ingevuld.</div>';
      h += '<div class="meta" style="margin-top:.6rem;">Bij nood: bel 112.</div></div>';
      // Agenda
      const ag = (gz.agenda||[]).filter(a=>!a.voorbij).slice(0,8);
      h += '<div class="card"><div class="label">📅 Agenda</div>'+
        (ag.length ? ag.map(a=>'<div style="display:flex;gap:.6rem;padding:.4rem 0;border-bottom:1px solid var(--line);"><b style="color:var(--gold);white-space:nowrap;">'+(a.tijd||datumKort(a.datum))+'</b><span style="flex:1;">'+esc(a.titel)+(a.wieNaam?' <span class="meta">· '+esc(a.wieNaam)+'</span>':'')+'<div class="meta">'+datumKort(a.datum)+'</div></span></div>').join('') : '<div class="meta">Niets gepland.</div>')+'</div>';
      // Waar is iedereen
      const loc = (gz.locaties||[]);
      h += '<div class="card"><div class="label">📍 Waar is iedereen</div>'+
        (loc.length ? loc.map(l=>'<div style="display:flex;align-items:center;gap:.6rem;padding:.45rem 0;border-bottom:1px solid var(--line);"><span style="width:1.8rem;height:1.8rem;border-radius:50%;background:'+(l.kleur||'#C9A24B')+';display:flex;align-items:center;justify-content:center;">'+(l.avatar||'🙂')+'</span><div style="flex:1;"><b>'+esc(l.naam)+'</b><div class="meta">'+esc(l.status)+' · '+geleden(l.at)+'</div></div>'+(l.lat!=null?'<a href="https://www.google.com/maps?q='+l.lat+','+l.lon+'" target="_blank" rel="noopener" style="color:var(--gold);white-space:nowrap;">Kaart →</a>':'')+'</div>').join('') : '<div class="meta">Niemand deelt nu iets.</div>')+'</div>';
      return h;
    }).join('');
  }
  function infoRij(titel, tekst){ return tekst ? '<div style="margin-top:.5rem;"><div class="meta" style="font-weight:600;color:var(--txt);">'+esc(titel)+'</div><div style="white-space:pre-wrap;line-height:1.4;font-size:.92rem;">'+esc(tekst)+'</div></div>' : ''; }
  async function rtfReply(){
    const inp=$('#rtfReplyIn'); if(!inp) return; const t=(inp.value||'').trim(); if(!t) return;
    const g=(rtf.gekoppeld||[]); if(!g.length) return;
    try{ await API.call('/rtf/bericht',{ code:g[0].code, tekst:t }); inp.value=''; toast('Verstuurd naar '+g[0].gezinNaam+'.'); }
    catch(e){ toast(e.message); }
  }
  async function rtfKoppelStart(){
    const code = prompt('Vul de gezinscode in die je van het gezin kreeg:');
    if (!code) return;
    try {
      const d = await API.call('/rtf/profielen', { code: code.trim().toUpperCase() });
      const namen = d.profielen.map((p,i)=> (i+1)+'. '+p.naam + (p.gekoppeld?' (al gekoppeld)':'')).join('\n');
      const keuze = prompt('Gezin "'+d.gezinNaam+'". Welk profiel ben jij?\n'+namen+'\n\nTyp het nummer:');
      const idx = parseInt(keuze,10)-1;
      if (isNaN(idx) || !d.profielen[idx]) return;
      const r = await API.call('/rtf/koppel', { code: code.trim().toUpperCase(), profielId: d.profielen[idx].id });
      toast('Gekoppeld aan '+r.gezinNaam+'. Je krijgt hun meldingen nu ook op je telefoon.');
      await refreshState(); renderFoundation(); openTab('gezin');
      ensurePush(true);
    } catch(e){ toast(e.message || 'Koppelen lukte niet.'); }
  }
  // web-push aanzetten voor gezinsmeldingen op de telefoon
  function urlB64ToUint8(base64){
    const pad='='.repeat((4-base64.length%4)%4); const b=(base64+pad).replace(/-/g,'+').replace(/_/g,'/');
    const raw=atob(b); const arr=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i); return arr;
  }
  async function ensurePush(interactief){
    try{
      if (!('serviceWorker' in navigator) || !('PushManager' in window)){ if(interactief) toast('Push wordt op dit toestel niet ondersteund.'); return; }
      const keyRes = await fetch('/api/push/key').then(r=>r.json()).catch(()=>({}));
      if (!keyRes.key){ if(interactief) toast('Meldingen zijn nu niet beschikbaar.'); return; }
      if (interactief || Notification.permission==='default'){
        const perm = await Notification.requestPermission();
        if (perm !== 'granted'){ if(interactief) toast('Zet meldingen aan in je instellingen om ze te ontvangen.'); return; }
      } else if (Notification.permission !== 'granted'){ return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: urlB64ToUint8(keyRes.key) });
      await API.call('/push/subscribe', { subscription: sub });
      if (interactief) toast('Top! Gezinsmeldingen komen nu ook op je telefoon binnen.');
    }catch(e){ if(interactief) toast('Meldingen aanzetten lukte niet.'); }
  }

  /* ---------- reizen ---------- */

  function renderTrip(){
    $('#tripSub').textContent = trip.dest + ' · ' + trip.dates + ' · ' + T('app.in','over') + ' ' + trip.days + ' ' + T('app.days','dagen');
    $('#tripList').innerHTML = trip.items.map(it =>
      '<div class="rowitem">' +
        '<div class="t"><b>' + it.title + '</b><span>' + it.when + ' · ' + it.sub + '</span></div>' +
        '<span class="pill ' + (it.status === 'paid' ? 'paid' : it.status === 'req' ? 'req' : 'open') + '">' + tLbl(it.label) + '</span>' +
      '</div>').join('');
    renderAgenda();
  }

  /* de reisagenda: alles met een datum (tafels, tickets, ritten, events)
     automatisch samengevoegd tot een dagprogramma onder de reis */
  const AGENDA_ICO = { reservering: '🪑', ticket: '🎟', boeking: '🗓', rit: '🚗', event: '🎉' };
  async function renderAgenda(){
    if (!API.live) return;
    let wrap = $('#agendaWrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.id = 'agendaWrap';
      $('#tripList').insertAdjacentElement('afterend', wrap);
    }
    let dagen = [];
    try { dagen = (await API.call('/agenda/mijn')).dagen || []; } catch(e){ return; }
    if (!dagen.length){ wrap.innerHTML = ''; return; }
    const dagNaam = d => new Date(d + 'T12:00:00').toLocaleDateString(lang() === 'en' ? 'en-GB' : 'nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
    wrap.innerHTML = '<div class="sec-label" style="margin-top:1.2rem;">📅 ' + T('erv.agenda','Mijn programma') + '</div>' +
      dagen.map(d =>
        '<div style="font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--gold);margin:0.7rem 0 0.35rem;">' + dagNaam(d.datum) + '</div>' +
        d.items.map(it =>
          '<div class="rowitem"><div class="t"><b>' + (AGENDA_ICO[it.soort] || '·') + ' ' + it.titel + '</b><span>' + (it.tijd || T('erv.heledag','hele dag')) + ' · ' + tStatus(it.status) + '</span></div></div>'
        ).join('')
      ).join('');
  }

