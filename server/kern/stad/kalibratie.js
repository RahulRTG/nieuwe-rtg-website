/* RTG Stad, deel "kalibratie": een getal is nog geen meting.

   Een sensor die drie jaar niet is nagelopen, levert netjes getallen op die
   nergens meer op slaan -- en dat is erger dan een sensor die stuk is, want een
   kapotte sensor valt op. Vandaar per sensor een nulpunt en een factor, met de
   datum en de naam van wie het deed, en een geldigheidstermijn.

   De correctie wordt toegepast bij BINNENKOMST (zie nodes.js), niet bij het
   lezen. Zo bestaat er nooit een ruwe en een gecorrigeerde versie van dezelfde
   meting die langzaam uit elkaar lopen; wat in het geheugen staat, is wat de
   stad gemeten heeft. Krijgt de gedeelde ctx plus de paspoorthelpers. */
module.exports = (ctx, H) => {
  const { save, schoon, nu, nodes } = ctx;
  const { paspoort, paspoorten, KALIBRATIE_MAANDEN } = H;

  /* Kalibreren: per sensor een nulpunt en een factor, met de datum en de naam
     van wie het deed. De waarden worden bij binnenkomst toegepast (zie
     kalibreer()), zodat er nooit twee getallen bestaan voor dezelfde meting. */
  function kalibreer({ serial, sens, offset, factor, wie, notitie }) {
    const n = nodes()[String(serial || '')];
    if (!n) return { status: 404, error: 'Onbekende Stadsdoos.' };
    const s = String(sens || '');
    if (!n.sensoren.includes(s)) return { status: 400, error: 'Deze doos heeft geen sensor "' + s + '"; wel: ' + n.sensoren.join(', ') + '.' };
    const f = Number(factor);
    const o = Number(offset);
    if (!Number.isFinite(f) || f <= 0 || f > 10) return { status: 400, error: 'De factor is een getal boven 0 en hooguit 10.' };
    if (!Number.isFinite(o) || Math.abs(o) > 1000) return { status: 400, error: 'Het nulpunt ligt tussen -1000 en 1000.' };
    const pp = paspoort(n.serial);
    pp.kalibratie[s] = { offset: Math.round(o * 1000) / 1000, factor: Math.round(f * 1000) / 1000,
      at: nu(), door: schoon(wie, 60) || 'veld', notitie: schoon(notitie, 140) || null };
    save();
    return { ok: true, serial: n.serial, sens: s, kalibratie: pp.kalibratie[s],
      geldigTot: nu() + KALIBRATIE_MAANDEN * 30 * 86400000 };
  }

  // de correctie toepassen; zonder kalibratie gaat de waarde ongewijzigd door
  function corrigeer(serial, sens, waarde) {
    const pp = paspoorten()[String(serial || '')];
    const k = pp && pp.kalibratie && pp.kalibratie[sens];
    if (!k) return waarde;
    return Math.round((waarde * k.factor + k.offset) * 10) / 10;
  }

  return { kalibreer, corrigeer };
};
