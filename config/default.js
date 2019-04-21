module.exports = {
  host: 'localhost',
  port: 3030,
  public: '../public/',
  paginate: { default: 10, max: 50 },
  tests: { environmentsAllowingSeedData: ['test'] },
  authentication: {
    secret:
      'bdaa3123dc9aea2989cf43910f1042625ba3d3aefefa1c99419e8576d2c5191875145d41ce93272d7e13d31e5b16564493f01b12bddc420359078eaf980dfa349055d3b6f550dd4b7974f4814f5ccf1289a509ba5c9ea8e5a1299ca6fc51ed88828d7353265d2260fc3d71479541020e2fd7273d75cbb496199e92679eee3e70fcde4b83ad4264000a76b8e850a479cbe070607de767289163d7069187412decc6f8a48c88bc7016a730d61ac54fd0e1a36fe0e9ae010369b6c70e59d08bdd4e6d4ceb11cde2ee645dc9f6f15b12d0498dc3114877e6eb9f66781ef7dbfcbb4b640f0c35ceeaad2cbeb74bdf3813983b0bd53d71a7509e69ea6fb4c3b1e8d837',
    strategies: ['jwt', 'local'],
    path: '/authentication',
    service: 'users',
    jwt: {
      header: { typ: 'access' },
      audience: 'api',
      subject: 'access',
      issuer: 'feathers',
      algorithm: 'HS256',
      expiresIn: '30s'
    },
    local: {
      entity: '\\user',
      usernameField: '\\email',
      passwordField: '\\password'
    },
    google: {
      clientID: 'your google client id',
      clientSecret: 'your google client secret',
      successRedirect: '/',
      scope: ['profile openid email']
    },
    facebook: {
      clientID: 'your facebook client id',
      clientSecret: 'your facebook client secret',
      successRedirect: '/',
      scope: ['public_profile', 'email'],
      profileFields: [
        'id',
        'displayName',
        'first_name',
        'last_name',
        'email',
        'gender',
        'profileUrl',
        'birthday',
        'picture',
        'permissions'
      ]
    },
    cookie: {
      enabled: true,
      name: 'feathers-jwt',
      httpOnly: false,
      secure: false
    }
  },
  mongodb: 'mongodb://localhost:27017/2_g_app'
}
