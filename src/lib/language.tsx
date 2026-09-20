import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "en" | "vi";
const STORAGE_KEY = "tat-language";

const vi: Record<string, string> = {
  "Tours": "Tour",
  "Destinations": "Điểm đến",
  "Attractions": "Điểm tham quan",
  "Admin": "Quản trị",
  "My Bookings": "Đặt chỗ của tôi",
  "My bookings": "Đặt chỗ của tôi",
  "Admin dashboard": "Trang quản trị",
  "Log in": "Đăng nhập",
  "Register": "Đăng ký",
  "Register with Email": "Đăng ký bằng email",
  "Sign out": "Đăng xuất",
  "Signed out": "Đã đăng xuất",
  "Signed in": "Đã đăng nhập",
  "Signed in as": "Đã đăng nhập với tên",
  "Menu": "Menu",
  "Open menu": "Mở menu",
  "TAT Booking": "TAT Booking",
  "Transport + attraction combo e-tickets, one booking.": "Vé điện tử kết hợp di chuyển và tham quan trong một lần đặt.",
  "Checkout": "Thanh toán",
  "Transport + attraction, one QR code": "Di chuyển + tham quan, chỉ một mã QR",
  "Explore Destinations, Book Transport &": "Khám phá điểm đến, đặt phương tiện &",
  "Attraction Tickets": "Vé tham quan",
  "in One Unified Trip": "trong cùng một hành trình",
  "Pick your seat, choose a pickup point along the route and get every venue entry bundled into a single combo e-ticket.": "Chọn chỗ ngồi, điểm đón trên tuyến và nhận toàn bộ vé vào cửa trong một vé điện tử combo duy nhất.",
  "Destination / Tour location": "Điểm đến / Địa điểm tour",
  "Transport type": "Loại phương tiện",
  "Travel dates": "Ngày khởi hành",
  "Passengers & tickets": "Hành khách & vé",
  "Bus / Coach": "Xe khách",
  "Coach / Bus": "Xe khách",
  "Train": "Tàu hỏa",
  "Private Car": "Xe riêng",
  "Free cancellation up to 24h before departure on most combos.": "Hầu hết combo được hủy miễn phí trước giờ khởi hành 24 giờ.",
  "Search Tours & Combos": "Tìm tour & combo",
  "Search tours and combos": "Tìm tour và combo",
  "Featured tours & popular combos": "Tour nổi bật & combo phổ biến",
  "Hand-picked routes where transport and venue entry come bundled.": "Các hành trình chọn lọc đã bao gồm phương tiện và vé vào cửa.",
  "View all": "Xem tất cả",
  "Why travellers book with TAT": "Vì sao du khách chọn TAT",
  "Combo e-tickets": "Vé điện tử combo",
  "One QR code covers your coach boarding and every attraction entry on the itinerary.": "Một mã QR dùng để lên xe và vào tất cả điểm tham quan trong lịch trình.",
  "Interactive route maps": "Bản đồ hành trình tương tác",
  "See pickup points, stopovers and attraction stops before you commit.": "Xem trước điểm đón, điểm dừng và điểm tham quan trước khi đặt.",
  "Real-time seat locking": "Giữ chỗ theo thời gian thực",
  "Your exact seat is held for 10 minutes while you complete checkout.": "Chỗ ngồi được giữ trong 10 phút để bạn hoàn tất thanh toán.",
  "100% transparent costs": "Chi phí minh bạch 100%",
  "Itemised pricing with taxes and pickup fees shown before payment.": "Giá chi tiết, thuế và phí đón được hiển thị trước khi thanh toán.",
  "Plan the whole trip in under two minutes": "Lên kế hoạch cả chuyến đi chưa đầy hai phút",
  "Choose a route, lock your seat, add venue tickets and pay with VNPay, Momo, card or bank QR.": "Chọn hành trình, giữ chỗ, thêm vé tham quan và thanh toán qua VNPay, Momo, thẻ hoặc QR ngân hàng.",
  "Browse routes": "Xem hành trình",
  "See a sample e-ticket": "Xem vé điện tử mẫu",
  "Tours & route maps": "Tour & bản đồ hành trình",
  "Price range": "Khoảng giá",
  "Maximum price": "Giá tối đa",
  "Attraction categories": "Danh mục điểm tham quan",
  "Pickup preference": "Điểm đón mong muốn",
  "Filters": "Bộ lọc",
  "Map view": "Xem bản đồ",
  "List": "Danh sách",
  "No tours match these filters yet. Try widening the price range.": "Chưa có tour phù hợp. Hãy thử tăng khoảng giá.",
  "Nature": "Thiên nhiên", "Culture": "Văn hóa", "Beach": "Biển", "Adventure": "Phiêu lưu", "Heritage": "Di sản", "Food": "Ẩm thực",
  "City Center": "Trung tâm thành phố", "Central Station": "Ga trung tâm", "North Terminal": "Bến phía Bắc", "Beach Resorts": "Khu nghỉ dưỡng biển", "Airport Road": "Đường sân bay",
  "Combo E-Ticket Included": "Đã gồm vé điện tử combo",
  "Combo E-Ticket": "Vé điện tử combo",
  "Back to tours": "Quay lại danh sách tour",
  "Itinerary timeline": "Lịch trình chi tiết",
  "Included": "Đã bao gồm",
  "Not included": "Không bao gồm",
  "per person": "mỗi người",
  "Date": "Ngày", "Seats": "Chỗ ngồi", "Pickup": "Điểm đón", "Add-ons": "Dịch vụ thêm",
  "Travel date": "Ngày khởi hành", "Passengers": "Hành khách", "Choose seats": "Chọn chỗ ngồi",
  "Front of coach": "Đầu xe",
  "Selected": "Đã chọn", "Taken": "Đã có người", "Free": "Miễn phí", "Back": "Quay lại", "Continue": "Tiếp tục",
  "Pickup point": "Điểm đón",
  "Your seat is held for 10 minutes once you reach checkout.": "Chỗ ngồi sẽ được giữ 10 phút khi bạn đến bước thanh toán.",
  "Attraction add-ons (per person)": "Dịch vụ tham quan thêm (mỗi người)",
  "Pickup fee": "Phí đón", "Subtotal": "Tạm tính", "Go to checkout": "Tiến hành thanh toán",
  "Order review & checkout": "Kiểm tra đơn & thanh toán",
  "Seat lock expired": "Thời gian giữ chỗ đã hết",
  "Seat held for": "Giữ chỗ trong",
  "Please go back and reselect your seats.": "Vui lòng quay lại và chọn chỗ ngồi lần nữa.",
  "Complete checkout before the timer runs out.": "Hãy hoàn tất thanh toán trước khi hết thời gian.",
  "Lead passenger details": "Thông tin hành khách đại diện",
  "Full name": "Họ và tên", "Email": "Email", "Phone": "Số điện thoại",
  "Payment method": "Phương thức thanh toán",
  "Credit / Debit Card": "Thẻ tín dụng / ghi nợ", "Bank Transfer QR": "Chuyển khoản QR",
  "Payments are encrypted and processed securely.": "Thanh toán được mã hóa và xử lý an toàn.",
  "Booking summary": "Tóm tắt đặt chỗ",
  "Vehicle ticket": "Vé phương tiện", "Taxes & fees (8%)": "Thuế & phí (8%)", "Total payable": "Tổng thanh toán",
  "Booking confirmed!": "Đặt chỗ thành công!",
  "Transport + Attraction": "Di chuyển + Tham quan",
  "One QR · boarding + entry": "Một mã QR · lên xe + vào cửa",
  "Pickup time": "Giờ đón", "None": "Không có", "Amount paid": "Số tiền đã thanh toán",
  "Trip recap": "Tóm tắt chuyến đi", "Offline access enabled": "Có thể xem khi ngoại tuyến",
  "Downloaded": "Đã tải xuống", "Download PDF": "Tải PDF", "Add to Wallet": "Thêm vào Ví", "Email / SMS": "Email / SMS", "Book another tour": "Đặt tour khác",
  "Create your account": "Tạo tài khoản",
  "Welcome back": "Chào mừng trở lại",
  "Book combo e-tickets and keep every trip in one place.": "Đặt vé điện tử combo và quản lý mọi chuyến đi tại một nơi.",
  "Sign in to manage your bookings and saved tours.": "Đăng nhập để quản lý đặt chỗ và tour đã lưu.",
  "Or continue with": "Hoặc tiếp tục với",
  "Password": "Mật khẩu", "Confirm password": "Xác nhận mật khẩu",
  "I agree to the": "Tôi đồng ý với", "Terms & Conditions": "Điều khoản & Điều kiện", "and Privacy Policy.": "và Chính sách quyền riêng tư.",
  "Remember me": "Ghi nhớ tôi", "Forgot password?": "Quên mật khẩu?", "Create Account": "Tạo tài khoản", "Sign In": "Đăng nhập",
  "Already have an account?": "Đã có tài khoản?", "Don't have an account?": "Chưa có tài khoản?", "Sign up": "Đăng ký",
  "Passwords do not match.": "Mật khẩu không khớp.", "Password must be at least 6 characters.": "Mật khẩu phải có ít nhất 6 ký tự.",
  "Please accept the Terms & Conditions to continue.": "Vui lòng chấp nhận Điều khoản & Điều kiện để tiếp tục.",
  "Enter your email first, then tap Forgot password.": "Hãy nhập email trước, sau đó chọn Quên mật khẩu.",
  "Welcome to TAT Booking!": "Chào mừng đến với TAT Booking!",
  "Set a new password": "Đặt mật khẩu mới", "New password": "Mật khẩu mới", "Update password": "Cập nhật mật khẩu", "Password updated": "Đã cập nhật mật khẩu",
  "Choose a new password for your TAT Booking account.": "Chọn mật khẩu mới cho tài khoản TAT Booking của bạn.",
  "Admin dashboard": "Trang quản trị", "Tours, transport, bookings and staff in one place.": "Quản lý tour, phương tiện, đặt chỗ và nhân viên tại một nơi.",
  "Settings": "Cài đặt", "Total bookings": "Tổng lượt đặt", "Revenue (30d)": "Doanh thu (30 ngày)", "Seat utilization": "Tỷ lệ sử dụng chỗ", "Active tours": "Tour đang hoạt động",
  "Tours & Catalog": "Tour & danh mục", "Transport & Providers": "Phương tiện & nhà cung cấp", "Bookings & Revenue": "Đặt chỗ & doanh thu", "Users & Security": "Người dùng & bảo mật",
  "Tour": "Tour", "Destination": "Điểm đến", "Price": "Giá", "Rating": "Đánh giá", "Status": "Trạng thái", "Live": "Đang bán", "Edit": "Sửa", "Hide": "Ẩn",
  "Seat capacity": "Sức chứa", "Attraction quota": "Số điểm tham quan", "Recent bookings": "Đặt chỗ gần đây", "This month": "Tháng này", "Booking": "Mã đặt", "Customer": "Khách hàng", "Amount": "Số tiền",
  "Paid": "Đã thanh toán", "Pending": "Đang chờ", "Refunded": "Đã hoàn tiền", "Staff & roles": "Nhân viên & vai trò", "Add user": "Thêm người dùng", "Name": "Tên", "Role": "Vai trò", "Active": "Hoạt động", "Suspended": "Tạm khóa", "Moderator": "Điều phối viên", "Staff": "Nhân viên",
  "Page not found": "Không tìm thấy trang", "The page you're looking for doesn't exist or has been moved.": "Trang bạn tìm không tồn tại hoặc đã được di chuyển.", "Go home": "Về trang chủ",
  "This page didn't load": "Không thể tải trang", "Something went wrong on our end. You can try refreshing or head back home.": "Đã xảy ra lỗi. Bạn có thể thử tải lại hoặc về trang chủ.", "Try again": "Thử lại",
  "Emerald Bay Cruise & Cave Discovery": "Du thuyền Vịnh Ngọc & khám phá hang động",
  "Golden Temple Trail & Heritage Walk": "Hành trình đền vàng & dạo bước di sản",
  "Highland Terraces Sunrise Expedition": "Đón bình minh trên ruộng bậc thang",
  "Lantern Old Town Evening & Boat Ride": "Phố cổ đèn lồng & du thuyền buổi tối",
  "Turquoise Island Hopping & Snorkel Combo": "Combo khám phá đảo xanh & lặn ngắm san hô",
  "Jungle Waterfall & Canopy Walk": "Thác rừng & đường đi trên tán cây",
  "Ha Long Bay": "Vịnh Hạ Long", "Sapa Highlands": "Cao nguyên Sa Pa", "Hoi An": "Hội An", "Phu Quoc": "Phú Quốc", "Da Lat": "Đà Lạt",
  "1 day · 10h": "1 ngày · 10 giờ", "1 day · 8h": "1 ngày · 8 giờ", "2 days · 1 night": "2 ngày · 1 đêm", "Half day · 5h": "Nửa ngày · 5 giờ", "1 day · 9h": "1 ngày · 9 giờ", "1 day · 7h": "1 ngày · 7 giờ",
  "Old Quarter Lobby Lounge": "Sảnh khách sạn Phố Cổ", "Central Station — Gate B": "Ga trung tâm — Cổng B", "Riverside Hotel Strip": "Dãy khách sạn ven sông", "Airport Road Shuttle Bay": "Điểm đón đường sân bay"
};

const patterns: Array<[RegExp, (...parts: string[]) => string]> = [
  [/^(\d+) combos match your filters$/, (n) => `${n} combo phù hợp với bộ lọc`],
  [/^Up to (.+) per person$/, (p) => `Tối đa ${p} mỗi người`],
  [/^Pick (\d+) seats?\. Selected:$/, (n) => `Chọn ${n} chỗ. Đã chọn:`],
  [/^Seat (.+) \(taken\)$/, (s) => `Ghế ${s} (đã có người)`],
  [/^Seat (.+) \(selected\)$/, (s) => `Ghế ${s} (đã chọn)`],
  [/^Seat (.+)$/, (s) => `Ghế ${s}`],
  [/^Scan with your banking app to pay (.+)$/, (p) => `Quét bằng ứng dụng ngân hàng để thanh toán ${p}`],
  [/^Your combo e-ticket is ready\. Reference (.+)\.$/, (c) => `Vé điện tử combo đã sẵn sàng. Mã đặt chỗ ${c}.`],
  [/^(\d+) selected$/, (n) => `Đã chọn ${n}`],
  [/^(\d+) route points · pickup, stopovers and attraction entries shown live\.$/, (n) => `${n} điểm trên tuyến · hiển thị trực tiếp điểm đón, điểm dừng và điểm tham quan.`],
  [/^(.+) venues$/, (n) => `${n} địa điểm`],
  [/^Pay (.+)$/, (p) => `Thanh toán ${p}`],
  [/^Seats (.+)$/, (s) => `Chỗ ${s}`],
];

function translateText(value: string) {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const clean = value.trim();
  if (!clean) return value;
  const direct = vi[clean];
  if (direct) return `${leading}${direct}${trailing}`;
  for (const [pattern, replace] of patterns) {
    const match = clean.match(pattern);
    if (match) return `${leading}${replace(...match.slice(1))}${trailing}`;
  }
  return value;
}

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (value: string) => string;
};
const LanguageContext = createContext<LanguageContextValue | null>(null);
const originals = new WeakMap<Node, { source: string; translated: string }>();
const attrOriginals = new WeakMap<Element, Map<string, { source: string; translated: string }>>();

function translateDocument(language: Language) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
  const root = document.documentElement;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    if (parent && !["SCRIPT", "STYLE"].includes(parent.tagName)) {
      const current = node.textContent ?? "";
       const saved = originals.get(node);
       const source = saved && (current === saved.source || current === saved.translated) ? saved.source : current;
      const next = language === "vi" ? translateText(source) : source;
       originals.set(node, { source, translated: next });
      if (current !== next) node.textContent = next;
    }
    node = walker.nextNode();
  }
  document.querySelectorAll("[aria-label], [placeholder], [title]").forEach((element) => {
    let saved = attrOriginals.get(element);
    if (!saved) { saved = new Map(); attrOriginals.set(element, saved); }
    for (const attr of ["aria-label", "placeholder", "title"]) {
      const current = element.getAttribute(attr);
      if (!current) continue;
       const previous = saved.get(attr);
       const source = previous && (current === previous.source || current === previous.translated) ? previous.source : current;
       const next = language === "vi" ? translateText(source) : source;
       saved.set(attr, { source, translated: next });
       element.setAttribute(attr, next);
    }
  });
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "vi") setLanguageState("vi");
  }, []);
  useEffect(() => {
    translateDocument(language);
    const observer = new MutationObserver(() => translateDocument(language));
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);
   const value = useMemo(() => ({
     language,
     setLanguage: (next: Language) => {
       window.localStorage.setItem(STORAGE_KEY, next);
       setLanguageState(next);
     },
     t: (text: string) => language === "vi" ? translateText(text) : text,
   }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
