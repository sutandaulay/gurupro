"use client";

import React from "react";
import { useRouter } from "next/navigation";
import ChatAdministrasi from "@/components/ai/ChatAdministrasi";

export default function ChatPage() {
  const router = useRouter();

  return (
    <div className="h-dvh sm:h-[calc(100vh-8rem)]">
      <ChatAdministrasi onBack={() => router.push('/dashboard')} />
    </div>
  );
}
