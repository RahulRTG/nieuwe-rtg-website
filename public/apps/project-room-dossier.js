(function (w) {
  'use strict';
  function datum(v, metTijd) {
    if (!v) return 'Niet vastgelegd'; var d = new Date(v), t = d.getTime();
    if (!Number.isFinite(t)) return String(v);
    return d.toLocaleString('nl-NL', metTijd ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' });
  }
  function bron(naam, uitleg, url) {
    var U = w.ProjectRoomUtil;
    return '<div class="pr-bron"><b>' + U.veilig(naam) + '</b><small>' + U.veilig(uitleg) + '</small>' + (url ? '<a href="' + U.veilig(url) + '">Open bron →</a>' : '') + '</div>';
  }
  function teken(root, staat, p) {
    var vak = root.querySelector('#prDossier'), U = w.ProjectRoomUtil;
    if (!p) { vak.innerHTML = '<div class="pr-leeg"><h2>Geen project gekozen.</h2><p>Open een project uit de uitvoering om het levende dossier te bekijken.</p><button class="pr-secundair" type="button" data-pr-open="uitvoering">Naar uitvoering</button></div>'; return; }
    var v = w.ProjectRoomUitvoering.voortgang(p), intentie = (staat.intenties || []).find(function (x) { return x.id === p.intentieId; });
    var besluit = (staat.goedkeuringen || []).find(function (x) { return x.id === p.goedkeuringId; });
    var momenten = (p.tijdlijn || []).slice().sort(function (a, b) { return Number(new Date(a.at)) - Number(new Date(b.at)); });
    var tijdlijn = momenten.length ? momenten.map(function (x) { return '<div class="pr-moment"><b>' + U.veilig(x.tekst || x.soort) + '</b><small>' + U.veilig(x.soort || 'project') + ' · ' + U.veilig(datum(x.at, true)) + '</small></div>'; }).join('') : '<div class="pr-geen">De tijdlijn bevat nog geen projectmomenten.</div>';
    var bronnen = '';
    if (p.bron && p.bron.mailId) bronnen += bron('RTMail', p.bron.onderwerp || 'Oorspronkelijke vraag', '/apps/rtmail.html');
    if (p.documenten && p.documenten.ruimte) bronnen += bron('RTDocs', 'Projectruimte voor actuele documenten', p.documenten.ruimte + '&project=' + encodeURIComponent(p.id));
    if (p.goedkeuringId) bronnen += bron('Decision Room', besluit ? 'Besluitstatus: ' + besluit.status : 'Gekoppeld besluit', '/apps/decision-room.html?id=' + encodeURIComponent(p.goedkeuringId) + '&huis=' + encodeURIComponent(staat.huis));
    bronnen += bron('RTG One', 'Project, taken en auditspoor', '/apps/rtgone.html');
    vak.innerHTML = '<div class="pr-dossierkop"><div><span class="pr-label">' + U.veilig(p.status || 'project') + '</span><h2>' + U.veilig(p.titel) + '</h2><p>' + U.veilig(intentie && intentie.waarom || 'De oorspronkelijke bedoeling staat nog niet afzonderlijk beschreven.') + '</p></div><div class="pr-dossierstatus"><b>' + v.pct + '% uitgevoerd</b><small>' + v.klaar + ' van ' + v.totaal + ' taken · ' + (p.bewijs || []).length + ' bewijsstukken</small></div></div>' +
      '<div class="pr-feiten"><div class="pr-feit"><small>Eigenaar</small><b>' + U.veilig(p.eigenaar || 'Onbekend') + '</b></div><div class="pr-feit"><small>Deadline</small><b>' + U.veilig(datum(p.deadline)) + '</b></div><div class="pr-feit"><small>Besluit</small><b>' + U.veilig(besluit ? besluit.status : 'Niet gekoppeld') + '</b></div><div class="pr-feit"><small>Bewijs</small><b>' + (p.bewijs || []).length + '</b></div></div>' +
      '<div class="pr-dossiergrid"><section><div class="pr-sectiekop"><h2>Levende tijdlijn</h2><span>Bron tot uitvoering</span></div><div class="pr-tijdlijn">' + tijdlijn + '</div></section><section><div class="pr-sectiekop"><h2>Gekoppelde bronnen</h2><span>Geen kopieën</span></div><div class="pr-bronnen">' + bronnen + '</div><div class="pr-focusvoet"><small>De actuele bron blijft eigenaar van haar inhoud.</small><button class="pr-primair" type="button" data-pr-open="oplevering">Naar oplevering →</button></div></section></div>';
  }
  w.ProjectRoomDossier = Object.freeze({ teken: teken });
}(window));
