    if (!bannerEl) {
      bannerEl = document.createElement('button');
      bannerEl.className = 'os-banner';
      bannerEl.setAttribute('aria-live', 'polite');
      bannerEl.addEventListener('click', () => { bannerWeg(); const b = $('#bell'); if (b) b.click(); });
      app.appendChild(bannerEl);
    }
    bannerEl.textContent = '';
    const ic = document.createElement('span'); ic.className = 'ob-ic'; ic.textContent = icoon || '';
    const kol = document.createElement('span');
    const t = document.createElement('div'); t.className = 'ob-titel'; t.textContent = titel || 'RTG';
    kol.appendChild(t);
    if (tekst) { const bd = document.createElement('div'); bd.className = 'ob-body'; bd.textContent = tekst; kol.appendChild(bd); }
    bannerEl.appendChild(ic); bannerEl.appendChild(kol);
    requestAnimationFrame(() => bannerEl.classList.add('open'));
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(bannerWeg, 4500);
  }
  function bannerWeg() {
    if (bannerEl) bannerEl.classList.remove('open');
    if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }
  }
  // live meldingen als banner: de kern geeft zijn onChange pas bij start() aan
  // de realtime-bus, dus wikkelen we start() in en haken we daar op mee.
  if (window.RTGRealtime && typeof RTGRealtime.start === 'function') {
    const echteStart = RTGRealtime.start.bind(RTGRealtime);
    RTGRealtime.start = (token, opts) => {
      opts = opts || {};
      const oud = opts.onChange;
      opts.onChange = n => {
        if (oud) oud(n);
        if (n && n.title) bannerToon(n.icon || '', n.title, n.body || '');
      };
      return echteStart(token, opts);
    };
  }

  /* ---------- Rahul bestuurt het OS ----------
     Zinnen die het OS zelf kan uitvoeren (open <app>, thema, licht/donker,
     zoek, home) onderscheppen we in de capture-fase, vóór de chat-handlers;
     al het andere gaat gewoon door naar Rahul-chat, die met zijn
     acties-registry op de server bestelt, boekt, betaalt en annuleert. */
  function alleDoelen() {
    const uit = [];
    for (const { item } of alleItems()) uit.push({ naam: itemNaam(item), doe: () => openItem(item) });
    INDELING.flat().forEach(it => { if (typeof it !== 'string') uit.push({ naam: mapNaam(it), doe: () => openMap(it) }); });
    return uit;
  }
  function osCommando(ruw) {
    const schoon = (ruw || '').trim().replace(/[?.!]+$/, '');
    const q = schoon.toLowerCase();
    if (!q) return false;
    if (/^(home|thuis|beginscherm)$/.test(q)) { sluitScrims(); naarHome(); bannerToon('✦', 'Rahul', 'Naar het beginscherm.'); return true; }
    // elke functie een eigen app: bellen en videobellen direct via Rahul
    if (/^(bel|bellen|iemand bellen)$/.test(q)) { sluitScrims(); openItem('os:bellen'); return true; }
    if (/^(videobel|videobellen|video bellen)$/.test(q)) { sluitScrims(); openItem('os:videobellen'); return true; }
    // RTF met leeftijd erbij slaat de keuze over: "open rtf kids"
    let mr = q.match(/^(?:open\s+|start\s+|ga naar\s+)?rtf\s+(mini|kids|kind|tiener|jong|volw|volwassen)$/);
    if (mr) {
      const g = ({ kids: 'kind', volwassen: 'volw' })[mr[1]] || mr[1];
      sluitScrims(); location.href = '/apps/foundation/index.html?groep=' + g;
      return true;
    }
    // mappen hernoemen: "hernoem sociaal naar vrienden" of "noem de map rtg & info om naar over rtg"
    const mh = schoon.match(/^(?:hernoem|noem)\s+(?:de\s+)?(?:map\s+)?(.+?)\s+(?:om\s+)?naar\s+(.+)$/i);
    if (mh) {
      // lidwoorden tellen niet mee: "de crew" en "crew" wijzen dezelfde map aan
      const kaal = s => String(s || '').toLowerCase().replace(/^(?:de|het|een)\s+/, '');
      const mappen = INDELING.flat().filter(it => typeof it !== 'string');
      const doel = mappen.find(mp => kaal(mapNaam(mp)) === kaal(mh[1]) || kaal(mp.naam) === kaal(mh[1]));
      if (doel) {
        zetMapNaam(doel, mh[2]);
        bannerToon('✦', 'Rahul', 'De map heet nu "' + mapNaam(doel) + '".');
        return true;
      }
    }
    let m = q.match(/^zoek(?:en)?(?:\s+naar)?\s+(.+)$/);
    if (m) { openZoek(); zoekInput.value = m[1]; zoek(); return true; }
    m = q.match(/^thema\s+(bordeaux|parelmoer|standaard|klassiek)$/);
    if (m && window.RTGOSThema && RTGOSThema.keuzeMogelijk()) {
      RTGOSThema.zet(m[1] === 'klassiek' ? 'standaard' : m[1]);
      bannerToon('✦', 'Rahul', 'Het thema staat op ' + m[1] + '.');
      return true;
    }
    if (/^(licht|donker|lichte modus|donkere modus)$/.test(q)) {
      const b = $('#rtg-thema-knop');
      if (b) { b.click(); bannerToon('✦', 'Rahul', 'De weergave is omgezet.'); return true; }
      return false;
    }
    m = q.match(/^(?:open|start|ga naar)\s+(.+)$/);
    if (m) {
      const naam = m[1].replace(/^(?:de|het|een)\s+/, '');
      const doelen = alleDoelen();
      const doel = doelen.find(d => d.naam.toLowerCase() === naam) || doelen.find(d => d.naam.toLowerCase().includes(naam));
      if (doel) { sluitScrims(); doel.doe(); bannerToon('✦', 'Rahul', doel.naam + ' staat voor u open.'); return true; }
    }
    return false;
  }
  document.addEventListener('click', e => {
    if (!e.target || !e.target.closest || !e.target.closest('#askBtn')) return;
    const inp = $('#askInput');
    if (inp && osCommando(inp.value)) { inp.value = ''; e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target || e.target.id !== 'askInput') return;
    if (osCommando(e.target.value)) { e.target.value = ''; e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);

  /* ---------- widgets op hoofdscherm 2: verbergen, terughalen, herschikken ----------
     Zelfde gebaar als bij de iconen: lang drukken op een kaart zet de
     wiebel-modus aan; de minus verbergt, de gestippelde chips halen terug,
     slepen herschikt. Kaarten die de app zelf verbergt (hidden-attribuut)
     blijven van de app; wij beheren alleen onze eigen klasse. */
  const pagina2 = $('#osPagina2'), wChips = $('#osWChips');
  const W_NAMEN = {
    homeTrip: 'Reis', homePay: 'Betalen', homeSalon: 'De Salon', homeContacts: 'Contacten',
    homeSpelen: 'Spelen', homeCv: 'CV', homeVacatures: 'Vacatures', homeFoundation: 'Foundation'
  };
  function wStand() { try { return JSON.parse(localStorage.getItem('rtg_os_widgets_' + pas) || 'null') || {}; } catch (e) { return {}; } }
  function wBewaar(st) { try { localStorage.setItem('rtg_os_widgets_' + pas, JSON.stringify(st)); } catch (e) {} }
  const wKaarten = () => pagina2 ? [...pagina2.querySelectorAll(':scope > .card')].filter(c => W_NAMEN[c.id]) : [];
  function wToepas() {
    if (!pagina2) return;
    const st = wStand(), kaarten = wKaarten();
    kaarten.forEach(c => c.classList.toggle('os-w-verborgen', (st.verborgen || []).includes(c.id)));
    const perId = new Map(kaarten.map(c => [c.id, c]));
    (st.volgorde || []).forEach(id => { const c = perId.get(id); if (c) pagina2.appendChild(c); });
  }
  let wiebelW = false, wSleep = null, wTimer = null;
  function wChipsBouw() {
    if (!wChips) return;
    wChips.textContent = '';
    for (const id of wStand().verborgen || []) {
      if (!document.getElementById(id)) continue;
      const b = document.createElement('button');
      b.textContent = '+ ' + (W_NAMEN[id] || id);
      b.addEventListener('click', () => {
        const s = wStand(); s.verborgen = (s.verborgen || []).filter(x => x !== id); wBewaar(s);
        wToepas(); zetWiebelW(true);
      });
      wChips.appendChild(b);
    }
  }
  function zetWiebelW(aan) {
    wiebelW = aan;
    if (!pagina2) return;
    pagina2.classList.toggle('os-wiebel-w', aan);
    if (klaarKnop) klaarKnop.hidden = !(aan || wiebel);
    pagina2.querySelectorAll('.os-w-min').forEach(b => b.remove());
    if (aan) {
      for (const c of wKaarten()) {
        if (c.hidden || c.classList.contains('os-w-verborgen')) continue;
        const min = document.createElement('button');
        min.className = 'os-w-min'; min.textContent = '−';
        min.setAttribute('aria-label', 'Verberg widget ' + (W_NAMEN[c.id] || c.id));
        min.addEventListener('click', e => {
          e.stopPropagation();
          const s = wStand(); s.verborgen = [...new Set([...(s.verborgen || []), c.id])]; wBewaar(s);
          wToepas(); zetWiebelW(true);
        });
        c.appendChild(min);
      }
      wChipsBouw();
    } else {
      const s = wStand(); s.volgorde = wKaarten().map(c => c.id); wBewaar(s); wSleep = null;
    }
  }
  if (klaarKnop) klaarKnop.addEventListener('click', () => { if (wiebelW) zetWiebelW(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && wiebelW) zetWiebelW(false); });
  if (pagina2) {
    pagina2.addEventListener('pointerdown', e => {
      const c = e.target.closest('.card');
      if (!c || c.parentElement !== pagina2 || !W_NAMEN[c.id]) return;
      if (e.target.closest('button, a, input') && !wiebelW) return; // knoppen in widgets gewoon laten werken
      wTimer = setTimeout(() => zetWiebelW(true), 550);
