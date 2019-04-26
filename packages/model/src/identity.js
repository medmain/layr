import {inspect} from 'util';
import cuid from 'cuid';

import {Model} from './model';

export class Identity extends Model {
  static _findExistingInstance(object, {previousInstance}) {
    if (previousInstance?.constructor === this && previousInstance._id === object?._id) {
      return previousInstance;
    }
  }

  constructor(object, options) {
    super(object, options);

    if (options?.isDeserializing) {
      this._id = object?._id;
    } else {
      this._id = this.constructor.generateId();
    }
  }

  serialize(options) {
    const {_new, _type, ...fields} = super.serialize(options);
    return {...(_new && {_new}), _type, _id: this._id, ...fields};
  }

  [inspect.custom]() {
    return {id: this._id, ...super[inspect.custom]()};
  }

  get id() {
    return this._id;
  }

  static generateId() {
    return cuid();
  }

  static validateId(id) {
    if (typeof id !== 'string') {
      throw new Error(`'id' must be a string (provided: ${typeof id})`);
    }
    if (id === '') {
      throw new Error(`'id' cannot be empty`);
    }
  }

  isOfType(name) {
    return name === 'Identity' ? true : super.isOfType(name); // Optimization
  }
}