/* Mobility OS (datamodule): de arbeids-, rij- en rusttijden van het
   taxivervoer, en wat er van een dienst uit te rekenen valt.

   WAAROM DIT EEN EIGEN MODULE IS. De grenzen komen uit de Arbeidstijdenwet en
   het Arbeidstijdenbesluit vervoer, en die veranderen buiten deze code om. Ze
   staan hier als DATA met een bron erbij, niet verspreid als getallen tussen de
   logica, zodat een wijziging in de wet een wijziging op een plek is.

   EN WAAROM ZE INSTELBAAR ZIJN. Het taxivervoer kent meer dan een regime: voor
   een chauffeur in loondienst gelden andere grenzen dan voor een zelfstandige,
   en een cao kan strenger zijn. Wat hieronder staat zijn de STANDAARDEN; een
   onderneming stelt ze bij op zijn eigen regime. Deze module geeft daarom een
   oordeel MET zijn rekensom erbij en niet een kaal "mag niet" -- want wie een
   grens niet kan navertellen, gaat hem wantrouwen.

   DIT IS GEEN JURIDISCH ADVIES EN DE CODE ZEGT DAT OOK. De uitkomst heet een
   SIGNAAL, geen overtreding: het systeem ziet wat het geregistreerd heeft
   staan, en de beoordeling of er echt een regel is overtreden ligt bij de ILT
   en bij de onderneming. Dat is dezelfde lijn als bij de schoolsignalen: geen
   voorspelling, geen score, wel een natrekbare uitleg. */

/* De standaardgrenzen. Bron: Arbeidstijdenwet + Arbeidstijdenbesluit vervoer,
   zoals samengevat door de ILT voor het taxivervoer. Minuten, overal. */
const GRENZEN = {
  arbeidstijdPerDienst: 12 * 60,     // maximale arbeidstijd in een dienst
  rijtijdPerDienst: 10 * 60,         // waarvan ten hoogste dit achter het stuur
  rijtijdVoorPauze: 4.5 * 60,        // na zo lang rijden hoort er een pauze
  pauzeMinimaal: 30,                 // en die duurt minstens zo lang
  pauzeDeelMinimaal: 15,             // opsplitsen mag, maar niet in snippers
  dagelijkseRust: 10 * 60,           // rust tussen twee diensten
  wekelijkseRust: 36 * 60            // aaneengesloten rust per week
};

// wat een chauffeur tijdens zijn dienst kan registreren; de CDT kent deze soorten
const SOORTEN = {
  rijden: { naam: 'Rijden', telt: ['arbeid', 'rij'] },
  ander: { naam: 'Andere werkzaamheden', telt: ['arbeid'] },
  beschikbaar: { naam: 'Beschikbaarheidsdienst', telt: ['arbeid'] },
  pauze: { naam: 'Pauze', telt: [] },
  rust: { naam: 'Rust', telt: [] }
};

/* De optelsom van een dienst. Puur rekenwerk op een lijst blokken; geen
   database, geen klok van buiten -- zodat dit op zichzelf te toetsen is. */
function tel(blokken, totMs) {
  const uit = { arbeidMin: 0, rijMin: 0, pauzeMin: 0, langstePauze: 0, blokken: [] };
  for (const b of blokken || []) {
    const van = new Date(b.van).getTime();
    const tot = b.tot ? new Date(b.tot).getTime() : (totMs || Date.now());
    /* Alleen ONLEESBARE of OMGEKEERDE blokken vallen weg; een blok van nul
       milliseconden is gewoon een blok. Hier stond `tot <= van`, en dat liet
       een blok dat in DEZELFDE milliseconde begon als het meetmoment uit de
       tijdlijn vallen -- precies wat een overgang doet: het oude blok sluit op
       t, het nieuwe opent op t, en wie het beeld nog binnen die milliseconde
       opvraagt zag dan GEEN open blok terwijl de dienst er wel een had. De
       optelsom veranderde er niet van (nul minuten is nul), maar het beeld
       loog over de tijdlijn, en de CDT-toetsen zakten daar sporadisch op. */
    if (!Number.isFinite(van) || !Number.isFinite(tot) || tot < van) continue;
    const min = Math.round((tot - van) / 60000);
    const s = SOORTEN[b.soort] || SOORTEN.ander;
    if (s.telt.includes('arbeid')) uit.arbeidMin += min;
    if (s.telt.includes('rij')) uit.rijMin += min;
    if (b.soort === 'pauze') { uit.pauzeMin += min; uit.langstePauze = Math.max(uit.langstePauze, min); }
    uit.blokken.push({ soort: b.soort, van: b.van, tot: b.tot || null, minuten: min, open: !b.tot });
  }
  return uit;
}

/* De signalen. Elk signaal noemt zijn eigen rekensom -- het getal, de grens en
   waar het vandaan komt. Zonder dat is het een rood bolletje waar niemand iets
   mee kan, en dat wordt binnen een week weggeklikt. */
function signalen(som, grenzen) {
  const g = Object.assign({}, GRENZEN, grenzen || {});
  const uit = [];
  const uur = m => (Math.round(m / 6) / 10) + ' uur';

  if (som.arbeidMin > g.arbeidstijdPerDienst)
    uit.push({ id: 'arbeidstijd', zwaarte: 'grens',
      tekst: 'Arbeidstijd ' + uur(som.arbeidMin) + ' in deze dienst; de grens staat op ' + uur(g.arbeidstijdPerDienst) + '.' });
  if (som.rijMin > g.rijtijdPerDienst)
    uit.push({ id: 'rijtijd', zwaarte: 'grens',
      tekst: 'Rijtijd ' + uur(som.rijMin) + ' in deze dienst; de grens staat op ' + uur(g.rijtijdPerDienst) + '.' });

  /* De pauzeregel: na zo lang rijden hoort er pauze te zijn geweest. We kijken
     naar het TOTAAL en niet naar de volgorde -- een fijnere meting vraagt een
     tijdlijn die we hier niet altijd compleet hebben, en een te fijne meting
     die op onvolledige data een overtreding roept is erger dan een grove. */
  if (som.rijMin > g.rijtijdVoorPauze && som.pauzeMin < g.pauzeMinimaal)
    uit.push({ id: 'pauze', zwaarte: 'grens',
      tekst: 'Na ' + uur(som.rijMin) + ' rijden staat er ' + som.pauzeMin + ' minuten pauze geregistreerd; ' +
        'vanaf ' + uur(g.rijtijdVoorPauze) + ' rijden hoort dat minstens ' + g.pauzeMinimaal + ' minuten te zijn.' });
  if (som.pauzeMin >= g.pauzeMinimaal && som.langstePauze < g.pauzeDeelMinimaal)
    uit.push({ id: 'pauzedelen', zwaarte: 'let-op',
      tekst: 'De pauze is opgeknipt in delen van minder dan ' + g.pauzeDeelMinimaal + ' minuten; ' +
        'zo kort telt een deel niet mee.' });

  // vooruitkijken hoort erbij: een waarschuwing vlak voor de grens is bruikbaar
  if (!uit.some(s => s.id === 'rijtijd') && som.rijMin > g.rijtijdPerDienst - 30 && som.rijMin <= g.rijtijdPerDienst)
    uit.push({ id: 'rijtijd-bijna', zwaarte: 'let-op',
      tekst: 'Nog ' + (g.rijtijdPerDienst - som.rijMin) + ' minuten rijtijd tot de grens van ' + uur(g.rijtijdPerDienst) + '.' });
  return uit;
}

/* De rust TUSSEN twee diensten. Aparte functie, want hij kijkt naar de vorige
   dienst en niet naar de huidige. */
function rustSignaal(vorigeEindMs, startMs, grenzen) {
  const g = Object.assign({}, GRENZEN, grenzen || {});
  if (!vorigeEindMs || !startMs) return null;
  const min = Math.round((startMs - vorigeEindMs) / 60000);
  if (min >= g.dagelijkseRust) return null;
  return { id: 'dagrust', zwaarte: 'grens',
    tekst: 'Tussen deze dienst en de vorige zit ' + (Math.round(min / 6) / 10) + ' uur rust; ' +
      'de dagelijkse rust staat op ' + (g.dagelijkseRust / 60) + ' uur.' };
}

module.exports = { GRENZEN, SOORTEN, tel, signalen, rustSignaal };
