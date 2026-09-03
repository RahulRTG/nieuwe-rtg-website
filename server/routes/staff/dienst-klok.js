/* Staff (deelmodule): IN- EN UITKLOKKEN, DE PAUZE, EN DE AANWEZIGHEID.

   Afgesplitst van ./dienst.js toen dat over de leesgrens ging, en de naad lag er
   al: daar staat wat er gebeurt als je er NIET bent (verlof, ziekmelden, wat kan
   ik nog wel, de vertrouwenspersoon), hier staat wat er gebeurt als je er WEL
   bent. Sinds PLAATS.md fase 2 hoort daar ook bij of je toestel binnen het hek
   van de zaak stond -- en dat is precies waarom deze twee onderwerpen uit elkaar
   horen: het een gaat over rechten bij afwezigheid, het ander over aanwezigheid.

   Krijgt dezelfde gedeelde context als ./dienst.js. */
module.exports = (actx) => {
  const { app, crypto, db, klokVan, logActivity, save, supplierAuth, sseToSupplier,
    werkbeleidPauzeStand, WERKBELEID_PAUZE_MINUTEN, plaats, codenaamVan } = actx;

/* AANWEZIGHEID BIJ DE PRIKKLOK -- zonder volgen (PLAATS.md fase 2).

   Wat hier gebeurt, en het is bewust weinig: bij het klokken vragen we de
   plaatslaag of het TOESTEL van deze mens op dat moment binnen het hek van de
   zaak stond, en dat antwoord komt als feit op de klokregel te staan. Meer niet.

   DE ARCHITECTUUR IS DE HELE TRUC: je telefoon neemt waar, de kassa vraagt. Het
   toestel draait de hek-motor onder de MEDEWERKER zijn eigen ledenaccount
   (codenaam), en deze route -- die op een ZAAK-inlog draait -- stelt alleen een
   vraag. De twee sessies raken elkaar nooit, en er komt geen coördinaat langs.
   Wat de werkgever ziet is binnen of buiten met een tijd, en dat is grens 4 uit
   PLAATS.md.

   DRIE UITKOMSTEN, NOOIT TWEE. 'bevestigd' (het toestel keek en je stond er),
   'niet bevestigd' (het keek en je stond er niet) en 'niet gemeten' (er keek
   niemand: geen venster, geen gekoppeld ledenaccount, of een toestel dat niets
   afgaf). Die derde weglaten zou van elke ongemeten inklok een verdachte inklok
   maken, en juist dat is wat een aanwezigheidslaag tot een beschuldigingslaag
   maakt.

   EN HET BLOKKEERT NIETS. Inklokken buiten het hek werkt gewoon en hoort te
   werken -- er zijn honderd goede redenen om elders te beginnen. Het werkwoord
   van deze laag is klaarzetten, nooit doen (PLAATS.md par. 3): de regel draagt
   het feit, een mens leest het. */
function plekBijKlok(req) {
  /* De plaatslaag MAG ontbreken: een kaal testproces mount hem niet, en dan is
     "niet gemeten" het juiste antwoord in plaats van een fout. */
  if (!plaats || typeof plaats.plaatsBijZaak !== 'function') return null;
  // geen gekoppeld ledenaccount = geen codenaam = niemand die iets waarnam
  if (!req.actor.lidKey || typeof codenaamVan !== 'function') return { gemeten: false, reden: 'geen ledenaccount' };
  try {
    const r = plaats.plaatsBijZaak(codenaamVan(req.actor.lidKey), req.supplier.code, 'dienst');
    return { bevestigd: !!r.bevestigd, gemeten: !!r.gemeten, sinds: r.sinds || null, reden: r.reden || null };
  } catch (e) { return { gemeten: false, reden: 'plaatslaag niet bereikbaar' }; }
}

app.post('/api/staff/clock', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const lijst = db.data.klok[req.supplier.code] = db.data.klok[req.supplier.code] || [];
  const open = lijst.find(e => e.staffId === req.actor.staffId && !e.out);
  const plek = plekBijKlok(req);
  let actie;
  if (open) { open.out = new Date().toISOString(); if (plek) open.plekUit = plek; actie = 'uit'; }
  else { lijst.unshift({ id: crypto.randomBytes(4).toString('hex'), staffId: req.actor.staffId, name: req.actor.name, in: new Date().toISOString(), out: null, plekIn: plek }); actie = 'in'; }
  db.data.klok[req.supplier.code] = lijst.slice(0, 4000);
  save();
  logActivity(req.supplier.code, req.actor, 'klokte ' + actie);
  sseToSupplier(req.supplier.code, 'sync', { scope: 'klok' });
  /* De plaats-uitspraak gaat MEE IN HET ANTWOORD en niet alleen de klokregel in.
     Wie klokt hoort meteen te zien wat er over hem is vastgelegd -- dat is
     hetzelfde beginsel als het inzagejournaal: geen enkele vastlegging over een
     mens waar die mens niet bij kan. klokVan() telt alleen uren, dus daar past
     het niet in. */
  res.json({ ok: true, actie, plek, klok: klokVan(req.supplier.code, req.actor.staffId) });
});

/* PAUZE. Zolang je ingeklokt staat houdt het werkbeleid van je werkgever
   functies dicht (kern/lidboard/werkbeleid.js). In je pauze niet: dan is je
   pas weer van jou. De armslag is 45 minuten per dienst, samen voor alle
   pauzes -- de rookpauze en de grote pauze komen uit dezelfde pot.

   Wat hier NIET gebeurt: meten wat je in die minuten doet. De teller loopt op
   pauzeminuten, punt. Zou hij op je gebruik van De Salon lopen, dan hield dit
   systeem precies bij hoeveel minuten je op sociale media zat, en dat is de
   meting waar dat hele beleid tegen beschermt.

   Pauze nemen mag altijd, ook als de 45 minuten op zijn: je pauzerecht is niet
   van RTG. Wat er dan gebeurt is alleen dat het beleid weer geldt. */
app.post('/api/staff/pauze', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  /* KIJKEN EN NIET NEERZETTEN. Een pauze hangt aan een OPEN dienst en maakt er
     nooit een; wie hier geen klokboek heeft, heeft ook geen dienst en krijgt een
     409. Zou de la hier lui worden aangemaakt (`= ... || []`), dan liet die 409
     een leeg klokboek achter bij een zaak waar nog nooit iemand klokte -- en dan
     zeggen de statuscode en de opslag twee verschillende dingen over hetzelfde
     verzoek. De Array.isArray hieronder ving het ontbreken al op. */
  const lijst = db.data.klok[req.supplier.code];
  const dienst = Array.isArray(lijst) ? lijst.find(e => e.staffId === req.actor.staffId && e.in && !e.out) : null;
  if (!dienst) return res.status(409).json({ error: 'Je staat niet ingeklokt; een pauze hoort bij een dienst.' });
  dienst.pauzes = dienst.pauzes || [];
  const open = dienst.pauzes.find(p => p && p.in && !p.uit);
  let actie;
  if (open) { open.uit = new Date().toISOString(); actie = 'uit'; }
  else { dienst.pauzes.push({ in: new Date().toISOString(), uit: null }); actie = 'in'; }
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'klok' });
  const stand = werkbeleidPauzeStand(req.supplier.code, req.actor.staffId);
  res.json({ ok: true, actie, pauze: stand, budgetMinuten: WERKBELEID_PAUZE_MINUTEN });
});
};
