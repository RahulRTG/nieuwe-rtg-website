/* Een fout die niemand ziet, bestaat wel.

   Waarom dit bestaat. Een gebruiker meldde een zwart beginscherm. Drie keer is
   er een oorzaak aangewezen die achteraf niet de zijne was, want er was niets
   te zien: geen melding, geen spoor, en de console van een telefoon is voor de
   meeste mensen onbereikbaar. Raden kost dan dagen en levert reparaties op voor
   problemen die iemand anders had.

   Deze laag meldt een onafgevangen fout aan de server, zodat hij in hetzelfde
   logboek staat als de serverfouten. Niet meer dan dat.

   WAT ER WEL EN NIET MEEGAAT. Wel: de foutmelding, het bestand en de regel, het
   pad van de pagina, en of de gebruiker is ingelogd (ja of nee). Niet: wat
   iemand heeft getypt, geen adresregel met zoekwoorden erin, geen codenaam,
   geen token, geen naam. Een foutmelding kan zelf gegevens bevatten die iemand
   invulde, dus hij gaat afgekapt mee en nooit met het hele lichaam van een
   verzoek eraan.

   Hoogstens drie meldingen per paginabezoek: gaat er iets in een lus stuk, dan
   is de derde melding net zo bruikbaar als de driehonderdste, en de rest is
   alleen maar verkeer. */
(function () {
  'use strict';
  if (window.RTGFoutmelder) return;

  var GESTUURD = 0, MAX = 3;

  function meld(soort, melding, bestand, regel) {
    if (GESTUURD >= MAX) return;
    GESTUURD++;
    var lijf = {
      soort: String(soort || 'fout').slice(0, 20),
      melding: String(melding == null ? '' : melding).slice(0, 300),
      bestand: String(bestand || '').split('/').pop().slice(0, 80),
      regel: Number(regel) || 0,
      pad: String(location.pathname).slice(0, 120),
      ingelogd: !!(function () { try { return localStorage.getItem('rtg_member_token'); } catch (e) { return null; } })()
    };
    try {
      /* sendBeacon overleeft een pagina die meteen daarna sluit; dat is precies
         wat er gebeurt als iemand een kapot scherm wegklikt. Lukt dat niet, dan
         een gewone fetch die we bewust niet afvangen op falen: een melding die
         niet aankomt mag geen tweede fout maken. */
      var json = JSON.stringify(lijf);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/fout/client', new Blob([json], { type: 'application/json' }));
      } else {
        fetch('/api/fout/client', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: true })
          .catch(function () {});
      }
    } catch (e) { /* een melder die zelf omvalt helpt niemand */ }
  }

  window.addEventListener('error', function (e) {
    meld('fout', e && (e.message || 'onbekende fout'), e && e.filename, e && e.lineno);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    meld('belofte', r && (r.message || r), r && r.fileName, r && r.lineNumber);
  });

  /* EEN LEEG SCHERM IS OOK EEN STORING, ook al gooit er niets.

     Bij een gemeld zwart beginscherm kwam er geen enkele fout binnen, terwijl
     de app aantoonbaar draaide: tientallen geslaagde verzoeken, geen
     uitzondering. Dan is het geen crash maar opmaak -- en daar helpt een
     foutmelder niet tegen, want er valt niets te vangen.

     meetLeeg() stuurt daarom eenmalig de MATEN als het scherm leeg blijkt:
     hoe groot het venster is, hoe hoog de schil en de inhoud zijn, hoeveel
     tegels er staan en wat de rekeneenheid --e geworden is. Alleen getallen
     over de opmaak; geen tekst, geen naam, geen inhoud van het scherm. Met die
     tien getallen is een layoutstoring in een keer te plaatsen, zonder dat
     iemand een console hoeft te openen. */
  function meetLeeg(reden) {
    try {
      /* RTG Command bedekt de leden-shell bewust en verbergt #shell. De lege
         werktafel is een geldige landing met bank en console, geen zwart
         scherm. Zonder deze uitsluiting stuurde elke gezonde Command-sessie
         een vals alarm met shell=0 en midden=DIV.cmd-leeg. */
      var command = document.getElementById('rtgCommand');
      if (command && command.getBoundingClientRect().width > 0 &&
          command.getBoundingClientRect().height > 0) return;
      /* --e staat op #app en niet op :root; hem daar lezen gaf een lege waarde,
         en juist die rekeneenheid is wat een layoutstoring verraadt. */
      var app = document.getElementById('app');
      var css = getComputedStyle(app || document.documentElement);
      var el = function (s) { var x = document.querySelector(s); return x ? Math.round(x.getBoundingClientRect().height) : -1; };
      meld('leeg-scherm', String(reden || '') +
        ' | venster ' + innerWidth + 'x' + innerHeight +
        ' | shell ' + el('#shell') + ' | content ' + el('#content') +
        ' | thuis ' + el('.os-thuisscherm') +
        ' | tegels ' + document.querySelectorAll('.os-app').length +
        /* De BREEDTE van een tegel is het getal dat een layoutstoring verraadt:
           tegels worden gemaat met calc(var(--e) * ...), dus valt die eenheid
           weg, dan staan ze er wel maar zijn ze nul breed. Tellen alleen zou
           dat verschil niet zien. */
        /* Wat er MIDDEN op het scherm staat: de enige vraag die telt als
           iemand zegt dat hij niets ziet. */
        ' | midden=' + (function () { var m = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight / 2));
          return m ? (m.tagName + (m.className ? '.' + String(m.className).split(' ')[0] : '')) : 'niets'; })() +
        /* DE HELE KETEN IN DE BREEDTE, en de UITGEREKENDE eenheid.

           De vorige meting gaf "tegelbreed 0" en de rekeneenheid als BRONTEKST.
           Daarop repareerde ik de eenheid -- en de tegels bleven nul breed. De
           brontekst zegt namelijk niets over wat de browser er werkelijk van
           maakt, en een breedte van nul kan net zo goed van een ouder komen die
           zelf is dichtgeklapt. Daarom nu: elke schakel van shell tot tegel in
           de breedte, en de eenheid zoals de browser hem heeft uitgerekend. */
        ' | breedtes shell=' + (function () { var e = document.querySelector('#shell'); return e ? Math.round(e.getBoundingClientRect().width) : -1; })() +
        ' content=' + (function () { var e = document.querySelector('#content'); return e ? Math.round(e.getBoundingClientRect().width) : -1; })() +
        ' thuis=' + (function () { var e = document.querySelector('.os-thuisscherm'); return e ? Math.round(e.getBoundingClientRect().width) : -1; })() +
        ' rij=' + (function () { var e = document.querySelector('.os-grid'); return e ? Math.round(e.getBoundingClientRect().width) : -1; })() +
        ' tegel=' + (function () { var t = document.querySelector('.os-app'); return t ? Math.round(t.getBoundingClientRect().width) : -1; })() +
        ' | e-uitgerekend=' + (function () {
          var a = document.getElementById('app'); if (!a) return '(geen app)';
          var p = document.createElement('div');
          p.style.cssText = 'position:absolute;visibility:hidden;width:calc(var(--e) * 100);';
          a.appendChild(p); var w = p.getBoundingClientRect().width; p.remove();
          return (w / 100).toFixed(2) + 'px';
        })() +
        ' | e=' + (css.getPropertyValue('--e') || '(leeg)').trim() +
        ' | dvh=' + (CSS && CSS.supports && CSS.supports('height', '100dvh')) +
        ' | cq=' + (CSS && CSS.supports && CSS.supports('container-type', 'size')),
        'layout', 0);
    } catch (e) { /* meten mag nooit de oorzaak van iets worden */ }
  }

  window.RTGFoutmelder = { meld: meld, meetLeeg: meetLeeg };
})();
