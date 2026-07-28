/* De wereldtabel: ALLE landen van de wereld in dezelfde LANDEN-structuur als
   de rijke kernlanden, zodat elke rekenplek (btw, loonrun, zzp, minimumloon,
   alcoholgrens) en de Regelwacht ze zonder aanpassing meenemen.

   De compacte regiobestanden (./wereld/*.js) dragen per land:
   [code, naam, btwStandaard, btwEten, btwLogies, alcoholLeeftijd, lasten,
    uurloonMin]. Deze uitvouwer maakt daar volledige records van:
   - drank volgt het standaardtarief, vervoer het (verlaagde) eten-tarief,
     internationaal personenvervoer (jet) 0% -- de gangbare lijn;
   - vakantiegeld 0 tenzij een land het expliciet kent (de kernlanden);
   - aangifte/extra als eerlijke indicatietekst: dit is de wereldtabel van
     het peiljaar, en de Regelwacht houdt hem automatisch bij.

   De rijke kernlanden in ../landen.js winnen altijd: bestaat een code al,
   dan blijft die staan (met de uitgebreide zakelijk-teksten). */
const REGIOS = ['europa', 'amerika', 'azie', 'afrika', 'oceanie']
  .map(naam => require('./wereld/' + naam));

function vulAan(LANDEN) {
  for (const [regio, rijen] of REGIOS) {
    for (const [code, naam, standaard, eten, logies, alcohol, lasten, uurloonMin] of rijen) {
      if (LANDEN[code]) { LANDEN[code].regio = LANDEN[code].regio || regio; continue; }
      LANDEN[code] = {
        naam, regio, alcoholLeeftijd: alcohol,
        tarieven: { eten, drank: standaard, logies, vervoer: eten, jet: 0, standaard },
        lasten, vakantiegeld: 0, uurloonMin,
        aangifte: 'Btw-/omzetbelastingaangifte volgens de nationale kalender (per maand of kwartaal); loonaangifte bij de nationale dienst. De Regelwacht werkt deze regels automatisch bij.',
        extra: 'Wereldtabel (indicatie op het peiljaar): werkelijke tarieven, drempels en uitzonderingen verschillen per categorie en regio; updates komen automatisch binnen via de Regelwacht.'
      };
    }
  }
  // de Europese kernlanden dragen hun regio ook
  for (const cc of ['NL', 'BE', 'DE', 'FR', 'ES']) if (LANDEN[cc]) LANDEN[cc].regio = 'Europa';
  if (LANDEN.JP) LANDEN.JP.regio = 'Azie';
  return LANDEN;
}

module.exports = { vulAan };
