/* Realtime-bus: verbindt de live-verbindingen (SSE) van losse domeinprocessen.

   Zonder REDIS_URL is dit een in-proces bus: publish roept de abonnee meteen
   aan, precies zoals de server het altijd al deed (een proces, gedeeld
   geheugen). Met REDIS_URL lopen de events via Redis pub/sub, zodat een snap,
   belsignaal of melding ook een gebruiker bereikt die met een ander
   domeinproces verbonden is. De domeincode verandert hier niet van: alleen de
   kern kiest welke bus hij gebruikt.

   Elk bericht wordt precies een keer per proces afgeleverd: publish stuurt naar
   het transport (EventEmitter of Redis) en het transport levert aan de abonnee.
   Bij Redis ontvangt ook het publicerende proces zijn eigen bericht terug, dus
   we leveren nooit apart lokaal af.

   DE ENVELOP. Sinds 27 augustus 2026 draagt elk bericht dat hier langskomt een
   `envelop` (kern/envelop.js): id, tijd, versie, actor, correlatie, oorzaak en
   classificatie. OS.md par. 3 mat waarom dat nodig was -- deze bus VERVOERDE
   wel, maar er was geen taal: van de tien publicerende plekken droeg er een een
   `versie`, een een `id`, en geen enkele iets waarmee je twee gebeurtenissen
   aan elkaar knoopt.

   Hij is er NAAST gezet en niet omheen. Een abonnee leest `doel`, `event` en
   `data` zoals altijd; er komt alleen een sleutel bij. Dat is met opzet: een
   omhullend bericht ({ envelop, inhoud }) had elke abonnee moeten veranderen,
   en een verandering die overal tegelijk moet, gebeurt half.

   DE KETEN LOOPT DOOR ZONDER DAT IEMAND HEM DOORGEEFT. Elke abonnee draait
   binnen de envelop van het bericht dat hij afhandelt, dus publiceert hij zelf
   iets, dan erft dat de correlatie en krijgt het de binnenkomende gebeurtenis
   als oorzaak. Publiceren is hier nooit een verzoek waard: gaat het maken van
   de envelop mis (een actor die een echte naam blijkt), dan gaat het bericht
   ZONDER envelop de deur uit met een waarschuwing in het log -- zichtbaar, maar
   nooit ten koste van de levering. */
const { EventEmitter } = require('events');
const envelop = require('./kern/envelop');
const verzoekcontext = require('./db/verzoekcontext');

/* Gewone, best-effort projectieberichten gaan in een PG-request pas na COMMIT.
   Verlies vraagt client-resync, niet autorisatie. Kritieke intrekkingen kiezen
   bewust `publishDirect`/de duurzame Redis-outbox. */
function naCommit(werk) {
  if (verzoekcontext.haakNaCommit(werk)) return true;
  return werk();
}

/* Het bericht van een envelop voorzien.

   Draagt het bericht er al een MET id, dan blijft die staan: dan is de
   gebeurtenis al eerder gebeurd (een herpublicatie, of iets dat via Redis bij
   het publicerende proces terugkomt) en krijgt zij hier geen tweede identiteit.

   Draagt het bericht een envelop ZONDER id, dan is dat een opgave: de
   publicerende plek zegt wie de actor is en hoe gevoelig de inhoud is, en de
   rest -- id, tijd, keten -- vult de bus in. Zo staat de actor niet als los
   veld tussen de inhoud, waar hij met een payloadsleutel zou kunnen botsen. */
function stempel(kanaal, bericht) {
  if (!bericht || typeof bericht !== 'object' || Array.isArray(bericht)) return bericht;
  const opgave = (bericht.envelop && typeof bericht.envelop === 'object') ? bericht.envelop : {};
  if (opgave.id) return bericht;
  let env = null;
  try {
    env = envelop.alsStart(envelop.maak({ kanaal, actor: opgave.actor, classificatie: opgave.classificatie }));
  } catch (e) {
    /* Een actor die geen codenaam is, is een fout in de publicerende plek. Het
       bericht mag daar niet op stranden, maar hij verdwijnt ook niet stil. */
    console.warn('[bus] envelop geweigerd op kanaal ' + kanaal + ':', e.message);
    try { env = envelop.alsStart(envelop.maak({ kanaal, classificatie: opgave.classificatie })); }
    catch (e2) { env = null; }
  }
  return env ? Object.assign({}, bericht, { envelop: env }) : bericht;
}

/* De abonnee draait binnen de envelop van het bericht dat hij afhandelt. */
const inKeten = (fn) => (bericht) => envelop.inKeten(bericht && bericht.envelop, () => fn(bericht));

function maakBus() {
  const url = process.env.REDIS_URL;
  if (url) {
    try {
      const redis = require('./redis');
      const pub = redis.createClient({ url });
      const sub = redis.createClient({ url });
      let klaar = false;
      let pubKlaar = false;
      let subKlaar = false;
      let overvol = false;
      const MAX_WACHT = Math.min(5000, Math.max(10, Number(process.env.RTG_BUS_WACHTRIJ_MAX) || 1000));
      const standWachters = new Set();
      const pubWachtrij = [];      // publishes voor de verbinding klaar is
      const subWachtrij = [];      // subscribes voor de verbinding klaar is
      const stand = () => ({ soort: 'redis', gereed: klaar });
      const meldStand = () => {
        for (const fn of [...standWachters]) { try { fn(stand()); } catch (e) {} }
      };
      const zetKlaar = waarde => {
        const volgend = !!waarde && !overvol;
        if (klaar === volgend) return;
        klaar = volgend; meldStand();
      };
      const wacht = (rij) => {
        if (overvol) return false;
        if (pubWachtrij.length >= MAX_WACHT) {
          overvol = true;
          pubWachtrij.length = 0;       // geen oude gebeurtenissen alsnog loslaten
          zetKlaar(false);
          console.error('[bus] redis-wachtrij vol; bus blijft fail-closed tot procesherstart');
          return false;
        }
        pubWachtrij.push(rij);
        return true;
      };
      const stuur = (kanaal, bericht) => pub.publish(kanaal, JSON.stringify(bericht)).catch(e => {
        zetKlaar(false); wacht([kanaal, bericht]);
        console.warn('[bus] redis publish:', e.message);
      });
      const leegPublicaties = () => {
        if (!klaar || !pubWachtrij.length) return;
        for (const [kanaal, bericht] of pubWachtrij.splice(0)) stuur(kanaal, bericht);
      };
      const hersteld = () => {
        if (pubKlaar && subKlaar && !overvol) { zetKlaar(true); leegPublicaties(); }
      };
      pub.on('ready', () => { pubKlaar = true; hersteld(); });
      sub.on('ready', async () => {
        subKlaar = false;
        try {
          for (const [k, fn] of subWachtrij.splice(0))
            await sub.subscribe(k, m => { try { fn(JSON.parse(m)); } catch (e) {} });
          subKlaar = true; hersteld();
        } catch (e) { subKlaar = false; zetKlaar(false); console.warn('[bus] redis subscribe:', e.message); }
      });
      pub.on('close', () => { pubKlaar = false; zetKlaar(false); });
      sub.on('close', () => { subKlaar = false; zetKlaar(false); });
      pub.on('error', e => { zetKlaar(false); console.warn('[bus] redis pub:', e.message); });
      sub.on('error', e => { zetKlaar(false); console.warn('[bus] redis sub:', e.message); });
      pub.connect().catch(e => console.warn('[bus] redis pub verbinden mislukt:', e.message));
      sub.connect().catch(e => console.warn('[bus] redis sub verbinden mislukt:', e.message));
      console.log('[bus] realtime via Redis:', url);
      const publiceer = (kanaal, bericht) => {
        const b = stempel(kanaal, bericht);
        return klaar ? stuur(kanaal, b) : wacht([kanaal, b]);
      };
      return {
        soort: 'redis',
        gereed: () => klaar,
        onStand(fn) {
          if (typeof fn !== 'function') return () => {};
          standWachters.add(fn); fn(stand());
          return () => standWachters.delete(fn);
        },
        publish: (kanaal, bericht) => naCommit(() => publiceer(kanaal, bericht)),
        publishDirect: publiceer,
        subscribe(kanaal, fn) {
          const g = inKeten(fn);
          if (klaar) sub.subscribe(kanaal, m => { try { g(JSON.parse(m)); } catch (e) {} })
            .catch(() => { subWachtrij.push([kanaal, g]); subKlaar = false; zetKlaar(false); });
          else subWachtrij.push([kanaal, g]);
        },
        async herhaal(voorvoegsel) {
          if (!klaar) throw new Error('redis-bus niet gereed');
          const uit = []; let cursor = '0';
          do {
            const antwoord = await pub.scan(cursor, String(voorvoegsel) + '*', 200);
            cursor = String(antwoord && antwoord[0] || '0');
            for (const sleutel of (antwoord && antwoord[1]) || []) {
              const tekst = await pub.get(sleutel);
              if (tekst) { try { uit.push(JSON.parse(tekst)); } catch (e) {} }
            }
          } while (cursor !== '0');
          return uit;
        },
        async bewaar(kanaal, sleutel, bericht, ttlMs) {
          if (!klaar || overvol) throw new Error('redis-bus niet gereed');
          const ttl = Math.floor(Number(ttlMs));
          if (!(ttl > 0)) throw new Error('ongeldige bewaartermijn');
          const tekst = JSON.stringify(stempel(kanaal, bericht));
          const lua = "redis.call('SET',KEYS[1],ARGV[1],'PX',ARGV[2]); return redis.call('PUBLISH',KEYS[2],ARGV[1])";
          return pub.eval(lua, [sleutel, kanaal], [tekst, String(ttl)]);
        }
      };
    } catch (e) {
      /* REDIS_URL betekent dat dit proces deel van een cluster wil zijn. Een
         stille in-procesbus zou dan gezonde readiness veinzen terwijl geen
         enkele intrekking een buur bereikt. Houd exact die stand gesloten. */
      console.error('[bus] redisconfiguratie ongeldig; bus blijft gesloten:', e.message);
      return {
        soort: 'redis', gereed: () => false,
        onStand(fn) { if (typeof fn === 'function') fn({ soort: 'redis', gereed: false }); return () => {}; },
        publish() { return false; }, publishDirect() { return false; }, subscribe() {},
        herhaal: async () => { throw e; }, bewaar: async () => { throw e; }
      };
    }
  }
  const em = new EventEmitter();
  em.setMaxListeners(0);
  const publiceer = (kanaal, bericht) => em.emit(kanaal, stempel(kanaal, bericht));
  return {
    soort: 'in-proces',
    gereed: () => true,
    onStand(fn) { if (typeof fn === 'function') fn({ soort: 'in-proces', gereed: true }); return () => {}; },
    publish: (kanaal, bericht) => naCommit(() => publiceer(kanaal, bericht)),
    publishDirect: publiceer,
    subscribe: (kanaal, fn) => em.on(kanaal, inKeten(fn))
  };
}

module.exports = { maakBus };
