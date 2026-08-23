/* Een merk met vestigingen: een hoofdontwerp, en daaruit een eigen site per
   vestiging.

   WAAROM DIT BIJ HET KANTOOR LIGT. Een zaak kan zich hier niet tot moederbedrijf
   van een andere zaak uitroepen. Zaken zijn in dit huis losse codes; wie een
   merk mag samenstellen, moet dat van buiten die zaken af kunnen -- en de enige
   partij die dat gezag al heeft, is het kantoor dat zaken ook goedkeurt. Zou
   een zaak zichzelf tot hoofd kunnen benoemen, dan is het overnemen van
   andermans website een formulier ver weg.

   WAAROM EEN SJABLOON GENOEG IS VOOR ZEVENendertig SITES. De blokken van het
   sjabloon zijn grotendeels LIVE blokken (zaakdata): die lossen bij ieder
   bezoek op uit het profiel van DIE vestiging. Een sjabloon met een menu-blok
   levert in Amsterdam de Amsterdamse kaart en op Ibiza de Ibizaanse. Er wordt
   dus niets gekopieerd wat per vestiging verschilt -- dat was al opgelost toen
   het Business Master Record er kwam.

   WAT DE VESTIGING WEL EN NIET MAG. De vestiging beheert haar eigen INHOUD:
   openingstijden, foto's, menukaart, team -- dat staat allemaal in haar eigen
   zaakprofiel en komt vanzelf op de site. Wat zij niet mag is de HUISSTIJL
   veranderen: thema, accentkleur en de vrije kleuren komen van het merk en
   worden bij elke bewaring opnieuw opgelegd. Een vestiging die het logo van
   het merk kan omverven, is precies waarom een keten hier centraal beheer
   wil. */
/* WAT EEN GELDIG MERK IS, STAAT NIET HIER. Dit bestand had zijn eigen kopie van
   "een accentkleur is een hexcode" en "een thema is licht of donker", en die
   kopie was al uit elkaar gelopen met die van het Theater: daar gaf een foute
   kleur een 400, hier werd hij STIL genegeerd. Voor wie de knop indrukt is dat
   het verschil tussen een melding en de indruk dat het gelukt is -- en de
   tweede is de erge. De definitie staat in kern/tenant/merkkern.js; de OPSLAG
   blijft hier, want een keten is niet hetzelfde als een contract. */
const merkkern = require('./tenant/merkkern');

module.exports = ({ db, save, scho, webmaker, findSupplier }) => {
  const MAX_VESTIGINGEN = 500;

  function pot() {
    if (!db.data.webMerken || typeof db.data.webMerken !== 'object') db.data.webMerken = {};
    return db.data.webMerken;
  }
  const norm = c => scho(String(c || '').toUpperCase(), 30);

  function lijst() {
    return Object.values(pot()).map(m => ({ code: m.code, naam: m.naam, vestigingen: (m.vestigingen || []).length,
      huisstijl: m.huisstijl, sjabloonBlokken: ((m.sjabloon || {}).blokken || []).length, bij: m.bij }));
  }
  function haal(code) { return pot()[norm(code)] || null; }

  function maak(code, naam) {
    const c = norm(code);
    if (c.length < 2) return { error: 'Geef het merk een code van minstens twee tekens.', status: 400 };
    const p = pot();
    if (p[c]) return { error: 'Dit merk bestaat al.', status: 409 };
    p[c] = { code: c, naam: scho(naam, 80) || c, vestigingen: [], sjabloon: null,
             huisstijl: { thema: 'donker', accent: '#7F1634', kleuren: null }, bij: new Date().toISOString() };
    save();
    return { ok: true, merk: p[c] };
  }

  /* Een vestiging koppelen. Alleen een zaak die echt bestaat, en een zaak hoort
     bij hooguit een merk: twee merken die dezelfde vestiging opeisen, geven een
     site die om beurten van huisstijl wisselt. */
  function koppel(code, zaakCode, aan) {
    const m = haal(code);
    if (!m) return { error: 'Merk niet gevonden.', status: 404 };
    const z = norm(zaakCode);
    if (!findSupplier(z)) return { error: 'Deze zaak kennen we niet.', status: 404 };
    if (aan) {
      const ander = Object.values(pot()).find(x => x.code !== m.code && (x.vestigingen || []).includes(z));
      if (ander) return { error: 'Deze zaak hoort al bij het merk ' + ander.naam + '.', status: 409 };
      if (m.vestigingen.length >= MAX_VESTIGINGEN) return { error: 'Dit merk zit aan het maximum aantal vestigingen.', status: 400 };
      if (!m.vestigingen.includes(z)) m.vestigingen.push(z);
    } else {
      m.vestigingen = m.vestigingen.filter(x => x !== z);
    }
    m.bij = new Date().toISOString();
    save();
    return { ok: true, vestigingen: m.vestigingen.slice() };
  }

  // het hoofdontwerp en de huisstijl van het merk
  function zetSjabloon(code, ontwerp) {
    const m = haal(code);
    if (!m) return { error: 'Merk niet gevonden.', status: 404 };
    const d = ontwerp || {};
    /* Eerst het merk, want een foute kleur hoort het SJABLOON ook niet te laten
       doorgaan: half bewaren is de vorm waarin niemand ziet wat er is gebeurd. */
    const stijl = merkkern.leesMerkvelden(
      { thema: d.thema == null ? null : d.thema, accent: d.accent == null ? null : d.accent },
      m.huisstijl, scho);
    if (stijl.error) return { error: stijl.error, status: stijl.status || 400 };
    m.huisstijl = stijl.merk;
    m.sjabloon = { titel: scho(d.titel, 80) || m.naam, blokken: Array.isArray(d.blokken) ? d.blokken : [], paginas: Array.isArray(d.paginas) ? d.paginas : [] };
    /* `kleuren` is van dit bestand en niet van de merkkern: een keten mag vrije
       kleuren aan zijn sjabloon hangen, een tenant niet. */
    if (d.kleuren === null || (d.kleuren && typeof d.kleuren === 'object')) m.huisstijl.kleuren = d.kleuren || null;
    m.bij = new Date().toISOString();
    save();
    return { ok: true, merk: m };
  }

  /* Bij welk merk hoort deze zaak -- en dus welke huisstijl geldt er voor haar
     site. Dit is de vraag die webmaker bij elke bewaring stelt. */
  function huisstijlVoorZaak(zaakCode) {
    if (!zaakCode) return null;
    const z = norm(zaakCode);
    const m = Object.values(pot()).find(x => (x.vestigingen || []).includes(z));
    return m ? { merk: m.code, naam: m.naam, ...m.huisstijl } : null;
  }

  /* Uitrollen: elke vestiging krijgt het hoofdontwerp als haar site en gaat
     online op haar eigen naam. De LIVE blokken maken er vanzelf N verschillende
     sites van.

     Dit overschrijft het handwerk op een vestigingssite -- dat is het punt van
     centraal beheer, en het is niet stiekem: de vorige stand gaat gewoon de
     versiegeschiedenis in, dus een vestiging kan terug. */
  function uitrol(code) {
    const m = haal(code);
    if (!m) return { error: 'Merk niet gevonden.', status: 404 };
    if (!m.sjabloon || !(m.sjabloon.blokken || []).length) return { error: 'Zet eerst een hoofdontwerp voor dit merk.', status: 400 };
    const gedaan = [];
    for (const z of m.vestigingen) {
      const s = findSupplier(z);
      if (!s) continue;                     // een zaak die weg is slaan we over
      const key = 'zaak:' + s.code;
      const bestaande = webmaker.mijn(key)[0];
      const ontwerp = {
        titel: m.sjabloon.titel === m.naam ? s.name : m.sjabloon.titel,
        thema: m.huisstijl.thema, accent: m.huisstijl.accent, kleuren: m.huisstijl.kleuren,
        blokken: JSON.parse(JSON.stringify(m.sjabloon.blokken)),
        paginas: JSON.parse(JSON.stringify(m.sjabloon.paginas || []))
      };
      if (bestaande) ontwerp.id = bestaande.id;
      const r = webmaker.bewaar(key, ontwerp, { zaakCode: s.code, reden: 'uitgerold vanuit merk', wie: m.naam });
      if (r.error) continue;
      let p = webmaker.publiceer(key, r.design.id, webmaker.slug(s.name), m.naam);
      if (p.error && p.status === 409) p = webmaker.publiceer(key, r.design.id, webmaker.slug(s.name + '-' + s.code), m.naam);
      gedaan.push({ zaak: s.code, naam: s.name, adres: p.adres || '' });
    }
    m.bij = new Date().toISOString();
    save();
    return { ok: true, uitgerold: gedaan };
  }

  return { lijst, haal, maak, koppel, zetSjabloon, uitrol, huisstijlVoorZaak };
};
