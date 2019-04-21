const fs = require('fs')
// const program = require('ast-query')
const esprima = require('esprima')
const escodegen = require('escodegen')

const defaultPath = './config/default.1.js'
const default2Path = './config/default.js'

const code = fs.readFileSync(defaultPath, 'utf8')
const code2 = fs.readFileSync(default2Path, 'utf8')

const ast = esprima.parse(code, {
  range: true,
  loc: true,
  tokens: true,
  comment: true
})
const ast3 = esprima.parse(code, {
  range: true,
  loc: true,
  tokens: true,
  comment: true
})
const ast2 = esprima.parse(code2, { range: true, tokens: true, comment: true })
const astC = escodegen.attachComments(ast, ast.comments, ast.tokens)
const astC3 = escodegen.attachComments(ast3, ast3.comments, ast3.tokens)
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
