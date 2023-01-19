const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let value = pkg;
process.argv.slice(2).forEach(arg => {
  //console.log(`Arg: ${arg}`);
  value = value[arg];
});

process.stdout.write(value);
