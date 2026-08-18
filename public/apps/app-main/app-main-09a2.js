  /* ---- de levende code en de aan/uit-schakelaar ----

     De vaste pin uit ./app-main-09a.js is een adres: hij blijft werken, ook als
     je allang niet meer weet aan wie je hem gaf. Dat is precies wat je wilt
     wanneer hij in je profiel staat, en precies wat je NIET wilt wanneer je
     tegenover iemand staat. Daar hoort een code bij die na een minuut niets
     meer is en je pin niet eens draagt (server/kern/sociaal/pin-live.js).

     De toner is dezelfde als die van de RTG-code (/shared/dyncode.js): hij
     tekent, telt af en haalt net voor het verval vanzelf een verse. Alleen de
     deur is een andere, want bij een contactcode bepaalt de SERVER wat erin
     komt te staan -- de client mag daar niets over te zeggen hebben. */
  let pinLive = null;

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
    pinLive = RTGDyn.plaats(doek, { pad: '/api/member/pin/live', lijf: {}, ttlMs: 60000, schaal: 6 });
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
    try { d = await API.call('/member/pin/live/kijk', { token }); }
    catch(e){ res.innerHTML = '<div class="sc-hit"><span style="color:var(--soft);font-size:0.78rem;">' + escT(e.message) + '</span></div>'; return; }
    const knop = d.status === 'geen'
      ? '<button data-pinlv="1">' + T('sal.verzoek','Verzoek sturen') + '</button>'
      : d.status === 'verbonden' ? '<span style="color:var(--green,#2E7D4F);font-size:0.72rem;">✓ ' + T('sal.isverbonden','verbonden') + '</span>'
      : d.status === 'aangevraagd' ? '<span style="color:var(--soft);font-size:0.72rem;">' + T('sal.gevraagd','aangevraagd') + '</span>'
      : '<span style="color:var(--gold);font-size:0.72rem;">' + T('sal.wachtu','wacht op u') + '</span>';
    res.innerHTML = '<div class="sc-hit"><span class="sc-av" style="width:34px;height:34px;font-size:0.7rem;">' +
      initCN(d.codename) + '</span><b>' + escT(d.codename) + '</b>' + knop + '</div>';
    const b = res.querySelector('[data-pinlv]');
    if (b) b.addEventListener('click', async () => {
      try { await API.call('/member/pin/live/verbind', { token }); }
      catch(e){ toast(e.message); return; }
      toast(T('sal.verzonden','Verzoek verstuurd.'));
      b.replaceWith(Object.assign(document.createElement('span'),
        { className: '', textContent: '✓ ' + T('sal.gevraagd','aangevraagd'), style: 'color:var(--soft);font-size:0.72rem;' }));
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
    try { mijnPin = await API.call('/member/pin/uit', { uit }); } catch(e){ toast(e.message); return; }
    pinStandTonen();
    toast(uit ? T('pin.uitok','Je pin staat uit.') : T('pin.aanok','Je pin staat weer aan.'));
  }

