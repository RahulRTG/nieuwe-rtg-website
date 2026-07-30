/* RTG Thuis: thuisverhuur van lid aan lid -- ons antwoord op Airbnb, maar
   beter, en met alle premium functies die daar geld kosten hier GRATIS:
   - 0% servicekosten voor leden (Airbnb rekent gasten ~14%);
   - instant boeken OF aanvragen, week- en maandkorting, borg, huisregels;
   - keyless self check-in met een deurcode (de RTG slimme-deuren-lijn);
   - AI-prijsadvies, co-hosts, kalenderblokkades, superhost-status;
   - reviews twee kanten op, wenslijst, berichten per boeking;
   - de Reiswijzer van het land automatisch bij elke boeking;
   - privacy by design: host en gast kennen elkaar als codenaam.
   Nooit de belofte dat een betaling al verwerkt is: de prijsopbouw is
   transparant, de uitbetaling staat als "gepland" richting de RTG Bank.
   Orkestrator: de stores en gedeelde helpers; het aanbod (host) in
   ./aanbod, zoeken/boeken in ./boeken, reviews/wenslijst/berichten/bord
   in ./extra. */
module.exports = ({ db, save, crypto, schoon, reiswijzer, landVind, findSupplier, LANDEN }) => {
  const nu = () => new Date().toISOString();
  const d = () => db.data;
  const huizen = () => { if (!d().thuisHuizen || typeof d().thuisHuizen !== 'object') d().thuisHuizen = {}; return d().thuisHuizen; };
  const boekingen = () => { if (!Array.isArray(d().thuisBoekingen)) d().thuisBoekingen = []; return d().thuisBoekingen; };
  const reviews = () => { if (!Array.isArray(d().thuisReviews)) d().thuisReviews = []; return d().thuisReviews; };
  const wensen = () => { if (!d().thuisWens || typeof d().thuisWens !== 'object') d().thuisWens = {}; return d().thuisWens; };

  const TYPES = { villa: 'Villa', appartement: 'Appartement', huis: 'Huis', kamer: 'Privekamer', boot: 'Woonboot', natuur: 'Natuurhuisje' };
  const VOORZIENINGEN = ['wifi', 'keuken', 'zwembad', 'parkeren', 'airco', 'wasmachine', 'werkplek', 'ontbijt', 'sauna', 'haard', 'tuin', 'uitzicht', 'ev-lader', 'gym', 'huisdieren'];
  const ANNULERING = { flex: 'Flexibel: gratis annuleren tot 1 dag voor aankomst', gemiddeld: 'Gemiddeld: gratis tot 5 dagen voor aankomst, daarna 50% terug', streng: 'Streng: 50% terug tot 7 dagen voor aankomst, daarna geen restitutie' };

  const geldigeDatum = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const nachten = (van, tot) => Math.round((new Date(tot) - new Date(van)) / 86400000);
  const raakt = (aVan, aTot, bVan, bTot) => aVan < bTot && bVan < aTot; // [van, tot) overlapt

  // is het huis vrij in [van, tot)? (bevestigde/lopende boekingen + blokkades)
  function vrij(huisId, van, tot, negeerRef) {
    const h = huizen()[huisId];
    if (!h) return false;
    if ((h.blokkades || []).some(b => raakt(van, tot, b.van, b.tot))) return false;
    return !boekingen().some(b => b.huisId === huisId && b.ref !== negeerRef &&
      ['aangevraagd', 'bevestigd', 'ingecheckt'].includes(b.status) && raakt(van, tot, b.van, b.tot));
  }

  function ratingVan(huisId) {
    const r = reviews().filter(x => x.huisId === huisId && x.richting === 'gast');
    return r.length ? { sterren: Math.round(r.reduce((s, x) => s + x.sterren, 0) / r.length * 10) / 10, aantal: r.length } : { sterren: null, aantal: 0 };
  }
  function gastScore(codenaam) {
    const r = reviews().filter(x => x.gast === codenaam && x.richting === 'host');
    return r.length ? Math.round(r.reduce((s, x) => s + x.sterren, 0) / r.length * 10) / 10 : null;
  }
  /* Superhost: minstens 3 afgeronde verblijven als host en gemiddeld 4,8+. */
  function superhost(codenaam) {
    const mijn = Object.values(huizen()).filter(h => h.host === codenaam).map(h => h.id);
    const klaar = boekingen().filter(b => mijn.includes(b.huisId) && b.status === 'uitgecheckt').length;
    if (klaar < 3) return false;
    const r = reviews().filter(x => mijn.includes(x.huisId) && x.richting === 'gast');
    return r.length >= 3 && r.reduce((s, x) => s + x.sterren, 0) / r.length >= 4.8;
  }
  const magBeheren = (h, codenaam) => !!h && (h.host === codenaam || (h.coHosts || []).includes(codenaam));

  /* De host kan een lid zijn (codenaam) OF een zaak (vlag 'zaak:CODE') --
     hosts horen bij de leveranciers. Gasten zien dan de zaaknaam. */
  function hostNaam(id) {
    const s = String(id || '');
    if (!s.startsWith('zaak:')) return s;
    const z = findSupplier && findSupplier(s.slice(5));
    return (z && z.name) || 'RTG-zaak';
  }

  const ctx = { db, save, crypto, schoon, reiswijzer, landVind, findSupplier, LANDEN, nu, d, huizen, boekingen, reviews, wensen,
    TYPES, VOORZIENINGEN, ANNULERING, geldigeDatum, nachten, raakt, vrij, ratingVan, gastScore, superhost, magBeheren, hostNaam };

  const aanbod = require('./aanbod')(ctx);
  /* De commerciele tak staat voor het boeken: zij levert de prijsopbouw die
     boeken.js gebruikt zodra een huis van een zaak commercieel verhuurt. */
  const zakelijkM = require('./zakelijk')(ctx);
  ctx.zakelijkOpbouw = zakelijkM.thuisZakelijkOpbouw;
  ctx.commercieel = zakelijkM.thuisCommercieel;
  const boekenM = require('./boeken')(ctx);
  // extra (reviews/wenslijst/bord) hergebruikt de publieke weergaves van boeken
  ctx.thuisPubliek = boekenM.thuisPubliek;
  ctx.thuisGastZicht = boekenM.thuisGastZicht;
  const api = Object.assign({}, aanbod, zakelijkM, boekenM, require('./extra')(ctx));
  api.thuisTypes = () => ({ types: TYPES, voorzieningen: VOORZIENINGEN, annulering: ANNULERING });
  return { thuis: api };
};
