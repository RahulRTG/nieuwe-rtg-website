/* ============================================================================
   RAHUL AI IN SERVICE -- adviseert, maar bestuurt de zaak niet.

   Deze laag gebruikt alleen de inhoud die al in de zaak staat. Hij opent geen
   dossier, verleent geen bevoegdheid en verstuurt geen antwoord. De uitkomst is
   daarom een controleerbaar advies aan een medewerker. Routering blijft van de
   deterministische router; Rahul AI helpt alleen het onderwerp herkennen en
   legt uit op welke woorden dat advies rust.
   ========================================================================== */
'use strict';

const { ONDERWERPEN } = require('./klassen');
const router = require('./router');

const VERSIE = 'rahul-service-1';
const PATRONEN = Object.freeze({
  veiligheid: ['fraude', 'misbruik', 'gestolen', 'onveilig', 'bedreig', 'phishing'],
  account: ['inlog', 'aanmeld', 'wachtwoord', 'account', 'toegang', 'passkey', 'code'],
  betaling: ['betaling', 'betaal', 'factuur', 'geld', 'uitbetaling', 'refund', 'terugbetaling'],
  reis: ['reis', 'boeking', 'vlucht', 'hotel', 'ticket', 'bagage', 'transfer'],
  bestelling: ['bestelling', 'levering', 'bezorg', 'product', 'pakket'],
  app: ['app', 'scherm', 'knop', 'fout', 'storing', 'browser', 'werkt niet'],
  zaak: ['organisatie', 'bedrijf', 'werkruimte', 'medewerker', 'contract']
});

const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
const tekstVan = (o) => schoon([o && o.titel, o && o.tekst].filter(Boolean).join(' '), 4200).toLowerCase();

function herkenOnderwerp(o) {
  const expliciet = schoon(o && o.onderwerp, 30);
  if (Object.prototype.hasOwnProperty.call(ONDERWERPEN, expliciet) && expliciet !== 'anders') {
    return { onderwerp: expliciet, zekerheid: 'expliciet', signalen: ['gekozen onderwerp'] };
  }
  const tekst = tekstVan(o);
  const treffers = Object.entries(PATRONEN).map(([onderwerp, woorden]) => ({
    onderwerp,
    woorden: woorden.filter(w => tekst.includes(w))
  })).filter(x => x.woorden.length).sort((a, b) => b.woorden.length - a.woorden.length);
  if (!treffers.length) return { onderwerp: 'anders', zekerheid: 'laag', signalen: [] };
  const eerste = treffers[0];
  const gelijk = treffers[1] && treffers[1].woorden.length === eerste.woorden.length;
  return {
    onderwerp: gelijk ? 'anders' : eerste.onderwerp,
    zekerheid: gelijk ? 'laag' : (eerste.woorden.length > 1 ? 'hoog' : 'midden'),
    signalen: eerste.woorden.slice(0, 4)
  };
}

function triage(o) {
  const h = herkenOnderwerp(o || {});
  const route = router.routeer({ doelgroep: o && o.doelgroep, onderwerp: h.onderwerp,
    soort: o && o.soort, prioriteit: o && o.prioriteit });
  return { versie: VERSIE, onderwerp: h.onderwerp, zekerheid: h.zekerheid,
    signalen: h.signalen, team: route.team, teamNaam: route.naam,
    waarom: route.waarom, via: route.via };
}

function laatsteVraag(z) {
  return (z.tijdlijn || []).slice().reverse().find(r => r.wat === 'bericht' && r.van === 'melder');
}

function maakRahulAdvies(z) {
  if (!z) return { status: 404, error: 'Deze zaak kennen wij niet.' };
  const laatste = laatsteVraag(z);
  const actie = !z.eigenaar ? 'Neem de zaak op naam.'
    : z.stand === 'wachtOpMelder' ? 'Wacht op het antwoord van de melder.'
      : z.mensVerzoeken > 0 && z.stand === 'wachtOpMens' ? 'Laat een medewerker nu inhoudelijk reageren.'
        : 'Controleer de vraag en stuur een menselijk antwoord.';
  return { ok: true, naam: 'Rahul AI', versie: VERSIE, zaak: z.id,
    samenvatting: schoon(z.titel, 180), laatsteVraag: laatste ? schoon(laatste.tekst, 500) : null,
    onderwerp: z.onderwerp, team: z.team, zekerheid: (z.rahul && z.rahul.zekerheid) || 'niet gemeten',
    signalen: (z.rahul && z.rahul.signalen || []).slice(), volgendeStap: actie,
    grens: 'Advies. Een medewerker controleert en beslist; Rahul AI verstuurt niets.' };
}

function maakRahulConcept(z) {
  const a = maakRahulAdvies(z);
  if (a.error) return a;
  const opening = 'Dank u. Uw vraag staat bij RTG als ' + z.id + '.';
  const vervolg = z.stand === 'wachtOpMelder'
    ? ' Wij wachten op uw aanvullende informatie en houden de zaak hier bij elkaar.'
    : ' Een medewerker bekijkt dit en reageert in deze beveiligde lijn.';
  return Object.assign({}, a, { concept: opening + vervolg,
    grens: 'Concept. Alleen een medewerker kan dit na controle versturen.' });
}

module.exports = { triage, advies: maakRahulAdvies, concept: maakRahulConcept,
  herken: herkenOnderwerp, VERSIE, PATRONEN };
