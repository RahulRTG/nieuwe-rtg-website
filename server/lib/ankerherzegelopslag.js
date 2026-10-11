/* De opslag, de handtekening en de toetsing van HERZEGELINGEN (./ankerherzegel.js)
   voor de ankerdienst (./ankerdienst.js). Geknipt uit dat bestand toen het over
   de 10 kB van keuringsregel 13 ging; de regels zelf staan in ./ankerherzegel.js,
   hier staat alleen wat de SLEUTEL en de OPSLAG van de dienst nodig heeft. */
'use strict';

const crypto = require('crypto');
const { JOURNALEN, RUW } = require('./ankerjournalen');
const { kanoniek } = require('./ankerzegel');
const herzegel = require('./ankerherzegel');

/* Hoeveel herzegelingen er bewaard blijven. Valt een record eraf terwijl er
   nog een anker van daarvoor buiten staat, dan is die herschrijving niet meer
   te verklaren en gaat het alarm af -- de veilige kant. */
const MAX_HERZEGELINGEN = 1000;

function maakHerzegelOpslag({ db, data, tijd, eigenPaar }) {
  /* DE HERZEGELINGEN (./ankerherzegel.js). Bewaard in een eigen collectie van
     deze dienst; ze zijn getekend, dus wie ze in de database bijstelt of er
     een bijzet zonder de sleutel, verklaart er niets mee. */
  const eigen = () => require('../kern/eigencollectie')({ db, domein: 'lib/ankerherzegelopslag',
    bezit: { ankerHerzegelingen: 'lijst' } });
  const herzegelingen = () => (db && db.data && Array.isArray(db.data.ankerHerzegelingen)) ? db.data.ankerHerzegelingen : [];

  function tekenRecord(rec) {
    const p = eigenPaar();
    if (!p) return rec;
    return Object.assign({}, rec, { handtekening: { alg: 'ed25519', sleutelId: p.sleutelId, publiek: p.publiekB64,
      waarde: crypto.sign(null, herzegel.teTekenen(rec, kanoniek), p.prive).toString('base64') } });
  }

  /* Is dit record door DEZE installatie getekend? Zelfde regel als bij het
     blok: alleen onze eigen publieke sleutel telt, nooit die in het record. */
  function herzegelingGeldig(rec) {
    const p = eigenPaar();
    if (!p) return null;
    const h = rec && rec.handtekening;
    if (!h || h.alg !== 'ed25519' || typeof h.waarde !== 'string') return false;
    try { return crypto.verify(null, herzegel.teTekenen(rec, kanoniek), p.publiek, Buffer.from(h.waarde, 'base64')); }
    catch (e) { return false; }
  }

  /* VOOR een AVG-wissing aanroepen: rekent uit wat de herzegeling doet, tekent
     dat en bewaart het. `door` komt uit de SESSIE van wie de wissing deed (een
     rol, nooit de gewiste sleutel); `actor` is de sleutel die gewist wordt en
     komt NIET in het record. Geeft null als er niets te herzegelen valt. */
  function herzegelVoor({ journaal, actor, door, reden, id, vorigAnker }) {
    const ruw = RUW[journaal];
    if (!ruw) throw new Error('ankerdienst: ' + journaal + ' is geen zegelketen en kent geen herzegeling');
    const { lijst, totaal } = ruw(data());
    const p = herzegel.plan(lijst, totaal, actor);
    if (!p.regels.length) return null;
    const rec = tekenRecord({ soort: 'herzegeling', versie: 1, id: String(id || crypto.randomUUID()), journaal,
      at: new Date(tijd()).toISOString(), door: door || null, reden: String(reden || ''),
      vorigAnker: vorigAnker || null, kopVoor: p.kopVoor, regels: p.regels });
    const bak = eigen().bak('ankerHerzegelingen');
    bak.push(rec);
    if (bak.length > MAX_HERZEGELINGEN) bak.splice(0, bak.length - MAX_HERZEGELINGEN);
    return rec;
  }

  /* Een `herschreven` oordeel over een zegelketen: verklaart een getekende
     herzegeling dat precies? Zo niet, dan blijft het oordeel staan. */
  function verklaarHerschrijving(naam, anker, oordeel) {
    if (!oordeel || !oordeel.herschreven || !RUW[naam]) return null;
    const { lijst, totaal } = RUW[naam](data());
    const huidig = JOURNALEN[naam](data()).find(r => r && Number(r.nr) === anker.nr);
    return herzegel.verklaar({ naam, anker, lijst, totaal, records: herzegelingen(),
      geldig: herzegelingGeldig, huidigeHash: huidig ? huidig.hash : null });
  }

  return { herzegelVoor, herzegelingGeldig, verklaarHerschrijving };
}

module.exports = { maakHerzegelOpslag, MAX_HERZEGELINGEN };
