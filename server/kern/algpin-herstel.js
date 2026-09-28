/* De herstelsleutel van de algemene pin: uitgeven en claimen
   (CODECREDENTIALS.json, identity.algpin_herstelsleutel).

   Wat hier vastligt, en waarom het in één collectietransactie gebeurt:

   1. UITGEVEN TREKT IN. Een nieuwe aanvraag verwijdert elke eerdere sleutel van
      HETZELFDE lid, in dezelfde transactie die de nieuwe schrijft. Zonder dat
      bleven er na drie aanvragen drie werkende links in drie mails staan, en
      de oudste was net zo goed als de nieuwste. In PostgreSQL loopt dat onder
      het advisory slot plus FOR UPDATE van db.bewerkCollectie, dus twee
      instances kunnen niet elk een sleutel naast de andere zetten.
   2. CLAIMEN IS ÉÉN KEER. Opzoeken en verbruiken gebeuren in dezelfde
      transactie: twee gelijktijdige claims op twee instances leveren precies
      één winnaar, en de sleutel is weg voordat er ook maar een await volgt.
   3. CONSTANTE TIJD. De aangeboden hash wordt met ELKE bewaarde vergeleken
      (timingSafeEqual over 32 bytes, geen vroege uitgang) in plaats van als
      objectsleutel te worden opgezocht.

   De rij draagt uitgever, doel, scope, uitgifte, vervaltijd (een uur) en
   max_gebruik 1; in de opslag staat alleen de SHA-256 -- de kale sleutel gaat
   naar het eigen e-mailadres van het lid en nergens anders heen. */
'use strict';

const ISSUER = 'rtg.lid.algpin';
const DOEL = 'algpin-herstel';
const SCOPE = 'algpin.zet';

module.exports = ({ crypto, bewerkCollectie, sleutelHash, HERSTEL_MS }) => {
  /* Zonder collectietransactie is er geen atomaire claim, en dan liever een
     server die niet start dan een herstelsleutel die twee keer werkt. */
  if (typeof bewerkCollectie !== 'function')
    throw new Error('algpin-herstel: zonder db.bewerkCollectie is intrekken bij heruitgifte en eenmalig claimen niet atomair.');
  const transactie = werk => bewerkCollectie('algPinHerstel', werk);

  const gelijk = (a, b) => {
    const x = Buffer.from(String(a || ''), 'hex'), y = Buffer.from(String(b || ''), 'hex');
    if (x.length !== 32 || y.length !== 32) return false;
    return crypto.timingSafeEqual(x, y);
  };

  async function geef(key) {
    const kaal = crypto.randomBytes(24).toString('hex');   // 192 bit
    const h = sleutelHash(kaal);
    const t = Date.now();
    await transactie(rijen => {
      for (const [k, r] of Object.entries(rijen))
        if (!r || r.key === key || !(r.tot > t)) delete rijen[k];
      rijen[h] = { key, issuer: ISSUER, doel: DOEL, scope: SCOPE,
        issued_at: t, tot: t + HERSTEL_MS, max_gebruik: 1, gebruik: 0 };
    });
    return { sleutel: kaal, geldigTot: new Date(t + HERSTEL_MS).toISOString() };
  }

  /* Geeft { key } bij een geldige, ongebruikte sleutel, en anders null. Een
     verlopen treffer wordt ook verwijderd: hij is niets meer waard. */
  function claim(h) {
    const t = Date.now();
    return transactie(rijen => {
      let treffer = null;
      for (const k of Object.keys(rijen)) if (gelijk(k, h)) treffer = k;
      if (!treffer) return null;
      const r = rijen[treffer];
      delete rijen[treffer];
      return r && r.tot > t ? { key: r.key } : null;
    });
  }

  return { geef, claim, ISSUER, DOEL, SCOPE };
};
