# @storable/mongodb-store

A store for [MongoDB](https://www.mongodb.com/) database, to be used with [@storable/document](https://github.com/medmain/storable/tree/master/packages/document) and [@storable/registry](https://github.com/medmain/storable/tree/master/packages/registry).

## Installation

```shell
npm install @storable/mongodb-store
```

```js
import {MongoDBStore} from '@storable/mongodb-store';

const store = new MongoDBStore({connectionString: 'mongodb://...');
await store.connect()
```

## MongoDbStore API

### `set(document)`

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

`set` method accepts a single argument:

- `_isNew: true` specifies a document **creation**. `_isNew: false` is used for document **updates**.
- `_type` specifies the collection where to store the document
- `_id`: is required only for updates. For creations, a unique id will be generated if it's not provided
- All other properties (_title_, _genre_...) will be used to create the document in the collection.

### `get(query, options)`

Used to retrieve a single document by its id.

```js
const movie = await store.get({_type: 'Movie', _id: 'abc001'});
// => {_type: 'Movie', _id: 'abc001', title: 'Inception', genre: 'action'}
```

Available options:

`return` specify the fields to be returned (the `projection` in MongoDB jargon).

- `{return: true}` means all fields will be returned, it's the default behavior
- `{return: false}` means no field will be returned, only `_type` and `_id`. which is useful too check whether a document exists or not

E.g.

```js
const movie = await store.get({_type: 'Movie', _id: 'xyz123'}, {return: {title: true}});
// => {_type: 'Movie', _id: 'abc001', title: 'Inception'}
```

### `find(query, options)`

Used to find several documents that match search criteria.

```js
const movies = await store.find({_type: 'Movie'});
// => will return the array of all documents in the `Movie` collection
```

### `delete(query)`

```js
const result = await store.delete({_type: 'Movie', _id: 'abc001'});
// => return true if the document has been deleted
```

### Relations between documents

The `_ref: true` attribute is used to specify a relation with a document stored in an other collection.

The following code will create 2 documents, in 2 different collections:

```js
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
```

By default, when a document related to other documents is retrieved, data from the related documents is automatically included (the main document is "populated" with the related documents).

```js
const movie = await store.get({_type: 'Movie', _id: 'abc003'});
```

The result will contain the Movie **and** its director:

```js
{
  _type: 'Movie',
  _id: 'abc003',
  title: 'Inception',
  director: {_type: 'Director', _id: 'xyz123', _ref: true, fullName: 'Christopher Nolan'}
}
```

## How to use it with models and the registry

MongoDBStore shines when it's used along with the registry coming from `@storable/registry` and models extending `@storable/document`.

Let's put everything together:

```js
import {Document, field} from '@storable/document';
import {MongoDBStore} from '@storable/mongodb-store';
import {Registry} from '@storable/registry';

// STEP 1: define the models, extending the `Document` class
class Movie extends Document {
  @field('string') title;
}

class Actor extends Document {
  @field('string') fullName;
}

// STEP 2: create the store
const store = new MongoDBStore({connectionString: 'mongodb://...');

// STEP 3: create the registry, putting the store and all models together
const registry = new Registry({Movie, Actor, store});
```

The CRUD features follow the [@storable/document](https://github.com/medmain/storable/tree/master/packages/document) API, providing the following methods:

- `save()`
- `get()`
- `find()`
- `delete()`

### Create a new document

```js
const movie = new registry.Movie({title: 'The Matrix'});
await movie.save();
```

### Read existing documents

`get` and `find` method return instances of documents:

```js
const movie = await registry.Movie.get('123abc');
```

```js
const movies = await registry.Movie.find({});
```

### Update a document

Updates are made by mutating the document properties (following the rules defined by the model) and calling the `save()` method

```js
movie.rating = 9.1;
await movie.save();
```

### Delete a document

```js
await movie.delete();
```

### Hooks

Hooks are defined as methods on the models. Available hooks:

- beforeSave
- afterSave
- beforeDelete
- afterDelete

Tips:

- Use `this.isNew()` if you need to check whether the operation is a creation or an update.
- Don't forget to call the the hook on the parent class when the class extends an other one (`super.beforeSave()` for example)

Example of `beforeSave` hook that adds `createdOn` and `updatedOn` fields on the document:

```js
async beforeSave() {
  const now = new Date();
  if (this.isNew()) {
    this.createdOn = now;
  } else {
    this.updatedOn = now;
  }
}
```

## Run the tests

From the root of the monorepo:

```
run ./packages/mongodb-store @test
```
