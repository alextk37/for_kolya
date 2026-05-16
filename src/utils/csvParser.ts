import type { CsvData } from '../types';
import Papa from 'papaparse';

export function parseCsvFile(file: File): Promise<CsvData> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          const data = results.data;
          const headers = data[0];
          const rows = data.slice(1).filter((row) => row.some((cell) => cell.trim() !== ''));
          resolve({ headers, rows });
        } else {
          reject(new Error('CSV файл пуст'));
        }
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
}
