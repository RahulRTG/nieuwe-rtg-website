/* RTG Evening OS (kern): de klok van een avond, en de tijdlijn die eruit volgt.
   Geknipt uit ./plan.js toen dat over de 10 kB ging; de knip loopt op een
   onderwerpgrens, want dit is de enige plek in de avondlaag waar met TIJD wordt
   gerekend en niet met geld of met staten.

   DE KNIP OP 04:00 IS HET HELE PUNT VAN DIT BESTAND. Een avond loopt over
   middernacht heen. Zou je tijd gewoon als minuten sinds middernacht lezen, dan
   ligt "thuis om 00:30" altijd vóór "beginnen om 19:00" en weigert de planner
   elk plan dat na twaalven doorloopt. Alles vóór 04:00 hoort dus bij de avond
   ervóór; die grens ligt waar een avond in de praktijk eindigt en niet op een
   rond getal.

   EN DE TIJDLIJN WEIGERT ECHT. Een plan dat later eindigt dan het tijdstip
   waarop je thuis wilde zijn, wordt niet "krap" genoemd maar geweigerd, met
   hoeveel minuten het te laat is. Dat getal gaat mee naar de gast: een grens
   zonder bedrag is geen grens maar een gevoel. */
'use strict';

const KNIP = 4 * 60;

/* Tijd in minuten sinds middernacht, met de nacht erna erbij opgeteld. */
function min(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ''));
  if (!m) return null;
  const v = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return v < KNIP ? v + 24 * 60 : v;
}

const klok = (v) => String(Math.floor((v % (24 * 60)) / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');

/* De stappen op de klok zetten. Elke stap begint nadat de vorige is afgelopen,
   met de reistijd ertussen; heeft een stap een eigen tijd, dan wordt daarop
   gewacht en staat die wachttijd erbij. */
function tijdlijn(stappen, { start, thuisOm }) {
  let t = min(start);
  if (t == null) return { fout: 'Hoe laat wil je beginnen?' };
  const rijen = [];
  for (const s of stappen) {
    t += s.reisMin;
    const begin = s.van != null && min(s.van) != null ? Math.max(t, min(s.van)) : t;
    const eind = begin + s.duurMin;
    rijen.push({ id: s.id, soort: s.soort, titel: s.titel, van: klok(begin), tot: klok(eind),
      reisMin: s.reisMin, wachtMin: begin - t });
    t = eind;
  }
  const grens = min(thuisOm);
  if (grens != null && t > grens) {
    return { fout: 'Dit plan loopt tot ' + klok(t) + ' en je wilde om ' + klok(grens) + ' thuis zijn.',
      teLaatMin: t - grens, rijen };
  }
  return { rijen, eindigt: klok(t), ruimteMin: grens == null ? null : grens - t };
}

module.exports = { KNIP, min, klok, tijdlijn };
