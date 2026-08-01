/* Groothandel (deelmodule): het slimme bijbestelvoorstel voor de horeca.

   Kijkt naar wat de zaak de afgelopen 14 dagen verkocht (gast-bestellingen) en
   naar de laatste mise-en-place, schat het verbruik en matcht dat op de
   producten van de groothandel. Zet een concept-bestelling klaar -- adviseren,
   nooit zelf bestellen: de zaak controleert en bevestigt.

   Afgesplitst uit ./orderlaag: dat bestand gaat over de orderketen, dit over
   het schatten. */
module.exports = ({ db, findSupplier, isGroothandel, defaults, functieAan, prijsVoor }) => {
  function verbruikVan(partner) {
    const sinds = Date.now() - 14 * 86400000;
    const teller = new Map(); // woord -> aantal verkocht
    for (const o of (db.data.orders || [])) {
      if (o.supplierCode !== partner.code) continue;
      if (o.at && new Date(o.at).getTime() < sinds) continue;
      for (const it of (o.items || [])) {
        for (const w of woorden(it.name || it.naam)) teller.set(w, (teller.get(w) || 0) + (Number(it.qty) || 1));
      }
    }
    // mise-en-place van de laatste dagen telt mee als verbruik-signaal
    const mep = partner.dailyMeps || {};
    for (const k of Object.keys(mep)) {
      for (const t of ((mep[k] && mep[k].tasks) || [])) for (const w of woorden(t.text || t)) teller.set(w, (teller.get(w) || 0) + 2);
    }
    return teller;
  }
  function woorden(tekst) {
    return String(tekst || '').toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(w => w.length >= 4);
  }
  function bijbestelVoorstel(partner, groothandelCode) {
    const s = findSupplier(groothandelCode);
    if (!isGroothandel(s)) return { status: 404, error: 'Groothandel niet gevonden.' };
    if (!functieAan(s, 'aiBijbestel')) return { status: 409, error: 'Deze groothandel biedt geen AI-bijbestellen.' };
    if (!functieAan(s, 'b2b')) return { status: 409, error: 'Deze groothandel levert niet aan horeca.' };
    const teller = verbruikVan(partner);
    const g = defaults(s);
    const regels = [];
    for (const p of g.producten.filter(x => x.actief)) {
      const sleutels = woorden(p.naam);
      let score = 0;
      for (const w of sleutels) for (const [k, v] of teller) if (k.includes(w) || w.includes(k)) score += v;
      if (score <= 0) continue;
      // voorgestelde hoeveelheid: het geschatte verbruik, minstens de minimale bestelhoeveelheid
      const aantal = Math.max(p.minBestel || 1, Math.ceil(score / 3));
      regels.push({ productId: p.id, naam: p.naam, eenheid: p.eenheid, aantal, prijs: prijsVoor(p, 'partner'), reden: score + ' keer in verkoop/mise-en-place' });
    }
    regels.sort((a, b) => b.aantal * b.prijs - a.aantal * a.prijs);
    const totaal = Math.round(regels.reduce((n, r) => n + r.aantal * r.prijs, 0) * 100) / 100;
    const uitleg = regels.length
      ? 'Op basis van de verkoop en mise-en-place van de afgelopen 14 dagen: ' + regels.length + ' product(en), samen € ' + totaal + '. Controleer en bevestig.'
      : 'Nog te weinig verkoopdata om iets voor te stellen. Plaats eerst wat bestellingen of bestel handmatig.';
    return { status: 200, ok: true, groothandelCode: s.code, groothandelNaam: s.name, regels: regels.slice(0, 40), totaal, uitleg };
  }

  return { bijbestelVoorstel };
};
