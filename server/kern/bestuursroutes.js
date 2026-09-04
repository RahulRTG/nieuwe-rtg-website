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
  ['/api/inzagekaart', 'zien wie in uw gegevens keek is hetzelfde AVG-recht; een knop die dat dichtzet hoort niet te bestaan'],
  ['/api/toestel/meting', 'de toestelsleutel wordt door het lid zelf ingetrokken'],
  /* De ledenkant van de isolatiemodus. NIET het bredere `/api/isolatie`: het
     kantoorpad valt al onder /api/techniek hierboven, en een toekomstige
     /api/isolatie/<iets anders> hoort een eigen besluit te vragen in plaats van
     er gratis onder te vallen -- een te brede prefix is precies de sluipweg die
     dit gat maakte. */
  ['/api/isolatie/mijn', 'de uitgang van de stand zelf: een lid dat zichzelf heeft dichtgezet moet er ' +
    'langs de ceremonie weer uit kunnen, en een schakelaar daarop is een val'],
  /* MIJN RTG (MIJNRTG.md). Vier prefixen en geen blanco '/api/mijn': een blanco
     regel zou ook toekomstige routes onder dat pad meenemen die GEEN recht zijn,
     en dan is de uitzondering een achterdeur in plaats van een besluit. */
  ['/api/mijn/gegevens', 'wat RTG van u weet inzien is hetzelfde AVG-recht als /api/inzagekaart'],
  ['/api/mijn/post', 'de commerciele opt-in is toestemming, en toestemming intrekken is een recht'],
  ['/api/mijn/tweefactor', 'uw tweede factor aanzetten is uw eigen beveiliging; een knop waarmee RTG hem uitzet helpt alleen een aanvaller'],
  ['/api/mijn/sessies', 'een gekaapte sessie zelf kunnen sluiten is een noodrem en geen product'],
  ['/api/mijn/herstelkanaal', 'idem: het kanaal waarmee u zichzelf terugkrijgt hoort niet uitschakelbaar te zijn'],
  ['/api/mijn/toestel', 'de toestelbinding is dezelfde eigen beveiliging als /api/toestel/meting hierboven'],
  ['/api/metrics', 'de meetlijn mag bij een incident niet blind worden gemaakt'],
  ['/api/cluster', 'de clusterlaag bestuurt instances en blijft buiten een instance-schakelaar'],
  ['/api/sat', 'de satellietping voorkomt dat een zaakdoos gezond verkeer als offline leest'],
  ['/api/test', 'de testhaak bestaat alleen in demostand en is geen productdienst'],
  /* DE ZWARE POORT EN HET HERSTEL VAN HET EIGENAARSACCOUNT (EIGENAAR.md).
     Deze horen NIET aan een functieschakelaar: het zijn de sloten op de
     bediening zelf. Een schakelaar die de bevestiging van een
     eigendomsoverdracht kan uitzetten, is de eerste knop waar iemand die
     binnen is naar zoekt. De herstelWEG is wel schakelbaar (functie
     `eigenaarherstel`) -- dat is een uitgang en geen slot. */
  ['/api/techniek/bevestig/opties', 'het loket dat een zware bevestiging start; uitschakelbaar maken zou de bevestiging zelf uitschakelbaar maken'],
  ['/api/office/boardroom/bevestig/opties', 'hetzelfde loket achter de boardroomdeur, en om dezelfde reden geen schakelaar'],
  ['/api/techniek/herstel', 'het inrichten, aflezen en AFBREKEN van een herstelquorum is bediening: afbreken moet altijd kunnen, ook als het huis half uitstaat']
];

const BUITEN = new Map(REDENEN);
function redenVoor(pad) {
  for (const [prefix, reden] of BUITEN) if (pad === prefix || pad.startsWith(prefix + '/')) return reden;
  return null;
}

module.exports = { BUITEN, redenVoor };
