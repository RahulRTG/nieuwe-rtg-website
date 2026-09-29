/* Mijn leerhuis: de EIGEN stappen van de leerling (ACADEMY.md, fase B-UI).

   De leerling zet zelf wat alleen hij kan zetten: beginnen, oefenen, een
   scenario spelen en een beoordeling aanvragen. Wat een ander moet zien --
   onder toezicht werken, klaar voor beoordeling -- zet zijn trainer, en dat
   staat hier dus niet. Er is met opzet geen knop "ik kan dit": een eigen
   verklaring telt in het leerhuis niet als bewijs.

   HIJ BESLIST NIETS. Of een stap mag, zegt lerenStand; wat een simulatie
   waard is, zegt de motor uit het scenario (acties-simulatie.js). De stappen
   van een scenario staan hier door elkaar en op alfabet: welke vereist en welke
   verboden zijn, hoort de leerling pas na het spelen. Een mislukte poging laat
   geen bewijs achter. Elke knop gaat via leerhuis-deur.js, met zijn sleutel. */
'use strict';
window.RTGLeerhuisMijn = function (h) {
  var maak = h.maak, knop = h.knop, doe = h.doe;
  var ZELF = { ASSIGNED: ['LEARNING', 'Ik begin met leren', 'u bent begonnen met leren'],
    LEARNING: ['PRACTICING', 'Ik ga oefenen', 'u oefent nu'],
    PRACTICING: ['SIMULATING', 'Ik ga een scenario spelen', 'u speelt nu scenario\'s'],
    NOT_YET_PROVEN: ['PRACTICING', 'Ik ga opnieuw oefenen', 'u oefent opnieuw'] };
  function rij(knoppen) { var r = maak('div', 'rij'); knoppen.forEach(function (k) { r.appendChild(k); }); return r; }

  function pad(k, x) {
    var z = ZELF[x.stand];
    if (z) k.appendChild(rij([knop(z[1], false, function () {
      doe('leren:' + x.curriculum + ':' + z[0], 'lerenStand', { persoon: h.ik(), curriculum: x.curriculum, naar: z[0] },
        'Vastgelegd: ' + z[2] + '.');
    })]));
    if (x.stand !== 'READY_FOR_ASSESSMENT') return;
    (x.vaardigheden || []).forEach(function (v) {
      if (v.loopt) { k.appendChild(maak('p', 'meta', 'Er loopt een beoordeling voor ' + v.naam + '.')); return; }
      k.appendChild(rij([knop('Beoordeling aanvragen voor ' + v.naam, false, function () {
        doe('aanvraag:' + v.id, 'beoordelingAanvragen', { persoon: h.ik(), vaardigheid: v.id }, 'Beoordeling aangevraagd voor ' + v.naam + '.');
      })]));
    });
  }

  function oefenen(k, x) {
    if (x.begin) k.appendChild(maak('p', 'meta', 'Beginsituatie: ' + x.begin));
    var gekozen = [];
    var lijst = maak('p', 'meta', 'Kies de stappen in de volgorde waarin u ze zou zetten.');
    function toon() { lijst.textContent = gekozen.length ? 'Uw volgorde: ' + gekozen.map(function (s, n) { return (n + 1) + '. ' + s; }).join(', ') : 'Kies de stappen in de volgorde waarin u ze zou zetten.'; }
    k.appendChild(lijst);
    k.appendChild(rij((x.stappen || []).map(function (s) {
      return knop(s, true, function () { if (gekozen.indexOf(s) < 0) { gekozen.push(s); toon(); } });
    })));
    k.appendChild(rij([
      knop('Opnieuw kiezen', true, function () { gekozen = []; toon(); }),
      knop('Scenario afronden', false, function () {
        doe('scenario:' + x.scenario + ':' + gekozen.join('>'), 'simulatieAfronden', { scenario: x.scenario, keuzes: gekozen.slice() }, function (d) {
          var u = d && d.uit && d.uit.uitslag;
          if (!u) return 'Geslaagd: het leerhuis legde bewijs vast voor ' + x.scenario + '.';
          return 'Nog niet geslaagd.' + (u.ontbreekt.length ? ' Er ontbrak: ' + u.ontbreekt.join(', ') + '.' : '')
            + (u.verboden.length ? ' Dit had niet gemogen: ' + u.verboden.join(', ') + '.' : '') + (u.volgorde ? '' : ' De volgorde klopte niet.')
            + ' Oefenen is zonder gevolgen; hier komt geen bewijs van in uw dossier.';
        });
      })]));
  }
  return { pad: pad, oefenen: oefenen };
};
