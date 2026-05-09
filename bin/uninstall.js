#!/usr/bin/env bun
// Thin wrapper: forces uninstall mode and delegates to install.js.
process.argv[2] = "uninstall";
require("./install.js");
