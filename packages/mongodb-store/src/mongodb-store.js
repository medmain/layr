import {MongoClient} from 'mongodb';
import debugModule from 'debug';
import {isEmpty, get} from 'lodash';

import {getDocumentToInsert, getProjection, getDocumentToUpdate} from './mongodb-util';

import {findAllRelations, mergeRelatedDocuments, getPopulateRequests} from './relations-util';

const debug = debugModule('mongodb-store');
const debugQuery = debugModule('mongodb-store:queries');

export class MongoDBStore {
  constructor({connectionString, collectionNames} = {}) {
    this.connectionString = connectionString;
    this.collectionNames = collectionNames;
  }

  async connect(databaseName) {
    const {db, disconnect} = await connectMongoDB(this.connectionString, databaseName);
    this.db = db;
    this.disconnect = disconnect;
  }

  _getCollection(_type) {
    const collectionName = this.collectionNames[_type];
    if (!collectionName) {
      throw new Error(`No collection set up for the type "${_type}"`);
    }
    return this.db.collection(collectionName);
  }

  async set(request) {
    const {_isNew, _type, _id} = request;
    if (_isNew) {
      const document = getDocumentToInsert(request);
      debugQuery(`Insert ${_type}`, document);
      const {result} = await this._getCollection(_type).insertOne(document);
      return result;
    }
    const query = {_id};
    const update = getDocumentToUpdate(request);
    debugQuery(`Update ${_type} "${_id}"`, update);
    const result = await this._getCollection(_type).updateOne(query, update);
    if (result.matchedCount === 0) {
      throw new Error(`No document "${_id}" found in the collection ${_type}`);
    }
    return true;
  }

  async _findOne({_type, _id}, {return: returnFields = true} = {}) {
    const query = {_id};
    const projection = getProjection(returnFields);
    debugQuery(`findOne ${_type}`, query, projection);
    const foundDoc = await this._getCollection(_type).findOne(query, {projection});
    if (!foundDoc) {
      return undefined;
    }
    const populatedDoc = await this.populate(foundDoc, returnFields);
    return {_type, ...populatedDoc};
  }

  async _findManyById({_type, _id}, {return: returnFields = true} = {}) {
    if (!Array.isArray(_id)) {
      throw new Error(`"_id" parameter passed to findManyById should be an array`);
    }
    const query = {_id: {$in: _id}};
    const projection = getProjection(returnFields);
    debugQuery(`findMany ${_type}`, query, projection);
    const documents = await this._getCollection(_type)
      .find(query, {projection})
      .toArray();
    return documents.map(document => ({_type, ...document}));
  }

  async get(document, options) {
    if (Array.isArray(document._id)) {
      return this._findMany(document, options);
    }
    return this._findOne(document, options);
  }

  async populate(documents, parentReturnFields) {
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

  async delete({_type, _id}) {
    const {result} = await this._getCollection(_type).deleteOne({_id}); // { n: 0, ok: 1 },
    return result.n > 0;
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
