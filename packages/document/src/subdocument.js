import {IdentityModel} from '@layr/model';

import {BaseDocument} from './base-document';

export class Subdocument extends BaseDocument(IdentityModel) {
  isOfType(name) {
    return name === 'Subdocument' ? true : super.isOfType(name); // Optimization
  }
}
