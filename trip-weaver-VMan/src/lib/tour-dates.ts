export function getTodayInVietnam(): string {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((datePart) => datePart.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isTravelDateNotPassed(value: string | null | undefined): boolean {
  const travelDate = value?.slice(0, 10) ?? "";
  if (!travelDate) return true;
  return travelDate >= getTodayInVietnam();
}

export function hasUpcomingTravelDate(values: string[]): boolean {
  return values.some((value) => isTravelDateNotPassed(value));
}
