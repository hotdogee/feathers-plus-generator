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

const debug = makeDebug('generator-feathers-plus:writing:test')

module.exports = {
  test
}

function test (generator, props, specs, context, state) {
  debug('test()')

  const {
    // Paths.
    appConfigPath,
    // TypeScript & semicolon helpers.
    js,
    isJs,
    // Abstract .js and .ts statements.
    tplJsOrTs,
    tplJsOnly,
    tplTsOnly,
    tplImports,
    tplModuleExports,
    // lodash utilities.
    camelCase,
    kebabCase,
    snakeCase,
    upperFirst,
    // Utilities.
    merge,
    EOL,
    stringifyPlus
  } = context

  const {
    // File writing functions.
    tmpl,
    // Abbreviations for paths to templates used in building 'todos'.
    src,
    testPath,
    // Constants.
    WRITE_IF_NEW
  } = state

  // props = {
  //   testType = ['hookUnit', 'hookInteg', 'serviceUnit', 'serviceInteg', 'authBase', 'authServices'],
  //   hookName!, serviceName!
  // }
  const testType = props.testType
  let todos = []

  if (testType === 'authBase') {
    todos = [
      tmpl(
        [testPath, 'authentication.base.test.ejs'],
        ['test', `authentication.base.test.${js}`]
      )
    ]

    writeDefaultJsonClient(generator, context)
  }

  if (testType === 'authServices') {
    todos = [
      tmpl(
        [testPath, 'authentication.services.test.ejs'],
        ['test', `authentication.services.test.${js}`]
      )
    ]

    writeDefaultJsonClient(generator, context)
  }

  if (testType === 'hookUnit' || testType === 'hookInteg') {
    const hookName1 = props.hookName
    const hookSpec = specs.hooks[hookName1]
    const hookFileName = hookSpec.fileName
    const htt = testType === 'hookUnit' ? '.unit' : '.integ'
    const specHook = specs.hooks[hookFileName]
    const hookName = specHook.camelName

    let hookInfo,
      sn1,
      sfa,
      sfBack,
      pathToHook,
      pathToTest,
      pathTestToHook,
      pathTestToApp
    // eslint-disable-next-line no-unused-vars
    let x

    if (hookSpec.ifMulti !== 'y') {
      const specsService = specs.services[hookSpec.singleService]
      sn1 = specsService.fileName
      const sfa1 = generator.getNameSpace(specsService.subFolder)[1]

      hookInfo = {
        hookName: hookName1,
        appLevelHook: false,
        serviceName: specsService.name,
        hookFileName,
        pathToHook: `services/${
          sfa1.length ? `${sfa1.join('/')}/` : ''
        }${sn1}/hooks/${hookFileName}`
      }
    } else {
      hookInfo = {
        hookName: hookName1,
        appLevelHook: true,
        serviceName: '*none',
        hookFileName,
        pathToHook: `hooks/${hookFileName}`
      }
    }

    if (hookInfo.appLevelHook) {
      pathToHook = `hooks/${hookFileName}`
      pathToTest = `${pathToHook}${htt}.test`
      pathTestToHook = `../../${src}/${pathToHook}`
      pathTestToApp = '../../'
    } else {
      const specService = specs.services[hookInfo.serviceName]
      const sn = specService.fileName
      ;[x, sfa, sfBack] = generator.getNameSpace(specService.subFolder)

      pathToHook = `services/${
        sfa.length ? `${sfa.join('/')}/` : ''
      }${sn}/hooks/${hookFileName}`
      pathToTest = `${pathToHook}${htt}.test`
      pathTestToHook = `${sfBack}../../../../${src}/${pathToHook}`
      pathTestToApp = `${sfBack}../../../../`
    }

    context = Object.assign({}, context, {
      hookName,
      hookFileName: specHook.fileName,
      htt,
      pathToHook,
      pathToTest,
      pathTestToHook,
      pathTestToApp,
      userEntity: specs.authentication ? specs.authentication.entity : null,
      serviceFileName: `${hookSpec.ifMulti !== 'y' ? sn1 : ''}/hooks/`
    })

    todos = [
      tmpl(
        [testPath, 'hooks', 'hook.unit.test.ejs'],
        ['test', `${pathToTest}.${js}`],
        WRITE_IF_NEW,
        testType !== 'hookUnit'
      ),
      tmpl(
        [testPath, 'hooks', 'hook.integ.test.ejs'],
        ['test', `${pathToTest}.${js}`],
        WRITE_IF_NEW,
        testType === 'hookUnit'
      )
    ]

    if (testType === 'hookInteg') {
      generator._packagerInstall(
        isJs
          ? ['@feathers-plus/test-utils']
          : [
            // '@types/???',
            '@feathers-plus/test-utils'
          ],
        { save: true }
      ) // because seeding DBs also uses it
    }
  }

  if (testType === 'serviceUnit' || testType === 'serviceInteg') {
    const serviceName = props.serviceName
    const serviceSpec = specs.services[serviceName]
    const serviceFileName = serviceSpec.fileName
    const stt = testType === 'serviceUnit' ? '.server' : '.client'
    // eslint-disable-next-line no-unused-vars
    const [x, sfa, sfBack] = generator.getNameSpace(serviceSpec.subFolder)
    const ssf = sfa.length ? `${sfa.join('/')}/` : ''

    const pathToService = `services/${ssf}${serviceFileName}/${serviceFileName}.service.${js}`
    const pathToTest =
      pathToService.substr(0, pathToService.length - 3) +
      `${stt}.test` +
      pathToService.substr(-3)
    const pathTestToApp = `${sfBack}../../../`

    context = Object.assign({}, context, {
      serviceName,
      serviceFileName,
      servicePath: serviceSpec.path,
      stt,
      pathToTest,
      pathTestToApp
    })

    todos = [
      tmpl(
        [testPath, 'services', 'name', 'service.server.test.ejs'],
        ['test', pathToTest],
        WRITE_IF_NEW,
        testType !== 'serviceUnit'
      ),
      tmpl(
        [testPath, 'services', 'name', 'service.client.test.ejs'],
        ['test', pathToTest],
        WRITE_IF_NEW,
        testType === 'serviceUnit'
      )
    ]

    generator._packagerInstall(
      isJs
        ? ['@feathers-plus/test-utils']
        : [
          // '@types/???',
          '@feathers-plus/test-utils'
        ],
      { save: true }
    ) // because seeding DBs also uses it
  }

  // Generate modules
  generatorFs(generator, context, todos)
}

function writeDefaultJsonClient (generator, context) {
  const testConfig = {
    tests: {
      environmentsAllowingSeedData: [],
      local: {
        password: 'password'
      },
      client: {
        port: 3030,
        ioOptions: {
          transports: ['websocket'],
          forceNew: true,
          reconnection: false,
          extraHeaders: {}
        },
        primusOptions: { transformer: 'ws' },
        restOptions: { url: 'http://localhost:3030' },
        overriddenAuth: {}
      }
    }
  }
  const config = context.merge({}, generator._specs._defaultJson, testConfig)

  // CODE
  const configDefaultPath = generator.destinationPath(
    `${context.appConfigPath}/default.js`
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
  // update AST
  // create testConfig ObjectExpression node
  const testConfigObjectExpression = template.ast(
    prettier.format(`module.exports = ${JSON.stringify(testConfig)}`, {
      semi: false,
      singleQuote: true,
      parser: 'babel'
    }),
    {
      reserveComments: true
    }
  ).expression.right
  // merge two ObjectExpressions
  function astObjectExpressionMerge (a, b) {
    if (!a.properties) {
      console.log(a, b)
    }
    const aMap = new Map(a.properties.map((o, i) => [o.key.name, i]))
    b.properties.forEach(bOp => {
      const key = bOp.key.name // 'mongodb'
      if (aMap.has(key)) {
        const aOp = a.properties[aMap.get(key)]
        // key node exists
        if (
          aOp.value.type === 'ObjectExpression' &&
          bOp.value.type === 'ObjectExpression'
        ) {
          astObjectExpressionMerge(aOp.value, bOp.value)
        } else if (
          aOp.value.type === 'ArrayExpression' &&
          bOp.value.type === 'ArrayExpression'
        ) {
          if (bOp.value.elements.length !== 0) {
            a.properties[aMap.get(key)] = bOp
          }
        } else {
          // find and replace current key node
          a.properties[aMap.get(key)] = bOp
          // for (let i = 0; i < a.properties.length; i++) {
          //   if (a.properties[i].key.name === key) {
          //     a.properties[i] = bOp
          //   }
          // }
        }
      } else {
        // no key node
        // insert into last position
        a.properties.push(bOp)
      }
    })
  }
  // moduleExports.node.properties[0].key
  // testConfigObjectExpression.properties[0].key
  // moduleExports.node.properties[4].value.properties[0].value
  // testConfigObjectExpression.properties[0].value.properties[0].value
  // moduleExports.node.properties[4].value.properties[0].value.elements
  // testConfigObjectExpression.properties[0].value.properties[0].value.elements
  astObjectExpressionMerge(moduleExports.node, testConfigObjectExpression)

  generator._specs._defaultJson = config

  // generator.fs.writeJSON(
  //   generator.destinationPath(context.appConfigPath, 'default.json'),
  //   config
  // )
  // generator.fs.copyTpl(
  //   generator.templatePath(join(__dirname, 'templates', 'json.ejs')),
  //   generator.destinationPath(join(context.appConfigPath, 'default.js')),
  //   Object.assign({}, context, {
  //     insertFragment: insertFragment(generator.destinationPath(join(context.appConfigPath, 'default.js')))
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
