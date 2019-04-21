const makeDebug = require('debug')
const { inspect } = require('util')
const prettier = require('prettier')
const { generatorFs } = require('../../lib/generator-fs')

const { parse } = require('@babel/parser')
const { default: template } = require('@babel/template')
const { default: traverse } = require('@babel/traverse')
const { default: generate } = require('@babel/generator')

const debug = makeDebug('generator-feathers-plus:writing:connection')

module.exports = {
  connection
}

function connection (generator, props, specs, context, state) {
  if (!specs.connections) return
  debug('connection()')

  const {
    // Paths.
    appConfigPath,
    // TypeScript & semicolon helpers.
    js,
    isJs
  } = context

  const {
    // File writing functions.
    tmpl,
    json,
    source,
    // Paths to various folders
    tpl,
    src,
    srcPath,
    // Abbreviations using in building 'todos'.
    libDir,
    // Utilities.
    generatorsInclude,
    // Constants
    WRITE_ALWAYS
  } = state

  // Common abbreviations for building 'todos'.
  const newConfig = (specs._defaultJson = Object.assign(
    {},
    specs._defaultJson,
    specs._dbConfigs
  ))
  const connections = specs.connections
  const _adapters = specs._adapters
  const isGenerateConnection =
    generatorsInclude('connection') && !generatorsInclude('service')

  // CODE
  const configDefaultPath = generator.destinationPath(
    `${appConfigPath}/default.js`
  )
  let configDefaultCode
  if (generator.fs.exists(configDefaultPath)) {
    configDefaultCode = generator.fs.read(configDefaultPath)
  } else {
    configDefaultCode = prettier.format(
      'module.exports = ' + JSON.stringify(specs._defaultJson),
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
  // create dbConfigs ObjectExpression node
  const dbConfigsObjectExpression = template.ast(
    `module.exports = ${JSON.stringify(specs._dbConfigs)}`,
    {
      reserveComments: true
    }
  ).expression.right
  // loop through dbConfigs ObjectExpression properties
  dbConfigsObjectExpression.properties.forEach(objectProperty => {
    const key = objectProperty.key.value || objectProperty.key.name // 'mongodb'
    if (specs._defaultJson.hasOwnProperty(key)) {
      // key node exists
      // find and replace current key node
      for (let i = 0; i < moduleExports.node.properties.length; i++) {
        if (moduleExports.node.properties[i].key.name === key) {
          moduleExports.node.properties[i] = objectProperty
        }
      }
    } else {
      // no key node
      // insert into last position
      moduleExports.node.properties.push(objectProperty)
    }
  })

  const todos = !Object.keys(connections).length
    ? []
    : [
      // json(newConfig, [appConfigPath, 'default.js']),
      // tmpl([tpl, 'json.ejs'], [appConfigPath, 'default.js'], false, false, {
      //   json: prettier
      //     .format('let a = ' + JSON.stringify(newConfig), {
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
      tmpl([srcPath, 'app.ejs'], [libDir, `app.${js}`]),
      tmpl(
        [tpl, 'src', 'typings.d.ejs'],
        [src, 'typings.d.ts'],
        WRITE_ALWAYS,
        isJs
      )
    ]

  Object.keys(_adapters)
    .sort()
    .forEach(adapter => {
      const connectionsAdapter =
        adapter === 'sequelize-mssql' ? 'sequelize' : adapter

      if (connections[connectionsAdapter]) {
        // Force a regen for the adapter selected using `generate connection`.
        const forceWrite = isGenerateConnection && props.adapter === adapter

        todos.push(
          tmpl(
            [srcPath, '_adapters', _adapters[adapter]],
            [libDir, `${adapter}.${js}`],
            !forceWrite,
            false,
            { database: connections[connectionsAdapter].database }
          )
        )
      }
    })

  // Generate modules
  generatorFs(generator, context, todos)

  // Update dependencies
  generator.dependencies = generator.dependencies || [] // needed
  generator.dependencies = generator.dependencies.concat(specs._connectionDeps)
  generator._packagerInstall(generator.dependencies, { save: true })

  generatorFs(generator, context, todos)
}

// eslint-disable-next-line no-unused-vars
function inspector (desc, obj, depth = 6) {
  console.log(desc)
  console.log(inspect(obj, { colors: true, depth }))
}
