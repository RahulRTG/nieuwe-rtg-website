/* Lab-fonds (deelmodule): de voorstellen, de stemming, de AI-scheidsrechter en
   de gezamenlijke beslissing. Draait op de gedeelde context die kern/labfonds.js
   opbouwt (de locaties, de pot, de helpers). */
module.exports = (ctx) => {
  const { F, loc, vindV, locBeeld, voorstelBeeld, schoon, centen, eur, nu, rid, save, PRIVAAT } = ctx;

  // een voorstel om uit de pot van een locatie in de omgeving te investeren
  function voorstelMaak(lidKey, lidNaam, locId, titel, doel, euro) {
    if (!lidKey) return { status: 403, error: 'Log in om een voorstel te doen.' };
    const l = loc(locId); if (!l) return { status: 404, error: 'Deze locatie bestaat niet.' };
    const t = schoon(titel, 100), d = schoon(doel, 500);
    if (t.length < 4) return { status: 400, error: 'Geef het voorstel een duidelijke titel.' };
    if (d.length < 10) return { status: 400, error: 'Leg kort uit wat het voor de omgeving oplevert.' };
    const c = centen(euro);
    if (c < 100) return { status: 400, error: 'Noem een bedrag van minimaal EUR 1.' };
    const v = { id: rid(), locId: l.id, doorKey: lidKey, doorNaam: schoon(lidNaam, 40) || 'Lid',
      titel: t, doel: d, centen: c, status: 'open',
      stemmen: { voor: [lidKey], tegen: [] }, scheids: null, besluit: null, at: nu() };
    // de scheidsrechter geeft meteen een eerste oordeel mee
    v.scheids = weegAf(v, l);
    F().voorstellen.unshift(v);
    if (F().voorstellen.length > 3000) F().voorstellen.pop();
    save();
    return { ok: true, voorstel: voorstelBeeld(v, lidKey) };
  }

  function stem(lidKey, voorstelId, keuze) {
    if (!lidKey) return { status: 403, error: 'Log in om te stemmen.' };
    const v = vindV(voorstelId); if (!v) return { status: 404, error: 'Dit voorstel bestaat niet.' };
    if (v.status !== 'open') return { status: 409, error: 'Over dit voorstel is al beslist.' };
    if (!['voor', 'tegen'].includes(keuze)) return { status: 400, error: 'Stem voor of tegen.' };
    v.stemmen.voor = (v.stemmen.voor || []).filter(k => k !== lidKey);
    v.stemmen.tegen = (v.stemmen.tegen || []).filter(k => k !== lidKey);
    v.stemmen[keuze].push(lidKey);
    save();
    return { ok: true, voorstel: voorstelBeeld(v, lidKey) };
  }

  /* De AI-scheidsrechter: weegt eerlijkheid, of het de OMGEVING dient (geen
     privaat gewin) en of het binnen de pot past. Regelgebaseerd zodat het altijd
     werkt; met een echte sleutel verrijkt Rahul de motivatie (hier kort gehouden). */
  function weegAf(v, l) {
    const laag = (v.titel + ' ' + v.doel).toLowerCase();
    if (PRIVAAT.some(w => laag.includes(w)))
      return { oordeel: 'afraden', reden: 'Dit lijkt privaat gewin; het fonds is er voor de omgeving, niet voor een persoon.', at: nu() };
    if (v.centen > l.pot)
      return { oordeel: 'afraden', reden: 'Er zit niet genoeg in de pot van ' + l.naam + ' (' + eur(l.pot) + ' beschikbaar).', at: nu() };
    if (v.centen > l.pot * 0.6 && l.pot > 0)
      return { oordeel: 'twijfel', reden: 'Dit legt in een keer beslag op een groot deel van de pot; overweeg te faseren of te verkleinen.', at: nu() };
    if (v.doel.length < 40)
      return { oordeel: 'twijfel', reden: 'Het doel is nog summier; een duidelijker plan helpt de leden om eerlijk te wegen.', at: nu() };
    return { oordeel: 'steun', reden: 'Past binnen de pot en dient de omgeving; eerlijk om over te stemmen.', at: nu() };
  }
  function scheidsrechter(voorstelId) {
    const v = vindV(voorstelId); if (!v) return { status: 404, error: 'Dit voorstel bestaat niet.' };
    v.scheids = weegAf(v, loc(v.locId) || { naam: '', pot: 0 });
    save();
    return { ok: true, scheids: v.scheids };
  }

  /* De gezamenlijke beslissing: de leden stemmen, de scheidsrechter bewaakt de
     grenzen en breekt een gelijke stand. Toegekend geld gaat uit de pot. */
  function beslis(voorstelId) {
    const v = vindV(voorstelId); if (!v) return { status: 404, error: 'Dit voorstel bestaat niet.' };
    if (v.status !== 'open') return { status: 409, error: 'Over dit voorstel is al beslist.' };
    const l = loc(v.locId); if (!l) return { status: 404, error: 'Deze locatie bestaat niet.' };
    const sc = weegAf(v, l); v.scheids = sc;
    const voor = (v.stemmen.voor || []).length, tegen = (v.stemmen.tegen || []).length;
    let toe = false, reden = '';
    if (sc.oordeel === 'afraden') { reden = 'De scheidsrechter raadt af: ' + sc.reden; }
    else if (v.centen > l.pot) { reden = 'Niet genoeg in de pot.'; }
    else if (voor > tegen) { toe = true; reden = 'Meerderheid voor; de scheidsrechter had geen bezwaar.'; }
    else if (voor === tegen && sc.oordeel === 'steun') { toe = true; reden = 'Gelijke stand; de scheidsrechter geeft de doorslag (steun).'; }
    else { reden = 'Geen meerderheid voor.'; }
    if (toe) { l.pot -= v.centen; l.uitgekeerd += v.centen; }
    v.status = toe ? 'toegekend' : 'afgewezen';
    v.besluit = { toegekend: toe, voor, tegen, reden, at: nu() };
    save();
    return { ok: true, voorstel: voorstelBeeld(v, v.doorKey), locatie: locBeeld(l, v.doorKey) };
  }

  // voor de boardroom: het hele fonds op een bord (alle locaties, alle voorstellen)
  function boardroom() {
    const f = F();
    return {
      ok: true,
      locaties: Object.values(f.locaties).map(l => ({ ...locBeeld(l, null) })),
      voorstellen: f.voorstellen.slice(0, 200).map(v => voorstelBeeld(v, null)),
      bijdragen: f.bijdragen.length
    };
  }

  return { voorstelMaak, stem, scheidsrechter, beslis, boardroom };
};
