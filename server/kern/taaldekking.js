/* RTG: de vertaaldekking -- wat "114 talen" precies wel en niet betekent.

   In SCHOOL.md stond "114 talen" als belofte met daarachter: dekking niet
   gemeten. Een getal zonder meting is geen belofte maar een risico (dat staat
   twee regels lager in datzelfde register). Deze module rekent hem na.

   DRIE LAGEN, EN ZE DEKKEN NIET EVENVEEL.

   1. HET REGISTER (server/talen.js). Welke talen bestaan er, met hun eigen
      naam en de Engelse. Volledig meetbaar: een taal staat erin of niet.
   2. DE TERUGVAL ZONDER MODEL (translate/woordenboek/wereld.js). Dertig
      schoolkernwoorden per taal, zodat een gezin ook zonder AI-sleutel iets in
      de eigen taal ziet. Ook volledig meetbaar: een cel is gevuld of leeg.
   3. ALLES DAARBUITEN. Elke andere zin loopt via een model. Is dat er niet,
      dan blijft de tekst in de brontaal staan. Dat is GEEN dekking, en zo
      staat het hier: `buitenDeTerugval` telt het niet mee.

   WAT EEN MACHINE NIET KAN METEN. Of het Tigrinya voor "huiswerk" klopt.
   Deze module telt gevulde cellen; ze beoordeelt geen taal. Er is nog nooit
   een spreker van deze 113 talen langs deze tabel gelopen, en tot dat gebeurt
   is de kwaliteit onbekend -- niet "waarschijnlijk goed". Dezelfde regel als
   bij de veldkaarten in kern/koppelvlak-kaarten.js.

   WAT WEL EEN KWALITEITSSIGNAAL IS. Een cel die letterlijk gelijk is aan het
   Nederlandse bronwoord. Soms is dat gewoon waar -- Afrikaans "les", Duits
   "ja", Haitiaans "klas" -- dus het is geen fout en het wordt niet verboden.
   Het wordt GETELD en met naam opgesomd, zodat niemand hoeft te raden of daar
   een vergeten cel tussen zit. Verbieden zou de tabel liegen; verzwijgen zou
   erger zijn. */
const { TALEN, BASIS } = require('../talen');
const { KERN } = require('../translate/woordenboek/wereld-kern');
const { dictVan, TALEN_MET_KERN } = require('../translate/woordenboek/wereld');

/* De brontaal heeft geen terugvalrij nodig: de sleutels van het woordenboek
   ZIJN het Nederlands. Dat is geen gat maar de bodem van de tabel. */
const BRON = 'nl';

/* `bron` is er voor de TOETS en niet voor de app. De echte tabel heeft geen
   gaten, dus een toets die op de echte tabel zegt "geen lege cellen" kan nooit
   zakken -- en een toets die je niet hebt zien zakken is geen toets (LAT-regel
   2). Met een opzettelijk kapotte tabel is de melder zelf te beproeven. */
function meet(bron) {
  const b = bron || {};
  const talen = b.talen || TALEN;
  const kern = b.kern || KERN;
  const dict = b.dictVan || dictVan;
  const metRij = b.talenMetKern || TALEN_MET_KERN;

  const codes = talen.map(t => t.code);
  const zonderNaam = talen.filter(t => !t.naam || !t.en).map(t => t.code);
  const dubbel = codes.filter((c, i) => codes.indexOf(c) !== i);

  const doeltalen = codes.filter(c => c !== BRON);
  const zonderRij = doeltalen.filter(c => !metRij.includes(c));

  const leeg = [], gelijkAanBron = [], onvolledig = [];
  for (const code of doeltalen) {
    const d = dict(code);
    if (!d) continue;
    let gevuld = 0;
    for (const nl of kern) {
      const w = d[nl];
      if (!w || !String(w).trim()) { leeg.push(code + ':' + nl); continue; }
      gevuld++;
      if (String(w).trim().toLowerCase() === nl.toLowerCase()) gelijkAanBron.push(code + ':' + nl);
    }
    if (gevuld !== kern.length) onvolledig.push(code + ' (' + gevuld + ' van ' + kern.length + ')');
  }

  return {
    ok: true,
    talen: talen.length,
    basistalen: BASIS.slice(),
    zonderNaam, dubbel,
    kernwoorden: kern.length,
    doeltalen: doeltalen.length,
    metKernrij: doeltalen.length - zonderRij.length,
    zonderRij, onvolledig, leeg, gelijkAanBron,
    /* Wat er NIET onder de terugval valt: elke zin die niet een van deze
       dertig woorden is. Een getal noemen zou hier een gok zijn -- het hangt
       af van elk scherm -- dus staat er wat het is en geen cijfer. */
    buitenDeTerugval: 'elke zin die geen van de ' + kern.length + ' kernwoorden is; die loopt via een model, en zonder sleutel blijft hij in de brontaal staan',
    kwaliteit: 'ongemeten: deze meting telt gevulde cellen en beoordeelt geen taal. Er is nog nooit een spreker van deze talen langs de tabel gelopen.'
  };
}

/* Een regel voor het belofteregister, gemaakt van de meting zelf, zodat het
   getal in SCHOOL.md niet met de hand hoeft mee te lopen. */
function regel() {
  const m = meet();
  return m.talen + ' talen in het register, ' + m.metKernrij + ' van de ' + m.doeltalen
    + ' doeltalen met alle ' + m.kernwoorden + ' kernwoorden';
}

module.exports = { meet, regel, BRON, KERN };
