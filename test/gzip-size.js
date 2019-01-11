const gzipSize = require('gzip-size');
const fs = require("fs");
const path = require("path");
const text = fs.readFileSync(path.join(__dirname, "../dist/index.min.js")).toString();

console.log(text.length);
//=> 191

console.log(gzipSize.sync(text));