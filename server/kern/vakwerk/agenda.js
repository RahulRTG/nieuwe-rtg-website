/* Vakwerk, deelbestand "agenda": de beschikbaarheid en de boekbare tijdvakken. De
   dienstverlener zet werkdagen en openingstijden (met losse geblokkeerde dagen); het
   lid boekt dan in een echt vrij tijdvak in plaats van een willekeurige tijd te typen.
   Vrije tijden houden rekening met de duur van de dienst en met wat al geboekt is.
   Krijgt de gedeelde ctx van kern/vakwerk/index.js. */
module.exports = (ctx) => {
  const { save, findSupplier, boekingenVanZaak, genreVan, vandaagStr, datumVan, tijdVan,
    geldigeTijd, naarMin, naarTijd } = ctx;

  function urenVan(s) {
    const u = s.vakUren || {};
    return {
      // dagen[0..6] = zondag..zaterdag; standaard maandag t/m vrijdag
      dagen: Array.isArray(u.dagen) && u.dagen.length === 7 ? u.dagen.map(Boolean) : [false, true, true, true, true, true, false],
      van: geldigeTijd(u.van) ? u.van : '09:00',
      tot: geldigeTijd(u.tot) ? u.tot : '18:00',
      geblokkeerd: Array.isArray(u.geblokkeerd) ? u.geblokkeerd.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 366) : []
    };
  }
  function uren(code) {
    const s = findSupplier(code);
    if (!genreVan(s)) return { status: 403, error: 'Alleen voor dienstverlenende zaken.' };
    return { ok: true, uren: urenVan(s) };
  }
  function urenZet(code, data) {
    const s = findSupplier(code);
    if (!genreVan(s)) return { status: 403, error: 'Alleen voor dienstverlenende zaken.' };
    const nu = urenVan(s);
    const d = data || {};
    const dagen = Array.isArray(d.dagen) && d.dagen.length === 7 ? d.dagen.map(Boolean) : nu.dagen;
    const van = geldigeTijd(d.van) ? d.van : nu.van;
    const tot = geldigeTijd(d.tot) ? d.tot : nu.tot;
    if (naarMin(tot) <= naarMin(van)) return { status: 400, error: 'De sluitingstijd moet na de openingstijd liggen.' };
    let geblokkeerd = nu.geblokkeerd;
    if (d.blokkeer && /^\d{4}-\d{2}-\d{2}$/.test(d.blokkeer)) geblokkeerd = [...new Set([...geblokkeerd, d.blokkeer])];
    if (d.deblokkeer) geblokkeerd = geblokkeerd.filter(x => x !== d.deblokkeer);
    s.vakUren = { dagen, van, tot, geblokkeerd: geblokkeerd.slice(0, 366) };
    save();
    return { ok: true, uren: s.vakUren };
  }

  // de bezette tijdvakken (start-eindminuten) op een datum, uit de actieve boekingen
  function bezetOp(code, datum) {
    return (boekingenVanZaak(code) || [])
      .filter(b => (b.status === 'aangevraagd' || b.status === 'bevestigd') && datumVan(b) === datum && tijdVan(b))
      .map(b => { const start = naarMin(tijdVan(b)); return { start, eind: start + ((b.service && b.service.duurMin) || 60) }; });
  }
  function slots(code, serviceId, datum) {
    const s = findSupplier(code);
    if (!genreVan(s)) return { status: 403, error: 'Alleen voor dienstverlenende zaken.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(datum || ''))) return { status: 400, error: 'Kies een geldige datum.' };
    const dienst = (s.services || []).find(x => x.id === serviceId);
    const duur = (dienst && dienst.duurMin) || 60;
    const u = urenVan(s);
    const dag = new Date(datum + 'T12:00:00').getDay();
    if (datum < vandaagStr() || !u.dagen[dag] || u.geblokkeerd.includes(datum)) return { ok: true, datum, duurMin: duur, tijden: [] };
    const open = naarMin(u.van), dicht = naarMin(u.tot);
    const bezet = bezetOp(code, datum);
    const stap = Math.max(30, Math.min(duur, 120));
    const nuMin = datum === vandaagStr() ? (new Date().getHours() * 60 + new Date().getMinutes()) : -1;
    const tijden = [];
    for (let m = open; m + duur <= dicht; m += stap) {
      if (m <= nuMin) continue;
      if (bezet.some(b => m < b.eind && (m + duur) > b.start)) continue;
      tijden.push(naarTijd(m));
    }
    return { ok: true, datum, duurMin: duur, tijden };
  }

  return { uren, urenZet, slots };
};
