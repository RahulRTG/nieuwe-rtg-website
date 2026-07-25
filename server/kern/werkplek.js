/* Kern-module "werkplek": de twee huizen van Rahul als werkplek. RTG is het
   reisbedrijf, RTF de stichting; ze delen het platform maar niet hun cijfers,
   hun mensen of hun takenlijst. Wie hier binnenkomt kiest eerst een huis en
   ziet daarna alleen dat huis.

   Toegang loopt via de sleutelbos van het ene account (kern/eenaccount.js):
   de eigenaar mag in beide huizen, ieder ander alleen in het huis waaraan hij
   gekoppeld is. Deze module beslist niets over toegang zelf; de routes geven
   door wie er kijkt en met welk recht.

   Privacy by design: de bezetting draait op codenamen, net als de rest van het
   platform. De echte naam staat in de kluis (accounts.js) en komt hier niet.

   Opslag: db.data.werkplekMensen en db.data.werkplekTaken, allebei per
   bedrijfscode.

   maakWerkplek(state) volgt het vaste kern-patroon. */

const CODES = ['rtg', 'rtf'];

module.exports = ({ db, save, crypto }) => {
  const nu = () => Date.now();
  const d = () => db.data;
  const lijst = x => Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.values(x) : []);
  const tel = x => lijst(x).length;
  const open = x => lijst(x).filter(i => i && !i.klaar && !i.af && i.status !== 'klaar').length;
  const euro = centen => Math.round((Number(centen) || 0) / 100);

  /* De twee huizen. Elk levert zijn eigen cijfers en zijn eigen "wat loopt er",
     zodat een bezoeker meteen ziet waar dit huis vandaag mee bezig is. */
  const BEDRIJVEN = {
    rtg: {
      naam: 'Rahul Travel Group', kort: 'RTG', icoon: 'maison',
      aard: 'Het reisbedrijf: leden, partners en alles wat er onderweg geregeld wordt.',
      kantoor: '/apps/kantoren.html',
      cijfers: () => [
        ['Partners', tel(d().suppliers)],
        ['Bestellingen', tel(d().orders)],
        ['Boekingen', tel(d().boekingen)],
        ['Reserveringen', tel(d().reserveringen)],
        ['Ritten', tel(d().rides)],
        ['Facturen', tel(d().facturen)]
      ],
      loopt: () => [
        { titel: 'Bestellingen die nog open staan', aantal: open(d().orders) },
        { titel: 'Ritten onderweg', aantal: lijst(d().rides).filter(r => r && r.status && r.status !== 'klaar' && r.status !== 'geannuleerd').length },
        { titel: 'Sollicitaties in behandeling', aantal: lijst(d().applications).filter(a => a && a.status === 'open').length },
        { titel: 'Partner-aanmeldingen', aantal: lijst(d().partnerApplications).filter(a => a && a.status !== 'afgerond').length }
      ]
    },
    rtf: {
      naam: 'Rahul Travel Foundation', kort: 'RTF', icoon: 'rtf',
      aard: 'De stichting: 30% van elke bijdrage, de clubs in de steden en het onderzoekslab.',
      kantoor: '/apps/foundation/kantoor.html',
      cijfers: () => [
        ['Afdrachten', tel(d().fondsAfdrachten)],
        ['Opgehaald (euro)', euro(lijst(d().fondsAfdrachten).reduce((s, a) => s + (Number(a && a.bedrag) || 0), 0))],
        ['Clubs', tel(d().rtfClubs)],
        ['Steden', new Set(lijst(d().rtfClubs).map(c => c && c.stad).filter(Boolean)).size],
        ['Lab-projecten', tel(d().labProjecten)],
        ['Gezinnen', tel(d().gezinnen)]
      ],
      loopt: () => [
        { titel: 'Clubs die actief zijn', aantal: lijst(d().rtfClubs).filter(c => c && c.status === 'actief').length },
        { titel: 'Lab-projecten in proef of uitrol', aantal: lijst(d().labProjecten).filter(p => p && (p.fase === 'proef' || p.fase === 'uitrol')).length },
        { titel: 'Veiligheidstoetsen open', aantal: lijst(d().labProjecten).filter(p => p && (p.veiligheid || {}).status === 'open').length },
        { titel: 'Kamertaken open in het RTF-kantoor', aantal: Object.values(d().rtfKantoorTaken || {}).reduce((s, r) => s + lijst(r).filter(t => t && !t.af).length, 0) }
      ]
    }
  };

  const kent = code => Object.prototype.hasOwnProperty.call(BEDRIJVEN, String(code || '').toLowerCase());
  const norm = code => String(code || '').toLowerCase();

  function bak(sleutel, code) {
    if (!d()[sleutel] || typeof d()[sleutel] !== 'object') d()[sleutel] = {};
    if (!Array.isArray(d()[sleutel][code])) d()[sleutel][code] = [];
    return d()[sleutel][code];
  }
  const mensenVan = code => bak('werkplekMensen', code);
  const takenVan = code => bak('werkplekTaken', code);

  /* ---- de twee huizen naast elkaar ---- */
  function bedrijven() {
    return { ok: true, bedrijven: CODES.map(code => {
      const b = BEDRIJVEN[code];
      return { code, naam: b.naam, kort: b.kort, icoon: b.icoon, aard: b.aard, kantoor: b.kantoor,
        mensen: mensenVan(code).length,
        takenOpen: takenVan(code).filter(t => !t.af).length,
        kopcijfer: b.cijfers()[0] };
    }) };
  }

  /* ---- een huis van binnen ---- */
  function overzicht(code) {
    code = norm(code);
    if (!kent(code)) return { status: 404, error: 'Dit bedrijf kennen we niet.' };
    const b = BEDRIJVEN[code];
    return { ok: true, code, naam: b.naam, kort: b.kort, icoon: b.icoon, aard: b.aard, kantoor: b.kantoor,
      cijfers: b.cijfers().map(([label, waarde]) => ({ label, waarde })),
      loopt: b.loopt(),
      mensen: mensenVan(code).slice(0, 50),
      taken: takenVan(code).slice(0, 30) };
  }

  /* ---- de bezetting: wie werkt hier, op codenaam ---- */
  function mensZet(code, body) {
    code = norm(code);
    if (!kent(code)) return { status: 404, error: 'Dit bedrijf kennen we niet.' };
    const codenaam = String((body || {}).codenaam || '').replace(/[<>]/g, '').trim().slice(0, 60);
    const functie = String((body || {}).functie || '').replace(/[<>]/g, '').trim().slice(0, 60);
    if (!codenaam) return { status: 400, error: 'Wie komt erbij? Geef een codenaam.' };
    const rij = mensenVan(code);
    const bestaat = rij.find(m => m.codenaam.toLowerCase() === codenaam.toLowerCase());
    if (bestaat) { bestaat.functie = functie || bestaat.functie; save(); return { ok: true, mensen: rij.slice(0, 50) }; }
    if (rij.length >= 200) return { status: 400, error: 'Deze werkplek zit vol (200 mensen).' };
    rij.unshift({ id: crypto.randomBytes(4).toString('hex'), codenaam, functie: functie || 'Medewerker', sinds: nu() });
    save();
    return { ok: true, mensen: rij.slice(0, 50) };
  }
  function mensWeg(code, id) {
    code = norm(code);
    if (!kent(code)) return { status: 404, error: 'Dit bedrijf kennen we niet.' };
    const rij = mensenVan(code);
    const i = rij.findIndex(m => m.id === id);
    if (i < 0) return { status: 404, error: 'Deze persoon staat hier niet meer.' };
    rij.splice(i, 1);
    save();
    return { ok: true, mensen: rij.slice(0, 50) };
  }

  /* ---- de takenlijst van het huis ---- */
  function taakMaak(code, tekst) {
    code = norm(code);
    if (!kent(code)) return { status: 404, error: 'Dit bedrijf kennen we niet.' };
    const t = String(tekst || '').replace(/[<>]/g, '').trim().slice(0, 200);
    if (!t) return { status: 400, error: 'Wat moet er gebeuren?' };
    const rij = takenVan(code);
    rij.unshift({ id: crypto.randomBytes(4).toString('hex'), tekst: t, af: false, at: nu() });
    if (rij.length > 100) rij.pop();
    save();
    return { ok: true, taken: rij.slice(0, 30) };
  }
  function taakZet(code, id, af) {
    code = norm(code);
    if (!kent(code)) return { status: 404, error: 'Dit bedrijf kennen we niet.' };
    const t = takenVan(code).find(x => x.id === id);
    if (!t) return { status: 404, error: 'Deze taak staat er niet meer.' };
    t.af = af === true;
    save();
    return { ok: true, taken: takenVan(code).slice(0, 30) };
  }

  /* ---- wie mag in welk huis ----
     De eigenaar mag in beide; ieder ander alleen in het huis waarvoor hij een
     sleutel heeft gekregen. De eigenaar geeft die sleutel en neemt hem terug;
     er is geen andere weg naar binnen. */
  const toegangVan = code => bak('werkplekToegang', code);

  function magIn(code, key, baas) {
    code = norm(code);
    if (!kent(code)) return false;
    if (baas) return true;
    return !!key && toegangVan(code).some(t => t.key === key);
  }
  function mijnHuizen(key, baas) {
    return CODES.filter(code => magIn(code, key, baas));
  }
  function toegangLijst(code) {
    code = norm(code);
    if (!kent(code)) return { status: 404, error: 'Dit bedrijf kennen we niet.' };
    return { ok: true, code, toegang: toegangVan(code).map(t => ({ key: t.key, naam: t.naam || null, sinds: t.at })) };
  }
  function toegangGeef(code, key, naam) {
    code = norm(code);
    if (!kent(code)) return { status: 404, error: 'Dit bedrijf kennen we niet.' };
    const k = String(key || '').trim().slice(0, 80);
    if (!k) return { status: 400, error: 'Wie krijgt de sleutel?' };
    const rij = toegangVan(code);
    if (rij.some(t => t.key === k)) return { ok: true, ...toegangLijst(code) };
    rij.push({ key: k, naam: String(naam || '').replace(/[<>]/g, '').trim().slice(0, 60) || null, at: nu() });
    save();
    return toegangLijst(code);
  }
  function toegangWeg(code, key) {
    code = norm(code);
    if (!kent(code)) return { status: 404, error: 'Dit bedrijf kennen we niet.' };
    const rij = toegangVan(code);
    const i = rij.findIndex(t => t.key === String(key || ''));
    if (i < 0) return { status: 404, error: 'Deze sleutel is al ingeleverd.' };
    rij.splice(i, 1);
    save();
    return toegangLijst(code);
  }

  return { werkplek: { bedrijven, overzicht, mensZet, mensWeg, taakMaak, taakZet,
    magIn, mijnHuizen, toegangLijst, toegangGeef, toegangWeg, kent, CODES } };
};
