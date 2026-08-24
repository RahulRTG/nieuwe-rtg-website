/* RTG Werk OS (scherm): de gedeelde bedrading.

   De sessie is anders dan overal elders in dit huis, en dat is met opzet: een
   werkruimtelid is GEEN RTG-lid. Hij heeft een werkruimtecode en een
   lid-token, en die twee staan hier in de opslag van de browser. Wie zijn
   RTG-account erbij wil, koppelt dat een keer -- maar het een kan zonder het
   ander, want een werkruimte hoort ook te werken voor iemand die geen RTG-pas
   heeft.

   Uitgelogd toont de pagina zijn eigen inlogkaart op de plek waar de inhoud
   hoort, en stuurt niemand weg (dezelfde regel als TAKEN 5.5). */
(function () {
  'use strict';
  if (window.RTGWerk) return;
  var SLEUTEL = 'rtg_werk_sessie';
  var sessie = null;
  try { sessie = JSON.parse(localStorage.getItem(SLEUTEL) || 'null'); } catch (e) {}

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  window.RTGWerk = {
    esc: esc,
    euro: function (c) { return '€ ' + ((c || 0) / 100).toFixed(2); },
    sessie: function () { return sessie; },
    bewaar: function (s) {
      sessie = s;
      try { localStorage.setItem(SLEUTEL, JSON.stringify(s)); } catch (e) {}
    },
    wis: function () {
      sessie = null;
      try { localStorage.removeItem(SLEUTEL); } catch (e) {}
    },
    meld: function (t) {
      var m = document.getElementById('melding');
      if (!m) return;
      m.textContent = t; m.classList.add('zie');
      clearTimeout(window.RTGWerk._t);
      window.RTGWerk._t = setTimeout(function () { m.classList.remove('zie'); }, 3500);
    },
    /* Elke aanroep draagt de sessie mee; er is geen verborgen staat op de
       server. Een 403 betekent dat de sleutel niet (meer) werkt, en dan gaat
       de inlogkaart weer open in plaats van dat het scherm leeg blijft. */
    api: function (pad, body) {
      var lijf = Object.assign({}, body || {}, sessie || {});
      return fetch('/api/bedrijf' + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lijf) })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (b) {
            /* TWEE SOORTEN 403, EN ZE HOREN NIET HETZELFDE TE BETEKENEN.

               Hier stond: elke 403 wist de sessie en gooide de inlogkaart open.
               Dat klopt voor "verkeerd lid-token", maar niet voor "daar heeft u
               het recht X voor nodig" -- en dat tweede is de gewone gang van
               zaken in een werkruimte met rollen. Gevolg: wie het recht `cijfer`
               miste werd bij het LADEN uitgelogd, want het startscherm haalt het
               directiebeeld op en dat vraagt dat recht. Zijn sleutel was prima;
               het scherm zei alleen iets anders.

               De server maakt het onderscheid al: een rechtenweigering draagt
               het veld `recht`, een sleutelweigering niet. Daar leunen we op --
               en op niets anders, want een tekstvergelijking op de foutmelding
               breekt zodra iemand een woord verandert. */
            var rechtenfout = b && typeof b.recht === 'string';
            if (r.status === 403 && sessie && !rechtenfout) { window.RTGWerk.wis(); window.RTGWerk.poort(); }
            return { status: r.status, body: b };
          });
        });
    },
    /* De weg naar binnen zonder token overtypen: wie als RTG-lid is ingelogd,
       vraagt zijn eigen werkruimtes op. De eigenaar krijgt de zijne daarbij
       aangemaakt als hij er nog geen had -- dat was de ontbrekende deur. */
    viaLid: function () {
      var lid = null;
      try { lid = localStorage.getItem('rtg_member_token'); } catch (e) {}
      if (!lid || sessie) return Promise.resolve(false);
      return fetch('/api/bedrijf/mijn', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lid },
        body: '{}' })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) {
          var w = (d.werkruimtes || [])[0];
          if (!w) return false;
          window.RTGWerk.bewaar({ werkruimte: w.werkruimte, lidToken: w.lidToken });
          window.RTGWerk._welkom = w;
          return true;
        })
        .catch(function () { return false; });
    },
    poort: function () {
      var kaart = document.getElementById('inlog');
      var inhoud = document.getElementById('inhoud');
      if (!kaart || !inhoud) return !!sessie;
      kaart.hidden = !!sessie;
      inhoud.hidden = !sessie;
      return !!sessie;
    },
    rij: function (links, rechts) {
      return '<div class="item"><span>' + links + '</span><span class="stil">' + rechts + '</span></div>';
    },
    knop: function (tekst, data, primair) {
      var attr = Object.keys(data || {}).map(function (k) { return ' data-' + k + '="' + esc(data[k]) + '"'; }).join('');
      return '<button class="knop' + (primair ? ' p' : '') + '" type="button"' + attr + '>' + esc(tekst) + '</button>';
    },
    bind: function (wortel, attr, doen) {
      Array.prototype.forEach.call(wortel.querySelectorAll('[data-' + attr + ']'), function (b) {
        b.addEventListener('click', function () { doen(b); });
      });
    },
    // een lijst met een eerlijke lege stand: nooit een leeg vak zonder uitleg
    lijst: function (el, rijen, leeg) {
      el.innerHTML = rijen.length ? rijen.join('') : '<p class="stil">' + esc(leeg) + '</p>';
    }
  };
})();
