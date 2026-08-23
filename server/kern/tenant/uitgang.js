/* ============================================================================
   DE UITGANG -- alles meenemen, en aantoonbaar weer naar binnen kunnen.

   Exit-recht is de eis waar een inkoper een verkoop op stukmaakt, en hij is
   niet af met een knop die JSON teruggeeft. Wat hij vraagt is: kan deze
   organisatie weg bij jullie zonder haar geschiedenis te verliezen? Dat is een
   bewering die je alleen waarmaakt door de uitvoer WEER IN TE LEZEN en aan te
   tonen dat er hetzelfde uit komt.

   DRIE KEUZES DIE DE HELE LAAG DRAGEN

   1. DE EXPORT NEEMT DE HELE SUBBOOM MEE, met een lijst van wat er UIT moet --
      niet een lijst van wat erin mag. Dat is de omgekeerde richting van hoe je
      een API-antwoord bouwt, en met opzet: een soort die iemand vergeet toe te
      voegen, ontbreekt dan stilzwijgend in de export van een vertrekkende
      klant, en dat merkt niemand tot het te laat is. Wat er niet in mag staat
      met naam in GEHEIM, en een toets rekent af dat geen enkel geheim uit de
      opstelling in de uitvoer voorkomt.

   2. DE CHECKSUM IS ONGEZOUTEN, en dat is precies het verschil met
      lib/vingerafdruk.js. Die zout per PROCES, omdat hij van buiten alleen mag
      tonen DAT er iets veranderde. Een exportcatalogus moet juist op een andere
      machine, in een ander jaar, door een andere partij na te rekenen zijn.
      Twee instrumenten met tegengestelde eisen; ze delen daarom geen code.

   3. INLEZEN MAAKT ALTIJD EEN NIEUWE WERKRUIMTE, en nooit over een bestaande
      heen. Een herstel dat kan overschrijven is een wapen zodra iemand het
      verkeerde bestand kiest. En de leden komen terug ZONDER sleutel: toegang
      teruggeven is een besluit van een mens, geen bijwerking van een herstel.
   ========================================================================== */
'use strict';

const crypto = require('crypto');

const VERSIE = 1;

/* Wat er nooit in een uitvoer terechtkomt, op NAAM en niet op een patroon.
   `rtgKey` staat er niet vanwege geheimhouding maar vanwege het
   codenaam-ontwerp: hij legt buiten de kluis om een verband tussen een
   werkruimtelid en een RTG-account, en om die reden staat hij ook in de
   VERBORGEN-lijst van kern/command/object.js. Op naam en recursief, dus ook
   een sleutel die morgen ergens dieper opduikt gaat eruit -- te veel weghalen
   is hier de goede kant om fout te gaan. */
const GEHEIM = ['beheerToken', 'token', 'lidToken', 'rtgKey'];

/* Metadata van de werkruimte zelf: die staat in de kop van de uitvoer en hoeft
   niet nog een keer in de inhoud. */
const KOPVELDEN = ['code', 'naam', 'land', 'valuta', 'taal', 'moeder', 'kvk', 'btwNummer', 'at'];

/* Canonieke JSON: sleutels op volgorde, zodat dezelfde inhoud op elke machine
   dezelfde tekst en dus dezelfde checksum geeft. JSON.stringify houdt de
   invoegvolgorde aan, en die verschilt zodra een migratie een veld opnieuw zet. */
function canoniek(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(canoniek).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canoniek(v[k])).join(',') + '}';
}
const som = (v) => crypto.createHash('sha256').update(canoniek(v)).digest('hex');

function zonderGeheim(v) {
  if (Array.isArray(v)) return v.map(zonderGeheim);
  if (v && typeof v === 'object') {
    const uit = {};
    for (const k of Object.keys(v)) { if (!GEHEIM.includes(k)) uit[k] = zonderGeheim(v[k]); }
    return uit;
  }
  return v;
}

const tel = (v) => (Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : (v == null ? 0 : 1)));

module.exports = ({ db, save, crypto: crypt, register, merkVan }) => {
  const munt = crypt || crypto;
  function ruimte(code) {
    const w = db.data.werkruimtes || {};
    return Object.prototype.hasOwnProperty.call(w, String(code)) ? w[String(code)] : null;
  }

  /* De catalogus: per top-sleutel een aantal en een checksum. Hij staat NAAST
     de inhoud en niet eroverheen -- wie de uitvoer krijgt kan hem zo narekenen
     zonder onze code te hebben. */
  function catalogus(inhoud) {
    return Object.keys(inhoud).sort().map(soort => ({ soort, aantal: tel(inhoud[soort]), checksum: som(inhoud[soort]) }));
  }

  function exporteer(code, opties) {
    const w = ruimte(code);
    if (!w) return { error: 'Die werkruimte kennen we niet.', status: 404 };
    const t = register.vanWerkruimte(code);

    const schoon = zonderGeheim(w);
    const inhoud = {};
    for (const k of Object.keys(schoon)) { if (!KOPVELDEN.includes(k)) inhoud[k] = schoon[k]; }

    const kop = {};
    for (const k of KOPVELDEN) kop[k] = schoon[k] == null ? null : schoon[k];

    const cat = catalogus(inhoud);
    const uitvoer = {
      versie: VERSIE,
      at: (opties && opties.at) || new Date().toISOString(),
      tenant: t ? { org: t.org, naam: t.naam, modus: t.modus } : null,
      merk: t && merkVan ? merkVan(t.org) : null,
      werkruimte: kop,
      inhoud,
      catalogus: cat,
      checksum: som(cat),
      /* HET RECEPT REIST MEE, en niet als beleefdheid: een checksum die alleen
         wij kunnen narekenen is geen bewijs voor de partij die vertrekt. Met
         deze twee regels rekent zij hem zelf na, zonder onze code en zonder
         ons te hoeven geloven. */
      recept: 'checksum per soort = sha256(canonieke JSON van die soort); ' +
        'checksum van de uitvoer = sha256(canonieke JSON van de catalogus). ' +
        'Canoniek = JSON met de sleutels van elk object alfabetisch gesorteerd, zonder witruimte.',
      let: 'Dit is de volledige inhoud van deze werkruimte, met de sleutels eruit (' + GEHEIM.join(', ') + '). ' +
        'Reken de catalogus na met het recept hierboven; wij hoeven daar niet bij te zijn.'
    };
    return { ok: true, uitvoer };
  }

  /* Klopt een uitvoer met zichzelf? Los aanroepbaar, want dit is de vraag die
     de ontvanger stelt en niet alleen wij. */
  function controleer(uitvoer) {
    const u = uitvoer;
    if (!u || typeof u !== 'object') return { ok: false, reden: 'Geen uitvoer meegegeven.' };
    if (u.versie !== VERSIE) return { ok: false, reden: 'Onbekende uitvoerversie: ' + u.versie + '.' };
    if (!u.inhoud || typeof u.inhoud !== 'object') return { ok: false, reden: 'De uitvoer draagt geen inhoud.' };
    /* DE VOLGORDE IS HIER HET ANTWOORD, en dat is bij het bouwen misgegaan.
       Eerst de totale checksum leggen betekent dat elke afwijking als "de
       catalogus komt niet overeen met de inhoud" naar buiten komt -- waar
       staat, weet de ontvanger dan nog niet, en die zit met een bestand van
       tientallen megabytes. Dus eerst PER SOORT, want daar staat het, en pas
       daarna de totale som (die vangt een catalogus die zelf is bijgewerkt om
       een wijziging te dekken). */
    const opnieuw = catalogus(u.inhoud);
    const was = new Map((u.catalogus || []).map(r => [r.soort, r.checksum]));
    const nu = new Map(opnieuw.map(r => [r.soort, r.checksum]));
    const ontbreekt = [...was.keys()].filter(k => !nu.has(k));
    const erbij = [...nu.keys()].filter(k => !was.has(k));
    const anders = opnieuw.filter(r => was.has(r.soort) && was.get(r.soort) !== r.checksum).map(r => r.soort);
    const scheef = [...anders, ...ontbreekt.map(k => k + ' (weg)'), ...erbij.map(k => k + ' (erbij)')];
    if (scheef.length) return { ok: false, reden: 'Deze soorten kloppen niet met de catalogus: ' + scheef.join(', ') + '.' };
    if (som(u.catalogus || []) !== u.checksum)
      return { ok: false, reden: 'De catalogus klopt met de inhoud, maar de eindsom van de uitvoer niet -- de catalogus zelf is aangeraakt.' };
    return { ok: true, catalogus: opnieuw };
  }

  /* Inlezen. Altijd een NIEUWE werkruimte, met een nieuw beheer-token, en de
     leden zonder sleutel. Wie na een herstel weer naar binnen moet, wordt door
     een mens toegelaten -- precies zoals bij een gewone aanmelding. */
  function lees(uitvoer, opties) {
    const c = controleer(uitvoer);
    if (!c.ok) return { error: c.reden, status: 400 };
    const o = opties || {};
    const W = (db.data.werkruimtes = db.data.werkruimtes || {});
    let code; do { code = 'W' + munt.randomBytes(3).toString('hex').toUpperCase().slice(0, 5); } while (W[code]);

    const kop = uitvoer.werkruimte || {};
    const w = { code, naam: o.naam || kop.naam || 'Herstelde werkruimte',
      land: kop.land || 'NL', valuta: kop.valuta || 'EUR', taal: kop.taal || 'nl',
      moeder: null, kvk: kop.kvk || null, btwNummer: kop.btwNummer || null,
      beheerToken: munt.randomBytes(24).toString('hex'), at: new Date().toISOString() };
    for (const k of Object.keys(uitvoer.inhoud)) w[k] = JSON.parse(JSON.stringify(uitvoer.inhoud[k]));

    w.leden = w.leden || {};
    for (const l of Object.values(w.leden)) { l.token = null; }
    W[code] = w;
    save();
    return { ok: true, werkruimte: code, beheerToken: w.beheerToken, catalogus: c.catalogus,
      let: 'De leden zijn hersteld ZONDER sleutel: toegang teruggeven is een besluit en geen bijwerking van een herstel. ' +
        'De moederwerkruimte reist niet mee -- die verwijst naar een code die hier niet hoeft te bestaan.' };
  }

  return { exporteer, controleer, lees, catalogus, som, canoniek, GEHEIM, VERSIE };
};
