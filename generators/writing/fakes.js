
const makeDebug = require('debug')
const jsonSchemaSeeder = require('json-schema-seeder')
const { join } = require('path')
const doesFileExist = require('../../lib/does-file-exist')
const { generatorFs } = require('../../lib/generator-fs')

const fs = require('fs')
const prettier = require('prettier')
const { parse } = require('@babel/parser')
const { default: template } = require('@babel/template')
const { default: traverse } = require('@babel/traverse')
const { default: generate } = require('@babel/generator')

const debug = makeDebug('generator-feathers-plus:writing:fakes')

module.exports = {
  fakes
}

function fakes (generator, props, specs, context, state) {
  debug('fakes()')

  const {
    // Expanded definitions.
    feathersSpecs,
    // Paths.
    appConfigPath,
    // TypeScript & semicolon helpers.
    js,
    // Abstract .js and .ts statements.
    tplJsOrTs,
    tplJsOnly,
    tplTsOnly,
    tplImports,
    tplModuleExports,
    tplExport,
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
    copy,
    json,
    source,
    stripSlashes,
    // Abbreviations for paths to templates used in building 'todos'.
    tpl,
    configPath,
    src,
    srcPath,
    mwPath,
    serPath,
    namePath,
    qlPath,
    testPath,
    // Other abbreviations using in building 'todos'.
    libDir,
    testDir,
    // Utilities.
    generatorsInclude,
    // Constants.
    WRITE_IF_NEW,
    WRITE_ALWAYS,
    SKIP_WRITE,
    DONT_SKIP_WRITE
  } = state

  const schemas = {}
  const adapters = {}

  // Get the app's existing default.js or the default one.
  const existingDefaultJsPath = generator.destinationPath(join(appConfigPath, 'default.js'))
  const defaultJsPath = doesFileExist(existingDefaultJsPath)
    ? existingDefaultJsPath : `${configPath}/default`

  const defaultJs = require(defaultJsPath)
  if (defaultJs.fakeData && defaultJs.fakeData.noFakesOnAll) return
  if (!defaultJs.fakeData) {
    // load defaults
  }

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
  // load default
  const fakeConfigPath = `${configPath}/default.js`
  const fakeConfigCode = fs.readFileSync(fakeConfigPath, 'utf8')
  const fakeConfigObjectExpression = parse(fakeConfigCode).program.body[0].expression.right
  // update AST
  // merge two ObjectExpressions
  function astObjectExpressionMerge (a, b) {
    const aMap = new Map(a.properties.map((o, i) => [o.key.name, i]))
    b.properties.forEach(bOp => {
      const key = bOp.key.name // 'mongodb'
      if (aMap.has(key)) {
        const aOp = a.properties[aMap.get(key)]
        // key node exists
        if (aOp.value.type === 'ObjectExpression' && bOp.value.type === 'ObjectExpression') {
          astObjectExpressionMerge(aOp, bOp)
        } else if (aOp.value.type === 'ArrayExpression' && bOp.value.type === 'ArrayExpression') {
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
  astObjectExpressionMerge(moduleExports.node, fakeConfigObjectExpression)

  const jssOptions = merge({
    faker: {
      fk: str => `->${str}`,
      exp: str => `=>${str}`
    }
  }, defaultJs.fakeData || {})

  Object.keys(specs.services || {}).forEach(serviceName => {
    const specsServices = specs.services[serviceName]

    if (specsServices.adapter !== 'generic') {
      adapters[serviceName] = specsServices.adapter
      schemas[serviceName] = feathersSpecs[serviceName]
    }
  })

  const seeder = jsonSchemaSeeder(jssOptions)
  const data = seeder(schemas, adapters, { expContext: jssOptions.expContext })
  const fakeData = jssOptions.postGeneration
    ? jssOptions.postGeneration(data) : data

  const todos = [
    // copy([tpl, '_configs', 'default.js'], [appConfigPath, 'default.js'], WRITE_IF_NEW),
    source(
      [prettier.format(
        generate(
          configDefaultAst
        ).code,
        {
          semi: false,
          singleQuote: true,
          parser: 'babel'
        }
      )],
      [appConfigPath, 'default.js']
    ),
    json(fakeData, ['seeds', 'fake-data.json'])
  ]

  // Generate modules
  generatorFs(generator, context, todos)
}

// eslint-disable-next-line no-unused-vars
function inspector (desc, obj, depth = 6) {
  console.log(desc)
  console.log(inspect(obj, { colors: true, depth }))
}
