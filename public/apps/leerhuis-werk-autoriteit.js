/* Leerhuis: aan het werk -- de certificaat- en de trainerautoriteit
   (ACADEMY.md, fase B-UI).

   HIJ BESLIST NIETS. Wat er klaarligt, komt uit certificaatWerk en trainerWerk
   (kern/leerhuis/werk-autoriteit.js); of het mag, zeggen certificaatUitgeven,
   certificaatStand, trainerToewijzen, trainerKwalificeer en trainerBijwerken.
   Een certificaat over uzelf, of op een kritieke vaardigheid die u zelf
   beoordeelde, krijgt een zin en geen knop -- de server weigert het ook zelf,
   zoals bij een kennisconcept dat u schreef. Een certificaat voor iemand die
   niet aantoonbaar 18 of ouder is, weigert de route met de reden (besluit B5).

   Van een beoordeling komt hier alleen DAT hij bewezen is, niet het bewijs of
   de criteria erachter: die zijn van de assessor. */
'use strict';
window.RTGLeerhuisAutoriteit = function (h) {
  var maak = h.maak, knop = h.knop, kaart = h.kaart, zet = h.zet, doe = h.doe, wie = h.wie, dag = h.dag;
  var TREDE = { PRACTITIONER: 'vakkracht', SENIOR_PRACTITIONER: 'ervaren vakkracht', BUDDY: 'buddy', MENTOR: 'mentor',
    TRAINER_CANDIDATE: 'trainer in opleiding', CERTIFIED_TRAINER: 'gecertificeerd trainer', SENIOR_TRAINER: 'senior trainer',
    TRAINER_OF_TRAINERS: 'trainer van trainers' };
  var trede = function (x) { return TREDE[x] || String(x || '').toLowerCase().replace(/_/g, ' '); };
  function rij(knoppen) { var r = maak('div', 'rij'); knoppen.forEach(function (k) { r.appendChild(k); }); return r; }

  function certificaat(c) {
    var klaar = (c.KLAAR || []).map(function (x) {
      var k = kaart(x.vaardigheidNaam + ' van ' + wie(x), 'PROVEN', ['Bewezen, en er is nog geen certificaat.']);
      if (x.zelf) k.appendChild(maak('p', 'meta', 'Dit gaat over uzelf; dat certificaat geeft een ander uit.'));
      else if (x.eigenOordeel) k.appendChild(maak('p', 'meta', 'U beoordeelde deze kritieke vaardigheid zelf; het certificaat geeft een ander uit.'));
      else k.appendChild(rij([knop('Certificaat uitgeven', false, function () {
        doe('cert:' + x.beoordeling, 'certificaatUitgeven', { persoon: x.persoon, vaardigheden: [x.vaardigheid], beoordelingen: [x.beoordeling],
          geldigDagen: x.geldigDagen }, 'Certificaat uitgegeven: ' + x.vaardigheidNaam + ' voor ' + wie(x) + '.');
      })]));
      return k;
    });
    var certs = (c.CERTIFICATEN || []).map(function (x) {
      var k = kaart((x.vaardigheden || []).join(', ') + ' van ' + wie(x), x.stand, [x.geldigTot ? 'Geldig tot ' + dag(x.geldigTot) + '.' : 'Zonder einddatum.']);
      var naar = x.stand === 'SUSPENDED' ? [['ACTIVE', 'Weer actief'], ['REVOKED', 'Intrekken']]
        : (x.stand === 'ACTIVE' || x.stand === 'EXPIRING') ? [['SUSPENDED', 'Schorsen'], ['REVOKED', 'Intrekken']] : [];
      if (naar.length) {
        var reden = maak('input', 'veld'); reden.setAttribute('aria-label', 'Reden'); reden.placeholder = 'Reden (verplicht)';
        k.appendChild(reden);
        k.appendChild(rij(naar.map(function (n) {
          return knop(n[1], n[0] === 'REVOKED', function () {
            doe('certstand:' + x.id + ':' + n[0], 'certificaatStand', { id: x.id, naar: n[0], reden: reden.value.trim() }, n[1] + ': ' + (x.vaardigheden || []).join(', ') + '.');
          });
        })));
      }
      return k;
    });
    zet('certificaat', klaar.concat(certs), 'Er ligt geen bewezen vaardigheid zonder certificaat, en er zijn nog geen certificaten.');
  }

  function trainer(t) {
    var naam = {};
    (t.TRAINERS || []).forEach(function (x) { naam[x.persoon] = wie(x); });
    var wacht = (t.ZONDER_TRAINER || []).map(function (x) {
      var k = kaart(wie(x), null, ['Leerpad ' + (x.titel || x.curriculum) + ' heeft nog geen trainer.']);
      if (!(x.kandidaten || []).length) { k.appendChild(maak('p', 'meta', 'Er is nog niemand die dit leerpad geldig mag geven.')); return k; }
      var s = maak('select', 'veld'); s.setAttribute('aria-label', 'Trainer voor ' + wie(x));
      x.kandidaten.forEach(function (p) { var o = maak('option', null, naam[p] || 'een trainer zonder codenaam'); o.value = p; s.appendChild(o); });
      k.appendChild(rij([s, knop('Trainer toewijzen', false, function () {
        doe('toewijzen:' + x.persoon + ':' + x.curriculum + ':' + s.value, 'trainerToewijzen', { persoon: x.persoon, curriculum: x.curriculum, trainer: s.value },
          'Trainer toegewezen voor ' + (x.titel || x.curriculum) + '.');
      })]));
      return k;
    });
    var trainers = (t.TRAINERS || []).map(function (x) {
      var k = kaart(wie(x), null, [trede(x.trede) + '. Leerpaden: ' + ((x.curricula || []).join(', ') || 'geen') + '.']);
      if (t.magKwalificeren) k.appendChild(rij([knop('Bijgewerkt bevestigen', true, function () {
        doe('bijwerken:' + x.persoon, 'trainerBijwerken', { persoon: x.persoon }, 'Bevestigd: ' + wie(x) + ' is bijgewerkt.');
      })]));
      return k;
    });
    var kandidaten = (t.magKwalificeren ? t.KANDIDATEN || [] : []).map(function (x) {
      var k = kaart(wie(x), null, ['Heeft een geldig certificaat voor Train-the-Trainer.' + (x.trede ? ' Nu: ' + trede(x.trede) + '.' : '')]);
      var s = maak('select', 'veld'); s.setAttribute('aria-label', 'Trede voor ' + wie(x));
      (t.treden || []).forEach(function (tr) { var o = maak('option', null, trede(tr)); o.value = tr; s.appendChild(o); });
      s.value = 'CERTIFIED_TRAINER';
      k.appendChild(s);
      var boxen = (x.curricula || []).map(function (c) {
        var l = maak('label', 'keuze'), b = document.createElement('input'); b.type = 'checkbox'; b.value = c; b.checked = true;
        l.appendChild(b); l.appendChild(document.createTextNode('Mag ' + c + ' geven')); k.appendChild(l); return b;
      });
      if (!boxen.length) k.appendChild(maak('p', 'meta', 'Heeft zelf nog geen curriculum volledig bewezen.'));
      k.appendChild(rij([knop('Kwalificeren', false, function () {
        doe('kwalificeer:' + x.persoon + ':' + s.value, 'trainerKwalificeer', { persoon: x.persoon, trede: s.value,
          curricula: boxen.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }) }, 'Gekwalificeerd: ' + wie(x) + ' als ' + trede(s.value) + '.');
      })]));
      return k;
    });
    zet('trainerautoriteit', wacht.concat(kandidaten, trainers), 'Er wacht geen leerpad op een trainer, en er zijn nog geen trainers.');
  }

  return { certificaat: certificaat, trainer: trainer };
};
