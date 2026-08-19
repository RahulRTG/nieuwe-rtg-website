/* Plaatslaag, deel "waarnemen": WAT ERBINNEN VALT, EN WAT ERUIT KOMT.

   Een waarneming is dat een hek is binnengekomen of verlaten, met de tijd. Meer
   niet. Ze draagt een codenaam en nooit een naam, en ze draagt het doel waarvoor
   ze is gemaakt.

   DE COORDINAATWEIGERING, en dit is geen nette extra maar de kern van het
   ontwerp. waarneem() WEIGERT een verzoek waar een lat of lng in staat. Niet
   "negeert" -- weigert, met een fout. Want een veld dat je stil weggooit, staat
   er over een half jaar weer in omdat iemand dacht dat het meeging, en dan is
   "een coordinaat verlaat het toestel niet" een verhaal geworden in plaats van
   een eigenschap. Een fout valt op, en in een toets zakt hij.

   Afgesplitst van ./venster.js toen dat over de leesgrens ging. De toestemming
   staat daar, de lijsten in ./opslag.js. */
'use strict';

module.exports = ({ db, save, opslag, kentHek }) => {
  const { nu, id, vensters, waarnemingen, logboek, open, ruim, schrijfLog, WAARNEEM_MAX } = opslag;

  /* DE WAARNEMING. Het toestel heeft zelf gerekend; wij horen de uitkomst.
     Merk op wat hier NIET binnenkomt en ook niet mag: een positie. */
  function waarneem(codenaam, w) {
    ruim();
    if (!codenaam) return { status: 401, error: 'Geen lid.' };
    const body = w || {};
    /* De coordinaatweigering. Zie de kop van dit bestand: stil weggooien zou
       betekenen dat een volgende versie hem ongemerkt kan gaan meesturen. */
    for (const veld of ['lat', 'lng', 'lon', 'coords', 'positie', 'nauwkeurig']) {
      if (body[veld] !== undefined) {
        return { status: 400, error: 'Deze route neemt geen positie aan; stuur alleen welk hek is gepasseerd. ' +
          'Een coordinaat hoort binnen een venster van het domein dat hem nodig heeft (PLAATS.md par. 1).' };
      }
    }
    const doel = String(body.doel || '');
    const venster = vensters().find(x => x.codenaam === codenaam && x.doel === doel && open(x));
    if (!venster) return { status: 403, error: 'Geen open venster voor dit doel.' };
    const hek = String(body.hek || '');
    if (!kentHek(doel, hek)) return { status: 400, error: 'Onbekend hek.' };
    const wat = body.wat === 'buiten' ? 'buiten' : body.wat === 'binnen' ? 'binnen' : null;
    if (!wat) return { status: 400, error: 'Een waarneming is binnen of buiten.' };
    /* Dezelfde overgang twee keer op rij is geen tweede feit. Een toestel dat op
       de rand van een hek staat, wisselt anders tientallen keren per minuut, en
       dan staat het actielog vol met ruis waar niemand doorheen komt. */
    const vorige = waarnemingen().find(x => x.venster === venster.id && x.hek === hek);
    if (vorige && vorige.wat === wat) return { status: 200, waarneming: vorige, nieuw: false };

    const waarneming = { id: id(), codenaam, doel, venster: venster.id, hek, wat, at: nu() };
    waarnemingen().unshift(waarneming);
    const mijn = waarnemingen().filter(x => x.codenaam === codenaam);
    if (mijn.length > WAARNEEM_MAX) {
      const weg = new Set(mijn.slice(WAARNEEM_MAX).map(x => x.id));
      db.data.plaatsWaarnemingen = waarnemingen().filter(x => !weg.has(x.id));
    }
    schrijfLog(codenaam, 'waargenomen', { doel, hek, richting: wat });
    save();
    return { status: 200, waarneming, nieuw: true };
  }

  /* Wat weet RTG nu van mij? Zelf-inzage gaat vrij, zoals overal in dit huis.
     Dit is bewust een compleet antwoord: welke vensters staan open, waarom, tot
     wanneer, en wat er binnen is waargenomen. Wie dit scherm opent, hoort niets
     te ontdekken dat hij hier niet ziet staan. */
  function stand(codenaam) {
    ruim();
    const mijn = vensters().filter(v => v.codenaam === codenaam && open(v));
    return { status: 200,
      vensters: mijn.map(v => ({ doel: v.doel, bron: v.bron, geopend: v.geopend, sluit: v.sluit })),
      waarnemingen: waarnemingen().filter(w => w.codenaam === codenaam)
        .map(w => ({ doel: w.doel, hek: w.hek, wat: w.wat, at: w.at })),
      log: logboek().filter(r => r.codenaam === codenaam).slice(0, 50)
        .map(r => ({ wat: r.wat, at: r.at, doel: r.doel || null, hek: r.hek || null,
          richting: r.richting || null, bron: r.bron || null })) };
  }

  /* Voor de domeinen: staat dit lid binnen dit hek, en sinds wanneer. Dit is het
     enige dat een werkgever te zien krijgt (grens 4 uit PLAATS.md): binnen of
     buiten, met een tijd. Niet de coordinaat, en ook niet hoe ver erbuiten. */
  function aanwezig(codenaam, doel, hek) {
    ruim();
    const w = waarnemingen().find(x => x.codenaam === codenaam && x.doel === String(doel || '') && x.hek === String(hek || ''));
    if (!w) return { binnen: false, sinds: null, bekend: false };
    return { binnen: w.wat === 'binnen', sinds: w.at, bekend: true };
  }

  /* DE BEVESTIGING: het antwoord dat elk domein krijgt, en het is er ÉÉN.

     Aanwezigheid heeft DRIE uitkomsten en geen twee, en dat verschil is het hele
     punt. "Niet bevestigd" en "niet gemeten" zijn niet hetzelfde: het eerste
     betekent dat het toestel keek en je stond er niet, het tweede dat er
     niemand heeft gekeken -- geen venster, geen gekoppeld account, of een
     toestel dat niets afgaf. Wie die twee op één hoop gooit, maakt van elke
     ongemeten inklok een verdachte inklok, en dan is dit geen aanwezigheidslaag
     meer maar een beschuldigingslaag.

     WAT ER NIET UIT KOMT is een oordeel. Er staat geen score op, geen
     percentage, geen "vaak buiten het hek". Grens 3 van PLAATS.md: het weefsel
     vormt geen oordeel over een persoon en plaats verandert daar niets aan. Een
     domein dat hierop wil handelen, doet dat zelf en zichtbaar. */
  function bevestig(codenaam, doel, hek) {
    if (!codenaam) return { bevestigd: false, gemeten: false, sinds: null, reden: 'geen codenaam' };
    ruim();
    const venster = vensters().find(x => x.codenaam === codenaam && x.doel === String(doel || '') && open(x));
    if (!venster) return { bevestigd: false, gemeten: false, sinds: null, reden: 'geen venster' };
    const a = aanwezig(codenaam, doel, hek);
    if (!a.bekend) return { bevestigd: false, gemeten: false, sinds: null, reden: 'niets waargenomen' };
    return { bevestigd: a.binnen, gemeten: true, sinds: a.sinds, reden: null };
  }

  return { waarneem, stand, aanwezig, bevestig };
};
