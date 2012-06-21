var utils = require('./test-utils');
var assert = require('chai').assert;
var http = require('http');
var fs = require('fs');

suite('dashboard', function() {
  var server;

  setup(function() {
    server = utils.setupServer();
  });

  teardown(function() {
    server.close();
  });

  test('GET /', function(done) {
    var options = {
      host: utils.testHost,
      port: utils.testPort,
      path: '/'
    };
    http.get(options, function(response) {
      assert.equal(response.statusCode, 200);
      var body = '';
      response.on('data', function(data) {
        body += data;
      });
      response.on('end', function() {
        assert.match(body, /<h1>Groonga CloudSearch<\/h1>/);
        done();
      });
    });
  });
});