/* ============================================================================
   RTG Werk OS (deellaag): WAT GEBEURT ER ALS -- de gevolgsimulatie.

   WAAROM DIT GEEN WRAPPER OM HET DOSSIER IS, en dat is de hele
   bestaansreden. `/api/bedrijf/dossier` beantwoordt een vraag over een OBJECT:
   wat weten we ervan, wie verwijst ernaar, wat is de tijdlijn. Dat is niet
   dezelfde vraag als deze. Wie overweegt een medewerker uit dienst te zetten,
   wil niet weten wie er naar hem verwijst -- hij wil weten wat er NIET AF komt
   als hij het doet: welke taken zonder eigenaar achterblijven, welke andere
   taken daarop wachten, en welk besluit blijft hangen omdat de stem ontbreekt.

   Het verschil zit in de richting. Het dossier kijkt naar binnen (wat hoort bij
   dit object); dit kijkt vooruit (wat breekt er als het weg is). Daarom zit de
   waarde niet in `raakt` maar in `blijftOpen`: de eerste lijst is te maken uit
   de graaf, de tweede vraagt dat je per soort weet wat "af" betekent.

   DRIE REGELS

   1. SIMULEREN VERANDERT NIETS. Geen enkele tak hier schrijft; er is niet eens
      een save(). Een simulatie met een bijwerking is de duurste soort bug, want
      juist deze knop drukt iemand in om te KIJKEN.
   2. WAT NIET GEREKEND WORDT, STAAT ER MET NAAM. Kosten, contracten, controls
      en een rollback bestaan hier niet, en een simulatie die daarover zwijgt
      leest als een volledige impactanalyse. Ze staan in `nietGerekend`.
   3. HIJ VOLGT DE RECHTEN. Wie het recht `mens` mist, ziet de mensenkant niet;
      wie `project` mist, ziet de takenkant niet. Zo blijft dit dezelfde
      werkruimte als de rest van het Werk OS en geen achterdeur eromheen.
   ========================================================================== */
'use strict';

const NIET_GEREKEND = [
  { wat: 'kosten', reden: 'Er is geen kostprijs per werkruimte-object, dus elk bedrag hier zou verzonnen zijn.' },
  { wat: 'contracten', reden: 'De contractbibliotheek weet niet welk contract aan welk project of welke persoon hangt.' },
  { wat: 'controls', reden: 'CONTROLS.json meet het platform en niet de objecten van een klant.' },
  { wat: 'terugdraaien', reden: 'Er is geen rollback: wat u hierna met de hand doet, draait u ook met de hand terug.' }
];

module.exports = (sctx) => {
  const { app, schoon, werkPoort, eigenVeld } = sctx;

  const leeg = (o) => Object.values(o || {});
  const open = (t) => t && t.kolom !== 'klaar' && t.kolom !== 'afgerond';

  /* Bij hem: op ID als dat er is, en alleen dan op naam als er GEEN id is
     vastgelegd (wieis.js zet er geen als de naam dubbel of onbekend is). Zo
     wint de sleutel altijd van de naam, en verdwijnt een rij van voor die
     laag toch niet uit de telling. */
  const bijHem = (rij, l, veld) => rij[veld + 'Id'] ? rij[veld + 'Id'] === l.id : rij[veld] === l.naam;

  /* ---------- iemand gaat uit dienst ---------- */
  function lidWeg(w, rechten, lidId) {
    const l = eigenVeld(w.leden || {}, lidId);
    if (!l) return { error: 'Dat lid kennen we niet.', status: 404 };
    const mag = (r) => rechten === true || rechten.includes(r);
    const raakt = [];
    const blijftOpen = [];

    if (mag('mens')) {
      raakt.push({ soort: 'lid', aantal: 1, wat: l.naam + ' verliest zijn sleutel en zijn rollen (' +
        ((l.rollen || []).map(r => r.id).join(', ') || 'geen') + ')' });
    }

    if (mag('project')) {
      const vanHem = leeg(w.taken).filter(t => open(t) && bijHem(t, l, 'wie'));
      raakt.push({ soort: 'taak', aantal: vanHem.length, wat: 'staan op zijn naam en zijn niet af' });
      if (vanHem.length) blijftOpen.push({ soort: 'taak', aantal: vanHem.length,
        wat: 'zonder eigenaar', voorbeelden: vanHem.slice(0, 5).map(t => t.titel) });

      /* De echte pijn zit een stap verder: taken van ANDEREN die wachten op een
         taak van hem. Die staan stil zonder dat iemand ziet waarom. */
      const zijnIds = new Set(vanHem.map(t => t.id));
      const wachtend = leeg(w.taken).filter(t => open(t) && (t.wachtOp || []).some(x => zijnIds.has(x)));
      if (wachtend.length) blijftOpen.push({ soort: 'taak', aantal: wachtend.length,
        wat: 'van anderen, wachtend op werk dat nu geen eigenaar heeft',
        voorbeelden: wachtend.slice(0, 5).map(t => t.titel) });
    }

    if (mag('service')) {
      /* De behandelaar is `wie`, niet `door` -- `door` is wie de melding
         AANMAAKTE, en dat is meestal de servicebalie en niet de eigenaar. Een
         ticket heet `onderwerp` en niet `titel`. */
      const tickets = leeg(w.tickets).filter(t => t.status !== 'gesloten' && bijHem(t, l, 'wie'));
      if (tickets.length) blijftOpen.push({ soort: 'ticket', aantal: tickets.length,
        wat: 'open, en hij was de behandelaar', voorbeelden: tickets.slice(0, 5).map(t => t.onderwerp) });
    }

    if (mag('kennis')) {
      /* Een kennisartikel draagt alleen een eigenaarsNAAM en geen id (kennis.js
         gebruikt zetWie() niet). Dit is dus de naamgok uit wieis.js, en dat
         staat met `opNaam` in het antwoord in plaats van dat het verzwegen
         wordt: twee mensen die Pia heten leveren hier elkaars artikelen op. */
      const artikelen = leeg(w.kennis).filter(a => a.eigenaar === l.naam && !a.vervallen);
      if (artikelen.length) blijftOpen.push({ soort: 'kennisartikel', aantal: artikelen.length,
        wat: 'hebben hem als eigenaar; zonder eigenaar veroudert een artikel ongemerkt',
        opNaam: true, voorbeelden: artikelen.slice(0, 5).map(a => a.titel) });
    }

    if (mag('besluit')) {
      const stemmend = leeg(w.besluiten).filter(b => b.status === 'stemmen' &&
        !(b.stemmen || []).some(s => s.wieId === l.id || s.door === l.naam));
      if (stemmend.length) blijftOpen.push({ soort: 'besluit', aantal: stemmend.length,
        wat: 'in stemming waar hij nog niet heeft gestemd', voorbeelden: stemmend.slice(0, 5).map(b => b.titel) });
    }

    return { ok: true, wijziging: 'lid.uit-dienst', over: { soort: 'lid', id: l.id, naam: l.naam }, raakt, blijftOpen };
  }

  /* ---------- een project stopt ---------- */
  function projectWeg(w, rechten, projectId) {
    if (!(rechten === true || rechten.includes('project')))
      return { error: 'Daar heeft u het recht "project" voor nodig.', status: 403, recht: 'project' };
    const p = eigenVeld(w.projecten || {}, projectId);
    if (!p) return { error: 'Dat project kennen we niet.', status: 404 };

    const taken = leeg(w.taken).filter(t => t.projectId === p.id);
    const openTaken = taken.filter(open);
    const ids = new Set(taken.map(t => t.id));
    const buiten = leeg(w.taken).filter(t => t.projectId !== p.id && open(t) && (t.wachtOp || []).some(x => ids.has(x)));

    const blijftOpen = [];
    if (openTaken.length) blijftOpen.push({ soort: 'taak', aantal: openTaken.length,
      wat: 'in dit project en niet af', voorbeelden: openTaken.slice(0, 5).map(t => t.titel) });
    if (buiten.length) blijftOpen.push({ soort: 'taak', aantal: buiten.length,
      wat: 'BUITEN dit project die op werk hierbinnen wachten -- die vallen stil',
      voorbeelden: buiten.slice(0, 5).map(t => t.titel) });

    return { ok: true, wijziging: 'project.stop', over: { soort: 'project', id: p.id, naam: p.naam },
      raakt: [{ soort: 'taak', aantal: taken.length, wat: 'horen bij dit project' }], blijftOpen };
  }

  /* ---------- de hele werkruimte gaat dicht ---------- */
  function ruimteWeg(w, rechten) {
    const mag = (r) => rechten === true || rechten.includes(r);
    const actief = leeg(w.leden).filter(l => l.status === 'actief');
    const raakt = [{ soort: 'lid', aantal: actief.length, wat: 'verliezen hun toegang' }];
    const blijftOpen = [];
    const tel = (recht, bak, filter, wat) => {
      if (!mag(recht)) return;
      const n = leeg(w[bak]).filter(filter).length;
      raakt.push({ soort: bak, aantal: leeg(w[bak]).length, wat: 'gaan mee in de uitvoer' });
      if (n) blijftOpen.push({ soort: bak, aantal: n, wat });
    };
    tel('project', 'taken', open, 'niet af');
    tel('service', 'tickets', t => t.status !== 'gesloten', 'open');
    tel('besluit', 'besluiten', b => b.status === 'advies' || b.status === 'stemmen', 'nog niet genomen');
    tel('recht', 'contracten', c => c.status === 'actief', 'lopen nog');
    return { ok: true, wijziging: 'werkruimte.sluiten', over: { soort: 'werkruimte', id: w.code, naam: w.naam },
      raakt, blijftOpen };
  }

  app.post('/api/bedrijf/gevolg', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    const rechten = g.directie ? true : g.rechten;
    const wijziging = schoon(req.body.wijziging, 40);

    let uit;
    if (wijziging === 'lid.uit-dienst') uit = lidWeg(g.w, rechten, String(req.body.lidId || ''));
    else if (wijziging === 'project.stop') uit = projectWeg(g.w, rechten, String(req.body.projectId || ''));
    else if (wijziging === 'werkruimte.sluiten') uit = ruimteWeg(g.w, rechten);
    else return res.status(400).json({ error: 'Kies een wijziging: lid.uit-dienst, project.stop of werkruimte.sluiten.',
      kan: ['lid.uit-dienst', 'project.stop', 'werkruimte.sluiten'],
      let: 'De lijst is kort en gesloten: per wijziging moet iemand weten wat "af" betekent voor elke soort, en dat is niet uit de graaf af te leiden.' });

    if (uit.error) return res.status(uit.status || 400).json(uit);
    res.json(Object.assign(uit, {
      nietGerekend: NIET_GEREKEND,
      let: 'Er is NIETS veranderd; dit is een vooruitblik. `blijftOpen` is het deel dat ertoe doet: ' +
        'wat er na deze wijziging zonder eigenaar of zonder afronding achterblijft. ' +
        'Wat er niet in staat, staat in nietGerekend.'
    }));
  });
};
