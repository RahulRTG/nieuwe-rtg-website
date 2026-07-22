/* De demo-kantoortoren voor kern/gebouw.js: de voorbeeldtoren die een nieuwe
   gebouwbeheerder meteen gevuld ziet. Krijgt nu() en vandaag() mee (voor de
   tijdstempels); apart gehouden zodat de motor klein blijft. */
module.exports = function demoToren(nu, vandaag) {
  return {
    naam: 'Meridiaan Toren', vloeren: 14,
    huurders: [
      { id: 'h1', naam: 'Vektor Capital', verdiepingen: [12, 13], badges: 24 },
      { id: 'h2', naam: 'Lex & Partners Advocaten', verdiepingen: [10, 11], badges: 31 },
      { id: 'h3', naam: 'Fjord Ventures', verdiepingen: [9], badges: 12 },
      { id: 'h4', naam: 'Studio Helix', verdiepingen: [8], badges: 18 },
      { id: 'h5', naam: 'Atlas Accountants', verdiepingen: [6, 7], badges: 40 },
      { id: 'h6', naam: 'Nova Media Group', verdiepingen: [4], badges: 15 },
      { id: 'h7', naam: 'RTG Flexwerken', verdiepingen: [2, 3], badges: 55 }
    ],
    zalen: [
      { id: 'z1', naam: 'Boardroom Skyline', verdieping: 14, capaciteit: 16, uurprijs: 120, voorzieningen: ['scherm', 'video', 'catering'] },
      { id: 'z2', naam: 'Zaal Zuid', verdieping: 5, capaciteit: 10, uurprijs: 55, voorzieningen: ['scherm', 'whiteboard'] },
      { id: 'z3', naam: 'Zaal Noord', verdieping: 5, capaciteit: 10, uurprijs: 55, voorzieningen: ['scherm', 'video'] },
      { id: 'z4', naam: 'Studio (podcast)', verdieping: 3, capaciteit: 4, uurprijs: 40, voorzieningen: ['video'] },
      { id: 'z5', naam: 'Auditorium', verdieping: 1, capaciteit: 80, uurprijs: 300, voorzieningen: ['scherm', 'video', 'catering'] }
    ],
    boekingen: [], badges: [], bezoekers: [], meldingen: [
      { id: 'm1', soort: 'onderhoud', verdieping: 11, tekst: 'Klimaat blaast warm op de gang.', status: 'open', gemaakt: nu() },
      { id: 'm2', soort: 'schoonmaak', verdieping: 14, tekst: 'Boardroom Skyline gereedmaken na de lunch.', status: 'open', gemaakt: nu() }
    ],
    valet: [], jetset: [
      { id: 'j1', soort: 'lounge', voorWie: 'Vektor Capital', wens: 'Executive lounge voor 4, einde van de middag.', moment: vandaag() + ' 17:00', status: 'aangevraagd', notitie: '', gemaakt: nu() }
    ]
  };
};
