    const bi = document.createElement('span'); bi.textContent = '✦';
    zoekRij(bi, q ? 'Vraag Rahul: "' + zoekInput.value.trim() + '"' : 'Vraag Rahul', null,
      () => vraagButler(zoekInput.value.trim()));
  }
  function openZoek() { sluitScrims(); zoekScrim.classList.add('open'); zoekInput.value = ''; zoek(); zoekInput.focus(); }
  const zoekPil = $('#osZoekPil');
  if (zoekPil) zoekPil.addEventListener('click', openZoek);
  if (zoekInput) zoekInput.addEventListener('input', zoek);

  /* ---------- bedieningspaneel ---------- */
  const ccScrim = $('#osCcScrim');
  const ccBtn = $('#osCcBtn');
  if (ccBtn) ccBtn.addEventListener('click', () => { const open = ccScrim.classList.contains('open'); sluitScrims(); if (!open) { ccSync(); ccScrim.classList.add('open'); } });
  function ccSync() {
    const T = window.RTGOSThema;
    const rij = $('#osCcThema');
    if (rij) rij.style.display = T && T.keuzeMogelijk() ? '' : 'none';
    if (T) document.querySelectorAll('#osCcThema button').forEach(b => b.classList.toggle('actief', b.dataset.thema === T.huidig()));
    const push = $('#osCcPush');
    if (push && window.RTGRealtime) push.classList.toggle('aan', RTGRealtime.pushOn && RTGRealtime.pushOn());
  }
  document.querySelectorAll('#osCcThema button').forEach(b => b.addEventListener('click', () => {
    if (window.RTGOSThema) { RTGOSThema.zet(b.dataset.thema); ccSync(); }
  }));
  const ccTaal = $('#osCcTaal');
  if (ccTaal) ccTaal.addEventListener('click', () => { sluitScrims(); if (window.RTGi18n) RTGi18n.openModal(); });
  const ccPush = $('#osCcPush');
  if (ccPush) ccPush.addEventListener('click', async () => { if (window.RTGRealtime) { await RTGRealtime.enablePush(); ccSync(); } });
  const ccZoek = $('#osCcZoek');
  if (ccZoek) ccZoek.addEventListener('click', openZoek);
  // licht/donker: de (verborgen) gedeelde themaknop blijft de motor
  const ccLicht = $('#osCcLicht');
  if (ccLicht) ccLicht.addEventListener('click', () => { const b = $('#rtg-thema-knop'); if (b) b.click(); });
  const ccUit = $('#osCcUit');
  if (ccUit) ccUit.addEventListener('click', () => { sluitScrims(); const b = $('#logoutBtn'); if (b) b.click(); });
  // helderheid: puur visueel, onthouden per browser
  const helder = $('#osCcHelder');
  function zetHelder(v) { app.style.filter = v >= 110 ? '' : 'brightness(' + (v / 100) + ')'; try { localStorage.setItem('rtg_os_helder', String(v)); } catch (e) {} }
  if (helder) {
    const h = Number(localStorage.getItem('rtg_os_helder') || 100);
    helder.value = h; zetHelder(h);
    helder.addEventListener('input', () => zetHelder(Number(helder.value)));
  }

  /* ---------- wiebel-modus: herschikken met een lange druk ---------- */
  let wiebel = false, drukTimer = null, sleepEl = null, wiebelStart = 0;
  const klaarKnop = $('#osKlaar');
  function zetWiebel(aan) {
    wiebel = aan;
    if (aan) wiebelStart = Date.now();
    grids.forEach(g => g.classList.toggle('os-wiebel', aan));
    if (klaarKnop) klaarKnop.hidden = !aan;
    if (!aan) { grids.forEach((g, p) => bewaarVolgorde(p, [...g.children].map(c => c.dataset.sleutel))); sleepEl = null; }
  }
  if (klaarKnop) klaarKnop.addEventListener('click', () => zetWiebel(false));
  grids.forEach(grid => {
    grid.addEventListener('pointerdown', e => {
      const el = e.target.closest('.os-app'); if (!el) return;
      drukTimer = setTimeout(() => { zetWiebel(true); }, 550);
      if (wiebel) { sleepEl = el; el.classList.add('os-sleep'); el.setPointerCapture && el.setPointerCapture(e.pointerId); }
    });
    grid.addEventListener('pointermove', e => {
      if (drukTimer && (Math.abs(e.movementX) > 3 || Math.abs(e.movementY) > 3) && !wiebel) { clearTimeout(drukTimer); drukTimer = null; }
      if (!wiebel || !sleepEl) return;
      const onder = document.elementFromPoint(e.clientX, e.clientY);
      const doel = onder && onder.closest && onder.closest('.os-app');
      if (doel && doel !== sleepEl && doel.parentElement === sleepEl.parentElement) {
        const kinderen = [...sleepEl.parentElement.children];
        sleepEl.parentElement.insertBefore(sleepEl, kinderen.indexOf(doel) > kinderen.indexOf(sleepEl) ? doel.nextSibling : doel);
      }
    });
    const laat = () => { if (drukTimer) { clearTimeout(drukTimer); drukTimer = null; } if (sleepEl) { sleepEl.classList.remove('os-sleep'); sleepEl = null; grids.forEach((g, p) => bewaarVolgorde(p, [...g.children].map(c => c.dataset.sleutel))); } };
    grid.addEventListener('pointerup', laat);
    grid.addEventListener('pointercancel', laat);
  });

  /* ---------- pagina-stippen ---------- */
  function bouwDots() {
    dots.textContent = '';
    INDELING.forEach((_, i) => {
      const d = document.createElement('button');
      d.setAttribute('aria-label', 'Hoofdscherm ' + (i + 1));
      d.addEventListener('click', () => pages.scrollTo({ left: i * pages.clientWidth, behavior: 'smooth' }));
      dots.appendChild(d);
    });
    dotSync();
  }
  function dotSync() {
    const i = Math.round(pages.scrollLeft / Math.max(1, pages.clientWidth));
    [...dots.children].forEach((d, j) => d.classList.toggle('actief', j === i));
  }
  let dotRaf = null;
  pages.addEventListener('scroll', () => { if (!dotRaf) dotRaf = requestAnimationFrame(() => { dotRaf = null; dotSync(); }); });

  /* ---------- app-modus, statusbalk en model-spiegeling (als voorheen) ---------- */
  function actieveTab() { const b = tabbar.querySelector('button.active'); return b ? b.dataset.tab : 'home'; }
  function sync() {
    const tab = actieveTab(), open = tab !== 'home';
    app.classList.toggle('os-open', open);
    // schermvast zodra de app zichtbaar is: dock en pill echt onderin beeld
    document.body.classList.toggle('os-vast', getComputedStyle(app).display !== 'none');
    if (content) content.classList.toggle('os-thuis', !open);
    const terug = $('#osTerug'), brand = $('#osBrand'), titel = $('#osAppTitel');
    if (terug) terug.hidden = !open;
    if (brand) brand.style.display = open ? 'none' : '';
    if (titel) titel.textContent = open ? tabNaam(tab) : '';
    dock.querySelectorAll('.os-app').forEach(d => d.classList.toggle('actief', d.dataset.tab === tab));
  }
  let gepland = null;
  new MutationObserver(() => {
    if (gepland) return;
    gepland = requestAnimationFrame(() => { gepland = null; bouw(); });
  }).observe(tabbar, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });
  // de gate/app-wissel (inloggen, uitloggen) stuurt de schermvaste modus
  new MutationObserver(sync).observe(app, { attributes: true, attributeFilter: ['style', 'class'] });

  const naarHome = () => { const b = tabKnop('home'); if (b) b.click(); };
  const terug = $('#osTerug'), pill = $('#osPill');
  if (terug) terug.addEventListener('click', naarHome);
  // de pill: een tik gaat naar het beginscherm, vasthouden roept de Butler
  // (het Siri-gebaar van dit OS), en omhoog vegen sluit de open app: de app
  // krimpt onder de vinger weg (of veert terug als de veeg te kort was)
  let pillLang = false, pillTimer = null, pillY = null, pillDy = 0, pillVeeg = false;
  const rustigOS = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (pill) {
    pill.addEventListener('pointerdown', e => {
      pillLang = false; pillY = e.clientY; pillDy = 0; pillVeeg = false;
      try { pill.setPointerCapture(e.pointerId); } catch (x) {}
      pillTimer = setTimeout(() => { pillLang = true; vraagButler(''); }, 550);
    });
    pill.addEventListener('pointermove', e => {
      if (pillY == null || pillLang) return;
      pillDy = Math.max(0, pillY - e.clientY);
      if (pillDy > 8 && !pillVeeg) {
        pillVeeg = true;
        if (pillTimer) { clearTimeout(pillTimer); pillTimer = null; } // vegen is geen vasthouden
      }
      if (!pillVeeg || rustigOS || !content) return;
      const p = Math.min(pillDy / 240, 1);
      content.style.transformOrigin = '50% 90%';
      content.style.transform = 'scale(' + (1 - p * 0.15).toFixed(4) + ') translateY(' + Math.round(-pillDy * 0.35) + 'px)';
      content.style.opacity = String(1 - p * 0.3);
    });
    const pillLos = () => {
      if (pillTimer) { clearTimeout(pillTimer); pillTimer = null; }
      if (pillY == null) return;
      const d = pillDy; pillY = null;
      if (!pillVeeg || !content) return;
      if (d > 70) {
        content.style.transform = ''; content.style.opacity = '';
        if (rustigOS) { naarHome(); return; }
        content.classList.add('os-veeg-weg');
        setTimeout(() => { naarHome(); content.classList.remove('os-veeg-weg'); }, 170);
      } else {
        content.classList.add('os-veeg-terug');
        content.style.transform = ''; content.style.opacity = '';
        setTimeout(() => content.classList.remove('os-veeg-terug'), 240);
      }
    };
    pill.addEventListener('pointerup', pillLos);
    pill.addEventListener('pointercancel', pillLos);
    pill.addEventListener('click', () => { if (!pillLang && !pillVeeg) naarHome(); pillLang = false; pillVeeg = false; });
  }

  /* De klok en de datum komen van de ene RTG-klok (/shared/klok.js), zodat
     elke app exact dezelfde tijd toont: Bodoni-cijfers met seconden en
     milliseconden. De elementen dragen data-rtg-klok / data-rtg-datum. */
  if (window.RTGKlok) RTGKlok.alles();

  /* Een app (zoals Balans) kan met #ai terugverwijzen naar de Rahul-chat:
     na het opstarten openen we dan meteen de AI-tab. */
  if (location.hash === '#ai') setTimeout(() => {
    const t = document.querySelector('.os-app[data-tab="ai"]');
    if (t) t.click();
  }, 600);

  /* ---------- batterij in de statusbalk, zoals op een telefoon ---------- */
  const bat = $('#osBat'), batVul = $('#osBatVul'), batPct = $('#osBatPct');
  if (bat && navigator.getBattery) {
    navigator.getBattery().then(b => {
      const verf = () => {
        bat.hidden = false;
        const p = Math.round(b.level * 100);
        batVul.style.width = Math.max(6, p) + '%';
        batPct.textContent = p + '%';
        bat.classList.toggle('laag', p <= 20 && !b.charging);
      };
      b.addEventListener('levelchange', verf);
      b.addEventListener('chargingchange', verf);
      verf();
    }).catch(() => {});
  }

  /* ---------- notificatie-banner: glijdt bovenin binnen ---------- */
  let bannerEl = null, bannerTimer = null;
  function bannerToon(icoon, titel, tekst) {
