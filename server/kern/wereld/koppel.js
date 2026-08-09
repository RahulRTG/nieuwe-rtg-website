/* RTG Wereld -- DE KOPPELLAAG. Waar een ding woont, en hoe je er komt.

   HET PROBLEEM DAT DIT OPLOST. In de super-app kom je overal verwijzingen tegen
   naar dingen die ergens anders wonen: een vacature in een gesprek, een
   restaurant dat een vriend stuurt, een reis, een genootschap, een profiel. Zonder
   afspraak schrijft elk scherm zijn eigen `'/apps/' + soort + '.html?id=' + id`,
   en dan staat dezelfde routekaart in twintig schermen -- LAT-regel 4, met als
   voorspelbaar gevolg dat een app die verhuist negentien dode links achterlaat.

   Hier staat die kaart één keer. Een verwijzing is `rtg://<soort>/<id>`, en deze
   module zegt welke app hem opent. Verhuist een app, dan verhuist hij hier.

   EN DE COMMUNICATIE-APP BLIJFT EEN EIGEN APP. Dat is een bewuste keuze en geen
   tussenstand: RTG Berichten (public/apps/comm.html) is de plek waar contact
   woont -- de Universal Inbox met alle laden, bellen en videobellen. De
   super-app slokt hem niet op. Wat hier staat is de naad ertussen: overal waar
   je in de wereld een mens ziet, levert `naarGesprek()` de ene link die de
   berichten-app op het juiste gesprek opent. Twee apps, één beweging.

   Waarom niet samenvoegen? Omdat contact een andere levensduur heeft dan een
   tijdlijn. Je berichten wil je kunnen openen als de feed plat ligt, als
   melding, vanaf een horloge, naast de app. Een gesprek dat alleen bestaat als
   tabblad van iets anders is een gesprek dat je kwijtraakt zodra dat iets
   anders verandert. */
'use strict';

/* De kaart: per soort de app die hem bezit en hoe de verwijzing eruitziet.

   `deel` zegt of een verwijzing van deze soort in een gesprek geplakt mag
   worden. Dat is geen cosmetica: een verhaal en een snap zijn bewust vluchtig
   (24 uur, of één keer bekijken), en een link die dat overleeft zou die belofte
   stil breken. Wie hier een soort bijzet, beantwoordt die vraag dus expliciet. */
const KAART = {
  salon:        { app: '/apps/salon.html',   param: 'post',   titel: 'Uit De Salon',   deel: true },
  pulse:        { app: '/apps/pulse.html',   param: 'post',   titel: 'Pulse',          deel: true },
  zakelijk:     { app: '/apps/zakelijk.html', param: 'post',  titel: 'RTG Zakelijk',   deel: true },
  genootschap:  { app: '/apps/cercle.html',  param: 'bericht', titel: 'Genootschap',   deel: false },
  verhalen:     { app: '/apps/wereld.html',  param: 'verhaal', titel: 'Verhaal',       deel: false },
  profiel:      { app: '/apps/wereld.html',  param: 'profiel', titel: 'Profiel',       deel: true },
  gesprek:      { app: '/apps/comm.html',    param: 'gesprek', titel: 'Berichten',     deel: false },
  vacature:     { app: '/apps/zakelijk.html', param: 'kans',  titel: 'Kansenbord',     deel: true },
  reis:         { app: '/apps/app.html',     param: 'reis',    titel: 'Reizen',        deel: true },
  zaak:         { app: '/apps/app.html',     param: 'zaak',    titel: 'Ter plaatse',   deel: true },
  event:        { app: '/apps/podium.html',  param: 'event',   titel: 'Podium',        deel: true }
};

// `rtg://salon/ab12` -> { soort: 'salon', id: 'ab12' }, of null als het geen
// geldige verwijzing is. Bewust streng: alles wat niet past is geen verwijzing.
function ontleed(ref) {
  const m = /^rtg:\/\/([a-z]{3,20})\/([A-Za-z0-9_-]{1,64})$/.exec(String(ref || ''));
  return m && KAART[m[1]] ? { soort: m[1], id: m[2] } : null;
}

/* Waar moet ik heen om dit te openen? Geeft null bij een onbekende verwijzing
   en NIET een gokje naar de homepage: stil de verkeerde pagina openen is erger
   dan zeggen dat je het niet weet (LAT-regel 5). */
function open(ref) {
  const d = ontleed(ref);
  if (!d) return null;
  const k = KAART[d.soort];
  return { soort: d.soort, id: d.id, titel: k.titel, url: k.app + '?' + k.param + '=' + encodeURIComponent(d.id) };
}

const magDelen = (ref) => { const d = ontleed(ref); return !!(d && KAART[d.soort].deel); };

/* DE NAAD NAAR DE BERICHTEN-APP. Overal in de wereld waar een mens staat, staat
   "Bericht" -- en die knop doet hier zijn werk. We geven de CODENAAM mee en
   nooit een sleutel: de identiteitskluis blijft gescheiden (CLAUDE.md), en een
   link die in een browserhistorie of een melding belandt hoort niets te
   bevatten waarmee je iemand buiten RTG kunt terugvinden.

   `bij` is optioneel: de verwijzing waar het gesprek over gaat, zodat de
   berichten-app het onderwerp meteen in beeld heeft in plaats van een leeg
   veld. Een verwijzing die niet gedeeld mag worden gaat er niet in mee. */
function naarGesprek(codenaam, bij) {
  const naam = String(codenaam || '').trim();
  if (!naam) return null;
  let url = '/apps/comm.html?met=' + encodeURIComponent(naam);
  if (bij && magDelen(bij)) url += '&over=' + encodeURIComponent(bij);
  return url;
}

module.exports = { KAART, ontleed, open, magDelen, naarGesprek };
