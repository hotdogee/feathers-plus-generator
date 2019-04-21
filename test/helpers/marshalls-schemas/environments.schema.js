// Define the Feathers schema for service `environments`. (Can be re-generated.)
// !code: imports // !end
// !code: init // !end

// Define the model using JSON-schema
let schema = {
  // !<DEFAULT> code: schema_header
  title: 'Environments',
  description: 'Environments database.',
  // !end
  // !code: schema_definitions // !end

  // Required fields.
  required: [
    // !code: schema_required
    'name',
    'slug',
    'clientId'
    // !end
  ],
  // Fields with unique values.
  uniqueItemProperties: [
    // !code: schema_unique // !end
  ],

  // Fields in the model.
  properties: {
    // !code: schema_properties
    name: {
      faker: 'address.country'
    },
    slug: {
      faker: {
        exp: 'rec.name.toLowerCase().replace(" ", "-")'
      }
    },
    clientId: {
      type: 'ID'
    },
    notes: {
      faker: 'lorem.paragraph'
    },
    startingPanoId: {
      type: 'ID'
    },
    headerColor: {
      faker: 'internet.color'
    },
    headerLogoUrl: {
      faker: 'random.image'
    },
    headerLogoData: {
      type: 'object',
      properties: {}
    }
    // !end
  }
  // !code: schema_more // !end
}

// Define optional, non-JSON-schema extensions.
let extensions = {
  // GraphQL generation.
  graphql: {
    // !code: graphql_header
    name: 'Environment',
    service: {
      sort: { _id: 1 }
    },
    // sql: {
    //   sqlTable: 'Environments',
    //   uniqueKey: '_id',
    //   sqlColumn: {
    //     __authorId__: '__author_id__',
    //   },
    // },
    // !end
    discard: [
      // !code: graphql_discard // !end
    ],
    add: {
      // !<DEFAULT> code: graphql_add
      // __author__: { type: '__User__!', args: false, relation: { ourTable: '__authorId__', otherTable: '_id' } },
      // !end
    }
    // !code: graphql_more // !end
  }
}

// !code: more // !end

let moduleExports = {
  schema,
  extensions
  // !code: moduleExports // !end
}

// !code: exports // !end
module.exports = moduleExports

// !code: funcs // !end
// !code: end // !end
