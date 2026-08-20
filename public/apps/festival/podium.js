/* RTG Festival, het scherm: HET BLAD "PODIUM".

   DIT IS HET SCHERM VAN DE STAGE MANAGER, en die kent zijn schema. Wat hij niet
   uit zijn hoofd weet is hoeveel tijd hij nog heeft en wat er nog niet staat --
   dus dat is wat hier groot staat: wie er nu op is, wie erna komt, hoeveel
   minuten daartussen zitten, en welke riderpunten open staan.

   AFVINKEN KAN HIER, EN VERDER NIETS. Een riderpunt is af of niet, en wie het
   neerzet is niet de manager (routes/festival/artiest.js). Zijn naam komt uit
   de sessie, dus er is geen veld waarin hij zichzelf invult.

   ER WORDT NIETS AFGELAST EN NIETS OMGEBOEKT. Het schema veranderen gebeurt op
   Inrichten en door een manager; deze laag stelt vast, ingrijpen doet de mens
   (FESTIVAL.md par. 4). Wat er niet klopt staat bovendien OOK op Beeld, want
   een stage manager en een veiligheidscoordinator horen naar hetzelfde scherm
   te kijken -- daarom staat hier geen tweede uitzonderingenlijst. */
(function () {
  'use strict';
  var F = window.RTGFestival;
  if (!F) return;

  function regel(sig, kop, rechts) {
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
  }

  function zin(p) {
    if (!p.nu && !p.straks) return 'Niets geprogrammeerd.';
    if (!p.nu) return 'Leeg. Straks ' + p.straks.artiest + ' (' + p.straks.van + ').';
    return p.nu.artiest + ' tot ' + p.nu.tot
      + (p.nu.stand === 'bevestigd' ? '' : ' · nog een ' + p.nu.stand);
  }

  /* De tijd tot de volgende set MINUS de ombouwtijd: dat is het getal waarop
     gehandeld wordt. Staat de ombouw langer dan er tijd is, dan staat het er
     als tekort en niet als een kleiner positief getal. */
  function ruimte(p) {
    if (p.overTot === null || p.overTot === undefined) return '';
    var over = p.overTot - (p.changeover || 0);
    if (!p.changeover) return 'over ' + p.overTot + ' min';
    return over < 0
      ? p.overTot + ' min tot de volgende, ' + p.changeover + ' min ombouw: ' + (-over) + ' te kort'
      : p.overTot + ' min tot de volgende, ' + over + ' min speling';
  }

  function riderRegel(b, item) {
    var knop = document.createElement('button');
    knop.type = 'button';
    knop.className = 'fp-regel';
    knop.setAttribute('data-sig', 'aandacht');
    var s = document.createElement('span');
    s.textContent = item.wat + ' · ' + b.artiest;
    knop.appendChild(s);
    var r = document.createElement('span');
    r.className = 'rek';
    r.textContent = 'Vink af';
    knop.appendChild(r);
    knop.addEventListener('click', function () {
      knop.disabled = true;
      F.api('/api/festival/rider/vink', { festival: F.staat.fid, editie: F.staat.eid,
        boeking: b.id, item: item.id }).then(function (res) {
        var body = res.body || {};
        if (body.error) { r.textContent = body.error; knop.disabled = false; return; }
        r.textContent = 'af · ' + (body.item.door || '');
        knop.removeAttribute('data-sig');
      }).catch(function () { r.textContent = 'Geen verbinding'; knop.disabled = false; });
    });
    return knop;
  }

  F.opBlad('podium', function () {
    var kop = document.getElementById('podiumKop');
    var lijst = document.getElementById('podiumLijst');
    var rider = document.getElementById('podiumRider');
    var stil = document.getElementById('podiumStil');
    lijst.textContent = '';
    rider.textContent = '';
    stil.textContent = '';

    if (!F.staat.dagId) {
      kop.textContent = 'Er loopt nu geen festivaldag.';
      stil.textContent = 'Buiten de openingstijden staat er niets op. Zodra de dag loopt, begint dit beeld vanzelf.';
      return;
    }

    F.api('/api/festival/podiumbeeld', { festival: F.staat.fid, editie: F.staat.eid })
      .then(function (res) {
        var b = res.body || {};
        if (b.error) { kop.textContent = b.error; return; }
        var podia = b.podia || [];
        if (!podia.length) {
          kop.textContent = 'Nog geen podium op dit terrein.';
          stil.textContent = 'Een podium is een plek van de soort podium; die zet u op Inrichten.';
          return;
        }
        var bezet = podia.filter(function (p) { return p.nu; }).length;
        kop.textContent = bezet + ' van ' + podia.length + (podia.length === 1 ? ' podium' : ' podia') + ' bezet';
        podia.forEach(function (p) {
          lijst.appendChild(regel(p.nu && p.nu.stand !== 'bevestigd' ? 'kritiek' : null,
            p.naam + ' · ' + zin(p), ruimte(p)));
        });
        return F.api('/api/festival/boekingen', { festival: F.staat.fid, editie: F.staat.eid,
          dag: F.staat.dagId });
      })
      .then(function (res) {
        if (!res) return;
        var boekingen = ((res.body || {}).boekingen || [])
          .filter(function (x) { return x.stand !== 'afgezegd'; });
        var open = 0;
        boekingen.forEach(function (b) {
          (b.rider || []).forEach(function (item) {
            if (item.klaar) return;
            open++;
            rider.appendChild(riderRegel(b, item));
          });
        });
        stil.textContent = open
          ? open + (open === 1 ? ' riderpunt staat open.' : ' riderpunten staan open.')
          : 'Alle riderpunten van vandaag staan af.';
      })
      .catch(function () { kop.textContent = 'Geen verbinding.'; });
  });
})();
