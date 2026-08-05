/* RTG Werk OS (scherm): het startscherm en het directiebeeld.

   Twee dingen die dit scherm van de server overneemt en NIET zelf verzint:

   1. WAT NIET GEMETEN IS, STAAT ER ALS NIET GEMETEN. De server levert
      `nietGemeten` met een reden per blok; het scherm toont die reden en zet
      er geen nul of streepje neer. Een leeg vak op een dashboard leest als
      "rustig", en dat is precies de leugen die we hier niet willen.
   2. DE KNOPPEN VOLGEN DE RECHTEN. `snelleActies` komt van de server; het
      scherm bedenkt er niets bij. Een knop die je toch niet mag indrukken,
      hoort niet op je startscherm. */
(function () {
  'use strict';
  var K = window.RTGWerk;
  function $(id) { return document.getElementById(id); }

  function start() {
    K.api('/start', {}).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('wWie').textContent = d.wie.naam + (d.wie.functie ? ' · ' + d.wie.functie : '') +
        ' · ' + (d.wie.rollen.join(', ') || 'zonder rol') + (d.wie.alleenLezen ? ' · alleen lezen' : '');
      $('wRuimte').textContent = d.werkruimte.naam + ' (' + d.werkruimte.code + ')';

      var b = d.blokken || {};
      var kaarten = [];
      if (b.taken) kaarten.push(kaart('Mijn taken', b.taken.aantal + ' open' +
        (b.taken.teLaat ? ' · ' + b.taken.teLaat + ' te laat' : ''),
        (b.taken.taken || []).map(function (t) { return K.esc(t.titel) + (t.deadline ? ' <span class="tag">' + K.esc(t.deadline) + '</span>' : ''); })));
      if (b.projecten) kaarten.push(kaart('Projecten', b.projecten.aantal + ' lopend',
        (b.projecten.projecten || []).map(function (p) { return K.esc(p.naam) + (p.voortgang == null ? ' <span class="stil">nog geen taken</span>' : ' <span class="tag">' + p.voortgang + '%</span>'); })));
      if (b.agenda) kaarten.push(kaart('Agenda', b.agenda.openItems + ' open · ' + K.esc(b.agenda.bron),
        (b.agenda.eerstvolgend || []).map(function (a) { return K.esc(a.datum) + ' ' + K.esc(a.tijd || '') + ' ' + K.esc(a.titel); })));
      if (b.berichten) kaarten.push(kaart('Berichten', b.berichten.ongelezen + ' ongelezen', [K.esc(b.berichten.adres)]));
      if (b.documenten) kaarten.push(kaart('Documenten', b.documenten.bestanden + ' bestanden · ' + b.documenten.gedeeld + ' gedeeld',
        (b.documenten.documenten || []).map(function (x) { return K.esc(x.titel) + ' <span class="tag">' + K.esc(x.soort) + '</span>'; })));
      if (b.goedkeuringen) kaarten.push(kaart('Goedkeuringen',
        b.goedkeuringen.teStemmen + ' te stemmen · ' + b.goedkeuringen.inAdvies + ' in advies',
        b.goedkeuringen.teEvalueren ? [b.goedkeuringen.teEvalueren + ' besluit(en) toe aan evaluatie'] : []));
      if (b.klanten) kaarten.push(kaart('Verkoop', b.klanten.openKansen + ' open kansen',
        (b.klanten.kansen || []).map(function (k) { return K.esc(k.titel) + ' <span class="tag">' + K.esc(k.fase) + '</span>'; })));
      if (b.service) kaarten.push(kaart('Servicedesk', b.service.open + ' open',
        b.service.buitenNorm ? [b.service.buitenNorm + ' buiten de SLA-norm'] : []));
      if (b.bouw) kaarten.push(kaart('Bouw', b.bouw.openIssues + ' open issues',
        b.bouw.vlaggenOverDatum ? [b.bouw.vlaggenOverDatum + ' vlag(gen) over de opruimdatum'] : []));
      if (b.it) kaarten.push(kaart('IT', b.it.apparatenUit + ' apparaten uitgegeven',
        b.it.uitdienstOpen ? [b.it.uitdienstOpen + ' uitdiensttreding(en) niet afgerond'] : []));
      if (b.contracten) kaarten.push(kaart('Contracten', b.contracten.binnenkortOpzeggen + ' binnenkort opzeggen',
        b.contracten.opzegdagVoorbij ? [b.contracten.opzegdagVoorbij + ' waarvan de opzegdag al voorbij is'] : []));
      if (b.kpi) kaarten.push(kaart('Cijfers', b.kpi.mensen + ' mensen',
        [(b.kpi.projecten == null ? 'geen projecten' : b.kpi.projecten + ' projecten'),
          (b.kpi.openTickets == null ? 'geen tickets' : b.kpi.openTickets + ' open tickets')]));
      $('wBlokken').innerHTML = kaarten.join('') || '<p class="stil">Er is nog niets om te tonen.</p>';

      $('wWaarschuwingen').innerHTML = (b.waarschuwingen || []).map(function (x) {
        return K.rij('<span class="tag laat">' + K.esc(x.soort) + '</span> ' + K.esc(x.tekst), '');
      }).join('') || '<p class="stil">Er vraagt niets om aandacht.</p>';

      $('wNiet').innerHTML = (d.nietGemeten || []).map(function (x) {
        return K.rij('<b>' + K.esc(x.blok) + '</b>', K.esc(x.reden));
      }).join('') || '<p class="stil">Alles wat dit scherm belooft, heeft een bron.</p>';

      $('wActies').innerHTML = (d.snelleActies || []).map(function (a) {
        return '<span class="tag">' + K.esc(a.naam) + '</span>';
      }).join(' ') || '<span class="stil">Geen acties: u heeft leesrechten.</span>';
    });
  }

  function kaart(titel, onder, regels) {
    return '<div class="kaart"><div class="kop">' + K.esc(titel) + '</div>' +
      '<p><b>' + K.esc(onder) + '</b></p>' +
      (regels && regels.length ? '<div class="stil">' + regels.join('<br>') + '</div>' : '') + '</div>';
  }

  function beeld() {
    K.api('/beeld', {}).then(function (r) {
      var d = r.body;
      if (d.error) { $('wBeeld').innerHTML = '<p class="stil">' + K.esc(d.error) + '</p>'; return; }
      var uit = [];
      var toon = { mensen: 'Mensen', projecten: 'Projecten', verkoop: 'Verkoop', service: 'Service',
        bouw: 'Bouw', recht: 'Contracten', governance: 'Besluiten', it: 'IT' };
      Object.keys(toon).forEach(function (k) {
        if (!d[k]) return;
        uit.push(K.rij('<b>' + toon[k] + '</b>', Object.keys(d[k]).filter(function (x) { return typeof d[k][x] === 'number'; })
          .map(function (x) { return x + ' ' + d[k][x]; }).join(' · ')));
      });
      uit = uit.concat((d.nietGemeten || []).map(function (x) {
        return K.rij('<b>' + K.esc(x.blok) + '</b> <span class="tag">niet gemeten</span>', K.esc(x.reden));
      }));
      $('wBeeld').innerHTML = uit.join('');
      $('wBeeldLet').textContent = d.let || '';
    });
  }

  window.RTGWerkStart = { laad: function () { start(); beeld(); } };
})();
