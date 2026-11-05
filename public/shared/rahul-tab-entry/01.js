/* Opent Rahul met de actuele appcontext en herstelt de vorige focus. */\n  async function open(ja){if(ja)await synchroniseer();page.hidden=!ja;tab.classList.toggle('actief',ja);if(ja){page.scrollTop=0;vorige=document.querySelector('.rtg-rahul-tab~.actief,.wk-tabs>.actief,.lo-tabs>.actief,.po-tabs>.actief')||vorige;var c=context();page.querySelector('[data-app]').textContent=c.app;page.querySelector('[data-selection]').textContent=c.selectie||c.deel||'Geen selectie gemeten';page.querySelector('[data-context]').textContent='Ik zie '+c.deel+' in '+c.app+'. Ik combineer alleen gegevens waarvoor uw huidige rol toegang heeft.';page.querySelector('[data-greeting]').textContent=c.deel+' staat klaar.';voorstellen(c);if(window.RTGLiveTwin)RTGLiveTwin.context(c);if(!historie.length)voeg('rahul','Vertel het gewenste resultaat; ik toon de stappen, uitzonderingen en beslissingen.');setTimeout(function(){try{input.focus({preventScroll:true})}catch(e){input.focus()}page.scrollTop=0},120)}else if(vorige)vorige.classList.add('actief')}
  async function vraag(voorstel){
    if(bezig)return false;
    bezig=true;
    try{
      await synchroniseer();
      var q=typeof voorstel==='string'?voorstel.trim():input.value.trim();
      if(!q)return false;
      /* Leg het actieve werkstuk vast voordat begin() de vorige presentatie
         intrekt. Zo reist de veilige objectverwijzing mee met deze vraag,
         terwijl een oud concept of voorstel niet uitvoerbaar zichtbaar blijft. */
      var c=JSON.parse(JSON.stringify(context()));
      RTGRahulTabHelpers.begin(page,beslissingen());
      var eigenaar=sessieOwner;
      if(typeof voorstel!=='string')input.value='';
      voeg('user',q);
      if(window.RTGKompas)RTGKompas.denkt(true);
      voeg('rahul','Context en grenzen controleren…');
      var token='',supplier='';
      try{token=localStorage.getItem('rtg_member_token')||'';supplier=localStorage.getItem('rtg_sup_token')||''}catch(e){}
      var pad=token?'/api/fluister':'/api/supplier/ai',auth=token||supplier;
      try{
        if(!auth)throw new Error('geen sessie');
        if(window.RTGLiveTwin){RTGLiveTwin.context(c);RTGLiveTwin.denkt(true)}
        var r=await fetch(pad,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth},body:JSON.stringify({q:q,context:c})});
        var d=await r.json();
        await synchroniseer();
        if(sessieOwner!==eigenaar)return true;
        if(!r.ok||!d||d.error||d.ok===false)throw new Error('Antwoord niet geslaagd');
        historie.pop();
        if(!RTGRahulTabHelpers.actueel(c,voeg)){beslissingen().clear();return true}
        if(window.RTGKompas)RTGKompas.toon(d);
        if(window.RTGLiveTwin)RTGLiveTwin.toon(d,c);
        var st=page.querySelector('[data-ai-state]'),g=window.RTGKompas&&RTGKompas.regel&&RTGKompas.regel(d);
        if(st&&d){var t=g||(d.aiBeschikbaar===false?'Handmatige werkmodus · alles blijft bruikbaar':d.modus==='lokaal'?(d.verwerking==='eigen-netwerk'?'RTG Kompas · lokaal in eigen omgeving':'RTG Kompas · eigen modelserver van RTG'):d.modus==='hybride'?'RTG Kompas · externe uitwijk zichtbaar':d.aiBeschikbaar===true?'AI ondersteund · menselijke autoriteit':'');if(t)st.innerHTML='<i></i>'+t}
        voeg('rahul',(d&&(d.antwoord||d.reply||d.error))||'Ik kon dit nog niet afronden.',window.RTGRahulTabHelpers.noot(d));
        if(token)RTGRahulTabHelpers.werk(d,page,token);
        beslissingen().show(d,auth,!!token,sessieOwner,c);
        if(d&&d.gedaan)page.querySelector('[data-done]').textContent='Laatste opdracht uitgevoerd en vastgelegd';
      }catch(e){
        await synchroniseer();
        if(sessieOwner===eigenaar){historie.pop();voeg('rahul','Vrije hulp is nu niet bereikbaar. Uw werkblad, navigatie en alle handmatige functies blijven gewoon beschikbaar.')}
      }
      return true;
    }finally{
      if(window.RTGKompas)RTGKompas.denkt(false);
      if(window.RTGLiveTwin)RTGLiveTwin.denkt(false);
      bezig=false;
    }
  }

  tab.onclick=function(){if(window.RTGRahulTabHelpers)open(true)};page.querySelector('.rtg-command-close').onclick=function(){open(false)};page.querySelector('.rtg-mouth').onclick=function(){try{input.focus({preventScroll:true})}catch(e){input.focus()}};page.querySelector('form').onsubmit=function(e){e.preventDefault();vraag()};page.querySelector('[data-approve]').onclick=function(){beslissingen().confirm()};page.querySelector('[data-policy]').onclick=function(){voeg('rahul','Actieve grens: ik mag binnen uw rol lezen, vergelijken en voorbereiden. Betalen, publiceren, toegang wijzigen en definitief toezeggen vereisen afzonderlijk menselijk akkoord.')};
  window.RTGMetgezel=window.RTGMetgezel||{};
  window.RTGMetgezel.rahul=async function(q){
    if(!window.RTGRahulTabHelpers||!window.RTGRahulSession||!window.RTGRahulApproval)return false;
    if(q&&bezig)return false;
    try{await open(true);return q?await vraag(q):true}catch(e){return false}
  };
  window.__rahulTabCommand={page:page,context:context,voeg:voeg,stel:function(q){input.value=q;vraag()}};
  window.addEventListener('storage',function(e){if(/^rtg_(member|sup|pda|office)_token$/.test(e.key||''))synchroniseer()});
  laadStijl('/shared/rahul-tab/kompas.js');
  laadStijl('/shared/rahul-tab/workspace.js');
})();
