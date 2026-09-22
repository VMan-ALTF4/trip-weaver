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
  "Close": "Đóng",
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
  "Filter tours by price, transport type, attraction category and pickup point, and follow every route on an interactive map.": "Lọc tour theo giá, phương tiện, loại điểm tham quan và điểm đón, đồng thời theo dõi từng hành trình trên bản đồ tương tác.",
  "Split-screen tour list and interactive route map with pickup points and attraction stops.": "Danh sách tour và bản đồ hành trình tương tác hiển thị điểm đón cùng các điểm tham quan.",
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
  "Review your combo booking and pay with VNPay, Momo, card or bank QR.": "Kiểm tra đơn combo và thanh toán qua VNPay, Momo, thẻ hoặc QR ngân hàng.",
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
  "Your combo e-ticket is ready. Reference": "Vé điện tử combo đã sẵn sàng. Mã đặt chỗ",
  "Your unified combo QR e-ticket for transport boarding and attraction entry.": "Vé điện tử combo QR dùng để lên phương tiện và vào điểm tham quan.",
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
  "Choose a new password for your TAT Booking account and get back to your trips.": "Chọn mật khẩu mới cho tài khoản TAT Booking và tiếp tục hành trình của bạn.",
  "Set a new password for your TAT Booking account.": "Đặt mật khẩu mới cho tài khoản TAT Booking của bạn.",
  "Admin dashboard": "Trang quản trị", "Tours, transport, bookings and staff in one place.": "Quản lý tour, phương tiện, đặt chỗ và nhân viên tại một nơi.",
  "Manage tours, transport, bookings and users.": "Quản lý tour, phương tiện, đặt chỗ và người dùng.",
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
  ,"Ayutthaya": "Ayutthaya"
  ,"Sail through limestone karsts on a private day cruise, with kayaking, a cave walk and a seafood lunch on board.": "Du ngoạn giữa những núi đá vôi trên du thuyền riêng trong ngày, chèo kayak, khám phá hang động và dùng bữa trưa hải sản trên tàu."
  ,"A slow-travel rail journey to the old capital, with three temple entries and a riverside lunch included.": "Hành trình tàu hỏa thư thả đến cố đô, bao gồm vé vào ba ngôi đền và bữa trưa bên sông."
  ,"Overnight sleeper coach to the terraces, sunrise viewpoint access and a guided village trek with a homestay meal.": "Xe giường nằm qua đêm đến vùng ruộng bậc thang, ngắm bình minh và đi bộ bản làng cùng hướng dẫn viên, kèm bữa ăn tại nhà dân."
  ,"Private car transfer to the lantern-lit old town with a heritage ticket, street-food tasting and a river boat ride.": "Xe riêng đưa đón đến phố cổ lung linh đèn lồng, kèm vé di sản, thưởng thức ẩm thực đường phố và đi thuyền trên sông."
  ,"Three-island speedboat route with snorkel gear, a beach club pass and an all-you-can-eat grill lunch.": "Hành trình tàu cao tốc qua ba đảo, kèm dụng cụ lặn, vé câu lạc bộ bãi biển và tiệc nướng tự chọn."
  ,"Private car into the highlands for a canopy boardwalk, waterfall pool swim and a forest picnic.": "Xe riêng lên cao nguyên để đi bộ trên tán rừng, tắm hồ thác nước và dã ngoại giữa rừng."
  ,"Sung Sot Cave entry": "Vé vào hang Sửng Sốt", "Titop Island viewpoint": "Điểm ngắm cảnh đảo Titop", "Kayak rental (1h)": "Thuê kayak (1 giờ)"
  ,"Wat Mahathat entry": "Vé vào Wat Mahathat", "Historical Park pass": "Vé Công viên Lịch sử", "River shuttle boat": "Thuyền đưa đón trên sông"
  ,"Cat Cat village entry": "Vé vào bản Cát Cát", "Fansipan cable car": "Cáp treo Fansipan", "Sunrise viewpoint pass": "Vé điểm ngắm bình minh"
  ,"Old Town heritage ticket": "Vé di sản Phố Cổ", "River boat with lantern": "Thuyền sông và đèn hoa đăng"
  ,"Snorkel park entry": "Vé công viên lặn biển", "Beach club day pass": "Vé ngày câu lạc bộ bãi biển"
  ,"National park entry": "Vé vào vườn quốc gia", "Canopy walkway ticket": "Vé đường đi trên tán rừng"
  ,"Pickup at Old Quarter": "Đón tại Phố Cổ", "Meet your guide at the hotel lobby lounge.": "Gặp hướng dẫn viên tại sảnh khách sạn."
  ,"Board the cruise": "Lên du thuyền", "Welcome drink and safety briefing at Tuan Chau pier.": "Thưởng thức đồ uống chào mừng và nghe hướng dẫn an toàn tại bến Tuần Châu."
  ,"Sung Sot Cave": "Hang Sửng Sốt", "Guided walk through the three vaulted chambers.": "Tham quan có hướng dẫn qua ba khoang hang mái vòm."
  ,"Seafood lunch on deck": "Bữa trưa hải sản trên boong", "Set menu with vegetarian option.": "Thực đơn theo suất, có lựa chọn món chay."
  ,"Kayak & swim stop": "Chèo kayak & tắm biển", "Free time around Luon lagoon.": "Tự do khám phá khu vực đầm Luồn."
  ,"Drop-off": "Trả khách", "Return to your original pickup point.": "Trở về điểm đón ban đầu."
  ,"Meet at Central Station": "Gặp tại Ga Trung tâm", "Guide hands out rail tickets at Gate B.": "Hướng dẫn viên phát vé tàu tại Cổng B."
  ,"Arrive old capital": "Đến cố đô", "Short tuk-tuk transfer to first temple.": "Di chuyển ngắn bằng tuk-tuk đến ngôi đền đầu tiên."
  ,"Guided heritage walk, 90 minutes.": "Đi bộ khám phá di sản cùng hướng dẫn viên trong 90 phút."
  ,"Riverside lunch": "Bữa trưa bên sông", "Local set menu overlooking the river.": "Thực đơn địa phương theo suất nhìn ra sông."
  ,"Return train": "Tàu trở về", "Reserved seats in car 4.": "Ghế đã đặt trước tại toa số 4."
  ,"Sleeper coach departs": "Xe giường nằm khởi hành", "Reclining berths with blanket and water.": "Giường ngả có chăn và nước uống."
  ,"Sunrise viewpoint": "Điểm ngắm bình minh", "Arrive before first light for the terrace panorama.": "Đến trước bình minh để ngắm toàn cảnh ruộng bậc thang."
  ,"Village trek": "Đi bộ bản làng", "Moderate 6 km loop with local guide.": "Cung đường vòng 6 km vừa sức cùng hướng dẫn viên địa phương."
  ,"Homestay lunch": "Bữa trưa tại nhà dân", "Family-style highland meal.": "Bữa ăn cao nguyên kiểu gia đình."
  ,"Cable car": "Cáp treo", "Optional summit ride included in combo.": "Chuyến cáp treo lên đỉnh tùy chọn đã gồm trong combo."
  ,"Hotel pickup": "Đón tại khách sạn", "Private 4-seat car with driver.": "Xe riêng 4 chỗ có tài xế."
  ,"Heritage houses": "Nhà cổ di sản", "Ticket covers five monuments, guide picks three.": "Vé áp dụng cho năm di tích, hướng dẫn viên chọn ba điểm."
  ,"Street-food tasting": "Thưởng thức ẩm thực đường phố", "Six local tastings on foot.": "Đi bộ thưởng thức sáu món địa phương."
  ,"River boat": "Thuyền trên sông", "30-minute lantern release ride.": "Chuyến thả hoa đăng kéo dài 30 phút."
  ,"Coach pickup": "Xe đón khách", "Shared shuttle from Airport Road hotels.": "Xe đưa đón chung từ các khách sạn trên Đường Sân bay."
  ,"Speedboat departs": "Tàu cao tốc khởi hành", "Life jackets and snorkel kit provided.": "Có sẵn áo phao và bộ dụng cụ lặn."
  ,"Coral reef stop": "Điểm dừng rạn san hô", "Guided snorkel with instructor.": "Lặn ngắm san hô cùng huấn luyện viên."
  ,"Grill lunch": "Bữa trưa tiệc nướng", "Beach club buffet.": "Tiệc buffet tại câu lạc bộ bãi biển."
  ,"Return": "Trở về", "Drop-off at the pickup point.": "Trả khách tại điểm đón."
  ,"Private car, air-conditioned.": "Xe riêng có điều hòa.", "Park entry": "Vào công viên", "Ranger briefing and trail map.": "Hướng dẫn từ kiểm lâm và nhận bản đồ đường mòn."
  ,"Canopy walkway": "Đường đi trên tán rừng", "600 m suspended boardwalk.": "Lối đi treo dài 600 m."
  ,"Waterfall picnic": "Dã ngoại bên thác", "Packed picnic by the pool.": "Bữa ăn dã ngoại bên hồ."
  ,"Air-conditioned coach": "Xe khách có điều hòa", "Licensed English guide": "Hướng dẫn viên tiếng Anh có chứng chỉ", "Cave & island entry tickets": "Vé vào hang và đảo", "Lunch on board": "Bữa trưa trên tàu"
  ,"Personal expenses": "Chi phí cá nhân", "Tips": "Tiền boa", "Travel insurance": "Bảo hiểm du lịch"
  ,"Return rail ticket": "Vé tàu khứ hồi", "3 temple entries": "Vé vào 3 ngôi đền", "Guide": "Hướng dẫn viên", "Lunch": "Bữa trưa", "Drinks": "Đồ uống", "Hotel transfer": "Đưa đón khách sạn"
  ,"Sleeper coach both ways": "Xe giường nằm khứ hồi", "Homestay night": "Một đêm nhà dân", "Viewpoint & village entries": "Vé điểm ngắm cảnh và bản làng", "2 meals": "2 bữa ăn", "Trekking poles": "Gậy leo núi", "Personal gear": "Đồ dùng cá nhân"
  ,"Heritage ticket": "Vé di sản", "Food tastings": "Thưởng thức ẩm thực", "Boat ride": "Đi thuyền", "Alcoholic drinks": "Đồ uống có cồn", "Souvenirs": "Quà lưu niệm"
  ,"Coach transfer": "Xe đưa đón", "Speedboat": "Tàu cao tốc", "Snorkel gear": "Dụng cụ lặn", "Buffet lunch": "Bữa trưa buffet", "Beach club pass": "Vé câu lạc bộ bãi biển", "Diving upgrade": "Nâng cấp lặn biển", "Underwater camera": "Máy ảnh dưới nước"
  ,"Park & canopy tickets": "Vé công viên và đường đi trên tán rừng", "Picnic": "Dã ngoại", "Swim gear": "Đồ bơi", "Insurance": "Bảo hiểm"
  ,"Old Quarter pickup": "Điểm đón Phố Cổ", "Highway rest stop": "Trạm nghỉ cao tốc", "Tuan Chau pier": "Bến Tuần Châu"
  ,"Riverside halt": "Điểm dừng bên sông", "Historical Park": "Công viên Lịch sử", "Wat Mahathat": "Wat Mahathat"
  ,"Mountain pass stop": "Điểm dừng đèo núi", "Cable car station": "Ga cáp treo", "Beach resorts pickup": "Điểm đón khu nghỉ dưỡng biển", "Old Town gate": "Cổng Phố Cổ"
  ,"Airport Road pickup": "Điểm đón Đường Sân bay", "Marina": "Bến du thuyền", "Coral reef": "Rạn san hô", "Beach club": "Câu lạc bộ bãi biển", "City Center pickup": "Điểm đón Trung tâm", "Forest gate": "Cổng rừng", "Waterfall": "Thác nước"
  ,"Cruise": "Du thuyền", "UNESCO": "UNESCO", "Temples": "Đền chùa", "Trekking": "Đi bộ đường dài", "Overnight": "Qua đêm", "Evening": "Buổi tối", "Snorkeling": "Lặn biển", "Family": "Gia đình"
  ,"Tour coach on a coastal mountain road at sunset": "Xe du lịch trên cung đường núi ven biển lúc hoàng hôn"
  ,"Accept terms and conditions": "Chấp nhận điều khoản và điều kiện", "We sent a confirmation link to": "Chúng tôi đã gửi liên kết xác nhận đến", "Password reset link sent to": "Đã gửi liên kết đặt lại mật khẩu đến"
  ,"Open it to activate your account.": "Hãy mở liên kết để kích hoạt tài khoản.", "pax": "hành khách", "Vehicle ticket": "Vé phương tiện"
  ,"TAT Booking — Tours, Transport & Attraction Combo Tickets": "TAT Booking — Tour, phương tiện & vé tham quan combo"
  ,"Explore destinations and book transport seats plus attraction entry in one combo e-ticket. Live seat maps, route maps and transparent pricing.": "Khám phá điểm đến, đặt chỗ phương tiện và vé tham quan trong một vé điện tử combo. Sơ đồ chỗ ngồi, bản đồ hành trình trực tiếp và giá minh bạch."
  ,"TAT Booking — One trip, one combo e-ticket": "TAT Booking — Một hành trình, một vé điện tử combo"
  ,"Book tours, seats and attraction tickets together with transparent pricing.": "Đặt tour, chỗ ngồi và vé tham quan cùng lúc với giá minh bạch."
  ,"Browse Tours & Route Maps — TAT Booking": "Xem tour & bản đồ hành trình — TAT Booking"
  ,"Tour Detail & Seat Selection — TAT Booking": "Chi tiết tour & chọn chỗ — TAT Booking", "Checkout — TAT Booking": "Thanh toán — TAT Booking"
  ,"Combo E-Ticket Confirmed — TAT Booking": "Đã xác nhận vé điện tử combo — TAT Booking", "Admin Dashboard — TAT Booking": "Trang quản trị — TAT Booking", "Reset your password — TAT Booking": "Đặt lại mật khẩu — TAT Booking"
};

const patterns: Array<[RegExp, (...parts: string[]) => string]> = [
  [/^\$(\d[\d,]*(?:\.\d+)?)$/, (amount) => `${amount.replace(/,/g, ".")} US$`],
  [/^(\d+) combos match your filters$/, (n) => `${n} combo phù hợp với bộ lọc`],
  [/^Up to$/, () => "Tối đa"],
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
  [/^Vehicle ticket × (\d+)$/, (n) => `Vé phương tiện × ${n}`],
  [/^Add-ons × (\d+)$/, (n) => `Dịch vụ thêm × ${n}`],
  [/^Pickup · (.+)$/, (place) => `Điểm đón · ${translateText(place)}`],
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
  document.querySelectorAll("[aria-label], [placeholder], [title], meta[content]").forEach((element) => {
    let saved = attrOriginals.get(element);
    if (!saved) { saved = new Map(); attrOriginals.set(element, saved); }
    for (const attr of ["aria-label", "placeholder", "title", "content"]) {
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
