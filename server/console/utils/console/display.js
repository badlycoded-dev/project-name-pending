class Display {
  constructor() {
    this.pageSize = 50;
  }

  showMenu(title, options) {
    console.clear();
    console.log('\n=================================');
    console.log(`        ${title.toUpperCase()}`);
    console.log('=================================');
    
    options.forEach(opt => {
      console.log(`${opt.key}. ${opt.label}`);
    });
    
    console.log('=================================');
    process.stdout.write('\nEnter your choice: ');
  }

  showPagedContent(title, lines, callback) {
    if (lines.length <= this.pageSize) {
      this.showSinglePage(title, lines, callback);
    } else {
      this.showMultiplePages(title, lines, callback);
    }
  }

  showSinglePage(title, lines, callback) {
    console.clear();
    console.log('\n=================================');
    console.log(`        ${title.toUpperCase()}`);
    console.log('=================================\n');
    
    lines.forEach(line => console.log(line));
    
    console.log('\n=================================');
    console.log('[Press Enter to return to menu]');
    
    const returnHandler = (key) => {
      if (key === '\u0003') {
        process.exit(0);
        return;
      }

      if (key === '\r' || key === '\n') {
        process.stdin.removeListener('data', returnHandler);
        callback();
      }
    };

    process.stdin.on('data', returnHandler);
  }

  showMultiplePages(title, lines, callback) {
    const totalPages = Math.ceil(lines.length / this.pageSize);
    let currentPage = 0;
    let inputBuffer = '';

    const showPage = () => {
      console.clear();
      console.log('\n=================================');
      console.log(`        ${title.toUpperCase()}`);
      console.log(`        Page ${currentPage + 1} of ${totalPages}`);
      console.log('=================================\n');

      const start = currentPage * this.pageSize;
      const end = Math.min(start + this.pageSize, lines.length);
      
      for (let i = start; i < end; i++) {
        console.log(lines[i]);
      }

      console.log('\n=================================');
      
      const navOptions = [];
      if (currentPage > 0) {
        navOptions.push('[P] Previous Page');
      }
      if (currentPage < totalPages - 1) {
        navOptions.push('[N] Next Page');
      }
      navOptions.push('[Q] Return to Menu');
      
      console.log(navOptions.join(' | '));
      process.stdout.write('\nYour choice: ');
      inputBuffer = '';
    };

    showPage();

    const handler = (key) => {
      if (key === '\u0003') {
        process.exit(0);
        return;
      }

      // Handle backspace
      if (key === '\x7f' || key === '\b') {
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }

      // Ignore just Enter without input
      if ((key === '\r' || key === '\n') && inputBuffer.length === 0) {
        return;
      }

      // Process on Enter
      if (key === '\r' || key === '\n') {
        const input = inputBuffer.toLowerCase().trim();
        console.log();
        
        if (input === 'p' && currentPage > 0) {
          currentPage--;
          showPage();
        } else if (input === 'n' && currentPage < totalPages - 1) {
          currentPage++;
          showPage();
        } else if (input === 'q') {
          process.stdin.removeListener('data', handler);
          callback();
        } else {
          console.log('Invalid choice. Please try again.');
          process.stdout.write('Your choice: ');
          inputBuffer = '';
        }
        return;
      }

      // Add to buffer and echo
      inputBuffer += key;
      process.stdout.write(key);
    };

    process.stdin.on('data', handler);
  }
}

module.exports = Display;