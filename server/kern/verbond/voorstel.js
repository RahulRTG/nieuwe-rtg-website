/* Het verbond: VOORSTELLEN. Een beheerder van genootschap A stelt een verbond
   voor aan genootschap B. Voorstellen is geen tekenen: het verbond begint als
   concept, en beide kanten tekenen daarna elk voor zichzelf (index.js).

   Een geheim genootschap B bestaat niet voor wie er niet in zit: dan is het
   antwoord hetzelfde als bij een verzonnen id. */
'use strict';

const crypto = require('crypto');
const { AFSPRAAKVELDEN, toetsAfspraken } = require('../rtfos/partners');
const R = require('./regels');
const { schoon, toetsDoel, toetsDatums } = require('./invoer');

const DOEL_MAX = 300;
const MAX_LOPEND_PER_GROEP = 50;
const GEEN_GROEP = { status: 404, error: 'Dit genootschap bestaat niet.' };

module.exports = ({ genootschap, lijst, bak, bekijk, noteer, meldAnderen, save, nu, iso }) => {
  function voorstel(sess, invoer) {
    const b = invoer || {};
    const key = sess.key;
    const grA = genootschap.groepMet(b.groep);
    if (!grA || (grA.soort === 'geheim' && !genootschap.isLid(grA, key))) return GEEN_GROEP;
    if (!genootschap.isBeheer(grA, key)) return { status: 403, error: 'Alleen een beheerder van het genootschap stelt een verbond voor.' };
    const grB = genootschap.groepMet(b.naar);
    if (!grB || (grB.soort === 'geheim' && !genootschap.isLid(grB, key)))
      return { status: 404, error: 'Het genootschap waarmee je een verbond wilt sluiten, bestaat niet of is niet voor je te vinden.' };
    if (String(grA.id) === String(grB.id)) return { status: 400, error: 'Een verbond gaat tussen twee verschillende genootschappen.' };

    const doel = schoon(b.doel, DOEL_MAX);
    const fd = toetsDoel(doel); if (fd) return fd;
    const t = toetsAfspraken(b.afspraken, R.WIE);
    if (!t.ok) return { status: 400, error: t.error };
    const van = schoon(b.van, 10) || null, tot = schoon(b.tot, 10) || null;
    const fdat = toetsDatums(van, tot); if (fdat) return fdat;

    // Een dubbele tik maakt geen tweede verbond: zelfde kanten, zelfde doel, nog lopend.
    const zelfde = lijst().find(v => v.kanten[0].ref === grA.id && v.kanten[1].ref === grB.id &&
      v.doel === doel && !['opgezegd', 'verlopen'].includes(R.standVan(v, nu())));
    if (zelfde) return { ok: true, al: true, verbond: bekijk(zelfde, key) };

    const lopend = (gid) => lijst().filter(v => v.kanten.some(k => k.ref === gid) &&
      !['opgezegd', 'verlopen'].includes(R.standVan(v, nu()))).length;
    if (lopend(grA.id) >= MAX_LOPEND_PER_GROEP || lopend(grB.id) >= MAX_LOPEND_PER_GROEP)
      return { status: 409, error: 'Een van beide genootschappen heeft het maximum aan lopende verbonden (' + MAX_LOPEND_PER_GROEP + ').' };

    const afspraken = {};
    for (const k of AFSPRAAKVELDEN) afspraken[k] = t.waarden[k] || null;
    const v = {
      id: 'vb' + crypto.randomBytes(8).toString('hex'),
      kanten: [{ soort: 'genootschap', ref: grA.id }, { soort: 'genootschap', ref: grB.id }],
      doel, afspraken, van, tot, at: iso(),
      tekens: { a: null, b: null }, opzegging: null, actiefSinds: null, tijdlijn: []
    };
    noteer(v, { wat: 'voorgesteld', kant: 'a', door: key });
    bak().unshift(v);
    save();
    const melding = meldAnderen(v, key, ['a'], 'Het genootschap "' + grA.naam + '" stelt een verbond voor: ' + doel);
    return { ok: true, verbond: bekijk(v, key), melding };
  }

  return voorstel;
};
