/* De canonieke lijst van ROS-apps (leden-schermen), zodat verschillende
   onderdelen (flagship-widgets, split-screen) dezelfde apps kunnen aanbieden.
   Spiegelt de App Store van het leden-OS (app-main/25-os-01.js LINKS) plus de
   drie kern-tabs. window.RTGApps = [{ naam, url }]. */
(function (w) {
  'use strict';
  if (w.RTGApps) return;
  w.RTGApps = [
    { naam: 'De Salon',        url: '/apps/app.html#salon' },
    { naam: 'RTG Pay',         url: '/apps/pay.html' },
    { naam: 'Het Huis',        url: '/apps/rtg.html' },
    { naam: 'RTG Mall',        url: '/apps/mall.html' },
    { naam: 'Food Court',      url: '/apps/foodcourt.html' },
    { naam: 'Spelen',          url: '/apps/spelen.html' },
    { naam: 'Vrienden',        url: '/apps/foundation/vrienden.html' },
    { naam: 'Berichten',       url: '/apps/berichten.html' },
    { naam: 'Camera',          url: '/apps/camera.html' },
    { naam: 'RTG Sound',       url: '/apps/muziek.html' },
    { naam: 'Podium',          url: '/apps/podium.html' },
    { naam: 'Theater',         url: '/apps/theater.html' },
    { naam: 'Clips',           url: '/apps/clips.html' },
    { naam: 'Nieuws',          url: '/apps/nieuws.html' },
    { naam: 'Pulse',           url: '/apps/pulse.html' },
    { naam: 'Sport',           url: '/apps/sport.html' },
    { naam: 'RTG OV',          url: '/apps/ov.html' },
    { naam: 'Navigatie',       url: '/apps/navigatie.html' },
    { naam: 'Flits',           url: '/apps/flits.html' },
    { naam: 'Vluchten',        url: '/apps/vluchten.html' },
    { naam: 'Reisboek',        url: '/apps/reisboek.html' },
    { naam: 'Mijn Stad',       url: '/apps/stad.html' },
    { naam: 'RTG Office',      url: '/apps/office.html' },
    { naam: 'Balans',          url: '/apps/balans.html' },
    { naam: 'Wie betaalt wat', url: '/apps/wbw.html' },
    { naam: 'Vonk',            url: '/apps/vonk.html' },
    { naam: 'Rendez-vous',     url: '/apps/rendezvous.html' },
    { naam: 'Entourage',       url: '/apps/entourage.html' },
    { naam: 'Attenties',       url: '/apps/attenties.html' },
    { naam: 'Cercle',          url: '/apps/cercle.html' },
    { naam: 'Maison',          url: '/apps/maison.html' },
    { naam: 'Table',           url: '/apps/table.html' },
    { naam: 'Cellier',         url: '/apps/cellier.html' },
    { naam: 'Garde-robe',      url: '/apps/garderobe.html' },
    { naam: 'Hangar',          url: '/apps/hangar.html' },
    { naam: 'Mecenaat',        url: '/apps/mecenaat.html' },
    { naam: 'Lab-fonds',       url: '/apps/labfonds.html' },
    { naam: 'Nalatenschap',    url: '/apps/nalatenschap.html' },
    { naam: 'Logboek',         url: '/apps/logboek.html' },
    { naam: 'De Rechterhand',  url: '/apps/lifestyle.html' },
    { naam: 'Juridisch',       url: '/apps/juridisch.html' },
    { naam: 'Passkeys',        url: '/apps/passkeys.html' }
  ];
})(window);
