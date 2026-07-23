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

  /* ---------- home + codenaam ---------- */

  function qrSvg(seed){
    let s = seed, cells = '';
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++){
      const corner = (x < 4 && y < 4) || (x > 8 && y < 4) || (x < 4 && y > 8);
      const on = corner
        ? ((x % 12 < 1 || x % 12 > 2 ? 1 : 0) || (y % 12 < 1 || y % 12 > 2 ? 1 : 0)) &&
          !((x % 12 === 1 || x % 12 === 2) && (y % 12 === 1 || y % 12 === 2)) || (x===1&&y===1)||(x===2&&y===2)||(x===11&&y===1)||(x===1&&y===11)
        : rnd() > 0.5;
      if (on) cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
    }
    return '<svg viewBox="0 0 13 13" xmlns="http://www.w3.org/2000/svg" fill="#0C0C0B">' + cells + '</svg>';
  }

  function toggleWhy(forceOpen){
    const why = document.querySelector('.codecard .why');
    if (!why) return;
    why.classList.toggle('open', forceOpen === true ? true : !why.classList.contains('open'));
  }

  function renderVerifyBanner(){
    const el = $('#verifyBanner');
    if (!el) return;
    const v = user && user.account ? user.verified : null;
    if (!user || !user.account || v === 'verified'){ el.innerHTML = ''; return; }
    if (v === 'pending'){
      el.innerHTML = '<div class="vbanner pending"><b>'+T('vf.pending.h','Verificatie in behandeling')+'</b><span>'+T('vf.pending.b','We controleren uw document. U kunt de app gewoon blijven gebruiken.')+'</span>'+
        '<button class="vbtn" id="selfieStart" style="margin-top:0.5rem;">'+T('vf.selfie','Selfie toevoegen (gezichtscontrole)')+'</button></div>';
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
    if (open.length) html += open.map(v => '<div class="vbanner" style="border-color:var(--gold,#c9a227);">' +
      '<b>'+esc(v.supplierName)+' '+T('pi.vraagt','vraagt uw')+' '+T('pi.n.'+v.niveau, v.niveau)+'</b>' +
      '<span>'+(v.reden?esc(v.reden)+' · ':'')+T('pi.uitleg','U beslist. Bij goedkeuren ziet de partner dit 10 minuten; daarna vervalt het vanzelf.')+'</span>' +
      '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;"><button class="vbtn" data-pigo="'+v.id+'">'+T('pi.goed','Goedkeuren')+'</button>' +
      '<button class="vbtn" data-piweiger="'+v.id+'" style="background:none;border:1px solid var(--line);color:var(--txt);">'+T('pi.weiger','Weigeren')+'</button></div></div>').join('');
    if (lopend.length) html += lopend.map(v => '<div class="vbanner pending"><b>'+esc(v.supplierName)+' · '+T('pi.n.'+v.niveau, v.niveau)+' '+T('pi.gedeeld','gedeeld')+'</b>' +
      '<span>'+T('pi.lopend','De inzage loopt. U kunt hem intrekken.')+'</span>' +
      '<button class="vbtn" data-pitrek="'+v.id+'" style="margin-top:0.4rem;background:none;border:1px solid var(--line);color:var(--txt);">'+T('pi.trek','Intrekken')+'</button></div>').join('');
    el.innerHTML = html;
    el.querySelectorAll('[data-pigo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/paspoort/beslis', { id: b.dataset.pigo, akkoord: true }); toast(T('pi.goedok','Goedgekeurd.')); await laadPaspoortInbox(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-piweiger]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/paspoort/beslis', { id: b.dataset.piweiger, akkoord: false }); toast(T('pi.weigerok','Geweigerd.')); await laadPaspoortInbox(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-pitrek]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/paspoort/trek-in', { id: b.dataset.pitrek }); toast(T('pi.trekok','Ingetrokken.')); await laadPaspoortInbox(); } catch(e){ toast(e.message); }
    }));
  }

  function renderHome(){
    renderVerifyBanner();
    laadPaspoortInbox();
    // gratis gebruiker (zonder pas): beperkte, veilige startpagina
    if (user.tier === 'guest'){ renderHomeGuest(); return; }
    const first = user.full.split(' ')[0];
    const E = Util.el; // componentframework voor de kaarten hieronder
    // de stem volgt de pas van het ingelogde lid (niet alleen de ingang)
    document.documentElement.setAttribute('data-stem', user.tier);
    stemKoppen();
    $('#homeGreeting').textContent = stem(
      'Ha ' + first + ', goed je te zien.',
      'Dag ' + first + '. Alles onder controle.',
      'Welkom terug, ' + first + '. Alles staat voor u klaar.'
    ) || (T('app.welcome','Welkom,') + ' ' + first + '.');
    $('#homeSub').textContent = TIER_LABEL[user.tier] + ' · ' + T('app.membersince','lid sinds') + ' ' + user.since;

    // De codecard met Util.el: codenaam, lidnummer en leeftijdsgroep gaan
    // structureel als tekstknoop. De QR is gegenereerd (geen gebruikerstekst) en
    // blijft als kant-en-klare SVG in een eigen container.
