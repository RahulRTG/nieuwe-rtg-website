/* Functieschakelaars (deelmodule): de bordweergave (catalogus met status per
   doelgroep) en het valideren/duiden van (AI-)wijzigingsvoorstellen.

   Dit is de orkestrator: de catalogus en de validatie wonen hier; de lokale
   taal-hulp (duidVoorstel, de terugval zonder AI-sleutel) staat in ./duiden en
   krijgt valideerVoorstel mee zodat er geen kringverwijzing ontstaat. */
const { CATEGORIEEN, DOELGROEP_OP_ID, FUNCTIES, OP_ID } = require('../register');
const { functieAan, functieAanVoor, functieStoring, functieStatus } = require('../toegang');
function catalogus(staat) {
  return CATEGORIEEN.map(cat => ({
    categorie: cat,
    functies: FUNCTIES.filter(f => f.categorie === cat).map(f => {
      const s = (staat && staat[f.id]) || {};
      const perLand = s.perLand || {};
      const perPersoon = s.perPersoon || {};
      return {
        id: f.id, naam: f.naam, uitleg: f.uitleg, standaard: f.standaard, aan: functieAan(f.id, staat),
        storing: functieStoring(f.id, staat), status: functieStatus(f.id, staat),
        doelgroepen: (f.doelgroepen || []).map(dg => {
          const meta = DOELGROEP_OP_ID[dg] || { id: dg, naam: dg, emoji: '•' };
          return { id: dg, naam: meta.naam, emoji: meta.emoji, aan: functieAanVoor(f.id, dg, staat) };
        }),
        // actieve beperkingen per land en per persoon (alleen wat expliciet uit staat)
        landUit: Object.keys(perLand).filter(k => perLand[k] === false),
        persoonUit: Object.keys(perPersoon).filter(k => perPersoon[k] === false)
      };
    })
  })).filter(g => g.functies.length);
}

/* Valideer een lijst voorgestelde wijzigingen. Naast het klassieke schakelen
   ({ id, doelgroep|genre, aan }) kent het contract nu ook de geld-regie:
   { soort:'pasprijs', pas, euro }, { soort:'korting', genre, pct } en
   { soort:'commissie', genre|code, pct }. Alleen bestaande functies en
   doelgroepen komen erdoor; genres en zaakcodes worden schoongemaakt en bij
   het toepassen nogmaals door de geld-/genre-motor gecontroleerd. Zo kan de
   AI-hulp (Rahul) nooit iets onmogelijks voorstellen; er verandert pas iets
   als de eigenaar het voorstel toepast. */
const schoonGenre = g => String(g || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30) || null;
const schoonCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || null;
function valideerVoorstel(arr) {
  if (!Array.isArray(arr)) return [];
  const uit = [];
  for (const w of arr) {
    if (!w) continue;
    const soort = String(w.soort || 'schakel');
    if (soort === 'pasprijs') {
      const pas = w.pas === 'rtg' || w.pas === 'lifestyle' ? w.pas : null;
      const euro = Number(w.euro);
      if (pas && Number.isFinite(euro) && euro >= 0 && euro <= 100000)
        uit.push({ soort, pas, euro, naam: 'Pasprijs ' + (pas === 'rtg' ? 'RTG Pass' : 'Lifestyle Pass') + ' naar € ' + euro + ' per maand (ex btw)' });
      continue;
    }
    if (soort === 'korting' || soort === 'commissie') {
      const pct = Number(w.pct);
      const max = soort === 'korting' ? 50 : 30;
      const genre = schoonGenre(w.genre), code = soort === 'commissie' ? schoonCode(w.code) : null;
      if (Number.isFinite(pct) && pct >= 0 && pct <= max && (genre || code))
        uit.push({ soort, genre, code, pct,
          naam: (soort === 'korting' ? 'Ledenvoordeel ' : 'Partnervergoeding ') + (code || genre) + ' naar ' + pct + '%' });
      continue;
    }
    const f = OP_ID[w.id];
    if (!f) continue;
    const aan = w.aan !== false && w.aan !== 'false';
    const genre = schoonGenre(w.genre);
    if (genre) { uit.push({ soort: 'schakel', id: f.id, naam: f.naam, genre, aan }); continue; }
    let dg = w.doelgroep || null;
    if (dg && !(f.doelgroepen || []).includes(dg)) continue;
    uit.push({ soort: 'schakel', id: f.id, naam: f.naam, doelgroep: dg, aan });
  }
  return uit;
}

// de lokale taal-hulp; krijgt valideerVoorstel mee (geen kringverwijzing)
const duidVoorstel = require('./duiden')(valideerVoorstel);

module.exports = { catalogus, valideerVoorstel, duidVoorstel };
