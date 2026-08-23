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

  /* Het pakket en het verbruik OP HET SCHERM, en niet pas in een 429. Een
     grens waar je tegenaan loopt zonder hem te hebben zien naderen, voelt als
     een storing; dezelfde grens met een teller ernaast is een afspraak. */
  function contract(b) {
    var el = document.getElementById('wkContract');
    if (!el) return;
    var c = b && b.contract;
    if (!c) {
      el.innerHTML = '<p class="stil">Deze werkruimte hoort bij geen enkele organisatie met een contract, dus er geldt geen pakket en geen grens.</p>';
      return;
    }
    var rij = function (l, r) { return '<div class="item"><span>' + esc(l) + '</span><span class="stil">' + esc(r) + '</span></div>'; };
    el.innerHTML =
      rij('Pakket', c.naam + (c.tot ? ' \u00b7 tot ' + c.tot : '')) +
      rij('Werkruimtes', c.verbruik.werkruimtes + ' van ' + c.grenzen.werkruimtes) +
      rij('Verzoeken dit uur', c.verbruik.apiDitUur + ' van ' + c.grenzen.apiPerUur) +
      (c.let ? '<p class="stil">' + esc(c.let) + '</p>' : '') +
      '<p class="stil">Wat hier NIET onder valt: ' +
      esc(c.nietAfgedwongen.map(function (n) { return n.grens; }).join(', ')) +
      '. Die grenzen worden nergens gemeten, dus ze gelden ook niet.</p>';
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
          toon(b); contract(b); nietGebouwd(b);
          return b;
        })
        .catch(function () { return null; });   // een merk dat niet laadt, laat het werk staan
    }
  };
})();
