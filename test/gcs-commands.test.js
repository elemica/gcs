var utils = require('./test-utils');
var assert = require('chai').assert;
var path = require('path');

var Domain = require('../lib/database/domain').Domain;

var context;
var temporaryDatabase;

function commonSetup() {
  temporaryDatabase = utils.createTemporaryDatabase();
  context = temporaryDatabase.get();
}

function commonTeardown() {
  context = undefined;
  temporaryDatabase.clear();
  temporaryDatabase.teardown();
  temporaryDatabase = undefined;
}

function assertDomainNotSpecified(result) {
  assert.deepEqual({ code:    result.code,
                     message: result.output.stdout },
                   { code:    1,
                     message: 'You must specify the domain name.\n' },
                   result.output.stderr);
}

function assertDomainNotExist(result) {
  assert.deepEqual({ code:    result.code,
                     message: result.output.stdout },
                   { code:    1,
                     message: 'You must specify an existing domain name.\n' },
                   result.output.stderr);
}

suite('gcs-create-domain', function() {
  setup(commonSetup);
  teardown(commonTeardown);

  test('create', function(done) {
    utils
      .run('gcs-create-domain',
           '--domain-name', 'test',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assert.equal(result.code, 0, result.output.stderr);
        assert.include(result.output.stdout,
                       'Domain endpoints are currently being created.');

        context.reopen();
        var domain = new Domain('test', context);
        assert.isTrue(domain.exists());

        done();
      })
      .error(function(e) {
        done(e);
      });
  });

  test('create again', function(done) {
    new Domain('test', context).createSync();
    utils
      .run('gcs-create-domain',
           '--domain-name', 'test',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assert.deepEqual({ code:    result.code,
                           message: result.output.stdout },
                         { code:    1,
                           message: 'The domain [test] already exists.\n' },
                         result.output.stderr);

        context.reopen();
        var domains = Domain.getAll(context).map(function(domain) {
              return domain.name;
            });
        assert.deepEqual(domains, ['test']);

        done();
      })
      .error(function(e) {
        done(e);
      });
  });

  test('missing domain name', function(done) {
    utils
      .run('gcs-create-domain',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assertDomainNotSpecified(result);

        context.reopen();
        assert.deepEqual(Domain.getAll(context), []);

        done();
      })
      .error(function(e) {
        done(e);
      });
  });
});

suite('gcs-delete-domain', function() {
  setup(commonSetup);
  teardown(commonTeardown);

  test('delete force', function(done) {
    new Domain('test', context).createSync();
    utils
      .run('gcs-delete-domain',
           '--domain-name', 'test',
           '--force',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assert.deepEqual({ code:    result.code,
                           message: result.output.stdout },
                         { code:    0,
                           message: 'Domain [test] has been deleted successfully.\n' },
                         result.output.stderr);

        context.reopen();
        var domain = new Domain('test', context);
        assert.isFalse(domain.exists());

        done();
      })
      .error(function(e) {
        done(e);
      });
  });

  test('delete not-existing domain', function(done) {
    utils
      .run('gcs-delete-domain',
           '--domain-name', 'test',
           '--force',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assertDomainNotExist(result);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });

  test('delete without domain', function(done) {
    utils
      .run('gcs-delete-domain',
           '--force',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assertDomainNotSpecified(result);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });
});

suite('gcs-describe-domain', function() {
  setup(commonSetup);
  teardown(commonTeardown);

  test('describe one', function(done) {
    new Domain('domain2', context).createSync();
    new Domain('domain1', context).createSync();
    utils
      .run('gcs-describe-domain',
           '--domain-name', 'domain1',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        var domain = new Domain('domain1', context);
        assert.deepEqual({ code: result.code, message: result.output.stdout },
                         { code: 0,
                           message:
                             '=== Domain Summary ===\n' +
                             'Domain Name: domain1\n' +
                             'Document Service endpoint: ' +
                               domain.getDocumentsEndpoint('localhost') + '\n' +
                             'Search Service endpoint: ' +
                               domain.getSearchEndpoint('localhost') + '\n' +
                             'SearchInstanceType: null\n' +
                             'SearchPartitionCount: 0\n' +
                             'SearchInstanceCount: 0\n' +
                             'Searchable Documents: 0\n' +
                             'Current configuration changes require ' +
                               'a call to IndexDocuments: No\n' +
                             '\n' +
                             '=== Domain Configuration ===\n' +
                             '\n' +
                             'Fields:\n' +
                             '=======\n' +
                             '======================\n' });

        done();
      })
      .error(function(e) {
        done(e);
      });
  });

  test('describe all', function(done) {
    new Domain('domain2', context).createSync();
    new Domain('domain1', context).createSync();
    utils
      .run('gcs-describe-domain',
           '--show-all',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        var domain1 = new Domain('domain1', context);
        var domain2 = new Domain('domain2', context);
        assert.deepEqual({ code: result.code, message: result.output.stdout },
                         { code: 0,
                           message:
                             '=== Domain Summary ===\n' +
                             'Domain Name: domain1\n' +
                             'Document Service endpoint: ' +
                               domain1.getDocumentsEndpoint('localhost') + '\n' +
                             'Search Service endpoint: ' +
                               domain1.getSearchEndpoint('localhost') + '\n' +
                             'SearchInstanceType: null\n' +
                             'SearchPartitionCount: 0\n' +
                             'SearchInstanceCount: 0\n' +
                             'Searchable Documents: 0\n' +
                             'Current configuration changes require ' +
                               'a call to IndexDocuments: No\n' +
                             '\n' +
                             '=== Domain Configuration ===\n' +
                             '\n' +
                             'Fields:\n' +
                             '=======\n' +
                             '======================\n' +
                             '\n' +
                             '=== Domain Summary ===\n' +
                             'Domain Name: domain2\n' +
                             'Document Service endpoint: ' +
                               domain2.getDocumentsEndpoint('localhost') + '\n' +
                             'Search Service endpoint: ' +
                               domain2.getSearchEndpoint('localhost') + '\n' +
                             'SearchInstanceType: null\n' +
                             'SearchPartitionCount: 0\n' +
                             'SearchInstanceCount: 0\n' +
                             'Searchable Documents: 0\n' +
                             'Current configuration changes require ' +
                               'a call to IndexDocuments: No\n' +
                             '\n' +
                             '=== Domain Configuration ===\n' +
                             '\n' +
                             'Fields:\n' +
                             '=======\n' +
                             '======================\n' });

        done();
      })
      .error(function(e) {
        done(e);
      });
  });
});

suite('gcs-configure-fields', function() {
  setup(commonSetup);
  teardown(commonTeardown);

  function testCreateField(done, name, type, options) {
    new Domain('companies', context).createSync();
    utils
      .run('gcs-create-domain',
           '--domain-name', 'companies',
           '--database-path', temporaryDatabase.path)
      .run('gcs-configure-fields',
           '--domain-name', 'companies',
           '--name', name,
           '--type', type,
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assert.deepEqual({ code:    result.code,
                           message: result.output.stdout },
                         { code:    0,
                           message: 'Updated 1 Index Field:\n' +
                                    name + ' Active ' + type + ' (' + options + ')\n' },
                         result.output.stderr);

        context.reopen();
        var domain = new Domain('companies', context);
        var field = domain.getIndexField(name);
        assert.deepEqual({ type: field.type, exists: field.exists() },
                         { type: type, exists: true });

        done();
      })
      .error(function(e) {
        done(e);
      });
  }

  test('create text field', function(done) {
    testCreateField(done, 'name', 'text', 'Search Facet Result');
  });
  test('create uint field', function(done) {
    testCreateField(done, 'age', 'uint', 'Search Result');
  });
  test('create literal field', function(done) {
    testCreateField(done, 'product', 'literal', 'Search Facet Result');
  });

  function testDeleteField(done, name, type) {
    var domain = new Domain('companies', context);
    domain.createSync();
    var field = domain.getIndexField(name);
    field.type = type
    field.createSync();
    utils
      .run('gcs-configure-fields',
           '--domain-name', 'companies',
           '--name', name,
           '--delete',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assert.deepEqual({ code:    result.code,
                           message: result.output.stdout },
                         { code:    0,
                           message: 'Updated 1 Index Field:\n' },
                         result.output.stderr);

        context.reopen();
        var domain = new Domain('companies', context);
        var field = domain.getIndexField(name);
        assert.isFalse(field.exists());

        done();
      })
      .error(function(e) {
        done(e);
      });
  }

  test('delete text field', function(done) {
    testDeleteField(done, 'name', 'text');
  });
  test('delete uint field', function(done) {
    testDeleteField(done, 'age', 'uint');
  });
  test('delete literal field', function(done) {
    testDeleteField(done, 'product', 'literal');
  });

  function testRecreateField(done, name, type) {
    var domain = new Domain('companies', context);
    domain.createSync();
    var field = domain.getIndexField(name);
    field.type = type
    field.createSync();
    utils
      .run('gcs-configure-fields',
           '--domain-name', 'companies',
           '--name', name,
           '--type', type,
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assert.deepEqual({ code:    result.code,
                           message: result.output.stdout },
                         { code:    1,
                           message: 'You must specify not-existing field name.\n' },
                         result.output.stderr);
        done();
      })
      .error(function(e) {
        done(e);
      });
  }

  test('re-create text field', function(done) {
    testRecreateField(done, 'name', 'text');
  });
  test('re-create uint field', function(done) {
    testRecreateField(done, 'age', 'uint');
  });
  test('re-create literal field', function(done) {
    testRecreateField(done, 'product', 'literal');
  });

  test('delete not-existing field', function(done) {
    new Domain('companies', context).createSync();
    utils
      .run('gcs-configure-fields',
           '--domain-name', 'companies',
           '--name', 'name',
           '--delete',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assert.deepEqual({ code:    result.code,
                           message: result.output.stdout },
                         { code:    1,
                           message: 'You must specify an existing field.\n' },
                         result.output.stderr);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });

  test('create field without type', function(done) {
    new Domain('companies', context).createSync();
    utils
      .run('gcs-configure-fields',
           '--domain-name', 'companies',
           '--name', 'name',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assert.deepEqual({ code:    result.code,
                           message: result.output.stdout },
                         { code:    1,
                           message: 'You must specify the field type.\n' },
                         result.output.stderr);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });

  test('create field without domain', function(done) {
    utils
      .run('gcs-configure-fields',
           '--name', 'name',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assertDomainNotSpecified(result);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });
});

suite('gcs-configure-text-options', function() {
  setup(commonSetup);
  teardown(commonTeardown);

  test('load synonyms', function() {
    new Domain('companies', context).createSync();
    utils
      .run('gcs-configure-text-options',
           '--domain-name', 'companies',
           '--synonyms', path.join(__dirname, 'fixtures', 'synonyms.txt'),
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assert.deepEqual({ code:    result.code,
                           message: result.output.stdout },
                         { code:    0,
                           message: '2 synonyms are loaded.\n' },
                         result.output.stderr);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });

  test('load synonyms to not-existing domain', function() {
    utils
      .run('gcs-configure-text-options',
           '--domain-name', 'companies',
           '--synonyms', path.join(__dirname, 'fixtures', 'synonyms.txt'),
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assertDomainNotExist(result);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });

  test('load synonyms without domain', function() {
    utils
      .run('gcs-configure-text-options',
           '--synonyms', path.join(__dirname, 'fixtures', 'synonyms.txt'),
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assertDomainNotSpecified(result);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });

  test('print synonyms', function() {
    var domain = new Domain('companies', context);
    domain.createSync();
    domain.updateSynonymsSync({
      hokkaido: 'dekkaido',
      tokyo: ['tonkin', 'tokio']
    });
    utils
      .run('gcs-configure-text-options',
           '--domain-name', 'companies',
           '--print-synonyms',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assert.deepEqual({ code:    result.code,
                           message: result.output.stdout },
                         { code:    0,
                           message: 'hokkaido,dekkaido\n' +
                                    'tokyo,tokio,tonkin\n' },
                         result.output.stderr);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });

  test('print synonyms to not-existing domain', function() {
    utils
      .run('gcs-configure-text-options',
           '--domain-name', 'companies',
           '--print-synonyms',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assertDomainNotExist(result);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });

  test('print synonyms without domain', function() {
    utils
      .run('gcs-configure-text-options',
           '--print-synonyms',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assertDomainNotSpecified(result);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });
});

suite('gcs-index-documents', function() {
  setup(commonSetup);
  teardown(commonTeardown);

  test('reindex', function(done) {
    var domain = new Domain('companies', context);
    domain.createSync();
    domain.getIndexField('name').setType('text').createSync();
    domain.getIndexField('age').setType('uint').createSync();
    domain.getIndexField('product').setType('literal').createSync();

    utils
      .run('gcs-index-documents',
           '--domain-name', 'companies',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assert.deepEqual({ code:    result.code,
                           message: result.output.stdout },
                         { code:    0,
                           message:
                             '===========================================\n' +
                             'Indexing documents for domain [companies]\n' +
                             '\n' +
                             'Now indexing fields:\n' +
                             '===========================================\n' +
                             'age\n' +
                             'name\n' +
                             'product\n' +
                             '===========================================\n' },
                         result.output.stderr);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });

  test('reindex not-existing domain', function(done) {
    utils
      .run('gcs-index-documents',
           '--domain-name', 'test',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assertDomainNotExist(result);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });

  test('reindex without domain', function(done) {
    utils
      .run('gcs-index-documents',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assertDomainNotSpecified(result);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });
});

suite('gcs-post-sdf', function() {
  setup(commonSetup);
  teardown(commonTeardown);

  var fixturesDirectory = path.join(__dirname, 'fixtures', 'companies');
  
  function setupDomain() {
    var domain = new Domain('companies', context);
    domain.createSync();
    domain.getIndexField('name').setType('text').createSync();
    domain.getIndexField('address').setType('text').createSync();
    domain.getIndexField('email_address').setType('text').createSync();
    domain.getIndexField('description').setType('text').createSync();
    domain.getIndexField('age').setType('uint').createSync();
    domain.getIndexField('product').setType('literal').createSync();
  }

  test('post add sdf', function(done) {
    setupDomain();
    var batchFile = path.join(fixturesDirectory, 'add.sdf.json');
    utils
      .run('gcs-post-sdf',
           '--domain-name', 'companies',
           '--source', batchFile,
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assert.deepEqual({ code:    result.code,
                           message: result.output.stdout },
                         { code:    0,
                           message:
                             'Processing: ' + batchFile + '\n' +
                             'Detected source format for ' + 
                               'add.sdf.json as json\n' +
                             'Status: success\n' +
                             'Added: 10\n' +
                             'Deleted: 0\n' },
                         result.output.stderr);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });

  test('post delete sdf', function(done) {
    setupDomain();
    var batchFile = path.join(fixturesDirectory, 'delete.sdf.json');
    utils
      .run('gcs-post-sdf',
           '--domain-name', 'companies',
           '--source', path.join(fixturesDirectory, 'add.sdf.json'),
           '--database-path', temporaryDatabase.path)
      .run('gcs-post-sdf',
           '--domain-name', 'companies',
           '--source', batchFile,
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assert.deepEqual({ code:    result.code,
                           message: result.output.stdout },
                         { code:    0,
                           message:
                             'Processing: ' + batchFile + '\n' +
                             'Detected source format for ' + 
                               'delete.sdf.json as json\n' +
                             'Status: success\n' +
                             'Added: 0\n' +
                             'Deleted: 1\n' },
                         result.output.stderr);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });

  test('post invalid sdf', function(done) {
    setupDomain();
    var batchFile = path.join(fixturesDirectory, 'invalid.sdf.json');
    utils
      .run('gcs-post-sdf',
           '--domain-name', 'companies',
           '--source', batchFile,
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assert.deepEqual({ code:    result.code,
                           message: result.output.stdout },
                         { code:    1,
                           message:
                             'Processing: ' + batchFile + '\n' +
                             'Detected source format for ' + 
                               'delete.sdf.json as json\n' +
                             'Validation failed.\n' +
                             'invalidfield: The field "unknown1" is ' +
                               'unknown. (available: address,age,' +
                               'description,email_address,name,product)\n' +
                             'invalidfield: The field "unknown2" is ' +
                               'unknown. (available: address,age,' +
                               'description,email_address,name,product)\n' +
                             'invalidfield: The field "name" is null.\n' +
                             'nofields: You must specify "fields".\n' +
                             'emptyfields: You must specify one or ' +
                               'more fields to "fields".\n' },
                         result.output.stderr);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });

  test('post not-existing domain', function(done) {
    utils
      .run('gcs-post-sdf',
           '--domain-name', 'test',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assertDomainNotExist(result);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });

  test('post without domain', function(done) {
    utils
      .run('gcs-post-sdf',
           '--database-path', temporaryDatabase.path)
      .next(function(result) {
        assertDomainNotSpecified(result);
        done();
      })
      .error(function(e) {
        done(e);
      });
  });  
});