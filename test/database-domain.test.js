var utils = require('./test-utils');

var assert = require('chai').assert;

var Domain = require('../lib/database/domain').Domain;

suite('database', function() {
  suite('Domain', function() {
    test('initial status', function() {
      var domain = new Domain('newdomain');
      assert.deepEqual({
        searchableDocumentsCount: domain.searchableDocumentsCount,
        requiresIndexDocuments:   domain.requiresIndexDocuments,
        searchInstanceCount:      domain.searchInstanceCount,
        searchPartitionCount:     domain.searchPartitionCount
      }, {
        searchableDocumentsCount: 0,
        requiresIndexDocuments:   false,
        searchInstanceCount:      0,
        searchPartitionCount:     0
      });
    });

    test('lower case', function() {
      var domain = new Domain('valid');
      domain.id = Domain.DEFAULT_ID;
      assert.equal(domain.tableName,
                   'valid_' + Domain.DEFAULT_ID);
    });

    test('lower case and number', function() {
      var domain = new Domain('valid123');
      domain.id = Domain.DEFAULT_ID;
      assert.equal(domain.tableName,
                   'valid123_' + Domain.DEFAULT_ID);
    });

    test('too short', function() {
      assert.throw(function() {
        var domain = new Domain('va');
      }, /too short domain name/);
    });

    test('too long', function() {
      assert.throw(function() {
        var domain = new Domain('abcdefghijklmnopqrstuvwxyz' +
                                '0123456789');
      }, /too long domain name/);
    });

    test('hyphen', function() {
      assert.throw(function() {
        var domain = new Domain('domain-name');
      }, /"-" cannot appear in a domain name/);
    });

    test('underscore', function() {
      assert.throw(function() {
        var domain = new Domain('domain_name');
      }, /"_" cannot appear in a domain name/);
    });

    test('upper case', function() {
      assert.throw(function() {
        var domain = new Domain('DomainName');
      }, /"D", "N" cannot appear in a domain name/);
    });

    test('termsTableName', function() {
      var domain = new Domain('valid123');
      domain.id = Domain.DEFAULT_ID;
      assert.equal(domain.termsTableName,
                   'valid123_' + Domain.DEFAULT_ID + '_index_BigramTerms');
    });

    suite('from query parameter', function() {
      test('not supported', function() {
        assert.throw(function() {
          var request = { query: { DomainName: 'test0123' } };
          var domain = new Domain(request);
        }, /no domain name/);
      });
    });

    suite('getNameAndIdFromHost', function() {
      test('valid, doc, lower case and number', function() {
        var host = 'doc-test0123-id0123.example.com';
        var nameAndId = Domain.getNameAndIdFromHost(host);
        assert.deepEqual(nameAndId, { name: 'test0123', id: 'id0123' });
      });

      test('valid, search, lower case and number', function() {
        var host = 'search-test0123-id0123.example.com';
        var nameAndId = Domain.getNameAndIdFromHost(host);
        assert.deepEqual(nameAndId, { name: 'test0123', id: 'id0123' });
      });

      test('valid, doc, lower case, hyphen and number', function() {
        var host = 'doc-test-0123-id0123.example.com';
        var nameAndId = Domain.getNameAndIdFromHost(host);
        assert.deepEqual(nameAndId, { name: 'test-0123', id: 'id0123' });
      });

      test('valid, search, lower case, hyphen and number', function() {
        var host = 'search-test-0123-id0123.example.com';
        var nameAndId = Domain.getNameAndIdFromHost(host);
        assert.deepEqual(nameAndId, { name: 'test-0123', id: 'id0123' });
      });

      test('valid, search, lower case, hyphen and number, deep subdomain including region identifier', function() {
        var host = 'search-test-0123-id0123.us-east-1.example.com';
        var nameAndId = Domain.getNameAndIdFromHost(host);
        assert.deepEqual(nameAndId, { name: 'test-0123', id: 'id0123' });
      });

      test('invalid', function() {
        var host = 'cloudsearch.example.com';
        var nameAndId = Domain.getNameAndIdFromHost(host);
        assert.deepEqual(nameAndId, { name: '', id: '' });
      });
    });

    suite('getNameAndIdFromPath', function() {
      test('valid, lower case and number', function() {
        var path = '/gcs/test0123-id0123/';
        var nameAndId = Domain.getNameAndIdFromPath(path);
        assert.deepEqual(nameAndId, { name: 'test0123', id: 'id0123' });
      });

      test('valid, lower case, hyphen and number', function() {
        var path = '/gcs/test-0123-id0123/';
        var nameAndId = Domain.getNameAndIdFromPath(path);
        assert.deepEqual(nameAndId, { name: 'test-0123', id: 'id0123' });
      });

      test('invalid', function() {
        var path = '/gcs';
        var nameAndId = Domain.getNameAndIdFromPath(path);
        assert.deepEqual(nameAndId, { name: '', id: '' });
      });
    });

    suite('auto detection', function() {
      test('from host, valid', function() {
        var host = 'doc-test0123-id0123.example.com';
        var request = { headers: { host: host } };
        var domain = new Domain(request);
        assert.deepEqual({ name: domain.name, id: domain.id },
                         { name: 'test0123', id: 'id0123' });
      });

      test('from host, invalid', function() {
        assert.throw(function() {
          var host = 'doc-domain_name-id0123.example.com';
          var request = { headers: { host: host } };
          var domain = new Domain(request);
        }, /cannot appear in a domain name/);
      });

      test('from path, valid', function() {
        var host = 'example.com';
        var request = { headers: { host: host },
                        url: '/gcs/test0123-id0123' };
        var domain = new Domain(request);
        assert.deepEqual({ name: domain.name, id: domain.id },
                         { name: 'test0123', id: 'id0123' });
      });

      test('from path, invalid', function() {
        assert.throw(function() {
          var host = 'example.com';
        var request = { headers: { host: host },
                        url: '/gcs/test_0123-id0123' };
          var domain = new Domain(request);
        }, /cannot appear in a domain name/);
      });

      test('host vs path', function() {
        var host = 'doc-test0123-id0123.example.com';
        var request = { headers: { host: host },
                        url: '/gcs/test4567-id4567' };
        var domain = new Domain(request);
        assert.deepEqual({ name: domain.name, id: domain.id },
                         { name: 'test0123', id: 'id0123' });
      });

      test('option vs host vs path', function() {
        var host = 'doc-test0123-id0123.example.com';
        var request = { headers: { host: host },
                        url: '/gcs/test4567-id4567',
                        query: { DomainName: 'test890' } };
        var domain = new Domain(request);
        assert.equal(domain.name, 'test0123');
      });
    });

    suite('getting data from database', function() {
      var temporaryDatabase;
      var context;
      var domain;

      setup(function() {
        temporaryDatabase = utils.createTemporaryDatabase();
        context = temporaryDatabase.get();
        utils.loadDumpFile(context, __dirname + '/fixture/companies/ddl-custom-id.grn');
        domain = new Domain('companies', context);
      });

      teardown(function() {
        domain = undefined;
        temporaryDatabase.teardown();
        temporaryDatabase = undefined;
      });

      test('id for database (known table)', function() {
        assert.deepEqual({ id: domain.id, exists: domain.exists() },
                         { id: 'id0123', exists: true });
      });

      test('id for database (unknown, new table)', function() {
        domain = new Domain('unknown', context);
        assert.equal(typeof domain.id, 'string');
        assert.deepEqual({ idLength:     domain.id.length,
                           normalizedId: domain.id.replace(/[1-9a-z]/g, '0'),
                           exists:       domain.exists() },
                         { idLength:     Domain.DEFAULT_ID.length,
                           normalizedId: Domain.DEFAULT_ID,
                           exists:       false });
      });

      test('indexFields', function() {
        var fields = domain.indexFields;
        fields = fields.map(function(field) {
          return {
            name: field.name,
            type: field.type
          };
        });
        var expected = [
              { name: 'address',
                type: 'text'},
              { name: 'age',
                type: 'uint'},
              { name: 'description',
                type: 'text'},
              { name: 'email_address',
                type: 'text'},
              { name: 'name',
                type: 'text'},
              { name: 'product',
                type: 'literal'}
            ];
        function sortFields(a, b) {
          return a.name - b.name;
        }
        assert.deepEqual(fields.sort(sortFields), expected.sort(sortFields));
      });
    });

    suite('database modifications', function() {
      var temporaryDatabase;
      var context;

      setup(function() {
        temporaryDatabase = utils.createTemporaryDatabase();
        context = temporaryDatabase.get();
      });

      teardown(function() {
        temporaryDatabase.teardown();
        temporaryDatabase = undefined;
      });

      test('createSync', function() {
        var domain = new Domain('companies', context);
        assert.isFalse(domain.exists());

        domain.createSync();
        assert.isTrue(domain.exists());

        var dump = context.commandSync('dump', {
              tables: domain.tableName
            });
        var expectedDump = 'table_create ' + domain.tableName +  ' ' +
                             'TABLE_HASH_KEY ShortText\n' +
                           'table_create ' + domain.termsTableName +  ' ' +
                             'TABLE_PAT_KEY|KEY_NORMALIZE ShortText ' +
                             '--default_tokenizer TokenBigram';
        assert.equal(dump, expectedDump);
      });

      test('deleteSync', function() {
        var domain = new Domain('companies', context);
        domain.createSync();
        assert.isTrue(domain.exists());

        domain.deleteSync();
        assert.isFalse(domain.exists());

        var dump = context.commandSync('dump');
        var expectedDump = '';
        assert.equal(dump, expectedDump);
      });

      test('updateSynonymsSync, initialize', function() {
        var domain = new Domain('companies', context);
        assert.isFalse(domain.hasSynonymsTableSync());

        domain.updateSynonymsSync({
          tokio: ['tokyo'],
          dekkaido: 'hokkaido'
        });
        assert.isTrue(domain.hasSynonymsTableSync());

        var dumpExpected =
             'table_create ' + domain.synonymsTableName +  ' ' +
               'TABLE_HASH_KEY|KEY_NORMALIZE ShortText\n' +
             'column_create ' + domain.synonymsTableName + ' ' +
               'synonyms COLUMN_VECTOR ShortText\n' +
             'load --table ' + domain.synonymsTableName + '\n' +
             '[\n' +
             '["_key","synonyms"],\n' +
             '["tokio",["tokyo"]],\n' +
             '["dekkaido",["hokkaido"]]\n' +
             ']';
        var dumpActual = context.commandSync('dump', {
              tables: domain.synonymsTableName
            });
        assert.equal(dumpExpected, dumpActual);
      });

      test('updateSynonymsSync, replace', function() {
        var domain = new Domain('companies', context);
        domain.updateSynonymsSync({
          tokio: ['tokyo'],
          dekkaido: 'hokkaido'
        });
        domain.updateSynonymsSync({
          tokio: ['tonkin']
        });

        var dumpExpected =
             'table_create ' + domain.synonymsTableName +  ' ' +
               'TABLE_HASH_KEY|KEY_NORMALIZE ShortText\n' +
             'column_create ' + domain.synonymsTableName + ' ' +
               'synonyms COLUMN_VECTOR ShortText\n' +
             'load --table ' + domain.synonymsTableName + '\n' +
             '[\n' +
             '["_key","synonyms"],\n' +
             '["tokio",["tonkin"]]\n' +
             ']';
        var dumpActual = context.commandSync('dump', {
              tables: domain.synonymsTableName
            });
        assert.equal(dumpExpected, dumpActual);
      });

      test('getSynonymsSync', function() {
        var domain = new Domain('companies', context);
        domain.updateSynonymsSync({
          tokio: ['tonkin', 'tokyo'],
          dekkaido: 'hokkaido'
        });

        var expectedSynonyms = {
              dekkaido: ['hokkaido'],
              tokio: ['tokyo', 'tonkin']
            };
        var synonyms = domain.getSynonymsSync();
        assert.deepEqual(synonyms, expectedSynonyms);
      });

      test('getSynonymsSync for new domain', function() {
        var domain = new Domain('companies', context);
        var expectedSynonyms = {};
        var synonyms = domain.getSynonymsSync();
        assert.deepEqual(synonyms, expectedSynonyms);
      });

      test('getAll', function() {
        var domain3 = new Domain('domain3', context);
        domain3.createSync();

        var domain1 = new Domain('domain1', context);
        domain1.createSync();

        var domain2 = new Domain('domain2', context);
        domain2.createSync();

        var allDomains = Domain.getAll(context);
        assert.deepEqual(allDomains.map(function(domain) {
                           return domain.tableName;
                         }),
                         [
                           domain1.tableName,
                           domain2.tableName,
                           domain3.tableName
                         ]);
      });
    });

    suite('dump and load', function() {
      var temporaryDatabase;
      var context;
      var domain;

      setup(function() {
        temporaryDatabase = utils.createTemporaryDatabase();
        context = temporaryDatabase.get();
        utils.loadDumpFile(context, __dirname + '/fixture/companies/ddl.grn');
        domain = new Domain('companies', context);
      });

      teardown(function() {
        domain = undefined;
        temporaryDatabase.teardown();
        temporaryDatabase = undefined;
      });

      test('dump for blank domain', function() {
        var actualDump = domain.dump();
        assert.deepEqual(actualDump, []);
      });

      test('dump', function() {
        utils.loadDumpFile(context, __dirname + '/fixture/companies/data.grn');

        var actualDump = domain.dump();
        assert.isTrue(Array.isArray(actualDump), actualDump);
        assert.equal(actualDump.length, 10, actualDump);

        var expectedDump = [
              { id: 'id1',
                address: 'Shibuya, Tokyo, Japan',
                age: 1,
                description: '',
                email_address: 'info@razil.jp',
                name: 'Brazil',
                product: 'groonga' },
              { id: 'id2',
                address: 'Sapporo, Hokkaido, Japan',
                age: 2,
                description: '',
                email_address: 'info@enishi-tech.com',
                name: 'Enishi Tech Inc.',
                product: 'groonga' },
              { id: 'id3',
                address: 'Hongo, Tokyo, Japan',
                age: 3,
                description: '',
                email_address: 'info@clear-code.com',
                name: 'ClearCode Inc.',
                product: 'groonga' }
            ];
        assert.deepEqual(actualDump.slice(0, 3), expectedDump);
      });

      test('load', function() {
        utils.loadDumpFile(context, __dirname + '/fixture/companies/data.grn');

        var values = [
              { id: 'id10',
                description: 'updated',
                product: 'spd13' },
              { id: 'id11',
                description: 'new',
                name: 'Nergal Heavy Industries',
                product: 'nadesico' }
            ];
        domain.load(values);

        var actualDump = domain.dump();
        var expectedDump = [
              { id: 'id10',
                address: 'New York, United States',
                age: 10,
                description: 'updated',
                email_address: '',
                name: 'U.S. Robots and Mechanical Men',
                product: 'spd13' },
              { id: 'id11',
                address: '',
                age: 0,
                description: 'new',
                email_address: '',
                name: 'Nergal Heavy Industries',
                product: 'nadesico' }
            ];
        assert.deepEqual(actualDump.slice(-2), expectedDump);
      });
    });
  });
});
