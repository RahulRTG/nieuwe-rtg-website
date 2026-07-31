/* Domein "werkbeleid": de zakelijke kant van de boardroom. Een bedrijf dat
   Business Passen voor zijn mensen neemt, moet kunnen zeggen welke functies op
   die passen dicht staan -- compliance, geheimhouding, of gewoon een keuze.

   De regel die dit hele domein veilig maakt staat in kern/lidboard/werkbeleid:
   EEN WERKGEVER KAN ALLEEN DICHTZETTEN, NOOIT OPENZETTEN. Er is dus geen
   endpoint om iets aan te zetten. Een werkgever kan een medewerker niet
   dwingen zijn locatie te delen, zijn GPS aan te zetten of zijn paspoort
   beschikbaar te stellen -- de enige richting waarin hij die knoppen kan
   bewegen is dicht, en dat is voor de medewerker altijd de veilige kant.

   Achter de zaak-inlog (supplierAuth), want dit is beleid van het bedrijf. Wat
   het bedrijf hier dichtzet, staat bij de medewerker op zijn eigen bord met de
   bedrijfsnaam erbij: stille voogdij bestaat hier niet. */
module.exports = (kern) => {
  const { app, express, supplierAuth, managerOnly, werkbeleidOverzicht, werkbeleidZet } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; r.error ? res.status(status || 400).json({ error: r.error }) : res.status(200).json(rest); };

  // Het beleid van deze zaak: alle schakelbare functies, met per functie of het
  // beleid hem dichtzet. Een lijst om te bedienen, geen rijtje id's.
  app.post('/api/supplier/werkbeleid', supplierAuth, (req, res) => {
    res.json({ beleid: werkbeleidOverzicht(req.supplier.code) });
  });

  /* Het beleid zetten. `uit` is de VOLLEDIGE lijst van wat dicht moet: wat er
     niet in staat, is weer vrij voor de medewerker zelf. Dat is met opzet geen
     los aan/uit per functie -- dan zou een half mislukt verzoek een beleid
     achterlaten dat niemand bedoeld heeft. */
  app.post('/api/supplier/werkbeleid/zet', express.json({ limit: '16kb' }), supplierAuth, (req, res) => {
    /* Van het management, en niet van iedereen met een zaak-inlog. Deze route
       was de enige van zijn familie zonder die controle, en dat is hier het
       zwaarst: wie hem kan zetten, zet in een keer voor ELKE medewerker van
       de zaak Salon, AI en het delen van het paspoort uit. LEZEN mag het hele
       team wel -- je hoort te weten wie je knop vasthoudt. */
    if (!managerOnly(req, res)) return;
    const door = (req.body && req.body.door) || (req.supplier && req.supplier.name) || null;
    stuur(res, werkbeleidZet(req.supplier.code, (req.body && req.body.uit) || [], door));
  });
};
