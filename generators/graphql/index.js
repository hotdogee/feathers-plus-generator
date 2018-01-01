
const chalk = require('chalk');
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const Generator = require('../../lib/generator');

const serviceSpecsExpand = require('../../lib/service-specs-expand');
const serviceSpecsToGraphql = require('../../lib/service-specs-to-graphql');
const stringifyPlus = require('../../lib/stringify-plus');
const generatorFs = require('../../lib/generator-fs');
const { insertFragment, refreshCodeFragments } = require('../../lib/code-fragments');
const { initSpecs, updateSpecs } = require('../../lib/specs');

const templatePath = path.join(__dirname, 'templates');
const stripSlashes = name => name.replace(/^(\/*)|(\/*)$/g, '');

module.exports = class ServiceGenerator extends Generator {
  async initializing() {
    this.fragments = await refreshCodeFragments();
    this.specs = initSpecs('graphql');
  }

  prompting() {
    const graphqlSpecs = this.specs.graphql;
    this.checkPackage();

    const { props, specs } = this;
    const { mapping, feathersSpecs } = serviceSpecsExpand(specs);

    if (!Object.keys(mapping.feathers).length) {
      this.log('No services are configured as being served by GraphQL. ');
      process.exit(0);
    }

    this.log(chalk.green([
      'Modules tailored to your schemas will be generated to run GraphQL Queries using',
      '- Feathers service calls, and',
      '- BatchLoaders which cache and batch Feathers service calls, and',
      '- Dynamically generated SQL statements.',
      'You may modify one or more of these modules according to your needs.',
      '',
      'If you want to use several of these modules, you can switch between them',
      'by rerunning "feathers-plus generate graphql" and switching options.',
      '',
    ].join('\n')));

    props.specs = specs;
    props.feathersSpecs = feathersSpecs;
    props.mapping= mapping;
    props.stringifyPlus = stringifyPlus;
    props.graphqlSchemas = serviceSpecsToGraphql(feathersSpecs);

    props.name = 'graphql';
    const prompts = [
      {
        type: 'list',
        name: 'strategy',
        message: 'How should Queries be completed?.',
        default() {
          return graphqlSpecs.strategy || 'services';
        },
        choices: [
          {
            name: 'Using standalone Feathers service calls.',
            value: 'services',
          }, {
            name: 'Using BatchLoaders.',
            value: 'batchloaders',
          }, {
            name: 'Using dynamic SQL statements.',
            value: 'sql',
          }
        ]
      }, {
        name: 'path',
        message: 'Which path should the service be registered on?',
        when: !props.path,
        default(answers) {
          return graphqlSpecs.path || `/${_.kebabCase(answers.name || props.name)}`;
        },
        validate(input) {
          if(input.trim() === '') {
            return 'Service path can not be empty';
          }

          return true;
        }
      }, {
        name: 'requiresAuth',
        message: 'Does the service require authentication?',
        type: 'confirm',
        default() {
          return graphqlSpecs.requiresAuth || false;
        },
        when: !!(this.defaultConfig.authentication && !props.authentication)
      }
    ];

    return this.prompt(prompts).then(answers => {
      const name = props.name;

      this.props = Object.assign(
        { requiresAuth: false },
        props,
        answers,
        {
          snakeName: _.snakeCase(name),
          kebabName: _.kebabCase(name),
          camelName: _.camelCase(name)
        }
      );

      this.logSteps && console.log('>>>>> graphql generator finished prompting()');
    });
  }

  writing() {
    this.logSteps && console.log('>>>>> graphql generator started writing()');

    const { adapter, kebabName } = this.props;
    const mainFile = this.destinationPath(this.libDirectory, 'services', kebabName, `${kebabName}.service.js`);
    const modelTpl = `${adapter}${this.props.authentication ? '-user' : ''}.js`;
    const hasModel = fs.existsSync(path.join(templatePath, 'model', modelTpl));
    const context = Object.assign({}, this.props, {
      libDirectory: this.libDirectory,
      modelName: hasModel ? `${kebabName}.model` : null,
      path: stripSlashes(this.props.path),
    });

    const todos = [
      // Files which are written only if they don't exist. They are never rewritten.
      { type: 'tpl',  source: '../../templates-shared/test.name.test.ejs',
                      destination: [this.testDirectory, 'services', `${kebabName}.test.js`],
                      ifNew: true },

      // Files rewritten every (re)generation.
      { type: 'tpl',  source: `graphql.hooks${this.props.authentication ? '.auth' : ''}.ejs`,
                      destination: [this.libDirectory, 'services', kebabName, `${kebabName}.hooks.js`] },
      { type: 'tpl',  source: 'graphql.schemas.ejs',       destination: [this.libDirectory, 'services', 'graphql', 'graphql.schemas.js'] },
      { type: 'tpl',  source: 'graphql.service.ejs',       destination: mainFile },
      { type: 'tpl',  source: 'batchloader.resolvers.ejs', destination: [this.libDirectory, 'services', 'graphql', 'batchloader.resolvers.js'] },
      { type: 'tpl',  source: 'service.resolvers.ejs',     destination: [this.libDirectory, 'services', 'graphql', 'service.resolvers.js'] },
      { type: 'tpl',  source: 'sql.execute.ejs',           destination: [this.libDirectory, 'services', 'graphql', 'sql.execute.js'] },
      { type: 'tpl',  source: 'sql.metadata.ejs',          destination: [this.libDirectory, 'services', 'graphql', 'sql.metadata.js'] },
      { type: 'tpl',  source: 'sql.resolvers.ejs',         destination: [this.libDirectory, 'services', 'graphql', 'sql.resolvers.js'] },
      { type: 'tpl',  source: '../../templates-shared/services.index.ejs',
                      destination: [this.libDirectory, 'services', 'index.js'] },
    ];

    generatorFs(this, context, todos);

    this._packagerInstall([
      'graphql',
      // '@feathers-plus/graphql', todo *******************************************************
      'merge-graphql-schemas',
    ], { save: true });

    this.logSteps && console.log('>>>>> graphql generator finished writing()', todos.map(todo => todo.source || todo.sourceObj));
  }

  install () {
    updateSpecs(this.specs, 'graphql', this.props);
    this.logSteps && console.log('>>>>> graphql generator finished install()');
  }

  end () {
    this.logSteps && console.log('>>>>> graphql generator finished end()');
  }
};

const { inspect } = require('util');
function inspector(desc, obj, depth = 5) {
  console.log(`\n${desc}`);
  console.log(inspect(obj, { depth, colors: true }));
}
