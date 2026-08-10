/* Hoe een bewaard ontwerp eruitziet.

   De kern van dit bestand is niet de vorm maar de vraag WAT EEN BEWARING
   OVERLEEFT. Bewaren bouwt een vers object; alles wat niet met de hand wordt
   meegenomen, verdwijnt. Dat is hier drie keer misgegaan -- de bevroren stand
   die online staat, het geplande publicatiemoment en het gekoppelde domein
   raakten elk stilletjes weg bij de eerstvolgende opslag. Daarom staan die
   regels bij elkaar, met de reden erbij. */
module.exports = ({ scho, crypto, schoonBlok, schoonKleuren }) => {
  return function bouwOntwerp({ d, key, opts, bestaand }) {
    const design = {
      id: bestaand ? bestaand.id : ('w' + crypto.randomBytes(5).toString('hex')),
      eigenaar: key,
      titel: scho(d.titel, 80) || 'Mijn website',
      thema: ['licht', 'donker'].includes(d.thema) ? d.thema : 'donker',
      accent: /^#[0-9a-fA-F]{6}$/.test(String(d.accent || '')) ? d.accent : '#7F1634',
      kleuren: schoonKleuren(d.kleuren),
      blokken: (Array.isArray(d.blokken) ? d.blokken : []).slice(0, 60).map(schoonBlok),
      zaakCode: (opts && opts.zaakCode) ? scho(opts.zaakCode, 30) : (bestaand ? (bestaand.zaakCode || '') : ''),
      adres: bestaand ? (bestaand.adres || '') : '',
      online: bestaand ? !!bestaand.online : false,
      bezoeken: bestaand ? (bestaand.bezoeken || 0) : 0,
      /* De stand die ONLINE staat overleeft een bewaring: bewaren verandert
         het concept en niet het web. Vergeten we dit, dan valt de site bij de
         eerstvolgende opslag terug op het concept en staat elke halve zin
         alsnog buiten -- precies wat deze laag moet voorkomen. */
      live: bestaand ? (bestaand.live || null) : null,
      liveOp: bestaand ? (bestaand.liveOp || null) : null,
      // een gepland publicatiemoment overleeft een bewaring om dezelfde reden
      plan: bestaand ? (bestaand.plan || undefined) : undefined,
      // net als de bevroren stand: een gekoppeld domein overleeft een bewaring
      domein: bestaand ? (bestaand.domein || undefined) : undefined,
      gemaakt: bestaand ? bestaand.gemaakt : new Date().toISOString(),
      bij: new Date().toISOString()
    };
    return design;
  };
};
