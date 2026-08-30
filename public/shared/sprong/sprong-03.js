  /* --- deel 3: de lijst en wat een tik doet --- */
  /* WAT KAN IK HIER DOEN. Dezelfde lijst die het app-menu toont
     (RTGAppMenu.functies), en met opzet geen eigen lijst: die zou binnen een
     week iets anders zeggen dan het menu drie centimeter verderop. Staat het
     menu niet op deze pagina, dan is er geen kopje Hier -- en niet een leeg
     kopje, want een kopje zonder inhoud belooft iets.

     Een handeling die de pagina niet AANBIEDT komt hier dus ook niet in. Dat is
     de grens die GRAMMATICA.md al trekt: de software stelt voor, hij verzint
     niet. */
  function handelingen() {
    if (!w.RTGAppMenu || typeof w.RTGAppMenu.functies !== 'function') return [];
    var uit = [];
    try {
      (w.RTGAppMenu.functies() || []).forEach(function (f) {
        if (!f || !f.label) return;
        if (!f.knop && !f.spring && typeof f.doe !== 'function') return;
        uit.push({ naam: f.label, wereld: 'Hier', handeling: f });
      });
    } catch (e) { return []; }
    return uit;
  }

  function doeHandeling(f) {
    sluit();
    /* De knop van de pagina wordt INGEDRUKT, niet nagedaan: wat erachter zit --
       een bevestiging, een verhindering met reden, een gewicht uit
       GRAMMATICA.md -- blijft daarmee van de app en niet van deze laag. */
    if (f.knop) { f.knop.click(); return; }
    if (typeof f.doe === 'function') { f.doe(); return; }
    if (f.spring && f.spring.scrollIntoView) {
      f.spring.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (f.spring.tabIndex < 0) f.spring.tabIndex = -1;
      f.spring.focus({ preventScroll: true });
    }
  }

  /* HANDELINGEN DIE ERGENS ANDERS WONEN. "Fooi verdelen" staat in Horeca, "Zet
     tegoed klaar" in RTG Pay; wie dat woord typt terwijl hij ergens anders is,
     kreeg niets. De lijst komt uit shared/handelingindex.json, gegenereerd uit
     de knoppen van de schermen zelf (scripts/handelingindex.js).

     ALLEEN ALS ER GETYPT WORDT, en dat is een ontwerpbesluit: 248 handelingen
     onder een lijst van 98 bestemmingen zetten maakt de lade een telefoonboek.
     Zoeken is de plek waar ze horen.

     EEN TIK BRENGT JE ERHEEN EN VOERT NIETS UIT -- de grens uit GRAMMATICA.md:
     de software zet klaar, de mens doet. Daarom staat er ook bij WAAR hij woont:
     een rij die alleen "Fooi verdelen" zegt, belooft dat hij het doet. */
  function eldersVoor(zoek) {
    if (!zoek || !elders.length) return [];
    var uit = [];
    for (var i = 0; i < elders.length && uit.length < 12; i++) {
      var h = elders[i];
      if ((h.label + ' ' + h.app).toLowerCase().indexOf(zoek) < 0) continue;
      uit.push({ naam: h.label, wereld: 'Handelingen', url: h.url, label: 'in ' + h.app });
    }
    return uit;
  }

  function teken(q) {
    lijst.textContent = '';
    var zoek = String(q || '').trim().toLowerCase();
    /* HIER STAAT BOVENAAN, en dat is de hele omslag van deze laag: eerst wat je
       op dit scherm kunt DOEN, dan pas waar je heen kunt. Wie de sprong opent
       terwijl hij ergens middenin zit, wil meestal het eerste. */
    var hier = handelingen();
    var rijen = hier.concat(index || []).filter(function (r) {
      /* De SLEUTEL en het ADRES doen mee, niet alleen het etiket: etiketten
         schuiven met beleid ("Werk OS" werd "Mijn werkplekken"), sleutels niet.
         Zonder dit vond "pay" niets, terwijl de app RTG Pay heet. */
      return !zoek || (r.naam + ' ' + r.wereld + ' ' + (r.sleutel || '') + ' ' + (r.url || ''))
        .toLowerCase().indexOf(zoek) >= 0;
    });
    rijen = rijen.concat(eldersVoor(zoek));
    if (!rijen.length) {
      var p = d.createElement('p'); p.className = 'rtgsprong-leeg';
      p.textContent = 'Niets gevonden. Wis het zoekwoord om alles te zien.';
      lijst.appendChild(p); return;
    }
    var vorige = null;
    rijen.forEach(function (r) {
      if (r.wereld !== vorige) {
        vorige = r.wereld;
        var h = d.createElement('p'); h.className = 'rtgsprong-wereld'; h.textContent = r.wereld;
        lijst.appendChild(h);
      }
      var b = d.createElement('button');
      b.type = 'button'; b.className = 'rtgsprong-rij';
      /* HET ADRES STAAT OP DE KNOP. Een knop die alleen in JavaScript weet waar
         hij heen gaat, bestaat niet voor scripts/tikken.js -- die meter telt
         alleen echte bestemmingen, en dat is precies waarom hij niet met een
         belofte op te poetsen is. Nu telt de sprong mee zoals hij werkt. */
      if (r.url) b.dataset.url = r.url;
      /* Een handeling is geen bestemming: hij draagt geen adres, en dat mag hij
         niet stilzwijgend doen -- anders lijkt hij voor de tikkenmeter een weg
         naar een scherm dat hij niet is. */
      if (r.handeling) b.dataset.handeling = '1';
      var n = d.createElement('span'); n.textContent = r.naam; b.appendChild(n);
      if (r.label) { var e = d.createElement('em'); e.textContent = r.label; b.appendChild(e); }
      b.addEventListener('click', function () { r.handeling ? doeHandeling(r.handeling) : ga(r); });
      lijst.appendChild(b);
    });
  }

  function bouw() {
    luik = d.createElement('div');
    luik.className = 'rtgsprong'; luik.hidden = true;
    luik.setAttribute('role', 'dialog'); luik.setAttribute('aria-modal', 'true');
    luik.setAttribute('aria-label', 'Spring naar een functie');
    var kop = d.createElement('div'); kop.className = 'rtgsprong-kop';
    veld = d.createElement('input');
    veld.type = 'search'; veld.placeholder = 'Waar wilt u heen?';
    veld.setAttribute('aria-label', 'Zoek een functie');
    veld.addEventListener('input', function () { teken(veld.value); });
    var dicht = d.createElement('button');
    dicht.type = 'button'; dicht.textContent = 'Sluiten';
    dicht.addEventListener('click', sluit);
    kop.appendChild(veld); kop.appendChild(dicht);
    lijst = d.createElement('div'); lijst.className = 'rtgsprong-lijst';
    luik.appendChild(kop); luik.appendChild(lijst);
    d.body.appendChild(luik);
  }

  /* Bij het laden opgebouwd en verborgen tot de greep wordt aangetikt: zo staat
     de lijst er meteen, en zo is de korte weg meetbaar. */
  function vooraf() {
    if (ledenlade() || luik) return;
    bouw();
    laadElders();
    haal().then(function () { teken(''); });
  }

  function laadElders() {
    if (elders.length) return;
    fetch(HANDELINGEN, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : { items: [] }; })
      .then(function (j) { elders = (j && j.items) || []; })
      .catch(function () { elders = []; });
  }

  function open() {
    var lade = ledenlade();
    if (lade) { lade.classList.add('open'); var i = d.getElementById('osZoekInput'); if (i) i.focus(); return; }
    if (!luik) bouw();
    laadElders();
    terugNaar = d.activeElement;
    luik.hidden = false;
    haal().then(function () { teken(veld.value); veld.focus(); });
  }
  function sluit() {
    if (luik) luik.hidden = true;
    if (terugNaar && terugNaar.focus) terugNaar.focus();
  }

  function greepje() {
    greep = d.createElement('button');
    greep.type = 'button'; greep.className = 'rtgsprong-greep';
    greep.setAttribute('aria-label', 'Spring naar een functie');
    greep.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M15.5 15.5 21 21"/></svg>';
    greep.addEventListener('click', open);
    d.body.appendChild(greep);
  }

  function start() {
    if (!lid() || verboden()) return;
    stijl(); greepje();
    if (w.requestIdleCallback) w.requestIdleCallback(vooraf, { timeout: 1500 }); else setTimeout(vooraf, 300);
    d.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); open(); return; }
      if (e.key === 'Escape' && luik && !luik.hidden) sluit();
    });
  }

  w.RTGSprong = { open: open, sluit: sluit };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})(window, document);
