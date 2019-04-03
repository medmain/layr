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

```js
const movie = await registry.Movie.get('123abc');
```

```js
const movies = await registry.Movie.find({});
```

`get` and `find` methods both return instances of the `Document` class. These instances can be mutated later and saved later.

### Update a document

Updates are made by mutating the document properties (following the rules defined by the model) and calling the `save()` method.

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
