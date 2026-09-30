/* Leerhuis: aan het werk -- kwaliteit: bezwaren, beoordelingen ongeldig
   verklaren en geschiktheidsbeleid (ACADEMY.md, fase B-UI).

   HIJ BESLIST NIETS. Wat er ligt en welke overgangen er zijn, komt uit
   kwaliteitWerk (kern/leerhuis/werk-autoriteit.js); of het mag, zeggen
   bezwaarStand, beoordelingOngeldig, beleidZet en beleidGoedkeuren. Een oordeel
   dat u zelf gaf, een review die een ander oppakte en een beleid dat u zelf
   voorstelde, krijgen een zin en geen knop -- de server weigert ze ook zelf.

   Het oordeel achter een bezwaar (uitslag, criteria, herstelpad) staat pas op
   de kaart als u de review op u nam: tot dan weet u alleen DAT er bezwaar is,
   en waarom de leerling het maakte. */
'use strict';
window.RTGLeerhuisKwaliteit = function (h) {
  var maak = h.maak, knop = h.knop, kaart = h.kaart, zet = h.zet, doe = h.doe, wie = h.wie, dag = h.dag;
  var BEZWAAR = { INDEPENDENT_REVIEW: 'Review oppakken', UPHELD: 'Het oordeel blijft staan', CHANGED: 'Het oordeel wordt aangepast',
    REASSESSMENT: 'Opnieuw laten beoordelen' };
  function rij(knoppen) { var r = maak('div', 'rij'); knoppen.forEach(function (k) { r.appendChild(k); }); return r; }
  function veld(label, groot) { var v = maak(groot ? 'textarea' : 'input', 'veld'); v.setAttribute('aria-label', label); v.placeholder = label; return v; }
  function code(t) { return String(t || '').toLowerCase().trim().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); }

  /* Bewijs onder het oordeel: intrekken vraagt een reden (bewijsIntrekken), en
     ingetrokken bewijs blijft staan met die reden -- historie wordt niet herschreven. */
  function bewijsRij(x) {
    var soort = String(x.soort || '').toLowerCase().replace(/_/g, ' ');
    var d = maak('div', 'bewijs');
    d.appendChild(maak('p', 'meta', 'Bewijs: ' + soort + ', ' + String(x.sterkte || '').toLowerCase().replace(/_/g, ' ')
      + (x.bron ? ' (' + x.bron + ')' : '') + ', ' + dag(x.sinds) + '.'
      + (x.ingetrokken ? ' Ingetrokken: ' + x.ingetrokken + '.' : '')));
    if (x.ingetrokken) return d;
    var reden = veld('Reden om bewijs ' + soort + ' in te trekken');
    d.appendChild(reden);
    d.appendChild(rij([knop('Bewijs ' + soort + ' intrekken', false, function () {
      doe('bi:' + x.id, 'bewijsIntrekken', { id: x.id, reden: reden.value.trim() }, 'Bewijs ingetrokken: ' + soort + '.');
    })]));
    return d;
  }

  function bezwaren(k) {
    return (k.BEZWAREN || []).map(function (z) {
      var c = kaart('Bezwaar: ' + z.vaardigheidNaam + ' van ' + wie(z), z.stand, ['Reden van de leerling: ' + (z.reden || 'geen'), 'Ingediend op ' + dag(z.sinds) + '.']);
      if (z.eigenOordeel) { c.appendChild(maak('p', 'meta', 'U gaf dit oordeel zelf; een ander behandelt het bezwaar.')); return c; }
      if (z.anderReviewer) { c.appendChild(maak('p', 'meta', 'Een andere kwaliteitsautoriteit behandelt dit bezwaar.')); return c; }
      if (z.oordeel) c.appendChild(maak('p', 'meta', 'Het oordeel: ' + String(z.oordeel.stand || '').toLowerCase().replace(/_/g, ' ')
        + (z.oordeel.criteria ? '. Criteria: ' + z.oordeel.criteria : '') + (z.oordeel.herstel ? '. Herstelpad: ' + z.oordeel.herstel : '') + '.'));
      if (z.oordeel) (z.oordeel.bewijs || []).forEach(function (x) { c.appendChild(bewijsRij(x)); });
      var notitie = null;
      if (z.stand === 'INDEPENDENT_REVIEW') { notitie = veld('Uw bevinding', true); c.appendChild(notitie); }
      c.appendChild(rij((z.naar || []).map(function (n) {
        return knop(BEZWAAR[n] || n, n === 'REASSESSMENT', function () {
          doe('bezwaar:' + z.id + ':' + n, 'bezwaarStand', { id: z.id, naar: n, notitie: notitie ? notitie.value.trim() : '' }, (BEZWAAR[n] || n) + ': ' + z.vaardigheidNaam + '.');
        });
      })));
      return c;
    });
  }

  function ongeldig(k) {
    return (k.ONGELDIG || []).map(function (b) {
      var c = kaart(b.vaardigheidNaam + ' van ' + wie(b), b.stand, ['Afgerond op ' + dag(b.sinds) + '.']);
      var reden = veld('Reden om ongeldig te verklaren');
      c.appendChild(reden);
      c.appendChild(rij([knop('Ongeldig verklaren', true, function () {
        doe('ongeldig:' + b.id, 'beoordelingOngeldig', { id: b.id, reden: reden.value.trim() }, 'Ongeldig verklaard: ' + b.vaardigheidNaam + '.');
      })]));
      return c;
    });
  }

  function beleid(k) {
    var lijst = (k.BELEID || []).map(function (b) {
      var c = kaart('Beleid voor ' + b.handeling, null, ['Vaardigheden: ' + (b.vaardigheden.join(', ') || 'geen') + (b.rol ? '. Rol: ' + b.rol : '') + (b.certificaat ? '. Certificaat vereist.' : '.'),
        b.goedgekeurd ? 'Goedgekeurd.' : 'Nog niet goedgekeurd.']);
      if (!b.goedgekeurd && b.eigen) c.appendChild(maak('p', 'meta', 'U stelde dit beleid voor; een ander keurt het goed.'));
      else if (!b.goedgekeurd) c.appendChild(rij([knop('Beleid goedkeuren', false, function () {
        doe('beleidok:' + b.id, 'beleidGoedkeuren', { id: b.id }, 'Beleid goedgekeurd: ' + b.handeling + '.');
      })]));
      return c;
    });
    var f = maak('div', 'kaart');
    f.appendChild(maak('h3', null, 'Nieuw beleid voorstellen'));
    var handeling = veld('Handeling, bijvoorbeeld betaling.terugboeken');
    var rol = maak('select', 'veld'); rol.setAttribute('aria-label', 'Rol (mag leeg)');
    [{ id: '', titel: 'geen rol' }].concat((k.KEUZES || {}).rollen || []).forEach(function (r) { var o = maak('option', null, r.titel); o.value = r.id; rol.appendChild(o); });
    [handeling, rol].forEach(function (x) { f.appendChild(x); });
    var boxen = ((k.KEUZES || {}).vaardigheden || []).map(function (v) {
      var l = maak('label', 'keuze'), c = document.createElement('input'); c.type = 'checkbox'; c.value = v.id;
      l.appendChild(c); l.appendChild(document.createTextNode(v.naam)); f.appendChild(l); return c;
    });
    var cl = maak('label', 'keuze'), cert = document.createElement('input'); cert.type = 'checkbox';
    cl.appendChild(cert); cl.appendChild(document.createTextNode('Een geldig certificaat is vereist')); f.appendChild(cl);
    f.appendChild(rij([knop('Beleid voorstellen', false, function () {
      var hnd = handeling.value.trim();
      doe('beleid:' + code(hnd), 'beleidZet', { id: code(hnd), handeling: hnd, rol: rol.value || null, certificaat: cert.checked,
        vaardigheden: boxen.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }) }, 'Beleid voorgesteld: ' + hnd + '.');
    })]));
    return lijst.concat([f]);
  }

  return function (k) {
    zet('kwaliteit', (k.magKwaliteit ? bezwaren(k).concat(ongeldig(k)) : []).concat(beleid(k)), '');
  };
};
