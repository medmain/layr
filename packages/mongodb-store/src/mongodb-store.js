import {MongoClient} from 'mongodb';
import debugModule from 'debug';

import {getDocumentToInsert, getProjection, getDocumentToUpdate} from './mongodb-util';

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
      debugQuery('Insert', document);
      const {result} = await this._getCollection(_type).insertOne(document);
      return result;
    }
    const query = {_id};
    const update = getDocumentToUpdate(request);
    debugQuery(`Update "${_id}"`, update);
    const result = await this._getCollection(_type).updateOne(query, update);
    if (result.matchedCount === 0) {
      throw new Error(`No document "${_id}" found in the collection ${_type}`);
    }
    return true;
  }

  async get({_type, _id}, {return: returnFields = true} = {}) {
    const query = {_id};
    const projection = getProjection(returnFields);
    const foundDoc = await this._getCollection(_type).findOne(query, {projection});
    if (!foundDoc) {
      return undefined;
    }
    return {_type, ...foundDoc};
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
