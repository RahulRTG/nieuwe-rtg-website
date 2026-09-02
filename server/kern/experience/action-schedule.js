/* Adapter naar de autoritatieve agenda. De broker beheert toestemming en
   bewijs; agenda.voegToe blijft de enige schrijver van het domeinobject. */
'use strict';

const { agendaLidSleutel } = require('../agenda');

function fout(error, status, code) { return { error, status, code }; }
const tekst = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

function echteDatum(v) {
  const s = String(v || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00.000Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
function echteTijd(v) {
  const m = String(v || '').match(/^(\d{2}):(\d{2})$/);
  return !v || !!(m && Number(m[1]) < 24 && Number(m[2]) < 60);
}

module.exports = function scheduleActie({ kern }) {
  function prepare({ parameters }) {
    const p = {
      title: tekst(parameters.title, 120), date: tekst(parameters.date, 10),
      time: tekst(parameters.time, 5) || null, note: tekst(parameters.note, 300) || null
    };
    if (!p.title) return fout('Geef de afspraak een titel.', 400, 'TITLE_REQUIRED');
    if (!echteDatum(p.date)) return fout('Kies een bestaande datum in YYYY-MM-DD.', 400, 'INVALID_DATE');
    if (!echteTijd(p.time)) return fout('Kies een geldige tijd in HH:MM.', 400, 'INVALID_TIME');
    return {
      ok: true, parameters: p,
      policy: { decision: 'ALLOW_WITH_CONFIRMATION', policyId: 'policy:own-schedule',
        version: 'v1', reasonCodes: ['OWN_PERSONAL_SCHEDULE'] },
      confirmation: { required: true,
        text: 'Plan “' + p.title + '” op ' + p.date + (p.time ? ' om ' + p.time : '') + '.' },
      consequence: { changesDomainTruth: true, changesExperienceState: false,
        createsFinancialCommitment: false, reversible: true, notificationSent: false }
    };
  }

  async function execute({ key, preview }) {
    const p = preview.parameters;
    const uit = await kern.agenda.voegToe(agendaLidSleutel(key), {
      titel: p.title, datum: p.date, tijd: p.time, notitie: p.note,
      bron: 'experience:' + preview.id
    });
    if (!uit || uit.error) return uit || fout('De afspraak kon niet worden vastgelegd.', 500, 'SCHEDULE_WRITE_FAILED');
    const objectRef = { domain: 'agenda', type: 'afspraak', id: String(uit.item.id).toLowerCase() };
    return { ok: true, objectRef, result: { item: uit.item } };
  }

  return { prepare, execute };
};
