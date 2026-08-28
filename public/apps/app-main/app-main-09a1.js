  /* ---- jouw RTG PIN: stand, veiligheidsjournaal en vaste QR ---- */
  async function pinHalen(){
    try { mijnPin = await API.call('/member/pin', {}); } catch(e){ return; }
    pinStandTonen();
  }
  // een uitgezette pin blijft leesbaar (het is je pin, je mag hem zien) maar
  // draagt zichtbaar dat hij niemand aanwijst
  function pinStandTonen(){
    const c = $('#scPinCode'); if (!c || !mijnPin) return;
    c.textContent = mijnPin.toon;
    c.classList.toggle('uit', !!mijnPin.uit || !!mijnPin.bevroren);
    const u = $('#scPinUit'); if (u) u.textContent = mijnPin.uit ? T('pin.aan','Pin aanzetten') : T('pin.uit','Pin uitzetten');
    const n = $('#scPinUitNoot'); if (n) n.hidden = !mijnPin.uit;
    const nn = $('#scPinNoodNoot'); if (nn) nn.hidden = !mijnPin.bevroren;
    const nk = $('#scPinNood'); if (nk) nk.textContent = mijnPin.bevroren ? T('pin.nooduit','Noodslot opheffen') : T('pin.nood','Noodslot');
    const st = $('#scPinStatus'); if (st) {
      st.textContent = mijnPin.bevroren ? T('pin.dicht','alles geblokkeerd') : mijnPin.uit ? T('pin.vastuit','vast adres uit') : T('pin.veilig','beveiligd adres');
      st.classList.toggle('alarm', !!mijnPin.bevroren);
    }
    pinHistorieTonen();
  }
  function pinHistorieTonen(){
    const vak = $('#scPinHistorie'); if (!vak || !mijnPin) return;
    const regels = (mijnPin.gebeurtenissen || []).slice(0, 5);
    if (!regels.length) { vak.innerHTML = ''; return; }
    const namen = { pin_gemaakt:'RTG PIN aangemaakt', pin_vernieuwd:'RTG PIN vernieuwd', pin_bekeken:'Vaste PIN bekeken',
      pin_verzoek:'Contactverzoek ontvangen', pin_bevestigd:'Contact bevestigd', livecode_gemaakt:'Tijdelijke QR getoond',
      livecode_bekeken:'Tijdelijke QR gescand', livecode_bevestigd:'Tijdelijk contact bevestigd',
      vaste_pin_uit:'Vaste PIN uitgezet', vaste_pin_aan:'Vaste PIN aangezet', noodslot_aan:'Noodslot aangezet', noodslot_uit:'Noodslot opgeheven' };
    vak.innerHTML = '<strong>' + T('pin.historie','Recente veiligheid') + '</strong>' + regels.map(r =>
      '<div><span>' + escT(namen[r.soort] || r.soort) + (r.aantal > 1 ? ' ×' + Number(r.aantal) : '') + '</span><time>' +
      escT(new Date(r.laatst || r.at).toLocaleString()) + '</time></div>').join('');
  }
  async function pinNieuw(){
    if (!confirm(T('pin.nieuwvraag','Een nieuwe pin maken? Wie je oude pin nog heeft, kan je daarmee niet meer toevoegen. Je huidige vrienden merken er niets van.'))) return;
    try {
      const bewijs = await pinPasskeyBewijs('rtg-pin-vernieuw');
      mijnPin = await API.call('/member/pin/nieuw', bewijs);
    } catch(e){ toast(e.message); return; }
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
