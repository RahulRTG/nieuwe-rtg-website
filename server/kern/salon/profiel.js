/* Het ledenprofiel van De Salon: je eigen pagina met bio, je raster en je
   volgers, en het bewaren van posts.

   Tot nu toe had ALLEEN een partner een Salon-profiel. Een lid was een naam
   boven een reactie, meer niet. Dit maakt van een lid een volwaardige bewoner
   van De Salon, maar wel op de manier van dit huis:

   - Alles op CODENAAM. Een profiel toont nooit een echte naam; die staat in de
     gescheiden kluis en komt hier niet langs. Je bio is wat jij erover kwijt wilt.
   - Volgen is wederzijds zichtbaar maar niet wederzijds verplicht, en er is geen
     teller die groei aanjaagt: je ziet aantallen, geen groeigrafiek.
   - Bewaren is prive. Niemand ziet wat jij bewaart, ook de maker niet. */
module.exports = ({ db, save, codenaamVan, keyVanCodenaam, liveCodename, salon }) => {
  const { keur } = require('../veilig');
  const BIO_MAX = 240;

  /* Van codenaam naar sleutel. Dit loopt ALTIJD over de ledengids (kern/gids.js),
     en die is async: bij Postgres staat de gids in een geindexeerde tabel en niet
     in het geheugen. Vandaar dat volgen en het profiel hieronder async zijn.

     Bewust geen terugval op "dan is het zeker de sleutel zelf": een onbekende
     codenaam is een onbekend lid, punt. Anders zou een client met een gegokte
     sessiesleutel iemand kunnen aanwijzen, en dat is precies wat het codenaam-
     ontwerp moet voorkomen. */
  async function keyVan(wie, mij) {
    const c = String(wie || '').trim();
    if (!c || c === 'ik') return mij || null;
    if (!keyVanCodenaam) return null;
    try { const t = await keyVanCodenaam(c); return (t && t.key) || null; } catch (e) { return null; }
  }

  /* Je eigen kaart bijwerken. Bio en plaats zijn vrij; de 9+-keuring geldt hier
     net zo goed als op een post, want een profieltekst is ook tekst die
     anderen lezen. */
  function bioZet(mij, invoer) {
    const s = salon.S();
    const bio = String((invoer && invoer.bio) || '').slice(0, BIO_MAX).trim();
    const plaats = String((invoer && invoer.plaats) || '').slice(0, 60).trim();
    if (bio) { const k = keur(bio); if (!k.ok) return { error: k.reden }; }
    s.bio[mij] = { bio, plaats, bij: new Date().toISOString() };
    save();
    return { ok: true, profiel: s.bio[mij] };
  }

  const volgersVan = (key) => {
    const s = salon.S();
    return Object.keys(s.volgtLid).filter(k => (s.volgtLid[k] || []).includes(key));
  };

  /* Een ander lid volgen. Op codenaam, en zonder verzoek: De Salon is binnen de
     leden een open huis. Wie niet gevolgd wil worden, zet zijn posts op
     vrienden-alleen (dat regelt de zichtbaarheidspoort, kern/salonviraal.js). */
  async function volg(mij, wie, aan) {
    const s = salon.S();
    const key = await keyVan(wie, null);
    if (!key) return { error: 'Dit lid ken ik niet.' };
    if (key === mij) return { error: 'Dat kan niet.' };
    const lijst = s.volgtLid[mij] = s.volgtLid[mij] || [];
    const i = lijst.indexOf(key);
    if (aan && i < 0) lijst.push(key);
    if (!aan && i >= 0) lijst.splice(i, 1);
    save();
    return { ok: true, volgIk: lijst.includes(key), volgers: volgersVan(key).length };
  }

  /* Het profiel van iemand (of van jezelf): de kaart plus zijn raster. Het
     raster loopt via dezelfde feed-functie, dus dezelfde zichtbaarheidsregels
     en dezelfde paginering gelden -- geen tweede pad dat kan afwijken. */
  async function profiel(sess, wie, opties, poort) {
    const s = salon.S();
    const mij = sess.key;
    const key = await keyVan(wie, mij);
    if (!key) return { error: 'Dit lid ken ik niet.' };
    const kaart = s.bio[key] || { bio: '', plaats: '' };
    const raster = salon.feed(sess, { ...(opties || {}), vanKey: key }, poort);
    return {
      ok: true,
      codenaam: key === mij ? (liveCodename(sess) || codenaamVan(key)) : codenaamVan(key),
      ikZelf: key === mij,
      bio: kaart.bio || '', plaats: kaart.plaats || '',
      posts: raster.totaal,
      volgers: volgersVan(key).length,
      volgend: (s.volgtLid[key] || []).length,
      volgIk: (s.volgtLid[mij] || []).includes(key),
      raster
    };
  }

  /* Bewaren: je eigen, prive plank. De maker van de post merkt er niets van --
     dat is met opzet, want "X bewaarde jouw post" is precies zo'n seintje dat
     mensen terugtrekt zonder dat het iets toevoegt. */
  function bewaar(mij, postId, aan) {
    const s = salon.S();
    const p = salon.postMet(postId);
    if (!p) return { error: 'Deze post bestaat niet.' };
    const lijst = s.bewaard[mij] = s.bewaard[mij] || [];
    const i = lijst.indexOf(p.id);
    if (aan && i < 0) lijst.unshift(p.id);
    if (!aan && i >= 0) lijst.splice(i, 1);
    if (lijst.length > 500) lijst.length = 500;
    save();
    return { ok: true, bewaard: lijst.includes(p.id), aantal: lijst.length };
  }

  // Wie volg ik? Als lijst met codenamen, zodat de app hem direct kan tonen.
  function volgend(mij) {
    const s = salon.S();
    return (s.volgtLid[mij] || []).map(k => ({ codenaam: codenaamVan(k), key: k }));
  }

  return { bioZet, volg, profiel, bewaar, volgend, volgersVan };
};
