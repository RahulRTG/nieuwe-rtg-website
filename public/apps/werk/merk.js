/* RTG Werk OS (scherm): het merk van de klant boven zijn eigen werkruimte.

   DRIE REGELS DIE DIT SCHERM NIET MAG BREKEN, en ze staan hier omdat ze hier
   te breken zijn:

   1. HET MERK GELDT BINNEN ZIJN EIGEN BLOK. De accentkleur gaat op de
      werkbalk van de werkruimte en verder nergens. Dezelfde grens die
      test/mediazaak.e2e.js voor de leden-app afrekent: een tenant die de hele
      app kan omverven, kan iemand laten denken dat hij ergens anders is dan
      hij is.
   2. DE HERKOMSTREGEL GAAT NOOIT UIT. Ook in de modus 'private', waar het
      RTG-merk uit de schil verdwijnt, blijft in de voet staan wiens software
      dit is. Dat is geen merkvraag maar een AVG-vraag, en het antwoord mag
      niet van een verkoopcontract afhangen. De server stuurt hem mee; dit
      scherm heeft geen schakelaar om hem weg te laten.
   3. GEEN TENANT IS GEEN MERK. Hoort deze werkruimte bij geen enkele klant,
      dan blijft de balk weg -- er komt geen verzonnen standaardmerk voor in de
      plaats, want dan leest een losse werkruimte als een klant die er geen is.

   Wat de server zegt over wat hij NIET stuurt (nietGebouwd) komt hier ook op
   het scherm, en met de reden erbij. Anders is de enige plek waar het staat de
   JSON die niemand opent. */
(function () {
  'use strict';
  var K = window.RTGWerk;

  function esc(t) { return K.esc(t); }

  function toon(b) {
    var balk = document.getElementById('wkMerk');
    if (!balk) return;
    var shell = document.querySelector('.wk-shell');
    if (!b || !b.merk) {                       // regel 3: geen tenant, geen merk
      balk.hidden = true;
      if (shell) shell.style.removeProperty('--wk-merk-accent');
      return;
    }
    var m = b.merk.merk || {};
    // regel 1: alleen deze eigenschap, en alleen op de schil van de werkruimte
    if (shell && m.accent) shell.style.setProperty('--wk-merk-accent', m.accent);

    balk.innerHTML =
      (m.logo ? '<img class="wk-merk-logo" src="' + esc(m.logo) + '" alt="">' : '') +
      '<div class="wk-merk-naam"><b>' + esc(m.naam) + '</b>' +
      (m.payoff ? '<span>' + esc(m.payoff) + '</span>' : '') + '</div>' +
      '<div class="wk-merk-voet">' + esc(b.merk.herkomst) +
      ' <span class="stil">' + esc(b.merk.grens) + '</span></div>';
    balk.hidden = false;
  }

  function nietGebouwd(b) {
    var el = document.getElementById('wkNietGebouwd');
    if (!el) return;
    var rijen = (b && b.nietGebouwd) || [];
    el.innerHTML = rijen.length
      ? rijen.map(function (n) {
        return '<div class="item"><span>' + esc(n.veld) + '</span><span class="stil">' + esc(n.reden) + '</span></div>';
      }).join('')
      : '<p class="stil">Niets te melden.</p>';
  }

  window.RTGWerkMerk = {
    laad: function () {
      var s = K.sessie();
      if (!s) return Promise.resolve(null);
      return fetch('/api/tenant/bootstrap', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) {
          var b = d.bootstrap || null;
          toon(b); nietGebouwd(b);
          return b;
        })
        .catch(function () { return null; });   // een merk dat niet laadt, laat het werk staan
    }
  };
})();
