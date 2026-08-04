/* RTG Werk OS (scherm): de modules zelf -- werk, kennis, klanten, service,
   bouw, IT, contracten en besluiten.

   Een scherm per module zou hier acht pagina's opleveren waar niemand tussen
   navigeert. Het is er daarom een, met een keuzelijst: wie een module kiest,
   ziet zijn lijst en de twee handelingen die er het meest toe doen. Alles wat
   de server WEIGERT (een besluit zonder stemmen, een taak die nog wacht, een
   contract dat te laat wordt opgezegd) komt hier gewoon als melding in beeld;
   dat is de hele waarde van die weigeringen. De handelingen zelf staan in
   werk/acties.js; deze module toont en die module doet. */
(function () {
  'use strict';
  var K = window.RTGWerk;
  function $(id) { return document.getElementById(id); }
  var esc = K.esc;

  var MODULES = {
    projecten: { titel: 'Projecten en taken', laad: projecten },
    kennis: { titel: 'Kennisbank', laad: kennis },
    klanten: { titel: 'Klanten en verkoop', laad: klanten },
    service: { titel: 'Servicedesk', laad: service },
    bouw: { titel: 'Bouw en releases', laad: bouw },
    it: { titel: 'Apparaten en licenties', laad: it },
    recht: { titel: 'Contracten', laad: recht },
    besluit: { titel: 'Besluiten', laad: besluiten }
  };

  function toon(rijen, leeg) { K.lijst($('mLijst'), rijen, leeg); }
  function fout(r) { if (r.body.error) { K.meld(r.body.error); return true; } return false; }

  function projecten() {
    K.api('/project', {}).then(function (r) {
      if (fout(r)) return toon([], 'Geen toegang tot projecten.');
      toon((r.body.projecten || []).map(function (p) {
        var v = p.voortgang;
        return K.rij('<b>' + esc(p.naam) + '</b> <span class="tag">' + esc(p.werkvorm) + '</span>' +
          (v.teLaat ? ' <span class="tag laat">' + v.teLaat + ' te laat</span>' : ''),
          (v.deel == null ? 'nog geen taken' : v.deel + '% van ' + v.taken + ' taken') +
          (v.overBudget ? ' · ' + K.euro(v.overBudget) + ' over budget' : ''));
      }), 'Nog geen projecten.');
    });
    K.api('/taken', {}).then(function (r) {
      if (r.body.error) return;
      K.lijst($('mExtra'), (r.body.taken || []).slice(0, 25).map(function (t) {
        return K.rij((t.geblokkeerd ? '<span class="tag laat">wacht</span> ' : '') + esc(t.titel) +
          ' <span class="tag">' + esc(t.kolom) + '</span>',
          esc(t.wie || 'niemand') + (t.deadline ? ' · ' + esc(t.deadline) : ''));
      }), 'Nog geen taken.');
    });
  }

  function kennis() {
    K.api('/kennis/zoek', { q: $('mZoek').value.trim() }).then(function (r) {
      if (fout(r)) return toon([], 'Geen toegang tot de kennisbank.');
      toon((r.body.artikelen || []).map(function (a) {
        return K.rij('<b>' + esc(a.titel) + '</b> <span class="tag">' + esc(a.soort) + '</span> v' + a.versie +
          (a.recht ? ' <span class="tag">' + esc(a.recht) + '</span>' : ''),
          esc(a.eigenaar) + ' · <span class="tag' + (a.stand === 'controle nodig' ? ' laat' : '') + '">' + esc(a.stand) + '</span>');
      }), 'Niets gevonden.');
      $('mLet').textContent = (r.body.verborgen ? r.body.verborgen + ' artikel(en) ziet u niet: die zijn afgeschermd. ' : '') + (r.body.let || '');
    });
    K.api('/kennis/controlelijst', {}).then(function (r) {
      if (r.body.error) return;
      K.lijst($('mExtra'), (r.body.artikelen || []).map(function (a) {
        return K.rij(esc(a.titel), esc(a.reden));
      }), 'Niets dat om controle vraagt.');
    });
  }

  function klanten() {
    K.api('/klant', {}).then(function (r) {
      if (fout(r)) return toon([], 'Geen toegang tot klanten.');
      toon((r.body.klanten || []).map(function (k) {
        return K.rij('<b>' + esc(k.naam) + '</b> <span class="stil">' + esc(k.branche || '') + '</span>',
          (k.producten || []).map(esc).join(', ') || 'nog geen producten');
      }), 'Nog geen klanten.');
    });
    K.api('/pijplijn', {}).then(function (r) {
      if (r.body.error) return;
      var d = r.body;
      K.lijst($('mExtra'), Object.keys(d.perFase || {}).map(function (f) {
        var x = d.perFase[f];
        return K.rij('<b>' + esc(f) + '</b> <span class="tag">' + x.kansPct + '%</span>',
          x.aantal + ' kans(en) · ' + K.euro(x.bedragCenten) + ' · gewogen ' + K.euro(x.gewogenCenten));
      }).concat([K.rij('<b>Gewonnen</b>', d.gewonnen.aantal + ' · ' + K.euro(d.gewonnen.bedragCenten)),
        K.rij('<b>Verloren</b>', d.verloren.aantal + ' · ' + Object.keys(d.verloren.redenen || {}).map(esc).join(', '))]),
      'Nog geen kansen.');
      $('mLet').textContent = d.let || '';
    });
  }

  function service() {
    K.api('/service/beeld', {}).then(function (r) {
      if (fout(r)) return toon([], 'Geen toegang tot de servicedesk.');
      var d = r.body;
      toon(Object.keys(d.open.perPrioriteit).map(function (p) {
        return K.rij('<b>' + esc(p) + '</b> <span class="stil">norm ' + d.normen[p].reactieMin + ' / ' + d.normen[p].oplosMin + ' min</span>',
          d.open.perPrioriteit[p] + ' open');
      }), 'Nog geen tickets.');
      K.lijst($('mExtra'), (d.buitenNorm.tickets || []).map(function (t) {
        return K.rij('<span class="tag laat">buiten norm</span> ' + esc(t.onderwerp),
          (t.reactieOver ? 'reactie ' + t.reactieOver + ' min over' : '') +
          (t.oplosOver ? ' · oplossing ' + t.oplosOver + ' min over' : ''));
      }), 'Alles binnen de norm.');
      $('mLet').textContent = d.tevredenheidUitleg || (d.tevredenheid ? 'Tevredenheid ' + d.tevredenheid.gemiddelde + ' uit ' + d.tevredenheid.aantal + ' antwoorden.' : '');
    });
  }

  function bouw() {
    K.api('/releases', {}).then(function (r) {
      if (fout(r)) return toon([], 'Geen toegang tot de bouwlaag.');
      toon((r.body.releases || []).map(function (x) {
        return K.rij('<b>' + esc(x.versie) + '</b> <span class="tag">' + esc(x.omgeving) + '</span>' +
          (x.teruggedraaid ? ' <span class="tag laat">teruggedraaid</span>' : ''),
          (x.toetsen ? x.toetsen.gedraaid + ' toetsen, ' + x.toetsen.gezakt + ' gezakt' : 'geen toetsgegevens') +
          (x.goedgekeurdDoor ? ' · ' + esc(x.goedgekeurdDoor) : ''));
      }), 'Nog geen releases.');
    });
    K.api('/vlaggen', {}).then(function (r) {
      if (r.body.error) return;
      K.lijst($('mExtra'), (r.body.vlaggen || []).map(function (v) {
        return K.rij('<b>' + esc(v.naam) + '</b> ' + Object.keys(v.standen).map(function (o) {
          return '<span class="tag' + (v.standen[o] ? ' aan' : '') + '">' + esc(o) + '</span>';
        }).join(' '), (v.over ? 'over de opruimdatum' : 'nog ' + v.dagenTeGaan + ' dagen'));
      }), 'Geen feature flags.');
      $('mLet').textContent = r.body.let || '';
    });
  }

  function it() {
    K.api('/apparaten', {}).then(function (r) {
      if (fout(r)) return toon([], 'Geen toegang tot het IT-beheer.');
      toon((r.body.apparaten || []).map(function (a) {
        return K.rij('<b>' + esc(a.soort) + '</b> ' + esc(a.nummer) +
          (a.versleuteld ? '' : ' <span class="tag laat">niet versleuteld</span>'),
          a.bijNaam ? 'bij ' + esc(a.bijNaam) : 'in beheer');
      }), 'Nog geen apparaten.');
    });
    K.api('/uitdienst', {}).then(function (r) {
      if (r.body.error) return;
      K.lijst($('mExtra'), (r.body.uitdienst || []).map(function (u) {
        var open = u.stappen.filter(function (s) { return !s.gedaan; });
        return K.rij('<b>' + esc(u.naam) + '</b> <span class="tag' + (u.klaar ? ' aan' : ' laat') + '">' +
          (u.klaar ? 'afgerond' : open.length + ' stap(pen) open') + '</span>',
          open.map(function (s) { return esc(s.stap); }).join(', '));
      }), 'Niemand uit dienst.');
    });
  }

  function recht() {
    K.api('/contracten', {}).then(function (r) {
      if (fout(r)) return toon([], 'Geen toegang tot contracten.');
      toon((r.body.contracten || []).map(function (c) {
        return K.rij('<b>' + esc(c.titel) + '</b> <span class="stil">' + esc(c.wederpartij) + '</span> <span class="tag">' + esc(c.status) + '</span>',
          esc(c.stand) + (c.laatsteOpzegdag ? ' · opzeggen voor ' + esc(c.laatsteOpzegdag) : ''));
      }), 'Nog geen contracten.');
      K.lijst($('mExtra'), (r.body.opzegdagVoorbij || []).map(function (c) {
        return K.rij('<span class="tag laat">opzegdag voorbij</span> ' + esc(c.titel), esc(c.laatsteOpzegdag));
      }), 'Geen contract waarvan de opzegdag voorbij is.');
      $('mLet').textContent = r.body.let || '';
    });
  }

  function besluiten() {
    K.api('/besluiten', {}).then(function (r) {
      if (fout(r)) return toon([], 'Geen toegang tot besluiten.');
      toon((r.body.besluiten || []).map(function (b) {
        return K.rij('<b>' + esc(b.titel) + '</b> <span class="tag">' + esc(b.status) + '</span>' +
          (b.bezwaren ? ' <span class="tag laat">' + b.bezwaren + ' bezwaar</span>' : ''),
          b.telling.voor + ' voor · ' + b.telling.tegen + ' tegen' +
          (b.evalueerOp ? ' · evalueren ' + esc(b.evalueerOp) : ''));
      }), 'Nog geen besluiten.');
      K.lijst($('mExtra'), (r.body.teEvalueren || []).map(function (b) {
        return K.rij('<span class="tag laat">te evalueren</span> ' + esc(b.titel), esc(b.evalueerOp));
      }), 'Niets dat om evaluatie vraagt.');
    });
  }

  function laad() {
    var id = $('mKeuze').value;
    var m = MODULES[id];
    if (!m) return;
    $('mTitel').textContent = m.titel;
    $('mZoekRij').hidden = id !== 'kennis';
    $('mLet').textContent = '';
    $('mExtra').innerHTML = '';
    if (window.RTGWerkActies) window.RTGWerkActies.toon(id);
    m.laad();
  }

  window.RTGWerkModules = { laad: laad, MODULES: MODULES };
})();
