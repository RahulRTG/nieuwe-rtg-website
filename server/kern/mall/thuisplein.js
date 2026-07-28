/* RTG Mall, deelbestand "thuisplein": de verdieping RTG Thuis. De Mall is de
   plek waar een lid alles van RTG vindt, en verblijven horen daar bij. Deze
   verdieping toont de COMMERCIELE tak: de zaken die beroepsmatig verhuren,
   per stad, met hun vanaf-prijs en of zij op factuur werken. Boeken gebeurt
   niet hier maar in RTG Thuis zelf (/apps/thuis.html), op codenaam en met
   dezelfde regels -- de Mall wijst de weg, hij neemt de boeking niet over.

   Het aanbod komt via een late binding uit kern/thuis (haalThuis in de ctx),
   omdat de Mall eerder in de opbouw staat dan RTG Thuis. Staat Thuis (nog)
   niet aan, dan blijft de verdieping gewoon leeg. */
module.exports = (ctx) => {
  const { haalThuis } = ctx;

  function thuisplein() {
    let a = null;
    try { a = typeof haalThuis === 'function' ? haalThuis() : null; } catch (e) { a = null; }
    if (!a || !a.ok) return { ok: true, steden: [], aantal: 0, particulier: 0, zaken: 0,
      pagina: '/apps/thuis.html', opmerking: 'RTG Thuis staat klaar; er is nog geen commercieel aanbod.' };
    return a;
  }

  ctx.thuisplein = thuisplein;
  return { thuisplein };
};
