/* Leerhuis: aan het werk -- kennis, vaardigheden, rollen en curricula SCHRIJVEN,
   voor de curriculumeigenaar (ACADEMY.md, fase B-UI).

   HIJ BESLIST NIETS. Wat er te kiezen valt (niveaus, soorten, fasen, sterktes)
   en wat er al is, komt uit curriculumWerk (kern/leerhuis/werk.js); of iets mag,
   zeggen kennisSchrijf, vaardigheidZet, rolZet en curriculumZet. Een kritieke
   vaardigheid op te zwak bewijs of kennis zonder bron weigert de server, en die
   weigering staat in woorden op het scherm.

   Wat hier ontstaat is een CONCEPT of een eerste versie: kennis wordt pas
   officieel als een ANDERE kenniseigenaar hem activeert, en een curriculum gaat
   daarna via review naar actief in het blok erboven.

   DE CODE van een nieuw stuk wordt afgeleid uit zijn naam en staat in de
   melding; een naam die al bestaat maakt een nieuwe versie van hetzelfde stuk. */
'use strict';
window.RTGLeerhuisSchrijven = function (h) {
  var maak = h.maak, knop = h.knop, doe = h.doe;
  var NIVEAU = { AWARE: 'kent het', FOUNDATIONAL: 'basis', PRACTITIONER: 'vakbekwaam', ADVANCED: 'gevorderd', EXPERT: 'expert' };
  var FASE = { UNDERSTAND: 'begrijpen', OBSERVE: 'kijken', PRACTICE: 'oefenen', SIMULATE: 'simuleren', SUPERVISED_WORK: 'onder toezicht werken',
    PROVE: 'bewijzen', CERTIFY: 'certificeren', REFRESH: 'opfrissen' };
  var leesbaar = function (map, x) { return (map && map[x]) || String(x || '').toLowerCase().replace(/_/g, ' '); };
  function code(naam) {
    return String(naam || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }
  function veld(label, groot) {
    var v = maak(groot ? 'textarea' : 'input', 'veld'); v.setAttribute('aria-label', label); v.placeholder = label; return v;
  }
  function kies(label, lijst, map) {
    var s = maak('select', 'veld'); s.setAttribute('aria-label', label);
    lijst.forEach(function (x) { var o = maak('option', null, leesbaar(map, x)); o.value = x; s.appendChild(o); });
    return s;
  }
  /* Een groep vinkjes; geeft een functie terug die de gekozen waarden leest. */
  function vinkjes(doos, titel, items) {
    var f = maak('fieldset', 'vinkjes'); f.appendChild(maak('legend', null, titel));
    var boxen = items.map(function (it) {
      var l = maak('label', 'keuze'), c = document.createElement('input'); c.type = 'checkbox'; c.value = it[0];
      if (it[2]) c.checked = true;
      l.appendChild(c); l.appendChild(document.createTextNode(it[1])); f.appendChild(l); return c;
    });
    if (!items.length) f.appendChild(maak('p', 'meta', 'Nog niets om te kiezen.'));
    doos.appendChild(f);
    return function () { return boxen.filter(function (c) { return c.checked; }).map(function (c) { return c.value; }); };
  }
  function formulier(titel) { var d = maak('details', 'schrijf'); d.appendChild(maak('summary', null, titel)); return d; }
  function voeg(d, knopTekst, fn) { var r = maak('div', 'rij'); r.appendChild(knop(knopTekst, false, fn)); d.appendChild(r); }

  return function (c) {
    var doos = h.$('schrijven');
    while (doos.firstChild) doos.removeChild(doos.firstChild);
    if (!c.magSchrijven) return;
    var K = c.KEUZES || {}, kennis = c.KENNIS || [], vaard = c.VAARDIGHEDEN || [];
    var kennisItems = kennis.map(function (k) { return [k.id, k.titel + (k.actief ? '' : ' (nog een concept)')]; });
    var vaardItems = vaard.map(function (v) { return [v.id, v.naam]; });

    /* Uw eigen kennisconcepten: ter review zetten mag de schrijver zelf. */
    kennis.filter(function (k) { return k.concept && k.concept.eigen && k.concept.stand === 'DRAFT'; }).forEach(function (k) {
      var r = maak('div', 'rij');
      r.appendChild(maak('span', 'meta', 'Uw concept: ' + k.titel));
      r.appendChild(knop('Ter review', true, function () {
        doe('kr:' + k.id + ':' + k.concept.versie, 'kennisStand', { id: k.id, versie: k.concept.versie, naar: 'REVIEW' }, 'Ter review gezet: ' + k.titel + '.');
      }));
      doos.appendChild(r);
    });

    var fk = formulier('Nieuwe kennis');
    var kt = veld('Titel van het kennisitem'), kd = veld('Onderwerp'), kx = veld('Tekst', true), kb = veld('Bron of bewijs');
    [kt, kd, kx, kb].forEach(function (x) { fk.appendChild(x); });
    voeg(fk, 'Kennis schrijven', function () {
      doe('ks:' + code(kt.value), 'kennisSchrijf', { id: code(kt.value), titel: kt.value.trim(), domein: kd.value.trim(), tekst: kx.value.trim(), bron: kb.value.trim() },
        'Concept geschreven: ' + kt.value.trim() + ' (code ' + code(kt.value) + '). Een andere kenniseigenaar activeert het.');
    });

    var fv = formulier('Nieuwe vaardigheid');
    var vn = veld('Naam van de vaardigheid'), vl = kies('Niveau', K.niveaus || [], NIVEAU), vs = kies('Minimaal bewijs', K.sterktes || []);
    vs.value = 'OBSERVED';
    var kl = maak('label', 'keuze'), vk = document.createElement('input'); vk.type = 'checkbox';
    kl.appendChild(vk); kl.appendChild(document.createTextNode('Kritiek: fouten raken geld, veiligheid of een mens'));
    var vg = veld('Geldig (dagen, mag leeg)');
    [vn, vl, vs, kl, vg].forEach(function (x) { fv.appendChild(x); });
    var vKennis = vinkjes(fv, 'Kennis die erbij hoort', kennisItems);
    var vSoort = vinkjes(fv, 'Soorten bewijs', (K.bewijssoorten || []).map(function (s) { return [s, leesbaar(null, s)]; }));
    voeg(fv, 'Vaardigheid vastleggen', function () {
      doe('vz:' + code(vn.value), 'vaardigheidZet', { id: code(vn.value), naam: vn.value.trim(), niveau: vl.value, kritiek: vk.checked,
        kennis: vKennis(), bewijsEis: { sterkte: vs.value, soorten: vSoort() }, geldigDagen: Number(vg.value) || null },
        'Vaardigheid vastgelegd: ' + vn.value.trim() + ' (code ' + code(vn.value) + ').');
    });

    var fr = formulier('Nieuwe rol');
    var rt = veld('Titel van de rol'), rs = kies('Soort rol', K.rolsoorten || []), rd = veld('Doel van de rol (mag leeg)');
    [rt, rs, rd].forEach(function (x) { fr.appendChild(x); });
    var rV = vinkjes(fr, 'Vaardigheden van de rol', vaardItems);
    var rC = vinkjes(fr, 'Waarvoor een certificaat nodig is', vaardItems);
    voeg(fr, 'Rol vastleggen', function () {
      doe('rz:' + code(rt.value), 'rolZet', { id: code(rt.value), titel: rt.value.trim(), soort: rs.value, doel: rd.value.trim(),
        vaardigheden: rV(), certificaten: rC() }, 'Rol vastgelegd: ' + rt.value.trim() + ' (code ' + code(rt.value) + ').');
    });

    var fc = formulier('Nieuw curriculum');
    var ct = veld('Titel van het curriculum');
    fc.appendChild(ct);
    var cV = vinkjes(fc, 'Vaardigheden waar het naartoe leidt', vaardItems);
    var cK = vinkjes(fc, 'Kennis die het leert', kennisItems);
    var cF = vinkjes(fc, 'Fasen', (K.leerfasen || []).map(function (f) { return [f, leesbaar(FASE, f), true]; }));
    voeg(fc, 'Curriculum vastleggen', function () {
      var t = ct.value.trim();
      doe('cz:' + code(t), 'curriculumZet', { id: code(t), titel: t, vaardigheden: cV(), kennis: cK(),
        fasen: cF().map(function (f) { return { fase: f, wat: leesbaar(FASE, f) + ': ' + t }; }) },
        'Curriculum vastgelegd als concept: ' + t + ' (code ' + code(t) + ').');
    });

    [fk, fv, fr, fc].forEach(function (x) { doos.appendChild(x); });
  };
};
