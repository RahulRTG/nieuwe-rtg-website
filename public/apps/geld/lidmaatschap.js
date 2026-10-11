/* Stand Lidmaatschap in RTG Geld: wat het lid met RTG heeft afgesproken, en
   zelf opzeggen.

   DE ROUTES STONDEN AL, HET SCHERM NIET (AFSPRAAK.md par. 14.1: "Geen scherm.
   De routes staan; de plek waar het lid ze ziet wacht op de naamkwestie van par.
   11"). Die naamkwestie is dat "Mijn afspraken" in de leden-app al BOEKINGEN
   zijn. Deze stand heet daarom Lidmaatschap -- het woord dat de server zelf al
   gebruikt (`bediening-recht.js`: "Eigen lidmaatschap") -- en niet Afspraken.

   DRIE ROUTES, ALLE DRIE OP DE SESSIE: /api/mijn/abonnement, /opzegvoorbeeld en
   /opzeggen. Er is met opzet geen parameter om het lidmaatschap van iemand anders
   op te vragen, en dit scherm stuurt er ook geen mee.

   GEEN DARK PATTERN, en dat volgt de server: eerst lezen wat opzeggen doet (het
   voorbeeld verandert niets), dan EEN bevestiging. Wat er BLIJFT staat even groot
   als wat er weggaat. Verlengen staat er met opzet niet: dat is het enige moment
   waarop de afgesproken prijs mag veranderen, en een lid zet zijn eigen prijs
   niet. Terugdraaien ook niet: de standentabel kent geen weg terug uit
   OPZEGGEND, en dat zegt het scherm in plaats van een knop te tonen die niets
   kan. */
(function (w, d) {
  'use strict';
  var V = w.RTGGeld = w.RTGGeld || { standen: [] };
  var $ = function (s) { return d.querySelector(s); };
  var ABO = null;

  function esc(s) { return w.Geld.esc(s); }
  function bedrag(euro) { return euro == null ? null : w.Geld.euro(Math.round(Number(euro) * 100)); }
  function dag(iso) { return iso ? w.Geld.datum(iso) : null; }
  var VERLENGING = {
    stilzwijgend: 'Verlengt stilzwijgend na de minimumtermijn.',
    opzegbaar: 'Loopt na de minimumtermijn door en is dan maandelijks opzegbaar.',
    geen: 'Stopt aan het eind van de afgesproken termijn.'
  };

  function rij(label, waarde) {
    return '<p class="lm-rij"><span class="stil">' + esc(label) + '</span> <b>' + waarde + '</b></p>';
  }

  /* Geen afspraak is GEEN fout: wie zijn pas langs een andere weg kreeg, heeft
     er geen. De server zegt dat zelf, met de weg erbij; hier staat zijn zin. */
  function geenHtml(reden) {
    return '<div class="kaart"><p>' + esc(reden || 'Er is geen lidmaatschapsafspraak gevonden.') + '</p></div>';
  }

  function beeldHtml(a) {
    var maand = bedrag(a.maandBedrag);
    var volg = a.volgendeTermijn;
    return '<div class="kaart" id="lmBeeld">' +
        '<p class="lm-pas"><b>' + esc(a.pasNaam) + '</b></p>' +
        '<p id="lmStand" data-stand="' + esc(a.stand) + '">' + esc(a.standTekst) + '</p>' +
        rij('Per maand', maand ? esc(maand) : 'geen bedrag afgesproken') +
        (a.prijsVastTot ? rij('Prijs vast tot', esc(dag(a.prijsVastTot))) : '') +
        rij('Begonnen op', esc(dag(a.begonnenOp) || 'onbekend')) +
        rij('Minimumtermijn', esc(a.minimumMaanden) + ' maanden' +
          (a.eindeVerbintenis ? ', tot ' + esc(dag(a.eindeVerbintenis)) : '')) +
        rij('Opzegtermijn', esc(a.opzegMaanden) + (a.opzegMaanden === 1 ? ' maand' : ' maanden')) +
        (a.eindigtOp ? rij('Loopt tot', esc(dag(a.eindigtOp))) : '') +
        (volg ? rij('Volgende termijn', esc(dag(volg.vervalt)) + (volg.bedrag != null ? ', ' + esc(bedrag(volg.bedrag)) : '')) : '') +
        rij('Termijnen nog te gaan', esc(a.termijnenTeGaan)) +
        '<p class="stil h-mt40">' + esc(VERLENGING[a.verlenging] || '') + '</p>' +
      '</div>' +
      (a.kan && a.kan.opzeggen
        ? '<h2>Opzeggen</h2><div class="kaart" id="lmOpzeg">' +
            '<p class="stil">Lees eerst wat opzeggen doet. Dat verandert nog niets.</p>' +
            '<div class="h-mt60"><button class="knop" id="lmVoorbeeld" type="button">Wat gebeurt er als ik opzeg?</button></div>' +
            '<div id="lmGevolg"></div>' +
          '</div>'
        : '');
  }

  function gevolgHtml(v) {
    if (v.alOpgezegd) return '<p class="h-mt60">Dit lidmaatschap is al opgezegd en loopt tot ' + esc(v.eindigtOpTekst) + '.</p>';
    var blijft = (v.blijft || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    return '<div class="h-mt60" id="lmGevolgTekst">' +
        rij('Het lidmaatschap loopt tot', esc(v.eindigtOpTekst)) +
        rij('Termijnen die nog vallen', esc(v.nogTeBetalen) +
          (v.nogTeBetalen ? ' (samen ' + esc(bedrag(v.nogTeBetalenBedrag)) + ')' : '')) +
        rij('Termijnen die vervallen', esc(v.vervallenTermijnen)) +
        '<h2>Wat blijft</h2><ul>' + blijft + '</ul>' +
        '<p class="stil">Een opzegging is niet terug te draaien. Wie later terugkomt, sluit een nieuw lidmaatschap af.</p>' +
        '<div class="h-mt60"><button class="knop hoofd" id="lmBevestig" type="button">Opzeggen per ' +
          esc(v.eindigtOpTekst) + '</button> <button class="knop" id="lmLaat" type="button">Niet opzeggen</button></div>' +
      '</div>';
  }

  async function laad() {
    var vak = $('#lmHoofd');
    if (!vak) return;
    try {
      var r = await w.Geld.api('/api/mijn/abonnement');
      ABO = r.abonnement || null;
      vak.innerHTML = ABO ? beeldHtml(ABO) : geenHtml(r.reden);
    } catch (e) {
      vak.innerHTML = RTGLeeg.html(RTGLeeg.vanFout(e, { ey: 'Lidmaatschap', titel: 'Het lidmaatschap kon niet laden.' }));
    }
  }

  async function voorbeeld() {
    var vak = $('#lmGevolg');
    vak.innerHTML = '<p class="stil h-mt40">Laden...</p>';
    try { vak.innerHTML = gevolgHtml(await w.Geld.api('/api/mijn/abonnement/opzegvoorbeeld')); }
    catch (e) { vak.innerHTML = '<p class="h-mt40">' + esc(e.message) + '</p>'; }
  }

  /* EEN bevestiging. De knop gaat uit zodra hij is ingedrukt: een tweede tik is
     op de server al onschadelijk (idempotent op stand), maar hij hoeft ook niet
     te vertrekken. Mislukt het, dan komt de knop terug met de reden erbij. */
  async function bevestig(knop) {
    knop.disabled = true;
    try {
      var r = await w.Geld.api('/api/mijn/abonnement/opzeggen');
      await laad();
      var uit = $('#lmUitslag');
      if (uit) uit.innerHTML = '<div class="kaart"><p>Opgezegd. Het lidmaatschap loopt tot ' + esc(r.eindigtOpTekst) + '.</p>' +
        (r.terug ? '<p class="stil">' + esc(r.terug) + '</p>' : '') + '</div>';
      w.Geld.melding('Uw opzegging is vastgelegd.');
    } catch (e) {
      knop.disabled = false;
      w.Geld.melding(e.message);
    }
  }

  function klik(e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'lmVoorbeeld') voorbeeld();
    else if (b.id === 'lmBevestig') bevestig(b);
    else if (b.id === 'lmLaat') $('#lmGevolg').innerHTML = '';
  }

  /* De stijl via createElement en niet als <style> in de html-string: zie
     ./rtgcodeb.js -- een blok uit innerHTML krijgt geen CSP-nonce. */
  function stijl() {
    if (d.getElementById('lmStijl')) return;
    var st = d.createElement('style');
    st.id = 'lmStijl';
    st.textContent = '.lm-rij{margin:.35rem 0;display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap}' +
      '.lm-pas{margin:0 0 .4rem}';
    d.head.appendChild(st);
  }

  V.standen.push({
    id: 'lidmaatschap',
    naam: 'Lidmaatschap',
    uitleg: 'Wat u met RTG heeft afgesproken: uw pas, het bedrag, de termijnen, en zelf opzeggen.',
    html:
      '<div id="lmWrap">' +
        '<div id="lmUitslag"></div>' +
        '<div id="lmHoofd"><p class="stil">Laden...</p></div>' +
        '<h2>Wat hier niet kan</h2>' +
        '<div class="kaart"><p class="stil">Verlengen tegen een nieuwe prijs is een afspraak met RTG en geen knop: ' +
          'de afgesproken prijs verandert alleen bij een verlenging die het kantoor met u maakt.</p></div>' +
      '</div>',
    start: function () {
      ABO = null;
      stijl();
      $('#lmWrap').addEventListener('click', klik);
      laad();
    }
  });
})(window, document);
