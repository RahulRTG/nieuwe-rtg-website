/* HET BEDRIJFSMAATREGISTER -- welke cijfers over RTG als onderneming bestaan, en
   hoe hard dat is. De eerste sensor van AUTONOMIE, en daarom geen eenmalige lijst.

   WAT DIT IS. Een catalogus van bedrijfsmaten als GEGEVENS (de maten-*.js), plus
   de regels waarmee uit een maat en haar bewijs een stand volgt. Het is een
   PROJECTIE op bestaande bronnen: er komt geen tweede database, en geen maat
   krijgt hier een waarde. Dat doet de bron zelf, en straks de sensor, en die
   gaat daarvoor langs ./poort.js.

   WAT DIT NIET DOET: broncode lezen. Of een citaat werkelijk in zijn bestand
   staat, stelt scripts/bedrijfsmaat.js vast en geeft het hier als `klopt(citaat)`
   mee. De runtime komt nooit aan de bron (CODE.md, CODE-AI-001); hij leest het
   register dat die meter schrijft.

   VIER ELEMENTEN, en een maat BESTAAT pas als ze alle vier aantoonbaar zijn:
     bron       de werkelijkheid wordt ergens geregistreerd
     definitie  RTG heeft vastgelegd wat de maat betekent
     projectie  er is code die hem uitrekent
     bewijs     de uitkomst kan haar herkomst, graad of peilmoment aantonen
   Ontbreekt er een, dan is dat een GAT met een naam -- BRON_ONTBREEKT tot en met
   BEWIJS_ONTBREEKT -- want "churn ontbreekt" zegt niet of er weken werk ligt of
   alleen een definitie. Een element dat ontbreekt draagt altijd zijn reden.

   `bron: 'afgeleid'` betekent dat de werkelijkheid van de maat in haar
   afhankelijkheden zit (runway uit cash en marge). Zo'n bron bestaat alleen als
   al die afhankelijkheden een bron hebben; anders erft hij hun gat.

   DE STATUS IS BESCHRIJVEND EN GEEN CIJFER: bestaat, half, ontbreekt, onbekend.
   Er wordt niets opgeteld tot een score (INT-04). */
'use strict';

const { WERELDEN } = require('../economie/werelden');
const { KLASSEN } = require('./poort');
const { BESLUITEN } = require('./besluiten');

const MATEN = [].concat(require('./maten-geld'), require('./maten-kosten'), require('./maten-groei'),
  require('./maten-markt'), require('./maten-product'), require('./maten-operatie'), require('./maten-weerbaarheid'));

/* De domeinen die de eigenaar noemde (25 september 2026). Elk heeft minstens een maat. */
const DOMEINEN = Object.freeze(['geld', 'cash', 'omzet', 'marge', 'kosten', 'liquiditeit', 'runway',
  'acquisitie', 'cac', 'activatie', 'cohort', 'retentie', 'churn', 'uitkomst', 'gebruik', 'support',
  'kwaliteit', 'performance', 'capaciteit', 'personeel', 'leveranciers', 'campagnes', 'infrastructuur',
  'fiscaliteit', 'risico', 'weerbaarheid', 'commerciele-groei', 'geografische-groei']);

const ELEMENTEN = Object.freeze(['bron', 'definitie', 'projectie', 'bewijs']);
const GATEN = Object.freeze({ bron: 'BRON_ONTBREEKT', definitie: 'DEFINITIE_ONTBREEKT',
  projectie: 'PROJECTIE_ONTBREEKT', bewijs: 'BEWIJS_ONTBREEKT' });
const STATUS = Object.freeze({ bestaat: 'bestaat', half: 'half', ontbreekt: 'ontbreekt', onbekend: 'onbekend' });
const GRADEN = Object.freeze(['onbekend', 'vermoed', 'gemeten', 'bewezen']);
const ACTUALITEIT = Object.freeze(['live', 'periode', 'bij-meting', 'onbekend']);
const VERSIE = 1;

/* De ketens die AUTONOMIE later moet kunnen doorlopen. Een conclusie over een
   keten is pas gegrond als elke schakel bestaat; de eerste die dat niet doet, is
   waar het verhaal ophoudt. */
const KETENS = Object.freeze([
  { id: 'geld', naam: 'van ontvangen omzet naar runway',
    schakels: ['omzet.leden-ontvangen', 'marge.bruto-rtg', 'marge.operationeel-rtg', 'cash.rtg-bankpositie', 'runway.rtg'] },
  { id: 'funnel', naam: 'van nieuw lid naar behoud',
    schakels: ['acquisitie.nieuwe-leden', 'cohort.aanmeldweek', 'activatie.eerste-waarde', 'uitkomst.klantwaarde', 'retentie.actief-na-30-dagen'] },
  { id: 'werving', naam: 'van campagne naar wervingskosten',
    schakels: ['campagnes.rtg-marketing', 'acquisitie.kanaal', 'cac.per-kanaal'] },
  { id: 'kosten', naam: 'van verbruik naar unit economics',
    schakels: ['kosten.per-drager', 'kosten.maand-totaal', 'kosten.vooruitblik', 'marge.per-lid'] },
  { id: 'service', naam: 'van fout naar opgelost probleem',
    schakels: ['kwaliteit.foutsignalen', 'support.klokken', 'uitkomst.service-zonder-herhaling'] },
  { id: 'afdracht', naam: 'van bijdrage naar de RTFoundation',
    schakels: ['omzet.leden-maand', 'omzet.leden-ontvangen', 'geld.foundation-afdracht'] }
]);

const opId = () => new Map(MATEN.map(m => [m.id, m]));

/* De vorm: wat een maat moet dragen. Geeft een lijst fouten; leeg is in orde. */
function vormfouten() {
  const f = [], ids = opId(), wereldIds = new Set(WERELDEN.map(w => w.id));
  if (ids.size !== MATEN.length) f.push('dubbele id in de catalogus');
  for (const m of MATEN) {
    const w = (t) => f.push(m.id + ': ' + t);
    for (const veld of ['betekenis', 'eenheid', 'berekening']) if (!m[veld] || String(m[veld]).length < 3) w('mist ' + veld);
    if (!DOMEINEN.includes(m.domein)) w('onbekend domein ' + m.domein);
    if (!wereldIds.has(m.wereld)) w('C1: geen of een onbekende economische wereld (' + m.wereld + ')');
    if (!KLASSEN[m.privacy]) w('onbekende privacyklasse ' + m.privacy);
    else if (KLASSEN[m.privacy].optellend && !(Number.isInteger(m.minGroep) && m.minGroep >= KLASSEN[m.privacy].grens))
      w('telt op over mensen of zaken maar draagt geen minimale groepsgrootte van ten minste ' + KLASSEN[m.privacy].grens);
    else if (!KLASSEN[m.privacy].optellend && m.minGroep != null) w('huis-klasse met een groepsgrootte');
    if (!ACTUALITEIT.includes(m.actualiteit)) w('onbekende actualiteit ' + m.actualiteit);
    if (!GRADEN.includes(m.graad)) w('onbekende graad ' + m.graad);
    if (!m.bewijs && m.graad !== 'onbekend') w('graad ' + m.graad + ' zonder bewijs; een graad zonder bewijs is onbekend');
    if (!Array.isArray(m.afhankelijk)) w('afhankelijk is geen lijst');
    else for (const a of m.afhankelijk) if (!ids.has(a)) w('hangt af van onbekende maat ' + a);
    const waarom = m.waarom || {};
    for (const e of ELEMENTEN) {
      const v = m[e];
      if (e === 'bron' && v === 'afgeleid') { if (!m.afhankelijk.length) w('afgeleide bron zonder afhankelijkheden'); continue; }
      if (v == null) { if (!waarom[e]) w(e + ' ontbreekt zonder reden'); continue; }
      if (!Array.isArray(v) || !v.length || v.some(x => !x || !x.bestand || !x.citaat)) w(e + ': een citaat is { bestand, citaat }');
      /* Een citaat moet iets AANWIJZEN. 'module.exports' bewijst alleen dat het
         bestand bestaat, en dat is geen bron, definitie of projectie. */
      else if (v.some(x => String(x.citaat).trim().length < 8 || /^module\.exports\b/.test(String(x.citaat).trim())))
        w(e + ': een citaat dat alleen het bestand aanwijst (te kort, of module.exports)');
    }
    if (KLASSEN[m.privacy] && KLASSEN[m.privacy].optellend && !m.groepsgrens && !waarom.groepsgrens)
      w('telt op over mensen of zaken; zeg waar de projectie de groepsgrens afdwingt, of waarom niet');
    if (!m.eigenaar && !waarom.eigenaar) w('geen eigenaar en geen reden');
  }
  for (const k of KETENS) for (const s of k.schakels) if (!ids.has(s)) f.push('keten ' + k.id + ': onbekende schakel ' + s);
  for (const d of DOMEINEN) if (!MATEN.some(m => m.domein === d)) f.push('domein zonder maat: ' + d);
  if (cyclus()) f.push('de afhankelijkheden bevatten een kring: ' + cyclus().join(' -> '));
  return f;
}

function cyclus() {
  const ids = opId(), kleur = new Map(), pad = [];
  const bezoek = (id) => {
    kleur.set(id, 1); pad.push(id);
    for (const a of (ids.get(id).afhankelijk || [])) {
      if (!ids.has(a)) continue;
      if (kleur.get(a) === 1) return pad.slice(pad.indexOf(a)).concat(a);
      if (!kleur.get(a)) { const r = bezoek(a); if (r) return r; }
    }
    kleur.set(id, 2); pad.pop(); return null;
  };
  for (const m of MATEN) if (!kleur.get(m.id)) { const r = bezoek(m.id); if (r) return r; }
  return null;
}

module.exports = { MATEN, DOMEINEN, ELEMENTEN, GATEN, STATUS, GRADEN, ACTUALITEIT, KETENS, VERSIE,
  BESLUITEN, vormfouten, cyclus, opId, beoordeel: require('./beoordeel')({ MATEN, ELEMENTEN, GATEN, STATUS, KETENS, KLASSEN, opId }) };
