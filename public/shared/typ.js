/* RTG typemachine: Rahuls woorden verschijnen letter voor letter, alsof hij ze
   net uitspreekt. Eén regel tegelijk, geen logboek. Respecteert
   prefers-reduced-motion (dan meteen de hele zin) en is toegankelijk: de
   volledige zin staat direct in aria-label, zodat een schermlezer hem in één
   keer voorleest in plaats van letter voor letter.

   Gebruik: RTGTyp.schrijf(element, tekst, { praat: fn, per: ms, klaar: fn });
   `praat(ms)` (optioneel) laat de mond meebewegen zolang er getypt wordt. Geen
   afhankelijkheden. */
(function (root) {
  if (root.RTGTyp) return;
  var RUSTIG = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lopers = new WeakMap();

  function schrijf(el, tekst, opts) {
    if (!el) return;
    tekst = String(tekst == null ? '' : tekst);
    opts = opts || {};
    var vorige = lopers.get(el);
    if (vorige) { clearInterval(vorige); lopers['delete'](el); }
    el.setAttribute('aria-label', tekst); // schermlezer: de hele zin ineens
    if (RUSTIG || tekst.length <= 1) {
      el.textContent = tekst;
      if (opts.praat) opts.praat(0);
      if (opts.klaar) opts.klaar();
      return;
    }
    // sneller typen naarmate de zin langer is, maar nooit trager dan prettig
    var per = opts.per || Math.max(16, Math.min(46, 1200 / tekst.length));
    if (opts.praat) opts.praat(tekst.length * per + 220);
    el.textContent = '';
    var i = 0;
    var id = setInterval(function () {
      i++;
      el.textContent = tekst.slice(0, i);
      if (i >= tekst.length) { clearInterval(id); lopers['delete'](el); if (opts.klaar) opts.klaar(); }
    }, per);
    lopers.set(el, id);
  }

  root.RTGTyp = { schrijf: schrijf };
})(window);
