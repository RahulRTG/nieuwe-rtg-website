/* Genootschap (deelmodule): neem je genootschap mee.

   Elders is "download je gegevens" formeel gratis en in de praktijk een
   hindernisbaan: je vraagt het aan, je wacht uren tot dagen, en je krijgt een
   archief terug waar je zelf doorheen moet graven. Dat is geen dienst maar een
   drempel, en die drempel heeft maar een doel: dat je blijft.

   Hier is het een knop, en je krijgt het meteen:

   - EEN BEHEERDER neemt het hele genootschap mee: de kaart, de ledenlijst op
     codenaam, het prikbord met reacties en peilinguitslagen, en de agenda met
     de aantallen. Alles wat erin staat, zag elk lid al; het verschil is dat het
     nu ook buiten dit huis leesbaar is.
   - ELK LID neemt zijn EIGEN inbreng mee, ook zonder beheerder te zijn: wat jij
     schreef, waar jij op reageerde, hoe jij stemde en wat jij antwoordde.

   Twee dingen gaan er NOOIT in mee, ook niet in de beheerdersversie:
   - echte namen. Alles loopt op codenaam, zoals overal in dit huis; de kluis
     (server/accounts.js) komt hier niet langs.
   - sleutels. Een export is een document, geen kopie van de administratie.

   Zo is vertrekken hier goedkoop. Een groep die alleen blijft omdat weggaan te
   duur is, is geen groep maar een slot. */
module.exports = ({ genootschap, codenaamVan }) => {

  const bord = (id) => (genootschap.S().prikbord[id] || []);
  const bijeen = (id) => (genootschap.S().bijeenkomst[id] || []);

  const kaart = (gr) => ({
    naam: gr.naam, soort: gr.soort, over: gr.over || '', regels: gr.regels || '',
    opgericht: gr.at || null, leden: (gr.leden || []).length
  });

  const peilingUit = (p) => {
    if (!p) return null;
    const tel = p.keuzes.map(() => 0);
    for (const k of Object.keys(p.stemmen || {})) if (tel[p.stemmen[k]] !== undefined) tel[p.stemmen[k]]++;
    return { keuzes: p.keuzes.map((naam, i) => ({ naam, stemmen: tel[i] })), totaal: Object.keys(p.stemmen || {}).length };
  };

  /* Het hele genootschap, voor een beheerder. Chronologisch van oud naar nieuw,
     want een export lees je als een verslag en niet als een tijdlijn. */
  function alles(sess, groepId) {
    const gr = genootschap.groepMet(groepId);
    if (!gr) return { error: 'Dit genootschap bestaat niet.' };
    if (!genootschap.isBeheer(gr, sess.key)) return { error: 'Alleen een beheerder neemt het hele genootschap mee.' };

    const oud = (a, b) => String(a.at || '').localeCompare(String(b.at || ''));
    return { ok: true,
      uitgevoerdOp: new Date().toISOString(),
      genootschap: kaart(gr),
      leden: (gr.leden || []).map(l => ({ codenaam: codenaamVan(l.key), rol: l.rol, sinds: l.sinds })),
      prikbord: [...bord(groepId)].sort(oud).map(b => ({
        van: codenaamVan(b.vanKey), tekst: b.tekst, op: b.at,
        reacties: (b.reacties || []).map(r => ({ van: codenaamVan(r.vanKey), tekst: r.tekst, op: r.at })),
        peiling: peilingUit(b.peiling)
      })),
      agenda: [...bijeen(groepId)].sort((a, b) => String(a.datum).localeCompare(String(b.datum))).map(e => ({
        wat: e.wat, waar: e.waar || '', datum: e.datum, tijd: e.tijd || null,
        toelichting: e.toelichting || '', gastheer: codenaamVan(e.vanKey),
        plaatsen: e.plaatsen || null, afgelast: e.afgelast || null,
        ja: Object.keys(e.antwoorden || {}).filter(k => e.antwoorden[k] === 'ja').length,
        misschien: Object.keys(e.antwoorden || {}).filter(k => e.antwoorden[k] === 'misschien').length,
        nee: Object.keys(e.antwoorden || {}).filter(k => e.antwoorden[k] === 'nee').length
      })),
      voorwaarde: 'Codenamen, geen echte namen en geen sleutels. Wat hierin staat, was al zichtbaar voor elk lid van dit genootschap.' };
  }

  /* Je eigen inbreng, voor elk lid. Dit is de versie die er echt toe doet als je
     vertrekt: je neemt mee wat je zelf hebt geschreven. */
  function mijn(sess, groepId) {
    const gr = genootschap.groepMet(groepId);
    if (!gr) return { error: 'Dit genootschap bestaat niet.' };
    if (!genootschap.isLid(gr, sess.key)) return { error: 'Je bent hier geen lid van.' };
    const mij = sess.key;

    const berichten = [], reacties = [], stemmen = [];
    for (const b of bord(groepId)) {
      if (b.vanKey === mij) berichten.push({ tekst: b.tekst, op: b.at, reactiesEronder: (b.reacties || []).length });
      for (const r of (b.reacties || [])) {
        if (r.vanKey === mij) reacties.push({ op: r.at, tekst: r.tekst, onder: String(b.tekst || '').slice(0, 80) });
      }
      if (b.peiling && (b.peiling.stemmen || {})[mij] !== undefined) {
        stemmen.push({ vraag: String(b.tekst || '').slice(0, 80), mijnKeuze: b.peiling.keuzes[b.peiling.stemmen[mij]] || null });
      }
    }
    const antwoorden = bijeen(groepId)
      .filter(e => (e.antwoorden || {})[mij])
      .map(e => ({ wat: e.wat, datum: e.datum, mijnAntwoord: e.antwoorden[mij] }));

    const lid = genootschap.lidRegel(gr, mij);
    return { ok: true,
      uitgevoerdOp: new Date().toISOString(),
      genootschap: { naam: gr.naam, soort: gr.soort },
      ik: { codenaam: codenaamVan(mij), rol: lid ? lid.rol : null, sinds: lid ? lid.sinds : null },
      berichten, reacties, stemmen, antwoorden,
      voorwaarde: 'Alleen wat jij zelf schreef, stemde of antwoordde. Van andere leden staat er niets in.' };
  }

  return { alles, mijn };
};
