/* global Application */

function run(argv) {
  const urlToOpen = argv[0]
  const programName = argv[1] ?? 'Google Chrome'

  const app = Application(programName)
  app.activate()

  if (app.windows.length === 0) {
    app.Window().make()
  }

  const found = lookupTab(urlToOpen, app)
  if (found) {
    found.window.activeTabIndex = found.index
    found.tab.reload()
    app.activate()
    return
  }

  const empty = lookupTab('chrome://newtab/', app)
  if (empty) {
    empty.window.activeTabIndex = empty.index
    empty.tab.url = urlToOpen
    app.activate()
    return
  }

  const win = app.windows[0]
  win.tabs.push(app.Tab({ url: urlToOpen }))
  app.activate()
}

function lookupTab(url, app) {
  for (const win of app.windows()) {
    const tabs = win.tabs()
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i]
      if (tab.url().includes(url)) {
        return { tab, index: i + 1, window: win }
      }
    }
  }
}
