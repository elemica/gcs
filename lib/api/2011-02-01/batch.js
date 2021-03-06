var BatchProcessor = require('../../batch/processor').Processor;
var xml = require('../../batch/xml');
var Domain = require('../../database').Domain;
var logger = require('../../logger');

function createErrorBody(errors) {
  errors = errors.map(function(error) {
    if (error.message)
      return { message: error.message };
    else
      return { message: error.toString() };
  });
  return {
    status: 'error',
    adds: 0,
    deletes: 0,
    errors: errors
  };
}

function handleInvalidContentType(request, response) {
  var contentType = request.headers['content-type'];
  switch (contentType) {
    case 'application/json':
    case 'text/xml':
    case 'application/xml':
      return false;
    default:
      var message = contentType ?
                      'Invalid Content-Type header: "' + contentType + '"' :
                      'The Content-Type header is missing.' ;
      response.send(createErrorBody([message]), 400);
      return true;
  }
}

function handleInvalidContentLength(request, response) {
  if (('content-length' in request.headers))
    return false;

  response.send(createErrorBody(['The Content-Length header is missing.']), 401);
  return true;
}

exports.createHandler = function(context, config) {
  return function(request, response) {
    if (handleInvalidContentType(request, response)) return;
    if (handleInvalidContentLength(request, response)) return;

    var batches = request.body;
    if (request.headers['content-type'] == 'text/xml' ||
        request.headers['content-type'] == 'application/xml') {
      // express has no parser for application/xml...
      var body = '';
      request.on('data', function (data) {
        body += data;
      });
      request.on('end', function () {
        batches = xml.toJSON(body);
        processBatches();
      });
    } else {
      processBatches();
    }

    function processBatches() {
      var domain = new Domain({ source:        request,
                                context:       context,
                                documentsPath: config.documentsPath });
      var processor = new BatchProcessor({
            context: context,
            domain: domain
          });

      try {
        processor.validate(batches);
      } catch (error) {
        logger.error(error);

        return response.send(JSON.stringify(error.result));
      }

      processor.load(batches)
        .next(function(result) {
          response.contentType('application/json');
          response.send(JSON.stringify(result));
        })
        .error(function(error) {
          logger.error(error);

          response.send(error.message + '\n' + error.stack, 502);
        });
    }
  };
};
