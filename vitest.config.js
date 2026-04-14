module.exports = {
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js'],
    // Run in a single fork so CJS module cache is shared with mock registry
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
};
