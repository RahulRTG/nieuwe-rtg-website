/* inloggen en de staat binnenhalen: token, pas en het eerste scherm */
    API.token = t;
    try {
      applyState((await API.call('/state')).state);
      if (wervingscode) {
        try {
          await API.call('/werving/verbind', { kassacode: wervingscode });
          toast('U bent met uw werkgever verbonden.');
        } catch (wout) { toast(wout.message || 'De personeelsuitnodiging is niet meer geldig.'); }
        wervingscode = '';
      }
      const doelPas = user.tier === 'guest' ? 'rtg' : user.tier;
      const magHier = vastePas ? (vastePas === 'rtg' ? ['rtg','guest'] : [vastePas]) : [];
      if (!magHier.includes(user.tier)){
        if (['rtg','lifestyle','business'].includes(doelPas)){ location.replace(pasAdres(doelPas)); return; }
        API.token = null; return; // onbekende pas: poort tonen
      }
      $('#gate').style.display = 'none';
      $('#app').classList.add('active');
      renderAll();
      await verwerkWebsiteAanvraag();
      if (window.RTGRealtime) RTGRealtime.start(API.token, { onSync: syncScope, onChange: renderBell, onSocial: opSociaal, onCall: opBelsignaal, onBezorg: opBezorg, onOntmoetSignaal: opOntmoetSignaal });
      loadSocial();
      checkOnboarding(); laadAgendaLid();
    } catch(e){
      API.token = null;
      try { localStorage.removeItem('rtg_member_token'); } catch(e2){}
    }
  }

  async function doLogout(){
    try { if (API.live) await API.call('/logout'); } catch(e){}
    try { localStorage.removeItem('rtg_member_token'); } catch(e){}
    try { localStorage.removeItem('rtg_actieve_tab'); } catch(e){} // de volgende gast begint op het beginscherm
    /* En zijn werktafel staat leeg. Sinds WERELD.md hervat de werktafel je
       laatste bladen (shared/command/geheugen.js); zonder deze regel zou de
       volgende mens op een gedeeld toestel de titels van de vorige zien. */
    try { localStorage.removeItem('rtg_cmd_bladen'); } catch(e){}
    location.reload();
  }

  /* One access portal, using the existing authentication and onboarding routes.
     Draft details stay in memory; passwords go directly to auth, never to chat. */
  (function aanmeldPortaal(){
    const gate = document.getElementById('gate');
    if (!gate || !API.enabled) return;
    const tx = (nl, en) => lang() === 'en' ? en : nl;
    gate.dataset.rtgAccess = 'true';
    gate.innerHTML =
      '<div class="access-brand" aria-label="RTG">RTG<small>' + tx('VEILIGE TOEGANG','SECURE ACCESS') + '</small></div>' +
      '<div class="access-content">' +
        '<button class="access-secondary access-back" id="agBack" type="button" hidden>' + tx('Terug','Back') + '</button>' +
        '<p class="access-progress" id="agStappen" role="status" aria-live="polite" hidden></p>' +
        '<h1 class="access-title" id="agTitle" tabindex="-1"></h1>' +
        '<p class="access-description" id="agZin"></p>' +
        '<p class="ag-experience" id="agExperience" hidden></p>' +
        '<div id="agWelcome">' +
          '<button class="access-primary" id="agPasskey" type="button">' +
            '<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M12 11a2 2 0 0 0-2 2c0 2-.4 3.6-1 5M8 9a4 4 0 0 1 7 2c0 3-.5 5.4-1.5 7.5M12 13c0 3-.6 5.6-1.6 7.7M5.5 8a7 7 0 0 1 12 3c0 3.4-.5 6.4-1.5 9"/></svg>' +
            '<span>' + tx('Verder met passkey','Continue with a passkey') + '</span></button>' +
          '<p class="access-hint">' + tx('U gebruikt de beveiliging van uw apparaat.','You use your device’s security.') + '</p>' +
          '<button class="access-link" id="agAnders" type="button"><span>' + tx('Andere manier','Another way') + '</span><span aria-hidden="true">→</span></button>' +
          '<p class="access-new">' + tx('Bent u nieuw bij RTG?','Are you new to RTG?') +
            ' <button id="agNieuw" type="button">' + tx('Maak uw RTG','Create your RTG') + '</button></p>' +
        '</div>' +
        '<form id="agForm" hidden novalidate>' +
          '<label class="access-field" id="agLabel"><span id="agFieldLabel"></span><input id="agIn" aria-describedby="agZin agError" required></label>' +
          '<label class="access-field" id="agCodeLabel" hidden>' + tx('Sms-code, als u die heeft ontvangen','Text message code, if you received one') +
            '<input id="agCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}"></label>' +
          '<button id="agShowPassword" class="access-secondary" type="button" hidden aria-pressed="false">' + tx('Toon wachtwoord','Show password') + '</button>' +
          '<details class="access-summary" id="agSummary" hidden><summary>' + tx('Controleer uw gegevens','Review your details') + '</summary><div id="agReview"></div></details>' +
          '<button class="access-primary" id="agGo" type="submit"></button>' +
          '<button class="access-secondary" id="agForgot" type="button" hidden>' + tx('Wachtwoord vergeten','Forgot your password') + '</button>' +
        '</form>' +
        '<p class="access-status" id="agStatus" role="status" aria-live="polite"></p>' +
        '<p class="access-error" id="agError" role="alert"></p>' +
        '<a class="access-foundation" id="agFoundation" href="/apps/foundation/os-publiek.html" hidden>' +
          tx('Ontdek FoundationOS. Dit is en blijft altijd 100% gratis.','Explore FoundationOS. It is and always will be 100% free.') + '</a>' +
      '</div>';
    const el = id => gate.querySelector('#' + id);
    const inp = el('agIn'), form = el('agForm'), title = el('agTitle');
    const draft = { name: '', email: '', geboortedatum: '' };
    let view = 'welcome', step = 0, busy = false, accountName = '', secondProof = '';
    let passkeyAbort = null, passkeyAttempt = 0;
    let resetToken = new URLSearchParams(location.search).get('reset') || '';
    const interests = window.RTGExperienceHandoff && window.RTGExperienceHandoff.consume();
    if (interests && interests.length) {
      el('agExperience').textContent = tx('U verkende ', 'You explored ') + interests.join(', ') +
        tx('. Dit wordt hier getoond en niet in uw account opgeslagen.','. This is shown here and is not saved to your account.');
      el('agExperience').hidden = false;
    }
    function message(text, error){
      el(error ? 'agStatus' : 'agError').textContent = '';
      el(error ? 'agError' : 'agStatus').textContent = text || '';
      if (error) inp.setAttribute('aria-invalid', 'true');
    }
    function waiting(on){
      busy = on; form.setAttribute('aria-busy', String(on));
      gate.querySelectorAll('button,input').forEach(button => { button.disabled = on; });
    }
