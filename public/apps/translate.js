/* Gedeelde vertaalhulp voor de RTG-apps. Iedereen schrijft in de eigen taal;
   de lezer krijgt elk bericht automatisch in zijn gekozen taal te zien, met de
   mogelijkheid het origineel te tonen. Praat met /api/translate (Claude als die
   er is, anders een woordenboek-terugval). Resultaten worden gecachet zodat een
   chat niet steeds opnieuw vertaalt. */
(function (w) {
  var cache = {};
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  var Vertaal = {
    // Vertaal 'text' naar taal 'to' ('nl' of 'en'). Geeft een Promise met
    // { text, vertaald, from }. Bij twijfel of fout: het origineel, vertaald=false.
    naar: function (text, to) {
      text = String(text == null ? '' : text);
      to = to === 'en' ? 'en' : 'nl';
      if (!text.trim()) return Promise.resolve({ text: text, vertaald: false, from: to });
      var key = to + '|' + text;
      if (cache[key]) return Promise.resolve(cache[key]);
      return fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text, to: to }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var res = { text: d && d.text ? d.text : text, vertaald: !!(d && d.translated), from: d && d.from };
          cache[key] = res; return res;
        })
        .catch(function () { return { text: text, vertaald: false, from: to }; });
    },
    // Vul een berichtbel-element in met de vertaling en (indien vertaald) een
    // knopje "origineel <-> vertaling". el moet een leeg element zijn; origineel
    // is de brontekst; to is de gekozen taal van de lezer.
    vul: function (el, origineel, to) {
      if (!el) return;
      // RTG-eigen emoji (sneltekst :naam:) meteen als glyf tonen, ook zolang de
      // vertaling nog laadt of als het bericht al in de goede taal staat.
      var emo = function (s) { return (w.RTGEmoji ? w.RTGEmoji.render(esc(s)) : esc(s)); };
      el.innerHTML = emo(origineel);
      Vertaal.naar(origineel, to).then(function (r) {
        if (!r.vertaald) return; // al in de goede taal
        var toon = 'vertaling';
        function teken() {
          el.innerHTML = '<span class="vt-txt">' + emo(toon === 'vertaling' ? r.text : origineel) + '</span>' +
            ' <button type="button" class="vt-knop" style="background:none;border:none;padding:0;margin-left:.3rem;font-size:.62rem;letter-spacing:.04em;text-transform:uppercase;color:var(--gold,#C9A24B);cursor:pointer;opacity:.75;">' +
            (toon === 'vertaling' ? (to === 'en' ? 'original' : 'origineel') : (to === 'en' ? 'translation' : 'vertaling')) + '</button>';
          var b = el.querySelector('.vt-knop');
          if (b) b.addEventListener('click', function () { toon = (toon === 'vertaling' ? 'origineel' : 'vertaling'); teken(); });
        }
        teken();
      });
    }
  };
  w.Vertaal = Vertaal;
})(window);
