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
  event:        { app: '/apps/podium.html',  param: 'event',   titel: 'Podium',        deel: true },
  /* TWEE DINGEN HETEN VOERTUIG, EN DIT IS DE DUURZAME. Deze verwijzing wijst
     naar een `mobAsset`: het voertuig zelf, met zijn papieren, dat er morgen
     nog is. `db.data.ovVoertuigen` -- waar het objectregister van RTG Command
     de soort `voertuig` op zet -- is iets anders: een LIVE positie met een
     houdbaarheid van twee minuten, die verdwijnt zodra een chauffeur zijn
     dienst beeindigt. Daar verwijzen zou een link opleveren die vrijwel altijd
     dood is; daarom staat die soort hier niet.
     `deel: false` -- een vlootscherm hangt achter de vervoerderdeur, en een
     link die in een gesprek belandt bij iemand die er niet in kan, belooft iets
     wat hij niet waarmaakt. */
  voertuig:     { app: '/apps/voertuig.html', param: 'voertuig', titel: 'Voertuig',     deel: false }
};

/* TWEE VRAGEN, EN ZE ZIJN NIET DEZELFDE.

   `vorm()` zegt of iets een geldige VERWIJZING is: klopt de bouw van
   `rtg://<soort>/<id>`. `ontleed()` zegt bovendien of DIT HUIS die soort kent
   -- of er dus een app is om heen te gaan.

   Ze stonden eerst in één functie, en dat viel op zodra de werkruimtelaag een
   ticket aan iets uit een andere app wilde hangen: een verwijzing naar een
   soort die hier (nog) geen bestemming heeft, is niet ONGELDIG -- hij is
   geldig en onbekend, en die twee horen een ander antwoord te krijgen.
   Weigeren zou de gebruiker dwingen het dan maar in de vrije tekst te zetten,
   en dan is de draad weg.

   `ontleed()` doet nog precies wat hij deed; wie hem gebruikt merkt niets. */
const VORM = /^rtg:\/\/([a-z]{3,20})\/([A-Za-z0-9_-]{1,64})$/;

function vorm(ref) {
  const m = VORM.exec(String(ref || ''));
  return m ? { soort: m[1], id: m[2] } : null;
}

// `rtg://salon/ab12` -> { soort: 'salon', id: 'ab12' }, of null als het geen
// geldige verwijzing is OF als deze soort hier geen bestemming heeft.
function ontleed(ref) {
  const d = vorm(ref);
  return d && KAART[d.soort] ? d : null;
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

/* DE MODUS DIE MEEREIST NAAR DE INBOX.

   "Wanneer je Business kiest, worden ook je berichten zakelijk" -- dat is de
   belofte van de contextschakelaar, en zonder deze kaart zou hij bij de deur
   van de berichten-app ophouden.

   Maar hij is met opzet BIJNA LEEG, en dat is het eerlijke antwoord op iets wat
   niet klopt zodra je het uitschrijft. De inbox is geordend naar de BRON van een
   gesprek (mensen, zaken, onderweg, officieel, Rahul); de wereldschakelaar gaat
   over CONTEXT. Die twee vallen vandaag op precies EEN plek samen: Business
   hoort bij de la 'zaken'. Lifestyle, Communities en Privé zouden alle drie op
   'mensen' uitkomen -- drie knoppen met hetzelfde gevolg, en dat is dezelfde
   leugen in de interface als de zichtbaarheid 'vrienden' naast 'contacten' was.

   Dus: Business filtert, de rest laat de inbox met rust. Komt er ooit een la
   bij die wel onderscheidt, dan komt hij hier -- en test/wereldlaag.test.js
   houdt deze kaart tegen de ECHTE ladenlijst van kern/comm aan, zodat een la die
   daar hernoemd wordt hier niet stil blijft staan. */
const MODUS_LADE = { business: 'zaken' };
const ladeVoorModus = (modus) => MODUS_LADE[modus] || null;

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

module.exports = { KAART, MODUS_LADE, vorm, ontleed, open, magDelen, naarGesprek, ladeVoorModus };
