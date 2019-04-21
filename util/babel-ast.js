const fs = require('fs')
const prettier = require('prettier')
const t = require('@babel/types')
const { parse } = require('@babel/parser')
const { default: template } = require('@babel/template')
const { default: traverse } = require('@babel/traverse')
const { default: generate } = require('@babel/generator')

const defaultPath = './config/default.1.js'
const default2Path = './config/default.2.js'

const code = fs.readFileSync(defaultPath, 'utf8')
const code2 = fs.readFileSync(default2Path, 'utf8')

const ast = parse(code)
const ast2 = parse(code2)

const ast3 = template.ast(code, { preserveComments: true })

// Traverse the AST to find the nodes we need.
// traverse(ast, {
//   ObjectProperty (path) {
//     console.log(path.parentPath.parent.type, path.key, path.node.key.name)
//   }
// })
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
const testsObjectProperty = template.ast(
  `module.exports = { tests: { environmentsAllowingSeedData: ['test'] } }`,
  {
    reserveComments: true
  }
).expression.right.properties[0]
// traverse(
//   moduleExports.node,
//   {
//     ObjectProperty (path) {
//       console.log(path.parentPath.parent.type, path.key, path.node.key.name)
//     }
//   },
//   {
//     scope: moduleExports.scope
//   }
// )
// moduleExports.node.properties.forEach(objectProperty => {
//   console.log(objectProperty.key.name)
//   if (objectProperty.key.name === 'tests') {
//   }
// })
for (let i = 0; i < moduleExports.node.properties.length; i++) {
  if (moduleExports.node.properties[i].key.name === 'tests') {
    moduleExports.node.properties[i] = testsObjectProperty
  }
}

console.log(
  prettier.format(
    generate(ast, { retainLines: true, retainFunctionParens: true }, code).code,
    {
      semi: false,
      singleQuote: true,
      parser: 'babel'
    }
  )
)

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
