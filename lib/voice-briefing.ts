export function getGreetingByTime(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 4 && hour < 11) return "Pagi";
  if (hour >= 11 && hour < 15) return "Siang";
  if (hour >= 15 && hour < 18) return "Sore";
  return "Malam";
}

export function composeBriefingText({
  gender,
  fullName,
  className,
  subjectName,
  startTime,
  endTime,
}: {
  gender?: string | null;
  fullName: string;
  className: string;
  subjectName: string;
  startTime: string;
  endTime: string;
}): string {
  const greeting = getGreetingByTime();
  const sapaan = gender === "P" ? "Ibu" : "Bapak";
  return `Selamat ${greeting}, ${sapaan} ${fullName}, 10 menit lagi Anda akan mulai mengajar pada kelas ${className} mata pelajaran ${subjectName}, mulai pukul ${startTime} sampai pukul ${endTime}. Semangat Mengajar Pahlawan Masa Depan Bangsa!`;
}
