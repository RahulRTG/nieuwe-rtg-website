/* RTG School: belasting -- de donderdag van de leerling, en de week van de docent.

   Zes docenten geven onafhankelijk huiswerk, en niemand ziet de donderdag van
   het kind. Dat is geen kwade wil maar een blinde vlek: iedereen kijkt naar
   zijn eigen vak. Deze laag telt over de vakken en de klassen heen, zodat de
   opeenhoping zichtbaar wordt bij degene die er iets aan kan doen.

   DIT IS WERKDRUKHULP EN GEEN PRESTATIEMETER. Grens 8 uit SCHOOL.md: er komt
   geen productiviteitscijfer per docent, geen ranglijst, en geen veld waarin
   iemand aan een score hangt. Wat hier staat is een telling van wat er op een
   dag samenkomt -- en er wordt niets van bewaard, dus er kan later ook geen
   geschiedenis van "hoe snel werkt deze docent zijn stapel weg" uit groeien.

   EEN DRUKKE DAG IS EEN SIGNAAL AAN WIE HET WERK ZET, NIET AAN HET KIND. Er
   gaat geen melding naar een leerling dat hij het te druk heeft; dat zou de
   last verplaatsen naar degene die er niets over te zeggen heeft.

   WAT DEZE MODULE NIET ZIET. Ze krijgt per stuk werk vier dingen: de dag, de
   soort, het vak, en of het uit de eigen klas komt. Geen titel, geen naam, geen
   leerling. Dat is met opzet: een docent die de donderdag van zijn klas
   bekijkt, hoort te zien DAT er twee dingen uit een andere klas op vallen -- en
   niet wat een collega precies heeft opgegeven. */
const DREMPEL = 3;
const DAGEN = 14;

const dagVan = (iso) => String(iso || '').slice(0, 10);
const plus = (datum, n) => new Date(Date.parse(datum + 'T00:00:00.000Z') + n * 86400000).toISOString().slice(0, 10);

/* De week (twee weken eigenlijk) vanaf een dag. Elk item telt op zijn dag;
   items zonder dag tellen niet mee -- een deadline zonder datum is geen
   deadline. */
function week(items, vanaf, dagen) {
  const start = dagVan(vanaf);
  const n = Math.max(1, Math.min(31, dagen || DAGEN));
  const rijen = [];
  for (let i = 0; i < n; i++) {
    const datum = plus(start, i);
    const opDeDag = (items || []).filter(x => dagVan(x.datum) === datum);
    const soorten = {};
    for (const x of opDeDag) soorten[x.soort] = (soorten[x.soort] || 0) + 1;
    const vakken = [...new Set(opDeDag.map(x => x.vak).filter(Boolean))];
    rijen.push({ datum, aantal: opDeDag.length,
      eigen: opDeDag.filter(x => x.eigen !== false).length,
      elders: opDeDag.filter(x => x.eigen === false).length,
      vakken: vakken.length, soorten, vol: opDeDag.length >= DREMPEL });
  }
  const volle = rijen.filter(r => r.vol);
  return { dagen: rijen, volle: volle.map(r => r.datum), drempel: DREMPEL,
    /* Het advies gaat over VERPLAATSEN en niet over harder werken. Dat is het
       verschil tussen hulp en een meetlat. */
    advies: volle.length
      ? 'Op ' + volle.map(r => r.datum).join(', ') + ' komt er veel samen. Verplaatsen scheelt meer dan doorwerken.'
      : 'Er loopt geen dag vol in deze periode.' };
}

module.exports = { week, DREMPEL, DAGEN };
