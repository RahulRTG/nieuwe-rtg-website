/* Foundation OS, deel "partners": de lokale stichtingen waarmee RTF per stad
   samenwerkt.

   HET FEDERATIEVE MODEL IN EEN OBJECT. RTF levert merk, software, governance,
   geld en netwerk; de lokale stichting levert mensen, kennis en relaties. Dat
   werkt alleen als vooraf zwart op wit staat WIE WAT DOET -- vooral bij de vier
   dingen waar samenwerkingen op stuklopen: het geld, de vrijwilligers, de
   persoonsgegevens en de aansprakelijkheid. Die vier staan daarom niet in een
   vrij tekstveld maar als eigen velden met een vaste woordenlijst (rtf,
   partner, samen), zodat je ze kunt filteren, rapporteren en missen.

   DE PARTNER ZIET ALLEEN ZICHZELF. Het portaal draait op de partnercode en
   geeft uitsluitend het eigen dossier, de eigen stad en de eigen projecten
   terug. Er is geen enkele functie hier die op code een lijst van meer dan een
   partner oplevert; dat is de reden dat portaal() zelf zoekt in plaats van een
   filter op een overzicht te zetten (een filter dat je vergeet, lekt alles).

   DE LOOPTIJD IS EEN DATUM, GEEN GEVOEL. Een verlopen samenwerking geeft het
   portaal dicht: verlopen is niet "bijna" maar "niet meer". */

const STATUS = ['aangemeld', 'in_toetsing', 'goedgekeurd', 'actief', 'opgeschort', 'beeindigd'];
const WIE = ['rtf', 'partner', 'samen'];
const DOCSOORT = ['statuten', 'beleidsplan', 'jaarrekening', 'jaarverslag', 'overeenkomst',
  'verzekering', 'privacyafspraak', 'vog-beleid', 'anbi-beschikking', 'overig'];

module.exports = (ctx) => {
  const { nu, rid, schoon, code, S, audit, wie, poort, stadVan, save } = ctx;

  const vind = id => S().partners.find(p => p.id === String(id || ''));
  const vindCode = c => S().partners.find(p => p.code === String(c || '').trim().toUpperCase());
  const verlopen = p => !!p.tot && Date.parse(p.tot) < Date.now();

  // Wat de partner zelf ziet. Bewust zonder de interne beoordelingen: die zijn
  // van RTF, en een oordeel dat je aan de beoordeelde toont wordt geen oordeel.
  const partnerBeeld = p => ({ naam: p.naam, stad: (stadVan(p.stad) || {}).naam || null, status: p.status,
    doel: p.doel, werkgebied: p.werkgebied, van: p.van, tot: p.tot, verlopen: verlopen(p),
    afspraken: p.afspraken, bevoegdheden: p.bevoegdheden || [],
    documenten: (p.documenten || []).map(d => ({ id: d.id, soort: d.soort, naam: d.naam, at: d.at })) });
  const kantoorBeeld = p => Object.assign({ id: p.id, code: p.code, stad: p.stad, kvk: p.kvk, rsin: p.rsin,
    anbi: p.anbi, iban: p.iban, bestuurders: p.bestuurders || [], contact: p.contact,
    beoordelingen: (p.beoordelingen || []).slice(0, 20), at: p.at }, partnerBeeld(p));

  function lijst(req, stadId) {
    const w = wie(req);
    const p = poort(w, stadId, 'stad.lezen');
    if (!p.ok) return p;
    return { ok: true, statussen: STATUS, wieOpties: WIE, docsoorten: DOCSOORT,
      partners: S().partners.filter(x => x.stad === p.stad.id).map(kantoorBeeld) };
  }

  function maak(req, b) {
    b = b || {};
    const w = wie(req);
    const g = poort(w, b.stad, 'partner.beoordelen');
    if (!g.ok) return g;
    const naam = schoon(b.naam, 120);
    if (naam.length < 2) return { status: 400, error: 'Wat is de juridische naam van de stichting?' };
    if (S().partners.length >= 5000) return { status: 400, error: 'Het partnerregister zit vol.' };
    const p = { id: rid(), code: code('RTFP'), stad: g.stad.id, naam,
      kvk: schoon(b.kvk, 20), rsin: schoon(b.rsin, 20), anbi: b.anbi === true,
      iban: schoon(b.iban, 34), contact: schoon(b.contact, 120), doel: schoon(b.doel, 300),
      werkgebied: schoon(b.werkgebied, 120), bestuurders: [], documenten: [], beoordelingen: [],
      afspraken: { geld: 'rtf', vrijwilligers: 'partner', persoonsgegevens: 'partner',
        aansprakelijk: 'partner', rapportage: 'partner' },
      bevoegdheden: [], van: null, tot: null, status: 'aangemeld', at: nu() };
    S().partners.push(p);
    audit(w.key, 'partner.maak', naam, 'stad ' + g.stad.naam);
    save();
    return { ok: true, partner: kantoorBeeld(p) };
  }

  function zet(req, id, b) {
    const p = vind(id);
    if (!p) return { status: 404, error: 'Deze partner staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, p.stad, 'partner.beoordelen');
    if (!g.ok) return g;
    b = b || {};
    for (const veld of ['naam', 'kvk', 'rsin', 'iban', 'contact', 'werkgebied']) {
      if (b[veld] !== undefined) p[veld] = schoon(b[veld], veld === 'naam' ? 120 : 40);
    }
    if (b.doel !== undefined) p.doel = schoon(b.doel, 300);
    if (b.anbi !== undefined) p.anbi = b.anbi === true;
    for (const d of ['van', 'tot']) {
      if (b[d] !== undefined) {
        const s = schoon(b[d], 10);
        if (s && Number.isNaN(Date.parse(s))) return { status: 400, error: 'Gebruik een datum als 2026-03-01.' };
        p[d] = s || null;
      }
    }
    if (b.afspraken && typeof b.afspraken === 'object') {
      for (const k of Object.keys(p.afspraken)) {
        const v = String(b.afspraken[k] || '');
        if (v && !WIE.includes(v)) return { status: 400, error: 'Bij "' + k + '" hoort rtf, partner of samen.' };
        if (v) p.afspraken[k] = v;
      }
    }
    if (Array.isArray(b.bevoegdheden)) p.bevoegdheden = b.bevoegdheden.map(x => schoon(x, 60)).filter(Boolean).slice(0, 20);
    if (Array.isArray(b.bestuurders)) {
      p.bestuurders = b.bestuurders.map(x => ({ naam: schoon(x && x.naam, 60), functie: schoon(x && x.functie, 60) }))
        .filter(x => x.naam).slice(0, 20);
    }
    audit(w.key, 'partner.zet', p.naam, 'dossier bijgewerkt');
    save();
    return { ok: true, partner: kantoorBeeld(p) };
  }

  /* De statusketen. Goedkeuren is landelijk werk: een stad die zijn eigen
     partners goedkeurt, keurt zichzelf goed. De stad mag wel voordragen
     (in_toetsing) en opschorten -- ingrijpen mag altijd sneller dan toelaten. */
  function status(req, id, st) {
    const p = vind(id);
    if (!p) return { status: 404, error: 'Deze partner staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, p.stad, 'partner.beoordelen');
    if (!g.ok) return g;
    const s = String(st || '');
    if (!STATUS.includes(s)) return { status: 400, error: 'Kies een geldige status (' + STATUS.join(', ') + ').' };
    if ((s === 'goedgekeurd' || s === 'actief') && !w.landelijk) {
      return { status: 403, error: 'Een partnerstichting wordt landelijk goedgekeurd. Zet hem op "in_toetsing" en draag hem voor.' };
    }
    if (s === 'actief' && !(p.documenten || []).some(d => d.soort === 'overeenkomst')) {
      return { status: 400, error: 'Zonder samenwerkingsovereenkomst in het dossier gaat een partner niet op actief.' };
    }
    const oud = p.status;
    p.status = s;
    audit(w.key, 'partner.status', p.naam, oud + ' -> ' + s);
    save();
    return { ok: true, partner: kantoorBeeld(p) };
  }

  /* Documenten: de verwijzing, niet het bestand. Statuten, jaarrekening en VOG-
     beleid horen in de bestandenkluis; hier staat wat er is, van wanneer en tot
     wanneer het geldig is. Zo weet het toezicht wat het mist zonder dat het OS
     een tweede documentopslag wordt. */
  function documentMaak(req, id, b) {
    const p = vind(id);
    if (!p) return { status: 404, error: 'Deze partner staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, p.stad, 'partner.beoordelen');
    if (!g.ok) return g;
    b = b || {};
    const soort = String(b.soort || '');
    if (!DOCSOORT.includes(soort)) return { status: 400, error: 'Kies een soort (' + DOCSOORT.join(', ') + ').' };
    const naam = schoon(b.naam, 120);
    if (!naam) return { status: 400, error: 'Hoe heet het document?' };
    if (!Array.isArray(p.documenten)) p.documenten = [];
    if (p.documenten.length >= 200) return { status: 400, error: 'Dit dossier zit vol.' };
    p.documenten.unshift({ id: rid(), soort, naam, verwijzing: schoon(b.verwijzing, 200),
      geldigTot: schoon(b.geldigTot, 10) || null, at: nu() });
    audit(w.key, 'partner.document', p.naam, soort);
    save();
    return { ok: true, partner: kantoorBeeld(p) };
  }

  /* De beoordelingen en het portaal op de partnercode staan in
     ./partners-portaal.js: dat is de kant die de partner ZELF ziet, plus het
     oordeel dat hij juist niet ziet. Afgesplitst toen dit bestand tegen de
     10 KB van keuringsregel 13 liep. */
  const buiten = require('./partners-portaal')(ctx, { vind, vindCode, verlopen, partnerBeeld, kantoorBeeld });

  return { lijst, maak, zet, status, documentMaak, beoordeel: buiten.beoordeel,
    portaal: buiten.portaal, vind, vindCode, STATUS, WIE, DOCSOORT };
};
module.exports.STATUS = STATUS;
module.exports.DOCSOORT = DOCSOORT;
