/* API-routes die bewust nooit achter een functieschakelaar staan.

   Dit is de herstel- en rechtenlaag: de eigenaar moet de kast kunnen bereiken,
   monitoring moet een eerlijke stand blijven geven en wettelijke privacyknoppen
   mogen niet door RTG worden uitgezet. Zowel de statische dekkingsmeting als de
   live code-inventaris lezen deze ene lijst. */
'use strict';

const REDENEN = [
  ['/api/techniek', 'het techniekbord zelf: de herstelknoppen mogen niet achter een knop'],
  ['/api/boardroom', 'de schakelkast zelf: anders sluit de eigenaar zichzelf buiten'],
  ['/api/health', 'de gezondheidscheck moet altijd antwoorden voor externe bewaking'],
  ['/api/ready', 'de startsignalering van de load balancer moet altijd antwoorden'],
  ['/api/privacy', 'inzage, export en verwijdering zijn AVG-rechten en niet uitschakelbaar'],
  ['/api/toestemming', 'toestemming intrekken is een recht en niet uitschakelbaar'],
  ['/api/toestel/meting', 'de toestelsleutel wordt door het lid zelf ingetrokken'],
  ['/api/metrics', 'de meetlijn mag bij een incident niet blind worden gemaakt'],
  ['/api/cluster', 'de clusterlaag bestuurt instances en blijft buiten een instance-schakelaar'],
  ['/api/sat', 'de satellietping voorkomt dat een zaakdoos gezond verkeer als offline leest'],
  ['/api/test', 'de testhaak bestaat alleen in demostand en is geen productdienst']
];

const BUITEN = new Map(REDENEN);
function redenVoor(pad) {
  for (const [prefix, reden] of BUITEN) if (pad === prefix || pad.startsWith(prefix + '/')) return reden;
  return null;
}

module.exports = { BUITEN, redenVoor };
