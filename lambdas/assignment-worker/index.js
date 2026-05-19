"use strict";

/** Lambda Handler must be index.handler — forwards to logic in handler.cjs (ZIP both files). */
const mod = require("./handler.cjs");
exports.handler = mod.handler;
