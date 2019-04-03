# @storable/document

Base class inheriting from [@storable/model](https://github.com/medmain/storable/tree/master/packages/model) and adding persistence capabilities.

Use it along with [@storable/registry](https://github.com/medmain/storable/tree/master/packages/registry) and one of the available stores:

- [Memory Store](https://github.com/medmain/storable/tree/master/packages/memory-store)
- MongoDB Store (coming soon)

## Installation

```
npm install @storable/document @storable/registry @storable/memory-store
```

## Setup

```js
import {Document, field} from '@storable/document';
import {MemoryDBStore} from '@storable/memory-store';
import {Registry} from '@storable/registry';

// STEP 1: define the models, extending the `Document` class
class Movie extends Document {
  @field('string') title;
}

class Actor extends Document {
  @field('string') fullName;
}

// STEP 2: create the store
const store = new MemoryStore();

// STEP 3: create the registry, putting the store and all models together
const registry = new Registry({Movie, Actor, store});
```

## CRUD features

### Create a new document

Documents are created by calling the constructor of the model, attached to the registry (`new registry.MyModel(document)`), and calling the `save()` method.

```js
const movie = new registry.Movie({title: 'The Matrix'});
await movie.save();
```

### Read existing documents

- `get(id, options)`: retrieves an existing document by its id
- `find(query, options)`: returns an array of documents that match the query parameter

`get` and `find` methods both return instances of the `Document` class. These instances can be mutated and saved later (see the next section).

Both methods accept a `return` option, to specify the fields to be returned in the results.

- `{return: true}` means all fields will be returned, it's the default behavior
- `{return: false}` means no field will be returned, except `id`. It's useful to check whether a document exists or not.
- `{return: {title: true}}` means only the `title` field will be returned.

#### `get(id, options)`

```js
const movie = await registry.Movie.get('123abc');
// => { id: '123abc', title: 'Inception', year: 2010 }
```

#### `find(query, options)`

`find` method is used to find several documents that match search criteria.
It returns an array of the matching documents, or an empty array if no document was found.

No `query` parameter or an empty object `{}` will return all movies in store.

```js
const movies = await registry.Movie.find({});
// =>
// [
//   { id: '123abc', title: 'Inception', year: 2010 },
//   { id: '456def', title: 'The Matrix', year: 1999 }
// ]
```

Available options:

- `return`
- `skip`
- `limit`
- `sort`

As for the `get()` method, the `find()` method accepts a `return` option to specify the fields to include in the response.

```js
const movies = await registry.Movie.find({}, {return: {title: true}});
// =>
// [
//   {id: 'movie1', title: 'Inception'},
//   {id: 'movie2', title: 'Forrest Gump'},
//   {id: 'movie3', title: 'Léon'}
// ]
```

`skip` and `limit` are used to paginate the list of results, requesting documents from a given index and limiting the number of documents returned.

`sort` option is used to set the sort order.

The following code will return the movies sorted by their rating, in the descending order, the number of documents is limited to 10.

```js
const topMovies = await registry.Movie.find({}, {sort: {rating: -1}, limit: 10});
// => an array of the 10 best movies, according to the ratings
```

### Update a document

Updates are made by mutating the instance of the `Document` class and calling the `save()` method.

```js
movie.rating = 9.1;
await movie.save();
```

When trying to save a document, validation rules defined in the model apply.

### Delete a document

Call `delete` on an instance of a `Document` to delete a document from the store.

```js
await movie.delete();
```

### Validation

[Coming soon]

### Hooks

Hooks are defined as methods on the models. Available hooks:

- `beforeSave()`
- `afterSave()`
- `beforeDelete()`
- `afterDelete()`

Tips:

- In `beforeSave` and `afterSave` hooks, use `this.isNew()` if you need to check whether the operation is a creation or an update.
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

## Development

To run the tests, launch the following command from the root of the mono-repo:

```shell
run ./packages/document tests run
```
