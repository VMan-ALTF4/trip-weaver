export function isTravelDateNotPassed(value: string | null | undefined): boolean {
  const travelDate = value?.slice(0, 10) ?? "";
  if (!travelDate) return true;

  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((datePart) => datePart.type === type)?.value ?? "";
  const todayInVietnam = `${part("year")}-${part("month")}-${part("day")}`;

  return travelDate >= todayInVietnam;
}
