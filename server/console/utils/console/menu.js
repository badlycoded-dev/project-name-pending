const readline = require('readline');
const Display = require('./display');
const menuDefinitions = require('./menuDefinitions');

class Menu {
  constructor(logger) {
    this.logger = logger;
    this.display = new Display();
    this.currentMenu = 'main';
    this.menuStack = [];
    this.inputBuffer = '';
    this.waitingForInput = false;
    this.setupReadline();
    this.setupSignalHandlers();
    
    // Initialize data that can change
    this.data = {
      theme: 'Dark',
      notifications: true,
      autoSave: true,
      logLevel: 'Info',
      maxConnections: 100,
      timeout: 30,
      items: Array.from({length: 5}, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        created: new Date().toISOString()
      }))
    };
  }

  setupReadline() {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.setEncoding('utf8');
  }

  setupSignalHandlers() {
    process.on('SIGINT', () => {
      this.logger.log('Received SIGINT signal');
      this.cleanup();
    });

    process.on('SIGTERM', () => {
      this.logger.log('Received SIGTERM signal');
      this.cleanup();
    });
  }

  cleanup() {
    console.log('\n\nShutting down gracefully...\n');
    this.logger.log('System shutdown initiated');
    process.stdin.destroy();
    process.exit(0);
  }

  start() {
    this.logger.log('Menu system started');
    this.displayCurrentMenu();
    this.listenForInput();
  }

  displayCurrentMenu() {
    const menu = menuDefinitions[this.currentMenu];
    this.display.showMenu(menu.title, menu.options);
    this.inputBuffer = '';
    this.waitingForInput = true;
  }

  listenForInput() {
    process.stdin.on('data', (key) => {
      if (!this.waitingForInput) return;

      if (key === '\u0003') {
        this.cleanup();
        return;
      }

      // Handle backspace
      if (key === '\x7f' || key === '\b') {
        if (this.inputBuffer.length > 0) {
          this.inputBuffer = this.inputBuffer.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }

      // Ignore just Enter without input
      if ((key === '\r' || key === '\n') && this.inputBuffer.length === 0) {
        return;
      }

      // Process input on Enter
      if (key === '\r' || key === '\n') {
        console.log();
        this.handleInput(this.inputBuffer.trim());
        return;
      }

      // Add to buffer and echo
      this.inputBuffer += key;
      process.stdout.write(key);
    });
  }

  handleInput(input) {
    this.waitingForInput = false;
    
    const menu = menuDefinitions[this.currentMenu];
    const option = menu.options.find(opt => opt.key === input);

    if (!option) {
      console.log('\n✗ Invalid option. Please try again.');
      this.promptReturn(() => this.displayCurrentMenu());
      return;
    }

    this.logger.log(`User selected: ${option.label}`);

    if (option.action) {
      this.executeAction(option.action);
    } else if (option.submenu) {
      this.menuStack.push(this.currentMenu);
      this.currentMenu = option.submenu;
      this.displayCurrentMenu();
    }
  }

  executeAction(action) {
    switch(action) {
      case 'viewData':
        this.viewData();
        break;
      case 'viewSettings':
        this.viewSettings();
        break;
      case 'viewConsole':
        this.viewConsole();
        break;
      case 'createItem':
        this.createItem();
        break;
      case 'listItems':
        this.listItems();
        break;
      case 'deleteItem':
        this.deleteItem();
        break;
      case 'changeTheme':
        this.changeTheme();
        break;
      case 'toggleNotifications':
        this.toggleNotifications();
        break;
      case 'goBack':
        this.goBack();
        break;
      case 'exit':
        this.exit();
        break;
    }
  }

  viewData() {
    const data = [
      'Server Status: Running',
      'Uptime: 3 hours 24 minutes',
      'Active Connections: 42',
      'Memory Usage: 245 MB',
      'CPU Usage: 12%',
      'Database Status: Connected',
      'Cache Hit Rate: 87%',
      'Request Queue: 5 pending',
      `Theme: ${this.data.theme}`,
      `Notifications: ${this.data.notifications ? 'Enabled' : 'Disabled'}`,
      `Total Items: ${this.data.items.length}`
    ];
    
    this.display.showPagedContent('System Data', data, () => {
      this.displayCurrentMenu();
    });
  }

  viewSettings() {
    const settings = [
      `Theme: ${this.data.theme}`,
      `Notifications: ${this.data.notifications ? 'Enabled' : 'Disabled'}`,
      `Auto-save: ${this.data.autoSave ? 'On' : 'Off'}`,
      `Log Level: ${this.data.logLevel}`,
      `Max Connections: ${this.data.maxConnections}`,
      `Timeout: ${this.data.timeout}s`
    ];
    
    this.display.showPagedContent('Current Settings', settings, () => {
      this.displayCurrentMenu();
    });
  }

  viewConsole() {
    const events = this.logger.getEvents();
    this.display.showPagedContent('Console Events', events, () => {
      this.displayCurrentMenu();
    });
  }

  createItem() {
    process.stdout.write('\nEnter number of items to create: ');
    this.inputBuffer = '';
    
    const createHandler = (key) => {
      if (key === '\u0003') {
        this.cleanup();
        return;
      }

      if (key === '\x7f' || key === '\b') {
        if (this.inputBuffer.length > 0) {
          this.inputBuffer = this.inputBuffer.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }

      if (key === '\r' || key === '\n') {
        process.stdin.removeListener('data', createHandler);
        const count = parseInt(this.inputBuffer.trim());
        console.log();
        
        if (isNaN(count) || count < 1) {
          console.log('\n✗ Invalid number. Please enter a positive number.');
          this.promptReturn(() => this.displayCurrentMenu());
          return;
        }
        
        const created = [];
        for (let i = 0; i < count; i++) {
          const newItem = {
            id: this.data.items.length + 1,
            name: `Item ${this.data.items.length + 1}`,
            created: new Date().toISOString()
          };
          this.data.items.push(newItem);
          created.push(newItem.name);
        }
        
        console.log(`\n✓ Created ${count} item(s):`);
        created.forEach(name => console.log(`  - ${name}`));
        this.logger.log(`Created ${count} item(s)`);
        this.promptReturn(() => this.displayCurrentMenu());
        return;
      }

      this.inputBuffer += key;
      process.stdout.write(key);
    };

    process.stdin.on('data', createHandler);
  }

  listItems() {
    const items = this.data.items.map(item => 
      `[${item.id}] ${item.name} - Created: ${item.created}`
    );
    
    if (items.length === 0) {
      items.push('No items found.');
    }
    
    this.display.showPagedContent('All Items', items, () => {
      this.displayCurrentMenu();
    });
  }

  deleteItem() {
    if (this.data.items.length === 0) {
      console.log('\n✗ No items to delete.');
      this.promptReturn(() => this.displayCurrentMenu());
      return;
    }

    console.log('\nAvailable items:');
    this.data.items.forEach(item => {
      console.log(`  ${item.id}. ${item.name}`);
    });
    
    console.log('\nEnter item IDs to delete (comma-separated, e.g., 1,3,5):');
    process.stdout.write('IDs: ');
    this.inputBuffer = '';
    
    const deleteHandler = (key) => {
      if (key === '\u0003') {
        this.cleanup();
        return;
      }

      if (key === '\x7f' || key === '\b') {
        if (this.inputBuffer.length > 0) {
          this.inputBuffer = this.inputBuffer.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }

      if (key === '\r' || key === '\n') {
        process.stdin.removeListener('data', deleteHandler);
        const input = this.inputBuffer.trim();
        console.log();
        
        if (!input) {
          console.log('\n✗ No IDs provided.');
          this.promptReturn(() => this.displayCurrentMenu());
          return;
        }
        
        const ids = input.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        
        if (ids.length === 0) {
          console.log('\n✗ No valid IDs provided.');
          this.promptReturn(() => this.displayCurrentMenu());
          return;
        }
        
        const deleted = [];
        const notFound = [];
        
        ids.forEach(id => {
          const index = this.data.items.findIndex(item => item.id === id);
          if (index !== -1) {
            deleted.push(this.data.items.splice(index, 1)[0]);
          } else {
            notFound.push(id);
          }
        });
        
        if (deleted.length > 0) {
          console.log(`\n✓ Deleted ${deleted.length} item(s):`);
          deleted.forEach(item => console.log(`  - ${item.name}`));
          this.logger.log(`Deleted ${deleted.length} item(s)`);
        }
        
        if (notFound.length > 0) {
          console.log(`\n✗ Items not found: ${notFound.join(', ')}`);
        }
        
        this.promptReturn(() => this.displayCurrentMenu());
        return;
      }

      this.inputBuffer += key;
      process.stdout.write(key);
    };

    process.stdin.on('data', deleteHandler);
  }

  changeTheme() {
    this.data.theme = this.data.theme === 'Dark' ? 'Light' : 'Dark';
    console.log(`\n✓ Theme changed to ${this.data.theme}`);
    this.logger.log(`Theme changed to ${this.data.theme}`);
    this.promptReturn(() => this.displayCurrentMenu());
  }

  toggleNotifications() {
    this.data.notifications = !this.data.notifications;
    console.log(`\n✓ Notifications ${this.data.notifications ? 'enabled' : 'disabled'}`);
    this.logger.log(`Notifications ${this.data.notifications ? 'enabled' : 'disabled'}`);
    this.promptReturn(() => this.displayCurrentMenu());
  }

  goBack() {
    if (this.menuStack.length > 0) {
      this.currentMenu = this.menuStack.pop();
      this.logger.log('Navigated back to previous menu');
      this.displayCurrentMenu();
    }
  }

  exit() {
    console.log('\n👋 Goodbye!\n');
    this.logger.log('User exited application');
    this.cleanup();
  }

  promptReturn(callback) {
    console.log('\n[Press Enter to continue]');
    this.inputBuffer = '';
    
    const returnHandler = (key) => {
      if (key === '\u0003') {
        this.cleanup();
        return;
      }

      if (key === '\r' || key === '\n') {
        process.stdin.removeListener('data', returnHandler);
        callback();
      }
    };

    process.stdin.on('data', returnHandler);
  }
}

module.exports = Menu;