(function (w) {
  'use strict';
  var beeld = w.RTGTeamRoomBeeld, h = beeld && beeld.helpers;
  if (!beeld || !h) return;
  var esc = h.esc, init = beeld.initialen;

  function team(root, stand, index) {
    var dagen = stand.week && stand.week.days || [], dag = dagen[index] || dagen[0], leden = dag && dag.staff || [];
    root.querySelector('#trmDagen').innerHTML = dagen.map(function (d, i) {
      var dt = new Date(d.date), naam = d.label === 'Vandaag' ? 'Nu' : dt.toLocaleDateString('nl-NL', { weekday: 'short' }).replace('.', '');
      return '<button class="trm-dag" type="button" data-trm-dag="' + i + '"' + (i === index ? ' aria-current="date"' : '') + '><span>' + esc(naam) + '</span><b>' + esc(String(dt.getDate())) + '</b></button>';
    }).join('');
    var verlof = leden.filter(function (m) { return h.verlofOp(stand, m, dag); }).length;
    var gepland = leden.filter(function (m) { return m.shift && m.shift !== 'Vrij' && !h.verlofOp(stand, m, dag); }).length;
    root.querySelector('#trmBezetting').innerHTML = '<b>' + gepland + ' ingepland' + (verlof ? ' · ' + verlof + ' verlof' : '') + '</b><small>' + esc(dag ? h.datumKort(dag.date) : 'Geen rooster') + '</small>';
    root.querySelector('#trmTeam').innerHTML = leden.length ? leden.map(function (m) {
      var vrij = m.shift === 'Vrij', vrijRij = h.verlofOp(stand, m, dag), binnen = index === 0 && ((stand.state.klok && stand.state.klok.binnen) || []).indexOf(m.name) >= 0;
      var status = vrijRij ? 'Verlof' : vrij ? 'Vrij' : binnen ? 'Aan het werk' : index ? 'Ingepland' : 'Later';
      var klasse = binnen ? ' werk' : vrijRij ? ' pauze' : '';
      var eigen = Number(m.id) === Number(stand.me.staffId), klik = eigen || stand.me.role === 'manager', tag = klik ? 'button' : 'div';
      return '<' + tag + ' class="trm-teamrij"' + (klik ? ' type="button" data-trm-lid="' + m.id + '"' : '') + '><span class="trm-avatar">' + esc(init(m.name)) + '</span><span class="trm-teamnaam"><b>' + esc(m.name) + (eigen ? ' · u' : '') + '</b><span>' + esc((m.func || (m.role === 'manager' ? 'Manager' : 'Medewerker')) + ' · ' + (m.shift || 'Geen dienst')) + '</span></span><span class="trm-stand' + klasse + '">' + esc(status) + '</span></' + tag + '>';
    }).join('') : '<div class="trm-leeg">Voor deze dag staat nog niemand in het rooster.</div>';
    var open = ((stand.state && stand.state.verlof) || []).filter(function (v) { return v.status === 'aangevraagd' || v.status === 'open'; });
    root.querySelector('#trmTeamAandacht').innerHTML = open.length && stand.me.role === 'manager' ? '<div class="trm-aandacht"><span><b>' + open.length + (open.length === 1 ? ' verlofaanvraag vraagt' : ' verlofaanvragen vragen') + ' aandacht</b><span>Behandel dit in het volledige personeelsdossier.</span></span><button type="button" data-trm-diep="hulp">Open dossier</button></div>' : '';
  }

  function profiel(root, stand, lid, dossier) {
    lid = lid || { id: stand.me.staffId, name: stand.me.name, role: stand.me.role }; dossier = dossier || {};
    var eigen = Number(lid.id) === Number(stand.me.staffId), rooster = h.lidOpDag(stand, lid, 0);
    var binnen = ((stand.state.klok && stand.state.klok.binnen) || []).indexOf(lid.name) >= 0;
    var gesprekken = dossier.gesprekken || [], certs = (dossier.certificaten || []).filter(function (x) { return Number(x.staffId) === Number(lid.id); });
    var inwerk = (dossier.inwerk || []).filter(function (x) { return Number(x.staffId) === Number(lid.id); });
    var gesprek = gesprekken.filter(function (x) { return Number(x.staffId) === Number(lid.id); }).slice(-1)[0];
    var traject = inwerk.filter(function (x) { return !x.klaarOp; })[0] || inwerk.slice(-1)[0];
    var gedaan = traject ? traject.stappen.filter(function (x) { return x.klaar; }).length : 0;
    var contract = (dossier.contracten || []).find(function (x) { return x.partij && x.partij.kind === 'staff' && x.partij.naam === lid.name; });
    root.querySelector('#trmPortret').textContent = init(lid.name);
    root.querySelector('#trmProfielTitel').textContent = lid.name || 'Medewerker';
    root.querySelector('#trmProfielRol').textContent = lid.func || (lid.role === 'manager' ? 'Manager' : 'Medewerker');
    root.querySelector('#trmProfielStatus').textContent = binnen ? 'Aan het werk' : rooster && rooster.shift === 'Vrij' ? 'Vandaag vrij' : 'Niet ingeklokt';
    var roosterVak = root.querySelector('#trmProfielRooster');
    roosterVak.innerHTML = '<article class="trm-profielkaart"><h2>Vandaag</h2><strong>' + esc(h.klokUitDienst(rooster && rooster.shift)) + '</strong><p>' + esc(stand.state.supplier.city || 'Locatie niet vastgelegd') + '</p></article><article class="trm-profielkaart"><h2>Afspraken</h2><strong>' + esc(gesprek ? h.datumKort(gesprek.datum) : 'Nog geen gesprek') + '</strong><p>' + esc(gesprek ? gesprek.onderwerp : 'Er is niets ingevuld.') + '</p></article><article class="trm-profielkaart"><h2>Vaardigheden</h2>' + (certs.length ? '<div class="trm-chips">' + certs.slice(0, 4).map(function (x) { return '<span class="trm-chip">' + esc(x.soort) + '</span>'; }).join('') + '</div>' : '<p>Nog geen certificaten vastgelegd.</p>') + '</article><article class="trm-profielkaart"><h2>Ontwikkeling</h2><strong>' + esc(traject ? 'Inwerktraject' : 'Geen open traject') + '</strong>' + (traject ? '<div class="trm-voortgang"><span data-trm-voortgang="' + Math.round(100 * gedaan / Math.max(1, traject.stappen.length)) + '"></span></div><p>' + gedaan + ' van ' + traject.stappen.length + ' stappen</p>' : '<p>Nieuwe afspraken verschijnen hier.</p>') + '</article>';
    var meter = roosterVak.querySelector('[data-trm-voortgang]'); if (meter) meter.style.width = meter.dataset.trmVoortgang + '%';
    root.querySelector('#trmDienstverband').innerHTML = '<b>Dienstverband · ' + esc(contract ? contract.titel : 'niet vastgelegd') + '</b><span>' + esc(contract ? (contract.status + ' · ' + contract.ref) : (eigen ? 'Open uw volledige dossier voor contracten en loon.' : 'Alleen vastgelegde afspraken worden getoond.')) + '</span>';
  }

  beeld.team = team; beeld.profiel = profiel; Object.freeze(beeld);
}(window));
