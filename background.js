chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'toggle-dark') return;
  const { enabled = true } = await chrome.storage.sync.get('enabled');
  await chrome.storage.sync.set({ enabled: !enabled });
});
