"use client";

// =============================================================================
// IndexedDB mínimo
//
// Sem biblioteca: são três operações (ler tudo, gravar, apagar) sobre um único
// armazém. Uma dependência aqui custaria mais do que resolve.
//
// Tudo é tolerante a falha: navegação anônima, cota cheia ou navegador antigo
// devolvem null em vez de quebrar o treino. A fila é uma rede de proteção —
// ela nunca pode virar o motivo de a tela parar de funcionar.
// =============================================================================

const DB_NAME = "fitg";
const DB_VERSION = 1;
const STORE = "fila";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  dbPromise ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

async function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await open();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export const idb = {
  all: <T>() => tx<T[]>("readonly", (s) => s.getAll() as IDBRequest<T[]>),
  put: <T extends { id: string }>(value: T) =>
    tx("readwrite", (s) => s.put(value) as IDBRequest<IDBValidKey>),
  remove: (id: string) => tx("readwrite", (s) => s.delete(id) as IDBRequest<undefined>),
};
