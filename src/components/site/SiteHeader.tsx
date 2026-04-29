"use client";

import Image from "next/image";
import Link from "next/link";

export function SiteHeader({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-[#f6f6f4]/95 backdrop-blur-[12px]">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <Link href="/" className="group flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 bg-transparent transition-transform duration-300 group-hover:scale-[1.02]">
            <Image
              src="/debate-room-welcome-mark.png"
              alt=""
              width={855}
              height={880}
              unoptimized
              className="block size-full object-contain"
            />
          </div>
          <span className="select-none font-sans text-lg font-black uppercase tracking-tight text-[#101318] transition-colors group-hover:text-[#ff4d00]">
            DebateRoom
          </span>
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 sm:text-right">{title}</p>
      </div>
    </header>
  );
}
