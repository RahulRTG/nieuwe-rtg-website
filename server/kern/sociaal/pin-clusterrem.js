/* Sociaal (HTTP-rand): DE GEDEELDE RTG-PINREM.

   pin-deur.js houdt de directe, altijd beschikbare remmen in het proces. Met
   meerdere instances is dat niet genoeg: een aanvaller kan dezelfde pogingen
   over nodes verdelen. Als REDIS_URL is gezet, telt deze laag atomisch over het
   hele cluster per lid, per netwerkbron en voor alle missers samen.

   Redis-sleutels bevatten alleen sleutelgebonden HMAC-vingerafdrukken, nooit
   een handle of IP-adres. Daardoor is ook een gestolen Redis-keyspace niet als
   woordenboek voor adressen te gebruiken. EVAL maakt INCR+PEXPIRE ondeelbaar;
   een crash tussen die twee mag
   geen teller zonder vervaldatum achterlaten. Als Redis geconfigureerd maar
   onbereikbaar is, faalt alleen de PIN-opzoekdeur dicht. Contacten, login en
   bestaande relaties blijven werken. */
'use strict';

module.exports = ({ crypto }) => {
  const url = process.env.REDIS_URL;
  const verplicht = process.env.RTG_PIN_ENTERPRISE === '1';
  const hmacSleutel = process.env.RTG_CLUSTER_KEY || process.env.RTG_SECRET_KEY || 'rtg-pin-local-development';
  let client = null, verbinding = null;
  const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); end; return n";
  const hash = waarde => crypto.createHmac('sha256', hmacSleutel).update(String(waarde || '')).digest('hex').slice(0, 32);
  async function redis() {
    if (!url) return null;
    if (client) return client;
    if (!verbinding) {
      const c = require('../../redis').createClient({ url });
      c.on('error', () => {});
      verbinding = c.connect().then(() => { client = c; return c; }).catch(e => { verbinding = null; throw e; });
    }
    return verbinding;
  }
  async function tel(c, sleutel, vensterMs) {
    return Number(await c.eval(script, [sleutel], [vensterMs]));
  }
  async function voor({ actor, bron }) {
    if (!url) return verplicht
      ? { ok: false, status: 503, error: 'De gedeelde PIN-beveiliging is verplicht maar niet beschikbaar.' }
      : { ok: true, gedeeld: false };
    try {
      const c = await redis();
      const [lid, netwerk, missers] = await Promise.all([
        tel(c, 'rtg:pin:lid:' + hash(actor), 60 * 60 * 1000),
        tel(c, 'rtg:pin:bron:' + hash(bron), 60 * 60 * 1000),
        c.get('rtg:pin:missers')
      ]);
      if (lid > 30 || netwerk > 120 || Number(missers || 0) >= 120)
        return { ok: false, status: 429, error: 'Het opzoeken op RTG PIN ligt even stil. Probeer het later opnieuw.' };
      return { ok: true, gedeeld: true };
    } catch (e) {
      return { ok: false, status: 503, error: 'De gedeelde PIN-beveiliging is tijdelijk niet beschikbaar. Probeer het zo opnieuw.' };
    }
  }
  async function misser() {
    if (!url) return verplicht
      ? { ok: false, status: 503, error: 'De gedeelde PIN-beveiliging is verplicht maar niet beschikbaar.' }
      : { ok: true };
    try { await tel(await redis(), 'rtg:pin:missers', 60 * 1000); return { ok: true }; }
    catch (e) { return { ok: false, status: 503, error: 'De gedeelde PIN-beveiliging is tijdelijk niet beschikbaar.' }; }
  }
  return { voor, misser };
};
