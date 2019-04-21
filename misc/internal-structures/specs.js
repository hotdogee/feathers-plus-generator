const specs = {
  overrides: {
    authorName: 'John Szwaronek',
    authorEmail: 'johnsz9999@gmail.com',
    engineNodeMajor: 8
  },
  options: {
    ver: '1.0.0',
    inspectConflicts: false,
    semicolons: true,
    freeze: [],
    ts: false
  },
  app: {
    name: 'z-1',
    description: 'Project z-1',
    src: 'src1',
    packager: 'npm@>= 3.0.0',
    providers: ['rest', 'socketio'],
    environmentsAllowingSeedData: 'test',
    seedData: false
  },
  services: {
    users1: {
      name: 'users1',
      nameSingular: 'users1',
      subFolder: '',
      fileName: 'users-1',
      adapter: 'nedb',
      path: '/users-1',
      isAuthEntity: true,
      graphql: false
    },
    nedb1: {
      name: 'nedb1',
      nameSingular: 'nedb1',
      subFolder: '',
      fileName: 'nedb-1',
      adapter: 'nedb',
      path: '/nedb-1',
      isAuthEntity: false,
      requiresAuth: true,
      graphql: true
    },
    nedb2: {
      name: 'nedb2',
      nameSingular: 'nedb2',
      subFolder: '',
      fileName: 'nedb-2',
      adapter: 'nedb',
      path: '/nedb-2',
      isAuthEntity: false,
      requiresAuth: false,
      graphql: true
    }
  },
  authentication: {
    strategies: ['local', 'auth0', 'google', 'facebook', 'github'],
    entity: 'users1'
  },
  connections: {
    nedb: { database: 'nedb', adapter: 'nedb', connectionString: '../data' }
  },
  middlewares: {
    mw1: { path: '*', camel: 'mw1', kebab: 'mw-1' },
    mw2: { path: 'mw2', camel: 'mw2', kebab: 'mw-2' }
  },
  graphql: {
    name: 'graphql',
    path: '/graphql',
    strategy: 'services',
    sqlInterface: null,
    requiresAuth: false,
    doNotConfigure: false
  },
  _databases: { nedb: '../data' },
  _adapters: {},
  _dbConfigs: { nedb: '../data' },
  _connectionDeps: ['nedb'],
  _generators: ['all'],
  _defaultJson: {},
  _isRunningTests: false,
  hooks: {},
  _hooks: {}
}
