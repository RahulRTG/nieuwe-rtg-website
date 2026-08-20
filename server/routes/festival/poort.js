/* Routes "festival" (deelmodule): DE POORT EN DE COCKPIT.

   Afgesplitst van ../festival.js op een echte naad: daar wordt een festival
   INGERICHT (door een manager, dagen van tevoren), hier wordt het GEDRAAID
   (door de mens bij het hek, duizenden keren per uur).

   DE SERVERKLOK STEMPELT EEN SCAN, EN DAT IS EEN VEILIGHEIDSKEUZE.

   De kern (kern/festival/toegang.js) neemt een datum en een tijd aan, want die
   moet ook een offline bundel van gisteren kunnen verwerken. Een LIVE scan mag
   die twee nooit uit het lichaam halen: wie het tijdstip mag meesturen, kan een
   pas laten binnenkomen op een moment dat hem uitkomt -- een verlopen dagkaart
   die "13:00 gisteren" claimt, of een backstage-recht dat om 20:00 nog binnen
   het venster van 13:00-19:00 valt. Het venster, de dag en de curfew zijn dan
   allemaal zo weg.

   Dus: /scan stempelt zelf, /scan/bundel niet. Dat verschil is precies de
   reden dat de bundel zijn regels als `offline` markeert en achteraf reconcilieert
   in plaats van te doen alsof er niets gebeurd is.

   DE KLOK IS DIE VAN HET HUIS (UTC via toISOString), gelijk aan
   routes/supplier/tickets.js en de rest. Een festival in lokale tijd -- met een
   curfew om 01:00 Amsterdam -- vraagt kern/tijdzone.js en is een eigen klus;
   het staat hier opgeschreven zodat niemand het voor geregeld aanziet
   (LAT-regel 6). */
'use strict';

module.exports = (kern, deur) => {
  const { app, festival, supplierAuth } = kern;
  const { mijn, editieVan, geenFestival, stuur } = deur;

  const nu = () => {
    const t = new Date().toISOString();
    return { datum: t.slice(0, 10), tijd: t.slice(11, 16) };
  };

  /* ---- de poort ----
     Geen managerOnly: dit is het werk van de mens bij het hek. Wel supplierAuth,
     dus het personeelslid is ingelogd op deze zaak en zijn naam gaat mee de scan
     in -- wie wie binnenliet is achteraf een vraag die gesteld wordt. */
  app.post('/api/festival/scan', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const b = req.body || {};
    const r = festival.scan(f.id, editieVan(req), {
      code: b.code, plek: b.plek, poort: b.poort, richting: b.richting,
      bewijs: Array.isArray(b.bewijs) ? b.bewijs : [],
      door: req.actor && req.actor.name,
      ...nu()                                   // NA de body: het lichaam mag de klok niet zetten
    });
    stuur(res, r);
  });

  /* ---- de offline bundel ----
     Hier komen de tijden WEL uit het lichaam, want ze komen van een hek dat
     zonder verbinding stond. Ze worden als `offline` bewaard, de vroegste wint,
     en de rest komt terug als dubbel. Er wordt niets teruggedraaid: die mensen
     staan al binnen (kern/festival/toegang.js). */
  app.post('/api/festival/scan/bundel', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const rijen = Array.isArray((req.body || {}).scans) ? (req.body || {}).scans : [];
    const doorNaam = req.actor && req.actor.name;
    stuur(res, festival.scanBundel(f.id, editieVan(req), rijen.map(r => ({ ...r, door: doorNaam }))));
  });

  /* ---- de cockpit ----
     Lezen mag elk personeelslid: een barmedewerker die ziet dat zijn zone
     volloopt, is precies het punt. Wat er NIET bij zit is een handeling; deze
     laag stelt alleen vast (FESTIVAL.md par. 4). */
  app.post('/api/festival/bezetting', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.bezetting(f.id, editieVan(req), String((req.body || {}).dag || '')));
  });

  app.post('/api/festival/uitzonderingen', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const b = req.body || {};
    stuur(res, festival.uitzonderingen(f.id, editieVan(req),
      { dag: b.dag, venster: b.venster, vooruit: b.vooruit, ...nu() }));
  });

  /* De ene leesbare zin (kern/festival/index.js). Staat er als eigen ingang
     omdat een scherm anders zijn eigen samenvatting gaat maken, en dan lopen er
     twee cijfers rond over hetzelfde terrein. */
  app.post('/api/festival/stand', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.festivalStand(f.id, editieVan(req), { dag: String((req.body || {}).dag || ''), ...nu() }));
  });
};
