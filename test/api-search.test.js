var utils = require('./test-utils');
var assert = require('chai').assert;
var fs = require('fs');

var Domain = require('../lib/database').Domain;

suite('Search API', function() {
  var server;
  var context;
  var temporaryDatabase;

  setup(function() {
    temporaryDatabase = utils.createTemporaryDatabase();
    context = temporaryDatabase.get();
    server = utils.setupServer(context);
  });

  teardown(function() {
    temporaryDatabase.teardown();
    temporaryDatabase = undefined;
    server.close();
  });

  function testSearch(path, message, host) {
    var setup, callback;
    var callbacks = Array.prototype.slice.call(arguments, 3);
    if (callbacks.length > 1) {
      setup = callbacks[0];
      callback = callbacks[1];
    } else {
      callback = callbacks[0];
    }
    test('GET ' + path + ' ' + message, function(done) {
      if (setup) setup();
      var options = {
        host: 'localhost',
        port: utils.testPort,
        path: path,
        headers: { Host: host }
      };
      utils
        .get(path, { Host: host })
        .next(function(response) {
          var normalizedBody = normalizeSearchResult(response.body);
          try {
            normalizedBody = JSON.parse(normalizedBody);
          } catch(error) {
            console.log(normalizedBody);
            throw error;
          }
          callback({
            statusCode:     response.statusCode,
            body:           response.body,
            normalizedBody: normalizedBody
          });
          done();
        })
        .error(function(error) {
          done(error);
        });
    });
  }

  function normalizeSearchResult(searchResult) {
    return searchResult.replace(/"time-ms":\s*(?:[1-9]\d*|0)([,\}])/, '"time-ms":0$1');
  }

  suite('with fixture loaded', function() {
    setup(function() {
      utils.loadDumpFile(context, __dirname + '/fixture/companies/ddl.grn');
      utils.loadDumpFile(context, __dirname + '/fixture/companies/configurations.grn');
      utils.loadDumpFile(context, __dirname + '/fixture/companies/data.grn');
    });

    testSearch('/2011-02-01/search?q=Hongo',
               'should hit one entry',
               'search-companies-00000000000000000000000000.localhost',
      function(response) {
        var expected = { // FIXME
          rank: '-text_relevance',
          'match-expr': "(label 'Hongo')",
          hits: {
            found: 1,
            start: 0,
            hit: [
              { id: 'id3' }
            ]
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?q=Tokyo',
               'should hit three entries',
               'search-companies-00000000000000000000000000.localhost',
      function(response) {
        var expected = {
          rank: '-text_relevance',
          'match-expr': "(label 'Tokyo')",
          hits: {
            found: 3,
            start: 0,
            hit: [
              { id: 'id1' },
              { id: 'id3' },
              { id: 'id9' }
            ]
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?q=Hongo&' +
                 'return-fields=address,description,name,age,product,unknown',
               'should return field values of result returnable fields ' +
                 'in the list of return-fields',
               'search-companies-00000000000000000000000000.localhost',
      function(response) {
        var expected = { // FIXME
          rank: '-text_relevance',
          'match-expr': "(label 'Hongo')",
          hits: {
            found: 1,
            start: 0,
            hit: [{
              id: 'id3',
              data: {
                address: ['Hongo, Tokyo, Japan'],
                description: [''],
                name: ['ClearCode Inc.'],
                age: [3],
                product: ['groonga']
                // unknown (missing) field is simply ignored.
              }
            }]
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?q=Hongo&' +
                 'return-fields=unknown1,unknown2',
               'should return blank "data" by return-fields filled by unexisting fields',
               'search-companies-00000000000000000000000000.localhost',
      function(response) {
        var expected = { // FIXME
          rank: '-text_relevance',
          'match-expr': "(label 'Hongo')",
          hits: {
            found: 1,
            start: 0,
            hit: [{
              id: 'id3',
              data: {}
            }]
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?bq=unknown:\'Foo\'',
               'should be 400 error for search query with unexisting field',
               'search-companies-00000000000000000000000000.localhost',
      function(response) {
        var expected = {
          error:         'info',
          rid:           '000000000000000000000000000000000000000000000000000000000000000',
          'time-ms':     0,
          'cpu-time-ms': 0,
          messages: [
            { severity: 'fatal',
              code:     'CS-UnknownFieldInMatchExpression',
              message:  'Field \'unknown\' is not defined in the metadata ' +
                        'for this collection. All fields used in the match ' +
                        'expression must be defined in the metadata.' }
          ]
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?q=Tokyo&facet=product',
               'with facet "domain"',
               'search-companies-00000000000000000000000000.localhost',
      function(response) {
        var expected = {
          rank: '-text_relevance',
          'match-expr': "(label 'Tokyo')",
          hits: {
            found: 3,
            start: 0,
            hit: [
              { id: 'id1' },
              { id: 'id3' },
              { id: 'id9' }
            ]
          },
          facets: {
            product: {
              constraints: [
                { value: 'groonga', count: 2 },
                { value: 'tyrant', count: 1 }
              ]
            }
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?q=Tokyo&size=2',
               'should return two hit entries',
               'search-companies-00000000000000000000000000.localhost',
      function(response) {
        var expected = {
          rank: '-text_relevance',
          'match-expr': "(label 'Tokyo')",
          hits: {
            found: 3,
            start: 0,
            hit: [
              { id: 'id1' },
              { id: 'id3' }
            ]
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?q=Tokyo&start=1',
               'should return offseted hit result',
               'search-companies-00000000000000000000000000.localhost',
      function(response) {
        var expected = {
          rank: '-text_relevance',
          'match-expr': "(label 'Tokyo')",
          hits: {
            found: 3,
            start: 1,
            hit: [
              { id: 'id3' },
              { id: 'id9' }
            ]
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?q=Tokio',
               'should not match with any entry',
               'search-companies-00000000000000000000000000.localhost',
      function(response) {
        var expected = {
          rank: '-text_relevance',
          'match-expr': "(label 'Tokio')",
          hits: {
            found: 0,
            start: 0,
            hit: [
            ]
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );
  });

  suite('with fixture and synonyms loaded', function() {
    setup(function() {
      utils.loadDumpFile(context, __dirname + '/fixture/companies/ddl.grn');
      utils.loadDumpFile(context, __dirname + '/fixture/companies/configurations.grn');
      utils.loadDumpFile(context, __dirname + '/fixture/companies/data.grn');
      utils.loadDumpFile(context, __dirname + '/fixture/companies/synonyms.grn');
    });

    testSearch('/2011-02-01/search?q=Tokio',
               'should match with using synonyms',
               'search-companies-00000000000000000000000000.localhost',
      function(response) {
        var expected = {
          rank: '-text_relevance',
          'match-expr': "(label 'Tokio')",
          hits: {
            found: 3,
            start: 0,
            hit: [
              { id: 'id1' },
              { id: 'id3' },
              { id: 'id9' }
            ]
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );
  });

  suite('search options', function() {
    var domain;

    setup(function() {
      domain = new Domain({ name: 'people', context: context })
                 .setId('00000000000000000000000000').saveSync();
      domain.getIndexField('realname').setType('text')
        .setResultEnabled(true).saveSync();
      domain.getIndexField('nickname').setType('text')
        .setResultEnabled(true).saveSync();
      domain.getIndexField('type').setType('literal')
        .setSearchEnabled(true).setResultEnabled(true)
        .saveSync();
      domain.getIndexField('job').setType('literal')
        .setSearchEnabled(true).setResultEnabled(true)
        .saveSync();
      domain.getIndexField('age').setType('uint')
        .saveSync();
      domain.getIndexField('followers').setType('uint')
        .saveSync();
      domain.loadSync([
        { id: 'id1', realname: 'Jack Sparrow',
                     nickname: 'Captain',
                     type:     'human',
                     job:      'pirate',
                     age:      40,
                     followers: 100 },
        { id: 'id2', realname: 'Pumpkin Man',
                     nickname: 'Jack-o\'-Lantern',
                     type:     'ghost',
                     job:      'nothing',
                     age:      9999,
                     followers: 0 }
      ]);
    });

    testSearch('/2011-02-01/search?q=Jack',
               'should match both records',
               'search-people-00000000000000000000000000.localhost',
      function(response) {
        var expected = {
          rank: '-text_relevance',
          'match-expr': "(label 'Jack')",
          hits: {
            found: 2,
            start: 0,
            hit: [
              { id: 'id2' },
              { id: 'id1' }
            ]
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?q=Jack',
               'should match only realname, by default search field',
               'search-people-00000000000000000000000000.localhost',
      function() {
        domain.defaultSearchField = 'realname';
      },
      function(response) {
        var expected = {
          rank: '-text_relevance',
          'match-expr': "(label 'Jack')",
          hits: {
            found: 1,
            start: 0,
            hit: [
              { id: 'id1' }
            ]
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?bq=type:\'human\'',
               'should return result, for search query about "search" field',
               'search-people-00000000000000000000000000.localhost',
      function(response) {
        var expected = {
          rank: '-text_relevance',
          'match-expr': "type:'human'",
          hits: {
            found: 1,
            start: 0,
            hit: [
              { id: 'id1' }
            ]
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?bq=type:\'human\'',
               'should return empty result, for search query about "nosearch" field',
               'search-people-00000000000000000000000000.localhost',
      function() {
        domain.getIndexField('type').setSearchEnabled(false).saveSync();
      },
      function(response) {
        var expected = {
          rank: '-text_relevance',
          'match-expr': "type:'human'",
          hits: {
            found: 0,
            start: 0,
            hit: []
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?q=Jack&return-fields=realname,nickname,type,unknown',
               'should return only "realname" field, ' +
                 'and return empty value for "noresult" fields',
               'search-people-00000000000000000000000000.localhost',
      function() {
        domain.getIndexField('nickname').setResultEnabled(false).saveSync();
        domain.getIndexField('type').setResultEnabled(false).saveSync();
      },
      function(response) {
        var expected = {
          rank: '-text_relevance',
          'match-expr': "(label 'Jack')",
          hits: {
            found: 2,
            start: 0,
            hit: [
              {
                id: 'id2',
                data: {
                  // "noresult" field retuened as an empty array
                  realname: ['Pumpkin Man'],
                  nickname: [],
                  type:     []
                  // unknown field is simply ignored.
                }
              },
              {
                id: 'id1',
                data: {
                  realname: ['Jack Sparrow'],
                  nickname: [],
                  type:     []
                }
              }
            ]
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?q=Jack&facet=realname,nickname,type,unknown',
               'should return only "type" field as facet, ' +
                 'and return blank results for "nofacet" fields',
               'search-people-00000000000000000000000000.localhost',
      function() {
        domain.getIndexField('realname').setFacetEnabled(false).saveSync();
        domain.getIndexField('nickname').setFacetEnabled(false).saveSync();
        domain.getIndexField('type')
          .setResultEnabled(false).setFacetEnabled(true).saveSync();
      },
      function(response) {
        var expected = {
          rank: '-text_relevance',
          'match-expr': "(label 'Jack')",
          hits: {
            found: 2,
            start: 0,
            hit: [
              { id: 'id2' },
              { id: 'id1' }
            ]
          },
          facets: {
            type: {
              constraints: [
                { value: 'ghost', count: 1 },
                { value: 'human', count: 1 }
              ]
            },
            // "nofacet" field retuened as an empty hash
            realname: {},
            nickname: {}
            // and, unknown field is simply ignored.
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?q=Jack&rank=realname',
               'should return results sorted by text field (aschending)',
               'search-people-00000000000000000000000000.localhost',
      function(response) {
        var expected = {
          rank: 'realname',
          'match-expr': "(label 'Jack')",
          hits: {
            found: 2,
            start: 0,
            hit: [
              { id: 'id1' },
              { id: 'id2' }
            ]
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?q=Jack&rank=-realname',
               'should return results sorted by text field (descending)',
               'search-people-00000000000000000000000000.localhost',
      function(response) {
        var expected = {
          rank: '-realname',
          'match-expr': "(label 'Jack')",
          hits: {
            found: 2,
            start: 0,
            hit: [
              { id: 'id2' },
              { id: 'id1' }
            ]
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?q=Jack&rank=followers',
               'should return results sorted by uint field (aschending)',
               'search-people-00000000000000000000000000.localhost',
      function(response) {
        var expected = {
          rank: 'followers',
          'match-expr': "(label 'Jack')",
          hits: {
            found: 2,
            start: 0,
            hit: [
              { id: 'id2' },
              { id: 'id1' }
            ]
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?q=Jack&rank=-followers',
               'should return results sorted by uint field (descending)',
               'search-people-00000000000000000000000000.localhost',
      function(response) {
        var expected = {
          rank: '-followers',
          'match-expr': "(label 'Jack')",
          hits: {
            found: 2,
            start: 0,
            hit: [
              { id: 'id1' },
              { id: 'id2' }
            ]
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?q=Jack&rank=job',
               'should return results sorted by literal field (aschending)',
               'search-people-00000000000000000000000000.localhost',
      function(response) {
        var expected = {
          rank: 'job',
          'match-expr': "(label 'Jack')",
          hits: {
            found: 2,
            start: 0,
            hit: [
              { id: 'id2' },
              { id: 'id1' }
            ]
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );

    testSearch('/2011-02-01/search?q=Jack&rank=-job',
               'should return results sorted by literal field (descending)',
               'search-people-00000000000000000000000000.localhost',
      function(response) {
        var expected = {
          rank: '-job',
          'match-expr': "(label 'Jack')",
          hits: {
            found: 2,
            start: 0,
            hit: [
              { id: 'id1' },
              { id: 'id2' }
            ]
          },
          info: {
            rid: '000000000000000000000000000000000000000000000000000000000000000',
            'time-ms': 0, // always 0
            'cpu-time-ms': 0
          }
        };
        assert.deepEqual(response.normalizedBody, expected);
      }
    );
  });
});
