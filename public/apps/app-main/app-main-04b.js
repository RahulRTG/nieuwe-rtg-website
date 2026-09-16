    /* WebAuthn uses the existing challenge, signature check and session path. */
    async function passkeyLogin(){
      if (busy || passkeyAbort) return;
      if (!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.get)) {
        message(tx('Uw browser ondersteunt hier geen passkey. U kunt inloggen via Andere manier.','This browser cannot use a passkey here. You can sign in using Another way.'),true); return;
      }
      const attempt = ++passkeyAttempt;
      const controller = new AbortController(); passkeyAbort = controller;
      el('agPasskey').disabled = true;
      const b2u = s => Uint8Array.from(atob(String(s).replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
      const u2b = buf => btoa(String.fromCharCode.apply(null,new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      try {
        message(tx('Bevestig op uw apparaat dat u wilt inloggen.','Confirm on your device that you want to sign in.'));
        const o = await API.call('/webauthn/opties',{});
        if (attempt !== passkeyAttempt) return;
        const pub = o.opties; pub.challenge = b2u(pub.challenge);
        pub.allowCredentials = (pub.allowCredentials || []).map(c=>Object.assign({},c,{id:b2u(c.id)}));
        const cred = await navigator.credentials.get({publicKey:pub,signal:controller.signal});
        if (attempt !== passkeyAttempt) return;
        const antwoord = { id:cred.id,rawId:u2b(cred.rawId),type:cred.type,
          clientExtensionResults:cred.getClientExtensionResults(),
          response:{authenticatorData:u2b(cred.response.authenticatorData),clientDataJSON:u2b(cred.response.clientDataJSON),
            signature:u2b(cred.response.signature),userHandle:cred.response.userHandle?u2b(cred.response.userHandle):null} };
        // Once the signed proof is submitted, do not offer a competing route.
        waiting(true);
        const result = await API.call('/webauthn/login',{ceremonie:o.ceremonie,antwoord,pasApp:vastePas||undefined});
        await login('rtg',{response:result});
      } catch(e) {
        if (attempt !== passkeyAttempt) return;
        message(e.name === 'NotAllowedError' || e.name === 'AbortError'
          ? tx('Het inloggen is geannuleerd. Probeer het opnieuw of kies Andere manier.','Sign-in was cancelled. Try again or choose Another way.')
          : tx('Inloggen met uw passkey is niet gelukt. Probeer het opnieuw of kies Andere manier.','Passkey sign-in failed. Try again or choose Another way.'),true);
      } finally {
        if (attempt === passkeyAttempt) { passkeyAbort=null; waiting(false); }
        el('agPasskey').disabled=false;
      }
    }
