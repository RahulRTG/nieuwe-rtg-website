/* Sociaal (deelmodule): DE VEILIGHEIDSSTAAT VAN DE RTG PIN.

   De contactpin zelf woont in ./pin.js. Hier staan alleen de dingen die een
   adres tot een beheersbaar veiligheidsanker maken:

   - een ingetrokken pin wordt NOOIT opnieuw uitgegeven;
   - een lid kan alle nieuwe pin-handelingen in een keer bevriezen;
   - belangrijke handelingen landen in een klein, eigen veiligheidsjournaal.

   Ingetrokken pins bewaren we niet leesbaar en ook niet gekoppeld aan een lid.
   De SHA-256-vingerafdruk is alleen een tombstone in de uitgeefdeur. Een
   contactpin is geen geheim, maar na intrekking is er ook geen reden om hem in
   een database-export terug te laten komen. De tombstone blijft bewust staan
   na het verwijderen van een account: anders kan precies die oude pin later
   bij een ander mens terechtkomen. */
'use strict';
const { vingerafdruk } = require('./pin-tombstone');
const klok = require('../../lib/klok');

module.exports = ({ db, save, crypto }) => {
  const MAX_GEBEURTENISSEN = 80;
  const SAMENVOEG_MS = 60 * 1000;

  const nuIso = () => klok.datum().toISOString();
  const tombstone = pin => vingerafdruk(crypto, pin);

  function ingetrokkenRij() {
    if (!db.data.contactPinRetired || typeof db.data.contactPinRetired !== 'object')
      db.data.contactPinRetired = {};
    return db.data.contactPinRetired;
  }
  function staatRij() {
    if (!db.data.contactPinSecurity || typeof db.data.contactPinSecurity !== 'object')
      db.data.contactPinSecurity = {};
    return db.data.contactPinSecurity;
  }
  function staat(handle) {
    const rij = staatRij();
    if (!rij[handle] || typeof rij[handle] !== 'object') rij[handle] = { gebeurtenissen: [] };
    if (!Array.isArray(rij[handle].gebeurtenissen)) rij[handle].gebeurtenissen = [];
    return rij[handle];
  }

  function pinIsIngetrokken(pin) {
    if (!pin) return false;
    return !!ingetrokkenRij()[tombstone(pin)];
  }
  function pinTrekIn(pin, reden) {
    if (!pin) return false;
    const r = ingetrokkenRij(), sleutel = tombstone(pin);
    if (r[sleutel]) return false;
    r[sleutel] = { at: nuIso(), reden: String(reden || 'vernieuwd').slice(0, 30) };
    return true;
  }

  /* Het journaal is voor de gebruiker, niet voor profilering. Daarom geen IP,
     user-agent, intern handle of volledige pin; alleen wat nodig is om te zien
     wat er met het eigen veiligheidsadres gebeurde. Gelijke gebeurtenissen in
     een minuut worden samengevoegd, zodat een aanvaller de lijst niet met ruis
     kan leegdrukken. */
  function noteer(handle, soort, gegevens) {
    if (!handle) return null;
    const s = staat(handle), g = gegevens || {}, at = nuIso();
    const schoon = {
      soort: String(soort || 'onbekend').slice(0, 40),
      bron: g.bron ? String(g.bron).slice(0, 20) : null,
      uitkomst: g.uitkomst ? String(g.uitkomst).slice(0, 20) : null,
      doel: g.doel ? String(g.doel).replace(/[<>]/g, '').slice(0, 80) : null
    };
    const laatste = s.gebeurtenissen[0];
    if (laatste && laatste.soort === schoon.soort && laatste.bron === schoon.bron &&
        laatste.uitkomst === schoon.uitkomst && laatste.doel === schoon.doel &&
        klok.nu() - Date.parse(laatste.at) < SAMENVOEG_MS) {
      laatste.aantal = Math.min(9999, Number(laatste.aantal || 1) + 1);
      laatste.laatst = at;
      save();
      return laatste;
    }
    const regel = { id: crypto.randomBytes(6).toString('hex'), at, aantal: 1, ...schoon };
    s.gebeurtenissen.unshift(regel);
    if (s.gebeurtenissen.length > MAX_GEBEURTENISSEN) s.gebeurtenissen.length = MAX_GEBEURTENISSEN;
    save();
    return regel;
  }

  const isBevroren = handle => !!(staatRij()[handle] || {}).bevroren;
  function bevries(handle, aan) {
    if (!handle) return { status: 400, error: 'Onbekend lid.' };
    const s = staat(handle), nieuw = !!aan;
    if (!!s.bevroren === nieuw) return { status: 200, ...beeld(handle) };
    s.bevroren = nieuw;
    s.bevrorenSinds = nieuw ? nuIso() : null;
    noteer(handle, nieuw ? 'noodslot_aan' : 'noodslot_uit', { bron: 'veiligheid', uitkomst: 'gelukt' });
    return { status: 200, ...beeld(handle) };
  }
  function beeld(handle) {
    const s = staatRij()[handle] || {};
    return {
      bevroren: !!s.bevroren,
      bevrorenSinds: s.bevrorenSinds || null,
      gebeurtenissen: (s.gebeurtenissen || []).slice(0, 20).map(x => ({ ...x }))
    };
  }

  return { pinIsIngetrokken, pinTrekIn, pinBeveiligingNoteer: noteer,
    pinBevroren: isBevroren, pinBevries: bevries, pinBeveiligingBeeld: beeld };
};
