/* CONCERN (deelmodule): WIE is die bestuurder of gevolmachtigde?

   Een bestuurder stond hier als vrije tekst ("marco"). Voor het register is dat
   genoeg; voor een TEKENGRENS niet. Het Werk OS neemt sinds 23 september 2026 de
   strengste van twee grenzen (bedrijf/uitgave.js): die van het lid in de
   werkruimte en die van dezelfde mens als bestuurder of gevolmachtigde van de
   entiteit. Dat kan alleen als "dezelfde mens" vaststaat, en een vrije naam
   vergelijken met een codenaam is raden.

   DUS DEZELFDE VORM ALS ../onderneming/bestuur-persoon.js: een RTG-lid op zijn
   codenaam, OF uitdrukkelijk iemand van buiten RTG. Nooit stil een vrije naam.
   De codenaam wordt de sleutel van het feit (de canonieke schrijfwijze uit de
   gids); de accountsleutel komt nergens in de operationele data. Een externe
   bestuurder blijft gewoon in het register staan, maar telt voor een tekengrens
   in het Werk OS niet mee: er is niemand in een werkruimte die hij kan zijn.

   Alleen voor de soorten die een tekenlimiet dragen. Een aandeelhouder mag een
   vrije naam blijven: een belang zegt niets over wie mag tekenen. */
'use strict';

const MET_PERSOON = ['bestuurder', 'volmacht'];

async function duidBestuurder(soort, body, keyVanCodenaam) {
  if (!MET_PERSOON.includes(String(soort || ''))) return { ok: true, body };
  const b = body || {};
  const naam = String(b.sleutel || '').trim().slice(0, 60);
  if (naam.length < 2) return { status: 400, error: 'Geef de codenaam van de ' + soort + ' op.' };
  if (b.extern === true) {
    return { ok: true, body: Object.assign({}, b, { sleutel: naam,
      extra: Object.assign({}, b.extra || {}, { extern: true }) }) };
  }
  let lid = null;
  try { lid = typeof keyVanCodenaam === 'function' ? await keyVanCodenaam(naam) : null; } catch (e) { lid = null; }
  if (!lid || !lid.key) return { status: 404,
    error: 'Wij kennen geen RTG-lid met de codenaam "' + naam + '".',
    uitleg: 'Klopt de codenaam? Verbeter hem dan. Gaat het om iemand van buiten RTG, geef dat dan aan (extern); ' +
      'die staat dan in het register, maar telt niet mee voor een tekengrens in het Werk OS.' };
  return { ok: true, body: Object.assign({}, b, { sleutel: lid.codename || naam,
    extra: Object.assign({}, b.extra || {}, { extern: false }) }) };
}

module.exports = { duidBestuurder, MET_PERSOON };
