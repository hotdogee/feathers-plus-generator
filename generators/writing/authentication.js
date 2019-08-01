const crypto = require('crypto')
const chalk = require('chalk')
const { join } = require('path')
const makeDebug = require('debug')
const { inspect } = require('util')
const prettier = require('prettier')
const { generatorFs } = require('../../lib/generator-fs')
const { insertFragment } = require('../../lib/code-fragments')

const { parse } = require('@babel/parser')
const { default: template } = require('@babel/template')
const { default: traverse } = require('@babel/traverse')
const { default: generate } = require('@babel/generator')

const debug = makeDebug('generator-feathers-plus:writing:authentication')

const OAUTH2_STRATEGY_MAPPINGS = {
  auth0: 'passport-auth0',
  google: 'passport-google-oauth20',
  facebook: 'passport-facebook',
  github: 'passport-github'
}

const AUTH_TYPES = {
  local: '@types/feathersjs__authentication-local',
  auth0: '@types/feathersjs__authentication-oauth',
  google: '@types/feathersjs__authentication-oauth',
  facebook: '@types/feathersjs__authentication-oauth',
  twitter: '@types/feathersjs__authentication-oauth',
  line: '@types/feathersjs__authentication-oauth',
  github: '@types/feathersjs__authentication-oauth'
}

module.exports = {
  authentication
}

function authentication (generator, justRegen, props, specs, context, state) {
  if (!specs.authentication) return
  debug('authentication()')

  const {
    // TypeScript & semicolon helpers.
    js,
    isJs,
    // lodash utilities.
    camelCase,
    upperFirst
  } = context

  const {
    // File writing functions.
    tmpl,
    // Abbreviations for paths to templates used in building 'todos'.
    src,
    srcPath,
    // Other abbreviations using in building 'todos'.
    libDir
  } = state

  const entity = specs.authentication.entity
  const strategies = specs.authentication.strategies

  // Custom template context
  const context1 = Object.assign({}, context, {
    // PATCH $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
    // The authentication generation needs to know the path used by then user-entity service,
    // but that service is not configured at that point. So the code guesses the path will be
    // the same as the user-entity name. The generated code won't run right if its different.
    // The generation of the service-entity will call this routine so things are fixed right.
    servicePath: specs.services[entity] ? specs.services[entity].path : entity,
    kebabEntity: entity,
    camelEntity: camelCase(entity),
    oauthProviders: [],
    strategies
  })

  const dependencies = [
    '@feathersjs/authentication'
  ]

  let devDependencies = isJs
    ? []
    : [
      '@types/feathersjs__authentication'
    ]

  // Set up strategies and add dependencies
  strategies.forEach(strategy => {
    const oauthProvider = OAUTH2_STRATEGY_MAPPINGS[strategy]

    if (oauthProvider) {
      dependencies.push('@feathersjs/authentication-oauth')
      context1.oauthProviders.push({
        name: strategy,
        strategyName: `${upperFirst(strategy)}Strategy`,
        module: oauthProvider
      })
    }

    if (!isJs && AUTH_TYPES[strategy]) {
      devDependencies = devDependencies.concat(AUTH_TYPES[strategy])
    }
  })

  // Create the users (entity) service
  if (!justRegen) {
    generator.composeWith(require.resolve('../service'), {
      props: { name: entity }
    })
  }

  const todos = [
    tmpl([srcPath, 'authentication.ejs'], [libDir, `authentication.${js}`]),
    tmpl([srcPath, 'app.ejs'], [src, `app.${js}`])
    // todo tmpl([tpl, 'test', 'auth-local.test.ejs'], [testDir, `auth-local.test.${js}`]),
  ]
  if (!src) {
    console.log(
      `\n ${chalk.red.bold(
        'ERROR: No src directory, run "generate app" first'
      )}`
    )
    process.exit()
  }
  // Generate modules
  generatorFs(generator, context1, todos)

  // Update dependencies
  writeAuthenticationConfiguration(generator, context1)
  generator._packagerInstall(dependencies, { save: true })
  generator._packagerInstall(devDependencies, { saveDev: true })
}

function writeAuthenticationConfiguration (generator, context1) {
  const config = Object.assign({}, generator._specs._defaultJson)
  const path = context1.servicePath

  const configAuth = (config.authentication = config.authentication || {})
  configAuth.secret = generator._specs._isRunningTests
    ? '***** secret generated for tests *****'
    : configAuth.secret || crypto.randomBytes(256).toString('hex')
  configAuth.authStrategies = ['jwt', 'ecdsa']
  configAuth.path = '/authentication'
  configAuth.entity = '\\user'
  configAuth.service =
    path.substring(0, 1) !== '/' ? path : context1.servicePath.substring(1)

  configAuth.jwtOptions = configAuth.jwtOptions || {
    header: { typ: 'access' },
    issuer: 'hanl.in',
    algorithm: 'HS256',
    expiresIn: '30m'
  }

  if (context1.strategies.indexOf('local') !== -1) {
    configAuth.authStrategies.push('local')
    configAuth.local = configAuth.local || {
      usernameField: 'accounts.value',
      passwordField: '\\password'
    }
  }

  let includesOAuth = false
  const oauthConfig = {
    redirect: 'UI_URL',
    defaults: {
      path: '/oauth',
      host: 'API_HOST',
      protocol: 'API_PROTOCOL'
    }
  }

  context1.strategies.forEach(strategy => {
    if (OAUTH2_STRATEGY_MAPPINGS[strategy]) {
      includesOAuth = true
      const strategyConfig = {
        key: `your ${strategy} client id`,
        secret: `your ${strategy} client secret`
      }

      if (strategy === 'google') {
        strategyConfig.scope = ['profile openid email']
        strategyConfig.profileUrl = 'https://openidconnect.googleapis.com/v1/userinfo'
        strategyConfig.nonce = true
        strategyConfig.custom_params = {
          access_type: 'offline'
        }
      } else if (strategy === 'facebook') {
        strategyConfig.scope = ['public_profile', 'email']
        strategyConfig.profileUrl = 'https://graph.facebook.com/me?fields=id,email,first_name,last_name,short_name,name,middle_name,name_format,picture,permissions'
      } else if (strategy === 'twitter') {
        strategyConfig.profileUrl = 'https://api.twitter.com/1.1/account/verify_credentials.json?include_email=true&skip_status=true&include_entities=false'
      } else if (strategy === 'line') {
        strategyConfig.scope = ['profile openid email']
        strategyConfig.profileUrl = 'https://api.line.me/v2/profile'
        strategyConfig.nonce = true
        strategyConfig.authorize_url = 'https://access.line.me/oauth2/v2.1/authorize'
        strategyConfig.access_url = 'https://api.line.me/oauth2/v2.1/token'
        strategyConfig.oauth = 2
        strategyConfig.state = true
        strategyConfig.scope_delimiter = ' '
      } else if (strategy === 'auth0') {
        strategyConfig.domain = 'mydomain.auth0.com'
        strategyConfig.scopes = ['profile']
      }
      oauthConfig[strategy] = oauthConfig[strategy] || strategyConfig
    }
  })

  if (includesOAuth) {
    configAuth.oauth = oauthConfig
    configAuth.cookie = configAuth.cookie || {
      enabled: true,
      name: 'feathers-jwt',
      httpOnly: false,
      secure: false
    }
  }

  // CODE
  const configDefaultPath = generator.destinationPath(
    `${context1.appConfigPath}/default.js`
  )
  let configDefaultCode
  if (generator.fs.exists(configDefaultPath)) {
    configDefaultCode = generator.fs.read(configDefaultPath)
  } else {
    configDefaultCode = prettier.format(
      'module.exports = ' + JSON.stringify(generator._specs._defaultJson),
      {
        semi: false,
        singleQuote: true,
        parser: 'babel'
      }
    )
  }
  // AST
  const configDefaultAst = parse(configDefaultCode)
  let moduleExports
  traverse(configDefaultAst, {
    AssignmentExpression (path) {
      if (
        path
          .get('left')
          .get('object')
          .isIdentifier({ name: 'module' }) &&
        path
          .get('left')
          .get('property')
          .isIdentifier({ name: 'exports' })
      ) {
        console.log(`module.exports node FOUND`)
        moduleExports = path.get('right')
      } else {
        console.log(`module.exports node NOT found`)
      }
    }
  })
  // create authentication node
  const authenticationObjectProperty = template.ast(
    `module.exports = { authentication: ${JSON.stringify(configAuth)} }`,
    {
      reserveComments: true
    }
  ).expression.right.properties[0]
  // update AST
  if (generator._specs._defaultJson.authentication) {
    // authentication node exists
    // find and replace current authentication node
    for (let i = 0; i < moduleExports.node.properties.length; i++) {
      if (moduleExports.node.properties[i].key.name === 'authentication') {
        moduleExports.node.properties[i] = authenticationObjectProperty
      }
    }
  } else {
    // no authentication node
    // insert into last position
    moduleExports.node.properties.push(authenticationObjectProperty)
  }

  generator._specs._defaultJson = config

  // generator.fs.writeJSON(
  //   generator.destinationPath(context1.appConfigPath, 'default.json'),
  //   config
  // )
  // generator.fs.copyTpl(
  //   generator.templatePath(join(__dirname, 'templates', 'json.ejs')),
  //   generator.destinationPath(join(context1.appConfigPath, 'default.js')),
  //   Object.assign({}, context1, {
  //     insertFragment: insertFragment(generator.destinationPath(join(context1.appConfigPath, 'default.js')))
  //   }, {
  //     json: prettier
  //       .format('let a = ' + JSON.stringify(config), {
  //         semi: false,
  //         singleQuote: true,
  //         parser: 'babel'
  //       })
  //       .slice(8)
  //   })
  // )
  generator.fs.write(
    configDefaultPath,
    prettier.format(generate(configDefaultAst).code, {
      semi: false,
      singleQuote: true,
      parser: 'babel'
    })
  )
}

// eslint-disable-next-line no-unused-vars
function inspector (desc, obj, depth = 6) {
  console.log(desc)
  console.log(inspect(obj, { colors: true, depth }))
}
