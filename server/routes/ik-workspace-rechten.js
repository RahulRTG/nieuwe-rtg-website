/* De rechten van de werkruimte (kern/workspace-rechten.js): wat de server deze
   sessie toestaat te tonen. Een eigen bestand naast ./ik.js, dat anders over de
   grens van keuringsregel 13 ging. Alleen de sessie telt; het lichaam mag een
   lijst namen meegeven en verder niets. */
const { rechtenVoor } = require('../kern/workspace-rechten');

module.exports = ({ app, auth }) => {
  app.post('/api/ik/workspace/rechten', auth, (req, res) =>
    res.json(rechtenVoor(req.session, (req.body || {}).gevraagd)));
};
