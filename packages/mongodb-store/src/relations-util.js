/*
A bunch of synchronous functions to manipulate document relations
(No request to the database here)
*/

import {mapValues, groupBy, uniq} from 'lodash';
import isPlainObject from 'is-plain-obj';
import {callWithOneOrMany, mapFromOneOrMany} from '@storable/util';

/*
Find all relations defined in a given document (or array of documents)
return an array of objects: [{ _type, _id, _path }]
where path is the position where the relation has been found inside the document
*/
export function findAllRelations(object) {
  const isRelation = value => value._ref;
  const relations = [];
  callWithOneOrMany(object, document => {
    const addRelation = ({_type, _id, path}) => {
      const relation = {_type, _id, path: path.join('.')};
      relations.push(relation);
    };
    const walk = (object, rootPath = []) => {
      Object.entries(object).forEach(([key, value]) => {
        callWithOneOrMany(value, value => {
          const path = [...rootPath, key];
          if (isRelation(value)) {
            const {_type, _id} = value;
            addRelation({_type, _id, path});
          }
          if (isPlainObject(value)) {
            walk(value, path);
          }
        });
      });
    };
    walk(document);
  });
  return relations;
}

/*
Loop through an object of relations, grouping by `_type` and field `path`
and return an array of find requests to be made
E.g.:
[{_type, path, ids: [id1,  id2,...]}]
*/
export function getPopulateRequests(relations) {
  const byTypeAndPath = groupBy(relations, ({_type, path}) => `${_type} ${path}`);
  const requests = Object.values(byTypeAndPath).map(grouped => ({
    _type: grouped[0]._type,
    path: grouped[0].path,
    ids: uniq(grouped.map(({_id}) => _id))
  }));
  return requests;
}

/*
Enhance an array of documents with data coming from "related documents",
to perform the "populate state"
*/
export function mergeRelatedDocuments(documents, relatedDocuments) {
  return mapFromOneOrMany(documents, document => {
    return mapDocumentRefs(document, value => {
      const {_type, _id} = value;
      const foundDocument = relatedDocuments.find(doc => doc._id === _id && doc._type === _type);
      return foundDocument ? {_type, _ref: true, ...foundDocument} : value;
    });
  });
}

/*
Apply a function (the mapper) on every object of the document that contains a reference
and return the updated document
*/
export function mapDocumentRefs(document, mapper) {
  // it works with single documents and array of documents
  return mapFromOneOrMany(document, document => {
    return mapValues(document, (value, key) => {
      // handle arrays in the document
      return mapFromOneOrMany(value, value => {
        if (isPlainObject(value)) {
          return value._ref ? mapper(value, key) : mapDocumentRefs(value, mapper);
        }
        return value;
      });
    });
  });
}
