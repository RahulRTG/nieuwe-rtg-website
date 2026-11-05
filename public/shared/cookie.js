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
  function meetRuimte() {
    if (ds || !el.isConnected) return;
    var h = Math.ceil(el.getBoundingClientRect().height) + 12;
    document.documentElement.style.setProperty(RUIMTE, h + 'px');
  }
  function geefRuimteTerug() {
    document.documentElement.style.removeProperty(RUIMTE);
    document.documentElement.style.removeProperty(BODEM);
    if (document.body && document.body.classList) document.body.classList.remove('ds-cookie-host');
  }

  knop.addEventListener('click', function () {
    try { localStorage.setItem(SLEUTEL, new Date().toISOString()); } catch (e) {}
    el.remove();
    geefRuimteTerug();
  });
/* Positioneert de toestemmingsbediening veilig boven vaste schermlagen. */\n  function vasteOnderbalk() {
    if (ds || !document.elementsFromPoint) return;
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var stapel = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2) || [];
    for (var i = 0; i < stapel.length; i++) {
      for (var n = stapel[i]; n && n.nodeType === 1; n = n.parentElement) {
        if (n === el || el.contains(n)) continue;
        var b = n.getBoundingClientRect();
        if (getComputedStyle(n).position !== 'fixed') continue;
        if (b.bottom >= innerHeight - 2 && b.height > 24 && b.height < innerHeight / 2) {
          document.documentElement.style.setProperty(BODEM, Math.ceil(b.height) + 'px');
          return;
        }
      }
    }
    document.documentElement.style.removeProperty(BODEM);
  }

  function plaats() {
    if (ds) {
      /* Een DS-host reserveert ruimte in de documentstroom. */
      var vlak = document.querySelector('.ds-wereldwerkruimte .wd-page') || document.body;
      vlak.insertBefore(el, vlak.firstChild);
      return;
    }
    /* Oudere hosts behouden hun bestaande overlaypositie, maar de vormgeving
       en gereserveerde ruimte hebben nu een centrale DS-owner. */
    if (document.body.classList) document.body.classList.add('ds-cookie-host');
    document.body.appendChild(el);
    vasteOnderbalk();
    meetRuimte();
    if (window.requestAnimationFrame) window.requestAnimationFrame(function () {
      vasteOnderbalk();
      meetRuimte();
    });
    window.addEventListener('resize', function () {
      vasteOnderbalk();
      meetRuimte();
    });
    if (window.ResizeObserver) {
      var maatkijker = new window.ResizeObserver(meetRuimte);
      maatkijker.observe(el);
    }
  }
  if (document.body) plaats(); else document.addEventListener('DOMContentLoaded', plaats);
})();
