const chalk = require('chalk')
const makeDebug = require('debug')
const os = require('os')
const { join, extname } = require('path')
const { platform } = require('os')
const doesFileExist = require('./does-file-exist')
const format = require('prettier-eslint')
const { insertFragment } = require('./code-fragments')

const through = require('through2')
const gutil = require('gulp-util')
const filter = require('gulp-filter')
const prettierEslint = require('prettier-eslint')
const applySourceMap = require('vinyl-sourcemaps-apply')

const PluginError = gutil.PluginError
const debug = makeDebug('generator-feathers-plus:generator-fs')
const pathSepChar = platform() === 'win32' ? '\\' : '/'
const EOL = os.EOL
const fileNames = []

module.exports = {
  generatorFs,
  getFileNames: () => fileNames
}

function gulpPrettierEslint () {
  function transform (file, encoding, callback) {
    if (file.isNull()) { return callback(null, file) }
    if (file.isStream()) {
      return callback(new PluginError(
        'gulp-prettier-eslint',
        'Streaming not supported'
      ))
    }

    let data
    const str = file.contents.toString('utf8')

    try {
      data = prettierEslint({
        text: str,
        filePath: file.path,
        eslintConfig: {
          env: {
            node: true,
            es6: true,
            mocha: true
          },
          extends: 'standard',
          globals: {
            Atomics: 'readonly',
            SharedArrayBuffer: 'readonly'
          },
          parserOptions: {
            ecmaVersion: 2018
          },
          rules: {
            'max-len': 'warn',
            'eol-last': 'off',
            'quote-props': ['error', 'as-needed'],
            'space-before-function-paren': ['error', 'always']
          }
        },
        prettierOptions: {
          parser: 'babel'
        }
      })
    } catch (err) {
      return callback(new PluginError('gulp-prettier-eslint', err))
    }

    if (data && data.v3SourceMap && file.sourceMap) {
      applySourceMap(file, data.v3SourceMap)
      file.contents = Buffer.from(data.js)
    } else {
      file.contents = Buffer.from(data)
    }

    callback(null, file)
  }

  return through.obj(transform)
}

function generatorFs (generator, context1, todos) {
  debug('generatorFs()')
  const f = filter(['**/*.js'], { restore: true })
  generator.registerTransformStream(f)
  generator.registerTransformStream(gulpPrettierEslint())
  generator.registerTransformStream(f.restore)
  generator.conflicter.force = !generator._specs.options.inspectConflicts

  const freeze = (generator._specs.options.freeze || []).map(path =>
    normalizePathSepChar(path)
  )

  // type:   'tpl' - expand template, 'copy' - copy file, 'json' - write JSON as file, 'write' - write string as file
  // src:    path & file of template or source file. Array of folder names or str.
  // obj:    Object to write as JSON, or string to write as string
  // dest:   path & file of destination. Array to .join() or str.
  // ifNew:  true: Write file only if it does not yet exist, false: always write it.
  // ifSkip: true: Do not write this file, false: write it.
  // ctx:    Extra content to call template with.
  // Note that frozen files are never written.
  todos.forEach(({ type, src, obj, dest, ifNew, ifSkip, ctx }) => {
    dest = Array.isArray(dest) ? join(...dest) : dest
    src = Array.isArray(src) ? join(...src) : src
    const context = ctx ? Object.assign({}, context1, ctx) : context1

    const destinationPath = generator.destinationPath(dest)

    if (!ifSkip) {
      fileNames.push(destinationPath)
    }

    if (!ifSkip && (!ifNew || !doesFileExist(destinationPath))) {
      // todo Consider using isaacs/minimatch instead.
      if (freeze.includes(normalizePathSepChar(dest))) {
        generator.log(chalk.cyan('   freeze'), dest)
        return
      }

      // console.log('\ntype=', type, 'src=', src);

      switch (type) {
        case 'tpl':
          debug('tpl', destinationPath)
          generator.fs.copyTpl(
            generator.templatePath(src),
            destinationPath,
            Object.assign({}, context, {
              insertFragment: insertFragment(destinationPath)
            })
          )
          break
        case 'copy':
          debug('copy', generator.destinationPath(destinationPath))
          generator.fs.copy(
            generator.templatePath(src),
            generator.destinationPath(destinationPath)
          )
          break
        case 'json':
          debug('json', generator.destinationPath(destinationPath))
          generator.fs.writeJSON(
            generator.destinationPath(destinationPath),
            obj
          )
          break
        case 'write':
          debug('write', generator.destinationPath(destinationPath))
          generator.fs.write(
            generator.destinationPath(destinationPath),
            obj.join(EOL)
          )
          break
        default:
          throw new Error(`Unknown type ${type}. (generatorFs)`)
      }
      if (extname(destinationPath) === '.js') {
        generator.fs.write(
          destinationPath,
          format({
            text: generator.fs.read(destinationPath),
            eslintConfig: {
              env: {
                node: true,
                es6: true,
                mocha: true
              },
              extends: 'standard',
              globals: {
                Atomics: 'readonly',
                SharedArrayBuffer: 'readonly'
              },
              parserOptions: {
                ecmaVersion: 2018
              },
              rules: {
                'max-len': 'warn',
                'eol-last': 'off',
                'space-before-function-paren': ['error', 'always']
              }
            },
            prettierOptions: {
              parser: 'babel'
            }
          })
        )
      }
    } else {
      generator.log(chalk.cyan('     skip'), dest)
    }
  })

  debug('generatorFs() ended')
}

function normalizePathSepChar (str) {
  const sepOk = pathSepChar
  const sepBad = pathSepChar === '\\' ? '/' : '\\'

  return str.split(sepBad).join(sepOk)
}
