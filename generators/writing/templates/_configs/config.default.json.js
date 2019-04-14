module.exports = function () {
  const config = {
    host: 'localhost',
    port: 3030,
    public: '../public/',
    paginate: {
      default: 10,
      max: 50
    },
    tests: {}
  }

  return config
}
