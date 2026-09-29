/* "Overal afmelden" per profiel, op het beheerscherm van het gezin.

   De gezinssessie is sinds 29 september 2026 een 128-bit token dat alleen als
   hash op de server staat (server/foundation/gezinstoken.js). De beheerder kan
   elke sessie van een profiel tegelijk sluiten -- ook op een apparaat dat hij
   niet meer ziet: een oude telefoon, het logeeradres, de tablet van de oppas.
   Hij krijgt daarbij nooit de sleutel van een ander te zien; wie weer binnen wil
   logt in met de gezinscode en zijn eigen pincode.

   Eigen bestand, omdat beheer.html al groot is: dit hangt een knop aan elke rij
   van #plist zodra die er staat, en verandert verder niets aan het scherm. */
(function (w, d) {
  function knop(rij, id) {
    if (rij.querySelector('[data-afm]')) return;
    var sp = rij.querySelector('.sp'); if (!sp) return;
    var b = d.createElement('button');
    b.type = 'button'; b.className = 'knop grijs klein'; b.dataset.afm = id;
    b.textContent = 'Overal afmelden';
    b.title = 'Sluit elke sessie van dit profiel, op elk apparaat. Opnieuw inloggen kan met de gezinscode en de eigen pincode.';
    b.onclick = function () {
      if (!w.confirm('Dit profiel op elk apparaat afmelden? Opnieuw inloggen kan met de gezinscode en de eigen pincode.')) return;
      var s = w.Sessie && w.Sessie.huidig(); if (!s) return;
      b.disabled = true;
      w.Sessie.api('/gezin/sessie/intrek', { code: s.code, token: s.token, profielId: id }).then(function () {
        b.textContent = 'Afgemeld';
        if (s.profiel && s.profiel.id === id) { w.Sessie.uitloggen(); w.location.href = 'index.html'; }
      }, function (e) { b.disabled = false; w.alert(e.message); });
    };
    sp.insertBefore(b, sp.firstChild);
  }
  function tuig() {
    var pl = d.getElementById('plist'); if (!pl) return;
    var bij = function () {
      Array.prototype.forEach.call(pl.querySelectorAll('.prow'), function (rij) {
        var bew = rij.querySelector('[data-bew]'); if (bew) knop(rij, bew.dataset.bew);
      });
    };
    new w.MutationObserver(bij).observe(pl, { childList: true });
    bij();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', tuig); else tuig();
})(window, document);
