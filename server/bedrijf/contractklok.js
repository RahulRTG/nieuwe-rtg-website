/* DE KLOK VAN EEN CONTRACT, als losse rekenkern.

   Stond in ./contract.js, ingesloten in de router-context. Het Ondernemers-OS
   (kern/onderneming/contracten.js) heeft dezelfde klok nodig om zijn dagbeeld
   te kunnen vullen, en die zou hij anders moeten overtypen -- precies de
   tweede waarheid die deze klok juist voorkomt (lat-regel 4).

   Waarom hij bestaat, ongewijzigd uit de kop van contract.js: contracten gaan
   bijna nooit mis op de inhoud maar op de DATUM. Een opzegtermijn die twee
   weken geleden verstreek, een verzekering die stil afliep. De laatste
   opzegdag wordt daarom UITGEREKEND uit de einddatum en de opzegtermijn, en
   nooit met de hand ingevuld: een datum die iemand overtypt, is een datum die
   een keer fout staat.

   `vandaag` komt binnen als 'JJJJ-MM-DD'. Als parameter en niet uit de klok
   van de machine, zodat een toets een dag kan kiezen -- een klok die je niet
   kunt zetten, is een klok die je niet kunt toetsen. */
'use strict';

const DAG = 86400000;

const dagenTot = (d, vandaag) => Math.round((Date.parse(d) - Date.parse(vandaag)) / DAG);
const minDagen = (d, n) => new Date(Date.parse(d) - n * DAG).toISOString().slice(0, 10);

function klok(c, vandaag) {
  if (!c || !c.eindigt) {
    return { stand: 'zonder einddatum',
      let: 'Een contract zonder einddatum loopt door tot iemand er iets van vindt.' };
  }
  const laatsteOpzegdag = c.opzegtermijnDagen ? minDagen(c.eindigt, c.opzegtermijnDagen) : c.eindigt;
  const dagenEinde = dagenTot(c.eindigt, vandaag);
  const dagenOpzeg = dagenTot(laatsteOpzegdag, vandaag);
  return {
    laatsteOpzegdag, dagenTotEinde: dagenEinde, dagenTotOpzegdag: dagenOpzeg,
    stand: dagenEinde < 0 ? 'verlopen'
      : (dagenOpzeg < 0 && c.stilzwijgend ? 'stilzwijgend verlengd (opzegdag voorbij)'
        : (dagenOpzeg <= 30 ? 'opzegtermijn loopt af' : 'loopt')),
    let: c.stilzwijgend
      ? 'Deze verlengt stilzwijgend. De laatste opzegdag is uitgerekend uit de einddatum en de opzegtermijn; hij staat nergens overgetypt.'
      : null
  };
}

module.exports = { klok, dagenTot, minDagen, DAG };
