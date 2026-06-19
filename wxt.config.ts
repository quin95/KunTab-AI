import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'KunTab',
    description: '一个基于 Chrome 浏览器的新标签页书签管理插件。',
    version: '1.5.0',
    permissions: ['bookmarks', 'storage', 'favicon', 'activeTab'],
    host_permissions: ['https://*/*'],
    chrome_url_overrides: {
      newtab: 'newtab.html',
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png',
    },
    action: {
      default_title: 'KunTab',
    },
    commands: {
      _execute_action: {
        suggested_key: {
          default: 'Alt+Shift+S',
        },
        description: '打开快速收藏弹窗',
      },
    },
  },
});
