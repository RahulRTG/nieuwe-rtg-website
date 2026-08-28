/* HET BRONNENREGISTER: waar komen de regels vandaan, en hoeveel gezag heeft dat.

   De Regelwacht kon al een bron ophalen: EEN url uit FISCAAL_BRON_URL, met een
   vorm die precies moest passen. Dat werkt zolang er precies een bron is en die
   toevallig onze taal spreekt. In de praktijk is het anders: de officiele bron
   voor de EU-btw-tarieven is de Taxes in Europe Database van de Europese
   Commissie (een SOAP-dienst), daaromheen bestaan spiegels die dezelfde
   gegevens als JSON aanbieden, en voor loonregels en zzp-regimes zijn het weer
   andere partijen.

   DRIE DINGEN DIE EEN BRON MOET DRAGEN, en die nergens stonden:

     gezag     officieel   de instantie zelf
               afgeleid    een spiegel van de officiele bron
               indicatief  een verzameling zonder officiele herkomst
     dekking   welke landen en welke velden hij eigenlijk zegt te kennen
     vorm      hoe zijn antwoord eruitziet, en welke adapter hem vertaalt

   WAAROM GEZAG ERTOE DOET EN NIET ALLEEN NETJES IS. Een spiegel kan achterlopen,
   een veld anders interpreteren, of stilletjes stoppen met bijwerken. Dat maakt
   hem niet onbruikbaar -- de officiele dienst is SOAP en niet iedereen wil dat
   -- maar het hoort wel bij het getal te staan. Een tarief dat uit een spiegel
   komt en een tarief uit de instantie zelf zijn niet even hard, en de jaargang
   (kern/fiscaal/jaargangen.js) bewaart dus WELKE bron het zei.

   EN GEEN ENKELE BRON LEVERT EEN GOEDGEKEURDE JAARGANG. Alleen wat het kantoor
   doorvoert is `goedgekeurd`; wat hier binnenkomt is `ongecontroleerd` tot een
   mens het aanmerkt. Dat was al zo en blijft zo -- automatisch binnenhalen is
   iets anders dan ongezien in gebruik nemen.

   URLS STAAN NIET IN DIT BESTAND. Elke bron leest zijn adres uit een
   omgevingsvariabele. Een url in de repository is een keuze die niemand heeft
   gemaakt en die bij elke uitrol meereist. */
'use strict';

const tedb = require('./tedb');

const BRONNEN = Object.freeze({
  tedb: {
    naam: 'Taxes in Europe Database (Europese Commissie)',
    gezag: 'officieel',
    dekking: { landen: 'EU-lidstaten', velden: ['tarieven.standaard'] },
    vorm: 'SOAP; een spiegel die dezelfde velden als JSON levert past ook',
    env: 'FISCAAL_BRON_TEDB',
    adapter: tedb.vertaal,
    let: 'Levert tarieven per SOORT (standard/reduced), niet per categorie. Alleen het standaardtarief is zonder oordeel toe te wijzen; de rest wordt gesignaleerd.'
  },
  spiegel: {
    naam: 'Spiegel van de TEDB (derde partij, JSON)',
    gezag: 'afgeleid',
    dekking: { landen: 'EU en enkele daarbuiten', velden: ['tarieven.standaard'] },
    vorm: 'JSON, zelfde vocabulaire als de TEDB',
    env: 'FISCAAL_BRON_SPIEGEL',
    adapter: tedb.vertaal,
    let: 'Een spiegel kan achterlopen of stoppen met bijwerken. Bruikbaar, maar het gezag staat bij het getal.'
  }
});

function maakBronnen({ db, save, LANDEN, fetchImpl, nu }) {
  const haalHttp = fetchImpl || ((...a) => fetch(...a));
  const tijd = nu || (() => new Date().toISOString());

  const eigen = require('../../eigencollectie')({ db, domein: 'kern/fiscaal/bronnen/index', bezit: { fiscaalBronnen: 'kaart' } });
  const staat = () => eigen.bak('fiscaalBronnen');
  const urlVan = (sleutel) => process.env[BRONNEN[sleutel].env] || '';

  /* Wat er van een bron te verwachten valt -- zonder hem aan te roepen. Een
     scherm dat wil weten of dit huis zijn regels ergens vandaan haalt, hoort
     dat te kunnen zien zonder een netwerkverzoek te doen. */
  function status() {
    const st = staat();
    return Object.entries(BRONNEN).map(([sleutel, b]) => ({
      sleutel, naam: b.naam, gezag: b.gezag, dekking: b.dekking, vorm: b.vorm,
      env: b.env, geconfigureerd: !!urlVan(sleutel), let: b.let,
      laatstGehaald: (st[sleutel] || {}).at || null,
      laatsteUitslag: (st[sleutel] || {}).uitslag || null,
      signalen: ((st[sleutel] || {}).signalen || []).length
    }));
  }

  /* Ophalen en vertalen. Geeft ALTIJD een uitslag terug en gooit nooit: een
     bron die eruit ligt, mag de regels van dit huis niet stilzetten -- die
     blijven staan zoals ze stonden. */
  async function haal(sleutel) {
    const b = BRONNEN[sleutel];
    if (!b) return { ok: false, uitslag: 'onbekende bron: ' + sleutel };
    const url = urlVan(sleutel);
    const st = staat();
    st[sleutel] = st[sleutel] || {};
    st[sleutel].at = tijd();
    if (!url) {
      st[sleutel].uitslag = 'niet geconfigureerd (' + b.env + ' staat niet)';
      save();
      return { ok: false, geconfigureerd: false, uitslag: st[sleutel].uitslag };
    }
    try {
      const r = await haalHttp(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
      if (!r.ok) throw new Error('bron gaf ' + r.status);
      const ruw = await r.json();
      const { landen, signalen } = b.adapter(ruw, LANDEN);
      st[sleutel].uitslag = Object.keys(landen).length + ' land(en) te wijzigen, ' + signalen.length + ' signaal/signalen';
      st[sleutel].signalen = signalen;
      save();
      return { ok: true, sleutel, gezag: b.gezag, naam: b.naam, url, landen, signalen,
        versie: (ruw && (ruw.versie || ruw.version)) || null };
    } catch (e) {
      st[sleutel].uitslag = 'niet bereikbaar (' + String(e.message).slice(0, 80) + '); de huidige regels blijven gelden';
      save();
      return { ok: false, uitslag: st[sleutel].uitslag };
    }
  }

  /* DE SIGNALEN: wat een bron wel zag veranderen maar niet zelf mag toewijzen.
     Ze worden bewaard en niet alleen gemeld, want ze zijn werk -- en werk dat
     alleen in een logregel staat, gebeurt niet. */
  const signalen = () => Object.entries(staat())
    .flatMap(([sleutel, s]) => (s.signalen || []).map(x => Object.assign({ bron: sleutel }, x)));

  function ruimSignalenOp(sleutel) {
    const st = staat();
    if (st[sleutel]) { st[sleutel].signalen = []; save(); }
    return { ok: true };
  }

  return { bronnen: { status, haal, signalen, ruimSignalenOp, register: BRONNEN, urlVan } };
}

module.exports = { maakBronnen, BRONNEN };
