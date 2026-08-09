/* Spel "sudoku" (kern/spellen): het cijferraadsel, in je eentje. Een
   ARCADE-spel: geen potje, geen beurt, alleen een score naast die van je
   vrienden (sneller opgelost = meer punten). De regels draaien in de client;
   zie de kop van `sneek.js` voor wat dat betekent voor de betrouwbaarheid van
   een score.

   Alleen in de RTFoundation-app: aan de RTG-kant staat Woordduel als het
   denkspel, en de speelhal hoort bij de Foundation. */
module.exports = () => {
  const spel = {
    sleutel: 'sudoku', naam: 'Sudoku', vorm: 'arcade',
    werelden: ['rtf'],
    maxPunten: 999999
  };
  return { spel };
};
