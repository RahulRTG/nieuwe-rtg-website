/* Spellen (deelmodule): prestaties, AFGELEID uit de uitslagen.

   Net als de stand wordt hier niets bijgehouden. Een prestatie is een vraag
   aan de log, geen vinkje in een tabel: dat scheelt opslag, een tweede wispad
   en een tak die nooit verloopt (zie de afweging bij spelStand in
   ./uitslagen.js). Wie zich laat verwijderen verliest zijn prestaties omdat de
   BRON verdwijnt, zonder dat het wisbeleid deze functie hoeft te kennen.

   DRIE KEUZES DIE DIT ANDERS MAKEN DAN EEN GEWOON PRESTATIESYSTEEM, en ze
   volgen alle drie uit CLAUDE.md ("geen verslavende engagement-patronen"):

   1. ALLEEN WAT BEHAALD IS. Er reist geen "7 van de 10" mee en geen lijst van
      wat je nog KUNT halen. Een voortgangsbalk naar een doel dat je niet zelf
      hebt gekozen is precies de por die dit huis niet bouwt. Wat je hebt
      gedaan mag je zien; wat je "nog moet" is niet aan ons.

   2. GEEN REEKSEN. Geen "vijf dagen achter elkaar". Dat straft een dag
      overslaan, en spelen hoort geen verplichting te worden.

   3. HET VENSTER IS DAT VAN DE LOG. Een prestatie kan dus weer verdwijnen als
      de partijen eronder verlopen. Dat is geen bug maar het punt: een stand
      die kan zakken is iets anders dan een ratel die alleen omhoog gaat. Het
      venster reist mee zodat het scherm het kan zeggen.

   De progressiegrens geldt zoals overal: onder de 18+-poort bestaan er geen
   prestaties, en het spel zelf speel je gewoon. */

/* De lijst zelf. Een prestatie is een sleutel, een naam, en een functie die
   uit de telling zegt of hij behaald is -- meer niet. Eentje toevoegen is een
   regel erbij; er is geen tweede plek die het moet weten. `perSpel: true`
   betekent dat hij per spelsoort geldt (en dus meerdere keren behaald kan
   worden), anders geldt hij over alles heen. */
const PRESTATIES = [
  { sleutel: 'eerste-winst', naam: 'Eerste overwinning', perSpel: true,
    uitleg: 'Je eerste gewonnen partij in dit spel.', haalt: (t) => t.gewonnen >= 1 },
  { sleutel: 'tien-partijen', naam: 'Vaste speler', perSpel: true,
    uitleg: 'Tien partijen in dit spel.', haalt: (t) => t.gespeeld >= 10 },
  { sleutel: 'vijfentwintig-winst', naam: 'Meester', perSpel: true,
    uitleg: 'Vijfentwintig gewonnen partijen in dit spel.', haalt: (t) => t.gewonnen >= 25 },
  { sleutel: 'allrounder', naam: 'Allrounder',
    uitleg: 'Partijen gespeeld in vijf verschillende spellen.', haalt: (t) => t.soorten >= 5 },
  { sleutel: 'volhouder', naam: 'Volhouder',
    uitleg: 'Vijftig partijen in totaal.', haalt: (t) => t.gespeeld >= 50 }
];

module.exports = (ctx) => {
  const { spelStand, naamVanSpel } = ctx;

  function spelPrestaties(mij) {
    const stand = spelStand(mij);
    if (!stand.progressie) {
      return { status: 200, prestaties: [], progressie: false, reden: stand.reden };
    }
    const uit = [];
    for (const p of PRESTATIES) {
      if (p.perSpel) {
        for (const rij of stand.stand) {
          if (!p.haalt(rij)) continue;
          uit.push({ sleutel: p.sleutel + ':' + rij.soort, naam: p.naam,
            spel: naamVanSpel(rij.soort) || rij.soort, uitleg: p.uitleg });
        }
      } else {
        const totaal = Object.assign({ soorten: stand.stand.length }, stand.totaal);
        if (p.haalt(totaal)) uit.push({ sleutel: p.sleutel, naam: p.naam, spel: null, uitleg: p.uitleg });
      }
    }
    /* Alleen wat behaald is gaat terug. Het AANTAL mogelijke prestaties zit er
       met opzet niet bij: "3 van de 12" is een voortgangsbalk met een andere
       naam. */
    return { status: 200, progressie: true, vensterDagen: stand.vensterDagen, prestaties: uit };
  }

  return { spelPrestaties, _PRESTATIES: PRESTATIES };
};
