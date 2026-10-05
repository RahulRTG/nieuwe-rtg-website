/* DE KETEN VAN EEN DRAGER: wat roteren en vernieuwen delen.

   Beide maken een nieuwe code en trekken de oude in. De nieuwe draagt het
   volgnummer en de geschiedenis van de oude, zodat achteraf te lezen is wie,
   wanneer en waarom. Dat stond op twaalf plekken met de hand (regel 74 van
   scripts/check.js) en staat nu hier.

   Het verschil tussen de twee werkwoorden zit NIET hier maar in wat de nieuwe
   code mag (kern/bearercode-v2.js):
     roteer    zelfde termijn, zelfde gebruik: de houder krijgt een verse code
               omdat de oude gelekt kan zijn. Het einde komt nooit later.
     vernieuw  een NIEUWE uitgifte door een mens op naam, met een eigen termijn.
               Doel en uitgever blijven; wie iets anders wil, geeft iets anders uit. */
'use strict';

const GESCHIEDENIS_MAX = 20;

function keten({ oud, nieuw, intrekken, actor, soort, nu }) {
  const t = nieuw.toegang;
  t.rotatie = (Number(oud.rotatie) || 1) + 1;
  t.geschiedenis = [].concat(oud.geschiedenis || [], [{ rotatie: oud.rotatie || 1, soort,
    geroteerd_at: nu, door: String(actor || 'onbekend').slice(0, 100), einde_was: oud.expires_at || null }])
    .slice(-GESCHIEDENIS_MAX);
  intrekken(oud, actor, soort);
  return nieuw;
}

module.exports = { keten, GESCHIEDENIS_MAX };
