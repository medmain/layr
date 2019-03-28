import {isEmpty, isPlainObject} from 'lodash';

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
