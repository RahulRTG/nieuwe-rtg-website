  /* ---- de levende code en de aan/uit-schakelaar ----

     De vaste pin uit ./app-main-09a.js is een adres: hij blijft werken, ook als
     je allang niet meer weet aan wie je hem gaf. Dat is precies wat je wilt
     wanneer hij in je profiel staat, en precies wat je NIET wilt wanneer je
     tegenover iemand staat. Daar hoort een code bij die na 45 seconden niets
     meer is en je pin niet eens draagt (server/kern/sociaal/pin-live.js).

     De toner is dezelfde als die van de RTG-code (/shared/dyncode.js): hij
     tekent, telt af en haalt net voor het verval vanzelf een verse. Alleen de
     deur is een andere, want bij een contactcode bepaalt de SERVER wat erin
     komt te staan -- de client mag daar niets over te zeggen hebben. */
  let pinLive = null;

  /* Gevoelige wijzigingen worden, zodra het account een passkey heeft, aan
     precies deze handeling gebonden. Geen herbruikbaar "2FA was recent"-vinkje:
     vernieuwen, noodslot opheffen en het vaste adres weer aanzetten krijgen elk
     hun eigen eenmalige WebAuthn-challenge. */
  async function pinPasskeyBewijs(actie){
    const o = await API.call('/member/pin/actie/opties', { actie });
    if (!o.nodig) return {};
    if (!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.get))
      throw new Error(T('pin.pkgeen','Deze wijziging vraagt je passkey. Open dit op een toestel met je Face ID, vingerafdruk of beveiligingssleutel.'));
    const b2u = s => Uint8Array.from(atob(String(s).replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
    const u2b = buf => btoa(String.fromCharCode.apply(null,new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const pub = o.opties;
    pub.challenge = b2u(pub.challenge);
    pub.allowCredentials = (pub.allowCredentials || []).map(c => Object.assign({},c,{ id:b2u(c.id) }));
    const cred = await navigator.credentials.get({ publicKey:pub });
    const antwoord = { id:cred.id, rawId:u2b(cred.rawId), type:cred.type,
      clientExtensionResults:cred.getClientExtensionResults(), response:{
        authenticatorData:u2b(cred.response.authenticatorData), clientDataJSON:u2b(cred.response.clientDataJSON),
        signature:u2b(cred.response.signature), userHandle:cred.response.userHandle?u2b(cred.response.userHandle):null } };
    return { ceremonie:o.ceremonie, antwoord };
  }

  function pinLiveWissel(){
    const doek = $('#scPinLiveDoek'); if (!doek) return;
    if (pinLive) { pinLiveUit(); return; }
    if (!window.RTGDyn || !window.RTGQRteken) { toast(T('pin.qrniet','De QR-code kan hier niet getekend worden.')); return; }
    // de vaste QR en de levende code delen een plek: twee codes naast elkaar
    // is precies de verwarring die dit onderscheid juist moet wegnemen
    const beeld = $('#scPinQrBeeld'); if (beeld) beeld.hidden = true;
    doek.hidden = false;
    // het volledige pad, want RTGDyn praat rechtstreeks met fetch en niet via
    // API.call (die zet er zelf /api voor)
    pinLive = RTGDyn.plaats(doek, { pad: '/api/member/pin/live', lijf: {}, ttlMs: 45000, schaal: 6 });
    $('#scPinLive').textContent = T('pin.livestop','Verberg live code');
  }
  function pinLiveUit(){
    if (pinLive) { try { pinLive.stop(); } catch(e){} pinLive = null; }
    const doek = $('#scPinLiveDoek'); if (doek) { doek.hidden = true; doek.innerHTML = ''; }
    const knop = $('#scPinLive'); if (knop) knop.textContent = T('pin.live','Live code');
  }

  /* Een gescande levende code. Zelfde volgorde als bij de vaste pin: eerst zien
     wie het is, dan pas een knop -- en de code gaat pas op bij het verbinden,
     zodat een blik op de verkeerde persoon niet andermans code verbrandt.
     De sleutel komt hier niet mee terug: de code zelf is het bewijs, dus het
     scherm hoeft nooit te weten hoe iemand in de database heet. */
  async function pinLiveKijken(token){
    const res = $('#scPinRes'); if (!res) return;
    res.innerHTML = '';
    let d;
    try { d = await API.call('/member/pin/live/kijk', { livecode: token }); }
    catch(e){ res.innerHTML = pinMelding(e.message); return; }
    // dezelfde regel als bij de vaste pin (pinRegel in ./app-main-09a.js): het
    // is dezelfde mens en dezelfde stand, alleen langs een andere weg gevonden
    res.innerHTML = pinRegel(d.codename, d.status,
      '<button data-pinlv="1" data-pinbevestig="' + escT(d.bevestiging) + '">' + T('sal.verzoek','Verzoek sturen') + '</button>');
    const b = res.querySelector('[data-pinlv]');
    if (b) b.addEventListener('click', async () => {
      try { await API.call('/member/pin/live/verbind', { livecode: token, bevestiging: b.dataset.pinbevestig }); }
      catch(e){ toast(e.message); return; }
      toast(T('sal.verzonden','Verzoek verstuurd.'));
      b.replaceWith(Object.assign(document.createElement('span'),
        { className: 'sc-st', textContent: '✓ ' + T('sal.gevraagd','aangevraagd') }));
    });
  }

  /* De pin uitzetten. Vernieuwen helpt tegen een pin die is rondgegaan; dit is
     het andere verzoek -- ik wil helemaal niet zo gevonden worden. Het scherm
     zegt er meteen bij wat er dan nog wel werkt, want een schakelaar die meer
     uitzet dan je denkt is erger dan geen schakelaar. */
  async function pinUitWissel(){
    if (!mijnPin) return;
    const uit = !mijnPin.uit;
    if (uit && !confirm(T('pin.uitvraag','Je vaste pin uitzetten? Niemand kan je er dan nog mee toevoegen. Je vrienden merken er niets van, en een live code werkt gewoon.'))) return;
    try {
      const bewijs = uit ? {} : await pinPasskeyBewijs('rtg-pin-vast-aan');
      mijnPin = await API.call('/member/pin/uit', Object.assign({ uit }, bewijs));
    } catch(e){ toast(e.message); return; }
    pinStandTonen();
    toast(uit ? T('pin.uitok','Je pin staat uit.') : T('pin.aanok','Je pin staat weer aan.'));
  }

  /* Het noodslot is expres een andere handeling dan de vaste pin uitzetten:
     dit blokkeert ook levende codes en alle nieuwe uitgaande PIN-handelingen.
     Aanzetten moet altijd snel kunnen; opheffen vraagt een expliciete tweede
     bevestiging en blijft zichtbaar in het veiligheidsjournaal. */
  async function pinNoodslotWissel(){
    if (!mijnPin) return;
    const aan = !mijnPin.bevroren;
    const vraag = aan
      ? T('pin.noodvraag','Noodslot aanzetten? Alle nieuwe vaste en tijdelijke RTG PIN-handelingen stoppen onmiddellijk. Bestaande vrienden blijven behouden.')
      : T('pin.nooduitvraag','Noodslot opheffen? Controleer eerst of je account en apparaten veilig zijn.');
    if (!confirm(vraag)) return;
    try {
      const bewijs = aan ? {} : await pinPasskeyBewijs('rtg-pin-noodslot-uit');
      mijnPin = await API.call('/member/pin/uit', Object.assign({ bevroren: aan }, bewijs));
    }
    catch(e){ toast(e.message); return; }
    if (aan) pinLiveUit();
    pinStandTonen();
    toast(aan ? T('pin.noodok','Noodslot actief.') : T('pin.nooduitok','Noodslot opgeheven.'));
  }
