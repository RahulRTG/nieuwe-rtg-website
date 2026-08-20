/* RTG Festival, het scherm: DE BLADEN "BEELD" EN "TERREIN".

   BEELD IS UITZONDERINGSGESTUURD (ONTWERP.md par. 3, FESTIVAL.md par. 6). Er
   staat geen rij tegels met hoe het gaat. Er staat wat aandacht vraagt, met de
   tijd die er nog is -- en verder de twee getallen die zeggen of dat oordeel
   iets waard is: hoeveel plekken er gemeten zijn, en welke plekken een drempel
   hebben maar geen enkele meting.

   DAT LAATSTE IS HET EERLIJKSTE DEEL VAN DIT SCHERM. Een lege lijst kan twee
   dingen betekenen: er is niets aan de hand, of er komt niets binnen. Op een
   terrein met 65.000 mensen zijn die twee levensgevaarlijk om te verwarren, dus
   de ongemeten plekken staan er met zoveel woorden bij.

   ER WORDT HIER NIETS BESLOTEN EN NIETS UITGEVOERD. Deze bladen lezen; het
   werkwoord van deze wereld is voorspellen en klaarzetten, en ingrijpen doet de
   mens (FESTIVAL.md par. 4). Er staat dus ook geen knop "zone sluiten". */
(function () {
  'use strict';
  var F = window.RTGFestival;
  if (!F) return;

  var regel = function (sig, kop, rechts) {
    var d = document.createElement('div');
    d.className = 'fp-regel';
    if (sig) d.setAttribute('data-sig', sig);
    var s = document.createElement('span');
    s.textContent = kop;
    d.appendChild(s);
    if (rechts) {
      var r = document.createElement('span');
      r.className = 'rek';
      r.textContent = rechts;
      d.appendChild(r);
    }
    return d;
  };

  /* ---------- beeld ---------- */
  F.opBlad('beeld', function () {
    var kop = document.getElementById('beeldZin');
    var lijst = document.getElementById('beeldLijst');
    var onge = document.getElementById('beeldOngemeten');
    lijst.textContent = '';
    onge.textContent = '';

    if (!F.staat.dagId) {
      /* GEEN DAG OPEN, EN DUS GEEN BEELD -- en dat is een uitspraak van de
         SERVER (/api/festival/dag/nu) en niet van de klok van dit toestel. Een
         festivaldag loopt over middernacht heen; zelf rekenen zou een tweede
         waarheid zijn naast kern/festival/model.js. */
      kop.textContent = 'Er loopt nu geen festivaldag.';
      onge.textContent = 'Buiten de openingstijden telt dit scherm niets. Zodra de poorten opengaan, begint het beeld vanzelf.';
      return;
    }

    F.api('/api/festival/uitzonderingen', { festival: F.staat.fid, editie: F.staat.eid, dag: F.staat.dagId })
      .then(function (r) {
        var b = r.body || {};
        if (b.error) { kop.textContent = b.error; return; }
        var u = b.uitzonderingen || [];
        kop.textContent = u.length
          ? u.length + (u.length === 1 ? ' uitzondering' : ' uitzonderingen')
          : (b.rust ? 'Rustig.' : 'Niets binnen ' + b.horizon + ' minuten.');
        u.forEach(function (x) {
          lijst.appendChild(regel(x.ernst, x.zin, x.over ? 'over ' + x.over + ' min' : 'nu'));
        });
        var stukjes = [b.gemeten + (b.gemeten === 1 ? ' plek gemeten' : ' plekken gemeten')];
        if ((b.ongemeten || []).length) {
          var n = (b.ongemeten || []).length;
          stukjes.push(n + (n === 1 ? ' plek met een drempel' : ' plekken met een drempel')
            + ' worden niet gemeten: ' + b.ongemeten.map(function (x) { return x.naam; }).join(', '));
        }
        onge.textContent = stukjes.join(' · ') + '.';
        F.zetStand();
      })
      .catch(function () { kop.textContent = 'Geen verbinding.'; });
  });

  /* ---------- terrein ---------- */
  F.opBlad('terrein', function () {
    var lijst = document.getElementById('terreinLijst');
    if (!lijst) return;
    lijst.textContent = '';
    if (!F.staat.plekken.length) {
      lijst.appendChild(regel(null, 'Nog geen plekken in deze editie.', ''));
      return;
    }
    F.staat.plekken.forEach(function (p) {
      var rol = p.rol || {};
      var wat = rol.poort ? 'poort' : (rol.telt ? 'telt mee' : 'voorziening');
      var maat = p.capaciteit
        ? p.veiligeCapaciteit + ' veilig van ' + p.capaciteit
        : 'geen capaciteit';
      lijst.appendChild(regel(null, p.naam + ' · ' + p.soort + (p.besloten ? ' · besloten' : ''),
        wat + ' · ' + maat));
    });
  });
})();
