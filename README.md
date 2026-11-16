# Okutama 21.11 — một ngày ngắm lá đỏ

Trang tĩnh (HTML/CSS/JS thuần, không cần build) cho chuyến đi Okutama thứ Bảy 21/11/2026.

## Xem thử trên máy

```bash
python3 -m http.server 8765
```

Rồi mở http://127.0.0.1:8765

## Đưa lên GitHub Pages

```bash
git init -b main && git add . && git commit -m "Okutama 21.11"
gh repo create okutama-2111 --public --source=. --push
gh api -X POST repos/{owner}/okutama-2111/pages -f "source[branch]=main" -f "source[path]=/"
```

Hoặc vào Settings → Pages của repo, chọn nhánh `main`, thư mục `/ (root)`.
Trang chỉ dùng đường dẫn tương đối nên chạy được ở `https://<user>.github.io/<repo>/`.

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `index.html` | Toàn bộ nội dung: lịch trình, tàu xe, hành lý, lá đỏ, chi phí, lưu ý |
| `css/style.css` | Giao diện |
| `js/main.js` | Hiệu ứng: lá rơi, núi nhiều lớp, bảng lật, bầu trời theo giờ, ba lô, cây đổi màu |
| `assets/trailer.mp4` | Video 20 giây nhúng trong "cửa sổ tàu" |
| `video/` | Mã nguồn video (Remotion) |

## Sửa và render lại video

```bash
cd video
npm install
npm run studio   # xem trước, chỉnh trong src/Trailer.jsx
npm run render   # xuất ../assets/trailer.mp4
npm run poster   # xuất ảnh bìa ../assets/trailer-poster.jpg
```

## Nguồn số liệu (tra ngày 16/11/2026)

- Giờ tàu: Yahoo! 乗換案内 và bảng giờ JR East cho thứ Bảy 21/11/2026, tính từ ga 獨協大学前, tập trung ở ga Tachikawa
- Giờ xe buýt: NAVITIME, Nishi Tokyo Bus
- Lá đỏ: Weathernews (hồ Okutama)
- Đường mòn: Okutama Visitor Center, bản cập nhật 6/11/2026

Giá xe buýt, giá onsen và nhiệt độ là số ước tính. Kiểm tra lại các đường dẫn ở cuối trang vào tối thứ Sáu.
