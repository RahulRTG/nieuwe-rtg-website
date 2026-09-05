/* Herhaalveilige vrachtbediening.

   Een proxyretry op "etappe klaar" mag nooit twee etappes afvinken en een
   retry op een melding mag geen dubbel klantbericht maken. Daarom staat de
   gehashte opdrachtsleutel bij dezelfde zending en commit zij met de mutatie
   onder hetzelfde vrachtcollectieslot. */
'use strict';
const { canoniek } = require('../lib/dubbeltik');
const MAX_BEWIJZEN = 100;

module.exports = ({ crypto, nu, metKaart, zaakIn, zoek, toon, meld, schoon,
  internationaal, etappeTekst }) => {
  const hash = tekst => crypto.createHash('sha256').update(String(tekst || '')).digest('hex');
  const sleutel = idem => {
    const s = String(idem || '').trim();
    return s.length >= 16 && s.length <= 200 ? s : null;
  };

  function begin(z, soort, idem, invoer) {
    const s = sleutel(idem);
    if (!s) return { fout:{ status:400, error:'Een veilige idempotentiesleutel is verplicht.' } };
    const idemHash = hash('vracht-handeling|' + z.id + '|' + soort + '|' + s);
    const afdruk = hash('vracht-invoer|' + soort + '|' + canoniek(invoer));
    const lijst = Array.isArray(z.verwerkte_handelingen) ? z.verwerkte_handelingen : [];
    const oud = lijst.find(x => x.idem_hash === idemHash);
    if (oud) return oud.invoer_hash === afdruk ? { herhaald:true }
      : { fout:{ status:409, error:'Deze idempotentiesleutel hoort al bij een andere vrachthandeling.' } };
    return { bewijs:{ soort, idem_hash:idemHash, invoer_hash:afdruk, at:nu() } };
  }

  function voltooi(z, bewijs) {
    z.verwerkte_handelingen = Array.isArray(z.verwerkte_handelingen) ? z.verwerkte_handelingen : [];
    z.verwerkte_handelingen.push(bewijs);
    if (z.verwerkte_handelingen.length > MAX_BEWIJZEN)
      z.verwerkte_handelingen.splice(0, z.verwerkte_handelingen.length - MAX_BEWIJZEN);
  }

  function voer(code, id, soort, idem, invoer, werk) {
    return metKaart(kaart => {
      const z = zoek(kaart, code, id);
      if (!z) return { status:404, error:'Zending niet gevonden.' };
      const poort = begin(z, soort, idem, invoer);
      if (poort.fout) return poort.fout;
      if (poort.herhaald) return { ok:true, herhaald:true, zending:toon(z, null, code) };
      const fout = werk(z);
      if (fout) return fout;
      voltooi(z, poort.bewijs);
      return { ok:true, zending:toon(z, null, code) };
    });
  }

  const etappeKlaar = (code, id, idem) => voer(code, id, 'etappe-klaar', idem, { id }, z => {
    if (z.status !== 'onderweg') return { status:400, error:'Deze zending is niet onderweg.' };
    const bezig = z.etappes.find(e => e.status === 'bezig');
    if (!bezig) return { status:400, error:'Er loopt geen etappe.' };
    bezig.status = 'klaar';
    const volgende = z.etappes.find(e => e.status === 'gepland');
    if (volgende) { volgende.status = 'bezig'; meld(z, 'Etappe klaar; nu ' + etappeTekst(volgende) + '.'); }
    else if (internationaal(z)) { z.status = 'douane'; meld(z, 'Aangekomen in ' + z.naar.land + '; wacht op douane-inklaring.'); }
    else { z.status = 'aangekomen'; meld(z, 'Aangekomen in ' + z.naar.plaats + '; klaar voor aflevering.'); }
    return null;
  });

  const douaneVrij = (code, id, idem) => voer(code, id, 'douane-vrij', idem, { id }, z => {
    if (z.status !== 'douane') return { status:400, error:'Deze zending staat niet bij de douane.' };
    z.status = 'aangekomen';
    meld(z, 'Douane heeft ingeklaard; klaar voor aflevering in ' + z.naar.plaats + '.');
    return null;
  });

  const afleveren = (code, id, idem) => voer(code, id, 'afleveren', idem, { id }, z => {
    if (z.status !== 'aangekomen') return { status:400, error:'Eerst aankomen (en inklaren), dan afleveren.' };
    z.status = 'afgeleverd'; meld(z, 'Afgeleverd en getekend voor ontvangst.');
    return null;
  });

  function melding(code, id, tekst, idem) {
    const t = schoon(tekst, 200);
    if (!t) return { status:400, error:'Schrijf een korte melding.' };
    return voer(code, id, 'melding', idem, { id, tekst:t }, z => { meld(z, t); return null; });
  }

  return { etappeKlaar, douaneVrij, afleveren, melding };
};
