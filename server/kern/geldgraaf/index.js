/* Kern-module "geldgraaf": de financiele evenknie van kern/levensgraaf
   (GELD.md par. 1). Een ALLEEN-LEZEN projectielaag over de gelddomeinen,
   plus een vooruitblik.

   Wat dit is, in een zin: bronnen die niets van elkaar weten leveren elk hun
   feiten in dezelfde vorm (./bronnen.js), een patroonherkenner vindt er de
   terugkerende posten in (./patronen.js), een vooruitblik rekent daar het
   verwachte saldo per horizon uit (./vooruitblik.js), en de
   uitzonderingsbouw maakt er de meldingen en de verwachtingszin van
   (./uitzonderingen.js). Dit bestand zet die delen aan elkaar.

   Wat dit NIET is, en niet mag worden: een tweede boekhouding. Geen eigen
   collectie, nooit schrijven, geen eigen som van iets dat een domein al
   optelt -- de regel van kern/geldwereld.js, hier onverkort. De graaf raakt
   ook nooit db.data van een ander domein aan: alles loopt langs wat de
   domeinen exporteren.

   HET KOPPELVLAK MET DE ZUSTERLAAG kern/geldbeleid (die regels, potten en
   actielog beheert), zoals die laag het exporteert:

     geldbeleid.potten(codenaam)
       -> [{ id, naam, doelCenten, standCenten }]
     geldbeleid.evalueer(codenaam, { vrijCenten, bufferMaanden, maandUitCenten, feiten })
       -> [{ id, soort, titel, centen, uitleg, gegevens, niveau, actie }]

   De sleutel daar is de CODENAAM (privacy by design: het beleid kent geen
   accountsleutels), dus de graaf vertaalt zijn lid-key een keer via
   kern.codenaamVan. evalueer mag binnen de beleidslaag zelf handelen (de
   maandelijkse reservering op niveau automatisch, een oormerk binnen het
   eigen tegoed); de graaf zelf schrijft nooit. Werkt de zusterlaag niet (of
   gooit hij), dan komt 'beleid' in stil[] en rekent de graaf zonder
   oormerken en zonder regeloordelen door -- zichtbaar onvolledig, nooit
   stil onvolledig. */
'use strict';

const { herken } = require('./patronen');
const { bereken } = require('./vooruitblik');
const { RANG, netteUitzondering, eigenUitzonderingen, verwachtingZin } = require('./uitzonderingen');

module.exports = ({ kern, geldbeleid }) => {
  const bronnen = require('./bronnen')({ kern });

  function alles(key) {
    const v = bronnen.verzamel(key);
    const p = herken(v.feiten);
    return {
      feiten: v.feiten.concat(p.feiten),
      patronen: p.patronen,
      stil: v.stil.slice(),
      bronnen: v.bronnen
    };
  }

  /* De codenaam is de sleutel van de beleidslaag; kan hij niet worden
     opgezocht, dan is dat een stille beleid-bron en geen omgevallen cockpit. */
  function codenaamVeilig(key, stil) {
    try { return kern.codenaamVan(key); }
    catch (e) {
      if (!stil.includes('beleid')) stil.push('beleid');
      return null;
    }
  }

  /* vrijCenten = walletsaldo minus de som van de potten-standen. Potten zijn
     oormerken binnen het eigen tegoed, geen rekeningen: pay kent ze niet, en
     daarom is dit aftrekken geen tweede boekhouding maar een oormerk-bril op
     het ene echte saldo. */
  function pottenTotaal(codenaam, stil) {
    try {
      const p = geldbeleid.potten(codenaam);
      const lijst = Array.isArray(p) ? p : (p && Array.isArray(p.potten) ? p.potten : []);
      let som = 0;
      for (const pot of lijst) som += Math.max(0, Math.round(Number(pot.standCenten) || 0));
      return som;
    } catch (e) {
      if (!stil.includes('beleid')) stil.push('beleid');
      return 0;
    }
  }

  function beleidOordelen(codenaam, maat, feiten, stil) {
    try {
      const uit = geldbeleid.evalueer(codenaam, {
        vrijCenten: maat.vrijCenten,
        bufferMaanden: maat.bufferMaanden,
        maandUitCenten: maat.maandUitCenten,
        feiten
      });
      const lijst = Array.isArray(uit) ? uit : (uit && Array.isArray(uit.uitzonderingen) ? uit.uitzonderingen : []);
      return lijst.map(netteUitzondering);
    } catch (e) {
      if (!stil.includes('beleid')) stil.push('beleid');
      return [];
    }
  }

  /* ---- de drie uitgangen ---- */

  /* Alle feiten, voor wie erop wil redeneren (de gegronde Rahul-route). De
     vaste vorm van GELD.md par. 1; afgeleiden zijn herkenbaar aan hun soort
     ('vast', 'loon-verwacht'), zodat een lezer feit en verwachting nooit
     hoeft te raden. */
  function feiten(key) {
    const a = alles(key);
    return { feiten: a.feiten, stil: a.stil, bronnen: a.bronnen };
  }

  /* De tijdlijn: het financiele geheugen, nieuwste eerst, hooguit twintig.
     Alleen feiten met een klok (`tijd`) doen mee -- een stand of een
     verwachting is geen gebeurtenis en hoort niet tussen de gebeurtenissen. */
  function tijdlijnRijen(a) {
    return a.feiten.filter(f => f.tijd)
      .sort((x, y) => String(y.tijd).localeCompare(String(x.tijd)))
      .slice(0, 20)
      .map(f => ({ tijd: f.tijd, titel: f.titel, centen: f.centen, richting: f.richting, bron: f.bron, link: f.link }));
  }
  function tijdlijn(key) {
    const a = alles(key);
    return { tijdlijn: tijdlijnRijen(a), stil: a.stil, bronnen: a.bronnen };
  }

  /* Het cockpitbeeld: exact het contract van POST /api/geld/cockpit, zonder
     `ok` (dat zet de route erbij). De route mag dit antwoord doorgeven
     zonder er iets aan te rekenen. */
  function cockpit(key) {
    const a = alles(key);
    const stil = a.stil;

    /* Valt de wallet weg, dan rekent de graaf met nul door en staat 'wallet'
       in stil[]: het scherm hoort dat als "beeld onvolledig" te tonen. Nul
       plus een stille-bron-melding is eerlijker dan helemaal geen cockpit,
       want de andere bronnen (open verrekeningen!) zijn er nog wel. */
    const saldoFeit = a.feiten.find(f => f.soort === 'saldo' && f.bron === 'wallet');
    const saldoCenten = saldoFeit && Number.isFinite(saldoFeit.centen) ? saldoFeit.centen : 0;

    const vb = bereken({ saldoCenten, patronen: a.patronen, feiten: a.feiten });
    const codenaam = codenaamVeilig(key, stil);
    const vrijCenten = saldoCenten - pottenTotaal(codenaam, stil);

    const maat = { vrijCenten, bufferMaanden: vb.bufferMaanden, maandUitCenten: vb.maandUitCenten };
    const uitzonderingen = eigenUitzonderingen(a.patronen, a.feiten)
      .concat(beleidOordelen(codenaam, maat, a.feiten, stil))
      .sort((x, y) => RANG[x.niveau] - RANG[y.niveau]);

    /* evalueer mag een automatische maandreservering hebben uitgevoerd (een
       oormerk binnen het eigen tegoed); de potten opnieuw lezen zodat het
       antwoord de stand NA die reservering toont. De regel zelf is tegen de
       stand vooraf beoordeeld, en dat hoort ook zo: hij ging over de
       situatie waarin hij afging. */
    const vrijNa = saldoCenten - pottenTotaal(codenaam, stil);

    return {
      cijfers: {
        vrijCenten: vrijNa,
        lasten14dCenten: vb.lasten14dCenten,
        eindeMaandCenten: vb.eindeMaand.saldoCenten,
        bufferMaanden: vb.bufferMaanden
      },
      verwachting: verwachtingZin(stil, vb),
      uitzonderingen,
      tijdlijn: tijdlijnRijen(a),
      vooruitblik: { d7: vb.d7.saldoCenten, d30: vb.d30.saldoCenten, d90: vb.d90.saldoCenten },
      stil,
      bronnen: a.bronnen
    };
  }

  return { geldgraaf: { cockpit, tijdlijn, feiten } };
};
