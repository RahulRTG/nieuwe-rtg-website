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
  /* Een bezwaar over de eigen uitslag, en EVC: een extern stuk dat hoogstens
     vastgelegd bewijs wordt. Of het mag, zegt de handeling (acties-evc.js). */
  function veld(label) { var v = maak('textarea', 'veld'); v.setAttribute('aria-label', label); v.placeholder = label; return v; }
  function uitslag(k, x) {
    if (x.herstel) k.appendChild(maak('p', 'meta', 'Herstelpad: ' + x.herstel));
    if (x.bezwaar) {
      k.appendChild(maak('p', 'meta', 'Uw bezwaar: ' + h.stand(x.bezwaar.stand)
        + (x.bezwaar.uitkomst ? '. Bevinding: ' + x.bezwaar.uitkomst : '') + '.'));
      if (['REVIEW_REQUEST', 'INDEPENDENT_REVIEW'].indexOf(x.bezwaar.stand) >= 0) return;
    }
    var reden = veld('Waarom u bezwaar maakt');
    var d = maak('details'); d.appendChild(maak('summary', null, 'Bezwaar maken')); d.appendChild(reden);
    d.appendChild(rij([knop('Bezwaar indienen', false, function () {
      doe('bezwaar:' + x.id, 'bezwaarIndienen', { beoordeling: x.id, reden: reden.value.trim() }, 'Bezwaar ingediend over ' + x.vaardigheidNaam + '. Een onafhankelijke kwaliteitsautoriteit behandelt het.');
    })]));
    k.appendChild(d);
  }
  function evc(keuze) {
    var f = maak('div', 'kaart');
    f.appendChild(maak('h3', null, 'Eerder verworven: een stuk van elders laten meetellen'));
    f.appendChild(maak('p', 'meta', 'Een diploma of certificaat van elders telt hier hoogstens als vastgelegd bewijs. Bewezen wordt u alleen door een beoordeling in dit leerhuis.'));
    var v = maak('select', 'veld'); v.setAttribute('aria-label', 'Vaardigheid');
    keuze.forEach(function (x) { var o = maak('option', null, x.naam); o.value = x.id; v.appendChild(o); });
    var ext = veld('Wat, van wie en wanneer');
    f.appendChild(v); f.appendChild(ext);
    f.appendChild(rij([knop('EVC indienen', false, function () {
      doe('evc:' + v.value, 'evcIndienen', { vaardigheid: v.value, extern: ext.value.trim() }, 'EVC ingediend; een assessor bekijkt het stuk.');
    })]));
    return f;
  }
  /* Werk onder goedgekeurd beleid. Geschikt of niet zegt de server; staat er een
     eis open, dan staat hij er in woorden en is er geen knop. */
  function werk(k, x) {
    if (!x.geschikt) { (x.ontbreekt || []).forEach(function (w) { k.appendChild(maak('p', 'meta', 'Nog niet: ' + w + '.')); }); return; }
    var u = veld('Wat u deed en wat eruit kwam: ' + x.handeling);
    k.appendChild(u);
    k.appendChild(rij([knop('Werk vastleggen: ' + x.handeling, true, function () {
      doe('werk:' + x.handeling + ':' + (x.vastgelegd || 0), 'werkVastleggen', { handeling: x.handeling, uitkomst: u.value.trim() },
        'Werk vastgelegd: ' + x.handeling + '. Het telt als werkbewijs, niet als nieuwe beoordeling.');
    })]));
  }
  return { pad: pad, oefenen: oefenen, uitslag: uitslag, evc: evc, werk: werk };
};
