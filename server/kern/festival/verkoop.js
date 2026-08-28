/* RTG Festival (deelmodule): DE VERKOOP. Voorraad, bundels, en de twee stappen.

   TWEE STAPPEN, EN DAT IS GEEN OMSLACHTIGHEID MAAR EEN GRENDEL.

   Betalen duurt. Tussen "is er nog plek" en "hier is uw pas" zit een aanroep
   naar de betaallaag, en in dat gat kan een tweede koper dezelfde laatste plek
   krijgen -- allebei komen ze door de controle, allebei krijgen ze een pas, en
   het terrein is oververkocht. Dat is precies de vorm die
   routes/supplier/tickets.js vandaag heeft (capaciteit tellen, dan `await
   pay.kasInt`, dan het ticket maken).

   Dus: RESERVEREN verbruikt de plek meteen en synchroon, betalen gebeurt
   daarna, en RONDMAKEN geeft pas dan de pas uit. Mislukt de betaling, dan wordt
   de reservering losgelaten en is de plek weer vrij. Een reservering die niet
   op tijd wordt rondgemaakt, vervalt vanzelf.

   HET REKENWERK STAAT IN ./bundel.js: de keten van een product, wat ervan weg
   is, en hoeveel er nog kan. Hier staat alleen wat de wereld verandert.

   ER WORDT HIER GEEN GELD AANGERAAKT. De kern legt vast WAT er verkocht is en
   tegen welke prijs; de betaling loopt over de betaallaag en die woont op de
   route (kern/pay/). Twee plekken die geld bewegen is er een te veel. */
'use strict';



module.exports = (ctx) => {
  const { save, crypto, schoon, editieVind, pasUitgeven, ruimte, actief, productRechten } = ctx;

  const bak = (e) => {
    if (!e.verkopen || typeof e.verkopen !== 'object') e.verkopen = {};
    return e.verkopen;
  };

  /* ---------- stap 1: reserveren ---------- */
  function reserveer(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const moment = String(d.moment || '');
    if (!moment) return { status: 400, error: 'Op welk moment wordt er gereserveerd?' };
    const p = (e.producten || {})[String(d.product || '')];
    if (!p) return { status: 404, error: 'Dit product bestaat niet.' };
    const koper = schoon(d.koper, 60);
    if (!koper) return { status: 400, error: 'Op wiens codenaam komt deze plek?' };

    const r = ruimte(fid, eid, p.id, moment);
    if (r.error) return r;
    if (r.ruimte !== null && r.ruimte < 1) {
      return { status: 409, error: 'Uitverkocht' + (r.krapste ? ' (' + r.krapste + ')' : '') + '.', ruimte: 0 };
    }
    const minuten = Math.max(1, Math.min(120, parseInt(d.minuten, 10) || 15));
    const tot = new Date(Date.parse(moment) + minuten * 60000).toISOString();
    if (!Number.isFinite(Date.parse(moment))) return { status: 400, error: 'Dat moment is geen geldig tijdstip.' };

    const v = { id: 'vk' + crypto.randomBytes(5).toString('hex'), product: p.id, koper,
      stand: 'gereserveerd', prijs: p.prijs, tot, pas: null, betaald: null, at: moment };
    bak(e)[v.id] = v;
    save();
    return { ok: true, verkoop: v, ruimte: r.ruimte === null ? null : r.ruimte - 1 };
  }

  /* ---------- de plek weer vrijgeven ---------- */
  function verkoopLos(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const v = bak(e)[String((data || {}).id || '')];
    if (!v) return { status: 404, error: 'Deze reservering bestaat niet.' };
    if (v.stand !== 'gereserveerd') return { status: 409, error: 'Deze verkoop staat op ' + v.stand + '.' };
    v.stand = 'losgelaten';
    save();
    return { ok: true, verkoop: v };
  }

  /* ---------- stap 2: rondmaken ----------
     `betaald` is een AFDRUK van wat de betaallaag deed en geen opdracht: deze
     kern int niets. Zonder die afdruk wordt er niets uitgegeven -- een pas op
     een belofte is precies wat CLAUDE.md verbiedt. */
  function verkoopRond(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const moment = String(d.moment || '');
    const v = bak(e)[String(d.id || '')];
    if (!v) return { status: 404, error: 'Deze reservering bestaat niet.' };
    if (v.stand !== 'gereserveerd') return { status: 409, error: 'Deze verkoop staat op ' + v.stand + '.' };
    if (!actief(v, moment)) return { status: 409, error: 'Deze reservering is verlopen; de plek is weer vrij.' };
    const b = d.betaald || {};
    if (!b.methode) return { status: 400, error: 'Zonder betaling wordt er geen pas uitgegeven.' };

    const rechten = productRechten(e, v.product);
    if (!rechten || !rechten.length) return { status: 409, error: 'Dit product geeft nergens toegang toe.' };
    const uit = pasUitgeven(fid, eid, { drager: v.koper, soort: d.soort, rechten });
    if (uit.error) return uit;
    /* De pas draagt het product waar hij uit komt. pasUitgeven zet dat alleen
       bij een los product; bij een bundel zijn de rechten hier samengesteld, dus
       het label wordt hier gezet -- op een pas zonder herkomst is een verkoop
       later niet meer na te lopen. */
    uit.pas.product = v.product;
    v.stand = 'betaald';
    v.pas = uit.pas.id;
    v.betaald = { methode: schoon(b.methode, 30), betaler: schoon(b.betaler, 60) || null,
      centen: Number.isFinite(Number(b.centen)) ? Math.round(Number(b.centen)) : null, at: moment };
    save();
    return { ok: true, verkoop: v, pas: uit.pas };
  }

  function verkopenVan(fid, eid, moment) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const m = String(moment || '');
    return { ok: true, verkopen: Object.values(e.verkopen || {}).map(v => ({ ...v, telt: actief(v, m) })) };
  }

  return { reserveer, verkoopLos, verkoopRond, verkopenVan };
};
