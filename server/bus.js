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
   we leveren nooit apart lokaal af. */
const { EventEmitter } = require('events');

function maakBus() {
  const url = process.env.REDIS_URL;
  if (url) {
    try {
      const redis = require('./redis');
      const pub = redis.createClient({ url });
      const sub = redis.createClient({ url });
      pub.on('error', e => console.warn('[bus] redis pub:', e.message));
      sub.on('error', e => console.warn('[bus] redis sub:', e.message));
      let klaar = false;
      const pubWachtrij = [];      // publishes voor de verbinding klaar is
      const subWachtrij = [];      // subscribes voor de verbinding klaar is
      (async () => {
        await pub.connect();
        await sub.connect();
        for (const [k, fn] of subWachtrij) await sub.subscribe(k, m => { try { fn(JSON.parse(m)); } catch (e) {} });
        subWachtrij.length = 0;
        klaar = true;
        for (const [k, b] of pubWachtrij) pub.publish(k, JSON.stringify(b));
        pubWachtrij.length = 0;
      })().catch(e => console.warn('[bus] redis verbinden mislukt:', e.message));
      console.log('[bus] realtime via Redis:', url);
      return {
        soort: 'redis',
        publish(kanaal, bericht) {
          if (klaar) pub.publish(kanaal, JSON.stringify(bericht));
          else pubWachtrij.push([kanaal, bericht]);
        },
        subscribe(kanaal, fn) {
          if (klaar) sub.subscribe(kanaal, m => { try { fn(JSON.parse(m)); } catch (e) {} });
          else subWachtrij.push([kanaal, fn]);
        }
      };
    } catch (e) {
      console.warn('[bus] redis niet beschikbaar, terug naar in-proces:', e.message);
    }
  }
  const em = new EventEmitter();
  em.setMaxListeners(0);
  return {
    soort: 'in-proces',
    publish: (kanaal, bericht) => em.emit(kanaal, bericht),
    subscribe: (kanaal, fn) => em.on(kanaal, fn)
  };
}

module.exports = { maakBus };
