import {
  getDocumentToInsert,
  flattenWithDotPath,
  getProjection
} from '../../../dist/node/cjs/mongodb-util';

describe('insert', () => {
  test('getDocumentToInsert', () => {
    const input = {
      _isNew: true,
      _type: 'Movie',
      _id: 'abc123',
      title: 'Inception',
      technicalSpecs: {
        _isNew: true,
        _type: 'TechnicalSpecs',
        _id: 'xyz789',
        runtime: 120,
        aspectRatio: '2.39:1'
      }
    };
    const expected = {
      _id: 'abc123',
      title: 'Inception',
      technicalSpecs: {
        _type: 'TechnicalSpecs',
        _id: 'xyz789',
        runtime: 120,
        aspectRatio: '2.39:1'
      }
    };
    const output = getDocumentToInsert(input);
    expect(output).toEqual(expected);
  });
});

describe('Util functions', () => {
  test('flattenWithDotPath', () => {
    expect(flattenWithDotPath({a: {b: {c: 1}}, name: 0})).toEqual({'a.b.c': 1, name: 0});
    expect(flattenWithDotPath({})).toEqual({});
  });

  test('getProjection', () => {
    expect(getProjection({director: {}})).toEqual({
      'director._id': 1,
      'director._type': 1,
      'director._ref': 1
    });
  });
});
