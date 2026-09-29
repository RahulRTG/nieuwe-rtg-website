/* De EENMALIGE inwisseling van een gezinsuitnodiging (./gezinsuitnodiging.js).

   Een uitnodiging mag precies een profiel opleveren. Voorheen las de route de
   uitnodiging, wachtte op het hashen van de pincode (scrypt, dus de event-loop
   vrij) en schreef pas daarna `geaccepteerd` weg: twee tikken tegelijk -- of twee
   instances op dezelfde database -- zagen allebei `open` en maakten allebei een
   profiel met een eigen sessie. Nu is lezen, controleren en afronden EEN
   collectietransactie op `foundation` (db.bewerkCollectie; in PostgreSQL een
   advisory lock plus SELECT ... FOR UPDATE, zie server/pg/collectietransactie.js).

   Alles wat asynchroon is (de pincode hashen, de rem) gebeurt ERVOOR; de bewerker
   zelf is synchroon, zoals de collectietransactie eist. De sleutel wordt tegen
   ELKE open uitnodiging van het gezin vergeleken met timingSafeEqual, zonder
   vroege uitgang. De sessie van het nieuwe profiel ontstaat BINNEN dezelfde
   transactie (./gezinstoken.js), zodat er nooit een profiel zonder of met twee
   eerste sessies uit een uitnodiging komt. */
'use strict';

function maak({ bewerkCollectie, crypto, tokens, nu, rid, ensureCodenaam }) {
  if (typeof bewerkCollectie !== 'function') throw new Error('gezinsclaim vereist de collectietransactie');
  const hash = w => crypto.createHash('sha256').update(String(w || '')).digest('hex');
  const gelijk = (a, b) => {
    const x = Buffer.from(String(a || ''), 'hex'), y = Buffer.from(String(b || ''), 'hex');
    return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
  };
  const eigen = (o, k) => o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null;

  /* { code, geheim, profiel, alleenGast, metSessie } -> { ok, code, profielId, token }
     of { status }. `profiel` draagt alleen wat de ontvanger zelf koos (avatar,
     kleur, pincode-hash of de RTG-koppeling); naam en rol komen uit de
     uitnodiging die de beheerder maakte. */
  function claim({ code, geheim, profiel, alleenGast, metSessie }) {
    const gezocht = hash(geheim);
    return new Promise(resolve => resolve(bewerkCollectie('foundation', f => {
      const g = eigen(eigen(f, 'gezinnen'), String(code || ''));
      if (!g) return { status: 404 };
      let u = null;
      for (const x of Array.isArray(g.uitnodigingen) ? g.uitnodigingen : [])
        if (x && x.sleutelHash && gelijk(x.sleutelHash, gezocht)) u = x;
      if (!u || u.status !== 'open' || !(Date.parse(u.verlooptAt) > Date.parse(nu()))) return { status: 404 };
      if (alleenGast && u.rol !== 'gast') return { status: 409 };
      const p = Object.assign({}, profiel || {}, { id: rid(4), naam: u.naam, rol: u.rol, groep: 'volw',
        at: nu(), uitnodigingId: u.id, relatie: u.relatie || '' });
      delete p.token;
      ensureCodenaam(p);
      if (!g.profielen || typeof g.profielen !== 'object') g.profielen = {};
      g.profielen[p.id] = p;
      u.status = 'geaccepteerd'; u.geaccepteerdAt = nu(); u.profielId = p.id;
      u.wijze = alleenGast ? 'rtg-account' : 'foundation';
      delete u.sleutelHash;
      return { ok: true, code: g.code, profielId: p.id, token: metSessie ? tokens.geef(g, p) : null };
    })));
  }
  return { claim, hash, gelijk };
}

module.exports = { maak };
