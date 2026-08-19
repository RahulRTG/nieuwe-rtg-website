/* RTG School Partner, deelbestand "zorg": het zorgdeel van een leerlingdossier
   op het scherm. Apart van dossier.js, precies zoals op de server (dossier.js
   naast zorg.js): het gevoeligste deel van wat een school over een kind
   bewaart hoort een eigen plek te hebben, ook in de code.

   Het scherm doet de reden NIET af als een formulierveld dat nu eenmaal moet.
   Er staat bij wat ermee gebeurt -- de reden komt in het journaal, en de
   ouders kunnen dat journaal opvragen -- want dat is de enige manier om
   achteraf de vraag te beantwoorden die ouders echt stellen: waarom heeft
   iemand in het dossier van mijn kind gekeken?

   Een leerdoel zonder wie eraan werkt is een voornemen: doelen en sessies
   staan daarom onder elkaar in hetzelfde blok, net als op de server. */
window.RTGSchoolDossierZorg = (function () {
  'use strict';

  function teken(A, sleutels, esc, meld, id, dossier, herlaad) {
    var vak = document.getElementById('doZorg');
    if (!vak) return;
    var afgeschermd = /afgeschermd/i.test(String(dossier.zorgToegang || ''));
    if (afgeschermd) {
      vak.innerHTML = '<div class="kop" style="margin-top:.9rem;">Zorgdeel</div>' +
        '<p class="stil">' + esc(dossier.zorgToegang) + '</p>';
      return;
    }
    vak.innerHTML = '<div class="kop" style="margin-top:.9rem;">Zorgdeel</div>' +
      '<div class="rij"><input class="veld" id="zoReden" maxlength="120" placeholder="Waarom opent u dit zorgdeel?" ' +
      'aria-label="Reden om het zorgdeel te openen">' +
      '<button class="knop" id="zoOpen" type="button">Open het zorgdeel</button></div>' +
      '<p class="stil">Deze reden komt in het inzagejournaal van de school, met uw naam en het moment. De ouders kunnen dat journaal opvragen; wat er in het dossier stond, komt er nooit in.</p>' +
      '<div id="zoInhoud"></div>';
    document.getElementById('zoOpen').addEventListener('click', function () {
      var reden = document.getElementById('zoReden').value.trim();
      if (!reden) return meld('Noteer waarom u het zorgdeel opent. Zonder reden gaat het niet open.');
      A('/school/dossier', sleutels({ leerlingId: id, zorg: true, reden: reden })).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        inhoud(A, sleutels, esc, meld, id, r.body.zorg || {}, reden, herlaad);
      });
    });
  }

  function inhoud(A, sleutels, esc, meld, id, z, reden, herlaad) {
    var doelen = (z.doelen || []).map(function (d) {
      return '<div class="item"><span>' + esc(d.tekst) + ' <span class="stil">' +
        (d.vak ? esc(d.vak) + ' · ' : '') + (d.tot ? 'tot ' + esc(d.tot) + ' · ' : '') + esc(d.door) + '</span></span>' +
        (d.behaald ? '<span class="tag aan">behaald</span>'
          : '<button class="knop" data-doel="' + esc(d.id) + '">Behaald</button>') + '</div>';
    }).join('') || '<p class="stil">Nog geen leerdoelen in dit plan.</p>';
    var sessies = (z.sessies || []).slice(0, 8).map(function (s) {
      return '<div class="item"><span>' + esc(s.wat) + ' <span class="stil">' + s.minuten + ' min · ' +
        esc(s.begeleider) + '</span></span><span class="stil">' + esc(String(s.at).slice(0, 10)) + '</span></div>';
    }).join('') || '<p class="stil">Nog geen begeleidingssessies genoteerd.</p>';
    var notities = (z.notities || []).slice(0, 8).map(function (n) {
      return '<div class="item"><span>' + esc(n.tekst) + '</span><span class="stil">' +
        esc(String(n.at).slice(0, 10)) + ' · ' + esc(n.door) + '</span></div>';
    }).join('') || '<p class="stil">Geen notities.</p>';

    document.getElementById('zoInhoud').innerHTML =
      '<p class="stil">Geopend; de reden staat in het journaal.</p>' +
      (z.gedeeld ? '<p class="stil">U ziet dit dossier omdat het expliciet met u is gedeeld: het plan en de sessies, niet de notities.</p>' : '') +
      '<div class="rij" style="margin-top:.5rem;">' +
      '<textarea class="veld" id="zoBehoefte" rows="2" maxlength="200" placeholder="Ondersteuningsbehoefte" aria-label="Ondersteuningsbehoefte">' +
      esc(z.behoefte || '') + '</textarea>' +
      '<textarea class="veld" id="zoPlan" rows="2" maxlength="600" placeholder="Plan" aria-label="Ondersteuningsplan">' +
      esc(z.plan || '') + '</textarea>' +
      '<button class="knop p" id="zoBewaar" type="button">Bewaar plan</button></div>' +
      '<div class="kop" style="margin-top:.8rem;">Leerdoelen</div>' + doelen +
      '<div class="rij" style="margin-top:.5rem;">' +
      '<input class="veld" id="zoDoel" maxlength="200" placeholder="Nieuw leerdoel" aria-label="Nieuw leerdoel">' +
      '<input class="veld" id="zoDoelVak" maxlength="40" placeholder="Vak" aria-label="Vak" style="flex:0 1 8rem;">' +
      '<input class="veld" id="zoDoelTot" type="date" aria-label="Tot wanneer" style="flex:0 1 10rem;">' +
      '<button class="knop" id="zoDoelErbij" type="button">Doel erbij</button></div>' +
      '<div class="kop" style="margin-top:.8rem;">Begeleiding</div>' + sessies +
      '<div class="rij" style="margin-top:.5rem;">' +
      '<input class="veld" id="zoWat" maxlength="200" placeholder="Wat is er gedaan?" aria-label="Wat is er in de sessie gedaan">' +
      '<input class="veld" id="zoMin" type="number" min="5" max="240" step="5" value="30" aria-label="Minuten" style="flex:0 1 7rem;">' +
      '<input class="veld" id="zoVervolg" maxlength="200" placeholder="Vervolg (mag leeg)" aria-label="Vervolg">' +
      '<button class="knop" id="zoSessie" type="button">Noteer sessie</button></div>' +
      '<div class="kop" style="margin-top:.8rem;">Notities</div>' + notities +
      '<div class="rij" style="margin-top:.5rem;">' +
      '<input class="veld" id="zoNotitie" maxlength="600" placeholder="Notitie" aria-label="Notitie">' +
      '<button class="knop" id="zoNotitieErbij" type="button">Noteer</button></div>' +
      '<div class="kop" style="margin-top:.8rem;">Delen met een externe begeleider</div>' +
      '<p class="stil">Zonder deze stap ziet een externe niets, ook niet met de rol. Terugdraaien kan altijd.' +
      ((z.gedeeldMet || []).length ? ' Nu gedeeld met: ' + esc((z.gedeeldMet || []).join(', ')) + '.' : '') + '</p>' +
      '<div class="rij"><input class="veld" id="zoWie" maxlength="24" placeholder="Personeels-id" aria-label="Personeels-id van de begeleider">' +
      '<button class="knop" id="zoDeel" type="button">Deel</button>' +
      '<button class="knop" id="zoDeelStop" type="button">Stop met delen</button></div>';

    var q = function (x) { return document.getElementById(x); };
    var zet = function (body, bericht) {
      A('/school/zorg/zet', sleutels(Object.assign({ leerlingId: id, reden: reden }, body)))
        .then(function (r) { meld(r.body.error || bericht); if (!r.body.error) herlaad(); });
    };
    q('zoBewaar').addEventListener('click', function () {
      zet({ behoefte: q('zoBehoefte').value, plan: q('zoPlan').value }, 'Plan bijgewerkt.');
    });
    q('zoDoelErbij').addEventListener('click', function () {
      if (!q('zoDoel').value.trim()) return meld('Schrijf eerst het leerdoel op.');
      zet({ doel: q('zoDoel').value, vak: q('zoDoelVak').value, tot: q('zoDoelTot').value }, 'Leerdoel toegevoegd.');
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-doel]'), function (b) {
      b.addEventListener('click', function () { zet({ doelBehaald: b.dataset.doel }, 'Leerdoel afgevinkt.'); });
    });
    q('zoNotitieErbij').addEventListener('click', function () {
      if (!q('zoNotitie').value.trim()) return meld('Er staat nog geen notitie.');
      zet({ notitie: q('zoNotitie').value }, 'Notitie bewaard.');
    });
    q('zoSessie').addEventListener('click', function () {
      if (!q('zoWat').value.trim()) return meld('Noteer wat er in de sessie is gedaan.');
      A('/school/zorg/sessie', sleutels({ leerlingId: id, wat: q('zoWat').value,
        minuten: Number(q('zoMin').value) || 30, vervolg: q('zoVervolg').value }))
        .then(function (r) { meld(r.body.error || 'Sessie genoteerd.'); if (!r.body.error) herlaad(); });
    });
    var deel = function (aan) {
      if (!q('zoWie').value.trim()) return meld('Vul het personeels-id van de begeleider in.');
      A('/school/zorg/deel', sleutels({ leerlingId: id, personeelId: q('zoWie').value.trim(), aan: aan }))
        .then(function (r) { meld(r.body.error || (aan ? 'Gedeeld met de begeleider.' : 'Delen gestopt.')); if (!r.body.error) herlaad(); });
    };
    q('zoDeel').addEventListener('click', function () { deel(true); });
    q('zoDeelStop').addEventListener('click', function () { deel(false); });
  }

  return { teken: teken };
})();
