'use client';

import Image from 'next/image';
import { useState } from 'react';

export default function ProfileAvatar() {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="relative w-32 h-32 mx-auto mb-6">
      <div className="w-full h-full rounded-full overflow-hidden bg-[#A8D8EA] border-4 border-white shadow-lg">
        {!imageError ? (
          <Image
            src="/default-avatar.svg"
            alt="Profile"
            width={128}
            height={128}
            className="object-cover"
            onError={() => setImageError(true)}
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#A8D8EA] text-[#4A90A0]">
            <svg
              className="w-16 h-16"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}