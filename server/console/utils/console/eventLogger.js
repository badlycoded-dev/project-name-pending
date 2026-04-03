class EventLogger {
  constructor() {
    this.events = [];
    this.maxEvents = 1000;
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}`;
    
    this.events.push(entry);
    
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  getEvents() {
    return [...this.events];
  }

  clear() {
    this.events = [];
    this.log('Event log cleared');
  }
}

module.exports = EventLogger;