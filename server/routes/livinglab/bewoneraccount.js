/* Living Lab, deel "bewoner": WIE ER STEMT EN AANDRAAGT (eigenaarsbesluit 19
   oktober 2026: gebruiken vraagt een account; gemeld door FoundationOS).

   De bewonersdeuren gingen open zonder account, en een stem droeg een alias
   uit het lijf: wie een andere alias koos, stemde opnieuw. Nu komt er alleen
   iemand binnen met een account (een gratis account is genoeg) of met een
   gezinsprofiel onder het account van een ouder (gezinCode + gezinToken in het
   lijf; rtf.verifieerProfiel past de accountplicht toe).

   De STEMMERSSLEUTEL is een hash van wie er stemt, nooit het account zelf: het
   onderzoeksdossier van een lab hoort niet terug te wijzen naar een lid. Hij is
   wel stabiel, zodat een tweede stem van hetzelfde account 409 krijgt, met welke
   alias ook. De alias blijft hooguit een weergavenaam. */
'use strict';

const crypto = require('crypto');
const testomgeving = require('../../testomgeving');

module.exports = ({ resolveSession, rtf }) => {
  function bewoner(req) {
    const kop = (req.get && req.get('authorization')) || '';
    const token = kop.startsWith('Bearer ') ? kop.slice(7) : null;
    const s = token && typeof resolveSession === 'function' ? resolveSession(token) : null;
    let wie = null;
    if (s && (s.account || testomgeving.actief(process.env)) && s.key) wie = 'lid:' + s.key;
    else {
      const b = req.body || {};
      const p = b.gezinCode && b.gezinToken && rtf && rtf.verifieerProfiel(b.gezinCode, b.gezinToken);
      if (p) wie = 'gezin:' + p.handle;
    }
    return wie ? { stemmer: 'st:' + crypto.createHash('sha256').update('lab2-stem|' + wie).digest('hex').slice(0, 32) } : null;
  }
  const GEEN_ACCOUNT = Object.freeze({ error: 'Log in met je RTG-account; een gratis account is genoeg.', accountNodig: true });
  return { bewoner, GEEN_ACCOUNT };
};
