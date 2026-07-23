  /* ---------- Onderweg (live reis) ---------- */
  let liveData = null;
  let liveMode = 'driving';
  let simTimer = null;
  const RIDE_ST = { 'wacht-op-betaling':'awaiting payment', 'aangevraagd':'requested', 'geaccepteerd':'confirmed', 'onderweg':'on the way', 'aangekomen':'arrived', 'rijdt':'driving', 'aan-boord':'on board', 'gearriveerd':'completed', 'afgerond':'completed', 'geweigerd':'declined' };
  const tRide = s => (lang() === 'en' ? (RIDE_ST[s] || s) : s);

  async function renderLive(){
    if (!API.live){ $('#livePanel').innerHTML = ''; return; }
    try { liveData = (await API.call('/live/state')).live; }
    catch (e){ $('#livePanel').innerHTML = ''; return; }
    if (!liveData || !liveData.active){ stopSim(); renderLiveStart(); }
    else renderLivePanel();
  }

  function renderLiveStart(){
    const opts = suppliers.map(s => '<option value="' + s.code + '">' + s.name + ' (' + tType(s.typeLabel) + ')</option>').join('');
    const modes = [['walking','Lopen'],['driving','Rijden'],['flying','Vliegen']];
    $('#livePanel').innerHTML =
      '<div class="live-start">' +
        '<div class="lh">' + T('live.start.h','Ergens heen?') + '</div>' +
        '<div class="ld">' + T('live.start.d','Zet uw reis live. Uw partners, uw taxi, het restaurant, zien waar u bent en zorgen dat alles klaarstaat wanneer u aankomt. Altijd op codenaam, nooit op naam.') + '</div>' +
        '<div class="live-dest-row"><select id="liveDest">' + opts + '</select></div>' +
        '<div class="live-mode">' + modes.map(m => '<button data-mode="' + m[0] + '"' + (m[0]===liveMode?' class="on"':'') + '>' + T('live.mode.'+m[0], m[1]) + '</button>').join('') + '</div>' +
        '<button class="live-go" id="liveGo">' + T('live.go','Start onderweg') + '</button>' +
        '<button class="live-go" id="liveDeel" style="margin-top:0.45rem;background:none;border:1px solid var(--line);color:var(--txt);">' + T('live.deel','Deel mijn live locatie met deze zaak') + '</button>' +
        '<div style="margin-top:0.4rem;font-size:0.62rem;color:var(--soft);line-height:1.5;">' + T('live.deel.s','Alleen deze zaak ziet dan waar u bent, tot de zaak het niet meer nodig heeft of u het zelf stopt.') + '</div>' +
      '</div>';
    $('#livePanel').querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      liveMode = b.dataset.mode;
      $('#livePanel').querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x.dataset.mode === liveMode));
    }));
    $('#liveGo').addEventListener('click', startLive);
    const ld = $('#liveDeel');
    if (ld) ld.addEventListener('click', async () => {
      try {
        const r = await API.call('/locatie/deel', { supplierCode: $('#liveDest').value });
        toast('' + r.deel.supplierName + ' ' + T('live.deelok','kijkt nu met u mee, tot het niet meer nodig is.'));
        renderZorg();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- Toren 3: RTG Shared Assets ----------
     Altijd 300 tickets per object; een ticket is 24 uur per jaar, tien jaar
     lang. Access loopt af, Asset heeft restwaarde en stapt uit via een Tik. */
  async function renderAssets(){
    const el = $('#assetsWrap'); if (!el) return;
    if (!API.live){ el.innerHTML = ''; return; }
    let d, mijn;
    try {
      d = await API.call('/assets');
      mijn = (await API.call('/asset/mijn')).posities || [];
    } catch(e){ el.innerHTML = ''; return; }
    const posVan = id => mijn.find(p => p.assetId === id);
    el.innerHTML = d.assets.map(a => {
      const p = posVan(a.id);
