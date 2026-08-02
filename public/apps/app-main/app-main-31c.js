  /* Het aanpasscherm. Drie standen in een rijtje en geen sleepwerk: slepen met
     een muis is een eigen hoofdstuk en verdient een eigen ronde. */
  function wingAanpassen(herteken) {
    const st = wingLees();
    const scrim = document.createElement('div'); scrim.className = 'wing-scrim';
    const kaart = document.createElement('div'); kaart.className = 'wing-kaart';
    const kop = document.createElement('h2');
    kop.textContent = T('wings.titel', 'Wat staat er naast uw app?');
    const uitleg = document.createElement('p'); uitleg.className = 'wing-uitleg';
    uitleg.textContent = T('wings.uitleg', 'Alleen op een breed scherm. Uw keuze blijft bewaard op dit toestel.');
    kaart.appendChild(kop); kaart.appendChild(uitleg);
    for (const item of WING_KEUZE) {
      if (!itemZichtbaar(item)) continue;
      const def = itemDef(item) || {};
      const rij = document.createElement('div'); rij.className = 'wing-rij';
      const naam = document.createElement('span');
      naam.textContent = item.startsWith('tab:') ? tabNaam(item.slice(4)) : (def.naam || item);
      const knoppen = document.createElement('span'); knoppen.className = 'wing-standen';
      const nu = st.links.includes(item) ? 'links' : st.rechts.includes(item) ? 'rechts' : 'uit';
      for (const [stand, label] of [['uit', T('wings.uit', 'uit')], ['links', T('wings.links', 'links')], ['rechts', T('wings.rechts', 'rechts')]]) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = label;
        b.className = 'wing-stand' + (stand === nu ? ' aan' : '');
        b.addEventListener('click', () => {
          const s = wingLees();
          s.links = s.links.filter(x => x !== item);
          s.rechts = s.rechts.filter(x => x !== item);
          if (stand !== 'uit') s[stand].push(item);
          wingBewaar(s);
          [...knoppen.children].forEach(k => k.classList.remove('aan'));
          b.classList.add('aan');
          herteken();
        });
        knoppen.appendChild(b);
      }
      rij.appendChild(naam); rij.appendChild(knoppen); kaart.appendChild(rij);
    }
    const klaar = document.createElement('button');
    klaar.type = 'button'; klaar.className = 'wing-klaar';
    klaar.textContent = T('wings.klaar', 'Klaar');
    const opEsc = e => { if (e.key === 'Escape') sluit(); };
    const sluit = () => { scrim.remove(); document.removeEventListener('keydown', opEsc); };
    klaar.addEventListener('click', sluit);
    scrim.addEventListener('click', e => { if (e.target === scrim) sluit(); });
    document.addEventListener('keydown', opEsc);
    kaart.appendChild(klaar); scrim.appendChild(kaart);
    document.body.appendChild(scrim); klaar.focus();
  }

  /* Bouwen pas als er echt ruimte is, en opruimen zodra die weg is. Een
     matchMedia-luisteraar en geen resize-handler: die vuurt op de grensovergang
     en niet bij elke pixel. */
  (function wings() {
    const wingL = $('#wingL'), wingR = $('#wingR');
    if (!wingL || !wingR || !window.matchMedia) return;
    const breed = window.matchMedia('(min-width:1100px)');
    function teken() {
      if (!breed.matches) { wingL.textContent = ''; wingR.textContent = ''; return; }
      const st = wingLees();
      wingVul(wingL, st.links);
      wingVul(wingR, st.rechts);
      const knop = document.createElement('button');
      knop.type = 'button'; knop.className = 'wing-instel';
      knop.textContent = T('wings.aanpassen', 'aanpassen');
      knop.addEventListener('click', () => wingAanpassen(teken));
      wingR.appendChild(knop);
    }
    // op het slotscherm horen er geen werk-apps naast te staan
    function misschien() {
      if (app.classList.contains('active')) teken();
      else { wingL.textContent = ''; wingR.textContent = ''; }
    }
    breed.addEventListener('change', misschien);
    new MutationObserver(misschien).observe(app, { attributes: true, attributeFilter: ['class'] });
    misschien();
  })();
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
