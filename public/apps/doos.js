/* Het lokale statuspaneel van de Zaakdoos. Leest /api/doos/status en
   /api/doos/rapport (beide onbeschermd, alleen op het eigen net van de doos)
   en laat in een oogopslag zien hoe het kastje ervoor staat: online of lokaal,
   hoeveel er in het journaal wacht, hoe oud de kloon is, de rondreistijd, de
   randcache en welke cloud actief is. Ververst zichzelf elke vier seconden.
   Geen inline handlers (strenge nonce-CSP), geen afhankelijkheden. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var MODI = {
    cloud: { klasse: 'cloud', tekst: 'Online · doorgeefluik naar de cloud' },
    lokaal: { klasse: 'lokaal', tekst: 'Lokaal · de lijn is weg, de zaak werkt door' },
    uit: { klasse: 'uit', tekst: 'Geen doos · dit apparaat draait niet in doosmodus' }
  };
  function minuten(m) {
    if (m == null) return '-';
    if (m < 60) return m + ' min';
    var u = Math.floor(m / 60), r = m % 60;
    return u + ' u' + (r ? ' ' + r + ' min' : '');
  }
  function mb(bytes) { return (Number(bytes || 0) / 1048576).toFixed(1) + ' MB'; }

  function tegel(n, label, extra) {
    var d = document.createElement('div');
    d.className = 'tegel';
    var vn = document.createElement('div'); vn.className = 'n'; vn.textContent = n; d.appendChild(vn);
    var vl = document.createElement('div'); vl.className = 'l'; vl.textContent = label; d.appendChild(vl);
    if (extra) { var vx = document.createElement('div'); vx.className = 'x'; vx.textContent = extra; d.appendChild(vx); }
    return d;
  }
  function rij(k, v) {
    var r = document.createElement('div'); r.className = 'rij';
    var kk = document.createElement('span'); kk.className = 'k'; kk.textContent = k; r.appendChild(kk);
    var vv = document.createElement('span'); vv.className = 'v'; vv.textContent = v; r.appendChild(vv);
    return r;
  }

  function toon(st, rap) {
    if (!st || !st.doos) {
      $('paneel').hidden = true; $('leeg').hidden = false;
      $('sub').textContent = 'Geen doosmodus';
      return;
    }
    $('leeg').hidden = true; $('paneel').hidden = false;
    var m = MODI[st.modus] || MODI.uit;
    $('badge').className = 'badge ' + m.klasse;
    $('badgeTekst').textContent = m.tekst;
    $('sub').textContent = 'Bijgewerkt ' + new Date().toLocaleTimeString('nl-NL');

    var t = $('tegels'); t.textContent = '';
    t.appendChild(tegel(st.journaal, 'Journaal wacht', st.journaal ? 'nog naspelen bij herstel' : 'alles nagespeeld'));
    t.appendChild(tegel(st.kloonLeeftijdMin == null ? '-' : minuten(st.kloonLeeftijdMin), 'Kloon-leeftijd', 'verse kopie van de clouddata'));
    t.appendChild(tegel(rap ? (rap.rttGem + ' ms') : '-', 'Rondreistijd', 'naar de actieve cloud'));
    t.appendChild(tegel(st.kasStuks, 'Randcache', mb(st.kasBytes) + ' aan foto’s'));
    t.appendChild(tegel((st.actieveCloud + 1) + ' / ' + st.clouds, 'Cloud', st.clouds > 1 ? 'replica-failover aan' : 'enkele cloud'));
    if (rap) t.appendChild(tegel(rap.uitval, 'Uitval vandaag', minuten(rap.lokaalMin) + ' lokaal'));

    var d = $('dag'); d.textContent = '';
    if (rap) {
      d.appendChild(rij('Geslaagde pings', String(rap.pings)));
      d.appendChild(rij('Gemiddelde rondreistijd', rap.rttGem + ' ms'));
      d.appendChild(rij('Keren de lijn weg', String(rap.uitval)));
      d.appendChild(rij('Tijd in lokale modus', minuten(rap.lokaalMin)));
      d.appendChild(rij('Journaalregels nagespeeld', String(rap.nagespeeld)));
    } else {
      d.appendChild(rij('Dagrapport', 'nog geen gegevens'));
    }
  }

  var bezig = false;
  function haal() {
    if (bezig) return; bezig = true;
    Promise.all([
      fetch('/api/doos/status').then(function (r) { return r.json(); }).catch(function () { return null; }),
      fetch('/api/doos/rapport').then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (res) {
      toon(res[0], res[1]);
    }).catch(function () {
      $('sub').textContent = 'Geen verbinding met de doos';
    }).then(function () { bezig = false; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var knop = $('ververs');
    if (knop) knop.addEventListener('click', haal);
    haal();
    setInterval(haal, 4000);
  });
})();
