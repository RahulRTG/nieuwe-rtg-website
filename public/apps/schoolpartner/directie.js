/* RTG School Partner (los script): de directie-cockpit op kantoren-niveau,
   met de onderwijsregels leidend. Signalen op organisatieniveau (rooster,
   huiswerkdruk, open ziekmeldingen, wachtend personeel), een schoolbrede
   mededeling en een drukklaar Schoolrapport -- zonder leerlingnamen,
   zonder cijfers, zonder ranglijsten en zonder omzet.
   Gebonden vanuit app.js aan het einde van directie(). */
(function () {
  'use strict';
  var laatste = null;

  function bind(api, S, esc, meld) {
    var w = document.getElementById('dPlus');
    if (!w) return;
    api('/school/directie/cockpit', { schoolCode: S.code, beheerToken: S.token }).then(function (r) {
      if (r.body.error) { w.innerHTML = ''; return; }
      laatste = r.body;
      teken(w, r.body, esc);
      knoppen(w, api, S, esc, meld);
    });
  }

  function teken(w, d, esc) {
    var h = '';
    if ((d.signalen || []).length) {
      h += '<div class="kaart"><div class="kop">Signalen</div>' + d.signalen.map(function (s) {
        return '<p class="stil" style="margin:.3rem 0;">&#9670; ' + esc(s.tekst) + '</p>';
      }).join('') + '</div>';
    }
    h += '<div class="kaart"><div class="kop">Rooster en werkdruk per klas</div>' +
      ((d.klassen || []).map(function (k) {
        return '<div class="item"><span>' + esc(k.naam) + '</span><span class="stil">' +
          k.roosterRegels + ' roosterregels · ' + k.huiswerkWeek + ' opdrachten deze week · ' +
          k.openAbsenties + ' open ziekmelding(en)</span></div>';
      }).join('') || '<p class="stil">Nog geen klassen.</p>') +
      '<p class="stil" style="margin-top:.5rem;">Alles op klasniveau; wie wat doet is aan de leraar en het gezin.</p></div>';
    h += '<div class="kaart"><div class="kop">Schoolbrede mededeling</div>' +
      '<p class="stil">Een keer schrijven, elke klas (en dus elk gezin) ziet hem, met de directie als afzender.</p>' +
      '<div class="rij"><input class="veld" id="dpTekst" maxlength="400" placeholder="Bijv. vrijdag studiedag: de school is dicht" aria-label="Mededeling" style="flex:3;">' +
      '<button class="knop p" id="dpStuur" type="button">Plaats in alle klassen</button></div>' +
      ((d.mededelingen || []).map(function (m) {
        return '<p class="stil" style="margin:.35rem 0 0;">' + esc((m.at || '').slice(0, 10)) + ' · ' + esc(m.tekst) + '</p>';
      }).join('')) + '</div>';
    h += '<div class="rij" style="margin-top:.6rem;"><button class="knop" id="dpRapport" type="button">Schoolrapport (print)</button></div>';
    /* Thuistaal per vak: een schoolbesluit en geen keuze van een leraar. Bij
       een taalvak zet de server "volledig" terug naar wat het vak toelaat en
       zegt dat ook -- daar is de taal zelf wat je meet. */
    h += '<div class="kaart"><div class="kop">Thuistaal per vak</div>' +
      '<p class="stil">Bij rekenen en de zaakvakken mag de thuistaal er volledig naast; bij een taalvak is de taal zelf wat u meet, dus blijft het bij de vraagstelling.</p>' +
      '<div class="rij"><input class="veld" id="dpTaalVak" maxlength="40" placeholder="Vak" aria-label="Vak">' +
      '<select class="veld" id="dpTaalStand" aria-label="Hoeveel steun"><option value="volledig">volledig</option>' +
      '<option value="instructie">alleen de vraagstelling</option><option value="geen">geen</option></select>' +
      '<button class="knop" id="dpTaal" type="button">Vastleggen</button></div></div>';
    w.innerHTML = h;
  }

  function knoppen(w, api, S, esc, meld) {
    w.querySelector('#dpStuur').addEventListener('click', function () {
      var t = w.querySelector('#dpTekst').value;
      api('/school/directie/mededeling', { schoolCode: S.code, beheerToken: S.token, tekst: t }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        meld('Geplaatst in ' + r.body.klassen + ' klas(sen).');
        bind(api, S, esc, meld);
      });
    });
    w.querySelector('#dpRapport').addEventListener('click', function () { rapport(esc); });
    /* Het taalbeleid per vak. Hier en niet bij de leraar, want dit is een
       schoolbesluit -- en de server zet een taalvak terug naar wat het toelaat
       en meldt dat, in plaats van het stil bij te stellen. */
    w.querySelector('#dpTaal').addEventListener('click', function () {
      var vak = (w.querySelector('#dpTaalVak').value || '').trim().toLowerCase();
      var stand = w.querySelector('#dpTaalStand').value;
      if (!vak) return meld('Noem het vak.');
      var beleid = {}; beleid[vak] = stand;
      api('/school/taalbeleid/zet', { schoolCode: S.code, beheerToken: S.token, beleid: beleid })
        .then(function (r) {
          if (r.body.error) return meld(r.body.error);
          meld(r.body.uitleg);
        });
    });
  }

  /* Het drukklare Schoolrapport: de organisatie op een A4 -- personeel,
     klassen, rooster en werkdruk. Bewust zonder leerlingnamen of cijfers. */
  function rapport(esc) {
    var d = laatste; if (!d) return;
    var h = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(d.naam) + '</title></head>' +
      '<body style="font-family:Georgia,serif;color:#0C0C0B;max-width:46em;margin:2.5em auto;line-height:1.6;">' +
      '<div id="pwrap" style="text-align:right;"><button id="pbtn" type="button" style="padding:0.5rem 1rem;font-family:inherit;">Print / PDF</button></div>' +
      '<style>@media print { #pwrap { display:none; } }</style>' +
      '<h1 style="font-size:1.6rem;margin-bottom:0.2rem;">' + esc(d.naam) + '</h1>' +
      '<p style="color:#8A8680;margin-top:0;">Schoolrapport voor de directie · ' + new Date().toLocaleDateString('nl-NL') + '</p>' +
      '<h2 style="font-size:0.8rem;letter-spacing:0.14em;text-transform:uppercase;color:#7F1634;margin:1.6rem 0 0.5rem;">Kerncijfers</h2>' +
      '<p>' + d.kpi.klassen + ' klassen · ' + d.kpi.leerlingen + ' leerlingen · ' + d.kpi.actief + ' personeelsleden actief' +
      (d.kpi.wacht ? ' · ' + d.kpi.wacht + ' wachten op een besluit' : '') + '</p>' +
      '<h2 style="font-size:0.8rem;letter-spacing:0.14em;text-transform:uppercase;color:#7F1634;margin:1.6rem 0 0.5rem;">Per klas</h2>' +
      (d.klassen || []).map(function (k) {
        return '<div style="border-bottom:1px solid #DEDBD5;padding:0.25rem 0;"><b>' + esc(k.naam) + '</b> · ' +
          k.leerlingen + ' leerlingen · ' + k.roosterRegels + ' roosterregels · ' + k.huiswerkWeek + ' opdrachten deze week · ' +
          k.openAbsenties + ' open ziekmelding(en)</div>';
      }).join('') +
      ((d.signalen || []).length ? '<h2 style="font-size:0.8rem;letter-spacing:0.14em;text-transform:uppercase;color:#7F1634;margin:1.6rem 0 0.5rem;">Signalen</h2>' +
        d.signalen.map(function (s) { return '<div style="padding:0.2rem 0;">&#9670; ' + esc(s.tekst) + '</div>'; }).join('') : '') +
      '<p style="color:#8A8680;margin-top:2rem;font-size:0.85rem;">Alles op klasniveau: geen leerlingnamen, geen cijfers, geen ranglijsten. Zo hoort een schoolrapport voor de organisatie eruit te zien.</p>' +
      '<script>document.getElementById("pbtn").addEventListener("click",function(){window.print();});<\/script></body></html>';
    var b = new Blob([h], { type: 'text/html;charset=utf-8' });
    var u = URL.createObjectURL(b);
    window.open(u, '_blank');
    setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
  }

  window.RTGSchoolDirectie = { bind: bind };
})();
