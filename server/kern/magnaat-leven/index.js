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
const { nieuw, zorgBedrijf, meld, ontgrendel, euro } = require('./staat');
const { maakBoek, koppel, wereldVan } = require('./boek');
const { volgendeDag } = require('./dag');
const { ACTIES } = require('./acties');
const { toon } = require('./weergave');
const speelronde = require('./speelronde');
const { controleer, bevries } = require('./bewaking');
const { oordeelGeef, oordeelOverzicht } = require('./oordeel');

function maakLeven({ db, save = () => {}, nu = () => Date.now() } = {}) {
  const boek = maakBoek({ db });
  const eigen = require('../eigencollectie')({ db, domein: 'kern/magnaat-leven', bezit: { magnaatLeven: 'kaart', magnaatOordelen: 'lijst' } });
  const levens = () => eigen.bak('magnaatLeven');

  function haal(key, opnieuw, moeilijkheid) {
    const alle = levens();
    let st = alle[key];
    /* Een leven uit de eerste opzet (versie 1) had geen week en geen agenda; het
       begint opnieuw in plaats van half te worden omgebouwd. Wie zelf opnieuw
       begint, krijgt een NIEUWE wereld in het grootboek: het oude journaal
       blijft staan en wordt niet overschreven, want een journaal groeit alleen. */
    if (!st || st.versie !== 2 || opnieuw) {
      const ronde = opnieuw ? (st.ronde || 0) + 1 : 0;
      const niveau = moeilijkheid || (st && st.moeilijkheid) || 'normaal';
      st = nieuw({ wereld: wereldVan(key) + ':2' + (ronde ? ':' + ronde : ''), nu: nu(), moeilijkheid: niveau });
      st.ronde = ronde;
      koppel(st, boek);
      boek.open(st, R.niveauVan(st).startKas);
      meld(st, 'Het is maandag. Je werkt 24 uur per week als keukenmedewerker bij ' + R.BAAN.werkgever +
        ', je loon komt vrijdag, en je hebt ' + euro(R.niveauVan(st).startKas) + '. Je hebt een telefoon, een eenvoudige laptop, en vandaag nog ' +
        '4u 20m voor jezelf. Wat ga je maken?');
      ontgrendel(st, 'geld');
      alle[key] = st;
    }
    return koppel(zorgBedrijf(st), boek);
  }

  function bijrekenen(st) {
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

  /* Het vangnet om alles wat een leven verandert. Nog niets geboekt: terug naar
     hoe het was. Wel geboekt: bevriezen, want het journaal gaat niet terug.
     En kloppen de invarianten na afloop niet, dan ook bevriezen. */
  function beschermd(st, doe) {
    const voor = structuredClone(st), volgorde = st.boek.boekVolgorde;
    try {
      const r = doe();
      const schending = r && r.nieuw ? [] : controleer(st, boek);
      if (!schending.length) return r;
      bevries(st, schending[0], meld);
      save();
      return { status: 409, error: 'Dit leven is bevroren: ' + schending[0] + '.' };
    } catch (e) {
      if (st.boek.boekVolgorde === volgorde) {
        for (const k of Object.keys(st)) delete st[k];
        Object.assign(st, voor);
        koppel(st, boek);
        return { status: 500, error: 'Er ging iets mis bij deze handeling. Er is niets veranderd.' };
      }
      bevries(st, 'een handeling brak af nadat er al geboekt was', meld);
      save();
      return { status: 500, error: 'Er ging iets mis na een boeking. Dit leven is bevroren om je boeken te beschermen; begin opnieuw.' };
    }
  }

  /* V5: een handeling op een leven, met een vangnet eromheen (./bewaking.js).
     Een verzoek met een `verzoek`-sleutel die al is uitgevoerd, wordt niet
     nog eens uitgevoerd: wie na een verbroken verbinding opnieuw verstuurt,
     sluit geen dag twee keer af. */
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
      return Object.assign(bewaarEnToon(haal(key, true, body.moeilijkheid)), { nieuw: true });
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

  return { staat, actie, oordelen, verifieer: (key) => boek.verifieer(haal(key)) };
}

module.exports = { maakLeven };
