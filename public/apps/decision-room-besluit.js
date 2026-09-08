(function (w) {
  'use strict';
  function borging(x) {
    var stappen = [
      ['RTG One', x.projectId ? 'Het gekoppelde project krijgt na definitieve goedkeuring een uitvoeringstaak.' : 'Het besluit en de beoordelingen blijven in het gezamenlijke werkgeheugen.'],
      ['Vier-ogenroute', Number(x.vereist || 1) > 1 ? 'Pas na ' + Number(x.vereist) + ' bevoegde beoordelingen wordt uitvoering vrijgegeven.' : 'Eén bevoegde beoordeling volstaat voor dit risiconiveau.'],
      ['RTDocs', x.documentId ? 'Document ' + (x.documentTitel || x.documentId) + ' blijft gekoppeld aan dit besluit.' : 'Er is geen RTDocs-document aan dit voorstel gekoppeld.'],
      ['Auditspoor', 'Rol, keuze, reden en tijdstip worden onveranderlijk aan de beoordeling toegevoegd.']
    ];
    return stappen.map(function (s, i) { return '<div class="dr-borgstap"><i>' + (i + 1) + '</i><span><b>' + s[0] + '</b><small>' + w.DecisionRoomUtil.veilig(s[1]) + '</small></span></div>'; }).join('');
  }
  function gesloten(x) {
    var U = w.DecisionRoomUtil, b = x.besluit || {}, labels = { goedgekeurd: 'Goedgekeurd', afgewezen: 'Niet uitvoeren', aanpassen: 'Terug voor aanpassing' };
    var vervolg = x.status === 'goedgekeurd' && x.projectId ? '<a class="dr-primair" href="/apps/project-room.html?project=' + encodeURIComponent(x.projectId) + '&huis=' + encodeURIComponent(x.huis || 'rtg') + '">Open uitvoering →</a>' : '';
    return '<div class="dr-leeg"><h2>' + U.veilig(labels[x.status] || x.status) + '</h2><p>' + U.veilig(b.reden || 'De keuze is vastgelegd in het besluitregister.') + '</p><button class="dr-secundair" type="button" data-dr-open="archief">Open besluitregister</button>' + vervolg + '</div>';
  }
  function teken(root, x) {
    var vak = root.querySelector('#drBesluit'), U = w.DecisionRoomUtil;
    if (!x) { vak.innerHTML = '<div class="dr-leeg"><h2>Geen afweging geopend.</h2><p>Kies eerst een voorstel uit de besluitagenda.</p><button class="dr-secundair" type="button" data-dr-open="agenda">Naar agenda</button></div>'; return; }
    if (x.status !== 'wacht') { vak.innerHTML = gesloten(x); return; }
    vak.innerHTML = '<form class="dr-besluitkaart" id="drBesluitForm"><div class="dr-besluitkeuzes"><span class="dr-label">' + U.veilig(x.type || 'operations') + '</span><h2>' + U.veilig(x.titel) + '</h2><p>Kies wat er met het voorstel gebeurt. De reden reist mee naar iedereen die het vervolg uitvoert.</p><div class="dr-radios">' +
      '<label class="dr-radio"><input type="radio" name="besluit" value="goedkeuren" checked><span><b>Akkoord' + (Number(x.vereist || 1) > 1 ? ' als bevoegde beoordelaar' : '') + '</b><small>Uitvoering start pas wanneer de volledige route rond is.</small></span></label>' +
      '<label class="dr-radio"><input type="radio" name="besluit" value="terug"><span><b>Terug voor aanpassing</b><small>Het voorstel sluit als aanpassen; de aanvrager ziet waarom.</small></span></label>' +
      '<label class="dr-radio"><input type="radio" name="besluit" value="afwijzen"><span><b>Niet uitvoeren</b><small>Het besluit sluit zonder de voorgestelde verandering.</small></span></label></div>' +
      '<label class="dr-invoer"><span>Reden van uw keuze</span><textarea name="reden" maxlength="600" placeholder="Wat moet de volgende mens begrijpen?"></textarea></label>' +
      '<label class="dr-invoer"><span>Voorwaarde bij akkoord · optioneel</span><textarea name="voorwaarde" maxlength="600" placeholder="Bijvoorbeeld: alleen na controle van Finance"></textarea></label>' +
      '<div class="dr-beslis"><button type="button" data-dr-open="afweging">Nogmaals afwegen</button><button class="dr-primair" type="submit">Menselijk bevestigen →</button></div></div>' +
      '<aside class="dr-borging"><div class="dr-ey">Na uw bevestiging</div><h3>Borging zonder extra zoekwerk.</h3>' + borging(x) + '<div class="dr-grens"><b>De mens beslist.</b> Uw keuze wordt met tijd, rol, dossier en gebruikte bron vastgelegd. Rahul kan voorbereiden, nooit bevestigen.</div></aside></form>';
  }
  w.DecisionRoomBesluit = Object.freeze({ teken: teken });
}(window));
