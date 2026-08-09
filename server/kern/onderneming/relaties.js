/* DE RELATIES: wie zijn mijn klanten, en wie verdient nu aandacht.

   Het klantenboek (kern/klantenboek.js) zegt WIE er kochten. Deze laag zegt wat
   je ermee doet: in welke groep iemand valt, en wat er vandaag opgevolgd moet
   worden.

   ER KOMEN GEEN LEADS EN PROSPECTS BIJ, EN DAT IS EEN KEUZE. Een echte
   CRM-pijplijn begint bij een lead, maar binnen RTG bestaat er geen enkel
   proces dat leads PRODUCEERT: niemand importeert een lijst, er is geen
   formulier dat een prospect maakt. Zou dit register hier toch worden
   aangelegd, dan stond er een lege tabel die alleen met de hand te vullen is --
   en dat is precies het soort register dat na twee weken niemand meer bijhoudt
   en dat daarna verkeerde cijfers geeft. Wat er WEL is, is echt: transacties,
   offerte-aanvragen en boekingen die op antwoord wachten. Daar rekent deze
   laag mee. Komt er ooit een echte leadbron, dan past hij hier gewoon bij.

   DE SEGMENTEN ZIJN GETELD, NIET GERADEN. Nieuw, terugkerend en stilgevallen
   volgen uit het aantal aankopen en de laatste datum -- niet uit een
   AI-oordeel, want dan hangt de indeling af van een sleutel die er niet altijd
   is, en verschuift zij bovendien zonder dat er iets is gebeurd.

   ALLES OP CODENAAM. Zie de kop van het klantenboek: een CRM is precies de
   plek waar de codenaam-regel stilletjes zou sneuvelen. */
'use strict';

const DAG = 86400000;

/* Wanneer heet een klant stilgevallen. Bewust ruim: iemand die twee maanden
   niet kwam, is nog geen verloren klant. */
const STIL_DAGEN = 120;
/* Hoe lang een offerte mag liggen voordat hij opvolging verdient. */
const OFFERTE_DAGEN = 7;

const dagenGeleden = (iso, nuMs) => {
  if (!iso) return null;
  const t = Date.parse(String(iso).length <= 10 ? iso + 'T12:00:00Z' : iso);
  return Number.isFinite(t) ? Math.floor((nuMs - t) / DAG) : null;
};

module.exports = ({ db, klantenboek, boekingenVanZaak }) => {

  const zaakVan = (o) => (o && o.supplierCode
    ? (db.data.suppliers || []).find(x => x.code === o.supplierCode) || null : null);

  /* De offertes van deze zaak die nog op een antwoord van de ZAAK wachten.
     Gelezen uit db.data.vakOffertes, waar de offertestroom ze al neerzet. */
  function openOffertes(code) {
    const alle = Array.isArray(db.data.vakOffertes) ? db.data.vakOffertes : [];
    return alle.filter(o => o && o.supplierCode === code && o.status === 'aangevraagd');
  }

  /* De opvolging: wat vandaag aandacht verdient, met de reden erbij. Elke regel
     rust op iets dat er echt staat -- geen enkele is een herinnering die wij
     hebben verzonnen. */
  function opvolging(s, klanten, nuMs) {
    const uit = [];

    const wacht = (boekingenVanZaak(s.code) || []).filter(b => b && b.status === 'aangevraagd');
    if (wacht.length) {
      uit.push({ id: 'aanvragen', soort: 'aanvraag', aantal: wacht.length,
        kop: wacht.length + ' aanvra' + (wacht.length === 1 ? 'ag wacht' : 'gen wachten') + ' op uw antwoord',
        waarom: 'Een aanvraag die blijft liggen, wordt een klant die ergens anders koopt.' });
    }

    const offertes = openOffertes(s.code);
    const oud = offertes.filter(o => (dagenGeleden(o.at, nuMs) || 0) >= OFFERTE_DAGEN);
    if (offertes.length) {
      uit.push({ id: 'offertes', soort: 'offerte', aantal: offertes.length,
        kop: offertes.length + ' offerte' + (offertes.length === 1 ? '' : 's') + ' zonder prijs' +
          (oud.length ? ', waarvan ' + oud.length + ' langer dan ' + OFFERTE_DAGEN + ' dagen' : ''),
        waarom: oud.length
          ? 'Wie een week op een prijs wacht, heeft er intussen drie andere gevraagd.'
          : 'Een offerte-aanvraag is iemand die al bijna klant is.' });
    }

    /* Klanten die stil zijn gevallen. Alleen wie MEER dan een keer kocht: bij
       een eenmalige klant is stilte normaal en zou dit een verwijt zijn dat
       nergens op slaat. */
    const stil = klanten.filter(k => k.aantal > 1 && (dagenGeleden(k.laatste, nuMs) || 0) >= STIL_DAGEN);
    if (stil.length) {
      uit.push({ id: 'stil', soort: 'klant', aantal: stil.length,
        kop: stil.length + ' vaste klant' + (stil.length === 1 ? '' : 'en') + ' liet' +
          (stil.length === 1 ? '' : 'en') + ' zich lang niet zien',
        waarom: 'Zij kochten meer dan eens en zijn nu ' + STIL_DAGEN + '+ dagen weg. Een bericht kost niets.',
        codenamen: stil.slice(0, 10).map(k => k.codenaam) });
    }

    return uit;
  }

  /* Het relatiebeeld. Null zonder zaak: er valt dan niets te tellen, en lege
     segmenten zouden lezen als "u heeft geen klanten" in plaats van "u heeft
     nog geen zaak". */
  function relaties(o, nuMs) {
    const s = zaakVan(o);
    if (!s) return null;
    const nuT = Number.isFinite(nuMs) ? nuMs : Date.now();
    const klanten = klantenboek(s.code);

    const nieuw = klanten.filter(k => k.aantal === 1);
    const terug = klanten.filter(k => k.aantal > 1);
    const stil = terug.filter(k => (dagenGeleden(k.laatste, nuT) || 0) >= STIL_DAGEN);
    const omzet = klanten.reduce((n, k) => n + k.omzet, 0);

    return {
      zaak: s.code,
      totaal: klanten.length,
      segmenten: {
        nieuw: { aantal: nieuw.length, uitleg: 'Kochten een keer.' },
        terugkerend: { aantal: terug.length, uitleg: 'Kochten meer dan een keer.' },
        stilgevallen: { aantal: stil.length, uitleg: 'Kochten vaker, maar zijn ' + STIL_DAGEN + '+ dagen weg.' }
      },
      /* Het aandeel terugkerende klanten is het enige getal hier dat iets zegt
         over de gezondheid van de zaak, en het is een deling van twee getelde
         waarden -- dus exact, en null als er nog niets te delen valt. */
      herhaalaandeel: klanten.length ? Math.round((terug.length / klanten.length) * 100) : null,
      omzetTotaal: Math.round(omzet),
      top: klanten.slice(0, 10),
      opvolging: opvolging(s, klanten, nuT),
      voorbehoud: 'Alles op codenaam; dit boek kent geen echte namen. Omzet telt alleen wat als betaald is afgetekend.'
    };
  }

  return { RELATIES_STIL_DAGEN: STIL_DAGEN, RELATIES_OFFERTE_DAGEN: OFFERTE_DAGEN, relaties };
};

module.exports.STIL_DAGEN = STIL_DAGEN;
module.exports.OFFERTE_DAGEN = OFFERTE_DAGEN;
