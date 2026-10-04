/* Magnaat FROM ZERO (V1, MAGNAAT.md): een leven per lid, van bijna niets tot
   een eigen bedrijf.

   DE KLOK REKENT BIJ EN TIKT NIET: bij elke aanraking draaien de dagen die
   sinds `gerekendTot` echt verstreken zijn (hooguit MAX_DAGEN_PER_KEER), en pas
   daarna de handeling. Wie klaar is, sluit zijn dag zelf af (`slaap`).

   Het leven hangt aan de sessiesleutel, de wereld in het grootboek aan een hash
   ervan: het journaal kent geen leden. Al het geld loopt door ./boek.js, en na
   elke aanraking wordt het grootboek bevestigd. */
'use strict';
const R = require('./regels');
const { nieuw, zorgBedrijf, meld, ontgrendel, euro } = require('./staat');
const { maakBoek, koppel, wereldVan } = require('./boek');
const { volgendeDag } = require('./dag');
const { ACTIES } = require('./acties');
const { toon } = require('./weergave');
const speelronde = require('./speelronde');
const { maakVangnet } = require('./bewaking');
const { oordeelGeef, oordeelOverzicht } = require('./oordeel');

const KIES_START = 'Kies waar je begint: ' + Object.values(R.STARTPOSITIES).map(x => x.naam.toLowerCase()).join(', ') + '.';

function maakLeven({ db, save = () => {}, nu = () => Date.now() } = {}) {
  const boek = maakBoek({ db });
  const eigen = require('../eigencollectie')({ db, domein: 'kern/magnaat-leven', bezit: { magnaatLeven: 'kaart', magnaatOordelen: 'lijst', magnaatSteden: 'kaart' } });
  const levens = () => eigen.bak('magnaatLeven');

  function haal(key, opnieuw, moeilijkheid, start) {
    const alle = levens();
    let st = alle[key];
    /* Een leven van versie 1 begint opnieuw. Wie zelf opnieuw begint, krijgt een
       NIEUWE wereld in het grootboek: een journaal groeit alleen. */
    if (!st || st.versie !== 2 || opnieuw) {
      const ronde = opnieuw ? (st.ronde || 0) + 1 : 0;
      const niveau = moeilijkheid || (st && st.moeilijkheid) || 'normaal';
      const begin = start || (st && st.start) || 'keuken';
      st = nieuw({ wereld: wereldVan(key) + ':2' + (ronde ? ':' + ronde : ''), nu: nu(), moeilijkheid: niveau, start: begin });
      st.ronde = ronde;
      koppel(st, boek);
      boek.open(st, R.beginKas(st));
      const v = R.startVan(st).verplichting;
      meld(st, 'Het is maandag. Je werkt ' + st.baan.urenPerWeek + ' uur per week als ' + st.baan.functie.toLowerCase() + ' bij ' + st.baan.werkgever +
        ', je loon komt vrijdag, en je hebt ' + euro(R.beginKas(st)) + (R.startVan(st).extraKas ? ', waarvan ' + euro(R.startVan(st).extraKas) + ' van je tante' : '') +
        (v ? '. Elke vier weken gaat er ' + euro(v.bedrag) + ' naar ' + v.leverancier : '') + '. Je hebt een telefoon, een eenvoudige laptop, en vandaag nog ' +
        '4u 20m voor jezelf. Wat ga je maken?');
      ontgrendel(st, 'geld');
      alle[key] = st;
    }
    return koppel(zorgBedrijf(st), boek);
  }

  function bijrekenen(st) {
    if (st.stad) return 0; // in een gedeelde stad gaat de dag door als iedereen klaar is (./stad.js)
    const t = nu();
    let n = 0;
    while (t - st.gerekendTot >= st.dagMs && n < R.MAX_DAGEN_PER_KEER && !st.voorbij) {
      volgendeDag(st);
      st.gerekendTot += st.dagMs;
      n++;
    }
    return n;
  }

  function bewaarEnToon(st, weg) {
    boek.bevestig(st);
    save();
    return toon(st, boek, nu(), weg);
  }

  /* TERWIJL JE WEG WAS (V4): wie na een paar dagen terugkomt, ziet eerst wat er
     in die dagen gebeurde dat ertoe doet, en niet alleen de stand van nu. */
  function staat(key) {
    const st = haal(key);
    if (st.bevroren) return bewaarEnToon(st);
    return beschermd(st, () => {
      const voor = st.dag, n = bijrekenen(st);
      const weg = n >= 2 ? { dagen: n, van: voor, meldingen: st.meldingen.filter(m => m.dag > voor && m.soort !== 'info' && m.soort !== 'rtg').slice(0, 8) } : null;
      return bewaarEnToon(st, weg);
    });
  }

  // Het vangnet om alles wat een leven verandert: maakVangnet in ./bewaking.js.
  const beschermd = maakVangnet({ boek, save, meld, koppel });

  /* V5: een handeling met een vangnet eromheen (./bewaking.js). Een `verzoek`-sleutel
     die al is uitgevoerd, gaat niet nog eens: geen dag twee keer afsluiten. */
  function actie(key, invoer) {
    const body = invoer && typeof invoer === 'object' && !Array.isArray(invoer) ? invoer : {};
    if (typeof body.actie !== 'string') return { status: 400, error: 'Die handeling bestaat niet in Magnaat.' };
    const st = haal(key);
    if (st.bevroren && body.actie !== 'opnieuw') {
      return { status: 409, error: 'Dit leven is bevroren: ' + st.bevroren.reden + '. Begin opnieuw om verder te spelen.' };
    }
    if (st.voorbij && body.actie !== 'opnieuw' && body.actie !== 'oordeel') {
      return { status: 409, error: 'Dit leven is voorbij: ' + st.voorbij.reden + '. Begin opnieuw om verder te spelen.' };
    }
    const vk = typeof body.verzoek === 'string' && body.verzoek.length <= 64 ? body.verzoek : null;
    if (vk && (st.verzoeken || []).includes(vk)) return Object.assign(bewaarEnToon(st), { herhaald: true });
    return beschermd(st, () => voerUit(key, st, body, vk));
  }

  function voerUit(key, st, body, vk) {
    bijrekenen(st);
    let r;
    if (body.actie === 'slaap') {
      volgendeDag(st);
      st.gerekendTot = nu();
    } else if (body.actie === 'oordeel') {
      r = oordeelGeef(st, body, eigen.bak('magnaatOordelen'), nu());
    } else if (body.actie === 'tempo') {
      r = speelronde.tempo(st, body, nu());
    } else if (body.actie === 'doorspoelen') {
      r = speelronde.doorspoelen(st, nu());
    } else if (body.actie === 'opnieuw') {
      if (body.zeker !== true) return { status: 400, error: 'Opnieuw beginnen gooit dit leven weg. Bevestig het met "zeker".' };
      if (body.moeilijkheid != null && !R.MOEILIJKHEID[body.moeilijkheid]) return { status: 400, error: 'Kies licht, normaal of zwaar.' };
      if (body.begin != null && !Object.prototype.hasOwnProperty.call(R.STARTPOSITIES, body.begin)) return { status: 400, error: KIES_START };
      return Object.assign(bewaarEnToon(haal(key, true, body.moeilijkheid, body.begin)), { nieuw: true });
    } else if (body.actie === 'start') {
      /* Waar je begint, net als de moeilijkheid: op de eerste dag zonder bevestiging, later alleen door opnieuw te beginnen. */
      if (!Object.prototype.hasOwnProperty.call(R.STARTPOSITIES, body.begin)) return { status: 400, error: KIES_START };
      if (st.dag !== 1 || st.aanbod) return { status: 400, error: 'Waar je begint kies je aan het begin. Wil je het anders, begin dan opnieuw.' };
      if ((st.start || 'keuken') === body.begin) return bewaarEnToon(st);
      return Object.assign(bewaarEnToon(haal(key, true, null, body.begin)), { nieuw: true });
    } else if (body.actie === 'moeilijkheid') {
      /* Op de eerste dag, voordat je iets hebt gekozen, gaat er niets verloren: dan kan het zonder bevestiging. */
      if (!R.MOEILIJKHEID[body.stand]) return { status: 400, error: 'Kies licht, normaal of zwaar.' };
      if (st.dag !== 1 || st.aanbod) return { status: 400, error: 'De moeilijkheid kies je aan het begin. Wil je het anders, begin dan opnieuw.' };
      if ((st.moeilijkheid || 'normaal') === body.stand) return bewaarEnToon(st);
      return Object.assign(bewaarEnToon(haal(key, true, body.stand)), { nieuw: true });
    } else {
      const doe = Object.prototype.hasOwnProperty.call(ACTIES, body.actie) ? ACTIES[body.actie] : null;
      r = doe ? doe(st, body) : { status: 400, error: 'Die handeling bestaat niet in Magnaat.' };
    }
    if (vk && !(r && r.error)) st.verzoeken = [vk].concat(st.verzoeken || []).slice(0, 20);
    const beeld = bewaarEnToon(st);
    return r && r.error ? r : beeld;
  }

  /* De speelronde voor het kantoor (./oordeel.js): anoniem, en lezen schept niets. */
  const oordelen = () => oordeelOverzicht(eigen.kijk('magnaatOordelen') || []);

  /* Voor een gedeelde stad (./stad.js): een leven op een interne sleutel, en een dag verder onder hetzelfde vangnet. */
  const intern = { eigen, haal, actie, toon: (key) => bewaarEnToon(haal(key)),
    dag: (key) => { const st = haal(key); return st.voorbij || st.bevroren ? null : beschermd(st, () => { volgendeDag(st); return bewaarEnToon(st); }); } };
  return { staat, actie, oordelen, intern, verifieer: (key) => boek.verifieer(haal(key)) };
}

module.exports = { maakLeven };
