/* DE WAARDEPOORT: de vraag die VOOR elke boeking gesteld hoort te worden.

   In ./index.js stond een regel die zei "heeft deze rekening genoeg?", en dat
   bleef lang de enige vraag -- terecht, want er was maar EEN soort waarde: een
   getal op lid:<codenaam>. Zodra een werkgeversbudget, een gemeentetegoed of
   een cadeaubon hetzelfde grootboek gebruikt, is genoeg saldo de verkeerde
   vraag geworden: het zegt niets over of DIT tegoed hier voor bedoeld was.

   De oude regel blijft letterlijk staan en gaat als eerste. Hij is de bodem die
   er ook is als de waardelaag niet gemount is -- en dat is geen theorie: deze
   laag is optioneel, en een optionele laag die stilzwijgend een controle
   meeneemt, neemt hem weg zodra iemand hem niet mount.

   De poort komt daar bovenop en is strenger op drie punten:
     - gereserveerd geld telt niet als beschikbaar (kern/waarde/reserve.js);
     - het beleid van de uitgever en van de houder geldt (kern/waarde/policy.js);
     - de ontvangende wallet heeft een plafond (kern/waarde/index.js).

   WAAROM DIT EEN EIGEN BESTAND IS. ./index.js stond op 10414 byte na deze
   toevoeging, over de grens van 10240 uit de keuring. Dit is de naad met de
   minste bedrading eroverheen -- er gaan twee functies in en er komt een
   oordeel uit -- en het is dezelfde reden waarom ./stand.js bestaat. */
'use strict';

module.exports = ({ saldoVan, grootboek, waarde, nu }) => {
  /* De eigen grens van het lid komt uit kern/geldbeleid, en die laag wordt NA
     pay gemount (kernlaag3b). Vandaar late binding, zoals de bankdekking in
     ./opladen.js. Niet gekoppeld = geen eigen grenzen, en dan gedraagt alles
     zich als voorheen. */
  let grensVan = null;
  function koppelGrens(fn) { grensVan = typeof fn === 'function' ? fn : null; }

  /* Wat gaf dit LID vandaag en deze maand uit, over al zijn posities samen?
     Dit is een andere vraag dan wat er van EEN positie af ging (dat rekent
     kern/pay/samen.js uit voor de dagmax van een uitgever). Een persoonlijke
     grens die per potje zou tellen, is geen grens.

     Teruggeboekte delen tellen niet mee, en een boeking naar een eigen positie
     evenmin: geld van je wallet naar je eigen budget schuiven is geen uitgave,
     en zou anders je eigen maandgrens opeten. */
  function besteedDoor(codenaam) {
    if (!waarde) return { dag: 0, maand: 0 };
    const eigen = new Set(waarde.positiesVan(codenaam));
    /* Uit de huisklok en niet uit het besturingssysteem: dag- en maandgrenzen
       zijn precies wat je met een verzette klok (RTG_KLOK) wilt beproeven --
       wat doet een daglimiet die middernacht passeert? */
    const vandaag = new Date(nu());
    const dagSleutel = vandaag.toISOString().slice(0, 10);
    const maandSleutel = vandaag.toISOString().slice(0, 7);
    let dag = 0, maand = 0;
    for (const r of grootboek()) {
      if (!eigen.has(r.van) || r.soort === 'terug') continue;
      if (eigen.has(r.naar)) continue;
      const stempel = new Date(r.at || 0).toISOString();
      if (stempel.slice(0, 7) !== maandSleutel) break;   // het grootboek is nieuwste-eerst
      maand += r.centen;
      if (stempel.slice(0, 10) === dagSleutel) dag += r.centen;
    }
    return { dag, maand };
  }

  /* `genre` en `dagBesteed` reizen mee met de boeking en worden hier
     doorgegeven, want zonder die twee kan de poort een beleidsregel niet
     toetsen -- en een poort die de helft van het beleid niet kent, keurt de
     andere helft ten onrechte goed.

     Dat is geen theorie: de samensteller (kern/waarde/samenstellen.js) koos een
     maaltijdbudget omdat hij WEL wist bij wat voor zaak er betaald werd, en de
     poort weigerde dezelfde boeking omdat hij het niet wist. Twee lagen die
     hetzelfde beleid toetsen op verschillende gegevens, geven verschillende
     antwoorden -- en de strengste wint, dus de betaling ketste af. */
  function waardePoort({ van, naar, centen, soort, genre, dagBesteed }) {
    if (!van.startsWith('extern:') && saldoVan(van) < centen) return { status: 402, error: 'Onvoldoende saldo.' };
    if (!waarde) return null;
    /* Van WIE is de betalende positie? Bij 'lid:X' is dat X, bij een uitgegeven
       budget de eigenaar. Zonder die stap zou een persoonlijke grens alleen op
       de eigen wallet gelden en niet op de budgetten van hetzelfde lid -- en
       dan is hij te omzeilen door uit een ander potje te betalen. */
    const bron = waarde.positie(van);
    const eigenaar = bron ? bron.eigenaar : null;
    let eigenBeleid = null, dagBestedTotaal = 0, maandBestedTotaal = 0;
    if (eigenaar && grensVan) {
      eigenBeleid = grensVan(eigenaar, genre);
      if (eigenBeleid) {
        const b = besteedDoor(eigenaar);
        dagBestedTotaal = b.dag; maandBestedTotaal = b.maand;
      }
    }
    return waarde.poort({ van, naar, centen, soort, genre, dagBesteed,
      eigenBeleid, dagBestedTotaal, maandBestedTotaal, saldoVan });
  }
  waardePoort.koppelGrens = koppelGrens;
  return waardePoort;
};
