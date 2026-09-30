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
   geen leerlingen.

   DE EIGENAAR WIJST EEN MENS AAN OP CODENAAM, met een reden (besluit van 29
   september 2026, kern/leerhuis/aanwijzen.js). Er is hier geen zoekveld dat
   iets teruggeeft: de server zoekt de sleutel bij de handeling zelf, schrijft
   een regel op de inzagekaart van dat lid, en een onbekende codenaam komt
   terug als een weigering met de reden. */
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

  var RELATIE = { EMPLOYEE: 'medewerker', VOLUNTEER: 'vrijwilliger', BUSINESS_MEMBER: 'lid via een zaak',
    SUPPLIER_MEMBER: 'medewerker van een leverancier', PARTNER: 'partner', PROJECT: 'projectdeelnemer' };
  var ROL = { ACADEMY_OWNER: 'eigenaar', CURRICULUM_OWNER: 'curriculumeigenaar', KNOWLEDGE_OWNER: 'kenniseigenaar',
    TRAINER_AUTHORITY: 'trainerautoriteit', ASSESSMENT_AUTHORITY: 'beoordelingsautoriteit', QUALITY_AUTHORITY: 'kwaliteitsautoriteit',
    ASSESSOR: 'assessor' };
  var leesbaar = function (map, x) { return map[x] || String(x || '').toLowerCase().replace(/_/g, ' '); };
  function veld(label) { var v = maak('input', 'veld'); v.setAttribute('aria-label', label); v.placeholder = label; v.maxLength = 120; return v; }
  function kies(label, lijst, map) {
    var s = maak('select', 'veld'); s.setAttribute('aria-label', label);
    lijst.forEach(function (x) { var o = maak('option', null, leesbaar(map, x)); o.value = x; s.appendChild(o); });
    return s;
  }

  function eenheidKeuze(label, leeg, lijst) {
    var s = maak('select', 'veld'); s.setAttribute('aria-label', label);
    s.appendChild(maak('option', null, leeg)).value = '';
    lijst.forEach(function (x) { s.appendChild(maak('option', null, x.naam)).value = x.id; });
    return s;
  }
  /* De organisatiegraaf. De code van een eenheid volgt uit haar naam; een naam die
     al bestaat, zet die eenheid opnieuw (bijvoorbeeld onder een andere). Een kring
     weigert de server. */
  function eenheden(e) {
    var k = maak('div', 'kaart');
    k.appendChild(maak('h3', null, 'Eenheden'));
    (e.EENHEDEN || []).forEach(function (x) {
      k.appendChild(maak('p', 'meta', x.naam + (x.soort ? ' (' + x.soort + ')' : '') + (x.ouderNaam ? ', onder ' + x.ouderNaam : '') + '.'));
    });
    if (!(e.EENHEDEN || []).length) k.appendChild(maak('p', 'meta', 'Nog geen eenheden. Zonder eenheden is het leerhuis een geheel.'));
    var n = veld('Naam van de eenheid'), s = veld('Soort (afdeling, vestiging, team)'), o = eenheidKeuze('Onder welke eenheid', 'Bovenaan', e.EENHEDEN || []);
    [n, s, o].forEach(function (x) { k.appendChild(x); });
    var r = maak('div', 'rij');
    r.appendChild(knop('Eenheid vastleggen', false, function () {
      var id = String(n.value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
      doe('eenheid:' + id + ':' + o.value, 'eenheidZet', { id: id, naam: n.value.trim(), soort: s.value.trim(), ouder: o.value || null },
        'Eenheid vastgelegd: ' + n.value.trim() + '.');
    }));
    k.appendChild(r);
    return k;
  }

  function eigenaar(e) {
    var bestuur = (e.BESTUUR || []).map(function (x) {
      return kaart(wie(x), null, [x.rollen.map(function (r) { return leesbaar(ROL, r); }).join(', ')]);
    });
    var rel = maak('div', 'kaart');
    rel.appendChild(maak('h3', null, 'Relatie vastleggen'));
    var rc = veld('Codenaam'), rs = kies('Soort relatie', e.relatieSoorten || [], RELATIE), rm = veld('Codenaam van de manager (mag leeg)'), rr = veld('Reden van de opzoeking');
    var re = eenheidKeuze('Eenheid', 'Geen eenheid', e.EENHEDEN || []);
    [rc, rs, re, rm, rr].forEach(function (x) { rel.appendChild(x); });
    var r1 = maak('div', 'rij');
    r1.appendChild(knop('Relatie vastleggen', false, function () {
      var invoer = { codenaam: rc.value.trim(), soort: rs.value, reden: rr.value.trim() };
      if (rm.value.trim()) invoer.managerCodenaam = rm.value.trim();
      if (re.value) invoer.eenheid = re.value;
      doe('relatie:' + invoer.codenaam + ':' + invoer.soort, 'relatieZet', invoer, 'Relatie vastgelegd voor ' + invoer.codenaam + '.');
    }));
    rel.appendChild(r1);
    var bs = maak('div', 'kaart');
    bs.appendChild(maak('h3', null, 'Bestuursrol toekennen'));
    var bc = veld('Codenaam'), br = kies('Bestuursrol', e.bestuursrollen || [], ROL), bw = veld('Reden van de opzoeking');
    [bc, br, bw].forEach(function (x) { bs.appendChild(x); });
    var r2 = maak('div', 'rij');
    r2.appendChild(knop('Bestuursrol toekennen', false, function () {
      doe('bestuur:' + bc.value.trim() + ':' + br.value, 'bestuurZet', { codenaam: bc.value.trim(), rol: br.value, reden: bw.value.trim() },
        'Bestuursrol toegekend: ' + leesbaar(ROL, br.value) + ' voor ' + bc.value.trim() + '.');
    }));
    bs.appendChild(r2);
    var relaties = (e.RELATIES || []).map(function (x) {
      var k = kaart(wie(x), null, [leesbaar(RELATIE, x.soort) + (x.eenheid ? ', ' + x.eenheid : '') + '.', x.rollen.length ? 'Rol: ' + x.rollen.map(function (r) { return r.titel; }).join(', ') : 'Nog geen rol.']);
      if (x.zelf) { k.appendChild(maak('p', 'meta', 'Uzelf uit dienst melden doet een tweede eigenaar.')); return k; }
      var reden = veld('Reden (bij intrekken verplicht)');
      if (x.rollen.length) k.appendChild(reden);
      x.rollen.forEach(function (r) {
        var p = maak('div', 'rij');
        p.appendChild(knop('Rol ' + r.titel + ' intrekken', true, function () {
          doe('intrek:' + x.persoon + ':' + r.id, 'rolIntrekken', { persoon: x.persoon, rol: r.id, reden: reden.value.trim() }, 'Rol ingetrokken: ' + r.titel + '.');
        }));
        k.appendChild(p);
      });
      /* Uit dienst laat rollen, bestuursrollen en trainerschap vervallen; bewijs en historie blijven.
         Daarom eerst een vinkje dat dat hardop zegt, en pas dan een knop die iets doet. */
      var l = maak('label', 'keuze'), c = document.createElement('input'); c.type = 'checkbox';
      l.appendChild(c); l.appendChild(document.createTextNode('Ik weet dat rollen, bestuursrollen en trainerschap vervallen; bewijs en historie blijven'));
      k.appendChild(l);
      var u = maak('div', 'rij');
      u.appendChild(knop('Uit dienst melden', true, function () {
        if (!c.checked) { h.$('melding').textContent = 'Vink eerst aan dat u weet wat er vervalt.'; return; }
        doe('uitdienst:' + x.persoon, 'uitDienst', { persoon: x.persoon }, 'Uit dienst gemeld: ' + wie(x) + '.');
      }));
      k.appendChild(u);
      return k;
    });
    zet('eigenaar', [eenheden(e), rel, bs].concat(bestuur, relaties), '');
  }

  return { manager: manager, curriculum: curriculum, eigenaar: eigenaar };
};
