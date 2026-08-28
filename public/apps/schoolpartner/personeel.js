/* Eigen werkruimte voor alle schoolrollen buiten de directie en de klasleraar.
   De rechten komen van /school/mijn-rechten; het scherm leidt daar alleen een
   leesbare kaart uit af. Zelfzaken (dossier, uren, ziek/verlof) zijn voor elke
   actieve medewerker beschikbaar en raken nooit het dossier van een ander. */
(function () {
  'use strict';
  var UITLEG={
    leerling:'Leerlingbasis', 'leerling.schrijf':'In- en uitschrijven', document:'Documenten',
    aanwezigheid:'Aanwezigheid en verlof', bezoeker:'Bezoekers', zorg:'Zorgdossiers',
    'zorg.signaal':'Zorgsignalen', 'zorg.gedeeld':'Gedeelde begeleiding', incident:'Incidenten',
    'incident.vertrouwelijk':'Vertrouwelijke incidenten', financieel:'Financiën beheren',
    'financieel.lees':'Financiën lezen', hr:'Personeelszaken', rooster:'Roosters', analyse:'Schoolbeeld',
    veiligheid:'Gebouw en veiligheid', koppeling:'Koppelingen', journaal:'Inzagejournaal', bestuur:'Bestuur'
  };
  function bind(api, S, esc, meld) {
    var sleutel=function (extra) { var b={ schoolCode:S.code, personeelToken:S.token }, k; for(k in (extra||{})) b[k]=extra[k]; return b; };
    Promise.all([api('/school/mijn-rechten', sleutel()), api('/school/hr/mijn', sleutel()), api('/school/hr/uren', sleutel())])
      .then(function (r) {
        var recht=r[0].body, hr=r[1].body, uren=r[2].body, wortel=document.getElementById('pWerk');
        if (recht.error) { wortel.innerHTML='<div class="kaart"><p class="stil">' + esc(recht.error) + '</p></div>'; return; }
        document.getElementById('pWelkom').textContent='Welkom, ' + recht.naam + '.';
        document.getElementById('pRollen').innerHTML=(recht.rollen || []).map(function (x) { return '<span class="enterprise-chip"><i></i>' + esc(x) + '</span>'; }).join('');
        var d=hr.dossier || {}, c=d.contract || {}, bevoegd=d.bevoegdheden || [], rechten=recht.rechten || [];
        wortel.innerHTML='<div class="kpis"><div class="kpi"><b>' + (recht.rollen || []).length + '</b><span>rollen</span></div>' +
          '<div class="kpi"><b>' + rechten.length + '</b><span>bevoegdheden</span></div><div class="kpi"><b>' + (uren.totaal || 0) + '</b><span>uren deze maand</span></div></div>' +
          '<div class="enterprise-start"><div class="kaart"><div class="kop">Mijn toegang</div>' +
          (rechten.length ? rechten.map(function (x) { return '<span class="tag aan ruim">' + esc(UITLEG[x] || x) + '</span>'; }).join('') : '<p class="stil">Geen inhoudelijke bevoegdheden toegewezen.</p>') +
          '<p class="stil boven6">Mist iets? Alleen de directie kan een rol toevoegen.</p></div>' +
          '<div class="kaart"><div class="kop">Mijn personeelsdossier</div>' +
          '<div class="item"><span>Functie</span><span class="stil">' + esc(c.functie || 'Nog niet ingevuld') + '</span></div>' +
          '<div class="item"><span>Contract</span><span class="stil">' + esc(c.soort || 'Nog niet ingevuld') + (c.uren ? ' · ' + c.uren + ' uur' : '') + '</span></div>' +
          '<div class="item"><span>Bevoegdheden</span><span class="stil">' + (bevoegd.length ? bevoegd.map(function (x) { return esc(x.wat); }).join(', ') : 'Nog niets vastgelegd') + '</span></div></div></div>' +
          '<div class="deel">Mijn werkzaken</div><div class="enterprise-start"><div class="kaart"><div class="kop">Uren registreren</div>' +
          '<div class="rij"><input class="veld" id="puDatum" type="date" aria-label="Datum"><input class="veld" id="puUren" type="number" min="0.25" max="24" step="0.25" placeholder="Uren" aria-label="Uren">' +
          '<input class="veld" id="puWat" maxlength="80" placeholder="Werkzaamheden" aria-label="Werkzaamheden"><button class="knop p" id="puBewaar" type="button">Bewaar</button></div></div>' +
          '<div class="kaart"><div class="kop">Afwezigheid</div><p class="stil">Bij ziekmelden wordt bewust geen reden of diagnose gevraagd.</p>' +
          '<div class="rij"><button class="knop" id="puZiek" type="button">Ziekmelden</button><button class="knop" id="puBeter" type="button">Betermelden</button>' +
          '<button class="knop" id="puVerlof" type="button">Verlof aanvragen</button></div></div></div>';
        document.getElementById('puDatum').value=new Date().toISOString().slice(0,10);
        document.getElementById('puBewaar').addEventListener('click', function () {
          api('/school/hr/uren', sleutel({ datum:document.getElementById('puDatum').value, uren:document.getElementById('puUren').value, wat:document.getElementById('puWat').value }))
            .then(function (x) { meld(x.body.error || 'Uren bewaard.'); });
        });
        document.getElementById('puZiek').addEventListener('click', function () { api('/school/hr/afwezig', sleutel({ soort:'ziek' })).then(function (x) { meld(x.body.error || 'Ziekmelding vastgelegd zonder medische gegevens.'); }); });
        document.getElementById('puBeter').addEventListener('click', function () { api('/school/hr/afwezig', sleutel({ soort:'beter' })).then(function (x) { meld(x.body.error || 'Betermelding vastgelegd.'); }); });
        document.getElementById('puVerlof').addEventListener('click', function () { api('/school/hr/afwezig', sleutel({ soort:'verlof' })).then(function (x) { meld(x.body.error || 'Verlofaanvraag ingediend.'); }); });
      });
  }
  window.RTGSchoolPersoneel={ bind:bind };
})();
