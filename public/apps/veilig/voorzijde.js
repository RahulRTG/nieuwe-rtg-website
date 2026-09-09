/* Mobiele bediening voor de vijf zichtbare ingangen; de vier functies blijven
   geregistreerde RTG Veilig-standen en gebruiken hun bestaande routes. */
(function (w, d) {
  'use strict';
  var nav = d.querySelector('.veilig-nav'), meer = d.getElementById('veiligMeer');
  if (!nav || !meer) return;

  function actief(id) {
    nav.querySelectorAll('[data-veilig-nav]').forEach(function (b) {
      var aan = b.dataset.veiligNav === id || (b.dataset.veiligNav === 'meer' && (id === 'codewoord' || id === 'rust'));
      if (aan) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }
  function dicht() { meer.hidden = true; nav.querySelector('[data-veilig-nav="meer"]').setAttribute('aria-expanded', 'false'); }
  function toon(id) { dicht(); if (w.RTGVeilig && w.RTGVeilig.toon) w.RTGVeilig.toon(id); actief(id); scrollTo({ top: 0, behavior: 'smooth' }); }
  function kring() {
    dicht(); var k = d.getElementById('kring'); if (k) k.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { var i = d.getElementById('kringIn'); if (i) i.focus(); }, 350);
  }

  nav.addEventListener('click', function (e) {
    var b = e.target.closest('[data-veilig-nav]'); if (!b) return;
    var id = b.dataset.veiligNav;
    if (id === 'meer') { meer.hidden = !meer.hidden; b.setAttribute('aria-expanded', String(!meer.hidden)); }
    else if (id === 'kring') kring(); else toon(id);
  });
  meer.addEventListener('click', function (e) {
    if (e.target === meer || e.target.closest('.veilig-meer-sluit')) return dicht();
    var b = e.target.closest('[data-veilig-open]'); if (b) toon(b.dataset.veiligOpen);
  });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') dicht(); });
  d.addEventListener('rtgveiligstand', function (e) { actief(e.detail); });
  d.addEventListener('rtgveiligkring', kring);
  actief((location.hash || '#vandaag').slice(1));
})(window, document);
