(function (w, d) {
  'use strict';
  var actueel = null;
  function veilig(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function initialen(v) {
    var delen = String(v || 'RTG').replace(/[^a-z0-9]+/gi, ' ').trim().split(/\s+/).filter(Boolean);
    return (delen.length > 1 ? delen[0][0] + delen[delen.length - 1][0] : String(delen[0] || 'RT').slice(0, 2)).toUpperCase();
  }
  function datum(v) {
    var x = new Date(v);
    if (!Number.isFinite(x.getTime())) return 'tijd onbekend';
    return x.toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function soort(v) {
    return ({ tekst: 'Document', blad: 'Rekenblad', presentatie: 'Presentatie', formulier: 'Formulier', schets: 'Schets', bord: 'Bord' })[v] || 'Document';
  }
  function kaal(html) {
    var vak = d.createElement('div'); vak.innerHTML = String(html || '');
    return String(vak.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function voorproef(doc) {
    var i = doc.inhoud || {}, regels = [];
    if (doc.soort === 'tekst') regels.push(kaal(i.tekst));
    else if (doc.soort === 'presentatie') regels = (i.dias || []).slice(0, 3).map(function (x) { return [x.titel, x.tekst].filter(Boolean).join(' · '); });
    else if (doc.soort === 'blad') regels = Object.keys(i.cellen || {}).slice(0, 6).map(function (k) { return k + ': ' + String(i.cellen[k] && i.cellen[k].waarde != null ? i.cellen[k].waarde : i.cellen[k]); });
    else if (doc.soort === 'formulier') regels = (i.vragen || []).slice(0, 4).map(function (x) { return x.tekst; });
    else if (doc.soort === 'bord') regels = (i.lijsten || []).slice(0, 4).map(function (x) { return x.titel || x.naam; });
    else if (doc.soort === 'schets') regels.push((i.vormen || []).length + ' vormen in deze schets.');
    var tekst = regels.filter(Boolean).join('\n');
    if (!tekst) tekst = 'Dit ' + soort(doc.soort).toLowerCase() + ' heeft nog geen zichtbare inhoud.';
    return tekst.length > 520 ? tekst.slice(0, 519) + '…' : tekst;
  }
  function faseNaam(v) {
    return ({ concept: 'Concept', beoordeling: 'Ter beoordeling', goedgekeurd: 'Goedgekeurd', archief: 'Archief' })[v] || 'Concept';
  }
  function faseUitleg(v) {
    return v === 'beoordeling' ? 'Een mens controleert het stuk' : v === 'goedgekeurd' ? 'Door de eigenaar goedgekeurd' : v === 'archief' ? 'Afgesloten en terugvindbaar' : 'Werk in uitvoering';
  }
  function mensen(doc) {
    var namen = [doc.door].concat(doc.bewerkers || [], doc.gedeeldMet || []).filter(Boolean);
    return namen.filter(function (x, i) { return namen.indexOf(x) === i; }).slice(0, 4);
  }
  function contextBron() {
    var p = new URLSearchParams(location.search);
    if (p.get('project')) return 'RTG One-project gekoppeld';
    if (p.get('bron') === 'rtmail') return 'RTMail-bron meegegeven';
    return 'Nog geen werkstroombron gekoppeld';
  }
  function teken(root, doc, versies) {
    var fase = (doc.werkstroom && doc.werkstroom.fase) || 'concept';
    var namen = mensen(doc);
    var avatars = namen.length ? namen.map(function (x) { return '<span class="rtd-avatar" title="' + veilig(x) + '">' + veilig(initialen(x)) + '</span>'; }).join('') : '<span class="rtd-avatar">RT</span>';
    root.querySelector('#rtdDossier').innerHTML =
      '<div class="rtd-terugkop"><button class="rtd-rond" type="button" data-rtd-open="nodig" aria-label="Terug naar Nodig">&larr;</button>' +
      '<span class="rtd-terugtitel"><b>Levend dossier</b><span>Versie, context en mensen bij elkaar</span></span><span class="rtd-mensen" aria-label="Betrokkenen">' + avatars + '</span></div>' +
      '<article class="rtd-dossierkop"><small>' + veilig(soort(doc.soort)) + ' · ' + veilig(faseNaam(fase)) + '</small><h1>De inhoud en haar verhaal blijven bij elkaar.</h1></article>' +
      '<article class="rtd-papier"><div class="rtd-papiermerk">RTG <span>' + veilig(doc.samenwerken && doc.samenwerken.classificatie || 'intern') + '</span></div>' +
      '<h2>' + veilig(doc.titel) + '</h2><p>' + veilig(voorproef(doc)) + '</p>' +
      '<div class="rtd-papierregel"><strong>Versie</strong><span>Huidige versie · ' + veilig(datum(doc.gewijzigd)) + '</span></div>' +
      '<div class="rtd-papierregel"><strong>Eigenaar</strong><span>' + veilig(doc.door || 'Niet bekend') + '</span></div></article>' +
      '<div class="rtd-context"><div class="rtd-contextblok"><span>Ontstaan uit</span><b>' + veilig(contextBron()) + '</b></div>' +
      '<div class="rtd-contextblok"><span>Laatste wijziging</span><b>' + veilig((doc.werkstroom && doc.werkstroom.laatstDoor) || doc.door || 'Niet bekend') + ' · ' + veilig(datum(doc.gewijzigd)) + '</b></div>' +
      '<div class="rtd-contextblok"><span>Versies</span><b>' + veilig(String((versies || []).length)) + ' eerdere ' + ((versies || []).length === 1 ? 'versie' : 'versies') + ' bewaard</b></div>' +
      '<div class="rtd-contextblok"><span>Beslisroute</span><b>' + veilig(faseUitleg(fase)) + '</b></div></div>' +
      '<div class="rtd-dossieracties"><button type="button" data-rtd-versies="' + veilig(doc.id) + '">Bekijk versies</button><button type="button" data-rtd-open="besluit">Naar besluitklaar &rarr;</button></div>';
  }
  async function open(root, office, kop) {
    root.querySelector('#rtdDossier').innerHTML = '<div class="rtd-leeg">Het dossier wordt opgebouwd uit de echte documentgegevens…</div>';
    try {
      var uit = await Promise.all([office.api('open', { id: kop.id }), office.api('versies', { id: kop.id })]);
      if (uit[0].status !== 200) throw new Error(uit[0].body.error || 'Dit dossier kon niet worden geopend.');
      actueel = { kop: kop, doc: uit[0].body, versies: (uit[1].body && uit[1].body.versies) || [] };
      teken(root, actueel.doc, actueel.versies);
      return actueel;
    } catch (e) {
      root.querySelector('#rtdDossier').innerHTML = '<div class="rtd-leeg"><h2>Dossier niet beschikbaar.</h2><p>' + veilig(e.message || e) + '</p></div>';
      return null;
    }
  }
  w.RTGDocsDossier = Object.freeze({ open: open, actueel: function () { return actueel; }, faseNaam: faseNaam, veilig: veilig });
}(window, document));
