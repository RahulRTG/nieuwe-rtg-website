/* RTG Gemeente: het civiele systeem voor de hele gemeente, als partner-genre op
   dezelfde motor. Vier pijlers, drie soorten gebruikers:
   - Inwoners (leden-app): meldingen openbare ruimte, afspraken burgerzaken,
     vergunningen aanvragen, afvalkalender, aanslagen en bekendmakingen.
   - Gemeente-medewerkers (partner-app + PDA): meldingen toewijzen en afhandelen,
     afspraken zien, vergunningen beoordelen, bekendmakingen plaatsen.
   - RTG-partners (bedrijven): terras-, evenement- en horecavergunningen.

   Privacy by design: alles draait op codenamen; de echte naam blijft in de kluis
   (accounts.js). Nooit de belofte dat een besluit of betaling al rond is; een
   aanvraag is "ingediend"/"aangevraagd" tot een mens beslist.

   Dit is de orchestrator: maakGemeente bouwt een gedeelde ctx (db + helpers +
   seed + gedeelde mappers + constanten) en stelt de domein-slices samen. Elk
   domein woont in een eigen bestand van 5-10 KB:
     meldingen.js    meldingen openbare ruimte + AI-triage + behandelkant
     burgerzaken.js  balie-afspraken, tijdsloten, verhuizing
     vergunningen.js aanvragen + beoordelen (inwoner en onderneming)
     info.js         afval, grofvuil, aanslagen, bekendmakingen, regie */

const CATS = {
  verlichting: 'Straatverlichting', afval: 'Afval & vuil', wegdek: 'Wegdek & stoep',
  groen: 'Groen & bomen', riool: 'Riool & water', overlast: 'Overlast', speeltuin: 'Speeltuin', overig: 'Overig'
};
// welke ploeg een categorie standaard oppakt
const PLOEG = {
  verlichting: 'openbare werken', afval: 'reiniging', wegdek: 'openbare werken', groen: 'groenbeheer',
  riool: 'openbare werken', overlast: 'handhaving', speeltuin: 'openbare werken', overig: 'openbare werken'
};
const MELD_STATUS = ['nieuw', 'in behandeling', 'gepland', 'opgelost', 'afgewezen'];
const BURGERZAKEN = {
  paspoort: { label: 'Paspoort', duurMin: 15, balie: true },
  id: { label: 'Identiteitskaart', duurMin: 15, balie: true },
  rijbewijs: { label: 'Rijbewijs', duurMin: 15, balie: true },
  uittreksel: { label: 'Uittreksel (BRP)', duurMin: 10, balie: true },
  geboorte: { label: 'Geboorteaangifte', duurMin: 20, balie: true },
  verhuizing: { label: 'Verhuizing doorgeven', duurMin: 0, balie: false }
};
const VERGUNNINGEN = {
  bouw: 'Omgevings-/bouwvergunning', evenement: 'Evenementenvergunning', terras: 'Terrasvergunning',
  horeca: 'Horeca-exploitatie', kap: 'Kapvergunning', standplaats: 'Standplaats/markt'
};
const VERG_STATUS = ['ingediend', 'in behandeling', 'verleend', 'geweigerd'];
const FRACTIES = { rest: 'Restafval', gft: 'GFT & etensresten', papier: 'Papier & karton', pmd: 'PMD (plastic/blik/pak)' };
const BALIE_SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:30', '14:00', '14:30', '15:00', '15:30'];

function maakGemeente({ db, save, crypto, anthropic, findSupplier, notify, notifySupplier, sseToSupplier }) {
  const nu = () => new Date().toISOString();
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const isDatum = x => /^\d{4}-\d{2}-\d{2}$/.test(String(x || ''));
  const id = () => crypto.randomBytes(4).toString('hex');
  const ref = p => 'RTG-' + p + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);

  function seed() {
    if (!Array.isArray(db.data.suppliers)) return;
    if (!db.data.supplierTypes.gemeente)
      db.data.supplierTypes.gemeente = { label: 'Gemeente & overheid', icon: 'gebouw', caps: ['gemeente', 'location'] };
    if (!Array.isArray(db.data.gemeenteMeldingen)) db.data.gemeenteMeldingen = [];
    if (!Array.isArray(db.data.gemeenteAfspraken)) db.data.gemeenteAfspraken = [];
    if (!Array.isArray(db.data.gemeenteVergunningen)) db.data.gemeenteVergunningen = [];
    if (!Array.isArray(db.data.gemeenteAanslagen)) db.data.gemeenteAanslagen = [];
    if (!Array.isArray(db.data.gemeenteBekend)) db.data.gemeenteBekend = [];
    if (db.data._gemeenteSeed) return;
    db.data._gemeenteSeed = true;
    if (!db.data.suppliers.find(s => s.code === 'GEMEENTE')) {
      db.data.suppliers.push({
        code: 'GEMEENTE', name: 'Gemeente Eivissa', type: 'gemeente', city: 'Ibiza',
        loc: { lat: 38.909, lng: 1.432, label: 'Ajuntament, Vara de Rey, Eivissa' }, rate: 0, menu: [], photos: [],
        gemeente: {
          balie: { open: true, capaciteitPerSlot: 2 },
          afval: { patroon: { rest: 2, gft: 5, papier: 4, pmd: 1 }, biweekPapier: true } // weekdag 0=zo..6=za
        }
      });
    }
    db.data.gemeenteBekend.unshift(
      { id: id(), gemeente: 'GEMEENTE', titel: 'Herinrichting Vara de Rey', tekst: 'De gemeente start met de herinrichting van de boulevard; werkzaamheden tot het najaar.', soort: 'algemeen', at: nu() },
      { id: id(), gemeente: 'GEMEENTE', titel: 'Tijdelijke verkeersmaatregel Marina', tekst: 'Rondom de jachthaven geldt tijdens het weekend een inrijverbod voor gemotoriseerd verkeer.', soort: 'verkeer', at: nu() }
    );
    save();
  }

  function isGemeente(s) { return !!s && s.type === 'gemeente'; }
  function deGemeente() { seed(); return (db.data.suppliers || []).find(s => s.type === 'gemeente') || null; }
  function magBehandelen(s) { return isGemeente(s); }
  // gedeelde mapper (gebruikt door meldingen én grofvuil)
  function publiekeMelding(m) {
    return {
      ref: m.ref, categorie: m.categorie, categorieLabel: m.categorieLabel, tekst: m.tekst,
      locatie: m.locatie, status: m.status, ploeg: m.ploeg,
      updates: (m.updates || []).map(u => ({ tekst: u.tekst, at: u.at })), at: m.at
    };
  }

  const ctx = {
    db, save, crypto, anthropic, findSupplier, notify, notifySupplier, sseToSupplier,
    nu, vandaag, isDatum, id, ref, schoon, seed, isGemeente, deGemeente, publiekeMelding,
    CATS, PLOEG, MELD_STATUS, BURGERZAKEN, VERGUNNINGEN, VERG_STATUS, FRACTIES, BALIE_SLOTS
  };

  const api = { seed, isGemeente, magBehandelen, CATS, VERGUNNINGEN, BURGERZAKEN, FRACTIES };
  Object.assign(api,
    require('./meldingen')(ctx),
    require('./burgerzaken')(ctx),
    require('./vergunningen')(ctx),
    require('./info')(ctx));
  return { gemeente: api };
}

module.exports = { maakGemeente };
