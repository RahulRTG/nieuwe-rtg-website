/* Bouwt de RTG-OS bovenbalk in elke app die 'm aanzet. Een app doet mee met
   twee attributen op <body>:
     data-osbar="RTG Pay"     -> de naam die in de balk staat (verplicht)
     data-oswereld="lid"      -> welke accountwereld de chip toont (optioneel,
                                 standaard 'lid'; zie shared/accounts-os.js)

   De balk toont links het woordmerk (RTG OS + de app-naam, terug naar het
   bureaublad), in het midden een levende klok met datum, en rechts het
   actieve account op dit toestel (of "Aanmelden"). De klok en de account-chip
   linken naar het bureaublad, waar de volledige accountwisselaar zit.

   Geen inline handlers (nonce-CSP), geen afhankelijkheid van een token: puur
   chrome. Insluiten met defer, NA shared/accounts-os.js. Zonder JavaScript
   blijft de pagina gewoon werken; alleen de balk ontbreekt dan. */
(function (w, d) {
  'use strict';
  var body = d.body;
  if (!body || !body.hasAttribute('data-osbar')) return;

  var appNaam = (body.getAttribute('data-osbar') || 'RTG').trim() || 'RTG';
  var wereld = (body.getAttribute('data-oswereld') || 'lid').trim() || 'lid';
  var BUREAU = '/apps/bureau.html';

  // ---- de balk opbouwen (zonder innerHTML met datavariabelen) ----
  function el(tag, klas, tekst) {
    var e = d.createElement(tag);
    if (klas) e.className = klas;
    if (tekst != null) e.textContent = tekst;
    return e;
  }

  var bar = el('header', 'osbar');
  bar.setAttribute('role', 'banner');

  var merk = el('a', 'os-merk');
  merk.href = BUREAU;
  merk.setAttribute('aria-label', appNaam + ' -- terug naar het bureaublad');
  var kick = el('span', 'os-kick');
  var kb = el('b', null, 'RTG OS'); // het accent-deel
  kick.appendChild(kb);
  merk.appendChild(kick);
  merk.appendChild(el('span', 'os-app', appNaam));
  bar.appendChild(merk);

  var klokLink = el('a', 'os-klok');
  klokLink.href = BUREAU;
  klokLink.style.textDecoration = 'none';
  klokLink.style.color = 'inherit';
  var tijd = el('time', null, '--:--');
  tijd.setAttribute('aria-label', 'Huidige tijd, naar het bureaublad');
  var datum = el('span', 'os-datum');
  klokLink.appendChild(tijd);
  klokLink.appendChild(datum);
  bar.appendChild(klokLink);

  var accountWrap = el('div', 'os-account');
  accountWrap.setAttribute('aria-live', 'polite');

  // optioneel: een "terug"-link in de balk (data-osterug="/pad",
  // data-osterug-label="Naar de site"). Voor apps die naast het bureaublad
  // ook een eigen uitgang willen tonen (zoals het ledenportaal -> de site).
  var terugPad = body.getAttribute('data-osterug');
  if (terugPad) {
    var terug = el('a', 'os-terug', '← ' + (body.getAttribute('data-osterug-label') || 'Terug'));
    terug.href = terugPad;
    accountWrap.appendChild(terug);
  }
  var chip = el('a', 'os-chip leeg');
  chip.href = BUREAU;
  var stip = el('span', 'os-stip');
  stip.setAttribute('aria-hidden', 'true');
  chip.appendChild(stip);
  var chipTekst = el('span', null, 'Aanmelden');
  chip.appendChild(chipTekst);
  accountWrap.appendChild(chip);
  bar.appendChild(accountWrap);

  body.insertBefore(bar, body.firstChild);

  // ---- de levende klok ----
  var DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  var MND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  function tweeCijfers(n) { return (n < 10 ? '0' : '') + n; }
  function tik() {
    var nu = new Date();
    tijd.textContent = tweeCijfers(nu.getHours()) + ':' + tweeCijfers(nu.getMinutes());
    datum.textContent = DAGEN[nu.getDay()] + ' ' + nu.getDate() + ' ' + MND[nu.getMonth()];
  }
  tik();
  var klokTimer = setInterval(tik, 15000);
  if (klokTimer && klokTimer.unref) klokTimer.unref();

  // ---- het actieve account tonen (best effort; faalt stil) ----
  try {
    if (w.RTGAccounts && w.RTGAccounts.maak) {
      var kluis = w.RTGAccounts.maak();
      var acc = kluis.huidig(wereld);
      if (acc && acc.label) {
        chip.className = 'os-chip';
        chipTekst.textContent = '';
        var naam = el('b', null, acc.label);
        chipTekst.appendChild(naam);
        var wdef = (w.RTGAccounts.WERELDEN && w.RTGAccounts.WERELDEN[wereld]) || null;
        if (wdef && wdef.naam) {
          var rol = el('span', 'os-rol', ' · ' + wdef.naam);
          rol.style.color = 'var(--os-grijs-zacht)';
          chipTekst.appendChild(rol);
        }
        chip.setAttribute('aria-label', 'Account ' + acc.label + ', wissel op het bureaublad');
      } else {
        chip.setAttribute('aria-label', 'Nog niet aangemeld, naar het bureaublad');
      }
    }
  } catch (e) { /* de balk blijft gewoon staan met "Aanmelden" */ }

  // ---- telefoongevoel: de home-indicator onderin ----
  // Een tik gaat naar het bureaublad; omhoog vegen laat de app onder de
  // vinger wegkrimpen en sluit hem dan (net als op een telefoon). Op het
  // bureaublad zelf is er niets te sluiten, dus daar geen indicator.
  var opBureau = location.pathname.replace(/\/+$/, '') === BUREAU.replace(/\.html$/, '') || location.pathname === BUREAU;
  if (!opBureau) {
    var pil = el('button', 'os-thuis-pill');
    pil.type = 'button';
    pil.setAttribute('aria-label', 'Naar het bureaublad; omhoog vegen sluit de app');
    body.appendChild(pil);

    var rustig = false;
    try { rustig = w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    function naarBureau() {
      if (rustig) { location.href = BUREAU; return; }
      body.style.transform = ''; body.style.opacity = '';
      body.classList.add('os-weg');
      setTimeout(function () { location.href = BUREAU; }, 190);
    }

    var startY = null, dy = 0, veegde = false;
    pil.addEventListener('pointerdown', function (e) {
      startY = e.clientY; dy = 0; veegde = false;
      try { pil.setPointerCapture(e.pointerId); } catch (x) {}
    });
    pil.addEventListener('pointermove', function (e) {
      if (startY == null) return;
      dy = Math.max(0, startY - e.clientY);
      if (dy > 8) veegde = true;
      if (rustig || !veegde) return;
      // de app volgt de vinger: krimpen richting het bureaublad
      var p = Math.min(dy / 260, 1);
      body.style.transformOrigin = '50% 85%';
      body.style.transform = 'scale(' + (1 - p * 0.16).toFixed(4) + ') translateY(' + Math.round(-dy * 0.35) + 'px)';
      body.style.opacity = String(1 - p * 0.25);
    });
    function los() {
      if (startY == null) return;
      var d = dy; startY = null;
      if (!veegde) return;
      if (d > 70) { naarBureau(); return; }
      // niet ver genoeg: rustig terugveren
      body.classList.add('os-terugvering');
      body.style.transform = ''; body.style.opacity = '';
      setTimeout(function () { body.classList.remove('os-terugvering'); }, 240);
    }
    pil.addEventListener('pointerup', los);
    pil.addEventListener('pointercancel', los);
    pil.addEventListener('click', function () {
      if (veegde) { veegde = false; return; } // de veeg is al afgehandeld
      naarBureau();
    });
  }

  w.RTGosbar = { tik: tik };
})(window, document);
