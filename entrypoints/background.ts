export default defineBackground(() => {
  const ext = ((globalThis as any).browser ?? (globalThis as any).chrome) as any;
  ext.runtime.onInstalled.addListener(() => {
    console.log('KunTab installed:', ext.runtime.id);
  });
});
