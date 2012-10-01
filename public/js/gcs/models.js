App.Adapter = DS.Adapter.extend({
  findAll: function(store, type) {
    if (type === App.Domain) {
      var self = this;
      $.ajax({
        type: 'GET',
        url:  self.configurationEndpoint,
        data: {
          Version: '2011-02-01',
          Action:  'DescribeDomains'
        },
        dataType: 'xml',
        success: function(data) {
          var domainStatusMembers = $(data).find('DomainStatusList > member');
          domainStatusMembers.each(function(index) {
            var domainElement = $(this);
            var name = domainElement.find('DomainName').text();
            var searchEndpoint = domainElement.find('SearchService > Endpoint').text();
            var docEndpoint = domainElement.find('DocService > Endpoint').text();

            var self = this;
            $.ajax({
              type: 'GET',
              url:  self.configurationEndpoint,
              data: {
                Version:    '2011-02-01',
                Action:     'DescribeIndexFields',
                DomainName: name
              },
              dataType: 'xml',
              success: function(data) {
                var indexFields = [];
                $(data).find('IndexFields > member').each(function(index) {
                  var field = $(this);
                  var name = field.find('IndexFieldName').text();
                  indexFields.push({
                    id: name,
                    name: name
                  });
                });

                var domain = {
                  id: name,
                  name: name,
                  search_endpoint: searchEndpoint,
                  doc_endpoint: docEndpoint,
                  index_fields: indexFields,
                  configuration_endpoint: self.configurationEndpoint
                };
                store.load(type, name, domain);
              }
            });
          });
        }
      });
    } else {
      throw "Unspported model";
    }
  },
  find: function(store, type, id) {
    this.findAll(store, type); // Fetch all for the simplicity
  }
});

App.configurationEndpoint = 'http://' + location.host + '/';

App.store = DS.Store.create({
  revision: 4,
  adapter: App.Adapter.create({
    configurationEndpoint: App.configurationEndpoint
  })
});

App.IndexField = DS.Model.extend({
  name: DS.attr('string')
});

App.Domain = DS.Model.extend({
  name: DS.attr('string'),
  searchEndpoint: DS.attr('string'),
  docEndpoint: DS.attr('string'),
  searchURL: function() {
    return 'http://' + this.get('searchEndpoint') + '/2011-02-01/search';
  }.property('endpoint'),
  indexFields: DS.hasMany('App.IndexField', {embedded: true}),
  configurationEndpoint: DS.attr('string')
});

App.domains = App.store.findAll(App.Domain);
