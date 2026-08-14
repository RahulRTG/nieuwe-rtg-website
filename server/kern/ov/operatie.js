/* Business Private-operaties. Een operatie is een afgeschermd draaiboek van
   segmenten en rollen. Automatisering maakt uitsluitend concepten. Activeren
   vraagt een korte, eenmalige bevestigingscode; boeken en betalen blijven in
   hun bestaande afzonderlijke flows. */
const MODI = {
  chauffeur: { naam: 'Executive chauffeur', icoon: '◆', groep: 'weg' },
  konvooi: { naam: 'Konvooi', icoon: '◈', groep: 'weg' },
  ov: { naam: 'Openbaar vervoer', icoon: '◎', groep: 'publiek' },
  trein: { naam: 'Trein', icoon: '═', groep: 'spoor' },
  lijnvlucht: { naam: 'Lijnvlucht', icoon: '△', groep: 'lucht' },
  privejet: { naam: 'Privéjet', icoon: '✦', groep: 'lucht' },
  helikopter: { naam: 'Helikopter', icoon: '⌘', groep: 'lucht' },
  veerboot: { naam: 'Veerboot', icoon: '≋', groep: 'water' },
  jacht: { naam: 'Jacht/tender', icoon: '≈', groep: 'water' },
  bus: { naam: 'Team- of delegatiebus', icoon: '▤', groep: 'groep' },
  medisch: { naam: 'Medisch vervoer', icoon: '+', groep: 'zorg' },
  bagage: { naam: 'Bagage en materiaal', icoon: '▣', groep: 'logistiek' }
};
const ROLLEN = ['hoofdgast', 'familie', 'assistent', 'manager', 'beveiliging', 'medisch', 'crew', 'bagage'];
const SEGMENT_KETEN = ['voorbereid', 'aangevraagd', 'offerte', 'bevestigd', 'onderweg', 'afgerond'];

module.exports = ctx => {
  const { db, save, crypto, schoon } = ctx;
  const nu = () => new Date().toISOString();
  function ensure() { if (!Array.isArray(db.data.ovOperaties)) db.data.ovOperaties = []; }
  const voor = key => (ensure(), db.data.ovOperaties.filter(o => o.key === key));
  const beeld = o => ({ id: o.id, naam: o.naam, status: o.status, van: o.van, naar: o.naar, vertrek: o.vertrek,
    aangemaakt: o.aangemaakt, geactiveerd: o.geactiveerd || null, personen: o.personen, rollen: o.rollen,
    segmenten: o.segmenten, privacy: o.privacy, veiligheid: o.veiligheid });
  function herbereken(o) {
    const actief = o.segmenten.filter(s => s.status !== 'geannuleerd');
    if (!actief.length) o.status = 'geannuleerd';
    else if (actief.every(s => s.status === 'afgerond')) o.status = 'afgerond';
    else if (actief.some(s => s.status === 'onderweg')) o.status = 'onderweg';
    else if (actief.every(s => ['bevestigd', 'afgerond'].includes(s.status))) o.status = 'gereed';
    else if (actief.some(s => ['aangevraagd', 'offerte', 'bevestigd'].includes(s.status))) o.status = 'in-regie';
  }

  function overzicht(key, tier) {
    if (tier !== 'business') return { status: 403, error: 'Private operaties horen bij Business.' };
    return { status: 200, modi: MODI, rollen: ROLLEN, operaties: voor(key).slice(-12).reverse().map(beeld),
      grenzen: ['Concepten boeken of betalen niets.', 'Activeren vraagt de code die alleen op dit scherm verschijnt.',
        'De Control Tower ziet codenamen en operationele aantallen, geen privéprofiel.', 'Beveiliging en medische besluiten blijven mensenwerk.'] };
  }
  function concept(key, tier, data) {
    if (tier !== 'business') return { status: 403, error: 'Private operaties horen bij Business.' };
    ensure();
    const van = schoon(data.van, 80), naar = schoon(data.naar, 80);
    if (!van || !naar) return { status: 400, error: 'Geef vertrek en bestemming.' };
    const personen = Math.min(120, Math.max(1, Math.round(Number(data.personen) || 1)));
    const gekozen = (Array.isArray(data.modi) ? data.modi : ['chauffeur']).filter(m => MODI[m]).slice(0, 8);
    if (!gekozen.length) return { status: 400, error: 'Kies minstens één vervoersvorm.' };
    const vertrek = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(data.vertrek || '')) ? String(data.vertrek).slice(0, 16) : null;
    const rollen = (Array.isArray(data.rollen) ? data.rollen : ['hoofdgast']).filter(r => ROLLEN.includes(r));
    if (!rollen.includes('hoofdgast')) rollen.unshift('hoofdgast');
    const segmenten = gekozen.map((m, i) => ({ id: 's' + (i + 1), volgorde: i + 1, modus: m, naam: MODI[m].naam,
      status: 'voorbereid', van: i === 0 ? van : 'Beveiligde overdracht ' + i,
      naar: i === gekozen.length - 1 ? naar : 'Beveiligde overdracht ' + (i + 1),
      bevestigingNodig: true, leverancier: null, prijs: null }));
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    const o = { id: 'op-' + crypto.randomBytes(5).toString('hex'), key, naam: schoon(data.naam, 60) || ('Reis naar ' + naar),
      status: 'concept', van, naar, vertrek, personen, rollen, segmenten, aangemaakt: nu(),
      privacy: { codenaam: true, discreteMeldingen: true, locatieNaRitWissen: true, needToKnow: true },
      veiligheid: { menselijkeRegie: true, reserveplan: data.reserveplan !== false, betalingBevestigen: true },
      bevestigHash: crypto.createHash('sha256').update(code).digest('hex'), codeTot: Date.now() + 10 * 60 * 1000 };
    db.data.ovOperaties.push(o); if (db.data.ovOperaties.length > 2000) db.data.ovOperaties = db.data.ovOperaties.slice(-2000);
    save();
    return { status: 200, ok: true, operatie: beeld(o), bevestigCode: code, geldigS: 600,
      melding: 'Concept gereed. Er is nog niets geboekt of betaald.' };
  }
  function bevestig(key, tier, data) {
    if (tier !== 'business') return { status: 403, error: 'Private operaties horen bij Business.' };
    const o = voor(key).find(x => x.id === String(data.id || ''));
    if (!o) return { status: 404, error: 'Operatie niet gevonden.' };
    if (o.status !== 'concept') return { status: 409, error: 'Deze operatie is al ' + o.status + '.' };
    if (Date.now() > o.codeTot) return { status: 410, error: 'De bevestigingscode is verlopen. Maak een nieuw concept.' };
    const hash = crypto.createHash('sha256').update(String(data.code || '').trim().toUpperCase()).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(o.bevestigHash))) return { status: 403, error: 'De bevestigingscode klopt niet.' };
    o.status = 'gereed-voor-boeken'; o.geactiveerd = nu(); delete o.bevestigHash; delete o.codeTot; save();
    return { status: 200, ok: true, operatie: beeld(o), melding: 'Regie geactiveerd. Elk segment vraagt nog afzonderlijk akkoord voor boeken en betalen.' };
  }
  function annuleer(key, tier, data) {
    if (tier !== 'business') return { status: 403, error: 'Private operaties horen bij Business.' };
    const o = voor(key).find(x => x.id === String(data.id || ''));
    if (!o) return { status: 404, error: 'Operatie niet gevonden.' };
    if (o.status === 'geannuleerd') return { status: 409, error: 'Deze operatie is al geannuleerd.' };
    o.status = 'geannuleerd'; o.geannuleerd = nu(); delete o.bevestigHash; delete o.codeTot; save();
    return { status: 200, ok: true, operatie: beeld(o) };
  }
  function segment(key, tier, data) {
    if (tier !== 'business') return { status: 403, error: 'Private operaties horen bij Business.' };
    const o = voor(key).find(x => x.id === String(data.id || ''));
    if (!o) return { status: 404, error: 'Operatie niet gevonden.' };
    if (['concept', 'geannuleerd', 'afgerond'].includes(o.status)) return { status: 409, error: 'Activeer eerst de regie of kies een actieve operatie.' };
    const s = o.segmenten.find(x => x.id === String(data.segmentId || ''));
    if (!s) return { status: 404, error: 'Segment niet gevonden.' };
    const actie = String(data.actie || '');
    if (actie === 'vraag-aan') {
      if (s.status !== 'voorbereid') return { status: 409, error: 'Dit segment is al ' + s.status + '.' };
      if (data.akkoord !== true) return { status: 409, error: 'Bevestig dat RTG dit segment operationeel mag aanvragen.' };
      s.status = 'aangevraagd'; s.aangevraagd = nu(); s.ref = 'MOVE-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      s.bevestigingNodig = false; s.betaald = false; s.prijs = null;
    } else if (actie === 'annuleer') {
      if (['onderweg', 'afgerond'].includes(s.status)) return { status: 409, error: 'Een lopend of afgerond segment kan niet worden geannuleerd.' };
      s.status = 'geannuleerd'; s.geannuleerd = nu();
    } else return { status: 400, error: 'Onbekende segmentactie.' };
    herbereken(o); save();
    return { status: 200, ok: true, operatie: beeld(o), segment: s,
      melding: actie === 'vraag-aan' ? 'Operationele aanvraag verstuurd. Een offerte of betaling volgt nooit zonder nieuw akkoord.' : 'Segment geannuleerd.' };
  }
  return { ovOperatieOverzicht: overzicht, ovOperatieConcept: concept, ovOperatieBevestig: bevestig,
    ovOperatieAnnuleer: annuleer, ovOperatieSegment: segment, OV_SEGMENT_KETEN: SEGMENT_KETEN };
};
