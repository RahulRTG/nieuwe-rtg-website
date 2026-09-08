/* Woningonderhoud voor LivingOS. Een lid meldt zelf wat er thuis stuk is.
   Een melding begint altijd als "gemeld": zonder gekoppelde vakman doen we
   niet alsof iemand onderweg is. Toewijzing en planning horen later bij de
   echte dienstverlener; deze kern bewaart nu alleen de controleerbare vraag. */
'use strict';

const klok = require('../lib/klok');

module.exports = ({ db, save, crypto, schoon }) => {
  const eigen = require('./eigencollectie')({
    db, domein: 'kern/woningonderhoud', bezit: { woningOnderhoud: 'kaart' }
  });
  const lees = key => eigen.kijk('woningOnderhoud')[key] || [];
  const schrijf = key => {
    const bak = eigen.bak('woningOnderhoud');
    if (!Array.isArray(bak[key])) bak[key] = [];
    return bak[key];
  };
  const veilig = m => ({
    id: m.id, titel: m.titel, plek: m.plek, notitie: m.notitie,
    urgentie: m.urgentie, status: m.status, gemaaktAt: m.gemaaktAt
  });

  function lijst(key) {
    return { meldingen: lees(key).slice().sort((a, b) =>
      String(b.gemaaktAt).localeCompare(String(a.gemaaktAt))).map(veilig) };
  }

  function meld(key, body = {}) {
    const titel = schoon(String(body.titel || ''), 100).trim();
    const plek = schoon(String(body.plek || ''), 60).trim();
    const notitie = schoon(String(body.notitie || ''), 500).trim();
    const urgentie = ['laag', 'normaal', 'hoog'].includes(body.urgentie) ? body.urgentie : 'normaal';
    if (titel.length < 3) return { status: 400, error: 'Vertel kort wat er thuis niet goed werkt.' };
    if (plek.length < 2) return { status: 400, error: 'Kies of beschrijf de plek in huis.' };
    const meldingen = schrijf(key);
    const open = meldingen.filter(m => !['opgelost', 'geannuleerd'].includes(m.status));
    if (open.length >= 25) return { status: 409, error: 'Er staan al vijfentwintig meldingen open. Rond er eerst één af.' };
    const melding = { id: 'wo-' + crypto.randomBytes(6).toString('hex'), titel, plek, notitie,
      urgentie, status: 'gemeld', gemaaktAt: klok.datum().toISOString() };
    meldingen.push(melding);
    save();
    return { status: 200, ok: true, melding: veilig(melding) };
  }

  function annuleer(key, id) {
    const melding = lees(key).find(m => m.id === String(id || ''));
    if (!melding) return { status: 404, error: 'Deze onderhoudsmelding bestaat niet.' };
    if (melding.status === 'opgelost') return { status: 409, error: 'Een opgeloste melding blijft als onderhoudshistorie staan.' };
    if (melding.status !== 'geannuleerd') { melding.status = 'geannuleerd'; save(); }
    return { status: 200, ok: true, melding: veilig(melding) };
  }

  return { woningOnderhoud: { lijst, meld, annuleer } };
};
