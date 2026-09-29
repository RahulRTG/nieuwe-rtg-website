/* Leerhuis: aan het werk -- het inrichten door een manager en een
   curriculumeigenaar (ACADEMY.md, fase B-UI).

   HIJ BESLIST NIETS. De rollen en de overgangen komen van de server
   (kern/leerhuis/zicht.js managerCockpit, werk.js curriculumWerk); of een
   handeling mag, zeggen rolToewijzen, startplanMaak en curriculumStand. Een
   knop die de server toch weigert -- een curriculum met kennis die nog een
   concept is -- geeft die weigering in woorden door, via `h.doe` van
   leerhuis-werk.js en zijn sleutel.

   Een manager ziet zijn TEAM en welke rol en welk startplan er ligt, niet hoe
   ver iemand is met leren: dat is van de trainer. De curriculumeigenaar ziet
   geen leerlingen. */
'use strict';
window.RTGLeerhuisInrichten = function (h) {
  var maak = h.maak, knop = h.knop, kaart = h.kaart, zet = h.zet, doe = h.doe, wie = h.wie;
  var NAAR = { REVIEW: 'Ter review', DRAFT: 'Terug naar concept', PILOT: 'Als pilot starten', ACTIVE: 'Activeren',
    MONITORED: 'Gaan volgen', IMPROVEMENT: 'Verbeteren', SUPERSEDED: 'Vervangen', RETIRED: 'Uit gebruik nemen' };

  function manager(m) {
    var titel = {};
    (m.ROLLEN || []).forEach(function (r) { titel[r.id] = r.titel || r.id; });
    zet('manager', (m.TEAM || []).map(function (x) {
      var rollen = (x.rollen || []).map(function (r) { return titel[r] || r; });
      var k = kaart(wie(x), null, [rollen.length ? 'Rol: ' + rollen.join(', ') : 'Nog geen rol',
        x.plan ? 'Startplan ligt klaar voor ' + (titel[x.plan] || x.plan) + '.' : null]);
      var rij = maak('div', 'rij');
      var s = maak('select', 'veld');
      s.setAttribute('aria-label', 'Rol voor ' + wie(x));
      (m.ROLLEN || []).forEach(function (r) { var o = maak('option', null, r.titel || r.id); o.value = r.id; s.appendChild(o); });
      rij.appendChild(s);
      rij.appendChild(knop('Rol toewijzen', false, function () {
        doe('rol:' + x.persoon + ':' + s.value, 'rolToewijzen', { persoon: x.persoon, rol: s.value },
          'Rol toegewezen: ' + (titel[s.value] || s.value) + '.');
      }));
      k.appendChild(rij);
      (x.rollen || []).filter(function (r) { return r !== x.plan; }).forEach(function (r) {
        var p = maak('div', 'rij');
        p.appendChild(knop('Startplan maken voor ' + (titel[r] || r), true, function () {
          doe('plan:' + x.persoon + ':' + r, 'startplanMaak', { persoon: x.persoon, rol: r },
            'Startplan gemaakt voor ' + (titel[r] || r) + '.');
        }));
        k.appendChild(p);
      });
      return k;
    }), 'Er staat niemand in uw team.');
  }

  function curriculum(c) {
    zet('curriculum', (c.CURRICULA || []).map(function (x) {
      var k = kaart(x.titel || x.id, x.stand, ['Versie ' + x.versie + '. Vaardigheden: ' + ((x.vaardigheden || []).join(', ') || 'geen'),
        (x.kennisZonderActief || []).length ? 'Nog geen officiële kennis: ' + x.kennisZonderActief.join(', ') + '. Activeren kan pas als die kennis actief is.' : null]);
      var rij = maak('div', 'rij');
      (x.naar || []).forEach(function (n) {
        rij.appendChild(knop(NAAR[n] || n, n === 'DRAFT' || n === 'RETIRED', function () {
          doe('curriculum:' + x.id + ':' + x.versie + ':' + n, 'curriculumStand', { id: x.id, naar: n },
            (NAAR[n] || n) + ': ' + (x.titel || x.id) + '.');
        }));
      });
      if (rij.firstChild) k.appendChild(rij);
      return k;
    }), 'Deze organisatie heeft nog geen curriculum.');
  }

  return { manager: manager, curriculum: curriculum };
};
