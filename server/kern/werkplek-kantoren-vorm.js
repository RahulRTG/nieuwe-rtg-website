'use strict';

const tool = (naam, uitleg, href, glyf) => ({ naam, uitleg, href, glyf });
const kantoor = (id, naam, glyf, doel, functies, tools, verdieping) =>
  ({ id, naam, glyf, doel, functies, tools, verdieping });

module.exports = { tool, kantoor };
