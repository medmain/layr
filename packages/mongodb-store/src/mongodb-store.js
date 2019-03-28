import {MongoClient} from 'mongodb';
import debugModule from 'debug';
import {isEmpty, isInteger, get} from 'lodash';
import filterObj from 'filter-obj';
import {callWithOneOrManyAsync, mapFromOneOrManyAsync} from '@storable/util';

import {parseSetRequest, getProjection} from './mongodb-util';

import {findAllRelations, mergeRelatedDocuments, getPopulateRequests} from './relations-util';

const debug = debugModule('mongodb-store');
const debugQuery = debugModule('mongodb-store:queries');

export class MongoDBStore {
  constructor(connectionString, {collectionNames = {}} = {}) {
    this.connectionString = connectionString;
    this.collectionNames = collectionNames;
  }

  async connect(databaseName) {
    if (this.db) {
      return;
    }
    const {db, disconnect} = await connectMongoDB(this.connectionString, databaseName);
    this.db = db;
    this.disconnect = disconnect;
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
      const {$set, $unset} = parseSetRequest(doc);
      const {_isNew, _type, _id} = doc;
      if (_isNew) {
        const newDocument = $set;
        debugQuery(`Insert ${_type}`, newDocument);
        const {result} = await this._getCollection(_type).insertOne(newDocument);
        return result;
      }
      const query = {_id};
      const update = filterObj({$set, $unset}, (key, value) => !isEmpty(value));
      debugQuery(`Update ${_type} "${_id}"`, update);
      const result = await this._getCollection(_type).updateOne(query, update);
      if (result.matchedCount === 0) {
        throw new Error(`No document "${_id}" found in the collection ${_type}`);
      }
      return true;
    });
  }

  async get(document, options) {
    return await mapFromOneOrManyAsync(document, async doc => {
      if (Array.isArray(doc._id)) {
        return await this._findMany(doc, options);
      }
      return await this._findOne(doc, options);
    });
  }

  async find({_type, ...document}, options) {
    return this._findMany(_type, document, options);
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
    return documents.map(document => ({_type, ...document}));
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
      const returnFields = get(parentReturnFields, path);
      const docs = await await this._findManyById({_type, _id: ids}, {return: returnFields});
      relatedDocuments.push(...docs); // `...` is used to flatten the array of array
    }

    const populated = mergeRelatedDocuments(documents, relatedDocuments);
    return populated;
  }

  async delete(document) {
    await this.connect();
    return await mapFromOneOrManyAsync(document, async ({_type, _id}) => {
      const {result} = await this._getCollection(_type).deleteOne({_id}); // { n: 0, ok: 1 },
      return result.n > 0;
    });
  }
}

async function connectMongoDB(url, databaseName) {
  if (!url) {
    throw new Error(`No connectionString provided to connect to MongoDB!`);
  }
  debug('Connecting to MongoDB...');
  const client = await MongoClient.connect(
    url,
    {useNewUrlParser: true}
  );
  const db = client.db(databaseName); // `test` database if no databaseName is provided
  debug(`Connected to "${db.databaseName}" database`);
  return {
    db,
    disconnect: () => {
      debug('Disconnecting MongoDB');
      client.close();
    }
  };
}
