/* Spel "sneek" (kern/spellen): de klassieke slang, in je eentje. Een
   ARCADE-spel: er is geen potje, geen beurt en geen tegenstander, alleen een
   score die je tegen die van je vrienden legt.

   Let op wat hier NIET staat: de spelregels. Die draaien in de client
   (`public/apps/spelen.html`) en de server ziet alleen het puntenaantal dat
   die client opstuurt. Dat is bewust zo voor een solo-arcade -- de server kan
   een slang niet naspelen -- maar het betekent ook dat een score niet
   server-authoritatief is zoals een zet in een potje dat wel is. Zolang de
   ranglijst onder vrienden blijft en er niets van afhangt, is dat te dragen;
   zodra er een toernooi of een prijs aan hangt, is het dat niet meer. Dat
   staat als open punt in TAKEN.md. */
module.exports = () => {
  const spel = {
    sleutel: 'sneek', naam: 'Sneek', vorm: 'arcade',
    werelden: ['rtg', 'rtf'], // in beide apps te spelen
    maxPunten: 999999
  };
  return { spel };
};
