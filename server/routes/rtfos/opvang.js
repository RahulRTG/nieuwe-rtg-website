/* CIVILIS-opvang: kantoor beheert de zaak; de aanbieder beheert uitsluitend
   eigen capaciteit, acceptatie en aankomst via de bestaande partnerdeur. */
'use strict';
const rem = require('../../rem');

module.exports = ({ app, auth, officeAuth, rtfos, H, veilig }) => {
  const koppel = rtfos.codekoppeling;
  const codeVan = req => String((req.body && req.body.code) || '').trim().slice(0, 40).toUpperCase();
  const bronRem = rem({ windowMs: 60000, limit: 20,
    key: req => 'opvangpartner-ip|' + String(req.ip) });
  const codeRem = rem({ windowMs: 60000, limit: 60,
    key: req => 'opvangpartner-code|' + codeVan(req) });

  app.post('/api/rtfos/opvang/voorzieningen', officeAuth,
    H((req, b) => rtfos.opvang.lijst(req, b.stad)));
  app.post('/api/rtfos/opvang/voorziening/maak', officeAuth,
    H((req, b) => rtfos.opvang.voorzieningMaak(req, b)));
  app.post('/api/rtfos/opvang/aanvraag', officeAuth,
    H((req, b) => rtfos.opvang.aanvraag(req, b)));
  app.post('/api/rtfos/opvang/vervolgplan', officeAuth,
    H((req, b) => rtfos.opvang.vervolgplan(req, b)));

  const partner = werk => (req, res) => veilig(res, () =>
    koppel.met(req, 'partner', codeVan(req), () => werk(codeVan(req), req.body || {})));
  app.post('/api/rtfos/portaal/partner/opvang', auth, bronRem, codeRem,
    partner(code => rtfos.opvang.partnerLijst(code)));
  app.post('/api/rtfos/portaal/partner/opvang/capaciteit', auth, bronRem, codeRem,
    partner((code, b) => rtfos.opvang.capaciteit(code, b)));
  app.post('/api/rtfos/portaal/partner/opvang/besluit', auth, bronRem, codeRem,
    partner((code, b) => rtfos.opvang.besluit(code, b)));
  app.post('/api/rtfos/portaal/partner/opvang/aankomst', auth, bronRem, codeRem,
    partner((code, b) => rtfos.opvang.aankomst(code, b)));
};
