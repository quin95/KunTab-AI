import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'KunTab',
    description: '一个基于 Chrome 浏览器的新标签页书签管理插件。',
    version: '1.0.0',
    permissions: ['bookmarks', 'storage'],
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
  },
});
