/**
 * Google Books API를 이용해 도서의 실제 페이지 수(pageCount)를 가져오는 유틸리티
 * @param {string} title - 도서 제목
 * @param {string} isbn - 도서 ISBN (선택)
 * @returns {Promise<number|null>} 페이지 수 또는 null
 */
export async function fetchGooglePageCount(title, isbn = '') {
  try {
    let cleanIsbn = (isbn || '').replace(/[^0-9X]/gi, '');
    let query = '';
    
    if (cleanIsbn.length >= 10) {
      query = `isbn:${cleanIsbn}`;
    } else if (title) {
      // 특수문자 제거 후 깨끗한 제목 키워드 추출
      const cleanTitle = title.split('(')[0].split('-')[0].trim();
      query = `intitle:${encodeURIComponent(cleanTitle)}`;
    } else {
      return null;
    }

    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=3`);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const pages = item.volumeInfo?.pageCount;
        if (pages && typeof pages === 'number' && pages > 0) {
          return pages;
        }
      }
    }
  } catch (error) {
    console.warn('Google Books API 페이지 수 연동 실패:', error);
  }

  return null;
}
