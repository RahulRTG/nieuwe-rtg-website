/* het gezinsblok: chatten en bellen met het gezin */
    box.innerHTML='<div class="label">Chat en bellen</div>'+
      '<div class="meta" style="margin-bottom:0.5rem;">Bericht of (video)bel het gezin in de app.</div>'+
      kan.leden.map(function(l){ var c=byId[l.id]||{}; return '<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);"><span style="width:2rem;height:2rem;border-radius:50%;background:'+(l.kleur||'#C9A24B')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.85rem;font-weight:700;color:#0C0C0B;">'+(l.avatar||esc((l.naam||'?').charAt(0).toUpperCase()))+'</span><div class="grow-min"><b>'+esc(l.naam)+'</b>'+(c.ongelezen?' <span style="color:var(--burgundy);">('+c.ongelezen+')</span>':'')+(c.laatste?'<div class="meta" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(c.laatste)+'</div>':'')+'</div><button class="go" style="padding:.2rem .5rem;" data-chat="'+l.id+'">Chat</button><button class="go" style="background:transparent;padding:.2rem .4rem;" data-bel="'+l.id+'">'+RTGGlyf.svgHTML('bellen')+'</button><button class="go" style="background:transparent;padding:.2rem .4rem;" data-video="'+l.id+'">'+RTGGlyf.svgHTML('videobellen')+'</button></div>'; }).join('')+
      '<div id="grtThread" style="display:none;margin-top:0.75rem;"></div>';
    box.querySelectorAll('[data-chat]').forEach(function(b){ b.onclick=function(){ openGrtThread(b.dataset.chat, kan.leden.find(function(x){return x.id===b.dataset.chat;})); }; });
    box.querySelectorAll('[data-bel]').forEach(function(b){ b.onclick=function(){ GezinRT.bel(b.dataset.bel,false); }; });
    box.querySelectorAll('[data-video]').forEach(function(b){ b.onclick=function(){ GezinRT.bel(b.dataset.video,true); }; });
  }
  function grtMsgHtml(m){ var mij=m.vanMij; var inner = mij ? esc(m.tekst) : '<span class="xlate">'+esc(m.tekst)+'</span>'; return '<div style="align-self:'+(mij?'flex-end':'flex-start')+';max-width:80%;padding:.4rem .7rem;border-radius:12px;'+(mij?'background:var(--gold);color:#1a1710;':'background:var(--card2,#1B1817);border:1px solid var(--line);')+'white-space:pre-wrap;">'+inner+'</div>'; }
  function scrollGrt(){ var m=$('#grtMsgs'); if(m) m.scrollTop=m.scrollHeight; }
  async function openGrtThread(id, lid){
    grtActief=id; var t=$('#grtThread'); t.style.display='';
    var d={berichten:[]}; try{ d=await GezinRT.thread(id); }catch(e){}
    t.innerHTML='<div style="font-weight:600;margin-bottom:0.5rem;">Gesprek met '+esc(lid?lid.naam:'')+'</div>'+
      '<div id="grtMsgs" style="max-height:14rem;overflow:auto;display:flex;flex-direction:column;gap:.3rem;">'+(d.berichten||[]).map(grtMsgHtml).join('')+'</div>'+
      '<div style="display:flex;gap:.5rem;margin-top:0.5rem;"><input id="grtIn" placeholder="Bericht..." style="flex:1;background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:12px;padding:.5rem .7rem;color:var(--txt);"><button class="go" id="grtStuur">Stuur</button></div>';
    $('#grtStuur').onclick=grtStuur; $('#grtIn').addEventListener('keydown',function(e){ if(e.key==='Enter') grtStuur(); });
    vertaalBubbels($('#grtMsgs'));
    scrollGrt();
  }
  async function grtStuur(){ var inp=$('#grtIn'); if(!inp) return; var t=(inp.value||'').trim(); if(!t||!grtActief) return; inp.value=''; try{ var r=await GezinRT.stuur(grtActief,t); var el=$('#grtMsgs'); if(el){ el.insertAdjacentHTML('beforeend', grtMsgHtml({tekst:r.bericht.tekst,vanMij:true})); scrollGrt(); } }catch(e){ toast(e.message); } }
  function onGrtChat(m){ if(grtActief && m.van===grtActief){ var el=$('#grtMsgs'); if(el){ el.insertAdjacentHTML('beforeend', grtMsgHtml({tekst:m.tekst,vanMij:false})); vertaalBubbels(el); scrollGrt(); } } }
  const telHref = t => 'tel:' + String(t||'').replace(/[^0-9+]/g,'');
  function geleden(iso){ const s=Math.floor((Date.now()-new Date(iso).getTime())/1000); if(s<60)return 'net nu'; if(s<3600)return Math.floor(s/60)+' min geleden'; if(s<86400)return Math.floor(s/3600)+' uur geleden'; return Math.floor(s/86400)+' dag(en) geleden'; }
  function datumKort(d){ try{ const dt=new Date(d+'T00:00:00'); const vd=new Date(); vd.setHours(0,0,0,0); const mo=new Date(vd); mo.setDate(mo.getDate()+1); if(dt.getTime()===vd.getTime())return 'Vandaag'; if(dt.getTime()===mo.getTime())return 'Morgen'; return dt.toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}); }catch(e){ return d; } }
  async function laadGezinInfo(){
    const box = $('#gezinInfo'); if(!box) return;
    let d; try{ d = await API.call('/rtf/overzicht'); }catch(e){ box.innerHTML=''; return; }
    box.innerHTML = (d.gezinnen||[]).map(gz=>{
      const o = gz.oppasinfo||{};
      const meerdan1 = (d.gezinnen||[]).length>1;
      let h = '';
      if (meerdan1) h += '<div class="label" style="margin:0.5rem 0 0.25rem;color:var(--burgundy);">'+esc(gz.gezinNaam)+'</div>';
      // Belangrijke info
      h += '<div class="card"><div class="label">Belangrijke info</div>';
      h += (o.noodcontacten&&o.noodcontacten.length)
        ? '<div style="margin:0.25rem 0 0.5rem;">'+o.noodcontacten.map(c=>'<a href="'+telHref(c.telefoon)+'" style="display:flex;align-items:center;gap:.5rem;padding:.45rem 0;border-bottom:1px solid var(--line);text-decoration:none;color:var(--txt);"><b class="h-flex1">'+esc(c.naam||'Contact')+(c.wie?' <span class="meta">· '+esc(c.wie)+'</span>':'')+'</b><span style="color:var(--gold);">'+esc(c.telefoon)+'</span></a>').join('')+'</div>'
        : '';
      h += infoRij('Allergieën en medisch', o.allergie);
      h += infoRij('Eten en bedtijden', o.eten);
      h += infoRij('Huisregels', o.huisregels);
      if (!(o.noodcontacten&&o.noodcontacten.length) && !o.allergie && !o.eten && !o.huisregels) h += '<div class="meta">Het gezin heeft nog geen info ingevuld.</div>';
      h += '<div class="meta h-mt60">Bij nood: bel 112.</div></div>';
      // Agenda
      const ag = (gz.agenda||[]).filter(a=>!a.voorbij).slice(0,8);
      h += '<div class="card"><div class="label">Agenda</div>'+
        (ag.length ? ag.map(a=>'<div style="display:flex;gap:.6rem;padding:.4rem 0;border-bottom:1px solid var(--line);"><b style="color:var(--gold);white-space:nowrap;">'+(a.tijd||datumKort(a.datum))+'</b><span class="h-flex1">'+esc(a.titel)+(a.wieNaam?' <span class="meta">· '+esc(a.wieNaam)+'</span>':'')+'<div class="meta">'+datumKort(a.datum)+'</div></span></div>').join('') : '<div class="meta">Niets gepland.</div>')+'</div>';
      // Waar is iedereen
      const loc = (gz.locaties||[]);
      h += '<div class="card"><div class="label">Waar is iedereen</div>'+
        (loc.length ? loc.map(l=>'<div style="display:flex;align-items:center;gap:.6rem;padding:.45rem 0;border-bottom:1px solid var(--line);"><span style="width:1.8rem;height:1.8rem;border-radius:50%;background:'+(l.kleur||'#C9A24B')+';display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;color:#0C0C0B;">'+(l.avatar||esc((l.naam||'?').charAt(0).toUpperCase()))+'</span><div class="h-flex1"><b>'+esc(l.naam)+'</b><div class="meta">'+esc(l.status)+' · '+geleden(l.at)+'</div></div>'+(l.lat!=null?'<a href="geo:'+l.lat+','+l.lon+'?q='+l.lat+','+l.lon+'" target="_blank" rel="noopener" style="color:var(--gold);white-space:nowrap;">Kaart →</a>':'')+'</div>').join('') : '<div class="meta">Niemand deelt nu iets.</div>')+'</div>';
      return h;
    }).join('');
  }
  function infoRij(titel, tekst){ return tekst ? '<div class="h-mt50"><div class="meta" style="font-weight:600;color:var(--txt);">'+esc(titel)+'</div><div style="white-space:pre-wrap;line-height:1.4;font-size:.92rem;">'+esc(tekst)+'</div></div>' : ''; }
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
