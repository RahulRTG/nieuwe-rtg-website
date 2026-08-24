/* HET HOOFDINCIDENT IN HET VLOOTBEELD -- één regel per lopend incident, en
   hoeveel organisaties er minstens iets van merkten.

   Apart van ./vlootbeeld.js omdat dit het enige stuk van dat beeld is dat een
   GETAL over klanten produceert, en dat is precies het stuk waar het misgaat als
   niemand de grens meeleest. Wie hier iets verandert, hoort de kop van
   ../../meting-tenant.js te hebben gelezen: het is een ondergrens, geen aantal,
   en het wordt nooit een beschikbaarheidscijfer per klant.

   De rekensom staat NIET hier maar in ./incident-impact.js. Twee plekken die
   hetzelfde getal zelf uitrekenen, zeggen op een dag iets anders over hetzelfde
   incident -- dezelfde regel waarom de laag die iets toont, het niet meet. */
'use strict';

const impact = require('./incident-impact');

module.exports = function maakHoofdincidenten({ incident, gezondheid, veilig }) {
  /* HET HOOFDINCIDENT. Eén regel per lopend incident, met het aantal
     organisaties dat BESTAAT -- en de zin erbij dat dat niet het aantal geraakte
     is. Zonder die zin wordt "812 organisaties" binnen een week gelezen als
     "812 klanten hadden hier last van".

     `geraakteOrganisaties` stond hier op null omdat de meting geen tenant droeg.
     Dat is sinds vandaag een ONDERGRENS (server/meting-tenant.js) en geen
     aantal: alleen verkeer dat langs een werkruimtedeur kwam draagt een
     organisatie. Het veld heet daarom `minstens` en niet `aantal`, en het draagt
     zijn eigen `let` mee -- een getal dat op een vlootscherm los van zijn grens
     komt te staan, is binnen een week het getal waarop iemand belt. */
  function hoofdincidenten(aantalOrgs) {
    const open = veilig(() => incident.lijst({ max: 50 }), 'de incidenten zijn niet te lezen');
    if (open.nietTeLezen) return { fout: open.nietTeLezen, lijst: [] };
    return { lijst: open.map(i => ({
      id: i.id, vermogen: i.vermogen, naam: i.naam, wat: i.wat, status: i.status,
      begonnen: i.begonnen, eigenaar: i.eigenaar,
      organisatiesInDeVloot: aantalOrgs,
      geraakteOrganisaties: raakte(i.vermogen),
      let: 'Dit is ÉÉN incident en geen ' + aantalOrgs + ' meldingen. Hoeveel organisaties er werkelijk ' +
        'iets van merkten is een ONDERGRENS en geen aantal -- zie "niet te zien".'
    })) };
  }

  /* De ondergrens per vermogen, uit dezelfde rekensom als het incidentdossier
     (kern/command/incident-impact.js). Hij wordt hier OPGEVRAAGD en niet
     opnieuw gerekend: twee plekken die hetzelfde getal zelf uitrekenen, zeggen
     op een dag iets anders over hetzelfde incident. */
  function raakte(vermogenId) {
    const st = veilig(() => gezondheid.stand(), 'de gezondheidskaart is niet te lezen');
    if (st.nietTeLezen) return { gemeten: false, waarom: st.nietTeLezen };
    const v = (st.vermogens || []).find(x => x.id === vermogenId);
    if (!v) return { gemeten: false, waarom: 'dit vermogen staat niet op de gezondheidskaart' };
    return impact.impactVan(v).gemetenOndergrens;
  }

  return { hoofdincidenten, raakte };
};
