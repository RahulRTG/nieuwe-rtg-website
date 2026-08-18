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
        '<div class="sc-pin-kop"><span>' + T('pin.mijn','Jouw pin') + '</span>' +
          '<b id="scPinCode">' + (mijnPin ? escT(mijnPin.toon) : '····-····') + '</b></div>' +
        '<div class="sc-pin-akt">' +
          '<button id="scPinKopie">' + T('pin.kopieer','Kopieer') + '</button>' +
          '<button id="scPinQr">' + T('pin.qr','Toon QR') + '</button>' +
          '<button id="scPinNieuw">' + T('pin.nieuw','Nieuwe pin') + '</button>' +
        '</div>' +
        '<img id="scPinQrBeeld" alt="' + T('pin.qralt','QR-code met jouw pin') + '" hidden>' +
      '</div>' +
      '<div class="sc-zoek open">' +
        '<input id="scPinIn" maxlength="12" autocapitalize="characters" spellcheck="false" placeholder="' + T('pin.ph','Pin van de ander, bijv. 7K2M-9XPQ') + '">' +
        '<button id="scPinGo">' + T('pin.zoek','Zoek') + '</button>' +
        '<button id="scPinScan" class="grijs">' + T('pin.scan','Scan') + '</button>' +
      '</div>' +
      '<video id="scPinCam" playsinline muted hidden></video>' +
      '<div class="sc-res" id="scPinRes"></div>';
    $('#scPinKopie').addEventListener('click', pinKopieer);
    $('#scPinQr').addEventListener('click', pinQrWissel);
    $('#scPinNieuw').addEventListener('click', pinNieuw);
    $('#scPinGo').addEventListener('click', () => pinOpzoeken($('#scPinIn').value));
    $('#scPinScan').addEventListener('click', pinScanWissel);
    $('#scPinIn').addEventListener('keydown', e => { if (e.key === 'Enter') pinOpzoeken($('#scPinIn').value); });
    if (!mijnPin) pinHalen();
  }

  async function pinHalen(){
    try { mijnPin = await API.call('/member/pin', {}); } catch(e){ return; }
    const c = $('#scPinCode'); if (c) c.textContent = mijnPin.toon;
  }
  async function pinNieuw(){
    if (!confirm(T('pin.nieuwvraag','Een nieuwe pin maken? Wie je oude pin nog heeft, kan je daarmee niet meer toevoegen. Je huidige vrienden merken er niets van.'))) return;
    try { mijnPin = await API.call('/member/pin/nieuw', {}); } catch(e){ toast(e.message); return; }
    $('#scPinCode').textContent = mijnPin.toon;
    const b = $('#scPinQrBeeld'); if (b && !b.hidden) pinQrTeken();
    toast(T('pin.nieuwok','Je hebt een nieuwe pin.'));
  }
  function pinKopieer(){
    if (!mijnPin) return;
    /* Zonder klembord (oudere webweergaven, of een pagina zonder toestemming)
       niet stil mislukken: dan selecteren we de pin zodat hij met de hand te
       kopieren is. Een knop die niets doet en niets zegt is erger dan geen knop. */
    const klaar = () => toast(T('pin.gekopieerd','Pin gekopieerd.'));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(mijnPin.toon).then(klaar, () => pinSelecteer());
    } else pinSelecteer();
  }
  function pinSelecteer(){
    const el = $('#scPinCode'); if (!el || !window.getSelection) return;
    const r = document.createRange(); r.selectNodeContents(el);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    toast(T('pin.selecteer','Kopieer de pin met de hand.'));
  }
  function pinQrWissel(){
    const b = $('#scPinQrBeeld'); if (!b) return;
    if (!b.hidden) { b.hidden = true; return; }
    if (!pinQrTeken()) return;
    b.hidden = false;
  }
  function pinQrTeken(){
    const b = $('#scPinQrBeeld');
    if (!b || !mijnPin || !window.RTGQRteken || !window.RTGCode) { toast(T('pin.qrniet','De QR-code kan hier niet getekend worden.')); return false; }
    try { b.src = RTGQRteken.dataURLRTG(RTGCode.bouwPin(mijnPin.pin), { schaal: 5 }); }
    catch(e){ toast(T('pin.qrniet','De QR-code kan hier niet getekend worden.')); return false; }
    return true;
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
      if (g.soort !== 'pin') { toast(T('pin.geenpin','Dit is geen RTG-pin.')); return; }
      pinScanUit();
      $('#scPinIn').value = g.pin;
      pinOpzoeken(g.pin);
    } });
    pinScanner.start().catch(() => { toast(T('pin.camniet','Geen toegang tot de camera.')); pinScanUit(); });
    $('#scPinScan').textContent = T('pin.scanstop','Stop');
  }
  function pinScanUit(){
    if (pinScanner) { try { pinScanner.stop(); } catch(e){} pinScanner = null; }
    const cam = $('#scPinCam'); if (cam) cam.hidden = true;
    const knop = $('#scPinScan'); if (knop) knop.textContent = T('pin.scan','Scan');
  }

  // stap 1: wie is dit? (nog niets versturen)
  async function pinOpzoeken(ruw){
    const res = $('#scPinRes'); if (!res) return;
    const pin = String(ruw || '').trim();
    if (!pin) return;
    res.innerHTML = '';
    let d;
    try { d = await API.call('/member/pin/zoek', { pin }); }
    catch(e){ res.innerHTML = '<div class="sc-hit"><span style="color:var(--soft);font-size:0.78rem;">' + escT(e.message) + '</span></div>'; return; }
    const knop = d.status === 'geen'
      ? '<button data-pinvz="' + escT(pin) + '">' + T('sal.verzoek','Verzoek sturen') + '</button>'
      : d.status === 'verbonden' ? '<span style="color:var(--green,#2E7D4F);font-size:0.72rem;">✓ ' + T('sal.isverbonden','verbonden') + '</span>'
      : d.status === 'aangevraagd' ? '<span style="color:var(--soft);font-size:0.72rem;">' + T('sal.gevraagd','aangevraagd') + '</span>'
      : '<span style="color:var(--gold);font-size:0.72rem;">' + T('sal.wachtu','wacht op u') + '</span>';
    res.innerHTML = '<div class="sc-hit"><span class="sc-av" style="width:34px;height:34px;font-size:0.7rem;">' +
      initCN(d.codename) + '</span><b>' + escT(d.codename) + '</b>' + knop + '</div>';
    const b = res.querySelector('[data-pinvz]');
    if (b) b.addEventListener('click', () => pinVerbinden(b.dataset.pinvz));
  }
  /* stap 2: en nu pas versturen -- omdat een mens erop drukte.

     GEEN loadSocial() erna, en dat is geen vergeetachtigheid. renderSocialBar
     bouwt de hele balk opnieuw op (innerHTML), dus die la klapt eronder dicht
     terwijl je er nog in staat -- en de regel die net "aangevraagd" ging zeggen
     is dan al weg. De regel zelf werken we hieronder bij; een verstuurd verzoek
     verandert aan de vriendenlijst nog niets, dus er valt ook niets te
     verversen. Zoeken op codenaam doet het om dezelfde reden zo. */
  async function pinVerbinden(pin){
    try { await API.call('/member/pin/connect', { pin }); }
    catch(e){ toast(e.message); return; }
    toast(T('sal.verzonden','Verzoek verstuurd.'));
    await pinOpzoeken(pin);
  }

