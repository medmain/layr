import {MongoDBStore} from '../../../';

const connectionString = 'mongodb://username:password@127.0.0.1:17932/storable?authSource=admin';

let store;

beforeAll(async () => {
  const collectionNames = {
    Movie: 'movies'
  };
  store = new MongoDBStore({connectionString, collectionNames});
  await store.connect();
});

afterAll(() => {
  store.disconnect();
});

describe('@storable/memory-store', () => {
  test('CRUD operations', async () => {
    expect(store.set({_type: 'Movie', _id: 'abc123', title: 'The Matrix'})).rejects.toThrow(
      /No document/i
    ); // The document doesn't exist yet so 'isNew' is required

    await store.set({
      _isNew: true,
      _type: 'Movie',
      _id: 'abc123',
      title: 'Inception',
      genre: 'action'
    });

    let movie = await store.get({_type: 'Movie', _id: 'abc123'});
    expect(movie).toEqual({_type: 'Movie', _id: 'abc123', title: 'Inception', genre: 'action'});

    movie = await store.get({_type: 'Movie', _id: 'abc123'}, {return: {title: true}}); // Partial read
    expect(movie).toEqual({_type: 'Movie', _id: 'abc123', title: 'Inception'});

    movie = await store.get({_type: 'Movie', _id: 'abc123'}, {return: false}); // Existence check
    expect(movie).toEqual({_type: 'Movie', _id: 'abc123'});

    movie = await store.get({_type: 'Movie', _id: 'xyz123'}); // Missing document
    expect(movie).toBeUndefined();

    // Update
    await store.set({_type: 'Movie', _id: 'abc123', title: 'The Matrix', genre: undefined});
    movie = await store.get({_type: 'Movie', _id: 'abc123'});
    expect(movie).toEqual({_type: 'Movie', _id: 'abc123', title: 'The Matrix'});
    expect(Object.keys(movie).includes('genre')).toBe(false); // 'genre' has been deleted

    expect(
      store.set({_isNew: true, _type: 'Movie', _id: 'abc123', title: 'Inception'})
    ).rejects.toThrow(); // The document already exists so 'isNew' should be not be passed

    // Delete
    let result = await store.delete({_type: 'Movie', _id: 'abc123'});
    expect(result).toBe(true);

    movie = await store.get({_type: 'Movie', _id: 'abc123'});
    expect(movie).toBeUndefined();

    result = await store.delete({_type: 'Movie', _id: 'abc123'});
    expect(result).toBe(false);
  });

  test('Nesting documents', async () => {
    await store.set({
      _isNew: true,
      _type: 'Movie',
      _id: 'abc123',
      title: 'Inception',
      technicalSpecs: {
        _isNew: true,
        _type: 'TechnicalSpecs',
        _id: 'xyz789',
        runtime: 120,
        aspectRatio: '2.39:1'
      }
    });

    let movie = await store.get({_type: 'Movie', _id: 'abc123'});
    expect(movie).toEqual({
      _type: 'Movie',
      _id: 'abc123',
      title: 'Inception',
      technicalSpecs: {_type: 'TechnicalSpecs', _id: 'xyz789', runtime: 120, aspectRatio: '2.39:1'}
    });

    // We can partially return nested documents
    movie = await store.get(
      {_type: 'Movie', _id: 'abc123'},
      {return: {technicalSpecs: {runtime: true}}}
    );
    expect(movie).toEqual({
      _type: 'Movie',
      _id: 'abc123',
      technicalSpecs: {_type: 'TechnicalSpecs', _id: 'xyz789', runtime: 120}
    });

    // We can partially modify nested documents
    await store.set({
      _type: 'Movie',
      _id: 'abc123',
      technicalSpecs: {_type: 'TechnicalSpecs', _id: 'xyz789', runtime: 130}
    });
    movie = await store.get({_type: 'Movie', _id: 'abc123'});
    expect(movie).toEqual({
      _type: 'Movie',
      _id: 'abc123',
      title: 'Inception',
      technicalSpecs: {_type: 'TechnicalSpecs', _id: 'xyz789', runtime: 130, aspectRatio: '2.39:1'}
    });

    store.delete({_type: 'Movie', _id: 'abc123'});
  });
});
