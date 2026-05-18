import type { CsvData } from '../types';
import Papa from 'papaparse';

/**
 * Декодирует ArrayBuffer из Windows-1251 в UTF-8 строку.
 */
function decodeWindows1251(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('windows-1251');
  return decoder.decode(bytes);
}

/**
 * Определяет, является ли строка валидным UTF-8.
 */
function isValidUtf8(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  let i = 0;
  while (i < bytes.length) {
    if (bytes[i] < 0x80) {
      i++;
    } else if (bytes[i] < 0xC0) {
      return false; // невалидный байт
    } else if (bytes[i] < 0xE0) {
      if (i + 1 >= bytes.length || (bytes[i + 1] & 0xC0) !== 0x80) return false;
      i += 2;
    } else if (bytes[i] < 0xF0) {
      if (i + 2 >= bytes.length || (bytes[i + 1] & 0xC0) !== 0x80 || (bytes[i + 2] & 0xC0) !== 0x80) return false;
      i += 3;
    } else {
      if (i + 3 >= bytes.length || (bytes[i + 1] & 0xC0) !== 0x80 || (bytes[i + 2] & 0xC0) !== 0x80 || (bytes[i + 3] & 0xC0) !== 0x80) return false;
      i += 4;
    }
  }
  return true;
}

export function parseCsvFile(file: File): Promise<CsvData> {
  return new Promise((resolve, reject) => {
    // Сначала читаем файл как ArrayBuffer для детекта кодировки
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;

      // Определяем кодировку: если не UTF-8, пробуем Windows-1251
      let text: string;
      if (isValidUtf8(buffer)) {
        text = new TextDecoder('utf-8').decode(buffer);
      } else {
        console.warn('CSV не в UTF-8, пробуем Windows-1251');
        text = decodeWindows1251(buffer);
      }

      Papa.parse<string[]>(text, {
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            const data = results.data;
            const headers = data[0];
            const headerCount = headers.length;
            const rows = data.slice(1).filter((row) => row.some((cell) => cell.trim() !== ''));

            // Проверка на разную длину строк
            const mismatchedRows: number[] = [];
            rows.forEach((row, idx) => {
              if (row.length !== headerCount) {
                mismatchedRows.push(idx + 2); // +2 потому что 1-based + header
              }
            });

            if (mismatchedRows.length > 0) {
              console.warn(
                `CSV: ${mismatchedRows.length} строк имеют разное количество колонок. ` +
                `Ожидалось ${headerCount}, проблемы в строках: ${mismatchedRows.slice(0, 10).join(', ')}${mismatchedRows.length > 10 ? '...' : ''}`
              );
            }

            resolve({ headers, rows });
          } else {
            reject(new Error('CSV файл пуст'));
          }
        },
        error: (error: Error) => {
          reject(error);
        },
      });
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать CSV файл'));
    reader.readAsArrayBuffer(file);
  });
}
