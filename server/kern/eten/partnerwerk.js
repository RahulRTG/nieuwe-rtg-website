/* De leeszijde van het partnerwerkblad: rolfilters, capaciteit en Perfect
   Arrival. Schrijven blijft in de supplier-route achter authenticatie. */
'use strict';
const beeld = require('./orderbeeld');
const capaciteit = require('./capaciteit');

module.exports = (kern, horeca) => {
  const { ordersVanZaak, schoon } = kern;
  const doos = code => horeca.H(code);

  const capaciteitVan = s => {
    const h = doos(s.code);
    h.etenCapaciteit = h.etenCapaciteit || { auto:true, open:true, extraMinuten:0,
      limietMinuten:35, afhalenPromoten:false, gepauzeerdeItems:[] };
    const uit = capaciteit.bereken(h);
    uit.advies = uit.stand === 'vol' ? 'Pauzeer bezorging of gerechten met lange bereiding en zet afhalen voorop.'
      : uit.stand === 'druk' ? 'Toon de extra tijd en stem keuken, verpakking en overdracht op hetzelfde moment af.'
        : 'De lijn heeft ruimte; de normale belofte kan blijven staan.';
    return uit;
  };

  function alleVan(s) {
    const h = doos(s.code), vandaag = new Date().toISOString().slice(0, 10);
    const horecaOrders = Object.values(h.rekeningen || {})
      .filter(r => beeld.OPEN_KANALEN.includes(r.kanaal) && (r.regels || []).length)
      .map(r => beeld.projecteerRekening({ zaakcode:s.code, zaak:s, rekening:r, horecaDoos:h }))
      .filter(o => o.fase !== 'geleverd' || String(o.aangemaaktAt || '').slice(0, 10) === vandaag);
    const oud = (ordersVanZaak ? ordersVanZaak(s.code) : [])
      .filter(o => o.levering && o.status !== 'wacht-op-betaling').map(beeld.projecteerLegacy);
    return horecaOrders.concat(oud).sort((a,b) => String(b.aangemaaktAt).localeCompare(String(a.aangemaaktAt)));
  }

  const rolVan = actor => {
    const t = [actor && actor.func, actor && actor.role, actor && actor.name].filter(Boolean).join(' ').toLowerCase();
    if (/chef|kok|keuken/.test(t)) return 'keuken';
    if (/expedit|pas|inpak/.test(t)) return 'expeditie';
    if (/bedien|balie|front|host/.test(t)) return 'frontoffice';
    return actor && actor.manager ? 'management' : 'frontoffice';
  };
  function pastRol(o, rol) {
    if (rol === 'keuken') return !['geleverd','geannuleerd'].includes(o.fase) && o.statussen.productie !== 'overgedragen';
    if (rol === 'expeditie') return ['in-bereiding','bijna-klaar','klaar','overgedragen'].includes(o.statussen.productie);
    if (rol === 'frontoffice') return o.kanaal === 'afhaal' || o.statussen.incident !== 'geen';
    return true;
  }
  function zoek(order, q) {
    if (!q) return true;
    const tekst = [order.id,order.ref,order.rekeningId,order.code,order.klant && order.klant.codenaam,
      order.kanaal,order.fase,...(order.producten || []).map(p => p.naam),
      order.fulfillment && order.fulfillment.bezorger && order.fulfillment.bezorger.naam].join(' ').toLowerCase();
    return String(q).toLowerCase().split(/\s+/).filter(Boolean).every(w => tekst.includes(w));
  }

  function werkbladVan(s, b, actor) {
    const eigenRol = rolVan(actor);
    const rol = actor && actor.manager && ['keuken','expeditie','frontoffice','management'].includes(b.rol) ? b.rol : eigenRol;
    let orders = alleVan(s).filter(o => pastRol(o, rol) && zoek(o, schoon(b.zoek, 100)));
    const filters = Array.isArray(b.filters) ? b.filters.map(String) : [];
    if (filters.includes('nieuw')) orders = orders.filter(o => ['ontvangen','bevestigd'].includes(o.fase));
    if (filters.includes('vertraagd')) orders = orders.filter(o => o.eta && o.eta.minuten > 45);
    if (filters.includes('klaar')) orders = orders.filter(o => o.fase === 'klaar' || o.statussen.productie === 'klaar');
    if (filters.includes('afhaal')) orders = orders.filter(o => o.kanaal === 'afhaal');
    if (filters.includes('bezorging')) orders = orders.filter(o => o.kanaal === 'bezorging');
    if (filters.includes('allergie')) orders = orders.filter(o => o.allergieControle || (o.producten || []).some(p => p.allergie || (p.allergenen || []).length));
    if (filters.includes('probleem')) orders = orders.filter(o => o.statussen.incident !== 'geen');
    const publiek = orders.slice(0, 160).map(o => {
      const x = beeld.zonderIntern(o), doel = o.gewenstAt;
      x.perfectArrival = { doel:doel || 'zo snel mogelijk', margeMinuten:o.eta ? o.eta.minuten : null,
        stand:o.fase === 'klaar' ? 'overdracht' : o.fase === 'onderweg' ? 'rit' : 'synchroniseren',
        advies:o.fase === 'klaar' ? 'Verpakking, code en overdrager nu samen controleren.'
          : doel ? 'Stuur de stations op ' + doel + '; laat warm eten zo kort mogelijk wachten.'
            : 'Werk op de actuele keuken-ETA en roep de overdracht pas als de tas compleet is.' };
      x.volgende = o.bron === 'legacy-order' ? null
        : o.statussen.fulfillment === 'overgedragen' && o.kanaal === 'bezorging' ? 'onderweg'
          : o.fase === 'ontvangen' ? 'geaccepteerd' : o.fase === 'bevestigd' ? 'in-bereiding'
            : o.fase === 'keuken' || o.fase === 'bijna-klaar' ? 'klaar'
              : o.fase === 'klaar' ? 'overgedragen' : o.fase === 'onderweg' ? 'geleverd' : null;
      return x;
    });
    return { ok:true, rol, rollen:actor && actor.manager ? ['keuken','expeditie','frontoffice','management'] : [rol], orders:publiek,
      capaciteit:capaciteitVan(s), kortingscodes:(s.kortingscodes || []).map(k => ({ code:k.code,
        procent:Number(k.procent) || 0, centen:Number(k.centen) || 0, actief:k.actief !== false })),
      samenvatting:{ zichtbaar:publiek.length, nieuw:publiek.filter(o => ['ontvangen','bevestigd'].includes(o.fase)).length,
        keuken:publiek.filter(o => o.fase === 'keuken').length, klaar:publiek.filter(o => o.fase === 'klaar').length,
        problemen:publiek.filter(o => o.statussen.incident !== 'geen').length } };
  }

  return { capaciteitVan, werkbladVan };
};
