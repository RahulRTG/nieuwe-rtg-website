/* Opslag, deel "wikkel": de Proxy waarmee een verzoek de gedeelde data LEEST
   zonder haar aan te raken, en waarmee elke schrijfactie in de werkkopie landt.

   WAAROM DIT APART STAAT. verzoekcontext.js gaat over de LEVENSLOOP van een
   verzoek -- beginnen, markeren, verzamelen, commit. Dit gaat over hoe een
   object eruitziet zolang dat verzoek loopt. Ze zijn uit elkaar gehaald toen de
   wikkellaag werd verbouwd (9 september 2026) en het bestand daarmee over de
   10 kB van keuringsregel 13 ging. */
'use strict';

/* HOE JE AAN EEN WIKKEL VRAAGT WAT HIJ ECHT IS.

   Hier stond `const PROXY_INFO = new WeakMap()`: een tabel die zolang het
   PROCES leeft elke wikkel onthoudt, met een entry per gewikkeld object per
   verzoek. Op 9 september 2026 liep de server op 100M leden daarop vast --
   100% CPU op de hoofddraad, RSS bevroren op 5.470.060 kB, en vier
   stack-monsters achter elkaar in `WeakCollectionSet -> Put -> Rehash`. Een
   ephemeron-tabel wordt pas opgeruimd bij een MAJOR GC; op een heap van een
   gigabyte is die zeldzaam, dus de tabel groeit door en elke rehash loopt hem
   helemaal langs.

   Een wikkel weet zelf wat hij is. Deze sleutel vraagt het hem rechtstreeks:
   geen tabel, geen groei, geen rehash. Het symbool is module-privé, dus geen
   enkele aanroeper kan hem noemen of tegenkomen -- hij staat niet in
   ownKeys(), niet in has() en niet in een descriptor. */
const ACTUEEL = Symbol('rtg.verzoekcontext.actueel');

/* De twee dingen die deze laag van de verzoekcontext nodig heeft, en verder
   niets: waar het vak van een sleutel woont, en of er nog gemuteerd mag worden.
   Ze komen als parameter binnen, zodat er geen kringverwijzing ontstaat. */
module.exports = function maakWikkel({ vakVoor, eisMutatieOpen }) {

  function losWaarde(v) {
    if (!v || typeof v !== 'object') return v;
    /* Een gewone waarde kent dit symbool niet en geeft undefined; een wikkel
       geeft altijd een object terug, dus die twee zijn niet te verwarren. */
    const echt = v[ACTUEEL];
    return echt === undefined ? v : echt;
  }

  /* EEN HANDLER PER VAK, NIET PER OBJECT.

     Hier werd per gewikkeld object een verse handler gebouwd: negen traps, elk
     een eigen closure, plus `actueel` en `pak` -- twaalf functieobjecten per
     gewikkeld object per verzoek. Bij 100M leden is dat de dominante allocatie
     van een leesverzoek: gemeten op 12 rondes van 1500 verzoeken met 900 MB
     ballast schommelde dezelfde vaste belasting tussen 7,8 en 30 seconden per
     ronde, met een heap van 1,7 tot 4,1 GB.

     Het kon altijd al met één handler: een trap krijgt zijn DOELWIT als eerste
     argument mee, en dat doelwit ís `origineel`. De handler hoeft dat dus niet
     in een closure te bewaren. Wat hij wel per aanroep moet opzoeken is het
     VAK -- dat ontstaat pas bij de eerste schrijfactie, en de oude code loste
     dat op met een gelegenheids-object met getters (zie wortelVoor). Op de
     sleutel opzoeken doet hetzelfde en is er één begrip minder. */
  function handlerVoor(ctx, sleutel) {
    const bestaand = ctx.handlers.get(sleutel);
    if (bestaand) return bestaand;

    /* Vóór de eerste schrijfactie bestaat het vak nog niet; dan is er ook niets
       gekloond en is het doelwit zelf de actuele waarde. */
    const levend = () => ctx.vakken.get(sleutel);
    const actueel = (t) => { const v = levend(); return (v && v.heen.get(t)) || t; };

    const pak = (v) => {
      if (!v || typeof v !== 'object') return v;
      const echt = levend();
      /* Voor de eerste schrijfactie komt `v` rechtstreeks uit de gedeelde
         objectgraaf en moet ieder niveau gewikkeld blijven. Na de kopie herkennen
         heen/terug welke clone nog bij zo'n oud object hoort. Een nieuw object
         dat de request zelf invoegde staat niet in die kaarten en is al veilig. */
      if (!echt) return objectProxy(ctx, sleutel, v);
      const oud = echt.terug.get(v) || v;
      return echt.heen.has(oud) || oud === echt.origineel ? objectProxy(ctx, sleutel, oud) : v;
    };

    /* Waarheen een schrijfactie gaat: de werkkopie van dit doelwit, en anders de
       wortel van het vak. vakVoor() zet het vak zelf al in ctx.vakken. */
    const doel = (t) => { const f = vakVoor(ctx, sleutel); return f.heen.get(t) || f.waarde; };

    const handler = {
      get(t, p, r) {
        if (p === ACTUEEL) return actueel(t);
        return pak(Reflect.get(actueel(t), p, r));
      },
      set(t, p, v) { eisMutatieOpen(ctx); return Reflect.set(doel(t), p, losWaarde(v)); },
      deleteProperty(t, p) { eisMutatieOpen(ctx); return Reflect.deleteProperty(doel(t), p); },
      defineProperty(t, p, d) {
        eisMutatieOpen(ctx);
        const x = Object.assign({}, d);
        if ('value' in x) x.value = losWaarde(x.value);
        return Reflect.defineProperty(doel(t), p, x);
      },
      ownKeys(t) { return Reflect.ownKeys(actueel(t)); },
      has(t, p) { return Reflect.has(actueel(t), p); },
      getOwnPropertyDescriptor(t, p) { return Reflect.getOwnPropertyDescriptor(actueel(t), p); },
      getPrototypeOf(t) { return Reflect.getPrototypeOf(actueel(t)); }
    };
    ctx.handlers.set(sleutel, handler);
    return handler;
  }

  function objectProxy(ctx, sleutel, origineel) {
    let kaart = ctx.proxies.get(sleutel);
    if (!kaart) { kaart = new WeakMap(); ctx.proxies.set(sleutel, kaart); }
    const bestaand = kaart.get(origineel);
    if (bestaand) return bestaand;
    const proxy = new Proxy(origineel, handlerVoor(ctx, sleutel));
    kaart.set(origineel, proxy);
    return proxy;
  }

  return { losWaarde, objectProxy };
};
