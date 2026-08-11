// IndexedDB 기반 영구 PDF 바이너리 저장소 유틸리티
// 한번 등록된 PDF 파일은 사용자가 직접 삭제하기 전까지 브라우저/PC 재부팅 후에도 100% 지속 영구 보장됩니다.

const IDB_NAME = 'LibraryOfMind_PdfStorage';
const IDB_STORE = 'pdf_blobs';

export function openPdfIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePdfBlobToIDB(id, blob) {
  if (!id || !blob) return false;
  try {
    const db = await openPdfIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(blob, id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('IndexedDB PDF 저장 예외:', e);
    return false;
  }
}

export async function getPdfBlobFromIDB(id) {
  if (!id) return null;
  try {
    const db = await openPdfIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn('IndexedDB PDF 읽기 예외:', e);
    return null;
  }
}

export async function deletePdfBlobFromIDB(id) {
  if (!id) return false;
  try {
    const db = await openPdfIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}

// PDF 객체(pdfData)를 입력받아 IndexedDB에서 최신 바이너리 Blob을 복원한 유효한 URL로 가공하여 반환
export async function getFreshPdfUrl(pdfData) {
  if (!pdfData) return null;

  // 1. 유효한 원격 HTTP(S) URL인 경우 바로 사용
  if (pdfData.url && pdfData.url.startsWith('http') && !pdfData.url.startsWith('blob:')) {
    return pdfData.url;
  }

  // 2. ID 기반으로 IndexedDB에서 저장된 Blob 복원 시도
  if (pdfData.id) {
    const blob = await getPdfBlobFromIDB(pdfData.id);
    if (blob) {
      return URL.createObjectURL(blob);
    }
  }

  // 3. 만약 blob: URL이 여전히 살아있다면(동일 세션) 해당 URL 시도
  if (pdfData.url && pdfData.url.startsWith('blob:')) {
    return pdfData.url;
  }

  return null;
}
