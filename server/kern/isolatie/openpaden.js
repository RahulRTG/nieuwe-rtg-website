/* BLIJFT DIT PAD OPEN, WAT ER OOK GEBEURT? -- de vraag, niet de lijst.

   De drie lijsten met hun gronden staan in ./openpaden-lijst.js. Dat is dezelfde
   naad als beschermstand-lijst.js tegenover beschermstand.js, en om dezelfde
   reden: de lijst is een AFSPRAAK die met het huis meegroeit en elke regel draagt
   een uitgeschreven grond, terwijl de vraag erover een paar regels code is die
   bijna nooit verandert. Samen gingen ze over de 10 KB van keuringsregel 13, en
   dat is hier geen toeval maar het teken dat er twee onderwerpen in zaten.

   Wie een pad wil vrijstellen, gaat naar de lijst. Wie wil weten HOE er wordt
   gevraagd, blijft hier. */
'use strict';

const { EIGEN_UITGANG, RECHT_VAN_DE_MENS, FYSIEKE_DEUR, BEWUST_DICHT } = require('./openpaden-lijst');

function blijftOpen(pad) {
  const p = String(pad);
  if (EIGEN_UITGANG[p]) return { grond: 'EIGEN_UITGANG', waarom: EIGEN_UITGANG[p] };
  if (RECHT_VAN_DE_MENS[p]) return { grond: 'RECHT_VAN_DE_MENS', waarom: RECHT_VAN_DE_MENS[p] };
  if (FYSIEKE_DEUR[p]) return { grond: 'FYSIEKE_DEUR', waarom: FYSIEKE_DEUR[p] };
  return null;
}

/* Geen pad staat in twee lijsten, en geen pad dat bewust dicht is staat per
   ongeluk toch open. Bij het laden, want een tegenspraak hier is een gat dat je
   pas bij een incident zou vinden. */
(function keurIn() {
  /* DRIE LIJSTEN, DUS DRIE PAREN OM NA TE LOPEN. Met twee lijsten was een enkele
     vergelijking genoeg; met drie moet elk paar apart, anders glipt een pad dat
     in de eerste en de derde staat er ongemerkt doorheen. */
  const lijsten = [['EIGEN_UITGANG', EIGEN_UITGANG], ['RECHT_VAN_DE_MENS', RECHT_VAN_DE_MENS],
    ['FYSIEKE_DEUR', FYSIEKE_DEUR]];
  const dubbel = [];
  for (let i = 0; i < lijsten.length; i++) {
    for (let j = i + 1; j < lijsten.length; j++) {
      for (const p of Object.keys(lijsten[i][1])) {
        if (lijsten[j][1][p]) dubbel.push(p + ' (' + lijsten[i][0] + ' + ' + lijsten[j][0] + ')');
      }
    }
  }
  if (dubbel.length) throw new Error('openpaden: "' + dubbel.join(', ') + '" staat in twee lijsten; ' +
    'dan is niet te zeggen op welke grond hij openstaat.');
  const botst = Object.keys(BEWUST_DICHT).filter(p => blijftOpen(p));
  if (botst.length) throw new Error('openpaden: "' + botst.join(', ') + '" is bewust dicht en staat ' +
    'toch op een open lijst. Dat is precies het gat dat je pas bij een incident vindt.');
})();

module.exports = { EIGEN_UITGANG, RECHT_VAN_DE_MENS, FYSIEKE_DEUR, BEWUST_DICHT, blijftOpen };
