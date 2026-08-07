import { useEffect, useState } from "react";
import type { PersistentData } from "../domain/models";
import type { AppStorage } from "../storage/storage";

export const usePersistentData = (storage: AppStorage) => {
  const [data, setData] = useState<PersistentData>(() => storage.load());

  useEffect(() => {
    storage.save(data);
  }, [data, storage]);

  return [data, setData] as const;
};
