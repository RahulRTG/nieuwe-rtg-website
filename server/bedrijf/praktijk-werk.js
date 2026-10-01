'use strict';
const V = require('./praktijk-vorm');
const { werkFeit, werkBeginstand, werkVeld } = require('./gebeurtenis');
module.exports = ({ rid, nu, dag, log, kern }) => {
  const extern = require('./praktijk-extern')({ rid, nu, log });
  function vraag(w, actor, b) {
    const a = V.pak(w.praktijkAanbod, b.aanbodId);
    if (!w.praktijkProfiel || !a || !a.actief) return V.fout('Kies actief aanbod van deze organisatie.');
    if (!V.tekst(b.klant, 80) || !V.tekst(b.vraag, 500)) return V.fout('Vul de relatie en de vraag in.');
    if (b.datum && !V.datum(b.datum)) return V.fout('Kies een geldige datum.');
    if (Object.values(w.projecten || {}).filter(p => p.praktijkRef && p.status === 'loopt').length >= 1000)
      return V.fout('Er staan al 1.000 vragen open. Rond eerst werk af.', 429);
    let k = b.klantId && V.pak(w.klanten, b.klantId);
    if (b.klantId && !k) return V.fout('Deze relatie hoort niet bij de werkruimte.', 404);
    if (!k) {
      k = { id: rid(8), naam: V.tekst(b.klant, 80), land: w.praktijkProfiel.land,
        contacten: [], producten: [], eigenaar: actor.naam, at: nu() };
      (w.klanten || (w.klanten = {}))[k.id] = k;
    }
    const p = { id: rid(8), naam: V.tekst(b.vraag, 80), omschrijving: V.tekst(b.vraag, 500),
      werkvorm: 'algemeen', status: 'loopt', start: dag(), eind: null, budgetCenten: 0,
      uurtariefCenten: 0, eigenaar: actor.naam, mijlpalen: [], risicos: [], door: actor.naam, at: nu(),
      herkomst: { werkruimte: w.code, aanbodId: a.id, aanbodVersie: a.versie },
      praktijk: { klantId: k.id, aanbodId: a.id, aanbodVersie: a.versie, stand: 'vraag', versie: 1,
        omschrijving: V.tekst(b.vraag, 500), datum: b.datum || null, locatie: a.locatie,
        prijswijze: a.prijswijze, bedragMinor: a.bedragMinor, valuta: w.praktijkProfiel.valuta,
        tijdzone: w.praktijkProfiel.tijdzone, decimalen: w.praktijkProfiel.decimalen, voorstel: null, akkoord: null, uitvoering: null, administratie: null } };
    const details = p.praktijk; delete p.praktijk;
    p.praktijkRef = rid(8);
    (w.kansen || (w.kansen = {}))[p.praktijkRef] = { id: p.praktijkRef, klantId: k.id, klant: k.naam,
      titel: p.naam, eigenaar: actor.naam, fase: 'lead', bedragCenten: 0, valuta: w.praktijkProfiel.valuta,
      herkomst: { werkruimte: w.code, projectId: p.id, aanbodId: a.id, aanbodVersie: a.versie },
      historie: [], at: nu(), praktijk: details };
    (w.projecten || (w.projecten = {}))[p.id] = p;
    werkFeit(w, 'project', p.id, 'aangemaakt', { actor: actor.id || actor.naam, bron: 'werk/praktijk' },
      { naam: p.naam, werkvorm: p.werkvorm, status: p.status, budgetCenten: 0 });
    werkBeginstand(w, 'project', p, ['status', 'eigenaar', 'werkvorm', 'budgetCenten']);
    log(w, actor, 'praktijk-vraag', p.id);
    return { ok: true, projectId: p.id };
  }
  function stap(w, actor, b) {
    const p = V.project(w, b.projectId);
    if (!p) return V.fout('Deze vraag is niet gevonden.', 404);
    const x = V.details(w, p);
    if (b.versie !== x.versie) return V.fout('Dit werk is gewijzigd. Vernieuw eerst het overzicht.', 409);
    if (b.stap === 'extern') return extern(w, actor, p, b);
    const reden = V.tekst(b.toelichting, 500);
    const van = x.stand;
    if (b.stap === 'voorstel' && ['vraag', 'voorstel', 'afgewezen'].includes(van)) {
      if (!reden || !V.prijs(b.bedragMinor)) return V.fout('Beschrijf wat u afspreekt en het totale bedrag (nul mag).');
      if (x.prijswijze === 'kosteloos' && b.bedragMinor !== 0) return V.fout('Kosteloos aanbod houdt een bedrag van nul.');
      x.voorstel = reden; x.bedragMinor = b.bedragMinor; x.stand = 'voorstel';
      // Een veranderd voorstel trekt alle oude gastlinks in.
      for (const d of Object.values(w.praktijkDelen || {})) if (d.projectId === p.id) d.ingetrokken = true;
    } else if (b.stap === 'akkoord' && van === 'voorstel') {
      if (!reden) return V.fout('Noteer hoe en wanneer de klant akkoord gaf.');
      x.akkoord = { bron: 'handmatig-vastgelegd', toelichting: reden, door: actor.id || actor.naam, at: nu() };
      x.stand = 'bevestigd';
    } else if (b.stap === 'plannen' && ['bevestigd', 'ingepland'].includes(van)) {
      if (!V.datum(b.datum) || !V.tekst(b.wie, 80) || !V.tekst(b.locatie, 120))
        return V.fout('Kies datum, uitvoerder en locatie (ook online of bij de klant).');
      const oudeTaak = V.pak(w.taken, x.taakId);
      if (oudeTaak && oudeTaak.kolom === 'klaar') return V.fout('Dit werk is al uitgevoerd; controleer de bestaande taak.', 409);
      x.datum = b.datum; x.locatie = V.tekst(b.locatie, 120); x.stand = 'ingepland';
      const t = oudeTaak || { id: rid(8), projectId: p.id, ouderId: null, titel: p.naam,
        kolom: 'te doen', prioriteit: 'normaal', wachtOp: [], uren: 0, urenlijst: [], at: nu() };
      t.deadline = b.datum; t.wie = V.tekst(b.wie, 80);
      (w.taken || (w.taken = {}))[t.id] = t; x.taakId = t.id;
    } else if (b.stap === 'uitvoeren' && van === 'ingepland') {
      if (!reden) return V.fout('Beschrijf wat er daadwerkelijk is uitgevoerd.');
      const t = V.pak(w.taken, x.taakId);
      if (!t) return V.fout('De geplande taak ontbreekt. Plan het werk opnieuw.', 409);
      if ((t.wachtOp || []).some(id => !V.pak(w.taken, id))) return V.fout('Een afhankelijkheid ontbreekt. Controleer de planning.', 409);
      const open = Object.values(w.taken || {}).filter(z =>
        (z.projectId === p.id && z.id !== t.id || (t.wachtOp || []).includes(z.id)) && !z.geannuleerd && z.kolom !== 'klaar');
      if (open.length) return V.fout('Rond eerst de overige taken en afhankelijkheden af.', 409);
      t.kolom = 'klaar'; t.klaarAt = nu(); t.klaarDoor = actor.id || actor.naam;
      x.uitvoering = { toelichting: reden, door: actor.id || actor.naam, at: nu() }; x.stand = 'uitgevoerd';
    } else if (b.stap === 'afronden' && van === 'uitgevoerd') {
      if (!reden || !['extern-vastgelegd', 'geen-betaling'].includes(b.administratie))
        return V.fout('Kies de administratieve afhandeling en noteer een verwijzing of uitleg.');
      if (b.administratie === 'geen-betaling' && x.bedragMinor !== 0)
        return V.fout('Bij dit bedrag is een administratieve verwijzing nodig. Dit markeert niets als betaald.');
      if (Object.values(w.taken || {}).some(t => t.projectId === p.id && !t.geannuleerd && t.kolom !== 'klaar'))
        return V.fout('Er staan nog taken open.', 409);
      x.administratie = { soort: b.administratie, verwijzing: reden, door: actor.id || actor.naam, at: nu() };
      x.stand = 'afgerond';
    } else if (b.stap === 'annuleren' && !['afgerond', 'geannuleerd', 'uitgevoerd'].includes(van)) {
      if (x.betalingRef && !['GEWEIGERD','GEANNULEERD','TERUGBETAALD'].includes(kern?.betaalWaarheid?.van(x.betalingRef)?.status))
        return V.fout('Stem de gestarte betaling eerst af. Een annulering is geen terugbetaling.',409);
      if (Object.values(w.taken || {}).some(t => t.projectId === p.id && t.externeAfspraak?.herkomst === 'rtg-aanvraag' &&
          !['geannuleerd', 'afgewezen', 'ingetrokken'].includes(t.externeAfspraak.stand)))
        return V.fout('Trek open leveranciersaanvragen in en laat bevestigde boekingen eerst annuleren. Uitgevoerd werk vraagt afhandeling.',409);
      if (!reden) return V.fout('Noteer de reden van annulering.');
      x.stand = 'geannuleerd'; x.annulering = { reden, door: actor.id || actor.naam, at: nu() };
      for (const d of Object.values(w.praktijkDelen || {})) if (d.projectId === p.id) d.ingetrokken = true;
    } else return V.fout('Deze stap past niet bij de actuele stand.', 409);
    const kans = V.pak(w.kansen, p.praktijkRef);
    kans.bedragCenten = x.valuta === 'EUR' ? x.bedragMinor : null;
    kans.fase = x.stand === 'vraag' ? 'lead' : x.stand === 'voorstel' ? 'offerte' :
      ['afgewezen', 'geannuleerd'].includes(x.stand) ? 'verloren' : 'gewonnen';
    if (x.stand === 'geannuleerd') for (const t of Object.values(w.taken || {}))
      if (t.projectId === p.id && t.kolom !== 'klaar') t.geannuleerd = true;
    x.versie++;
    if (x.stand === 'afgerond' || x.stand === 'geannuleerd') werkVeld(w, 'project', p,
      { status: x.stand === 'afgerond' ? 'klaar' : 'geannuleerd' },
      { actor: actor.id || actor.naam, bron: 'werk/praktijk', reden });
    werkFeit(w, 'project', p.id, 'praktijk-' + b.stap, { actor: actor.id || actor.naam, bron: 'werk/praktijk' },
      { van, naar: x.stand, versie: x.versie });
    log(w, actor, 'praktijk-' + b.stap, p.id);
    return { ok: true, projectId: p.id, versie: x.versie };
  }
  return { vraag, stap };
};
