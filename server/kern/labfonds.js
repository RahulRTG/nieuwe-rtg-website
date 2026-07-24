/* Het Lab-fonds (kern/labfonds): leden zamelen samen geld in voor het RTF
   Onderzoekslab. Het opgehaalde geld wordt PER LOCATIE verdeeld, zodat elke plek
   zelf in zijn eigen omgeving kan investeren. Wat er per locatie met de pot
   gebeurt, beslissen de leden GEZAMENLIJK -- met een AI-scheidsrechter die let
   op eerlijkheid, of het echt de omgeving dient (geen privaat gewin) en of het
   binnen de pot past. De AI adviseert en breekt gelijke stand; de leden stemmen.

   Dit is de OPENBARE, ledenkant. De besloten R&D van personeel (bedrijfsgeheimen)
   staat los in kern/onderzoekslab.js en is niet via dit fonds zichtbaar.

   Geld is hier een toezegging in het fondsgrootboek (centen); er wordt nooit
   geclaimd dat een echte betaling is verwerkt. Opslag: db.data.labFonds. */

module.exports = ({ db, save, crypto, anthropic }) => {
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(4).toString('hex');
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);
  const centen = (euro) => Math.max(0, Math.round(Number(euro) * 100) || 0);
  const eur = (c) => Math.round(c) / 100;
  // richtingen die geen omgeving dienen maar privaat gewin: de scheidsrechter raadt af
  const PRIVAAT = ['mezelf', 'mijzelf', 'eigen zak', 'prive', 'privé', 'vakantie voor mij', 'cadeau voor mij', 'zakgeld', 'mijn rekening'];

  function F() {
    if (!db.data.labFonds || typeof db.data.labFonds !== 'object') db.data.labFonds = {};
    const f = db.data.labFonds;
    if (!f.locaties || typeof f.locaties !== 'object') f.locaties = {};
    if (!Array.isArray(f.bijdragen)) f.bijdragen = [];
    if (!Array.isArray(f.voorstellen)) f.voorstellen = [];
    // een startset locaties (elke plek een eigen pot); leden kunnen er bij maken
    if (!Object.keys(f.locaties).length) {
      [['ibiza', 'Ibiza', 'ES'], ['amsterdam', 'Amsterdam', 'NL'], ['rotterdam', 'Rotterdam', 'NL']]
        .forEach(([id, naam, land]) => { f.locaties[id] = { id, naam, land, pot: 0, opgehaald: 0, uitgekeerd: 0 }; });
    }
    return f;
  }
  const loc = (id) => F().locaties[String(id || '')];
  const vindV = (id) => F().voorstellen.find(v => v.id === String(id || ''));

  function locSlug(naam) {
    return schoon(naam, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || rid();
  }
  function locatieMaak(naam, land) {
    const f = F();
    const n = schoon(naam, 40);
    if (n.length < 2) return { status: 400, error: 'Geef de locatie een duidelijke naam.' };
    const id = locSlug(n);
    if (!f.locaties[id]) { f.locaties[id] = { id, naam: n, land: schoon(land, 2).toUpperCase() || '', pot: 0, opgehaald: 0, uitgekeerd: 0 }; save(); }
    return { ok: true, locatie: f.locaties[id] };
  }

  function locBeeld(l, lidKey) {
    const voorstellen = F().voorstellen.filter(v => v.locId === l.id);
    return {
      id: l.id, naam: l.naam, land: l.land,
      pot: eur(l.pot), opgehaald: eur(l.opgehaald), uitgekeerd: eur(l.uitgekeerd),
      open: voorstellen.filter(v => v.status === 'open').length,
      mijnBijdrage: eur(F().bijdragen.filter(b => b.lidKey === lidKey && b.locId === l.id).reduce((s, b) => s + b.centen, 0))
    };
  }
  function voorstelBeeld(v, lidKey) {
    const voor = (v.stemmen.voor || []).length, tegen = (v.stemmen.tegen || []).length;
    return {
      id: v.id, locId: v.locId, titel: v.titel, doel: v.doel, bedrag: eur(v.centen),
      door: v.doorNaam, status: v.status, voor, tegen,
      mijnStem: (v.stemmen.voor || []).includes(lidKey) ? 'voor' : (v.stemmen.tegen || []).includes(lidKey) ? 'tegen' : null,
      scheids: v.scheids || null, besluit: v.besluit || null, at: v.at
    };
  }

  // het openbare fondsoverzicht voor een lid
  function fonds(lidKey) {
    const f = F();
    const locaties = Object.values(f.locaties).map(l => locBeeld(l, lidKey))
      .sort((a, b) => b.pot - a.pot);
    const voorstellen = f.voorstellen.filter(v => v.status === 'open')
      .slice(0, 100).map(v => voorstelBeeld(v, lidKey));
    return {
      ok: true,
      totaalOpgehaald: eur(Object.values(f.locaties).reduce((s, l) => s + l.opgehaald, 0)),
      totaalPot: eur(Object.values(f.locaties).reduce((s, l) => s + l.pot, 0)),
      mijnBijdrage: eur(f.bijdragen.filter(b => b.lidKey === lidKey).reduce((s, b) => s + b.centen, 0)),
      locaties, voorstellen
    };
  }

  // een lid zamelt in: de bijdrage gaat naar de pot van EEN locatie (de omgeving)
  function doneer(lidKey, lidNaam, locId, euro) {
    if (!lidKey) return { status: 403, error: 'Log in met je RTG-account om mee in te zamelen.' };
    const l = loc(locId); if (!l) return { status: 404, error: 'Deze locatie bestaat niet.' };
    const c = centen(euro);
    if (c < 100) return { status: 400, error: 'Zamel minimaal EUR 1 in.' };
    if (c > 5000000) return { status: 400, error: 'Dat is te veel voor een keer; verdeel het over meerdere keren.' };
    l.pot += c; l.opgehaald += c;
    F().bijdragen.unshift({ id: rid(), lidKey, lidNaam: schoon(lidNaam, 40) || 'Lid', locId: l.id, centen: c, at: nu() });
    if (F().bijdragen.length > 5000) F().bijdragen.pop();
    save();
    return { ok: true, locatie: locBeeld(l, lidKey) };
  }

  /* De voorstellen, de stemming, de AI-scheidsrechter en de beslissing draaien
     als submodule op dezelfde context; zie labfonds/voorstellen.js. */
  const { voorstelMaak, stem, scheidsrechter, beslis, boardroom } = require('./labfonds/voorstellen')({
    F, loc, vindV, locBeeld, voorstelBeeld, schoon, centen, eur, nu, rid, save, PRIVAAT });

  return { labfonds: { fonds, locatieMaak, doneer, voorstelMaak, stem, scheidsrechter, beslis, boardroom } };
};
