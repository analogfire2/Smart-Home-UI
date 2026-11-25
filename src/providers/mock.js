'use strict';
const { Provider } = require('./base');
/** Fake devices for UI development and tests: {"type":"mock"} */
class MockProvider extends Provider {
  constructor(cfg) {
    super(cfg);
    const rooms = ['Living Room', 'Kitchen', 'Bedroom', 'Garage', 'Office', null];
    this.devs = Array.from({ length: 24 }, (_, i) => ({
      id: `${this.id}:${i}`, provider: this.id,
      name: ['Ceiling', 'Lamp', 'Strip', 'Sconce', 'Fan', 'Plug'][i % 6] + ' ' + (i + 1),
      room: rooms[i % rooms.length], type: i % 6 === 5 ? 'outlet' : i % 6 === 4 ? 'switch' : 'light',
      on: i % 3 === 0, online: true,
    }));
  }
  async list() { return this.devs; }
  async setPower(nid, on) { const d = this.devs.find(d => d.id === `${this.id}:${nid}`); if (d) d.on = on; }
}
module.exports = { MockProvider };
