#!/usr/bin/env node
'use strict';
/* ============================================================================
   POSITIESTROOM -- waar gaat de positie van een mens heen, en hoe lang blijft
   hij daar?

   WAAROM DIT ER IS. NAVIGATIE.md par. 6.2 las in de code dat geen van de vijf
   terughoudendheidstellers op nul staat, en N10 (par. 15.0) maakt van die
   tellers een permanente meter: *groen betekent niet dat het beleid zegt dat er
   geen bewegingsspoor is, groen betekent dat de code aantoonbaar geen verboden
   bewegingsspoor maakt.* Dit is de eerste helft van die meter -- de BRON. De
   tweede helft (de opslag lezen na een doorloop van de keten) is A0c en staat
   hier met opzet niet in: een statische meter die zegt wat er na een doorloop
   in de opslag staat, zou raden.

   WAT HIJ NIET TELT, en dat is net zo belangrijk (N11). Een positie die TIJDENS
   een taak wordt verwerkt is geen schuld. Deze meter kijkt naar wat er van een
   mens OVERBLIJFT: welke collectie, aan welke sleutel, met welke termijn. Een
   meter die minder GPS beloont, maakt de navigatie slechter en laat het
   verkeerde getal dalen.

   DE INDELING IS VERKLAARD EN DE UITSLAG GEMETEN, zoals in scripts/spoorvorm.js.
   Of een positie NODIG is voor een functie kan geen parser vinden -- dat is een
   oordeel, en het staat hieronder per stroom met de reden. Maar dat oordeel is
   hier nog niet door een mens genomen: elke klasse is een VOORSTEL en draagt
   `besluit: null` tot de eigenaar hem vaststelt. Een stand wordt nooit afgeleid
   uit bewijs (MUTATIECONTRACT.md); het bewijs draagt een voorstel, een mens het
   besluit.

   Wat WEL gemeten wordt, en de indeling dus kan tegenspreken:
     - de NOEMER: elk bestand in server/ dat een object met lat en lng/lon bouwt
       en iets opslaat. Een kandidaat zonder verklaring laat de meter zakken.
     - het BEWIJS: elk citaat moet letterlijk in zijn bestand staan. Een stroom
       die verhuist of verdwijnt, valt daardoor niet stil uit de telling.
     - de TERMIJN: uit het bewaarbeleid, de bewaarveger en de vergeetroute
       gelezen, en niet uit deze lijst. Een voorstel `onbegrensd` terwijl het
       bewaarbeleid een termijn noemt, is een TEGENSPRAAK en laat de meter zakken.

   DE GRAAD IS `vermoed`. De detectie is lexicaal en dus een ONDERGRENS: een
   positie die in losse toewijzingen wordt opgebouwd (`L.lat = lat`) ziet hij
   niet. Daarom staat `nietGedetecteerd` in de uitslag -- stromen die wel
   verklaard zijn maar door de detector gemist worden. Dat getal is de blinde
   vlek van het instrument, hardop.

        node scripts/positiestroom.js                 (toont de uitslag)
        node scripts/positiestroom.js --vastleggen    (schrijft POSITIESTROOM.json)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./lib/bron');
const { stempel, eisSchoneBoom } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'POSITIESTROOM.json');

/* De zeven klassen uit NAVIGATIE.md par. 6.4. `toegestaan` staat er voor de
   volledigheid; een OPGESLAGEN positie van een mens komt er in deze lijst niet
   in, want wat niet blijft is geen stroom. */
const KLASSEN = ['toegestaan', 'venster', 'noodzakelijk', 'teLang', 'onbegrensd', 'verboden', 'onbekend'];

/* DE BESLUITEN VAN DE EIGENAAR. Een klasse hierboven is een voorstel; wat hier
   staat is genomen, met een datum en een nummer dat letterlijk in NAVIGATIE.md
   par. 15.0 moet voorkomen (test/positiestroom.test.js toets 9 zakt anders). Een
   besluit noemt de klasse waar de stroom naartoe MOET. Of dat al zo is, wordt
   niet opgegeven maar afgeleid: `uitgevoerd` is waar zodra de gemeten indeling
   gelijk is aan de besloten klasse. Een besluit dat niemand bouwde blijft dus
   zichtbaar als besluit, en niet als voltooid. */
const N15 = { n: 'N15', datum: '2026-09-29', uitkomst: 'aanvaard zoals voorgesteld' };
const BESLUITEN = {
  'plaats-passages': { n: 'N12', datum: '2026-09-29', klasse: 'toegestaan',
    uitkomst: 'alleen het doelhek wordt opgeslagen; een passage langs een ander hek wordt verwerkt en niet bewaard' },
  'live-onderweg': { n: 'N14', datum: '2026-09-29', klasse: 'venster',
    uitkomst: 'de positie wordt gewist zodra Onderweg stopt; de veger van zeven dagen blijft alleen als vangnet' },
  'ontmoet-radar': { n: 'N14', datum: '2026-09-29', klasse: 'venster',
    uitkomst: 'de positie wordt gewist zodra de radar stopt' },
  ...Object.fromEntries(['charter-delen', 'date-positie', 'excursie-begeleider', 'excursie-leerling', 'huur-delen',
    'koerier-bezorgdienst', 'ov-voertuig', 'plaats-waarnemingen', 'veilig-spoor']
    .map(naam => [naam, Object.assign({ klasse: 'venster' }, N15)])),
  ...Object.fromEntries(['favorieten', 'flits-melding', 'weefsel-zaak']
    .map(naam => [naam, Object.assign({ klasse: 'noodzakelijk' }, N15)]))
};

/* ----------------------------------------------------------------------------
   DE STROMEN. Per stroom: waar hij woont (met een citaat dat letterlijk in de
   bron moet staan), in welke collectie hij landt, aan welke sleutel, van wie de
   positie is, en -- als de termijn niet uit het bewaarbeleid komt -- het
   mechanisme dat hem weghaalt, ook met een citaat.
   -------------------------------------------------------------------------- */
const S = (pad, citaat) => ({ pad: 'server/' + pad, citaat });

const STROMEN = [
  { naam: 'live-onderweg', wat: 'de positie van een lid dat Onderweg aanzet',
    bron: [S('routes/member/onderweg.js', 'L.lat = lat; L.lng = lng; L.updatedAt = new Date().toISOString(); gewijzigd = true;')],
    collectie: 'live', sleutel: 'sessiesleutel', van: 'lid', klasse: 'venster',
    termijn: { soort: 'venster', bewijs: S('routes/member/onderweg.js', 'if (L) { L.active = false; delete L.lat; delete L.lng; save(); pushLive(key); }') },
    waarom: 'sinds N14 wist /api/live/stop de positie; de bewaarveger van zeven dagen is het vangnet voor wie ' +
      'nooit op stop drukt. Tot 29 september zette stoppen alleen active op false (NAVIGATIE.md par. 6.2).' },

  { naam: 'rit-vertrekpunt', wat: 'de live-positie die bij een ritaanvraag in de vervoersopdracht wordt gekopieerd',
    bron: [S('routes/member/onderweg.js', 'const vanaf = (L && Number.isFinite(L.lat)) ? L : (zaak && zaak.loc) || null;')],
    collectie: 'mobOpdrachten', sleutel: 'sessiesleutel', van: 'lid', klasse: 'onbegrensd',
    waarom: 'de kopie ontsnapt aan de zevendagenveger van db.data.live en blijft op de opdracht staan zonder termijn' },

  { naam: 'ritlijn', wat: 'de posities van een lopende rit (chauffeur en dus reiziger)',
    bron: [S('kern/mobiliteit/voortgang.js', 'o.positie = { lat: punt.lat, lng: punt.lng, at: nu() };')],
    collectie: 'mobOpdrachten', sleutel: 'sessiesleutel', van: 'medewerker', klasse: 'onbegrensd',
    waarom: 'tot zestig gebeurtenissen met lat/lng blijven na de rit op de opdracht staan; een termijn ontbreekt ' +
      '(B10 in NAVIGATIE.md: punten na de rit zijn onder PLAATS.md grens 1 een besluit, geen termijn)' },

  { naam: 'reis-etappes', wat: 'vertrek- en aankomstpunten van een geboekte reis, soms de live-positie',
    bron: [S('kern/mobiliteit/reis.js', "van: { lat: e.van.lat, lng: e.van.lng, label: e.van.label || e.van.naam || 'Vertrek' },")],
    collectie: 'mobReizen', sleutel: 'sessiesleutel', van: 'lid', klasse: 'onbegrensd',
    waarom: 'begint het plan bij "hier", dan is dit de GPS van het lid, en de herkomst gaat verloren (bron wordt kaart)' },

  { naam: 'favorieten', wat: 'plekken die een lid zelf bewaart, soms de huidige positie',
    bron: [S('kern/mobiliteit/plekken.js', 'Object.assign(f, { naam, lat: plek.lat, lng: plek.lng, bron: plek.bron });')],
    collectie: 'mobFavorieten', sleutel: 'sessiesleutel', van: 'lid', klasse: 'noodzakelijk',
    termijn: { soort: 'lid', bewijs: S('kern/mobiliteit/plekken.js', 'if (body.weg) {') },
    waarom: 'het lid kiest en verwijdert ze zelf (max. tien); dat is zijn eigen inhoud en geen spoor -- maar de ' +
      'vergeetroute kent mobFavorieten niet (daar staat favorieten, een andere collectie)' },

  { naam: 'ov-instap', wat: 'het instappunt van een OV-rit',
    bron: [S('kern/ov/index.js', 'in: { lat: voertuig.lat, lng: voertuig.lng, at: nu() }, uit: null, prijs: null };')],
    collectie: 'ovRitten', sleutel: 'sessiesleutel', van: 'lid', klasse: 'onbegrensd',
    waarom: 'alleen een plafond op aantal (4000), geen termijn; samen met het uitstappunt een reishistorie per lid' },

  { naam: 'ov-uitstap', wat: 'de eigen GPS bij uitchecken, gebruikt voor het tarief',
    bron: [S('kern/ov/reizen.js', "rit.status = 'uit'; rit.uit = { ...uitPunt, at: nu() }; rit.prijs = prijs; rit.km = Math.round(km * 10) / 10;")],
    collectie: 'ovRitten', sleutel: 'sessiesleutel', van: 'lid', klasse: 'onbegrensd',
    waarom: 'voor het tarief is een afstand nodig en geen punt; het punt blijft zonder termijn staan' },

  { naam: 'ov-voertuig', wat: 'de PDA-positie van een OV-chauffeur tijdens de dienst',
    bron: [S('kern/ov/dienst.js', 'if (Number.isFinite(lat) && Number.isFinite(lng)) { v.lat = lat; v.lng = lng; }')],
    collectie: 'ovVoertuigen', sleutel: 'staffId', van: 'medewerker', klasse: 'venster',
    termijn: { soort: 'venster', bewijs: S('kern/ov/dienst.js', 'if (data.aan === false) { save(); return { status: 200, ok: true, aan: false }; }') },
    waarom: 'overschreven en niet opgestapeld, en weg zodra de dienst stopt' },

  { naam: 'patrouille', wat: 'de positie van een bewaker bij elk controlepunt',
    bron: [S('kern/beveiliging/pda/patrouille.js', 'lat: Number.isFinite(Number(lat)) ? Number(lat) : null, lng: Number.isFinite(Number(lng)) ? Number(lng) : null });')],
    collectie: 'bevRondes', sleutel: 'staffId', van: 'medewerker', klasse: 'onbegrensd',
    waarom: 'een bewegingsgeschiedenis van een medewerker met alleen een plafond op aantal; hetzelfde bestand haalde ' +
      'de coordinaat bij het inklokken juist weg als "geen plaats zonder doel"' },

  { naam: 'beveiliging-incident', wat: 'de plek van een incident en van een SOS van een bewaker',
    bron: [S('kern/beveiliging/pda/index.js', 'lat: Number.isFinite(coord(data.lat, 90)) ? coord(data.lat, 90) : null, lng: Number.isFinite(coord(data.lng, 180)) ? coord(data.lng, 180) : null,'),
      S('kern/beveiliging/pda/index.js', 'lat: Number.isFinite(Number(lat)) ? Number(lat) : null, lng: Number.isFinite(Number(lng)) ? Number(lng) : null,')],
    collectie: 'bevIncidenten', sleutel: 'staffId', van: 'medewerker', klasse: 'onbegrensd',
    waarom: 'een incidentdossier heeft een reden om te bestaan, maar geen termijn; de SOS-positie blijft na afsluiten staan' },

  { naam: 'veilig-laatste-plek', wat: 'de laatst bekende positie voor de veiligheidskring',
    bron: [S('kern/veiligheid/plek.js', 'lat: Math.round(lat * 1e5) / 1e5,')],
    collectie: 'veilig', sleutel: 'handle', van: 'lid', klasse: 'onbegrensd',
    waarom: 'PLAATS.md grens 1 laat na een venster hoogstens de laatste plek toe -- maar hier wordt hij ook zonder ' +
      'open venster bewaard, en nooit weggehaald; de veiligheidslaag zegt zelf dat het bewaarbeleid haar niet kent' },

  { naam: 'veilig-spoor', wat: 'het korte spoor (max. twaalf punten) tijdens een open veiligheidsvenster',
    bron: [S('kern/veiligheid/plek.js', 'venster.spoor = (venster.spoor || []).concat([punt]).slice(-SPOOR_MAX);')],
    collectie: 'veilig', sleutel: 'handle', van: 'lid', klasse: 'venster',
    termijn: { soort: 'venster', bewijs: S('kern/veiligheid/plek.js', 'delete V.vensters[handle];') },
    waarom: 'weg bij het sluiten van het venster; een VERLOPEN venster wordt alleen niet vanzelf gesloten' },

  { naam: 'veilig-alarm', wat: 'de laatste positie die bij elk alarm wordt meegeschreven',
    bron: [S('kern/veiligheid/alarm.js', 'afgesloten: false, plek: plek.laatstePlek(handle) || null')],
    collectie: 'veilig', sleutel: 'handle', van: 'lid', klasse: 'onbegrensd',
    waarom: 'blijft na afsluiten staan, ook bij een proefalarm; alleen een plafond van tweehonderd alarmen' },

  { naam: 'ontmoet-radar', wat: 'de laatste positie voor de radar van Salon-ontmoetingen',
    bron: [S('kern/ontmoeting.js', 'if (Number.isFinite(lat) && Number.isFinite(lng)) db.data.ontmoetPosities[key] = { lat, lng, at: nu() };')],
    collectie: 'ontmoetPosities', sleutel: 'sessiesleutel', van: 'lid', klasse: 'venster',
    termijn: { soort: 'venster', bewijs: S('kern/ontmoeting.js', 'if (Date.now() - at > POS_TTL_MS) { delete P[k]; weg++; }') },
    waarom: 'sinds N14 wordt een positie die niet meer vers is gewist -- bij elke nieuwe positie, bij elke stand en ' +
      'door de bewaarveger. Tot 29 september werd de versheid alleen bij het LEZEN gewogen en bleef de plek staan ' +
      'tot het lid de functie uitzette.' },

  { naam: 'date-positie', wat: 'de live-positie van beide deelnemers tijdens een date',
    bron: [S('kern/ontmoeting/date.js', 'if (Number.isFinite(lat) && Number.isFinite(lng)) d.posities[key] = { lat, lng, at: nu() };')],
    collectie: 'ontmoetDates', sleutel: 'sessiesleutel', van: 'lid', klasse: 'venster',
    termijn: { soort: 'venster', bewijs: S('kern/ontmoeting/date.js', 'if (!d.sos.some(x => !x.ok)) d.posities = {};') },
    waarom: 'weg bij het stoppen van de date, tenzij er een SOS openstaat' },

  { naam: 'date-sos', wat: 'de positie bij een noodknop tijdens een date',
    bron: [S('kern/ontmoeting/sos.js', 'if (Number.isFinite(lat) && Number.isFinite(lng)) { s.lat = lat; s.lng = lng; d.posities[key] = { lat, lng, at: nu() }; }')],
    collectie: 'ontmoetDates', sleutel: 'sessiesleutel', van: 'lid', klasse: 'onbegrensd',
    waarom: 'blijft in het SOS-record staan nadat de SOS is afgehandeld en de date is gestopt' },

  { naam: 'vonk-profiel', wat: 'de positie in een datingprofiel, voor afstand bij het matchen',
    bron: [S('kern/vonk/index.js', 'if (isFinite(data.lat) && isFinite(data.lng)) { p.lat = coord(data.lat, 90); p.lng = coord(data.lng, 180); }')],
    collectie: 'vonk', sleutel: 'sessiesleutel', van: 'lid', klasse: 'onbegrensd',
    waarom: 'een precieze coordinaat zonder termijn en buiten de vergeetroute, terwijl matchen op afstand ook met een ' +
      'grovere plek kan' },

  { naam: 'markt-overdracht', wat: 'de GPS van koper en verkoper bij de overdracht',
    bron: [S('kern/markt/handel/deal.js', 'const pos = { lat: Number(lat), lng: Number(lng), at: Date.now() };')],
    collectie: 'markt', sleutel: 'partij', van: 'lid', klasse: 'onbegrensd',
    waarom: 'bewijst dat beide partijen samen waren; daarvoor volstaat de uitkomst (samen ja/nee en de afstand), de ' +
      'punten blijven onbeperkt op de chat' },

  { naam: 'koerier-mode', wat: 'de laatste positie van een koerier van een modebezorging',
    bron: [S('kern/modebezorg/koerier.js', 'b.gps = { lat, lng, at: nu() };')],
    collectie: 'modeBezorg', sleutel: 'staffId', van: 'medewerker', klasse: 'onbegrensd',
    waarom: 'het commentaar zegt "vluchtig", maar de positie blijft na de levering op het record staan' },

  { naam: 'koerier-bezorgdienst', wat: 'de positie van een bezorger van de bezorgdienst',
    bron: [S('routes/supplier/bezorg.js', "B[s.code + ':' + (req.actor.staffId || 'beheer')] = { lat, lng, at: new Date().toISOString(), staffId: req.actor.staffId || null, name: req.actor.name };")],
    collectie: 'bezorgers', sleutel: 'staffId', van: 'medewerker', klasse: 'venster',
    termijn: { soort: 'venster', bewijs: S('routes/supplier/bezorg-keten.js', "delete B[req.supplier.code + ':' + (req.actor.staffId || 'beheer')];") },
    waarom: 'weg als de bezorger terug is; hij heet vluchtig maar gaat met de volgende save() wel naar schijf' },

  { naam: 'zaak-live-locatie', wat: 'de "live locatie" van een vervoerder, die de vaste plek van de zaak overschrijft',
    bron: [S('routes/supplier/vervoer.js', "req.supplier.loc = { lat, lng, label: String(req.body.label || req.supplier.loc.label || '').slice(0, 80) };")],
    collectie: 'suppliers', sleutel: 'zaakcode', van: 'onbekend', klasse: 'onbekend',
    reden: 'of dit een voertuig of een mens is, kan deze meter niet vaststellen: bij een eenmanschauffeur is het een ' +
      'persoon, en die positie wordt als PLAATS aan elk lid getoond (P-01: een mens is geen plaats)',
    waarom: 'zie de reden; het is een besluit welke van de twee het is' },

  { naam: 'excursie-leerling', wat: 'de positie van een leerling tijdens een schoolexcursie, met toestemming van een ouder',
    bron: [S('school/excursie.js', "e.gps[l.sleutel] = { lat, lng, naam: l.naam, rol: 'leerling', at: nu() };")],
    collectie: 'foundation', sleutel: 'leerling', van: 'kind', klasse: 'venster',
    termijn: { soort: 'venster', bewijs: S('school/excursie.js', "e.status = 'afgerond'; e.gps = {}; e.gestoptAt = nu();") },
    waarom: 'weg bij het stoppen van de excursie en direct weg bij het intrekken van de toestemming' },

  { naam: 'excursie-begeleider', wat: 'de positie van een begeleider tijdens een schoolexcursie',
    bron: [S('school/excursie.js', "e.gps['begeleider:' + wie] = { lat, lng, naam: wie, rol: 'begeleider', at: nu() };")],
    collectie: 'foundation', sleutel: 'naam', van: 'medewerker', klasse: 'venster',
    termijn: { soort: 'venster', bewijs: S('school/excursie.js', "e.status = 'afgerond'; e.gps = {}; e.gestoptAt = nu();") },
    waarom: 'weg bij het stoppen van de excursie' },

  { naam: 'huur-delen', wat: 'de positie die een huurder vrijwillig deelt',
    bron: [S('routes/member/voertuigen/huur.js', 'if (L.aan && Number.isFinite(lat) && Number.isFinite(lng)) { L.lat = lat; L.lng = lng; L.at = new Date().toISOString(); }')],
    collectie: 'huurLocaties', sleutel: 'boeking', van: 'lid', klasse: 'venster',
    termijn: { soort: 'venster', bewijs: S('routes/member/voertuigen/huur.js', 'if (!L.aan) { delete L.lat; delete L.lng; }') },
    waarom: 'weg bij uitzetten en bij het inleveren van het voertuig' },

  { naam: 'charter-delen', wat: 'de positie die een chartergast vrijwillig deelt',
    bron: [S('routes/member/voertuigen/charter.js', 'if (L.aan && Number.isFinite(lat) && Number.isFinite(lng)) { L.lat = lat; L.lng = lng; L.at = new Date().toISOString(); }')],
    collectie: 'charterLocaties', sleutel: 'boeking', van: 'lid', klasse: 'venster',
    termijn: { soort: 'venster', bewijs: S('routes/member/voertuigen/charter.js', 'if (!L.aan) { delete L.lat; delete L.lng; }') },
    waarom: 'weg bij uitzetten en bij afronden; een geweigerde charter laat de rij wel staan' },

  { naam: 'huur-sos', wat: 'de positie bij een SOS van een huurder',
    bron: [S('routes/member/voertuigen/huur.js', 'if (Number.isFinite(lat) && Number.isFinite(lng)) { sos.lat = lat; sos.lng = lng; }')],
    collectie: 'boekingen', sleutel: 'boeking', van: 'lid', klasse: 'onbegrensd',
    waarom: 'blijft zonder termijn op de boeking staan' },

  { naam: 'charter-sos', wat: 'de positie bij een SOS op zee',
    bron: [S('routes/member/voertuigen/charter.js', 'if (Number.isFinite(lat) && Number.isFinite(lng)) { sos.lat = lat; sos.lng = lng; }')],
    collectie: 'boekingen', sleutel: 'boeking', van: 'lid', klasse: 'onbegrensd',
    waarom: 'blijft zonder termijn op de boeking staan' },

  { naam: 'flits-melding', wat: 'een verkeersmelding: de plek waar het lid was, met zijn codenaam',
    bron: [S('kern/flits.js', 'const m = { id: id(), soort, lat, lng, door: codenaam, bevestigingen: 0, weg: 0, at: nu(), laatstBevestigd: null };')],
    collectie: 'flitsMeldingen', sleutel: 'codenaam', van: 'lid', klasse: 'noodzakelijk',
    termijn: { soort: 'module', bewijs: S('kern/flits.js', 'return Date.now() - basis < s.ttlMin * 60 * 1000 && (m.weg || 0) < WEG_STEMMEN;') },
    waarom: 'een bewust gedane melding met een levensduur van 45 minuten tot een dag; de codenaam en de sleutels van ' +
      'wie bevestigt reizen mee, en de vergeetroute kent de collectie niet' },

  { naam: 'plaats-passages', wat: 'elke overgang langs een hek tijdens een naderingsvenster, onder een codenaam',
    bron: [S('kern/plaats/waarnemen.js', "schrijfLog(codenaam, 'waargenomen', { doel, hek, richting: wat });")],
    collectie: 'plaatsLog', sleutel: 'codenaam', van: 'lid', klasse: 'toegestaan',
    termijn: { soort: 'venster', bewijs: S('kern/plaats/waarnemen.js', 'if (venster.hek && hek !== venster.hek) {') },
    waarom: 'sinds N12 noemt een naderingsvenster zijn hek, en een overgang langs een ander hek wordt verwerkt en niet ' +
      'bewaard -- hij verlaat het verzoek niet. De regel die blijft gaat over het doel van het bezoek zelf. Tot 29 ' +
      'september legde elke passage een regel onder de codenaam vast, 90 dagen (NAVIGATIE.md par. 6.2).' },

  { naam: 'plaats-waarnemingen', wat: 'binnen/buiten per hek binnen een venster',
    bron: [S('kern/plaats/waarnemen.js', 'const waarneming = { id: id(), codenaam, doel, venster: venster.id, hek, wat, at: nu() };')],
    collectie: 'plaatsWaarnemingen', sleutel: 'codenaam', van: 'lid', klasse: 'venster',
    waarom: 'weg met het venster en hooguit twee dagen in het bewaarbeleid' },

  { naam: 'gemeente-melding', wat: 'de plek van een melding openbare ruimte, vaak de GPS van de melder',
    bron: [S('kern/gemeente/meldingen.js', 'lat: coord(data.lat, 90) || null, lng: coord(data.lng, 180) || null,')],
    collectie: 'gemeenteMeldingen', sleutel: 'codenaam', van: 'lid', klasse: 'onbegrensd',
    waarom: 'de plek hoort bij het probleem, maar staat met de codenaam van de melder zonder termijn (alleen een ' +
      'plafond); de kopie in weefselZaken heeft wel een termijn' },

  { naam: 'weefsel-zaak', wat: 'de plek van een zaak openbare ruimte, met de melder erbij',
    bron: [S('kern/stadsweefsel/zaken.js', 'lat: plek.lat, lng: plek.lng, gebied: plek.gebied, zone: plek.zone,')],
    collectie: 'weefselZaken', sleutel: 'codenaam', van: 'lid', klasse: 'noodzakelijk',
    waarom: 'een zaakdossier met een termijn in het bewaarbeleid; of drie jaar de melder moet dragen, is een aparte vraag' },

  { naam: 'horeca-bezorgadres', wat: 'het bezorgadres (vaak het woonadres) als punt op de rekening van een gast',
    bron: [S('kern/gast/buitenshuis.js', 'lat: lat == null ? null : Number(lat), lng: lng == null ? null : Number(lng),'),
      S('routes/gast/bezorgen.js', 'buitenshuis.zetBezorging(rek, { adres: b.adres, postcode: b.postcode, lat: b.lat, lng: b.lng,')],
    collectie: 'horeca', sleutel: 'codenaam', van: 'lid', klasse: 'onbegrensd',
    waarom: 'codenaam plus bezorgadres zonder termijn is precies wat scripts/afleidbaar.js als besluit aanwees' },

  { naam: 'bezorgdienst-adres', wat: 'het bezorgadres als punt op een bestelling',
    bron: [S('routes/member/kopen/bezorg.js', 'if (Number.isFinite(lat) && Number.isFinite(lng)) geo = { lat, lng };')],
    collectie: 'orders', sleutel: 'sessiesleutel', van: 'lid', klasse: 'onbegrensd',
    waarom: 'nodig voor de levering, niet daarna; geen termijn' },

  { naam: 'mode-adres', wat: 'de bestemming van een modebezorging, of een verzonnen punt als er geen is',
    bron: [S('kern/modebezorg/winkel.js', 'loc: (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : (s.loc ? { lat: s.loc.lat + 0.01, lng: s.loc.lng + 0.008 } : null),'),
      S('routes/member/handel/winkel.js', '{ adres: req.body.adres, lat: req.body.lat, lng: req.body.lng });')],
    collectie: 'modeBezorg', sleutel: 'sessiesleutel', van: 'lid', klasse: 'onbegrensd',
    waarom: 'geen termijn, alleen een plafond; en zonder punt wordt er een verzonnen (NAVIGATIE.md par. 12, gebrek 5)' }
];

/* ----------------------------------------------------------------------------
   GEEN STROOM. Elk kandidaatbestand dat geen positie van een mens bewaart, met
   de reden. Drie soorten: `plaats` (een zaak, halte, zone, voertuig als bezit of
   de plek van een incident), `zaad` (demo- en generatiedata), en `doorgerekend`
   (een positie van een mens wordt gebruikt en niet bewaard). Een bestand kan
   ook hier staan terwijl een ander deel ervan een stroom is.
   -------------------------------------------------------------------------- */
const G = (soort, reden) => ({ soort, reden });
const GEEN_STROOM = {
  'server/kern/command/stadstart.js': G('plaats', 'het middelpunt van een nieuwe stad'),
  'server/kern/gastzorg.js': G('doorgerekend', 'toont de live-positie aan een zaak zolang een toestemming loopt; bewaart niets'),
  'server/kern/ghost.js': G('plaats', 'vestigingen van zaken als knooppunten van een simulatie'),
  'server/kern/horeca/bezorglaag.js': G('doorgerekend', 'bezorgzone opzoeken; bewaart niets'),
  'server/kern/leverancier/state.js': G('doorgerekend', 'de live-positie van een gast in het antwoord aan de zaak'),
  'server/kern/lidacties/ritten.js': G('doorgerekend', 'de live-positie voor de offerte; alleen km en prijs blijven'),
  'server/kern/live.js': G('doorgerekend', 'leest db.data.live voor het eigen beeld en voor de zaak'),
  'server/kern/mobiliteit/assets.js': G('plaats', 'de plek van een voertuig als bezit van de vervoerder'),
  'server/kern/mobiliteit/pendel-rooster.js': G('plaats', 'vaste haltes van een pendeldienst'),
  'server/kern/navigatie/partner-events.js': G('plaats', 'wegmeldingen van zaken; de positie van de vrager filtert alleen'),
  'server/kern/navigatie/plekken.js': G('plaats', 'zaken, haltes en voorzieningen als bestemming'),
  'server/kern/stadsweefsel/gebiedmaak.js': G('plaats', 'de geometrie van een gebied'),
  'server/kern/stadsweefsel/geografieseed.js': G('zaad', 'gegenereerd raster van zones en straten'),
  'server/kern/stadsweefsel/objecten.js': G('plaats', 'het objectregister van de openbare ruimte'),
  'server/kern/stadsweefsel/objectseed.js': G('zaad', 'een beginset objecten langs de gegenereerde straten'),
  'server/kern/stadsweefsel/ondernemers.js': G('plaats', 'de plek van een leeg pand'),
  'server/kern/stadsweefsel/voorzieningregister.js': G('plaats', 'het pand van een voorziening'),
  'server/kern/vervoer.js': G('doorgerekend', 'de live-positie voor een ophaaltijd; alleen de minuten blijven'),
  'server/kern/vonk/match.js': G('doorgerekend', 'het midden van twee profielen; alleen de afstand blijft'),
  'server/kern/werk.js': G('plaats', 'de plek van een werkgever bij een vacature'),
  'server/kern/werkvenster.js': G('plaats', 'de zone van een werkplek; de positie bij het inloggen wordt alleen vergeleken'),
  'server/routes/doos.js': G('plaats', 'de plek van een hardwarekastje'),
  'server/routes/gast/eten.js': G('doorgerekend', 'de positie in een zoekopdracht, voor de afstand'),
  'server/routes/supplier/charter/vloot.js': G('doorgerekend', 'leest charterLocaties; de stroom staat onder charter-delen'),
  'server/routes/supplier/horeca/bezorgrit.js': G('doorgerekend', 'de volgorde van een bezorgrit; bewaart geen punten'),
  'server/routes/supplier/tafels-team.js': G('doorgerekend', 'een alarm van een medewerker gaat over SSE en wordt niet bewaard'),
  'server/routes/supplier/verhuur/vloot.js': G('doorgerekend', 'leest huurLocaties; de stroom staat onder huur-delen')
};

/* ----------------------------------------------------------------------------
   DE DETECTOR -- de noemer. Een object met een lat- en een lng/lon-sleutel,
   waarvan de waarde geen getal is (een getal is een vaste plek of zaad), in een
   bestand dat opslaat. Dit is een ondergrens; zie de kop.
   -------------------------------------------------------------------------- */
const OBJECT = /\{[^{}]*\blat\s*(?::\s*([^,}]+)|(?=[,}]))[^{}]*\b(?:lng|lon)\b\s*(?::\s*([^,}]+)|(?=[,}]))[^{}]*\}/g;
const SCHRIJFT = /\bsave\s*\(|\bdb\.data\./;

function schrijftPositie(bron) {
  const b = zonderCommentaar(bron);
  if (!SCHRIJFT.test(b)) return false;
  OBJECT.lastIndex = 0;
  let m;
  while ((m = OBJECT.exec(b))) {
    if (m[1] && /^\s*-?\d/.test(m[1])) continue;     // een vaste coordinaat
    return true;
  }
  return false;
}

function kandidaten() {
  const uit = [];
  (function loop(map) {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      const st = fs.statSync(p);
      if (st.isDirectory()) { if (naam !== 'data' && naam !== 'node_modules') loop(p); continue; }
      if (!naam.endsWith('.js')) continue;
      if (schrijftPositie(fs.readFileSync(p, 'utf8'))) uit.push(path.relative(WORTEL, p).split(path.sep).join('/'));
    }
  })(path.join(WORTEL, 'server'));
  return uit.sort();
}

/* ----------------------------------------------------------------------------
   DE TERMIJN, gelezen uit de drie plekken die erover gaan -- niet uit STROMEN.
   -------------------------------------------------------------------------- */
function lees(rel) {
  try { return fs.readFileSync(path.join(WORTEL, rel), 'utf8'); } catch (e) { return ''; }
}

function termijnBronnen() {
  const beleid = {};
  for (const rel of ['server/bewaarbeleid.js', 'server/bewaarbeleid-operationeel.js', 'server/bewaarbeleid-eigenregie.js']) {
    const b = zonderCommentaar(lees(rel));
    const re = /tak:\s*'([\w.]+)'[^}]*?dagen:\s*([^,}]+)/g;
    let m;
    while ((m = re.exec(b))) beleid[m[1].split('.')[0]] = { bestand: rel, dagen: m[2].trim() };
  }
  const veger = new Set();
  const vb = zonderCommentaar(lees('server/bewaarveger.js'));
  for (const m of vb.matchAll(/\bdb\.data\.(\w+)/g)) veger.add(m[1]);
  const vergeten = new Set();
  const vergetenMap = path.join(WORTEL, 'server/kern/vergeten');
  for (const n of (fs.existsSync(vergetenMap) ? fs.readdirSync(vergetenMap) : [])) {
    if (!n.endsWith('.js')) continue;
    const b = zonderCommentaar(fs.readFileSync(path.join(vergetenMap, n), 'utf8'));
    const lijst = /EIGEN_TAKKEN\s*=\s*\[([\s\S]*?)\]/.exec(b);
    if (lijst) for (const m of lijst[1].matchAll(/'(\w+)'/g)) vergeten.add(m[1]);
    for (const m of b.matchAll(/delete\s+db\.data\.(\w+)\s*\[\s*key\s*\]/g)) vergeten.add(m[1]);
  }
  return { beleid, veger, vergeten };
}

/* Een beleidstermijn in dagen, voor zover hij een getal is. `7 * JAAR / DAG`
   wordt niet uitgerekend; dan blijft `dagen` null en staat de tekst erbij. */
function dagenVan(tekst) {
  return /^\d+$/.test(String(tekst)) ? Number(tekst) : null;
}

function termijnVan(stroom, bronnen) {
  const b = bronnen.beleid[stroom.collectie];
  if (b) return { soort: 'beleid', dagen: dagenVan(b.dagen), tekst: b.dagen, bestand: b.bestand };
  if (bronnen.veger.has(stroom.collectie)) return { soort: 'veger', bestand: 'server/bewaarveger.js' };
  if (stroom.termijn) return { soort: stroom.termijn.soort, bestand: stroom.termijn.bewijs.pad };
  return { soort: 'geen' };
}

/* DE TEGENSPRAAK tussen het voorstel en de gemeten termijn. Dit is waar de
   indeling kan zakken: wie `onbegrensd` voorstelt terwijl het bewaarbeleid een
   termijn noemt, of `venster` zonder dat iets de positie weghaalt, heeft een
   verkeerd voorstel -- of de code is veranderd. */
function tegenspraak(klasse, termijn) {
  if (klasse === 'onbegrensd' && termijn.soort !== 'geen')
    return 'voorgesteld als onbegrensd, maar er is een termijn (' + termijn.soort + ')';
  if (['venster', 'noodzakelijk', 'teLang'].includes(klasse) && termijn.soort === 'geen')
    return 'voorgesteld als ' + klasse + ', maar niets haalt de positie weg';
  if (klasse === 'venster' && termijn.soort === 'beleid' && !(termijn.dagen !== null && termijn.dagen <= 2))
    return 'voorgesteld als venster, maar het bewaarbeleid houdt hem langer dan twee dagen';
  return null;
}

function bestaatCitaat(ref) {
  const bron = lees(ref.pad);
  return bron.length > 0 && bron.includes(ref.citaat);
}

function meet() {
  const kand = kandidaten();
  const bronnen = termijnBronnen();
  const gedekt = new Set(Object.keys(GEEN_STROOM));
  const citaatFouten = [];

  const rijen = STROMEN.map(s => {
    for (const ref of s.bron) {
      gedekt.add(ref.pad);
      if (!bestaatCitaat(ref)) citaatFouten.push({ stroom: s.naam, pad: ref.pad, citaat: ref.citaat });
    }
    if (s.termijn && !bestaatCitaat(s.termijn.bewijs))
      citaatFouten.push({ stroom: s.naam, pad: s.termijn.bewijs.pad, citaat: s.termijn.bewijs.citaat, als: 'termijn' });
    const termijn = termijnVan(s, bronnen);
    const persoonlijk = ['sessiesleutel', 'codenaam', 'handle'].includes(s.sleutel);
    return {
      naam: s.naam,
      wat: s.wat,
      bestanden: [...new Set(s.bron.map(r => r.pad))],
      collectie: s.collectie,
      sleutel: s.sleutel,
      van: s.van,
      termijn,
      /* Alleen voor een stroom op een ledensleutel of codenaam: wist de
         vergeetroute hem? Een medewerker of een boeking loopt langs een andere
         weg, en die kent deze meter niet -- dus daar staat null en geen nee. */
      vergeten: persoonlijk ? bronnen.vergeten.has(s.collectie) : null,
      gedetecteerd: s.bron.some(r => kand.includes(r.pad)),
      klasse: s.klasse,
      status: BESLUITEN[s.naam] ? 'besloten' : 'voorstel',
      besluit: BESLUITEN[s.naam]
        ? Object.assign({}, BESLUITEN[s.naam], { uitgevoerd: BESLUITEN[s.naam].klasse === s.klasse })
        : null,
      tegenspraak: tegenspraak(s.klasse, termijn),
      reden: s.reden || null,
      waarom: s.waarom
    };
  });

  const onverklaard = kand.filter(k => !gedekt.has(k));
  const telling = Object.fromEntries(KLASSEN.map(k => [k, rijen.filter(r => r.klasse === k).length]));

  return {
    graad: 'vermoed',
    hoe: 'lexicaal: de noemer is elk bestand in server/ dat een object met lat en lng/lon bouwt (geen vaste ' +
      'getallen) en iets opslaat; de indeling is per stroom verklaard met een citaat dat letterlijk in de bron ' +
      'moet staan; de termijn komt uit het bewaarbeleid, de bewaarveger en de vergeetroute.',
    grens: 'Dit is de BRON-helft van de grondwetmeter (NAVIGATIE.md par. 6.4). Wat er na een doorloop werkelijk in ' +
      'de opslag staat, meet hij niet -- dat is A0c. Hij telt geen gebruik tijdens een taak als schuld (N11). De ' +
      'klassen zijn VOORSTELLEN en geen besluiten. En de detector ziet geen positie die in losse toewijzingen wordt ' +
      'opgebouwd; die stromen staan er alleen omdat ze met de hand zijn gevonden (nietGedetecteerd).',
    besturing: {
      citaatFouten,
      inOrde: citaatFouten.length === 0,
      wat: 'Elk citaat moet letterlijk in zijn bestand staan. Staat er een niet, dan is een stroom verhuisd of ' +
        'verdwenen, en telt deze meter iets wat hij niet meer ziet.'
    },
    gemeten: {
      kandidaten: kand.length,
      onverklaard: onverklaard.length,
      stromen: rijen.length,
      nietGedetecteerd: rijen.filter(r => !r.gedetecteerd).length,
      tegenspraak: rijen.filter(r => r.tegenspraak).length,
      zonderTermijn: rijen.filter(r => r.termijn.soort === 'geen').length,
      nietVergeten: rijen.filter(r => r.vergeten === false).length,
      besloten: rijen.filter(r => r.besluit !== null).length,
      besluitNietUitgevoerd: rijen.filter(r => r.besluit && !r.besluit.uitgevoerd).map(r => r.naam),
      klassen: telling
    },
    onverklaard,
    rijen
  };
}

if (require.main === module) {
  const uit = meet();
  const g = uit.gemeten;
  console.log('\nPOSITIESTROOM -- waar blijft de positie van een mens?\n');
  console.log('  ' + 'stroom'.padEnd(24) + 'collectie'.padEnd(20) + 'termijn'.padEnd(10) + 'voorstel');
  console.log('  ' + '-'.repeat(66));
  for (const r of uit.rijen) {
    console.log('  ' + r.naam.padEnd(24) + r.collectie.padEnd(20) + r.termijn.soort.padEnd(10) + r.klasse +
      (r.tegenspraak ? '   TEGENSPRAAK: ' + r.tegenspraak : '') + (r.gedetecteerd ? '' : '   (niet gedetecteerd)'));
  }
  console.log('\n  ' + g.stromen + ' stromen uit ' + g.kandidaten + ' kandidaatbestanden; ' + g.zonderTermijn +
    ' zonder termijn, ' + g.nietVergeten + ' op een ledensleutel die de vergeetroute niet wist.');
  console.log('  voorstel: ' + KLASSEN.map(k => k + ' ' + g.klassen[k]).join(', ') + '. Besloten: ' + g.besloten +
    (g.besluitNietUitgevoerd.length ? ', waarvan nog niet uitgevoerd: ' + g.besluitNietUitgevoerd.join(', ') : '') + '.\n');
  let fout = false;
  if (!uit.besturing.inOrde) {
    fout = true;
    console.error('  BESTURINGSPROEF GEZAKT: ' + uit.besturing.citaatFouten.length + ' citaat(en) niet gevonden.');
    for (const c of uit.besturing.citaatFouten) console.error('    ' + c.stroom + '  ' + c.pad + '\n      ' + c.citaat);
  }
  if (g.onverklaard) {
    fout = true;
    console.error('  ONVERKLAARD: ' + g.onverklaard + ' kandidaatbestand(en) zonder stroom of reden:');
    for (const k of uit.onverklaard) console.error('    ' + k);
  }
  if (g.tegenspraak) { fout = true; console.error('  TEGENSPRAAK tussen voorstel en gemeten termijn: ' + g.tegenspraak); }
  if (fout) process.exit(1);
  if (process.argv.includes('--vastleggen')) {
    const poort = eisSchoneBoom('positiestroom');
    if (!poort.ok) { console.error(poort.reden); process.exit(1); }
    fs.writeFileSync(DOEL, JSON.stringify(Object.assign({ stempel: stempel() }, uit), null, 2) + '\n');
    console.log('Vastgelegd in POSITIESTROOM.json\n');
  }
}

module.exports = { meet, schrijftPositie, tegenspraak, termijnBronnen, KLASSEN, STROMEN, GEEN_STROOM, BESLUITEN };
