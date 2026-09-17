/* Language changes only presentation; agreement, identity and focus are preserved. */
  window.addEventListener('rtglang',()=>{
    if(!onbSt || onbEl('onbGate').hidden) return;
    const inp=onbEl('onbIn');
    const consent=onbEl('onbConsent').checked, open=!onbEl('onbLees').hidden;
    const active=document.activeElement, scroll=onbEl('onbGate').scrollTop;
    if(onbStap==='teken') { onbTekenVraag(true); if(open) onbToonLees(); }
    else if(onbStap==='veld' && onbHuidig) onbVraagVeld(onbHuidig,true);
    onbEl('onbConsent').checked=consent;
    onbLanguagePolicy();
    if(active && active.isConnected && document.activeElement!==active) active.focus({preventScroll:true});
    onbEl('onbGate').scrollTop=scroll;
  });
  function onbLanguagePolicy(){
    const supported=RTGAccessMeaning.criticalLanguages.includes(lang());
    onbEl('onbLanguageNotice').hidden=supported && lang()==='nl';
    onbEl('onbLanguageNotice').textContent=supported
      ? T('access.onb.sourceNotice','De overeenkomst hieronder is de Nederlandse brontekst. Geef alleen uw akkoord als u deze begrijpt.')
      : T('access.onb.languageNotice','Deze overeenkomst is in het Nederlands. De bevestiging is beschikbaar in het Nederlands en Engels. Kies een van deze talen via de Edge Bar.');
    if(onbStap==='teken') onbEl('onbGo').disabled=onbBezig || !supported;
    return supported;
  }
  async function onbSignError(error,name){
    if(error && error.status===409){
      try {
        onbSt=await API.call('/onboarding/status');
        onbTekenVraag(); onbEl('onbIn').value=name;
        onbToonLees(); // A different contract always needs a fresh, explicit choice.
      } catch(e) { /* Keep the old version blocked by the server until it can reload. */ }
    }
    onbEl('onbFout').textContent=error && error.status===409
      ? T('access.onb.changed','De overeenkomst is gewijzigd. Lees de actuele versie en geef opnieuw uw akkoord.')
      : (error && error.message) || T('onb.mis','Dat lukte niet. Probeer het opnieuw.');
  }
  function onbVraagPaspoort(){
    const rij = onbEl('onbRij'); if (rij) rij.style.display = 'none';
    onbZeg(T('onb.q.paspoort','Voor deze toegang is een identiteitscontrole nodig. Scan uw paspoort of kies een duidelijke foto van de voorkant.'));
