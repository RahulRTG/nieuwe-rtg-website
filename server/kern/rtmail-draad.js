/* RTMAIL (deelmodule): het gesprek.

   Een postvak dat alleen chronologisch toont, laat de lezer zelf uitzoeken
   welk antwoord bij welke vraag hoort. Deze laag zet de berichten van EEN
   draad op volgorde en vat de lijst samen tot gesprekken.

   WAAR DE DRAAD VANDAAN KOMT: rtmail.js stempelt hem bij het versturen. Een
   antwoord (`antwoordOp`) erft de draad van zijn ouder, een nieuw bericht
   begint er zelf een. Er wordt NIET op onderwerp gegroepeerd -- "Re: vraag"
   van twee verschillende klanten zou dan in een gesprek belanden, en in een
   gedeeld postvak betekent dat: andermans post lezen. Liever een draad te veel
   dan een draad die te veel laat zien.

   DE RECHTENREGEL, EN HIJ IS HIER SCHERPER DAN ELDERS. Een draad kan berichten
   bevatten die aan iemand ANDERS gericht zijn (A schrijft B, B stuurt door aan
   C). Wie de draad opvraagt, krijgt daarom uitsluitend de berichten waar hij
   zelf afzender of ontvanger van is, plus een EERLIJKE telling van wat er
   verder in het gesprek zit. Verzwijgen dat er meer is, zou net zo misleidend
   zijn als het tonen ervan. */
const adresLaag = require('./rtmail-adres');

module.exports = ({ db, rtmail, vak }) => {
  const store = () => {
    if (!db.data.rtmail || !Array.isArray(db.data.rtmail.berichten)) db.data.rtmail = { berichten: [] };
    return db.data.rtmail;
  };
  const draadVan = (m) => m.draad || m.id;
  const mijn = (m, adres) => adresLaag.zelfdeBus(m.naar, adres) || adresLaag.zelfdeBus(m.van, adres);

  /* Een heel gesprek, oudste eerst -- want een gesprek lees je van boven naar
     beneden, ook al staat het postvak nieuwste eerst. */
  function draad(adres, id) {
    const alle = store().berichten;
    const start = alle.find(m => m.id === id);
    if (!start) return { error: 'Dit bericht bestaat niet.' };
    if (!mijn(start, adres)) return { error: 'Dit bericht staat niet in dit postvak.' };
    const d = draadVan(start);
    const nu = new Date().toISOString();
    const inDraad = alle.filter(m => draadVan(m) === d);
    const zichtbaar = inDraad.filter(m => mijn(m, adres))
      .sort((a, b) => String(a.at).localeCompare(String(b.at)));
    return {
      ok: true, draad: d,
      berichten: zichtbaar.map(m => vak.publiek(m, adres, nu)),
      aantal: zichtbaar.length,
      buitenBeeld: inDraad.length - zichtbaar.length,
      let: inDraad.length > zichtbaar.length
        ? 'Dit gesprek heeft ' + (inDraad.length - zichtbaar.length) + ' bericht(en) waar u geen afzender of ontvanger van bent; die staan er niet bij.'
        : null
    };
  }

  /* Het postvak als GESPREKKEN in plaats van losse berichten: per draad het
     nieuwste bericht, met de telling en of er nog iets ongelezen in zit. */
  function lijst(adres, opties) {
    const berichten = vak.lijst(adres, Object.assign({ limit: 200 }, opties || {}));
    const per = new Map();
    for (const m of berichten) {
      const d = m.draad || m.id;
      const g = per.get(d) || { draad: d, nieuwste: null, aantal: 0, ongelezen: 0, deelnemers: new Set() };
      g.aantal++;
      if (!m.gelezen && adresLaag.zelfdeBus(m.naar, adres)) g.ongelezen++;
      g.deelnemers.add(m.van); g.deelnemers.add(m.naar);
      // de lijst komt nieuwste-eerst binnen, dus het eerste dat we zien is het nieuwste
      if (!g.nieuwste) g.nieuwste = m;
      per.set(d, g);
    }
    return [...per.values()].map(g => ({
      draad: g.draad, aantal: g.aantal, ongelezen: g.ongelezen,
      deelnemers: [...g.deelnemers].slice(0, 8),
      onderwerp: g.nieuwste.onderwerp, at: g.nieuwste.at,
      van: g.nieuwste.van, id: g.nieuwste.id,
      vertrouwd: g.nieuwste.vertrouwd, labels: g.nieuwste.labels, favoriet: g.nieuwste.favoriet
    }));
  }

  /* Antwoorden. Loopt via rtmail.stuur (daar zit het vertrouwensstempel), maar
     zet de ontvanger en de draad zelf -- een antwoord gaat naar de afzender van
     het oorspronkelijke bericht, en dat mag de client niet kunnen omzeilen. */
  function beantwoord(adres, id, { tekst, bron, onderwerp } = {}) {
    const m = store().berichten.find(x => x.id === id);
    if (!m) return { error: 'Dit bericht bestaat niet.' };
    if (!mijn(m, adres)) return { error: 'Dit bericht staat niet in dit postvak.' };
    const naar = adresLaag.zelfdeBus(m.naar, adres) ? m.van : m.naar;
    const ond = String(onderwerp || '').trim() ||
      (/^re:/i.test(m.onderwerp) ? m.onderwerp : 'Re: ' + m.onderwerp);
    return rtmail.stuur({ van: adres, naar, onderwerp: ond, tekst, soort: 'antwoord',
      bron: bron || 'extern', antwoordOp: m.id });
  }

  return { draad, lijst, beantwoord, draadVan };
};
