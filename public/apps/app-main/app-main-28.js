    grid.addEventListener('pointerdown', e => {
      const el = e.target.closest('.os-app'); if (!el) return;
      // waar de vinger begon: movementX/Y is bij touch in Safari altijd 0, dus
      // daarop afgaan betekende dat wegvegen de lange-druk NIET afbrak en de
      // wiebel-modus zomaar aansprong tijdens het scrollen. Nu meten we de
      // afstand zelf, en dat werkt op elk toestel gelijk.
      drukX = e.clientX; drukY = e.clientY;
      drukTimer = setTimeout(() => { zetWiebel(true); }, 550);
      if (wiebel) { sleepEl = el; el.classList.add('os-sleep'); el.setPointerCapture && el.setPointerCapture(e.pointerId); }
    });
    grid.addEventListener('pointermove', e => {
      if (drukTimer && !wiebel && Math.hypot(e.clientX - drukX, e.clientY - drukY) > 10) { clearTimeout(drukTimer); drukTimer = null; }
      if (!wiebel || !sleepEl) return;
      const onder = document.elementFromPoint(e.clientX, e.clientY);
      const doel = onder && onder.closest && onder.closest('.os-app');
      if (doel && doel !== sleepEl && doel.parentElement === sleepEl.parentElement) {
        const kinderen = [...sleepEl.parentElement.children];
        sleepEl.parentElement.insertBefore(sleepEl, kinderen.indexOf(doel) > kinderen.indexOf(sleepEl) ? doel.nextSibling : doel);
      }
    });
    const laat = () => { if (drukTimer) { clearTimeout(drukTimer); drukTimer = null; } if (sleepEl) { sleepEl.classList.remove('os-sleep'); sleepEl = null; rijen.forEach((g, p) => bewaarVolgorde(p, [...g.children].map(c => c.dataset.sleutel))); } };
    grid.addEventListener('pointerup', laat);
    grid.addEventListener('pointercancel', laat);
  });

  /* ---------- app-modus, statusbalk en model-spiegeling (als voorheen) ---------- */
  function actieveTab() { const b = tabbar.querySelector('button.active'); return b ? b.dataset.tab : 'home'; }
  function sync() {
    const tab = actieveTab(), open = tab !== 'home';
    app.classList.toggle('os-open', open);
    // schermvast zodra de app zichtbaar is: de pill echt onderin beeld
    document.body.classList.toggle('os-vast', getComputedStyle(app).display !== 'none');
    if (content) content.classList.toggle('os-thuis', !open);
    const terug = $('#osTerug'), brand = $('#osBrand'), titel = $('#osAppTitel');
    if (terug) terug.hidden = !open;
    if (brand) brand.style.display = open ? 'none' : '';
    if (titel) titel.textContent = open ? tabNaam(tab) : '';
  }
  /* Het springboard spiegelt de tabbar, dus we kijken mee -- maar alleen naar
     wat het beeld echt verandert.

     Hier stond 'class' in de filter, en dat was duur op de verkeerde momenten:
     openTab() zet bij ELKE schermwissel class="active" om op elke tabknop, dus
     bij elke tik werden alle mappen en tegels weggegooid en opnieuw getekend
     (inclusief hun SVG-iconen). Dat is het schokkerige gevoel bij navigeren,
     en het brak een lopende sleep-actie halverwege af.

     Zichtbaarheid en badges lopen via style.display (zie tabZichtbaar), nooit
     via een klasse -- 'style' volstaat dus. En voor de zekerheid daarbovenop
     een inhoudscontrole: verandert de uitkomst niet, dan tekenen we niet. */
  let gepland = null;
  const bouwAlsAnders = () => { if (afdruk() !== vorigeAfdruk) bouw(); };
  new MutationObserver(() => {
    if (gepland) return;
    gepland = requestAnimationFrame(() => { gepland = null; bouwAlsAnders(); });
  }).observe(tabbar, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style'] });
  // de gate/app-wissel (inloggen, uitloggen) stuurt de schermvaste modus
  new MutationObserver(sync).observe(app, { attributes: true, attributeFilter: ['style', 'class'] });

  const naarHome = () => { const b = tabKnop('home'); if (b) b.click(); };
  const terug = $('#osTerug'), pill = $('#osPill');
  if (terug) terug.addEventListener('click', naarHome);
  // de pill: een tik gaat naar het beginscherm, vasthouden roept Rahul
  // (het Siri-gebaar van dit OS), en omhoog vegen sluit de open app: de app
  // krimpt onder de vinger weg (of veert terug als de veeg te kort was)
  let pillLang = false, pillTimer = null, pillY = null, pillDy = 0, pillVeeg = false;
  const rustigOS = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (pill) {
    pill.addEventListener('pointerdown', e => {
      pillLang = false; pillY = e.clientY; pillDy = 0; pillVeeg = false;
      try { pill.setPointerCapture(e.pointerId); } catch (x) {}
      pillTimer = setTimeout(() => { pillLang = true; vraagRahul(''); }, 550);
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
    const t = tabKnop('ai');
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
    if (!bannerEl) {
      bannerEl = document.createElement('button');
      bannerEl.className = 'os-banner';
      bannerEl.setAttribute('aria-live', 'polite');
      bannerEl.addEventListener('click', () => { bannerWeg(); const b = $('#bell'); if (b) b.click(); });
      app.appendChild(bannerEl);
    }
    bannerEl.textContent = '';
    const ic = document.createElement('span'); ic.className = 'ob-ic';
    const glyf = (window.RTGGlyf && RTGGlyf.heeft(icoon)) ? RTGGlyf.svg(icoon) : null;
    if (glyf) ic.appendChild(glyf); else ic.textContent = icoon || '';
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
