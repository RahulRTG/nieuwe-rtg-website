/* Functionele-opslagmelding. De controller bezit alleen gedrag; vormgeving
   komt voor iedere host uit public/ds/componenten/cookie.css. */
(function () {
  'use strict';
  var SLEUTEL = 'rtg_cookieinfo_v1';
  try { if (window.self !== window.top) return; } catch (e) { return; }
  try { if (localStorage.getItem(SLEUTEL)) return; } catch (e) { return; }

  var ds = document.documentElement.hasAttribute('data-ds');
  var en = false;
  try { en = (window.RTGi18n && RTGi18n.lang === 'en') || /^en/.test(navigator.language || ''); } catch (e) {}
  var T = en
    ? { txt: 'Functional storage only', ok: 'Fine', privacy: 'Privacy' }
    : { txt: 'Alleen functionele opslag', ok: 'Prima', privacy: 'Privacy' };

  var el = document.createElement('div');
  el.id = 'rtg-cookie';
  el.className = 'ds-cookie' + (ds ? '' : ' ds-cookie--overlay');
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', en ? 'Cookie notice' : 'Cookiemelding');

  var p = document.createElement('span');
  p.textContent = T.txt;
  var a = document.createElement('a');
  a.href = '/apps/juridisch/privacy.html';
  a.textContent = T.privacy;
  var knop = document.createElement('button');
  knop.type = 'button';
  knop.textContent = T.ok;
  /* Ongelayerde CSS van een nog niet gemigreerde host wint volgens de cascade
     van een centrale componentlaag. Bewaak daar tijdelijk alleen de harde
     toegankelijkheidsvloer; de waarde blijft het centrale DS-token. */
  if (!ds) {
    a.style.setProperty('min-inline-size', 'var(--ds-doel)');
    a.style.setProperty('min-block-size', 'var(--ds-doel)');
    knop.style.setProperty('min-inline-size', 'var(--ds-doel)');
    knop.style.setProperty('min-block-size', 'var(--ds-doel)');
  }
  el.appendChild(p);
  el.appendChild(a);
  el.appendChild(knop);

  var RUIMTE = '--rtg-cookieruimte';
  var BODEM = '--ds-cookie-bodem';
  var maatkijker, tekstmaatkijker, tekstmaatBezig = false;
  function meetRuimte() {
    if (ds || !el.isConnected) return;
    var h = Math.ceil(el.getBoundingClientRect().height) + 12;
    var waarde = h + 'px';
    if (document.documentElement.style.getPropertyValue(RUIMTE) !== waarde) {
      document.documentElement.style.setProperty(RUIMTE, waarde);
    }
  }
  function geefRuimteTerug() {
    if (maatkijker) maatkijker.disconnect();
    if (tekstmaatkijker) tekstmaatkijker.disconnect();
    document.documentElement.style.removeProperty(RUIMTE);
    document.documentElement.style.removeProperty(BODEM);
    if (document.body && document.body.classList) document.body.classList.remove('ds-cookie-host');
  }

  knop.addEventListener('click', function () {
    try { localStorage.setItem(SLEUTEL, new Date().toISOString()); } catch (e) {}
    el.remove();
    geefRuimteTerug();
  });
