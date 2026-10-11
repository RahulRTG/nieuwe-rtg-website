/* Het verbond: WIJZIGEN. Elke inhoudelijke wijziging zet beide tekens terug --
   wie tekende, tekende voor DIE tekst (index.js, regel 3). Een opgezegd of
   verlopen verbond verandert niet meer, en een wijziging die niets verandert
   geeft hetzelfde antwoord zonder tijdlijnregel of melding. */
'use strict';

const { AFSPRAAKVELDEN, toetsAfspraken } = require('../rtfos/partners');
const R = require('./regels');
const I = require('./invoer');

const DOEL_MAX = 300;

module.exports = ({ voorBeheer, bekijk, noteer, meldAnderen, naamVan, save, nu }) => {
  function wijzigVerbond(sess, id, invoer) {
    const key = sess.key;
    const r = voorBeheer(sess, id, 'wijzigt een verbond');
    if (r.fout) return r.fout;
    const { v, kk } = r;
    const d = I.dicht(v, nu()); if (d) return d;
    const b = invoer || {};

    const nieuw = { doel: v.doel, afspraken: Object.assign({}, v.afspraken), van: v.van, tot: v.tot };
    if (b.doel !== undefined) {
      nieuw.doel = I.schoon(b.doel, DOEL_MAX);
      const fd = I.toetsDoel(nieuw.doel); if (fd) return fd;
    }
    if (b.afspraken !== undefined) {
      const t = toetsAfspraken(b.afspraken, R.WIE);
      if (!t.ok) return { status: 400, error: t.error };
      Object.assign(nieuw.afspraken, t.waarden);
    }
    for (const veld of ['van', 'tot']) if (b[veld] !== undefined) nieuw[veld] = I.schoon(b[veld], 10) || null;
    const fdat = I.toetsDatums(nieuw.van, nieuw.tot); if (fdat) return fdat;

    const velden = [];
    if (nieuw.doel !== v.doel) velden.push('doel');
    for (const k of AFSPRAAKVELDEN) if (nieuw.afspraken[k] !== v.afspraken[k]) velden.push(k);
    if (nieuw.van !== v.van) velden.push('van');
    if (nieuw.tot !== v.tot) velden.push('tot');
    if (!velden.length) return { ok: true, al: true, verbond: bekijk(v, key) };

    const hadTekens = R.KANTEN.some(k => v.tekens[k]);
    Object.assign(v, nieuw);
    v.tekens = { a: null, b: null };
    noteer(v, { wat: 'gewijzigd', kant: kk.beheer[0], door: key, velden });
    if (hadTekens) noteer(v, { wat: 'tekens-teruggezet' });
    save();
    const melding = meldAnderen(v, key, kk.beheer, '"' + naamVan(v, kk.beheer[0]) + '" heeft het verbond gewijzigd (' +
      velden.join(', ') + ').' + (hadTekens ? ' Beide handtekeningen zijn teruggezet; er moet opnieuw worden getekend.' : ''));
    return { ok: true, verbond: bekijk(v, key), velden, tekensTeruggezet: hadTekens, melding };
  }
  return wijzigVerbond;
};
