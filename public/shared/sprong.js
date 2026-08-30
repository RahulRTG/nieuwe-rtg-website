/* DE SPRONG -- een tik naar elke functie, vanaf elk scherm.

   WAAROM DIT ER IS. scripts/tikken.js heeft het huis afgelopen (TIKKEN.md): 119
   schermen lagen op drie tikken, 76 op vier, 24 op vijf en 52 buiten bereik. De
   belofte "elke functie binnen vijf tikken" was dus niet waar.

   Wat deze laag toevoegt is niet nog een menu maar de KORTE WEG: een greep die
   op elk scherm op dezelfde plek staat (1 tik) en een lijst van alles wat u
   kunt openen (de tweede tik). Twee tikken, overal.

   WAT HIJ NIET IS. Geen tweede navigatie: hij verzint geen bestemmingen. De
   lijst komt uit shared/sprongindex.json, AFGELEID uit MAPPEN (de enige lijst
   werelden, WERELD.md) door scripts/sprongindex.js. Wie hier ooit een eigen
   lijst ziet ontstaan, heeft LAT.md regel 4 te pakken.

   EN HIJ BOUWT GEEN TWEEDE SPOTLIGHT. Op /apps/app.html bestaat de zoeklade van
   de leden-app al (app-main-27.js), met dezelfde bron en meer kennis: hij weet
   wat uw pas opent en geeft Rahul een vraag door. Staat die op de pagina, dan
   opent deze greep hem en tekent hij niets van zichzelf.

   Typen is geen tik: wie de lijst openslaat, ziet alles staan. Het zoekveld is
   een versnelling en nooit een voorwaarde -- daarom is dit een lijst met een
   veld erboven, en geen leeg veld.

   GEEN GREEP ZONDER SESSIE. Op een inlogscherm, een publieke pagina of in de
   cel van een derde-app (APPSTORE.md) valt er niets te springen. */
(function (w, d) {
  'use strict';
  if (w.RTGSprong) return;

  var INDEX = '/shared/sprongindex.json';
  var index = null, laadt = null, luik = null, veld = null, lijst = null, greep = null, terugNaar = null;

  function lid() {
    try { return !!localStorage.getItem('rtg_member_token'); } catch (e) { return false; }
  }
  /* De cel van de App Store draait derdencode; daar hoort geen deur van RTG in
     die het hele huis opent. */
  function verboden() {
    return /\/apps\/appcel\.html/.test(location.pathname) || w.top !== w.self && /appcel/.test(d.referrer || '');
  }

  var css = '.rtgsprong-greep{position:fixed;z-index:9970;right:14px;bottom:calc(76px + env(safe-area-inset-bottom,0px));' +
      'width:52px;height:52px;display:grid;place-items:center;border:1px solid #857007;border-radius:0;' +
      'background:#0C0C0B;color:#FFFFFF;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.45);}' +
    '[data-hand="links"] .rtgsprong-greep{right:auto;left:14px;}' +
    '.rtgsprong-greep:focus-visible{outline:2px solid #857007;outline-offset:2px;}' +
    '.rtgsprong{position:fixed;inset:0;z-index:9971;display:flex;flex-direction:column;background:#0C0C0B;' +
      'font-family:Inter,system-ui,sans-serif;color:#FFFFFF;}' +
    '.rtgsprong[hidden]{display:none;}' +
    '.rtgsprong-kop{display:flex;gap:10px;align-items:center;padding:calc(14px + env(safe-area-inset-top,0px)) 14px 12px;' +
      'border-bottom:1px solid #4D4A45;}' +
    '.rtgsprong-kop input{flex:1;min-height:48px;background:#000;color:#FFFFFF;border:1px solid #4D4A45;border-radius:0;' +
      'padding:0 12px;font:400 1rem Inter,system-ui,sans-serif;}' +
    '.rtgsprong-kop button{min-width:48px;min-height:48px;background:none;border:1px solid #4D4A45;border-radius:0;' +
      'color:#FFFFFF;font:600 .85rem Inter,system-ui,sans-serif;cursor:pointer;}' +
    '.rtgsprong-lijst{flex:1;overflow:auto;padding:0 0 calc(24px + env(safe-area-inset-bottom,0px));}' +
    '.rtgsprong-wereld{margin:0;padding:16px 14px 6px;font:600 .62rem Inter,system-ui,sans-serif;letter-spacing:.18em;' +
      'text-transform:uppercase;color:#857007;}' +
    '.rtgsprong-rij{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:48px;' +
      'padding:12px 14px;background:none;border:0;border-bottom:1px solid #2A2724;border-radius:0;color:#FFFFFF;' +
      'font:400 .95rem Inter,system-ui,sans-serif;text-align:left;cursor:pointer;}' +
    '.rtgsprong-rij:hover,.rtgsprong-rij:focus-visible{background:#191817;outline:none;}' +
    '.rtgsprong-rij em{font-style:normal;color:#8A8680;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;}' +
    '.rtgsprong-leeg{padding:22px 14px;color:#8A8680;}';

  function stijl() {
    var s = d.createElement('style');
    s.textContent = css;
    /* De stempelaar van de voordeur zet de nonce erop (middleware/csp.js). */
    d.head.appendChild(s);
  }

  /* De zoeklade van de leden-app, als die op deze pagina staat. */
  function ledenlade() {
    var scrim = d.getElementById('osZoekScrim');
    return scrim && d.getElementById('osZoekInput') ? scrim : null;
  }

  function haal() {
    if (index) return Promise.resolve(index);
    if (!laadt) laadt = fetch(INDEX, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : { items: [] }; })
      .then(function (j) { index = (j && j.items) || []; return index; })
      .catch(function () { index = []; return index; });
    return laadt;
  }

  function ga(rij) {
    sluit();
    if (rij.url) {
      if (w.RTGCommand && w.RTGCommand.actief && w.RTGCommand.actief()) w.RTGCommand.open(rij.url, rij.naam);
      else location.href = rij.url;
      return;
    }
    /* Een tab of os-app woont IN de leden-app. Staat die om ons heen, dan
       drukken we zijn eigen knop in (een tweede weg zou twee waarheden geven);
       anders met de stand in de hash, en app-main opent hem daar (28.js). */
    var knop = d.querySelector('.tabbar button[data-tab="' + rij.sleutel + '"]');
    if (rij.soort === 'tab' && knop) { knop.click(); return; }
    location.href = '/apps/app.html#' + (rij.soort === 'tab' ? 'tab=' : 'os=') + encodeURIComponent(rij.sleutel);
  }

  function teken(q) {
    lijst.textContent = '';
    var zoek = String(q || '').trim().toLowerCase();
    var rijen = (index || []).filter(function (r) {
      /* De SLEUTEL en het ADRES doen mee, niet alleen het etiket: etiketten
         schuiven met beleid ("Werk OS" werd "Mijn werkplekken"), sleutels niet.
         Zonder dit vond "pay" niets, terwijl de app RTG Pay heet. */
      return !zoek || (r.naam + ' ' + r.wereld + ' ' + (r.sleutel || '') + ' ' + (r.url || ''))
        .toLowerCase().indexOf(zoek) >= 0;
    });
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
      var n = d.createElement('span'); n.textContent = r.naam; b.appendChild(n);
      if (r.label) { var e = d.createElement('em'); e.textContent = r.label; b.appendChild(e); }
      b.addEventListener('click', function () { ga(r); });
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
    haal().then(function () { teken(''); });
  }

  function open() {
    var lade = ledenlade();
    if (lade) { lade.classList.add('open'); var i = d.getElementById('osZoekInput'); if (i) i.focus(); return; }
    if (!luik) bouw();
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
