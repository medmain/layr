# @storable/model

Base class providing typed properties, validation and serialization.

## Installation

```
npm install @storable/model @storable/registry
```

## Overview

```js
import {Model, field} from '@storable/model';
import {Registry} from '@storable/registry';

// Define the models, extending `Model`
class Actor extends Model {
  @field('string') fullName;
}

class Movie extends Model {
  @field('string', {serializedName: '_id'}) id;
  @field('string') title;
  @field('Date') releasedOn;
  @field('Actor[]') actors;
}

// Create the registry, the glue between the models
const registry = new Registry({Movie, Actor});
```

## Field definition

Inside the models, use `@field('<type>', options)` decorator to describe the document attributes.

### Available types

- `'string'`
- `'number'`
- `'boolean'`
- `'Date'`
- `'object'`

### Available options

- `serializedName`: used to customized the field name when the document is serialized (see the "Serialization" section)
- `validators`: an array of validator object

### Validators

Validators are simple functions that run against the value of a field and return whether the value is valid or not.

For convenience, the package comes with a set of built-in validators.

#### For number fields

- `integer()`
- `greaterThanOr(number)`
- `greaterThanOrEqual(number)`
- `negative()`
- `positive()`
- `lessThan(number)`
- `lessThanOrEqual(number)`

#### For string and array fields

- `notEmpty()`
- `minLength(number)`
- `maxLength(number)`

#### For strings

- `match(regExp)`: the value should match the given regular expression

#### For any value

- `anyOf(allowedValues)`: the value should be one of the values defined in the given array.

#### Example

How to assign `anyOf` validator to the "status" field of a model:

```js
import {Document field, validators} from '@storable/document';
const {anyOf} = validators;

class Post extends Model {
  @field('string', {validators: [anyOf(['DRAFT', 'PUBLISHED', 'ARCHIVED'])]}) status
}
```

### Default values

A default value can be assigned using the syntax `@field('type') myAttribute = value`.

```js
@field('boolean') deleted = false
```

### Composition

Models registered in the registry can be used like any other type.
For example, if the registry contains a model called `"Actor"`, we can set up a field called `"actors"` whose type will be an array of `"Actor"` documents.

```js
@field('Actor[]') actors;
```

### Arrays

Arrays can be used for any type, whether it's a primitive or an other model, by adding `[]` after the field type:

- `'string[]'`
- `'number[]'`
- `'object[]'`
- `'Actor[]'`

## Serialization

### `.serialize()`

`serialize()` method produces a JSON representation of the document.

By default, field names are the names defined in the model, but it's possible to customize the name used in the JSON representation.

For example, the field `id` can be serialized under the name `_id` if we specify this in the model:

```js
@field('string', {serializedName: '_id'}) id;
```

```js
let movie = new registry.Movie({
  id: 'abc123',
  title: 'Inception',
  releasedOn = new Date(Date.UTC(2010, 6, 16))
})
console.log(movie.deserialize())
// =>
// {
//   "_isNew": true,
//   "_type": "Movie",
//   "_id": "abc123"
//   "title": "Inception",
//   "releasedOn": { "_type": "Date", "_value": "2010-07-16T00:00:00.000Z" },
//   "actors": []
// }
```

### `Model.deserialize(document)`

`deserialize` static method creates an instance of the `Model` class from a given JSON representation of the document

```js
let movie = registry.Movie.deserialize({
  id: 'abc123',
  title: 'Inception',
  releasedOn: {_type: 'Date', _value: '2010-07-16T00:00:00.000Z'}
});
console.log(movie.deserialize());
// =>
// {
//   "_type": "Movie",
//   "title": "Inception",
//   "releasedOn": { "_type": "Date", "_value": "2010-07-16T00:00:00.000Z" }
// }
```

## Development

To run the tests, launch the following command from the root of the mono-repo:

```shell
run ./packages/model tests run
```
