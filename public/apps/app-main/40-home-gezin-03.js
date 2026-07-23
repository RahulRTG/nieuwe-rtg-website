      if (!g.length){
        homeEl.innerHTML = '<div class="label">RTFoundation</div>'+
          '<div class="big" style="font-size:1.05rem;line-height:1.4;">Ben je oppas, opa of oma?</div>'+
          '<div class="meta" style="margin:.3rem 0 .7rem;">Volg een RTFoundation-gezin met je pas, dan krijg je hun meldingen hier op je telefoon, zonder een extra app.</div>'+
          '<button class="go" id="rtfKoppelBtn">Koppel een gezin →</button>';
      } else {
        homeEl.innerHTML = '<div class="label">Je gezinsruimte'+(ongelezen?' · <span style="color:var(--gold)">'+ongelezen+' nieuw</span>':'')+'</div>'+
          '<div class="big" style="font-size:1.05rem;">'+g.map(x=>esc(x.gezinNaam)).join(', ')+'</div>'+
          '<div class="meta" style="margin:.2rem 0 .7rem;">'+(ongelezen? ongelezen+' nieuwe melding'+(ongelezen>1?'en':'') : 'Alles gelezen')+'</div>'+
          '<button class="go" data-goto="gezin">Open je gezinsruimte →</button>';
      }
      const kb = $('#rtfKoppelBtn'); if (kb) kb.addEventListener('click', rtfKoppelStart);
      homeEl.querySelectorAll('[data-goto]').forEach(b=> b.addEventListener('click', ()=> openTab(b.dataset.goto)));
    }
    renderGezin();
  }
  function rtfBerichtHtml(x){
    return '<div style="padding:.55rem .7rem;border:1px solid var(--line);border-radius:12px;margin:.4rem 0;'+(x.gelezen?'':'border-color:var(--burgundy,#C23A5E);')+(x.soort==='hulp'?'background:rgba(194,58,94,.08);':'')+'">'+
      '<div style="font-size:.72rem;color:var(--muted);">'+(x.soort==='hulp'?'':(x.soort==='reis'?'':''))+esc(x.gezin)+' · '+esc(x.van||'')+'</div>'+
      '<div style="font-size:.92rem;line-height:1.4;margin-top:.15rem;white-space:pre-wrap;">'+esc(x.tekst)+'</div></div>';
  }
  function renderGezin(){
    const fam = $('#gezinFamilies'), feed = $('#gezinFeed'); if (!fam || !feed) return;
    const g = (rtf.gekoppeld || []), m = (rtf.meldingen || []);
    $('#gezinSub').textContent = g.length ? 'De RTFoundation-gezinnen die je als oppas of familie volgt.' : 'Je volgt nog geen gezin.';
    fam.innerHTML = '<div class="label">Gevolgde gezinnen</div>'+
      (g.length ? g.map(x=>'<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);"><b style="flex:1;">'+esc(x.gezinNaam)+'</b><span class="meta">als '+esc(x.profielNaam)+'</span><button class="go" style="background:transparent;color:var(--muted);padding:.2rem .4rem;" data-los="'+x.code+'|'+x.profielId+'">Ontkoppel</button></div>').join('') : '<div class="meta">Nog geen gezin gekoppeld.</div>')+
      '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.9rem;"><button class="go" id="rtfKoppelBtn2">Koppel een gezin →</button><button class="go" id="rtfPushBtn" style="background:transparent;color:var(--muted);">Meldingen op mijn telefoon</button></div>';
    feed.innerHTML = '<div class="label">Meldingen van het gezin</div>'+
      (m.length ? m.slice(0,30).map(rtfBerichtHtml).join('') : '<div class="meta">Nog geen meldingen. Zodra het gezin iets deelt, zie je het hier en op je telefoon.</div>')+
      (g.length ? '<div style="display:flex;gap:.5rem;margin-top:.8rem;"><input id="rtfReplyIn" placeholder="Antwoord het gezin..." style="flex:1;background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:12px;padding:.6rem .8rem;color:var(--txt);"><button class="go" id="rtfReplyBtn">Stuur</button></div>' : '');
    fam.querySelectorAll('[data-los]').forEach(b=> b.addEventListener('click', async ()=>{ const [code,pid]=b.dataset.los.split('|'); if(!confirm('Dit gezin niet meer volgen?')) return; try{ await API.call('/rtf/ontkoppel',{code,profielId:pid}); toast('Ontkoppeld.'); await refreshState(); renderFoundation(); if(!(rtf.gekoppeld||[]).length) openTab('home'); }catch(e){ toast(e.message); } }));
    const kb=$('#rtfKoppelBtn2'); if(kb) kb.addEventListener('click', rtfKoppelStart);
    const pb=$('#rtfPushBtn'); if(pb) pb.addEventListener('click', ()=> ensurePush(true));
    const rb=$('#rtfReplyBtn'); if(rb) rb.addEventListener('click', rtfReply);
    const ri=$('#rtfReplyIn'); if(ri) ri.addEventListener('keydown', e=>{ if(e.key==='Enter') rtfReply(); });
    if (m.filter(x=>!x.gelezen).length) API.call('/rtf/meldingen/gelezen').catch(()=>{});
    if (g.length){ laadGezinInfo(); laadGezinChat(); } else { const gc=$('#gezinChat'); if(gc) gc.style.display='none'; }
  }
  let grtInit=false, grtActief=null;
  async function laadGezinChat(){
    const box=$('#gezinChat'); if(!box) return;
    const g=(rtf.gekoppeld||[]); if(!g.length){ box.style.display='none'; return; }
    box.style.display='';
    let kan; try{ kan=await API.call('/rtf/kanaal',{ code:g[0].code }); }catch(e){ box.innerHTML='<div class="meta">Chat is nu niet beschikbaar.</div>'; return; }
    if (!grtInit && window.GezinRT){ GezinRT.init({ base:'/api/foundation', code:kan.code, token:kan.token, mijnId:kan.profielId, mijnNaam:'ik', leden:kan.leden, onChat:onGrtChat }); grtInit=true; }
    else if (window.GezinRT){ GezinRT.setLeden(kan.leden); }
    let chats=[]; try{ chats=(await GezinRT.chats()).chats||[]; }catch(e){}
    const byId={}; chats.forEach(c=> byId[c.id]=c);
    box.innerHTML='<div class="label">Chat en bellen</div>'+
      '<div class="meta" style="margin-bottom:.4rem;">Bericht of (video)bel het gezin in de app.</div>'+
      kan.leden.map(function(l){ var c=byId[l.id]||{}; return '<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);"><span style="width:2rem;height:2rem;border-radius:50%;background:'+(l.kleur||'#C9A24B')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.85rem;font-weight:700;color:#0C0C0B;">'+(l.avatar||esc((l.naam||'?').charAt(0).toUpperCase()))+'</span><div class="grow-min"><b>'+esc(l.naam)+'</b>'+(c.ongelezen?' <span style="color:var(--burgundy);">('+c.ongelezen+')</span>':'')+(c.laatste?'<div class="meta" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(c.laatste)+'</div>':'')+'</div><button class="go" style="padding:.2rem .5rem;" data-chat="'+l.id+'">Chat</button><button class="go" style="background:transparent;padding:.2rem .4rem;" data-bel="'+l.id+'">'+RTGGlyf.svgHTML('bellen')+'</button><button class="go" style="background:transparent;padding:.2rem .4rem;" data-video="'+l.id+'">'+RTGGlyf.svgHTML('videobellen')+'</button></div>'; }).join('')+
      '<div id="grtThread" style="display:none;margin-top:.7rem;"></div>';
    box.querySelectorAll('[data-chat]').forEach(function(b){ b.onclick=function(){ openGrtThread(b.dataset.chat, kan.leden.find(function(x){return x.id===b.dataset.chat;})); }; });
    box.querySelectorAll('[data-bel]').forEach(function(b){ b.onclick=function(){ GezinRT.bel(b.dataset.bel,false); }; });
    box.querySelectorAll('[data-video]').forEach(function(b){ b.onclick=function(){ GezinRT.bel(b.dataset.video,true); }; });
  }
  function grtMsgHtml(m){ var mij=m.vanMij; var inner = mij ? esc(m.tekst) : '<span class="xlate">'+esc(m.tekst)+'</span>'; return '<div style="align-self:'+(mij?'flex-end':'flex-start')+';max-width:80%;padding:.4rem .7rem;border-radius:12px;'+(mij?'background:var(--gold);color:#1a1710;':'background:var(--card2,#1B1817);border:1px solid var(--line);')+'white-space:pre-wrap;">'+inner+'</div>'; }
  function scrollGrt(){ var m=$('#grtMsgs'); if(m) m.scrollTop=m.scrollHeight; }
  async function openGrtThread(id, lid){
    grtActief=id; var t=$('#grtThread'); t.style.display='';
    var d={berichten:[]}; try{ d=await GezinRT.thread(id); }catch(e){}
    t.innerHTML='<div style="font-weight:600;margin-bottom:.4rem;">Gesprek met '+esc(lid?lid.naam:'')+'</div>'+
      '<div id="grtMsgs" style="max-height:14rem;overflow:auto;display:flex;flex-direction:column;gap:.3rem;">'+(d.berichten||[]).map(grtMsgHtml).join('')+'</div>'+
      '<div style="display:flex;gap:.5rem;margin-top:.5rem;"><input id="grtIn" placeholder="Bericht..." style="flex:1;background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:12px;padding:.5rem .7rem;color:var(--txt);"><button class="go" id="grtStuur">Stuur</button></div>';
    $('#grtStuur').onclick=grtStuur; $('#grtIn').addEventListener('keydown',function(e){ if(e.key==='Enter') grtStuur(); });
    vertaalBubbels($('#grtMsgs'));
    scrollGrt();
  }
  async function grtStuur(){ var inp=$('#grtIn'); if(!inp) return; var t=(inp.value||'').trim(); if(!t||!grtActief) return; inp.value=''; try{ var r=await GezinRT.stuur(grtActief,t); var el=$('#grtMsgs'); if(el){ el.insertAdjacentHTML('beforeend', grtMsgHtml({tekst:r.bericht.tekst,vanMij:true})); scrollGrt(); } }catch(e){ toast(e.message); } }
  function onGrtChat(m){ if(grtActief && m.van===grtActief){ var el=$('#grtMsgs'); if(el){ el.insertAdjacentHTML('beforeend', grtMsgHtml({tekst:m.tekst,vanMij:false})); vertaalBubbels(el); scrollGrt(); } } }
  const telHref = t => 'tel:' + String(t||'').replace(/[^0-9+]/g,'');
  function geleden(iso){ const s=Math.floor((Date.now()-new Date(iso).getTime())/1000); if(s<60)return 'net nu'; if(s<3600)return Math.floor(s/60)+' min geleden'; if(s<86400)return Math.floor(s/3600)+' uur geleden'; return Math.floor(s/86400)+' dag(en) geleden'; }
  function datumKort(d){ try{ const dt=new Date(d+'T00:00:00'); const vd=new Date(); vd.setHours(0,0,0,0); const mo=new Date(vd); mo.setDate(mo.getDate()+1); if(dt.getTime()===vd.getTime())return 'Vandaag'; if(dt.getTime()===mo.getTime())return 'Morgen'; return dt.toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}); }catch(e){ return d; } }
