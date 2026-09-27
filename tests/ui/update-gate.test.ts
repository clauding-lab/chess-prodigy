import { expect, it, vi } from "vitest";
import { registerUpdateView, prepareAppUpdate } from "../../src/ui/update-gate";

it("blocks every update entry point while any mounted view has active play", async () => {
  const save = vi.fn(() => true);
  const removeA = registerUpdateView(() => ({ active: true, save }));
  const removeB = registerUpdateView(() => ({ active: false, save }));
  try {
    await expect(prepareAppUpdate(async () => true)).rejects.toThrow("game");
    expect(save).not.toHaveBeenCalled();
  } finally {
    removeA();
    removeB();
  }
});

it("requires all saves, pending-account readiness and a sole browser client", async () => {
  let ready = false;
  const remove = registerUpdateView(() => ({
    active: false,
    save: () => true,
    ready: async () => ready,
  }));
  try {
    await expect(prepareAppUpdate(async () => true)).rejects.toThrow("sync");
    ready = true;
    await expect(prepareAppUpdate(async () => false)).rejects.toThrow("other");
    await expect(prepareAppUpdate(async () => true)).resolves.toBeUndefined();
  } finally {
    remove();
  }
});

it("rechecks play after asynchronous save preparation", async () => {
  let active = false;
  const remove = registerUpdateView(() => ({ active, save: () => true }));
  try {
    await expect(
      prepareAppUpdate(async () => {
        active = true;
        return true;
      }),
    ).rejects.toThrow("game");
  } finally {
    remove();
  }
});

it("cancels preparation if the mounted account or view is replaced during the client check", async () => {
  const remove = registerUpdateView(() => ({ active: false, save: () => true }));
  let release!: (safe: boolean) => void;
  const preparation = prepareAppUpdate(
    () =>
      new Promise<boolean>((resolve) => {
        release = resolve;
      }),
  );
  remove();
  const replacementSave = vi.fn(() => true);
  const removeReplacement = registerUpdateView(() => ({ active: false, save: replacementSave }));
  release(true);
  try {
    await expect(preparation).rejects.toThrow("changed");
    expect(replacementSave).not.toHaveBeenCalled();
  } finally {
    removeReplacement();
  }
});
