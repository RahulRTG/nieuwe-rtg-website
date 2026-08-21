
    // een zin, geen logboek: Rahuls woorden vervangen elkaar rustig
    function zeg(wie, tekst){
      if (wie !== 'rahul') return;
      /* De zin staat er METEEN, niet letter voor letter. Dat typen was mooi
         bedoeld, maar aan de poort staat iemand die naar binnen wil: die leest
         sneller dan de machine tikt, en zit dan te wachten op tekst die er al
         is. De mond beweegt wel gewoon mee -- dat is Rahuls gezicht, geen
         leesvertraging. */
      zin.style.animation = 'none';
      void zin.offsetWidth;              // de fade opnieuw laten lopen
      zin.style.animation = '';
      zin.textContent = tekst;
      praat(Math.min(2600, 500 + tekst.length * 28));
    }
    /* De ballotage-regalia volgen de metadata van de server: `voortgang`
       {nr, van} toont de kop en de Romeinse plaatsbepaling, `vertrouwelijk`
       de kluisregel. Geen metadata (het open gesprek, de inlog, het einde) =
       alles weer stil. De teksten lopen via T() mee met de taalkiezer. */
    const kopEl = doos.querySelector('#agKop');
    const stappenEl = doos.querySelector('#agStappen');
    const kluisEl = doos.querySelector('#agKluis');
    const ROMEINS = ['I', 'II', 'III', 'IV', 'V', 'VI'];
    function toonVoortgang(d){
      const v = d && d.voortgang;
      const entree = d && (d.entree || d.login) && !d.ingelogd;
      if (v && v.nr && !d.klaar){
        if (kopEl) kopEl.textContent = T('ag.ballotage','De ballotage');
        if (stappenEl){
          stappenEl.textContent = '';
          for (let i = 1; i <= (v.van || 4); i++){
            const s = document.createElement('span');
            s.textContent = ROMEINS[i - 1] || String(i);
            if (i === v.nr) s.className = 'nu';
            else if (i < v.nr) s.className = 'gehad';
            stappenEl.appendChild(s);
          }
        }
        doos.classList.add('ag-ballotage');
      } else if (entree){
        // het spiegelbeeld voor wie al lid is: dezelfde kopregel-taal,
        // zonder stappen (thuiskomen is geen procedure)
        if (kopEl) kopEl.textContent = T('ag.entree','De entree');
        if (stappenEl) stappenEl.textContent = '';
        doos.classList.add('ag-ballotage');
      } else {
        doos.classList.remove('ag-ballotage');
      }
      const kluisTekst = d && d.login ? T('ag.kluisdirect','Rechtstreeks naar de kluis, niet door dit gesprek')
        : (d && d.vertrouwelijk ? T('ag.kluis','Versleuteld · rechtstreeks de kluis in') : null);
      if (kluisEl && kluisTekst && !d.klaar){
        kluisEl.textContent = kluisTekst;
        doos.classList.add('ag-kluis-aan');
      } else {
        doos.classList.remove('ag-kluis-aan');
      }
    }
    const pkKnop = doos.querySelector('#agPasskey');
    const andersKnop = doos.querySelector('#agAnders');
    const antwoordRij = inp.closest('.ag-rij');
    let passkeyBezig = false, passkeyAbort = null;
    function toonPasskey(aan){
      if (!pkKnop) return;
      pkKnop.hidden = !aan;
      // het label pas hier vertalen: bij het bouwen van de poort is de i18n
      // soms nog niet geladen
      if (aan){ const s = pkKnop.querySelector('span'); if (s) s.textContent = T('ag.pk.open','Open met Face ID of passkey'); }
    }
    function wachtwoordVeld(placeholder){
      inp.type = 'password';
      inp.placeholder = placeholder || T('ag.ww','Je wachtwoord');
      // wie herkend is (loginU) mag ook met Face ID / vingerafdruk / sleutel
      toonPasskey(!!loginU);
    }
    function tekstVeld(){
      inp.type = 'text';
      inp.placeholder = T('ag.plho','Ik wil zeggen dat..');
      toonPasskey(false);
    }

    /* RTG Deur: eerst bewijst het toestel wie er staat; pas daarna zoekt de
       server het account bij de credential. Na "Andere manier" kan dezelfde
       functie ook de oude, gerichte passkey van een genoemd account gebruiken. */
    async function passkeyInlog(automatisch){
      if (passkeyBezig) return;
      if (!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.get)){
        zeg('rahul', T('ag.pk.geen','Dit toestel kent geen passkey. Kies Andere manier.')); return;
      }
      const b2u = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
      const u2b = buf => btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      passkeyBezig = true;
      passkeyAbort = window.AbortController ? new AbortController() : null;
      try {
        zeg('rahul', T('ag.pk.vraag','Je toestel vraagt nu om je Face ID, vingerafdruk of sleutel.'));
        const o = await API.call('/webauthn/opties', loginU ? { login: loginU } : {});
        const pub = o.opties; pub.challenge = b2u(pub.challenge);
        pub.allowCredentials = (pub.allowCredentials || []).map(c => Object.assign({}, c, { id: b2u(c.id) }));
        const vraag = { publicKey: pub };
        if (passkeyAbort) vraag.signal = passkeyAbort.signal;
        const cred = await navigator.credentials.get(vraag);
        const antwoord = { id: cred.id, rawId: u2b(cred.rawId), type: cred.type,
          clientExtensionResults: cred.getClientExtensionResults(),
          response: { authenticatorData: u2b(cred.response.authenticatorData), clientDataJSON: u2b(cred.response.clientDataJSON),
            signature: u2b(cred.response.signature), userHandle: cred.response.userHandle ? u2b(cred.response.userHandle) : null } };
        const r = await API.call('/webauthn/login', { login: loginU || undefined, ceremonie: o.ceremonie, antwoord,
          pasApp: vastePas || undefined, lang: document.documentElement.lang || 'nl' });
        passkeyBezig = false; passkeyAbort = null;
        if (r && r.token){
          API.token = r.token; try { localStorage.setItem('rtg_member_token', r.token); } catch(e){}
          zeg('rahul', T('ag.welkom','Daar ben je weer. Welkom terug.'));
          if (typeof restoreSession === 'function') await restoreSession();
        }
      } catch(e){
        passkeyBezig = false; passkeyAbort = null;
        if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')){
          if (!automatisch && e.name !== 'AbortError') zeg('rahul', T('ag.pk.afgebroken','Niet geopend. Probeer opnieuw of kies Andere manier.'));
          return;
        }
        zeg('rahul', (e && e.message ? e.message + ' ' : '') + T('ag.pk.mis','Dat lukte niet met de passkey. Kies Andere manier.'));
      }
    }
    function andereManier(stil){
      if (passkeyAbort) passkeyAbort.abort();
      antwoordRij.hidden = false;
      toonPasskey(false);
      if (andersKnop) andersKnop.hidden = true;
      if (!stil){ start(); inp.focus(); }
    }
    if (pkKnop) pkKnop.addEventListener('click', () => passkeyInlog(false));
    if (andersKnop) andersKnop.addEventListener('click', () => andereManier(false));

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
