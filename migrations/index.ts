import * as migration_20260705_090252_add_institutions from './20260705_090252_add_institutions';

export const migrations = [
  {
    up: migration_20260705_090252_add_institutions.up,
    down: migration_20260705_090252_add_institutions.down,
    name: '20260705_090252_add_institutions'
  },
];
