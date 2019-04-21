const fs = require('fs')
const prettier = require('prettier')
const t = require('@babel/types')
const { parse } = require('@babel/parser')
const { default: template } = require('@babel/template')
const { default: traverse } = require('@babel/traverse')
const { default: generate } = require('@babel/generator')
const merge = require('lodash.merge')

const defaultPath = './config/default.js'

const code = fs.readFileSync(defaultPath, 'utf8')

const ast = parse(code)

// Traverse the AST to find the module.exports node.
var moduleExports
traverse(ast, {
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
const specs = {
  _defaultJson: require(defaultPath),
  _dbConfigs: {
    mongodb: 'mongodb://localhost:27017/2_g_app',
    mysql: process.env.MYSQL || 'mysql://root:binfluxiot@localhost:3306/infans1'
  }
}
// merge({}, specs._defaultJson, {
//   tests: {
//     environmentsAllowingSeedData: [ '321'
//     ],
//     local: {
//       password: 'password'
//     },
//     client: {
//       port: 3030,
//       ioOptions: {
//         transports: [ 'websocket' ],
//         forceNew: true,
//         reconnection: false,
//         extraHeaders: {}
//       },
//       primusOptions: { transformer: 'ws' },
//       restOptions: { url: 'http://localhost:3030' },
//       overriddenAuth: {}
//     }
//   }
// })
const testConfig = {
  tests: {
    environmentsAllowingSeedData: [
    ],
    local: {
      password: 'password'
    },
    client: {
      port: 3030,
      ioOptions: {
        transports: [ 'websocket' ],
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
const testConfigObjectExpression = template.ast(
  prettier.format(`module.exports = ${JSON.stringify(testConfig)}`,
    {
      semi: false,
      singleQuote: true,
      parser: 'babel'
    }
  ),
  {
    reserveComments: true
  }
).expression.right
// update AST
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
      if (aOp.value.type === 'ObjectExpression' && bOp.value.type === 'ObjectExpression') {
        astObjectExpressionMerge(aOp.value, bOp.value)
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
astObjectExpressionMerge(moduleExports.node, testConfigObjectExpression)

console.log(prettier.format(generate(ast, { retainLines: true, retainFunctionParens: true }, code).code, {
  semi: false,
  singleQuote: true,
  parser: 'babel'
}))

// console.log(template.ast('tests: {}', { preserveComments: true }))
// console.log(
//   generate(ast, { retainLines: true }, code).code
// )
// console.log(
//   generate(ast, { retainLines: true }).code
// )
// console.log(
//   generate(ast).code
// )
// console.log(generate(ast2).code)
// module.exports = {
//   host: 'localhost',
//   port: 3030,
//   public: '../public/',
//   // comment1
//   paginate: {
//     // comment2
//     default: 10,
//     max: 50
//   },
//   tests: {}
// };
ast.body[0].expression.right.properties[4].value.properties.push({
  type: 'Property',
  key: { type: 'Identifier', name: 'environmentsAllowingSeedData' },
  computed: false,
  value: {
    type: 'ArrayExpression',
    elements: [{ type: 'Literal', value: 'test', raw: "'test'" }]
  },
  kind: 'init',
  method: false,
  shorthand: false
})
