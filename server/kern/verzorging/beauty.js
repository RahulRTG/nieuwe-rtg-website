/* De beauty-salon en barbier (nadrukkelijk niet-medisch): stoelen,
   behandelingen met een duur, een agenda zonder dubbele stoelen en een
   walk-in wachtrij met volgnummers. Opslag in db.data.beauty[code]. */

const { MAX_LIJST, TIJD, DATUM, maakHulp } = require('../genrehulp');

module.exports = ({ db, save, crypto, schoon }) => {
  const { nu, vandaag, id, cap, bak, plusMin } = maakHulp({ db, save, crypto });

  function demoSalon() {
    return {
      naam: 'Velvet & Blade',
      stoelen: [
        { id: 's1', naam: 'Barbier 1', soort: 'barbier' },
        { id: 's2', naam: 'Barbier 2', soort: 'barbier' },
        { id: 's3', naam: 'Salon (knip & kleur)', soort: 'kapper' },
        { id: 's4', naam: 'Nagelstudio', soort: 'nagels' }
      ],
      behandelingen: [
        { id: 'b1', naam: 'Klassieke fade', soort: 'barbier', duurMin: 30, prijs: 32 },
        { id: 'b2', naam: 'Scheren met heet doek', soort: 'barbier', duurMin: 30, prijs: 28 },
        { id: 'b3', naam: 'Knippen & stylen', soort: 'kapper', duurMin: 45, prijs: 55 },
        { id: 'b4', naam: 'Kleuren, heel', soort: 'kapper', duurMin: 90, prijs: 120 },
        { id: 'b5', naam: 'Manicure', soort: 'nagels', duurMin: 45, prijs: 40 }
      ],
      afspraken: [], wachtrij: [], teller: 0
    };
  }
  const salonVan = bak('beauty', demoSalon);

  function beautyOverzicht(code) {
    const s = salonVan(code);
    const d = vandaag();
    const vandaagAf = s.afspraken.filter(a => a.datum === d && a.status !== 'weg');
    return {
      naam: s.naam, stoelen: s.stoelen, behandelingen: s.behandelingen,
      afspraken: s.afspraken.filter(a => a.datum >= d && a.status !== 'weg').slice(0, 40),
      wachtrij: s.wachtrij.slice(0, 20),
      kpi: {
        afsprakenVandaag: vandaagAf.length,
        wachtenden: s.wachtrij.filter(w => w.status === 'wacht').length,
        inDeStoel: s.wachtrij.filter(w => w.status === 'in de stoel').length,
        omzetVandaag: Math.round(vandaagAf.filter(a => a.status === 'klaar').reduce((t, a) => t + a.prijs, 0) * 100) / 100
      }
    };
  }
  function beautyBoek(code, b) {
    const s = salonVan(code);
    const beh = s.behandelingen.find(x => x.id === String(b.behandelingId || ''));
    const stoel = s.stoelen.find(x => x.id === String(b.stoelId || ''));
    if (!beh || !stoel) return { status: 404, error: 'Kies een behandeling en een stoel.' };
    if (beh.soort !== stoel.soort) return { status: 400, error: beh.naam + ' hoort niet bij ' + stoel.naam + '.' };
    const naam = schoon(b.naam, 60);
    const datum = String(b.datum || '').slice(0, 10), van = String(b.tijd || '');
    if (!naam) return { status: 400, error: 'Op welke naam staat de afspraak?' };
    if (!DATUM.test(datum) || !TIJD.test(van)) return { status: 400, error: 'Kies een datum en tijd.' };
    const tot = plusMin(van, beh.duurMin);
    const botst = s.afspraken.find(a => a.stoelId === stoel.id && a.datum === datum && a.status !== 'weg' && van < a.tot && tot > a.van);
    if (botst) return { status: 409, error: stoel.naam + ' is dan bezet (' + botst.van + ' tot ' + botst.tot + ').' };
    const a = { id: id('a'), naam, behandeling: beh.naam, stoelId: stoel.id, stoel: stoel.naam,
      datum, van, tot, prijs: beh.prijs, status: 'gepland', gemaakt: nu() };
    s.afspraken.unshift(a); cap(s.afspraken, MAX_LIJST); save();
    return { ok: true, afspraak: a };
  }
  function beautyStatus(code, aId, statusWens) {
    const s = salonVan(code);
    const a = s.afspraken.find(x => x.id === String(aId || ''));
    if (!a) return { status: 404, error: 'Afspraak niet gevonden.' };
    if (!['klaar', 'weg'].includes(statusWens)) return { status: 400, error: 'Kies klaar of weg.' };
    a.status = statusWens; save();
    return { ok: true, afspraak: a };
  }
  function walkIn(code, b) {
    const s = salonVan(code);
    const beh = s.behandelingen.find(x => x.id === String(b.behandelingId || ''));
    const naam = schoon(b.naam, 60);
    if (!beh) return { status: 404, error: 'Kies een behandeling.' };
    if (!naam) return { status: 400, error: 'Wie loopt er binnen?' };
    s.teller += 1;
    const w = { id: id('w'), nr: s.teller, naam, behandeling: beh.naam, prijs: beh.prijs, status: 'wacht', gemeld: nu() };
    s.wachtrij.push(w); cap(s.wachtrij, 50); save();
    return { ok: true, wachtend: w };
  }
  function walkStatus(code, wId, statusWens) {
    const s = salonVan(code);
    const w = s.wachtrij.find(x => x.id === String(wId || ''));
    if (!w) return { status: 404, error: 'Deze walk-in staat niet in de rij.' };
    if (statusWens === 'in de stoel') w.status = 'in de stoel';
    else if (statusWens === 'klaar') s.wachtrij = s.wachtrij.filter(x => x.id !== w.id);
    else return { status: 400, error: 'Kies in de stoel of klaar.' };
    save(); return { ok: true, wachtend: w };
  }

  return { beauty: { overzicht: beautyOverzicht, boek: beautyBoek, afspraakStatus: beautyStatus, walkIn, walkStatus } };
};
