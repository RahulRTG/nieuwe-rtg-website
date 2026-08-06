/* Payroll OS: DE CONTROLES OP EEN BEREKENDE STROOK.

   Afgesplitst van ./motor.js, dat over de 10 KB ging toen de loonheffingstabel
   erbij kwam. De snede loopt langs de grens die in motor.js al met zoveel
   woorden staat: de motor REKENT, en oordeelt niet. Een strook die onder het
   minimumloon uitkomt moet WEL berekend worden en dan een waarschuwing geven,
   niet stilletjes worden opgehoogd -- wie het bedrag aanpast zonder het te
   melden, verbergt precies waar naar gekeken moet worden. */
'use strict';

/* De controlelaag hoort niet in de berekening zelf: een strook die onder het
   minimumloon uitkomt moet WEL berekend worden en dan een waarschuwing geven,
   niet stilletjes worden opgehoogd. Wie het bedrag aanpast zonder het te
   melden, verbergt precies waar naar gekeken moet worden. */
function controleer(strook, { regelpakket, leeftijdsgroep, gewerkteUren }) {
  const waarschuwingen = [];
  if (strook.nettoCenten < 0)
    waarschuwingen.push({ ernst: 'hoog', soort: 'negatief_netto', uitleg: 'Het nettoloon is negatief.' });

  const min = ((regelpakket.regels || {}).minimumUurloon || {})[leeftijdsgroep || '21+'];
  if (typeof min === 'number' && gewerkteUren > 0) {
    const feitelijk = strook.brutoCenten / gewerkteUren;
    if (feitelijk < min) waarschuwingen.push({ ernst: 'hoog', soort: 'onder_minimumloon',
      uitleg: 'Het feitelijke uurloon (' + Math.round(feitelijk) + ' cent) ligt onder het minimumuurloon (' + min + ' cent).',
      regel: 'minimumUurloon.' + (leeftijdsgroep || '21+'), versie: regelpakket.versie });
  }
  if (regelpakket.stand !== 'goedgekeurd')
    waarschuwingen.push({ ernst: 'hoog', soort: 'ongecontroleerd_regelpakket',
      uitleg: 'Deze berekening draait op regelpakket ' + regelpakket.versie + ', dat nog niet is aangemerkt. Niet geschikt voor een definitieve loonrun.' });
  return waarschuwingen;
}

module.exports = { controleer };
