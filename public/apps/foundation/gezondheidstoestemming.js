/* TOESTEMMING VOOR GEZONDHEIDSGEGEVENS, APART EN BIJ EERSTE GEBRUIK
   (server: foundation/gezondheidstoestemming.js, DPIA-GEZIN.md, AVG art. 9).

   RTFToestemming.metToestemming(werk) voert werk() uit. Weigert de server met
   hoe: 'toestemming', dan vraagt dit venster het een ouder of de beheerder
   apart, en pas na "Ja" wordt het werk nog een keer gedaan. Een kind of een
   ander gezinslid krijgt de weigering gewoon terug: die geeft deze toestemming
   niet. Annuleren laat alles zoals het was. */
(function () {
  'use strict';

  function vraag() {
    return new Promise(function (klaar) {
      var dlg = document.createElement('dialog');
      dlg.className = 'kaart';
      dlg.setAttribute('aria-labelledby', 'gtTitel');
      var h = document.createElement('h2'); h.id = 'gtTitel'; h.textContent = 'Gezondheidsgegevens bewaren';
      var p1 = document.createElement('p');
      p1.textContent = 'Allergieën, medicijnen, medische afspraken, groeimetingen en het gevoelsdagboek van kinderen onder de 16 zijn gezondheidsgegevens. Die bewaren we alleen met uw aparte toestemming.';
      var p2 = document.createElement('p');
      p2.textContent = 'Ze liggen versleuteld op schijf en gaan nergens heen. U kunt de toestemming altijd intrekken bij Privacy; dan worden deze gegevens gewist.';
      var rij = document.createElement('div'); rij.style.display = 'flex'; rij.style.gap = '.5rem'; rij.style.marginTop = '1rem';
      var ja = document.createElement('button'); ja.type = 'button'; ja.className = 'knop'; ja.textContent = 'Ja, ik geef toestemming';
      var nee = document.createElement('button'); nee.type = 'button'; nee.className = 'knop grijs'; nee.textContent = 'Niet nu';
      rij.appendChild(ja); rij.appendChild(nee);
      [h, p1, p2, rij].forEach(function (x) { dlg.appendChild(x); });
      function sluit(v) { try { dlg.close(); } catch (e) {} dlg.remove(); klaar(v); }
      ja.addEventListener('click', function () { sluit(true); });
      nee.addEventListener('click', function () { sluit(false); });
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); sluit(false); });
      document.body.appendChild(dlg);
      dlg.showModal();
    });
  }

  function geef() {
    var s = window.Sessie.huidig();
    return window.Sessie.api('/gezin/toestemming/gezondheid', { code: s.code, token: s.token, aan: true });
  }

  function metToestemming(werk) {
    return Promise.resolve().then(werk).catch(function (e) {
      var d = e && e.data;
      if (!d || d.hoe !== 'toestemming' || !d.magGeven) throw e;
      return vraag().then(function (ja) {
        if (!ja) { var n = new Error('Niet bewaard: daarvoor is uw toestemming nodig.'); n.afgeslagen = true; throw n; }
        return geef().then(werk);
      });
    });
  }

  window.RTFToestemming = { metToestemming: metToestemming };
})();
