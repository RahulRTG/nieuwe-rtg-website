/* Dezelfde accountlezing voor RTG iD, paspoort, ontmoeting en podium.
   De sleutelparser blijft zuiver in lidsleutel; de kluis wordt geïnjecteerd.
   Deze helper verleent geen toegang en kiest geen ander account bij fouten. */
'use strict';
const { idVanKey } = require('./lidsleutel');

module.exports = function accountOpSleutel(accounts, key) {
  const id = idVanKey(key);
  if (id == null) return null;
  try { return accounts.getUserById(id); } catch (e) { return null; }
};
