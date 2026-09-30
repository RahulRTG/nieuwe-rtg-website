/* Leerhuis: aan het werk -- de kaarten per rol (trainer, assessor,
   kenniseigenaar). Afgesplitst van leerhuis-werk.js, dat de deur is: lezen,
   handelen, sleutels. Dit bestand bouwt alleen kaarten en knoppen, en elke knop
   gaat via `h.doe` van dat bestand -- er is hier geen eigen weg naar de server.
   Wat een knop mag, zegt de server; een knop die hier ontbreekt is geen verbod. */
'use strict';
window.RTGLeerhuisKaarten = function (h) {
  var maak = h.maak, knop = h.knop, kaart = h.kaart, zet = h.zet, doe = h.doe, wie = h.wie, dag = h.dag, $ = h.$;
  /* ---- trainer ---- */
  var VOLGENDE = { SIMULATING: ['SUPERVISED', 'Werkt nu onder mijn toezicht', 'Vastgelegd: onder uw toezicht.'],
    SUPERVISED: ['READY_FOR_ASSESSMENT', 'Klaar voor beoordeling', 'Vastgelegd: klaar voor beoordeling.'] };
  function trainer(t) {
    zet('trainer', (t.LEERLINGEN || []).map(function (x) {
      var k = kaart(wie(x), x.stand, ['Leerpad ' + x.curriculum]);
      var v = VOLGENDE[x.stand];
      if (v) {
        var rij = maak('div', 'rij');
        rij.appendChild(knop(v[1], false, function () {
          doe('leren:' + x.persoon + ':' + x.curriculum + ':' + v[0], 'lerenStand',
            { persoon: x.persoon, curriculum: x.curriculum, naar: v[0] }, v[2]);
        }));
        k.appendChild(rij);
      } else if (x.volgende) {
        k.appendChild(maak('p', 'meta', 'Volgende stap: ' + x.volgende));
      }
      if (h.bewijs) h.bewijs(k, x, t);
      return k;
    }), 'Er volgt nog niemand een leerpad bij u.');
  }

  /* ---- assessor ---- */
  function assessor(a) {
    var open = (a.OPEN || []).map(function (b) {
      var k = kaart(b.vaardigheidNaam + ' van ' + wie(b), 'REQUESTED', ['Vorm: ' + (b.vorm || 'onbekend'), 'Aangevraagd op ' + dag(b.sinds)]);
      var rij = maak('div', 'rij');
      rij.appendChild(knop('Beoordeling beginnen', false, function () {
        doe('start:' + b.id, 'beoordelingStart', { id: b.id }, 'U beoordeelt nu ' + b.vaardigheidNaam + '.');
      }));
      k.appendChild(rij);
      return k;
    });
    var lopend = (a.LOPEND || []).map(function (b) {
      var eis = b.eis ? 'Eis: minstens ' + String(b.eis.sterkte || '').toLowerCase() + (b.eis.soorten && b.eis.soorten.length ? ', soort ' + b.eis.soorten.join(' of ').toLowerCase() : '') : null;
      var k = kaart(b.vaardigheidNaam + ' van ' + wie(b), 'ASSESSING', [eis]);
      var gekozen = {};
      if (!(b.bewijs || []).length) k.appendChild(maak('p', 'meta', 'Er ligt geen geldig bewijs voor deze vaardigheid.'));
      (b.bewijs || []).forEach(function (x) {
        var l = maak('label', 'keuze');
        var c = document.createElement('input');
        c.type = 'checkbox';
        c.addEventListener('change', function () { gekozen[x.id] = c.checked; });
        l.appendChild(c);
        l.appendChild(document.createTextNode(String(x.soort || '').toLowerCase() + ', ' + String(x.sterkte || '').toLowerCase() + ', ' + dag(x.sinds) + (x.bron ? ' (' + x.bron + ')' : '')));
        k.appendChild(l);
      });
      var crit = maak('textarea', 'veld'); crit.setAttribute('aria-label', 'Criteria waartegen u beoordeelde');
      crit.placeholder = 'Criteria waartegen u beoordeelde (nodig bij bewezen)';
      var herstel = maak('textarea', 'veld'); herstel.setAttribute('aria-label', 'Wat er nog nodig is');
      herstel.placeholder = 'Wat er nog nodig is (bij nog niet bewezen)';
      k.appendChild(crit); k.appendChild(herstel);
      var rij = maak('div', 'rij');
      rij.appendChild(knop('Bewezen', false, function () {
        var bewijs = Object.keys(gekozen).filter(function (id) { return gekozen[id]; });
        doe('af:' + b.id, 'beoordelingAfronden', { id: b.id, uitkomst: 'PROVEN', bewijs: bewijs, criteria: crit.value.trim() },
          'Vastgelegd: ' + b.vaardigheidNaam + ' is bewezen.');
      }));
      rij.appendChild(knop('Nog niet bewezen', true, function () {
        doe('af:' + b.id, 'beoordelingAfronden', { id: b.id, uitkomst: 'NOT_YET_PROVEN', herstel: herstel.value.trim() },
          'Vastgelegd: ' + b.vaardigheidNaam + ' is nog niet bewezen, met het herstelpad.');
      }));
      k.appendChild(rij);
      return k;
    });
    zet('assessor', lopend.concat(open), 'Er wacht geen beoordeling op u.');
    $('assessorNiet').textContent = a.nietZichtbaar ? 'Niet zichtbaar: ' + a.nietZichtbaar + '.' : '';
  }

  /* ---- kennisbeheer ---- */
  function kennis(w) {
    zet('kennis', (w.CONCEPTEN || []).map(function (c) {
      var k = kaart(c.titel || c.id, c.stand, [(c.domein ? 'Onderwerp: ' + c.domein + '. ' : '') + 'Versie ' + c.versie +
        (c.actieveVersie ? ', volgt versie ' + c.actieveVersie + ' op' : '') + '.', c.herkomst === 'startpakket' ? 'Uit het startpakket van RTG Academy.' : null]);
      k.appendChild(maak('p', 'tekst', c.tekst || ''));
      var rij = maak('div', 'rij');
      if (c.stand === 'DRAFT') {
        rij.appendChild(knop('Ter review', true, function () {
          doe('review:' + c.id + ':' + c.versie, 'kennisStand', { id: c.id, versie: c.versie, naar: 'REVIEW' }, 'Ter review gezet: ' + (c.titel || c.id) + '.');
        }));
      } else if (c.stand === 'REVIEW' && c.eigen) {
        k.appendChild(maak('p', 'meta', 'U schreef dit concept. Een andere kenniseigenaar activeert het.'));
      } else if (c.stand === 'REVIEW') {
        var bron = null; var impact = null;
        if (c.bronNodig) {
          bron = maak('input', 'veld'); bron.setAttribute('aria-label', 'Bron van uw organisatie');
          bron.placeholder = 'Bron van uw organisatie (verplicht)';
          k.appendChild(bron);
        }
        if (c.impactNodig) {
          impact = maak('select', 'veld'); impact.setAttribute('aria-label', 'Impact op wie de vorige versie leerde');
          impact.appendChild(maak('option', null, 'Kies de impact op wie de vorige versie leerde')).value = '';
          (w.impactKlassen || []).forEach(function (i) { impact.appendChild(maak('option', null, i.toLowerCase().replace(/_/g, ' '))).value = i; });
          k.appendChild(impact);
        }
        rij.appendChild(knop('Activeren', false, function () {
          var invoer = { id: c.id, versie: c.versie, naar: 'ACTIVE' };
          if (bron) invoer.bron = bron.value.trim();
          if (impact) invoer.impactKlasse = impact.value;
          doe('actief:' + c.id + ':' + c.versie, 'kennisStand', invoer, 'Geactiveerd: ' + (c.titel || c.id) + ' is nu officiële kennis.');
        }));
        rij.appendChild(knop('Terug naar concept', true, function () {
          doe('terug:' + c.id + ':' + c.versie, 'kennisStand', { id: c.id, versie: c.versie, naar: 'DRAFT' }, 'Terug naar concept: ' + (c.titel || c.id) + '.');
        }));
      }
      if (rij.firstChild) k.appendChild(rij);
      return k;
    }), 'Er wacht geen concept op een kenniseigenaar.');
    $('kennisNiet').textContent = w.nietZichtbaar ? 'Niet zichtbaar: ' + w.nietZichtbaar + '.' : '';
  }

  return { trainer: trainer, assessor: assessor, kennis: kennis };
};
