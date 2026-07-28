/* DE GEDEELDE CHECKLIJST, vooral voor events.

   Een bord met kaarten bestaat al (kern/borden.js) en is bedoeld voor werk
   dat dagen loopt. Een event is iets anders: één avond, een lijst dingen
   die af moeten, en een handvol mensen die er samen doorheen lopen. Daar
   wil je geen kaarten slepen, daar wil je vinkjes.

   Wat deze laag toevoegt:
   - je deelt de lijst met NAMEN uit je eigen team; wie erop staat, ziet
     hem op zijn eigen scherm (PDA, telefoon, bureau) en vinkt zelf af;
   - bij elk vinkje staat wie het deed en hoe laat, dus achteraf hoef je
     niemand iets te vragen;
   - een item kan aan iemand worden toegewezen, maar hoeft dat niet: wie
     het eerst is, is het eerst;
   - een vinkje kan terug. Iemand die zich vergist zet hem gewoon uit, en
     dat blijft ook zichtbaar.

   De lijst is van de zaak; delen gaat op naam binnen het eigen team. Geen
   namen van leden hier: dit is personeelswerk. */
module.exports = ({ db, save, crypto, schoon }) => {
  const nu = () => new Date().toISOString();
  const bak = () => { if (!db.data.checklijsten || typeof db.data.checklijsten !== 'object') db.data.checklijsten = {}; return db.data.checklijsten; };
  const vanZaak = code => { const b = bak(); if (!Array.isArray(b[code])) b[code] = []; return b[code]; };

  const namen = ruw => [...new Set((Array.isArray(ruw) ? ruw : []).map(n => schoon(n, 40)).filter(Boolean))].slice(0, 40);

  /* Mag deze persoon meedoen? Een lege deel-lijst betekent: het hele team.
     De maker mag altijd. */
  const magMee = (l, wie) => !l.gedeeld.length || l.gedeeld.includes(wie) || l.door === wie;

  function maak(zaak, door, data) {
    data = data || {};
    const titel = schoon(data.titel, 80);
    if (!titel) return { status: 400, error: 'Geef de checklijst een titel.' };
    const rijen = vanZaak(zaak);
    if (rijen.length >= 300) return { status: 429, error: 'Er staan al driehonderd lijsten; ruim er eerst een paar op.' };
    const l = {
      id: 'CHK-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      zaak, titel,
      event: schoon(data.event, 60) || null,
      wanneer: schoon(data.wanneer, 20) || null,
      door: schoon(door, 40) || 'onbekend',
      gedeeld: namen(data.gedeeld),
      items: (Array.isArray(data.items) ? data.items : []).slice(0, 60).map(t => itemVan(t)).filter(Boolean),
      at: nu()
    };
    rijen.unshift(l);
    save();
    return { ok: true, lijst: metStand(l) };
  }

  function itemVan(ruw) {
    const tekst = schoon(typeof ruw === 'string' ? ruw : (ruw || {}).tekst, 120);
    if (!tekst) return null;
    return { id: crypto.randomBytes(3).toString('hex'), tekst,
      voor: schoon((ruw || {}).voor, 40) || null, klaar: null };
  }

  function metStand(l) {
    const af = l.items.filter(i => i.klaar).length;
    return Object.assign({}, l, {
      af, totaal: l.items.length,
      pct: l.items.length ? Math.round(af / l.items.length * 100) : 0,
      klaar: l.items.length > 0 && af === l.items.length,
      meedoen: l.gedeeld.length ? l.gedeeld : ['het hele team']
    });
  }

  const vind = (zaak, id) => vanZaak(zaak).find(l => l.id === String(id || ''));

  /* De lijsten die IK zie: alles wat met mij is gedeeld, plus wat met het
     hele team is gedeeld. Andermans besloten lijsten blijven weg. */
  function mijn(zaak, wie, f) {
    f = f || {};
    const ik = schoon(wie, 40);
    let rijen = vanZaak(zaak).filter(l => magMee(l, ik));
    if (f.event) rijen = rijen.filter(l => (l.event || '') === f.event);
    if (f.open) rijen = rijen.filter(l => l.items.some(i => !i.klaar));
    return { ok: true, ik,
      lijsten: rijen.slice(0, 60).map(metStand),
      events: [...new Set(vanZaak(zaak).map(l => l.event).filter(Boolean))],
      uitleg: 'Iedereen met wie de lijst is gedeeld vinkt zelf af; bij elk vinkje staat wie het deed.' };
  }

  /* Afvinken (of het vinkje terugnemen). Wie het doet, staat erbij. */
  function vink(zaak, id, itemId, wie, aan) {
    const l = vind(zaak, id);
    if (!l) return { status: 404, error: 'Deze checklijst bestaat niet.' };
    const ik = schoon(wie, 40);
    if (!ik) return { status: 400, error: 'Wie bent u?' };
    if (!magMee(l, ik)) return { status: 403, error: 'Deze lijst is niet met u gedeeld.' };
    const item = l.items.find(i => i.id === String(itemId || ''));
    if (!item) return { status: 404, error: 'Dit punt staat niet op de lijst.' };
    item.klaar = (aan === false) ? null : { door: ik, at: nu() };
    save();
    return { ok: true, lijst: metStand(l), item };
  }

  /* Een punt bijzetten mag iedereen die meedoet; onderweg blijkt altijd
     dat er iets ontbreekt. */
  function itemBij(zaak, id, wie, tekst, voor) {
    const l = vind(zaak, id);
    if (!l) return { status: 404, error: 'Deze checklijst bestaat niet.' };
    const ik = schoon(wie, 40);
    if (!magMee(l, ik)) return { status: 403, error: 'Deze lijst is niet met u gedeeld.' };
    if (l.items.length >= 60) return { status: 429, error: 'Zestig punten is genoeg voor één lijst.' };
    const item = itemVan({ tekst, voor });
    if (!item) return { status: 400, error: 'Wat moet er gebeuren?' };
    l.items.push(item);
    save();
    return { ok: true, lijst: metStand(l) };
  }

  /* Delen: wie erbij komt ziet de lijst meteen op zijn eigen scherm.
     Alleen de maker bepaalt met wie. */
  function deel(zaak, id, door, met) {
    const l = vind(zaak, id);
    if (!l) return { status: 404, error: 'Deze checklijst bestaat niet.' };
    if (l.door !== schoon(door, 40)) return { status: 403, error: 'Alleen wie de lijst maakte bepaalt met wie hij wordt gedeeld.' };
    l.gedeeld = namen(met);
    save();
    return { ok: true, lijst: metStand(l) };
  }

  function weg(zaak, id, door) {
    const rijen = vanZaak(zaak);
    const i = rijen.findIndex(l => l.id === String(id || ''));
    if (i < 0) return { status: 404, error: 'Deze checklijst bestaat niet.' };
    if (rijen[i].door !== schoon(door, 40)) return { status: 403, error: 'Alleen wie de lijst maakte kan hem weghalen.' };
    rijen.splice(i, 1);
    save();
    return { ok: true, weg: String(id) };
  }

  return { checklijst: { maak, mijn, vink, itemBij, deel, weg } };
};
