(function (w) {
  'use strict';
  function bewijsRijen(p) {
    var U = w.ProjectRoomUtil, lijst = p.bewijs || [];
    if (!lijst.length) return '<div class="pr-leeg">Nog geen bewijs vastgelegd. Voeg alleen iets toe dat het bereikte resultaat werkelijk aantoont.</div>';
    return '<div class="pr-bewijslijst">' + lijst.map(function (x) {
      return '<div class="pr-bewijs"><span class="pr-vink">✓</span><span><b>' + U.veilig(x.titel) + '</b><small>' + U.veilig(x.uitleg) + (x.bron ? ' · ' + U.veilig(x.bron) : '') + '</small></span><em>' + U.veilig(x.status || 'vastgelegd') + '</em></div>';
    }).join('') + '</div>';
  }
  function teken(root, staat, p) {
    var vak = root.querySelector('#prOplevering'), U = w.ProjectRoomUtil;
    if (!p) { vak.innerHTML = '<div class="pr-leeg"><h2>Geen project gekozen.</h2><p>Kies eerst een echt project uit de uitvoering.</p><button class="pr-secundair" type="button" data-pr-open="uitvoering">Naar uitvoering</button></div>'; return; }
    var v = w.ProjectRoomUitvoering.voortgang(p), allesKlaar = v.totaal > 0 && v.klaar === v.totaal, bewijs = (p.bewijs || []).length;
    var besluit = (staat.goedkeuringen || []).find(function (x) { return x.id === p.goedkeuringId; }), besluitKlaar = !besluit || besluit.status === 'goedgekeurd';
    if (p.status === 'afgerond' && p.oplevering) {
      vak.innerHTML = '<article class="pr-resultaat"><span class="pr-label klaar">Menselijk opgeleverd</span><h2>' + U.veilig(p.oplevering.uitkomst) + '</h2><p>' + U.veilig(p.oplevering.leren || 'Er is geen afzonderlijke leerregel vastgelegd.') + '</p><div class="pr-voortgang"><i style="width:100%"></i></div><div class="pr-metertekst"><span>100% afgerond</span><span>' + U.veilig(p.oplevering.door || 'Projecteigenaar') + '</span></div></article><div class="pr-bewijskop"><h2>Bewijs van uitvoering</h2><span class="pr-label">' + bewijs + ' vastgelegd</span></div>' + bewijsRijen(p); return;
    }
    var gereed = allesKlaar && bewijs && besluitKlaar;
    var uitleg = !besluitKlaar ? 'De uitvoering kan worden voorbereid, maar opleveren wacht op de volledige besluitroute.' : !allesKlaar ? 'Rond eerst de resterende ' + (v.totaal - v.klaar) + ' uitvoeringstaken af.' : !bewijs ? 'Alle taken zijn klaar. Leg nu minimaal één bewijsstuk van het resultaat vast.' : 'Taken en bewijs zijn compleet. De projecteigenaar kan het bereikte resultaat menselijk bevestigen.';
    vak.innerHTML = '<article class="pr-resultaat"><span class="pr-label' + (gereed ? ' klaar' : '') + '">' + (gereed ? 'Gereed voor controle' : 'Nog niet opleverrijp') + '</span><h2>' + U.veilig(p.titel) + '</h2><p>' + U.veilig(uitleg) + '</p><div class="pr-voortgang" role="progressbar" aria-label="Uitvoeringstaken afgerond" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + (v.totaal ? Math.round(v.klaar / v.totaal * 100) : 0) + '"><i style="width:' + (v.totaal ? Math.round(v.klaar / v.totaal * 100) : 0) + '%"></i></div><div class="pr-metertekst"><span>' + v.klaar + ' van ' + v.totaal + ' taken</span><span>' + bewijs + ' bewijsstukken</span></div></article>' +
      '<div class="pr-bewijskop"><h2>Bewijs van uitvoering</h2><button class="pr-secundair" type="button" data-pr-bewijs>Bewijs toevoegen</button></div>' + bewijsRijen(p) +
      '<form class="pr-opleverform" id="prOpleverForm"><h2>Menselijke oplevering</h2><p>Een afgeronde takenlijst is geen resultaat op zichzelf. Beschrijf wat aantoonbaar is bereikt en wat het volgende project hiervan moet leren.</p><label><span>Aantoonbaar resultaat</span><textarea name="uitkomst" maxlength="600" required></textarea></label><label><span>Wat nemen we mee?</span><textarea name="leren" maxlength="600"></textarea></label><button class="primair" type="submit"' + (gereed ? '' : ' disabled') + '>Menselijk opleveren en leren vastleggen →</button></form>';
  }
  w.ProjectRoomOplevering = Object.freeze({ teken: teken });
}(window));
