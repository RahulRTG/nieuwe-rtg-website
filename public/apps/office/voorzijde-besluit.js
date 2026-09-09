(function (w) {
  'use strict';
  function regel(goed, titel, uitleg) {
    return '<div class="rtd-controle"><span class="rtd-vink' + (goed ? '' : ' wacht') + '">' + (goed ? '&#10003;' : '&#9675;') + '</span>' +
      '<span><b>' + RTGDocsDossier.veilig(titel) + '</b><small>' + RTGDocsDossier.veilig(uitleg) + '</small></span>' +
      '<em' + (goed ? '' : ' class="wacht"') + '>' + (goed ? 'Compleet' : 'Wacht') + '</em></div>';
  }
  function bronGekoppeld() {
    var p = new URLSearchParams(location.search);
    return !!(p.get('project') || p.get('bron'));
  }
  function teken(root, actueel) {
    var vak = root.querySelector('#rtdBesluit');
    if (!actueel || !actueel.doc) {
      vak.innerHTML = '<div class="rtd-leeg"><h2>Nog geen dossier gekozen.</h2><p>Een beoordeling begint bij een echt document. Kies er één bij Nodig.</p><button class="rtd-secundair" type="button" data-rtd-open="nodig">Naar Nodig</button></div>';
      return;
    }
    var doc = actueel.doc;
    var fase = (doc.werkstroom && doc.werkstroom.fase) || 'concept';
    var openActies = Number(doc.samenwerken && doc.samenwerken.openActies || 0);
    var bron = bronGekoppeld();
    var eigenaar = !!doc.door;
    var actueelVersie = !!doc.gewijzigd;
    var beoordeling = fase !== 'concept';
    var knop = fase === 'concept' && doc.magBewerken
      ? '<button type="button" data-rtd-vraag="' + RTGDocsDossier.veilig(doc.id) + '">Vraag beoordeling &rarr;</button>'
      : '<button type="button" data-rtd-room="' + RTGDocsDossier.veilig(doc.id) + '">Open Decision Room &rarr;</button>';
    vak.innerHTML = '<article class="rtd-besluitkaart"><div class="rtd-besluitkop"><span class="rtd-zegel">B</span><span><h2>' +
      RTGDocsDossier.veilig(doc.titel) + '</h2><p>' + RTGDocsDossier.veilig(RTGDocsDossier.faseNaam(fase)) + ' · ' + RTGDocsDossier.veilig(doc.door || 'eigenaar onbekend') + '</p></span></div>' +
      '<div class="rtd-controles">' +
      regel(bron, 'Werkstroombron gekoppeld', bron ? 'Herkomst meegegeven via RTMail of RTG One' : 'Nog geen RTMail- of RTG One-bron bij dit dossier') +
      regel(actueelVersie, 'Actuele versie geopend', actueelVersie ? 'Gewijzigd ' + new Date(doc.gewijzigd).toLocaleString('nl-NL') : 'Versiedatum ontbreekt') +
      regel(eigenaar, 'Eigenaar bekend', eigenaar ? doc.door : 'Wijs eerst een eigenaar toe') +
      regel(openActies === 0, 'Open acties verwerkt', openActies ? openActies + (openActies === 1 ? ' actie staat' : ' acties staan') + ' nog open' : 'Geen open acties in het dossier') +
      regel(beoordeling, 'Menselijke beoordeling gestart', fase === 'concept' ? 'Nog aan te vragen' : RTGDocsDossier.faseNaam(fase)) +
      '</div></article><div class="rtd-grens"><b>De mens beslist.</b> RTDocs controleert volledigheid, versie en herkomst. Het keurt geen bedrag, contract of koerswijziging goed.</div>' +
      '<div class="rtd-besluitacties"><button type="button" data-rtd-open="dossier">Terug naar dossier</button>' + knop + '</div>';
  }
  async function vraag(root, office, actueel) {
    if (!actueel || !actueel.doc || !actueel.doc.magBewerken) return { ok: false, fout: 'U heeft geen schrijfrecht op dit document.' };
    var uit = await office.api('fase', { id: actueel.doc.id, naar: 'beoordeling', mens: false });
    if (uit.status !== 200) return { ok: false, fout: uit.body.error || 'Beoordeling kon niet worden aangevraagd.' };
    actueel.doc.werkstroom = actueel.doc.werkstroom || {};
    actueel.doc.werkstroom.fase = uit.body.fase;
    actueel.doc.gewijzigd = uit.body.gewijzigd;
    teken(root, actueel);
    return { ok: true };
  }
  w.RTGDocsBesluit = Object.freeze({ teken: teken, vraag: vraag });
}(window));
