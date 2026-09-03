/* ============================================================================
   BESCHERMZAAK, deel "toestemming": wie mag dit horen, en wat ging er over.

   Grendel 2 en 3 uit ./keten.js staan hier, want het zijn twee kanten van
   dezelfde vraag:

   2. EEN OVERDRACHT NOEMT EEN ONTVANGER, EN DE TOESTEMMING NOEMT DEZELFDE.
      Dit is het verschil met kern/rtfos/casus.js, en het is met opzet lastiger:
      daar is toestemming een ja voor "koppelen aan een partner", hier is het
      een ja voor DEZE ontvanger. Een toestemming voor Blijf Groep is geen
      toestemming voor de wijkagent. Wie de ontvanger wijzigt, vraagt opnieuw.

   3. INTREKKEN WERKT METEEN, EN HET WERKT ACHTERUIT. Zodra de toestemming weg
      is kan er niets meer over, en de zaak valt terug naar 'toestemming'. Er is
      geen stand waarin een ingetrokken toestemming nog even meetelt omdat het
      proces al liep.

   Afgesplitst uit ./keten.js op de 10 KB van keuringsregel 13.
   ========================================================================== */
'use strict';

const { keurInvoer, beeld } = require('./klasse');

module.exports = (ctx, eigen) => {
  const { nu, schoon, audit, wie, save } = ctx;
  const { vind, deur } = eigen;

  /* ---------- toestemming, per ontvanger met naam ---------- */
  function toestemming(req, id, b) {
    b = b || {};
    const stuk = keurInvoer(b); if (stuk) return stuk;
    const z = vind(id); if (!z) return { status: 404, error: 'Deze beschermzaak bestaat niet.' };
    const g = deur(req, z.stad); if (!g.ok) return g;
    if (z.gesloten) return { status: 400, error: 'Deze zaak is gesloten.' };
    const ontvanger = schoon(b.ontvanger, 120);
    if (ontvanger.length < 2) {
      return { status: 400, error: 'Aan WIE geeft deze mens toestemming? Noem de organisatie of de persoon. "Een partner" is geen ontvanger.' };
    }
    const tekst = schoon(b.tekst, 300);
    if (tekst.length < 5) {
      return { status: 400, error: 'Schrijf op waar deze mens ja tegen zei, in zijn eigen woorden. Een vinkje is geen toestemming.' };
    }
    z.toestemming = { ontvanger, tekst, door: wie(req).key, at: nu() };
    z.ingetrokken = null;
    z.bijgewerkt = nu();
    audit(wie(req).key, 'beschermzaak.toestemming', z.codenaam, 'voor ' + ontvanger);
    save();
    return { ok: true, zaak: beeld(z),
      melding: 'Toestemming staat, en alleen voor ' + ontvanger + '. Een andere ontvanger vraagt opnieuw.' };
  }

  function trekIn(req, id, reden) {
    const z = vind(id); if (!z) return { status: 404, error: 'Deze beschermzaak bestaat niet.' };
    const g = deur(req, z.stad); if (!g.ok) return g;
    if (!z.toestemming || z.ingetrokken) return { status: 400, error: 'Er staat geen toestemming om in te trekken.' };
    z.ingetrokken = { at: nu(), reden: schoon(reden, 200) || null };
    /* ACHTERUIT, en meteen. Een lopende overdracht is geen reden om nog even
       door te gaan; juist dan is intrekken het signaal dat het moet stoppen. */
    if (z.stand === 'stabilisatie' || z.stand === 'overdracht') z.stand = 'toestemming';
    z.bijgewerkt = nu();
    audit(wie(req).key, 'beschermzaak.toestemming-weg', z.codenaam, z.ingetrokken.reden || '');
    save();
    return { ok: true, zaak: beeld(z), melding: 'Toestemming ingetrokken. Er gaat niets meer naar buiten.' };
  }

  /* ---------- de gecontroleerde overdracht ---------- */
  function draagOver(req, id, b) {
    b = b || {};
    const stuk = keurInvoer(b); if (stuk) return stuk;
    const z = vind(id); if (!z) return { status: 404, error: 'Deze beschermzaak bestaat niet.' };
    const g = deur(req, z.stad); if (!g.ok) return g;
    if (z.gesloten) return { status: 400, error: 'Deze zaak is gesloten.' };
    if (z.stand !== 'overdracht') {
      return { status: 400, error: 'Zet de zaak eerst op "overdracht". Een overdracht is een besluit en geen bijvangst.' };
    }
    if (!z.toestemming || z.ingetrokken) {
      return { status: 400, error: 'Zonder staande toestemming gaat er niets over.' };
    }
    const naar = schoon(b.naar, 120);
    /* GRENDEL 2: de ontvanger moet dezelfde zijn als in de toestemming. Geen
       "lijkt erop", geen hoofdletterspel -- gelijk, of opnieuw vragen. */
    if (naar.toLowerCase() !== String(z.toestemming.ontvanger).toLowerCase()) {
      return { status: 403, error: 'De toestemming is gegeven voor "' + z.toestemming.ontvanger +
        '" en niet voor "' + naar + '". Vraag opnieuw toestemming, of draag over aan wie er staat.' };
    }
    const wat = schoon(b.wat, 300);
    if (wat.length < 5) return { status: 400, error: 'Wat wordt er precies overgedragen? Schrijf het op; de mens heeft recht te weten wat er over hem is verteld.' };
    (z.overdrachten = z.overdrachten || []).push({ naar, wat, door: wie(req).key, at: nu() });
    z.bijgewerkt = nu();
    audit(wie(req).key, 'beschermzaak.overdracht', z.codenaam, 'naar ' + naar);
    save();
    return { ok: true, zaak: beeld(z) };
  }

  return { toestemming, trekIn, draagOver };
};
