(function () {
  'use strict';

  var naam = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/i, '') || 'index';
  document.documentElement.classList.add('rtf-premium');

  function klaar() {
    if (!document.body) return;
    document.body.classList.add('rtf-premium');
    document.body.dataset.rtfPage = naam;

    /* Tekstletters houden de apps rustig en herkenbaar, zonder losse emoji-sets. */
    document.querySelectorAll('.tile').forEach(function (tile) {
      var icoon = tile.querySelector('.ic');
      var titel = tile.querySelector('h2');
      if (!icoon || !titel || icoon.dataset.code || icoon.dataset.glyf || icoon.querySelector('.rtg-glyf')) return;
      var woorden = titel.textContent.trim().replace(/[^A-Za-zÀ-ÿ0-9 ]/g, '').split(/\s+/).filter(Boolean);
      var code = woorden.length > 1 ? woorden.slice(0, 2).map(function (w) { return w[0]; }).join('') : (woorden[0] || 'RT').slice(0, 2);
      icoon.dataset.code = code.toUpperCase();
      icoon.setAttribute('aria-hidden', 'true');
    });

    verbeterAvatars(document);
    voegVeiligheidToe();
    voegIosMerkToe();
    maakZoeken();
  }

  var avatarMarkeringen = {
    ster:'ST', kompas:'KO', boek:'BK', maan:'MA', zon:'ZN', vonk:'VK', bloei:'BL', golf:'GL',
    'emo-blij':'RT', pas:'RT'
  };
  function avatarMarkering(waarde, naamTekst) {
    var sleutel = String(waarde || '').trim().toLowerCase();
    if (avatarMarkeringen[sleutel]) return avatarMarkeringen[sleutel];
    if (sleutel && /^[a-z0-9-]{1,24}$/.test(sleutel)) return sleutel.slice(0, 2).toUpperCase();
    var bron = String(naamTekst || waarde || 'RT').trim();
    var woorden = bron.split(/\s+/).filter(Boolean);
    return (woorden.length > 1 ? woorden.slice(0, 2).map(function (w) { return w[0]; }).join('') : bron.slice(0, 2)).toUpperCase();
  }
  function verbeterAvatars(root) {
    var elementen = [];
    if (root.matches && root.matches('.av[data-avatar],.avkies button[data-avatar]')) elementen.push(root);
    elementen = elementen.concat(Array.from(root.querySelectorAll ? root.querySelectorAll('.av[data-avatar],.avkies button[data-avatar]') : []));
    elementen.forEach(function (el) {
      el.dataset.mark = avatarMarkering(el.dataset.avatar, el.getAttribute('aria-label'));
      Array.from(el.childNodes).forEach(function (node) { if (node.nodeType === 3) node.remove(); });
    });
  }
  window.RTFPremium = { verbeterAvatars: verbeterAvatars, avatarMarkering: avatarMarkering };

  function voegVeiligheidToe() {
    var balk = document.querySelector('.topnav');
    if (!balk || balk.querySelector('.rtf-inline-safe')) return;
    var status = document.createElement('span');
    status.className = 'rtf-inline-safe';
    status.innerHTML = '<i aria-hidden="true"></i>Veilige omgeving';
    var laatsteLink = balk.querySelector('a:last-of-type');
    balk.insertBefore(status, laatsteLink || null);
  }

  function voegIosMerkToe() {
    var acties = document.querySelector('.ios-nav .ios-nav-acties');
    if (!acties || acties.querySelector('.rtf-ios-brand')) return;
    var merk = document.createElement('span');
    merk.className = 'rtf-ios-brand';
    merk.textContent = 'RTF';
    merk.setAttribute('aria-label', 'Rahul Travel Foundation');
    acties.insertBefore(merk, acties.firstChild);
  }

  function maakZoeken() {
    var hub = document.getElementById('vHub');
    if (!hub || document.getElementById('rtfZoek')) return;
    var eersteSectie = hub.querySelector('h3.sec');
    if (!eersteSectie) return;
    var veld = document.createElement('label');
    veld.className = 'rtf-search';
    veld.innerHTML = '<span class="sr-only">Zoek in Foundation</span><input class="veld" id="rtfZoek" type="search" placeholder="Zoek school, hulp, leren of gezin" autocomplete="off"><span class="rtf-search-status" id="rtfZoekStatus" aria-live="polite"></span>';
    eersteSectie.parentNode.insertBefore(veld, eersteSectie);
    var invoer = veld.querySelector('input');
    var status = veld.querySelector('#rtfZoekStatus');
    invoer.addEventListener('input', function () {
      var vraag = invoer.value.trim().toLocaleLowerCase('nl');
      var zichtbaar = 0;
      hub.querySelectorAll('.tile').forEach(function (tile) {
        var rolVerborgen = tile.style.display === 'none' || tile.hidden;
        var match = !vraag || tile.textContent.toLocaleLowerCase('nl').indexOf(vraag) !== -1;
        tile.classList.toggle('rtf-zoek-weg', !match);
        if (match && !rolVerborgen) zichtbaar += 1;
      });
      hub.querySelectorAll('h3.sec').forEach(function (kop) {
        var grid = kop.nextElementSibling;
        if (!grid || !grid.classList.contains('tiles')) return;
        var iets = Array.from(grid.children).some(function (tile) {
          return !tile.hidden && tile.style.display !== 'none' && !tile.classList.contains('rtf-zoek-weg');
        });
        kop.classList.toggle('rtf-zoek-weg', !iets);
      });
      status.textContent = vraag ? zichtbaar + (zichtbaar === 1 ? ' onderdeel gevonden' : ' onderdelen gevonden') : '';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', klaar);
  else klaar();

  /* Profielen worden na een API-call getekend; verfraai nieuwe avatars mee. */
  if ('MutationObserver' in window) {
    new MutationObserver(function (wijzigingen) {
      wijzigingen.forEach(function (wijziging) {
        wijziging.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) verbeterAvatars(node);
        });
      });
    }).observe(document.documentElement, { childList:true, subtree:true });
  }
})();
