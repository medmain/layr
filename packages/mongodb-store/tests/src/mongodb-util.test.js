import {getProjection} from '../../../dist/node/cjs/mongodb-util';

describe('Util functions', () => {
  test('getProjection', () => {
    expect(getProjection({director: {}})).toEqual({
      'director._id': 1,
      'director._type': 1,
      'director._ref': 1
    });
  });
});
