/* INSTELLINGEN bezit identiteit, toegang, toestemming, juridische keuzes en
   de platformschil. De vier oude voordeuraliassen horen bij dezelfde schil;
   daardoor heeft ook ieder werkelijk bediend app-pad één eigenaar. */
'use strict';

module.exports = [
  '/',
  '/apps/',
  '/apps/app.html',
  '/apps/bewijsmap.html',
  '/apps/boardroom.html',
  '/apps/bureau.html',
  '/apps/ik.html',
  '/apps/index.html',
  '/apps/juridisch.html',
  '/apps/juridisch/partnervoorwaarden.html',
  '/apps/juridisch/privacy.html',
  '/apps/juridisch/voorwaarden.html',
  /* MIJN RTG: mijn gegevens, mijn post, wie er toegang tot mij heeft en waar
     ik aanwezig ben. Identiteit, toegang en toestemming -- dus deze schil, en
     niet LIFE: het gaat niet over wat ik doe maar over wie mij mag kennen.
     Mijn bescherming hoort in datzelfde rijtje: het gaat over wie mij mag
     bereiken, niet over wat ik ermee doe. */
  '/apps/mijn-gegevens.html',
  '/apps/mijn-isolatie.html',
  '/apps/mijn-post.html',
  '/apps/mijn-relaties.html',
  '/apps/mijn-sessies.html',
  '/apps/passkeys.html',
  '/apps/rtgid.html',
  '/apps/toestemming.html'
];
