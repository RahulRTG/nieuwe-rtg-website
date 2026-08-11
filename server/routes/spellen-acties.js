/* De spelacties: WAT elk verzoek doet, los van de deuren waarop het hangt.

   Afgesplitst van ./spellen.js toen die over de tienkilobyte-grens ging. De
   knip loopt langs een echte naad, en die naad is precies waar dit domein om
   draait: elke actie bestaat TWEE keer aan de buitenkant (de leden-app en het
   RTFoundation-huis) en EEN keer hierbinnen. Wat een actie doet, mag daarom
   niet weten door welke deur het verzoek kwam -- de identiteit komt binnen als
   `mij` en de wereld als `wereld`, en verder is er geen sessie te zien.

   Hij krijgt de kern mee plus de twee kringhelpers die ./spellen.js al had.
   Geen tweede parameterlijst met dezelfde namen: die loopt vroeg of laat uit
   de pas met de eerste. */
'use strict';

module.exports = ({ kern, vriendenVan, kringVan }) => {
  const { spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelStaat, spelZet, spelOpgeven,
    spelKijk, spelReplay, spelRahul, spelKlasgenoten, spelOnline, spelZichtbaar, spelZichtbaarZet,
    spelUitslagen, spelStand, spelPrestaties, spelPraat, spelPraatStuur,
    teamNieuw, teamNodig, teamAntwoord, teamVerlaat, mijnTeams,
    sudokuNieuw, sudokuKlaar, toernooiNieuw, toernooiAntwoord, mijnToernooien, toernooiStaat,
    sneekScore, sneekBord, arcadeScore, arcadeBord } = kern;

  return {
    nieuw: (mij, b, wereld) => spelNieuw(mij, { soort: b.soort, grootte: b.grootte, modus: b.modus, vrienden: b.vrienden, codenamen: b.codenamen, klasgenoten: b.klasgenoten, taal: b.taal, wereld }),
    antwoord: (mij, b) => spelAntwoord(mij, String(b.id || ''), b.akkoord === true),
    random: (mij, b, wereld) => spelRandom(mij, String(b.soort || ''), b.grootte, b.taal, wereld),
    mijn: (mij) => Object.assign({ status: 200 }, mijnSpellen(mij)),
    staat: (mij, b) => spelStaat(mij, String(b.id || ''), b.velden === true),
    zet: (mij, b) => {
      // de nieuwe staat reist mee in het antwoord: scheelt de client een
      // tweede round-trip na elke zet
      const r = spelZet(mij, String(b.id || ''), b.zet);
      if (!r.error) { const s = spelStaat(mij, String(b.id || '')); if (s.potje) r.potje = s.potje; }
      return r;
    },
    opgeven: (mij, b) => spelOpgeven(mij, String(b.id || '')),
    // het verloop van je EIGEN partij; een kijker krijgt hier niets
    replay: (mij, b) => spelReplay(mij, String(b.id || '')),
    // meekijken: mag dit spel bekeken worden, en hoor jij bij de kring?
    kijk: (mij, b) => spelKijk(mij, String(b.id || '')),
    // Rahul als spelmaatje: een hint, een regel of een peptalk tijdens het potje
    rahul: (mij, b) => spelRahul(mij, String(b.id || ''), b.vraag),
    // de kieslijst met klasgenoten (De Arena); een RTG-lid heeft geen klas
    // en krijgt gewoon een lege lijst
    klasgenoten: (mij) => spelKlasgenoten(mij),
    /* Wie er nu is. De kring komt hier vandaan en niet uit het verzoek: een
       client die zelf een lijst sleutels mag meesturen zou de aanwezigheid van
       willekeurige leden kunnen aftasten. */
    online: (mij) => Object.assign({ status: 200 }, spelOnline(mij, kringVan(mij))),
    // je eigen historie; onder de progressiegrens is die er niet
    uitslagen: (mij, b) => spelUitslagen(mij, b.hoeveel),
    // je stand per spel, afgeleid uit de uitslagen (dus over hetzelfde venster)
    stand: (mij) => spelStand(mij),
    // behaalde prestaties; wat je nog NIET hebt reist bewust niet mee
    prestaties: (mij) => spelPrestaties(mij),
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
    'sudoku-nieuw': (mij, b) => sudokuNieuw(mij, String(b.niveau || '')),
    'sudoku-klaar': (mij, b) => sudokuKlaar(mij, b.rooster),
    'arcade-score': (mij, b) => arcadeScore(mij, String(b.spel || ''), b.punten),
    'arcade-bord': (mij, b) => arcadeBord(mij, String(b.spel || ''), vriendenVan(mij))
  };
};
