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

  w.RTGosbar = { tik: tik };
})(window, document);
