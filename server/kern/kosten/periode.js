/* EEN MAAND SLUITEN -- en dat kan pas als elke euro een verklaring heeft.

   RTG accepteert geen onverklaarde kosten. Dat was een zin, en een zin is geen
   grens. Deze module maakt er een stand van waar je in of uit moet:

     open           er is nog niet naar gekeken. De grondstand.
     in-onderzoek   iemand heeft een verschil gevonden en het klopt nog niet.
                    In deze stand gaat er NIETS naar de rekening van een lid:
                    factureren op cijfers waarvan je zelf zegt dat ze niet
                    kloppen, is de duurste fout die deze laag kan maken.
     gesloten       elk verschil is verklaard. De cijfers staan vast, en de
                    nota's van die maand zijn niet meer te veranderen.

   TWEE SOORTEN VERSCHIL, EN ZE ZIJN NIET HETZELFDE.

   1. AFSTEMMING. Voor een soort die we per gebruiker meten EN waarvan we de
      echte nota hebben: onze optelsom tegenover die nota. Loopt dat uiteen, dan
      klopt het tarief niet of mist de meter verbruik.

   2. ONVERDEELD. Een nota voor stroom of serverhuur in een maand waarin niemand
      iets verbruikte. Dat is geld dat het huis heeft uitgegeven zonder dat er
      iemand tegenover staat -- geen afrondingsfout maar een gat, en precies het
      soort post dat anders stilletjes in "overige kosten" verdwijnt.

   EEN VERKLARING IS TEKST EN GEEN VINKJE. Er wordt niet gecontroleerd of de
   verklaring waar is; dat kan software niet. Wat wel kan is eisen dat er iets
   staat, met een naam en een datum eronder, zodat de vraag "waarom stond hier
   148 euro verschil" over een jaar een antwoord heeft.

   EN JE SLUIT EEN MAAND DIE NOG LOOPT NIET. Er komt nog verbruik bij; een
   gesloten maand die daarna nog groeit, is geen gesloten maand. */
'use strict';

const STANDEN = ['open', 'in-onderzoek', 'gesloten'];
/* Onder deze grens heet een verschil geen verschil. Vijftig cent op een
   maandnota is een afrondingsverschil tussen twee systemen, geen bevinding --
   en een grens van nul levert een lijst op die niemand meer naloopt. */
const RUIS_CENTEN = 50;

module.exports = (ctx) => {
  const { d, save, nu, meter, overzicht, huisrekening, toerekening } = ctx;

  function bak() {
    const k = d();
    if (!k.perioden || typeof k.perioden !== 'object') k.perioden = {};
    return k.perioden;
  }
  const rij = (p) => bak()[p] || null;
  const pak = (p) => bak()[p] || (bak()[p] = { stand: 'open', verklaringen: {}, journaal: [] });

  /* Is deze maand voorbij? Vergelijkt op de periodesleutel zelf, zodat een
     verzette klok (toetsen) net zo hard meetelt als een echte. */
  const voorbij = (p) => String(p) < meter.periodeVan();

  /* Alles wat nog een verklaring nodig heeft. Rekent zelf niets uit: de
     afstemming komt uit ./overzicht.js en de verdeling uit ./toerekening.js.
     Twee plekken die dit zouden uitrekenen, zeggen op een dag iets anders over
     dezelfde maand. */
  function verschillen(periode) {
    const p = meter.periodeVan(periode);
    const uit = [];
    for (const a of overzicht.afstemming(p)) {
      if (a.notaCenten == null || a.verschilCenten == null) continue;
      if (Math.abs(a.verschilCenten) <= RUIS_CENTEN) continue;
      uit.push({ sleutel: 'afstemming:' + a.soort, soort: a.soort, naam: a.naam,
        wat: 'De nota is ' + (a.verschilCenten > 0 ? 'hoger' : 'lager') + ' dan onze eigen optelsom.',
        verschilCenten: a.verschilCenten, gerekendCenten: a.gerekendCenten, notaCenten: a.notaCenten });
    }
    for (const r of (toerekening.verdeling(p).regels || [])) {
      if (r.centen == null || r.centen <= RUIS_CENTEN) continue;
      if (!r.waarom) continue;   // netjes verdeeld: geen gat
      uit.push({ sleutel: 'onverdeeld:' + r.soort, soort: r.soort, naam: r.naam,
        wat: 'Deze nota is niet over gebruikers verdeeld: ' + r.waarom,
        verschilCenten: r.centen, gerekendCenten: 0, notaCenten: r.centen });
    }
    return uit;
  }

  function stand(periode) {
    const p = meter.periodeVan(periode);
    const r = rij(p);
    const lijst = verschillen(p);
    const verklaard = (r && r.verklaringen) || {};
    const open = lijst.filter(v => !verklaard[v.sleutel]);
    const isVoorbij = voorbij(p);
    return { periode: p, stand: (r && r.stand) || 'open', voorbij: isVoorbij,
      verschillen: lijst.map(v => Object.assign({}, v, { verklaring: verklaard[v.sleutel] || null })),
      onverklaard: open.length, onverklaardCenten: open.reduce((a, v) => a + Math.abs(v.verschilCenten), 0),
      ruisCenten: RUIS_CENTEN,
      geslotenOp: (r && r.geslotenOp) || null, geslotenDoor: (r && r.geslotenDoor) || null,
      journaal: ((r && r.journaal) || []).slice().reverse(),
      kanSluiten: isVoorbij && open.length === 0 && (!r || r.stand !== 'gesloten'),
      waarom: !isVoorbij ? 'Deze maand loopt nog; er komt nog verbruik bij.'
        : r && r.stand === 'gesloten' ? 'Deze maand is al gesloten.'
        : open.length ? (open.length + ' verschil(len) hebben nog geen verklaring.') : null };
  }

  function schrijf(p, wat, extra) {
    const r = pak(p);
    r.journaal.push(Object.assign({ wat, op: nu() }, extra || {}));
    if (r.journaal.length > 200) r.journaal.splice(0, r.journaal.length - 200);
  }

  function verklaar(periode, sleutel, tekst, wie) {
    const p = meter.periodeVan(periode);
    const s = String(sleutel || '').trim();
    if (!verschillen(p).some(v => v.sleutel === s)) return { status: 404, error: 'Dat verschil bestaat niet in deze maand.' };
    const t = String(tekst == null ? '' : tekst).trim().slice(0, 500);
    if (t.length < 8) return { status: 400, error: 'Schrijf op wat dit verschil verklaart; over een jaar is dit het enige antwoord dat er nog is.' };
    const naam = String(wie || '').trim().slice(0, 80);
    if (!naam) return { status: 400, error: 'Zonder wie gebeurt dit niet.' };
    const r = pak(p);
    if (r.stand === 'gesloten') return { status: 409, error: 'Deze maand is gesloten; heropen hem eerst, met een reden.' };
    r.verklaringen[s] = { tekst: t, door: naam, op: nu() };
    if (r.stand === 'open') r.stand = 'in-onderzoek';
    schrijf(p, 'verklaard', { sleutel: s, door: naam });
    save();
    return { status: 200, ok: true, stand: stand(p) };
  }

  function sluit(periode, wie) {
    const p = meter.periodeVan(periode);
    const st = stand(p);
    if (!st.kanSluiten) return { status: 409, error: st.waarom || 'Deze maand kan niet gesloten worden.', stand: st };
    const naam = String(wie || '').trim().slice(0, 80);
    if (!naam) return { status: 400, error: 'Zonder wie gebeurt dit niet.' };
    const r = pak(p);
    r.stand = 'gesloten'; r.geslotenOp = nu(); r.geslotenDoor = naam;
    schrijf(p, 'gesloten', { door: naam, verschillen: st.verschillen.length });
    save();
    return { status: 200, ok: true, stand: stand(p) };
  }

  function heropen(periode, reden, wie) {
    const p = meter.periodeVan(periode);
    const r = rij(p);
    if (!r || r.stand !== 'gesloten') return { status: 409, error: 'Deze maand is niet gesloten.' };
    const rd = String(reden == null ? '' : reden).trim().slice(0, 300);
    if (rd.length < 8) return { status: 400, error: 'Noem de reden; op een gesloten maand kunnen facturen zijn gebaseerd.' };
    const naam = String(wie || '').trim().slice(0, 80);
    if (!naam) return { status: 400, error: 'Zonder wie gebeurt dit niet.' };
    r.stand = 'in-onderzoek'; r.geslotenOp = null; r.geslotenDoor = null;
    schrijf(p, 'heropend', { door: naam, reden: rd });
    save();
    return { status: 200, ok: true, stand: stand(p) };
  }

  /* Voor de lagen die iets willen VERANDEREN aan een maand. Geeft een fout of
     null; zo staat de regel op een plek en niet in elke schrijver opnieuw. */
  function slotFout(periode) {
    const r = rij(meter.periodeVan(periode));
    if (r && r.stand === 'gesloten') {
      return { status: 409, error: 'Deze maand is gesloten (' + r.geslotenOp + '). Heropen hem eerst, met een reden.' };
    }
    return null;
  }
  const isOnderzoek = (periode) => {
    const r = rij(meter.periodeVan(periode));
    return !!(r && r.stand === 'in-onderzoek');
  };

  return { stand, verklaar, sluit, heropen, slotFout, isOnderzoek, verschillen, STANDEN, RUIS_CENTEN };
};
