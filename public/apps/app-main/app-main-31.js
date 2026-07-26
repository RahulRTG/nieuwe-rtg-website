    if (!alle.length) {
      var leeg = document.createElement('div'); leeg.className = 'os-bel-leeg';
      leeg.textContent = T('os.board.leeg', 'Buiten de basis heeft u nu geen extra functies om te schakelen.');
      winkelLijst.appendChild(leeg);
    } else {
      groepen.forEach(function (g) {
        var kop = document.createElement('div'); kop.className = 'os-winkel-groep'; kop.textContent = g.titel;
        winkelLijst.appendChild(kop);
        g.items.forEach(function (it) { winkelLijst.appendChild(winkelRij(it)); });
      });
    }
    winkelScrim.classList.add('open');
  }

  /* ---------- Achtergrond (wallpaper) in het bedieningspaneel ---------- */
  var WALLEN = ['standaard', 'nacht', 'bordeaux', 'beeld'];
  function zetWall(naam) {
    if (WALLEN.indexOf(naam) < 0) naam = 'standaard';
    WALLEN.forEach(function (w) { app.classList.toggle('os-wall-' + w, w === naam); });
    try { localStorage.setItem('rtg_os_wall', naam); } catch (e) {}
    document.querySelectorAll('#osCcWp button').forEach(function (b) { b.classList.toggle('actief', b.dataset.wall === naam); });
  }
  document.querySelectorAll('#osCcWp button').forEach(function (b) { b.addEventListener('click', function () { zetWall(b.dataset.wall); }); });
  var wallStart = 'standaard'; try { wallStart = localStorage.getItem('rtg_os_wall') || 'standaard'; } catch (e) {}
  zetWall(wallStart);

  /* ---------- Samen: verhuisd naar het bedieningspaneel ----------
     De metgezel-laag (shared/metgezel.js) houdt op dit OS zijn zwevende
     Samen-knop weg en biedt window.RTGMetgezel.samen() aan; hier openen we die
     vanuit Instellingen. Rahul blijft gewoon in de buurt. */
  var ccSamen = $('#osCcSamen');
  if (ccSamen) ccSamen.addEventListener('click', function () {
    sluitScrims();
    if (window.RTGMetgezel && RTGMetgezel.samen) RTGMetgezel.samen();
    else bannerToon('', T('os.samen', 'Samen'), T('os.samen.straks', 'Samen is zo beschikbaar.'));
  });

  /* ---------- Scherm draaien en volledig scherm: verhuisd naar het paneel ----------
     De schermbeeld-laag (shared/schermbeeld.js) houdt op dit OS zijn zwevende
     pil weg en biedt window.RTGscherm aan; hier bedienen we die vanuit het
     bedieningspaneel. Volledig scherm vraagt om een gebruikersgebaar -- de tik
     op deze knop is dat gebaar, dus we roepen het meteen aan. */
  var ccDraai = $('#osCcDraai');
  if (ccDraai) ccDraai.addEventListener('click', function () { sluitScrims(); if (window.RTGscherm) RTGscherm.draai(); });
  var ccVol = $('#osCcVol');
  if (ccVol) ccVol.addEventListener('click', function () { if (window.RTGscherm) RTGscherm.volledig(); sluitScrims(); });

  /* ---------- De Boardroom: functies aan en uit vanuit Instellingen ----------
     Uw eigen boardroom: alle functies waar u recht op heeft, aan of uit te zetten.
     De basis van het toestel (bellen, betalen, Rahul, uw pas-app en de
     RTFoundation) blijft altijd staan - die valt niet uit te zetten, zodat het
     systeem veilig en werkend blijft. Onder water is dit dezelfde install-laag
     als de App Store. */
  var ccBoard = $('#osCcBoardroom');
  if (ccBoard) ccBoard.addEventListener('click', function () { openBoardroom(); });

  /* ---------- Now Playing: je muziek bedienen vanaf de ROS ----------
     De muziek-apps melden hun stand via de gedeelde speler-laag
     (shared/speler.js). Dit paneel toont die stand en stuurt bediening terug;
     speelt er live een app (in een tab of tweede scherm), dan gaat het direct,
     anders openen we RTG Sound om daar verder te spelen. */
  (function () {
    if (!window.RTGSpeler) return;
    var kaart = $('#osNu'), hoes = $('#osNuHoes'), titel = $('#osNuTitel'), sub = $('#osNuSub'), speelKnop = $('#osNuSpeel');
    if (!kaart) return;
    var nu = null;
    // in huisstijl getekende tekens (geen emoji): een noot voor de hoes en
    // een play/pauze die met de stand meewisselt
    var SVG_NOOT = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>';
    var SVG_PLAY = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
    var SVG_PAUZE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
    function toon(state) {
      nu = state;
      if (!state || !state.titel) { kaart.hidden = true; return; }
      kaart.hidden = false;
      if (hoes) hoes.innerHTML = SVG_NOOT;   // de hoes blijft de RTG-noot; geen emoji
      titel.textContent = state.titel;
      sub.textContent = (state.artiest || 'RTG Sound') + (state.station ? ' · ' + state.station : '');
      if (speelKnop) speelKnop.innerHTML = state.speelt ? SVG_PAUZE : SVG_PLAY;
    }
    function openSound(speel) {
      var q = '/apps/muziek.html';
      if (nu && nu.stationId) q += '?station=' + encodeURIComponent(nu.stationId) + '&seed=' + (nu.seed || 0) + '&speel=' + (speel === false ? '0' : '1');
      location.href = q;
    }
    function bedien(cmd) {
      var G = window.RTGGeluid, s = G && G.stand();
      if (s) {                          // de motor draait hier in de ROS zelf: stuur hem rechtstreeks
        if (cmd === 'next') G.volgende();
        else if (cmd === 'prev') G.opnieuw();
        else if (cmd === 'pause') G.pauze();
        else if (cmd === 'play') G.hervat();
        else s.speelt ? G.pauze() : G.hervat();
        return;
      }
      if (RTGSpeler.live()) { RTGSpeler.stuur(cmd); if (cmd === 'toggle' && nu) { nu.speelt = !nu.speelt; toon(nu); } return; }
      if (G && nu && nu.stationId && cmd !== 'pause') {  // niets live: pak de laatste stand hier weer op
        var off = nu.start ? Math.max(0, (Date.now() - nu.start) / 1000) : 0;
        G.speel(nu.stationId, nu.seed, off); return;
      }
      openSound(cmd !== 'pause');        // geen motor beschikbaar: open RTG Sound en speel daar verder
    }
    var vorige = $('#osNuVorige'), volgende = $('#osNuVolgende'), open = $('#osNuOpen');
    if (speelKnop) speelKnop.addEventListener('click', function () { bedien('toggle'); });
    if (vorige) vorige.addEventListener('click', function () { bedien('prev'); });
    if (volgende) volgende.addEventListener('click', function () { bedien('next'); });
    if (open) open.addEventListener('click', function () { openSound(true); });
    toon(RTGSpeler.opStand(toon));
    // de muziek loopt met je mee: stond ze aan, dan pakt ze op je eerste tik weer op
    if (window.RTGGeluid) RTGGeluid.hervatBijGebaar();
  })();
})();
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
        '<button class="rahul-leeg-knop" data-rahul-leeg="Boek een rit voor me: vraag waar ik heen wil en regel het vervoer" style="margin-top:0.45rem;">' + T('live.rahulrit','Laat Rahul een rit boeken') + '</button>' +
        '<button class="live-go" id="liveDeel" style="margin-top:0.45rem;background:none;border:1px solid var(--line);color:var(--txt);">' + T('live.deel','Deel mijn live locatie met deze zaak') + '</button>' +
        '<div style="margin-top:0.4rem;font-size:0.62rem;color:var(--soft);line-height:1.5;">' + T('live.deel.s','Alleen deze zaak ziet dan waar u bent, tot de zaak het niet meer nodig heeft of u het zelf stopt.') + '</div>' +
      '</div>';
