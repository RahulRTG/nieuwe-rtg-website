/* Een uitgaand bericht is een gevolg van de opgeslagen handeling, niet van de
   nog ongecommitteerde werkkopie. Binnen een PG-request of een wachtende
   achtergrondcommit gaat de echte verzender daarom pas na duurzaamheid open. */
'use strict';

const context = require('./db/verzoekcontext');

module.exports = function naDuurzameCommit(verzend, bereid) {
  return (...args) => {
    const voorbereid = typeof bereid === 'function' ? bereid(...args) : undefined;
    if (context.haakNaCommit(() => verzend(...args))) return voorbereid;
    return verzend(...args);
  };
};
