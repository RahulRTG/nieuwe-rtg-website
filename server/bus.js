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
          const b = stempel(kanaal, bericht);
          if (klaar) pub.publish(kanaal, JSON.stringify(b));
          else pubWachtrij.push([kanaal, b]);
        },
        subscribe(kanaal, fn) {
          const g = inKeten(fn);
          if (klaar) sub.subscribe(kanaal, m => { try { g(JSON.parse(m)); } catch (e) {} });
          else subWachtrij.push([kanaal, g]);
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
    publish: (kanaal, bericht) => em.emit(kanaal, stempel(kanaal, bericht)),
    subscribe: (kanaal, fn) => em.on(kanaal, inKeten(fn))
  };
}

module.exports = { maakBus };
