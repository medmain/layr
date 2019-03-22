import {getDocumentToInsert, flattenWithDotPath} from '../../../dist/node/cjs/mongodb-util';

const testCases = [
  {
    input: {
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
    },
    output: {
      _id: 'abc123',
      title: 'Inception',
      technicalSpecs: {
        _type: 'TechnicalSpecs',
        _id: 'xyz789',
        runtime: 120,
        aspectRatio: '2.39:1'
      }
    },
    comment: 'Basic request'
  }
];

describe('insert', () => {
  testCases.forEach(({input, output, comment}) => {
    test(comment, () => {
      const actualResult = getDocumentToInsert(input);
      expect(actualResult).toEqual(output);
    });
  });
});

describe('flattenWithDotProp', () => {
  test('Convert a nested object into a flat object using the `dotprop` syntax', () => {
    expect(flattenWithDotPath({a: {b: {c: 1}}, name: 0})).toEqual({'a.b.c': 1, name: 0});
    expect(flattenWithDotPath({})).toEqual({});
  });
});
