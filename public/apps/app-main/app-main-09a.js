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
  let mijnPin = null;

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
          '<button id="scPinLive">' + T('pin.live','Live code') + '</button>' +
          '<button id="scPinUit">' + (mijnPin && mijnPin.uit ? T('pin.aan','Pin aanzetten') : T('pin.uit','Pin uitzetten')) + '</button>' +
        '</div>' +
        '<img id="scPinQrBeeld" alt="' + T('pin.qralt','QR-code met jouw pin') + '" hidden>' +
        '<div id="scPinLiveDoek" hidden></div>' +
        '<div id="scPinUitNoot" class="sc-pin-noot"' + (mijnPin && mijnPin.uit ? '' : ' hidden') + '>' +
          T('pin.uitnoot','Je vaste pin staat uit: niemand kan je er nog mee toevoegen. Een live code werkt wel: die houd je bewust op.') + '</div>' +
      '</div>' +
      '<div class="sc-zoek open">' +
        '<input id="scPinIn" maxlength="12" autocapitalize="characters" spellcheck="false" placeholder="' + T('pin.ph','Pin van de ander, bijv. 7K2M-9XPQ') + '">' +
        '<button id="scPinGo">' + T('pin.zoek','Zoek') + '</button>' +
        '<button id="scPinScan" class="grijs">' + T('pin.scan','Scan') + '</button>' +
      '</div>' +
      '<div class="sc-res" id="scPinRes"></div>';
    $('#scPinKopie').addEventListener('click', pinKopieer);
    $('#scPinQr').addEventListener('click', pinQrWissel);
    $('#scPinNieuw').addEventListener('click', pinNieuw);
    $('#scPinLive').addEventListener('click', pinLiveWissel);
    $('#scPinUit').addEventListener('click', pinUitWissel);
    $('#scPinGo').addEventListener('click', () => pinOpzoeken($('#scPinIn').value));
    $('#scPinScan').addEventListener('click', pinScanOpen);
    $('#scPinIn').addEventListener('keydown', e => { if (e.key === 'Enter') pinOpzoeken($('#scPinIn').value); });
    if (!mijnPin) pinHalen();
  }

  async function pinHalen(){
    try { mijnPin = await API.call('/member/pin', {}); } catch(e){ return; }
    pinStandTonen();
  }
  // een uitgezette pin blijft leesbaar (het is je pin, je mag hem zien) maar
  // draagt zichtbaar dat hij niemand aanwijst
  function pinStandTonen(){
    const c = $('#scPinCode'); if (!c || !mijnPin) return;
    c.textContent = mijnPin.toon;
    c.classList.toggle('uit', !!mijnPin.uit);
    const u = $('#scPinUit'); if (u) u.textContent = mijnPin.uit ? T('pin.aan','Pin aanzetten') : T('pin.uit','Pin uitzetten');
    const n = $('#scPinUitNoot'); if (n) n.hidden = !mijnPin.uit;
  }
  async function pinNieuw(){
    if (!confirm(T('pin.nieuwvraag','Een nieuwe pin maken? Wie je oude pin nog heeft, kan je daarmee niet meer toevoegen. Je huidige vrienden merken er niets van.'))) return;
    try { mijnPin = await API.call('/member/pin/nieuw', {}); } catch(e){ toast(e.message); return; }
    pinStandTonen();
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

  /* Scannen gaat langs de HUISOVERLAY (/shared/scanknop.js). Hier stond een
     eigen camerablad met een RTGScanner eromheen -- de laatste tweede
     uitvoering van iets dat het huis al heeft. Wat dit scherm ermee wint is
     geen netheid maar een uitweg: de overlay draagt altijd een handinvoer, en
     legt uit waarom de camera niet start (buiten https geeft de browser hem
     niet vrij -- op een telefoon de meest voorkomende reden). Het beeld
     verlaat het toestel nog steeds niet.

     Een gescande code die GEEN RTG-pin is, houdt de overlay open: `onCode` mag
     `false` teruggeven. Anders viel het venster dicht op een verkeerde QR en
     moest een mens opnieuw beginnen. */
  function pinScanOpen(){
    if (!window.RTGScanknop) { toast(T('pin.scanniet','Scannen kan hier niet. Typ de pin over.')); return; }
    RTGScanknop.open({
      titel: T('pin.scantitel','Pin scannen'),
      hint: T('pin.scanhint','Richt de camera op de QR van de ander.'),
      handTekst: T('pin.oftyp','Of typ de code'),
      onCode: (c) => {
        const g = window.RTGCode ? RTGCode.lees(c.tekst) : { soort: 'tekst', tekst: c.tekst };
        /* Twee soorten, want er zijn er twee: de vaste pin staat leesbaar in de
           code (rtg:pin:...), de levende is een ondertekend token (RTG1....) dat
           alleen de server kan duiden. Voor wie scant is dat hetzelfde gebaar. */
        if (g.soort === 'rtg1') { pinLiveKijken(g.token); return; }
        if (g.soort !== 'pin') { toast(T('pin.geenpin','Dit is geen RTG-pin.')); return false; }
        $('#scPinIn').value = g.pin;
        pinOpzoeken(g.pin);
      }
    });
  }
  /* Blijft bestaan, en niet als restje: hij stopt de LEVENDE CODE, die zichzelf
     elke minuut ververst en niet hoort door te lopen in een la die dicht is of
     een balk die weg is. Het camerawerk zat er alleen bij in; dat doet de
     overlay nu zelf. */
  function pinScanUit(){
    pinLiveUit();
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
      '<button data-pinvz="' + escT(pin) + '">' + T('sal.verzoek','Verzoek sturen') + '</button>');
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

