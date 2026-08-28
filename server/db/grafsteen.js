/* PostgreSQL-opslag, deel "grafsteen": wat er gebeurt met het VERSCHIL tussen de
   lokale snapshot en Postgres bij het opstarten.

   Afgesplitst uit ./postgres.js, dat daarmee over de tien kilobyte ging. Het is
   ook een eigen onderwerp: de rest van dat bestand gaat over verbinden, flushen
   en luisteren, en dit gaat over EEN vraag -- welke waarheid wint als de twee
   het oneens zijn over het BESTAAN van een collectie.

   HET PROBLEEM. Postgres wint bij het opstarten "voor elke collectie die hij
   heeft". Een collectie die er niet is, heeft hij niet -- dus won de verouderde
   snapshot, en de node schreef die staat daarna zelfs terug. Een bewust gewiste
   collectie herrees. Gereproduceerd in TAKEN.md 4.38.

   TWEE GEVALLEN, EN ZE VRAGEN VERSCHILLENDE DINGEN:

   1. Gewist met `npm run kvwis`: er staat een GRAFSTEEN (`weg = true`). Dan
      weten we dat het opzet was, en passen we het verwijderen toe.
   2. Gewist met een handmatige `DELETE FROM kv`: er is geen spoor. Dan kunnen
      we het niet toepassen -- we weten niet of de rij bewust weg is of er nooit
      is geweest. Wat we wel kunnen: het luid melden in plaats van het stil
      terugzetten. Twee waarheden horen nooit stilzwijgend te bestaan
      (LAT-regel 4). */
'use strict';

/* Voegt de lokale snapshot en Postgres samen: Postgres wint per collectie, de
   grafstenen worden toegepast, en wat er daarna nog scheef staat wordt gemeld.
   Geeft de nieuwe db.data terug plus wat er is gebeurd, zodat een toets dat kan
   nalopen zonder de logregel te moeten lezen. */
function samenvoegen(snapshot, pgData, log) {
  const uitSnapshot = Object.keys(snapshot || {});
  const dbData = Object.assign(snapshot || {}, pgData);
  const grafstenen = (pgData && pgData.__grafstenen) || [];
  for (const k of grafstenen) delete dbData[k];

  const stil = uitSnapshot.filter(k => !(k in pgData) && !grafstenen.includes(k)
    && k !== '__schema' && dbData[k] != null);
  if (stil.length && log && log.warn) {
    const beschrijf = k => k + ' (' + (Array.isArray(dbData[k]) ? dbData[k].length + ' items' : typeof dbData[k]) + ')';
    log.warn('[db] LET OP: ' + stil.length + ' collectie(s) staan wel in de lokale snapshot en NIET in Postgres: ' +
      stil.map(beschrijf).join(', ') + '. Ze worden nu uit de snapshot aangevuld en straks teruggeschreven. ' +
      'Is dit met de hand gewist in Postgres, gebruik dan `npm run kvwis <collectie>`: dat laat een grafsteen ' +
      'achter die elke node toepast. Zie RUNBOOK.md.');
  }
  return { dbData, toegepast: grafstenen.slice(), gemeld: stil };
}

module.exports = { samenvoegen };
