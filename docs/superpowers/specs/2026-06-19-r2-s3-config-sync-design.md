# R2/S3 Config Sync Design

## Goal

KunTab should let users manually sync the extension's own settings and favorite-site configuration across multiple computers through Cloudflare R2 or another S3-compatible object store.

Chrome bookmark data is out of scope because users can rely on Chrome account sync for bookmarks.

## Sync Scope

The cloud sync payload includes:

- KunTab application settings, excluding S3/R2 credentials.
- Favorite sites as URL-based records with titles.
- Version and device metadata needed for multi-computer conflict detection.

The cloud sync payload does not include:

- Chrome bookmark tree data.
- Recently opened records.
- R2/S3 endpoint credentials or secret keys.
- AI chat history or transient UI state.

Favorite sites are restored by matching each synced URL against the current browser bookmark set. If a URL does not exist locally, KunTab skips that favorite and reports how many favorites could not be restored.

## S3/R2 Settings

Add a "Cloud Sync" settings card with the required fields only:

- Endpoint URL.
- Bucket.
- Access Key ID.
- Secret Access Key.
- Key prefix.

The object key is derived from the prefix:

```text
<keyPrefix>/kuntab-sync.json
```

The key prefix is required so users can isolate KunTab data inside a shared bucket. Region is not exposed in the UI; the implementation can use `auto` for Cloudflare R2 and S3-compatible signing unless a future provider requires otherwise.

Credentials stay local in extension storage and are never written into the cloud sync payload.

## Version Model

Each local installation has persistent sync metadata:

- `deviceId`: generated once per installation.
- `localVersion`: monotonically increases whenever synced local data changes.
- `localUpdatedAt`: timestamp of the latest synced local-data change.
- `lastSyncedLocalVersion`: local version that was last reconciled with the cloud.
- `lastRemoteVersion`: remote version last seen by this device.

The remote object stores:

- `app: "kuntab"`.
- `schemaVersion`.
- `remoteVersion`: monotonically increases on each successful upload.
- `updatedAt`.
- `updatedByDeviceId`.
- `data.settings`.
- `data.favoriteSites`.

Only changes to synced local data should bump `localVersion`. Editing S3/R2 credentials should not bump it.

## Manual Sync Behavior

The Backup page gets one cloud action: "Sync Now".

When clicked, KunTab:

1. Validates the S3/R2 settings.
2. Reads the remote sync object, if it exists.
3. Compares local and remote versions using local sync metadata.
4. Chooses one of these outcomes:

| Local state | Remote state | Action |
| --- | --- | --- |
| Remote missing | Any local state | Upload local data and initialize remote state. |
| Local changed since last sync | Remote unchanged since last sync | Upload local data; increment remote version. |
| Local unchanged since last sync | Remote changed since last sync | Download remote data and apply it locally. |
| Local unchanged since last sync | Remote unchanged since last sync | Report "already up to date". |
| Local changed since last sync | Remote changed since last sync | Show a conflict dialog. |

## Conflict Resolution

If both local and remote have changed since this device's last successful sync, KunTab must not auto-overwrite either side.

The conflict dialog offers:

- Use Remote: apply the remote settings and favorite-site list locally, then mark the device as synced to the current remote version.
- Use Local: upload the current local settings and favorite-site list, increment the remote version, then mark the device as synced to the new remote version.
- Cancel: leave both sides unchanged.

After either "Use Remote" or "Use Local", the selected side becomes the shared latest state and the local sync metadata is updated so the next click reports "already up to date".

## Import And Export Relationship

Existing local JSON/HTML backup behavior remains unchanged.

Cloud sync uses a smaller sync-specific JSON format rather than the full `BackupData` format because the full backup includes Chrome bookmark tree data, which should not be synced through R2/S3.

## Error Handling

KunTab should show clear toasts for:

- Missing S3/R2 settings.
- Remote object not found and initialized.
- Upload success.
- Download success.
- Already up to date.
- Conflict detected.
- Signature, network, CORS, permission, or malformed JSON failures.
- Favorite URLs skipped because matching Chrome bookmarks are missing locally.

Failed sync operations must not update local sync metadata.

## Implementation Notes

Use browser-native `fetch` and AWS Signature Version 4 signing through Web Crypto instead of adding an AWS SDK dependency.

The first implementation targets path-style requests, which are appropriate for Cloudflare R2 and many S3-compatible services:

```text
<endpoint>/<bucket>/<key>
```

If another S3-compatible provider requires virtual-host style URLs later, that can be added as a separate provider option.

## Testing

Add focused unit coverage for:

- Sync direction decisions.
- Conflict detection.
- Remote payload validation.
- URL-based favorite restoration.
- S3 object key normalization.

Run the TypeScript compiler after implementation.
