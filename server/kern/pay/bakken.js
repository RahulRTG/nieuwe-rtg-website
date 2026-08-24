/* DE OPSLAGVORM VAN RTG PAY: waar de saldi, het grootboek, de Klompjes en de
   codes staan, en hoe een rekening heet.

   Vijf bakken in db.data en vier naamregels. Ze staan hier bij elkaar omdat ze
   samen ÉÉN ding beschrijven -- de vorm waarin deze laag zijn gegevens bewaart --
   en omdat elk van hen op precies één plek hoort te staan. De naamregel
   'lid:' + codenaam werd tot voor kort op vier plekken nagetikt (ov, mobiliteit,
   geldwereld, bank), en een naamregel die op vier plekken staat is op dag een al
   drie keer bijna fout gegaan.

   De luie initialisatie is geen slordigheid maar het patroon van dit huis: een
   bak bestaat pas als er iets in gaat, en een db.json van een verse installatie
   staat daarom niet vol met lege lijsten. Wie leest, krijgt gegarandeerd het
   goede type terug -- ook als er nooit iets in is gezet.

   WAAROM DIT EEN EIGEN BESTAND IS. ./index.js kwam op 10241 byte uit, één byte
   over de keuringsgrens van 10240. Aan comments knabbelen om daaronder te komen
   lost niets op: de volgende bewerking breekt hem weer, en dan is het antwoord
   opnieuw een zin korter maken. Dit is de naad met de minste bedrading
   eroverheen -- er gaat alleen `db` in -- en daarmee de eerlijke splitsing. */
'use strict';

module.exports = ({ db, crypto }) => {
  const d = () => db.data;

  function saldi() { if (!d().paySaldi || typeof d().paySaldi !== 'object') d().paySaldi = {}; return d().paySaldi; }
  function grootboek() { if (!Array.isArray(d().payBoekingen)) d().payBoekingen = []; return d().payBoekingen; }
  function klompjes() { if (!Array.isArray(d().payVerzoeken)) d().payVerzoeken = []; return d().payVerzoeken; }
  function kascodes() { if (!Array.isArray(d().payCodes)) d().payCodes = []; return d().payCodes; }
  function tikcodes() { if (!Array.isArray(d().payTikCodes)) d().payTikCodes = []; return d().payTikCodes; }

  const rekLid = c => 'lid:' + c;
  const rekPartner = c => 'partner:' + c;
  const saldoVan = rek => Math.round(saldi()[rek] || 0);
  const id = p => (p || 'P') + crypto.randomBytes(5).toString('hex').toUpperCase();

  return { d, saldi, grootboek, klompjes, kascodes, tikcodes, rekLid, rekPartner, saldoVan, id };
};
