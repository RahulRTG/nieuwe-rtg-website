/* Spel "tetris" (kern/spellen): vallende blokken, in je eentje. Een
   ARCADE-spel: geen potje, geen beurt, alleen een score naast die van je
   vrienden. De regels draaien in de client; zie de kop van `sneek.js` voor wat
   dat betekent voor de betrouwbaarheid van een score. */
module.exports = () => {
  const spel = {
    sleutel: 'tetris', naam: 'Tetris', vorm: 'arcade',
    werelden: ['rtg', 'rtf'],
    maxPunten: 999999
  };
  return { spel };
};
