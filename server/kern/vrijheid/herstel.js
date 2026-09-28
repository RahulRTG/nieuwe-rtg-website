/* VRIJHEID: HERSTELTIJD -- RECOVERY RELEASE.

   Een menselijk besluit na een zware periode, op een signaal uit het ROOSTER
   (rust.js) en nooit uit de mens. Het is geen beloning voor overwerken en wordt
   daarom nooit automatisch gegeven: zonder roostersignaal geen hersteltijd, en
   niemand kent het zichzelf toe. Wordt het vaak nodig, dan is de vraag waarom
   het werk structureel te zwaar is -- dat is een vraag aan de organisatie. */
'use strict';
const T = require('./tijd');
const { herstelSignaal } = require('./rust');

module.exports = (ctx) => {
  const { org, id, fout, bewaar, zend, teamKlopt, boek } = ctx;

  function herstelRelease(code, team, { persoon, datum, door, beleid }) {
    if (!teamKlopt(code, team)) return fout(403, 'Dit teambeeld hoort niet bij deze organisatie.');
    if (!(team.managers || []).includes(door) || door === persoon) return fout(403, 'Hersteltijd wordt door een leidinggevende toegekend, niet door uzelf.');
    const sig = herstelSignaal(team, persoon, datum, beleid);
    if (sig.stand !== 'REST_RISK') return fout(409, 'Er is geen herstelsignaal uit het rooster: ' + sig.uitleg);
    const d = (team.diensten || []).find(x => x.persoon === persoon && x.datum === datum && T.interval(x));
    if (!d) return fout(409, 'Op ' + datum + ' staat geen dienst om vrij te geven.');
    const iv = T.interval(d);
    const rid = id('hr', code, persoon, datum);
    if (org(code).boekingen.some(b => b.id === rid)) return fout(409, 'Deze hersteltijd is al toegekend.');
    const afw = { persoon, van: iv.van, tot: iv.tot };
    boek(code, rid, { categorie: 'RECOVERY_RELEASE', uren: T.uren(iv), datum, persoon, betaaldeUren: T.uren(iv) }, afw);
    zend('RECOVERY_RELEASE_GRANTED', { organisatie: code, id: rid });
    bewaar();
    return { ok: true, id: rid, grond: sig.uitleg, tekst: 'Een betaalde dag rust. Uw verlofsaldo verandert niet.' };
  }

  return { herstelRelease };
};
