import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ensureUserTaskImagesDir, userTaskImagesDir } from '../config.js';
import { DbError } from './projectsService.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

function sanitizeFilename(filename: string): string | null {
  const base = path.basename(filename);
  if (!/^[a-zA-Z0-9-]+\.(png|jpe?g|gif|webp)$/i.test(base)) {
    return null;
  }
  return base;
}

export function saveTaskDescriptionImage(
  userId: number,
  contentType: string,
  buffer: Buffer,
): { url: string; filename: string } {
  const normalizedType = contentType.trim().toLowerCase();
  const extension = ALLOWED_TYPES[normalizedType];
  if (!extension) {
    throw new DbError('Поддерживаются только PNG, JPEG, GIF и WebP');
  }

  if (buffer.length === 0) {
    throw new DbError('Пустой файл изображения');
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new DbError('Изображение слишком большое (максимум 5 МБ)');
  }

  const dir = ensureUserTaskImagesDir(userId);
  const filename = `${randomUUID()}${extension}`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);

  return {
    filename,
    url: `/api/tasks/description-images/${filename}`,
  };
}

export function readTaskDescriptionImage(userId: number, filenameRaw: string): {
  buffer: Buffer;
  contentType: string;
} | null {
  const filename = sanitizeFilename(filenameRaw);
  if (!filename) {
    return null;
  }

  const filePath = path.join(userTaskImagesDir(userId), filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = ext === '.png'
    ? 'image/png'
    : ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : ext === '.gif'
        ? 'image/gif'
        : ext === '.webp'
          ? 'image/webp'
          : 'application/octet-stream';

  return {
    buffer: fs.readFileSync(filePath),
    contentType,
  };
}
