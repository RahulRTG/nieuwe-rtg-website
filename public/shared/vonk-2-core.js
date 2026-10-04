/* Vonk 2.0 presentatiemodel.

   Deze laag krijgt uitsluitend bestaande Connection-projecties. Hij bedenkt
   geen matches, redenen of capabilities en vult een dag nooit kunstmatig aan.
   De kleine pure functies zijn zowel in de browser als in de producttoetsen
   bruikbaar. */
(function (g, fabriek) {
  'use strict';
  var api = fabriek();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g) g.RTGVonkExperience = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function tekst(v) { return typeof v === 'string' ? v.trim() : ''; }
  function lijst(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }

  function daggroet(uur) {
    var h = Number.isFinite(Number(uur)) ? Number(uur) : new Date().getHours();
    if (h < 6) return 'Goedenacht';
    if (h < 12) return 'Goedemorgen';
    if (h < 18) return 'Goedemiddag';
    return 'Goedenavond';
  }

  function initialen(codenaam) {
    var delen = tekst(codenaam).split(/\s+/).filter(Boolean).slice(0, 2);
    return delen.map(function (deel) { return deel.charAt(0).toUpperCase(); }).join('') || 'V';
  }

  function redenen(waarom) {
    var bron = waarom && typeof waarom === 'object' ? waarom : {};
    /* Geen verklaringen afleiden uit profielwaarden: de server heeft al
       bepaald welke redenen disclosure-veilig zijn. */
    return { passend: lijst(bron.ja).map(tekst).filter(Boolean), open: lijst(bron.open).map(tekst).filter(Boolean) };
  }

  function kandidaat(row) {
    var p = row && typeof row === 'object' ? row : {};
    return Object.freeze({
      codenaam: tekst(p.codenaam), initialen: initialen(p.codenaam), leeftijd: p.leeftijd,
      stad: tekst(p.stad), over: tekst(p.over), interesses: lijst(p.interesses).map(tekst).filter(Boolean),
      gemeen: lijst(p.gemeen).map(tekst).filter(Boolean), kenmerken: p.kenmerken || {},
      betrouwbaarheid: p.betrouwbaarheid || null, waarom: redenen(p.waarom),
      media: lijst(p.media).map(function (m) { return {
        id:tekst(m && m.id), src:tekst(m && m.src), alt:tekst(m && m.alt) || 'Profielfoto',
        visibility:tekst(m && m.visibility), publicationState:tekst(m && m.publicationState),
        verificationState:tekst(m && m.verificationState), position:Number(m && m.position) || 0
      }; }).filter(function (m) { return m.id && /^\/api\/vonk\/profile-photo\/delivery\/[A-Za-z0-9_-]+$/.test(m.src); })
        .sort(function (a, b) { return a.position - b.position; })
    });
  }

  function hoofdfoto(profiel) {
    var media = lijst(profiel && profiel.media).filter(function (m) {
      return m && /^\/api\/vonk\/profile-photo\/delivery\/[A-Za-z0-9_-]+$/.test(tekst(m.src));
    });
    return media.sort(function (a, b) { return (Number(a.position) || 0) - (Number(b.position) || 0); })[0] || null;
  }

  function vandaag(rows) {
    var bron = lijst(rows);
    /* De kernel belooft maximaal zes. Ook bij een fout antwoord ontstaan nooit
       een zevende kaart of opvulprofielen in de client. */
    return Object.freeze({ aantal: Math.min(bron.length, 6), mensen: bron.slice(0, 6).map(kandidaat) });
  }

  function fase(match, datum) {
    var m = match && typeof match === 'object' ? match : {};
    var dag = tekst(datum) || new Date().toISOString().slice(0, 10);
    var afspraak = m.tafel && tekst(m.tafel.datum);
    if (m.status === 'reservering-aangevraagd') return 'RESERVATION_PENDING';
    if (m.status === 'reservering-onbekend') return 'RESERVATION_UNKNOWN';
    if (m.status === 'reservering-geweigerd') return 'RESERVATION_REJECTED';
    if (m.status === 'bevestigd') {
      var bewijs = m.reservering || {};
      if (bewijs.state !== 'CONFIRMED' || lijst(bewijs.missing).indexOf('provider-confirmation') !== -1)
        return 'RESERVATION_UNKNOWN';
      if (!afspraak || afspraak > dag) return 'DATE_CONFIRMED';
      if (afspraak === dag) return 'DATE_ACTIVE';
      return 'POST_DATE';
    }
    if (m.ikBetaalde || m.anderBetaalde) return 'MEET_AWAITING_BOTH';
    if (lijst(m.berichten).length) return 'CONVERSATION';
    return 'MATCH';
  }

  function gesprekstarters(match) {
    var m = match && typeof match === 'object' ? match : {};
    var kenmerken = Object.values(m.kenmerken || {}).filter(function (x) { return x && tekst(x.label); });
    var uit = kenmerken.slice(0, 2).map(function (x) { return 'Wat betekent ' + tekst(x.label).toLowerCase() + ' voor jou?'; });
    if (m.wanneer && m.wanneer.samen) uit.push('Waar kijk jij naar uit als we elkaar ontmoeten?');
    return uit.slice(0, 3);
  }

  function hashVoor(tab, kandidaatNaam) {
    var t = ['vandaag', 'matches', 'profiel'].includes(tab) ? tab : 'vandaag';
    return '#' + t + (kandidaatNaam ? '/profiel/' + encodeURIComponent(kandidaatNaam) : '');
  }

  function leesHash(hash) {
    var raw = String(hash || '').replace(/^#/, '');
    var delen = raw.split('/');
    var tab = ['vandaag', 'matches', 'profiel'].includes(delen[0]) ? delen[0] : 'vandaag';
    var kandidaatNaam = delen[1] === 'profiel' && delen[2] ? decodeURIComponent(delen.slice(2).join('/')) : '';
    return { tab:tab, kandidaat:kandidaatNaam };
  }

  return Object.freeze({ daggroet:daggroet, initialen:initialen, redenen:redenen, kandidaat:kandidaat, hoofdfoto:hoofdfoto,
    vandaag:vandaag, fase:fase, gesprekstarters:gesprekstarters, hashVoor:hashVoor, leesHash:leesHash });
}));
