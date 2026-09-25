/* ============================================================================
   NIEMAND KWIJT -- een invariant en geen KPI (POLITIEK.md par. 11, DO-02).

   Wat deze meter NIET zegt: "99,7% teruggekoppeld". Een percentage laat een
   kwestie die verdween wegvallen tegen honderd die goed gingen. Hij zegt per
   stand hoeveel er staan, en daarnaast, apart en nooit opgeteld: hoeveel er
   ONVERKLAARD zijn. Dat laatste getal hoort nul te zijn, altijd.

   VERKLAARD betekent: de kwestie staat in een stand die iemand kan uitleggen,
   ook als die stand "wacht nog" is. Een terugkoppeling die klaarstaat maar
   waarvan de wek nog niet uitging, is verklaard -- de uitkomst is voor de
   inbrenger al te lezen, en herbezorgen haalt de wek in.

   ONVERKLAARD is een BREUK, en elke breuk draagt een soort en een uitleg:
     verdwenen                het journaal kent de kwestie, de opslag niet
     buiten-journaal          de kwestie bestaat, het journaal weet er niets van:
                              iemand schreef hem buiten de enige schrijver om
     geschiedenis-gewijzigd   de hashketen van zijn tijdlijn klopt niet meer
     journaal-gewijzigd       de hashketen van het journaal klopt niet meer
     toestand-onverklaarbaar  een stand of eindstand die niet in de gesloten
                              lijst staat, of een eindstand zonder reden
     terugkoppeling-ontbreekt afgesloten, maar zonder terugkoppeling
     inbrenger-onbereikbaar   geen koppeling naar een mens, en ook niet bewust
                              vergeten

   DE METER LEEST ALLEEN. Hij verklaart niets tot normaal: wat hij vindt, staat
   er. Een breuk verdwijnt pas als de oorzaak weg is. */
'use strict';

const keten = require('../../lib/keten');
const { LOPEND, EINDSTAND_VAN, TERUGKOPPELING } = require('./eindstanden');

function meet({ kwesties, journaal, koppeling }) {
  const kaart = kwesties || {};
  const jr = Array.isArray(journaal) ? journaal : [];
  const breuken = [];
  const breuk = (kwestie, soort, uitleg) => breuken.push({ kwestie, soort, uitleg });

  const tel = {
    ingebracht: 0, inBehandeling: 0, wachtOpBevoegde: 0,
    besluitWekNogNietUit: 0, wachtOpInbrenger: 0, rond: 0
  };
  /* Verklaard en apart geteld: wie bewust vergeten wilde worden. Geen breuk,
     maar ook niet onzichtbaar. */
  let vergeten = 0;
  const perEindstand = {};

  const j = keten.verifieer(jr);
  if (!j.ok) breuk(null, 'journaal-gewijzigd', 'de hashketen van het journaal klopt niet meer op ' + j.gebroken.length + ' plek(ken)');

  const inJournaal = new Set(jr.map(r => r && r.kwestie).filter(Boolean));
  for (const id of inJournaal) {
    if (!kaart[id]) breuk(id, 'verdwenen', 'het journaal kent deze kwestie, de opslag niet');
  }

  for (const id of Object.keys(kaart)) {
    const k = kaart[id];
    if (!inJournaal.has(id)) breuk(id, 'buiten-journaal', 'deze kwestie staat niet in het journaal');
    const t = keten.verifieer(k && k.tijdlijn);
    if (!t.ok) breuk(id, 'geschiedenis-gewijzigd', 'de hashketen van de tijdlijn klopt niet meer');
    const rondes = (k && Array.isArray(k.rondes)) ? k.rondes : [];
    if (!rondes.length) { breuk(id, 'toestand-onverklaarbaar', 'de kwestie heeft geen behandelronde'); continue; }

    for (const r of rondes) {
      if (r.stand === 'afgesloten') {
        const e = r.eindstand && EINDSTAND_VAN.get(r.eindstand.stand);
        if (!e) { breuk(id, 'toestand-onverklaarbaar', 'ronde ' + r.nr + ' is afgesloten zonder geldige eindstand'); continue; }
        if (!r.eindstand.at || (!e.alleenInbrenger && !r.eindstand.toelichting)) {
          breuk(id, 'toestand-onverklaarbaar', 'ronde ' + r.nr + ' heeft een eindstand zonder reden');
        }
        if (!r.terugkoppeling || !Object.keys(r.terugkoppeling).length) {
          breuk(id, 'terugkoppeling-ontbreekt', 'ronde ' + r.nr + ' is afgesloten zonder terugkoppeling');
        }
      } else if (!LOPEND.includes(r.stand)) {
        breuk(id, 'toestand-onverklaarbaar', 'ronde ' + r.nr + ' staat op "' + r.stand + '", en die stand bestaat niet');
      }
    }

    const ontvangers = [k.inbrenger].concat(k.volgers || []);
    for (const ref of ontvangers) {
      if (!koppeling.bekend(ref)) breuk(id, 'inbrenger-onbereikbaar', 'geen koppeling naar een mens voor ' + ref);
      else if (koppeling.vergeten(ref)) vergeten++;
    }

    const h = rondes[rondes.length - 1];
    if (h.stand === 'ingebracht') tel.ingebracht++;
    else if (h.stand === 'in-behandeling') tel.inBehandeling++;
    else if (h.stand === 'wacht-op-bevoegde') tel.wachtOpBevoegde++;
    else if (h.stand === 'afgesloten' && h.eindstand && h.terugkoppeling) {
      perEindstand[h.eindstand.stand] = (perEindstand[h.eindstand.stand] || 0) + 1;
      const standen = Object.keys(h.terugkoppeling)
        .filter(ref => !koppeling.vergeten(ref))
        .map(ref => h.terugkoppeling[ref].stand);
      if (standen.some(s => !TERUGKOPPELING.includes(s))) {
        breuk(id, 'toestand-onverklaarbaar', 'een terugkoppeling staat in een onbekende stand');
      } else if (standen.includes('klaargezet')) tel.besluitWekNogNietUit++;
      else if (standen.includes('gewekt')) tel.wachtOpInbrenger++;
      else tel.rond++;
    }
  }

  return {
    ok: true,
    kwesties: Object.keys(kaart).length,
    staan: tel,
    perEindstand,
    inbrengersVergeten: vergeten,
    onverklaard: breuken.length,
    breuken,
    journaal: { regels: jr.length, top: keten.top(jr), ketenKlopt: j.ok },
    zegtNiet: [
      'geen percentage: een verdwenen kwestie valt niet weg tegen honderd goede',
      'niet of een uitkomst goed of rechtvaardig was -- alleen dat hij er is, met een reden',
      'niet dat de NIEUWSTE journaalregels er nog zijn: dat vraagt een anker buiten deze opslag (POLITIEK.md par. 8)',
      '"wachtOpInbrenger" is geen achterstand van het huis: de uitkomst staat klaar en is te lezen'
    ]
  };
}

module.exports = { meet };
