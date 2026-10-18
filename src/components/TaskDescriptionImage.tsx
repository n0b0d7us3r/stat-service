import { useEffect, useState } from 'react';
import { resolveApiResourceUrl } from '../api/client';

interface TaskDescriptionImageProps {
  url: string;
  alt: string;
}

export function TaskDescriptionImage({ url, alt }: TaskDescriptionImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const resolvedUrl = resolveApiResourceUrl(url);

    void fetch(resolvedUrl, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load image');
        }
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setBlobUrl(null);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  if (failed) {
    return (
      <p className="task-description-image-error" role="status">
        Не удалось загрузить изображение
      </p>
    );
  }

  if (!blobUrl) {
    return (
      <p className="task-description-image-loading" aria-hidden="true">
        Загрузка изображения…
      </p>
    );
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      className="task-description-image"
      loading="lazy"
    />
  );
}
