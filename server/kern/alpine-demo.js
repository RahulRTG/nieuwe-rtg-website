/* De demo-skigebiedgegevens voor kern/alpine.js: het voorbeeldresort dat een
   nieuwe wintersport-partner meteen gevuld ziet. Pure data, apart gehouden
   zodat de motor klein blijft. */
module.exports = function demoResort() {
  return {
    naam: "Val d'Aurora", hoogte: '1650 tot 3120 m', dagpas: 69,
    lawine: 2,
    pistes: [
      { id: 'p1', naam: 'La Pradera', kleur: 'groen', status: 'open' },
      { id: 'p2', naam: 'Aurora Baixa', kleur: 'blauw', status: 'open' },
      { id: 'p3', naam: 'Cresta Llarga', kleur: 'rood', status: 'open' },
      { id: 'p4', naam: 'Paret Negra', kleur: 'zwart', status: 'open' },
      { id: 'p5', naam: 'Canal del Vent', kleur: 'zwart', status: 'open' }
    ],
    liften: [
      { id: 'l1', naam: 'Gondel Aurora', soort: 'gondel', status: 'open' },
      { id: 'l2', naam: 'Stoeltjeslift Cresta', soort: 'stoeltjes', status: 'open' },
      { id: 'l3', naam: 'Sleeplift Pradera', soort: 'sleep', status: 'open' }
    ],
    materiaal: [
      { id: 'm1', naam: "Ski's (allround) met stokken", dagprijs: 28 },
      { id: 'm2', naam: 'Snowboard met boots', dagprijs: 30 },
      { id: 'm3', naam: 'Helm', dagprijs: 6 },
      { id: 'm4', naam: 'Toerski-set met pieps', dagprijs: 48 }
    ],
    instructeurs: [
      { id: 'i1', naam: 'Mattia Rossi', prijs: 95 },
      { id: 'i2', naam: 'Lena Obrist', prijs: 95 }
    ],
    groepslessen: [
      { id: 'g1', naam: 'Beginners (ski)', tijd: '09:30', capaciteit: 8, deelnemers: [] },
      { id: 'g2', naam: 'Gevorderden (off-piste intro)', tijd: '13:00', capaciteit: 6, deelnemers: [] }
    ],
    chalets: [
      { id: 'c1', naam: 'Chalet Marmot', bedden: 6, nachtprijs: 480 },
      { id: 'c2', naam: 'Chalet Steenbok', bedden: 10, nachtprijs: 720 }
    ],
    passen: [], verhuur: [], privelessen: [], chaletBoekingen: []
  };
};
