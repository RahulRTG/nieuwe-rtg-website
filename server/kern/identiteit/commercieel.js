/* ============================================================================
   COMMERCIELE COMMUNICATIE -- toestemming, en niet een voorkeur.

   HET VERSCHIL DAT DIT BESTAND BESTAANSRECHT GEEFT. Dit huis had al
   meldingsvoorkeuren (kern/ervaring.js, MELDING_SCOPES) en die staan STANDAARD
   AAN: dat zijn serviceberichten -- uw bestelling is onderweg, uw reservering is
   bevestigd. Ze uitzetten is een gemak dat wij aanbieden.

   Commerciele post is het omgekeerde en dat is geen stijlkeuze maar de wet:
   zonder toestemming geen aanbieding. Alles hier staat dus standaard UIT, en
   het aanzetten is een handeling van het lid die met tijdstip en herkomst wordt
   vastgelegd. Wie de twee door elkaar haalt, bouwt een opt-out waar een opt-in
   hoort -- en dat is precies de fout die een boete oplevert in plaats van een
   klacht.

   WAT ER NOOIT ONDER VALT staat in ALTIJD hieronder, met de reden per regel.
   Een beveiligingswaarschuwing, een factuur en een wettelijk bericht zijn geen
   marketing; ze uitzetbaar maken zou betekenen dat een lid zichzelf blind kan
   zetten voor het bericht dat hij het hardst nodig heeft. Die lijst gaat mee
   naar het scherm, want een toestemmingsscherm dat alleen toont wat je KUNT
   uitzetten, laat denken dat de rest ook uit kan.

   DE GESCHIEDENIS GROEIT AAN EN WORDT NOOIT HERSCHREVEN. Bij een klacht is de
   vraag niet "staat het aan" maar "wanneer heeft hij ja gezegd, en waar". Een
   stand zonder herkomst is geen bewijs van toestemming; hij is een bewering dat
   er ooit toestemming was.
   ========================================================================== */
'use strict';

const klok = require('../../lib/klok');

/* De soorten post waarvoor toestemming nodig is. Elk met wat het IS in de
   woorden van een lid -- "productnieuws" zegt niets, "wij mailen u als er iets
   verandert aan wat u gebruikt" wel. */
const SOORTEN = [
  { id: 'aanbiedingen', naam: 'Aanbiedingen en reisvoorstellen',
    wat: 'Post over reizen, arrangementen en acties die RTG zelf aanbiedt.' },
  { id: 'productnieuws', naam: 'Nieuws over wat u gebruikt',
    wat: 'Bericht als er iets verandert aan een onderdeel dat u gebruikt, of als er iets bijkomt.' },
  { id: 'onderzoek', naam: 'Vragen om uw mening',
    wat: 'Een enquete of een uitnodiging om mee te denken. Nooit vaker dan een paar keer per jaar.' },
  { id: 'partners', naam: 'Post namens partners',
    wat: 'Aanbiedingen van zaken die bij RTG zijn aangesloten. RTG verstuurt die zelf; uw adres gaat er niet heen.' }
];

const KANALEN = [
  { id: 'email', naam: 'E-mail' },
  { id: 'sms', naam: 'Sms' },
  { id: 'push', naam: 'Bericht in de app' }
];

/* WAT HIER NOOIT ONDER VALT. Deze regels gaan mee naar het scherm. */
const ALTIJD = [
  { naam: 'Beveiligingswaarschuwingen',
    reden: 'Een bericht dat er op uw account is ingelogd of dat uw herstelkanaal wijzigt, is geen aanbieding. Dat uitzetbaar maken zou u blind zetten voor het enige bericht dat u op tijd kunt tegenhouden.' },
  { naam: 'Facturen, betalingen en incasso',
    reden: 'Dat is de uitvoering van een overeenkomst en geen marketing. U kunt niet afzien van bericht over uw eigen geld.' },
  { naam: 'Wettelijk verplichte mededelingen',
    reden: 'Een wijziging van de voorwaarden of een melding die de wet ons oplegt, gaat door ongeacht wat hier staat.' },
  { naam: 'Antwoord op iets dat u zelf vroeg',
    reden: 'Vraagt u iets aan de concierge of aan de klantenservice, dan krijgt u antwoord. Dat is geen post die wij u sturen maar post die u heeft uitgelokt.' }
];

const SOORT_IDS = SOORTEN.map(s => s.id);
const KANAAL_IDS = KANALEN.map(k => k.id);
const MAX_GESCHIEDENIS = 200;

function maakCommercieel({ db, save }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/identiteit',
    bezit: { commercieel: 'kaart' } });
  const bak = () => eigen.bak('commercieel');

  const rij = (key) => {
    const b = bak();
    if (!b[key]) b[key] = { standen: {}, geschiedenis: [] };
    return b[key];
  };

  /* De stand. Alles wat NIET in de opslag staat, staat uit -- dat is de kern
     van een opt-in: afwezigheid is geen toestemming. */
  function standVan(key) {
    const r = bak()[String(key)] || { standen: {} };
    return {
      soorten: SOORTEN.map(s => {
        const g = r.standen[s.id];
        const aan = !!(g && g.kanalen && g.kanalen.length);
        return Object.assign({}, s, {
          aan, kanalen: aan ? g.kanalen : [],
          sinds: aan ? g.gegeven : null,
          /* De herkomst hoort ZICHTBAAR te zijn voor het lid zelf. Wie leest
             "u gaf dit op 3 maart via het aanmeldscherm" kan zich dat herinneren
             of juist niet -- en dat tweede is het begin van een klacht die
             terecht is. */
          gegevenVia: aan ? g.bron : null
        });
      }),
      kanalen: KANALEN, altijd: ALTIJD,
      uitleg: 'Alles hier staat uit tot u het aanzet. Zet u iets uit, dan stopt het meteen; wat wij eerder verstuurden blijft in uw postvak staan.'
    };
  }

  /* ZETTEN. Een lege kanalenlijst is intrekken -- dat is geen truc maar de
     eerlijkste vorm: "waar mag dit heen" met nul antwoorden betekent nergens.
     Beide bewegingen komen in de geschiedenis; een intrekking die niet wordt
     vastgelegd, is een intrekking die je niet kunt aantonen. */
  function zet(key, soort, kanalen, bron) {
    const sid = String(soort || '');
    if (!SOORT_IDS.includes(sid)) return { status: 400, error: 'Die soort post kent RTG niet.' };
    const lijst = Array.isArray(kanalen) ? kanalen.filter(k => KANAAL_IDS.includes(k)) : [];
    const r = rij(String(key));
    const oud = r.standen[sid];
    const oudeKanalen = (oud && oud.kanalen) || [];
    const nu = klok.datum().toISOString();
    const herkomst = String(bron || '').slice(0, 60) || 'onbekend';

    if (!lijst.length) delete r.standen[sid];
    else r.standen[sid] = { kanalen: lijst, gegeven: nu, bron: herkomst };

    /* Niets veranderd is geen gebeurtenis: anders staat de geschiedenis vol met
       regels waarin niets gebeurde, en dan is hij als bewijs onleesbaar. */
    if (oudeKanalen.join(',') !== lijst.join(',')) {
      r.geschiedenis.unshift({ op: nu, soort: sid, van: oudeKanalen, naar: lijst, bron: herkomst,
        handeling: lijst.length ? (oudeKanalen.length ? 'gewijzigd' : 'gegeven') : 'ingetrokken' });
      if (r.geschiedenis.length > MAX_GESCHIEDENIS) r.geschiedenis.length = MAX_GESCHIEDENIS;
    }
    save();
    return { ok: true, stand: standVan(key) };
  }

  /* ALLES UIT, in een handeling. Hij bestaat omdat "afmelden moet net zo
     makkelijk zijn als aanmelden" geen vriendelijkheid is maar een eis: wie
     vier vinkjes moet omzetten om van post af te komen, is niet afgemeld maar
     afgeschrikt. */
  function allesUit(key, bron) {
    const r = bak()[String(key)];
    const soorten = r ? Object.keys(r.standen) : [];
    for (const s of soorten) zet(key, s, [], bron || 'afmeldknop');
    return { ok: true, uitgezet: soorten.length, stand: standVan(key) };
  }

  function geschiedenisVan(key) {
    const r = bak()[String(key)] || { geschiedenis: [] };
    return { geschiedenis: r.geschiedenis,
      uitleg: 'Deze lijst groeit aan en wordt nooit herschreven. Bij een klacht is de vraag niet of iets aanstaat, maar wanneer u ja zei en waar.' };
  }

  /* DE POORT WAAR EEN VERZENDER LANGS MOET. Geeft alleen true terug bij een
     vastgelegde toestemming voor DIT kanaal. Er is met opzet geen variant die
     "bij twijfel wel" doet. */
  function mag(key, soort, kanaal) {
    const r = bak()[String(key)];
    const g = r && r.standen[String(soort || '')];
    return !!(g && (g.kanalen || []).includes(String(kanaal || '')));
  }

  return { standVan, zet, allesUit, geschiedenisVan, mag, SOORTEN, KANALEN, ALTIJD };
}

module.exports = { maakCommercieel, SOORTEN, KANALEN, ALTIJD };
