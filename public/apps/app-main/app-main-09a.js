  /* ---- de contactpin: je eigen code, als tekst en als QR ----

     Zoeken op codenaam vraagt dat je iets van de ander AL weet. Een pin draait
     dat om: hij staat op je eigen scherm, je geeft hem af -- voorgelezen,
     gedeeld of voorgehouden -- en pas dan kan iemand er iets mee. De QR draagt
     precies dezelfde pin (rtg:pin:..., zie /shared/rtgcode.js), dus scannen en
     overtypen komen op hetzelfde uit.

     Zoeken en versturen staan met opzet uit elkaar: het scherm laat eerst zien
     WIE er achter de pin zit, en pas daarna is er een knop. Een gescande code
     die meteen een verzoek de deur uit doet, is een verzoek dat niemand
     bewust deed. */
  let mijnPin = null, pinScanner = null;

  function pinBlokVul(){
    const el = $('#scPin'); if (!el) return;
    el.innerHTML =
      '<div class="sc-pin-mijn">' +
        '<div class="sc-pin-kop"><span>' + T('pin.mijn','Jouw RTG PIN') + '</span>' +
          '<b id="scPinCode">' + (mijnPin ? escT(mijnPin.toon) : '·····-·····') + '</b>' +
          '<em id="scPinStatus" class="sc-pin-status">' + T('pin.veilig','beveiligd adres') + '</em></div>' +
        '<div class="sc-pin-belofte">' + T('pin.belofte','Je RTG PIN wijst je aan, maar geeft nooit toegang tot je account, geld of documenten.') + '</div>' +
        '<div class="sc-pin-akt">' +
          '<button id="scPinLive" class="aanbevolen">' + T('pin.live','Tijdelijke QR') + ' · ' + T('pin.aanbev','aanbevolen') + '</button>' +
          '<button id="scPinKopie">' + T('pin.kopieer','Kopieer') + '</button>' +
          '<button id="scPinQr">' + T('pin.qr','Vaste QR') + '</button>' +
          '<button id="scPinNieuw">' + T('pin.nieuw','Nieuwe pin') + '</button>' +
          '<button id="scPinUit">' + (mijnPin && mijnPin.uit ? T('pin.aan','Pin aanzetten') : T('pin.uit','Pin uitzetten')) + '</button>' +
          '<button id="scPinNood" class="gevaar">' + T('pin.nood','Noodslot') + '</button>' +
        '</div>' +
        '<img id="scPinQrBeeld" alt="' + T('pin.qralt','QR-code met jouw pin') + '" hidden>' +
        '<div id="scPinLiveDoek" hidden></div>' +
        '<div id="scPinUitNoot" class="sc-pin-noot"' + (mijnPin && mijnPin.uit ? '' : ' hidden') + '>' +
          T('pin.uitnoot','Je vaste pin staat uit: niemand kan je er nog mee toevoegen. Een live code werkt wel: die houd je bewust op.') + '</div>' +
        '<div id="scPinNoodNoot" class="sc-pin-noot alarm" hidden>' +
          T('pin.noodnoot','Noodslot actief: vaste én tijdelijke PIN-handelingen zijn geblokkeerd. Bestaande vrienden blijven behouden.') + '</div>' +
        '<div id="scPinHistorie" class="sc-pin-historie"></div>' +
      '</div>' +
      '<div class="sc-zoek open">' +
        '<input id="scPinIn" maxlength="13" autocapitalize="characters" spellcheck="false" placeholder="' + T('pin.ph','RTG PIN, bijv. 7K2M9-XPQH3') + '">' +
        '<button id="scPinGo">' + T('pin.zoek','Zoek') + '</button>' +
        '<button id="scPinScan" class="grijs">' + T('pin.scan','Scan') + '</button>' +
      '</div>' +
      '<video id="scPinCam" playsinline muted hidden></video>' +
      '<div class="sc-res" id="scPinRes"></div>';
    $('#scPinKopie').addEventListener('click', pinKopieer);
    $('#scPinQr').addEventListener('click', pinQrWissel);
    $('#scPinNieuw').addEventListener('click', pinNieuw);
    $('#scPinLive').addEventListener('click', pinLiveWissel);
    $('#scPinUit').addEventListener('click', pinUitWissel);
    $('#scPinNood').addEventListener('click', pinNoodslotWissel);
    $('#scPinGo').addEventListener('click', () => pinOpzoeken($('#scPinIn').value));
    $('#scPinScan').addEventListener('click', pinScanWissel);
    $('#scPinIn').addEventListener('keydown', e => { if (e.key === 'Enter') pinOpzoeken($('#scPinIn').value); });
    if (!mijnPin) pinHalen();
  }

  /* Scannen: het beeld verlaat het toestel niet -- elk frame wordt lokaal
     ontleed (/shared/scanner.js). Een gescande code die geen RTG-pin is, zegt
     dat gewoon; we sturen hem nergens heen. */
  function pinScanWissel(){
    if (pinScanner) { pinScanUit(); return; }
    if (!window.RTGScanner) { toast(T('pin.scanniet','Scannen kan hier niet. Typ de pin over.')); return; }
    const cam = $('#scPinCam'); if (!cam) return;
    cam.hidden = false;
    pinScanner = new RTGScanner.Scanner({ video: cam, onCode: c => {
      const g = window.RTGCode ? RTGCode.lees(c.tekst) : { soort: 'tekst', tekst: c.tekst };
      /* Twee soorten, want er zijn er twee: de vaste pin staat leesbaar in de
         code (rtg:pin:...), de levende is een ondertekend token (RTG1....) dat
         alleen de server kan duiden. Voor wie scant is dat hetzelfde gebaar. */
      if (g.soort === 'rtg1') { pinScanUit(); pinLiveKijken(g.token); return; }
      if (g.soort !== 'pin') { toast(T('pin.geenpin','Dit is geen RTG-pin.')); return; }
      pinScanUit();
      $('#scPinIn').value = g.pin;
      pinOpzoeken(g.pin);
    } });
    pinScanner.start().catch(() => { toast(T('pin.camniet','Geen toegang tot de camera.')); pinScanUit(); });
    $('#scPinScan').textContent = T('pin.scanstop','Stop');
  }
  function pinScanUit(){
    // ook de levende code stopt hier: hij ververst zichzelf elke 45 seconden;
    // hoort niet door te lopen in een la die dicht is of een balk die weg is
    pinLiveUit();
    if (pinScanner) { try { pinScanner.stop(); } catch(e){} pinScanner = null; }
    const cam = $('#scPinCam'); if (cam) cam.hidden = true;
    const knop = $('#scPinScan'); if (knop) knop.textContent = T('pin.scan','Scan');
  }

  // stap 1: wie is dit? (nog niets versturen)
  /* De trefferregel, EEN KEER. Hij stond hier en in ./app-main-09a2.js in twee
     kopieen die alleen in de knop verschilden -- en dat is precies het soort
     verdubbeling dat een half jaar later uit elkaar loopt, met een vaste pin
     die "verbonden" zegt waar de levende code "vriend" zegt. De opmaak zit nu
     in klassen (zie .sc-st in apps/app.html) in plaats van in style-attributen;
     die houden style-src-attr in de CSP open. */
  function pinRegel(codename, status, knopHtml){
    const staat = status === 'verbonden' ? '<span class="sc-st ok">✓ ' + T('sal.isverbonden','verbonden') + '</span>'
      : status === 'aangevraagd' ? '<span class="sc-st">' + T('sal.gevraagd','aangevraagd') + '</span>'
      : status === 'geen' ? knopHtml
      : '<span class="sc-st wacht">' + T('sal.wachtu','wacht op u') + '</span>';
    return '<div class="sc-hit"><span class="sc-av klein">' + initCN(codename) + '</span><b>' +
      escT(codename) + '</b>' + staat + '</div>';
  }
  const pinMelding = tekst => '<div class="sc-hit"><span class="sc-st">' + escT(tekst) + '</span></div>';

  async function pinOpzoeken(ruw){
    const res = $('#scPinRes'); if (!res) return;
    const pin = String(ruw || '').trim();
    if (!pin) return;
    res.innerHTML = '';
    let d;
    try { d = await API.call('/member/pin/zoek', { pin }); }
    catch(e){ res.innerHTML = pinMelding(e.message); return; }
    res.innerHTML = pinRegel(d.codename, d.status,
      '<button data-pinvz="' + escT(pin) + '" data-pinbevestig="' + escT(d.bevestiging) + '">' + T('sal.verzoek','Verzoek sturen') + '</button>');
    const b = res.querySelector('[data-pinvz]');
    if (b) b.addEventListener('click', () => pinVerbinden(b.dataset.pinvz, b.dataset.pinbevestig));
  }
  /* stap 2: en nu pas versturen -- omdat een mens erop drukte.

     GEEN loadSocial() erna, en dat is geen vergeetachtigheid. renderSocialBar
     bouwt de hele balk opnieuw op (innerHTML), dus die la klapt eronder dicht
     terwijl je er nog in staat -- en de regel die net "aangevraagd" ging zeggen
     is dan al weg. De regel zelf werken we hieronder bij; een verstuurd verzoek
     verandert aan de vriendenlijst nog niets, dus er valt ook niets te
     verversen. Zoeken op codenaam doet het om dezelfde reden zo. */
  async function pinVerbinden(pin, bevestiging){
    try { await API.call('/member/pin/connect', { pin, bevestiging }); }
    catch(e){ toast(e.message); return; }
    toast(T('sal.verzonden','Verzoek verstuurd.'));
    await pinOpzoeken(pin);
  }
