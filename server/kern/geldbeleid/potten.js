/* Geldbeleid, deel "potten": oormerken over het eigen tegoed.

   Een pot is een voornemen ({ id, naam, doelCenten, standCenten }), geen
   rekening: er beweegt geen geld, dus ook geen saldocontrole tegen wallet of
   bank. Die controle zou een tweede boekhouding vragen en twee totalen lopen
   uiteen (GELD.md par. 7, LAT.md regel 4). De ene harde grens die er wel is:
   een pot gaat nooit onder nul, want meer vrijgeven dan er opzij staat is een
   boekhoudleugen. */

module.exports = (ctx) => {
  const { pak, kijk, maakId, bedragVan, zichtPot, logSchrijf, MAX_CENTEN } = ctx;
  const MAX_POTTEN = 40; // meer is geen sparen meer maar ruis, en het houdt de opslag per lid begrensd

  function potten(codenaam) { const rec = kijk(codenaam); return rec ? rec.potten.map(zichtPot) : []; }

  function potZet(codenaam, p) {
    const rec = pak(codenaam);
    if (!rec) return { status: 400, error: 'Geen codenaam.' };
    p = p && typeof p === 'object' ? p : {};
    const bestaand = p.id != null ? rec.potten.find(x => x.id === String(p.id)) : null;
    if (p.id != null && !bestaand) return { status: 404, error: 'Deze pot bestaat niet.' };
    const nm = String(p.naam == null ? (bestaand ? bestaand.naam : '') : p.naam).trim().slice(0, 60);
    if (!nm) return { status: 400, error: 'Geef de pot een naam.' };
    const doel = bedragVan(p.doelCenten != null ? p.doelCenten : (bestaand ? bestaand.doelCenten : null));
    if (doel == null) return { status: 400, error: 'Geef een doel in hele centen (0 tot ' + MAX_CENTEN + ').' };
    if (!bestaand && rec.potten.length >= MAX_POTTEN) return { status: 400, error: 'Meer dan ' + MAX_POTTEN + ' potten; ruim eerst op.' };
    const pot = bestaand || { id: maakId('pot'), standCenten: 0 };
    pot.naam = nm; pot.doelCenten = doel;
    if (!bestaand) rec.potten.push(pot);
    // ook dit in het log: beleid over geld is zelf een geldhandeling (GELD.md par. 5)
    logSchrijf(codenaam, { wie: 'lid', wat: (bestaand ? 'Pot aangepast: ' : 'Pot gemaakt: ') + nm,
      waarom: 'oormerken over het eigen tegoed; er beweegt geen geld', gegevens: ['pot: ' + pot.id, 'doel: ' + doel + ' centen'] });
    return { status: 200, ok: true, pot: zichtPot(pot) };
  }

  /* ALTIJD een logregel, ook bij vrijgeven: elke handeling van elk niveau is
     uitlegbaar. De herkomst zegt wie hem deed -- zonder herkomst is het het
     lid zelf (de route), met { wie: 'rahul' } een regel die Rahul uitvoerde;
     zo kan het log de twee nooit door elkaar halen. */
  function potReserveer(codenaam, id, centen, herkomst) {
    const rec = pak(codenaam);
    if (!rec) return { status: 400, error: 'Geen codenaam.' };
    const pot = rec.potten.find(x => x.id === String(id == null ? '' : id));
    if (!pot) return { status: 404, error: 'Deze pot bestaat niet.' };
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c === 0 || Math.abs(c) > MAX_CENTEN) return { status: 400, error: 'Geef een bedrag in hele centen; negatief geeft vrij.' };
    const nieuw = pot.standCenten + c;
    if (nieuw < 0) return { status: 400, error: 'Er staat ' + pot.standCenten + ' centen in deze pot; meer vrijgeven kan niet.' };
    if (nieuw > MAX_CENTEN) return { status: 400, error: 'Dat komt boven ' + MAX_CENTEN + ' centen in een pot; splits het doel.' };
    pot.standCenten = nieuw;
    const h = herkomst && typeof herkomst === 'object' ? herkomst : {};
    logSchrijf(codenaam, { wie: h.wie === 'rahul' ? 'rahul' : 'lid',
      wat: (c > 0 ? 'Gereserveerd in pot ' : 'Vrijgegeven uit pot ') + pot.naam,
      waarom: h.waarom || 'het lid koos dit zelf in de potten-stand',
      gegevens: ['pot: ' + pot.id, 'bedrag: ' + c + ' centen', 'stand: ' + nieuw + ' van ' + pot.doelCenten + ' centen'] });
    return { status: 200, ok: true, pot: zichtPot(pot) };
  }

  function potWeg(codenaam, id) {
    const rec = pak(codenaam);
    if (!rec) return { status: 400, error: 'Geen codenaam.' };
    const pid = String(id == null ? '' : id);
    const pot = rec.potten.find(x => x.id === pid);
    if (!pot) return { status: 404, error: 'Deze pot bestaat niet.' };
    // een AANstaande regel zou zijn doel stil verliezen (LAT.md regel 5): eerst de regel uit, dan de pot weg
    if (rec.regels.some(x => x.aan && x.potId === pid)) return { status: 400, error: 'Er staat nog een beleidsregel aan die in deze pot reserveert; zet die eerst uit.' };
    rec.potten = rec.potten.filter(x => x.id !== pid);
    logSchrijf(codenaam, { wie: 'lid', wat: 'Pot weggehaald: ' + pot.naam,
      waarom: 'weghalen geeft het oormerk vrij en dat hoort zichtbaar in het log, niet stil',
      gegevens: ['pot: ' + pot.id, 'vrijgevallen: ' + pot.standCenten + ' centen'] });
    return { status: 200, ok: true };
  }

  return { potten, potZet, potReserveer, potWeg };
};
