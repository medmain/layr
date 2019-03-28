import {isEmpty, isPlainObject, set, omit} from 'lodash';

/*
From an update request made with store `set()` method,
return the `update` parameter to pass to MongoDB `updateOne` method,
or the document to be passed to `insert` method
*/
export function parseSetRequest(request) {
  const $set = {};
  const $unset = {};
  const isNewDocument = request._isNew;
  const setFields = (object, path = []) => {
    const {_type, _isNew, ...fields} = object;
    for (const [name, value] of Object.entries(fields)) {
      if (isPlainObject(value)) {
        if (isNewDocument || value._isNew) {
          // full update
          set($set, [...path, name].join('.'), omit(value, '_isNew'));
        } else {
          setFields(value, [...path, name], false);
        }
      } else {
        const fieldName = [...path, name].join('.');
        if (value === undefined) {
          $unset[fieldName] = 1;
        } else {
          $set[fieldName] = value;
        }
      }
    }
  };
  setFields(request, []);
  return {$set, $unset};
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
