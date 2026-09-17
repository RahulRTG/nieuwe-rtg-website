    /* WebAuthn uses the existing challenge, signature check and session path. */
    async function passkeyLogin(){
      if (busy || passkeyAbort) return;
      if (!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.get)) {
        message(()=>T('access.portal.this_browser_cannot_use_a_passkey_here_you_can_sign_in_using_anot','Uw browser ondersteunt hier geen passkey. U kunt inloggen via Andere manier.'),true); return;
      }
      const attempt = ++passkeyAttempt;
      const controller = new AbortController(); passkeyAbort = controller;
      el('agPasskey').disabled = true;
      const b2u = s => Uint8Array.from(atob(String(s).replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
      const u2b = buf => btoa(String.fromCharCode.apply(null,new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      try {
        message(()=>T('access.portal.confirm_on_your_device_that_you_want_to_sign_in','Bevestig op uw apparaat dat u wilt inloggen.'));
        const o = await accessRequest('identity.passkey.challenge',{});
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
        const result = await accessRequest('identity.passkey.verify',{ceremonie:o.ceremonie,antwoord,pasApp:vastePas||undefined});
        await login('rtg',{response:result});
      } catch(e) {
        if (attempt !== passkeyAttempt) return;
        message(()=>e.name === 'NotAllowedError' || e.name === 'AbortError'
          ? T('access.portal.sign_in_was_cancelled_try_again_or_choose_another_way','Het inloggen is geannuleerd. Probeer het opnieuw of kies Andere manier.')
          : T('access.portal.passkey_sign_in_failed_try_again_or_choose_another_way','Inloggen met uw passkey is niet gelukt. Probeer het opnieuw of kies Andere manier.'),true);
      } finally {
        if (attempt === passkeyAttempt) { passkeyAbort=null; waiting(false); }
        el('agPasskey').disabled=false;
      }
    }
