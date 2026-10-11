/* BOEKEN EN BETALEN PER DEELNEMER (hoort bij kern/reisbureau.js).

   Besluit B3 van de eigenaar (11 oktober 2026): bij een reis met vrienden boekt
   en betaalt elke deelnemer AFZONDERLIJK. De organisator zet klaar; iedere
   deelnemer bevestigt zelf zijn boeking en betaalt zelf. Geen automatische
   geldbeweging, en geen verplichting namens een ander. Romeproef schakel 18.

   DE VORM. Een aanvraag (kern/reisbureau.js `boek`) blijft van EEN lid en voor
   EEN persoon. Er komt geen groepsboeking en geen gesplitste reissom: de
   organisator boekt zijn eigen plaats, en voor elke medereiziger staat een DEEL
   klaar -- een verwijzing, geen boeking. Pas als die medereiziger zelf "ja"
   zegt, ontstaat ZIJN aanvraag, langs dezelfde `boek()` als altijd. Betalen
   gaat daarna langs /api/reisbureau/betaal en dus langs kern/pay (de waardepoort):
   die route int alleen een aanvraag van wie hem betaalt, dus innen namens een
   ander kan niet -- dat hoefde hier niet gebouwd, het stond er al.

   WIE ER IN EEN DEEL KAN STAAN. Alleen een reisgenoot die op de reis van de
   organisator al ZELF ja zei (kern/reisgezelschap.js `reisgenootSleutel`). Een
   deel klaarzetten voor iemand die niet meereist, is een verplichting
   voorbereiden voor een mens die er nooit om vroeg.

   WAT DE ORGANISATOR ZIET: per deelnemer de stand van het deel (klaargezet,
   bevestigd, geweigerd) en NIETS over betalen of geld. En het budget alleen als
   die deelnemer het ZELF met hem deelde (besluit B2): de uitkomst van de
   budgettoets (kern/geldbeleid/budgettoets.js) ziet eerst alleen de deelnemer,
   en gaat alleen naar de organisator die het deel klaarzette -- nooit naar de
   andere deelnemers. `null` betekent "niet gedeeld", en zegt met opzet niet of
   er een toestemming of een pot achter zit. */
'use strict';

const MAX_DEELNEMERS = 10;

function maakDeelnemers({ db, save, nu, boek, tripVan, gezelschap, geldbeleid }) {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/reisbureau-deelnemers', bezit: { reisDelen: 'lijst' } });
  const rij = () => eigen.bak('reisDelen');
  const id = () => 'D-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 60);

  async function zetKlaar(sess, codenaam, data) {
    const d = data || {};
    const trip = tripVan(d.tripId);
    if (!trip) return { status: 404, error: 'Reis niet gevonden.' };
    const reis = schoon(d.reis, 80);
    const namen = [...new Set((Array.isArray(d.deelnemers) ? d.deelnemers : []).map(c => schoon(c)).filter(Boolean))];
    if (!namen.length) return { status: 400, error: 'Noem de reisgenoten voor wie u een deel klaarzet.' };
    if (namen.length > MAX_DEELNEMERS) return { status: 400, error: 'Hooguit ' + MAX_DEELNEMERS + ' deelnemers per aanvraag.' };
    const gz = gezelschap();
    if (!gz) return { status: 503, error: 'Het reisgezelschap is niet beschikbaar.' };
    /* Eerst ALLE deelnemers nalopen, dan pas iets boeken: een half klaargezette
       reis waarvan de helft van de delen ontbreekt, is een andere reis dan de
       organisator vroeg. */
    const sleutels = [];
    for (const c of namen) {
      const k = gz.reisgenootSleutel(sess.key, reis, c);
      if (!k) return { status: 409, error: c + ' reist (nog) niet mee als reisgenoot op deze reis. Een deel staat pas klaar voor wie zelf ja zei.' };
      sleutels.push([c, k]);
    }
    const eigenAanvraag = await boek(sess, codenaam, { tripId: trip.id, personen: 1, vertrek: d.vertrek,
      notitie: 'eigen deel; ' + namen.length + ' reisgenoot/-genoten boeken zelf' });
    if (eigenAanvraag.error) return eigenAanvraag;
    const ref = eigenAanvraag.aanvraag.ref;
    for (const [c, k] of sleutels) {
      rij().unshift({ id: id(), groepRef: ref, reis, tripId: trip.id, titel: trip.title, bestemming: trip.dest,
        vertrek: eigenAanvraag.aanvraag.vertrek, pp: Math.max(0, Number(trip.netto) || 0),
        doorKey: sess.key, doorCodenaam: codenaam, voorKey: k, voorCodenaam: c,
        stand: 'klaargezet', at: nu(), ref: null, budgetGedeeld: null });
    }
    if (rij().length > 5000) rij().length = 5000;
    save();
    return { ok: true, aanvraag: eigenAanvraag.aanvraag, delen: standVan(sess.key, ref).delen };
  }

  /* Wat de DEELNEMER van zijn eigen delen ziet, met de budgettoets erbij -- alleen voor hem. */
  function mijn(key, codenaam) {
    return eigen.kijk('reisDelen').filter(x => x.voorKey === key).slice(0, 50).map(x => ({
      id: x.id, door: x.doorCodenaam, titel: x.titel, bestemming: x.bestemming, vertrek: x.vertrek,
      prijs: { pp: x.pp, valuta: 'EUR' }, stand: x.stand, ref: x.ref,
      budget: x.stand !== 'geweigerd' && geldbeleid() ? geldbeleid().budgettoets(codenaam, Math.round(x.pp * 100)) : null,
      budgetGedeeld: gedeeldNu(x)
    }));
  }

  /* Ja of nee, en alleen door de deelnemer zelf. Ja = ZIJN aanvraag, langs boek(). */
  async function antwoord(sess, codenaam, deelId, ja) {
    const x = rij().find(r => r.id === String(deelId || '') && r.voorKey === sess.key);
    if (!x) return { status: 404, error: 'Dit deel staat niet voor u klaar.' };
    if (x.stand !== 'klaargezet') return { status: 409, error: 'Dit deel is al ' + x.stand + '.' };
    if (!ja) { x.stand = 'geweigerd'; x.beantwoord = nu(); save(); return { ok: true, stand: x.stand }; }
    const r = await boek(sess, codenaam, { tripId: x.tripId, personen: 1, vertrek: x.vertrek,
      notitie: 'eigen deel bij ' + x.groepRef });
    if (r.error) return r;
    x.stand = 'bevestigd'; x.beantwoord = nu(); x.ref = r.aanvraag.ref; save();
    return { ok: true, stand: x.stand, aanvraag: r.aanvraag };
  }

  /* De deelnemer deelt ZELF de uitkomst van zijn budgettoets met de organisator
     van dit deel (of haalt hem weer weg). Zonder toestemming is er niets te delen. */
  function deelBudget(sess, codenaam, deelId, delen) {
    const x = rij().find(r => r.id === String(deelId || '') && r.voorKey === sess.key);
    if (!x) return { status: 404, error: 'Dit deel staat niet voor u klaar.' };
    if (!delen) { if (x.budgetGedeeld) { x.budgetGedeeld = null; save(); } return { ok: true, gedeeld: null }; }
    if (x.stand === 'geweigerd') return { status: 409, error: 'U zei nee op dit deel; er is geen voorstel meer om te toetsen.' };
    const t = geldbeleid() ? geldbeleid().budgettoets(codenaam, Math.round(x.pp * 100)) : { uitkomst: null, reden: 'het geldbeleid draait niet mee' };
    if (!t.uitkomst) return { status: 409, error: 'Er is niets om te delen: ' + t.reden + '. Geef eerst zelf toestemming in RTG Geld.' };
    // dezelfde uitkomst nog eens delen verandert niets, ook de datum niet
    if (!x.budgetGedeeld || x.budgetGedeeld.uitkomst !== t.uitkomst) { x.budgetGedeeld = { uitkomst: t.uitkomst, op: nu() }; save(); }
    return { ok: true, gedeeld: t.uitkomst, met: x.doorCodenaam };
  }

  /* Een gedeelde uitkomst geldt alleen zolang de toestemming van de deelnemer
     LOOPT. Trekt hij die in (of verloopt ze), dan ziet de organisator niets meer,
     ook niet de uitkomst van voor het intrekken: B2 zegt "alleen met
     toestemming", en een ingetrokken toestemming die bij een ander blijft
     doorwerken is geen intrekking. */
  const gedeeldNu = (x) => {
    if (!x.budgetGedeeld) return null;
    const t = geldbeleid() ? geldbeleid().budgettoets(x.voorCodenaam, Math.round(x.pp * 100)) : null;
    return t && t.uitkomst ? x.budgetGedeeld.uitkomst : null;
  };

  /* Wat de ORGANISATOR ziet: de stand per deelnemer, zonder geld. */
  function standVan(key, ref) {
    const lijst = eigen.kijk('reisDelen').filter(x => x.doorKey === key && x.groepRef === String(ref || ''));
    if (!lijst.length) return { status: 404, error: 'Er staan geen delen klaar bij deze aanvraag.' };
    return { ok: true, ref: String(ref), delen: lijst.map(x => ({ codenaam: x.voorCodenaam, stand: x.stand,
      budget: gedeeldNu(x) })) };
  }

  /* Voor de samenstelling van Rahul (kern/socialecommand/samenstel.js): de
     groepsaanvragen van deze organisator, in de vorm die hij al mag zien. */
  function vanOrganisator(key, reis) {
    const eerste = new Map();
    for (const x of eigen.kijk('reisDelen')) if (x.doorKey === key && x.reis === reis && !eerste.has(x.groepRef)) eerste.set(x.groepRef, x);
    return [...eerste.values()].map(x => Object.assign({ tripId: x.tripId, titel: x.titel, bestemming: x.bestemming,
      vertrek: x.vertrek }, standVan(key, x.groepRef)));
  }

  return { zetKlaar, mijn, antwoord, deelBudget, stand: standVan, vanOrganisator };
}

module.exports = { maakDeelnemers };
