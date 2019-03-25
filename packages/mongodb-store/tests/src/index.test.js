import {MongoDBStore} from '../../../';

const connectionString = 'mongodb://username:password@127.0.0.1:17932/storable?authSource=admin';

let store;

beforeAll(async () => {
  const collectionNames = {
    Movie: 'movies',
    Director: 'directors',
    Actor: 'actors'
  };
  store = new MongoDBStore({connectionString, collectionNames});
  await store.connect();
  // Temporary cleanup while the store is under heavy development
  const deleteAllDocuments = collectionName => store.db.collection(collectionName).deleteMany({});
  await Promise.all(Object.values(collectionNames).map(deleteAllDocuments));
});

afterAll(() => {
  store.disconnect();
});

describe('@storable/mongodb-store', () => {
  test('CRUD operations', async () => {
    expect(store.set({_type: 'Movie', _id: 'abc001', title: 'The Matrix'})).rejects.toThrow(
      /No document/i
    ); // The document doesn't exist yet so 'isNew' is required

    await store.set({
      _isNew: true,
      _type: 'Movie',
      _id: 'abc001',
      title: 'Inception',
      genre: 'action'
    });

    let movie = await store.get({_type: 'Movie', _id: 'abc001'});
    expect(movie).toEqual({_type: 'Movie', _id: 'abc001', title: 'Inception', genre: 'action'});

    movie = await store.get({_type: 'Movie', _id: 'abc001'}, {return: {title: true}}); // Partial read
    expect(movie).toEqual({_type: 'Movie', _id: 'abc001', title: 'Inception'});

    movie = await store.get({_type: 'Movie', _id: 'abc001'}, {return: false}); // Existence check
    expect(movie).toEqual({_type: 'Movie', _id: 'abc001'});

    movie = await store.get({_type: 'Movie', _id: 'xyz123'}); // Missing document
    expect(movie).toBeUndefined();

    // Update
    await store.set({_type: 'Movie', _id: 'abc001', title: 'The Matrix', genre: undefined});
    movie = await store.get({_type: 'Movie', _id: 'abc001'});
    expect(movie).toEqual({_type: 'Movie', _id: 'abc001', title: 'The Matrix'});
    expect(Object.keys(movie).includes('genre')).toBe(false); // 'genre' has been deleted

    expect(
      store.set({_isNew: true, _type: 'Movie', _id: 'abc001', title: 'Inception'})
    ).rejects.toThrow(); // The document already exists so 'isNew' should be not be passed

    // Delete
    let result = await store.delete({_type: 'Movie', _id: 'abc001'});
    expect(result).toBe(true);

    movie = await store.get({_type: 'Movie', _id: 'abc001'});
    expect(movie).toBeUndefined();

    result = await store.delete({_type: 'Movie', _id: 'abc001'});
    expect(result).toBe(false);
  });

  test('Nesting documents', async () => {
    await store.set({
      _isNew: true,
      _type: 'Movie',
      _id: 'abc002',
      title: 'Inception',
      technicalSpecs: {
        _isNew: true,
        _type: 'TechnicalSpecs',
        _id: 'xyz789',
        runtime: 120,
        aspectRatio: '2.39:1'
      }
    });

    let movie = await store.get({_type: 'Movie', _id: 'abc002'});
    expect(movie).toEqual({
      _type: 'Movie',
      _id: 'abc002',
      title: 'Inception',
      technicalSpecs: {_type: 'TechnicalSpecs', _id: 'xyz789', runtime: 120, aspectRatio: '2.39:1'}
    });

    // We can partially return nested documents
    movie = await store.get(
      {_type: 'Movie', _id: 'abc002'},
      {return: {technicalSpecs: {runtime: true}}}
    );
    expect(movie).toEqual({
      _type: 'Movie',
      _id: 'abc002',
      technicalSpecs: {_type: 'TechnicalSpecs', _id: 'xyz789', runtime: 120}
    });

    // We can partially modify nested documents
    await store.set({
      _type: 'Movie',
      _id: 'abc002',
      technicalSpecs: {_type: 'TechnicalSpecs', _id: 'xyz789', runtime: 130}
    });
    movie = await store.get({_type: 'Movie', _id: 'abc002'});
    expect(movie).toEqual({
      _type: 'Movie',
      _id: 'abc002',
      title: 'Inception',
      technicalSpecs: {_type: 'TechnicalSpecs', _id: 'xyz789', runtime: 130, aspectRatio: '2.39:1'}
    });

    store.delete({_type: 'Movie', _id: 'abc002'});
  });

  test('Referencing documents', async () => {
    // Let's set a movie and a director
    await store.set({
      _isNew: true,
      _type: 'Movie',
      _id: 'abc003',
      title: 'Inception',
      director: {_type: 'Director', _id: 'xyz123', _ref: true}
    });
    await store.set({
      _isNew: true,
      _type: 'Director',
      _id: 'xyz123',
      fullName: 'Christopher Nolan'
    });

    // The director can be fetched from 'Director'
    let director = await store.get({_type: 'Director', _id: 'xyz123'});
    expect(director).toEqual({_type: 'Director', _id: 'xyz123', fullName: 'Christopher Nolan'});

    // Will fetch both the movie and its director
    let movie = await store.get({_type: 'Movie', _id: 'abc003'});
    expect(movie).toEqual({
      _type: 'Movie',
      _id: 'abc003',
      title: 'Inception',
      director: {_type: 'Director', _id: 'xyz123', _ref: true, fullName: 'Christopher Nolan'}
    });

    // Will fetch the movie only
    movie = await store.get({_type: 'Movie', _id: 'abc003'}, {return: {title: true}});
    expect(movie).toEqual({
      _type: 'Movie',
      _id: 'abc003',
      title: 'Inception'
    });

    // Will fetch the movie and the id of its director
    movie = await store.get({_type: 'Movie', _id: 'abc003'}, {return: {title: true, director: {}}});
    expect(movie).toEqual({
      _type: 'Movie',
      _id: 'abc003',
      title: 'Inception',
      director: {_type: 'Director', _id: 'xyz123', _ref: true}
    });

    // Let's delete the movie
    let result = await store.delete({_type: 'Movie', _id: 'abc003'});
    expect(result).toBe(true);
    movie = await store.get({_type: 'Movie', _id: 'abc003'});
    expect(movie).toBeUndefined(); // The movie is gone
    // But the director is still there
    director = await store.get({_type: 'Director', _id: 'xyz123'});
    expect(director).toEqual({_type: 'Director', _id: 'xyz123', fullName: 'Christopher Nolan'});
    // // So let's delete it
    result = await store.delete({_type: 'Director', _id: 'xyz123'});
    expect(result).toBe(true);
    director = await store.get({_type: 'Director', _id: 'xyz123'});
    expect(movie).toBeUndefined(); // The director is gone
  });

  test('Arrays', async () => {
    // Let's set a movie and some actors
    await store.set({
      _isNew: true,
      _type: 'Movie',
      _id: 'abc004',
      title: 'Inception',
      genres: ['action', 'adventure', 'sci-fi'],
      actors: [
        {_type: 'Actor', _id: 'xyz123', _ref: true},
        {_type: 'Actor', _id: 'xyz456', _ref: true}
      ]
    });
    await store.set({_isNew: true, _type: 'Actor', _id: 'xyz123', fullName: 'Leonardo DiCaprio'});
    await store.set({
      _isNew: true,
      _type: 'Actor',
      _id: 'xyz456',
      fullName: 'Joseph Gordon-Levitt'
    });

    // The actors can be fetched directly
    let actor = await store.get({_type: 'Actor', _id: 'xyz123'});
    expect(actor).toEqual({_type: 'Actor', _id: 'xyz123', fullName: 'Leonardo DiCaprio'});
    actor = await store.get({_type: 'Actor', _id: 'xyz456'});
    expect(actor).toEqual({_type: 'Actor', _id: 'xyz456', fullName: 'Joseph Gordon-Levitt'});

    // Will fetch both the movie and its actors
    let movie = await store.get({_type: 'Movie', _id: 'abc004'});
    expect(movie).toEqual({
      _type: 'Movie',
      _id: 'abc004',
      title: 'Inception',
      genres: ['action', 'adventure', 'sci-fi'],
      actors: [
        {_type: 'Actor', _id: 'xyz123', _ref: true, fullName: 'Leonardo DiCaprio'},
        {_type: 'Actor', _id: 'xyz456', _ref: true, fullName: 'Joseph Gordon-Levitt'}
      ]
    });

    // Will fetch the movie only
    movie = await store.get({_type: 'Movie', _id: 'abc004'}, {return: {title: true}});
    expect(movie).toEqual({_type: 'Movie', _id: 'abc004', title: 'Inception'});

    // Will fetch the movie and the id of the actors
    movie = await store.get({_type: 'Movie', _id: 'abc004'}, {return: {title: true, actors: [{}]}});
    expect(movie).toEqual({
      _type: 'Movie',
      _id: 'abc004',
      title: 'Inception',
      actors: [
        {_type: 'Actor', _id: 'xyz123', _ref: true},
        {_type: 'Actor', _id: 'xyz456', _ref: true}
      ]
    });

    // Let's delete everything
    let result = await store.delete({_type: 'Movie', _id: 'abc004'});
    expect(result).toBe(true);
    result = await store.delete({_type: 'Actor', _id: 'xyz123'});
    expect(result).toBe(true);
    result = await store.delete({_type: 'Actor', _id: 'xyz456'});
    expect(result).toBe(true);
  });

  test('Multi CRUD operations', async () => {
    // Create
    await store.set([
      {_isNew: true, _type: 'Movie', _id: 'abc005', title: 'Inception'},
      {_isNew: true, _type: 'Movie', _id: 'abc006', title: 'The Matrix'}
    ]);

    // Read
    let movies = await store.get([
      {_type: 'Movie', _id: 'abc005'},
      {_type: 'Movie', _id: 'abc006'}
    ]);
    expect(movies).toEqual([
      {_type: 'Movie', _id: 'abc005', title: 'Inception'},
      {_type: 'Movie', _id: 'abc006', title: 'The Matrix'}
    ]);

    // Update
    await store.set([
      {_type: 'Movie', _id: 'abc005', rating: 8.8},
      {_type: 'Movie', _id: 'abc006', rating: 8.7}
    ]);
    movies = await store.get([{_type: 'Movie', _id: 'abc005'}, {_type: 'Movie', _id: 'abc006'}]);
    expect(movies).toEqual([
      {_type: 'Movie', _id: 'abc005', title: 'Inception', rating: 8.8},
      {_type: 'Movie', _id: 'abc006', title: 'The Matrix', rating: 8.7}
    ]);

    // Delete
    let result = await store.delete([
      {_type: 'Movie', _id: 'abc005'},
      {_type: 'Movie', _id: 'abc006'}
    ]);
    expect(result).toEqual([true, true]);
    movies = await store.get([{_type: 'Movie', _id: 'abc123'}, {_type: 'Movie', _id: 'abc456'}]);
    expect(movies).toEqual([undefined, undefined]);
    result = await store.delete([{_type: 'Movie', _id: 'abc123'}, {_type: 'Movie', _id: 'abc456'}]);
    expect(result).toEqual([false, false]);
  });

  test('Finding documents', async () => {
    await store.set([
      {
        _isNew: true,
        _type: 'Movie',
        _id: 'movie1',
        title: 'Inception',
        genre: 'action',
        country: 'USA'
      },
      {
        _isNew: true,
        _type: 'Movie',
        _id: 'movie2',
        title: 'Forrest Gump',
        genre: 'drama',
        country: 'USA'
      },
      {
        _isNew: true,
        _type: 'Movie',
        _id: 'movie3',
        title: 'Léon',
        genre: 'action',
        country: 'France'
      }
    ]);

    let movies = await store.find({_type: 'Movie'});
    expect(movies.map(movie => movie._id)).toEqual(['movie1', 'movie2', 'movie3']);

    movies = await store.find({_type: 'Movie', genre: 'action'});
    expect(movies.map(movie => movie._id)).toEqual(['movie1', 'movie3']);

    movies = await store.find({_type: 'Movie', genre: 'action', country: 'France'});
    expect(movies.map(movie => movie._id)).toEqual(['movie3']);

    movies = await store.find({_type: 'Movie', genre: 'adventure'});
    expect(movies.map(movie => movie._id)).toEqual([]);

    movies = await store.find({_type: 'Movie'}, {skip: 1, limit: 1});
    expect(movies.map(movie => movie._id)).toEqual(['movie2']);

    movies = await store.find({_type: 'Movie'}, {return: {title: true}});
    expect(movies).toEqual([
      {_type: 'Movie', _id: 'movie1', title: 'Inception'},
      {_type: 'Movie', _id: 'movie2', title: 'Forrest Gump'},
      {_type: 'Movie', _id: 'movie3', title: 'Léon'}
    ]);
  });
});
