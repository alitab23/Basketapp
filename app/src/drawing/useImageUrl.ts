import { useEffect, useState } from 'react';
import { db } from '../db/schema';
import { getImageBlob } from '../db/repository';
import type { ImageAttachment } from '../types/model';

/** An object URL for a stored image, released again when no longer shown. */
export function useImageUrl(image: ImageAttachment): string | undefined {
  const [url, setUrl] = useState<string | undefined>(image.url);
  useEffect(() => {
    if (!image.localBlobId) return setUrl(image.url);
    let objectUrl: string | undefined;
    let cancelled = false;
    void getImageBlob(db, image.localBlobId).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.localBlobId, image.url]);
  return url;
}
