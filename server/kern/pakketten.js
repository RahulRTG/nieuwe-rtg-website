/* RTG Bedrijfspakketten: een lid dat onderneemt (of dat wil) kiest zijn
   bedrijfstype -- tech, horeca, retail, hotel, zorg, creatief, vervoer,
   vastgoed -- en krijgt de JUISTE indeling voor zijn zaak: welke werkplekken,
   welke RTG-werk-apps en welke technieken (3D-indeling, QR, Zegel, kassa,
   borden, facturatie, AI-boekhouder) hij nodig heeft, plus welk gehuurd
   kantoor daarbij past.

   BEROEPSGEHEIM: dit gaat UITSLUITEND over wat de zaak van het lid krijgt.
   De interne werking van de RTG-kantoren zelf (hun eigen kamers, cijfers en
   schakelkast) komt hier NOOIT in voor -- die is en blijft bedrijfsgeheim.
   Deze module raakt die laag dan ook niet aan.

   maakPakketten volgt het vaste kern-patroon; de catalogus (TECHNIEK, APP,
   TYPEN) is pure data en staat los te toetsen in ./pakketten/catalogus.js. */

const { TECHNIEK, APP, TYPEN } = require('./pakketten/catalogus');

function typenLijst() {
  return TYPEN.map(t => ({ id: t.id, naam: t.naam, kort: t.kort }));
}

function techniekUit(namen) {
  return (namen || []).map(n => ({ id: n, ...(TECHNIEK[n] || { naam: n, wat: '' }) })).filter(t => t.naam);
}

function advies(id) {
  const t = TYPEN.find(x => x.id === id);
  if (!t) return null;
  return {
    id: t.id, naam: t.naam, kort: t.kort,
    werkplekken: t.werkplekken,
    apps: (t.apps || []).map(a => ({ id: a, naam: APP[a] || a })),
    technieken: techniekUit(t.technieken),
    indeling: t.indeling,
    huur: t.huur
  };
}

function maakPakketten({ anthropic } = {}) {
  /* Optioneel: Rahul kleurt het pakket bij op de specifieke situatie van het
     lid (bijv. "40 couverts, 2 bars, veel events"). Zonder AI-sleutel blijft
     het bij het vaste, degelijke advies. Nooit interne RTG-cijfers. */
  async function adviesAI(id, situatie) {
    const basis = advies(id);
    if (!basis) return null;
    if (!anthropic || !String(situatie || '').trim()) return { ...basis, opmaat: null };
    try {
      const resp = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 400,
        system: 'Je adviseert een RTG-lid over de indeling van zijn zaak, ALLEEN op basis van het meegegeven pakket. ' +
          'Noem nooit interne RTG-cijfers, marges of commissies. Antwoord kort en concreet in het Nederlands: 3-5 zinnen op maat.',
        messages: [{ role: 'user', content: 'Bedrijfstype: ' + basis.naam + '. Pakket-onderdelen: ' +
          basis.werkplekken.map(w => w.naam).join(', ') + '. Situatie van het lid: ' + String(situatie).slice(0, 400) +
          '. Geef kort advies wat hij als eerste inricht en waarop te letten.' }]
      });
      const tekst = resp.content.filter(c => c.type === 'text').map(c => c.text).join('').trim();
      return { ...basis, opmaat: tekst || null };
    } catch (e) { return { ...basis, opmaat: null }; }
  }
  return { typenLijst, advies, adviesAI };
}

module.exports = { maakPakketten, typenLijst, advies, TYPEN, TECHNIEK };
