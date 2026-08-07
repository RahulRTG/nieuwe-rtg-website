/* Het wisrecht op de gesprekken van de communicatiekern (kern/comm).

   WAAROM DIT EEN EIGEN BESTANDJE IS. De regel stond als lus binnen wisLid(),
   en daar was hij niet te toetsen zonder een halve server op te tuigen met twee
   verbonden leden. Het gevolg was voorspelbaar: de bezem in
   test/vergeten.test.js liep groen over een database waar de gesprekken van het
   verwijderde lid gewoon nog in stonden -- niet omdat de bezem faalde, maar
   omdat de wandeling ervoor nooit een gesprek maakte, en een tak die niet is
   aangeraakt kan niet worden gevonden.

   Een regel die je niet los kunt aanroepen, kun je ook niet los nalopen. Dus
   staat hij hier, en roept wisLid() hem aan.

   WAT DE REGEL IS, en waarom die lezing. Dezelfde als bij de eigen Salon-posts
   (zie de opmerking daar in ../vergeten.js): wat DIT lid schreef gaat weg.
     - blijft er niemand over in het gesprek, dan gaat het hele gesprek weg;
     - blijft de ander er wel, dan blijft ZIJN kant staan. Dat is zijn inhoud en
       niet de onze om te wissen, met de gaten die het vertrek achterlaat. Dat
       is de prijs, en die is bij de posts al bewust betaald.
   De leesstanden en vlaggen van het lid (gelezen tot, vastgezet, stilgezet) gaan
   integraal weg: dat is geen inhoud maar zijn eigen schakelaarstand. */
'use strict';

function wisGesprekkenVan(db, key) {
  if (!db || !db.data || !key) return { gesprekkenWeg: 0, berichtenWeg: 0 };
  const data = db.data;
  let gesprekkenWeg = 0, berichtenWeg = 0;

  if (Array.isArray(data.commGesprekken)) {
    const berichten = data.commBerichten || (data.commBerichten = {});
    const houden = [];
    for (const g of data.commGesprekken) {
      const was = Array.isArray(g.deelnemers) ? g.deelnemers : [];
      if (!was.includes(key)) { houden.push(g); continue; }
      g.deelnemers = was.filter((d) => d !== key);
      if (!g.deelnemers.length) {
        berichtenWeg += (berichten[g.id] || []).length;
        delete berichten[g.id];
        gesprekkenWeg++;
        continue;
      }
      /* WIE HET GESPREK OPENDE staat apart in `door`, en dat veld is geen
         deelnemer en geen bericht -- dus liep het langs beide lussen heen. Een
         sleutel die daar blijft staan is precies waarmee iemand terug te
         vinden is, en dat het nergens meer gelezen wordt maakt niet uit: het
         wisrecht gaat over wat er STAAT.

         Het gaat op null en niet naar de eerstvolgende deelnemer: die heeft
         het gesprek niet geopend, en een verkeerd antwoord is erger dan geen.
         Dat dit lang groen bleef, kwam doordat tussen() de twee sleutels
         alfabetisch zet -- in de toets stond de blijver toevallig vooraan. */
      if (g.door === key) g.door = null;
      const voor = (berichten[g.id] || []).length;
      berichten[g.id] = (berichten[g.id] || []).filter((m) => m.van !== key);
      berichtenWeg += voor - berichten[g.id].length;
      const laatste = berichten[g.id][berichten[g.id].length - 1];
      g.laatst = laatste ? laatste.at : g.op;
      houden.push(g);
    }
    data.commGesprekken = houden;
  }
  if (data.commStand) delete data.commStand[key];
  return { gesprekkenWeg, berichtenWeg };
}

module.exports = { wisGesprekkenVan };
