import {isEmpty} from 'lodash';
import filterObj from 'filter-obj';
import isPlainObject from 'is-plain-obj';

/*
From a creation request made with store `set()` method,
return the document to insert in the MongoDB collection.
*/
export function getDocumentToInsert(request) {
  const setFields = (input, isRootLevel) => {
    const documentToInsert = {};
    const {_isNew, _type, ...other} = input;
    const fields = isRootLevel ? other : {_type, ...other}; // we don't want the `type` to be stored at the root level
    for (const [name, value] of Object.entries(fields)) {
      if (isPlainObject(value)) {
        documentToInsert[name] = setFields(value);
      } else {
        documentToInsert[name] = value;
      }
    }
    return documentToInsert;
  };

  return setFields(request, true);
}

/*
From an update request made with store `set()` method,
return the `update` parameter to pass to MongoDB `updateOne` method.
*/
export function getDocumentToUpdate(request) {
  const {_isNew, _type, _id, ...fields} = request;
  const $set = flattenWithDotPath(filterObj(fields, (key, value) => value !== undefined));
  const $unset = filterObj(fields, (key, value) => value === undefined);
  const update = filterObj({$set, $unset}, (key, value) => !isEmpty(value));
  return update;
}

/*
From the `returnFields` option of a store `get()` request,
return the field `projection` to be passed to MongoDB `find` and `findOne` methods.
*/
export function getProjection(returnFields) {
  if (returnFields === false) {
    return {_id: 1};
  }
  if (returnFields === true) {
    return {};
  }
  const result = {};
  const addPathValue = (path, value) => {
    const key = path.join('.');
    result[key] = value;
  };
  const setFields = (object, path) => {
    if (isEmpty(object)) {
      addPathValue([...path, '_id'], 1);
      addPathValue([...path, '_type'], 1);
      addPathValue([...path, '_ref'], 1);
    }
    for (const [name, value] of Object.entries(object)) {
      if (isPlainObject(value)) {
        setFields(value, [...path, name]);
      } else {
        if (path.length !== 0) {
          addPathValue([...path, '_id'], 1);
          addPathValue([...path, '_type'], 1);
        }
        addPathValue([...path, name], value);
      }
    }
    return result;
  };
  return setFields(returnFields, []);
}

/*
Flatten a deeply nested object using the "dot path" syntax.
See https://github.com/sindresorhus/dot-prop for an example
*/
export function flattenWithDotPath(object) {
  const result = {};
  const setFields = (object, path) => {
    for (const [name, value] of Object.entries(object)) {
      const keys = [...path, name];
      if (isPlainObject(value)) {
        setFields(value, [...path, name]);
      } else {
        result[keys.join('.')] = value;
      }
    }
    return result;
  };
  return setFields(object, []);
}
