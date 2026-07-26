    /* Face ID / passkey: dezelfde WebAuthn-dans als de aparte passkey-pagina,
       maar binnen de poort. Rahul kent de gebruikersnaam al (loginU); het
       toestel bewijst de identiteit, de server munt een echte sessie. */
    async function passkeyInlog(){
      if (!loginU || bezig) return;
      if (!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.get)){
        zeg('rahul', T('ag.pk.geen','Dit toestel kent nog geen Face ID of passkey. Typ je wachtwoord.')); return;
      }
      const b2u = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
      const u2b = buf => btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      bezig = true;
      try {
        zeg('rahul', T('ag.pk.vraag','Je toestel vraagt nu om je Face ID, vingerafdruk of sleutel.'));
        const o = await API.call('/webauthn/opties', { login: loginU });
        const pub = o.opties; pub.challenge = b2u(pub.challenge);
        pub.allowCredentials = (pub.allowCredentials || []).map(c => Object.assign({}, c, { id: b2u(c.id) }));
        const cred = await navigator.credentials.get({ publicKey: pub });
        const antwoord = { id: cred.id, rawId: u2b(cred.rawId), type: cred.type,
          clientExtensionResults: cred.getClientExtensionResults(),
          response: { authenticatorData: u2b(cred.response.authenticatorData), clientDataJSON: u2b(cred.response.clientDataJSON),
            signature: u2b(cred.response.signature), userHandle: cred.response.userHandle ? u2b(cred.response.userHandle) : null } };
        const r = await API.call('/webauthn/login', { login: loginU, antwoord });
        bezig = false;
        if (r && r.token){
          API.token = r.token; try { localStorage.setItem('rtg_member_token', r.token); } catch(e){}
          zeg('rahul', T('ag.welkom','Daar ben je weer. Welkom terug.'));
          if (typeof restoreSession === 'function') await restoreSession();
        }
      } catch(e){
        bezig = false;
        if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) return; // afgebroken door de gebruiker
        zeg('rahul', (e && e.message ? e.message + ' ' : '') + T('ag.pk.mis','Dat lukte niet met de passkey. Typ anders je wachtwoord.'));
      }
    }
    if (pkKnop) pkKnop.addEventListener('click', passkeyInlog);

    /* ---------- wachtwoord-herstel, geheel in het gesprek ----------
       Rahul vraagt de zescijferige code (tweede kanaal, per SMS) en daarna het
       nieuwe wachtwoord, en zet het via de bestaande /auth/reset-route (die de
       herstel-link uit de e-mail plus de code samen eist). Daarna gaat het
       gewone inloggesprek verder. */
    let resetStap = 0, resetCode = '';
    function resetStart(){
      resetStap = 1;
      inp.type = 'text'; inp.inputMode = 'numeric';
      inp.placeholder = T('ag.reset.codeph','De zes cijfers');
      zeg('rahul', T('ag.reset.hoi','Je stelt een nieuw wachtwoord in. Uit veiligheid stuurde ik een code van zes cijfers naar je telefoon. Wat is die code?'));
    }
    async function resetStuur(tekst){
      if (resetStap === 1){
        resetCode = tekst.replace(/\D/g, '').slice(0, 6);
        if (resetCode.length !== 6){ zeg('rahul', T('ag.reset.code6','Het zijn zes cijfers; kijk nog even in het bericht op je telefoon.')); return; }
        resetStap = 2;
        wachtwoordVeld(T('ag.wwnieuw','Kies een wachtwoord'));
        zeg('rahul', T('ag.reset.ww','Dank je. En wat wordt je nieuwe wachtwoord? Minstens zes tekens.'));
      } else if (resetStap === 2){
        if (tekst.length < 6){ zeg('rahul', T('ag.reset.ww6','Minstens zes tekens graag.')); return; }
        try {
          await API.call('/auth/reset', { token: herstel, code: resetCode, password: tekst });
          resetStap = 3; resetCode = ''; tekstVeld(); inp.inputMode = 'text';
          zeg('rahul', T('ag.reset.klaar','Klaar, je nieuwe wachtwoord staat. Zeg "inloggen" en ik laat je binnen.'));
        } catch(e){
          resetStap = 1; resetCode = ''; inp.type = 'text';
          zeg('rahul', (e && e.message ? e.message + ' ' : '') + T('ag.reset.mis','Zeg "opnieuw" en dan proberen we het nog eens.'));
        }
      } else {
        // klaar: over naar het gewone inloggesprek, ?reset uit de URL halen
        resetStap = 0;
        const pas = new URLSearchParams(location.search).get('pas');
        try { history.replaceState(null, '', location.pathname + (pas ? '?pas=' + pas : '')); } catch(e){}
        gesprek = null; start();
      }
    }

    async function start(){
      if (gesprek || bezig) return;
      bezig = true;
      try { const d = await API.call('/aanmeld/start', { lang: document.documentElement.lang || 'nl' }); gesprek = d.id; zeg('rahul', d.tekst); }
      catch(e){ zeg('rahul', T('ag.mis','Het gesprek wil even niet starten; zeg iets, dan probeer ik het opnieuw.')); gesprek = null; }
      bezig = false;
    }
    async function stuur(){
      const tekst = inp.value.trim();
      if (!tekst || bezig) return;
      inp.value = '';
      inp.closest('.ag-rij').classList.remove('vol');
      // wachtwoord-herstel loopt via zijn eigen kleine gesprek
      if (resetStap){ bezig = true; try { await resetStuur(tekst); } catch(e){ zeg('rahul', e.message || T('ag.mis2','Dat ging even mis; zeg het nog eens.')); } bezig = false; inp.focus(); return; }
      bezig = true;
      try {
        // "opnieuw" en "wachtwoord vergeten" zijn commando's voor het gesprek,
        // ook midden in het wachtwoordstadium; al het andere is daar een
        // wachtwoordpoging, rechtstreeks naar de ene inlogroute
        const commando = loginU && tekst.length <= 40 && /\b(opnieuw|vergeten)\b/i.test(tekst);
        if (loginU && !commando){
          try {
            await login('rtg', { u: loginU, p: tekst });
            zeg('rahul', T('ag.welkom','Daar ben je weer. Welkom terug.'));
          } catch(e){
            zeg('rahul', (e && e.message ? e.message + ' ' : '') + T('ag.wwmis','Probeer het nog eens, zeg "opnieuw", of zeg "wachtwoord vergeten" en dan regel ik een herstel-link.'));
          }
        } else {
          const d = await API.call('/aanmeld/zeg', { id: gesprek, tekst, lang: document.documentElement.lang || 'nl' });
          zeg('rahul', d.tekst);
          // ingelogd via de sleutelwoorden: de server heeft server-side
          // geverifieerd en een echte token gemunt; wij bewaren hem en
          // herstellen de sessie precies zoals na een gewone inlog
          if (d.ingelogd && d.token){
            try { API.token = d.token; localStorage.setItem('rtg_member_token', d.token); } catch(e2){}
            bezig = false;
            if (typeof restoreSession === 'function') await restoreSession();
            return;
          }
          // wachtwoord vergeten: Rahul belooft de herstel-link, de app vraagt
          // hem stil aan op de bestaande route (die nooit een bestaan lekt)
          if (d.vergeten && d.vergeten.u){
            API.call('/auth/forgot', { email: d.vergeten.u }).catch(() => {});
          }
          if (d.login && d.login.u){
            loginU = d.login.u;
            wachtwoordVeld();
          } else if (/wachtwoord/i.test(d.tekst) && !d.klaar){
            // de aanmeld-wachtwoordstap: niemand kijkt mee, ook op het scherm niet
            wachtwoordVeld(T('ag.wwnieuw','Kies een wachtwoord'));
          } else {
            tekstVeld();
          }
          if (d.klaar && d.velden){
            if (d.werkgever) { try { localStorage.setItem('rtg_ag_werkgever', JSON.stringify(d.werkgever)); } catch(e2){} }
            if (d.woonplaats) { try { localStorage.setItem('rtg_ag_woonplaats', d.woonplaats); } catch(e2){} }
            // dezelfde ene registratieroute als het formulier
            await login('rtg', { register: true, name: d.velden.name, u: d.velden.email, phone: d.velden.phone,
              geboortedatum: d.velden.geboortedatum, p: d.velden.password, tier: d.velden.tier });
          }
        }
      } catch(e){ zeg('rahul', e.message || T('ag.mis2','Dat ging even mis; zeg het nog eens.')); }
      // zei de gebruiker "opnieuw", dan verlaat de motor het inlogpad;
      // de app volgt door het wachtwoordveld weer een tekstveld te maken
      if (loginU && /\bopnieuw\b/i.test(tekst)){ loginU = null; tekstVeld(); }
      bezig = false;
      inp.focus();
    }
    doos.querySelector('#agGo').addEventListener('click', stuur);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); stuur(); } });
    inp.addEventListener('input', () => inp.closest('.ag-rij').classList.toggle('vol', !!inp.value.trim()));
    // herstel-link uit de e-mail: Rahul begint meteen het herstel-gesprek.
    // Anders begint het gewone gesprek zodra duidelijk is dat er geen sessie ligt.
    let onthouden = null;
    try { onthouden = localStorage.getItem('rtg_member_token'); } catch(e){}
    if (herstel) setTimeout(resetStart, 400);
    else if (!onthouden) setTimeout(start, 400);
    inp.addEventListener('focus', () => { if (!herstel && !resetStap) start(); }, { once: true });
  })();
