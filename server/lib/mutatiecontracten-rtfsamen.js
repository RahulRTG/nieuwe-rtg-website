/* Handmatig nagelezen contracten voor FoundationOS Samen. */
'use strict';

const PROFIEL = { klasse: 'OBJECT_SCOPED', objectVeld: 'code' };
const KAMER = { klasse: 'OBJECT_SCOPED', objectVeld: 'id' };
const AFGETEKEND = {
  door: 'Codex, gelezen kern plus unit-, route- en PostgreSQL-raceproef',
  op: '2026-09-05'
};
const contract = (mutatieId, klasse, toegang, uitspraak) => ({
  mutatieId, herkomst: 'mens', semantiek: { klasse }, toegang,
  stand: 'PROTECTED',
  bewijs: { gemeten: 'test/rtf-samen-credential.test.js ' + uitspraak,
    op: '2026-09-05' },
  nagekeken: 'Gezinsprofiel, kamerbinding en herhaling worden in dezelfde ' +
    'samenRtfKamers-transactie beoordeeld.',
  afgetekend: AFGETEKEND
});

const CONTRACTEN = {
  'POST /api/rtf/samen/maak': contract('rtf.samen.maak',
    'sleutelVereist', PROFIEL,
    'herhaalt uitgifte met dezelfde sleutel, krijgt 409 zonder deelcode en houdt één kamer'),
  'POST /api/rtf/samen/mee': contract('rtf.samen.mee',
    'idempotent', PROFIEL,
    'claimt capaciteit en gebruik atomair en laat een verloren succes veilig herhalen'),
  'POST /api/rtf/samen/code': contract('rtf.samen.code.roteren',
    'sleutelVereist', KAMER,
    'trekt de oude deelcode in en heronthult een retry nooit'),
  'POST /api/rtf/samen/zet': contract('rtf.samen.plek.zet',
    'sleutelVereist', KAMER,
    'bindt actor, pad, titel en idempotentiesleutel en weigert sleuteldrift'),
  'POST /api/rtf/samen/chat': contract('rtf.samen.chat',
    'sleutelVereist', KAMER,
    'schrijft hetzelfde bericht met dezelfde sleutel precies eenmaal'),
  'POST /api/rtf/samen/weg': contract('rtf.samen.weg',
    'idempotent', KAMER,
    'verwijdert een lid hoogstens eenmaal en herhaalt daarna zonder extra effect'),
  'POST /api/rtf/samen/sluit': contract('rtf.samen.sluit',
    'idempotent', KAMER,
    'sluit en trekt de toegang onder hetzelfde slot in; herhaling verandert niets'),
  'POST /api/rtf/samen/staat': contract('rtf.samen.staat',
    'idempotent', KAMER,
    'leest alleen na actuele profiel-, lidmaatschap- en relatiecontrole')
};

module.exports = { CONTRACTEN };
