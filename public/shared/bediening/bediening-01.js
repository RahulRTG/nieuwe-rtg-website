/* HET BEDIENINGSPANEEL -- één plek voor de instellingen van dit scherm.

   Er dreven zes losse knopjes over elk scherm. Linksonder vier, waarvan drie
   boven op elkaar: de bewegingspil ("Rustig"), de themakiezer, de taalknop en
   het vraagteken van de app-gids. Rechtsboven nog twee: beeld draaien en
   volledig scherm. Ze horen bij elkaar, dus staan ze nu bij elkaar: in één
   paneel, achter één ingang. Het leden-OS had dit al -- daar zit alles in het
   bedieningspaneel -- en dit is datzelfde idee voor elk ander scherm.

   Er is geen knop om hem te openen: je haalt hem van de bovenrand omlaag,
   zoals een besturingssysteem dat doet (shared/randen.js). Op het leden-OS
   bouwt deze module niets -- daar bestaat het bedieningspaneel al, en de
   bovenrand opent dat.

   Elke rij verschijnt alleen als de bijbehorende laag echt geladen is. */
(function (w, d) {
  'use strict';
  if (w.RTGBediening) return;
  var T = function (k, nl) { return (w.RTGi18n && w.RTGi18n.t) ? w.RTGi18n.t(k, nl) : nl; };
  function laadBedieningStijl(pad) {
    if (document.documentElement.hasAttribute('data-ds')) return;
    if (document.getElementById('rtgDsRuntimeCss')) return;
    var bedieningStijlLink = document.createElement('link');
    bedieningStijlLink.id = 'rtgDsRuntimeCss';
    bedieningStijlLink.rel = 'stylesheet';
    bedieningStijlLink.href = pad;
    document.head.appendChild(bedieningStijlLink);
  }
  function stijl() { laadBedieningStijl('/ds/rtg-ds.css'); }

  // deel 2 zet de rijen, het paneel en de ingang; zie bediening-02.js
