/* Alleen de leesbare vorm. Elk bedrag en iedere overeenkomst komt van de
   servermomentopname; dit scherm heeft geen eigen prijslijst. Geen nieuwe CSS. */
(function (w) {
  'use strict';
  var esc = function (x) { return w.Geld.esc(x); };
  var euro = function (x) { return Number.isSafeInteger(x) ? w.Geld.euro(x) : 'onbekend'; };
  function rij(k, v) { return '<p class="lm-rij"><span class="stil">' + esc(k) + '</span> <b>' + esc(v) + '</b></p>'; }
  function checkoutHref(raw) {
    try {
      var u = new URL(raw, w.location.origin);
      return raw && !u.username && !u.password && (u.protocol === 'https:' ||
        u.protocol === 'http:' && u.origin === w.location.origin) ? u.href : null;
    } catch (_) { return null; }
  }
  function formulier(intake) {
    return '<h2>Een persoonlijk aanbod</h2><div class="kaart">' +
      '<p>Gratis blijven kan. Een aanbod opvragen verandert de bestaande afspraak niet. RTG verdient aan een betaald abonnement.</p>' +
      '<form id="lmAanbodVraag"><p><label for="lmAanbodPas">Abonnement</label> ' +
      '<select id="lmAanbodPas" name="pas"><option value="rtg">RTG Pass</option><option value="business-lite">Business Lite · één zaak</option>' +
      '<option value="business">Business · hele organisatie</option><option value="lifestyle">Lifestyle</option></select></p>' +
      '<p><label for="lmAanbodFrequentie">Betalen</label> <select id="lmAanbodFrequentie" name="frequentie">' +
      '<option value="maand">Per maand</option><option value="jaar">Jaarvooruitbetaling</option></select></p>' +
      '<p><label for="lmAanbodAanvraag">Eigen aanvraagreferentie (voor RTG niet nodig)</label> ' +
      '<input id="lmAanbodAanvraag" name="aanmeldingId" type="text" maxlength="100" aria-describedby="lmAanbodAanvraagUitleg"></p>' +
      '<p class="stil" id="lmAanbodAanvraagUitleg">Business Lite vereist de referentie van uw eigen bedrijfsaanvraag. ' +
      'Business geldt voor de hele bestaande organisatie die RTG bij de menselijke toelating vastlegt; een keuze hier koppelt geen organisatie. Lifestyle vereist ook menselijke toelating. Voor een nieuwe Lite-aanvraag kunt u hieronder uw bedrijfsgegevens indienen.</p>' +
      '<button class="knop" type="submit">Persoonlijk aanbod lezen</button></form>' +
      '<p class="stil">Een voorstel kan alleen worden ingetrokken vóór enige betaalstart. Is er al een betalingsopdracht, laat die eerst herstellen; begin niet opnieuw met een andere sleutel.</p></div>' +
      (w.RTGGeldAbonnementIntake ? w.RTGGeldAbonnementIntake.html(intake && intake.bedrijfstypes) : '') +
      '<div id="lmAutoMelding" role="status" aria-live="polite"></div><div id="lmAutoContracten"></div>' +
      '<p><button class="knop" type="button" data-abo-actie="ververs">Stand opnieuw ophalen</button></p>';
  }
  function contract(c, n) {
    var a = c.aanbod, p = a.prijs, v = a.verrekening, key = 'lmAuto' + n;
    var verlopen = a.geldigTot && Date.parse(a.geldigTot) < Date.now();
    var betaling = c.betaalstand || {}, link = checkoutHref(betaling.checkoutUrl);
    var html = '<section class="kaart h-mt60" data-abo-contract="' + esc(c.id) + '"><h2>' + esc(a.pas) + '</h2>' +
      rij('Overeenkomst', c.id) + rij('Stand', c.status) +
      rij('Reikwijdte van deze overeenkomst', a.scope.soort + (a.scope.code ? ' ' + a.scope.code : '')) +
      rij('Maandprijs inclusief btw', euro(p.maand.brutoCenten)) +
      rij('Maandprijs exclusief btw', euro(p.maand.nettoCenten)) +
      rij('Btw per maand', euro(p.maand.btwCenten)) +
      rij(a.frequentie === 'jaar' ? 'Jaarvooruitbetaling inclusief btw' : 'Termijn inclusief btw', euro(p.termijn.brutoCenten)) +
      rij('Verrekening op eerste termijn', euro(v.creditCenten)) + rij('Eerste betaling', euro(v.teBetalenCenten)) +
      (v.overCenten ? rij('Credit voor volgende termijnen', euro(v.overCenten)) : '') +
      '<p>De eerste verbintenis duurt 12 maanden vanaf activering. Daarna maandelijks opzegbaar. ' +
      'Ondertekenen alleen activeert geen pas; daarvoor moet ook de betalingsverplichting zijn voldaan.</p>' +
      (a.voorwaarden.jaarVervolg === 'maand' ? '<p>Na het eerste vooruitbetaalde jaar volgt maandbetaling tegen de vastgelegde maandprijs. Opnieuw jaarvooruitbetaling vereist een nieuwe keuze.</p>' : '') +
      (a.voorwaarden.laatsteMaandNaarRato === true ? '<p>Een laatste gedeeltelijke maand wordt naar rato tot de einddatum berekend. Eerder gestarte betaalopdrachten blijven ongewijzigd.</p>' : '') +
      (a.geldigTot ? '<p>Deze verrekenofferte verlangt betaalbevestiging uiterlijk ' + esc(a.geldigTot) +
        '. Een late of onzekere betaling vraagt herstel, niet nog een betaling.</p>' : '') +
      '<p><label for="' + key + 'Tekst">Volledige versiegebonden overeenkomst</label></p>' +
      '<textarea id="' + key + 'Tekst" readonly rows="12" wrap="soft">' + esc(a.tekst) + '</textarea>';
    if (c.status === 'AANGEBODEN' && !verlopen) {
      html += '<form data-abo-teken="' + esc(c.id) + '"><p><label for="' + key + 'Naam">Volledige naam</label> ' +
        '<input id="' + key + 'Naam" name="naam" autocomplete="name" required minlength="2" maxlength="80"></p>' +
        '<p><label><input type="checkbox" name="akkoord" required> Ik heb deze individuele overeenkomst gelezen en ga ermee akkoord.</label></p>' +
        '<p><label><input type="checkbox" name="mandaat" required> ' + esc(a.voorwaarden.mandaatTekst) + '</label></p>' +
        '<button class="knop hoofd" type="submit">Overeenkomst ondertekenen</button></form>';
    } else if (c.status === 'AANGEBODEN') html += '<p>De verrekenofferte is verlopen. Laat RTG het aanbod controleren; er zijn geen nieuwe rechten toegekend.</p>';
    if (c.ondertekening) html += rij('Ondertekening vastgelegd op', c.ondertekening.at);
    if (betaling.status) html += rij('Betaalstand', betaling.status);
    if (typeof betaling.error === 'string') html += '<p>' + esc(betaling.error) + '</p>';
    if (link) html += '<p><a class="knop" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Open beveiligde betaling</a></p>';
    if (c.status === 'GEACCEPTEERD') html += '<p><button class="knop hoofd" type="button" data-abo-actie="betalen" data-abo-id="' +
      esc(c.id) + '">Betaling starten of hervatten</button></p>';
    if (['AANGEBODEN', 'GEACCEPTEERD'].indexOf(c.status) >= 0) html += '<p><button class="knop" type="button" data-abo-actie="intrekken" data-abo-id="' +
      esc(c.id) + '">Voorstel intrekken als betaling nog niet gestart is</button></p>';
    if (c.ondertekening && c.status !== 'GEEINDIGD') html += '<p><button class="knop" type="button" data-abo-actie="herstel" data-abo-id="' +
      esc(c.id) + '">Betaalstand controleren en herstellen</button></p>';
    if (['ACTIEF', 'VERLENGBAAR'].indexOf(c.status) >= 0) html += '<p><button class="knop" type="button" data-abo-actie="opzeggen" data-abo-id="' +
      esc(c.id) + '">Deze overeenkomst opzeggen</button></p>';
    if (c.herstel && typeof c.herstel.tekst === 'string') {
      html += '<section aria-label="Betaalherstel"><h3>Mededeling over betaalherstel</h3><p>' + esc(c.herstel.tekst) + '</p>';
      if (c.herstel.herstelTot) html += rij('Herstel uiterlijk', c.herstel.herstelTot);
      if (c.herstel.aankondiging && c.herstel.aankondiging.kanaal === 'rtg-inbox')
        html += '<p class="stil">Deze mededeling is beschikbaar in uw persoonlijke RTG-inbox.</p>';
      html += '</section>';
    }
    if (c.herstelstand && typeof c.herstelstand.reden === 'string') html += '<p>' + esc(c.herstelstand.reden) + '</p>';
    return html + '</section>';
  }
  w.RTGGeldAbonnementBeeld = { formulier: formulier, contract: contract, checkoutHref: checkoutHref };
})(window);
