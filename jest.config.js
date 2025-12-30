module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/server.js', // Exclude main server file
    '!server/setup.js',   // Exclude setup file
    '!server/models/index.js' // Exclude index files
  ],
  coverageDirectory: 'coverage',
  verbose: true
};