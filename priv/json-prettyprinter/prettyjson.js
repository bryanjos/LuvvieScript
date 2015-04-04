#!/usr/bin/env node

/**
Convert JSON data to human-readable form.

(Reads from stdin and writes to stdout)
**/

process.stdin.on('readable', function() {
  var chunk = process.stdin.read();
  var indent = 4;
  if (chunk !== null) {
    var json = JSON.parse(chunk);
    process.stdout.write(JSON.stringify(json, null, indent));
    process.exit(0);
  }
});
