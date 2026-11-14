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

   2. DE CHECKSUM IS ONGEZOUTEN, anders dan lib/vingerafdruk.js: die zout per
      proces omdat hij alleen mag tonen DAT er iets veranderde. Een catalogus
      moet juist elders en later na te rekenen zijn. Tegengestelde eisen, dus
      geen gedeelde code.

   3. INLEZEN MAAKT ALTIJD EEN NIEUWE WERKRUIMTE. Een herstel dat kan
      overschrijven is een wapen zodra iemand het verkeerde bestand kiest. De
      leden komen terug ZONDER sleutel: toegang teruggeven is een besluit.
   ========================================================================== */
'use strict';

const { sluit, maak: maakSleutels } = require('../../bedrijf/sleutels');
const sleutels = maakSleutels();
const { datum: klokDatum } = require('../../lib/klok');

const crypto = require('crypto');

const VERSIE = 1;
const { GEHEIM, KOPVELDEN, zonderGeheim, reisverklaring, herstelInhoud } = require('./uitgang-grens');

/* Canonieke JSON: sleutels op volgorde, zodat dezelfde inhoud op elke machine
   dezelfde tekst en dus dezelfde checksum geeft. JSON.stringify houdt de
   invoegvolgorde aan, en die verschilt zodra een migratie een veld opnieuw zet. */
function canoniek(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(canoniek).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canoniek(v[k])).join(',') + '}';
}
const som = (v) => crypto.createHash('sha256').update(canoniek(v)).digest('hex');

const tel = (v) => (Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : (v == null ? 0 : 1)));

module.exports = ({ db, save, crypto: crypt, register, merkVan }) => {
  const opslag = require('./opslag')({ db }); // de deur naar de werkruimtes
  const munt = crypt || crypto;
  const PRODUCTIE = String(process.env.NODE_ENV || '') === 'production';
  function ruimte(code) {
    const w = opslag.werkruimtesKijk();
    return Object.prototype.hasOwnProperty.call(w, String(code)) ? w[String(code)] : null;
  }

  /* De catalogus: per top-sleutel een aantal en een checksum. Hij staat NAAST
     de inhoud en niet eroverheen: wie de uitvoer krijgt rekent hem na zonder
     onze code te hebben. */
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
    // Deze gereserveerde scopeverklaring wordt berekend, nooit uit een import vertrouwd.
    inhoud.reisketenUitgang = reisverklaring();

    const kop = {};
    for (const k of KOPVELDEN) kop[k] = schoon[k] == null ? null : schoon[k];

    const cat = catalogus(inhoud);
    const uitvoer = {
      versie: VERSIE,
      status: 'gedeeltelijk',
      at: (opties && opties.at) || klokDatum().toISOString(),
      tenant: t ? { org: t.org, naam: t.naam, modus: t.modus } : null,
      merk: t && merkVan ? merkVan(t.org) : null,
      werkruimte: kop,
      inhoud,
      catalogus: cat,
      checksum: som(cat),
      /* HET RECEPT REIST MEE, en niet als beleefdheid: een checksum die alleen
         wij kunnen narekenen bewijst de vertrekkende partij niets. Met deze
         twee regels rekent zij hem zelf na, zonder ons te geloven. */
      recept: 'checksum per soort = sha256(canonieke JSON van die soort); ' +
        'checksum van de uitvoer = sha256(canonieke JSON van de catalogus). ' +
        'Canoniek = JSON met de sleutels van elk object alfabetisch gesorteerd, zonder witruimte.',
      let: 'Dit is de inhoud van deze werkruimte, met de sleutels eruit (' + GEHEIM.join(', ') + '). ' +
        'De uitvoer is gedeeltelijk: tenantbrede reiscontracten en leverancieropdrachten vallen buiten de bewezen werkruimtebevoegdheid. ' +
        'Dit is geen volledige tenant- of reisexport. De begrenzing staat checksum-gedekt in reisketenUitgang. ' +
        'Reken de catalogus na met het recept hierboven; wij hoeven daar niet bij te zijn.'
    };
    return { ok: true, uitvoer };
  }

  /* Klopt een uitvoer met zichzelf? Los aanroepbaar, want dit is de vraag die
     de ontvanger stelt en niet alleen wij. */
  function controleer(uitvoer) {
    return require('./uitgang-validatie').controleer(uitvoer, { versie: VERSIE, catalogus, som });
  }

  /* Inlezen. Altijd een NIEUWE werkruimte, met een nieuw beheer-token, en de
     leden zonder sleutel. Wie na een herstel weer naar binnen moet, wordt door
     een mens toegelaten -- precies zoals bij een gewone aanmelding. */
  function lees(uitvoer, opties) {
    const c = controleer(uitvoer);
    if (!c.ok) return { error: c.reden, status: 400 };
    const o = opties || {};
    if (o.naam != null && typeof o.naam !== 'string')
      return { error: 'De naam van de nieuwe werkruimte moet tekst zijn.', status: 400 };
    const W = opslag.werkruimtes();
    let code; do { code = 'W' + munt.randomBytes(3).toString('hex').toUpperCase().slice(0, 5); } while (W[code]);

    const kop = uitvoer.werkruimte || {};
    const w = { code, naam: o.naam || kop.naam || 'Herstelde werkruimte',
      land: kop.land || 'NL', valuta: kop.valuta || 'EUR', taal: kop.taal || 'nl',
      moeder: null, kvk: kop.kvk || null, btwNummer: kop.btwNummer || null,
      at: klokDatum().toISOString() };
    /* Een checksum bewijst samenhang, geen betrouwbare afzender. Ook een
       zelf nagerekend importbestand mag dus geen RTG-koppeling of oude sleutel
       herstellen, en de inhoud mag de NIEUWE code/moedergrens niet vervangen. */
    herstelInhoud(w, uitvoer.inhoud);

    w.leden = w.leden || {};
    for (const l of Object.values(w.leden)) sluit(l);
    const beheerToken = PRODUCTIE ? null : sleutels.geefBeheer(w);
    W[code] = w;
    save();
    const antwoord = { ok: true, werkruimte: code, catalogus: c.catalogus,
      let: 'De leden zijn hersteld ZONDER sleutel: toegang teruggeven is een besluit en geen bijwerking van een herstel. ' +
        'De moederwerkruimte reist niet mee -- die verwijst naar een code die hier niet hoeft te bestaan. ' +
        'Deze gedeeltelijke werkruimte-invoer activeert geen reiscontracten, leveranciersacceptaties of betaalbewijzen.' };
    if (!PRODUCTIE) antwoord.beheerToken = beheerToken;
    return antwoord;
  }

  /* De leesbare vorm staat in een eigen bestand: hij is een OVERZICHT en geen
     tweede uitvoer, en die twee door elkaar laten lopen is precies hoe er twee
     waarheden ontstaan. */
  const leesbaar = (uitvoer) => require('./uitgang-leesbaar').maak(uitvoer);

  const reisarchief = archief => require('./uitgang-reis').maak({ archief, catalogus, som, versie: VERSIE });
  return { exporteer, controleer, lees, leesbaar, reisarchief, catalogus, som, canoniek, GEHEIM, VERSIE };
};
