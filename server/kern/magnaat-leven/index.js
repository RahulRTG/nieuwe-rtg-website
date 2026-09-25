/* Magnaat FROM ZERO (V1, MAGNAAT.md): een leven per lid, van bijna niets tot
   een eigen bedrijf.

   DE KLOK REKENT BIJ EN TIKT NIET, zoals in World: bij elke aanraking draaien
   de dagen die sinds `gerekendTot` echt verstreken zijn (hooguit
   MAX_DAGEN_PER_KEER tegelijk), en pas daarna de handeling. Wie klaar is met
   zijn dag, sluit hem zelf af (`slaap`); de klok telt dan vanaf nu opnieuw.

   Het leven hangt aan de sessiesleutel, de wereld in het grootboek aan een hash
   ervan: het journaal kent geen leden. Al het geld loopt door ./boek.js, en na
   elke aanraking wordt het grootboek bevestigd. */
'use strict';
const R = require('./regels');
const { nieuw, meld, ontgrendel, euro } = require('./staat');
const { maakBoek, koppel, wereldVan } = require('./boek');
const { volgendeDag } = require('./dag');
const { ACTIES } = require('./acties');
const { toon } = require('./weergave');
const speelronde = require('./speelronde');

function maakLeven({ db, save = () => {}, nu = () => Date.now() } = {}) {
  const boek = maakBoek({ db });
  const eigen = require('../eigencollectie')({ db, domein: 'kern/magnaat-leven', bezit: { magnaatLeven: 'kaart' } });
  const levens = () => eigen.bak('magnaatLeven');

  function haal(key, opnieuw) {
    const alle = levens();
    let st = alle[key];
    /* Een leven uit de eerste opzet (versie 1) had geen week en geen agenda; het
       begint opnieuw in plaats van half te worden omgebouwd. Wie zelf opnieuw
       begint, krijgt een NIEUWE wereld in het grootboek: het oude journaal
       blijft staan en wordt niet overschreven, want een journaal groeit alleen. */
    if (!st || st.versie !== 2 || opnieuw) {
      const ronde = opnieuw ? (st.ronde || 0) + 1 : 0;
      st = nieuw({ wereld: wereldVan(key) + ':2' + (ronde ? ':' + ronde : ''), nu: nu() });
      st.ronde = ronde;
      koppel(st, boek);
      boek.open(st, R.START_KAS);
      meld(st, 'Het is maandag. Je werkt 24 uur per week als keukenmedewerker bij ' + R.BAAN.werkgever +
        ', je loon komt vrijdag, en je hebt ' + euro(R.START_KAS) + '. Je hebt een telefoon, een eenvoudige laptop, en vandaag nog ' +
        '4u 20m voor jezelf. Wat ga je maken?');
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
    let r;
    if (body.actie === 'slaap') {
      volgendeDag(st);
      st.gerekendTot = nu();
    } else if (body.actie === 'tempo') {
      r = speelronde.tempo(st, body, nu());
    } else if (body.actie === 'doorspoelen') {
      r = speelronde.doorspoelen(st, nu());
    } else if (body.actie === 'opnieuw') {
      if (body.zeker !== true) return { status: 400, error: 'Opnieuw beginnen gooit dit leven weg. Bevestig het met "zeker".' };
      return bewaarEnToon(haal(key, true));
    } else {
      const doe = Object.prototype.hasOwnProperty.call(ACTIES, body.actie) ? ACTIES[body.actie] : null;
      r = doe ? doe(st, body) : { status: 400, error: 'Die handeling bestaat niet in Magnaat.' };
    }
    const beeld = bewaarEnToon(st);
    return r && r.error ? r : beeld;
  }

  return { staat, actie, verifieer: (key) => boek.verifieer(haal(key)) };
}

module.exports = { maakLeven };
