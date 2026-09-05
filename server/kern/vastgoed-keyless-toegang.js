/* Een fysieke deurcode heeft gevolgen buiten RTG. De bestaande zes-tekenkode
   heeft nog geen hash-only lifecycle, intrekking of koppeling met een echte
   slotprovider. Daarom mag de rest van de vastgoedflow in productie door,
   maar wordt er geen code uitgegeven en kan de consumer niet openen. */
'use strict';

const STATUS = 503;
const ANTWOORD = Object.freeze({
  error:'Keyless toegang is nog niet vrijgegeven.',
  code:'vastgoed-keyless-niet-vrijgegeven'
});

module.exports = ({ env } = {}) => {
  const omgeving = env || process.env;
  const productie = () => omgeving.NODE_ENV === 'production';
  const maak = (moment, codeNieuw) => {
    if (productie()) return null;
    const t = new Date(String(moment || '')).getTime();
    if (!Number.isFinite(t) || typeof codeNieuw !== 'function')
      throw new Error('Keyless toegang vereist een geldig moment en codegenerator.');
    return { code:codeNieuw(), van:new Date(t - 30 * 60000).toISOString(),
      tot:new Date(t + 120 * 60000).toISOString(), gebruikt:[] };
  };
  const weigerAlsProductie = res => {
    if (!productie()) return false;
    res.set('Cache-Control', 'no-store');
    res.status(STATUS).json(ANTWOORD);
    return true;
  };
  return { productie, maak, weigerAlsProductie };
};

module.exports.STATUS = STATUS;
module.exports.ANTWOORD = ANTWOORD;
