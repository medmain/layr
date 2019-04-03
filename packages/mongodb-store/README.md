# @storable/mongodb-store

A store for [MongoDB](https://www.mongodb.com/) database, to be used with [@storable/document](https://github.com/medmain/storable/tree/master/packages/document) and [@storable/registry](https://github.com/medmain/storable/tree/master/packages/registry).

## Installation

```shell
npm install @storable/mongodb-store
```

## Overview

```js
import {MongoDBStore} from '@storable/mongodb-store';

const store = new MongoDBStore('mongodb://127.0.0.1/test');

// Query the database
const movie = await store.get({_type: 'Movie', _id: 'abc001'});

// Update a document
await store.set({_type: 'Movie', _id: 'abc001', rating: 9.1});

// Close the MongoDB connection
store.disconnect();
```

## MongoDBStore API

### `new MongoDBStore(connectionString, options)`

The MongoDBStore constructor accepts two parameters:

- the MongoDB "connection string": `mongodb://<username>:<password>@<host>:<port>/<dbName>?authSource=<adminDbName>`
- an object of `options` to customize the default behavior
  - `collectionNames`: an object that associates document's `_type` property with the actual collection names. For example, using `{collectionNames: {Movie: 'movies'}}` will save document whose `_type` is `"Movie"` in a collection called `"movies"` (instead of `"Movie"` by default).

### `set(document)` method

Used to **create** a new document or to **update** an existing document.

Example of creation:

```js
await store.set({
  _isNew: true,
  _type: 'Movie',
  _id: 'abc001',
  title: 'Inception',
  genre: 'action'
});
```

Example of document update:

```js
await store.set({
  _type: 'Movie',
  _id: 'abc001',
  rating: 9.1
});
```

`set` method accepts an object as its single argument:

- `_isNew: true` specifies a document **creation**. `_isNew: false` is used for document **updates**.
- `_type` specifies the collection where to store the document
- `_id`: is required only for updates. For creations, a unique id will be generated if it's not provided
- All other properties (_title_, _genre_...) will be used to create or update the document in the collection.

### `get(document, options)` method

Used to retrieve a single document by its id.

```js
const movie = await store.get({_type: 'Movie', _id: 'abc001'});
// => {_type: 'Movie', _id: 'abc001', title: 'Inception', genre: 'action'}
```

Available options:

`return` specify the fields to be returned (the `projection` in the MongoDB jargon).

- `{return: true}` means all fields will be returned, it's the default behavior
- `{return: false}` means no field will be returned, only `_type` and `_id`. which is useful too check whether a document exists or not
- `{return: {title: true}}` means only the `title` field will be returned.

```js
const movie = await store.get({_type: 'Movie', _id: 'xyz123'}, {return: {title: true}});
// => {_type: 'Movie', _id: 'abc001', title: 'Inception'}
```

### `find(document, options)` method

Used to find several documents that match search criteria.
Return an array of the matching documents, or an empty array if no document was found.

```js
const movies = await store.find({_type: 'Movie'});
// => the array of all documents in the `Movie` collection
```

Available options:

- `return`
- `skip`
- `limit`
- `sort`

As for the `get()` method, the `find()` method accepts a `return` option to specify the fields to include in the response.

```js
const movies = await store.find({_type: 'Movie'}, {return: {title: true}});
// =>
// [
//   {_type: 'Movie', _id: 'movie1', title: 'Inception'},
//   {_type: 'Movie', _id: 'movie2', title: 'Forrest Gump'},
//   {_type: 'Movie', _id: 'movie3', title: 'Léon'}
// ]
```

`skip` and `limit` are used to paginate the list of results, requesting documents from a given index and limiting the number of documents returned.

`sort` option is used to set the sort order.

The following code will return the movies sorted by their rating, in the descending order, the number of documents is limited to 10.

```js
const topMovies = await store.find({_type: 'Movie'}, {sort: {rating: -1}, limit: 10});
// => an array of the 10 best movies, according to the ratings
```

### `delete(document)`

Delete a document by its id

```js
const result = await store.delete({_type: 'Movie', _id: 'abc001'});
// => true if the document has been deleted
```

### How to reference documents

The `_ref: true` attribute is used to reference documents in other collections.

The following code will create two documents, in two different collections:

```js
// Create "Movie" document, that has a link (a reference) to a "Director" document
await store.set({
  _isNew: true,
  _type: 'Movie',
  _id: 'abc003',
  title: 'Inception',
  director: {_type: 'Director', _id: 'xyz123', _ref: true}
});

// Create the "Director" document
await store.set({
  _isNew: true,
  _type: 'Director',
  _id: 'xyz123',
  fullName: 'Christopher Nolan'
});
```

By default, when a document that contains references is retrieved, data from the related documents is automatically included.

This feature is similar to the _population_ feature from [Mongoose](https://mongoosejs.com/docs/populate.html) library:

> Population is the process of automatically replacing the specified paths in the document with document(s) from other collection(s)

So if we query the previous movie, the result will contain the movie itself **and** its director:

```js
const movie = await store.get({_type: 'Movie', _id: 'abc003'});
// =>
// {
//   _type: 'Movie',
//   _id: 'abc003',
//   title: 'Inception',
//   director: {_type: 'Director', _id: 'xyz123', _ref: true, fullName: 'Christopher Nolan'}
// }
```

This is the default behavior but it can be adjusted at will using the `return` option.

The following code will return only the movie and its title, the "director" will not be included:

```js
const movie = await store.get({_type: 'Movie', _id: 'abc003'}, {return: {title: true}});
// => {_type: 'Movie', _id: 'abc003', title: 'Inception'}
```

Using an empty object `{}` inside the `return` option, the population will be limited to the fields `_type`, `_type` and `_ref`.

```js
const movie = await store.get(
  {_type: 'Movie', _id: 'abc003'},
  {return: {title: true, director: {}}}
);
// =>
// {
//    _type: 'Movie',
//    _id: 'abc003',
//    title: 'Inception',
//    director: {
//      _type: 'Director', _id: 'xyz123', _ref: true
//    }
// }
```

## How to use it with models and the registry

MongoDBStore shines when it's used along with the registry coming from `@storable/registry` and models extending `@storable/document`.

The CRUD features follow the [@storable/document](https://github.com/medmain/storable/tree/master/packages/document) API, providing the following methods:

- `save()`
- `get()`
- `find()`
- `delete()`

Overview:

```js
import {Document, field} from '@storable/document';
import {Registry} from '@storable/registry';
import {MongoDBStore} from '@storable/mongodb-store';

// STEP 1: define the models, extending the `Document` class
class Movie extends Document {
  @field('string') title;
}

class Actor extends Document {
  @field('string') fullName;
}

// STEP 2: create the store
const store = new MongoDBStore('mongodb://...');

// STEP 3: create the registry, putting the store and all models together
const registry = new Registry({Movie, Actor, store});

// Creating a new document
const movie = new registry.Movie({title: 'The Matrix'});
await movie.save();

store.disconnect();
```

Check [@storable/document](https://github.com/medmain/storable/tree/master/packages/document) for more details.

## Run the tests

From the root of the monorepo:

```
run ./packages/mongodb-store @test
```
