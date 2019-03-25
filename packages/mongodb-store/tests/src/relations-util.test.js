import {
  mapDocumentRefs,
  findAllRelations,
  getPopulateRequests,
  mergeRelatedDocuments
} from '../../../dist/node/cjs/relations-util';

const movies = [
  {
    _type: 'Movie',
    _id: 'abc123',
    title: 'The Matrix'
  },
  {
    _type: 'Movie',
    _id: 'abc123',
    title: 'Inception',
    director: {_type: 'Director', _id: 'xyz123', _ref: true},
    x: {
      y: {
        _type: 'Link',
        _id: 'link001',
        _ref: true
      }
    }
  },
  {
    _type: 'Movie',
    _id: 'def456',
    title: 'Star Wars',
    director: {_type: 'Director', _id: 'gl001', _ref: true},
    actors: [
      {_type: 'Actor', _id: 'act001', _ref: true},
      {_type: 'Actor', _id: 'act002', _ref: true}
    ]
  },
  {
    _type: 'Movie',
    _id: 'def456',
    title: 'The Empire strikes back',
    director: {_type: 'Director', _id: 'gl001', _ref: true}
  }
];

describe('Synchronous functions related to document references', () => {
  test('mapDocumentRefs', () => {
    const document = {a: {b: {c: 1, _ref: true}}, x: 2, d: [{e: 3, _ref: true}]};
    const mapper = (value, key) => ({...value, extra: `${key} is a ref!`});
    const expected = {
      a: {b: {c: 1, _ref: true, extra: 'b is a ref!'}},
      x: 2,
      d: [{e: 3, _ref: true, extra: 'd is a ref!'}]
    };

    const result = mapDocumentRefs(document, mapper);
    expect(result).toEqual(expected);

    const results = mapDocumentRefs([document], mapper); // it works with arrays too
    expect(results).toEqual([expected]);

    expect(mapDocumentRefs({a: {b: 1}, c: 2}, mapper)).toEqual({a: {b: 1}, c: 2}); // No ref => no change
  });

  test('findAllRelations', () => {
    let relations = findAllRelations(movies);
    const expected = [
      {_type: 'Director', _id: 'xyz123', path: 'director'},
      {_type: 'Link', _id: 'link001', path: 'x.y'},
      {_type: 'Director', _id: 'gl001', path: 'director'},
      {_type: 'Actor', _id: 'act001', path: 'actors'},
      {_type: 'Actor', _id: 'act002', path: 'actors'},
      {_type: 'Director', _id: 'gl001', path: 'director'}
    ];
    expect(relations).toEqual(expected);

    const requests = getPopulateRequests(relations);
    expect(requests).toEqual([
      {
        _type: 'Director',
        path: 'director',
        ids: ['xyz123', 'gl001']
      },
      {
        _type: 'Link',
        path: 'x.y',
        ids: ['link001']
      },
      {
        _type: 'Actor',
        path: 'actors',
        ids: ['act001', 'act002']
      }
    ]);

    relations = findAllRelations(movies[0]);
    expect(relations).toEqual([]);
  });

  test('mergeRelatedDocuments', () => {
    const relatedDocuments = [
      {
        _type: 'Director',
        _id: 'gl001',
        fullName: 'Georges Lucas'
      },
      {
        _type: 'Actor',
        _id: 'act001',
        fullName: 'Mark Hamill'
      },
      {
        _type: 'Actor',
        _id: 'act002',
        fullName: 'Carrie Fisher'
      }
    ];
    const mergedDocuments = mergeRelatedDocuments(movies, relatedDocuments);
    expect(mergedDocuments.length).toBe(movies.length);
    expect(mergedDocuments[2]).toEqual({
      _type: 'Movie',
      _id: 'def456',
      title: 'Star Wars',
      director: {_type: 'Director', _id: 'gl001', _ref: true, fullName: 'Georges Lucas'},
      actors: [
        {_type: 'Actor', _id: 'act001', _ref: true, fullName: 'Mark Hamill'},
        {_type: 'Actor', _id: 'act002', _ref: true, fullName: 'Carrie Fisher'}
      ]
    });
  });
});
