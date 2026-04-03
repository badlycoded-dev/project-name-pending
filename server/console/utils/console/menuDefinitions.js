const menuDefinitions = {
  main: {
    title: 'Main Menu',
    options: [
      { key: '1', label: 'Data Management', submenu: 'dataMenu' },
      { key: '2', label: 'Settings', submenu: 'settingsMenu' },
      { key: '3', label: 'View Data', action: 'viewData' },
      { key: '4', label: 'Console Events', action: 'viewConsole' },
      { key: '0', label: 'Exit', action: 'exit' }
    ]
  },
  dataMenu: {
    title: 'Data Management',
    options: [
      { key: '1', label: 'Create Item', action: 'createItem' },
      { key: '2', label: 'List All Items', action: 'listItems' },
      { key: '3', label: 'Delete Item', action: 'deleteItem' },
      { key: '0', label: 'Back to Main Menu', action: 'goBack' }
    ]
  },
  settingsMenu: {
    title: 'Settings',
    options: [
      { key: '1', label: 'View Current Settings', action: 'viewSettings' },
      { key: '2', label: 'Change Theme', action: 'changeTheme' },
      { key: '3', label: 'Toggle Notifications', action: 'toggleNotifications' },
      { key: '0', label: 'Back to Main Menu', action: 'goBack' }
    ]
  },
  myCustomMenu: {
    title: 'My Custom Menu',
    options: [
      { key: '1', label: 'Custom Action', action: 'myCustomAction' },
      { key: '2', label: 'Go to Submenu', submenu: 'anotherMenu' },
      { key: '0', label: 'Back to Main Menu', action: 'goBack' }
    ]
  }
};

module.exports = menuDefinitions;