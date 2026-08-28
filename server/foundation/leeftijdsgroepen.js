'use strict';
/* DE VIJF LEEFTIJDSGROEPEN, EN WAT ERUIT VOLGT.

   APART VAN foundation.js, en de aanleiding was de 10 KB-grens die de
   samenvoeging van 22 augustus 2026 overschreed. De naad zelf ligt ouder: dit
   blok is het enige stuk van foundation.js dat GEEN routes ophangt en geen
   context bedraadt. Het rekent -- welke groep hoort bij welke leeftijd, welke
   leerlingpassen volgen eruit, mag deze groep solliciteren -- en dat is een
   eigen onderwerp.

   DE TWEE GRENZEN UIT LEVEN.md GAAN MEE EN STAAN HIER OPNIEUW, want ze horen bij
   de code en niet bij het bestand waar hij toevallig in stond: `vanaf` gaat niet
   mee naar buiten (een lens mag de verzameling mogelijkheden nooit verkleinen,
   par. 2.2), en de leerlingpassen zijn AFGELEIDE rechten en nooit vinkjes die
   iemand met de hand aanzet.
   EEN FABRIEK EN GEEN LOSSE MODULE, omdat GROEPEN en GROEP_INFO uit
   ./basis.js komen. Ze hier opnieuw opschrijven zou dezelfde lijst op twee
   plekken zetten, en die lopen uiteen (LAT.md regel 4).
   ========================================================================== */
module.exports = ({ GROEPEN, GROEP_INFO, F, actualiseerGroep }) => {
  /* De vijf leeftijdsgroepen als alleen-lezen gegeven, voor kern/levenslijn.

     WAAROM DIT NAAR BUITEN MAG EN DE REST NIET. Sinds LEVEN.md par. 1.1 zijn
     mini/kind/tiener/jong/volw geen INDELING meer maar een WEERGAVEFILTER op de
     levenslijn: "laat me de lijn zien zoals een tiener hem ziet". Daarvoor heeft
     de levenslijn niets van een profiel nodig, alleen de vijf namen met hun
     bereik. Zou hij ze zelf overtikken, dan staat dezelfde lijst op twee plekken
     en lopen ze uiteen (LAT.md regel 4).

     `vanaf` (de ondergrens in jaren) gaat MET OPZET niet mee. Die hoort bij
     magSolliciteren/groepLeeftijd, waar een leeftijdsgrens een echte functie
     heeft. In de levenslijn zou hij precies een ding worden waarvoor hij daar
     niet bedoeld is: een getal waarmee je fasen kunt afsluiten voor iemand die
     er "nog niet aan toe" is. De lens mag de verzameling mogelijkheden nooit
     verkleinen (LEVEN.md par. 2.2), dus krijgt hij geen grens om op te
     vergelijken. */
  function groepen() {
    return GROEPEN.map(id => ({ id, naam: GROEP_INFO[id].naam, bereik: GROEP_INFO[id].bereik }));
  }

  /* De drie leerlingpassen zijn afgeleide rechten, nooit vinkjes die een
     browser zelf mag zetten. Foundation is de geldige gezinssessie, Leeftijd
     komt uitsluitend uit de geboortedatum en School uitsluitend uit een echte
     klasinschrijving. Daardoor opent een gekopieerde URL geen leerlingenscherm. */
  function leerlingPassen(sess) {
    if (!sess || !sess.p || !sess.g) return null;
    const geboorte = actualiseerGroep(sess.p);
    const sleutel = sess.g.code + ':' + sess.p.id;
    const f = F();
    const klassen = Object.values(f.klassen || {}).filter(k => (k.leerlingen || []).some(l => l.sleutel === sleutel));
    const scholen = f.scholen || {};
    const actieveKlassen = klassen.filter(k => !k.schoolCode || !scholen[k.schoolCode] || (scholen[k.schoolCode].status || 'actief') === 'actief');
    const leerling = sess.p.rol === 'kind' && !sess.gast;
    const passen = ['foundation'];
    if (geboorte) passen.push('leeftijd');
    if (geboorte && leerling) passen.push('leerling');
    if (geboorte && leerling && actieveKlassen.length) passen.push('school');
    return {
      groep: sess.p.groep || null, leeftijd: geboorte ? geboorte.leeftijd : null,
      leeftijdBevestigd: !!geboorte, leerling, passen,
      school: actieveKlassen.length ? { actief: true, aantalKlassen: actieveKlassen.length,
        klassen: actieveKlassen.map(k => ({ code: k.code, naam: k.naam, school: k.school })) } : { actief: false, aantalKlassen: 0, klassen: [] }
    };
  }

  // magSolliciteren/groepLeeftijd horen ook naar buiten: de sollicitatieroute moet
  // de leeftijdsgrens uit het PROFIEL kunnen halen in plaats van uit het verzoek.

  return { groepen, leerlingPassen };
};
