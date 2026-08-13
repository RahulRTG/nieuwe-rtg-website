(function () {
  'use strict';

  var balk = document.querySelector('.wk-rahul');
  var knop = document.getElementById('wkMouth');
  var veld = document.getElementById('wkRahulInput');
  if (!balk || !knop || !veld) return;

  var vergroot = document.getElementById('wkRahulExpand');
  var tab = document.getElementById('wkRahulTab');

  function toon(open) {
    balk.classList.toggle('page', open);
    balk.hidden = !open;
    document.querySelectorAll('.wk-tabs>button').forEach(function (item) { item.classList.toggle('actief', open ? item === tab : item === document.querySelector('.wk-tabs>button')); });
    vergroot.setAttribute('aria-expanded', open ? 'true' : 'false');
    vergroot.setAttribute('aria-label', open ? 'Verklein Rahul naar zijbalk' : 'Vergroot Rahul tot pagina');
    vergroot.textContent = open ? '↙' : '↗';
    if (open) setTimeout(function () { veld.focus(); }, 180);
  }

  balk.hidden = true;
  knop.onclick = function () { veld.focus(); };
  tab.onclick = function () { toon(true); };
  vergroot.onclick = function () { toon(!balk.classList.contains('page')); };
  veld.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') toon(false);
  });
})();
