import {MongoClient} from 'mongodb';
import debugModule from 'debug';
import {isEmpty, isInteger, isPlainObject, omit, get, set} from 'lodash';
import filterObj from 'filter-obj';
import assert from 'assert';
import {callWithOneOrManyAsync, mapFromOneOrMany, mapFromOneOrManyAsync} from '@storable/util';

import {findAllRelations, mergeRelatedDocuments, getPopulateRequests} from './relations-util';

const debug = debugModule('mongodb-store');
const debugQuery = debugModule('mongodb-store:queries');

export class MongoDBStore {
  constructor(connectionString, {collectionNames = {}} = {}) {
    if (!connectionString) {
      throw new Error(`No connectionString provided to connect to MongoDB!`);
    }
    this.connectionString = connectionString;
    this.collectionNames = collectionNames;
    this.isConnected = false;
  }

  /*
  Connect to the given database if no database is included at the end of the `connectionString`,
  `test` database if no nothing is provided
  */
  async connect(databaseName) {
    if (this.isConnected) {
      return; // already connected
    }
    debug('Connecting to MongoDB!');
    this.client = await MongoClient.connect(
      this.connectionString,
      {useNewUrlParser: true}
    );
    this.db = this.client.db(databaseName);
    this.isConnected = true;
    debug(`Connected to "${this.db.databaseName}" database`);
  }

  disconnect() {
    if (!this.isConnected) {
      throw new Error('No MongoDB connection to close');
    }
    debug('Disconnecting MongoDB');
    this.client.close();
    this.isConnected = false;
  }

  _getCollection(_type) {
    const collectionName = this.collectionNames[_type] || _type;
    if (!collectionName) {
      throw new Error(`No collection set up for the type "${_type}"`);
    }
    return this.db.collection(collectionName);
  }

  async set(document) {
    await this.connect();
    return await callWithOneOrManyAsync(document, async doc => {
      const {_isNew, _type, _id} = doc;
      validateType(_type);
      validateId(_id);

      const {$set, $unset} = parseSetRequest(doc);
      if (_isNew) {
        const newDocument = $set;
        debugQuery(`Insert ${_type}`, newDocument);
        const {result} = await this._getCollection(_type).insertOne(newDocument);
        return result;
      }

      const query = {_id};
      // Remove empty $set and $unset from the MongoDB "update" parameter (it will fail otherwise)
      const update = filterObj({$set, $unset}, (key, value) => !isEmpty(value));
      debugQuery(`Update ${_type} "${_id}"`, update);
      const result = await this._getCollection(_type).updateOne(query, update);
      if (result.matchedCount === 0) {
        throw new Error(`No document "${_id}" found in the collection ${_type}`);
      }
      return true;
    });
  }

  async get(document, options = {}) {
    return await mapFromOneOrManyAsync(document, async doc => {
      const {_id, _type} = doc;
      validateType(_type);
      validateId(_id);

      const foundDocs = Array.isArray(_id) ?
        await this._findMany(doc, options) :
        await this._findOne(doc, options);

      return mapFromOneOrMany(foundDocs, doc => {
        return doc && outputDocument(doc, _type, options);
      });
    });
  }

  async find({_type, ...document}, options = {}) {
    validateType(_type);

    const documents = await this._findMany(_type, document, options);
    return documents.map(doc => outputDocument(doc, _type, options));
  }

  async _findOne({_type, _id}, {return: returnFields = true} = {}) {
    const query = {_id};
    const projection = getProjection(returnFields);
    debugQuery(`findOne ${_type}`, query, projection);
    await this.connect();
    const foundDoc = await this._getCollection(_type).findOne(query, {projection});
    if (!foundDoc) {
      return undefined;
    }
    const populatedDoc = await this._populate(foundDoc, returnFields);
    return {_type, ...populatedDoc};
  }

  async _findMany(_type, query, {return: returnFields = true, limit, skip} = {}) {
    const projection = getProjection(returnFields);
    debugQuery(`findMany ${_type}`, query, projection);
    await this.connect();
    let cursor = this._getCollection(_type).find(query, {projection});
    if (limit) {
      if (!isInteger(limit)) {
        throw new Error('Find method `limit` parameter should be an integer');
      }
      cursor = cursor.limit(limit);
    }
    if (skip) {
      if (!isInteger(skip)) {
        throw new Error('Find method `skip` parameter should be an integer');
      }
      cursor = cursor.skip(skip);
    }
    const documents = await cursor.toArray();
    const populatedDocs = await this._populate(documents, returnFields);
    return populatedDocs.map(document => ({_type, ...document}));
  }

  async _findManyById({_type, _id}, options) {
    if (!Array.isArray(_id)) {
      throw new Error(`"_id" parameter passed to findManyById should be an array`);
    }
    const query = {_id: {$in: _id}};
    return this._findMany(_type, query, options);
  }

  async _populate(documents, parentReturnFields) {
    const relations = findAllRelations(documents);
    if (isEmpty(relations)) {
      return documents;
    }

    const relatedDocuments = [];
    const requests = getPopulateRequests(relations);
    for (const {_type, path, ids} of requests) {
      const returnFields = ignoreArray(get(parentReturnFields, path));
      if (returnFields === false || (isPlainObject(returnFields) && isEmpty(returnFields))) {
        continue;
      }
      const docs = await await this._findManyById({_type, _id: ids}, {return: returnFields});
      relatedDocuments.push(...docs); // `...` is used to flatten the array of array
    }
    const populated = mergeRelatedDocuments(documents, relatedDocuments);
    return populated;
  }

  async delete(document) {
    await this.connect();
    return await mapFromOneOrManyAsync(document, async ({_type, _id}) => {
      validateType(_type);
      validateId(_id);
      const {result} = await this._getCollection(_type).deleteOne({_id}); // { n: 0, ok: 1 },
      return result.n > 0;
    });
  }
}

/*
From the `returnFields` option of a store `get()` request,
return the field `projection` to be passed to MongoDB `find` and `findOne` methods.
*/
function getProjection(returnFields) {
  if (returnFields === false) {
    return {_id: 1, _type: true};
  }
  if (returnFields === true) {
    return {}; // return everything
  }
  const result = {};
  const addPathValue = (path, value) => {
    const key = path.join('.');
    result[key] = value;
  };

  const setFields = (object, path) => {
    const isRootPath = path.length === 0;
    if (isEmpty(object)) {
      addPathValue([...path, '_id'], 1);
      addPathValue([...path, '_type'], 1);
      addPathValue([...path, '_ref'], 1);
    }
    for (const [name, val] of Object.entries(ignoreArray(object))) {
      const value = ignoreArray(val);
      addPathValue([...path, '_id'], true);
      addPathValue([...path, '_type'], true);
      if (isPlainObject(value)) {
        setFields(value, [...path, name]);
      } else {
        if (!isRootPath) {
          addPathValue([...path, '_ref'], true);
        }
        addPathValue([...path, name], value);
      }
    }
    return result;
  };
  return setFields(returnFields, []);
}

/*
Process a document, already populated after a find() request,
before returning it to the client
called by `.get()` and `.find()` public methods
*/
function outputDocument(doc, _type, options) {
  const {_id: rootId} = doc;
  const {returnFields} = options;
  const setFields = document => {
    const result = {};
    const {...fields} = document;
    for (const [name, value] of Object.entries(fields)) {
      if (
        Array.isArray(value) &&
        !(returnFields === true || Array.isArray(returnFields) || returnFields === undefined)
      ) {
        throw new Error(
          `Type mismatch (collection: '${_type}', id: '${rootId}', field: '${name}', expected: 'Boolean' or 'Array', provided: '${typeof returnFields}')`
        );
      }
      if (Array.isArray(returnFields)) {
        if (!Array.isArray(value)) {
          throw new Error(
            `Type mismatch (collection: '${_type}', id: '${rootId}', field: '${name}', expected: 'Boolean' or 'Object', provided: 'Array')`
          );
        }
      }
      assert(
        value !== null,
        `The 'null' value is not allowed (collection: '${_type}', id: '${rootId}', field: '${name}')`
      );
      if (isPrimitive(value, {fieldName: name, _type, rootId})) {
        result[name] = serializeValue(value);
        continue;
      }
      result[name] = setFields(value);
    }
    return result;
  };
  const result = setFields(doc);
  return {_type, ...result};
}

/*
Parse the document passed to `set()` method,
to return the `$set` and `$unset` objects to be sent to MongoDB
*/
export function parseSetRequest(request) {
  const $set = {};
  const $unset = {};
  const isNewDocument = request._isNew;
  const rootType = request._type;
  const rootId = request._id;

  const cleanPrimitiveValue = (value, name) => {
    return mapFromOneOrMany(value, value => {
      if (!isPlainObject(value)) {
        return value;
      }
      const {_type, _ref, _id} = value;
      if (isReference(value, {fieldName: name, rootType, rootId})) {
        return {_type, _ref, _id}; // discard any other attribute
      }
      return value;
    });
  };

  const setFields = (object, path = []) => {
    const {_type, _isNew, ...fields} = object;
    for (const [name, val] of Object.entries(fields)) {
      const value = deserializeValue(val, {fieldName: name});
      if (isPrimitive(value, {fieldName: name, rootType, rootId})) {
        const fieldName = [...path, name].join('.');
        if (value === undefined) {
          $unset[fieldName] = 1;
        } else {
          $set[fieldName] = cleanPrimitiveValue(value, fieldName);
        }
        continue;
      }
      if (isNewDocument || value._isNew) {
        set($set, [...path, name].join('.'), omit(value, '_isNew')); // full update
      } else {
        setFields(value, [...path, name], false);
      }
    }
  };

  setFields(request, []);
  return {$set, $unset};
}

const ignoreArray = value => (Array.isArray(value) ? value[0] : value);

/*

==============================
Helpers from the Memory Store
==============================

*/

function validateType(_type) {
  if (typeof _type !== 'string') {
    throw new Error(`'_type' must be a string (provided: ${typeof _type})`);
  }
  if (_type === '') {
    throw new Error(`'_type' cannot be empty`);
  }
}

function validateId(_id) {
  if (typeof _id !== 'string') {
    throw new Error(`'_id' must be a string (provided: ${typeof _id})`);
  }
  if (_id === '') {
    throw new Error(`'_id' cannot be empty`);
  }
}

function serializeValue(value) {
  if (value instanceof Date) {
    return {_type: 'Date', _value: value.toISOString()};
  }
  return value;
}

function deserializeValue(value, {fieldName}) {
  if (value === null) {
    throw new Error(`The 'null' value is not allowed (field: '${fieldName}')`);
  }

  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'object' && value._type === 'undefined') {
    return undefined;
  }

  if (typeof value === 'object' && value._type === 'Date') {
    return new Date(value._value);
  }

  return value;
}

function isPrimitive(value, {fieldName, rootType, rootId}) {
  if (typeof value !== 'object' || value instanceof Date) {
    return true;
  }

  if (value._type === undefined) {
    // The value is a plain object
    const {_isNew, _id, _ref} = value;
    if (_isNew !== undefined || _id !== undefined || _ref !== undefined) {
      throw new Error(
        `A plain object value cannot include a reserved attribute (collection: '${rootType}', id: '${rootId}', field: '${fieldName}')`
      );
    }
    return true;
  }

  // The value is a submodel, a subdocument or a reference
  return false;
}

function isReference(value, {fieldName, rootType, rootId}) {
  if (isPrimitive(value, {fieldName, rootType, rootId})) {
    return false;
  }

  const {_isNew, _type, _id, _ref} = value;
  if (_ref === true) {
    validateType(_type);
    validateId(_id);
    if (_isNew !== undefined) {
      throw new Error(
        `A reference cannot include the '_isNew' attribute (collection: '${rootType}', id: '${rootId}', field: '${fieldName}')`
      );
    }
    return true;
  }

  // The value is a submodel or a subdocument
  return false;
}
