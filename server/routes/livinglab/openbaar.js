/* Living Lab, deel "openbaar": de deuren die zonder inlog en zonder labpas
   opengaan -- de onderzoekskaarten, de buurtvragen met hun stand, en de
   apparatuur die te lenen is.

   Afgesplitst van ./bewoner.js toen die over de 10 KB-keuringsgrens ging, en
   langs een echte naad: dat bestand gaat over een bewoner die MEEDOET (labpas,
   observatie, terugtrekken), dit over iedereen die alleen maar KIJKT -- een
   gemeente, een subsidiegever, een school, een buurman.

   Dat verschil is meer dan omvang: hier hoort per definitie niets te staan wat
   van een deelnemer is. Geen alias, geen waarneming, geen klacht. Wat een lab
   zelf heeft geschreven en wat te tellen is, en verder niets.

   De rem is dezelfde als bij de leeskant van ./bewoner.js; deze deuren dragen
   geen code en zijn dus alleen tegen afgrazen te beschermen, niet tegen raden. */
'use strict';

module.exports = (kern, hulp) => {
  const { app, livinglab, labfonds } = kern;
  const { veilig, lijf, remLezen, remSchrijf } = hulp;

  /* Wat een school of buurtinitiatief kan lenen, en de aanvraag zelf. Geen
     inlog: wie iets wil lenen van dit lab, heeft geen RTG-account -- en dat
     hoort geen drempel te zijn. */
  app.post('/api/lab2/publiek/apparatuur', remLezen, (req, res) => veilig(res, () => livinglab.uitleen.catalogus(lijf(req).labId)));
  app.post('/api/lab2/publiek/uitleen-aanvraag', remSchrijf, (req, res) => veilig(res, () => livinglab.uitleen.aanvraag(lijf(req))));

  /* De vragen van dit lab met hun stand -- ook de afgewezen, met de reden. Dit
     is de kant waarop een bewoner kan zien wat er met zijn vraag is gebeurd. */
  app.post('/api/lab2/publiek/vragen', remLezen, (req, res) => veilig(res, () => livinglab.vraagbesluit.vragen(lijf(req).labId, lijf(req))));

  app.post('/api/lab2/publiek/onderzoeken', remLezen, (req, res) => veilig(res, () => livinglab.publicatie.lijst(lijf(req).labId, lijf(req).n)));
  /* De onderzoekskaart, met het fondsgeld dat eraan is TOEGEZEGD erbij. Dit is
     de vraag van het lid dat inzamelde: wat is er met mijn bijdrage onderzocht?

     De samenstelling gebeurt HIER en niet in een van de twee domeinen: de kaart
     is van het lab, de toezegging van het fonds, en geen van beide hoort de
     ander na te bouwen. Ontbreekt het fonds, dan blijft de kaart gewoon staan --
     zonder financieringsblok en zonder verzonnen nul. */
  app.post('/api/lab2/publiek/onderzoek', remLezen, (req, res) => veilig(res, () => {
    const k = livinglab.publicatie.kaart(lijf(req).id);
    if (!k || k.error || !labfonds) return k;
    return Object.assign({}, k, { fonds: labfonds.financiering(lijf(req).id) });
  }));

};
