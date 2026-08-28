/* sparren met Rahul, en de geparkeerde gedachten */
    catch(e){ toast(e.message); }
  }));

  /* Het "Sparren met Rahul"-blok in het Rahul-paneel: samen een idee beter
     maken (niet om zijn gelijk te halen), en geparkeerde gedachten waar hij op
     een rustig moment op terugkomt. Als losse helper afgesplitst van
     30-live-menu-werk-03.js, zodat beide parts in de 5-10 KB-band blijven. */
  function sparBlokHtml(sparLijst){
    return '<div style="margin-top:0.75rem;border-top:1px solid var(--line);padding-top:0.6rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">' + T('spar.h','Sparren met Rahul') + '</div>' +
      '<div style="font-size:0.68rem;color:var(--soft);margin-top:0.25rem;">' + T('spar.d','Hij denkt mee om je idee beter te maken, niet om zijn gelijk te halen. Parkeer een gedachte; als je rustig thuis bent met een lege agenda komt hij er zelf op terug.') + '</div>' +
      ((sparLijst || []).length
        ? '<div style="display:flex;flex-direction:column;gap:0.4rem;margin-top:0.5rem;">' + sparLijst.map(s =>
            '<div style="border:1px solid var(--line);border-radius:0;padding:0.5rem 0.65rem;">' +
            '<div style="font-size:0.78rem;line-height:1.4;">' + esc(s.tekst) + '</div>' +
            '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;">' +
              '<button class="chip js-sparchat" data-t="' + esc(s.tekst) + '" style="font-size:0.68rem;">' + T('spar.nu','Spar nu') + '</button>' +
              '<button class="chip js-spardone" data-id="' + esc(s.id) + '" style="font-size:0.68rem;">✓ ' + T('spar.klaar','Besproken') + '</button>' +
              '<button class="chip js-sparweg" data-id="' + esc(s.id) + '" style="font-size:0.68rem;">✕ ' + T('spar.weg','Weg') + '</button>' +
            '</div></div>').join('') + '</div>'
        : '') +
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;">' +
        '<input id="sparIn" placeholder="' + T('spar.plho','Waar wil je later over sparren?') + '" style="flex:1;min-width:0;background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:0;padding:0.45rem 0.65rem;font-size:0.76rem;color:var(--txt);outline:none;font-family:inherit;">' +
        '<button class="chip" id="sparPark" style="flex-shrink:0;">' + T('spar.park','Parkeer') + '</button>' +
      '</div>' +
    '</div>';
  }
  function bindSparBlok(el){
    // nu erover praten, of het onderwerp als besproken/weg zetten
    el.querySelectorAll('.js-sparchat').forEach(b => b.addEventListener('click', () => {
      const tegel = document.querySelector('.os-app[data-tab="ai"]'); if (tegel) tegel.click();
      // idem: `ask` bestond nooit, dus dit vulde de vraag nooit in
      if (window.RTGVraag) RTGVraag(T('spar.over','Spar met me over') + ': ' + b.dataset.t);
    }));
    el.querySelectorAll('.js-spardone').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/spar/status', { id: b.dataset.id, status: 'besproken' }); renderFluister(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-sparweg').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/spar/status', { id: b.dataset.id, status: 'weg' }); renderFluister(); } catch(e){ toast(e.message); }
    }));
    const sparPark = el.querySelector('#sparPark'), sparIn = el.querySelector('#sparIn');
    if (sparPark && sparIn) {
      const park = async () => {
        const tekst = sparIn.value.trim(); if (!tekst) return;
        try { await API.call('/spar/parkeer', { tekst }); sparIn.value = ''; toast('' + T('spar.geparkeerd','Geparkeerd. Rahul komt er op een rustig moment op terug.')); renderFluister(); } catch(e){ toast(e.message); }
      };
      sparPark.addEventListener('click', park);
      sparIn.addEventListener('keydown', e => { if (e.key === 'Enter') park(); });
    }
  }
  /* ---------- oplichtend ophaalcode-scherm ---------- */
  function showGlow(o){
    $('#gcSup').textContent = o.supplierName;
    $('#gcCode').textContent = o.pickup;
    // een echte, scanbare QR van de ophaalcode: de kassa scant hem, of typt de code
    const qh = $('#gcQr');
    if (qh){
      qh.innerHTML = ''; qh.style.display = 'none';
      if (window.RTGQRteken && o.pickup){
        try { qh.appendChild(RTGQRteken.teken(String(o.pickup), { schaal: 5, ecc: 'M' })); qh.style.display = 'inline-block'; } catch(e){}
      }
    }
    $('#glowCode').classList.add('open');
  }
  $('#glowCode').addEventListener('click', () => $('#glowCode').classList.remove('open'));

  /* ---------- home ---------- */

  function renderVerifyBanner(){
    const el = $('#verifyBanner');
    if (!el) return;
    const v = user && user.account ? user.verified : null;
    if (!user || !user.account || v === 'verified'){ el.innerHTML = ''; return; }
    if (v === 'pending'){
      el.innerHTML = '<div class="vbanner pending"><b>'+T('vf.pending.h','Verificatie in behandeling')+'</b><span>'+T('vf.pending.b','We controleren uw document. U kunt de app gewoon blijven gebruiken.')+'</span>'+
        '<button class="vbtn h-mt50" id="selfieStart">'+T('vf.selfie','Selfie toevoegen (gezichtscontrole)')+'</button></div>';
      const sb = $('#selfieStart'); if (sb) sb.addEventListener('click', () => $('#selfieFile').click());
      return;
    }
    el.innerHTML = '<div class="vbanner"><b>'+T('vf.h','Verifieer uw identiteit, boek in één tik')+'</b>' +
      '<span>'+T('vf.b','Eén foto van de voorkant van uw paspoort plus een selfie. Zo weet RTG zeker dat u het bent (gezicht x paspoort), houden we nepaccounts buiten, en boekt u daarna zonder gedoe. Uw gegevens zijn alleen zichtbaar voor RTG.')+'</span>' +
      '<button class="vbtn" id="verifyStart">'+T('vf.btn','Document uploaden')+'</button></div>';
    $('#verifyStart').addEventListener('click', () => $('#verifyFile').click());
  }
  (function initVerifyUpload(){
    const vf = document.getElementById('verifyFile');
    if (!vf) return;
    vf.addEventListener('change', () => {
      const file = vf.files[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024){ toast(T('vf.toobig','Bestand te groot (max 5 MB).')); vf.value=''; return; }
      const reader = new FileReader();
      reader.onload = async () => {
        try { await API.call('/verify/upload', { image: reader.result }); user.verified = 'pending'; renderVerifyBanner(); toast(T('vf.sent','Document ontvangen, we controleren het.')); }
        catch (e){ toast(e.message || 'Upload mislukt.'); }
      };
      reader.readAsDataURL(file);
      vf.value = '';
    });
    const sf = document.getElementById('selfieFile');
    if (sf) sf.addEventListener('change', () => {
      const file = sf.files[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024){ toast(T('vf.toobig','Bestand te groot (max 5 MB).')); sf.value=''; return; }
      const reader = new FileReader();
      reader.onload = async () => {
        try { await API.call('/verify/selfie', { image: reader.result }); toast(T('vf.selfieok','Selfie ontvangen. RTG controleert het gezicht bij uw paspoort.')); }
        catch (e){ toast(e.message || 'Upload mislukt.'); }
      };
      reader.readAsDataURL(file);
      sf.value = '';
    });
  })();

  /* ---- paspoortverzoeken: een partner vroeg uw identiteit op (u beslist) ---- */
  let paspoortInboxData = null;
  async function laadPaspoortInbox(){
    if (!user || !user.account){ const el = $('#paspoortInbox'); if (el) el.innerHTML = ''; return; }
    try { paspoortInboxData = await API.call('/paspoort/mijn', {}); } catch(e){ paspoortInboxData = null; }
    renderPaspoortInbox();
  }
  function renderPaspoortInbox(){
    const el = $('#paspoortInbox'); if (!el) return;
    if (!user || !user.account){ el.innerHTML = ''; return; }
    if (!paspoortInboxData){ laadPaspoortInbox(); return; }
    const open = (paspoortInboxData.verzoeken || []).filter(v => v.status === 'aangevraagd');
    const lopend = (paspoortInboxData.verzoeken || []).filter(v => v.status === 'goedgekeurd');
    let html = '';
