/* Magnaat Van Nul (V1 From Zero, MAGNAAT.md): een leven per lid.

   Een mens met € 63 en een baan, via een eigen project, de eerste klant, een
   factuur die te laat wordt betaald en geldnood, naar een eerste bedrijf.

   DE KLOK REKENT BIJ EN TIKT NIET, zoals in World: bij elke aanraking draaien
   de dagen die sinds `gerekendTot` echt verstreken zijn (hooguit
   MAX_DAGEN_PER_KEER tegelijk), en pas daarna de handeling. Er loopt dus geen
   timer, en wie een week wegblijft, komt terug in een week later.

   Het leven hangt aan de sessiesleutel maar de wereld in het grootboek draagt
   een hash ervan: het journaal kent geen leden. Al het geld loopt door
   ./boek.js; na elke aanraking wordt het grootboek bevestigd. */
'use strict';
const crypto = require('crypto');
const R = require('./regels');
const { nieuw, meld, ontgrendel } = require('./staat');
const { maakBoek, koppel } = require('./boek');
const { volgendeDag } = require('./dag');
const { ACTIES } = require('./acties');
const { toon } = require('./weergave');

function maakLeven({ db, save = () => {}, nu = () => Date.now() } = {}) {
  const boek = maakBoek({ db });
  const eigen = require('../eigencollectie')({ db, domein: 'kern/magnaat-leven', bezit: { magnaatLeven: 'kaart' } });
  const levens = () => eigen.bak('magnaatLeven');
  const wereldVan = (key) => 'leven:' + crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 16);

  function haal(key) {
    const alle = levens();
    let st = alle[key];
    if (!st) {
      st = nieuw({ wereld: wereldVan(key), nu: nu() });
      koppel(st, boek);
      boek.open(st, R.START_KAS);
      meld(st, 'Je werkt als ' + R.BAAN.functie.toLowerCase() + ' bij ' + R.BAAN.werkgever + '. Over vijf dagen komt je loon; je hebt € 63.');
      ontgrendel(st, 'geld');
      alle[key] = st;
    }
    return koppel(st, boek);
  }

  function bijrekenen(st) {
    const t = nu();
    let n = 0;
    while (t - st.gerekendTot >= st.dagMs && n < R.MAX_DAGEN_PER_KEER) {
      volgendeDag(st);
      st.gerekendTot += st.dagMs;
      n++;
    }
    return n;
  }

  function bewaarEnToon(st) {
    boek.bevestig(st);
    save();
    return toon(st, boek, nu());
  }

  function staat(key) {
    const st = haal(key);
    bijrekenen(st);
    return bewaarEnToon(st);
  }

  function actie(key, body = {}) {
    const st = haal(key);
    bijrekenen(st);
    const doe = Object.prototype.hasOwnProperty.call(ACTIES, body.actie) ? ACTIES[body.actie] : null;
    if (!doe) { bewaarEnToon(st); return { status: 400, error: 'Die handeling bestaat niet in Van Nul.' }; }
    const r = doe(st, body);
    const beeld = bewaarEnToon(st);
    return r && r.error ? r : beeld;
  }

  return { staat, actie, verifieer: (key) => boek.verifieer(haal(key)), _bijrekenen: bijrekenen };
}

module.exports = { maakLeven };
