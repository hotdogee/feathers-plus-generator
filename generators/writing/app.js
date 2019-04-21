const { join } = require('path')
const makeDebug = require('debug')
const { inspect } = require('util')
const prettier = require('prettier')
const makeConfig = require('./templates/_configs')
const { generatorFs } = require('../../lib/generator-fs')

const { parse } = require('@babel/parser')
const { default: template } = require('@babel/template')
const { default: traverse } = require('@babel/traverse')
const { default: generate } = require('@babel/generator')

const debug = makeDebug('generator-feathers-plus:writing:app')

module.exports = {
  app
}

function app (generator, props, specs, context, state) {
  debug('app()')

  const {
    // Paths.
    appConfigPath,
    // TypeScript & semicolon helpers.
    js,
    isJs
  } = context

  const {
    // File writing functions
    tmpl,
    copy,
    json,
    source,
    // Abbreviations for paths to templates used in building 'todos'.
    tpl,
    src,
    srcPath,
    mwPath,
    serPath,
    // Other abbreviations using in building 'todos'.
    testDir,
    // Constants.
    WRITE_IF_NEW,
    WRITE_ALWAYS
  } = state

  let todos

  const [packager] = specs.app.packager.split('@')
  const testAllJsFront = `${packager} run eslint && cross-env NODE_ENV=`
  const testAllJsBack = ' npm run mocha'
  const testAllTsFront = `${packager} run tslint && cross-env NODE_ENV=`
  const testAllTsBack = ' npm run mocha'

  const startSeedFront = 'cross-env NODE_ENV='
  const startSeedJsBack = ' node src/ --seed'
  const startSeedTsBack = ' ts-node --files src/ --seed'

  let back

  // Configurations
  const pkg = (generator.pkg = generator.fs.readJSON(
    generator.destinationPath('package.json'),
    makeConfig.package(generator)
  ))

  const configDefaultPath = generator.destinationPath(
    `${appConfigPath}/default.js`
  )
  let configDefault
  let configDefaultCode
  if (generator.fs.exists(configDefaultPath)) {
    configDefault = specs._defaultJson = require(configDefaultPath)
    configDefaultCode = generator.fs.read(configDefaultPath)
  } else {
    configDefault = specs._defaultJson = makeConfig.configDefault(generator)
    configDefaultCode = prettier.format(
      'module.exports = ' + JSON.stringify(configDefault),
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
  // test environments
  const environmentsAllowingSeedData = specs.app.environmentsAllowingSeedData.split(
    ','
  )
  // create tests node
  const testsObjectProperty = template.ast(
    `module.exports = { tests: { environmentsAllowingSeedData: ${JSON.stringify(
      environmentsAllowingSeedData
    )} } }`,
    {
      reserveComments: true
    }
  ).expression.right.properties[0]
  // Update older configs with current specs
  if (configDefault.tests) {
    // tests node exists
    // find and replace current tests node
    for (let i = 0; i < moduleExports.node.properties.length; i++) {
      if (moduleExports.node.properties[i].key.name === 'tests') {
        moduleExports.node.properties[i] = testsObjectProperty
      }
    }
  } else {
    // no tests node
    configDefault.tests = {}
    // insert into last position
    moduleExports.node.properties.push(testsObjectProperty)
  }
  configDefault.tests.environmentsAllowingSeedData = environmentsAllowingSeedData
  debug(
    prettier.format(generate(configDefaultAst).code, {
      semi: false,
      singleQuote: true,
      parser: 'babel'
    })
  )

  // package.json
  pkg.scripts['test:all'] =
    pkg.scripts['test:all'] ||
    (isJs
      ? `${testAllJsFront}${testAllJsBack}`
      : `${testAllTsFront}${testAllTsBack}`)
  pkg.scripts['start:seed'] =
    pkg.scripts['start:seed'] ||
    (isJs
      ? `${startSeedFront}${startSeedJsBack}`
      : `${startSeedFront}${startSeedTsBack}`)

  const configNodemon = generator.fs.readJSON(
    generator.destinationPath('nodemon.json'),
    makeConfig.nodemon(generator, 'development')
  )

  const configProdPath = generator.destinationPath(
    `${appConfigPath}/production.js`
  )
  const configProd =
    (generator.fs.exists(configProdPath) && require(configProdPath)) ||
    makeConfig.configProduction(generator)

  // update test:all script for first test environment
  const firstTestEnv = configDefault.tests.environmentsAllowingSeedData[0]
  const testAll = pkg.scripts['test:all']
  const front = isJs ? testAllJsFront : testAllTsFront
  back = isJs ? testAllJsBack : testAllTsBack

  if (
    testAll.substr(0, front.length) === front &&
    testAll.substr(-back.length) === back
  ) {
    pkg.scripts['test:all'] = `${front}${firstTestEnv}${back}`
  }

  // update start:seed script for first test environment
  const startSeed = pkg.scripts['start:seed']
  back = isJs ? startSeedJsBack : startSeedTsBack

  if (
    startSeed.substr(0, startSeedFront.length) === startSeedFront &&
    startSeed.substr(-back.length) === back
  ) {
    pkg.scripts['start:seed'] = `${startSeedFront}${firstTestEnv}${back}`
  }

  // Modify .eslintrc for semicolon option
  // let eslintrcExists = true
  // let eslintrcChanged = false
  let eslintrc = generator.fs.readJSON(
    join(process.cwd(), '.eslintrc.json'),
    {}
  )

  if (!Object.keys(eslintrc).length) {
    // eslintrcExists = false
    eslintrc = generator.fs.readJSON(join(tpl, '_eslintrc.json'), {})
  }

  const rules = (eslintrc.rules = eslintrc.rules || {})
  const rulesSemi = rules.semi

  // Modify tslint.json for semicolon option
  let tslintExists = true
  let tslintJsonChanged = false
  let tslintjson = generator.fs.readJSON(join(process.cwd(), 'tslint.json'), {})

  if (!Object.keys(tslintjson).length) {
    tslintExists = false
    tslintjson = generator.fs.readJSON(join(tpl, '_tslint.json'), {})
  }

  const tsRules = (tslintjson.rules = tslintjson.rules || {})
  const tsRulesSemi = tsRules.semicolon

  if (context.sc) {
    // semicolons used
    if (!Array.isArray(rulesSemi) || rulesSemi[0] !== 'error') {
      eslintrc.rules.semi = ['error', 'always']
      // eslintrcChanged = true
    }
    if (!Array.isArray(tsRulesSemi) || tsRulesSemi[0] !== true) {
      tslintjson.rules.semicolon = true
      tslintJsonChanged = true
    }
  } else {
    // semicolons not used
    if (rulesSemi) {
      delete rules.semi
      // eslintrcChanged = true
    }
    if (tsRulesSemi) {
      tslintjson.rules.semicolon = false
      tslintJsonChanged = true
    }
  }

  // Custom template context.
  context = Object.assign({}, context, {
    getNameSpace: generator.getNameSpace,
    _hooks: specs._hooks['*app'] || []
  })

  // Modules to generate
  todos = [
    copy([tpl, '_editorconfig'], '.editorconfig', WRITE_IF_NEW),
    // This name hack is necessary because NPM does not publish `.gitignore` files
    copy([tpl, '_gitignore'], '.gitignore', WRITE_IF_NEW),
    copy([tpl, 'LICENSE'], 'LICENSE', WRITE_IF_NEW),
    tmpl([tpl, 'README.md.ejs'], 'README.md', WRITE_IF_NEW),

    copy(
      [tpl, 'public', 'favicon.ico'],
      ['public', 'favicon.ico'],
      WRITE_IF_NEW
    ),
    copy([tpl, 'public', 'index.html'], ['public', 'index.html'], WRITE_IF_NEW),

    tmpl(
      [tpl, 'test', 'app.test.ejs'],
      [testDir, `app.test.${js}`],
      WRITE_IF_NEW
    ),

    tmpl([tpl, 'src', 'hooks', 'log.ejs'], [src, 'hooks', `log.${js}`]),
    copy(
      [tpl, 'src', 'refs', 'common.json'],
      [src, 'refs', 'common.json'],
      WRITE_IF_NEW
    ),
    tmpl([tpl, 'src', 'channels.ejs'], [src, `channels.${js}`], WRITE_IF_NEW),
    tmpl(
      [tpl, 'src', 'seed-data.ejs'],
      [src, `seed-data.${js}`],
      WRITE_ALWAYS,
      !specs.app.seedData
    ),

    json(pkg, 'package.json'),
    json(configNodemon, 'nodemon.json'),
    // json(configDefault, [appConfigPath, 'default.js']),
    // tmpl (src, dest, ifNew, ifSkip, ctx)
    // tmpl([tpl, 'json.ejs'], [appConfigPath, 'default.js'], false, false, {
    //   json: prettier
    //     .format('let a = ' + JSON.stringify(configDefault), {
    //       semi: false,
    //       singleQuote: true,
    //       parser: 'babel'
    //     })
    //     .slice(8)
    // }),
    source(
      [
        prettier.format(generate(configDefaultAst).code, {
          semi: false,
          singleQuote: true,
          parser: 'babel'
        })
      ],
      [appConfigPath, 'default.js']
    ),
    // json(configProd, [appConfigPath, 'production.json']),
    tmpl([tpl, 'json.ejs'], [appConfigPath, 'production.js'], false, false, {
      json: prettier
        .format('let a = ' + JSON.stringify(configProd), {
          semi: false,
          singleQuote: true,
          parser: 'babel'
        })
        .slice(8)
    }),

    tmpl([tpl, 'src', 'index.ejs'], [src, `index.${js}`]),
    tmpl([tpl, 'src', 'app.hooks.ejs'], [src, `app.hooks.${js}`]),
    tmpl([tpl, 'src', 'logger.ejs'], [src, `logger.${js}`]),

    tmpl([mwPath, 'index.ejs'], [src, 'middleware', `index.${js}`]),
    tmpl([srcPath, 'app.ejs'], [src, `app.${js}`]),
    tmpl([serPath, 'index.ejs'], [src, 'services', `index.${js}`]),
    tmpl(
      [tpl, 'src', 'app.interface.ejs'],
      [src, 'app.interface.ts'],
      WRITE_ALWAYS,
      isJs
    ),
    tmpl(
      [tpl, 'src', 'typings.d.ejs'],
      [src, 'typings.d.ts'],
      WRITE_ALWAYS,
      isJs
    )
  ]

  // generate name.json files for test environments
  configDefault.tests.environmentsAllowingSeedData.forEach(envName => {
    const defaultConfigTest = makeConfig.configTest(generator, envName)
    const configTestPath = generator.destinationPath(
      `${appConfigPath}/${envName}.js`
    )
    const configTest = (specs._testJson =
      (generator.fs.exists(configTestPath) && require(configTestPath)) ||
      defaultConfigTest)
    const connectionStrings = [
      'mongodb',
      'mysql',
      'nedb',
      'postgres',
      'rethinkdb',
      'sqlite',
      'mssql'
    ]
    connectionStrings.forEach(name => {
      configTest[name] = configTest[name] || defaultConfigTest[name]
    })

    todos.push(
      // json(
      //   configTest,
      //   [appConfigPath, `${envName}.json`],
      //   WRITE_ALWAYS,
      //   !envName
      // )
      tmpl([tpl, 'json.ejs'], [appConfigPath, `${envName}.js`], false, false, {
        json: prettier
          .format('let a = ' + JSON.stringify(configTest), {
            semi: false,
            singleQuote: true,
            parser: 'babel'
          })
          .slice(8)
      })
    )
  })

  if (isJs) {
    todos = todos.concat(
      copy([tpl, '_eslintrc.js'], '.eslintrc.js', WRITE_IF_NEW)
    )
  } else {
    todos = todos.concat(
      json(
        tslintjson,
        'tslint.json',
        WRITE_ALWAYS,
        tslintExists && !tslintJsonChanged
      ),
      tmpl([tpl, 'tsconfig.json'], 'tsconfig.json', WRITE_IF_NEW),
      copy([tpl, 'tsconfig.test.json'], 'tsconfig.test.json', WRITE_IF_NEW)
    )
  }

  // Generate modules
  generatorFs(generator, context, todos)

  // Update dependencies
  generator.dependencies = [
    '@feathersjs/configuration',
    '@feathersjs/errors',
    '@feathersjs/express',
    '@feathersjs/feathers',
    'compression',
    'cors',
    'feathers-hooks-common',
    'helmet',
    'lodash.merge',
    'serve-favicon',
    'winston',
    'dotenv',
    'cross-env'
  ]

  generator.devDependencies = ['mocha', 'nodemon', 'request', 'request-promise']

  if (isJs) {
    generator.devDependencies = generator.devDependencies.concat([
      'eslint',
      'eslint-config-standard',
      'eslint-plugin-import',
      'eslint-plugin-node',
      'eslint-plugin-promise',
      'eslint-plugin-standard'
    ])
  } else {
    generator.devDependencies = generator.devDependencies.concat([
      '@types/feathersjs__configuration',
      '@types/feathersjs__errors',
      '@types/feathersjs__feathers',
      '@types/lodash.merge',
      '@types/mocha',
      '@types/request-promise',
      'ts-mocha',
      'ts-node',
      'tslint',
      'typescript'
    ])

    if (specs.app.providers.indexOf('rest') !== -1) {
      generator.devDependencies = generator.devDependencies.concat([
        '@types/feathersjs__express',
        '@types/compression',
        '@types/cors',
        '@types/helmet',
        '@types/serve-favicon'
      ])
    }

    if (specs.app.providers.indexOf('socketio') !== -1) {
      generator.devDependencies.push('@types/feathersjs__socketio')
    }

    if (specs.app.providers.indexOf('primus') !== -1) {
      generator.devDependencies.push('@types/feathersjs__primus')
    }
  }

  specs.app.providers.forEach(provider => {
    const type = provider === 'rest' ? 'express' : provider

    generator.dependencies.push(`@feathersjs/${type}`)
  })

  if (specs.app.seedData) {
    generator.dependencies.push('@feathers-plus/test-utils')
    if (!isJs) {
      // generator.dependencies.push('@types/???');
    }
  }

  const extraDeps = specs['additional-dependencies']
  if (extraDeps && extraDeps.length) {
    generator.dependencies = generator.dependencies.concat(extraDeps)
  }

  const extraDevDeps = specs['additional-devDependencies']
  if (extraDevDeps && extraDevDeps.length) {
    generator.devDependencies = generator.devDependencies.concat(extraDevDeps)
  }

  debug('dependencies', generator.dependencies)
  debug('dev-dependencies', generator.devDependencies)

  generator._packagerInstall(generator.dependencies, { save: true })
  generator._packagerInstall(generator.devDependencies, { saveDev: true })

  debug('app() ended')
}

// eslint-disable-next-line no-unused-vars
function inspector (desc, obj, depth = 6) {
  console.log(desc)
  console.log(inspect(obj, { colors: true, depth }))
}
