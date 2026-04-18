// hello.js - A simple Hello World program

function greet(name) {
  return `Hello, ${name || 'World'}!`;
}

// If run directly from command line
if (require.main === module) {
  const name = process.argv[2];
  console.log(greet(name));
}

// Export for use as a module
module.exports = { greet };
