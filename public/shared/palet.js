/* Het ROS-palet (gedeeld): een universele springplank over het hele OS.
   Ctrl/Cmd+K (of RTGPalet.open()) opent een zoekvel: typ en spring naar
   elke app uit de canonieke catalogus (shared/rosapps.js), met je
   recente apps bovenaan en Rahul als vangnet -- staat het er niet
   tussen, dan opent de vraag zo in de metgezel. Pijltjes en Enter
   werken; Esc sluit. Puur client-side, geen verkeer tot je springt.
   Sneltoets: Ctrl/Cmd+Spatie (Ctrl+K blijft van de app zelf). */
(function () {
  'use strict';
  if (window.RTGPalet) return;
  var open = false, wrap = null, lijst = [], keus = 0;
  var en = function () {
    try { return (localStorage.getItem('rtg_lang') || 'nl').indexOf('en') === 0; } catch (e) { return false; }
  };
  var T = function (nl, uk) { return en() ? uk : nl; };

  function recent() {
    try { return JSON.parse(localStorage.getItem('rtg_palet_recent') || '[]'); } catch (e) { return []; }
  }
  function onthoud(url) {
    try {
      var r = recent().filter(function (u) { return u !== url; });
      r.unshift(url);
      localStorage.setItem('rtg_palet_recent', JSON.stringify(r.slice(0, 6)));
    } catch (e) {}
  }

  function apps() {
    var alle = (window.RTGApps || []).slice();
    var r = recent();
    alle.sort(function (a, b) {
      var ia = r.indexOf(a.url), ib = r.indexOf(b.url);
      if (ia < 0) ia = 99; if (ib < 0) ib = 99;
      return ia - ib;
    });
    return alle;
  }

  function maak() {
    wrap = document.createElement('div');
    wrap.id = 'rosPalet';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', T('ROS-palet', 'ROS palette'));
    wrap.style.cssText = 'position:fixed;inset:0;z-index:80;background:rgba(12,12,11,0.6);backdrop-filter:blur(6px);display:flex;align-items:flex-start;justify-content:center;padding:12vh 1rem 0;';
    var kaart = document.createElement('div');
    kaart.style.cssText = 'width:min(560px,94vw);background:#151312;border:1px solid #857007;border-radius:0;box-shadow:0 24px 80px rgba(0,0,0,0.6);overflow:hidden;font-family:Inter,system-ui,sans-serif;';
    var inp = document.createElement('input');
    inp.id = 'rosPaletIn';
    inp.type = 'text';
    inp.setAttribute('aria-label', T('Zoek in het hele ROS', 'Search across ROS'));
    inp.placeholder = T('Spring naar een app, of vraag het Rahul...', 'Jump to an app, or ask Rahul...');
    inp.style.cssText = 'width:100%;background:transparent;border:0;outline:none;color:#F4F1EC;font:inherit;font-size:1rem;padding:0.95rem 1.1rem;border-bottom:1px solid rgba(255,255,255,0.1);';
    var ul = document.createElement('div');
    ul.id = 'rosPaletLijst';
    ul.setAttribute('role', 'listbox');
    ul.style.cssText = 'max-height:46vh;overflow-y:auto;padding:0.4rem;';
    kaart.appendChild(inp); kaart.appendChild(ul);
    wrap.appendChild(kaart);
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) sluit(); });
    inp.addEventListener('input', function () { vul(inp.value); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { keus = Math.min(keus + 1, lijst.length - 1); teken(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { keus = Math.max(keus - 1, 0); teken(); e.preventDefault(); }
      else if (e.key === 'Enter') { kies(keus); e.preventDefault(); }
      else if (e.key === 'Escape') { sluit(); e.preventDefault(); }
    });
    vul('');
    inp.focus();
  }

  function vul(q) {
    q = String(q || '').trim().toLowerCase();
    lijst = apps().filter(function (a) { return !q || a.naam.toLowerCase().indexOf(q) >= 0; }).slice(0, 8)
      .map(function (a) { return { soort: 'app', naam: a.naam, url: a.url }; });
    if (q) lijst.push({ soort: 'rahul', naam: T('Vraag Rahul: ', 'Ask Rahul: ') + q, vraag: q });
    keus = 0;
    teken();
  }

  function teken() {
    var ul = wrap.querySelector('#rosPaletLijst');
    ul.textContent = '';
    lijst.forEach(function (r, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.style.cssText = 'display:flex;align-items:center;gap:0.6rem;width:100%;text-align:left;background:' +
        (i === keus ? 'rgba(133,112,7,0.18)' : 'transparent') + ';border:0;border-radius:0;padding:0.6rem 0.8rem;color:#F4F1EC;font:inherit;font-size:0.9rem;cursor:pointer;';
      var teken2 = document.createElement('span');
      teken2.textContent = r.soort === 'rahul' ? '✶' : '→';
      teken2.style.cssText = 'color:#857007;font-size:0.85rem;min-width:1rem;';
      var naam = document.createElement('span');
      naam.textContent = r.naam;
      b.appendChild(teken2); b.appendChild(naam);
      b.addEventListener('click', function () { kies(i); });
      ul.appendChild(b);
    });
  }

  function kies(i) {
    var r = lijst[i]; if (!r) return;
    if (window.RTGWauw) RTGWauw.tik(6);
    if (r.soort === 'app') {
      onthoud(r.url);
      sluit();
      location.href = r.url;
    } else {
      sluit();
      /* het vangnet: de vraag gaat naar de metgezel-Rahul op deze pagina */
      var fab = document.querySelector('.mgz-rahul, #rahulFab');
      if (fab) {
        fab.click();
        setTimeout(function () {
          var veld = document.querySelector('.mgz-sheet input, #rahulVraag, .mgz-rij input');
          if (veld) { veld.value = r.vraag; veld.dispatchEvent(new Event('input', { bubbles: true })); veld.focus(); }
        }, 250);
      }
    }
  }

  function toon() {
    if (open) return;
    open = true;
    if (!window.RTGApps) {
      /* de catalogus lazy erbij; het palet opent zodra hij er is */
      var s = document.createElement('script');
      s.src = '/shared/rosapps.js';
      s.onload = function () { if (open) maak(); };
      s.onerror = function () { if (open) maak(); };
      document.head.appendChild(s);
      return;
    }
    maak();
  }
  function sluit() {
    open = false;
    if (wrap) { wrap.remove(); wrap = null; }
  }

  /* Ctrl/Cmd+Spatie: het OS-niveau (Spotlight-gevoel); Ctrl+K blijft
     vrij voor het eigen zoekvel van een app. */
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.code === 'Space') { e.preventDefault(); open ? sluit() : toon(); }
  });

  window.RTGPalet = { open: toon, sluit: sluit };
})();
