/* Domein "spellen": de acties RONDOM een potje.
   Afgesplitst van ./spellen.js toen dat bestand door de 10 kB-grens ging die
   `scripts/keuring.js` bewaakt. De naad is dezelfde als in de kern (zie
   kern/spellen/rondom.js): alles wat niet over HET SPELEN ZELF gaat maar
   eromheen hangt -- toernooien, teams, praten, de arcade en het gedeelde
   scherm.

   Dit bestand levert alleen een TABEL. De poort, de lus en het vangnet blijven
   in ./spellen.js staan: er is een ledeningang en een RTF-ingang, en die twee
   horen niet op twee plekken te bestaan. */
module.exports = (kern, { vriendenVan, kringVan }) => {
  const { spelZichtbaar, spelZichtbaarZet, spelPraat, spelPraatStuur, teamNieuw, teamNodig,
    teamAntwoord, teamVerlaat, mijnTeams, sudokuNieuw, sudokuKlaar, toernooiNieuw, toernooiAntwoord,
    mijnToernooien, toernooiStaat, sneekScore, sneekBord, arcadeScore, arcadeBord,
    projectieOpen, projectieSluit, dagStand, dagStart, dagKlaar } = kern;

  return {
    /* Toernooien: een knockout waarvan elke wedstrijd een gewoon potje is. De
       deelnemers komen uit dezelfde kring als een potje (vrienden en
       klasgenoten), dus de kring wordt hier bepaald en niet in het verzoek. */
    'toernooi-nieuw': (mij, b) => toernooiNieuw(mij, { soort: b.soort, naam: b.naam, maat: b.maat, vorm: b.vorm,
      spelers: (Array.isArray(b.spelers) ? b.spelers : []).filter(k => kringVan(mij).includes(k)) }),
    'toernooi-antwoord': (mij, b) => toernooiAntwoord(mij, String(b.id || ''), b.akkoord === true),
    'toernooi-mijn': (mij) => mijnToernooien(mij),
    'toernooi-staat': (mij, b) => toernooiStaat(mij, String(b.id || '')),
    // de eigen opt-out: wel spelen, niet gezien worden
    zichtbaar: (mij) => spelZichtbaar(mij),
    'zichtbaar-zet': (mij, b) => spelZichtbaarZet(mij, b.aan !== false),
    'sneek-score': (mij, b) => sneekScore(mij, b.punten),
    'sneek-bord': (mij) => Object.assign({ status: 200 }, sneekBord(mij, vriendenVan(mij))),
    /* Teams: een vaste club om mee te spelen. Uitnodigen kan alleen binnen je
       eigen kring, en die wordt gewogen in `kern/spellen/kring.js` -- met opzet
       NIET hier nog een keer. Hier stond eerst een tweede filter op `kringVan`,
       en dat was smaller dan de kern: `kringVan` kent vrienden en klasgenoten,
       de kring kent ook het huishouden. Een ouder kon zijn eigen kind dus niet
       in zijn team vragen. Twee definities van dezelfde kring is precies wat
       kring.js moest opheffen; deze route geeft de gevraagde sleutels door en
       de kern zeeft ze. */
    'team-nieuw': (mij, b) => teamNieuw(mij, b.naam, Array.isArray(b.leden) ? b.leden : []),
    'team-nodig': (mij, b) => teamNodig(mij, String(b.id || ''), Array.isArray(b.leden) ? b.leden : []),
    'team-antwoord': (mij, b) => teamAntwoord(mij, String(b.id || ''), b.akkoord === true),
    'team-verlaat': (mij, b) => teamVerlaat(mij, String(b.id || '')),
    'team-mijn': (mij) => mijnTeams(mij),
    /* Praten in het potje. Geen eigen berichtenvoorraad -- dit gaat de
       communicatiekern in; zie kern/spellen/praat.js. Twee acties, want lezen
       mag geen gesprek AANMAKEN. */
    praat: (mij, b) => spelPraat(mij, String(b.id || ''), b.aantal),
    'praat-stuur': (mij, b) => spelPraatStuur(mij, String(b.id || ''), b.tekst),
    /* Sudoku loopt NIET via arcade-score: de server geeft de puzzel uit en
       rekent de score. Er is dus ook geen tijd of getal dat hier binnenkomt --
       alleen het ingevulde rooster. */
    /* De projectiekamer: een code openen of dichtdoen. Alleen een SPELER kan
       dat, dus deze twee staan gewoon achter de ledenpoort. Het scherm zelf
       loopt langs een andere deur, hieronder -- die heeft geen sessie. */
    'projectie-open': (mij, b) => projectieOpen(mij, String(b.id || '')),
    'projectie-sluit': (mij, b) => projectieSluit(mij, String(b.id || '')),
    'sudoku-nieuw': (mij, b) => sudokuNieuw(mij, String(b.niveau || '')),
    'sudoku-klaar': (mij, b) => sudokuKlaar(mij, b.rooster),
    /* De dagopgave: een opgave per dag, dezelfde voor iedereen. DRIE acties en
       geen vlag op een bestaande, want ze doen echt iets anders: kijken start
       geen klok, starten wel, en inleveren kan alleen na starten. Een vlag op
       een van de drie zou betekenen dat een verkeerde waarde de klok laat lopen
       of hem juist terugzet.

       De DATUM komt niet uit het verzoek. Een client die zelf een dag mag
       noemen speelt de opgave van gisteren nog eens, of maakt die van morgen
       vast aan; welke dag het is weet de server. */
    dag: (mij, b) => dagStand(mij, String(b.spel || ''), vriendenVan(mij)),
    'dag-start': (mij, b) => dagStart(mij, String(b.spel || '')),
    'dag-klaar': (mij, b) => dagKlaar(mij, String(b.spel || ''), b.inzending),
    'arcade-score': (mij, b) => arcadeScore(mij, String(b.spel || ''), b.punten),
    'arcade-bord': (mij, b) => arcadeBord(mij, String(b.spel || ''), vriendenVan(mij))
  };
};
