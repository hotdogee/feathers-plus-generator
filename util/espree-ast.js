const fs = require('fs')
const espree = require('espree')
const escodegen = require('escodegen')

const defaultPath = './config/default.1.js'
const default2Path = './config/default.js'

const code = fs.readFileSync(defaultPath, 'utf8')
const code2 = fs.readFileSync(default2Path, 'utf8')

const ast = espree.parse(code)
const ast2 = espree.parse(code, {
  range: true,
  loc: true,
  tokens: true,
  comment: true
})
const astC = escodegen.attachComments(ast, ast.comments, ast.tokens)
const ast2C = escodegen.attachComments(ast2, ast2.comments, ast2.tokens)
console.log(escodegen.generate(ast, { comment: true }))
console.log(escodegen.generate(astC, { comment: true }))
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
esprima.parse(`{ environmentsAllowingSeedData: ['test'] }`)
