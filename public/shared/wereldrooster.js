/* HET ROOSTER VAN EEN WERELD -- alles wat erin hangt, uit de bron.

   WAAROM DIT ER IS. Elk wereldhuis droeg een HANDGESCHREVEN lijst diensten, en
   die liep uit de pas met MAPPEN -- de enige lijst werelden (WERELD.md). Zo
   waren Passkeys en de wereldlaag onbereikbaar terwijl ze wel degelijk in een
   wereld hingen: ze stonden in de lijst en niet op het huis. Gevonden met
   scripts/tikken.js (TIKKEN.md).

   Dit blok verzint dus niets en cureert niets: het toont ALLES wat in deze
   wereld hangt, afgeleid uit shared/sprongindex.json (dat weer uit MAPPEN komt).
   De redactionele roosters op de huizen blijven staan -- die zijn gemaakt om te
   VERLEIDEN, dit is gemaakt om compleet te zijn, en dat zijn twee dingen. Wie
   ze samenvoegt, krijgt of een onvolledige etalage of een saaie.

   De pas doet hier niets weg. Wat uw pas niet opent draagt een LABEL, net als op
   het huis van LivingOS. Een lijst die dingen weglaat is niet vindbaar; een
   lijst die belooft wat u niet krijgt, is een leugen. Een label is geen van
   beide.

   Gebruik: <div data-wereldrooster="LivingOS"></div> */
(function (w, d) {
  'use strict';
  if (w.RTGWereldrooster) return;

  function teken(vak, items) {
    var wereld = vak.getAttribute('data-wereldrooster');
    var mijn = items.filter(function (i) { return i.wereld === wereld && i.url && !i.huis; });
    if (!mijn.length) return;                 // niets te tonen is geen storing
    vak.textContent = '';
    mijn.forEach(function (i) {
      var a = d.createElement('a');
      a.className = 'kaart rtg-wereldrooster-kaart';
      a.href = i.url;
      var b = d.createElement('b'); b.textContent = i.naam; a.appendChild(b);
      if (i.label) { var s = d.createElement('span'); s.className = 'laaglabel'; s.textContent = i.label; a.appendChild(s); }
      vak.appendChild(a);
    });
    vak.dataset.gevuld = String(mijn.length);
  }

  function start() {
    var vakken = d.querySelectorAll('[data-wereldrooster]');
    if (!vakken.length) return;
    fetch('/shared/sprongindex.json', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : { items: [] }; })
      .then(function (j) { (j.items || []).length && vakken.forEach(function (v) { teken(v, j.items); }); })
      .catch(function () { /* geen lijst: dan blijft het redactionele rooster staan */ });
  }

  w.RTGWereldrooster = { start: start };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})(window, document);
