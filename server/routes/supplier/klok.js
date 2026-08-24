/* Supplier (deelmodule): DE ZAKENKLOK van deze zaak -- wanneer begint hier een
   dag, een boekhoudperiode, een loonperiode, een schooldag.

   Waarom dit een eigen loket is en geen veld in /api/supplier/settings: de
   soorten staan in een REGISTER (server/kern/zakenklok/) en er kan er een bij
   komen zonder dat de kern verandert. Een loket dat de soorten uit dat register
   leest, groeit vanzelf mee; een lijstje velden in de settings-route zou bij
   elke nieuwe soort opnieuw moeten worden bijgewerkt -- en dat is precies het
   soort lijst dat achterloopt.

   WAT HET SCHERM KRIJGT. Per soort: wat er GELDT, wat RTG voorstelde, of het een
   eigen keuze is, welke velden werden genegeerd omdat ze onleesbaar waren, en
   welke keuzes er zijn. Zonder dat laatste zou een scherm moeten raden wat er
   mag, en dan staat de waarheid op twee plekken (LAT-regel 4). */
module.exports = (kern) => {
  const { app, supplierAuth, managerOnly, save, logActivity } = kern;
  const zakenklok = require('../../kern/zakenklok');

  app.get('/api/supplier/klok', supplierAuth, (req, res) => {
    const s = req.supplier;
    res.json({
      ok: true,
      soorten: zakenklok.soorten().map(soort => zakenklok.keuzeVan(s, soort.sleutel)),
      nu: zakenklok.soorten().reduce((uit, soort) => {
        const p = zakenklok.periode(s, soort.sleutel);
        if (p) uit[soort.sleutel] = p;
        return uit;
      }, {})
    });
  });

  app.post('/api/supplier/klok', supplierAuth, (req, res) => {
    /* Alleen een manager. Het omslaguur bepaalt op welke dag de omzet valt, en
       dat is een boekhoudkundige keuze en geen voorkeur van wie er die avond
       achter de bar staat. */
    if (!managerOnly(req, res)) return;
    const soort = zakenklok.soortVan(req.body && req.body.soort);
    if (!soort) return res.status(400).json({ error: 'Deze periode ken ik niet.' });
    const waarde = (req.body && req.body.instelling) || {};
    if (typeof waarde !== 'object' || Array.isArray(waarde))
      return res.status(400).json({ error: 'Een instelling is een object met velden.' });

    /* HIER WORDT WEL GEWEIGERD, en dat is het verschil met de leeslaag.

       zakenklok.instellingVan() NEGEERT een onleesbaar veld, want een bestaande
       zaak mag niet omvallen over data die er al staat. Maar iets NIEUWS
       opslaan dat niet klopt is een andere zaak: dan hoort de invoer terug met
       de reden, in plaats van stil te worden weggegooid en later te ontbreken. */
    const fout = typeof soort.keur === 'function' ? soort.keur(waarde) : [];
    if (fout.length) return res.status(400).json({
      error: 'Deze waarde kan ik niet gebruiken: ' + fout.join(', ') + '.', velden: fout });

    const st = req.supplier.settings = req.supplier.settings || {};
    st.klok = st.klok || {};
    /* Een LEGE instelling betekent "terug naar het voorstel van RTG". Zonder die
       weg zou een zaak zijn eigen keuze nooit meer kwijtraken, en dan is het
       voorstel geen voorstel meer. */
    if (Object.keys(waarde).length === 0) delete st.klok[soort.sleutel];
    else st.klok[soort.sleutel] = Object.assign({}, st.klok[soort.sleutel], waarde);
    save();
    if (typeof logActivity === 'function') {
      try { logActivity(req, soort.naam + ' ingesteld'); } catch (e) { /* het loket blijft werken */ }
    }
    res.json({ ok: true, keuze: zakenklok.keuzeVan(req.supplier, soort.sleutel),
      nu: zakenklok.periode(req.supplier, soort.sleutel) });
  });
};
