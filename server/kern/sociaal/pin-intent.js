/* Sociaal (deelmodule): DE BEWUSTE TWEEDE STAP.

   De UI liet altijd eerst zien wie achter een RTG PIN zat en stuurde pas na een
   tweede druk een verzoek. Zonder serverbewijs kon een API-client die eerste
   stap echter overslaan en rechtstreeks /connect aanroepen. Deze laag maakt
   de menselijke volgorde ook een protocolregel:

     kijken -> eenmalige bevestiging -> precies die persoon verbinden.

   De bevestiging bevat een verse nonce van 192 bits en leeft negentig seconden.
   Actor, doel, bron en concrete vaste of levende code zitten in een AES-GCM-
   verzegeling: de browser kan ze niet lezen of wijzigen, terwijl iedere RTG-
   instance met dezelfde clustersleutel ze wel kan controleren. Dat voorkomt
   dat stap twee achter een load balancer willekeurig op de uitgevende node moet
   landen.

   Een geconfigureerd Redis-cluster claimt de nonce met één atomisch Lua-
   commando. Daardoor kan ook een gelijktijdige replay op twee instances maar
   één keer winnen. Zonder Redis houdt de lokale ontwikkel-/één-processtand een
   begrensde replaylijst in het geheugen. Enterprise-productie verplicht Redis
   elders al met RTG_PIN_ENTERPRISE=1. */
'use strict';
const klok = require('../../lib/klok');

module.exports = ({ crypto }) => {
  const TTL_MS = 90 * 1000;
  const MAX_GEBRUIKT = 20000;
  const AAD = Buffer.from('rtg-pin-intent-v2');
  const redisUrl = process.env.REDIS_URL;
  const clusterGeheim = process.env.RTG_CLUSTER_KEY || process.env.RTG_SECRET_KEY;
  const sleutel = clusterGeheim
    ? crypto.createHash('sha256').update('rtg-pin-intent-v2\0' + clusterGeheim).digest()
    : crypto.randomBytes(32);
  const gebruikt = new Map();                 // nonce -> vervalt; lokale replayrem
  let client = null, verbinding = null;
  const claimScript = "if redis.call('EXISTS',KEYS[1])==1 then return 0 end; redis.call('PSETEX',KEYS[1],ARGV[1],'1'); return 1";

  function ruim(nu) {
    for (const [nonce, vervalt] of gebruikt) {
      if (vervalt >= nu && gebruikt.size <= MAX_GEBRUIKT) break;
      gebruikt.delete(nonce);
    }
  }
  function verzegel(payload) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', sleutel, iv);
    cipher.setAAD(AAD);
    const tekst = Buffer.from(JSON.stringify(payload));
    const dicht = Buffer.concat([cipher.update(tekst), cipher.final()]);
    return ['PI2', iv.toString('base64url'), dicht.toString('base64url'),
      cipher.getAuthTag().toString('base64url')].join('.');
  }
  function ontzegel(token) {
    const tekst = String(token || '');
    if (tekst.length > 1024) return null;
    const p = tekst.split('.');
    if (p.length !== 4 || p[0] !== 'PI2') return null;
    try {
      const iv = Buffer.from(p[1], 'base64url'), dicht = Buffer.from(p[2], 'base64url');
      const tag = Buffer.from(p[3], 'base64url');
      if (iv.length !== 12 || tag.length !== 16 || !dicht.length) return null;
      const decipher = crypto.createDecipheriv('aes-256-gcm', sleutel, iv);
      decipher.setAAD(AAD); decipher.setAuthTag(tag);
      const v = JSON.parse(Buffer.concat([decipher.update(dicht), decipher.final()]).toString('utf8'));
      if (!v || typeof v.a !== 'string' || typeof v.d !== 'string' ||
          typeof v.b !== 'string' || typeof v.r !== 'string' ||
          !Number.isFinite(v.e) || !/^[A-Za-z0-9_-]{32}$/.test(v.n)) return null;
      return v;
    } catch (e) { return null; }
  }
  async function redis() {
    if (!redisUrl) return null;
    if (client) return client;
    if (!verbinding) {
      const c = require('../../redis').createClient({ url: redisUrl });
      c.on('error', () => {});
      verbinding = c.connect().then(() => { client = c; return c; })
        .catch(e => { verbinding = null; throw e; });
    }
    return verbinding;
  }
  const claimSleutel = nonce => 'rtg:pin:intent:' +
    crypto.createHmac('sha256', sleutel).update(nonce).digest('hex').slice(0, 32);
  async function claim(v, nu) {
    ruim(nu);
    if (gebruikt.has(v.n)) return false;
    if (redisUrl) {
      try {
        const ttl = Math.max(1, v.e - nu);
        if (Number(await (await redis()).eval(claimScript, [claimSleutel(v.n)], [ttl])) !== 1) return false;
      } catch (e) {
        // Als de gedeelde replayrem beloofd is maar niet antwoordt, mag de
        // gevoelige handeling niet terugvallen op een zwakkere lokale claim.
        return false;
      }
    }
    gebruikt.set(v.n, v.e);
    while (gebruikt.size > MAX_GEBRUIKT) gebruikt.delete(gebruikt.keys().next().value);
    return true;
  }
  function maak({ actor, doel, bron, referentie }) {
    const vervalt = klok.nu() + TTL_MS;
    const token = verzegel({ a: String(actor), d: String(doel), b: String(bron),
      r: String(referentie), e: vervalt, n: crypto.randomBytes(24).toString('base64url') });
    return { token, exp: vervalt };
  }
  async function gebruik(token, verwacht) {
    const v = ontzegel(token), e = verwacht || {}, nu = klok.nu();
    if (!v || v.e < nu || v.a !== e.actor) return null;
    // Een geldige token met de verkeerde route/referentie gaat WEL op. Zo kan
    // een buitgemaakte bevestiging niet onbeperkt tegen varianten worden getest.
    if (!(await claim(v, nu))) return null;
    if ((e.bron && v.b !== e.bron) || (e.referentie && v.r !== e.referentie)) return null;
    return { actor: v.a, doel: v.d, bron: v.b, referentie: v.r, vervalt: v.e };
  }

  /* Open tokens hoeven niet actief opgezocht en gewist te worden: verbinden
     controleert vlak voor de actie opnieuw de actuele pin, uit-stand, blokkade
     en noodslot. Vernieuwen of bevriezen maakt een oude verzegeling daardoor
     direct waardeloos, ook op een andere instance. */
  function trekInVoor() { return 0; }

  async function sluit() {
    const c = client;
    client = null; verbinding = null;
    if (c) await c.quit();
  }

  return { pinIntentMaak: maak, pinIntentGebruik: gebruik,
    pinIntentTrekInVoor: trekInVoor, pinIntentSluit: sluit,
    pinIntentOpen: gebruikt, PIN_INTENT_TTL_MS: TTL_MS };
};
