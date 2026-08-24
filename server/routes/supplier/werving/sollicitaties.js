/* Supplier-werving (deelmodule): de sollicitatiestroom: vacature, solliciteren,
   het besluit (met automatische uitnodiging via maakInvite uit de personeels-
   laag) en de sollicitatiechat. Gemount vanuit routes/supplier/werving.js. */
const { eigenVeld } = require('../../../kern/util');
const { datum: klokDatum } = require('../../../lib/klok');
const { vulVacature } = require('./vacature');
module.exports = (wctx) => {
  const { kern, maakKassacode, invitesVan, findSupplierByName, maakInvite, neemAan, wervingsLink } = wctx;
  const { VAC_SOORTEN, app, applyChatVertaald, chatStuur, crypto, db, ensureApplyChat, talen,
          findSupplier, logActivity, managerOnly, notify, notifyApplicant, notifySupplier, save, schoon,
          sseToOffice, sseToSupplier, supplierAuth } = kern;
app.post('/api/supplier/apply', (req, res) => {
  const s = findSupplier(req.body.code);
  if (!s) return res.status(404).json({ error: 'Bedrijf niet gevonden.' });
  const name = schoon(req.body.name, 60);
  const func = String(req.body.func || '').trim().slice(0, 40);
  const contact = String(req.body.contact || '').trim().slice(0, 80);
  const note = String(req.body.note || '').trim().slice(0, 400);
  if (!name || !func || !contact) return res.status(400).json({ error: 'Vul uw naam, de functie en een telefoonnummer of e-mailadres in.' });
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    name, func, contact, note, status: 'nieuw',
    at: new Date().toISOString()
  };
  const list = db.data.applications[s.code] = (db.data.applications[s.code] || []);
  list.unshift(entry);
  db.data.applications[s.code] = list.slice(0, 100);
  save();
  notifySupplier(s.code, { icon: 'werk', title: 'Nieuwe sollicitatie', body: name + ' solliciteert als ' + func + '.' });
  sseToSupplier(s.code, 'sync', { scope: 'team' });
  sseToOffice('sync', { scope: 'team' });
  res.json({ ok: true });
});

app.post('/api/supplier/apply/decide', supplierAuth, async (req, res) => {
  if (!managerOnly(req, res)) return;
  const a = (db.data.applications[req.supplier.code] || []).find(x => x.id === req.body.id);
  if (!a) return res.status(404).json({ error: 'Sollicitatie niet gevonden.' });
  if (req.body.action === 'uitnodigen') {
    // uitnodigen voor een gesprek: open de chat, nog geen personeelsaccount
    a.status = 'uitgenodigd';
    const chat = ensureApplyChat(req.supplier.code, a);
    if (!chat) return res.status(400).json({ error: 'Deze sollicitant heeft geen app-account; neem contact op via het opgegeven telefoonnummer of e-mailadres.' });
    if (!chat.berichten.length) chatStuur(chat, 'werkgever', req.supplier.name, 'Hallo ' + a.name + ', leuk dat je wilt komen werken als ' + a.func + '. Wanneer kun je langskomen voor een kennismaking?');
    save();
    logActivity(req.supplier.code, req.actor, 'nodigde ' + a.name + ' uit voor een gesprek');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'team' });
    notifyApplicant(a, req.supplier);
    return applyChatVertaald(chat, talen.taalVan(req.body.lang)).then(c => res.json({ ok: true, chat: c }));
  }
  if (req.body.action === 'aannemen') {
    const inv = maakInvite(req.supplier, req.actor, { naam: a.name, role: 'staff', func: a.func });
    a.status = 'aangenomen';

    // wie via de app solliciteerde is meteen in dienst; wie daarbuiten
    // solliciteerde houdt de kassacode en de wervingslink (zie uitnodiging.js)
    const direct = await neemAan(req.supplier, inv, a.key);
    ensureApplyChat(req.supplier.code, a); // ook aangenomen sollicitanten kunnen chatten om af te spreken
    save();
    logActivity(req.supplier.code, req.actor, 'nam ' + a.name + ' aan als ' + a.func);
    sseToSupplier(req.supplier.code, 'sync', { scope: 'team' });
    sseToOffice('sync', { scope: 'team' });
    notifyApplicant(a, req.supplier);
    if (a.key && db.data.notifications[a.key]) {
      notify(a.key, direct
        ? { icon: 'ster', title: 'Aangenomen bij ' + req.supplier.name,
            body: 'Welkom bij het team. Uw werkplek staat klaar in de app onder Mijn werkplekken; u hoeft niets meer in te vullen.' }
        : { icon: 'ster', title: 'Aangenomen bij ' + req.supplier.name,
            body: 'Meld u aan in de leverancier-app met bedrijfsnaam "' + req.supplier.name + '" en kassacode ' + inv.kassacode + '.' });
    }
    return res.json({ ok: true, bedrijf: req.supplier.name,
      // de kassacode blijft in het antwoord voor wie hem nog nodig heeft; is de
      // sollicitant al verbonden, dan is hij verbruikt en zegt 'direct' dat
      ...(direct ? { direct } : { invite: { kassacode: inv.kassacode, naam: a.name, func: a.func },
        link: wervingsLink(req, inv.kassacode) }) });
  }
  a.status = 'afgewezen';
  save();
  logActivity(req.supplier.code, req.actor, 'wees de sollicitatie van ' + a.name + ' af');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'team' });
  notifyApplicant(a, req.supplier);
  res.json({ ok: true });
});

app.post('/api/supplier/apply/chat', supplierAuth, (req, res) => {
  const chat = eigenVeld(db.data.applyChats, req.body.id);
  if (!chat || chat.supplierCode !== req.supplier.code) return res.status(404).json({ error: 'Chat niet gevonden.' });
  applyChatVertaald(chat, talen.taalVan(req.body.lang)).then(c => res.json({ chat: c }));
});

app.post('/api/supplier/apply/chat/send', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const chat = eigenVeld(db.data.applyChats, req.body.id);
  if (!chat || chat.supplierCode !== req.supplier.code) return res.status(404).json({ error: 'Chat niet gevonden.' });
  const m = chatStuur(chat, 'werkgever', req.supplier.name, req.body.text, talen.taalVan(req.body.lang));
  if (!m) return res.status(400).json({ error: 'Typ een bericht.' });
  // de sollicitant krijgt een seintje
  const app = (db.data.applications[req.supplier.code] || []).find(x => x.id === chat.id);
  if (app && app.key && db.data.notifications[app.key])
    notify(app.key, { icon: 'berichten', title: 'Bericht van ' + chat.bedrijf, body: m.tekst.slice(0, 80) });
  applyChatVertaald(chat, talen.taalVan(req.body.lang)).then(c => res.json({ chat: c }));
});

app.post('/api/supplier/vacature', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const b = req.body || {};
  const list = db.data.vacatures[req.supplier.code] = (db.data.vacatures[req.supplier.code] || []);
  const bestaand = b.id ? list.find(v => v.id === b.id) : null;
  const vac = bestaand || { id: crypto.randomBytes(4).toString('hex'), at: new Date().toISOString() };
  const ingevuld = vulVacature(vac, b, VAC_SOORTEN);
  if (ingevuld.error) return res.status(400).json({ error: ingevuld.error });
  if (!bestaand) { list.unshift(vac); db.data.vacatures[req.supplier.code] = list.slice(0, 40); }
  save();
  logActivity(req.supplier.code, req.actor, (bestaand ? 'wijzigde de vacature ' : 'plaatste een vacature ') + ingevuld.func);
  sseToSupplier(req.supplier.code, 'sync', { scope: 'team' });
  res.json({ ok: true, vacatures: (db.data.vacatures[req.supplier.code] || []).slice(0, 40) });
});

app.post('/api/supplier/vacature/verwijder', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const list = db.data.vacatures[req.supplier.code] || [];
  const i = list.findIndex(v => v.id === req.body.id);
  if (i < 0) return res.status(404).json({ error: 'Vacature niet gevonden.' });
  const soort = req.body.action === 'sluit' || req.body.action === 'open';
  if (soort) { list[i].open = req.body.action === 'open'; }
  else { list.splice(i, 1); }
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'team' });
  res.json({ ok: true, vacatures: list.slice(0, 40) });
});

app.post('/api/supplier/talent/match', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const lijst = Array.isArray(db.data.talentInteresses) ? db.data.talentInteresses : [];
  const match = lijst.find(x => x.id === req.body.id && x.supplierCode === req.supplier.code);
  if (!match || match.status !== 'interesse') return res.status(404).json({ error: 'Deze talentmatch is niet meer beschikbaar.' });
  match.status = req.body.action === 'interesse' ? 'wederzijds' : 'afgewezen';
  match.beslistAt = klokDatum().toISOString();
  save();
  logActivity(req.supplier.code, req.actor, (match.status === 'wederzijds' ? 'toonde wederzijdse interesse in ' : 'sloot een talentmatch voor ') + match.func);
  sseToSupplier(req.supplier.code, 'sync', { scope: 'team' });
  res.json({ ok: true, status: match.status });
});
};
